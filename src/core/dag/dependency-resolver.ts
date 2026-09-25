import type { Task, TaskState } from '../contracts/task';
import { TaskStateMachine } from '../state/state-machine';

export interface DependencyResolutionResult {
  readonly newlyRunnableTaskIds: readonly string[];
  readonly newlySkippedTaskIds: readonly string[];
}

export class DependencyResolver {
  /**
   * Evaluates all tasks in a workflow and determines which pending tasks
   * should transition to 'runnable' or 'skipped'.
   */
  static evaluate(tasks: readonly Task[]): DependencyResolutionResult {
    const taskMap = new Map<string, Task>(tasks.map((t) => [t.id, t]));
    const newlyRunnable: string[] = [];
    const newlySkipped: string[] = [];

    // Iteratively resolve until no further changes
    let changed = true;
    while (changed) {
      changed = false;

      for (const task of tasks) {
        // Only evaluate tasks currently in 'pending' status
        const currentTask = taskMap.get(task.id)!;
        if (currentTask.status !== 'pending') {
          continue;
        }

        const dependencyTasks = currentTask.dependencies.map((depId) => taskMap.get(depId));
        const allDependenciesTerminal = dependencyTasks.every(
          (dep) => dep && TaskStateMachine.isTerminal(dep.status)
        );

        if (!allDependenciesTerminal) {
          // Waiting on unfinished dependencies
          continue;
        }

        const anyFailedOrSkipped = dependencyTasks.some(
          (dep) => dep && (dep.status === 'failed' || dep.status === 'skipped' || dep.status === 'cancelled')
        );

        if (currentTask.completionPolicy === 'all_succeeded') {
          if (anyFailedOrSkipped) {
            // Cannot satisfy all_succeeded; skip downstream task
            newlySkipped.push(currentTask.id);
            // Update local map to reflect skipped status for subsequent iterations
            taskMap.set(currentTask.id, {
              ...currentTask,
              status: 'skipped' as TaskState,
            });
            changed = true;
          } else {
            // All dependencies succeeded!
            newlyRunnable.push(currentTask.id);
            taskMap.set(currentTask.id, {
              ...currentTask,
              status: 'runnable' as TaskState,
            });
            changed = true;
          }
        } else if (currentTask.completionPolicy === 'allow_partial') {
          const atLeastOneSucceeded = dependencyTasks.some(
            (dep) => dep && dep.status === 'succeeded'
          );

          if (atLeastOneSucceeded) {
            // At least one succeeded, allow partial downstream execution
            newlyRunnable.push(currentTask.id);
            taskMap.set(currentTask.id, {
              ...currentTask,
              status: 'runnable' as TaskState,
            });
            changed = true;
          } else {
            // Every upstream task failed or was skipped; skip this task
            newlySkipped.push(currentTask.id);
            taskMap.set(currentTask.id, {
              ...currentTask,
              status: 'skipped' as TaskState,
            });
            changed = true;
          }
        }
      }
    }

    return {
      newlyRunnableTaskIds: newlyRunnable,
      newlySkippedTaskIds: newlySkipped,
    };
  }

  /**
   * Helper to check if a single task is runnable given the states of its dependencies
   */
  static isTaskRunnable(task: Task, dependencyTasks: readonly Task[]): boolean {
    if (task.status !== 'pending' && task.status !== 'runnable') {
      return false;
    }

    if (task.dependencies.length === 0) {
      return true;
    }

    const allTerminal = dependencyTasks.every((dep) => TaskStateMachine.isTerminal(dep.status));
    if (!allTerminal) return false;

    if (task.completionPolicy === 'all_succeeded') {
      return dependencyTasks.every((dep) => dep.status === 'succeeded');
    }

    if (task.completionPolicy === 'allow_partial') {
      return dependencyTasks.some((dep) => dep.status === 'succeeded');
    }

    return false;
  }
}
