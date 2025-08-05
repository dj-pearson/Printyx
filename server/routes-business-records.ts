import type { Express } from "express";
import { storage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import { resolveTenant, requireTenant, TenantRequest } from './middleware/tenancy';
import { BusinessRecordsTransformer } from './data-field-mapping';

export function registerBusinessRecordRoutes(app: Express) {
  // Unified Business Records API - supports entire lead-to-customer lifecycle

  // Get all business records with filtering
  app.get("/api/business-records", resolveTenant, requireTenant, async (req: TenantRequest, res) => {
    try {
      const tenantId = req.tenantId!;
      const { recordType, status } = req.query;
      
      const records = await storage.getBusinessRecords(tenantId, recordType, status);
      // Transform database fields to frontend format
      const transformedRecords = records.map(record => BusinessRecordsTransformer.toFrontend(record));
      res.json(transformedRecords);
    } catch (error) {
      console.error("Error fetching business records:", error);
      res.status(500).json({ message: "Failed to fetch business records" });
    }
  });

  // Get specific business record
  app.get("/api/business-records/:id", resolveTenant, requireTenant, async (req: TenantRequest, res) => {
    try {
      const tenantId = req.tenantId!;
      const { id } = req.params;
      
      const record = await storage.getBusinessRecord(id, tenantId);
      if (!record) {
        return res.status(404).json({ message: "Business record not found" });
      }
      
      // Transform database fields to frontend format
      const transformedRecord = BusinessRecordsTransformer.toFrontend(record);
      res.json(transformedRecord);
    } catch (error) {
      console.error("Error fetching business record:", error);
      res.status(500).json({ message: "Failed to fetch business record" });
    }
  });

  // Create new business record (can be lead or customer)
  app.post("/api/business-records", resolveTenant, requireTenant, async (req: TenantRequest, res) => {
    try {
      // Check for session-based auth (current approach)
      const session = req.session as any;
      const userId = session?.userId;
      const tenantId = req.tenantId!;
      
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      // Transform frontend data to database format
      const frontendData = req.body;
      console.log('[DEBUG] Frontend data received:', JSON.stringify(frontendData, null, 2));
      const dbData = BusinessRecordsTransformer.toDb(frontendData);
      console.log('[DEBUG] Transformed db data:', JSON.stringify(dbData, null, 2));
      
      // Normalize record type and status
      const recordType = BusinessRecordsTransformer.normalizeRecordType(frontendData.recordType || 'lead');
      const status = BusinessRecordsTransformer.normalizeStatus(frontendData.status || 'new', recordType);
      
      const recordData = {
        ...dbData,
        tenant_id: tenantId,
        created_by: userId,
        record_type: recordType,
        status: status,
      };
      
      const newRecord = await storage.createBusinessRecord(recordData);
      // Transform response back to frontend format
      const transformedNewRecord = BusinessRecordsTransformer.toFrontend(newRecord);
      res.status(201).json(transformedNewRecord);
    } catch (error) {
      console.error("Error creating business record:", error);
      res.status(500).json({ message: "Failed to create business record" });
    }
  });

  // Update business record
  app.put("/api/business-records/:id", resolveTenant, requireTenant, async (req: TenantRequest, res) => {
    try {
      // Check for session-based auth (current approach)
      const session = req.session as any;
      const userId = session?.userId;
      const tenantId = req.tenantId!;
      const { id } = req.params;
      
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      // Transform frontend data to database format
      const frontendData = req.body;
      const dbData = BusinessRecordsTransformer.toDb(frontendData);
      
      // Handle record type changes (lead to customer conversion)
      if (frontendData.recordType) {
        const recordType = BusinessRecordsTransformer.normalizeRecordType(frontendData.recordType);
        const status = BusinessRecordsTransformer.normalizeStatus(frontendData.status || 'active', recordType);
        dbData.record_type = recordType;
        dbData.status = status;
        
        // Set conversion timestamp if converting lead to customer
        if (recordType === 'customer' && !dbData.customer_since) {
          dbData.customer_since = new Date().toISOString();
          dbData.converted_by = userId || 'system';
        }
      }
      
      const updatedRecord = await storage.updateBusinessRecord(id, tenantId, dbData);
      if (!updatedRecord) {
        return res.status(404).json({ message: "Business record not found" });
      }
      
      // Transform response back to frontend format
      const transformedRecord = BusinessRecordsTransformer.toFrontend(updatedRecord);
      res.json(transformedRecord);
    } catch (error) {
      console.error("Error updating business record:", error);
      res.status(500).json({ message: "Failed to update business record" });
    }
  });

  // Lead-specific endpoints (filtered views)
  app.get("/api/leads", resolveTenant, requireTenant, async (req: TenantRequest, res) => {
    try {
      const tenantId = req.tenantId!;
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
  app.get("/api/business-records/:id/activities", async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || process.env.DEMO_TENANT_ID || '550e8400-e29b-41d4-a716-446655440000';
      const { id } = req.params;
      
      const activities = await storage.getBusinessRecordActivities(id, tenantId);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching business record activities:", error);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  app.post("/api/business-records/:id/activities", async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || process.env.DEMO_TENANT_ID || '550e8400-e29b-41d4-a716-446655440000';
      const userId = req.user?.id || 'system';
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