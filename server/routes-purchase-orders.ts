import type { Express } from "express";
import { insertPurchaseOrderSchema, insertPurchaseOrderItemSchema, insertVendorSchema } from "@shared/schema";
import { storage } from "./storage";
import { isAuthenticated } from "./replitAuth";

export function registerPurchaseOrderRoutes(app: Express) {
  // Purchase Orders CRUD routes
  app.get("/api/purchase-orders", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.claims.tenantId;
      const purchaseOrders = await storage.getPurchaseOrders(tenantId);
      res.json(purchaseOrders);
    } catch (error) {
      console.error("Error fetching purchase orders:", error);
      res.status(500).json({ error: "Failed to fetch purchase orders" });
    }
  });

  app.get("/api/purchase-orders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.claims.tenantId;
      const { id } = req.params;
      
      const purchaseOrder = await storage.getPurchaseOrder(id, tenantId);
      if (!purchaseOrder) {
        return res.status(404).json({ error: "Purchase order not found" });
      }

      // Get line items for this purchase order
      const items = await storage.getPurchaseOrderItems(id, tenantId);
      
      res.json({ ...purchaseOrder, items });
    } catch (error) {
      console.error("Error fetching purchase order:", error);
      res.status(500).json({ error: "Failed to fetch purchase order" });
    }
  });

  app.post("/api/purchase-orders", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.claims.tenantId;
      const userId = req.user.claims.sub;
      
      const validatedData = insertPurchaseOrderSchema.parse({
        ...req.body,
        tenantId,
        createdBy: userId,
        requestedBy: req.body.requestedBy || userId,
      });

      const purchaseOrder = await storage.createPurchaseOrder(validatedData);
      
      // Create line items if provided
      if (req.body.items && Array.isArray(req.body.items)) {
        const items = [];
        for (const [index, item] of req.body.items.entries()) {
          const validatedItem = insertPurchaseOrderItemSchema.parse({
            ...item,
            tenantId,
            purchaseOrderId: purchaseOrder.id,
            lineNumber: index + 1,
          });
          const createdItem = await storage.createPurchaseOrderItem(validatedItem);
          items.push(createdItem);
        }
        res.json({ ...purchaseOrder, items });
      } else {
        res.json(purchaseOrder);
      }
    } catch (error: any) {
      console.error("Error creating purchase order:", error);
      if (error.name === "ZodError") {
        res.status(400).json({ error: "Invalid data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create purchase order" });
      }
    }
  });

  app.put("/api/purchase-orders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.claims.tenantId;
      const { id } = req.params;
      
      const purchaseOrder = await storage.updatePurchaseOrder(id, req.body, tenantId);
      if (!purchaseOrder) {
        return res.status(404).json({ error: "Purchase order not found" });
      }

      res.json(purchaseOrder);
    } catch (error) {
      console.error("Error updating purchase order:", error);
      res.status(500).json({ error: "Failed to update purchase order" });
    }
  });

  app.delete("/api/purchase-orders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.claims.tenantId;
      const { id } = req.params;
      
      const success = await storage.deletePurchaseOrder(id, tenantId);
      if (!success) {
        return res.status(404).json({ error: "Purchase order not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting purchase order:", error);
      res.status(500).json({ error: "Failed to delete purchase order" });
    }
  });

  // Update purchase order status
  app.patch("/api/purchase-orders/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.claims.tenantId;
      const { id } = req.params;
      const { status } = req.body;
      
      const purchaseOrder = await storage.updatePurchaseOrder(id, { 
        status,
        updatedAt: new Date(),
        ...(status === 'approved' && { approvedBy: req.user.claims.sub, approvedDate: new Date() })
      }, tenantId);
      
      if (!purchaseOrder) {
        return res.status(404).json({ error: "Purchase order not found" });
      }

      res.json(purchaseOrder);
    } catch (error) {
      console.error("Error updating purchase order status:", error);
      res.status(500).json({ error: "Failed to update purchase order status" });
    }
  });



  // Purchase Order Items routes
  app.get("/api/purchase-orders/:id/items", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.claims.tenantId;
      const { id } = req.params;
      
      const items = await storage.getPurchaseOrderItems(id, tenantId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching purchase order items:", error);
      res.status(500).json({ error: "Failed to fetch purchase order items" });
    }
  });

  app.post("/api/purchase-orders/:id/items", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.claims.tenantId;
      const { id } = req.params;
      
      const validatedData = insertPurchaseOrderItemSchema.parse({
        ...req.body,
        tenantId,
        purchaseOrderId: id,
      });

      const item = await storage.createPurchaseOrderItem(validatedData);
      res.json(item);
    } catch (error: any) {
      console.error("Error creating purchase order item:", error);
      if (error.name === "ZodError") {
        res.status(400).json({ error: "Invalid data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create purchase order item" });
      }
    }
  });

  app.put("/api/purchase-order-items/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.claims.tenantId;
      const { id } = req.params;
      
      const item = await storage.updatePurchaseOrderItem(id, req.body, tenantId);
      if (!item) {
        return res.status(404).json({ error: "Purchase order item not found" });
      }

      res.json(item);
    } catch (error) {
      console.error("Error updating purchase order item:", error);
      res.status(500).json({ error: "Failed to update purchase order item" });
    }
  });

  app.delete("/api/purchase-order-items/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.claims.tenantId;
      const { id } = req.params;
      
      const success = await storage.deletePurchaseOrderItem(id, tenantId);
      if (!success) {
        return res.status(404).json({ error: "Purchase order item not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting purchase order item:", error);
      res.status(500).json({ error: "Failed to delete purchase order item" });
    }
  });

  // Vendors CRUD routes
  app.get("/api/vendors", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.claims.tenantId;
      const vendors = await storage.getVendors(tenantId);
      res.json(vendors);
    } catch (error) {
      console.error("Error fetching vendors:", error);
      res.status(500).json({ error: "Failed to fetch vendors" });
    }
  });

  app.get("/api/vendors/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.claims.tenantId;
      const { id } = req.params;
      
      const vendor = await storage.getVendor(id, tenantId);
      if (!vendor) {
        return res.status(404).json({ error: "Vendor not found" });
      }

      res.json(vendor);
    } catch (error) {
      console.error("Error fetching vendor:", error);
      res.status(500).json({ error: "Failed to fetch vendor" });
    }
  });

  app.post("/api/vendors", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.claims.tenantId;
      
      const validatedData = insertVendorSchema.parse({
        ...req.body,
        tenantId,
      });

      const vendor = await storage.createVendor(validatedData);
      res.json(vendor);
    } catch (error: any) {
      console.error("Error creating vendor:", error);
      if (error.name === "ZodError") {
        res.status(400).json({ error: "Invalid data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create vendor" });
      }
    }
  });

  app.put("/api/vendors/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.claims.tenantId;
      const { id } = req.params;
      
      const vendor = await storage.updateVendor(id, req.body, tenantId);
      if (!vendor) {
        return res.status(404).json({ error: "Vendor not found" });
      }

      res.json(vendor);
    } catch (error) {
      console.error("Error updating vendor:", error);
      res.status(500).json({ error: "Failed to update vendor" });
    }
  });

  app.delete("/api/vendors/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.claims.tenantId;
      const { id } = req.params;
      
      const success = await storage.deleteVendor(id, tenantId);
      if (!success) {
        return res.status(404).json({ error: "Vendor not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting vendor:", error);
      res.status(500).json({ error: "Failed to delete vendor" });
    }
  });

  // Purchase Order status updates
  app.patch("/api/purchase-orders/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.claims.tenantId;
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const { status } = req.body;

      const updateData: any = { status };
      
      // Auto-approve if status is being set to "approved"
      if (status === "approved") {
        updateData.approvedBy = userId;
        updateData.approvedDate = new Date();
      }

      const purchaseOrder = await storage.updatePurchaseOrder(id, updateData, tenantId);
      if (!purchaseOrder) {
        return res.status(404).json({ error: "Purchase order not found" });
      }

      res.json(purchaseOrder);
    } catch (error) {
      console.error("Error updating purchase order status:", error);
      res.status(500).json({ error: "Failed to update purchase order status" });
    }
  });

  // Purchase Order statistics
  app.get("/api/purchase-orders/stats/summary", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user.claims.tenantId;
      const purchaseOrders = await storage.getPurchaseOrders(tenantId);

      const stats = {
        total: purchaseOrders.length,
        draft: purchaseOrders.filter(po => po.status === "draft").length,
        pending: purchaseOrders.filter(po => po.status === "pending").length,
        approved: purchaseOrders.filter(po => po.status === "approved").length,
        ordered: purchaseOrders.filter(po => po.status === "ordered").length,
        received: purchaseOrders.filter(po => po.status === "received").length,
        cancelled: purchaseOrders.filter(po => po.status === "cancelled").length,
        totalValue: purchaseOrders.reduce((sum, po) => sum + parseFloat(po.totalAmount || "0"), 0),
        pendingValue: purchaseOrders
          .filter(po => ["pending", "approved", "ordered"].includes(po.status))
          .reduce((sum, po) => sum + parseFloat(po.totalAmount || "0"), 0)
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching purchase order stats:", error);
      res.status(500).json({ error: "Failed to fetch purchase order statistics" });
    }
  });
}