import { z } from 'zod';
import { fieldEvidenceSchema, type DatasetRecord, type FieldEvidence } from './dataset';
import type { NormalizedErrorPayload } from './errors';

export interface ValidationErrorItem {
  readonly field: string;
  readonly code: string;
  readonly message: string;
  readonly receivedValue: unknown;
}

export interface ValidatedRecord {
  readonly recordId: string;
  readonly sourceId: string;
  readonly sourceUrl: string;
  readonly sourceTitle?: string;
  readonly data: Record<string, unknown>;
  readonly evidence: Record<string, FieldEvidence>;
  readonly isValid: boolean;
  readonly validationErrors: readonly ValidationErrorItem[];
}

export interface ValidationSummary {
  readonly totalValidated: number;
  readonly validCount: number;
  readonly invalidCount: number;
  readonly validRecords: readonly ValidatedRecord[];
  readonly invalidRecords: readonly ValidatedRecord[];
}

export interface NormalizedRecord {
  readonly recordId: string;
  readonly sourceId: string;
  readonly sourceUrl: string;
  readonly sourceTitle?: string;
  readonly data: Record<string, unknown>;
  readonly evidence: Record<string, FieldEvidence>;
}

export interface DeduplicationDecision {
  readonly primaryRecordId: string;
  readonly mergedRecordIds: readonly string[];
  readonly matchKey: string;
  readonly reason: string;
}

export interface DeduplicationResult {
  readonly records: readonly DatasetRecord[];
  readonly duplicateDecisions: readonly DeduplicationDecision[];
  readonly stats: {
    readonly totalInput: number;
    readonly uniqueCount: number;
    readonly duplicatesRemoved: number;
  };
}

export interface QualityPipelineReport {
  readonly workflowId: string;
  readonly runId: string;
  readonly sourcesReceived: number;
  readonly sourcesRetrieved: number;
  readonly sourcesFailed: number;
  readonly recordsExtracted: number;
  readonly extractionFailures: number;
  readonly recordsValid: number;
  readonly recordsInvalid: number;
  readonly recordsDeduplicated: number;
  readonly finalRecords: readonly DatasetRecord[];
  readonly errors: readonly NormalizedErrorPayload[];
}

export const validationErrorItemSchema = z.object({
  field: z.string().min(1),
  code: z.string().min(1),
  message: z.string().min(1),
  receivedValue: z.unknown(),
});

export const validatedRecordSchema = z.object({
  recordId: z.string().min(1),
  sourceId: z.string().min(1),
  sourceUrl: z.string().url(),
  sourceTitle: z.string().optional(),
  data: z.record(z.string(), z.unknown()),
  evidence: z.record(z.string(), fieldEvidenceSchema),
  isValid: z.boolean(),
  validationErrors: z.array(validationErrorItemSchema),
});

export const deduplicationDecisionSchema = z.object({
  primaryRecordId: z.string().min(1),
  mergedRecordIds: z.array(z.string()),
  matchKey: z.string(),
  reason: z.string(),
});

export const deduplicationResultSchema = z.object({
  records: z.array(z.any()), // datasetRecordSchema
  duplicateDecisions: z.array(deduplicationDecisionSchema),
  stats: z.object({
    totalInput: z.number().int().nonnegative(),
    uniqueCount: z.number().int().nonnegative(),
    duplicatesRemoved: z.number().int().nonnegative(),
  }),
});
