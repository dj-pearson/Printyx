// UI-DEAD-BUTTONS-001 (round 205). Financial Intelligence's Customer
// Profitability tab rendered a red "0.0% margin", $0 gross profit, +0.0%
// growth and a green 0/100 risk score on every customer, because the endpoint
// hardcoded all five to 0. Its Export button had no handler.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { rollUpCustomerRevenue } from '../../../shared/customer-revenue-rollup';

const strip = (s: string) =>
  s
    .replace(/(?<![:/'"`])\/\/[^\n]*/g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');

const inv = (customer_id: string | null, total: number, invoice: string, paid: string | null) => ({
  customer_id,
  total_amount: String(total),
  invoice_date: invoice,
  paid_date: paid,
});

describe('rollUpCustomerRevenue', () => {
  const names = new Map([
    ['a', 'Acme'],
    ['b', 'Beta'],
  ]);
  const credits = new Map<string, number | null>([
    ['a', 1000],
    ['b', null],
  ]);

  it('reports unmeasured fields as null, never 0', () => {
    const [row] = rollUpCustomerRevenue([inv('a', 100, '2026-09-01', null)], names, credits);
    expect(row.totalCosts).toBeNull();
    expect(row.grossProfit).toBeNull();
    expect(row.profitMargin).toBeNull();
    expect(row.revenueGrowth).toBeNull();
    expect(row.riskScore).toBeNull();
    // Nothing paid yet: no speed, no rate.
    expect(row.paymentHistory.avgDaysToPay).toBeNull();
    expect(row.paymentHistory.onTimePaymentRate).toBeNull();
    expect(row.paymentHistory.totalOutstanding).toBe(100);
    expect(row.paymentHistory.creditUtilization).toBe(10);
  });

  it('measures payment speed from paid invoices and ignores a payment before its invoice', () => {
    const rows = rollUpCustomerRevenue(
      [
        inv('b', 200, '2026-08-01', '2026-08-11'),
        inv('b', 300, '2026-08-01', '2026-09-20'),
        inv('b', 50, '2026-08-10', '2026-08-01'),
      ],
      names,
      credits,
    );
    const b = rows[0];
    expect(b.totalRevenue).toBe(550);
    expect(b.invoiceCount).toBe(3);
    expect(b.paymentHistory.avgDaysToPay).toBe(30); // (10 + 50) / 2
    expect(b.paymentHistory.onTimePaymentRate).toBe(50);
    expect(b.paymentHistory.totalOutstanding).toBe(0);
    // No recorded limit: null limit and null utilisation, not $0 at 0%.
    expect(b.paymentHistory.creditLimit).toBeNull();
    expect(b.paymentHistory.creditUtilization).toBeNull();
  });

  it('keeps invoices with no customer so revenue still adds up, and sorts by revenue', () => {
    const rows = rollUpCustomerRevenue(
      [inv(null, 5, '2026-09-01', null), inv('a', 50, '2026-09-01', null)],
      names,
      credits,
    );
    expect(rows.map((r) => r.customerId)).toEqual(['a', 'unknown']);
    expect(rows[1].customerName).toBe('No customer');
    expect(rows.reduce((s, r) => s + r.totalRevenue, 0)).toBe(55);
  });
});

describe('endpoint and page', () => {
  const fn = strip(readFileSync('supabase/functions/reports/handlers/frontend-stubs.ts', 'utf8'));
  const page = strip(readFileSync('client/src/pages/FinancialIntelligenceDashboard.tsx', 'utf8'));

  it('pages invoices and delegates to the shared rollup', () => {
    const at = fn.indexOf('async function customerProfitability(');
    const body = fn.slice(at, fn.indexOf('\n}\n', at));
    expect(body).toMatch(/await fetchAllRows<RollupInvoice>\(\(\) =>/);
    expect(body).toContain('return rollUpCustomerRevenue(list, names, credits);');
    expect(body).not.toMatch(/profitMargin:\s*0|riskScore:\s*0|grossProfit:\s*0/);
    expect(fn).toContain('r.credit_limit == null ? null : Number(r.credit_limit)');
  });

  it('renders no margin, profit, growth or risk figure, and exports the measured rows', () => {
    expect(page).not.toMatch(/customer\.(profitMargin|grossProfit|revenueGrowth|riskScore)/);
    expect(page).toMatch(/exportToCSV\(customerProfitability, CUSTOMER_REVENUE_EXPORT_COLUMNS,/);
    const cols = page.slice(
      page.indexOf('CUSTOMER_REVENUE_EXPORT_COLUMNS:'),
      page.indexOf('];', page.indexOf('CUSTOMER_REVENUE_EXPORT_COLUMNS:')),
    );
    expect(cols).not.toMatch(/profitMargin|grossProfit|riskScore|revenueGrowth|totalCosts/);
  });
});
