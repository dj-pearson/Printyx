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
import { deviceRegistrations, deviceMetrics, deviceAlerts } from '@shared/schema';
import { eq, and, desc, sql, gte, inArray } from 'drizzle-orm';
import { resolveTenant, requireTenant, type TenantRequest } from './middleware/tenancy';
import { enhanceUserContext } from './middleware/rbac-route-helper';
import { createModuleLogger } from './lib/logger';

const log = createModuleLogger('routes-device-monitoring');
const router = express.Router();
router.use(enhanceUserContext);

// =====================================================
// HELPERS
// =====================================================

const TONER_WARN = 20;
const TONER_CRIT = 10;

/**
 * Flattens the tonerLevels / paperLevels jsonb objects to the flat
 * column shape the existing UI expects (`tonerBlack`, `tonerCyan`, …).
 * Keeps the original `tonerLevels` object too so newer surfaces can
 * iterate over it dynamically.
 */
function shapeMetricForUi(m: any, registration: any) {
  const t = (m.tonerLevels || {}) as Record<string, number>;
  const p = (m.paperLevels || {}) as Record<string, number>;
  return {
    id: m.id,
    serialNumber: registration?.serialNumber ?? null,
    deviceId: m.deviceId,
    ipAddress: registration?.ipAddress ?? null,
    deviceName: registration?.deviceName ?? null,
    manufacturer: registration?.manufacturer ?? null,
    model: registration?.model ?? null,
    deviceStatus: m.deviceStatus ?? 'unknown',
    tonerLevels: t,
    paperLevels: p,
    tonerBlack: t.black,
    tonerCyan: t.cyan,
    tonerMagenta: t.magenta,
    tonerYellow: t.yellow,
    paperTray1: p.tray1,
    paperTray2: p.tray2,
    paperTray3: p.tray3,
    paperTray4: p.tray4,
    totalImpressions: m.totalImpressions,
    bwImpressions: m.bwImpressions,
    colorImpressions: m.colorImpressions,
    largeImpressions: m.largeImpressions,
    errorCodes: m.errorCodes,
    collectionTimestamp: m.collectionTimestamp,
  };
}

/**
 * Decorate an alert row with device-level fields for the dashboard.
 * The materialised table doesn't store deviceName/serialNumber to keep
 * write-amplification down — we join here at read time.
 */
function decorateAlert(alert: any, reg: any) {
  // A snoozed alert whose snooze has elapsed should appear as 'active'
  // even before the next /submit cycle re-runs the materializer.
  let status = alert.status;
  if (status === 'snoozed' && alert.snoozedUntil && new Date(alert.snoozedUntil) <= new Date()) {
    status = 'active';
  }
  return {
    id: alert.id,
    tenantId: alert.tenantId,
    deviceId: alert.deviceId,
    serialNumber: reg?.serialNumber ?? null,
    deviceName: reg?.deviceName ?? null,
    supplyType: alert.supplyType,
    alertType: alert.alertType,
    severity: alert.severity,
    currentLevel: alert.currentValue,
    currentValue: alert.currentValue,
    threshold: alert.threshold,
    status,
    message: alert.message,
    acknowledgedAt: alert.acknowledgedAt,
    acknowledgedBy: alert.acknowledgedBy,
    snoozedUntil: alert.snoozedUntil,
    resolvedAt: alert.resolvedAt,
    firstSeenAt: alert.firstSeenAt,
    lastSeenAt: alert.lastSeenAt,
    createdAt: alert.createdAt,
  };
}

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

interface SupplyForecast {
  deviceId: string;
  serialNumber: string | null;
  deviceName: string | null;
  manufacturer: string | null;
  model: string | null;
  supply: string; // 'black' | 'cyan' | 'magenta' | 'yellow' | …
  currentLevel: number;
  consumptionPerDay: number; // percentage points / day (positive)
  daysRemaining: number; // null when not forecastable
  expectedEmptyAt: string | null; // ISO timestamp
  sampleCount: number;
  windowDays: number;
  confidence: 'high' | 'medium' | 'low';
}

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

    // Group samples by device, then by supply.
    type Sample = { ts: number; level: number };
    const perDevice = new Map<
      string,
      {
        meta: any;
        bySupply: Map<string, Sample[]>;
      }
    >();

    for (const r of rows) {
      const deviceId = r.device_id as string;
      if (!perDevice.has(deviceId)) {
        perDevice.set(deviceId, {
          meta: {
            deviceId,
            serialNumber: r.serial_number,
            deviceName: r.device_name,
            manufacturer: r.manufacturer,
            model: r.model,
          },
          bySupply: new Map(),
        });
      }
      const t = (r.toner_levels || {}) as Record<string, unknown>;
      for (const [supply, raw] of Object.entries(t)) {
        const level = Number(raw);
        if (!Number.isFinite(level) || level < 0 || level > 100) continue;
        const ts = new Date(r.collection_timestamp).getTime();
        const arr = perDevice.get(deviceId)!.bySupply.get(supply) || [];
        arr.push({ ts, level });
        perDevice.get(deviceId)!.bySupply.set(supply, arr);
      }
    }

    const forecasts: SupplyForecast[] = [];
    for (const { meta, bySupply } of perDevice.values()) {
      for (const [supply, samples] of bySupply.entries()) {
        if (samples.length < 2) continue;

        // Drop upward jumps — those are cartridge swaps, not consumption.
        // Specifically, when level[i] > level[i-1] + 5 we treat it as a
        // reset and only use the segment from the swap onward.
        let segment: Sample[] = [];
        for (let i = 0; i < samples.length; i++) {
          if (i > 0 && samples[i].level > samples[i - 1].level + 5) {
            segment = []; // reset
          }
          segment.push(samples[i]);
        }
        if (segment.length < 2) continue;

        const first = segment[0];
        const last = segment[segment.length - 1];
        const dropPct = first.level - last.level;
        const dtDays = (last.ts - first.ts) / (1000 * 60 * 60 * 24);
        if (dtDays < 0.5) continue; // need at least half a day of data
        const consumptionPerDay = dropPct / dtDays;

        // Only forecast when there is real consumption (>0.05 %pt/day).
        if (consumptionPerDay <= 0.05) continue;

        const daysRemaining = last.level / consumptionPerDay;
        const expectedEmptyAt = new Date(
          last.ts + daysRemaining * 24 * 60 * 60 * 1000,
        ).toISOString();

        // Confidence = how many samples we used, weighted by window coverage.
        const coverageRatio = dtDays / windowDays;
        const confidence: SupplyForecast['confidence'] =
          segment.length >= 8 && coverageRatio > 0.6
            ? 'high'
            : segment.length >= 4 && coverageRatio > 0.3
              ? 'medium'
              : 'low';

        if (lowOnly && daysRemaining >= 14) continue;

        forecasts.push({
          ...meta,
          supply,
          currentLevel: Math.round(last.level),
          consumptionPerDay: Math.round(consumptionPerDay * 100) / 100,
          daysRemaining: Math.round(daysRemaining * 10) / 10,
          expectedEmptyAt,
          sampleCount: segment.length,
          windowDays,
          confidence,
        });
      }
    }

    // Most urgent first.
    forecasts.sort((a, b) => a.daysRemaining - b.daysRemaining);
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

export default router;
