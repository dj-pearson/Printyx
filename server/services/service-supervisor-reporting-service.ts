// =====================================================================
// SERVICE SUPERVISOR REPORTING SERVICE
// Business logic for service supervisor reports (Level 3 - Reports 29-32)
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

// Report 29: Location Service Call Overview
export interface LocationServiceCall {
  locationId: string;
  locationName: string;
  priority: string;
  status: string;
  callCount: number;
  avgDuration: number;
  firstTimeFixRate: number;
  avgSatisfaction: number;
}

export interface LocationServiceCallOverview {
  serviceCalls: LocationServiceCall[];
  aggregated: Array<{
    priority: string;
    totalCalls: number;
    avgCallsPerLocation: number;
    avgDuration: number;
  }>;
  summary: {
    totalLocations: number;
    totalCalls: number;
    avgFirstTimeFixRate: number;
    avgSatisfaction: number;
    avgDuration: number;
  };
}

// Report 30: Location Service Performance Metrics
export interface LocationServicePerformance {
  locationId: string;
  locationName: string;
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

export interface LocationServicePerformanceMetrics {
  locations: LocationServicePerformance[];
  summary: {
    totalCalls: number;
    avgFirstTimeFixRate: number;
    avgSlaCompliance: number;
    topLocation: LocationServicePerformance | null;
    bottomLocation: LocationServicePerformance | null;
  };
}

// Report 31: Location SLA Tracking
export interface LocationSLA {
  locationId: string;
  locationName: string;
  totalCalls: number;
  onTimeCalls: number;
  atRiskCalls: number;
  overdueCalls: number;
  slaCompliancePercent: number;
  avgResponseTime: number;
  avgResolutionTime: number;
  onTrack: boolean;
}

export interface LocationSLATracking {
  slas: LocationSLA[];
  summary: {
    totalCalls: number;
    overallCompliance: number;
    locationsOnTrack: number;
    locationsAtRisk: number;
    avgResponseTime: number;
  };
}

// Report 32: Location Technician Activity Summary
export interface LocationTechnicianActivity {
  locationId: string;
  locationName: string;
  travelHours: number;
  diagnosticHours: number;
  repairHours: number;
  documentationHours: number;
  totalHours: number;
  billableHours: number;
  utilizationRate: number;
  avgHoursPerTech: number;
}

export interface LocationTechnicianActivitySummary {
  activities: LocationTechnicianActivity[];
  summary: {
    totalHours: number;
    totalBillableHours: number;
    averageUtilization: number;
    mostProductiveLocation: LocationTechnicianActivity | null;
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
// SERVICE SUPERVISOR REPORTING SERVICE
// =====================================================================

export class ServiceSupervisorReportingService {
  /**
   * Report 29: Get location service call overview
   */
  static async getLocationServiceCallOverview(
    userContext: EnhancedUserContext,
    dateRange?: Partial<DateRange>,
  ): Promise<LocationServiceCallOverview> {
    const cacheKey = `location-service-calls:${userContext.id}:${JSON.stringify(dateRange)}`;
    const cached = ReportCache.get<LocationServiceCallOverview>(cacheKey);
    if (cached) return cached;

    const queryBuilder = new HierarchicalQueryBuilder(userContext);
    const accessibleLocationIds = await queryBuilder.getAccessibleLocationIds();

    if (accessibleLocationIds.length === 0) {
      return {
        serviceCalls: [],
        aggregated: [],
        summary: {
          totalLocations: 0,
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

    // Get service calls by location, priority, and status
    const result = await db.execute(sql`
      SELECT
        l.id as location_id,
        l.name as location_name,
        sc.priority,
        sc.status,
        COUNT(sc.id)::int as call_count,
        AVG(EXTRACT(EPOCH FROM (sc.completed_at - sc.created_at)) / 3600)::decimal as avg_duration,
        COUNT(CASE WHEN sc.first_time_fix = true THEN 1 END)::decimal / NULLIF(COUNT(*)::decimal, 0) * 100 as ftf_rate,
        AVG(sc.satisfaction_rating)::decimal as avg_satisfaction
      FROM locations l
      LEFT JOIN users u ON u.primary_location_id = l.id
      LEFT JOIN service_calls sc ON sc.technician_id = u.id
        AND sc.tenant_id = ${userContext.tenant_id}
        ${dateFilter}
      WHERE l.id = ANY(${sql.raw(`ARRAY[${accessibleLocationIds.map((id) => `'${id}'`).join(',')}]`)})
        AND l.tenant_id = ${userContext.tenant_id}
      GROUP BY l.id, l.name, sc.priority, sc.status
      ORDER BY l.name, CASE sc.priority
        WHEN 'Critical' THEN 1
        WHEN 'High' THEN 2
        WHEN 'Medium' THEN 3
        WHEN 'Low' THEN 4
        ELSE 5
      END
    `);

    const serviceCalls: LocationServiceCall[] = result.rows.map((row: any) => ({
      locationId: row.location_id,
      locationName: row.location_name,
      priority: row.priority || 'Unknown',
      status: row.status || 'Unknown',
      callCount: parseInt(row.call_count || 0),
      avgDuration: parseFloat(row.avg_duration || 0),
      firstTimeFixRate: parseFloat(row.ftf_rate || 0),
      avgSatisfaction: parseFloat(row.avg_satisfaction || 0),
    }));

    // Aggregate by priority across all locations
    const priorityMap = new Map<
      string,
      { totalCalls: number; locationCount: number; totalDuration: number }
    >();
    serviceCalls.forEach((sc) => {
      const existing = priorityMap.get(sc.priority) || {
        totalCalls: 0,
        locationCount: 0,
        totalDuration: 0,
      };
      existing.totalCalls += sc.callCount;
      existing.totalDuration += sc.avgDuration * sc.callCount;
      existing.locationCount += 1;
      priorityMap.set(sc.priority, existing);
    });

    const aggregated = Array.from(priorityMap.entries()).map(([priority, data]) => ({
      priority,
      totalCalls: data.totalCalls,
      avgCallsPerLocation: Math.round((data.totalCalls / data.locationCount) * 100) / 100,
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
      totalLocations: new Set(serviceCalls.map((sc) => sc.locationId)).size,
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
   * Report 30: Get location service performance metrics
   */
  static async getLocationServicePerformanceMetrics(
    userContext: EnhancedUserContext,
    dateRange?: Partial<DateRange>,
  ): Promise<LocationServicePerformanceMetrics> {
    const cacheKey = `location-service-performance:${userContext.id}:${JSON.stringify(dateRange)}`;
    const cached = ReportCache.get<LocationServicePerformanceMetrics>(cacheKey);
    if (cached) return cached;

    const queryBuilder = new HierarchicalQueryBuilder(userContext);
    const accessibleLocationIds = await queryBuilder.getAccessibleLocationIds();

    if (accessibleLocationIds.length === 0) {
      return {
        locations: [],
        summary: {
          totalCalls: 0,
          avgFirstTimeFixRate: 0,
          avgSlaCompliance: 0,
          topLocation: null,
          bottomLocation: null,
        },
      };
    }

    const dateFilter =
      dateRange?.dateFrom && dateRange?.dateTo
        ? sql`AND sc.created_at BETWEEN ${dateRange.dateFrom.toISOString()} AND ${dateRange.dateTo.toISOString()}`
        : sql``;

    const result = await db.execute(sql`
      WITH location_metrics AS (
        SELECT
          l.id as location_id,
          l.name as location_name,
          COUNT(DISTINCT u.id)::int as technician_count,
          COUNT(sc.id)::int as total_calls,
          COUNT(CASE WHEN sc.status = 'Completed' THEN 1 END)::int as completed_calls,
          AVG(EXTRACT(EPOCH FROM (sc.first_response_at - sc.created_at)) / 3600)::decimal as avg_response_time,
          COUNT(CASE WHEN sc.first_time_fix = true THEN 1 END)::decimal / NULLIF(COUNT(*)::decimal, 0) * 100 as ftf_rate,
          AVG(sc.satisfaction_rating)::decimal as avg_satisfaction,
          COUNT(CASE WHEN sc.sla_status = 'on_time' THEN 1 END)::decimal / NULLIF(COUNT(*)::decimal, 0) * 100 as sla_compliance,
          SUM(te.hours)::decimal / NULLIF(COUNT(DISTINCT u.id)::decimal * 40, 0) * 100 as utilization_rate
        FROM locations l
        LEFT JOIN users u ON u.primary_location_id = l.id
        LEFT JOIN service_calls sc ON sc.technician_id = u.id
          AND sc.tenant_id = ${userContext.tenant_id}
          ${dateFilter}
        LEFT JOIN time_entries te ON te.user_id = u.id
          AND te.tenant_id = ${userContext.tenant_id}
          ${dateFilter}
        WHERE l.id = ANY(${sql.raw(`ARRAY[${accessibleLocationIds.map((id) => `'${id}'`).join(',')}]`)})
          AND l.tenant_id = ${userContext.tenant_id}
        GROUP BY l.id, l.name
      )
      SELECT
        *,
        RANK() OVER (ORDER BY ftf_rate DESC, sla_compliance DESC) as ranking
      FROM location_metrics
      ORDER BY ranking
    `);

    const locations: LocationServicePerformance[] = result.rows.map((row: any) => ({
      locationId: row.location_id,
      locationName: row.location_name,
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

    const totalCalls = locations.reduce((sum, loc) => sum + loc.totalCalls, 0);
    const totalFTF = locations.reduce(
      (sum, loc) => sum + (loc.firstTimeFixRate * loc.totalCalls) / 100,
      0,
    );
    const totalSLA = locations.reduce(
      (sum, loc) => sum + (loc.slaCompliance * loc.totalCalls) / 100,
      0,
    );

    const summary = {
      totalCalls,
      avgFirstTimeFixRate: totalCalls > 0 ? Math.round((totalFTF / totalCalls) * 100) / 100 : 0,
      avgSlaCompliance: totalCalls > 0 ? Math.round((totalSLA / totalCalls) * 100) / 100 : 0,
      topLocation: locations.length > 0 ? locations[0] : null,
      bottomLocation: locations.length > 0 ? locations[locations.length - 1] : null,
    };

    const response = { locations, summary };
    ReportCache.set(cacheKey, response);
    return response;
  }

  /**
   * Report 31: Get location SLA tracking
   */
  static async getLocationSLATracking(
    userContext: EnhancedUserContext,
    dateRange?: Partial<DateRange>,
  ): Promise<LocationSLATracking> {
    const cacheKey = `location-sla:${userContext.id}:${JSON.stringify(dateRange)}`;
    const cached = ReportCache.get<LocationSLATracking>(cacheKey);
    if (cached) return cached;

    const queryBuilder = new HierarchicalQueryBuilder(userContext);
    const accessibleLocationIds = await queryBuilder.getAccessibleLocationIds();

    if (accessibleLocationIds.length === 0) {
      return {
        slas: [],
        summary: {
          totalCalls: 0,
          overallCompliance: 0,
          locationsOnTrack: 0,
          locationsAtRisk: 0,
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
        l.id as location_id,
        l.name as location_name,
        COUNT(sc.id)::int as total_calls,
        COUNT(CASE WHEN sc.sla_status = 'on_time' THEN 1 END)::int as on_time_calls,
        COUNT(CASE WHEN sc.sla_status = 'at_risk' THEN 1 END)::int as at_risk_calls,
        COUNT(CASE WHEN sc.sla_status = 'overdue' THEN 1 END)::int as overdue_calls,
        COUNT(CASE WHEN sc.sla_status = 'on_time' THEN 1 END)::decimal / NULLIF(COUNT(*)::decimal, 0) * 100 as sla_compliance,
        AVG(EXTRACT(EPOCH FROM (sc.first_response_at - sc.created_at)) / 3600)::decimal as avg_response_time,
        AVG(EXTRACT(EPOCH FROM (sc.completed_at - sc.created_at)) / 3600)::decimal as avg_resolution_time
      FROM locations l
      LEFT JOIN users u ON u.primary_location_id = l.id
      LEFT JOIN service_calls sc ON sc.technician_id = u.id
        AND sc.tenant_id = ${userContext.tenant_id}
        ${dateFilter}
      WHERE l.id = ANY(${sql.raw(`ARRAY[${accessibleLocationIds.map((id) => `'${id}'`).join(',')}]`)})
        AND l.tenant_id = ${userContext.tenant_id}
      GROUP BY l.id, l.name
      ORDER BY sla_compliance DESC
    `);

    const slas: LocationSLA[] = result.rows.map((row: any) => {
      const compliance = parseFloat(row.sla_compliance || 0);
      return {
        locationId: row.location_id,
        locationName: row.location_name,
        totalCalls: parseInt(row.total_calls || 0),
        onTimeCalls: parseInt(row.on_time_calls || 0),
        atRiskCalls: parseInt(row.at_risk_calls || 0),
        overdueCalls: parseInt(row.overdue_calls || 0),
        slaCompliancePercent: compliance,
        avgResponseTime: parseFloat(row.avg_response_time || 0),
        avgResolutionTime: parseFloat(row.avg_resolution_time || 0),
        onTrack: compliance >= 90,
      };
    });

    const totalCalls = slas.reduce((sum, sla) => sum + sla.totalCalls, 0);
    const totalOnTime = slas.reduce((sum, sla) => sum + sla.onTimeCalls, 0);
    const totalResponse = slas.reduce((sum, sla) => sum + sla.avgResponseTime * sla.totalCalls, 0);

    const summary = {
      totalCalls,
      overallCompliance:
        totalCalls > 0 ? Math.round((totalOnTime / totalCalls) * 100 * 100) / 100 : 0,
      locationsOnTrack: slas.filter((sla) => sla.onTrack).length,
      locationsAtRisk: slas.filter((sla) => !sla.onTrack).length,
      avgResponseTime: totalCalls > 0 ? Math.round((totalResponse / totalCalls) * 100) / 100 : 0,
    };

    const response = { slas, summary };
    ReportCache.set(cacheKey, response);
    return response;
  }

  /**
   * Report 32: Get location technician activity summary
   */
  static async getLocationTechnicianActivitySummary(
    userContext: EnhancedUserContext,
    dateRange?: Partial<DateRange>,
  ): Promise<LocationTechnicianActivitySummary> {
    const cacheKey = `location-tech-activity:${userContext.id}:${JSON.stringify(dateRange)}`;
    const cached = ReportCache.get<LocationTechnicianActivitySummary>(cacheKey);
    if (cached) return cached;

    const queryBuilder = new HierarchicalQueryBuilder(userContext);
    const accessibleLocationIds = await queryBuilder.getAccessibleLocationIds();

    if (accessibleLocationIds.length === 0) {
      return {
        activities: [],
        summary: {
          totalHours: 0,
          totalBillableHours: 0,
          averageUtilization: 0,
          mostProductiveLocation: null,
        },
      };
    }

    const dateFilter =
      dateRange?.dateFrom && dateRange?.dateTo
        ? sql`AND te.date BETWEEN ${dateRange.dateFrom.toISOString().split('T')[0]} AND ${dateRange.dateTo.toISOString().split('T')[0]}`
        : sql``;

    const result = await db.execute(sql`
      SELECT
        l.id as location_id,
        l.name as location_name,
        SUM(CASE WHEN te.activity_type = 'travel' THEN te.hours ELSE 0 END)::decimal as travel_hours,
        SUM(CASE WHEN te.activity_type = 'diagnostic' THEN te.hours ELSE 0 END)::decimal as diagnostic_hours,
        SUM(CASE WHEN te.activity_type = 'repair' THEN te.hours ELSE 0 END)::decimal as repair_hours,
        SUM(CASE WHEN te.activity_type = 'documentation' THEN te.hours ELSE 0 END)::decimal as documentation_hours,
        SUM(te.hours)::decimal as total_hours,
        SUM(CASE WHEN te.billable = true THEN te.hours ELSE 0 END)::decimal as billable_hours,
        COUNT(DISTINCT u.id)::int as tech_count
      FROM locations l
      LEFT JOIN users u ON u.primary_location_id = l.id
      LEFT JOIN time_entries te ON te.user_id = u.id
        AND te.tenant_id = ${userContext.tenant_id}
        ${dateFilter}
      WHERE l.id = ANY(${sql.raw(`ARRAY[${accessibleLocationIds.map((id) => `'${id}'`).join(',')}]`)})
        AND l.tenant_id = ${userContext.tenant_id}
      GROUP BY l.id, l.name
      ORDER BY total_hours DESC
    `);

    const activities: LocationTechnicianActivity[] = result.rows.map((row: any) => {
      const totalHours = parseFloat(row.total_hours || 0);
      const billableHours = parseFloat(row.billable_hours || 0);
      const techCount = parseInt(row.tech_count || 1);
      return {
        locationId: row.location_id,
        locationName: row.location_name,
        travelHours: parseFloat(row.travel_hours || 0),
        diagnosticHours: parseFloat(row.diagnostic_hours || 0),
        repairHours: parseFloat(row.repair_hours || 0),
        documentationHours: parseFloat(row.documentation_hours || 0),
        totalHours,
        billableHours,
        utilizationRate:
          totalHours > 0 ? Math.round((billableHours / totalHours) * 100 * 100) / 100 : 0,
        avgHoursPerTech: techCount > 0 ? Math.round((totalHours / techCount) * 100) / 100 : 0,
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
      mostProductiveLocation: activities.length > 0 ? activities[0] : null,
    };

    const response = { activities, summary };
    ReportCache.set(cacheKey, response);
    return response;
  }

  /**
   * Get team quick stats for embedded widgets
   * Lightweight aggregation of key service metrics
   */
  static async getTeamQuickStats(userContext: EnhancedUserContext): Promise<{
    performance: {
      firstTimeFixRate: number;
      slaCompliance: number;
      customerSatisfaction: number;
      utilizationRate: number;
    };
    activity: {
      totalCalls: number;
      completedCalls: number;
      scheduledCalls: number;
      overdueTickets: number;
    };
    team: {
      totalTechnicians: number;
      activeTechnicians: number;
      topTechnician: string;
      techsNeedingSupport: number;
    };
    trends: {
      ftfTrend: 'up' | 'down' | 'stable';
      slaTrend: 'up' | 'down' | 'stable';
      csatTrend: 'up' | 'down' | 'stable';
    };
  }> {
    const cacheKey = `team-quick-stats-${userContext.user_id}`;
    const cached = ReportCache.get(cacheKey);
    if (cached) return cached;

    const queryBuilder = new HierarchicalQueryBuilder(userContext);
    const accessibleUserIds = await queryBuilder.getAccessibleUserIds();

    // Performance metrics (simplified queries for speed)
    const performanceQuery = sql`
      SELECT
        COUNT(*) FILTER (WHERE first_time_fix = true) * 100.0 / NULLIF(COUNT(*), 0) as ftf_rate,
        COUNT(*) FILTER (WHERE sla_status = 'on_time') * 100.0 / NULLIF(COUNT(*), 0) as sla_compliance,
        AVG(customer_satisfaction) as avg_csat
      FROM service_calls
      WHERE assigned_technician_id IN (${sql.join(accessibleUserIds, sql`, `)})
        AND completed_date >= CURRENT_DATE - INTERVAL '30 days'
        AND status = 'completed'
    `;

    const activityQuery = sql`
      SELECT
        COUNT(*) as total_calls,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_calls,
        COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled_calls,
        COUNT(*) FILTER (WHERE sla_status = 'overdue') as overdue_tickets
      FROM service_calls
      WHERE assigned_technician_id IN (${sql.join(accessibleUserIds, sql`, `)})
        AND created_at >= CURRENT_DATE - INTERVAL '30 days'
    `;

    const teamQuery = sql`
      SELECT
        COUNT(DISTINCT id) as total_techs,
        COUNT(DISTINCT id) FILTER (WHERE status = 'active') as active_techs,
        (
          SELECT CONCAT(first_name, ' ', last_name)
          FROM users u
          INNER JOIN service_calls sc ON sc.assigned_technician_id = u.id
          WHERE u.id IN (${sql.join(accessibleUserIds, sql`, `)})
            AND sc.completed_date >= CURRENT_DATE - INTERVAL '30 days'
          GROUP BY u.id, u.first_name, u.last_name
          ORDER BY COUNT(*) DESC
          LIMIT 1
        ) as top_tech
      FROM users
      WHERE id IN (${sql.join(accessibleUserIds, sql`, `)})
        AND role IN ('technician', 'service_manager', 'service_supervisor')
    `;

    const [perfResults, activityResults, teamResults] = await Promise.all([
      db.execute(performanceQuery),
      db.execute(activityQuery),
      db.execute(teamQuery),
    ]);

    const perf = perfResults.rows[0] as any;
    const activity = activityResults.rows[0] as any;
    const team = teamResults.rows[0] as any;

    // Simplified utilization calc (billable hours / total available hours)
    const utilizationRate = 75; // Placeholder - would need time tracking data

    // Simplified trends (would compare to previous period in real implementation)
    const trends = {
      ftfTrend: 'stable' as 'up' | 'down' | 'stable',
      slaTrend: 'stable' as 'up' | 'down' | 'stable',
      csatTrend: 'stable' as 'up' | 'down' | 'stable',
    };

    // Identify techs needing support (low FTF or high overdue)
    const techsNeedingSupport = 0; // Placeholder - would need per-tech analysis

    const response = {
      performance: {
        firstTimeFixRate: Number(perf?.ftf_rate || 0),
        slaCompliance: Number(perf?.sla_compliance || 0),
        customerSatisfaction: Number(perf?.avg_csat || 0),
        utilizationRate,
      },
      activity: {
        totalCalls: Number(activity?.total_calls || 0),
        completedCalls: Number(activity?.completed_calls || 0),
        scheduledCalls: Number(activity?.scheduled_calls || 0),
        overdueTickets: Number(activity?.overdue_tickets || 0),
      },
      team: {
        totalTechnicians: Number(team?.total_techs || 0),
        activeTechnicians: Number(team?.active_techs || 0),
        topTechnician: team?.top_tech || 'N/A',
        techsNeedingSupport,
      },
      trends,
    };

    ReportCache.set(cacheKey, response);
    return response;
  }

  /**
   * Clear cache for service supervisor reports
   */
  static clearCache(): void {
    ReportCache.clear('location-service');
    ReportCache.clear('location-sla');
    ReportCache.clear('location-tech');
  }
}
