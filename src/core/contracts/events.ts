import type { NormalizedErrorPayload } from './errors';
import type { TaskAttemptCounts, TaskState, TaskType } from './task';
import type { WorkflowState } from './workflow';

export interface TaskProgressItem {
  readonly id: string;
  readonly name: string;
  readonly type: TaskType;
  readonly status: TaskState;
  readonly attemptCounts: TaskAttemptCounts;
  readonly startedAt?: string;
  readonly finishedAt?: string;
  readonly failureInfo?: NormalizedErrorPayload;
}

export interface WorkflowProgressSnapshot {
  readonly workflowId: string;
  readonly runId: string;
  readonly status: WorkflowState;
  readonly progressPercent: number;
  readonly tasks: readonly TaskProgressItem[];
  readonly totalTasks: number;
  readonly completedTasks: number;
  readonly failedTasks: number;
  readonly failureInfo?: NormalizedErrorPayload;
  readonly updatedAt: string;
}

export type WorkflowEventType =
  | 'workflow:created'
  | 'workflow:state_changed'
  | 'task:state_changed'
  | 'task:retry_scheduled'
  | 'workflow:completed'
  | 'workflow:failed'
  | 'workflow:cancelled'
  | 'workflow:paused';

export interface WorkflowEvent {
  readonly id: string;
  readonly type: WorkflowEventType;
  readonly workflowId: string;
  readonly runId: string;
  readonly timestamp: string;
  readonly payload: Record<string, unknown>;
}

export interface IWorkflowEventObserver {
  onEvent(event: WorkflowEvent): void;
}
