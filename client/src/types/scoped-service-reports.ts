/**
 * Response shapes for /api/reports/service-{manager,supervisor}/* (CR-034).
 *
 * Transcribed from supabase/functions/reports/handlers/scoped-service.ts.
 *
 * As with the sales pair, ONE HANDLER SERVES BOTH DASHBOARDS: the manager is
 * region-scoped and the supervisor location-scoped, the URLs differ
 * (`regional-service-calls` vs `location-service-calls`), and the code behind
 * them is the same with only the scoping unit changed. Every per-unit collection
 * is called `regions` even when the unit is a location, because that is what the
 * handler emits.
 *
 * THREE THINGS ARE DEGRADED and the types record it rather than letting a page
 * present a zero as a measurement:
 *   - SLA has no data at all. service_tickets has no sla_deadline column, so the
 *     endpoint returns a zeroed structure unconditionally.
 *   - First-time-fix rate, SLA compliance and customer satisfaction are `null`
 *     on every performance row for the same reason: nothing records them.
 *   - Activity is a COUNT of business_record_activities, not hours. There is no
 *     travel/diagnostic/repair/documentation breakdown anywhere in the schema.
 */

export type ServiceScopeUnit = 'region' | 'location';

/** One unit's service-call volume. */
export interface ScopedServiceCallsUnit {
  unitId: string;
  unitName: string;
  totalCalls: number;
  completedCalls: number;
  inProgressCalls: number;
  openCalls: number;
  /** Distinct technicians with at least one ticket in range. */
  technicians: number;
  completionRate: number;
}

/** GET .../regional-service-calls | .../location-service-calls */
export interface ScopedServiceCallsReport {
  unit: ServiceScopeUnit;
  regions: ScopedServiceCallsUnit[];
  summary: {
    totalUnits: number;
    totalCalls: number;
    totalCompleted: number;
    totalTechnicians: number;
  };
}

export interface ScopedServicePerformanceUnit {
  unitId: string;
  unitName: string;
  totalCalls: number;
  completedCalls: number;
  completionRate: number;
  /** Mean minutes from scheduled_date to resolved_at on completed tickets. */
  avgResolutionMinutes: number;
  /** Always null — nothing records a first-time-fix flag. */
  ftfRate: number | null;
  /** Always null — service_tickets has no sla_deadline. */
  slaCompliance: number | null;
  /** Always null — no satisfaction survey table. */
  avgSatisfaction: number | null;
}

/** GET .../regional-performance | .../location-performance */
export interface ScopedServicePerformanceReport {
  unit: ServiceScopeUnit;
  regions: ScopedServicePerformanceUnit[];
  summary: {
    totalUnits: number;
    averageCompletionRate: number;
  };
  degraded?: Record<string, boolean>;
}

/**
 * GET .../regional-sla | .../location-sla
 *
 * Always the degraded shape: `regions` is empty and every total is 0.
 */
export interface ScopedServiceSlaReport {
  unit: ServiceScopeUnit;
  regions: unknown[];
  summary: {
    totalCalls: number;
    onTime: number;
    atRisk: number;
    overdue: number;
    complianceRate: number;
  };
  degraded?: Record<string, boolean>;
}

/** GET .../regional-activity | .../location-activity */
export interface ScopedServiceActivityReport {
  unit: ServiceScopeUnit;
  regions: Array<{
    unitId: string;
    unitName: string;
    /** A count of service_call / note / task activities, not hours. */
    totalActivities: number;
  }>;
  totals: { totalActivities: number };
}
