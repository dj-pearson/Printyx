// COP-M01 parity lock for the contacts list query.
//
// GET /api/company-contacts runs on Express in dev and on the company-contacts
// edge function in production. Before this story the two disagreed completely:
// Express returned every contact in the tenant unpaginated and ignored
// limit/offset/search/sortBy, while the edge function returned
// 400 "companyId query parameter is required" for the exact request the CRM
// contacts table makes — so the page listed nothing anywhere, since /api/company-contacts
// is proxied to the edge function in dev too.
//
// Both now read the query string through the same parser, duplicated as
// server/lib/contact-list-query.ts and
// supabase/functions/_shared/contact-list-query.ts. This suite imports both.
import { describe, it, expect } from 'vitest';

import * as node from '../../lib/crm-list-query';
import * as edge from '../../../supabase/functions/_shared/crm-list-query';

const bothParsers = [
  ['node', (q: any) => node.parseCrmListQuery(q, node.CONTACT_LIST_SPEC)] as const,
  ['edge', (q: any) => edge.parseCrmListQuery(q, edge.CONTACT_LIST_SPEC)] as const,
];

function parseBoth(qs: string) {
  const a = node.parseCrmListQuery(new URLSearchParams(qs), node.CONTACT_LIST_SPEC);
  const b = edge.parseCrmListQuery(new URLSearchParams(qs), edge.CONTACT_LIST_SPEC);
  expect(b).toEqual(a);
  return a;
}

function parseCompaniesBoth(qs: string) {
  const a = node.parseCrmListQuery(new URLSearchParams(qs), node.COMPANY_LIST_SPEC);
  const b = edge.parseCrmListQuery(new URLSearchParams(qs), edge.COMPANY_LIST_SPEC);
  expect(b).toEqual(a);
  return a;
}

describe('the sort whitelist matches across copies', () => {
  it('CONTACT_SORT_FIELDS is identical', () => {
    expect(edge.CONTACT_LIST_SPEC.sortFields).toEqual(node.CONTACT_LIST_SPEC.sortFields);
  });

  it('every mapped column is snake_case', () => {
    for (const column of Object.values(node.CONTACT_LIST_SPEC.sortFields)) {
      expect(column).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('defaults and limits are identical', () => {
    expect(edge.CONTACT_LIST_SPEC.defaultSortField).toBe(node.CONTACT_LIST_SPEC.defaultSortField);
    expect(edge.CONTACT_LIST_SPEC.defaultLimit).toBe(node.CONTACT_LIST_SPEC.defaultLimit);
    expect(edge.MAX_CRM_PAGE_SIZE).toBe(node.MAX_CRM_PAGE_SIZE);
  });

  it.each([
    ['firstName', 'firstName'],
    ['first_name', 'firstName'],
    ['isPrimaryContact', 'isPrimaryContact'],
    ['is_primary_contact', 'isPrimaryContact'],
    ['createdAt', 'createdAt'],
    // Not a column on company_contacts. Silently falling back beats handing an
    // unchecked identifier to either database.
    ['jobTitle', 'createdAt'],
    ['isActive', 'createdAt'],
    ['id; drop table company_contacts', 'createdAt'],
    ['', 'createdAt'],
  ])('resolveContactSortField(%j) -> %j in both copies', (raw, expected) => {
    expect(node.resolveSortField(node.CONTACT_LIST_SPEC, raw)).toBe(expected);
    expect(edge.resolveSortField(edge.CONTACT_LIST_SPEC, raw)).toBe(expected);
  });
});

describe('parseContactListQuery', () => {
  it('parses the query the CRM contacts table actually sends', () => {
    const q = parseBoth('limit=25&offset=50&sortBy=lastName&sortOrder=asc&search=alvarez');
    expect(q).toMatchObject({
      limit: 25,
      offset: 50,
      page: 3,
      sortField: 'lastName',
      sortColumn: 'last_name',
      ascending: true,
      search: 'alvarez',
    });
  });

  it('defaults to 25 per page, newest first', () => {
    const q = parseBoth('');
    expect(q).toMatchObject({
      limit: 25,
      offset: 0,
      page: 1,
      sortField: 'createdAt',
      sortColumn: 'created_at',
      ascending: false,
      search: '',
    });
  });

  it('clamps limit into 1..200', () => {
    expect(parseBoth('limit=0').limit).toBe(1);
    expect(parseBoth('limit=-5').limit).toBe(1);
    expect(parseBoth('limit=100000').limit).toBe(200);
    expect(parseBoth('limit=abc').limit).toBe(25);
  });

  it('never produces a negative offset', () => {
    expect(parseBoth('offset=-40').offset).toBe(0);
    expect(parseBoth('page=0').offset).toBe(0);
    expect(parseBoth('page=-3').offset).toBe(0);
  });

  it('derives offset from page when offset is absent', () => {
    expect(parseBoth('page=4&limit=10').offset).toBe(30);
    expect(parseBoth('page=1&limit=10').offset).toBe(0);
  });

  it('prefers offset over page when both are sent', () => {
    const q = parseBoth('page=9&offset=10&limit=10');
    expect(q.offset).toBe(10);
    expect(q.page).toBe(2);
  });

  it('treats "all" as no filter, matching the quick-filter placeholder', () => {
    const q = parseBoth('department=all&leadStatus=all&ownerId=all&companyId=all');
    expect(q.filters).toEqual({
      department: null,
      leadStatus: null,
      ownerId: null,
      companyId: null,
    });
  });

  it('keeps real filter values', () => {
    const q = parseBoth('department=sales&leadStatus=qualified&companyId=c-42&ownerId=u-7');
    expect(q.filters).toEqual({
      department: 'sales',
      leadStatus: 'qualified',
      companyId: 'c-42',
      ownerId: 'u-7',
    });
  });

  it.each(bothParsers)('%s copy accepts a plain object as well as URLSearchParams', (_n, parse) => {
    expect(parse({ limit: '10', page: '2', sortBy: 'email', sortOrder: 'asc' })).toMatchObject({
      limit: 10,
      offset: 10,
      sortField: 'email',
      ascending: true,
    });
  });

  it('reads the first value when a plain object holds an array', () => {
    expect(node.parseCrmListQuery({ limit: ['10', '99'] }, node.CONTACT_LIST_SPEC).limit).toBe(10);
    expect(edge.parseCrmListQuery({ limit: ['10', '99'] }, edge.CONTACT_LIST_SPEC).limit).toBe(10);
  });
});

describe('sanitizeContactSearch', () => {
  it.each([
    ['alvarez', 'alvarez'],
    ['  spaced   out  ', 'spaced out'],
    // Every one of these ends a PostgREST or() filter early or changes the
    // pattern's meaning; none of them can be escaped.
    ['Smith, Jane', 'Smith Jane'],
    ['(ops)', 'ops'],
    ['100%', '100'],
    ['a*b', 'a b'],
    ['back\\slash', 'back slash'],
    ['"quoted"', 'quoted'],
    ["o'brien", 'o brien'],
    ['', ''],
    [null, ''],
    [undefined, ''],
  ])('sanitizeContactSearch(%j) -> %j in both copies', (raw, expected) => {
    expect(node.sanitizeSearchTerm(raw as any)).toBe(expected);
    expect(edge.sanitizeSearchTerm(raw as any)).toBe(expected);
  });

  it('caps the term at 100 characters', () => {
    const long = 'x'.repeat(500);
    expect(node.sanitizeSearchTerm(long)).toHaveLength(100);
    expect(edge.sanitizeSearchTerm(long)).toHaveLength(100);
  });

  it('a sanitized term can never close the or() grammar', () => {
    const term = node.sanitizeSearchTerm('a,b(c)d%e');
    expect(term).not.toMatch(/[,()%*\\"']/);
    expect(node.buildSearchOr(node.CONTACT_LIST_SPEC, term)).toBe(
      edge.buildSearchOr(edge.CONTACT_LIST_SPEC, term),
    );
  });
});

describe('buildContactSearchOr', () => {
  it('searches first name, last name and email', () => {
    expect(node.buildSearchOr(node.CONTACT_LIST_SPEC, 'lee')).toBe(
      'first_name.ilike.%lee%,last_name.ilike.%lee%,email.ilike.%lee%',
    );
    expect(edge.buildSearchOr(edge.CONTACT_LIST_SPEC, 'lee')).toBe(
      node.buildSearchOr(node.CONTACT_LIST_SPEC, 'lee'),
    );
  });

  it('is empty for an empty term, so the caller can skip the filter', () => {
    expect(node.buildSearchOr(node.CONTACT_LIST_SPEC, '')).toBe('');
    expect(edge.buildSearchOr(edge.CONTACT_LIST_SPEC, '')).toBe('');
  });
});

describe('contactMatchesSearch mirrors the PostgREST filter', () => {
  const rows = [
    { firstName: 'Rosa', lastName: 'Alvarez', email: 'r@northgate.example' },
    { firstName: 'Dan', lastName: 'Okafor', email: 'dan@ridgeline.example' },
    { firstName: null, lastName: 'Vance', email: null },
  ];

  it.each([
    ['alvarez', 1],
    ['ALVAREZ', 1],
    ['northgate', 1],
    ['a', 3],
    ['vance', 1],
    ['nobody', 0],
  ])('search %j matches %i row(s)', (term, count) => {
    const t = node.sanitizeSearchTerm(term);
    expect(rows.filter((r) => node.matchesSearch(node.CONTACT_LIST_SPEC, r, t))).toHaveLength(
      count,
    );
    expect(rows.filter((r) => edge.matchesSearch(edge.CONTACT_LIST_SPEC, r, t))).toHaveLength(
      count,
    );
  });

  it('an empty term matches everything', () => {
    expect(rows.every((r) => node.matchesSearch(node.CONTACT_LIST_SPEC, r, ''))).toBe(true);
    expect(rows.every((r) => edge.matchesSearch(edge.CONTACT_LIST_SPEC, r, ''))).toBe(true);
  });

  it('does not match on fields the or() filter leaves out', () => {
    const row = { firstName: 'Rosa', lastName: 'Alvarez', email: 'r@x.example', title: 'Manager' };
    expect(node.matchesSearch(node.CONTACT_LIST_SPEC, row, 'manager')).toBe(false);
    expect(edge.matchesSearch(edge.CONTACT_LIST_SPEC, row, 'manager')).toBe(false);
  });
});

describe('compareContacts', () => {
  const sortBoth = (rows: any[], field: string, asc: boolean) => {
    const a = [...rows].sort((x, y) => node.compareRecords(x, y, field, asc));
    const b = [...rows].sort((x, y) => edge.compareRecords(x, y, field, asc));
    expect(b).toEqual(a);
    return a;
  };

  it('sorts strings case-insensitively', () => {
    const rows = [{ lastName: 'okafor' }, { lastName: 'Alvarez' }, { lastName: 'Vance' }];
    expect(sortBoth(rows, 'lastName', true).map((r) => r.lastName)).toEqual([
      'Alvarez',
      'okafor',
      'Vance',
    ]);
  });

  it('reverses on descending', () => {
    const rows = [{ lastName: 'okafor' }, { lastName: 'Alvarez' }, { lastName: 'Vance' }];
    expect(sortBoth(rows, 'lastName', false).map((r) => r.lastName)).toEqual([
      'Vance',
      'okafor',
      'Alvarez',
    ]);
  });

  it('sorts dates chronologically, not as strings', () => {
    const rows = [
      { createdAt: new Date('2026-01-02T00:00:00Z') },
      { createdAt: new Date('2025-12-31T00:00:00Z') },
    ];
    expect(sortBoth(rows, 'createdAt', true)[0].createdAt.toISOString()).toBe(
      '2025-12-31T00:00:00.000Z',
    );
  });

  it('puts empties last ascending and first descending, like PostgREST', () => {
    const rows = [{ title: 'Manager' }, { title: null }, { title: 'Owner' }];
    expect(sortBoth(rows, 'title', true).map((r) => r.title)).toEqual(['Manager', 'Owner', null]);
    expect(sortBoth(rows, 'title', false).map((r) => r.title)).toEqual([null, 'Owner', 'Manager']);
  });

  it('sorts booleans false-then-true ascending', () => {
    const rows = [{ isPrimaryContact: true }, { isPrimaryContact: false }];
    expect(sortBoth(rows, 'isPrimaryContact', true).map((r) => r.isPrimaryContact)).toEqual([
      false,
      true,
    ]);
  });
});

// ─── Companies ─────────────────────────────────────────────────────────────

describe('COMPANY_LIST_SPEC', () => {
  it('is identical across copies', () => {
    expect(edge.COMPANY_LIST_SPEC).toEqual(node.COMPANY_LIST_SPEC);
  });

  // The bug this pins: the companies edge function searched
  // `email.ilike.%term%`, and companies has no email column, so PostgREST
  // answered 42703 and every company search — the CRM page and the quote
  // builder's customer picker alike — came back 500.
  it('does not search a column the companies table does not have', () => {
    expect(node.COMPANY_LIST_SPEC.searchColumns).not.toContain('email');
    expect(node.COMPANY_LIST_SPEC.searchFields).not.toContain('email');
  });

  it('pairs every physical search column with its camelCase field', () => {
    for (const spec of [node.CONTACT_LIST_SPEC, node.COMPANY_LIST_SPEC]) {
      expect(spec.searchFields).toHaveLength(spec.searchColumns.length);
      spec.searchColumns.forEach((column, i) => {
        const camel = column.replace(/_([a-z])/g, (_m, c) => c.toUpperCase());
        expect(spec.searchFields[i]).toBe(camel);
      });
    }
  });

  it('parses the query the CRM companies table sends', () => {
    const q = parseCompaniesBoth('limit=25&offset=0&sortBy=businessName&sortOrder=asc');
    expect(q).toMatchObject({
      limit: 25,
      offset: 0,
      sortField: 'businessName',
      sortColumn: 'business_name',
      ascending: true,
    });
  });

  it('keeps the endpoint default of 100 when no limit is sent', () => {
    expect(parseCompaniesBoth('').limit).toBe(100);
    // Contacts keep their own smaller default; the spec carries it, not the parser.
    expect(parseBoth('').limit).toBe(25);
  });

  it('falls back to createdAt for a field companies does not have', () => {
    // These are the names the registry used to bind, and they are not columns.
    for (const raw of ['name', 'city', 'state', 'employeeCount', 'ownerId']) {
      expect(node.resolveSortField(node.COMPANY_LIST_SPEC, raw)).toBe('createdAt');
      expect(edge.resolveSortField(edge.COMPANY_LIST_SPEC, raw)).toBe('createdAt');
    }
  });

  it('resolves the real column names the registry now binds', () => {
    const spec = node.COMPANY_LIST_SPEC;
    expect(spec.sortFields.businessName).toBe('business_name');
    expect(spec.sortFields.billingCity).toBe('billing_city');
    expect(spec.sortFields.billingState).toBe('billing_state');
    expect(spec.sortFields.employees).toBe('employees');
  });

  it('reads the industry, status and record-type filters', () => {
    const q = parseCompaniesBoth('industry=manufacturing&status=Active&recordType=Customer');
    expect(q.filters).toEqual({
      industry: 'manufacturing',
      status: 'Active',
      recordType: 'Customer',
      businessRecordType: null,
    });
  });

  it('builds a search across the real company columns', () => {
    const or = node.buildSearchOr(node.COMPANY_LIST_SPEC, 'ridgeline');
    expect(or).toBe(
      'business_name.ilike.%ridgeline%,phone.ilike.%ridgeline%,customer_number.ilike.%ridgeline%,' +
        'industry.ilike.%ridgeline%,billing_city.ilike.%ridgeline%,billing_state.ilike.%ridgeline%',
    );
    expect(edge.buildSearchOr(edge.COMPANY_LIST_SPEC, 'ridgeline')).toBe(or);
  });

  it('matches the same rows in memory as the or() filter names', () => {
    const rows = [
      { businessName: 'Ridgeline Dental', billingCity: 'Ames', customerNumber: '10243' },
      { businessName: 'Northgate Clinic', billingCity: 'Des Moines', customerNumber: '10244' },
    ];
    const hit = (term: string) =>
      rows.filter((r) => node.matchesSearch(node.COMPANY_LIST_SPEC, r, term));
    expect(hit('ridgeline')).toHaveLength(1);
    expect(hit('des moines')).toHaveLength(1);
    expect(hit('10243')).toHaveLength(1);
    expect(hit('nothing')).toHaveLength(0);
  });
});
