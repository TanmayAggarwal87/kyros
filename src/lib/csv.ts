import type { DatasetRecord, DatasetFieldSchema } from '@/core/contracts';

/**
 * Sanitizes a single cell value for CSV output.
 * Prevents CSV formula injection (DDE) by neutralizing leading =, +, -, @ characters.
 * Quotes values containing commas, quotes, or newlines.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  let str = '';
  if (typeof value === 'object') {
    str = JSON.stringify(value);
  } else {
    str = String(value);
  }

  // Prevent formula injection
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape double quotes and enclose in quotes if needed
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export interface CsvExportOptions {
  readonly includeEvidenceUrls?: boolean;
  readonly includeSupportStates?: boolean;
}

/**
 * Converts a dataset record array and field schemas into a standardized CSV string.
 */
export function generateDatasetCsv(
  records: readonly DatasetRecord[],
  fields: readonly DatasetFieldSchema[],
  options: CsvExportOptions = {}
): string {
  const headers: string[] = ['record_id'];

  for (const field of fields) {
    headers.push(field.name);
    if (options.includeSupportStates) {
      headers.push(`${field.name}__support_state`);
    }
    if (options.includeEvidenceUrls) {
      headers.push(`${field.name}__source_url`);
    }
  }

  const rows: string[] = [headers.map(sanitizeCsvCell).join(',')];

  for (const record of records) {
    const rowCells: string[] = [record.id];

    for (const field of fields) {
      const val = record.data[field.name];
      rowCells.push(sanitizeCsvCell(val));

      const evidence = record.evidence[field.name];
      if (options.includeSupportStates) {
        rowCells.push(sanitizeCsvCell(evidence?.supportState ?? 'missing'));
      }
      if (options.includeEvidenceUrls) {
        rowCells.push(sanitizeCsvCell(evidence?.sourceUrl ?? ''));
      }
    }

    rows.push(rowCells.join(','));
  }

  return rows.join('\r\n');
}
