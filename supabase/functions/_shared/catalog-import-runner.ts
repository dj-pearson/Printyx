/**
 * Running a catalog CSV import on the edge side (PROD-014).
 *
 * /api/<type>/import existed only on Express, so bulk catalog import 404'd in
 * production for every product type. This is the Deno half; the specs, the CSV
 * parser and the row validation are shared with the client and Express through
 * _shared/catalog-import.ts, so the same file imports the same way on either
 * backend.
 *
 * The upload is multipart. Deno's Request.formData() handles that natively —
 * there is no multer here and none is needed.
 */

import { CATALOG_IMPORT_SPECS, parseCsv, validateRow } from './catalog-import.ts';

export interface ImportOutcome {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
}

/** Read the uploaded CSV out of a multipart body. Returns null if absent. */
export async function readUploadedCsv(req: Request): Promise<string | null> {
  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    // A few callers post the text directly; accept that rather than failing on
    // a technicality.
    const body = await req.text();
    return body.trim() ? body : null;
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!file) return null;
  if (typeof file === 'string') return file.trim() ? file : null;
  const text = await (file as File).text();
  return text.trim() ? text : null;
}

/**
 * Import a CSV for one product type.
 *
 * Row numbers in errors are 1-based over the FILE, so row 2 is the first data
 * row — what a person looking at the spreadsheet sees. Matches the Express
 * runner exactly.
 */
export async function importCatalogCsv(
  admin: {
    from: (table: string) => any;
  },
  type: string,
  tenantId: string,
  csvText: string,
): Promise<ImportOutcome> {
  const spec = CATALOG_IMPORT_SPECS[type];
  if (!spec) {
    return { success: false, imported: 0, skipped: 0, errors: [`Unknown product type: ${type}`] };
  }

  const rows = parseCsv(csvText);
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const validation = validateRow(type, rows[i]);
    if (!validation.isValid) {
      errors.push(`Row ${i + 2}: ${validation.errors.join(', ')}`);
      skipped++;
      continue;
    }

    try {
      const keyValues = spec.dedupeBy.map((column) => validation.data[column]);
      // An incomplete dedupe key cannot match meaningfully; treat the row as
      // new rather than as a duplicate of every other incomplete row.
      const keyComplete = keyValues.every((v) => v !== null && v !== undefined && v !== '');

      if (keyComplete) {
        let query = admin.from(spec.table).select('id').eq('tenant_id', tenantId).limit(1);
        spec.dedupeBy.forEach((column, idx) => {
          query = query.eq(column, keyValues[idx]);
        });
        const { data: existing } = await query;
        if (existing && existing.length > 0) {
          skipped++;
          continue;
        }
      }

      const { error } = await admin
        .from(spec.table)
        .insert({ tenant_id: tenantId, ...validation.data });

      if (error) {
        errors.push(`Row ${i + 2}: Failed to import - ${error.message}`);
        skipped++;
        continue;
      }
      imported++;
    } catch (error) {
      errors.push(
        `Row ${i + 2}: Failed to import - ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      skipped++;
    }
  }

  return { success: errors.length === 0, imported, skipped, errors };
}
