import { auth } from '@clerk/nextjs/server';
import { KyrosError } from '../errors/kyros-error';

export function requireAuthenticatedUserId(userId: string | null | undefined): string {
  if (!userId) {
    throw new KyrosError({
      category: 'input', code: 'UNAUTHENTICATED', safeMessage: 'Sign in to continue',
      retryable: false, scope: 'workflow',
    });
  }
  return userId;
}

export async function getAuthenticatedUserId(): Promise<string> {
  const { userId } = await auth();
  return requireAuthenticatedUserId(userId);
}

export function authorizeWorkflowAccess(userId: string, workflow: { readonly id: string; readonly userId?: string }): void {
  if (!workflow.userId || workflow.userId !== userId) {
    throw new KyrosError({ category: 'persistence', code: 'FORBIDDEN', safeMessage: 'Access denied to workflow', retryable: false, scope: 'workflow' });
  }
}

export function authorizeCreditAccountAccess(requestingUserId: string, accountUserId: string): void {
  if (requestingUserId !== accountUserId) {
    throw new KyrosError({ category: 'persistence', code: 'FORBIDDEN', safeMessage: 'Access denied to credit account', retryable: false, scope: 'workflow' });
  }
}

export function rejectClientSuppliedUserId(body: Record<string, unknown>, serverUserId: string): void {
  if ('userId' in body && body.userId !== undefined && body.userId !== null && body.userId !== serverUserId) {
    throw new KyrosError({ category: 'input', code: 'FORBIDDEN', safeMessage: 'Client-supplied user ID does not match server authorization', retryable: false, scope: 'workflow' });
  }
}
