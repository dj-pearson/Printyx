/**
 * WF-P-03: a purchase order knows what it is for.
 *
 * contracts.tsx has had a Book Order item since it was written, navigating to
 * /purchase-orders?contractId=<id>. purchase_orders had a vendor and a status and
 * no column for a contract, a deal or a customer, so PurchaseOrders.tsx rendered
 * that id as a blue hint above the create form and dropped it. The link between a
 * signed contract and the equipment ordered to fulfil it existed only in the URL
 * bar, which is why no screen could answer "has this contract been ordered yet".
 *
 * Migration 0068 adds source_contract_id, source_deal_id and customer_id, all
 * nullable - a stock-replenishment PO (what the low-stock suggestion path
 * creates) has none of them, and requiring any would break that path.
 *
 * These tests drive the real edge handler against a fake Supabase client with
 * genuine state, because the failure mode is a value that goes missing between
 * the request and the row, and only looking at the stored row catches that.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

interface Row {
  [key: string]: unknown;
}
const state: { tables: Record<string, Row[]>; lastFilters: Array<[string, unknown]> } = {
  tables: {},
  lastFilters: [],
};

function tableApi(name: string) {
  const filters: Array<[string, unknown]> = [];
  let pending: Row[] | null = null;
  let mode: 'select' | 'insert' | 'update' | 'delete' = 'select';

  const api: Record<string, unknown> = {
    select() {
      return api;
    },
    order() {
      return api;
    },
    limit() {
      return api;
    },
    range() {
      return api;
    },
    or() {
      return api;
    },
    in() {
      return api;
    },
    gte() {
      return api;
    },
    lte() {
      return api;
    },
    eq(col: string, val: unknown) {
      filters.push([col, val]);
      return api;
    },
    insert(rows: Row | Row[]) {
      mode = 'insert';
      pending = Array.isArray(rows) ? rows : [rows];
      return api;
    },
    delete() {
      mode = 'delete';
      return api;
    },
    single() {
      return Promise.resolve(run(true));
    },
    then(resolve: (v: unknown) => void) {
      return Promise.resolve(run(false)).then(resolve);
    },
  };

  function run(single: boolean) {
    state.tables[name] ??= [];
    if (name === 'purchase_orders') state.lastFilters = [...filters];
    if (mode === 'insert') {
      const stored = pending!.map((r) => ({
        id: `${name}-${state.tables[name].length + 1}`,
        ...r,
      }));
      state.tables[name].push(...stored);
      return { data: single ? stored[0] : stored, error: null };
    }
    const hits = state.tables[name].filter((r) =>
      filters.every(([c, v]) => String(r[c]) === String(v)),
    );
    if (mode === 'delete') return { data: null, error: null };
    return single
      ? { data: hits[0] ?? null, error: hits[0] ? null : { message: 'not found' } }
      : { data: hits, error: null, count: hits.length };
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

const baseBody = {
  poNumber: 'PO-2001',
  vendorId: 'vendor-1',
  requestedBy: 'user-1',
  orderDate: '2026-09-02T00:00:00.000Z',
  items: [{ itemDescription: 'MFP', quantity: 1, unitPrice: 5000, totalPrice: 5000 }],
};

function post(body: unknown) {
  return new Request('https://functions.printyx.net/', {
    method: 'POST',
    headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function handler() {
  return (await import('../../../supabase/functions/purchase-orders/index.ts')).default;
}

describe('WF-P-03: the order records the sale that caused it', () => {
  beforeEach(() => {
    state.tables = {};
    state.lastFilters = [];
  });

  it('saves contractId under source_contract_id — the name the Book Order link uses', async () => {
    const res = await (await handler())(post({ ...baseBody, contractId: 'contract-9' }));
    expect(res.status).toBe(201);

    const po = state.tables['purchase_orders'][0];
    expect(po.source_contract_id).toBe('contract-9');
  });

  it('also accepts the column names directly', async () => {
    await (
      await handler()
    )(
      post({
        ...baseBody,
        sourceContractId: 'contract-1',
        sourceDealId: 'deal-1',
        customerId: 'customer-1',
      }),
    );

    expect(state.tables['purchase_orders'][0]).toMatchObject({
      source_contract_id: 'contract-1',
      source_deal_id: 'deal-1',
      customer_id: 'customer-1',
    });
  });

  it('leaves all three null for a stock order, which is the normal case', async () => {
    await (
      await handler()
    )(post(baseBody));

    const po = state.tables['purchase_orders'][0];
    expect(po.source_contract_id).toBeNull();
    expect(po.source_deal_id).toBeNull();
    expect(po.customer_id).toBeNull();
  });

  it('filters the list by ?contractId=', async () => {
    state.tables['purchase_orders'] = [
      { id: 'po-1', tenant_id: 'tenant-1', source_contract_id: 'contract-9' },
      { id: 'po-2', tenant_id: 'tenant-1', source_contract_id: 'contract-8' },
    ];

    const res = await (
      await handler()
    )(
      new Request('https://functions.printyx.net/?contractId=contract-9', {
        headers: { Authorization: 'Bearer t' },
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe('po-1');
    // Tenant scoping is not dropped by the new filter.
    expect(state.lastFilters).toContainEqual(['tenant_id', 'tenant-1']);
    expect(state.lastFilters).toContainEqual(['source_contract_id', 'contract-9']);
  });

  it('accepts the snake_case spelling of the filter too', async () => {
    state.tables['purchase_orders'] = [
      { id: 'po-1', tenant_id: 'tenant-1', source_deal_id: 'deal-3' },
    ];
    await (
      await handler()
    )(
      new Request('https://functions.printyx.net/?source_deal_id=deal-3', {
        headers: { Authorization: 'Bearer t' },
      }),
    );
    expect(state.lastFilters).toContainEqual(['source_deal_id', 'deal-3']);
  });
});
