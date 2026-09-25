/**
 * A bulk write reports what the database did, never what the caller asked for
 * (round 132).
 *
 * Five endpoints across both hosts answered `deletedCount: ids.length`. Each
 * filters by tenant_id, so an id from another tenant - or one a colleague
 * removed thirty seconds earlier - matched nothing and the response still said
 * every selected row was gone. `blog-paa-miner` wrote that number into the
 * AUDIT LOG, where an operator reading "cleared 40 keywords" has no way to
 * discover that twelve went.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { summariseBulkWrite } from '@shared/bulk-result';
import {
  MIN_CORPUS,
  findFabricatedCounts,
  scan,
  sourceFiles,
  stripComments,
} from '../../../scripts/check-bulk-write-counts.mjs';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

describe('summariseBulkWrite states what happened', () => {
  it('a complete write names the count and nothing else', () => {
    const out = summariseBulkWrite(['a', 'b'], ['a', 'b'], 'invoice', 'deleted');
    expect(out).toEqual({
      affectedCount: 2,
      notFound: [],
      complete: true,
      message: 'Deleted 2 invoices',
    });
  });

  it('a partial write NAMES what it could not reach', () => {
    // "17 of 20" is not actionable; which three is.
    const out = summariseBulkWrite(['a', 'b', 'c'], ['a'], 'invoice', 'deleted');
    expect(out.affectedCount).toBe(1);
    expect(out.notFound).toEqual(['b', 'c']);
    expect(out.complete).toBe(false);
    expect(out.message).toContain('1 of 3');
    expect(out.message).toContain('2 no longer exist');
  });

  it('a write that reached nothing says so rather than reporting success', () => {
    const out = summariseBulkWrite(['a'], [], 'deal', 'deleted');
    expect(out.affectedCount).toBe(0);
    expect(out.complete).toBe(false);
    expect(out.message).toMatch(/^Deleted 0 of 1 deal/);
  });

  it('duplicate ids in the request cannot inflate the count', () => {
    const out = summariseBulkWrite(['a', 'a', 'a'], ['a'], 'deal', 'deleted');
    expect(out.affectedCount).toBe(1);
    expect(out.complete).toBe(true);
  });

  it('an id the write returns that was never asked for does not raise the count', () => {
    // The count is bounded by the request, so a driver that echoes extra rows
    // cannot make the response claim more than the caller selected.
    const out = summariseBulkWrite(['a'], ['a', 'zzz'], 'deal', 'deleted');
    expect(out.affectedCount).toBe(1);
  });

  it('singular and plural read correctly', () => {
    expect(summariseBulkWrite(['a'], ['a'], 'invoice', 'deleted').message).toBe(
      'Deleted 1 invoice',
    );
    expect(summariseBulkWrite(['a', 'b'], ['a', 'b'], 'invoice', 'updated').message).toBe(
      'Updated 2 invoices',
    );
  });
});

describe('the guard measures the tree it claims to measure', () => {
  it('walks both hosts', () => {
    const files = sourceFiles();
    expect(files.length).toBeGreaterThan(MIN_CORPUS);
    expect(files.some((f: string) => f.startsWith('server/'))).toBe(true);
    expect(files.some((f: string) => f.startsWith('supabase/functions/'))).toBe(true);
  });

  it('its floor is meaningful', () => {
    expect(MIN_CORPUS).toBeGreaterThan(50);
    expect(MIN_CORPUS).toBeLessThan(sourceFiles().length);
  });

  it('nothing in the tree reports a count taken from the request', () => {
    expect(scan().findings).toEqual([]);
  });
});

describe('the rule separates a measured count from a fabricated one', () => {
  it('REJECTS a count taken from the request', () => {
    const hits = findFabricatedCounts(`res.json({ deletedCount: parsed.data.ids.length });`);
    expect(hits).toHaveLength(1);
    expect(hits[0].key).toBe('deletedCount');
  });

  it('REJECTS the batch spelling a progress tracker uses', () => {
    expect(findFabricatedCounts(`return { deleted: batch.length };`)).toHaveLength(1);
  });

  it('ACCEPTS a count taken from what the write returned', () => {
    expect(findFabricatedCounts(`res.json({ deletedCount: deleted.length });`)).toEqual([]);
    expect(
      findFabricatedCounts(`return createCorsResponse({ deleted: outcome.affectedCount });`),
    ).toEqual([]);
  });

  it('a count in a COMMENT is not a finding', () => {
    expect(findFabricatedCounts(`// deletedCount: ids.length was the defect\nok();`)).toEqual([]);
  });

  it('reads the whole value, not the first comma it meets', () => {
    // A rule that stopped at the first comma regardless of nesting would read
    // `Math.min(total` here and clear a count that is still the request. The
    // earlier fixture (`pick(ids.length, 0)`) cannot separate the two, because
    // the truncated value still carries `ids.length`.
    expect(
      findFabricatedCounts(`res.json({ deletedCount: Math.min(total, ids.length), ok: true });`),
    ).toHaveLength(1);
    expect(
      findFabricatedCounts(`res.json({ deletedCount: pick(ids.length, 0), ok: true });`),
    ).toHaveLength(1);
  });
});

describe('every bulk write in the tree takes its count from the result', () => {
  const cases: [string, string][] = [
    // Round 173 deleted the invoice pair here (/api/invoices is proxied); the
    // equipment bulk writes in the same file carry the property now.
    ['server/routes-bulk-operations.ts', 'returning({ id: equipment.id })'],
    ['server/routes-crm-bulk.ts', 'returning({ id: deals.id })'],
    ['supabase/functions/invoices/index.ts', "select('id')"],
    ['supabase/functions/deals/index.ts', "select('id')"],
    ['supabase/functions/blog-paa-miner/index.ts', "select('id')"],
  ];

  it.each(cases)('%s asks the write what it touched', (file, marker) => {
    expect(read(file)).toContain(marker);
  });

  it.each(cases.map(([f]) => f))('%s summarises through the shared module', (file) => {
    expect(read(file)).toContain('summariseBulkWrite');
  });

  it('both hosts import the SAME module, so they cannot drift', () => {
    expect(read('server/routes-bulk-operations.ts')).toContain("from '@shared/bulk-result'");
    expect(read('supabase/functions/invoices/index.ts')).toContain(
      "from '../../../shared/bulk-result.ts'",
    );
  });

  it('the audit entry records the measured count, not the request', () => {
    // An audit log is the one place a wrong number outlives the toast.
    const src = stripComments(read('supabase/functions/blog-paa-miner/index.ts'));
    expect(src).toContain('deleted_count: outcome.affectedCount');
    expect(src).not.toMatch(/deleted_count:\s*ids\.length/);
  });
});

describe('the Invoices page reports the number the server measured', () => {
  const page = () => stripComments(read('client/src/pages/Invoices.tsx'));

  it('the bulk-delete action counts the response, not the batch', () => {
    const src = page();
    expect(src).toContain('result?.deletedCount ?? 0');
    expect(src).toMatch(/failed:\s*batch\.length - succeeded/);
    expect(src).not.toMatch(/succeeded:\s*batch\.length,\s*failed:\s*0/);
  });

  it('the second delete path is gone, so there is one', () => {
    // It was never called - eslint reported it only as an unused variable,
    // which reads like a tidy-up rather than a duplicate destructive action.
    expect(page()).not.toContain('bulkDeleteMutation');
  });
});

describe('the guard is wired where it runs', () => {
  it('has an npm script and a CI step', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.scripts['check:bulk-write-counts']).toBe('node scripts/check-bulk-write-counts.mjs');
    expect(read('.github/workflows/ci.yml')).toContain('npm run check:bulk-write-counts');
  });

  it('importing the module does not run the walk', () => {
    const src = read('scripts/check-bulk-write-counts.mjs');
    expect(src).toContain('const isEntryPoint =');
    expect(src).not.toContain('import.meta.main');
  });
});
