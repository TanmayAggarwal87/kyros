import type { ITaskHandler, TaskExecutionContext, TaskExecutionResult } from '../handler';
import type { TaskType, TaskArtifactReference } from '../../contracts/task';
import type { DatasetFieldSchema } from '../../contracts/planner';
import type { NormalizedRecord } from '../../contracts/quality';
import { RecordDeduplicator, type IDeduplicationService } from '../../quality/deduplicator';

export interface DeduplicationHandlerOptions {
  readonly deduplicator?: IDeduplicationService;
}

export class DeduplicationHandler implements ITaskHandler {
  readonly taskType: TaskType = 'deduplication';
  private readonly deduplicator: IDeduplicationService;

  constructor(options: DeduplicationHandlerOptions = {}) {
    this.deduplicator = options.deduplicator ?? new RecordDeduplicator();
  }

  async execute(context: TaskExecutionContext): Promise<TaskExecutionResult> {
    const fields = (context.task.input.fields as DatasetFieldSchema[]) ?? context.workflow.fieldSchema;

    const normalizedRecords: NormalizedRecord[] = [];
    if (Array.isArray(context.task.input.normalizedRecords)) {
      normalizedRecords.push(...(context.task.input.normalizedRecords as NormalizedRecord[]));
    }

    const dedupeResult = this.deduplicator.deduplicate(normalizedRecords, fields, {
      workflowId: context.workflow.id,
      runId: context.workflow.runId,
    });

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
