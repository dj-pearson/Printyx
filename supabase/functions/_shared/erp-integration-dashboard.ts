// ERP / system-integration dashboard aggregation (PROD-014a).
//
// PostgREST expresses no GROUP BY, SUM or AVG, so the edge function fetches
// bounded row sets and every rollup happens here. Keeping it pure - rows in,
// dashboard out, no Deno or Node API - means the arithmetic is unit testable
// from vitest without a database or an edge runtime. Same arrangement as
// _shared/workflow-dashboard.ts.
//
// THREE RULES THIS SHAPE OBEYS:
//
//  1. NULL IS NOT ZERO. successRate and averageLatencyMs are null when no
//     metrics rows fall in the window. A 0% success rate reads as a total
//     outage; "no data" reads as no data. The handler this replaced returned a
//     98.7% sync rate and a 99.94% uptime for every tenant, invented, so
//     getting the empty case honest is the whole point.
//
//  2. LATENCY IS WEIGHTED BY CALL COUNT. avg_latency_ms is a per-period
//     average; averaging those averages weights a quiet hour the same as a busy
//     one. A period with zero calls contributes nothing rather than dragging
//     the mean toward its own stored value.
//
//  3. FIELDS WITH NO COLUMN ARE NAMED, NOT ZEROED. The page used to read
//     workflow orchestration, sync conflict resolution, data-quality scoring,
//     field mapping and per-system auth detail. Nothing in the schema holds any
//     of them, so they are absent from the response and listed in `unbacked`,
//     which is the response saying out loud what it cannot answer.

export const WINDOW_DAYS = 30;

/** What no table in this repo can answer, stated on the response itself. */
export const UNBACKED_FIELDS = [
  'businessProcessAutomation',
  'dataSynchronization.conflictResolution',
  'dataSynchronization.dataQuality',
  'fieldMapping',
  'systemAuthentication',
] as const;

export type SystemRow = {
  id: string | number;
  name?: string | null;
  provider?: string | null;
  type?: string | null;
  status?: string | null;
  last_sync?: string | null;
  error_message?: string | null;
  created_at?: string | null;
};

export type MetricRow = {
  integration_id: string | number;
  total_api_calls?: number | string | null;
  successful_calls?: number | string | null;
  failed_calls?: number | string | null;
  avg_latency_ms?: number | string | null;
  records_synced?: number | string | null;
  data_volume_bytes?: number | string | null;
  errors_by_type?: Record<string, unknown> | null;
  period_end?: string | null;
};

export interface SystemMetrics {
  totalApiCalls: number;
  successfulCalls: number;
  failedCalls: number;
  /** null when no period carried any calls. */
  avgLatencyMs: number | null;
  recordsSynced: number;
  dataVolumeBytes: number;
  errorsByType: Record<string, number>;
}

export interface ErpDashboard {
  integrationOverview: {
    windowDays: number;
    totalIntegrations: number;
    activeIntegrations: number;
    failedIntegrations: number;
    lastSyncCompleted: string | null;
    totalApiCalls: number;
    successfulCalls: number;
    failedCalls: number;
    successRate: number | null;
    averageLatencyMs: number | null;
    recordsSynced: number;
    dataVolumeBytes: number;
  };
  systems: {
    id: string;
    name: string | null;
    provider: string | null;
    type: string | null;
    status: string | null;
    lastSync: string | null;
    errorMessage: string | null;
    createdAt: string | null;
    metrics: SystemMetrics;
  }[];
  unbacked: readonly string[];
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

export function emptyMetrics(): SystemMetrics {
  return {
    totalApiCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    avgLatencyMs: null,
    recordsSynced: 0,
    dataVolumeBytes: 0,
    errorsByType: {},
  };
}

export function buildErpDashboard(systems: SystemRow[], metrics: MetricRow[]): ErpDashboard {
  const byIntegration = new Map<string, SystemMetrics>();
  /** Calls behind each system's latency figure, so the tenant roll-up can reuse the weight. */
  const latencyWeight = new Map<string, number>();
  const latencySum = new Map<string, number>();

  for (const row of metrics) {
    const key = String(row.integration_id);
    const current = byIntegration.get(key) ?? emptyMetrics();
    const calls = num(row.total_api_calls);

    current.totalApiCalls += calls;
    current.successfulCalls += num(row.successful_calls);
    current.failedCalls += num(row.failed_calls);
    current.recordsSynced += num(row.records_synced);
    current.dataVolumeBytes += num(row.data_volume_bytes);

    // A period with no calls carries no information about latency, whatever
    // avg_latency_ms happens to hold on that row.
    if (row.avg_latency_ms !== null && row.avg_latency_ms !== undefined && calls > 0) {
      latencySum.set(key, (latencySum.get(key) ?? 0) + num(row.avg_latency_ms) * calls);
      latencyWeight.set(key, (latencyWeight.get(key) ?? 0) + calls);
    }

    for (const [type, count] of Object.entries(row.errors_by_type ?? {})) {
      current.errorsByType[type] = (current.errorsByType[type] ?? 0) + num(count);
    }

    byIntegration.set(key, current);
  }

  for (const [key, m] of byIntegration) {
    const weight = latencyWeight.get(key) ?? 0;
    m.avgLatencyMs = weight > 0 ? Math.round((latencySum.get(key) ?? 0) / weight) : null;
  }

  let totalApiCalls = 0;
  let successfulCalls = 0;
  let failedCalls = 0;
  let recordsSynced = 0;
  let dataVolumeBytes = 0;
  let tenantLatencySum = 0;
  let tenantLatencyCalls = 0;

  // Only systems still present in the registry count toward the roll-up; metrics
  // for an integration someone deleted are not this tenant's current traffic.
  for (const s of systems) {
    const m = byIntegration.get(String(s.id));
    if (!m) continue;
    totalApiCalls += m.totalApiCalls;
    successfulCalls += m.successfulCalls;
    failedCalls += m.failedCalls;
    recordsSynced += m.recordsSynced;
    dataVolumeBytes += m.dataVolumeBytes;
    const weight = latencyWeight.get(String(s.id)) ?? 0;
    if (weight > 0) {
      tenantLatencySum += latencySum.get(String(s.id)) ?? 0;
      tenantLatencyCalls += weight;
    }
  }

  const lastSyncCompleted =
    systems
      .map((s) => (s.last_sync ? String(s.last_sync) : null))
      .filter((v): v is string => v !== null)
      .sort()
      .pop() ?? null;

  return {
    integrationOverview: {
      windowDays: WINDOW_DAYS,
      totalIntegrations: systems.length,
      activeIntegrations: systems.filter((s) => s.status === 'active').length,
      failedIntegrations: systems.filter((s) => s.status === 'error').length,
      lastSyncCompleted,
      totalApiCalls,
      successfulCalls,
      failedCalls,
      successRate: totalApiCalls > 0 ? (successfulCalls / totalApiCalls) * 100 : null,
      averageLatencyMs:
        tenantLatencyCalls > 0 ? Math.round(tenantLatencySum / tenantLatencyCalls) : null,
      recordsSynced,
      dataVolumeBytes,
    },
    systems: systems.map((s) => ({
      id: String(s.id),
      name: s.name ?? null,
      provider: s.provider ?? null,
      type: s.type ?? null,
      status: s.status ?? null,
      lastSync: s.last_sync ?? null,
      errorMessage: s.error_message ?? null,
      createdAt: s.created_at ?? null,
      metrics: byIntegration.get(String(s.id)) ?? emptyMetrics(),
    })),
    unbacked: UNBACKED_FIELDS,
  };
}
