import { z } from 'zod';
import type { IGeminiGateway } from '../ai/gateway';
import type { DatasetFieldSchema } from '../contracts/planner';
import {
  type ExtractionRequest,
  type ExtractionResult,
  type ExtractedRecord,
  type ExtractedField,
  type SourceContentInput,
  extractionRequestSchema,
} from '../contracts/extraction';
import { KyrosError } from '../errors/kyros-error';

export const GeminiExtractedFieldZod = z.object({
  value: z.unknown().nullable().optional(),
  snippet: z.string().nullable().optional(),
  supportState: z
    .enum(['supported', 'partially_supported', 'inferred', 'missing', 'conflicting'])
    .or(
      z.string().transform((val) => {
        if (['supported', 'partially_supported', 'inferred', 'missing', 'conflicting'].includes(val)) {
          return val as 'supported' | 'partially_supported' | 'inferred' | 'missing' | 'conflicting';
        }
        return 'supported';
      })
    )
    .optional()
    .default('supported'),
  rationale: z.string().nullable().optional(),
});

const FlexibleRecordZod = z.unknown().transform((raw: unknown): { fields: Record<string, unknown> } => {
  if (raw && typeof raw === 'object') {
    const rawObj = raw as Record<string, unknown>;
    if (rawObj.fields && typeof rawObj.fields === 'object') {
      return { fields: rawObj.fields as Record<string, unknown> };
    }
    // Flat format: { company_name: '...', company_name_snippet: '...', company_name_support_state: '...' }
    const fields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rawObj)) {
      if (k.endsWith('_snippet') || k.endsWith('_support_state') || k.endsWith('_rationale')) {
        continue;
      }
      const snippet = rawObj[`${k}_snippet`] ?? (typeof v === 'string' ? v : undefined);
      const supportState = rawObj[`${k}_support_state`] ?? 'supported';
      const rationale = rawObj[`${k}_rationale`];

      if (typeof v === 'object' && v !== null && ('value' in v || 'snippet' in v)) {
        fields[k] = v;
      } else {
        fields[k] = {
          value: v,
          snippet: typeof snippet === 'string' ? snippet : undefined,
          supportState: typeof supportState === 'string' ? supportState : 'supported',
          rationale: typeof rationale === 'string' ? rationale : undefined,
        };
      }
    }
    return { fields };
  }
  return { fields: {} };
});

const GeminiExtractionResponseZod = z.preprocess((input: unknown) => {
  if (Array.isArray(input)) {
    return { records: input };
  }
  if (input && typeof input === 'object' && Array.isArray((input as Record<string, unknown>).records)) {
    return input;
  }
  return { records: [] };
}, z.object({
  records: z.array(FlexibleRecordZod),
}));

export interface IExtractionService {
  extractFromSources(request: ExtractionRequest): Promise<ExtractionResult>;
}

export class GeminiExtractor implements IExtractionService {
  private readonly gateway: IGeminiGateway;

  constructor(gateway: IGeminiGateway) {
    this.gateway = gateway;
  }

  async extractFromSources(request: ExtractionRequest): Promise<ExtractionResult> {
    // 1. Validate request
    const parseResult = extractionRequestSchema.safeParse(request);
    if (!parseResult.success) {
      throw new KyrosError({
        category: 'input',
        code: 'INVALID_EXTRACTION_REQUEST',
        safeMessage: 'Invalid extraction parameters provided.',
        diagnosticContext: { issues: parseResult.error.issues },
        retryable: false,
        scope: 'task',
      });
    }

    const validRequest = parseResult.data;
    const records: ExtractedRecord[] = [];
    const unextractedSources: { sourceId: string; reason: string }[] = [];

    // 2. Extract from each source individually to guarantee isolation and accurate source attribution
    for (const source of validRequest.sources) {
      if (!source.content || source.content.trim().length === 0) {
        unextractedSources.push({
          sourceId: source.sourceId,
          reason: 'Source content was empty or unavailable.',
        });
        continue;
      }

      try {
        const sourceRecords = await this.extractFromSingleSource(
          source,
          validRequest.fields,
          validRequest.userObjective
        );

        if (sourceRecords.length === 0) {
          unextractedSources.push({
            sourceId: source.sourceId,
            reason: 'No matching structured entities found in source content.',
          });
        } else {
          records.push(...sourceRecords);
        }
      } catch (err) {
        // Individual source extraction failure must not fail entire batch (support partial success)
        const errorMessage = err instanceof Error ? err.message : String(err);
        unextractedSources.push({
          sourceId: source.sourceId,
          reason: `Extraction failed: ${errorMessage}`,
        });
      }
    }

    return {
      records,
      unextractedSources,
    };
  }

  private async extractFromSingleSource(
    source: SourceContentInput,
    fields: readonly DatasetFieldSchema[],
    userObjective: string
  ): Promise<ExtractedRecord[]> {
    const fieldDescriptions = fields
      .map((f) => `- "${f.name}" (${f.type}${f.required ? ', required' : ', optional'}): ${f.description}`)
      .join('\n');

    const systemInstruction = [
      'You are Kyros Extractor, a precise and truthful AI data extraction engine.',
      'Your mission is to extract structured entity records from the provided web source text matching the user objective.',
      '',
      'CRITICAL EXTRACTION RULES:',
      '1. TRUTHFULNESS & PROVENANCE: Every extracted field value MUST be directly supported by the source text.',
      '2. SNIPPETS: For each extracted field with a value, provide the verbatim text excerpt (snippet) from the content that proves it.',
      '3. SUPPORT STATES:',
      '   - "supported": Value is directly and explicitly stated in the source text.',
      '   - "partially_supported": Value is partially stated or requires minor formatting deduction.',
      '   - "inferred": Value is logically deduced from surrounding context (provide rationale).',
      '   - "missing": Value is NOT found in the source text. Set value to null and snippet to null. DO NOT GUESS OR FABRICATE.',
      '   - "conflicting": Source presents conflicting data for this field.',
      '4. NEVER FABRICATE: If a field is not present in the source, mark supportState as "missing" with value null.',
      '5. OUTPUT JSON FORMAT: Output MUST be valid JSON with a "records" array where each record has a "fields" map:',
      '{',
      '  "records": [',
      '    {',
      '      "fields": {',
      '        "<fieldName>": {',
      '          "value": "<extracted value or null>",',
      '          "snippet": "<verbatim excerpt from source or null>",',
      '          "supportState": "supported" | "partially_supported" | "inferred" | "missing" | "conflicting",',
      '          "rationale": "<reasoning if inferred or missing>"',
      '        }',
      '      }',
      '    }',
      '  ]',
      '}',
    ].join('\n');

    const prompt = [
      `User Research Objective: "${userObjective}"`,
      '',
      `Source Metadata:`,
      `- URL: ${source.url}`,
      `- Title: ${source.title ?? 'Untitled'}`,
      '',
      `Requested Field Schema:`,
      fieldDescriptions,
      '',
      `Source Content:`,
      '--- BEGIN SOURCE CONTENT ---',
      source.content.slice(0, 15000), // Bounded slice to prevent token overflow
      '--- END SOURCE CONTENT ---',
      '',
      'Extract all relevant entity records found in this source text. If no entities match the objective, return an empty records array.',
    ].join('\n');

    const response = await this.gateway.generateStructuredJson({
      role: 'extractor',
      systemInstruction,
      prompt,
      schema: GeminiExtractionResponseZod,
    });

    const resultRecords: ExtractedRecord[] = [];

    for (let i = 0; i < response.records.length; i++) {
      const rawRec = response.records[i];
      const recordId = `rec-${source.sourceId}-${i + 1}`;
      const recordFields: Record<string, ExtractedField> = {};

      for (const fieldSchema of fields) {
        const rawField = rawRec.fields[fieldSchema.name] as Record<string, unknown> | undefined;

        if (rawField === undefined || rawField === null) {
          recordFields[fieldSchema.name] = {
            value: null,
            snippet: undefined,
            supportState: 'missing',
            rationale: 'Field not found in source text',
          };
        } else if (typeof rawField === 'object' && ('value' in rawField || 'snippet' in rawField || 'supportState' in rawField)) {
          const val = rawField.value;
          const snippet = typeof rawField.snippet === 'string' ? rawField.snippet.trim() : undefined;
          const supportState = (typeof rawField.supportState === 'string' ? rawField.supportState : 'supported') as
            | 'supported'
            | 'partially_supported'
            | 'inferred'
            | 'missing'
            | 'conflicting';
          const rationale = typeof rawField.rationale === 'string' ? rawField.rationale.trim() : undefined;

          recordFields[fieldSchema.name] = {
            value: val ?? null,
            snippet,
            supportState: val === null || val === undefined ? 'missing' : supportState,
            rationale,
          };
        } else {
          // Direct scalar value
          recordFields[fieldSchema.name] = {
            value: rawField,
            snippet: typeof rawField === 'string' ? rawField : undefined,
            supportState: 'supported',
            rationale: undefined,
          };
        }
      }

      resultRecords.push({
        recordId,
        sourceId: source.sourceId,
        sourceUrl: source.url,
        sourceTitle: source.title,
        fields: recordFields,
      });
    }

    return resultRecords;
  }
}
