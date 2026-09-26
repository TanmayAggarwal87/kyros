import type { IResearchProvider, ResearchRequest } from '../contracts/research';
import type { DatasetFieldSchema } from '../contracts/planner';
import type { QualityPipelineReport } from '../contracts/quality';
import type { SourceArtifact, ContentArtifact } from '../contracts/artifacts';
import type { IArtifactStore } from '../research/artifacts-store';
import type { IExtractionService } from '../extraction/gemini-extractor';
import { SchemaValidator, type IValidationService } from './validator';
import { RecordNormalizer, type INormalizationService } from './normalizer';
import { RecordDeduplicator, type IDeduplicationService } from './deduplicator';
import { KyrosError } from '../errors/kyros-error';
import type { NormalizedErrorPayload } from '../contracts/errors';

export interface ResearchQualityPipelineOptions {
  readonly researchProvider: IResearchProvider;
  readonly artifactStore: IArtifactStore;
  readonly extractionService: IExtractionService;
  readonly validator?: IValidationService;
  readonly normalizer?: INormalizationService;
  readonly deduplicator?: IDeduplicationService;
}

export interface PipelineExecutionParams {
  readonly workflowId: string;
  readonly runId: string;
  readonly taskId: string;
  readonly userObjective: string;
  readonly researchRequest: ResearchRequest;
  readonly fields: readonly DatasetFieldSchema[];
}

export class ResearchQualityPipeline {
  private readonly researchProvider: IResearchProvider;
  private readonly artifactStore: IArtifactStore;
  private readonly extractionService: IExtractionService;
  private readonly validator: IValidationService;
  private readonly normalizer: INormalizationService;
  private readonly deduplicator: IDeduplicationService;

  constructor(options: ResearchQualityPipelineOptions) {
    this.researchProvider = options.researchProvider;
    this.artifactStore = options.artifactStore;
    this.extractionService = options.extractionService;
    this.validator = options.validator ?? new SchemaValidator();
    this.normalizer = options.normalizer ?? new RecordNormalizer();
    this.deduplicator = options.deduplicator ?? new RecordDeduplicator();
  }

  async runPipeline(params: PipelineExecutionParams): Promise<QualityPipelineReport> {
    const errors: NormalizedErrorPayload[] = [];
    const now = new Date().toISOString();

    // 1. Research Phase
    let searchResponse;
    try {
      searchResponse = await this.researchProvider.search(params.researchRequest);
    } catch (err) {
      const kyrosErr = KyrosError.fromUnknown(err, 'acquisition', 'task');
      errors.push(kyrosErr.toPayload());
      return {
        workflowId: params.workflowId,
        runId: params.runId,
        sourcesReceived: 0,
        sourcesRetrieved: 0,
        sourcesFailed: 1,
        recordsExtracted: 0,
        extractionFailures: 0,
        recordsValid: 0,
        recordsInvalid: 0,
        recordsDeduplicated: 0,
        finalRecords: [],
        errors,
      };
    }

    const sourceArtifacts: SourceArtifact[] = [];
    const sourceInputs: { sourceId: string; url: string; title?: string; content: string }[] = [];

    // 2. Artifact Ingestion Phase
    let sourceFailures = 0;
    for (let i = 0; i < searchResponse.results.length; i++) {
      const res = searchResponse.results[i];
      const sourceId = `src-${params.taskId}-${i + 1}`;
      const contentText = res.text || res.summary || (res.highlights ? res.highlights.join('\n\n') : '');

      if (!contentText || contentText.trim().length === 0) {
        sourceFailures++;
        errors.push({
          category: 'acquisition',
          code: 'EMPTY_SOURCE_CONTENT',
          message: `Source "${res.url}" returned no text content.`,
          retryable: false,
          scope: 'task',
          timestamp: now,
        });
        continue;
      }

      const srcArt: SourceArtifact = {
        id: sourceId,
        workflowId: params.workflowId,
        runId: params.runId,
        taskId: params.taskId,
        url: res.url,
        title: res.title,
        author: res.author,
        publishedDate: res.publishedDate,
        retrievedAt: now,
        query: params.researchRequest.query,
        acquisitionMethod: 'exa_search',
        score: res.score,
        metadata: res.rawMetadata,
      };

      const contentArt: ContentArtifact = {
        id: `cnt-${sourceId}`,
        sourceId,
        url: res.url,
        mimeType: 'text/plain',
        text: contentText,
        highlights: res.highlights,
        summary: res.summary,
        byteSize: Buffer.byteLength(contentText, 'utf8'),
        extractedAt: now,
      };

      await this.artifactStore.saveSourceArtifact(srcArt);
      await this.artifactStore.saveContentArtifact(contentArt);

      sourceArtifacts.push(srcArt);
      sourceInputs.push({
        sourceId,
        url: res.url,
        title: res.title,
        content: contentText,
      });
    }

    if (sourceInputs.length === 0) {
      return {
        workflowId: params.workflowId,
        runId: params.runId,
        sourcesReceived: searchResponse.results.length,
        sourcesRetrieved: 0,
        sourcesFailed: searchResponse.results.length,
        recordsExtracted: 0,
        extractionFailures: 0,
        recordsValid: 0,
        recordsInvalid: 0,
        recordsDeduplicated: 0,
        finalRecords: [],
        errors,
      };
    }

    // 3. Extraction Phase
    let extractionResult;
    try {
      extractionResult = await this.extractionService.extractFromSources({
        workflowId: params.workflowId,
        runId: params.runId,
        taskId: params.taskId,
        userObjective: params.userObjective,
        fields: params.fields,
        sources: sourceInputs,
      });
    } catch (err) {
      const kyrosErr = KyrosError.fromUnknown(err, 'extraction', 'task');
      errors.push(kyrosErr.toPayload());
      return {
        workflowId: params.workflowId,
        runId: params.runId,
        sourcesReceived: searchResponse.results.length,
        sourcesRetrieved: sourceInputs.length,
        sourcesFailed: sourceFailures,
        recordsExtracted: 0,
        extractionFailures: sourceInputs.length,
        recordsValid: 0,
        recordsInvalid: 0,
        recordsDeduplicated: 0,
        finalRecords: [],
        errors,
      };
    }

    for (const unextracted of extractionResult.unextractedSources) {
      errors.push({
        category: 'extraction',
        code: 'SOURCE_EXTRACTION_UNAVAILABLE',
        message: unextracted.reason,
        diagnosticContext: { sourceId: unextracted.sourceId },
        retryable: false,
        scope: 'task',
        timestamp: now,
      });
    }

    // 4. Validation Phase
    const validationSummary = this.validator.validateRecords(extractionResult.records, params.fields);

    for (const invalid of validationSummary.invalidRecords) {
      for (const errItem of invalid.validationErrors) {
        errors.push({
          category: 'validation',
          code: errItem.code,
          message: errItem.message,
          diagnosticContext: { recordId: invalid.recordId, field: errItem.field, received: errItem.receivedValue },
          retryable: false,
          scope: 'task',
          timestamp: now,
        });
      }
    }

    // 5. Normalization Phase (normalize only valid records)
    const normalizedRecords = this.normalizer.normalizeRecords(validationSummary.validRecords, params.fields);

    // 6. Deduplication Phase
    const dedupeResult = this.deduplicator.deduplicate(normalizedRecords, params.fields, {
      workflowId: params.workflowId,
      runId: params.runId,
    });

    return {
      workflowId: params.workflowId,
      runId: params.runId,
      sourcesReceived: searchResponse.results.length,
      sourcesRetrieved: sourceInputs.length,
      sourcesFailed: sourceFailures,
      recordsExtracted: extractionResult.records.length,
      extractionFailures: extractionResult.unextractedSources.length,
      recordsValid: validationSummary.validCount,
      recordsInvalid: validationSummary.invalidCount,
      recordsDeduplicated: dedupeResult.stats.duplicatesRemoved,
      finalRecords: dedupeResult.records,
      errors,
    };
  }
}
