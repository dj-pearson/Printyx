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
