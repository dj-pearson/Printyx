/**
 * WF-R-09: a missing role was the most permissive state the system had.
 *
 * supabase/functions/me/ answered an account with no resolvable role - role_id
 * unset, or a roles row that had been deleted - with EVERY module permission at
 * level 1, which is the L1 tier of sales, service, finance and reports. The client
 * has always defaulted the same shape to all-false; the two disagreed and the
 * server was the side failing open.
 *
 * The second half is quieter and is what users would actually have noticed: the
 * role object carried no `code`, and `code` is what a dashboard layout is keyed on.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { expandLegacyPermissions } from '../../../client/src/lib/navigation-permissions';

type Row = Record<string, unknown>;
const state: { tables: Record<string, Row[]>; profileMissing: boolean } = {
  tables: {},
  profileMissing: false,
};

function tableApi(name: string) {
  const eqs: Array<[string, unknown]> = [];
  const api: Record<string, unknown> = {
    select: () => api,
    eq(col: string, val: unknown) {
      eqs.push([col, val]);
      return api;
    },
    single: async () => {
      if (name === 'users' && state.profileMissing) {
        return { data: null, error: { message: 'no rows' } };
      }
      const hit = (state.tables[name] ?? []).find((r) =>
        eqs.every(([c, v]) => String(r[c]) === String(v)),
      );
      return hit
        ? { data: { ...hit }, error: null }
        : { data: null, error: { message: 'no rows' } };
    },
  };
  return api;
}

vi.mock('../../../supabase/functions/_shared/supabase.ts', () => ({
  createSupabaseClient: () => ({
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: 'u1',
            email: 'u@x.com',
            app_metadata: { tenantId: 't1', roleId: 'role-1' },
            user_metadata: {},
          },
        },
        error: null,
      }),
    },
  }),
  createSupabaseServiceClient: () => ({ from: (t: string) => tableApi(t) }),
}));

(globalThis as { Deno?: unknown }).Deno = { env: { get: () => undefined } };

async function handler() {
  return (await import('../../../supabase/functions/me/index.ts')).default;
}

const get = () =>
  new Request('https://functions.printyx.net/', {
    headers: { Authorization: 'Bearer t' },
  });

const MODULES = [
  'sales',
  'service',
  'products',
  'inventory',
  'purchasing',
  'billing',
  'finance',
  'reports',
  'system',
];

beforeEach(() => {
  state.profileMissing = false;
  state.tables = {
    users: [{ id: 'u1', tenant_id: 't1', email: 'u@x.com', role_id: 'role-1' }],
    roles: [
      {
        id: 'role-1',
        code: 'SALES_REP',
        name: 'Sales Representative',
        level: 1,
        permissions: { sales: true, products: true, reports: true },
        can_access_all_tenants: false,
      },
    ],
  };
});

describe('WF-R-09: the no-role branch', () => {
  it('grants no module when the roles row is missing', async () => {
    state.tables.roles = [];
    const body = await (await (await handler())(get())).json();
    expect(body.role.level).toBe(1);
    for (const m of MODULES) {
      expect(body.role.permissions[m], m).toBe(false);
    }
  });

  it('grants no module when there is no user profile at all', async () => {
    state.profileMissing = true;
    const body = await (await (await handler())(get())).json();
    for (const m of MODULES) {
      expect(body.role.permissions[m], m).toBe(false);
    }
  });

  it('expands to an empty permission set, so only alwaysVisible sections show', async () => {
    // The rule the sidebar applies: every granular permission comes from a module
    // boolean plus the level. All-false at level 1 is nothing at all.
    state.tables.roles = [];
    const body = await (await (await handler())(get())).json();
    expect(expandLegacyPermissions(body.role.permissions, body.role.level).size).toBe(0);
  });

  it('is what the pre-fix branch did NOT do', () => {
    // The measurement that makes this worth doing: the old fallback was every
    // module true, which at level 1 is a real slice of the product.
    const allTrue = Object.fromEntries(MODULES.map((m) => [m, true]));
    expect(expandLegacyPermissions(allTrue, 1).size).toBeGreaterThan(10);
  });

  it('carries a null code rather than omitting the key', async () => {
    state.tables.roles = [];
    const body = await (await (await handler())(get())).json();
    expect(body.role).toHaveProperty('code');
    expect(body.role.code).toBeNull();
  });
});

describe('WF-R-09: the found-role branch', () => {
  it('returns the code and the level from the roles row', async () => {
    const body = await (await (await handler())(get())).json();
    expect(body.role.code).toBe('SALES_REP');
    expect(body.role.level).toBe(1);
    expect(body.role.name).toBe('Sales Representative');
  });

  it('keeps the role permissions it was given', async () => {
    const body = await (await (await handler())(get())).json();
    expect(body.role.permissions.sales).toBe(true);
    expect(body.role.permissions.service).toBeFalsy();
  });
});

describe('WF-R-09: the client reads the code it now gets', () => {
  const hook = readFileSync('client/src/hooks/useSupabaseAuth.ts', 'utf8');

  it('selects code from the roles table', () => {
    // /api/me has no caller in any client tree; this direct query is the path a
    // web session actually takes, and it did not ask for `code`.
    expect(hook).toMatch(/\.select\('id, code, name, department, level, permissions/);
    expect(hook).toMatch(/code: role\.code \?\? undefined/);
  });

  it('agrees with the server on what "no role" means', () => {
    const meSrc = readFileSync('supabase/functions/me/index.ts', 'utf8');
    // Both sides name the same nine modules and default them all to false.
    expect(meSrc).toMatch(/function defaultRolePermissions\(\)/);
    expect(hook).toMatch(/function defaultRolePermissions\(\)/);
    for (const m of MODULES) {
      expect(hook, m).toMatch(new RegExp(`${m}: false`));
    }
  });
});

describe('WF-R-09: the seeded roles are not left with an empty blob', () => {
  const sql = readFileSync('drizzle/migrations/0073_role_module_permissions.sql', 'utf8');

  it('fills every code migration 0072 seeds', () => {
    const seeded = [
      ...readFileSync('drizzle/migrations/0072_seed_role_catalogue.sql', 'utf8').matchAll(
        /^\s*\('[^']*', '([A-Z_]+)',/gm,
      ),
    ].map((m) => m[1]);
    const filled = [...sql.matchAll(/^\s*\('([A-Z_]+)', '\{/gm)].map((m) => m[1]);
    expect(filled.sort()).toEqual(seeded.sort());
  });

  it('never overwrites a blob somebody has customised', () => {
    expect(sql).toMatch(/r\.permissions IS NULL OR r\.permissions = '\{\}'::jsonb/);
  });

  it('gives a company admin every module and a rep only their own', () => {
    const blobFor = (code: string) =>
      JSON.parse(new RegExp(`'${code}', '(\\{[^']*\\})'`).exec(sql)![1]);
    const admin = blobFor('COMPANY_ADMIN');
    expect(MODULES.every((m) => admin[m] === true)).toBe(true);

    const rep = blobFor('SALES_REP');
    expect(rep.sales).toBe(true);
    expect(rep.service).toBe(false);
    expect(rep.system).toBe(false);
  });

  it('is what stops the closed fallback from becoming a lockout', () => {
    // With 0072's empty blob, expandLegacyPermissions returns nothing AT ANY
    // LEVEL - so closing the fallback without this migration would have shown a
    // company admin the same empty sidebar as an unplaced account.
    expect(expandLegacyPermissions({}, 7).size).toBe(0);
    const admin = JSON.parse(new RegExp(`'COMPANY_ADMIN', '(\\{[^']*\\})'`).exec(sql)![1]);
    expect(expandLegacyPermissions(admin, 7).size).toBeGreaterThan(50);
  });
});
