/**
 * Canonical invoice normalization (AUDIT-011).
 *
 * WHY THIS EXISTS — the /api/billing/invoices surface is not self-consistent:
 *
 *   GET /billing/invoices      → { data, total } of RAW snake_case rows
 *                                (supabase/functions/billing/index.ts:222-258
 *                                does .select('*') and returns rows untouched),
 *                                plus a NESTED `customer` relation:
 *                                customer: { id, company_name, ... }
 *   GET /billing/invoices/:id  → camelCase, via mapInvoiceRow()
 *                                (billing/handlers/_context.ts:60)
 *   Legacy Express             → a bare array of mixed-case rows
 *
 * So every consumer has to bridge casing, and each page previously hand-rolled
 * its own bridge — badly. Invoices.tsx shipped `inv.invoiceNumber || inv.invoiceNumber`
 * (the same key OR'd with itself, five times over), so it never read invoice_number
 * at all: blank invoice numbers, $NaN totals and "Invalid Date" against real data.
 *
 * Two traps this encodes once, so no caller has to remember them:
 *
 * 1. DECIMALS ARE STRINGS. PostgREST serializes numeric/decimal columns as
 *    strings ("1234.50"), so `row.balance_due.toFixed(2)` throws
 *    "toFixed is not a function". Amounts are coerced to real numbers here.
 *
 * 2. STATUS HAS TWO COLUMNS. `invoices` carries BOTH a legacy `status`
 *    (default 'draft') and the canonical `invoice_status` (default 'open') —
 *    see shared/schema.ts:2085/2099. They can disagree, and a row that is
 *    invoice_status='paid' but status='draft' must not render as draft.
 *    `invoice_status` wins, matching the edge function's own watermarkFor()
 *    (billing/handlers/invoices.ts) and the CLAUDE.md billing schema audit.
 *    The list endpoint also FILTERS on invoice_status (?status=), so reading
 *    the legacy column would make the filter and the rendered badge disagree.
 */

/** Coerce a PostgREST decimal (string), a number, or null/undefined to a number. */
function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

/** First value that is neither null nor undefined ('' is a legitimate value). */
function firstDefined<T>(...values: T[]): T | undefined {
  return values.find((v) => v !== null && v !== undefined);
}

function toStringOrEmpty(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

export interface NormalizedInvoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  contractId: string | null;
  /** Resolved from the nested `customer` relation on the list endpoint. */
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  /** Money fields are always real numbers here — never PostgREST decimal strings. */
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  /** Canonical status: invoice_status wins over the legacy `status` column. */
  status: string;
  paymentTerms: string;
  paidDate: string | null;
  poNumber: string;
  invoiceNotes: string;
  blackCopiesTotal: number;
  colorCopiesTotal: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Normalize one invoice row from ANY of the three shapes above into
 * NormalizedInvoice. Accepts snake_case, camelCase, or a mix.
 */
export function normalizeInvoice(raw: any): NormalizedInvoice {
  const row = raw ?? {};
  const customer = row.customer ?? row.business_record ?? null;

  return {
    id: toStringOrEmpty(row.id),
    invoiceNumber: toStringOrEmpty(firstDefined(row.invoiceNumber, row.invoice_number)),
    customerId: toStringOrEmpty(firstDefined(row.customerId, row.customer_id)),
    contractId: (firstDefined(row.contractId, row.contract_id) as string | null) ?? null,
    customerName: toStringOrEmpty(
      firstDefined(
        row.customerName,
        customer?.company_name,
        customer?.companyName,
        row.customer_name,
        row.business_record_name,
      ),
    ),
    invoiceDate: toStringOrEmpty(firstDefined(row.invoiceDate, row.invoice_date)),
    dueDate: toStringOrEmpty(firstDefined(row.dueDate, row.due_date)),
    billingPeriodStart: toStringOrEmpty(
      firstDefined(row.billingPeriodStart, row.billing_period_start),
    ),
    billingPeriodEnd: toStringOrEmpty(firstDefined(row.billingPeriodEnd, row.billing_period_end)),
    subtotal: toNumber(firstDefined(row.subtotal, row.subtotalAmount, row.subtotal_amount)),
    taxAmount: toNumber(firstDefined(row.taxAmount, row.tax_amount, row.tax)),
    totalAmount: toNumber(firstDefined(row.totalAmount, row.total_amount, row.total)),
    amountPaid: toNumber(firstDefined(row.amountPaid, row.amount_paid, row.paid)),
    balanceDue: toNumber(firstDefined(row.balanceDue, row.balance_due, row.balance)),
    // invoice_status is canonical — see the header note.
    status: toStringOrEmpty(
      firstDefined(row.invoiceStatus, row.invoice_status, row.status) ?? 'open',
    ),
    paymentTerms: toStringOrEmpty(firstDefined(row.paymentTerms, row.payment_terms)),
    paidDate: (firstDefined(row.paidDate, row.paid_date, row.paymentDate) as string | null) ?? null,
    poNumber: toStringOrEmpty(firstDefined(row.poNumber, row.po_number)),
    invoiceNotes: toStringOrEmpty(
      firstDefined(row.invoiceNotes, row.invoice_notes, row.notes, row.description),
    ),
    blackCopiesTotal: toNumber(firstDefined(row.blackCopiesTotal, row.black_copies_total)),
    colorCopiesTotal: toNumber(firstDefined(row.colorCopiesTotal, row.color_copies_total)),
    createdAt: toStringOrEmpty(firstDefined(row.createdAt, row.created_at)),
    updatedAt: toStringOrEmpty(firstDefined(row.updatedAt, row.updated_at)),
  };
}

/** Normalize a list response (handles the { data, total } wrapper via extractRecords). */
export function normalizeInvoices(rows: any[]): NormalizedInvoice[] {
  return (rows ?? []).map(normalizeInvoice);
}
