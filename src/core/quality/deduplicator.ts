import type { DatasetFieldSchema } from '../contracts/planner';
import type { NormalizedRecord, DeduplicationResult, DeduplicationDecision } from '../contracts/quality';
import type { DatasetRecord, FieldEvidence, SupportState } from '../contracts/dataset';

export interface IDeduplicationService {
  deduplicate(
    records: readonly NormalizedRecord[],
    fields: readonly DatasetFieldSchema[],
    context: { workflowId: string; runId: string }
  ): DeduplicationResult;
}

const SUPPORT_STATE_RANK: Record<SupportState, number> = {
  supported: 4,
  partially_supported: 3,
  inferred: 2,
  conflicting: 1,
  missing: 0,
};

export class RecordDeduplicator implements IDeduplicationService {
  deduplicate(
    records: readonly NormalizedRecord[],
    fields: readonly DatasetFieldSchema[],
    context: { workflowId: string; runId: string }
  ): DeduplicationResult {
    if (records.length === 0) {
      return {
        records: [],
        duplicateDecisions: [],
        stats: { totalInput: 0, uniqueCount: 0, duplicatesRemoved: 0 },
      };
    }

    const decisions: DeduplicationDecision[] = [];
    const groups = new Map<string, NormalizedRecord[]>();
    const identityFieldNames = this.identifyKeyFields(fields);

    // 1. Group records by deterministic identity key
    for (const record of records) {
      const key = this.generateEntityKey(record, identityFieldNames);
      const existing = groups.get(key);
      if (existing) {
        existing.push(record);
      } else {
        groups.set(key, [record]);
      }
    }

    // 2. Merge each group into a single consolidated DatasetRecord
    const now = new Date().toISOString();
    const finalRecords: DatasetRecord[] = [];
    let duplicatesRemoved = 0;

    for (const [matchKey, groupRecords] of groups.entries()) {
      if (groupRecords.length === 1) {
        const single = groupRecords[0];
        finalRecords.push({
          id: single.recordId,
          workflowId: context.workflowId,
          runId: context.runId,
          data: single.data,
          evidence: single.evidence,
          createdAt: now,
          updatedAt: now,
        });
      } else {
        // Multiple duplicate records found -> merge them
        const { mergedRecord, decision } = this.mergeDuplicateGroup(groupRecords, matchKey, fields, context, now);
        finalRecords.push(mergedRecord);
        decisions.push(decision);
        duplicatesRemoved += groupRecords.length - 1;
      }
    }

    return {
      records: finalRecords,
      duplicateDecisions: decisions,
      stats: {
        totalInput: records.length,
        uniqueCount: finalRecords.length,
        duplicatesRemoved,
      },
    };
  }

  private identifyKeyFields(fields: readonly DatasetFieldSchema[]): string[] {
    const priorityKeywords = [
      'url',
      'website',
      'domain',
      'email',
      'company_name',
      'company',
      'name',
      'title',
      'id',
    ];

    const matched: string[] = [];
    for (const keyword of priorityKeywords) {
      for (const field of fields) {
        const lower = field.name.toLowerCase();
        if (lower === keyword || lower.includes(keyword)) {
          if (!matched.includes(field.name)) {
            matched.push(field.name);
          }
        }
      }
    }
    return matched;
  }

  private generateEntityKey(record: NormalizedRecord, identityFieldNames: string[]): string {
    // 1. Try URL / website / domain
    for (const fieldName of identityFieldNames) {
      const val = record.data[fieldName];
      if (typeof val === 'string' && val.trim().length > 0) {
        const lowerField = fieldName.toLowerCase();
        if (lowerField.includes('url') || lowerField.includes('website') || lowerField.includes('domain')) {
          const domain = this.extractCleanDomain(val);
          if (domain) return `url:${domain}`;
        }
        if (lowerField.includes('email')) {
          return `email:${val.trim().toLowerCase()}`;
        }
        if (lowerField.includes('name') || lowerField.includes('company') || lowerField.includes('title')) {
          const cleanName = this.cleanEntityName(val);
          if (cleanName.length > 0) return `name:${cleanName}`;
        }
      }
    }

    // 2. Fallback to record's sourceUrl if present
    if (record.sourceUrl) {
      const domain = this.extractCleanDomain(record.sourceUrl);
      if (domain) return `src-url:${domain}`;
    }

    // 3. Fallback to unique recordId if no identity key could be extracted
    return `id:${record.recordId}`;
  }

  private extractCleanDomain(urlOrDomain: string): string | null {
    try {
      let candidate = urlOrDomain.trim();
      if (!candidate.startsWith('http://') && !candidate.startsWith('https://')) {
        candidate = `https://${candidate}`;
      }
      const parsed = new URL(candidate);
      return parsed.hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      return null;
    }
  }

  private cleanEntityName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\b(inc|incorporated|llc|ltd|limited|corp|corporation|gmbh|co|technologies|tech)\b/g, '')
      .trim()
      .replace(/\s+/g, ' ');
  }

  private mergeDuplicateGroup(
    group: NormalizedRecord[],
    matchKey: string,
    fields: readonly DatasetFieldSchema[],
    context: { workflowId: string; runId: string },
    now: string
  ): { mergedRecord: DatasetRecord; decision: DeduplicationDecision } {
    // Pick the primary record with the highest count of non-null fields
    let primaryRecord = group[0];
    let maxFilledFields = -1;

    for (const rec of group) {
      const filledCount = Object.values(rec.data).filter((v) => v !== null && v !== undefined).length;
      if (filledCount > maxFilledFields) {
        maxFilledFields = filledCount;
        primaryRecord = rec;
      }
    }

    const mergedData: Record<string, unknown> = { ...primaryRecord.data };
    const mergedEvidence: Record<string, FieldEvidence> = { ...primaryRecord.evidence };

    for (const secondary of group) {
      if (secondary === primaryRecord) continue;

      for (const field of fields) {
        const fieldName = field.name;
        const currentVal = mergedData[fieldName];
        const secondaryVal = secondary.data[fieldName];
        const currentEv = mergedEvidence[fieldName];
        const secondaryEv = secondary.evidence[fieldName];

        // Fill missing values in primary from secondary
        if ((currentVal === null || currentVal === undefined) && secondaryVal !== null && secondaryVal !== undefined) {
          mergedData[fieldName] = secondaryVal;
          if (secondaryEv) {
            mergedEvidence[fieldName] = secondaryEv;
          }
        } else if (currentEv && secondaryEv) {
          // Both have values: pick evidence with higher support state rank
          const currentRank = SUPPORT_STATE_RANK[currentEv.supportState] ?? 0;
          const secondaryRank = SUPPORT_STATE_RANK[secondaryEv.supportState] ?? 0;

          if (secondaryRank > currentRank) {
            mergedEvidence[fieldName] = secondaryEv;
            mergedData[fieldName] = secondaryVal;
          }
        }
      }
    }

    const duplicateIds = group.map((r) => r.recordId).filter((id) => id !== primaryRecord.recordId);

    const decision: DeduplicationDecision = {
      primaryRecordId: primaryRecord.recordId,
      mergedRecordIds: duplicateIds,
      matchKey,
      reason: `Consolidated ${group.length} records matching identity key "${matchKey}".`,
    };

    const mergedRecord: DatasetRecord = {
      id: primaryRecord.recordId,
      workflowId: context.workflowId,
      runId: context.runId,
      data: mergedData,
      evidence: mergedEvidence,
      createdAt: now,
      updatedAt: now,
    };

    return { mergedRecord, decision };
  }
}
