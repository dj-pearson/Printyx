// GET /dashboard/charts/:type (DASH-METRICS-001).
//
// A CHART IS A CLAIM ABOUT A SHAPE. revenue-trend used to draw six months of
// typed-in points, which asserts a direction the business may not be going in,
// and service-metrics drew a status split nothing had counted. Both are derived
// here; neither falls back to a literal.
import { type Admin, monthStart, sumNumericField } from './_context.ts';

export const CHART_TYPES = [
  'pipeline',
  'revenue-trend',
  'customer-distribution',
  'service-metrics',
] as const;

/** Months of history the revenue trend covers, including the current one. */
export const TREND_MONTHS = 6;

export interface ChartResult {
  data: Array<Record<string, unknown>>;
  unbacked?: string;
}

/** PostgREST has no GROUP BY, so every roll-up below groups in memory. */
function tally(
  rows: Array<Record<string, unknown>>,
  key: (row: Record<string, unknown>) => string,
): Map<string, { count: number; rows: Array<Record<string, unknown>> }> {
  const out = new Map<string, { count: number; rows: Array<Record<string, unknown>> }>();
  for (const row of rows) {
    const k = key(row);
    const bucket = out.get(k);
    if (bucket) {
      bucket.count += 1;
      bucket.rows.push(row);
    } else {
      out.set(k, { count: 1, rows: [row] });
    }
  }
  return out;
}

export async function dashboardChart(
  admin: Admin,
  tenantId: string,
  type: string,
): Promise<ChartResult | null> {
  switch (type) {
    case 'pipeline': {
      const { data, error } = await admin
        .from('opportunities')
        .select('stage_name, amount')
        .eq('tenant_id', tenantId)
        .eq('is_closed', false);
      if (error) throw error;
      const grouped = tally((data ?? []) as Array<Record<string, unknown>>, (r) =>
        String(r.stage_name ?? 'Unstaged'),
      );
      return {
        data: [...grouped.entries()].map(([name, bucket]) => ({
          name,
          value: sumNumericField(bucket.rows, 'amount'),
          count: bucket.count,
        })),
      };
    }

    case 'revenue-trend': {
      // invoice_date is a calendar date at UTC midnight, so the window starts at
      // a UTC month boundary and every bucket is keyed off the same clock
      // (DATE-LOCAL-002).
      const now = new Date();
      const from = monthStart(now, TREND_MONTHS - 1);
      const { data, error } = await admin
        .from('invoices')
        .select('total_amount, invoice_date')
        .eq('tenant_id', tenantId)
        .gte('invoice_date', from.toISOString())
        .order('invoice_date', { ascending: true });
      if (error) throw error;

      // Every month in the window appears, including the empty ones: a gap in a
      // trend line reads as missing data, while a zero is a measurement.
      const buckets = new Map<string, number>();
      for (let i = TREND_MONTHS - 1; i >= 0; i--) {
        const at = monthStart(now, i);
        buckets.set(at.toISOString().slice(0, 7), 0);
      }
      for (const row of (data ?? []) as Array<Record<string, unknown>>) {
        const key = String(row.invoice_date ?? '').slice(0, 7);
        if (!buckets.has(key)) continue;
        const amount = Number(row.total_amount);
        if (Number.isFinite(amount)) buckets.set(key, (buckets.get(key) ?? 0) + amount);
      }
      return {
        data: [...buckets.entries()].map(([month, value]) => ({ name: month, value })),
      };
    }

    case 'customer-distribution': {
      const { data, error } = await admin
        .from('business_records')
        .select('industry')
        .eq('tenant_id', tenantId)
        .eq('record_type', 'customer');
      if (error) throw error;
      const grouped = tally((data ?? []) as Array<Record<string, unknown>>, (r) =>
        String(r.industry ?? 'Unspecified'),
      );
      return {
        data: [...grouped.entries()]
          .map(([name, bucket]) => ({ name, value: bucket.count }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10),
      };
    }

    case 'service-metrics': {
      const { data, error } = await admin
        .from('service_tickets')
        .select('status')
        .eq('tenant_id', tenantId);
      if (error) throw error;
      const grouped = tally((data ?? []) as Array<Record<string, unknown>>, (r) =>
        String(r.status ?? 'unknown'),
      );
      return {
        data: [...grouped.entries()]
          .map(([name, bucket]) => ({ name, value: bucket.count }))
          .sort((a, b) => b.value - a.value),
      };
    }

    default:
      return null;
  }
}
