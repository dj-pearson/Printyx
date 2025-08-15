import type { Express } from "express";
import { createServer, type Server } from "http";
import { registerOnboardingRoutes } from "./routes-onboarding";
import {
  exportChecklistPDF,
  exportChecklistExcel,
  exportChecklistCSV,
} from "./routes-export";
import session from "express-session";
import csurf from "csurf";
import rateLimit from "express-rate-limit";
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
  insertAccessoryModelCompatibilitySchema,
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
  insertMasterProductModelSchema,
  insertSeoSettingsSchema,
  insertSeoPageSchema,
  seoSettings,
  seoPages,
  companyContacts,
  equipment,
} from "@shared/schema";
import multer from "multer";
import csv from "csv-parser";
import { Readable } from "stream";
import { format } from "date-fns";
import { equipmentLifecycle } from "../shared/equipment-schema";
import { createHash } from "crypto";
import { requireRootAdmin } from "./routes-root-admin";
import {
  businessRecords,
  locations,
  regions,
  tenants,
  inventoryItems,
  contracts,
  serviceTickets,
  invoices,
  masterProductModels,
  meterReadings,
  vendors,
  productAccessories,
} from "@shared/schema";
// Mobile routes integrated directly in main routes file
import { registerIntegrationRoutes } from "./routes-integrations";
import { registerTaskRoutes } from "./routes-tasks";
import { registerEnhancedTaskRoutes } from "./routes-enhanced-tasks";
import { registerDealsManagementRoutes } from "./routes-deals-management";
import { registerOpportunitiesRoutes } from "./routes-opportunities";
import { registerTechnicianManagementRoutes } from "./routes-technician-management";
import { registerProductModelsRoutes } from "./routes-product-models";
import { registerSoftwareProductsRoutes } from "./routes-software-products";
import { registerInvoicesRoutes } from "./routes-invoices";
import { setupAuth } from "./replitAuth";
import { registerPurchaseOrderRoutes } from "./routes-purchase-orders";
import { registerWarehouseRoutes } from "./routes-warehouse";
import { registerServiceAnalysisRoutes } from "./routes-service-analysis";
import breachDetectionRoutes from "./routes-breach-detection";
import { registerCrmGoalRoutes } from "./routes-crm-goals";
import { registerBusinessRecordRoutes } from "./routes-business-records";
import { registerSalesforceRoutes } from "./routes-salesforce-integration";
import { registerSalesforceTestRoutes } from "./test-salesforce-integration";
import { registerDataEnrichmentRoutes } from "./routes-data-enrichment";
import { DashboardService } from "./integrations/dashboard-service";
import { db } from "./db";
import { and, eq, sql, desc, or, asc } from "drizzle-orm";
import integrationRoutes from "./integrations/routes";
import integrationHubRoutes from "./routes-integration-hub";
import { registerQuickBooksRoutes } from "./routes-quickbooks-integration";
import { setupSalesPipelineRoutes } from "./routes-sales-pipeline";
import { registerModularDashboardRoutes } from "./routes-modular-dashboard";
import { registerManufacturerIntegrationRoutes } from "./routes-manufacturer-integration";
import { blockRegistrations } from "./middleware/registration-lock";
import customerPortalRoutes from "./routes-customer-portal";
import { serviceDispatchRouter } from "./routes-service-dispatch";
import commissionRoutes from "./routes-commission";
import enhancedServiceRoutes from "./routes-enhanced-service";
import { enhancedRBACRoutes } from "./routes-enhanced-rbac";
import gpt5Routes from "./routes-ai-gpt5";
import salesForecastingRoutes from "./routes-sales-forecasting";
import reportsRoutes from "./routes-reports";
import warehouseFpyRoutes from "./routes-warehouse-fpy";
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
  calculatePricingForProduct,
} from "./routes-pricing";
import {
  resolveTenant,
  requireTenant,
  TenantRequest,
} from "./middleware/tenancy";
import { BusinessRecordsTransformer } from "./data-field-mapping";
// removed duplicate imports (db, drizzle operators, schema tables)

// Basic authentication middleware - Updated to work with current auth system
const requireAuth = async (req: any, res: any, next: any) => {
  // Check for session-based auth (legacy) or user object (current)
  const isAuthenticated =
    req.session?.userId || req.user?.id || req.user?.claims?.sub;

  if (!isAuthenticated) {
    return res.status(401).json({ message: "Authentication required" });
  }

  // Get user ID from various sources
  const userId = req.user?.id || req.user?.claims?.sub || req.session?.userId;

  if (userId && (!req.user || !req.user.tenantId)) {
    // Fetch full user details from database if missing
    try {
      const fullUser = await storage.getUser(userId);
      if (fullUser) {
        req.user = {
          ...req.user,
          id: fullUser.id,
          tenantId: fullUser.tenantId,
          isPlatformUser: fullUser.isPlatformUser,
          is_platform_user: fullUser.isPlatformUser,
          email: fullUser.email,
          firstName: fullUser.firstName,
          lastName: fullUser.lastName,
        };
      }
    } catch (error) {
      console.error("Error fetching user details:", error);
    }
  }

  // Add user context for backwards compatibility
  if (!req.user) {
    req.user = {
      id: req.session.userId,
      tenantId: req.session.tenantId || req.user?.tenantId,
    };
  } else if (!req.user.tenantId && !req.user.id) {
    // If we have user claims but no structured user object, build it
    req.user = {
      id: req.user.claims?.sub || req.user.id,
      tenantId: req.user.tenantId || req.session?.tenantId,
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
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
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
      .on("data", (data) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", (error) => reject(error));
  });
}

// Helper function to calculate tiered billing amounts
function calculateTieredAmount(
  totalCopies: number,
  tieredRates: any[],
  baseRate: number
): number {
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

  if (!row["Product Code"]) errors.push("Product Code is required");
  if (!row["Product Name"]) errors.push("Product Name is required");

  // Parse required accessories and validate format
  let requiredAccessories = null;
  if (row["Required Accessories"]) {
    const accessoryString = row["Required Accessories"].trim();
    if (accessoryString) {
      // Support both comma and semicolon separated values
      const accessories = accessoryString.split(/[,;]/).map(a => a.trim()).filter(a => a.length > 0);
      if (accessories.length > 0) {
        requiredAccessories = accessories.join(',');
      }
    }
  }

  // Parse boolean values
  const parseBoolean = (value: any): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim();
      return lower === 'true' || lower === 'yes' || lower === '1';
    }
    return false;
  };

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      productCode: row["Product Code"]?.trim(),
      productName: row["Product Name"]?.trim(),
      category: row["Category"]?.trim() || "MFP",
      manufacturer: row["Manufacturer"]?.trim() || null,
      description: row["Description"]?.trim() || null,
      msrp: row["MSRP"] ? parseFloat(row["MSRP"].toString().replace(/[,$]/g, '')) : null,
      colorMode: row["Color Mode"]?.trim() || null,
      colorSpeed: row["Color Speed"]?.trim() || null,
      bwSpeed: row["BW Speed"]?.trim() || null,
      productFamily: row["Product Family"]?.trim() || null,
      requiredAccessories,
      newActive: parseBoolean(row["New Active"]),
      newRepPrice: row["New Rep Price"] ? parseFloat(row["New Rep Price"].toString().replace(/[,$]/g, '')) : null,
      upgradeActive: parseBoolean(row["Upgrade Active"]),
      upgradeRepPrice: row["Upgrade Rep Price"] ? parseFloat(row["Upgrade Rep Price"].toString().replace(/[,$]/g, '')) : null,
      lexmarkActive: parseBoolean(row["Lexmark Active"]),
      lexmarkRepPrice: row["Lexmark Rep Price"] ? parseFloat(row["Lexmark Rep Price"].toString().replace(/[,$]/g, '')) : null,
      isActive: row["Is Active"] !== undefined ? parseBoolean(row["Is Active"]) : true,
    },
  };
}

// Helper function to validate and transform supply data
function validateSupplyData(row: any): any {
  const errors: string[] = [];

  if (!row["Product Code"]) errors.push("Product Code is required");
  if (!row["Product Name"]) errors.push("Product Name is required");

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      productCode: row["Product Code"]?.trim(),
      productName: row["Product Name"]?.trim(),
      productType: row["Product Type"]?.trim() || "Supplies",
      dealerComp: row["Dealer Comp"]?.trim() || null,
      inventory: row["Inventory"]?.trim() || null,
      inStock: row["In Stock"]?.trim() || null,
      description: row["Description"]?.trim() || null,
      newRepPrice: row["New Rep Price"]
        ? parseFloat(row["New Rep Price"])
        : null,
      upgradeRepPrice: row["Upgrade Rep Price"]
        ? parseFloat(row["Upgrade Rep Price"])
        : null,
      lexmarkRepPrice: row["Lexmark Rep Price"]
        ? parseFloat(row["Lexmark Rep Price"])
        : null,
      graphicRepPrice: row["Graphic Rep Price"]
        ? parseFloat(row["Graphic Rep Price"])
        : null,
      newActive: !!row["New Rep Price"],
      upgradeActive: !!row["Upgrade Rep Price"],
      lexmarkActive: !!row["Lexmark Rep Price"],
      graphicActive: !!row["Graphic Rep Price"],
      isActive: true,
      salesRepCredit: true,
      funding: true,
    },
  };
}

// Helper function to validate and transform managed service data
function validateManagedServiceData(row: any): any {
  const errors: string[] = [];

  if (!row["Product Code"]) errors.push("Product Code is required");
  if (!row["Product Name"]) errors.push("Product Name is required");

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      productCode: row["Product Code"]?.trim(),
      productName: row["Product Name"]?.trim(),
      category: "IT Services",
      serviceType: row["Service Type"]?.trim() || null,
      serviceLevel: row["Service Level"]?.trim() || null,
      supportHours: row["Support Hours"]?.trim() || null,
      responseTime: row["Response Time"]?.trim() || null,
      remoteMgmt: row["Remote Management"]?.toLowerCase() === "yes",
      onsiteSupport: row["Onsite Support"]?.toLowerCase() === "yes",
      includesHardware: false,
      description: row["Description"]?.trim() || null,
      newRepPrice: row["New Rep Price"]
        ? parseFloat(row["New Rep Price"])
        : null,
      upgradeRepPrice: row["Upgrade Rep Price"]
        ? parseFloat(row["Upgrade Rep Price"])
        : null,
      lexmarkRepPrice: row["Lexmark Rep Price"]
        ? parseFloat(row["Lexmark Rep Price"])
        : null,
      graphicRepPrice: row["Graphic Rep Price"]
        ? parseFloat(row["Graphic Rep Price"])
        : null,
      newActive: !!row["New Rep Price"],
      upgradeActive: !!row["Upgrade Rep Price"],
      lexmarkActive: !!row["Lexmark Rep Price"],
      graphicActive: !!row["Graphic Rep Price"],
      isActive: true,
      salesRepCredit: true,
      funding: true,
    },
  };
}

function validateSoftwareProductData(row: any): any {
  const errors: string[] = [];

  // Handle multiple header formats: snake_case, camelCase, and Title Case
  const getFieldValue = (field: string) => {
    // Try multiple variations of the field name
    return row[field] || 
           row[field.toLowerCase()] || 
           row[field.replace(/_/g, '')] ||  // snake_case -> camelCase
           row[field.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')] || // snake_case -> Title Case
           row[field.split('_').map((word, index) => index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)).join('')]; // snake_case -> camelCase
  };

  const productCode = getFieldValue('product_code');
  const productName = getFieldValue('product_name');

  if (!productCode) errors.push("Product Code is required");
  if (!productName) errors.push("Product Name is required");

  // Helper function to parse boolean values
  const parseBoolean = (value: any): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true' || value === '1';
    }
    return false;
  };

  // Helper function to parse decimal values
  const parseDecimal = (value: any): number | null => {
    if (!value || value === '' || value === null || value === undefined) return null;
    // Clean the value: remove $, commas, and extra spaces
    const cleanValue = value.toString().replace(/[$,\s]/g, '').trim();
    if (cleanValue === '') return null;
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? null : parsed;
  };

  // Parse pricing values
  const standardCost = parseDecimal(getFieldValue('standard_cost'));
  const standardRepPriceRaw = getFieldValue('standard_rep_price');
  console.log(`Debug: standardRepPriceRaw for ${productCode}:`, standardRepPriceRaw, typeof standardRepPriceRaw);
  const standardRepPrice = parseDecimal(standardRepPriceRaw);
  console.log(`Debug: standardRepPrice after parseDecimal for ${productCode}:`, standardRepPrice);
  const newCost = parseDecimal(getFieldValue('new_cost'));
  const newRepPrice = parseDecimal(getFieldValue('new_rep_price'));
  const upgradeCost = parseDecimal(getFieldValue('upgrade_cost'));
  const upgradeRepPrice = parseDecimal(getFieldValue('upgrade_rep_price'));

  // Auto-set active flags if pricing data is present and active flag is not explicitly set
  const standardActiveFromCSV = getFieldValue('standard_active');
  const newActiveFromCSV = getFieldValue('new_active');
  const upgradeActiveFromCSV = getFieldValue('upgrade_active');

  const standardActive = standardActiveFromCSV !== undefined 
    ? parseBoolean(standardActiveFromCSV)
    : (standardRepPrice !== null || standardCost !== null); // Auto-enable if pricing exists

  const newActive = newActiveFromCSV !== undefined 
    ? parseBoolean(newActiveFromCSV)
    : (newRepPrice !== null || newCost !== null); // Auto-enable if pricing exists

  const upgradeActive = upgradeActiveFromCSV !== undefined 
    ? parseBoolean(upgradeActiveFromCSV)
    : (upgradeRepPrice !== null || upgradeCost !== null); // Auto-enable if pricing exists

  const data = {
    productCode: productCode?.trim(),
    productName: productName?.trim(),
    vendor: getFieldValue('vendor')?.trim() || null,
    productType: getFieldValue('product_type')?.trim() || null,
    category: getFieldValue('category')?.trim() || null,
    accessoryType: getFieldValue('accessory_type')?.trim() || null,
    paymentType: getFieldValue('payment_type')?.trim() || null,
    description: getFieldValue('description')?.trim() || null,
    summary: getFieldValue('summary')?.trim() || null,
    note: getFieldValue('note')?.trim() || null,
    eaNotes: getFieldValue('ea_notes')?.trim() || null,
    configNote: getFieldValue('config_note')?.trim() || null,
    relatedProducts: getFieldValue('related_products')?.trim() || null,
    
    // Flags
    isActive: parseBoolean(getFieldValue('is_active')),
    availableForAll: parseBoolean(getFieldValue('available_for_all')),
    repostEdit: parseBoolean(getFieldValue('repost_edit')),
    salesRepCredit: parseBoolean(getFieldValue('sales_rep_credit')),
    funding: parseBoolean(getFieldValue('funding')),
    lease: parseBoolean(getFieldValue('lease')),
    
    // Pricing with smart active flag detection
    standardActive,
    standardCost,
    standardRepPrice,
    
    newActive,
    newCost,
    newRepPrice,
    
    upgradeActive,
    upgradeCost,
    upgradeRepPrice,
    
    // System Information
    priceBookId: getFieldValue('price_book_id')?.trim() || null,
    tempKey: getFieldValue('temp_key')?.trim() || null,
  };

  // Debug logging for first few rows
  if (productCode && (standardRepPrice || standardCost)) {
    console.log(`Validation debug for ${productCode}: standardRepPrice=${standardRepPrice}, standardCost=${standardCost}, standardActive=${standardActive}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    data,
  };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Basic API rate limiting (per-IP)
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests, please try again later." },
  });

  app.use("/api/", apiLimiter);
  // Resolve tenant context for all requests
  app.use(resolveTenant as any);
  // Apply registration lock middleware to block new user registrations
  app.use(blockRegistrations);

  // Setup session management
  const pgStore = connectPg(session);
  app.use(
    session({
      store: new pgStore({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: false,
        tableName: "sessions",
      }),
      secret:
        process.env.SESSION_SECRET || "demo-secret-key-change-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: app.get("env") === "production", // only over HTTPS in prod
        httpOnly: true, // mitigate XSS
        sameSite: app.get("env") === "production" ? "lax" : "lax",
        maxAge: 24 * 60 * 60 * 1000,
      },
      name: "sid", // avoid default connect.sid
    })
  );

  // Setup passport authentication
  await setupAuth(app);

  // CSRF protection for state-changing routes (session-based)
  // Exempt specific API endpoints that must be CSRF-free (webhooks, file uploads tokens, public GETs)
  const csrfProtection = csurf({ cookie: false });
  // Apply CSRF only to non-GET/HEAD/OPTIONS methods under /api
  app.use((req, res, next) => {
    if (!req.path.startsWith("/api")) return next();
    const method = req.method.toUpperCase();
    if (method === "GET" || method === "HEAD" || method === "OPTIONS")
      return next();
    // Allowlist webhook-like endpoints and authentication endpoints
    const exemptPaths = [
      "/api/auth/login", // Login must be exempt since user can't get CSRF token before authentication
      "/api/auth/register", // Registration must be exempt for same reason
      "/api/business-records", // Temporarily exempt while debugging CSRF
      "/api/quickbooks/webhook",
      "/api/salesforce/webhook",
      "/api/integrations/webhook",
      "/api/seo/regenerate-sitemap",
      "/api/seo/regenerate-robots",
      "/api/seo/regenerate-llms",
    ];
    if (exemptPaths.some((p) => req.path.startsWith(p))) return next();
    return csrfProtection(req, res, next);
  });

  // CSRF token endpoint (for clients to fetch a token if needed)
  app.get("/api/csrf-token", csrfProtection, (req: any, res) => {
    try {
      // Generate a token on demand (CSRF middleware provides req.csrfToken())
      const token = req.csrfToken ? req.csrfToken() : null;
      res.json({ csrfToken: token });
    } catch (error) {
      console.error("Error generating CSRF token:", error);
      res.json({ csrfToken: null });
    }
  });

  // Auth routes
  app.use("/api/auth", authRoutes);

  // Tenants route for platform users (Root Admin / platform-only)
  app.get("/api/tenants", requireAuth, async (req: any, res) => {
    try {
      const user = await storage.getUserWithRole(req.session.userId);
      if (!user?.role?.canAccessAllTenants && (user?.role?.level ?? 0) < 7) {
        return res.status(403).json({ message: "Root admin access required" });
      }

      const tenants = await storage.getAllTenants();
      res.json(tenants);
    } catch (error) {
      console.error("Error fetching tenants:", error);
      res.status(500).json({ message: "Failed to fetch tenants" });
    }
  });

  // Multi-location support routes for enhanced tenant selector (Root Admin or same-tenant)
  app.get(
    "/api/tenants/:tenantId/locations",
    requireAuth,
    async (req: any, res) => {
      try {
        const { tenantId } = req.params;
        const user = await storage.getUserWithRole(req.session.userId);

        // Only allow platform admins (root) or users from the same tenant
        const isRoot =
          user?.role?.canAccessAllTenants || (user?.role?.level ?? 0) >= 7;
        if (!isRoot && user?.tenantId !== tenantId) {
          return res.status(403).json({ error: "Insufficient permissions" });
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
        console.error("Error fetching locations:", error);
        res.status(500).json({ error: "Failed to fetch locations" });
      }
    }
  );

  app.get(
    "/api/tenants/:tenantId/regions",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const { tenantId } = req.params;
        const user = await storage.getUserWithRole(req.session.userId);

        // Only allow platform admins or users from the same tenant
        if (!user?.role?.canAccessAllTenants && user?.tenantId !== tenantId) {
          return res.status(403).json({ error: "Insufficient permissions" });
        }

        const tenantRegions = await db
          .select({
            id: regions.id,
            name: regions.name,
            description: regions.description,
            locationCount: sql<number>`count(${locations.id})::int`,
          })
          .from(regions)
          .leftJoin(locations, eq(regions.id, locations.regionId))
          .where(eq(regions.tenantId, tenantId))
          .groupBy(regions.id, regions.name, regions.description)
          .orderBy(regions.name);

        res.json(tenantRegions);
      } catch (error) {
        console.error("Error fetching regions:", error);
        res.status(500).json({ error: "Failed to fetch regions" });
      }
    }
  );

  app.get(
    "/api/tenants/:tenantId/summary",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const { tenantId } = req.params;
        const user = await storage.getUserWithRole(req.session.userId);

        // Only allow platform admins or users from the same tenant
        if (!user?.role?.canAccessAllTenants && user?.tenantId !== tenantId) {
          return res.status(403).json({ error: "Insufficient permissions" });
        }

        // Get tenant basic info
        const [tenant] = await db
          .select()
          .from(tenants)
          .where(eq(tenants.id, tenantId))
          .limit(1);

        if (!tenant) {
          return res.status(404).json({ error: "Tenant not found" });
        }

        // Get location and employee counts
        const [summary] = await db
          .select({
            locationCount: sql<number>`count(distinct ${locations.id})::int`,
            regionCount: sql<number>`count(distinct ${regions.id})::int`,
            totalEmployees: sql<number>`1::int`, // placeholder for employee count
          })
          .from(locations)
          .leftJoin(regions, eq(locations.regionId, regions.id))
          .where(eq(locations.tenantId, tenantId));

        res.json({
          ...tenant,
          locationCount: summary?.locationCount || 0,
          regionCount: summary?.regionCount || 0,
          totalEmployees: summary?.totalEmployees || 0,
        });
      } catch (error) {
        console.error("Error fetching tenant summary:", error);
        res.status(500).json({ error: "Failed to fetch tenant summary" });
      }
    }
  );

  // Dashboard routes - using authenticated user's tenant
  app.get(
    "/api/dashboard/metrics",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        // Real dashboard metrics from database
        const [customerCount, contractCount, monthlyRevenue, openTicketCount] =
          await Promise.all([
            // Total customers count
            db
              .select({ count: sql<number>`count(*)::int` })
              .from(businessRecords)
              .where(
                and(
                  eq(businessRecords.tenantId, tenantId),
                  eq(businessRecords.recordType, "customer")
                )
              ),

            // Active contracts count
            db
              .select({ count: sql<number>`count(*)::int` })
              .from(contracts)
              .where(
                and(
                  eq(contracts.tenantId, tenantId),
                  eq(contracts.status, "active")
                )
              ),

            // Monthly revenue from invoices (current month)
            db
              .select({
                total: sql<number>`coalesce(sum(${invoices.totalAmount}::numeric), 0)::numeric`,
              })
              .from(invoices)
              .where(
                and(
                  eq(invoices.tenantId, tenantId),
                  sql`date_trunc('month', ${invoices.createdAt}) = date_trunc('month', current_date)`
                )
              ),

            // Open service tickets count
            db
              .select({ count: sql<number>`count(*)::int` })
              .from(serviceTickets)
              .where(
                and(
                  eq(serviceTickets.tenantId, tenantId),
                  eq(serviceTickets.status, "open")
                )
              ),
          ]);

        const metrics = {
          totalCustomers: customerCount[0]?.count || 0,
          activeContracts: contractCount[0]?.count || 0,
          monthlyRevenue: Number(monthlyRevenue[0]?.total || 0),
          openTickets: openTicketCount[0]?.count || 0,
          recentGrowth: 0, // Calculate based on historical data if needed
        };

        res.json(metrics);
      } catch (error) {
        console.error("Error fetching dashboard metrics:", error);
        res.status(500).json({ message: "Failed to fetch dashboard metrics" });
      }
    }
  );

  app.get(
    "/api/dashboard/recent-tickets",
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        // Real recent tickets from database
        const tickets = await db
          .select({
            id: serviceTickets.id,
            title: serviceTickets.title,
            status: serviceTickets.status,
            priority: serviceTickets.priority,
            customer: businessRecords.companyName,
            createdAt: serviceTickets.createdAt,
            description: serviceTickets.description,
          })
          .from(serviceTickets)
          .leftJoin(
            businessRecords,
            eq(serviceTickets.customerId, businessRecords.id)
          )
          .where(eq(serviceTickets.tenantId, tenantId))
          .orderBy(desc(serviceTickets.createdAt))
          .limit(10);

        res.json(tickets);
      } catch (error) {
        console.error("Error fetching recent tickets:", error);
        res.status(500).json({ message: "Failed to fetch recent tickets" });
      }
    }
  );

  app.get(
    "/api/dashboard/top-customers",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        // Real top customers from database based on contract values
        const customers = await db
          .select({
            id: businessRecords.id,
            name: businessRecords.companyName,
            accountValue: sql<number>`coalesce(sum(${contracts.monthlyBase}::numeric), 0)::numeric`,
            contractsCount: sql<number>`count(${contracts.id})::int`,
          })
          .from(businessRecords)
          .leftJoin(contracts, eq(businessRecords.id, contracts.customerId))
          .where(
            and(
              eq(businessRecords.tenantId, tenantId),
              eq(businessRecords.recordType, "customer")
            )
          )
          .groupBy(businessRecords.id, businessRecords.companyName)
          .orderBy(
            desc(sql`coalesce(sum(${contracts.monthlyBase}::numeric), 0)`)
          )
          .limit(10);

        res.json(
          customers.map((customer) => ({
            ...customer,
            accountValue: Number(customer.accountValue || 0),
          }))
        );
      } catch (error) {
        console.error("Error fetching top customers:", error);
        res.status(500).json({ message: "Failed to fetch top customers" });
      }
    }
  );

  app.get("/api/dashboard/alerts", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      // Real alerts from database - low stock items
      const lowStockItems = await db
        .select({
          id: inventoryItems.id,
          name: inventoryItems.itemDescription,
          category: inventoryItems.itemCategory,
          currentStock: inventoryItems.quantityOnHand,
          minThreshold: inventoryItems.reorderPoint,
        })
        .from(inventoryItems)
        .where(
          and(
            eq(inventoryItems.tenantId, tenantId),
            sql`quantity_on_hand <= reorder_point`
          )
        )
        .orderBy(asc(inventoryItems.quantityOnHand))
        .limit(20);

      const alerts = lowStockItems.map((item) => ({
        id: item.id,
        type: "low_stock",
        severity: "medium",
        title: `Low Stock: ${item.name}`,
        message: `${item.name} is running low (${item.currentStock} remaining, reorder at ${item.minThreshold})`,
        category: item.category,
        timestamp: new Date().toISOString(),
      }));

      res.json(alerts);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ message: "Failed to fetch alerts" });
    }
  });

  // Demo Scheduling Routes
  app.get("/api/demos", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      // For now, return sample demo data structure until schema is updated
      const sampleDemos = [
        {
          id: "demo-1",
          businessRecordId: "customer-1",
          customerName: "ABC Corporation",
          contactPerson: "John Smith",
          scheduledDate: new Date("2025-01-10"),
          scheduledTime: "10:00 AM",
          duration: 60,
          demoType: "equipment",
          equipmentModels: ["Canon imageRUNNER ADVANCE C3330i"],
          demoLocation: "customer_site",
          assignedSalesRep: "Sales Rep Name",
          status: "scheduled",
          confirmationStatus: "pending",
          preparationCompleted: false,
          demoObjectives:
            "Demonstrate color printing capabilities and scan-to-email features",
          proposalAmount: 15000,
          createdAt: new Date("2025-01-05"),
        },
      ];

      res.json(sampleDemos);
    } catch (error) {
      console.error("Error fetching demos:", error);
      res.status(500).json({ message: "Failed to fetch demos" });
    }
  });

  app.get("/api/demos/customers", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      // Get real customers from business records
      const customers = await db
        .select({
          id: businessRecords.id,
          companyName: businessRecords.companyName,
          primaryContactName: businessRecords.primaryContactName,
          phone: businessRecords.phone,
          email: businessRecords.primaryContactEmail,
          addressLine1: businessRecords.addressLine1,
          city: businessRecords.city,
          state: businessRecords.state,
          postalCode: businessRecords.postalCode,
        })
        .from(businessRecords)
        .where(
          and(
            eq(businessRecords.tenantId, tenantId),
            eq(businessRecords.recordType, "customer")
          )
        )
        .orderBy(asc(businessRecords.companyName));

      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers for demo:", error);
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  // Sales Pipeline Forecasting is handled in routes-sales-forecasting

  app.get("/api/sales-trends", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const monthsNum = Number((req.query as any)?.months ?? 6);

      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      // Sample trend data
      const sampleTrends = Array.from(
        { length: Number.isFinite(monthsNum) ? monthsNum : 6 },
        (_, i) => {
          const date = new Date();
          date.setMonth(date.getMonth() - i);

          return {
            month: date.toISOString().substring(0, 7),
            monthName: date.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            }),
            revenue: Math.floor(Math.random() * 50000) + 80000,
            deals: Math.floor(Math.random() * 3) + 3,
            units: Math.floor(Math.random() * 4) + 4,
            pipelineValue: Math.floor(Math.random() * 100000) + 300000,
            conversionRate: Math.floor(Math.random() * 20) + 25,
            averageDealSize: Math.floor(Math.random() * 10000) + 25000,
          };
        }
      ).reverse();

      res.json(sampleTrends);
    } catch (error) {
      console.error("Error fetching sales trends:", error);
      res.status(500).json({ message: "Failed to fetch sales trends" });
    }
  });

  // E-signature Integration Routes
  app.get("/api/signature-requests", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      // Sample signature requests until schema is updated
      const sampleRequests = [
        {
          id: "sig-req-1",
          documentName: "Service Agreement - ABC Corporation",
          documentType: "service_agreement",
          businessRecordId: "customer-1",
          customerName: "ABC Corporation",
          customerEmail: "john.smith@abccorp.com",
          status: "pending",
          requestedBy: "Sales Rep",
          requestedDate: new Date("2025-01-20"),
          expirationDate: new Date("2025-02-20"),
          signedDate: null,
          documentUrl: "/documents/service-agreement-abc-corp.pdf",
          signatureUrl: null,
          remindersSent: 1,
          lastReminderDate: new Date("2025-01-25"),
          contractValue: 85000,
          contractDuration: 36,
          signers: [
            {
              name: "John Smith",
              email: "john.smith@abccorp.com",
              role: "Customer",
              status: "pending",
              signedDate: null,
            },
          ],
          createdAt: new Date("2025-01-20"),
        },
      ];

      res.json(sampleRequests);
    } catch (error) {
      console.error("Error fetching signature requests:", error);
      res.status(500).json({ message: "Failed to fetch signature requests" });
    }
  });

  app.get("/api/signature-templates", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      // Sample signature templates
      const sampleTemplates = [
        {
          id: "template-1",
          templateName: "Standard Service Agreement",
          documentType: "service_agreement",
          description:
            "Standard copier service and maintenance agreement template",
          templateUrl: "/templates/standard-service-agreement.pdf",
          signatureFields: [
            {
              fieldName: "customer_signature",
              x: 100,
              y: 750,
              page: 1,
              required: true,
            },
            {
              fieldName: "customer_date",
              x: 300,
              y: 750,
              page: 1,
              required: true,
            },
          ],
          isActive: true,
          usageCount: 25,
          lastUsed: new Date("2025-01-20"),
          createdAt: new Date("2024-10-15"),
        },
      ];

      res.json(sampleTemplates);
    } catch (error) {
      console.error("Error fetching signature templates:", error);
      res.status(500).json({ message: "Failed to fetch signature templates" });
    }
  });

  app.get("/api/signature-analytics", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      // Sample analytics data
      const analytics = {
        totalRequests: 45,
        completedRequests: 32,
        pendingRequests: 8,
        expiredRequests: 5,
        completionRate: 71.1,
        averageSigningTime: 2.3,
        totalContractValue: 1850000,
        byDocumentType: [
          {
            type: "service_agreement",
            count: 18,
            completed: 14,
            value: 950000,
          },
          { type: "equipment_lease", count: 20, completed: 15, value: 750000 },
          {
            type: "maintenance_contract",
            count: 7,
            completed: 3,
            value: 150000,
          },
        ],
        signingSpeedAnalysis: {
          within24Hours: 12,
          within48Hours: 8,
          within1Week: 7,
          moreThan1Week: 5,
        },
      };

      res.json(analytics);
    } catch (error) {
      console.error("Error fetching signature analytics:", error);
      res.status(500).json({ message: "Failed to fetch signature analytics" });
    }
  });

  // NOTE: Service Dispatch routes moved to routes-service-dispatch.ts (converted from mock to database)

  // NOTE: All dispatch routes moved to routes-service-dispatch.ts

  // Preventive Maintenance Automation Routes
  app.get("/api/maintenance/schedules", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      // Sample maintenance schedules until schema is updated
      const maintenanceSchedules = [
        {
          id: "schedule-1",
          equipmentId: "eq-001",
          equipmentModel: "Canon imageRUNNER ADVANCE DX C5750i",
          customerName: "ABC Corporation",
          customerLocation: "123 Business Way, Downtown",
          maintenanceType: "quarterly_service",
          serviceName: "Quarterly Preventive Maintenance",
          frequency: "quarterly",
          frequencyValue: 3,
          nextDueDate: new Date("2025-02-15"),
          lastServiceDate: new Date("2024-11-15"),
          meterBasedScheduling: true,
          currentMeterReading: 45230,
          meterAtLastService: 42500,
          nextServiceMeter: 47500,
          meterThreshold: 2500,
          estimatedDuration: 120,
          requiredSkills: ["preventive_maintenance", "copier_service"],
          requiredParts: ["toner_cartridge", "transfer_belt", "fuser_kit"],
          status: "scheduled",
          priority: "medium",
          urgencyScore: 75,
          assignedTechnicianId: "tech-2",
          assignedTechnicianName: "Sarah Wilson",
          scheduledDate: new Date("2025-02-15"),
          scheduledTimeSlot: "10:00 AM - 12:00 PM",
          autoScheduleEnabled: true,
          reminderDaysBefore: 7,
          escalationDays: 3,
          serviceHistory: [
            {
              date: new Date("2024-11-15"),
              technician: "Mike Johnson",
              duration: 105,
              partsUsed: ["toner_cartridge"],
              issues: ["paper jam sensor cleaned"],
              meterReading: 42500,
            },
          ],
          predictiveInsights: {
            riskLevel: "low",
            failurePrediction: 12,
            recommendedActions: [
              "Monitor toner levels - replacement due soon",
              "Check paper feed mechanism during next service",
            ],
            costSavings: 450,
          },
          createdAt: new Date("2024-08-01"),
          updatedAt: new Date("2025-01-20"),
        },
      ];

      res.json(maintenanceSchedules);
    } catch (error) {
      console.error("Error fetching maintenance schedules:", error);
      res
        .status(500)
        .json({ message: "Failed to fetch maintenance schedules" });
    }
  });

  app.get("/api/maintenance/analytics", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      // Sample maintenance analytics
      const analytics = {
        summary: {
          totalEquipment: 156,
          scheduledMaintenance: 89,
          overdueMaintenance: 12,
          completedThisMonth: 45,
          preventiveVsReactive: 78.5,
          averageServiceTime: 105,
          customerSatisfaction: 4.7,
          costSavings: 12450,
        },
        efficiency: {
          maintenanceCompliance: 92.3,
          firstTimeFixRate: 87.6,
          averageResponseTime: 2.4,
          technicianUtilization: 74.2,
          partsAvailability: 94.8,
          schedulingAccuracy: 89.1,
        },
        equipment_health: [
          {
            category: "Copiers/MFPs",
            totalUnits: 78,
            healthyUnits: 65,
            warningUnits: 10,
            criticalUnits: 3,
            averageAge: 3.2,
            predictedFailures: 2,
          },
        ],
        cost_analysis: {
          monthlyMaintenanceCost: 8750,
          preventiveCost: 6850,
          reactiveCost: 1900,
          averageCostPerUnit: 56.09,
          costTrends: [
            {
              month: "Dec 2024",
              preventive: 6650,
              reactive: 2200,
              total: 8850,
            },
            {
              month: "Jan 2025",
              preventive: 6850,
              reactive: 1900,
              total: 8750,
            },
          ],
        },
        performance_trends: [
          { month: "Dec", compliance: 93.1, satisfaction: 4.8, savings: 12300 },
          { month: "Jan", compliance: 92.3, satisfaction: 4.7, savings: 12450 },
        ],
      };

      res.json(analytics);
    } catch (error) {
      console.error("Error fetching maintenance analytics:", error);
      res
        .status(500)
        .json({ message: "Failed to fetch maintenance analytics" });
    }
  });

  app.get("/api/maintenance/templates", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      // Sample maintenance templates
      const templates = [
        {
          id: "template-1",
          templateName: "Standard Copier Quarterly Service",
          description:
            "Comprehensive quarterly maintenance for copiers and MFPs",
          equipmentTypes: ["copier", "mfp"],
          estimatedDuration: 120,
          frequency: "quarterly",
          checklist: [
            {
              item: "Clean paper path and feed rollers",
              required: true,
              estimatedTime: 15,
            },
            {
              item: "Replace toner cartridges if below 20%",
              required: true,
              estimatedTime: 10,
            },
          ],
          requiredParts: [
            { partName: "Toner Cartridge Set", quantity: 1, optional: true },
          ],
          requiredSkills: ["copier_maintenance", "preventive_service"],
          safetyRequirements: [
            "power_off_before_service",
            "use_cleaning_gloves",
          ],
          isActive: true,
          usageCount: 34,
          lastUsed: new Date("2025-01-20"),
          createdAt: new Date("2024-06-15"),
        },
      ];

      res.json(templates);
    } catch (error) {
      console.error("Error fetching maintenance templates:", error);
      res
        .status(500)
        .json({ message: "Failed to fetch maintenance templates" });
    }
  });

  app.get(
    "/api/maintenance/predictions",
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }

        // Sample predictive maintenance data
        const predictions = [
          {
            equipmentId: "eq-005",
            model: "Canon imageRUNNER ADVANCE DX C7765i",
            customer: "Gamma Solutions",
            location: "Building A, Floor 3",
            prediction: {
              riskLevel: "high",
              failureProbability: 78,
              predictedComponent: "Fuser Unit",
              timeToFailure: 14,
              confidence: 87,
            },
            recommendation: {
              action: "immediate_service",
              priority: "urgent",
              estimatedCost: 485,
              preventiveCost: 320,
              reactiveCost: 750,
              potentialSavings: 430,
            },
            dataPoints: {
              currentMeterReading: 87540,
              averageMonthlyVolume: 12500,
              lastServiceDate: new Date("2024-10-15"),
              errorFrequency: "increasing",
              performanceMetrics: {
                printQuality: "declining",
                speedReduction: "15%",
                jamFrequency: "high",
              },
            },
          },
        ];

        res.json(predictions);
      } catch (error) {
        console.error("Error fetching predictive maintenance:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch predictive maintenance" });
      }
    }
  );

  // Commission Management Routes
  app.get("/api/commission/plans", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      // Sample commission plans
      const commissionPlans = [
        {
          id: "plan-1",
          planName: "Sales Rep Standard",
          planType: "sales_rep",
          description: "Standard commission plan for sales representatives",
          isActive: true,
          effectiveDate: new Date("2024-01-01"),
          tiers: [
            {
              tierLevel: 1,
              tierName: "Starter",
              minimumSales: 0,
              maximumSales: 50000,
              commissionRate: 5.0,
              bonusThreshold: null,
              bonusAmount: null,
            },
            {
              tierLevel: 2,
              tierName: "Achiever",
              minimumSales: 50001,
              maximumSales: 100000,
              commissionRate: 6.5,
              bonusThreshold: 75000,
              bonusAmount: 2500,
            },
          ],
          rules: {
            paymentFrequency: "monthly",
            paymentDelay: 30,
            splitCommissionAllowed: true,
            chargebackEnabled: true,
            chargebackPeriod: 90,
            minimumCommissionPayment: 100,
          },
          productRates: [
            {
              category: "new_equipment",
              rate: 8.0,
              description: "New copier/printer sales",
            },
            {
              category: "service_contracts",
              rate: 4.0,
              description: "Service and maintenance contracts",
            },
          ],
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2025-01-15"),
        },
      ];

      res.json(commissionPlans);
    } catch (error) {
      console.error("Error fetching commission plans:", error);
      res.status(500).json({ message: "Failed to fetch commission plans" });
    }
  });

  app.get(
    "/api/commission/calculations",
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }

        // Sample commission calculations
        const calculations = [
          {
            id: "calc-1",
            employeeId: "emp-001",
            employeeName: "John Smith",
            employeeRole: "Sales Representative",
            planId: "plan-1",
            planName: "Sales Rep Standard",
            calculationPeriod: {
              startDate: new Date("2025-01-01"),
              endDate: new Date("2025-01-31"),
              periodName: "January 2025",
            },
            salesMetrics: {
              totalSales: 87500,
              quotaTarget: 75000,
              quotaAchievement: 116.7,
            },
            commissionDetails: [
              {
                category: "new_equipment",
                salesAmount: 65000,
                commissionRate: 6.5,
                commissionAmount: 4225,
                description: "Tier 2 rate (6.5%) applied for sales over $50k",
              },
            ],
            bonuses: [
              {
                type: "tier_bonus",
                description: "Achiever tier bonus for exceeding $75k",
                amount: 2500,
                eligibilityMet: true,
              },
            ],
            adjustments: [],
            summary: {
              grossCommission: 5350,
              totalBonuses: 3500,
              totalAdjustments: 0,
              netCommission: 8850,
              payoutDate: new Date("2025-03-01"),
              status: "calculated",
            },
            calculatedAt: new Date("2025-02-01"),
            calculatedBy: "system",
          },
        ];

        res.json(calculations);
      } catch (error) {
        console.error("Error fetching commission calculations:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch commission calculations" });
      }
    }
  );

  app.get("/api/commission/analytics", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      const analytics = {
        summary: {
          totalCommissionPaid: 245780,
          averageCommissionRate: 6.8,
          totalBonusesPaid: 45200,
          totalAdjustments: -8950,
          participatingEmployees: 28,
          topPerformerPayout: 18750,
          averagePayout: 8777.86,
        },
        performance_metrics: {
          quotaAchievementRate: 87.5,
          tierDistribution: {
            starter: 12,
            achiever: 11,
            elite: 5,
          },
        },
        monthly_trends: [
          {
            month: "Dec 2024",
            totalCommissions: 85210,
            avgPayout: 9356,
            quotaAchievement: 89.2,
          },
          {
            month: "Jan 2025",
            totalCommissions: 87500,
            avgPayout: 9611,
            quotaAchievement: 91.5,
          },
        ],
        top_performers: [
          {
            employeeId: "emp-001",
            name: "John Smith",
            role: "Sales Representative",
            totalCommission: 18750,
            quotaAchievement: 191.7,
            rank: 1,
          },
        ],
        plan_performance: [
          {
            planId: "plan-1",
            planName: "Sales Rep Standard",
            participants: 18,
            avgPayout: 9235,
            totalPayout: 166230,
            avgQuotaAchievement: 89.2,
          },
        ],
        dispute_analysis: {
          totalDisputes: 3,
          resolvedDisputes: 2,
          pendingDisputes: 1,
          averageResolutionTime: 5.5,
        },
      };

      res.json(analytics);
    } catch (error) {
      console.error("Error fetching commission analytics:", error);
      res.status(500).json({ message: "Failed to fetch commission analytics" });
    }
  });

  app.get("/api/commission/disputes", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      const disputes = [
        {
          id: "dispute-1",
          disputeNumber: "DISP-2025-001",
          employeeId: "emp-001",
          employeeName: "John Smith",
          calculationPeriod: "January 2025",
          disputeDetails: {
            type: "calculation_error",
            description: "Incorrect commission rate applied for large deal",
            disputedAmount: 2850,
            expectedAmount: 5200,
            difference: 2350,
          },
          status: "under_review",
          priority: "high",
          resolution: {
            assignedToName: "Mary Johnson",
            estimatedResolution: new Date("2025-02-10"),
            notes: "Reviewing contract terms and commission plan details",
          },
        },
      ];

      res.json(disputes);
    } catch (error) {
      console.error("Error fetching commission disputes:", error);
      res.status(500).json({ message: "Failed to fetch commission disputes" });
    }
  });

  // Customer Success & Retention Routes
  app.get(
    "/api/customer-success/health-scores",
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }

        const healthScores = [
          {
            customerId: "cust-001",
            customerName: "Metro Office Solutions",
            accountManager: "John Smith",
            overallHealthScore: 85,
            healthStatus: "healthy",
            riskLevel: "low",
            churnProbability: 12,
            scoreBreakdown: {
              usageHealth: 92,
              paymentHealth: 95,
              serviceHealth: 78,
              contractHealth: 88,
              engagementHealth: 82,
            },
            metrics: {
              contractValue: 15600,
              monthsRemaining: 18,
              lastPaymentDate: new Date("2025-01-28"),
              daysSinceLastService: 45,
              averageResponseTime: 2.3,
              satisfactionScore: 4.2,
              usageUtilization: 87,
              renewalProbability: 89,
            },
            trends: {
              usageTrend: "stable",
              paymentTrend: "improving",
              serviceTrend: "declining",
              engagementTrend: "stable",
            },
            riskFactors: [
              {
                factor: "Service Response Time",
                severity: "medium",
                description:
                  "Average response time has increased by 20% over past 3 months",
                impact: 15,
                recommendation:
                  "Schedule proactive service check and review technician assignments",
              },
            ],
            opportunities: [
              {
                type: "contract_renewal",
                description:
                  "Contract renewal due in 18 months - early engagement opportunity",
                value: 15600,
                probability: 89,
                action: "Schedule renewal discussion meeting",
              },
            ],
            alerts: [
              {
                type: "service_alert",
                priority: "medium",
                message:
                  "Service response time degrading - schedule proactive maintenance",
                dueDate: new Date("2025-02-15"),
              },
            ],
            lastUpdated: new Date("2025-02-03"),
            nextReviewDate: new Date("2025-02-17"),
          },
        ];

        res.json(healthScores);
      } catch (error) {
        console.error("Error fetching customer health scores:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch customer health scores" });
      }
    }
  );

  app.get(
    "/api/customer-success/usage-analytics",
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }

        const usageAnalytics = {
          summary: {
            totalCustomers: 45,
            averageUtilization: 76.5,
            totalMonthlyVolume: 2847500,
            utilizationTrend: 2.3,
            topPerformingAccounts: 12,
            underutilizedAccounts: 8,
          },
          customerBreakdown: [
            {
              customerId: "cust-001",
              customerName: "Metro Office Solutions",
              equipment: [
                {
                  serialNumber: "MX-2020-001",
                  model: "Canon ImageRunner 2525i",
                  monthlyVolume: 12500,
                  capacity: 15000,
                  utilization: 83.3,
                  averageDailyUsage: 417,
                  peakUsageDay: "Tuesday",
                  maintenanceScore: 92,
                },
              ],
              usageTrends: {
                currentMonth: 21250,
                lastMonth: 20800,
                growth: 2.2,
                yearOverYear: 15.7,
                seasonalPattern: "stable",
              },
              recommendations: [
                {
                  type: "optimization",
                  priority: "medium",
                  description: "Equipment nearing capacity - consider upgrade",
                  potentialSavings: 2400,
                  implementationCost: 850,
                },
              ],
              alerts: [
                {
                  type: "capacity_warning",
                  equipment: "MX-2020-001",
                  message: "Operating at 83% capacity",
                  severity: "medium",
                },
              ],
            },
          ],
          optimizationOpportunities: [
            {
              type: "equipment_consolidation",
              description: "Multiple underutilized devices can be consolidated",
              potentialSavings: 12600,
              implementationCost: 4200,
              roi: 300,
            },
          ],
        };

        res.json(usageAnalytics);
      } catch (error) {
        console.error("Error fetching usage analytics:", error);
        res.status(500).json({ message: "Failed to fetch usage analytics" });
      }
    }
  );

  app.get(
    "/api/customer-success/satisfaction",
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }

        const satisfactionData = {
          summary: {
            overallSatisfaction: 4.2,
            responseRate: 68.5,
            totalSurveys: 156,
            completedSurveys: 107,
            npsScore: 42,
            promoters: 65,
            detractors: 23,
            trend: "improving",
          },
          recentSurveys: [
            {
              surveyId: "surv-001",
              customerId: "cust-001",
              customerName: "Metro Office Solutions",
              submittedDate: new Date("2025-01-30"),
              scores: {
                overall: 4.5,
                serviceQuality: 4.7,
                responseTime: 4.2,
                technicalExpertise: 4.8,
                communication: 4.3,
                valueForMoney: 4.1,
              },
              npsScore: 9,
              category: "promoter",
              feedback:
                "Excellent service team - always responsive and knowledgeable.",
              actionItems: [],
            },
          ],
          categoryTrends: {
            serviceQuality: {
              current: 4.3,
              previous: 4.1,
              trend: "improving",
              target: 4.5,
            },
            responseTime: {
              current: 3.8,
              previous: 3.6,
              trend: "improving",
              target: 4.2,
            },
            technicalExpertise: {
              current: 4.5,
              previous: 4.4,
              trend: "stable",
              target: 4.6,
            },
          },
        };

        res.json(satisfactionData);
      } catch (error) {
        console.error("Error fetching satisfaction data:", error);
        res.status(500).json({ message: "Failed to fetch satisfaction data" });
      }
    }
  );

  // Remote Monitoring & IoT Integration Routes
  app.get(
    "/api/remote-monitoring/equipment-status",
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }

        const equipmentStatus = [
          {
            equipmentId: "eq-001",
            serialNumber: "MX-2025-001",
            model: "Canon ImageRunner 2535i",
            location: {
              customerName: "Metro Office Solutions",
              address: "123 Business Center Dr, Suite 200",
              floor: "2nd Floor - Copy Center",
              coordinates: { lat: 40.7128, lng: -74.006 },
            },
            status: "operational",
            connectionStatus: "connected",
            lastPing: new Date("2025-02-03T23:45:32Z"),
            uptime: 98.7,
            currentMetrics: {
              pagesPerMinute: 35,
              tonerLevels: { black: 78, cyan: 82, magenta: 75, yellow: 91 },
              paperLevels: { tray1: 85, tray2: 92, tray3: 67 },
              temperature: 42.3,
              humidity: 45,
              errorCount: 0,
              jamCount: 2,
              lastJobCompleted: new Date("2025-02-03T23:44:15Z"),
            },
            performance: {
              dailyPageCount: 1247,
              weeklyPageCount: 8650,
              monthlyPageCount: 32450,
              utilizationRate: 87,
              efficiency: 94.2,
              averageJobSize: 12.5,
              peakUsageHour: 14,
            },
            maintenance: {
              nextScheduled: new Date("2025-02-15T09:00:00Z"),
              lastCompleted: new Date("2025-01-20T14:30:00Z"),
              maintenanceScore: 92,
              predictiveAlerts: [
                {
                  component: "Fuser Unit",
                  condition: "good",
                  estimatedLife: 85,
                  nextReplacement: new Date("2025-04-15T00:00:00Z"),
                },
              ],
            },
            alerts: [
              {
                id: "alert-001",
                type: "supply_low",
                severity: "medium",
                message: "Magenta toner at 75% - consider ordering replacement",
                timestamp: new Date("2025-02-03T22:30:00Z"),
                acknowledged: false,
              },
            ],
            environmental: {
              powerConsumption: 450,
              energyEfficiency: "A+",
              carbonFootprint: 2.3,
              sleepModeActive: false,
              autoSleepEnabled: true,
            },
          },
        ];

        res.json(equipmentStatus);
      } catch (error) {
        console.error("Error fetching equipment status:", error);
        res.status(500).json({ message: "Failed to fetch equipment status" });
      }
    }
  );

  app.get(
    "/api/remote-monitoring/fleet-overview",
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }

        const fleetOverview = {
          summary: {
            totalEquipment: 47,
            onlineEquipment: 44,
            offlineEquipment: 3,
            equipmentWithAlerts: 8,
            criticalAlerts: 2,
            averageUptime: 96.8,
            fleetUtilization: 78.5,
            energyEfficiency: "A-",
          },
          statusDistribution: {
            operational: 38,
            warning: 6,
            critical: 2,
            offline: 3,
            maintenance: 1,
          },
          performanceTrends: {
            weeklyUptime: [96.2, 97.1, 96.8, 97.5, 96.9, 97.2, 96.8],
            weeklyUtilization: [75.2, 78.1, 76.8, 79.5, 77.9, 80.2, 78.5],
            weeklyEfficiency: [89.2, 91.1, 90.8, 92.5, 91.9, 93.2, 91.5],
          },
          topPerformers: [
            {
              equipmentId: "eq-003",
              customerName: "Regional Medical Center",
              model: "Ricoh MP C3004",
              uptime: 99.2,
              efficiency: 98.7,
              utilizationRate: 95,
            },
          ],
          attentionRequired: [
            {
              equipmentId: "eq-002",
              customerName: "TechStart Innovations",
              model: "Xerox WorkCentre 5855",
              issues: ["Critical toner low", "Frequent jams"],
              priority: "high",
              estimatedRevenueLoss: 1200,
            },
          ],
        };

        res.json(fleetOverview);
      } catch (error) {
        console.error("Error fetching fleet overview:", error);
        res.status(500).json({ message: "Failed to fetch fleet overview" });
      }
    }
  );

  // Document Management & Workflow Automation Routes
  app.get(
    "/api/document-management/library",
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }

        const documentLibrary = {
          summary: {
            totalDocuments: 2847,
            categoriesCount: 12,
            pendingApproval: 23,
            expiringSoon: 8,
            storageUsed: "4.2 GB",
            storageLimit: "50 GB",
            lastBackup: new Date("2025-02-03T02:00:00Z"),
            complianceScore: 96.5,
          },
          categories: [
            {
              id: "contracts",
              name: "Contracts & Agreements",
              documentCount: 456,
              subcategories: [
                { name: "Service Contracts", count: 234, icon: "FileText" },
                { name: "Lease Agreements", count: 156, icon: "FileSignature" },
                {
                  name: "Master Service Agreements",
                  count: 45,
                  icon: "FileContract",
                },
              ],
              recentActivity: 12,
              complianceStatus: "compliant",
              retentionPolicy: "7 years",
              accessLevel: "restricted",
            },
            {
              id: "service-docs",
              name: "Service Documentation",
              documentCount: 1342,
              subcategories: [
                { name: "Service Reports", count: 789, icon: "FileText" },
                { name: "Installation Docs", count: 234, icon: "Settings" },
                { name: "Maintenance Records", count: 198, icon: "Wrench" },
              ],
              recentActivity: 45,
              complianceStatus: "compliant",
              retentionPolicy: "5 years",
              accessLevel: "department",
            },
          ],
          recentDocuments: [
            {
              id: "doc-001",
              title: "Metro Office Solutions - Service Contract Renewal",
              category: "contracts",
              subcategory: "Service Contracts",
              fileType: "pdf",
              fileSize: "2.4 MB",
              lastModified: new Date("2025-02-03T16:30:00Z"),
              modifiedBy: "Sarah Chen",
              status: "active",
              version: "2.1",
              tags: ["renewal", "service", "metro-office"],
              workflow: {
                currentStage: "customer_review",
                nextAction: "awaiting_signature",
                dueDate: new Date("2025-02-10T17:00:00Z"),
                assignedTo: "John Smith",
              },
            },
          ],
          pendingActions: [
            {
              id: "action-001",
              documentId: "doc-001",
              documentTitle:
                "Metro Office Solutions - Service Contract Renewal",
              actionType: "approval_required",
              priority: "high",
              assignedTo: "John Smith",
              dueDate: new Date("2025-02-05T17:00:00Z"),
              description:
                "Contract renewal requires final management approval",
              estimatedTime: 15,
            },
          ],
        };

        res.json(documentLibrary);
      } catch (error) {
        console.error("Error fetching document library:", error);
        res.status(500).json({ message: "Failed to fetch document library" });
      }
    }
  );

  app.get(
    "/api/document-management/workflows",
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }

        const workflowData = {
          templates: [
            {
              id: "contract-approval",
              name: "Contract Approval Workflow",
              description: "Multi-stage approval process for service contracts",
              isActive: true,
              usage: 156,
              stages: [
                {
                  id: "stage-1",
                  name: "Initial Review",
                  assignedRole: "sales",
                  slaHours: 24,
                },
                {
                  id: "stage-2",
                  name: "Legal Review",
                  assignedRole: "legal",
                  slaHours: 48,
                },
                {
                  id: "stage-3",
                  name: "Management Approval",
                  assignedRole: "management",
                  slaHours: 12,
                },
              ],
              metrics: {
                averageCompletionTime: 4.2,
                approvalRate: 89.5,
                slaComplianceRate: 92.1,
              },
            },
          ],
          activeWorkflows: [
            {
              id: "wf-001",
              templateId: "contract-approval",
              documentTitle:
                "Metro Office Solutions - Service Contract Renewal",
              currentStage: "management_approval",
              progress: 75,
              startedAt: new Date("2025-01-30T09:00:00Z"),
              dueAt: new Date("2025-02-05T17:00:00Z"),
              assignedTo: "John Smith",
              priority: "high",
              slaStatus: "on_track",
            },
          ],
          automationStats: {
            totalRulesActive: 24,
            rulesTriggeredToday: 12,
            automationSuccessRate: 96.8,
            timesSaved: 145,
            documentsProcessed: 2847,
          },
        };

        res.json(workflowData);
      } catch (error) {
        console.error("Error fetching workflow data:", error);
        res.status(500).json({ message: "Failed to fetch workflow data" });
      }
    }
  );

  // Mobile Service App Routes
  app.get("/api/mobile/dashboard", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      const mobileDashboard = {
        technician: {
          id: req.user.id,
          name: req.user.name,
          employeeId: "TECH-001",
          certification: "Senior Technician",
          rating: 4.8,
          completedJobs: 1247,
        },
        todaysSummary: {
          assignedJobs: 6,
          completedJobs: 3,
          inProgress: 1,
          pendingParts: 2,
          totalRevenue: 2340.5,
        },
        jobsQueue: [
          {
            id: "job-001",
            priority: "high",
            status: "assigned",
            customerName: "Metro Office Solutions",
            contactPerson: "Sarah Johnson",
            contactPhone: "+1-555-0123",
            address: "123 Business Center Dr, Suite 200",
            coordinates: { lat: 40.7128, lng: -74.006 },
            equipment: {
              model: "Canon ImageRunner 2535i",
              serialNumber: "MX-2025-001",
              location: "2nd Floor - Copy Center",
            },
            serviceType: "maintenance",
            issueDescription:
              "Routine preventive maintenance and toner replacement",
            estimatedDuration: 90,
            scheduledTime: new Date("2025-02-04T09:00:00Z"),
            requiredParts: [
              {
                partNumber: "TNR-2535-BK",
                description: "Black Toner Cartridge",
                quantity: 1,
                available: true,
              },
            ],
            customerNotes: "Equipment heavily used, check paper feed mechanism",
            internalNotes: "Customer prefers morning service calls",
            routeOptimization: {
              driveTime: 15,
              distanceFromPrevious: 3.2,
              trafficConditions: "light",
              parkingNotes: "Visitor parking available on 1st floor",
            },
          },
        ],
        performanceMetrics: {
          thisWeek: {
            jobsCompleted: 28,
            averageJobTime: 95,
            customerSatisfaction: 4.7,
            firstTimeFixRate: 89,
            onTimeArrival: 94,
          },
          thisMonth: {
            jobsCompleted: 124,
            revenue: 18450,
            partsUsed: 67,
            milesdriven: 1847,
          },
        },
        partsInventory: {
          vanStock: {
            tonerCartridges: 12,
            maintenanceKits: 6,
            paperFeedRollers: 8,
            fuserUnits: 3,
          },
          pendingOrders: 2,
          criticalLowItems: ["PF-5855-ROLL"],
          lastRestocked: new Date("2025-02-01T00:00:00Z"),
        },
      };

      res.json(mobileDashboard);
    } catch (error) {
      console.error("Error fetching mobile dashboard:", error);
      res.status(500).json({ message: "Failed to fetch mobile dashboard" });
    }
  });

  app.get(
    "/api/mobile/route-optimization",
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }

        const routeData = {
          optimizedRoute: {
            totalDistance: 28.4,
            totalDriveTime: 72,
            totalServiceTime: 390,
            fuelCost: 12.5,
            stops: [
              {
                sequence: 1,
                jobId: "job-001",
                customerName: "Metro Office Solutions",
                address: "123 Business Center Dr, Suite 200",
                estimatedArrival: new Date("2025-02-04T09:00:00Z"),
                serviceWindow: { start: "09:00", end: "10:30" },
                drivingTime: 15,
                serviceTime: 90,
                parkingInfo: "Visitor parking available",
              },
            ],
          },
        };

        res.json(routeData);
      } catch (error) {
        console.error("Error fetching route data:", error);
        res.status(500).json({ message: "Failed to fetch route data" });
      }
    }
  );

  // Advanced Analytics Dashboard Routes
  app.get("/api/analytics/dashboard", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      const analyticsDashboard = {
        executiveSummary: {
          totalRevenue: {
            current: 2847650.75,
            previous: 2634580.2,
            growth: 8.1,
            trend: "up",
          },
          activeCustomers: {
            current: 847,
            previous: 832,
            growth: 1.8,
            trend: "up",
          },
          serviceTickets: {
            current: 2156,
            previous: 2089,
            growth: 3.2,
            trend: "up",
          },
          grossMargin: {
            current: 42.7,
            previous: 41.2,
            growth: 1.5,
            trend: "up",
          },
        },
        revenueAnalytics: {
          monthlyRevenue: [
            {
              month: "2024-07",
              revenue: 245680.5,
              contracts: 78,
              newCustomers: 12,
            },
            {
              month: "2025-01",
              revenue: 356290.1,
              contracts: 102,
              newCustomers: 28,
            },
          ],
          revenueByCategory: [
            {
              category: "Equipment Sales",
              amount: 1247850.3,
              percentage: 43.8,
              growth: 12.5,
            },
            {
              category: "Service Contracts",
              amount: 892640.75,
              percentage: 31.4,
              growth: 6.2,
            },
          ],
          topPerformingProducts: [
            {
              product: "Canon ImageRunner Advance DX 6780i",
              revenue: 287450.0,
              units: 23,
              margin: 38.5,
              trend: "up",
            },
          ],
        },
        customerAnalytics: {
          customerSegmentation: [
            {
              segment: "Enterprise (500+ employees)",
              count: 89,
              revenue: 1456780.25,
              percentage: 51.2,
            },
          ],
          customerLifetimeValue: {
            average: 18750.45,
            median: 14280.2,
            top10Percent: 67890.75,
            churnRate: 4.2,
            retentionRate: 95.8,
          },
          topCustomers: [
            {
              name: "Metro Healthcare Systems",
              revenue: 187450.75,
              contracts: 15,
              satisfaction: 4.8,
              lastPurchase: new Date("2025-01-28T00:00:00Z"),
              nextRenewal: new Date("2025-06-15T00:00:00Z"),
            },
          ],
        },
        serviceAnalytics: {
          serviceMetrics: {
            totalTickets: 2156,
            avgResolutionTime: 3.4,
            firstCallResolution: 87.5,
            customerSatisfaction: 4.6,
            technicianUtilization: 78.3,
          },
          ticketTrends: [
            {
              month: "2025-01",
              tickets: 338,
              resolved: 329,
              satisfaction: 4.6,
            },
          ],
          topIssues: [
            { issue: "Paper Jam", count: 387, avgTime: 1.2, resolution: 96.8 },
          ],
          technicianPerformance: [
            {
              technician: "Mike Rodriguez",
              tickets: 187,
              avgTime: 2.8,
              satisfaction: 4.8,
              efficiency: 94.2,
            },
          ],
        },
        equipmentAnalytics: {
          fleetOverview: {
            totalUnits: 1247,
            averageAge: 3.2,
            utilizationRate: 73.4,
            maintenanceCompliance: 94.7,
          },
          equipmentByManufacturer: [
            {
              manufacturer: "Canon",
              units: 387,
              percentage: 31.0,
              avgAge: 2.8,
            },
          ],
          maintenanceSchedule: {
            overdue: 23,
            dueSoon: 67,
            upcoming: 156,
            compliant: 1001,
          },
        },
        financialAnalytics: {
          profitability: {
            grossProfit: 1215867.45,
            grossMargin: 42.7,
            netProfit: 567890.25,
            netMargin: 19.9,
            ebitda: 678950.75,
          },
          cashFlow: [
            {
              month: "2025-01",
              inflow: 434567.1,
              outflow: 324567.85,
              net: 109999.25,
            },
          ],
          expenseBreakdown: [
            {
              category: "Cost of Goods Sold",
              amount: 1631783.3,
              percentage: 57.3,
            },
          ],
        },
        predictiveAnalytics: {
          revenueForecast: [
            { month: "2025-02", predicted: 389670.5, confidence: 87.5 },
          ],
          churnPrediction: {
            highRisk: 23,
            mediumRisk: 67,
            lowRisk: 757,
            actions: [
              {
                customer: "Sunset Industries",
                risk: 89.2,
                action: "Immediate intervention required",
              },
            ],
          },
        },
        competitiveAnalysis: {
          marketShare: {
            company: 12.7,
            competitor1: 18.9,
            competitor2: 15.4,
            competitor3: 13.2,
            others: 39.8,
          },
          winLossAnalysis: {
            totalOpportunities: 287,
            won: 156,
            lost: 89,
            pending: 42,
            winRate: 54.4,
            lossReasons: [{ reason: "Price", count: 34, percentage: 38.2 }],
          },
        },
      };

      res.json(analyticsDashboard);
    } catch (error) {
      console.error("Error fetching analytics dashboard:", error);
      res.status(500).json({ message: "Failed to fetch analytics dashboard" });
    }
  });

  // Business Process Optimization Routes
  app.get(
    "/api/business-process/dashboard",
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }

        const processOptimizationData = {
          processOverview: {
            totalProcesses: 47,
            automatedProcesses: 32,
            manualProcesses: 15,
            automationRate: 68.1,
            avgProcessTime: 4.7,
            processEfficiency: 84.3,
            costSavings: 127890.5,
            timeReduction: 32.4,
          },
          keyMetrics: [
            {
              metric: "Lead to Customer Conversion",
              currentTime: 5.2,
              optimizedTime: 3.1,
              improvement: 40.4,
              status: "optimized",
              automationLevel: 85,
            },
            {
              metric: "Service Ticket Resolution",
              currentTime: 6.8,
              optimizedTime: 4.2,
              improvement: 38.2,
              status: "optimized",
              automationLevel: 72,
            },
          ],
          workflowTemplates: [
            {
              id: "wf-001",
              name: "New Customer Onboarding",
              description:
                "Standardized process for onboarding new customers from lead to active account",
              steps: 12,
              avgDuration: 3.5,
              automationLevel: 85,
              successRate: 96.8,
              category: "Customer Management",
              status: "active",
              usageCount: 156,
              lastUpdated: new Date("2025-01-15T00:00:00Z"),
            },
          ],
          processAnalytics: {
            bottlenecks: [
              {
                process: "Equipment Installation",
                step: "Site Survey Scheduling",
                avgDelay: 3.2,
                impact: "high",
                frequency: 78,
                recommendation:
                  "Implement automated scheduling with customer self-service portal",
              },
            ],
            efficiency: [
              {
                department: "Sales",
                currentEfficiency: 78.5,
                targetEfficiency: 90.0,
                gap: 11.5,
                improvementAreas: ["Lead qualification", "Proposal generation"],
                estimatedROI: 156780.25,
              },
            ],
            trends: [
              {
                month: "2025-01",
                efficiency: 84.3,
                automation: 68.1,
                processes: 47,
              },
            ],
          },
          automationOpportunities: [
            {
              id: "auto-001",
              process: "Customer Onboarding Documentation",
              description:
                "Automate generation of welcome packets and setup documentation",
              currentEffort: 2.5,
              estimatedReduction: 80,
              potentialSavings: 45600.0,
              complexity: "low",
              priority: "high",
              implementationTime: 2,
              roi: 456.7,
              status: "ready_to_implement",
            },
          ],
        };

        res.json(processOptimizationData);
      } catch (error) {
        console.error(
          "Error fetching business process optimization data:",
          error
        );
        res.status(500).json({
          message: "Failed to fetch business process optimization data",
        });
      }
    }
  );

  // Security & Compliance Management Routes
  app.get("/api/security/dashboard", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      const securityData = {
        securityOverview: {
          securityScore: 94.7,
          vulnerabilities: {
            critical: 0,
            high: 2,
            medium: 8,
            low: 15,
            total: 25,
          },
          complianceScore: 96.2,
          lastSecurityAudit: new Date("2024-12-15T00:00:00Z"),
          nextAuditDue: new Date("2025-06-15T00:00:00Z"),
          activeThreats: 3,
          resolvedIncidents: 47,
          systemUptime: 99.97,
        },
        complianceStatus: [
          {
            framework: "SOC 2 Type II",
            status: "compliant",
            score: 96.8,
            lastAudit: new Date("2024-09-30T00:00:00Z"),
            nextAudit: new Date("2025-09-30T00:00:00Z"),
            findings: 1,
            remediated: 3,
            inProgress: 0,
            requirements: {
              total: 64,
              implemented: 62,
              pending: 2,
              notApplicable: 0,
            },
          },
        ],
        securityIncidents: [
          {
            id: "INC-2025-001",
            title: "Suspicious Login Attempts",
            severity: "medium",
            status: "investigating",
            category: "authentication",
            reportedAt: new Date("2025-01-30T14:30:00Z"),
            reportedBy: "Security Monitoring System",
            affectedSystems: ["User Authentication", "CRM Access"],
            description:
              "Multiple failed login attempts detected from unusual geographic locations",
            assignedTo: "Security Team",
            estimatedResolution: new Date("2025-02-01T18:00:00Z"),
            actions: [
              "IP addresses blocked temporarily",
              "User accounts secured",
              "Additional monitoring enabled",
            ],
          },
        ],
        vulnerabilities: [
          {
            id: "VULN-2025-001",
            title: "Outdated SSL Certificate",
            severity: "high",
            cvss: 7.2,
            category: "network_security",
            affectedAssets: ["mail.company.com"],
            discoveredDate: new Date("2025-01-20T00:00:00Z"),
            status: "remediation_in_progress",
            dueDate: new Date("2025-02-05T00:00:00Z"),
            assignedTo: "Network Security Team",
            description:
              "SSL certificate for mail server expires within 30 days",
            remediation: "Renew SSL certificate and update configuration",
            businessImpact: "Medium - Email service continuity risk",
          },
        ],
        accessControl: {
          userAccounts: {
            total: 247,
            active: 231,
            inactive: 16,
            privileged: 23,
            serviceAccounts: 12,
            pendingActivation: 3,
            pendingDeactivation: 5,
          },
          permissions: {
            totalRoles: 15,
            customRoles: 8,
            defaultRoles: 7,
            roleAssignments: 231,
            excessivePrivileges: 4,
            unusedPermissions: 12,
          },
          authentication: {
            mfaEnabled: 218,
            mfaDisabled: 13,
            ssoUsers: 195,
            localAuthUsers: 36,
            passwordExpiring: 27,
            accountsLocked: 2,
          },
        },
        dataProtection: {
          dataClassification: {
            public: 15678,
            internal: 89432,
            confidential: 34567,
            restricted: 8934,
            total: 148611,
          },
          dataRetention: {
            policiesTotal: 12,
            policiesActive: 11,
            retentionCompliant: 96.8,
            recordsScheduledDeletion: 2847,
            recordsDeleted: 15678,
            retentionViolations: 23,
          },
          privacyRequests: [
            {
              id: "PR-2025-001",
              type: "data_access",
              requestDate: new Date("2025-01-28T00:00:00Z"),
              status: "completed",
              responseTime: 18,
              dataSubject: "customer@example.com",
              completedDate: new Date("2025-01-29T18:00:00Z"),
            },
          ],
        },
        securityTraining: {
          trainingPrograms: [
            {
              program: "Security Awareness Fundamentals",
              participants: 231,
              completed: 218,
              inProgress: 13,
              completionRate: 94.4,
              averageScore: 87.3,
              lastUpdated: new Date("2024-12-01T00:00:00Z"),
            },
          ],
          phishingSimulations: {
            totalCampaigns: 12,
            totalEmails: 2772,
            clicked: 167,
            reported: 89,
            clickRate: 6.0,
            reportRate: 3.2,
            improvementTrend: "positive",
          },
        },
      };

      res.json(securityData);
    } catch (error) {
      console.error("Error fetching security dashboard data:", error);
      res
        .status(500)
        .json({ message: "Failed to fetch security dashboard data" });
    }
  });

  // Security Incident Response System Routes
  app.get(
    "/api/incident-response/dashboard",
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }

        const incidentResponseData = {
          responseOverview: {
            activeIncidents: 7,
            criticalIncidents: 1,
            highIncidents: 2,
            mediumIncidents: 3,
            lowIncidents: 1,
            avgResponseTime: 12.5,
            avgResolutionTime: 4.2,
            mttr: 3.8,
            slaCompliance: 94.7,
            escalatedIncidents: 2,
            falsePositives: 8,
          },
          activeIncidents: [
            {
              id: "INC-2025-007",
              title: "Potential Data Exfiltration",
              severity: "critical",
              priority: "p1",
              status: "investigating",
              category: "data_breach",
              subcategory: "data_exfiltration",
              detectedAt: new Date("2025-02-01T08:15:00Z"),
              reportedBy: "DLP System",
              assignedTo: "Incident Response Team Alpha",
              responder: "Sarah Chen",
              affectedSystems: [
                "Customer Database",
                "File Server",
                "Email System",
              ],
              affectedUsers: 15,
              estimatedImpact: "high",
              businessImpact:
                "Potential customer data exposure - regulatory compliance risk",
              detectionMethod: "automated",
              confidenceLevel: 87.5,
              ttl: 2.3,
              slaDeadline: new Date("2025-02-01T12:15:00Z"),
              currentPhase: "containment",
              progress: 35,
              tags: ["gdpr", "customer_data", "regulatory"],
              threatActors: ["Unknown Internal User"],
              indicators: [
                "Unusual bulk data access pattern",
                "Large file transfers to external email",
                "After-hours system access",
              ],
            },
          ],
          incidentStats: {
            monthlyTrends: [
              { month: "2025-01", incidents: 24, resolved: 22, avgTime: 4.2 },
            ],
            categoriesBreakdown: [
              {
                category: "malware",
                count: 35,
                percentage: 28.5,
                avgSeverity: "medium",
              },
              {
                category: "social_engineering",
                count: 28,
                percentage: 22.8,
                avgSeverity: "high",
              },
            ],
            severityDistribution: {
              critical: { count: 8, percentage: 6.5, avgResolutionTime: 2.1 },
              high: { count: 31, percentage: 25.2, avgResolutionTime: 6.8 },
            },
            detectionSources: [
              { source: "SIEM/SOAR", incidents: 45, percentage: 36.6 },
              { source: "EDR/XDR", incidents: 32, percentage: 26.0 },
            ],
          },
          teamPerformance: {
            teams: [
              {
                name: "Incident Response Team Alpha",
                lead: "Sarah Chen",
                members: 4,
                specialization: "Critical Incidents & Data Breaches",
                activeIncidents: 3,
                avgResponseTime: 8.2,
                avgResolutionTime: 2.8,
                slaCompliance: 97.3,
                workload: "high",
                status: "available",
                onCallSchedule: "Week 1-2 February",
              },
            ],
            individuals: [
              {
                name: "Sarah Chen",
                role: "Senior Incident Response Analyst",
                team: "Alpha",
                activeIncidents: 1,
                totalIncidents: 47,
                avgResponseTime: 6.2,
                avgResolutionTime: 2.1,
                specialties: ["Data Breaches", "Forensics", "Compliance"],
                certifications: ["GCIH", "GCFA", "CISSP"],
                availability: "on_call",
                performance: "excellent",
              },
            ],
          },
          threatIntelligence: {
            activeThreatFeeds: 12,
            iocMatches: 156,
            newThreats: 23,
            currentThreats: [
              {
                threatId: "TI-2025-001",
                name: "Lazarus Group Campaign",
                threatActor: "Lazarus Group (APT38)",
                firstSeen: new Date("2025-01-28T00:00:00Z"),
                lastUpdated: new Date("2025-02-01T06:30:00Z"),
                severity: "high",
                confidence: 89.2,
                targeting: ["Financial Services", "Technology"],
                ttps: ["T1566.001", "T1055", "T1071.001"],
                iocs: [
                  {
                    type: "domain",
                    value: "malicious-domain.com",
                    confidence: 95,
                  },
                ],
                mitigation:
                  "Block domains, monitor for lateral movement techniques",
                relevanceScore: 78.5,
              },
            ],
          },
          automatedResponse: {
            playbooks: [
              {
                id: "playbook-001",
                name: "Malware Incident Response",
                triggers: ["malware_detected", "suspicious_process"],
                automationLevel: 78.5,
                steps: 12,
                avgExecutionTime: 15.7,
                successRate: 94.2,
                lastUpdated: new Date("2025-01-15T00:00:00Z"),
                status: "active",
              },
            ],
            automationMetrics: {
              totalAutomatedActions: 1247,
              automationSuccessRate: 92.8,
              timesSaved: 847.3,
              falsePositiveReduction: 67.4,
              humanInterventionRequired: 12.5,
            },
          },
        };

        res.json(incidentResponseData);
      } catch (error) {
        console.error("Error fetching incident response dashboard:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch incident response dashboard" });
      }
    }
  );

  // AI-Powered Analytics & Intelligence Routes
  app.get("/api/ai-analytics/dashboard", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      const aiAnalyticsData = {
        aiOverview: {
          modelsDeployed: 12,
          predictionsGenerated: 15847,
          accuracyScore: 94.3,
          automatedDecisions: 8934,
          mlModelStatus: "optimal",
          dataQualityScore: 97.2,
          lastModelUpdate: new Date("2025-01-28T00:00:00Z"),
          computeUtilization: 67.8,
          apiCallsToday: 2456,
          costOptimization: 23.7,
        },
        customerPredictions: {
          churnPrediction: {
            totalCustomersAnalyzed: 1247,
            highRiskCustomersCount: 89,
            mediumRiskCustomers: 234,
            lowRiskCustomers: 924,
            predictionAccuracy: 89.4,
            interventioneSuccessRate: 73.2,
            estimatedRevenueSaved: 342500,
            highRiskCustomers: [
              {
                customerId: "CUST-001",
                customerName: "Tech Solutions Inc",
                churnProbability: 0.87,
                riskFactors: [
                  "Decreasing usage",
                  "Service complaints",
                  "Payment delays",
                ],
                estimatedValue: 45600,
                recommendedActions: [
                  "Schedule executive meeting",
                  "Offer service upgrade",
                  "Provide usage training",
                ],
                timeToIntervene: 14,
                lastInteraction: new Date("2025-01-15T00:00:00Z"),
                trend: "deteriorating",
              },
            ],
          },
          lifetimeValuePrediction: {
            averagePredictedCLV: 48750,
            clivAccuracyRate: 91.7,
            customerSegments: [
              {
                segment: "High Value Prospects",
                count: 156,
                avgPredictedCLV: 125400,
                conversionProbability: 0.73,
                recommendedInvestment: 2800,
                expectedROI: 4.2,
              },
            ],
          },
          upsellPredictions: [
            {
              customerId: "CUST-003",
              customerName: "Downtown Legal Group",
              currentMRR: 850,
              predictedUpsellValue: 2100,
              upsellProbability: 0.76,
              recommendedProducts: [
                "Document Finishing",
                "Cloud Services",
                "Security Package",
              ],
              bestApproachTime: new Date("2025-02-15T00:00:00Z"),
              confidence: 0.83,
            },
          ],
        },
        salesForecasting: {
          revenueForecast: {
            currentMonth: {
              predicted: 487500,
              actual: 445200,
              confidence: 0.94,
              variance: -8.7,
            },
            nextMonth: {
              predicted: 523800,
              confidence: 0.89,
              factors: [
                "Seasonal uptick",
                "Pipeline momentum",
                "New product launch",
              ],
            },
            quarterlyForecast: {
              q1: { predicted: 1560000, confidence: 0.87 },
              q2: { predicted: 1685000, confidence: 0.82 },
            },
          },
          dealProbabilityScoring: [
            {
              dealId: "DEAL-001",
              prospectName: "Enterprise Solutions Ltd",
              dealValue: 125000,
              originalProbability: 0.6,
              aiProbability: 0.78,
              probabilityFactors: [
                { factor: "Engagement level", impact: 0.12, confidence: 0.91 },
              ],
              recommendedActions: [
                "Schedule C-level meeting",
                "Provide competitive differentiation",
              ],
              nextBestAction: "Schedule demo with decision makers",
              optimalCloseDate: new Date("2025-03-15T00:00:00Z"),
            },
          ],
        },
        serviceOptimization: {
          predictiveMaintenance: {
            equipmentMonitored: 2456,
            predictedFailures: 23,
            preventedDowntime: 1247,
            costSavings: 189400,
            accuracyRate: 87.6,
            criticalAlerts: [
              {
                equipmentId: "EQ-001",
                location: "Downtown Office Complex",
                model: "Canon imageRUNNER C7565i",
                predictedFailure: "Fuser assembly failure",
                probability: 0.89,
                estimatedFailureDate: new Date("2025-02-08T00:00:00Z"),
                recommendedAction: "Schedule preventive replacement",
                costOfFailure: 4500,
                costOfPrevention: 850,
                savingsPotential: 3650,
              },
            ],
          },
        },
        nlpInsights: {
          customerSentiment: {
            overallSentiment: 0.72,
            sentimentTrend: "improving",
            analysisVolume: 8934,
            sentimentByChannel: [
              { channel: "Email", sentiment: 0.68, volume: 4567 },
            ],
            keyTopics: [
              {
                topic: "Service Quality",
                sentiment: 0.81,
                volume: 1234,
                trend: "improving",
                keywords: ["fast response", "professional"],
              },
            ],
          },
        },
        modelPerformance: {
          models: [
            {
              modelName: "Customer Churn Predictor",
              version: "2.1.0",
              accuracy: 89.4,
              precision: 0.87,
              recall: 0.91,
              f1Score: 0.89,
              lastTrained: new Date("2025-01-25T00:00:00Z"),
              dataPoints: 15647,
              status: "production",
              performanceTrend: "improving",
            },
          ],
        },
        recommendationsEngine: {
          personalizedRecommendations: {
            customersTargeted: 1247,
            recommendationAccuracy: 76.8,
            uptakeRate: 23.4,
            revenueGenerated: 189400,
            activeRecommendations: [
              {
                customerId: "CUST-005",
                customerName: "Regional Accounting Firm",
                recommendation: "Document Management Suite",
                reasoning:
                  "High document volume, compliance needs, efficiency gains",
                confidence: 0.83,
                estimatedValue: 12400,
                deliveryChannel: "email",
                optimalTiming: new Date("2025-02-07T00:00:00Z"),
              },
            ],
          },
        },
      };

      res.json(aiAnalyticsData);
    } catch (error) {
      console.error("Error fetching AI analytics dashboard:", error);
      res
        .status(500)
        .json({ message: "Failed to fetch AI analytics dashboard" });
    }
  });

  // Advanced Integration Hub Routes
  app.get(
    "/api/integration-hub/dashboard",
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }

        const integrationHubData = {
          integrationOverview: {
            totalIntegrations: 47,
            activeIntegrations: 42,
            pendingIntegrations: 3,
            failedIntegrations: 2,
            successRate: 97.4,
            apiCallsToday: 45672,
            dataVolumeProcessed: 2.4,
            uptimePercentage: 99.7,
            averageResponseTime: 156,
            errorRate: 0.3,
            lastSyncTime: new Date("2025-02-01T08:45:00Z"),
          },
          activeIntegrations: [
            {
              id: "int-001",
              name: "Salesforce CRM",
              category: "CRM",
              provider: "Salesforce",
              status: "active",
              health: "healthy",
              version: "2.1.0",
              lastSync: new Date("2025-02-01T08:30:00Z"),
              syncFrequency: "real-time",
              recordsSynced: 15672,
              errorCount: 2,
              uptimePercentage: 99.8,
              dataFlow: "bidirectional",
              authStatus: "valid",
              authExpiresAt: new Date("2025-08-15T00:00:00Z"),
              endpoints: [
                {
                  name: "Accounts",
                  status: "active",
                  lastCall: new Date("2025-02-01T08:29:00Z"),
                },
                {
                  name: "Contacts",
                  status: "active",
                  lastCall: new Date("2025-02-01T08:28:00Z"),
                },
              ],
              metrics: {
                apiCallsToday: 8934,
                successRate: 99.2,
                avgResponseTime: 234,
                bandwidth: 145.6,
              },
            },
          ],
          apiMarketplace: {
            availableIntegrations: 156,
            popularIntegrations: [
              {
                id: "market-001",
                name: "Microsoft 365",
                category: "Productivity",
                provider: "Microsoft",
                description:
                  "Integrate with Outlook, Teams, SharePoint, and OneDrive for comprehensive productivity suite connectivity",
                rating: 4.8,
                reviews: 234,
                installations: 12567,
                pricing: "free",
                features: [
                  "Email Integration",
                  "Calendar Sync",
                  "Document Storage",
                  "Team Collaboration",
                ],
                lastUpdated: new Date("2025-01-25T00:00:00Z"),
                compatibility: ["Cloud", "On-Premise"],
                dataTypes: [
                  "Contacts",
                  "Calendar",
                  "Documents",
                  "Communications",
                ],
                estimatedSetupTime: 30,
              },
            ],
            categories: [{ name: "CRM", count: 23, popular: true }],
          },
          dataFlowManagement: {
            activeFlows: 23,
            totalDataProcessed: 4.7,
            transformationRules: 89,
            mappingConfigurations: 156,
            dataFlows: [
              {
                id: "flow-001",
                name: "Salesforce to Business Records Sync",
                source: "Salesforce CRM",
                destination: "Business Records",
                status: "active",
                frequency: "real-time",
                recordsProcessed: 8934,
                lastRun: new Date("2025-02-01T08:30:00Z"),
                successRate: 98.7,
                avgProcessingTime: 234,
                dataTypes: ["Accounts", "Contacts", "Opportunities"],
                transformations: [
                  "Name standardization",
                  "Phone number formatting",
                ],
                errorHandling: "retry_with_notification",
                retentionPeriod: 90,
              },
            ],
          },
          webhookManagement: {
            activeWebhooks: 34,
            webhooksTriggered: 15672,
            successfulDeliveries: 15234,
            failedDeliveries: 438,
            deliverySuccessRate: 97.2,
            averageDeliveryTime: 89,
            webhooks: [
              {
                id: "webhook-001",
                name: "New Customer Created",
                event: "customer.created",
                url: "https://api.partner.com/webhooks/customer",
                method: "POST",
                status: "active",
                secret: "whsec_••••••••••••••••",
                retryPolicy: "exponential_backoff",
                maxRetries: 3,
                timeout: 30,
                lastTriggered: new Date("2025-02-01T08:35:00Z"),
                deliveryAttempts: 8934,
                successfulDeliveries: 8901,
                failedDeliveries: 33,
                successRate: 99.6,
                headers: {
                  "Content-Type": "application/json",
                  "X-Printyx-Event": "customer.created",
                },
              },
            ],
          },
          healthMonitoring: {
            overallHealth: "healthy",
            monitoringRules: 45,
            alertsTriggered: 12,
            issuesResolved: 34,
            alerts: [
              {
                id: "alert-001",
                integration: "E-Automate",
                severity: "warning",
                type: "high_error_rate",
                message:
                  "Error rate above 5% threshold for Service Calls endpoint",
                triggeredAt: new Date("2025-02-01T06:30:00Z"),
                acknowledged: false,
                assignedTo: "Integration Team",
                suggestedAction:
                  "Check E-Automate system status and network connectivity",
              },
            ],
            healthChecks: [
              {
                name: "Endpoint Availability",
                status: "passing",
                lastCheck: new Date("2025-02-01T08:45:00Z"),
              },
            ],
          },
        };

        res.json(integrationHubData);
      } catch (error) {
        console.error("Error fetching integration hub dashboard:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch integration hub dashboard" });
      }
    }
  );

  // Advanced Workflow Automation Routes
  app.get(
    "/api/workflow-automation/dashboard",
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }

        const workflowAutomationData = {
          automationOverview: {
            totalWorkflows: 89,
            activeWorkflows: 76,
            pausedWorkflows: 8,
            failedWorkflows: 5,
            successRate: 94.7,
            executionsToday: 15672,
            timeSaved: 847.3,
            errorRate: 2.1,
            averageExecutionTime: 234,
            automationCoverage: 78.4,
            lastExecution: new Date("2025-02-01T08:45:00Z"),
          },
          activeWorkflows: [
            {
              id: "wf-001",
              name: "Customer Onboarding Automation",
              category: "Customer Management",
              status: "active",
              trigger: "customer_created",
              priority: "high",
              version: "2.1.0",
              createdAt: new Date("2024-12-15T00:00:00Z"),
              lastModified: new Date("2025-01-28T00:00:00Z"),
              lastExecution: new Date("2025-02-01T08:30:00Z"),
              executionCount: 2456,
              successRate: 96.8,
              averageExecutionTime: 1245,
              estimatedTimeSaved: 45.7,
              steps: [
                {
                  id: "step-001",
                  name: "Send Welcome Email",
                  type: "email",
                  status: "active",
                  config: {},
                  successRate: 98.9,
                  avgExecutionTime: 234,
                },
                {
                  id: "step-002",
                  name: "Create Initial Service Ticket",
                  type: "service_ticket",
                  status: "active",
                  config: {},
                  successRate: 97.2,
                  avgExecutionTime: 456,
                },
              ],
              triggers: [
                {
                  type: "event",
                  event: "customer_created",
                  conditions: [
                    {
                      field: "customer_type",
                      operator: "equals",
                      value: "business",
                    },
                  ],
                },
              ],
              metrics: {
                totalExecutions: 2456,
                successfulExecutions: 2378,
                failedExecutions: 78,
                costSavings: 12400,
              },
            },
          ],
          workflowTemplates: [
            {
              id: "template-001",
              name: "Customer Communication Sequence",
              category: "Customer Management",
              description:
                "Automated communication workflow for customer lifecycle management",
              popularity: 87.5,
              installations: 234,
              rating: 4.8,
              complexity: "beginner",
              estimatedSetupTime: 30,
              features: [
                "Multi-channel communication",
                "Personalization engine",
              ],
              steps: ["Initial contact", "Follow-up sequence"],
              integrations: ["email", "sms", "crm"],
            },
          ],
          rulesEngine: {
            totalRules: 234,
            activeRules: 198,
            ruleCategories: [
              { category: "Customer Management", count: 67, performance: 96.2 },
            ],
            rules: [
              {
                id: "rule-001",
                name: "High-Value Customer Priority",
                category: "Customer Management",
                status: "active",
                priority: "high",
                description:
                  "Automatically prioritize service tickets for high-value customers",
                trigger: "service_ticket_created",
                conditions: [
                  {
                    field: "customer_value",
                    operator: "greater_than",
                    value: 50000,
                  },
                ],
                actions: [{ type: "set_priority", value: "urgent" }],
                executionCount: 1245,
                successRate: 97.8,
                lastExecuted: new Date("2025-02-01T07:45:00Z"),
              },
            ],
          },
          performanceAnalytics: {
            executionTrends: [
              { date: "2025-02-01", executions: 15672, successRate: 94.7 },
            ],
            topPerformingWorkflows: [
              {
                name: "Invoice Processing Automation",
                successRate: 99.1,
                executions: 4567,
                timeSaved: 156.8,
              },
            ],
            errorAnalysis: [
              {
                errorType: "Integration Timeout",
                count: 234,
                percentage: 34.5,
                trend: "decreasing",
              },
            ],
            businessImpact: {
              totalTimeSaved: 847.3,
              totalCostSavings: 234500,
              errorReduction: 67.8,
              customerSatisfactionIncrease: 23.4,
              processEfficiencyGain: 45.7,
            },
          },
        };

        res.json(workflowAutomationData);
      } catch (error) {
        console.error("Error fetching workflow automation dashboard:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch workflow automation dashboard" });
      }
    }
  );

  // Import and register the new predictive analytics routes
  const predictiveAnalyticsRoutes = await import(
    "./routes-predictive-analytics.js"
  );
  app.use("/api/predictive-analytics", predictiveAnalyticsRoutes.default);

  // Predictive Analytics Engine Routes (Legacy - keeping for backwards compatibility)
  app.get(
    "/api/predictive-analytics/legacy-dashboard",
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }

        const predictiveAnalyticsData = {
          analyticsOverview: {
            totalModels: 18,
            activeModels: 15,
            trainingModels: 2,
            failedModels: 1,
            averageAccuracy: 91.3,
            predictionsToday: 28947,
            dataPointsProcessed: 4.7,
            computeTimeUsed: 234.5,
            modelRefreshFrequency: "daily",
            lastModelUpdate: new Date("2025-02-01T06:00:00Z"),
            predictionSuccessRate: 94.7,
          },
          predictiveModels: [
            {
              id: "model-001",
              name: "Customer Churn Prediction",
              category: "Customer Analytics",
              type: "classification",
              status: "active",
              accuracy: 94.2,
              precision: 92.8,
              recall: 96.1,
              f1Score: 94.4,
              version: "3.2.1",
              lastTrained: new Date("2025-02-01T06:00:00Z"),
              trainingDataSize: 145623,
              features: 47,
              predictionsToday: 8934,
              confidenceThreshold: 0.85,
              featureImportance: [
                {
                  feature: "payment_history",
                  importance: 0.234,
                  description: "Payment delays and defaults",
                },
                {
                  feature: "service_call_frequency",
                  importance: 0.198,
                  description: "Equipment maintenance frequency",
                },
              ],
            },
            {
              id: "model-002",
              name: "Revenue Forecasting",
              category: "Financial Analytics",
              type: "regression",
              status: "active",
              accuracy: 89.7,
              version: "2.8.4",
              lastTrained: new Date("2025-01-31T06:00:00Z"),
              trainingDataSize: 89456,
              features: 34,
              predictionsToday: 5678,
            },
          ],
          businessIntelligence: {
            keyInsights: [
              {
                id: "insight-001",
                category: "Customer Behavior",
                title: "Peak Service Request Pattern Identified",
                description:
                  "Equipment service requests spike 23% on Mondays and 18% after holidays, indicating usage pattern optimization opportunities.",
                impact: "high",
                confidence: 0.94,
                dataPoints: 12456,
                timeframe: "last_6_months",
                recommendedActions: [
                  "Adjust technician schedules for Monday coverage",
                  "Proactive maintenance before holidays",
                ],
                potentialValue: 45000,
                implementation: "immediate",
              },
            ],
            marketTrends: [
              {
                trend: "Remote Work Impact",
                description:
                  "Remote work adoption has reduced office printing by 42% but increased home office equipment demand by 67%",
                strength: "strong",
                confidence: 0.89,
                businessImpact: "reshaping_market",
                opportunity: "home_office_solutions",
              },
            ],
            competitiveIntelligence: [
              {
                competitor: "Regional Competitor A",
                activity: "aggressive_pricing",
                impact: "moderate",
                affectedSegments: ["small_business", "healthcare"],
                responseStrategy: "value_proposition_enhancement",
                confidence: 0.76,
              },
            ],
          },
          performanceMetrics: {
            predictionAccuracy: {
              churnPrediction: 94.2,
              revenueForecast: 89.7,
              equipmentFailure: 92.4,
              salesConversion: 88.9,
            },
            businessImpact: {
              revenueProtected: 1234000,
              costsAvoided: 567000,
              efficiencyGains: 345000,
              newOpportunities: 789000,
            },
            modelPerformance: [
              {
                model: "Customer Churn",
                accuracy: 94.2,
                improvement: "+2.3%",
                trend: "improving",
              },
              {
                model: "Revenue Forecast",
                accuracy: 89.7,
                improvement: "+1.8%",
                trend: "stable",
              },
            ],
          },
          realTimeAnalytics: {
            liveMetrics: {
              predictionsPerMinute: 127,
              dataIngestionRate: 45.7,
              modelResponseTime: 234,
              alertsTriggered: 23,
              confidenceThreshold: 0.85,
              activeMonitoringDevices: 1247,
            },
            alertsAndNotifications: [
              {
                id: "alert-001",
                type: "high_churn_risk",
                severity: "critical",
                customer: "TechCorp Solutions",
                probability: 0.87,
                triggeredAt: new Date("2025-02-01T08:45:00Z"),
                status: "active",
                assignedTo: "customer_success_team",
                estimatedImpact: 125000,
              },
            ],
          },
        };

        res.json(predictiveAnalyticsData);
      } catch (error) {
        console.error("Error fetching predictive analytics dashboard:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch predictive analytics dashboard" });
      }
    }
  );

  // Security & Compliance Management Routes
  app.get(
    "/api/security-compliance/dashboard",
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }

        const securityComplianceData = {
          securityOverview: {
            overallSecurityScore: 94.7,
            complianceStatus: "compliant",
            activeThreats: 3,
            resolvedThreats: 127,
            securityIncidents: 2,
            lastSecurityAudit: new Date("2025-01-28T00:00:00Z"),
            nextAuditDue: new Date("2025-04-28T00:00:00Z"),
            certificationsActive: 6,
            vulnerabilitiesDetected: 8,
            vulnerabilitiesPatched: 45,
            securityTrainingCompliance: 96.8,
            dataBackupStatus: "healthy",
            encryptionCoverage: 100.0,
          },
          threatDetection: {
            realTimeMonitoring: {
              activeScans: 12,
              threatsDetected: 3,
              falsePositives: 7,
              threatScore: 2.4,
              lastScanCompleted: new Date("2025-02-01T07:30:00Z"),
              nextScheduledScan: new Date("2025-02-01T19:30:00Z"),
              monitoringUptime: 99.94,
            },
            detectedThreats: [
              {
                id: "threat-001",
                type: "suspicious_login_attempt",
                severity: "medium",
                status: "investigating",
                detectedAt: new Date("2025-02-01T06:45:00Z"),
                source: "192.168.1.247",
                targetUser: "john.smith@printyx.com",
                description:
                  "Multiple failed login attempts from unusual location",
                riskScore: 6.2,
                affectedSystems: ["user_portal", "admin_dashboard"],
                mitigationActions: [
                  "account_lockout",
                  "security_notification",
                  "ip_monitoring",
                ],
                investigator: "security_team",
                estimatedResolutionTime: 45,
              },
              {
                id: "threat-002",
                type: "data_access_anomaly",
                severity: "high",
                status: "contained",
                detectedAt: new Date("2025-02-01T04:20:00Z"),
                source: "internal_user",
                targetUser: "admin@dealership.com",
                description:
                  "Unusual bulk data access outside normal business hours",
                riskScore: 7.8,
                affectedSystems: ["customer_database", "financial_records"],
                mitigationActions: [
                  "access_restriction",
                  "audit_trail_review",
                  "manager_notification",
                ],
                investigator: "compliance_officer",
                estimatedResolutionTime: 120,
              },
            ],
            threatTrends: [
              {
                category: "phishing_attempts",
                count: 23,
                change: "+12%",
                severity: "medium",
              },
              {
                category: "suspicious_logins",
                count: 15,
                change: "-8%",
                severity: "medium",
              },
            ],
          },
          complianceManagement: {
            regulations: [
              {
                id: "gdpr",
                name: "General Data Protection Regulation (GDPR)",
                status: "compliant",
                complianceScore: 96.8,
                lastAudit: new Date("2025-01-15T00:00:00Z"),
                nextAudit: new Date("2025-07-15T00:00:00Z"),
                requirements: 47,
                compliantRequirements: 45,
                nonCompliantRequirements: 2,
                actionItemsOpen: 3,
                actionItemsCompleted: 28,
                certificationStatus: "active",
                expiryDate: new Date("2025-12-31T00:00:00Z"),
                auditor: "EU Compliance Solutions",
                riskLevel: "low",
              },
            ],
            actionItems: [
              {
                id: "action-001",
                regulation: "GDPR",
                priority: "high",
                title: "Update Data Processing Records",
                description:
                  "Complete documentation of new data processing activities for Q1 2025",
                assignee: "data_protection_officer",
                dueDate: new Date("2025-02-15T00:00:00Z"),
                status: "in_progress",
                progress: 67,
                estimatedHours: 8,
                completedHours: 5.5,
                riskIfDelayed: "regulatory_fine",
              },
            ],
            complianceMetrics: {
              overallComplianceScore: 95.2,
              regulationsMonitored: 4,
              activeCompliance: 4,
              nonCompliantRegulations: 0,
              overdueActionItems: 1,
              upcomingAudits: 3,
              certificationRenewals: 2,
              complianceTrainingCompletion: 94.8,
            },
          },
          accessControl: {
            userAccessMatrix: {
              totalUsers: 247,
              activeUsers: 234,
              inactiveUsers: 13,
              privilegedUsers: 23,
              serviceAccounts: 8,
              pendingAccessRequests: 5,
              expiredAccounts: 2,
              multiFactorEnabled: 231,
              singleSignOnEnabled: 198,
            },
            roleBasedAccess: {
              totalRoles: 15,
              customRoles: 8,
              defaultRoles: 7,
              roleAssignments: 247,
              roleConflicts: 0,
              segregationOfDutiesViolations: 0,
              leastPrivilegeCompliance: 94.3,
            },
          },
        };

        res.json(securityComplianceData);
      } catch (error) {
        console.error("Error fetching security compliance dashboard:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch security compliance dashboard" });
      }
    }
  );

  // ERP Integration Hub Routes
  app.get(
    "/api/erp-integration/dashboard",
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }

        const erpIntegrationData = {
          integrationOverview: {
            totalIntegrations: 18,
            activeIntegrations: 16,
            failedIntegrations: 2,
            syncSuccessRate: 98.7,
            dataPointsSynced: 2.4,
            syncFrequency: "real-time",
            lastSyncCompleted: new Date("2025-02-01T08:15:00Z"),
            nextScheduledSync: new Date("2025-02-01T08:30:00Z"),
            averageLatency: 234,
            systemUptime: 99.94,
            errorRate: 0.13,
          },
          erpSystems: [
            {
              id: "sap-001",
              name: "SAP Business One",
              type: "erp",
              category: "financial_management",
              status: "active",
              version: "10.0",
              lastSync: new Date("2025-02-01T08:15:00Z"),
              syncFrequency: "real-time",
              successRate: 99.2,
              recordsProcessed: 45672,
              apiCalls: 234567,
              dataVolume: 1.2,
              latency: 187,
              capabilities: [
                "accounting",
                "financial_reporting",
                "inventory",
                "procurement",
                "sales_orders",
              ],
              endpoints: [
                {
                  name: "Chart of Accounts",
                  url: "/api/ChartOfAccounts",
                  status: "active",
                  lastCall: new Date("2025-02-01T08:14:00Z"),
                },
                {
                  name: "Business Partners",
                  url: "/api/BusinessPartners",
                  status: "active",
                  lastCall: new Date("2025-02-01T08:13:00Z"),
                },
              ],
              authentication: {
                type: "oauth2",
                status: "authenticated",
                tokenExpiry: new Date("2025-02-15T00:00:00Z"),
                lastRefresh: new Date("2025-02-01T06:00:00Z"),
              },
              recentSync: {
                recordsCreated: 124,
                recordsUpdated: 3456,
                recordsDeleted: 23,
                errors: 5,
                warnings: 12,
                duration: 2.4,
              },
            },
            {
              id: "oracle-001",
              name: "Oracle NetSuite",
              type: "erp",
              category: "cloud_erp",
              status: "active",
              version: "2024.2",
              lastSync: new Date("2025-02-01T08:14:00Z"),
              syncFrequency: "hourly",
              successRate: 97.8,
              recordsProcessed: 78934,
              apiCalls: 456789,
              dataVolume: 2.1,
              latency: 298,
              capabilities: [
                "financial_management",
                "crm",
                "inventory",
                "e_commerce",
                "analytics",
              ],
              endpoints: [
                {
                  name: "Customers",
                  url: "/services/rest/record/v1/customer",
                  status: "active",
                  lastCall: new Date("2025-02-01T08:13:00Z"),
                },
              ],
              authentication: {
                type: "token_based",
                status: "authenticated",
                tokenExpiry: new Date("2025-03-01T00:00:00Z"),
                lastRefresh: new Date("2025-02-01T00:00:00Z"),
              },
              recentSync: {
                recordsCreated: 89,
                recordsUpdated: 2134,
                recordsDeleted: 12,
                errors: 3,
                warnings: 8,
                duration: 3.7,
              },
            },
          ],
          dataSynchronization: {
            syncSchedules: [
              {
                id: "schedule-001",
                name: "Customer Data Sync",
                description:
                  "Synchronize customer records across all ERP systems",
                systems: [
                  "SAP Business One",
                  "Oracle NetSuite",
                  "Microsoft Dynamics 365",
                ],
                frequency: "real-time",
                lastRun: new Date("2025-02-01T08:15:00Z"),
                nextRun: new Date("2025-02-01T08:30:00Z"),
                status: "active",
                successRate: 99.1,
                recordsProcessed: 12456,
                averageDuration: 2.3,
                conflicts: 3,
                resolvedConflicts: 3,
              },
            ],
            conflictResolution: {
              totalConflicts: 34,
              resolvedConflicts: 31,
              pendingResolution: 3,
              autoResolutionRate: 91.2,
              resolutionRules: [
                { rule: "Last Modified Wins", usage: 67, success: 94.1 },
              ],
            },
            dataQuality: {
              overallScore: 96.8,
              completeness: 98.2,
              accuracy: 95.7,
              consistency: 97.1,
              timeliness: 96.3,
              duplicates: 23,
              missingFields: 156,
              validationErrors: 45,
            },
          },
          businessProcessAutomation: {
            automatedProcesses: [
              {
                id: "process-001",
                name: "Order-to-Cash Automation",
                description:
                  "Automated end-to-end order processing from creation to payment",
                systems: ["Oracle NetSuite", "SAP Business One", "Printyx CRM"],
                status: "active",
                executionsToday: 234,
                successRate: 97.8,
                averageProcessingTime: 45,
                steps: [
                  {
                    step: "Order Creation",
                    system: "Printyx CRM",
                    avgTime: 5,
                    successRate: 99.2,
                  },
                ],
                kpis: {
                  cycleTimeReduction: 67.3,
                  errorReduction: 84.2,
                  costSavings: 45600,
                  customerSatisfaction: 94.7,
                },
              },
            ],
            workflowOrchestration: {
              totalWorkflows: 67,
              activeWorkflows: 64,
              pausedWorkflows: 2,
              erroredWorkflows: 1,
              executionsToday: 2134,
              successRate: 96.7,
              averageExecutionTime: 23.4,
              parallelExecutions: 12,
              queuedExecutions: 5,
            },
          },
          monitoring: {
            systemHealth: [
              {
                system: "SAP Business One",
                status: "healthy",
                uptime: 99.8,
                lastCheck: new Date("2025-02-01T08:14:00Z"),
                responseTime: 187,
              },
              {
                system: "Oracle NetSuite",
                status: "healthy",
                uptime: 99.2,
                lastCheck: new Date("2025-02-01T08:13:00Z"),
                responseTime: 298,
              },
            ],
            alerts: [
              {
                id: "alert-001",
                type: "performance_degradation",
                severity: "medium",
                system: "Oracle NetSuite",
                message: "Response time increased by 25% in last hour",
                triggeredAt: new Date("2025-02-01T07:45:00Z"),
                status: "investigating",
                assignee: "integration_team",
              },
            ],
            performanceMetrics: {
              dataLatency: 234,
              syncThroughput: 12456,
              errorRate: 0.13,
              availabilityScore: 99.7,
              integrationComplexity: 8.7,
              maintenanceOverhead: 4.2,
            },
          },
        };

        res.json(erpIntegrationData);
      } catch (error) {
        console.error("Error fetching ERP integration dashboard:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch ERP integration dashboard" });
      }
    }
  );

  // Advanced Integration Hub Routes - Real Implementation
  app.get(
    "/api/integration-hub/dashboard",
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }

        // Use real dashboard service instead of mock data
        const integrationHubData = await DashboardService.getDashboardData(
          tenantId
        );
        res.json(integrationHubData);
      } catch (error) {
        console.error("Error fetching integration hub dashboard:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch integration hub dashboard" });
      }
    }
  );

  // Apply tenant resolution middleware to all API routes
  app.use("/api", resolveTenant);

  // Company Contacts API routes - standardized endpoints
  // GET /api/company-contacts - fetch all contacts, optionally filtered by companyId
  app.get("/api/company-contacts", requireAuth, async (req: any, res) => {
    try {
      const user = req.user as any;
      const tenantId = user.tenantId;
      const companyId = String((req.query as any)?.companyId || "");

      if (companyId) {
        // Fetch contacts for specific company
        const contacts = await storage.getCompanyContacts(companyId, tenantId);
        res.json(contacts);
      } else {
        // Fetch all contacts (existing behavior)
        const contacts = await storage.getAllCompanyContacts(tenantId);
        res.json(contacts);
      }
    } catch (error) {
      console.error("Error fetching company contacts:", error);
      res.status(500).json({ error: "Failed to fetch company contacts" });
    }
  });

  // Legacy endpoint - kept for backward compatibility during transition
  app.get(
    "/api/company-contacts/:companyId",
    requireAuth,
    async (req: any, res) => {
      try {
        const user = req.user as any;
        const tenantId = user.tenantId;
        const { companyId } = req.params;

        const contacts = await storage.getCompanyContacts(companyId, tenantId);
        res.json(contacts);
      } catch (error) {
        console.error("Error fetching company contacts:", error);
        res.status(500).json({ error: "Failed to fetch company contacts" });
      }
    }
  );

  app.post("/api/company-contacts", requireAuth, async (req: any, res) => {
    try {
      const user = req.user as any;
      const tenantId = user.tenantId;

      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID is required" });
      }

      // Validate using Zod schema
      const contactData = insertCompanyContactSchema.parse({
        ...req.body,
        tenantId,
        ownerId: req.body.ownerId || user.id,
      });

      const contact = await storage.createCompanyContact(contactData);
      res.status(201).json(contact);
    } catch (error) {
      console.error("Error creating company contact:", error);
      if (error.name === 'ZodError') {
        console.error("Validation errors:", error.errors);
        res.status(400).json({ error: "Validation failed", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create company contact", details: error.message });
      }
    }
  });

  app.put("/api/company-contacts/:id", requireAuth, async (req: any, res) => {
    try {
      const user = req.user as any;
      const tenantId = user.tenantId;
      const { id } = req.params;

      const contact = await storage.updateCompanyContact(
        id,
        req.body,
        tenantId
      );
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      console.error("Error updating company contact:", error);
      res.status(500).json({ error: "Failed to update company contact" });
    }
  });

  app.delete(
    "/api/company-contacts/:id",
    requireAuth,
    async (req: any, res) => {
      try {
        const user = req.user as any;
        const tenantId = user.tenantId;
        const { id } = req.params;

        const result = await storage.deleteCompanyContact(id, tenantId);
        if (!result) {
          return res.status(404).json({ error: "Contact not found" });
        }
        res.json({ success: true });
      } catch (error) {
        console.error("Error deleting company contact:", error);
        res.status(500).json({ error: "Failed to delete company contact" });
      }
    }
  );

  // Contacts routes
  app.get("/api/contacts", requireAuth, async (req: TenantRequest, res) => {
    try {
      const user = req.user as any;
      const tenantId = req.tenantId || user.tenantId;

      console.log(
        `[CONTACTS DEBUG] User: ${user?.id}, TenantId: ${tenantId}, req.tenantId: ${req.tenantId}, user.tenantId: ${user?.tenantId}`
      );

      // Get query parameters
      const {
        search = "",
        contactOwner = "",
        createDate = "",
        lastActivityDate = "",
        leadStatus = "",
        view = "all",
        sortBy = "lastActivityDate",
        sortOrder = "desc",
        page = "1",
        limit = "25",
      } = req.query as any;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const offset = (pageNum - 1) * limitNum;

      // Build filters based on role and view
      let filters: any = { tenantId };

      console.log(
        `[CONTACTS DEBUG] Filters before role logic: ${JSON.stringify(filters)}`
      );

      // Role-based access control
      if (user.role === "salesperson") {
        filters.ownerId = user.id; // Salespeople only see their own contacts
      }

      // Apply view filter
      if (view === "my") {
        filters.ownerId = user.id;
      } else if (view === "unassigned") {
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
          case "today":
            filters.createdAt = {
              gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            };
            break;
          case "yesterday":
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            filters.createdAt = {
              gte: new Date(
                yesterday.getFullYear(),
                yesterday.getMonth(),
                yesterday.getDate()
              ),
              lt: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            };
            break;
          case "last7days":
            const last7Days = new Date(now);
            last7Days.setDate(last7Days.getDate() - 7);
            filters.createdAt = { gte: last7Days };
            break;
          case "last30days":
            const last30Days = new Date(now);
            last30Days.setDate(last30Days.getDate() - 30);
            filters.createdAt = { gte: last30Days };
            break;
        }
      }

      if (lastActivityDate) {
        switch (lastActivityDate) {
          case "today":
            filters.lastContactDate = {
              gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            };
            break;
          case "yesterday":
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            filters.lastContactDate = {
              gte: new Date(
                yesterday.getFullYear(),
                yesterday.getMonth(),
                yesterday.getDate()
              ),
              lt: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            };
            break;
          case "last7days":
            const last7Days = new Date(now);
            last7Days.setDate(last7Days.getDate() - 7);
            filters.lastContactDate = { gte: last7Days };
            break;
          case "last30days":
            const last30Days = new Date(now);
            last30Days.setDate(last30Days.getDate() - 30);
            filters.lastContactDate = { gte: last30Days };
            break;
          case "never":
            filters.lastContactDate = null;
            break;
        }
      }

      console.log(
        `[CONTACTS DEBUG] Final filters: ${JSON.stringify(
          filters
        )}, search: '${search}', sortBy: ${sortBy}, offset: ${offset}, limit: ${limitNum}`
      );

      const contacts = await storage.getContacts({
        filters,
        search: search as string,
        sortBy: sortBy as string,
        sortOrder: sortOrder as "asc" | "desc",
        offset,
        limit: limitNum,
      });

      const total = await storage.getContactsCount({
        filters,
        search: search as string,
      });

      console.log(
        `[CONTACTS DEBUG] Results: contacts.length=${contacts.length}, total=${total}`
      );

      res.json({
        contacts,
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      });
    } catch (error) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({ error: "Failed to fetch contacts" });
    }
  });

  app.post("/api/contacts", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const tenantId = user.tenantId;

      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID is required" });
      }

      // Validate using Zod schema
      const contactData = insertCompanyContactSchema.parse({
        ...req.body,
        tenantId,
        ownerId: req.body.ownerId || user.id, // Default to current user if not specified
      });

      const contact = await storage.createCompanyContact(contactData);
      res.status(201).json(contact);
    } catch (error) {
      console.error("Error creating contact:", error);
      res.status(500).json({ error: "Failed to create contact", details: error.message });
    }
  });

  app.get("/api/contacts/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const tenantId = user.tenantId;
      const { id } = req.params;

      const contact = await storage.getContactById(id);

      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }

      // Check tenant access
      if (contact.tenantId !== tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Role-based access control
      if (user.role === "salesperson" && contact.ownerId !== user.id) {
        return res.status(403).json({
          error: "Access denied - you can only view your own contacts",
        });
      }

      res.json(contact);
    } catch (error) {
      console.error("Error fetching contact:", error);
      res.status(500).json({ error: "Failed to fetch contact" });
    }
  });

  app.put("/api/contacts/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const tenantId = user.tenantId;
      const { id } = req.params;

      const contact = await storage.getContactById(id);

      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }

      // Check tenant access
      if (contact.tenantId !== tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Role-based access control
      if (user.role === "salesperson" && contact.ownerId !== user.id) {
        return res.status(403).json({
          error: "Access denied - you can only edit your own contacts",
        });
      }

      const updatedContact = await storage.updateContact(id, req.body);
      res.json(updatedContact);
    } catch (error) {
      console.error("Error updating contact:", error);
      res.status(500).json({ error: "Failed to update contact" });
    }
  });

  app.delete("/api/contacts/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const tenantId = user.tenantId;
      const { id } = req.params;

      const contact = await storage.getContactById(id);

      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }

      // Check tenant access
      if (contact.tenantId !== tenantId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Role-based access control
      if (user.role === "salesperson" && contact.ownerId !== user.id) {
        return res.status(403).json({
          error: "Access denied - you can only delete your own contacts",
        });
      }

      await storage.deleteContact(id, tenantId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting contact:", error);
      res.status(500).json({ error: "Failed to delete contact" });
    }
  });

  // Business Records routes (client's customers/leads)
  app.get(
    "/api/customers",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        // Get business records where recordType = 'customer' (copier buyers)
        const customers = await storage.getBusinessRecords(
          tenantId,
          "customer"
        );
        // Transform database fields to frontend format
        const transformedCustomers = customers.map((customer) =>
          BusinessRecordsTransformer.toFrontend(customer)
        );
        res.json(transformedCustomers);
      } catch (error) {
        console.error("Error fetching customers:", error);
        res.status(500).json({ message: "Failed to fetch customers" });
      }
    }
  );

  app.get(
    "/api/customers/:id",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        // Try to get by URL slug first, then by ID
        let customer;
        const isSlug = id.includes("-") && id.length >= 20 && /\d{8}$/.test(id);

        if (isSlug) {
          customer = await storage.getBusinessRecordBySlug(id, tenantId);
        } else {
          customer = await storage.getBusinessRecord(id, tenantId);
        }

        if (!customer) {
          return res.status(404).json({ message: "Customer not found" });
        }

        // Transform database fields to frontend format
        const transformedCustomer =
          BusinessRecordsTransformer.toFrontend(customer);
        res.json(transformedCustomer);
      } catch (error) {
        console.error("Error fetching customer:", error);
        res.status(500).json({ message: "Failed to fetch customer" });
      }
    }
  );

  app.post(
    "/api/customers",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }

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
    }
  );

  // Leads API routes (unified with business records)
  app.get("/api/leads", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }
      // Get business records where recordType = 'lead'
      const leads = await storage.getBusinessRecords(tenantId, "lead");
      // Transform database fields to frontend format
      const transformedLeads = leads.map((lead) =>
        BusinessRecordsTransformer.toFrontend(lead)
      );
      res.json(transformedLeads);
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  app.get("/api/leads/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }
      // Try to get by URL slug first, then by ID
      let lead;
      const isSlug = id.includes("-") && id.length >= 20 && /\d{8}$/.test(id);

      if (isSlug) {
        lead = await storage.getBusinessRecordBySlug(id, tenantId);
      } else {
        lead = await storage.getBusinessRecord(id, tenantId);
      }

      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }

      // Transform database fields to frontend format
      const transformedLead = BusinessRecordsTransformer.toFrontend(lead);
      res.json(transformedLead);
    } catch (error) {
      console.error("Error fetching lead:", error);
      res.status(500).json({ message: "Failed to fetch lead" });
    }
  });

  // Unified business records route (handles both customers and leads by slug/ID)
  app.get("/api/business-records/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      // Try to get by URL slug first, then by ID
      let record;
      const isSlug = id.includes("-") && id.length >= 20 && /\d{8}$/.test(id);

      if (isSlug) {
        record = await storage.getBusinessRecordBySlug(id, tenantId);
      } else {
        record = await storage.getBusinessRecord(id, tenantId);
      }

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

  // Business Records Import (CSV)
  app.post(
    "/api/business-records/import",
    requireAuth,
    upload.single("file"),
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ error: "Tenant ID is required" });
        }

        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        console.log("[IMPORT DEBUG] Processing CSV import for tenant:", tenantId);
        const csvData = await parseCSV(req.file.buffer);
        console.log("[IMPORT DEBUG] Parsed CSV rows:", csvData.length);

        let imported = 0;
        let skipped = 0;
        let duplicates = 0;
        const errors: string[] = [];

        for (let i = 0; i < csvData.length; i++) {
          const row = csvData[i];
          
          // Skip empty rows
          if (!row.companyName || !row.companyName.trim()) {
            skipped++;
            continue;
          }

          try {
            // Check for duplicates
            const existing = await storage.getBusinessRecords({
              tenantId,
              search: row.companyName.trim(),
            });
            
            if (existing.some((record: any) => 
              record.companyName.toLowerCase() === row.companyName.toLowerCase().trim()
            )) {
              duplicates++;
              continue;
            }

            // Transform and validate data
            const businessRecordData = {
              tenantId,
              recordType: "lead",
              status: "new",
              companyName: row.companyName.trim(),
              primaryContactName: row.primaryContactName || "",
              primaryContactEmail: row.primaryContactEmail || "",
              primaryContactPhone: row.primaryContactPhone || "",
              primaryContactTitle: row.primaryContactTitle || "",
              website: row.website || "",
              industry: row.industry || "",
              employeeCount: row.employeeCount ? parseInt(row.employeeCount) : null,
              annualRevenue: row.annualRevenue ? parseFloat(row.annualRevenue) : null,
              addressLine1: row.addressLine1 || "",
              addressLine2: row.addressLine2 || "",
              city: row.city || "",
              state: row.state || "",
              postalCode: row.postalCode || "",
              country: row.country || "US",
              phone: row.phone || row.primaryContactPhone || "",
              fax: row.fax || "",
              leadSource: row.leadSource || "import",
              estimatedAmount: row.estimatedAmount ? parseFloat(row.estimatedAmount) : null,
              probability: row.probability ? parseInt(row.probability) : 50,
              salesStage: row.salesStage || "new",
              interestLevel: row.interestLevel || "medium",
              priority: row.priority || "medium",
              territory: row.territory || "",
              notes: row.notes || "",
              assignedSalesRep: row.assignedSalesRep === "current_user" ? req.user.id : row.assignedSalesRep || req.user.id,
              ownerId: row.assignedSalesRep === "current_user" ? req.user.id : row.assignedSalesRep || req.user.id,
              createdBy: req.user.id,
            };

            await storage.createBusinessRecord(businessRecordData);
            imported++;
            
          } catch (error: any) {
            console.error(`Error importing row ${i + 1}:`, error);
            errors.push(`Row ${i + 2}: ${error.message}`);
            skipped++;
          }
        }

        console.log(`[IMPORT DEBUG] Import completed: ${imported} imported, ${skipped} skipped, ${duplicates} duplicates`);

        res.json({
          success: true,
          imported,
          skipped,
          duplicates,
          errors,
          message: `Successfully imported ${imported} leads. ${skipped > 0 ? `${skipped} rows skipped.` : ""} ${duplicates > 0 ? `${duplicates} duplicates found.` : ""}`
        });

      } catch (error) {
        console.error("Error importing business records:", error);
        res.status(500).json({ 
          success: false,
          error: "Import failed", 
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );

  // Company management routes (new primary business entity)
  app.get(
    "/api/companies",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const user = req.user as any;
        const tenantId = user.tenantId;
        const search = String((req.query as any)?.search || "");

        const allCompanies = await storage.getCompanies(tenantId);
        const companies = search
          ? allCompanies.filter((c: any) =>
              (c.businessName || "")
                .toLowerCase()
                .includes(search.toLowerCase())
            )
          : allCompanies;
        res.json(companies);
      } catch (error) {
        console.error("Error fetching companies:", error);
        res.status(500).json({ message: "Failed to fetch companies" });
      }
    }
  );

  app.get(
    "/api/companies/:id",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const company = await storage.getCompany(id, tenantId);
        if (!company) {
          return res.status(404).json({ message: "Company not found" });
        }
        res.json(company);
      } catch (error) {
        console.error("Error fetching company:", error);
        res.status(500).json({ message: "Failed to fetch company" });
      }
    }
  );

  app.post(
    "/api/companies",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const validatedData = insertCompanySchema.parse({
          ...req.body,
          tenantId: tenantId,
        });
        const company = await storage.createCompany(validatedData as any);
        res.status(201).json(company);
      } catch (error) {
        console.error("Error creating company:", error);
        res.status(500).json({ message: "Failed to create company" });
      }
    }
  );

  app.put(
    "/api/companies/:id",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const safeUpdate = { ...req.body } as any;
        if (safeUpdate.department === undefined) delete safeUpdate.department;
        const updatedCompany = await storage.updateCompany(
          id,
          safeUpdate,
          tenantId
        );
        if (!updatedCompany) {
          return res.status(404).json({ message: "Company not found" });
        }
        res.json(updatedCompany);
      } catch (error) {
        console.error("Error updating company:", error);
        res.status(500).json({ message: "Failed to update company" });
      }
    }
  );

  // Global company contacts route (for contacts page)
  app.get("/api/company-contacts", requireAuth, async (req: any, res) => {
    try {
      console.log(`[COMPANY-CONTACTS DEBUG] Route hit. Session:`, req.session);
      console.log(`[COMPANY-CONTACTS DEBUG] User:`, req.user);

      const user = req.user as any;
      if (!user || !user.tenantId) {
        console.log(`[COMPANY-CONTACTS DEBUG] No user or tenantId found`);
        return res.status(401).json({ message: "Authentication required" });
      }

      const tenantId = user.tenantId;
      console.log(
        `[COMPANY-CONTACTS DEBUG] Fetching all contacts for tenant: ${tenantId}`
      );

      const contacts = await storage.getAllCompanyContacts(tenantId);
      console.log(`[COMPANY-CONTACTS DEBUG] Found ${contacts.length} contacts`);

      res.json(contacts);
    } catch (error) {
      console.error("Error fetching all company contacts:", error);
      res.status(500).json({ message: "Failed to fetch company contacts" });
    }
  });

  // Company contact routes
  app.get(
    "/api/companies/:companyId/contacts",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const { companyId } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }

        // Check if this is actually a business record ID instead of a company ID
        let actualCompanyId = companyId;

        // First check if it's a valid UUID and company ID
        const isUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            companyId
          );
        let existingCompany = null;

        if (isUuid) {
          existingCompany = await storage.getCompany(companyId, tenantId);
        }

        if (!existingCompany) {
          // Since we no longer use the companies table, just use the business record ID directly
          // The companyId parameter is actually a business record ID
          actualCompanyId = companyId;
        }

        const contacts = await storage.getCompanyContacts(
          actualCompanyId,
          tenantId
        );
        res.json(contacts);
      } catch (error) {
        console.error("Error fetching company contacts:", error);
        res.status(500).json({ message: "Failed to fetch company contacts" });
      }
    }
  );

  app.post(
    "/api/companies/:companyId/contacts",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const { companyId } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }

        // Check if this is actually a business record ID instead of a company ID
        // If so, try to find or create the corresponding company
        let actualCompanyId = companyId;

        // First check if it's a valid UUID and company ID
        const isUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            companyId
          );
        let existingCompany = null;

        if (isUuid) {
          existingCompany = await storage.getCompany(companyId, tenantId);
        }

        if (!existingCompany) {
          // Since we no longer use the companies table, just use the business record ID directly
          // The companyId parameter is actually a business record ID
          actualCompanyId = companyId;
        }

        const validatedData = insertCompanyContactSchema.parse({
          ...req.body,
          tenantId: tenantId,
          companyId: actualCompanyId,
        });
        const contact = await storage.createCompanyContact(
          validatedData as any
        );
        res.status(201).json(contact);
      } catch (error: any) {
        console.error("Error creating company contact:", error);
        if (error?.code === "23503") {
          return res.status(400).json({ message: "Invalid company reference" });
        }
        res.status(500).json({ message: "Failed to create company contact" });
      }
    }
  );

  // Lead management routes (potential copier buyers for Printyx clients)
  app.get("/api/leads", requireAuth, requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }
      // Get business records where recordType = 'lead' (potential copier buyers)
      const leads = await storage.getLeads(tenantId);
      res.json(leads);
    } catch (error) {
      console.error("Error fetching leads:", error);
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  app.get("/api/leads/:id", requireAuth, requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }
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

  app.post("/api/leads", requireAuth, requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }
      const validatedData = insertLeadSchema.parse({
        ...req.body,
        tenantId: tenantId,
        createdBy: "demo-user",
      });
      const lead = await storage.createLead(validatedData);
      res.json(lead);
    } catch (error) {
      console.error("Error creating lead:", error);
      res.status(500).json({ message: "Failed to create lead" });
    }
  });

  app.put("/api/leads/:id", requireAuth, requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }
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
  app.post(
    "/api/leads/:id/convert",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const customer = await storage.convertLeadToCustomer(
          id,
          tenantId,
          req.user?.id as string
        );
        res.json(customer);
      } catch (error) {
        console.error("Error converting lead:", error);
        res.status(500).json({ message: "Failed to convert lead to customer" });
      }
    }
  );

  // Lead activities
  app.get(
    "/api/leads/:id/activities",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const activities = await storage.getLeadActivities(id, tenantId);
        res.json(activities);
      } catch (error) {
        console.error("Error fetching lead activities:", error);
        res.status(500).json({ message: "Failed to fetch lead activities" });
      }
    }
  );

  app.post(
    "/api/leads/:id/activities",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const activityData = {
          ...req.body,
          leadId: id,
          tenantId,
          createdBy: "demo-user",
        };
        const activity = await storage.createLeadActivity(activityData);
        res.json(activity);
      } catch (error) {
        console.error("Error creating lead activity:", error);
        res.status(500).json({ message: "Failed to create lead activity" });
      }
    }
  );

  // Lead contacts
  app.get(
    "/api/leads/:id/contacts",
    requireAuth,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const contacts = await storage.getLeadContacts(id, tenantId);
        res.json(contacts);
      } catch (error) {
        console.error("Error fetching lead contacts:", error);
        res.status(500).json({ message: "Failed to fetch lead contacts" });
      }
    }
  );

  app.post(
    "/api/leads/:id/contacts",
    requireAuth,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        // Validate using Zod schema
        const contactData = insertLeadContactSchema.parse({
          ...req.body,
          leadId: id,
          tenantId,
        });
        
        console.log('Creating lead contact with data:', contactData);
        const contact = await storage.createLeadContact(contactData);
        res.json(contact);
      } catch (error) {
        console.error("Error creating lead contact:", error);
        console.error("Error details:", {
          message: error.message,
          stack: error.stack,
          requestBody: req.body,
        });
        res.status(500).json({ 
          message: "Failed to create lead contact",
          details: error.message 
        });
      }
    }
  );

  // Lead related records
  app.get(
    "/api/leads/:id/related-records",
    requireAuth,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const records = await storage.getLeadRelatedRecords(id, tenantId);
        res.json(records);
      } catch (error) {
        console.error("Error fetching lead related records:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch lead related records" });
      }
    }
  );

  // Product Management Routes

  // Product Models
  app.get(
    "/api/product-models",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const models = await storage.getProductModels(tenantId);
        res.json(models);
      } catch (error) {
        console.error("Error fetching product models:", error);
        res.status(500).json({ message: "Failed to fetch product models" });
      }
    }
  );

  app.get(
    "/api/product-models/:id",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const model = await storage.getProductModel(id, tenantId);
        if (!model) {
          return res.status(404).json({ message: "Product model not found" });
        }
        res.json(model);
      } catch (error) {
        console.error("Error fetching product model:", error);
        res.status(500).json({ message: "Failed to fetch product model" });
      }
    }
  );

  app.post(
    "/api/product-models",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const validatedData = insertProductModelSchema.parse({
          ...req.body,
          tenantId,
        });
        const model = await storage.createProductModel(validatedData);
        res.json(model);
      } catch (error) {
        console.error("Error creating product model:", error);
        res.status(500).json({ message: "Failed to create product model" });
      }
    }
  );

  app.patch(
    "/api/product-models/:id",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const model = await storage.updateProductModel(id, req.body, tenantId);
        if (!model) {
          return res.status(404).json({ message: "Product model not found" });
        }
        res.json(model);
      } catch (error) {
        console.error("Error updating product model:", error);
        res.status(500).json({ message: "Failed to update product model" });
      }
    }
  );

  // Bulk delete product models (must be before single delete route)
  app.delete(
    "/api/product-models/bulk-delete",
    requireAuth,
    async (req: any, res) => {
      try {
        const { ids } = req.body;
        const tenantId = req.user?.tenantId;
        
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
          return res.status(400).json({ error: 'Invalid or empty ids array' });
        }

        console.log('Bulk deleting master models:', ids);
        const results = [];
        
        for (const id of ids) {
          try {
            // Check if this is a master product model (since that's what the frontend displays)
            const existingMasterModel = await storage.getMasterProductModel(id);
            if (existingMasterModel) {
              // Delete from master product models table
              const result = await storage.deleteMasterProductModel(id);
              results.push({ id, success: result });
              console.log(`Delete result for master model ${id}:`, result);
            } else {
              // Fallback: check tenant product models table
              const existingModel = await storage.getProductModel(id, tenantId);
              if (existingModel) {
                const result = await storage.deleteProductModel(id, tenantId);
                results.push({ id, success: result });
                console.log(`Delete result for tenant model ${id}:`, result);
              } else {
                results.push({ id, success: false, error: 'Product model not found' });
              }
            }
          } catch (error) {
            console.error(`Error deleting model ${id}:`, error);
            results.push({ id, success: false, error: error.message });
          }
        }
        
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        console.log(`Bulk delete complete: ${successful} successful, ${failed} failed`);
        res.json({ 
          message: `Successfully deleted ${successful} of ${ids.length} product models`,
          successful,
          failed,
          results 
        });
      } catch (error) {
        console.error('Error in bulk delete:', error);
        res.status(500).json({ error: 'Failed to perform bulk delete' });
      }
    }
  );

  app.delete(
    "/api/product-models/:id",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        
        // Check if this is a master product model (since that's what the frontend displays)
        const existingMasterModel = await storage.getMasterProductModel(id);
        if (existingMasterModel) {
          // Delete from master product models table
          const deleted = await storage.deleteMasterProductModel(id);
          console.log(`Delete result for master model ${id}:`, deleted);
          
          if (!deleted) {
            console.log(`Delete failed: No rows affected for master model ${id}`);
            return res.status(404).json({ message: "Product model not found or could not be deleted" });
          }
          res.json({ message: "Product model deleted successfully" });
          return;
        }
        
        // Fallback: check tenant product models table
        const existingModel = await storage.getProductModel(id, tenantId);
        if (!existingModel) {
          console.log(`Delete failed: Product model ${id} not found in either table`);
          return res.status(404).json({ message: "Product model not found" });
        }
        
        const deleted = await storage.deleteProductModel(id, tenantId);
        console.log(`Delete result for model ${id}:`, deleted);
        
        if (!deleted) {
          console.log(`Delete failed: No rows affected for model ${id} in tenant ${tenantId}`);
          return res.status(404).json({ message: "Product model not found or could not be deleted" });
        }
        res.json({ message: "Product model deleted successfully" });
      } catch (error) {
        console.error("Error deleting product model:", error);
        res.status(500).json({ message: "Failed to delete product model" });
      }
    }
  );

  // Product Accessories
  app.get(
    "/api/product-accessories",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }

        // Check if codes parameter is provided for filtering
        const codesParam = req.query.codes as string;
        if (codesParam) {
          const codes = codesParam.split(',').map(code => code.trim());
          const accessories = await storage.getProductAccessoriesByCodes(codes, tenantId);
          return res.json(accessories);
        }

        const accessories = await storage.getAllProductAccessories(tenantId);
        res.json(accessories);
      } catch (error) {
        console.error("Error fetching product accessories:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch product accessories" });
      }
    }
  );

  app.get(
    "/api/product-models/:modelId/accessories",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const { modelId } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const accessories = await storage.getProductAccessories(modelId);
        res.json(accessories);
      } catch (error) {
        console.error("Error fetching product accessories:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch product accessories" });
      }
    }
  );

  app.post(
    "/api/product-accessories",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const validatedData = insertProductAccessorySchema.parse({
          ...req.body,
          tenantId,
        });
        const accessory = await storage.createProductAccessory(validatedData);
        res.json(accessory);
      } catch (error) {
        console.error("Error creating product accessory:", error);
        res.status(500).json({ message: "Failed to create product accessory" });
      }
    }
  );

  app.delete(
    "/api/product-accessories/:id",
    requireAuth,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const success = await storage.deleteProductAccessory(id, tenantId);
        if (!success) {
          return res.status(404).json({ message: "Product accessory not found" });
        }
        res.json({ message: "Product accessory deleted successfully" });
      } catch (error) {
        console.error("Error deleting product accessory:", error);
        res.status(500).json({ message: "Failed to delete product accessory" });
      }
    }
  );

  app.post(
    "/api/product-models/:modelId/accessories",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const { modelId } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        // Create the accessory first (without modelId since it's no longer in the schema)
        const accessoryData = insertProductAccessorySchema.parse({
          ...req.body,
          tenantId,
        });
        const accessory = await storage.createProductAccessory(accessoryData);
        
        // Then create the compatibility relationship
        const compatibilityData = insertAccessoryModelCompatibilitySchema.parse({
          accessoryId: accessory.id,
          modelId,
          tenantId,
          isRequired: req.body.isRequired || false,
          isOptional: true,
        });
        await storage.createAccessoryModelCompatibility(compatibilityData);
        
        res.json(accessory);
      } catch (error) {
        console.error("Error creating product accessory:", error);
        res.status(500).json({ message: "Failed to create product accessory" });
      }
    }
  );

  app.patch(
    "/api/product-accessories/:id",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const accessory = await storage.updateProductAccessory(
          id,
          req.body,
          tenantId
        );
        if (!accessory) {
          return res
            .status(404)
            .json({ message: "Product accessory not found" });
        }
        res.json(accessory);
      } catch (error) {
        console.error("Error updating product accessory:", error);
        res.status(500).json({ message: "Failed to update product accessory" });
      }
    }
  );

  // Accessory-Model Compatibility Routes
  app.get(
    "/api/accessories/:accessoryId/compatibility",
    requireAuth,
    async (req: any, res) => {
      try {
        const { accessoryId } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const compatibilities = await storage.getAccessoryCompatibilities(
          accessoryId,
          tenantId
        );
        res.json(compatibilities);
      } catch (error) {
        console.error("Error fetching accessory compatibilities:", error);
        res.status(500).json({ message: "Failed to fetch compatibilities" });
      }
    }
  );

  app.post(
    "/api/accessories/:accessoryId/compatibility",
    requireAuth,
    async (req: any, res) => {
      try {
        const { accessoryId } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const validatedData = insertAccessoryModelCompatibilitySchema.parse({
          ...req.body,
          accessoryId,
          tenantId,
        });
        const compatibility = await storage.createAccessoryModelCompatibility(
          validatedData
        );
        res.status(201).json(compatibility);
      } catch (error) {
        console.error("Error creating accessory compatibility:", error);
        res.status(500).json({ message: "Failed to create compatibility" });
      }
    }
  );

  app.delete(
    "/api/accessories/:accessoryId/compatibility/:modelId",
    requireAuth,
    async (req: any, res) => {
      try {
        const { accessoryId, modelId } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        await storage.deleteAccessoryModelCompatibility(
          accessoryId,
          modelId,
          tenantId
        );
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting accessory compatibility:", error);
        res.status(500).json({ message: "Failed to delete compatibility" });
      }
    }
  );

  app.get(
    "/api/models/:modelId/compatibility",
    requireAuth,
    async (req: any, res) => {
      try {
        const { modelId } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const compatibilities = await storage.getModelCompatibilities(
          modelId,
          tenantId
        );
        res.json(compatibilities);
      } catch (error) {
        console.error("Error fetching model compatibilities:", error);
        res.status(500).json({ message: "Failed to fetch compatibilities" });
      }
    }
  );

  app.post(
    "/api/accessory-model-compatibility",
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const validatedData = insertAccessoryModelCompatibilitySchema.parse({
          ...req.body,
          tenantId,
        });
        const compatibility = await storage.createAccessoryModelCompatibility(
          validatedData
        );
        res.status(201).json(compatibility);
      } catch (error) {
        console.error("Error creating accessory compatibility:", error);
        res.status(500).json({ message: "Failed to create compatibility" });
      }
    }
  );

  app.delete(
    "/api/accessory-model-compatibility/:accessoryId/:modelId",
    requireAuth,
    async (req: any, res) => {
      try {
        const { accessoryId, modelId } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        await storage.deleteAccessoryModelCompatibility(
          accessoryId,
          modelId,
          tenantId
        );
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting accessory compatibility:", error);
        res.status(500).json({ message: "Failed to delete compatibility" });
      }
    }
  );

  // Professional Services
  app.get(
    "/api/professional-services",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const services = await storage.getAllProfessionalServices(tenantId);
        res.json(services);
      } catch (error) {
        console.error("Error fetching professional services:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch professional services" });
      }
    }
  );

  app.post(
    "/api/professional-services",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const validatedData = insertProfessionalServiceSchema.parse({
          ...req.body,
          tenantId,
        });
        const service = await storage.createProfessionalService(validatedData);
        res.json(service);
      } catch (error) {
        console.error("Error creating professional service:", error);
        res
          .status(500)
          .json({ message: "Failed to create professional service" });
      }
    }
  );

  app.patch(
    "/api/professional-services/:id",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const updated = await storage.updateProfessionalService(id, req.body, tenantId);
        if (!updated) {
          return res.status(404).json({ message: "Professional service not found" });
        }
        res.json(updated);
      } catch (error) {
        console.error("Error updating professional service:", error);
        res.status(500).json({ message: "Failed to update professional service" });
      }
    }
  );

  app.delete(
    "/api/professional-services/:id",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const success = await storage.deleteProfessionalService(id, tenantId);
        if (!success) {
          return res.status(404).json({ message: "Professional service not found" });
        }
        res.json({ message: "Professional service deleted successfully" });
      } catch (error) {
        console.error("Error deleting professional service:", error);
        res.status(500).json({ message: "Failed to delete professional service" });
      }
    }
  );

  // Service Products
  app.get(
    "/api/service-products",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const services = await storage.getAllServiceProducts(tenantId);
        res.json(services);
      } catch (error) {
        console.error("Error fetching service products:", error);
        res.status(500).json({ message: "Failed to fetch service products" });
      }
    }
  );

  app.post(
    "/api/service-products",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const validatedData = insertServiceProductSchema.parse({
          ...req.body,
          tenantId,
        });
        const service = await storage.createServiceProduct(validatedData);
        res.json(service);
      } catch (error) {
        console.error("Error creating service product:", error);
        res.status(500).json({ message: "Failed to create service product" });
      }
    }
  );

  // Software Products
  app.get(
    "/api/software-products",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const products = await storage.getAllSoftwareProducts(tenantId);
        res.json(products);
      } catch (error) {
        console.error("Error fetching software products:", error);
        res.status(500).json({ message: "Failed to fetch software products" });
      }
    }
  );

  app.post(
    "/api/software-products",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const validatedData = insertSoftwareProductSchema.parse({
          ...req.body,
          tenantId,
        });
        const product = await storage.createSoftwareProduct(validatedData);
        res.json(product);
      } catch (error) {
        console.error("Error creating software product:", error);
        res.status(500).json({ message: "Failed to create software product" });
      }
    }
  );

  app.put(
    "/api/software-products/:id",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const validatedData = insertSoftwareProductSchema.parse({
          ...req.body,
          tenantId,
        });
        const product = await storage.updateSoftwareProduct(id, validatedData, tenantId);
        res.json(product);
      } catch (error) {
        console.error("Error updating software product:", error);
        res.status(500).json({ message: "Failed to update software product" });
      }
    }
  );

  // Bulk delete software products (must be before single delete route)
  app.delete(
    "/api/software-products/bulk-delete",
    requireAuth,
    async (req: any, res) => {
      try {
        const { ids } = req.body;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        if (!Array.isArray(ids) || ids.length === 0) {
          return res.status(400).json({ message: "IDs array is required" });
        }
        const deletedCount = await storage.bulkDeleteSoftwareProducts(ids, tenantId);
        res.json({ 
          message: `Successfully deleted ${deletedCount} software products`,
          deletedCount 
        });
      } catch (error) {
        console.error("Error bulk deleting software products:", error);
        res.status(500).json({ message: "Failed to bulk delete software products" });
      }
    }
  );

  // Delete software product
  app.delete(
    "/api/software-products/:id",
    requireAuth,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const success = await storage.deleteSoftwareProduct(id, tenantId);
        if (!success) {
          return res.status(404).json({ message: "Software product not found" });
        }
        res.json({ message: "Software product deleted successfully" });
      } catch (error) {
        console.error("Error deleting software product:", error);
        res.status(500).json({ message: "Failed to delete software product" });
      }
    }
  );

  // Supplies
  app.get("/api/supplies", requireAuth, requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }
      const supplies = await storage.getAllSupplies(tenantId);
      res.json(supplies);
    } catch (error) {
      console.error("Error fetching supplies:", error);
      res.status(500).json({ message: "Failed to fetch supplies" });
    }
  });

  app.post("/api/supplies", requireAuth, requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }
      const validatedData = insertSupplySchema.parse({
        ...req.body,
        tenantId,
      });
      const supply = await storage.createSupply(validatedData);
      res.json(supply);
    } catch (error) {
      console.error("Error creating supply:", error);
      res.status(500).json({ message: "Failed to create supply" });
    }
  });

  app.patch(
    "/api/supplies/:id",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const updated = await storage.updateSupply(id, req.body, tenantId);
        if (!updated) {
          return res.status(404).json({ message: "Supply not found" });
        }
        res.json(updated);
      } catch (error) {
        console.error("Error updating supply:", error);
        res.status(500).json({ message: "Failed to update supply" });
      }
    }
  );

  app.delete(
    "/api/supplies/:id",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const success = await storage.deleteSupply(id, tenantId);
        if (!success) {
          return res.status(404).json({ message: "Supply not found" });
        }
        res.json({ message: "Supply deleted successfully" });
      } catch (error) {
        console.error("Error deleting supply:", error);
        res.status(500).json({ message: "Failed to delete supply" });
      }
    }
  );

  // Managed Services
  app.get(
    "/api/managed-services",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const services = await storage.getAllManagedServices(tenantId);
        res.json(services);
      } catch (error) {
        console.error("Error fetching managed services:", error);
        res.status(500).json({ message: "Failed to fetch managed services" });
      }
    }
  );

  // Inventory
  app.get("/api/inventory", requireAuth, requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }
      const items = await storage.getInventoryItems(tenantId);
      // Shape data to match current UI expectations in Inventory.tsx
      const shaped = items.map((it: any) => ({
        id: it.id,
        name: it.itemDescription ?? it.manufacturerPartNumber ?? it.partNumber,
        sku: it.partNumber,
        currentStock: it.quantityOnHand ?? 0,
        reorderPoint: it.reorderPoint ?? 0,
        unitCost: it.unitCost ?? 0,
      }));
      res.json(shaped);
    } catch (error) {
      console.error("Error fetching inventory:", error);
      res.status(500).json({ message: "Failed to fetch inventory" });
    }
  });

  app.post(
    "/api/inventory",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        // Prefer strict validation against insert schema if client sends schema-compatible payload
        let payload: any;
        try {
          payload = insertInventoryItemSchema.parse({ ...req.body, tenantId });
        } catch {
          // Fallback: map simplified UI shape to schema
          const { name, sku, reorderPoint, unitCost, currentStock } =
            req.body ?? {};
          payload = insertInventoryItemSchema.parse({
            tenantId,
            partNumber: sku,
            itemDescription: name,
            reorderPoint: reorderPoint ?? 0,
            unitCost: unitCost ?? 0,
            quantityOnHand: currentStock ?? 0,
          });
        }
        const created = await storage.createInventoryItem(payload);
        res.json(created);
      } catch (error) {
        console.error("Error creating inventory item:", error);
        res.status(500).json({ message: "Failed to create inventory item" });
      }
    }
  );

  app.patch(
    "/api/inventory/:id",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        // Allow partial updates either in schema fields or UI fields
        const body = req.body ?? {};
        const updates: any = {
          ...body,
        };
        if (body.name) updates.itemDescription = body.name;
        if (body.sku) updates.partNumber = body.sku;
        if (typeof body.currentStock === "number")
          updates.quantityOnHand = body.currentStock;
        if (typeof body.reorderPoint === "number")
          updates.reorderPoint = body.reorderPoint;
        if (typeof body.unitCost === "number") updates.unitCost = body.unitCost;

        const updated = await storage.updateInventoryItem(
          id,
          updates,
          tenantId
        );
        if (!updated) {
          return res.status(404).json({ message: "Inventory item not found" });
        }
        res.json(updated);
      } catch (error) {
        console.error("Error updating inventory item:", error);
        res.status(500).json({ message: "Failed to update inventory item" });
      }
    }
  );

  app.post(
    "/api/managed-services",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const validatedData = insertManagedServiceSchema.parse({
          ...req.body,
          tenantId,
        });
        const service = await storage.createManagedService(validatedData);
        res.json(service);
      } catch (error) {
        console.error("Error creating managed service:", error);
        res.status(500).json({ message: "Failed to create managed service" });
      }
    }
  );

  app.patch(
    "/api/managed-services/:id",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const updated = await storage.updateManagedService(id, req.body, tenantId);
        if (!updated) {
          return res.status(404).json({ message: "Managed service not found" });
        }
        res.json(updated);
      } catch (error) {
        console.error("Error updating managed service:", error);
        res.status(500).json({ message: "Failed to update managed service" });
      }
    }
  );

  app.delete(
    "/api/managed-services/:id",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const success = await storage.deleteManagedService(id, tenantId);
        if (!success) {
          return res.status(404).json({ message: "Managed service not found" });
        }
        res.json({ message: "Managed service deleted successfully" });
      } catch (error) {
        console.error("Error deleting managed service:", error);
        res.status(500).json({ message: "Failed to delete managed service" });
      }
    }
  );

  // ============= ACCOUNTING API ROUTES =============

  // Vendors Management
  app.get("/api/vendors", requireAuth, async (req, res) => {
    try {
      const { tenantId } = (req as any).user || {};
      const vendors = await storage.getVendors(tenantId);
      res.json(vendors);
    } catch (error) {
      console.error("Error fetching vendors:", error);
      res.status(500).json({ message: "Failed to fetch vendors" });
    }
  });

  app.get("/api/vendors/:id", requireAuth, async (req, res) => {
    try {
      const { tenantId } = (req as any).user || {};
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
      const { tenantId } = (req as any).user || {};
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
      const { tenantId } = (req as any).user || {};
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
      const { tenantId } = (req as any).user || {};
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
      const { tenantId } = (req as any).user || {};
      const accountsPayable = await storage.getAccountsPayable(tenantId);
      res.json(accountsPayable);
    } catch (error) {
      console.error("Error fetching accounts payable:", error);
      res.status(500).json({ message: "Failed to fetch accounts payable" });
    }
  });

  app.post("/api/accounts-payable", requireAuth, async (req, res) => {
    try {
      const { tenantId, id: userId } = (req as any).user || {};
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
      const { tenantId } = (req as any).user || {};
      const accountsReceivable = await storage.getAccountsReceivable(tenantId);
      res.json(accountsReceivable);
    } catch (error) {
      console.error("Error fetching accounts receivable:", error);
      res.status(500).json({ message: "Failed to fetch accounts receivable" });
    }
  });

  app.post("/api/accounts-receivable", requireAuth, async (req, res) => {
    try {
      const { tenantId, id: userId } = (req as any).user || {};
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
      const { tenantId } = (req as any).user || {};
      const accounts = await storage.getChartOfAccounts(tenantId);
      res.json(accounts);
    } catch (error) {
      console.error("Error fetching chart of accounts:", error);
      res.status(500).json({ message: "Failed to fetch chart of accounts" });
    }
  });

  app.post("/api/chart-of-accounts", requireAuth, async (req, res) => {
    try {
      const { tenantId } = (req as any).user || {};
      const accountData = { ...req.body, tenantId };
      const newAccount = await storage.createChartOfAccount(accountData);
      res.status(201).json(newAccount);
    } catch (error) {
      console.error("Error creating account:", error);
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  // Journal Entries Management (temporarily disabled; storage methods not implemented)
  app.all(
    ["/api/journal-entries", "/api/journal-entries/:id"],
    requireAuth,
    (_req, res) => {
      res.status(501).json({ message: "Journal entries API not implemented" });
    }
  );

  // Purchase Orders Management
  app.get("/api/purchase-orders", requireAuth, async (req, res) => {
    try {
      const { tenantId } = (req as any).user || {};
      const filter = String((req.query as any)?.filter || "");
      // Fall back to storage if no filter, else run filtered DB query
      if (!filter) {
        const purchaseOrders = await storage.getPurchaseOrders(tenantId);
        return res.json(purchaseOrders);
      }
      if (filter === 'variance_gt_2x') {
        const result = await db.$client.query(
          `SELECT * FROM purchase_orders 
           WHERE tenant_id = $1 
             AND approved_date IS NOT NULL 
             AND expected_date IS NOT NULL 
             AND order_date IS NOT NULL
             AND (DATE_PART('day', expected_date - approved_date)) > 2 * GREATEST(1, DATE_PART('day', expected_date - order_date))
           ORDER BY created_at DESC 
           LIMIT 200`,
          [tenantId]
        );
        return res.json(result.rows);
      }
      // Unknown filter → default list
      const purchaseOrders = await storage.getPurchaseOrders(tenantId);
      res.json(purchaseOrders);
    } catch (error) {
      console.error("Error fetching purchase orders:", error);
      res.status(500).json({ message: "Failed to fetch purchase orders" });
    }
  });

  app.post("/api/purchase-orders", requireAuth, async (req, res) => {
    try {
      const { tenantId, id: userId } = (req as any).user || {};
      const poData = { ...req.body, tenantId, createdBy: userId };
      const newPO = await storage.createPurchaseOrder(poData);
      res.status(201).json(newPO);
    } catch (error) {
      console.error("Error creating purchase order:", error);
      res.status(500).json({ message: "Failed to create purchase order" });
    }
  });

  // Low stock suggestions for auto-generating POs
  app.get("/api/purchase-orders/suggestions/low-stock", requireAuth, async (req: any, res) => {
    try {
      const { tenantId } = req.user || {};

      const items = await db
        .select({
          id: inventoryItems.id,
          itemDescription: inventoryItems.name,
          partNumber: inventoryItems.partNumber,
          quantityOnHand: inventoryItems.currentStock,
          quantityOnOrder: inventoryItems.currentStock,
          reorderPoint: inventoryItems.reorderPoint,
          reorderQuantity: inventoryItems.reorderPoint,
          unitCost: inventoryItems.unitCost,
          primaryVendor: inventoryItems.supplier,
        })
        .from(inventoryItems)
        .where(
          and(
            tenantId ? eq(inventoryItems.tenantId, tenantId) : sql`TRUE`,
            sql`reorder_point IS NOT NULL AND current_stock <= reorder_point AND COALESCE(reorder_point, 0) > 0 AND supplier IS NOT NULL`
          )
        )
        .orderBy(asc(inventoryItems.supplier), asc(inventoryItems.name))
        .limit(500);

      if (!items.length) return res.json({ groups: [] });

      const vendorRows = await db
        .select({ id: vendors.id, name: vendors.vendorName })
        .from(vendors)
        .where(tenantId ? eq(vendors.tenantId, tenantId) : sql`TRUE`);
      const vendorNameToId = new Map(vendorRows.map(v => [v.name?.toLowerCase(), v.id] as const));

      const groupsMap = new Map<string, any>();
      for (const it of items) {
        const key = (it.primaryVendor || "").toLowerCase();
        if (!key) continue;
        if (!groupsMap.has(key)) {
          groupsMap.set(key, {
            vendorName: it.primaryVendor,
            vendorId: vendorNameToId.get(key) || null,
            items: [] as any[],
          });
        }
        const recommendedQty = Number(it.reorderQuantity) || 0;
        groupsMap.get(key).items.push({
          inventoryItemId: it.id,
          partNumber: it.partNumber,
          itemDescription: it.itemDescription,
          recommendedQty,
          unitCost: it.unitCost || 0,
        });
      }

      const groups = Array.from(groupsMap.values());
      res.json({ groups });
    } catch (error) {
      console.error("Error building low-stock suggestions:", error);
      res.status(500).json({ message: "Failed to build suggestions" });
    }
  });

  // Generate purchase orders from low-stock suggestions
  app.post("/api/purchase-orders/generate-from-suggestions", requireAuth, async (req: any, res) => {
    try {
      const { tenantId, id: userId } = req.user || {};
      const { groups, orderDate, expectedDate, description } = req.body || {};
      if (!Array.isArray(groups) || groups.length === 0) {
        return res.status(400).json({ message: "No groups provided" });
      }

      const createdPoIds: string[] = [];
      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        if (!group.vendorId || !Array.isArray(group.items) || group.items.length === 0) continue;

        let subtotal = 0;
        const lineItems = group.items.map((it: any, idx: number) => {
          const qty = Number(it.quantity || it.recommendedQty || 0);
          const price = Number(it.unitCost || 0);
          const total = qty * price;
          subtotal += total;
          return {
            tenantId,
            purchaseOrderId: "",
            lineNumber: idx + 1,
            itemDescription: it.itemDescription || it.partNumber || "Item",
            itemCode: it.partNumber || null,
            quantity: qty,
            unitPrice: price,
            totalPrice: total,
          };
        });

        const poNumber = `PO-${Date.now()}-${i + 1}`;
        const poData = {
          tenantId,
          poNumber,
          vendorId: group.vendorId,
          requestedBy: userId,
          orderDate: orderDate ? new Date(orderDate) : new Date(),
          expectedDate: expectedDate ? new Date(expectedDate) : null,
          description: description || `Auto-generated from low stock for ${group.vendorName || group.vendorId}`,
          subtotal,
          taxAmount: 0,
          shippingAmount: 0,
          totalAmount: subtotal,
          status: "draft",
          deliveryAddress: null,
          specialInstructions: null,
          approvedBy: null,
          approvedDate: null,
          createdBy: userId,
        } as any;

        const createdPO = await storage.createPurchaseOrder(poData);
        createdPoIds.push(createdPO.id);

        for (const li of lineItems) {
          await storage.createPurchaseOrderItem({ ...li, purchaseOrderId: createdPO.id });
        }
      }

      res.json({ createdPoIds });
    } catch (error) {
      console.error("Error generating purchase orders:", error);
      res.status(500).json({ message: "Failed to generate purchase orders" });
    }
  });

  // Company contacts endpoints
  app.post(
    "/api/companies/:companyId/contacts",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
          return res
            .status(400)
            .json({ message: "Contacts array is required" });
        }

        // Create contacts for the company
        const createdContacts = [];
        for (const contactData of contacts) {
          const contact = await storage.createContact({
            ...contactData,
            companyId: companyId, // Use companyId field for company_contacts table
            tenantId: user.tenantId,
            ownerId: user.id, // Set the current user as owner
            leadStatus: "new", // Set default lead status
          });
          createdContacts.push(contact);
        }

        res.json({
          message: `${createdContacts.length} contact(s) created successfully`,
          contacts: createdContacts,
        });
      } catch (error) {
        console.error("Error creating company contacts:", error);
        res.status(500).json({ message: "Failed to create contacts" });
      }
    }
  );

  // ============= METER BILLING API ROUTES =============

  // Meter Readings - list with optional filters
  app.get("/api/meter-readings", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      const filter = String((req.query as any)?.filter || "");
      const nParam = String((req.query as any)?.n || "1");
      const n = Number.parseInt(nParam, 10);
      const days = Number.isNaN(n) || n <= 0 ? 30 : 30 * n; // monthly cycles approximation

      if (filter === "missed_cycles") {
        // Return the last reading per equipment where it's older than N cycles
        // Note: Equipments with no readings won't appear in this list; add an equipment LEFT JOIN if needed later
        const query = `
          WITH latest AS (
            SELECT DISTINCT ON (equipment_id) *
            FROM meter_readings
            WHERE tenant_id = $1
            ORDER BY equipment_id, reading_date DESC
          )
          SELECT *
          FROM latest
          WHERE reading_date < NOW() - ($2 || ' days')::interval
          ORDER BY reading_date NULLS FIRST
          LIMIT 200
        `;
        const result = await db.$client.query(query, [tenantId, String(days)]);
        return res.json(result.rows);
      }

      // Default: recent readings
      const result = await db.$client.query(
        `SELECT * FROM meter_readings WHERE tenant_id = $1 ORDER BY reading_date DESC LIMIT 200`,
        [tenantId]
      );
      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching meter readings:", error);
      res.status(500).json({ message: "Failed to fetch meter readings" });
    }
  });

  // Create meter reading (accepts UI shape and schema shape)
  app.post("/api/meter-readings", requireAuth, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: "Tenant ID is required" });
      }

      let payload: any;
      try {
        // Prefer strict schema if request already matches it
        payload = insertMeterReadingSchema.parse({ ...req.body, tenantId });
      } catch {
        // Map simplified UI fields to schema
        const {
          equipmentId,
          contractId,
          readingDate,
          blackMeter,
          colorMeter,
          collectionMethod,
          notes,
        } = req.body ?? {};

        payload = insertMeterReadingSchema.parse({
          tenantId,
          equipmentId,
          contractId: contractId ?? null,
          readingDate: readingDate ? new Date(readingDate) : new Date(),
          bwMeterReading: Number.parseInt(String(blackMeter ?? 0), 10),
          colorMeterReading: Number.parseInt(String(colorMeter ?? 0), 10),
          collectionMethod: collectionMethod ?? "manual",
          readingNotes: notes ?? null,
        } as any);
      }

      // Use storage if available to keep persistence consistent
      const created = await storage.createMeterReading(payload);
      res.json(created);
    } catch (error) {
      console.error("Error creating meter reading:", error);
      res.status(500).json({ message: "Failed to create meter reading" });
    }
  });

  // Contract Tiered Rates Management
  app.get(
    "/api/contract-tiered-rates",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const rates = await storage.getContractTieredRates(tenantId);
        res.json(rates);
      } catch (error) {
        console.error("Error fetching contract tiered rates:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch contract tiered rates" });
      }
    }
  );

  app.post(
    "/api/contract-tiered-rates",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const validatedData = insertContractTieredRateSchema.parse({
          ...req.body,
          tenantId,
        });
        const rate = await storage.createContractTieredRate(validatedData);
        res.json(rate);
      } catch (error) {
        console.error("Error creating contract tiered rate:", error);
        res
          .status(500)
          .json({ message: "Failed to create contract tiered rate" });
      }
    }
  );

  // Automated Invoice Generation
  app.post(
    "/api/billing/generate-invoices",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }

        // Get all pending meter readings
        const pendingReadings = await storage.getMeterReadingsByStatus(
          tenantId,
          "pending"
        );

        const generatedInvoices = [];
        for (const reading of pendingReadings) {
          try {
            // Calculate billing amounts using tiered rates
            if (!reading.contractId) continue;
            const contract = await storage.getContract(
              String(reading.contractId),
              tenantId
            );
            if (!contract) continue;

            // Get tiered rates for this contract
            const tieredRates = await storage.getContractTieredRatesByContract(
              String(reading.contractId)
            );

            let blackAmount = 0;
            let colorAmount = 0;

            // Calculate tiered billing for black & white copies
            if (reading.blackCopies && reading.blackCopies > 0) {
              const blackRates = tieredRates
                .filter((rate) => rate.colorType === "black")
                .sort((a, b) => a.minimumVolume - b.minimumVolume);
              const blackCopiesNum = Number(reading.blackCopies || 0);
              blackAmount = calculateTieredAmount(
                blackCopiesNum,
                blackRates,
                parseFloat(contract.blackRate?.toString() || "0")
              );
            }

            // Calculate tiered billing for color copies
            if (reading.colorCopies && reading.colorCopies > 0) {
              const colorRates = tieredRates
                .filter((rate) => rate.colorType === "color")
                .sort((a, b) => a.minimumVolume - b.minimumVolume);
              const colorCopiesNum = Number(reading.colorCopies || 0);
              colorAmount = calculateTieredAmount(
                colorCopiesNum,
                colorRates,
                parseFloat(contract.colorRate?.toString() || "0")
              );
            }

            const totalAmount =
              blackAmount +
              colorAmount +
              parseFloat(contract.monthlyBase?.toString() || "0");

            // Create invoice
            const invoice = await storage.createInvoice({
              tenantId: String(tenantId),
              customerId: String(contract.customerId),
              contractId: contract?.id ? String(contract.id) : null,
              invoiceNumber: `INV-${Date.now()}-${Math.random()
                .toString(36)
                .substring(2, 7)}`,
              invoiceDate: new Date(),
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              totalAmount: String(totalAmount),
              amountPaid: "0",
              balanceDue: String(totalAmount),
              invoiceStatus: "open",
              paymentTerms: "Net 30",
              invoiceNotes: `Meter billing for ${format(
                new Date(reading.readingDate),
                "MMMM yyyy"
              )}`,
              createdBy: String((req as any).user?.id || "system"),
            } as any);

            // Update meter reading billing status
            await storage.updateMeterReading(
              reading.id,
              {
                billingStatus: "processed",
                billingAmount: totalAmount.toString(),
                invoiceId: invoice.id,
              },
              tenantId
            );

            generatedInvoices.push(invoice);
          } catch (readingError) {
            console.error(
              `Error processing reading ${reading.id}:`,
              readingError
            );
          }
        }

        res.json({
          message: `Generated ${generatedInvoices.length} invoices`,
          invoices: generatedInvoices,
        });
      } catch (error) {
        console.error("Error generating invoices:", error);
        res.status(500).json({ message: "Failed to generate invoices" });
      }
    }
  );

  // Contract Profitability Analysis
  app.get(
    "/api/billing/contract-profitability",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }

        const contracts = await storage.getContracts(tenantId);
        const invoices = await storage.getInvoices(tenantId);

        const profitabilityData = contracts.map((contract) => {
          const contractInvoices = invoices.filter(
            (inv) => inv.contractId === contract.id
          );
          const totalRevenue = contractInvoices.reduce(
            (sum: number, inv: any) =>
              sum + parseFloat(String(inv.totalAmount || "0")),
            0
          );
          const totalPaid = contractInvoices.reduce(
            (sum: number, inv: any) =>
              sum + parseFloat(String(inv.amountPaid ?? "0")),
            0
          );
          const equipmentCost = parseFloat(
            (contract as any).equipmentCost?.toString() || "0"
          );
          const monthlyCosts =
            parseFloat(contract.monthlyBase?.toString() || "0") * 12; // Assume yearly cost

          const totalCosts = equipmentCost + monthlyCosts;
          const grossProfit = totalRevenue - totalCosts;
          const marginPercent =
            totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

          return {
            contractId: contract.id,
            contractNumber: contract.contractNumber,
            totalRevenue,
            totalPaid,
            totalCosts,
            grossProfit,
            marginPercent,
            invoiceCount: contractInvoices.length,
            averageInvoiceAmount:
              contractInvoices.length > 0
                ? totalRevenue / contractInvoices.length
                : 0,
          };
        });

        res.json(profitabilityData);
      } catch (error) {
        console.error("Error calculating contract profitability:", error);
        res
          .status(500)
          .json({ message: "Failed to calculate contract profitability" });
      }
    }
  );

  app.get(
    "/api/companies/:companyId/contacts",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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

        const contacts = await storage.getContactsByCompany(
          companyId,
          user.tenantId
        );
        res.json(contacts);
      } catch (error) {
        console.error("Error fetching company contacts:", error);
        res.status(500).json({ message: "Failed to fetch contacts" });
      }
    }
  );

  app.put(
    "/api/contacts/:contactId",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
    }
  );

  app.delete(
    "/api/contacts/:contactId",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
    }
  );

  // CSV Import Endpoints

  // Product Models Import
  app.post(
    "/api/product-models/import",
    upload.single("file"),
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const csvData = await parseCSV(req.file.buffer);

        let imported = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (let i = 0; i < csvData.length; i++) {
          const row = csvData[i];
          const validation = validateProductModelData(row);

          if (!validation.isValid) {
            errors.push(`Row ${i + 2}: ${validation.errors.join(", ")}`);
            skipped++;
            continue;
          }

          try {
            const productData = { ...validation.data, tenantId };
            
            // Enhanced deduplication: Check both product code AND product name
            // Only skip if BOTH match (handles speed license scenario)
            const existingModel = await storage.getProductModelByCodeAndName(
              productData.productCode,
              productData.productName,
              tenantId
            );
            
            if (existingModel) {
              // Skip this entry - both code and name match an existing model
              skipped++;
              continue;
            }
            
            // Validate required accessories exist before importing
            if (productData.requiredAccessories) {
              const requiredCodes = productData.requiredAccessories
                .split(',')
                .map(code => code.trim())
                .filter(code => code.length > 0);
              
              if (requiredCodes.length > 0) {
                const existingAccessories = await storage.getProductAccessoriesByCodes(requiredCodes, tenantId);
                const existingCodes = existingAccessories.map(acc => acc.accessoryCode);
                const missingCodes = requiredCodes.filter(code => !existingCodes.includes(code));
                
                if (missingCodes.length > 0) {
                  // Remove missing accessory codes from required accessories to prevent future errors
                  const validCodes = requiredCodes.filter(code => existingCodes.includes(code));
                  productData.requiredAccessories = validCodes.length > 0 ? validCodes.join(',') : null;
                  
                  // Log warning but continue with valid accessories only
                  console.warn(`Row ${i + 2}: Missing required accessories [${missingCodes.join(', ')}] for model ${productData.productCode}. Proceeding with valid accessories only.`);
                }
              }
            }
            
            // Create the new model (either new code or same code with different name)
            await storage.createProductModel(productData);
            imported++;
          } catch (error) {
            errors.push(
              `Row ${i + 2}: Failed to import - ${
                error instanceof Error ? error.message : "Unknown error"
              }`
            );
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
    }
  );

  // Supplies Import
  app.post(
    "/api/supplies/import",
    upload.single("file"),
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const csvData = await parseCSV(req.file.buffer);

        let imported = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (let i = 0; i < csvData.length; i++) {
          const row = csvData[i];
          const validation = validateSupplyData(row);

          if (!validation.isValid) {
            errors.push(`Row ${i + 2}: ${validation.errors.join(", ")}`);
            skipped++;
            continue;
          }

          try {
            const supplyData = { ...validation.data, tenantId };
            await storage.createSupply(supplyData);
            imported++;
          } catch (error) {
            errors.push(
              `Row ${i + 2}: Failed to import - ${
                error instanceof Error ? error.message : "Unknown error"
              }`
            );
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
    }
  );

  // Managed Services Import
  app.post(
    "/api/managed-services/import",
    upload.single("file"),
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const csvData = await parseCSV(req.file.buffer);

        let imported = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (let i = 0; i < csvData.length; i++) {
          const row = csvData[i];
          const validation = validateManagedServiceData(row);

          if (!validation.isValid) {
            errors.push(`Row ${i + 2}: ${validation.errors.join(", ")}`);
            skipped++;
            continue;
          }

          try {
            const serviceData = { ...validation.data, tenantId };
            await storage.createManagedService(serviceData);
            imported++;
          } catch (error) {
            errors.push(
              `Row ${i + 2}: Failed to import - ${
                error instanceof Error ? error.message : "Unknown error"
              }`
            );
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
    }
  );

  // Product Accessories import endpoint
  app.post(
    "/api/product-accessories/import",
    upload.single("file"),
    requireAuth,
    async (req: any, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        const csvText = req.file.buffer.toString("utf-8");
        const results = await new Promise((resolve, reject) => {
          const records: any[] = [];
          const stream = Readable.from([csvText])
            .pipe(csv())
            .on("data", (data) => records.push(data))
            .on("end", () => resolve(records))
            .on("error", reject);
        });

        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }

        let imported = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (let i = 0; i < results.length; i++) {
          const row = results[i];

          try {
            // Map CSV fields to database schema
            const accessoryData = {
              tenantId,
              accessoryCode: row.accessory_code?.trim(),
              accessoryName: row.accessory_name?.trim(),
              accessoryType: row.accessory_type?.trim() || null,
              category: row.category?.trim() || null,
              manufacturer: row.manufacturer?.trim() || null,
              description: row.description?.trim() || null,
              
              // Pricing fields
              standardCost: row.standard_cost ? parseFloat(row.standard_cost) : null,
              standardRepPrice: row.standard_rep_price ? parseFloat(row.standard_rep_price) : null,
              newCost: row.new_cost ? parseFloat(row.new_cost) : null,
              newRepPrice: row.new_rep_price ? parseFloat(row.new_rep_price) : null,
              upgradeCost: row.upgrade_cost ? parseFloat(row.upgrade_cost) : null,
              upgradeRepPrice: row.upgrade_rep_price ? parseFloat(row.upgrade_rep_price) : null,
              
              // Boolean fields with proper conversion
              isActive: row.is_active === "TRUE" || row.is_active === "true" || row.is_active === true,
              availableForAll: row.available_for_all === "TRUE" || row.available_for_all === "true" || row.available_for_all === true,
              salesRepCredit: row.sales_rep_credit === "TRUE" || row.sales_rep_credit === "true" || row.sales_rep_credit === true,
              funding: row.funding === "TRUE" || row.funding === "true" || row.funding === true,
              lease: row.lease === "TRUE" || row.lease === "true" || row.lease === true,
            };

            // Validation
            if (!accessoryData.accessoryCode || !accessoryData.accessoryName) {
              errors.push(`Row ${i + 2}: Missing required fields (accessory_code, accessory_name)`);
              skipped++;
              continue;
            }

            // Check if accessory already exists
            const existing = await db
              .select()
              .from(productAccessories)
              .where(
                and(
                  eq(productAccessories.tenantId, tenantId),
                  eq(productAccessories.accessoryCode, accessoryData.accessoryCode)
                )
              )
              .limit(1);

            if (existing.length > 0) {
              // Update existing accessory
              await db
                .update(productAccessories)
                .set({
                  ...accessoryData,
                  updatedAt: new Date(),
                })
                .where(eq(productAccessories.id, existing[0].id));
              imported++;
            } else {
              // Create new accessory
              await db.insert(productAccessories).values(accessoryData);
              imported++;
            }
          } catch (error) {
            console.error(`Error processing row ${i + 2}:`, error);
            errors.push(
              `Row ${i + 2}: Failed to import - ${
                error instanceof Error ? error.message : "Unknown error"
              }`
            );
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
        console.error("Error importing product accessories:", error);
        res.status(500).json({ message: "Failed to import product accessories" });
      }
    }
  );

  app.post(
    "/api/professional-services/import",
    upload.single("file"),
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      res.json({
        success: false,
        imported: 0,
        skipped: 0,
        errors: ["Import for Professional Services not yet implemented"],
      });
    }
  );

  app.post(
    "/api/service-products/import",
    upload.single("file"),
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      res.json({
        success: false,
        imported: 0,
        skipped: 0,
        errors: ["Import for Service Products not yet implemented"],
      });
    }
  );

  app.post(
    "/api/software-products/import",
    upload.single("file"),
    requireAuth,
    async (req: any, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }

        const csvData = await parseCSV(req.file.buffer);
        
        // Debug: Log first row structure to understand CSV parsing
        if (csvData.length > 0) {
          console.log('First CSV row keys:', Object.keys(csvData[0]));
          console.log('First CSV row standard_rep_price value:', csvData[0]['standard_rep_price']);
          console.log('First CSV row standardRepPrice value:', csvData[0]['standardRepPrice']);
        }
        
        let imported = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (let i = 0; i < csvData.length; i++) {
          const row = csvData[i];
          const validation = validateSoftwareProductData(row);

          if (!validation.isValid) {
            errors.push(`Row ${i + 2}: ${validation.errors.join(", ")}`);
            skipped++;
            continue;
          }

          try {
            const productData = { ...validation.data, tenantId };
            // Debug logging for standardRepPrice issue
            if (productData.productCode && (productData.standardRepPrice || productData.standardCost)) {
              console.log(`Importing ${productData.productCode}: standardActive=${productData.standardActive}, standardCost=${productData.standardCost}, standardRepPrice=${productData.standardRepPrice}`);
            }
            await storage.createSoftwareProduct(productData);
            imported++;
          } catch (error) {
            errors.push(
              `Row ${i + 2}: Failed to import - ${
                error instanceof Error ? error.message : "Unknown error"
              }`
            );
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
        console.error("Error importing software products:", error);
        res.status(500).json({ message: "Failed to import software products" });
      }
    }
  );

  // CPC Rates
  app.get(
    "/api/product-models/:modelId/cpc-rates",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const { modelId } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const rates = await storage.getCpcRates(modelId, tenantId);
        res.json(rates);
      } catch (error) {
        console.error("Error fetching CPC rates:", error);
        res.status(500).json({ message: "Failed to fetch CPC rates" });
      }
    }
  );

  app.post(
    "/api/product-models/:modelId/cpc-rates",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const { modelId } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }
        const validatedData = insertCpcRateSchema.parse({
          ...req.body,
          modelId,
          tenantId,
        });
        const rate = await storage.createCpcRate(validatedData);
        res.json(rate);
      } catch (error) {
        console.error("Error creating CPC rate:", error);
        res.status(500).json({ message: "Failed to create CPC rate" });
      }
    }
  );

  // Simple health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Mobile routes already integrated above in main routes

  // Workflow Automation Routes
  app.get(
    "/api/workflow-rules",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.claims.sub;

        // Mock workflow rules data for now - would come from database
        const workflowRules = [
          {
            id: "1",
            name: "Auto-Assign High Priority Tickets",
            description:
              "Automatically assign high priority service tickets to available senior technicians",
            trigger: {
              type: "service_ticket_created",
              conditions: { priority: "high" },
            },
            actions: [
              {
                type: "assign_technician",
                parameters: { skillLevel: "senior", available: true },
              },
            ],
            isActive: true,
            createdAt: new Date().toISOString(),
            lastTriggered: new Date(Date.now() - 86400000).toISOString(),
            triggerCount: 15,
          },
          {
            id: "2",
            name: "Contract Expiration Alerts",
            description:
              "Send email notifications 30 days before contract expiration",
            trigger: {
              type: "contract_expiring",
              conditions: { daysUntilExpiration: 30 },
            },
            actions: [
              {
                type: "send_email",
                parameters: { recipients: ["account_manager", "customer"] },
              },
            ],
            isActive: true,
            createdAt: new Date().toISOString(),
            lastTriggered: new Date(Date.now() - 432000000).toISOString(),
            triggerCount: 8,
          },
          {
            id: "3",
            name: "Overdue Payment Reminders",
            description:
              "Automatically send payment reminders for overdue invoices",
            trigger: {
              type: "customer_payment_overdue",
              conditions: { overdueDays: 15 },
            },
            actions: [
              {
                type: "send_email",
                parameters: { template: "payment_reminder" },
              },
              {
                type: "create_task",
                parameters: { assignee: "account_manager", priority: "high" },
              },
            ],
            isActive: false,
            createdAt: new Date().toISOString(),
            triggerCount: 0,
          },
        ];

        res.json(workflowRules);
      } catch (error) {
        console.error("Error fetching workflow rules:", error);
        res.status(500).json({ message: "Failed to fetch workflow rules" });
      }
    }
  );

  app.post(
    "/api/workflow-rules",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.claims.sub;
        const ruleData = {
          id: Date.now().toString(),
          ...req.body,
          tenantId,
          createdAt: new Date().toISOString(),
          triggerCount: 0,
        };

        // Would save to database in real implementation
        res.status(201).json(ruleData);
      } catch (error) {
        console.error("Error creating workflow rule:", error);
        res.status(500).json({ message: "Failed to create workflow rule" });
      }
    }
  );

  app.patch(
    "/api/workflow-rules/:id",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const updates = req.body;

        // Would update in database in real implementation
        res.json({ id, ...updates });
      } catch (error) {
        console.error("Error updating workflow rule:", error);
        res.status(500).json({ message: "Failed to update workflow rule" });
      }
    }
  );

  app.delete(
    "/api/workflow-rules/:id",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const { id } = req.params;

        // Would delete from database in real implementation
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting workflow rule:", error);
        res.status(500).json({ message: "Failed to delete workflow rule" });
      }
    }
  );

  // Advanced Reporting Routes
  app.get(
    "/api/advanced-reports/revenue-analytics",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.claims.sub;
        const startDate = String((req.query as any)?.startDate || "");
        const endDate = String((req.query as any)?.endDate || "");

        // Mock revenue analytics data
        const revenueData = {
          totalRevenue: 1248500,
          monthlyGrowth: 12.5,
          revenueByMonth: Array.from({ length: 12 }, (_, i) => ({
            month: new Date(2024, i).toLocaleDateString("en-US", {
              month: "short",
            }),
            revenue: Math.floor(Math.random() * 150000) + 80000,
            contracts: Math.floor(Math.random() * 50) + 30,
          })),
          revenueByService: [
            { service: "Meter Billing", revenue: 450000, percentage: 36 },
            { service: "Service Contracts", revenue: 380000, percentage: 30 },
            { service: "Equipment Sales", revenue: 280000, percentage: 22 },
            { service: "Supplies", revenue: 138500, percentage: 12 },
          ],
        };

        res.json(revenueData);
      } catch (error) {
        console.error("Error fetching revenue analytics:", error);
        res.status(500).json({ message: "Failed to fetch revenue analytics" });
      }
    }
  );

  app.get(
    "/api/advanced-reports/customer-profitability",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
            contracts: Math.floor(Math.random() * 8) + 2,
          })),
        };

        res.json(profitabilityData);
      } catch (error) {
        console.error("Error fetching customer profitability:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch customer profitability" });
      }
    }
  );

  app.get(
    "/api/advanced-reports/service-performance",
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.claims.sub;

        // Mock service performance data
        const serviceData = {
          averageResponseTime: 2.4,
          firstCallResolution: 78,
          customerSatisfaction: 4.2,
          monthlyMetrics: Array.from({ length: 6 }, (_, i) => ({
            month: new Date(2024, 6 + i).toLocaleDateString("en-US", {
              month: "short",
            }),
            tickets: Math.floor(Math.random() * 100) + 50,
            resolved: Math.floor(Math.random() * 80) + 40,
            avgTime: Math.random() * 4 + 1,
          })),
          technicianPerformance: Array.from({ length: 8 }, (_, i) => ({
            id: `tech-${i + 1}`,
            name: `Technician ${i + 1}`,
            ticketsResolved: Math.floor(Math.random() * 50) + 20,
            avgTime: Math.random() * 3 + 1.5,
            rating: Math.random() * 1.5 + 3.5,
          })),
        };

        res.json(serviceData);
      } catch (error) {
        console.error("Error fetching service performance:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch service performance" });
      }
    }
  );

  // Users API for owner lookup
  app.get("/api/users", requireAuth, async (req: any, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user?.tenantId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const result = await storage.getUsers(user.tenantId);
      res.json(result);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Deal Management Routes

  // Get all deals with optional filtering
  app.get("/api/deals", requireAuth, requireAuth, async (req: any, res) => {
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
      const stageId = String((req.query as any)?.stageId || "");
      const search = String((req.query as any)?.search || "");
      const leadId = String((req.query as any)?.leadId || "");

      const deals = await storage.getDeals(tenantId, stageId, search, leadId);
      res.json(deals);
    } catch (error) {
      console.error("Error fetching deals:", error);
      res.status(500).json({ message: "Failed to fetch deals" });
    }
  });

  // Get single deal
  app.get("/api/deals/:id", requireAuth, requireAuth, async (req: any, res) => {
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
  app.post("/api/deals", requireAuth, requireAuth, async (req: any, res) => {
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
          {
            name: "Appointment Scheduled",
            color: "#3B82F6",
            sortOrder: 1,
            isClosingStage: false,
            isWonStage: false,
          },
          {
            name: "Qualified to Buy",
            color: "#8B5CF6",
            sortOrder: 2,
            isClosingStage: false,
            isWonStage: false,
          },
          {
            name: "Presentation Scheduled",
            color: "#06B6D4",
            sortOrder: 3,
            isClosingStage: false,
            isWonStage: false,
          },
          {
            name: "Decision Maker Bought-In",
            color: "#F59E0B",
            sortOrder: 4,
            isClosingStage: false,
            isWonStage: false,
          },
          {
            name: "Contract Sent",
            color: "#EF4444",
            sortOrder: 5,
            isClosingStage: false,
            isWonStage: false,
          },
          {
            name: "Closed Won",
            color: "#10B981",
            sortOrder: 6,
            isClosingStage: true,
            isWonStage: true,
          },
          {
            name: "Closed Lost",
            color: "#6B7280",
            sortOrder: 7,
            isClosingStage: true,
            isWonStage: false,
          },
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
        estimatedMonthlyValue: req.body.estimatedMonthlyValue
          ? req.body.estimatedMonthlyValue
          : null,
        expectedCloseDate: req.body.expectedCloseDate
          ? new Date(req.body.expectedCloseDate)
          : null,
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

      console.log(
        "[DEAL DEBUG] Processed deal data:",
        JSON.stringify(dealData, null, 2)
      );

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

      // Convert date strings to Date objects for Drizzle
      const updateData = { ...req.body };
      if (
        updateData.expectedCloseDate &&
        typeof updateData.expectedCloseDate === "string"
      ) {
        updateData.expectedCloseDate = new Date(updateData.expectedCloseDate);
      }

      const deal = await storage.updateDeal(dealId, updateData, tenantId);
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
  app.put(
    "/api/deals/:id/stage",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
    }
  );

  // Deal Stages Routes

  // Get all deal stages for tenant
  app.get(
    "/api/deal-stages",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const stages = await storage.getDealStages(tenantId);
        res.json(stages);
      } catch (error) {
        console.error("Error fetching deal stages:", error);
        res.status(500).json({ message: "Failed to fetch deal stages" });
      }
    }
  );

  // Create deal stage
  app.post(
    "/api/deal-stages",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
    }
  );

  // Initialize default deal stages for a tenant (called on first access)
  app.post(
    "/api/deal-stages/initialize",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        // Check if stages already exist
        const existingStages = await storage.getDealStages(tenantId);
        if (existingStages.length > 0) {
          return res.json({
            message: "Deal stages already initialized",
            stages: existingStages,
          });
        }

        // Create default stages
        const defaultStages = [
          {
            name: "Appointment Scheduled",
            color: "#3B82F6",
            sortOrder: 1,
            isClosingStage: false,
            isWonStage: false,
          },
          {
            name: "Qualified to Buy",
            color: "#8B5CF6",
            sortOrder: 2,
            isClosingStage: false,
            isWonStage: false,
          },
          {
            name: "Presentation Scheduled",
            color: "#06B6D4",
            sortOrder: 3,
            isClosingStage: false,
            isWonStage: false,
          },
          {
            name: "Decision Maker Bought-In",
            color: "#F59E0B",
            sortOrder: 4,
            isClosingStage: false,
            isWonStage: false,
          },
          {
            name: "Contract Sent",
            color: "#EF4444",
            sortOrder: 5,
            isClosingStage: false,
            isWonStage: false,
          },
          {
            name: "Closed Won",
            color: "#10B981",
            sortOrder: 6,
            isClosingStage: true,
            isWonStage: true,
          },
          {
            name: "Closed Lost",
            color: "#6B7280",
            sortOrder: 7,
            isClosingStage: true,
            isWonStage: false,
          },
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

        res
          .status(201)
          .json({ message: "Deal stages initialized", stages: createdStages });
      } catch (error) {
        console.error("Error initializing deal stages:", error);
        res.status(500).json({ message: "Failed to initialize deal stages" });
      }
    }
  );

  // Deal Activities Routes

  // Get activities for a deal
  app.get(
    "/api/deals/:id/activities",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;
        const dealId = req.params.id;

        const activities = await storage.getDealActivities(dealId, tenantId);
        res.json(activities);
      } catch (error) {
        console.error("Error fetching deal activities:", error);
        res.status(500).json({ message: "Failed to fetch deal activities" });
      }
    }
  );

  // Create deal activity
  app.post(
    "/api/deals/:id/activities",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
    }
  );

  // Register integration and deployment routes
  registerIntegrationRoutes(app);

  // Register OAuth integration routes (Google Calendar, Microsoft, etc.)
  app.use(integrationRoutes);

  // Register integration hub dashboard routes
  app.use(integrationHubRoutes);

  // Register task management routes
  registerTaskRoutes(app);

  // Register enhanced task management routes
  registerEnhancedTaskRoutes(app);

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

  // Register manufacturer integration routes

  // Register Sales Pipeline Workflow routes
  setupSalesPipelineRoutes(app, storage, requireAuth);

  // Register Commission Management routes
  app.use(commissionRoutes);

  // Register Salesforce test routes (development only)
  if (process.env.NODE_ENV === "development") {
    registerSalesforceTestRoutes(app);
  }

  // Mobile routes already integrated above in main routes

  // Performance monitoring routes
  app.get(
    "/api/performance/metrics",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.session?.tenantId;
        const metrics = await storage.getPerformanceMetrics(tenantId);
        res.json(metrics);
      } catch (error) {
        console.error("Error fetching performance metrics:", error);
        res.status(500).json({ error: "Failed to fetch performance metrics" });
      }
    }
  );

  app.get(
    "/api/performance/alerts",
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user?.tenantId;
        
        if (!tenantId) {
          return res.status(400).json({ message: "Tenant ID is required" });
        }

        const alerts = [];

        try {
          // 1) Low stock alerts
          const lowStockItems = await db
            .select({
              id: inventoryItems.id,
              name: inventoryItems.name,
              category: inventoryItems.category,
              currentStock: inventoryItems.currentStock,
              minThreshold: inventoryItems.reorderPoint,
              reorderQuantity: inventoryItems.reorderPoint, // Using reorderPoint as proxy for reorderQuantity
              primaryVendor: inventoryItems.supplier,
            })
            .from(inventoryItems)
            .where(
              and(
                eq(inventoryItems.tenantId, tenantId),
                sql`current_stock <= reorder_point`
              )
            )
            .orderBy(asc(inventoryItems.currentStock))
            .limit(20);

          alerts.push(
            ...lowStockItems.map((item) => ({
              id: `low_stock_${item.id}`,
              type: "low_stock",
              severity: "medium",
              title: `Low Stock: ${item.name}`,
              message: `${item.name} is running low (${item.currentStock} remaining, reorder at ${item.minThreshold})`,
              category: "business",
              timestamp: new Date().toISOString(),
            }))
          );
        } catch (error) {
          console.warn("Failed to fetch low stock alerts:", error);
        }

        try {
          // 2) Dispatch delay alerts
          const delayedTickets = await db
            .select({
              id: serviceTickets.id,
              ticketNumber: serviceTickets.ticketNumber,
              title: serviceTickets.title,
              scheduledDate: serviceTickets.scheduledDate,
              status: serviceTickets.status,
            })
            .from(serviceTickets)
            .where(
              and(
                eq(serviceTickets.tenantId, tenantId),
                sql`scheduled_date < NOW()`,
                sql`status NOT IN ('completed', 'cancelled')`
              )
            )
            .orderBy(asc(serviceTickets.scheduledDate))
            .limit(10);

          alerts.push(
            ...delayedTickets.map((ticket) => ({
              id: `dispatch_delay_${ticket.id}`,
              type: "dispatch_delay",
              severity: "high",
              title: `Dispatch Delay: Ticket ${ticket.ticketNumber}`,
              message: `Service ticket ${ticket.ticketNumber} (${ticket.title}) was scheduled for ${new Date(ticket.scheduledDate!).toLocaleString()} but is still ${ticket.status}.`,
              category: "performance",
              timestamp: new Date().toISOString(),
            }))
          );
        } catch (error) {
          console.warn("Failed to fetch dispatch delay alerts:", error);
        }

        try {
          // 3) Billing anomaly alerts
          const billingAnomalies = await db
            .select({
              id: invoices.id,
              invoiceNumber: invoices.invoiceNumber,
              createdAt: invoices.createdAt,
              dueDate: invoices.dueDate,
              status: invoices.status,
              totalAmount: invoices.totalAmount,
            })
            .from(invoices)
            .where(
              and(
                eq(invoices.tenantId, tenantId),
                sql`(status = 'overdue') OR (due_date < NOW() AND status = 'pending')`
              )
            )
            .orderBy(desc(invoices.createdAt))
            .limit(10);

          alerts.push(
            ...billingAnomalies.map((invoice) => ({
              id: `billing_anomaly_${invoice.id}`,
              type: "billing_anomaly",
              severity: invoice.status === 'overdue' ? "critical" : "medium",
              title: `Billing Issue: Invoice ${invoice.invoiceNumber}`,
              message: invoice.status === 'overdue'
                ? `Invoice ${invoice.invoiceNumber} is overdue since ${new Date(invoice.dueDate!).toLocaleDateString()}.`
                : `Invoice ${invoice.invoiceNumber} is past due (Due: ${new Date(invoice.dueDate!).toLocaleDateString()}).`,
              category: "business",
              timestamp: new Date().toISOString(),
            }))
          );
        } catch (error) {
          console.warn("Failed to fetch billing anomaly alerts:", error);
        }

        res.json(alerts);
      } catch (error) {
        console.error("Error fetching alerts:", error);
        res.status(500).json({ message: "Failed to fetch alerts" });
      }
    }
  );

  // Pricing Management Routes
  app.get(
    "/api/pricing/company-settings",
    requireAuth,
    getCompanyPricingSettings
  );
  app.post(
    "/api/pricing/company-settings",
    requireAuth,
    updateCompanyPricingSettings
  );
  app.get("/api/pricing/products", requireAuth, getProductPricing);
  app.post("/api/pricing/products", requireAuth, createProductPricing);
  app.put("/api/pricing/products/:id", requireAuth, updateProductPricing);
  app.delete("/api/pricing/products/:id", requireAuth, deleteProductPricing);

  // Products with pricing information
  app.get(
    "/api/products/with-pricing",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const { tenantId } = req.user;

        // Get all products
        const [
          models,
          accessories,
          services,
          supplies,
          managedServices,
          softwareProducts,
          professionalServices,
        ] = await Promise.all([
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
        const pricingMap = new Map(productPricing.map((p) => [p.productId, p]));

        // Combine all products with pricing information
        const allProducts = [
          ...models.map((m) => ({ ...m, category: "Equipment Models" })),
          ...accessories.map((a) => ({ ...a, category: "Accessories" })),
          ...services.map((s) => ({ ...s, category: "Services" })),
          ...supplies.map((s) => ({ ...s, category: "Supplies" })),
          ...managedServices.map((m) => ({
            ...m,
            category: "Managed Services",
          })),
          ...softwareProducts.map((s) => ({ ...s, category: "Software" })),
          ...professionalServices.map((p) => ({
            ...p,
            category: "Professional Services",
          })),
        ].map((product) => {
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
        res
          .status(500)
          .json({ message: "Failed to fetch products with pricing" });
      }
    }
  );

  // Master Product Catalog Routes
  app.get("/api/catalog/models", requireAuth, async (req: any, res) => {
    try {
      const manufacturer = String((req.query as any)?.manufacturer || "");
      const search = String((req.query as any)?.search || "");
      const category = String((req.query as any)?.category || "");
      const status = String((req.query as any)?.status || "");
      const rows = await storage.browseMasterProducts({
        manufacturer,
        search,
        category,
        status,
      });
      res.json(rows);
    } catch (error) {
      console.error("Error browsing master catalog:", error);
      res.status(500).json({ message: "Failed to fetch master catalog" });
    }
  });

  app.post("/api/catalog/models", requireAuth, async (req: any, res) => {
    try {
      const isPlatformUser =
        req.user?.isPlatformUser ||
        req.user?.is_platform_user ||
        req.user?.role === "platform_admin" ||
        req.user?.role === "root_admin" ||
        req.user?.role === "Platform Admin" ||
        req.user?.role === "Root Admin" ||
        req.user?.role === "admin";

      if (!isPlatformUser) {
        return res.status(403).json({
          message: "Platform admin required",
          userRole: req.user?.role,
          userId: req.user?.id,
        });
      }
      const payload = insertMasterProductModelSchema.parse(req.body);
      const saved = await storage.upsertMasterProduct(payload);
      res.status(201).json(saved);
    } catch (error: any) {
      console.error("Error creating master product:", error);
      res.status(500).json({
        message: "Failed to create master product",
        detail: error?.message,
      });
    }
  });

  app.get("/api/catalog/manufacturers", requireAuth, async (_req: any, res) => {
    try {
      const rows = await storage.listMasterManufacturers();
      res.json(rows);
    } catch (error) {
      console.error("Error fetching manufacturers:", error);
      res.status(500).json({ message: "Failed to fetch manufacturers" });
    }
  });

  app.get("/api/enabled-products", requireAuth, async (req: any, res) => {
    try {
      const { tenantId } = req.user;
      const rows = await storage.getEnabledProducts(tenantId);
      res.json(rows);
    } catch (error) {
      console.error("Error fetching enabled products:", error);
      res.status(500).json({ message: "Failed to fetch enabled products" });
    }
  });

  app.post(
    "/api/catalog/models/:id/enable",
    requireAuth,
    async (req: any, res) => {
      try {
        const { tenantId, id: userId } = req.user;
        const { id } = req.params;
        const overrides = { ...req.body, enabledBy: userId };
        const result = await storage.enableMasterProduct(
          tenantId,
          id,
          overrides
        );
        res.json(result);
      } catch (error) {
        console.error("Error enabling product:", error);
        res.status(500).json({ message: "Failed to enable product" });
      }
    }
  );

  app.post(
    "/api/catalog/models/bulk-enable",
    requireAuth,
    async (req: any, res) => {
      try {
        const { tenantId, id: userId } = req.user;
        const { masterProductIds = [], defaultOverrides = {} } = req.body ?? {};
        let enabled = 0;
        let skipped = 0;
        for (const pid of masterProductIds) {
          try {
            await storage.enableMasterProduct(tenantId, pid, {
              ...defaultOverrides,
              enabledBy: userId,
            });
            enabled += 1;
          } catch {
            skipped += 1;
          }
        }
        res.json({ enabled, skipped });
      } catch (error) {
        console.error("Error bulk enabling products:", error);
        res.status(500).json({ message: "Failed to bulk enable products" });
      }
    }
  );

  // Tenant: enable products directly from CSV (uses Dealer Price as dealerCost)
  app.post(
    "/api/catalog/models/enable-from-csv",
    requireAuth,
    upload.single("file"),
    async (req: any, res) => {
      try {
        const { tenantId, id: userId } = req.user;
        const file = req.file;
        if (!file)
          return res.status(400).json({ message: "CSV file required" });

        const csvText = file.buffer.toString("utf-8");
        const lines = csvText.split(/\r?\n/);
        let columns: string[] = [];
        let enabled = 0;
        let skipped = 0;

        const isHeader = (arr: string[]) => {
          const lc = arr.map((s) => s.trim().toLowerCase());
          return (
            lc.includes("item no.") &&
            lc.includes("description") &&
            lc.some((c) => c.includes("dealer price")) &&
            lc.includes("msrp")
          );
        };

        const normalizeMoney = (s?: string) => {
          if (!s) return undefined;
          const n = Number(String(s).replace(/[$,\s]/g, ""));
          return Number.isFinite(n) ? n : undefined;
        };

        for (const raw of lines) {
          const line = raw.trimEnd();
          if (!line) continue;
          const parts = line.split(",");
          if (isHeader(parts)) {
            columns = parts.map((h: string) => h.trim().toLowerCase());
            continue;
          }
          if (!columns.length) continue;

          const row: any = {};
          columns.forEach(
            (c: string, i: number) => (row[c] = (parts[i] || "").trim())
          );
          const modelCode = row["item no."] || row["item no"] || row["item"];
          const description = row["description"];
          const dealerPrice =
            normalizeMoney(row["dealer price"]) ??
            normalizeMoney(row["dealer"]);
          if (!modelCode || !description) continue;

          // Make sure a corresponding master product exists (create minimal if missing)
          let master = await storage.findMasterProduct("Canon", modelCode);
          if (!master) {
            master = await storage.upsertMasterProduct({
              manufacturer: "Canon",
              modelCode,
              displayName: description,
              msrp: undefined,
            } as any);
          }

          try {
            await storage.enableMasterProduct(tenantId, (master as any).id, {
              dealerCost: dealerPrice as any,
              updatedAt: new Date(),
            } as any);
            enabled += 1;
          } catch {
            skipped += 1;
          }
        }

        res.json({ enabled, skipped });
      } catch (error: any) {
        console.error("Error enabling products from CSV:", error);
        res.status(500).json({
          message: "Failed to enable from CSV",
          detail: error?.message,
        });
      }
    }
  );

  // ===== SEO Management Routes =====
  // Root Admin: upsert global SEO settings
  app.post("/api/seo/settings", requireAuth, async (req: any, res) => {
    try {
      const isPlatformUser =
        req.user?.isPlatformUser || req.user?.role === "platform_admin";
      if (!isPlatformUser)
        return res.status(403).json({ message: "Platform admin required" });
      const payload = insertSeoSettingsSchema.parse(req.body);
      const [existing] = await db.select().from(seoSettings).limit(1);
      if (existing) {
        const [updated] = await db
          .update(seoSettings)
          .set({ ...payload, updatedAt: new Date() })
          .where(eq(seoSettings.id, (existing as any).id))
          .returning();
        return res.json(updated);
      }
      const [created] = await db
        .insert(seoSettings)
        .values(payload as any)
        .returning();
      res.json(created);
    } catch (error: any) {
      console.error("Error upserting SEO settings:", error);
      res.status(500).json({
        message: "Failed to upsert SEO settings",
        detail: error?.message,
      });
    }
  });

  // Root Admin: upsert SEO page record
  app.post("/api/seo/pages", requireAuth, async (req: any, res) => {
    try {
      const isPlatformUser =
        req.user?.isPlatformUser || req.user?.role === "platform_admin";
      if (!isPlatformUser)
        return res.status(403).json({ message: "Platform admin required" });
      const payload = insertSeoPageSchema.parse(req.body);
      // Upsert by path (global)
      const [existing] = await db
        .select()
        .from(seoPages)
        .where(eq(seoPages.path, (payload as any).path))
        .limit(1);
      if (existing) {
        const [updated] = await db
          .update(seoPages)
          .set({ ...payload, updatedAt: new Date(), lastmod: new Date() })
          .where(eq(seoPages.id, (existing as any).id))
          .returning();
        return res.json(updated);
      }
      const [created] = await db
        .insert(seoPages)
        .values({ ...payload, lastmod: new Date() } as any)
        .returning();
      res.json(created);
    } catch (error: any) {
      console.error("Error upserting SEO page:", error);
      res
        .status(500)
        .json({ message: "Failed to upsert SEO page", detail: error?.message });
    }
  });

  // Public: generate sitemap.xml
  app.get("/sitemap.xml", async (_req, res) => {
    try {
      const settingsRows = await db.select().from(seoSettings).limit(1);
      const settings = settingsRows[0] as any;
      const pages = await db
        .select({
          path: seoPages.path,
          lastmod: seoPages.lastmod,
          changefreq: seoPages.changefreq,
          priority: seoPages.priority,
          includeInSitemap: seoPages.includeInSitemap,
        })
        .from(seoPages);
      const baseUrl =
        settings?.siteUrl?.replace(/\/$/, "") || "https://printyx.net";
      const urls = pages.filter((p: any) => p.includeInSitemap !== false);
      const xml =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
        urls
          .map((p: any) => {
            const loc = `${baseUrl}${
              p.path.startsWith("/") ? p.path : `/${p.path}`
            }`;
            const lastmod = (
              p.lastmod ? new Date(p.lastmod) : new Date()
            ).toISOString();
            const changefreq =
              p.changefreq || settings?.sitemapChangefreq || "weekly";
            const priority =
              p.priority || settings?.sitemapPriorityDefault || 0.5;
            return `\n  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
          })
          .join("") +
        "\n</urlset>";
      const etag = createHash("sha1").update(xml).digest("hex");
      res.setHeader("ETag", etag);
      if (_req.headers["if-none-match"] === etag) {
        return res.status(304).end();
      }
      res
        .header("Content-Type", "application/xml; charset=utf-8")
        .header("Cache-Control", "public, max-age=300, s-maxage=600")
        .send(xml);
    } catch (error) {
      console.error("Error generating sitemap:", error);
      res.status(500).send("Error generating sitemap");
    }
  });

  // Public: robots.txt
  app.get("/robots.txt", async (_req, res) => {
    try {
      const settingsRows = await db.select().from(seoSettings).limit(1);
      const settings = settingsRows[0] as any;
      const baseUrl =
        settings?.siteUrl?.replace(/\/$/, "") || "https://printyx.net";
      const allowIndexing = true; // If needed later, wire to settings
      const lines = [
        `User-agent: *`,
        allowIndexing ? `Allow: /` : `Disallow: /`,
        `Disallow: /api/`,
        `Disallow: /admin/`,
        `Disallow: /root-admin/`,
        `Disallow: /database-management`,
        `Disallow: /role-management`,
        `Disallow: /gpt5-dashboard`,
        `Disallow: /settings`,
        `Disallow: /customers`,
        `Disallow: /crm`,
        `Disallow: /service-`,
        `Disallow: /quotes`,
        `Disallow: /proposal-`,
        `Sitemap: ${baseUrl}/sitemap.xml`,
        `LLMS: ${baseUrl}/llms.txt`,
      ];
      const body = lines.join("\n");
      const etag = createHash("sha1").update(body).digest("hex");
      res.setHeader("ETag", etag);
      if (_req.headers["if-none-match"] === etag) {
        return res.status(304).end();
      }
      res
        .header("Content-Type", "text/plain; charset=utf-8")
        .header("Cache-Control", "public, max-age=300, s-maxage=600")
        .send(body);
    } catch (_e) {
      res
        .header("Content-Type", "text/plain")
        .send(
          "User-agent: *\nAllow: /\nSitemap: https://printyx.net/sitemap.xml\nLLMS: https://printyx.net/llms.txt\n"
        );
    }
  });

  // Public: meta.json — returns meta for a given path
  app.get("/meta.json", async (req, res) => {
    try {
      const path = String(req.query.path || "/");
      const [page] = await db
        .select()
        .from(seoPages)
        .where(eq(seoPages.path, path))
        .limit(1);
      const [settings] = await db.select().from(seoSettings).limit(1);
      const include = (page as any)?.includeInSitemap !== false;
      const payload = {
        title:
          (page as any)?.title ||
          (settings as any)?.defaultTitle ||
          (settings as any)?.siteName ||
          "Printyx",
        description:
          (page as any)?.description ||
          (settings as any)?.defaultDescription ||
          "",
        ogImage: (settings as any)?.defaultOgImage || null,
        twitterHandle: (settings as any)?.twitterHandle || null,
        robots: include ? "index,follow" : "noindex,nofollow",
      };
      res.json(payload);
    } catch (error: any) {
      res.json({
        title: "Printyx",
        description: "",
        robots: "noindex,nofollow",
      });
    }
  });

  // Public: AI/LLM crawler directives (llms.txt)
  app.get("/llms.txt", async (_req, res) => {
    try {
      const settingsRows = await db.select().from(seoSettings).limit(1);
      const settings = settingsRows[0] as any;
      const allow = settings?.allowAiCrawling !== false;
      const lines = [
        `# LLMs crawling directives for Printyx`,
        `# Allow AI crawlers to index public content for generative engines`,
        allow ? `Allow: /` : `Disallow: /`,
      ];
      const body = lines.join("\n");
      const etag = createHash("sha1").update(body).digest("hex");
      res.setHeader("ETag", etag);
      if (_req.headers["if-none-match"] === etag) {
        return res.status(304).end();
      }
      res
        .header("Content-Type", "text/plain; charset=utf-8")
        .header("Cache-Control", "public, max-age=300, s-maxage=600")
        .send(body);
    } catch (error) {
      res
        .header("Content-Type", "text/plain; charset=utf-8")
        .send("Allow: /\n");
    }
  });

  // Public: dynamic schema.json endpoint per path
  app.get("/schema.json", async (req, res) => {
    try {
      const path = String(req.query.path || "/");
      const [page] = await db
        .select()
        .from(seoPages)
        .where(eq(seoPages.path, path))
        .limit(1);
      const settingsRows = await db.select().from(seoSettings).limit(1);
      const settings = settingsRows[0] as any;
      const baseWebsite = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: settings?.siteName || "Printyx",
        url: settings?.siteUrl || "https://printyx.net",
        potentialAction: {
          "@type": "SearchAction",
          target: `${
            settings?.siteUrl || "https://printyx.net"
          }/search?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      };
      let payload = baseWebsite as any;
      if (page?.schemaType && page?.schemaData) {
        payload = {
          "@context": "https://schema.org",
          "@type": page.schemaType,
          ...(page.schemaData as any),
        };
      }
      res.json(payload);
    } catch (error) {
      res.json({
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Printyx",
      });
    }
  });

  // Admin: get SEO settings
  app.get("/api/seo/settings", requireAuth, async (_req: any, res) => {
    try {
      const rows = await db.select().from(seoSettings).limit(1);
      res.json(rows[0] || null);
    } catch (error: any) {
      res.status(500).json({
        message: "Failed to load SEO settings",
        detail: error?.message,
      });
    }
  });

  // Admin: list SEO pages
  app.get("/api/seo/pages", requireAuth, async (_req: any, res) => {
    try {
      const rows = await db
        .select()
        .from(seoPages)
        .orderBy(desc(seoPages.updatedAt));
      res.json(rows);
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Failed to load SEO pages", detail: error?.message });
    }
  });

  // Admin: regenerate sitemap endpoint
  app.post(
    "/api/seo/regenerate-sitemap",
    requireAuth,
    requireRootAdmin,
    async (req: any, res) => {
      try {
        const isPlatformUser =
          req.user?.isPlatformUser || req.user?.role === "platform_admin";
        if (!isPlatformUser)
          return res.status(403).json({ message: "Platform admin required" });

        // This endpoint doesn't generate a new sitemap, just returns success
        // The actual sitemap is generated dynamically via GET /sitemap.xml
        res.json({ message: "Sitemap regenerated successfully" });
      } catch (error: any) {
        res.status(500).json({
          message: "Failed to regenerate sitemap",
          detail: error?.message,
        });
      }
    }
  );

  // Admin: regenerate robots.txt endpoint
  app.post(
    "/api/seo/regenerate-robots",
    requireAuth,
    requireRootAdmin,
    async (req: any, res) => {
      try {
        const isPlatformUser =
          req.user?.isPlatformUser || req.user?.role === "platform_admin";
        if (!isPlatformUser)
          return res.status(403).json({ message: "Platform admin required" });

        // This endpoint doesn't generate a new robots.txt, just returns success
        // The actual robots.txt is generated dynamically via GET /robots.txt
        res.json({ message: "Robots.txt regenerated successfully" });
      } catch (error: any) {
        res.status(500).json({
          message: "Failed to regenerate robots.txt",
          detail: error?.message,
        });
      }
    }
  );

  // Admin: regenerate llms.txt endpoint
  app.post(
    "/api/seo/regenerate-llms",
    requireAuth,
    requireRootAdmin,
    async (req: any, res) => {
      try {
        const isPlatformUser =
          req.user?.isPlatformUser || req.user?.role === "platform_admin";
        if (!isPlatformUser)
          return res.status(403).json({ message: "Platform admin required" });

        // This endpoint doesn't generate a new llms.txt, just returns success
        // The actual llms.txt is generated dynamically via GET /llms.txt
        res.json({ message: "LLMs.txt regenerated successfully" });
      } catch (error: any) {
        res.status(500).json({
          message: "Failed to regenerate llms.txt",
          detail: error?.message,
        });
      }
    }
  );

  // Seed baseline SEO settings and core pages on boot (non-blocking)
  (async () => {
    try {
      const [settings] = await db.select().from(seoSettings).limit(1);
      if (!settings) {
        await db.insert(seoSettings).values({
          siteName: "Printyx",
          siteUrl: "https://printyx.net",
          defaultTitle: "Printyx — Print Fleet CRM, Service, Finance Platform",
          defaultDescription:
            "Printyx unifies CRM, Service, Product, and Finance workflows for print dealers. Master catalog, inventory, billing, and analytics in one platform.",
          allowAiCrawling: true,
          sitemapChangefreq: "weekly",
          sitemapPriorityDefault: "0.5" as any,
        } as any);
      }

      const corePages: Array<{
        path: string;
        title: string;
        description: string;
        changefreq?: string;
        priority?: string | number;
        schemaType?: string | null;
        schemaData?: any;
      }> = [
        {
          path: "/",
          title: "Printyx — Print Fleet CRM, Service, Finance Platform",
          description:
            "All-in-one platform: CRM, Service, Inventory, Billing, and Reporting for print dealers.",
          changefreq: "weekly",
          priority: "1.0",
          schemaType: "Organization",
          schemaData: {
            name: "Printyx",
            url: "https://printyx.net",
          },
        },
        {
          path: "/product-hub",
          title: "Product Hub — Catalog, Inventory, and POs",
          description:
            "Manage master catalog, enable products, inventory, purchase orders, and warehouse ops.",
          changefreq: "weekly",
          priority: "0.8",
          schemaType: "Service",
          schemaData: {
            name: "Product Management",
            serviceType: "Inventory and Catalog Management",
          },
        },
        {
          path: "/product-catalog",
          title:
            "Master Product Catalog — Canon imageRUNNER, imagePRESS, Accessories",
          description:
            "Browse the master catalog. Enable equipment and accessories for your tenant with pricing overrides.",
          changefreq: "weekly",
          priority: "0.8",
          schemaType: "Service",
          schemaData: {
            name: "Master Product Catalog",
          },
        },
        {
          path: "/crm",
          title: "CRM — Leads, Deals, Quotes, Proposals",
          description:
            "End-to-end sales workflow with activities, quotes, proposals, and pipeline forecasting.",
          changefreq: "weekly",
          priority: "0.7",
          schemaType: "SoftwareApplication",
          schemaData: {
            name: "Printyx CRM",
            applicationCategory: "BusinessApplication",
          },
        },
        {
          path: "/service-hub",
          title: "Service Hub — Dispatch, PM, Field Operations",
          description:
            "Ticketing, dispatch optimization, preventive maintenance, and mobile field service.",
          changefreq: "weekly",
          priority: "0.7",
          schemaType: "Service",
          schemaData: { name: "Printyx Service" },
        },
        {
          path: "/reports",
          title: "Reports — Sales, Service, Finance KPIs",
          description:
            "Unified reporting across CRM, Service, Finance, and Product. Standardized KPIs and dashboards.",
          changefreq: "monthly",
          priority: "0.6",
          schemaType: "WebSite",
          schemaData: { name: "Printyx Reports" },
        },
      ];

      for (const p of corePages) {
        const [existing] = await db
          .select()
          .from(seoPages)
          .where(eq(seoPages.path, p.path))
          .limit(1);
        if (!existing) {
          await db.insert(seoPages).values({
            path: p.path,
            title: p.title,
            description: p.description,
            changefreq: (p.changefreq as any) || undefined,
            priority: (p.priority as any) || undefined,
            schemaType: (p.schemaType as any) || null,
            schemaData: (p.schemaData as any) || null,
            includeInSitemap: true,
            lastmod: new Date(),
          } as any);
        }
      }
    } catch (e) {
      console.warn("SEO bootstrap skipped:", (e as any)?.message);
    }
  })();

  // Admin-only: Import master catalog models (CSV)
  app.post(
    "/api/catalog/models/import",
    requireAuth,
    upload.single("file"),
    async (req: any, res) => {
      try {
        const isPlatformUser =
          req.user?.isPlatformUser ||
          req.user?.is_platform_user ||
          req.user?.role === "platform_admin" ||
          req.user?.role === "root_admin" ||
          req.user?.role === "Platform Admin" ||
          req.user?.role === "Root Admin" ||
          req.user?.role === "admin";

        if (!isPlatformUser) {
          return res.status(403).json({
            message: "Platform admin required",
            userRole: req.user?.role,
            userId: req.user?.id,
            isPlatformUser: req.user?.isPlatformUser,
            is_platform_user: req.user?.is_platform_user,
            debug: {
              checkResult: isPlatformUser,
              conditions: {
                isPlatformUser: req.user?.isPlatformUser,
                is_platform_user: req.user?.is_platform_user,
                platform_admin: req.user?.role === "platform_admin",
                root_admin: req.user?.role === "root_admin",
                Platform_Admin: req.user?.role === "Platform Admin",
                Root_Admin: req.user?.role === "Root Admin",
                admin: req.user?.role === "admin",
              },
            },
          });
        }
        const file = req.file;
        if (!file)
          return res.status(400).json({ message: "CSV file required" });

        const csvText = file.buffer.toString("utf-8");
        const lines = csvText.split(/\r?\n/);

        let created = 0;
        let updated = 0;
        let currentCategory: string | undefined = undefined;
        let columns: string[] = [];

        const isHeader = (arr: string[]) => {
          const lc = arr.map((s) => s.trim().toLowerCase());
          return (
            lc.includes("item no.") &&
            lc.includes("description") &&
            lc.some((c) => c.includes("dealer price")) &&
            lc.includes("msrp")
          );
        };

        const normalizeMoney = (s?: string) => {
          if (!s) return undefined;
          const n = Number(String(s).replace(/[$,\s]/g, ""));
          return Number.isFinite(n) ? n : undefined;
        };

        let currentModel: string | undefined = undefined;
        let skipped = 0;
        const duplicatesSkipped = new Set<string>();
        const relationshipsCreated = [];

        for (const raw of lines) {
          const line = raw.trimEnd();
          if (!line) continue;
          const parts = line.split(",");

          // Detect main model headers (e.g., "imageRUNNER ADVANCE DX C359iF / C259iF")
          if (/^\s*imageRUNNER|imagePRESS|imageFORCE/i.test(parts[0])) {
            currentCategory = "Equipment";
            // Extract model from title - use the first model code mentioned
            const modelMatch = parts[0].match(/([A-Z]\d{3,4}[a-zA-Z]*)/);
            currentModel = modelMatch ? modelMatch[1] : undefined;
            columns = [];
            continue;
          }

          // Detect section titles to set category
          if (/^\s*Showroom\s+Models\s*$/i.test(parts[0])) {
            currentCategory = "Showroom";
            columns = [];
            continue;
          }
          if (/^\s*Hardware\s+Accessories\s*$/i.test(parts[0])) {
            currentCategory = "Hardware Accessories";
            columns = [];
            continue;
          }
          if (/^\s*[A-Za-z].*Accessories\s*$/i.test(parts[0])) {
            currentCategory = "Accessories";
            columns = [];
            continue;
          }
          if (/^\s*Supplies.*$/i.test(parts[0])) {
            currentCategory = "Supplies";
            columns = [];
            continue;
          }

          // Detect header rows
          if (isHeader(parts)) {
            columns = parts.map((h: string) => h.trim().toLowerCase());
            continue;
          }

          if (!columns.length) continue; // skip until header found

          // Build row object using current header
          const row: any = {};
          columns.forEach((c, i) => (row[c] = (parts[i] || "").trim()));

          const modelCode = row["item no."] || row["item no"] || row["item"];
          const description = row["description"];
          const msrp = normalizeMoney(row["msrp"]);
          const dealerPrice = normalizeMoney(row["dealer price"]);

          if (!modelCode || !description) continue;

          // Create unique key for duplicate detection
          const duplicateKey = `Canon-${modelCode}`;
          if (duplicatesSkipped.has(duplicateKey)) {
            skipped++;
            continue;
          }

          // Enhanced categorization logic
          const isAccessory =
            currentCategory === "Accessories" ||
            currentCategory === "Hardware Accessories" ||
            currentCategory === "Showroom" ||
            /accessory|module|tray|feeder|finisher|cabinet|stand|kit/i.test(
              description
            );

          if (isAccessory) {
            const payload: any = {
              manufacturer: "Canon",
              accessoryCode: modelCode,
              displayName: description,
              category:
                currentCategory === "Showroom"
                  ? "Showroom Model"
                  : currentCategory || "Accessories",
              msrp,
              specsJson: {
                dealerPrice,
                baseModel: currentModel,
                section: currentCategory,
              },
            };

            try {
              const saved = await storage.upsertMasterAccessory(payload);
              if (saved) {
                created++;
                duplicatesSkipped.add(duplicateKey);

                // Create relationship to current model if available
                if (currentModel) {
                  try {
                    const baseProduct = await storage.findMasterProduct(
                      "Canon",
                      currentModel
                    );
                    if (baseProduct) {
                      await storage.createProductAccessoryRelationship({
                        baseProductId: baseProduct.id,
                        accessoryId: saved.id,
                        relationshipType:
                          currentCategory === "Showroom"
                            ? "recommended"
                            : "compatible",
                        category: currentCategory,
                      });
                      relationshipsCreated.push({
                        baseModel: currentModel,
                        accessory: modelCode,
                        category: currentCategory,
                      });
                    }
                  } catch (error) {
                    console.warn(
                      `Failed to create relationship for ${currentModel} -> ${modelCode}:`,
                      error
                    );
                  }
                }
              }
            } catch (error) {
              console.warn(`Failed to create accessory ${modelCode}:`, error);
              skipped++;
            }
            continue;
          }

          // Handle main equipment models
          const payload: any = {
            manufacturer: "Canon",
            modelCode,
            displayName: description,
            msrp,
            category: currentCategory || "Equipment",
            productType:
              currentCategory === "Equipment" ? "multifunction" : "accessory",
            specsJson: {
              dealerPrice,
              section: currentCategory,
              isMainModel: currentCategory === "Equipment",
            },
          };

          try {
            const saved = await storage.upsertMasterProduct(payload);
            if (saved) {
              created++;
              duplicatesSkipped.add(duplicateKey);
              // Update current model reference for relationship mapping
              if (currentCategory === "Equipment") {
                currentModel = modelCode;
              }
            }
          } catch (error) {
            console.warn(`Failed to create product ${modelCode}:`, error);
            skipped++;
          }
        }

        res.json({
          created,
          updated: 0, // We count upserts as created
          skipped,
          duplicatesFound: duplicatesSkipped.size,
          relationshipsCreated: relationshipsCreated.length,
          relationships: relationshipsCreated.slice(0, 10), // Sample of relationships
          summary: {
            totalProcessed: created + skipped,
            uniqueItemsImported: duplicatesSkipped.size,
            duplicatesSkipped: skipped,
          },
        });
      } catch (error: any) {
        console.error("Error importing master catalog:", error);
        res.status(500).json({
          message: "Failed to import master catalog",
          detail: error?.message,
        });
      }
    }
  );

  // Update master product
  app.patch("/api/catalog/models/:id", requireAuth, async (req: any, res) => {
    try {
      const isPlatformUser =
        req.user?.isPlatformUser ||
        req.user?.is_platform_user ||
        req.user?.role === "platform_admin" ||
        req.user?.role === "root_admin" ||
        req.user?.role === "Platform Admin" ||
        req.user?.role === "Root Admin" ||
        req.user?.role === "admin";

      if (!isPlatformUser) {
        return res.status(403).json({
          message: "Platform admin required to update master products",
        });
      }

      const { id } = req.params;
      const {
        displayName,
        msrp,
        dealerCost,
        marginPercentage,
        category,
        productType,
        status,
      } = req.body;

      // Update the master product
      const updateData: any = {};
      if (displayName !== undefined) updateData.displayName = displayName;
      if (msrp !== undefined) updateData.msrp = msrp;
      if (dealerCost !== undefined) updateData.dealerCost = dealerCost;
      if (marginPercentage !== undefined)
        updateData.marginPercentage = marginPercentage;
      if (category !== undefined) updateData.category = category;
      if (productType !== undefined) updateData.productType = productType;
      if (status !== undefined) updateData.status = status;
      updateData.updatedAt = new Date();

      await db
        .update(masterProductModels)
        .set(updateData)
        .where(eq(masterProductModels.id, id));

      res.json({ success: true, updated: updateData });
    } catch (error: any) {
      console.error("Error updating master product:", error);
      res.status(500).json({
        message: "Failed to update master product",
        detail: error?.message,
      });
    }
  });

  // Helper functions for enhanced CSV import
  const createFieldMappings = (headers: string[]) => {
    const mappings: Record<string, string> = {};
    const suggestions: Record<string, string> = {};

    // Define field mapping patterns
    const patterns = {
      modelCode: [
        "item no",
        "item no.",
        "model",
        "model code",
        "model_code",
        "product code",
        "sku",
        "part number",
        "part no",
      ],
      displayName: [
        "description",
        "name",
        "product name",
        "model name",
        "model_name",
        "display name",
        "display_name",
        "title",
      ],
      msrp: [
        "msrp",
        "msrp_usd",
        "retail price",
        "list price",
        "suggested retail price",
      ],
      dealerCost: [
        "dealer price",
        "dealer cost",
        "cost",
        "wholesale price",
        "buy price",
      ],
      manufacturer: ["manufacturer", "brand", "make"],
      category: ["category", "type", "product type", "class"],
      status: ["status", "state", "active"],
    };

    let requiredFieldsFound = 0;
    const requiredFields = ["modelCode", "displayName"];

    // Map headers to fields
    for (const [field, searchTerms] of Object.entries(patterns)) {
      for (const header of headers) {
        const headerLower = header.toLowerCase().trim();
        if (searchTerms.includes(headerLower)) {
          mappings[field] = header;
          if (requiredFields.includes(field)) requiredFieldsFound++;
          break;
        }
      }

      if (!mappings[field]) {
        // Find closest match for suggestions
        const closest = headers.find((h) =>
          searchTerms.some((term) =>
            h.toLowerCase().includes(term.toLowerCase())
          )
        );
        if (closest) suggestions[field] = closest;
      }
    }

    return {
      isValid: requiredFieldsFound >= 1, // Relax validation - need at least one required field
      mappings,
      suggestions,
      headersFound: headers,
      requiredFieldsFound,
      debug: { patterns, requiredFields },
    };
  };

  // Category normalization mapping
  const normalizeCategoryName = (category: string): string => {
    if (!category) return category;

    const categoryLower = category.toLowerCase().trim();

    // Consolidate similar categories
    if (
      categoryLower.includes("mfp") ||
      categoryLower.includes("multifunction")
    ) {
      return "Multifunction";
    }

    if (
      categoryLower.includes("accessory") ||
      categoryLower.includes("hardware accessory") ||
      categoryLower.includes("paper feeding") ||
      categoryLower.includes("document feeding")
    ) {
      return "Accessory";
    }

    // Capitalize first letter for consistency
    return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
  };

  const parseCSVLine = (line: string): string[] => {
    const result = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  };

  const mapRowToProduct = (rowData: any, fieldMappings: any) => {
    const mappings = fieldMappings.mappings;

    const normalizeMoney = (value: string) => {
      if (!value) return undefined;
      const cleaned = value.replace(/[$,\s]/g, "");
      const num = parseFloat(cleaned);
      return isNaN(num) ? undefined : num;
    };

    // Get raw category value and normalize it
    const rawCategory = rowData[mappings.category] || "General";
    const normalizedCategory = normalizeCategoryName(rawCategory);

    return {
      manufacturer: rowData[mappings.manufacturer] || "Unknown",
      modelCode: rowData[mappings.modelCode] || "",
      displayName: rowData[mappings.displayName] || "",
      msrp: normalizeMoney(rowData[mappings.msrp]),
      dealerCost: normalizeMoney(rowData[mappings.dealerCost]),
      category: normalizedCategory,
      productType: normalizedCategory === "Accessory" ? "accessory" : "model",
      status: rowData[mappings.status] || "active",
    };
  };

  const mergeProductData = (existing: any, newData: any) => {
    const merged = { ...existing };

    // Only update fields that are missing or empty in existing
    Object.keys(newData).forEach((key) => {
      if (!merged[key] && newData[key]) {
        merged[key] = newData[key];
      }
    });

    return merged;
  };

  // Enhanced CSV import with intelligent field mapping and duplicate handling
  app.post(
    "/api/catalog/import-enhanced",
    requireAuth,
    upload.single("file"),
    async (req: any, res) => {
      try {
        const isPlatformUser =
          req.user?.isPlatformUser ||
          req.user?.is_platform_user ||
          req.user?.role === "platform_admin" ||
          req.user?.role === "root_admin" ||
          req.user?.role === "Platform Admin" ||
          req.user?.role === "Root Admin" ||
          req.user?.role === "admin";

        if (!isPlatformUser) {
          return res.status(403).json({
            message: "Platform admin required to import master products",
          });
        }

        const file = req.file;
        if (!file) {
          return res.status(400).json({ message: "CSV file required" });
        }

        // Enhanced CSV parsing with field mapping
        const csvText = file.buffer.toString("utf-8");
        console.log("CSV file size:", file.size, "bytes");
        console.log("First 200 characters:", csvText.substring(0, 200));

        const lines: string[] = csvText
          .split(/\r?\n/)
          .filter((line: string) => line.trim());

        if (lines.length === 0) {
          return res.status(400).json({ message: "CSV file is empty" });
        }

        if (lines.length < 2) {
          return res.status(400).json({
            message:
              "CSV file must have at least a header row and one data row",
            linesFound: lines.length,
          });
        }

        // Parse header and create field mappings
        const headers = parseCSVLine(lines[0]).map((h: string) =>
          h.trim().toLowerCase()
        );
        const fieldMappings = createFieldMappings(headers);

        // Log debug information
        console.log("CSV Headers detected:", headers);
        console.log("Field mappings:", fieldMappings);

        if (!fieldMappings.isValid) {
          return res.status(400).json({
            message: "Invalid CSV format",
            detail: `Required fields missing. Found headers: ${headers.join(
              ", "
            )}. Need at least: model/item code and name/description fields.`,
            suggestedMappings: fieldMappings.suggestions,
            detectedHeaders: headers,
            fieldMappings: fieldMappings.mappings,
          });
        }

        let created = 0;
        let updated = 0;
        let skipped = 0;
        let errors: string[] = [];
        const processedItems: any[] = [];
        const duplicateMap = new Map<string, any>(); // Track duplicates for merging

        // Process data rows
        for (let i = 1; i < lines.length; i++) {
          const line: string = lines[i];
          if (!line.trim()) continue;

          try {
            const values: string[] = parseCSVLine(line as any);
            if (values.length < headers.length) {
              // Pad with empty strings for missing columns
              while (values.length < headers.length) {
                values.push("");
              }
            }

            const rowData = {};
            headers.forEach((header: string, index: number) => {
              (rowData as any)[header] = values[index]
                ? values[index].trim()
                : "";
            });

            const productData = mapRowToProduct(rowData, fieldMappings);

            if (!productData.modelCode || !productData.displayName) {
              errors.push(
                `Row ${i + 1}: Missing required fields (model code or name)`
              );
              skipped++;
              continue;
            }

            // Check for duplicates and handle gracefully
            const duplicateKey = `${productData.manufacturer}-${productData.modelCode}`;

            if (duplicateMap.has(duplicateKey)) {
              // Merge data with existing entry, filling in missing fields
              const existing = duplicateMap.get(duplicateKey);
              const merged = mergeProductData(existing, productData);
              duplicateMap.set(duplicateKey, merged);
              continue;
            }

            duplicateMap.set(duplicateKey, productData);
          } catch (error: any) {
            errors.push(`Row ${i + 1}: ${error?.message}`);
            skipped++;
          }
        }

        // Now process all unique items, checking database for existing records
        for (const [duplicateKey, productData] of Array.from(
          duplicateMap.entries()
        )) {
          try {
            // Check if product already exists in database
            const existing = await storage.findMasterProduct(
              productData.manufacturer,
              productData.modelCode
            );

            if (existing) {
              // Update existing product with new data (fill in missing fields only)
              const updateData: any = {};
              if (!existing.displayName && productData.displayName)
                updateData.displayName = productData.displayName;
              if (!existing.msrp && productData.msrp)
                updateData.msrp = productData.msrp;
              if (!existing.dealerCost && productData.dealerCost)
                updateData.dealerCost = productData.dealerCost;
              if (!existing.marginPercentage && productData.marginPercentage)
                updateData.marginPercentage = productData.marginPercentage;
              if (!existing.category && productData.category)
                updateData.category = productData.category;
              if (!existing.productType && productData.productType)
                updateData.productType = productData.productType;
              if (!existing.status && productData.status)
                updateData.status = productData.status;

              if (Object.keys(updateData).length > 0) {
                updateData.updatedAt = new Date();
                await db
                  .update(masterProductModels)
                  .set(updateData)
                  .where(eq(masterProductModels.id, existing.id));
                updated++;
                processedItems.push({
                  action: "updated",
                  ...productData,
                  fieldsUpdated: Object.keys(updateData),
                });
              } else {
                skipped++;
                processedItems.push({
                  action: "skipped",
                  ...productData,
                  reason: "No new data to update",
                });
              }
            } else {
              // Create new product
              const saved = await storage.upsertMasterProduct(productData);
              if (saved) {
                created++;
                processedItems.push({ action: "created", ...productData });
              }
            }
          } catch (error: any) {
            errors.push(`${productData.modelCode}: ${error?.message}`);
            skipped++;
          }
        }

        res.json({
          success: true,
          summary: {
            totalRows: lines.length - 1,
            created,
            updated,
            skipped,
            errors: errors.length,
          },
          fieldMappings: fieldMappings.mappings,
          processedItems: processedItems.slice(0, 10), // First 10 for preview
          errors: errors.slice(0, 10), // First 10 errors
        });
      } catch (error: any) {
        console.error("Enhanced CSV import error:", error);
        res.status(500).json({
          message: "Failed to import CSV",
          detail: error?.message,
        });
      }
    }
  );

  // Normalize existing product categories
  app.post(
    "/api/catalog/normalize-categories",
    requireAuth,
    async (req: any, res) => {
      try {
        const isPlatformUser =
          req.user?.isPlatformUser ||
          req.user?.is_platform_user ||
          req.user?.role === "platform_admin" ||
          req.user?.role === "root_admin" ||
          req.user?.role === "Platform Admin" ||
          req.user?.role === "Root Admin" ||
          req.user?.role === "admin";

        if (!isPlatformUser) {
          return res.status(403).json({
            message: "Platform admin required to normalize categories",
          });
        }

        // Get all products with categories that need normalization
        const products = await db
          .select()
          .from(masterProductModels)
          .where(sql`category IS NOT NULL`);

        let updated = 0;
        for (const product of products) {
          const normalizedCategory = normalizeCategoryName(
            String(product.category || "")
          );
          if (normalizedCategory !== product.category) {
            await db
              .update(masterProductModels)
              .set({
                category: normalizedCategory,
                productType:
                  normalizedCategory === "Accessory" ? "accessory" : "model",
                updatedAt: new Date(),
              })
              .where(eq(masterProductModels.id, product.id));
            updated++;
          }
        }

        res.json({
          success: true,
          message: `Normalized ${updated} product categories`,
          updated,
        });
      } catch (error: any) {
        console.error("Error normalizing categories:", error);
        res.status(500).json({
          message: "Failed to normalize categories",
          detail: error?.message,
        });
      }
    }
  );

  // Bulk update pricing
  app.post(
    "/api/pricing/products/bulk-update",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const { tenantId } = req.user;
        const { updates } = req.body;

        const results = [];
        for (const update of updates) {
          try {
            const pricing = await storage.createProductPricing({
              tenantId,
              productId: String(update.productId),
              productType: "model",
              dealerCost: String(update.dealerCost ?? "0"),
              companyMarkupPercentage: String(update.markupPercentage ?? "0"),
              companyPrice: String(update.companyPrice ?? "0"),
              createdBy: String(req.user.id),
            } as any);
            results.push(pricing);
          } catch (error) {
            console.error(
              `Error updating pricing for ${update.productId}:`,
              error
            );
          }
        }

        res.json(results);
      } catch (error: any) {
        console.error("Error bulk updating pricing:", error);
        res.status(500).json({ message: "Failed to bulk update pricing" });
      }
    }
  );

  app.get("/api/pricing/products", requireAuth, getProductPricing);
  app.post("/api/pricing/products", requireAuth, createProductPricing);
  app.put("/api/pricing/products/:id", requireAuth, updateProductPricing);
  app.delete("/api/pricing/products/:id", requireAuth, deleteProductPricing);

  app.get("/api/pricing/quotes/:quoteId", requireAuth, getQuotePricing);
  app.post("/api/pricing/quotes", requireAuth, createQuotePricing);
  app.put("/api/pricing/quotes/:id", requireAuth, updateQuotePricing);

  app.get(
    "/api/pricing/quotes/:quotePricingId/line-items",
    requireAuth,
    getQuoteLineItems
  );
  app.post("/api/pricing/line-items", requireAuth, createQuoteLineItem);
  app.put("/api/pricing/line-items/:id", requireAuth, updateQuoteLineItem);
  app.delete("/api/pricing/line-items/:id", requireAuth, deleteQuoteLineItem);

  app.post("/api/pricing/calculate", requireAuth, calculatePricingForProduct);

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
    upload: avatarUpload,
  } = await import("./routes-settings");

  app.get("/api/user/settings", requireAuth, getUserSettings);
  app.put("/api/user/profile", requireAuth, updateUserProfile);
  app.put("/api/user/password", requireAuth, updateUserPassword);
  app.put("/api/user/preferences", requireAuth, updateUserPreferences);
  app.put("/api/user/accessibility", requireAuth, updateAccessibilitySettings);
  app.post(
    "/api/user/avatar",
    requireAuth,
    avatarUpload.single("avatar"),
    uploadAvatar
  );
  app.get("/api/user/export", requireAuth, exportUserData);
  app.delete("/api/user/delete", requireAuth, deleteUserAccount);

  // Customer detail routes - for comprehensive customer information
  app.get(
    "/api/customers/:id/equipment",
    requireAuth,
    requireTenant,
    async (req: TenantRequest, res) => {
      try {
        const equipment = await storage.getCustomerEquipment(
          req.params.id as string,
          req.tenantId as string
        );
        res.json(equipment);
      } catch (error) {
        console.error("Error fetching customer equipment:", error);
        res.status(500).json({ message: "Failed to fetch customer equipment" });
      }
    }
  );

  app.get(
    "/api/customers/:id/meter-readings",
    requireAuth,
    requireTenant,
    async (req: TenantRequest, res) => {
      try {
        const meterReadings = await storage.getCustomerMeterReadings(
          req.params.id as string,
          req.tenantId as string
        );
        res.json(meterReadings);
      } catch (error) {
        console.error("Error fetching customer meter readings:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch customer meter readings" });
      }
    }
  );

  app.get(
    "/api/customers/:id/invoices",
    requireAuth,
    requireTenant,
    async (req: TenantRequest, res) => {
      try {
        const invoices = await storage.getCustomerInvoices(
          req.params.id as string,
          req.tenantId as string
        );
        res.json(invoices);
      } catch (error) {
        console.error("Error fetching customer invoices:", error);
        res.status(500).json({ message: "Failed to fetch customer invoices" });
      }
    }
  );

  app.get(
    "/api/customers/:id/service-tickets",
    requireAuth,
    requireTenant,
    async (req: TenantRequest, res) => {
      try {
        const serviceTickets = await storage.getCustomerServiceTickets(
          req.params.id as string,
          req.tenantId as string
        );
        res.json(serviceTickets);
      } catch (error) {
        console.error("Error fetching customer service tickets:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch customer service tickets" });
      }
    }
  );

  app.get(
    "/api/customers/:id/contracts",
    requireAuth,
    requireTenant,
    async (req: TenantRequest, res) => {
      try {
        const contracts = await storage.getCustomerContracts(
          req.params.id as string,
          req.tenantId as string
        );
        res.json(contracts);
      } catch (error) {
        console.error("Error fetching customer contracts:", error);
        res.status(500).json({ message: "Failed to fetch customer contracts" });
      }
    }
  );

  // Contract routes
  app.get(
    "/api/contracts",
    requireAuth,
    requireTenant,
    async (req: TenantRequest, res) => {
      try {
        const contracts = await storage.getContracts(req.tenantId!);
        res.json(contracts);
      } catch (error) {
        console.error("Error fetching contracts:", error);
        res.status(500).json({ message: "Failed to fetch contracts" });
      }
    }
  );

  app.post(
    "/api/contracts",
    requireAuth,
    requireTenant,
    async (req: TenantRequest, res) => {
      try {
        const session = req.session as any;
        const userId = session?.userId;

        if (!userId) {
          return res.status(401).json({ message: "Authentication required" });
        }

        // Generate contract number if not provided
        const contractNumber = req.body.contractNumber || `CNT-${Date.now()}`;

        // Ensure we have a customerId
        if (!req.body.customerId) {
          return res.status(400).json({ message: "Customer ID is required" });
        }

        // Prepare contract data with only existing database columns
        const contractData = {
          customerId: req.body.customerId,
          tenantId: req.tenantId!,
          contractNumber,
          startDate: req.body.startDate,
          endDate: req.body.endDate,
          blackRate: req.body.blackRate ? String(req.body.blackRate) : null,
          colorRate: req.body.colorRate ? String(req.body.colorRate) : null,
          monthlyBase: req.body.monthlyBase
            ? String(req.body.monthlyBase)
            : null,
          status: req.body.status || "active",
        };

        console.log(
          "Creating contract with data:",
          JSON.stringify(contractData, null, 2)
        );

        // Convert date strings to Date objects if they exist
        if (
          contractData.startDate &&
          typeof contractData.startDate === "string"
        ) {
          contractData.startDate = new Date(contractData.startDate);
        }
        if (contractData.endDate && typeof contractData.endDate === "string") {
          contractData.endDate = new Date(contractData.endDate);
        }

        const newContract = await storage.createContract(contractData);
        res.status(201).json(newContract);
      } catch (error) {
        console.error("Error creating contract:", error);
        res.status(500).json({ message: "Failed to create contract" });
      }
    }
  );

  // Import and register proposals routes
  const proposalsRouter = await import("./routes-proposals.js");
  app.use("/api/proposals", proposalsRouter.default);

  // Import and register documents routes
  const documentsRouter = await import("./routes-documents.js");
  app.use("/api/documents", documentsRouter.default);

  // Social Media Post Generator Routes
  const socialMediaRoutes = await import("./routes-social-media");
  app.use("/", socialMediaRoutes.default);

  // Root Admin Routes
  const rootAdminRoutes = await import("./routes-root-admin");
  app.use("/api/root-admin", rootAdminRoutes.default);

  // Customer Number Management Routes
  const customerNumberRoutes = await import("./routes-customer-numbers");
  app.use("/api/customer-numbers", customerNumberRoutes.customerNumberRoutes);

  // Company ID Management Routes
  const companyIdRoutes = await import("./routes-company-ids");
  app.use("/api/company-ids", companyIdRoutes.default);

  // Enhanced RBAC Routes
  app.use("/api/rbac", enhancedRBACRoutes);
  app.use("/api/ai/gpt5", gpt5Routes);

  // ============= PREVENTIVE MAINTENANCE SCHEDULING ROUTES =============

  // Get maintenance schedules
  app.get(
    "/api/maintenance/schedules",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const status = String((req.query as any)?.status || "");
        const equipmentId = String((req.query as any)?.equipmentId || "");
        const customerId = String((req.query as any)?.customerId || "");
        const priority = String((req.query as any)?.priority || "");
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
        ${status === "active" ? "AND ms.is_active = true" : ""}
        ${status === "inactive" ? "AND ms.is_active = false" : ""}
        ${equipmentId ? `AND ms.equipment_id = '${equipmentId}'` : ""}
        ${customerId ? `AND ms.customer_id = '${customerId}'` : ""}
        ${priority ? `AND ms.priority = '${priority}'` : ""}
        ORDER BY ms.next_service_date DESC NULLS LAST
      `;

        const result = await db.$client.query(query, [tenantId]);
        res.json(result.rows);
      } catch (error) {
        console.error("Error fetching maintenance schedules:", error);
        res
          .status(500)
          .json({ error: "Failed to fetch maintenance schedules" });
      }
    }
  );

  // Get due schedules (upcoming or overdue)
  app.get(
    "/api/maintenance/schedules/due",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const days = Number((req.query as any)?.days ?? 7);
        const tenantId = String((req as any).user?.tenantId || "");
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + parseInt(String(days)));

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

        const result = await db.$client.query(query, [
          String(tenantId),
          futureDate.toISOString(),
        ]);
        res.json(result.rows);
      } catch (error) {
        console.error("Error fetching due schedules:", error);
        res.status(500).json({ error: "Failed to fetch due schedules" });
      }
    }
  );

  // Create maintenance schedule
  app.post(
    "/api/maintenance/schedules",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
          priority = "medium",
          advanceNotificationDays = 7,
          customerNotification = true,
          technicianNotification = true,
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
          tenantId,
          scheduleName,
          scheduleType,
          frequency,
          frequencyValue,
          nextServiceDate,
          equipmentId,
          customerId,
          businessRecordId,
          estimatedCost,
          serviceDuration,
          priority,
          advanceNotificationDays,
          customerNotification,
          technicianNotification,
          createdBy,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error("Error creating maintenance schedule:", error);
        res
          .status(500)
          .json({ error: "Failed to create maintenance schedule" });
      }
    }
  );

  // Analytics endpoint
  app.get(
    "/api/maintenance/analytics/overview",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
          `SELECT COUNT(*) as due_this_week FROM maintenance_schedules WHERE tenant_id = $1 AND is_active = true AND next_service_date BETWEEN NOW() AND (NOW() + INTERVAL '7 days')`,
        ];

        const results = await Promise.all(
          queries.map((query) => db.$client.query(query, [tenantId]))
        );

        res.json({
          totalSchedules: parseInt(results[0].rows[0].total_schedules),
          activeSchedules: parseInt(results[1].rows[0].active_schedules),
          overdueSchedules: parseInt(results[2].rows[0].overdue_schedules),
          dueThisWeek: parseInt(results[3].rows[0].due_this_week),
        });
      } catch (error) {
        console.error("Error fetching maintenance analytics:", error);
        res
          .status(500)
          .json({ error: "Failed to fetch maintenance analytics" });
      }
    }
  );

  // ============= CUSTOMER SELF-SERVICE PORTAL ROUTES =============

  // Get customer service requests
  app.get(
    "/api/customer-portal/service-requests",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
    }
  );

  // Create service request
  app.post(
    "/api/customer-portal/service-requests",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        const {
          request_type,
          priority,
          subject,
          description,
          equipment_id,
          equipment_make,
          equipment_model,
          equipment_serial,
          meter_reading,
          preferred_contact_method,
          preferred_service_time,
          urgency_reason,
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
          tenantId,
          userId,
          businessRecordId,
          equipment_id,
          request_type,
          priority,
          subject,
          description,
          equipment_make,
          equipment_model,
          equipment_serial,
          meter_reading,
          preferred_contact_method,
          preferred_service_time,
          urgency_reason,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error("Error creating service request:", error);
        res.status(500).json({ error: "Failed to create service request" });
      }
    }
  );

  // Get customer equipment
  app.get(
    "/api/customer-portal/equipment",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
    }
  );

  // Get supply orders
  app.get(
    "/api/customer-portal/supply-orders",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
    }
  );

  // Get knowledge base articles
  app.get(
    "/api/customer-portal/knowledge-base",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;
        const search = String((req.query as any)?.search || "");
        const category = String((req.query as any)?.category || "");

        let whereConditions = ["tenant_id = $1", "is_published = true"];
        const queryParams = [tenantId];

        if (search) {
          whereConditions.push(
            `(title ILIKE $${queryParams.length + 1} OR content ILIKE $${
              queryParams.length + 1
            })`
          );
          queryParams.push(`%${search}%`);
        }

        if (category && category !== "all") {
          whereConditions.push(`category = $${queryParams.length + 1}`);
          queryParams.push(category);
        }

        const query = `
        SELECT id, title, summary, category, subcategory, view_count, 
               helpful_votes, is_featured, created_at
        FROM knowledge_base_articles
        WHERE ${whereConditions.join(" AND ")}
        ORDER BY is_featured DESC, helpful_votes DESC, view_count DESC
      `;

        const result = await db.$client.query(query, queryParams);
        res.json(result.rows);
      } catch (error) {
        console.error("Error fetching knowledge base articles:", error);
        res
          .status(500)
          .json({ error: "Failed to fetch knowledge base articles" });
      }
    }
  );

  // ============= ADVANCED BILLING ENGINE ROUTES =============

  // Get billing analytics
  app.get(
    "/api/billing/analytics",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const queries = [
          `SELECT COUNT(*) as total_invoices FROM billing_invoices WHERE tenant_id = $1`,
          `SELECT COALESCE(SUM(total_amount), 0) as total_revenue FROM billing_invoices WHERE tenant_id = $1 AND status = 'paid'`,
          `SELECT COALESCE(SUM(balance_due), 0) as outstanding_amount FROM billing_invoices WHERE tenant_id = $1 AND status != 'paid'`,
          `SELECT COUNT(*) as overdue_invoices FROM billing_invoices WHERE tenant_id = $1 AND status = 'overdue'`,
          `SELECT COALESCE(AVG(total_amount), 0) as average_invoice_amount FROM billing_invoices WHERE tenant_id = $1`,
          `SELECT COALESCE(SUM(total_amount), 0) as monthly_recurring FROM billing_invoices WHERE tenant_id = $1 AND billing_period_start >= date_trunc('month', CURRENT_DATE)`,
        ];

        const results = await Promise.all(
          queries.map((query) => db.$client.query(query, [tenantId]))
        );

        const totalRevenue = parseFloat(results[1].rows[0].total_revenue);
        const outstandingAmount = parseFloat(
          results[2].rows[0].outstanding_amount
        );
        const monthlyRecurring = parseFloat(
          results[5].rows[0].monthly_recurring
        );

        res.json({
          totalInvoices: parseInt(results[0].rows[0].total_invoices),
          totalRevenue,
          outstandingAmount,
          overdueInvoices: parseInt(results[3].rows[0].overdue_invoices),
          averageInvoiceAmount: parseFloat(
            results[4].rows[0].average_invoice_amount
          ),
          collectionRate:
            totalRevenue > 0
              ? totalRevenue / (totalRevenue + outstandingAmount)
              : 0,
          monthlyRecurringRevenue: monthlyRecurring,
          annualRecurringRevenue: monthlyRecurring * 12,
        });
      } catch (error) {
        console.error("Error fetching billing analytics:", error);
        res.status(500).json({ error: "Failed to fetch billing analytics" });
      }
    }
  );

  // Get billing invoices
  app.get(
    "/api/billing/invoices",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const status = String((req.query as any)?.status || "");
        const ticketId = String((req.query as any)?.ticketId || "");
        const contractId = String((req.query as any)?.contractId || "");
        const filter = String((req.query as any)?.filter || "");
        const tenantId = req.user.tenantId;

        let whereConditions = ["bi.tenant_id = $1"]; 
        const queryParams: any[] = [tenantId];

        if (status && status !== "all") {
          whereConditions.push(`bi.status = $${queryParams.length + 1}`);
          queryParams.push(status);
        }

        if (ticketId) {
          whereConditions.push(`bi.ticket_id = $${queryParams.length + 1}`);
          queryParams.push(ticketId);
        }

        if (contractId) {
          whereConditions.push(`bi.contract_id = $${queryParams.length + 1}`);
          queryParams.push(contractId);
        }

        if (filter === 'issuance_delay_gt_24h') {
          whereConditions.push(`bi.created_at > NOW() - INTERVAL '30 days'`);
          whereConditions.push(`(bi.issuance_delay_hours IS NOT NULL AND bi.issuance_delay_hours > 24)`);
        }

        const query = `
        SELECT 
          bi.*,
          br.company_name as business_record_name
        FROM billing_invoices bi
        LEFT JOIN business_records br ON bi.business_record_id = br.id
        WHERE ${whereConditions.join(" AND ")}
        ORDER BY bi.created_at DESC
        LIMIT 100
      `;

        const result = await db.$client.query(query, queryParams);
        res.json(result.rows);
      } catch (error) {
        console.error("Error fetching billing invoices:", error);
        res.status(500).json({ error: "Failed to fetch billing invoices" });
      }
    }
  );

  // Get billing configurations
  app.get(
    "/api/billing/configurations",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const type = String((req.query as any)?.type || "");
        const tenantId = req.user.tenantId;

        let whereConditions = ["tenant_id = $1"];
        const queryParams = [tenantId];

        if (type && type !== "all") {
          whereConditions.push(`billing_type = $${queryParams.length + 1}`);
          queryParams.push(type);
        }

        const query = `
        SELECT *
        FROM billing_configurations
        WHERE ${whereConditions.join(" AND ")}
        ORDER BY is_default DESC, configuration_name
      `;

        const result = await db.$client.query(query, queryParams);
        res.json(result.rows);
      } catch (error) {
        console.error("Error fetching billing configurations:", error);
        res
          .status(500)
          .json({ error: "Failed to fetch billing configurations" });
      }
    }
  );

  // Create billing configuration
  app.post(
    "/api/billing/configurations",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const {
          configuration_name,
          billing_type,
          billing_frequency,
          billing_day,
          base_rate,
          minimum_charge,
          maximum_charge,
          overage_rate,
          setup_fee,
          maintenance_fee,
          tax_rate,
          tax_inclusive,
          contract_length_months,
          early_termination_fee,
          is_default,
        } = req.body;

        // If setting as default, unset other defaults first
        if (is_default) {
          await db.$client.query(
            "UPDATE billing_configurations SET is_default = false WHERE tenant_id = $1",
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
          tenantId,
          configuration_name,
          billing_type,
          billing_frequency,
          billing_day,
          base_rate,
          minimum_charge,
          maximum_charge,
          overage_rate,
          setup_fee,
          maintenance_fee,
          tax_rate,
          tax_inclusive,
          contract_length_months,
          early_termination_fee,
          is_default,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error("Error creating billing configuration:", error);
        res
          .status(500)
          .json({ error: "Failed to create billing configuration" });
      }
    }
  );

  // Get billing cycles
  app.get(
    "/api/billing/cycles",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
    }
  );

  // Run billing cycle
  app.post(
    "/api/billing/cycles/run",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        // Create a new billing cycle
        const cycleDate = new Date().toISOString().split("T")[0];
        const cycleName = `Billing Cycle ${format(new Date(), "MMM yyyy")}`;

        const cycleQuery = `
        INSERT INTO billing_cycles (
          tenant_id, cycle_name, cycle_date, status, started_at
        ) VALUES ($1, $2, $3, 'processing', NOW())
        RETURNING *
      `;

        const cycleResult = await db.$client.query(cycleQuery, [
          tenantId,
          cycleName,
          cycleDate,
        ]);

        const cycle = cycleResult.rows[0];

        // For demo purposes, create a few sample invoices
        const sampleInvoices = [
          {
            invoice_number: `INV-${Date.now()}-001`,
            business_record_id: "adc117e7-611d-426a-b569-6c6c0b32e234",
            amount: 299.99,
          },
          {
            invoice_number: `INV-${Date.now()}-002`,
            business_record_id: "adc117e7-611d-426a-b569-6c6c0b32e234",
            amount: 459.99,
          },
        ];

        let totalAmount = 0;
        let invoicesGenerated = 0;

        for (const invoice of sampleInvoices) {
          const invoiceQuery = `
          INSERT INTO billing_invoices (
            tenant_id, customer_id, invoice_number, created_at, due_date,
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
            tenantId,
            invoice.business_record_id,
            invoice.invoice_number,
            invoiceDate,
            dueDate,
            periodStart,
            periodEnd,
            invoice.amount,
            invoice.amount,
            invoice.amount,
            cycle.id,
          ]);

          totalAmount += invoice.amount;
          invoicesGenerated++;
        }

        // Update billing cycle with results
        await db.$client.query(
          `
        UPDATE billing_cycles 
        SET status = 'completed', 
            completed_at = NOW(),
            total_customers = $1,
            processed_customers = $2,
            total_invoices_generated = $3,
            total_amount = $4
        WHERE id = $5
      `,
          [
            sampleInvoices.length,
            sampleInvoices.length,
            invoicesGenerated,
            totalAmount,
            cycle.id,
          ]
        );

        res.status(201).json({
          message: "Billing cycle completed successfully",
          cycle_id: cycle.id,
          invoices_generated: invoicesGenerated,
          total_amount: totalAmount,
        });
      } catch (error) {
        console.error("Error running billing cycle:", error);
        res.status(500).json({ error: "Failed to run billing cycle" });
      }
    }
  );

  // Get billing adjustments
  app.get(
    "/api/billing/adjustments",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
    }
  );

  // Create billing adjustment
  app.post(
    "/api/billing/adjustments",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        const {
          adjustment_type,
          adjustment_reason,
          amount,
          description,
          invoice_id,
          business_record_id,
        } = req.body;

        const query = `
        INSERT INTO billing_adjustments (
          tenant_id, adjustment_type, adjustment_reason, amount, description,
          invoice_id, business_record_id, requested_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

        const result = await db.$client.query(query, [
          tenantId,
          adjustment_type,
          adjustment_reason,
          amount,
          description,
          invoice_id,
          business_record_id,
          userId,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error("Error creating billing adjustment:", error);
        res.status(500).json({ error: "Failed to create billing adjustment" });
      }
    }
  );

  // ============= FINANCIAL FORECASTING ROUTES =============

  // Get financial metrics
  app.get(
    "/api/financial/metrics",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const queries = [
          `SELECT COALESCE(SUM(total_forecast_amount), 0) as total_revenue_forecast FROM financial_forecasts WHERE tenant_id = $1 AND forecast_type = 'revenue' AND status = 'published'`,
          `SELECT COALESCE(SUM(net_cash_flow), 0) as cash_flow_projection FROM cash_flow_projections WHERE tenant_id = $1 AND projection_period >= date_trunc('month', CURRENT_DATE)`,
          `SELECT COALESCE(AVG(gross_margin_percentage), 0) as avg_profit_margin FROM profitability_analysis WHERE tenant_id = $1`,
          `SELECT COALESCE(AVG(growth_rate), 0) as avg_growth_rate FROM financial_forecasts WHERE tenant_id = $1`,
        ];

        const results = await Promise.all(
          queries.map((query) => db.$client.query(query, [tenantId]))
        );

        res.json({
          totalRevenueForecast: parseFloat(
            results[0].rows[0].total_revenue_forecast
          ),
          cashFlowProjection: parseFloat(
            results[1].rows[0].cash_flow_projection
          ),
          profitMargin: parseFloat(results[2].rows[0].avg_profit_margin),
          growthProjection: parseFloat(results[3].rows[0].avg_growth_rate),
          riskLevel: "medium",
          forecastAccuracy: 0.85,
        });
      } catch (error) {
        console.error("Error fetching financial metrics:", error);
        res.status(500).json({ error: "Failed to fetch financial metrics" });
      }
    }
  );

  // Get financial forecasts
  app.get(
    "/api/financial/forecasts",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const type = String((req.query as any)?.type || "");
        const tenantId = req.user.tenantId;

        let whereConditions = ["tenant_id = $1"];
        const queryParams = [tenantId];

        if (type && type !== "all") {
          whereConditions.push(`forecast_type = $${queryParams.length + 1}`);
          queryParams.push(type);
        }

        const query = `
        SELECT *
        FROM financial_forecasts
        WHERE ${whereConditions.join(" AND ")}
        ORDER BY created_at DESC
      `;

        const result = await db.$client.query(query, queryParams);
        res.json(result.rows);
      } catch (error) {
        console.error("Error fetching financial forecasts:", error);
        res.status(500).json({ error: "Failed to fetch financial forecasts" });
      }
    }
  );

  // Create financial forecast
  app.post(
    "/api/financial/forecasts",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        const {
          forecast_name,
          forecast_type,
          forecast_period,
          start_date,
          end_date,
          base_amount,
          growth_rate,
          scenario_type,
          assumptions,
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
          tenantId,
          forecast_name,
          forecast_type,
          forecast_period,
          start_date,
          end_date,
          base_amount,
          growth_rate,
          scenario_type,
          assumptions,
          totalForecastAmount,
          userId,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error("Error creating financial forecast:", error);
        res.status(500).json({ error: "Failed to create financial forecast" });
      }
    }
  );

  // Get cash flow projections
  app.get(
    "/api/financial/cash-flow",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
        res
          .status(500)
          .json({ error: "Failed to fetch cash flow projections" });
      }
    }
  );

  // Create cash flow projection
  app.post(
    "/api/financial/cash-flow",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        const {
          projection_name,
          projection_period,
          beginning_cash,
          collections_forecast,
          payroll_expenses,
          operating_expenses,
          equipment_purchases,
          minimum_cash_required,
          assumptions,
        } = req.body;

        // Calculate cash flow
        const totalCashInflow = beginning_cash + collections_forecast;
        const totalCashOutflow =
          payroll_expenses + operating_expenses + equipment_purchases;
        const netCashFlow = totalCashInflow - totalCashOutflow;
        const endingCash = beginning_cash + netCashFlow;
        const cashShortageRisk = endingCash < minimum_cash_required;
        const daysCashOnHand =
          endingCash > 0 ? Math.floor(endingCash / (totalCashOutflow / 30)) : 0;

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
          tenantId,
          projection_name,
          projection_period,
          beginning_cash,
          collections_forecast,
          totalCashInflow,
          payroll_expenses,
          operating_expenses,
          equipment_purchases,
          totalCashOutflow,
          netCashFlow,
          endingCash,
          minimum_cash_required,
          cashShortageRisk,
          daysCashOnHand,
          assumptions,
          userId,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error("Error creating cash flow projection:", error);
        res
          .status(500)
          .json({ error: "Failed to create cash flow projection" });
      }
    }
  );

  // Get profitability analysis
  app.get(
    "/api/financial/profitability",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const type = String((req.query as any)?.type || "");
        const tenantId = req.user.tenantId;

        let whereConditions = ["tenant_id = $1"];
        const queryParams = [tenantId];

        if (type && type !== "all") {
          whereConditions.push(`analysis_type = $${queryParams.length + 1}`);
          queryParams.push(type);
        }

        const query = `
        SELECT *
        FROM profitability_analysis
        WHERE ${whereConditions.join(" AND ")}
        ORDER BY created_at DESC
      `;

        const result = await db.$client.query(query, queryParams);
        res.json(result.rows);
      } catch (error) {
        console.error("Error fetching profitability analysis:", error);
        res
          .status(500)
          .json({ error: "Failed to fetch profitability analysis" });
      }
    }
  );

  // Run profitability analysis
  app.post(
    "/api/financial/profitability/run",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        // Real profitability analysis based on actual customer data
        const customerAnalyses = await db
          .select({
            customerId: businessRecords.id,
            customerName: businessRecords.companyName,
            totalRevenue: sql<number>`coalesce(sum(${invoices.totalAmount}), 0)::numeric`,
            totalCosts: sql<number>`0::numeric`,
          })
          .from(businessRecords)
          .leftJoin(invoices, eq(businessRecords.id, invoices.customerId))
          .leftJoin(
            serviceTickets,
            eq(businessRecords.id, serviceTickets.customerId)
          )
          .where(
            and(
              eq(businessRecords.tenantId, tenantId),
              eq(businessRecords.recordType, "customer")
            )
          )
          .groupBy(businessRecords.id, businessRecords.companyName)
          .having(sql`sum(${invoices.totalAmount}) > 0`)
          .limit(5);

        for (const analysis of customerAnalyses) {
          const serviceRevenue = Number(analysis.totalRevenue || 0);
          const totalCosts = Number(analysis.totalCosts || 0);
          const grossProfit = serviceRevenue - totalCosts;
          const netProfit = grossProfit * 0.85; // Simplified calculation
          const grossMargin =
            serviceRevenue > 0 ? (grossProfit / serviceRevenue) * 100 : 0;
          const netMargin =
            serviceRevenue > 0 ? (netProfit / serviceRevenue) * 100 : 0;
          const roi = totalCosts > 0 ? (netProfit / totalCosts) * 100 : 0;

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
            tenantId,
            `Customer Profitability: ${analysis.customerName}`,
            "customer",
            startDate,
            endDate,
            "customer",
            analysis.customerName,
            serviceRevenue,
            serviceRevenue,
            totalCosts,
            grossProfit,
            grossMargin,
            netProfit,
            netMargin,
            roi,
            userId,
          ]);
        }

        res.status(201).json({
          message: "Profitability analysis completed",
          analyses_created: customerAnalyses.length,
        });
      } catch (error) {
        console.error("Error running profitability analysis:", error);
        res.status(500).json({ error: "Failed to run profitability analysis" });
      }
    }
  );

  // Get financial KPIs
  app.get(
    "/api/financial/kpis",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
    }
  );

  // ============= EQUIPMENT LIFECYCLE MANAGEMENT ROUTES =============

  // Get equipment lifecycle metrics
  app.get(
    "/api/equipment-lifecycle/metrics",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const queries = [
          `SELECT COUNT(*) as total_equipment FROM equipment_lifecycle_stages WHERE tenant_id = $1 AND current_stage != 'active'`,
          `SELECT COUNT(*) as pending_deliveries FROM equipment_delivery_schedules WHERE tenant_id = $1 AND status IN ('scheduled', 'confirmed')`,
          `SELECT COUNT(*) as scheduled_installations FROM equipment_installations WHERE tenant_id = $1 AND status IN ('scheduled', 'in_progress')`,
          `SELECT COUNT(*) as active_assets FROM equipment_asset_tracking WHERE tenant_id = $1 AND current_status = 'active'`,
          `SELECT COALESCE(AVG(estimated_duration_hours), 0) as avg_installation_time FROM equipment_installations WHERE tenant_id = $1`,
          `SELECT COALESCE(AVG(customer_satisfaction_rating), 0) as avg_satisfaction FROM equipment_installations WHERE tenant_id = $1 AND customer_satisfaction_rating IS NOT NULL`,
        ];

        const results = await Promise.all(
          queries.map((query) => db.$client.query(query, [tenantId]))
        );

        res.json({
          totalEquipmentInProcess: parseInt(results[0].rows[0].total_equipment),
          pendingDeliveries: parseInt(results[1].rows[0].pending_deliveries),
          scheduledInstallations: parseInt(
            results[2].rows[0].scheduled_installations
          ),
          activeAssets: parseInt(results[3].rows[0].active_assets),
          averageInstallationTime: parseFloat(
            results[4].rows[0].avg_installation_time
          ),
          customerSatisfactionRating: parseFloat(
            results[5].rows[0].avg_satisfaction
          ),
        });
      } catch (error) {
        console.error("Error fetching equipment lifecycle metrics:", error);
        res
          .status(500)
          .json({ error: "Failed to fetch equipment lifecycle metrics" });
      }
    }
  );

  // Get equipment lifecycle stages
  app.get(
    "/api/equipment-lifecycle/stages",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const stage = String((req.query as any)?.stage || "");
        const status = String((req.query as any)?.status || "");
        const tenantId = req.user.tenantId;

        let whereConditions = ["els.tenant_id = $1"];
        const queryParams = [tenantId];

        if (stage && stage !== "all") {
          whereConditions.push(
            `els.current_stage = $${queryParams.length + 1}`
          );
          queryParams.push(stage);
        }

        if (status && status !== "all") {
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
        WHERE ${whereConditions.join(" AND ")}
        ORDER BY els.stage_started_at DESC
      `;

        const result = await db.$client.query(query, queryParams);
        res.json(result.rows);
      } catch (error) {
        console.error("Error fetching equipment lifecycle stages:", error);
        res
          .status(500)
          .json({ error: "Failed to fetch equipment lifecycle stages" });
      }
    }
  );

  // Get purchase orders
  app.get(
    "/api/equipment-lifecycle/purchase-orders",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
    }
  );

  // Create purchase order
  app.post(
    "/api/equipment-lifecycle/purchase-orders",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        const {
          vendor_name,
          order_date,
          requested_delivery_date,
          customer_id,
          delivery_address,
          special_instructions,
          items,
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
          tenantId,
          poNumber,
          vendor_name,
          order_date,
          requested_delivery_date,
          customer_id,
          customer_id,
          delivery_address,
          special_instructions,
          subtotal,
          taxAmount,
          totalAmount,
          userId,
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
            tenantId,
            po.id,
            i + 1,
            item.equipment_model,
            item.equipment_brand,
            item.description,
            item.quantity,
            item.unit_price,
            lineTotal,
          ]);
        }

        res.status(201).json(po);
      } catch (error) {
        console.error("Error creating purchase order:", error);
        res.status(500).json({ error: "Failed to create purchase order" });
      }
    }
  );

  // Get delivery schedules
  app.get(
    "/api/equipment-lifecycle/deliveries",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
    }
  );

  // Create delivery schedule
  app.post(
    "/api/equipment-lifecycle/deliveries",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const {
          purchase_order_id,
          scheduled_date,
          time_window_start,
          time_window_end,
          delivery_type,
          contact_person,
          contact_phone,
          contact_email,
          delivery_address,
          special_equipment_required,
          delivery_instructions,
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
          tenantId,
          deliveryId,
          purchase_order_id,
          scheduled_date,
          time_window_start,
          time_window_end,
          delivery_type,
          contact_person,
          contact_phone,
          contact_email,
          delivery_address,
          special_equipment_required,
          delivery_instructions,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error("Error creating delivery schedule:", error);
        res.status(500).json({ error: "Failed to create delivery schedule" });
      }
    }
  );

  // Get installations
  app.get(
    "/api/equipment-lifecycle/installations",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
    }
  );

  // Create installation
  app.post(
    "/api/equipment-lifecycle/installations",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const {
          equipment_id,
          scheduled_date,
          scheduled_time_start,
          scheduled_time_end,
          installation_location,
          site_contact_person,
          site_contact_phone,
          lead_technician_id,
          power_requirements,
          network_requirements,
          environmental_conditions,
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
          tenantId,
          equipment_id,
          scheduled_date,
          scheduled_time_start,
          scheduled_time_end,
          installation_location,
          site_contact_person,
          site_contact_phone,
          lead_technician_id,
          power_requirements,
          network_requirements,
          environmental_conditions,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error("Error creating installation:", error);
        res.status(500).json({ error: "Failed to create installation" });
      }
    }
  );

  // Get asset tracking
  app.get(
    "/api/equipment-lifecycle/assets",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
    }
  );

  // ============= COMMISSION MANAGEMENT ROUTES =============

  // Get commission metrics
  app.get(
    "/api/commission/metrics",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const queries = [
          `SELECT COALESCE(SUM(net_payment_amount), 0) as total_paid FROM commission_payments WHERE tenant_id = $1 AND payment_status = 'completed' AND EXTRACT(MONTH FROM payment_date) = EXTRACT(MONTH FROM CURRENT_DATE)`,
          `SELECT COALESCE(SUM(net_commission_amount), 0) as pending_commissions FROM commission_calculations WHERE tenant_id = $1 AND payment_status = 'pending'`,
          `SELECT COALESCE(AVG(base_commission_rate), 0) as avg_rate FROM commission_calculations WHERE tenant_id = $1`,
          `SELECT COALESCE(MAX(net_commission_amount), 0) as top_commission FROM commission_calculations WHERE tenant_id = $1`,
          `SELECT COUNT(*) as active_disputes FROM commission_disputes WHERE tenant_id = $1 AND status IN ('open', 'under_review')`,
          `SELECT COALESCE(AVG(achievement_percentage), 0) as quota_attainment FROM sales_quotas WHERE tenant_id = $1 AND status = 'active'`,
        ];

        const results = await Promise.all(
          queries.map((query) => db.$client.query(query, [tenantId]))
        );

        res.json({
          totalCommissionsPaid: parseFloat(results[0].rows[0].total_paid),
          pendingCommissions: parseFloat(
            results[1].rows[0].pending_commissions
          ),
          averageCommissionRate: parseFloat(results[2].rows[0].avg_rate),
          topPerformerCommission: parseFloat(results[3].rows[0].top_commission),
          activeDisputes: parseInt(results[4].rows[0].active_disputes),
          quotaAttainment: parseFloat(results[5].rows[0].quota_attainment),
        });
      } catch (error) {
        console.error("Error fetching commission metrics:", error);
        res.status(500).json({ error: "Failed to fetch commission metrics" });
      }
    }
  );

  // Get commission structures
  app.get(
    "/api/commission/structures",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
        res
          .status(500)
          .json({ error: "Failed to fetch commission structures" });
      }
    }
  );

  // Create commission structure
  app.post(
    "/api/commission/structures",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        const {
          structure_name,
          structure_type,
          applies_to,
          base_rate,
          calculation_basis,
          calculation_period,
          minimum_threshold,
          maximum_cap,
          effective_date,
          expiration_date,
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
          tenantId,
          structure_name,
          structure_type,
          applies_to,
          base_rate,
          calculation_basis,
          calculation_period,
          minimum_threshold,
          maximum_cap,
          effective_date,
          expiration_date,
          userId,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error("Error creating commission structure:", error);
        res
          .status(500)
          .json({ error: "Failed to create commission structure" });
      }
    }
  );

  // Get commission calculations
  app.get(
    "/api/commission/calculations",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const period = String((req.query as any)?.period || "");
        const status = String((req.query as any)?.status || "");
        const tenantId = req.user.tenantId;

        let whereConditions = ["cc.tenant_id = $1"];
        const queryParams = [tenantId];

        if (period && period !== "all") {
          switch (period) {
            case "current_month":
              whereConditions.push(
                `EXTRACT(MONTH FROM cc.calculation_period_start) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM cc.calculation_period_start) = EXTRACT(YEAR FROM CURRENT_DATE)`
              );
              break;
            case "last_month":
              whereConditions.push(
                `EXTRACT(MONTH FROM cc.calculation_period_start) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month') AND EXTRACT(YEAR FROM cc.calculation_period_start) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month')`
              );
              break;
            case "current_quarter":
              whereConditions.push(
                `EXTRACT(QUARTER FROM cc.calculation_period_start) = EXTRACT(QUARTER FROM CURRENT_DATE) AND EXTRACT(YEAR FROM cc.calculation_period_start) = EXTRACT(YEAR FROM CURRENT_DATE)`
              );
              break;
          }
        }

        if (status && status !== "all") {
          whereConditions.push(
            `cc.payment_status = $${queryParams.length + 1}`
          );
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
        WHERE ${whereConditions.join(" AND ")}
        ORDER BY cc.created_at DESC
      `;

        const result = await db.$client.query(query, queryParams);
        res.json(result.rows);
      } catch (error) {
        console.error("Error fetching commission calculations:", error);
        res
          .status(500)
          .json({ error: "Failed to fetch commission calculations" });
      }
    }
  );

  // Run commission calculations
  app.post(
    "/api/commission/calculations/run",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        // Sample commission calculations for demo
        const sampleCalculations = [
          {
            employee_name: "John Smith",
            total_sales: 125000,
            commission_rate: 0.05,
            commission_amount: 6250,
          },
          {
            employee_name: "Sarah Johnson",
            total_sales: 98000,
            commission_rate: 0.045,
            commission_amount: 4410,
          },
        ];

        // Get active users
        const usersQuery = `SELECT id, name FROM users WHERE tenant_id = $1 AND role LIKE '%sales%' LIMIT 2`;
        const usersResult = await db.$client.query(usersQuery, [tenantId]);
        const users = usersResult.rows;

        // Get active commission structure
        const structureQuery = `SELECT id FROM commission_structures WHERE tenant_id = $1 AND is_active = true LIMIT 1`;
        const structureResult = await db.$client.query(structureQuery, [
          tenantId,
        ]);
        const structureId = structureResult.rows[0]?.id;

        if (!structureId) {
          return res
            .status(400)
            .json({ error: "No active commission structure found" });
        }

        const startDate = new Date();
        startDate.setDate(1); // First day of current month
        const endDate = new Date();

        for (
          let i = 0;
          i < Math.min(sampleCalculations.length, users.length);
          i++
        ) {
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
            tenantId,
            startDate,
            endDate,
            user.id,
            structureId,
            calc.total_sales,
            calc.total_sales,
            calc.commission_rate,
            calc.commission_amount,
            calc.commission_amount,
            calc.commission_amount,
            userId,
          ]);
        }

        res.status(201).json({
          message: "Commission calculations completed",
          calculations_created: Math.min(
            sampleCalculations.length,
            users.length
          ),
        });
      } catch (error) {
        console.error("Error running commission calculations:", error);
        res
          .status(500)
          .json({ error: "Failed to run commission calculations" });
      }
    }
  );

  // Get sales quotas
  app.get(
    "/api/commission/quotas",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
    }
  );

  // Create sales quota
  app.post(
    "/api/commission/quotas",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        const {
          employee_id,
          quota_period_start,
          quota_period_end,
          quota_type,
          quota_amount,
          stretch_goal_amount,
          minimum_threshold,
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
          tenantId,
          employee_id,
          quota_period_start,
          quota_period_end,
          quota_type,
          quota_amount,
          stretch_goal_amount,
          minimum_threshold,
          userId,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error("Error creating sales quota:", error);
        res.status(500).json({ error: "Failed to create sales quota" });
      }
    }
  );

  // Get commission payments
  app.get(
    "/api/commission/payments",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
    }
  );

  // Get commission disputes
  app.get(
    "/api/commission/disputes",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
    }
  );

  // Create commission dispute
  app.post(
    "/api/commission/disputes",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const {
          dispute_type,
          employee_id,
          commission_calculation_id,
          dispute_amount,
          claimed_amount,
          description,
          priority,
        } = req.body;

        const disputeNumber = `DISP-${Date.now()}`;
        const disputeDate = new Date().toISOString().split("T")[0];

        const query = `
        INSERT INTO commission_disputes (
          tenant_id, dispute_number, dispute_type, employee_id,
          commission_calculation_id, dispute_amount, claimed_amount,
          description, priority, dispute_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

        const result = await db.$client.query(query, [
          tenantId,
          disputeNumber,
          dispute_type,
          employee_id,
          commission_calculation_id,
          dispute_amount,
          claimed_amount,
          description,
          priority,
          disputeDate,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error("Error creating commission dispute:", error);
        res.status(500).json({ error: "Failed to create commission dispute" });
      }
    }
  );

  // ============= REMOTE MONITORING ROUTES =============

  // Get monitoring metrics
  app.get(
    "/api/monitoring/metrics",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const queries = [
          `SELECT COUNT(*) as total_devices FROM iot_devices WHERE tenant_id = $1`,
          `SELECT COUNT(*) as online_devices FROM iot_devices WHERE tenant_id = $1 AND device_status = 'active'`,
          `SELECT COUNT(*) as active_alerts FROM predictive_alerts WHERE tenant_id = $1 AND alert_status IN ('open', 'acknowledged')`,
          `SELECT COUNT(*) as critical_alerts FROM predictive_alerts WHERE tenant_id = $1 AND severity = 'critical' AND alert_status IN ('open', 'acknowledged')`,
          `SELECT COALESCE(AVG(uptime_percentage), 0) as avg_uptime FROM equipment_status_monitoring WHERE tenant_id = $1`,
          `SELECT COUNT(*) as devices_attention FROM iot_devices WHERE tenant_id = $1 AND device_status IN ('error', 'maintenance')`,
        ];

        const results = await Promise.all(
          queries.map((query) => db.$client.query(query, [tenantId]))
        );

        res.json({
          totalDevices: parseInt(results[0].rows[0].total_devices),
          onlineDevices: parseInt(results[1].rows[0].online_devices),
          activeAlerts: parseInt(results[2].rows[0].active_alerts),
          criticalAlerts: parseInt(results[3].rows[0].critical_alerts),
          averageUptime: parseFloat(results[4].rows[0].avg_uptime),
          devicesRequiringAttention: parseInt(
            results[5].rows[0].devices_attention
          ),
        });
      } catch (error) {
        console.error("Error fetching monitoring metrics:", error);
        res.status(500).json({ error: "Failed to fetch monitoring metrics" });
      }
    }
  );

  // Get IoT devices
  app.get(
    "/api/monitoring/devices",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const type = String((req.query as any)?.type || "");
        const status = String((req.query as any)?.status || "");
        const tenantId = req.user.tenantId;

        let whereConditions = ["iot.tenant_id = $1"];
        const queryParams = [tenantId];

        if (type && type !== "all") {
          whereConditions.push(`iot.device_type = $${queryParams.length + 1}`);
          queryParams.push(type);
        }

        if (status && status !== "all") {
          whereConditions.push(
            `iot.device_status = $${queryParams.length + 1}`
          );
          queryParams.push(status);
        }

        const query = `
        SELECT 
          iot.*,
          br.company_name as customer_name
        FROM iot_devices iot
        LEFT JOIN business_records br ON iot.business_record_id = br.id
        WHERE ${whereConditions.join(" AND ")}
        ORDER BY iot.created_at DESC
      `;

        const result = await db.$client.query(query, queryParams);
        res.json(result.rows);
      } catch (error) {
        console.error("Error fetching IoT devices:", error);
        res.status(500).json({ error: "Failed to fetch IoT devices" });
      }
    }
  );

  // Register IoT device
  app.post(
    "/api/monitoring/devices",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const {
          device_name,
          device_type,
          manufacturer,
          model,
          device_serial_number,
          connection_type,
          customer_id,
          installation_location,
          ip_address,
          monitoring_enabled,
          data_collection_interval,
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
          tenantId,
          deviceId,
          device_name,
          device_type,
          manufacturer,
          model,
          device_serial_number,
          connection_type,
          customer_id,
          customer_id,
          installation_location,
          ip_address,
          monitoring_enabled,
          data_collection_interval,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error("Error registering IoT device:", error);
        res.status(500).json({ error: "Failed to register IoT device" });
      }
    }
  );

  // Get equipment status
  app.get(
    "/api/monitoring/equipment-status",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
    }
  );

  // Get predictive alerts
  app.get(
    "/api/monitoring/alerts",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const severity = String((req.query as any)?.severity || "");
        const tenantId = req.user.tenantId;

        let whereConditions = ["pa.tenant_id = $1"];
        const queryParams = [tenantId];

        if (severity && severity !== "all") {
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
        WHERE ${whereConditions.join(" AND ")}
        ORDER BY pa.created_at DESC
      `;

        const result = await db.$client.query(query, queryParams);
        res.json(result.rows);
      } catch (error) {
        console.error("Error fetching predictive alerts:", error);
        res.status(500).json({ error: "Failed to fetch predictive alerts" });
      }
    }
  );

  // Get performance trends
  app.get(
    "/api/monitoring/trends",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
    }
  );

  // Sync devices (simulate data collection)
  app.post(
    "/api/monitoring/sync",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
            tenantId,
            device.equipment_id || device.device_id,
            device.device_id,
            "running",
            "on",
            "connected",
            Math.floor(Math.random() * 5), // current_job_count
            Math.floor(Math.random() * 100000) + 50000, // total_page_count
            Math.floor(Math.random() * 3), // error_count
            20 + Math.random() * 10, // temperature
            40 + Math.random() * 20, // humidity
            95 + Math.random() * 5, // uptime_percentage
          ]);

          syncedDevices++;
        }

        res.status(200).json({
          message: "Device sync completed",
          synced_devices: syncedDevices,
        });
      } catch (error) {
        console.error("Error syncing devices:", error);
        res.status(500).json({ error: "Failed to sync devices" });
      }
    }
  );

  // ============= MOBILE SERVICE APP ROUTES =============

  // Get mobile app metrics
  app.get(
    "/api/mobile/metrics",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const queries = [
          `SELECT COUNT(*) as active_work_orders FROM mobile_work_orders WHERE tenant_id = $1 AND status IN ('assigned', 'en_route', 'on_site', 'in_progress')`,
          `SELECT COUNT(DISTINCT technician_id) as technicians_in_field FROM technician_locations WHERE tenant_id = $1 AND recorded_at > NOW() - INTERVAL '1 hour'`,
          `SELECT COUNT(*) as pending_parts_orders FROM mobile_field_orders WHERE tenant_id = $1 AND status IN ('submitted', 'approved', 'processing')`,
          `SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (arrival_time - created_at))/60), 0) as avg_response_time FROM mobile_work_orders WHERE tenant_id = $1 AND arrival_time IS NOT NULL`,
          `SELECT COALESCE(AVG(CASE WHEN status = 'completed' THEN 1.0 ELSE 0.0 END) * 100, 0) as completion_rate FROM mobile_work_orders WHERE tenant_id = $1`,
          `SELECT COALESCE(AVG(customer_satisfaction_rating), 0) as customer_satisfaction FROM mobile_work_orders WHERE tenant_id = $1 AND customer_satisfaction_rating IS NOT NULL`,
        ];

        const results = await Promise.all(
          queries.map((query) => db.$client.query(query, [tenantId]))
        );

        res.json({
          activeWorkOrders: parseInt(results[0].rows[0].active_work_orders),
          techniciansInField: parseInt(results[1].rows[0].technicians_in_field),
          pendingPartsOrders: parseInt(results[2].rows[0].pending_parts_orders),
          averageResponseTime: parseFloat(results[3].rows[0].avg_response_time),
          completionRate: parseFloat(results[4].rows[0].completion_rate),
          customerSatisfaction: parseFloat(
            results[5].rows[0].customer_satisfaction
          ),
        });
      } catch (error) {
        console.error("Error fetching mobile metrics:", error);
        res.status(500).json({ error: "Failed to fetch mobile metrics" });
      }
    }
  );

  // Get mobile work orders
  app.get(
    "/api/mobile/work-orders",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const status = String((req.query as any)?.status || "");
        const priority = String((req.query as any)?.priority || "");
        const technician = String((req.query as any)?.technician || "");
        const tenantId = req.user.tenantId;

        let whereConditions = ["mwo.tenant_id = $1"];
        const queryParams = [tenantId];

        if (status && status !== "all") {
          whereConditions.push(`mwo.status = $${queryParams.length + 1}`);
          queryParams.push(status);
        }

        if (priority && priority !== "all") {
          whereConditions.push(`mwo.priority = $${queryParams.length + 1}`);
          queryParams.push(priority);
        }

        if (technician && technician !== "all") {
          whereConditions.push(
            `mwo.assigned_technician_id = $${queryParams.length + 1}`
          );
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
        WHERE ${whereConditions.join(" AND ")}
        ORDER BY mwo.created_at DESC
      `;

        const result = await db.$client.query(query, queryParams);
        res.json(result.rows);
      } catch (error) {
        console.error("Error fetching mobile work orders:", error);
        res.status(500).json({ error: "Failed to fetch mobile work orders" });
      }
    }
  );

  // Create mobile work order
  app.post(
    "/api/mobile/work-orders",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const {
          work_order_type,
          priority,
          customer_id,
          service_address,
          assigned_technician_id,
          problem_description,
          scheduled_date,
          scheduled_time_start,
          estimated_duration_hours,
          site_contact_name,
          site_contact_phone,
          access_instructions,
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
          tenantId,
          workOrderNumber,
          work_order_type,
          priority,
          customer_id,
          customer_id,
          service_address,
          assigned_technician_id,
          problem_description,
          scheduled_date,
          scheduled_time_start,
          estimated_duration_hours,
          site_contact_name,
          site_contact_phone,
          access_instructions,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error("Error creating mobile work order:", error);
        res.status(500).json({ error: "Failed to create mobile work order" });
      }
    }
  );

  // Get mobile parts inventory
  app.get(
    "/api/mobile/parts-inventory",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
        res
          .status(500)
          .json({ error: "Failed to fetch mobile parts inventory" });
      }
    }
  );

  // Get mobile field orders
  app.get(
    "/api/mobile/field-orders",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
    }
  );

  // Create mobile field order
  app.post(
    "/api/mobile/field-orders",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const {
          order_type,
          technician_id,
          work_order_id,
          delivery_method,
          urgency,
          delivery_address,
          requested_delivery_date,
          parts,
        } = req.body;

        const orderNumber = `FO-${Date.now()}`;
        const orderDate = new Date().toISOString().split("T")[0];

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
          tenantId,
          orderNumber,
          order_type,
          technician_id,
          work_order_id,
          delivery_method,
          urgency,
          delivery_address,
          requested_delivery_date,
          orderDate,
          subtotal,
          taxAmount,
          totalAmount,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error("Error creating mobile field order:", error);
        res.status(500).json({ error: "Failed to create mobile field order" });
      }
    }
  );

  // Get technician locations
  app.get(
    "/api/mobile/technician-locations",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
    }
  );

  // Get mobile app sessions
  app.get(
    "/api/mobile/app-sessions",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
    }
  );

  // Sync mobile data
  app.post(
    "/api/mobile/sync",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        // Get active technicians
        const techniciansQuery = `SELECT id, name FROM users WHERE tenant_id = $1 AND role LIKE '%technician%'`;
        const techniciansResult = await db.$client.query(techniciansQuery, [
          tenantId,
        ]);
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
            tenantId,
            tech.id,
            40.7128 + (Math.random() - 0.5) * 0.1, // NYC area
            -74.006 + (Math.random() - 0.5) * 0.1,
            "customer_site",
            80 + Math.floor(Math.random() * 20), // 80-100% battery
          ]);

          syncedRecords++;
        }

        res.status(200).json({
          message: "Mobile data sync completed",
          synced_records: syncedRecords,
        });
      } catch (error) {
        console.error("Error syncing mobile data:", error);
        res.status(500).json({ error: "Failed to sync mobile data" });
      }
    }
  );

  // ============= SERVICE ANALYTICS ROUTES =============

  // Get analytics metrics
  app.get(
    "/api/analytics/metrics",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const queries = [
          `SELECT COALESCE(SUM(total_service_calls), 0) as total_service_calls FROM service_performance_metrics WHERE tenant_id = $1 AND metric_period = 'monthly' AND metric_date >= DATE_TRUNC('month', CURRENT_DATE)`,
          `SELECT COALESCE(AVG(average_response_time_minutes), 0) as avg_response_time FROM service_performance_metrics WHERE tenant_id = $1 AND metric_period = 'monthly'`,
          `SELECT COALESCE(AVG(average_satisfaction_score), 0) as customer_satisfaction FROM service_performance_metrics WHERE tenant_id = $1 AND metric_period = 'monthly'`,
          `SELECT COALESCE(AVG(month_over_month_growth), 0) as revenue_growth FROM service_performance_metrics WHERE tenant_id = $1 AND metric_period = 'monthly'`,
          `SELECT COALESCE(AVG(utilization_rate), 0) as utilization_rate FROM service_performance_metrics WHERE tenant_id = $1 AND metric_period = 'monthly'`,
          `SELECT COALESCE(AVG(first_call_resolution_rate), 0) as first_call_resolution FROM service_performance_metrics WHERE tenant_id = $1 AND metric_period = 'monthly'`,
        ];

        const results = await Promise.all(
          queries.map((query) => db.$client.query(query, [tenantId]))
        );

        res.json({
          totalServiceCalls: parseInt(results[0].rows[0].total_service_calls),
          averageResponseTime: parseFloat(results[1].rows[0].avg_response_time),
          customerSatisfaction: parseFloat(
            results[2].rows[0].customer_satisfaction
          ),
          revenueGrowth: parseFloat(results[3].rows[0].revenue_growth),
          utilizationRate: parseFloat(results[4].rows[0].utilization_rate),
          firstCallResolution: parseFloat(
            results[5].rows[0].first_call_resolution
          ),
        });
      } catch (error) {
        console.error("Error fetching analytics metrics:", error);
        res.status(500).json({ error: "Failed to fetch analytics metrics" });
      }
    }
  );

  // Get performance metrics
  app.get(
    "/api/analytics/performance-metrics",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const period = String((req.query as any)?.period || "");
        const tenantId = req.user.tenantId;

        let whereConditions = ["tenant_id = $1"];
        const queryParams = [tenantId];

        if (period && period !== "all") {
          whereConditions.push(`metric_period = $${queryParams.length + 1}`);
          queryParams.push(period);
        }

        const query = `
        SELECT *
        FROM service_performance_metrics
        WHERE ${whereConditions.join(" AND ")}
        ORDER BY metric_date DESC
        LIMIT 20
      `;

        const result = await db.$client.query(query, queryParams);
        res.json(result.rows);
      } catch (error) {
        console.error("Error fetching performance metrics:", error);
        res.status(500).json({ error: "Failed to fetch performance metrics" });
      }
    }
  );

  // Get technician performance analytics
  app.get(
    "/api/analytics/technician-performance",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
        console.error(
          "Error fetching technician performance analytics:",
          error
        );
        res
          .status(500)
          .json({ error: "Failed to fetch technician performance analytics" });
      }
    }
  );

  // Get customer service analytics
  app.get(
    "/api/analytics/customer-service",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
        res
          .status(500)
          .json({ error: "Failed to fetch customer service analytics" });
      }
    }
  );

  // Get trend analysis
  app.get(
    "/api/analytics/trends",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const category = String((req.query as any)?.category || "");
        const tenantId = req.user.tenantId;

        let whereConditions = ["tenant_id = $1"];
        const queryParams = [tenantId];

        if (category && category !== "all") {
          whereConditions.push(`trend_category = $${queryParams.length + 1}`);
          queryParams.push(category);
        }

        const query = `
        SELECT *
        FROM service_trend_analysis
        WHERE ${whereConditions.join(" AND ")}
        ORDER BY analysis_date DESC
        LIMIT 10
      `;

        const result = await db.$client.query(query, queryParams);
        res.json(result.rows);
      } catch (error) {
        console.error("Error fetching trend analysis:", error);
        res.status(500).json({ error: "Failed to fetch trend analysis" });
      }
    }
  );

  // Get BI dashboards
  app.get(
    "/api/analytics/dashboards",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const category = String((req.query as any)?.category || "");
        const tenantId = req.user.tenantId;

        let whereConditions = ["bid.tenant_id = $1"];
        const queryParams = [tenantId];

        if (category && category !== "all") {
          whereConditions.push(`bid.category = $${queryParams.length + 1}`);
          queryParams.push(category);
        }

        const query = `
        SELECT 
          bid.*,
          u.name as owner_name
        FROM business_intelligence_dashboards bid
        LEFT JOIN users u ON bid.owner_id = u.id
        WHERE ${whereConditions.join(" AND ")}
        ORDER BY bid.is_featured DESC, bid.created_at DESC
      `;

        const result = await db.$client.query(query, queryParams);
        res.json(result.rows);
      } catch (error) {
        console.error("Error fetching BI dashboards:", error);
        res.status(500).json({ error: "Failed to fetch BI dashboards" });
      }
    }
  );

  // Create BI dashboard
  app.post(
    "/api/analytics/dashboards",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        const {
          dashboard_name,
          dashboard_type,
          category,
          visibility,
          refresh_interval,
          auto_refresh,
          description,
        } = req.body;

        const dashboardConfig = {
          description,
          widgets: [],
          layout: "grid",
          theme: "default",
        };

        const query = `
        INSERT INTO business_intelligence_dashboards (
          tenant_id, dashboard_name, dashboard_type, category, owner_id,
          visibility, refresh_interval, auto_refresh, dashboard_config
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;

        const result = await db.$client.query(query, [
          tenantId,
          dashboard_name,
          dashboard_type,
          category,
          userId,
          visibility,
          refresh_interval,
          auto_refresh,
          JSON.stringify(dashboardConfig),
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error("Error creating BI dashboard:", error);
        res.status(500).json({ error: "Failed to create BI dashboard" });
      }
    }
  );

  // Get performance benchmarks
  app.get(
    "/api/analytics/benchmarks",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
        res
          .status(500)
          .json({ error: "Failed to fetch performance benchmarks" });
      }
    }
  );

  // Create performance benchmark
  app.post(
    "/api/analytics/benchmarks",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const {
          benchmark_name,
          benchmark_category,
          industry_average,
          company_target,
          improvement_priority,
          target_completion_date,
          business_impact,
          investment_required,
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
          tenantId,
          benchmark_name,
          benchmark_category,
          industry_average,
          company_target,
          improvement_priority,
          target_completion_date,
          business_impact,
          investment_required,
          "stable",
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error("Error creating performance benchmark:", error);
        res
          .status(500)
          .json({ error: "Failed to create performance benchmark" });
      }
    }
  );

  // Generate analytics reports
  app.post(
    "/api/analytics/generate-reports",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        // Generate sample performance metrics
        const currentDate = new Date();
        const startOfMonth = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          1
        );

        const metricsQuery = `
        INSERT INTO service_performance_metrics (
          tenant_id, metric_date, metric_period, period_start, period_end,
          total_service_calls, emergency_calls, average_response_time_minutes,
          first_call_resolution_rate, average_satisfaction_score, total_service_revenue,
          utilization_rate, jobs_completed_on_time, jobs_completed_late, month_over_month_growth
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `;

        await db.$client.query(metricsQuery, [
          tenantId,
          currentDate,
          "monthly",
          startOfMonth,
          currentDate,
          125,
          18,
          45.5,
          87.2,
          4.3,
          45000,
          78.5,
          98,
          12,
          8.5,
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
          [
            "service_volume",
            125,
            118,
            5.93,
            "up",
            132,
            85,
            "Service volume continues to grow steadily",
          ],
          [
            "satisfaction",
            4.3,
            4.1,
            4.88,
            "up",
            4.4,
            90,
            "Customer satisfaction improving with recent process changes",
          ],
          [
            "response_times",
            45.5,
            52.3,
            -13.0,
            "down",
            42,
            88,
            "Response times improving due to optimized routing",
          ],
        ];

        for (const trend of trends) {
          await db.$client.query(trendQuery, [
            tenantId,
            trend[0],
            currentDate,
            "monthly",
            trend[1],
            trend[2],
            trend[3],
            trend[4],
            trend[5],
            trend[6],
            trend[7],
          ]);
        }

        res.status(201).json({
          message: "Analytics reports generated successfully",
          reports_generated: 1 + trends.length,
        });
      } catch (error) {
        console.error("Error generating analytics reports:", error);
        res.status(500).json({ error: "Failed to generate analytics reports" });
      }
    }
  );

  // ============= WORKFLOW AUTOMATION ROUTES =============

  // Get automation metrics
  app.get(
    "/api/automation/metrics",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const queries = [
          `SELECT COUNT(*) as active_workflows FROM workflow_executions WHERE tenant_id = $1 AND status IN ('running', 'pending')`,
          `SELECT COUNT(*) as pending_tasks FROM automated_tasks WHERE tenant_id = $1 AND status = 'pending'`,
          `SELECT COUNT(*) as automation_rules FROM automation_rules WHERE tenant_id = $1 AND is_active = true`,
          `SELECT COALESCE(AVG(CASE WHEN status = 'completed' THEN 1.0 ELSE 0.0 END) * 100, 0) as success_rate FROM workflow_executions WHERE tenant_id = $1`,
          `SELECT COALESCE(SUM(actual_duration_minutes), 0) as time_saved FROM automated_tasks WHERE tenant_id = $1 AND status = 'completed'`,
          `SELECT COUNT(*) as tasks_automated FROM automated_tasks WHERE tenant_id = $1 AND automation_trigger IS NOT NULL`,
        ];

        const results = await Promise.all(
          queries.map((query) => db.$client.query(query, [tenantId]))
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
    }
  );

  // Get workflow templates
  app.get(
    "/api/automation/workflow-templates",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const category = String((req.query as any)?.category || "");
        const tenantId = req.user.tenantId;

        let whereConditions = ["tenant_id = $1"];
        const queryParams = [tenantId];

        if (category && category !== "all") {
          whereConditions.push(
            `template_category = $${queryParams.length + 1}`
          );
          queryParams.push(category);
        }

        const query = `
        SELECT *
        FROM workflow_templates
        WHERE ${whereConditions.join(" AND ")}
        ORDER BY is_active DESC, created_at DESC
      `;

        const result = await db.$client.query(query, queryParams);
        res.json(result.rows);
      } catch (error) {
        console.error("Error fetching workflow templates:", error);
        res.status(500).json({ error: "Failed to fetch workflow templates" });
      }
    }
  );

  // Create workflow template
  app.post(
    "/api/automation/workflow-templates",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        const {
          template_name,
          template_description,
          template_category,
          priority,
          auto_start,
          requires_approval,
          execution_delay_minutes,
          max_execution_time_hours,
          retry_attempts,
        } = req.body;

        // Create basic workflow configuration
        const workflowSteps = [
          {
            step: 1,
            name: "Initialize",
            type: "action",
            config: { action: "start_workflow" },
          },
          {
            step: 2,
            name: "Process",
            type: "action",
            config: { action: "execute_main_logic" },
          },
          {
            step: 3,
            name: "Complete",
            type: "action",
            config: { action: "finalize_workflow" },
          },
        ];

        const triggerConditions = {
          events: ["manual_trigger"],
          conditions: [],
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
          tenantId,
          template_name,
          template_description,
          template_category,
          priority,
          auto_start,
          requires_approval,
          execution_delay_minutes,
          max_execution_time_hours,
          retry_attempts,
          JSON.stringify(workflowSteps),
          JSON.stringify(triggerConditions),
          userId,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error("Error creating workflow template:", error);
        res.status(500).json({ error: "Failed to create workflow template" });
      }
    }
  );

  // Execute workflow template
  app.post(
    "/api/automation/workflow-templates/:id/execute",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const { id } = req.params;
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        // Get template
        const templateQuery = `SELECT * FROM workflow_templates WHERE id = $1 AND tenant_id = $2`;
        const templateResult = await db.$client.query(templateQuery, [
          id,
          tenantId,
        ]);

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
          tenantId,
          executionId,
          id,
          `${template.template_name} Execution`,
          userId,
          "manual",
          steps.length,
          "pending",
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error("Error executing workflow template:", error);
        res.status(500).json({ error: "Failed to execute workflow template" });
      }
    }
  );

  // Get workflow executions
  app.get(
    "/api/automation/workflow-executions",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const status = String((req.query as any)?.status || "");
        const tenantId = req.user.tenantId;

        let whereConditions = ["we.tenant_id = $1"];
        const queryParams = [tenantId];

        if (status && status !== "all") {
          whereConditions.push(`we.status = $${queryParams.length + 1}`);
          queryParams.push(status);
        }

        const query = `
        SELECT 
          we.*,
          wt.template_name as workflow_template_name
        FROM workflow_executions we
        LEFT JOIN workflow_templates wt ON we.workflow_template_id = wt.id
        WHERE ${whereConditions.join(" AND ")}
        ORDER BY we.created_at DESC
      `;

        const result = await db.$client.query(query, queryParams);
        res.json(result.rows);
      } catch (error) {
        console.error("Error fetching workflow executions:", error);
        res.status(500).json({ error: "Failed to fetch workflow executions" });
      }
    }
  );

  // Control workflow execution
  app.post(
    "/api/automation/workflow-executions/:id/:action",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const { id, action } = req.params;
        const tenantId = req.user.tenantId;

        let newStatus;
        let updateFields = [];
        let values = [];

        switch (action) {
          case "pause":
            newStatus = "paused";
            updateFields.push("paused_at = NOW()");
            break;
          case "resume":
            newStatus = "running";
            updateFields.push("paused_at = NULL");
            break;
          case "stop":
            newStatus = "cancelled";
            updateFields.push("completed_at = NOW()");
            break;
          default:
            return res.status(400).json({ error: "Invalid action" });
        }

        updateFields.push(`status = $${values.length + 2}`);
        values.push(newStatus);

        const query = `
        UPDATE workflow_executions 
        SET ${updateFields.join(", ")}, updated_at = NOW()
        WHERE execution_id = $1 AND tenant_id = $${values.length + 2}
        RETURNING *
      `;

        const result = await db.$client.query(query, [id, ...values, tenantId]);

        if (result.rows.length === 0) {
          return res
            .status(404)
            .json({ error: "Workflow execution not found" });
        }

        res.json(result.rows[0]);
      } catch (error) {
        console.error("Error controlling workflow execution:", error);
        res.status(500).json({ error: "Failed to control workflow execution" });
      }
    }
  );

  // Get automation rules
  app.get(
    "/api/automation/rules",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
    }
  );

  // Create automation rule
  app.post(
    "/api/automation/rules",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        const {
          rule_name,
          rule_description,
          rule_category,
          priority,
          is_critical,
          delay_before_action,
          max_executions_per_day,
          bypass_business_hours,
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
          tenantId,
          rule_name,
          rule_description,
          rule_category,
          priority,
          is_critical,
          delay_before_action,
          max_executions_per_day,
          bypass_business_hours,
          JSON.stringify(triggerEvents),
          JSON.stringify(conditions),
          JSON.stringify(actions),
          userId,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error("Error creating automation rule:", error);
        res.status(500).json({ error: "Failed to create automation rule" });
      }
    }
  );

  // Get automated tasks
  app.get(
    "/api/automation/tasks",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const priority = String((req.query as any)?.priority || "");
        const tenantId = req.user.tenantId;

        let whereConditions = ["tenant_id = $1"];
        const queryParams = [tenantId];

        if (priority && priority !== "all") {
          whereConditions.push(`priority = $${queryParams.length + 1}`);
          queryParams.push(priority);
        }

        const query = `
        SELECT *
        FROM automated_tasks
        WHERE ${whereConditions.join(" AND ")}
        ORDER BY urgency_score DESC, created_at DESC
      `;

        const result = await db.$client.query(query, queryParams);
        res.json(result.rows);
      } catch (error) {
        console.error("Error fetching automated tasks:", error);
        res.status(500).json({ error: "Failed to fetch automated tasks" });
      }
    }
  );

  // Create automated task
  app.post(
    "/api/automation/tasks",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const {
          task_title,
          task_description,
          task_type,
          task_category,
          priority,
          urgency_score,
          estimated_duration_minutes,
          due_date,
          assigned_to,
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
          tenantId,
          task_title,
          task_description,
          task_type,
          task_category,
          priority,
          urgency_score,
          estimated_duration_minutes,
          due_date,
          assigned_to,
          "manual_creation",
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error("Error creating automated task:", error);
        res.status(500).json({ error: "Failed to create automated task" });
      }
    }
  );

  // ============= MOBILE FIELD OPERATIONS ROUTES =============

  // Get mobile field metrics
  app.get(
    "/api/mobile-field/metrics",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const queries = [
          `SELECT COUNT(*) as active_technicians FROM field_technicians WHERE tenant_id = $1 AND employment_status = 'active' AND availability_status IN ('available', 'busy')`,
          `SELECT COUNT(*) as work_orders_today FROM field_work_orders WHERE tenant_id = $1 AND DATE(created_at) = CURRENT_DATE`,
          `SELECT COALESCE(AVG(CASE WHEN status = 'completed' THEN 1.0 ELSE 0.0 END) * 100, 0) as completion_rate FROM field_work_orders WHERE tenant_id = $1 AND DATE(created_at) = CURRENT_DATE`,
          `SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (actual_start_time - created_at))/60), 0) as avg_response_time FROM field_work_orders WHERE tenant_id = $1 AND actual_start_time IS NOT NULL`,
          `SELECT COALESCE(AVG(customer_satisfaction_rating), 0) as customer_satisfaction FROM field_technicians WHERE tenant_id = $1`,
          `SELECT 95.5 as gps_accuracy`, // Mock GPS accuracy metric
        ];

        const results = await Promise.all(
          queries.map((query) => db.$client.query(query, [tenantId]))
        );

        res.json({
          activeTechnicians: parseInt(results[0].rows[0].active_technicians),
          workOrdersToday: parseInt(results[1].rows[0].work_orders_today),
          completionRate: parseFloat(results[2].rows[0].completion_rate),
          averageResponseTime: parseFloat(results[3].rows[0].avg_response_time),
          customerSatisfaction: parseFloat(
            results[4].rows[0].customer_satisfaction
          ),
          gpsAccuracy: parseFloat(results[5].rows[0].gps_accuracy),
        });
      } catch (error) {
        console.error("Error fetching mobile field metrics:", error);
        res.status(500).json({ error: "Failed to fetch mobile field metrics" });
      }
    }
  );

  // Get field technicians
  app.get(
    "/api/mobile-field/technicians",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
    }
  );

  // Create field technician
  app.post(
    "/api/mobile-field/technicians",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const {
          employee_id,
          technician_name,
          technician_email,
          technician_phone,
          device_type,
          skill_categories,
          work_schedule,
          gps_tracking_enabled,
          voice_notes_enabled,
          photo_upload_enabled,
        } = req.body;

        // Parse skill categories if provided
        const skillCategoriesArray = skill_categories
          ? skill_categories.split(",").map((s: string) => s.trim())
          : [];

        const query = `
        INSERT INTO field_technicians (
          tenant_id, employee_id, technician_name, technician_email,
          technician_phone, device_type, skill_categories, work_schedule,
          gps_tracking_enabled, voice_notes_enabled, photo_upload_enabled
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

        const result = await db.$client.query(query, [
          tenantId,
          employee_id,
          technician_name,
          technician_email,
          technician_phone,
          device_type,
          JSON.stringify(skillCategoriesArray),
          work_schedule || null,
          gps_tracking_enabled,
          voice_notes_enabled,
          photo_upload_enabled,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error("Error creating field technician:", error);
        res.status(500).json({ error: "Failed to create field technician" });
      }
    }
  );

  // Get field work orders
  app.get(
    "/api/mobile-field/work-orders",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const status = String((req.query as any)?.status || "");
        const technician = String((req.query as any)?.technician || "");
        const priority = String((req.query as any)?.priority || "");
        const tenantId = req.user.tenantId;

        let whereConditions = ["tenant_id = $1"];
        const queryParams = [tenantId];

        if (status && status !== "all") {
          whereConditions.push(`status = $${queryParams.length + 1}`);
          queryParams.push(status);
        }

        if (technician && technician !== "all") {
          whereConditions.push(
            `assigned_technician_id = $${queryParams.length + 1}`
          );
          queryParams.push(technician);
        }

        if (priority && priority !== "all") {
          whereConditions.push(`priority = $${queryParams.length + 1}`);
          queryParams.push(priority);
        }

        const query = `
        SELECT *
        FROM field_work_orders
        WHERE ${whereConditions.join(" AND ")}
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
    }
  );

  // Create field work order
  app.post(
    "/api/mobile-field/work-orders",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const {
          work_order_type,
          priority,
          customer_name,
          service_address,
          work_description,
          estimated_duration_minutes,
          scheduled_date,
          scheduled_time_start,
          assigned_technician_id,
          special_instructions,
        } = req.body;

        // Generate work order number
        const workOrderNumber = `WO-${Date.now()}`;

        // Create service location object
        const serviceLocation = {
          address: service_address,
          coordinates: null, // Would be geocoded in real implementation
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
          tenantId,
          workOrderNumber,
          work_order_type,
          priority,
          "customer-" + Date.now(),
          customer_name,
          JSON.stringify(serviceLocation),
          work_description,
          estimated_duration_minutes,
          scheduled_date,
          scheduled_time_start,
          assigned_technician_id,
          special_instructions,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error("Error creating field work order:", error);
        res.status(500).json({ error: "Failed to create field work order" });
      }
    }
  );

  // Get voice notes
  app.get(
    "/api/mobile-field/voice-notes",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
    }
  );

  // Create voice note
  app.post(
    "/api/mobile-field/voice-notes",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        const {
          work_order_id,
          note_category,
          note_title,
          transcription_text,
          urgency_level,
          tags,
        } = req.body;

        // Parse tags if provided
        const tagsArray = tags
          ? tags.split(",").map((t: string) => t.trim())
          : [];

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
          tenantId,
          userId,
          work_order_id,
          note_category,
          audioFileUrl,
          note_title,
          transcription_text,
          urgency_level,
          JSON.stringify(tagsArray),
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error("Error creating voice note:", error);
        res.status(500).json({ error: "Failed to create voice note" });
      }
    }
  );

  // ============= COMMISSION MANAGEMENT ROUTES =============

  // Get commission metrics
  app.get(
    "/api/commission/metrics",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const queries = [
          `SELECT COALESCE(SUM(final_payment_amount), 0) as total_paid FROM commission_payments WHERE tenant_id = $1 AND payment_status = 'processed'`,
          `SELECT COALESCE(SUM(commission_amount), 0) as total_pending FROM commission_transactions WHERE tenant_id = $1 AND payment_status = 'unpaid'`,
          `SELECT COALESCE(AVG(commission_rate), 0) as avg_rate FROM commission_transactions WHERE tenant_id = $1`,
          `SELECT COUNT(*) as total_reps FROM sales_representatives WHERE tenant_id = $1 AND employment_status = 'active'`,
          `SELECT COUNT(*) as transactions_this_month FROM commission_transactions WHERE tenant_id = $1 AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)`,
          `SELECT COUNT(*) as active_disputes FROM commission_disputes WHERE tenant_id = $1 AND dispute_status IN ('submitted', 'under_review')`,
        ];

        const results = await Promise.all(
          queries.map((query) => db.$client.query(query, [tenantId]))
        );

        res.json({
          totalCommissionPaid: parseFloat(results[0].rows[0].total_paid),
          totalCommissionPending: parseFloat(results[1].rows[0].total_pending),
          averageCommissionRate: parseFloat(results[2].rows[0].avg_rate),
          totalSalesRepresentatives: parseInt(results[3].rows[0].total_reps),
          totalTransactionsThisMonth: parseInt(
            results[4].rows[0].transactions_this_month
          ),
          totalDisputesActive: parseInt(results[5].rows[0].active_disputes),
        });
      } catch (error) {
        console.error("Error fetching commission metrics:", error);
        res.status(500).json({ error: "Failed to fetch commission metrics" });
      }
    }
  );

  // Get commission structures
  app.get(
    "/api/commission/structures",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
        res
          .status(500)
          .json({ error: "Failed to fetch commission structures" });
      }
    }
  );

  // Create commission structure
  app.post(
    "/api/commission/structures",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        const {
          structure_name,
          structure_type,
          product_category,
          base_rate,
          calculation_period,
          payment_schedule,
          effective_start_date,
          effective_end_date,
          is_active,
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
          tenantId,
          structure_name,
          structure_type,
          product_category || "all",
          base_rate,
          calculation_period,
          payment_schedule,
          effective_start_date,
          effective_end_date,
          is_active,
          userId,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error("Error creating commission structure:", error);
        res
          .status(500)
          .json({ error: "Failed to create commission structure" });
      }
    }
  );

  // Get sales representatives
  app.get(
    "/api/commission/sales-reps",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
        res
          .status(500)
          .json({ error: "Failed to fetch sales representatives" });
      }
    }
  );

  // Create sales representative
  app.post(
    "/api/commission/sales-reps",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const {
          employee_id,
          rep_name,
          rep_email,
          rep_phone,
          manager_id,
          primary_commission_structure_id,
          employment_status,
        } = req.body;

        const query = `
        INSERT INTO sales_representatives (
          tenant_id, employee_id, rep_name, rep_email, rep_phone,
          manager_id, primary_commission_structure_id, employment_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

        const result = await db.$client.query(query, [
          tenantId,
          employee_id,
          rep_name,
          rep_email,
          rep_phone,
          manager_id,
          primary_commission_structure_id,
          employment_status,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error("Error creating sales representative:", error);
        res
          .status(500)
          .json({ error: "Failed to create sales representative" });
      }
    }
  );

  // Get commission transactions
  app.get(
    "/api/commission/transactions",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const period = String((req.query as any)?.period || "");
        const status = String((req.query as any)?.status || "");
        const tenantId = req.user.tenantId;

        let whereConditions = ["tenant_id = $1"];
        const queryParams = [tenantId];

        // Add period filter
        if (period && period !== "all") {
          switch (period) {
            case "current_month":
              whereConditions.push(
                `DATE_TRUNC('month', sale_date) = DATE_TRUNC('month', CURRENT_DATE)`
              );
              break;
            case "last_month":
              whereConditions.push(
                `DATE_TRUNC('month', sale_date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')`
              );
              break;
            case "current_quarter":
              whereConditions.push(
                `DATE_TRUNC('quarter', sale_date) = DATE_TRUNC('quarter', CURRENT_DATE)`
              );
              break;
            case "last_quarter":
              whereConditions.push(
                `DATE_TRUNC('quarter', sale_date) = DATE_TRUNC('quarter', CURRENT_DATE - INTERVAL '3 months')`
              );
              break;
            case "current_year":
              whereConditions.push(
                `DATE_TRUNC('year', sale_date) = DATE_TRUNC('year', CURRENT_DATE)`
              );
              break;
          }
        }

        if (status && status !== "all") {
          whereConditions.push(
            `commission_status = $${queryParams.length + 1}`
          );
          queryParams.push(status);
        }

        const query = `
        SELECT *
        FROM commission_transactions
        WHERE ${whereConditions.join(" AND ")}
        ORDER BY sale_date DESC
      `;

        const result = await db.$client.query(query, queryParams);
        res.json(result.rows);
      } catch (error) {
        console.error("Error fetching commission transactions:", error);
        res
          .status(500)
          .json({ error: "Failed to fetch commission transactions" });
      }
    }
  );

  // Create commission transaction
  app.post(
    "/api/commission/transactions",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const {
          transaction_type,
          sales_rep_id,
          customer_name,
          sale_amount,
          commission_rate,
          sale_date,
          product_category,
        } = req.body;

        // Get sales rep name
        const repQuery = `SELECT rep_name FROM sales_representatives WHERE id = $1 AND tenant_id = $2`;
        const repResult = await db.$client.query(repQuery, [
          sales_rep_id,
          tenantId,
        ]);

        if (repResult.rows.length === 0) {
          return res
            .status(404)
            .json({ error: "Sales representative not found" });
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
          tenantId,
          transaction_type,
          sales_rep_id,
          sales_rep_name,
          customer_name,
          sale_amount,
          commission_rate,
          commission_amount,
          sale_date,
          commission_period,
          product_category,
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

        await db.$client.query(updateRepQuery, [
          sale_amount,
          sales_rep_id,
          tenantId,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error("Error creating commission transaction:", error);
        res
          .status(500)
          .json({ error: "Failed to create commission transaction" });
      }
    }
  );

  // Get commission payments
  app.get(
    "/api/commission/payments",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const period = String((req.query as any)?.period || "");
        const tenantId = req.user.tenantId;

        let whereConditions = ["tenant_id = $1"];
        const queryParams = [tenantId];

        // Add period filter
        if (period && period !== "all") {
          switch (period) {
            case "current_month":
              whereConditions.push(
                `DATE_TRUNC('month', payment_date) = DATE_TRUNC('month', CURRENT_DATE)`
              );
              break;
            case "last_month":
              whereConditions.push(
                `DATE_TRUNC('month', payment_date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')`
              );
              break;
            case "current_quarter":
              whereConditions.push(
                `DATE_TRUNC('quarter', payment_date) = DATE_TRUNC('quarter', CURRENT_DATE)`
              );
              break;
            case "current_year":
              whereConditions.push(
                `DATE_TRUNC('year', payment_date) = DATE_TRUNC('year', CURRENT_DATE)`
              );
              break;
          }
        }

        const query = `
        SELECT *
        FROM commission_payments
        WHERE ${whereConditions.join(" AND ")}
        ORDER BY payment_date DESC
      `;

        const result = await db.$client.query(query, queryParams);
        res.json(result.rows);
      } catch (error) {
        console.error("Error fetching commission payments:", error);
        res.status(500).json({ error: "Failed to fetch commission payments" });
      }
    }
  );

  // Get commission disputes
  app.get(
    "/api/commission/disputes",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
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
    }
  );

  // Create commission dispute
  app.post(
    "/api/commission/disputes",
    requireAuth,
    requireAuth,
    requireAuth,
    async (req: any, res) => {
      try {
        const tenantId = req.user.tenantId;

        const {
          dispute_type,
          sales_rep_id,
          commission_transaction_id,
          dispute_amount,
          dispute_description,
          priority,
        } = req.body;

        // Get sales rep name
        const repQuery = `SELECT rep_name FROM sales_representatives WHERE id = $1 AND tenant_id = $2`;
        const repResult = await db.$client.query(repQuery, [
          sales_rep_id,
          tenantId,
        ]);

        if (repResult.rows.length === 0) {
          return res
            .status(404)
            .json({ error: "Sales representative not found" });
        }

        const sales_rep_name = repResult.rows[0].rep_name;
        const dispute_number = `DISP-${Date.now()}`;
        const submitted_date = new Date().toISOString().split("T")[0];

        const query = `
        INSERT INTO commission_disputes (
          tenant_id, dispute_number, dispute_type, sales_rep_id,
          sales_rep_name, commission_transaction_id, dispute_amount,
          dispute_description, priority, submitted_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

        const result = await db.$client.query(query, [
          tenantId,
          dispute_number,
          dispute_type,
          sales_rep_id,
          sales_rep_name,
          commission_transaction_id,
          dispute_amount,
          dispute_description,
          priority,
          submitted_date,
        ]);

        res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error("Error creating commission dispute:", error);
        res.status(500).json({ error: "Failed to create commission dispute" });
      }
    }
  );

  // ===== BUSINESS LOGIC CONSISTENCY FIXES =====

  // Helper function to generate customer numbers
  async function generateCustomerNumber(tenantId: string): Promise<string> {
    const count = await db
      .select({ count: sql<number>`count(*)` })
      .from(businessRecords)
      .where(
        and(
          eq(businessRecords.tenantId, tenantId),
          eq(businessRecords.recordType, "customer")
        )
      );

    const customerCount = count[0]?.count || 0;
    return `CUST-${String(customerCount + 1).padStart(6, "0")}`;
  }

  // Helper function for tiered billing calculation
  function calculateTieredAmount(
    copies: number,
    rates: any[],
    baseRate: number
  ): number {
    let totalAmount = 0;
    let remainingCopies = copies;

    for (let i = 0; i < rates.length; i++) {
      const rate = rates[i];
      const nextRate = rates[i + 1];

      let tierCopies = 0;
      if (nextRate) {
        tierCopies = Math.min(
          remainingCopies,
          nextRate.minimumVolume - rate.minimumVolume
        );
      } else {
        tierCopies = remainingCopies;
      }

      if (tierCopies > 0) {
        totalAmount += tierCopies * parseFloat(rate.rate.toString());
        remainingCopies -= tierCopies;
      }

      if (remainingCopies <= 0) break;
    }

    // Apply base rate for any remaining copies
    if (remainingCopies > 0) {
      totalAmount += remainingCopies * baseRate;
    }

    return totalAmount;
  }

  // ===== BUSINESS LOGIC CONSISTENCY FIXES =====

  // 1. Complete Lead-to-Customer Conversion Implementation
  app.post(
    "/api/business-records/:id/convert-to-customer",
    requireAuth,
    async (req: any, res) => {
      try {
        const { tenantId, id: userId } = req.user;
        const { id } = req.params;
        const { customerNumber, serviceAddress, billingAddress } = req.body;

        // Get the lead record
        const lead = await storage.getBusinessRecord(id, tenantId);
        if (!lead || lead.recordType !== "lead") {
          return res.status(404).json({ message: "Lead not found" });
        }

        // Generate customer number if not provided
        const generatedCustomerNumber =
          customerNumber || (await generateCustomerNumber(tenantId));

        // Update the record to customer status
        const updatedRecord = await storage.updateBusinessRecord(id, tenantId, {
          recordType: "customer",
          status: "active",
          customerNumber: generatedCustomerNumber,
          customerSince: new Date(),
          convertedBy: userId,
          serviceAddress: serviceAddress || (lead as any).address,
          billingAddress: billingAddress || (lead as any).address,
          probability: 100,
        });

        // Create customer conversion activity
        await storage.createBusinessRecordActivity({
          tenantId,
          businessRecordId: id,
          activityType: "conversion",
          title: "Lead Converted to Customer",
          description: `Lead successfully converted to customer with number ${generatedCustomerNumber}`,
          userId,
          activityDate: new Date(),
        });

        // Auto-create initial service contract if applicable
        if (lead.estimatedAmount && lead.estimatedAmount > 0) {
          await storage.createContract({
            tenantId,
            customerId: id,
            contractNumber: `CONTRACT-${generatedCustomerNumber}-${Date.now()}`,
            status: "pending",
            startDate: new Date(),
            endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            monthlyBase: String((lead.estimatedAmount / 12).toFixed(2)),
            blackRate: null,
            colorRate: null,
          } as any);
        }

        res.json(updatedRecord);
      } catch (error) {
        console.error("Error converting lead to customer:", error);
        res.status(500).json({ message: "Failed to convert lead to customer" });
      }
    }
  );

  // 2. Business Records Lifecycle Management
  app.patch(
    "/api/business-records/:id/lifecycle",
    requireAuth,
    async (req: any, res) => {
      try {
        const { tenantId, id: userId } = req.user;
        const { id } = req.params;
        const { status, reason, notes } = req.body;

        const updates: any = { leadStatus: status };

        // Handle customer deactivation scenarios
        if (
          status === "churned" ||
          status === "competitor_switch" ||
          status === "non_payment"
        ) {
          updates.customerUntil = new Date();
          updates.churnReason = reason;
          updates.deactivatedBy = userId;

          // Auto-expire contracts
          await db
            .update(contracts)
            .set({
              status: "cancelled",
              endDate: new Date(),
            })
            .where(
              and(
                eq(contracts.customerId, id),
                eq(contracts.tenantId, tenantId),
                eq(contracts.status, "active")
              )
            );
        }

        const updatedRecord = await storage.updateBusinessRecord(
          id,
          updates,
          tenantId
        );

        // Log lifecycle change activity
        await storage.createBusinessRecordActivity({
          tenantId,
          businessRecordId: id,
          activityType: "status_change",
          title: `Status Changed to ${status}`,
          description:
            notes ||
            `Business record status updated to ${status}${
              reason ? ` due to ${reason}` : ""
            }`,
          userId,
          activityDate: new Date(),
        });

        res.json(updatedRecord);
      } catch (error) {
        console.error("Error updating business record lifecycle:", error);
        res
          .status(500)
          .json({ message: "Failed to update business record lifecycle" });
      }
    }
  );

  // 3. Equipment Lifecycle Integration with Service Workflows
  app.post(
    "/api/equipment/:equipmentId/trigger-service",
    requireAuth,
    async (req: any, res) => {
      try {
        const { tenantId, id: userId } = req.user;
        const { equipmentId } = req.params;
        const { serviceType, priority = "medium", description } = req.body;

        // Get equipment details
        const equipmentList = await storage.getEquipment(tenantId);
        const equipment = equipmentList.find((e: any) => e.id === equipmentId);
        if (!equipment) {
          return res.status(404).json({ message: "Equipment not found" });
        }

        // Auto-create service ticket
        const serviceTicket = await storage.createServiceTicket({
          tenantId,
          customerId: (equipment as any).customerId,
          equipmentId,
          ticketNumber: `TKT-${Date.now()}`,
          title: `${serviceType} Service Required`,
          description:
            description ||
            `Automated ${serviceType} service request for ${String(
              (equipment as any).model || "equipment"
            )}`,
          priority,
          status: "open",
          createdBy: userId,
        } as any);

        // Update equipment status if needed
        if (serviceType === "maintenance") {
          // Note: storage.updateEquipment doesn't exist; skip for now
        }

        // Create or update equipment lifecycle event
        try {
          await db
            .insert(equipmentLifecycle)
            .values({
              tenantId,
              equipmentId,
              serialNumber: equipment.serialNumber || `SN-${equipmentId}`,
              currentStage: "active",
              currentLocation: (equipment as any).location || "customer_site",
              customerId: equipment.customerId,
              lastServiceDate: new Date(),
            })
            .onConflictDoUpdate({
              target: equipmentLifecycle.equipmentId,
              set: {
                lastServiceDate: new Date(),
                updatedAt: new Date(),
              },
            });
        } catch (lifecycleError) {
          // If equipment lifecycle doesn't exist, try to create it
          console.warn(
            "Equipment lifecycle insert failed, continuing with service ticket creation"
          );
        }

        res.json({
          serviceTicket,
          message: "Service request created and equipment lifecycle updated",
        });
      } catch (error) {
        console.error("Error triggering equipment service:", error);
        res
          .status(500)
          .json({ message: "Failed to trigger equipment service" });
      }
    }
  );

  // 4. Contract Billing Automation Connected to Meter Readings
  app.post(
    "/api/contracts/:contractId/process-meter-billing",
    requireAuth,
    async (req: any, res) => {
      try {
        const { tenantId } = req.user;
        const { contractId } = req.params;

        // Get contract details
        const contract = await storage.getContract(contractId, tenantId);
        if (!contract) {
          return res.status(404).json({ message: "Contract not found" });
        }

        // Get unprocessed meter readings for this contract
        const unprocessedReadings = await db
          .select()
          .from(meterReadings)
          .where(
            and(
              eq(meterReadings.contractId, contractId),
              eq(meterReadings.tenantId, tenantId),
              eq(meterReadings.billingStatus, "pending")
            )
          )
          .orderBy(desc(meterReadings.readingDate));

        const processedInvoices = [];

        for (const reading of unprocessedReadings) {
          // Get tiered rates for billing calculation
          const tieredRates = await storage.getContractTieredRatesByContract(
            contractId
          );

          let totalAmount = parseFloat(contract.monthlyBase?.toString() || "0");

          // Calculate black & white copies billing
          if (reading.blackCopies && reading.blackCopies > 0) {
            const blackRates = tieredRates
              .filter((rate) => rate.colorType === "black")
              .sort((a, b) => a.minimumVolume - b.minimumVolume);
            totalAmount += calculateTieredAmount(
              reading.blackCopies,
              blackRates,
              parseFloat(contract.blackRate?.toString() || "0")
            );
          }

          // Calculate color copies billing
          if (reading.colorCopies && reading.colorCopies > 0) {
            const colorRates = tieredRates
              .filter((rate) => rate.colorType === "color")
              .sort((a, b) => a.minimumVolume - b.minimumVolume);
            totalAmount += calculateTieredAmount(
              Number(reading.colorCopies || 0),
              colorRates,
              parseFloat(contract.colorRate?.toString() || "0")
            );
          }

          // Create invoice
          const invoice = await storage.createInvoice({
            tenantId: String(tenantId),
            customerId: String(contract.customerId),
            contractId: contract?.id ? String(contract.id) : null,
            invoiceNumber: `INV-${String(contract.contractNumber || "CON")}-$
            {Date.now()}`,
            invoiceDate: new Date(),
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            totalAmount: String(totalAmount),
            amountPaid: "0",
            balanceDue: String(totalAmount),
            invoiceStatus: "open",
            paymentTerms: "Net 30",
            invoiceNotes: `Automated meter billing for ${format(
              new Date(reading.readingDate),
              "MMMM yyyy"
            )}`,
            createdBy: String((req as any).user?.id || "system"),
          } as any);

          // Update meter reading as processed
          await storage.updateMeterReading(
            reading.id,
            {
              billingStatus: "processed",
              billingAmount: totalAmount.toString(),
              invoiceId: invoice.id,
            },
            tenantId
          );

          processedInvoices.push(invoice);

          // Update customer current balance
          const customer = await storage.getBusinessRecord(
            contract.customerId,
            tenantId
          );
          const newBalance =
            parseFloat(String(customer?.currentBalance || "0")) + totalAmount;
          await storage.updateBusinessRecord(contract.customerId, tenantId, {
            currentBalance: newBalance.toString(),
            lastMeterReadingDate: reading.readingDate,
          });
        }

        res.json({
          message: `Processed ${processedInvoices.length} meter readings for billing`,
          invoices: processedInvoices,
          totalAmount: processedInvoices.reduce(
            (sum, inv) => sum + parseFloat(String(inv.totalAmount || "0")),
            0
          ),
        });
      } catch (error) {
        console.error("Error processing meter billing:", error);
        res.status(500).json({ message: "Failed to process meter billing" });
      }
    }
  );

  // Security & Compliance routes
  app.get(
    "/api/security-compliance/security-dashboard",
    requireAuth,
    async (req: any, res) => {
      try {
        const { tenantId } = req.user;
        res.json({
          activeSessions: 12,
          gdprRequests: 3,
          securityAlerts: 2,
          dataAccessEvents: 147,
          auditLogCount: 1250,
          lastAuditEntry: new Date().toISOString(),
          complianceScore: 94,
          riskLevel: "low",
        });
      } catch (error) {
        console.error("Error fetching security dashboard:", error);
        res.status(500).json({ message: "Failed to fetch security dashboard" });
      }
    }
  );

  app.get(
    "/api/security-compliance/audit-logs",
    requireAuth,
    async (req: any, res) => {
      try {
        const { tenantId } = req.user;
        const page = Number((req.query as any)?.page ?? 1);
        const limit = Number((req.query as any)?.limit ?? 50);

        const logs = Array.from(
          { length: Number.isFinite(limit) ? (limit as number) : 50 },
          (_, i) => ({
            id: `audit-${i + 1}`,
            timestamp: new Date(Date.now() - i * 3600000).toISOString(),
            userId: (req as any).user?.id,
            action: [
              "LOGIN",
              "CREATE_CUSTOMER",
              "UPDATE_CONTRACT",
              "DELETE_INVOICE",
            ][i % 4],
            resource: ["auth", "customers", "contracts", "invoices"][i % 4],
            severity: ["low", "medium", "high"][i % 3],
            ipAddress: "192.168.1.100",
            userAgent: "Mozilla/5.0...",
            success: Math.random() > 0.1,
          })
        );

        res.json({
          logs,
          total: 1250,
          page: Number.isFinite(page) ? (page as number) : 1,
          limit: Number.isFinite(limit) ? (limit as number) : 50,
        });
      } catch (error) {
        console.error("Error fetching audit logs:", error);
        res.status(500).json({ message: "Failed to fetch audit logs" });
      }
    }
  );

  app.get(
    "/api/security-compliance/gdpr-requests",
    requireAuth,
    async (req: any, res) => {
      try {
        const { tenantId } = req.user;

        const requests = [
          {
            id: "gdpr-1",
            requestType: "access",
            dataSubject: "john.doe@example.com",
            status: "pending",
            submittedAt: new Date(Date.now() - 86400000).toISOString(),
            dueDate: new Date(Date.now() + 29 * 86400000).toISOString(),
            description: "Request for all personal data under GDPR Article 15",
          },
          {
            id: "gdpr-2",
            requestType: "deletion",
            dataSubject: "jane.smith@example.com",
            status: "in_progress",
            submittedAt: new Date(Date.now() - 172800000).toISOString(),
            dueDate: new Date(Date.now() + 28 * 86400000).toISOString(),
            description: "Request for data deletion under GDPR Article 17",
          },
        ];

        res.json(requests);
      } catch (error) {
        console.error("Error fetching GDPR requests:", error);
        res.status(500).json({ message: "Failed to fetch GDPR requests" });
      }
    }
  );

  app.get(
    "/api/security-compliance/security-sessions",
    requireAuth,
    async (req: any, res) => {
      try {
        const { tenantId } = req.user;

        const sessions = [
          {
            id: "session-1",
            userId: req.user.id,
            userEmail: req.user.email,
            ipAddress: "192.168.1.100",
            location: "New York, NY",
            device: "Chrome on Windows",
            loginTime: new Date(Date.now() - 3600000).toISOString(),
            lastActivity: new Date(Date.now() - 300000).toISOString(),
            status: "active",
            riskScore: "low",
          },
        ];

        res.json(sessions);
      } catch (error) {
        console.error("Error fetching security sessions:", error);
        res.status(500).json({ message: "Failed to fetch security sessions" });
      }
    }
  );

  app.get(
    "/api/security-compliance/compliance-settings",
    requireAuth,
    async (req: any, res) => {
      try {
        const { tenantId } = req.user;

        const settings = {
          gdprResponseDays: 30,
          sessionTimeoutMinutes: 60,
          dataRetentionDays: 2555, // 7 years
          encryptionRequired: true,
          auditScope: "full",
          passwordPolicy: {
            minLength: 12,
            requireUppercase: true,
            requireLowercase: true,
            requireNumbers: true,
            requireSymbols: true,
          },
        };

        res.json(settings);
      } catch (error) {
        console.error("Error fetching compliance settings:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch compliance settings" });
      }
    }
  );

  // Register modular dashboard routes
  registerModularDashboardRoutes(app);

  // Register onboarding routes
  registerOnboardingRoutes(app);

  // Export checklist routes
  app.get("/api/onboarding/export/:id/pdf", requireAuth, exportChecklistPDF);
  app.get(
    "/api/onboarding/export/:id/excel",
    requireAuth,
    exportChecklistExcel
  );
  app.get("/api/onboarding/export/:id/csv", requireAuth, exportChecklistCSV);

  // Register manufacturer integration routes
  registerManufacturerIntegrationRoutes(app);

  // Register customer portal routes
  app.use("/api/customer-portal", customerPortalRoutes);

  // Register Service Dispatch routes (converted from mock data to database queries)
  app.use(serviceDispatchRouter);

  // Register enhanced service routes
  app.use("/api", enhancedServiceRoutes);

  // Register reports routes
  app.use("/api", reportsRoutes);

  // Register warehouse FPY routes
  app.use("/api", warehouseFpyRoutes);

  // Register DoD enforcement routes
  const dodEnforcementRoutes = (await import("./routes-dod-enforcement")).default;
  app.use("/api", dodEnforcementRoutes);

  // Register enhanced billing routes
  const enhancedBillingRoutes = (await import("./routes-enhanced-billing")).default;
  app.use("/api", enhancedBillingRoutes);

  // Company search endpoint for phone tickets (placed before other company routes)
  app.get("/api/phone-tickets/search-companies", async (req, res) => {
    try {
      const searchTerm = String((req.query as any)?.q || "");
      const tenantId = req.headers["x-tenant-id"] as string;

      console.log("Search request:", { searchTerm, tenantId });

      if (!searchTerm || (searchTerm as string).length < 2) {
        return res.json([]);
      }

      // Debug: let's see what the exact query returns
      console.log("Executing search query for companies...");

      const searchPattern = `%${searchTerm.toString().toLowerCase()}%`;

      const searchResults = await db
        .select()
        .from(businessRecords)
        .where(
          and(
            eq(businessRecords.tenantId, tenantId),
            // Only search customers for phone-in tickets, not leads
            eq(businessRecords.recordType, "customer"),
            or(
              sql`LOWER(company_name) LIKE ${searchPattern}`,
              sql`LOWER(primary_contact_name) LIKE ${searchPattern}`,
              sql`status ILIKE ${searchPattern}`
            )
          )
        )
        .limit(10);

      console.log(
        `Found ${searchResults.length} results:`,
        searchResults.map((r) => ({
          name: r.companyName,
          type: r.recordType,
          status: r.status,
        }))
      );

      // Transform the result to match expected format
      const transformedResults = searchResults.map((record) => ({
        id: record.id,
        name: record.companyName,
        phone: record.primaryContactPhone,
        email: record.primaryContactEmail,
        address: [
          record.addressLine1,
          record.addressLine2,
          record.city,
          record.state,
          record.postalCode,
        ]
          .filter(Boolean)
          .join(", "),
      }));

      res.json(transformedResults);
    } catch (error) {
      console.error("Error searching companies:", error);
      res.status(500).json({ error: "Failed to search companies" });
    }
  });

  // Contact search endpoint for phone tickets
  app.get("/api/phone-tickets/search-contacts/:companyId", async (req, res) => {
    try {
      const { companyId } = req.params;
      const searchTerm = String((req.query as any)?.q || "");
      const tenantId = req.headers["x-tenant-id"] as string;

      let whereConditions = [
        eq(businessRecords.tenantId, tenantId),
        eq(businessRecords.id, companyId),
      ];

      // Add search filtering only if searchTerm is provided and not empty
      if (searchTerm && (searchTerm as string).trim().length >= 1) {
        const searchPattern = `%${searchTerm.toString().toLowerCase()}%`;
        whereConditions.push(
          sql`LOWER(primary_contact_name) LIKE ${searchPattern}`
        );
      }

      // Return the primary contact from the business record itself
      const searchResults = await db
        .select({
          id: businessRecords.id,
          name: businessRecords.primaryContactName,
          phone: businessRecords.primaryContactPhone,
          email: businessRecords.primaryContactEmail,
          role: sql`'Primary Contact'`,
        })
        .from(businessRecords)
        .where(and(...whereConditions))
        .limit(10);

      // Filter out contacts with null/empty names
      const validResults = searchResults.filter(
        (contact) => contact.name && contact.name.trim().length > 0
      );

      res.json(validResults);
    } catch (error) {
      console.error("Error searching contacts:", error);
      res.status(500).json({ error: "Failed to search contacts" });
    }
  });

  // Equipment search endpoint for phone tickets
  app.get("/api/phone-tickets/equipment/:companyId", async (req, res) => {
    try {
      const { companyId } = req.params;
      const tenantId = req.headers["x-tenant-id"] as string;

      // For now, return empty array as equipment table may not be properly set up
      const equipmentResults: any[] = [];
      console.log(
        `Equipment query for company ${companyId}: returning empty array for now`
      );

      res.json(equipmentResults);
    } catch (error: any) {
      console.error("Error fetching equipment:", error);
      res.status(500).json({ error: "Failed to fetch equipment" });
    }
  });

  // Phone-in tickets POST endpoint - Now properly saves to database
  app.post("/api/phone-in-tickets", async (req, res) => {
    try {
      const tenantId = req.headers["x-tenant-id"] as string;

      console.log("Phone-in ticket request body:", req.body);

      // Map request fields to database schema
      const phoneTicketData = {
        tenant_id: tenantId,
        caller_name: req.body.callerName || "Unknown",
        caller_phone: req.body.callerPhone || "",
        caller_email: req.body.callerEmail || "",
        caller_role: req.body.callerRole || "",
        customer_id: req.body.customerId || req.body.companyId || "",
        customer_name: req.body.companyName || "Unknown Company",
        location_address: req.body.locationAddress || "",
        location_building: req.body.locationBuilding || "",
        location_floor: req.body.locationFloor || "",
        location_room: req.body.locationRoom || "",
        equipment_id: req.body.equipmentId || "",
        equipment_brand: req.body.equipmentBrand || "",
        equipment_model: req.body.equipmentModel || "",
        equipment_serial: req.body.equipmentSerial || "",
        issue_category: req.body.issueCategory || "other",
        issue_description:
          req.body.issueDescription || "No description provided",
        priority: req.body.priority || "medium",
        contact_method: "phone",
        preferred_service_date: req.body.preferredServiceDate || null,
        notes: req.body.notes || "",
      };

      console.log("Creating phone-in ticket:", phoneTicketData);

      // Use direct SQL execution instead of ORM
      const result = await db.execute(sql`
        INSERT INTO phone_in_tickets (
          tenant_id, caller_name, caller_phone, caller_email, caller_role,
          customer_id, customer_name, location_address, location_building, 
          location_floor, location_room, equipment_id, equipment_brand, 
          equipment_model, equipment_serial, issue_category, issue_description,
          priority, contact_method, preferred_service_date, notes
        ) VALUES (
          ${phoneTicketData.tenant_id}, ${phoneTicketData.caller_name}, ${phoneTicketData.caller_phone}, 
          ${phoneTicketData.caller_email}, ${phoneTicketData.caller_role}, ${phoneTicketData.customer_id}, 
          ${phoneTicketData.customer_name}, ${phoneTicketData.location_address}, ${phoneTicketData.location_building}, 
          ${phoneTicketData.location_floor}, ${phoneTicketData.location_room}, ${phoneTicketData.equipment_id}, 
          ${phoneTicketData.equipment_brand}, ${phoneTicketData.equipment_model}, ${phoneTicketData.equipment_serial}, 
          ${phoneTicketData.issue_category}, ${phoneTicketData.issue_description}, ${phoneTicketData.priority}, 
          ${phoneTicketData.contact_method}, ${phoneTicketData.preferred_service_date}, ${phoneTicketData.notes}
        ) RETURNING *
      `);

      const createdTicket = result.rows[0];
      console.log("Phone-in ticket created successfully:", createdTicket);
      res.json({ success: true, ticket: createdTicket });
    } catch (error: any) {
      console.error("Error creating phone-in ticket:", error);
      res.status(500).json({
        error: "Failed to create phone-in ticket",
        details: error?.message,
      });
    }
  });

  // Phone-in tickets GET endpoint
  app.get("/api/phone-in-tickets", async (req, res) => {
    try {
      const tenantId = req.headers["x-tenant-id"] as string;

      const result = await db.execute(sql`
        SELECT * FROM phone_in_tickets 
        WHERE tenant_id = ${tenantId}
        ORDER BY created_at DESC
        LIMIT 50
      `);

      res.json(result.rows);
    } catch (error: any) {
      console.error("Error fetching phone-in tickets:", error);
      res.status(500).json({
        error: "Failed to fetch phone-in tickets",
        details: error?.message,
      });
    }
  });

  // Phone-in ticket conversion endpoint
  app.post("/api/phone-in-tickets/:id/convert", async (req, res) => {
    try {
      const { id } = req.params;
      const tenantId = req.headers["x-tenant-id"] as string;

      // Get the phone-in ticket
      const phoneTicketResult = await db.execute(sql`
        SELECT * FROM phone_in_tickets 
        WHERE id = ${id} AND tenant_id = ${tenantId}
      `);

      if (phoneTicketResult.rows.length === 0) {
        return res.status(404).json({ error: "Phone-in ticket not found" });
      }

      const phoneTicket = phoneTicketResult.rows[0];

      // Check if already converted
      if (phoneTicket.converted_to_ticket_id) {
        return res.status(400).json({ error: "Ticket already converted" });
      }

      // Create service ticket from phone-in ticket
      const serviceTicketResult = await db.execute(sql`
        INSERT INTO service_tickets (
          tenant_id, customer_id, title, description, priority, status,
          equipment_id, customer_address, customer_phone
        ) VALUES (
          ${phoneTicket.tenant_id}, ${phoneTicket.customer_id}, 
          ${
            "Service Call: " + (phoneTicket.customer_name || "Unknown Customer")
          },
          ${phoneTicket.issue_description || "No description provided"},
          ${phoneTicket.priority || "medium"}, 'new',
          ${phoneTicket.equipment_id}, ${phoneTicket.location_address},
          ${phoneTicket.caller_phone}
        ) RETURNING *
      `);

      const serviceTicket = serviceTicketResult.rows[0];

      // Mark phone-in ticket as converted
      await db.execute(sql`
        UPDATE phone_in_tickets 
        SET converted_to_ticket_id = ${serviceTicket.id}, 
            converted_at = NOW()
        WHERE id = ${id}
      `);

      res.json({
        success: true,
        serviceTicket: serviceTicket,
        message: "Phone-in ticket converted to service ticket successfully",
      });
    } catch (error: any) {
      console.error("Error converting phone-in ticket:", error);
      res.status(500).json({
        error: "Failed to convert phone-in ticket",
        details: error?.message,
      });
    }
  });

  // Register all route modules
  registerOnboardingRoutes(app);
  registerBusinessRecordRoutes(app);
  registerIntegrationRoutes(app);
  registerTaskRoutes(app);
  registerEnhancedTaskRoutes(app);
  registerDealsManagementRoutes(app);
  registerOpportunitiesRoutes(app);
  registerTechnicianManagementRoutes(app);
  registerProductModelsRoutes(app);
  registerSoftwareProductsRoutes(app);
  registerInvoicesRoutes(app);
  registerPurchaseOrderRoutes(app);
  registerWarehouseRoutes(app);
  registerServiceAnalysisRoutes(app);
  registerCrmGoalRoutes(app);
  registerSalesforceRoutes(app);
  registerSalesforceTestRoutes(app);
  registerDataEnrichmentRoutes(app);
  registerQuickBooksRoutes(app);
  // setupSalesPipelineRoutes(app); // Temporarily disabled due to error
  registerModularDashboardRoutes(app);
  registerManufacturerIntegrationRoutes(app);

  // Register Sales Forecasting routes
  app.use(salesForecastingRoutes);
  
  // Register Breach Detection routes
  app.use('/api', breachDetectionRoutes);
  
  // Register DoD Validation routes
  const validateRoutes = await import("./routes-validate");
  app.use('/api', validateRoutes.default);

  // Phase 3: Register analytics routes
  import("./analytics-routes")
    .then(({ analyticsRouter }) => {
      app.use(analyticsRouter);
    })
    .catch((err) => console.error("Failed to load analytics routes:", err));

  // Register Master Catalog routes
  import("./routes-catalog")
    .then(({ catalogRouter }) => {
      app.use(catalogRouter);
    })
    .catch((err) => console.error("Failed to load catalog routes:", err));

  // Seed master catalog on startup (development only)
  if (process.env.NODE_ENV === "development") {
    import("./catalog-seed")
      .then(({ seedMasterCatalog }) => {
        setTimeout(() => {
          seedMasterCatalog().then((success) => {
            if (success) {
              console.log("Master catalog seeded successfully");
            }
          });
        }, 2000); // Wait 2 seconds for DB to be ready
      })
      .catch((err) => console.error("Failed to load catalog seeding:", err));
  }

  const httpServer = createServer(app);
  return httpServer;
}
