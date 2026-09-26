import { z } from 'zod';

export const TaskTypeSchema = z.preprocess((val) => {
  if (typeof val === 'string') {
    const v = val.toLowerCase().trim();
    if (v === 'search' || v === 'research' || v === 'exa') return 'discovery';
    if (v === 'browse' || v === 'browser' || v === 'scrape' || v === 'webcmd') return 'browser_navigation';
    if (v === 'extract' || v === 'extraction') return 'extraction';
    if (v === 'quality' || v === 'validate' || v === 'validation') return 'quality_validation';
    if (v === 'dedup' || v === 'deduplicate' || v === 'deduplication') return 'deduplication';
    return v;
  }
  return val;
}, z.enum([
  'discovery',
  'browser_navigation',
  'extraction',
  'quality_validation',
  'deduplication',
]));

export const DependencyCompletionPolicySchema = z.enum(['all_succeeded', 'allow_partial']);

export const DatasetFieldTypeSchema = z.preprocess((val) => {
  if (typeof val === 'string') {
    const v = val.toLowerCase().trim();
    if (v === 'text' || v === 'str' || v === 'varchar') return 'string';
    if (v === 'int' || v === 'integer' || v === 'float' || v === 'double' || v === 'num' || v === 'number') return 'number';
    if (v === 'bool') return 'boolean';
    if (v === 'datetime' || v === 'time' || v === 'timestamp') return 'date';
    if (v === 'link' || v === 'uri' || v === 'website') return 'url';
    if (v === 'mail') return 'email';
    if (v === 'list') return 'array';
    return v;
  }
  return val;
}, z.enum([
  'string',
  'number',
  'boolean',
  'date',
  'url',
  'email',
  'array',
]));

export const DatasetFieldSchemaZod = z.object({
  name: z.string().min(1, 'Field name is required'),
  type: DatasetFieldTypeSchema.catch('string'),
  description: z.preprocess((val) => (typeof val === 'string' ? val : ''), z.string()).default(''),
  required: z.preprocess((val) => {
    if (typeof val === 'string') {
      return val.toLowerCase() === 'true' || val === '1';
    }
    return Boolean(val);
  }, z.boolean()).default(false),
});

export const PlanTaskSchemaZod = z.object({
  id: z.string().min(1, 'Task ID is required'),
  type: TaskTypeSchema,
  name: z.string().min(1, 'Task name is required'),
  description: z.preprocess((val) => (typeof val === 'string' ? val : ''), z.string()).default(''),
  dependencies: z.preprocess((val) => {
    if (typeof val === 'string') return [val];
    if (Array.isArray(val)) return val.filter((item) => typeof item === 'string');
    return [];
  }, z.array(z.string())).default([]),
  completionPolicy: DependencyCompletionPolicySchema.default('all_succeeded'),
  input: z.preprocess((val) => (val && typeof val === 'object' ? val : {}), z.record(z.string(), z.unknown())).default({}),
  expectedArtifactTypes: z.preprocess((val) => {
    if (typeof val === 'string') return [val];
    if (Array.isArray(val)) return val.filter((item) => typeof item === 'string');
    return [];
  }, z.array(z.string())).default([]),
  concurrencyGroup: z.string().optional(),
  estimatedCostUsd: z.preprocess((val) => {
    if (typeof val === 'string') {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? undefined : parsed;
    }
    return val;
  }, z.number().nonnegative().optional()),
});

export const PlannerPlanSchemaZod = z.preprocess((raw: unknown) => {
  if (raw && typeof raw === 'object') {
    const rawObj = raw as Record<string, unknown>;
    if (rawObj.plan && typeof rawObj.plan === 'object') return rawObj.plan;
    if (rawObj.workflow && typeof rawObj.workflow === 'object') return rawObj.workflow;
    if (rawObj.data && typeof rawObj.data === 'object' && ('tasks' in (rawObj.data as object) || 'fields' in (rawObj.data as object))) return rawObj.data;
    if (rawObj.response && typeof rawObj.response === 'object') return rawObj.response;
    return rawObj;
  }
  return raw;
}, z.object({
  summary: z.preprocess(
    (val) => (typeof val === 'string' && val.trim().length > 0 ? val : 'Research and data acquisition plan'),
    z.string()
  ),
  fields: z.preprocess((val) => {
    if (Array.isArray(val) && val.length > 0) return val;
    return [{ name: 'entity_name', type: 'string', description: 'Primary entity name', required: true }];
  }, z.array(DatasetFieldSchemaZod)),
  tasks: z.array(PlanTaskSchemaZod).min(1, 'At least one task must be planned'),
  totalEstimatedCostUsd: z.preprocess((val) => {
    if (typeof val === 'string') {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? undefined : parsed;
    }
    return val;
  }, z.number().nonnegative().optional()),
}));

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
