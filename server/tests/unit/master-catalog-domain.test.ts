/**
 * PROD-008: `/api/catalog` is the platform MASTER catalogue on both hosts.
 *
 * The edge function used to read and write `product_models` - the tenant's own
 * catalogue - on every branch while Express served `master_product_models` and
 * `enabled_products` under the same prefix. Both answered 200 about different
 * tables, so ProductHubUnified browsed the platform catalogue in dev and the
 * dealer's own models in production.
 *
 * Two kinds of assertion here. The import planner is PURE and is exercised with
 * real CSV text rather than read as source - a grep proves the text is present,
 * only a call proves the value comes out. The routing, the tables and the role
 * gates are properties of the edge source, bound to the construct that carries
 * them and checked against comment-stripped text, because nothing typechecks
 * the edge tree.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  createFieldMappings,
  importRowKey,
  mapRowToProduct,
  mergeProductData,
  normalizeCategoryName,
  normalizeMoney,
  planMasterCatalogImport,
} from '@shared/master-catalog-import';

const ROOT = join(__dirname, '../../..');
const CATALOG_FN = join(ROOT, 'supabase/functions/catalog/index.ts');
const ENABLED_FN = join(ROOT, 'supabase/functions/enabled-products/index.ts');
const PROXY = join(ROOT, 'server/middleware/edge-function-proxy.ts');
const REGISTRY = join(ROOT, 'server/routes-registry.ts');
const PAGE = join(ROOT, 'client/src/pages/ProductHubUnified.tsx');

/**
 * Strip comments before any absence or gate assertion: this file's own headers
 * quote the broken code they replaced, and a raw match reports the explanation
 * as the defect.
 */
function stripComments(src: string): string {
  return src.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ' ');
}

const catalogSrc = readFileSync(CATALOG_FN, 'utf8');
const catalogCode = stripComments(catalogSrc);

/**
 * Slice one routing branch, bounded by the NEXT branch rather than by a
 * character count: a fixed window runs into the next branch and starts
 * asserting about code it was not aimed at.
 */
function branch(code: string, marker: string): string {
  const at = code.indexOf(marker);
  expect(at, `branch marker not found: ${marker}`).toBeGreaterThan(-1);
  const next = code.indexOf('if (req.method', at + marker.length);
  return next === -1 ? code.slice(at) : code.slice(at, next);
}

const CSV_HEADER = 'Item No.,Description,MSRP,Dealer Price,Manufacturer,Category';

describe('master catalogue import planner', () => {
  it('parses a quoted field that contains a newline as ONE row', () => {
    // The implementation this replaced split the file on newlines and parsed
    // each line alone, so a description pasted out of a spreadsheet ended the
    // record early and shifted every column after it.
    const csv = [CSV_HEADER, 'C359,"imageRUNNER ADVANCE\nDX C359iF",100,80,Canon,MFP'].join('\n');

    const plan = planMasterCatalogImport(csv);

    expect(plan.ok).toBe(true);
    expect(plan.totalRows).toBe(1);
    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0].displayName).toBe('imageRUNNER ADVANCE\nDX C359iF');
    expect(plan.rows[0].msrp).toBe(100);
    expect(plan.errors).toEqual([]);
  });

  it('refuses a money cell that is not wholly a number', () => {
    // parseFloat read '12abc' as 12 and '1.234.56' as 1.234. A price in this
    // catalogue is what a quote is built from, so a wrong number is worse than
    // a blank.
    expect(normalizeMoney('12abc')).toBeUndefined();
    expect(normalizeMoney('1.234.56')).toBeUndefined();
    expect(normalizeMoney('not priced')).toBeUndefined();
    expect(normalizeMoney('')).toBeUndefined();
    expect(normalizeMoney(null)).toBeUndefined();
    expect(normalizeMoney(undefined)).toBeUndefined();
  });

  it('reads a real price through currency punctuation, and keeps a real zero', () => {
    expect(normalizeMoney('$12,345.67')).toBe(12345.67);
    expect(normalizeMoney(' 900 ')).toBe(900);
    // 0 is a measurement - an included accessory really is priced at nothing.
    expect(normalizeMoney('0')).toBe(0);
  });

  it('merges duplicate rows into one product AND counts the merge', () => {
    // The previous implementation merged silently, so an operator could not
    // tell a 400-row file that produced 400 products from one that produced
    // 250.
    const csv = [
      CSV_HEADER,
      'C359,imageRUNNER C359,100,,Canon,MFP',
      'C359,imageRUNNER C359,,80,Canon,MFP',
    ].join('\n');

    const plan = planMasterCatalogImport(csv);

    expect(plan.totalRows).toBe(2);
    expect(plan.rows).toHaveLength(1);
    expect(plan.duplicatesMerged).toBe(1);
    // The later row fills the blank the earlier one left, and does not
    // overwrite a value already present.
    expect(plan.rows[0].msrp).toBe(100);
    expect(plan.rows[0].dealerCost).toBe(80);
  });

  it('names the spreadsheet row of every refused record', () => {
    const csv = [CSV_HEADER, ',No item number,1,2,Canon,MFP', 'C1,Good,1,2,Canon,MFP'].join('\n');

    const plan = planMasterCatalogImport(csv);

    expect(plan.rows).toHaveLength(1);
    expect(plan.errors).toEqual(['Row 2: missing required fields (model code or name)']);
  });

  it('refuses an empty file and a header-only file with different reasons', () => {
    expect(planMasterCatalogImport('').reason).toBe('EMPTY_CSV');
    expect(planMasterCatalogImport('   ').reason).toBe('EMPTY_CSV');
    expect(planMasterCatalogImport(CSV_HEADER).reason).toBe('NO_DATA_ROWS');
  });

  it('refuses headers it cannot map, and says what it would have used', () => {
    const plan = planMasterCatalogImport(['Widget,Colour', 'a,b'].join('\n'));

    expect(plan.ok).toBe(false);
    expect(plan.reason).toBe('UNMAPPABLE_HEADERS');
    expect(plan.rows).toEqual([]);
    expect(plan.fieldMappings.headersFound).toEqual(['Widget', 'Colour']);
  });

  it('accepts a file carrying only ONE of the two required fields', () => {
    // A price list with item numbers and no description still carries products.
    const mappings = createFieldMappings(['Item No.', 'MSRP']);
    expect(mappings.isValid).toBe(true);
    expect(mappings.requiredFieldsFound).toBe(1);
  });

  it('consolidates category spellings and derives the product type from them', () => {
    expect(normalizeCategoryName('MFP')).toBe('Multifunction');
    expect(normalizeCategoryName('multifunction printer')).toBe('Multifunction');
    expect(normalizeCategoryName('Hardware Accessory')).toBe('Accessory');
    expect(normalizeCategoryName('paper feeding unit')).toBe('Accessory');
    expect(normalizeCategoryName('printer')).toBe('Printer');
    expect(normalizeCategoryName('')).toBe('');

    const plan = planMasterCatalogImport(
      [CSV_HEADER, 'F1,Finisher,10,8,Canon,Hardware Accessory'].join('\n'),
    );
    expect(plan.rows[0].category).toBe('Accessory');
    expect(plan.rows[0].productType).toBe('accessory');
  });

  it('groups a file with no manufacturer column under one visible sentinel', () => {
    const plan = planMasterCatalogImport(
      ['Item No.,Description', 'C1,One', 'C1,One again'].join('\n'),
    );

    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0].manufacturer).toBe('Unknown');
    expect(importRowKey(plan.rows[0])).toBe('Unknown-C1');
  });

  it('fills blanks only when merging - a recorded value is never overwritten', () => {
    const existing = mapRowToProduct(
      { code: 'C1', name: 'First', price: '100' },
      createFieldMappings(['code', 'name', 'price']),
    );
    const incoming = { ...existing, displayName: 'Second', msrp: 999, dealerCost: 50 };

    const merged = mergeProductData(existing, incoming as typeof existing);

    expect(merged.displayName).toBe('First');
    expect(merged.dealerCost).toBe(50);
  });
});

describe('catalog edge function serves the MASTER catalogue', () => {
  it('reads and writes only the master and enabled-product tables', () => {
    const tables = [...catalogCode.matchAll(/\.from\('([a-z_]+)'\)/g)].map((m) => m[1]);

    expect(tables.length).toBeGreaterThan(4);
    expect([...new Set(tables)].sort()).toEqual([
      'enabled_products',
      'master_product_accessories',
      'master_product_models',
    ]);
    // The tenant catalogue belongs to supabase/functions/product-models/, which
    // serves /api/product-models for the routed ProductModels page.
    expect(tables).not.toContain('product_models');
  });

  it('serves every path ProductHubUnified calls', () => {
    const page = readFileSync(PAGE, 'utf8');
    const called = [...page.matchAll(/'\/api\/catalog\/([a-z-]+)/g)].map((m) => m[1]);

    expect(new Set(called)).toEqual(new Set(['models', 'manufacturers', 'import-enhanced']));

    expect(catalogCode).toMatch(/resource === 'manufacturers'/);
    expect(catalogCode).toMatch(/resource === 'import-enhanced'/);
    expect(catalogCode).toMatch(/resourceId === 'bulk-enable'/);
    expect(catalogCode).toMatch(/action === 'enable'/);
    expect(catalogCode).toMatch(/req\.method === 'PATCH'/);
  });

  it('takes the ids the page sends on bulk enable', () => {
    // The edge function read `productIds` where the page sends
    // `masterProductIds`, so every bulk enable answered 400.
    const bulk = branch(catalogCode, "resourceId === 'bulk-enable'");
    expect(bulk).toMatch(/body\?\.masterProductIds/);
    expect(bulk).toMatch(/\.from\('enabled_products'\)/);
  });

  it('reports what a bulk enable touched, not what it was asked for', () => {
    const bulk = branch(catalogCode, "resourceId === 'bulk-enable'");

    // An id with no master row is named rather than folded into `skipped`,
    // which the page renders as "already enabled".
    expect(bulk).toMatch(/const notFound = ids\.filter\(\(id\) => !knownIds\.has\(id\)\)/);
    // What the insert returned, never what was sent.
    expect(bulk).toMatch(/enabled = insertedRows\?\.length \?\? 0;/);
    expect(bulk).not.toMatch(/enabled = (ids|toEnable)\.length/);
    expect(bulk).toMatch(/skipped\+\+/);

    // Bound to the RESPONSE, not to the branch: a `notFound` computed and then
    // left out of the body is exactly the count-of-attempts this replaces, and
    // a presence check on the branch passes either way.
    const body = bulk.slice(bulk.lastIndexOf('return createCorsResponse('));
    for (const key of ['enabled,', 'skipped,', 'notFound,', 'failed,']) {
      expect(body, key).toContain(`\n          ${key}`);
    }
  });

  it('gates a write to the shared catalogue on a platform admin, not a manager', () => {
    // master_product_models and master_product_accessories carry NO tenant_id,
    // so a write here changes what every dealer sees.
    for (const marker of [
      "resource === 'import-enhanced'",
      "resource === 'models' && !resourceId",
      "req.method === 'PATCH'",
    ]) {
      expect(branch(catalogCode, marker), marker).toMatch(/requireCatalogOwner\(\)/);
    }
    expect(catalogCode).toMatch(/const requireCatalogOwner = \(\) => requirePlatformAdmin\(ctx\)/);
  });

  it('gates enabling a product for the tenant on a manager', () => {
    for (const marker of ["resourceId === 'bulk-enable'", "action === 'enable'"]) {
      expect(branch(catalogCode, marker), marker).toMatch(/requireManager\(\)/);
    }
    expect(catalogCode).toMatch(
      /const requireManager = \(\) => requireRoleLevel\(ctx, ROLE_LEVEL\.MANAGER\)/,
    );
  });

  it('rethrows a non-role failure rather than answering 403', () => {
    // A catch that 403s on any failure turns a database outage into "your role
    // is too low".
    const deny = catalogCode.slice(catalogCode.indexOf('const deny = '));
    const end = deny.indexOf('const url = new URL');
    expect(deny.slice(0, end)).toMatch(/throw err;/);
  });

  it('scopes every enabled_products write to the tenant', () => {
    const writes = [...catalogCode.matchAll(/\.from\('enabled_products'\)([\s\S]{0,400})/g)];
    expect(writes.length).toBeGreaterThan(2);

    for (const [, chain] of writes) {
      if (/\.update\(|\.delete\(/.test(chain)) {
        expect(chain).toMatch(/\.eq\('tenant_id', tenantId\)/);
      }
      if (/\.insert\(/.test(chain)) {
        expect(chain).toMatch(/tenant_id: tenantId/);
      }
    }
  });

  it('refuses an unknown model sub-resource instead of answering the parent', () => {
    expect(catalogCode).toMatch(/Unknown catalog sub-resource/);
  });

  it('pages every unbounded read rather than taking one PostgREST page', () => {
    // A master catalogue runs to thousands of rows and the page's select-all
    // bulk enable acts on the whole filtered list. Walk the sites rather than
    // counting fetchAllRows calls: a total is not a property, and one read
    // added without paging keeps the count up.
    const sites = [...catalogCode.matchAll(/\.from\('master_product_\w+'\)/g)];
    expect(sites.length).toBeGreaterThan(3);
    let readsChecked = 0;

    for (const site of sites) {
      const at = site.index ?? 0;
      const before = catalogCode.slice(Math.max(0, at - 300), at);
      const chain = catalogCode.slice(at, at + 500);
      // Only a READ can be truncated. The operation immediately after .from()
      // is what decides - a trailing .select() on an insert is its RETURNING
      // clause, not a query.
      const firstOp = /\.from\('master_product_\w+'\)\s*\.(\w+)\(/.exec(chain)?.[1];
      if (firstOp !== 'select') continue;
      const paged = /fetchAllRows[<(]/.test(before);
      // A read that can only return one row needs no paging, and neither does
      // one bounded by the caller's own id list.
      const bounded = /\.maybeSingle\(\)|\.single\(\)/.test(chain) || /\.in\('id',/.test(chain);
      readsChecked++;
      expect(paged || bounded, `unpaged master read at offset ${at}`).toBe(true);
    }

    // A walk that stops matching must fail rather than pass in silence.
    expect(readsChecked).toBeGreaterThan(3);
  });

  it('reads the result of the import insert rather than counting the request', () => {
    const importFn = catalogCode.slice(catalogCode.indexOf('async function importMasterCatalog'));
    expect(importFn).toMatch(/const \{ data: insertedRows, error \} = await admin/);
    expect(importFn).toMatch(/created = insertedRows\?\.length \?\? 0/);
    // Not `created = toInsert.length`.
    expect(importFn).not.toMatch(/created = toInsert\.length/);
  });

  it('caps the uploaded CSV and requires a real file', () => {
    const importFn = catalogSrc.slice(catalogSrc.indexOf('async function importMasterCatalog'));
    expect(importFn).toMatch(/file instanceof File/);
    expect(importFn).toMatch(/MAX_IMPORT_BYTES/);
  });
});

describe('the Express half is retired, not shadowed', () => {
  it('routes-catalog.ts is gone', () => {
    expect(existsSync(join(ROOT, 'server/routes-catalog.ts'))).toBe(false);
  });

  it('nothing mounts it', () => {
    const registry = stripComments(readFileSync(REGISTRY, 'utf8'));
    expect(registry).not.toMatch(/registerCatalogRoutes/);
    expect(registry).not.toMatch(/catalogRouter/);

    const domains = stripComments(readFileSync(join(ROOT, 'server/domains/products.ts'), 'utf8'));
    expect(domains).not.toMatch(/routes-catalog'/);
  });

  it('no Express router serves /api/catalog any more', () => {
    const csv = stripComments(readFileSync(join(ROOT, 'server/routes-catalog-csv.ts'), 'utf8'));
    expect(csv).not.toMatch(/'\/api\/catalog/);
    // The cost-per-copy rates in that file are a different prefix and survive.
    expect(csv).toMatch(/'\/api\/product-models\/:modelId\/cpc-rates'/);
  });

  it('both prefixes are proxied so dev runs what production runs', () => {
    const proxy = readFileSync(PROXY, 'utf8');
    expect(proxy).toMatch(/'\/api\/catalog': 'catalog',/);
    expect(proxy).toMatch(/'\/api\/enabled-products': 'enabled-products',/);
  });
});

describe('enabled products reach the page in the shape it reads', () => {
  it('camelises the rows it returns', () => {
    const src = stripComments(readFileSync(ENABLED_FN, 'utf8'));
    const list = src.slice(src.indexOf("req.method === 'GET' && !productId"));
    const end = list.indexOf("req.method === 'GET' && productId");
    expect(list.slice(0, end)).toMatch(/toCamelShallow\(row\)/);
  });

  it('the page tolerates the { data, total } envelope', () => {
    // The default queryFn stored the ENVELOPE, so `enabledProducts.some(...)`
    // threw in production and the whole page went to its error boundary.
    const page = readFileSync(PAGE, 'utf8');
    const query = page.slice(page.indexOf("queryKey: ['/api/enabled-products'],"));
    expect(query.slice(0, query.indexOf('});'))).toMatch(/extractRecords<EnabledProduct>/);
  });
});
