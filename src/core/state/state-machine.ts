import type { TaskState } from '../contracts/task';
import type { WorkflowState } from '../contracts/workflow';
import { KyrosError } from '../errors/kyros-error';

// Valid transitions for Workflow
const WORKFLOW_TRANSITIONS: Readonly<Record<WorkflowState, readonly WorkflowState[]>> = {
  planning: ['ready', 'failed'],
  ready: ['running', 'cancelled'],
  running: ['completed', 'partially_completed', 'failed', 'paused', 'cancelled'],
  paused: ['running', 'cancelled'],
  completed: [],
  partially_completed: [],
  failed: [],
  cancelled: [],
};

// Valid transitions for Task
const TASK_TRANSITIONS: Readonly<Record<TaskState, readonly TaskState[]>> = {
  pending: ['runnable', 'skipped', 'cancelled'],
  runnable: ['running', 'cancelled'],
  running: ['succeeded', 'failed', 'runnable', 'cancelled'],
  succeeded: [],
  failed: [],
  skipped: [],
  cancelled: [],
};

export class WorkflowStateMachine {
  static canTransition(from: WorkflowState, to: WorkflowState): boolean {
    const allowed = WORKFLOW_TRANSITIONS[from];
    return allowed ? allowed.includes(to) : false;
  }

  static assertTransition(workflowId: string, from: WorkflowState, to: WorkflowState): void {
    if (!this.canTransition(from, to)) {
      throw KyrosError.stateTransitionForbidden('workflow', from, to, workflowId);
    }
  }

  static isTerminal(state: WorkflowState): boolean {
    return ['completed', 'partially_completed', 'failed', 'cancelled'].includes(state);
  }
}

export class TaskStateMachine {
  static canTransition(from: TaskState, to: TaskState): boolean {
    const allowed = TASK_TRANSITIONS[from];
    return allowed ? allowed.includes(to) : false;
  }

  static assertTransition(taskId: string, from: TaskState, to: TaskState): void {
    if (!this.canTransition(from, to)) {
      throw KyrosError.stateTransitionForbidden('task', from, to, taskId);
    }
  }

  static isTerminal(state: TaskState): boolean {
    return ['succeeded', 'failed', 'skipped', 'cancelled'].includes(state);
  }
}
