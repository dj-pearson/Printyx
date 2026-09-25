/**
 * Per-customer revenue and payment behaviour for the Financial Intelligence
 * "Customer Profitability" tab (GET /reports/customer-profitability).
 *
 * The endpoint used to answer `totalCosts: 0, grossProfit: 0, profitMargin: 0,
 * revenueGrowth: 0, riskScore: 0` for every customer, and the page rendered
 * them: a red "0.0% margin" badge, $0 gross profit, +0.0% growth and a green
 * 0/100 risk score on every row. Nothing in this product records the cost of
 * serving a customer, a prior-period baseline for growth, or a risk model, so
 * those fields are NULL - absent, not zero. What invoices can answer is
 * answered: revenue, what is still unpaid, and how quickly paid invoices were
 * settled.
 *
 * Rules:
 *  - An average or rate with nothing to average is null, not 0 (0 days to pay
 *    claims instant settlement; 0% on time claims every invoice was late).
 *  - A customer with no recorded credit limit has a null limit and a null
 *    utilisation, not a limit of $0 at 0% used.
 *  - A payment dated before its invoice is clock skew or a backfill and yields
 *    no interval rather than a negative one.
 *  - An invoice with no customer is grouped under 'unknown' and kept, so the
 *    revenue column still adds up to the invoices in the window.
 */

export const ON_TIME_DAYS = 30;

export interface RollupInvoice {
  customer_id: string | null;
  total_amount: string | number | null;
  paid_date: string | null;
  invoice_date: string | null;
}

export interface CustomerRevenueRow {
  customerId: string;
  customerName: string;
  totalRevenue: number;
  invoiceCount: number;
  totalCosts: null;
  grossProfit: null;
  profitMargin: null;
  revenueGrowth: null;
  riskScore: null;
  paymentHistory: {
    avgDaysToPay: number | null;
    onTimePaymentRate: number | null;
    totalOutstanding: number;
    creditLimit: number | null;
    creditUtilization: number | null;
  };
}

const DAY_MS = 86_400_000;

export function rollUpCustomerRevenue(
  invoices: readonly RollupInvoice[],
  names: ReadonlyMap<string, string>,
  creditLimits: ReadonlyMap<string, number | null>,
  limit = 50,
): CustomerRevenueRow[] {
  const byCustomer = new Map<
    string,
    { revenue: number; outstanding: number; payDays: number[]; count: number }
  >();
  for (const inv of invoices) {
    const id = inv.customer_id ?? 'unknown';
    const cur = byCustomer.get(id) ?? { revenue: 0, outstanding: 0, payDays: [], count: 0 };
    const amount = Number(inv.total_amount ?? 0);
    const safe = Number.isFinite(amount) ? amount : 0;
    cur.revenue += safe;
    cur.count += 1;
    if (!inv.paid_date) {
      cur.outstanding += safe;
    } else if (inv.invoice_date) {
      const d = (new Date(inv.paid_date).getTime() - new Date(inv.invoice_date).getTime()) / DAY_MS;
      if (Number.isFinite(d) && d >= 0) cur.payDays.push(Math.floor(d));
    }
    byCustomer.set(id, cur);
  }

  return [...byCustomer.entries()]
    .map(([id, v]) => {
      const n = v.payDays.length;
      const credit = creditLimits.get(id) ?? null;
      const limitValue = credit !== null && credit > 0 ? credit : null;
      return {
        customerId: id,
        customerName: names.get(id) ?? (id === 'unknown' ? 'No customer' : 'Unknown'),
        totalRevenue: Math.round(v.revenue),
        invoiceCount: v.count,
        totalCosts: null,
        grossProfit: null,
        profitMargin: null,
        revenueGrowth: null,
        riskScore: null,
        paymentHistory: {
          avgDaysToPay: n > 0 ? Math.round(v.payDays.reduce((s, d) => s + d, 0) / n) : null,
          onTimePaymentRate:
            n > 0
              ? Math.round((v.payDays.filter((d) => d <= ON_TIME_DAYS).length / n) * 100)
              : null,
          totalOutstanding: Math.round(v.outstanding),
          creditLimit: limitValue,
          creditUtilization:
            limitValue !== null
              ? Math.min(100, Math.round((v.outstanding / limitValue) * 100))
              : null,
        },
      } satisfies CustomerRevenueRow;
    })
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, limit);
}
