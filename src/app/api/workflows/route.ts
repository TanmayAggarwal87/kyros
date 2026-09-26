import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUserId } from '@/core/auth/server-auth';
import { Planner } from '@/core/planner/planner';
import { GeminiGateway } from '@/core/ai/gateway';
import { TaskGraph } from '@/core/dag/task-graph';
import { getWorkflowRepository } from '@/core/persistence/supabase-repository';
import type { Workflow } from '@/core/contracts/workflow';
import type { TaskType } from '@/core/contracts/task';
import { KyrosError } from '@/core/errors/kyros-error';

const createWorkflowSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  constraints: z.array(z.string()).optional().default([]),
  maxSpendUsd: z.number().positive().max(10).optional().default(0.05),
  allowPaidSources: z.boolean().optional().default(false),
});

export async function GET() {
  let userId: string;
  try {
    userId = await getAuthenticatedUserId();
  } catch {
    return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 });
  }

  try {
    const repo = getWorkflowRepository();
    const workflows = await repo.getWorkflowsByUser(userId);
    return NextResponse.json({ workflows });
  } catch (err) {
    const error = KyrosError.fromUnknown(err, 'persistence', 'workflow');
    return NextResponse.json({ error: error.safeMessage }, { status: 503 });
  }
}

export async function POST(request: Request) {
  let userId: string;
  try {
    userId = await getAuthenticatedUserId();
  } catch {
    return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = createWorkflowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid parameters', details: parsed.error.issues }, { status: 400 });
  }

  const { prompt, constraints, maxSpendUsd, allowPaidSources } = parsed.data;

  try {
    const supportedCapabilities: TaskType[] = [
      'discovery',
      'extraction',
      'quality_validation',
      'deduplication',
    ];
    if (allowPaidSources) {
      supportedCapabilities.push('browser_navigation');
    }

    const aiGateway = GeminiGateway.fromEnvironment();
    const planner = new Planner(aiGateway);

    const plan = await planner.generatePlan({
      userRequest: prompt,
      constraints,
      supportedCapabilities,
      budgetPolicy: {
        maxSpendUsd,
        perCallCeilingUsd: 0.02,
        allowPaidSources,
        currency: 'USD',
      },
    });

    const workflowId = `wf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const runId = `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    const workflow: Workflow = {
      id: workflowId,
      runId,
      userId,
      prompt,
      status: 'ready',
      summary: plan.summary,
      fieldSchema: plan.fields,
      budgetPolicy: {
        maxSpendUsd,
        perCallCeilingUsd: 0.02,
        allowPaidSources,
        currency: 'USD',
      },
      timestamps: {
        createdAt: now,
        updatedAt: now,
      },
    };

    const taskGraph = TaskGraph.fromPlanTasks(workflowId, runId, plan.tasks);
    const tasks = taskGraph.getAllTasks();

    const repo = getWorkflowRepository();
    await repo.saveWorkflow(workflow);
    await repo.saveTasks(tasks);

    return NextResponse.json({ workflow, plan, tasks });
  } catch (err) {
    console.error('[POST /api/workflows Error]:', err);
    const error = KyrosError.fromUnknown(err, 'planning', 'workflow');
    const status =
      error.category === 'input' || error.category === 'budget' || error.code === 'PLAN_EXCEEDS_BUDGET'
        ? 400
        : error.code === 'GEMINI_API_KEY_MISSING'
        ? 503
        : error.code === 'UNAUTHENTICATED'
        ? 401
        : error.code === 'FORBIDDEN'
        ? 403
        : 500;
    return NextResponse.json({ error: error.safeMessage, code: error.code }, { status });
  }
}
