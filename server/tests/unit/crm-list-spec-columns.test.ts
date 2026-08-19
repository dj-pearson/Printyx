// COP-M01: every physical column a CRM list spec names must exist on the table.
//
// This is the guard for the fault that keeps recurring in this codebase — a
// query, a registry config or a form built against a column name that is not
// there. It is checked against the Drizzle table definitions rather than a
// hand-written list, so it cannot go stale: rename a column in shared/schema.ts
// and this fails until the spec follows.
//
// The concrete bug behind it: the companies edge function searched
// `email.ilike.%term%` and companies has no email column, so PostgREST answered
// 42703 and every company search returned 500 — the CRM companies page and the
// quote builder's customer picker, in dev as well as production.
import { describe, it, expect } from 'vitest';
import { getTableColumns } from 'drizzle-orm';

import { companies, companyContacts } from '@shared/schema';
import { COMPANY_LIST_SPEC, CONTACT_LIST_SPEC, type CrmListSpec } from '../../lib/crm-list-query';

/** Physical column names on a Drizzle table. */
function physicalColumns(table: any): Set<string> {
  return new Set(Object.values(getTableColumns(table)).map((c: any) => c.name));
}

/** TypeScript property names on a Drizzle table — what a selected row is keyed by. */
function tsColumns(table: any): Set<string> {
  return new Set(Object.keys(getTableColumns(table)));
}

const cases: Array<[string, CrmListSpec, any]> = [
  ['contacts', CONTACT_LIST_SPEC, companyContacts],
  ['companies', COMPANY_LIST_SPEC, companies],
];

describe.each(cases)('%s list spec', (_name, spec, table) => {
  const physical = physicalColumns(table);
  const ts = tsColumns(table);

  it('sorts only by columns that exist', () => {
    const missing = Object.values(spec.sortFields).filter((column) => !physical.has(column));
    expect(missing).toEqual([]);
  });

  it('names each sortable field the way a Drizzle row is keyed', () => {
    const missing = Object.keys(spec.sortFields).filter((field) => !ts.has(field));
    expect(missing).toEqual([]);
  });

  it('maps each sortable field to that field own column, not another', () => {
    const columns = getTableColumns(table) as Record<string, { name: string }>;
    for (const [field, column] of Object.entries(spec.sortFields)) {
      expect(columns[field]?.name).toBe(column);
    }
  });

  it('searches only columns that exist', () => {
    const missing = spec.searchColumns.filter((column) => !physical.has(column));
    expect(missing).toEqual([]);
  });

  it('names each search field the way a Drizzle row is keyed', () => {
    const missing = spec.searchFields.filter((field) => !ts.has(field));
    expect(missing).toEqual([]);
  });

  it('has a default sort field that is itself sortable', () => {
    expect(spec.sortFields[spec.defaultSortField]).toBeDefined();
  });
});

describe('the guard actually catches a phantom column', () => {
  const physical = physicalColumns(companies);

  it('confirms companies has no email column', () => {
    expect(physical.has('email')).toBe(false);
    expect(physical.has('phone')).toBe(true);
    expect(physical.has('fax')).toBe(true);
    expect(physical.has('website')).toBe(true);
  });

  it('confirms the names the registry used to bind are not columns', () => {
    for (const phantom of ['name', 'city', 'state', 'employee_count', 'owner_id']) {
      expect(physical.has(phantom)).toBe(false);
    }
    // ...and that the ones it binds now are.
    for (const real of ['business_name', 'billing_city', 'billing_state', 'employees']) {
      expect(physical.has(real)).toBe(true);
    }
  });

  it('confirms company_contacts has no is_active column', () => {
    const contactColumns = physicalColumns(companyContacts);
    expect(contactColumns.has('is_active')).toBe(false);
    expect(contactColumns.has('is_primary_contact')).toBe(true);
    expect(contactColumns.has('title')).toBe(true);
    expect(contactColumns.has('job_title')).toBe(false);
  });
});
