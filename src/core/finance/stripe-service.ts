import crypto from 'node:crypto';
import { KyrosError } from '../errors/kyros-error';

export interface CreditDepositor {
  depositCredits(userId: string, amountUsd: number, receiptRef: string, description?: string): Promise<unknown>;
}

export function verifyStripeWebhookSignature(
  rawPayload: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds: number = 300
): boolean {
  if (!signatureHeader || !secret) return false;

  const parts = signatureHeader.split(',');
  let timestamp: string | null = null;
  let signature: string | null = null;

  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key === 't') timestamp = value;
    if (key === 'v1') signature = value;
  }

  if (!timestamp || !signature) return false;

  // Check timestamp tolerance
  const now = Math.floor(Date.now() / 1000);
  const eventTime = parseInt(timestamp, 10);
  if (isNaN(eventTime) || Math.abs(now - eventTime) > toleranceSeconds) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawPayload}`)
    .digest('hex');

  try {
    const expectedBuf = Buffer.from(expectedSignature, 'hex');
    const actualBuf = Buffer.from(signature, 'hex');
    if (expectedBuf.length !== actualBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}

export interface WebhookProcessingResult {
  readonly status: 'processed' | 'already_processed' | 'ignored';
  readonly eventId: string;
  readonly amountUsd?: number;
  readonly userId?: string;
}

export class StripeWebhookHandler {
  private readonly processedEvents = new Set<string>();
  private readonly processedReceipts = new Set<string>();

  constructor(
    private readonly budgetGovernor: CreditDepositor,
    private readonly webhookSecret: string
  ) {}

  async handleWebhook(rawBody: string, signatureHeader: string): Promise<WebhookProcessingResult> {
    const isValid = verifyStripeWebhookSignature(rawBody, signatureHeader, this.webhookSecret);
    if (!isValid) {
      throw new KyrosError({
        category: 'input',
        code: 'INVALID_SIGNATURE',
        safeMessage: 'Stripe webhook signature verification failed',
        retryable: false,
        scope: 'workflow',
      });
    }

    const event: unknown = JSON.parse(rawBody);
    if (!event || typeof event !== 'object' || !('id' in event) || typeof event.id !== 'string' || !('type' in event) || typeof event.type !== 'string') {
      throw new KyrosError({ category: 'input', code: 'INVALID_EVENT', safeMessage: 'Invalid Stripe event' });
    }
    const eventId = event.id;

    if (this.processedEvents.has(eventId)) {
      return { status: 'already_processed', eventId };
    }

    if (event.type === 'checkout.session.completed') {
      const data = 'data' in event ? event.data : undefined;
      const session = data && typeof data === 'object' && 'object' in data ? data.object : undefined;
      if (!session || typeof session !== 'object') return { status: 'ignored', eventId };
      const paymentStatus = 'payment_status' in session ? session.payment_status : undefined;
      const currency = 'currency' in session ? session.currency : undefined;
      const amountTotalCents = 'amount_total' in session ? session.amount_total : undefined;
      const sessionId = 'id' in session ? session.id : undefined;
      const reference = 'client_reference_id' in session ? session.client_reference_id : undefined;
      const intent = 'payment_intent' in session ? session.payment_intent : undefined;
      if (paymentStatus !== 'paid' || currency !== 'usd' || typeof amountTotalCents !== 'number' || !Number.isSafeInteger(amountTotalCents) || amountTotalCents <= 0 || typeof sessionId !== 'string' || typeof reference !== 'string') {
        return { status: 'ignored', eventId };
      }
      const userId = reference;
      const amountUsd = Number((amountTotalCents / 100).toFixed(4));
      const receiptRef = typeof intent === 'string' ? intent : sessionId;

      if (this.processedReceipts.has(receiptRef)) {
        this.processedEvents.add(eventId);
        return { status: 'already_processed', eventId };
      }

      await this.budgetGovernor.depositCredits(
        userId,
        amountUsd,
        receiptRef,
        `Stripe checkout deposit (${sessionId})`
      );

      this.processedReceipts.add(receiptRef);
      this.processedEvents.add(eventId);
      return { status: 'processed', eventId, amountUsd, userId };
    }

    return { status: 'ignored', eventId };
  }
}
