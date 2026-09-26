import { NextResponse, type NextRequest } from 'next/server';
import { getAuthenticatedUserId, authorizeWorkflowAccess } from '@/core/auth/server-auth';
import { getWorkflowRepository } from '@/core/persistence/supabase-repository';
import { WorkflowExecutor } from '@/core/executor/workflow-executor';
import { TaskHandlerRegistry } from '@/core/executor/handler';
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

    const executor = new WorkflowExecutor({
      repository: repo,
      claimer: repo,
      handlerRegistry: new TaskHandlerRegistry(),
    });

    await executor.pauseWorkflow(workflowId);
    const updated = await repo.getWorkflow(workflowId);
    const progress = await executor.getProgressSnapshot(workflowId);

    return NextResponse.json({ workflow: updated, progress });
  } catch (err) {
    const error = KyrosError.fromUnknown(err, 'unexpected/internal', 'workflow');
    return NextResponse.json({ error: error.safeMessage, code: error.code }, { status: 500 });
  }
}
