/**
 * WF-P-02: receiving a purchase order.
 *
 * POST /purchase-orders/:id/receive existed and moved inventory, but every
 * decision it made was inline in the request loop, so none of it was testable -
 * and no screen called it. The only action offered on an approved PO was Release
 * to Warehouse, which navigates away and records nothing, so nothing in the
 * product had ever set received_quantity.
 *
 * The three rules under test are each a decision, not an implementation detail:
 * over-receipt is applied and reported rather than clamped or refused; a
 * serialized line records its receipt without moving bulk inventory, because
 * those units become equipment rows (WF-L-04) and counting both would double
 * them; and status is derived from all the lines, never from the receipt.
 *
 * WF-P-05 UPDATE: there is no longer a second copy.
 * server/services/purchase-order-receiving.ts existed because Express served this
 * prefix in dev while the edge function served production, and the two had to
 * agree - the premise of the parity test that guarded them. /api/purchase-orders
 * is proxied now and the Express router is deleted, so the duplicate was one more
 * thing to keep in step for no host. Both it and the parity test are gone; this
 * file tests the surviving module.
 */

import { describe, it, expect } from 'vitest';
import {
  buildPayableFromReceipt,
  inventoryMovements,
  planReceipt,
  receiptQuantity,
  serialCaptureRequired,
  statusAfterReceipt,
  type ReceivableLine,
} from '../../../supabase/functions/purchase-orders/_receiving.ts';

const lines: ReceivableLine[] = [
  {
    id: 'l1',
    quantity: 10,
    received_quantity: 0,
    inventory_item_id: 'inv-1',
    item_description: 'Toner',
  },
  {
    id: 'l2',
    quantity: 4,
    received_quantity: 0,
    inventory_item_id: 'inv-2',
    item_description: 'MFP',
  },
  {
    id: 'l3',
    quantity: 2,
    received_quantity: 0,
    inventory_item_id: null,
    item_description: 'Freight',
  },
];

describe('WF-P-02: planning a receipt', () => {
  it('accepts a partial receipt and carries the stored quantity forward', () => {
    const plan = planReceipt(lines, [{ lineItemId: 'l1', quantity: 4 }]);
    expect(plan.receipts).toEqual([
      {
        lineItemId: 'l1',
        quantity: 4,
        newReceivedQuantity: 4,
        ordered: 10,
        inventoryItemId: 'inv-1',
      },
    ]);
    expect(plan.overReceipts).toEqual([]);
  });

  it('adds to what is already received rather than replacing it', () => {
    const partial: ReceivableLine[] = [{ ...lines[0], received_quantity: 4 }];
    const plan = planReceipt(partial, [{ lineItemId: 'l1', quantity: 3 }]);
    expect(plan.receipts[0].newReceivedQuantity).toBe(7);
  });

  it('applies an over-receipt and names it, instead of clamping or refusing', () => {
    const plan = planReceipt(lines, [{ lineItemId: 'l1', quantity: 11 }]);
    expect(plan.receipts[0].newReceivedQuantity).toBe(11);
    expect(plan.overReceipts).toEqual([
      { lineItemId: 'l1', ordered: 10, received: 11, description: 'Toner' },
    ]);
  });

  it('sums two entries for the same line — two boxes of one part is one receipt of the sum', () => {
    const plan = planReceipt(lines, [
      { lineItemId: 'l1', quantity: 3 },
      { lineItemId: 'l1', quantity: 2 },
    ]);
    expect(plan.receipts).toHaveLength(1);
    expect(plan.receipts[0].quantity).toBe(5);
    expect(plan.receipts[0].newReceivedQuantity).toBe(5);
  });

  it('reports an id that belongs to no line rather than ignoring it', () => {
    const plan = planReceipt(lines, [{ lineItemId: 'nope', quantity: 1 }]);
    expect(plan.receipts).toEqual([]);
    expect(plan.unknownLineItemIds).toEqual(['nope']);
  });

  it('skips zero and negative quantities', () => {
    const plan = planReceipt(lines, [
      { lineItemId: 'l1', quantity: 0 },
      { lineItemId: 'l2', quantity: -3 },
    ]);
    expect(plan.receipts).toEqual([]);
  });

  it('reads the quantity under any of the names callers send', () => {
    expect(receiptQuantity({ quantity: 2 })).toBe(2);
    expect(receiptQuantity({ quantityReceived: 3 })).toBe(3);
    expect(receiptQuantity({ quantity_received: '4' })).toBe(4);
    expect(receiptQuantity({})).toBe(0);
  });
});

describe('WF-P-02: status is derived from the lines, not the receipt', () => {
  it('is partially_received while anything is outstanding', () => {
    const plan = planReceipt(lines, [{ lineItemId: 'l1', quantity: 10 }]);
    expect(statusAfterReceipt(lines, plan.receipts)).toBe('partially_received');
  });

  it('is received only once every line is complete', () => {
    const plan = planReceipt(lines, [
      { lineItemId: 'l1', quantity: 10 },
      { lineItemId: 'l2', quantity: 4 },
      { lineItemId: 'l3', quantity: 2 },
    ]);
    expect(statusAfterReceipt(lines, plan.receipts)).toBe('received');
  });

  it('counts an over-received line as complete', () => {
    const one: ReceivableLine[] = [lines[0]];
    const plan = planReceipt(one, [{ lineItemId: 'l1', quantity: 12 }]);
    expect(statusAfterReceipt(one, plan.receipts)).toBe('received');
  });

  it('does not call a second partial receipt "received" just because it is larger', () => {
    // l1 is complete from an earlier receipt; l2 gets its first units now.
    const partly: ReceivableLine[] = [
      { ...lines[0], received_quantity: 10 },
      { ...lines[1], received_quantity: 0 },
      { ...lines[2], received_quantity: 0 },
    ];
    const plan = planReceipt(partly, [{ lineItemId: 'l2', quantity: 4 }]);
    expect(statusAfterReceipt(partly, plan.receipts)).toBe('partially_received');
  });

  it('leaves the status alone when nothing has been received at all', () => {
    expect(statusAfterReceipt(lines, [])).toBeNull();
    expect(statusAfterReceipt([], [])).toBeNull();
  });
});

describe('WF-P-02: serialized lines do not move bulk inventory', () => {
  const plan = planReceipt(lines, [
    { lineItemId: 'l1', quantity: 10 },
    { lineItemId: 'l2', quantity: 4 },
    { lineItemId: 'l3', quantity: 2 },
  ]);
  const serialized = new Set(['inv-2']);

  it('moves only the non-serialized items', () => {
    expect(inventoryMovements(plan.receipts, serialized)).toEqual([
      { inventoryItemId: 'inv-1', quantity: 10 },
    ]);
  });

  it('still reports the serialized line as needing serial numbers', () => {
    expect(serialCaptureRequired(lines, plan.receipts, serialized)).toEqual([
      { lineItemId: 'l2', inventoryItemId: 'inv-2', quantity: 4, description: 'MFP' },
    ]);
  });

  it('a line with no inventory item is neither moved nor flagged', () => {
    const movements = inventoryMovements(plan.receipts, serialized);
    expect(movements.find((m) => m.inventoryItemId === null)).toBeUndefined();
    expect(
      serialCaptureRequired(lines, plan.receipts, serialized).find((c) => c.lineItemId === 'l3'),
    ).toBeUndefined();
  });

  it('sums two lines pointing at the same inventory item', () => {
    const shared: ReceivableLine[] = [
      { id: 'a', quantity: 5, received_quantity: 0, inventory_item_id: 'inv-1' },
      { id: 'b', quantity: 5, received_quantity: 0, inventory_item_id: 'inv-1' },
    ];
    const p = planReceipt(shared, [
      { lineItemId: 'a', quantity: 2 },
      { lineItemId: 'b', quantity: 3 },
    ]);
    expect(inventoryMovements(p.receipts, new Set())).toEqual([
      { inventoryItemId: 'inv-1', quantity: 5 },
    ]);
  });
});

describe('WF-P-02: the payable a receipt raises', () => {
  const po = {
    id: 'po-1',
    tenant_id: 'tenant-1',
    vendor_id: 'vendor-1',
    po_number: 'PO-1001',
    subtotal: '1000.00',
    tax_amount: '80.00',
    total_amount: '1080.00',
  };

  it('links to the purchase order and carries its totals', () => {
    const ap = buildPayableFromReceipt(po, {
      receiptDate: '2026-09-02T00:00:00.000Z',
      createdBy: 'user-1',
    });
    expect(ap).toMatchObject({
      tenant_id: 'tenant-1',
      vendor_id: 'vendor-1',
      purchase_order_id: 'po-1',
      purchase_order_number: 'PO-1001',
      subtotal: 1000,
      tax_amount: 80,
      total_amount: 1080,
      paid_amount: 0,
      balance_amount: 1080,
      status: 'pending',
      created_by: 'user-1',
    });
  });

  it('derives a bill number that says where it came from — the column is NOT NULL', () => {
    const ap = buildPayableFromReceipt(po, {
      receiptDate: '2026-09-02T00:00:00.000Z',
      createdBy: 'user-1',
    });
    expect(ap.bill_number).toBe('PO-1001-RECEIPT');
  });

  it('defaults to net 30 from the receipt date, and takes an override', () => {
    const net30 = buildPayableFromReceipt(po, {
      receiptDate: '2026-09-02T00:00:00.000Z',
      createdBy: 'u',
    });
    expect(String(net30.due_date).slice(0, 10)).toBe('2026-10-02');

    const net45 = buildPayableFromReceipt(po, {
      receiptDate: '2026-09-02T00:00:00.000Z',
      createdBy: 'u',
      dueDays: 45,
    });
    expect(String(net45.due_date).slice(0, 10)).toBe('2026-10-17');
  });
});
