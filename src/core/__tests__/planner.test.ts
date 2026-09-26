import test from 'node:test';
import assert from 'node:assert/strict';
import { Planner } from '../planner/planner';
import { GeminiGateway, type IGeminiCaller } from '../ai/gateway';
import { KyrosError } from '../errors/kyros-error';
import type { PlannerInput, PlannerPlan } from '../contracts/planner';

// Mock caller simulating Gemini
class MockGeminiCaller implements IGeminiCaller {
  public mockResponse: string = '';
  public lastParams?: {
    modelId: string;
    temperature: number;
    systemInstruction?: string;
    prompt: string;
  };

  async callModel(params: {
    modelId: string;
    temperature: number;
    maxOutputTokens?: number;
    systemInstruction?: string;
    prompt: string;
  }): Promise<string> {
    this.lastParams = params;
    return this.mockResponse;
  }
}

test('Planner generates valid structured plan from prompt', async () => {
  const caller = new MockGeminiCaller();
  const gateway = new GeminiGateway({ caller });
  const planner = new Planner(gateway);

  const mockPlan: PlannerPlan = {
    summary: 'Research AI startups and funding',
    fields: [
      { name: 'companyName', type: 'string', description: 'Name of startup', required: true },
      { name: 'fundingUsd', type: 'number', description: 'Total funding', required: false },
    ],
    tasks: [
      {
        id: 'discover_startups',
        type: 'discovery',
        name: 'Discover Startups',
        description: 'Search for generative AI startups',
        dependencies: [],
        completionPolicy: 'all_succeeded',
        input: { query: 'Generative AI startups 2026' },
        expectedArtifactTypes: ['source'],
        estimatedCostUsd: 0.01,
      },
      {
        id: 'extract_info',
        type: 'extraction',
        name: 'Extract Startup Details',
        description: 'Extract name and funding from discovered sources',
        dependencies: ['discover_startups'],
        completionPolicy: 'all_succeeded',
        input: {},
        expectedArtifactTypes: ['record_slice'],
        estimatedCostUsd: 0.02,
      },
    ],
    totalEstimatedCostUsd: 0.03,
  };

  caller.mockResponse = JSON.stringify(mockPlan);

  const input: PlannerInput = {
    userRequest: 'Find top AI startups and their funding',
    supportedCapabilities: ['discovery', 'extraction', 'quality_validation'],
    budgetPolicy: {
      maxSpendUsd: 0.1,
      currency: 'USD',
      allowPaidSources: false,
    },
  };

  const plan = await planner.generatePlan(input);

  assert.equal(plan.summary, 'Research AI startups and funding');
  assert.equal(plan.tasks.length, 2);
  assert.equal(plan.fields.length, 2);
  // Verify model routing selected gemini-3.1-flash-lite for planner
  assert.equal(caller.lastParams?.modelId, 'gemini-3.1-flash-lite');
});

test('Planner rejects plans with unsupported capabilities', async () => {
  const caller = new MockGeminiCaller();
  const gateway = new GeminiGateway({ caller });
  const planner = new Planner(gateway);

  const mockPlanWithUnsupportedTask = {
    summary: 'Plan with unsupported task',
    fields: [{ name: 'name', type: 'string', description: 'Name', required: true }],
    tasks: [
      {
        id: 'browser_task',
        type: 'browser_navigation', // NOT in supportedCapabilities below
        name: 'Webcmd navigation',
        description: 'Browse site',
        dependencies: [],
        completionPolicy: 'all_succeeded',
        input: {},
        expectedArtifactTypes: [],
      },
    ],
  };

  caller.mockResponse = JSON.stringify(mockPlanWithUnsupportedTask);

  const input: PlannerInput = {
    userRequest: 'Extract website info',
    supportedCapabilities: ['discovery', 'extraction'], // browser_navigation NOT allowed!
    budgetPolicy: {
      maxSpendUsd: 1.0,
      currency: 'USD',
      allowPaidSources: false,
    },
  };

  await assert.rejects(
    async () => {
      await planner.generatePlan(input);
    },
    (err: unknown) => {
      assert(err instanceof KyrosError);
      assert.equal(err.code, 'UNSUPPORTED_CAPABILITY');
      return true;
    }
  );
});

test('Planner rejects plans that exceed budget limit', async () => {
  const caller = new MockGeminiCaller();
  const gateway = new GeminiGateway({ caller });
  const planner = new Planner(gateway);

  const expensivePlan = {
    summary: 'Expensive research plan',
    fields: [{ name: 'field', type: 'string', description: '', required: true }],
    tasks: [
      {
        id: 'task-1',
        type: 'discovery',
        name: 'Search',
        description: '',
        dependencies: [],
        completionPolicy: 'all_succeeded',
        input: {},
        expectedArtifactTypes: [],
        estimatedCostUsd: 0.5,
      },
    ],
    totalEstimatedCostUsd: 0.5,
  };

  caller.mockResponse = JSON.stringify(expensivePlan);

  const input: PlannerInput = {
    userRequest: 'Query',
    supportedCapabilities: ['discovery'],
    budgetPolicy: {
      maxSpendUsd: 0.1, // Limit is $0.10, but plan costs $0.50!
      currency: 'USD',
      allowPaidSources: false,
    },
  };

  await assert.rejects(
    async () => {
      await planner.generatePlan(input);
    },
    (err: unknown) => {
      assert(err instanceof KyrosError);
      assert.equal(err.code, 'PLAN_EXCEEDS_BUDGET');
      return true;
    }
  );
});
