import type {
  IWorkflowEventObserver,
  WorkflowEvent,
  WorkflowProgressSnapshot,
} from '../contracts/events';
import type { Task, TaskArtifactReference } from '../contracts/task';
import type { Workflow, WorkflowState } from '../contracts/workflow';
import { DependencyResolver } from '../dag/dependency-resolver';
import { KyrosError } from '../errors/kyros-error';
import type { ITaskClaimer, IWorkflowRepository } from '../persistence/repository';
import { DomainRetryPolicy, type DomainRetryConfig } from '../retry/domain-retry';
import { TaskStateMachine, WorkflowStateMachine } from '../state/state-machine';
import { ConcurrencyLimiter } from './concurrency';
import type { TaskExecutionContext, TaskHandlerRegistry } from './handler';

export interface WorkflowExecutorOptions {
  readonly repository: IWorkflowRepository;
  readonly claimer: ITaskClaimer;
  readonly handlerRegistry: TaskHandlerRegistry;
  readonly workerId?: string;
  readonly maxConcurrency?: number;
  readonly leaseDurationMs?: number;
  readonly eventObserver?: IWorkflowEventObserver;
  readonly domainRetryConfig?: Partial<DomainRetryConfig>;
}

export class WorkflowExecutor {
  private readonly repository: IWorkflowRepository;
  private readonly claimer: ITaskClaimer;
  private readonly handlerRegistry: TaskHandlerRegistry;
  private readonly workerId: string;
  private readonly concurrencyLimiter: ConcurrencyLimiter;
  private readonly leaseDurationMs: number;
  private readonly eventObserver?: IWorkflowEventObserver;
  private readonly domainRetryPolicy: DomainRetryPolicy;

  // Active execution state per workflow
  private readonly activeAbortControllers = new Map<string, Map<string, AbortController>>();
  private readonly pausedWorkflows = new Set<string>();

  constructor(options: WorkflowExecutorOptions) {
    this.repository = options.repository;
    this.claimer = options.claimer;
    this.handlerRegistry = options.handlerRegistry;
    this.workerId = options.workerId ?? `worker-${Math.random().toString(36).substring(2, 9)}`;
    this.concurrencyLimiter = new ConcurrencyLimiter(options.maxConcurrency ?? 4);
    this.leaseDurationMs = options.leaseDurationMs ?? 60_000;
    this.eventObserver = options.eventObserver;
    this.domainRetryPolicy = new DomainRetryPolicy(options.domainRetryConfig);
  }

  /**
   * Main execution loop for a workflow.
   * Runs until workflow reaches a terminal state or is paused.
   */
  async executeWorkflow(workflowId: string): Promise<WorkflowState> {
    const workflow = await this.repository.getWorkflow(workflowId);
    if (!workflow) {
      throw new KyrosError({
        category: 'persistence',
        code: 'WORKFLOW_NOT_FOUND',
        safeMessage: `Workflow ${workflowId} not found.`,
        scope: 'workflow',
      });
    }

    // Check if resuming from paused or ready
    if (workflow.status === 'paused') {
      this.pausedWorkflows.delete(workflowId);
      await this.repository.updateWorkflowStatus(workflowId, 'running');
      this.emitEvent('workflow:state_changed', workflowId, workflow.runId, {
        from: 'paused',
        to: 'running',
      });
    } else if (workflow.status === 'ready') {
      await this.repository.updateWorkflowStatus(workflowId, 'running');
      this.emitEvent('workflow:state_changed', workflowId, workflow.runId, {
        from: 'ready',
        to: 'running',
      });
    } else if (workflow.status !== 'running') {
      throw KyrosError.stateTransitionForbidden('workflow', workflow.status, 'running', workflowId);
    }

    if (!this.activeAbortControllers.has(workflowId)) {
      this.activeAbortControllers.set(workflowId, new Map());
    }

    // Recover any stranded running tasks from past crashes
    await this.recoverStrandedTasks(workflowId);

    // Active task tracking promises for concurrency
    const inFlightPromises = new Set<Promise<void>>();

    while (true) {
      // Check if paused
      if (this.pausedWorkflows.has(workflowId)) {
        await Promise.all(inFlightPromises);
        return 'paused';
      }

      // Check current workflow status in case of cancellation
      const currentWf = await this.repository.getWorkflow(workflowId);
      if (!currentWf || currentWf.status === 'cancelled') {
        await Promise.all(inFlightPromises);
        return 'cancelled';
      }

      // 1. Load all current tasks for this workflow
      const allTasks = await this.repository.getTasks(workflowId, currentWf.runId);

      // 2. Evaluate dependencies: advance pending tasks to runnable or skipped
      const { newlyRunnableTaskIds, newlySkippedTaskIds } = DependencyResolver.evaluate(allTasks);

      for (const skippedId of newlySkippedTaskIds) {
        const t = allTasks.find((item) => item.id === skippedId);
        if (t) {
          const updated: Task = {
            ...t,
            status: 'skipped',
            timestamps: { ...t.timestamps, updatedAt: new Date().toISOString() },
          };
          await this.repository.updateTask(updated);
          this.emitEvent('task:state_changed', workflowId, currentWf.runId, {
            taskId: t.id,
            status: 'skipped',
          });
        }
      }

      for (const runnableId of newlyRunnableTaskIds) {
        const t = allTasks.find((item) => item.id === runnableId);
        if (t) {
          const updated: Task = {
            ...t,
            status: 'runnable',
            timestamps: {
              ...t.timestamps,
              updatedAt: new Date().toISOString(),
              scheduledAt: new Date().toISOString(),
            },
          };
          await this.repository.updateTask(updated);
          this.emitEvent('task:state_changed', workflowId, currentWf.runId, {
            taskId: t.id,
            status: 'runnable',
          });
        }
      }

      // 3. Atomically claim available runnable tasks up to available concurrency slots
      const availableSlots = this.concurrencyLimiter.availableSlots;
      if (availableSlots > 0 && !this.pausedWorkflows.has(workflowId)) {
        const claimedTasks = await this.claimer.claimRunnableTasks(
          workflowId,
          this.workerId,
          availableSlots,
          this.leaseDurationMs
        );

        for (const claimed of claimedTasks) {
          const taskPromise = this.concurrencyLimiter.run(async () => {
            await this.executeClaimedTask(currentWf, claimed);
          });

          inFlightPromises.add(taskPromise);
          taskPromise.finally(() => {
            inFlightPromises.delete(taskPromise);
          });
        }
      }

      // If tasks are still executing, wait for at least one to complete
      if (inFlightPromises.size > 0) {
        await Promise.race(Array.from(inFlightPromises));
        continue;
      }

      // If workflow was paused, do not transition to terminal state
      if (this.pausedWorkflows.has(workflowId) || currentWf.status === 'paused') {
        await Promise.all(inFlightPromises);
        return 'paused';
      }

      // 4. Re-check tasks to see if anything is left to run
      const freshTasks = await this.repository.getTasks(workflowId, currentWf.runId);
      const hasRunnableOrPending = freshTasks.some(
        (t) => t.status === 'runnable' || t.status === 'pending'
      );

      if (hasRunnableOrPending && !this.pausedWorkflows.has(workflowId)) {
        // Resolve again in case newly runnable tasks were unlocked
        const res = DependencyResolver.evaluate(freshTasks);
        if (res.newlyRunnableTaskIds.length > 0 || res.newlySkippedTaskIds.length > 0) {
          continue;
        }
      }

      // All tasks are terminal (or no more progress can be made)
      const terminalState = this.computeWorkflowTerminalState(freshTasks);
      await this.repository.updateWorkflowStatus(workflowId, terminalState);
      this.emitEvent('workflow:state_changed', workflowId, currentWf.runId, {
        from: 'running',
        to: terminalState,
      });

      this.activeAbortControllers.delete(workflowId);
      return terminalState;
    }
  }

  /**
   * Executes a single claimed task using the appropriate registered ITaskHandler.
   */
  private async executeClaimedTask(workflow: Workflow, task: Task): Promise<void> {
    const handler = this.handlerRegistry.get(task.type);
    if (!handler) {
      // Unknown handler -> fail task with non-retryable error
      const err = new KyrosError({
        category: 'unexpected/internal',
        code: 'HANDLER_NOT_REGISTERED',
        safeMessage: `No handler registered for task type "${task.type}".`,
        scope: 'task',
      });
      await this.failTask(task, err);
      return;
    }

    // Set up abort controller for cancellation
    const abortController = new AbortController();
    this.activeAbortControllers.get(workflow.id)?.set(task.id, abortController);

    // Collect upstream artifacts
    const upstreamArtifacts: TaskArtifactReference[] = [];
    for (const depId of task.dependencies) {
      const depTask = await this.repository.getTask(depId);
      if (depTask && depTask.outputArtifacts) {
        upstreamArtifacts.push(...depTask.outputArtifacts);
      }
    }

    const context: TaskExecutionContext = {
      task,
      workflow,
      upstreamArtifacts,
      signal: abortController.signal,
    };

    try {
      this.emitEvent('task:state_changed', workflow.id, workflow.runId, {
        taskId: task.id,
        status: 'running',
      });

      const result = await handler.execute(context);

      // If task was already cancelled in repository or signal was aborted, do not update state
      const fresh = await this.repository.getTask(task.id);
      if (fresh?.status === 'cancelled' || abortController.signal.aborted) {
        return;
      }

      if (result.status === 'succeeded') {
        const now = new Date().toISOString();
        const succeededTask: Task = {
          ...task,
          status: 'succeeded',
          outputData: result.outputData,
          outputArtifacts: result.outputArtifacts ?? [],
          timestamps: {
            ...task.timestamps,
            updatedAt: now,
            finishedAt: now,
          },
          claimedByWorkerId: undefined,
          claimedUntilMs: undefined,
        };
        await this.repository.updateTask(succeededTask);
        this.emitEvent('task:state_changed', workflow.id, workflow.runId, {
          taskId: task.id,
          status: 'succeeded',
        });
      } else if (result.status === 'retry_domain') {
        // Domain retry requested by handler
        await this.handleDomainRetry(task, result.refinedInput, result.error);
      } else {
        // Handler returned failed status
        const error =
          result.error ??
          new KyrosError({
            category: 'unexpected/internal',
            code: 'TASK_EXECUTION_FAILED',
            safeMessage: `Task "${task.name}" failed during execution.`,
            scope: 'task',
          });
        await this.handleTaskFailure(task, error);
      }
    } catch (err) {
      const fresh = await this.repository.getTask(task.id);
      if (fresh?.status === 'cancelled' || abortController.signal.aborted) {
        return;
      }
      const error = KyrosError.fromUnknown(err, 'unexpected/internal', 'task');
      await this.handleTaskFailure(task, error);
    } finally {
      this.activeAbortControllers.get(workflow.id)?.delete(task.id);
    }
  }

  private async handleDomainRetry(
    task: Task,
    refinedInput?: Record<string, unknown>,
    error?: KyrosError
  ): Promise<void> {
    const decision = this.domainRetryPolicy.evaluate(task, error?.safeMessage);

    if (decision.shouldRetry) {
      const updated: Task = {
        ...task,
        status: 'runnable',
        input: refinedInput ? { ...task.input, ...refinedInput } : task.input,
        attemptCounts: {
          ...task.attemptCounts,
          domain: decision.nextAttemptNumber,
        },
        failureInfo: error?.toPayload(),
        claimedByWorkerId: undefined,
        claimedUntilMs: undefined,
        timestamps: {
          ...task.timestamps,
          updatedAt: new Date().toISOString(),
          scheduledAt: new Date().toISOString(),
        },
      };

      await this.repository.updateTask(updated);
      this.emitEvent('task:retry_scheduled', task.workflowId, task.runId, {
        taskId: task.id,
        attempt: decision.nextAttemptNumber,
        type: 'domain',
      });
    } else {
      // Domain retry exhausted
      await this.failTask(
        task,
        error ??
          new KyrosError({
            category: 'acquisition',
            code: 'DOMAIN_RETRY_EXHAUSTED',
            safeMessage: `Task "${task.name}" exceeded domain retry limit.`,
            scope: 'task',
          })
      );
    }
  }

  private async handleTaskFailure(task: Task, error: KyrosError): Promise<void> {
    // If error is Gemini busy or provider rate-limit, check infrastructure retry
    if (error.code === 'GEMINI_SERVER_BUSY') {
      await this.failTask(task, error);
      return;
    }

    // Check if domain retry applies (e.g. for acquisition / extraction errors)
    if (error.retryable && (error.category === 'acquisition' || error.category === 'extraction')) {
      await this.handleDomainRetry(task, undefined, error);
      return;
    }

    await this.failTask(task, error);
  }

  private async failTask(task: Task, error: KyrosError): Promise<void> {
    const now = new Date().toISOString();
    const failedTask: Task = {
      ...task,
      status: 'failed',
      failureInfo: error.toPayload(),
      claimedByWorkerId: undefined,
      claimedUntilMs: undefined,
      timestamps: {
        ...task.timestamps,
        updatedAt: now,
        finishedAt: now,
      },
    };

    await this.repository.updateTask(failedTask);
    this.emitEvent('task:state_changed', task.workflowId, task.runId, {
      taskId: task.id,
      status: 'failed',
      error: error.toPayload(),
    });
  }

  /**
   * Deterministically recovers stranded tasks whose lease expired due to a worker crash.
   */
  async recoverStrandedTasks(workflowId: string): Promise<number> {
    const now = Date.now();
    const stranded = await this.repository.findStrandedRunningTasks(workflowId, now);

    for (const task of stranded) {
      const recovered: Task = {
        ...task,
        status: 'runnable',
        claimedByWorkerId: undefined,
        claimedUntilMs: undefined,
        timestamps: {
          ...task.timestamps,
          updatedAt: new Date().toISOString(),
        },
      };
      await this.repository.updateTask(recovered);
      this.emitEvent('task:state_changed', workflowId, task.runId, {
        taskId: task.id,
        status: 'runnable',
        reason: 'recovered_from_crash',
      });
    }

    return stranded.length;
  }

  /**
   * Cancels a running or paused workflow, aborting in-flight tasks and marking pending tasks cancelled.
   */
  async cancelWorkflow(workflowId: string): Promise<void> {
    const workflow = await this.repository.getWorkflow(workflowId);
    if (!workflow) return;

    if (WorkflowStateMachine.isTerminal(workflow.status)) {
      return; // Already terminal
    }

    // 1. Abort any running tasks in this process
    const controllers = this.activeAbortControllers.get(workflowId);
    if (controllers) {
      for (const ctrl of controllers.values()) {
        ctrl.abort();
      }
    }

    // 2. Mark pending and runnable tasks as cancelled
    const tasks = await this.repository.getTasks(workflowId, workflow.runId);
    const now = new Date().toISOString();

    for (const t of tasks) {
      if (t.status === 'pending' || t.status === 'runnable' || t.status === 'running') {
        const cancelledTask: Task = {
          ...t,
          status: 'cancelled',
          claimedByWorkerId: undefined,
          claimedUntilMs: undefined,
          timestamps: {
            ...t.timestamps,
            updatedAt: now,
            finishedAt: now,
          },
        };
        await this.repository.updateTask(cancelledTask);
        this.emitEvent('task:state_changed', workflowId, workflow.runId, {
          taskId: t.id,
          status: 'cancelled',
        });
      }
    }

    // 3. Mark workflow cancelled
    await this.repository.updateWorkflowStatus(workflowId, 'cancelled');
    this.emitEvent('workflow:state_changed', workflowId, workflow.runId, {
      from: workflow.status,
      to: 'cancelled',
    });
  }

  /**
   * Pauses execution of a workflow. In-flight tasks finish cleanly, but no new tasks are claimed.
   */
  async pauseWorkflow(workflowId: string): Promise<void> {
    const workflow = await this.repository.getWorkflow(workflowId);
    if (!workflow || workflow.status !== 'running') {
      return;
    }

    this.pausedWorkflows.add(workflowId);
    await this.repository.updateWorkflowStatus(workflowId, 'paused');
    this.emitEvent('workflow:state_changed', workflowId, workflow.runId, {
      from: 'running',
      to: 'paused',
    });
  }

  /**
   * Computes the deterministic terminal state of a workflow based on its tasks:
   * - completed: all non-skipped tasks succeeded
   * - partially_completed: at least one task succeeded and some failed/skipped
   * - failed: zero tasks succeeded, or critical failures
   */
  private computeWorkflowTerminalState(tasks: readonly Task[]): WorkflowState {
    const succeeded = tasks.filter((t) => t.status === 'succeeded').length;
    const failed = tasks.filter((t) => t.status === 'failed').length;
    const skipped = tasks.filter((t) => t.status === 'skipped').length;
    const cancelled = tasks.filter((t) => t.status === 'cancelled').length;

    if (cancelled > 0 && succeeded === 0) {
      return 'cancelled';
    }

    if (succeeded > 0 && (failed > 0 || skipped > 0)) {
      return 'partially_completed';
    }

    if (succeeded > 0 && failed === 0) {
      return 'completed';
    }

    return 'failed';
  }

  /**
   * Calculates a progress snapshot for Member 1 UI consumption.
   */
  async getProgressSnapshot(workflowId: string): Promise<WorkflowProgressSnapshot> {
    const workflow = await this.repository.getWorkflow(workflowId);
    if (!workflow) {
      throw new KyrosError({
        category: 'persistence',
        code: 'WORKFLOW_NOT_FOUND',
        safeMessage: `Workflow ${workflowId} not found.`,
        scope: 'workflow',
      });
    }

    const tasks = await this.repository.getTasks(workflowId, workflow.runId);
    const total = tasks.length;
    const completed = tasks.filter((t) => TaskStateMachine.isTerminal(t.status)).length;
    const failed = tasks.filter((t) => t.status === 'failed').length;
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

    return {
      workflowId,
      runId: workflow.runId,
      status: workflow.status,
      progressPercent: percent,
      totalTasks: total,
      completedTasks: completed,
      failedTasks: failed,
      failureInfo: workflow.failureInfo,
      updatedAt: new Date().toISOString(),
      tasks: tasks.map((t) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        status: t.status,
        attemptCounts: t.attemptCounts,
        startedAt: t.timestamps.startedAt,
        finishedAt: t.timestamps.finishedAt,
        failureInfo: t.failureInfo,
      })),
    };
  }

  private emitEvent(
    type: WorkflowEvent['type'],
    workflowId: string,
    runId: string,
    payload: Record<string, unknown>
  ): void {
    if (!this.eventObserver) return;
    this.eventObserver.onEvent({
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type,
      workflowId,
      runId,
      timestamp: new Date().toISOString(),
      payload,
    });
  }
}
