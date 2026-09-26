import type { ITaskHandler, TaskExecutionContext, TaskExecutionResult } from '../handler';
import type { TaskType, TaskArtifactReference } from '../../contracts/task';
import type { DatasetFieldSchema } from '../../contracts/planner';
import type { ExtractedRecord } from '../../contracts/extraction';
import { SchemaValidator, type IValidationService } from '../../quality/validator';
import { RecordNormalizer, type INormalizationService } from '../../quality/normalizer';
import type { IWorkflowRepository } from '../../persistence/repository';

export interface QualityValidationHandlerOptions {
  readonly validator?: IValidationService;
  readonly normalizer?: INormalizationService;
  readonly repository?: IWorkflowRepository;
}

export class QualityValidationHandler implements ITaskHandler {
  readonly taskType: TaskType = 'quality_validation';
  private readonly validator: IValidationService;
  private readonly normalizer: INormalizationService;
  private readonly repository?: IWorkflowRepository;

  constructor(options: QualityValidationHandlerOptions = {}) {
    this.validator = options.validator ?? new SchemaValidator();
    this.normalizer = options.normalizer ?? new RecordNormalizer();
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

    // Collect extracted records from upstream task outputs or input
    const extractedRecords: ExtractedRecord[] = [];

    if (Array.isArray(context.task.input.records)) {
      extractedRecords.push(...(context.task.input.records as ExtractedRecord[]));
    }

    // In a DAG workflow, the parent extraction task outputs `records` in outputData
    if (extractedRecords.length === 0 && this.repository) {
      for (const depId of context.task.dependencies) {
        const depTask = await this.repository.getTask(depId);
        if (depTask?.outputData?.records && Array.isArray(depTask.outputData.records)) {
          extractedRecords.push(...(depTask.outputData.records as ExtractedRecord[]));
        }
      }
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

