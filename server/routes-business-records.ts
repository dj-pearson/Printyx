import type { Express } from "express";
import { storage } from "./storage";
import { isAuthenticated } from "./replitAuth";

export function registerBusinessRecordRoutes(app: Express) {
  // Unified Business Records API - supports entire lead-to-customer lifecycle

  // Get all business records with filtering
  app.get("/api/business-records", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const { recordType, status } = req.query;
      
      const records = await storage.getBusinessRecords(tenantId, recordType, status);
      res.json(records);
    } catch (error) {
      console.error("Error fetching business records:", error);
      res.status(500).json({ message: "Failed to fetch business records" });
    }
  });

  // Get specific business record
  app.get("/api/business-records/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const { id } = req.params;
      
      const record = await storage.getBusinessRecord(id, tenantId);
      if (!record) {
        return res.status(404).json({ message: "Business record not found" });
      }
      
      res.json(record);
    } catch (error) {
      console.error("Error fetching business record:", error);
      res.status(500).json({ message: "Failed to fetch business record" });
    }
  });

  // Create new business record (can be lead or customer)
  app.post("/api/business-records", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.claims?.sub;
      
      const recordData = {
        ...req.body,
        tenantId,
        createdBy: userId,
      };
      
      const newRecord = await storage.createBusinessRecord(recordData);
      res.status(201).json(newRecord);
    } catch (error) {
      console.error("Error creating business record:", error);
      res.status(500).json({ message: "Failed to create business record" });
    }
  });

  // Update business record
  app.put("/api/business-records/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const { id } = req.params;
      
      const updatedRecord = await storage.updateBusinessRecord(id, tenantId, req.body);
      if (!updatedRecord) {
        return res.status(404).json({ message: "Business record not found" });
      }
      
      res.json(updatedRecord);
    } catch (error) {
      console.error("Error updating business record:", error);
      res.status(500).json({ message: "Failed to update business record" });
    }
  });

  // Lead-specific endpoints (filtered views)
  app.get("/api/leads", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const leads = await storage.getLeads(tenantId);
      res.json(leads);
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  app.post("/api/leads", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.claims?.sub;
      
      const leadData = {
        ...req.body,
        tenantId,
        createdBy: userId,
      };
      
      const newLead = await storage.createLead(leadData);
      res.status(201).json(newLead);
    } catch (error) {
      console.error("Error creating lead:", error);
      res.status(500).json({ message: "Failed to create lead" });
    }
  });

  // Customer-specific endpoints (filtered views)
  app.get("/api/customers", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const { includeInactive } = req.query;
      
      const customers = await storage.getCustomers(tenantId, includeInactive === 'true');
      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  app.get("/api/customers/:id", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const { id } = req.params;
      
      const customer = await storage.getCustomer(id, tenantId);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      res.json(customer);
    } catch (error) {
      console.error("Error fetching customer:", error);
      res.status(500).json({ message: "Failed to fetch customer" });
    }
  });

  // Former customers for reporting
  app.get("/api/former-customers", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      
      const formerCustomers = await storage.getFormerCustomers(tenantId);
      res.json(formerCustomers);
    } catch (error) {
      console.error("Error fetching former customers:", error);
      res.status(500).json({ message: "Failed to fetch former customers" });
    }
  });

  // Lead to Customer Conversion - ZERO data duplication
  app.post("/api/leads/:id/convert", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.claims?.sub;
      const { id } = req.params;
      
      const convertedCustomer = await storage.convertLeadToCustomer(id, tenantId, userId);
      if (!convertedCustomer) {
        return res.status(404).json({ message: "Lead not found or already converted" });
      }
      
      res.json({
        message: "Lead successfully converted to customer",
        customer: convertedCustomer
      });
    } catch (error) {
      console.error("Error converting lead to customer:", error);
      res.status(500).json({ message: "Failed to convert lead to customer" });
    }
  });

  // Customer Lifecycle Management
  app.post("/api/customers/:id/deactivate", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.claims?.sub;
      const { id } = req.params;
      const { reason } = req.body;
      
      if (!reason) {
        return res.status(400).json({ message: "Deactivation reason is required" });
      }
      
      const deactivatedCustomer = await storage.deactivateCustomer(id, tenantId, userId, reason);
      if (!deactivatedCustomer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      res.json({
        message: "Customer successfully deactivated",
        customer: deactivatedCustomer
      });
    } catch (error) {
      console.error("Error deactivating customer:", error);
      res.status(500).json({ message: "Failed to deactivate customer" });
    }
  });

  app.post("/api/customers/:id/mark-non-payment", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.claims?.sub;
      const { id } = req.params;
      
      const customer = await storage.markCustomerNonPayment(id, tenantId, userId);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      res.json({
        message: "Customer marked as non-payment",
        customer
      });
    } catch (error) {
      console.error("Error marking customer non-payment:", error);
      res.status(500).json({ message: "Failed to mark customer non-payment" });
    }
  });

  app.post("/api/customers/:id/reactivate", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.claims?.sub;
      const { id } = req.params;
      
      const reactivatedCustomer = await storage.reactivateCustomer(id, tenantId, userId);
      if (!reactivatedCustomer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      
      res.json({
        message: "Customer successfully reactivated",
        customer: reactivatedCustomer
      });
    } catch (error) {
      console.error("Error reactivating customer:", error);
      res.status(500).json({ message: "Failed to reactivate customer" });
    }
  });

  // Business Record Activities - Unified activity system
  app.get("/api/business-records/:id/activities", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const { id } = req.params;
      
      const activities = await storage.getBusinessRecordActivities(id, tenantId);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching business record activities:", error);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  app.post("/api/business-records/:id/activities", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.claims?.sub;
      const { id } = req.params;
      
      const activityData = {
        ...req.body,
        tenantId,
        businessRecordId: id,
        createdBy: userId,
      };
      
      const newActivity = await storage.createBusinessRecordActivity(activityData);
      res.status(201).json(newActivity);
    } catch (error) {
      console.error("Error creating business record activity:", error);
      res.status(500).json({ message: "Failed to create activity" });
    }
  });

  // Backward compatibility for lead activities
  app.get("/api/leads/:id/activities", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const { id } = req.params;
      
      const activities = await storage.getLeadActivities(id, tenantId);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching lead activities:", error);
      res.status(500).json({ message: "Failed to fetch lead activities" });
    }
  });

  // Backward compatibility for customer activities
  app.get("/api/customers/:id/activities", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const { id } = req.params;
      
      const activities = await storage.getCustomerActivities(id, tenantId);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching customer activities:", error);
      res.status(500).json({ message: "Failed to fetch customer activities" });
    }
  });
}