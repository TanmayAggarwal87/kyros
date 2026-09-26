import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ResearchQualityPipeline } from '../quality/pipeline';
import { InMemoryArtifactStore } from '../research/artifacts-store';
import type { IResearchProvider, ResearchResponse } from '../contracts/research';
import type { IExtractionService } from '../extraction/gemini-extractor';
import type { DatasetFieldSchema } from '../contracts/planner';
import type { ExtractionRequest, ExtractionResult } from '../contracts/extraction';

describe('ResearchQualityPipeline & Partial Failures', () => {
  const fields: DatasetFieldSchema[] = [
    { name: 'company', type: 'string', description: 'Company name', required: true },
    { name: 'website', type: 'url', description: 'Website URL', required: true },
    { name: 'funding_usd', type: 'number', description: 'Funding amount', required: false },
  ];

  test('executes pipeline with partial failures (unusable content + 1 failed extraction) and preserves good records', async () => {
    // Mock Research Provider returning 10 sources
    const mockResearchProvider: IResearchProvider = {
      name: 'mock-exa',
      async search(): Promise<ResearchResponse> {
        return {
          query: 'Top AI startups in 2026',
          results: [
            // 8 usable sources
            ...Array.from({ length: 8 }, (_, i) => ({
              id: `src-item-${i + 1}`,
              url: `https://example-${i + 1}.com/news`,
              title: `Startup ${i + 1} Announcement`,
              text: `Startup ${i + 1} raised $${(i + 1) * 2}M. Visit https://startup${i + 1}.com`,
            })),
            // 1 empty content source (unusable)
            {
              id: 'src-empty',
              url: 'https://empty.com',
              title: 'Empty page',
              text: '', // Empty
            },
            // 1 problematic source
            {
              id: 'src-glitch',
              url: 'https://glitch.com',
              title: 'Glitchy page',
              text: 'Some corrupt data here.',
            },
          ],
        };
      },
    };

    // Mock Extraction Service: extracts from 7 sources successfully, 1 extraction failure, 1 empty was skipped earlier
    const mockExtractionService: IExtractionService = {
      async extractFromSources(req: ExtractionRequest): Promise<ExtractionResult> {
        const records = [];
        const unextracted = [];

        for (const s of req.sources) {
          if (s.url.includes('glitch')) {
            unextracted.push({
              sourceId: s.sourceId,
              reason: 'Malformed model output on this source document.',
            });
          } else {
            const index = s.sourceId.split('-').pop() || '1';
            records.push({
              recordId: `rec-${s.sourceId}`,
              sourceId: s.sourceId,
              sourceUrl: s.url,
              sourceTitle: s.title,
              fields: {
                company: { value: `Startup ${index}`, snippet: `Startup ${index} raised`, supportState: 'supported' as const },
                website: { value: `https://startup${index}.com`, snippet: `https://startup${index}.com`, supportState: 'supported' as const },
                funding_usd: { value: Number(index) * 2000000, snippet: `$${Number(index) * 2}M`, supportState: 'supported' as const },
              },
            });
          }
        }

        return { records, unextractedSources: unextracted };
      },
    };

    const store = new InMemoryArtifactStore();
    const pipeline = new ResearchQualityPipeline({
      researchProvider: mockResearchProvider,
      artifactStore: store,
      extractionService: mockExtractionService,
    });

    const report = await pipeline.runPipeline({
      workflowId: 'wf-partial-1',
      runId: 'run-partial-1',
      taskId: 'task-e2e',
      userObjective: 'Find top AI startups',
      researchRequest: { query: 'Top AI startups in 2026', numResults: 10 },
      fields,
    });

    // Verification of truthful metrics and non-fatal partial success
    assert.equal(report.sourcesReceived, 10);
    assert.equal(report.sourcesRetrieved, 9); // 1 empty skipped
    assert.equal(report.sourcesFailed, 1);
    assert.equal(report.recordsExtracted, 8);
    assert.equal(report.extractionFailures, 1);
    assert.equal(report.recordsValid, 8);
    assert.equal(report.recordsInvalid, 0);
    assert.equal(report.finalRecords.length, 8);
    assert.ok(report.errors.length >= 2); // 1 empty content + 1 extraction failure recorded

    // Check that good records survived with intact evidence
    const firstRecord = report.finalRecords[0];
    assert.equal(firstRecord.data.company, 'Startup 1');
    assert.equal(firstRecord.evidence.company.supportState, 'supported');
    assert.equal(firstRecord.evidence.company.snippet, 'Startup 1 raised');
  });
});
