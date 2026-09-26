import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TaskHandlerRegistry } from '../executor/handler';
import { registerStandardHandlers } from '../executor/handlers';
import { InMemoryArtifactStore } from '../research/artifacts-store';
import type { IResearchProvider, ResearchResponse } from '../contracts/research';
import type { IWebcmdProvider, WebcmdNavigationResult } from '../contracts/webcmd';
import type { IExtractionService } from '../extraction/gemini-extractor';
import type { Workflow } from '../contracts/workflow';
import type { Task } from '../contracts/task';

describe('Standard Task Handlers Integration', () => {
  const artifactStore = new InMemoryArtifactStore();

  const mockResearchProvider: IResearchProvider = {
    name: 'mock-exa',
    async search(): Promise<ResearchResponse> {
      return {
        query: 'AI companies',
        results: [
          {
            id: 'exa-1',
            url: 'https://acme.ai/about',
            title: 'Acme AI',
            text: 'Acme AI builds autonomous robots.',
          },
        ],
      };
    },
  };

  const mockWebcmdProvider: IWebcmdProvider = {
    name: 'mock-webcmd',
    async navigateAndExtract(): Promise<WebcmdNavigationResult> {
      return {
        url: 'https://browser-app.com',
        title: 'Rendered App',
        markdown: '# Rendered Page',
        statusCode: 200,
        executionTimeMs: 150,
      };
    },
  };

  const mockExtractionService: IExtractionService = {
    async extractFromSources() {
      return {
        records: [
          {
            recordId: 'rec-1',
            sourceId: 'src-1',
            sourceUrl: 'https://acme.ai/about',
            fields: {
              company: { value: 'Acme AI', snippet: 'Acme AI builds', supportState: 'supported' as const },
              website: { value: 'https://acme.ai', snippet: 'https://acme.ai', supportState: 'supported' as const },
            },
          },
        ],
        unextractedSources: [],
      };
    },
  };

  const registry = new TaskHandlerRegistry();
  registerStandardHandlers(registry, {
    discovery: { researchProvider: mockResearchProvider, artifactStore },
    browserNavigation: { webcmdProvider: mockWebcmdProvider, artifactStore },
    extraction: { extractionService: mockExtractionService, artifactStore },
    validation: {},
    deduplication: {},
  });

  const sampleWorkflow: Workflow = {
    id: 'wf-handlers-1',
    runId: 'run-handlers-1',
    userId: 'user-1',
    prompt: 'Research AI companies',
    fieldSchema: [
      { name: 'company', type: 'string', description: 'Company name', required: true },
      { name: 'website', type: 'url', description: 'Website', required: true },
    ],
    budgetPolicy: { maxSpendUsd: 10, currency: 'USD', allowPaidSources: false },
    status: 'running',
    timestamps: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  };

  test('ExaDiscoveryHandler produces source and content artifacts', async () => {
    const handler = registry.get('discovery')!;
    assert.ok(handler);

    const task: Task = {
      id: 'task-disc',
      runId: sampleWorkflow.runId,
      workflowId: sampleWorkflow.id,
      type: 'discovery',
      name: 'Discovery Task',
      status: 'running',
      dependencies: [],
      completionPolicy: 'all_succeeded',
      input: { query: 'AI companies', numResults: 5 },
      outputArtifacts: [],
      attemptCounts: { domain: 0, infrastructure: 0 },
      timestamps: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    };

    const result = await handler.execute({
      task,
      workflow: sampleWorkflow,
      upstreamArtifacts: [],
    });

    assert.equal(result.status, 'succeeded');
    assert.ok(result.outputArtifacts);
    assert.equal(result.outputArtifacts.length, 2); // 1 source + 1 content
    assert.equal(result.outputArtifacts[0].type, 'source');
    assert.equal(result.outputArtifacts[1].type, 'content');
  });

  test('WebcmdNavigationHandler produces navigation artifacts', async () => {
    const handler = registry.get('browser_navigation')!;
    assert.ok(handler);

    const task: Task = {
      id: 'task-nav',
      runId: sampleWorkflow.runId,
      workflowId: sampleWorkflow.id,
      type: 'browser_navigation',
      name: 'Browser Task',
      status: 'running',
      dependencies: [],
      completionPolicy: 'all_succeeded',
      input: { url: 'https://browser-app.com', objective: 'Inspect app' },
      outputArtifacts: [],
      attemptCounts: { domain: 0, infrastructure: 0 },
      timestamps: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    };

    const result = await handler.execute({
      task,
      workflow: sampleWorkflow,
      upstreamArtifacts: [],
    });

    assert.equal(result.status, 'succeeded');
    assert.ok(result.outputArtifacts);
    assert.equal(result.outputArtifacts.length, 2);
  });

  test('GeminiExtractionHandler extracts records from upstream artifacts', async () => {
    const handler = registry.get('extraction')!;
    assert.ok(handler);

    const task: Task = {
      id: 'task-extract',
      runId: sampleWorkflow.runId,
      workflowId: sampleWorkflow.id,
      type: 'extraction',
      name: 'Extraction Task',
      status: 'running',
      dependencies: ['task-disc'],
      completionPolicy: 'all_succeeded',
      input: {},
      outputArtifacts: [],
      attemptCounts: { domain: 0, infrastructure: 0 },
      timestamps: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    };

    const result = await handler.execute({
      task,
      workflow: sampleWorkflow,
      upstreamArtifacts: [],
    });

    assert.equal(result.status, 'succeeded');
    assert.ok(result.outputData);
    assert.equal((result.outputData.records as unknown[]).length, 1);
  });
});
