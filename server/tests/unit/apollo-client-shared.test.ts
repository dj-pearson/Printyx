/**
 * The Apollo REST client the edge runtime uses (WF-S-05).
 *
 * server/apollo-client.ts is axios and Node-only, so the apollo edge function -
 * which is what production runs, because getApiUrl rewrites /api/apollo to the
 * functions host - had no way to call Apollo at all. Its /search branch
 * answered `{ contacts: [], message: 'Apollo API integration required' }` at
 * status 200: a successful-looking empty page, indistinguishable from filters
 * that matched nobody. Lead enrichment worked in dev and had never worked in
 * production.
 *
 * The mappers are tested here rather than in Deno because the column names are
 * strings, and a camelCase key in a PostgREST payload is a 42703 the first time
 * the path runs - the one class of defect tsc cannot see on this side.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ApolloApiError,
  buildSearchBody,
  describeApolloFailure,
  enrichPerson,
  maskApiKey,
  searchHash,
  searchPeople,
  transformApolloContact,
} from '../../../supabase/functions/_shared/apollo-client.ts';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

function fetchReturning(status: number, body: unknown) {
  return vi.fn(
    async () =>
      new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const CONTACT = {
  id: 'apollo-1',
  first_name: 'Dana',
  last_name: 'Reyes',
  name: 'Dana Reyes',
  title: 'Director of IT',
  email: 'dana@example.com',
  email_status: 'verified',
  linkedin_url: 'https://linkedin.com/in/dana',
  phone_numbers: [{ raw_number: '(555) 010-1234', sanitized_number: '+15550101234' }],
  organization_id: 'org-9',
  organization: {
    id: 'org-9',
    name: 'Example Printing',
    website_url: 'https://example.com',
    primary_domain: 'example.com',
    num_employees_enum: '201,500',
    estimated_num_employees: 340,
    industry: 'printing',
    city: 'Des Moines',
    state: 'IA',
    country: 'US',
  },
  seniority: 'director',
  departments: ['information_technology'],
  functions: ['information_technology'],
};

describe('transformApolloContact maps to real columns', () => {
  const row = transformApolloContact(CONTACT);

  it('emits snake_case, because PostgREST takes column names as strings', () => {
    const camel = Object.keys(row).filter((k) => /[A-Z]/.test(k));
    expect(camel).toEqual([]);
  });

  it('every key is a declared column on centralized_apollo_contacts', () => {
    const schema = read('shared/apollo-schema.ts');
    const table = schema.slice(
      schema.indexOf("'centralized_apollo_contacts',"),
      schema.indexOf('export const tenantApolloLeads'),
    );
    expect(table.length).toBeGreaterThan(1000);
    for (const key of Object.keys(row)) {
      expect(table, `${key} is not a column`).toContain(`'${key}'`);
    }
  });

  it('prefers the sanitized phone number and drops empty ones', () => {
    expect(row.phone_numbers).toEqual(['+15550101234']);
    expect(transformApolloContact({ id: 'x', phone_numbers: [{}] }).phone_numbers).toEqual([]);
  });

  it('builds the company location from the parts Apollo sends', () => {
    expect(row.company_location).toBe('Des Moines, IA US');
  });

  it('leaves the location null rather than emitting stray punctuation', () => {
    // ', ' with nothing around it is not a place. A contact with no city gets
    // null, which renders as an absence instead of a comma.
    expect(transformApolloContact({ id: 'x', organization: { name: 'A' } }).company_location).toBe(
      null,
    );
  });

  it('keeps the raw payload so a later mapping fix can be applied to old rows', () => {
    expect(row.raw_data).toBe(CONTACT);
  });
});

describe('searchHash', () => {
  it('is stable regardless of key order', async () => {
    const a = await searchHash({ page: 1, perPage: 25, personTitles: ['CEO'] });
    const b = await searchHash({ personTitles: ['CEO'], perPage: 25, page: 1 });
    expect(a).toBe(b);
  });

  it('separates filter sets that differ', async () => {
    const a = await searchHash({ personTitles: ['CEO'] });
    const b = await searchHash({ personTitles: ['CTO'] });
    expect(a).not.toBe(b);
  });

  it('does not lose a nested property, which the Node version did', async () => {
    // The Node client hashed with JSON.stringify(filters, Object.keys(filters).sort()).
    // The second argument is an ALLOWLIST, not a sort, and it applies at every
    // depth - so any nested key whose name was not also a top-level filter name
    // was dropped, and two different searches could share a hash.
    const a = await searchHash({ organizationIndustries: ['printing'] } as never);
    const b = await searchHash({ organizationIndustries: ['software'] } as never);
    expect(a).not.toBe(b);
  });

  it('is a hex digest', async () => {
    expect(await searchHash({})).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('maskApiKey', () => {
  it('shows a little of a long key', () => {
    expect(maskApiKey('abcdefghijklmnopqrstuvwxyz')).toBe('abcdef...wxyz');
  });

  it('reveals nothing about a short one', () => {
    // substring(0, 10) + last 4 of a 12-character secret leaves two characters
    // hidden, which is not a mask. All-or-nothing below a useful length.
    expect(maskApiKey('short-key-12')).toBe('********');
  });

  it('answers null for no key', () => {
    expect(maskApiKey(null)).toBe(null);
    expect(maskApiKey('')).toBe(null);
  });
});

describe('buildSearchBody', () => {
  it('keeps prospected_by_current_team, which decides what a rep sees', () => {
    expect(buildSearchBody({}).prospected_by_current_team).toEqual(['no']);
  });

  it('defaults the email status to verified', () => {
    expect(buildSearchBody({}).contact_email_status).toEqual(['verified']);
    expect(buildSearchBody({ contactEmailStatus: ['guessed'] }).contact_email_status).toEqual([
      'guessed',
    ]);
  });

  it('defaults paging', () => {
    expect(buildSearchBody({})).toMatchObject({ page: 1, per_page: 25 });
  });
});

describe('searchPeople', () => {
  it('returns people and pagination', async () => {
    vi.stubGlobal(
      'fetch',
      fetchReturning(200, {
        people: [CONTACT],
        pagination: { page: 2, per_page: 10, total_entries: 31, total_pages: 4 },
      }),
    );
    const res = await searchPeople('key', { page: 2, perPage: 10 });
    expect(res.people).toHaveLength(1);
    expect(res.pagination.total_pages).toBe(4);
  });

  it('substitutes a pagination block rather than crashing when Apollo omits one', async () => {
    vi.stubGlobal('fetch', fetchReturning(200, { people: [] }));
    const res = await searchPeople('key', { page: 3, perPage: 5 });
    expect(res.pagination).toEqual({ page: 3, per_page: 5, total_entries: 0, total_pages: 1 });
  });

  it('carries the HTTP status on the error, so 401 can be told from an outage', async () => {
    vi.stubGlobal('fetch', fetchReturning(401, { message: 'invalid api key' }));
    await expect(searchPeople('bad', {})).rejects.toBeInstanceOf(ApolloApiError);
    await expect(searchPeople('bad', {})).rejects.toMatchObject({ status: 401 });
  });

  it('survives a non-JSON error body', async () => {
    vi.stubGlobal('fetch', fetchReturning(502, '<html>gateway</html>'));
    await expect(searchPeople('key', {})).rejects.toMatchObject({ status: 502 });
  });
});

describe('enrichPerson', () => {
  it('returns null when Apollo matched nobody', async () => {
    vi.stubGlobal('fetch', fetchReturning(200, { person: null }));
    expect(await enrichPerson('key', { email: 'nobody@example.com' })).toBe(null);
  });

  it('returns the person when it matched', async () => {
    vi.stubGlobal('fetch', fetchReturning(200, { person: CONTACT }));
    expect((await enrichPerson('key', { email: 'dana@example.com' }))?.id).toBe('apollo-1');
  });
});

describe('describeApolloFailure', () => {
  it('blames the key only when Apollo rejected it', () => {
    expect(describeApolloFailure(new ApolloApiError(403, 'forbidden')).error).toContain(
      'Invalid API key',
    );
    expect(describeApolloFailure(new ApolloApiError(500, 'boom')).error).not.toContain(
      'Invalid API key',
    );
  });

  it('never claims valid', () => {
    expect(describeApolloFailure(new Error('x')).valid).toBe(false);
  });
});
