import express from 'express';
import { desc, eq, and, sql, asc, gte, lte, between, isNotNull } from 'drizzle-orm';
import { db } from './db';
import { isAuthenticated } from './replitAuth';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-sales-forecasting');

import { businessRecords } from '../shared/schema';
import { forecastPipelineItems, forecastMetrics, forecastRules } from './sales-forecasting-schema';

const router = express.Router();

// Sales Pipeline Forecasting API Routes
// Note: Database tables will be created after schema update

// ── /api/sales-forecasts: RETIRED (PA-022) ──────────────────────────────────
//
// Three handlers lived here - GET list, GET /:id/pipeline and POST. The prefix
// is in crmProxies now, so dev and prod both run
// supabase/functions/sales-forecasts/, which already covered the two reads.
// Until this change SalesPipelineForecasting.tsx and SalesCommandCenter.tsx
// listed forecasts from two different implementations depending on the host.
//
// The POST is not ported. No file in any client tree creates a forecast - the
// only two callers of this prefix are those two list queries - and it could not
// have run in production anyway, since production does not reach Express. Its
// edge function header already recorded the read-only scope as deliberate.
// Building a create path is a feature, and it starts with a caller.
//
// Untouched below, and NOT under this prefix: /api/sales-performance-metrics,
// /api/sales-forecasting-rules, /api/sales-trends, and PUT /api/sales-pipeline/:id
// - the last of which is a fourth stage model behind a prefix that already has
// three (see the two-stage-vocabularies note in CLAUDE.md), which is why
// /api/sales-pipeline takes per-path proxy entries and not a bare one.

// Get comprehensive pipeline forecast data
// GET /api/pipeline-forecast/:forecastId? was removed here (PROD-008b).
// supabase/functions/pipeline-forecast/ exists for exactly this route — its
// header says "Prod parity for GET /api/pipeline-forecast/:forecastId?" — and
// handles both the bare and :forecastId forms.

// Get sales performance metrics
router.get('/api/sales-performance-metrics', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

    const metrics = await db
      .select()
      .from(forecastMetrics)
      .where(eq(forecastMetrics.tenantId, tenantId))
      .orderBy(desc(forecastMetrics.snapshotDate));

    res.json(metrics);
  } catch (error) {
    log.error('Error fetching performance metrics:', error);
    res.status(500).json({ message: 'Failed to fetch performance metrics' });
  }
});

// Update pipeline item stage/probability
router.put('/api/sales-pipeline/:id', isAuthenticated, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { stage, closeProbability, expectedCloseDate, notes } = req.body;

    const [updated] = await db
      .update(forecastPipelineItems)
      .set({
        salesStage: stage,
        probability: closeProbability,
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
        updatedAt: new Date(),
      })
      .where(eq(forecastPipelineItems.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ message: 'Pipeline item not found' });
    }

    res.json(updated);
  } catch (error) {
    log.error('Error updating pipeline item:', error);
    res.status(500).json({ message: 'Failed to update pipeline item' });
  }
});

// Get forecasting rules/settings
router.get('/api/sales-forecasting-rules', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

    const rules = await db
      .select()
      .from(forecastRules)
      .where(eq(forecastRules.tenantId, tenantId))
      .orderBy(asc(forecastRules.ruleName));

    res.json(rules);
  } catch (error) {
    log.error('Error fetching forecasting rules:', error);
    res.status(500).json({ message: 'Failed to fetch forecasting rules' });
  }
});

// Get historical performance for trend analysis
router.get('/api/sales-trends', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

    // Get historical sales metrics from business records and recent forecast metrics
    const { months = 6 } = req.query;
    const monthsBack = parseInt(months as string);
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);

    const [recentDeals, metricsData] = await Promise.all([
      // Get recent closed deals from business records
      db
        .select({
          month: sql<string>`DATE_TRUNC('month', ${businessRecords.updatedAt})::text`,
          revenue: sql<number>`COALESCE(SUM(CAST(${businessRecords.estimatedAmount} AS decimal)), 0)`,
          deals: sql<number>`COUNT(*)`,
        })
        .from(businessRecords)
        .where(
          and(
            eq(businessRecords.tenantId, tenantId),
            eq(businessRecords.recordType, 'customer'),
            gte(businessRecords.updatedAt, startDate),
          ),
        )
        .groupBy(sql`DATE_TRUNC('month', ${businessRecords.updatedAt})`)
        .orderBy(sql`DATE_TRUNC('month', ${businessRecords.updatedAt}) DESC`),

      // Get recent forecast metrics
      db
        .select()
        .from(forecastMetrics)
        .where(
          and(eq(forecastMetrics.tenantId, tenantId), gte(forecastMetrics.snapshotDate, startDate)),
        )
        .orderBy(desc(forecastMetrics.snapshotDate)),
    ]);

    // Combine and format trend data
    const trendData = [];
    for (let i = 0; i < monthsBack; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = date.toISOString().substring(0, 7);

      const dealData = recentDeals.find((d) => d.month?.startsWith(monthKey));
      const metricData = metricsData.find((m) =>
        m.snapshotDate?.toISOString().startsWith(monthKey),
      );

      trendData.push({
        month: monthKey,
        monthName: date.toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        }),
        revenue: dealData?.revenue || 0,
        deals: dealData?.deals || 0,
        units: metricData?.totalDeals || 0,
        pipelineValue: metricData?.totalPipelineValue || 0,
        conversionRate: metricData?.conversionRate || 0,
        averageDealSize: metricData?.averageDealSize || 0,
      });
    }

    res.json(trendData.reverse());
  } catch (error) {
    log.error('Error fetching sales trends:', error);
    res.status(500).json({ message: 'Failed to fetch sales trends' });
  }
});

export default router;
