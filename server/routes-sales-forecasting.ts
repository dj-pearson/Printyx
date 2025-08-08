import express from "express";
import { desc, eq, and, sql, asc, gte, lte, between , isNotNull } from "drizzle-orm";
import { db } from "./db";
import { isAuthenticated } from "./replitAuth";
import {
  resolveTenant,
  requireTenant,
  TenantRequest,
} from "./middleware/tenancy";
import { 
  businessRecords, 
  deals, 
  quotes, 
  proposals, 
  salesGoals,
  goalProgress,
  dealStages 
} from "../shared/schema";
import {
  salesForecasts,
  forecastPipelineItems,
  forecastMetrics,
  forecastRules,
} from "./sales-forecasting-schema";

const router = express.Router();

// Sales Pipeline Forecasting API Routes
// Note: Database tables will be created after schema update

// Get all sales forecasts
router.get(
  "/api/sales-forecasts",
  resolveTenant,
  requireTenant,
  async (req: TenantRequest, res) => {
    try {
      const tenantId = req.tenantId!;
      const forecasts = await db
        .select()
        .from(salesForecasts)
        .where(eq(salesForecasts.tenantId, tenantId))
        .orderBy(desc(salesForecasts.createdAt));
      res.json(forecasts);
    } catch (error) {
      console.error("Error fetching sales forecasts:", error);
      res.status(500).json({ message: "Failed to fetch sales forecasts" });
    }
  }
);

// Get pipeline items for a specific forecast
router.get(
  "/api/sales-forecasts/:id/pipeline",
  async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;
      if (!tenantId)
        return res.status(400).json({ message: "Tenant ID is required" });

      const items = await db
        .select()
        .from(forecastPipelineItems)
        .where(
          and(
            eq(forecastPipelineItems.tenantId, tenantId),
            eq(forecastPipelineItems.forecastId, id)
          )
        )
        .orderBy(asc(forecastPipelineItems.expectedCloseDate));

      res.json(items);
    } catch (error) {
      console.error("Error fetching pipeline items:", error);
      res.status(500).json({ message: "Failed to fetch pipeline items" });
    }
  }
);

// Get comprehensive pipeline forecast data
router.get(
  "/api/pipeline-forecast/:forecastId?",
  resolveTenant,
  requireTenant,
  async (req: TenantRequest, res) => {
    try {
      const tenantId = req.tenantId!;
      const { forecastId } = req.params;
      const { period = "monthly", startDate, endDate } = req.query;

      // Get the forecast data if specific forecast requested
      let forecast = null;
      if (forecastId) {
        const forecastData = await db
          .select()
          .from(salesForecasts)
          .where(
            and(
              eq(salesForecasts.tenantId, tenantId),
              eq(salesForecasts.id, forecastId)
            )
          )
          .limit(1);
        forecast = forecastData[0] || null;
      }

      // Determine date range
      let dateStart, dateEnd;
      if (startDate && endDate) {
        dateStart = new Date(startDate as string);
        dateEnd = new Date(endDate as string);
      } else if (forecast) {
        dateStart = new Date(forecast.startDate);
        dateEnd = new Date(forecast.endDate);
      } else {
        // Default to current month
        const now = new Date();
        dateStart = new Date(now.getFullYear(), now.getMonth(), 1);
        dateEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      }

      // Get all pipeline data within the time period
      const [dealsData, quotesData, proposalsData, crmGoalsData] = await Promise.all([
        // Active deals in the time period
        db
          .select()
          .from(deals)
          .where(
            and(
              eq(deals.tenantId, tenantId),
              sql`${deals.status} NOT IN ('won', 'lost')`
            )
          ),
        
        // Active quotes in the time period
        db
          .select()
          .from(quotes)
          .where(
            and(
              eq(quotes.tenantId, tenantId),
              sql`${quotes.status} IN ('Sent', 'Draft', 'Pending')`
            )
          ),
        
        // Active proposals in the time period
        db
          .select()
          .from(proposals)
          .where(
            and(
              eq(proposals.tenantId, tenantId),
              sql`${proposals.status} IN ('sent', 'draft', 'pending', 'under_review')`
            )
          ),
        
        // CRM Goals for the period
        db
          .select({
            id: salesGoals.id,
            goalType: salesGoals.goalType,
            targetValue: salesGoals.targetValue,
            targetCount: salesGoals.targetCount,
            startDate: salesGoals.startDate,
            endDate: salesGoals.endDate
          })
          .from(salesGoals)
          .where(
            and(
              eq(salesGoals.tenantId, tenantId),
              eq(salesGoals.isActive, true)
            )
          )
      ]);

      // Transform data with type and default probabilities
      const transformedDeals = dealsData.map(deal => ({
        id: deal.id,
        title: deal.title || `Deal ${deal.id}`,
        value: parseFloat(deal.amount?.toString() || '0'),
        probability: deal.probability || 50,
        expectedCloseDate: deal.expectedCloseDate || new Date().toISOString(),
        status: deal.status || 'open',
        type: 'deal'
      }));

      const transformedQuotes = quotesData.map(quote => ({
        id: quote.id,
        title: quote.title || `Quote #${quote.quoteNumber || quote.id}`,
        value: parseFloat(quote.totalAmount?.toString() || '0'),
        probability: 50, // Default probability for quotes
        expectedCloseDate: quote.validUntil || new Date().toISOString(),
        status: quote.status || 'sent',
        type: 'quote'
      }));

      const transformedProposals = proposalsData.map(proposal => ({
        id: proposal.id,
        title: proposal.title || `Proposal ${proposal.id}`,
        value: parseFloat(proposal.totalAmount?.toString() || '0'),
        probability: 70, // Default probability for proposals
        expectedCloseDate: proposal.validUntil || new Date().toISOString(),
        status: proposal.status || 'sent',
        type: 'proposal'
      }));

      // Calculate pipeline totals
      const pipelineItems = [...transformedDeals, ...transformedQuotes, ...transformedProposals];
      const totalPipelineValue = pipelineItems.reduce((sum, item) => {
        const value = parseFloat(item.value?.toString() || '0');
        const probability = parseFloat(item.probability?.toString() || '0') / 100;
        return sum + (value * probability);
      }, 0);

      const totalPipelineCount = pipelineItems.length;

      // Calculate goal targets
      const totalGoalValue = crmGoalsData
        .filter(goal => goal.goalType === 'revenue')
        .reduce((sum, goal) => sum + parseFloat(goal.targetValue?.toString() || '0'), 0);

      const totalGoalCount = crmGoalsData
        .filter(goal => goal.goalType !== 'revenue')
        .reduce((sum, goal) => sum + parseInt(goal.targetCount?.toString() || '0'), 0);

      // Calculate remaining to goal
      const remainingToGoalValue = Math.max(0, totalGoalValue - totalPipelineValue);
      const remainingToGoalCount = Math.max(0, totalGoalCount - totalPipelineCount);

      // Group by type for breakdown
      const breakdown = {
        deals: {
          count: transformedDeals.length,
          value: transformedDeals.reduce((sum, deal) => sum + parseFloat(deal.value?.toString() || '0'), 0),
          weightedValue: transformedDeals.reduce((sum, deal) => {
            const value = parseFloat(deal.value?.toString() || '0');
            const probability = parseFloat(deal.probability?.toString() || '0') / 100;
            return sum + (value * probability);
          }, 0)
        },
        quotes: {
          count: transformedQuotes.length,
          value: transformedQuotes.reduce((sum, quote) => sum + parseFloat(quote.value?.toString() || '0'), 0),
          weightedValue: transformedQuotes.reduce((sum, quote) => {
            const value = parseFloat(quote.value?.toString() || '0');
            const probability = 0.5; // 50% default for quotes
            return sum + (value * probability);
          }, 0)
        },
        proposals: {
          count: transformedProposals.length,
          value: transformedProposals.reduce((sum, proposal) => sum + parseFloat(proposal.value?.toString() || '0'), 0),
          weightedValue: transformedProposals.reduce((sum, proposal) => {
            const value = parseFloat(proposal.value?.toString() || '0');
            const probability = 0.7; // 70% default for proposals
            return sum + (value * probability);
          }, 0)
        }
      };

      const responseData = {
        forecast,
        period: {
          type: period,
          startDate: dateStart,
          endDate: dateEnd
        },
        pipeline: {
          items: pipelineItems,
          totalValue: totalPipelineValue,
          totalCount: totalPipelineCount,
          breakdown
        },
        goals: {
          items: crmGoalsData,
          totalValue: totalGoalValue,
          totalCount: totalGoalCount
        },
        remaining: {
          toGoalValue: remainingToGoalValue,
          toGoalCount: remainingToGoalCount,
          progressPercent: totalGoalValue > 0 ? Math.min(100, (totalPipelineValue / totalGoalValue) * 100) : 0
        }
      };

      res.json(responseData);
    } catch (error) {
      console.error("Error fetching pipeline forecast:", error);
      res.status(500).json({ message: "Failed to fetch pipeline forecast data" });
    }
  }
);

// Get sales performance metrics
router.get(
  "/api/sales-performance-metrics",
  async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId)
        return res.status(400).json({ message: "Tenant ID is required" });

      const metrics = await db
        .select()
        .from(forecastMetrics)
        .where(eq(forecastMetrics.tenantId, tenantId))
        .orderBy(desc(forecastMetrics.snapshotDate));

      res.json(metrics);
    } catch (error) {
      console.error("Error fetching performance metrics:", error);
      res.status(500).json({ message: "Failed to fetch performance metrics" });
    }
  }
);

// Create new sales forecast
router.post("/api/sales-forecasts", isAuthenticated, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;

    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    const {
      forecastName,
      forecastType,
      startDate,
      endDate,
      revenueTarget,
      unitTarget,
      dealCountTarget,
    } = req.body;

    const [newForecast] = await db
      .insert(salesForecasts)
      .values({
        tenantId,
        forecastName,
        forecastType: forecastType || "monthly",
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        revenueTarget: parseFloat(revenueTarget),
        unitTarget: parseInt(unitTarget) || null,
        dealCountTarget: parseInt(dealCountTarget) || null,
        confidenceLevel: "medium",
        status: "active",
        createdBy: userId,
      })
      .returning();

    res.status(201).json(newForecast);
  } catch (error) {
    console.error("Error creating sales forecast:", error);
    res.status(500).json({ message: "Failed to create sales forecast" });
  }
});

// Update pipeline item stage/probability
router.put("/api/sales-pipeline/:id", isAuthenticated, async (req: any, res) => {
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
      return res.status(404).json({ message: "Pipeline item not found" });
    }

    res.json(updated);
  } catch (error) {
    console.error("Error updating pipeline item:", error);
    res.status(500).json({ message: "Failed to update pipeline item" });
  }
});

// Get forecasting rules/settings
router.get(
  "/api/sales-forecasting-rules",
  async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId)
        return res.status(400).json({ message: "Tenant ID is required" });

      const rules = await db
        .select()
        .from(forecastRules)
        .where(eq(forecastRules.tenantId, tenantId))
        .orderBy(asc(forecastRules.ruleName));

      res.json(rules);
    } catch (error) {
      console.error("Error fetching forecasting rules:", error);
      res.status(500).json({ message: "Failed to fetch forecasting rules" });
    }
  }
);

// Get historical performance for trend analysis
router.get("/api/sales-trends", async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId)
      return res.status(400).json({ message: "Tenant ID is required" });

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
          revenue: sql<number>`COALESCE(SUM(CAST(${businessRecords.value} AS decimal)), 0)`,
          deals: sql<number>`COUNT(*)`,
        })
        .from(businessRecords)
        .where(
          and(
            eq(businessRecords.tenantId, tenantId),
            eq(businessRecords.type, "customer"),
            gte(businessRecords.updatedAt, startDate)
          )
        )
        .groupBy(sql`DATE_TRUNC('month', ${businessRecords.updatedAt})`)
        .orderBy(sql`DATE_TRUNC('month', ${businessRecords.updatedAt}) DESC`),

      // Get recent forecast metrics
      db
        .select()
        .from(forecastMetrics)
        .where(
          and(
            eq(forecastMetrics.tenantId, tenantId),
            gte(forecastMetrics.snapshotDate, startDate)
          )
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
        m.snapshotDate?.toISOString().startsWith(monthKey)
      );

      trendData.push({
        month: monthKey,
        monthName: date.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
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
    console.error("Error fetching sales trends:", error);
    res.status(500).json({ message: "Failed to fetch sales trends" });
  }
});

export default router;
