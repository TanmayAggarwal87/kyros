import { z } from 'zod';

export type SupportState =
  | 'supported'
  | 'partially_supported'
  | 'inferred'
  | 'missing'
  | 'conflicting';

export type AcquisitionMethod =
  | 'exa_search'
  | 'webcmd_browser'
  | 'x402_paid'
  | 'gemini_extraction';

export interface TransactionReceipt {
  readonly hash?: string;
  readonly network?: string;
  readonly status?: 'confirmed' | 'pending' | 'failed';
  readonly resourceUri?: string;
  readonly amountUsd?: number;
}

export interface FieldEvidence {
  readonly value: unknown;
  readonly supportState: SupportState;
  readonly sourceUrl?: string;
  readonly sourceTitle?: string;
  readonly snippet?: string;
  readonly collectedAt: string;
  readonly acquisitionMethod: AcquisitionMethod;
  readonly costUsd?: number;
  readonly transactionReceipt?: TransactionReceipt;
}

export interface DatasetRecord {
  readonly id: string;
  readonly workflowId: string;
  readonly runId: string;
  readonly data: Record<string, unknown>;
  readonly evidence: Record<string, FieldEvidence>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DatasetFilter {
  readonly search?: string;
  readonly columnFilters?: Record<string, string>;
  readonly supportStates?: readonly SupportState[];
}

export interface DatasetSort {
  readonly column: string;
  readonly direction: 'asc' | 'desc';
}

export interface DatasetExportOptions {
  readonly format: 'csv' | 'json';
  readonly includeEvidence: boolean;
  readonly columns?: readonly string[];
}

export const supportStateSchema = z.enum([
  'supported',
  'partially_supported',
  'inferred',
  'missing',
  'conflicting',
]);

export const acquisitionMethodSchema = z.enum([
  'exa_search',
  'webcmd_browser',
  'x402_paid',
  'gemini_extraction',
]);

export const transactionReceiptSchema = z.object({
  hash: z.string().optional(),
  network: z.string().optional(),
  status: z.enum(['confirmed', 'pending', 'failed']).optional(),
  resourceUri: z.string().optional(),
  amountUsd: z.number().optional(),
});

export const fieldEvidenceSchema = z.object({
  value: z.unknown(),
  supportState: supportStateSchema,
  sourceUrl: z.string().url().optional(),
  sourceTitle: z.string().optional(),
  snippet: z.string().optional(),
  collectedAt: z.string(),
  acquisitionMethod: acquisitionMethodSchema,
  costUsd: z.number().nonnegative().optional(),
  transactionReceipt: transactionReceiptSchema.optional(),
});

export const datasetRecordSchema = z.object({
  id: z.string().min(1),
  workflowId: z.string().min(1),
  runId: z.string().min(1),
  data: z.record(z.string(), z.unknown()),
  evidence: z.record(z.string(), fieldEvidenceSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
