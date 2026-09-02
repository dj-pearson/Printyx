/**
 * WF-R-08: the org structure that everything else is scoped by.
 *
 * WF-R-04 through WF-R-07 scope every list on users.manager_id, users.team_id,
 * users.primary_location_id and users.region_id, and NOTHING WROTE ANY OF THEM:
 * the admin invite set role_id and team_id and stopped, and the only file that
 * ever assigned a manager (server/auth-setup.ts) has no importer. So location and
 * region scope degraded to team for every user in every tenant, in every one of
 * those five stories.
 *
 * The endpoints are driven against a fake PostgREST rather than read, because the
 * question is what gets WRITTEN - a placement dropped silently is exactly the bug
 * this story exists to fix.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'fs';

type Row = Record<string, unknown>;

const state: {
  tables: Record<string, Row[]>;
  inserts: { table: string; row: Row }[];
  updates: { table: string; patch: Row }[];
  claimWrites: { id: string; attrs: Row }[];
  invites: Row[];
} = { tables: {}, inserts: [], updates: [], claimWrites: [], invites: [] };

function tableApi(name: string) {
  const eqs: Array<[string, unknown]> = [];
  let mode: 'select' | 'insert' | 'update' | 'delete' = 'select';
  let pending: Row[] = [];
  let patch: Row = {};

  const api: Record<string, unknown> = {
    select: () => api,
    order: () => api,
    limit: () => api,
    range: () => api,
    or: () => api,
    in: () => api,
    ilike: () => api,
    eq(col: string, val: unknown) {
      eqs.push([col, val]);
      return api;
    },
    insert(rows: Row | Row[]) {
      mode = 'insert';
      pending = Array.isArray(rows) ? rows : [rows];
      return api;
    },
    update(next: Row) {
      mode = 'update';
      patch = next;
      return api;
    },
    upsert: () => api,
    delete() {
      mode = 'delete';
      return api;
    },
    single: () => Promise.resolve(run(true)),
    maybeSingle: () => Promise.resolve(run(true)),
    then: (resolve: (v: unknown) => void) => Promise.resolve(run(false)).then(resolve),
  };

  function run(single: boolean) {
    state.tables[name] ??= [];
    if (mode === 'insert') {
      const stored = pending.map((r, i) => ({ id: r.id ?? `${name}-${i + 1}`, ...r }));
      for (const r of pending) state.inserts.push({ table: name, row: r });
      state.tables[name].push(...stored);
      return { data: single ? { ...stored[0] } : stored, error: null };
    }
    const hits = state.tables[name].filter((r) =>
      eqs.every(([c, v]) => String(r[c]) === String(v)),
    );
    if (mode === 'update') {
      state.updates.push({ table: name, patch });
      for (const row of hits) Object.assign(row, patch);
      return { data: hits[0] ? { ...hits[0] } : null, error: null };
    }
    if (mode === 'delete') {
      state.tables[name] = state.tables[name].filter((r) => !hits.includes(r));
      return { data: null, error: null };
    }
    return single
      ? { data: hits[0] ? { ...hits[0] } : null, error: null }
      : { data: hits.map((r) => ({ ...r })), error: null, count: hits.length };
  }

  return api;
}

vi.mock('../../../supabase/functions/_shared/supabase.ts', () => ({
  createSupabaseClient: () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: 'admin-1', app_metadata: { tenantId: 't1', roleLevel: 7 } } },
        error: null,
      }),
    },
  }),
  createSupabaseServiceClient: () => ({
    from: (t: string) => tableApi(t),
    auth: {
      admin: {
        inviteUserByEmail: async (email: string) => {
          state.invites.push({ email });
          return { data: { user: { id: 'new-user' } }, error: null };
        },
        updateUserById: async (id: string, attrs: Row) => {
          state.claimWrites.push({ id, attrs });
          return { data: { user: { id } }, error: null };
        },
        deleteUser: async () => ({ data: null, error: null }),
      },
    },
  }),
}));

(globalThis as { Deno?: unknown }).Deno = { env: { get: () => undefined } };

async function handler() {
  return (await import('../../../supabase/functions/admin/index.ts')).default;
}

function req(path: string, method = 'GET', body?: unknown) {
  return new Request(`https://functions.printyx.net${path}`, {
    method,
    headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

beforeEach(() => {
  state.inserts = [];
  state.updates = [];
  state.claimWrites = [];
  state.invites = [];
  state.tables = {
    // checkAdminPermission reads the caller and then their role.
    users: [{ id: 'admin-1', tenant_id: 't1', role_id: 'role-admin', email: 'a@x.com' }],
    roles: [
      {
        id: 'role-admin',
        tenant_id: null,
        code: 'COMPANY_ADMIN',
        level: 7,
        can_manage_users: true,
      },
      {
        id: 'role-rep',
        code: 'SALES_REP',
        level: 1,
        permissions: {},
        can_access_all_tenants: false,
      },
    ],
    locations: [{ id: 'loc-1', tenant_id: 't1', name: 'Denver', is_active: true }],
    regions: [{ id: 'reg-1', tenant_id: 't1', name: 'Mountain', is_active: true }],
    teams: [{ id: 'team-1', tenant_id: 't1', name: 'Crew A', is_active: true }],
  };
});

describe('WF-R-08: the location, region and team tree', () => {
  for (const kind of ['locations', 'regions', 'teams'] as const) {
    it(`lists ${kind} in camelCase`, async () => {
      const res = await (await handler())(req(`/${kind}`));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveLength(1);
      expect(body[0].isActive).toBe(true);
      expect(body[0].is_active).toBeUndefined();
    });

    it(`creates a ${kind.slice(0, -1)} scoped to the tenant`, async () => {
      const res = await (await handler())(req(`/${kind}`, 'POST', { name: 'New', code: 'N1' }));
      expect(res.status).toBe(201);
      const written = state.inserts.find((i) => i.table === kind)!.row;
      expect(written).toMatchObject({ name: 'New', tenant_id: 't1' });
      // `teams` has no code column - name, department, location_id, manager_id,
      // parent_team_id, is_active and nothing else - so the key is dropped rather
      // than sent, and the page does not offer the field.
      if (kind === 'teams') expect(written).not.toHaveProperty('code');
      else expect(written.code).toBe('N1');
    });

    it(`refuses a ${kind.slice(0, -1)} with no name`, async () => {
      const res = await (await handler())(req(`/${kind}`, 'POST', { code: 'N1' }));
      expect(res.status).toBe(400);
    });

    it(`retires rather than deletes a ${kind.slice(0, -1)}`, async () => {
      // users.primary_location_id and friends carry no FK, so a hard delete would
      // leave people pointing at an id that resolves to nothing.
      const id = { locations: 'loc-1', regions: 'reg-1', teams: 'team-1' }[kind];
      const res = await (await handler())(req(`/${kind}/${id}`, 'DELETE'));
      expect(res.status).toBe(200);
      expect(state.updates.find((u) => u.table === kind)?.patch).toMatchObject({
        is_active: false,
      });
      expect(state.tables[kind]).toHaveLength(1);
    });
  }

  it('drops a key that is not a column instead of PGRST204-ing', async () => {
    await (
      await handler()
    )(req('/regions', 'POST', { name: 'X', nonsense: 'y', states: ['CO'] }));
    const written = state.inserts.find((i) => i.table === 'regions')!.row;
    expect(written).not.toHaveProperty('nonsense');
    expect(written.states).toEqual(['CO']);
  });

  it('accepts camelCase and snake_case for the same column', async () => {
    await (
      await handler()
    )(req('/locations', 'POST', { name: 'A', zip_code: '80202' }));
    await (
      await handler()
    )(req('/locations', 'POST', { name: 'B', zipCode: '80203' }));
    const rows = state.inserts.filter((i) => i.table === 'locations').map((i) => i.row);
    expect(rows[0].zip_code).toBe('80202');
    expect(rows[1].zip_code).toBe('80203');
  });
});

describe('WF-R-08: placing a user', () => {
  beforeEach(() => {
    state.tables.users.push({
      id: 'user-2',
      tenant_id: 't1',
      email: 'rep@x.com',
      role_id: 'role-rep',
    });
  });

  it('writes all four scoping columns, which the invite never did', async () => {
    const res = await (
      await handler()
    )(
      req('/users/user-2', 'PATCH', {
        managerId: 'admin-1',
        primaryLocationId: 'loc-1',
        regionId: 'reg-1',
        teamId: 'team-1',
      }),
    );
    expect(res.status).toBe(200);
    const patch = state.updates.find((u) => u.table === 'users')!.patch;
    expect(patch).toMatchObject({
      manager_id: 'admin-1',
      primary_location_id: 'loc-1',
      region_id: 'reg-1',
      team_id: 'team-1',
    });
  });

  it('clears a placement to null rather than to an empty string', async () => {
    // '' would scope the user to a location id that matches nothing, which looks
    // identical to a real location with no members.
    await (
      await handler()
    )(req('/users/user-2', 'PATCH', { primaryLocationId: '', regionId: '' }));
    const patch = state.updates.find((u) => u.table === 'users')!.patch;
    expect(patch.primary_location_id).toBeNull();
    expect(patch.region_id).toBeNull();
  });

  it('refreshes the WF-R-03 claim when the role changes', async () => {
    await (
      await handler()
    )(req('/users/user-2', 'PATCH', { roleId: 'role-admin' }));
    const claim = state.claimWrites.at(-1);
    expect(claim?.id).toBe('user-2');
    expect((claim?.attrs.app_metadata as Row).roleLevel).toBe(7);
  });

  it('carries the placement onto an invited user', async () => {
    const res = await (
      await handler()
    )(
      req('/users', 'POST', {
        email: 'new@x.com',
        roleId: 'role-rep',
        managerId: 'admin-1',
        primaryLocationId: 'loc-1',
        regionId: 'reg-1',
      }),
    );
    expect([200, 201]).toContain(res.status);
    const row = state.inserts.find((i) => i.table === 'users')!.row;
    expect(row).toMatchObject({
      manager_id: 'admin-1',
      primary_location_id: 'loc-1',
      region_id: 'reg-1',
    });
  });
});

describe('WF-R-08: the duplicates are gone and the page is wired', () => {
  it('deletes the three unreferenced user and location functions', () => {
    for (const fn of ['locations', 'user-management', 'users-team']) {
      expect(existsSync(`supabase/functions/${fn}/index.ts`), fn).toBe(false);
    }
  });

  it('routes and gates the page at level 5', () => {
    expect(readFileSync('client/src/App.tsx', 'utf8')).toMatch(
      /path="\/admin\/org-structure"[\s\S]{0,200}?minLevel=\{5\}/,
    );
    expect(readFileSync('client/src/lib/navigation-permissions.ts', 'utf8')).toMatch(
      /'\/admin\/org-structure':\s*\{[\s\S]{0,120}?minLevel: 5/,
    );
  });

  it('makes the four admin paths resolve in dev as well as production', () => {
    // /admin/user-management is a routed page calling /api/admin/users, and no
    // Express router owns that prefix - it worked in prod and 404'd in dev.
    const proxy = readFileSync('server/middleware/edge-function-proxy.ts', 'utf8');
    for (const path of ['users', 'locations', 'regions', 'teams']) {
      expect(proxy, path).toMatch(
        new RegExp(`'/api/admin/${path}':\\s*\\{ fn: 'admin', pathPrefix: '/${path}' \\}`),
      );
    }
  });
});

describe('WF-R-08: the page offers no field the table cannot store', () => {
  it('hides Code on the teams tab, because teams has no code column', () => {
    const page = readFileSync('client/src/pages/admin/OrgStructure.tsx', 'utf8');
    // An input that silently writes nothing is the defect shape this repo keeps
    // finding; better to not render it.
    expect(page).toMatch(/hasCode/);
    const schema = readFileSync('shared/schema.ts', 'utf8');
    const i = schema.search(/pgTable\(\s*'teams'/);
    let depth = 0;
    let block = '';
    for (let j = schema.indexOf('{', i); j < schema.length; j++) {
      if (schema[j] === '{') depth++;
      else if (schema[j] === '}' && --depth === 0) {
        block = schema.slice(i, j);
        break;
      }
    }
    expect(block).not.toMatch(/'code'/);
  });
});
