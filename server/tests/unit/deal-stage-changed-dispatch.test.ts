/**
 * WF-C-01: moving a deal must fire deal.stage_changed.
 *
 * The only dispatch for that event lived in the `stage_id` branch of
 * PATCH /api/deals/:id, and no client sends stage_id there. The Kanban board
 * (EnhancedPipelineBoard.tsx:431) and the deal page (DealDetail.tsx:274) both post
 * to POST /api/pipeline-config/deals/:id/move, which set the stage, wrote
 * deal_stage_history and recorded a pipeline_automation_logs row with
 * status='skipped' that nothing read. So reaching Closed Won fired nothing, on
 * either host, for every user - the workflow runtime was live and its most
 * important trigger was never pulled.
 *
 * The handler is driven for real against a fake PostgREST client with genuine
 * state; the dispatcher is a spy, because what is being asserted is that the call
 * happens at all and with the right stage on it.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

interface Row {
  [key: string]: unknown;
}

const dispatched: Array<{
  tenantId: string;
  eventName: string;
  payload: Record<string, unknown>;
  opts: Record<string, unknown>;
}> = [];

const state: { tables: Record<string, Row[]> } = { tables: {} };

function tableApi(name: string) {
  const filters: Array<[string, unknown]> = [];
  let mode: 'select' | 'insert' | 'update' = 'select';
  let pending: Row[] = [];
  let patch: Row = {};

  const api: Record<string, unknown> = {
    select: () => api,
    order: () => api,
    limit: () => api,
    eq(col: string, val: unknown) {
      filters.push([col, val]);
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
      const stored = pending.map((r, i) => ({
        id: `${name}-${state.tables[name].length + i + 1}`,
        ...r,
      }));
      state.tables[name].push(...stored);
      return { data: single ? stored[0] : stored, error: null };
    }
    const hits = state.tables[name].filter((r) =>
      filters.every(([c, v]) => String(r[c]) === String(v)),
    );
    if (mode === 'update') {
      for (const row of hits) Object.assign(row, patch);
      return single
        ? { data: hits[0] ?? null, error: hits[0] ? null : { message: 'not found' } }
        : { data: hits, error: null };
    }
    // Copies, like PostgREST: a handler that reads a row it fetched earlier must
    // not see a later update through the same object. The fake returned shared
    // references at first and that alone made this suite report a wrong
    // fromStageId, which is a defect in the test, not in the handler.
    return single
      ? { data: hits[0] ? { ...hits[0] } : null, error: null }
      : { data: hits.map((r) => ({ ...r })), error: null };
  }

  return api;
}

vi.mock('../../../supabase/functions/_shared/db.ts', () => ({
  getDb: () => ({ from: (t: string) => tableApi(t), rpc: async () => ({ data: {}, error: null }) }),
  getUserDb: () => ({ from: (t: string) => tableApi(t) }),
}));

vi.mock('../../../supabase/functions/_shared/auth.ts', () => ({
  AuthError: class AuthError extends Error {},
  requireAuth: async () => ({ tenantId: 'tenant-1', userId: 'user-1' }),
}));

vi.mock('../../../supabase/functions/_shared/workflow-dispatch.ts', () => ({
  dispatchWorkflowEventSafe: async (
    _db: unknown,
    tenantId: string,
    eventName: string,
    payload: Record<string, unknown>,
    opts: Record<string, unknown>,
  ) => {
    dispatched.push({ tenantId, eventName, payload, opts });
    return [];
  },
}));

(globalThis as { Deno?: unknown }).Deno = { env: { get: () => undefined } };

function moveRequest(dealId: string, toStageId: string) {
  return new Request(`https://functions.printyx.net/deals/${dealId}/move`, {
    method: 'POST',
    headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
    body: JSON.stringify({ toStageId }),
  });
}

function seed() {
  state.tables = {
    deal_stages: [
      {
        id: 'legacy-open',
        tenant_id: 'tenant-1',
        name: 'Discovery',
        is_active: true,
        sort_order: 1,
      },
      {
        id: 'legacy-won',
        tenant_id: 'tenant-1',
        name: 'Closed Won',
        is_active: true,
        sort_order: 9,
        is_closing_stage: true,
        is_won_stage: true,
      },
    ],
    pipeline_templates: [
      { id: 'tpl-1', tenant_id: 'tenant-1', is_default: true, pipeline_type: 'sales' },
    ],
    pipeline_stages: [
      {
        id: 'canon-open',
        tenant_id: 'tenant-1',
        pipeline_template_id: 'tpl-1',
        legacy_stage_id: 'legacy-open',
        name: 'Discovery',
        is_active: true,
      },
      {
        id: 'canon-won',
        tenant_id: 'tenant-1',
        pipeline_template_id: 'tpl-1',
        legacy_stage_id: 'legacy-won',
        name: 'Closed Won',
        is_active: true,
        is_closed_won: true,
        is_final_stage: true,
        default_probability: 100,
      },
    ],
    deals: [
      {
        id: 'deal-1',
        tenant_id: 'tenant-1',
        stage_id: 'legacy-open',
        status: 'open',
        amount: '25000.00',
      },
    ],
    deal_stage_history: [],
    stage_transitions: [],
    pipeline_automation_logs: [],
  };
}

async function handler() {
  return (await import('../../../supabase/functions/pipeline-config/index.ts')).default;
}

describe('WF-C-01: the move endpoint the UI calls fires deal.stage_changed', () => {
  beforeEach(() => {
    dispatched.length = 0;
    seed();
  });

  it('dispatches with the stage the deal moved to', async () => {
    const res = await (await handler())(moveRequest('deal-1', 'legacy-won'));
    expect(res.status).toBe(200);

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0].eventName).toBe('deal.stage_changed');
    expect(dispatched[0].tenantId).toBe('tenant-1');
    expect(dispatched[0].payload).toMatchObject({
      dealId: 'deal-1',
      recordId: 'deal-1',
      // The board's legacy id and the canonical one, both named - COP-E02's two
      // vocabularies, so a consumer cannot pick the wrong one by accident.
      stageId: 'legacy-won',
      canonicalStageId: 'canon-won',
      fromStageId: 'legacy-open',
      isClosedWon: true,
      isClosedLost: false,
    });
  });

  it('uses the same dedupe key shape as the deals function, so one move enrols once', async () => {
    await (
      await handler()
    )(moveRequest('deal-1', 'legacy-won'));
    expect(dispatched[0].opts).toMatchObject({
      dedupeKey: 'stage:deal-1:legacy-won',
      initiatedBy: 'user-1',
    });
  });

  it('still moves the deal and records history', async () => {
    await (
      await handler()
    )(moveRequest('deal-1', 'legacy-won'));

    const deal = state.tables['deals'][0];
    expect(deal.stage_id).toBe('legacy-won');
    expect(deal.status).toBe('won');
    expect(deal.probability).toBe(100);
    expect(state.tables['deal_stage_history']).toHaveLength(1);
  });

  it('writes no pipeline_automation_logs row — the only reader selects status=pending', async () => {
    await (
      await handler()
    )(moveRequest('deal-1', 'legacy-won'));
    expect(state.tables['pipeline_automation_logs']).toHaveLength(0);
  });

  it('does not dispatch when the move fails', async () => {
    const res = await (await handler())(moveRequest('deal-missing', 'legacy-won'));
    expect(res.status).toBe(404);
    expect(dispatched).toHaveLength(0);
  });
});
