/**
 * check:phantom-cols resolves a table declared twice, instead of skipping it
 * (AUDIT-037).
 *
 * The guard used to skip any table with two different column signatures, on the
 * reasoning that it could not tell which shape was live. It can:
 * shared/drizzle-schema.ts is the single entry point drizzle-kit reads and it
 * resolves every collision by hand, so whatever it exports is the shape the
 * migrations were generated against.
 *
 * Closing that skip surfaced 128 references that were already broken - a 42703
 * each the moment their code path runs - including the whole purchase-order
 * workflow and 95 in the US-BLOG subsystem. Two more were found by hand first,
 * one at a time, before anyone asked why the guard had never mentioned them.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const guard = read('scripts/check-phantom-columns.ts');

describe('the guard resolves rather than skips', () => {
  it('loads the entry point drizzle-kit reads', () => {
    expect(guard).toMatch(/'shared', 'drizzle-schema\.ts'/);
    expect(guard).toMatch(/const resolvedTables = new Set<string>\(\)/);
  });

  it("takes the entry point's shape outright, not the union", () => {
    // The per-file pass merges both declarations' columns, which would let a
    // reference to the losing shape pass.
    expect(guard).toMatch(/tableColumns\.set\(cfg\.name, new Set\(cfg\.columns\.map/);
  });

  it('still skips a table the entry point does not export', () => {
    expect(guard).toMatch(/if \(!resolvedTables\.has\(name\)\) tableColumns\.delete\(name\)/);
  });

  it('reports zero ambiguous tables now', () => {
    const out = execFileSync('npx', ['tsx', join(repo, 'scripts/check-phantom-columns.ts')], {
      encoding: 'utf8',
      cwd: repo,
    });
    expect(out).toMatch(/0 declared twice with different shapes/);
  });
});

describe('the baseline says why it grew', () => {
  const baseline = JSON.parse(read('docs/phantom-columns-baseline.json'));

  it('keeps that prose in the script, so a regeneration cannot drop it', () => {
    // It was lost twice to --update-baseline before anyone noticed.
    expect(read('scripts/check-phantom-columns.ts')).toMatch(/const BASELINE_NOTE = \[/);
    expect(baseline.note).toMatch(/AUDIT-037 carries the backlog/);
  });

  it('records that the additions were already broken', () => {
    expect(baseline.note).toMatch(/152 -> 280/);
    expect(baseline.note).toMatch(/tables declared twice with different shapes/);
    expect(baseline.note).toMatch(/purchase-order cluster/);
  });

  it('forbids shrinking it by re-widening the skip', () => {
    // That is what hid all of this, and it would look like progress.
    expect(baseline.note).toMatch(/never by re-widening a skip/i);
  });

  it('holds the clusters the story names', () => {
    const all = JSON.stringify(baseline.allowed);
    expect(all).toMatch(/purchase_orders\.submitted_by/);
    expect(all).toMatch(/proposal_comments\.comment/);
    expect(all).toMatch(/tasks\.parent_task_id/);
  });
});
