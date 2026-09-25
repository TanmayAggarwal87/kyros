import type { NormalizedErrorPayload } from './errors';

export type TaskType =
  | 'discovery'
  | 'browser_navigation'
  | 'extraction'
  | 'quality_validation'
  | 'deduplication';

export type TaskState =
  | 'pending'
  | 'runnable'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export type DependencyCompletionPolicy = 'all_succeeded' | 'allow_partial';

export interface TaskArtifactReference {
  readonly id: string;
  readonly type: 'source' | 'content' | 'record_slice' | 'dataset' | 'metadata';
  readonly uri: string;
  readonly mimeType?: string;
  readonly sizeBytes?: number;
  readonly metadata?: Record<string, unknown>;
}

export interface TaskAttemptCounts {
  readonly domain: number;
  readonly infrastructure: number;
}

export interface TaskTimestamps {
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly scheduledAt?: string;
  readonly startedAt?: string;
  readonly finishedAt?: string;
}

export interface Task<TInput = Record<string, unknown>, TOutput = Record<string, unknown>> {
  readonly id: string;
  readonly runId: string;
  readonly workflowId: string;
  readonly type: TaskType;
  readonly status: TaskState;
  readonly name: string;
  readonly description?: string;
  readonly dependencies: readonly string[];
  readonly completionPolicy: DependencyCompletionPolicy;
  readonly input: TInput;
  readonly outputArtifacts: readonly TaskArtifactReference[];
  readonly outputData?: TOutput;
  readonly attemptCounts: TaskAttemptCounts;
  readonly failureInfo?: NormalizedErrorPayload;
  readonly timestamps: TaskTimestamps;
  readonly claimedByWorkerId?: string;
  readonly claimedUntilMs?: number;
}
