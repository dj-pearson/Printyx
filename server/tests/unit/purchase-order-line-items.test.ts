/**
 * WF-P-01: a purchase order keeps the lines the buyer entered.
 *
 * Two independent defects made every line vanish at 201.
 *
 * THE KEY MISMATCH: client/src/pages/PurchaseOrders.tsx posts
 * `items: [{ itemDescription, itemCode, quantity, unitPrice, totalPrice }]`, and
 * the create handler read `body.lineItems` and priced each line off
 * `item.unitCost`. So the array was never seen, and the subtotal derived from it
 * was 0 - which the handler then wrote onto the purchase order as fact.
 *
 * THE PHANTOM TABLE: nineteen references named `purchase_order_line_items`, a
 * relation in no schema and no migration, with a column vocabulary
 * (quantity_ordered / unit_cost / total_cost / quantity_received) belonging to no
 * table here either. The real relation is `purchase_order_items` - 0000 created
 * it, 0001 reshaped it - whose columns are quantity / unit_price / total_price /
 * received_quantity.
 *
 * The handler test drives the real default export against a fake Supabase client
 * whose tables are Maps with genuine state, so "the line was saved" is asserted by
 * looking for it afterwards rather than by counting mock calls - and it asserts
 * the COLUMN NAMES on the stored row, because writing the right values under the
 * wrong keys is exactly what happened before.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  LINE_ITEM_TABLE,
  buildLineItemRow,
  buildLineItemPatch,
  lineItemsFromBody,
  lineItemsSubtotal,
} from '../../../supabase/functions/purchase-orders/_line-items.ts';

// ── The fake Supabase client ────────────────────────────────────────────────────
interface Row {
  [key: string]: unknown;
}
const state: { tables: Record<string, Row[]>; insertErrors: Record<string, unknown> } = {
  tables: {},
  insertErrors: {},
};

function matches(row: Row, filters: Array<[string, unknown]>) {
  return filters.every(([col, val]) => String(row[col]) === String(val));
}

function tableApi(name: string) {
  const filters: Array<[string, unknown]> = [];
  let pending: Row[] | null = null;
  let mode: 'select' | 'insert' | 'update' | 'delete' = 'select';
  let patch: Row = {};

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
    if (mode === 'insert') {
      const err = state.insertErrors[name];
      if (err) return { data: null, error: err };
      const stored = pending!.map((r) => ({
        id: `${name}-${state.tables[name].length + 1}`,
        ...r,
      }));
      state.tables[name].push(...stored);
      return { data: single ? stored[0] : stored, error: null };
    }
    const hits = state.tables[name].filter((r) => matches(r, filters));
    if (mode === 'delete') {
      state.tables[name] = state.tables[name].filter((r) => !matches(r, filters));
      return { data: null, error: null };
    }
    if (mode === 'update') {
      for (const row of hits) Object.assign(row, patch);
      return single
        ? { data: hits[0] ?? null, error: hits[0] ? null : { message: 'not found' } }
        : { data: hits, error: null };
    }
    return single
      ? { data: hits[0] ?? null, error: hits[0] ? null : { message: 'not found' } }
      : { data: hits, error: null };
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

// ── The row builder ─────────────────────────────────────────────────────────────
describe('WF-P-01: the line-item row builder speaks the real column names', () => {
  it('targets purchase_order_items, not the phantom purchase_order_line_items', () => {
    expect(LINE_ITEM_TABLE).toBe('purchase_order_items');
  });

  it('maps the shape the page actually posts onto real columns', () => {
    const row = buildLineItemRow(
      {
        itemDescription: 'Toner cartridge, black',
        itemCode: 'TN-514K',
        quantity: 3,
        unitPrice: 42.5,
        totalPrice: 127.5,
      },
      { tenantId: 'tenant-1', purchaseOrderId: 'po-1', lineNumber: 1, now: 'T' },
    );

    expect(row).toEqual({
      tenant_id: 'tenant-1',
      purchase_order_id: 'po-1',
      line_number: 1,
      inventory_item_id: null,
      item_description: 'Toner cartridge, black',
      item_code: 'TN-514K',
      part_number: null,
      manufacturer_part_number: null,
      quantity: 3,
      received_quantity: 0,
      unit_of_measure: 'EA',
      unit_price: 42.5,
      total_price: 127.5,
      notes: null,
      created_at: 'T',
    });
    // 0001 dropped updated_at from this table; writing it is a PGRST204.
    expect(row).not.toHaveProperty('updated_at');
  });

  it("still accepts the function's own historical vocabulary", () => {
    const row = buildLineItemRow(
      { description: 'Drum unit', quantityOrdered: 2, unitCost: 100, unitOfMeasure: 'BX' },
      { tenantId: 't', purchaseOrderId: 'p', lineNumber: 4 },
    );
    expect(row.quantity).toBe(2);
    expect(row.unit_price).toBe(100);
    expect(row.total_price).toBe(200);
    expect(row.unit_of_measure).toBe('BX');
  });

  it('derives the line total only when the caller did not send one', () => {
    const derived = buildLineItemRow(
      { description: 'x', quantity: 4, unitPrice: 10 },
      { tenantId: 't', purchaseOrderId: 'p', lineNumber: 1 },
    );
    expect(derived.total_price).toBe(40);

    // A negotiated total is what the vendor is asked to invoice, so it wins.
    const negotiated = buildLineItemRow(
      { description: 'x', quantity: 4, unitPrice: 10, totalPrice: 36 },
      { tenantId: 't', purchaseOrderId: 'p', lineNumber: 1 },
    );
    expect(negotiated.total_price).toBe(36);
  });

  it('rounds quantity, because the column is integer NOT NULL', () => {
    const row = buildLineItemRow(
      { description: 'x', quantity: 2.6 },
      { tenantId: 't', purchaseOrderId: 'p', lineNumber: 1 },
    );
    expect(row.quantity).toBe(3);
    expect(Number.isInteger(row.quantity)).toBe(true);
  });

  it('reads the lines from `items` (the page) as well as `lineItems`', () => {
    expect(lineItemsFromBody({ items: [{ a: 1 }] })).toHaveLength(1);
    expect(lineItemsFromBody({ lineItems: [{ a: 1 }, { b: 2 }] })).toHaveLength(2);
    expect(lineItemsFromBody({ line_items: [{ a: 1 }] })).toHaveLength(1);
    expect(lineItemsFromBody({})).toEqual([]);
  });

  it('subtotals over total_price', () => {
    expect(lineItemsSubtotal([{ total_price: 10 }, { total_price: '2.50' }])).toBe(12.5);
  });

  it('patches only the keys the caller sent', () => {
    expect(buildLineItemPatch({ quantity: 5 })).toEqual({ quantity: 5 });
    expect(buildLineItemPatch({ unitCost: 7 })).toEqual({ unit_price: 7 });
    expect(buildLineItemPatch({})).toEqual({});
    // A PATCH must not blank a description it said nothing about.
    expect(buildLineItemPatch({ notes: 'rush' })).not.toHaveProperty('item_description');
  });
});

// ── The handler ─────────────────────────────────────────────────────────────────
function post(body: unknown) {
  return new Request('https://functions.printyx.net/', {
    method: 'POST',
    headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const pageBody = {
  poNumber: 'PO-1001',
  vendorId: 'vendor-1',
  requestedBy: 'user-1',
  orderDate: '2026-09-02T00:00:00.000Z',
  subtotal: 0,
  taxAmount: 10,
  shippingAmount: 5,
  totalAmount: 0,
  status: 'draft',
  items: [
    {
      itemDescription: 'Toner cartridge, black',
      itemCode: 'TN-514K',
      quantity: 3,
      unitPrice: 42.5,
      totalPrice: 127.5,
    },
  ],
};

describe('WF-P-01: POST /purchase-orders round-trips its lines', () => {
  beforeEach(() => {
    state.tables = {};
    state.insertErrors = {};
  });

  it('saves the line the page posted, under the real column names', async () => {
    const handler = (await import('../../../supabase/functions/purchase-orders/index.ts')).default;
    const res = await handler(post(pageBody));

    expect(res.status).toBe(201);

    const lines = state.tables['purchase_order_items'] ?? [];
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      tenant_id: 'tenant-1',
      item_description: 'Toner cartridge, black',
      item_code: 'TN-514K',
      quantity: 3,
      unit_price: 42.5,
      total_price: 127.5,
      line_number: 1,
    });
    // Never written to the relation that does not exist.
    expect(state.tables['purchase_order_line_items']).toBeUndefined();
    // The line is attached to the purchase order that was actually created.
    const po = state.tables['purchase_orders'][0];
    expect(lines[0].purchase_order_id).toBe(po.id);
    expect(lines[0].purchase_order_id).not.toBe('pending-purchase-order');
  });

  it('prices the order from the lines instead of writing a 0 subtotal', async () => {
    const handler = (await import('../../../supabase/functions/purchase-orders/index.ts')).default;
    await handler(post(pageBody));

    const po = state.tables['purchase_orders'][0];
    expect(Number(po.subtotal)).toBe(127.5);
    expect(Number(po.total_amount)).toBe(142.5); // 127.50 + 10 tax + 5 shipping
  });

  it('reports a failed line insert rather than answering 201 without the lines', async () => {
    state.insertErrors['purchase_order_items'] = { message: 'boom' };
    const handler = (await import('../../../supabase/functions/purchase-orders/index.ts')).default;
    const res = await handler(post(pageBody));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/line items were not saved/i);
    expect(state.tables['purchase_order_items'] ?? []).toHaveLength(0);
  });
});
