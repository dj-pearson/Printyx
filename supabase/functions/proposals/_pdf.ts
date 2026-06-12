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

import {
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  RGB,
  StandardFonts,
  rgb,
} from 'https://esm.sh/pdf-lib@1.17.1';
import { renderSectionsToPdf, type FlowCtx } from './_html-to-pdf.ts';

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
  // QUOTE-016: justification recorded whenever any discount is set.
  discount_reason?: string | null;
  discount_reason_note?: string | null;
}

interface LineItem {
  line_number: number | null;
  product_name: string;
  description: string | null;
  quantity: number | null;
  unit_price: string | number | null;
  unit_cost: string | number | null;
  // QUOTE-016: dollar amount off the whole line; total_price is net of it.
  discount?: string | number | null;
  total_price?: string | number | null;
  // QUOTE-017: recurring/contract billing — money fields are per period.
  is_recurring?: boolean | null;
  recurring_frequency?: string | null;
  recurring_duration?: string | number | null;
}

// QUOTE-016 reason codes → display labels (manager PDF only).
const DISCOUNT_REASON_LABELS: Record<string, string> = {
  competitive_match: 'Competitive match',
  volume: 'Volume',
  promotion: 'Promotion',
  manager_approved: 'Manager approved',
  other: 'Other',
};

// QUOTE-017: billing-frequency labels (replicates shared/quote-math.ts
// FREQUENCY_LABELS — Deno can't import the Node module; keep in sync).
const FREQ_LABEL: Record<string, { adjective: string; per: string; short: string }> = {
  monthly: { adjective: 'Monthly', per: 'month', short: '/mo' },
  quarterly: { adjective: 'Quarterly', per: 'quarter', short: '/qtr' },
  annually: { adjective: 'Annual', per: 'year', short: '/yr' },
};
const FREQ_ORDER = ['monthly', 'quarterly', 'annually'];

function freqOf(item: LineItem): string {
  const f = String(item.recurring_frequency ?? '').toLowerCase();
  return FREQ_LABEL[f] ? f : 'monthly';
}

// "Monthly ×12" / "Monthly (ongoing)" — compact "/mo ×12" for the narrow
// manager-table column.
function billingLabel(item: LineItem, compact: boolean): string {
  const f = FREQ_LABEL[freqOf(item)];
  const dur = Math.floor(toNum(item.recurring_duration));
  if (compact) return dur > 0 ? `${f.short} x${dur}` : f.short;
  return dur > 0 ? `${f.adjective} x${dur}` : `${f.adjective} (ongoing)`;
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

// PROP-007: dealer branding applied to the document.
export interface PdfBranding {
  companyName?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface PdfSection {
  section_title?: string | null;
  html_content?: string | null;
}

export interface RenderPDFInput {
  proposal: Proposal;
  lineItems: LineItem[];
  company: Company | null;
  contact: Contact | null;
  isManager: boolean;
  // PROP-007: when present (customer PDF), sections are rendered via the merge
  // output instead of the structured line-item layout. Manager PDF always uses
  // the structured cost/margin table. branding applies to both.
  branding?: PdfBranding | null;
  sections?: PdfSection[] | null;
}

export async function renderProposalPDF(input: RenderPDFInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // PROP-007: brand color + logo.
  const brandColor = parseHexColor(input.branding?.primaryColor) ?? HEADER_BG;
  const accentColor = parseHexColor(input.branding?.accentColor) ?? brandColor;
  const logo = await maybeEmbedLogo(pdf, input.branding?.logoUrl);

  const headerHeight = 70;
  const title = input.proposal.title || 'Quote';
  const subtitle = `Quote #${input.proposal.proposal_number}${input.isManager ? '  —  MANAGER EXPORT' : ''}`;

  // Full branded header band — page 1.
  const drawHeaderBand = (p: PDFPage) => {
    p.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - headerHeight,
      width: PAGE_WIDTH,
      height: headerHeight,
      color: brandColor,
    });
    // Logo top-right when available; title text on the left either way.
    if (logo) {
      const scale = Math.min(150 / logo.width, 40 / logo.height, 1);
      const lw = logo.width * scale;
      const lh = logo.height * scale;
      p.drawImage(logo, {
        x: PAGE_WIDTH - MARGIN_X - lw,
        y: PAGE_HEIGHT - headerHeight + (headerHeight - lh) / 2,
        width: lw,
        height: lh,
      });
    }
    p.drawText(title, {
      x: MARGIN_X,
      y: PAGE_HEIGHT - 32,
      size: 20,
      font: bold,
      color: HEADER_TEXT,
    });
    p.drawText(subtitle, { x: MARGIN_X, y: PAGE_HEIGHT - 50, size: 10, font, color: HEADER_TEXT });
    p.drawText(`Generated ${new Date().toLocaleDateString()}`, {
      x: MARGIN_X,
      y: PAGE_HEIGHT - 63,
      size: 9,
      font,
      color: HEADER_TEXT,
    });
  };

  // Thin brand bar for continuation pages.
  const drawContinuationBar = (p: PDFPage) => {
    p.drawRectangle({
      x: 0,
      y: PAGE_HEIGHT - 6,
      width: PAGE_WIDTH,
      height: 6,
      color: brandColor,
    });
  };

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT;
  drawHeaderBand(page);
  y = PAGE_HEIGHT - headerHeight - 24;

  // ─── PROP-007: render generated sections (customer PDF) when present ─────────
  const useSections =
    !input.isManager && Array.isArray(input.sections) && input.sections.length > 0;
  if (useSections) {
    const ctx: FlowCtx = {
      pdf,
      page,
      y,
      pageWidth: PAGE_WIDTH,
      pageHeight: PAGE_HEIGHT,
      marginX: MARGIN_X,
      marginTop: PAGE_HEIGHT - MARGIN_Y - 16,
      marginBottom: MARGIN_Y + 40,
      theme: {
        font,
        bold,
        bodyColor: BODY_TEXT,
        accentColor,
        lineColor: LINE_GRAY,
        tableHeaderBg: TABLE_HEADER_BG,
      },
      onNewPage: drawContinuationBar,
    };
    await renderSectionsToPdf(
      ctx,
      input.sections!.map((s) => ({ title: s.section_title ?? '', html: s.html_content ?? '' })),
    );
    drawFooterOnAllPages(pdf, font, input.branding ?? null);
    return await pdf.save();
  }

  // ─── Structured layout (manager PDF, or customer PDF with no sections) ───────

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

  // ─── Line items table(s) ─────────────────────────────────────────────────
  // QUOTE-017: recurring lines render in a separate section with billing
  // (frequency × periods) labels. With no recurring lines the layout stays the
  // single classic "Line Items" table.
  const oneTimeItems = input.lineItems.filter((it) => it.is_recurring !== true);
  const recurringItems = input.lineItems.filter((it) => it.is_recurring === true);
  const hasRecurring = recurringItems.length > 0;
  const groups: Array<{ title: string; items: LineItem[]; recurring: boolean }> = hasRecurring
    ? [
        { title: 'One-Time Items', items: oneTimeItems, recurring: false },
        { title: 'Recurring Charges', items: recurringItems, recurring: true },
      ].filter((g) => g.items.length > 0)
    : [{ title: 'Line Items', items: input.lineItems, recurring: false }];

  const usableWidth = PAGE_WIDTH - MARGIN_X * 2;
  const colsConsumer = [
    { label: 'Product', width: usableWidth * 0.28, align: 'left' as const },
    { label: 'Description', width: usableWidth * 0.32, align: 'left' as const },
    { label: 'Qty', width: usableWidth * 0.08, align: 'center' as const },
    { label: 'Unit Price', width: usableWidth * 0.16, align: 'right' as const },
    { label: 'Total', width: usableWidth * 0.16, align: 'right' as const },
  ];
  // Recurring section: Description shrinks to fit a Billing column; the line
  // total is the per-period amount.
  const colsConsumerRecurring = [
    { label: 'Product', width: usableWidth * 0.26, align: 'left' as const },
    { label: 'Description', width: usableWidth * 0.22, align: 'left' as const },
    { label: 'Billing', width: usableWidth * 0.14, align: 'left' as const },
    { label: 'Qty', width: usableWidth * 0.07, align: 'center' as const },
    { label: 'Unit Price', width: usableWidth * 0.15, align: 'right' as const },
    { label: 'Per Period', width: usableWidth * 0.16, align: 'right' as const },
  ];
  const colsManager = [
    { label: 'Product', width: usableWidth * 0.22, align: 'left' as const },
    { label: 'Qty', width: usableWidth * 0.07, align: 'center' as const },
    { label: 'Cost', width: usableWidth * 0.11, align: 'right' as const },
    { label: 'Unit Price', width: usableWidth * 0.12, align: 'right' as const },
    { label: 'Disc.', width: usableWidth * 0.1, align: 'right' as const },
    { label: 'Total Cost', width: usableWidth * 0.12, align: 'right' as const },
    { label: 'Total Price', width: usableWidth * 0.13, align: 'right' as const },
    { label: 'Margin', width: usableWidth * 0.13, align: 'right' as const },
  ];
  const colsManagerRecurring = [
    { label: 'Product', width: usableWidth * 0.16, align: 'left' as const },
    { label: 'Billing', width: usableWidth * 0.1, align: 'left' as const },
    { label: 'Qty', width: usableWidth * 0.06, align: 'center' as const },
    { label: 'Cost', width: usableWidth * 0.1, align: 'right' as const },
    { label: 'Unit Price', width: usableWidth * 0.11, align: 'right' as const },
    { label: 'Disc.', width: usableWidth * 0.09, align: 'right' as const },
    { label: 'Total Cost', width: usableWidth * 0.12, align: 'right' as const },
    { label: 'Per Period', width: usableWidth * 0.13, align: 'right' as const },
    { label: 'Margin', width: usableWidth * 0.13, align: 'right' as const },
  ];

  const rowH = 18;
  // Bucket rollups (QUOTE-017): one-time subtotal/cost, recurring per frequency.
  let oneTimeSubtotal = 0;
  let oneTimeCost = 0;
  const recurringByFreq = new Map<string, { revenue: number; cost: number }>();

  for (const group of groups) {
    const cols = input.isManager
      ? group.recurring
        ? colsManagerRecurring
        : colsManager
      : group.recurring
        ? colsConsumerRecurring
        : colsConsumer;

    if (y < MARGIN_Y + 140) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN_Y;
    }
    page.drawText(group.title, { x: MARGIN_X, y, size: 12, font: bold, color: BODY_TEXT });
    y -= 14;

    // Table header row
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
    for (const item of group.items) {
      if (y < MARGIN_Y + 120) {
        page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = PAGE_HEIGHT - MARGIN_Y;
      }
      const qty = Number(item.quantity ?? 1) || 1;
      const unitPrice = toNum(item.unit_price);
      // QUOTE-016: line totals are net of the per-line discount. Prefer the
      // stored total_price (already net); fall back to recomputing.
      const lineDiscount = toNum(item.discount);
      const lineTotal =
        item.total_price !== null && item.total_price !== undefined && item.total_price !== ''
          ? toNum(item.total_price)
          : Math.max(0, qty * unitPrice - lineDiscount);
      // Customer PDF shows discounted prices ONLY — the effective unit price,
      // never the discount itself. Manager PDF gets the explicit Disc. column.
      const effectiveUnitPrice = qty > 0 ? lineTotal / qty : unitPrice;
      const lineCost = qty * toNum(item.unit_cost);
      const netMargin =
        lineTotal > 0 ? `${(((lineTotal - lineCost) / lineTotal) * 100).toFixed(1)}%` : '0.0%';

      if (group.recurring) {
        const f = freqOf(item);
        const t = recurringByFreq.get(f) ?? { revenue: 0, cost: 0 };
        t.revenue += lineTotal;
        t.cost += lineCost;
        recurringByFreq.set(f, t);
      } else {
        oneTimeSubtotal += lineTotal;
        oneTimeCost += lineCost;
      }

      const cells = input.isManager
        ? group.recurring
          ? [
              truncate(item.product_name, 22),
              billingLabel(item, true),
              String(qty),
              money(toNum(item.unit_cost)),
              money(unitPrice),
              lineDiscount > 0 ? `-${money(lineDiscount)}` : '—',
              money(lineCost),
              money(lineTotal),
              netMargin,
            ]
          : [
              item.product_name,
              String(qty),
              money(toNum(item.unit_cost)),
              money(unitPrice),
              lineDiscount > 0 ? `-${money(lineDiscount)}` : '—',
              money(lineCost),
              money(lineTotal),
              netMargin,
            ]
        : group.recurring
          ? [
              item.product_name,
              truncate(item.description ?? '', 40),
              billingLabel(item, false),
              String(qty),
              money(effectiveUnitPrice),
              money(lineTotal),
            ]
          : [
              item.product_name,
              truncate(item.description ?? '', 60),
              String(qty),
              money(effectiveUnitPrice),
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
    y -= 10; // gap between groups
  }

  // ─── Totals block (right-aligned) ───────────────────────────────────────────
  y -= 4;
  const discount = toNum(input.proposal.discount_amount);
  const tax = toNum(input.proposal.tax_amount);
  const totalsX = PAGE_WIDTH - MARGIN_X - 220;
  const totalsW = 220;
  if (y < MARGIN_Y + 140) {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN_Y;
  }
  const orderedRecurring = FREQ_ORDER.filter((f) => recurringByFreq.has(f)).map(
    (f) => [f, recurringByFreq.get(f)!] as const,
  );
  if (hasRecurring) {
    // QUOTE-017 split totals: the quote-level discount applies to the ONE-TIME
    // bucket only (rule documented in shared/quote-math.ts); recurring totals
    // are per billing period and never reduced by it.
    drawTotalRow(
      page,
      font,
      bold,
      'One-time subtotal',
      money(oneTimeSubtotal),
      totalsX,
      y,
      totalsW,
      false,
    );
    y -= 14;
    if (discount > 0) {
      drawTotalRow(page, font, bold, 'Discount', `-${money(discount)}`, totalsX, y, totalsW, false);
      y -= 14;
    }
    if (tax > 0) {
      drawTotalRow(page, font, bold, 'Tax', money(tax), totalsX, y, totalsW, false);
      y -= 14;
    }
    drawTotalRow(
      page,
      font,
      bold,
      'One-time total',
      money(oneTimeSubtotal - discount + tax),
      totalsX,
      y,
      totalsW,
      true,
    );
    y -= 16;
    for (const [f, t] of orderedRecurring) {
      drawTotalRow(
        page,
        font,
        bold,
        `Recurring (per ${FREQ_LABEL[f].per})`,
        money(t.revenue),
        totalsX,
        y,
        totalsW,
        true,
      );
      y -= 16;
    }
    y -= 8;
  } else {
    const subtotal = oneTimeSubtotal;
    const total = subtotal + tax - discount;
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
  }

  // QUOTE-017: manager PDF gets per-bucket cost/margin. Never on the customer PDF.
  if (input.isManager && hasRecurring) {
    if (y < MARGIN_Y + 110) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN_Y;
    }
    page.drawText('Bucket Cost & Margin', {
      x: MARGIN_X,
      y,
      size: 11,
      font: bold,
      color: BODY_TEXT,
    });
    y -= 14;
    const oneTimeRevenue = oneTimeSubtotal - discount;
    const bucketLines = [
      `One-time: revenue ${money(oneTimeRevenue)} - cost ${money(oneTimeCost)} - margin ${pct(oneTimeRevenue, oneTimeCost)}`,
      ...orderedRecurring.map(
        ([f, t]) =>
          `${FREQ_LABEL[f].adjective} (per ${FREQ_LABEL[f].per}): revenue ${money(t.revenue)} - cost ${money(t.cost)} - margin ${pct(t.revenue, t.cost)}`,
      ),
    ];
    for (const line of bucketLines) {
      page.drawText(line, { x: MARGIN_X, y, size: 9, font, color: BODY_TEXT });
      y -= 13;
    }
    page.drawText(
      'Guardrail margin is evaluated across both buckets combined (one period of each recurring line).',
      { x: MARGIN_X, y, size: 8, font, color: rgb(0.45, 0.45, 0.45) },
    );
    y -= 16;
  }

  // QUOTE-016: manager PDF surfaces the recorded discount justification.
  // Never shown on the customer PDF.
  if (input.isManager && input.proposal.discount_reason) {
    const reasonLabel =
      DISCOUNT_REASON_LABELS[input.proposal.discount_reason] ?? input.proposal.discount_reason;
    const note = (input.proposal.discount_reason_note ?? '').replace(/\s+/g, ' ').trim();
    const reasonText = `Discount reason: ${reasonLabel}${note ? ` — ${truncate(note, 140)}` : ''}`;
    if (y < MARGIN_Y + 90) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN_Y;
    }
    page.drawText(reasonText, { x: MARGIN_X, y, size: 9, font, color: BODY_TEXT });
    y -= 16;
  }

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

  drawFooterOnAllPages(pdf, font, input.branding ?? null);
  return await pdf.save();
}

// ─── PROP-007 branding helpers ──────────────────────────────────────────────────

function parseHexColor(hex: string | null | undefined): RGB | null {
  if (!hex) return null;
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  return rgb(((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255);
}

async function maybeEmbedLogo(
  pdf: PDFDocument,
  url: string | null | undefined,
): Promise<PDFImage | null> {
  if (!url) return null;
  try {
    if (/^data:image\/svg|\.svg(\?|$)/i.test(url)) return null; // pdf-lib can't embed SVG
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const ct = res.headers.get('content-type') ?? '';
    if (ct.includes('png') || /\.png(\?|$)/i.test(url)) return await pdf.embedPng(bytes);
    if (ct.includes('jpeg') || ct.includes('jpg') || /\.jpe?g(\?|$)/i.test(url))
      return await pdf.embedJpg(bytes);
    return null;
  } catch {
    return null; // branding is best-effort
  }
}

function drawFooterOnAllPages(pdf: PDFDocument, font: PDFFont, branding: PdfBranding | null) {
  const parts = [
    branding?.companyName,
    branding?.phone,
    branding?.email,
    branding?.address?.replace(/\s+/g, ' ').trim(),
  ].filter(Boolean) as string[];
  const footer = parts.join('  •  ');
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    if (footer) {
      const w = font.widthOfTextAtSize(footer, 7.5);
      p.drawText(footer.slice(0, 200), {
        x: Math.max(MARGIN_X, (PAGE_WIDTH - w) / 2),
        y: 18,
        size: 7.5,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });
    }
    const pageLabel = `Page ${i + 1} of ${pages.length}`;
    const plw = font.widthOfTextAtSize(pageLabel, 7.5);
    p.drawText(pageLabel, {
      x: PAGE_WIDTH - MARGIN_X - plw,
      y: 8,
      size: 7.5,
      font,
      color: rgb(0.6, 0.6, 0.6),
    });
  });
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

// QUOTE-017: bucket margin % on net revenue.
function pct(revenue: number, cost: number): string {
  return revenue > 0 ? `${(((revenue - cost) / revenue) * 100).toFixed(1)}%` : '0.0%';
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
