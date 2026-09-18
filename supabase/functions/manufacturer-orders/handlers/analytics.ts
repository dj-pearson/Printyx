// Manufacturer-orders analytics dashboard — computed aggregates.
//
// Path: GET /manufacturer-orders/analytics/dashboard

import { jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

export async function handleAnalytics(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, auth, db, requestId } = ctx;
  if (method !== 'GET') return null;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

  const [
    allOrders,
    ordersByStatus,
    ordersRecent,
    unresolvedExceptions,
    shipmentsRecent,
    connectionsByStatus,
  ] = await Promise.all([
    db
      .from('manufacturer_orders')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', auth.tenantId),
    db.from('manufacturer_orders').select('order_status').eq('tenant_id', auth.tenantId),
    // `actual_delivery_date` used to be in this select and is NOT a column on
    // manufacturer_orders - it lives on manufacturer_order_shipments. PostgREST
    // fails the WHOLE select on an unknown column, so `ordersRecent.data` was
    // null and every figure below it read as zero: the 30-day count, the total
    // value, the acknowledgement latency and the on-time delivery rate. This
    // function had no caller until WF-L-12 wired it, which is why nobody saw it.
    db
      .from('manufacturer_orders')
      .select('id, total_amount, submitted_at, acknowledged_at, estimated_delivery_date')
      .eq('tenant_id', auth.tenantId)
      .gte('order_date', thirtyDaysAgo),
    db
      .from('manufacturer_order_exceptions')
      .select('severity')
      .eq('tenant_id', auth.tenantId)
      .eq('resolved', false),
    // order_id and actual_delivery_date come back too, because the on-time rate
    // is a join between the two tables and PostgREST has none.
    db
      .from('manufacturer_order_shipments')
      .select('shipment_status, order_id, actual_delivery_date')
      .eq('tenant_id', auth.tenantId)
      .gte('created_at', thirtyDaysAgo),
    db.from('manufacturer_connections').select('connection_status').eq('tenant_id', auth.tenantId),
  ]);

  const byStatus: Record<string, number> = {};
  for (const r of (ordersByStatus.data ?? []) as Array<{ order_status: string }>) {
    byStatus[r.order_status] = (byStatus[r.order_status] ?? 0) + 1;
  }

  const recent = (ordersRecent.data ?? []) as Array<{
    id: string;
    total_amount: string | null;
    submitted_at: string | null;
    acknowledged_at: string | null;
    estimated_delivery_date: string | null;
  }>;

  const shipments = (shipmentsRecent.data ?? []) as Array<{
    shipment_status: string;
    order_id: string | null;
    actual_delivery_date: string | null;
  }>;

  // Earliest actual delivery per order: an order can ship in parts, and the
  // order is delivered when its first shipment arrives against the estimate.
  const deliveredAt = new Map<string, number>();
  for (const sh of shipments) {
    if (!sh.order_id || !sh.actual_delivery_date) continue;
    const at = new Date(sh.actual_delivery_date).getTime();
    const seen = deliveredAt.get(sh.order_id);
    if (seen === undefined || at < seen) deliveredAt.set(sh.order_id, at);
  }
  const recentTotalValue = recent.reduce((s, r) => s + parseFloat(r.total_amount ?? '0'), 0);
  const ackLatencies = recent
    .filter((r) => r.submitted_at && r.acknowledged_at)
    .map((r) => {
      const sub = new Date(r.submitted_at!).getTime();
      const ack = new Date(r.acknowledged_at!).getTime();
      return Math.max(0, (ack - sub) / 60000); // minutes
    });
  const avgAckLatencyMinutes =
    ackLatencies.length > 0
      ? Math.round(ackLatencies.reduce((a, b) => a + b, 0) / ackLatencies.length)
      : 0;
  const onTimeDelivered = recent.filter((r) => {
    const at = deliveredAt.get(r.id);
    return (
      at !== undefined &&
      r.estimated_delivery_date &&
      at <= new Date(r.estimated_delivery_date).getTime()
    );
  }).length;
  const deliveredCount = recent.filter((r) => deliveredAt.has(r.id)).length;

  const excBySeverity: Record<string, number> = {};
  for (const r of (unresolvedExceptions.data ?? []) as Array<{ severity: string }>) {
    excBySeverity[r.severity] = (excBySeverity[r.severity] ?? 0) + 1;
  }

  const shipmentsByStatus: Record<string, number> = {};
  for (const r of shipments) {
    shipmentsByStatus[r.shipment_status] = (shipmentsByStatus[r.shipment_status] ?? 0) + 1;
  }

  const connByStatus: Record<string, number> = {};
  for (const r of (connectionsByStatus.data ?? []) as Array<{ connection_status: string }>) {
    connByStatus[r.connection_status] = (connByStatus[r.connection_status] ?? 0) + 1;
  }

  return jsonResponse(
    {
      orders: {
        total: allOrders.count ?? 0,
        byStatus,
        recent30Days: {
          count: recent.length,
          totalValue: Number(recentTotalValue.toFixed(2)),
          avgAckLatencyMinutes,
          // Null rather than 0 when nothing in the window has been delivered:
          // a 0% on-time rate is a claim about performance, and "no deliveries
          // yet" is not that claim (AUDIT-028).
          onTimeDeliveryRate:
            deliveredCount > 0
              ? Number(((onTimeDelivered / deliveredCount) * 100).toFixed(1))
              : null,
        },
      },
      exceptions: {
        unresolvedCount: (unresolvedExceptions.data ?? []).length,
        bySeverity: excBySeverity,
      },
      shipments: {
        recent30Days: (shipmentsRecent.data ?? []).length,
        byStatus: shipmentsByStatus,
      },
      connections: {
        total: (connectionsByStatus.data ?? []).length,
        byStatus: connByStatus,
      },
      period: 'last_30_days',
    },
    200,
    req,
    requestId,
  );
}
