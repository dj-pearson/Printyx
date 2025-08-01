import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { authRoutes } from "./auth-routes";
import {
  insertCustomerSchema,
  insertLeadSchema,
  insertLeadActivitySchema,
  insertLeadContactSchema,
  insertQuoteSchema,
  insertEquipmentSchema,
  insertContractSchema,
  insertServiceTicketSchema,
  insertInventoryItemSchema,
  insertTechnicianSchema,
  insertMeterReadingSchema,
  insertInvoiceSchema,
  insertProductModelSchema,
  insertProductAccessorySchema,
  insertCpcRateSchema,
  insertProfessionalServiceSchema,
  insertServiceProductSchema,
  insertSoftwareProductSchema,
  insertSupplySchema,
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup session management
  const pgStore = connectPg(session);
  app.use(session({
    store: new pgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: false, // Don't recreate tables - use existing schema
      tableName: 'sessions'
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

  // Dashboard routes - using demo tenant
  app.get('/api/dashboard/metrics', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      
      // Mock dashboard metrics for demo
      const metrics = {
        totalCustomers: 247,
        activeContracts: 189,
        monthlyRevenue: 127500,
        openTickets: 23,
        recentGrowth: 12.5
      };
      
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ message: "Failed to fetch dashboard metrics" });
    }
  });

  app.get('/api/dashboard/recent-tickets', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      
      // Mock recent tickets for demo
      const tickets = [
        {
          id: "1",
          title: "Printer Jam Issue",
          status: "open",
          priority: "medium",
          customer: "ABC Corp",
          createdAt: new Date()
        },
        {
          id: "2", 
          title: "Toner Replacement",
          status: "in_progress",
          priority: "low",
          customer: "XYZ Industries",
          createdAt: new Date()
        }
      ];
      
      res.json(tickets);
    } catch (error) {
      console.error("Error fetching recent tickets:", error);
      res.status(500).json({ message: "Failed to fetch recent tickets" });
    }
  });

  app.get('/api/dashboard/top-customers', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      
      // Mock top customers for demo
      const customers = [
        {
          id: "1",
          name: "TechCorp Solutions",
          accountValue: 25000,
          contractsCount: 5
        },
        {
          id: "2",
          name: "Global Industries",
          accountValue: 18500,
          contractsCount: 3
        }
      ];
      
      res.json(customers);
    } catch (error) {
      console.error("Error fetching top customers:", error);
      res.status(500).json({ message: "Failed to fetch top customers" });
    }
  });

  // Customer routes
  app.get('/api/customers', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const customers = await storage.getCustomers(tenantId);
      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  app.post('/api/customers', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      
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

  // Enhanced Lead management routes
  app.get('/api/leads', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const leads = await storage.getLeads(tenantId);
      res.json(leads);
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  app.get('/api/leads/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const lead = await storage.getLead(id, tenantId);
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      res.json(lead);
    } catch (error) {
      console.error("Error fetching lead:", error);
      res.status(500).json({ message: "Failed to fetch lead" });
    }
  });

  app.post('/api/leads', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const validatedData = insertLeadSchema.parse({
        ...req.body,
        tenantId: tenantId,
        createdBy: "demo-user"
      });
      const lead = await storage.createLead(validatedData);
      res.json(lead);
    } catch (error) {
      console.error("Error creating lead:", error);
      res.status(500).json({ message: "Failed to create lead" });
    }
  });

  app.put('/api/leads/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const updatedLead = await storage.updateLead(id, req.body, tenantId);
      if (!updatedLead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      res.json(updatedLead);
    } catch (error) {
      console.error("Error updating lead:", error);
      res.status(500).json({ message: "Failed to update lead" });
    }
  });

  // Convert lead to customer
  app.post('/api/leads/:id/convert', async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const customer = await storage.convertLeadToCustomer(id, tenantId);
      res.json(customer);
    } catch (error) {
      console.error("Error converting lead:", error);
      res.status(500).json({ message: "Failed to convert lead to customer" });
    }
  });

  // Lead activities
  app.get('/api/leads/:id/activities', async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const activities = await storage.getLeadActivities(id, tenantId);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching lead activities:", error);
      res.status(500).json({ message: "Failed to fetch lead activities" });
    }
  });

  app.post('/api/leads/:id/activities', async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const activityData = { 
        ...req.body, 
        leadId: id, 
        tenantId, 
        createdBy: "demo-user"
      };
      const activity = await storage.createLeadActivity(activityData);
      res.json(activity);
    } catch (error) {
      console.error("Error creating lead activity:", error);
      res.status(500).json({ message: "Failed to create lead activity" });
    }
  });

  // Lead contacts
  app.get('/api/leads/:id/contacts', async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const contacts = await storage.getLeadContacts(id, tenantId);
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching lead contacts:", error);
      res.status(500).json({ message: "Failed to fetch lead contacts" });
    }
  });

  app.post('/api/leads/:id/contacts', async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const contactData = { 
        ...req.body, 
        leadId: id, 
        tenantId
      };
      const contact = await storage.createLeadContact(contactData);
      res.json(contact);
    } catch (error) {
      console.error("Error creating lead contact:", error);
      res.status(500).json({ message: "Failed to create lead contact" });
    }
  });

  // Lead related records
  app.get('/api/leads/:id/related-records', async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const records = await storage.getLeadRelatedRecords(id, tenantId);
      res.json(records);
    } catch (error) {
      console.error("Error fetching lead related records:", error);
      res.status(500).json({ message: "Failed to fetch lead related records" });
    }
  });

  // Product Management Routes
  
  // Product Models
  app.get('/api/product-models', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const models = await storage.getProductModels(tenantId);
      res.json(models);
    } catch (error) {
      console.error("Error fetching product models:", error);
      res.status(500).json({ message: "Failed to fetch product models" });
    }
  });

  app.get('/api/product-models/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const model = await storage.getProductModel(id, tenantId);
      if (!model) {
        return res.status(404).json({ message: "Product model not found" });
      }
      res.json(model);
    } catch (error) {
      console.error("Error fetching product model:", error);
      res.status(500).json({ message: "Failed to fetch product model" });
    }
  });

  app.post('/api/product-models', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const validatedData = insertProductModelSchema.parse({ ...req.body, tenantId });
      const model = await storage.createProductModel(validatedData);
      res.json(model);
    } catch (error) {
      console.error("Error creating product model:", error);
      res.status(500).json({ message: "Failed to create product model" });
    }
  });

  app.patch('/api/product-models/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const model = await storage.updateProductModel(id, req.body, tenantId);
      if (!model) {
        return res.status(404).json({ message: "Product model not found" });
      }
      res.json(model);
    } catch (error) {
      console.error("Error updating product model:", error);
      res.status(500).json({ message: "Failed to update product model" });
    }
  });

  // Product Accessories
  app.get('/api/product-accessories', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const accessories = await storage.getAllProductAccessories(tenantId);
      res.json(accessories);
    } catch (error) {
      console.error("Error fetching product accessories:", error);
      res.status(500).json({ message: "Failed to fetch product accessories" });
    }
  });

  app.get('/api/product-models/:modelId/accessories', async (req: any, res) => {
    try {
      const { modelId } = req.params;
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const accessories = await storage.getProductAccessories(modelId, tenantId);
      res.json(accessories);
    } catch (error) {
      console.error("Error fetching product accessories:", error);
      res.status(500).json({ message: "Failed to fetch product accessories" });
    }
  });

  app.post('/api/product-accessories', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const validatedData = insertProductAccessorySchema.parse({ 
        ...req.body, 
        tenantId 
      });
      const accessory = await storage.createProductAccessory(validatedData);
      res.json(accessory);
    } catch (error) {
      console.error("Error creating product accessory:", error);
      res.status(500).json({ message: "Failed to create product accessory" });
    }
  });

  app.post('/api/product-models/:modelId/accessories', async (req: any, res) => {
    try {
      const { modelId } = req.params;
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const validatedData = insertProductAccessorySchema.parse({ 
        ...req.body, 
        modelId, 
        tenantId 
      });
      const accessory = await storage.createProductAccessory(validatedData);
      res.json(accessory);
    } catch (error) {
      console.error("Error creating product accessory:", error);
      res.status(500).json({ message: "Failed to create product accessory" });
    }
  });

  // Professional Services
  app.get('/api/professional-services', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const services = await storage.getAllProfessionalServices(tenantId);
      res.json(services);
    } catch (error) {
      console.error("Error fetching professional services:", error);
      res.status(500).json({ message: "Failed to fetch professional services" });
    }
  });

  app.post('/api/professional-services', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const validatedData = insertProfessionalServiceSchema.parse({ 
        ...req.body, 
        tenantId 
      });
      const service = await storage.createProfessionalService(validatedData);
      res.json(service);
    } catch (error) {
      console.error("Error creating professional service:", error);
      res.status(500).json({ message: "Failed to create professional service" });
    }
  });

  // Service Products
  app.get('/api/service-products', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const services = await storage.getAllServiceProducts(tenantId);
      res.json(services);
    } catch (error) {
      console.error("Error fetching service products:", error);
      res.status(500).json({ message: "Failed to fetch service products" });
    }
  });

  app.post('/api/service-products', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const validatedData = insertServiceProductSchema.parse({ 
        ...req.body, 
        tenantId 
      });
      const service = await storage.createServiceProduct(validatedData);
      res.json(service);
    } catch (error) {
      console.error("Error creating service product:", error);
      res.status(500).json({ message: "Failed to create service product" });
    }
  });

  // Software Products
  app.get('/api/software-products', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const products = await storage.getAllSoftwareProducts(tenantId);
      res.json(products);
    } catch (error) {
      console.error("Error fetching software products:", error);
      res.status(500).json({ message: "Failed to fetch software products" });
    }
  });

  app.post('/api/software-products', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const validatedData = insertSoftwareProductSchema.parse({ 
        ...req.body, 
        tenantId 
      });
      const product = await storage.createSoftwareProduct(validatedData);
      res.json(product);
    } catch (error) {
      console.error("Error creating software product:", error);
      res.status(500).json({ message: "Failed to create software product" });
    }
  });

  // Supplies
  app.get('/api/supplies', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const supplies = await storage.getAllSupplies(tenantId);
      res.json(supplies);
    } catch (error) {
      console.error("Error fetching supplies:", error);
      res.status(500).json({ message: "Failed to fetch supplies" });
    }
  });

  app.post('/api/supplies', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const validatedData = insertSupplySchema.parse({ 
        ...req.body, 
        tenantId 
      });
      const supply = await storage.createSupply(validatedData);
      res.json(supply);
    } catch (error) {
      console.error("Error creating supply:", error);
      res.status(500).json({ message: "Failed to create supply" });
    }
  });

  // CPC Rates
  app.get('/api/product-models/:modelId/cpc-rates', async (req: any, res) => {
    try {
      const { modelId } = req.params;
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const rates = await storage.getCpcRates(modelId, tenantId);
      res.json(rates);
    } catch (error) {
      console.error("Error fetching CPC rates:", error);
      res.status(500).json({ message: "Failed to fetch CPC rates" });
    }
  });

  app.post('/api/product-models/:modelId/cpc-rates', async (req: any, res) => {
    try {
      const { modelId } = req.params;
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const validatedData = insertCpcRateSchema.parse({ 
        ...req.body, 
        modelId, 
        tenantId 
      });
      const rate = await storage.createCpcRate(validatedData);
      res.json(rate);
    } catch (error) {
      console.error("Error creating CPC rate:", error);
      res.status(500).json({ message: "Failed to create CPC rate" });
    }
  });

  // Simple health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  const httpServer = createServer(app);
  return httpServer;
}