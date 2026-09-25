import type { NormalizedErrorPayload } from '../contracts/errors';
import type {
  Task,
  TaskState,
  TaskType,
  DependencyCompletionPolicy,
  TaskArtifactReference,
  TaskAttemptCounts,
} from '../contracts/task';
import type { Workflow, WorkflowState } from '../contracts/workflow';
import type { DatasetFieldSchema } from '../contracts/planner';
import type { ITaskClaimer, IWorkflowRepository } from './repository';

export interface ISupabaseDbClient {
  query(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
}

export class SupabaseWorkflowRepository implements IWorkflowRepository, ITaskClaimer {
  private readonly db: ISupabaseDbClient;

  constructor(dbClient: ISupabaseDbClient) {
    this.db = dbClient;
  }

  async getWorkflow(id: string): Promise<Workflow | null> {
    const rows = await this.db.query(
      `SELECT * FROM kyros_workflows WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (!rows || rows.length === 0) return null;
    return this.mapWorkflowRow(rows[0]);
  }

  async saveWorkflow(workflow: Workflow): Promise<void> {
    await this.db.query(
      `INSERT INTO kyros_workflows (
        id, run_id, user_id, prompt, status, field_schema, budget_limit_usd, max_per_task_cost_usd,
        allow_paid_sources, summary, failure_info, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      ON CONFLICT (id) DO UPDATE SET
        run_id = EXCLUDED.run_id,
        user_id = EXCLUDED.user_id,
        prompt = EXCLUDED.prompt,
        status = EXCLUDED.status,
        field_schema = EXCLUDED.field_schema,
        budget_limit_usd = EXCLUDED.budget_limit_usd,
        max_per_task_cost_usd = EXCLUDED.max_per_task_cost_usd,
        allow_paid_sources = EXCLUDED.allow_paid_sources,
        summary = EXCLUDED.summary,
        failure_info = EXCLUDED.failure_info,
        updated_at = NOW()`,
      [
        workflow.id,
        workflow.runId,
        workflow.userId,
        workflow.prompt,
        workflow.status,
        JSON.stringify(workflow.fieldSchema),
        workflow.budgetPolicy.maxSpendUsd,
        workflow.budgetPolicy.perCallCeilingUsd ?? 0.02,
        workflow.budgetPolicy.allowPaidSources,
        workflow.summary ?? null,
        workflow.failureInfo ?? null,
      ]
    );
  }

  async updateWorkflowStatus(
    id: string,
    status: WorkflowState,
    failureInfo?: NormalizedErrorPayload
  ): Promise<void> {
    await this.db.query(
      `UPDATE kyros_workflows SET status = $2, failure_info = $3, updated_at = NOW() WHERE id = $1`,
      [id, status, failureInfo ?? null]
    );
  }

  async getTasks(workflowId: string, runId?: string): Promise<readonly Task[]> {
    let sql = `SELECT * FROM kyros_tasks WHERE workflow_id = $1`;
    const params: unknown[] = [workflowId];
    if (runId) {
      sql += ` AND run_id = $2`;
      params.push(runId);
    }
    sql += ` ORDER BY created_at ASC`;
    const rows = await this.db.query(sql, params);
    return (rows ?? []).map((r) => this.mapTaskRow(r));
  }

  async getTask(id: string): Promise<Task | null> {
    const rows = await this.db.query(
      `SELECT * FROM kyros_tasks WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (!rows || rows.length === 0) return null;
    return this.mapTaskRow(rows[0]);
  }

  async saveTasks(tasks: readonly Task[]): Promise<void> {
    for (const task of tasks) {
      await this.db.query(
        `INSERT INTO kyros_tasks (
          workflow_id, id, run_id, name, type, status, dependencies,
          dependency_policy, input, output_artifacts, attempt_counts,
          failure_info, claimed_by_worker_id, claimed_until_ms, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
        ON CONFLICT (workflow_id, id) DO UPDATE SET
          name = EXCLUDED.name,
          type = EXCLUDED.type,
          status = EXCLUDED.status,
          dependencies = EXCLUDED.dependencies,
          dependency_policy = EXCLUDED.dependency_policy,
          input = EXCLUDED.input,
          output_artifacts = EXCLUDED.output_artifacts,
          attempt_counts = EXCLUDED.attempt_counts,
          failure_info = EXCLUDED.failure_info,
          claimed_by_worker_id = EXCLUDED.claimed_by_worker_id,
          claimed_until_ms = EXCLUDED.claimed_until_ms,
          updated_at = NOW()`,
        [
          task.workflowId,
          task.id,
          task.runId,
          task.name,
          task.type,
          task.status,
          JSON.stringify(task.dependencies),
          task.completionPolicy,
          JSON.stringify(task.input),
          JSON.stringify(task.outputArtifacts ?? []),
          JSON.stringify(task.attemptCounts),
          task.failureInfo ? JSON.stringify(task.failureInfo) : null,
          task.claimedByWorkerId ?? null,
          task.claimedUntilMs ?? null,
        ]
      );
    }
  }

  async updateTask(task: Task): Promise<void> {
    await this.db.query(
      `UPDATE kyros_tasks SET
        status = $2,
        output_artifacts = $3,
        attempt_counts = $4,
        failure_info = $5,
        claimed_by_worker_id = $6,
        claimed_until_ms = $7,
        finished_at = $8,
        updated_at = NOW()
      WHERE id = $1`,
      [
        task.id,
        task.status,
        JSON.stringify(task.outputArtifacts ?? []),
        JSON.stringify(task.attemptCounts),
        task.failureInfo ? JSON.stringify(task.failureInfo) : null,
        task.claimedByWorkerId ?? null,
        task.claimedUntilMs ?? null,
        task.timestamps?.finishedAt ?? null,
      ]
    );
  }

  async claimRunnableTasks(
    workflowId: string,
    workerId: string,
    limit: number,
    leaseDurationMs: number
  ): Promise<readonly Task[]> {
    const rows = await this.db.query(
      `SELECT * FROM claim_runnable_tasks($1, $2, $3, $4)`,
      [workflowId, workerId, limit, leaseDurationMs]
    );
    return (rows ?? []).map((r) => this.mapTaskRow(r));
  }

  async releaseClaim(taskId: string, workerId: string): Promise<void> {
    await this.db.query(
      `UPDATE kyros_tasks SET
        status = 'runnable',
        claimed_by_worker_id = NULL,
        claimed_until_ms = NULL,
        updated_at = NOW()
      WHERE id = $1 AND claimed_by_worker_id = $2`,
      [taskId, workerId]
    );
  }

  async renewLease(taskId: string, workerId: string, extendByMs: number): Promise<void> {
    const newExpiresMs = Date.now() + extendByMs;
    await this.db.query(
      `UPDATE kyros_tasks SET
        claimed_until_ms = $3,
        updated_at = NOW()
      WHERE id = $1 AND claimed_by_worker_id = $2`,
      [taskId, workerId, newExpiresMs]
    );
  }

  async findStrandedRunningTasks(workflowId: string, staleBeforeMs: number): Promise<readonly Task[]> {
    const rows = await this.db.query(
      `SELECT * FROM kyros_tasks
       WHERE workflow_id = $1 AND status = 'running' AND claimed_until_ms < $2`,
      [workflowId, staleBeforeMs]
    );
    return (rows ?? []).map((r) => this.mapTaskRow(r));
  }

  private mapWorkflowRow(row: Record<string, unknown>): Workflow {
    return {
      id: String(row.id),
      runId: String(row.run_id),
      userId: String(row.user_id),
      prompt: String(row.prompt),
      status: row.status as WorkflowState,
      fieldSchema: (row.field_schema
        ? typeof row.field_schema === 'string'
          ? JSON.parse(row.field_schema)
          : row.field_schema
        : []) as readonly DatasetFieldSchema[],
      budgetPolicy: {
        maxSpendUsd: Number(row.budget_limit_usd),
        perCallCeilingUsd: Number(row.max_per_task_cost_usd),
        allowPaidSources: Boolean(row.allow_paid_sources),
        currency: 'USD',
      },
      summary: (row.summary as string) ?? undefined,
      failureInfo: row.failure_info
        ? ((typeof row.failure_info === 'string'
            ? JSON.parse(row.failure_info)
            : row.failure_info) as NormalizedErrorPayload)
        : undefined,
      timestamps: {
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      },
    };
  }

  private mapTaskRow(row: Record<string, unknown>): Task {
    return {
      id: String(row.id),
      workflowId: String(row.workflow_id),
      runId: String(row.run_id),
      name: String(row.name),
      type: row.type as TaskType,
      status: row.status as TaskState,
      dependencies: (typeof row.dependencies === 'string'
        ? JSON.parse(row.dependencies)
        : (row.dependencies ?? [])) as readonly string[],
      completionPolicy: (row.dependency_policy ?? 'all_succeeded') as DependencyCompletionPolicy,
      input: (typeof row.input === 'string'
        ? JSON.parse(row.input)
        : (row.input ?? {})) as Record<string, unknown>,
      outputArtifacts: (typeof row.output_artifacts === 'string'
        ? JSON.parse(row.output_artifacts)
        : (row.output_artifacts ?? [])) as readonly TaskArtifactReference[],
      attemptCounts: (typeof row.attempt_counts === 'string'
        ? JSON.parse(row.attempt_counts)
        : (row.attempt_counts ?? { domain: 0, infrastructure: 0 })) as TaskAttemptCounts,
      failureInfo: row.failure_info
        ? ((typeof row.failure_info === 'string'
            ? JSON.parse(row.failure_info)
            : row.failure_info) as NormalizedErrorPayload)
        : undefined,
      claimedByWorkerId: (row.claimed_by_worker_id as string) ?? undefined,
      claimedUntilMs: row.claimed_until_ms ? Number(row.claimed_until_ms) : undefined,
      timestamps: {
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
        startedAt: (row.started_at as string) ?? undefined,
        finishedAt: (row.finished_at as string) ?? undefined,
      },
    };
  }
}
