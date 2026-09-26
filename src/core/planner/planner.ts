import type { IGeminiGateway } from '../ai/gateway';
import type { IPlanner, PlannerInput, PlannerPlan } from '../contracts/planner';
import { CycleDetector } from '../dag/cycle-detector';
import { KyrosError } from '../errors/kyros-error';
import { PlannerInputSchemaZod, PlannerPlanSchemaZod } from './schema';

export class Planner implements IPlanner {
  private readonly aiGateway: IGeminiGateway;

  constructor(aiGateway: IGeminiGateway) {
    this.aiGateway = aiGateway;
  }

  async generatePlan(input: PlannerInput): Promise<PlannerPlan> {
    // 1. Runtime validation of planner input
    const inputValidation = PlannerInputSchemaZod.safeParse(input);
    if (!inputValidation.success) {
      throw KyrosError.invalidInput('Invalid planner input parameters.', {
        issues: inputValidation.error.issues,
      });
    }

    const validatedInput = inputValidation.data;

    // 2. Build system instructions and prompt for Gemini
    const systemInstruction = [
      'You are Kyros Planner, an AI data acquisition and intelligence architect.',
      'Your responsibility is to decompose a research request into a clean, minimal directed acyclic graph (DAG) of executable tasks.',
      `Supported task types are: ${validatedInput.supportedCapabilities.join(', ')}.`,
      'Output a JSON object with this exact structure:',
      '{',
      '  "summary": "Concise 1-sentence summary of the research strategy",',
      '  "fields": [',
      '    { "name": "company_name", "type": "string", "description": "Name of the entity", "required": true },',
      '    { "name": "website_url", "type": "url", "description": "Website URL if mentioned", "required": false }',
      '  ],',
      '  "tasks": [',
      '    {',
      '      "id": "task_discovery_1",',
      `      "type": "${validatedInput.supportedCapabilities[0]}",`,
      '      "name": "Search Primary Sources",',
      '      "description": "...",',
      '      "dependencies": [],',
      '      "completionPolicy": "all_succeeded",',
      '      "input": { "query": "..." },',
      '      "expectedArtifactTypes": ["source", "content"]',
      '    }',
      '  ],',
      `  "totalEstimatedCostUsd": 0.02`,
      '}',
      'Rules:',
      '1. NEVER generate arbitrary executable code, script, or browser automation code.',
      '2. Output ONLY the structured JSON object with all three top-level keys: summary, fields, tasks.',
      '3. Task dependencies must form a strict DAG with no cycles. Each task must have a unique stable ID.',
      '4. Concurrency: Independent tasks that do not depend on each other should have empty dependencies so they execute in parallel.',
      '5. SCHEMA RULES: In fields, only mark the primary identifier (e.g. entity name/title) as "required: true". Mark secondary attributes (website_url, description, funding, etc.) as "required: false" so discovered entities are not discarded if a source mentions the company without its full URL.',
      '6. PIPELINE ORDER: When capabilities include discovery, extraction, quality_validation, and deduplication, connect them in order: discovery (dependencies: []) -> extraction (dependencies: [discoveryId]) -> quality_validation (dependencies: [extractionId]) -> deduplication (dependencies: [qualityValidationId]).',
      `7. Budget limit is $${validatedInput.budgetPolicy.maxSpendUsd} USD. Paid sources allowed: ${validatedInput.budgetPolicy.allowPaidSources}.`,
    ].join('\n');

    const prompt = [
      `User Research Request: "${validatedInput.userRequest}"`,
      validatedInput.constraints && validatedInput.constraints.length > 0
        ? `Constraints: ${JSON.stringify(validatedInput.constraints)}`
        : '',
      `Available Capabilities: ${JSON.stringify(validatedInput.supportedCapabilities)}`,
      `Budget Policy: maxSpendUsd=${validatedInput.budgetPolicy.maxSpendUsd}, allowPaidSources=${validatedInput.budgetPolicy.allowPaidSources}`,
      'Produce the structured plan with summary, fields schema, and task DAG.',
    ]
      .filter(Boolean)
      .join('\n');

    // 3. Request structured JSON from Gemini gateway
    const plan = await this.aiGateway.generateStructuredJson<PlannerPlan>({
      role: 'planner',
      systemInstruction,
      prompt,
      schema: PlannerPlanSchemaZod,
    });

    // 4. Runtime validation of the generated plan against domain rules
    this.validatePlanDomainRules(plan, validatedInput);

    return plan;
  }

  private validatePlanDomainRules(plan: PlannerPlan, input: PlannerInput): void {
    // Rule 1: Check unsupported capabilities
    const supportedSet = new Set(input.supportedCapabilities);
    for (const task of plan.tasks) {
      if (!supportedSet.has(task.type)) {
        throw new KyrosError({
          category: 'planning',
          code: 'UNSUPPORTED_CAPABILITY',
          safeMessage: `Plan produced task "${task.id}" with unsupported capability "${task.type}".`,
          diagnosticContext: {
            taskId: task.id,
            type: task.type,
            supportedCapabilities: input.supportedCapabilities,
          },
          retryable: false,
          scope: 'workflow',
        });
      }
    }

    // Rule 2: Validate DAG structure (duplicate IDs, dangling dependencies, cycles)
    CycleDetector.validate(
      plan.tasks.map((t) => ({
        id: t.id,
        dependencies: t.dependencies,
      }))
    );

    // Rule 3: Validate budget bounds
    if (plan.totalEstimatedCostUsd !== undefined) {
      if (plan.totalEstimatedCostUsd > input.budgetPolicy.maxSpendUsd) {
        throw new KyrosError({
          category: 'budget',
          code: 'PLAN_EXCEEDS_BUDGET',
          safeMessage: `Estimated plan cost ($${plan.totalEstimatedCostUsd}) exceeds maximum allowed budget ($${input.budgetPolicy.maxSpendUsd}).`,
          diagnosticContext: {
            estimatedCost: plan.totalEstimatedCostUsd,
            budgetLimit: input.budgetPolicy.maxSpendUsd,
          },
          retryable: false,
          scope: 'workflow',
        });
      }
    }
  }
}
