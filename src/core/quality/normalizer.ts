import type { DatasetFieldSchema } from '../contracts/planner';
import type { ValidatedRecord, NormalizedRecord } from '../contracts/quality';
import type { FieldEvidence } from '../contracts/dataset';

export interface INormalizationService {
  normalizeRecord(record: ValidatedRecord, fields: readonly DatasetFieldSchema[]): NormalizedRecord;
  normalizeRecords(records: readonly ValidatedRecord[], fields: readonly DatasetFieldSchema[]): NormalizedRecord[];
}

export class RecordNormalizer implements INormalizationService {
  normalizeRecord(record: ValidatedRecord, fields: readonly DatasetFieldSchema[]): NormalizedRecord {
    const normalizedData: Record<string, unknown> = {};
    const normalizedEvidence: Record<string, FieldEvidence> = {};

    for (const fieldSchema of fields) {
      const fieldName = fieldSchema.name;
      const originalValue = record.data[fieldName];
      const existingEvidence = record.evidence[fieldName];

      if (originalValue === null || originalValue === undefined) {
        normalizedData[fieldName] = null;
        if (existingEvidence) {
          normalizedEvidence[fieldName] = {
            ...existingEvidence,
            value: null,
            supportState: 'missing',
          };
        }
        continue;
      }

      const normalizedVal = this.normalizeValue(originalValue, fieldSchema.type);
      normalizedData[fieldName] = normalizedVal;

      if (existingEvidence) {
        normalizedEvidence[fieldName] = {
          ...existingEvidence,
          value: normalizedVal,
        };
      }
    }

    return {
      recordId: record.recordId,
      sourceId: record.sourceId,
      sourceUrl: record.sourceUrl,
      sourceTitle: record.sourceTitle,
      data: normalizedData,
      evidence: normalizedEvidence,
    };
  }

  normalizeRecords(records: readonly ValidatedRecord[], fields: readonly DatasetFieldSchema[]): NormalizedRecord[] {
    return records.map((rec) => this.normalizeRecord(rec, fields));
  }

  private normalizeValue(value: unknown, type: string): unknown {
    switch (type) {
      case 'url': {
        if (typeof value !== 'string') return value;
        return this.normalizeUrl(value);
      }

      case 'email': {
        if (typeof value !== 'string') return value;
        return value.trim().toLowerCase();
      }

      case 'number': {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
          const cleaned = value.replace(/[$,€£¥%]/g, '').trim().replace(/,/g, '');
          const parsed = Number(cleaned);
          return isNaN(parsed) ? value : parsed;
        }
        return value;
      }

      case 'boolean': {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
          const lower = value.trim().toLowerCase();
          if (['true', 'yes', '1'].includes(lower)) return true;
          if (['false', 'no', '0'].includes(lower)) return false;
        }
        return value;
      }

      case 'date': {
        if (value instanceof Date) {
          const year = value.getFullYear();
          const month = String(value.getMonth() + 1).padStart(2, '0');
          const day = String(value.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
          const parsed = Date.parse(trimmed);
          if (!isNaN(parsed)) {
            const d = new Date(parsed);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          }
        }
        return value;
      }

      case 'string': {
        if (typeof value !== 'string') return value;
        // Trim and collapse excessive internal whitespace (spaces, tabs, newlines)
        return value.trim().replace(/\s+/g, ' ');
      }

      case 'array': {
        if (!Array.isArray(value)) return value;
        // Trim string elements, remove empty, and deduplicate
        const uniqueSet = new Set<unknown>();
        for (const item of value) {
          if (typeof item === 'string') {
            const cleaned = item.trim();
            if (cleaned.length > 0) uniqueSet.add(cleaned);
          } else if (item !== null && item !== undefined) {
            uniqueSet.add(item);
          }
        }
        return Array.from(uniqueSet);
      }

      default:
        return value;
    }
  }

  /**
   * Normalizes a URL:
   * 1. Trims whitespace
   * 2. Lowercases scheme and host
   * 3. Removes standard tracking parameters (utm_*, ref, fbclid, etc.)
   * 4. Strips default port numbers (80 for http, 443 for https)
   * 5. Strips trailing slashes from path (except root /)
   */
  private normalizeUrl(rawUrl: string): string {
    const trimmed = rawUrl.trim();
    try {
      const parsed = new URL(trimmed);
      parsed.protocol = parsed.protocol.toLowerCase();
      parsed.hostname = parsed.hostname.toLowerCase();

      // Remove default ports
      if (
        (parsed.protocol === 'http:' && parsed.port === '80') ||
        (parsed.protocol === 'https:' && parsed.port === '443')
      ) {
        parsed.port = '';
      }

      // Remove tracking query params
      const trackingParams = [
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_term',
        'utm_content',
        'ref',
        'ref_src',
        'fbclid',
        'gclid',
        'mc_eid',
      ];

      for (const param of trackingParams) {
        parsed.searchParams.delete(param);
      }

      let pathname = parsed.pathname;
      if (pathname.length > 1 && pathname.endsWith('/')) {
        pathname = pathname.slice(0, -1);
      }
      parsed.pathname = pathname;

      return parsed.toString();
    } catch {
      return trimmed;
    }
  }
}
