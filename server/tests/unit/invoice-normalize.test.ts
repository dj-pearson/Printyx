/**
 * Locks the invoice response-shape contract (AUDIT-011).
 *
 * The /api/billing/invoices surface returns THREE different shapes depending on
 * the endpoint and the backend, and every billing page reads through
 * normalizeInvoice(). These tests pin the real shapes so a future edge-function
 * change can't silently reintroduce blank invoice numbers / $NaN totals.
 *
 * Mirrors the QUOTE-016 precedent (server/tests/unit/quote-math.test.ts).
 */
import { describe, it, expect } from 'vitest';
import { normalizeInvoice, normalizeInvoices } from '@/lib/invoice-normalize';

// Shape 1: GET /billing/invoices — raw snake_case row + nested customer relation.
// (supabase/functions/billing/index.ts:222-258 — .select('*, customer:business_records(...)'))
const listRow = {
  id: 'inv-1',
  invoice_number: 'INV-1001',
  customer_id: 'cust-1',
  contract_id: 'ctr-1',
  invoice_date: '2026-07-01T00:00:00+00:00',
  due_date: '2026-07-31T00:00:00+00:00',
  billing_period_start: '2026-07-01T00:00:00+00:00',
  billing_period_end: '2026-07-31T00:00:00+00:00',
  subtotal_amount: '1000.00',
  tax_amount: '80.00',
  total_amount: '1080.00', // PostgREST serializes decimals as STRINGS
  amount_paid: '80.00',
  balance_due: '1000.00',
  invoice_status: 'open',
  status: 'draft', // legacy column — must lose to invoice_status
  payment_terms: 'Net 30',
  paid_date: null,
  black_copies_total: 12,
  color_copies_total: 3,
  created_at: '2026-07-01T00:00:00+00:00',
  updated_at: '2026-07-02T00:00:00+00:00',
  customer: { id: 'cust-1', company_name: 'Acme Corp' },
};

// Shape 2: GET /billing/invoices/:id — camelCase, via mapInvoiceRow()
// (supabase/functions/billing/handlers/_context.ts:60)
const singleRow = {
  id: 'inv-1',
  invoiceNumber: 'INV-1001',
  customerId: 'cust-1',
  contractId: 'ctr-1',
  dueDate: '2026-07-31T00:00:00+00:00',
  totalAmount: '1080.00',
  amountPaid: '80.00',
  balanceDue: '1000.00',
  balance: '1000.00',
  paid: '80.00',
  status: 'draft',
  invoiceStatus: 'open',
  paymentTerms: 'Net 30',
  customerName: 'Acme Corp',
};

describe('normalizeInvoice', () => {
  describe('shape 1: raw snake_case list row', () => {
    const n = normalizeInvoice(listRow);

    it('bridges invoice_number (the bug that rendered blank invoice numbers)', () => {
      expect(n.invoiceNumber).toBe('INV-1001');
    });

    it('bridges due_date (the bug that rendered "Invalid Date")', () => {
      expect(n.dueDate).toBe('2026-07-31T00:00:00+00:00');
      expect(Number.isNaN(new Date(n.dueDate).getTime())).toBe(false);
    });

    it('coerces PostgREST decimal STRINGS to real numbers (the $NaN bug)', () => {
      expect(n.totalAmount).toBe(1080);
      expect(n.balanceDue).toBe(1000);
      expect(n.amountPaid).toBe(80);
      expect(typeof n.totalAmount).toBe('number');
    });

    it('makes .toFixed() safe — it threw "not a function" on the raw string', () => {
      expect(() => n.balanceDue.toFixed(2)).not.toThrow();
      expect(n.balanceDue.toFixed(2)).toBe('1000.00');
    });

    it('resolves customerName from the NESTED customer relation', () => {
      expect(n.customerName).toBe('Acme Corp');
    });

    it('prefers canonical invoice_status over the legacy status column', () => {
      expect(n.status).toBe('open');
    });
  });

  describe('shape 2: camelCase single-invoice row', () => {
    const n = normalizeInvoice(singleRow);

    it('normalizes identically to the list shape', () => {
      expect(n.invoiceNumber).toBe('INV-1001');
      expect(n.totalAmount).toBe(1080);
      expect(n.balanceDue).toBe(1000);
      expect(n.customerName).toBe('Acme Corp');
      expect(n.status).toBe('open');
    });
  });

  it('yields consistent keys across BOTH endpoint shapes (the point of the story)', () => {
    const fromList = normalizeInvoice(listRow);
    const fromSingle = normalizeInvoice(singleRow);
    for (const key of [
      'invoiceNumber',
      'customerId',
      'totalAmount',
      'balanceDue',
      'status',
    ] as const) {
      expect(fromSingle[key]).toEqual(fromList[key]);
    }
  });

  describe('defensive edges', () => {
    it('never returns NaN for missing/empty/garbage amounts', () => {
      const n = normalizeInvoice({
        id: 'x',
        total_amount: null,
        balance_due: '',
        tax_amount: 'abc',
      });
      expect(n.totalAmount).toBe(0);
      expect(n.balanceDue).toBe(0);
      expect(n.taxAmount).toBe(0);
    });

    it('tolerates an empty/undefined row without throwing', () => {
      expect(() => normalizeInvoice(undefined)).not.toThrow();
      expect(normalizeInvoice(undefined).invoiceNumber).toBe('');
      expect(normalizeInvoice({}).totalAmount).toBe(0);
    });

    it('defaults status to open when neither status column is present', () => {
      expect(normalizeInvoice({ id: 'x' }).status).toBe('open');
    });

    it('keeps a legitimately zero amount as 0 (not falsy-coerced away)', () => {
      expect(normalizeInvoice({ total_amount: '0.00' }).totalAmount).toBe(0);
    });

    it('normalizeInvoices maps a list and tolerates null', () => {
      expect(normalizeInvoices([listRow])).toHaveLength(1);
      expect(normalizeInvoices(null as any)).toEqual([]);
    });
  });
});
