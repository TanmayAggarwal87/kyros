import type { Task, TaskArtifactReference, TaskType } from '../contracts/task';
import type { Workflow } from '../contracts/workflow';
import { KyrosError } from '../errors/kyros-error';

export interface TaskExecutionContext {
  readonly task: Task;
  readonly workflow: Workflow;
  readonly upstreamArtifacts: readonly TaskArtifactReference[];
  readonly signal?: AbortSignal;
}

export interface TaskExecutionResult {
  readonly status: 'succeeded' | 'failed' | 'retry_domain';
  readonly outputData?: Record<string, unknown>;
  readonly outputArtifacts?: readonly TaskArtifactReference[];
  readonly error?: KyrosError;
  readonly refinedInput?: Record<string, unknown>; // Updated input for domain retry
}

export interface ITaskHandler {
  readonly taskType: TaskType;
  execute(context: TaskExecutionContext): Promise<TaskExecutionResult>;
}

export class TaskHandlerRegistry {
  private readonly handlers = new Map<TaskType, ITaskHandler>();

  register(handler: ITaskHandler): void {
    this.handlers.set(handler.taskType, handler);
  }

  get(taskType: TaskType): ITaskHandler | undefined {
    return this.handlers.get(taskType);
  }

  has(taskType: TaskType): boolean {
    return this.handlers.has(taskType);
  }
}
