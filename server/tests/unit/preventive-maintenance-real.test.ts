/**
 * WF-V-04: preventive maintenance stops being a fixture.
 *
 * There were TWO fixture implementations of /api/maintenance/*, not the one the
 * story named. server/routes-preventive-maintenance.ts held four handlers whose
 * own comments said "Sample maintenance schedules until schema is updated" and was
 * NEVER REGISTERED; server/routes-sample-data.ts held the same four, WAS
 * registered, and is what dev actually hit. Production meanwhile reached
 * supabase/functions/maintenance/, over two tables that existed in no schema and
 * no migration.
 *
 * Both routers' maintenance handlers are gone, migration 0071 declares the tables,
 * and /api/maintenance is proxied so the two hosts run one implementation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { maintenanceSchedules, maintenanceRecords } from '../../../shared/maintenance-schema';
import { getTableColumns } from 'drizzle-orm';

interface Row {
  [key: string]: unknown;
}
const state: { tables: Record<string, Row[]>; lastInsert: Row[] | null } = {
  tables: {},
  lastInsert: null,
};

function tableApi(name: string) {
  const eqs: Array<[string, unknown]> = [];
  const ins: Array<[string, unknown[]]> = [];
  let mode: 'select' | 'insert' = 'select';
  let pending: Row[] = [];

  const api: Record<string, unknown> = {
    select: () => api,
    order: () => api,
    limit: () => api,
    gte: () => api,
    eq(col: string, val: unknown) {
      eqs.push([col, val]);
      return api;
    },
    in(col: string, vals: unknown[]) {
      ins.push([col, vals]);
      return api;
    },
    insert(rows: Row | Row[]) {
      mode = 'insert';
      pending = Array.isArray(rows) ? rows : [rows];
      return api;
    },
    single: () => Promise.resolve(run(true)),
    maybeSingle: () => Promise.resolve(run(true)),
    then: (resolve: (v: unknown) => void) => Promise.resolve(run(false)).then(resolve),
  };

  function run(single: boolean) {
    state.tables[name] ??= [];
    if (mode === 'insert') {
      state.lastInsert = pending;
      const stored = pending.map((r, i) => ({ id: `${name}-${i + 1}`, ...r }));
      state.tables[name].push(...stored);
      return { data: single ? stored[0] : stored, error: null };
    }
    const hits = state.tables[name].filter(
      (r) =>
        eqs.every(([c, v]) => String(r[c]) === String(v)) &&
        ins.every(([c, vals]) => vals.map(String).includes(String(r[c]))),
    );
    return single
      ? { data: hits[0] ?? null, error: null }
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
  return (await import('../../../supabase/functions/maintenance/index.ts')).default;
}

function req(path: string, method = 'GET', body?: unknown) {
  return new Request(`https://functions.printyx.net${path}`, {
    method,
    headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe('WF-V-04: the fixture routers are gone', () => {
  it('the unregistered one is deleted', () => {
    expect(existsSync('server/routes-preventive-maintenance.ts')).toBe(false);
  });

  it('the registered one no longer answers /api/maintenance', () => {
    // Comment-stripped: the file now explains in prose what used to be there, and
    // an absence assertion that matches its own explanation reports the
    // explanation as the defect.
    const code = readFileSync('server/routes-sample-data.ts', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    expect(code).not.toMatch(/app\.(get|post)\(\s*'\/api\/maintenance/);
  });
});

describe('WF-V-04: the tables the edge function uses are declared', () => {
  it('maintenance_schedules carries every column the handler writes', () => {
    const cols = new Set(Object.values(getTableColumns(maintenanceSchedules)).map((c) => c.name));
    for (const name of [
      'tenant_id',
      'equipment_id',
      'name',
      'maintenance_type',
      'frequency',
      'frequency_value',
      'next_due_date',
      'last_completed_date',
      'assigned_to',
      'estimated_duration',
      'checklist',
      'status',
      'created_by',
    ]) {
      expect(cols, `maintenance_schedules.${name}`).toContain(name);
    }
  });

  it('maintenance_records carries every column the completion path writes', () => {
    const cols = new Set(Object.values(getTableColumns(maintenanceRecords)).map((c) => c.name));
    for (const name of [
      'tenant_id',
      'schedule_id',
      'equipment_id',
      'maintenance_type',
      'completed_by',
      'completed_at',
      'notes',
      'parts_used',
      'labor_hours',
      'cost',
    ]) {
      expect(cols, `maintenance_records.${name}`).toContain(name);
    }
  });
});

describe('WF-V-04: auto-generate writes rows instead of reporting success', () => {
  beforeEach(() => {
    state.tables = {
      equipment: [
        { id: 'eq-1', tenant_id: 'tenant-1', model_number: 'C360i' },
        { id: 'eq-2', tenant_id: 'tenant-1', model_number: 'C450i' },
        // Another tenant's machine. An id pasted from elsewhere must not create a
        // schedule against it.
        { id: 'eq-other', tenant_id: 'tenant-2', model_number: 'LEAKED' },
      ],
      maintenance_schedules: [],
      maintenance_records: [],
    };
    state.lastInsert = null;
  });

  it('creates one schedule per owned machine and returns the persisted rows', async () => {
    const res = await (
      await handler()
    )(req('/auto-generate', 'POST', { equipmentIds: ['eq-1', 'eq-2'], frequency: 'quarterly' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.createdCount).toBe(2);
    expect(state.tables['maintenance_schedules']).toHaveLength(2);
    expect(state.lastInsert?.[0]).toMatchObject({
      tenant_id: 'tenant-1',
      equipment_id: 'eq-1',
      frequency: 'quarterly',
      status: 'active',
    });
    // The old fixture returned an annual-savings figure. Nothing here can price
    // maintenance that has not happened.
    expect(body).not.toHaveProperty('estimatedSavings');
    expect(body).not.toHaveProperty('costSavings');
  });

  it('skips an id belonging to another tenant and says which', async () => {
    const res = await (
      await handler()
    )(req('/auto-generate', 'POST', { equipmentIds: ['eq-1', 'eq-other'] }));
    const body = await res.json();
    expect(body.createdCount).toBe(1);
    expect(body.unknownEquipmentIds).toEqual(['eq-other']);
  });

  it('400s when none of the ids belong to the tenant', async () => {
    const res = await (await handler())(req('/auto-generate', 'POST', { equipmentIds: ['nope'] }));
    expect(res.status).toBe(400);
    expect(state.tables['maintenance_schedules']).toHaveLength(0);
  });
});

describe('WF-V-04: analytics reports only what the tables answer', () => {
  it('names what it will not claim rather than inventing a compliance rate', async () => {
    state.tables = {
      maintenance_schedules: [
        {
          id: 's1',
          tenant_id: 'tenant-1',
          status: 'active',
          next_due_date: '2020-01-01T00:00:00.000Z',
        },
      ],
      maintenance_records: [],
    };
    const res = await (await handler())(req('/analytics'));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.totalSchedules).toBe(1);
    expect(body.overdueSchedules).toBe(1);
    // Null, not 0: no record has logged hours, which is not the same as the work
    // taking no time.
    expect(body.totalLaborHours).toBeNull();
    expect(body.totalCost).toBeNull();
    expect(body.unbacked.join(' ')).toMatch(/complianceRate/);
    expect(body.unbacked.join(' ')).toMatch(/costSavings/);
  });
});
