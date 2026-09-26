import { NextResponse, type NextRequest } from 'next/server';
import { getAuthenticatedUserId, authorizeWorkflowAccess } from '@/core/auth/server-auth';
import { getWorkflowRepository } from '@/core/persistence/supabase-repository';
import { KyrosError } from '@/core/errors/kyros-error';

export async function GET(
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

    const records = await repo.getDatasetRecords(workflowId, workflow.runId);
    return NextResponse.json({ records });
  } catch (err) {
    const error = KyrosError.fromUnknown(err, 'persistence', 'workflow');
    return NextResponse.json({ error: error.safeMessage, code: error.code }, { status: 500 });
  }
}
