import { z } from 'zod';
import { supportStateSchema, type SupportState } from './dataset';
import type { DatasetFieldSchema } from './planner';
import { DatasetFieldSchemaZod } from '../planner/schema';

export interface ExtractedField {
  readonly value: unknown;
  readonly snippet?: string;
  readonly supportState: SupportState;
  readonly rationale?: string;
}

export interface ExtractedRecord {
  readonly recordId: string;
  readonly sourceId: string;
  readonly sourceUrl: string;
  readonly sourceTitle?: string;
  readonly fields: Record<string, ExtractedField>;
}

export interface SourceContentInput {
  readonly sourceId: string;
  readonly url: string;
  readonly title?: string;
  readonly content: string;
  readonly query?: string;
}

export interface ExtractionRequest {
  readonly workflowId: string;
  readonly runId: string;
  readonly taskId: string;
  readonly userObjective: string;
  readonly fields: readonly DatasetFieldSchema[];
  readonly sources: readonly SourceContentInput[];
}

export interface ExtractionResult {
  readonly records: readonly ExtractedRecord[];
  readonly unextractedSources: readonly {
    readonly sourceId: string;
    readonly reason: string;
  }[];
}

export const extractedFieldSchema = z.object({
  value: z.unknown(),
  snippet: z.string().optional(),
  supportState: supportStateSchema,
  rationale: z.string().optional(),
});

export const extractedRecordSchema = z.object({
  recordId: z.string().min(1),
  sourceId: z.string().min(1),
  sourceUrl: z.string().url(),
  sourceTitle: z.string().optional(),
  fields: z.record(z.string(), extractedFieldSchema),
});

export const sourceContentInputSchema = z.object({
  sourceId: z.string().min(1),
  url: z.string().url(),
  title: z.string().optional(),
  content: z.string(),
  query: z.string().optional(),
});

export const extractionRequestSchema = z.object({
  workflowId: z.string().min(1),
  runId: z.string().min(1),
  taskId: z.string().min(1),
  userObjective: z.string().min(1),
  fields: z.array(DatasetFieldSchemaZod).min(1),
  sources: z.array(sourceContentInputSchema).min(1),
});

export const extractionResultSchema = z.object({
  records: z.array(extractedRecordSchema),
  unextractedSources: z.array(
    z.object({
      sourceId: z.string(),
      reason: z.string(),
    })
  ),
});
