import type { ITaskHandler, TaskExecutionContext, TaskExecutionResult } from '../handler';
import type { TaskType, TaskArtifactReference } from '../../contracts/task';
import type { IExtractionService } from '../../extraction/gemini-extractor';
import type { IArtifactStore } from '../../research/artifacts-store';
import type { DatasetFieldSchema } from '../../contracts/planner';
import { KyrosError } from '../../errors/kyros-error';

export interface GeminiExtractionHandlerOptions {
  readonly extractionService: IExtractionService;
  readonly artifactStore: IArtifactStore;
}

export class GeminiExtractionHandler implements ITaskHandler {
  readonly taskType: TaskType = 'extraction';
  private readonly extractionService: IExtractionService;
  private readonly artifactStore: IArtifactStore;

  constructor(options: GeminiExtractionHandlerOptions) {
    this.extractionService = options.extractionService;
    this.artifactStore = options.artifactStore;
  }

  async execute(context: TaskExecutionContext): Promise<TaskExecutionResult> {
    const input = (context.task.input || {}) as Record<string, unknown>;
    let fields: readonly DatasetFieldSchema[] = context.workflow.fieldSchema || [];

    if (Array.isArray(input.fields) && input.fields.length > 0) {
      if (typeof input.fields[0] === 'object' && input.fields[0] !== null && 'name' in (input.fields[0] as Record<string, unknown>)) {
        fields = input.fields as DatasetFieldSchema[];
      } else if (typeof input.fields[0] === 'string') {
        const requestedNames = new Set(input.fields as string[]);
        const matched = (context.workflow.fieldSchema || []).filter((f) => requestedNames.has(f.name));
        if (matched.length > 0) {
          fields = matched;
        }
      }
    }

    if (!fields || fields.length === 0) {
      return {
        status: 'failed',
        error: KyrosError.invalidInput('Extraction task requires dataset fields schema in input or workflow.'),
      };
    }

    // 1. Resolve source and content artifacts from upstream
    const sourceInputs: { sourceId: string; url: string; title?: string; content: string; query?: string }[] = [];

    // Find all source artifacts in the artifact store for this workflow
    const sources = await this.artifactStore.listSourceArtifacts(context.workflow.id, context.workflow.runId);

    for (const src of sources) {
      const cnt = await this.artifactStore.getContentArtifactBySourceId(src.id);
      if (cnt && cnt.text.trim().length > 0) {
        sourceInputs.push({
          sourceId: src.id,
          url: src.url,
          title: src.title,
          content: cnt.text,
          query: src.query,
        });
      }
    }

    if (sourceInputs.length === 0) {
      return {
        status: 'failed',
        error: new KyrosError({
          category: 'extraction',
          code: 'NO_UPSTREAM_CONTENT',
          safeMessage: 'No upstream source content artifacts available for extraction.',
          retryable: false,
          scope: 'task',
        }),
      };
    }

    try {
      const extractionResult = await this.extractionService.extractFromSources({
        workflowId: context.workflow.id,
        runId: context.workflow.runId,
        taskId: context.task.id,
        userObjective: context.workflow.prompt,
        fields,
        sources: sourceInputs,
      });

      const outputArtifacts: TaskArtifactReference[] = [
        {
          id: `art-extracted-${context.task.id}`,
          type: 'record_slice',
          uri: `artifact://extracted/${context.task.id}`,
          mimeType: 'application/json',
          metadata: {
            extractedCount: extractionResult.records.length,
            unextractedCount: extractionResult.unextractedSources.length,
          },
        },
      ];

      return {
        status: 'succeeded',
        outputData: {
          records: extractionResult.records,
          unextractedSources: extractionResult.unextractedSources,
          extractedCount: extractionResult.records.length,
        },
        outputArtifacts,
      };
    } catch (err) {
      const kyrosErr = KyrosError.fromUnknown(err, 'extraction', 'task');
      return {
        status: 'failed',
        error: kyrosErr,
      };
    }
  }
}
