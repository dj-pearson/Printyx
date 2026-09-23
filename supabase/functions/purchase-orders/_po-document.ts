/**
 * What a purchase-order PDF says (round 210). Pure, so it is tested under
 * Node; _pdf.ts only draws it.
 *
 * The page's "Export PDF" button had no handler and no endpoint existed. A PO
 * is the document a vendor acts on, so the rules are about not printing
 * something the vendor could act on wrongly:
 *  - a DRAFT, pending, rejected or cancelled order is watermarked, because a
 *    vendor handed an unapproved PO has no way to tell it is one;
 *  - money comes from the stored columns, and a missing tax or shipping line
 *    is omitted rather than printed as $0.00, which reads as "none charged";
 *  - a line with no description still prints (the column is NOT NULL, so this
 *    only guards old rows) under its part number.
 */

type Row = Record<string, unknown>;

export interface PoDocument {
  title: string;
  watermark: string | null;
  meta: [string, string][];
  vendorLines: string[];
  shipTo: string[];
  lines: {
    description: string;
    partNumber: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  totals: [string, number][];
  notes: string | null;
}

export const UNAPPROVED_WATERMARKS: Record<string, string> = {
  draft: 'DRAFT',
  pending_approval: 'NOT APPROVED',
  rejected: 'REJECTED',
  cancelled: 'CANCELLED',
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
const date = (v: unknown) => {
  if (!v) return '-';
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? '-' : d.toISOString().slice(0, 10);
};

export function buildPoDocument(po: Row, vendor: Row | null, items: Row[]): PoDocument {
  const status = str(po.status).toLowerCase() || 'draft';
  const lines = items.map((it) => {
    const quantity = num(it.quantity) ?? 0;
    const unitPrice = num(it.unit_price) ?? 0;
    return {
      description: str(it.item_description) || str(it.part_number) || 'Item',
      partNumber: str(it.part_number) || str(it.item_code),
      quantity,
      unitPrice,
      total: num(it.total_price) ?? quantity * unitPrice,
    };
  });
  const subtotal = num(po.subtotal) ?? lines.reduce((s, l) => s + l.total, 0);
  const totals: [string, number][] = [['Subtotal', subtotal]];
  const tax = num(po.tax_amount);
  const shipping = num(po.shipping_amount);
  if (tax) totals.push(['Tax', tax]);
  if (shipping) totals.push(['Shipping', shipping]);
  totals.push(['Total', num(po.total_amount) ?? subtotal + (tax ?? 0) + (shipping ?? 0)]);

  const address = [
    str(vendor?.address_line_1),
    str(vendor?.address_line_2),
    [str(vendor?.city), str(vendor?.state), str(vendor?.zip_code)].filter(Boolean).join(', '),
  ].filter(Boolean);

  return {
    title: 'PURCHASE ORDER',
    watermark: UNAPPROVED_WATERMARKS[status] ?? null,
    meta: [
      ['PO #', str(po.po_number) || str(po.id)],
      ['Order date', date(po.order_date ?? po.created_at)],
      ['Expected', date(po.expected_date)],
      ['Status', status.replace(/_/g, ' ').toUpperCase()],
    ],
    vendorLines: [
      str(vendor?.vendor_name) || 'Vendor not set',
      str(vendor?.primary_contact_name),
      ...address,
      str(vendor?.email),
      str(vendor?.phone),
    ].filter(Boolean),
    shipTo: str(po.delivery_address)
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean),
    lines,
    totals,
    notes: str(po.special_instructions) || null,
  };
}
