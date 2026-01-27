// =====================================================================
// SALES MANAGER REPORTING SERVICE
// Business logic for sales manager reports (Level 4 - Reports 12-15)
// =====================================================================

import { db } from '../db';
import { sql } from 'drizzle-orm';
import type { EnhancedUserContext } from '../middleware/enhanced-rbac-middleware';
import { HierarchicalQueryBuilder } from '../middleware/hierarchical-query-builder';

// =====================================================================
// TYPE DEFINITIONS
// =====================================================================

interface DateRange {
  dateFrom?: Date;
  dateTo?: Date;
}

// Report 12: Regional Pipeline Overview
export interface RegionalPipeline {
  regionId: string;
  regionName: string;
  stage: string;
  dealCount: number;
  totalValue: number;
  weightedValue: number;
  conversionRate: number;
  locationCount: number;
}

export interface RegionalPipelineOverview {
  pipelines: RegionalPipeline[];
  aggregated: Array<{
    stage: string;
    totalDeals: number;
    totalValue: number;
    avgValuePerRegion: number;
  }>;
  summary: {
    totalRegions: number;
    totalPipeline: number;
    totalDeals: number;
    averageDealSize: number;
    healthScore: number;
  };
}

// Report 13: Regional Performance Metrics
export interface RegionalPerformance {
  regionId: string;
  regionName: string;
  locationCount: number;
  teamSize: number;
  totalRevenue: number;
  dealsWon: number;
  winRate: number;
  averageDealSize: number;
  quotaAttainment: number;
  activityScore: number;
  ranking: number;
}

export interface RegionalPerformanceMetrics {
  regions: RegionalPerformance[];
  summary: {
    totalRevenue: number;
    totalDeals: number;
    averageWinRate: number;
    topRegion: RegionalPerformance | null;
    bottomRegion: RegionalPerformance | null;
  };
}

// Report 14: Regional Quota Tracking
export interface RegionalQuota {
  regionId: string;
  regionName: string;
  quotaAmount: number;
  actualRevenue: number;
  attainmentPercent: number;
  gap: number;
  onTrack: boolean;
  forecast: number;
  projectedAttainment: number;
  locationCount: number;
}

export interface RegionalQuotaTracking {
  quotas: RegionalQuota[];
  summary: {
    totalQuota: number;
    totalRevenue: number;
    overallAttainment: number;
    regionsOnTrack: number;
    regionsAtRisk: number;
  };
}

// Report 15: Regional Activity Summary
export interface RegionalActivity {
  regionId: string;
  regionName: string;
  calls: number;
  emails: number;
  meetings: number;
  demos: number;
  proposals: number;
  totalActivities: number;
  activitiesPerRep: number;
  locationCount: number;
}

export interface RegionalActivitySummary {
  activities: RegionalActivity[];
  summary: {
    totalActivities: number;
    averagePerRegion: number;
    mostActiveRegion: RegionalActivity | null;
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
    keys.forEach((key) => {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    });
  }
}

// =====================================================================
// SALES MANAGER REPORTING SERVICE
// =====================================================================

export class SalesManagerReportingService {
  /**
   * Report 12: Get regional pipeline overview
   */
  static async getRegionalPipelineOverview(
    userContext: EnhancedUserContext,
    dateRange?: Partial<DateRange>,
  ): Promise<RegionalPipelineOverview> {
    const cacheKey = `regional-pipeline:${userContext.id}:${JSON.stringify(dateRange)}`;
    const cached = ReportCache.get<RegionalPipelineOverview>(cacheKey);
    if (cached) return cached;

    const queryBuilder = new HierarchicalQueryBuilder(userContext);
    const accessibleRegionIds = await queryBuilder.getAccessibleRegionIds();

    if (accessibleRegionIds.length === 0) {
      return {
        pipelines: [],
        aggregated: [],
        summary: {
          totalRegions: 0,
          totalPipeline: 0,
          totalDeals: 0,
          averageDealSize: 0,
          healthScore: 0,
        },
      };
    }

    const dateFilter =
      dateRange?.dateFrom && dateRange?.dateTo
        ? sql`AND o.createdAt BETWEEN ${dateRange.dateFrom.toISOString()} AND ${dateRange.dateTo.toISOString()}`
        : sql``;

    // Get pipeline by region and stage
    const result = await db.execute(sql`
      SELECT
        r.id as region_id,
        r.name as region_name,
        o.stage,
        COUNT(o.id)::int as deal_count,
        SUM(o.amount)::decimal as total_value,
        SUM(o.weighted_amount)::decimal as weighted_value,
        COUNT(CASE WHEN o.stage = 'Closed Won' THEN 1 END)::decimal / NULLIF(COUNT(*)::decimal, 0) * 100 as conversion_rate,
        COUNT(DISTINCT l.id)::int as location_count
      FROM regions r
      LEFT JOIN locations l ON l.region_id = r.id
      LEFT JOIN users u ON u.primary_location_id = l.id
      LEFT JOIN opportunities o ON o.ownerId = u.id
        AND o.tenantId = ${userContext.tenantId}
        AND o.stage NOT IN ('Closed Lost', 'Cancelled')
        ${dateFilter}
      WHERE r.id = ANY(${sql.raw(`ARRAY[${accessibleRegionIds.map((id) => `'${id}'`).join(',')}]`)})
        AND r.tenantId = ${userContext.tenantId}
      GROUP BY r.id, r.name, o.stage
      ORDER BY r.name, CASE o.stage
        WHEN 'Lead' THEN 1
        WHEN 'Qualified' THEN 2
        WHEN 'Proposal' THEN 3
        WHEN 'Negotiation' THEN 4
        WHEN 'Closed Won' THEN 5
        ELSE 6
      END
    `);

    const pipelines: RegionalPipeline[] = result.rows.map((row: any) => ({
      regionId: row.region_id,
      regionName: row.region_name,
      stage: row.stage || 'Unknown',
      dealCount: parseInt(row.deal_count || 0),
      totalValue: parseFloat(row.total_value || 0),
      weightedValue: parseFloat(row.weighted_value || 0),
      conversionRate: parseFloat(row.conversion_rate || 0),
      locationCount: parseInt(row.location_count || 0),
    }));

    // Aggregate by stage across all regions
    const stageMap = new Map<
      string,
      { totalDeals: number; totalValue: number; regionCount: number }
    >();
    pipelines.forEach((p) => {
      const existing = stageMap.get(p.stage) || { totalDeals: 0, totalValue: 0, regionCount: 0 };
      existing.totalDeals += p.dealCount;
      existing.totalValue += p.totalValue;
      existing.regionCount += 1;
      stageMap.set(p.stage, existing);
    });

    const aggregated = Array.from(stageMap.entries()).map(([stage, data]) => ({
      stage,
      totalDeals: data.totalDeals,
      totalValue: data.totalValue,
      avgValuePerRegion: Math.round((data.totalValue / data.regionCount) * 100) / 100,
    }));

    const totalPipeline = pipelines.reduce((sum, p) => sum + p.totalValue, 0);
    const totalDeals = pipelines.reduce((sum, p) => sum + p.dealCount, 0);
    const avgConversion =
      pipelines.reduce((sum, p) => sum + p.conversionRate, 0) / (pipelines.length || 1);

    const summary = {
      totalRegions: new Set(pipelines.map((p) => p.regionId)).size,
      totalPipeline,
      totalDeals,
      averageDealSize: totalDeals > 0 ? Math.round((totalPipeline / totalDeals) * 100) / 100 : 0,
      healthScore: Math.round(avgConversion * 100) / 100,
    };

    const response = { pipelines, aggregated, summary };
    ReportCache.set(cacheKey, response);
    return response;
  }

  /**
   * Report 13: Get regional performance metrics
   */
  static async getRegionalPerformanceMetrics(
    userContext: EnhancedUserContext,
    dateRange?: Partial<DateRange>,
  ): Promise<RegionalPerformanceMetrics> {
    const cacheKey = `regional-performance:${userContext.id}:${JSON.stringify(dateRange)}`;
    const cached = ReportCache.get<RegionalPerformanceMetrics>(cacheKey);
    if (cached) return cached;

    const queryBuilder = new HierarchicalQueryBuilder(userContext);
    const accessibleRegionIds = await queryBuilder.getAccessibleRegionIds();

    if (accessibleRegionIds.length === 0) {
      return {
        regions: [],
        summary: {
          totalRevenue: 0,
          totalDeals: 0,
          averageWinRate: 0,
          topRegion: null,
          bottomRegion: null,
        },
      };
    }

    const dateFilter =
      dateRange?.dateFrom && dateRange?.dateTo
        ? sql`AND o.closed_at BETWEEN ${dateRange.dateFrom.toISOString()} AND ${dateRange.dateTo.toISOString()}`
        : sql``;

    const result = await db.execute(sql`
      WITH regional_metrics AS (
        SELECT
          r.id as region_id,
          r.name as region_name,
          COUNT(DISTINCT l.id)::int as location_count,
          COUNT(DISTINCT u.id)::int as team_size,
          SUM(CASE WHEN o.stage = 'Closed Won' THEN o.amount ELSE 0 END)::decimal as total_revenue,
          COUNT(CASE WHEN o.stage = 'Closed Won' THEN 1 END)::int as deals_won,
          COUNT(CASE WHEN o.stage IN ('Closed Won', 'Closed Lost') THEN 1 END)::int as total_closed,
          COUNT(a.id)::int as total_activities
        FROM regions r
        LEFT JOIN locations l ON l.region_id = r.id
        LEFT JOIN users u ON u.primary_location_id = l.id
        LEFT JOIN opportunities o ON o.ownerId = u.id
          AND o.tenantId = ${userContext.tenantId}
          ${dateFilter}
        LEFT JOIN activities a ON a.userId = u.id
          AND a.tenantId = ${userContext.tenantId}
          ${dateFilter}
        WHERE r.id = ANY(${sql.raw(`ARRAY[${accessibleRegionIds.map((id) => `'${id}'`).join(',')}]`)})
          AND r.tenantId = ${userContext.tenantId}
        GROUP BY r.id, r.name
      ),
      quota_data AS (
        SELECT
          r.id as region_id,
          SUM(q.quota_amount)::decimal as total_quota
        FROM regions r
        LEFT JOIN locations l ON l.region_id = r.id
        LEFT JOIN users u ON u.primary_location_id = l.id
        LEFT JOIN sales_quotas q ON q.userId = u.id
          AND q.tenantId = ${userContext.tenantId}
        WHERE r.id = ANY(${sql.raw(`ARRAY[${accessibleRegionIds.map((id) => `'${id}'`).join(',')}]`)})
          AND r.tenantId = ${userContext.tenantId}
        GROUP BY r.id
      )
      SELECT
        m.*,
        q.total_quota,
        CASE WHEN m.total_closed > 0
          THEN (m.deals_won::decimal / m.total_closed::decimal * 100)
          ELSE 0
        END as win_rate,
        CASE WHEN m.deals_won > 0
          THEN (m.total_revenue / m.deals_won)
          ELSE 0
        END as avg_deal_size,
        CASE WHEN q.total_quota > 0
          THEN (m.total_revenue / q.total_quota * 100)
          ELSE 0
        END as quota_attainment,
        RANK() OVER (ORDER BY m.total_revenue DESC) as ranking
      FROM regional_metrics m
      LEFT JOIN quota_data q ON q.region_id = m.region_id
      ORDER BY ranking
    `);

    const regions: RegionalPerformance[] = result.rows.map((row: any) => ({
      regionId: row.region_id,
      regionName: row.region_name,
      locationCount: parseInt(row.location_count || 0),
      teamSize: parseInt(row.team_size || 0),
      totalRevenue: parseFloat(row.total_revenue || 0),
      dealsWon: parseInt(row.deals_won || 0),
      winRate: parseFloat(row.win_rate || 0),
      averageDealSize: parseFloat(row.avg_deal_size || 0),
      quotaAttainment: parseFloat(row.quota_attainment || 0),
      activityScore: parseInt(row.total_activities || 0),
      ranking: parseInt(row.ranking || 0),
    }));

    const totalRevenue = regions.reduce((sum, r) => sum + r.totalRevenue, 0);
    const totalDeals = regions.reduce((sum, r) => sum + r.dealsWon, 0);
    const avgWinRate = regions.reduce((sum, r) => sum + r.winRate, 0) / (regions.length || 1);

    const summary = {
      totalRevenue,
      totalDeals,
      averageWinRate: Math.round(avgWinRate * 100) / 100,
      topRegion: regions.length > 0 ? regions[0] : null,
      bottomRegion: regions.length > 0 ? regions[regions.length - 1] : null,
    };

    const response = { regions, summary };
    ReportCache.set(cacheKey, response);
    return response;
  }

  /**
   * Report 14: Get regional quota tracking
   */
  static async getRegionalQuotaTracking(
    userContext: EnhancedUserContext,
    dateRange?: Partial<DateRange>,
  ): Promise<RegionalQuotaTracking> {
    const cacheKey = `regional-quota:${userContext.id}:${JSON.stringify(dateRange)}`;
    const cached = ReportCache.get<RegionalQuotaTracking>(cacheKey);
    if (cached) return cached;

    const queryBuilder = new HierarchicalQueryBuilder(userContext);
    const accessibleRegionIds = await queryBuilder.getAccessibleRegionIds();

    if (accessibleRegionIds.length === 0) {
      return {
        quotas: [],
        summary: {
          totalQuota: 0,
          totalRevenue: 0,
          overallAttainment: 0,
          regionsOnTrack: 0,
          regionsAtRisk: 0,
        },
      };
    }

    const dateFilter =
      dateRange?.dateFrom && dateRange?.dateTo
        ? sql`AND o.closed_at BETWEEN ${dateRange.dateFrom.toISOString()} AND ${dateRange.dateTo.toISOString()}`
        : sql``;

    const result = await db.execute(sql`
      WITH regional_quotas AS (
        SELECT
          r.id as region_id,
          r.name as region_name,
          COUNT(DISTINCT l.id)::int as location_count,
          SUM(q.quota_amount)::decimal as quota_amount
        FROM regions r
        LEFT JOIN locations l ON l.region_id = r.id
        LEFT JOIN users u ON u.primary_location_id = l.id
        LEFT JOIN sales_quotas q ON q.userId = u.id
          AND q.tenantId = ${userContext.tenantId}
        WHERE r.id = ANY(${sql.raw(`ARRAY[${accessibleRegionIds.map((id) => `'${id}'`).join(',')}]`)})
          AND r.tenantId = ${userContext.tenantId}
        GROUP BY r.id, r.name
      ),
      regional_revenue AS (
        SELECT
          r.id as region_id,
          SUM(CASE WHEN o.stage = 'Closed Won' THEN o.amount ELSE 0 END)::decimal as actual_revenue
        FROM regions r
        LEFT JOIN locations l ON l.region_id = r.id
        LEFT JOIN users u ON u.primary_location_id = l.id
        LEFT JOIN opportunities o ON o.ownerId = u.id
          AND o.tenantId = ${userContext.tenantId}
          ${dateFilter}
        WHERE r.id = ANY(${sql.raw(`ARRAY[${accessibleRegionIds.map((id) => `'${id}'`).join(',')}]`)})
          AND r.tenantId = ${userContext.tenantId}
        GROUP BY r.id
      ),
      regional_pipeline AS (
        SELECT
          r.id as region_id,
          SUM(o.weighted_amount)::decimal as forecast
        FROM regions r
        LEFT JOIN locations l ON l.region_id = r.id
        LEFT JOIN users u ON u.primary_location_id = l.id
        LEFT JOIN opportunities o ON o.ownerId = u.id
          AND o.tenantId = ${userContext.tenantId}
          AND o.stage NOT IN ('Closed Won', 'Closed Lost', 'Cancelled')
        WHERE r.id = ANY(${sql.raw(`ARRAY[${accessibleRegionIds.map((id) => `'${id}'`).join(',')}]`)})
          AND r.tenantId = ${userContext.tenantId}
        GROUP BY r.id
      )
      SELECT
        q.region_id,
        q.region_name,
        q.location_count,
        COALESCE(q.quota_amount, 0) as quota_amount,
        COALESCE(rev.actual_revenue, 0) as actual_revenue,
        COALESCE(p.forecast, 0) as forecast,
        CASE WHEN q.quota_amount > 0
          THEN (COALESCE(rev.actual_revenue, 0) / q.quota_amount * 100)
          ELSE 0
        END as attainment_percent,
        (COALESCE(q.quota_amount, 0) - COALESCE(rev.actual_revenue, 0)) as gap,
        CASE WHEN q.quota_amount > 0
          THEN ((COALESCE(rev.actual_revenue, 0) + COALESCE(p.forecast, 0)) / q.quota_amount * 100)
          ELSE 0
        END as projected_attainment
      FROM regional_quotas q
      LEFT JOIN regional_revenue rev ON rev.region_id = q.region_id
      LEFT JOIN regional_pipeline p ON p.region_id = q.region_id
      ORDER BY attainment_percent DESC
    `);

    const quotas: RegionalQuota[] = result.rows.map((row: any) => {
      const attainment = parseFloat(row.attainment_percent || 0);
      return {
        regionId: row.region_id,
        regionName: row.region_name,
        quotaAmount: parseFloat(row.quota_amount || 0),
        actualRevenue: parseFloat(row.actual_revenue || 0),
        attainmentPercent: attainment,
        gap: parseFloat(row.gap || 0),
        onTrack: attainment >= 90,
        forecast: parseFloat(row.forecast || 0),
        projectedAttainment: parseFloat(row.projected_attainment || 0),
        locationCount: parseInt(row.location_count || 0),
      };
    });

    const totalQuota = quotas.reduce((sum, q) => sum + q.quotaAmount, 0);
    const totalRevenue = quotas.reduce((sum, q) => sum + q.actualRevenue, 0);

    const summary = {
      totalQuota,
      totalRevenue,
      overallAttainment:
        totalQuota > 0 ? Math.round((totalRevenue / totalQuota) * 100 * 100) / 100 : 0,
      regionsOnTrack: quotas.filter((q) => q.onTrack).length,
      regionsAtRisk: quotas.filter((q) => !q.onTrack).length,
    };

    const response = { quotas, summary };
    ReportCache.set(cacheKey, response);
    return response;
  }

  /**
   * Report 15: Get regional activity summary
   */
  static async getRegionalActivitySummary(
    userContext: EnhancedUserContext,
    dateRange?: Partial<DateRange>,
  ): Promise<RegionalActivitySummary> {
    const cacheKey = `regional-activity:${userContext.id}:${JSON.stringify(dateRange)}`;
    const cached = ReportCache.get<RegionalActivitySummary>(cacheKey);
    if (cached) return cached;

    const queryBuilder = new HierarchicalQueryBuilder(userContext);
    const accessibleRegionIds = await queryBuilder.getAccessibleRegionIds();

    if (accessibleRegionIds.length === 0) {
      return {
        activities: [],
        summary: {
          totalActivities: 0,
          averagePerRegion: 0,
          mostActiveRegion: null,
        },
      };
    }

    const dateFilter =
      dateRange?.dateFrom && dateRange?.dateTo
        ? sql`AND a.createdAt BETWEEN ${dateRange.dateFrom.toISOString()} AND ${dateRange.dateTo.toISOString()}`
        : sql``;

    const result = await db.execute(sql`
      SELECT
        r.id as region_id,
        r.name as region_name,
        COUNT(DISTINCT l.id)::int as location_count,
        COUNT(DISTINCT u.id)::int as rep_count,
        COUNT(CASE WHEN a.activity_type = 'call' THEN 1 END)::int as calls,
        COUNT(CASE WHEN a.activity_type = 'email' THEN 1 END)::int as emails,
        COUNT(CASE WHEN a.activity_type = 'meeting' THEN 1 END)::int as meetings,
        COUNT(CASE WHEN a.activity_type = 'demo' THEN 1 END)::int as demos,
        COUNT(CASE WHEN a.activity_type = 'proposal' THEN 1 END)::int as proposals,
        COUNT(a.id)::int as total_activities
      FROM regions r
      LEFT JOIN locations l ON l.region_id = r.id
      LEFT JOIN users u ON u.primary_location_id = l.id
      LEFT JOIN activities a ON a.userId = u.id
        AND a.tenantId = ${userContext.tenantId}
        ${dateFilter}
      WHERE r.id = ANY(${sql.raw(`ARRAY[${accessibleRegionIds.map((id) => `'${id}'`).join(',')}]`)})
        AND r.tenantId = ${userContext.tenantId}
      GROUP BY r.id, r.name
      ORDER BY total_activities DESC
    `);

    const activities: RegionalActivity[] = result.rows.map((row: any) => {
      const totalActivities = parseInt(row.total_activities || 0);
      const repCount = parseInt(row.rep_count || 1);
      return {
        regionId: row.region_id,
        regionName: row.region_name,
        calls: parseInt(row.calls || 0),
        emails: parseInt(row.emails || 0),
        meetings: parseInt(row.meetings || 0),
        demos: parseInt(row.demos || 0),
        proposals: parseInt(row.proposals || 0),
        totalActivities,
        activitiesPerRep: repCount > 0 ? Math.round((totalActivities / repCount) * 100) / 100 : 0,
        locationCount: parseInt(row.location_count || 0),
      };
    });

    const totalActivities = activities.reduce((sum, a) => sum + a.totalActivities, 0);

    const summary = {
      totalActivities,
      averagePerRegion:
        activities.length > 0 ? Math.round((totalActivities / activities.length) * 100) / 100 : 0,
      mostActiveRegion: activities.length > 0 ? activities[0] : null,
    };

    const response = { activities, summary };
    ReportCache.set(cacheKey, response);
    return response;
  }

  /**
   * Clear cache for sales manager reports
   */
  static clearCache(): void {
    ReportCache.clear('regional-pipeline');
    ReportCache.clear('regional-performance');
    ReportCache.clear('regional-quota');
    ReportCache.clear('regional-activity');
  }
}
