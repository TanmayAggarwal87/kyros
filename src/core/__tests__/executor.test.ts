import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkflowExecutor } from '../executor/workflow-executor';
import { InMemoryWorkflowRepository } from '../persistence/in-memory-repository';
import { TaskHandlerRegistry, type ITaskHandler, type TaskExecutionContext, type TaskExecutionResult } from '../executor/handler';
import { TaskGraph } from '../dag/task-graph';
import type { Workflow } from '../contracts/workflow';
import type { PlanTask } from '../contracts/planner';
import { KyrosError } from '../errors/kyros-error';

// Helper to create test workflow
function createTestWorkflow(id: string = 'wf-1', runId: string = 'run-1'): Workflow {
  return {
    id,
    runId,
    userId: 'user-1',
    prompt: 'Test research',
    status: 'ready',
    fieldSchema: [],
    budgetPolicy: { maxSpendUsd: 1.0, currency: 'USD', allowPaidSources: false },
    timestamps: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

test('7. Independent task concurrency', async () => {
  const repo = new InMemoryWorkflowRepository();
  const registry = new TaskHandlerRegistry();

  let maxActiveConcurrent = 0;
  let currentActive = 0;

  // Mock handler that tracks concurrent execution
  const slowHandler: ITaskHandler = {
    taskType: 'discovery',
    async execute(): Promise<TaskExecutionResult> {
      currentActive++;
      if (currentActive > maxActiveConcurrent) {
        maxActiveConcurrent = currentActive;
      }
      await new Promise((r) => setTimeout(r, 20));
      currentActive--;
      return { status: 'succeeded' };
    },
  };
  registry.register(slowHandler);

  const wf = createTestWorkflow();
  await repo.saveWorkflow(wf);

  // 3 independent tasks (no dependencies between them)
  const planTasks: PlanTask[] = [
    {
      id: 't-1',
      type: 'discovery',
      name: 'Task 1',
      description: '',
      dependencies: [],
      completionPolicy: 'all_succeeded',
      input: {},
      expectedArtifactTypes: [],
    },
    {
      id: 't-2',
      type: 'discovery',
      name: 'Task 2',
      description: '',
      dependencies: [],
      completionPolicy: 'all_succeeded',
      input: {},
      expectedArtifactTypes: [],
    },
    {
      id: 't-3',
      type: 'discovery',
      name: 'Task 3',
      description: '',
      dependencies: [],
      completionPolicy: 'all_succeeded',
      input: {},
      expectedArtifactTypes: [],
    },
  ];

  const graph = TaskGraph.fromPlanTasks(wf.id, wf.runId, planTasks);
  await repo.saveTasks(graph.getAllTasks());

  const executor = new WorkflowExecutor({
    repository: repo,
    claimer: repo,
    handlerRegistry: registry,
    maxConcurrency: 3,
  });

  const finalStatus = await executor.executeWorkflow(wf.id);

  assert.equal(finalStatus, 'completed');
  // Independent tasks executed concurrently!
  assert(maxActiveConcurrent >= 2, `Expected concurrent execution, got ${maxActiveConcurrent}`);
});

test('8. Failed dependency behavior (skip dependent, independent tasks unaffected)', async () => {
  const repo = new InMemoryWorkflowRepository();
  const registry = new TaskHandlerRegistry();

  // Handler for t-1 that fails
  registry.register({
    taskType: 'discovery',
    async execute(ctx: TaskExecutionContext): Promise<TaskExecutionResult> {
      if (ctx.task.id === 't-fail') {
        return {
          status: 'failed',
          error: new KyrosError({
            category: 'acquisition',
            code: 'SEARCH_FAILED',
            safeMessage: 'Search service failed',
            retryable: false,
          }),
        };
      }
      return { status: 'succeeded' };
    },
  });

  // Handler for extraction
  registry.register({
    taskType: 'extraction',
    async execute(): Promise<TaskExecutionResult> {
      return { status: 'succeeded' };
    },
  });

  const wf = createTestWorkflow();
  await repo.saveWorkflow(wf);

  const planTasks: PlanTask[] = [
    {
      id: 't-fail',
      type: 'discovery',
      name: 'Failing Task',
      description: '',
      dependencies: [],
      completionPolicy: 'all_succeeded',
      input: {},
      expectedArtifactTypes: [],
    },
    {
      id: 't-dependent',
      type: 'extraction',
      name: 'Dependent Task',
      description: '',
      dependencies: ['t-fail'], // Depends on t-fail with all_succeeded
      completionPolicy: 'all_succeeded',
      input: {},
      expectedArtifactTypes: [],
    },
    {
      id: 't-independent',
      type: 'discovery',
      name: 'Independent Task',
      description: '',
      dependencies: [], // Independent!
      completionPolicy: 'all_succeeded',
      input: {},
      expectedArtifactTypes: [],
    },
  ];

  const graph = TaskGraph.fromPlanTasks(wf.id, wf.runId, planTasks);
  await repo.saveTasks(graph.getAllTasks());

  const executor = new WorkflowExecutor({
    repository: repo,
    claimer: repo,
    handlerRegistry: registry,
  });

  const finalStatus = await executor.executeWorkflow(wf.id);

  const tasks = await repo.getTasks(wf.id);
  const failTask = tasks.find((t) => t.id === 't-fail')!;
  const depTask = tasks.find((t) => t.id === 't-dependent')!;
  const indepTask = tasks.find((t) => t.id === 't-independent')!;

  assert.equal(failTask.status, 'failed');
  assert.equal(depTask.status, 'skipped'); // Downstream dependent task skipped
  assert.equal(indepTask.status, 'succeeded'); // Independent task succeeded!
  // 9. Partial workflow completion because independent task succeeded
  assert.equal(finalStatus, 'partially_completed');
});

test('15. Cancellation (aborts running, marks pending cancelled, preserves succeeded)', async () => {
  const repo = new InMemoryWorkflowRepository();
  const registry = new TaskHandlerRegistry();

  let cancelledSignalObserved = false;

  registry.register({
    taskType: 'discovery',
    async execute(ctx: TaskExecutionContext): Promise<TaskExecutionResult> {
      if (ctx.task.id === 't-1') {
        return { status: 'succeeded' };
      }
      if (ctx.task.id === 't-2') {
        // Wait until cancelled
        await new Promise((resolve) => {
          ctx.signal?.addEventListener('abort', () => {
            cancelledSignalObserved = true;
            resolve(null);
          });
        });
        return { status: 'failed' };
      }
      return { status: 'succeeded' };
    },
  });

  const wf = createTestWorkflow();
  await repo.saveWorkflow(wf);

  const planTasks: PlanTask[] = [
    {
      id: 't-1',
      type: 'discovery',
      name: 'Task 1',
      description: '',
      dependencies: [],
      completionPolicy: 'all_succeeded',
      input: {},
      expectedArtifactTypes: [],
    },
    {
      id: 't-2',
      type: 'discovery',
      name: 'Task 2',
      description: '',
      dependencies: ['t-1'],
      completionPolicy: 'all_succeeded',
      input: {},
      expectedArtifactTypes: [],
    },
    {
      id: 't-3',
      type: 'discovery',
      name: 'Task 3',
      description: '',
      dependencies: ['t-2'],
      completionPolicy: 'all_succeeded',
      input: {},
      expectedArtifactTypes: [],
    },
  ];

  const graph = TaskGraph.fromPlanTasks(wf.id, wf.runId, planTasks);
  await repo.saveTasks(graph.getAllTasks());

  const executor = new WorkflowExecutor({
    repository: repo,
    claimer: repo,
    handlerRegistry: registry,
  });

  // Launch workflow in background and trigger cancel after t-1 succeeds
  const runPromise = executor.executeWorkflow(wf.id);

  // Poll until t-2 is running, then cancel
  while (true) {
    const t2 = await repo.getTask('t-2');
    if (t2?.status === 'running') {
      await executor.cancelWorkflow(wf.id);
      break;
    }
    await new Promise((r) => setTimeout(r, 5));
  }

  const result = await runPromise;
  assert.equal(result, 'cancelled');

  const finalTasks = await repo.getTasks(wf.id);
  const t1 = finalTasks.find((t) => t.id === 't-1')!;
  const t2 = finalTasks.find((t) => t.id === 't-2')!;
  const t3 = finalTasks.find((t) => t.id === 't-3')!;

  assert.equal(t1.status, 'succeeded'); // t-1 preserved!
  assert.equal(t2.status, 'cancelled');
  assert.equal(t3.status, 'cancelled');
  assert.equal(cancelledSignalObserved, true);
});

test('16. Pause and resume behavior', async () => {
  const repo = new InMemoryWorkflowRepository();
  const registry = new TaskHandlerRegistry();

  registry.register({
    taskType: 'discovery',
    async execute(): Promise<TaskExecutionResult> {
      await new Promise((r) => setTimeout(r, 30));
      return { status: 'succeeded' };
    },
  });

  const wf = createTestWorkflow();
  await repo.saveWorkflow(wf);

  const planTasks: PlanTask[] = [
    {
      id: 't-1',
      type: 'discovery',
      name: 'Task 1',
      description: '',
      dependencies: [],
      completionPolicy: 'all_succeeded',
      input: {},
      expectedArtifactTypes: [],
    },
    {
      id: 't-2',
      type: 'discovery',
      name: 'Task 2',
      description: '',
      dependencies: ['t-1'],
      completionPolicy: 'all_succeeded',
      input: {},
      expectedArtifactTypes: [],
    },
  ];

  const graph = TaskGraph.fromPlanTasks(wf.id, wf.runId, planTasks);
  await repo.saveTasks(graph.getAllTasks());

  const executor = new WorkflowExecutor({
    repository: repo,
    claimer: repo,
    handlerRegistry: registry,
  });

  // Start execution and pause while t-1 is running
  const execPromise = executor.executeWorkflow(wf.id);

  while (true) {
    const t1 = await repo.getTask('t-1');
    if (t1?.status === 'running') {
      await executor.pauseWorkflow(wf.id);
      break;
    }
    await new Promise((r) => setTimeout(r, 2));
  }

  const statusAfterPause = await execPromise;
  assert.equal(statusAfterPause, 'paused');

  // Verify workflow state in repo is 'paused'
  const pausedWf = await repo.getWorkflow(wf.id);
  assert.equal(pausedWf?.status, 'paused');

  // Resume workflow
  const resumeStatus = await executor.executeWorkflow(wf.id);
  assert.equal(resumeStatus, 'completed');

  const finalTasks = await repo.getTasks(wf.id);
  assert(finalTasks.every((t) => t.status === 'succeeded'));
});

test('17. Idempotent task completion and snapshot progress', async () => {
  const repo = new InMemoryWorkflowRepository();
  const registry = new TaskHandlerRegistry();

  registry.register({
    taskType: 'discovery',
    async execute(): Promise<TaskExecutionResult> {
      return { status: 'succeeded', outputData: { count: 10 } };
    },
  });

  const wf = createTestWorkflow();
  await repo.saveWorkflow(wf);

  const planTasks: PlanTask[] = [
    {
      id: 't-1',
      type: 'discovery',
      name: 'Task 1',
      description: '',
      dependencies: [],
      completionPolicy: 'all_succeeded',
      input: {},
      expectedArtifactTypes: [],
    },
  ];

  const graph = TaskGraph.fromPlanTasks(wf.id, wf.runId, planTasks);
  await repo.saveTasks(graph.getAllTasks());

  const executor = new WorkflowExecutor({
    repository: repo,
    claimer: repo,
    handlerRegistry: registry,
  });

  await executor.executeWorkflow(wf.id);

  const snapshot = await executor.getProgressSnapshot(wf.id);
  assert.equal(snapshot.progressPercent, 100);
  assert.equal(snapshot.totalTasks, 1);
  assert.equal(snapshot.completedTasks, 1);
  assert.equal(snapshot.failedTasks, 0);

  // Calling executeWorkflow again on completed workflow throws state transition error (idempotent / terminal)
  await assert.rejects(
    async () => {
      await executor.executeWorkflow(wf.id);
    },
    (err: unknown) => {
      assert(err instanceof KyrosError);
      assert.equal(err.code, 'INVALID_STATE_TRANSITION');
      return true;
    }
  );
});

test('18. Recovery of interrupted/running tasks', async () => {
  const repo = new InMemoryWorkflowRepository();
  const registry = new TaskHandlerRegistry();

  registry.register({
    taskType: 'discovery',
    async execute(): Promise<TaskExecutionResult> {
      return { status: 'succeeded' };
    },
  });

  const wf = createTestWorkflow();
  await repo.saveWorkflow(wf);

  // Simulate a stranded task from a dead worker whose lease expired in the past
  const strandedTask = {
    id: 't-stranded',
    runId: wf.runId,
    workflowId: wf.id,
    type: 'discovery' as const,
    status: 'running' as const,
    name: 'Stranded Task',
    dependencies: [],
    completionPolicy: 'all_succeeded' as const,
    input: {},
    outputArtifacts: [],
    attemptCounts: { domain: 0, infrastructure: 0 },
    claimedByWorkerId: 'dead-worker-123',
    claimedUntilMs: Date.now() - 5000, // expired 5 seconds ago!
    timestamps: { createdAt: '', updatedAt: '' },
  };

  await repo.saveTasks([strandedTask]);

  const executor = new WorkflowExecutor({
    repository: repo,
    claimer: repo,
    handlerRegistry: registry,
  });

  // Execute workflow - it should automatically recover the stranded task and finish
  const status = await executor.executeWorkflow(wf.id);
  assert.equal(status, 'completed');

  const recoveredTask = await repo.getTask('t-stranded');
  assert.equal(recoveredTask?.status, 'succeeded');
});
