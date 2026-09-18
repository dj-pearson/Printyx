// The four operational alert families, derived from real rows (AUDIT-028).
//
// Extracted from supabase/functions/performance/index.ts so the dashboard's
// urgent-items widget answers with the SAME alerts the notification bell shows
// (DASH-METRICS-001). Two derivations of "what is wrong right now" would drift,
// and the dashboard's version was the one that had been typed in.
//
// `system_alerts` is the stored table and NOTHING WRITES TO IT (AUDIT-028), so
// these derivations are the only real signal either surface has.

export interface DerivedAlert {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  category: string;
  timestamp: string;
}

/**
 * The four alert families server/routes-operations-extended.ts derived in dev.
 *
 * Each is capped and independently guarded: a tenant with a huge inventory must
 * not stall the bell, and a missing relation in one family must not blank the
 * other three.
 */
// deno-lint-ignore no-explicit-any
export async function deriveOperationalAlerts(
  admin: any,
  tenantId: string,
): Promise<DerivedAlert[]> {
  const now = new Date();
  const nowIso = now.toISOString();
  const alerts: DerivedAlert[] = [];

  // 1) Low stock. PostgREST cannot compare two columns, so the filter happens
  // here - hence the explicit cap rather than an unbounded scan.
  try {
    const { data } = await admin
      .from('inventory_items')
      .select('id, name, quantity_on_hand, reorder_point')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .not('reorder_point', 'is', null)
      .order('quantity_on_hand', { ascending: true })
      .limit(200);
    for (const item of (data ?? []).slice(0, 20)) {
      const onHand = Number(item.quantity_on_hand ?? 0);
      const reorderAt = Number(item.reorder_point);
      if (!Number.isFinite(reorderAt) || onHand > reorderAt) continue;
      alerts.push({
        id: `low_stock_${item.id}`,
        type: 'low_stock',
        severity: 'medium',
        title: `Low Stock: ${item.name}`,
        message: `${item.name} is running low (${onHand} remaining, reorder at ${reorderAt})`,
        category: 'business',
        timestamp: nowIso,
      });
    }
  } catch (err) {
    console.error('low stock alerts:', err);
  }

  // 2) Dispatch delays: scheduled in the past and still open.
  try {
    const { data } = await admin
      .from('service_tickets')
      .select('id, ticket_number, title, scheduled_date, status')
      .eq('tenant_id', tenantId)
      .lt('scheduled_date', nowIso)
      .not('status', 'in', '(completed,cancelled)')
      .order('scheduled_date', { ascending: true })
      .limit(10);
    for (const ticket of data ?? []) {
      alerts.push({
        id: `dispatch_delay_${ticket.id}`,
        type: 'dispatch_delay',
        severity: 'high',
        title: `Dispatch Delay: Ticket ${ticket.ticket_number}`,
        message: `Service ticket ${ticket.ticket_number} (${ticket.title}) was scheduled for ${new Date(ticket.scheduled_date).toLocaleString()} but is still ${ticket.status}.`,
        category: 'performance',
        timestamp: nowIso,
      });
    }
  } catch (err) {
    console.error('dispatch delay alerts:', err);
  }

  // 3) Billing: overdue, or past its due date and still pending.
  try {
    const { data } = await admin
      .from('invoices')
      .select('id, invoice_number, due_date, status, total_amount, created_at')
      .eq('tenant_id', tenantId)
      .or(`status.eq.overdue,and(status.eq.pending,due_date.lt.${nowIso})`)
      .order('created_at', { ascending: false })
      .limit(10);
    for (const invoice of data ?? []) {
      const due = invoice.due_date
        ? new Date(invoice.due_date).toLocaleDateString()
        : 'an unset date';
      alerts.push({
        id: `billing_anomaly_${invoice.id}`,
        type: 'billing_anomaly',
        severity: invoice.status === 'overdue' ? 'critical' : 'medium',
        title: `Billing Issue: Invoice ${invoice.invoice_number}`,
        message:
          invoice.status === 'overdue'
            ? `Invoice ${invoice.invoice_number} is overdue since ${due}.`
            : `Invoice ${invoice.invoice_number} is past due (Due: ${due}).`,
        category: 'business',
        timestamp: nowIso,
      });
    }
  } catch (err) {
    console.error('billing anomaly alerts:', err);
  }

  // 4) Contracts ending within 90 days. Days remaining is computed here; the
  // Express version used DATE_PART, which PostgREST has no equivalent for.
  try {
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await admin
      .from('service_contracts')
      .select('id, contract_number, end_date, monthly_base_rate')
      .eq('tenant_id', tenantId)
      .eq('contract_status', 'active')
      .gte('end_date', nowIso)
      .lte('end_date', in90Days)
      .order('end_date', { ascending: true })
      .limit(15);
    for (const contract of data ?? []) {
      const days = Math.max(
        0,
        Math.round((new Date(contract.end_date).getTime() - now.getTime()) / 86400000),
      );
      alerts.push({
        id: `contract_expiration_${contract.id}`,
        type: 'contract_expiration',
        severity: days <= 30 ? 'high' : 'medium',
        title: `Contract Expiring: ${contract.contract_number}`,
        message: `Contract ${contract.contract_number} ends in ${days} day${days === 1 ? '' : 's'} (${new Date(contract.end_date).toLocaleDateString()}).`,
        category: 'business',
        timestamp: nowIso,
      });
    }
  } catch (err) {
    console.error('contract expiration alerts:', err);
  }

  return alerts;
}
