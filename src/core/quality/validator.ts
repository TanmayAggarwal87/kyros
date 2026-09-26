import type { DatasetFieldSchema, DatasetFieldType } from '../contracts/planner';
import type { ExtractedRecord } from '../contracts/extraction';
import type { FieldEvidence } from '../contracts/dataset';
import type {
  ValidatedRecord,
  ValidationErrorItem,
  ValidationSummary,
} from '../contracts/quality';

export interface IValidationService {
  validateRecord(record: ExtractedRecord, fields: readonly DatasetFieldSchema[]): ValidatedRecord;
  validateRecords(records: readonly ExtractedRecord[], fields: readonly DatasetFieldSchema[]): ValidationSummary;
}

export class SchemaValidator implements IValidationService {
  validateRecord(record: ExtractedRecord, fields: readonly DatasetFieldSchema[]): ValidatedRecord {
    const data: Record<string, unknown> = {};
    const evidence: Record<string, FieldEvidence> = {};
    const validationErrors: ValidationErrorItem[] = [];
    const collectedAt = new Date().toISOString();

    for (const fieldSchema of fields) {
      const fieldName = fieldSchema.name;
      const extracted = record.fields[fieldName];
      const rawVal = extracted ? extracted.value : null;

      // Check required constraint
      if (fieldSchema.required) {
        if (rawVal === null || rawVal === undefined || (typeof rawVal === 'string' && rawVal.trim() === '')) {
          validationErrors.push({
            field: fieldName,
            code: 'MISSING_REQUIRED_FIELD',
            message: `Required field "${fieldName}" is missing or empty.`,
            receivedValue: rawVal,
          });
        }
      }

      // Check type constraint if value is present
      if (rawVal !== null && rawVal !== undefined && !(typeof rawVal === 'string' && rawVal.trim() === '')) {
        const typeError = this.validateFieldType(fieldName, rawVal, fieldSchema.type);
        if (typeError) {
          validationErrors.push(typeError);
        }
      }

      // Store in data map
      data[fieldName] = rawVal;

      // Preserve cell-level evidence
      evidence[fieldName] = {
        value: rawVal,
        supportState: extracted?.supportState ?? (rawVal === null ? 'missing' : 'supported'),
        sourceUrl: record.sourceUrl,
        sourceTitle: record.sourceTitle,
        snippet: extracted?.snippet,
        collectedAt,
        acquisitionMethod: 'gemini_extraction',
      };
    }

    return {
      recordId: record.recordId,
      sourceId: record.sourceId,
      sourceUrl: record.sourceUrl,
      sourceTitle: record.sourceTitle,
      data,
      evidence,
      isValid: validationErrors.length === 0,
      validationErrors,
    };
  }

  validateRecords(records: readonly ExtractedRecord[], fields: readonly DatasetFieldSchema[]): ValidationSummary {
    const validRecords: ValidatedRecord[] = [];
    const invalidRecords: ValidatedRecord[] = [];

    for (const record of records) {
      const validated = this.validateRecord(record, fields);
      if (validated.isValid) {
        validRecords.push(validated);
      } else {
        invalidRecords.push(validated);
      }
    }

    return {
      totalValidated: records.length,
      validCount: validRecords.length,
      invalidCount: invalidRecords.length,
      validRecords,
      invalidRecords,
    };
  }

  private validateFieldType(
    field: string,
    value: unknown,
    expectedType: DatasetFieldType
  ): ValidationErrorItem | null {
    switch (expectedType) {
      case 'string': {
        if (typeof value !== 'string') {
          return {
            field,
            code: 'INVALID_TYPE',
            message: `Expected string for field "${field}", received ${typeof value}.`,
            receivedValue: value,
          };
        }
        return null;
      }

      case 'number': {
        if (typeof value === 'number') {
          if (isNaN(value)) {
            return {
              field,
              code: 'INVALID_NUMBER',
              message: `Field "${field}" is NaN.`,
              receivedValue: value,
            };
          }
          return null;
        }
        if (typeof value === 'string') {
          // Allow cleanable numeric strings like "$1,200", "50%" or "42"
          const cleaned = value.replace(/[$,€£¥%]/g, '').trim().replace(/,/g, '');
          if (isNaN(Number(cleaned)) || cleaned.length === 0) {
            return {
              field,
              code: 'INVALID_NUMBER_FORMAT',
              message: `Field "${field}" cannot be parsed as a number: "${value}".`,
              receivedValue: value,
            };
          }
          return null;
        }
        return {
          field,
          code: 'INVALID_TYPE',
          message: `Expected number for field "${field}", received ${typeof value}.`,
          receivedValue: value,
        };
      }

      case 'boolean': {
        if (typeof value === 'boolean') return null;
        if (typeof value === 'string') {
          const lower = value.trim().toLowerCase();
          if (['true', 'false', 'yes', 'no', '1', '0'].includes(lower)) return null;
        }
        return {
          field,
          code: 'INVALID_BOOLEAN',
          message: `Field "${field}" cannot be parsed as boolean: "${value}".`,
          receivedValue: value,
        };
      }

      case 'date': {
        if (value instanceof Date && !isNaN(value.getTime())) return null;
        if (typeof value === 'string') {
          const parsed = Date.parse(value);
          if (isNaN(parsed)) {
            return {
              field,
              code: 'INVALID_DATE_FORMAT',
              message: `Field "${field}" is not a valid date: "${value}".`,
              receivedValue: value,
            };
          }
          return null;
        }
        return {
          field,
          code: 'INVALID_TYPE',
          message: `Expected date string for field "${field}", received ${typeof value}.`,
          receivedValue: value,
        };
      }

      case 'url': {
        if (typeof value !== 'string') {
          return {
            field,
            code: 'INVALID_TYPE',
            message: `Expected URL string for field "${field}", received ${typeof value}.`,
            receivedValue: value,
          };
        }
        try {
          const parsedUrl = new URL(value.trim());
          if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            return {
              field,
              code: 'INVALID_URL_SCHEME',
              message: `Field "${field}" must use http or https protocol: "${value}".`,
              receivedValue: value,
            };
          }
          return null;
        } catch {
          return {
            field,
            code: 'INVALID_URL_FORMAT',
            message: `Field "${field}" is not a valid URL: "${value}".`,
            receivedValue: value,
          };
        }
      }

      case 'email': {
        if (typeof value !== 'string') {
          return {
            field,
            code: 'INVALID_TYPE',
            message: `Expected email string for field "${field}", received ${typeof value}.`,
            receivedValue: value,
          };
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value.trim())) {
          return {
            field,
            code: 'INVALID_EMAIL_FORMAT',
            message: `Field "${field}" is not a valid email address: "${value}".`,
            receivedValue: value,
          };
        }
        return null;
      }

      case 'array': {
        if (!Array.isArray(value)) {
          return {
            field,
            code: 'INVALID_TYPE',
            message: `Expected array for field "${field}", received ${typeof value}.`,
            receivedValue: value,
          };
        }
        return null;
      }

      default:
        return null;
    }
  }
}
