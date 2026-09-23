/**
 * A write that reports success and saves nothing (AUDIT-038).
 *
 * PostgREST does not throw. `await admin.from('t').insert(row)` resolves to
 * `{ data, error }` whether the row landed or the table does not exist, so a
 * handler that never reads `error` carries on and answers 200. Three instances
 * turned up in two days, each found by reading one file for another reason -
 * which is the argument for a guard rather than for three more fixes.
 *
 * These tests pin the six fixes and the rule's two documented false-positive
 * classes. Both classes came out of hand-sampling the first cut (AC4), and
 * neither was visible in the count: 41 of 112 findings were a result bound to a
 * plain identifier and tested one line later, and the builder-then-await shape
 * in deals/index.ts was a fourth.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const code = (p: string) =>
  read(p)
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

describe('proposal acceptance no longer loses the deal and the contract', () => {
  const src = code('supabase/functions/proposals/index.ts');

  it('surfaces a failed deal insert instead of returning null', () => {
    // `return created?.id ?? null` on a failed insert is indistinguishable from
    // a proposal that deliberately creates no deal.
    expect(src).toContain('error: createError');
    expect(src).toContain('throw createError');
  });

  it('surfaces a failed contract insert', () => {
    // A null contractId skipped the lease planning below it, so a financed deal
    // silently became a cash sale - the failure WF-C-05 exists to prevent.
    expect(src).toContain('error: contractError');
    expect(src).toContain('throw contractError');
  });
});

describe('sending an invoice reports what actually happened', () => {
  const src = code('supabase/functions/billing/handlers/invoices.ts');

  it('does not answer "sent successfully" when the status update failed', () => {
    expect(src).toContain('error: statusError');
    expect(src).toContain('PARTIAL_DB_ERROR');
    // The email has already gone out, so this is a 207, not a 500: reporting
    // total failure would invite a resend and the customer gets two copies.
    expect(src).toMatch(/statusError[\s\S]{0,600}?207/);
  });
});

describe('scheduling maintenance does not invent an id', () => {
  const src = code('supabase/functions/cross-module/index.ts');

  it('refuses rather than falling back to the ticket number it just made up', () => {
    // maintenanceId fell back to `ticketNumber`, a `MAINT-${Date.now()}` string
    // generated in the handler, so a caller storing that id held a reference to
    // a ticket that does not exist.
    expect(src).not.toContain('ticket?.id || ticketNumber');
    expect(src).toContain('if (ticketError || !ticket?.id)');
  });
});

describe('a try/catch around a PostgREST call is evidence of nothing', () => {
  const src = code('supabase/functions/public-booking/index.ts');

  it('reads the calendar_events error rather than relying on the catch', () => {
    // The catch can only fire on a network fault. Best-effort is still correct
    // here - a booking must not fail because the calendar did - but the failure
    // is recorded now instead of vanishing.
    expect(src).toContain('error: evError');
    expect(src).toContain('if (evError)');
  });
});

describe('the predictive sweep logs a ticket it could not create', () => {
  const src = code('supabase/functions/predictive-failure/index.ts');

  // Round 207: the ticket is created on approval now, not in the sweep. The
  // property is unchanged - a failed insert is surfaced, never read as
  // "nothing to create" - and a failure there also throws after releasing the
  // claim on the prediction.
  it('distinguishes "nothing to create" from "creation failed"', () => {
    expect(src).toContain('error: ticketError');
    expect(src).toMatch(/if \(ticketError \|\| !ticket\) \{[\s\S]{0,900}?throw ticketError/);
  });
});

describe('the guard states its scope and its blind spots', () => {
  const header = read('scripts/check-swallowed-write-errors.mts').slice(0, 4000);

  it('says what counts as surfaced, and why a logged loop error is only half', () => {
    expect(header).toContain('WHAT COUNTS AS SURFACED');
    expect(header).toMatch(/does the RESPONSE distinguish the failures/i);
  });

  it('records that a surrounding try/catch is not surfacing', () => {
    expect(header).toMatch(/TRY\/CATCH AROUND A POSTGREST CALL IS EVIDENCE OF NOTHING/);
  });

  it('records why it parses rather than using a line window', () => {
    expect(header).toContain('WHY THE TYPESCRIPT PARSER AND NOT A LINE WINDOW');
  });

  it('is scoped to writes, not reads', () => {
    expect(header).toContain('SCOPE IS WRITES ONLY');
  });
});

describe('check:phantom-tables points at the half it cannot see', () => {
  it('names the swallowed-writes guard and why the literal rule misses it', () => {
    const header = read('scripts/check-phantom-tables.mjs').slice(0, 6000);
    expect(header).toContain('check:swallowed-writes');
    expect(header).toContain('42P01/PGRST205 LITERAL');
  });
});

describe('the baseline is a TODO list with a stated shape', () => {
  const baseline = JSON.parse(read('docs/swallowed-write-errors-baseline.json'));

  it('is keyed by file, table and write method rather than by line', () => {
    expect(baseline.entries.length).toBe(baseline.count);
    for (const key of baseline.entries.slice(0, 20)) {
      expect(key.split('::')).toHaveLength(3);
      expect(key).not.toMatch(/:\d+$/);
    }
  });

  it('says plainly that it is not settled debt', () => {
    expect(baseline.note).toMatch(/TODO list, not settled debt/);
  });
});
