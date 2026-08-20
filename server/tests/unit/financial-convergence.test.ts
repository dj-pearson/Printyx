// PROD-008 convergence lock for /api/journal-entries and /api/chart-of-accounts.
//
// Both were both-divergent: an Express handler and an edge function existed with
// no proxy entry, so dev ran one and production ran the other. Every
// disagreement broke the live page.
//
//   journal-entries: the edge list returned { entries, pagination } where the
//   page maps over the response (TypeError on load); create summed a lineItems
//   array the page never sends, so every entry was saved with zero totals; the
//   page sends PATCH and only PUT was implemented.
//
//   chart-of-accounts: Express had no /:id handler at all and the edge fn
//   implemented PUT while the page sends PATCH, so editing an account was dead
//   on BOTH hosts - and the update it would have reached spread the raw
//   camelCase body into PostgREST, none of whose keys are columns.
//
// server/routes-financial.ts is deleted; both prefixes are proxied. These tests
// scan the whole server tree rather than one file, so deleting or renaming a
// route file cannot quietly retire the check.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf-8');

const PROXY = read('server/middleware/edge-function-proxy.ts');
const REGISTRY = read('server/routes-registry.ts');
const PREFIXES = ['/api/journal-entries', '/api/chart-of-accounts'];

function serverFiles(dir = join(repo, 'server'), out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'tests') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) serverFiles(full, out);
    else if (/\.ts$/.test(entry)) out.push(full);
  }
  return out;
}

/** Every Express route registration under the proxied prefixes, tree-wide. */
function shadowedRoutes(): string[] {
  const found: string[] = [];
  for (const file of serverFiles()) {
    const src = readFileSync(file, 'utf-8');
    for (const m of src.matchAll(
      /(?:app|router)\.(get|post|put|patch|delete)\(\s*'(\/api\/[^']+)'/g,
    )) {
      if (PREFIXES.some((p) => m[2].startsWith(p))) {
        found.push(`${m[1].toUpperCase()} ${m[2]} (${file.slice(repo.length + 1)})`);
      }
    }
  }
  return found.sort();
}

describe('financial convergence (PROD-008)', () => {
  it('both prefixes are proxied to their edge functions', () => {
    expect(PROXY).toContain("'/api/journal-entries': 'journal-entries'");
    expect(PROXY).toContain("'/api/chart-of-accounts': 'chart-of-accounts'");
  });

  it('the proxy is registered before the domain route registrations', () => {
    // Express matches the first handler registered for a path, so the proxy only
    // wins if it goes on before the domain registrations. The tree scan below is
    // the real guarantee; this pins the ordering that guarantee depends on.
    const proxyAt = REGISTRY.indexOf('registerEdgeFunctionProxy(app)');
    const billingAt = REGISTRY.indexOf('registerBillingCoreRoutes(app)');
    expect(proxyAt).toBeGreaterThan(-1);
    expect(billingAt).toBeGreaterThan(-1);
    expect(proxyAt).toBeLessThan(billingAt);
  });

  it('no Express file registers a handler under either prefix', () => {
    expect(
      shadowedRoutes(),
      'These are shadowed by the proxy and never run. Implement them in the ' +
        'matching supabase/functions/ directory instead.',
    ).toEqual([]);
  });

  it('routes-financial.ts is gone, along with its registration', () => {
    expect(existsSync(join(repo, 'server/routes-financial.ts'))).toBe(false);
    expect(REGISTRY).not.toContain('registerFinancialRoutes');
    // Exact specifier: routes-financial-forecasting is a different file and
    // stays.
    expect(read('server/domains/billing.ts')).not.toContain("'../routes-financial'");
  });
});

describe('the edge handlers match what the pages actually send', () => {
  const JOURNAL = read('supabase/functions/journal-entries/index.ts');
  const ACCOUNTS = read('supabase/functions/chart-of-accounts/index.ts');
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
    // `.update({ ...body })` with a camelCase body is a PostgREST schema error
    // on every key the page sends.
    expect(ACCOUNTS).not.toContain('.update({ ...body');
    expect(ACCOUNTS).toContain('toAccountColumns(body)');
  });
});
