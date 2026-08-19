/**
 * Query parsing for the contacts list endpoint (COP-M01).
 *
 * GET /api/company-contacts is served by Express in dev and by the
 * company-contacts edge function in production, and the two read the same query
 * string: limit/offset/page, search, sortBy/sortOrder, plus the companyId,
 * department, leadStatus and ownerId filters. Express filters camelCase Drizzle
 * rows in memory; the edge function pushes the same intent into PostgREST. The
 * part that must not diverge is what a given query string MEANS, so it lives
 * here.
 *
 * Node copy. supabase/functions/_shared/contact-list-query.ts is the Deno twin
 * and server/tests/unit/contact-list-query-parity.test.ts fails on drift.
 */

/**
 * Sortable fields, camelCase (what the frontend sends and what Drizzle returns)
 * to the physical column (what PostgREST needs).
 *
 * This is a WHITELIST, not a translation table: anything not listed falls back
 * to createdAt. An unchecked sortBy reaches the database as an identifier in
 * both backends, and the frontend is not the only thing that can send one.
 */
export const CONTACT_SORT_FIELDS: Record<string, string> = {
  firstName: 'first_name',
  lastName: 'last_name',
  email: 'email',
  phone: 'phone',
  mobile: 'mobile',
  title: 'title',
  department: 'department',
  isPrimaryContact: 'is_primary_contact',
  leadStatus: 'lead_status',
  ownerId: 'owner_id',
  lastContactDate: 'last_contact_date',
  nextFollowUpDate: 'next_follow_up_date',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

export const DEFAULT_CONTACT_SORT_FIELD = 'createdAt';
export const DEFAULT_CONTACT_PAGE_SIZE = 25;
export const MAX_CONTACT_PAGE_SIZE = 200;
const MAX_SEARCH_LENGTH = 100;

export interface ContactListQuery {
  companyId: string | null;
  department: string | null;
  leadStatus: string | null;
  ownerId: string | null;
  search: string;
  limit: number;
  offset: number;
  page: number;
  /** camelCase field name — what Express sorts Drizzle rows by. */
  sortField: string;
  /** physical column — what PostgREST orders by. */
  sortColumn: string;
  ascending: boolean;
}

/** Reads a query string from either a URLSearchParams or a plain object. */
export type QueryReader = (key: string) => string | null | undefined;

export function readerFor(source: URLSearchParams | Record<string, unknown>): QueryReader {
  if (typeof (source as URLSearchParams).get === 'function') {
    return (key) => (source as URLSearchParams).get(key);
  }
  return (key) => {
    const value = (source as Record<string, unknown>)[key];
    if (value === undefined || value === null) return null;
    return Array.isArray(value) ? String(value[0]) : String(value);
  };
}

function intOr(raw: string | null | undefined, fallback: number): number {
  if (raw === null || raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) ? n : fallback;
}

function trimmedOrNull(raw: string | null | undefined): string | null {
  const value = String(raw ?? '').trim();
  if (!value || value === 'all') return null;
  return value;
}

/**
 * Strip the characters that break a PostgREST `or()` filter.
 *
 * The grammar is comma- and paren-delimited with no escape sequence, so a
 * search for "Smith, Jane (ops)" does not return no rows — it produces a
 * malformed filter and a 400. Backslash and the wildcards are removed for the
 * same reason: they change the meaning of the pattern rather than matching.
 * Express does not need this, but it must agree on what the term IS so both
 * backends return the same rows.
 */
export function sanitizeContactSearch(raw: string | null | undefined): string {
  return String(raw ?? '')
    .replace(/[,()%*\\"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SEARCH_LENGTH);
}

export function parseContactListQuery(
  source: URLSearchParams | Record<string, unknown>,
): ContactListQuery {
  const get = readerFor(source);

  const limit = Math.min(
    MAX_CONTACT_PAGE_SIZE,
    Math.max(1, intOr(get('limit'), DEFAULT_CONTACT_PAGE_SIZE)),
  );

  // offset wins when both are present: it is what the table actually sends.
  const rawOffset = get('offset');
  const offset =
    rawOffset === null || rawOffset === undefined || rawOffset === ''
      ? Math.max(0, intOr(get('page'), 1) - 1) * limit
      : Math.max(0, intOr(rawOffset, 0));

  const sortByRaw = String(get('sortBy') ?? '').trim();
  const sortField = resolveContactSortField(sortByRaw);

  return {
    companyId: trimmedOrNull(get('companyId')),
    department: trimmedOrNull(get('department')),
    leadStatus: trimmedOrNull(get('leadStatus')),
    ownerId: trimmedOrNull(get('ownerId')),
    search: sanitizeContactSearch(get('search')),
    limit,
    offset,
    page: Math.floor(offset / limit) + 1,
    sortField,
    sortColumn: CONTACT_SORT_FIELDS[sortField],
    ascending: String(get('sortOrder') ?? '').toLowerCase() === 'asc',
  };
}

/** camelCase or snake_case in, a whitelisted camelCase field out. */
export function resolveContactSortField(raw: string): string {
  if (raw in CONTACT_SORT_FIELDS) return raw;
  for (const [field, column] of Object.entries(CONTACT_SORT_FIELDS)) {
    if (column === raw) return field;
  }
  return DEFAULT_CONTACT_SORT_FIELD;
}

/** PostgREST `or()` argument for a sanitized term, or '' when there is nothing to search. */
export function buildContactSearchOr(search: string): string {
  if (!search) return '';
  return ['first_name', 'last_name', 'email']
    .map((column) => `${column}.ilike.%${search}%`)
    .join(',');
}

/** In-memory equivalent of buildContactSearchOr, for the Express path. */
export function contactMatchesSearch(row: Record<string, any>, search: string): boolean {
  if (!search) return true;
  const needle = search.toLowerCase();
  return ['firstName', 'lastName', 'email'].some((key) =>
    String(row?.[key] ?? '')
      .toLowerCase()
      .includes(needle),
  );
}

/** Comparator for the Express path, matching the edge function's ORDER BY. */
export function compareContacts(
  a: Record<string, any>,
  b: Record<string, any>,
  sortField: string,
  ascending: boolean,
): number {
  const av = a?.[sortField];
  const bv = b?.[sortField];
  const aEmpty = av === null || av === undefined || av === '';
  const bEmpty = bv === null || bv === undefined || bv === '';
  // PostgREST defaults to NULLS LAST on ascending and NULLS FIRST on
  // descending; matching that keeps the two backends on the same page 1.
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return ascending ? 1 : -1;
  if (bEmpty) return ascending ? -1 : 1;

  let cmp: number;
  if (av instanceof Date || bv instanceof Date) {
    cmp = new Date(av as any).getTime() - new Date(bv as any).getTime();
  } else if (typeof av === 'number' && typeof bv === 'number') {
    cmp = av - bv;
  } else if (typeof av === 'boolean' || typeof bv === 'boolean') {
    cmp = Number(Boolean(av)) - Number(Boolean(bv));
  } else {
    cmp = String(av).localeCompare(String(bv), 'en', { sensitivity: 'base' });
  }
  return ascending ? cmp : -cmp;
}
