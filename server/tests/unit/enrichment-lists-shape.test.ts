import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Round 190. GET /enrichment/contacts and /companies answered a bare array of
 * every row while DataEnrichment.tsx read `.contacts` / `.companies`, so both
 * tabs showed "No ... found" for every tenant; and the page's search, status,
 * source and page-size parameters were read by nothing.
 */

const root = join(__dirname, '../../..');
const strip = (s: string) =>
  s
    .split('\n')
    .map((l) => l.replace(/(?<![:/])\/\/.*$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
const FN = strip(readFileSync(join(root, 'supabase/functions/enrichment/index.ts'), 'utf8'));
const PAGE = strip(readFileSync(join(root, 'client/src/pages/DataEnrichment.tsx'), 'utf8'));

function branch(marker: string) {
  const at = FN.indexOf(marker);
  expect(at).toBeGreaterThan(-1);
  const next = FN.indexOf('\n    if (req.method', at + marker.length);
  return FN.slice(at, next);
}

describe('the list endpoints answer the keys the page reads', () => {
  it('contacts', () => {
    const b = branch("if (req.method === 'GET' && resource === 'contacts')");
    expect(b).toMatch(/\{ contacts: contacts \|\| \[\], total: count \?\? 0, page, limit \}/);
    expect(PAGE).toContain('contactsData?.contacts');
  });
  it('companies', () => {
    const b = branch("if (req.method === 'GET' && resource === 'companies' && !resourceId)");
    expect(b).toMatch(/\{ companies: companies \|\| \[\], total: count \?\? 0, page, limit \}/);
    expect(PAGE).toContain('companiesData?.companies');
  });
});

describe('every parameter the page sends is read', () => {
  const sent = [...PAGE.matchAll(/params\.append\('([a-zA-Z]+)'/g)].map((m) => m[1]);
  it('the page sends what we expect', () => {
    expect(new Set(sent)).toEqual(
      new Set(['query', 'prospectingStatus', 'enrichmentSource', 'page', 'limit']),
    );
  });
  it('and the contacts branch reads each of them', () => {
    const b = branch("if (req.method === 'GET' && resource === 'contacts')");
    for (const p of ['query', 'prospectingStatus', 'enrichmentSource']) {
      expect(b, p).toContain(`searchParams.get('${p}')`);
    }
    expect(b).toContain('pageWindow(url)');
    expect(FN).toMatch(/searchParams\.get\('page'\)/);
    expect(FN).toMatch(/searchParams\.get\('limit'\)/);
  });
  it('clamps the page size', () => {
    expect(FN).toMatch(/const MAX_PAGE_SIZE = 200;/);
    expect(FN).toMatch(/Math\.min\(\s*MAX_PAGE_SIZE/);
  });
});

describe('the buttons', () => {
  it('Export writes the rows on screen and says it is a page', () => {
    expect(PAGE).toContain('Export this page');
    expect(PAGE).toMatch(/exportToCSV\(companies, COMPANY_EXPORT_COLUMNS/);
    expect(PAGE).toMatch(/exportToCSV\(contacts, CONTACT_EXPORT_COLUMNS/);
  });
  it('every Import opens the integrations tab, where the Apollo import lives', () => {
    const imports = [...PAGE.matchAll(/onClick=\{\(\) => setActiveTab\('integrations'\)\}/g)];
    expect(imports.length).toBe(3);
  });
});
