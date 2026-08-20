// PROD-008 convergence lock for /api/journal-entries.
//
// This domain was both-divergent: an Express handler and an edge function both
// existed with no proxy entry, so dev ran one and production ran the other. Every
// disagreement broke the live page - the list shape threw a TypeError on load,
// PATCH hit a handler that only accepted PUT, and create discarded the amounts.
//
// Express is retired and the prefix is proxied. These tests read the sources, so
// they hold in CI with no database and no edge runtime.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf-8');

const FINANCIAL = read('server/routes-financial.ts');
const PROXY = read('server/middleware/edge-function-proxy.ts');
const EDGE = read('supabase/functions/journal-entries/index.ts');
const REGISTRY = read('server/routes-registry.ts');
const SCHEMA = read('shared/journal-entries-schema.ts');

describe('journal-entries convergence (PROD-008)', () => {
  it('the prefix is proxied to the edge function', () => {
    expect(PROXY).toContain("'/api/journal-entries': 'journal-entries'");
  });

  it('the proxy is registered before the financial routes, so it wins', () => {
    const proxyAt = REGISTRY.indexOf('registerEdgeFunctionProxy(app)');
    const financialAt = REGISTRY.indexOf('registerFinancialRoutes(app)');
    expect(proxyAt).toBeGreaterThan(-1);
    expect(financialAt).toBeGreaterThan(-1);
    expect(proxyAt).toBeLessThan(financialAt);
  });

  it('Express registers no /api/journal-entries handlers', () => {
    const routes = [
      ...FINANCIAL.matchAll(/router\.(get|post|put|patch|delete)\(\s*'(\/api\/[^']+)'/g),
    ]
      .map((m) => `${m[1].toUpperCase()} ${m[2]}`)
      .filter((r) => r.includes('/api/journal-entries'));
    expect(
      routes,
      'These are shadowed by the proxy and never run. Implement journal-entry ' +
        'endpoints in supabase/functions/journal-entries/ instead.',
    ).toEqual([]);
  });

  it('chart-of-accounts stays on Express and is NOT proxied', () => {
    // Same file, same story, deliberately not moved: only journal-entries was
    // divergent enough to converge this round.
    expect(FINANCIAL).toContain("router.get('/api/chart-of-accounts'");
    expect(PROXY).not.toContain("'/api/chart-of-accounts':");
  });

  it('the edge list returns a bare array, which is what the page maps over', () => {
    // JournalEntries.tsx does `(response || []).map(...)`. The old
    // { entries, pagination } envelope made that a TypeError in production.
    expect(EDGE).toContain('return createCorsResponse(entries || [], 200, req);');
    expect(EDGE).not.toContain('pagination:');
  });

  it('the edge function handles PATCH, which is the verb the page sends', () => {
    expect(EDGE).toMatch(/req\.method === 'PATCH'/);
  });

  it('no handler QUERIES journal_entry_lines, a table that does not exist', () => {
    // The name still appears in a comment explaining why the line-item model
    // was removed, so this matches the query form rather than the string.
    expect(EDGE).not.toContain(".from('journal_entry_lines')");
    expect(FINANCIAL).not.toContain('journal_entry_lines');
  });

  it('no handler writes a column the journal_entries table does not have', () => {
    // posted_at, posted_by and original_entry_id were each an unconditional
    // 42703 on the post and reverse endpoints.
    for (const column of ['posted_at', 'posted_by', 'original_entry_id']) {
      expect(SCHEMA).not.toContain(column);
      expect(EDGE).not.toContain(`${column}:`);
    }
  });
});
