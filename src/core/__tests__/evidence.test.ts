import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SchemaValidator } from '../quality/validator';
import { RecordNormalizer } from '../quality/normalizer';
import { RecordDeduplicator } from '../quality/deduplicator';
import type { DatasetFieldSchema } from '../contracts/planner';
import type { ExtractedRecord } from '../contracts/extraction';

describe('Evidence & Provenance Tracking', () => {
  const fields: DatasetFieldSchema[] = [
    { name: 'company', type: 'string', description: 'Company name', required: true },
    { name: 'valuation_usd', type: 'number', description: 'Valuation in USD', required: false },
    { name: 'website', type: 'url', description: 'Website', required: true },
    { name: 'unsupported_field', type: 'string', description: 'Field not in text', required: false },
  ];

  test('evidence preserves verbatim citations and source attribution through entire pipeline', () => {
    const rawExtraction: ExtractedRecord = {
      recordId: 'rec-1',
      sourceId: 'src-1',
      sourceUrl: 'https://news.ycombinator.com/item?id=12345',
      sourceTitle: 'Launch HN: Quantum Robotics',
      fields: {
        company: {
          value: 'Quantum Robotics',
          snippet: 'We are Quantum Robotics, building next-gen actuators.',
          supportState: 'supported',
        },
        valuation_usd: {
          value: '$20,000,000',
          snippet: 'recently closed a $20M Series A valuation round',
          supportState: 'supported',
        },
        website: {
          value: 'https://QuantumRobotics.io/about/',
          snippet: 'Check out our site at https://quantumrobotics.io',
          supportState: 'supported',
        },
        unsupported_field: {
          value: null,
          supportState: 'missing',
          rationale: 'Not present in source',
        },
      },
    };

    // Step 1: Validation
    const validator = new SchemaValidator();
    const validated = validator.validateRecord(rawExtraction, fields);
    assert.equal(validated.isValid, true);
    assert.equal(validated.evidence.company.snippet, 'We are Quantum Robotics, building next-gen actuators.');
    assert.equal(validated.evidence.company.sourceUrl, 'https://news.ycombinator.com/item?id=12345');
    assert.equal(validated.evidence.unsupported_field.supportState, 'missing');
    assert.equal(validated.evidence.unsupported_field.snippet, undefined);

    // Step 2: Normalization
    const normalizer = new RecordNormalizer();
    const normalized = normalizer.normalizeRecord(validated, fields);
    assert.equal(normalized.data.valuation_usd, 20000000);
    assert.equal(normalized.data.website, 'https://quantumrobotics.io/about');
    // Evidence value is normalized, snippet and provenance are intact
    assert.equal(normalized.evidence.valuation_usd.value, 20000000);
    assert.equal(normalized.evidence.valuation_usd.snippet, 'recently closed a $20M Series A valuation round');
    assert.equal(normalized.evidence.website.value, 'https://quantumrobotics.io/about');

    // Step 3: Deduplication
    const deduplicator = new RecordDeduplicator();
    const dedupeResult = deduplicator.deduplicate([normalized], fields, {
      workflowId: 'wf-test',
      runId: 'run-test',
    });

    assert.equal(dedupeResult.records.length, 1);
    const finalRecord = dedupeResult.records[0];

    // Final dataset record assertions
    assert.equal(finalRecord.workflowId, 'wf-test');
    assert.equal(finalRecord.runId, 'run-test');
    assert.equal(finalRecord.data.company, 'Quantum Robotics');
    assert.equal(finalRecord.data.valuation_usd, 20000000);
    assert.equal(finalRecord.data.website, 'https://quantumrobotics.io/about');
    assert.equal(finalRecord.evidence.company.snippet, 'We are Quantum Robotics, building next-gen actuators.');
    assert.equal(finalRecord.evidence.company.sourceTitle, 'Launch HN: Quantum Robotics');
    assert.equal(finalRecord.evidence.valuation_usd.snippet, 'recently closed a $20M Series A valuation round');
    assert.equal(finalRecord.evidence.unsupported_field.supportState, 'missing');
  });
});
