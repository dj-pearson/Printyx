// =====================================================================
// SALES SUPERVISOR REPORTING SERVICE
// Business logic for sales supervisor reports (Level 3 - Reports 8-11)
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

// Report 8: Location Pipeline Overview
export interface LocationPipeline {
  locationId: string;
  locationName: string;
  stage: string;
  dealCount: number;
  totalValue: number;
  weightedValue: number;
  conversionRate: number;
}

export interface LocationPipelineOverview {
  pipelines: LocationPipeline[];
  aggregated: Array<{
    stage: string;
    totalDeals: number;
    totalValue: number;
    avgValuePerLocation: number;
  }>;
  summary: {
    totalLocations: number;
    totalPipeline: number;
    totalDeals: number;
    averageDealSize: number;
    healthScore: number;
  };
}

// Report 9: Location Performance Metrics
export interface LocationPerformance {
  locationId: string;
  locationName: string;
  teamSize: number;
  totalRevenue: number;
  dealsWon: number;
  winRate: number;
  averageDealSize: number;
  quotaAttainment: number;
  activityScore: number;
  ranking: number;
}

export interface LocationPerformanceMetrics {
  locations: LocationPerformance[];
  summary: {
    totalRevenue: number;
    totalDeals: number;
    averageWinRate: number;
    topLocation: LocationPerformance | null;
    bottomLocation: LocationPerformance | null;
  };
}

// Report 10: Location Quota Tracking
export interface LocationQuota {
  locationId: string;
  locationName: string;
  quotaAmount: number;
  actualRevenue: number;
  attainmentPercent: number;
  gap: number;
  onTrack: boolean;
  forecast: number;
  projectedAttainment: number;
}

export interface LocationQuotaTracking {
  quotas: LocationQuota[];
  summary: {
    totalQuota: number;
    totalRevenue: number;
    overallAttainment: number;
    locationsOnTrack: number;
    locationsAtRisk: number;
  };
}

// Report 11: Location Activity Summary
export interface LocationActivity {
  locationId: string;
  locationName: string;
  calls: number;
  emails: number;
  meetings: number;
  demos: number;
  proposals: number;
  totalActivities: number;
  activitiesPerRep: number;
}

export interface LocationActivitySummary {
  activities: LocationActivity[];
  summary: {
    totalActivities: number;
    averagePerLocation: number;
    mostActiveLocation: LocationActivity | null;
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
// SALES SUPERVISOR REPORTING SERVICE
// =====================================================================

export class SalesSupervisorReportingService {
  /**
   * Report 8: Get location pipeline overview
   */
  static async getLocationPipelineOverview(
    userContext: EnhancedUserContext,
    dateRange?: Partial<DateRange>,
  ): Promise<LocationPipelineOverview> {
    const cacheKey = `location-pipeline:${userContext.id}:${JSON.stringify(dateRange)}`;
    const cached = ReportCache.get<LocationPipelineOverview>(cacheKey);
    if (cached) return cached;

    const queryBuilder = new HierarchicalQueryBuilder(userContext);
    const accessibleLocationIds = await queryBuilder.getAccessibleLocationIds();

    if (accessibleLocationIds.length === 0) {
      return {
        pipelines: [],
        aggregated: [],
        summary: {
          totalLocations: 0,
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

    // Get pipeline by location and stage
    const result = await db.execute(sql`
      SELECT
        l.id as location_id,
        l.name as location_name,
        o.stage,
        COUNT(o.id)::int as deal_count,
        SUM(o.amount)::decimal as total_value,
        SUM(o.weighted_amount)::decimal as weighted_value,
        COUNT(CASE WHEN o.stage = 'Closed Won' THEN 1 END)::decimal / NULLIF(COUNT(*)::decimal, 0) * 100 as conversion_rate
      FROM locations l
      LEFT JOIN users u ON u.primary_location_id = l.id
      LEFT JOIN opportunities o ON o.ownerId = u.id
        AND o.tenantId = ${userContext.tenantId}
        AND o.stage NOT IN ('Closed Lost', 'Cancelled')
        ${dateFilter}
      WHERE l.id = ANY(${accessibleLocationIds})
        AND l.tenantId = ${userContext.tenantId}
      GROUP BY l.id, l.name, o.stage
      ORDER BY l.name, CASE o.stage
        WHEN 'Lead' THEN 1
        WHEN 'Qualified' THEN 2
        WHEN 'Proposal' THEN 3
        WHEN 'Negotiation' THEN 4
        WHEN 'Closed Won' THEN 5
        ELSE 6
      END
    `);

    const pipelines: LocationPipeline[] = result.rows.map((row: any) => ({
      locationId: row.locationId,
      locationName: row.location_name,
      stage: row.stage || 'Unknown',
      dealCount: parseInt(row.deal_count || 0),
      totalValue: parseFloat(row.total_value || 0),
      weightedValue: parseFloat(row.weighted_value || 0),
      conversionRate: parseFloat(row.conversion_rate || 0),
    }));

    // Aggregate by stage across all locations
    const stageMap = new Map<
      string,
      { totalDeals: number; totalValue: number; locationCount: number }
    >();
    pipelines.forEach((p) => {
      const existing = stageMap.get(p.stage) || { totalDeals: 0, totalValue: 0, locationCount: 0 };
      existing.totalDeals += p.dealCount;
      existing.totalValue += p.totalValue;
      existing.locationCount += 1;
      stageMap.set(p.stage, existing);
    });

    const aggregated = Array.from(stageMap.entries()).map(([stage, data]) => ({
      stage,
      totalDeals: data.totalDeals,
      totalValue: data.totalValue,
      avgValuePerLocation: data.locationCount > 0 ? data.totalValue / data.locationCount : 0,
    }));

    // Calculate summary
    const totalPipeline = pipelines.reduce((sum, p) => sum + p.totalValue, 0);
    const totalDeals = pipelines.reduce((sum, p) => sum + p.dealCount, 0);
    const uniqueLocations = new Set(pipelines.map((p) => p.locationId)).size;
    const averageDealSize = totalDeals > 0 ? totalPipeline / totalDeals : 0;
    const avgConversion =
      pipelines.length > 0
        ? pipelines.reduce((sum, p) => sum + p.conversionRate, 0) / pipelines.length
        : 0;
    const healthScore = Math.min(100, avgConversion * 0.4 + (totalDeals / uniqueLocations) * 0.6);

    const overview: LocationPipelineOverview = {
      pipelines,
      aggregated,
      summary: {
        totalLocations: uniqueLocations,
        totalPipeline,
        totalDeals,
        averageDealSize,
        healthScore,
      },
    };

    ReportCache.set(cacheKey, overview);
    return overview;
  }

  /**
   * Report 9: Get location performance metrics
   */
  static async getLocationPerformanceMetrics(
    userContext: EnhancedUserContext,
    dateRange?: Partial<DateRange>,
  ): Promise<LocationPerformanceMetrics> {
    const cacheKey = `location-performance:${userContext.id}:${JSON.stringify(dateRange)}`;
    const cached = ReportCache.get<LocationPerformanceMetrics>(cacheKey);
    if (cached) return cached;

    const queryBuilder = new HierarchicalQueryBuilder(userContext);
    const accessibleLocationIds = await queryBuilder.getAccessibleLocationIds();

    if (accessibleLocationIds.length === 0) {
      return {
        locations: [],
        summary: {
          totalRevenue: 0,
          totalDeals: 0,
          averageWinRate: 0,
          topLocation: null,
          bottomLocation: null,
        },
      };
    }

    const dateFilter =
      dateRange?.dateFrom && dateRange?.dateTo
        ? sql`AND o.createdAt BETWEEN ${dateRange.dateFrom.toISOString()} AND ${dateRange.dateTo.toISOString()}`
        : sql``;

    const result = await db.execute(sql`
      WITH location_stats AS (
        SELECT
          l.id as location_id,
          l.name as location_name,
          COUNT(DISTINCT u.id)::int as team_size,
          SUM(CASE WHEN o.stage = 'Closed Won' THEN o.amount ELSE 0 END)::decimal as total_revenue,
          COUNT(CASE WHEN o.stage = 'Closed Won' THEN 1 END)::int as deals_won,
          COUNT(CASE WHEN o.stage IN ('Closed Won', 'Closed Lost') THEN 1 END)::int as total_closed,
          AVG(CASE WHEN o.stage = 'Closed Won' THEN o.amount ELSE NULL END)::decimal as avg_deal_size,
          COUNT(a.id)::int as total_activities
        FROM locations l
        LEFT JOIN users u ON u.primary_location_id = l.id AND u.tenantId = ${userContext.tenantId}
        LEFT JOIN opportunities o ON o.ownerId = u.id AND o.tenantId = ${userContext.tenantId} ${dateFilter}
        LEFT JOIN activities a ON a.userId = u.id AND a.tenantId = ${userContext.tenantId} ${dateFilter}
        WHERE l.id = ANY(${accessibleLocationIds})
          AND l.tenantId = ${userContext.tenantId}
        GROUP BY l.id, l.name
      ),
      location_quotas AS (
        SELECT
          l.id as location_id,
          SUM(q.quota_amount)::decimal as total_quota,
          SUM(CASE WHEN o.stage = 'Closed Won' THEN o.amount ELSE 0 END)::decimal as actual_revenue
        FROM locations l
        LEFT JOIN users u ON u.primary_location_id = l.id
        LEFT JOIN quotas q ON q.userId = u.id AND q.period = 'current'
        LEFT JOIN opportunities o ON o.ownerId = u.id AND o.stage = 'Closed Won' AND o.tenantId = ${userContext.tenantId}
        WHERE l.id = ANY(${accessibleLocationIds})
        GROUP BY l.id
      )
      SELECT
        ls.*,
        lq.total_quota,
        lq.actual_revenue as quota_revenue,
        CASE
          WHEN lq.total_quota > 0 THEN (lq.actual_revenue / lq.total_quota * 100)::decimal
          ELSE 0
        END as quota_attainment,
        RANK() OVER (ORDER BY ls.total_revenue DESC) as ranking
      FROM location_stats ls
      LEFT JOIN location_quotas lq ON lq.locationId = ls.locationId
      ORDER BY ls.total_revenue DESC
    `);

    const locations: LocationPerformance[] = result.rows.map((row: any) => ({
      locationId: row.locationId,
      locationName: row.location_name,
      teamSize: parseInt(row.team_size || 0),
      totalRevenue: parseFloat(row.total_revenue || 0),
      dealsWon: parseInt(row.deals_won || 0),
      winRate:
        parseInt(row.total_closed || 0) > 0
          ? (parseInt(row.deals_won || 0) / parseInt(row.total_closed)) * 100
          : 0,
      averageDealSize: parseFloat(row.avg_deal_size || 0),
      quotaAttainment: parseFloat(row.quota_attainment || 0),
      activityScore: parseInt(row.total_activities || 0),
      ranking: parseInt(row.ranking),
    }));

    const totalRevenue = locations.reduce((sum, l) => sum + l.totalRevenue, 0);
    const totalDeals = locations.reduce((sum, l) => sum + l.dealsWon, 0);
    const averageWinRate =
      locations.length > 0
        ? locations.reduce((sum, l) => sum + l.winRate, 0) / locations.length
        : 0;

    const metrics: LocationPerformanceMetrics = {
      locations,
      summary: {
        totalRevenue,
        totalDeals,
        averageWinRate,
        topLocation: locations[0] || null,
        bottomLocation: locations[locations.length - 1] || null,
      },
    };

    ReportCache.set(cacheKey, metrics);
    return metrics;
  }

  /**
   * Report 10: Get location quota tracking
   */
  static async getLocationQuotaTracking(
    userContext: EnhancedUserContext,
    period: 'current' | 'previous' | 'ytd' = 'current',
  ): Promise<LocationQuotaTracking> {
    const cacheKey = `location-quota:${userContext.id}:${period}`;
    const cached = ReportCache.get<LocationQuotaTracking>(cacheKey);
    if (cached) return cached;

    const queryBuilder = new HierarchicalQueryBuilder(userContext);
    const accessibleLocationIds = await queryBuilder.getAccessibleLocationIds();

    if (accessibleLocationIds.length === 0) {
      return {
        quotas: [],
        summary: {
          totalQuota: 0,
          totalRevenue: 0,
          overallAttainment: 0,
          locationsOnTrack: 0,
          locationsAtRisk: 0,
        },
      };
    }

    const result = await db.execute(sql`
      WITH location_quotas AS (
        SELECT
          l.id as location_id,
          l.name as location_name,
          SUM(q.quota_amount)::decimal as quota_amount,
          SUM(CASE WHEN o.stage = 'Closed Won' THEN o.amount ELSE 0 END)::decimal as actual_revenue,
          SUM(CASE WHEN o.stage IN ('Proposal', 'Negotiation') THEN o.weighted_amount ELSE 0 END)::decimal as pipeline_forecast
        FROM locations l
        LEFT JOIN users u ON u.primary_location_id = l.id
        LEFT JOIN quotas q ON q.userId = u.id AND q.period = ${period}
        LEFT JOIN opportunities o ON o.ownerId = u.id AND o.tenantId = ${userContext.tenantId}
        WHERE l.id = ANY(${accessibleLocationIds})
          AND l.tenantId = ${userContext.tenantId}
        GROUP BY l.id, l.name
      )
      SELECT
        *,
        CASE
          WHEN quota_amount > 0 THEN (actual_revenue / quota_amount * 100)::decimal
          ELSE 0
        END as attainment_percent,
        (quota_amount - actual_revenue)::decimal as gap,
        (actual_revenue + pipeline_forecast)::decimal as forecast,
        CASE
          WHEN quota_amount > 0 THEN ((actual_revenue + pipeline_forecast) / quota_amount * 100)::decimal
          ELSE 0
        END as projected_attainment
      FROM location_quotas
      ORDER BY attainment_percent DESC
    `);

    const quotas: LocationQuota[] = result.rows.map((row: any) => {
      const attainment = parseFloat(row.attainment_percent || 0);
      return {
        locationId: row.locationId,
        locationName: row.location_name,
        quotaAmount: parseFloat(row.quota_amount || 0),
        actualRevenue: parseFloat(row.actual_revenue || 0),
        attainmentPercent: attainment,
        gap: parseFloat(row.gap || 0),
        onTrack: attainment >= 90,
        forecast: parseFloat(row.forecast || 0),
        projectedAttainment: parseFloat(row.projected_attainment || 0),
      };
    });

    const totalQuota = quotas.reduce((sum, q) => sum + q.quotaAmount, 0);
    const totalRevenue = quotas.reduce((sum, q) => sum + q.actualRevenue, 0);
    const overallAttainment = totalQuota > 0 ? (totalRevenue / totalQuota) * 100 : 0;
    const locationsOnTrack = quotas.filter((q) => q.onTrack).length;
    const locationsAtRisk = quotas.filter((q) => !q.onTrack && q.attainmentPercent < 75).length;

    const tracking: LocationQuotaTracking = {
      quotas,
      summary: {
        totalQuota,
        totalRevenue,
        overallAttainment,
        locationsOnTrack,
        locationsAtRisk,
      },
    };

    ReportCache.set(cacheKey, tracking);
    return tracking;
  }

  /**
   * Report 11: Get location activity summary
   */
  static async getLocationActivitySummary(
    userContext: EnhancedUserContext,
    dateRange?: Partial<DateRange>,
  ): Promise<LocationActivitySummary> {
    const cacheKey = `location-activity:${userContext.id}:${JSON.stringify(dateRange)}`;
    const cached = ReportCache.get<LocationActivitySummary>(cacheKey);
    if (cached) return cached;

    const queryBuilder = new HierarchicalQueryBuilder(userContext);
    const accessibleLocationIds = await queryBuilder.getAccessibleLocationIds();

    if (accessibleLocationIds.length === 0) {
      return {
        activities: [],
        summary: {
          totalActivities: 0,
          averagePerLocation: 0,
          mostActiveLocation: null,
        },
      };
    }

    const dateFilter =
      dateRange?.dateFrom && dateRange?.dateTo
        ? sql`AND a.activity_date BETWEEN ${dateRange.dateFrom.toISOString()} AND ${dateRange.dateTo.toISOString()}`
        : sql``;

    const result = await db.execute(sql`
      SELECT
        l.id as location_id,
        l.name as location_name,
        COUNT(DISTINCT u.id)::int as team_size,
        COUNT(CASE WHEN a.activity_type = 'call' THEN 1 END)::int as calls,
        COUNT(CASE WHEN a.activity_type = 'email' THEN 1 END)::int as emails,
        COUNT(CASE WHEN a.activity_type = 'meeting' THEN 1 END)::int as meetings,
        COUNT(CASE WHEN a.activity_type = 'demo' THEN 1 END)::int as demos,
        COUNT(CASE WHEN a.activity_type = 'proposal' THEN 1 END)::int as proposals,
        COUNT(a.id)::int as total_activities
      FROM locations l
      LEFT JOIN users u ON u.primary_location_id = l.id AND u.tenantId = ${userContext.tenantId}
      LEFT JOIN activities a ON a.userId = u.id AND a.tenantId = ${userContext.tenantId} ${dateFilter}
      WHERE l.id = ANY(${accessibleLocationIds})
        AND l.tenantId = ${userContext.tenantId}
      GROUP BY l.id, l.name
      ORDER BY total_activities DESC
    `);

    const activities: LocationActivity[] = result.rows.map((row: any) => {
      const teamSize = parseInt(row.team_size || 1);
      const totalActivities = parseInt(row.total_activities || 0);
      return {
        locationId: row.locationId,
        locationName: row.location_name,
        calls: parseInt(row.calls || 0),
        emails: parseInt(row.emails || 0),
        meetings: parseInt(row.meetings || 0),
        demos: parseInt(row.demos || 0),
        proposals: parseInt(row.proposals || 0),
        totalActivities,
        activitiesPerRep: teamSize > 0 ? totalActivities / teamSize : 0,
      };
    });

    const totalActivities = activities.reduce((sum, a) => sum + a.totalActivities, 0);
    const averagePerLocation = activities.length > 0 ? totalActivities / activities.length : 0;

    const summary: LocationActivitySummary = {
      activities,
      summary: {
        totalActivities,
        averagePerLocation,
        mostActiveLocation: activities[0] || null,
      },
    };

    ReportCache.set(cacheKey, summary);
    return summary;
  }

  /**
   * Clear cache
   */
  static clearCache(pattern?: string): void {
    ReportCache.clear(pattern);
  }
}

export default SalesSupervisorReportingService;
