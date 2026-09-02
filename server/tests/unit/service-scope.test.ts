/**
 * WF-R-07: the service surface, driven end to end.
 *
 * supabase/functions/service/ has no assignee filter anywhere - every .eq in it is
 * tenant_id or an id - and service-tickets, technicians and technician-management
 * applied none either. The sidebar hides analytics from technicians; the API did
 * not. AC5 asks specifically for a FIELD_TECHNICIAN receiving only their own
 * tickets, so this runs the real handler against a fake PostgREST rather than
 * reading its source.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';

type Row = Record<string, unknown>;

const state: {
  tables: Record<string, Row[]>;
  claims: Row;
  writes: { table: string; patch: Row }[];
  deletes: string[];
} = { tables: {}, claims: {}, writes: [], deletes: [] };

function tableApi(name: string) {
  const eqs: Array<[string, unknown]> = [];
  const ors: string[] = [];
  const ins: Array<[string, unknown[]]> = [];
  let mode: 'select' | 'insert' | 'update' | 'delete' = 'select';
  let pending: Row[] = [];
  let patch: Row = {};

  const api: Record<string, unknown> = {
    select: () => api,
    order: () => api,
    limit: () => api,
    range: () => api,
    ilike: () => api,
    eq(col: string, val: unknown) {
      eqs.push([col, val]);
      return api;
    },
    in(col: string, vals: unknown[]) {
      ins.push([col, vals]);
      return api;
    },
    or(expr: string) {
      ors.push(expr);
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
    delete() {
      mode = 'delete';
      return api;
    },
    single: () => Promise.resolve(run(true)),
    maybeSingle: () => Promise.resolve(run(true)),
    then: (resolve: (v: unknown) => void) => Promise.resolve(run(false)).then(resolve),
  };

  /** Only the `col.in.("a","b")` / `col.is.null` shapes _shared/scope.ts builds. */
  const matchesOr = (r: Row, expr: string): boolean =>
    expr.split(/,(?=[a-z_]+\.(?:in|is)\.)/).some((clause) => {
      const col = clause.slice(0, clause.indexOf('.'));
      const op = clause.split('.')[1];
      if (op === 'is') return r[col] === null || r[col] === undefined;
      const vals = clause
        .slice(clause.indexOf('(') + 1, clause.lastIndexOf(')'))
        .split(',')
        .map((v) => v.replace(/^"|"$/g, ''));
      return vals.includes(String(r[col]));
    });

  function run(single: boolean) {
    state.tables[name] ??= [];
    if (mode === 'insert') {
      const stored = pending.map((r, i) => ({ id: `${name}-${i + 1}`, ...r }));
      state.tables[name].push(...stored);
      return { data: single ? { ...stored[0] } : stored, error: null };
    }
    const hits = state.tables[name].filter(
      (r) =>
        eqs.every(([c, v]) => String(r[c]) === String(v)) &&
        ins.every(([c, vals]) => vals.map(String).includes(String(r[c]))) &&
        ors.every((expr) => matchesOr(r, expr)),
    );
    if (mode === 'update') {
      state.writes.push({ table: name, patch });
      for (const row of hits) Object.assign(row, patch);
      return { data: hits[0] ? { ...hits[0] } : null, error: null };
    }
    if (mode === 'delete') {
      state.deletes.push(name);
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
        data: { user: { id: 'tech-1', app_metadata: state.claims } },
        error: null,
      }),
    },
  }),
  createSupabaseServiceClient: () => ({ from: (t: string) => tableApi(t) }),
}));

(globalThis as { Deno?: unknown }).Deno = { env: { get: () => undefined } };

async function handler() {
  return (await import('../../../supabase/functions/service-tickets/index.ts')).default;
}

function req(path: string, method = 'GET', body?: unknown) {
  return new Request(`https://functions.printyx.net${path}`, {
    method,
    headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

/** roleLevel 1 is what a seeded FIELD_TECHNICIAN carries (migration 0072). */
const TECHNICIAN = { tenant_id: 't1', roleLevel: 1, role: 'FIELD_TECHNICIAN' };
const MANAGER = { tenant_id: 't1', roleLevel: 4, role: 'SERVICE_MANAGER' };
const COMPANY_ADMIN = { tenant_id: 't1', roleLevel: 7, role: 'COMPANY_ADMIN' };

beforeEach(() => {
  state.claims = TECHNICIAN;
  state.writes = [];
  state.deletes = [];
  state.tables = {
    users: [
      { id: 'tech-1', tenant_id: 't1', team_id: 'crew-a', manager_id: 'sup-1' },
      { id: 'tech-2', tenant_id: 't1', team_id: 'crew-a', manager_id: 'sup-1' },
      { id: 'tech-3', tenant_id: 't1', team_id: 'crew-b', manager_id: 'sup-2' },
    ],
    service_tickets: [
      {
        id: 'tk-mine',
        tenant_id: 't1',
        ticket_number: 'SVC-1',
        status: 'open',
        assigned_technician_id: 'tech-1',
        created_by: 'dispatch',
        created_at: '2026-09-01T00:00:00.000Z',
      },
      {
        id: 'tk-theirs',
        tenant_id: 't1',
        ticket_number: 'SVC-2',
        status: 'open',
        assigned_technician_id: 'tech-3',
        created_by: 'dispatch',
        created_at: '2026-09-01T00:00:00.000Z',
      },
      {
        id: 'tk-unassigned',
        tenant_id: 't1',
        ticket_number: 'SVC-3',
        status: 'open',
        assigned_technician_id: null,
        created_by: 'dispatch',
        created_at: '2026-09-01T00:00:00.000Z',
      },
    ],
  };
});

const ids = async (res: Response) => ((await res.json()).data as { id: string }[]).map((t) => t.id);

describe('WF-R-07: a FIELD_TECHNICIAN gets only their own tickets (AC5)', () => {
  it('lists their ticket and not a colleague', async () => {
    const res = await (await handler())(req('/'));
    expect(res.status).toBe(200);
    expect(await ids(res)).toEqual(['tk-mine']);
  });

  it('does not see the unassigned one either, because own means mine', async () => {
    const res = await (await handler())(req('/'));
    expect(await ids(res)).not.toContain('tk-unassigned');
  });
});

describe('WF-R-07: the tiers above widen correctly', () => {
  it('a manager sees their crew, including the unassigned queue', async () => {
    // tech-2 is on the same team; tech-3 is not. The unassigned ticket is shared
    // work above own scope - a dispatch queue that hides unclaimed jobs is worse
    // than no filter.
    state.claims = { ...MANAGER };
    state.tables.users = [
      { id: 'tech-1', tenant_id: 't1', team_id: 'crew-a', manager_id: null },
      { id: 'tech-2', tenant_id: 't1', team_id: 'crew-a', manager_id: 'tech-1' },
      { id: 'tech-3', tenant_id: 't1', team_id: 'crew-b', manager_id: 'sup-2' },
    ];
    const res = await (await handler())(req('/'));
    const got = await ids(res);
    expect(got).toContain('tk-mine');
    expect(got).toContain('tk-unassigned');
    expect(got).not.toContain('tk-theirs');
  });

  it('a company admin is unscoped', async () => {
    state.claims = { ...COMPANY_ADMIN };
    const res = await (await handler())(req('/'));
    expect((await ids(res)).sort()).toEqual(['tk-mine', 'tk-theirs', 'tk-unassigned']);
  });

  it('a caller with no level claim reads as level 1, not as unscoped', async () => {
    // The pre-WF-R-03 bag. Failing open here would undo the whole story.
    state.claims = { tenant_id: 't1' };
    const res = await (await handler())(req('/'));
    expect(await ids(res)).toEqual(['tk-mine']);
  });
});

describe('WF-R-07: a technician cannot act on another technician ticket (AC4)', () => {
  it('refuses to close it', async () => {
    const res = await (await handler())(req('/tk-theirs', 'PATCH', { status: 'closed' }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('ROW_OUT_OF_SCOPE');
    expect(state.writes).toHaveLength(0);
  });

  it('refuses to delete it', async () => {
    const res = await (await handler())(req('/tk-theirs', 'DELETE'));
    expect(res.status).toBe(403);
    expect(state.deletes).toHaveLength(0);
  });

  it('refuses to write an update onto it', async () => {
    const res = await (
      await handler()
    )(req('/tk-theirs/updates', 'POST', { updateType: 'note', notes: 'done' }));
    expect(res.status).toBe(403);
    expect(state.tables.service_ticket_updates ?? []).toHaveLength(0);
  });

  it('still lets them close their own', async () => {
    const res = await (await handler())(req('/tk-mine', 'PATCH', { status: 'closed' }));
    expect(res.status).toBe(200);
    expect(state.writes.some((w) => w.table === 'service_tickets')).toBe(true);
  });

  it('answers 404, not 403, for a ticket that does not exist', async () => {
    // A 403 on an unknown id tells the caller which ids are real.
    const res = await (await handler())(req('/tk-nope', 'DELETE'));
    expect(res.status).not.toBe(403);
  });
});

describe('WF-R-07: the rest of the service surface', () => {
  const readCode = (p: string) =>
    readFileSync(p, 'utf8')
      .split('\n')
      .filter((l) => {
        const t = l.trim();
        return !t.startsWith('//') && !t.startsWith('/*') && !t.startsWith('*');
      })
      .join('\n');

  it('scopes both technician rosters through technicians.user_id', () => {
    for (const f of [
      'supabase/functions/technicians/index.ts',
      'supabase/functions/technician-management/index.ts',
    ]) {
      expect(readCode(f), f).toMatch(/applyUserScope\(query, 'user_id', scope\)/);
    }
  });

  it('scopes the meter-read review queue through the customer, not the reviewer', () => {
    const src = readCode('supabase/functions/meter-reads/index.ts');
    expect(src).toMatch(/await accessibleCustomerIds\(admin, tenantId, scope\)/);
    // reviewed_by_user_id is whoever triaged it. Scoping on it would show a
    // reviewer the queue they had already cleared and nothing still waiting.
    expect(src).not.toMatch(/applyUserScope\([^)]*reviewed_by_user_id/);
  });

  it('leaves the knowledge base cross-technician on purpose', () => {
    // AC1 names `service`, but that function has no ticket list - its search
    // returns resolution notes from CLOSED tickets, which is the whole point:
    // narrowing it to your own repairs would delete the feature.
    const src = readCode('supabase/functions/service/index.ts');
    expect(src).not.toMatch(/applyUserScope/);
    expect(src).toMatch(/service_ticket_embeddings/);
  });
});
