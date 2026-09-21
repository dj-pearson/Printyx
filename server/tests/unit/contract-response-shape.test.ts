/**
 * Round 140 - the Contracts tab rendered nothing for every customer.
 *
 * `supabase/functions/contracts/` selected '*' and answered the raw PostgREST
 * row, while CustomerContracts.tsx reads camelCase. `contractNumber` was
 * therefore undefined on every contract, and the filter said
 *
 *   matchesSearch = a?.toLowerCase().includes(t) || b?.toLowerCase().includes(t)
 *
 * which is `undefined` - not `false` and not `true` - when both fields are
 * absent. `undefined && matchesStatus` is falsy, so filteredContracts was
 * EMPTY whatever the user typed, including nothing. The tab looked like a
 * customer with no contracts.
 *
 * Camelising was safe for every caller and that was checked rather than
 * assumed: four pages normalise with `row.contract_number || row.contractNumber
 * || ''`, two read camelCase only (and were broken), and iOS sets
 * `.convertFromSnakeCase`, which only rewrites keys containing an underscore
 * and so leaves an already-camel key alone.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../..');
const EDGE = resolve(ROOT, 'supabase/functions/contracts/index.ts');
const PAGE = resolve(ROOT, 'client/src/components/customer/CustomerContracts.tsx');

const read = (p: string) => readFileSync(p, 'utf8');
const strip = (src: string) =>
  src.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ' ');

/**
 * The columns `contracts` really has: migration 0000 creates twelve and 0070
 * adds four. Derived from the chain rather than from the Drizzle declaration,
 * because when the two disagree the live shape is the one that answers.
 */
function contractColumns(): Set<string> {
  const dir = resolve(ROOT, 'drizzle/migrations');
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const cols = new Set<string>();
  for (const f of files) {
    const sql = readFileSync(resolve(dir, f), 'utf8');
    const create = /CREATE TABLE (?:IF NOT EXISTS )?"contracts" \(([\s\S]*?)\n\);/.exec(sql);
    if (create) {
      for (const m of create[1].matchAll(/^\s*"([a-z_]+)"/gm)) cols.add(m[1]);
    }
    const alter = /ALTER TABLE "contracts"([\s\S]*?);/g;
    for (const m of sql.matchAll(alter)) {
      for (const c of m[1].matchAll(/ADD COLUMN (?:IF NOT EXISTS )?"([a-z_]+)"/g)) cols.add(c[1]);
    }
  }
  return cols;
}

const snakeOf = (camel: string) => camel.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());

describe('the contracts table', () => {
  const cols = contractColumns();

  it('is read from the migration chain, not guessed', () => {
    // Floor: a regex that stops matching would otherwise report every field
    // as phantom and this suite would "pass" by deleting the feature.
    expect(cols.size).toBeGreaterThanOrEqual(16);
    for (const c of ['contract_number', 'start_date', 'end_date', 'status', 'monthly_base']) {
      expect(cols.has(c), `${c} must be a real column`).toBe(true);
    }
  });

  it('has none of the columns the page used to claim', () => {
    // If one of these ever lands, this test fails and the field can come back
    // - which is the point of asserting the absence rather than commenting it.
    for (const c of [
      'contract_type',
      'auto_renewal',
      'renewal_terms',
      'total_contract_value',
      'current_monthly_billing',
      'last_billing_date',
      'next_billing_date',
      'equipment_count',
    ]) {
      expect(cols.has(c), `${c} exists now - restore the field that read it`).toBe(false);
    }
  });
});

describe('the contracts edge function', () => {
  const src = strip(read(EDGE));

  it('camelises every branch that returns rows', () => {
    expect(src).toMatch(/import \{ toCamel \} from '\.\.\/_shared\/case\.ts'/);

    // WALK THE SITES. A count is not a property: there are eight camel() calls
    // here, so asserting ">= 5" stayed green with the LIST branch - the one the
    // whole defect was about - handing back raw rows again.
    const branches: [string, RegExp][] = [
      // the list mapper
      ['list', /data: \(enriched \|\| \[\]\)\.map\(\(c: any\) => \(\{\s*\.\.\.camel</],
      // the tiered-rates sub-resource
      ['tiered-rates', /return createCorsResponse\(camel\(rates \|\| \[\]\), 200, req\)/],
    ];
    for (const [label, re] of branches) {
      expect(src, `${label} branch must camelise`).toMatch(re);
    }

    // Every `{ ...contract, tieredRates: ... }` response - single, create,
    // update - goes through camel on BOTH halves.
    const spreads = [
      ...src.matchAll(/\{\s*\.\.\.([A-Za-z<>,\s]*?)\(contract\), tieredRates: ([^}]*?)\}/g),
    ];
    expect(spreads.length, 'expected the single/create/update responses').toBe(3);
    for (const m of spreads) {
      expect(m[1]).toContain('camel');
      expect(m[2]).toContain('camel(');
    }
  });

  it('derives hasTieredRates in one batched query, not per contract', () => {
    expect(src).toMatch(/hasTieredRates: tieredIds\.has\(/);
    // A per-row lookup would sit inside the map callback.
    const mapBody = /data: \(enriched \|\| \[\]\)\.map\(([\s\S]*?)\n          \}\)\)/.exec(src);
    expect(mapBody, 'list mapper not found').not.toBeNull();
    expect(mapBody![1]).not.toMatch(/await/);
    expect(src).toMatch(/\.in\('contract_id', ids\)/);
  });

  it('scopes the tiered-rates lookup to the tenant', () => {
    const at = src.indexOf("from('contract_tiered_rates')");
    expect(at).toBeGreaterThan(-1);
    expect(src.slice(at, src.indexOf('.in(', at))).toMatch(/\.eq\('tenant_id', tenantId\)/);
  });
});

describe('the Contracts tab', () => {
  const raw = read(PAGE);
  const src = strip(raw);

  it('every field its Contract interface declares is a real column or derived', () => {
    const iface = /interface Contract \{([\s\S]*?)\n\}/.exec(src);
    expect(iface, 'Contract interface not found').not.toBeNull();
    const fields = [...iface![1].matchAll(/^\s{2}([a-zA-Z]+)\??:/gm)].map((m) => m[1]);
    expect(fields.length).toBeGreaterThanOrEqual(10);

    const cols = contractColumns();
    const derived = new Set(['hasTieredRates']);
    for (const f of fields) {
      if (derived.has(f)) continue;
      expect(cols.has(snakeOf(f)), `${f} maps to no column on contracts`).toBe(true);
    }
  });

  it('an empty search term matches every contract', () => {
    // The whole defect: `a?.x() || b?.x()` is undefined when the fields are
    // absent, so nothing ever passed the filter.
    expect(src).toMatch(/term === '' \|\|/);
    expect(src).not.toMatch(/contract\.contractType/);
  });

  it('does not format a null date', () => {
    // start_date and end_date are nullable since 0070, and format() throws
    // "Invalid time value" rather than rendering a blank.
    expect(src).not.toMatch(/format\(new Date\(contract\.(startDate|endDate)\)/);
    expect(src).not.toMatch(/format\(new Date\(selectedContract\.(startDate|endDate)\)/);
    expect(src).toMatch(/const formatDate = \(value\?: string\)/);
  });

  it('claims nothing about renewal, which no column records', () => {
    expect(src).not.toMatch(/autoRenewal/);
    expect(src).not.toMatch(/renewalTerms/);
    expect(src).not.toMatch(/Renewal coming up/);
    // The expiry alert stays, because end_date is real.
    expect(src).toMatch(/Expires within 3 months/);
  });

  it('shows the per-click block on the rates themselves, not on a missing type', () => {
    expect(src).toMatch(
      /selectedContract\.blackRate != null \|\| selectedContract\.colorRate != null/,
    );
  });
});
