import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RecordNormalizer } from '../quality/normalizer';
import type { DatasetFieldSchema } from '../contracts/planner';
import type { ValidatedRecord } from '../contracts/quality';

describe('Record Normalizer', () => {
  const schema: DatasetFieldSchema[] = [
    { name: 'website', type: 'url', description: 'URL', required: true },
    { name: 'name', type: 'string', description: 'Name', required: true },
    { name: 'amount', type: 'number', description: 'Amount', required: false },
    { name: 'email', type: 'email', description: 'Email', required: false },
    { name: 'date', type: 'date', description: 'Date', required: false },
    { name: 'tags', type: 'array', description: 'Tags', required: false },
  ];

  const normalizer = new RecordNormalizer();

  test('normalizes URLs: strips utm tracking params, default ports, trailing slashes, lowercases host', () => {
    const rawRecord: ValidatedRecord = {
      recordId: 'rec-1',
      sourceId: 'src-1',
      sourceUrl: 'https://Example.com/article/',
      data: {
        website: 'https://WWW.Example.COM:443/products/ai/?utm_source=twitter&utm_medium=social&ref=partner#section',
        name: '  Acme   Corporation \n\t ',
        amount: '$1,500,000.50',
        email: '  Support@ACME.IO  ',
        date: 'March 15, 2026',
        tags: [' AI ', 'robotics', 'AI', '  '],
      },
      evidence: {
        website: {
          value: 'https://WWW.Example.COM:443/products/ai/?utm_source=twitter&utm_medium=social&ref=partner#section',
          supportState: 'supported',
          sourceUrl: 'https://Example.com/article/',
          snippet: 'visit https://www.example.com/products/ai/',
          collectedAt: '2026-09-26T00:00:00.000Z',
          acquisitionMethod: 'gemini_extraction',
        },
      },
      isValid: true,
      validationErrors: [],
    };

    const normalized = normalizer.normalizeRecord(rawRecord, schema);

    // URL: lowercase host, port removed, utm removed, trailing slash cleaned
    assert.equal(normalized.data.website, 'https://www.example.com/products/ai#section');

    // String: trimmed and spaces collapsed
    assert.equal(normalized.data.name, 'Acme Corporation');

    // Number: parsed from formatted currency string
    assert.equal(normalized.data.amount, 1500000.5);

    // Email: lowercased and trimmed
    assert.equal(normalized.data.email, 'support@acme.io');

    // Date: ISO date format
    assert.equal(normalized.data.date, '2026-03-15');

    // Array: trimmed, empty removed, deduplicated
    assert.deepEqual(normalized.data.tags, ['AI', 'robotics']);

    // Evidence: value updated to normalized value while preserving snippet
    assert.equal(normalized.evidence.website.value, 'https://www.example.com/products/ai#section');
    assert.equal(normalized.evidence.website.snippet, 'visit https://www.example.com/products/ai/');
  });
});
