import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Planner } from '../planner/planner';
import { GeminiGateway, type IGeminiCaller } from '../ai/gateway';
import { WorkflowExecutor } from '../executor/workflow-executor';
import { InMemoryWorkflowRepository } from '../persistence/in-memory-repository';
import { TaskHandlerRegistry } from '../executor/handler';
import { TaskGraph } from '../dag/task-graph';
import { InMemoryArtifactStore } from '../research/artifacts-store';
import { ExaDiscoveryHandler } from '../executor/handlers/exa-discovery-handler';
import { GeminiExtractionHandler } from '../executor/handlers/gemini-extraction-handler';
import type { IResearchProvider } from '../contracts/research';
import type { Workflow } from '../contracts/workflow';
import type { DatasetRecord } from '../contracts/dataset';
import type { ExtractedRecord } from '../contracts/extraction';
import type { NormalizedRecord } from '../contracts/quality';

describe('Phase 1 Thin Slice End-to-End Test', () => {
  test('Prompt -> Gemini plan -> workflow -> Exa research -> extraction -> validation -> deduplication -> dataset records with evidence', async () => {
    // 1. Mock Gemini Caller for Planner and Extractor
    const mockGeminiCaller: IGeminiCaller = {
      async callModel(params) {
        if (params.modelId.includes('pro')) {
          // Planner response
          return JSON.stringify({
            summary: '3-stage research plan for AI robotics startups',
            fields: [
              { name: 'company_name', type: 'string', description: 'Company name', required: true },
              { name: 'website', type: 'url', description: 'Official website', required: true },
              { name: 'funding_usd', type: 'number', description: 'Funding amount in USD', required: false },
              { name: 'headquarters', type: 'string', description: 'HQ location', required: false },
            ],
            tasks: [
              {
                id: 'task_discovery',
                type: 'discovery',
                name: 'Exa Discovery',
                description: 'Search Exa for AI robotics startups in 2026',
                dependencies: [],
                completionPolicy: 'all_succeeded',
                input: { query: 'AI robotics startups funded in 2026', numResults: 5 },
                expectedArtifactTypes: ['source', 'content'],
              },
              {
                id: 'task_extraction',
                type: 'extraction',
                name: 'Structured Extraction',
                description: 'Extract company records with evidence citations',
                dependencies: ['task_discovery'],
                completionPolicy: 'all_succeeded',
                input: {},
                expectedArtifactTypes: ['record_slice'],
              },
              {
                id: 'task_validation',
                type: 'quality_validation',
                name: 'Quality Validation & Normalization',
                description: 'Validate types and normalize URLs and currencies',
                dependencies: ['task_extraction'],
                completionPolicy: 'all_succeeded',
                input: {},
                expectedArtifactTypes: ['record_slice'],
              },
              {
                id: 'task_deduplication',
                type: 'deduplication',
                name: 'Dataset Deduplication',
                description: 'Deduplicate records by canonical domain and name',
                dependencies: ['task_validation'],
                completionPolicy: 'all_succeeded',
                input: {},
                expectedArtifactTypes: ['dataset'],
              },
            ],
            totalEstimatedCostUsd: 0.02,
          });
        }

        // Extractor response
        return JSON.stringify({
          records: [
            {
              fields: {
                company_name: {
                  value: 'Figure AI',
                  snippet: 'Figure AI announces $675M Series B funding round.',
                  supportState: 'supported',
                },
                website: {
                  value: 'https://WWW.Figure.AI:443/?utm_source=news',
                  snippet: 'visit https://figure.ai',
                  supportState: 'supported',
                },
                funding_usd: {
                  value: '$675,000,000',
                  snippet: '$675M Series B funding',
                  supportState: 'supported',
                },
                headquarters: {
                  value: 'Sunnyvale, CA',
                  snippet: 'based in Sunnyvale, CA',
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
      userRequest: 'Find AI robotics startups funded in 2026',
      supportedCapabilities: ['discovery', 'extraction', 'quality_validation', 'deduplication'],
      budgetPolicy: { maxSpendUsd: 1.0, currency: 'USD', allowPaidSources: false },
    });

    assert.equal(plan.tasks.length, 4);
    assert.equal(plan.fields.length, 4);

    // 3. Setup Workflow & Repository
    const workflowId = 'wf-phase1-demo';
    const runId = 'run-phase1-demo';

    const workflow: Workflow = {
      id: workflowId,
      runId,
      userId: 'user-1',
      prompt: 'Find AI robotics startups funded in 2026',
      fieldSchema: plan.fields,
      budgetPolicy: { maxSpendUsd: 1.0, currency: 'USD', allowPaidSources: false },
      status: 'ready',
      timestamps: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    };

    const repository = new InMemoryWorkflowRepository();
    const claimer = repository;
    await repository.saveWorkflow(workflow);

    // Compile Task Graph
    const taskGraph = TaskGraph.fromPlanTasks(workflowId, runId, plan.tasks);
    const tasks = taskGraph.getAllTasks();
    await repository.saveTasks(tasks);

    // 4. Setup Handlers with Mock Exa & Artifact Store
    const artifactStore = new InMemoryArtifactStore();

    const mockExaProvider: IResearchProvider = {
      name: 'exa',
      async search() {
        return {
          query: 'AI robotics startups funded in 2026',
          results: [
            {
              id: 'exa-res-1',
              url: 'https://techcrunch.com/figure-ai-series-b',
              title: 'Figure AI Raises $675M',
              text: 'Figure AI announces $675M Series B funding round. Based in Sunnyvale, CA, the humanoid robotics company is accelerating deployment. Visit https://figure.ai for more information.',
            },
          ],
        };
      },
    };

    const handlerRegistry = new TaskHandlerRegistry();
    handlerRegistry.register(new ExaDiscoveryHandler({ researchProvider: mockExaProvider, artifactStore }));

    // Wire up extraction handler using GeminiExtractor
    const { GeminiExtractor } = await import('../extraction/gemini-extractor');
    const extractor = new GeminiExtractor(aiGateway);
    handlerRegistry.register(new GeminiExtractionHandler({ extractionService: extractor, artifactStore }));

    // Pipeline Quality Validation & Deduplication
    const { SchemaValidator } = await import('../quality/validator');
    const { RecordNormalizer } = await import('../quality/normalizer');
    const { RecordDeduplicator } = await import('../quality/deduplicator');

    const validator = new SchemaValidator();
    const normalizer = new RecordNormalizer();
    const deduplicator = new RecordDeduplicator();

    // In this thin slice, handler for validation and deduplication processes extracted artifacts
    handlerRegistry.register({
      taskType: 'quality_validation',
      async execute(ctx) {
        // Collect extracted records from previous task
        const extractTask = await repository.getTask('task_extraction');
        const extractedRecords = (extractTask?.outputData?.records ?? []) as ExtractedRecord[];

        const validationSummary = validator.validateRecords(extractedRecords, workflow.fieldSchema);
        const normalizedRecords = normalizer.normalizeRecords(validationSummary.validRecords, workflow.fieldSchema);

        return {
          status: 'succeeded',
          outputData: { normalizedRecords, validationSummary },
          outputArtifacts: [
            {
              id: `art-val-${ctx.task.id}`,
              type: 'record_slice',
              uri: `artifact://validated/${ctx.task.id}`,
            },
          ],
        };
      },
    });

    handlerRegistry.register({
      taskType: 'deduplication',
      async execute(ctx) {
        const valTask = await repository.getTask('task_validation');
        const normalizedRecords = (valTask?.outputData?.normalizedRecords ?? []) as NormalizedRecord[];

        const dedupeResult = deduplicator.deduplicate(normalizedRecords, workflow.fieldSchema, {
          workflowId: ctx.workflow.id,
          runId: ctx.workflow.runId,
        });

        return {
          status: 'succeeded',
          outputData: {
            records: dedupeResult.records,
            stats: dedupeResult.stats,
          },
          outputArtifacts: [
            {
              id: `art-dataset-${ctx.workflow.id}`,
              type: 'dataset',
              uri: `artifact://dataset/${ctx.workflow.id}`,
            },
          ],
        };
      },
    });

    // 5. Execute Workflow via WorkflowExecutor
    const executor = new WorkflowExecutor({
      repository,
      claimer,
      handlerRegistry,
      maxConcurrency: 2,
    });

    const finalStatus = await executor.executeWorkflow(workflowId);
    assert.equal(finalStatus, 'completed');

    // 6. Verify Dataset Records & Cell Evidence
    const dedupeTask = await repository.getTask('task_deduplication');
    assert.ok(dedupeTask);
    assert.equal(dedupeTask.status, 'succeeded');

    const finalRecords = dedupeTask.outputData?.records as DatasetRecord[];
    assert.ok(Array.isArray(finalRecords));
    assert.equal(finalRecords.length, 1);

    const record = finalRecords[0];
    // Check normalized data fields
    assert.equal(record.data.company_name, 'Figure AI');
    assert.equal(record.data.website, 'https://www.figure.ai/'); // Normalized from https://WWW.Figure.AI:443/?utm_source=news
    assert.equal(record.data.funding_usd, 675000000); // Normalized from $675,000,000
    assert.equal(record.data.headquarters, 'Sunnyvale, CA');

    // Check cell-level evidence & provenance
    assert.equal(record.evidence.company_name.supportState, 'supported');
    assert.equal(record.evidence.company_name.snippet, 'Figure AI announces $675M Series B funding round.');
    assert.equal(record.evidence.company_name.sourceUrl, 'https://techcrunch.com/figure-ai-series-b');

    assert.equal(record.evidence.funding_usd.supportState, 'supported');
    assert.equal(record.evidence.funding_usd.snippet, '$675M Series B funding');
    assert.equal(record.evidence.funding_usd.value, 675000000);

    assert.equal(record.evidence.headquarters.supportState, 'supported');
    assert.equal(record.evidence.headquarters.snippet, 'based in Sunnyvale, CA');
  });
});
