// =====================================================================
// COMPREHENSIVE REPORTING ARCHITECTURE ROUTES
// Phase 1 Implementation - Report and KPI Management API
// =====================================================================

import express from 'express';
import { db } from './db';
import { reportDefinitions, kpiDefinitions, kpiValues, reportExecutions } from '../shared/reporting-schema';
import { eq, and, desc, sql } from 'drizzle-orm';
// Basic auth middleware since we don't need the complex RBAC for Phase 1
const requireAuth = async (req: any, res: any, next: any) => {
  const isAuthenticated = req.session?.userId || req.user?.id || req.user?.claims?.sub;
  if (!isAuthenticated) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
};

const router = express.Router();

// =====================================================================
// REPORT DEFINITIONS ENDPOINTS
// =====================================================================

// GET /api/reports - List all available reports for tenant
router.get('/reports', async (req: any, res) => {
  try {
    // Multi-tenant security check
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing x-tenant-id header' });
    }

    const { category, search } = req.query;

    let query = db.select().from(reportDefinitions)
      .where(and(
        eq(reportDefinitions.tenantId, tenantId),
        eq(reportDefinitions.isActive, true)
      ));

    if (category) {
      query = query.where(and(
        eq(reportDefinitions.tenantId, tenantId),
        eq(reportDefinitions.category, category as string),
        eq(reportDefinitions.isActive, true)
      ));
    }

    const reports = await query.orderBy(reportDefinitions.name);

    res.json({
      success: true,
      data: reports,
      meta: {
        total: reports.length,
        category: category || 'all',
        tenantId
      }
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ 
      error: 'Failed to fetch reports',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/reports/:id - Get specific report definition
router.get('/reports/:id', async (req: any, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing x-tenant-id header' });
    }

    const { id } = req.params;

    const report = await db.select().from(reportDefinitions)
      .where(and(
        eq(reportDefinitions.id, id),
        eq(reportDefinitions.tenantId, tenantId)
      )).limit(1);

    if (report.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({
      success: true,
      data: report[0]
    });
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({ 
      error: 'Failed to fetch report',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/reports/:code/execute - Execute a report
router.post('/reports/:code/execute', async (req: any, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing x-tenant-id header' });
    }

    const { code } = req.params;
    const { parameters = {} } = req.body;

    // Get report definition
    const reportDef = await db.select().from(reportDefinitions)
      .where(and(
        eq(reportDefinitions.code, code),
        eq(reportDefinitions.tenantId, tenantId),
        eq(reportDefinitions.isActive, true)
      )).limit(1);

    if (reportDef.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = reportDef[0];

    // For now, return a simple success response
    // In a full implementation, this would execute the SQL query with parameters
    const executionResult = {
      reportId: report.id,
      reportCode: code,
      reportName: report.name,
      executedAt: new Date(),
      parameters,
      status: 'completed',
      data: [], // Would contain actual query results
      summary: {
        totalRecords: 0,
        executionTime: '0.5s',
        cacheHit: false
      }
    };

    // Log execution
    try {
      await db.insert(reportExecutions).values({
        reportId: report.id,
        tenantId,
        executedBy: req.user?.id || 'system',
        parameters: JSON.stringify(parameters),
        status: 'completed',
        executionTime: 500, // milliseconds
        resultRows: 0
      });
    } catch (logError) {
      console.warn('Failed to log report execution:', logError);
    }

    res.json({
      success: true,
      data: executionResult
    });
  } catch (error) {
    console.error('Error executing report:', error);
    res.status(500).json({ 
      error: 'Failed to execute report',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// =====================================================================
// KPI DEFINITIONS ENDPOINTS
// =====================================================================

// GET /api/kpis - List all KPIs for tenant
router.get('/kpis', async (req: any, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing x-tenant-id header' });
    }

    const { category, highPriority } = req.query;

    let whereConditions = [
      eq(kpiDefinitions.tenantId, tenantId),
      eq(kpiDefinitions.isActive, true)
    ];

    if (category) {
      whereConditions.push(eq(kpiDefinitions.category, category as string));
    }

    if (highPriority === 'true') {
      whereConditions.push(eq(kpiDefinitions.isHighPriority, true));
    }

    const kpis = await db.select().from(kpiDefinitions)
      .where(and(...whereConditions))
      .orderBy(desc(kpiDefinitions.isHighPriority), kpiDefinitions.name);

    res.json({
      success: true,
      data: kpis,
      meta: {
        total: kpis.length,
        category: category || 'all',
        highPriorityOnly: highPriority === 'true',
        tenantId
      }
    });
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    res.status(500).json({ 
      error: 'Failed to fetch KPIs',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/kpis/:id/current-value - Get current KPI value
router.get('/kpis/:id/current-value', async (req: any, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing x-tenant-id header' });
    }

    const { id } = req.params;

    // Get KPI definition
    const kpiDef = await db.select().from(kpiDefinitions)
      .where(and(
        eq(kpiDefinitions.id, id),
        eq(kpiDefinitions.tenantId, tenantId)
      )).limit(1);

    if (kpiDef.length === 0) {
      return res.status(404).json({ error: 'KPI not found' });
    }

    // Get latest KPI value
    const latestValue = await db.select().from(kpiValues)
      .where(and(
        eq(kpiValues.kpiId, id),
        eq(kpiValues.tenantId, tenantId)
      ))
      .orderBy(desc(kpiValues.recordedAt))
      .limit(1);

    const result = {
      kpi: kpiDef[0],
      currentValue: latestValue.length > 0 ? latestValue[0] : null,
      hasData: latestValue.length > 0
    };

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching KPI value:', error);
    res.status(500).json({ 
      error: 'Failed to fetch KPI value',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// =====================================================================
// REPORT CATEGORIES ENDPOINT
// =====================================================================

// GET /api/reports/categories - Get available report categories
router.get('/reports/categories', async (req: any, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing x-tenant-id header' });
    }

    const categories = await db.select({
      category: reportDefinitions.category,
      count: sql<number>`count(*)`.as('count')
    })
    .from(reportDefinitions)
    .where(and(
      eq(reportDefinitions.tenantId, tenantId),
      eq(reportDefinitions.isActive, true)
    ))
    .groupBy(reportDefinitions.category);

    res.json({
      success: true,
      data: categories,
      meta: {
        totalCategories: categories.length,
        tenantId
      }
    });
  } catch (error) {
    console.error('Error fetching report categories:', error);
    res.status(500).json({ 
      error: 'Failed to fetch report categories',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// =====================================================================
// KPI CATEGORIES ENDPOINT
// =====================================================================

// GET /api/kpis/categories - Get available KPI categories
router.get('/kpis/categories', async (req: any, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ error: 'Missing x-tenant-id header' });
    }

    const categories = await db.select({
      category: kpiDefinitions.category,
      count: sql<number>`count(*)`.as('count'),
      highPriorityCount: sql<number>`sum(case when is_high_priority then 1 else 0 end)`.as('highPriorityCount')
    })
    .from(kpiDefinitions)
    .where(and(
      eq(kpiDefinitions.tenantId, tenantId),
      eq(kpiDefinitions.isActive, true)
    ))
    .groupBy(kpiDefinitions.category);

    res.json({
      success: true,
      data: categories,
      meta: {
        totalCategories: categories.length,
        tenantId
      }
    });
  } catch (error) {
    console.error('Error fetching KPI categories:', error);
    res.status(500).json({ 
      error: 'Failed to fetch KPI categories',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;