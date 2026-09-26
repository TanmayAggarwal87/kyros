import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SchemaValidator } from '../quality/validator';
import type { DatasetFieldSchema } from '../contracts/planner';
import type { ExtractedRecord } from '../contracts/extraction';

describe('Schema-Aware Validator', () => {
  const schema: DatasetFieldSchema[] = [
    { name: 'company', type: 'string', description: 'Company name', required: true },
    { name: 'valuation_usd', type: 'number', description: 'Valuation', required: false },
    { name: 'website', type: 'url', description: 'Website URL', required: true },
    { name: 'contact_email', type: 'email', description: 'Contact email', required: false },
    { name: 'founded_date', type: 'date', description: 'Founding date', required: false },
    { name: 'is_active', type: 'boolean', description: 'Is active', required: false },
    { name: 'tags', type: 'array', description: 'Tags', required: false },
  ];

  const validator = new SchemaValidator();

  test('validates valid record conforming to all schema constraints', () => {
    const record: ExtractedRecord = {
      recordId: 'rec-1',
      sourceId: 'src-1',
      sourceUrl: 'https://example.com/company',
      fields: {
        company: { value: 'Acme AI', supportState: 'supported', snippet: 'Acme AI was founded...' },
        valuation_usd: { value: 10000000, supportState: 'supported', snippet: '$10M valuation' },
        website: { value: 'https://acme.ai', supportState: 'supported', snippet: 'visit https://acme.ai' },
        contact_email: { value: 'info@acme.ai', supportState: 'supported' },
        founded_date: { value: '2024-01-15', supportState: 'supported' },
        is_active: { value: true, supportState: 'supported' },
        tags: { value: ['ai', 'robotics'], supportState: 'supported' },
      },
    };

    const validated = validator.validateRecord(record, schema);
    assert.equal(validated.isValid, true);
    assert.equal(validated.validationErrors.length, 0);
    assert.equal(validated.data.company, 'Acme AI');
    assert.equal(validated.evidence.company.supportState, 'supported');
    assert.equal(validated.evidence.company.sourceUrl, 'https://example.com/company');
  });

  test('detects missing required fields', () => {
    const record: ExtractedRecord = {
      recordId: 'rec-2',
      sourceId: 'src-1',
      sourceUrl: 'https://example.com/company',
      fields: {
        company: { value: null, supportState: 'missing' }, // Required field missing
        website: { value: 'https://acme.ai', supportState: 'supported' },
      },
    };

    const validated = validator.validateRecord(record, schema);
    assert.equal(validated.isValid, false);
    const missingErr = validated.validationErrors.find((e) => e.field === 'company');
    assert.ok(missingErr);
    assert.equal(missingErr.code, 'MISSING_REQUIRED_FIELD');
  });

  test('detects invalid field types and formats (URL, Email, Date, Number)', () => {
    const record: ExtractedRecord = {
      recordId: 'rec-3',
      sourceId: 'src-1',
      sourceUrl: 'https://example.com',
      fields: {
        company: { value: 'Acme AI', supportState: 'supported' },
        valuation_usd: { value: 'not-a-number', supportState: 'supported' },
        website: { value: 'not-a-valid-url', supportState: 'supported' },
        contact_email: { value: 'invalid-email-at-domain', supportState: 'supported' },
        founded_date: { value: 'definitely-not-a-date', supportState: 'supported' },
      },
    };

    const validated = validator.validateRecord(record, schema);
    assert.equal(validated.isValid, false);
    assert.equal(validated.validationErrors.length, 4);

    assert.ok(validated.validationErrors.some((e) => e.field === 'valuation_usd' && e.code === 'INVALID_NUMBER_FORMAT'));
    assert.ok(validated.validationErrors.some((e) => e.field === 'website' && e.code === 'INVALID_URL_FORMAT'));
    assert.ok(validated.validationErrors.some((e) => e.field === 'contact_email' && e.code === 'INVALID_EMAIL_FORMAT'));
    assert.ok(validated.validationErrors.some((e) => e.field === 'founded_date' && e.code === 'INVALID_DATE_FORMAT'));
  });

  test('batches records into valid and invalid sets in summary', () => {
    const records: ExtractedRecord[] = [
      {
        recordId: 'rec-valid',
        sourceId: 'src-1',
        sourceUrl: 'https://example.com',
        fields: {
          company: { value: 'Good Co', supportState: 'supported' },
          website: { value: 'https://good.co', supportState: 'supported' },
        },
      },
      {
        recordId: 'rec-invalid',
        sourceId: 'src-2',
        sourceUrl: 'https://example.com',
        fields: {
          company: { value: null, supportState: 'missing' },
          website: { value: 'https://missing-company.co', supportState: 'supported' },
        },
      },
    ];

    const summary = validator.validateRecords(records, schema);
    assert.equal(summary.totalValidated, 2);
    assert.equal(summary.validCount, 1);
    assert.equal(summary.invalidCount, 1);
    assert.equal(summary.validRecords[0].recordId, 'rec-valid');
    assert.equal(summary.invalidRecords[0].recordId, 'rec-invalid');
  });
});
