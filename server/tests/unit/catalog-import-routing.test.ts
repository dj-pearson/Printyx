// PROD-014: /api/<type>/import existed only on Express, so bulk catalog import
// 404'd in production for every product type. Both backends serve it now.
//
// Two things this pins that a unit test of the handler could not see. The
// import branch must precede the generic POST create branch — after it, the
// upload is treated as a single product, which is the same action-word-as-id
// class as the bulk endpoints. And the branch must read the path segment
// DIRECTLY: the three normalizePath functions declare their id variable below
// this point, so naming it is a temporal-dead-zone ReferenceError at runtime
// that no bundler flags. Both of those were real bugs in the first draft.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CATALOG_IMPORT_TYPES } from '@shared/catalog-import';

const TYPES = [
  'product-models',
  'product-accessories',
  'professional-services',
  'service-products',
  'software-products',
  'supplies',
  'managed-services',
];

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf-8');
const express = read('server/routes-products-crud.ts');
const page = read('client/src/components/product-import/ProductImport.tsx');

describe('every type the UI offers is a type the spec knows', () => {
  it('matches the spec list', () => {
    expect([...CATALOG_IMPORT_TYPES].sort()).toEqual([...TYPES].sort());
  });

  it('the UI offers exactly those endpoints', () => {
    for (const type of TYPES) expect(page).toContain(`/api/${type}/import`);
  });
});

describe.each(TYPES)('%s edge function', (type) => {
  const src = read(`supabase/functions/${type}/index.ts`);

  it('has an import branch', () => {
    expect(src).toMatch(/req\.method === 'POST' && \w*[pP]arts\[0\] === 'import'/);
  });

  it('places it before the generic POST create branch', () => {
    const importAt = src.indexOf("=== 'import'");
    // The first POST branch that is not the import branch.
    const generic = [...src.matchAll(/if \(req\.method === 'POST'(?![^)]*'import')/g)].map(
      (m) => m.index ?? -1,
    );
    for (const at of generic) {
      if (at > importAt) continue;
      expect(at, `a POST branch at ${at} precedes the import branch at ${importAt}`).toBe(-1);
    }
    expect(importAt).toBeGreaterThan(-1);
  });

  it('reads the path segment directly, not the id variable declared below it', () => {
    const importAt = src.indexOf("=== 'import'");
    const idDecl = src.search(/const \w+ = (path)?[pP]arts\[0\]/);
    if (idDecl > importAt) {
      // The variable is declared after the branch, so it must not be named in it.
      const branch = src.slice(importAt - 60, importAt + 20);
      expect(branch).toMatch(/[pP]arts\[0\] === 'import'/);
    }
  });

  it('imports through the shared runner, not its own parser', () => {
    expect(src).toContain("from '../_shared/catalog-import-runner.ts'");
    expect(src).toContain(`importCatalogCsv(admin, '${type}', tenantId, csvText)`);
    expect(src).not.toContain('csv-parser');
  });

  it('refuses an empty upload rather than reporting an import of nothing', () => {
    const at = src.indexOf("=== 'import'");
    expect(src.slice(at, at + 500)).toContain('No file uploaded');
  });
});

describe('Express serves all seven from one loop', () => {
  it('registers every type', () => {
    expect(express).toContain('for (const productType of CATALOG_IMPORT_TYPES)');
    expect(express).toContain('`/api/${productType}/import`');
  });

  it('no longer carries its own validators or CSV parser', () => {
    // Seven handlers with seven header conventions is how three of them ended
    // up writing columns that do not exist.
    for (const gone of [
      'validateProductModelData',
      'validateSupplyData',
      'validateManagedServiceData',
      'validateSoftwareProductData',
      'function parseCSV',
    ]) {
      expect(express, gone).not.toContain(gone);
    }
  });

  it('has no "not yet implemented" import left', () => {
    // professional-services and service-products returned imported: 0 with that
    // message, and the UI reported a successful import of nothing.
    // Comments are stripped: the replacement block quotes the old message to
    // say what it replaced.
    const code = express.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toContain('not yet implemented');
    expect(code).not.toContain('imported: 0');
  });
});

describe('the template comes from the spec', () => {
  it('the page generates it rather than carrying a copy', () => {
    expect(page).toContain("import { buildCsvTemplate } from '@shared/catalog-import'");
    expect(page).toContain('buildCsvTemplate(productType)');
    expect(page).not.toContain('const csvTemplates');
  });
});
