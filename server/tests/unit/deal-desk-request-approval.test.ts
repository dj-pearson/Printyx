/**
 * WF-C-03: the way out of the pricing guardrail.
 *
 * QuoteBuilder's send gate told a rep to "save as draft and request manager
 * approval" and there was nowhere to do it: DealDeskDashboard lists requests and
 * posts decisions, and NOTHING in client/src ever created one. A rep who hit the
 * 409 had a toast and no next step.
 *
 * The chain-building half is driven against a fake PostgREST, because the
 * interesting question is what lands in approval_chain - the decision handler
 * treats its LENGTH as the number of approval steps, so a wrong chain makes the
 * first decision final.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';

type Row = Record<string, unknown>;
const state: { tables: Record<string, Row[]>; inserts: { table: string; row: Row }[] } = {
  tables: {},
  inserts: [],
};

function tableApi(name: string) {
  const eqs: Array<[string, unknown]> = [];
  let mode: 'select' | 'insert' = 'select';
  let pending: Row[] = [];

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
    single: () => Promise.resolve(run(true)),
    maybeSingle: () => Promise.resolve(run(true)),
    then: (resolve: (v: unknown) => void) => Promise.resolve(run(false)).then(resolve),
  };

  function run(single: boolean) {
    state.tables[name] ??= [];
    if (mode === 'insert') {
      for (const r of pending) state.inserts.push({ table: name, row: r });
      const stored = pending.map((r, i) => ({ id: `${name}-${i + 1}`, ...r }));
      return { data: single ? { ...stored[0] } : stored, error: null };
    }
    const hits = state.tables[name].filter((r) =>
      eqs.every(([c, v]) => String(r[c]) === String(v)),
    );
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
        data: { user: { id: 'rep-1', app_metadata: { tenant_id: 't1', roleLevel: 1 } } },
        error: null,
      }),
    },
  }),
  createSupabaseServiceClient: () => ({ from: (t: string) => tableApi(t) }),
}));

(globalThis as { Deno?: unknown }).Deno = { env: { get: () => undefined } };

async function handler() {
  return (await import('../../../supabase/functions/deal-desk/index.ts')).default;
}

function post(path: string, body: unknown) {
  return new Request(`https://functions.printyx.net${path}`, {
    method: 'POST',
    headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const rule = (over: Record<string, unknown>) => ({
  id: 'r1',
  tenant_id: 't1',
  rule_name: 'Discount over 15%',
  is_active: true,
  rule_type: 'discount',
  threshold_type: 'discount_percentage',
  threshold_value: 15,
  comparison_operator: '>',
  approvers: ['mgr-1'],
  sla_hours: 24,
  priority: 10,
  order: 1,
  ...over,
});

beforeEach(() => {
  state.inserts = [];
  state.tables = {
    users: [{ id: 'rep-1', tenant_id: 't1', first_name: 'Rae', last_name: 'Poe', role_id: 'ro-1' }],
    roles: [{ id: 'ro-1', name: 'Sales Representative' }],
    approval_rules: [],
  };
});

const created = () => state.inserts.find((i) => i.table === 'approval_requests')!.row;

describe('WF-C-03: the request the quote builder creates', () => {
  it('records the proposal on the request, so WF-C-04 can read it back', async () => {
    const res = await (
      await handler()
    )(post('/requests', { quoteId: 'prop-9', discountPercentage: 22, proposedMargin: 8 }));
    expect(res.status).toBe(201);
    // approval_requests.quote_id is the existing column for this; there is no
    // related_proposal_id and none is needed.
    expect(created().quote_id).toBe('prop-9');
  });

  it('records both margins, which nothing wrote before', async () => {
    await (
      await handler()
    )(post('/requests', { quoteId: 'p1', proposedMargin: 8.4, originalMargin: 15 }));
    // A discount request with no margin on it hides the number the policy is about.
    expect(created().proposed_margin).toBe(8.4);
    expect(created().original_margin).toBe(15);
  });

  it('builds the chain from the rules that actually match', async () => {
    state.tables.approval_rules = [
      rule({}),
      rule({
        id: 'r2',
        rule_name: 'Margin under 10%',
        threshold_type: 'margin_below',
        threshold_value: 10,
        comparison_operator: '<',
        approvers: ['dir-1'],
        sla_hours: 8,
        priority: 5,
      }),
      rule({
        id: 'r3',
        rule_name: 'Discount over 40%',
        threshold_value: 40,
        approvers: ['vp-1'],
        priority: 1,
      }),
    ];
    await (
      await handler()
    )(post('/requests', { quoteId: 'p1', discountPercentage: 22, proposedMargin: 8 }));
    const chain = created().approval_chain as Record<string, unknown>[];
    // 22% is over 15 but not over 40; margin 8 is under 10. Two steps, in the
    // priority order the rules list uses.
    expect(chain.map((c) => c.ruleId)).toEqual(['r1', 'r2']);
    expect(chain.map((c) => c.level)).toEqual([1, 2]);
    expect(chain[0].approvers).toEqual(['mgr-1']);
  });

  it('leaves the chain empty when no rule matches, rather than inventing a step', async () => {
    state.tables.approval_rules = [rule({})];
    await (
      await handler()
    )(post('/requests', { quoteId: 'p1', discountPercentage: 5 }));
    expect(created().approval_chain).toEqual([]);
  });

  it('ignores an inactive rule', async () => {
    state.tables.approval_rules = [rule({ is_active: false })];
    await (
      await handler()
    )(post('/requests', { quoteId: 'p1', discountPercentage: 50 }));
    expect(created().approval_chain).toEqual([]);
  });

  it('keeps a step for a matched rule with no approvers', async () => {
    // The rule matched, so somebody has to look at it. Dropping the step would
    // shorten the chain and make an earlier decision final.
    state.tables.approval_rules = [rule({ approvers: [] })];
    await (
      await handler()
    )(post('/requests', { quoteId: 'p1', discountPercentage: 50 }));
    const chain = created().approval_chain as Record<string, unknown>[];
    expect(chain).toHaveLength(1);
    expect(chain[0].approvers).toEqual([]);
  });

  it('takes the SLA from the tightest matched rule', async () => {
    state.tables.approval_rules = [
      rule({ sla_hours: 48 }),
      rule({ id: 'r2', threshold_value: 20, sla_hours: 4, priority: 5 }),
    ];
    const before = Date.now();
    await (
      await handler()
    )(post('/requests', { quoteId: 'p1', discountPercentage: 50 }));
    const deadline = new Date(created().sla_deadline as string).getTime();
    // A request that must clear two rules is due when the SOONER of them says.
    expect(deadline - before).toBeLessThan(5 * 3600_000);
    expect(deadline - before).toBeGreaterThan(3 * 3600_000);
  });

  it('does not take an approval chain from the caller', async () => {
    // A client-supplied chain is a client-supplied answer to who may approve
    // this, and the decision handler reads its length as the step count.
    state.tables.approval_rules = [rule({})];
    await (
      await handler()
    )(post('/requests', { quoteId: 'p1', discountPercentage: 50, approvalChain: [] }));
    const chain = created().approval_chain as unknown[];
    expect(chain).toHaveLength(1);
  });

  it('starts pending at level 1', async () => {
    await (
      await handler()
    )(post('/requests', { quoteId: 'p1' }));
    expect(created().status).toBe('pending');
    expect(created().current_approval_level).toBe(1);
    expect(created().requested_by).toBe('rep-1');
  });
});

describe('WF-C-03: the quote builder asks for one', () => {
  const code = readFileSync('client/src/components/quote-builder/QuoteBuilder.tsx', 'utf8')
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith('//') && !t.startsWith('/*') && !t.startsWith('*');
    })
    .join('\n');

  it('POSTs to /api/deal-desk/requests, which nothing in client/src did', () => {
    expect(code).toMatch(/apiRequest\('\/api\/deal-desk\/requests', 'POST'/);
  });

  it('saves the quote first, because a request has to name a proposal', () => {
    expect(code).toMatch(/saveQuoteMutation\.mutateAsync[\s\S]{0,200}?proposalId/);
  });

  it('sends the numbers the guardrail blocked on', () => {
    expect(code).toMatch(/discountPercentage: effectiveDiscount/);
    expect(code).toMatch(/proposedMargin: overallMargin/);
    expect(code).toMatch(/quoteId: proposalId/);
  });

  it('sends no approval chain', () => {
    expect(code).not.toMatch(/approvalChain:/);
  });

  it('refreshes the dashboard so a reviewer sees it without reloading', () => {
    expect(code).toMatch(/queryKey: \['\/api\/deal-desk\/requests'\]/);
  });

  it('offers the button only to the rep the guardrail blocks', () => {
    // A manager can send anyway, so a Request approval button would be noise.
    expect(code).toMatch(/!isManager && \(\s*<Button/);
    expect(code).toMatch(/Request approval/);
  });
});
