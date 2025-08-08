import express from "express";
import { desc, eq, and, sql, asc, gte, lte, between } from "drizzle-orm";
import { db } from "./db";
import { isAuthenticated } from "./replitAuth";
import {
  resolveTenant,
  requireTenant,
  TenantRequest,
} from "./middleware/tenancy";
import { businessRecords } from "../shared/schema";
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
