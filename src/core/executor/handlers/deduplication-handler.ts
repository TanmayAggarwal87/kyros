import type { ITaskHandler, TaskExecutionContext, TaskExecutionResult } from '../handler';
import type { TaskType, TaskArtifactReference } from '../../contracts/task';
import type { DatasetFieldSchema } from '../../contracts/planner';
import type { NormalizedRecord } from '../../contracts/quality';
import type { SupportState, FieldEvidence } from '../../contracts/dataset';
import { RecordDeduplicator, type IDeduplicationService } from '../../quality/deduplicator';
import type { IWorkflowRepository } from '../../persistence/repository';

export interface DeduplicationHandlerOptions {
  readonly deduplicator?: IDeduplicationService;
  readonly repository?: IWorkflowRepository;
}

export class DeduplicationHandler implements ITaskHandler {
  readonly taskType: TaskType = 'deduplication';
  private readonly deduplicator: IDeduplicationService;
  private readonly repository?: IWorkflowRepository;

  constructor(options: DeduplicationHandlerOptions = {}) {
    this.deduplicator = options.deduplicator ?? new RecordDeduplicator();
    this.repository = options.repository;
  }

  async execute(context: TaskExecutionContext): Promise<TaskExecutionResult> {
    const input = (context.task.input || {}) as Record<string, unknown>;
    let fields: readonly DatasetFieldSchema[] = context.workflow.fieldSchema || [];
    if (Array.isArray(input.fields) && input.fields.length > 0) {
      if (typeof input.fields[0] === 'object' && input.fields[0] !== null && 'name' in (input.fields[0] as Record<string, unknown>)) {
        fields = input.fields as DatasetFieldSchema[];
      }
    }

    const normalizedRecords: NormalizedRecord[] = [];
    const rawIncoming: unknown[] = [];
    if (Array.isArray(input.normalizedRecords)) {
      rawIncoming.push(...input.normalizedRecords);
    } else if (Array.isArray(input.records)) {
      rawIncoming.push(...input.records);
    }

    if (rawIncoming.length === 0 && this.repository) {
      for (const depId of context.task.dependencies) {
        const depTask = await this.repository.getTask(depId);
        if (depTask?.outputData?.normalizedRecords && Array.isArray(depTask.outputData.normalizedRecords)) {
          rawIncoming.push(...depTask.outputData.normalizedRecords);
        } else if (depTask?.outputData?.records && Array.isArray(depTask.outputData.records)) {
          rawIncoming.push(...depTask.outputData.records);
        }
      }
    }

    const now = new Date().toISOString();
    for (const item of rawIncoming) {
      const rec = item as Record<string, unknown>;
      if (rec.data && typeof rec.data === 'object') {
        normalizedRecords.push(rec as unknown as NormalizedRecord);
      } else if (rec.fields && typeof rec.fields === 'object') {
        const data: Record<string, unknown> = {};
        const evidence: Record<string, FieldEvidence> = {};
        for (const [k, v] of Object.entries(rec.fields as Record<string, Record<string, unknown>>)) {
          data[k] = v?.value ?? null;
          evidence[k] = {
            value: v?.value ?? null,
            supportState: (typeof v?.supportState === 'string'
              ? (v.supportState as SupportState)
              : v?.value === null
                ? 'missing'
                : 'supported'),
            sourceUrl: typeof rec.sourceUrl === 'string' ? rec.sourceUrl : undefined,
            sourceTitle: typeof rec.sourceTitle === 'string' ? rec.sourceTitle : undefined,
            snippet: typeof v?.snippet === 'string' ? v.snippet : undefined,
            collectedAt: now,
            acquisitionMethod: 'gemini_extraction',
          };
        }
        normalizedRecords.push({
          recordId: (rec.recordId as string) || `rec-${Date.now()}`,
          sourceId: typeof rec.sourceId === 'string' ? rec.sourceId : 'source-unknown',
          sourceUrl: typeof rec.sourceUrl === 'string' ? rec.sourceUrl : 'https://unknown.com',
          sourceTitle: typeof rec.sourceTitle === 'string' ? rec.sourceTitle : undefined,
          data,
          evidence,
        });
      }
    }

    const dedupeResult = this.deduplicator.deduplicate(normalizedRecords, fields, {
      workflowId: context.workflow.id,
      runId: context.workflow.runId,
    });

    if (this.repository) {
      await this.repository.saveDatasetRecords(dedupeResult.records);
    }

    const outputArtifacts: TaskArtifactReference[] = [
      {
        id: `art-dataset-${context.task.id}`,
        type: 'dataset',
        uri: `artifact://dataset/${context.workflow.id}`,
        mimeType: 'application/json',
        metadata: {
          totalInput: dedupeResult.stats.totalInput,
          uniqueCount: dedupeResult.stats.uniqueCount,
          duplicatesRemoved: dedupeResult.stats.duplicatesRemoved,
        },
      },
    ];

    return {
      status: 'succeeded',
      outputData: {
        records: dedupeResult.records,
        stats: dedupeResult.stats,
        duplicateDecisions: dedupeResult.duplicateDecisions,
      },
      outputArtifacts,
    };
  }
}

