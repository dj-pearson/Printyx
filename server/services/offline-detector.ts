// Offline detection.
//
// The /submit pipeline only flags supply-level problems. If a device
// stops reporting entirely (powered off, network unplugged, agent
// crashed, broken NIC) it goes invisible — no SNMP/HTTP cycle ever
// runs against it, no metric arrives, and the supply-alert pipeline
// has no signal.
//
// The fix is symmetric: a periodic sweep checks
// `device_registrations.last_seen` for every device. Anything stale
// beyond `OFFLINE_THRESHOLD_MS` gets a materialised offline alert.
// When a fresh /submit lands for a device, `resolveOfflineFor()`
// clears any open offline alert in O(1).
//
// Implementation note: this lives in-process behind `setInterval`.
// Single-replica deployments are fine. For multi-replica setups, gate
// `startOfflineSweep()` on a leader-election or distributed lock so
// the sweep doesn't run concurrently.

import { db } from '../db';
import { deviceRegistrations, deviceAlerts } from '@shared/schema';
import { and, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { createModuleLogger } from '../lib/logger';

const log = createModuleLogger('offline-detector');

// Two thresholds — warning then critical. Default values assume the
// agent's ~5-minute polling cadence. After 6 missed cycles → warning;
// after 24 missed cycles (2 hours) → critical.
const OFFLINE_WARN_MS = Number(process.env.OFFLINE_WARN_MS) || 30 * 60 * 1000;
const OFFLINE_CRIT_MS = Number(process.env.OFFLINE_CRIT_MS) || 2 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = Number(process.env.OFFLINE_SWEEP_INTERVAL_MS) || 5 * 60 * 1000;

const OFFLINE_SUPPLY_TYPE = 'device';

export function startOfflineSweep(): NodeJS.Timeout {
  log.info(
    `Offline sweep starting (warn=${OFFLINE_WARN_MS}ms, crit=${OFFLINE_CRIT_MS}ms, every ${SWEEP_INTERVAL_MS}ms)`,
  );
  // Run once at startup so a freshly-deployed server doesn't wait a
  // full interval before catching anything stale.
  void sweepOfflineDevices();
  return setInterval(() => {
    sweepOfflineDevices().catch((err) => log.warn('offline sweep failed', { err }));
  }, SWEEP_INTERVAL_MS);
}

/**
 * One pass of the sweep. Cheap query — Postgres returns devices that
 * haven't reported in the warn window, plus their currently open
 * offline alert (if any). We branch on those four states.
 */
export async function sweepOfflineDevices(): Promise<void> {
  const now = new Date();
  const warnCutoff = new Date(now.getTime() - OFFLINE_WARN_MS);
  const critCutoff = new Date(now.getTime() - OFFLINE_CRIT_MS);

  // Pull all stale devices in one query, joined with their open offline
  // alert (LEFT JOIN — null when no alert exists yet).
  const rows =
    (
      (await db.execute(sql<any>`
        SELECT r.id          AS device_id,
               r.tenant_id   AS tenant_id,
               r.last_seen   AS last_seen,
               r.serial_number,
               a.id          AS alert_id,
               a.severity    AS alert_severity,
               a.status      AS alert_status
          FROM device_registrations r
          LEFT JOIN device_alerts a
                 ON a.device_id   = r.id
                AND a.tenant_id   = r.tenant_id
                AND a.supply_type = ${OFFLINE_SUPPLY_TYPE}
                AND a.status     IN ('active','acknowledged','snoozed')
         WHERE r.last_seen IS NULL OR r.last_seen <= ${warnCutoff}
         LIMIT 5000
      `)) as any
    ).rows ?? [];

  let opened = 0;
  let upgraded = 0;
  for (const row of rows) {
    const lastSeen = row.last_seen ? new Date(row.last_seen) : null;
    const isCritical = lastSeen ? lastSeen <= critCutoff : true;
    const desiredSeverity = isCritical ? 'critical' : 'warning';
    const desiredAlertType = isCritical ? 'critical' : 'low';

    const message = lastSeen
      ? `Device offline since ${lastSeen.toISOString()} (last seen ${formatAgo(lastSeen, now)})`
      : `Device has never reported`;

    if (!row.alert_id) {
      // Case 1: no open alert → insert one.
      try {
        await db.insert(deviceAlerts).values({
          tenantId: row.tenant_id,
          deviceId: row.device_id,
          supplyType: OFFLINE_SUPPLY_TYPE,
          alertType: desiredAlertType,
          severity: desiredSeverity,
          status: 'active',
          message,
          firstSeenAt: lastSeen || now,
          lastSeenAt: now,
        });
        opened++;
      } catch (err) {
        // Likely a unique-violation race with another sweep / concurrent
        // /submit auto-resolve. Safe to ignore.
        log.debug('offline alert insert race (ignored)', {
          deviceId: row.device_id,
          err: err instanceof Error ? err.message : err,
        });
      }
      continue;
    }

    // Case 2: alert already exists. Refresh + upgrade severity if the
    // device crossed into the critical window. Don't downgrade — once
    // critical, stay critical until /submit resolves it.
    if (row.alert_severity !== 'critical' && desiredSeverity === 'critical') {
      await db
        .update(deviceAlerts)
        .set({
          severity: 'critical',
          alertType: 'critical',
          lastSeenAt: now,
          message,
          updatedAt: now,
        })
        .where(eq(deviceAlerts.id, row.alert_id));
      upgraded++;
    } else {
      // Just touch lastSeenAt so the dashboard sort stays useful.
      await db
        .update(deviceAlerts)
        .set({ lastSeenAt: now, message, updatedAt: now })
        .where(eq(deviceAlerts.id, row.alert_id));
    }
  }

  if (opened > 0 || upgraded > 0) {
    log.info(`offline sweep: opened=${opened} upgraded=${upgraded} stale=${rows.length}`);
  }
}

/**
 * Resolve any open offline alert for a device. Called from the
 * /submit handler the moment a fresh metric arrives.
 *
 * No-op if there's no open offline alert — cheap query.
 */
export async function resolveOfflineFor(tenantId: string, deviceId: string): Promise<void> {
  try {
    const now = new Date();
    await db
      .update(deviceAlerts)
      .set({
        status: 'resolved',
        resolvedAt: now,
        lastSeenAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(deviceAlerts.tenantId, tenantId),
          eq(deviceAlerts.deviceId, deviceId),
          eq(deviceAlerts.supplyType, OFFLINE_SUPPLY_TYPE),
          inArray(deviceAlerts.status, ['active', 'acknowledged', 'snoozed']),
        ),
      );
  } catch (err) {
    log.warn('resolveOfflineFor failed (non-fatal)', {
      tenantId,
      deviceId,
      err,
    });
  }
}

function formatAgo(then: Date, now: Date): string {
  const ms = now.getTime() - then.getTime();
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
