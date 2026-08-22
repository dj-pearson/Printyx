// PROD-008 convergence lock for the financial prefixes retired so far:
// /api/journal-entries, /api/chart-of-accounts, /api/contracts, /api/leases.
//
// Each was both-divergent - an Express handler and an edge function with no
// proxy entry, so dev ran one and production ran the other - and every
// disagreement broke the live page:
//
//   journal-entries: the edge list returned { entries, pagination } where the
//   page maps over the response; create summed a lineItems array the page never
//   sends, so every entry was saved with zero totals; the page sends PATCH and
//   only PUT was implemented.
//
//   chart-of-accounts: Express had no /:id handler at all and the edge fn
//   implemented PUT while the page sends PATCH, so editing an account was dead
//   on BOTH hosts - and the update it would have reached spread the raw
//   camelCase body into PostgREST.
//
//   contracts and leases: Express returned a bare array of camelCase rows, the
//   edge fn returns { data, total, page, limit } of snake_case rows, and
//   contracts.tsx, MeterReadings.tsx and Leases.tsx all called .map on that
//   envelope - a TypeError on load in production.
//
// The tree-wide "is any Express handler shadowed by a proxy" scan that used to
// live here is now scripts/check-shadowed-express.mjs, which walks every
// proxied prefix instead of the ones this file names.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf-8');

/**
 * Source with comments removed. Every source-reading assertion below must go
 * through this: a comment that QUOTES the old code defeats the assertion about
 * it, and this suite has now been bitten by that three times - once on
 * journal_entry_lines, once on `.update({ ...body`, and once on
 * `(response || []).map`. Line count is preserved so any reported offset still
 * points at the real source.
 */
const readCode = (p: string) =>
  read(p)
    .replace(/^[ \t]*\/\/[^\n]*/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));

const PROXY = read('server/middleware/edge-function-proxy.ts');
const REGISTRY = read('server/routes-registry.ts');

describe('financial convergence (PROD-008)', () => {
  it('every retired prefix is proxied to its edge function', () => {
    expect(PROXY).toContain("'/api/journal-entries': 'journal-entries'");
    expect(PROXY).toContain("'/api/chart-of-accounts': 'chart-of-accounts'");
    expect(PROXY).toContain("'/api/contracts': 'contracts'");
    expect(PROXY).toContain("'/api/leases': 'leases'");
  });

  it('the leases siblings keep their discriminator segment', () => {
    // server.ts aliases these to the leases fn with stripSegments = 0, because
    // the segment IS the dispatcher's discriminator. The Express mount strips
    // it, so pathPrefix has to put it back or dev and prod route differently.
    for (const sibling of ['lease-payments', 'lease-renewals', 'lease-dispositions']) {
      expect(PROXY).toContain(`'/api/${sibling}': { fn: 'leases', pathPrefix: '/${sibling}' }`);
    }
  });

  it('the proxy is registered before the domain route registrations', () => {
    // Express matches the first handler registered for a path, so the proxy only
    // wins if it goes on before the domain registrations.
    const proxyAt = REGISTRY.indexOf('registerEdgeFunctionProxy(app)');
    // registerBillingCoreRoutes was the original anchor; it was retired under
    // PROD-008b once every one of its handlers was shadowed by the billing edge
    // function. Any surviving domain registration proves the same ordering.
    const domainAt = REGISTRY.indexOf('registerCrmCoreRoutes(app)');
    expect(proxyAt).toBeGreaterThan(-1);
    expect(domainAt).toBeGreaterThan(-1);
    expect(proxyAt).toBeLessThan(domainAt);
  });

  it('the retired Express modules are gone, along with their registrations', () => {
    expect(existsSync(join(repo, 'server/routes-financial.ts'))).toBe(false);
    expect(existsSync(join(repo, 'server/routes/lease-routes.ts'))).toBe(false);
    expect(REGISTRY).not.toContain('registerFinancialRoutes');
    expect(REGISTRY).not.toContain('./routes/lease-routes');
    // Exact specifier: routes-financial-forecasting is a different file and
    // stays.
    expect(read('server/domains/billing.ts')).not.toContain("'../routes-financial'");
  });

  it('the tree-wide scan is owned by the generic ratchet and is wired into CI', () => {
    // Keeping a second hand-rolled scanner here would only let the two drift.
    // The generic one found 352 shadowed handlers across 53 of 88 proxied
    // prefixes - a backlog this file was never going to see.
    expect(existsSync(join(repo, 'scripts/check-shadowed-express.mjs'))).toBe(true);
    expect(read('package.json')).toContain('check:shadowed-express');
    expect(read('.github/workflows/ci.yml')).toContain('npm run check:shadowed-express');
  });
});

describe('the edge handlers match what the pages actually send', () => {
  const JOURNAL = readCode('supabase/functions/journal-entries/index.ts');
  const ACCOUNTS = readCode('supabase/functions/chart-of-accounts/index.ts');
  const JOURNAL_SCHEMA = read('shared/journal-entries-schema.ts');

  it('both handle PATCH, which is the verb both pages send', () => {
    expect(JOURNAL).toMatch(/req\.method === 'PATCH'/);
    expect(ACCOUNTS).toMatch(/req\.method === 'PATCH'/);
  });

  it('the journal list returns a bare array, which is what the page maps over', () => {
    expect(JOURNAL).toContain('return createCorsResponse(entries || [], 200, req);');
    expect(JOURNAL).not.toContain('pagination:');
  });

  it('no handler QUERIES journal_entry_lines, a table that does not exist', () => {
    // The name still appears in a comment explaining why the line-item model
    // was removed, so this matches the query form rather than the string.
    expect(JOURNAL).not.toContain(".from('journal_entry_lines')");
  });

  it('no handler writes a column journal_entries does not have', () => {
    for (const column of ['posted_at', 'posted_by', 'original_entry_id']) {
      expect(JOURNAL_SCHEMA).not.toContain(column);
      expect(JOURNAL).not.toContain(`${column}:`);
    }
  });

  it('the account update maps fields to columns instead of spreading the body', () => {
    expect(ACCOUNTS).not.toContain('.update({ ...body');
    expect(ACCOUNTS).toContain('toAccountColumns(body)');
  });
});

describe('the pages read the envelope the edge functions return', () => {
  // `(response || []).map(...)` against { data, total, page, limit } is a
  // TypeError. extractRecords handles both shapes; four queryFns had to be
  // moved onto it, so this pins those four specifically.
  //
  // Deliberately NOT a whole-file assertion: these pages have other queryFns
  // reading other domains, and whether each of THOSE endpoints returns an
  // envelope is a separate question per domain. Asserting file-wide would
  // either fail on unrelated code or push a blind rewrite of it.
  const CASES: Array<[string, string]> = [
    ['client/src/pages/contracts.tsx', '/api/contracts'],
    ['client/src/pages/MeterReadings.tsx', '/api/contracts'],
    ['client/src/pages/Leases.tsx', '/api/leases'],
    ['client/src/pages/Invoices.tsx', '/api/contracts'],
  ];

  for (const [page, endpoint] of CASES) {
    it(`${page} unwraps ${endpoint} with extractRecords`, () => {
      const src = readCode(page);
      const call = src.indexOf(`apiRequest('${endpoint}'`);
      expect(call, `${page} no longer calls ${endpoint}`).toBeGreaterThan(-1);
      // The window runs to the NEXT apiRequest call, so it covers exactly this
      // queryFn's normalizer and cannot spill into the page's other queries.
      const next = src.indexOf('apiRequest(', call + 1);
      const window = src.slice(call, next === -1 ? src.length : next);
      expect(window).toContain('extractRecords(response)');
      expect(window).not.toMatch(/\(response \|\| \[\]\)\.map/);
    });
  }
});
