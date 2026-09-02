/**
 * The FK column-type guard, and the finding that produced it (AUDIT-036).
 *
 * AUDIT-032 established that a tenant_id column has to be able to hold a tenant
 * id, converted 21 of them in migration 0062, and stopped at that column name.
 * The foreign keys on the same tables were left as they were:
 * contract_renewal_tracking.contract_id is integer NOT NULL while contracts.id
 * is a varchar uuid, so the routed /contract-renewal-autopilot dashboard
 * analyses contracts it cannot store a reference to.
 *
 * Seventeen columns are in that state across three schema families, and they
 * are the same three features AUDIT-032's own note names as broken by the
 * tenant_id version: auto-supply replenishment, contract renewal and document
 * automation.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const baseline = JSON.parse(read('docs/fk-id-types-baseline.json'));

describe('the guard runs and is wired in', () => {
  it('passes against the recorded baseline', () => {
    const out = execFileSync('node', [join(repo, 'scripts/check-fk-id-types.mjs')], {
      encoding: 'utf8',
    });
    expect(out).toMatch(/No new mistyped foreign-key columns/);
  });

  it('is a package script and a CI step', () => {
    expect(read('package.json')).toMatch(/"check:fk-id-types"/);
    expect(read('.github/workflows/ci.yml')).toMatch(/npm run check:fk-id-types/);
  });
});

describe('the conversion landed, and the gate is at zero', () => {
  it('has an empty baseline', () => {
    // This used to assert that the schemas and the replayed migrations reported
    // the SAME 17 columns - a cross-check that was worth having while the debt
    // existed, and an assertion about debt once 0063 cleared it. What has to
    // hold now is that neither side finds anything.
    expect(baseline.total).toBe(0);
    expect(baseline.offenders).toEqual([]);
  });

  it('converts the columns in a migration, not just in the schema', () => {
    // A schema edit with no migration is drift: db:generate diffs the snapshot,
    // and a column that only changed in TypeScript stays integer in every
    // database. Both sides of the guard exist for exactly this.
    const sql = read('drizzle/migrations/0063_abandoned_the_phantom.sql');
    const alters = sql.match(/ALTER COLUMN "[a-z_]+" SET DATA TYPE varchar/g) ?? [];
    expect(alters.length).toBe(31);
    for (const column of [
      '"contract_renewal_tracking" ALTER COLUMN "contract_id"',
      '"generated_documents" ALTER COLUMN "deal_id"',
      '"supply_monitoring" ALTER COLUMN "equipment_id"',
      // Found by hand, not by the guard: none of these is named for its target.
      '"contract_renewal_tracking" ALTER COLUMN "assigned_sales_rep_id"',
      '"renewal_communication_log" ALTER COLUMN "sent_by_user_id"',
      '"document_uploads" ALTER COLUMN "reviewed_by"',
      '"auto_supply_orders" ALTER COLUMN "supplier_id"',
    ]) {
      expect(sql, column).toContain(column);
    }
  });

  it('leaves the polymorphic reference alone', () => {
    // document_notifications.document_id is integer and CORRECT: its
    // document_type selects between two integer-keyed tables. The guard
    // reported it by name and was wrong, which is why the rule now skips
    // <x>_id beside <x>_type rather than baselining it.
    const sql = read('drizzle/migrations/0063_abandoned_the_phantom.sql');
    expect(sql).not.toContain('"document_notifications" ALTER COLUMN "document_id"');
    expect(read('shared/document-automation-schema.ts')).toMatch(
      /documentId: integer\('document_id'\)/,
    );
  });
});

describe('the guard cannot report what it cannot explain', () => {
  it('resolves a target by column name only, and says so', () => {
    // A looser rule would bury the real cases. The cost is that a differently
    // named FK is invisible - the same blind spot check:tenant-id-types has,
    // and it is written into the header rather than left to be discovered.
    const src = read('scripts/check-fk-id-types.mjs');
    expect(src).toMatch(/HOW A TARGET IS RESOLVED/);
    expect(src).toMatch(/const SINGULAR = \{ companies: 'company'/);
  });

  it('strips line comments before block comments on both sides', () => {
    // A guard that reads its own explanation reports the fix as the defect,
    // and a prose path like the api wildcard opens a phantom block comment.
    const src = read('scripts/check-fk-id-types.mjs');
    expect(src).toMatch(
      /const stripTs = \(s\) =>\s*\n?\s*s\.replace\(\/\(\^\|\[\^:\]\)\\\/\\\/\.\*\$\/gm/,
    );
  });
});
