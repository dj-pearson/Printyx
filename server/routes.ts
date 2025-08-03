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
import { registerWarehouseRoutes } from "./routes-warehouse";
import { registerServiceAnalysisRoutes } from "./routes-service-analysis";
import { registerCrmGoalRoutes } from "./routes-crm-goals";
import { registerBusinessRecordRoutes } from "./routes-business-records";
import { registerSalesforceRoutes } from "./routes-salesforce-integration";
import { registerSalesforceTestRoutes } from "./test-salesforce-integration";
import { registerDataEnrichmentRoutes } from "./routes-data-enrichment";
import { registerQuickBooksRoutes } from "./routes-quickbooks-integration";
import {
  getCompanyPricingSettings,
  updateCompanyPricingSettings,
  getProductPricing,
  createProductPricing,
  updateProductPricing,
  deleteProductPricing,
  getQuotePricing,
  createQuotePricing,
  updateQuotePricing,
  getQuoteLineItems,
  createQuoteLineItem,
  updateQuoteLineItem,
  deleteQuoteLineItem,
  calculatePricingForProduct
} from "./routes-pricing";
import { resolveTenant, requireTenant, TenantRequest } from './middleware/tenancy';
import { db } from "./db";
import { eq, and, or, inArray, sql, desc, asc, like, gte, lte, lt, ne, count, isNull, isNotNull } from "drizzle-orm";
import { locations, regions, tenants, type User } from "@shared/schema";

// Basic authentication middleware - Updated to work with current auth system
const requireAuth = (req: any, res: any, next: any) => {
  // Check for session-based auth (legacy) or user object (current)
  const isAuthenticated = req.session?.userId || req.user?.id || req.user?.claims?.sub;
  
  if (!isAuthenticated) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  // Add user context for backwards compatibility
  if (!req.user) {
    req.user = {
      id: req.session.userId,
      tenantId: req.session.tenantId || "550e8400-e29b-41d4-a716-446655440000"
    };
  } else if (!req.user.tenantId && !req.user.id) {
    // If we have user claims but no structured user object, build it
    req.user = {
      id: req.user.claims?.sub || req.user.id,
      tenantId: req.user.tenantId || req.session?.tenantId || "550e8400-e29b-41d4-a716-446655440000"
    };
  }
  
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

  // Multi-location support routes for enhanced tenant selector
  app.get('/api/tenants/:tenantId/locations', requireAuth, async (req: any, res) => {
    try {
      const { tenantId } = req.params;
      const user = await storage.getUserWithRole(req.session.userId);
      
      // Only allow platform admins or users from the same tenant
      if (!user?.role?.canAccessAllTenants && user?.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      
      const locationResults = await db
        .select({
          id: locations.id,
          name: locations.name,
          address: locations.address,
          city: locations.city,
          state: locations.state,
          zipCode: locations.zipCode,
          regionId: locations.regionId,
          regionName: regions.name,
          managerId: locations.locationManagerId,
          isActive: locations.isActive,
        })
        .from(locations)
        .leftJoin(regions, eq(locations.regionId, regions.id))
        .where(eq(locations.tenantId, tenantId))
        .orderBy(locations.name);
      
      res.json(locationResults);
    } catch (error) {
      console.error('Error fetching locations:', error);
      res.status(500).json({ error: 'Failed to fetch locations' });
    }
  });

  app.get('/api/tenants/:tenantId/regions', requireAuth, async (req: any, res) => {
    try {
      const { tenantId } = req.params;
      const user = await storage.getUserWithRole(req.session.userId);
      
      // Only allow platform admins or users from the same tenant
      if (!user?.role?.canAccessAllTenants && user?.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      
      const tenantRegions = await db
        .select({
          id: regions.id,
          name: regions.name,
          description: regions.description,
          locationCount: sql<number>`count(${locations.id})::int`
        })
        .from(regions)
        .leftJoin(locations, eq(regions.id, locations.regionId))
        .where(eq(regions.tenantId, tenantId))
        .groupBy(regions.id, regions.name, regions.description)
        .orderBy(regions.name);
      
      res.json(tenantRegions);
    } catch (error) {
      console.error('Error fetching regions:', error);
      res.status(500).json({ error: 'Failed to fetch regions' });
    }
  });

  app.get('/api/tenants/:tenantId/summary', requireAuth, async (req: any, res) => {
    try {
      const { tenantId } = req.params;
      const user = await storage.getUserWithRole(req.session.userId);
      
      // Only allow platform admins or users from the same tenant
      if (!user?.role?.canAccessAllTenants && user?.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      
      // Get tenant basic info
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);
      
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }
      
      // Get location and employee counts
      const [summary] = await db
        .select({
          locationCount: sql<number>`count(distinct ${locations.id})::int`,
          regionCount: sql<number>`count(distinct ${regions.id})::int`,
          totalEmployees: sql<number>`1::int` // placeholder for employee count
        })
        .from(locations)
        .leftJoin(regions, eq(locations.regionId, regions.id))
        .where(eq(locations.tenantId, tenantId));
      
      res.json({
        ...tenant,
        locationCount: summary?.locationCount || 0,
        regionCount: summary?.regionCount || 0,
        totalEmployees: summary?.totalEmployees || 0
      });
    } catch (error) {
      console.error('Error fetching tenant summary:', error);
      res.status(500).json({ error: 'Failed to fetch tenant summary' });
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

  // Apply tenant resolution middleware to all API routes
  app.use('/api', resolveTenant);
  
  // Contacts routes
  app.get('/api/contacts', requireAuth, async (req: TenantRequest, res) => {
    try {
      const user = req.user as any;
      const tenantId = req.tenantId || user.tenantId;
      
      console.log(`[CONTACTS DEBUG] User: ${user?.id}, TenantId: ${tenantId}, req.tenantId: ${req.tenantId}, user.tenantId: ${user?.tenantId}`);
      
      // Get query parameters
      const {
        search = '',
        contactOwner = '',
        createDate = '',
        lastActivityDate = '',
        leadStatus = '',
        view = 'all',
        sortBy = 'lastActivityDate',
        sortOrder = 'desc',
        page = '1',
        limit = '25'
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const offset = (pageNum - 1) * limitNum;

      // Build filters based on role and view
      let filters: any = { tenantId };
      
      console.log(`[CONTACTS DEBUG] Filters before role logic: ${JSON.stringify(filters)}`);
      
      // Role-based access control
      if (user.role === 'salesperson') {
        filters.ownerId = user.id; // Salespeople only see their own contacts
      }
      
      // Apply view filter
      if (view === 'my') {
        filters.ownerId = user.id;
      } else if (view === 'unassigned') {
        filters.ownerId = null;
      }
      
      // Apply other filters
      if (contactOwner) {
        const ownerUser = await storage.getUserByName(contactOwner);
        if (ownerUser) {
          filters.ownerId = ownerUser.id;
        }
      }
      
      if (leadStatus) {
        filters.leadStatus = leadStatus;
      }
      
      // Date filters
      const now = new Date();
      if (createDate) {
        switch (createDate) {
          case 'today':
            filters.createdAt = { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) };
            break;
          case 'yesterday':
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            filters.createdAt = {
              gte: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()),
              lt: new Date(now.getFullYear(), now.getMonth(), now.getDate())
            };
            break;
          case 'last7days':
            const last7Days = new Date(now);
            last7Days.setDate(last7Days.getDate() - 7);
            filters.createdAt = { gte: last7Days };
            break;
          case 'last30days':
            const last30Days = new Date(now);
            last30Days.setDate(last30Days.getDate() - 30);
            filters.createdAt = { gte: last30Days };
            break;
        }
      }
      
      if (lastActivityDate) {
        switch (lastActivityDate) {
          case 'today':
            filters.lastContactDate = { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) };
            break;
          case 'yesterday':
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            filters.lastContactDate = {
              gte: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()),
              lt: new Date(now.getFullYear(), now.getMonth(), now.getDate())
            };
            break;
          case 'last7days':
            const last7Days = new Date(now);
            last7Days.setDate(last7Days.getDate() - 7);
            filters.lastContactDate = { gte: last7Days };
            break;
          case 'last30days':
            const last30Days = new Date(now);
            last30Days.setDate(last30Days.getDate() - 30);
            filters.lastContactDate = { gte: last30Days };
            break;
          case 'never':
            filters.lastContactDate = null;
            break;
        }
      }

      console.log(`[CONTACTS DEBUG] Final filters: ${JSON.stringify(filters)}, search: '${search}', sortBy: ${sortBy}, offset: ${offset}, limit: ${limitNum}`);
      
      const contacts = await storage.getContacts({
        filters,
        search: search as string,
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc',
        offset,
        limit: limitNum
      });

      const total = await storage.getContactsCount({ filters, search: search as string });
      
      console.log(`[CONTACTS DEBUG] Results: contacts.length=${contacts.length}, total=${total}`);

      res.json({
        contacts,
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      });
    } catch (error) {
      console.error('Error fetching contacts:', error);
      res.status(500).json({ error: 'Failed to fetch contacts' });
    }
  });

  app.post('/api/contacts', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const tenantId = user.tenantId;
      
      const contactData = {
        ...req.body,
        tenantId,
        ownerId: req.body.ownerId || user.id, // Default to current user if not specified
        createdAt: new Date().toISOString(),
        lastContactDate: null,
        nextFollowUpDate: null
      };

      const contact = await storage.createContact(contactData);
      res.status(201).json(contact);
    } catch (error) {
      console.error('Error creating contact:', error);
      res.status(500).json({ error: 'Failed to create contact' });
    }
  });

  app.get('/api/contacts/:id', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const tenantId = user.tenantId;
      const { id } = req.params;

      const contact = await storage.getContactById(id);
      
      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }
      
      // Check tenant access
      if (contact.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Role-based access control
      if (user.role === 'salesperson' && contact.ownerId !== user.id) {
        return res.status(403).json({ error: 'Access denied - you can only view your own contacts' });
      }

      res.json(contact);
    } catch (error) {
      console.error('Error fetching contact:', error);
      res.status(500).json({ error: 'Failed to fetch contact' });
    }
  });

  app.put('/api/contacts/:id', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const tenantId = user.tenantId;
      const { id } = req.params;

      const contact = await storage.getContactById(id);
      
      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }
      
      // Check tenant access
      if (contact.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Role-based access control
      if (user.role === 'salesperson' && contact.ownerId !== user.id) {
        return res.status(403).json({ error: 'Access denied - you can only edit your own contacts' });
      }

      const updatedContact = await storage.updateContact(id, req.body);
      res.json(updatedContact);
    } catch (error) {
      console.error('Error updating contact:', error);
      res.status(500).json({ error: 'Failed to update contact' });
    }
  });

  app.delete('/api/contacts/:id', requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const tenantId = user.tenantId;
      const { id } = req.params;

      const contact = await storage.getContactById(id);
      
      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }
      
      // Check tenant access
      if (contact.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Role-based access control
      if (user.role === 'salesperson' && contact.ownerId !== user.id) {
        return res.status(403).json({ error: 'Access denied - you can only delete your own contacts' });
      }

      await storage.deleteContact(id);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting contact:', error);
      res.status(500).json({ error: 'Failed to delete contact' });
    }
  });

  // Business Records routes (client's customers/leads)
  app.get('/api/customers', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      // Get business records where recordType = 'customer' (copier buyers)
      const customers = await storage.getCustomers(tenantId);
      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  app.get('/api/customers/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
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
  app.get('/api/companies', requireAuth, async (req: any, res) => {
    try {
      const user = req.user as User;
      const tenantId = user.tenantId;
      const { search } = req.query;
      
      const companies = await storage.getCompanies(tenantId, search);
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

  // Lead management routes (potential copier buyers for Printyx clients)
  app.get('/api/leads', async (req: any, res) => {
    try {
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      // Get business records where recordType = 'lead' (potential copier buyers)
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

  app.patch('/api/product-accessories/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = "550e8400-e29b-41d4-a716-446655440000";
      const accessory = await storage.updateProductAccessory(id, req.body, tenantId);
      if (!accessory) {
        return res.status(404).json({ message: "Product accessory not found" });
      }
      res.json(accessory);
    } catch (error) {
      console.error("Error updating product accessory:", error);
      res.status(500).json({ message: "Failed to update product accessory" });
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
  app.get("/api/deals", async (req: any, res) => {
    // Simple session-based authentication check
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user?.tenantId) {
      return res.status(403).json({ message: "Access denied" });
    }
    try {
      const tenantId = user.tenantId;
      const { stageId, search } = req.query;
      
      const deals = await storage.getDeals(tenantId, stageId, search);
      res.json(deals);
    } catch (error) {
      console.error("Error fetching deals:", error);
      res.status(500).json({ message: "Failed to fetch deals" });
    }
  });

  // Get single deal
  app.get("/api/deals/:id", async (req: any, res) => {
    try {
      // Simple session-based authentication check
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user?.tenantId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const tenantId = user.tenantId;
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
  app.post("/api/deals", async (req: any, res) => {
    try {
      // Simple session-based authentication check
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user?.tenantId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const tenantId = user.tenantId;
      const userId = user.id;
      
      // Get the first available stage as default
      const stages = await storage.getDealStages(tenantId);
      const defaultStageId = stages.length > 0 ? stages[0].id : null;
      
      if (!defaultStageId) {
        // Initialize default stages if none exist
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
          const stageData = {
            ...stage,
            tenantId,
            isActive: true,
          };
          const newStage = await storage.createDealStage(stageData);
          createdStages.push(newStage);
        }
        
        if (createdStages.length === 0) {
          throw new Error("Could not create default deal stages");
        }
      }
      
      // Get the updated stages list after potential creation
      const finalStages = await storage.getDealStages(tenantId);
      const finalStageId = finalStages.length > 0 ? finalStages[0].id : null;
      
      if (!finalStageId) {
        throw new Error("No deal stages available");
      }
      
      // Transform the data to match schema expectations
      const dealData = {
        tenantId,
        ownerId: userId,
        createdById: userId, // Add the required createdById field
        stageId: finalStageId,
        title: req.body.title,
        description: req.body.description || null,
        amount: req.body.amount ? req.body.amount : null,
        estimatedMonthlyValue: req.body.estimatedMonthlyValue ? req.body.estimatedMonthlyValue : null,
        expectedCloseDate: req.body.expectedCloseDate ? new Date(req.body.expectedCloseDate) : null,
        companyName: req.body.companyName || null,
        primaryContactName: req.body.primaryContactName || null,
        primaryContactEmail: req.body.primaryContactEmail || null,
        primaryContactPhone: req.body.primaryContactPhone || null,
        source: req.body.source || null,
        dealType: req.body.dealType || null,
        priority: req.body.priority || "medium",
        productsInterested: req.body.productsInterested || null,
        probability: 25, // Default probability for new deals
      };
      
      console.log("[DEAL DEBUG] Processed deal data:", JSON.stringify(dealData, null, 2));
      
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

  // Register warehouse routes
  registerWarehouseRoutes(app);

  // Register service analysis routes
  registerServiceAnalysisRoutes(app);
  registerCrmGoalRoutes(app);
  
  // Register unified business records routes
  registerBusinessRecordRoutes(app);
  
  // Register Salesforce integration routes
  registerSalesforceRoutes(app);
  
  // Register data enrichment routes (ZoomInfo and Apollo.io)
  registerDataEnrichmentRoutes(app);
  
  // Register QuickBooks integration routes
  registerQuickBooksRoutes(app);
  
  // Register Salesforce test routes (development only)
  if (process.env.NODE_ENV === 'development') {
    registerSalesforceTestRoutes(app);
  }
  
  // Register mobile routes
  registerMobileRoutes(app);

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

  // Pricing Management Routes
  app.get('/api/pricing/company-settings', requireAuth, getCompanyPricingSettings);
  app.post('/api/pricing/company-settings', requireAuth, updateCompanyPricingSettings);
  app.get('/api/pricing/products', requireAuth, getProductPricing);
  app.post('/api/pricing/products', requireAuth, createProductPricing);
  app.put('/api/pricing/products/:id', requireAuth, updateProductPricing);
  app.delete('/api/pricing/products/:id', requireAuth, deleteProductPricing);
  
  // Products with pricing information
  app.get('/api/products/with-pricing', requireAuth, async (req: any, res) => {
    try {
      const { tenantId } = req.user;
      
      // Get all products
      const [models, accessories, services, supplies, managedServices, softwareProducts, professionalServices] = await Promise.all([
        storage.getAllProductModels(tenantId),
        storage.getAllProductAccessories(tenantId),
        storage.getAllServiceProducts(tenantId),
        storage.getAllSupplies(tenantId),
        storage.getAllManagedServices(tenantId),
        storage.getAllSoftwareProducts(tenantId),
        storage.getAllProfessionalServices(tenantId),
      ]);

      // Get all product pricing
      const productPricing = await storage.getProductPricing(tenantId);
      const pricingMap = new Map(productPricing.map(p => [p.productId, p]));

      // Combine all products with pricing information
      const allProducts = [
        ...models.map(m => ({ ...m, category: 'Equipment Models' })),
        ...accessories.map(a => ({ ...a, category: 'Accessories' })),
        ...services.map(s => ({ ...s, category: 'Services' })),
        ...supplies.map(s => ({ ...s, category: 'Supplies' })),
        ...managedServices.map(m => ({ ...m, category: 'Managed Services' })),
        ...softwareProducts.map(s => ({ ...s, category: 'Software' })),
        ...professionalServices.map(p => ({ ...p, category: 'Professional Services' })),
      ].map(product => {
        const pricing = pricingMap.get(product.id);
        return {
          ...product,
          dealerCost: pricing?.dealerCost,
          companyMarkupPercentage: pricing?.companyMarkupPercentage,
          companyPrice: pricing?.companyPrice,
          minimumSalePrice: pricing?.minimumSalePrice,
          suggestedRetailPrice: pricing?.suggestedRetailPrice,
          hasCustomPricing: !!pricing,
        };
      });

      res.json(allProducts);
    } catch (error) {
      console.error("Error fetching products with pricing:", error);
      res.status(500).json({ message: "Failed to fetch products with pricing" });
    }
  });

  // Bulk update pricing
  app.post('/api/pricing/products/bulk-update', requireAuth, async (req: any, res) => {
    try {
      const { tenantId } = req.user;
      const { updates } = req.body;

      const results = [];
      for (const update of updates) {
        try {
          const pricing = await storage.createProductPricing({
            tenantId,
            productId: update.productId,
            productType: 'model', // Default type
            companyMarkupPercentage: update.markupPercentage,
            createdBy: req.user.id,
          });
          results.push(pricing);
        } catch (error) {
          console.error(`Error updating pricing for ${update.productId}:`, error);
        }
      }

      res.json(results);
    } catch (error) {
      console.error("Error bulk updating pricing:", error);
      res.status(500).json({ message: "Failed to bulk update pricing" });
    }
  });
  
  app.get('/api/pricing/products', requireAuth, getProductPricing);
  app.post('/api/pricing/products', requireAuth, createProductPricing);
  app.put('/api/pricing/products/:id', requireAuth, updateProductPricing);
  app.delete('/api/pricing/products/:id', requireAuth, deleteProductPricing);
  
  app.get('/api/pricing/quotes/:quoteId', requireAuth, getQuotePricing);
  app.post('/api/pricing/quotes', requireAuth, createQuotePricing);
  app.put('/api/pricing/quotes/:id', requireAuth, updateQuotePricing);
  
  app.get('/api/pricing/quotes/:quotePricingId/line-items', requireAuth, getQuoteLineItems);
  app.post('/api/pricing/line-items', requireAuth, createQuoteLineItem);
  app.put('/api/pricing/line-items/:id', requireAuth, updateQuoteLineItem);
  app.delete('/api/pricing/line-items/:id', requireAuth, deleteQuoteLineItem);
  
  app.post('/api/pricing/calculate', requireAuth, calculatePricingForProduct);

  // User Settings Routes
  const {
    getUserSettings,
    updateUserProfile,
    updateUserPassword,
    updateUserPreferences,
    updateAccessibilitySettings,
    uploadAvatar,
    exportUserData,
    deleteUserAccount,
    upload: avatarUpload
  } = await import('./routes-settings');

  app.get('/api/user/settings', requireAuth, getUserSettings);
  app.put('/api/user/profile', requireAuth, updateUserProfile);
  app.put('/api/user/password', requireAuth, updateUserPassword);
  app.put('/api/user/preferences', requireAuth, updateUserPreferences);
  app.put('/api/user/accessibility', requireAuth, updateAccessibilitySettings);
  app.post('/api/user/avatar', requireAuth, avatarUpload.single('avatar'), uploadAvatar);
  app.get('/api/user/export', requireAuth, exportUserData);
  app.delete('/api/user/delete', requireAuth, deleteUserAccount);

  // Customer detail routes - for comprehensive customer information
  app.get("/api/customers/:id/equipment", requireAuth, requireTenant, async (req: TenantRequest, res) => {
    try {
      const equipment = await storage.getCustomerEquipment(req.params.id, req.tenantId);
      res.json(equipment);
    } catch (error) {
      console.error("Error fetching customer equipment:", error);
      res.status(500).json({ message: "Failed to fetch customer equipment" });
    }
  });

  app.get("/api/customers/:id/meter-readings", requireAuth, requireTenant, async (req: TenantRequest, res) => {
    try {
      const meterReadings = await storage.getCustomerMeterReadings(req.params.id, req.tenantId);
      res.json(meterReadings);
    } catch (error) {
      console.error("Error fetching customer meter readings:", error);
      res.status(500).json({ message: "Failed to fetch customer meter readings" });
    }
  });

  app.get("/api/customers/:id/invoices", requireAuth, requireTenant, async (req: TenantRequest, res) => {
    try {
      const invoices = await storage.getCustomerInvoices(req.params.id, req.tenantId);
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching customer invoices:", error);
      res.status(500).json({ message: "Failed to fetch customer invoices" });
    }
  });

  app.get("/api/customers/:id/service-tickets", requireAuth, requireTenant, async (req: TenantRequest, res) => {
    try {
      const serviceTickets = await storage.getCustomerServiceTickets(req.params.id, req.tenantId);
      res.json(serviceTickets);
    } catch (error) {
      console.error("Error fetching customer service tickets:", error);
      res.status(500).json({ message: "Failed to fetch customer service tickets" });
    }
  });

  app.get("/api/customers/:id/contracts", requireAuth, requireTenant, async (req: TenantRequest, res) => {
    try {
      const contracts = await storage.getCustomerContracts(req.params.id, req.tenantId);
      res.json(contracts);
    } catch (error) {
      console.error("Error fetching customer contracts:", error);
      res.status(500).json({ message: "Failed to fetch customer contracts" });
    }
  });

  // Import and register proposals routes
  const proposalsRouter = await import('./routes-proposals.js');
  app.use('/api/proposals', proposalsRouter.default);

  // ============= PREVENTIVE MAINTENANCE SCHEDULING ROUTES =============
  
  // Get maintenance schedules
  app.get("/api/maintenance/schedules", requireAuth, async (req: any, res) => {
    try {
      const { status, equipmentId, customerId, priority } = req.query;
      const tenantId = req.user.tenantId;
      
      // Use direct SQL query for maintenance schedules
      const query = `
        SELECT 
          ms.id,
          ms.schedule_name,
          ms.schedule_type,
          ms.frequency,
          ms.frequency_value,
          ms.next_service_date,
          ms.last_service_date,
          ms.priority,
          ms.is_active,
          ms.equipment_id,
          ms.customer_id,
          ms.business_record_id,
          ms.estimated_cost,
          ms.service_duration_minutes,
          ms.created_at,
          e.name as equipment_name,
          c.name as customer_name,
          br.company_name as business_record_name
        FROM maintenance_schedules ms
        LEFT JOIN equipment e ON ms.equipment_id = e.id
        LEFT JOIN customers c ON ms.customer_id = c.id
        LEFT JOIN business_records br ON ms.business_record_id = br.id
        WHERE ms.tenant_id = $1
        ${status === 'active' ? 'AND ms.is_active = true' : ''}
        ${status === 'inactive' ? 'AND ms.is_active = false' : ''}
        ${equipmentId ? `AND ms.equipment_id = '${equipmentId}'` : ''}
        ${customerId ? `AND ms.customer_id = '${customerId}'` : ''}
        ${priority ? `AND ms.priority = '${priority}'` : ''}
        ORDER BY ms.next_service_date DESC NULLS LAST
      `;
      
      const result = await db.$client.query(query, [tenantId]);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching maintenance schedules:", error);
      res.status(500).json({ error: "Failed to fetch maintenance schedules" });
    }
  });

  // Get due schedules (upcoming or overdue)
  app.get("/api/maintenance/schedules/due", requireAuth, async (req: any, res) => {
    try {
      const { days = 7 } = req.query;
      const tenantId = req.user.tenantId;
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + parseInt(days));
      
      const query = `
        SELECT 
          ms.id,
          ms.schedule_name,
          ms.next_service_date,
          ms.priority,
          e.name as equipment_name,
          c.name as customer_name,
          br.company_name as business_record_name,
          ms.estimated_cost,
          CASE WHEN ms.next_service_date < NOW() THEN true ELSE false END as is_overdue
        FROM maintenance_schedules ms
        LEFT JOIN equipment e ON ms.equipment_id = e.id
        LEFT JOIN customers c ON ms.customer_id = c.id
        LEFT JOIN business_records br ON ms.business_record_id = br.id
        WHERE ms.tenant_id = $1
        AND ms.is_active = true
        AND ms.next_service_date <= $2
        ORDER BY ms.next_service_date ASC
      `;
      
      const result = await db.$client.query(query, [tenantId, futureDate.toISOString()]);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching due schedules:", error);
      res.status(500).json({ error: "Failed to fetch due schedules" });
    }
  });

  // Create maintenance schedule
  app.post("/api/maintenance/schedules", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const createdBy = req.user.id;
      
      const {
        scheduleName,
        scheduleType,
        frequency,
        frequencyValue = 1,
        nextServiceDate,
        equipmentId,
        customerId,
        businessRecordId,
        estimatedCost,
        serviceDuration = 60,
        priority = 'medium',
        advanceNotificationDays = 7,
        customerNotification = true,
        technicianNotification = true
      } = req.body;
      
      const query = `
        INSERT INTO maintenance_schedules (
          tenant_id, schedule_name, schedule_type, frequency, frequency_value,
          next_service_date, equipment_id, customer_id, business_record_id,
          estimated_cost, service_duration_minutes, priority, advance_notification_days,
          customer_notification, technician_notification, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
      `;
      
      const result = await db.$client.query(query, [
        tenantId, scheduleName, scheduleType, frequency, frequencyValue,
        nextServiceDate, equipmentId, customerId, businessRecordId,
        estimatedCost, serviceDuration, priority, advanceNotificationDays,
        customerNotification, technicianNotification, createdBy
      ]);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating maintenance schedule:", error);
      res.status(500).json({ error: "Failed to create maintenance schedule" });
    }
  });

  // Analytics endpoint
  app.get("/api/maintenance/analytics/overview", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const queries = [
        // Total schedules
        `SELECT COUNT(*) as total_schedules FROM maintenance_schedules WHERE tenant_id = $1`,
        // Active schedules
        `SELECT COUNT(*) as active_schedules FROM maintenance_schedules WHERE tenant_id = $1 AND is_active = true`,
        // Overdue schedules
        `SELECT COUNT(*) as overdue_schedules FROM maintenance_schedules WHERE tenant_id = $1 AND is_active = true AND next_service_date < NOW()`,
        // Due this week
        `SELECT COUNT(*) as due_this_week FROM maintenance_schedules WHERE tenant_id = $1 AND is_active = true AND next_service_date BETWEEN NOW() AND (NOW() + INTERVAL '7 days')`
      ];
      
      const results = await Promise.all(
        queries.map(query => db.$client.query(query, [tenantId]))
      );
      
      res.json({
        totalSchedules: parseInt(results[0].rows[0].total_schedules),
        activeSchedules: parseInt(results[1].rows[0].active_schedules),
        overdueSchedules: parseInt(results[2].rows[0].overdue_schedules),
        dueThisWeek: parseInt(results[3].rows[0].due_this_week),
      });
    } catch (error) {
      console.error("Error fetching maintenance analytics:", error);
      res.status(500).json({ error: "Failed to fetch maintenance analytics" });
    }
  });

  // ============= CUSTOMER SELF-SERVICE PORTAL ROUTES =============

  // Get customer service requests
  app.get("/api/customer-portal/service-requests", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const query = `
        SELECT 
          sr.*,
          e.name as equipment_name
        FROM service_requests sr
        LEFT JOIN equipment e ON sr.equipment_id = e.id
        WHERE sr.tenant_id = $1
        ORDER BY sr.created_at DESC
      `;
      
      const result = await db.$client.query(query, [tenantId]);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching service requests:", error);
      res.status(500).json({ error: "Failed to fetch service requests" });
    }
  });

  // Create service request
  app.post("/api/customer-portal/service-requests", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      
      const {
        request_type, priority, subject, description, equipment_id,
        equipment_make, equipment_model, equipment_serial, meter_reading,
        preferred_contact_method, preferred_service_time, urgency_reason
      } = req.body;
      
      const query = `
        INSERT INTO service_requests (
          tenant_id, customer_portal_user_id, business_record_id, equipment_id,
          request_type, priority, subject, description, equipment_make,
          equipment_model, equipment_serial, meter_reading, preferred_contact_method,
          preferred_service_time, urgency_reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
      `;
      
      // For demo, use the user's business record association
      const businessRecordId = req.user.tenantId; // Placeholder
      
      const result = await db.$client.query(query, [
        tenantId, userId, businessRecordId, equipment_id, request_type,
        priority, subject, description, equipment_make, equipment_model,
        equipment_serial, meter_reading, preferred_contact_method,
        preferred_service_time, urgency_reason
      ]);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating service request:", error);
      res.status(500).json({ error: "Failed to create service request" });
    }
  });

  // Get customer equipment
  app.get("/api/customer-portal/equipment", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const query = `
        SELECT *
        FROM customer_equipment
        WHERE tenant_id = $1
        ORDER BY equipment_name
      `;
      
      const result = await db.$client.query(query, [tenantId]);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching customer equipment:", error);
      res.status(500).json({ error: "Failed to fetch customer equipment" });
    }
  });

  // Get supply orders
  app.get("/api/customer-portal/supply-orders", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const query = `
        SELECT *
        FROM supply_orders
        WHERE tenant_id = $1
        ORDER BY created_at DESC
      `;
      
      const result = await db.$client.query(query, [tenantId]);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching supply orders:", error);
      res.status(500).json({ error: "Failed to fetch supply orders" });
    }
  });

  // Get knowledge base articles
  app.get("/api/customer-portal/knowledge-base", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const { search, category } = req.query;
      
      let whereConditions = ['tenant_id = $1', 'is_published = true'];
      const queryParams = [tenantId];
      
      if (search) {
        whereConditions.push(`(title ILIKE $${queryParams.length + 1} OR content ILIKE $${queryParams.length + 1})`);
        queryParams.push(`%${search}%`);
      }
      
      if (category && category !== 'all') {
        whereConditions.push(`category = $${queryParams.length + 1}`);
        queryParams.push(category);
      }
      
      const query = `
        SELECT id, title, summary, category, subcategory, view_count, 
               helpful_votes, is_featured, created_at
        FROM knowledge_base_articles
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY is_featured DESC, helpful_votes DESC, view_count DESC
      `;
      
      const result = await db.$client.query(query, queryParams);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching knowledge base articles:", error);
      res.status(500).json({ error: "Failed to fetch knowledge base articles" });
    }
  });

  // ============= ADVANCED BILLING ENGINE ROUTES =============

  // Get billing analytics
  app.get("/api/billing/analytics", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const queries = [
        `SELECT COUNT(*) as total_invoices FROM billing_invoices WHERE tenant_id = $1`,
        `SELECT COALESCE(SUM(total_amount), 0) as total_revenue FROM billing_invoices WHERE tenant_id = $1 AND status = 'paid'`,
        `SELECT COALESCE(SUM(balance_due), 0) as outstanding_amount FROM billing_invoices WHERE tenant_id = $1 AND status != 'paid'`,
        `SELECT COUNT(*) as overdue_invoices FROM billing_invoices WHERE tenant_id = $1 AND status = 'overdue'`,
        `SELECT COALESCE(AVG(total_amount), 0) as average_invoice_amount FROM billing_invoices WHERE tenant_id = $1`,
        `SELECT COALESCE(SUM(total_amount), 0) as monthly_recurring FROM billing_invoices WHERE tenant_id = $1 AND billing_period_start >= date_trunc('month', CURRENT_DATE)`
      ];
      
      const results = await Promise.all(
        queries.map(query => db.$client.query(query, [tenantId]))
      );
      
      const totalRevenue = parseFloat(results[1].rows[0].total_revenue);
      const outstandingAmount = parseFloat(results[2].rows[0].outstanding_amount);
      const monthlyRecurring = parseFloat(results[5].rows[0].monthly_recurring);
      
      res.json({
        totalInvoices: parseInt(results[0].rows[0].total_invoices),
        totalRevenue,
        outstandingAmount,
        overdueInvoices: parseInt(results[3].rows[0].overdue_invoices),
        averageInvoiceAmount: parseFloat(results[4].rows[0].average_invoice_amount),
        collectionRate: totalRevenue > 0 ? (totalRevenue / (totalRevenue + outstandingAmount)) : 0,
        monthlyRecurringRevenue: monthlyRecurring,
        annualRecurringRevenue: monthlyRecurring * 12,
      });
    } catch (error) {
      console.error("Error fetching billing analytics:", error);
      res.status(500).json({ error: "Failed to fetch billing analytics" });
    }
  });

  // Get billing invoices
  app.get("/api/billing/invoices", requireAuth, async (req: any, res) => {
    try {
      const { status } = req.query;
      const tenantId = req.user.tenantId;
      
      let whereConditions = ['bi.tenant_id = $1'];
      const queryParams = [tenantId];
      
      if (status && status !== 'all') {
        whereConditions.push(`bi.status = $${queryParams.length + 1}`);
        queryParams.push(status);
      }
      
      const query = `
        SELECT 
          bi.*,
          br.company_name as business_record_name
        FROM billing_invoices bi
        LEFT JOIN business_records br ON bi.business_record_id = br.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY bi.created_at DESC
        LIMIT 100
      `;
      
      const result = await db.$client.query(query, queryParams);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching billing invoices:", error);
      res.status(500).json({ error: "Failed to fetch billing invoices" });
    }
  });

  // Get billing configurations
  app.get("/api/billing/configurations", requireAuth, async (req: any, res) => {
    try {
      const { type } = req.query;
      const tenantId = req.user.tenantId;
      
      let whereConditions = ['tenant_id = $1'];
      const queryParams = [tenantId];
      
      if (type && type !== 'all') {
        whereConditions.push(`billing_type = $${queryParams.length + 1}`);
        queryParams.push(type);
      }
      
      const query = `
        SELECT *
        FROM billing_configurations
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY is_default DESC, configuration_name
      `;
      
      const result = await db.$client.query(query, queryParams);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching billing configurations:", error);
      res.status(500).json({ error: "Failed to fetch billing configurations" });
    }
  });

  // Create billing configuration
  app.post("/api/billing/configurations", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const {
        configuration_name, billing_type, billing_frequency, billing_day,
        base_rate, minimum_charge, maximum_charge, overage_rate, setup_fee,
        maintenance_fee, tax_rate, tax_inclusive, contract_length_months,
        early_termination_fee, is_default
      } = req.body;
      
      // If setting as default, unset other defaults first
      if (is_default) {
        await db.$client.query(
          'UPDATE billing_configurations SET is_default = false WHERE tenant_id = $1',
          [tenantId]
        );
      }
      
      const query = `
        INSERT INTO billing_configurations (
          tenant_id, configuration_name, billing_type, billing_frequency, billing_day,
          base_rate, minimum_charge, maximum_charge, overage_rate, setup_fee,
          maintenance_fee, tax_rate, tax_inclusive, contract_length_months,
          early_termination_fee, is_default
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
      `;
      
      const result = await db.$client.query(query, [
        tenantId, configuration_name, billing_type, billing_frequency, billing_day,
        base_rate, minimum_charge, maximum_charge, overage_rate, setup_fee,
        maintenance_fee, tax_rate, tax_inclusive, contract_length_months,
        early_termination_fee, is_default
      ]);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating billing configuration:", error);
      res.status(500).json({ error: "Failed to create billing configuration" });
    }
  });

  // Get billing cycles
  app.get("/api/billing/cycles", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const query = `
        SELECT *
        FROM billing_cycles
        WHERE tenant_id = $1
        ORDER BY created_at DESC
      `;
      
      const result = await db.$client.query(query, [tenantId]);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching billing cycles:", error);
      res.status(500).json({ error: "Failed to fetch billing cycles" });
    }
  });

  // Run billing cycle
  app.post("/api/billing/cycles/run", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      
      // Create a new billing cycle
      const cycleDate = new Date().toISOString().split('T')[0];
      const cycleName = `Billing Cycle ${format(new Date(), 'MMM yyyy')}`;
      
      const cycleQuery = `
        INSERT INTO billing_cycles (
          tenant_id, cycle_name, cycle_date, status, started_at
        ) VALUES ($1, $2, $3, 'processing', NOW())
        RETURNING *
      `;
      
      const cycleResult = await db.$client.query(cycleQuery, [
        tenantId, cycleName, cycleDate
      ]);
      
      const cycle = cycleResult.rows[0];
      
      // For demo purposes, create a few sample invoices
      const sampleInvoices = [
        {
          invoice_number: `INV-${Date.now()}-001`,
          business_record_id: 'adc117e7-611d-426a-b569-6c6c0b32e234',
          amount: 299.99
        },
        {
          invoice_number: `INV-${Date.now()}-002`,
          business_record_id: 'adc117e7-611d-426a-b569-6c6c0b32e234',
          amount: 459.99
        }
      ];
      
      let totalAmount = 0;
      let invoicesGenerated = 0;
      
      for (const invoice of sampleInvoices) {
        const invoiceQuery = `
          INSERT INTO billing_invoices (
            tenant_id, business_record_id, invoice_number, invoice_date, due_date,
            billing_period_start, billing_period_end, subtotal, total_amount,
            balance_due, billing_cycle_id, auto_generated
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
        `;
        
        const invoiceDate = new Date();
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);
        
        const periodStart = new Date();
        periodStart.setMonth(periodStart.getMonth() - 1);
        const periodEnd = new Date();
        
        await db.$client.query(invoiceQuery, [
          tenantId, invoice.business_record_id, invoice.invoice_number,
          invoiceDate, dueDate, periodStart, periodEnd,
          invoice.amount, invoice.amount, invoice.amount, cycle.id
        ]);
        
        totalAmount += invoice.amount;
        invoicesGenerated++;
      }
      
      // Update billing cycle with results
      await db.$client.query(`
        UPDATE billing_cycles 
        SET status = 'completed', 
            completed_at = NOW(),
            total_customers = $1,
            processed_customers = $2,
            total_invoices_generated = $3,
            total_amount = $4
        WHERE id = $5
      `, [sampleInvoices.length, sampleInvoices.length, invoicesGenerated, totalAmount, cycle.id]);
      
      res.status(201).json({
        message: "Billing cycle completed successfully",
        cycle_id: cycle.id,
        invoices_generated: invoicesGenerated,
        total_amount: totalAmount
      });
    } catch (error) {
      console.error("Error running billing cycle:", error);
      res.status(500).json({ error: "Failed to run billing cycle" });
    }
  });

  // Get billing adjustments
  app.get("/api/billing/adjustments", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const query = `
        SELECT 
          ba.*,
          u1.name as requested_by_name,
          u2.name as approved_by_name
        FROM billing_adjustments ba
        LEFT JOIN users u1 ON ba.requested_by = u1.id
        LEFT JOIN users u2 ON ba.approved_by = u2.id
        WHERE ba.tenant_id = $1
        ORDER BY ba.created_at DESC
      `;
      
      const result = await db.$client.query(query, [tenantId]);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching billing adjustments:", error);
      res.status(500).json({ error: "Failed to fetch billing adjustments" });
    }
  });

  // Create billing adjustment
  app.post("/api/billing/adjustments", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      
      const {
        adjustment_type, adjustment_reason, amount, description,
        invoice_id, business_record_id
      } = req.body;
      
      const query = `
        INSERT INTO billing_adjustments (
          tenant_id, adjustment_type, adjustment_reason, amount, description,
          invoice_id, business_record_id, requested_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      
      const result = await db.$client.query(query, [
        tenantId, adjustment_type, adjustment_reason, amount, description,
        invoice_id, business_record_id, userId
      ]);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating billing adjustment:", error);
      res.status(500).json({ error: "Failed to create billing adjustment" });
    }
  });

  // ============= FINANCIAL FORECASTING ROUTES =============

  // Get financial metrics
  app.get("/api/financial/metrics", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const queries = [
        `SELECT COALESCE(SUM(total_forecast_amount), 0) as total_revenue_forecast FROM financial_forecasts WHERE tenant_id = $1 AND forecast_type = 'revenue' AND status = 'published'`,
        `SELECT COALESCE(SUM(net_cash_flow), 0) as cash_flow_projection FROM cash_flow_projections WHERE tenant_id = $1 AND projection_period >= date_trunc('month', CURRENT_DATE)`,
        `SELECT COALESCE(AVG(gross_margin_percentage), 0) as avg_profit_margin FROM profitability_analysis WHERE tenant_id = $1`,
        `SELECT COALESCE(AVG(growth_rate), 0) as avg_growth_rate FROM financial_forecasts WHERE tenant_id = $1`
      ];
      
      const results = await Promise.all(
        queries.map(query => db.$client.query(query, [tenantId]))
      );
      
      res.json({
        totalRevenueForecast: parseFloat(results[0].rows[0].total_revenue_forecast),
        cashFlowProjection: parseFloat(results[1].rows[0].cash_flow_projection),
        profitMargin: parseFloat(results[2].rows[0].avg_profit_margin),
        growthProjection: parseFloat(results[3].rows[0].avg_growth_rate),
        riskLevel: 'medium',
        forecastAccuracy: 0.85
      });
    } catch (error) {
      console.error("Error fetching financial metrics:", error);
      res.status(500).json({ error: "Failed to fetch financial metrics" });
    }
  });

  // Get financial forecasts
  app.get("/api/financial/forecasts", requireAuth, async (req: any, res) => {
    try {
      const { type } = req.query;
      const tenantId = req.user.tenantId;
      
      let whereConditions = ['tenant_id = $1'];
      const queryParams = [tenantId];
      
      if (type && type !== 'all') {
        whereConditions.push(`forecast_type = $${queryParams.length + 1}`);
        queryParams.push(type);
      }
      
      const query = `
        SELECT *
        FROM financial_forecasts
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY created_at DESC
      `;
      
      const result = await db.$client.query(query, queryParams);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching financial forecasts:", error);
      res.status(500).json({ error: "Failed to fetch financial forecasts" });
    }
  });

  // Create financial forecast
  app.post("/api/financial/forecasts", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      
      const {
        forecast_name, forecast_type, forecast_period, start_date, end_date,
        base_amount, growth_rate, scenario_type, assumptions
      } = req.body;
      
      // Calculate forecast amount (simplified calculation)
      const totalForecastAmount = base_amount * (1 + growth_rate);
      
      const query = `
        INSERT INTO financial_forecasts (
          tenant_id, forecast_name, forecast_type, forecast_period, start_date,
          end_date, base_amount, growth_rate, scenario_type, assumptions,
          total_forecast_amount, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;
      
      const result = await db.$client.query(query, [
        tenantId, forecast_name, forecast_type, forecast_period, start_date,
        end_date, base_amount, growth_rate, scenario_type, assumptions,
        totalForecastAmount, userId
      ]);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating financial forecast:", error);
      res.status(500).json({ error: "Failed to create financial forecast" });
    }
  });

  // Get cash flow projections
  app.get("/api/financial/cash-flow", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const query = `
        SELECT *
        FROM cash_flow_projections
        WHERE tenant_id = $1
        ORDER BY projection_period DESC
      `;
      
      const result = await db.$client.query(query, [tenantId]);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching cash flow projections:", error);
      res.status(500).json({ error: "Failed to fetch cash flow projections" });
    }
  });

  // Create cash flow projection
  app.post("/api/financial/cash-flow", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      
      const {
        projection_name, projection_period, beginning_cash, collections_forecast,
        payroll_expenses, operating_expenses, equipment_purchases, minimum_cash_required,
        assumptions
      } = req.body;
      
      // Calculate cash flow
      const totalCashInflow = beginning_cash + collections_forecast;
      const totalCashOutflow = payroll_expenses + operating_expenses + equipment_purchases;
      const netCashFlow = totalCashInflow - totalCashOutflow;
      const endingCash = beginning_cash + netCashFlow;
      const cashShortageRisk = endingCash < minimum_cash_required;
      const daysCashOnHand = endingCash > 0 ? Math.floor((endingCash / (totalCashOutflow / 30))) : 0;
      
      const query = `
        INSERT INTO cash_flow_projections (
          tenant_id, projection_name, projection_period, beginning_cash,
          collections_forecast, total_cash_inflow, payroll_expenses,
          operating_expenses, equipment_purchases, total_cash_outflow,
          net_cash_flow, ending_cash, minimum_cash_required, cash_shortage_risk,
          days_cash_on_hand, assumptions, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *
      `;
      
      const result = await db.$client.query(query, [
        tenantId, projection_name, projection_period, beginning_cash,
        collections_forecast, totalCashInflow, payroll_expenses,
        operating_expenses, equipment_purchases, totalCashOutflow,
        netCashFlow, endingCash, minimum_cash_required, cashShortageRisk,
        daysCashOnHand, assumptions, userId
      ]);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating cash flow projection:", error);
      res.status(500).json({ error: "Failed to create cash flow projection" });
    }
  });

  // Get profitability analysis
  app.get("/api/financial/profitability", requireAuth, async (req: any, res) => {
    try {
      const { type } = req.query;
      const tenantId = req.user.tenantId;
      
      let whereConditions = ['tenant_id = $1'];
      const queryParams = [tenantId];
      
      if (type && type !== 'all') {
        whereConditions.push(`analysis_type = $${queryParams.length + 1}`);
        queryParams.push(type);
      }
      
      const query = `
        SELECT *
        FROM profitability_analysis
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY created_at DESC
      `;
      
      const result = await db.$client.query(query, queryParams);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching profitability analysis:", error);
      res.status(500).json({ error: "Failed to fetch profitability analysis" });
    }
  });

  // Run profitability analysis
  app.post("/api/financial/profitability/run", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      
      // Sample profitability analysis for demo
      const sampleAnalyses = [
        {
          analysis_name: 'Customer Profitability Analysis',
          analysis_type: 'customer',
          subject_name: 'TechCorp Solutions',
          service_revenue: 25000,
          total_costs: 18000,
          gross_margin: 28.0,
          net_margin: 22.5
        },
        {
          analysis_name: 'Service Line Analysis',
          analysis_type: 'service_line',
          subject_name: 'Managed Print Services',
          service_revenue: 45000,
          total_costs: 32000,
          gross_margin: 28.9,
          net_margin: 24.2
        }
      ];
      
      for (const analysis of sampleAnalyses) {
        const grossProfit = analysis.service_revenue - analysis.total_costs;
        const netProfit = grossProfit * 0.85; // Simplified calculation
        const roi = (netProfit / analysis.total_costs) * 100;
        
        const query = `
          INSERT INTO profitability_analysis (
            tenant_id, analysis_name, analysis_type, analysis_period_start,
            analysis_period_end, subject_type, subject_name, service_revenue,
            total_revenue, total_costs, gross_profit, gross_margin_percentage,
            net_profit, net_margin_percentage, roi_percentage, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        `;
        
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        const endDate = new Date();
        
        await db.$client.query(query, [
          tenantId, analysis.analysis_name, analysis.analysis_type, startDate,
          endDate, analysis.analysis_type, analysis.subject_name, analysis.service_revenue,
          analysis.service_revenue, analysis.total_costs, grossProfit, analysis.gross_margin,
          netProfit, analysis.net_margin, roi, userId
        ]);
      }
      
      res.status(201).json({
        message: "Profitability analysis completed",
        analyses_created: sampleAnalyses.length
      });
    } catch (error) {
      console.error("Error running profitability analysis:", error);
      res.status(500).json({ error: "Failed to run profitability analysis" });
    }
  });

  // Get financial KPIs
  app.get("/api/financial/kpis", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const query = `
        SELECT *
        FROM financial_kpis
        WHERE tenant_id = $1
        ORDER BY calculation_period DESC
      `;
      
      const result = await db.$client.query(query, [tenantId]);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching financial KPIs:", error);
      res.status(500).json({ error: "Failed to fetch financial KPIs" });
    }
  });

  // ============= EQUIPMENT LIFECYCLE MANAGEMENT ROUTES =============

  // Get equipment lifecycle metrics
  app.get("/api/equipment-lifecycle/metrics", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const queries = [
        `SELECT COUNT(*) as total_equipment FROM equipment_lifecycle_stages WHERE tenant_id = $1 AND current_stage != 'active'`,
        `SELECT COUNT(*) as pending_deliveries FROM equipment_delivery_schedules WHERE tenant_id = $1 AND status IN ('scheduled', 'confirmed')`,
        `SELECT COUNT(*) as scheduled_installations FROM equipment_installations WHERE tenant_id = $1 AND status IN ('scheduled', 'in_progress')`,
        `SELECT COUNT(*) as active_assets FROM equipment_asset_tracking WHERE tenant_id = $1 AND current_status = 'active'`,
        `SELECT COALESCE(AVG(estimated_duration_hours), 0) as avg_installation_time FROM equipment_installations WHERE tenant_id = $1`,
        `SELECT COALESCE(AVG(customer_satisfaction_rating), 0) as avg_satisfaction FROM equipment_installations WHERE tenant_id = $1 AND customer_satisfaction_rating IS NOT NULL`
      ];
      
      const results = await Promise.all(
        queries.map(query => db.$client.query(query, [tenantId]))
      );
      
      res.json({
        totalEquipmentInProcess: parseInt(results[0].rows[0].total_equipment),
        pendingDeliveries: parseInt(results[1].rows[0].pending_deliveries),
        scheduledInstallations: parseInt(results[2].rows[0].scheduled_installations),
        activeAssets: parseInt(results[3].rows[0].active_assets),
        averageInstallationTime: parseFloat(results[4].rows[0].avg_installation_time),
        customerSatisfactionRating: parseFloat(results[5].rows[0].avg_satisfaction),
      });
    } catch (error) {
      console.error("Error fetching equipment lifecycle metrics:", error);
      res.status(500).json({ error: "Failed to fetch equipment lifecycle metrics" });
    }
  });

  // Get equipment lifecycle stages
  app.get("/api/equipment-lifecycle/stages", requireAuth, async (req: any, res) => {
    try {
      const { stage, status } = req.query;
      const tenantId = req.user.tenantId;
      
      let whereConditions = ['els.tenant_id = $1'];
      const queryParams = [tenantId];
      
      if (stage && stage !== 'all') {
        whereConditions.push(`els.current_stage = $${queryParams.length + 1}`);
        queryParams.push(stage);
      }
      
      if (status && status !== 'all') {
        whereConditions.push(`els.stage_status = $${queryParams.length + 1}`);
        queryParams.push(status);
      }
      
      const query = `
        SELECT 
          els.*,
          br.company_name as customer_name,
          u.name as assigned_to_name
        FROM equipment_lifecycle_stages els
        LEFT JOIN business_records br ON els.business_record_id = br.id
        LEFT JOIN users u ON els.assigned_to = u.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY els.stage_started_at DESC
      `;
      
      const result = await db.$client.query(query, queryParams);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching equipment lifecycle stages:", error);
      res.status(500).json({ error: "Failed to fetch equipment lifecycle stages" });
    }
  });

  // Get purchase orders
  app.get("/api/equipment-lifecycle/purchase-orders", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const query = `
        SELECT 
          epo.*,
          br.company_name as customer_name,
          (SELECT COUNT(*) FROM po_line_items WHERE purchase_order_id = epo.id) as line_items_count
        FROM equipment_purchase_orders epo
        LEFT JOIN business_records br ON epo.business_record_id = br.id
        WHERE epo.tenant_id = $1
        ORDER BY epo.created_at DESC
      `;
      
      const result = await db.$client.query(query, [tenantId]);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching purchase orders:", error);
      res.status(500).json({ error: "Failed to fetch purchase orders" });
    }
  });

  // Create purchase order
  app.post("/api/equipment-lifecycle/purchase-orders", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      
      const {
        vendor_name, order_date, requested_delivery_date, customer_id,
        delivery_address, special_instructions, items
      } = req.body;
      
      // Generate PO number
      const poNumber = `PO-${Date.now()}`;
      
      // Calculate totals
      let subtotal = 0;
      items.forEach((item: any) => {
        subtotal += item.quantity * item.unit_price;
      });
      const taxAmount = subtotal * 0.085; // 8.5% tax
      const totalAmount = subtotal + taxAmount;
      
      // Create purchase order
      const poQuery = `
        INSERT INTO equipment_purchase_orders (
          tenant_id, po_number, vendor_name, order_date, requested_delivery_date,
          customer_id, business_record_id, delivery_address, special_instructions,
          subtotal, tax_amount, total_amount, requested_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;
      
      const poResult = await db.$client.query(poQuery, [
        tenantId, poNumber, vendor_name, order_date, requested_delivery_date,
        customer_id, customer_id, delivery_address, special_instructions,
        subtotal, taxAmount, totalAmount, userId
      ]);
      
      const po = poResult.rows[0];
      
      // Create line items
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const lineTotal = item.quantity * item.unit_price;
        
        const lineItemQuery = `
          INSERT INTO po_line_items (
            tenant_id, purchase_order_id, line_number, equipment_model,
            equipment_brand, description, quantity, unit_price, line_total
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `;
        
        await db.$client.query(lineItemQuery, [
          tenantId, po.id, i + 1, item.equipment_model,
          item.equipment_brand, item.description, item.quantity, 
          item.unit_price, lineTotal
        ]);
      }
      
      res.status(201).json(po);
    } catch (error) {
      console.error("Error creating purchase order:", error);
      res.status(500).json({ error: "Failed to create purchase order" });
    }
  });

  // Get delivery schedules
  app.get("/api/equipment-lifecycle/deliveries", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const query = `
        SELECT *
        FROM equipment_delivery_schedules
        WHERE tenant_id = $1
        ORDER BY scheduled_date DESC
      `;
      
      const result = await db.$client.query(query, [tenantId]);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching delivery schedules:", error);
      res.status(500).json({ error: "Failed to fetch delivery schedules" });
    }
  });

  // Create delivery schedule
  app.post("/api/equipment-lifecycle/deliveries", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const {
        purchase_order_id, scheduled_date, time_window_start, time_window_end,
        delivery_type, contact_person, contact_phone, contact_email,
        delivery_address, special_equipment_required, delivery_instructions
      } = req.body;
      
      const deliveryId = `DEL-${Date.now()}`;
      
      const query = `
        INSERT INTO equipment_delivery_schedules (
          tenant_id, delivery_id, purchase_order_id, scheduled_date,
          time_window_start, time_window_end, delivery_type, contact_person,
          contact_phone, contact_email, delivery_address, special_equipment_required,
          delivery_instructions
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;
      
      const result = await db.$client.query(query, [
        tenantId, deliveryId, purchase_order_id, scheduled_date,
        time_window_start, time_window_end, delivery_type, contact_person,
        contact_phone, contact_email, delivery_address, special_equipment_required,
        delivery_instructions
      ]);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating delivery schedule:", error);
      res.status(500).json({ error: "Failed to create delivery schedule" });
    }
  });

  // Get installations
  app.get("/api/equipment-lifecycle/installations", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const query = `
        SELECT 
          ei.*,
          u.name as lead_technician_name,
          els.equipment_model,
          els.equipment_brand
        FROM equipment_installations ei
        LEFT JOIN users u ON ei.lead_technician_id = u.id
        LEFT JOIN equipment_lifecycle_stages els ON ei.equipment_id = els.equipment_id
        WHERE ei.tenant_id = $1
        ORDER BY ei.scheduled_date DESC
      `;
      
      const result = await db.$client.query(query, [tenantId]);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching installations:", error);
      res.status(500).json({ error: "Failed to fetch installations" });
    }
  });

  // Create installation
  app.post("/api/equipment-lifecycle/installations", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const {
        equipment_id, scheduled_date, scheduled_time_start, scheduled_time_end,
        installation_location, site_contact_person, site_contact_phone,
        lead_technician_id, power_requirements, network_requirements,
        environmental_conditions
      } = req.body;
      
      const query = `
        INSERT INTO equipment_installations (
          tenant_id, equipment_id, scheduled_date, scheduled_time_start,
          scheduled_time_end, installation_location, site_contact_person,
          site_contact_phone, lead_technician_id, power_requirements,
          network_requirements, environmental_conditions
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;
      
      const result = await db.$client.query(query, [
        tenantId, equipment_id, scheduled_date, scheduled_time_start,
        scheduled_time_end, installation_location, site_contact_person,
        site_contact_phone, lead_technician_id, power_requirements,
        network_requirements, environmental_conditions
      ]);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating installation:", error);
      res.status(500).json({ error: "Failed to create installation" });
    }
  });

  // Get asset tracking
  app.get("/api/equipment-lifecycle/assets", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const query = `
        SELECT 
          eat.*,
          br.company_name as customer_name
        FROM equipment_asset_tracking eat
        LEFT JOIN business_records br ON eat.business_record_id = br.id
        WHERE eat.tenant_id = $1
        ORDER BY eat.created_at DESC
      `;
      
      const result = await db.$client.query(query, [tenantId]);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching asset tracking:", error);
      res.status(500).json({ error: "Failed to fetch asset tracking" });
    }
  });

  // ============= COMMISSION MANAGEMENT ROUTES =============

  // Get commission metrics
  app.get("/api/commission/metrics", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const queries = [
        `SELECT COALESCE(SUM(net_payment_amount), 0) as total_paid FROM commission_payments WHERE tenant_id = $1 AND payment_status = 'completed' AND EXTRACT(MONTH FROM payment_date) = EXTRACT(MONTH FROM CURRENT_DATE)`,
        `SELECT COALESCE(SUM(net_commission_amount), 0) as pending_commissions FROM commission_calculations WHERE tenant_id = $1 AND payment_status = 'pending'`,
        `SELECT COALESCE(AVG(base_commission_rate), 0) as avg_rate FROM commission_calculations WHERE tenant_id = $1`,
        `SELECT COALESCE(MAX(net_commission_amount), 0) as top_commission FROM commission_calculations WHERE tenant_id = $1`,
        `SELECT COUNT(*) as active_disputes FROM commission_disputes WHERE tenant_id = $1 AND status IN ('open', 'under_review')`,
        `SELECT COALESCE(AVG(achievement_percentage), 0) as quota_attainment FROM sales_quotas WHERE tenant_id = $1 AND status = 'active'`
      ];
      
      const results = await Promise.all(
        queries.map(query => db.$client.query(query, [tenantId]))
      );
      
      res.json({
        totalCommissionsPaid: parseFloat(results[0].rows[0].total_paid),
        pendingCommissions: parseFloat(results[1].rows[0].pending_commissions),
        averageCommissionRate: parseFloat(results[2].rows[0].avg_rate),
        topPerformerCommission: parseFloat(results[3].rows[0].top_commission),
        activeDisputes: parseInt(results[4].rows[0].active_disputes),
        quotaAttainment: parseFloat(results[5].rows[0].quota_attainment),
      });
    } catch (error) {
      console.error("Error fetching commission metrics:", error);
      res.status(500).json({ error: "Failed to fetch commission metrics" });
    }
  });

  // Get commission structures
  app.get("/api/commission/structures", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const query = `
        SELECT *
        FROM commission_structures
        WHERE tenant_id = $1
        ORDER BY created_at DESC
      `;
      
      const result = await db.$client.query(query, [tenantId]);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching commission structures:", error);
      res.status(500).json({ error: "Failed to fetch commission structures" });
    }
  });

  // Create commission structure
  app.post("/api/commission/structures", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      
      const {
        structure_name, structure_type, applies_to, base_rate, calculation_basis,
        calculation_period, minimum_threshold, maximum_cap, effective_date, expiration_date
      } = req.body;
      
      const query = `
        INSERT INTO commission_structures (
          tenant_id, structure_name, structure_type, applies_to, base_rate,
          calculation_basis, calculation_period, minimum_threshold, maximum_cap,
          effective_date, expiration_date, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;
      
      const result = await db.$client.query(query, [
        tenantId, structure_name, structure_type, applies_to, base_rate,
        calculation_basis, calculation_period, minimum_threshold, maximum_cap,
        effective_date, expiration_date, userId
      ]);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating commission structure:", error);
      res.status(500).json({ error: "Failed to create commission structure" });
    }
  });

  // Get commission calculations
  app.get("/api/commission/calculations", requireAuth, async (req: any, res) => {
    try {
      const { period, status } = req.query;
      const tenantId = req.user.tenantId;
      
      let whereConditions = ['cc.tenant_id = $1'];
      const queryParams = [tenantId];
      
      if (period && period !== 'all') {
        switch (period) {
          case 'current_month':
            whereConditions.push(`EXTRACT(MONTH FROM cc.calculation_period_start) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM cc.calculation_period_start) = EXTRACT(YEAR FROM CURRENT_DATE)`);
            break;
          case 'last_month':
            whereConditions.push(`EXTRACT(MONTH FROM cc.calculation_period_start) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month') AND EXTRACT(YEAR FROM cc.calculation_period_start) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month')`);
            break;
          case 'current_quarter':
            whereConditions.push(`EXTRACT(QUARTER FROM cc.calculation_period_start) = EXTRACT(QUARTER FROM CURRENT_DATE) AND EXTRACT(YEAR FROM cc.calculation_period_start) = EXTRACT(YEAR FROM CURRENT_DATE)`);
            break;
        }
      }
      
      if (status && status !== 'all') {
        whereConditions.push(`cc.payment_status = $${queryParams.length + 1}`);
        queryParams.push(status);
      }
      
      const query = `
        SELECT 
          cc.*,
          u.name as employee_name,
          cs.structure_name
        FROM commission_calculations cc
        LEFT JOIN users u ON cc.employee_id = u.id
        LEFT JOIN commission_structures cs ON cc.commission_structure_id = cs.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY cc.created_at DESC
      `;
      
      const result = await db.$client.query(query, queryParams);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching commission calculations:", error);
      res.status(500).json({ error: "Failed to fetch commission calculations" });
    }
  });

  // Run commission calculations
  app.post("/api/commission/calculations/run", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      
      // Sample commission calculations for demo
      const sampleCalculations = [
        {
          employee_name: 'John Smith',
          total_sales: 125000,
          commission_rate: 0.05,
          commission_amount: 6250
        },
        {
          employee_name: 'Sarah Johnson',
          total_sales: 98000,
          commission_rate: 0.045,
          commission_amount: 4410
        }
      ];
      
      // Get active users
      const usersQuery = `SELECT id, name FROM users WHERE tenant_id = $1 AND role LIKE '%sales%' LIMIT 2`;
      const usersResult = await db.$client.query(usersQuery, [tenantId]);
      const users = usersResult.rows;
      
      // Get active commission structure
      const structureQuery = `SELECT id FROM commission_structures WHERE tenant_id = $1 AND is_active = true LIMIT 1`;
      const structureResult = await db.$client.query(structureQuery, [tenantId]);
      const structureId = structureResult.rows[0]?.id;
      
      if (!structureId) {
        return res.status(400).json({ error: "No active commission structure found" });
      }
      
      const startDate = new Date();
      startDate.setDate(1); // First day of current month
      const endDate = new Date();
      
      for (let i = 0; i < Math.min(sampleCalculations.length, users.length); i++) {
        const calc = sampleCalculations[i];
        const user = users[i];
        
        const query = `
          INSERT INTO commission_calculations (
            tenant_id, calculation_period_start, calculation_period_end,
            employee_id, commission_structure_id, total_sales_amount,
            commission_base_amount, base_commission_rate, base_commission_amount,
            gross_commission_amount, net_commission_amount, calculated_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `;
        
        await db.$client.query(query, [
          tenantId, startDate, endDate, user.id, structureId,
          calc.total_sales, calc.total_sales, calc.commission_rate,
          calc.commission_amount, calc.commission_amount, calc.commission_amount,
          userId
        ]);
      }
      
      res.status(201).json({
        message: "Commission calculations completed",
        calculations_created: Math.min(sampleCalculations.length, users.length)
      });
    } catch (error) {
      console.error("Error running commission calculations:", error);
      res.status(500).json({ error: "Failed to run commission calculations" });
    }
  });

  // Get sales quotas
  app.get("/api/commission/quotas", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const query = `
        SELECT 
          sq.*,
          u.name as employee_name
        FROM sales_quotas sq
        LEFT JOIN users u ON sq.employee_id = u.id
        WHERE sq.tenant_id = $1
        ORDER BY sq.created_at DESC
      `;
      
      const result = await db.$client.query(query, [tenantId]);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching sales quotas:", error);
      res.status(500).json({ error: "Failed to fetch sales quotas" });
    }
  });

  // Create sales quota
  app.post("/api/commission/quotas", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      
      const {
        employee_id, quota_period_start, quota_period_end, quota_type,
        quota_amount, stretch_goal_amount, minimum_threshold
      } = req.body;
      
      const query = `
        INSERT INTO sales_quotas (
          tenant_id, employee_id, quota_period_start, quota_period_end,
          quota_type, quota_amount, stretch_goal_amount, minimum_threshold,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      
      const result = await db.$client.query(query, [
        tenantId, employee_id, quota_period_start, quota_period_end,
        quota_type, quota_amount, stretch_goal_amount, minimum_threshold,
        userId
      ]);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating sales quota:", error);
      res.status(500).json({ error: "Failed to create sales quota" });
    }
  });

  // Get commission payments
  app.get("/api/commission/payments", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const query = `
        SELECT 
          cp.*,
          u.name as employee_name
        FROM commission_payments cp
        LEFT JOIN users u ON cp.employee_id = u.id
        WHERE cp.tenant_id = $1
        ORDER BY cp.payment_date DESC
      `;
      
      const result = await db.$client.query(query, [tenantId]);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching commission payments:", error);
      res.status(500).json({ error: "Failed to fetch commission payments" });
    }
  });

  // Get commission disputes
  app.get("/api/commission/disputes", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const query = `
        SELECT 
          cd.*,
          u.name as employee_name
        FROM commission_disputes cd
        LEFT JOIN users u ON cd.employee_id = u.id
        WHERE cd.tenant_id = $1
        ORDER BY cd.created_at DESC
      `;
      
      const result = await db.$client.query(query, [tenantId]);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching commission disputes:", error);
      res.status(500).json({ error: "Failed to fetch commission disputes" });
    }
  });

  // Create commission dispute
  app.post("/api/commission/disputes", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const {
        dispute_type, employee_id, commission_calculation_id, dispute_amount,
        claimed_amount, description, priority
      } = req.body;
      
      const disputeNumber = `DISP-${Date.now()}`;
      const disputeDate = new Date().toISOString().split('T')[0];
      
      const query = `
        INSERT INTO commission_disputes (
          tenant_id, dispute_number, dispute_type, employee_id,
          commission_calculation_id, dispute_amount, claimed_amount,
          description, priority, dispute_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;
      
      const result = await db.$client.query(query, [
        tenantId, disputeNumber, dispute_type, employee_id,
        commission_calculation_id, dispute_amount, claimed_amount,
        description, priority, disputeDate
      ]);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating commission dispute:", error);
      res.status(500).json({ error: "Failed to create commission dispute" });
    }
  });

  // ============= REMOTE MONITORING ROUTES =============

  // Get monitoring metrics
  app.get("/api/monitoring/metrics", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const queries = [
        `SELECT COUNT(*) as total_devices FROM iot_devices WHERE tenant_id = $1`,
        `SELECT COUNT(*) as online_devices FROM iot_devices WHERE tenant_id = $1 AND device_status = 'active'`,
        `SELECT COUNT(*) as active_alerts FROM predictive_alerts WHERE tenant_id = $1 AND alert_status IN ('open', 'acknowledged')`,
        `SELECT COUNT(*) as critical_alerts FROM predictive_alerts WHERE tenant_id = $1 AND severity = 'critical' AND alert_status IN ('open', 'acknowledged')`,
        `SELECT COALESCE(AVG(uptime_percentage), 0) as avg_uptime FROM equipment_status_monitoring WHERE tenant_id = $1`,
        `SELECT COUNT(*) as devices_attention FROM iot_devices WHERE tenant_id = $1 AND device_status IN ('error', 'maintenance')`
      ];
      
      const results = await Promise.all(
        queries.map(query => db.$client.query(query, [tenantId]))
      );
      
      res.json({
        totalDevices: parseInt(results[0].rows[0].total_devices),
        onlineDevices: parseInt(results[1].rows[0].online_devices),
        activeAlerts: parseInt(results[2].rows[0].active_alerts),
        criticalAlerts: parseInt(results[3].rows[0].critical_alerts),
        averageUptime: parseFloat(results[4].rows[0].avg_uptime),
        devicesRequiringAttention: parseInt(results[5].rows[0].devices_attention),
      });
    } catch (error) {
      console.error("Error fetching monitoring metrics:", error);
      res.status(500).json({ error: "Failed to fetch monitoring metrics" });
    }
  });

  // Get IoT devices
  app.get("/api/monitoring/devices", requireAuth, async (req: any, res) => {
    try {
      const { type, status } = req.query;
      const tenantId = req.user.tenantId;
      
      let whereConditions = ['iot.tenant_id = $1'];
      const queryParams = [tenantId];
      
      if (type && type !== 'all') {
        whereConditions.push(`iot.device_type = $${queryParams.length + 1}`);
        queryParams.push(type);
      }
      
      if (status && status !== 'all') {
        whereConditions.push(`iot.device_status = $${queryParams.length + 1}`);
        queryParams.push(status);
      }
      
      const query = `
        SELECT 
          iot.*,
          br.company_name as customer_name
        FROM iot_devices iot
        LEFT JOIN business_records br ON iot.business_record_id = br.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY iot.created_at DESC
      `;
      
      const result = await db.$client.query(query, queryParams);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching IoT devices:", error);
      res.status(500).json({ error: "Failed to fetch IoT devices" });
    }
  });

  // Register IoT device
  app.post("/api/monitoring/devices", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const {
        device_name, device_type, manufacturer, model, device_serial_number,
        connection_type, customer_id, installation_location, ip_address,
        monitoring_enabled, data_collection_interval
      } = req.body;
      
      const deviceId = `DEV-${Date.now()}`;
      
      const query = `
        INSERT INTO iot_devices (
          tenant_id, device_id, device_name, device_type, manufacturer,
          model, device_serial_number, connection_type, customer_id,
          business_record_id, installation_location, ip_address,
          monitoring_enabled, data_collection_interval
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `;
      
      const result = await db.$client.query(query, [
        tenantId, deviceId, device_name, device_type, manufacturer,
        model, device_serial_number, connection_type, customer_id,
        customer_id, installation_location, ip_address,
        monitoring_enabled, data_collection_interval
      ]);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error registering IoT device:", error);
      res.status(500).json({ error: "Failed to register IoT device" });
    }
  });

  // Get equipment status
  app.get("/api/monitoring/equipment-status", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const query = `
        SELECT 
          esm.*,
          iot.device_name
        FROM equipment_status_monitoring esm
        LEFT JOIN iot_devices iot ON esm.device_id = iot.device_id
        WHERE esm.tenant_id = $1
        ORDER BY esm.status_timestamp DESC
      `;
      
      const result = await db.$client.query(query, [tenantId]);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching equipment status:", error);
      res.status(500).json({ error: "Failed to fetch equipment status" });
    }
  });

  // Get predictive alerts
  app.get("/api/monitoring/alerts", requireAuth, async (req: any, res) => {
    try {
      const { severity } = req.query;
      const tenantId = req.user.tenantId;
      
      let whereConditions = ['pa.tenant_id = $1'];
      const queryParams = [tenantId];
      
      if (severity && severity !== 'all') {
        whereConditions.push(`pa.severity = $${queryParams.length + 1}`);
        queryParams.push(severity);
      }
      
      const query = `
        SELECT 
          pa.*,
          iot.device_name,
          br.company_name as customer_name
        FROM predictive_alerts pa
        LEFT JOIN iot_devices iot ON pa.device_id = iot.device_id
        LEFT JOIN business_records br ON pa.business_record_id = br.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY pa.created_at DESC
      `;
      
      const result = await db.$client.query(query, queryParams);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching predictive alerts:", error);
      res.status(500).json({ error: "Failed to fetch predictive alerts" });
    }
  });

  // Get performance trends
  app.get("/api/monitoring/trends", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const query = `
        SELECT 
          dpt.*,
          iot.device_name
        FROM device_performance_trends dpt
        LEFT JOIN iot_devices iot ON dpt.device_id = iot.device_id
        WHERE dpt.tenant_id = $1
        ORDER BY dpt.created_at DESC
      `;
      
      const result = await db.$client.query(query, [tenantId]);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching performance trends:", error);
      res.status(500).json({ error: "Failed to fetch performance trends" });
    }
  });

  // Sync devices (simulate data collection)
  app.post("/api/monitoring/sync", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      // Get active devices
      const devicesQuery = `SELECT * FROM iot_devices WHERE tenant_id = $1 AND monitoring_enabled = true`;
      const devicesResult = await db.$client.query(devicesQuery, [tenantId]);
      const devices = devicesResult.rows;
      
      let syncedDevices = 0;
      
      for (const device of devices) {
        // Update device ping time
        await db.$client.query(
          `UPDATE iot_devices SET last_ping_time = NOW(), last_data_received = NOW() WHERE id = $1`,
          [device.id]
        );
        
        // Create sample equipment status
        const statusQuery = `
          INSERT INTO equipment_status_monitoring (
            tenant_id, equipment_id, device_id, status_timestamp,
            operational_status, power_status, connectivity_status,
            current_job_count, total_page_count, error_count,
            temperature, humidity, uptime_percentage
          ) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `;
        
        await db.$client.query(statusQuery, [
          tenantId, device.equipment_id || device.device_id, device.device_id,
          'running', 'on', 'connected',
          Math.floor(Math.random() * 5), // current_job_count
          Math.floor(Math.random() * 100000) + 50000, // total_page_count
          Math.floor(Math.random() * 3), // error_count
          20 + Math.random() * 10, // temperature
          40 + Math.random() * 20, // humidity
          95 + Math.random() * 5 // uptime_percentage
        ]);
        
        syncedDevices++;
      }
      
      res.status(200).json({
        message: "Device sync completed",
        synced_devices: syncedDevices
      });
    } catch (error) {
      console.error("Error syncing devices:", error);
      res.status(500).json({ error: "Failed to sync devices" });
    }
  });

  // ============= MOBILE SERVICE APP ROUTES =============

  // Get mobile app metrics
  app.get("/api/mobile/metrics", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const queries = [
        `SELECT COUNT(*) as active_work_orders FROM mobile_work_orders WHERE tenant_id = $1 AND status IN ('assigned', 'en_route', 'on_site', 'in_progress')`,
        `SELECT COUNT(DISTINCT technician_id) as technicians_in_field FROM technician_locations WHERE tenant_id = $1 AND recorded_at > NOW() - INTERVAL '1 hour'`,
        `SELECT COUNT(*) as pending_parts_orders FROM mobile_field_orders WHERE tenant_id = $1 AND status IN ('submitted', 'approved', 'processing')`,
        `SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (arrival_time - created_at))/60), 0) as avg_response_time FROM mobile_work_orders WHERE tenant_id = $1 AND arrival_time IS NOT NULL`,
        `SELECT COALESCE(AVG(CASE WHEN status = 'completed' THEN 1.0 ELSE 0.0 END) * 100, 0) as completion_rate FROM mobile_work_orders WHERE tenant_id = $1`,
        `SELECT COALESCE(AVG(customer_satisfaction_rating), 0) as customer_satisfaction FROM mobile_work_orders WHERE tenant_id = $1 AND customer_satisfaction_rating IS NOT NULL`
      ];
      
      const results = await Promise.all(
        queries.map(query => db.$client.query(query, [tenantId]))
      );
      
      res.json({
        activeWorkOrders: parseInt(results[0].rows[0].active_work_orders),
        techniciansInField: parseInt(results[1].rows[0].technicians_in_field),
        pendingPartsOrders: parseInt(results[2].rows[0].pending_parts_orders),
        averageResponseTime: parseFloat(results[3].rows[0].avg_response_time),
        completionRate: parseFloat(results[4].rows[0].completion_rate),
        customerSatisfaction: parseFloat(results[5].rows[0].customer_satisfaction),
      });
    } catch (error) {
      console.error("Error fetching mobile metrics:", error);
      res.status(500).json({ error: "Failed to fetch mobile metrics" });
    }
  });

  // Get mobile work orders
  app.get("/api/mobile/work-orders", requireAuth, async (req: any, res) => {
    try {
      const { status, priority, technician } = req.query;
      const tenantId = req.user.tenantId;
      
      let whereConditions = ['mwo.tenant_id = $1'];
      const queryParams = [tenantId];
      
      if (status && status !== 'all') {
        whereConditions.push(`mwo.status = $${queryParams.length + 1}`);
        queryParams.push(status);
      }
      
      if (priority && priority !== 'all') {
        whereConditions.push(`mwo.priority = $${queryParams.length + 1}`);
        queryParams.push(priority);
      }
      
      if (technician && technician !== 'all') {
        whereConditions.push(`mwo.assigned_technician_id = $${queryParams.length + 1}`);
        queryParams.push(technician);
      }
      
      const query = `
        SELECT 
          mwo.*,
          br.company_name as customer_name,
          u.name as assigned_technician_name
        FROM mobile_work_orders mwo
        LEFT JOIN business_records br ON mwo.business_record_id = br.id
        LEFT JOIN users u ON mwo.assigned_technician_id = u.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY mwo.created_at DESC
      `;
      
      const result = await db.$client.query(query, queryParams);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching mobile work orders:", error);
      res.status(500).json({ error: "Failed to fetch mobile work orders" });
    }
  });

  // Create mobile work order
  app.post("/api/mobile/work-orders", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const {
        work_order_type, priority, customer_id, service_address, assigned_technician_id,
        problem_description, scheduled_date, scheduled_time_start, estimated_duration_hours,
        site_contact_name, site_contact_phone, access_instructions
      } = req.body;
      
      const workOrderNumber = `WO-${Date.now()}`;
      
      const query = `
        INSERT INTO mobile_work_orders (
          tenant_id, work_order_number, work_order_type, priority, customer_id,
          business_record_id, service_address, assigned_technician_id, problem_description,
          scheduled_date, scheduled_time_start, estimated_duration_hours,
          site_contact_name, site_contact_phone, access_instructions
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
      `;
      
      const result = await db.$client.query(query, [
        tenantId, workOrderNumber, work_order_type, priority, customer_id,
        customer_id, service_address, assigned_technician_id, problem_description,
        scheduled_date, scheduled_time_start, estimated_duration_hours,
        site_contact_name, site_contact_phone, access_instructions
      ]);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating mobile work order:", error);
      res.status(500).json({ error: "Failed to create mobile work order" });
    }
  });

  // Get mobile parts inventory
  app.get("/api/mobile/parts-inventory", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const query = `
        SELECT *
        FROM mobile_parts_inventory
        WHERE tenant_id = $1 AND is_active = true
        ORDER BY commonly_used DESC, part_name ASC
      `;
      
      const result = await db.$client.query(query, [tenantId]);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching mobile parts inventory:", error);
      res.status(500).json({ error: "Failed to fetch mobile parts inventory" });
    }
  });

  // Get mobile field orders
  app.get("/api/mobile/field-orders", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const query = `
        SELECT 
          mfo.*,
          u.name as technician_name,
          (SELECT COUNT(*) FROM mobile_order_line_items WHERE field_order_id = mfo.id) as line_items_count
        FROM mobile_field_orders mfo
        LEFT JOIN users u ON mfo.technician_id = u.id
        WHERE mfo.tenant_id = $1
        ORDER BY mfo.created_at DESC
      `;
      
      const result = await db.$client.query(query, [tenantId]);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching mobile field orders:", error);
      res.status(500).json({ error: "Failed to fetch mobile field orders" });
    }
  });

  // Create mobile field order
  app.post("/api/mobile/field-orders", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const {
        order_type, technician_id, work_order_id, delivery_method, urgency,
        delivery_address, requested_delivery_date, parts
      } = req.body;
      
      const orderNumber = `FO-${Date.now()}`;
      const orderDate = new Date().toISOString().split('T')[0];
      
      // Calculate total
      let subtotal = 0;
      // For demo purposes, use sample pricing
      subtotal = parts.length * 50; // Sample pricing
      const taxAmount = subtotal * 0.085;
      const totalAmount = subtotal + taxAmount;
      
      const query = `
        INSERT INTO mobile_field_orders (
          tenant_id, order_number, order_type, technician_id, work_order_id,
          delivery_method, urgency, delivery_address, requested_delivery_date,
          order_date, subtotal, tax_amount, total_amount
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;
      
      const result = await db.$client.query(query, [
        tenantId, orderNumber, order_type, technician_id, work_order_id,
        delivery_method, urgency, delivery_address, requested_delivery_date,
        orderDate, subtotal, taxAmount, totalAmount
      ]);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating mobile field order:", error);
      res.status(500).json({ error: "Failed to create mobile field order" });
    }
  });

  // Get technician locations
  app.get("/api/mobile/technician-locations", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const query = `
        SELECT 
          tl.*,
          u.name as technician_name,
          mwo.work_order_number,
          br.company_name as customer_name
        FROM technician_locations tl
        LEFT JOIN users u ON tl.technician_id = u.id
        LEFT JOIN mobile_work_orders mwo ON tl.work_order_id = mwo.id
        LEFT JOIN business_records br ON tl.customer_id = br.id
        WHERE tl.tenant_id = $1
        ORDER BY tl.recorded_at DESC
      `;
      
      const result = await db.$client.query(query, [tenantId]);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching technician locations:", error);
      res.status(500).json({ error: "Failed to fetch technician locations" });
    }
  });

  // Get mobile app sessions
  app.get("/api/mobile/app-sessions", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const query = `
        SELECT 
          mas.*,
          u.name as technician_name
        FROM mobile_app_sessions mas
        LEFT JOIN users u ON mas.technician_id = u.id
        WHERE mas.tenant_id = $1
        ORDER BY mas.session_start DESC
      `;
      
      const result = await db.$client.query(query, [tenantId]);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching mobile app sessions:", error);
      res.status(500).json({ error: "Failed to fetch mobile app sessions" });
    }
  });

  // Sync mobile data
  app.post("/api/mobile/sync", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      // Get active technicians
      const techniciansQuery = `SELECT id, name FROM users WHERE tenant_id = $1 AND role LIKE '%technician%'`;
      const techniciansResult = await db.$client.query(techniciansQuery, [tenantId]);
      const technicians = techniciansResult.rows;
      
      let syncedRecords = 0;
      
      // Create sample technician locations
      for (const tech of technicians) {
        const locationQuery = `
          INSERT INTO technician_locations (
            tenant_id, technician_id, recorded_at, latitude, longitude,
            location_type, device_battery_level
          ) VALUES ($1, $2, NOW(), $3, $4, $5, $6)
        `;
        
        await db.$client.query(locationQuery, [
          tenantId, tech.id,
          40.7128 + (Math.random() - 0.5) * 0.1, // NYC area
          -74.0060 + (Math.random() - 0.5) * 0.1,
          'customer_site',
          80 + Math.floor(Math.random() * 20) // 80-100% battery
        ]);
        
        syncedRecords++;
      }
      
      res.status(200).json({
        message: "Mobile data sync completed",
        synced_records: syncedRecords
      });
    } catch (error) {
      console.error("Error syncing mobile data:", error);
      res.status(500).json({ error: "Failed to sync mobile data" });
    }
  });

  // ============= SERVICE ANALYTICS ROUTES =============

  // Get analytics metrics
  app.get("/api/analytics/metrics", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const queries = [
        `SELECT COALESCE(SUM(total_service_calls), 0) as total_service_calls FROM service_performance_metrics WHERE tenant_id = $1 AND metric_period = 'monthly' AND metric_date >= DATE_TRUNC('month', CURRENT_DATE)`,
        `SELECT COALESCE(AVG(average_response_time_minutes), 0) as avg_response_time FROM service_performance_metrics WHERE tenant_id = $1 AND metric_period = 'monthly'`,
        `SELECT COALESCE(AVG(average_satisfaction_score), 0) as customer_satisfaction FROM service_performance_metrics WHERE tenant_id = $1 AND metric_period = 'monthly'`,
        `SELECT COALESCE(AVG(month_over_month_growth), 0) as revenue_growth FROM service_performance_metrics WHERE tenant_id = $1 AND metric_period = 'monthly'`,
        `SELECT COALESCE(AVG(utilization_rate), 0) as utilization_rate FROM service_performance_metrics WHERE tenant_id = $1 AND metric_period = 'monthly'`,
        `SELECT COALESCE(AVG(first_call_resolution_rate), 0) as first_call_resolution FROM service_performance_metrics WHERE tenant_id = $1 AND metric_period = 'monthly'`
      ];
      
      const results = await Promise.all(
        queries.map(query => db.$client.query(query, [tenantId]))
      );
      
      res.json({
        totalServiceCalls: parseInt(results[0].rows[0].total_service_calls),
        averageResponseTime: parseFloat(results[1].rows[0].avg_response_time),
        customerSatisfaction: parseFloat(results[2].rows[0].customer_satisfaction),
        revenueGrowth: parseFloat(results[3].rows[0].revenue_growth),
        utilizationRate: parseFloat(results[4].rows[0].utilization_rate),
        firstCallResolution: parseFloat(results[5].rows[0].first_call_resolution),
      });
    } catch (error) {
      console.error("Error fetching analytics metrics:", error);
      res.status(500).json({ error: "Failed to fetch analytics metrics" });
    }
  });

  // Get performance metrics
  app.get("/api/analytics/performance-metrics", requireAuth, async (req: any, res) => {
    try {
      const { period } = req.query;
      const tenantId = req.user.tenantId;
      
      let whereConditions = ['tenant_id = $1'];
      const queryParams = [tenantId];
      
      if (period && period !== 'all') {
        whereConditions.push(`metric_period = $${queryParams.length + 1}`);
        queryParams.push(period);
      }
      
      const query = `
        SELECT *
        FROM service_performance_metrics
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY metric_date DESC
        LIMIT 20
      `;
      
      const result = await db.$client.query(query, queryParams);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching performance metrics:", error);
      res.status(500).json({ error: "Failed to fetch performance metrics" });
    }
  });

  // Get technician performance analytics
  app.get("/api/analytics/technician-performance", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const query = `
        SELECT 
          tpa.*,
          u.name as technician_name
        FROM technician_performance_analytics tpa
        LEFT JOIN users u ON tpa.technician_id = u.id
        WHERE tpa.tenant_id = $1
        ORDER BY tpa.created_at DESC
      `;
      
      const result = await db.$client.query(query, [tenantId]);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching technician performance analytics:", error);
      res.status(500).json({ error: "Failed to fetch technician performance analytics" });
    }
  });

  // Get customer service analytics
  app.get("/api/analytics/customer-service", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const query = `
        SELECT 
          csa.*,
          br.company_name as customer_name
        FROM customer_service_analytics csa
        LEFT JOIN business_records br ON csa.business_record_id = br.id
        WHERE csa.tenant_id = $1
        ORDER BY csa.created_at DESC
      `;
      
      const result = await db.$client.query(query, [tenantId]);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching customer service analytics:", error);
      res.status(500).json({ error: "Failed to fetch customer service analytics" });
    }
  });

  // Get trend analysis
  app.get("/api/analytics/trends", requireAuth, async (req: any, res) => {
    try {
      const { category } = req.query;
      const tenantId = req.user.tenantId;
      
      let whereConditions = ['tenant_id = $1'];
      const queryParams = [tenantId];
      
      if (category && category !== 'all') {
        whereConditions.push(`trend_category = $${queryParams.length + 1}`);
        queryParams.push(category);
      }
      
      const query = `
        SELECT *
        FROM service_trend_analysis
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY analysis_date DESC
        LIMIT 10
      `;
      
      const result = await db.$client.query(query, queryParams);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching trend analysis:", error);
      res.status(500).json({ error: "Failed to fetch trend analysis" });
    }
  });

  // Get BI dashboards
  app.get("/api/analytics/dashboards", requireAuth, async (req: any, res) => {
    try {
      const { category } = req.query;
      const tenantId = req.user.tenantId;
      
      let whereConditions = ['bid.tenant_id = $1'];
      const queryParams = [tenantId];
      
      if (category && category !== 'all') {
        whereConditions.push(`bid.category = $${queryParams.length + 1}`);
        queryParams.push(category);
      }
      
      const query = `
        SELECT 
          bid.*,
          u.name as owner_name
        FROM business_intelligence_dashboards bid
        LEFT JOIN users u ON bid.owner_id = u.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY bid.is_featured DESC, bid.created_at DESC
      `;
      
      const result = await db.$client.query(query, queryParams);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching BI dashboards:", error);
      res.status(500).json({ error: "Failed to fetch BI dashboards" });
    }
  });

  // Create BI dashboard
  app.post("/api/analytics/dashboards", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      
      const {
        dashboard_name, dashboard_type, category, visibility,
        refresh_interval, auto_refresh, description
      } = req.body;
      
      const dashboardConfig = {
        description,
        widgets: [],
        layout: 'grid',
        theme: 'default'
      };
      
      const query = `
        INSERT INTO business_intelligence_dashboards (
          tenant_id, dashboard_name, dashboard_type, category, owner_id,
          visibility, refresh_interval, auto_refresh, dashboard_config
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      
      const result = await db.$client.query(query, [
        tenantId, dashboard_name, dashboard_type, category, userId,
        visibility, refresh_interval, auto_refresh, JSON.stringify(dashboardConfig)
      ]);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating BI dashboard:", error);
      res.status(500).json({ error: "Failed to create BI dashboard" });
    }
  });

  // Get performance benchmarks
  app.get("/api/analytics/benchmarks", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const query = `
        SELECT *
        FROM performance_benchmarks
        WHERE tenant_id = $1
        ORDER BY improvement_priority DESC, created_at DESC
      `;
      
      const result = await db.$client.query(query, [tenantId]);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching performance benchmarks:", error);
      res.status(500).json({ error: "Failed to fetch performance benchmarks" });
    }
  });

  // Create performance benchmark
  app.post("/api/analytics/benchmarks", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const {
        benchmark_name, benchmark_category, industry_average, company_target,
        improvement_priority, target_completion_date, business_impact, investment_required
      } = req.body;
      
      const query = `
        INSERT INTO performance_benchmarks (
          tenant_id, benchmark_name, benchmark_category, industry_average,
          company_target, improvement_priority, target_completion_date,
          business_impact, investment_required, trend_direction
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;
      
      const result = await db.$client.query(query, [
        tenantId, benchmark_name, benchmark_category, industry_average,
        company_target, improvement_priority, target_completion_date,
        business_impact, investment_required, 'stable'
      ]);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating performance benchmark:", error);
      res.status(500).json({ error: "Failed to create performance benchmark" });
    }
  });

  // Generate analytics reports
  app.post("/api/analytics/generate-reports", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      // Generate sample performance metrics
      const currentDate = new Date();
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      
      const metricsQuery = `
        INSERT INTO service_performance_metrics (
          tenant_id, metric_date, metric_period, period_start, period_end,
          total_service_calls, emergency_calls, average_response_time_minutes,
          first_call_resolution_rate, average_satisfaction_score, total_service_revenue,
          utilization_rate, jobs_completed_on_time, jobs_completed_late, month_over_month_growth
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `;
      
      await db.$client.query(metricsQuery, [
        tenantId, currentDate, 'monthly', startOfMonth, currentDate,
        125, 18, 45.5, 87.2, 4.3, 45000, 78.5, 98, 12, 8.5
      ]);
      
      // Generate sample trend analysis
      const trendQuery = `
        INSERT INTO service_trend_analysis (
          tenant_id, trend_category, analysis_date, period_type,
          current_value, previous_value, percentage_change, trend_direction,
          forecasted_next_period, forecast_confidence, trend_insights
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `;
      
      const trends = [
        ['service_volume', 125, 118, 5.93, 'up', 132, 85, 'Service volume continues to grow steadily'],
        ['satisfaction', 4.3, 4.1, 4.88, 'up', 4.4, 90, 'Customer satisfaction improving with recent process changes'],
        ['response_times', 45.5, 52.3, -13.0, 'down', 42, 88, 'Response times improving due to optimized routing']
      ];
      
      for (const trend of trends) {
        await db.$client.query(trendQuery, [
          tenantId, trend[0], currentDate, 'monthly',
          trend[1], trend[2], trend[3], trend[4], trend[5], trend[6], trend[7]
        ]);
      }
      
      res.status(201).json({
        message: "Analytics reports generated successfully",
        reports_generated: 1 + trends.length
      });
    } catch (error) {
      console.error("Error generating analytics reports:", error);
      res.status(500).json({ error: "Failed to generate analytics reports" });
    }
  });

  // ============= WORKFLOW AUTOMATION ROUTES =============

  // Get automation metrics
  app.get("/api/automation/metrics", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const queries = [
        `SELECT COUNT(*) as active_workflows FROM workflow_executions WHERE tenant_id = $1 AND status IN ('running', 'pending')`,
        `SELECT COUNT(*) as pending_tasks FROM automated_tasks WHERE tenant_id = $1 AND status = 'pending'`,
        `SELECT COUNT(*) as automation_rules FROM automation_rules WHERE tenant_id = $1 AND is_active = true`,
        `SELECT COALESCE(AVG(CASE WHEN status = 'completed' THEN 1.0 ELSE 0.0 END) * 100, 0) as success_rate FROM workflow_executions WHERE tenant_id = $1`,
        `SELECT COALESCE(SUM(actual_duration_minutes), 0) as time_saved FROM automated_tasks WHERE tenant_id = $1 AND status = 'completed'`,
        `SELECT COUNT(*) as tasks_automated FROM automated_tasks WHERE tenant_id = $1 AND automation_trigger IS NOT NULL`
      ];
      
      const results = await Promise.all(
        queries.map(query => db.$client.query(query, [tenantId]))
      );
      
      res.json({
        activeWorkflows: parseInt(results[0].rows[0].active_workflows),
        pendingTasks: parseInt(results[1].rows[0].pending_tasks),
        automationRules: parseInt(results[2].rows[0].automation_rules),
        successRate: parseFloat(results[3].rows[0].success_rate),
        timeSaved: parseFloat(results[4].rows[0].time_saved),
        tasksAutomated: parseInt(results[5].rows[0].tasks_automated),
      });
    } catch (error) {
      console.error("Error fetching automation metrics:", error);
      res.status(500).json({ error: "Failed to fetch automation metrics" });
    }
  });

  // Get workflow templates
  app.get("/api/automation/workflow-templates", requireAuth, async (req: any, res) => {
    try {
      const { category } = req.query;
      const tenantId = req.user.tenantId;
      
      let whereConditions = ['tenant_id = $1'];
      const queryParams = [tenantId];
      
      if (category && category !== 'all') {
        whereConditions.push(`template_category = $${queryParams.length + 1}`);
        queryParams.push(category);
      }
      
      const query = `
        SELECT *
        FROM workflow_templates
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY is_active DESC, created_at DESC
      `;
      
      const result = await db.$client.query(query, queryParams);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching workflow templates:", error);
      res.status(500).json({ error: "Failed to fetch workflow templates" });
    }
  });

  // Create workflow template
  app.post("/api/automation/workflow-templates", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      
      const {
        template_name, template_description, template_category, priority,
        auto_start, requires_approval, execution_delay_minutes,
        max_execution_time_hours, retry_attempts
      } = req.body;
      
      // Create basic workflow configuration
      const workflowSteps = [
        { step: 1, name: "Initialize", type: "action", config: { action: "start_workflow" } },
        { step: 2, name: "Process", type: "action", config: { action: "execute_main_logic" } },
        { step: 3, name: "Complete", type: "action", config: { action: "finalize_workflow" } }
      ];
      
      const triggerConditions = {
        events: ["manual_trigger"],
        conditions: []
      };
      
      const query = `
        INSERT INTO workflow_templates (
          tenant_id, template_name, template_description, template_category,
          priority, auto_start, requires_approval, execution_delay_minutes,
          max_execution_time_hours, retry_attempts, workflow_steps,
          trigger_conditions, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;
      
      const result = await db.$client.query(query, [
        tenantId, template_name, template_description, template_category,
        priority, auto_start, requires_approval, execution_delay_minutes,
        max_execution_time_hours, retry_attempts, JSON.stringify(workflowSteps),
        JSON.stringify(triggerConditions), userId
      ]);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating workflow template:", error);
      res.status(500).json({ error: "Failed to create workflow template" });
    }
  });

  // Execute workflow template
  app.post("/api/automation/workflow-templates/:id/execute", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      
      // Get template
      const templateQuery = `SELECT * FROM workflow_templates WHERE id = $1 AND tenant_id = $2`;
      const templateResult = await db.$client.query(templateQuery, [id, tenantId]);
      
      if (templateResult.rows.length === 0) {
        return res.status(404).json({ error: "Workflow template not found" });
      }
      
      const template = templateResult.rows[0];
      const executionId = `WF-${Date.now()}`;
      
      const query = `
        INSERT INTO workflow_executions (
          tenant_id, execution_id, workflow_template_id, execution_name,
          triggered_by_user_id, triggered_by_event, total_steps, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      
      const steps = template.workflow_steps || [];
      
      const result = await db.$client.query(query, [
        tenantId, executionId, id, `${template.template_name} Execution`,
        userId, 'manual', steps.length, 'pending'
      ]);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error executing workflow template:", error);
      res.status(500).json({ error: "Failed to execute workflow template" });
    }
  });

  // Get workflow executions
  app.get("/api/automation/workflow-executions", requireAuth, async (req: any, res) => {
    try {
      const { status } = req.query;
      const tenantId = req.user.tenantId;
      
      let whereConditions = ['we.tenant_id = $1'];
      const queryParams = [tenantId];
      
      if (status && status !== 'all') {
        whereConditions.push(`we.status = $${queryParams.length + 1}`);
        queryParams.push(status);
      }
      
      const query = `
        SELECT 
          we.*,
          wt.template_name as workflow_template_name
        FROM workflow_executions we
        LEFT JOIN workflow_templates wt ON we.workflow_template_id = wt.id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY we.created_at DESC
      `;
      
      const result = await db.$client.query(query, queryParams);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching workflow executions:", error);
      res.status(500).json({ error: "Failed to fetch workflow executions" });
    }
  });

  // Control workflow execution
  app.post("/api/automation/workflow-executions/:id/:action", requireAuth, async (req: any, res) => {
    try {
      const { id, action } = req.params;
      const tenantId = req.user.tenantId;
      
      let newStatus;
      let updateFields = [];
      let values = [];
      
      switch (action) {
        case 'pause':
          newStatus = 'paused';
          updateFields.push('paused_at = NOW()');
          break;
        case 'resume':
          newStatus = 'running';
          updateFields.push('paused_at = NULL');
          break;
        case 'stop':
          newStatus = 'cancelled';
          updateFields.push('completed_at = NOW()');
          break;
        default:
          return res.status(400).json({ error: "Invalid action" });
      }
      
      updateFields.push(`status = $${values.length + 2}`);
      values.push(newStatus);
      
      const query = `
        UPDATE workflow_executions 
        SET ${updateFields.join(', ')}, updated_at = NOW()
        WHERE execution_id = $1 AND tenant_id = $${values.length + 2}
        RETURNING *
      `;
      
      const result = await db.$client.query(query, [id, ...values, tenantId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Workflow execution not found" });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error("Error controlling workflow execution:", error);
      res.status(500).json({ error: "Failed to control workflow execution" });
    }
  });

  // Get automation rules
  app.get("/api/automation/rules", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const query = `
        SELECT *
        FROM automation_rules
        WHERE tenant_id = $1
        ORDER BY is_active DESC, priority DESC, created_at DESC
      `;
      
      const result = await db.$client.query(query, [tenantId]);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching automation rules:", error);
      res.status(500).json({ error: "Failed to fetch automation rules" });
    }
  });

  // Create automation rule
  app.post("/api/automation/rules", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      
      const {
        rule_name, rule_description, rule_category, priority, is_critical,
        delay_before_action, max_executions_per_day, bypass_business_hours
      } = req.body;
      
      // Create basic rule configuration
      const triggerEvents = ["entity_created", "entity_updated"];
      const conditions = { logic: "AND", rules: [] };
      const actions = [{ type: "notify", target: "admin" }];
      
      const query = `
        INSERT INTO automation_rules (
          tenant_id, rule_name, rule_description, rule_category, priority,
          is_critical, delay_before_action, max_executions_per_day,
          bypass_business_hours, trigger_events, conditions, actions, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;
      
      const result = await db.$client.query(query, [
        tenantId, rule_name, rule_description, rule_category, priority,
        is_critical, delay_before_action, max_executions_per_day,
        bypass_business_hours, JSON.stringify(triggerEvents),
        JSON.stringify(conditions), JSON.stringify(actions), userId
      ]);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating automation rule:", error);
      res.status(500).json({ error: "Failed to create automation rule" });
    }
  });

  // Get automated tasks
  app.get("/api/automation/tasks", requireAuth, async (req: any, res) => {
    try {
      const { priority } = req.query;
      const tenantId = req.user.tenantId;
      
      let whereConditions = ['tenant_id = $1'];
      const queryParams = [tenantId];
      
      if (priority && priority !== 'all') {
        whereConditions.push(`priority = $${queryParams.length + 1}`);
        queryParams.push(priority);
      }
      
      const query = `
        SELECT *
        FROM automated_tasks
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY urgency_score DESC, created_at DESC
      `;
      
      const result = await db.$client.query(query, queryParams);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching automated tasks:", error);
      res.status(500).json({ error: "Failed to fetch automated tasks" });
    }
  });

  // Create automated task
  app.post("/api/automation/tasks", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const {
        task_title, task_description, task_type, task_category, priority,
        urgency_score, estimated_duration_minutes, due_date, assigned_to
      } = req.body;
      
      const query = `
        INSERT INTO automated_tasks (
          tenant_id, task_title, task_description, task_type, task_category,
          priority, urgency_score, estimated_duration_minutes, due_date,
          assigned_to, automation_trigger
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;
      
      const result = await db.$client.query(query, [
        tenantId, task_title, task_description, task_type, task_category,
        priority, urgency_score, estimated_duration_minutes, due_date,
        assigned_to, 'manual_creation'
      ]);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating automated task:", error);
      res.status(500).json({ error: "Failed to create automated task" });
    }
  });

  // ============= MOBILE FIELD OPERATIONS ROUTES =============

  // Get mobile field metrics
  app.get("/api/mobile-field/metrics", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const queries = [
        `SELECT COUNT(*) as active_technicians FROM field_technicians WHERE tenant_id = $1 AND employment_status = 'active' AND availability_status IN ('available', 'busy')`,
        `SELECT COUNT(*) as work_orders_today FROM field_work_orders WHERE tenant_id = $1 AND DATE(created_at) = CURRENT_DATE`,
        `SELECT COALESCE(AVG(CASE WHEN status = 'completed' THEN 1.0 ELSE 0.0 END) * 100, 0) as completion_rate FROM field_work_orders WHERE tenant_id = $1 AND DATE(created_at) = CURRENT_DATE`,
        `SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (actual_start_time - created_at))/60), 0) as avg_response_time FROM field_work_orders WHERE tenant_id = $1 AND actual_start_time IS NOT NULL`,
        `SELECT COALESCE(AVG(customer_satisfaction_rating), 0) as customer_satisfaction FROM field_technicians WHERE tenant_id = $1`,
        `SELECT 95.5 as gps_accuracy` // Mock GPS accuracy metric
      ];
      
      const results = await Promise.all(
        queries.map(query => db.$client.query(query, [tenantId]))
      );
      
      res.json({
        activeTechnicians: parseInt(results[0].rows[0].active_technicians),
        workOrdersToday: parseInt(results[1].rows[0].work_orders_today),
        completionRate: parseFloat(results[2].rows[0].completion_rate),
        averageResponseTime: parseFloat(results[3].rows[0].avg_response_time),
        customerSatisfaction: parseFloat(results[4].rows[0].customer_satisfaction),
        gpsAccuracy: parseFloat(results[5].rows[0].gps_accuracy),
      });
    } catch (error) {
      console.error("Error fetching mobile field metrics:", error);
      res.status(500).json({ error: "Failed to fetch mobile field metrics" });
    }
  });

  // Get field technicians
  app.get("/api/mobile-field/technicians", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const query = `
        SELECT *
        FROM field_technicians
        WHERE tenant_id = $1
        ORDER BY employment_status DESC, technician_name ASC
      `;
      
      const result = await db.$client.query(query, [tenantId]);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching field technicians:", error);
      res.status(500).json({ error: "Failed to fetch field technicians" });
    }
  });

  // Create field technician
  app.post("/api/mobile-field/technicians", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const {
        employee_id, technician_name, technician_email, technician_phone,
        device_type, skill_categories, work_schedule, gps_tracking_enabled,
        voice_notes_enabled, photo_upload_enabled
      } = req.body;
      
      // Parse skill categories if provided
      const skillCategoriesArray = skill_categories ? 
        skill_categories.split(',').map((s: string) => s.trim()) : [];
      
      const query = `
        INSERT INTO field_technicians (
          tenant_id, employee_id, technician_name, technician_email,
          technician_phone, device_type, skill_categories, work_schedule,
          gps_tracking_enabled, voice_notes_enabled, photo_upload_enabled
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;
      
      const result = await db.$client.query(query, [
        tenantId, employee_id, technician_name, technician_email,
        technician_phone, device_type, JSON.stringify(skillCategoriesArray),
        work_schedule || null, gps_tracking_enabled, voice_notes_enabled,
        photo_upload_enabled
      ]);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating field technician:", error);
      res.status(500).json({ error: "Failed to create field technician" });
    }
  });

  // Get field work orders
  app.get("/api/mobile-field/work-orders", requireAuth, async (req: any, res) => {
    try {
      const { status, technician, priority } = req.query;
      const tenantId = req.user.tenantId;
      
      let whereConditions = ['tenant_id = $1'];
      const queryParams = [tenantId];
      
      if (status && status !== 'all') {
        whereConditions.push(`status = $${queryParams.length + 1}`);
        queryParams.push(status);
      }
      
      if (technician && technician !== 'all') {
        whereConditions.push(`assigned_technician_id = $${queryParams.length + 1}`);
        queryParams.push(technician);
      }
      
      if (priority && priority !== 'all') {
        whereConditions.push(`priority = $${queryParams.length + 1}`);
        queryParams.push(priority);
      }
      
      const query = `
        SELECT *
        FROM field_work_orders
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY 
          CASE priority 
            WHEN 'emergency' THEN 1 
            WHEN 'urgent' THEN 2 
            WHEN 'high' THEN 3 
            WHEN 'medium' THEN 4 
            ELSE 5 
          END,
          created_at DESC
      `;
      
      const result = await db.$client.query(query, queryParams);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching field work orders:", error);
      res.status(500).json({ error: "Failed to fetch field work orders" });
    }
  });

  // Create field work order
  app.post("/api/mobile-field/work-orders", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const {
        work_order_type, priority, customer_name, service_address,
        work_description, estimated_duration_minutes, scheduled_date,
        scheduled_time_start, assigned_technician_id, special_instructions
      } = req.body;
      
      // Generate work order number
      const workOrderNumber = `WO-${Date.now()}`;
      
      // Create service location object
      const serviceLocation = {
        address: service_address,
        coordinates: null // Would be geocoded in real implementation
      };
      
      const query = `
        INSERT INTO field_work_orders (
          tenant_id, work_order_number, work_order_type, priority,
          customer_id, customer_name, service_location, work_description,
          estimated_duration_minutes, scheduled_date, scheduled_time_start,
          assigned_technician_id, special_instructions
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;
      
      const result = await db.$client.query(query, [
        tenantId, workOrderNumber, work_order_type, priority,
        'customer-' + Date.now(), customer_name, JSON.stringify(serviceLocation),
        work_description, estimated_duration_minutes, scheduled_date,
        scheduled_time_start, assigned_technician_id, special_instructions
      ]);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating field work order:", error);
      res.status(500).json({ error: "Failed to create field work order" });
    }
  });

  // Get voice notes
  app.get("/api/mobile-field/voice-notes", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const query = `
        SELECT *
        FROM voice_notes
        WHERE tenant_id = $1
        ORDER BY recorded_timestamp DESC
        LIMIT 50
      `;
      
      const result = await db.$client.query(query, [tenantId]);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching voice notes:", error);
      res.status(500).json({ error: "Failed to fetch voice notes" });
    }
  });

  // Create voice note
  app.post("/api/mobile-field/voice-notes", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      
      const {
        work_order_id, note_category, note_title, transcription_text,
        urgency_level, tags
      } = req.body;
      
      // Parse tags if provided
      const tagsArray = tags ? 
        tags.split(',').map((t: string) => t.trim()) : [];
      
      // Mock audio file URL (in real implementation, this would be uploaded)
      const audioFileUrl = `/audio/voice-note-${Date.now()}.mp3`;
      
      const query = `
        INSERT INTO voice_notes (
          tenant_id, technician_id, work_order_id, note_category,
          audio_file_url, note_title, transcription_text, urgency_level,
          tags, recorded_timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING *
      `;
      
      const result = await db.$client.query(query, [
        tenantId, userId, work_order_id, note_category, audioFileUrl,
        note_title, transcription_text, urgency_level, JSON.stringify(tagsArray)
      ]);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating voice note:", error);
      res.status(500).json({ error: "Failed to create voice note" });
    }
  });

  // ============= COMMISSION MANAGEMENT ROUTES =============

  // Get commission metrics
  app.get("/api/commission/metrics", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const queries = [
        `SELECT COALESCE(SUM(final_payment_amount), 0) as total_paid FROM commission_payments WHERE tenant_id = $1 AND payment_status = 'processed'`,
        `SELECT COALESCE(SUM(commission_amount), 0) as total_pending FROM commission_transactions WHERE tenant_id = $1 AND payment_status = 'unpaid'`,
        `SELECT COALESCE(AVG(commission_rate), 0) as avg_rate FROM commission_transactions WHERE tenant_id = $1`,
        `SELECT COUNT(*) as total_reps FROM sales_representatives WHERE tenant_id = $1 AND employment_status = 'active'`,
        `SELECT COUNT(*) as transactions_this_month FROM commission_transactions WHERE tenant_id = $1 AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)`,
        `SELECT COUNT(*) as active_disputes FROM commission_disputes WHERE tenant_id = $1 AND dispute_status IN ('submitted', 'under_review')`
      ];
      
      const results = await Promise.all(
        queries.map(query => db.$client.query(query, [tenantId]))
      );
      
      res.json({
        totalCommissionPaid: parseFloat(results[0].rows[0].total_paid),
        totalCommissionPending: parseFloat(results[1].rows[0].total_pending),
        averageCommissionRate: parseFloat(results[2].rows[0].avg_rate),
        totalSalesRepresentatives: parseInt(results[3].rows[0].total_reps),
        totalTransactionsThisMonth: parseInt(results[4].rows[0].transactions_this_month),
        totalDisputesActive: parseInt(results[5].rows[0].active_disputes),
      });
    } catch (error) {
      console.error("Error fetching commission metrics:", error);
      res.status(500).json({ error: "Failed to fetch commission metrics" });
    }
  });

  // Get commission structures
  app.get("/api/commission/structures", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const query = `
        SELECT *
        FROM commission_structures
        WHERE tenant_id = $1
        ORDER BY is_active DESC, structure_name ASC
      `;
      
      const result = await db.$client.query(query, [tenantId]);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching commission structures:", error);
      res.status(500).json({ error: "Failed to fetch commission structures" });
    }
  });

  // Create commission structure
  app.post("/api/commission/structures", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.id;
      
      const {
        structure_name, structure_type, product_category, base_rate,
        calculation_period, payment_schedule, effective_start_date,
        effective_end_date, is_active
      } = req.body;
      
      const query = `
        INSERT INTO commission_structures (
          tenant_id, structure_name, structure_type, applies_to,
          base_rate, calculation_period, payment_schedule,
          effective_date, expiration_date, is_active,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;
      
      const result = await db.$client.query(query, [
        tenantId, structure_name, structure_type, product_category || 'all',
        base_rate, calculation_period, payment_schedule,
        effective_start_date, effective_end_date, is_active, userId
      ]);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating commission structure:", error);
      res.status(500).json({ error: "Failed to create commission structure" });
    }
  });

  // Get sales representatives
  app.get("/api/commission/sales-reps", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const query = `
        SELECT *
        FROM sales_representatives
        WHERE tenant_id = $1
        ORDER BY employment_status DESC, rep_name ASC
      `;
      
      const result = await db.$client.query(query, [tenantId]);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching sales representatives:", error);
      res.status(500).json({ error: "Failed to fetch sales representatives" });
    }
  });

  // Create sales representative
  app.post("/api/commission/sales-reps", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const {
        employee_id, rep_name, rep_email, rep_phone, manager_id,
        primary_commission_structure_id, employment_status
      } = req.body;
      
      const query = `
        INSERT INTO sales_representatives (
          tenant_id, employee_id, rep_name, rep_email, rep_phone,
          manager_id, primary_commission_structure_id, employment_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      
      const result = await db.$client.query(query, [
        tenantId, employee_id, rep_name, rep_email, rep_phone,
        manager_id, primary_commission_structure_id, employment_status
      ]);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating sales representative:", error);
      res.status(500).json({ error: "Failed to create sales representative" });
    }
  });

  // Get commission transactions
  app.get("/api/commission/transactions", requireAuth, async (req: any, res) => {
    try {
      const { period, status } = req.query;
      const tenantId = req.user.tenantId;
      
      let whereConditions = ['tenant_id = $1'];
      const queryParams = [tenantId];
      
      // Add period filter
      if (period && period !== 'all') {
        switch (period) {
          case 'current_month':
            whereConditions.push(`DATE_TRUNC('month', sale_date) = DATE_TRUNC('month', CURRENT_DATE)`);
            break;
          case 'last_month':
            whereConditions.push(`DATE_TRUNC('month', sale_date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')`);
            break;
          case 'current_quarter':
            whereConditions.push(`DATE_TRUNC('quarter', sale_date) = DATE_TRUNC('quarter', CURRENT_DATE)`);
            break;
          case 'last_quarter':
            whereConditions.push(`DATE_TRUNC('quarter', sale_date) = DATE_TRUNC('quarter', CURRENT_DATE - INTERVAL '3 months')`);
            break;
          case 'current_year':
            whereConditions.push(`DATE_TRUNC('year', sale_date) = DATE_TRUNC('year', CURRENT_DATE)`);
            break;
        }
      }
      
      if (status && status !== 'all') {
        whereConditions.push(`commission_status = $${queryParams.length + 1}`);
        queryParams.push(status);
      }
      
      const query = `
        SELECT *
        FROM commission_transactions
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY sale_date DESC
      `;
      
      const result = await db.$client.query(query, queryParams);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching commission transactions:", error);
      res.status(500).json({ error: "Failed to fetch commission transactions" });
    }
  });

  // Create commission transaction
  app.post("/api/commission/transactions", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const {
        transaction_type, sales_rep_id, customer_name, sale_amount,
        commission_rate, sale_date, product_category
      } = req.body;
      
      // Get sales rep name
      const repQuery = `SELECT rep_name FROM sales_representatives WHERE id = $1 AND tenant_id = $2`;
      const repResult = await db.$client.query(repQuery, [sales_rep_id, tenantId]);
      
      if (repResult.rows.length === 0) {
        return res.status(404).json({ error: "Sales representative not found" });
      }
      
      const sales_rep_name = repResult.rows[0].rep_name;
      const commission_amount = sale_amount * commission_rate;
      const commission_period = new Date(sale_date).toISOString().slice(0, 7); // YYYY-MM format
      
      const query = `
        INSERT INTO commission_transactions (
          tenant_id, transaction_type, sales_rep_id, sales_rep_name,
          customer_name, sale_amount, commission_rate, commission_amount,
          sale_date, commission_period, product_category
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;
      
      const result = await db.$client.query(query, [
        tenantId, transaction_type, sales_rep_id, sales_rep_name,
        customer_name, sale_amount, commission_rate, commission_amount,
        sale_date, commission_period, product_category
      ]);
      
      // Update sales rep performance metrics
      const updateRepQuery = `
        UPDATE sales_representatives 
        SET 
          current_month_sales = current_month_sales + $1,
          current_quarter_sales = current_quarter_sales + $1,
          current_year_sales = current_year_sales + $1
        WHERE id = $2 AND tenant_id = $3
      `;
      
      await db.$client.query(updateRepQuery, [sale_amount, sales_rep_id, tenantId]);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating commission transaction:", error);
      res.status(500).json({ error: "Failed to create commission transaction" });
    }
  });

  // Get commission payments
  app.get("/api/commission/payments", requireAuth, async (req: any, res) => {
    try {
      const { period } = req.query;
      const tenantId = req.user.tenantId;
      
      let whereConditions = ['tenant_id = $1'];
      const queryParams = [tenantId];
      
      // Add period filter
      if (period && period !== 'all') {
        switch (period) {
          case 'current_month':
            whereConditions.push(`DATE_TRUNC('month', payment_date) = DATE_TRUNC('month', CURRENT_DATE)`);
            break;
          case 'last_month':
            whereConditions.push(`DATE_TRUNC('month', payment_date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')`);
            break;
          case 'current_quarter':
            whereConditions.push(`DATE_TRUNC('quarter', payment_date) = DATE_TRUNC('quarter', CURRENT_DATE)`);
            break;
          case 'current_year':
            whereConditions.push(`DATE_TRUNC('year', payment_date) = DATE_TRUNC('year', CURRENT_DATE)`);
            break;
        }
      }
      
      const query = `
        SELECT *
        FROM commission_payments
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY payment_date DESC
      `;
      
      const result = await db.$client.query(query, queryParams);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching commission payments:", error);
      res.status(500).json({ error: "Failed to fetch commission payments" });
    }
  });

  // Get commission disputes
  app.get("/api/commission/disputes", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const query = `
        SELECT *
        FROM commission_disputes
        WHERE tenant_id = $1
        ORDER BY 
          CASE dispute_status 
            WHEN 'submitted' THEN 1 
            WHEN 'under_review' THEN 2 
            ELSE 3 
          END,
          CASE priority 
            WHEN 'urgent' THEN 1 
            WHEN 'high' THEN 2 
            WHEN 'medium' THEN 3 
            ELSE 4 
          END,
          submitted_date DESC
      `;
      
      const result = await db.$client.query(query, [tenantId]);
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching commission disputes:", error);
      res.status(500).json({ error: "Failed to fetch commission disputes" });
    }
  });

  // Create commission dispute
  app.post("/api/commission/disputes", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const {
        dispute_type, sales_rep_id, commission_transaction_id,
        dispute_amount, dispute_description, priority
      } = req.body;
      
      // Get sales rep name
      const repQuery = `SELECT rep_name FROM sales_representatives WHERE id = $1 AND tenant_id = $2`;
      const repResult = await db.$client.query(repQuery, [sales_rep_id, tenantId]);
      
      if (repResult.rows.length === 0) {
        return res.status(404).json({ error: "Sales representative not found" });
      }
      
      const sales_rep_name = repResult.rows[0].rep_name;
      const dispute_number = `DISP-${Date.now()}`;
      const submitted_date = new Date().toISOString().split('T')[0];
      
      const query = `
        INSERT INTO commission_disputes (
          tenant_id, dispute_number, dispute_type, sales_rep_id,
          sales_rep_name, commission_transaction_id, dispute_amount,
          dispute_description, priority, submitted_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;
      
      const result = await db.$client.query(query, [
        tenantId, dispute_number, dispute_type, sales_rep_id,
        sales_rep_name, commission_transaction_id, dispute_amount,
        dispute_description, priority, submitted_date
      ]);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error creating commission dispute:", error);
      res.status(500).json({ error: "Failed to create commission dispute" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}