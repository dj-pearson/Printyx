/**
 * WF-G-04: a typed const array of realistic records is fabricated data whatever
 * the variable is called.
 *
 * AssetManagement.tsx and VehicleManagement.tsx evaded BOTH existing guards.
 * check:no-mocks looks for a mock IDENTIFIER and these are `const assets:
 * Asset[]` and `const vehicles: Vehicle[]`. check:no-static-posture worked on
 * the shape of a RENDERED slot - a JSX text node, a gauge, an expiry string -
 * and these reach the screen through {asset.purchasePrice}, which is an
 * expression. A reader sees a fleet with VINs, serial numbers, purchase prices,
 * lease expiries and warranty dates, and has no way to tell it was typed in.
 *
 * The rule is checked here against real files rather than fixtures, because the
 * ways it could go wrong - matching a status-colour map, matching a page that
 * legitimately holds a small fixture beside live data - are properties of this
 * repository's actual code.
 */

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const guard = readFileSync(join(repo, 'scripts/check-no-static-posture.mjs'), 'utf8');

function run(args: string[] = []): { code: number; out: string } {
  try {
    const out = execFileSync('node', ['scripts/check-no-static-posture.mjs', ...args], {
      cwd: repo,
      encoding: 'utf8',
    });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

describe('AC1: the rule finds the pages both other guards miss', () => {
  it('the guard passes now, with the seed findings baselined', () => {
    const { code, out } = run();
    expect(out).toContain('no new fabricated values');
    expect(code).toBe(0);
  });

  it('both known pages are recorded, all four arrays', () => {
    const baseline = readFileSync(join(repo, 'docs/static-posture-baseline.json'), 'utf8');
    for (const entry of [
      'AssetManagement.tsx  const assets = [ 5 records x 17 fields ]',
      'AssetManagement.tsx  const maintenanceRecords = [ 2 records x 8 fields ]',
      'VehicleManagement.tsx  const vehicles = [ 2 records x 17 fields ]',
      'VehicleManagement.tsx  const maintenanceRecords = [ 2 records x 9 fields ]',
    ]) {
      expect(baseline).toContain(entry);
    }
  });

  it('the finding is keyed by the array, not by a line of its source', () => {
    // Otherwise moving a field churns the baseline and the ratchet stops
    // meaning anything.
    expect(guard).toContain('records x ${fabricated.fields} fields');
  });
});

describe('AC1: the conditions that make it a finding', () => {
  it('a page that fetches ANYTHING is out of scope', () => {
    expect(guard).toContain('useQuery\\b|\\buseMutation\\b|\\bapiRequest\\b|\\bfetch\\s*\\(');
  });

  it('five fields and a data-ish value are both required', () => {
    expect(guard).toContain('if (fields < 5) continue;');
    expect(guard).toContain('if (!DATAISH_VALUE.test(body)) continue;');
  });

  it('the field count is NOT line-anchored', () => {
    // prettier keeps a short record on one line, and /^\s*\w+:/m counts that as
    // one field - the blind spot check:no-random-metrics records in its own
    // header. Anchoring on the brace or comma instead is what closes it, and a
    // probe file of three single-line six-field records is caught.
    expect(guard).toContain('const RECORD_FIELD = /(?:^|[{,])\\s*\\w+:\\s*/;');
  });

  it('the three-record threshold is counted per FILE', () => {
    // VehicleManagement holds TWO arrays of TWO records. A per-array threshold
    // of three would have missed it entirely while catching AssetManagement
    // beside it, which is the seed finding this AC names.
    expect(guard).toContain('return records >= 3 ? candidates : [];');
  });
});

describe('AC2: lookup tables do not trip it', () => {
  const pages = [
    // Status/label maps: objects, not arrays, so they are not matched at all.
    'client/src/pages/PurchaseOrders.tsx',
    'client/src/pages/WarehouseOperations.tsx',
    // Pages that fetch and also hold small constant lists.
    'client/src/pages/ServiceHub.tsx',
    'client/src/pages/SalesHandoffs.tsx',
  ];

  it('none of these is reported', () => {
    const { out } = run();
    for (const page of pages) {
      expect(`${page}: ${out.includes(`${page.split('/').pop()}  const`)}`).toBe(`${page}: false`);
    }
  });

  it('and the whole page tree yields no finding outside the two known pages', () => {
    // Run with the baseline emptied would be the strict form; instead assert the
    // baseline itself contains no record-array entry beyond the seed four, which
    // is the same claim and does not depend on rewriting a tracked file.
    const baseline = JSON.parse(
      readFileSync(join(repo, 'docs/static-posture-baseline.json'), 'utf8'),
    ) as { offenders: string[] };
    const recordArrays = baseline.offenders.filter((o) => / records x \d+ fields \]$/.test(o));
    expect(recordArrays).toHaveLength(4);
    expect(
      recordArrays.every(
        (o) => o.includes('AssetManagement.tsx') || o.includes('VehicleManagement.tsx'),
      ),
    ).toBe(true);
  });
});
