import type { NormalizedErrorPayload } from '../contracts/errors';
import type { Task } from '../contracts/task';
import type { Workflow, WorkflowState } from '../contracts/workflow';
import type { DatasetRecord } from '../contracts/dataset';

export interface ITaskClaimer {
  /**
   * Atomically claims up to `limit` runnable tasks for `workerId` with a lease expiration.
   * Member 4 will implement this with a Postgres UPDATE ... FOR UPDATE SKIP LOCKED.
   */
  claimRunnableTasks(
    workflowId: string,
    workerId: string,
    limit: number,
    leaseDurationMs: number
  ): Promise<readonly Task[]>;

  /**
   * Releases an active claim on a task (e.g. if worker is stopping or task will be retried later).
   */
  releaseClaim(taskId: string, workerId: string): Promise<void>;

  /**
   * Extends the lease duration for a long-running task.
   */
  renewLease(taskId: string, workerId: string, extendByMs: number): Promise<void>;
}

export interface IWorkflowRepository {
  getWorkflow(id: string): Promise<Workflow | null>;
  getWorkflowsByUser(userId: string): Promise<readonly Workflow[]>;
  saveWorkflow(workflow: Workflow): Promise<void>;
  updateWorkflowStatus(
    id: string,
    status: WorkflowState,
    failureInfo?: NormalizedErrorPayload
  ): Promise<void>;

  getTasks(workflowId: string, runId?: string): Promise<readonly Task[]>;
  getTask(id: string): Promise<Task | null>;
  saveTasks(tasks: readonly Task[]): Promise<void>;
  updateTask(task: Task): Promise<void>;

  /**
   * Finds tasks marked 'running' whose lease has expired before `staleBeforeMs`.
   * Used for deterministic crash and interruption recovery.
   */
  findStrandedRunningTasks(workflowId: string, staleBeforeMs: number): Promise<readonly Task[]>;

  /**
   * Persists final dataset records with cell-level evidence.
   */
  saveDatasetRecords(records: readonly DatasetRecord[]): Promise<void>;

  /**
   * Retrieves dataset records with cell-level evidence for a workflow.
   */
  getDatasetRecords(workflowId: string, runId?: string): Promise<readonly DatasetRecord[]>;
}
