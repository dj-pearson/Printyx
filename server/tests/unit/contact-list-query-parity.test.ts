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

import * as node from '../../lib/contact-list-query';
import * as edge from '../../../supabase/functions/_shared/contact-list-query';

const bothParsers = [
  ['node', node.parseContactListQuery] as const,
  ['edge', edge.parseContactListQuery] as const,
];

function parseBoth(qs: string) {
  const a = node.parseContactListQuery(new URLSearchParams(qs));
  const b = edge.parseContactListQuery(new URLSearchParams(qs));
  expect(b).toEqual(a);
  return a;
}

describe('the sort whitelist matches across copies', () => {
  it('CONTACT_SORT_FIELDS is identical', () => {
    expect(edge.CONTACT_SORT_FIELDS).toEqual(node.CONTACT_SORT_FIELDS);
  });

  it('every mapped column is snake_case', () => {
    for (const column of Object.values(node.CONTACT_SORT_FIELDS)) {
      expect(column).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('defaults and limits are identical', () => {
    expect(edge.DEFAULT_CONTACT_SORT_FIELD).toBe(node.DEFAULT_CONTACT_SORT_FIELD);
    expect(edge.DEFAULT_CONTACT_PAGE_SIZE).toBe(node.DEFAULT_CONTACT_PAGE_SIZE);
    expect(edge.MAX_CONTACT_PAGE_SIZE).toBe(node.MAX_CONTACT_PAGE_SIZE);
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
    expect(node.resolveContactSortField(raw)).toBe(expected);
    expect(edge.resolveContactSortField(raw)).toBe(expected);
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
      companyId: null,
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
    expect(q).toMatchObject({
      department: null,
      leadStatus: null,
      ownerId: null,
      companyId: null,
    });
  });

  it('keeps real filter values', () => {
    const q = parseBoth('department=sales&leadStatus=qualified&companyId=c-42&ownerId=u-7');
    expect(q).toMatchObject({
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
    expect(node.parseContactListQuery({ limit: ['10', '99'] }).limit).toBe(10);
    expect(edge.parseContactListQuery({ limit: ['10', '99'] }).limit).toBe(10);
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
    expect(node.sanitizeContactSearch(raw as any)).toBe(expected);
    expect(edge.sanitizeContactSearch(raw as any)).toBe(expected);
  });

  it('caps the term at 100 characters', () => {
    const long = 'x'.repeat(500);
    expect(node.sanitizeContactSearch(long)).toHaveLength(100);
    expect(edge.sanitizeContactSearch(long)).toHaveLength(100);
  });

  it('a sanitized term can never close the or() grammar', () => {
    const term = node.sanitizeContactSearch('a,b(c)d%e');
    expect(term).not.toMatch(/[,()%*\\"']/);
    expect(node.buildContactSearchOr(term)).toBe(edge.buildContactSearchOr(term));
  });
});

describe('buildContactSearchOr', () => {
  it('searches first name, last name and email', () => {
    expect(node.buildContactSearchOr('lee')).toBe(
      'first_name.ilike.%lee%,last_name.ilike.%lee%,email.ilike.%lee%',
    );
    expect(edge.buildContactSearchOr('lee')).toBe(node.buildContactSearchOr('lee'));
  });

  it('is empty for an empty term, so the caller can skip the filter', () => {
    expect(node.buildContactSearchOr('')).toBe('');
    expect(edge.buildContactSearchOr('')).toBe('');
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
    const t = node.sanitizeContactSearch(term);
    expect(rows.filter((r) => node.contactMatchesSearch(r, t))).toHaveLength(count);
    expect(rows.filter((r) => edge.contactMatchesSearch(r, t))).toHaveLength(count);
  });

  it('an empty term matches everything', () => {
    expect(rows.every((r) => node.contactMatchesSearch(r, ''))).toBe(true);
    expect(rows.every((r) => edge.contactMatchesSearch(r, ''))).toBe(true);
  });

  it('does not match on fields the or() filter leaves out', () => {
    const row = { firstName: 'Rosa', lastName: 'Alvarez', email: 'r@x.example', title: 'Manager' };
    expect(node.contactMatchesSearch(row, 'manager')).toBe(false);
    expect(edge.contactMatchesSearch(row, 'manager')).toBe(false);
  });
});

describe('compareContacts', () => {
  const sortBoth = (rows: any[], field: string, asc: boolean) => {
    const a = [...rows].sort((x, y) => node.compareContacts(x, y, field, asc));
    const b = [...rows].sort((x, y) => edge.compareContacts(x, y, field, asc));
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
