// Apollo.io REST client and row mappers, for the edge runtime (WF-S-05).
//
// WHY THIS EXISTS. server/apollo-client.ts is an axios client and Node-only,
// so the apollo edge function - the thing that serves production, because
// getApiUrl rewrites /api/apollo straight to the functions host - could not
// call Apollo at all. Its /search and /enrich branches returned an empty list
// with `message: 'Apollo API integration required'` at status 200, which is
// indistinguishable from "your filters matched nobody". Lead enrichment has
// therefore never worked in production, only in dev.
//
// Everything here is pure or a single fetch, with no Deno globals, so the
// Node test suite imports it directly and the arithmetic is covered.

export interface ApolloSearchFilters {
  personTitles?: string[];
  personSeniorities?: string[];
  personDepartments?: string[];
  personLocations?: string[];
  contactEmailStatus?: string[];
  organizationNumEmployeesRanges?: string[];
  organizationIndustries?: string[];
  page?: number;
  perPage?: number;
}

export interface ApolloPhone {
  raw_number?: string;
  sanitized_number?: string;
}

export interface ApolloOrganization {
  id?: string;
  name?: string;
  website_url?: string | null;
  primary_domain?: string | null;
  num_employees_enum?: string | null;
  estimated_num_employees?: number | null;
  industry?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
}

export interface ApolloContact {
  id: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  title?: string;
  email?: string | null;
  email_status?: string | null;
  linkedin_url?: string | null;
  phone_numbers?: ApolloPhone[];
  organization_id?: string | null;
  organization?: ApolloOrganization | null;
  seniority?: string | null;
  departments?: string[];
  functions?: string[];
}

export interface ApolloPagination {
  page: number;
  per_page: number;
  total_entries: number;
  total_pages: number;
}

export interface ApolloSearchResponse {
  people: ApolloContact[];
  pagination: ApolloPagination;
}

const APOLLO_BASE = 'https://api.apollo.io';
const SEARCH_PATH = '/v1/mixed_people/search';
const MATCH_PATH = '/v1/people/match';
const TIMEOUT_MS = 30_000;

export class ApolloApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApolloApiError';
    this.status = status;
  }
}

/**
 * The request body Apollo expects for a people search.
 *
 * `prospected_by_current_team: ['no']` is carried over from the Node client
 * deliberately: it is what makes the board show leads nobody on the team has
 * already worked, and dropping it would change what a rep sees.
 */
export function buildSearchBody(filters: ApolloSearchFilters): Record<string, unknown> {
  return {
    page: filters.page || 1,
    per_page: filters.perPage || 25,
    person_titles: filters.personTitles,
    person_seniorities: filters.personSeniorities,
    person_departments: filters.personDepartments,
    person_locations: filters.personLocations,
    contact_email_status: filters.contactEmailStatus || ['verified'],
    organization_num_employees_ranges: filters.organizationNumEmployeesRanges,
    organization_industries: filters.organizationIndustries,
    prospected_by_current_team: ['no'],
  };
}

async function apolloPost<T>(apiKey: string, path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${APOLLO_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if ((err as Error)?.name === 'AbortError') {
      throw new ApolloApiError(504, `Apollo API did not respond within ${TIMEOUT_MS / 1000}s`);
    }
    throw new ApolloApiError(502, `Apollo API request failed: ${String(err)}`);
  }
  clearTimeout(timer);

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    const message =
      (parsed as { message?: string; error?: string } | null)?.message ??
      (parsed as { error?: string } | null)?.error ??
      res.statusText;
    throw new ApolloApiError(res.status, `Apollo API error: ${res.status} - ${message}`);
  }

  return parsed as T;
}

export async function searchPeople(
  apiKey: string,
  filters: ApolloSearchFilters,
): Promise<ApolloSearchResponse> {
  const data = await apolloPost<Partial<ApolloSearchResponse>>(
    apiKey,
    SEARCH_PATH,
    buildSearchBody(filters),
  );
  const page = filters.page || 1;
  const perPage = filters.perPage || 25;
  return {
    people: data?.people ?? [],
    pagination: data?.pagination ?? {
      page,
      per_page: perPage,
      total_entries: data?.people?.length ?? 0,
      total_pages: 1,
    },
  };
}

export async function enrichPerson(
  apiKey: string,
  params: {
    email?: string;
    first_name?: string;
    last_name?: string;
    organization_name?: string;
    linkedin_url?: string;
  },
): Promise<ApolloContact | null> {
  const data = await apolloPost<{ person?: ApolloContact | null }>(apiKey, MATCH_PATH, params);
  return data?.person ?? null;
}

/**
 * Minimal, cheap call used to answer "is this key valid" — one person, one
 * page. It costs a credit, which is why the caller records it as usage.
 */
export async function verifyApiKey(apiKey: string): Promise<void> {
  await searchPeople(apiKey, { page: 1, perPage: 1, personTitles: ['CEO'] });
}

/**
 * A row for `centralized_apollo_contacts`, in the SNAKE CASE PostgREST wants.
 *
 * The Node original returned camelCase because Drizzle maps it; an edge
 * function names columns in strings, so a camelCase key here is a 42703 the
 * first time the path runs.
 */
export function transformApolloContact(c: ApolloContact): Record<string, unknown> {
  const org = c.organization ?? null;
  const location = org?.city ? `${org.city}, ${org.state || ''} ${org.country || ''}`.trim() : null;

  return {
    apollo_id: c.id,
    first_name: c.first_name ?? null,
    last_name: c.last_name ?? null,
    name: c.name ?? null,
    title: c.title ?? null,
    email: c.email ?? null,
    email_status: c.email_status ?? null,
    linkedin_url: c.linkedin_url ?? null,
    phone_numbers: (c.phone_numbers ?? [])
      .map((p) => p.sanitized_number || p.raw_number)
      .filter((n): n is string => Boolean(n)),
    organization_id: c.organization_id ?? null,
    organization_name: org?.name ?? null,
    website_url: org?.website_url ?? null,
    company_domain: org?.primary_domain ?? null,
    company_size: org?.num_employees_enum ?? null,
    employee_count: org?.estimated_num_employees ?? null,
    industry: org?.industry ?? null,
    company_location: location,
    seniority: c.seniority ?? null,
    departments: c.departments ?? [],
    functions: c.functions ?? [],
    raw_data: c,
  };
}

/**
 * Cache key for a filter set.
 *
 * SHA-256 rather than the Node client's MD5, because Web Crypto offers no MD5
 * and adding an implementation to hash a cache key is not worth it. Existing
 * md5-keyed rows simply never match again; `apollo_search_cache` entries live
 * one hour, and `search_hash` is UNIQUE per value, so the two generations
 * coexist without a collision.
 *
 * The key ORDER is normalised here. The Node version passed sorted keys as
 * JSON.stringify's second argument, which is an allowlist rather than a sort,
 * so it silently dropped any nested property whose name was not also a
 * top-level filter name. Sorting entries gives the same stability without that.
 */
export async function searchHash(filters: ApolloSearchFilters): Promise<string> {
  const normalised = JSON.stringify(
    Object.keys(filters ?? {})
      .sort()
      .map((k) => [k, (filters as Record<string, unknown>)[k]]),
  );
  const bytes = new TextEncoder().encode(normalised);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * What GET /credentials may show. An API key is never returned in full, and a
 * short key is not partially revealed either - `substring(0,10)` of a 12
 * character secret leaves four characters, so the mask is all-or-nothing below
 * a length that makes it meaningless.
 */
export function maskApiKey(key: string | null | undefined): string | null {
  if (!key || typeof key !== 'string') return null;
  const trimmed = key.trim();
  if (trimmed.length < 20) return '********';
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

/**
 * Message shown when Apollo rejects the credentials, separated from a genuine
 * outage: a 401/403 is the user's key, anything else is not their fault and
 * telling them to check the key would send them the wrong way.
 */
export function describeApolloFailure(err: unknown): { valid: false; error: string } {
  if (err instanceof ApolloApiError && (err.status === 401 || err.status === 403)) {
    return {
      valid: false,
      error: 'Invalid API key. Check the key in your Apollo.io account and try again.',
    };
  }
  return { valid: false, error: `Failed to verify API key: ${(err as Error)?.message ?? err}` };
}
