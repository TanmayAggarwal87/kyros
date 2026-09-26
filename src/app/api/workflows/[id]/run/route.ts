import { NextResponse, type NextRequest } from 'next/server';
import { getAuthenticatedUserId, authorizeWorkflowAccess } from '@/core/auth/server-auth';
import { getWorkflowRepository } from '@/core/persistence/supabase-repository';
import { WorkflowExecutor } from '@/core/executor/workflow-executor';
import { createStandardHandlerRegistry } from '@/core/executor/handlers';
import { SupabaseCreditService } from '@/core/finance/supabase-credit-service';
import { KyrosError } from '@/core/errors/kyros-error';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let userId: string;
  try {
    userId = await getAuthenticatedUserId();
  } catch {
    return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 });
  }

  const { id: workflowId } = await context.params;
  const repo = getWorkflowRepository();

  try {
    const workflow = await repo.getWorkflow(workflowId);
    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    authorizeWorkflowAccess(userId, workflow);

    // 1. Budget reservation
    let creditService: SupabaseCreditService | null = null;
    let budgetReserved = false;
    try {
      creditService = SupabaseCreditService.fromEnvironment();
      await creditService.reserveWorkflowBudget(
        userId,
        workflow.id,
        workflow.runId,
        workflow.budgetPolicy.maxSpendUsd
      );
      budgetReserved = true;
    } catch (creditErr) {
      if (creditErr instanceof KyrosError && creditErr.code === 'INSUFFICIENT_CREDITS') {
        return NextResponse.json({ error: creditErr.safeMessage, code: creditErr.code }, { status: 402 });
      }
      // If credit DB is not configured in local/test mode, proceed without blocking
    }

    // 2. Set up standard handler registry and workflow executor
    const handlerRegistry = createStandardHandlerRegistry({ repository: repo });
    const executor = new WorkflowExecutor({
      repository: repo,
      claimer: repo,
      handlerRegistry,
      maxConcurrency: 4,
    });

    // 3. Execute workflow
    const finalState = await executor.executeWorkflow(workflowId);

    // 4. Budget release on completion (unspent funds refunded)
    if (creditService && budgetReserved) {
      try {
        // Unspent budget is released back to available balance
        const unspent = workflow.budgetPolicy.maxSpendUsd;
        await creditService.releaseWorkflowBudget(userId, workflow.id, workflow.runId, unspent);
      } catch {
        // Non-fatal if release fails
      }
    }

    // 5. Fetch final state, progress snapshot, and dataset records
    const updatedWorkflow = await repo.getWorkflow(workflowId);
    const progress = await executor.getProgressSnapshot(workflowId);
    const records = await repo.getDatasetRecords(workflowId, workflow.runId);

    return NextResponse.json({
      workflow: updatedWorkflow,
      progress,
      records,
      finalState,
    });
  } catch (err) {
    console.error('[POST /api/workflows/[id]/run Error]:', err);
    const error = KyrosError.fromUnknown(err, 'unexpected/internal', 'workflow');
    const status = error.code === 'FORBIDDEN' ? 403 : error.code === 'WORKFLOW_NOT_FOUND' ? 404 : 500;
    return NextResponse.json({ error: error.safeMessage, code: error.code }, { status });
  }
}
