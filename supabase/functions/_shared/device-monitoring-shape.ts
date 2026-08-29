/**
 * Response shapes for the device-monitoring surface, in one place.
 *
 * WHY THIS IS SHARED. /api/device-monitoring is served by
 * server/routes-device-monitoring.ts and by supabase/functions/device-monitoring/.
 * Three routed pages read it - DeviceMonitoring, SupplyRunway and SupplyOrders -
 * and they read flat keys (tonerBlack, serialNumber, currentLevel) that neither
 * table stores under those names. So the shaping IS the contract, and two
 * implementations of it would drift the way this repo's other duplicated
 * projections have. Both hosts import these functions; there is no second copy
 * to keep in sync.
 *
 * ROWS ARRIVE IN EITHER CASE. Drizzle hands back camelCase, PostgREST and raw
 * SQL hand back snake_case, and the same shaper is called with both. `pick`
 * reads whichever spelling is present rather than making each caller normalise
 * first - a caller that forgets is how a field silently becomes undefined.
 */

// deno-lint-ignore-file no-explicit-any
type Row = Record<string, any> | null | undefined;

/** Read a field by camelCase name, falling back to its snake_case spelling. */
function pick(row: Row, camel: string): any {
  if (!row) return undefined;
  if (row[camel] !== undefined) return row[camel];
  const snake = camel.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
  return row[snake];
}

export interface ShapedMetric {
  id: any;
  serialNumber: any;
  deviceId: any;
  ipAddress: any;
  deviceName: any;
  manufacturer: any;
  model: any;
  deviceStatus: any;
  tonerLevels: Record<string, number>;
  paperLevels: Record<string, number>;
  tonerBlack: any;
  tonerCyan: any;
  tonerMagenta: any;
  tonerYellow: any;
  paperTray1: any;
  paperTray2: any;
  paperTray3: any;
  paperTray4: any;
  totalImpressions: any;
  bwImpressions: any;
  colorImpressions: any;
  largeImpressions: any;
  errorCodes: any;
  collectionTimestamp: any;
}

/**
 * Flatten the tonerLevels / paperLevels jsonb into the flat keys the UI reads,
 * keeping the original objects so a newer surface can iterate them.
 */
export function shapeMetricForUi(metric: Row, registration: Row): ShapedMetric {
  const toner = (pick(metric, 'tonerLevels') || {}) as Record<string, number>;
  const paper = (pick(metric, 'paperLevels') || {}) as Record<string, number>;
  return {
    id: pick(metric, 'id'),
    serialNumber: pick(registration, 'serialNumber') ?? null,
    deviceId: pick(metric, 'deviceId'),
    ipAddress: pick(registration, 'ipAddress') ?? null,
    deviceName: pick(registration, 'deviceName') ?? null,
    manufacturer: pick(registration, 'manufacturer') ?? null,
    model: pick(registration, 'model') ?? null,
    deviceStatus: pick(metric, 'deviceStatus') ?? 'unknown',
    tonerLevels: toner,
    paperLevels: paper,
    tonerBlack: toner.black,
    tonerCyan: toner.cyan,
    tonerMagenta: toner.magenta,
    tonerYellow: toner.yellow,
    paperTray1: paper.tray1,
    paperTray2: paper.tray2,
    paperTray3: paper.tray3,
    paperTray4: paper.tray4,
    totalImpressions: pick(metric, 'totalImpressions'),
    bwImpressions: pick(metric, 'bwImpressions'),
    colorImpressions: pick(metric, 'colorImpressions'),
    largeImpressions: pick(metric, 'largeImpressions'),
    errorCodes: pick(metric, 'errorCodes'),
    collectionTimestamp: pick(metric, 'collectionTimestamp'),
  };
}

/**
 * Decorate an alert with the device fields the dashboard shows.
 *
 * device_alerts deliberately does not store deviceName/serialNumber - the
 * materializer writes it on every metric submission, so denormalising there
 * would multiply the write cost - and they are joined at read time instead.
 *
 * A snooze that has elapsed reads as 'active' here rather than waiting for the
 * next submit cycle to flip it, so the dashboard does not hide an alert that is
 * live again.
 */
export function decorateAlert(alert: Row, registration: Row, now: Date = new Date()) {
  let status = pick(alert, 'status');
  const snoozedUntil = pick(alert, 'snoozedUntil');
  if (status === 'snoozed' && snoozedUntil && new Date(snoozedUntil) <= now) {
    status = 'active';
  }
  const currentValue = pick(alert, 'currentValue');
  return {
    id: pick(alert, 'id'),
    tenantId: pick(alert, 'tenantId'),
    deviceId: pick(alert, 'deviceId'),
    serialNumber: pick(registration, 'serialNumber') ?? null,
    deviceName: pick(registration, 'deviceName') ?? null,
    supplyType: pick(alert, 'supplyType'),
    alertType: pick(alert, 'alertType'),
    severity: pick(alert, 'severity'),
    // The UI reads currentLevel; the column is current_value. Both are sent so
    // neither name has to change on one side only.
    currentLevel: currentValue,
    currentValue,
    threshold: pick(alert, 'threshold'),
    status,
    message: pick(alert, 'message'),
    acknowledgedAt: pick(alert, 'acknowledgedAt'),
    acknowledgedBy: pick(alert, 'acknowledgedBy'),
    snoozedUntil,
    resolvedAt: pick(alert, 'resolvedAt'),
    triggeredOrderId: pick(alert, 'triggeredOrderId'),
    firstSeenAt: pick(alert, 'firstSeenAt'),
    lastSeenAt: pick(alert, 'lastSeenAt'),
    createdAt: pick(alert, 'createdAt'),
  };
}

/**
 * The freshest metric per device.
 *
 * Postgres does this with DISTINCT ON, which PostgREST cannot express, so the
 * edge function orders by (device_id, collection_timestamp desc) and keeps the
 * first row it sees for each device. Given that ordering this is exactly
 * DISTINCT ON; given any other ordering it is not, which is why the caller must
 * not reorder before calling.
 */
export function latestPerDevice<T extends Record<string, any>>(
  rowsOrderedByDeviceThenTime: T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rowsOrderedByDeviceThenTime) {
    const deviceId = String(pick(row, 'deviceId') ?? '');
    if (!deviceId || seen.has(deviceId)) continue;
    seen.add(deviceId);
    out.push(row);
  }
  return out;
}

/** Alert statuses the dashboard treats as open. */
export const OPEN_ALERT_STATUSES = ['active', 'acknowledged', 'snoozed'] as const;

// ─── Supply forecasting ─────────────────────────────────────────────────────

export interface SupplySample {
  deviceId: string;
  collectionTimestamp: string | Date;
  tonerLevels: Record<string, unknown> | null;
  serialNumber?: string | null;
  deviceName?: string | null;
  manufacturer?: string | null;
  model?: string | null;
}

export interface SupplyForecast {
  deviceId: string;
  serialNumber: string | null;
  deviceName: string | null;
  manufacturer: string | null;
  model: string | null;
  supply: string;
  currentLevel: number;
  consumptionPerDay: number;
  daysRemaining: number;
  expectedEmptyAt: string;
  sampleCount: number;
  windowDays: number;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Days remaining per device supply, from a window of toner-level samples.
 *
 * Pure, so both hosts run the identical arithmetic and it can be tested without
 * a database. Callers pass rows ordered by (device, timestamp ASC); the
 * ordering is load-bearing for swap detection below.
 *
 * WHAT THE RULES ARE FOR, since each one exists to avoid a specific wrong answer:
 *   - A level that RISES by more than 5 points is a cartridge swap, not
 *     consumption. The segment resets there, so a refill does not produce a
 *     negative burn rate and an infinite runway.
 *   - Under half a day of data forecasts nothing: two samples an hour apart
 *     turn a rounding step into a consumption rate.
 *   - Consumption at or below 0.05 points/day is treated as idle rather than
 *     slow, because dividing by it yields runways of decades.
 *   - Confidence is sample count weighted by how much of the window they cover,
 *     so eight readings from one afternoon do not read as well as eight spread
 *     across two weeks.
 */
export function forecastSupplies(
  samples: SupplySample[],
  opts: { windowDays: number; lowOnly?: boolean; now?: number },
): SupplyForecast[] {
  const { windowDays, lowOnly = false } = opts;
  const now = opts.now ?? Date.now();

  type Point = { ts: number; level: number };
  const perDevice = new Map<
    string,
    {
      meta: Omit<
        SupplyForecast,
        | 'supply'
        | 'currentLevel'
        | 'consumptionPerDay'
        | 'daysRemaining'
        | 'expectedEmptyAt'
        | 'sampleCount'
        | 'windowDays'
        | 'confidence'
      >;
      bySupply: Map<string, Point[]>;
    }
  >();

  for (const row of samples) {
    const deviceId = String(pick(row, 'deviceId') ?? '');
    if (!deviceId) continue;
    if (!perDevice.has(deviceId)) {
      perDevice.set(deviceId, {
        meta: {
          deviceId,
          serialNumber: pick(row, 'serialNumber') ?? null,
          deviceName: pick(row, 'deviceName') ?? null,
          manufacturer: pick(row, 'manufacturer') ?? null,
          model: pick(row, 'model') ?? null,
        },
        bySupply: new Map(),
      });
    }
    const entry = perDevice.get(deviceId)!;
    const levels = (pick(row, 'tonerLevels') || {}) as Record<string, unknown>;
    const ts = new Date(pick(row, 'collectionTimestamp')).getTime();
    if (!Number.isFinite(ts)) continue;
    for (const [supply, raw] of Object.entries(levels)) {
      const level = Number(raw);
      if (!Number.isFinite(level) || level < 0 || level > 100) continue;
      if (!entry.bySupply.has(supply)) entry.bySupply.set(supply, []);
      entry.bySupply.get(supply)!.push({ ts, level });
    }
  }

  const forecasts: SupplyForecast[] = [];
  for (const { meta, bySupply } of perDevice.values()) {
    for (const [supply, points] of bySupply) {
      let segment: Point[] = [];
      for (let i = 0; i < points.length; i++) {
        if (i > 0 && points[i].level > points[i - 1].level + 5) segment = [];
        segment.push(points[i]);
      }
      if (segment.length < 2) continue;

      const first = segment[0];
      const last = segment[segment.length - 1];
      const dropPct = first.level - last.level;
      const dtDays = (last.ts - first.ts) / (1000 * 60 * 60 * 24);
      if (dtDays < 0.5) continue;

      const consumptionPerDay = dropPct / dtDays;
      if (consumptionPerDay <= 0.05) continue;

      const daysRemaining = last.level / consumptionPerDay;
      if (lowOnly && daysRemaining >= 14) continue;

      const coverageRatio = dtDays / windowDays;
      const confidence: SupplyForecast['confidence'] =
        segment.length >= 8 && coverageRatio > 0.6
          ? 'high'
          : segment.length >= 4 && coverageRatio > 0.3
            ? 'medium'
            : 'low';

      forecasts.push({
        ...meta,
        supply,
        currentLevel: Math.round(last.level),
        consumptionPerDay: Math.round(consumptionPerDay * 100) / 100,
        daysRemaining: Math.round(daysRemaining * 10) / 10,
        expectedEmptyAt: new Date(last.ts + daysRemaining * 24 * 60 * 60 * 1000).toISOString(),
        sampleCount: segment.length,
        windowDays,
        confidence,
      });
    }
  }

  // Most urgent first.
  forecasts.sort((a, b) => a.daysRemaining - b.daysRemaining);
  return forecasts;
}
