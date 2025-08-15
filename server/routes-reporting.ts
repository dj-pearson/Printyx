// =====================================================================
// COMPREHENSIVE REPORTING API ROUTES
// Phase 1 Implementation - Core Reporting Infrastructure
// =====================================================================

import express from 'express';
import { Request, Response } from 'express';
import { db } from './storage';
import { 
  reportDefinitions, 
  reportExecutions, 
  kpiDefinitions, 
  kpiValues,
  userReportActivity,
  userReportPreferences
} from '../shared/reporting-schema';
import { eq, and, desc, gte, lte, inArray, sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { 
  enhanceUserContext, 
  requireReportPermission, 
  HierarchicalQueryBuilder,
  AuthenticatedRequest 
} from './reporting-rbac-middleware';
import { reportingCache, reportCacheMiddleware } from './cache-service';
import { exportService } from './export-service';

const router = express.Router();

// Apply enhanced user context middleware to all reporting routes
router.use(enhanceUserContext);

// Removed - now imported from reporting-rbac-middleware.ts

// =====================================================================
// REPORTS CATALOG AND DISCOVERY
// =====================================================================

// GET /api/reports - List available reports based on user permissions
router.get('/reports', requireReportPermission('canViewReports'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { category, scope, search, page = 1, limit = 50 } = req.query;
    const user = req.user!;
    
    let query = db.select().from(reportDefinitions)
      .where(
        and(
          eq(reportDefinitions.tenantId, user.tenantId),
          eq(reportDefinitions.isActive, true)
        )
      );

    // Apply category filter
    if (category && typeof category === 'string') {
      query = query.where(eq(reportDefinitions.category, category as any));
    }

    // Apply scope filter based on user's access level
    if (scope && typeof scope === 'string') {
      query = query.where(eq(reportDefinitions.organizationalScope, scope as any));
    }

    // Apply search filter
    if (search && typeof search === 'string') {
      query = query.where(
        sql`${reportDefinitions.name} ILIKE ${`%${search}%`} OR ${reportDefinitions.description} ILIKE ${`%${search}%`}`
      );
    }

    // Apply pagination
    const offset = (Number(page) - 1) * Number(limit);
    const reports = await query.limit(Number(limit)).offset(offset);

    // Filter reports based on user permissions
    const filteredReports = reports.filter(report => {
      const requiredPerms = report.requiredPermissions as Record<string, boolean>;
      return Object.keys(requiredPerms).every(perm => user.permissions[perm]);
    });

    res.json({
      reports: filteredReports,
      total: filteredReports.length,
      page: Number(page),
      limit: Number(limit),
      user_permissions: Object.keys(user.permissions).filter(p => user.permissions[p]),
      available_scopes: [user.accessScope]
    });

  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// GET /api/reports/:id/data - Execute report and return data (with caching)
router.get('/reports/:id/data', 
  requireReportPermission('canViewReports'),
  reportCacheMiddleware(300), // 5 minute cache
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;
    const {
      from_date,
      to_date,
      period = 'monthly',
      location_ids,
      region_ids,
      user_ids,
      team_ids,
      group_by,
      sort_by,
      sort_direction = 'desc',
      page = 1,
      limit = 1000,
      export_format
    } = req.query;

    // Get report definition
    const reportDef = await db.select().from(reportDefinitions)
      .where(
        and(
          eq(reportDefinitions.id, id),
          eq(reportDefinitions.tenantId, user.tenantId),
          eq(reportDefinitions.isActive, true)
        )
      )
      .limit(1);

    if (reportDef.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = reportDef[0];

    // Check user permissions for this specific report
    const requiredPerms = report.requiredPermissions as Record<string, boolean>;
    const hasAccess = Object.keys(requiredPerms).every(perm => user.permissions[perm]);
    
    if (!hasAccess) {
      return res.status(403).json({ 
        error: 'Insufficient permissions for this report',
        required: Object.keys(requiredPerms),
        user_permissions: Object.keys(user.permissions).filter(p => user.permissions[p])
      });
    }

    // Build hierarchical query with user's access scope
    const queryBuilder = new HierarchicalQueryBuilder(user);
    
    // Start timing execution
    const startTime = Date.now();
    
    // Execute the report query with hierarchical filtering
    // This is a simplified example - in production, you'd parse and modify the SQL
    let reportData: any[] = [];
    
    try {
      // For now, return mock data structure - you'd implement actual SQL execution here
      reportData = await executeReportQuery(report.sqlQuery, {
        tenantId: user.tenantId,
        userAccessScope: user.accessScope,
        locationIds: user.locationIds,
        regionIds: user.regionIds,
        fromDate: from_date,
        toDate: to_date,
        period,
        // Add other parameters as needed
      });
    } catch (queryError) {
      console.error('Report execution error:', queryError);
      return res.status(500).json({ error: 'Failed to execute report query' });
    }

    const executionTime = Date.now() - startTime;

    // Log report execution for audit trail
    await db.insert(reportExecutions).values({
      tenantId: user.tenantId,
      reportDefinitionId: report.id,
      userId: user.id,
      parameters: {
        from_date,
        to_date,
        period,
        location_ids,
        region_ids,
        user_ids,
        team_ids,
        group_by
      },
      executionTimeMs: executionTime,
      rowCount: reportData.length,
      status: 'success',
      startedAt: new Date(startTime),
      completedAt: new Date(),
      sessionId: req.sessionID || '',
      ipAddress: req.ip || '',
      userAgent: req.get('User-Agent') || ''
    });

    // Log user activity
    await db.insert(userReportActivity).values({
      tenantId: user.tenantId,
      userId: user.id,
      activityType: 'view_report',
      reportDefinitionId: report.id,
      sessionId: req.sessionID || '',
      ipAddress: req.ip || '',
      userAgent: req.get('User-Agent') || '',
      parameters: { export_format, filters: { from_date, to_date, period } },
      loadTimeMs: executionTime
    });

    res.json({
      data: reportData,
      metadata: {
        total_rows: reportData.length,
        execution_time_ms: executionTime,
        cache_hit: false, // Will be overridden by cache middleware if cache hit
        data_freshness: new Date().toISOString(),
        available_drill_downs: report.supportsDrillDown ? ['location', 'user', 'team'] : [],
        report_name: report.name,
        report_category: report.category
      },
      summary_stats: calculateSummaryStats(reportData)
    });

  } catch (error) {
    console.error('Error executing report:', error);
    res.status(500).json({ error: 'Failed to execute report' });
  }
});

// =====================================================================
// KPI MANAGEMENT ENDPOINTS
// =====================================================================

// GET /api/kpis - Get KPIs for user's scope
router.get('/kpis', requireReportPermission('canViewKPIs'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const { category, scope, time_period = 'monthly' } = req.query;

    const queryBuilder = new HierarchicalQueryBuilder(user);
    
    // Get KPI definitions
    let kpiQuery = db.select().from(kpiDefinitions)
      .where(
        and(
          eq(kpiDefinitions.tenantId, user.tenantId),
          eq(kpiDefinitions.isActive, true)
        )
      );

    if (category && typeof category === 'string') {
      kpiQuery = kpiQuery.where(eq(kpiDefinitions.category, category as any));
    }

    const kpiDefs = await kpiQuery;

    // Filter KPIs based on user permissions
    const filteredKPIs = kpiDefs.filter(kpi => {
      const requiredPerms = kpi.requiredPermissions as Record<string, boolean>;
      return Object.keys(requiredPerms).every(perm => user.permissions[perm]);
    });

    // Get current values for each KPI
    const kpisWithValues = await Promise.all(
      filteredKPIs.map(async (kpi) => {
        // Get latest values for this KPI within user's scope
        let valueQuery = db.select().from(kpiValues)
          .where(
            and(
              eq(kpiValues.kpiDefinitionId, kpi.id),
              eq(kpiValues.timePeriod, time_period as any)
            )
          )
          .orderBy(desc(kpiValues.dateValue))
          .limit(1);

        // Apply hierarchical filtering to KPI values
        valueQuery = queryBuilder.applyHierarchicalFilter(valueQuery, 'kpi_values');

        const latestValue = await valueQuery;

        return {
          ...kpi,
          current_value: latestValue[0]?.actualValue || null,
          target_value: latestValue[0]?.targetValue || kpi.targetValue,
          performance_level: latestValue[0]?.performanceLevel || null,
          last_updated: latestValue[0]?.calculationTimestamp || null,
          variance_percentage: latestValue[0]?.variancePercentage || null
        };
      })
    );

    res.json({
      kpis: kpisWithValues,
      last_updated: new Date().toISOString(),
      user_scope: user.accessScope,
      available_categories: [...new Set(kpisWithValues.map(k => k.category))]
    });

  } catch (error) {
    console.error('Error fetching KPIs:', error);
    res.status(500).json({ error: 'Failed to fetch KPIs' });
  }
});

// GET /api/kpis/:id/historical - Get historical KPI data
router.get('/kpis/:id/historical', requireReportPermission('canViewKPIs'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;
    const {
      from_date,
      to_date,
      granularity = 'monthly',
      dimension
    } = req.query;

    const queryBuilder = new HierarchicalQueryBuilder(user);

    // Get historical KPI values
    let historicalQuery = db.select().from(kpiValues)
      .where(
        and(
          eq(kpiValues.kpiDefinitionId, id),
          eq(kpiValues.timePeriod, granularity as any),
          from_date ? gte(kpiValues.dateValue, from_date as string) : sql`1=1`,
          to_date ? lte(kpiValues.dateValue, to_date as string) : sql`1=1`
        )
      )
      .orderBy(desc(kpiValues.dateValue));

    // Apply hierarchical filtering
    historicalQuery = queryBuilder.applyHierarchicalFilter(historicalQuery, 'kpi_values');

    const historicalData = await historicalQuery;

    // Calculate trend analysis
    const trendAnalysis = calculateTrendAnalysis(historicalData);

    res.json({
      historical_data: historicalData,
      trend_analysis: trendAnalysis,
      summary: {
        total_periods: historicalData.length,
        average_value: historicalData.reduce((sum, val) => sum + (Number(val.actualValue) || 0), 0) / historicalData.length,
        best_performance: Math.max(...historicalData.map(val => Number(val.actualValue) || 0)),
        worst_performance: Math.min(...historicalData.map(val => Number(val.actualValue) || 0))
      }
    });

  } catch (error) {
    console.error('Error fetching KPI historical data:', error);
    res.status(500).json({ error: 'Failed to fetch KPI historical data' });
  }
});

// =====================================================================
// HELPER FUNCTIONS
// =====================================================================

// Mock report execution function - replace with actual implementation
async function executeReportQuery(sqlQuery: string, parameters: any): Promise<any[]> {
  // This is a placeholder - implement actual SQL execution with parameter substitution
  // and hierarchical access control injection
  console.log('Executing report query:', sqlQuery, 'with parameters:', parameters);
  
  // Return mock data for now
  return [
    { 
      id: '1', 
      name: 'Sample Report Data', 
      value: 1000, 
      date: '2025-01-01',
      location: 'Location 1',
      category: 'sales'
    },
    { 
      id: '2', 
      name: 'Sample Report Data 2', 
      value: 1500, 
      date: '2025-01-02',
      location: 'Location 2',
      category: 'sales'
    }
  ];
}

// Calculate summary statistics for report data
function calculateSummaryStats(data: any[]): Record<string, number> {
  if (data.length === 0) return {};

  const numericFields = Object.keys(data[0]).filter(key => 
    typeof data[0][key] === 'number'
  );

  const stats: Record<string, number> = {};
  
  numericFields.forEach(field => {
    const values = data.map(row => row[field]).filter(val => typeof val === 'number');
    if (values.length > 0) {
      stats[`${field}_total`] = values.reduce((sum, val) => sum + val, 0);
      stats[`${field}_average`] = stats[`${field}_total`] / values.length;
      stats[`${field}_min`] = Math.min(...values);
      stats[`${field}_max`] = Math.max(...values);
    }
  });

  return stats;
}

// Calculate trend analysis for KPI historical data
function calculateTrendAnalysis(data: any[]): any {
  if (data.length < 2) {
    return {
      direction: 'stable',
      percentage_change: 0,
      confidence_level: 0
    };
  }

  const latest = Number(data[0]?.actualValue) || 0;
  const previous = Number(data[1]?.actualValue) || 0;
  
  const percentageChange = previous !== 0 ? ((latest - previous) / previous) * 100 : 0;
  
  return {
    direction: percentageChange > 5 ? 'up' : percentageChange < -5 ? 'down' : 'stable',
    percentage_change: percentageChange,
    confidence_level: data.length >= 5 ? 85 : data.length >= 3 ? 65 : 30
  };
}

// =====================================================================
// EXPORT ENDPOINTS
// =====================================================================

// POST /api/reporting/reports/export - Export report data
router.post('/reports/export', 
  requireReportPermission('canExportReports'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const { report_id, parameters, format, email_recipients, filename } = req.body;

      // Validate input
      if (!report_id || !format) {
        return res.status(400).json({ 
          error: 'Missing required fields: report_id and format' 
        });
      }

      if (!['csv', 'xlsx', 'pdf'].includes(format)) {
        return res.status(400).json({ 
          error: 'Invalid format. Supported formats: csv, xlsx, pdf' 
        });
      }

      // Check if user has access to this report
      const reportDef = await db.select().from(reportDefinitions)
        .where(
          and(
            eq(reportDefinitions.id, report_id),
            eq(reportDefinitions.tenantId, user.tenantId),
            eq(reportDefinitions.isActive, true)
          )
        )
        .limit(1);

      if (reportDef.length === 0) {
        return res.status(404).json({ error: 'Report not found' });
      }

      const report = reportDef[0];

      // Check permissions for this specific report
      const requiredPerms = report.requiredPermissions as Record<string, boolean>;
      const hasAccess = Object.keys(requiredPerms).every(perm => user.permissions[perm]);
      
      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'Insufficient permissions for this report' 
        });
      }

      // Check if report supports export
      if (!report.supportsExport) {
        return res.status(400).json({ 
          error: 'This report does not support export functionality' 
        });
      }

      // Initiate export
      const exportResult = await exportService.exportReport(
        user.tenantId,
        user.id,
        {
          report_id,
          parameters: parameters || {},
          format,
          email_recipients,
          filename
        }
      );

      // Log export activity
      await db.insert(userReportActivity).values({
        tenantId: user.tenantId,
        userId: user.id,
        activityType: 'export_report',
        reportDefinitionId: report_id,
        sessionId: req.sessionID || '',
        ipAddress: req.ip || '',
        userAgent: req.get('User-Agent') || '',
        parameters: { format, filename }
      });

      res.json(exportResult);

    } catch (error) {
      console.error('Error exporting report:', error);
      res.status(500).json({ error: 'Failed to export report' });
    }
  }
);

// GET /api/reporting/exports/:exportId/download - Download exported file
router.get('/exports/:exportId/download', 
  requireReportPermission('canExportReports'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { exportId } = req.params;
      const user = req.user!;

      // Get export file
      const exportFile = await exportService.getExportFile(exportId);
      
      if (!exportFile) {
        return res.status(404).json({ error: 'Export file not found or expired' });
      }

      // Set appropriate headers
      const contentType = getContentType(exportFile.filename);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${exportFile.filename}"`);

      // Stream the file
      const fs = require('fs');
      const stream = fs.createReadStream(exportFile.filePath);
      
      stream.on('error', (error: any) => {
        console.error('Error streaming export file:', error);
        res.status(500).json({ error: 'Failed to download file' });
      });

      stream.pipe(res);

    } catch (error) {
      console.error('Error downloading export:', error);
      res.status(500).json({ error: 'Failed to download export' });
    }
  }
);

// GET /api/reporting/exports/stats - Get export statistics
router.get('/exports/stats',
  requireReportPermission('canViewReports'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const stats = await exportService.getExportStats();
      res.json(stats);
    } catch (error) {
      console.error('Error getting export stats:', error);
      res.status(500).json({ error: 'Failed to get export statistics' });
    }
  }
);

// =====================================================================
// DASHBOARD SUMMARY ENDPOINTS
// =====================================================================

// GET /api/reporting/dashboard/summary - Get dashboard summary for user
router.get('/dashboard/summary',
  requireReportPermission('canViewReports'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const { category } = req.query;

      // Get user's available reports
      const reportsQuery = db.select().from(reportDefinitions)
        .where(
          and(
            eq(reportDefinitions.tenantId, user.tenantId),
            eq(reportDefinitions.isActive, true)
          )
        );

      const reports = await reportsQuery;

      // Filter reports based on user permissions
      const availableReports = reports.filter(report => {
        const requiredPerms = report.requiredPermissions as Record<string, boolean>;
        return Object.keys(requiredPerms).every(perm => user.permissions[perm]);
      });

      // Get KPIs
      const kpisQuery = db.select().from(kpiDefinitions)
        .where(
          and(
            eq(kpiDefinitions.tenantId, user.tenantId),
            eq(kpiDefinitions.isActive, true)
          )
        );

      const kpis = await kpisQuery;

      // Filter KPIs based on user permissions
      const availableKpis = kpis.filter(kpi => {
        const requiredPerms = kpi.requiredPermissions as Record<string, boolean>;
        return Object.keys(requiredPerms).every(perm => user.permissions[perm]);
      });

      // Group reports by category
      const reportsByCategory = availableReports.reduce((acc, report) => {
        if (!acc[report.category]) {
          acc[report.category] = [];
        }
        acc[report.category].push(report);
        return acc;
      }, {} as Record<string, typeof availableReports>);

      // Recent activity (last 10 report views)
      const recentActivity = await db.select()
        .from(userReportActivity)
        .where(
          and(
            eq(userReportActivity.tenantId, user.tenantId),
            eq(userReportActivity.userId, user.id)
          )
        )
        .orderBy(desc(userReportActivity.createdAt))
        .limit(10);

      res.json({
        summary: {
          total_reports: availableReports.length,
          total_kpis: availableKpis.length,
          reports_by_category: Object.keys(reportsByCategory).map(category => ({
            category,
            count: reportsByCategory[category].length
          })),
          user_permissions: Object.keys(user.permissions).filter(p => user.permissions[p]),
          access_scope: user.accessScope
        },
        reports: availableReports,
        kpis: availableKpis,
        recent_activity: recentActivity
      });

    } catch (error) {
      console.error('Error getting dashboard summary:', error);
      res.status(500).json({ error: 'Failed to get dashboard summary' });
    }
  }
);

// =====================================================================
// HELPER FUNCTIONS
// =====================================================================

function getContentType(filename: string): string {
  const extension = filename.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'csv':
      return 'text/csv';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

export default router;
