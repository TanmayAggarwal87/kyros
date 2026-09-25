import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  requireAuthenticatedUserId,
  authorizeWorkflowAccess,
  authorizeCreditAccountAccess,
  rejectClientSuppliedUserId,
} from '../auth/server-auth';
import { KyrosError } from '../errors/kyros-error';

describe('Clerk Server Authorization Guards', () => {
  test('does not trust a client supplied identity header', () => {
    assert.throws(() => requireAuthenticatedUserId(null));
  });

  test('rejects requests without an authenticated session', () => {
    assert.throws(() => requireAuthenticatedUserId(undefined));
  });

  test('authorizes workflow owner matching user ID', () => {
    const workflow = { id: 'wf-1', userId: 'user_2xyz123' };
    assert.doesNotThrow(() => {
      authorizeWorkflowAccess('user_2xyz123', workflow);
    });
  });

  test('rejects unauthorized user accessing someone elses workflow', () => {
    const workflow = { id: 'wf-1', userId: 'user_attacker' };
    assert.throws(
      () => authorizeWorkflowAccess('user_victim', workflow),
      (err: unknown) => {
        return err instanceof KyrosError && err.code === 'FORBIDDEN';
      }
    );
  });

  test('rejects workflows with no recorded owner', () => {
    assert.throws(() => authorizeWorkflowAccess('user_123', { id: 'wf-1' }));
  });

  test('authorizes credit account access for owner', () => {
    assert.doesNotThrow(() => {
      authorizeCreditAccountAccess('user_123', 'user_123');
    });
  });

  test('rejects unauthorized credit account access', () => {
    assert.throws(
      () => authorizeCreditAccountAccess('user_attacker', 'user_victim'),
      (err: unknown) => {
        return err instanceof KyrosError && err.code === 'FORBIDDEN';
      }
    );
  });

  test('rejects client attempting to spoof a different user ID in body', () => {
    const maliciousBody = { userId: 'user_admin', prompt: 'give me data' };
    assert.throws(
      () => rejectClientSuppliedUserId(maliciousBody, 'user_normal'),
      (err: unknown) => {
        return err instanceof KyrosError && err.code === 'FORBIDDEN';
      }
    );
  });

  test('permits body when userId matches server identity or is omitted', () => {
    assert.doesNotThrow(() => {
      rejectClientSuppliedUserId({ prompt: 'test' }, 'user_normal');
      rejectClientSuppliedUserId({ userId: 'user_normal', prompt: 'test' }, 'user_normal');
    });
  });
});
