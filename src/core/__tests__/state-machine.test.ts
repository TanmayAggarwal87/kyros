import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkflowStateMachine, TaskStateMachine } from '../state/state-machine';
import { KyrosError } from '../errors/kyros-error';

test('10. Workflow state transitions (valid lifecycle paths)', () => {
  // planning -> ready
  assert.equal(WorkflowStateMachine.canTransition('planning', 'ready'), true);
  // ready -> running
  assert.equal(WorkflowStateMachine.canTransition('ready', 'running'), true);
  // running -> completed
  assert.equal(WorkflowStateMachine.canTransition('running', 'completed'), true);
  // running -> partially_completed
  assert.equal(WorkflowStateMachine.canTransition('running', 'partially_completed'), true);
  // running -> paused -> running
  assert.equal(WorkflowStateMachine.canTransition('running', 'paused'), true);
  assert.equal(WorkflowStateMachine.canTransition('paused', 'running'), true);
  // running -> cancelled
  assert.equal(WorkflowStateMachine.canTransition('running', 'cancelled'), true);
});

test('11. Invalid state transitions rejected', () => {
  // Terminal state cannot transition to anything
  assert.equal(WorkflowStateMachine.canTransition('completed', 'running'), false);
  assert.equal(WorkflowStateMachine.canTransition('failed', 'running'), false);
  assert.equal(WorkflowStateMachine.canTransition('cancelled', 'running'), false);

  // Jump from planning directly to running without ready
  assert.equal(WorkflowStateMachine.canTransition('planning', 'running'), false);

  // assertTransition throws KyrosError with INVALID_STATE_TRANSITION code
  assert.throws(
    () => {
      WorkflowStateMachine.assertTransition('wf-1', 'completed', 'running');
    },
    (err: unknown) => {
      assert(err instanceof KyrosError);
      assert.equal(err.code, 'INVALID_STATE_TRANSITION');
      return true;
    }
  );

  // Task invalid transitions
  assert.equal(TaskStateMachine.canTransition('pending', 'succeeded'), false);
  assert.equal(TaskStateMachine.canTransition('succeeded', 'running'), false);
  assert.equal(TaskStateMachine.canTransition('failed', 'runnable'), false);

  assert.throws(
    () => {
      TaskStateMachine.assertTransition('t-1', 'pending', 'succeeded');
    },
    (err: unknown) => {
      assert(err instanceof KyrosError);
      assert.equal(err.code, 'INVALID_STATE_TRANSITION');
      return true;
    }
  );
});
