import { z } from 'zod';
import type { CreditLedgerEntry, UserCreditAccount } from '../contracts/credits';
import { creditLedgerEntrySchema, userCreditAccountSchema } from '../contracts/credits';
import { KyrosError } from '../errors/kyros-error';

const accountRowSchema = z.object({
  user_id: z.string().min(1),
  balance_usd: z.coerce.number().nonnegative(),
  reserved_usd: z.coerce.number().nonnegative(),
  available_usd: z.coerce.number().nonnegative(),
  currency: z.literal('USD'),
  updated_at: z.string(),
});

const ledgerRowSchema = z.object({
  id: z.string(), user_id: z.string(), workflow_id: z.string().nullable().optional(),
  run_id: z.string().nullable().optional(), type: z.enum([
    'welcome_grant', 'stripe_topup', 'workflow_reservation', 'workflow_release', 'x402_debit', 'refund',
  ]), amount_usd: z.coerce.number(), description: z.string(),
  receipt_ref: z.string().nullable().optional(), created_at: z.string(),
});

export interface SupabaseCreditConfig {
  readonly url: string;
  readonly serviceRoleKey: string;
  readonly fetchImpl?: typeof fetch;
}

export class SupabaseCreditService {
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly key: string;

  constructor(config: SupabaseCreditConfig) {
    if (!config.url || !config.serviceRoleKey) {
      throw new KyrosError({ category: 'persistence', code: 'CREDIT_DB_UNCONFIGURED', safeMessage: 'Persistent credit ledger is not configured' });
    }
    this.baseUrl = new URL(config.url).origin;
    this.key = config.serviceRoleKey;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  static fromEnvironment(): SupabaseCreditService {
    return new SupabaseCreditService({
      url: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      serviceRoleKey: process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    });
  }

  private async request(path: string, body?: Record<string, unknown>): Promise<unknown> {
    const response = await this.fetchImpl(`${this.baseUrl}/rest/v1/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        apikey: this.key,
        ...(this.key.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${this.key}` }),
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      throw new KyrosError({ category: 'persistence', code: 'CREDIT_DB_ERROR', safeMessage: 'Credit ledger is unavailable', retryable: response.status >= 500 });
    }
    return response.json();
  }

  private parseAccount(value: unknown): UserCreditAccount {
    const row = accountRowSchema.parse(Array.isArray(value) ? value[0] : value);
    const account = {
      userId: row.user_id, balanceUsd: row.balance_usd, reservedUsd: row.reserved_usd,
      availableUsd: row.available_usd, currency: row.currency, updatedAt: row.updated_at,
    };
    if (Math.abs(account.balanceUsd - account.reservedUsd - account.availableUsd) > 0.0001) {
      throw new KyrosError({ category: 'persistence', code: 'CREDIT_BALANCE_INVALID', safeMessage: 'Credit ledger balance is inconsistent' });
    }
    return userCreditAccountSchema.parse(account);
  }

  async assertReady(): Promise<void> {
    if (await this.request('rpc/kyros_credit_ready', {}) !== true) {
      throw new KyrosError({ category: 'persistence', code: 'CREDIT_DB_UNCONFIGURED', safeMessage: 'Persistent credit ledger is not ready' });
    }
  }

  async getOrCreateAccount(userId: string): Promise<UserCreditAccount> {
    return this.parseAccount(await this.request('rpc/kyros_ensure_credit_account', { p_user_id: userId }));
  }

  async getLedger(userId: string): Promise<readonly CreditLedgerEntry[]> {
    const rows = await this.request(`kyros_credit_ledger?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc&limit=100`);
    if (!Array.isArray(rows)) throw new KyrosError({ category: 'persistence', code: 'CREDIT_LEDGER_INVALID', safeMessage: 'Credit ledger response is invalid' });
    return rows.map((value: unknown) => {
      const row = ledgerRowSchema.parse(value);
      return creditLedgerEntrySchema.parse({
        id: row.id, userId: row.user_id, workflowId: row.workflow_id ?? undefined,
        runId: row.run_id ?? undefined, type: row.type, amountUsd: row.amount_usd,
        description: row.description, timestamp: row.created_at, receiptRef: row.receipt_ref ?? undefined,
      });
    });
  }

  async depositCredits(userId: string, amountUsd: number, receiptRef: string, description = 'Stripe fiat top-up'): Promise<UserCreditAccount> {
    if (!Number.isSafeInteger(amountUsd * 100) || amountUsd <= 0 || amountUsd > 500 || !receiptRef) {
      throw new KyrosError({ category: 'input', code: 'INVALID_AMOUNT', safeMessage: 'Invalid credit deposit' });
    }
    return this.parseAccount(await this.request('rpc/kyros_deposit_credit', {
      p_user_id: userId, p_amount_usd: amountUsd, p_receipt_ref: receiptRef, p_description: description,
    }));
  }

  async reserveWorkflowBudget(userId: string, workflowId: string, runId: string, amountUsd: number): Promise<UserCreditAccount> {
    return this.parseAccount(await this.request('rpc/kyros_reserve_credit', {
      p_user_id: userId, p_workflow_id: workflowId, p_run_id: runId, p_amount_usd: amountUsd,
    }));
  }

  async settleX402Debit(userId: string, workflowId: string, runId: string, amountUsd: number, receiptRef: string): Promise<UserCreditAccount> {
    return this.parseAccount(await this.request('rpc/kyros_settle_credit', {
      p_user_id: userId, p_workflow_id: workflowId, p_run_id: runId, p_amount_usd: amountUsd, p_receipt_ref: receiptRef,
    }));
  }

  async releaseWorkflowBudget(userId: string, workflowId: string, runId: string, amountUsd: number): Promise<UserCreditAccount> {
    return this.parseAccount(await this.request('rpc/kyros_release_credit', {
      p_user_id: userId, p_workflow_id: workflowId, p_run_id: runId, p_amount_usd: amountUsd,
    }));
  }
}
