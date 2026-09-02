/**
 * WF-C-04: an approved exception has to unblock the rep who asked for it.
 *
 * Three things were wrong at once. Approving a deal-desk request only moved
 * approval_requests.status, so an approved rep was still blocked. The send
 * guardrail's bypass was `body.approved`, which QuoteBuilder set from THE
 * SENDER'S OWN isManager flag - the check asked the caller whether the caller was
 * allowed, so anyone able to post JSON could send any quote. And the "is this a
 * rep" test matched role names ending in 'sales_rep', so an ACCOUNT_EXECUTIVE
 * skipped the guardrail entirely.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import {
  hasPricingApproval,
  needsPricingApproval,
  pricingGateApplies,
} from '../../../supabase/functions/proposals/_send-gate';

type Row = Record<string, unknown>;
const state: {
  tables: Record<string, Row[]>;
  updates: { table: string; patch: Row }[];
  claims: Row;
} = { tables: {}, updates: [], claims: {} };

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
      const stored = pending.map((r, i) => ({ id: `${name}-${i + 1}`, ...r }));
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
        data: { user: { id: 'caller', app_metadata: state.claims } },
        error: null,
      }),
    },
  }),
  createSupabaseServiceClient: () => ({ from: (t: string) => tableApi(t) }),
}));

(globalThis as { Deno?: unknown }).Deno = { env: { get: () => undefined } };

const dealDesk = async () =>
  (await import('../../../supabase/functions/deal-desk/index.ts')).default;

function post(path: string, body: unknown) {
  return new Request(`https://functions.printyx.net${path}`, {
    method: 'POST',
    headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const MANAGER = { tenant_id: 't1', tenantId: 't1', roleLevel: 4, role: 'SALES_MANAGER' };
const REP = { tenant_id: 't1', tenantId: 't1', roleLevel: 1, role: 'SALES_REP' };
/** Level 3, and a name the old string match did NOT catch. */
const ACCOUNT_EXEC = { tenant_id: 't1', tenantId: 't1', roleLevel: 3, role: 'ACCOUNT_EXECUTIVE' };

beforeEach(() => {
  state.claims = MANAGER;
  state.updates = [];
  state.tables = {
    users: [{ id: 'caller', tenant_id: 't1', first_name: 'M', last_name: 'Gr', role_id: 'ro-1' }],
    roles: [{ id: 'ro-1', name: 'Sales Manager' }],
    approval_requests: [
      {
        id: 'req-1',
        tenant_id: 't1',
        quote_id: 'prop-1',
        status: 'pending',
        current_approval_level: 1,
        approval_chain: [],
      },
    ],
    proposals: [
      {
        id: 'prop-1',
        tenant_id: 't1',
        subtotal: 1000,
        discount_amount: 0,
        total_dealer_cost: 950,
        pricing_approval_id: null,
      },
    ],
  };
});

const proposal = () => state.tables.proposals[0];

describe('WF-C-04: the deal-desk decision stamps the proposal', () => {
  it('stamps it on a final approve', async () => {
    const res = await (await dealDesk())(post('/requests/req-1/decision', { decision: 'approve' }));
    expect(res.status).toBe(200);
    expect(proposal().pricing_approval_id).toBe('req-1');
    expect(proposal().pricing_approved_at).toBeTruthy();
  });

  it('does not stamp when a step remains', async () => {
    // A two-step chain approved once is in_review, not approved.
    state.tables.approval_requests[0].approval_chain = [{ level: 1 }, { level: 2 }];
    await (
      await dealDesk()
    )(post('/requests/req-1/decision', { decision: 'approve' }));
    expect(proposal().pricing_approval_id).toBeNull();
  });

  it('clears the stamp on a reject', async () => {
    proposal().pricing_approval_id = 'req-1';
    await (
      await dealDesk()
    )(post('/requests/req-1/decision', { decision: 'reject' }));
    expect(proposal().pricing_approval_id).toBeNull();
  });

  it('clears the stamp when changes are requested', async () => {
    // An exception sent back is an exception that no longer holds.
    proposal().pricing_approval_id = 'req-1';
    await (
      await dealDesk()
    )(post('/requests/req-1/decision', { decision: 'request_changes' }));
    expect(proposal().pricing_approval_id).toBeNull();
  });

  it('does nothing to a request that names no quote', async () => {
    state.tables.approval_requests[0].quote_id = null;
    await (
      await dealDesk()
    )(post('/requests/req-1/decision', { decision: 'approve' }));
    expect(state.updates.some((u) => u.table === 'proposals')).toBe(false);
  });
});

describe('WF-C-04: the guardrail reads the stamp, not the caller', () => {
  const src = readFileSync('supabase/functions/proposals/index.ts', 'utf8');
  const code = src
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith('//') && !t.startsWith('/*') && !t.startsWith('*');
    })
    .join('\n');

  it('no longer lets body.approved bypass anything', () => {
    // The bypass asked the caller whether the caller was allowed.
    expect(code).not.toMatch(/body\.approved/);
  });

  it('selects the stamp and gates on it', () => {
    expect(code).toMatch(/pricing_approval_id/);
    expect(code).toMatch(/if \(cur && !hasPricingApproval\(cur\)\)/);
  });

  it('gets its who-needs-approval answer from the pure module', () => {
    expect(code).toMatch(/needsPricingApproval\(\(ctx as any\)\?\.supabaseUser\)/);
    expect(code).toMatch(/from '\.\/_send-gate\.ts'/);
  });
});

describe('WF-C-04: the quote builder stops granting itself a bypass', () => {
  const code = readFileSync('client/src/components/quote-builder/QuoteBuilder.tsx', 'utf8')
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith('//') && !t.startsWith('/*') && !t.startsWith('*');
    })
    .join('\n');

  it('sends no approved flag', () => {
    expect(code).not.toMatch(/approved: isManager/);
    expect(code).not.toMatch(/approved: true/);
  });
});

describe('WF-C-04: one approval model remains', () => {
  it('retires the price-change approvals page', () => {
    // price_change_approvals is read in two places and written NOWHERE - not a
    // competing model, a permanently empty queue. Its widget and badge were
    // already orphans.
    for (const f of [
      'client/src/pages/PriceApprovals.tsx',
      'client/src/components/pricing/PricingNotificationBadge.tsx',
      'client/src/components/dashboards/PricingDashboardWidgets.tsx',
    ]) {
      expect(() => readFileSync(f, 'utf8'), f).toThrow();
    }
  });

  it('redirects the old path rather than 404ing it', () => {
    const app = readFileSync('client/src/App.tsx', 'utf8');
    expect(app).toMatch(/path="\/pricing\/approvals">\{\(\) => <LegacyRedirect to="\/deal-desk"/);
  });

  it('keeps a gate on the retired path', () => {
    // A redirect target reachable on looser terms than the path forwarding to it
    // is the AUDIT-019 mistake.
    expect(readFileSync('client/src/lib/navigation-permissions.ts', 'utf8')).toMatch(
      /'\/pricing\/approvals':\s*\{[\s\S]{0,140}?minLevel: 3/,
    );
  });

  it('leaves nothing writing price_change_approvals', () => {
    const pricing = readFileSync('supabase/functions/pricing/index.ts', 'utf8');
    expect(pricing).not.toMatch(/from\('price_change_approvals'\)[\s\S]{0,60}?\.insert\(/);
  });
});

describe('WF-C-04: who the gate applies to, and when it lifts (AC2, AC3)', () => {
  // index.ts imports zod and pdf-lib from esm.sh, which vitest cannot load - the
  // reason a dozen siblings in this tree split their logic into a pure module.
  // The DECISION is the security-relevant part, so it lives in _send-gate.ts and
  // is driven here rather than read.
  it('applies to a rep and not to a manager (AC2 regression)', () => {
    expect(needsPricingApproval({ app_metadata: REP })).toBe(true);
    expect(needsPricingApproval({ app_metadata: MANAGER })).toBe(false);
  });

  it('now applies to an ACCOUNT_EXECUTIVE, which the name match missed', () => {
    // 'account_executive'.endsWith('sales_rep') is false, so this individual
    // contributor skipped the guardrail entirely before WF-C-04.
    expect(needsPricingApproval({ app_metadata: ACCOUNT_EXEC })).toBe(true);
  });

  it('falls back to the role string for a token with no level claim', () => {
    expect(needsPricingApproval({ app_metadata: { role: 'SALES_REP' } })).toBe(true);
    expect(needsPricingApproval({ app_metadata: { role: 'SENIOR_SALES_REP' } })).toBe(true);
    expect(needsPricingApproval({ app_metadata: { role: 'SALES_MANAGER' } })).toBe(false);
    expect(needsPricingApproval(null)).toBe(false);
  });

  it('lifts for a stamped proposal and not for an unstamped one (AC3)', () => {
    expect(pricingGateApplies({ app_metadata: REP }, { pricing_approval_id: null })).toBe(true);
    expect(pricingGateApplies({ app_metadata: REP }, { pricing_approval_id: 'req-1' })).toBe(false);
  });

  it('treats an empty stamp as no stamp', () => {
    // '' is what a cleared column reads as if something writes one.
    expect(hasPricingApproval({ pricing_approval_id: '' })).toBe(false);
    expect(hasPricingApproval({})).toBe(false);
    expect(hasPricingApproval(null)).toBe(false);
  });

  it('is the full round trip: approve through the deal desk, then the gate lifts', async () => {
    state.claims = MANAGER;
    await (
      await dealDesk()
    )(post('/requests/req-1/decision', { decision: 'approve' }));
    expect(pricingGateApplies({ app_metadata: REP }, proposal())).toBe(false);
  });

  it('and a rejection puts it back', async () => {
    state.claims = MANAGER;
    await (
      await dealDesk()
    )(post('/requests/req-1/decision', { decision: 'approve' }));
    await (
      await dealDesk()
    )(post('/requests/req-1/decision', { decision: 'reject' }));
    expect(pricingGateApplies({ app_metadata: REP }, proposal())).toBe(true);
  });
});
