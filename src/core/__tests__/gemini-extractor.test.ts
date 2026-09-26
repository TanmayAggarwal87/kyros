import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { GeminiExtractor } from '../extraction/gemini-extractor';
import { GeminiGateway, type IGeminiCaller } from '../ai/gateway';
import type { DatasetFieldSchema } from '../contracts/planner';

class MockGeminiCaller implements IGeminiCaller {
  public responseText: string = JSON.stringify({
    records: [
      {
        fields: {
          company_name: {
            value: 'Acme Robotics',
            snippet: 'Acme Robotics announces seed round of $5M.',
            supportState: 'supported',
          },
          funding_usd: {
            value: 5000000,
            snippet: 'seed round of $5M',
            supportState: 'supported',
          },
          website: {
            value: 'https://acmerobotics.com',
            snippet: 'visit https://acmerobotics.com',
            supportState: 'supported',
          },
          employee_count: {
            value: null,
            supportState: 'missing',
            rationale: 'Employee count not mentioned in press release',
          },
        },
      },
    ],
  });

  async callModel(): Promise<string> {
    return this.responseText;
  }
}

describe('Gemini Extractor', () => {
  const fields: DatasetFieldSchema[] = [
    { name: 'company_name', type: 'string', description: 'Company name', required: true },
    { name: 'funding_usd', type: 'number', description: 'Total funding in USD', required: false },
    { name: 'website', type: 'url', description: 'Company website', required: false },
    { name: 'employee_count', type: 'number', description: 'Number of employees', required: false },
  ];

  test('extracts structured records with verbatim snippets and support states', async () => {
    const caller = new MockGeminiCaller();
    const gateway = new GeminiGateway({ caller, retryConfig: { sleeper: { sleep: async () => {} } } });
    const extractor = new GeminiExtractor(gateway);

    const result = await extractor.extractFromSources({
      workflowId: 'wf-1',
      runId: 'run-1',
      taskId: 'extract-task-1',
      userObjective: 'Extract robotics startup funding',
      fields,
      sources: [
        {
          sourceId: 'src-1',
          url: 'https://techcrunch.com/acme-seed',
          title: 'Acme Robotics Raises $5M',
          content: 'Acme Robotics announces seed round of $5M. Visit https://acmerobotics.com for details.',
        },
      ],
    });

    assert.equal(result.records.length, 1);
    assert.equal(result.unextractedSources.length, 0);

    const rec = result.records[0];
    assert.equal(rec.sourceId, 'src-1');
    assert.equal(rec.sourceUrl, 'https://techcrunch.com/acme-seed');

    // Field 1: company_name
    assert.equal(rec.fields.company_name.value, 'Acme Robotics');
    assert.equal(rec.fields.company_name.snippet, 'Acme Robotics announces seed round of $5M.');
    assert.equal(rec.fields.company_name.supportState, 'supported');

    // Field 2: funding_usd
    assert.equal(rec.fields.funding_usd.value, 5000000);
    assert.equal(rec.fields.funding_usd.snippet, 'seed round of $5M');
    assert.equal(rec.fields.funding_usd.supportState, 'supported');

    // Field 4: missing employee_count
    assert.equal(rec.fields.employee_count.value, null);
    assert.equal(rec.fields.employee_count.supportState, 'missing');
  });

  test('handles source extraction failure on one document without failing entire batch', async () => {
    const mockCaller: IGeminiCaller = {
      async callModel(params) {
        if (params.prompt.includes('bad.com')) {
          throw new Error('Permanent model error for bad source');
        }
        return JSON.stringify({
          records: [
            {
              fields: {
                company_name: { value: 'Beta AI', snippet: 'Beta AI launched today.', supportState: 'supported' },
                funding_usd: { value: null, supportState: 'missing' },
                website: { value: 'https://beta.ai', snippet: 'https://beta.ai', supportState: 'supported' },
                employee_count: { value: null, supportState: 'missing' },
              },
            },
          ],
        });
      },
    };

    const gateway = new GeminiGateway({ caller: mockCaller, retryConfig: { sleeper: { sleep: async () => {} } } });
    const extractor = new GeminiExtractor(gateway);

    const result = await extractor.extractFromSources({
      workflowId: 'wf-1',
      runId: 'run-1',
      taskId: 'extract-task-2',
      userObjective: 'Extract startups',
      fields,
      sources: [
        { sourceId: 'src-fail', url: 'https://bad.com', content: 'Bad content.' },
        { sourceId: 'src-good', url: 'https://good.com', content: 'Beta AI launched today at https://beta.ai' },
      ],
    });

    // Partial success: 1 failed, 1 succeeded
    assert.equal(result.records.length, 1);
    assert.equal(result.unextractedSources.length, 1);
    assert.equal(result.unextractedSources[0].sourceId, 'src-fail');
    assert.equal(result.records[0].sourceId, 'src-good');
  });
});
