import { KyrosError } from '../errors/kyros-error';

export interface DirectedNode {
  readonly id: string;
  readonly dependencies: readonly string[];
}

export class CycleDetector {
  /**
   * Validates that:
   * 1. There are no duplicate task IDs
   * 2. There are no dangling dependencies (references to non-existent task IDs)
   * 3. There are no self-dependencies
   * 4. There are no cycles in the directed acyclic graph
   */
  static validate(nodes: readonly DirectedNode[]): void {
    const nodeMap = new Map<string, DirectedNode>();

    // 1. Check duplicate IDs
    for (const node of nodes) {
      if (nodeMap.has(node.id)) {
        throw new KyrosError({
          category: 'planning',
          code: 'DUPLICATE_TASK_ID',
          safeMessage: `Plan contains duplicate task ID: "${node.id}".`,
          diagnosticContext: { duplicateId: node.id },
          retryable: false,
          scope: 'workflow',
        });
      }
      nodeMap.set(node.id, node);
    }

    // 2. Check dangling & self dependencies
    for (const node of nodes) {
      for (const depId of node.dependencies) {
        if (depId === node.id) {
          throw new KyrosError({
            category: 'planning',
            code: 'SELF_DEPENDENCY',
            safeMessage: `Task "${node.id}" cannot depend on itself.`,
            diagnosticContext: { taskId: node.id },
            retryable: false,
            scope: 'workflow',
          });
        }
        if (!nodeMap.has(depId)) {
          throw new KyrosError({
            category: 'planning',
            code: 'DANGLING_DEPENDENCY',
            safeMessage: `Task "${node.id}" depends on unknown task ID "${depId}".`,
            diagnosticContext: { taskId: node.id, missingDependencyId: depId },
            retryable: false,
            scope: 'workflow',
          });
        }
      }
    }

    // 3. Cycle detection using 3-color DFS (0: unvisited, 1: visiting, 2: visited)
    const visitedState = new Map<string, 0 | 1 | 2>();
    for (const id of nodeMap.keys()) {
      visitedState.set(id, 0);
    }

    const cyclePath: string[] = [];

    const dfs = (currentId: string): boolean => {
      visitedState.set(currentId, 1); // visiting (grey)
      cyclePath.push(currentId);

      const node = nodeMap.get(currentId)!;
      for (const depId of node.dependencies) {
        const state = visitedState.get(depId);
        if (state === 1) {
          // Found cycle!
          cyclePath.push(depId);
          return true;
        }
        if (state === 0) {
          if (dfs(depId)) {
            return true;
          }
        }
      }

      visitedState.set(currentId, 2); // visited (black)
      cyclePath.pop();
      return false;
    };

    for (const id of nodeMap.keys()) {
      if (visitedState.get(id) === 0) {
        if (dfs(id)) {
          const cycleStr = cyclePath.join(' -> ');
          throw new KyrosError({
            category: 'planning',
            code: 'CYCLIC_DEPENDENCY',
            safeMessage: `Cyclic dependency detected: ${cycleStr}.`,
            diagnosticContext: { cyclePath },
            retryable: false,
            scope: 'workflow',
          });
        }
      }
    }
  }

  /**
   * Returns topological order of node IDs from roots (no dependencies) to leaves.
   */
  static getTopologicalSort(nodes: readonly DirectedNode[]): readonly string[] {
    this.validate(nodes);

    const inDegree = new Map<string, number>();
    const dependents = new Map<string, string[]>();

    for (const node of nodes) {
      inDegree.set(node.id, node.dependencies.length);
      dependents.set(node.id, []);
    }

    for (const node of nodes) {
      for (const dep of node.dependencies) {
        dependents.get(dep)!.push(node.id);
      }
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) {
        queue.push(id);
      }
    }

    const sorted: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);

      for (const next of dependents.get(current)!) {
        const newDeg = inDegree.get(next)! - 1;
        inDegree.set(next, newDeg);
        if (newDeg === 0) {
          queue.push(next);
        }
      }
    }

    return sorted;
  }
}
