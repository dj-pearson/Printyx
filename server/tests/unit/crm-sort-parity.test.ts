/**
 * COP-I01 AC4: "Server-side pagination, filtering, and sorting on every CRM
 * index endpoint."
 *
 * Pagination and filtering were there. SORTING was not, on two of the four
 * objects, and both failed the same way - silently.
 *
 *  - The LEADS index (served by `business-records`) read no sort parameter at
 *    all and issued a hardcoded `.order('created_at', { ascending: false })`,
 *    while CrmDataTable sends sortBy and sortOrder on every request. All seven
 *    column headers the registry marked sortable did nothing: the arrow
 *    flipped, a request went out, and the same page came back. That branch also
 *    had no LIMIT CLAMP, so a caller asking for 5,000 rows got 5,000 on the
 *    endpoint behind the primary CRM list.
 *  - The DEALS index marked `stage` sortable against a spec with no `stage`
 *    entry, so that one header fell back to the default sort while the other
 *    eighteen worked.
 *
 * A sort whitelist is the FOURTH string in COP-M01's contract. The registry
 * names a field, the mapper emits a key, the write path accepts a column - and
 * the sort spec has to resolve the same name the registry sends, which is the
 * MAPPER's vocabulary and not the table's. Reusing COMPANY_LIST_SPEC for leads
 * would have fallen back on three of five (companyName vs businessName, status
 * vs activity, city vs billingCity): the defect wearing a fix's clothes.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  CONTACT_LIST_SPEC,
  COMPANY_LIST_SPEC,
  DEAL_LIST_SPEC,
  LEAD_LIST_SPEC,
  MAX_CRM_PAGE_SIZE,
  parseCrmListQuery,
  type CrmListSpec,
} from '../../lib/crm-list-query';

const ROOT = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
/**
 * Comments stripped on BOTH sides, which this repo has now had to learn eight
 * times in one session: the annotation explaining why `stage` is no longer
 * sortable QUOTES `sortable: true`, so a walk over the raw source reports the
 * explanation as the defect.
 */
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const REGISTRY = stripComments(read('client/src/lib/crm-object-registry.ts'));

/** Each CRM object, the spec its endpoint parses with, and the next marker. */
const OBJECTS: Array<[string, string | null, CrmListSpec]> = [
  ['deals', 'leads', DEAL_LIST_SPEC],
  ['leads', 'contacts', LEAD_LIST_SPEC],
  ['contacts', 'companies', CONTACT_LIST_SPEC],
  ['companies', null, COMPANY_LIST_SPEC],
];

/** One object's slice of the registry, bounded by the next objectType. */
function chunkFor(objectType: string, next: string | null): string {
  const at = REGISTRY.indexOf(`objectType: '${objectType}'`);
  expect(at).toBeGreaterThan(-1);
  const end = next ? REGISTRY.indexOf(`objectType: '${next}'`) : REGISTRY.length;
  expect(end).toBeGreaterThan(at);
  return REGISTRY.slice(at, end);
}

/**
 * Fields the registry marks sortable. Bounded per FIELD rather than by a
 * character window: a field object is short, but a window from `field: 'x'`
 * runs into the next field's flags and reports the wrong one as sortable.
 */
function sortableFields(chunk: string): string[] {
  const out: string[] = [];
  const marks = [...chunk.matchAll(/field: '([a-zA-Z]+)'/g)];
  for (let i = 0; i < marks.length; i++) {
    const from = marks[i].index!;
    const to = i + 1 < marks.length ? marks[i + 1].index! : chunk.length;
    // NOT anchored to a newline: three of the leads fields are written on ONE
    // LINE (`{ field: 'city', ..., sortable: true, ... }`), and requiring a
    // preceding newline missed all three - the same line-anchored blind spot
    // check:no-random-metrics records in its own header. The per-field
    // boundary above is what keeps this from reading the next field's flag.
    if (/\bsortable: true/.test(chunk.slice(from, to))) out.push(marks[i][1]);
  }
  return out;
}

describe('every sortable column is one its endpoint can actually sort by', () => {
  it.each(OBJECTS)('%s', (objectType, next, spec) => {
    const fields = sortableFields(chunkFor(objectType, next));
    // A walk that stops matching must fail rather than pass in silence.
    expect(fields.length).toBeGreaterThan(3);
    for (const field of fields) {
      // resolveSortField falls back to the default for an unlisted name, so
      // the check is membership in the whitelist, not "does it return a
      // column" - every name returns a column, which is the whole problem.
      expect({ objectType, field, inSpec: field in spec.sortFields }).toEqual({
        objectType,
        field,
        inSpec: true,
      });
    }
  });

  it.each(OBJECTS)('%s: every whitelisted column is snake_case', (_o, _n, spec) => {
    for (const column of Object.values(spec.sortFields)) {
      expect(column).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('keeps the two contact-derived lead fields OUT of the whitelist', () => {
    // PostgREST cannot order a parent by an embedded column, so a whitelist
    // entry for either would point at nothing and reintroduce the silent
    // fallback. They are sortable: false in the registry instead.
    expect(LEAD_LIST_SPEC.sortFields).not.toHaveProperty('primaryContactName');
    expect(LEAD_LIST_SPEC.sortFields).not.toHaveProperty('primaryContactEmail');
  });

  it('uses the business-records mapper vocabulary, not the companies one', () => {
    // The three that differ. Reusing COMPANY_LIST_SPEC would fall back on all
    // three while looking correct.
    expect(LEAD_LIST_SPEC.sortFields.companyName).toBe('business_name');
    expect(LEAD_LIST_SPEC.sortFields.status).toBe('activity');
    expect(LEAD_LIST_SPEC.sortFields.city).toBe('billing_city');
    expect(COMPANY_LIST_SPEC.sortFields).not.toHaveProperty('companyName');
  });
});

describe('the leads endpoint applies the sort and the clamp it never had', () => {
  const FN = read('supabase/functions/business-records/index.ts');
  const listBranch = () => {
    const at = FN.indexOf('// List records from companies table');
    expect(at).toBeGreaterThan(-1);
    return FN.slice(at, at + 4000);
  };

  it('orders by the parsed column, not a hardcoded one', () => {
    const body = listBranch();
    expect(body).toContain('parseCrmListQuery(url.searchParams, LEAD_LIST_SPEC)');
    expect(body).toContain('.order(q.sortColumn, { ascending: q.ascending })');
    expect(body).not.toMatch(/\.order\('created_at', \{ ascending: false \}\)/);
  });

  it('takes limit and offset from the parser, which clamps them', () => {
    const body = listBranch();
    expect(body).not.toMatch(/parseInt\(url\.searchParams\.get\('limit'\)/);
    expect(body).toContain('const limit = q.limit');
  });

  it('CLAMPS in fact, not just in the comment', () => {
    // Called, not read: the clamp is the parser's, so exercise it.
    const q = parseCrmListQuery(new URLSearchParams('limit=5000'), LEAD_LIST_SPEC);
    expect(q.limit).toBe(MAX_CRM_PAGE_SIZE);
  });

  it('resolves each sortable lead column to its real database column', () => {
    for (const [field, column] of Object.entries(LEAD_LIST_SPEC.sortFields)) {
      const q = parseCrmListQuery(
        new URLSearchParams(`sortBy=${field}&sortOrder=asc`),
        LEAD_LIST_SPEC,
      );
      expect({ field, sortColumn: q.sortColumn, ascending: q.ascending }).toEqual({
        field,
        sortColumn: column,
        ascending: true,
      });
    }
  });

  it('falls back rather than passing an unknown name to the database', () => {
    const q = parseCrmListQuery(new URLSearchParams('sortBy=drop table companies'), LEAD_LIST_SPEC);
    expect(q.sortColumn).toBe('created_at');
  });
});
