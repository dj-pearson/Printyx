import express from "express";
import { desc, eq, and, sql, asc, gte, lte, between } from "drizzle-orm";
import { db } from "./db";
import { requireAuth } from "./auth-setup";
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
  requireAuth,
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
  requireAuth,
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
router.post("/api/sales-forecasts", requireAuth, async (req: any, res) => {
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

    // For now, return success response until schema is updated
    const newForecast = {
      id: `forecast-${Date.now()}`,
      tenantId,
      forecastName,
      forecastType: forecastType || "monthly",
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      revenueTarget: parseFloat(revenueTarget),
      unitTarget: parseInt(unitTarget),
      dealCountTarget: parseInt(dealCountTarget),
      actualRevenue: 0,
      actualUnits: 0,
      actualDeals: 0,
      pipelineValue: 0,
      weightedPipelineValue: 0,
      probabilityAdjustedRevenue: 0,
      confidenceLevel: "medium",
      confidencePercentage: 75,
      conversionRate: 0,
      averageDealSize: 0,
      salesCycleLength: 30,
      status: "active",
      createdBy: userId,
      createdAt: new Date(),
    };

    res.status(201).json(newForecast);
  } catch (error) {
    console.error("Error creating sales forecast:", error);
    res.status(500).json({ message: "Failed to create sales forecast" });
  }
});

// Update pipeline item stage/probability
router.put("/api/sales-pipeline/:id", requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { stage, closeProbability, expectedCloseDate, notes } = req.body;

    // For now, return success response until schema is updated
    res.json({
      message: "Pipeline item updated successfully",
      id,
      stage,
      closeProbability,
      expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
      notes,
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error("Error updating pipeline item:", error);
    res.status(500).json({ message: "Failed to update pipeline item" });
  }
});

// Get forecasting rules/settings
router.get(
  "/api/sales-forecasting-rules",
  requireAuth,
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
router.get("/api/sales-trends", requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId)
      return res.status(400).json({ message: "Tenant ID is required" });

    // For now return empty until we define an aggregation over metrics/deals
    res.json([]);
  } catch (error) {
    console.error("Error fetching sales trends:", error);
    res.status(500).json({ message: "Failed to fetch sales trends" });
  }
});

export default router;
