/**
 * Reading performance_metrics (round 235). Imported by
 * supabase/functions/performance and by the Performance Monitoring page.
 *
 * The page used to draw a 24-hour response-time "trend" as a sine wave around
 * the current value, a weekly throughput chart from a hardcoded weekday
 * multiplier, a resource chart from another sine, five API endpoints with
 * typed-in request counts, and a "Performance Logs" tab of log lines stamped
 * with the current time. None of it was stored anywhere. The metrics endpoint
 * also answered 0 for a metric nobody had recorded, which rendered as 0ms
 * response time and 0% uptime: a perfect score and an outage, from the same
 * absence.
 *
 * Every function here returns null for what was not measured.
 */

export interface MetricRow {
  metric_type?: string | null;
  value?: number | string | null;
  unit?: string | null;
  endpoint?: string | null;
  timestamp?: string | null;
}

/** Output key -> the metric_type a writer stores it under. */
export const METRIC_KEYS = [
  ['responseTime', 'response_time'],
  ['throughput', 'throughput'],
  ['errorRate', 'error_rate'],
  ['uptime', 'uptime'],
  ['memoryUsage', 'memory_usage'],
  ['cpuUsage', 'cpu_usage'],
  ['diskUsage', 'disk_usage'],
  ['activeUsers', 'active_users'],
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number][0];

/** A PostgREST decimal arrives as a string; junk is not a number. */
export function metricValue(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function typeOf(row: MetricRow): string {
  return String(row.metric_type ?? '').trim();
}

function keyForType(type: string): MetricKey | null {
  for (const [key, stored] of METRIC_KEYS) {
    if (type === stored || type === key) return key;
  }
  return null;
}

function time(row: MetricRow): number | null {
  if (!row.timestamp) return null;
  const t = new Date(row.timestamp).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * The newest value per metric, whatever order the rows arrive in. A metric
 * with no usable row is null and named in `unreported`.
 */
export function latestMetrics(rows: readonly MetricRow[]): {
  values: Record<MetricKey, number | null>;
  units: Partial<Record<MetricKey, string>>;
  unreported: MetricKey[];
} {
  const best = new Map<MetricKey, { at: number; value: number; unit?: string }>();
  for (const row of rows) {
    const key = keyForType(typeOf(row));
    const value = metricValue(row.value);
    if (!key || value === null) continue;
    const at = time(row) ?? -Infinity;
    const prev = best.get(key);
    if (!prev || at > prev.at) best.set(key, { at, value, unit: row.unit ?? undefined });
  }
  const values = {} as Record<MetricKey, number | null>;
  const units: Partial<Record<MetricKey, string>> = {};
  const unreported: MetricKey[] = [];
  for (const [key] of METRIC_KEYS) {
    const hit = best.get(key);
    values[key] = hit ? hit.value : null;
    if (hit?.unit) units[key] = hit.unit;
    if (!hit) unreported.push(key);
  }
  return { values, units, unreported };
}

export interface SeriesPoint {
  timestamp: string;
  value: number;
}

/** Oldest-first points for one metric; rows with no time or value are skipped. */
export function metricSeries(rows: readonly MetricRow[], key: MetricKey): SeriesPoint[] {
  const out: Array<SeriesPoint & { at: number }> = [];
  for (const row of rows) {
    if (keyForType(typeOf(row)) !== key) continue;
    const at = time(row);
    const value = metricValue(row.value);
    if (at === null || value === null) continue;
    out.push({ at, timestamp: new Date(at).toISOString(), value });
  }
  out.sort((a, b) => a.at - b.at);
  return out.map(({ timestamp, value }) => ({ timestamp, value }));
}

export interface EndpointStat {
  endpoint: string;
  samples: number;
  avgResponseTime: number;
}

/**
 * Mean response time per endpoint, from response_time rows that name one.
 * `samples` is how many readings were averaged, not a request count: a
 * reading is whatever the writer chose to record, so calling it "requests"
 * would claim a traffic figure nothing measured.
 */
export function endpointBreakdown(rows: readonly MetricRow[]): EndpointStat[] {
  const acc = new Map<string, { sum: number; n: number }>();
  for (const row of rows) {
    if (keyForType(typeOf(row)) !== 'responseTime') continue;
    const endpoint = String(row.endpoint ?? '').trim();
    const value = metricValue(row.value);
    if (!endpoint || value === null) continue;
    const a = acc.get(endpoint) ?? { sum: 0, n: 0 };
    a.sum += value;
    a.n += 1;
    acc.set(endpoint, a);
  }
  return [...acc.entries()]
    .map(([endpoint, { sum, n }]) => ({ endpoint, samples: n, avgResponseTime: sum / n }))
    .sort((a, b) => b.avgResponseTime - a.avgResponseTime);
}

/** The longest window the history endpoint pages through in one request. */
export const MAX_HISTORY_DAYS = 92;
