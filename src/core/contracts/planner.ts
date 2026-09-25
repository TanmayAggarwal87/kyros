import type { BudgetPolicy } from './workflow';
import type { DependencyCompletionPolicy, TaskType } from './task';

export type DatasetFieldType = 'string' | 'number' | 'boolean' | 'date' | 'url' | 'email' | 'array';

export interface DatasetFieldSchema {
  readonly name: string;
  readonly type: DatasetFieldType;
  readonly description: string;
  readonly required: boolean;
}

export interface PlanTask {
  readonly id: string;
  readonly type: TaskType;
  readonly name: string;
  readonly description: string;
  readonly dependencies: readonly string[];
  readonly completionPolicy: DependencyCompletionPolicy;
  readonly input: Record<string, unknown>;
  readonly expectedArtifactTypes: readonly string[];
  readonly concurrencyGroup?: string;
  readonly estimatedCostUsd?: number;
}

export interface PlannerPlan {
  readonly summary: string;
  readonly fields: readonly DatasetFieldSchema[];
  readonly tasks: readonly PlanTask[];
  readonly totalEstimatedCostUsd?: number;
}

export interface PlannerInput {
  readonly userRequest: string;
  readonly constraints?: readonly string[];
  readonly supportedCapabilities: readonly TaskType[];
  readonly budgetPolicy: BudgetPolicy;
}

export interface IPlanner {
  generatePlan(input: PlannerInput): Promise<PlannerPlan>;
}
