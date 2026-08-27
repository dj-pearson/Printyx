/**
 * CSV parsing for the import edge function, extracted so it can be tested from
 * Node and locked against the Express implementation.
 *
 * The two hosts write the SAME rows into csv_import_jobs.raw_data — Express via
 * server/services/csv-import-service.ts parseCSVContent, this function via
 * toRowObjects — so a job started on either one can be read by the other.
 * server/tests/unit/csv-import-row-shape.test.ts asserts they agree; when they
 * did not, the edge side stored arrays of cells and its executor indexed into
 * them positionally while the Express side stored objects keyed by header.
 */

/** Split one CSV line, honouring double quotes around a field. */
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result.map((cell) => cell.replace(/^"|"$/g, ''));
}

/**
 * Rows as objects keyed by header. Blank lines and all-empty rows are dropped,
 * matching parseCSVContent; a row shorter than the header list gets '' for the
 * missing columns rather than undefined, so a mapping lookup never yields one.
 */
export function toRowObjects(headers: string[], cellRows: string[][]): Record<string, string>[] {
  return cellRows
    .filter((cells) => cells.length > 0 && cells.some((cell) => cell.trim() !== ''))
    .map((cells) => {
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = cells[index]?.trim() || '';
      });
      return row;
    });
}

/** Headers plus rows from raw CSV text. */
export function parseCsv(content: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCSVLine(lines[0]);
  return { headers, rows: toRowObjects(headers, lines.slice(1).map(parseCSVLine)) };
}

/** Mean confidence across every header, which is what the wizard displays. */
export function overallConfidence(mappings: Array<{ confidence?: number }>): number {
  if (mappings.length === 0) return 0;
  return Math.round(mappings.reduce((sum, m) => sum + (m.confidence || 0), 0) / mappings.length);
}
