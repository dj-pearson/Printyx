/**
 * WF-R-03: the claims the edge-function gates read are actually written.
 *
 * `_shared/rbac.ts` gates on `app_metadata.roleLevel` and DEFAULTS TO 1 when it is
 * absent, so a claim nobody writes makes every user an individual contributor on
 * every gated function - a real platform admin included. Signup wrote tenantId,
 * roleId, accessScope and isPlatformUser and stopped; mobile-auth computed the
 * level into the JSON RESPONSE only; the two updateUserById calls in the tree
 * never touched app_metadata.
 *
 * These tests drive the real module against a fake PostgREST/GoTrue pair, because
 * the interesting behaviour is what gets WRITTEN, and a mock that only records
 * calls would pass on a module that writes the wrong keys.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import {
  buildRoleClaims,
  claimsPatch,
  ensureRoleClaims,
  flattenRolePermissions,
  hasRoleClaims,
  resolveRoleId,
  syncRoleClaims,
  type ClaimsClient,
} from '../../../supabase/functions/_shared/role-claims';
import {
  flattenPermissions,
  getRoleLevel,
  isPlatformAdmin,
  ROLE_LEVEL,
} from '../../../supabase/functions/_shared/rbac';

interface Row {
  [k: string]: unknown;
}

/** A fake standing in for both PostgREST and GoTrue's admin API. */
function fakeAdmin(tables: { roles?: Row[]; users?: Row[] }) {
  const updates: { id: string; attrs: Record<string, unknown> }[] = [];
  let updateFails = false;

  interface QueryApi {
    select(...args: unknown[]): QueryApi;
    limit(...args: unknown[]): QueryApi;
    eq(col: string, val: unknown): QueryApi;
    ilike(col: string, val: string): QueryApi;
    maybeSingle(): Promise<{ data: Row | null; error: null }>;
  }

  function query(rows: Row[]) {
    let out = [...rows];
    const api: QueryApi = {
      select: () => api,
      limit: () => api,
      eq: (col: string, val: unknown) => {
        out = out.filter((r) => r[col] === val);
        return api;
      },
      ilike: (col: string, val: string) => {
        out = out.filter((r) => String(r[col] ?? '').toLowerCase() === String(val).toLowerCase());
        return api;
      },
      maybeSingle: async () => ({ data: out[0] ?? null, error: null }),
    };
    return api;
  }

  const client: ClaimsClient & { updates: typeof updates; failUpdates: () => void } = {
    from: (table: string) => query((tables as Record<string, Row[]>)[table] ?? []),
    auth: {
      admin: {
        updateUserById: async (id: string, attrs: Record<string, unknown>) => {
          if (updateFails) return { data: null, error: { message: 'nope' } };
          updates.push({ id, attrs });
          return { data: { user: { id } }, error: null };
        },
      },
    },
    updates,
    failUpdates: () => {
      updateFails = true;
    },
  };
  return client;
}

const COMPANY_ADMIN_ROW = {
  id: 'role-ca',
  code: 'COMPANY_ADMIN',
  level: 7,
  permissions: {},
  can_access_all_tenants: false,
};
const PLATFORM_ADMIN_ROW = {
  id: 'role-pa',
  code: 'PLATFORM_ADMIN',
  level: 8,
  permissions: {},
  can_access_all_tenants: true,
};
const REP_ROW = {
  id: 'role-rep',
  code: 'SALES_REP',
  level: 1,
  permissions: { sales: { lead: ['view_own'] } },
  can_access_all_tenants: false,
};

describe('WF-R-03: building the claims', () => {
  it('reads level, code and flattened permissions off the seeded role', async () => {
    const admin = fakeAdmin({ roles: [REP_ROW] });
    const claims = await buildRoleClaims(admin, 'role-rep');
    expect(claims).toEqual({
      roleId: 'role-rep',
      roleLevel: 1,
      role: 'SALES_REP',
      permissions: ['sales.lead.view_own'],
      isPlatformAdmin: false,
    });
  });

  it('marks a platform admin from the level and from can_access_all_tenants', async () => {
    const admin = fakeAdmin({ roles: [PLATFORM_ADMIN_ROW] });
    const claims = await buildRoleClaims(admin, 'role-pa');
    expect(claims?.isPlatformAdmin).toBe(true);
    expect(claims?.roleLevel).toBe(ROLE_LEVEL.PLATFORM_ADMIN);
  });

  it('returns null rather than inventing a level when the role row is gone', async () => {
    const admin = fakeAdmin({ roles: [] });
    expect(await buildRoleClaims(admin, 'role-missing')).toBeNull();
    expect(await buildRoleClaims(admin, null)).toBeNull();
  });

  it('flattens permissions identically to the helper the gates use', () => {
    const nested = {
      sales: { lead: ['view_own', 'view_team'] },
      admin: { role: { assign: true } },
    };
    expect(flattenRolePermissions(nested).sort()).toEqual(flattenPermissions(nested).sort());
  });

  it('always includes permissions, so a stale list cannot outlive a role change', () => {
    const patch = claimsPatch({
      roleId: 'r',
      roleLevel: 7,
      role: 'COMPANY_ADMIN',
      permissions: [],
      isPlatformAdmin: false,
    });
    expect(Object.keys(patch).sort()).toEqual([
      'isPlatformAdmin',
      'permissions',
      'role',
      'roleId',
      'roleLevel',
    ]);
    expect(patch.permissions).toEqual([]);
  });
});

describe('WF-R-03: the gates read what was written', () => {
  const ctxFor = (appMetadata: Record<string, unknown>) =>
    ({ supabaseUser: { app_metadata: appMetadata } }) as never;

  it('getRoleLevel returns the seeded level instead of the level-1 default', async () => {
    const admin = fakeAdmin({ roles: [COMPANY_ADMIN_ROW] });
    const claims = await buildRoleClaims(admin, 'role-ca');

    // The pre-fix bag: signup wrote exactly these four keys.
    expect(
      getRoleLevel(
        ctxFor({
          tenantId: 't1',
          roleId: 'role-ca',
          accessScope: 'company',
          isPlatformUser: false,
        }),
      ),
    ).toBe(1);

    expect(getRoleLevel(ctxFor(claimsPatch(claims!)))).toBe(ROLE_LEVEL.COMPANY_ADMIN);
  });

  it('isPlatformAdmin is true for a platform admin with no manual edit', async () => {
    const admin = fakeAdmin({ roles: [PLATFORM_ADMIN_ROW] });
    const claims = await buildRoleClaims(admin, 'role-pa');
    expect(isPlatformAdmin(ctxFor({ tenantId: 't1', roleId: 'role-pa' }))).toBe(false);
    expect(isPlatformAdmin(ctxFor(claimsPatch(claims!)))).toBe(true);
  });
});

describe('WF-R-03: persisting and refreshing the claim', () => {
  it('writes the claim onto the auth user', async () => {
    const admin = fakeAdmin({ roles: [COMPANY_ADMIN_ROW] });
    const claims = await syncRoleClaims(admin, 'user-1', 'role-ca');
    expect(claims?.roleLevel).toBe(7);
    expect(admin.updates).toHaveLength(1);
    expect(admin.updates[0]).toEqual({
      id: 'user-1',
      attrs: { app_metadata: claimsPatch(claims!) },
    });
  });

  it('re-assigning a role replaces the level in the claim', async () => {
    const admin = fakeAdmin({ roles: [REP_ROW, COMPANY_ADMIN_ROW] });
    await syncRoleClaims(admin, 'user-1', 'role-rep');
    await syncRoleClaims(admin, 'user-1', 'role-ca');
    const last = admin.updates.at(-1)!.attrs.app_metadata as Record<string, unknown>;
    expect(last.roleLevel).toBe(7);
    expect(last.role).toBe('COMPANY_ADMIN');
    expect(last.permissions).toEqual([]);
  });

  it('writes nothing when the role cannot be resolved', async () => {
    const admin = fakeAdmin({ roles: [] });
    expect(await syncRoleClaims(admin, 'user-1', 'role-gone')).toBeNull();
    expect(admin.updates).toHaveLength(0);
  });
});

describe('WF-R-03: the self-healing backfill', () => {
  const bare = () => ({ id: 'user-1', email: 'Rep@example.com', app_metadata: { tenantId: 't1' } });

  it('backfills a user whose bag predates the claim, in place', async () => {
    const admin = fakeAdmin({
      roles: [REP_ROW],
      users: [{ id: 'user-1', email: 'rep@example.com', role_id: 'role-rep' }],
    });
    const user = bare();
    expect(await ensureRoleClaims(admin, user)).toBe(true);
    expect(user.app_metadata).toMatchObject({ tenantId: 't1', roleLevel: 1, role: 'SALES_REP' });
    expect(admin.updates).toHaveLength(1);
  });

  it('finds the role by email when the id differs between GoTrue and users', async () => {
    const admin = fakeAdmin({
      roles: [COMPANY_ADMIN_ROW],
      users: [{ id: 'other-id', email: 'rep@example.com', role_id: 'role-ca' }],
    });
    expect(await resolveRoleId(admin, bare())).toBe('role-ca');
  });

  it('does nothing when the claim is already present', async () => {
    const admin = fakeAdmin({ roles: [REP_ROW], users: [] });
    const user = { id: 'user-1', app_metadata: { roleLevel: 7, role: 'COMPANY_ADMIN' } };
    expect(await ensureRoleClaims(admin, user)).toBe(false);
    expect(admin.updates).toHaveLength(0);
  });

  it('leaves the user authenticated when the write fails', async () => {
    const admin = fakeAdmin({
      roles: [REP_ROW],
      users: [{ id: 'user-1', email: 'rep@example.com', role_id: 'role-rep' }],
    });
    admin.failUpdates();
    const user = bare();
    expect(await ensureRoleClaims(admin, user)).toBe(false);
    expect(user.app_metadata.tenantId).toBe('t1');
  });

  it('hasRoleClaims only accepts a real number', () => {
    expect(hasRoleClaims({ roleLevel: 4 })).toBe(true);
    expect(hasRoleClaims({ role_level: 4 })).toBe(true);
    expect(hasRoleClaims({ roleLevel: '4' })).toBe(false);
    expect(hasRoleClaims({ role: 'SALES_REP' })).toBe(false);
    expect(hasRoleClaims(null)).toBe(false);
  });
});

describe('WF-R-03: the write points are wired', () => {
  const read = (p: string) => readFileSync(p, 'utf8');
  // Strip comments: an absence assertion otherwise matches the prose explaining
  // the thing it is asserting is gone (the check:edge-coverage lesson).
  const code = (p: string) =>
    read(p)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

  it('signup puts the claims in the app_metadata it creates the user with', () => {
    const src = code('supabase/functions/signup/index.ts');
    expect(src).toMatch(/buildRoleClaims\(supabaseAdmin, roleId\)/);
    expect(src).toMatch(/claimsPatch\(roleClaims\)/);
  });

  it('the admin invite writes claims, which inviteUserByEmail cannot', () => {
    const src = code('supabase/functions/admin/index.ts');
    expect(src).toMatch(/buildRoleClaims\(admin, newUser\.role_id\)/);
  });

  it('changing a role re-syncs the claim', () => {
    const src = code('supabase/functions/admin/index.ts');
    expect(src).toMatch(/syncRoleClaims\(admin, resourceId, updatedUser\.role_id\)/);
  });

  it('mobile-auth persists the level it computes rather than only returning it', () => {
    const src = code('supabase/functions/mobile-auth/index.ts');
    expect(src).toMatch(/updateUserById\(gotrueUser\.id, \{\s*app_metadata: claimsPatch\(claims\)/);
  });

  it('requireAuth backfills a bag with no level', () => {
    const src = code('supabase/functions/_shared/auth.ts');
    expect(src).toMatch(/ensureRoleClaims\(getServiceClient\(\)/);
    expect(src).toMatch(/hasRoleClaims\(user\.app_metadata\)/);
  });

  it('requirePlatformAdmin no longer compares the code against a lowercase string', () => {
    const src = code('supabase/functions/_shared/auth.ts');
    expect(src).not.toMatch(/role === 'platform_admin'/);
    expect(src).toMatch(/roleCode === 'PLATFORM_ADMIN'/);
  });
});

describe('WF-R-03: the five functions that gate on level', () => {
  // AC5 names these five. Their thresholds are read out of the SOURCE rather than
  // typed here, so a threshold that moves fails this test instead of silently
  // outliving it. What is verified is the predicate against the bag the claims
  // actually produce - not a deployed request, which needs a live GoTrue.
  const ctxFor = (appMetadata: Record<string, unknown>) =>
    ({ supabaseUser: { app_metadata: appMetadata } }) as never;

  const bagFor = async (row: Row) => {
    const admin = fakeAdmin({ roles: [row] });
    const claims = await buildRoleClaims(admin, row.id as string);
    return claimsPatch(claims!);
  };

  const MANAGER_ROW = {
    id: 'role-mgr',
    code: 'SALES_MANAGER',
    level: 4,
    permissions: {},
    can_access_all_tenants: false,
  };

  it('erp-integration and device-monitoring stop denying a platform admin', async () => {
    const l4 = await bagFor(MANAGER_ROW);
    const l8 = await bagFor(PLATFORM_ADMIN_ROW);
    // What the claim fixes: with no claim every user reads as level 1, so BOTH
    // gates denied a platform admin. Thresholds differ (5 and 3), so the level-4
    // decision is asserted against each function's own number rather than a
    // guess, and a threshold that moves changes the expectation with it.
    for (const fn of ['erp-integration', 'device-monitoring']) {
      const src = readFileSync(`supabase/functions/${fn}/index.ts`, 'utf8');
      const threshold = Number(/roleLevel < (\d+)/.exec(src)?.[1]);
      expect(threshold, `${fn} level gate`).toBeGreaterThan(0);

      expect(getRoleLevel(ctxFor({ tenantId: 't1', roleId: 'role-pa' })) >= threshold).toBe(false);
      expect(getRoleLevel(ctxFor(l8)) >= threshold, `${fn} admits level 8`).toBe(true);
      expect(getRoleLevel(ctxFor(l4)) >= threshold, `${fn} on level 4`).toBe(4 >= threshold);
    }
  });

  it('monitoring-clients takes the fast path for level 8 and not for level 4', async () => {
    const src = readFileSync('supabase/functions/monitoring-clients/index.ts', 'utf8');
    const threshold = Number(/jwtLevel >= (\d+)/.exec(src)?.[1]);
    expect(threshold).toBeGreaterThan(0);
    const l4 = await bagFor(MANAGER_ROW);
    const l8 = await bagFor(PLATFORM_ADMIN_ROW);
    expect((l8.roleLevel as number) >= threshold).toBe(true);
    expect((l4.roleLevel as number) >= threshold).toBe(false);
    // Its other fast path is the flag, which nothing wrote before this story.
    expect(l8.isPlatformAdmin).toBe(true);
    expect(l4.isPlatformAdmin).toBe(false);
  });

  it('blog-agents admits a platform admin without a hand-edited flag', async () => {
    const l4 = await bagFor(MANAGER_ROW);
    const l8 = await bagFor(PLATFORM_ADMIN_ROW);
    expect(isPlatformAdmin(ctxFor(l8))).toBe(true);
    expect(isPlatformAdmin(ctxFor(l4))).toBe(false);
    // The predicate it applies is its own; assert the two claim shapes it reads.
    const src = readFileSync('supabase/functions/blog-agents/index.ts', 'utf8');
    expect(src).toMatch(/meta\.isPlatformAdmin === true/);
    expect(src).toMatch(/level >= 8/);
  });

  it('dashboard-widgets passes the seeded level and code to its RPC', async () => {
    const src = readFileSync('supabase/functions/dashboard-widgets/index.ts', 'utf8');
    expect(src).toMatch(/p_role_level: getRoleLevel\(ctx\)/);
    const l8 = await bagFor(PLATFORM_ADMIN_ROW);
    const l4 = await bagFor(MANAGER_ROW);
    expect(getRoleLevel(ctxFor(l8))).toBe(8);
    expect(getRoleLevel(ctxFor(l4))).toBe(4);
    expect(l4.role).toBe('SALES_MANAGER');
  });
});
