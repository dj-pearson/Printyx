// Deno copy of shared/proposal-merge.ts (PROP-005).
//
// WHY A COPY: the edge image only ships `supabase/functions/` (see
// Dockerfile.edge-functions), so Deno functions cannot import the repo-root
// `shared/` module. This mirrors the established pattern where `_pdf.ts`
// replicates `shared/quote-math.ts` inline (see docs/quote-module-architecture.md).
//
// KEEP IN SYNC with shared/proposal-merge.ts. The Node canonical is unit-tested in
// server/tests/unit/proposal-merge.test.ts; this copy is intentionally identical
// except that MERGE_TOKENS is inlined (the Node version imports it).

export interface MergeLineItem {
  productName?: string | null;
  description?: string | null;
  quantity?: number | string | null;
  unitPrice?: number | string | null;
  totalPrice?: number | string | null;
  discount?: number | string | null;
  isRecurring?: boolean | null;
  recurringFrequency?: string | null;
}

export interface MergeQuote {
  number?: string | null;
  title?: string | null;
  validUntil?: string | Date | null;
  totalAmount?: number | string | null;
  oneTimeTotal?: number | string | null;
  recurringTotal?: number | string | null;
  lineItems?: MergeLineItem[] | null;
}

export interface MergeBranding {
  logoUrl?: string | null;
  companyName?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface MergeData {
  customer?: { name?: string | null; companyName?: string | null } | null;
  contact?: { name?: string | null } | null;
  quote?: MergeQuote | null;
  branding?: MergeBranding | null;
}

export interface MergeSection {
  id?: string;
  type?: string;
  title?: string;
  content?: string;
  isVisible?: boolean;
}

export interface MergeTemplate {
  sections?: MergeSection[];
  globalStyling?: Record<string, unknown>;
}

export interface RenderedSection {
  id: string;
  type: string;
  title: string;
  html: string;
}

export interface RenderResult {
  sections: RenderedSection[];
  html: string;
  warnings: string[];
}

// Inlined from shared/proposal-merge-fields.ts (MERGE_TOKENS).
const MERGE_TOKENS: string[] = [
  '{{customer.name}}',
  '{{customer.companyName}}',
  '{{contact.name}}',
  '{{quote.number}}',
  '{{quote.title}}',
  '{{quote.validUntil}}',
  '{{quote.lineItemsTable}}',
  '{{quote.oneTimeTotal}}',
  '{{quote.recurringTotal}}',
  '{{quote.totalAmount}}',
  '{{branding.logo}}',
  '{{branding.companyName}}',
  '{{branding.address}}',
  '{{branding.phone}}',
  '{{branding.email}}',
];

export function toNumber(v: number | string | null | undefined): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

const CURRENCY_FMT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(v: number | string | null | undefined): string {
  return CURRENCY_FMT.format(toNumber(v));
}

const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

export function formatDate(v: string | Date | null | undefined): string {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return '';
  return DATE_FMT.format(d);
}

const FREQUENCY_LABEL: Record<string, string> = {
  monthly: 'month',
  quarterly: 'quarter',
  annually: 'year',
  yearly: 'year',
};

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(url: unknown): string {
  const s = String(url ?? '').trim();
  if (!s) return '';
  if (/^\s*(javascript|vbscript):/i.test(s)) return '';
  return s.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function lineItemRow(item: MergeLineItem): string {
  const qty = toNumber(item.quantity ?? 1) || 1;
  const discount = toNumber(item.discount);
  const lineTotal =
    item.totalPrice !== undefined && item.totalPrice !== null && item.totalPrice !== ''
      ? toNumber(item.totalPrice)
      : qty * toNumber(item.unitPrice) - discount;
  const effectiveUnit = qty > 0 ? lineTotal / qty : toNumber(item.unitPrice);

  const name = escapeHtml(item.productName ?? '');
  const desc = item.description
    ? `<br><small style="color:#666;">${escapeHtml(item.description)}</small>`
    : '';

  return (
    `<tr style="border-bottom:1px solid #e5e7eb;">` +
    `<td style="padding:8px 0;"><strong>${name}</strong>${desc}</td>` +
    `<td style="text-align:center;padding:8px 0;">${qty}</td>` +
    `<td style="text-align:right;padding:8px 0;">${formatCurrency(effectiveUnit)}</td>` +
    `<td style="text-align:right;padding:8px 0;">${formatCurrency(lineTotal)}</td>` +
    `</tr>`
  );
}

function buildLineItemsTable(quote: MergeQuote | null | undefined): string {
  const items = quote?.lineItems ?? [];
  if (!items.length) return '';

  const oneTime = items.filter((i) => !i.isRecurring);
  const recurring = items.filter((i) => i.isRecurring);

  const header =
    `<thead><tr style="border-bottom:2px solid #d1d5db;">` +
    `<th style="text-align:left;padding:8px 0;">Item</th>` +
    `<th style="text-align:center;padding:8px 0;">Qty</th>` +
    `<th style="text-align:right;padding:8px 0;">Unit Price</th>` +
    `<th style="text-align:right;padding:8px 0;">Total</th>` +
    `</tr></thead>`;

  let html = '';

  const oneTimeRows = (oneTime.length ? oneTime : items).map(lineItemRow).join('');
  if (oneTime.length || !recurring.length) {
    const oneTimeTotal =
      quote?.oneTimeTotal !== undefined && quote?.oneTimeTotal !== null
        ? formatCurrency(quote.oneTimeTotal)
        : formatCurrency(
            (oneTime.length ? oneTime : items).reduce(
              (sum, i) =>
                sum +
                (i.totalPrice !== undefined && i.totalPrice !== null && i.totalPrice !== ''
                  ? toNumber(i.totalPrice)
                  : (toNumber(i.quantity ?? 1) || 1) * toNumber(i.unitPrice) -
                    toNumber(i.discount)),
              0,
            ),
          );
    html +=
      `<table style="width:100%;border-collapse:collapse;">${header}<tbody>${oneTimeRows}</tbody>` +
      `<tfoot><tr style="border-top:2px solid #111;font-weight:bold;">` +
      `<td colspan="3" style="text-align:right;padding:8px 0;">One-time Total:</td>` +
      `<td style="text-align:right;padding:8px 0;">${oneTimeTotal}</td></tr></tfoot></table>`;
  }

  if (recurring.length) {
    const recurringRows = recurring.map(lineItemRow).join('');
    html +=
      `<h4 style="margin:16px 0 4px;">Recurring Charges</h4>` +
      `<table style="width:100%;border-collapse:collapse;">${header}<tbody>${recurringRows}</tbody></table>`;
  }

  return html;
}

function buildLogo(branding: MergeBranding | null | undefined): string {
  const url = branding?.logoUrl;
  if (!url) return '';
  const alt = escapeHtml(branding?.companyName ?? 'Company logo');
  return `<img src="${safeUrl(url)}" alt="${alt}" style="max-height:64px;max-width:240px;object-fit:contain;" />`;
}

function buildTokenMap(data: MergeData): Record<string, string> {
  const q = data.quote ?? {};
  const c = data.customer ?? {};
  const ct = data.contact ?? {};
  const b = data.branding ?? {};

  const recurringTotal =
    q.recurringTotal !== undefined && q.recurringTotal !== null && q.recurringTotal !== ''
      ? (() => {
          const freq =
            (q.lineItems ?? []).find((i) => i.isRecurring)?.recurringFrequency ?? 'monthly';
          const unit = FREQUENCY_LABEL[String(freq).toLowerCase()] ?? 'month';
          return `${formatCurrency(q.recurringTotal)} / ${unit}`;
        })()
      : '';

  return {
    '{{customer.name}}': escapeHtml(c.name ?? c.companyName ?? ''),
    '{{customer.companyName}}': escapeHtml(c.companyName ?? c.name ?? ''),
    '{{contact.name}}': escapeHtml(ct.name ?? ''),
    '{{quote.number}}': escapeHtml(q.number ?? ''),
    '{{quote.title}}': escapeHtml(q.title ?? ''),
    '{{quote.validUntil}}': escapeHtml(formatDate(q.validUntil ?? null)),
    '{{quote.lineItemsTable}}': buildLineItemsTable(q),
    '{{quote.oneTimeTotal}}': escapeHtml(
      q.oneTimeTotal !== undefined && q.oneTimeTotal !== null ? formatCurrency(q.oneTimeTotal) : '',
    ),
    '{{quote.recurringTotal}}': escapeHtml(recurringTotal),
    '{{quote.totalAmount}}': escapeHtml(
      q.totalAmount !== undefined && q.totalAmount !== null ? formatCurrency(q.totalAmount) : '',
    ),
    '{{branding.logo}}': buildLogo(b),
    '{{branding.companyName}}': escapeHtml(b.companyName ?? ''),
    '{{branding.address}}': escapeHtml(b.address ?? ''),
    '{{branding.phone}}': escapeHtml(b.phone ?? ''),
    '{{branding.email}}': escapeHtml(b.email ?? ''),
  };
}

const TOKEN_RE = /\{\{\s*[\w.]+\s*\}\}/g;
const KNOWN_TOKENS = new Set(MERGE_TOKENS);

function renderContent(
  content: string,
  tokenMap: Record<string, string>,
  warnings: Set<string>,
): string {
  if (!content) return '';
  return content.replace(TOKEN_RE, (match) => {
    const normalized = match.replace(/\s+/g, '');
    if (Object.prototype.hasOwnProperty.call(tokenMap, normalized)) {
      return tokenMap[normalized];
    }
    if (!KNOWN_TOKENS.has(normalized)) {
      warnings.add(`Unknown merge token: ${normalized}`);
    }
    return '';
  });
}

export function renderTemplate(template: MergeTemplate, data: MergeData): RenderResult {
  const tokenMap = buildTokenMap(data);
  const warnings = new Set<string>();

  const sections: RenderedSection[] = (template.sections ?? [])
    .filter((s) => s.isVisible !== false)
    .map((s, i) => ({
      id: s.id ?? `section-${i}`,
      type: s.type ?? 'custom',
      title: s.title ?? '',
      html: renderContent(s.content ?? '', tokenMap, warnings),
    }));

  return {
    sections,
    html: sections.map((s) => s.html).join('\n'),
    warnings: Array.from(warnings),
  };
}
