/**
 * WF-C-09: the contract records the sale that produced it.
 *
 * contracts carried a customer, a number, rates and a status and nothing about
 * the deal or the proposal; deals carried no contract either. The spine from deal
 * to installed unit broke at its first link, which is also the question WF-P-04's
 * Needs Ordering queue has to ask.
 *
 * The second half of this story is what createContractFromProposal STOPPED
 * writing. It set start_date to today and end_date to today plus 36 months - a
 * term nobody had agreed to. contracts.tsx drives its "expiring soon" badge off
 * end_date and supabase/functions/contract-renewal builds its whole queue by
 * filtering on it, so every accepted proposal manufactured a renewal three years
 * out. Both columns are nullable now and neither is set at creation; acceptance
 * sets the term (WF-L-08).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';

interface Row {
  [key: string]: unknown;
}
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
      return { data: single ? { ...stored[0] } : stored.map((r) => ({ ...r })), error: null };
    }
    const hits = state.tables[name].filter((r) =>
      filters.every(([c, v]) => String(r[c]) === String(v)),
    );
    if (mode === 'update') {
      for (const row of hits) Object.assign(row, patch);
      return { data: hits[0] ? { ...hits[0] } : null, error: null };
    }
    return single
      ? { data: hits[0] ? { ...hits[0] } : null, error: null }
      : { data: hits.map((r) => ({ ...r })), error: null, count: hits.length };
  }

  return api;
}

vi.mock('../../../supabase/functions/_shared/db.ts', () => ({
  getDb: () => ({ from: (t: string) => tableApi(t) }),
  getUserDb: () => ({ from: (t: string) => tableApi(t) }),
}));

vi.mock('../../../supabase/functions/_shared/auth.ts', () => ({
  AuthError: class AuthError extends Error {},
  requireAuth: async () => ({ tenantId: 'tenant-1', userId: 'user-1' }),
}));

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

describe('WF-C-09: the deal detail carries its contract', () => {
  beforeEach(() => {
    state.tables = {
      deals: [
        {
          id: 'deal-1',
          tenant_id: 'tenant-1',
          title: 'Fleet refresh',
          stage_id: 'stage-1',
          contract_id: 'contract-1',
        },
        // The back-link was never written on this one - a back-fill can leave one
        // side behind, and a detail page that shows nothing because only one
        // direction was populated is the kind of gap nobody reports.
        { id: 'deal-2', tenant_id: 'tenant-1', title: 'Second', stage_id: 'stage-1' },
        { id: 'deal-3', tenant_id: 'tenant-1', title: 'Open deal', stage_id: 'stage-1' },
      ],
      contracts: [
        {
          id: 'contract-1',
          tenant_id: 'tenant-1',
          contract_number: 'CON-0001',
          status: 'active',
          deal_id: 'deal-1',
          start_date: null,
          end_date: null,
          acquisition_type: null,
        },
        {
          id: 'contract-2',
          tenant_id: 'tenant-1',
          contract_number: 'CON-0002',
          status: 'active',
          deal_id: 'deal-2',
          start_date: null,
          end_date: null,
          acquisition_type: null,
        },
      ],
      deal_stages: [],
      pipeline_stages: [],
    };
  });

  async function getDeal(id: string) {
    const handler = (await import('../../../supabase/functions/deals/index.ts')).default;
    const res = await handler(
      new Request(`https://functions.printyx.net/${id}`, {
        headers: { Authorization: 'Bearer t' },
      }),
    );
    return { res, body: await res.json() };
  }

  it('returns the contract via the deal back-link', async () => {
    const { res, body } = await getDeal('deal-1');
    expect(res.status).toBe(200);
    expect(body.contract).toMatchObject({ id: 'contract-1', contract_number: 'CON-0001' });
  });

  it('falls back to contracts.deal_id when the back-link was never written', async () => {
    const { body } = await getDeal('deal-2');
    expect(body.contract).toMatchObject({ id: 'contract-2' });
  });

  it('returns null on a deal with no contract, which is most of them', async () => {
    const { res, body } = await getDeal('deal-3');
    expect(res.status).toBe(200);
    expect(body.contract).toBeNull();
  });
});

describe('WF-C-09: creating a contract from an accepted proposal', () => {
  it('records the proposal and the deal, and invents no term', () => {
    // Source-level, because what matters is which columns the insert names. The
    // file is comment-stripped: it explains the removed 36-month default in prose,
    // and an absence assertion that matches its own explanation reports the
    // explanation as the defect.
    const src = readFileSync('supabase/functions/proposals/index.ts', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

    const fn = src.slice(
      src.indexOf('async function createContractFromProposal'),
      src.indexOf('const PROPOSAL_FIELD_MAP'),
    );
    expect(fn.length).toBeGreaterThan(0);

    expect(fn).toMatch(/deal_id:/);
    expect(fn).toMatch(/proposal_id:/);
    // The term is set on acceptance (WF-L-08), not here.
    expect(fn).not.toMatch(/start_date:/);
    expect(fn).not.toMatch(/end_date:/);
    expect(fn).not.toMatch(/setMonth/);
    // And the back-link is written, so the join works from either end.
    expect(fn).toMatch(/contract_id: contractId/);
  });
});
