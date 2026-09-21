/**
 * Nine raw fetches on routed pages, recorded as harmless by a coincidence of
 * two nines (round 128).
 *
 * check:raw-fetch splits its findings into LIVE (the file is reachable from
 * App.tsx, so a user can trigger it) and DEAD (nothing imports the file), and
 * it baselines the LIVE ones only. Its summary printed
 * "(N baselined, M on unreachable files)" - two disjoint counts reading as one
 * fact - and when both happened to be 9, CLAUDE.md recorded "all of them now
 * on unreachable files - no reachable page makes one". Every one of the nine
 * was on a routed page and broken in production.
 *
 * Four were converted once their endpoint was checked on the host production
 * sends them to. The five that remain each say why, because a conversion with
 * no branch behind it swaps silence for a 404 (SEO-TRANSPORT-001).
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const stripComments = (s: string) =>
  s.replace(/(?<![:/])\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, ' ');

const BASELINE = JSON.parse(read('docs/raw-api-fetch-baseline.json'));
const GUARD = read('scripts/check-raw-api-fetch.mjs');
const GUARD_CODE = stripComments(GUARD);

/** The guard's own classification, rather than a second implementation of it. */
function listed(): { live: string[]; dead: string[] } {
  const out = execFileSync('node', ['scripts/check-raw-api-fetch.mjs', '--list'], {
    cwd: repo,
    encoding: 'utf8',
  });
  const [liveBlock, deadBlock] = out.split(/\nDEAD/);
  const lines = (block: string) =>
    block
      .split('\n')
      .filter((l) => /^\s{2}\S/.test(l))
      .map((l) => l.trim());
  return { live: lines(liveBlock), dead: lines(deadBlock ?? '') };
}

describe('the summary cannot be read as the wrong fact', () => {
  it('the old wording is gone', () => {
    // "(9 baselined, 9 on unreachable files)" - the two numbers describe
    // disjoint sets and the line read as one.
    expect(GUARD_CODE).not.toMatch(/baselined, \$\{deadFindings\.length\} on unreachable files/);
  });

  it('and the new one says what each number counts', () => {
    const out = execFileSync('node', ['scripts/check-raw-api-fetch.mjs'], {
      cwd: repo,
      encoding: 'utf8',
    });
    expect(out).toMatch(/reachable from App\.tsx/);
    expect(out).toMatch(/break in production/);
    expect(out).toMatch(/files nothing imports/);
  });

  it('the baseline holds LIVE findings, which is why the wording mattered', () => {
    // Bound to the construct: `allowed` is built from liveFindings, so an
    // entry in this file is by definition on a reachable page.
    expect(GUARD_CODE).toMatch(/const allowed = \[\.\.\.new Set\(liveFindings\.map\(key\)\)\]/);
  });
});

describe('every baselined entry is reachable and reasoned', () => {
  it('the guard still classifies something, so this is not vacuous', () => {
    const { live, dead } = listed();
    expect(live.length + dead.length).toBeGreaterThan(5);
  });

  it("each one appears in the guard's own LIVE list", () => {
    const live = listed().live;
    for (const entry of BASELINE.allowed as string[]) {
      const file = entry.slice(0, entry.indexOf(':/api/'));
      expect({ entry, onALivePage: live.some((l) => l.startsWith(`${file}:`)) }).toEqual({
        entry,
        onALivePage: true,
      });
    }
  });

  it('each one names why converting it would not fix anything', () => {
    const reasons = BASELINE.reasons ?? {};
    for (const entry of BASELINE.allowed as string[]) {
      expect({ entry, reasoned: (reasons[entry] ?? '').length >= 40 }).toEqual({
        entry,
        reasoned: true,
      });
    }
    expect(Object.keys(reasons).sort()).toEqual([...(BASELINE.allowed as string[])].sort());
  });

  it('and the guard refuses an unreasoned entry rather than trusting the list', () => {
    expect(GUARD_CODE).toMatch(/unreasoned/);
    expect(GUARD_CODE).toMatch(/length < 40/);
    expect(GUARD_CODE).toMatch(/process\.exit\(1\)/);
  });

  it('the note says the entries are broken, not leftover', () => {
    expect(BASELINE.note).toMatch(/BROKEN IN PRODUCTION/);
    expect(BASELINE.note).toMatch(/not a list of harmless leftovers/);
  });
});

describe('a tighten keeps the note and the reasons', () => {
  it('the writer reads both back', () => {
    expect(GUARD_CODE).toMatch(/existingBaselineNote\(/);
    expect(GUARD_CODE).toMatch(/existingReasons\(/);
    expect(GUARD_CODE).toMatch(/note:\s*\n?\s*existingNote \?\?/);
    expect(GUARD_CODE).toMatch(/reasons: keptReasons/);
  });

  it('and drops a reason whose call site is gone, so the map cannot rot', () => {
    expect(GUARD_CODE).toMatch(/filter\(\(\[k\]\) => allowed\.includes\(k\)\)/);
  });
});

describe('the four conversions point at branches that exist', () => {
  const CONVERTED: [string, string, string][] = [
    [
      'client/src/pages/AutoSupplyReplenishmentDashboard.tsx',
      '/api/auto-supply-replenishment/analyze-all',
      'supabase/functions/auto-supply-replenishment/index.ts',
    ],
    [
      'client/src/pages/ContractRenewalDashboard.tsx',
      '/api/contract-renewal/analyze-all',
      'supabase/functions/contract-renewal/index.ts',
    ],
    [
      'client/src/pages/ProposalBuilder.tsx',
      '/api/validate/proposal-to-contract/',
      'supabase/functions/validate/index.ts',
    ],
    [
      'client/src/pages/QuoteProposalGeneration.tsx',
      '/api/validate/quote-to-proposal/',
      'supabase/functions/validate/index.ts',
    ],
  ];

  it('each page calls it through apiRequest now', () => {
    for (const [page, path] of CONVERTED) {
      const src = stripComments(read(page));
      expect({
        page,
        raw: src.includes(`fetch('${path}`) || src.includes(`fetch(\`${path}`),
      }).toEqual({ page, raw: false });
      expect({
        page,
        viaApiRequest: new RegExp(`apiRequest\\(\\s*[\`'"]${path}`).test(src),
      }).toEqual({ page, viaApiRequest: true });
    }
  });

  it('and the edge function it now reaches has the branch', () => {
    // SEO-TRANSPORT-001: converting a transport sends the bill to the other
    // host, so the branch is checked rather than assumed.
    for (const [, path, fn] of CONVERTED) {
      expect({ fn, exists: existsSync(join(repo, fn)) }).toEqual({ fn, exists: true });
      const leaf = path.replace(/^\/api\/[a-z-]+\//, '').replace(/\/$/, '');
      expect({ path, served: stripComments(read(fn)).includes(`'${leaf}'`) }).toEqual({
        path,
        served: true,
      });
    }
  });

  it('the validate calls no longer send a tenant the caller picked', () => {
    // AUDIT-001: x-tenant-id came from localStorage. apiRequest carries the
    // Bearer JWT and resolveTenantId reads app_metadata first.
    for (const page of [
      'client/src/pages/ProposalBuilder.tsx',
      'client/src/pages/QuoteProposalGeneration.tsx',
    ]) {
      const src = stripComments(read(page));
      expect({ page, sendsHeader: src.includes("'x-tenant-id'") }).toEqual({
        page,
        sendsHeader: false,
      });
      expect({
        page,
        readsLocalTenant: src.includes("localStorage.getItem('currentTenantId')"),
      }).toEqual({ page, readsLocalTenant: false });
    }
  });

  it('and none left a Response-shaped leftover behind', () => {
    // PROD-013: apiRequest returns parsed JSON, so `if (!response.ok)` after a
    // swap is permanently false and `.json()` is a TypeError.
    for (const [page] of CONVERTED) {
      const src = stripComments(read(page));
      expect({
        page,
        leftover: /if \(!response\.ok\) throw new Error\('Analysis failed'\)/.test(src),
      }).toEqual({ page, leftover: false });
    }
  });
});
