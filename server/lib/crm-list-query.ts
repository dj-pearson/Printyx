/**
 * Query parsing for the CRM list endpoints (COP-M01).
 *
 * /api/company-contacts and /api/companies are each served by Express in dev and
 * by an edge function in production, and both read the same query string:
 * limit/offset/page, search, sortBy/sortOrder, plus a per-object set of filters.
 * Express filters camelCase Drizzle rows in memory; the edge functions push the
 * same intent into PostgREST. The part that must not diverge is what a given
 * query string MEANS, so it lives here, once per object as a spec.
 *
 * Node copy. supabase/functions/_shared/crm-list-query.ts is the Deno twin and
 * server/tests/unit/crm-list-query-parity.test.ts fails on drift.
 */

export interface CrmListSpec {
  /** Sortable fields: camelCase (what the frontend sends and what Drizzle
   *  returns) to the physical column (what PostgREST needs). A WHITELIST, not a
   *  translation table — an unlisted value falls back to defaultSortField
   *  rather than reaching either database as an identifier. */
  sortFields: Record<string, string>;
  defaultSortField: string;
  defaultLimit: number;
  /** Physical columns for the PostgREST or() search. Every one must exist. */
  searchColumns: string[];
  /** The same columns as camelCase fields, for the in-memory Express filter. */
  searchFields: string[];
  /** Query-string keys treated as exact-match filters. */
  filterKeys: string[];
}

export const MAX_CRM_PAGE_SIZE = 200;
const MAX_SEARCH_LENGTH = 100;

export const CONTACT_LIST_SPEC: CrmListSpec = {
  sortFields: {
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
  },
  defaultSortField: 'createdAt',
  defaultLimit: 25,
  searchColumns: ['first_name', 'last_name', 'email'],
  searchFields: ['firstName', 'lastName', 'email'],
  filterKeys: ['companyId', 'department', 'leadStatus', 'ownerId'],
};

/**
 * Companies.
 *
 * Note what is NOT here: `email`. The companies table has no email column
 * (shared/schema.ts, migration 0000 — phone, fax and website, no email), and the
 * edge function's search filter named it anyway, so every search reached
 * PostgREST as `or=(...,email.ilike...)` and came back 42703. Company search
 * therefore 500'd in dev and production alike, including the quote builder's
 * customer picker.
 */
export const COMPANY_LIST_SPEC: CrmListSpec = {
  sortFields: {
    businessName: 'business_name',
    customerNumber: 'customer_number',
    businessRecordType: 'business_record_type',
    industry: 'industry',
    activity: 'activity',
    phone: 'phone',
    fax: 'fax',
    website: 'website',
    billingCity: 'billing_city',
    billingState: 'billing_state',
    employees: 'employees',
    annualRevenue: 'annual_revenue',
    customerSince: 'customer_since',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  defaultSortField: 'createdAt',
  defaultLimit: 100,
  searchColumns: [
    'business_name',
    'phone',
    'customer_number',
    'industry',
    'billing_city',
    'billing_state',
  ],
  searchFields: [
    'businessName',
    'phone',
    'customerNumber',
    'industry',
    'billingCity',
    'billingState',
  ],
  filterKeys: ['industry', 'status', 'recordType', 'businessRecordType'],
};

export interface CrmListQuery {
  search: string;
  limit: number;
  offset: number;
  page: number;
  /** camelCase field name — what Express sorts Drizzle rows by. */
  sortField: string;
  /** physical column — what PostgREST orders by. */
  sortColumn: string;
  ascending: boolean;
  filters: Record<string, string | null>;
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
export function sanitizeSearchTerm(raw: string | null | undefined): string {
  return String(raw ?? '')
    .replace(/[,()%*\\"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SEARCH_LENGTH);
}

/** camelCase or snake_case in, a whitelisted camelCase field out. */
export function resolveSortField(spec: CrmListSpec, raw: string): string {
  if (raw in spec.sortFields) return raw;
  for (const [field, column] of Object.entries(spec.sortFields)) {
    if (column === raw) return field;
  }
  return spec.defaultSortField;
}

export function parseCrmListQuery(
  source: URLSearchParams | Record<string, unknown>,
  spec: CrmListSpec,
): CrmListQuery {
  const get = readerFor(source);

  const limit = Math.min(MAX_CRM_PAGE_SIZE, Math.max(1, intOr(get('limit'), spec.defaultLimit)));

  // offset wins when both are present: it is what the CRM table actually sends.
  const rawOffset = get('offset');
  const offset =
    rawOffset === null || rawOffset === undefined || rawOffset === ''
      ? Math.max(0, intOr(get('page'), 1) - 1) * limit
      : Math.max(0, intOr(rawOffset, 0));

  const sortField = resolveSortField(spec, String(get('sortBy') ?? '').trim());

  const filters: Record<string, string | null> = {};
  for (const key of spec.filterKeys) filters[key] = trimmedOrNull(get(key));

  return {
    search: sanitizeSearchTerm(get('search')),
    limit,
    offset,
    page: Math.floor(offset / limit) + 1,
    sortField,
    sortColumn: spec.sortFields[sortField],
    ascending: String(get('sortOrder') ?? '').toLowerCase() === 'asc',
    filters,
  };
}

/** PostgREST `or()` argument for a sanitized term, or '' when there is nothing to search. */
export function buildSearchOr(spec: CrmListSpec, search: string): string {
  if (!search) return '';
  return spec.searchColumns.map((column) => `${column}.ilike.%${search}%`).join(',');
}

/** In-memory equivalent of buildSearchOr, for the Express path. */
export function matchesSearch(
  spec: CrmListSpec,
  row: Record<string, any>,
  search: string,
): boolean {
  if (!search) return true;
  const needle = search.toLowerCase();
  return spec.searchFields.some((key) =>
    String(row?.[key] ?? '')
      .toLowerCase()
      .includes(needle),
  );
}

/** Comparator for the Express path, matching the edge functions' ORDER BY. */
export function compareRecords(
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
