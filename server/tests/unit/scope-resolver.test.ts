/**
 * WF-R-04: row visibility inside a tenant.
 *
 * Every list endpoint filtered on tenant_id alone, so a level-1 sales rep got
 * every deal, invoice, customer and quote in the company - including the dealer
 * cost and margin on every other rep's pricing. The two purpose-built engines
 * (server/middleware/hierarchical-query-builder.ts, scope-middleware.ts) are
 * Express-only and have no live callers, and production serves all of these from
 * edge functions, so neither has ever run against a real request.
 *
 * The tests drive the real resolver against a fake PostgREST and then assert the
 * FILTER each endpoint would send, by reading the endpoint's own source for the
 * columns it scopes on. A mock that only counted calls would pass on a module
 * that filtered the wrong column.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import {
  accessibleCustomerIds,
  applyCustomerScope,
  applyUserScope,
  CUSTOMER_SCOPE_CAP,
  requestedTier,
  resolveScope,
  scopeRoleLevel,
  tierForLevel,
  type ResolvedScope,
  type ScopeClient,
} from '../../../supabase/functions/_shared/scope';

type Row = Record<string, unknown>;

/** Records the filters a query received, so a test can assert the query itself. */
interface FakeQuery {
  filters: { op: string; arg: unknown; col?: string }[];
  or(expr: string): FakeQuery;
  in(col: string, vals: unknown[]): FakeQuery;
  eq(col: string, val: unknown): FakeQuery;
}

function fakeQuery(): FakeQuery {
  const q: FakeQuery = {
    filters: [],
    or(expr) {
      q.filters.push({ op: 'or', arg: expr });
      return q;
    },
    in(col, vals) {
      q.filters.push({ op: 'in', col, arg: vals });
      return q;
    },
    eq(col, val) {
      q.filters.push({ op: 'eq', col, arg: val });
      return q;
    },
  };
  return q;
}

function fakeDb(tables: Record<string, Row[]>): ScopeClient {
  function build(rows: Row[]) {
    let out = [...rows];
    let cap = Infinity;
    const api: Record<string, unknown> = {};
    const self = () => api as never;
    Object.assign(api, {
      select: () => self(),
      limit: (n: number) => {
        cap = n;
        return self();
      },
      eq: (col: string, val: unknown) => {
        out = out.filter((r) => r[col] === val);
        return self();
      },
      in: (col: string, vals: unknown[]) => {
        out = out.filter((r) => vals.includes(r[col]));
        return self();
      },
      or: (expr: string) => {
        // Only the shapes this module builds: `col.in.("a","b")` and `col.is.null`.
        const preds = expr.split(/,(?=[a-z_]+\.(?:in|is)\.)/);
        out = out.filter((r) =>
          preds.some((p) => {
            const [col, op, rest] = [
              p.slice(0, p.indexOf('.')),
              p.split('.')[1],
              p.slice(p.indexOf('.', p.indexOf('.') + 1) + 1),
            ];
            if (op === 'is') return r[col] === null || r[col] === undefined;
            const vals = rest
              .replace(/^\(|\)$/g, '')
              .split(',')
              .map((v) => v.replace(/^"|"$/g, ''));
            return vals.includes(r[col] as string);
          }),
        );
        return self();
      },
      maybeSingle: async () => ({ data: out[0] ?? null, error: null }),
      then: (resolve: (v: { data: Row[]; error: null }) => unknown) =>
        resolve({ data: out.slice(0, cap), error: null }),
    });
    return api;
  }
  return { from: (t: string) => build(tables[t] ?? []) } as ScopeClient;
}

const TENANT = 't1';
const bag = (level: number, extra: Record<string, unknown> = {}) => ({
  roleLevel: level,
  ...extra,
});

describe('WF-R-04: the tier ladder', () => {
  it('maps role level to the tier docs/rbac-decision.md sets out', () => {
    expect(tierForLevel(1)).toBe('own');
    expect(tierForLevel(2)).toBe('own');
    expect(tierForLevel(3)).toBe('team');
    expect(tierForLevel(4)).toBe('team');
    expect(tierForLevel(5)).toBe('regional');
    expect(tierForLevel(6)).toBe('regional');
    expect(tierForLevel(7)).toBe('company');
    expect(tierForLevel(8)).toBe('platform');
  });

  it('reads an absent level as 1, the same default the gates use', () => {
    expect(scopeRoleLevel(null)).toBe(1);
    expect(scopeRoleLevel({ role: 'SALES_REP' })).toBe(1);
    expect(scopeRoleLevel({ roleLevel: 7 })).toBe(7);
  });

  it('lets a claim narrow the tier but never widen it', () => {
    expect(requestedTier(bag(7, { accessScope: 'location' }))).toBe('location');
    expect(requestedTier(bag(1, { accessScope: 'company' }))).toBe('own');
    expect(requestedTier(bag(1, { territoryScope: 'platform' }))).toBe('own');
    expect(requestedTier(bag(4, { accessScope: 'nonsense' }))).toBe('team');
  });
});

describe('WF-R-04: resolving a scope', () => {
  const users = [
    { id: 'rep', tenant_id: TENANT, team_id: 'team-a', manager_id: 'mgr' },
    { id: 'rep2', tenant_id: TENANT, team_id: 'team-a', manager_id: 'mgr' },
    { id: 'mgr', tenant_id: TENANT, team_id: 'team-a', manager_id: null },
    { id: 'other', tenant_id: TENANT, team_id: 'team-b', manager_id: null },
  ];

  it('level 1 sees only itself', async () => {
    const s = await resolveScope(fakeDb({ users }), {
      userId: 'rep',
      tenantId: TENANT,
      appMetadata: bag(1),
    });
    expect(s.tier).toBe('own');
    expect(s.userIds).toEqual(['rep']);
  });

  it('level 4 sees its direct reports and its team', async () => {
    const s = await resolveScope(fakeDb({ users }), {
      userId: 'mgr',
      tenantId: TENANT,
      appMetadata: bag(4),
    });
    expect(s.tier).toBe('team');
    expect(new Set(s.userIds)).toEqual(new Set(['mgr', 'rep', 'rep2']));
    expect(s.userIds).not.toContain('other');
  });

  it('level 7 is unscoped', async () => {
    const s = await resolveScope(fakeDb({ users }), {
      userId: 'mgr',
      tenantId: TENANT,
      appMetadata: bag(7),
    });
    expect(s.tier).toBe('company');
    expect(s.userIds).toBeNull();
  });

  it('level 8 is unscoped and may cross tenants when the claim says so', async () => {
    const db = fakeDb({ users });
    const withFlag = await resolveScope(db, {
      userId: 'mgr',
      tenantId: TENANT,
      appMetadata: bag(8, { isPlatformAdmin: true }),
    });
    expect(withFlag.crossTenant).toBe(true);
    const without = await resolveScope(db, {
      userId: 'mgr',
      tenantId: TENANT,
      appMetadata: bag(8),
    });
    expect(without.crossTenant).toBe(false);
    expect(without.userIds).toBeNull();
  });

  it('a level-5 caller with no region degrades to a narrower tier, and says so', async () => {
    // Nothing in the tree writes users.region_id or primary_location_id - WF-R-08
    // is the story that fills them - so this is what every level-5 user hits today.
    const s = await resolveScope(fakeDb({ users, locations: [] }), {
      userId: 'mgr',
      tenantId: TENANT,
      appMetadata: bag(5),
    });
    expect(s.tier).toBe('team');
    expect(s.degradedFrom).toBe('regional');
    expect(s.userIds).not.toBeNull();
  });

  it('resolves a real region when the org structure is populated', async () => {
    const db = fakeDb({
      users: [
        { id: 'dir', tenant_id: TENANT, region_id: 'r1', primary_location_id: 'l1' },
        { id: 'a', tenant_id: TENANT, primary_location_id: 'l1' },
        { id: 'b', tenant_id: TENANT, primary_location_id: 'l2' },
        { id: 'c', tenant_id: TENANT, primary_location_id: 'l9' },
      ],
      locations: [
        { id: 'l1', tenant_id: TENANT, region_id: 'r1' },
        { id: 'l2', tenant_id: TENANT, region_id: 'r1' },
        { id: 'l9', tenant_id: TENANT, region_id: 'r2' },
      ],
    });
    const s = await resolveScope(db, {
      userId: 'dir',
      tenantId: TENANT,
      appMetadata: bag(5),
    });
    expect(s.tier).toBe('regional');
    expect(new Set(s.locationIds)).toEqual(new Set(['l1', 'l2']));
    expect(new Set(s.userIds)).toEqual(new Set(['dir', 'a', 'b']));
    expect(s.userIds).not.toContain('c');
  });

  it('degrades to own rather than leaking when the lookup throws', async () => {
    const broken = {
      from() {
        throw new Error('postgrest is down');
      },
    } as unknown as ScopeClient;
    const s = await resolveScope(broken, {
      userId: 'rep',
      tenantId: TENANT,
      appMetadata: bag(6),
    });
    expect(s.tier).toBe('own');
    expect(s.userIds).toEqual(['rep']);
  });
});

describe('WF-R-04: the filter that reaches PostgREST', () => {
  const scopeOf = (tier: ResolvedScope['tier'], userIds: string[] | null): ResolvedScope => ({
    tier,
    roleLevel: tier === 'own' ? 1 : 4,
    userIds,
    locationIds: null,
    crossTenant: false,
    degradedFrom: null,
  });

  it('adds nothing at all when the caller is unscoped', () => {
    const q = fakeQuery();
    applyUserScope(q, ['owner_id'], scopeOf('company', null));
    expect(q.filters).toEqual([]);
  });

  it('matches any of several owner columns', () => {
    const q = fakeQuery();
    applyUserScope(q, ['owner_id', 'assigned_sales_rep'], scopeOf('own', ['rep']));
    expect(q.filters).toHaveLength(1);
    expect(q.filters[0].arg).toBe('owner_id.in.("rep"),assigned_sales_rep.in.("rep")');
  });

  it('includes unowned rows above own scope, and excludes them at own scope', () => {
    const team = fakeQuery();
    applyUserScope(team, ['assigned_technician_id'], scopeOf('team', ['a', 'b']));
    expect(team.filters[0].arg).toContain('assigned_technician_id.is.null');

    const own = fakeQuery();
    applyUserScope(own, ['assigned_technician_id'], scopeOf('own', ['a']));
    expect(own.filters[0].arg).not.toContain('is.null');
  });

  it('quotes ids so a value carrying a comma cannot break out of the list', () => {
    const q = fakeQuery();
    applyUserScope(q, ['owner_id'], scopeOf('own', ['a,b)', 'c']));
    expect(q.filters[0].arg).toBe('owner_id.in.("a,b)","c")');
  });
});

describe('WF-R-04: tables with no owner column of their own', () => {
  const companies = [
    { id: 'c1', tenant_id: TENANT, owner_id: 'rep', assigned_sales_rep: null },
    { id: 'c2', tenant_id: TENANT, owner_id: 'other', assigned_sales_rep: 'rep' },
    { id: 'c3', tenant_id: TENANT, owner_id: 'other', assigned_sales_rep: null },
  ];
  const own = (ids: string[]): ResolvedScope => ({
    tier: 'own',
    roleLevel: 1,
    userIds: ids,
    locationIds: null,
    crossTenant: false,
    degradedFrom: null,
  });

  it('resolves the customers a rep owns or is assigned to', async () => {
    const res = await accessibleCustomerIds(fakeDb({ companies }), TENANT, own(['rep']));
    expect(new Set(res.ids)).toEqual(new Set(['c1', 'c2']));
    expect(res.overflow).toBe(false);
  });

  it('returns no filter at all for an unscoped caller', async () => {
    const unscoped: ResolvedScope = { ...own([]), tier: 'company', userIds: null };
    const res = await accessibleCustomerIds(fakeDb({ companies }), TENANT, unscoped);
    expect(res.ids).toBeNull();
  });

  it('reports overflow past the cap instead of building an unsendable URL', async () => {
    const many = Array.from({ length: CUSTOMER_SCOPE_CAP + 5 }, (_, i) => ({
      id: `c${i}`,
      tenant_id: TENANT,
      owner_id: 'rep',
      assigned_sales_rep: null,
    }));
    const res = await accessibleCustomerIds(fakeDb({ companies: many }), TENANT, own(['rep']));
    expect(res.overflow).toBe(true);
    expect(res.ids).toBeNull();
  });

  it('narrows on overflow: to the row-level column when there is one', () => {
    const q = fakeQuery();
    applyCustomerScope(q, 'customer_id', { ids: null, overflow: true }, own(['rep']), 'created_by');
    expect(q.filters[0].op).toBe('or');
    expect(q.filters[0].arg).toContain('created_by.in.');
  });

  it('narrows on overflow: to nothing at all when there is not', () => {
    const q = fakeQuery();
    applyCustomerScope(q, 'customer_id', { ids: null, overflow: true }, own(['rep']), null);
    expect(q.filters[0]).toEqual({ op: 'in', col: 'customer_id', arg: [] });
  });
});

describe('WF-R-04: every endpoint in the story applies it', () => {
  // The columns are read out of each function's own source. A handler that stops
  // calling the helper, or starts scoping the wrong column, fails here.
  const ENDPOINTS: [string, string, string[]][] = [
    [
      'business-records',
      'supabase/functions/business-records/index.ts',
      ['owner_id', 'assigned_sales_rep', 'created_by'],
    ],
    ['deals', 'supabase/functions/deals/index.ts', ['owner_id', 'created_by_id']],
    [
      'service-tickets',
      'supabase/functions/service-tickets/index.ts',
      ['assigned_technician_id', 'created_by'],
    ],
    ['tasks', 'supabase/functions/tasks/handlers/tasks.ts', ['assigned_to', 'created_by']],
    [
      'meter-readings',
      'supabase/functions/meter-readings/index.ts',
      ['technician_id', 'created_by'],
    ],
    ['purchase-orders', 'supabase/functions/purchase-orders/index.ts', ['created_by']],
    ['proposals', 'supabase/functions/proposals/index.ts', ['assigned_to', 'created_by']],
  ];

  for (const [name, file, columns] of ENDPOINTS) {
    it(`${name} scopes its list on ${columns.join(' / ')}`, () => {
      const src = readFileSync(file, 'utf8');
      expect(src, `${name} must resolve a scope`).toMatch(/await resolveScope\(/);
      const call = /applyUserScope\(\s*\w+,\s*(\[[^\]]*\]|'[a-z_]+')/.exec(src);
      expect(call, `${name} must apply it`).not.toBeNull();
      const named = [...call![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
      expect(named).toEqual(columns);
    });
  }

  for (const [name, file] of [
    ['invoices', 'supabase/functions/invoices/index.ts'],
    ['equipment', 'supabase/functions/equipment/index.ts'],
  ] as const) {
    it(`${name} scopes through the customer, having no owner column`, () => {
      const src = readFileSync(file, 'utf8');
      expect(src).toMatch(/await accessibleCustomerIds\(/);
      expect(src).toMatch(/applyCustomerScope\(query, 'customer_id'/);
    });
  }
});
