import { Express } from "express";
import { db } from "./db";
import { 
  serviceCallAnalysis, 
  servicePartsUsed, 
  partsOrders, 
  partsOrderItems,
  insertServiceCallAnalysisSchema,
  insertServicePartsUsedSchema,
  insertPartsOrderSchema,
  insertPartsOrderItemSchema
} from "../shared/service-analysis-schema";
import { serviceTickets } from "../shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.tenantId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
}

export function registerServiceAnalysisRoutes(app: Express) {
  
  // Get service call analysis for a ticket
  app.get('/api/service-tickets/:ticketId/analysis', requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.session.tenantId;
      const { ticketId } = req.params;

      const analysis = await db
        .select()
        .from(serviceCallAnalysis)
        .where(
          and(
            eq(serviceCallAnalysis.tenantId, tenantId),
            eq(serviceCallAnalysis.serviceTicketId, ticketId)
          )
        )
        .orderBy(desc(serviceCallAnalysis.createdAt));

      res.json(analysis);
    } catch (error) {
      console.error("Error fetching service analysis:", error);
      res.status(500).json({ error: "Failed to fetch service analysis" });
    }
  });

  // Create service call analysis
  app.post('/api/service-tickets/:ticketId/analysis', requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.session.tenantId;
      const { ticketId } = req.params;
      const analysisData = insertServiceCallAnalysisSchema.parse({
        ...req.body,
        tenantId,
        serviceTicketId: ticketId,
      });

      const [newAnalysis] = await db
        .insert(serviceCallAnalysis)
        .values(analysisData)
        .returning();

      // Update service ticket status based on outcome
      if (analysisData.outcome === 'resolved') {
        await db
          .update(serviceTickets)
          .set({ status: 'completed', updatedAt: new Date() })
          .where(
            and(
              eq(serviceTickets.id, ticketId),
              eq(serviceTickets.tenantId, tenantId)
            )
          );
      } else if (analysisData.outcome === 'requires_parts') {
        await db
          .update(serviceTickets)
          .set({ status: 'awaiting_parts', updatedAt: new Date() })
          .where(
            and(
              eq(serviceTickets.id, ticketId),
              eq(serviceTickets.tenantId, tenantId)
            )
          );
      }

      res.status(201).json(newAnalysis);
    } catch (error) {
      console.error("Error creating service analysis:", error);
      res.status(500).json({ error: "Failed to create service analysis" });
    }
  });

  // Update service call analysis
  app.put('/api/service-analysis/:id', requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.session.tenantId;
      const { id } = req.params;
      const updateData = req.body;

      const [updatedAnalysis] = await db
        .update(serviceCallAnalysis)
        .set({ ...updateData, updatedAt: new Date() })
        .where(
          and(
            eq(serviceCallAnalysis.id, id),
            eq(serviceCallAnalysis.tenantId, tenantId)
          )
        )
        .returning();

      if (!updatedAnalysis) {
        return res.status(404).json({ error: "Service analysis not found" });
      }

      res.json(updatedAnalysis);
    } catch (error) {
      console.error("Error updating service analysis:", error);
      res.status(500).json({ error: "Failed to update service analysis" });
    }
  });

  // Get parts used in analysis
  app.get('/api/service-analysis/:analysisId/parts-used', requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.session.tenantId;
      const { analysisId } = req.params;

      const parts = await db
        .select()
        .from(servicePartsUsed)
        .where(
          and(
            eq(servicePartsUsed.tenantId, tenantId),
            eq(servicePartsUsed.analysisId, analysisId)
          )
        );

      res.json(parts);
    } catch (error) {
      console.error("Error fetching parts used:", error);
      res.status(500).json({ error: "Failed to fetch parts used" });
    }
  });

  // Add parts used
  app.post('/api/service-analysis/:analysisId/parts-used', requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.session.tenantId;
      const { analysisId } = req.params;
      const partsData = insertServicePartsUsedSchema.parse({
        ...req.body,
        tenantId,
        analysisId,
      });

      const [newPart] = await db
        .insert(servicePartsUsed)
        .values(partsData)
        .returning();

      res.status(201).json(newPart);
    } catch (error) {
      console.error("Error adding parts used:", error);
      res.status(500).json({ error: "Failed to add parts used" });
    }
  });

  // Create parts order
  app.post('/api/service-analysis/:analysisId/parts-order', requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.session.tenantId;
      const { analysisId } = req.params;
      
      // Get analysis to get service ticket ID
      const analysis = await db
        .select()
        .from(serviceCallAnalysis)
        .where(
          and(
            eq(serviceCallAnalysis.id, analysisId),
            eq(serviceCallAnalysis.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!analysis.length) {
        return res.status(404).json({ error: "Service analysis not found" });
      }

      const orderData = insertPartsOrderSchema.parse({
        ...req.body,
        tenantId,
        analysisId,
        serviceTicketId: analysis[0].serviceTicketId,
        orderNumber: `PO-${Date.now()}`, // Generate order number
      });

      const [newOrder] = await db
        .insert(partsOrders)
        .values(orderData)
        .returning();

      res.status(201).json(newOrder);
    } catch (error) {
      console.error("Error creating parts order:", error);
      res.status(500).json({ error: "Failed to create parts order" });
    }
  });

  // Get parts orders for analysis
  app.get('/api/service-analysis/:analysisId/parts-orders', requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.session.tenantId;
      const { analysisId } = req.params;

      const orders = await db
        .select()
        .from(partsOrders)
        .where(
          and(
            eq(partsOrders.tenantId, tenantId),
            eq(partsOrders.analysisId, analysisId)
          )
        )
        .orderBy(desc(partsOrders.createdAt));

      res.json(orders);
    } catch (error) {
      console.error("Error fetching parts orders:", error);
      res.status(500).json({ error: "Failed to fetch parts orders" });
    }
  });

  // Update parts order status
  app.patch('/api/parts-orders/:orderId', requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.session.tenantId;
      const { orderId } = req.params;
      const { status, trackingNumber, actualDeliveryDate } = req.body;

      const [updatedOrder] = await db
        .update(partsOrders)
        .set({ 
          status, 
          trackingNumber, 
          actualDeliveryDate: actualDeliveryDate ? new Date(actualDeliveryDate) : undefined,
          updatedAt: new Date() 
        })
        .where(
          and(
            eq(partsOrders.id, orderId),
            eq(partsOrders.tenantId, tenantId)
          )
        )
        .returning();

      if (!updatedOrder) {
        return res.status(404).json({ error: "Parts order not found" });
      }

      res.json(updatedOrder);
    } catch (error) {
      console.error("Error updating parts order:", error);
      res.status(500).json({ error: "Failed to update parts order" });
    }
  });

  // Add parts order items
  app.post('/api/parts-orders/:orderId/items', requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.session.tenantId;
      const { orderId } = req.params;
      const itemsData = req.body.items || [req.body]; // Support both single item and array

      const items = itemsData.map((item: any) => 
        insertPartsOrderItemSchema.parse({
          ...item,
          tenantId,
          orderId,
        })
      );

      const newItems = await db
        .insert(partsOrderItems)
        .values(items)
        .returning();

      res.status(201).json(newItems);
    } catch (error) {
      console.error("Error adding parts order items:", error);
      res.status(500).json({ error: "Failed to add parts order items" });
    }
  });

  // Get parts order items
  app.get('/api/parts-orders/:orderId/items', requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.session.tenantId;
      const { orderId } = req.params;

      const items = await db
        .select()
        .from(partsOrderItems)
        .where(
          and(
            eq(partsOrderItems.tenantId, tenantId),
            eq(partsOrderItems.orderId, orderId)
          )
        );

      res.json(items);
    } catch (error) {
      console.error("Error fetching parts order items:", error);
      res.status(500).json({ error: "Failed to fetch parts order items" });
    }
  });

  // Service Analysis Dashboard Stats
  app.get('/api/service-analysis/stats', requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.session.tenantId;

      const stats = await db
        .select({
          totalAnalyses: sql<number>`count(*)`,
          avgSatisfactionScore: sql<number>`avg(${serviceCallAnalysis.customerSatisfactionScore})`,
          avgOnSiteTime: sql<number>`avg(${serviceCallAnalysis.onSiteTime})`,
          resolvedCount: sql<number>`count(*) filter (where ${serviceCallAnalysis.outcome} = 'resolved')`,
          partsRequiredCount: sql<number>`count(*) filter (where ${serviceCallAnalysis.outcome} = 'requires_parts')`,
        })
        .from(serviceCallAnalysis)
        .where(eq(serviceCallAnalysis.tenantId, tenantId));

      const partsOrderStats = await db
        .select({
          totalOrders: sql<number>`count(*)`,
          totalValue: sql<number>`sum(${partsOrders.total})`,
          pendingOrders: sql<number>`count(*) filter (where ${partsOrders.status} = 'pending')`,
          deliveredOrders: sql<number>`count(*) filter (where ${partsOrders.status} = 'delivered')`,
        })
        .from(partsOrders)
        .where(eq(partsOrders.tenantId, tenantId));

      res.json({
        serviceStats: stats[0],
        partsStats: partsOrderStats[0],
      });
    } catch (error) {
      console.error("Error fetching service analysis stats:", error);
      res.status(500).json({ error: "Failed to fetch service analysis stats" });
    }
  });

  // Get recent service analyses with ticket details
  app.get('/api/service-analysis/recent', requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.session.tenantId;
      const limit = parseInt(req.query.limit as string) || 10;

      const recentAnalyses = await db
        .select({
          id: serviceCallAnalysis.id,
          serviceTicketId: serviceCallAnalysis.serviceTicketId,
          outcome: serviceCallAnalysis.outcome,
          onSiteTime: serviceCallAnalysis.onSiteTime,
          customerSatisfactionScore: serviceCallAnalysis.customerSatisfactionScore,
          totalLaborCost: serviceCallAnalysis.totalLaborCost,
          createdAt: serviceCallAnalysis.createdAt,
          ticketTitle: serviceTickets.title,
          ticketPriority: serviceTickets.priority,
        })
        .from(serviceCallAnalysis)
        .leftJoin(serviceTickets, eq(serviceCallAnalysis.serviceTicketId, serviceTickets.id))
        .where(eq(serviceCallAnalysis.tenantId, tenantId))
        .orderBy(desc(serviceCallAnalysis.createdAt))
        .limit(limit);

      res.json(recentAnalyses);
    } catch (error) {
      console.error("Error fetching recent service analyses:", error);
      res.status(500).json({ error: "Failed to fetch recent service analyses" });
    }
  });
}