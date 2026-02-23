// =====================================================================
// SALES REPORTING SERVICE
// Business logic for sales reports (Levels 1-4)
// =====================================================================

import { db } from '../db';
import { sql, eq, and, inArray, gte, lte, desc, asc } from 'drizzle-orm';
import { HierarchicalQueryBuilder } from '../middleware/hierarchical-query-builder';
import type { EnhancedUserContext } from '../middleware/enhanced-rbac-middleware';
import {
  getCachedQuery,
  setCachedQuery,
  invalidateQueryCache,
  buildReportCacheKey,
  REPORT_CACHE_TTL,
} from '../lib/query-cache';

// =====================================================================
// TYPE DEFINITIONS
// =====================================================================

export interface DateRange {
  dateFrom: Date;
  dateTo: Date;
}

export interface PipelineStage {
  stage: string;
  count: number;
  totalValue: number;
  weightedValue: number;
  averageDealSize: number;
  conversionRate: number;
}

export interface ActivityMetric {
  date: string;
  calls: number;
  emails: number;
  meetings: number;
  demos: number;
  proposals: number;
}

export interface QuotaAttainment {
  userId: string;
  userName: string;
  quotaAmount: number;
  actualRevenue: number;
  attainmentPercent: number;
  dealsWon: number;
  averageDealSize: number;
  rank: number;
  trend: 'up' | 'down' | 'flat';
}

export interface CommissionEarning {
  dealId: string;
  dealName: string;
  customerName: string;
  closeDate: Date;
  dealValue: number;
  commissionRate: number;
  commissionAmount: number;
  status: 'pending' | 'approved' | 'paid';
  paymentDate?: Date;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  userAvatar?: string;
  metricValue: number;
  metricLabel: string;
  change: number;
  trend: 'up' | 'down' | 'flat';
}

export interface TeamComparison {
  userId: string;
  userName: string;
  pipelineValue: number;
  dealsInProgress: number;
  winRate: number;
  averageDealSize: number;
  activitiesThisWeek: number;
  quotaAttainment: number;
}

// =====================================================================
// CACHE SERVICE
// =====================================================================

interface CachedData<T> {
  data: T;
  cachedAt: Date;
  expiresAt: Date;
}

class ReportCache {
  private static cache = new Map<string, CachedData<any>>();
  private static DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  static get<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (cached.expiresAt < new Date()) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  static set<T>(key: string, data: T, ttlMs: number = this.DEFAULT_TTL): void {
    const now = new Date();
    this.cache.set(key, {
      data,
      cachedAt: now,
      expiresAt: new Date(now.getTime() + ttlMs),
    });
  }

  static invalidate(pattern: string): void {
    for (const [key] of this.cache) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  static clear(): void {
    this.cache.clear();
  }
}

// =====================================================================
// SALES REPORTING SERVICE
// =====================================================================

export class SalesReportingService {
  /**
   * Report 1: Personal Pipeline Report
   * Shows individual sales rep's pipeline by stage
   */
  static async getPersonalPipeline(
    userContext: EnhancedUserContext,
    dateRange?: Partial<DateRange>,
  ): Promise<PipelineStage[]> {
    const cacheKey = `pipeline:${userContext.id}:${JSON.stringify(dateRange)}`;
    const cached = ReportCache.get<PipelineStage[]>(cacheKey);
    if (cached) return cached;

    const queryBuilder = new HierarchicalQueryBuilder(userContext);

    const result = await db.execute(sql`
      SELECT
        o.stage,
        COUNT(o.id)::int as count,
        SUM(o.amount)::decimal as total_value,
        SUM(o.weighted_amount)::decimal as weighted_value,
        AVG(o.amount)::decimal as average_deal_size,
        CASE
          WHEN LAG(COUNT(o.id)) OVER (ORDER BY
            CASE o.stage
              WHEN 'Lead' THEN 1
              WHEN 'Qualified' THEN 2
              WHEN 'Discovery' THEN 3
              WHEN 'Proposal' THEN 4
              WHEN 'Negotiation' THEN 5
              WHEN 'Closed Won' THEN 6
              ELSE 7
            END
          ) > 0
          THEN (COUNT(o.id)::decimal / LAG(COUNT(o.id)) OVER (ORDER BY
            CASE o.stage
              WHEN 'Lead' THEN 1
              WHEN 'Qualified' THEN 2
              WHEN 'Discovery' THEN 3
              WHEN 'Proposal' THEN 4
              WHEN 'Negotiation' THEN 5
              WHEN 'Closed Won' THEN 6
              ELSE 7
            END
          ) * 100)
          ELSE 0
        END as conversion_rate
      FROM opportunities o
      WHERE o.ownerId = ${userContext.id}
        AND o.tenantId = ${userContext.tenantId}
        AND o.stage NOT IN ('Closed Lost', 'Cancelled')
        ${dateRange?.dateFrom ? sql`AND o.createdAt >= ${dateRange.dateFrom}` : sql``}
        ${dateRange?.dateTo ? sql`AND o.createdAt <= ${dateRange.dateTo}` : sql``}
      GROUP BY o.stage
      ORDER BY
        CASE o.stage
          WHEN 'Lead' THEN 1
          WHEN 'Qualified' THEN 2
          WHEN 'Discovery' THEN 3
          WHEN 'Proposal' THEN 4
          WHEN 'Negotiation' THEN 5
          WHEN 'Closed Won' THEN 6
          ELSE 7
        END
    `);

    const stages: PipelineStage[] = result.rows.map((row: any) => ({
      stage: row.stage,
      count: parseInt(row.count),
      totalValue: parseFloat(row.total_value || 0),
      weightedValue: parseFloat(row.weighted_value || 0),
      averageDealSize: parseFloat(row.average_deal_size || 0),
      conversionRate: parseFloat(row.conversion_rate || 0),
    }));

    ReportCache.set(cacheKey, stages);
    return stages;
  }

  /**
   * Report 2: Personal Activity Report
   * Shows daily/weekly activity metrics
   */
  static async getPersonalActivity(
    userContext: EnhancedUserContext,
    dateRange: DateRange,
    granularity: 'day' | 'week' = 'day',
  ): Promise<ActivityMetric[]> {
    const cacheKey = `activity:${userContext.id}:${granularity}:${dateRange.dateFrom}-${dateRange.dateTo}`;
    const cached = ReportCache.get<ActivityMetric[]>(cacheKey);
    if (cached) return cached;

    const dateFormat = granularity === 'day' ? 'YYYY-MM-DD' : 'IYYY-IW';

    const result = await db.execute(sql`
      SELECT
        TO_CHAR(a.activity_date, ${dateFormat}) as date,
        SUM(CASE WHEN a.activity_type = 'call' THEN 1 ELSE 0 END)::int as calls,
        SUM(CASE WHEN a.activity_type = 'email' THEN 1 ELSE 0 END)::int as emails,
        SUM(CASE WHEN a.activity_type = 'meeting' THEN 1 ELSE 0 END)::int as meetings,
        SUM(CASE WHEN a.activity_type = 'demo' THEN 1 ELSE 0 END)::int as demos,
        SUM(CASE WHEN a.activity_type = 'proposal' THEN 1 ELSE 0 END)::int as proposals
      FROM activities a
      WHERE a.userId = ${userContext.id}
        AND a.tenantId = ${userContext.tenantId}
        AND a.activity_date >= ${dateRange.dateFrom}
        AND a.activity_date <= ${dateRange.dateTo}
      GROUP BY TO_CHAR(a.activity_date, ${dateFormat})
      ORDER BY date
    `);

    const activities: ActivityMetric[] = result.rows.map((row: any) => ({
      date: row.date,
      calls: parseInt(row.calls),
      emails: parseInt(row.emails),
      meetings: parseInt(row.meetings),
      demos: parseInt(row.demos),
      proposals: parseInt(row.proposals),
    }));

    ReportCache.set(cacheKey, activities);
    return activities;
  }

  /**
   * Report 3: Personal Quota Attainment
   * Shows quota vs actual performance
   */
  static async getPersonalQuotaAttainment(
    userContext: EnhancedUserContext,
    period: 'current' | 'previous' | 'ytd' = 'current',
  ): Promise<QuotaAttainment> {
    const cacheKey = `quota:${userContext.id}:${period}`;
    const cached = ReportCache.get<QuotaAttainment>(cacheKey);
    if (cached) return cached;

    let dateFilter: any;
    switch (period) {
      case 'current':
        dateFilter = sql`DATE_TRUNC('month', CURRENT_DATE)`;
        break;
      case 'previous':
        dateFilter = sql`DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')`;
        break;
      case 'ytd':
        dateFilter = sql`DATE_TRUNC('year', CURRENT_DATE)`;
        break;
    }

    const result = await db.execute(sql`
      WITH quota_data AS (
        SELECT
          u.id as user_id,
          CONCAT(u.firstName, ' ', u.lastName) as user_name,
          COALESCE(q.quota_amount, 0) as quota_amount
        FROM users u
        LEFT JOIN quotas q ON q.userId = u.id
          AND q.quota_period = ${period === 'ytd' ? 'yearly' : 'monthly'}
          AND q.quota_year = EXTRACT(YEAR FROM CURRENT_DATE)
          ${period !== 'ytd' ? sql`AND q.quota_month = EXTRACT(MONTH FROM ${dateFilter})` : sql``}
        WHERE u.id = ${userContext.id}
      ),
      revenue_data AS (
        SELECT
          SUM(o.amount) as actual_revenue,
          COUNT(o.id)::int as deals_won,
          AVG(o.amount) as avg_deal_size
        FROM opportunities o
        WHERE o.ownerId = ${userContext.id}
          AND o.tenantId = ${userContext.tenantId}
          AND o.stage = 'Closed Won'
          AND o.close_date >= ${dateFilter}
          ${period !== 'ytd' ? sql`AND o.close_date < ${dateFilter} + INTERVAL '1 month'` : sql``}
      )
      SELECT
        qd.userId,
        qd.user_name,
        qd.quota_amount,
        COALESCE(rd.actual_revenue, 0)::decimal as actual_revenue,
        CASE
          WHEN qd.quota_amount > 0
          THEN (COALESCE(rd.actual_revenue, 0) / qd.quota_amount * 100)
          ELSE 0
        END as attainment_percent,
        COALESCE(rd.deals_won, 0) as deals_won,
        COALESCE(rd.avg_deal_size, 0)::decimal as average_deal_size
      FROM quota_data qd
      CROSS JOIN revenue_data rd
    `);

    const row = result.rows[0] as any;

    const attainment: QuotaAttainment = {
      userId: row.userId,
      userName: row.user_name,
      quotaAmount: parseFloat(row.quota_amount || 0),
      actualRevenue: parseFloat(row.actual_revenue || 0),
      attainmentPercent: parseFloat(row.attainment_percent || 0),
      dealsWon: parseInt(row.deals_won || 0),
      averageDealSize: parseFloat(row.average_deal_size || 0),
      rank: 1, // Will be calculated in leaderboard query
      trend: 'flat', // Will be calculated by comparing to previous period
    };

    ReportCache.set(cacheKey, attainment);
    return attainment;
  }

  /**
   * Report 4: Personal Commission Report
   * Shows commission earnings by deal
   */
  static async getPersonalCommissions(
    userContext: EnhancedUserContext,
    dateRange: DateRange,
    status?: 'pending' | 'approved' | 'paid',
  ): Promise<CommissionEarning[]> {
    const cacheKey = `commission:${userContext.id}:${dateRange.dateFrom}-${dateRange.dateTo}:${status}`;
    const cached = ReportCache.get<CommissionEarning[]>(cacheKey);
    if (cached) return cached;

    const result = await db.execute(sql`
      SELECT
        o.id as deal_id,
        o.name as deal_name,
        c.name as customer_name,
        o.close_date,
        o.amount as deal_value,
        COALESCE(cp.commission_rate, 0.10) as commission_rate,
        o.amount * COALESCE(cp.commission_rate, 0.10) as commission_amount,
        COALESCE(cp.status, 'pending') as status,
        cp.payment_date
      FROM opportunities o
      JOIN business_records c ON o.customerId = c.id
      LEFT JOIN commission_plans cp ON cp.userId = ${userContext.id}
        AND cp.opportunity_id = o.id
      WHERE o.ownerId = ${userContext.id}
        AND o.tenantId = ${userContext.tenantId}
        AND o.stage = 'Closed Won'
        AND o.close_date >= ${dateRange.dateFrom}
        AND o.close_date <= ${dateRange.dateTo}
        ${status ? sql`AND COALESCE(cp.status, 'pending') = ${status}` : sql``}
      ORDER BY o.close_date DESC
    `);

    const commissions: CommissionEarning[] = result.rows.map((row: any) => ({
      dealId: row.deal_id,
      dealName: row.deal_name,
      customerName: row.customer_name,
      closeDate: new Date(row.close_date),
      dealValue: parseFloat(row.deal_value),
      commissionRate: parseFloat(row.commission_rate),
      commissionAmount: parseFloat(row.commission_amount),
      status: row.status,
      paymentDate: row.payment_date ? new Date(row.payment_date) : undefined,
    }));

    ReportCache.set(cacheKey, commissions);
    return commissions;
  }

  /**
   * Report 5: Personal Leaderboard Position
   * Shows user's rank compared to peers
   */
  static async getLeaderboard(
    userContext: EnhancedUserContext,
    metric: 'revenue' | 'deals' | 'pipeline' | 'activities' = 'revenue',
    scope: 'team' | 'location' | 'company' = 'location',
  ): Promise<LeaderboardEntry[]> {
    const cacheKey = buildReportCacheKey(userContext.tenantId, 'leaderboard', { metric, scope });
    const cached = await getCachedQuery<LeaderboardEntry[]>(cacheKey);
    if (cached) return cached;

    const queryBuilder = new HierarchicalQueryBuilder(userContext);
    const userIds = await queryBuilder.getAccessibleUserIds();

    if (userIds.length === 0) {
      return [];
    }

    let metricSql: any;
    let metricLabel: string;

    switch (metric) {
      case 'revenue':
        metricSql = sql`COALESCE(SUM(o.amount) FILTER (WHERE o.stage = 'Closed Won' AND o.close_date >= DATE_TRUNC('month', CURRENT_DATE)), 0)`;
        metricLabel = 'Revenue';
        break;
      case 'deals':
        metricSql = sql`COUNT(o.id) FILTER (WHERE o.stage = 'Closed Won' AND o.close_date >= DATE_TRUNC('month', CURRENT_DATE))`;
        metricLabel = 'Deals Won';
        break;
      case 'pipeline':
        metricSql = sql`COALESCE(SUM(o.amount) FILTER (WHERE o.stage NOT IN ('Closed Won', 'Closed Lost')), 0)`;
        metricLabel = 'Pipeline Value';
        break;
      case 'activities':
        metricSql = sql`COUNT(a.id) FILTER (WHERE a.activity_date >= DATE_TRUNC('week', CURRENT_DATE))`;
        metricLabel = 'Activities';
        break;
    }

    const result = await db.execute(sql`
      WITH current_period AS (
        SELECT
          u.id as user_id,
          CONCAT(u.firstName, ' ', u.lastName) as user_name,
          u.profile_image_url as user_avatar,
          ${metricSql} as metric_value
        FROM users u
        LEFT JOIN opportunities o ON o.ownerId = u.id AND o.tenantId = ${userContext.tenantId}
        LEFT JOIN activities a ON a.userId = u.id AND a.tenantId = ${userContext.tenantId}
        WHERE u.id = ANY(${userIds})
          AND u.tenantId = ${userContext.tenantId}
        GROUP BY u.id, u.firstName, u.lastName, u.profile_image_url
      ),
      ranked AS (
        SELECT
          *,
          RANK() OVER (ORDER BY metric_value DESC) as rank
        FROM current_period
      )
      SELECT
        rank::int,
        user_id,
        user_name,
        user_avatar,
        metric_value::decimal,
        0 as change
      FROM ranked
      ORDER BY rank
      LIMIT 50
    `);

    const leaderboard: LeaderboardEntry[] = result.rows.map((row: any) => ({
      rank: parseInt(row.rank),
      userId: row.userId,
      userName: row.user_name,
      userAvatar: row.user_avatar,
      metricValue: parseFloat(row.metric_value || 0),
      metricLabel,
      change: parseFloat(row.change || 0),
      trend: 'flat' as const,
    }));

    await setCachedQuery(cacheKey, leaderboard, REPORT_CACHE_TTL.REALTIME_DASHBOARD); // 30 second cache for near-realtime leaderboard
    return leaderboard;
  }

  /**
   * Report 6 & 7: Team Comparison Reports
   * Shows performance comparison across team members
   */
  static async getTeamComparison(userContext: EnhancedUserContext): Promise<TeamComparison[]> {
    const cacheKey = buildReportCacheKey(userContext.tenantId, 'team-comparison', {
      userId: userContext.id,
    });
    const cached = await getCachedQuery<TeamComparison[]>(cacheKey);
    if (cached) return cached;

    // Get team members (direct reports)
    const teamMemberIds = await db.execute(sql`
      SELECT id FROM users
      WHERE manager_id = ${userContext.id}
        AND tenant_id = ${userContext.tenantId}
        AND is_active = true
    `);

    const userIds = [userContext.id, ...teamMemberIds.rows.map((r: any) => r.id)];

    const result = await db.execute(sql`
      WITH metrics AS (
        SELECT
          u.id as user_id,
          CONCAT(u.firstName, ' ', u.lastName) as user_name,
          COALESCE(SUM(o.amount) FILTER (WHERE o.stage NOT IN ('Closed Won', 'Closed Lost')), 0) as pipeline_value,
          COUNT(o.id) FILTER (WHERE o.stage NOT IN ('Closed Won', 'Closed Lost'))::int as deals_in_progress,
          CASE
            WHEN COUNT(o.id) FILTER (WHERE o.stage IN ('Closed Won', 'Closed Lost')) > 0
            THEN (COUNT(o.id) FILTER (WHERE o.stage = 'Closed Won')::decimal /
                  COUNT(o.id) FILTER (WHERE o.stage IN ('Closed Won', 'Closed Lost')) * 100)
            ELSE 0
          END as win_rate,
          AVG(o.amount) FILTER (WHERE o.stage = 'Closed Won') as avg_deal_size,
          COUNT(a.id) FILTER (WHERE a.activity_date >= DATE_TRUNC('week', CURRENT_DATE))::int as activities_this_week,
          CASE
            WHEN q.quota_amount > 0
            THEN (COALESCE(SUM(o.amount) FILTER (WHERE o.stage = 'Closed Won' AND o.close_date >= DATE_TRUNC('month', CURRENT_DATE)), 0) / q.quota_amount * 100)
            ELSE 0
          END as quota_attainment
        FROM users u
        LEFT JOIN opportunities o ON o.ownerId = u.id AND o.tenantId = ${userContext.tenantId}
        LEFT JOIN activities a ON a.userId = u.id AND a.tenantId = ${userContext.tenantId}
        LEFT JOIN quotas q ON q.userId = u.id AND q.quota_period = 'monthly'
        WHERE u.id = ANY(${userIds})
          AND u.tenantId = ${userContext.tenantId}
        GROUP BY u.id, u.firstName, u.lastName, q.quota_amount
      )
      SELECT
        user_id,
        user_name,
        pipeline_value::decimal,
        deals_in_progress,
        win_rate::decimal,
        COALESCE(avg_deal_size, 0)::decimal as average_deal_size,
        activities_this_week,
        quota_attainment::decimal
      FROM metrics
      ORDER BY quota_attainment DESC
    `);

    const comparison: TeamComparison[] = result.rows.map((row: any) => ({
      userId: row.userId,
      userName: row.user_name,
      pipelineValue: parseFloat(row.pipeline_value || 0),
      dealsInProgress: parseInt(row.deals_in_progress),
      winRate: parseFloat(row.win_rate || 0),
      averageDealSize: parseFloat(row.average_deal_size || 0),
      activitiesThisWeek: parseInt(row.activities_this_week),
      quotaAttainment: parseFloat(row.quota_attainment || 0),
    }));

    await setCachedQuery(cacheKey, comparison, REPORT_CACHE_TTL.DAILY_REPORT); // 5 minute cache
    return comparison;
  }

  /**
   * Report 7: Get team pipeline summary (for Team Leads)
   */
  static async getTeamPipelineSummary(
    userContext: EnhancedUserContext,
    dateRange?: Partial<DateRange>,
  ): Promise<{
    teamPipeline: PipelineStage[];
    individualPipelines: Array<{
      userId: string;
      userName: string;
      pipeline: PipelineStage[];
      totalValue: number;
    }>;
    summary: {
      totalTeamValue: number;
      totalTeamDeals: number;
      averageDealSize: number;
      teamConversionRate: number;
      topPerformer: { userId: string; userName: string; value: number } | null;
    };
  }> {
    const cacheKey = buildReportCacheKey(userContext.tenantId, 'team-pipeline-summary', {
      userId: userContext.id,
      dateFrom: dateRange?.dateFrom?.toISOString(),
      dateTo: dateRange?.dateTo?.toISOString(),
    });
    const cached = await getCachedQuery<any>(cacheKey);
    if (cached) return cached;

    const queryBuilder = new HierarchicalQueryBuilder(userContext);
    const accessibleUserIds = await queryBuilder.getAccessibleUserIds();

    if (accessibleUserIds.length === 0) {
      return {
        teamPipeline: [],
        individualPipelines: [],
        summary: {
          totalTeamValue: 0,
          totalTeamDeals: 0,
          averageDealSize: 0,
          teamConversionRate: 0,
          topPerformer: null,
        },
      };
    }

    const dateFilter =
      dateRange?.dateFrom && dateRange?.dateTo
        ? sql`AND o.createdAt BETWEEN ${dateRange.dateFrom.toISOString()} AND ${dateRange.dateTo.toISOString()}`
        : sql``;

    // Get aggregated team pipeline
    const teamPipelineResult = await db.execute(sql`
      SELECT
        o.stage,
        COUNT(o.id)::int as count,
        SUM(o.amount)::decimal as total_value,
        SUM(o.weighted_amount)::decimal as weighted_value,
        AVG(o.amount)::decimal as average_deal_size,
        COUNT(CASE WHEN o.stage = 'Closed Won' THEN 1 END)::decimal / NULLIF(COUNT(*)::decimal, 0) * 100 as conversion_rate
      FROM opportunities o
      WHERE o.ownerId = ANY(${sql.raw(`ARRAY[${accessibleUserIds.map((id) => `'${id}'`).join(',')}]`)})
        AND o.tenantId = ${userContext.tenantId}
        AND o.stage NOT IN ('Closed Lost', 'Cancelled')
        ${dateFilter}
      GROUP BY o.stage
      ORDER BY CASE o.stage
        WHEN 'Lead' THEN 1
        WHEN 'Qualified' THEN 2
        WHEN 'Proposal' THEN 3
        WHEN 'Negotiation' THEN 4
        WHEN 'Closed Won' THEN 5
        ELSE 6
      END
    `);

    const teamPipeline: PipelineStage[] = teamPipelineResult.rows.map((row: any) => ({
      stage: row.stage,
      count: parseInt(row.count),
      totalValue: parseFloat(row.total_value || 0),
      weightedValue: parseFloat(row.weighted_value || 0),
      averageDealSize: parseFloat(row.average_deal_size || 0),
      conversionRate: parseFloat(row.conversion_rate || 0),
    }));

    // Get individual pipelines for each team member
    const individualPipelines: Array<{
      userId: string;
      userName: string;
      pipeline: PipelineStage[];
      totalValue: number;
    }> = [];

    for (const userId of accessibleUserIds.slice(0, 20)) {
      // Limit to top 20 users for performance
      const userResult = await db.execute(sql`
        SELECT
          u.id as user_id,
          u.fullName as user_name,
          o.stage,
          COUNT(o.id)::int as count,
          SUM(o.amount)::decimal as total_value
        FROM users u
        LEFT JOIN opportunities o ON o.ownerId = u.id
          AND o.tenantId = ${userContext.tenantId}
          AND o.stage NOT IN ('Closed Lost', 'Cancelled')
          ${dateFilter}
        WHERE u.id = ${userId}
        GROUP BY u.id, u.fullName, o.stage
        ORDER BY CASE o.stage
          WHEN 'Lead' THEN 1
          WHEN 'Qualified' THEN 2
          WHEN 'Proposal' THEN 3
          WHEN 'Negotiation' THEN 4
          WHEN 'Closed Won' THEN 5
          ELSE 6
        END
      `);

      if (userResult.rows.length > 0) {
        const userName = userResult.rows[0].user_name;
        const pipeline = userResult.rows.map((row: any) => ({
          stage: row.stage,
          count: parseInt(row.count || 0),
          totalValue: parseFloat(row.total_value || 0),
          weightedValue: 0,
          averageDealSize: 0,
          conversionRate: 0,
        }));

        const totalValue = pipeline.reduce((sum, stage) => sum + stage.totalValue, 0);

        individualPipelines.push({
          userId,
          userName,
          pipeline,
          totalValue,
        });
      }
    }

    // Sort by total value
    individualPipelines.sort((a, b) => b.totalValue - a.totalValue);

    // Calculate summary
    const totalTeamValue = teamPipeline.reduce((sum, stage) => sum + stage.totalValue, 0);
    const totalTeamDeals = teamPipeline.reduce((sum, stage) => sum + stage.count, 0);
    const averageDealSize = totalTeamDeals > 0 ? totalTeamValue / totalTeamDeals : 0;
    const closedWonStage = teamPipeline.find((s) => s.stage === 'Closed Won');
    const teamConversionRate = closedWonStage ? closedWonStage.conversionRate : 0;
    const topPerformer =
      individualPipelines.length > 0
        ? {
            userId: individualPipelines[0].userId,
            userName: individualPipelines[0].userName,
            value: individualPipelines[0].totalValue,
          }
        : null;

    const result = {
      teamPipeline,
      individualPipelines,
      summary: {
        totalTeamValue,
        totalTeamDeals,
        averageDealSize,
        teamConversionRate,
        topPerformer,
      },
    };

    await setCachedQuery(cacheKey, result, REPORT_CACHE_TTL.DAILY_REPORT); // 5 minute cache
    return result;
  }

  /**
   * Invalidate all caches for a user
   */
  static async invalidateUserCache(userId: string): Promise<void> {
    await invalidateQueryCache(`*${userId}*`);
  }

  /**
   * Clear all caches
   */
  static async clearAllCaches(): Promise<void> {
    await invalidateQueryCache(`*leaderboard*`);
    await invalidateQueryCache(`*team-comparison*`);
    await invalidateQueryCache(`*team-pipeline-summary*`);
  }
}

export default SalesReportingService;
