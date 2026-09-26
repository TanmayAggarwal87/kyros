import { z } from 'zod';
import { acquisitionMethodSchema, type AcquisitionMethod } from './dataset';

export interface SourceArtifact {
  readonly id: string;
  readonly workflowId: string;
  readonly runId: string;
  readonly taskId: string;
  readonly url: string;
  readonly title?: string;
  readonly author?: string;
  readonly publishedDate?: string;
  readonly retrievedAt: string;
  readonly query?: string;
  readonly acquisitionMethod: AcquisitionMethod;
  readonly contentReference?: string;
  readonly score?: number;
  readonly metadata?: Record<string, unknown>;
}

export interface ContentArtifact {
  readonly id: string;
  readonly sourceId: string;
  readonly url: string;
  readonly mimeType: string;
  readonly text: string;
  readonly highlights?: readonly string[];
  readonly summary?: string;
  readonly byteSize: number;
  readonly extractedAt: string;
}

export const sourceArtifactSchema = z.object({
  id: z.string().min(1),
  workflowId: z.string().min(1),
  runId: z.string().min(1),
  taskId: z.string().min(1),
  url: z.string().url(),
  title: z.string().optional(),
  author: z.string().optional(),
  publishedDate: z.string().optional(),
  retrievedAt: z.string(),
  query: z.string().optional(),
  acquisitionMethod: acquisitionMethodSchema,
  contentReference: z.string().optional(),
  score: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const contentArtifactSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  url: z.string().url(),
  mimeType: z.string().min(1),
  text: z.string(),
  highlights: z.array(z.string()).optional(),
  summary: z.string().optional(),
  byteSize: z.number().nonnegative(),
  extractedAt: z.string(),
});
