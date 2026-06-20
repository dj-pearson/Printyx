/**
 * Minimal RFC 4180-style CSV parser + serializer shared by every vendor
 * address-book adapter (ABK-004..012).
 *
 * Intentionally dependency-free and runtime-portable (Node + Deno): it only
 * uses standard JS string operations so the same logic can back both the
 * Express service layer and the Supabase edge function.
 */

export interface CsvParseOptions {
  /** Field delimiter. Defaults to ','. */
  delimiter?: string;
}

/**
 * Parse CSV text into an array of records (each record an array of string
 * fields). Handles quoted fields, escaped quotes (""), embedded newlines, and
 * both \n and \r\n line endings. Empty lines are preserved as a single-empty
 * field record so callers that care about comment/blank lines can inspect them.
 */
export function parseCsv(text: string, options: CsvParseOptions = {}): string[][] {
  const delimiter = options.delimiter ?? ',';
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  const pushField = () => {
    record.push(field);
    field = '';
  };
  const pushRecord = () => {
    pushField();
    records.push(record);
    record = [];
  };

  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === delimiter) {
      pushField();
      i += 1;
      continue;
    }
    if (ch === '\r') {
      // swallow \r; \n (if present) handles the record break
      if (text[i + 1] === '\n') {
        pushRecord();
        i += 2;
        continue;
      }
      pushRecord();
      i += 1;
      continue;
    }
    if (ch === '\n') {
      pushRecord();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }

  // flush trailing field/record (file not ending in newline)
  if (field.length > 0 || record.length > 0) {
    pushRecord();
  }
  return records;
}

/** Quote a single CSV field if it contains a delimiter, quote, or newline. */
export function csvEscape(value: string, delimiter = ','): string {
  if (value === '') return '';
  if (
    value.includes(delimiter) ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r')
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Serialize records back to CSV text with CRLF line endings (printer-friendly). */
export function toCsv(records: string[][], options: CsvParseOptions = {}): string {
  const delimiter = options.delimiter ?? ',';
  return records
    .map((record) => record.map((f) => csvEscape(f ?? '', delimiter)).join(delimiter))
    .join('\r\n');
}

/**
 * Build a header-keyed row reader. Given a header record, returns a function
 * that maps a data record to a { header: value } object, tolerant of ragged
 * rows (missing trailing columns read as '').
 */
export function rowMapper(header: string[]): (record: string[]) => Record<string, string> {
  const keys = header.map((h) => h.trim());
  return (record: string[]) => {
    const out: Record<string, string> = {};
    keys.forEach((key, idx) => {
      out[key] = record[idx] ?? '';
    });
    return out;
  };
}
