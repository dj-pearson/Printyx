// =====================================================================
// SERVICE MANAGER REPORTING SERVICE
// Business logic for service manager reports (Level 4 - Reports 33-36)
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

// Report 33: Regional Service Call Overview
export interface RegionalServiceCall {
  regionId: string;
  regionName: string;
  priority: string;
  status: string;
  callCount: number;
  avgDuration: number;
  firstTimeFixRate: number;
  avgSatisfaction: number;
  locationCount: number;
}

export interface RegionalServiceCallOverview {
  serviceCalls: RegionalServiceCall[];
  aggregated: Array<{
    priority: string;
    totalCalls: number;
    avgCallsPerRegion: number;
    avgDuration: number;
  }>;
  summary: {
    totalRegions: number;
    totalCalls: number;
    avgFirstTimeFixRate: number;
    avgSatisfaction: number;
    avgDuration: number;
  };
}

// Report 34: Regional Service Performance Metrics
export interface RegionalServicePerformance {
  regionId: string;
  regionName: string;
  locationCount: number;
  technicianCount: number;
  totalCalls: number;
  completedCalls: number;
  avgResponseTime: number;
  firstTimeFixRate: number;
  avgSatisfaction: number;
  slaCompliance: number;
  utilizationRate: number;
  ranking: number;
}

export interface RegionalServicePerformanceMetrics {
  regions: RegionalServicePerformance[];
  summary: {
    totalCalls: number;
    avgFirstTimeFixRate: number;
    avgSlaCompliance: number;
    topRegion: RegionalServicePerformance | null;
    bottomRegion: RegionalServicePerformance | null;
  };
}

// Report 35: Regional SLA Tracking
export interface RegionalSLA {
  regionId: string;
  regionName: string;
  totalCalls: number;
  onTimeCalls: number;
  atRiskCalls: number;
  overdueCalls: number;
  slaCompliancePercent: number;
  avgResponseTime: number;
  avgResolutionTime: number;
  onTrack: boolean;
  locationCount: number;
}

export interface RegionalSLATracking {
  slas: RegionalSLA[];
  summary: {
    totalCalls: number;
    overallCompliance: number;
    regionsOnTrack: number;
    regionsAtRisk: number;
    avgResponseTime: number;
  };
}

// Report 36: Regional Technician Activity Summary
export interface RegionalTechnicianActivity {
  regionId: string;
  regionName: string;
  travelHours: number;
  diagnosticHours: number;
  repairHours: number;
  documentationHours: number;
  totalHours: number;
  billableHours: number;
  utilizationRate: number;
  avgHoursPerTech: number;
  locationCount: number;
}

export interface RegionalTechnicianActivitySummary {
  activities: RegionalTechnicianActivity[];
  summary: {
    totalHours: number;
    totalBillableHours: number;
    averageUtilization: number;
    mostProductiveRegion: RegionalTechnicianActivity | null;
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
// SERVICE MANAGER REPORTING SERVICE
// =====================================================================

export class ServiceManagerReportingService {
  /**
   * Report 33: Get regional service call overview
   */
  static async getRegionalServiceCallOverview(
    userContext: EnhancedUserContext,
    dateRange?: Partial<DateRange>,
  ): Promise<RegionalServiceCallOverview> {
    const cacheKey = `regional-service-calls:${userContext.id}:${JSON.stringify(dateRange)}`;
    const cached = ReportCache.get<RegionalServiceCallOverview>(cacheKey);
    if (cached) return cached;

    const queryBuilder = new HierarchicalQueryBuilder(userContext);
    const accessibleRegionIds = await queryBuilder.getAccessibleRegionIds();

    if (accessibleRegionIds.length === 0) {
      return {
        serviceCalls: [],
        aggregated: [],
        summary: {
          totalRegions: 0,
          totalCalls: 0,
          avgFirstTimeFixRate: 0,
          avgSatisfaction: 0,
          avgDuration: 0,
        },
      };
    }

    const dateFilter =
      dateRange?.dateFrom && dateRange?.dateTo
        ? sql`AND sc.created_at BETWEEN ${dateRange.dateFrom.toISOString()} AND ${dateRange.dateTo.toISOString()}`
        : sql``;

    // Get service calls by region, priority, and status
    const result = await db.execute(sql`
      SELECT
        r.id as region_id,
        r.name as region_name,
        sc.priority,
        sc.status,
        COUNT(sc.id)::int as call_count,
        AVG(EXTRACT(EPOCH FROM (sc.completed_at - sc.created_at)) / 3600)::decimal as avg_duration,
        COUNT(CASE WHEN sc.first_time_fix = true THEN 1 END)::decimal / NULLIF(COUNT(*)::decimal, 0) * 100 as ftf_rate,
        AVG(sc.satisfaction_rating)::decimal as avg_satisfaction,
        COUNT(DISTINCT l.id)::int as location_count
      FROM regions r
      LEFT JOIN locations l ON l.region_id = r.id
      LEFT JOIN users u ON u.primary_location_id = l.id
      LEFT JOIN service_calls sc ON sc.technician_id = u.id
        AND sc.tenant_id = ${userContext.tenant_id}
        ${dateFilter}
      WHERE r.id = ANY(${sql.raw(`ARRAY[${accessibleRegionIds.map((id) => `'${id}'`).join(',')}]`)})
        AND r.tenant_id = ${userContext.tenant_id}
      GROUP BY r.id, r.name, sc.priority, sc.status
      ORDER BY r.name, CASE sc.priority
        WHEN 'Critical' THEN 1
        WHEN 'High' THEN 2
        WHEN 'Medium' THEN 3
        WHEN 'Low' THEN 4
        ELSE 5
      END
    `);

    const serviceCalls: RegionalServiceCall[] = result.rows.map((row: any) => ({
      regionId: row.region_id,
      regionName: row.region_name,
      priority: row.priority || 'Unknown',
      status: row.status || 'Unknown',
      callCount: parseInt(row.call_count || 0),
      avgDuration: parseFloat(row.avg_duration || 0),
      firstTimeFixRate: parseFloat(row.ftf_rate || 0),
      avgSatisfaction: parseFloat(row.avg_satisfaction || 0),
      locationCount: parseInt(row.location_count || 0),
    }));

    // Aggregate by priority across all regions
    const priorityMap = new Map<
      string,
      { totalCalls: number; regionCount: number; totalDuration: number }
    >();
    serviceCalls.forEach((sc) => {
      const existing = priorityMap.get(sc.priority) || {
        totalCalls: 0,
        regionCount: 0,
        totalDuration: 0,
      };
      existing.totalCalls += sc.callCount;
      existing.totalDuration += sc.avgDuration * sc.callCount;
      existing.regionCount += 1;
      priorityMap.set(sc.priority, existing);
    });

    const aggregated = Array.from(priorityMap.entries()).map(([priority, data]) => ({
      priority,
      totalCalls: data.totalCalls,
      avgCallsPerRegion: Math.round((data.totalCalls / data.regionCount) * 100) / 100,
      avgDuration: Math.round((data.totalDuration / data.totalCalls) * 100) / 100,
    }));

    const totalCalls = serviceCalls.reduce((sum, sc) => sum + sc.callCount, 0);
    const totalFTF = serviceCalls.reduce(
      (sum, sc) => sum + (sc.firstTimeFixRate * sc.callCount) / 100,
      0,
    );
    const totalSat = serviceCalls.reduce((sum, sc) => sum + sc.avgSatisfaction * sc.callCount, 0);
    const totalDuration = serviceCalls.reduce((sum, sc) => sum + sc.avgDuration * sc.callCount, 0);

    const summary = {
      totalRegions: new Set(serviceCalls.map((sc) => sc.regionId)).size,
      totalCalls,
      avgFirstTimeFixRate: totalCalls > 0 ? Math.round((totalFTF / totalCalls) * 100) / 100 : 0,
      avgSatisfaction: totalCalls > 0 ? Math.round((totalSat / totalCalls) * 100) / 100 : 0,
      avgDuration: totalCalls > 0 ? Math.round((totalDuration / totalCalls) * 100) / 100 : 0,
    };

    const response = { serviceCalls, aggregated, summary };
    ReportCache.set(cacheKey, response);
    return response;
  }

  /**
   * Report 34: Get regional service performance metrics
   */
  static async getRegionalServicePerformanceMetrics(
    userContext: EnhancedUserContext,
    dateRange?: Partial<DateRange>,
  ): Promise<RegionalServicePerformanceMetrics> {
    const cacheKey = `regional-service-performance:${userContext.id}:${JSON.stringify(dateRange)}`;
    const cached = ReportCache.get<RegionalServicePerformanceMetrics>(cacheKey);
    if (cached) return cached;

    const queryBuilder = new HierarchicalQueryBuilder(userContext);
    const accessibleRegionIds = await queryBuilder.getAccessibleRegionIds();

    if (accessibleRegionIds.length === 0) {
      return {
        regions: [],
        summary: {
          totalCalls: 0,
          avgFirstTimeFixRate: 0,
          avgSlaCompliance: 0,
          topRegion: null,
          bottomRegion: null,
        },
      };
    }

    const dateFilter =
      dateRange?.dateFrom && dateRange?.dateTo
        ? sql`AND sc.created_at BETWEEN ${dateRange.dateFrom.toISOString()} AND ${dateRange.dateTo.toISOString()}`
        : sql``;

    const result = await db.execute(sql`
      WITH regional_metrics AS (
        SELECT
          r.id as region_id,
          r.name as region_name,
          COUNT(DISTINCT l.id)::int as location_count,
          COUNT(DISTINCT u.id)::int as technician_count,
          COUNT(sc.id)::int as total_calls,
          COUNT(CASE WHEN sc.status = 'Completed' THEN 1 END)::int as completed_calls,
          AVG(EXTRACT(EPOCH FROM (sc.first_response_at - sc.created_at)) / 3600)::decimal as avg_response_time,
          COUNT(CASE WHEN sc.first_time_fix = true THEN 1 END)::decimal / NULLIF(COUNT(*)::decimal, 0) * 100 as ftf_rate,
          AVG(sc.satisfaction_rating)::decimal as avg_satisfaction,
          COUNT(CASE WHEN sc.sla_status = 'on_time' THEN 1 END)::decimal / NULLIF(COUNT(*)::decimal, 0) * 100 as sla_compliance,
          SUM(te.hours)::decimal / NULLIF(COUNT(DISTINCT u.id)::decimal * 40, 0) * 100 as utilization_rate
        FROM regions r
        LEFT JOIN locations l ON l.region_id = r.id
        LEFT JOIN users u ON u.primary_location_id = l.id
        LEFT JOIN service_calls sc ON sc.technician_id = u.id
          AND sc.tenant_id = ${userContext.tenant_id}
          ${dateFilter}
        LEFT JOIN time_entries te ON te.user_id = u.id
          AND te.tenant_id = ${userContext.tenant_id}
          ${dateFilter}
        WHERE r.id = ANY(${sql.raw(`ARRAY[${accessibleRegionIds.map((id) => `'${id}'`).join(',')}]`)})
          AND r.tenant_id = ${userContext.tenant_id}
        GROUP BY r.id, r.name
      )
      SELECT
        *,
        RANK() OVER (ORDER BY ftf_rate DESC, sla_compliance DESC) as ranking
      FROM regional_metrics
      ORDER BY ranking
    `);

    const regions: RegionalServicePerformance[] = result.rows.map((row: any) => ({
      regionId: row.region_id,
      regionName: row.region_name,
      locationCount: parseInt(row.location_count || 0),
      technicianCount: parseInt(row.technician_count || 0),
      totalCalls: parseInt(row.total_calls || 0),
      completedCalls: parseInt(row.completed_calls || 0),
      avgResponseTime: parseFloat(row.avg_response_time || 0),
      firstTimeFixRate: parseFloat(row.ftf_rate || 0),
      avgSatisfaction: parseFloat(row.avg_satisfaction || 0),
      slaCompliance: parseFloat(row.sla_compliance || 0),
      utilizationRate: parseFloat(row.utilization_rate || 0),
      ranking: parseInt(row.ranking || 0),
    }));

    const totalCalls = regions.reduce((sum, reg) => sum + reg.totalCalls, 0);
    const totalFTF = regions.reduce(
      (sum, reg) => sum + (reg.firstTimeFixRate * reg.totalCalls) / 100,
      0,
    );
    const totalSLA = regions.reduce(
      (sum, reg) => sum + (reg.slaCompliance * reg.totalCalls) / 100,
      0,
    );

    const summary = {
      totalCalls,
      avgFirstTimeFixRate: totalCalls > 0 ? Math.round((totalFTF / totalCalls) * 100) / 100 : 0,
      avgSlaCompliance: totalCalls > 0 ? Math.round((totalSLA / totalCalls) * 100) / 100 : 0,
      topRegion: regions.length > 0 ? regions[0] : null,
      bottomRegion: regions.length > 0 ? regions[regions.length - 1] : null,
    };

    const response = { regions, summary };
    ReportCache.set(cacheKey, response);
    return response;
  }

  /**
   * Report 35: Get regional SLA tracking
   */
  static async getRegionalSLATracking(
    userContext: EnhancedUserContext,
    dateRange?: Partial<DateRange>,
  ): Promise<RegionalSLATracking> {
    const cacheKey = `regional-sla:${userContext.id}:${JSON.stringify(dateRange)}`;
    const cached = ReportCache.get<RegionalSLATracking>(cacheKey);
    if (cached) return cached;

    const queryBuilder = new HierarchicalQueryBuilder(userContext);
    const accessibleRegionIds = await queryBuilder.getAccessibleRegionIds();

    if (accessibleRegionIds.length === 0) {
      return {
        slas: [],
        summary: {
          totalCalls: 0,
          overallCompliance: 0,
          regionsOnTrack: 0,
          regionsAtRisk: 0,
          avgResponseTime: 0,
        },
      };
    }

    const dateFilter =
      dateRange?.dateFrom && dateRange?.dateTo
        ? sql`AND sc.created_at BETWEEN ${dateRange.dateFrom.toISOString()} AND ${dateRange.dateTo.toISOString()}`
        : sql``;

    const result = await db.execute(sql`
      SELECT
        r.id as region_id,
        r.name as region_name,
        COUNT(DISTINCT l.id)::int as location_count,
        COUNT(sc.id)::int as total_calls,
        COUNT(CASE WHEN sc.sla_status = 'on_time' THEN 1 END)::int as on_time_calls,
        COUNT(CASE WHEN sc.sla_status = 'at_risk' THEN 1 END)::int as at_risk_calls,
        COUNT(CASE WHEN sc.sla_status = 'overdue' THEN 1 END)::int as overdue_calls,
        COUNT(CASE WHEN sc.sla_status = 'on_time' THEN 1 END)::decimal / NULLIF(COUNT(*)::decimal, 0) * 100 as sla_compliance,
        AVG(EXTRACT(EPOCH FROM (sc.first_response_at - sc.created_at)) / 3600)::decimal as avg_response_time,
        AVG(EXTRACT(EPOCH FROM (sc.completed_at - sc.created_at)) / 3600)::decimal as avg_resolution_time
      FROM regions r
      LEFT JOIN locations l ON l.region_id = r.id
      LEFT JOIN users u ON u.primary_location_id = l.id
      LEFT JOIN service_calls sc ON sc.technician_id = u.id
        AND sc.tenant_id = ${userContext.tenant_id}
        ${dateFilter}
      WHERE r.id = ANY(${sql.raw(`ARRAY[${accessibleRegionIds.map((id) => `'${id}'`).join(',')}]`)})
        AND r.tenant_id = ${userContext.tenant_id}
      GROUP BY r.id, r.name
      ORDER BY sla_compliance DESC
    `);

    const slas: RegionalSLA[] = result.rows.map((row: any) => {
      const compliance = parseFloat(row.sla_compliance || 0);
      return {
        regionId: row.region_id,
        regionName: row.region_name,
        totalCalls: parseInt(row.total_calls || 0),
        onTimeCalls: parseInt(row.on_time_calls || 0),
        atRiskCalls: parseInt(row.at_risk_calls || 0),
        overdueCalls: parseInt(row.overdue_calls || 0),
        slaCompliancePercent: compliance,
        avgResponseTime: parseFloat(row.avg_response_time || 0),
        avgResolutionTime: parseFloat(row.avg_resolution_time || 0),
        onTrack: compliance >= 90,
        locationCount: parseInt(row.location_count || 0),
      };
    });

    const totalCalls = slas.reduce((sum, sla) => sum + sla.totalCalls, 0);
    const totalOnTime = slas.reduce((sum, sla) => sum + sla.onTimeCalls, 0);
    const totalResponse = slas.reduce((sum, sla) => sum + sla.avgResponseTime * sla.totalCalls, 0);

    const summary = {
      totalCalls,
      overallCompliance:
        totalCalls > 0 ? Math.round((totalOnTime / totalCalls) * 100 * 100) / 100 : 0,
      regionsOnTrack: slas.filter((sla) => sla.onTrack).length,
      regionsAtRisk: slas.filter((sla) => !sla.onTrack).length,
      avgResponseTime: totalCalls > 0 ? Math.round((totalResponse / totalCalls) * 100) / 100 : 0,
    };

    const response = { slas, summary };
    ReportCache.set(cacheKey, response);
    return response;
  }

  /**
   * Report 36: Get regional technician activity summary
   */
  static async getRegionalTechnicianActivitySummary(
    userContext: EnhancedUserContext,
    dateRange?: Partial<DateRange>,
  ): Promise<RegionalTechnicianActivitySummary> {
    const cacheKey = `regional-tech-activity:${userContext.id}:${JSON.stringify(dateRange)}`;
    const cached = ReportCache.get<RegionalTechnicianActivitySummary>(cacheKey);
    if (cached) return cached;

    const queryBuilder = new HierarchicalQueryBuilder(userContext);
    const accessibleRegionIds = await queryBuilder.getAccessibleRegionIds();

    if (accessibleRegionIds.length === 0) {
      return {
        activities: [],
        summary: {
          totalHours: 0,
          totalBillableHours: 0,
          averageUtilization: 0,
          mostProductiveRegion: null,
        },
      };
    }

    const dateFilter =
      dateRange?.dateFrom && dateRange?.dateTo
        ? sql`AND te.date BETWEEN ${dateRange.dateFrom.toISOString().split('T')[0]} AND ${dateRange.dateTo.toISOString().split('T')[0]}`
        : sql``;

    const result = await db.execute(sql`
      SELECT
        r.id as region_id,
        r.name as region_name,
        COUNT(DISTINCT l.id)::int as location_count,
        SUM(CASE WHEN te.activity_type = 'travel' THEN te.hours ELSE 0 END)::decimal as travel_hours,
        SUM(CASE WHEN te.activity_type = 'diagnostic' THEN te.hours ELSE 0 END)::decimal as diagnostic_hours,
        SUM(CASE WHEN te.activity_type = 'repair' THEN te.hours ELSE 0 END)::decimal as repair_hours,
        SUM(CASE WHEN te.activity_type = 'documentation' THEN te.hours ELSE 0 END)::decimal as documentation_hours,
        SUM(te.hours)::decimal as total_hours,
        SUM(CASE WHEN te.billable = true THEN te.hours ELSE 0 END)::decimal as billable_hours,
        COUNT(DISTINCT u.id)::int as tech_count
      FROM regions r
      LEFT JOIN locations l ON l.region_id = r.id
      LEFT JOIN users u ON u.primary_location_id = l.id
      LEFT JOIN time_entries te ON te.user_id = u.id
        AND te.tenant_id = ${userContext.tenant_id}
        ${dateFilter}
      WHERE r.id = ANY(${sql.raw(`ARRAY[${accessibleRegionIds.map((id) => `'${id}'`).join(',')}]`)})
        AND r.tenant_id = ${userContext.tenant_id}
      GROUP BY r.id, r.name
      ORDER BY total_hours DESC
    `);

    const activities: RegionalTechnicianActivity[] = result.rows.map((row: any) => {
      const totalHours = parseFloat(row.total_hours || 0);
      const billableHours = parseFloat(row.billable_hours || 0);
      const techCount = parseInt(row.tech_count || 1);
      return {
        regionId: row.region_id,
        regionName: row.region_name,
        travelHours: parseFloat(row.travel_hours || 0),
        diagnosticHours: parseFloat(row.diagnostic_hours || 0),
        repairHours: parseFloat(row.repair_hours || 0),
        documentationHours: parseFloat(row.documentation_hours || 0),
        totalHours,
        billableHours,
        utilizationRate:
          totalHours > 0 ? Math.round((billableHours / totalHours) * 100 * 100) / 100 : 0,
        avgHoursPerTech: techCount > 0 ? Math.round((totalHours / techCount) * 100) / 100 : 0,
        locationCount: parseInt(row.location_count || 0),
      };
    });

    const totalHours = activities.reduce((sum, act) => sum + act.totalHours, 0);
    const totalBillable = activities.reduce((sum, act) => sum + act.billableHours, 0);
    const totalUtilization = activities.reduce((sum, act) => sum + act.utilizationRate, 0);

    const summary = {
      totalHours,
      totalBillableHours: totalBillable,
      averageUtilization:
        activities.length > 0 ? Math.round((totalUtilization / activities.length) * 100) / 100 : 0,
      mostProductiveRegion: activities.length > 0 ? activities[0] : null,
    };

    const response = { activities, summary };
    ReportCache.set(cacheKey, response);
    return response;
  }

  /**
   * Clear cache for service manager reports
   */
  static clearCache(): void {
    ReportCache.clear('regional-service');
    ReportCache.clear('regional-sla');
    ReportCache.clear('regional-tech');
  }
}
