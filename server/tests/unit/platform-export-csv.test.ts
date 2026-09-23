/**
 * An export button has to produce a file (PLATFORM-EXPORT-001).
 *
 * PlatformBusinessRecords offered CSV, Excel and PDF against
 * /api/platform-crm/business-records/export, which existed on NO backend - not
 * in the edge function the prefix is proxied to, and not in Express. All three
 * 404'd in dev as well as production, and before EXPORT-DOWNLOAD-001 the 404
 * body was written to disk under a .csv name with a toast saying it had worked.
 *
 * Read with comments stripped: the notes explaining each fix quote the paths
 * and formats being asserted gone.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.cwd();
const raw = (p: string) => readFileSync(join(repo, p), 'utf8');
const code = (p: string) =>
  raw(p)
    .split('\n')
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

describe('the platform-crm export branch', () => {
  const fn = code('supabase/functions/platform-crm/index.ts');

  it('exists, and answers CSV', () => {
    expect(fn).toContain("resourceId === 'export'");
    expect(fn).toContain("'Content-Type': 'text/csv; charset=utf-8'");
    expect(fn).toContain('Content-Disposition');
  });

  it('sits ABOVE the :id branch', () => {
    // Otherwise it looks up a business record whose id is the string "export" -
    // the shape PA-020 found in the customers function.
    const exportAt = fn.indexOf("resourceId === 'export'");
    const byIdAt = fn.indexOf("endpoint === 'business-records' && resourceId && !parts[2]");
    expect(exportAt).toBeGreaterThan(-1);
    expect(byIdAt).toBeGreaterThan(-1);
    expect(exportAt).toBeLessThan(byIdAt);
  });

  it('applies the same four filters the list applies', () => {
    const branch = fn.slice(fn.indexOf("resourceId === 'export'"), fn.indexOf('text/csv'));
    for (const f of [
      "eq('status'",
      "eq('record_type'",
      "eq('lead_tier'",
      "'company_name', 'primary_contact_email'",
    ]) {
      expect(branch, f).toContain(f);
    }
  });

  it('refuses rather than truncating', () => {
    // A spreadsheet silently missing its tail is worse than no spreadsheet:
    // nothing about the file says it is partial and somebody will sum it.
    expect(fn).toContain('MAX_EXPORT_ROWS');
    expect(fn).toContain('413');
    expect(fn).toContain("count: 'exact', head: true");
  });

  it('pages past the PostgREST 1000-row cap', () => {
    expect(fn).toContain('fetchAllRows');
  });

  // ROUND 130: this pair asserts the CONSTRUCT and cannot see whether the
  // names RESOLVE - five of them did not, so the select was a 42703 on every
  // request while these stayed green. That property lives in
  // platform-record-assignment.test.ts, derived from the migration.
  it('names its columns instead of selecting *', () => {
    // An export is a published artefact; adding a column to the table should
    // not silently publish it.
    expect(fn).toContain('EXPORT_COLUMNS');
    expect(fn).toContain('EXPORT_COLUMNS.join');
  });

  it('writes an empty cell for a null, not "null" and not 0', () => {
    const cell = fn.slice(fn.indexOf('function formatCell'));
    expect(cell.slice(0, 260)).toContain("return ''");
  });
});

describe('the page offers only the format that exists', () => {
  const page = code('client/src/pages/PlatformBusinessRecords.tsx');

  it('Excel and PDF are gone from the menu', () => {
    expect(page).not.toContain('Export as Excel');
    expect(page).not.toContain('Export as PDF');
    expect(page).toContain('Export as CSV');
  });

  it('and gone from the handler signature, so nothing can call them', () => {
    expect(page).not.toContain("'csv' | 'excel' | 'pdf'");
    expect(page).not.toContain('xlsx');
  });

  it('exports the filtered set rather than the page on screen', () => {
    expect(page).toContain("exportParams.delete('page')");
    expect(page).toContain("exportParams.delete('limit')");
  });

  it('still reports a failure rather than saving it', () => {
    expect(page).toContain('downloadAuthedFile');
    expect(page).toContain("title: 'Export failed'");
  });
});

describe('the margin report export moved to the host that serves production', () => {
  const fn = code('supabase/functions/pricing/index.ts');

  it('the pricing function answers /margin-report/export', () => {
    // It was Express-only, so it worked in dev and 404'd the moment getApiUrl
    // sent /api/pricing to the functions host.
    expect(fn).toContain("resourceId === 'export'");
    expect(fn).toContain("'Content-Type': 'text/csv; charset=utf-8'");
  });

  it('shares the report branch with the JSON view', () => {
    // Two definitions of "margin" is the thing to avoid here.
    expect(fn).toContain("(!resourceId || resourceId === 'export')");
  });

  it('keeps the dealer-cost permission gate', () => {
    const branch = fn.slice(fn.indexOf("resource === 'margin-report'"));
    expect(branch.slice(0, 600)).toContain('if (!mayViewMargins)');
  });
});

describe('one CSV implementation', () => {
  it('_shared/csv.ts re-exports rather than adding a third escaper', () => {
    const shared = raw('supabase/functions/_shared/csv.ts');
    expect(shared).toContain("from './address-book/csv.ts'");
    expect(shared).not.toContain('export function');
  });

  it('and both new exports use it', () => {
    for (const f of [
      'supabase/functions/platform-crm/index.ts',
      'supabase/functions/pricing/index.ts',
    ]) {
      expect(code(f), f).toContain("from '../_shared/csv.ts'");
    }
  });
});
