import type { NormalizedErrorPayload } from './errors';
import type { DatasetFieldSchema } from './planner';

export type WorkflowState =
  | 'planning'
  | 'ready'
  | 'running'
  | 'completed'
  | 'paused'
  | 'partially_completed'
  | 'failed'
  | 'cancelled';

export interface BudgetPolicy {
  readonly maxSpendUsd: number;
  readonly perCallCeilingUsd?: number;
  readonly currency: 'USD';
  readonly allowPaidSources: boolean;
}

export interface WorkflowTimestamps {
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly startedAt?: string;
  readonly pausedAt?: string;
  readonly finishedAt?: string;
}

export interface Workflow {
  readonly id: string;
  readonly runId: string;
  readonly userId: string;
  readonly prompt: string;
  readonly status: WorkflowState;
  readonly summary?: string;
  readonly fieldSchema: readonly DatasetFieldSchema[];
  readonly budgetPolicy: BudgetPolicy;
  readonly failureInfo?: NormalizedErrorPayload;
  readonly timestamps: WorkflowTimestamps;
  readonly metadata?: Record<string, unknown>;
}

export interface WorkflowSummary {
  readonly workflowId: string;
  readonly runId: string;
  readonly status: WorkflowState;
  readonly totalTasks: number;
  readonly succeededTasks: number;
  readonly failedTasks: number;
  readonly skippedTasks: number;
  readonly runningTasks: number;
  readonly pendingTasks: number;
}
