import test from 'node:test';
import assert from 'node:assert/strict';
import { CycleDetector } from '../dag/cycle-detector';
import { TaskGraph } from '../dag/task-graph';
import { KyrosError } from '../errors/kyros-error';
import type { PlanTask } from '../contracts/planner';

test('1. Valid DAG creation', () => {
  const planTasks: PlanTask[] = [
    {
      id: 'task-1',
      type: 'discovery',
      name: 'Discover companies',
      description: 'Search web for target companies',
      dependencies: [],
      completionPolicy: 'all_succeeded',
      input: { query: 'AI startups' },
      expectedArtifactTypes: ['source'],
    },
    {
      id: 'task-2',
      type: 'extraction',
      name: 'Extract funding',
      description: 'Extract funding from sources',
      dependencies: ['task-1'],
      completionPolicy: 'all_succeeded',
      input: {},
      expectedArtifactTypes: ['record_slice'],
    },
  ];

  const graph = TaskGraph.fromPlanTasks('wf-1', 'run-1', planTasks);
  const allTasks = graph.getAllTasks();

  assert.equal(allTasks.length, 2);
  assert.equal(allTasks[0].status, 'runnable'); // Root task runnable
  assert.equal(allTasks[1].status, 'pending'); // Dependent task pending
  assert.equal(graph.getTask('task-1')?.id, 'task-1');
  assert.equal(graph.getDependencies('task-2').length, 1);
  assert.equal(graph.getDependents('task-1')[0], 'task-2');
});

test('2. Invalid task type rejected by schema / plan', () => {
  assert.throws(
    () => {
      // Direct node check or task graph with invalid task definition
      const badTasks = [
        {
          id: 'task-1',
          type: 'invalid_scraped_code' as unknown as PlanTask['type'],
          name: 'Invalid',
          description: '',
          dependencies: [],
          completionPolicy: 'all_succeeded' as const,
          input: {},
          expectedArtifactTypes: [],
        },
      ];
      TaskGraph.fromPlanTasks('wf-1', 'run-1', badTasks);
    },
    // We expect validation error or domain rejection when type is invalid
  );
});

test('3. Duplicate task ID rejected', () => {
  const duplicateTasks = [
    { id: 'dup-id', dependencies: [] },
    { id: 'dup-id', dependencies: [] },
  ];

  assert.throws(
    () => {
      CycleDetector.validate(duplicateTasks);
    },
    (err: unknown) => {
      assert(err instanceof KyrosError);
      assert.equal(err.code, 'DUPLICATE_TASK_ID');
      return true;
    }
  );
});

test('4. Dangling dependency rejected', () => {
  const danglingTasks = [
    { id: 'task-a', dependencies: ['non-existent-task'] },
  ];

  assert.throws(
    () => {
      CycleDetector.validate(danglingTasks);
    },
    (err: unknown) => {
      assert(err instanceof KyrosError);
      assert.equal(err.code, 'DANGLING_DEPENDENCY');
      return true;
    }
  );
});

test('5. Cyclic dependency rejected (simple & multi-hop)', () => {
  // Self dependency
  assert.throws(
    () => {
      CycleDetector.validate([{ id: 'a', dependencies: ['a'] }]);
    },
    (err: unknown) => {
      assert(err instanceof KyrosError);
      assert.equal(err.code, 'SELF_DEPENDENCY');
      return true;
    }
  );

  // 2-node cycle: A -> B -> A
  assert.throws(
    () => {
      CycleDetector.validate([
        { id: 'a', dependencies: ['b'] },
        { id: 'b', dependencies: ['a'] },
      ]);
    },
    (err: unknown) => {
      assert(err instanceof KyrosError);
      assert.equal(err.code, 'CYCLIC_DEPENDENCY');
      return true;
    }
  );

  // 3-node cycle: A -> B -> C -> A
  assert.throws(
    () => {
      CycleDetector.validate([
        { id: 'a', dependencies: ['c'] },
        { id: 'b', dependencies: ['a'] },
        { id: 'c', dependencies: ['b'] },
      ]);
    },
    (err: unknown) => {
      assert(err instanceof KyrosError);
      assert.equal(err.code, 'CYCLIC_DEPENDENCY');
      return true;
    }
  );
});

test('6. Dependency ordering / topological sort', () => {
  const nodes = [
    { id: 'c', dependencies: ['b'] },
    { id: 'a', dependencies: [] },
    { id: 'b', dependencies: ['a'] },
    { id: 'd', dependencies: ['b'] },
  ];

  const order = CycleDetector.getTopologicalSort(nodes);

  // 'a' must be before 'b', 'b' must be before 'c' and 'd'
  assert.equal(order.indexOf('a'), 0);
  assert(order.indexOf('b') > order.indexOf('a'));
  assert(order.indexOf('c') > order.indexOf('b'));
  assert(order.indexOf('d') > order.indexOf('b'));
});
