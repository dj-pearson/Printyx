import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { authRoutes } from "./auth-routes";
import { 
  requireRole, 
  requireSalesAccess, 
  requireServiceAccess, 
  requireFinanceAccess,
  requirePurchasingAccess,
  requireAdminAccess,
  applyScopeFilter,
  getDataFilter,
  type AuthenticatedRequest 
} from "./rbac-middleware";
import {
  insertCustomerSchema,
  insertLeadSchema,
  insertQuoteSchema,
  insertEquipmentSchema,
  insertContractSchema,
  insertServiceTicketSchema,
  insertInventoryItemSchema,
  insertTechnicianSchema,
  insertMeterReadingSchema,
  insertInvoiceSchema,
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup session management
  const pgStore = connectPg(session);
  app.use(session({
    store: new pgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || 'demo-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true in production with HTTPS
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Auth routes
  app.use('/api/auth', authRoutes);

  // Auth routes - return demo user with role information
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      // Check for demo authentication header or session
      const isDemoAuth = req.headers['x-demo-auth'] === 'true' || 
                        req.query.demo === 'true' ||
                        req.session?.demoAuth === true;
      
      if (!isDemoAuth) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Return mock authenticated user for demo with role structure
      const mockUser = {
        id: "demo-user-123",
        email: "demo@printyx.com",
        firstName: "Demo",
        lastName: "User",
        profileImageUrl: null,  
        tenantId: "550e8400-e29b-41d4-a716-446655440000",
        roleId: "sales-manager-role",
        teamId: "sales-team-1",
        isActive: true,
        role: {
          id: "sales-manager-role",
          name: "Sales Manager",
          code: "SALES_MANAGER",
          department: "sales",
          level: 3,
          description: "Manages sales team and operations",
          permissions: {
            sales: ["*"],
            service: ["view-tickets", "create-tickets"],
            reports: ["team-sales-reports", "team-performance"]
          }
        },
        team: {
          id: "sales-team-1",
          name: "West Coast Sales",
          department: "sales",
          managerId: "demo-user-123"
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      res.json(mockUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Dashboard routes - using demo tenant
  app.get('/api/dashboard/metrics', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const metrics = await storage.getDashboardMetrics(tenantId);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
  });

  app.get('/api/dashboard/recent-tickets', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const tickets = await storage.getRecentServiceTickets(tenantId);
      res.json(tickets);
    } catch (error) {
      console.error("Error fetching recent tickets:", error);
      res.status(500).json({ message: "Failed to fetch recent tickets" });
    }
  });

  app.get('/api/dashboard/top-customers', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const customers = await storage.getTopCustomers(tenantId);
      res.json(customers);
    } catch (error) {
      console.error("Error fetching top customers:", error);
      res.status(500).json({ message: "Failed to fetch top customers" });
    }
  });

  app.get('/api/dashboard/alerts', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const lowStockItems = await storage.getLowStockAlerts(tenantId);
      res.json({ lowStock: lowStockItems });
    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ message: "Failed to fetch alerts" });
    }
  });

  // Customer routes with RBAC (demo mode)
  app.get('/api/customers', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Demo tenant
      // Demo mode - show all customers
      const customers = await storage.getCustomers(tenantId);
      
      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  app.post('/api/customers', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Demo tenant
      
      const validatedData = insertCustomerSchema.parse({
        ...req.body,
        tenantId: tenantId,
      });
      
      const customer = await storage.createCustomer(validatedData);
      res.status(201).json(customer);
    } catch (error) {
      console.error("Error creating customer:", error);
      res.status(500).json({ message: "Failed to create customer" });
    }
  });

  // Lead routes (demo mode)
  app.get('/api/leads', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      // Demo mode - show all leads
      const leads = await storage.getLeads(tenantId);
      
      res.json(leads);
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  app.post('/api/leads', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const userId = "demo-user-123";
      
      const validatedData = insertLeadSchema.parse({
        ...req.body,
        tenantId: tenantId,
        createdBy: userId,
        assignedSalespersonId: req.body.assignedSalespersonId || userId, // Default to creator if not specified
      });
      
      const lead = await storage.createLead(validatedData);
      res.status(201).json(lead);
    } catch (error) {
      console.error("Error creating lead:", error);
      res.status(500).json({ message: "Failed to create lead" });
    }
  });

  // Quote routes (demo mode)
  app.get('/api/quotes', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const quotes = await storage.getQuotes(tenantId); // TODO: Add role-based filtering
      res.json(quotes);
    } catch (error) {
      console.error("Error fetching quotes:", error);
      res.status(500).json({ message: "Failed to fetch quotes" });
    }
  });

  app.post('/api/quotes', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const userId = "demo-user-123";
      
      const validatedData = insertQuoteSchema.parse({
        ...req.body,
        tenantId: tenantId,
        createdBy: userId,
        quoteNumber: `QT-${Date.now()}`, // Simple quote number generation
      });
      
      const quote = await storage.createQuote(validatedData);
      res.status(201).json(quote);
    } catch (error) {
      console.error("Error creating quote:", error);
      res.status(500).json({ message: "Failed to create quote" });
    }
  });

  // Service ticket routes (demo mode)
  app.get('/api/service-tickets', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      // Demo mode - show all tickets
      const tickets = await storage.getServiceTickets(tenantId);
      
      res.json(tickets);
    } catch (error) {
      console.error("Error fetching service tickets:", error);
      res.status(500).json({ message: "Failed to fetch service tickets" });
    }
  });

  app.post('/api/service-tickets', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const userId = "demo-user-123";
      
      const validatedData = insertServiceTicketSchema.parse({
        ...req.body,
        tenantId: tenantId,
        createdBy: userId,
        ticketNumber: `ST-${Date.now()}`, // Simple ticket number generation
      });
      
      const ticket = await storage.createServiceTicket(validatedData);
      res.status(201).json(ticket);
    } catch (error) {
      console.error("Error creating service ticket:", error);
      res.status(500).json({ message: "Failed to create service ticket" });
    }
  });

  // Contract routes (demo mode)
  app.get('/api/contracts', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      // Demo mode - show all contracts
      const contracts = await storage.getContracts(tenantId);
      
      res.json(contracts);
    } catch (error) {
      console.error("Error fetching contracts:", error);
      res.status(500).json({ message: "Failed to fetch contracts" });
    }
  });

  // Inventory routes (demo mode)
  app.get('/api/inventory', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      // Demo mode - allow management
      const canManage = true;
      const items = await storage.getInventoryItems(tenantId);
      
      res.json({ items, canManage });
    } catch (error) {
      console.error("Error fetching inventory:", error);
      res.status(500).json({ message: "Failed to fetch inventory" });
    }
  });

  // Billing routes (demo mode)
  app.get('/api/invoices', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const invoices = await storage.getInvoices(tenantId);
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  // Contract routes
  app.get('/api/contracts', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Demo tenant
      const contracts = await storage.getContracts(tenantId);
      res.json(contracts);
    } catch (error) {
      console.error("Error fetching contracts:", error);
      res.status(500).json({ message: "Failed to fetch contracts" });
    }
  });

  // Equipment routes
  app.get('/api/equipment', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Demo tenant
      const equipment = await storage.getEquipment(tenantId);
      res.json(equipment);
    } catch (error) {
      console.error("Error fetching equipment:", error);
      res.status(500).json({ message: "Failed to fetch equipment" });
    }
  });

  // Inventory routes
  app.get('/api/inventory', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Demo tenant
      const inventory = await storage.getInventoryItems(tenantId);
      res.json(inventory);
    } catch (error) {
      console.error("Error fetching inventory:", error);
      res.status(500).json({ message: "Failed to fetch inventory" });
    }
  });

  // Technician routes
  app.get('/api/technicians', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Demo tenant
      const technicians = await storage.getTechnicians(tenantId);
      res.json(technicians);
    } catch (error) {
      console.error("Error fetching technicians:", error);
      res.status(500).json({ message: "Failed to fetch technicians" });
    }
  });

  // Meter Billing Routes
  
  // Get all meter readings
  app.get("/api/meter-readings", async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Demo tenant
      const readings = await storage.getMeterReadings(tenantId);
      res.json(readings);
    } catch (error) {
      console.error("Failed to get meter readings:", error);
      res.status(500).json({ error: "Failed to get meter readings" });
    }
  });

  // Get meter readings for specific equipment
  app.get("/api/meter-readings/equipment/:equipmentId", async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Demo tenant
      const { equipmentId } = req.params;
      const readings = await storage.getMeterReadingsByEquipment(equipmentId, tenantId);
      res.json(readings);
    } catch (error) {
      console.error("Failed to get equipment meter readings:", error);
      res.status(500).json({ error: "Failed to get equipment meter readings" });
    }
  });

  // Create new meter reading
  app.post("/api/meter-readings", async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Demo tenant
      const userId = "demo-user-123"; // Demo user

      const validatedData = insertMeterReadingSchema.parse({
        ...req.body,
        tenantId,
        createdBy: userId,
      });

      const reading = await storage.createMeterReading(validatedData);
      res.json(reading);
    } catch (error) {
      console.error("Failed to create meter reading:", error);
      res.status(500).json({ error: "Failed to create meter reading" });
    }
  });

  // Calculate billing for a meter reading
  app.post("/api/meter-readings/:readingId/calculate-billing", async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Demo tenant
      const { readingId } = req.params;
      const { contractId } = req.body;

      const calculation = await storage.calculateMeterBilling(contractId, readingId, tenantId);
      res.json(calculation);
    } catch (error) {
      console.error("Failed to calculate billing:", error);
      res.status(500).json({ error: "Failed to calculate billing" });
    }
  });

  // Invoice Routes
  
  // Get all invoices
  app.get("/api/invoices", async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Demo tenant
      const invoices = await storage.getInvoices(tenantId);
      res.json(invoices);
    } catch (error) {
      console.error("Failed to get invoices:", error);
      res.status(500).json({ error: "Failed to get invoices" });
    }
  });

  // Get specific invoice with line items
  app.get("/api/invoices/:id", async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Demo tenant
      const { id } = req.params;
      const invoice = await storage.getInvoice(id, tenantId);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      const lineItems = await storage.getInvoiceLineItems(id, tenantId);
      res.json({ ...invoice, lineItems });
    } catch (error) {
      console.error("Failed to get invoice:", error);
      res.status(500).json({ error: "Failed to get invoice" });
    }
  });

  // Create invoice from meter readings
  app.post("/api/invoices/generate", async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Demo tenant
      const { contractId, billingPeriodStart, billingPeriodEnd } = req.body;

      const invoice = await storage.generateInvoiceFromMeterReadings(
        contractId,
        new Date(billingPeriodStart),
        new Date(billingPeriodEnd),
        tenantId
      );

      res.json(invoice);
    } catch (error) {
      console.error("Failed to generate invoice:", error);
      res.status(500).json({ error: "Failed to generate invoice" });
    }
  });

  // Update invoice status
  app.patch("/api/invoices/:id", async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Demo tenant
      const { id } = req.params;
      const updateData = req.body;

      // Handle paid status updates
      if (updateData.status === 'paid' && !updateData.paidDate) {
        updateData.paidDate = new Date();
      }

      const invoice = await storage.updateInvoice(id, updateData, tenantId);
      res.json(invoice);
    } catch (error) {
      console.error("Failed to update invoice:", error);
      res.status(500).json({ error: "Failed to update invoice" });
    }
  });

  // Enhanced Service Dispatch Routes
  
  // Auto-assign technician based on skills and availability
  app.post("/api/service-tickets/:id/assign", async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Demo tenant
      const { id } = req.params;
      const { technicianId, scheduledDate } = req.body;

      const ticket = await storage.assignTicketToTechnician(
        id, 
        technicianId, 
        new Date(scheduledDate), 
        tenantId
      );
      res.json(ticket);
    } catch (error) {
      console.error("Failed to assign technician:", error);
      res.status(500).json({ error: "Failed to assign technician" });
    }
  });

  // Find optimal technician for a ticket
  app.post("/api/service-tickets/:id/find-technician", async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Demo tenant
      const { requiredSkills, scheduledDate } = req.body;

      const technician = await storage.findOptimalTechnician(
        requiredSkills,
        new Date(scheduledDate),
        tenantId
      );
      res.json(technician);
    } catch (error) {
      console.error("Failed to find optimal technician:", error);
      res.status(500).json({ error: "Failed to find optimal technician" });
    }
  });

  // Get service ticket timeline/updates
  app.get("/api/service-tickets/:id/updates", async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Demo tenant
      const { id } = req.params;

      const updates = await storage.getServiceTicketUpdates(id, tenantId);
      res.json(updates);
    } catch (error) {
      console.error("Failed to get ticket updates:", error);
      res.status(500).json({ error: "Failed to get ticket updates" });
    }
  });

  // Enhanced CRM Routes

  // Leads management
  app.get("/api/leads", async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Demo tenant
      const leads = await storage.getLeads(tenantId);
      res.json(leads);
    } catch (error) {
      console.error("Failed to get leads:", error);
      res.status(500).json({ error: "Failed to get leads" });
    }
  });

  app.get("/api/leads/:id", async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Demo tenant
      const { id } = req.params;
      const lead = await storage.getLead(id, tenantId);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      res.json(lead);
    } catch (error) {
      console.error("Failed to get lead:", error);
      res.status(500).json({ error: "Failed to get lead" });
    }
  });

  app.post("/api/leads", async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Demo tenant
      const leadData = { ...req.body, tenantId, createdBy: "demo-user-123" };
      const lead = await storage.createLead(leadData);
      res.status(201).json(lead);
    } catch (error) {
      console.error("Failed to create lead:", error);
      res.status(500).json({ error: "Failed to create lead" });
    }
  });

  app.patch("/api/leads/:id", async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Demo tenant
      const { id } = req.params;
      const updateData = req.body;
      const lead = await storage.updateLead(id, updateData, tenantId);
      res.json(lead);
    } catch (error) {
      console.error("Failed to update lead:", error);
      res.status(500).json({ error: "Failed to update lead" });
    }
  });

  // Quotes management
  app.get("/api/quotes", async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Demo tenant
      const quotes = await storage.getQuotes(tenantId);
      res.json(quotes);
    } catch (error) {
      console.error("Failed to get quotes:", error);
      res.status(500).json({ error: "Failed to get quotes" });
    }
  });

  app.post("/api/quotes", async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Demo tenant
      const quoteData = { ...req.body, tenantId, createdBy: "demo-user-123" };
      const quote = await storage.createQuote(quoteData);
      res.status(201).json(quote);
    } catch (error) {
      console.error("Failed to create quote:", error);
      res.status(500).json({ error: "Failed to create quote" });
    }
  });

  // Customer interactions management
  app.get("/api/customer-interactions", async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Demo tenant
      const interactions = await storage.getCustomerInteractions(tenantId);
      res.json(interactions);
    } catch (error) {
      console.error("Failed to get customer interactions:", error);
      res.status(500).json({ error: "Failed to get customer interactions" });
    }
  });

  app.post("/api/customer-interactions", async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Demo tenant
      const interactionData = { ...req.body, tenantId, createdBy: "demo-user-123" };
      const interaction = await storage.createCustomerInteraction(interactionData);
      res.status(201).json(interaction);
    } catch (error) {
      console.error("Failed to create customer interaction:", error);
      res.status(500).json({ error: "Failed to create customer interaction" });
    }
  });

  // Customer contacts management
  app.get("/api/customer-contacts", async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Demo tenant
      const { customerId } = req.query;
      const contacts = await storage.getCustomerContacts(tenantId, customerId as string);
      res.json(contacts);
    } catch (error) {
      console.error("Failed to get customer contacts:", error);
      res.status(500).json({ error: "Failed to get customer contacts" });
    }
  });

  app.post("/api/customer-contacts", async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Demo tenant
      const contactData = { ...req.body, tenantId };
      const contact = await storage.createCustomerContact(contactData);
      res.status(201).json(contact);
    } catch (error) {
      console.error("Failed to create customer contact:", error);
      res.status(500).json({ error: "Failed to create customer contact" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
