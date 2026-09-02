/**
 * WF-V-02: the check-in console works a real ticket.
 *
 * MobileFieldService.tsx hard-coded serviceTicketId 'ticket-123' and
 * technicianId 'tech-456', with the comment "Mock service ticket ID for demo".
 * The backend behind it is real - the mobile function moves service_tickets.status
 * through in_progress and completed - so the only web surface with a working
 * check-in could not be pointed at anything.
 *
 * The second half is a hole rather than a gap: `?technicianId=` was taken from the
 * caller and used unchecked, so any authenticated member of the tenant could read
 * another technician's sessions, their assigned tickets (with customer addresses
 * and phone numbers) and their photos - and could open a session AS them.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';

type Row = Record<string, unknown>;
const state: {
  tables: Record<string, Row[]>;
  inserts: { table: string; row: Row }[];
  claims: Row;
} = { tables: {}, inserts: [], claims: {} };

function tableApi(name: string) {
  const eqs: Array<[string, unknown]> = [];
  const ors: string[] = [];
  const ins: Array<[string, unknown[]]> = [];
  let mode: 'select' | 'insert' | 'update' = 'select';
  let pending: Row[] = [];
  let patch: Row = {};

  const api: Record<string, unknown> = {
    select: () => api,
    order: () => api,
    limit: () => api,
    range: () => api,
    gte: () => api,
    not: () => api,
    neq: () => api,
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
    single: () => Promise.resolve(run(true)),
    maybeSingle: () => Promise.resolve(run(true)),
    then: (resolve: (v: unknown) => void) => Promise.resolve(run(false)).then(resolve),
  };

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
      for (const r of pending) state.inserts.push({ table: name, row: r });
      const stored = pending.map((r, i) => ({ id: `${name}-${i + 1}`, ...r }));
      state.tables[name].push(...stored);
      return { data: single ? { ...stored[0] } : stored, error: null };
    }
    const hits = state.tables[name].filter(
      (r) =>
        eqs.every(([c, v]) => String(r[c]) === String(v)) &&
        ins.every(([c, vals]) => vals.map(String).includes(String(r[c]))) &&
        ors.every((e) => matchesOr(r, e)),
    );
    if (mode === 'update') {
      for (const row of hits) Object.assign(row, patch);
      return { data: hits[0] ? { ...hits[0] } : null, error: null };
    }
    return single
      ? { data: hits[0] ? { ...hits[0] } : null, error: null }
      : { data: hits.map((r) => ({ ...r })), error: null };
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
  return (await import('../../../supabase/functions/mobile/index.ts')).default;
}

function call(path: string, method = 'GET', body?: unknown) {
  return new Request(`https://functions.printyx.net${path}`, {
    method,
    headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

const TECHNICIAN = { tenant_id: 't1', tenantId: 't1', roleLevel: 1, role: 'FIELD_TECHNICIAN' };
const SUPERVISOR = { tenant_id: 't1', tenantId: 't1', roleLevel: 3, role: 'SERVICE_SUPERVISOR' };

beforeEach(() => {
  state.claims = TECHNICIAN;
  state.inserts = [];
  state.tables = {
    users: [
      { id: 'tech-1', tenant_id: 't1', team_id: 'crew-a', manager_id: 'sup-1' },
      { id: 'tech-2', tenant_id: 't1', team_id: 'crew-a', manager_id: 'sup-1' },
      { id: 'tech-9', tenant_id: 't1', team_id: 'crew-z', manager_id: 'sup-9' },
    ],
    mobile_service_sessions: [
      { id: 's1', tenant_id: 't1', technician_id: 'tech-1', service_ticket_id: 'tk-1' },
      { id: 's2', tenant_id: 't1', technician_id: 'tech-9', service_ticket_id: 'tk-9' },
    ],
    service_tickets: [
      { id: 'tk-1', tenant_id: 't1', assigned_technician_id: 'tech-1', status: 'open' },
      { id: 'tk-9', tenant_id: 't1', assigned_technician_id: 'tech-9', status: 'open' },
    ],
  };
});

describe('WF-V-02: whose sessions am I looking at', () => {
  it('defaults to the caller when no technician is named', async () => {
    const res = await (await handler())(call('/sessions'));
    expect(res.status).toBe(200);
    const body = await res.json();
    const rows = Array.isArray(body) ? body : (body.data ?? []);
    expect(rows.map((r: { id: string }) => r.id)).toEqual(['s1']);
  });

  it('refuses a technician the caller may not see', async () => {
    // The hole: any tenant member could read another technician's sessions.
    const res = await (await handler())(call('/sessions?technicianId=tech-9'));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('ROW_OUT_OF_SCOPE');
  });

  it('lets a supervisor look at their own crew', async () => {
    state.claims = SUPERVISOR;
    state.tables.users = [
      { id: 'tech-1', tenant_id: 't1', team_id: 'crew-a', manager_id: null },
      { id: 'tech-2', tenant_id: 't1', team_id: 'crew-a', manager_id: 'tech-1' },
      { id: 'tech-9', tenant_id: 't1', team_id: 'crew-z', manager_id: 'sup-9' },
    ];
    const ok = await (await handler())(call('/sessions?technicianId=tech-2'));
    expect(ok.status).toBe(200);
    const denied = await (await handler())(call('/sessions?technicianId=tech-9'));
    expect(denied.status).toBe(403);
  });

  it('403s rather than quietly substituting the caller', async () => {
    // Returning the caller's own rows for somebody else's id is how a UI comes to
    // show the wrong person's work while looking like it worked.
    const res = await (await handler())(call('/sessions?technicianId=tech-9'));
    expect(res.status).not.toBe(200);
  });

  it('applies the same rule to the sync queue', async () => {
    const res = await (await handler())(call('/sync?technicianId=tech-9'));
    expect(res.status).toBe(403);
  });

  it('returns the caller own assigned tickets from sync', async () => {
    const res = await (await handler())(call('/sync'));
    expect(res.status).toBe(200);
    const body = await res.json();
    // { syncedAt, technician, data: { serviceTickets, ... }, counts } - the shape
    // the picker reads, pinned because reading the wrong key renders an empty
    // queue forever and says nothing.
    expect(body.data.serviceTickets.map((t: { id: string }) => t.id)).toEqual(['tk-1']);
  });
});

describe('WF-V-02: a session belongs to the caller', () => {
  it('stamps the technician from the JWT, whatever the body says', async () => {
    await (
      await handler()
    )(call('/sessions', 'POST', { serviceTicketId: 'tk-1', technicianId: 'tech-9' }));
    const row = state.inserts.find((i) => i.table === 'mobile_service_sessions')!.row;
    expect(row.technician_id).toBe('tech-1');
  });
});

describe('WF-V-02: the page points at a real ticket', () => {
  const page = readFileSync('client/src/pages/MobileFieldService.tsx', 'utf8');
  const code = page
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith('//') && !t.startsWith('/*') && !t.startsWith('*');
    })
    .join('\n');

  it('has no mock ids left', () => {
    expect(code).not.toMatch(/'ticket-123'/);
    expect(code).not.toMatch(/'tech-456'/);
  });

  it('takes the ticket from the route', () => {
    expect(code).toMatch(/useRoute\('\/mobile-field-service\/:ticketId'\)/);
    expect(code).toMatch(/const serviceTicketId = params\?\.ticketId \?\? null/);
  });

  it('sends no technician id at all', () => {
    // The mobile function takes it from the JWT; sending one was the hole above.
    expect(code).not.toMatch(/technicianId,/);
  });

  it('offers the caller own queue when the route carries no ticket', () => {
    expect(code).toMatch(/if \(!serviceTicketId\) \{\s*return <TicketPicker \/>;/);
    expect(code).toMatch(/queryKey: \['\/api\/mobile\/sync'\]/);
    // And reads the key the endpoint actually sends.
    expect(code).toMatch(/data\?\.data\?\.serviceTickets/);
  });

  it('waits for a ticket before querying its sessions and photos', () => {
    expect([...code.matchAll(/enabled: Boolean\(serviceTicketId\)/g)]).toHaveLength(2);
  });

  it('is routed with the id and gated the same as the bare path', () => {
    const app = readFileSync('client/src/App.tsx', 'utf8');
    expect(app).toMatch(
      /path="\/mobile-field-service\/:ticketId" component=\{MobileFieldService\}/,
    );
    const nav = readFileSync('client/src/lib/navigation-permissions.ts', 'utf8');
    expect(nav).toMatch(/'\/mobile-field-service\/:ticketId':/);
  });

  it('is reachable from the service hub', () => {
    const hub = readFileSync('client/src/pages/ServiceHub.tsx', 'utf8');
    expect(hub).toMatch(/setLocation\('\/mobile-field-service'\)/);
  });
});
