/**
 * Running a catalog CSV import on the Express side (PROD-014).
 *
 * Seven near-identical handlers lived in routes-products-crud.ts, each with its
 * own CSV parse, its own header spellings and its own column mapping — which is
 * how three of them ended up writing columns that do not exist, and how two of
 * them ('professional-services' and 'service-products') were never implemented
 * at all: they returned `imported: 0` with "not yet implemented" and the UI
 * reported a successful import of nothing.
 *
 * One runner over the shared spec in @shared/catalog-import replaces all seven,
 * so both backends import the same file the same way.
 */

import { sql } from 'drizzle-orm';
import { db } from '../db';
import {
  CATALOG_IMPORT_SPECS,
  parseCsv,
  validateRow,
  type ImportSpec,
} from '@shared/catalog-import';
import { createModuleLogger } from './logger';

const log = createModuleLogger('catalog-import');

export interface ImportOutcome {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
}

/** Values identifying an existing row, for the duplicate check. */
function dedupeValues(spec: ImportSpec, data: Record<string, unknown>): unknown[] {
  return spec.dedupeBy.map((column) => data[column] ?? null);
}

async function rowExists(
  spec: ImportSpec,
  tenantId: string,
  data: Record<string, unknown>,
): Promise<boolean> {
  const values = dedupeValues(spec, data);
  // A dedupe key with a missing part cannot match anything meaningfully; treat
  // it as new rather than as a duplicate of every incomplete row.
  if (values.some((v) => v === null || v === undefined || v === '')) return false;

  let condition = sql`${sql.identifier('tenant_id')} = ${tenantId}`;
  spec.dedupeBy.forEach((column, i) => {
    condition = sql`${condition} AND ${sql.identifier(column)} = ${values[i]}`;
  });

  const result = await db.execute(
    sql`SELECT 1 FROM ${sql.identifier(spec.table)} WHERE ${condition} LIMIT 1`,
  );
  return (result as unknown as { rows?: unknown[] }).rows?.length
    ? true
    : Array.isArray(result) && result.length > 0;
}

async function insertRow(
  spec: ImportSpec,
  tenantId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const payload: Record<string, unknown> = { tenant_id: tenantId, ...data };
  const columns = Object.keys(payload);

  // Identifiers come from the spec, never from the CSV; values are bound.
  const columnList = sql.join(
    columns.map((c) => sql`${sql.identifier(c)}`),
    sql`, `,
  );
  const valueList = sql.join(
    columns.map((c) => sql`${payload[c]}`),
    sql`, `,
  );

  await db.execute(
    sql`INSERT INTO ${sql.identifier(spec.table)} (${columnList}) VALUES (${valueList})`,
  );
}

/**
 * Import a CSV for one product type.
 *
 * Row numbers in errors are 1-based over the FILE, so row 2 is the first data
 * row — which is what a person looking at the spreadsheet sees.
 */
export async function importCatalogCsv(
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
      if (await rowExists(spec, tenantId, validation.data)) {
        skipped++;
        continue;
      }
      await insertRow(spec, tenantId, validation.data);
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

  if (errors.length)
    log.warn({ type, imported, skipped, errors: errors.length }, 'import finished with errors');

  return { success: errors.length === 0, imported, skipped, errors };
}
