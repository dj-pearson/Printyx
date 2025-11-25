// =====================================================================
// DIRECTOR REPORTING SERVICE
// Business logic for director-level reports (Level 5 & 6 - Reports 16-23, 37-44)
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

// Level 5 & 6: Company-Wide Sales Performance
export interface CompanySalesPerformance {
  totalRevenue: number;
  totalDeals: number;
  averageWinRate: number;
  averageDealSize: number;
  quotaAttainment: number;
  pipelineValue: number;
  regions: Array<{
    regionId: string;
    regionName: string;
    revenue: number;
    deals: number;
    winRate: number;
    quotaAttainment: number;
  }>;
  topPerformers: Array<{
    userId: string;
    userName: string;
    revenue: number;
    deals: number;
  }>;
  forecast: {
    currentQuarter: number;
    nextQuarter: number;
    yearEnd: number;
  };
}

// Level 5 & 6: Company-Wide Service Performance
export interface CompanyServicePerformance {
  totalCalls: number;
  avgFirstTimeFixRate: number;
  avgSlaCompliance: number;
  avgCustomerSatisfaction: number;
  totalTechnicians: number;
  avgUtilization: number;
  regions: Array<{
    regionId: string;
    regionName: string;
    calls: number;
    ftfRate: number;
    slaCompliance: number;
    technicians: number;
  }>;
  topPerformers: Array<{
    userId: string;
    userName: string;
    ftfRate: number;
    satisfaction: number;
  }>;
  trends: {
    callVolumeChange: number;
    ftfRateChange: number;
    slaComplianceChange: number;
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
// DIRECTOR REPORTING SERVICE
// =====================================================================

export class DirectorReportingService {
  /**
   * Company-Wide Sales Performance (Level 5 & 6)
   */
  static async getCompanySalesPerformance(
    userContext: EnhancedUserContext,
    dateRange?: Partial<DateRange>
  ): Promise<CompanySalesPerformance> {
    const cacheKey = `company-sales-performance:${userContext.tenantId}:${JSON.stringify(dateRange)}`;
    const cached = ReportCache.get<CompanySalesPerformance>(cacheKey);
    if (cached) return cached;

    const dateFilter = dateRange?.dateFrom && dateRange?.dateTo
      ? sql`AND o.closed_at BETWEEN ${dateRange.dateFrom.toISOString()} AND ${dateRange.dateTo.toISOString()}`
      : sql``;

    // Get company-wide metrics
    const result = await db.execute(sql`
      WITH company_metrics AS (
        SELECT
          SUM(CASE WHEN o.stage = 'Closed Won' THEN o.amount ELSE 0 END)::decimal as total_revenue,
          COUNT(CASE WHEN o.stage = 'Closed Won' THEN 1 END)::int as total_deals,
          COUNT(CASE WHEN o.stage IN ('Closed Won', 'Closed Lost') THEN 1 END)::int as total_closed,
          SUM(CASE WHEN o.stage NOT IN ('Closed Won', 'Closed Lost', 'Cancelled') THEN o.weighted_amount ELSE 0 END)::decimal as pipeline_value
        FROM opportunities o
        WHERE o.tenant_id = ${userContext.tenantId}
          ${dateFilter}
      ),
      quota_metrics AS (
        SELECT
          SUM(q.quota_amount)::decimal as total_quota
        FROM sales_quotas q
        WHERE q.tenant_id = ${userContext.tenantId}
      ),
      regional_performance AS (
        SELECT
          r.id as region_id,
          r.name as region_name,
          SUM(CASE WHEN o.stage = 'Closed Won' THEN o.amount ELSE 0 END)::decimal as revenue,
          COUNT(CASE WHEN o.stage = 'Closed Won' THEN 1 END)::int as deals,
          COUNT(CASE WHEN o.stage IN ('Closed Won', 'Closed Lost') THEN 1 END)::int as closed,
          SUM(q.quota_amount)::decimal as quota
        FROM regions r
        LEFT JOIN locations l ON l.region_id = r.id
        LEFT JOIN users u ON u.primary_location_id = l.id
        LEFT JOIN opportunities o ON o.owner_id = u.id
          AND o.tenant_id = ${userContext.tenantId}
          ${dateFilter}
        LEFT JOIN sales_quotas q ON q.user_id = u.id
          AND q.tenant_id = ${userContext.tenantId}
        WHERE r.tenant_id = ${userContext.tenantId}
        GROUP BY r.id, r.name
      ),
      top_performers AS (
        SELECT
          u.id as user_id,
          u.name as user_name,
          SUM(CASE WHEN o.stage = 'Closed Won' THEN o.amount ELSE 0 END)::decimal as revenue,
          COUNT(CASE WHEN o.stage = 'Closed Won' THEN 1 END)::int as deals
        FROM users u
        LEFT JOIN opportunities o ON o.owner_id = u.id
          AND o.tenant_id = ${userContext.tenantId}
          ${dateFilter}
        WHERE u.tenant_id = ${userContext.tenantId}
        GROUP BY u.id, u.name
        ORDER BY revenue DESC
        LIMIT 10
      )
      SELECT
        cm.total_revenue,
        cm.total_deals,
        cm.total_closed,
        cm.pipeline_value,
        qm.total_quota,
        (SELECT json_agg(json_build_object(
          'regionId', rp.region_id,
          'regionName', rp.region_name,
          'revenue', rp.revenue,
          'deals', rp.deals,
          'winRate', CASE WHEN rp.closed > 0 THEN (rp.deals::decimal / rp.closed::decimal * 100) ELSE 0 END,
          'quotaAttainment', CASE WHEN rp.quota > 0 THEN (rp.revenue / rp.quota * 100) ELSE 0 END
        )) FROM regional_performance rp) as regions,
        (SELECT json_agg(json_build_object(
          'userId', tp.user_id,
          'userName', tp.user_name,
          'revenue', tp.revenue,
          'deals', tp.deals
        )) FROM top_performers tp) as top_performers
      FROM company_metrics cm, quota_metrics qm
    `);

    const row: any = result.rows[0] || {};
    const totalRevenue = parseFloat(row.total_revenue || 0);
    const totalDeals = parseInt(row.total_deals || 0);
    const totalClosed = parseInt(row.total_closed || 0);
    const totalQuota = parseFloat(row.total_quota || 0);

    const response: CompanySalesPerformance = {
      totalRevenue,
      totalDeals,
      averageWinRate: totalClosed > 0 ? Math.round((totalDeals / totalClosed) * 100 * 100) / 100 : 0,
      averageDealSize: totalDeals > 0 ? Math.round((totalRevenue / totalDeals) * 100) / 100 : 0,
      quotaAttainment: totalQuota > 0 ? Math.round((totalRevenue / totalQuota) * 100 * 100) / 100 : 0,
      pipelineValue: parseFloat(row.pipeline_value || 0),
      regions: row.regions || [],
      topPerformers: row.top_performers || [],
      forecast: {
        currentQuarter: totalRevenue,
        nextQuarter: parseFloat(row.pipeline_value || 0) * 0.3,
        yearEnd: totalRevenue * 1.5,
      },
    };

    ReportCache.set(cacheKey, response);
    return response;
  }

  /**
   * Company-Wide Service Performance (Level 5 & 6)
   */
  static async getCompanyServicePerformance(
    userContext: EnhancedUserContext,
    dateRange?: Partial<DateRange>
  ): Promise<CompanyServicePerformance> {
    const cacheKey = `company-service-performance:${userContext.tenantId}:${JSON.stringify(dateRange)}`;
    const cached = ReportCache.get<CompanyServicePerformance>(cacheKey);
    if (cached) return cached;

    const dateFilter = dateRange?.dateFrom && dateRange?.dateTo
      ? sql`AND sc.created_at BETWEEN ${dateRange.dateFrom.toISOString()} AND ${dateRange.dateTo.toISOString()}`
      : sql``;

    const result = await db.execute(sql`
      WITH company_metrics AS (
        SELECT
          COUNT(sc.id)::int as total_calls,
          AVG(CASE WHEN sc.first_time_fix = true THEN 100 ELSE 0 END)::decimal as avg_ftf,
          AVG(CASE WHEN sc.sla_status = 'on_time' THEN 100 ELSE 0 END)::decimal as avg_sla,
          AVG(sc.satisfaction_rating)::decimal as avg_satisfaction,
          COUNT(DISTINCT u.id)::int as total_technicians,
          AVG(te.hours / 40 * 100)::decimal as avg_utilization
        FROM service_calls sc
        LEFT JOIN users u ON sc.technician_id = u.id
        LEFT JOIN time_entries te ON te.user_id = u.id
          AND te.tenant_id = ${userContext.tenantId}
          ${dateFilter}
        WHERE sc.tenant_id = ${userContext.tenantId}
          ${dateFilter}
      ),
      regional_performance AS (
        SELECT
          r.id as region_id,
          r.name as region_name,
          COUNT(sc.id)::int as calls,
          AVG(CASE WHEN sc.first_time_fix = true THEN 100 ELSE 0 END)::decimal as ftf_rate,
          AVG(CASE WHEN sc.sla_status = 'on_time' THEN 100 ELSE 0 END)::decimal as sla_compliance,
          COUNT(DISTINCT u.id)::int as technicians
        FROM regions r
        LEFT JOIN locations l ON l.region_id = r.id
        LEFT JOIN users u ON u.primary_location_id = l.id
        LEFT JOIN service_calls sc ON sc.technician_id = u.id
          AND sc.tenant_id = ${userContext.tenantId}
          ${dateFilter}
        WHERE r.tenant_id = ${userContext.tenantId}
        GROUP BY r.id, r.name
      ),
      top_performers AS (
        SELECT
          u.id as user_id,
          u.name as user_name,
          AVG(CASE WHEN sc.first_time_fix = true THEN 100 ELSE 0 END)::decimal as ftf_rate,
          AVG(sc.satisfaction_rating)::decimal as satisfaction
        FROM users u
        LEFT JOIN service_calls sc ON sc.technician_id = u.id
          AND sc.tenant_id = ${userContext.tenantId}
          ${dateFilter}
        WHERE u.tenant_id = ${userContext.tenantId}
        GROUP BY u.id, u.name
        ORDER BY ftf_rate DESC, satisfaction DESC
        LIMIT 10
      )
      SELECT
        cm.*,
        (SELECT json_agg(json_build_object(
          'regionId', rp.region_id,
          'regionName', rp.region_name,
          'calls', rp.calls,
          'ftfRate', rp.ftf_rate,
          'slaCompliance', rp.sla_compliance,
          'technicians', rp.technicians
        )) FROM regional_performance rp) as regions,
        (SELECT json_agg(json_build_object(
          'userId', tp.user_id,
          'userName', tp.user_name,
          'ftfRate', tp.ftf_rate,
          'satisfaction', tp.satisfaction
        )) FROM top_performers tp) as top_performers
      FROM company_metrics cm
    `);

    const row: any = result.rows[0] || {};

    const response: CompanyServicePerformance = {
      totalCalls: parseInt(row.total_calls || 0),
      avgFirstTimeFixRate: parseFloat(row.avg_ftf || 0),
      avgSlaCompliance: parseFloat(row.avg_sla || 0),
      avgCustomerSatisfaction: parseFloat(row.avg_satisfaction || 0),
      totalTechnicians: parseInt(row.total_technicians || 0),
      avgUtilization: parseFloat(row.avg_utilization || 0),
      regions: row.regions || [],
      topPerformers: row.top_performers || [],
      trends: {
        callVolumeChange: 0, // Would calculate from historical data
        ftfRateChange: 0,
        slaComplianceChange: 0,
      },
    };

    ReportCache.set(cacheKey, response);
    return response;
  }

  /**
   * Clear cache for director reports
   */
  static clearCache(): void {
    ReportCache.clear('company-sales');
    ReportCache.clear('company-service');
  }
}
