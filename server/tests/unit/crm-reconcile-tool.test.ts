/**
 * The COP-B00 reconciliation tool, executed for the first time (round 87).
 *
 * Five priority-1 stories - COP-M01, COP-M03, COP-E03, COP-E04 and WF-S-01 -
 * are blocked on COP-B00, and COP-B00's whole unblocking path is one command:
 * `npm run crm:reconcile`, then `--apply`, run once against production by a
 * human with credentials. Nothing had ever executed it. Round 68 found that
 * `bench:crm` could not run at all while being quoted as evidence, and the rule
 * it produced applies here exactly: when a story's plan rests on a script, run
 * the script before believing the plan.
 *
 * It was run, against a scratch Postgres 16 with all 80 journalled migrations
 * replayed and rows seeded to reach every classifier verdict. The report path
 * and the apply path both work, ids are preserved, a second --apply copies
 * nothing, and all three documented exit codes hold. Three defects came out of
 * it and this file locks the fixes.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mapCompanyRow, normalizeRecordType } from '../../../shared/company-to-business-record';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

const company = (over: Record<string, unknown> = {}) => ({
  id: 'c-1',
  tenant_id: 't-1',
  business_name: 'Test Co',
  business_record_type: 'Customer',
  activity: 'active',
  created_by: 'u-1',
  ...over,
});

describe('a prospect is a qualified lead, not an active customer', () => {
  /**
   * THE DEFECT. `business_record_type` has four live values, and the mapper
   * tested for 'lead' and sent everything else to 'customer'. Correct for
   * Customer and Former Customer; wrong for Prospect, which is the one a live
   * surface produces - LeadsPage's "Convert to Prospect" writes exactly
   * `{ business_record_type: 'Prospect', activity: 'qualified' }` and
   * ProspectsPage is a routed board over that value.
   */
  it('maps every value in the canonical vocabulary', () => {
    expect(normalizeRecordType('Lead')).toBe('lead');
    expect(normalizeRecordType('Prospect')).toBe('lead');
    expect(normalizeRecordType('Customer')).toBe('customer');
    expect(normalizeRecordType('Former Customer')).toBe('customer');
  });

  it('is case- and whitespace-tolerant, because the column is free text', () => {
    for (const spelling of ['prospect', '  PROSPECT ', 'Prospect']) {
      expect({ spelling, type: normalizeRecordType(spelling) }).toEqual({
        spelling,
        type: 'lead',
      });
    }
  });

  it('defaults an absent type to customer, unchanged', () => {
    expect(normalizeRecordType(null)).toBe('customer');
    expect(normalizeRecordType(undefined)).toBe('customer');
    expect(normalizeRecordType('')).toBe('customer');
  });

  it('an unknown value is a customer, not a lead', () => {
    // Widening 'anything unrecognised' to lead would quietly demote real
    // customers, which is the more expensive direction to be wrong in.
    expect(normalizeRecordType('Partner')).toBe('customer');
  });

  it("keeps the prospect's own status instead of coercing it to active", () => {
    /**
     * This is the whole consequence. As a customer, 'qualified' fails the
     * customer vocabulary and falls back to 'active' - so an account that has
     * never bought anything arrives as an ACTIVE CUSTOMER and is then counted
     * by churn risk, QBR, contract renewal and every customer total in the
     * product. As a lead, 'qualified' is simply valid.
     */
    const { row, statusCoerced } = mapCompanyRow(
      company({ business_record_type: 'Prospect', activity: 'qualified' }),
    );
    expect({ type: row.record_type, status: row.status, statusCoerced }).toEqual({
      type: 'lead',
      status: 'qualified',
      statusCoerced: false,
    });
  });

  it('still coerces a real mismatch, so the counter has not been silenced', () => {
    // A CUSTOMER row carrying a lead status is the honest coercion case and
    // must keep firing - fixing the type must not hide the data problem.
    const { row, statusCoerced } = mapCompanyRow(
      company({ business_record_type: 'Customer', activity: 'qualified' }),
    );
    expect({ type: row.record_type, status: row.status, statusCoerced }).toEqual({
      type: 'customer',
      status: 'active',
      statusCoerced: true,
    });
  });

  it('matches the vocabulary the edge function itself maps', () => {
    // Derived rather than copied: business-records/index.ts holds the canonical
    // typeMap, so a fifth value added there fails this instead of silently
    // becoming a customer.
    const fn = read('supabase/functions/business-records/index.ts');
    const at = fn.indexOf('const typeMap: Record<string, string> = {');
    expect(at).toBeGreaterThan(-1);
    const block = fn.slice(at, fn.indexOf('}', at));
    const keys = [...block.matchAll(/^\s*([a-z_]+):/gm)].map((m) => m[1]);
    expect(keys.sort()).toEqual(['customer', 'former_customer', 'lead', 'prospect']);
  });
});

describe('the tool says what it did', () => {
  const SRC = read('scripts/crm-table-reconcile.mjs');

  it('does not claim nothing was merged when rows were merged', () => {
    /**
     * It printed "Nothing was merged" unconditionally, including directly
     * under "✓ Copied 4 row(s) into business_records" - and the refusal is the
     * LAST line on screen after a long report. On the one-shot production run
     * this script exists for, an operator would read it and re-run.
     */
    const at = SRC.indexOf('if (needsHuman > 0) {');
    expect(at).toBeGreaterThan(-1);
    const block = SRC.slice(at, SRC.indexOf('process.exit(1);', at));
    expect(block).toMatch(/copied > 0/);
    expect(block).toMatch(/unambiguous row\(s\) were copied/);
    // The exit code is unchanged: a human is still owed a decision.
    expect(SRC.slice(at)).toMatch(/process\.exit\(1\);/);
  });

  it('`copied` is in scope where the message reads it', () => {
    // A ReferenceError here would surface only on a partial apply, which is
    // the exact run that matters. Ordering is invisible to tsc in a .mjs.
    expect(SRC.indexOf('let copied = 0')).toBeLessThan(SRC.indexOf('if (needsHuman > 0) {'));
  });

  it('documents an invocation that can actually run', () => {
    /**
     * The header said `node scripts/crm-table-reconcile.mjs`. The script
     * imports shared/company-to-business-record.ts and node cannot load a .ts,
     * so the documented command died with ERR_UNKNOWN_FILE_EXTENSION before
     * reading a row. The npm script uses tsx and works; the header told you to
     * do the thing that does not.
     */
    const header = SRC.slice(0, SRC.indexOf('import pg from'));
    expect(header).not.toMatch(/^\/\/\s+DATABASE_URL=\S+ node scripts\//m);
    expect(header).toMatch(/npm run crm:reconcile/);
    // It really does import a .ts, which is why bare node cannot work.
    expect(SRC).toMatch(/company-to-business-record\.ts/);
    expect(JSON.parse(read('package.json')).scripts['crm:reconcile']).toMatch(/^tsx /);
  });

  it('keeps the exit contract the header promises', () => {
    // 0 clean, 1 needs a human, 2 could not connect - so "did not run" is
    // never read as "passed". All three were verified against a live database.
    const header = SRC.slice(0, SRC.indexOf('import pg from'));
    expect(header).toMatch(/Exit 0 when the report is clean/);
    expect(SRC).toMatch(/process\.exit\(2\)/);
    expect(SRC).toMatch(/fail\(`Could not connect/);
  });

  it('preserves the id, which is what makes a re-run idempotent', () => {
    // Verified live: a second --apply reports 5 already-migrated, 0 ready and
    // copies nothing.
    expect(SRC).toMatch(/on conflict \(id\) do nothing/);
  });
});
