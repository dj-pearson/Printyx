/**
 * WF-V-01: the dispatcher's queue says what machine and who.
 *
 * supabase/functions/service-tickets/ joined nothing but the customer, so
 * equipmentModel and assignedTechnician were blank on every ticket in production
 * - while dev, served by server/routes-mobile-api.ts, joined all three with
 * Drizzle and looked correct. AUDIT-013 fixed the dev half and nobody connected
 * the two.
 *
 * customerName was blank in production too, which the story did not name:
 * ServiceHub.tsx reads `customerName` and its normalizer maps ticket columns but
 * not that one, because the Express handler already emitted it in camelCase. The
 * edge function emitted `customer_name`.
 *
 * The handler is driven for real against a fake PostgREST client, because what
 * broke was the shape of the response and only looking at the response catches it.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { technicianName } from '../../../supabase/functions/service-tickets/_enrich.ts';

interface Row {
  [key: string]: unknown;
}
const state: { tables: Record<string, Row[]>; filters: Record<string, Array<[string, unknown]>> } =
  {
    tables: {},
    filters: {},
  };

function tableApi(name: string) {
  const eqs: Array<[string, unknown]> = [];
  const ins: Array<[string, unknown[]]> = [];

  const api: Record<string, unknown> = {
    select: () => api,
    order: () => api,
    range: () => api,
    or: () => api,
    eq(col: string, val: unknown) {
      eqs.push([col, val]);
      return api;
    },
    in(col: string, vals: unknown[]) {
      ins.push([col, vals]);
      return api;
    },
    single: () => Promise.resolve(run(true)),
    then: (resolve: (v: unknown) => void) => Promise.resolve(run(false)).then(resolve),
  };

  function run(single: boolean) {
    state.tables[name] ??= [];
    state.filters[name] = [...eqs];
    const hits = state.tables[name].filter(
      (r) =>
        eqs.every(([c, v]) => String(r[c]) === String(v)) &&
        ins.every(([c, vals]) => vals.map(String).includes(String(r[c]))),
    );
    return single
      ? { data: hits[0] ?? null, error: hits[0] ? null : { message: 'not found' } }
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

function seed() {
  state.tables = {
    service_tickets: [
      {
        id: 'tk-1',
        tenant_id: 'tenant-1',
        ticket_number: 'SVC-1001',
        title: 'Paper jam',
        status: 'open',
        customer_id: 'cust-1',
        equipment_id: 'eq-1',
        assigned_technician_id: 'tech-1',
        created_at: '2026-09-01T00:00:00.000Z',
      },
      {
        id: 'tk-2',
        tenant_id: 'tenant-1',
        ticket_number: 'SVC-1002',
        status: 'open',
        customer_id: null,
        equipment_id: null,
        assigned_technician_id: null,
        created_at: '2026-09-01T00:00:00.000Z',
      },
    ],
    business_records: [{ id: 'cust-1', tenant_id: 'tenant-1', company_name: 'Acme Legal' }],
    equipment: [
      { id: 'eq-1', tenant_id: 'tenant-1', model_number: 'bizhub C360i', serial_number: 'A1B2C3' },
      // Another tenant's machine, sharing nothing but the shape. If the lookup
      // were not tenant-scoped, an id that leaked across tenants would resolve.
      { id: 'eq-other', tenant_id: 'tenant-2', model_number: 'LEAKED', serial_number: 'X' },
    ],
    technicians: [
      { id: 'tech-1', tenant_id: 'tenant-1', first_name: 'Dana', last_name: 'Okafor' },
      { id: 'tech-2', tenant_id: 'tenant-1', first_name: 'Sam', last_name: null },
    ],
    service_ticket_updates: [],
  };
  state.filters = {};
}

async function handler() {
  return (await import('../../../supabase/functions/service-tickets/index.ts')).default;
}

function get(path: string) {
  return new Request(`https://functions.printyx.net${path}`, {
    headers: { Authorization: 'Bearer t' },
  });
}

describe('WF-V-01: the ticket list carries the machine and the technician', () => {
  beforeEach(seed);

  it('enriches each row under the keys ServiceHub.tsx reads', async () => {
    const res = await (await handler())(get('/'));
    expect(res.status).toBe(200);
    const body = await res.json();

    const ticket = body.data.find((t: { id: string }) => t.id === 'tk-1');
    expect(ticket).toMatchObject({
      customerName: 'Acme Legal',
      equipmentModel: 'bizhub C360i',
      equipmentSerial: 'A1B2C3',
      assignedTechnician: 'Dana Okafor',
    });
    // The snake_case key other callers read is kept alongside.
    expect(ticket.customer_name).toBe('Acme Legal');
  });

  it('leaves the fields null on a ticket with no equipment or technician', async () => {
    const res = await (await handler())(get('/'));
    const body = await res.json();

    const ticket = body.data.find((t: { id: string }) => t.id === 'tk-2');
    expect(ticket.customerName).toBeNull();
    expect(ticket.equipmentModel).toBeNull();
    expect(ticket.assignedTechnician).toBeNull();
  });

  it('scopes every lookup to the tenant', async () => {
    await (
      await handler()
    )(get('/'));
    for (const table of ['business_records', 'equipment', 'technicians']) {
      expect(state.filters[table], `${table} was not tenant-scoped`).toContainEqual([
        'tenant_id',
        'tenant-1',
      ]);
    }
  });

  it('enriches the single-ticket response the same way', async () => {
    const res = await (await handler())(get('/tk-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      equipmentModel: 'bizhub C360i',
      assignedTechnician: 'Dana Okafor',
      customerName: 'Acme Legal',
    });
  });
});

describe('WF-V-01: technician names', () => {
  it('joins the two parts', () => {
    expect(technicianName({ first_name: 'Dana', last_name: 'Okafor' })).toBe('Dana Okafor');
  });

  it('uses whichever part is stored rather than rendering a stray space', () => {
    expect(technicianName({ first_name: 'Sam', last_name: null })).toBe('Sam');
    expect(technicianName({ first_name: null, last_name: 'Okafor' })).toBe('Okafor');
  });

  it('is null when neither is stored, so the caller can say Unassigned', () => {
    expect(technicianName({})).toBeNull();
    expect(technicianName({ first_name: '', last_name: '' })).toBeNull();
  });
});
