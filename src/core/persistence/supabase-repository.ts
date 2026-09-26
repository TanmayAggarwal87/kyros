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
import type { DatasetRecord, FieldEvidence } from '../contracts/dataset';
import type { ITaskClaimer, IWorkflowRepository } from './repository';
import { InMemoryWorkflowRepository } from './in-memory-repository';
import { KyrosError } from '../errors/kyros-error';

export interface ISupabaseDbClient {
  query(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
}

export class PostgrestSupabaseDbClient implements ISupabaseDbClient {
  private readonly baseUrl: string;
  private readonly key: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: { url: string; key: string; fetchImpl?: typeof fetch }) {
    this.baseUrl = new URL(config.url).origin;
    this.key = config.key;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async query(sql: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
    if (sql.includes('SELECT * FROM kyros_workflows WHERE id = $1')) {
      const id = String(params[0]);
      return this.get(`kyros_workflows?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
    }

    if (sql.includes('SELECT * FROM kyros_workflows WHERE user_id = $1')) {
      const userId = String(params[0]);
      return this.get(`kyros_workflows?user_id=eq.${encodeURIComponent(userId)}&select=*&order=created_at.desc&limit=100`);
    }

    if (sql.includes('INSERT INTO kyros_workflows')) {
      const body = {
        id: params[0],
        run_id: params[1],
        user_id: params[2],
        prompt: params[3],
        status: params[4],
        field_schema: typeof params[5] === 'string' ? JSON.parse(params[5]) : params[5],
        budget_limit_usd: params[6],
        max_per_task_cost_usd: params[7],
        allow_paid_sources: params[8],
        summary: params[9],
        failure_info: typeof params[10] === 'string' ? JSON.parse(params[10]) : params[10],
        updated_at: new Date().toISOString(),
      };
      await this.post('kyros_workflows', body, { merge: true });
      return [];
    }

    if (sql.includes('UPDATE kyros_workflows SET status = $2')) {
      const id = String(params[0]);
      const status = params[1];
      const failureInfo = params[2];
      await this.patch(`kyros_workflows?id=eq.${encodeURIComponent(id)}`, {
        status,
        failure_info: typeof failureInfo === 'string' ? JSON.parse(failureInfo) : failureInfo,
        updated_at: new Date().toISOString(),
      });
      return [];
    }

    if (sql.includes('SELECT * FROM kyros_tasks WHERE workflow_id = $1')) {
      const workflowId = String(params[0]);
      let path = `kyros_tasks?workflow_id=eq.${encodeURIComponent(workflowId)}`;
      if (params.length > 1 && params[1]) {
        path += `&run_id=eq.${encodeURIComponent(String(params[1]))}`;
      }
      path += '&select=*&order=created_at.asc';
      return this.get(path);
    }

    if (sql.includes('SELECT * FROM kyros_tasks WHERE id = $1')) {
      const id = String(params[0]);
      return this.get(`kyros_tasks?id=eq.${encodeURIComponent(id)}&select=*&limit=1`);
    }

    if (sql.includes('INSERT INTO kyros_tasks')) {
      const body = {
        workflow_id: params[0],
        id: params[1],
        run_id: params[2],
        name: params[3],
        type: params[4],
        status: params[5],
        dependencies: typeof params[6] === 'string' ? JSON.parse(params[6]) : params[6],
        dependency_policy: params[7],
        input: typeof params[8] === 'string' ? JSON.parse(params[8]) : params[8],
        output_artifacts: typeof params[9] === 'string' ? JSON.parse(params[9]) : params[9],
        attempt_counts: typeof params[10] === 'string' ? JSON.parse(params[10]) : params[10],
        failure_info: typeof params[11] === 'string' ? JSON.parse(params[11]) : params[11],
        claimed_by_worker_id: params[12] ?? null,
        claimed_until_ms: params[13] ?? null,
        updated_at: new Date().toISOString(),
      };
      await this.post('kyros_tasks', body, { merge: true });
      return [];
    }

    if (sql.includes('UPDATE kyros_tasks SET')) {
      const id = String(params[0]);
      if (sql.includes("status = 'runnable'")) {
        const workerId = params[1] as string;
        await this.patch(`kyros_tasks?id=eq.${encodeURIComponent(id)}&claimed_by_worker_id=eq.${encodeURIComponent(workerId)}`, {
          status: 'runnable',
          claimed_by_worker_id: null,
          claimed_until_ms: null,
          updated_at: new Date().toISOString(),
        });
      } else if (sql.includes('claimed_until_ms = $3')) {
        const workerId = params[1] as string;
        const newUntil = params[2] as number;
        await this.patch(`kyros_tasks?id=eq.${encodeURIComponent(id)}&claimed_by_worker_id=eq.${encodeURIComponent(workerId)}`, {
          claimed_until_ms: newUntil,
          updated_at: new Date().toISOString(),
        });
      } else {
        const body: Record<string, unknown> = {
          status: params[1],
          output_artifacts: typeof params[2] === 'string' ? JSON.parse(params[2]) : params[2],
          attempt_counts: typeof params[3] === 'string' ? JSON.parse(params[3]) : params[3],
          failure_info: typeof params[4] === 'string' ? JSON.parse(params[4]) : params[4],
          claimed_by_worker_id: params[5] ?? null,
          claimed_until_ms: params[6] ?? null,
          finished_at: params[7] ?? null,
          updated_at: new Date().toISOString(),
        };
        await this.patch(`kyros_tasks?id=eq.${encodeURIComponent(id)}`, body);
      }
      return [];
    }

    if (sql.includes('claim_runnable_tasks')) {
      const body = {
        p_workflow_id: params[0],
        p_worker_id: params[1],
        p_limit: params[2],
        p_lease_duration_ms: params[3],
      };
      const res = await this.rpc('claim_runnable_tasks', body);
      return Array.isArray(res) ? (res as Record<string, unknown>[]) : [];
    }

    if (sql.includes('findStrandedRunningTasks') || sql.includes("status = 'running' AND claimed_until_ms < $2")) {
      const workflowId = String(params[0]);
      const staleBefore = Number(params[1]);
      return this.get(`kyros_tasks?workflow_id=eq.${encodeURIComponent(workflowId)}&status=eq.running&claimed_until_ms=lt.${staleBefore}&select=*`);
    }

    if (sql.includes('SELECT * FROM kyros_dataset_records WHERE workflow_id = $1')) {
      const workflowId = String(params[0]);
      let path = `kyros_dataset_records?workflow_id=eq.${encodeURIComponent(workflowId)}`;
      if (params.length > 1 && params[1]) {
        path += `&run_id=eq.${encodeURIComponent(String(params[1]))}`;
      }
      path += '&select=*&order=created_at.asc';
      return this.get(path);
    }

    if (sql.includes('INSERT INTO kyros_dataset_records')) {
      const body = {
        id: params[0],
        workflow_id: params[1],
        run_id: params[2],
        data: typeof params[3] === 'string' ? JSON.parse(params[3]) : params[3],
        evidence: typeof params[4] === 'string' ? JSON.parse(params[4]) : params[4],
        updated_at: new Date().toISOString(),
      };
      await this.post('kyros_dataset_records', body, { merge: true });
      return [];
    }

    return [];
  }

  private async get(path: string): Promise<Record<string, unknown>[]> {
    const res = await this.fetchImpl(`${this.baseUrl}/rest/v1/${path}`, {
      method: 'GET',
      headers: {
        apikey: this.key,
        ...(this.key.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${this.key}` }),
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
  }

  private async post(path: string, body: unknown, options?: { merge?: boolean }): Promise<unknown> {
    const res = await this.fetchImpl(`${this.baseUrl}/rest/v1/${path}`, {
      method: 'POST',
      headers: {
        apikey: this.key,
        ...(this.key.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${this.key}` }),
        'Content-Type': 'application/json',
        ...(options?.merge ? { Prefer: 'resolution=merge-duplicates' } : {}),
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return res.json().catch(() => null);
  }

  private async patch(path: string, body: unknown): Promise<unknown> {
    const res = await this.fetchImpl(`${this.baseUrl}/rest/v1/${path}`, {
      method: 'PATCH',
      headers: {
        apikey: this.key,
        ...(this.key.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${this.key}` }),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return res.json().catch(() => null);
  }

  private async rpc(functionName: string, body: unknown): Promise<unknown> {
    const res = await this.fetchImpl(`${this.baseUrl}/rest/v1/rpc/${functionName}`, {
      method: 'POST',
      headers: {
        apikey: this.key,
        ...(this.key.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${this.key}` }),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    return res.json().catch(() => []);
  }
}

export class SupabaseWorkflowRepository implements IWorkflowRepository, ITaskClaimer {
  private readonly db: ISupabaseDbClient;

  constructor(dbClient: ISupabaseDbClient) {
    this.db = dbClient;
  }

  static fromEnvironment(): SupabaseWorkflowRepository {
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new KyrosError({
        category: 'persistence',
        code: 'SUPABASE_UNCONFIGURED',
        safeMessage: 'Supabase repository is not configured',
      });
    }
    const client = new PostgrestSupabaseDbClient({ url, key });
    return new SupabaseWorkflowRepository(client);
  }

  async getWorkflow(id: string): Promise<Workflow | null> {
    const rows = await this.db.query(
      `SELECT * FROM kyros_workflows WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (!rows || rows.length === 0) return null;
    return this.mapWorkflowRow(rows[0]);
  }

  async getWorkflowsByUser(userId: string): Promise<readonly Workflow[]> {
    const rows = await this.db.query(
      `SELECT * FROM kyros_workflows WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return (rows ?? []).map((r) => this.mapWorkflowRow(r));
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
      const combinedArtifacts = [
        ...(task.outputArtifacts ?? []),
        ...(task.outputData ? [{ _isOutputData: true, id: `data-${task.id}`, type: 'output_data', uri: 'data://', data: task.outputData }] : []),
      ];

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
          JSON.stringify(combinedArtifacts),
          JSON.stringify(task.attemptCounts),
          task.failureInfo ? JSON.stringify(task.failureInfo) : null,
          task.claimedByWorkerId ?? null,
          task.claimedUntilMs ?? null,
        ]
      );
    }
  }

  async updateTask(task: Task): Promise<void> {
    const combinedArtifacts = [
      ...(task.outputArtifacts ?? []),
      ...(task.outputData ? [{ _isOutputData: true, id: `data-${task.id}`, type: 'output_data', uri: 'data://', data: task.outputData }] : []),
    ];

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
        JSON.stringify(combinedArtifacts),
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

  async saveDatasetRecords(records: readonly DatasetRecord[]): Promise<void> {
    for (const rec of records) {
      await this.db.query(
        `INSERT INTO kyros_dataset_records (id, workflow_id, run_id, data, evidence, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (id) DO UPDATE SET
           data = EXCLUDED.data,
           evidence = EXCLUDED.evidence,
           updated_at = NOW()`,
        [
          rec.id,
          rec.workflowId,
          rec.runId,
          JSON.stringify(rec.data),
          JSON.stringify(rec.evidence),
        ]
      );
    }
  }

  async getDatasetRecords(workflowId: string, runId?: string): Promise<readonly DatasetRecord[]> {
    let sql = `SELECT * FROM kyros_dataset_records WHERE workflow_id = $1`;
    const params: unknown[] = [workflowId];
    if (runId) {
      sql += ` AND run_id = $2`;
      params.push(runId);
    }
    sql += ` ORDER BY created_at ASC`;
    const rows = await this.db.query(sql, params);
    return (rows ?? []).map((r) => this.mapDatasetRecordRow(r));
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
    let outputData: Record<string, unknown> | undefined = undefined;
    let outputArtifacts: readonly TaskArtifactReference[] = [];

    if (row.output_artifacts) {
      const parsedArtifacts =
        typeof row.output_artifacts === 'string'
          ? JSON.parse(row.output_artifacts)
          : row.output_artifacts;

      if (Array.isArray(parsedArtifacts)) {
        outputArtifacts = parsedArtifacts.filter(
          (a: Record<string, unknown>) => !a?._isOutputData
        ) as readonly TaskArtifactReference[];
        const dataArt = parsedArtifacts.find((a: Record<string, unknown>) => a?._isOutputData);
        if (dataArt && dataArt.data && typeof dataArt.data === 'object') {
          outputData = dataArt.data as Record<string, unknown>;
        }
      }
    }

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
      outputArtifacts,
      outputData,
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

  private mapDatasetRecordRow(row: Record<string, unknown>): DatasetRecord {
    return {
      id: String(row.id),
      workflowId: String(row.workflow_id),
      runId: String(row.run_id),
      data: (typeof row.data === 'string' ? JSON.parse(row.data) : (row.data ?? {})) as Record<string, unknown>,
      evidence: (typeof row.evidence === 'string' ? JSON.parse(row.evidence) : (row.evidence ?? {})) as Record<string, FieldEvidence>,
      createdAt: String(row.created_at ?? new Date().toISOString()),
      updatedAt: String(row.updated_at ?? new Date().toISOString()),
    };
  }
}

let sharedInMemoryRepo: InMemoryWorkflowRepository | null = null;

export function getWorkflowRepository(): IWorkflowRepository & ITaskClaimer {
  try {
    return SupabaseWorkflowRepository.fromEnvironment();
  } catch {
    sharedInMemoryRepo ??= new InMemoryWorkflowRepository();
    return sharedInMemoryRepo;
  }
}

