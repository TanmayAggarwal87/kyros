import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Planner } from '../planner/planner';
import { GeminiGateway, type IGeminiCaller } from '../ai/gateway';
import { WorkflowExecutor } from '../executor/workflow-executor';
import { InMemoryWorkflowRepository } from '../persistence/in-memory-repository';
import { TaskGraph } from '../dag/task-graph';
import { InMemoryArtifactStore } from '../research/artifacts-store';
import { GeminiExtractor } from '../extraction/gemini-extractor';
import { createStandardHandlerRegistry } from '../executor/handlers';
import { generateDatasetCsv } from '../../lib/csv';
import type { IResearchProvider } from '../contracts/research';
import type { Workflow } from '../contracts/workflow';

describe('Kyros End-to-End System Integration Test', () => {
  test('Complete Flow: Prompt -> Plan -> DAG Compilation -> Standard Handlers Execution -> Quality Pipeline -> Repository Persistence -> Export', async () => {
    // 1. Mock Gemini Caller responding to both Planner and GeminiExtractor
    const mockGeminiCaller: IGeminiCaller = {
      async callModel(params) {
        if (params.systemInstruction?.includes('KYROS_PLANNER') || params.prompt.includes('User Research Request')) {
          // Planner prompt response
          return JSON.stringify({
            summary: 'Comprehensive 4-step research plan for AI safety startups',
            fields: [
              { name: 'startup_name', type: 'string', description: 'Name of the startup', required: true },
              { name: 'website_url', type: 'url', description: 'Primary website', required: true },
              { name: 'valuation_usd', type: 'number', description: 'Post-money valuation in USD', required: false },
              { name: 'focus_area', type: 'string', description: 'Safety alignment focus', required: false },
            ],
            tasks: [
              {
                id: 'task-discovery-1',
                type: 'discovery',
                name: 'Search Primary Web Sources',
                description: 'Query Exa for top AI alignment organizations in 2026',
                dependencies: [],
                completionPolicy: 'all_succeeded',
                input: { query: 'AI alignment safety research labs 2026' },
                expectedArtifactTypes: ['source', 'content'],
              },
              {
                id: 'task-extraction-1',
                type: 'extraction',
                name: 'Extract Alignment Lab Records',
                description: 'Extract entities, claims, and citations from sources',
                dependencies: ['task-discovery-1'],
                completionPolicy: 'all_succeeded',
                input: {},
                expectedArtifactTypes: ['record_slice'],
              },
              {
                id: 'task-validation-1',
                type: 'quality_validation',
                name: 'Quality Validation & Schema Normalization',
                description: 'Validate data types and normalize URLs and numbers',
                dependencies: ['task-extraction-1'],
                completionPolicy: 'all_succeeded',
                input: {},
                expectedArtifactTypes: ['record_slice'],
              },
              {
                id: 'task-deduplication-1',
                type: 'deduplication',
                name: 'Dataset Merge & Deduplication',
                description: 'Merge duplicate entities and persist verified records',
                dependencies: ['task-validation-1'],
                completionPolicy: 'all_succeeded',
                input: {},
                expectedArtifactTypes: ['dataset'],
              },
            ],
            totalEstimatedCostUsd: 0.04,
          });
        }

        // Extractor response
        return JSON.stringify({
          records: [
            {
              fields: {
                startup_name: {
                  value: 'Anthropic Labs',
                  snippet: 'Anthropic Labs focuses on constitutional AI alignment and steerability.',
                  supportState: 'supported',
                },
                website_url: {
                  value: 'https://WWW.Anthropic.COM:443/?ref=kyros_test',
                  snippet: 'Official domain is https://anthropic.com',
                  supportState: 'supported',
                },
                valuation_usd: {
                  value: '$18,000,000,000',
                  snippet: 'Latest reported valuation of $18B.',
                  supportState: 'supported',
                },
                focus_area: {
                  value: 'Constitutional AI',
                  snippet: 'pioneers in constitutional AI',
                  supportState: 'supported',
                },
              },
            },
          ],
        });
      },
    };

    const aiGateway = new GeminiGateway({
      caller: mockGeminiCaller,
      retryConfig: { sleeper: { sleep: async () => {} } },
    });

    // 2. Generate Plan
    const planner = new Planner(aiGateway);
    const plan = await planner.generatePlan({
      userRequest: 'Find AI alignment safety research labs with funding in 2026',
      supportedCapabilities: ['discovery', 'extraction', 'quality_validation', 'deduplication'],
      budgetPolicy: { maxSpendUsd: 0.5, currency: 'USD', allowPaidSources: false },
    });

    assert.equal(plan.tasks.length, 4);
    assert.equal(plan.fields.length, 4);

    // 3. Workflow & Tasks Setup in Repository
    const workflowId = 'wf-e2e-integ-1';
    const runId = 'run-e2e-integ-1';
    const userId = 'user-auth-clerk-999';

    const workflow: Workflow = {
      id: workflowId,
      runId,
      userId,
      prompt: 'Find AI alignment safety research labs with funding in 2026',
      summary: plan.summary,
      fieldSchema: plan.fields,
      budgetPolicy: { maxSpendUsd: 0.5, currency: 'USD', allowPaidSources: false },
      status: 'ready',
      timestamps: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    };

    const repository = new InMemoryWorkflowRepository();
    await repository.saveWorkflow(workflow);

    const taskGraph = TaskGraph.fromPlanTasks(workflowId, runId, plan.tasks);
    const tasks = taskGraph.getAllTasks();
    await repository.saveTasks(tasks);

    // 4. Create Standard Handlers using Factory
    const artifactStore = new InMemoryArtifactStore();
    const mockExaProvider: IResearchProvider = {
      name: 'exa',
      async search() {
        return {
          query: 'AI alignment safety research labs 2026',
          results: [
            {
              id: 'res-alignment-1',
              url: 'https://news.ycombinator.com/item?id=alignment2026',
              title: 'AI Alignment Report 2026',
              text: 'Anthropic Labs focuses on constitutional AI alignment and steerability. Official domain is https://anthropic.com. Latest reported valuation of $18B. Pioneers in constitutional AI.',
            },
          ],
        };
      },
    };

    const extractor = new GeminiExtractor(aiGateway);
    const handlerRegistry = createStandardHandlerRegistry({
      researchProvider: mockExaProvider,
      extractionService: extractor,
      artifactStore,
      repository,
    });

    // 5. Execute with WorkflowExecutor
    const executor = new WorkflowExecutor({
      repository,
      claimer: repository,
      handlerRegistry,
      maxConcurrency: 2,
    });

    const finalStatus = await executor.executeWorkflow(workflowId);
    assert.equal(finalStatus, 'completed');

    // 6. Verify Workflow Status and Persistent Dataset Records
    const savedWorkflow = await repository.getWorkflow(workflowId);
    assert.equal(savedWorkflow?.status, 'completed');

    const persistedRecords = await repository.getDatasetRecords(workflowId);
    assert.equal(persistedRecords.length, 1);

    const record = persistedRecords[0];
    assert.equal(record.workflowId, workflowId);
    assert.equal(record.data.startup_name, 'Anthropic Labs');
    assert.equal(record.data.website_url, 'https://www.anthropic.com/'); // Normalized URL
    assert.equal(record.data.valuation_usd, 18000000000); // Normalized Number ($18B -> 18000000000)
    assert.equal(record.data.focus_area, 'Constitutional AI');

    // Verify cell-level provenance
    assert.equal(record.evidence.startup_name.supportState, 'supported');
    assert.equal(record.evidence.startup_name.sourceUrl, 'https://news.ycombinator.com/item?id=alignment2026');
    assert.equal(record.evidence.valuation_usd.supportState, 'supported');
    assert.equal(record.evidence.valuation_usd.value, 18000000000);

    // 7. Verify Data Export Sanitization (CSV & JSON)
    const csvWithEvidence = generateDatasetCsv(persistedRecords, workflow.fieldSchema, {
      includeEvidenceUrls: true,
      includeSupportStates: true,
    });
    assert.ok(csvWithEvidence.includes('startup_name'));
    assert.ok(csvWithEvidence.includes('startup_name__source_url'));
    assert.ok(csvWithEvidence.includes('Anthropic Labs'));
    assert.ok(csvWithEvidence.includes('https://news.ycombinator.com/item?id=alignment2026'));

    const jsonExport = JSON.stringify(persistedRecords, null, 2);
    const parsedJson = JSON.parse(jsonExport);
    assert.equal(parsedJson.length, 1);
    assert.equal(parsedJson[0].data.startup_name, 'Anthropic Labs');

    // 8. Verify Multi-User Isolation in Repository
    const otherUserWorkflows = await repository.getWorkflowsByUser('other-user-999');
    assert.equal(otherUserWorkflows.length, 0);

    const thisUserWorkflows = await repository.getWorkflowsByUser(userId);
    assert.equal(thisUserWorkflows.length, 1);
    assert.equal(thisUserWorkflows[0].id, workflowId);
  });

  test('Partial Failure Handling: Continues unaffected branches and marks workflow truthfully', async () => {
    const workflowId = 'wf-partial-fail';
    const runId = 'run-partial-fail';
    const userId = 'user-test-partial';

    const workflow: Workflow = {
      id: workflowId,
      runId,
      userId,
      prompt: 'Resilient multi-source research',
      fieldSchema: [{ name: 'entity', type: 'string', description: 'entity', required: true }],
      budgetPolicy: { maxSpendUsd: 1.0, currency: 'USD', allowPaidSources: false },
      status: 'ready',
      timestamps: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    };

    const repository = new InMemoryWorkflowRepository();
    await repository.saveWorkflow(workflow);

    // Plan with two parallel discovery tasks: one succeeds, one fails
    const task1 = {
      id: 'task-disc-ok',
      workflowId,
      runId,
      type: 'discovery' as const,
      name: 'Discovery Primary',
      status: 'pending' as const,
      dependencies: [],
      completionPolicy: 'all_succeeded' as const,
      input: { query: 'valid search' },
      outputArtifacts: [],
      attemptCounts: { domain: 0, infrastructure: 0 },
      timestamps: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    };

    const task2 = {
      id: 'task-disc-fail',
      workflowId,
      runId,
      type: 'discovery' as const,
      name: 'Discovery Unreachable Source',
      status: 'pending' as const,
      dependencies: [],
      completionPolicy: 'all_succeeded' as const,
      input: { query: 'failing search' },
      outputArtifacts: [],
      attemptCounts: { domain: 0, infrastructure: 0 },
      timestamps: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    };

    await repository.saveTasks([task1, task2]);

    const artifactStore = new InMemoryArtifactStore();
    const failingResearchProvider: IResearchProvider = {
      name: 'exa',
      async search(params) {
        if (params.query.includes('failing')) {
          const { KyrosError } = await import('../errors/kyros-error');
          throw new KyrosError({
            category: 'provider/rate-limit',
            code: 'EXA_RATE_LIMITED',
            safeMessage: 'Remote Provider Rate Limit (429)',
            retryable: false,
            scope: 'task',
          });
        }
        return {
          query: params.query,
          results: [{ id: 'r-1', url: 'https://example.com/ok', title: 'OK', text: 'Good source' }],
        };
      },
    };

    const handlerRegistry = createStandardHandlerRegistry({
      researchProvider: failingResearchProvider,
      extractionService: { extractFromSources: async () => ({ records: [], unextractedSources: [] }) },
      artifactStore,
      repository,
    });

    const executor = new WorkflowExecutor({
      repository,
      claimer: repository,
      handlerRegistry,
      maxConcurrency: 2,
      domainRetryConfig: { maxDomainAttempts: 1 },
    });

    const status = await executor.executeWorkflow(workflowId);
    // When a task fails, executor truthfully transitions workflow to partially_completed or failed
    assert.ok(status === 'failed' || status === 'partially_completed');

    const updatedTaskOk = await repository.getTask('task-disc-ok');
    const updatedTaskFail = await repository.getTask('task-disc-fail');
    assert.equal(updatedTaskOk?.status, 'succeeded');
    assert.equal(updatedTaskFail?.status, 'failed');
    assert.ok(updatedTaskFail?.failureInfo?.message.includes('Remote Provider Rate Limit'));
  });
});
