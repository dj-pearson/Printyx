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
import { existsSync, readFileSync } from 'node:fs';
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

  it('the seed findings are GONE, not baselined - WF-L-12 deleted both pages', () => {
    // WF-G-04 baselined four entries (AssetManagement x2, VehicleManagement x2)
    // at introduction, exactly as its AC said, and WF-L-12 removed them the same
    // day by deleting the two pages: 1,399 lines of fabricated VINs, serial
    // numbers, purchase prices and lease payments, with no query anywhere and no
    // backend to give them one - supabase/functions/fleet reads three tables
    // that exist in no schema and no migration, and has no caller either.
    const baseline = readFileSync(join(repo, 'docs/static-posture-baseline.json'), 'utf8');
    for (const page of ['AssetManagement.tsx', 'VehicleManagement.tsx']) {
      expect(baseline).not.toContain(page);
      expect(existsSync(join(repo, `client/src/pages/${page}`))).toBe(false);
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
    // VehicleManagement held TWO arrays of TWO records. A per-array threshold of
    // three would have missed it entirely while catching AssetManagement beside
    // it - which is why the rule counts records across a file.
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

  it('the whole page tree now yields NO record-array finding at all', () => {
    // The strongest form of AC2: not "the false positives are baselined" but
    // "there are none". Every remaining baseline entry is a JSX literal from the
    // older rules.
    const baseline = JSON.parse(
      readFileSync(join(repo, 'docs/static-posture-baseline.json'), 'utf8'),
    ) as { offenders: string[] };
    expect(baseline.offenders.filter((o) => / records x \d+ fields \]$/.test(o))).toEqual([]);
  });
});
