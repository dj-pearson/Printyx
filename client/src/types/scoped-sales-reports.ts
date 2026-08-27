/**
 * Response shapes for /api/reports/sales-{manager,supervisor}/* (CR-034).
 *
 * Transcribed from supabase/functions/reports/handlers/scoped-sales.ts.
 *
 * ONE SET OF TYPES SERVES BOTH DASHBOARDS. The manager is region-scoped and the
 * supervisor location-scoped, and their URLs differ
 * (`/sales-manager/regional-pipeline` vs
 * `/sales-supervisor/location/pipeline-overview`), but a single handler answers
 * both — the queries are identical and only the scoping unit changes. The
 * responses say which unit they are for in a `unit` field, and every collection
 * of them is called `regions` even when the unit is a location, because that is
 * what the handler emits. Renaming it here would be a lie about the wire.
 *
 * Two things are DEGRADED, and the types record it rather than letting a page
 * present a zero as a measurement: there is no `sales_quotas` table, so quota
 * attainment is always 0 and every unit is reported `atRisk`.
 */

export type ScopeUnit = 'region' | 'location';

/** One stage, summed across every unit in scope. */
export interface ScopedStageAggregate {
  stage: string;
  totalDeals: number;
  totalValue: number;
  avgValuePerRegion: number;
}

/** One unit's pipeline totals. */
export interface ScopedUnitPipeline {
  unitId: string;
  unitName: string;
  totalDeals: number;
  totalValue: number;
}

/** GET .../regional-pipeline | .../location/pipeline-overview */
export interface ScopedPipelineReport {
  unit: ScopeUnit;
  aggregated: ScopedStageAggregate[];
  byUnit: ScopedUnitPipeline[];
  summary: {
    totalDeals: number;
    totalValue: number;
    /** Share of deals in Closed Won, as a percentage. */
    healthScore: number;
  };
  insights: {
    stageBreakdown: Record<
      string,
      { totalDeals: number; totalValue: number; avgValuePerRegion: number }
    >;
    healthStatus: 'healthy' | 'fair' | 'needs_attention';
  };
}

export interface ScopedUnitPerformance {
  unitId: string;
  unitName: string;
  revenue: number;
  deals: number;
  winRate: number;
  pipelineValue: number;
  /** Always 0 — there is no sales_quotas table. */
  quotaAttainment: number;
}

/** GET .../regional-performance | .../location/performance */
export interface ScopedPerformanceReport {
  unit: ScopeUnit;
  regions: ScopedUnitPerformance[];
  summary: {
    totalUnits: number;
    totalRevenue: number;
    totalPipeline: number;
    averageWinRate: number;
  };
  /** Every unit lands in `atRisk` while quotas are unknowable. */
  attainmentRanges: {
    exceeding: number;
    onTrack: number;
    nearTarget: number;
    atRisk: number;
  };
  degraded?: Record<string, boolean>;
}

/**
 * GET .../regional-quota | .../location/quota
 *
 * Always the degraded shape: `regions` is empty and every total is 0.
 */
export interface ScopedQuotaReport {
  unit: ScopeUnit;
  regions: unknown[];
  summary: {
    totalQuota: number;
    totalActual: number;
    averageAttainment: number;
  };
  degraded?: Record<string, boolean>;
}

export interface ScopedActivityCounts {
  calls: number;
  emails: number;
  meetings: number;
  demos: number;
  proposals: number;
}

export interface ScopedUnitActivity extends ScopedActivityCounts {
  unitId: string;
  unitName: string;
}

/** GET .../regional-activity | .../location/activity */
export interface ScopedActivityReport {
  unit: ScopeUnit;
  regions: ScopedUnitActivity[];
  totals: ScopedActivityCounts;
}
