// Invoice PDF renderer (EDGE-002a) — pdf-lib, same dependency pin as the
// proposals edge function. Replaces server/services/pdf-generation-service.ts
// for the /billing/invoices/:id/pdf and /:id/email paths.
//
// Layout: header band (Printyx + INVOICE), invoice meta (number/dates/terms),
// Bill To block, line-items table (falls back to a single summary line when
// the invoice has no invoice_line_items rows), totals block, and an optional
// diagonal watermark (DRAFT / PAID / OVERDUE).

import { PDFDocument, PDFPage, StandardFonts, degrees, rgb } from 'https://esm.sh/pdf-lib@1.17.1';

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

export interface InvoicePdfInput {
  invoice: Row;
  customer: Row | null;
  lineItems: Row[];
  watermark?: string;
}

const PAGE_W = 612; // US Letter
const PAGE_H = 792;
const MARGIN = 50;

const DARK = rgb(0.12, 0.16, 0.22);
const GRAY = rgb(0.42, 0.45, 0.5);
const LIGHT = rgb(0.88, 0.9, 0.92);

function money(v: unknown): string {
  const n = parseFloat(String(v ?? '0'));
  return `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}

function dateStr(v: unknown): string {
  if (!v) return '—';
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US');
}

export async function renderInvoicePDF(input: InvoicePdfInput): Promise<Uint8Array> {
  const { invoice, customer, lineItems, watermark } = input;

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([PAGE_W, PAGE_H]);

  const paintWatermark = (p: PDFPage) => {
    if (!watermark) return;
    p.drawText(watermark, {
      x: PAGE_W / 2 - bold.widthOfTextAtSize(watermark, 80) / 2.6,
      y: PAGE_H / 3,
      size: 80,
      font: bold,
      color: rgb(0.93, 0.93, 0.93),
      rotate: degrees(35),
    });
  };
  paintWatermark(page);

  // ── Header band ──────────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: PAGE_H - 90, width: PAGE_W, height: 90, color: DARK });
  page.drawText('Printyx', {
    x: MARGIN,
    y: PAGE_H - 55,
    size: 24,
    font: bold,
    color: rgb(1, 1, 1),
  });
  const title = 'INVOICE';
  page.drawText(title, {
    x: PAGE_W - MARGIN - bold.widthOfTextAtSize(title, 22),
    y: PAGE_H - 55,
    size: 22,
    font: bold,
    color: rgb(1, 1, 1),
  });

  let y = PAGE_H - 125;

  // ── Invoice meta (right) + Bill To (left) ────────────────────────────────
  const meta: Array<[string, string]> = [
    ['Invoice #', String(invoice.invoice_number ?? invoice.id ?? '')],
    ['Invoice Date', dateStr(invoice.invoice_date)],
    ['Due Date', dateStr(invoice.due_date)],
    ['Status', String(invoice.invoice_status ?? invoice.status ?? 'open').toUpperCase()],
    ...(invoice.payment_terms
      ? [['Terms', String(invoice.payment_terms)] as [string, string]]
      : []),
  ];
  const metaX = PAGE_W - MARGIN - 200;
  let metaY = y;
  for (const [label, value] of meta) {
    page.drawText(label, { x: metaX, y: metaY, size: 9, font: bold, color: GRAY });
    page.drawText(value, { x: metaX + 80, y: metaY, size: 9, font, color: DARK });
    metaY -= 15;
  }

  page.drawText('BILL TO', { x: MARGIN, y, size: 9, font: bold, color: GRAY });
  y -= 16;
  const billToLines = [
    customer?.company_name,
    customer?.primary_contact_name,
    customer?.primary_contact_email ?? customer?.email,
    customer?.phone,
  ].filter(Boolean) as string[];
  if (billToLines.length === 0) billToLines.push('Customer');
  for (const line of billToLines) {
    page.drawText(String(line).slice(0, 60), { x: MARGIN, y, size: 10, font, color: DARK });
    y -= 14;
  }

  y = Math.min(y, metaY) - 25;

  // ── Line items table ─────────────────────────────────────────────────────
  const cols = {
    desc: MARGIN,
    qty: PAGE_W - MARGIN - 220,
    unit: PAGE_W - MARGIN - 150,
    total: PAGE_W - MARGIN - 70,
  };

  const drawTableHeader = () => {
    page.drawRectangle({
      x: MARGIN - 5,
      y: y - 4,
      width: PAGE_W - 2 * MARGIN + 10,
      height: 18,
      color: LIGHT,
    });
    page.drawText('Description', { x: cols.desc, y, size: 9, font: bold, color: DARK });
    page.drawText('Qty', { x: cols.qty, y, size: 9, font: bold, color: DARK });
    page.drawText('Unit Price', { x: cols.unit, y, size: 9, font: bold, color: DARK });
    page.drawText('Amount', { x: cols.total, y, size: 9, font: bold, color: DARK });
    y -= 22;
  };
  drawTableHeader();

  const rows: Array<{ desc: string; qty: string; unit: string; total: string }> =
    lineItems.length > 0
      ? lineItems.map((li) => ({
          desc: String(li.line_description ?? 'Item'),
          qty: String(li.quantity ?? 1),
          unit: money(li.unit_price),
          total: money(li.extended_price ?? li.unit_price),
        }))
      : [
          {
            desc: String(invoice.invoice_notes ?? 'Services'),
            qty: '1',
            unit: money(invoice.total_amount),
            total: money(invoice.total_amount),
          },
        ];

  for (const row of rows) {
    if (y < 130) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      paintWatermark(page);
      y = PAGE_H - MARGIN;
      drawTableHeader();
    }
    // Wrap long descriptions to the qty column edge.
    const maxDescWidth = cols.qty - cols.desc - 10;
    const words = row.desc.split(/\s+/);
    let line = '';
    const descLines: string[] = [];
    for (const w of words) {
      const trial = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(trial, 9) > maxDescWidth && line) {
        descLines.push(line);
        line = w;
      } else {
        line = trial;
      }
    }
    if (line) descLines.push(line);

    page.drawText(descLines[0] ?? '', { x: cols.desc, y, size: 9, font, color: DARK });
    page.drawText(row.qty, { x: cols.qty, y, size: 9, font, color: DARK });
    page.drawText(row.unit, { x: cols.unit, y, size: 9, font, color: DARK });
    page.drawText(row.total, { x: cols.total, y, size: 9, font, color: DARK });
    y -= 13;
    for (const extra of descLines.slice(1, 4)) {
      page.drawText(extra, { x: cols.desc, y, size: 9, font, color: GRAY });
      y -= 13;
    }
    y -= 3;
  }

  // ── Totals block ─────────────────────────────────────────────────────────
  y -= 10;
  page.drawLine({
    start: { x: cols.unit - 30, y: y + 8 },
    end: { x: PAGE_W - MARGIN, y: y + 8 },
    thickness: 0.7,
    color: LIGHT,
  });

  const totals: Array<[string, string, boolean]> = [];
  if (invoice.subtotal_amount != null)
    totals.push(['Subtotal', money(invoice.subtotal_amount), false]);
  if (invoice.tax_amount != null) totals.push(['Tax', money(invoice.tax_amount), false]);
  totals.push(['Total', money(invoice.total_amount), true]);
  const paid = parseFloat(String(invoice.amount_paid ?? '0'));
  if (paid > 0) {
    totals.push(['Paid', money(invoice.amount_paid), false]);
    totals.push(['Balance Due', money(invoice.balance_due), true]);
  }

  for (const [label, value, emphasize] of totals) {
    const f = emphasize ? bold : font;
    const size = emphasize ? 11 : 10;
    page.drawText(label, { x: cols.unit - 30, y, size, font: f, color: DARK });
    page.drawText(value, {
      x: PAGE_W - MARGIN - f.widthOfTextAtSize(value, size),
      y,
      size,
      font: f,
      color: DARK,
    });
    y -= emphasize ? 18 : 15;
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  const footer = 'Thank you for your business — Printyx';
  page.drawText(footer, {
    x: PAGE_W / 2 - font.widthOfTextAtSize(footer, 8) / 2,
    y: 40,
    size: 8,
    font,
    color: GRAY,
  });

  return await pdf.save();
}
