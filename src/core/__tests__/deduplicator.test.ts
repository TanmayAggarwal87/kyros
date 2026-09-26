import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RecordDeduplicator } from '../quality/deduplicator';
import type { DatasetFieldSchema } from '../contracts/planner';
import type { NormalizedRecord } from '../contracts/quality';

describe('Dataset Record Deduplicator', () => {
  const schema: DatasetFieldSchema[] = [
    { name: 'company_name', type: 'string', description: 'Company name', required: true },
    { name: 'website', type: 'url', description: 'Website', required: true },
    { name: 'funding_usd', type: 'number', description: 'Funding', required: false },
    { name: 'headquarters', type: 'string', description: 'HQ', required: false },
  ];

  const deduplicator = new RecordDeduplicator();
  const context = { workflowId: 'wf-101', runId: 'run-202' };

  test('merges duplicate records matching on canonical website domain and fills missing fields', () => {
    const records: NormalizedRecord[] = [
      {
        recordId: 'rec-1',
        sourceId: 'src-1',
        sourceUrl: 'https://techcrunch.com/article-1',
        data: {
          company_name: 'Anthropic',
          website: 'https://anthropic.com',
          funding_usd: 5000000000,
          headquarters: null, // Missing in primary
        },
        evidence: {
          funding_usd: {
            value: 5000000000,
            supportState: 'supported',
            snippet: 'Anthropic raised $5B',
            sourceUrl: 'https://techcrunch.com/article-1',
            collectedAt: '2026-09-26T00:00:00.000Z',
            acquisitionMethod: 'gemini_extraction',
          },
        },
      },
      {
        recordId: 'rec-2',
        sourceId: 'src-2',
        sourceUrl: 'https://forbes.com/article-2',
        data: {
          company_name: 'Anthropic PBC',
          website: 'https://www.anthropic.com/about',
          funding_usd: null,
          headquarters: 'San Francisco, CA', // Present in secondary
        },
        evidence: {
          headquarters: {
            value: 'San Francisco, CA',
            supportState: 'supported',
            snippet: 'Headquartered in San Francisco, CA',
            sourceUrl: 'https://forbes.com/article-2',
            collectedAt: '2026-09-26T00:00:00.000Z',
            acquisitionMethod: 'gemini_extraction',
          },
        },
      },
    ];

    const result = deduplicator.deduplicate(records, schema, context);

    assert.equal(result.stats.totalInput, 2);
    assert.equal(result.stats.uniqueCount, 1);
    assert.equal(result.stats.duplicatesRemoved, 1);
    assert.equal(result.records.length, 1);

    const merged = result.records[0];
    assert.equal(merged.data.funding_usd, 5000000000);
    assert.equal(merged.data.headquarters, 'San Francisco, CA'); // Filled from secondary
    assert.equal(merged.evidence.headquarters.snippet, 'Headquartered in San Francisco, CA');
    assert.equal(merged.evidence.funding_usd.snippet, 'Anthropic raised $5B');

    assert.equal(result.duplicateDecisions.length, 1);
    assert.equal(result.duplicateDecisions[0].mergedRecordIds.length, 1);
    assert.equal(result.duplicateDecisions[0].mergedRecordIds[0], 'rec-2');
  });

  test('does not merge distinct entities', () => {
    const records: NormalizedRecord[] = [
      {
        recordId: 'rec-1',
        sourceId: 'src-1',
        sourceUrl: 'https://openai.com',
        data: { company_name: 'OpenAI', website: 'https://openai.com' },
        evidence: {},
      },
      {
        recordId: 'rec-2',
        sourceId: 'src-2',
        sourceUrl: 'https://anthropic.com',
        data: { company_name: 'Anthropic', website: 'https://anthropic.com' },
        evidence: {},
      },
    ];

    const result = deduplicator.deduplicate(records, schema, context);
    assert.equal(result.stats.totalInput, 2);
    assert.equal(result.stats.uniqueCount, 2);
    assert.equal(result.stats.duplicatesRemoved, 0);
    assert.equal(result.records.length, 2);
  });
});
