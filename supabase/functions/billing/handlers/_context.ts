// Shared context + drift helpers for the billing edge function handlers.
//
// SCHEMA AUDIT (EDGE-002a, 2026-06-11) — three families of billing tables:
//   1. Real Drizzle tables (shared/schema.ts): `invoices`, `invoice_line_items`,
//      `subscription_payment_methods`, `billing_rules`, `meter_readings`,
//      `contracts`, `contract_tiered_rates`. Handlers query these normally.
//   2. Drift tables NOT in any Drizzle schema or migration: `billing_configurations`,
//      `billing_cycles`, `billing_adjustments`. The legacy Express handlers
//      (server/routes-billing-core.ts) hit them with raw SQL, so they may exist
//      in the live DB without ever appearing in shared/. Handlers for these
//      tolerate a missing relation: GETs degrade to `[]`, writes return 503
//      with a clear message (see isMissingTableError).
//   3. Phantom columns: the consolidated Express router (server/routes/billing.ts)
//      selects `invoices.balance/paid/total/tax/paymentDate/...` — none of which
//      exist in shared/schema.ts. The real columns are `balance_due`,
//      `amount_paid`, `total_amount`, `tax_amount`, `paid_date`. Handlers here
//      use the REAL columns and map to the camelCase names the frontend expects.

export interface BillingCtx {
  req: Request;
  // Service-role supabase client (bypasses RLS) — every query MUST filter tenant_id.
  // deno-lint-ignore no-explicit-any
  admin: any;
  user: { id: string };
  tenantId: string;
  url: URL;
  // Path segments after the function-name strip: /billing/cycles/run → ['cycles','run']
  parts: string[];
}

// True when a PostgREST/Postgres error means the relation does not exist —
// expected for the drift tables above when the live DB predates them.
export function isMissingTableError(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === '42P01' || e.code === 'PGRST205') return true;
  const msg = (e.message || '').toLowerCase();
  return msg.includes('could not find the table') || msg.includes('does not exist');
}

// True when PostgREST rejected a write because a column is missing (PGRST204) —
// the self-healing retry trigger used across this codebase (see proposals fn).
export function isMissingColumnError(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === 'PGRST204' || e.code === '42703') return true;
  const msg = (e.message || '').toLowerCase();
  return msg.includes('could not find the') && msg.includes('column');
}

const num = (v: unknown): number => {
  const n = parseFloat(String(v ?? '0'));
  return Number.isFinite(n) ? n : 0;
};
export { num };

// Map a raw `invoices` row (+ optional business_records row) to the camelCase
// shape the frontend billing components read (invoice-email-dialog, Invoices.tsx).
// deno-lint-ignore no-explicit-any
export function mapInvoiceRow(row: any, customer?: any): Record<string, unknown> {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    customerId: row.customer_id,
    contractId: row.contract_id ?? null,
    invoiceDate: row.invoice_date,
    issueDate: row.issued_at ?? row.invoice_date,
    dueDate: row.due_date,
    subtotal: row.subtotal_amount,
    tax: row.tax_amount,
    totalAmount: row.total_amount,
    paid: row.amount_paid,
    balance: row.balance_due,
    amountPaid: row.amount_paid,
    balanceDue: row.balance_due,
    status: row.status ?? row.invoice_status,
    invoiceStatus: row.invoice_status,
    paymentTerms: row.payment_terms,
    paymentDate: row.paid_date,
    description: row.invoice_notes,
    notes: row.invoice_notes,
    poNumber: row.po_number,
    invoiceType: row.invoice_type,
    billingPeriodStart: row.billing_period_start,
    billingPeriodEnd: row.billing_period_end,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(customer
      ? {
          customerName: customer.company_name ?? null,
          customerEmail: customer.primary_contact_email ?? customer.email ?? null,
          customerPhone: customer.primary_contact_phone ?? customer.phone ?? null,
        }
      : {}),
  };
}
