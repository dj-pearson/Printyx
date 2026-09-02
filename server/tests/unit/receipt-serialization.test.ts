/**
 * WF-L-04: receiving creates serialized equipment rows.
 *
 * WF-P-02 established that a serialized line records its received quantity and
 * deliberately does NOT move bulk inventory, because its units are supposed to
 * become equipment rows. Nothing created them. POST /equipment had no caller in
 * any client tree, the Add Equipment dialog on the customer page rendered
 * "Equipment registration form would go here...", and `equipment` had no link
 * back to the order. A purchase order could be fully received and no equipment
 * row would exist for meter billing, service or the lifecycle.
 *
 * AC4 asks for a test that goes from an approved PO to N equipment rows with real
 * serials without touching the API directly. That is what the first block does:
 * the plan is computed from the order's own lines, and the rows it produces are
 * checked against the real Drizzle columns. The migration itself was proven
 * separately against PostgreSQL 16.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { getTableColumns } from 'drizzle-orm';
import { equipment } from '../../../shared/schema';
import { equipmentLifecycle } from '../../../shared/equipment-schema';
import {
  lifecycleRowForReceivedUnit,
  outstandingSerialUnits,
  planSerialCapture,
} from '../../lib/equipment-serialization';
import {
  planReceipt,
  serialCaptureRequired,
} from '../../../supabase/functions/purchase-orders/_receiving';

const strip = (src: string) =>
  src
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith('//') && !t.startsWith('/*') && !t.startsWith('*');
    })
    .join('\n');

const CTX = { tenantId: 'tenant-1', purchaseOrderId: 'po-1', customerId: null };

describe('an approved purchase order becomes N equipment rows', () => {
  // Two lines: three serialized MFPs and a box of toner that is not.
  const lines = [
    {
      id: 'line-mfp',
      quantity: 3,
      received_quantity: 0,
      inventory_item_id: 'inv-mfp',
      item_description: 'Canon imageRUNNER C5850i',
    },
    {
      id: 'line-toner',
      quantity: 10,
      received_quantity: 0,
      inventory_item_id: 'inv-toner',
      item_description: 'Black toner',
    },
  ];
  const serialized = new Set(['inv-mfp']);

  it('captures a serial per received unit and writes one equipment row each', () => {
    const plan = planReceipt(lines, [
      { lineItemId: 'line-mfp', quantity: 3 },
      { lineItemId: 'line-toner', quantity: 10 },
    ]);
    const pending = serialCaptureRequired(lines, plan.receipts, serialized).map((s) => ({
      lineItemId: s.lineItemId,
      quantity: s.quantity,
      description: s.description,
    }));

    // Only the serialized line is awaiting serials; the toner moved as bulk stock.
    expect(pending).toEqual([
      { lineItemId: 'line-mfp', quantity: 3, description: 'Canon imageRUNNER C5850i' },
    ]);

    const capture = planSerialCapture(
      pending,
      [
        { lineItemId: 'line-mfp', serialNumber: 'CNX-11001', assetTag: 'AT-1' },
        { lineItemId: 'line-mfp', serialNumber: 'CNX-11002' },
        { lineItemId: 'line-mfp', serialNumber: ' CNX-11003 ' },
      ],
      CTX,
    );

    expect(capture.problems).toEqual([]);
    expect(capture.outstanding).toEqual([]);
    expect(capture.equipment).toHaveLength(3);
    expect(capture.equipment.map((e) => e.serial_number)).toEqual([
      'CNX-11001',
      'CNX-11002',
      'CNX-11003',
    ]);
    expect(capture.equipment[0]).toMatchObject({
      tenant_id: 'tenant-1',
      purchase_order_id: 'po-1',
      purchase_order_item_id: 'line-mfp',
      description: 'Canon imageRUNNER C5850i',
      asset_tag: 'AT-1',
      equipment_status: 'active',
    });
  });

  it('leaves a partly-serialled line outstanding rather than reporting it done', () => {
    const plan = planReceipt(lines, [{ lineItemId: 'line-mfp', quantity: 3 }]);
    const pending = serialCaptureRequired(lines, plan.receipts, serialized).map((s) => ({
      lineItemId: s.lineItemId,
      quantity: s.quantity,
      description: s.description,
    }));

    const capture = planSerialCapture(
      pending,
      [{ lineItemId: 'line-mfp', serialNumber: 'CNX-11001' }],
      CTX,
    );
    expect(capture.equipment).toHaveLength(1);
    expect(capture.outstanding).toEqual([
      { lineItemId: 'line-mfp', quantity: 2, description: 'Canon imageRUNNER C5850i' },
    ]);
  });

  it('a partial receipt only asks for the units that actually arrived', () => {
    const plan = planReceipt(lines, [{ lineItemId: 'line-mfp', quantity: 1 }]);
    const pending = serialCaptureRequired(lines, plan.receipts, serialized);
    expect(pending[0].quantity).toBe(1);
  });
});

describe('what it refuses, and why', () => {
  const pending = [{ lineItemId: 'line-mfp', quantity: 2, description: 'MFP' }];

  it('never invents a serial for a unit left blank', () => {
    const capture = planSerialCapture(
      pending,
      [
        { lineItemId: 'line-mfp', serialNumber: 'CNX-1' },
        { lineItemId: 'line-mfp', serialNumber: '   ' },
      ],
      CTX,
    );
    expect(capture.equipment).toHaveLength(1);
    expect(capture.problems).toEqual([
      { lineItemId: 'line-mfp', reason: 'no serial number was entered for this unit' },
    ]);
    // The unit is still owed, not quietly dropped.
    expect(capture.outstanding).toEqual([
      { lineItemId: 'line-mfp', quantity: 1, description: 'MFP' },
    ]);
    expect(JSON.stringify(capture)).not.toMatch(/PENDING|UNKNOWN|TBD/i);
  });

  it('catches the same serial keyed twice in one receipt', () => {
    const capture = planSerialCapture(
      pending,
      [
        { lineItemId: 'line-mfp', serialNumber: 'CNX-1' },
        { lineItemId: 'line-mfp', serialNumber: 'cnx-1' },
      ],
      CTX,
    );
    expect(capture.equipment).toHaveLength(1);
    expect(capture.problems[0].reason).toContain('entered twice');
  });

  it('will not attach a serial to a line that is not awaiting one', () => {
    const capture = planSerialCapture(
      pending,
      [{ lineItemId: 'line-toner', serialNumber: 'CNX-9' }],
      CTX,
    );
    expect(capture.equipment).toEqual([]);
    expect(capture.problems[0].reason).toContain('not awaiting serial numbers');
  });

  it('leaves customer_id null for a stock order instead of guessing an account', () => {
    const capture = planSerialCapture(
      pending,
      [{ lineItemId: 'line-mfp', serialNumber: 'CNX-1' }],
      CTX,
    );
    expect(capture.equipment[0].customer_id).toBeNull();
  });

  it('carries the order customer through when the PO has one', () => {
    const capture = planSerialCapture(
      pending,
      [{ lineItemId: 'line-mfp', serialNumber: 'CNX-1' }],
      { ...CTX, customerId: 'acct-9' },
    );
    expect(capture.equipment[0].customer_id).toBe('acct-9');
  });

  it('counts only serialled units as captured', () => {
    expect(outstandingSerialUnits(pending, [{ lineItemId: 'line-mfp', serialNumber: '' }])).toEqual(
      pending,
    );
  });
});

describe('the rows are real rows', () => {
  const equipmentColumns = new Set(Object.values(getTableColumns(equipment)).map((c) => c.name));
  const lifecycleColumns = new Set(
    Object.values(getTableColumns(equipmentLifecycle)).map((c) => c.name),
  );
  const row = planSerialCapture(
    [{ lineItemId: 'line-mfp', quantity: 1, description: 'MFP' }],
    [{ lineItemId: 'line-mfp', serialNumber: 'CNX-1', manufacturer: 'Canon' }],
    CTX,
  ).equipment[0];

  it('the equipment row names only columns that exist', () => {
    expect(Object.keys(row).filter((k) => !equipmentColumns.has(k))).toEqual([]);
    expect(equipmentColumns.has('purchase_order_id')).toBe(true);
    expect(equipmentColumns.has('purchase_order_item_id')).toBe(true);
  });

  it('customer_id is nullable now, which is what makes a stock receipt possible', () => {
    const customerId = Object.values(getTableColumns(equipment)).find(
      (c) => c.name === 'customer_id',
    );
    expect(customerId?.notNull).toBe(false);
  });

  it('the lifecycle row enters at stage received, carrying the same links', () => {
    const lifecycle = lifecycleRowForReceivedUnit(row, 'eq-1');
    expect(Object.keys(lifecycle).filter((k) => !lifecycleColumns.has(k))).toEqual([]);
    expect(lifecycle).toMatchObject({
      equipment_id: 'eq-1',
      serial_number: 'CNX-1',
      current_stage: 'received',
      purchase_order_id: 'po-1',
      manufacturer: 'Canon',
    });
  });

  it('fills every NOT NULL lifecycle column without a default', () => {
    const lifecycle = lifecycleRowForReceivedUnit(row, 'eq-1');
    const missing = Object.values(getTableColumns(equipmentLifecycle))
      .filter((c) => c.notNull && !c.hasDefault && !c.primary)
      .map((c) => c.name)
      .filter((name) => lifecycle[name] === undefined || lifecycle[name] === null);
    expect(missing).toEqual([]);
  });
});

describe('both hosts, and the surfaces that call them', () => {
  it('the twins are identical logic', () => {
    const node = readFileSync('server/lib/equipment-serialization.ts', 'utf8');
    const deno = readFileSync('supabase/functions/purchase-orders/_serialization.ts', 'utf8');
    expect(strip(node)).toBe(strip(deno));
  });

  it('the edge function serves the serial-capture endpoint under the PO scope gate', () => {
    const src = strip(readFileSync('supabase/functions/purchase-orders/index.ts', 'utf8'));
    expect(src).toContain("subResource === 'serials'");
    expect(src).toContain('planSerialCapture(pending, units, {');
    expect(src).toContain("rowInScope(po, 'created_by', poScope)");
    // A serial already in the table is an answer, not a fault.
    expect(src).toContain('isUniqueViolation(insertError)');
  });

  it('POST /equipment exists on BOTH hosts and writes the lifecycle row', () => {
    const edge = strip(readFileSync('supabase/functions/equipment/index.ts', 'utf8'));
    expect(edge).toContain('purchase_order_id: body.purchaseOrderId');
    expect(edge).toContain('lifecycleRowForReceivedUnit(equipment, String(equipment.id))');

    // /api/equipment is both-divergent and Express served only GETs, so a create
    // would have worked in production and 404'd in dev.
    const express = strip(readFileSync('server/routes-mobile-api.ts', 'utf8'));
    expect(express).toContain("router.post('/api/equipment'");
    expect(express).toContain('purchaseOrderId: body.purchaseOrderId');
    expect(express).toContain('lifecycleRowForReceivedUnit(');
  });

  it('the receive dialog collects one serial per unit', () => {
    const page = readFileSync('client/src/pages/PurchaseOrders.tsx', 'utf8');
    expect(page).toContain('/api/purchase-orders/${id}/serials');
    expect(page).toContain('Serial numbers for');
    // Opened from the receipt response rather than only mentioned in a toast.
    expect(page).toContain('setSerialSlots(slots)');
  });

  it('the customer Add Equipment dialog is a real form now', () => {
    const page = readFileSync('client/src/components/customer/CustomerEquipment.tsx', 'utf8');
    expect(page).not.toContain('Equipment registration form would go here');
    expect(page).toContain("apiRequest('/api/equipment', 'POST'");
    // Appears without a reload: the list is a query and it is invalidated.
    expect(page).toContain(
      'invalidateQueries({ queryKey: [`/api/customers/${customerId}/equipment`] })',
    );
  });

  it('the migration is journalled and adds the links', () => {
    const sql = readFileSync('drizzle/migrations/0077_wf_l04_equipment_receipt_links.sql', 'utf8');
    expect(sql).toContain('ALTER COLUMN "customer_id" DROP NOT NULL');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "purchase_order_id"');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "purchase_order_item_id"');
    expect(readFileSync('drizzle/migrations/meta/_journal.json', 'utf8')).toContain(
      '0077_wf_l04_equipment_receipt_links',
    );
  });
});
