import type { ITaskHandler, TaskExecutionContext, TaskExecutionResult } from '../handler';
import type { TaskType, TaskArtifactReference } from '../../contracts/task';
import type { DatasetFieldSchema } from '../../contracts/planner';
import type { ExtractedRecord } from '../../contracts/extraction';
import { SchemaValidator, type IValidationService } from '../../quality/validator';
import { RecordNormalizer, type INormalizationService } from '../../quality/normalizer';

export interface QualityValidationHandlerOptions {
  readonly validator?: IValidationService;
  readonly normalizer?: INormalizationService;
}

export class QualityValidationHandler implements ITaskHandler {
  readonly taskType: TaskType = 'quality_validation';
  private readonly validator: IValidationService;
  private readonly normalizer: INormalizationService;

  constructor(options: QualityValidationHandlerOptions = {}) {
    this.validator = options.validator ?? new SchemaValidator();
    this.normalizer = options.normalizer ?? new RecordNormalizer();
  }

  async execute(context: TaskExecutionContext): Promise<TaskExecutionResult> {
    const fields = (context.task.input.fields as DatasetFieldSchema[]) ?? context.workflow.fieldSchema;

    // Collect extracted records from upstream task outputs or input
    const extractedRecords: ExtractedRecord[] = [];

    if (Array.isArray(context.task.input.records)) {
      extractedRecords.push(...(context.task.input.records as ExtractedRecord[]));
    }

    // In a DAG workflow, the parent extraction task outputs `records` in outputData
    // Check upstream dependencies if input doesn't directly contain them
    if (extractedRecords.length === 0) {
      // In the executor context, we can look up upstream task outputs from context if provided
      // or from task.input
    }

    const validationSummary = this.validator.validateRecords(extractedRecords, fields);
    const normalizedRecords = this.normalizer.normalizeRecords(validationSummary.validRecords, fields);

    const outputArtifacts: TaskArtifactReference[] = [
      {
        id: `art-validated-${context.task.id}`,
        type: 'record_slice',
        uri: `artifact://validated/${context.task.id}`,
        mimeType: 'application/json',
        metadata: {
          totalValidated: validationSummary.totalValidated,
          validCount: validationSummary.validCount,
          invalidCount: validationSummary.invalidCount,
        },
      },
    ];

    return {
      status: 'succeeded',
      outputData: {
        normalizedRecords,
        validationSummary: {
          totalValidated: validationSummary.totalValidated,
          validCount: validationSummary.validCount,
          invalidCount: validationSummary.invalidCount,
        },
      },
      outputArtifacts,
    };
  }
}
