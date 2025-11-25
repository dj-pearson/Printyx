// =====================================================================
// TEAM REPORTING SERVICE
// Business logic for team-level reports (Level 2-3: Team Lead, Supervisor)
// Implements Reports 6-10 from RBAC_REPORTING_REQUIREMENTS.md
// =====================================================================

import { db } from '../db';
import { sql, eq, and, inArray, gte, lte, desc, asc } from 'drizzle-orm';
import type { EnhancedUserContext } from '../middleware/enhanced-rbac-middleware';
import { HierarchicalQueryBuilder } from '../middleware/hierarchical-query-builder';

// =====================================================================
// TYPE DEFINITIONS
// =====================================================================

interface DateRange {
  dateFrom?: Date;
  dateTo?: Date;
}

// Report 6: Team Pipeline Comparison
export interface TeamMemberPipeline {
  userId: string;
  userName: string;
  userEmail: string;
  pipelineValue: number;
  weightedPipelineValue: number;
  dealCount: number;
  averageDealSize: number;
  pipelineCoverage: number; // pipeline value / quota
  stageDistribution: {
    stage: string;
    count: number;
    value: number;
  }[];
}

export interface TeamPipelineComparison {
  teamMembers: TeamMemberPipeline[];
  summary: {
    totalPipeline: number;
    totalDeals: number;
    averagePipelinePerRep: number;
    teamPipelineCoverage: number;
    topPerformer: TeamMemberPipeline | null;
  };
  teamInfo: {
    teamLeadId: string;
    teamLeadName: string;
    teamSize: number;
  };
}

// Report 7: Team Activity Leaderboard
export interface TeamMemberActivity {
  userId: string;
  userName: string;
  calls: number;
  emails: number;
  meetings: number;
  demos: number;
  proposals: number;
  totalActivities: number;
  completionRate: number;
  rank: number;
  isLowActivity: boolean; // Flag for coaching
}

export interface TeamActivityLeaderboard {
  activities: TeamMemberActivity[];
  summary: {
    totalActivities: number;
    averagePerRep: number;
    topPerformer: TeamMemberActivity | null;
    lowPerformers: TeamMemberActivity[]; // < 50% of average
  };
}

// Report 8: Team Performance Dashboard
export interface TeamPerformanceDashboard {
  teamRevenue: {
    mtd: number;
    qtd: number;
    ytd: number;
  };
  teamQuota: {
    amount: number;
    achieved: number;
    attainment: number; // percentage
    remaining: number;
  };
  individualQuotas: Array<{
    userId: string;
    userName: string;
    quota: number;
    achieved: number;
    attainment: number;
    onTrack: boolean;
  }>;
  metrics: {
    teamWinRate: number;
    averageSalesCycle: number; // days
    averageLeadResponseTime: number; // hours
  };
}

// Report 9: Lead Management Report
export interface LeadManagementReport {
  leadsCreated: number;
  leadsBySource: Array<{
    source: string;
    count: number;
    conversionRate: number;
  }>;
  leadsByStatus: Array<{
    status: string;
    count: number;
  }>;
  conversionMetrics: {
    overallConversionRate: number;
    averageLeadAge: number; // days
    leadsUnassigned: number;
    leadsOverdueForFollowup: number;
  };
  leadFunnel: Array<{
    stage: string;
    count: number;
    conversionToNext: number; // percentage
  }>;
}

// Report 10: Coaching Report
export interface CoachingOpportunity {
  userId: string;
  userName: string;
  flags: {
    lowActivity: boolean;
    lowConversion: boolean;
    dealsStuck: boolean;
  };
  metrics: {
    callVolume: number;
    callTalkTime: number;
    meetingsHeld: number;
    meetingsPlanned: number;
    quoteVolume: number;
    quoteWinRate: number;
    dealsStuck: number; // > 30 days in stage
    avgStageVelocity: number; // days per stage
  };
  recommendations: string[];
}

export interface CoachingReport {
  opportunities: CoachingOpportunity[];
  summary: {
    totalReps: number;
    needsAttention: number;
    criticalFlags: number;
    improvementAreas: Array<{
      area: string;
      affectedReps: number;
    }>;
  };
}

// =====================================================================
// CACHE SERVICE
// =====================================================================

interface CachedData<T> {
  data: T;
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

  static set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    const expiresAt = new Date(Date.now() + ttl);
    this.cache.set(key, { data, expiresAt });
  }

  static clear(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }
    const keys = Array.from(this.cache.keys());
    keys.forEach(key => {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    });
  }
}

// =====================================================================
// TEAM REPORTING SERVICE
// =====================================================================

export class TeamReportingService {
  /**
   * Report 6: Team Pipeline Comparison
   * Shows pipeline value, coverage, and stage distribution by team member
   * Access: Level 2+ (Team Lead, Senior Sales Rep)
   */
  static async getTeamPipelineComparison(
    userContext: EnhancedUserContext,
    dateRange?: Partial<DateRange>
  ): Promise<TeamPipelineComparison> {
    const cacheKey = `team-pipeline:${userContext.id}:${JSON.stringify(dateRange)}`;
    const cached = ReportCache.get<TeamPipelineComparison>(cacheKey);
    if (cached) return cached;

    const queryBuilder = new HierarchicalQueryBuilder(userContext);
    const accessibleUserIds = await queryBuilder.getAccessibleUserIds();

    if (accessibleUserIds.length === 0) {
      return {
        teamMembers: [],
        summary: {
          totalPipeline: 0,
          totalDeals: 0,
          averagePipelinePerRep: 0,
          teamPipelineCoverage: 0,
          topPerformer: null,
        },
        teamInfo: {
          teamLeadId: userContext.id,
          teamLeadName: userContext.name || 'Unknown',
          teamSize: 0,
        },
      };
    }

    // Build date filter
    const dateFilter = dateRange?.dateFrom && dateRange?.dateTo
      ? sql`AND o.created_at BETWEEN ${dateRange.dateFrom.toISOString()} AND ${dateRange.dateTo.toISOString()}`
      : sql``;

    // Fetch team member pipeline data
    const pipelineQuery = sql`
      SELECT
        u.id as user_id,
        u.name as user_name,
        u.email as user_email,
        COALESCE(SUM(o.amount), 0) as pipeline_value,
        COALESCE(SUM(o.weighted_amount), 0) as weighted_pipeline_value,
        COUNT(o.id) as deal_count,
        COALESCE(AVG(o.amount), 0) as average_deal_size,
        COALESCE(uq.quota_amount, 0) as quota_amount
      FROM users u
      LEFT JOIN opportunities o ON o.owner_id = u.id
        AND o.tenant_id = ${userContext.tenantId}
        AND o.stage NOT IN ('Closed Won', 'Closed Lost')
        ${dateFilter}
      LEFT JOIN (
        SELECT user_id, SUM(amount) as quota_amount
        FROM quotas
        WHERE tenant_id = ${userContext.tenantId}
          AND period_start <= CURRENT_DATE
          AND period_end >= CURRENT_DATE
        GROUP BY user_id
      ) uq ON uq.user_id = u.id
      WHERE u.id = ANY(${accessibleUserIds})
        AND u.tenant_id = ${userContext.tenantId}
      GROUP BY u.id, u.name, u.email, uq.quota_amount
      ORDER BY pipeline_value DESC
    `;

    const pipelineResults = await db.execute(pipelineQuery);

    // Fetch stage distribution for each team member
    const stageQuery = sql`
      SELECT
        o.owner_id as user_id,
        o.stage,
        COUNT(o.id) as count,
        COALESCE(SUM(o.amount), 0) as value
      FROM opportunities o
      WHERE o.owner_id = ANY(${accessibleUserIds})
        AND o.tenant_id = ${userContext.tenantId}
        AND o.stage NOT IN ('Closed Won', 'Closed Lost')
        ${dateFilter}
      GROUP BY o.owner_id, o.stage
      ORDER BY o.owner_id, o.stage
    `;

    const stageResults = await db.execute(stageQuery);

    // Build stage distribution map
    const stageDistributionMap = new Map<string, any[]>();
    for (const row of stageResults.rows) {
      const userId = row.user_id as string;
      if (!stageDistributionMap.has(userId)) {
        stageDistributionMap.set(userId, []);
      }
      stageDistributionMap.get(userId)!.push({
        stage: row.stage as string,
        count: Number(row.count),
        value: Number(row.value),
      });
    }

    // Build team member objects
    const teamMembers: TeamMemberPipeline[] = pipelineResults.rows.map((row: any) => {
      const quotaAmount = Number(row.quota_amount) || 1; // Avoid division by zero
      const pipelineValue = Number(row.pipeline_value);

      return {
        userId: row.user_id,
        userName: row.user_name || 'Unknown',
        userEmail: row.user_email || '',
        pipelineValue,
        weightedPipelineValue: Number(row.weighted_pipeline_value),
        dealCount: Number(row.deal_count),
        averageDealSize: Number(row.average_deal_size),
        pipelineCoverage: (pipelineValue / quotaAmount) * 100,
        stageDistribution: stageDistributionMap.get(row.user_id) || [],
      };
    });

    // Calculate summary
    const totalPipeline = teamMembers.reduce((sum, m) => sum + m.pipelineValue, 0);
    const totalDeals = teamMembers.reduce((sum, m) => sum + m.dealCount, 0);
    const topPerformer = teamMembers.length > 0 ? teamMembers[0] : null;

    const result: TeamPipelineComparison = {
      teamMembers,
      summary: {
        totalPipeline,
        totalDeals,
        averagePipelinePerRep: teamMembers.length > 0 ? totalPipeline / teamMembers.length : 0,
        teamPipelineCoverage: teamMembers.length > 0
          ? teamMembers.reduce((sum, m) => sum + m.pipelineCoverage, 0) / teamMembers.length
          : 0,
        topPerformer,
      },
      teamInfo: {
        teamLeadId: userContext.id,
        teamLeadName: userContext.name || 'Unknown',
        teamSize: teamMembers.length,
      },
    };

    ReportCache.set(cacheKey, result);
    return result;
  }

  /**
   * Report 7: Team Activity Leaderboard
   * Shows activity metrics and rankings for coaching
   * Access: Level 2+ (Team Lead, Senior Sales Rep)
   */
  static async getTeamActivityLeaderboard(
    userContext: EnhancedUserContext,
    dateRange?: Partial<DateRange>
  ): Promise<TeamActivityLeaderboard> {
    const cacheKey = `team-activity:${userContext.id}:${JSON.stringify(dateRange)}`;
    const cached = ReportCache.get<TeamActivityLeaderboard>(cacheKey);
    if (cached) return cached;

    const queryBuilder = new HierarchicalQueryBuilder(userContext);
    const accessibleUserIds = await queryBuilder.getAccessibleUserIds();

    if (accessibleUserIds.length === 0) {
      return {
        activities: [],
        summary: {
          totalActivities: 0,
          averagePerRep: 0,
          topPerformer: null,
          lowPerformers: [],
        },
      };
    }

    // Default to last 30 days if no date range provided
    const dateFrom = dateRange?.dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateTo = dateRange?.dateTo || new Date();

    const activityQuery = sql`
      SELECT
        u.id as user_id,
        u.name as user_name,
        COALESCE(SUM(CASE WHEN a.type = 'call' THEN 1 ELSE 0 END), 0) as calls,
        COALESCE(SUM(CASE WHEN a.type = 'email' THEN 1 ELSE 0 END), 0) as emails,
        COALESCE(SUM(CASE WHEN a.type = 'meeting' THEN 1 ELSE 0 END), 0) as meetings,
        COALESCE(SUM(CASE WHEN a.type = 'demo' THEN 1 ELSE 0 END), 0) as demos,
        COALESCE(SUM(CASE WHEN a.type = 'proposal' THEN 1 ELSE 0 END), 0) as proposals,
        COUNT(a.id) as total_activities,
        COALESCE(AVG(CASE WHEN a.status = 'completed' THEN 1.0 ELSE 0.0 END) * 100, 0) as completion_rate
      FROM users u
      LEFT JOIN activities a ON a.user_id = u.id
        AND a.tenant_id = ${userContext.tenantId}
        AND a.created_at BETWEEN ${dateFrom.toISOString()} AND ${dateTo.toISOString()}
      WHERE u.id = ANY(${accessibleUserIds})
        AND u.tenant_id = ${userContext.tenantId}
      GROUP BY u.id, u.name
      ORDER BY total_activities DESC
    `;

    const results = await db.execute(activityQuery);

    // Calculate average for low activity detection
    const totalActivitiesSum = results.rows.reduce((sum, row: any) => sum + Number(row.total_activities), 0);
    const averagePerRep = results.rows.length > 0 ? totalActivitiesSum / results.rows.length : 0;
    const lowActivityThreshold = averagePerRep * 0.5; // 50% of average

    // Build activity objects with rankings
    const activities: TeamMemberActivity[] = results.rows.map((row: any, index: number) => {
      const totalActivities = Number(row.total_activities);

      return {
        userId: row.user_id,
        userName: row.user_name || 'Unknown',
        calls: Number(row.calls),
        emails: Number(row.emails),
        meetings: Number(row.meetings),
        demos: Number(row.demos),
        proposals: Number(row.proposals),
        totalActivities,
        completionRate: Number(row.completion_rate),
        rank: index + 1,
        isLowActivity: totalActivities < lowActivityThreshold,
      };
    });

    const topPerformer = activities.length > 0 ? activities[0] : null;
    const lowPerformers = activities.filter(a => a.isLowActivity);

    const result: TeamActivityLeaderboard = {
      activities,
      summary: {
        totalActivities: totalActivitiesSum,
        averagePerRep,
        topPerformer,
        lowPerformers,
      },
    };

    ReportCache.set(cacheKey, result);
    return result;
  }

  /**
   * Report 8: Team Performance Dashboard
   * Comprehensive team performance metrics including revenue, quota, win rate
   * Access: Level 3+ (Sales Supervisor)
   */
  static async getTeamPerformanceDashboard(
    userContext: EnhancedUserContext,
    dateRange?: Partial<DateRange>
  ): Promise<TeamPerformanceDashboard> {
    const cacheKey = `team-performance:${userContext.id}:${JSON.stringify(dateRange)}`;
    const cached = ReportCache.get<TeamPerformanceDashboard>(cacheKey);
    if (cached) return cached;

    const queryBuilder = new HierarchicalQueryBuilder(userContext);
    const accessibleUserIds = await queryBuilder.getAccessibleUserIds();

    if (accessibleUserIds.length === 0) {
      return {
        teamRevenue: { mtd: 0, qtd: 0, ytd: 0 },
        teamQuota: { amount: 0, achieved: 0, attainment: 0, remaining: 0 },
        individualQuotas: [],
        metrics: {
          teamWinRate: 0,
          averageSalesCycle: 0,
          averageLeadResponseTime: 0,
        },
      };
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Revenue query (MTD, QTD, YTD)
    const revenueQuery = sql`
      SELECT
        COALESCE(SUM(CASE WHEN o.close_date >= ${startOfMonth.toISOString()} THEN o.amount ELSE 0 END), 0) as mtd,
        COALESCE(SUM(CASE WHEN o.close_date >= ${startOfQuarter.toISOString()} THEN o.amount ELSE 0 END), 0) as qtd,
        COALESCE(SUM(CASE WHEN o.close_date >= ${startOfYear.toISOString()} THEN o.amount ELSE 0 END), 0) as ytd
      FROM opportunities o
      WHERE o.owner_id = ANY(${accessibleUserIds})
        AND o.tenant_id = ${userContext.tenantId}
        AND o.stage = 'Closed Won'
        AND o.close_date <= CURRENT_DATE
    `;

    const revenueResult = await db.execute(revenueQuery);
    const revenue = revenueResult.rows[0] as any;

    // Quota query (team and individual)
    const quotaQuery = sql`
      SELECT
        u.id as user_id,
        u.name as user_name,
        COALESCE(q.amount, 0) as quota_amount,
        COALESCE(rev.revenue, 0) as achieved
      FROM users u
      LEFT JOIN (
        SELECT user_id, SUM(amount) as amount
        FROM quotas
        WHERE tenant_id = ${userContext.tenantId}
          AND period_start <= CURRENT_DATE
          AND period_end >= CURRENT_DATE
        GROUP BY user_id
      ) q ON q.user_id = u.id
      LEFT JOIN (
        SELECT owner_id, SUM(amount) as revenue
        FROM opportunities
        WHERE tenant_id = ${userContext.tenantId}
          AND stage = 'Closed Won'
          AND close_date >= ${startOfMonth.toISOString()}
          AND close_date <= CURRENT_DATE
        GROUP BY owner_id
      ) rev ON rev.owner_id = u.id
      WHERE u.id = ANY(${accessibleUserIds})
        AND u.tenant_id = ${userContext.tenantId}
    `;

    const quotaResults = await db.execute(quotaQuery);

    const individualQuotas = quotaResults.rows.map((row: any) => {
      const quota = Number(row.quota_amount);
      const achieved = Number(row.achieved);
      const attainment = quota > 0 ? (achieved / quota) * 100 : 0;

      return {
        userId: row.user_id,
        userName: row.user_name || 'Unknown',
        quota,
        achieved,
        attainment,
        onTrack: attainment >= 90,
      };
    });

    const totalQuota = individualQuotas.reduce((sum, q) => sum + q.quota, 0);
    const totalAchieved = individualQuotas.reduce((sum, q) => sum + q.achieved, 0);

    // Metrics query (win rate, sales cycle, lead response time)
    const metricsQuery = sql`
      SELECT
        COALESCE(
          SUM(CASE WHEN o.stage = 'Closed Won' THEN 1 ELSE 0 END)::float /
          NULLIF(SUM(CASE WHEN o.stage IN ('Closed Won', 'Closed Lost') THEN 1 ELSE 0 END), 0) * 100,
          0
        ) as win_rate,
        COALESCE(AVG(EXTRACT(DAY FROM (o.close_date - o.created_at))), 0) as avg_sales_cycle,
        COALESCE(AVG(EXTRACT(HOUR FROM (first_activity.created_at - l.created_at))), 0) as avg_lead_response_time
      FROM opportunities o
      LEFT JOIN business_records l ON o.customer_id = l.id
      LEFT JOIN LATERAL (
        SELECT created_at
        FROM activities
        WHERE business_record_id = l.id
          AND tenant_id = ${userContext.tenantId}
        ORDER BY created_at ASC
        LIMIT 1
      ) first_activity ON true
      WHERE o.owner_id = ANY(${accessibleUserIds})
        AND o.tenant_id = ${userContext.tenantId}
        AND o.stage IN ('Closed Won', 'Closed Lost')
    `;

    const metricsResult = await db.execute(metricsQuery);
    const metrics = metricsResult.rows[0] as any;

    const result: TeamPerformanceDashboard = {
      teamRevenue: {
        mtd: Number(revenue.mtd),
        qtd: Number(revenue.qtd),
        ytd: Number(revenue.ytd),
      },
      teamQuota: {
        amount: totalQuota,
        achieved: totalAchieved,
        attainment: totalQuota > 0 ? (totalAchieved / totalQuota) * 100 : 0,
        remaining: Math.max(0, totalQuota - totalAchieved),
      },
      individualQuotas,
      metrics: {
        teamWinRate: Number(metrics?.win_rate || 0),
        averageSalesCycle: Number(metrics?.avg_sales_cycle || 0),
        averageLeadResponseTime: Number(metrics?.avg_lead_response_time || 0),
      },
    };

    ReportCache.set(cacheKey, result);
    return result;
  }

  /**
   * Report 9: Lead Management Report
   * Lead funnel, conversion rates, and management metrics
   * Access: Level 3+ (Sales Supervisor)
   */
  static async getLeadManagementReport(
    userContext: EnhancedUserContext,
    dateRange?: Partial<DateRange>
  ): Promise<LeadManagementReport> {
    const cacheKey = `lead-management:${userContext.id}:${JSON.stringify(dateRange)}`;
    const cached = ReportCache.get<LeadManagementReport>(cacheKey);
    if (cached) return cached;

    const queryBuilder = new HierarchicalQueryBuilder(userContext);
    const accessibleUserIds = await queryBuilder.getAccessibleUserIds();

    if (accessibleUserIds.length === 0) {
      return {
        leadsCreated: 0,
        leadsBySource: [],
        leadsByStatus: [],
        conversionMetrics: {
          overallConversionRate: 0,
          averageLeadAge: 0,
          leadsUnassigned: 0,
          leadsOverdueForFollowup: 0,
        },
        leadFunnel: [],
      };
    }

    const dateFrom = dateRange?.dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateTo = dateRange?.dateTo || new Date();

    // Leads by source with conversion rate
    const sourceQuery = sql`
      SELECT
        br.source,
        COUNT(br.id) as count,
        COALESCE(
          SUM(CASE WHEN br.status = 'customer' THEN 1 ELSE 0 END)::float /
          NULLIF(COUNT(br.id), 0) * 100,
          0
        ) as conversion_rate
      FROM business_records br
      WHERE (br.owner_id = ANY(${accessibleUserIds}) OR br.owner_id IS NULL)
        AND br.tenant_id = ${userContext.tenantId}
        AND br.created_at BETWEEN ${dateFrom.toISOString()} AND ${dateTo.toISOString()}
      GROUP BY br.source
      ORDER BY count DESC
    `;

    const sourceResults = await db.execute(sourceQuery);
    const leadsBySource = sourceResults.rows.map((row: any) => ({
      source: row.source || 'Unknown',
      count: Number(row.count),
      conversionRate: Number(row.conversion_rate),
    }));

    // Leads by status
    const statusQuery = sql`
      SELECT
        br.status,
        COUNT(br.id) as count
      FROM business_records br
      WHERE (br.owner_id = ANY(${accessibleUserIds}) OR br.owner_id IS NULL)
        AND br.tenant_id = ${userContext.tenantId}
        AND br.created_at BETWEEN ${dateFrom.toISOString()} AND ${dateTo.toISOString()}
      GROUP BY br.status
      ORDER BY count DESC
    `;

    const statusResults = await db.execute(statusQuery);
    const leadsByStatus = statusResults.rows.map((row: any) => ({
      status: row.status || 'Unknown',
      count: Number(row.count),
    }));

    // Conversion metrics
    const metricsQuery = sql`
      SELECT
        COUNT(br.id) as total_leads,
        SUM(CASE WHEN br.status = 'customer' THEN 1 ELSE 0 END) as converted_leads,
        AVG(EXTRACT(DAY FROM (CURRENT_DATE - br.created_at))) as avg_lead_age,
        SUM(CASE WHEN br.owner_id IS NULL THEN 1 ELSE 0 END) as leads_unassigned,
        SUM(CASE WHEN br.next_follow_up_date < CURRENT_DATE AND br.status = 'lead' THEN 1 ELSE 0 END) as leads_overdue
      FROM business_records br
      WHERE (br.owner_id = ANY(${accessibleUserIds}) OR br.owner_id IS NULL)
        AND br.tenant_id = ${userContext.tenantId}
        AND br.created_at BETWEEN ${dateFrom.toISOString()} AND ${dateTo.toISOString()}
    `;

    const metricsResult = await db.execute(metricsQuery);
    const metrics = metricsResult.rows[0] as any;

    const totalLeads = Number(metrics?.total_leads || 0);
    const convertedLeads = Number(metrics?.converted_leads || 0);

    const result: LeadManagementReport = {
      leadsCreated: totalLeads,
      leadsBySource,
      leadsByStatus,
      conversionMetrics: {
        overallConversionRate: totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0,
        averageLeadAge: Number(metrics?.avg_lead_age || 0),
        leadsUnassigned: Number(metrics?.leads_unassigned || 0),
        leadsOverdueForFollowup: Number(metrics?.leads_overdue || 0),
      },
      leadFunnel: [], // TODO: Implement funnel stages if you have them
    };

    ReportCache.set(cacheKey, result);
    return result;
  }

  /**
   * Report 10: Coaching Report
   * Identifies coaching opportunities and performance issues
   * Access: Level 3+ (Sales Supervisor)
   */
  static async getCoachingReport(
    userContext: EnhancedUserContext,
    dateRange?: Partial<DateRange>
  ): Promise<CoachingReport> {
    const cacheKey = `coaching-report:${userContext.id}:${JSON.stringify(dateRange)}`;
    const cached = ReportCache.get<CoachingReport>(cacheKey);
    if (cached) return cached;

    const queryBuilder = new HierarchicalQueryBuilder(userContext);
    const accessibleUserIds = await queryBuilder.getAccessibleUserIds();

    if (accessibleUserIds.length === 0) {
      return {
        opportunities: [],
        summary: {
          totalReps: 0,
          needsAttention: 0,
          criticalFlags: 0,
          improvementAreas: [],
        },
      };
    }

    const dateFrom = dateRange?.dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateTo = dateRange?.dateTo || new Date();

    // Coaching metrics query
    const coachingQuery = sql`
      SELECT
        u.id as user_id,
        u.name as user_name,
        COALESCE(act.call_volume, 0) as call_volume,
        COALESCE(act.call_talk_time, 0) as call_talk_time,
        COALESCE(act.meetings_held, 0) as meetings_held,
        COALESCE(act.meetings_planned, 0) as meetings_planned,
        COALESCE(quotes.quote_volume, 0) as quote_volume,
        COALESCE(quotes.quote_win_rate, 0) as quote_win_rate,
        COALESCE(stuck.deals_stuck, 0) as deals_stuck,
        COALESCE(velocity.avg_stage_velocity, 0) as avg_stage_velocity
      FROM users u
      LEFT JOIN (
        SELECT
          user_id,
          SUM(CASE WHEN type = 'call' THEN 1 ELSE 0 END) as call_volume,
          AVG(CASE WHEN type = 'call' THEN duration ELSE 0 END) as call_talk_time,
          SUM(CASE WHEN type = 'meeting' AND status = 'completed' THEN 1 ELSE 0 END) as meetings_held,
          SUM(CASE WHEN type = 'meeting' THEN 1 ELSE 0 END) as meetings_planned
        FROM activities
        WHERE tenant_id = ${userContext.tenantId}
          AND created_at BETWEEN ${dateFrom.toISOString()} AND ${dateTo.toISOString()}
        GROUP BY user_id
      ) act ON act.user_id = u.id
      LEFT JOIN (
        SELECT
          owner_id,
          COUNT(id) as quote_volume,
          COALESCE(
            SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END)::float /
            NULLIF(COUNT(id), 0) * 100,
            0
          ) as quote_win_rate
        FROM quotes
        WHERE tenant_id = ${userContext.tenantId}
          AND created_at BETWEEN ${dateFrom.toISOString()} AND ${dateTo.toISOString()}
        GROUP BY owner_id
      ) quotes ON quotes.owner_id = u.id
      LEFT JOIN (
        SELECT
          owner_id,
          COUNT(id) as deals_stuck
        FROM opportunities
        WHERE tenant_id = ${userContext.tenantId}
          AND stage NOT IN ('Closed Won', 'Closed Lost')
          AND EXTRACT(DAY FROM (CURRENT_DATE - updated_at)) > 30
        GROUP BY owner_id
      ) stuck ON stuck.owner_id = u.id
      LEFT JOIN (
        SELECT
          owner_id,
          AVG(days_in_stage) as avg_stage_velocity
        FROM opportunities
        WHERE tenant_id = ${userContext.tenantId}
          AND updated_at BETWEEN ${dateFrom.toISOString()} AND ${dateTo.toISOString()}
        GROUP BY owner_id
      ) velocity ON velocity.owner_id = u.id
      WHERE u.id = ANY(${accessibleUserIds})
        AND u.tenant_id = ${userContext.tenantId}
    `;

    const results = await db.execute(coachingQuery);

    // Calculate team averages for comparison
    const teamAverages = {
      callVolume: 0,
      quoteVolume: 0,
      quoteWinRate: 0,
    };

    if (results.rows.length > 0) {
      teamAverages.callVolume = results.rows.reduce((sum, r: any) => sum + Number(r.call_volume), 0) / results.rows.length;
      teamAverages.quoteVolume = results.rows.reduce((sum, r: any) => sum + Number(r.quote_volume), 0) / results.rows.length;
      teamAverages.quoteWinRate = results.rows.reduce((sum, r: any) => sum + Number(r.quote_win_rate), 0) / results.rows.length;
    }

    // Build coaching opportunities
    const opportunities: CoachingOpportunity[] = results.rows.map((row: any) => {
      const callVolume = Number(row.call_volume);
      const quoteVolume = Number(row.quote_volume);
      const quoteWinRate = Number(row.quote_win_rate);
      const dealsStuck = Number(row.deals_stuck);

      // Identify flags
      const lowActivity = callVolume < teamAverages.callVolume * 0.7;
      const lowConversion = quoteWinRate < teamAverages.quoteWinRate * 0.7 && quoteVolume > 0;
      const dealsStuckFlag = dealsStuck > 3;

      // Generate recommendations
      const recommendations: string[] = [];
      if (lowActivity) recommendations.push('Increase daily call volume to match team average');
      if (lowConversion) recommendations.push('Review proposal techniques and pricing strategy');
      if (dealsStuckFlag) recommendations.push('Focus on moving stale opportunities forward or disqualifying');
      if (Number(row.meetings_held) < Number(row.meetings_planned) * 0.8) {
        recommendations.push('Improve meeting attendance and follow-through');
      }

      return {
        userId: row.user_id,
        userName: row.user_name || 'Unknown',
        flags: {
          lowActivity,
          lowConversion,
          dealsStuck: dealsStuckFlag,
        },
        metrics: {
          callVolume,
          callTalkTime: Number(row.call_talk_time),
          meetingsHeld: Number(row.meetings_held),
          meetingsPlanned: Number(row.meetings_planned),
          quoteVolume,
          quoteWinRate,
          dealsStuck,
          avgStageVelocity: Number(row.avg_stage_velocity),
        },
        recommendations,
      };
    });

    // Calculate summary
    const needsAttention = opportunities.filter(o =>
      o.flags.lowActivity || o.flags.lowConversion || o.flags.dealsStuck
    ).length;

    const criticalFlags = opportunities.reduce((sum, o) => {
      let count = 0;
      if (o.flags.lowActivity) count++;
      if (o.flags.lowConversion) count++;
      if (o.flags.dealsStuck) count++;
      return sum + count;
    }, 0);

    const improvementAreas = [
      {
        area: 'Low Activity',
        affectedReps: opportunities.filter(o => o.flags.lowActivity).length,
      },
      {
        area: 'Low Conversion',
        affectedReps: opportunities.filter(o => o.flags.lowConversion).length,
      },
      {
        area: 'Stuck Deals',
        affectedReps: opportunities.filter(o => o.flags.dealsStuck).length,
      },
    ].filter(area => area.affectedReps > 0);

    const result: CoachingReport = {
      opportunities,
      summary: {
        totalReps: opportunities.length,
        needsAttention,
        criticalFlags,
        improvementAreas,
      },
    };

    ReportCache.set(cacheKey, result);
    return result;
  }

  /**
   * Clear cache for team reports
   */
  static clearCache(pattern?: string): void {
    ReportCache.clear(pattern);
  }
}
