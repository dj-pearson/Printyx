// GET /dashboard/metrics/:type - the stat cards (DASH-METRICS-001).
import {
  type Admin,
  type MetricResult,
  monthStart,
  percentageChange,
  sumNumericField,
} from './_context.ts';

const OPEN_TICKET_STATUSES = ['open', 'in_progress', 'scheduled', 'assigned'];

/** Contracts ending inside this window count as upcoming renewals. */
export const RENEWAL_WINDOW_DAYS = 90;

export const METRIC_TYPES = [
  'revenue',
  'customers',
  'opportunities',
  'tickets',
  'inventory-alerts',
  'renewals',
] as const;

/**
 * Why only revenue carries a `change`: see the header of _context.ts. The other
 * five count current state and nothing versions it, so a prior-period figure
 * does not exist to compare against.
 */
const NO_HISTORY =
  'No prior-period figure exists for this count - it measures current state and nothing versions it.';

export async function dashboardMetric(
  admin: Admin,
  tenantId: string,
  type: string,
): Promise<MetricResult | null> {
  switch (type) {
    case 'revenue': {
      // invoice_date is a CALENDAR DATE stored at UTC midnight (DATE-LOCAL-002),
      // so the month bounds are UTC month starts and the upper bound is
      // exclusive - an inclusive 23:59:59.999 is a real timestamp a row can
      // exceed.
      const now = new Date();
      const thisMonth = monthStart(now);
      const lastMonth = monthStart(now, 1);
      const nextMonth = monthStart(now, -1);

      const { data, error } = await admin
        .from('invoices')
        .select('total_amount, invoice_date')
        .eq('tenant_id', tenantId)
        .gte('invoice_date', lastMonth.toISOString())
        .lt('invoice_date', nextMonth.toISOString());
      if (error) throw error;

      const rows = (data ?? []) as Array<Record<string, unknown>>;
      const current = rows.filter((r) => new Date(String(r.invoice_date)) >= thisMonth);
      const prior = rows.filter((r) => new Date(String(r.invoice_date)) < thisMonth);

      const total = sumNumericField(current, 'total_amount');
      return {
        value: total,
        formatted: `$${total.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
        change: percentageChange(total, sumNumericField(prior, 'total_amount')),
        period: 'month-to-date, invoiced',
      };
    }

    case 'customers': {
      const { count, error } = await admin
        .from('business_records')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('record_type', 'customer')
        .eq('status', 'active');
      if (error) throw error;
      return { value: count ?? 0, change: null, unbacked: ['change'], reason: NO_HISTORY };
    }

    case 'opportunities': {
      const { data, error } = await admin
        .from('opportunities')
        .select('amount')
        .eq('tenant_id', tenantId)
        .eq('is_closed', false);
      if (error) throw error;
      const rows = (data ?? []) as Array<Record<string, unknown>>;
      const total = sumNumericField(rows, 'amount');
      return {
        value: total,
        formatted: `$${total.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
        count: rows.length,
        change: null,
        unbacked: ['change'],
        reason: NO_HISTORY,
      };
    }

    case 'tickets': {
      const { count, error } = await admin
        .from('service_tickets')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .in('status', OPEN_TICKET_STATUSES);
      if (error) throw error;
      return { value: count ?? 0, change: null, unbacked: ['change'], reason: NO_HISTORY };
    }

    case 'inventory-alerts': {
      // PostgREST cannot compare two columns, so quantity_on_hand <=
      // reorder_point is evaluated here - which is why the read is capped and
      // ordered by the quantity most likely to be short.
      const { data, error } = await admin
        .from('inventory_items')
        .select('id, quantity_on_hand, reorder_point')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .not('reorder_point', 'is', null)
        .order('quantity_on_hand', { ascending: true })
        .limit(500);
      if (error) throw error;
      const low = ((data ?? []) as Array<Record<string, unknown>>).filter((row) => {
        // An item with NO reorder point has no threshold to be below. The null
        // check is explicit because Number(null) is 0, which is finite, so a
        // null threshold would otherwise make every empty shelf an alert - and
        // the .not(...) filter above is not a substitute for getting this right,
        // since a filter is a query and this is the comparison.
        if (row.reorder_point === null || row.reorder_point === undefined) return false;
        const onHand = Number(row.quantity_on_hand ?? 0);
        const reorderAt = Number(row.reorder_point);
        return Number.isFinite(onHand) && Number.isFinite(reorderAt) && onHand <= reorderAt;
      }).length;
      return { value: low, change: null, unbacked: ['change'], reason: NO_HISTORY };
    }

    case 'renewals': {
      const now = new Date();
      const horizon = new Date(now.getTime() + RENEWAL_WINDOW_DAYS * 86_400_000);
      const { count, error } = await admin
        .from('contracts')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .gte('end_date', now.toISOString())
        .lt('end_date', horizon.toISOString());
      if (error) throw error;
      return {
        value: count ?? 0,
        change: null,
        windowDays: RENEWAL_WINDOW_DAYS,
        unbacked: ['change'],
        reason: NO_HISTORY,
      };
    }

    default:
      return null;
  }
}
