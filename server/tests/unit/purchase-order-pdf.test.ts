// Round 210. PurchaseOrders' "Export PDF" had no handler and no endpoint
// existed. GET /purchase-orders/:id/pdf renders one; and the two by-id reads
// beside it (detail, line items) checked tenant only while the list was scoped
// on created_by, so a PO the list hid from a rep was readable by id.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildPoDocument } from '../../../supabase/functions/purchase-orders/_po-document';

const strip = (s: string) =>
  s.replace(/(?<![:/'"`])\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, ' ');
const SRC = strip(readFileSync('supabase/functions/purchase-orders/index.ts', 'utf8'));

const po = {
  id: 'p1',
  po_number: 'PO-7',
  status: 'approved',
  order_date: '2026-09-01T10:00:00Z',
  expected_date: '2026-09-15',
  subtotal: '200.00',
  tax_amount: '16.00',
  shipping_amount: null,
  total_amount: '216.00',
  delivery_address: '1 Main St\nSuite 4',
  special_instructions: 'Deliver to the loading dock.',
};
const vendor = {
  vendor_name: 'Toner Co',
  city: 'Austin',
  state: 'TX',
  zip_code: '78701',
  email: 'a@t.co',
};
const items = [
  {
    item_description: 'Black toner',
    part_number: 'TN-1',
    quantity: '4',
    unit_price: '50',
    total_price: '200',
  },
];

describe('buildPoDocument', () => {
  it('prints the stored money and omits a missing charge rather than printing $0', () => {
    const d = buildPoDocument(po, vendor, items);
    expect(d.totals).toEqual([
      ['Subtotal', 200],
      ['Tax', 16],
      ['Total', 216],
    ]);
    expect(d.lines[0]).toEqual({
      description: 'Black toner',
      partNumber: 'TN-1',
      quantity: 4,
      unitPrice: 50,
      total: 200,
    });
    expect(d.vendorLines).toEqual(['Toner Co', 'Austin, TX, 78701', 'a@t.co']);
    expect(d.shipTo).toEqual(['1 Main St', 'Suite 4']);
    expect(d.notes).toBe('Deliver to the loading dock.');
    expect(d.watermark).toBeNull();
  });

  it('watermarks every order a vendor must not act on', () => {
    for (const [status, mark] of [
      ['draft', 'DRAFT'],
      ['pending_approval', 'NOT APPROVED'],
      ['rejected', 'REJECTED'],
      ['cancelled', 'CANCELLED'],
    ]) {
      expect(buildPoDocument({ ...po, status }, vendor, items).watermark).toBe(mark);
    }
    expect(buildPoDocument({ ...po, status: null }, vendor, items).watermark).toBe('DRAFT');
    for (const status of ['approved', 'ordered', 'received']) {
      expect(buildPoDocument({ ...po, status }, vendor, items).watermark).toBeNull();
    }
  });

  it('derives a missing total from the lines and says when no vendor is set', () => {
    const d = buildPoDocument(
      { ...po, subtotal: null, total_amount: null, tax_amount: null },
      null,
      [{ item_description: '', part_number: 'X-1', quantity: 2, unit_price: 3, total_price: null }],
    );
    expect(d.lines[0].description).toBe('X-1');
    expect(d.totals).toEqual([
      ['Subtotal', 6],
      ['Total', 6],
    ]);
    expect(d.vendorLines).toEqual(['Vendor not set']);
  });
});

describe('purchase-orders edge function', () => {
  const branch = (marker: string) => {
    const at = SRC.indexOf(marker);
    expect(at).toBeGreaterThan(-1);
    return SRC.slice(at, SRC.indexOf('    if (req.method', at + marker.length));
  };

  it('serves GET /:id/pdf as a PDF, scoped like the list', () => {
    const b = branch("if (req.method === 'GET' && poId && subResource === 'pdf') {");
    expect(b).toMatch(/!rowInScope\(po, 'created_by', poScope\)[\s\S]{0,120}404/);
    expect(b).toContain("'Content-Type': 'application/pdf'");
    expect(b).toMatch(/renderPurchaseOrderPDF\(\s*buildPoDocument\(/);
  });

  it('scopes the detail and line-item reads, answering 404 out of scope', () => {
    const detail = branch("if (req.method === 'GET' && poId && !subResource) {");
    expect(detail).toMatch(
      /if \(!rowInScope\(po, 'created_by', poScope\)\) \{\s*return createCorsResponse\(\{ error: 'Purchase order not found' \}, 404/,
    );
    const lines = branch(
      "if (req.method === 'GET' && poId && subResource === 'line-items' && !subResourceId) {",
    );
    expect(lines).toContain(".select('id, created_by')");
    expect(lines).toContain("!rowInScope(po, 'created_by', poScope)");
  });
});

describe('PurchaseOrders page', () => {
  it('downloads the PDF with auth and reports a failure', () => {
    const page = readFileSync('client/src/pages/PurchaseOrders.tsx', 'utf8');
    expect(page).toMatch(
      /await downloadAuthedFile\(\s*`\/api\/purchase-orders\/\$\{selectedPO\.id\}\/pdf`/,
    );
    expect(page).toMatch(/title: 'Could not export the PDF'/);
  });
});
