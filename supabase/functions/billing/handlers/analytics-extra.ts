// /billing/analytics/* sub-routes (EDGE-002a).
//
// Ported from server/routes/billing.ts → server/services/billing-analytics-service.ts
// for client/src/pages/BillingAnalytics.tsx. Response shapes mirror the Express
// service interfaces (RevenueForecast / ChurnPrediction / CustomerLifetimeValue).
// The forecasting/scoring here is a simplified single-pass heuristic over the
// `invoices` table; each response carries a `degraded` note naming what the
// full Express model added (seasonality factors, multi-factor churn model).
//
//   GET /billing/analytics/revenue-forecast?periods=3
//   GET /billing/analytics/churn-prediction
//   GET /billing/analytics/lifetime-value?customerId=

import { createCorsResponse } from '../../_shared/cors.ts';
import { type BillingCtx, num } from './_context.ts';

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

async function fetchInvoices(ctx: BillingCtx): Promise<Row[]> {
  const { data, error } = await ctx.admin
    .from('invoices')
    .select('customer_id, invoice_date, total_amount, amount_paid, created_at')
    .eq('tenant_id', ctx.tenantId);
  if (error) {
    console.error('Error fetching invoices for analytics:', error);
    return [];
  }
  return data ?? [];
}

async function customerNames(ctx: BillingCtx, ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const { data } = await ctx.admin
    .from('business_records')
    .select('id, company_name')
    .eq('tenant_id', ctx.tenantId)
    .in('id', ids);
  for (const r of data ?? []) map.set(String(r.id), r.company_name ?? String(r.id));
  return map;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonth(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export async function handleAnalyticsExtra(ctx: BillingCtx): Promise<Response | null> {
  const { req, url, parts } = ctx;
  if (req.method !== 'GET') return null;
  const sub = parts[1];

  // ── Revenue forecast: linear trend over the last 12 months ───────────────
  if (sub === 'revenue-forecast') {
    const periods = Math.min(Math.max(parseInt(url.searchParams.get('periods') || '3'), 1), 12);
    const invoices = await fetchInvoices(ctx);

    const byMonth = new Map<string, number>();
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      byMonth.set(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)), 0);
    }
    for (const inv of invoices) {
      const d = new Date(inv.invoice_date ?? inv.created_at);
      if (Number.isNaN(d.getTime())) continue;
      const key = monthKey(d);
      if (byMonth.has(key)) byMonth.set(key, (byMonth.get(key) ?? 0) + num(inv.total_amount));
    }

    const series = [...byMonth.values()];
    const n = series.length;
    const meanX = (n - 1) / 2;
    const meanY = series.reduce((a, b) => a + b, 0) / n;
    let cov = 0;
    let varX = 0;
    series.forEach((y, x) => {
      cov += (x - meanX) * (y - meanY);
      varX += (x - meanX) ** 2;
    });
    const slope = varX > 0 ? cov / varX : 0;
    const intercept = meanY - slope * meanX;
    const residualSq = series.reduce((acc, y, x) => acc + (y - (intercept + slope * x)) ** 2, 0);
    const stdErr = n > 2 ? Math.sqrt(residualSq / (n - 2)) : 0;

    const trendDirection = slope > 100 ? 'increasing' : slope < -100 ? 'decreasing' : 'stable';
    const forecast = Array.from({ length: periods }, (_, i) => {
      const step = i + 1;
      const value = Math.max(0, intercept + slope * (n - 1 + step));
      const interval = 1.96 * stdErr;
      return {
        period: formatMonth(new Date(now.getFullYear(), now.getMonth() + step, 1)),
        forecastedRevenue: Math.round(value),
        confidence: Math.min(100, Math.max(0, 100 - step * 10)),
        upperBound: Math.round(value + interval),
        lowerBound: Math.round(Math.max(0, value - interval)),
        trend: trendDirection,
      };
    });

    return createCorsResponse(
      {
        forecast,
        generatedAt: new Date().toISOString(),
        degraded: {
          reason:
            'Linear-trend forecast (edge port). The Express model additionally applied per-month seasonality factors.',
        },
      },
      200,
      req,
    );
  }

  // ── Churn prediction: billing-recency heuristic per customer ─────────────
  if (sub === 'churn-prediction') {
    const invoices = await fetchInvoices(ctx);

    const byCustomer = new Map<string, { last: Date | null; revenue: number }>();
    for (const inv of invoices) {
      if (!inv.customer_id) continue;
      const entry = byCustomer.get(String(inv.customer_id)) ?? { last: null, revenue: 0 };
      const d = new Date(inv.invoice_date ?? inv.created_at);
      if (!Number.isNaN(d.getTime()) && (!entry.last || d > entry.last)) entry.last = d;
      entry.revenue += num(inv.total_amount);
      byCustomer.set(String(inv.customer_id), entry);
    }

    const names = await customerNames(ctx, [...byCustomer.keys()]);
    const now = Date.now();

    const predictions = [...byCustomer.entries()]
      .map(([customerId, info]) => {
        const daysSince = info.last
          ? Math.floor((now - info.last.getTime()) / (24 * 60 * 60 * 1000))
          : 365;
        const riskLevel =
          daysSince > 180
            ? 'critical'
            : daysSince > 120
              ? 'high'
              : daysSince > 60
                ? 'medium'
                : 'low';
        return {
          customerId,
          customerName: names.get(customerId) ?? customerId,
          churnRisk: Math.min(95, Math.round(daysSince / 2)),
          riskLevel,
          factors: [
            {
              factor: 'billing_recency',
              impact: -Math.min(100, daysSince),
              description: `${daysSince} days since last invoice`,
            },
          ],
          recommendations:
            riskLevel === 'low'
              ? []
              : ['Schedule a check-in call', 'Review contract renewal status'],
          lastInvoiceDate: info.last ? info.last.toISOString() : null,
          totalRevenue: Math.round(info.revenue * 100) / 100,
        };
      })
      .sort((a, b) => b.churnRisk - a.churnRisk);

    return createCorsResponse(
      {
        predictions,
        summary: {
          total: predictions.length,
          critical: predictions.filter((p) => p.riskLevel === 'critical').length,
          high: predictions.filter((p) => p.riskLevel === 'high').length,
          medium: predictions.filter((p) => p.riskLevel === 'medium').length,
          low: predictions.filter((p) => p.riskLevel === 'low').length,
        },
        generatedAt: new Date().toISOString(),
        degraded: {
          reason:
            'Recency-only churn heuristic (edge port). The Express model also weighed payment delays and volume decline.',
        },
      },
      200,
      req,
    );
  }

  // ── Customer lifetime value ──────────────────────────────────────────────
  if (sub === 'lifetime-value') {
    const filterCustomerId = url.searchParams.get('customerId');
    const invoices = await fetchInvoices(ctx);

    const byCustomer = new Map<
      string,
      { first: Date | null; last: Date | null; revenue: number }
    >();
    for (const inv of invoices) {
      if (!inv.customer_id) continue;
      if (filterCustomerId && String(inv.customer_id) !== filterCustomerId) continue;
      const entry = byCustomer.get(String(inv.customer_id)) ?? {
        first: null,
        last: null,
        revenue: 0,
      };
      const d = new Date(inv.invoice_date ?? inv.created_at);
      if (!Number.isNaN(d.getTime())) {
        if (!entry.first || d < entry.first) entry.first = d;
        if (!entry.last || d > entry.last) entry.last = d;
      }
      entry.revenue += num(inv.total_amount);
      byCustomer.set(String(inv.customer_id), entry);
    }

    const names = await customerNames(ctx, [...byCustomer.keys()]);
    const now = Date.now();

    const customers = [...byCustomer.entries()]
      .map(([customerId, info]) => {
        const ageMonths = info.first
          ? Math.max(1, Math.round((now - info.first.getTime()) / MONTH_MS))
          : 1;
        const monthsSinceLast = info.last ? (now - info.last.getTime()) / MONTH_MS : 12;
        const retentionProbability =
          monthsSinceLast < 2 ? 0.9 : monthsSinceLast < 4 ? 0.7 : monthsSinceLast < 6 ? 0.5 : 0.3;
        const averageMonthlyRevenue = info.revenue / ageMonths;
        return {
          customerId,
          customerName: names.get(customerId) ?? customerId,
          historicalValue: Math.round(info.revenue * 100) / 100,
          predictedLifetimeValue:
            Math.round((info.revenue + averageMonthlyRevenue * 12 * retentionProbability) * 100) /
            100,
          averageMonthlyRevenue: Math.round(averageMonthlyRevenue * 100) / 100,
          customerAge: ageMonths,
          retentionProbability,
        };
      })
      .sort((a, b) => b.predictedLifetimeValue - a.predictedLifetimeValue);

    return createCorsResponse(
      {
        customers,
        summary: {
          totalCustomers: customers.length,
          totalHistoricalValue: customers.reduce((s, c) => s + c.historicalValue, 0),
          totalPredictedValue: customers.reduce((s, c) => s + c.predictedLifetimeValue, 0),
          averageLifetimeValue:
            customers.length > 0
              ? customers.reduce((s, c) => s + c.predictedLifetimeValue, 0) / customers.length
              : 0,
        },
        generatedAt: new Date().toISOString(),
        degraded: {
          reason:
            '12-month-horizon CLV with recency-based retention (edge port of the Express heuristic).',
        },
      },
      200,
      req,
    );
  }

  return null;
}
