/**
 * COP-M01: the sidebar pointed at the hand-rolled CRM lists, so CRM-001..010's
 * shell pages - saved-view tabs, table/board toggle, advanced filters, column
 * picker, bulk selection, inline editing, capped CSV export - were reachable
 * only by typing the URL. `/crm/leads` sat in docs/unlinked-routes-baseline.json
 * the whole time, which is CRMX-016's "a whole feature ships behind a missing
 * link" one layer up.
 *
 * AC2 says to confirm parity BEFORE switching, and that is what these assert.
 * The substantive one is the last: every column the Leads table advertises has
 * to be a key its endpoint can actually return. Four of the seven defaults were
 * not - the registry was written against `business_records` while the endpoint
 * reads `companies` (COP-B00's open contradiction), and that table has no
 * priority, lead source, estimated value or owner. Two of the four were marked
 * `editable`, so inline-editing them posted a field nothing could store.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { companies } from '../../../shared/drizzle-schema';
import { join } from 'path';

const ROOT = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const SIDEBAR = read('client/src/components/layout/RoleAwareCollapsibleSidebar.tsx');
const APP = read('client/src/App.tsx');
const REGISTRY = read('client/src/lib/crm-object-registry.ts');
const MAPPER = read('supabase/functions/business-records/index.ts');

describe('the Sales Hub points at the shell pages', () => {
  it('has a corpus to check', () => {
    expect(SIDEBAR).toContain("id: 'crm'");
    expect(SIDEBAR.length).toBeGreaterThan(5000);
  });

  it('routes Leads, Contacts and Customers to /crm/*', () => {
    for (const [title, path] of [
      ['Leads', '/crm/leads'],
      ['Contacts', '/crm/contacts'],
      ['Customers', '/crm/companies'],
    ]) {
      expect(SIDEBAR).toContain(`{ title: '${title}', path: '${path}'`);
    }
  });

  it('no longer points them at the legacy lists', () => {
    for (const legacy of ["path: '/leads-management'", "path: '/customers'"]) {
      expect(SIDEBAR).not.toContain(legacy);
    }
    // '/contacts' is a prefix of nothing else here, so it is matched exactly.
    expect(SIDEBAR).not.toMatch(/path: '\/contacts'/);
  });

  it('keeps the legacy paths in matchPatterns so deep links stay expanded', () => {
    for (const pattern of ["'/leads*'", "'/contacts*'", "'/customers*'", "'/crm*'"]) {
      expect(SIDEBAR).toContain(pattern);
    }
  });

  it('leaves the legacy pages routed, which COP-E03 retires separately', () => {
    for (const route of ['path="/leads-management"', 'path="/contacts"', 'path="/customers"']) {
      expect(APP).toContain(route);
    }
  });

  it('routes the three shell pages it now links to', () => {
    for (const route of ['path="/crm/leads"', 'path="/crm/contacts"', 'path="/crm/companies"']) {
      expect(APP).toContain(route);
    }
  });
});

describe('the Leads table advertises only columns its endpoint returns', () => {
  /** The leads slice of the registry, between its own marker and the next object. */
  const leadsChunk = (() => {
    const at = REGISTRY.indexOf("objectType: 'leads'");
    const end = REGISTRY.indexOf("objectType: 'contacts'");
    expect(at).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(at);
    return REGISTRY.slice(at, end);
  })();

  /** Keys `toBusinessRecord` emits, plus the `companies` columns it spreads. */
  const emitted = (() => {
    const mapperStart = MAPPER.indexOf('...company,');
    const mapperEnd = MAPPER.indexOf('export default async function handler');
    const block = MAPPER.slice(mapperStart, mapperEnd);
    return new Set([...block.matchAll(/^\s{4}([A-Za-z_][A-Za-z0-9_]*):/gm)].map((m) => m[1]));
  })();

  it('reads a mapper with something in it', () => {
    expect(emitted.size).toBeGreaterThan(15);
    expect(emitted.has('companyName')).toBe(true);
  });

  it('every default column is a key the mapper emits', () => {
    // Bounded to the array itself: a fixed character window runs past the
    // closing bracket into quickFilters and reads their labels as columns.
    const from = leadsChunk.indexOf('defaultColumns: [');
    expect(from).toBeGreaterThan(-1);
    const array = leadsChunk.slice(from, leadsChunk.indexOf(']', from) + 1);
    const defaults = [...array.matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1]);
    expect(defaults.length).toBeGreaterThan(3);
    for (const column of defaults) {
      expect({ column, emitted: emitted.has(column) }).toEqual({ column, emitted: true });
    }
  });

  it('offers only quick filters the endpoint reads', () => {
    // The handler reads limit, offset, ownerId, recordType, scope, search and
    // status. Priority and Source were sent and ignored, so the list came back
    // unchanged and the control looked like it worked.
    const keys = [...leadsChunk.matchAll(/serverKey: '([a-zA-Z_]+)'/g)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(0);
    const supported = new Set(['status', 'recordType', 'scope', 'search', 'ownerId']);
    for (const key of keys) {
      expect({ key, supported: supported.has(key) }).toEqual({ key, supported: true });
    }
  });

  it('advertises none of the columns `companies` cannot hold', () => {
    // COP-B00 restores these by settling which table the CRM runs on; until
    // then an empty column a user can pick reads as "no data yet" rather than
    // "this does not exist".
    //
    // Scoped to the `fields` array, which is the COLUMN list. `ownerId` still
    // appears further down in defaultViews ("My Leads"), and that one works:
    // the endpoint maps the ownerId parameter onto created_by, since companies
    // has no owner_id either.
    const fieldsFrom = leadsChunk.indexOf('fields: [');
    const fieldsTo = leadsChunk.indexOf('defaultColumns: [');
    expect(fieldsFrom).toBeGreaterThan(-1);
    expect(fieldsTo).toBeGreaterThan(fieldsFrom);
    const columns = leadsChunk.slice(fieldsFrom, fieldsTo);
    for (const absent of ['priority', 'leadSource', 'estimatedAmount', 'ownerId']) {
      expect(columns).not.toContain(`field: '${absent}'`);
    }
  });

  it('emits createdAt, which the spread only carried in snake_case', () => {
    expect(MAPPER).toContain('createdAt: company.created_at');
  });
});

describe('bulk operations survive the switch', () => {
  const CONTACTS_PAGE = read('client/src/pages/CrmContactsPage.tsx');
  const LEGACY_CONTACTS = read('client/src/pages/Contacts.tsx');

  it('carries the legacy Delete action onto the canonical page', () => {
    // The shell renders its toolbar only when bulkActions is non-empty, so a
    // page that omits the prop offers selection and nothing to do with it.
    expect(CONTACTS_PAGE).toContain('bulkActions={bulkActions}');
    expect(CONTACTS_PAGE).toContain("id: 'delete'");
    expect(CONTACTS_PAGE).toContain('requiresConfirmation: true');
  });

  it('does not carry the three placebo actions', () => {
    // The legacy page's Send Email, Edit Properties and Assign Owner each
    // raised a toast saying what they would do and did nothing. Porting them
    // would move three controls that report success and change nothing.
    for (const placebo of ["id: 'email'", "id: 'edit'", "id: 'assign'"]) {
      expect(LEGACY_CONTACTS).toContain(placebo);
      expect(CONTACTS_PAGE).not.toContain(placebo);
    }
  });

  it('reports what actually deleted rather than what was selected', () => {
    // Promise.allSettled, not Promise.all: one failure must not hide the rest,
    // and the count in the toast has to be what went.
    expect(CONTACTS_PAGE).toContain('Promise.allSettled');
    expect(CONTACTS_PAGE).toMatch(/failed === 0/);
  });
});

/**
 * COP-M01 AC2, the two objects the block above only ever hand-checked.
 *
 * CLAUDE.md's own rule for this story is "before repointing any nav entry at a
 * registry-driven page, run that comparison for the object", and it was run for
 * contacts and companies by reading them once. A hand check goes stale the
 * moment either mapper is edited, which is the same liability the story found in
 * the leads registry: four default columns the endpoint could never return.
 *
 * The two objects need DIFFERENT rules, and the difference is the trap CLAUDE.md
 * names - "the spread at the top of one carries the raw column names and reads
 * like coverage":
 *
 *   - `company-contacts` maps through toContactResponse and spreads NOTHING, so
 *     every advertised column must be an explicit key.
 *   - `companies` spreads the raw PostgREST row and THEN applies toCamelAliases,
 *     so a column is also covered when its database name is identical to the
 *     camelCase key. That holds only for single-word columns: `industry` and
 *     `website` arrive, `customer_number` does not, which is why the alias map
 *     exists at all. Encoding it as "no underscore in the column name" is what
 *     makes the rule fail on the next multi-word column somebody advertises.
 */
describe('the Contacts and Companies tables advertise only what their endpoints return', () => {
  const CONTACTS_FN = read('supabase/functions/company-contacts/index.ts');
  const COMPANIES_FN = read('supabase/functions/companies/index.ts');

  /** One object's slice of the registry, bounded by the next objectType marker. */
  const chunkFor = (objectType: string, next: string | null) => {
    const at = REGISTRY.indexOf(`objectType: '${objectType}'`);
    expect(at).toBeGreaterThan(-1);
    const end = next ? REGISTRY.indexOf(`objectType: '${next}'`) : REGISTRY.length;
    expect(end).toBeGreaterThan(at);
    return REGISTRY.slice(at, end);
  };

  /** The defaultColumns ARRAY, never a fixed window - it runs into quickFilters. */
  const defaultColumnsIn = (chunk: string) => {
    const from = chunk.indexOf('defaultColumns: [');
    expect(from).toBeGreaterThan(-1);
    const array = chunk.slice(from, chunk.indexOf(']', from) + 1);
    const columns = [...array.matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1]);
    expect(columns.length).toBeGreaterThan(3);
    return columns;
  };

  /** Keys the companies list handler writes directly into each record. */
  const keysInRecordLiteral = () => {
    const from = COMPANIES_FN.indexOf('.map((company: any) => ({');
    expect(from).toBeGreaterThan(-1);
    const to = COMPANIES_FN.indexOf('}));', from);
    expect(to).toBeGreaterThan(from);
    const body = COMPANIES_FN.slice(from, to);
    return new Set([...body.matchAll(/^\s{8}([A-Za-z_][A-Za-z0-9_]*):/gm)].map((m) => m[1]));
  };

  /** Keys an object-literal mapper function emits, bound to that function body. */
  const keysEmittedBy = (source: string, fnName: string) => {
    const from = source.indexOf(`function ${fnName}(`);
    expect(from).toBeGreaterThan(-1);
    const to = source.indexOf('\n}', from);
    expect(to).toBeGreaterThan(from);
    const body = source.slice(from, to);
    return new Set([...body.matchAll(/^\s{4}([A-Za-z_][A-Za-z0-9_]*):/gm)].map((m) => m[1]));
  };

  it('contacts: every default column is an explicit key of toContactResponse', () => {
    const emitted = keysEmittedBy(CONTACTS_FN, 'toContactResponse');
    expect(emitted.size).toBeGreaterThan(10);
    // No spread to fall back on, so this list is the whole contract.
    expect(CONTACTS_FN.slice(CONTACTS_FN.indexOf('function toContactResponse('))).not.toMatch(
      /return \{\s*\.\.\./,
    );
    for (const column of defaultColumnsIn(chunkFor('contacts', 'companies'))) {
      expect({ column, emitted: emitted.has(column) }).toEqual({ column, emitted: true });
    }
  });

  it('companies: every default column is an explicit key or a single-word column', () => {
    // The handler emits keys in TWO places - the inline record literal
    // (companyName, city, state, ...) and toCamelAliases - so the explicit half
    // of the contract is their union. Reading only the alias function would
    // report a column the literal covers as missing, and a hard check that
    // reports correct code is where a real finding hides.
    const explicit = new Set([
      ...keysEmittedBy(COMPANIES_FN, 'toCamelAliases'),
      ...keysInRecordLiteral(),
    ]);
    expect(explicit.size).toBeGreaterThan(15);

    // `...company,` is the RAW PostgREST row, and it is the only reason a
    // column with no alias arrives at all. The alias spread beneath it is a
    // different construct and asserting that one instead proves nothing about
    // this rule - mutation testing is what said so.
    expect(COMPANIES_FN).toMatch(/\.map\(\(company: any\) => \(\{\s*\.\.\.company,/);

    const tableColumns = new Set(getTableConfig(companies).columns.map((c) => c.name));
    expect(tableColumns.size).toBeGreaterThan(20);

    for (const column of defaultColumnsIn(chunkFor('companies', null))) {
      // A raw-row spread only carries a column whose STORED name is the key, so
      // `industry` arrives and `tax_state` does not.
      const viaSpread = !column.includes('_') && tableColumns.has(column);
      expect({ column, covered: explicit.has(column) || viaSpread }).toEqual({
        column,
        covered: true,
      });
    }
  });

  it.each([
    ['contacts', 'companies', CONTACTS_FN, ['companyId', 'department', 'leadStatus', 'ownerId']],
    ['companies', null, COMPANIES_FN, ['industry']],
  ])('%s: offers only quick filters the handler applies', (objectType, next, fn, applied) => {
    // Both handlers parse through _shared/crm-list-query.ts and then apply each
    // filter by hand, so a spec entry the handler never applies is COP-M01's "a
    // control that appears to work", which beats a missing one for damage.
    //
    // Bound to the .eq() CALL, not to the identifier: `expect(fn).toContain(
    // 'q.filters.' + key)` passes while the key is merely logged, and mutation
    // testing is what said so. The limit worth stating is that no source check
    // can see a filter sitting inside a branch that never runs - deleting or
    // renaming the application is caught, `if (false)` is not.
    const keys = [...chunkFor(objectType, next).matchAll(/serverKey: '([a-zA-Z_]+)'/g)].map(
      (m) => m[1],
    );
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect({ key, applied: applied.includes(key) }).toEqual({ key, applied: true });
      const eqCall = new RegExp(`\\.eq\\(\\s*'[a-z_]+',\\s*q\\.filters\\.${key}\\s*\\)`);
      expect({ key, appliedToQuery: eqCall.test(fn) }).toEqual({ key, appliedToQuery: true });
    }
  });
});
