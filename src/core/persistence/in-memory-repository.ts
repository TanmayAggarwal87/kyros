import type { NormalizedErrorPayload } from '../contracts/errors';
import type { Task, TaskState } from '../contracts/task';
import type { Workflow, WorkflowState } from '../contracts/workflow';
import { TaskStateMachine, WorkflowStateMachine } from '../state/state-machine';
import type { ITaskClaimer, IWorkflowRepository } from './repository';

/**
 * In-memory repository and task claimer for testing, development, and vertical slices.
 * Clearly isolated behind interfaces so Member 4 can provide the production Supabase repository.
 */
export class InMemoryWorkflowRepository implements IWorkflowRepository, ITaskClaimer {
  private readonly workflows = new Map<string, Workflow>();
  private readonly tasks = new Map<string, Task>();

  // --- Workflow Methods ---

  async getWorkflow(id: string): Promise<Workflow | null> {
    const wf = this.workflows.get(id);
    return wf ? { ...wf } : null;
  }

  async saveWorkflow(workflow: Workflow): Promise<void> {
    this.workflows.set(workflow.id, { ...workflow });
  }

  async updateWorkflowStatus(
    id: string,
    status: WorkflowState,
    failureInfo?: NormalizedErrorPayload
  ): Promise<void> {
    const wf = this.workflows.get(id);
    if (!wf) {
      throw new Error(`Workflow with ID ${id} not found.`);
    }

    WorkflowStateMachine.assertTransition(id, wf.status, status);

    const now = new Date().toISOString();
    this.workflows.set(id, {
      ...wf,
      status,
      failureInfo: failureInfo ?? wf.failureInfo,
      timestamps: {
        ...wf.timestamps,
        updatedAt: now,
        startedAt: status === 'running' && !wf.timestamps.startedAt ? now : wf.timestamps.startedAt,
        pausedAt: status === 'paused' ? now : wf.timestamps.pausedAt,
        finishedAt: WorkflowStateMachine.isTerminal(status) ? now : wf.timestamps.finishedAt,
      },
    });
  }

  // --- Task Methods ---

  async getTasks(workflowId: string, runId?: string): Promise<readonly Task[]> {
    return Array.from(this.tasks.values())
      .filter((t) => t.workflowId === workflowId && (runId ? t.runId === runId : true))
      .map((t) => ({ ...t }));
  }

  async getTask(id: string): Promise<Task | null> {
    const task = this.tasks.get(id);
    return task ? { ...task } : null;
  }

  async saveTasks(tasks: readonly Task[]): Promise<void> {
    for (const t of tasks) {
      this.tasks.set(t.id, { ...t });
    }
  }

  async updateTask(task: Task): Promise<void> {
    const existing = this.tasks.get(task.id);
    if (existing && existing.status !== task.status) {
      TaskStateMachine.assertTransition(task.id, existing.status, task.status);
    }
    this.tasks.set(task.id, { ...task });
  }

  async findStrandedRunningTasks(workflowId: string, staleBeforeMs: number): Promise<readonly Task[]> {
    return Array.from(this.tasks.values())
      .filter((t) => {
        if (t.workflowId !== workflowId || t.status !== 'running') return false;
        // Stranded if claimedUntilMs is expired or missing
        return !t.claimedUntilMs || t.claimedUntilMs < staleBeforeMs;
      })
      .map((t) => ({ ...t }));
  }

  // --- ITaskClaimer Methods ---

  async claimRunnableTasks(
    workflowId: string,
    workerId: string,
    limit: number,
    leaseDurationMs: number
  ): Promise<readonly Task[]> {
    const now = Date.now();
    const claimed: Task[] = [];

    for (const task of this.tasks.values()) {
      if (claimed.length >= limit) break;

      if (task.workflowId === workflowId && task.status === 'runnable') {
        // Transition runnable -> running with lease
        TaskStateMachine.assertTransition(task.id, task.status, 'running');

        const updatedTask: Task = {
          ...task,
          status: 'running' as TaskState,
          claimedByWorkerId: workerId,
          claimedUntilMs: now + leaseDurationMs,
          timestamps: {
            ...task.timestamps,
            updatedAt: new Date().toISOString(),
            startedAt: task.timestamps.startedAt ?? new Date().toISOString(),
          },
        };

        this.tasks.set(task.id, updatedTask);
        claimed.push({ ...updatedTask });
      }
    }

    return claimed;
  }

  async releaseClaim(taskId: string, workerId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (task && task.claimedByWorkerId === workerId && task.status === 'running') {
      this.tasks.set(taskId, {
        ...task,
        status: 'runnable' as TaskState,
        claimedByWorkerId: undefined,
        claimedUntilMs: undefined,
        timestamps: {
          ...task.timestamps,
          updatedAt: new Date().toISOString(),
        },
      });
    }
  }

  async renewLease(taskId: string, workerId: string, extendByMs: number): Promise<void> {
    const task = this.tasks.get(taskId);
    if (task && task.claimedByWorkerId === workerId && task.status === 'running') {
      this.tasks.set(taskId, {
        ...task,
        claimedUntilMs: Date.now() + extendByMs,
        timestamps: {
          ...task.timestamps,
          updatedAt: new Date().toISOString(),
        },
      });
    }
  }

  // Helper for tests: clear state
  clear(): void {
    this.workflows.clear();
    this.tasks.clear();
  }
}
