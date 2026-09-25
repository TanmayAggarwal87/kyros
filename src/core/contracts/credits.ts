import { z } from 'zod';

export interface UserCreditAccount {
  readonly userId: string;
  readonly balanceUsd: number;
  readonly reservedUsd: number;
  readonly availableUsd: number;
  readonly currency: 'USD';
  readonly updatedAt: string;
}

export type LedgerEntryType =
  | 'welcome_grant'
  | 'stripe_topup'
  | 'workflow_reservation'
  | 'workflow_release'
  | 'x402_debit'
  | 'refund';

export interface CreditLedgerEntry {
  readonly id: string;
  readonly userId: string;
  readonly workflowId?: string;
  readonly runId?: string;
  readonly type: LedgerEntryType;
  readonly amountUsd: number;
  readonly description: string;
  readonly timestamp: string;
  readonly receiptRef?: string;
}

export const userCreditAccountSchema = z.object({
  userId: z.string().min(1),
  balanceUsd: z.number().nonnegative(),
  reservedUsd: z.number().nonnegative(),
  availableUsd: z.number().nonnegative(),
  currency: z.literal('USD'),
  updatedAt: z.string(),
});

export const creditLedgerEntrySchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  workflowId: z.string().optional(),
  runId: z.string().optional(),
  type: z.enum([
    'welcome_grant',
    'stripe_topup',
    'workflow_reservation',
    'workflow_release',
    'x402_debit',
    'refund',
  ]),
  amountUsd: z.number(),
  description: z.string(),
  timestamp: z.string(),
  receiptRef: z.string().optional(),
});
