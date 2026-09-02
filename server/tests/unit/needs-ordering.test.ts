/**
 * WF-P-04: what did we sell that nobody has ordered?
 *
 * No page answered it. A buyer hunted through Contracts, and the Book Order
 * button there navigated to /purchase-orders?contractId= where WF-P-03 made the
 * id stick - but nothing told anyone which contracts still needed one. A deal
 * could close, a contract could go active, and the equipment could sit unordered
 * until the customer asked where it was.
 *
 * The AC that matters most is the last one: a contract with a linked purchase
 * order leaves the queue. The first block is that, and it covers the case the
 * rule was written for - a CANCELLED order still counts.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { getTableColumns } from 'drizzle-orm';
import { purchaseOrderItems } from '../../../shared/schema';
import {
  ORDERABLE_CONTRACT_STATUSES,
  ORDERABLE_ITEM_TYPES,
  buildNeedsOrderingRow,
  contractsNeedingOrders,
  orderableLines,
} from '../../../supabase/functions/purchase-orders/_needs-ordering';

const strip = (src: string) =>
  src
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith('//') && !t.startsWith('/*') && !t.startsWith('*');
    })
    .join('\n');

const contract = (over: Record<string, unknown> = {}) => ({
  id: 'c-1',
  contract_number: 'CT-2026-0001',
  customer_id: 'acct-1',
  status: 'active',
  start_date: '2026-09-01T00:00:00.000Z',
  proposal_id: 'prop-1',
  deal_id: 'deal-1',
  acquisition_type: 'lease',
  ...over,
});

describe('a contract with a linked purchase order leaves the queue', () => {
  it('is in the queue while nothing references it', () => {
    const { needing } = contractsNeedingOrders([contract()], []);
    expect(needing.map((c) => c.id)).toEqual(['c-1']);
  });

  it('leaves the moment a purchase order references it', () => {
    const { needing } = contractsNeedingOrders(
      [contract()],
      [{ id: 'po-1', po_number: 'PO-1', status: 'draft', source_contract_id: 'c-1' }],
    );
    expect(needing).toEqual([]);
  });

  it('stays out on a CANCELLED order', () => {
    // The queue asks "has anyone acted on this". A cancelled order is somebody
    // having acted and changed their mind; putting the contract back would send a
    // second buyer to re-order what a first deliberately stopped.
    const { needing, alreadyOrdered } = contractsNeedingOrders(
      [contract()],
      [{ id: 'po-1', po_number: 'PO-1', status: 'cancelled', source_contract_id: 'c-1' }],
    );
    expect(needing).toEqual([]);
    expect(alreadyOrdered.get('c-1')?.[0].status).toBe('cancelled');
  });

  it('ignores an order pointed at a different contract', () => {
    const { needing } = contractsNeedingOrders(
      [contract()],
      [{ id: 'po-1', status: 'draft', source_contract_id: 'c-2' }],
    );
    expect(needing.map((c) => c.id)).toEqual(['c-1']);
  });

  it('only queues contracts the customer has committed to', () => {
    const { needing } = contractsNeedingOrders(
      [
        contract({ id: 'active', status: 'active' }),
        contract({ id: 'signed', status: 'signed' }),
        contract({ id: 'draft', status: 'draft' }),
        contract({ id: 'expired', status: 'expired' }),
        contract({ id: 'none', status: null }),
      ],
      [],
    );
    expect(needing.map((c) => c.id)).toEqual(['active', 'signed']);
    expect(ORDERABLE_CONTRACT_STATUSES).toContain('pending_installation');
  });
});

describe('which proposal lines become order lines', () => {
  const inventory = [
    {
      id: 'inv-1',
      part_number: 'IRC5850',
      manufacturer_part_number: 'CAN-5850',
      primary_vendor: 'Canon USA',
      unit_of_measure: 'EA',
    },
  ];
  const vendors = [{ id: 'v-canon', vendor_name: 'Canon USA' }];

  const lines = [
    {
      id: 'l-1',
      proposal_id: 'prop-1',
      line_number: 1,
      item_type: 'equipment',
      product_code: 'IRC5850',
      product_name: 'Canon imageRUNNER C5850i',
      quantity: 2,
      unit_cost: '3100.00',
      unit_price: '4200.00',
      is_recurring: false,
    },
    {
      id: 'l-2',
      proposal_id: 'prop-1',
      line_number: 2,
      item_type: 'service',
      product_code: 'SVC',
      product_name: 'Managed print service',
      quantity: 1,
      unit_cost: '0',
      unit_price: '250.00',
      is_recurring: true,
    },
    {
      id: 'l-3',
      proposal_id: 'prop-1',
      line_number: 3,
      item_type: 'labor',
      product_name: 'Installation labour',
      quantity: 4,
      unit_cost: '65.00',
      unit_price: '95.00',
      is_recurring: false,
    },
  ];

  it('orders the machine and reports the rest rather than dropping it', () => {
    const result = orderableLines(lines, inventory, vendors);
    expect(result.lines.map((l) => l.itemDescription)).toEqual(['Canon imageRUNNER C5850i']);
    expect(result.notOrderable.map((n) => n.productName)).toEqual([
      'Managed print service',
      'Installation labour',
    ]);
    expect(result.notOrderable[0].reason).toContain('recurring');
    expect(result.notOrderable[1].reason).toContain('labor');
    expect(ORDERABLE_ITEM_TYPES).toEqual(['equipment', 'accessory', 'supply', 'part']);
  });

  it('raises the order at DEALER COST, not the sell price', () => {
    // Using unit_price would inflate the payable this order raises by the whole
    // margin - 8400 instead of 6200 on this line.
    const [line] = orderableLines(lines, inventory, vendors).lines;
    expect(line.unitPrice).toBe(3100);
    expect(line.totalPrice).toBe(6200);
  });

  it('resolves the vendor by name, and says nothing when it cannot', () => {
    // inventory_items.primary_vendor is FREE TEXT, not a foreign key. A purchase
    // order raised against the wrong vendor is worse than one the buyer picks.
    const matched = orderableLines(lines, inventory, vendors).lines[0];
    expect(matched.vendorId).toBe('v-canon');

    const unmatched = orderableLines(
      lines,
      [{ ...inventory[0], primary_vendor: 'Canon U.S.A. Incorporated' }],
      vendors,
    ).lines[0];
    expect(unmatched.vendorId).toBeNull();
    // The text is still shown, so the buyer knows who the item comes from.
    expect(unmatched.vendorName).toBe('Canon U.S.A. Incorporated');
  });

  it('matches inventory on any of the codes a proposal carries', () => {
    const byManufacturerPart = orderableLines(
      [{ ...lines[0], product_code: 'CAN-5850' }],
      inventory,
      vendors,
    ).lines[0];
    expect(byManufacturerPart.inventoryItemId).toBe('inv-1');
    const unknown = orderableLines(
      [{ ...lines[0], product_code: 'NOT-A-CODE' }],
      inventory,
      vendors,
    ).lines[0];
    expect(unknown.inventoryItemId).toBeNull();
    expect(unknown.vendorId).toBeNull();
  });

  it('renumbers the lines it keeps', () => {
    const result = orderableLines(
      [lines[1], lines[0], { ...lines[0], id: 'l-4', line_number: 9 }],
      inventory,
      vendors,
    );
    expect(result.lines.map((l) => l.lineNumber)).toEqual([1, 2]);
  });

  it('produces lines a purchase_order_items row can be built from', () => {
    const columns = new Set(Object.values(getTableColumns(purchaseOrderItems)).map((c) => c.name));
    for (const col of ['item_description', 'item_code', 'quantity', 'unit_price', 'total_price']) {
      expect(columns.has(col)).toBe(true);
    }
  });
});

describe('the queue row', () => {
  const { lines, notOrderable } = orderableLines(
    [
      {
        id: 'l-1',
        proposal_id: 'p',
        line_number: 1,
        item_type: 'equipment',
        product_code: 'A',
        product_name: 'A',
        quantity: 1,
        unit_cost: '100',
      },
      {
        id: 'l-2',
        proposal_id: 'p',
        line_number: 2,
        item_type: 'equipment',
        product_code: 'B',
        product_name: 'B',
        quantity: 2,
        unit_cost: '50',
      },
    ],
    [
      { id: 'i-a', part_number: 'A', primary_vendor: 'Acme' },
      { id: 'i-b', part_number: 'B', primary_vendor: 'Acme' },
    ],
    [{ id: 'v-acme', vendor_name: 'Acme' }],
  );

  it('totals at cost and suggests the vendor when every line agrees', () => {
    const row = buildNeedsOrderingRow(contract(), 'Northwind', lines, notOrderable);
    expect(row.estimatedCost).toBe(200);
    expect(row.suggestedVendorId).toBe('v-acme');
    expect(row.customerName).toBe('Northwind');
    expect(row.contractNumber).toBe('CT-2026-0001');
  });

  it('suggests nothing when the lines come from two vendors', () => {
    // Two vendors on one contract means two orders, and picking one would put the
    // wrong products on it.
    const mixed = orderableLines(
      [
        {
          id: 'l-1',
          proposal_id: 'p',
          line_number: 1,
          item_type: 'equipment',
          product_code: 'A',
          product_name: 'A',
          quantity: 1,
          unit_cost: '100',
        },
        {
          id: 'l-2',
          proposal_id: 'p',
          line_number: 2,
          item_type: 'equipment',
          product_code: 'B',
          product_name: 'B',
          quantity: 1,
          unit_cost: '50',
        },
      ],
      [
        { id: 'i-a', part_number: 'A', primary_vendor: 'Acme' },
        { id: 'i-b', part_number: 'B', primary_vendor: 'Other Co' },
      ],
      [
        { id: 'v-acme', vendor_name: 'Acme' },
        { id: 'v-other', vendor_name: 'Other Co' },
      ],
    );
    expect(buildNeedsOrderingRow(contract(), null, mixed.lines, []).suggestedVendorId).toBeNull();
  });

  it('carries a contract with no proposal rather than hiding it', () => {
    // It still needs ordering; the buyer just has to key the lines.
    const row = buildNeedsOrderingRow(contract({ proposal_id: null }), null, [], []);
    expect(row.lines).toEqual([]);
    expect(row.estimatedCost).toBe(0);
    expect(row.contractId).toBe('c-1');
  });
});

describe('the endpoint and the two doors into the pre-filled create', () => {
  const handler = strip(readFileSync('supabase/functions/purchase-orders/index.ts', 'utf8'));
  const page = readFileSync('client/src/pages/PurchaseOrders.tsx', 'utf8');

  it('the endpoint is routed before the /:id branch', () => {
    const needs = handler.indexOf("poId === 'needs-ordering'");
    const byId = handler.indexOf("req.method === 'GET' && poId && !subResource");
    expect(needs).toBeGreaterThan(-1);
    // Otherwise "needs-ordering" is read as a purchase-order id and 404s.
    expect(needs).toBeLessThan(byId);
  });

  it('reads the contracts, their orders and the proposal lines', () => {
    expect(handler).toContain('contractsNeedingOrders(contractRows ?? [], orders ?? [])');
    expect(handler).toContain("from('proposal_line_items')");
    expect(handler).toContain("not('source_contract_id', 'is', null)");
  });

  it('the page has a Needs ordering tab', () => {
    expect(page).toContain('<TabsTrigger value="needs-ordering">');
    expect(page).toContain("queryKey: ['/api/purchase-orders/needs-ordering']");
    expect(page).toContain('<NeedsOrderingList');
  });

  it('the tab and the ?contractId= deep link open the SAME pre-filled dialog', () => {
    expect(page).toContain('onOrder={startOrderFromContract}');
    expect(page).toContain('needsOrdering.find((r) => r.contractId === contractIdParam)');
    expect(page).toContain('vendorId: row.suggestedVendorId ?? ');
    expect(page).toContain('itemDescription: line.itemDescription');
  });

  it('the created order links back to the contract', () => {
    expect(page).toContain('const sourceContractId = prefilledContractId || contractIdParam;');
  });

  it('the handoff page deep-links to it', () => {
    const handoffs = readFileSync('client/src/pages/SalesHandoffs.tsx', 'utf8');
    expect(handoffs).toContain('/purchase-orders?contractId=');
    expect(handoffs).toContain('Create purchase order');
  });

  it('the tab is gated with the rest of the page', () => {
    // AC2's operations.po.view gate is the page's, not a second one - the tab is
    // inside /purchase-orders.
    const nav = readFileSync('client/src/lib/navigation-permissions.ts', 'utf8');
    expect(nav).toMatch(/'\/purchase-orders': \{[^}]*operations\.po\.view/s);
  });
});
