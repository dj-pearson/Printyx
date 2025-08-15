import type { Express } from "express";
import { eq, and, desc, sql, count } from "drizzle-orm";
import { db } from "./db";
import { isAuthenticated } from "./replitAuth";
import {
  deals,
  dealStages,
  dealActivities,
  businessRecords,
  users,
  insertDealSchema,
  insertDealStageSchema,
  insertDealActivitySchema,
  type Deal,
  type DealStage,
  type DealActivity
} from "@shared/schema";

export function registerDealsManagementRoutes(app: Express) {
  // Get all deals for tenant
  app.get("/api/deals-management/deals", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const dealsData = await db
        .select({
          id: deals.id,
          title: deals.title,
          description: deals.description,
          value: deals.value,
          probability: deals.probability,
          stage: deals.stage,
          status: deals.status,
          expectedCloseDate: deals.expectedCloseDate,
          actualCloseDate: deals.actualCloseDate,
          assignedToId: deals.assignedToId,
          customerName: businessRecords.companyName,
          customerId: deals.customerId,
          assignedToName: users.firstName,
          createdAt: deals.createdAt,
          updatedAt: deals.updatedAt
        })
        .from(deals)
        .leftJoin(businessRecords, eq(deals.customerId, businessRecords.id))
        .leftJoin(users, eq(deals.assignedToId, users.id))
        .where(eq(deals.tenantId, tenantId))
        .orderBy(desc(deals.createdAt));

      res.json(dealsData);
    } catch (error) {
      console.error("Error fetching deals:", error);
      res.status(500).json({ error: "Failed to fetch deals" });
    }
  });

  // Get deal by ID
  app.get("/api/deals-management/deals/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const dealId = req.params.id;

      const [deal] = await db
        .select({
          id: deals.id,
          title: deals.title,
          description: deals.description,
          value: deals.value,
          probability: deals.probability,
          stage: deals.stage,
          status: deals.status,
          expectedCloseDate: deals.expectedCloseDate,
          actualCloseDate: deals.actualCloseDate,
          assignedToId: deals.assignedToId,
          customerName: businessRecords.companyName,
          customerId: deals.customerId,
          assignedToName: users.firstName,
          createdAt: deals.createdAt,
          updatedAt: deals.updatedAt
        })
        .from(deals)
        .leftJoin(businessRecords, eq(deals.customerId, businessRecords.id))
        .leftJoin(users, eq(deals.assignedToId, users.id))
        .where(and(eq(deals.id, dealId), eq(deals.tenantId, tenantId)));

      if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
      }

      // Get deal activities
      const activities = await db
        .select()
        .from(dealActivities)
        .where(and(eq(dealActivities.dealId, dealId), eq(dealActivities.tenantId, tenantId)))
        .orderBy(desc(dealActivities.createdAt));

      res.json({ ...deal, activities });
    } catch (error) {
      console.error("Error fetching deal:", error);
      res.status(500).json({ error: "Failed to fetch deal" });
    }
  });

  // Create new deal
  app.post("/api/deals-management/deals", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.claims.sub;

      const dealData = insertDealSchema.parse({
        ...req.body,
        tenantId,
        createdBy: userId,
        assignedToId: req.body.assignedToId || userId
      });

      const [newDeal] = await db
        .insert(deals)
        .values(dealData)
        .returning();

      res.status(201).json(newDeal);
    } catch (error) {
      console.error("Error creating deal:", error);
      res.status(500).json({ error: "Failed to create deal" });
    }
  });

  // Update deal
  app.put("/api/deals-management/deals/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const dealId = req.params.id;

      const [updatedDeal] = await db
        .update(deals)
        .set({
          ...req.body,
          updatedAt: new Date()
        })
        .where(and(eq(deals.id, dealId), eq(deals.tenantId, tenantId)))
        .returning();

      if (!updatedDeal) {
        return res.status(404).json({ error: "Deal not found" });
      }

      res.json(updatedDeal);
    } catch (error) {
      console.error("Error updating deal:", error);
      res.status(500).json({ error: "Failed to update deal" });
    }
  });

  // Delete deal
  app.delete("/api/deals-management/deals/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const dealId = req.params.id;

      // Delete deal activities first
      await db
        .delete(dealActivities)
        .where(and(eq(dealActivities.dealId, dealId), eq(dealActivities.tenantId, tenantId)));

      // Delete deal
      const [deletedDeal] = await db
        .delete(deals)
        .where(and(eq(deals.id, dealId), eq(deals.tenantId, tenantId)))
        .returning();

      if (!deletedDeal) {
        return res.status(404).json({ error: "Deal not found" });
      }

      res.json({ message: "Deal deleted successfully" });
    } catch (error) {
      console.error("Error deleting deal:", error);
      res.status(500).json({ error: "Failed to delete deal" });
    }
  });

  // Get deal stages
  app.get("/api/deals-management/stages", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      const stages = await db
        .select()
        .from(dealStages)
        .where(eq(dealStages.tenantId, tenantId))
        .orderBy(dealStages.order);

      res.json(stages);
    } catch (error) {
      console.error("Error fetching deal stages:", error);
      res.status(500).json({ error: "Failed to fetch deal stages" });
    }
  });

  // Create deal stage
  app.post("/api/deals-management/stages", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      const stageData = insertDealStageSchema.parse({
        ...req.body,
        tenantId
      });

      const [newStage] = await db
        .insert(dealStages)
        .values(stageData)
        .returning();

      res.status(201).json(newStage);
    } catch (error) {
      console.error("Error creating deal stage:", error);
      res.status(500).json({ error: "Failed to create deal stage" });
    }
  });

  // Get deal activities
  app.get("/api/deals-management/deals/:id/activities", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const dealId = req.params.id;

      const activities = await db
        .select({
          id: dealActivities.id,
          dealId: dealActivities.dealId,
          activityType: dealActivities.activityType,
          description: dealActivities.description,
          outcome: dealActivities.outcome,
          followUpDate: dealActivities.followUpDate,
          createdBy: dealActivities.createdBy,
          createdByName: users.firstName,
          createdAt: dealActivities.createdAt
        })
        .from(dealActivities)
        .leftJoin(users, eq(dealActivities.createdBy, users.id))
        .where(and(eq(dealActivities.dealId, dealId), eq(dealActivities.tenantId, tenantId)))
        .orderBy(desc(dealActivities.createdAt));

      res.json(activities);
    } catch (error) {
      console.error("Error fetching deal activities:", error);
      res.status(500).json({ error: "Failed to fetch deal activities" });
    }
  });

  // Add deal activity
  app.post("/api/deals-management/deals/:id/activities", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const dealId = req.params.id;
      const userId = req.user.claims.sub;

      const activityData = insertDealActivitySchema.parse({
        ...req.body,
        dealId,
        tenantId,
        createdBy: userId
      });

      const [newActivity] = await db
        .insert(dealActivities)
        .values(activityData)
        .returning();

      res.status(201).json(newActivity);
    } catch (error) {
      console.error("Error creating deal activity:", error);
      res.status(500).json({ error: "Failed to create deal activity" });
    }
  });

  // Get deals dashboard stats
  app.get("/api/deals-management/dashboard", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;

      // Get deal statistics
      const totalDealsResult = await db
        .select({ count: count() })
        .from(deals)
        .where(eq(deals.tenantId, tenantId));

      const activeDealsResult = await db
        .select({ count: count() })
        .from(deals)
        .where(and(eq(deals.tenantId, tenantId), eq(deals.status, 'active')));

      const wonDealsResult = await db
        .select({ 
          count: count(),
          totalValue: sql<number>`COALESCE(SUM(${deals.value}), 0)`
        })
        .from(deals)
        .where(and(eq(deals.tenantId, tenantId), eq(deals.status, 'won')));

      const lostDealsResult = await db
        .select({ count: count() })
        .from(deals)
        .where(and(eq(deals.tenantId, tenantId), eq(deals.status, 'lost')));

      const totalDeals = totalDealsResult[0]?.count || 0;
      const activeDeals = activeDealsResult[0]?.count || 0;
      const wonDeals = wonDealsResult[0]?.count || 0;
      const lostDeals = lostDealsResult[0]?.count || 0;
      const totalValue = wonDealsResult[0]?.totalValue || 0;

      const winRate = totalDeals > 0 ? (wonDeals / (wonDeals + lostDeals)) * 100 : 0;

      res.json({
        totalDeals,
        activeDeals,
        wonDeals,
        lostDeals,
        totalValue,
        winRate: Math.round(winRate * 100) / 100
      });
    } catch (error) {
      console.error("Error fetching deals dashboard:", error);
      res.status(500).json({ error: "Failed to fetch deals dashboard" });
    }
  });
}