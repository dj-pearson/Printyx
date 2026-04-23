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
    db
      .from('manufacturer_orders')
      .select(
        'total_amount, submitted_at, acknowledged_at, estimated_delivery_date, actual_delivery_date',
      )
      .eq('tenant_id', auth.tenantId)
      .gte('order_date', thirtyDaysAgo),
    db
      .from('manufacturer_order_exceptions')
      .select('severity')
      .eq('tenant_id', auth.tenantId)
      .eq('resolved', false),
    db
      .from('manufacturer_order_shipments')
      .select('shipment_status')
      .eq('tenant_id', auth.tenantId)
      .gte('created_at', thirtyDaysAgo),
    db.from('manufacturer_connections').select('connection_status').eq('tenant_id', auth.tenantId),
  ]);

  const byStatus: Record<string, number> = {};
  for (const r of (ordersByStatus.data ?? []) as Array<{ order_status: string }>) {
    byStatus[r.order_status] = (byStatus[r.order_status] ?? 0) + 1;
  }

  const recent = (ordersRecent.data ?? []) as Array<{
    total_amount: string | null;
    submitted_at: string | null;
    acknowledged_at: string | null;
    estimated_delivery_date: string | null;
    actual_delivery_date: string | null;
  }>;
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
  const onTimeDelivered = recent.filter(
    (r) =>
      r.actual_delivery_date &&
      r.estimated_delivery_date &&
      new Date(r.actual_delivery_date).getTime() <= new Date(r.estimated_delivery_date).getTime(),
  ).length;
  const deliveredCount = recent.filter((r) => r.actual_delivery_date).length;

  const excBySeverity: Record<string, number> = {};
  for (const r of (unresolvedExceptions.data ?? []) as Array<{ severity: string }>) {
    excBySeverity[r.severity] = (excBySeverity[r.severity] ?? 0) + 1;
  }

  const shipmentsByStatus: Record<string, number> = {};
  for (const r of (shipmentsRecent.data ?? []) as Array<{ shipment_status: string }>) {
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
          onTimeDeliveryRate:
            deliveredCount > 0 ? Number(((onTimeDelivered / deliveredCount) * 100).toFixed(1)) : 0,
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
