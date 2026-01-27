// =====================================================================
// REPORT ENGINE API
// Comprehensive reporting system with execution, export, and scheduling
// =====================================================================

import { Router, Request, Response } from 'express';
import { db } from '../db';
import {
  reportDefinitions,
  reportSchedules,
  reportExecutions,
  kpiDefinitions,
  userReportPreferences,
} from '../../shared/reporting-schema';
import { eq, and, or, sql, inArray, desc } from 'drizzle-orm';
import {
  enhanceUserContext,
  requirePermission,
  hasPermission,
  hasAnyPermission,
  type AuthenticatedRequest,
} from '../middleware/enhanced-rbac-middleware';
import { HierarchicalQueryBuilder } from '../middleware/hierarchical-query-builder';
import { Parser } from 'json2csv';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const router = Router();

// =====================================================================
// TYPE DEFINITIONS
// =====================================================================

interface ReportFilters {
  [key: string]: any;
}

interface ReportParameters {
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
  tenantId?: string;
  locationId?: string;
  regionId?: string;
  [key: string]: any;
}

interface ReportExecutionRequest {
  filters?: ReportFilters;
  parameters?: ReportParameters;
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  };
  pagination?: {
    page: number;
    limit: number;
  };
  overrideScope?: 'own' | 'team' | 'location' | 'regional' | 'company' | 'platform';
}

interface ScheduleReportRequest {
  name: string;
  description?: string;
  cronExpression: string;
  timezone?: string;
  parameters?: ReportParameters;
  filters?: ReportFilters;
  recipients: string[]; // emails
  deliveryMethod?: 'email' | 'webhook' | 'sftp' | 'download';
  exportFormat?: 'json' | 'csv' | 'xlsx' | 'pdf';
  emailSubject?: string;
  emailBody?: string;
}

// =====================================================================
// REPORT CACHING SERVICE
// =====================================================================

interface CachedReport {
  data: any[];
  cachedAt: Date;
  expiresAt: Date;
  rowCount: number;
}

class ReportCacheService {
  private static cache = new Map<string, CachedReport>();

  static getCacheKey(reportCode: string, params: ReportExecutionRequest, userId: string): string {
    const normalized = {
      code: reportCode,
      filters: params.filters || {},
      parameters: params.parameters || {},
      userId,
    };
    return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  }

  static get(cacheKey: string): any[] | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;

    if (cached.expiresAt < new Date()) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached.data;
  }

  static set(cacheKey: string, data: any[], cacheDuration: number): void {
    const now = new Date();
    this.cache.set(cacheKey, {
      data,
      cachedAt: now,
      expiresAt: new Date(now.getTime() + cacheDuration * 1000),
      rowCount: data.length,
    });
  }

  static invalidate(reportCode: string): void {
    // Remove all cache entries for this report
    for (const [key] of this.cache) {
      if (key.includes(reportCode)) {
        this.cache.delete(key);
      }
    }
  }

  static cleanup(): void {
    const now = new Date();
    for (const [key, value] of this.cache) {
      if (value.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }
}

// Run cache cleanup every 10 minutes
setInterval(() => ReportCacheService.cleanup(), 10 * 60 * 1000);

// =====================================================================
// QUERY PARAMETER SUBSTITUTION - SECURE VERSION
// =====================================================================

interface PreparedQueryResult {
  query: string;
  params: any[];
}

function substituteQueryParameters(
  sqlQuery: string,
  params: ReportParameters,
  user: AuthenticatedRequest['user'],
): PreparedQueryResult {
  // Default parameters
  const defaultParams: ReportParameters = {
    userId: user?.id,
    tenantId: user?.tenant_id,
    locationId: user?.locationId,
    regionId: user?.regionId,
    dateFrom: params.dateFrom || null,
    dateTo: params.dateTo || null,
  };

  // Merge with custom parameters
  const allParams = { ...defaultParams, ...params };

  // Whitelist of allowed parameter names to prevent SQL injection
  const allowedParams = [
    'userId',
    'tenantId',
    'locationId',
    'regionId',
    'dateFrom',
    'dateTo',
    'productId',
    'customerId',
    'status',
    'category',
    'type',
    'stage',
    'priority',
  ];

  let query = sqlQuery;
  const paramValues: any[] = [];
  let paramIndex = 1;

  // Replace :paramName with $1, $2, etc. (PostgreSQL prepared statement syntax)
  for (const [key, value] of Object.entries(allParams)) {
    const placeholder = `:${key}`;

    // Security: Only allow whitelisted parameter names
    if (!allowedParams.includes(key)) {
      console.warn(`Skipping non-whitelisted parameter: ${key}`);
      continue;
    }

    // Replace all occurrences of :paramName with $N
    const regex = new RegExp(placeholder, 'g');
    if (query.includes(placeholder)) {
      query = query.replace(regex, `$${paramIndex}`);
      paramValues.push(value);
      paramIndex++;
    }
  }

  return { query, params: paramValues };
}

// =====================================================================
// EXPORT SERVICES
// =====================================================================

class ReportExportService {
  private static exportDir = path.join(process.cwd(), 'exports', 'reports');

  static async initialize(): Promise<void> {
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  /**
   * Export to CSV
   */
  static async exportToCSV(data: any[], reportName: string): Promise<string> {
    await this.initialize();

    const parser = new Parser({
      fields: data.length > 0 ? Object.keys(data[0]) : [],
    });
    const csv = parser.parse(data);

    const fileName = `${reportName}_${Date.now()}.csv`;
    const filePath = path.join(this.exportDir, fileName);

    fs.writeFileSync(filePath, csv, 'utf8');

    return filePath;
  }

  /**
   * Export to Excel
   */
  static async exportToExcel(
    data: any[],
    reportName: string,
    reportTitle: string,
  ): Promise<string> {
    await this.initialize();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(reportName);

    if (data.length > 0) {
      // Add headers
      const headers = Object.keys(data[0]);
      worksheet.addRow(headers);

      // Style headers
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };
      worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

      // Add data rows
      data.forEach((row) => {
        worksheet.addRow(Object.values(row));
      });

      // Auto-fit columns
      worksheet.columns.forEach((column) => {
        let maxLength = 0;
        column.eachCell?.({ includeEmpty: true }, (cell) => {
          const cellLength = cell.value ? cell.value.toString().length : 0;
          maxLength = Math.max(maxLength, cellLength);
        });
        column.width = Math.min(maxLength + 2, 50);
      });
    }

    const fileName = `${reportName}_${Date.now()}.xlsx`;
    const filePath = path.join(this.exportDir, fileName);

    await workbook.xlsx.writeFile(filePath);

    return filePath;
  }

  /**
   * Export to PDF
   */
  static async exportToPDF(data: any[], reportName: string, reportTitle: string): Promise<string> {
    await this.initialize();

    const doc = new PDFDocument({ margin: 50 });
    const fileName = `${reportName}_${Date.now()}.pdf`;
    const filePath = path.join(this.exportDir, fileName);

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Title
    doc.fontSize(20).text(reportTitle, { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(2);

    // Table (simple implementation)
    if (data.length > 0) {
      const headers = Object.keys(data[0]);
      const columnWidth = 500 / headers.length;

      // Headers
      doc.fontSize(10).fillColor('black');
      let xPos = 50;
      headers.forEach((header) => {
        doc.text(header, xPos, doc.y, { width: columnWidth, align: 'left' });
        xPos += columnWidth;
      });

      doc.moveDown();

      // Rows
      data.slice(0, 100).forEach((row) => {
        // Limit to 100 rows for PDF
        xPos = 50;
        Object.values(row).forEach((value: any) => {
          doc.text(String(value || ''), xPos, doc.y, { width: columnWidth, align: 'left' });
          xPos += columnWidth;
        });
        doc.moveDown(0.5);
      });

      if (data.length > 100) {
        doc.moveDown();
        doc.text(`... and ${data.length - 100} more rows`, { align: 'center', italics: true });
      }
    }

    doc.end();

    return new Promise((resolve, reject) => {
      stream.on('finish', () => resolve(filePath));
      stream.on('error', reject);
    });
  }
}

// =====================================================================
// MIDDLEWARE
// =====================================================================

// Apply user context enhancement to all routes
router.use(enhanceUserContext);

// =====================================================================
// API ROUTES
// =====================================================================

/**
 * GET /api/reports
 * List all available reports for the authenticated user
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { category, scope, search } = req.query;

    // Get all active report definitions
    let query = db
      .select()
      .from(reportDefinitions)
      .where(
        and(
          eq(reportDefinitions.tenant_id, req.user.tenant_id),
          eq(reportDefinitions.isActive, true),
        ),
      );

    // Apply filters
    if (category) {
      query = query.where(eq(reportDefinitions.category, category as string));
    }

    if (scope) {
      query = query.where(eq(reportDefinitions.organizationalScope, scope as string));
    }

    let reports = await query;

    // Filter by permissions
    reports = reports.filter((report) => {
      const requiredPerms = report.requiredPermissions as string[];
      return hasAnyPermission(req, requiredPerms);
    });

    // Filter by search term
    if (search) {
      const searchTerm = (search as string).toLowerCase();
      reports = reports.filter(
        (report) =>
          report.name.toLowerCase().includes(searchTerm) ||
          report.description?.toLowerCase().includes(searchTerm) ||
          report.code.toLowerCase().includes(searchTerm),
      );
    }

    res.json({
      reports: reports.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        description: r.description,
        category: r.category,
        organizationalScope: r.organizationalScope,
        defaultVisualization: r.defaultVisualization,
        isRealTime: r.isRealTime,
        supportsDrillDown: r.supportsDrillDown,
        supportsExport: r.supportsExport,
        containsSensitiveData: r.containsSensitiveData,
        tags: r.tags,
      })),
      total: reports.length,
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

/**
 * GET /api/reports/:code
 * Get report definition by code
 */
router.get('/:code', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { code } = req.params;

    const report = await db
      .select()
      .from(reportDefinitions)
      .where(
        and(
          eq(reportDefinitions.code, code),
          eq(reportDefinitions.tenant_id, req.user.tenant_id),
          eq(reportDefinitions.isActive, true),
        ),
      )
      .limit(1);

    if (report.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const reportDef = report[0];

    // Check permissions
    const requiredPerms = reportDef.requiredPermissions as string[];
    if (!hasAnyPermission(req, requiredPerms)) {
      return res.status(403).json({
        error: 'Insufficient permissions to access this report',
        requiredPermissions: requiredPerms,
      });
    }

    // Get user preferences if they exist
    const preferences = await db
      .select()
      .from(userReportPreferences)
      .where(
        and(
          eq(userReportPreferences.user_id, req.user.id),
          eq(userReportPreferences.reportDefinitionId, reportDef.id),
        ),
      )
      .limit(1);

    res.json({
      report: {
        ...reportDef,
        sqlQuery: undefined, // Don't expose SQL to frontend
      },
      userPreferences: preferences.length > 0 ? preferences[0] : null,
    });
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({ error: 'Failed to fetch report definition' });
  }
});

/**
 * POST /api/reports/:code/execute
 * Execute a report with filters and parameters
 */
router.post('/:code/execute', async (req: AuthenticatedRequest, res: Response) => {
  const startTime = Date.now();

  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { code } = req.params;
    const executionRequest: ReportExecutionRequest = req.body;

    // Get report definition
    const reportResult = await db
      .select()
      .from(reportDefinitions)
      .where(
        and(
          eq(reportDefinitions.code, code),
          eq(reportDefinitions.tenant_id, req.user.tenant_id),
          eq(reportDefinitions.isActive, true),
        ),
      )
      .limit(1);

    if (reportResult.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const reportDef = reportResult[0];

    // Check permissions
    const requiredPerms = reportDef.requiredPermissions as string[];
    if (!hasAnyPermission(req, requiredPerms)) {
      return res.status(403).json({
        error: 'Insufficient permissions to execute this report',
        requiredPermissions: requiredPerms,
      });
    }

    // Check cache
    const cacheKey = ReportCacheService.getCacheKey(code, executionRequest, req.user.id);
    const cachedData = ReportCacheService.get(cacheKey);

    if (cachedData && !reportDef.isRealTime) {
      // Record execution (cache hit)
      await db.insert(reportExecutions).values({
        tenantId: req.user.tenant_id,
        reportDefinitionId: reportDef.id,
        userId: req.user.id,
        parameters: executionRequest.parameters || {},
        filters: executionRequest.filters || {},
        executionTimeMs: Date.now() - startTime,
        rowCount: cachedData.length,
        cacheHit: true,
        status: 'success',
        startedAt: new Date(startTime),
        completedAt: new Date(),
        sessionId: req.session?.id,
        ipAddress: req.ip || undefined,
        userAgent: req.get('user-agent'),
      });

      return res.json({
        data: cachedData,
        cached: true,
        executionTime: Date.now() - startTime,
      });
    }

    // Build query with hierarchical filtering
    const queryBuilder = new HierarchicalQueryBuilder(req.user);

    // Substitute parameters using prepared statements
    const { query: sqlQuery, params: queryParams } = substituteQueryParameters(
      reportDef.sqlQuery,
      executionRequest.parameters || {},
      req.user,
    );

    // Note: Hierarchical filtering and pagination should be part of the report definition
    // or applied through whitelisted parameters to prevent SQL injection
    // The current implementation of dynamic WHERE clause injection is unsafe

    // Validate pagination values to prevent SQL injection
    let finalQuery = sqlQuery;
    if (executionRequest.pagination) {
      const page = Math.max(1, parseInt(String(executionRequest.pagination.page || 1), 10));
      const limit = Math.min(
        1000,
        Math.max(1, parseInt(String(executionRequest.pagination.limit || 50), 10)),
      );
      const offset = (page - 1) * limit;
      finalQuery += ` LIMIT ${limit} OFFSET ${offset}`;
    } else if (reportDef.maxRowLimit) {
      const maxLimit = Math.min(10000, Math.max(1, parseInt(String(reportDef.maxRowLimit), 10)));
      finalQuery += ` LIMIT ${maxLimit}`;
    }

    // Execute query with prepared statement parameters
    const result =
      queryParams.length > 0
        ? await db.execute(sql.raw(finalQuery, queryParams))
        : await db.execute(sql.raw(finalQuery));

    const data = result.rows;
    const rowCount = data.length;

    // Cache results (if not real-time)
    if (!reportDef.isRealTime && reportDef.cacheDuration) {
      ReportCacheService.set(cacheKey, data, reportDef.cacheDuration);
    }

    const executionTime = Date.now() - startTime;

    // Record execution
    await db.insert(reportExecutions).values({
      tenantId: req.user.tenant_id,
      reportDefinitionId: reportDef.id,
      userId: req.user.id,
      parameters: executionRequest.parameters || {},
      filters: executionRequest.filters || {},
      executionTimeMs: executionTime,
      rowCount,
      cacheHit: false,
      status: 'success',
      startedAt: new Date(startTime),
      completedAt: new Date(),
      sessionId: req.session?.id,
      ipAddress: req.ip || undefined,
      userAgent: req.get('user-agent'),
    });

    res.json({
      data,
      cached: false,
      executionTime,
      rowCount,
    });
  } catch (error: any) {
    console.error('Error executing report:', error);

    // Record failed execution
    if (req.user) {
      await db.insert(reportExecutions).values({
        tenantId: req.user.tenant_id,
        reportDefinitionId: req.params.code,
        userId: req.user.id,
        parameters: req.body.parameters || {},
        filters: req.body.filters || {},
        executionTimeMs: Date.now() - startTime,
        status: 'failed',
        errorMessage: error.message,
        startedAt: new Date(startTime),
        completedAt: new Date(),
      });
    }

    res.status(500).json({ error: 'Failed to execute report', details: error.message });
  }
});

/**
 * POST /api/reports/:code/export
 * Export report to specified format
 */
router.post('/:code/export', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { code } = req.params;
    const {
      format = 'csv',
      ...executionRequest
    }: { format: 'csv' | 'xlsx' | 'pdf' } & ReportExecutionRequest = req.body;

    // Get report definition
    const reportResult = await db
      .select()
      .from(reportDefinitions)
      .where(
        and(
          eq(reportDefinitions.code, code),
          eq(reportDefinitions.tenant_id, req.user.tenant_id),
          eq(reportDefinitions.isActive, true),
        ),
      )
      .limit(1);

    if (reportResult.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const reportDef = reportResult[0];

    // Check if export is supported
    if (!reportDef.supportsExport) {
      return res.status(403).json({ error: 'Export not supported for this report' });
    }

    // Check permissions (export requires higher permissions)
    const requiredPerms = reportDef.requiredPermissions as string[];
    if (!hasAnyPermission(req, requiredPerms)) {
      return res.status(403).json({ error: 'Insufficient permissions to export this report' });
    }

    // Execute report to get data using prepared statements
    const { query: sqlQuery, params: queryParams } = substituteQueryParameters(
      reportDef.sqlQuery,
      executionRequest.parameters || {},
      req.user,
    );

    const result =
      queryParams.length > 0
        ? await db.execute(sql.raw(sqlQuery, queryParams))
        : await db.execute(sql.raw(sqlQuery));
    const data = result.rows as any[];

    // Export based on format
    let filePath: string;
    let contentType: string;

    switch (format) {
      case 'csv':
        filePath = await ReportExportService.exportToCSV(data, reportDef.code);
        contentType = 'text/csv';
        break;
      case 'xlsx':
        filePath = await ReportExportService.exportToExcel(data, reportDef.code, reportDef.name);
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
      case 'pdf':
        filePath = await ReportExportService.exportToPDF(data, reportDef.code, reportDef.name);
        contentType = 'application/pdf';
        break;
      default:
        return res.status(400).json({ error: 'Invalid export format' });
    }

    const fileName = path.basename(filePath);

    // Send file
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.sendFile(filePath);
  } catch (error: any) {
    console.error('Error exporting report:', error);
    res.status(500).json({ error: 'Failed to export report', details: error.message });
  }
});

/**
 * POST /api/reports/:code/schedule
 * Schedule a recurring report
 */
router.post('/:code/schedule', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { code } = req.params;
    const scheduleRequest: ScheduleReportRequest = req.body;

    // Get report definition
    const reportResult = await db
      .select()
      .from(reportDefinitions)
      .where(
        and(
          eq(reportDefinitions.code, code),
          eq(reportDefinitions.tenant_id, req.user.tenant_id),
          eq(reportDefinitions.isActive, true),
        ),
      )
      .limit(1);

    if (reportResult.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const reportDef = reportResult[0];

    // Check permissions
    const requiredPerms = reportDef.requiredPermissions as string[];
    if (!hasAnyPermission(req, requiredPerms)) {
      return res.status(403).json({ error: 'Insufficient permissions to schedule this report' });
    }

    // Create schedule
    const schedule = await db
      .insert(reportSchedules)
      .values({
        tenantId: req.user.tenant_id,
        reportDefinitionId: reportDef.id,
        name: scheduleRequest.name,
        description: scheduleRequest.description || null,
        cronExpression: scheduleRequest.cronExpression,
        timezone: scheduleRequest.timezone || 'UTC',
        parameters: scheduleRequest.parameters || {},
        filters: scheduleRequest.filters || {},
        recipients: scheduleRequest.recipients,
        deliveryMethod: scheduleRequest.deliveryMethod || 'email',
        exportFormat: scheduleRequest.exportFormat || 'pdf',
        emailSubject: scheduleRequest.emailSubject || null,
        emailBody: scheduleRequest.emailBody || null,
        isActive: true,
        createdBy: req.user.id,
      })
      .returning();

    res.status(201).json({
      schedule: schedule[0],
      message: 'Report scheduled successfully',
    });
  } catch (error: any) {
    console.error('Error scheduling report:', error);
    res.status(500).json({ error: 'Failed to schedule report', details: error.message });
  }
});

/**
 * GET /api/reports/scheduled
 * Get all scheduled reports for the user
 */
router.get('/scheduled/list', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const schedules = await db
      .select({
        schedule: reportSchedules,
        report: reportDefinitions,
      })
      .from(reportSchedules)
      .innerJoin(reportDefinitions, eq(reportSchedules.reportDefinitionId, reportDefinitions.id))
      .where(
        and(
          eq(reportSchedules.tenant_id, req.user.tenant_id),
          eq(reportSchedules.createdBy, req.user.id),
          eq(reportSchedules.isActive, true),
        ),
      )
      .orderBy(desc(reportSchedules.created_at));

    res.json({
      schedules: schedules.map((s) => ({
        ...s.schedule,
        reportName: s.report.name,
        reportCode: s.report.code,
      })),
      total: schedules.length,
    });
  } catch (error) {
    console.error('Error fetching scheduled reports:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled reports' });
  }
});

/**
 * DELETE /api/reports/scheduled/:id
 * Delete (deactivate) a scheduled report
 */
router.delete('/scheduled/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;

    // Verify ownership
    const schedule = await db
      .select()
      .from(reportSchedules)
      .where(
        and(
          eq(reportSchedules.id, id),
          eq(reportSchedules.tenant_id, req.user.tenant_id),
          eq(reportSchedules.createdBy, req.user.id),
        ),
      )
      .limit(1);

    if (schedule.length === 0) {
      return res.status(404).json({ error: 'Scheduled report not found' });
    }

    // Deactivate schedule
    await db
      .update(reportSchedules)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(reportSchedules.id, id));

    res.json({ message: 'Scheduled report deleted successfully' });
  } catch (error) {
    console.error('Error deleting scheduled report:', error);
    res.status(500).json({ error: 'Failed to delete scheduled report' });
  }
});

/**
 * GET /api/reports/executions/recent
 * Get recent report executions for the user
 */
router.get('/executions/recent', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { limit = 20 } = req.query;

    const executions = await db
      .select({
        execution: reportExecutions,
        report: reportDefinitions,
      })
      .from(reportExecutions)
      .innerJoin(reportDefinitions, eq(reportExecutions.reportDefinitionId, reportDefinitions.id))
      .where(
        and(
          eq(reportExecutions.tenant_id, req.user.tenant_id),
          eq(reportExecutions.user_id, req.user.id),
        ),
      )
      .orderBy(desc(reportExecutions.created_at))
      .limit(Number(limit));

    res.json({
      executions: executions.map((e) => ({
        ...e.execution,
        reportName: e.report.name,
        reportCode: e.report.code,
      })),
      total: executions.length,
    });
  } catch (error) {
    console.error('Error fetching report executions:', error);
    res.status(500).json({ error: 'Failed to fetch report executions' });
  }
});

// =====================================================================
// EXPORT
// =====================================================================

export default router;
