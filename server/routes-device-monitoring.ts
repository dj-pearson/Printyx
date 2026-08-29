// Device monitoring read API.
//
// Backed by the `device_metrics` + `device_registrations` tables — the
// same tables the active /api/client-metrics/submit handler writes to in
// routes-client-monitoring.ts.
//
// Previous version of this file read from `client_collected_metrics` /
// `toner_alerts`, neither of which the active agent populates. That
// drift left DeviceMonitoring.tsx rendering an empty page in
// production. Don't reintroduce reads from those tables; if you need a
// new field, add it to device_metrics or compute on the fly.
import express from 'express';
import { db } from './db';
import {
  deviceRegistrations,
  deviceMetrics,
  deviceAlerts,
  deviceSupplyOrders,
} from '@shared/schema';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { resolveTenant, requireTenant, type TenantRequest } from './middleware/tenancy';
import { enhanceUserContext } from './middleware/rbac-route-helper';
import { createModuleLogger } from './lib/logger';
// One definition of these shapes, shared with supabase/functions/device-monitoring/.
// The pages read flat keys neither table stores, so the shaping IS the contract;
// two copies of it would drift the way this repo's other duplicated projections have.
import {
  shapeMetricForUi,
  decorateAlert,
  forecastSupplies,
} from '../supabase/functions/_shared/device-monitoring-shape';

const log = createModuleLogger('routes-device-monitoring');
const router = express.Router();
router.use(enhanceUserContext);

// =====================================================
// HELPERS
// =====================================================

/** Fetch the latest metric per device for a tenant. Single round-trip via DISTINCT ON. */
async function loadLatestPerDevice(tenantId: string) {
  // Postgres DISTINCT ON gives us the freshest row per deviceId in one query.
  const rows = await db.execute(sql<any>`
    SELECT DISTINCT ON (m.device_id) m.*, r.serial_number, r.ip_address, r.device_name,
                                     r.manufacturer, r.model
      FROM device_metrics m
      LEFT JOIN device_registrations r ON r.id = m.device_id AND r.tenant_id = m.tenant_id
     WHERE m.tenant_id = ${tenantId}
     ORDER BY m.device_id, m.collection_timestamp DESC
     LIMIT 5000
  `);
  // db.execute returns { rows: [...] } from node-postgres
  return (rows as any).rows ?? rows;
}

// =====================================================
// READ ENDPOINTS
// =====================================================

/** Latest metrics for all devices (one row per device). */
router.get('/latest-metrics', resolveTenant, requireTenant, async (req: TenantRequest, res) => {
  try {
    const tenantId = req.tenantId!;
    const rows = await loadLatestPerDevice(tenantId);
    const metrics = rows.map((r: any) =>
      shapeMetricForUi(
        {
          id: r.id,
          deviceId: r.device_id,
          tenantId: r.tenant_id,
          totalImpressions: r.total_impressions,
          bwImpressions: r.bw_impressions,
          colorImpressions: r.color_impressions,
          largeImpressions: r.large_impressions,
          deviceStatus: r.device_status,
          tonerLevels: r.toner_levels,
          paperLevels: r.paper_levels,
          errorCodes: r.error_codes,
          collectionTimestamp: r.collection_timestamp,
        },
        {
          serialNumber: r.serial_number,
          ipAddress: r.ip_address,
          deviceName: r.device_name,
          manufacturer: r.manufacturer,
          model: r.model,
        },
      ),
    );
    res.json({ metrics });
  } catch (error) {
    log.error('Error fetching latest metrics:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/** Time-series history for one device (by serialNumber). */
router.get(
  '/device/:serialNumber/history',
  resolveTenant,
  requireTenant,
  async (req: TenantRequest, res) => {
    try {
      const tenantId = req.tenantId!;
      const { serialNumber } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);

      const reg = await db.query.deviceRegistrations.findFirst({
        where: and(
          eq(deviceRegistrations.tenantId, tenantId),
          eq(deviceRegistrations.serialNumber, serialNumber),
        ),
      });
      if (!reg) return res.json({ metrics: [] });

      const rows = await db.query.deviceMetrics.findMany({
        where: and(eq(deviceMetrics.tenantId, tenantId), eq(deviceMetrics.deviceId, reg.id)),
        orderBy: [desc(deviceMetrics.collectionTimestamp)],
        limit,
      });

      res.json({ metrics: rows.map((r) => shapeMetricForUi(r, reg)) });
    } catch (error) {
      log.error('Error fetching device history:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },
);

/**
 * Active alerts across the fleet. Returns rows in (active | acknowledged
 * | snoozed) status; the UI decides how to filter further. `lastSeenAt`
 * is the most useful sort field — newest first means the supply that
 * last tripped its threshold appears at the top.
 */
router.get('/active-alerts', resolveTenant, requireTenant, async (req: TenantRequest, res) => {
  try {
    const tenantId = req.tenantId!;
    // One query joining to device_registrations to get serial+name in
    // a single round-trip. Drizzle's relational API doesn't expose the
    // partial-unique index trick easily, so we use raw SQL.
    const rows =
      (
        (await db.execute(sql<any>`
          SELECT a.*, r.serial_number, r.device_name
            FROM device_alerts a
            LEFT JOIN device_registrations r ON r.id = a.device_id
                                              AND r.tenant_id = a.tenant_id
           WHERE a.tenant_id = ${tenantId}
             AND a.status IN ('active','acknowledged','snoozed')
           ORDER BY a.severity DESC, a.last_seen_at DESC
           LIMIT 1000
        `)) as any
      ).rows ?? [];
    const alerts = rows.map((r: any) =>
      decorateAlert(
        {
          id: r.id,
          tenantId: r.tenant_id,
          deviceId: r.device_id,
          supplyType: r.supply_type,
          alertType: r.alert_type,
          severity: r.severity,
          currentValue: r.current_value,
          threshold: r.threshold,
          status: r.status,
          message: r.message,
          acknowledgedAt: r.acknowledged_at,
          acknowledgedBy: r.acknowledged_by,
          snoozedUntil: r.snoozed_until,
          resolvedAt: r.resolved_at,
          triggeredOrderId: r.triggered_order_id,
          firstSeenAt: r.first_seen_at,
          lastSeenAt: r.last_seen_at,
          createdAt: r.created_at,
        },
        { serialNumber: r.serial_number, deviceName: r.device_name },
      ),
    );
    res.json({ alerts });
  } catch (error) {
    log.error('Error fetching active alerts:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/** Device-specific alerts (open + recently resolved). */
router.get(
  '/device/:serialNumber/alerts',
  resolveTenant,
  requireTenant,
  async (req: TenantRequest, res) => {
    try {
      const tenantId = req.tenantId!;
      const { serialNumber } = req.params;
      const includeResolved = req.query.includeResolved === 'true';

      const reg = await db.query.deviceRegistrations.findFirst({
        where: and(
          eq(deviceRegistrations.tenantId, tenantId),
          eq(deviceRegistrations.serialNumber, serialNumber),
        ),
      });
      if (!reg) return res.json({ alerts: [] });

      const statuses = includeResolved
        ? ['active', 'acknowledged', 'snoozed', 'resolved']
        : ['active', 'acknowledged', 'snoozed'];

      const rows = await db.query.deviceAlerts.findMany({
        where: and(
          eq(deviceAlerts.tenantId, tenantId),
          eq(deviceAlerts.deviceId, reg.id),
          inArray(deviceAlerts.status, statuses),
        ),
        orderBy: [desc(deviceAlerts.lastSeenAt)],
        limit: 200,
      });

      res.json({ alerts: rows.map((r) => decorateAlert(r, reg)) });
    } catch (error) {
      log.error('Error fetching device alerts:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },
);

/** Acknowledge an alert. Idempotent — re-acking is a no-op. */
router.post(
  '/alerts/:alertId/acknowledge',
  resolveTenant,
  requireTenant,
  async (req: TenantRequest, res) => {
    try {
      const tenantId = req.tenantId!;
      const alert = await db.query.deviceAlerts.findFirst({
        where: and(eq(deviceAlerts.id, req.params.alertId), eq(deviceAlerts.tenantId, tenantId)),
      });
      if (!alert) return res.status(404).json({ message: 'Alert not found' });
      if (alert.status === 'resolved') {
        return res.status(409).json({ message: 'Alert already resolved' });
      }
      await db
        .update(deviceAlerts)
        .set({
          status: 'acknowledged',
          acknowledgedAt: new Date(),
          acknowledgedBy: req.user?.id || null,
          updatedAt: new Date(),
        })
        .where(eq(deviceAlerts.id, alert.id));
      res.json({ message: 'Acknowledged' });
    } catch (error) {
      log.error('Error acknowledging alert:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },
);

/**
 * Snooze an alert for N hours. Body: { hours: number } (default 4).
 * When the snooze elapses, the next /submit cycle (or the read
 * decorator above) flips the alert back to 'active'.
 */
router.post(
  '/alerts/:alertId/snooze',
  resolveTenant,
  requireTenant,
  async (req: TenantRequest, res) => {
    try {
      const tenantId = req.tenantId!;
      const hours = Math.min(
        Math.max(Number(req.body?.hours) || 4, 1),
        24 * 7, // cap at one week
      );
      const alert = await db.query.deviceAlerts.findFirst({
        where: and(eq(deviceAlerts.id, req.params.alertId), eq(deviceAlerts.tenantId, tenantId)),
      });
      if (!alert) return res.status(404).json({ message: 'Alert not found' });
      if (alert.status === 'resolved') {
        return res.status(409).json({ message: 'Alert already resolved' });
      }
      const until = new Date(Date.now() + hours * 60 * 60 * 1000);
      await db
        .update(deviceAlerts)
        .set({
          status: 'snoozed',
          snoozedUntil: until,
          updatedAt: new Date(),
        })
        .where(eq(deviceAlerts.id, alert.id));
      res.json({ message: 'Snoozed', snoozedUntil: until.toISOString() });
    } catch (error) {
      log.error('Error snoozing alert:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },
);

/** Manual resolve. Use when an operator has fixed the underlying
 *  problem before the materializer has seen the next metric. */
router.post(
  '/alerts/:alertId/resolve',
  resolveTenant,
  requireTenant,
  async (req: TenantRequest, res) => {
    try {
      const tenantId = req.tenantId!;
      const alert = await db.query.deviceAlerts.findFirst({
        where: and(eq(deviceAlerts.id, req.params.alertId), eq(deviceAlerts.tenantId, tenantId)),
      });
      if (!alert) return res.status(404).json({ message: 'Alert not found' });
      if (alert.status === 'resolved') {
        return res.json({ message: 'Already resolved' });
      }
      await db
        .update(deviceAlerts)
        .set({ status: 'resolved', resolvedAt: new Date(), updatedAt: new Date() })
        .where(eq(deviceAlerts.id, alert.id));
      res.json({ message: 'Resolved' });
    } catch (error) {
      log.error('Error resolving alert:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },
);

// =====================================================
// SUPPLY RUNWAY FORECAST
// =====================================================
//
// "When will this printer run out of magenta?" — computed from the slope
// of toner-level samples over the last `windowDays` days.
//
// We ignore upward jumps (cartridge swaps), require ≥2 usable samples per
// supply, and clamp the consumption rate to non-zero positive values
// before extrapolating. The result is a per-supply forecast with
// daysRemaining, an ISO date for "expected empty," and a confidence
// signal based on sample count + consistency.

/**
 * GET /api/device-monitoring/supply-forecast
 *  ?windowDays=14   — how far back to look (default 14, max 90)
 *  ?lowOnly=true    — only return supplies with daysRemaining < 14
 *  ?serialNumber=…  — restrict to a single device
 */
router.get('/supply-forecast', resolveTenant, requireTenant, async (req: TenantRequest, res) => {
  try {
    const tenantId = req.tenantId!;
    const windowDays = Math.min(Math.max(Number(req.query.windowDays) || 14, 3), 90);
    const lowOnly = req.query.lowOnly === 'true';
    const serialFilter = (req.query.serialNumber as string | undefined) || undefined;

    // Pull recent samples per device. One query — let Postgres do the
    // window slicing; we filter and aggregate in JS.
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const rows =
      (
        (await db.execute(sql<any>`
        SELECT m.device_id, m.collection_timestamp, m.toner_levels,
               r.serial_number, r.device_name, r.manufacturer, r.model
          FROM device_metrics m
          LEFT JOIN device_registrations r ON r.id = m.device_id
                                            AND r.tenant_id = m.tenant_id
         WHERE m.tenant_id = ${tenantId}
           AND m.collection_timestamp >= ${since}
           ${serialFilter ? sql`AND r.serial_number = ${serialFilter}` : sql``}
         ORDER BY m.device_id, m.collection_timestamp ASC
      `)) as any
      ).rows ?? [];

    // The arithmetic lives in _shared/device-monitoring-shape.ts so the edge
    // function runs the identical rules rather than a second implementation of
    // them, and so swap detection and the confidence bands can be tested
    // without a database.
    const forecasts = forecastSupplies(
      rows.map((r: any) => ({
        deviceId: r.device_id,
        collectionTimestamp: r.collection_timestamp,
        tonerLevels: r.toner_levels,
        serialNumber: r.serial_number,
        deviceName: r.device_name,
        manufacturer: r.manufacturer,
        model: r.model,
      })),
      { windowDays, lowOnly },
    );

    res.json({ windowDays, forecasts });
  } catch (error) {
    log.error('Error computing supply forecast:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/** Fleet statistics: device counts + impressions + active alerts. */
router.get('/statistics', resolveTenant, requireTenant, async (req: TenantRequest, res) => {
  try {
    const tenantId = req.tenantId!;
    const rows = await loadLatestPerDevice(tenantId);
    const total = rows.length;
    let online = 0;
    let totalImpressions = 0;
    for (const r of rows) {
      if (r.device_status === 'online') online++;
      if (typeof r.total_impressions === 'number') totalImpressions += r.total_impressions;
    }
    // Active alerts now come from the materialised table — same source
    // of truth the dashboards read from, so the "active" badge in the
    // header always matches the alert list.
    const [{ count: activeAlerts = 0 } = { count: 0 }] = (
      (await db.execute(sql<any>`
        SELECT COUNT(*)::int AS count
          FROM device_alerts
         WHERE tenant_id = ${tenantId}
           AND status IN ('active','acknowledged')
      `)) as any
    ).rows ?? [{ count: 0 }];
    res.json({
      statistics: {
        totalDevices: total,
        onlineDevices: online,
        totalImpressions,
        activeAlerts,
      },
    });
  } catch (error) {
    log.error('Error fetching statistics:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// =====================================================
// SUPPLY ORDERS (auto + manual)
// =====================================================

/** List orders. Filter by status with ?status=pending,approved (CSV). */
router.get('/supply-orders', resolveTenant, requireTenant, async (req: TenantRequest, res) => {
  try {
    const tenantId = req.tenantId!;
    const filter = (req.query.status as string | undefined)?.split(',').filter(Boolean);

    const rows =
      (
        (await db.execute(sql<any>`
          SELECT o.*, r.serial_number, r.device_name, r.manufacturer, r.model
            FROM device_supply_orders o
            LEFT JOIN device_registrations r ON r.id = o.device_id
                                              AND r.tenant_id = o.tenant_id
           WHERE o.tenant_id = ${tenantId}
             ${
               filter && filter.length > 0
                 ? sql`AND o.status = ANY(${sql.raw(`'{${filter.map((s) => s.replace(/[^a-z]/g, '')).join(',')}}'`)})`
                 : sql``
             }
           ORDER BY o.created_at DESC
           LIMIT 500
        `)) as any
      ).rows ?? [];

    const orders = rows.map((r: any) => ({
      id: r.id,
      tenantId: r.tenant_id,
      customerId: r.customer_id,
      deviceId: r.device_id,
      alertId: r.alert_id,
      supplyType: r.supply_type,
      productSku: r.product_sku,
      productName: r.product_name,
      quantity: r.quantity,
      unitPrice: r.unit_price,
      totalPrice: r.total_price,
      status: r.status,
      triggeredBy: r.triggered_by,
      createdAt: r.created_at,
      approvedAt: r.approved_at,
      orderedAt: r.ordered_at,
      cancelledAt: r.cancelled_at,
      notes: r.notes,
      device: {
        serialNumber: r.serial_number,
        deviceName: r.device_name,
        manufacturer: r.manufacturer,
        model: r.model,
      },
    }));
    res.json({ orders });
  } catch (error) {
    log.error('Error fetching supply orders:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/** Approve a pending order — operator confirms it's a real fulfilment. */
router.post(
  '/supply-orders/:orderId/approve',
  resolveTenant,
  requireTenant,
  async (req: TenantRequest, res) => {
    try {
      const tenantId = req.tenantId!;
      const order = await db.query.deviceSupplyOrders.findFirst({
        where: and(
          eq(deviceSupplyOrders.id, req.params.orderId),
          eq(deviceSupplyOrders.tenantId, tenantId),
        ),
      });
      if (!order) return res.status(404).json({ message: 'Order not found' });
      if (order.status !== 'pending') {
        return res
          .status(409)
          .json({ message: `Order is in status '${order.status}', not 'pending'` });
      }
      await db
        .update(deviceSupplyOrders)
        .set({
          status: 'approved',
          approvedAt: new Date(),
          approvedBy: req.user?.id || null,
          updatedAt: new Date(),
        })
        .where(eq(deviceSupplyOrders.id, order.id));
      res.json({ message: 'Order approved' });
    } catch (error) {
      log.error('Error approving order:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },
);

/** Cancel an order. Also clears the triggered_order_id on the alert
 *  so the next critical reading can fire a fresh auto-order. */
router.post(
  '/supply-orders/:orderId/cancel',
  resolveTenant,
  requireTenant,
  async (req: TenantRequest, res) => {
    try {
      const tenantId = req.tenantId!;
      const order = await db.query.deviceSupplyOrders.findFirst({
        where: and(
          eq(deviceSupplyOrders.id, req.params.orderId),
          eq(deviceSupplyOrders.tenantId, tenantId),
        ),
      });
      if (!order) return res.status(404).json({ message: 'Order not found' });
      if (order.status === 'cancelled') {
        return res.json({ message: 'Already cancelled' });
      }
      if (order.status === 'shipped' || order.status === 'delivered') {
        return res.status(409).json({ message: `Cannot cancel order in status '${order.status}'` });
      }
      await db
        .update(deviceSupplyOrders)
        .set({ status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() })
        .where(eq(deviceSupplyOrders.id, order.id));
      // Clear the alert's pointer so a future critical can re-trigger.
      if (order.alertId) {
        await db
          .update(deviceAlerts)
          .set({ triggeredOrderId: null, updatedAt: new Date() })
          .where(eq(deviceAlerts.id, order.alertId));
      }
      res.json({ message: 'Order cancelled' });
    } catch (error) {
      log.error('Error cancelling order:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },
);

export default router;
