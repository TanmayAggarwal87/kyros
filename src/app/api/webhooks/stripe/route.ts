import { NextResponse } from 'next/server';
import { StripeWebhookHandler } from '@/core/finance/stripe-service';
import { SupabaseCreditService } from '@/core/finance/supabase-credit-service';
import { KyrosError } from '@/core/errors/kyros-error';

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'Stripe webhook is not configured' }, { status: 503 });
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature') ?? '';
  try {
    const handler = new StripeWebhookHandler(SupabaseCreditService.fromEnvironment(), secret);
    const result = await handler.handleWebhook(rawBody, signature);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof KyrosError && error.code === 'INVALID_SIGNATURE') {
      return NextResponse.json({ error: 'Invalid Stripe signature' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Stripe event could not be recorded' }, { status: 503 });
  }
}
