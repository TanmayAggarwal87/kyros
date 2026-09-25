import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseWorkflowRepository, type ISupabaseDbClient } from '../persistence/supabase-repository';
import type { Task } from '../contracts/task';
import type { Workflow } from '../contracts/workflow';

describe('SupabaseWorkflowRepository & ITaskClaimer', () => {
  // Test mock db client simulating Supabase / Postgres behavior
  function createMockDb(): ISupabaseDbClient {
    const workflows = new Map<string, Record<string, unknown>>();
    const tasks = new Map<string, Record<string, unknown>>();

    return {
      async query(sql: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
        if (sql.includes('SELECT * FROM kyros_workflows WHERE id = $1')) {
          const row = workflows.get(params[0] as string);
          return row ? [row] : [];
        }
        if (sql.includes('INSERT INTO kyros_workflows') || sql.includes('ON CONFLICT (id) DO UPDATE')) {
          workflows.set(params[0] as string, {
            id: params[0],
            run_id: params[1],
            user_id: params[2],
            prompt: params[3],
            status: params[4],
            field_schema: params[5],
            budget_limit_usd: params[6],
            max_per_task_cost_usd: params[7],
            allow_paid_sources: params[8],
            summary: params[9],
            failure_info: params[10],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          return [];
        }
        if (sql.includes('UPDATE kyros_workflows SET status = $2')) {
          const row = workflows.get(params[0] as string);
          if (row) {
            row.status = params[1];
            row.failure_info = params[2];
            row.updated_at = new Date().toISOString();
          }
          return [];
        }
        if (sql.includes('SELECT * FROM kyros_tasks WHERE workflow_id = $1')) {
          return Array.from(tasks.values()).filter((t) => t.workflow_id === params[0]);
        }
        if (sql.includes('SELECT * FROM kyros_tasks WHERE id = $1')) {
          const row = tasks.get(params[0] as string);
          return row ? [row] : [];
        }
        if (sql.includes('INSERT INTO kyros_tasks') || sql.includes('ON CONFLICT (workflow_id, id) DO UPDATE')) {
          tasks.set(params[1] as string, {
            id: params[1],
            workflow_id: params[0],
            run_id: params[2],
            name: params[3],
            type: params[4],
            status: params[5],
            dependencies: params[6],
            dependency_policy: params[7],
            input: params[8],
            output_artifacts: params[9],
            attempt_counts: params[10],
            failure_info: params[11],
            claimed_by_worker_id: params[12],
            claimed_until_ms: params[13],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          return [];
        }
        if (sql.includes('UPDATE kyros_tasks SET')) {
          const row = tasks.get(params[0] as string);
          if (row) {
            if (sql.includes("status = 'runnable'")) {
              row.status = 'runnable';
              row.claimed_by_worker_id = undefined;
              row.claimed_until_ms = undefined;
            } else if (sql.includes('claimed_until_ms = $3')) {
              row.claimed_until_ms = params[2];
            } else {
              Object.assign(row, params[1] as object);
            }
          }
          return [];
        }
        if (sql.includes('claim_runnable_tasks') || sql.includes('FOR UPDATE SKIP LOCKED')) {
          const workflowId = params[0] as string;
          const workerId = params[1] as string;
          const limit = (params[2] as number) ?? 5;
          const leaseMs = (params[3] as number) ?? 30000;
          const nowMs = Date.now();
          const eligible = Array.from(tasks.values())
            .filter((t) => t.workflow_id === workflowId && t.status === 'runnable')
            .slice(0, limit);
          
          for (const item of eligible) {
            item.status = 'running';
            item.claimed_by_worker_id = workerId;
            item.claimed_until_ms = nowMs + leaseMs;
          }
          return eligible;
        }
        if (sql.includes('findStrandedRunningTasks')) {
          const workflowId = params[0] as string;
          const staleBefore = (params[1] as number) ?? 0;
          return Array.from(tasks.values()).filter(
            (t) => t.workflow_id === workflowId && t.status === 'running' && t.claimed_until_ms && (t.claimed_until_ms as number) < staleBefore
          );
        }
        return [];
      },
    };
  }

  test('saves and retrieves workflow', async () => {
    const db = createMockDb();
    const repo = new SupabaseWorkflowRepository(db);

    const wf: Workflow = {
      id: 'wf-101',
      runId: 'run-101',
      userId: 'user-dev-demo',
      prompt: 'Find tech startups',
      status: 'ready',
      fieldSchema: [],
      budgetPolicy: { maxSpendUsd: 0.05, perCallCeilingUsd: 0.02, allowPaidSources: true, currency: 'USD' },
      timestamps: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };

    await repo.saveWorkflow(wf);
    const retrieved = await repo.getWorkflow('wf-101');
    assert.ok(retrieved);
    assert.equal(retrieved.id, 'wf-101');
    assert.equal(retrieved.prompt, 'Find tech startups');
    assert.equal(retrieved.status, 'ready');
    assert.equal(retrieved.userId, wf.userId);
    assert.deepEqual(retrieved.fieldSchema, wf.fieldSchema);
  });

  test('saves tasks and atomically claims runnable tasks with lease', async () => {
    const db = createMockDb();
    const repo = new SupabaseWorkflowRepository(db);

    const task: Task = {
      id: 'task-1',
      workflowId: 'wf-101',
      runId: 'run-101',
      name: 'Exa discovery',
      type: 'discovery',
      status: 'runnable',
      dependencies: [],
      completionPolicy: 'all_succeeded',
      input: { query: 'AI agents' },
      outputArtifacts: [],
      attemptCounts: { domain: 0, infrastructure: 0 },
      timestamps: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };

    await repo.saveTasks([task]);
    const claimed = await repo.claimRunnableTasks('wf-101', 'worker-A', 5, 30000);

    assert.equal(claimed.length, 1);
    assert.equal(claimed[0].id, 'task-1');
    assert.equal(claimed[0].status, 'running');
    assert.equal(claimed[0].claimedByWorkerId, 'worker-A');
    assert.ok(claimed[0].claimedUntilMs && claimed[0].claimedUntilMs > Date.now());
  });

  test('renews lease and releases claim', async () => {
    const db = createMockDb();
    const repo = new SupabaseWorkflowRepository(db);

    const task: Task = {
      id: 'task-1',
      workflowId: 'wf-101',
      runId: 'run-101',
      name: 'Task 1',
      type: 'discovery',
      status: 'runnable',
      dependencies: [],
      completionPolicy: 'all_succeeded',
      input: {},
      outputArtifacts: [],
      attemptCounts: { domain: 0, infrastructure: 0 },
      timestamps: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
    await repo.saveTasks([task]);
    await repo.claimRunnableTasks('wf-101', 'worker-A', 1, 10000);

    await repo.renewLease('task-1', 'worker-A', 20000);
    let current = await repo.getTask('task-1');
    assert.ok(current?.claimedUntilMs);

    await repo.releaseClaim('task-1', 'worker-A');
    current = await repo.getTask('task-1');
    assert.equal(current?.status, 'runnable');
    assert.equal(current?.claimedByWorkerId, undefined);
  });
});
