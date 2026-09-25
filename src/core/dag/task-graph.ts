import { PlanTaskSchemaZod } from '../planner/schema';
import type { PlanTask } from '../contracts/planner';
import type { Task, TaskState } from '../contracts/task';
import { CycleDetector } from './cycle-detector';

export class TaskGraph {
  private readonly tasks: Map<string, Task>;
  private readonly dependentsMap: Map<string, string[]>;

  constructor(tasks: readonly Task[]) {
    // Validate DAG structure: checks duplicate IDs, dangling dependencies, cycles
    CycleDetector.validate(
      tasks.map((t) => ({
        id: t.id,
        dependencies: t.dependencies,
      }))
    );

    this.tasks = new Map(tasks.map((t) => [t.id, t]));
    this.dependentsMap = new Map();

    for (const task of tasks) {
      this.dependentsMap.set(task.id, []);
    }

    for (const task of tasks) {
      for (const depId of task.dependencies) {
        this.dependentsMap.get(depId)?.push(task.id);
      }
    }
  }

  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  getAllTasks(): readonly Task[] {
    return Array.from(this.tasks.values());
  }

  getDependencies(taskId: string): readonly Task[] {
    const task = this.tasks.get(taskId);
    if (!task) return [];
    return task.dependencies.map((id) => this.tasks.get(id)!).filter(Boolean);
  }

  getDependents(taskId: string): readonly string[] {
    return this.dependentsMap.get(taskId) ?? [];
  }

  /**
   * Constructs initial Task records from validated planner tasks
   */
  static fromPlanTasks(
    workflowId: string,
    runId: string,
    planTasks: readonly PlanTask[],
    now: string = new Date().toISOString()
  ): TaskGraph {
    const tasks: Task[] = planTasks.map((rawPt) => {
      const pt = PlanTaskSchemaZod.parse(rawPt);
      const initialStatus: TaskState = pt.dependencies.length === 0 ? 'runnable' : 'pending';

      return {
        id: pt.id,
        workflowId,
        runId,
        type: pt.type,
        status: initialStatus,
        name: pt.name,
        description: pt.description,
        dependencies: pt.dependencies,
        completionPolicy: pt.completionPolicy,
        input: pt.input,
        outputArtifacts: [],
        attemptCounts: { domain: 0, infrastructure: 0 },
        timestamps: {
          createdAt: now,
          updatedAt: now,
          scheduledAt: initialStatus === 'runnable' ? now : undefined,
        },
      };
    });

    return new TaskGraph(tasks);
  }
}
