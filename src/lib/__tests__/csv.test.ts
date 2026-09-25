import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeCsvCell, generateDatasetCsv } from '../csv';
import type { DatasetRecord, DatasetFieldSchema } from '@/core/contracts';

test('sanitizeCsvCell prevents formula injection and escapes quotes', () => {
  assert.equal(sanitizeCsvCell('=1+1'), "'=1+1");
  assert.equal(sanitizeCsvCell('@cmd'), "'@cmd");
  assert.equal(sanitizeCsvCell('-5'), "'-5");
  assert.equal(sanitizeCsvCell('+10'), "'+10");
  assert.equal(sanitizeCsvCell('Hello, World'), '"Hello, World"');
  assert.equal(sanitizeCsvCell('He said "Hi"'), '"He said ""Hi"""');
  assert.equal(sanitizeCsvCell(null), '');
  assert.equal(sanitizeCsvCell(undefined), '');
  assert.equal(sanitizeCsvCell(42), '42');
});

test('generateDatasetCsv produces correctly formatted CSV with headers and rows', () => {
  const fields: DatasetFieldSchema[] = [
    { name: 'company', type: 'string', description: 'Company name', required: true },
    { name: 'valuation_usd', type: 'number', description: 'Valuation', required: false },
  ];

  const records: DatasetRecord[] = [
    {
      id: 'rec-1',
      workflowId: 'wf-1',
      runId: 'run-1',
      data: { company: 'Acme Corp', valuation_usd: 1000000 },
      evidence: {
        company: {
          value: 'Acme Corp',
          supportState: 'supported',
          sourceUrl: 'https://example.com/acme',
          collectedAt: '2026-09-25T12:00:00Z',
          acquisitionMethod: 'exa_search',
        },
      },
      createdAt: '2026-09-25T12:00:00Z',
      updatedAt: '2026-09-25T12:00:00Z',
    },
    {
      id: 'rec-2',
      workflowId: 'wf-1',
      runId: 'run-1',
      data: { company: 'Beta, Inc.', valuation_usd: null },
      evidence: {
        company: {
          value: 'Beta, Inc.',
          supportState: 'partially_supported',
          sourceUrl: 'https://example.com/beta',
          collectedAt: '2026-09-25T12:05:00Z',
          acquisitionMethod: 'webcmd_browser',
        },
        valuation_usd: {
          value: null,
          supportState: 'missing',
          collectedAt: '2026-09-25T12:05:00Z',
          acquisitionMethod: 'gemini_extraction',
        },
      },
      createdAt: '2026-09-25T12:05:00Z',
      updatedAt: '2026-09-25T12:05:00Z',
    },
  ];

  const csv = generateDatasetCsv(records, fields, {
    includeSupportStates: true,
    includeEvidenceUrls: true,
  });

  const lines = csv.split('\r\n');
  assert.equal(lines.length, 3);
  assert.equal(
    lines[0],
    'record_id,company,company__support_state,company__source_url,valuation_usd,valuation_usd__support_state,valuation_usd__source_url'
  );
  assert.match(lines[1], /rec-1,Acme Corp,supported,https:\/\/example\.com\/acme,1000000,missing/);
  assert.match(lines[2], /rec-2,"Beta, Inc.",partially_supported,https:\/\/example\.com\/beta,,missing/);
});
