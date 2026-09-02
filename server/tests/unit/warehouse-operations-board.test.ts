/**
 * WF-L-03: the warehouse board works in production.
 *
 * WarehouseOperations.tsx lists GET /api/warehouse-operations, creates with POST
 * and advances with PATCH /:id/status. None of the three existed in
 * supabase/functions/warehouse-operations/ - all fell to its terminal 404 - so the
 * board worked only in dev, where server/routes-warehouse.ts served them.
 * EDGE-002h missed it because that check compares NAMED sub-paths, and the bare
 * list has no name.
 *
 * Two things are pinned here beyond "it answers". The rows come back camelCase,
 * because that is what the page reads and a snake_case row renders blank. And the
 * status change writes completed_date and NOT completed_by: the Express handler
 * set completedBy on completion, warehouse_operations has no such column, and
 * Drizzle drops an unknown key without complaining - so the field was never
 * stored and nothing ever said so.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

interface Row {
  [key: string]: unknown;
}
const state: { tables: Record<string, Row[]>; lastInsert: Row | null; lastPatch: Row | null } = {
  tables: {},
  lastInsert: null,
  lastPatch: null,
};

function tableApi(name: string) {
  const eqs: Array<[string, unknown]> = [];
  let mode: 'select' | 'insert' | 'update' = 'select';
  let pending: Row[] = [];
  let patch: Row = {};

  const api: Record<string, unknown> = {
    select: () => api,
    order: () => api,
    limit: () => api,
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
    single: () => Promise.resolve(run(true)),
    maybeSingle: () => Promise.resolve(run(true)),
    then: (resolve: (v: unknown) => void) => Promise.resolve(run(false)).then(resolve),
  };

  function run(single: boolean) {
    state.tables[name] ??= [];
    if (mode === 'insert') {
      state.lastInsert = pending[0];
      const stored = pending.map((r, i) => ({ id: `${name}-${i + 1}`, ...r }));
      state.tables[name].push(...stored);
      return { data: single ? { ...stored[0] } : stored, error: null };
    }
    const hits = state.tables[name].filter((r) =>
      eqs.every(([c, v]) => String(r[c]) === String(v)),
    );
    if (mode === 'update') {
      state.lastPatch = patch;
      for (const row of hits) Object.assign(row, patch);
      return { data: hits[0] ? { ...hits[0] } : null, error: null };
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
        data: { user: { id: 'user-1', app_metadata: { tenant_id: 'tenant-1' } } },
        error: null,
      }),
    },
  }),
  createSupabaseServiceClient: () => ({ from: (t: string) => tableApi(t) }),
}));

(globalThis as { Deno?: unknown }).Deno = { env: { get: () => undefined } };

async function handler() {
  return (await import('../../../supabase/functions/warehouse-operations/index.ts')).default;
}

function req(path: string, method = 'GET', body?: unknown) {
  return new Request(`https://functions.printyx.net${path}`, {
    method,
    headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe('WF-L-03: the board list, create and status change', () => {
  beforeEach(() => {
    state.tables = {
      warehouse_operations: [
        {
          id: 'op-1',
          tenant_id: 'tenant-1',
          equipment_id: 'eq-1',
          operation_type: 'receiving',
          status: 'pending',
          created_at: '2026-09-01T00:00:00.000Z',
        },
      ],
    };
    state.lastInsert = null;
    state.lastPatch = null;
  });

  it('lists the tenant operations in the camelCase the page reads', async () => {
    const res = await (await handler())(req('/'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      id: 'op-1',
      equipmentId: 'eq-1',
      operationType: 'receiving',
      status: 'pending',
    });
    expect(body[0].operation_type).toBeUndefined();
  });

  it('creates from the shape the dialog posts', async () => {
    const res = await (
      await handler()
    )(req('/', 'POST', { equipmentId: 'eq-2', operationType: 'staging', notes: 'bay 3' }));
    expect(res.status).toBe(201);
    expect(state.lastInsert).toMatchObject({
      tenant_id: 'tenant-1',
      equipment_id: 'eq-2',
      operation_type: 'staging',
      status: 'pending',
      notes: 'bay 3',
      // Unassigned defaults to the caller, as the Express version did.
      assigned_to: 'user-1',
    });
  });

  it('names the missing NOT NULL column instead of emitting a 23502', async () => {
    const res = await (await handler())(req('/', 'POST', { operationType: 'staging' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/equipmentId is required/);
  });

  it('advances the status and stamps completed_date, never completed_by', async () => {
    const res = await (await handler())(req('/op-1/status', 'PATCH', { status: 'completed' }));
    expect(res.status).toBe(200);
    expect(state.lastPatch).toHaveProperty('completed_date');
    // The column does not exist. Drizzle dropped it silently in the Express
    // handler, which is why nobody noticed it was never stored.
    expect(state.lastPatch).not.toHaveProperty('completed_by');
    expect((await res.json()).status).toBe('completed');
  });

  it('404s a status change on an operation from another tenant', async () => {
    state.tables.warehouse_operations.push({
      id: 'op-other',
      tenant_id: 'tenant-2',
      operation_type: 'receiving',
      status: 'pending',
    });
    const res = await (await handler())(req('/op-other/status', 'PATCH', { status: 'completed' }));
    expect(res.status).toBe(404);
  });

  it('does not let the single-operation GET swallow a named sub-path', async () => {
    // /stats is a real branch. Before the named-endpoint guard, a bare GET with
    // one segment would have read it as an operation id.
    const res = await (await handler())(req('/stats'));
    const body = await res.json();
    expect(body).toHaveProperty('totalOperations');
    expect(body.error).toBeUndefined();
  });
});
