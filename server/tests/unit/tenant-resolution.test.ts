/**
 * 157 edge functions took the tenant id from a request header (SEC-TENANT-003).
 *
 * Tenant resolution in the edge tree read app_metadata.tenantId and fell back to
 * req.headers.get('x-tenant-id') - a value client/src/lib/authed-download.ts and
 * its siblings set from localStorage, so a devtools edit away from naming any
 * tenant. For a user whose JWT carries a tenantId the fallback never fires,
 * which is why it survived three separate rulings on the shape (CR-010,
 * PA-002/PA-003, and the private resolver in _shared/auth.ts). The exposure is
 * whoever reaches production WITHOUT one: a freshly provisioned user before
 * their first assignment, a service or cron caller, an account whose
 * app_metadata was written by a path that never set it. These functions use the
 * SERVICE ROLE, which bypasses RLS, so for those callers every
 * .eq('tenant_id', tenantId) became a filter of the caller's choosing.
 *
 * The ORDER is the whole fix and is what these tests pin: the users row - which
 * the caller cannot write - is consulted before any caller-supplied value.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  isPlatformAdminClaim,
  resolveTenantId,
  tenantFromJwt,
} from '../../../supabase/functions/_shared/resolve-tenant.ts';

const repo = join(__dirname, '../../..');

/**
 * A PostgREST stand-in that evaluates the filters rather than recording them: a
 * call-counting mock passes on a resolver that queries the wrong column.
 */
function fakeAdmin(tables: Record<string, Array<Record<string, unknown>>>) {
  const calls: string[] = [];
  const build = (table: string, rows: Array<Record<string, unknown>>) => {
    let current = rows;
    const chain = {
      select: () => chain,
      limit: () => chain,
      eq: (col: string, val: unknown) => {
        calls.push(`${table}.eq(${col})`);
        current = current.filter((r) => r[col] === val);
        return chain;
      },
      ilike: (col: string, val: string) => {
        calls.push(`${table}.ilike(${col})`);
        current = current.filter((r) => String(r[col] ?? '').toLowerCase() === val.toLowerCase());
        return chain;
      },
      maybeSingle: async () => ({ data: current[0] ?? null, error: null }),
    };
    return chain;
  };
  return {
    calls,
    client: { from: (t: string) => build(t, tables[t] ?? []) },
  };
}

const req = (headers: Record<string, string> = {}) =>
  new Request('https://functions.printyx.net/deals', { headers });

const USERS = [{ id: 'u1', email: 'rep@dealer.test', tenant_id: 'tenant-own' }];
const TENANTS = [{ id: 'tenant-own' }, { id: 'tenant-other' }];

describe('tenantFromJwt', () => {
  it('reads app_metadata under either spelling', () => {
    expect(tenantFromJwt({ app_metadata: { tenantId: 't1' } })).toBe('t1');
    expect(tenantFromJwt({ app_metadata: { tenant_id: 't2' } })).toBe('t2');
  });

  it('never reads user_metadata, which the session holder can write', () => {
    // supabase.auth.updateUser writes user_metadata from the browser.
    expect(tenantFromJwt({ user_metadata: { tenantId: 'spoofed' } } as never)).toBeNull();
  });

  it('treats an empty string as absent', () => {
    expect(tenantFromJwt({ app_metadata: { tenantId: '' } })).toBeNull();
  });
});

describe('resolveTenantId', () => {
  it('prefers the JWT claim over a conflicting header', async () => {
    const { client } = fakeAdmin({ users: USERS, tenants: TENANTS });
    const got = await resolveTenantId(
      req({ 'x-tenant-id': 'tenant-other' }),
      { id: 'u1', app_metadata: { tenantId: 'tenant-own' } },
      client,
    );
    expect(got).toBe('tenant-own');
  });

  it('ignores a header naming another tenant when the caller has no claim', async () => {
    // THE CASE THE STORY IS ABOUT. Before the fix this returned 'tenant-other'
    // and every query in the function filtered on it.
    const { client } = fakeAdmin({ users: USERS, tenants: TENANTS });
    const got = await resolveTenantId(
      req({ 'x-tenant-id': 'tenant-other' }),
      { id: 'u1', email: 'rep@dealer.test', app_metadata: {} },
      client,
    );
    expect(got).toBe('tenant-own');
  });

  it('resolves through the users row before consulting anything caller-supplied', async () => {
    const { client, calls } = fakeAdmin({ users: USERS, tenants: TENANTS });
    await resolveTenantId(req({ 'x-tenant-id': 'tenant-other' }), { id: 'u1' }, client);
    expect(calls).toContain('users.eq(id)');
  });

  it('falls back to email when the auth id and the users id diverged', async () => {
    const { client } = fakeAdmin({ users: USERS, tenants: TENANTS });
    const got = await resolveTenantId(
      req(),
      { id: 'different-id', email: 'REP@dealer.test', app_metadata: {} },
      client,
    );
    expect(got).toBe('tenant-own');
  });

  it('returns null when there is no tenant at all, so the caller answers 400', async () => {
    const { client } = fakeAdmin({ users: [], tenants: TENANTS });
    const got = await resolveTenantId(
      req({ 'x-tenant-id': 'tenant-other' }),
      { id: 'nobody', app_metadata: {} },
      client,
    );
    expect(got).toBeNull();
  });

  it('lets a platform admin switch tenant with the header', async () => {
    const { client } = fakeAdmin({ users: USERS, tenants: TENANTS });
    const got = await resolveTenantId(
      req({ 'x-tenant-id': 'tenant-other' }),
      { id: 'u1', app_metadata: { tenantId: 'tenant-own', roleLevel: 8 } },
      client,
    );
    expect(got).toBe('tenant-other');
  });

  it('refuses a platform admin a tenant that does not exist', async () => {
    const { client } = fakeAdmin({ users: USERS, tenants: TENANTS });
    const got = await resolveTenantId(
      req({ 'x-tenant-id': 'tenant-made-up' }),
      { id: 'u1', app_metadata: { tenantId: 'tenant-own', isPlatformAdmin: true } },
      client,
    );
    expect(got).toBe('tenant-own');
  });

  it('does not accept a header from a user whose claims merely SAY level 8 as a string', async () => {
    // Number() of a non-numeric claim is NaN, which must not pass >= 8.
    const { client } = fakeAdmin({ users: USERS, tenants: TENANTS });
    const got = await resolveTenantId(
      req({ 'x-tenant-id': 'tenant-other' }),
      { id: 'u1', app_metadata: { tenantId: 'tenant-own', roleLevel: 'platform' } },
      client,
    );
    expect(got).toBe('tenant-own');
  });

  it('survives a lookup that throws without accepting the header', async () => {
    const exploding = {
      from: () => ({
        select: () => {
          throw new Error('PostgREST down');
        },
      }),
    };
    const got = await resolveTenantId(
      req({ 'x-tenant-id': 'tenant-other' }),
      { id: 'u1', app_metadata: {} },
      exploding as never,
    );
    expect(got).toBeNull();
  });
});

describe('isPlatformAdminClaim', () => {
  it('matches the role code case-insensitively', () => {
    // WF-R-03 found two gates comparing the uppercase role CODE against a
    // lowercase string, so neither could ever fire.
    expect(isPlatformAdminClaim({ app_metadata: { role: 'PLATFORM_ADMIN' } })).toBe(true);
    expect(isPlatformAdminClaim({ app_metadata: { role: 'platform_admin' } })).toBe(true);
  });

  it('is false for an ordinary company admin', () => {
    expect(isPlatformAdminClaim({ app_metadata: { role: 'COMPANY_ADMIN', roleLevel: 7 } })).toBe(
      false,
    );
  });
});

describe('the edge tree resolves tenancy in one place', () => {
  const read = (p: string) => readFileSync(join(repo, p), 'utf8');

  it('the two superseded helpers are gone', () => {
    // _shared/tenant.ts (PA-002/PA-003) read user_metadata and had three
    // importers; the private resolver in _shared/auth.ts put the header ahead
    // of the users-table lookup. Three modules, one shape, four adopters.
    expect(() => read('supabase/functions/_shared/tenant.ts')).toThrow();
    expect(read('supabase/functions/_shared/auth.ts')).toContain("from './resolve-tenant.ts'");
  });

  it('_shared/auth.ts no longer prefers the header over the users table', () => {
    const src = read('supabase/functions/_shared/auth.ts').replace(/^\s*\/\/.*$/gm, '');
    expect(src).not.toContain("req.headers.get('x-tenant-id')");
  });

  it('the resolver reads app_metadata, never user_metadata', () => {
    const src = read('supabase/functions/_shared/resolve-tenant.ts').replace(/^\s*\/\/.*$/gm, '');
    expect(src).toContain('app_metadata');
    expect(src).not.toMatch(/user_metadata\?\.(tenantId|tenant_id)/);
  });
});
