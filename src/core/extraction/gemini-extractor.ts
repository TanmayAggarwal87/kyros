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

const GeminiExtractedFieldZod = z.object({
  value: z.unknown().nullable().optional(),
  snippet: z.string().nullable().optional(),
  supportState: z.enum(['supported', 'partially_supported', 'inferred', 'missing', 'conflicting']),
  rationale: z.string().nullable().optional(),
});

const GeminiExtractedRecordZod = z.object({
  fields: z.record(z.string(), GeminiExtractedFieldZod),
});

const GeminiExtractionResponseZod = z.object({
  records: z.array(GeminiExtractedRecordZod),
});

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
      '5. Output must strictly conform to the requested JSON schema.',
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
        const extracted = rawRec.fields[fieldSchema.name];

        if (!extracted || extracted.value === null || extracted.value === undefined) {
          recordFields[fieldSchema.name] = {
            value: null,
            snippet: undefined,
            supportState: 'missing',
            rationale: extracted?.rationale ?? 'Field not found in source text',
          };
        } else {
          recordFields[fieldSchema.name] = {
            value: extracted.value,
            snippet: extracted.snippet ? extracted.snippet.trim() : undefined,
            supportState: extracted.supportState || 'supported',
            rationale: extracted.rationale ? extracted.rationale.trim() : undefined,
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
