// Proposal PDF renderer — Deno / edge-function compatible.
//
// Uses pdf-lib (via esm.sh) instead of puppeteer+handlebars, per the Phase 4
// leases PRD decision. Output is visually comparable to the deleted Express
// template: blue header band → two-column info → line items table → totals →
// optional manager-mode cost/margin notice.
//
// Intentional simplifications vs Express:
//   - Cost/margin for manager-mode reads `unit_cost` directly from
//     `proposal_line_items`. The deleted Express path pulled from 6 product
//     tables by item_type+pricingType — unnecessary, since line items store
//     the snapshot at creation time.
//   - Layout is manual rectangles/strings (pdf-lib has no HTML->PDF). Fine
//     for tabular documents; if per-tenant branded templates become a thing,
//     revisit Browserless per leases PRD §4.

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 36;
const MARGIN_Y = 36;
const HEADER_BG = rgb(0.118, 0.227, 0.541); // #1e3a8a
const HEADER_TEXT = rgb(1, 1, 1);
const LINE_GRAY = rgb(0.9, 0.9, 0.9);
const TABLE_HEADER_BG = rgb(0.953, 0.957, 0.965); // #f3f4f6
const BODY_TEXT = rgb(0.2, 0.2, 0.2);
const MANAGER_NOTE_BG = rgb(1, 0.953, 0.78); // #fef3c7
const MANAGER_NOTE_BORDER = rgb(0.961, 0.62, 0.043); // #f59e0b
const MANAGER_NOTE_TEXT = rgb(0.573, 0.251, 0.055); // #92400e

interface Proposal {
  id: string;
  proposal_number: string;
  title: string;
  status: string | null;
  valid_until: string | null;
  created_at: string | null;
  tax_amount: string | number | null;
  discount_amount: string | number | null;
}

interface LineItem {
  line_number: number | null;
  product_name: string;
  description: string | null;
  quantity: number | null;
  unit_price: string | number | null;
  unit_cost: string | number | null;
}

interface Company {
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

interface Contact {
  first_name?: string | null;
  last_name?: string | null;
}

export interface RenderPDFInput {
  proposal: Proposal;
  lineItems: LineItem[];
  company: Company | null;
  contact: Contact | null;
  isManager: boolean;
}

export async function renderProposalPDF(input: RenderPDFInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT;

  // ─── Header band ────────────────────────────────────────────────────────────
  const headerHeight = 70;
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - headerHeight,
    width: PAGE_WIDTH,
    height: headerHeight,
    color: HEADER_BG,
  });

  const title = input.proposal.title || 'Quote';
  page.drawText(title, {
    x: MARGIN_X,
    y: PAGE_HEIGHT - 32,
    size: 20,
    font: bold,
    color: HEADER_TEXT,
  });
  const subtitle = `Quote #${input.proposal.proposal_number}${input.isManager ? '  —  MANAGER EXPORT' : ''}`;
  page.drawText(subtitle, {
    x: MARGIN_X,
    y: PAGE_HEIGHT - 50,
    size: 10,
    font,
    color: HEADER_TEXT,
  });
  page.drawText(`Generated ${new Date().toLocaleDateString()}`, {
    x: MARGIN_X,
    y: PAGE_HEIGHT - 63,
    size: 9,
    font,
    color: HEADER_TEXT,
  });

  y = PAGE_HEIGHT - headerHeight - 24;

  // ─── Two-column info (Quote Info | Customer Info) ───────────────────────────
  const colW = (PAGE_WIDTH - MARGIN_X * 2) / 2;
  const leftX = MARGIN_X;
  const rightX = MARGIN_X + colW + 8;
  const infoTop = y;
  const infoLines: Array<[string, string]> = [
    ['Status', input.proposal.status ?? 'draft'],
    [
      'Valid Until',
      input.proposal.valid_until
        ? new Date(input.proposal.valid_until).toLocaleDateString()
        : 'Not specified',
    ],
    [
      'Created',
      input.proposal.created_at ? new Date(input.proposal.created_at).toLocaleDateString() : '—',
    ],
  ];
  const companyName =
    input.company?.company_name ||
    [input.company?.first_name, input.company?.last_name].filter(Boolean).join(' ') ||
    'Customer';
  const contactName =
    input.contact && (input.contact.first_name || input.contact.last_name)
      ? [input.contact.first_name, input.contact.last_name].filter(Boolean).join(' ')
      : '';
  const custLines: Array<[string, string]> = [['Company', companyName]];
  if (contactName) custLines.push(['Contact', contactName]);
  if (input.company?.email) custLines.push(['Email', input.company.email]);
  if (input.company?.phone) custLines.push(['Phone', input.company.phone]);

  drawSectionHeader(page, bold, 'Quote Information', leftX, infoTop);
  drawSectionHeader(page, bold, 'Customer Information', rightX, infoTop);
  let leftY = infoTop - 18;
  let rightY = infoTop - 18;
  for (const [label, value] of infoLines) {
    drawInfoRow(page, font, bold, label, value, leftX, leftY, colW);
    leftY -= 14;
  }
  for (const [label, value] of custLines) {
    drawInfoRow(page, font, bold, label, value, rightX, rightY, colW);
    rightY -= 14;
  }
  y = Math.min(leftY, rightY) - 20;

  // ─── Line items table ───────────────────────────────────────────────────────
  page.drawText('Line Items', { x: MARGIN_X, y, size: 12, font: bold, color: BODY_TEXT });
  y -= 14;

  const usableWidth = PAGE_WIDTH - MARGIN_X * 2;
  const colsConsumer = [
    { label: 'Product', width: usableWidth * 0.28, align: 'left' as const },
    { label: 'Description', width: usableWidth * 0.32, align: 'left' as const },
    { label: 'Qty', width: usableWidth * 0.08, align: 'center' as const },
    { label: 'Unit Price', width: usableWidth * 0.16, align: 'right' as const },
    { label: 'Total', width: usableWidth * 0.16, align: 'right' as const },
  ];
  const colsManager = [
    { label: 'Product', width: usableWidth * 0.26, align: 'left' as const },
    { label: 'Qty', width: usableWidth * 0.08, align: 'center' as const },
    { label: 'Cost', width: usableWidth * 0.13, align: 'right' as const },
    { label: 'Unit Price', width: usableWidth * 0.14, align: 'right' as const },
    { label: 'Total Cost', width: usableWidth * 0.13, align: 'right' as const },
    { label: 'Total Price', width: usableWidth * 0.13, align: 'right' as const },
    { label: 'Margin', width: usableWidth * 0.13, align: 'right' as const },
  ];
  const cols = input.isManager ? colsManager : colsConsumer;

  // Table header row
  const rowH = 18;
  page.drawRectangle({
    x: MARGIN_X,
    y: y - rowH,
    width: usableWidth,
    height: rowH,
    color: TABLE_HEADER_BG,
  });
  let colX = MARGIN_X;
  for (const col of cols) {
    drawAligned(page, bold, col.label, 9, colX + 4, y - rowH + 5, col.width - 8, col.align);
    colX += col.width;
  }
  y -= rowH;

  // Body rows
  let subtotal = 0;
  for (const item of input.lineItems) {
    if (y < MARGIN_Y + 120) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN_Y;
    }
    const qty = Number(item.quantity ?? 1);
    const unitPrice = toNum(item.unit_price);
    const lineTotal = qty * unitPrice;
    subtotal += lineTotal;

    const cells = input.isManager
      ? [
          item.product_name,
          String(qty),
          money(toNum(item.unit_cost)),
          money(unitPrice),
          money(qty * toNum(item.unit_cost)),
          money(lineTotal),
          margin(unitPrice, toNum(item.unit_cost)),
        ]
      : [
          item.product_name,
          truncate(item.description ?? '', 60),
          String(qty),
          money(unitPrice),
          money(lineTotal),
        ];

    // bottom border
    page.drawLine({
      start: { x: MARGIN_X, y: y - rowH },
      end: { x: MARGIN_X + usableWidth, y: y - rowH },
      thickness: 0.5,
      color: LINE_GRAY,
    });
    colX = MARGIN_X;
    for (let i = 0; i < cols.length; i++) {
      drawAligned(
        page,
        font,
        cells[i],
        9,
        colX + 4,
        y - rowH + 5,
        cols[i].width - 8,
        cols[i].align,
      );
      colX += cols[i].width;
    }
    y -= rowH;
  }

  // ─── Totals block (right-aligned) ───────────────────────────────────────────
  y -= 14;
  const discount = toNum(input.proposal.discount_amount);
  const tax = toNum(input.proposal.tax_amount);
  const total = subtotal + tax - discount;
  const totalsX = PAGE_WIDTH - MARGIN_X - 220;
  const totalsW = 220;
  drawTotalRow(page, font, bold, 'Subtotal', money(subtotal), totalsX, y, totalsW, false);
  y -= 14;
  if (discount > 0) {
    drawTotalRow(page, font, bold, 'Discount', `-${money(discount)}`, totalsX, y, totalsW, false);
    y -= 14;
  }
  if (tax > 0) {
    drawTotalRow(page, font, bold, 'Tax', money(tax), totalsX, y, totalsW, false);
    y -= 14;
  }
  drawTotalRow(page, font, bold, 'Total', money(total), totalsX, y, totalsW, true);
  y -= 24;

  // ─── Manager export notice ──────────────────────────────────────────────────
  if (input.isManager) {
    if (y < MARGIN_Y + 80) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN_Y;
    }
    const noteH = 56;
    page.drawRectangle({
      x: MARGIN_X,
      y: y - noteH,
      width: usableWidth,
      height: noteH,
      color: MANAGER_NOTE_BG,
      borderColor: MANAGER_NOTE_BORDER,
      borderWidth: 1,
    });
    page.drawText('Manager Export Notice', {
      x: MARGIN_X + 10,
      y: y - 18,
      size: 11,
      font: bold,
      color: MANAGER_NOTE_TEXT,
    });
    page.drawText('Includes cost information and profit margins for management review.', {
      x: MARGIN_X + 10,
      y: y - 32,
      size: 9,
      font,
      color: MANAGER_NOTE_TEXT,
    });
    page.drawText('Confidential — do not share with customers.', {
      x: MARGIN_X + 10,
      y: y - 44,
      size: 9,
      font,
      color: MANAGER_NOTE_TEXT,
    });
  }

  return await pdf.save();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNum(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

function margin(unitPrice: number, unitCost: number): string {
  if (unitPrice <= 0) return '0.0%';
  return `${(((unitPrice - unitCost) / unitPrice) * 100).toFixed(1)}%`;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function drawSectionHeader(page: PDFPage, bold: PDFFont, text: string, x: number, y: number) {
  page.drawText(text, { x, y, size: 11, font: bold, color: rgb(0.118, 0.227, 0.541) });
  page.drawLine({
    start: { x, y: y - 3 },
    end: { x: x + 220, y: y - 3 },
    thickness: 1,
    color: LINE_GRAY,
  });
}

function drawInfoRow(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
) {
  page.drawText(`${label}:`, { x, y, size: 9, font: bold, color: BODY_TEXT });
  page.drawText(truncate(value, 40), {
    x: x + 70,
    y,
    size: 9,
    font,
    color: BODY_TEXT,
    maxWidth: width - 80,
  });
}

function drawTotalRow(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
  emphasis: boolean,
) {
  const f = emphasis ? bold : font;
  page.drawText(label, { x, y, size: 10, font: f, color: BODY_TEXT });
  const valueWidth = f.widthOfTextAtSize(value, 10);
  page.drawText(value, { x: x + width - valueWidth, y, size: 10, font: f, color: BODY_TEXT });
  if (emphasis) {
    page.drawLine({
      start: { x, y: y - 3 },
      end: { x: x + width, y: y - 3 },
      thickness: 1,
      color: BODY_TEXT,
    });
  }
}

function drawAligned(
  page: PDFPage,
  font: PDFFont,
  text: string,
  size: number,
  x: number,
  y: number,
  width: number,
  align: 'left' | 'center' | 'right',
) {
  const w = font.widthOfTextAtSize(text, size);
  let drawX = x;
  if (align === 'center') drawX = x + (width - w) / 2;
  if (align === 'right') drawX = x + width - w;
  page.drawText(text, { x: drawX, y, size, font, color: BODY_TEXT });
}
