/**
 * QUOTE-017's recurring-line columns exist (AUDIT-035 follow-up).
 *
 * 0000 created discount, is_recurring, recurring_frequency and
 * recurring_duration on proposal_line_items. 0002 dropped all four. 0047
 * restored `discount` by hand when the quote builder started writing it; nobody
 * restored the other three, so every recurring line hit a column that does not
 * exist.
 *
 * It did not surface as an error. The proposals edge function catches PGRST204
 * and retries with CORE_LINE_ITEM_COLUMNS only, so the line persisted with its
 * recurrence stripped - a monthly charge saved as a one-time amount, with a
 * warning in the log and a wrong number on the quote.
 *
 * What hid it structurally: shared/drizzle-schema.ts is the single entry point
 * drizzle-kit reads, and it SKIPS quote-proposal-schema's proposalLineItems
 * because schema.ts declares the same table. The declaration drizzle diffs was
 * the one without these columns, so no migration could ever be generated for
 * them - and check:dup-tables could not report the collision because it excluded
 * schema.ts from its scan.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

describe('the declaration drizzle-kit reads carries the columns the code writes', () => {
  const schema = read('shared/schema.ts');
  const at = schema.indexOf('export const proposalLineItems = pgTable(');
  const decl = schema.slice(at, at + 4000);

  it('declares all four', () => {
    expect(at).toBeGreaterThan(-1);
    for (const col of ['discount', 'is_recurring', 'recurring_frequency', 'recurring_duration']) {
      expect(decl, col).toContain(`'${col}'`);
    }
  });

  it('is the one drizzle-schema.ts actually exports', () => {
    // The other declaration is skipped by name. Adding columns to the skipped
    // one would change nothing about what any database contains.
    const entry = read('shared/drizzle-schema.ts');
    expect(entry).toMatch(/proposalLineItems — SKIPPED: defined in schema\.ts/);
  });
});

describe('the migration restores them without breaking a database that has some', () => {
  const sql = read('drizzle/migrations/0064_warm_longshot.sql');

  it('adds all four idempotently', () => {
    // Real databases already have `discount` from 0047, so a plain ADD would
    // fail on exactly the databases that matter.
    for (const col of ['discount', 'is_recurring', 'recurring_frequency', 'recurring_duration']) {
      expect(sql, col).toMatch(new RegExp(`ADD COLUMN IF NOT EXISTS "${col}"`));
    }
    expect(sql).not.toMatch(/ADD COLUMN "\w+"/);
  });

  it('guards on the table existing, like 0046 and 0047', () => {
    expect(sql).toMatch(/information_schema\.tables/);
    expect(sql).toMatch(/table_name = 'proposal_line_items'/);
  });

  it('is journaled as the last entry', () => {
    const journal = JSON.parse(read('drizzle/migrations/meta/_journal.json'));
    const last = [...journal.entries].sort((a: any, b: any) => a.idx - b.idx).pop();
    expect(last.tag).toBe('0064_warm_longshot');
  });
});

describe('the quote code depends on all three recurring columns', () => {
  it('maps them in the proposals edge function', () => {
    const fn = read('supabase/functions/proposals/index.ts');
    expect(fn).toMatch(/isRecurring: 'is_recurring'/);
    expect(fn).toMatch(/recurringFrequency: 'recurring_frequency'/);
  });

  it('none of them is in the core set the PGRST204 retry keeps', () => {
    // Which is why the retry silently dropped the recurrence rather than
    // failing the write.
    const fn = read('supabase/functions/proposals/index.ts');
    const at = fn.indexOf('const CORE_LINE_ITEM_COLUMNS = [');
    const core = fn.slice(at, fn.indexOf('];', at));
    expect(at).toBeGreaterThan(-1);
    for (const col of ['is_recurring', 'recurring_frequency', 'recurring_duration']) {
      expect(core, col).not.toContain(col);
    }
  });
});
