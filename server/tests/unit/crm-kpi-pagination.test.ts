// PROD-008b: the CRM KPI counters on the Leads, Customers and Prospects pages.
//
// Each page derives its tab counts by issuing /api/companies?...&limit=1 and
// reading the total off the response. They read `resp?.pagination?.total || 0`.
// The Express handler emitted BOTH shapes - it has a comment saying pagination
// is "kept for the callers that read pagination.total rather than total" - but
// /api/companies is proxied, and the edge function emits only
// { data, total, page, limit }. So every counter resolved undefined and rendered
// 0: twelve of them across three pages, in production and in dev.
//
// They now go through extractPagination, which accepts either shape.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractPagination } from '../../../client/src/lib/queryClient';

const repo = join(__dirname, '../../..');
const strip = (src: string) =>
  src
    .replace(/^[ \t]*\/\/[^\n]*/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));
const read = (p: string) => strip(readFileSync(join(repo, p), 'utf-8'));

const PAGES = [
  'client/src/pages/LeadsPage.tsx',
  'client/src/pages/CustomersPage.tsx',
  'client/src/pages/ProspectsPage.tsx',
];

describe('extractPagination accepts both response shapes', () => {
  it('reads the flat total the edge function returns', () => {
    expect(extractPagination({ data: [], total: 42, page: 1, limit: 1 }).total).toBe(42);
  });

  it('reads the nested total the Express handler returned', () => {
    expect(extractPagination({ data: [], pagination: { total: 42 } }).total).toBe(42);
  });

  it('prefers the flat total when a response carries both', () => {
    // Express emitted both and they always agreed; asserting the precedence
    // means a future divergence resolves predictably rather than by accident.
    expect(extractPagination({ total: 7, pagination: { total: 9 } }).total).toBe(7);
  });

  it('returns 0 rather than throwing on a shape it does not know', () => {
    for (const shape of [null, undefined, {}, [], 'nope', { entries: [] }]) {
      expect(extractPagination(shape).total).toBe(0);
    }
  });
});

describe('the KPI pages do not read pagination.total directly', () => {
  for (const page of PAGES) {
    it(`${page} uses extractPagination`, () => {
      const src = read(page);
      expect(src).toContain('extractPagination');
      // The bare form is what broke: no `?? total` fallback, so the edge
      // response resolved undefined and every tab showed 0.
      expect(src).not.toMatch(/\?\.pagination\?\.total \|\| 0/);
    });
  }

  it('the counters are actually derived from it, not just imported', () => {
    // A page could import the helper and still read the raw key somewhere else.
    for (const page of PAGES) {
      const src = read(page);
      const uses = (src.match(/extractPagination\(/g) ?? []).length;
      expect(uses, `${page} imports extractPagination but never calls it`).toBeGreaterThan(0);
    }
  });
});
