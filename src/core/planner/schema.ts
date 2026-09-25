import { z } from 'zod';

export const TaskTypeSchema = z.enum([
  'discovery',
  'browser_navigation',
  'extraction',
  'quality_validation',
  'deduplication',
]);

export const DependencyCompletionPolicySchema = z.enum(['all_succeeded', 'allow_partial']);

export const DatasetFieldTypeSchema = z.enum([
  'string',
  'number',
  'boolean',
  'date',
  'url',
  'email',
  'array',
]);

export const DatasetFieldSchemaZod = z.object({
  name: z.string().min(1, 'Field name is required'),
  type: DatasetFieldTypeSchema,
  description: z.string(),
  required: z.boolean(),
});

export const PlanTaskSchemaZod = z.object({
  id: z.string().min(1, 'Task ID is required'),
  type: TaskTypeSchema,
  name: z.string().min(1, 'Task name is required'),
  description: z.string(),
  dependencies: z.array(z.string()).default([]),
  completionPolicy: DependencyCompletionPolicySchema.default('all_succeeded'),
  input: z.record(z.string(), z.unknown()).default({}),
  expectedArtifactTypes: z.array(z.string()).default([]),
  concurrencyGroup: z.string().optional(),
  estimatedCostUsd: z.number().nonnegative().optional(),
});

export const PlannerPlanSchemaZod = z.object({
  summary: z.string().min(1, 'Summary is required'),
  fields: z.array(DatasetFieldSchemaZod).min(1, 'At least one output field must be specified'),
  tasks: z.array(PlanTaskSchemaZod).min(1, 'At least one task must be planned'),
  totalEstimatedCostUsd: z.number().nonnegative().optional(),
});

export const PlannerInputSchemaZod = z.object({
  userRequest: z.string().min(1, 'userRequest cannot be empty'),
  constraints: z.array(z.string()).optional(),
  supportedCapabilities: z.array(TaskTypeSchema).min(1, 'supportedCapabilities cannot be empty'),
  budgetPolicy: z.object({
    maxSpendUsd: z.number().nonnegative(),
    perCallCeilingUsd: z.number().nonnegative().optional(),
    currency: z.literal('USD'),
    allowPaidSources: z.boolean(),
  }),
});
