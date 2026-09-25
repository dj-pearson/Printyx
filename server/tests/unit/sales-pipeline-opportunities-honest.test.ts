import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { numberOrNull } from '../../../shared/number-or-null';

/**
 * Round 189. GET /sales-pipeline/opportunities invented values its board and
 * its (newly wired) CSV export would present as a rep's own: a close date 30
 * days out, a 50% probability (and `|| 50` rewrote a real 0% as 50%), a $0
 * value, "Unknown" source, and a last activity copied from created_at. It also
 * read with a bare select, which PostgREST caps without saying so.
 */

const root = join(__dirname, '../../..');
const strip = (s: string) =>
  s
    .split('\n')
    .map((l) => l.replace(/(?<![:/])\/\/.*$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
const FN = strip(readFileSync(join(root, 'supabase/functions/sales-pipeline/index.ts'), 'utf8'));
const PAGE = strip(readFileSync(join(root, 'client/src/pages/SalesPipelineWorkflow.tsx'), 'utf8'));

const branch = (() => {
  const at = FN.indexOf("if (path === '/opportunities' && method === 'GET')");
  expect(at).toBeGreaterThan(-1);
  return FN.slice(at, FN.indexOf("if (path === '/opportunities' && method === 'POST')", at));
})();

describe('the opportunities list', () => {
  it('invents no defaults', () => {
    expect(branch).not.toMatch(/86400000\)\.toISOString\(\)/);
    expect(branch).not.toMatch(/\|\| 50/);
    expect(branch).not.toMatch(/\?\? 50/);
    expect(branch).not.toContain("'Unknown'");
    expect(branch).toMatch(/probability: numberOrNull\(row\.probability\)/);
    expect(branch).toMatch(/estimated_value: numberOrNull\(row\.estimated_deal_value\)/);
    expect(branch).toMatch(/expected_close_date: \(row\.close_date as string \| null\) \?\? null/);
    expect(branch).toMatch(/last_activity: \(row\.last_contact_date as string \| null\) \?\? null/);
  });

  it('pages instead of stopping at the row cap', () => {
    expect(branch).toMatch(/await fetchAllRows<Record<string, unknown>>\(build\)/);
    expect(branch).not.toMatch(/await query;/);
  });
});

describe('numberOrNull', () => {
  it('keeps a real zero and rejects absence and junk', () => {
    expect(numberOrNull(0)).toBe(0);
    expect(numberOrNull('0')).toBe(0);
    expect(numberOrNull('12.5')).toBe(12.5);
    expect(numberOrNull(null)).toBeNull();
    expect(numberOrNull(undefined)).toBeNull();
    expect(numberOrNull('')).toBeNull();
    expect(numberOrNull('abc')).toBeNull();
  });
});

describe('the page', () => {
  it('renders a missing probability and value as absent, not as numbers', () => {
    expect(PAGE).toMatch(/opportunity\.probability !== null\s*\?/);
    expect(PAGE).toMatch(/opportunity\.estimated_value !== null\s*\?/);
  });
  it('exports the opportunities it shows', () => {
    expect(PAGE).toMatch(
      /onClick=\{\(\) =>\s*exportToCSV\(opportunities, OPPORTUNITY_EXPORT_COLUMNS/,
    );
  });
});
