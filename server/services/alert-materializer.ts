// Materialises supply-level alerts into the `device_alerts` table.
//
// Called once per device on every /api/client-metrics/submit. The
// function is idempotent: running it twice with the same metric is a
// no-op. Operators' acknowledge / snooze state is preserved across
// repeated calls.
//
// Design notes:
//   - We DO NOT delete rows. Resolution flips `status='resolved'` so
//     history is queryable (for reporting / forecasting / audits).
//   - The `(tenant, device, supply)` unique-on-open partial index
//     guarantees there's at most one open alert per supply, so the
//     check-then-insert dance below is safe under concurrent /submit
//     calls (the second insert raises a unique violation, which we
//     translate into an update of the existing row).
//   - Snooze expiry is checked at materialisation time: if a snoozed
//     alert is still tripping its threshold and snoozed_until <= now,
//     we revert status to 'active'. This means a stale snooze can't
//     hide a real problem after it was supposed to lapse.

import { db } from '../db';
import { deviceAlerts } from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { createModuleLogger } from '../lib/logger';
import { maybeAutoOrder } from './auto-order';

const log = createModuleLogger('alert-materializer');

const TONER_WARN = 20;
const TONER_CRIT = 10;

export interface MaterializeInput {
  tenantId: string;
  deviceId: string;
  tonerLevels?: Record<string, number | null | undefined>;
  paperLevels?: Record<string, number | null | undefined>;
}

interface DesiredAlert {
  alertType: 'low' | 'critical' | 'empty';
  severity: 'warning' | 'critical';
  threshold: number;
  message: string;
}

function computeDesired(supply: string, level: number): DesiredAlert | null {
  if (level === 0) {
    return {
      alertType: 'empty',
      severity: 'critical',
      threshold: 0,
      message: `${supply} is empty (0%)`,
    };
  }
  if (level <= TONER_CRIT) {
    return {
      alertType: 'critical',
      severity: 'critical',
      threshold: TONER_CRIT,
      message: `${supply} critically low (${level}%)`,
    };
  }
  if (level <= TONER_WARN) {
    return {
      alertType: 'low',
      severity: 'warning',
      threshold: TONER_WARN,
      message: `${supply} low (${level}%)`,
    };
  }
  return null;
}

export async function materializeAlerts(input: MaterializeInput): Promise<void> {
  const { tenantId, deviceId, tonerLevels = {}, paperLevels = {} } = input;
  const now = new Date();

  // Build the union of supplies we care about. Toner uses the colour
  // names directly; paper trays are namespaced as `paper-tray1` etc.
  const supplies: Array<{ key: string; level: number }> = [];
  for (const [color, raw] of Object.entries(tonerLevels)) {
    if (typeof raw !== 'number' || raw < 0 || raw > 100) continue;
    supplies.push({ key: color, level: raw });
  }
  for (const [tray, raw] of Object.entries(paperLevels)) {
    if (typeof raw !== 'number' || raw < 0 || raw > 100) continue;
    supplies.push({ key: `paper-${tray}`, level: raw });
  }

  for (const { key, level } of supplies) {
    try {
      await materializeOne(tenantId, deviceId, key, level, now);
    } catch (err) {
      log.warn(`Alert materialise failed for device=${deviceId} supply=${key}`, { err });
    }
  }
}

async function materializeOne(
  tenantId: string,
  deviceId: string,
  supply: string,
  level: number,
  now: Date,
): Promise<void> {
  const desired = computeDesired(supply, level);

  // Look up the current open alert for this (tenant, device, supply).
  const existing = await db.query.deviceAlerts.findFirst({
    where: and(
      eq(deviceAlerts.tenantId, tenantId),
      eq(deviceAlerts.deviceId, deviceId),
      eq(deviceAlerts.supplyType, supply),
      inArray(deviceAlerts.status, ['active', 'acknowledged', 'snoozed']),
    ),
  });

  // Case A: condition cleared and we had an open alert → resolve it.
  if (!desired) {
    if (existing) {
      await db
        .update(deviceAlerts)
        .set({
          status: 'resolved',
          resolvedAt: now,
          currentValue: level,
          lastSeenAt: now,
          updatedAt: now,
        })
        .where(eq(deviceAlerts.id, existing.id));
    }
    return;
  }

  // Case B: condition is tripping and we don't have an open row → insert.
  // This is the only path that can trigger auto-order: an alert
  // *transition* into an open state, not a re-affirmation of an
  // already-open one. Prevents oscillation from spamming the order queue.
  if (!existing) {
    const [created] = await db
      .insert(deviceAlerts)
      .values({
        tenantId,
        deviceId,
        supplyType: supply,
        alertType: desired.alertType,
        severity: desired.severity,
        currentValue: level,
        threshold: desired.threshold,
        status: 'active',
        message: desired.message,
        firstSeenAt: now,
        lastSeenAt: now,
      })
      .returning({ id: deviceAlerts.id });

    // Fire-and-forget the auto-order check; result is logged inside.
    if (created?.id) {
      try {
        await maybeAutoOrder({
          alertId: created.id,
          tenantId,
          deviceId,
          supplyType: supply,
          alertType: desired.alertType,
        });
      } catch (err) {
        log.warn('auto-order check failed (non-fatal)', { err });
      }
    }
    return;
  }

  // Case C: condition is tripping and we already have an open row →
  // refresh value/severity. Preserve acknowledge / snooze state.
  // Snooze auto-expires when snoozed_until is in the past.
  let nextStatus = existing.status;
  if (existing.status === 'snoozed' && existing.snoozedUntil && existing.snoozedUntil <= now) {
    nextStatus = 'active';
  }

  await db
    .update(deviceAlerts)
    .set({
      alertType: desired.alertType,
      severity: desired.severity,
      currentValue: level,
      threshold: desired.threshold,
      status: nextStatus,
      message: desired.message,
      lastSeenAt: now,
      updatedAt: now,
    })
    .where(eq(deviceAlerts.id, existing.id));

  // Auto-order on UPGRADE: alert was 'low', now 'critical'/'empty'. We
  // didn't fire on the original low alert (too noisy), but the upgrade
  // is real and warrants an order if one wasn't already triggered.
  const wasLow = existing.alertType === 'low';
  const nowCritical = desired.alertType === 'critical' || desired.alertType === 'empty';
  if (wasLow && nowCritical && !existing.triggeredOrderId) {
    try {
      await maybeAutoOrder({
        alertId: existing.id,
        tenantId,
        deviceId,
        supplyType: supply,
        alertType: desired.alertType,
      });
    } catch (err) {
      log.warn('auto-order on upgrade failed (non-fatal)', { err });
    }
  }
}
