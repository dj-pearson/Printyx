import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { authRoutes } from "./auth-routes";
import {
  insertCustomerSchema,
  insertCompanySchema,
  insertCompanyContactSchema,
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
  insertManagedServiceSchema,
  insertContractTieredRateSchema,
  insertDealSchema,
  insertDealStageSchema,
  insertDealActivitySchema,
} from "@shared/schema";
import multer from "multer";
import csv from "csv-parser";
import { Readable } from "stream";
import { format } from "date-fns";
import { registerMobileRoutes } from "./routes-mobile";
import { registerIntegrationRoutes } from "./routes-integrations";
import { registerTaskRoutes } from "./routes-tasks";
import { registerPurchaseOrderRoutes } from "./routes-purchase-orders";

// Basic authentication middleware
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  // Add user context for backwards compatibility
  req.user = {
    id: req.session.userId,
    tenantId: req.session.tenantId || "550e8400-e29b-41d4-a716-446655440000" // Default tenant for now
  };
  
  next();
};

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// Helper function to parse CSV from buffer
function parseCSV(buffer: Buffer): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    const stream = Readable.from(buffer.toString());
    
    stream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

// Helper function to calculate tiered billing amounts
function calculateTieredAmount(totalCopies: number, tieredRates: any[], baseRate: number): number {
  if (!tieredRates || tieredRates.length === 0) {
    return totalCopies * baseRate;
  }

  let remainingCopies = totalCopies;
  let totalAmount = 0;

  for (let i = 0; i < tieredRates.length; i++) {
    const currentTier = tieredRates[i];
    const nextTier = tieredRates[i + 1];
    
    const tierMin = currentTier.minimumVolume;
    const tierMax = nextTier ? nextTier.minimumVolume : Infinity;
    const tierRate = parseFloat(currentTier.rate.toString());
    
    if (totalCopies > tierMin) {
      const copiesInTier = Math.min(remainingCopies, tierMax - tierMin);
      totalAmount += copiesInTier * tierRate;
      remainingCopies -= copiesInTier;
      
      if (remainingCopies <= 0) break;
    }
  }

  // If there are remaining copies not covered by tiers, use base rate
  if (remainingCopies > 0) {
    totalAmount += remainingCopies * baseRate;
  }

  return totalAmount;
}

// Helper function to validate and transform product model data
function validateProductModelData(row: any): any {
  const errors: string[] = [];
  
  if (!row['Product Code']) errors.push('Product Code is required');
  if (!row['Product Name']) errors.push('Product Name is required');
  
  return {
    isValid: errors.length === 0,
    errors,
    data: {
      productCode: row['Product Code']?.trim(),
      productName: row['Product Name']?.trim(),
      manufacturer: row['Manufacturer']?.trim() || null,
      model: row['Model']?.trim() || null,
      description: row['Description']?.trim() || null,
      category: row['Category']?.trim() || null,
      colorPrint: row['Color Print']?.toLowerCase() === 'yes',
      bwPrint: row['BW Print']?.toLowerCase() === 'yes',
      colorCopy: row['Color Copy']?.toLowerCase() === 'yes',
      bwCopy: row['BW Copy']?.toLowerCase() === 'yes',
      standardCost: row['Standard Cost'] ? parseFloat(row['Standard Cost']) : null,
      standardRepPrice: row['Standard Rep Price'] ? parseFloat(row['Standard Rep Price']) : null,
      newCost: row['New Cost'] ? parseFloat(row['New Cost']) : null,
      newRepPrice: row['New Rep Price'] ? parseFloat(row['New Rep Price']) : null,
      upgradeCost: row['Upgrade Cost'] ? parseFloat(row['Upgrade Cost']) : null,
      upgradeRepPrice: row['Upgrade Rep Price'] ? parseFloat(row['Upgrade Rep Price']) : null,
      isActive: true,
      availableForAll: false,
      salesRepCredit: true,
      funding: true,
    }
  };
}

// Helper function to validate and transform supply data
function validateSupplyData(row: any): any {
  const errors: string[] = [];
  
  if (!row['Product Code']) errors.push('Product Code is required');
  if (!row['Product Name']) errors.push('Product Name is required');
  
  return {
    isValid: errors.length === 0,
    errors,
    data: {
      productCode: row['Product Code']?.trim(),
      productName: row['Product Name']?.trim(),
      productType: row['Product Type']?.trim() || 'Supplies',
      dealerComp: row['Dealer Comp']?.trim() || null,
      inventory: row['Inventory']?.trim() || null,
      inStock: row['In Stock']?.trim() || null,
      description: row['Description']?.trim() || null,
      newRepPrice: row['New Rep Price'] ? parseFloat(row['New Rep Price']) : null,
      upgradeRepPrice: row['Upgrade Rep Price'] ? parseFloat(row['Upgrade Rep Price']) : null,
      lexmarkRepPrice: row['Lexmark Rep Price'] ? parseFloat(row['Lexmark Rep Price']) : null,
      graphicRepPrice: row['Graphic Rep Price'] ? parseFloat(row['Graphic Rep Price']) : null,
      newActive: !!row['New Rep Price'],
      upgradeActive: !!row['Upgrade Rep Price'],
      lexmarkActive: !!row['Lexmark Rep Price'],
      graphicActive: !!row['Graphic Rep Price'],
      isActive: true,
      salesRepCredit: true,
      funding: true,
    }
  };
}

// Helper function to validate and transform managed service data
function validateManagedServiceData(row: any): any {
  const errors: string[] = [];
  
  if (!row['Product Code']) errors.push('Product Code is required');
  if (!row['Product Name']) errors.push('Product Name is required');
  
  return {
    isValid: errors.length === 0,
    errors,
    data: {
      productCode: row['Product Code']?.trim(),
      productName: row['Product Name']?.trim(),
      category: 'IT Services',
      serviceType: row['Service Type']?.trim() || null,
      serviceLevel: row['Service Level']?.trim() || null,
      supportHours: row['Support Hours']?.trim() || null,
      responseTime: row['Response Time']?.trim() || null,
      remoteMgmt: row['Remote Management']?.toLowerCase() === 'yes',
      onsiteSupport: row['Onsite Support']?.toLowerCase() === 'yes',
      includesHardware: false,
      description: row['Description']?.trim() || null,
      newRepPrice: row['New Rep Price'] ? parseFloat(row['New Rep Price']) : null,
      upgradeRepPrice: row['Upgrade Rep Price'] ? parseFloat(row['Upgrade Rep Price']) : null,
      lexmarkRepPrice: row['Lexmark Rep Price'] ? parseFloat(row['Lexmark Rep Price']) : null,
      graphicRepPrice: row['Graphic Rep Price'] ? parseFloat(row['Graphic Rep Price']) : null,
      newActive: !!row['New Rep Price'],
      upgradeActive: !!row['Upgrade Rep Price'],
      lexmarkActive: !!row['Lexmark Rep Price'],
      graphicActive: !!row['Graphic Rep Price'],
      isActive: true,
      salesRepCredit: true,
      funding: true,
    }
  };
}

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

  // Tenants route for platform users
  app.get("/api/tenants", requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUserWithRole(req.session.userId);
      

      
      // Only platform admin roles can access all tenants
      if (!user?.role?.canAccessAllTenants) {
        return res.status(403).json({ message: "Access denied" });
      }

      const tenants = await storage.getAllTenants();
      res.json(tenants);
    } catch (error) {
      console.error("Error fetching tenants:", error);
      res.status(500).json({ message: "Failed to fetch tenants" });
    }
  });

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

  // Company management routes (new primary business entity)
  app.get('/api/companies', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const companies = await storage.getCompanies(tenantId);
      res.json(companies);
    } catch (error) {
      console.error("Error fetching companies:", error);
      res.status(500).json({ message: "Failed to fetch companies" });
    }
  });

  app.get('/api/companies/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const company = await storage.getCompany(id, tenantId);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      res.json(company);
    } catch (error) {
      console.error("Error fetching company:", error);
      res.status(500).json({ message: "Failed to fetch company" });
    }
  });

  app.post('/api/companies', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const validatedData = insertCompanySchema.parse({
        ...req.body,
        tenantId: tenantId,
      });
      const company = await storage.createCompany(validatedData);
      res.status(201).json(company);
    } catch (error) {
      console.error("Error creating company:", error);
      res.status(500).json({ message: "Failed to create company" });
    }
  });

  app.put('/api/companies/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const updatedCompany = await storage.updateCompany(id, req.body, tenantId);
      if (!updatedCompany) {
        return res.status(404).json({ message: "Company not found" });
      }
      res.json(updatedCompany);
    } catch (error) {
      console.error("Error updating company:", error);
      res.status(500).json({ message: "Failed to update company" });
    }
  });

  // Company contact routes
  app.get('/api/companies/:companyId/contacts', async (req: any, res) => {
    try {
      const { companyId } = req.params;
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const contacts = await storage.getCompanyContacts(companyId, tenantId);
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching company contacts:", error);
      res.status(500).json({ message: "Failed to fetch company contacts" });
    }
  });

  app.post('/api/companies/:companyId/contacts', async (req: any, res) => {
    try {
      const { companyId } = req.params;
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const validatedData = insertCompanyContactSchema.parse({
        ...req.body,
        tenantId: tenantId,
        companyId: companyId,
      });
      const contact = await storage.createCompanyContact(validatedData);
      res.status(201).json(contact);
    } catch (error) {
      console.error("Error creating company contact:", error);
      res.status(500).json({ message: "Failed to create company contact" });
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

  // Managed Services
  app.get('/api/managed-services', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const services = await storage.getAllManagedServices(tenantId);
      res.json(services);
    } catch (error) {
      console.error("Error fetching managed services:", error);
      res.status(500).json({ message: "Failed to fetch managed services" });
    }
  });

  app.post('/api/managed-services', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const validatedData = insertManagedServiceSchema.parse({ 
        ...req.body, 
        tenantId 
      });
      const service = await storage.createManagedService(validatedData);
      res.json(service);
    } catch (error) {
      console.error("Error creating managed service:", error);
      res.status(500).json({ message: "Failed to create managed service" });
    }
  });

  // ============= ACCOUNTING API ROUTES =============
  
  // Vendors Management
  app.get("/api/vendors", requireAuth, async (req, res) => {
    try {
      const { tenantId } = req.user;
      const vendors = await storage.getVendors(tenantId);
      res.json(vendors);
    } catch (error) {
      console.error("Error fetching vendors:", error);
      res.status(500).json({ message: "Failed to fetch vendors" });
    }
  });

  app.get("/api/vendors/:id", requireAuth, async (req, res) => {
    try {
      const { tenantId } = req.user;
      const { id } = req.params;
      const vendor = await storage.getVendor(id, tenantId);
      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }
      res.json(vendor);
    } catch (error) {
      console.error("Error fetching vendor:", error);
      res.status(500).json({ message: "Failed to fetch vendor" });
    }
  });

  app.post("/api/vendors", requireAuth, async (req, res) => {
    try {
      const { tenantId } = req.user;
      const vendorData = { ...req.body, tenantId };
      const newVendor = await storage.createVendor(vendorData);
      res.status(201).json(newVendor);
    } catch (error) {
      console.error("Error creating vendor:", error);
      res.status(500).json({ message: "Failed to create vendor" });
    }
  });

  app.patch("/api/vendors/:id", requireAuth, async (req, res) => {
    try {
      const { tenantId } = req.user;
      const { id } = req.params;
      const updatedVendor = await storage.updateVendor(id, req.body, tenantId);
      if (!updatedVendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }
      res.json(updatedVendor);
    } catch (error) {
      console.error("Error updating vendor:", error);
      res.status(500).json({ message: "Failed to update vendor" });
    }
  });

  app.delete("/api/vendors/:id", requireAuth, async (req, res) => {
    try {
      const { tenantId } = req.user;
      const { id } = req.params;
      const success = await storage.deleteVendor(id, tenantId);
      if (success) {
        res.json({ message: "Vendor deleted successfully" });
      } else {
        res.status(404).json({ message: "Vendor not found" });
      }
    } catch (error) {
      console.error("Error deleting vendor:", error);
      res.status(500).json({ message: "Failed to delete vendor" });
    }
  });

  // Accounts Payable Management
  app.get("/api/accounts-payable", requireAuth, async (req, res) => {
    try {
      const { tenantId } = req.user;
      const accountsPayable = await storage.getAccountsPayable(tenantId);
      res.json(accountsPayable);
    } catch (error) {
      console.error("Error fetching accounts payable:", error);
      res.status(500).json({ message: "Failed to fetch accounts payable" });
    }
  });

  app.post("/api/accounts-payable", requireAuth, async (req, res) => {
    try {
      const { tenantId, id: userId } = req.user;
      const apData = { ...req.body, tenantId, createdBy: userId };
      const newAP = await storage.createAccountsPayable(apData);
      res.status(201).json(newAP);
    } catch (error) {
      console.error("Error creating account payable:", error);
      res.status(500).json({ message: "Failed to create account payable" });
    }
  });

  // Accounts Receivable Management
  app.get("/api/accounts-receivable", requireAuth, async (req, res) => {
    try {
      const { tenantId } = req.user;
      const accountsReceivable = await storage.getAccountsReceivable(tenantId);
      res.json(accountsReceivable);
    } catch (error) {
      console.error("Error fetching accounts receivable:", error);
      res.status(500).json({ message: "Failed to fetch accounts receivable" });
    }
  });

  app.post("/api/accounts-receivable", requireAuth, async (req, res) => {
    try {
      const { tenantId, id: userId } = req.user;
      const arData = { ...req.body, tenantId, createdBy: userId };
      const newAR = await storage.createAccountsReceivable(arData);
      res.status(201).json(newAR);
    } catch (error) {
      console.error("Error creating account receivable:", error);
      res.status(500).json({ message: "Failed to create account receivable" });
    }
  });

  // Chart of Accounts Management
  app.get("/api/chart-of-accounts", requireAuth, async (req, res) => {
    try {
      const { tenantId } = req.user;
      const accounts = await storage.getChartOfAccounts(tenantId);
      res.json(accounts);
    } catch (error) {
      console.error("Error fetching chart of accounts:", error);
      res.status(500).json({ message: "Failed to fetch chart of accounts" });
    }
  });

  app.post("/api/chart-of-accounts", requireAuth, async (req, res) => {
    try {
      const { tenantId } = req.user;
      const accountData = { ...req.body, tenantId };
      const newAccount = await storage.createChartOfAccount(accountData);
      res.status(201).json(newAccount);
    } catch (error) {
      console.error("Error creating account:", error);
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  // Journal Entries Management
  app.get("/api/journal-entries", requireAuth, async (req, res) => {
    try {
      const { tenantId } = req.user;
      const entries = await storage.getJournalEntries(tenantId);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching journal entries:", error);
      res.status(500).json({ message: "Failed to fetch journal entries" });
    }
  });

  app.get("/api/journal-entries/:id", requireAuth, async (req, res) => {
    try {
      const { tenantId } = req.user;
      const { id } = req.params;
      const entry = await storage.getJournalEntry(id, tenantId);
      if (!entry) {
        return res.status(404).json({ message: "Journal entry not found" });
      }
      res.json(entry);
    } catch (error) {
      console.error("Error fetching journal entry:", error);
      res.status(500).json({ message: "Failed to fetch journal entry" });
    }
  });

  app.post("/api/journal-entries", requireAuth, async (req, res) => {
    try {
      const { tenantId, id: userId } = req.user;
      const entryData = { ...req.body, tenantId, createdBy: userId };
      const newEntry = await storage.createJournalEntry(entryData);
      res.status(201).json(newEntry);
    } catch (error) {
      console.error("Error creating journal entry:", error);
      res.status(500).json({ message: "Failed to create journal entry" });
    }
  });

  app.patch("/api/journal-entries/:id", requireAuth, async (req, res) => {
    try {
      const { tenantId } = req.user;
      const { id } = req.params;
      const updateData = { ...req.body, updatedAt: new Date() };
      const updatedEntry = await storage.updateJournalEntry(id, updateData, tenantId);
      if (!updatedEntry) {
        return res.status(404).json({ message: "Journal entry not found" });
      }
      res.json(updatedEntry);
    } catch (error) {
      console.error("Error updating journal entry:", error);
      res.status(500).json({ message: "Failed to update journal entry" });
    }
  });

  app.delete("/api/journal-entries/:id", requireAuth, async (req, res) => {
    try {
      const { tenantId } = req.user;
      const { id } = req.params;
      const success = await storage.deleteJournalEntry(id, tenantId);
      if (!success) {
        return res.status(404).json({ message: "Journal entry not found" });
      }
      res.json({ message: "Journal entry deleted successfully" });
    } catch (error) {
      console.error("Error deleting journal entry:", error);
      res.status(500).json({ message: "Failed to delete journal entry" });
    }
  });

  // Purchase Orders Management
  app.get("/api/purchase-orders", requireAuth, async (req, res) => {
    try {
      const { tenantId } = req.user;
      const purchaseOrders = await storage.getPurchaseOrders(tenantId);
      res.json(purchaseOrders);
    } catch (error) {
      console.error("Error fetching purchase orders:", error);
      res.status(500).json({ message: "Failed to fetch purchase orders" });
    }
  });

  app.post("/api/purchase-orders", requireAuth, async (req, res) => {
    try {
      const { tenantId, id: userId } = req.user;
      const poData = { ...req.body, tenantId, createdBy: userId };
      const newPO = await storage.createPurchaseOrder(poData);
      res.status(201).json(newPO);
    } catch (error) {
      console.error("Error creating purchase order:", error);
      res.status(500).json({ message: "Failed to create purchase order" });
    }
  });

  // Company contacts endpoints
  app.post("/api/companies/:companyId/contacts", async (req: any, res) => {
    try {
      const { companyId } = req.params;
      const { contacts } = req.body;
      
      // Simple session-based authentication check
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user?.tenantId) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!Array.isArray(contacts) || contacts.length === 0) {
        return res.status(400).json({ message: "Contacts array is required" });
      }

      // Create contacts for the company
      const createdContacts = [];
      for (const contactData of contacts) {
        const contact = await storage.createContact({
          ...contactData,
          leadId: companyId, // Using leadId to store companyId for now
          tenantId: user.tenantId,
        });
        createdContacts.push(contact);
      }

      res.json({ 
        message: `${createdContacts.length} contact(s) created successfully`,
        contacts: createdContacts 
      });
    } catch (error) {
      console.error("Error creating company contacts:", error);
      res.status(500).json({ message: "Failed to create contacts" });
    }
  });

  // ============= METER BILLING API ROUTES =============
  
  // Contract Tiered Rates Management
  app.get('/api/contract-tiered-rates', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || "550e8400-e29b-41d4-a716-446655440000";
      const rates = await storage.getContractTieredRates(tenantId);
      res.json(rates);
    } catch (error) {
      console.error("Error fetching contract tiered rates:", error);
      res.status(500).json({ message: "Failed to fetch contract tiered rates" });
    }
  });

  app.post('/api/contract-tiered-rates', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || "550e8400-e29b-41d4-a716-446655440000";
      const validatedData = insertContractTieredRateSchema.parse({ 
        ...req.body, 
        tenantId 
      });
      const rate = await storage.createContractTieredRate(validatedData);
      res.json(rate);
    } catch (error) {
      console.error("Error creating contract tiered rate:", error);
      res.status(500).json({ message: "Failed to create contract tiered rate" });
    }
  });

  // Automated Invoice Generation
  app.post('/api/billing/generate-invoices', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || "550e8400-e29b-41d4-a716-446655440000";
      
      // Get all pending meter readings
      const pendingReadings = await storage.getMeterReadingsByStatus(tenantId, 'pending');
      
      const generatedInvoices = [];
      for (const reading of pendingReadings) {
        try {
          // Calculate billing amounts using tiered rates
          const contract = await storage.getContract(reading.contractId, tenantId);
          if (!contract) continue;

          // Get tiered rates for this contract
          const tieredRates = await storage.getContractTieredRatesByContract(reading.contractId);
          
          let blackAmount = 0;
          let colorAmount = 0;
          
          // Calculate tiered billing for black & white copies
          if (reading.blackCopies && reading.blackCopies > 0) {
            const blackRates = tieredRates.filter(rate => rate.colorType === 'black').sort((a, b) => a.minimumVolume - b.minimumVolume);
            blackAmount = calculateTieredAmount(reading.blackCopies, blackRates, parseFloat(contract.blackRate?.toString() || '0'));
          }
          
          // Calculate tiered billing for color copies
          if (reading.colorCopies && reading.colorCopies > 0) {
            const colorRates = tieredRates.filter(rate => rate.colorType === 'color').sort((a, b) => a.minimumVolume - b.minimumVolume);
            colorAmount = calculateTieredAmount(reading.colorCopies, colorRates, parseFloat(contract.colorRate?.toString() || '0'));
          }
          
          const totalAmount = blackAmount + colorAmount + parseFloat(contract.monthlyBase?.toString() || '0');
          
          // Create invoice
          const invoice = await storage.createInvoice({
            tenantId,
            customerId: contract.customerId,
            contractId: contract.id,
            invoiceNumber: `INV-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            issueDate: new Date(),
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            totalAmount: totalAmount.toString(),
            paidAmount: '0',
            status: 'pending',
            description: `Meter billing for ${format(new Date(reading.readingDate), 'MMMM yyyy')}`,
          });
          
          // Update meter reading billing status
          await storage.updateMeterReading(reading.id, {
            billingStatus: 'processed',
            billingAmount: totalAmount.toString(),
            invoiceId: invoice.id,
          }, tenantId);
          
          generatedInvoices.push(invoice);
        } catch (readingError) {
          console.error(`Error processing reading ${reading.id}:`, readingError);
        }
      }
      
      res.json({ 
        message: `Generated ${generatedInvoices.length} invoices`,
        invoices: generatedInvoices 
      });
    } catch (error) {
      console.error("Error generating invoices:", error);
      res.status(500).json({ message: "Failed to generate invoices" });
    }
  });

  // Contract Profitability Analysis
  app.get('/api/billing/contract-profitability', async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId || "550e8400-e29b-41d4-a716-446655440000";
      
      const contracts = await storage.getContracts(tenantId);
      const invoices = await storage.getInvoices(tenantId);
      
      const profitabilityData = contracts.map(contract => {
        const contractInvoices = invoices.filter(inv => inv.contractId === contract.id);
        const totalRevenue = contractInvoices.reduce((sum, inv) => sum + parseFloat(inv.totalAmount.toString()), 0);
        const totalPaid = contractInvoices.reduce((sum, inv) => sum + parseFloat(inv.paidAmount?.toString() || '0'), 0);
        const equipmentCost = parseFloat(contract.equipmentCost?.toString() || '0');
        const monthlyCosts = parseFloat(contract.monthlyBase?.toString() || '0') * 12; // Assume yearly cost
        
        const totalCosts = equipmentCost + monthlyCosts;
        const grossProfit = totalRevenue - totalCosts;
        const marginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue * 100) : 0;
        
        return {
          contractId: contract.id,
          contractNumber: contract.contractNumber,
          totalRevenue,
          totalPaid,
          totalCosts,
          grossProfit,
          marginPercent,
          invoiceCount: contractInvoices.length,
          averageInvoiceAmount: contractInvoices.length > 0 ? totalRevenue / contractInvoices.length : 0,
        };
      });
      
      res.json(profitabilityData);
    } catch (error) {
      console.error("Error calculating contract profitability:", error);
      res.status(500).json({ message: "Failed to calculate contract profitability" });
    }
  });

  app.get("/api/companies/:companyId/contacts", async (req: any, res) => {
    try {
      const { companyId } = req.params;
      
      // Simple session-based authentication check
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user?.tenantId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const contacts = await storage.getContactsByCompany(companyId, user.tenantId);
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching company contacts:", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  app.put("/api/contacts/:contactId", async (req: any, res) => {
    try {
      const { contactId } = req.params;
      const contactData = req.body;
      
      // Simple session-based authentication check
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user?.tenantId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updatedContact = await storage.updateContact(contactId, {
        ...contactData,
        tenantId: user.tenantId,
        updatedAt: new Date(),
      });

      res.json(updatedContact);
    } catch (error) {
      console.error("Error updating contact:", error);
      res.status(500).json({ message: "Failed to update contact" });
    }
  });

  app.delete("/api/contacts/:contactId", async (req: any, res) => {
    try {
      const { contactId } = req.params;
      
      // Simple session-based authentication check
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user?.tenantId) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteContact(contactId, user.tenantId);
      res.json({ message: "Contact deleted successfully" });
    } catch (error) {
      console.error("Error deleting contact:", error);
      res.status(500).json({ message: "Failed to delete contact" });
    }
  });

  // CSV Import Endpoints
  
  // Product Models Import
  app.post('/api/product-models/import', upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const csvData = await parseCSV(req.file.buffer);
      
      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (let i = 0; i < csvData.length; i++) {
        const row = csvData[i];
        const validation = validateProductModelData(row);
        
        if (!validation.isValid) {
          errors.push(`Row ${i + 2}: ${validation.errors.join(', ')}`);
          skipped++;
          continue;
        }

        try {
          const productData = { ...validation.data, tenantId };
          await storage.createProductModel(productData);
          imported++;
        } catch (error) {
          errors.push(`Row ${i + 2}: Failed to import - ${error instanceof Error ? error.message : 'Unknown error'}`);
          skipped++;
        }
      }

      res.json({
        success: errors.length === 0,
        imported,
        skipped,
        errors,
      });
    } catch (error) {
      console.error("Error importing product models:", error);
      res.status(500).json({ message: "Failed to import product models" });
    }
  });

  // Supplies Import
  app.post('/api/supplies/import', upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const csvData = await parseCSV(req.file.buffer);
      
      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (let i = 0; i < csvData.length; i++) {
        const row = csvData[i];
        const validation = validateSupplyData(row);
        
        if (!validation.isValid) {
          errors.push(`Row ${i + 2}: ${validation.errors.join(', ')}`);
          skipped++;
          continue;
        }

        try {
          const supplyData = { ...validation.data, tenantId };
          await storage.createSupply(supplyData);
          imported++;
        } catch (error) {
          errors.push(`Row ${i + 2}: Failed to import - ${error instanceof Error ? error.message : 'Unknown error'}`);
          skipped++;
        }
      }

      res.json({
        success: errors.length === 0,
        imported,
        skipped,
        errors,
      });
    } catch (error) {
      console.error("Error importing supplies:", error);
      res.status(500).json({ message: "Failed to import supplies" });
    }
  });

  // Managed Services Import
  app.post('/api/managed-services/import', upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const csvData = await parseCSV(req.file.buffer);
      
      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (let i = 0; i < csvData.length; i++) {
        const row = csvData[i];
        const validation = validateManagedServiceData(row);
        
        if (!validation.isValid) {
          errors.push(`Row ${i + 2}: ${validation.errors.join(', ')}`);
          skipped++;
          continue;
        }

        try {
          const serviceData = { ...validation.data, tenantId };
          await storage.createManagedService(serviceData);
          imported++;
        } catch (error) {
          errors.push(`Row ${i + 2}: Failed to import - ${error instanceof Error ? error.message : 'Unknown error'}`);
          skipped++;
        }
      }

      res.json({
        success: errors.length === 0,
        imported,
        skipped,
        errors,
      });
    } catch (error) {
      console.error("Error importing managed services:", error);
      res.status(500).json({ message: "Failed to import managed services" });
    }
  });

  // Placeholder endpoints for other product types
  app.post('/api/product-accessories/import', upload.single('file'), async (req: any, res) => {
    res.json({ success: false, imported: 0, skipped: 0, errors: ['Import for Product Accessories not yet implemented'] });
  });

  app.post('/api/professional-services/import', upload.single('file'), async (req: any, res) => {
    res.json({ success: false, imported: 0, skipped: 0, errors: ['Import for Professional Services not yet implemented'] });
  });

  app.post('/api/service-products/import', upload.single('file'), async (req: any, res) => {
    res.json({ success: false, imported: 0, skipped: 0, errors: ['Import for Service Products not yet implemented'] });
  });

  app.post('/api/software-products/import', upload.single('file'), async (req: any, res) => {
    res.json({ success: false, imported: 0, skipped: 0, errors: ['Import for Software Products not yet implemented'] });
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

  // Register mobile and performance monitoring routes
  registerMobileRoutes(app);

  // Workflow Automation Routes
  app.get("/api/workflow-rules", async (req: any, res) => {
    try {
      const tenantId = req.user.claims.sub;
      
      // Mock workflow rules data for now - would come from database
      const workflowRules = [
        {
          id: "1",
          name: "Auto-Assign High Priority Tickets",
          description: "Automatically assign high priority service tickets to available senior technicians",
          trigger: {
            type: 'service_ticket_created',
            conditions: { priority: 'high' }
          },
          actions: [{
            type: 'assign_technician',
            parameters: { skillLevel: 'senior', available: true }
          }],
          isActive: true,
          createdAt: new Date().toISOString(),
          lastTriggered: new Date(Date.now() - 86400000).toISOString(),
          triggerCount: 15
        },
        {
          id: "2", 
          name: "Contract Expiration Alerts",
          description: "Send email notifications 30 days before contract expiration",
          trigger: {
            type: 'contract_expiring',
            conditions: { daysUntilExpiration: 30 }
          },
          actions: [{
            type: 'send_email',
            parameters: { recipients: ['account_manager', 'customer'] }
          }],
          isActive: true,
          createdAt: new Date().toISOString(),
          lastTriggered: new Date(Date.now() - 432000000).toISOString(),
          triggerCount: 8
        },
        {
          id: "3",
          name: "Overdue Payment Reminders", 
          description: "Automatically send payment reminders for overdue invoices",
          trigger: {
            type: 'customer_payment_overdue',
            conditions: { overdueDays: 15 }
          },
          actions: [{
            type: 'send_email',
            parameters: { template: 'payment_reminder' }
          }, {
            type: 'create_task',
            parameters: { assignee: 'account_manager', priority: 'high' }
          }],
          isActive: false,
          createdAt: new Date().toISOString(),
          triggerCount: 0
        }
      ];
      
      res.json(workflowRules);
    } catch (error) {
      console.error("Error fetching workflow rules:", error);
      res.status(500).json({ message: "Failed to fetch workflow rules" });
    }
  });

  app.post("/api/workflow-rules", async (req: any, res) => {
    try {
      const tenantId = req.user.claims.sub;
      const ruleData = {
        id: Date.now().toString(),
        ...req.body,
        tenantId,
        createdAt: new Date().toISOString(),
        triggerCount: 0
      };
      
      // Would save to database in real implementation
      res.status(201).json(ruleData);
    } catch (error) {
      console.error("Error creating workflow rule:", error);
      res.status(500).json({ message: "Failed to create workflow rule" });
    }
  });

  app.patch("/api/workflow-rules/:id", async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // Would update in database in real implementation
      res.json({ id, ...updates });
    } catch (error) {
      console.error("Error updating workflow rule:", error);
      res.status(500).json({ message: "Failed to update workflow rule" });
    }
  });

  app.delete("/api/workflow-rules/:id", async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // Would delete from database in real implementation
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting workflow rule:", error);
      res.status(500).json({ message: "Failed to delete workflow rule" });
    }
  });

  // Advanced Reporting Routes
  app.get("/api/advanced-reports/revenue-analytics", async (req: any, res) => {
    try {
      const tenantId = req.user.claims.sub;
      const { startDate, endDate } = req.query;
      
      // Mock revenue analytics data
      const revenueData = {
        totalRevenue: 1248500,
        monthlyGrowth: 12.5,
        revenueByMonth: Array.from({ length: 12 }, (_, i) => ({
          month: new Date(2024, i).toLocaleDateString('en-US', { month: 'short' }),
          revenue: Math.floor(Math.random() * 150000) + 80000,
          contracts: Math.floor(Math.random() * 50) + 30
        })),
        revenueByService: [
          { service: 'Meter Billing', revenue: 450000, percentage: 36 },
          { service: 'Service Contracts', revenue: 380000, percentage: 30 },
          { service: 'Equipment Sales', revenue: 280000, percentage: 22 },
          { service: 'Supplies', revenue: 138500, percentage: 12 }
        ]
      };
      
      res.json(revenueData);
    } catch (error) {
      console.error("Error fetching revenue analytics:", error);
      res.status(500).json({ message: "Failed to fetch revenue analytics" });
    }
  });

  app.get("/api/advanced-reports/customer-profitability", async (req: any, res) => {
    try {
      const tenantId = req.user.claims.sub;
      
      // Mock customer profitability data
      const profitabilityData = {
        averageMargin: 28.5,
        topCustomers: Array.from({ length: 10 }, (_, i) => ({
          id: `cust-${i + 1}`,
          name: `Customer ${i + 1}`,
          revenue: Math.floor(Math.random() * 80000) + 20000,
          margin: Math.floor(Math.random() * 40) + 15,
          contracts: Math.floor(Math.random() * 8) + 2
        }))
      };
      
      res.json(profitabilityData);
    } catch (error) {
      console.error("Error fetching customer profitability:", error);
      res.status(500).json({ message: "Failed to fetch customer profitability" });
    }
  });

  app.get("/api/advanced-reports/service-performance", async (req: any, res) => {
    try {
      const tenantId = req.user.claims.sub;
      
      // Mock service performance data
      const serviceData = {
        averageResponseTime: 2.4,
        firstCallResolution: 78,
        customerSatisfaction: 4.2,
        monthlyMetrics: Array.from({ length: 6 }, (_, i) => ({
          month: new Date(2024, 6 + i).toLocaleDateString('en-US', { month: 'short' }),
          tickets: Math.floor(Math.random() * 100) + 50,
          resolved: Math.floor(Math.random() * 80) + 40,
          avgTime: Math.random() * 4 + 1
        })),
        technicianPerformance: Array.from({ length: 8 }, (_, i) => ({
          id: `tech-${i + 1}`,
          name: `Technician ${i + 1}`,
          ticketsResolved: Math.floor(Math.random() * 50) + 20,
          avgTime: Math.random() * 3 + 1.5,
          rating: Math.random() * 1.5 + 3.5
        }))
      };
      
      res.json(serviceData);
    } catch (error) {
      console.error("Error fetching service performance:", error);
      res.status(500).json({ message: "Failed to fetch service performance" });
    }
  });

  // Deal Management Routes
  
  // Get all deals with optional filtering
  app.get("/api/deals", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { stageId, search } = req.query;
      
      const deals = await storage.getDeals(tenantId, stageId, search);
      res.json(deals);
    } catch (error) {
      console.error("Error fetching deals:", error);
      res.status(500).json({ message: "Failed to fetch deals" });
    }
  });

  // Get single deal
  app.get("/api/deals/:id", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const dealId = req.params.id;
      
      const deal = await storage.getDeal(dealId, tenantId);
      if (!deal) {
        return res.status(404).json({ message: "Deal not found" });
      }
      
      res.json(deal);
    } catch (error) {
      console.error("Error fetching deal:", error);
      res.status(500).json({ message: "Failed to fetch deal" });
    }
  });

  // Create new deal
  app.post("/api/deals", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      
      const dealData = insertDealSchema.parse({
        ...req.body,
        tenantId,
        ownerId: userId,
      });
      
      const deal = await storage.createDeal(dealData);
      res.status(201).json(deal);
    } catch (error) {
      console.error("Error creating deal:", error);
      res.status(500).json({ message: "Failed to create deal" });
    }
  });

  // Update deal
  app.put("/api/deals/:id", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const dealId = req.params.id;
      
      const deal = await storage.updateDeal(dealId, req.body, tenantId);
      if (!deal) {
        return res.status(404).json({ message: "Deal not found" });
      }
      
      res.json(deal);
    } catch (error) {
      console.error("Error updating deal:", error);
      res.status(500).json({ message: "Failed to update deal" });
    }
  });

  // Update deal stage (for drag and drop)
  app.put("/api/deals/:id/stage", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const dealId = req.params.id;
      const { stageId } = req.body;
      
      const deal = await storage.updateDealStage(dealId, stageId, tenantId);
      if (!deal) {
        return res.status(404).json({ message: "Deal not found" });
      }
      
      res.json(deal);
    } catch (error) {
      console.error("Error updating deal stage:", error);
      res.status(500).json({ message: "Failed to update deal stage" });
    }
  });

  // Deal Stages Routes
  
  // Get all deal stages for tenant
  app.get("/api/deal-stages", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const stages = await storage.getDealStages(tenantId);
      res.json(stages);
    } catch (error) {
      console.error("Error fetching deal stages:", error);
      res.status(500).json({ message: "Failed to fetch deal stages" });
    }
  });

  // Create deal stage
  app.post("/api/deal-stages", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const stageData = insertDealStageSchema.parse({
        ...req.body,
        tenantId,
      });
      
      const stage = await storage.createDealStage(stageData);
      res.status(201).json(stage);
    } catch (error) {
      console.error("Error creating deal stage:", error);
      res.status(500).json({ message: "Failed to create deal stage" });
    }
  });

  // Initialize default deal stages for a tenant (called on first access)
  app.post("/api/deal-stages/initialize", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      // Check if stages already exist
      const existingStages = await storage.getDealStages(tenantId);
      if (existingStages.length > 0) {
        return res.json({ message: "Deal stages already initialized", stages: existingStages });
      }
      
      // Create default stages
      const defaultStages = [
        { name: "Appointment Scheduled", color: "#3B82F6", sortOrder: 1, isClosingStage: false, isWonStage: false },
        { name: "Qualified to Buy", color: "#8B5CF6", sortOrder: 2, isClosingStage: false, isWonStage: false },
        { name: "Presentation Scheduled", color: "#06B6D4", sortOrder: 3, isClosingStage: false, isWonStage: false },
        { name: "Decision Maker Bought-In", color: "#F59E0B", sortOrder: 4, isClosingStage: false, isWonStage: false },
        { name: "Contract Sent", color: "#EF4444", sortOrder: 5, isClosingStage: false, isWonStage: false },
        { name: "Closed Won", color: "#10B981", sortOrder: 6, isClosingStage: true, isWonStage: true },
        { name: "Closed Lost", color: "#6B7280", sortOrder: 7, isClosingStage: true, isWonStage: false },
      ];
      
      const createdStages = [];
      for (const stage of defaultStages) {
        const stageData = insertDealStageSchema.parse({
          ...stage,
          tenantId,
          isActive: true,
        });
        const newStage = await storage.createDealStage(stageData);
        createdStages.push(newStage);
      }
      
      res.status(201).json({ message: "Deal stages initialized", stages: createdStages });
    } catch (error) {
      console.error("Error initializing deal stages:", error);
      res.status(500).json({ message: "Failed to initialize deal stages" });
    }
  });

  // Deal Activities Routes
  
  // Get activities for a deal
  app.get("/api/deals/:id/activities", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const dealId = req.params.id;
      
      const activities = await storage.getDealActivities(dealId, tenantId);
      res.json(activities);
    } catch (error) {
      console.error("Error fetching deal activities:", error);
      res.status(500).json({ message: "Failed to fetch deal activities" });
    }
  });

  // Create deal activity
  app.post("/api/deals/:id/activities", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const dealId = req.params.id;
      const userId = req.user.id;
      
      const activityData = insertDealActivitySchema.parse({
        ...req.body,
        tenantId,
        dealId,
        userId,
      });
      
      const activity = await storage.createDealActivity(activityData);
      res.status(201).json(activity);
    } catch (error) {
      console.error("Error creating deal activity:", error);
      res.status(500).json({ message: "Failed to create deal activity" });
    }
  });

  // Register integration and deployment routes
  registerIntegrationRoutes(app);

  // Register task management routes
  registerTaskRoutes(app);

  // Register purchase order routes
  registerPurchaseOrderRoutes(app);

  // Performance monitoring routes
  app.get('/api/performance/metrics', requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.session?.tenantId;
      const metrics = await storage.getPerformanceMetrics(tenantId);
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching performance metrics:", error);
      res.status(500).json({ error: "Failed to fetch performance metrics" });
    }
  });

  app.get('/api/performance/alerts', requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.session?.tenantId;
      const alerts = await storage.getSystemAlerts(tenantId);
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching system alerts:", error);
      res.status(500).json({ error: "Failed to fetch system alerts" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}