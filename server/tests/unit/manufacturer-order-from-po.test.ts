/**
 * Placing an approved PO with the manufacturer (WF-P-06).
 *
 * THE DECISION WAS BUILD. supabase/functions/manufacturer-orders is 1,584 lines
 * over six tables migration 0000 creates, and no client tree called it - the
 * AUDIT-024 shape, where the question is whether you have found debt or
 * unconnected work. Unconnected work: ordering from Canon or Ricoh and tracking
 * the confirmation and the shipment is a dealer's purchasing desk all day, and
 * manufacturer_orders.purchase_order_id was put there for this join.
 *
 * The Express router at the same prefix turned out to be doubly dead - shadowed
 * by the proxy AND in docs/session-user-auth-baseline.json, so all 43 of its
 * handlers answered 401 in dev too. It is deleted; the edge function covers
 * every endpoint it had.
 */
import { describe, expect, it } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  manufacturerOrderLineItems,
  manufacturerOrders,
} from '../../../shared/manufacturer-order-schema';
import { purchaseOrders } from '../../../shared/schema';
import {
  ORDER_METHODS,
  buildManufacturerLineItems,
  buildManufacturerOrder,
  canPlace,
  expectedDateFrom,
  purchaseOrderPlacementUpdate,
} from '../../../supabase/functions/_shared/manufacturer-order-from-po.ts';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const code = (p: string) =>
  read(p)
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

const PO = {
  id: 'po-1',
  po_number: 'PO-2026-0042',
  status: 'approved',
  subtotal: '1000',
  tax_amount: '80',
  shipping_amount: '25',
  total_amount: '1105',
  expected_date: '2026-10-01T00:00:00.000Z',
  delivery_address: '19 Mill Street, Des Moines, IA 50309',
  special_instructions: 'Dock 3, before noon',
};

const NOW = new Date('2026-09-18T10:00:00.000Z');

describe('the order row is writable', () => {
  const row = buildManufacturerOrder(PO, {
    tenantId: 't1',
    userId: 'u1',
    connectionId: 'conn-1',
    orderMethod: 'portal',
    now: NOW,
  });

  it('every key is a column on manufacturer_orders', () => {
    const cols = Object.values(getTableColumns(manufacturerOrders)).map((c) => c.name);
    for (const key of Object.keys(row)) {
      expect(cols, `${key} is not a column`).toContain(key);
    }
  });

  it('every NOT NULL column without a default is supplied', () => {
    // connection_id, order_number and order_method are all NOT NULL. A missing
    // one is a 23502 the first time the button is pressed.
    for (const col of Object.values(getTableColumns(manufacturerOrders))) {
      if (col.notNull && !col.hasDefault) {
        expect(row[col.name], `${col.name} is required`).toBeDefined();
      }
    }
  });

  it('carries the PO number rather than minting a second one', () => {
    // The dealer and the manufacturer refer to one order. A separate number
    // means a phone call where nobody can agree which order is being discussed.
    expect(row.order_number).toBe('PO-2026-0042');
  });

  it('falls back to something traceable when the PO has no number', () => {
    const row2 = buildManufacturerOrder(
      { ...PO, po_number: null },
      {
        tenantId: 't1',
        userId: 'u1',
        connectionId: 'c',
        orderMethod: 'manual',
      },
    );
    expect(row2.order_number).toContain('po-1'.slice(0, 8));
  });

  it('keeps the delivery address whole', () => {
    // purchase_orders.delivery_address is one text field. Splitting it into
    // city/state/zip by guesswork puts a wrong state on a shipping label.
    expect(row.ship_to_address).toBe(PO.delivery_address);
  });

  it('starts as a draft, not as submitted', () => {
    // Nothing has been transmitted, and order_status is what the rest of the
    // subsystem branches on.
    expect(row.order_status).toBe('draft');
  });

  it('money is a fixed-scale string, never NaN', () => {
    expect(row.total_amount).toBe('1105.00');
    const empty = buildManufacturerOrder(
      { id: 'x' },
      {
        tenantId: 't',
        userId: 'u',
        connectionId: 'c',
        orderMethod: 'manual',
      },
    );
    expect(empty.subtotal).toBe('0');
    expect(String(empty.total_amount)).not.toContain('NaN');
  });
});

describe('line items', () => {
  const items = [
    {
      id: 'i1',
      line_number: 1,
      item_description: 'imageRUNNER C3226i',
      manufacturer_part_number: 'CAN-C3226I',
      part_number: 'INTERNAL-1',
      item_code: 'IC-1',
      quantity: 2,
      unit_price: '2400',
      total_price: '4800',
      unit_of_measure: 'each',
    },
    {
      id: 'i2',
      line_number: 2,
      item_description: 'Staple cartridge',
      item_code: 'IC-2',
      quantity: 4,
      unit_price: '18',
      total_price: '72',
    },
  ];

  it('every key is a column on manufacturer_order_line_items', () => {
    const cols = Object.values(getTableColumns(manufacturerOrderLineItems)).map((c) => c.name);
    const { rows } = buildManufacturerLineItems(items, { tenantId: 't', orderId: 'o', now: NOW });
    for (const key of Object.keys(rows[0])) {
      expect(cols, `${key} is not a column`).toContain(key);
    }
  });

  it("prefers the manufacturer's own part number", () => {
    // That is the code the manufacturer will recognise; the dealer's internal
    // item_code is a last resort.
    const { rows } = buildManufacturerLineItems(items, { tenantId: 't', orderId: 'o' });
    expect(rows[0].product_code).toBe('CAN-C3226I');
    expect(rows[1].product_code).toBe('IC-2');
  });

  it('refuses a line nobody could fulfil rather than sending a placeholder', () => {
    // product_code and description are NOT NULL. An order line the
    // manufacturer cannot act on is worse than a rejected order.
    const { rows, unfulfillable } = buildManufacturerLineItems(
      [...items, { id: 'i3', quantity: 1 }],
      { tenantId: 't', orderId: 'o' },
    );
    expect(rows).toHaveLength(2);
    expect(unfulfillable).toEqual(['i3']);
  });

  it('numbers lines from one when the PO did not', () => {
    const { rows } = buildManufacturerLineItems(
      [{ id: 'a', item_description: 'd', item_code: 'c', quantity: 1 }],
      { tenantId: 't', orderId: 'o' },
    );
    expect(rows[0].line_number).toBe(1);
  });
});

describe('what placing does to the purchase order', () => {
  it('only an approved PO can be placed', () => {
    expect(canPlace({ id: 'x', status: 'approved' })).toBe(true);
    for (const status of ['draft', 'pending', 'ordered', 'received', 'cancelled']) {
      expect(canPlace({ id: 'x', status })).toBe(false);
    }
  });

  it('moves it to ordered and stamps who and when', () => {
    const update = purchaseOrderPlacementUpdate('u1', NOW);
    const cols = Object.values(getTableColumns(purchaseOrders)).map((c) => c.name);
    for (const key of Object.keys(update)) expect(cols).toContain(key);
    expect(update.status).toBe('ordered');
    expect(update.ordered_by).toBe('u1');
  });

  it('does not touch receipt state, which WF-P-02 owns', () => {
    const update = purchaseOrderPlacementUpdate('u1');
    expect(update).not.toHaveProperty('received_by');
    expect(update).not.toHaveProperty('last_receipt_date');
  });
});

describe('the date a confirmation or shipment carries back', () => {
  it('prefers an actual delivery, then a confirmed one, then an estimate', () => {
    expect(expectedDateFrom({ estimated_delivery_date: 'e', confirmed_delivery_date: 'c' })).toBe(
      'c',
    );
    expect(expectedDateFrom({ actual_delivery_date: 'a', confirmed_delivery_date: 'c' })).toBe('a');
    expect(expectedDateFrom({ estimated_delivery_date: 'e' })).toBe('e');
  });

  it('is null when the row says nothing about delivery', () => {
    // And the caller must not write null: overwriting the buyer's own estimate
    // in the name of an update that carried no information is worse than
    // leaving it alone.
    expect(expectedDateFrom({})).toBe(null);
    expect(expectedDateFrom(null)).toBe(null);
  });
});

describe('the wiring', () => {
  const handler = code('supabase/functions/manufacturer-orders/handlers/from-purchase-order.ts');
  const index = code('supabase/functions/manufacturer-orders/index.ts');
  const page = code('client/src/pages/PurchaseOrders.tsx');
  const dialog = code('client/src/components/purchasing/PlaceManufacturerOrderDialog.tsx');

  it('the dispatcher routes /from-purchase-order before the order-id fallthrough', () => {
    // Otherwise 'from-purchase-order' is read as an order id and the by-id
    // branch answers 404.
    const branchAt = index.indexOf("first === 'from-purchase-order'");
    const fallthroughAt = index.indexOf('Core orders');
    expect(branchAt).toBeGreaterThan(0);
    expect(branchAt).toBeLessThan(fallthroughAt === -1 ? Number.MAX_SAFE_INTEGER : fallthroughAt);
  });

  it('the prefix is proxied and the Express router is gone', () => {
    expect(read('server/middleware/edge-function-proxy.ts')).toContain(
      "'/api/manufacturer-orders': 'manufacturer-orders'",
    );
    expect(existsSync(join(repo, 'server/routes/manufacturer-order-routes.ts'))).toBe(false);
    expect(read('server/routes-registry.ts')).not.toMatch(/^\s*\['\/api\/manufacturer-orders'/m);
  });

  it('placing the same PO twice is refused', () => {
    // There are no transactions in PostgREST, so this is a read-then-check -
    // but ordering the machines twice is the outcome it prevents.
    expect(handler).toContain('ALREADY_PLACED');
  });

  it('an order with no orderable line is rolled back by hand', () => {
    // No transaction, so an empty header would otherwise survive and block the
    // retry that the duplicate check performs.
    expect(handler).toContain('NO_ORDERABLE_LINES');
    expect(handler).toMatch(/delete\(\)\s*\.eq\('id', order\.id\)/);
  });

  it('order_method is validated against the enum', () => {
    // It is a pgEnum, so an unknown value is a 22P02 rather than an odd row.
    expect(handler).toContain('ORDER_METHODS.includes');
    expect(ORDER_METHODS).toContain('portal');
  });

  it('every response says nothing was transmitted', () => {
    // A button labelled "Place order" that quietly does not send is the failure
    // this repo keeps finding. The /submit branch persists intent only.
    expect(handler).toContain('No message has been transmitted');
    expect(dialog).toContain('Nothing is transmitted to the manufacturer');
  });

  it('the PO page offers it on an approved order', () => {
    expect(page).toContain('PlaceManufacturerOrderDialog');
    expect(page).toContain('Place Manufacturer Order');
  });

  it('a confirmation and a shipment both carry the date back', () => {
    for (const f of ['confirmations', 'shipments']) {
      expect(
        code(`supabase/functions/manufacturer-orders/handlers/${f}.ts`),
        `${f} does not sync the PO`,
      ).toContain('syncPurchaseOrderExpectedDate(');
    }
  });
});
