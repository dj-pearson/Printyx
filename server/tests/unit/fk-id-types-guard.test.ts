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

describe('it reads both sides, because either alone can be wrong', () => {
  it('finds the same columns in the schemas and in the replayed migrations', () => {
    // The schema scan is what db:generate diffs; the replay is the half that
    // sees a hand-written .sql. Agreement across both is the confirmation -
    // a finding in only one of them means one side has drifted.
    const fromSchema = baseline.offenders
      .filter((o: string) => o.startsWith('shared/'))
      .map((o: string) => o.split(/\s+/).slice(1, 2)[0]);
    const fromMigrations = baseline.offenders
      .filter((o: string) => o.startsWith('drizzle/'))
      .map((o: string) => o.split(/\s+/).slice(2, 3)[0]);
    expect(fromSchema.length).toBeGreaterThan(0);
    expect([...fromSchema].sort()).toEqual([...fromMigrations].sort());
  });

  it('names the contract renewal column that motivated it', () => {
    expect(baseline.offenders.join('\n')).toMatch(
      /contract_renewal_tracking\.contract_id is integer, contracts\.id is textual/,
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
