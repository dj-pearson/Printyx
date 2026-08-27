/**
 * Response shapes for /api/reports/sales/* (CR-034).
 *
 * Transcribed from the handler that produces them,
 * supabase/functions/reports/handlers/sales.ts, not from what a page happens to
 * read. `apiRequest` is declared `apiRequest<T = any>`, so an untyped useQuery
 * hands back `any` and every field read below it goes unchecked — a renamed key
 * on the server renders blank instead of failing a build. That is the drift this
 * story exists to stop.
 *
 * Where the handler is DEGRADED it says so, and the type records it: the quota
 * and commission endpoints return zeroed structures because `sales_quotas` and a
 * commissions table do not exist. A page showing 0% attainment is showing
 * "unknown", not "you have sold nothing".
 */

/** One stage bucket from aggregateByStage(). */
export interface SalesPipelineStage {
  stage: string;
  count: number;
  totalValue: number;
  weightedValue: number;
}

/** GET /api/reports/sales/personal/pipeline */
export interface PersonalPipelineReport {
  pipeline: SalesPipelineStage[];
  totalDeals: number;
  totalValue: number;
  weightedValue: number;
}

/** One day (or week) of activity counts. */
export interface ActivityBucket {
  date: string;
  calls: number;
  emails: number;
  meetings: number;
  demos: number;
  proposals: number;
}

export type ActivityTotals = Omit<ActivityBucket, 'date'>;

/** GET /api/reports/sales/personal/activity */
export interface PersonalActivityReport {
  activities: ActivityBucket[];
  totals: ActivityTotals;
  averagePerDay: ActivityTotals;
}

/**
 * GET /api/reports/sales/personal/quota
 *
 * Always the degraded shape today — there is no `sales_quotas` table, so every
 * number is 0 and `degraded.quotasTable` says why.
 */
export interface PersonalQuotaReport {
  quota: {
    quotaAmount: number;
    actualRevenue: number;
    attainmentPercent: number;
    averageDealSize: number;
    period: string;
  };
  performance: {
    onTrack: boolean;
    gap: number;
    gapPercent: number;
    dealsNeeded: number;
  };
  degraded?: Record<string, boolean>;
}

/** GET /api/reports/sales/personal/commissions — degraded, as above. */
export interface PersonalCommissionsReport {
  commissions: unknown[];
  summary: {
    totalCommission: number;
    pending: number;
    approved: number;
    paid: number;
    count: number;
  };
  degraded?: Record<string, boolean>;
}

export interface LeaderboardEntry {
  userId: string;
  userName: string;
  revenue: number;
  deals: number;
  pipeline: number;
  /** Always 0: the handler does not join business_record_activities yet. */
  activities: number;
  rank: number;
}

/** GET /api/reports/sales/personal/leaderboard */
export interface SalesLeaderboardReport {
  leaderboard: LeaderboardEntry[];
  /** Absent when the current user has no closed or open opportunities. */
  myPosition?: LeaderboardEntry;
  totalParticipants: number;
  percentile: number;
  scope: string;
  metric: string;
  degraded?: Record<string, boolean>;
}
