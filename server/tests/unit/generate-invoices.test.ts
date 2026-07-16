/**
 * AUDIT-008 — meter-reading -> invoice generation.
 *
 * The AC requires confirming "produced invoice amounts/totals are unchanged by the
 * batching (test against a known set of readings)". The billing math was extracted
 * into the pure prepareInvoiceRows() precisely so it can be asserted directly, and
 * these cases are computed BY HAND from the tiered-rate rules rather than snapshotted
 * from the implementation (a snapshot would happily lock in a wrong number).
 */
import { describe, it, expect } from 'vitest';
import {
  prepareInvoiceRows,
  calculateTieredAmount,
} from '../../../supabase/functions/billing/handlers/generate-invoices';

const TENANT = 'tenant-1';
const USER = 'user-1';
const FIXED_NOW = Date.UTC(2026, 6, 16, 12, 0, 0);

const contract = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  customer_id: 'cust-1',
  black_rate: '0.01',
  color_rate: '0.08',
  monthly_base: '100',
  ...over,
});

const reading = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  contract_id: 'c1',
  black_copies: 1000,
  color_copies: 500,
  reading_date: '2026-07-01T00:00:00Z',
  ...over,
});

const prep = (
  readings: any[],
  contracts: any[] = [contract()],
  rates: Record<string, any[]> = {},
) =>
  prepareInvoiceRows(
    readings,
    new Map(contracts.map((c) => [String(c.id), c])),
    new Map(Object.entries(rates)),
    TENANT,
    USER,
    { now: () => FIXED_NOW, invoiceNumber: (i) => `INV-TEST-${i}` },
  );

describe('AUDIT-008: billing amounts are unchanged by batching', () => {
  it('flat-rate: black*rate + color*rate + monthly base', () => {
    // 1000*0.01 = 10 ; 500*0.08 = 40 ; base 100 => 150
    const [p] = prep([reading()]);
    expect(p.totalAmount).toBe(150);
    expect(p.invoice.total_amount).toBe('150');
    expect(p.invoice.balance_due).toBe('150');
    expect(p.invoice.amount_paid).toBe('0');
    expect(p.invoice.invoice_status).toBe('open');
    expect(p.invoice.tenant_id).toBe(TENANT);
    expect(p.invoice.customer_id).toBe('cust-1');
  });

  it('tiered: charges each tier band at its own rate', () => {
    // Tiers: 0+ @0.02, 500+ @0.01. Volume 1000 =>
    //   band 0-500   : 500 * 0.02 = 10
    //   band 500-inf : 500 * 0.01 = 5
    // black = 15 ; color 0 ; base 100 => 115
    const [p] = prep([reading({ color_copies: 0 })], [contract()], {
      c1: [
        { color_type: 'black', minimum_volume: 0, rate_per_unit: '0.02' },
        { color_type: 'black', minimum_volume: 500, rate_per_unit: '0.01' },
      ],
    });
    expect(p.totalAmount).toBe(115);
  });

  it('sums the batch total exactly like the old per-row accumulator', () => {
    const rows = prep([
      reading({ id: 'r1' }),
      reading({ id: 'r2', black_copies: 2000, color_copies: 0 }), // 20 + 100 = 120
      reading({ id: 'r3', black_copies: 0, color_copies: 250 }), // 20 + 100 = 120
    ]);
    const grandTotal = rows.reduce((sum, r) => sum + r.totalAmount, 0);
    expect(rows.map((r) => r.totalAmount)).toEqual([150, 120, 120]);
    expect(grandTotal).toBe(390);
  });

  it('zero copies still bills the monthly base', () => {
    const [p] = prep([reading({ black_copies: 0, color_copies: 0 })]);
    expect(p.totalAmount).toBe(100);
  });

  it('missing rates on the contract fall back to 0, base only', () => {
    const [p] = prep([reading()], [contract({ black_rate: null, color_rate: null })]);
    expect(p.totalAmount).toBe(100);
  });
});

describe('AUDIT-008: skip semantics match the original loop', () => {
  it('skips readings with no contract_id (not counted as failed)', () => {
    expect(prep([reading({ contract_id: null })])).toHaveLength(0);
  });

  it('skips readings whose contract is missing from the map', () => {
    expect(prep([reading({ contract_id: 'nope' })])).toHaveLength(0);
  });

  it('keeps the good readings when others are skipped', () => {
    const rows = prep([
      reading({ id: 'a' }),
      reading({ id: 'b', contract_id: null }),
      reading({ id: 'c' }),
    ]);
    expect(rows.map((r) => r.readingId)).toEqual(['a', 'c']);
  });
});

describe('AUDIT-008: invoice_number uniqueness (the batching hazard)', () => {
  it('is unique within a batch even though every row shares one timestamp', () => {
    // The pre-batching code used `INV-${Date.now()}-${random}`. A bulk INSERT writes
    // every row in the SAME millisecond, and invoice_number is UNIQUE — so a single
    // collision would fail the WHOLE batch. Uniqueness must not rest on randomness.
    const rows = prepareInvoiceRows(
      Array.from({ length: 200 }, (_, i) => reading({ id: `r${i}` })),
      new Map([['c1', contract()]]),
      new Map(),
      TENANT,
      USER,
      { now: () => FIXED_NOW }, // real (random) numbering, one fixed timestamp
    );
    const numbers = rows.map((r) => r.invoice.invoice_number as string);
    expect(numbers).toHaveLength(200);
    expect(new Set(numbers).size).toBe(200);
  });

  it('every row in a batch shares one issue/due timestamp (one clock read)', () => {
    const rows = prep([reading({ id: 'a' }), reading({ id: 'b' })]);
    expect(rows[0].invoice.invoice_date).toBe(rows[1].invoice.invoice_date);
    expect(rows[0].invoice.due_date).toBe(rows[1].invoice.due_date);
    // due = issue + 30d
    const delta =
      new Date(rows[0].invoice.due_date as string).getTime() -
      new Date(rows[0].invoice.invoice_date as string).getTime();
    expect(delta).toBe(30 * 24 * 60 * 60 * 1000);
  });
});

describe('AUDIT-008: calculateTieredAmount (unchanged helper, pinned)', () => {
  it('falls back to the default rate with no tiers', () => {
    expect(calculateTieredAmount(1000, [], 0.01)).toBe(10);
  });

  it('uses the default rate for a tier with no rate_per_unit', () => {
    expect(
      calculateTieredAmount(
        100,
        [{ minimum_volume: 0, rate_per_unit: 0 as unknown as number }],
        0.05,
      ),
    ).toBe(5);
  });

  it('stops once volume is exhausted', () => {
    // 100 copies, tiers 0+@0.10 and 1000+@0.01 => all 100 in the first band = 10
    expect(
      calculateTieredAmount(
        100,
        [
          { minimum_volume: 0, rate_per_unit: 0.1 },
          { minimum_volume: 1000, rate_per_unit: 0.01 },
        ],
        0,
      ),
    ).toBeCloseTo(10, 10);
  });
});
