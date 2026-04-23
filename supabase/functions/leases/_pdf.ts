// Lease PDF renderer — Deno / edge-function compatible.
//
// Per Phase 4 leases PRD §4: pdf-lib via esm.sh replaces the Node-only
// puppeteer+handlebars / pdfkit services. Layout is manual rectangles/strings
// (pdf-lib has no HTML→PDF). Structure:
//
//   1. Blue header band — lease_number, lease_name, generation date
//   2. Two-column party info — customer (lessee) | lessor
//   3. Terms table — lease_type, term months, monthly_payment, total, start/end
//   4. Payment schedule table — can span multiple pages
//   5. Signature blocks — two signature fields (lessee + lessor)
//
// Field positions for signature blocks are deterministic (x coords hardcoded)
// so Phase 4 US-019 (signatures) can place e-signature placeholders reliably.

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';

// US Letter in pdf-lib's default units (1 pt = 1/72 inch)
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 50;
const MARGIN_Y = 50;

const HEADER_BG = rgb(0.118, 0.227, 0.541); // #1e3a8a
const HEADER_TEXT = rgb(1, 1, 1);
const BODY_TEXT = rgb(0.2, 0.2, 0.2);
const LINE_GRAY = rgb(0.9, 0.9, 0.9);
const TABLE_HEADER_BG = rgb(0.953, 0.957, 0.965);

export interface LeaseForPdf {
  id: string;
  lease_number?: string | null;
  lease_name?: string | null;
  customer_id?: string | null;
  lease_type?: string | null;
  status?: string | null;
  total_amount?: string | number | null;
  monthly_payment?: string | number | null;
  term?: number | null;
  interest_rate?: string | number | null;
  start_date?: string | null;
  end_date?: string | null;
  first_payment_date?: string | null;
  last_payment_date?: string | null;
  lessor_name?: string | null;
  lessor_contact_name?: string | null;
  lessor_contact_email?: string | null;
  lessor_contact_phone?: string | null;
  special_terms?: string | null;
  notes?: string | null;
}

export interface PaymentForPdf {
  payment_number?: number | null;
  scheduled_date?: string | null;
  scheduled_amount?: string | number | null;
  status?: string | null;
  paid_amount?: string | number | null;
  paid_date?: string | null;
}

export interface RenderLeasePDFInput {
  lease: LeaseForPdf;
  payments: PaymentForPdf[];
}

export async function renderLeasePDF(input: RenderLeasePDFInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const ctx: RenderCtx = { pdf, font, bold };
  let page = addPage(ctx);
  let y = PAGE_HEIGHT;

  // Header band
  y = drawHeader(page, ctx, input.lease);

  // Party info (lessee/lessor)
  y = drawPartyInfo(page, ctx, input.lease, y);

  // Terms
  y = drawTerms(page, ctx, input.lease, y);

  // Payment schedule table (page-breaks as needed)
  ({ page, y } = drawPaymentSchedule(ctx, page, input.payments, y));

  // Signature blocks
  ({ page, y } = drawSignatureBlocks(ctx, page, y));

  // Footer note (optional special terms)
  if (input.lease.special_terms) {
    y = drawSpecialTerms(page, ctx, String(input.lease.special_terms), y);
  }

  return await pdf.save();
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface RenderCtx {
  pdf: PDFDocument;
  font: PDFFont;
  bold: PDFFont;
}

function addPage(ctx: RenderCtx): PDFPage {
  return ctx.pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
}

function ensureSpace(
  ctx: RenderCtx,
  currentPage: PDFPage,
  currentY: number,
  needed: number,
): { page: PDFPage; y: number } {
  if (currentY - needed < MARGIN_Y) {
    const newPage = addPage(ctx);
    return { page: newPage, y: PAGE_HEIGHT - MARGIN_Y };
  }
  return { page: currentPage, y: currentY };
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function drawHeader(page: PDFPage, ctx: RenderCtx, lease: LeaseForPdf): number {
  const H = 72;
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - H,
    width: PAGE_WIDTH,
    height: H,
    color: HEADER_BG,
  });
  page.drawText('Equipment Lease Agreement', {
    x: MARGIN_X,
    y: PAGE_HEIGHT - 30,
    size: 20,
    font: ctx.bold,
    color: HEADER_TEXT,
  });
  const sub = `Lease #${lease.lease_number ?? 'UNKNOWN'}${lease.lease_name ? ' — ' + lease.lease_name : ''}`;
  page.drawText(truncate(sub, 80), {
    x: MARGIN_X,
    y: PAGE_HEIGHT - 50,
    size: 10,
    font: ctx.font,
    color: HEADER_TEXT,
  });
  page.drawText(`Generated ${new Date().toLocaleDateString()}`, {
    x: MARGIN_X,
    y: PAGE_HEIGHT - 64,
    size: 9,
    font: ctx.font,
    color: HEADER_TEXT,
  });
  return PAGE_HEIGHT - H - 24;
}

function drawPartyInfo(page: PDFPage, ctx: RenderCtx, lease: LeaseForPdf, yStart: number): number {
  const colW = (PAGE_WIDTH - MARGIN_X * 2) / 2;
  const leftX = MARGIN_X;
  const rightX = MARGIN_X + colW + 8;

  drawSectionHeader(page, ctx.bold, 'Lessee (Customer)', leftX, yStart);
  drawSectionHeader(page, ctx.bold, 'Lessor', rightX, yStart);

  let leftY = yStart - 18;
  let rightY = yStart - 18;

  drawInfoRow(page, ctx, 'Customer ID', lease.customer_id ?? '—', leftX, leftY);
  leftY -= 14;
  drawInfoRow(page, ctx, 'Name', lease.lessor_name ?? '—', rightX, rightY);
  rightY -= 14;
  if (lease.lessor_contact_name) {
    drawInfoRow(page, ctx, 'Contact', lease.lessor_contact_name, rightX, rightY);
    rightY -= 14;
  }
  if (lease.lessor_contact_email) {
    drawInfoRow(page, ctx, 'Email', lease.lessor_contact_email, rightX, rightY);
    rightY -= 14;
  }
  if (lease.lessor_contact_phone) {
    drawInfoRow(page, ctx, 'Phone', lease.lessor_contact_phone, rightX, rightY);
    rightY -= 14;
  }

  return Math.min(leftY, rightY) - 16;
}

function drawTerms(page: PDFPage, ctx: RenderCtx, lease: LeaseForPdf, yStart: number): number {
  page.drawText('Lease Terms', {
    x: MARGIN_X,
    y: yStart,
    size: 12,
    font: ctx.bold,
    color: BODY_TEXT,
  });
  let y = yStart - 16;

  const rows: Array<[string, string]> = [
    ['Lease Type', String(lease.lease_type ?? '—').toUpperCase()],
    ['Status', String(lease.status ?? '—')],
    ['Term (months)', String(lease.term ?? '—')],
    ['Total Amount', money(lease.total_amount)],
    ['Monthly Payment', money(lease.monthly_payment)],
    [
      'Interest Rate',
      lease.interest_rate !== null && lease.interest_rate !== undefined
        ? `${Number(lease.interest_rate).toFixed(2)}%`
        : '—',
    ],
    ['Start Date', fmtDate(lease.start_date)],
    ['End Date', fmtDate(lease.end_date)],
    ['First Payment', fmtDate(lease.first_payment_date)],
    ['Last Payment', fmtDate(lease.last_payment_date)],
  ];

  const labelW = 140;
  for (const [k, v] of rows) {
    page.drawText(`${k}:`, { x: MARGIN_X, y, size: 9, font: ctx.bold, color: BODY_TEXT });
    page.drawText(truncate(v, 50), {
      x: MARGIN_X + labelW,
      y,
      size: 9,
      font: ctx.font,
      color: BODY_TEXT,
    });
    y -= 13;
  }
  return y - 12;
}

function drawPaymentSchedule(
  ctx: RenderCtx,
  page: PDFPage,
  payments: PaymentForPdf[],
  yStart: number,
): { page: PDFPage; y: number } {
  let current = ensureSpace(ctx, page, yStart, 60);
  let currentPage = current.page;
  let y = current.y;

  currentPage.drawText('Payment Schedule', {
    x: MARGIN_X,
    y,
    size: 12,
    font: ctx.bold,
    color: BODY_TEXT,
  });
  y -= 14;

  const usableWidth = PAGE_WIDTH - MARGIN_X * 2;
  const cols = [
    { label: '#', width: usableWidth * 0.08, align: 'right' as const },
    { label: 'Scheduled Date', width: usableWidth * 0.24, align: 'left' as const },
    { label: 'Amount', width: usableWidth * 0.18, align: 'right' as const },
    { label: 'Status', width: usableWidth * 0.2, align: 'left' as const },
    { label: 'Paid Amount', width: usableWidth * 0.15, align: 'right' as const },
    { label: 'Paid Date', width: usableWidth * 0.15, align: 'left' as const },
  ];
  const rowH = 14;

  // Header row
  currentPage.drawRectangle({
    x: MARGIN_X,
    y: y - rowH,
    width: usableWidth,
    height: rowH,
    color: TABLE_HEADER_BG,
  });
  drawTableHeaderRow(currentPage, ctx.bold, cols, y - rowH);
  y -= rowH;

  for (const p of payments) {
    if (y - rowH < MARGIN_Y + 140) {
      // reserve ~140pt for signature blocks on last page
      currentPage = addPage(ctx);
      y = PAGE_HEIGHT - MARGIN_Y;
      currentPage.drawRectangle({
        x: MARGIN_X,
        y: y - rowH,
        width: usableWidth,
        height: rowH,
        color: TABLE_HEADER_BG,
      });
      drawTableHeaderRow(currentPage, ctx.bold, cols, y - rowH);
      y -= rowH;
    }

    currentPage.drawLine({
      start: { x: MARGIN_X, y: y - rowH },
      end: { x: MARGIN_X + usableWidth, y: y - rowH },
      thickness: 0.5,
      color: LINE_GRAY,
    });

    const cells = [
      String(p.payment_number ?? ''),
      fmtDate(p.scheduled_date),
      money(p.scheduled_amount),
      String(p.status ?? 'scheduled'),
      p.paid_amount !== null && p.paid_amount !== undefined ? money(p.paid_amount) : '—',
      p.paid_date ? fmtDate(p.paid_date) : '—',
    ];
    let colX = MARGIN_X;
    for (let i = 0; i < cols.length; i++) {
      drawAligned(
        currentPage,
        ctx.font,
        cells[i],
        9,
        colX + 4,
        y - rowH + 4,
        cols[i].width - 8,
        cols[i].align,
      );
      colX += cols[i].width;
    }
    y -= rowH;
  }

  return { page: currentPage, y: y - 12 };
}

function drawTableHeaderRow(
  page: PDFPage,
  bold: PDFFont,
  cols: Array<{ label: string; width: number; align: 'left' | 'right' | 'center' }>,
  yBase: number,
) {
  let colX = MARGIN_X;
  for (const col of cols) {
    drawAligned(page, bold, col.label, 9, colX + 4, yBase + 4, col.width - 8, col.align);
    colX += col.width;
  }
}

function drawSignatureBlocks(
  ctx: RenderCtx,
  page: PDFPage,
  yStart: number,
): { page: PDFPage; y: number } {
  const current = ensureSpace(ctx, page, yStart, 130);
  const p = current.page;
  let y = current.y;

  p.drawText('Signatures', {
    x: MARGIN_X,
    y,
    size: 12,
    font: ctx.bold,
    color: BODY_TEXT,
  });
  y -= 20;

  const colW = (PAGE_WIDTH - MARGIN_X * 2) / 2;
  const leftX = MARGIN_X;
  const rightX = MARGIN_X + colW + 8;

  drawSignatureBlock(p, ctx, 'Lessee (Customer)', leftX, y);
  drawSignatureBlock(p, ctx, 'Lessor', rightX, y);

  return { page: p, y: y - 110 };
}

function drawSignatureBlock(page: PDFPage, ctx: RenderCtx, label: string, x: number, yTop: number) {
  page.drawText(label, { x, y: yTop, size: 10, font: ctx.bold, color: BODY_TEXT });
  // Signature line
  page.drawLine({
    start: { x, y: yTop - 40 },
    end: { x: x + 220, y: yTop - 40 },
    thickness: 1,
    color: BODY_TEXT,
  });
  page.drawText('Signature', {
    x,
    y: yTop - 54,
    size: 8,
    font: ctx.font,
    color: BODY_TEXT,
  });
  // Date line
  page.drawLine({
    start: { x, y: yTop - 78 },
    end: { x: x + 220, y: yTop - 78 },
    thickness: 1,
    color: BODY_TEXT,
  });
  page.drawText('Date', {
    x,
    y: yTop - 92,
    size: 8,
    font: ctx.font,
    color: BODY_TEXT,
  });
}

function drawSpecialTerms(page: PDFPage, ctx: RenderCtx, terms: string, yStart: number): number {
  if (yStart < MARGIN_Y + 60) return yStart; // skip if nowhere to put it
  page.drawText('Special Terms', {
    x: MARGIN_X,
    y: yStart,
    size: 10,
    font: ctx.bold,
    color: BODY_TEXT,
  });
  const wrapped = wrap(terms, 100);
  let y = yStart - 14;
  for (const line of wrapped.slice(0, 6)) {
    page.drawText(line, { x: MARGIN_X, y, size: 9, font: ctx.font, color: BODY_TEXT });
    y -= 12;
  }
  return y;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function money(n: string | number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  const v = typeof n === 'number' ? n : parseFloat(n);
  if (!Number.isFinite(v)) return '—';
  return `$${v.toFixed(2)}`;
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(s);
  return d.toLocaleDateString();
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function wrap(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      if ((line + ' ' + word).trim().length > maxChars) {
        if (line) lines.push(line.trim());
        line = word;
      } else {
        line = line ? line + ' ' + word : word;
      }
    }
    if (line) lines.push(line.trim());
  }
  return lines;
}

function drawSectionHeader(page: PDFPage, bold: PDFFont, text: string, x: number, y: number) {
  page.drawText(text, {
    x,
    y,
    size: 11,
    font: bold,
    color: rgb(0.118, 0.227, 0.541),
  });
  page.drawLine({
    start: { x, y: y - 3 },
    end: { x: x + 220, y: y - 3 },
    thickness: 1,
    color: LINE_GRAY,
  });
}

function drawInfoRow(
  page: PDFPage,
  ctx: RenderCtx,
  label: string,
  value: string,
  x: number,
  y: number,
) {
  page.drawText(`${label}:`, { x, y, size: 9, font: ctx.bold, color: BODY_TEXT });
  page.drawText(truncate(value, 40), {
    x: x + 80,
    y,
    size: 9,
    font: ctx.font,
    color: BODY_TEXT,
  });
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
