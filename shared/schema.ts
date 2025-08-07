import { sql, relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  pgEnum,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export equipment schemas
export {
  warehouseOperations,
  equipmentLifecycle,
  deliverySchedules,
  installationSchedules,
  complianceDocuments,
  technicianCertifications,
  insertWarehouseOperationSchema,
  insertEquipmentLifecycleSchema,
  insertDeliveryScheduleSchema,
  insertInstallationScheduleSchema,
  insertComplianceDocumentSchema,
  insertTechnicianCertificationSchema,
} from "./equipment-schema";

// Re-export service analysis schemas
export {
  serviceCallAnalysis,
  servicePartsUsed,
  partsOrders,
  partsOrderItems,
  serviceOutcomeEnum,
  partsOrderStatusEnum,
  analysisTypeEnum,
  insertServiceCallAnalysisSchema,
  insertServicePartsUsedSchema,
  insertPartsOrderSchema,
  insertPartsOrderItemSchema,
} from "./service-analysis-schema";

export type {
  ServiceCallAnalysis,
  ServicePartsUsed,
  PartsOrder,
  PartsOrderItem,
  InsertServiceCallAnalysis,
  InsertServicePartsUsed,
  InsertPartsOrder,
  InsertPartsOrderItem,
} from "./service-analysis-schema";

// Re-export mobile service schemas
export {
  mobileServiceSessions,
  timeTrackingEntries,
  servicePhotos,
  locationHistory,
  fieldServiceStatusEnum,
  checkInTypeEnum,
  insertMobileServiceSessionSchema,
  insertTimeTrackingEntrySchema,
  insertServicePhotoSchema,
  insertLocationHistorySchema,
} from "./mobile-service-schema";

// Re-export manufacturer integration schemas
export {
  manufacturerIntegrations,
  deviceRegistrations,
  deviceMetrics,
  integrationAuditLogs,
  thirdPartyIntegrations,
  manufacturerEnum,
  integrationStatusEnum,
  collectionFrequencyEnum,
  deviceStatusEnum,
  authMethodEnum,
  insertManufacturerIntegrationSchema,
  insertDeviceRegistrationSchema,
  insertDeviceMetricSchema,
  insertIntegrationAuditLogSchema,
  insertThirdPartyIntegrationSchema,
  manufacturerIntegrationsRelations,
  deviceRegistrationsRelations,
  deviceMetricsRelations,
  integrationAuditLogsRelations,
} from "./manufacturer-integration-schema";

export type {
  MobileServiceSession,
  TimeTrackingEntry,
  ServicePhoto,
  LocationHistory,
  InsertMobileServiceSession,
  InsertTimeTrackingEntry,
  InsertServicePhoto,
  InsertLocationHistory,
} from "./mobile-service-schema";

export type {
  ManufacturerIntegration,
  InsertManufacturerIntegration,
  DeviceRegistration,
  InsertDeviceRegistration,
  DeviceMetric,
  InsertDeviceMetric,
  IntegrationAuditLog,
  InsertIntegrationAuditLog,
  ThirdPartyIntegration,
  InsertThirdPartyIntegration,
} from "./manufacturer-integration-schema";

// Re-export QuickBooks integration schemas
export {
  qbVendors,
  glAccounts,
  paymentTerms,
  paymentMethods,
  quickbooksIntegrations,
  vendorBills,
  insertQbVendorSchema,
  insertGlAccountSchema,
  insertPaymentTermSchema,
  insertPaymentMethodSchema,
  insertQuickbooksIntegrationSchema,
  insertVendorBillSchema,
} from "./quickbooks-schema";

// Re-export Security & Compliance schemas
export {
  auditLogs,
  dataAccessLogs,
  encryptedFields,
  gdprRequests,
  securitySessions,
  complianceSettings,
  auditSeverityEnum,
  auditCategoryEnum,
  accessTypeEnum,
  dataClassificationEnum,
  gdprRequestTypeEnum,
  gdprStatusEnum,
  insertAuditLogSchema,
  insertDataAccessLogSchema,
  insertEncryptedFieldSchema,
  insertGdprRequestSchema,
  insertSecuritySessionSchema,
  insertComplianceSettingsSchema,
} from "./security-schema";

// Re-export Commission Management schemas
export {
  commissionPlans,
  commissionPlanTiers,
  commissionProductRates,
  employeeCommissionAssignments,
  commissionCalculations,
  commissionCalculationDetails,
  commissionBonuses,
  commissionAdjustments,
  commissionDisputes,
  commissionDisputeHistory,
  commissionSalesTransactions,
  planTypeEnum,
  paymentFrequencyEnum,
  calculationStatusEnum,
  disputeStatusEnum,
  disputeTypeEnum,
  adjustmentTypeEnum,
  insertCommissionPlanSchema,
  insertCommissionPlanTierSchema,
  insertCommissionProductRateSchema,
  insertEmployeeCommissionAssignmentSchema,
  insertCommissionCalculationSchema,
  insertCommissionCalculationDetailSchema,
  insertCommissionBonusSchema,
  insertCommissionAdjustmentSchema,
  insertCommissionDisputeSchema,
  insertCommissionDisputeHistorySchema,
  insertCommissionSalesTransactionSchema,
  commissionPlansRelations,
  commissionPlanTiersRelations,
  commissionProductRatesRelations,
  employeeCommissionAssignmentsRelations,
  commissionCalculationsRelations,
  commissionCalculationDetailsRelations,
  commissionBonusesRelations,
  commissionAdjustmentsRelations,
  commissionDisputesRelations,
  commissionDisputeHistoryRelations,
  commissionSalesTransactionsRelations,
} from "./commission-schema";

// Re-export Enhanced RBAC schemas
export {
  organizationalUnits,
  enhancedRoles,
  permissions,
  rolePermissions,
  userRoleAssignments,
  permissionOverrides,
  permissionCache,
  organizationalTierEnum,
  roleHierarchyLevelEnum,
  permissionEffectEnum,
  organizationalUnitsRelations,
  enhancedRolesRelations,
  permissionsRelations,
  rolePermissionsRelations,
  userRoleAssignmentsRelations,
  insertOrganizationalUnitSchema,
  insertEnhancedRoleSchema,
  insertPermissionSchema,
  insertRolePermissionSchema,
  insertUserRoleAssignmentSchema,
  insertPermissionOverrideSchema,
} from "../server/enhanced-rbac-schema";

export type {
  AuditLog,
  InsertAuditLog,
  DataAccessLog,
  InsertDataAccessLog,
  EncryptedField,
  InsertEncryptedField,
  GdprRequest,
  InsertGdprRequest,
  SecuritySession,
  InsertSecuritySession,
  ComplianceSettings,
  InsertComplianceSettings,
} from "./security-schema";

export type {
  CommissionPlan,
  InsertCommissionPlan,
  CommissionPlanTier,
  InsertCommissionPlanTier,
  CommissionProductRate,
  InsertCommissionProductRate,
  EmployeeCommissionAssignment,
  InsertEmployeeCommissionAssignment,
  CommissionCalculation,
  InsertCommissionCalculation,
  CommissionCalculationDetail,
  InsertCommissionCalculationDetail,
  CommissionBonus,
  InsertCommissionBonus,
  CommissionAdjustment,
  InsertCommissionAdjustment,
  CommissionDispute,
  InsertCommissionDispute,
  CommissionDisputeHistory,
  InsertCommissionDisputeHistory,
  CommissionSalesTransaction,
  InsertCommissionSalesTransaction,
} from "./commission-schema";

export type {
  OrganizationalUnit,
  InsertOrganizationalUnit,
  EnhancedRole,
  InsertEnhancedRole,
  Permission,
  InsertPermission,
  RolePermission,
  InsertRolePermission,
  UserRoleAssignment,
  InsertUserRoleAssignment,
  PermissionOverride,
  InsertPermissionOverride,
} from "../server/enhanced-rbac-schema";

// Re-export Demo Scheduling schemas
export {
  demoSchedules,
  demoEquipmentRequirements,
  demoOutcomes,
  insertDemoScheduleSchema,
  insertDemoEquipmentRequirementSchema,
  insertDemoOutcomeSchema,
} from "../server/demo-scheduling-schema";

// Re-export Customer Portal schemas
export {
  customerPortalAccess,
  customerServiceRequests,
  customerMeterSubmissions,
  customerSupplyOrders,
  customerSupplyOrderItems,
  customerPayments,
  customerNotifications,
  customerPortalActivityLog,
  customerPortalStatusEnum,
  serviceRequestStatusEnum,
  serviceRequestPriorityEnum,
  serviceRequestTypeEnum,
  supplyOrderStatusEnum,
  paymentStatusEnum,
  paymentMethodEnum,
  notificationTypeEnum,
  meterSubmissionMethodEnum,
  insertCustomerPortalAccessSchema,
  insertCustomerServiceRequestSchema,
  insertCustomerMeterSubmissionSchema,
  insertCustomerSupplyOrderSchema,
  insertCustomerSupplyOrderItemSchema,
  insertCustomerPaymentSchema,
  insertCustomerNotificationSchema,
  insertCustomerPortalActivityLogSchema,
} from "./customer-portal-schema";

export type {
  DemoSchedule,
  InsertDemoSchedule,
  DemoEquipmentRequirement,
  InsertDemoEquipmentRequirement,
  DemoOutcome,
  InsertDemoOutcome,
} from "../server/demo-scheduling-schema";

export type {
  CustomerPortalAccess,
  InsertCustomerPortalAccess,
  CustomerServiceRequest,
  InsertCustomerServiceRequest,
  CustomerMeterSubmission,
  InsertCustomerMeterSubmission,
  CustomerSupplyOrder,
  InsertCustomerSupplyOrder,
  CustomerSupplyOrderItem,
  InsertCustomerSupplyOrderItem,
  CustomerPayment,
  InsertCustomerPayment,
  CustomerNotification,
  InsertCustomerNotification,
  CustomerPortalActivityLog,
  InsertCustomerPortalActivityLog,
} from "./customer-portal-schema";



// Re-export Sales Forecasting schemas
export {
  salesForecasts,
  forecastPipelineItems,
  forecastMetrics,
  forecastRules,
  insertSalesForecastSchema,
  insertForecastPipelineItemSchema,
  insertForecastMetricSchema,
  insertForecastRuleSchema,
} from "../server/sales-forecasting-schema";

export type {
  SalesForecast,
  InsertSalesForecast,
  ForecastPipelineItem,
  InsertForecastPipelineItem,
  ForecastMetric,
  InsertForecastMetric,
  ForecastRule,
  InsertForecastRule,
} from "../server/sales-forecasting-schema";

export type {
  QbVendor,
  InsertQbVendor,
  GlAccount,
  InsertGlAccount,
  PaymentTerm,
  InsertPaymentTerm,
  PaymentMethod,
  InsertPaymentMethod,
  QuickbooksIntegration,
  InsertQuickbooksIntegration,
  VendorBill,
  InsertVendorBill,
} from "./quickbooks-schema";

// Session storage table - required for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Role types enum for organizational hierarchy with multi-location support
export const roleTypeEnum = pgEnum('role_type', [
  'platform_admin',    // Printyx system-level roles (Root Admin, Support Staff)
  'company_admin',     // Company tenant admin roles (C-level access to all locations)
  'regional_manager',  // Regional managers overseeing multiple locations
  'location_manager',  // Location-specific management roles
  'department_role'    // Standard department-based roles within locations
]);

// Role-based access control tables with multi-location hierarchy
export const roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 50 }).notNull(), // e.g., "Root Admin", "CEO", "Regional Manager", "Business Analyst", "Sales Rep"
  code: varchar("code", { length: 30 }).notNull().unique(), // e.g., "ROOT_ADMIN", "CEO", "REGIONAL_MGR", "BUSINESS_ANALYST", "SALES_REP"
  roleType: roleTypeEnum("role_type").notNull().default('department_role'),
  department: varchar("department", { length: 30 }).notNull(), // e.g., "platform", "sales", "service", "admin", "finance", "hr", "it", "training", "compliance", "quality"
  level: integer("level").notNull().default(1), // 1=individual, 2=team_lead, 3=supervisor, 4=manager, 5=director, 6=regional_manager, 7=company_admin, 8=platform_admin
  description: varchar("description", { length: 255 }),
  permissions: jsonb("permissions").notNull().default('{}'), // JSON object with module permissions
  
  // Platform-level permissions (Printyx roles)
  canAccessAllTenants: boolean("can_access_all_tenants").default(false), // For Printyx platform roles
  canViewSystemMetrics: boolean("can_view_system_metrics").default(false), // For platform monitoring
  
  // Company-level permissions (applies to all locations within the company)
  canAccessAllLocations: boolean("can_access_all_locations").default(false), // For company admins (C-level)
  canManageCompanyUsers: boolean("can_manage_company_users").default(false), // For company admins
  canCreateLocations: boolean("can_create_locations").default(false), // For company admins
  canViewCompanyFinancials: boolean("can_view_company_financials").default(false), // For C-level roles
  
  // Regional-level permissions (applies to assigned regions/locations)
  canManageRegionalUsers: boolean("can_manage_regional_users").default(false), // For regional managers
  canViewRegionalReports: boolean("can_view_regional_reports").default(false), // For regional managers
  canApproveRegionalDeals: boolean("can_approve_regional_deals").default(false), // For regional managers
  
  // Location-level permissions (applies only to specific locations)
  canManageLocationUsers: boolean("can_manage_location_users").default(false), // For location managers
  canViewLocationReports: boolean("can_view_location_reports").default(false), // For location managers
  canApproveLocationDeals: boolean("can_approve_location_deals").default(false), // For location managers
  
  // Specialized function permissions
  canManageCompliance: boolean("can_manage_compliance").default(false), // For compliance officers
  canManageTraining: boolean("can_manage_training").default(false), // For training managers
  canManageHR: boolean("can_manage_hr").default(false), // For HR roles
  canManageIT: boolean("can_manage_it").default(false), // For IT administrators
  canViewAnalytics: boolean("can_view_analytics").default(false), // For business analysts
  canManageQuality: boolean("can_manage_quality").default(false), // For QA managers
  canAccessAuditLogs: boolean("can_access_audit_logs").default(false), // For compliance and security roles
  canManageIntegrations: boolean("can_manage_integrations").default(false), // For IT and system integration roles
  
  // General permissions
  canManageUsers: boolean("can_manage_users").default(false), // For admin-level roles (deprecated in favor of specific scope)
  isSystemRole: boolean("is_system_role").default(false), // For built-in roles that cannot be deleted
  createdAt: timestamp("created_at").defaultNow(),
});

// Locations table for multi-location support within individual companies
export const locations = pgTable("locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(), // references tenants.id
  name: varchar("name", { length: 100 }).notNull(), // e.g., "Downtown Branch", "North Location"
  code: varchar("code", { length: 20 }).notNull(), // e.g., "DT", "NORTH" - unique within tenant
  address: varchar("address"),
  city: varchar("city"),
  state: varchar("state", { length: 2 }),
  zipCode: varchar("zip_code", { length: 10 }),
  phone: varchar("phone"),
  email: varchar("email"),
  
  // Location type and status
  locationType: varchar("location_type", { length: 30 }).default("branch"), // headquarters, branch, warehouse, service_center
  isHeadquarters: boolean("is_headquarters").default(false), // Only one HQ per tenant
  regionId: varchar("region_id"), // references regions.id for regional grouping
  
  // Location manager and settings
  locationManagerId: varchar("location_manager_id"), // references users.id
  isActive: boolean("is_active").default(true),
  
  // Metadata
  settings: jsonb("settings").default('{}'), // Location-specific settings
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Regions table for grouping locations under regional managers
export const regions = pgTable("regions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(), // references tenants.id
  name: varchar("name", { length: 100 }).notNull(), // e.g., "Northeast Region", "West Coast"
  code: varchar("code", { length: 20 }).notNull(), // e.g., "NE", "WC" - unique within tenant
  description: text("description"),
  
  // Regional manager
  regionalManagerId: varchar("regional_manager_id"), // references users.id
  
  // Geographic boundaries (optional)
  states: jsonb("states").default('[]'), // Array of state codes this region covers
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const teams = pgTable("teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  locationId: varchar("location_id"), // references locations.id - teams are now location-specific
  name: varchar("name", { length: 100 }).notNull(),
  department: varchar("department", { length: 30 }).notNull(), // sales, service, admin, finance, purchasing
  managerId: varchar("manager_id"), // references users.id
  parentTeamId: varchar("parent_team_id"), // for nested team structures
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tenants table for multi-tenancy with subdomain support
export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  slug: varchar("slug").unique().notNull(), // URL-friendly name (e.g., "xyz-company")
  domain: varchar("domain").unique(),
  subdomainPrefix: varchar("subdomain_prefix").unique(), // For xyz-company.printyx.net
  pathPrefix: varchar("path_prefix").unique(), // For printyx.net/xyz-company
  isActive: boolean("is_active").default(true),
  plan: varchar("plan", { length: 20 }).default("basic"), // basic, professional, enterprise
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User storage table with multi-location support
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"), // null for Printyx platform users
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  passwordHash: varchar("password_hash"), // bcrypt hashed password
  roleId: varchar("role_id"), // references roles.id
  teamId: varchar("team_id"), // references teams.id
  managerId: varchar("manager_id"), // direct manager - references users.id
  employeeId: varchar("employee_id"), // company employee ID
  
  // Multi-location assignments
  primaryLocationId: varchar("primary_location_id"), // references locations.id - user's home location
  regionId: varchar("region_id"), // references regions.id - for regional managers
  
  // Access scope (determines what locations/regions user can access)
  accessScope: varchar("access_scope", { length: 20 }).default("location"), // location, region, company, platform
  
  // Platform and account settings
  isPlatformUser: boolean("is_platform_user").default(false), // True for Printyx staff
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User Settings - Store user preferences, accessibility settings, and profile data
export const userSettings = pgTable("user_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(), // references tenants.id
  userId: varchar("user_id").notNull().unique(), // references users.id
  
  // Profile Information
  phone: varchar("phone"),
  jobTitle: varchar("job_title"),
  department: varchar("department"),
  bio: text("bio"),
  avatar: varchar("avatar"),
  
  // Preferences
  theme: varchar("theme", { length: 20 }).default("system"), // light, dark, system
  language: varchar("language", { length: 10 }).default("en"),
  timezone: varchar("timezone").default("America/New_York"),
  dateFormat: varchar("date_format").default("MM/dd/yyyy"),
  timeFormat: varchar("time_format", { length: 2 }).default("12"), // 12, 24
  currency: varchar("currency", { length: 3 }).default("USD"),
  
  // Notifications
  notifications: jsonb("notifications").default('{"email": true, "push": true, "sms": false, "marketing": false}'),
  
  // Accessibility Settings
  accessibility: jsonb("accessibility").default('{"highContrast": false, "reducedMotion": false, "fontSize": "medium", "screenReader": false, "keyboardNavigation": false, "colorBlind": "none", "soundEnabled": true, "voiceCommands": false}'),
  
  // Security Settings
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  twoFactorSecret: varchar("two_factor_secret"), // encrypted
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Customer Number Configuration - Configurable prefixes for customer number generation
export const customerNumberConfig = pgTable("customer_number_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Configuration Settings
  prefix: varchar("prefix", { length: 10 }).notNull().default("CUST"), // e.g., "CUST", "CLI", "ABC"
  currentSequence: integer("current_sequence").notNull().default(1000), // Starting number
  sequenceLength: integer("sequence_length").notNull().default(4), // Minimum digits (padded with zeros)
  separatorChar: varchar("separator_char", { length: 1 }).default("-"), // e.g., "-", "_", ""
  isActive: boolean("is_active").default(true),
  
  // Examples: 
  // prefix="CUST", sequence=1001, length=4, separator="-" → "CUST-1001"
  // prefix="ABC", sequence=5, length=6, separator="" → "ABC000005"
  // prefix="CLI", sequence=12345, length=4, separator="_" → "CLI_12345"
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Customer Number History - Track all generated customer numbers for auditing
export const customerNumberHistory = pgTable("customer_number_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  customerId: varchar("customer_id").notNull(), // references business_records.id or companies.id
  customerNumber: varchar("customer_number").notNull(),
  configId: varchar("config_id").notNull(), // references customer_number_config.id
  generatedAt: timestamp("generated_at").defaultNow(),
  generatedBy: varchar("generated_by"), // references users.id
});

// User-Location assignments for multi-location access control
export const userLocationAssignments = pgTable("user_location_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  userId: varchar("user_id").notNull(), // references users.id
  locationId: varchar("location_id").notNull(), // references locations.id
  accessType: varchar("access_type", { length: 20 }).notNull().default("full"), // full, read_only, specific_modules
  assignedBy: varchar("assigned_by").notNull(), // references users.id - who granted this access
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User-Customer assignments for sales territory management (enhanced with location awareness)
export const userCustomerAssignments = pgTable("user_customer_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  locationId: varchar("location_id"), // references locations.id - which location manages this assignment
  userId: varchar("user_id").notNull(), // references users.id
  customerId: varchar("customer_id").notNull(), // references customers.id
  assignmentType: varchar("assignment_type", { length: 20 }).notNull().default("primary"), // primary, secondary, support
  createdAt: timestamp("created_at").defaultNow(),
});

// Companies - Core business entity that replaces the customer concept
export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Business Record Information (based on your CRM screenshots)
  businessRecordType: varchar("business_record_type").notNull().default("Customer"),
  customerNumber: varchar("customer_number").unique(), // e.g., "10243"
  businessName: varchar("business_name").notNull(), // e.g., "DES MOINES PUBLIC SCHOOLS"
  businessSite: varchar("business_site"), // e.g., "MAURY BLDG 1"
  parentBusiness: varchar("parent_business"),
  industry: varchar("industry"),
  activity: varchar("activity"),
  description: text("description"),
  
  // Contact Information
  phone: varchar("phone"), // e.g., "515-242-7911"
  fax: varchar("fax"), // e.g., "515-242-8295" 
  website: varchar("website"),
  nextCallBack: timestamp("next_call_back"),
  
  // Address Information (matching your screenshots)
  billingAddress: text("billing_address"), // "2100 FLEUR DR"
  billingCity: varchar("billing_city"), // "DES MOINES"
  billingState: varchar("billing_state"), // "IA"
  billingZip: varchar("billing_zip"), // "50321"
  shippingAddress: text("shipping_address"),
  shippingCity: varchar("shipping_city"),
  shippingState: varchar("shipping_state"), 
  shippingZip: varchar("shipping_zip"),
  
  // Business Details
  customerSince: timestamp("customer_since"), // "11/15/2002"
  employees: integer("employees"),
  annualRevenue: decimal("annual_revenue", { precision: 12, scale: 2 }),
  numberOfLocations: integer("number_of_locations"),
  sicCode: varchar("sic_code"),
  productServicesInterest: text("product_services_interest"),
  numberOfStepsRights: integer("number_of_steps_rights"),
  specialDeliveryInstructions: text("special_delivery_instructions"),
  taxState: varchar("tax_state"),
  elevator: varchar("elevator"),
  
  // System Information  
  createdBy: varchar("created_by"), // "Informix Office Systems Administrator"
  businessOwner: varchar("business_owner"), // "Nate Olivennus"  
  lastModifiedBy: varchar("last_modified_by"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Company Contacts - All contacts at a company (replaces separate contact/lead concept)
export const companyContacts = pgTable("company_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  companyId: varchar("company_id").notNull(),
  
  // Contact Information (matching your CRM screenshots)
  salutation: varchar("salutation"), // "--None--"
  firstName: varchar("first_name"), // Required field
  lastName: varchar("last_name").notNull(), // Required field
  title: varchar("title"), 
  department: varchar("department"),
  phone: varchar("phone"), // "515-242-7911"
  mobile: varchar("mobile"),
  email: varchar("email"),
  reportsTo: varchar("reports_to"), // Search contacts field
  contactRoles: text("contact_roles"), // JSON array
  isPrimaryContact: boolean("is_primary_contact").default(false),
  
  // Lead/Contact Status Information
  leadStatus: varchar("lead_status").default('new'), // new, contacted, qualified, unqualified, customer
  lastContactDate: timestamp("last_contact_date"),
  nextFollowUpDate: timestamp("next_follow_up_date"),
  ownerId: varchar("owner_id"), // Assigned salesperson/owner
  favoriteContentType: varchar("favorite_content_type"), // blog, ebook, video, etc.
  preferredChannels: text("preferred_channels"), // JSON array of communication preferences
  
  // Additional Information
  assistant: varchar("assistant"),
  assistantPhone: varchar("assistant_phone"),
  otherPhone: varchar("other_phone"),
  homePhone: varchar("home_phone"),
  fax: varchar("fax"),
  birthdate: timestamp("birthdate"),
  
  // Address Information
  mailingAddress: text("mailing_address"),
  mailingCity: varchar("mailing_city"),
  mailingState: varchar("mailing_state"), 
  mailingZip: varchar("mailing_zip"),
  otherAddress: text("other_address"),
  otherCity: varchar("other_city"),
  otherState: varchar("other_state"),
  otherZip: varchar("other_zip"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Unified Business Records - Single table for entire business relationship lifecycle
// Enhanced with dual-platform compatibility: E-Automate (90% dealers) + Salesforce integration
export const businessRecords = pgTable("business_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Multi-Platform External System Integration
  externalCustomerId: varchar("external_customer_id"), // E-Automate CustomerKey / Salesforce Account.Id
  externalSystemId: varchar("external_system_id"), // Track source system (e-automate, salesforce, quickbooks, etc)
  externalSalesforceId: varchar("external_salesforce_id"), // Salesforce Account.Id for dual mapping
  externalLeadId: varchar("external_lead_id"), // Salesforce Lead.Id for lead conversion tracking
  migrationStatus: varchar("migration_status"), // pending, in_progress, completed, failed
  lastSyncDate: timestamp("last_sync_date"), // For incremental syncing
  externalData: jsonb("external_data"), // Store additional platform-specific fields as JSON
  
  // Record Type & Status - Controls entire business relationship lifecycle
  recordType: varchar("record_type").notNull().default("lead"), // lead, customer, former_customer
  status: varchar("status").notNull().default("new"), 
  // Lead statuses: new, contacted, qualified, proposal, negotiation, closed_won, closed_lost
  // Customer statuses: active, inactive, on_hold, churned, competitor_switch, non_payment, expired
  
  // Company Information (E-Automate + Salesforce compatible)
  companyName: varchar("company_name").notNull(), // E-Automate CustomerName / Salesforce Account.Name
  accountNumber: varchar("account_number"), // Salesforce Account.AccountNumber
  accountType: varchar("account_type"), // E-Automate CustomerType / Salesforce Account.Type (Customer, Prospect, Partner)
  website: varchar("website"), // Salesforce Account.Website
  industry: varchar("industry"), // Salesforce Account.Industry
  companySize: varchar("company_size"),
  employeeCount: integer("employee_count"), // Salesforce Account.NumberOfEmployees
  annualRevenue: decimal("annual_revenue", { precision: 15, scale: 2 }), // Salesforce Account.AnnualRevenue
  
  // Salesforce-specific Company Fields
  customerRating: varchar("customer_rating"), // Salesforce Account.Rating (Hot, Warm, Cold)
  parentAccountId: varchar("parent_account_id"), // Salesforce Account.ParentId
  customerPriority: varchar("customer_priority"), // Salesforce Account.CustomerPriority__c (High, Medium, Low)
  slaLevel: varchar("sla_level"), // Salesforce Account.SLA__c
  isActive: boolean("is_active").default(true), // Salesforce Account.Active__c
  upsellOpportunity: varchar("upsell_opportunity"), // Salesforce Account.UpsellOpportunity__c
  accountNotes: text("account_notes"), // Salesforce Account.Description
  
  // Primary Contact Information
  primaryContactName: varchar("primary_contact_name"), // E-Automate ContactName
  primaryContactEmail: varchar("primary_contact_email"),
  primaryContactPhone: varchar("primary_contact_phone"),
  primaryContactTitle: varchar("primary_contact_title"),
  
  // Billing Contact Information (E-Automate compatible)
  billingContactName: varchar("billing_contact_name"), // E-Automate BillingContact
  billingContactEmail: varchar("billing_contact_email"),
  billingContactPhone: varchar("billing_contact_phone"),
  
  // Address Information (E-Automate + Salesforce compatible)
  addressLine1: varchar("address_line1"), // E-Automate Address1 / Salesforce BillingStreet
  addressLine2: varchar("address_line2"), // E-Automate Address2
  city: varchar("city"), // Salesforce BillingCity
  state: varchar("state"), // Salesforce BillingState
  postalCode: varchar("postal_code"), // E-Automate ZipCode / Salesforce BillingPostalCode
  country: varchar("country").default("US"), // Salesforce BillingCountry
  
  // Billing Address (E-Automate + Salesforce compatible)
  billingAddressLine1: varchar("billing_address_1"), // E-Automate BillingAddress1 / Salesforce BillingStreet
  billingAddressLine2: varchar("billing_address_2"), // E-Automate BillingAddress2
  billingCity: varchar("billing_city"), // E-Automate BillingCity / Salesforce BillingCity
  billingState: varchar("billing_state"), // E-Automate BillingState / Salesforce BillingState
  billingPostalCode: varchar("billing_zip_code"), // E-Automate BillingZip / Salesforce BillingPostalCode

  
  // Communication Details (E-Automate + Salesforce compatible)
  phone: varchar("phone"), // E-Automate Phone / Salesforce Phone
  fax: varchar("fax"), // E-Automate Fax / Salesforce Fax
  
  // Salesforce-specific Contact Preferences
  preferredContactMethod: varchar("preferred_contact_method"), // Salesforce Account.PreferredContactMethod__c
  
  // Lead Pipeline Information
  leadSource: varchar("source").notNull().default("website"), // website, referral, cold_call, trade_show, etc.
  estimatedAmount: decimal("estimated_deal_value", { precision: 10, scale: 2 }),
  probability: integer("probability").default(50), // 0-100%
  closeDate: timestamp("close_date"), // Date converted to customer or lost
  salesStage: varchar("sales_stage"), // E-Automate pipeline stage
  interestLevel: varchar("interest_level"), // hot, warm, cold
  
  // Assignment & Ownership (E-Automate compatible)
  ownerId: varchar("owner_id"), // User who owns this record
  assignedSalesRep: varchar("assigned_sales_rep"), // E-Automate SalesRep
  territory: varchar("territory"), // E-Automate Territory
  accountManagerId: varchar("account_manager_id"),
  leadScore: integer("lead_score").default(0), // 0-100 scoring system
  priority: varchar("priority").default("medium"), // high, medium, low
  
  // Customer-Specific Fields (E-Automate compatible)
  customerNumber: varchar("customer_number").unique(), // Generated when converted to customer
  customerSince: timestamp("customer_since"), // Date of conversion to customer
  customerUntil: timestamp("customer_until"), // Date when customer relationship ended (for former customers)
  churnReason: varchar("deactivation_reason"), // competitor_switch, pricing, service_issues, business_closure, etc.
  reactivationDate: timestamp("reactivation_date"),
  churnedDate: timestamp("churned_date"),
  competitorName: varchar("competitor_name"),
  
  // Financial Information (E-Automate compatible)
  creditLimit: decimal("credit_limit", { precision: 10, scale: 2 }), // E-Automate CreditLimit
  paymentTerms: varchar("payment_terms"), // E-Automate PaymentTerms
  billingTerms: varchar("billing_terms"),
  taxExempt: boolean("tax_exempt").default(false), // E-Automate TaxExempt
  taxId: varchar("tax_id"), // E-Automate TaxID
  customerTier: varchar("customer_tier"), // Gold, Silver, Bronze, etc.
  
  // Service & Support Information (customer only)
  preferredTechnician: varchar("preferred_technician"),
  lastServiceDate: timestamp("last_service_date"),
  nextScheduledService: timestamp("next_scheduled_service"),
  
  // Billing Information (customer only)
  lastInvoiceDate: timestamp("last_invoice_date"),
  lastPaymentDate: timestamp("last_payment_date"),
  currentBalance: decimal("current_balance", { precision: 10, scale: 2 }).default('0'),
  
  // Meter Reading Information (customer only)
  lastMeterReadingDate: timestamp("last_meter_reading_date"),
  nextMeterReadingDate: timestamp("next_meter_reading_date"),
  
  // Activity Tracking
  lastContactDate: timestamp("last_contact_date"),
  nextFollowUpDate: timestamp("next_follow_up_date"),
  
  // System Tracking
  notes: text("notes"),
  createdBy: varchar("created_by").notNull(),
  convertedBy: varchar("converted_by"), // Who converted from lead to customer
  deactivatedBy: varchar("deactivated_by"), // Who deactivated the customer
  
  // Timestamps (E-Automate + Salesforce compatible)
  createdAt: timestamp("created_at").defaultNow(), // E-Automate DateCreated / Salesforce CreatedDate
  updatedAt: timestamp("updated_at").defaultNow(), // E-Automate LastModified / Salesforce LastModifiedDate
});

// For backward compatibility during migration
export const leads = businessRecords; // Alias for existing code
export const customers = businessRecords; // Alias for existing code

// Enhanced Contact Management (Salesforce-style individual contacts)
export const enhancedContacts = pgTable("enhanced_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // External System Integration
  externalContactId: varchar("external_contact_id"), // Salesforce Contact.Id
  externalAccountId: varchar("external_account_id"), // Salesforce Contact.AccountId
  externalLeadId: varchar("external_lead_id"), // Salesforce Lead.Id (if converted from lead)
  migrationStatus: varchar("migration_status"),
  lastSyncDate: timestamp("last_sync_date"),
  
  // Basic Contact Information
  firstName: varchar("first_name"), // Salesforce Contact.FirstName
  lastName: varchar("last_name"), // Salesforce Contact.LastName
  fullName: varchar("full_name"), // Salesforce Contact.Name (computed)
  salutation: varchar("salutation"), // Salesforce Contact.Salutation (Mr., Ms., Dr., etc.)
  suffix: varchar("suffix"), // Salesforce Contact.Suffix (Jr., Sr., III, etc.)
  
  // Business Information
  title: varchar("title"), // Salesforce Contact.Title
  department: varchar("department"), // Salesforce Contact.Department
  companyId: varchar("company_id"), // References business_records.id
  companyName: varchar("company_name"), // Denormalized for performance
  
  // Contact Details
  email: varchar("email"), // Salesforce Contact.Email
  workPhone: varchar("work_phone"), // Salesforce Contact.Phone
  mobilePhone: varchar("mobile_phone"), // Salesforce Contact.MobilePhone
  homePhone: varchar("home_phone"), // Salesforce Contact.HomePhone
  otherPhone: varchar("other_phone"), // Salesforce Contact.OtherPhone
  fax: varchar("fax"), // Salesforce Contact.Fax
  
  // Contact Hierarchy & Relationships
  reportsToContactId: varchar("reports_to_contact_id"), // Salesforce Contact.ReportsToId
  contactLevel: varchar("contact_level"), // Salesforce Contact.Level__c (Primary, Secondary, Decision Maker)
  contactRole: varchar("contact_role"), // Salesforce Contact.ContactRole__c (IT Manager, CFO, CEO, etc.)
  isDecisionMaker: boolean("is_decision_maker").default(false), // Salesforce Contact.DecisionMaker__c
  isPrimaryContact: boolean("is_primary_contact").default(false),
  
  // Lead/Contact Management
  leadStatus: varchar("lead_status"), // qualified, unqualified, contacted, converted
  leadSource: varchar("lead_source"), // Salesforce Contact.LeadSource
  ownerId: varchar("owner_id"), // Salesforce Contact.OwnerId - assigned rep
  ownerName: varchar("owner_name"), // Denormalized for performance
  
  // Communication Preferences
  hasOptedOutOfEmail: boolean("has_opted_out_of_email").default(false), // Salesforce Contact.HasOptedOutOfEmail
  doNotCall: boolean("do_not_call").default(false), // Salesforce Contact.DoNotCall
  preferredContactMethod: varchar("preferred_contact_method"), // Salesforce Contact.PreferredContactMethod__c
  languages: varchar("languages"), // Salesforce Contact.Languages__c
  
  // Address Information
  mailingAddressLine1: varchar("mailing_address_line_1"), // Salesforce Contact.MailingStreet
  mailingCity: varchar("mailing_city"), // Salesforce Contact.MailingCity
  mailingState: varchar("mailing_state"), // Salesforce Contact.MailingState
  mailingPostalCode: varchar("mailing_zip_code"), // Salesforce Contact.MailingPostalCode
  mailingCountry: varchar("mailing_country"), // Salesforce Contact.MailingCountry
  
  // Personal Information
  birthdate: timestamp("birthdate"), // Salesforce Contact.Birthdate
  assistantName: varchar("assistant_name"), // Salesforce Contact.AssistantName
  assistantPhone: varchar("assistant_phone"), // Salesforce Contact.AssistantPhone
  
  // Additional Information
  description: text("description"), // Salesforce Contact.Description
  isPersonAccount: boolean("is_person_account").default(false), // Salesforce Contact.IsPersonAccount
  
  // Activity Tracking
  lastContactDate: timestamp("last_contact_date"),
  nextFollowUpDate: timestamp("next_follow_up_date"),
  lastActivityDate: timestamp("last_activity_date"), // Salesforce Contact.LastActivityDate
  
  // Additional CRM Data
  favoriteContentType: varchar("favorite_content_type"),
  preferredChannels: text("preferred_channels"), // JSON array
  
  // System Tracking
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sales Opportunities (Salesforce-style deal management)
export const opportunities = pgTable("opportunities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // External System Integration
  externalOpportunityId: varchar("external_opportunity_id"), // Salesforce Opportunity.Id
  externalAccountId: varchar("external_account_id"), // Salesforce Opportunity.AccountId
  migrationStatus: varchar("migration_status"),
  lastSyncDate: timestamp("last_sync_date"),
  
  // Basic Opportunity Information
  opportunityName: varchar("opportunity_name").notNull(), // Salesforce Opportunity.Name
  accountId: varchar("account_id"), // References business_records.id
  accountName: varchar("account_name"), // Denormalized for performance
  
  // Sales Process
  stageName: varchar("stage_name").notNull(), // Salesforce Opportunity.StageName
  amount: decimal("amount", { precision: 15, scale: 2 }), // Salesforce Opportunity.Amount
  probability: integer("probability").default(50), // Salesforce Opportunity.Probability (0-100%)
  closeDate: timestamp("close_date"), // Salesforce Opportunity.CloseDate
  
  // Opportunity Classification
  opportunityType: varchar("opportunity_type"), // Salesforce Opportunity.Type (New Business, Existing Business, Renewal)
  leadSource: varchar("lead_source"), // Salesforce Opportunity.LeadSource
  campaignId: varchar("campaign_id"), // Salesforce Opportunity.CampaignId
  
  // Status Tracking
  isWon: boolean("is_won").default(false), // Salesforce Opportunity.IsWon
  isClosed: boolean("is_closed").default(false), // Salesforce Opportunity.IsClosed
  isPrivate: boolean("is_private").default(false), // Salesforce Opportunity.IsPrivate
  
  // Sales Information
  ownerId: varchar("owner_id"), // Salesforce Opportunity.OwnerId - assigned rep
  ownerName: varchar("owner_name"), // Denormalized for performance
  description: text("description"), // Salesforce Opportunity.Description
  nextStep: text("next_step"), // Salesforce Opportunity.NextStep
  forecastCategory: varchar("forecast_category"), // Salesforce Opportunity.ForecastCategoryName
  
  // Financial Details
  expectedRevenue: decimal("expected_revenue", { precision: 15, scale: 2 }), // Salesforce Opportunity.ExpectedRevenue
  totalQuantity: decimal("total_quantity", { precision: 10, scale: 2 }), // Salesforce Opportunity.TotalOpportunityQuantity
  hasLineItems: boolean("has_line_items").default(false), // Salesforce Opportunity.HasOpportunityLineItem
  priceBookId: varchar("price_book_id"), // Salesforce Opportunity.Pricebook2Id
  
  // Industry-Specific Fields (Copier Dealer)
  mainCompetitors: text("main_competitors"), // Salesforce Opportunity.MainCompetitors__c
  deliveryStatus: varchar("delivery_status"), // Salesforce Opportunity.DeliveryInstallationStatus__c
  trackingNumber: varchar("tracking_number"), // Salesforce Opportunity.TrackingNumber__c
  orderNumber: varchar("order_number"), // Salesforce Opportunity.OrderNumber__c
  currentSituation: text("current_situation"), // Salesforce Opportunity.CurrentSituation__c
  
  // Product & Financing
  productType: varchar("product_type"), // Salesforce Opportunity.ProductType__c (Copier, Production, IT Services, Software)
  financingType: varchar("financing_type"), // Salesforce Opportunity.Financing__c (Purchase, Lease, Rental)
  monthlyPayment: decimal("monthly_payment", { precision: 10, scale: 2 }), // Salesforce Opportunity.MonthlyPayment__c
  leaseTermMonths: integer("lease_term_months"), // Salesforce Opportunity.LeaseTerm__c
  
  // Sales Performance
  commissionRate: decimal("commission_rate", { precision: 5, scale: 4 }), // Salesforce Opportunity.CommissionRate__c
  grossMarginPercent: decimal("gross_margin_percent", { precision: 5, scale: 2 }), // Salesforce Opportunity.GrossMargin__c
  territory: varchar("territory"), // Salesforce Opportunity.Territory__c
  partnerAccountId: varchar("partner_account_id"), // Salesforce Opportunity.PartnerAccount__c
  
  // Activity Tracking
  lastActivityDate: timestamp("last_activity_date"), // Salesforce Opportunity.LastActivityDate
  
  // System Tracking
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Enhanced Products Catalog (Salesforce-compatible)
export const enhancedProducts = pgTable("enhanced_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // External System Integration
  externalProductId: varchar("external_product_id"), // Salesforce Product2.Id
  migrationStatus: varchar("migration_status"),
  lastSyncDate: timestamp("last_sync_date"),
  
  // Basic Product Information
  productName: varchar("product_name").notNull(), // Salesforce Product2.Name
  productCode: varchar("product_code"), // Salesforce Product2.ProductCode
  description: text("description"), // Salesforce Product2.Description
  productFamily: varchar("product_family"), // Salesforce Product2.Family (Copiers, Printers, Software, Services)
  
  // Product Classification
  category: varchar("category"), // Salesforce Product2.Category__c
  subcategory: varchar("subcategory"), // Salesforce Product2.Subcategory__c
  productType: varchar("product_type"), // Salesforce Product2.Type__c (Hardware, Software, Service, Supplies)
  
  // Product Status & Availability
  isActive: boolean("is_active").default(true), // Salesforce Product2.IsActive
  canUseQuantitySchedule: boolean("can_use_quantity_schedule").default(false), // Salesforce Product2.CanUseQuantitySchedule
  canUseRevenueSchedule: boolean("can_use_revenue_schedule").default(false), // Salesforce Product2.CanUseRevenueSchedule
  quantityUnitOfMeasure: varchar("quantity_unit_of_measure"), // Salesforce Product2.QuantityUnitOfMeasure
  
  // Product Identification
  sku: varchar("sku"), // Salesforce Product2.StockKeepingUnit
  displayUrl: varchar("display_url"), // Salesforce Product2.DisplayUrl
  externalDataSourceId: varchar("external_data_source_id"), // Salesforce Product2.ExternalDataSourceId
  externalId: varchar("external_id"), // Salesforce Product2.ExternalId
  
  // Equipment-Specific Fields
  manufacturer: varchar("manufacturer"), // Salesforce Product2.Manufacturer__c
  modelNumber: varchar("model_number"), // Salesforce Product2.ModelNumber__c
  specifications: text("specifications"), // Salesforce Product2.Specifications__c
  warrantyPeriodMonths: integer("warranty_period_months"), // Salesforce Product2.WarrantyPeriod__c
  
  // Physical Characteristics
  weight: decimal("weight", { precision: 10, scale: 2 }), // Salesforce Product2.Weight__c
  dimensions: varchar("dimensions"), // Salesforce Product2.Dimensions__c
  powerRequirements: varchar("power_requirements"), // Salesforce Product2.PowerRequirements__c
  
  // Copier/Printer Specific
  monthlyDutyCycle: integer("monthly_duty_cycle"), // Salesforce Product2.MonthlyDutyCycle__c
  printSpeedPpm: integer("print_speed_ppm"), // Salesforce Product2.PrintSpeed__c
  isColorCapable: boolean("is_color_capable").default(false), // Salesforce Product2.ColorCapable__c
  isDuplexCapable: boolean("is_duplex_capable").default(false), // Salesforce Product2.DuplexCapable__c
  isNetworkCapable: boolean("is_network_capable").default(false), // Salesforce Product2.NetworkCapable__c
  
  // Pricing Information
  productCost: decimal("product_cost", { precision: 10, scale: 2 }), // Salesforce Product2.Cost__c
  msrp: decimal("msrp", { precision: 10, scale: 2 }), // Salesforce Product2.MSRP__c
  
  // System Tracking
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Equipment/Assets Table (E-Automate compatible)
export const equipment = pgTable("equipment", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // E-Automate Compatibility
  externalEquipmentId: varchar("external_equipment_id"), // E-Automate EquipmentKey
  externalCustomerId: varchar("external_customer_id"), // E-Automate CustomerKey
  lastSyncDate: timestamp("last_sync_date"),
  
  // Equipment Identification
  serialNumber: varchar("serial_number").unique(), // E-Automate SerialNumber
  modelNumber: varchar("model_number"), // E-Automate ModelNumber
  manufacturer: varchar("manufacturer"), // E-Automate Manufacturer
  description: text("description"), // E-Automate Description
  assetTag: varchar("asset_tag"), // E-Automate AssetTag
  
  // Location & Installation
  customerId: varchar("customer_id").notNull(), // References business_records.id
  locationDescription: text("location_description"), // E-Automate LocationDescription
  installDate: timestamp("install_date"), // E-Automate InstallDate
  ipAddress: varchar("ip_address"), // E-Automate NetworkAddress
  
  // Equipment Specifications
  meterType: varchar("meter_type"), // E-Automate MeterType: bw_only, color, scan, fax
  isColorCapable: boolean("is_color_capable").default(false), // E-Automate ColorCapable
  equipmentStatus: varchar("equipment_status").default("active"), // E-Automate Status
  
  // Financial Information
  purchasePrice: decimal("purchase_price", { precision: 10, scale: 2 }), // E-Automate PurchasePrice
  monthlyPayment: decimal("monthly_payment", { precision: 10, scale: 2 }), // E-Automate MonthlyPayment
  leaseExpiresDate: timestamp("lease_expires_date"), // E-Automate LeaseExpires
  warrantyExpiresDate: timestamp("warranty_expires_date"), // E-Automate WarrantyExpires
  
  // Service Information
  serviceContractNumber: varchar("service_contract_number"), // E-Automate ServiceContract
  lastServiceDate: timestamp("last_service_date"), // E-Automate LastServiceDate
  nextServiceDueDate: timestamp("next_service_due_date"), // E-Automate NextServiceDue
  
  // System Tracking
  notes: text("notes"), // E-Automate Notes
  createdAt: timestamp("created_at").defaultNow(), // E-Automate DateCreated
  updatedAt: timestamp("updated_at").defaultNow(), // E-Automate LastModified
});

// Service Contracts Table (E-Automate compatible)
export const serviceContracts = pgTable("service_contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // E-Automate Compatibility
  externalContractId: varchar("external_contract_id"), // E-Automate ContractKey
  externalCustomerId: varchar("external_customer_id"), // E-Automate CustomerKey
  externalEquipmentId: varchar("external_equipment_id"), // E-Automate EquipmentKey
  lastSyncDate: timestamp("last_sync_date"),
  
  // Contract Identification
  contractNumber: varchar("contract_number").unique(), // E-Automate ContractNumber
  customerId: varchar("customer_id").notNull(), // References business_records.id
  equipmentId: varchar("equipment_id"), // References equipment.id
  
  // Contract Details
  contractType: varchar("contract_type"), // E-Automate ContractType: full-service, maintenance, parts-only
  contractStatus: varchar("contract_status").default("active"), // E-Automate Status
  startDate: timestamp("start_date"), // E-Automate StartDate
  endDate: timestamp("end_date"), // E-Automate EndDate
  autoRenewal: boolean("auto_renewal").default(false), // E-Automate AutoRenewal
  
  // Billing Information
  billingFrequency: varchar("billing_frequency").default("monthly"), // E-Automate BillingFrequency
  monthlyBaseRate: decimal("monthly_base_rate", { precision: 10, scale: 2 }), // E-Automate MonthlyRate
  bwOverageRate: decimal("bw_overage_rate", { precision: 6, scale: 4 }), // E-Automate BWOverageRate
  colorOverageRate: decimal("color_overage_rate", { precision: 6, scale: 4 }), // E-Automate ColorOverageRate
  baseVolumeBw: integer("base_volume_bw"), // E-Automate BaseVolumeBW
  baseVolumeColor: integer("base_volume_color"), // E-Automate BaseVolumeColor
  totalContractValue: decimal("total_contract_value", { precision: 10, scale: 2 }), // E-Automate TotalValue
  
  // Service Inclusions
  includesToner: boolean("includes_toner").default(true), // E-Automate IncludesToner
  includesParts: boolean("includes_parts").default(true), // E-Automate IncludesParts
  includesLabor: boolean("includes_labor").default(true), // E-Automate IncludesLabor
  responseTimeHours: integer("response_time_hours").default(24), // E-Automate ResponseTime
  
  // Sales Information
  salesRep: varchar("sales_rep"), // E-Automate SalesRep
  commissionRate: decimal("commission_rate", { precision: 5, scale: 4 }), // E-Automate CommissionRate
  
  // System Tracking
  contractNotes: text("contract_notes"), // E-Automate Notes
  createdAt: timestamp("created_at").defaultNow(), // E-Automate DateCreated
  updatedAt: timestamp("updated_at").defaultNow(), // E-Automate LastModified
});

// Enhanced Meter Readings Table (E-Automate compatible with comprehensive billing features)
export const meterReadings = pgTable("meter_readings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // E-Automate Compatibility
  externalReadingId: varchar("external_reading_id"), // E-Automate ReadingKey
  externalEquipmentId: varchar("external_equipment_id"), // E-Automate EquipmentKey
  lastSyncDate: timestamp("last_sync_date"),
  
  // Reading Identification
  equipmentId: varchar("equipment_id").notNull(), // References equipment.id
  contractId: varchar("contract_id"), // References contracts.id
  readingDate: timestamp("reading_date").notNull(), // E-Automate ReadingDate
  
  // Meter Values (E-Automate compatible with additional fields)
  bwMeterReading: integer("bw_meter_reading"), // E-Automate BWMeter / blackMeter
  colorMeterReading: integer("color_meter_reading"), // E-Automate ColorMeter / colorMeter
  scanMeterReading: integer("scan_meter_reading"), // E-Automate ScanMeter
  faxMeterReading: integer("fax_meter_reading"), // E-Automate FaxMeter
  largePaperMeterReading: integer("large_paper_meter_reading"), // E-Automate LargePaperMeter
  
  // Previous Readings for Copy Calculation
  previousBlackMeter: integer("previous_black_meter").default(0),
  previousColorMeter: integer("previous_color_meter").default(0),
  blackCopies: integer("black_copies").default(0),
  colorCopies: integer("color_copies").default(0),
  
  // Collection Method (Enhanced PRD requirement)
  readingMethod: varchar("reading_method").default("manual"), // E-Automate ReadingMethod
  collectionMethod: varchar("collection_method").default("manual"), // manual, dca, email, api, remote_monitoring
  
  // DCA Integration Fields
  dcaDeviceId: varchar("dca_device_id"), // Device ID for DCA integration
  dcaLastSync: timestamp("dca_last_sync"), // Last successful DCA sync
  dcaError: text("dca_error"), // Any DCA collection errors
  
  // Email Collection Fields  
  emailSource: varchar("email_source"), // Email address readings came from
  emailSubject: varchar("email_subject"), // Original email subject
  emailTimestamp: timestamp("email_timestamp"), // When email was received
  
  // API Collection Fields
  apiSource: varchar("api_source"), // Which API endpoint provided the data
  apiResponseId: varchar("api_response_id"), // Reference to API response
  
  // Quality Control & Verification
  technicianId: varchar("technician_id"), // E-Automate TechnicianID
  isVerified: boolean("is_verified").default(false), // E-Automate Verified
  verifiedBy: varchar("verified_by"), // Who verified the reading
  verifiedAt: timestamp("verified_at"), // When was it verified
  
  // Exceptions and Adjustments
  hasException: boolean("has_exception").default(false),
  exceptionReason: varchar("exception_reason"), // manual_override, billing_dispute, equipment_error
  exceptionNotes: text("exception_notes"),
  adjustmentAmount: decimal("adjustment_amount", { precision: 10, scale: 2 }).default('0'),
  
  // Billing Information (E-Automate compatible)
  billingPeriod: varchar("billing_period"), // E-Automate BillingPeriod
  billingStatus: varchar("billing_status").default("pending"), // pending, processed, billed, disputed
  invoiceNumber: varchar("invoice_number"), // E-Automate InvoiceNumber
  invoiceId: varchar("invoice_id"), // Reference to generated invoice
  billingAmount: decimal("billing_amount", { precision: 10, scale: 2 }),
  
  // System Tracking
  readingNotes: text("reading_notes"), // E-Automate Notes
  notes: text("notes"), // Additional notes
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(), // E-Automate DateCreated
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Service Calls/Work Orders Table (E-Automate compatible)
export const serviceCalls = pgTable("service_calls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // E-Automate Compatibility
  externalServiceCallId: varchar("external_service_call_id"), // E-Automate CallKey
  externalCustomerId: varchar("external_customer_id"), // E-Automate CustomerKey
  externalEquipmentId: varchar("external_equipment_id"), // E-Automate EquipmentKey
  lastSyncDate: timestamp("last_sync_date"),
  
  // Service Call Identification
  serviceCallNumber: varchar("service_call_number").unique(), // E-Automate CallNumber
  customerId: varchar("customer_id").notNull(), // References business_records.id
  equipmentId: varchar("equipment_id"), // References equipment.id
  
  // Call Details
  callDate: timestamp("call_date").notNull(), // E-Automate CallDate
  callTime: varchar("call_time"), // E-Automate CallTime
  callType: varchar("call_type"), // E-Automate CallType: warranty, contract, billable, internal
  priorityLevel: varchar("priority_level").default("medium"), // E-Automate Priority: high, medium, low
  callStatus: varchar("call_status").default("open"), // E-Automate CallStatus: open, dispatched, completed, cancelled
  
  // Problem Information
  problemDescription: text("problem_description"), // E-Automate ProblemDescription
  problemCode: varchar("problem_code"), // E-Automate ProblemCode
  resolutionDescription: text("resolution_description"), // E-Automate Resolution
  resolutionCode: varchar("resolution_code"), // E-Automate ResolutionCode
  
  // Technician Information
  assignedTechnicianId: varchar("assigned_technician_id"), // E-Automate TechnicianID
  dispatchedByUserId: varchar("dispatched_by_user_id"), // E-Automate DispatchedBy
  timeOnSiteMinutes: integer("time_on_site_minutes"), // E-Automate TimeOnSite
  travelTimeMinutes: integer("travel_time_minutes"), // E-Automate TravelTime
  
  // Completion Information
  completedDate: timestamp("completed_date"), // E-Automate CompletedDate
  customerSignature: text("customer_signature"), // E-Automate CustomerSignature
  customerSatisfactionRating: integer("customer_satisfaction_rating"), // E-Automate CustomerSatisfaction (1-5)
  
  // Financial Information
  laborChargeAmount: decimal("labor_charge_amount", { precision: 10, scale: 2 }), // E-Automate LaborCharge
  partsChargeAmount: decimal("parts_charge_amount", { precision: 10, scale: 2 }), // E-Automate PartsCharge
  travelChargeAmount: decimal("travel_charge_amount", { precision: 10, scale: 2 }), // E-Automate TravelCharge
  totalChargeAmount: decimal("total_charge_amount", { precision: 10, scale: 2 }), // E-Automate TotalCharge
  isBillable: boolean("is_billable").default(true), // E-Automate Billable
  invoiceNumber: varchar("invoice_number"), // E-Automate InvoiceNumber
  
  // System Tracking
  serviceNotes: text("service_notes"), // E-Automate Notes
  createdAt: timestamp("created_at").defaultNow(), // E-Automate DateCreated
  updatedAt: timestamp("updated_at").defaultNow(), // E-Automate LastModified
});

// Inventory/Parts Table (E-Automate compatible)
export const inventoryItems = pgTable("inventory_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // E-Automate Compatibility
  externalItemId: varchar("external_item_id"), // E-Automate ItemKey
  lastSyncDate: timestamp("last_sync_date"),
  
  // Item Identification
  partNumber: varchar("part_number").unique(), // E-Automate PartNumber
  manufacturerPartNumber: varchar("manufacturer_part_number"), // E-Automate ManufacturerPartNumber
  itemDescription: text("item_description"), // E-Automate Description
  itemCategory: varchar("item_category"), // E-Automate Category
  manufacturer: varchar("manufacturer"), // E-Automate Manufacturer
  
  // Inventory Levels
  quantityOnHand: integer("quantity_on_hand").default(0), // E-Automate QtyOnHand
  quantityCommitted: integer("quantity_committed").default(0), // E-Automate QtyCommitted
  quantityAvailable: integer("quantity_available").default(0), // E-Automate QtyAvailable
  quantityOnOrder: integer("quantity_on_order").default(0), // E-Automate QtyOnOrder
  reorderPoint: integer("reorder_point").default(0), // E-Automate ReorderPoint
  reorderQuantity: integer("reorder_quantity").default(0), // E-Automate ReorderQty
  maxStockLevel: integer("max_stock_level"), // E-Automate MaxStockLevel
  
  // Pricing Information
  unitCost: decimal("unit_cost", { precision: 10, scale: 4 }), // E-Automate Cost
  averageCost: decimal("average_cost", { precision: 10, scale: 4 }), // E-Automate AverageCost
  lastCost: decimal("last_cost", { precision: 10, scale: 4 }), // E-Automate LastCost
  unitPrice: decimal("unit_price", { precision: 10, scale: 4 }), // E-Automate Price
  retailPrice: decimal("retail_price", { precision: 10, scale: 4 }), // E-Automate RetailPrice
  
  // Location Information
  warehouseLocation: varchar("warehouse_location"), // E-Automate Location
  binLocation: varchar("bin_location"), // E-Automate BinLocation
  
  // Vendor Information
  primaryVendor: varchar("primary_vendor"), // E-Automate Vendor
  vendorPartNumber: varchar("vendor_part_number"), // E-Automate VendorPartNumber
  
  // Item Specifications
  unitOfMeasure: varchar("unit_of_measure").default("EA"), // E-Automate UOM
  itemWeight: decimal("item_weight", { precision: 8, scale: 3 }), // E-Automate Weight
  isTaxable: boolean("is_taxable").default(true), // E-Automate Taxable
  isSerialized: boolean("is_serialized").default(false), // E-Automate Serialized
  isActive: boolean("is_active").default(true), // E-Automate Active
  
  // Activity Tracking
  lastSoldDate: timestamp("last_sold_date"), // E-Automate LastSold
  lastReceivedDate: timestamp("last_received_date"), // E-Automate LastReceived
  
  // System Tracking
  createdAt: timestamp("created_at").defaultNow(), // E-Automate DateCreated
  updatedAt: timestamp("updated_at").defaultNow(), // E-Automate LastModified
});

// Enhanced Invoices Table (E-Automate compatible)
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // E-Automate Compatibility
  externalInvoiceId: varchar("external_invoice_id"), // E-Automate InvoiceKey
  externalCustomerId: varchar("external_customer_id"), // E-Automate CustomerKey
  lastSyncDate: timestamp("last_sync_date"),
  
  // Invoice Identification
  customerId: varchar("customer_id").notNull(), // References business_records.id
  contractId: varchar("contract_id"), // References contracts.id
  invoiceNumber: varchar("invoice_number").unique(), // E-Automate InvoiceNumber
  invoiceDate: timestamp("invoice_date").notNull(), // E-Automate InvoiceDate
  dueDate: timestamp("due_date").notNull(), // E-Automate DueDate
  poNumber: varchar("po_number"), // E-Automate PONumber
  
  // Sales Information
  salesRep: varchar("sales_rep"), // E-Automate SalesRep
  invoiceType: varchar("invoice_type").default("sales"), // E-Automate InvoiceType: sales, service, lease, rental
  
  // Financial Totals
  subtotalAmount: decimal("subtotal_amount", { precision: 10, scale: 2 }), // E-Automate Subtotal
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }), // E-Automate TaxAmount
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(), // E-Automate Total
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).default('0'), // E-Automate AmountPaid
  balanceDue: decimal("balance_due", { precision: 10, scale: 2 }), // E-Automate Balance
  
  // Invoice Status
  invoiceStatus: varchar("invoice_status").default("open"), // E-Automate Status: open, paid, partial, overdue, void
  paymentTerms: varchar("payment_terms"), // E-Automate PaymentTerms
  
  // Billing Period (for recurring invoices)
  billingPeriodStart: timestamp("billing_period_start"), // E-Automate BillingPeriodStart
  billingPeriodEnd: timestamp("billing_period_end"), // E-Automate BillingPeriodEnd
  
  // Legacy fields for compatibility
  monthlyBase: decimal("monthly_base", { precision: 10, scale: 2 }).default('0'),
  blackCopiesTotal: integer("black_copies_total").default(0),
  colorCopiesTotal: integer("color_copies_total").default(0),
  blackAmount: decimal("black_amount", { precision: 10, scale: 2 }).default('0'),
  colorAmount: decimal("color_amount", { precision: 10, scale: 2 }).default('0'),
  status: varchar("status").default("draft"), // Legacy status field
  paidDate: timestamp("paid_date"),
  
  // System Tracking
  invoiceNotes: text("invoice_notes"), // E-Automate Notes
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(), // E-Automate DateCreated
  updatedAt: timestamp("updated_at").defaultNow(), // E-Automate LastModified
});

// Enhanced Invoice Line Items Table (E-Automate compatible)
export const invoiceLineItems = pgTable("invoice_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // E-Automate Compatibility
  externalLineItemId: varchar("external_line_item_id"), // E-Automate DetailKey
  externalInvoiceId: varchar("external_invoice_id"), // E-Automate InvoiceKey
  externalItemId: varchar("external_item_id"), // E-Automate ItemKey
  externalEquipmentId: varchar("external_equipment_id"), // E-Automate EquipmentKey
  
  // Line Item Identification
  invoiceId: varchar("invoice_id").notNull(), // References invoices.id
  equipmentId: varchar("equipment_id"), // References equipment.id
  meterReadingId: varchar("meter_reading_id"), // References meter_readings.id
  
  // Line Item Details
  lineDescription: text("line_description"), // E-Automate Description
  quantity: integer("quantity").default(0), // E-Automate Quantity
  unitPrice: decimal("unit_price", { precision: 10, scale: 4 }), // E-Automate UnitPrice
  extendedPrice: decimal("extended_price", { precision: 10, scale: 2 }), // E-Automate ExtendedPrice
  
  // Discounts
  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }), // E-Automate DiscountPercent
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }), // E-Automate DiscountAmount
  
  // Tax Information
  taxRate: decimal("tax_rate", { precision: 5, scale: 4 }), // E-Automate TaxRate
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }), // E-Automate TaxAmount
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }), // E-Automate LineTotal
  
  // Accounting
  glAccountCode: varchar("gl_account_code"), // E-Automate GLAccount
  
  // Equipment/Service Specific
  serialNumber: varchar("serial_number"), // E-Automate SerialNumber
  meterStartReading: integer("meter_start_reading"), // E-Automate MeterStart
  meterEndReading: integer("meter_end_reading"), // E-Automate MeterEnd
  meterUsage: integer("meter_usage"), // E-Automate MeterUsage
  billingType: varchar("billing_type"), // E-Automate BillingType: base, overage, one-time, recurring
  
  // Legacy fields for compatibility
  description: varchar("description"), // Legacy description field
  rate: decimal("rate", { precision: 10, scale: 4 }).default('0'),
  amount: decimal("amount", { precision: 10, scale: 2 }),
  lineType: varchar("line_type").default("meter"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Employees/Technicians Table (E-Automate compatible)
export const employees = pgTable("employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // E-Automate Compatibility
  externalEmployeeId: varchar("external_employee_id"), // E-Automate EmployeeKey
  employeeNumber: varchar("employee_number").unique(), // E-Automate EmployeeNumber
  lastSyncDate: timestamp("last_sync_date"),
  
  // Personal Information
  firstName: varchar("first_name").notNull(), // E-Automate FirstName
  lastName: varchar("last_name").notNull(), // E-Automate LastName
  workEmail: varchar("work_email"), // E-Automate Email
  workPhone: varchar("work_phone"), // E-Automate Phone
  mobilePhone: varchar("mobile_phone"), // E-Automate Mobile
  
  // Employment Information
  department: varchar("department"), // E-Automate Department
  jobTitle: varchar("job_title"), // E-Automate Title
  hireDate: timestamp("hire_date"), // E-Automate HireDate
  terminationDate: timestamp("termination_date"), // E-Automate TerminationDate
  managerId: varchar("manager_id"), // E-Automate Manager
  
  // Territory & Sales
  assignedTerritory: varchar("assigned_territory"), // E-Automate Territory
  commissionRate: decimal("commission_rate", { precision: 5, scale: 4 }), // E-Automate CommissionRate
  
  // Technician Information
  hourlyLaborRate: decimal("hourly_labor_rate", { precision: 10, scale: 2 }), // E-Automate LaborRate
  technicianCertificationLevel: varchar("technician_certification_level"), // E-Automate TechnicianLevel
  
  // Status
  isActive: boolean("is_active").default(true), // E-Automate Active
  
  // System Tracking
  employeeNotes: text("employee_notes"), // E-Automate Notes
  createdAt: timestamp("created_at").defaultNow(), // E-Automate DateCreated
  updatedAt: timestamp("updated_at").defaultNow(), // E-Automate LastModified
});

// Vendors/Suppliers Table (E-Automate compatible)
export const vendors = pgTable("vendors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // E-Automate Compatibility
  externalVendorId: varchar("external_vendor_id"), // E-Automate VendorKey
  lastSyncDate: timestamp("last_sync_date"),
  
  // Vendor Information
  vendorName: varchar("vendor_name").notNull(), // E-Automate VendorName
  primaryContactName: varchar("primary_contact_name"), // E-Automate ContactName
  
  // Address Information
  addressLine1: varchar("address_line_1"), // E-Automate Address1
  addressLine2: varchar("address_line_2"), // E-Automate Address2
  city: varchar("city"), // E-Automate City
  state: varchar("state"), // E-Automate State
  zipCode: varchar("zip_code"), // E-Automate ZipCode
  
  // Contact Information
  phone: varchar("phone"), // E-Automate Phone
  fax: varchar("fax"), // E-Automate Fax
  email: varchar("email"), // E-Automate Email
  website: varchar("website"), // E-Automate Website
  
  // Financial Information
  paymentTerms: varchar("payment_terms"), // E-Automate PaymentTerms
  taxId: varchar("tax_id"), // E-Automate TaxID
  accountNumber: varchar("account_number"), // E-Automate AccountNumber
  creditLimit: decimal("credit_limit", { precision: 10, scale: 2 }), // E-Automate CreditLimit
  
  // Status
  isActive: boolean("is_active").default(true), // E-Automate Active
  
  // System Tracking
  vendorNotes: text("vendor_notes"), // E-Automate Notes
  createdAt: timestamp("created_at").defaultNow(), // E-Automate DateCreated
  updatedAt: timestamp("updated_at").defaultNow(), // E-Automate LastModified
});

// REMOVED: Old leadActivities table - now using unified businessRecordActivities

// Additional contacts at a company (beyond primary contact)
export const leadContacts = pgTable("lead_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  leadId: varchar("lead_id").notNull(),
  
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  title: varchar("title"),
  department: varchar("department"),
  phone: varchar("phone"),
  email: varchar("email"),
  isPrimary: boolean("is_primary").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Related records tracking (deals, equipment, service requests, etc.)
export const leadRelatedRecords = pgTable("lead_related_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  leadId: varchar("lead_id").notNull(),
  
  recordType: varchar("record_type").notNull(), // deals, equipment, agreements, service_requests, credit_applications, tco_mps, files, business_history, site_surveys
  recordId: varchar("record_id").notNull(),
  recordTitle: varchar("record_title"),
  recordCount: integer("record_count").default(1),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// CRM - Quotes/Proposals
export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  leadId: varchar("lead_id"),
  customerId: varchar("customer_id"),
  quoteNumber: varchar("quote_number").notNull(),
  title: varchar("title").notNull(),
  status: varchar("status").notNull().default('draft'), // draft, sent, accepted, rejected, expired
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  validUntil: timestamp("valid_until").notNull(),
  terms: text("terms"),
  notes: text("notes"),
  createdBy: varchar("created_by").notNull(),
  sentDate: timestamp("sent_date"),
  acceptedDate: timestamp("accepted_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// CRM - Quote line items
export const quoteLineItems = pgTable("quote_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  quoteId: varchar("quote_id").notNull(),
  description: varchar("description").notNull(),
  quantity: integer("quantity").default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Unified Business Record Activities - Single activity table for entire lifecycle
export const businessRecordActivities = pgTable("business_record_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  businessRecordId: varchar("business_record_id").notNull(), // References businessRecords.id
  
  // Activity Details
  activityType: varchar("activity_type").notNull(), // email, call, meeting, demo, proposal, task, note, external, service_call, billing, churn_prevention
  subject: varchar("subject").notNull(),
  description: text("description"),
  direction: varchar("direction"), // inbound, outbound
  
  // Email Information
  emailFrom: varchar("email_from"),
  emailTo: text("email_to"), // JSON array for multiple recipients
  emailCc: text("email_cc"),
  emailSubject: varchar("email_subject"),
  emailBody: text("email_body"),
  isShared: boolean("is_shared").default(false),
  
  // Call Information
  callDuration: integer("call_duration"), // in minutes
  callOutcome: varchar("call_outcome"), // answered, no_answer, busy, voicemail
  
  // Scheduling
  scheduledDate: timestamp("scheduled_date"),
  completedDate: timestamp("completed_date"),
  dueDate: timestamp("due_date"),
  
  // Outcomes & Follow-up
  outcome: varchar("outcome"), // completed, no_response, rescheduled, cancelled, replied
  nextAction: text("next_action"),
  followUpDate: timestamp("follow_up_date"),
  
  // Related Records & Attachments
  relatedRecords: jsonb("related_records"), // Links to deals, agreements, etc.
  attachments: jsonb("attachments"), // File references
  
  // Tracking
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// For backward compatibility during migration
export const leadActivities = businessRecordActivities; // Alias for existing code
export const customerActivities = businessRecordActivities; // Alias for existing code

// Customer Contacts (exact clone of leadContacts structure)
export const customerContacts = pgTable("customer_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  customerId: varchar("customer_id").notNull(),
  
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  title: varchar("title"),
  department: varchar("department"),
  phone: varchar("phone"),
  email: varchar("email"),
  isPrimary: boolean("is_primary").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Customer Related Records (exact clone of leadRelatedRecords structure)
export const customerRelatedRecords = pgTable("customer_related_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  customerId: varchar("customer_id").notNull(),
  
  recordType: varchar("record_type").notNull(), // deals, equipment, agreements, service_requests, credit_applications, tco_mps, files, business_history, site_surveys, invoices, meter_readings
  recordId: varchar("record_id").notNull(),
  recordTitle: varchar("record_title"),
  recordCount: integer("record_count").default(1),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Type exports for the new customer management system - commented out to avoid duplicates
// export type Customer = typeof customers.$inferSelect;
// export type InsertCustomer = typeof customers.$inferInsert;
export type CustomerActivity = typeof customerActivities.$inferSelect;
export type InsertCustomerActivity = typeof customerActivities.$inferInsert;
export type CustomerContact = typeof customerContacts.$inferSelect;
export type InsertCustomerContact = typeof customerContacts.$inferInsert;
export type CustomerRelatedRecord = typeof customerRelatedRecords.$inferSelect;
export type InsertCustomerRelatedRecord = typeof customerRelatedRecords.$inferInsert;

// Create insert schemas for validation - these are defined later in the file with proper omit clauses

// Deal Pipeline Stages Configuration - Customizable sales stages
export const dealStages = pgTable("deal_stages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Stage Configuration
  name: varchar("name", { length: 100 }).notNull(), // e.g., "Appointment Scheduled"
  description: text("description"),
  color: varchar("color", { length: 7 }).default("#3B82F6"), // hex color for UI
  
  // Stage Properties
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").default(true),
  isClosingStage: boolean("is_closing_stage").default(false), // for "Closed Won/Lost"
  isWonStage: boolean("is_won_stage").default(false), // specifically for "Closed Won"
  
  // Stage Automation
  requiresApproval: boolean("requires_approval").default(false),
  autoMoveConditions: jsonb("auto_move_conditions"), // JSON rules for auto-advancement
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Deals - Sales opportunities with pipeline tracking
export const deals = pgTable("deals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Deal Basics
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  amount: decimal("amount", { precision: 12, scale: 2 }),
  
  // Deal Assignment
  ownerId: varchar("owner_id").notNull(), // sales rep responsible
  customerId: varchar("customer_id"), // references customers.id
  companyName: varchar("company_name"), // for quick reference if no customer record
  
  // Pipeline Information
  stageId: varchar("stage_id").notNull(), // references dealStages.id
  probability: integer("probability").default(0), // 0-100 percentage
  expectedCloseDate: timestamp("expected_close_date"),
  actualCloseDate: timestamp("actual_close_date"),
  
  // Deal Source and Type
  source: varchar("source"), // e.g., "Website", "Referral", "Cold Call"
  dealType: varchar("deal_type"), // e.g., "New Business", "Upsell", "Renewal"
  priority: varchar("priority").default("medium"), // low, medium, high
  
  // Contact Information
  primaryContactName: varchar("primary_contact_name"),
  primaryContactEmail: varchar("primary_contact_email"),
  primaryContactPhone: varchar("primary_contact_phone"),
  
  // Products and Services
  productsInterested: text("products_interested"),
  estimatedMonthlyValue: decimal("estimated_monthly_value", { precision: 10, scale: 2 }),
  
  // Deal Status
  status: varchar("status").notNull().default("open"), // open, won, lost, on_hold
  lostReason: varchar("lost_reason"), // reason if status is "lost"
  
  // Tracking
  lastActivityDate: timestamp("last_activity_date"),
  nextFollowUpDate: timestamp("next_follow_up_date"),
  createdById: varchar("created_by_id").notNull(),
  
  // Notes and History
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Deal Activities - Track all interactions and updates
export const dealActivities = pgTable("deal_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  dealId: varchar("deal_id").notNull(),
  
  // Activity Details
  type: varchar("type").notNull(), // e.g., "call", "email", "meeting", "note", "stage_change"
  subject: varchar("subject", { length: 200 }),
  description: text("description"),
  
  // Activity Metadata
  userId: varchar("user_id").notNull(), // who performed the activity
  duration: integer("duration"), // in minutes
  outcome: varchar("outcome"), // e.g., "positive", "neutral", "negative"
  
  // Related Data
  previousValue: text("previous_value"), // for tracking changes (JSON)
  newValue: text("new_value"), // for tracking changes (JSON)
  
  createdAt: timestamp("created_at").defaultNow(),
});

// The comprehensive customers table is defined above (line 448) with all necessary fields

// Contracts table - Enhanced for comprehensive meter billing
export const contracts = pgTable("contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  customerId: varchar("customer_id").notNull(),
  contractNumber: varchar("contract_number").notNull(),
  contractType: varchar("contract_type").notNull().default('cost_per_click'), // cost_per_click, flat_rate, hybrid
  
  // Contract Dates
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  autoRenewal: boolean("auto_renewal").default(false),
  renewalTerms: integer("renewal_terms").default(12), // months
  
  // Base Rates (simple contracts)
  blackRate: decimal("black_rate", { precision: 10, scale: 4 }),
  colorRate: decimal("color_rate", { precision: 10, scale: 4 }),
  monthlyBase: decimal("monthly_base", { precision: 10, scale: 2 }),
  
  // Tiered Billing Support
  hasTieredRates: boolean("has_tiered_rates").default(false),
  
  // Minimum Volume Commitments
  minimumBlackVolume: integer("minimum_black_volume").default(0),
  minimumColorVolume: integer("minimum_color_volume").default(0),
  
  // Billing Settings
  billingFrequency: varchar("billing_frequency").notNull().default('monthly'), // monthly, quarterly, annual
  billingDate: integer("billing_date").default(1), // day of month
  invoiceTerms: varchar("invoice_terms").notNull().default('net_30'), // net_15, net_30, net_60
  
  // Contract Profitability Tracking
  equipmentCost: decimal("equipment_cost", { precision: 10, scale: 2 }),
  installationCost: decimal("installation_cost", { precision: 10, scale: 2 }),
  estimatedMargin: decimal("estimated_margin", { precision: 5, scale: 2 }), // percentage
  
  // Status and Management
  status: varchar("status").notNull().default('active'), // active, inactive, expired, cancelled
  assignedSalespersonId: varchar("assigned_salesperson_id"),
  serviceLevel: varchar("service_level").notNull().default('standard'), // standard, premium, basic
  
  // Notes and Special Terms
  notes: text("notes"),
  specialTerms: text("special_terms"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Contract Tiered Rates - For complex billing structures
export const contractTieredRates = pgTable("contract_tiered_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  contractId: varchar("contract_id").notNull(),
  
  // Tier Configuration
  tierName: varchar("tier_name").notNull(), // e.g., "0-1000", "1001-5000", "5000+"
  colorType: varchar("color_type").notNull(), // 'black', 'color'
  
  // Volume Ranges
  minimumVolume: integer("minimum_volume").notNull().default(0),
  maximumVolume: integer("maximum_volume"), // null for unlimited
  
  // Rates
  rate: decimal("rate", { precision: 10, scale: 4 }).notNull(), // cost per copy
  minimumCharge: decimal("minimum_charge", { precision: 10, scale: 2 }), // minimum monthly charge for this tier
  
  // Tier Order for Processing
  sortOrder: integer("sort_order").notNull().default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Product Management System - Models (Top-level products like copiers)
export const productModels = pgTable("product_models", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Basic Product Information
  productCode: varchar("product_code").notNull(),
  productName: varchar("product_name").notNull(),
  category: varchar("category").default("MFP"),
  manufacturer: varchar("manufacturer"),
  description: text("description"),
  msrp: decimal("msrp", { precision: 10, scale: 2 }),
  
  // Product specifications
  colorMode: varchar("color_mode"),
  colorSpeed: varchar("color_speed"),
  bwSpeed: varchar("bw_speed"),
  productFamily: varchar("product_family"),
  
  // Pricing tiers
  newActive: boolean("new_active").default(false),
  newRepPrice: decimal("new_rep_price", { precision: 10, scale: 2 }),
  upgradeActive: boolean("upgrade_active").default(false),
  upgradeRepPrice: decimal("upgrade_rep_price", { precision: 10, scale: 2 }),
  lexmarkActive: boolean("lexmark_active").default(false),
  lexmarkRepPrice: decimal("lexmark_rep_price", { precision: 10, scale: 2 }),
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Product Accessories (Associated with Models)
export const productAccessories = pgTable("product_accessories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  modelId: varchar("model_id").notNull(), // references productModels.id
  
  // Basic Information  
  accessoryCode: varchar("accessory_code").notNull(),
  accessoryName: varchar("accessory_name").notNull(),
  category: varchar("category"),
  description: text("description"),
  msrp: decimal("msrp", { precision: 10, scale: 2 }),
  repPrice: decimal("rep_price", { precision: 10, scale: 2 }),
  
  // Compatibility and Requirements
  isRequired: boolean("is_required").default(false),
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// CPC Rates (Copy Per Click rates for service/supplies)
export const cpcRates = pgTable("cpc_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  modelId: varchar("model_id").notNull(), // references productModels.id
  
  // Service & Supply rates from your CPC screenshot
  serviceName: varchar("service_name").notNull(), // e.g., "imagePRESS V1000 - Net New - B/W - 0 to 5999"
  pricingLevel: varchar("pricing_level").notNull(), // e.g., "Net New"
  colorMode: varchar("color_mode").notNull(), // "B/W" or "Color"
  type: varchar("type").notNull(), // "Base Minimum", "Upgrade", etc.
  minVolume: integer("min_volume").default(0),
  maxVolume: integer("max_volume"),
  baseRate: decimal("base_rate", { precision: 10, scale: 5 }), // e.g., 0.00700
  cpc: decimal("cpc", { precision: 10, scale: 5 }), // Cost per copy
  cpcOverage: decimal("cpc_overage", { precision: 10, scale: 5 }),
  includes: text("includes"), // What's included in the rate
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Service tickets table
export const serviceTickets = pgTable("service_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  customerId: varchar("customer_id").notNull(),
  equipmentId: varchar("equipment_id"),
  ticketNumber: varchar("ticket_number").notNull(),
  title: varchar("title").notNull(),
  description: text("description"),
  priority: varchar("priority").notNull().default('medium'), // low, medium, high, urgent
  status: varchar("status").notNull().default('open'), // open, assigned, in-progress, completed, cancelled
  assignedTechnicianId: varchar("assigned_technician_id"),
  scheduledDate: timestamp("scheduled_date"),
  estimatedDuration: integer("estimated_duration"), // minutes
  customerAddress: text("customer_address"),
  customerPhone: varchar("customer_phone"),
  requiredSkills: text("required_skills").array(),
  requiredParts: text("required_parts").array(),
  workOrderNotes: text("work_order_notes"),
  resolutionNotes: text("resolution_notes"),
  customerSignature: text("customer_signature"),
  partsUsed: text("parts_used").array(),
  laborHours: decimal("labor_hours", { precision: 4, scale: 2 }),
  createdBy: varchar("created_by").notNull(),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Service ticket updates/timeline table
export const serviceTicketUpdates = pgTable("service_ticket_updates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  ticketId: varchar("ticket_id").notNull(),
  updateType: varchar("update_type").notNull(), // status_change, assignment, note, customer_communication
  oldValue: text("old_value"),
  newValue: text("new_value"),
  notes: text("notes"),
  updatedBy: varchar("updated_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Inventory items table
// Note: inventoryItems table is defined above with full E-Automate compatibility

// Technicians table
export const technicians = pgTable("technicians", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  userId: varchar("user_id").notNull(),
  employeeId: varchar("employee_id"),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  email: varchar("email").notNull(),
  phone: varchar("phone"),
  skills: text("skills").array(),
  certifications: text("certifications").array(),
  currentLocation: text("current_location"),
  isActive: boolean("is_active").default(true),
  isAvailable: boolean("is_available").default(true),
  workingHours: text("working_hours"),
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Technician availability table for scheduling
export const technicianAvailability = pgTable("technician_availability", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  technicianId: varchar("technician_id").notNull(),
  date: timestamp("date").notNull(),
  startTime: varchar("start_time").notNull(),
  endTime: varchar("end_time").notNull(),
  isBooked: boolean("is_booked").default(false),
  ticketId: varchar("ticket_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Note: E-Automate compatible invoices and invoiceLineItems tables are defined above with comprehensive features

// CRM Activity Goal Types
export const activityGoalTypeEnum = pgEnum("activity_goal_type", [
  "calls",
  "emails", 
  "meetings",
  "reachouts", // Combined calls + emails
  "proposals",
  "new_opportunities",
  "demos",
  "follow_ups"
]);

// CRM Goal Periods
export const goalPeriodEnum = pgEnum("goal_period", [
  "daily",
  "weekly", 
  "monthly",
  "quarterly",
  "yearly"
]);

// CRM Sales Goals - Manager sets goals for reps/teams
export const salesGoals = pgTable("sales_goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Goal Assignment
  assignedToUserId: varchar("assigned_to_user_id"), // Individual rep
  assignedToTeamId: varchar("assigned_to_team_id"), // Team goal
  assignedBy: varchar("assigned_by").notNull(), // Manager who set the goal
  
  // Goal Details
  goalType: activityGoalTypeEnum("goal_type").notNull(),
  targetCount: integer("target_count").notNull(), // e.g., 50 calls per week
  period: goalPeriodEnum("period").notNull(),
  
  // Time Period
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  
  // Status & Notes
  isActive: boolean("is_active").default(true),
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// CRM Sales Teams - Hierarchical team structure  
export const salesTeams = pgTable("sales_teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  name: varchar("name").notNull(), // e.g., "Enterprise Sales Team"
  description: text("description"),
  
  // Hierarchy
  parentTeamId: varchar("parent_team_id"), // For nested team structures
  teamLevel: integer("team_level").default(1), // 1=top level, 2=sub-team, etc.
  
  // Leadership
  managerId: varchar("manager_id").notNull(), // Team manager/lead
  territory: varchar("territory"), // Geographic or vertical territory
  
  // Status
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// CRM Team Members - Many-to-many relationship
export const salesTeamMembers = pgTable("sales_team_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  teamId: varchar("team_id").notNull(),
  userId: varchar("user_id").notNull(),
  
  // Role within team
  role: varchar("role").default("member"), // member, lead, manager
  joinedDate: timestamp("joined_date").defaultNow(),
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// CRM Activity Reporting - Aggregated daily/weekly/monthly stats
export const activityReports = pgTable("activity_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Report Scope
  userId: varchar("user_id"), // Individual rep stats
  teamId: varchar("team_id"), // Team stats
  
  // Time Period  
  reportDate: timestamp("report_date").notNull(), // Date of the report
  period: goalPeriodEnum("period").notNull(), // daily, weekly, monthly, etc.
  
  // Activity Counts
  totalCalls: integer("total_calls").default(0),
  totalEmails: integer("total_emails").default(0),
  totalMeetings: integer("total_meetings").default(0),
  totalReachouts: integer("total_reachouts").default(0), // calls + emails
  totalProposals: integer("total_proposals").default(0),
  totalNewOpportunities: integer("total_new_opportunities").default(0),
  totalDemos: integer("total_demos").default(0),
  totalFollowUps: integer("total_follow_ups").default(0),
  
  // Outcome Metrics
  connectedCalls: integer("connected_calls").default(0), // calls that were answered
  emailReplies: integer("email_replies").default(0),
  meetingsScheduled: integer("meetings_scheduled").default(0),
  proposalsAccepted: integer("proposals_accepted").default(0),
  opportunitiesConverted: integer("opportunities_converted").default(0),
  
  // Performance Metrics
  callConnectRate: decimal("call_connect_rate", { precision: 5, scale: 2 }), // %
  emailReplyRate: decimal("email_reply_rate", { precision: 5, scale: 2 }), // %
  meetingShowRate: decimal("meeting_show_rate", { precision: 5, scale: 2 }), // %
  proposalWinRate: decimal("proposal_win_rate", { precision: 5, scale: 2 }), // %
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// CRM Goal Progress Tracking - Real-time goal vs actual tracking
export const goalProgress = pgTable("goal_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  goalId: varchar("goal_id").notNull(),
  reportDate: timestamp("report_date").notNull(), // Date for progress snapshot
  
  currentCount: integer("current_count").default(0), // Current progress
  targetCount: integer("target_count").notNull(), // Target from goal
  progressPercentage: decimal("progress_percentage", { precision: 5, scale: 2 }), // %
  
  // Trend Analysis
  dailyAverage: decimal("daily_average", { precision: 10, scale: 2 }),
  projectedTotal: integer("projected_total"), // Projected end total based on current pace
  onTrack: boolean("on_track").default(true), // Whether on track to meet goal
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Sales Performance Analytics Tables
export const salesMetrics = pgTable("sales_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  userId: varchar("user_id").references(() => users.id),
  teamId: varchar("team_id").references(() => salesTeams.id),
  metricPeriod: varchar("metric_period").notNull(), // daily, weekly, monthly, quarterly
  periodStartDate: timestamp("period_start_date").notNull(),
  periodEndDate: timestamp("period_end_date").notNull(),
  
  // Activity Metrics
  totalCalls: integer("total_calls").default(0),
  answeredCalls: integer("answered_calls").default(0),
  totalEmails: integer("total_emails").default(0),
  emailReplies: integer("email_replies").default(0),
  totalMeetings: integer("total_meetings").default(0),
  meetingsHeld: integer("meetings_held").default(0),
  
  // Conversion Metrics
  callAnswerRate: decimal("call_answer_rate", { precision: 5, scale: 2 }).default("0"),
  emailResponseRate: decimal("email_response_rate", { precision: 5, scale: 2 }).default("0"),
  activityToMeetingRate: decimal("activity_to_meeting_rate", { precision: 5, scale: 2 }).default("0"),
  meetingToProposalRate: decimal("meeting_to_proposal_rate", { precision: 5, scale: 2 }).default("0"),
  proposalClosingRate: decimal("proposal_closing_rate", { precision: 5, scale: 2 }).default("0"),
  
  // Deal Metrics
  totalProposals: integer("total_proposals").default(0),
  closedDeals: integer("closed_deals").default(0),
  totalRevenue: decimal("total_revenue", { precision: 12, scale: 2 }).default("0"),
  averageDealSize: decimal("average_deal_size", { precision: 12, scale: 2 }).default("0"),
  activitiesPerDeal: decimal("activities_per_deal", { precision: 8, scale: 2 }).default("0"),
  
  // Performance Insights
  activitiesNeededForGoal: integer("activities_needed_for_goal").default(0),
  projectedRevenue: decimal("projected_revenue", { precision: 12, scale: 2 }).default("0"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Conversion Funnel Tracking
export const conversionFunnel = pgTable("conversion_funnel", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  userId: varchar("user_id").references(() => users.id),
  teamId: varchar("team_id").references(() => salesTeams.id),
  trackingPeriod: varchar("tracking_period").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  
  // Funnel Stages
  totalActivities: integer("total_activities").default(0), // calls + emails
  connectionsEstablished: integer("connections_established").default(0), // answered calls + email replies
  meetingsScheduled: integer("meetings_scheduled").default(0),
  meetingsHeld: integer("meetings_held").default(0),
  proposalsSent: integer("proposals_sent").default(0),
  dealsWon: integer("deals_won").default(0),
  
  // Stage Conversion Rates
  activityToConnectionRate: decimal("activity_to_connection_rate", { precision: 5, scale: 2 }).default("0"),
  connectionToMeetingRate: decimal("connection_to_meeting_rate", { precision: 5, scale: 2 }).default("0"),
  meetingToProposalRate: decimal("meeting_to_proposal_rate", { precision: 5, scale: 2 }).default("0"),
  proposalToWinRate: decimal("proposal_to_win_rate", { precision: 5, scale: 2 }).default("0"),
  overallConversionRate: decimal("overall_conversion_rate", { precision: 5, scale: 2 }).default("0"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Manager Insights and Recommendations
export const managerInsights = pgTable("manager_insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  managerId: varchar("manager_id").notNull().references(() => users.id),
  teamId: varchar("team_id").references(() => salesTeams.id),
  userId: varchar("user_id").references(() => users.id), // null for team-level insights
  
  insightType: varchar("insight_type").notNull(), // performance_gap, goal_projection, conversion_optimization, activity_recommendation
  insightCategory: varchar("insight_category").notNull(), // calls, emails, meetings, proposals, deals, revenue
  
  // Key Metrics
  currentPerformance: decimal("current_performance", { precision: 10, scale: 2 }),
  targetPerformance: decimal("target_performance", { precision: 10, scale: 2 }),
  performanceGap: decimal("performance_gap", { precision: 10, scale: 2 }),
  
  // Recommendations
  recommendedActions: jsonb("recommended_actions"), // Array of action objects
  priorityLevel: varchar("priority_level").notNull(), // high, medium, low
  expectedImpact: varchar("expected_impact"), // high, medium, low
  timeframe: varchar("timeframe"), // immediate, short_term, long_term
  
  // Insight Details
  insightTitle: varchar("insight_title").notNull(),
  insightDescription: text("insight_description"),
  supportingData: jsonb("supporting_data"),
  
  isActive: boolean("is_active").default(true),
  isRead: boolean("is_read").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Onboarding Checklist Status Enum
export const onboardingStatusEnum = pgEnum("onboarding_status", [
  "draft",
  "in_progress", 
  "pending_review",
  "completed",
  "on_hold"
]);

// Onboarding Installation Type Enum
export const installationTypeEnum = pgEnum("installation_type", [
  "new_installation",
  "replacement",
  "relocation",
  "upgrade"
]);

// Network Assignment Type Enum
export const networkAssignmentEnum = pgEnum("network_assignment", [
  "static", 
  "dhcp",
  "reserved_dhcp"
]);

// Print Management System Enum
export const printManagementEnum = pgEnum("print_management_system", [
  "papercut",
  "equitrac", 
  "ysoft",
  "other",
  "none"
]);

// Onboarding Checklists - Main checklist container
export const onboardingChecklists = pgTable("onboarding_checklists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Reference Data
  customerId: varchar("customer_id").notNull(), // Links to businessRecords
  quoteId: varchar("quote_id"), // Auto-populates from quote if available
  orderId: varchar("order_id"), // Links to purchase order if available
  
  // Basic Information
  checklistTitle: varchar("checklist_title").notNull(),
  description: text("description"),
  status: onboardingStatusEnum("status").default("draft"),
  installationType: installationTypeEnum("installation_type").notNull(),
  
  // Customer Information (auto-populated from quote/order)
  customerData: jsonb("customer_data"), // Company, contacts, billing info
  siteInformation: jsonb("site_information"), // Installation location details
  
  // Equipment Information (auto-populated from quote/order)
  equipmentDetails: jsonb("equipment_details"), // Equipment list, models, quantities
  
  // Installation Planning
  scheduledInstallDate: timestamp("scheduled_install_date"),
  actualInstallDate: timestamp("actual_install_date"),
  assignedTechnicianId: varchar("assigned_technician_id"),
  estimatedDuration: integer("estimated_duration"), // hours
  
  // Special Requirements
  accessRequirements: text("access_requirements"),
  businessHours: jsonb("business_hours"), // Working hours, timezone
  specialInstructions: text("special_instructions"),
  
  // Generated Documents
  pdfUrl: varchar("pdf_url"), // Object storage path to generated PDF
  pdfGeneratedAt: timestamp("pdf_generated_at"),
  
  // Tracking
  completedSections: integer("completed_sections").default(0),
  totalSections: integer("total_sections").default(0),
  progressPercentage: decimal("progress_percentage", { precision: 5, scale: 2 }).default("0"),
  
  // Metadata
  createdBy: varchar("created_by").notNull(),
  lastModifiedBy: varchar("last_modified_by"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Onboarding Equipment Records - Individual equipment items
export const onboardingEquipment = pgTable("onboarding_equipment", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  checklistId: varchar("checklist_id").notNull(),
  
  // Equipment Identity
  equipmentId: varchar("equipment_id"), // Links to main equipment table if exists
  manufacturer: varchar("manufacturer").notNull(),
  model: varchar("model").notNull(),
  serialNumber: varchar("serial_number"),
  assetTag: varchar("asset_tag"),
  
  // Network Configuration
  targetIpAddress: varchar("target_ip_address"),
  hostname: varchar("hostname"),
  macAddress: varchar("mac_address"),
  networkAssignment: networkAssignmentEnum("network_assignment"),
  
  // Location Information
  buildingLocation: varchar("building_location"),
  roomLocation: varchar("room_location"),
  specificLocation: text("specific_location"),
  
  // Replacement Information (if applicable)
  isReplacement: boolean("is_replacement").default(false),
  oldEquipmentData: jsonb("old_equipment_data"), // Old device details for replacement
  
  // Installation Details
  isInstalled: boolean("is_installed").default(false),
  installDate: timestamp("install_date"),
  installNotes: text("install_notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Onboarding Network Configuration - Detailed network setup
export const onboardingNetworkConfig = pgTable("onboarding_network_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  checklistId: varchar("checklist_id").notNull(),
  equipmentId: varchar("equipment_id"), // Links to onboardingEquipment
  
  // IP Configuration
  ipAddress: varchar("ip_address"),
  subnetMask: varchar("subnet_mask"),
  gateway: varchar("gateway"),
  dnsServers: text("dns_servers").array(),
  
  // Network Infrastructure
  vlanId: integer("vlan_id"),
  switchPort: varchar("switch_port"),
  switchLocation: varchar("switch_location"),
  
  // Hostname/DNS
  domainName: varchar("domain_name"),
  hostnameConvention: varchar("hostname_convention"),
  dnsUpdateRequired: boolean("dns_update_required").default(false),
  
  // Firewall & Security
  firewallRules: jsonb("firewall_rules"),
  qosSettings: jsonb("qos_settings"),
  
  isConfigured: boolean("is_configured").default(false),
  configurationNotes: text("configuration_notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Onboarding Print Management Configuration
export const onboardingPrintManagement = pgTable("onboarding_print_management", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  checklistId: varchar("checklist_id").notNull(),
  equipmentId: varchar("equipment_id"), // Links to onboardingEquipment
  
  // Print Management System
  system: printManagementEnum("system").notNull(),
  systemVersion: varchar("system_version"),
  serverAddress: varchar("server_address"),
  
  // Queue Configuration
  queueName: varchar("queue_name"),
  costCenter: varchar("cost_center"),
  locationCode: varchar("location_code"),
  deviceType: varchar("device_type"), // printer, mfp, copier
  
  // User Access & Permissions
  authorizedGroups: text("authorized_groups").array(),
  printQuotas: jsonb("print_quotas"), // Daily/monthly limits, cost per page
  printRestrictions: jsonb("print_restrictions"), // Color, duplex, time restrictions
  
  // Account Codes
  accountCodesRequired: boolean("account_codes_required").default(false),
  validAccountCodes: text("valid_account_codes").array(),
  defaultAccountCode: varchar("default_account_code"),
  
  isConfigured: boolean("is_configured").default(false),
  configurationNotes: text("configuration_notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Onboarding Dynamic Sections - Free-form customizable sections
export const onboardingDynamicSections = pgTable("onboarding_dynamic_sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  checklistId: varchar("checklist_id").notNull(),
  
  // Section Configuration
  sectionTitle: varchar("section_title").notNull(),
  sectionDescription: text("section_description"),
  sectionOrder: integer("section_order").default(0),
  sectionType: varchar("section_type").notNull(), // custom_form, checklist, documentation, requirements
  
  // Dynamic Fields Configuration
  fieldsConfig: jsonb("fields_config"), // Array of field definitions
  formData: jsonb("form_data"), // User-entered data
  
  // Section Status
  isRequired: boolean("is_required").default(false),
  isCompleted: boolean("is_completed").default(false),
  completedBy: varchar("completed_by"),
  completedAt: timestamp("completed_at"),
  
  // Notes & Documentation
  notes: text("notes"),
  attachments: text("attachments").array(), // File paths for attachments
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Onboarding Tasks - Individual action items
export const onboardingTasks = pgTable("onboarding_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  checklistId: varchar("checklist_id").notNull(),
  sectionId: varchar("section_id"), // Links to onboardingDynamicSections if applicable
  
  // Task Details
  taskTitle: varchar("task_title").notNull(),
  taskDescription: text("task_description"),
  taskType: varchar("task_type").notNull(), // installation, configuration, testing, documentation, training
  priority: varchar("priority").default("medium"), // high, medium, low
  
  // Assignment
  assignedTo: varchar("assigned_to"), // User ID
  assignedTeam: varchar("assigned_team"), // Team ID
  estimatedHours: decimal("estimated_hours", { precision: 4, scale: 2 }),
  
  // Scheduling
  dueDate: timestamp("due_date"),
  scheduledDate: timestamp("scheduled_date"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  
  // Dependencies
  dependsOn: text("depends_on").array(), // Array of task IDs that must be completed first
  blockedBy: text("blocked_by").array(), // Array of task IDs that are blocking this task
  
  // Status Tracking
  status: varchar("status").default("pending"), // pending, in_progress, completed, blocked, cancelled
  progressNotes: text("progress_notes"),
  
  // Results & Documentation
  completionNotes: text("completion_notes"),
  attachments: text("attachments").array(),
  verifiedBy: varchar("verified_by"),
  verificationDate: timestamp("verification_date"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Zod schemas for onboarding system
export const insertOnboardingChecklistSchema = createInsertSchema(onboardingChecklists).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOnboardingEquipmentSchema = createInsertSchema(onboardingEquipment).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOnboardingNetworkConfigSchema = createInsertSchema(onboardingNetworkConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOnboardingPrintManagementSchema = createInsertSchema(onboardingPrintManagement).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOnboardingDynamicSectionSchema = createInsertSchema(onboardingDynamicSections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOnboardingTaskSchema = createInsertSchema(onboardingTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for onboarding system
export type OnboardingChecklist = typeof onboardingChecklists.$inferSelect;
export type InsertOnboardingChecklist = z.infer<typeof insertOnboardingChecklistSchema>;

export type OnboardingEquipment = typeof onboardingEquipment.$inferSelect;
export type InsertOnboardingEquipment = z.infer<typeof insertOnboardingEquipmentSchema>;

export type OnboardingNetworkConfig = typeof onboardingNetworkConfig.$inferSelect;
export type InsertOnboardingNetworkConfig = z.infer<typeof insertOnboardingNetworkConfigSchema>;

export type OnboardingPrintManagement = typeof onboardingPrintManagement.$inferSelect;
export type InsertOnboardingPrintManagement = z.infer<typeof insertOnboardingPrintManagementSchema>;

export type OnboardingDynamicSection = typeof onboardingDynamicSections.$inferSelect;
export type InsertOnboardingDynamicSection = z.infer<typeof insertOnboardingDynamicSectionSchema>;

export type OnboardingTask = typeof onboardingTasks.$inferSelect;
export type InsertOnboardingTask = z.infer<typeof insertOnboardingTaskSchema>;

// Relations
export const rolesRelations = relations(roles, ({ many }) => ({
  users: many(users),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [teams.tenantId],
    references: [tenants.id],
  }),
  manager: one(users, {
    fields: [teams.managerId],
    references: [users.id],
  }),
  parentTeam: one(teams, {
    fields: [teams.parentTeamId],
    references: [teams.id],
  }),
  childTeams: many(teams),
  users: many(users),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
  role: one(roles, {
    fields: [users.roleId],
    references: [roles.id],
  }),
  team: one(teams, {
    fields: [users.teamId],
    references: [teams.id],
  }),
  manager: one(users, {
    fields: [users.managerId],
    references: [users.id],
  }),
  directReports: many(users),
  customerAssignments: many(userCustomerAssignments),
  ownedLeads: many(leads),
  createdLeads: many(leads),
  createdQuotes: many(quotes),
}));

export const userCustomerAssignmentsRelations = relations(userCustomerAssignments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [userCustomerAssignments.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [userCustomerAssignments.userId],
    references: [users.id],
  }),
  customer: one(customers, {
    fields: [userCustomerAssignments.customerId],
    references: [customers.id],
  }),
}));

// Company Relations - New primary business entity
export const companiesRelations = relations(companies, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [companies.tenantId],
    references: [tenants.id],
  }),
  contacts: many(companyContacts),
  leads: many(leads),
}));

export const companyContactsRelations = relations(companyContacts, ({ one }) => ({
  tenant: one(tenants, {
    fields: [companyContacts.tenantId],
    references: [tenants.id],
  }),
  company: one(companies, {
    fields: [companyContacts.companyId],
    references: [companies.id],
  }),
}));

// Business Records Relations - Unified for both leads and customers (Enhanced for Salesforce)
export const businessRecordsRelations = relations(businessRecords, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [businessRecords.tenantId],
    references: [tenants.id],
  }),
  // User Relations
  owner: one(users, {
    fields: [businessRecords.ownerId],
    references: [users.id],
  }),
  createdByUser: one(users, {
    fields: [businessRecords.createdBy],
    references: [users.id],
  }),
  convertedByUser: one(users, {
    fields: [businessRecords.convertedBy],
    references: [users.id],
  }),
  deactivatedByUser: one(users, {
    fields: [businessRecords.deactivatedBy],
    references: [users.id],
  }),
  // Enhanced Salesforce Relations
  enhancedContacts: many(enhancedContacts, {
    relationName: "companyContacts"
  }),
  opportunities: many(opportunities, {
    relationName: "accountOpportunities"
  }),
  // Legacy Relations
  activities: many(businessRecordActivities),
  quotes: many(quotes),
  contracts: many(contracts),
  serviceTickets: many(serviceTickets),
  meterReadings: many(meterReadings),
  invoices: many(invoices),
}));

export const businessRecordActivitiesRelations = relations(businessRecordActivities, ({ one }) => ({
  tenant: one(tenants, {
    fields: [businessRecordActivities.tenantId],
    references: [tenants.id],
  }),
  businessRecord: one(businessRecords, {
    fields: [businessRecordActivities.businessRecordId],
    references: [businessRecords.id],
  }),
  createdByUser: one(users, {
    fields: [businessRecordActivities.createdBy],
    references: [users.id],
  }),
}));

// Backward compatibility aliases
export const leadsRelations = businessRecordsRelations;
export const leadActivitiesRelations = businessRecordActivitiesRelations;

export const leadContactsRelations = relations(leadContacts, ({ one }) => ({
  tenant: one(tenants, {
    fields: [leadContacts.tenantId],
    references: [tenants.id],
  }),
  lead: one(leads, {
    fields: [leadContacts.leadId],
    references: [leads.id],
  }),
}));

export const leadRelatedRecordsRelations = relations(leadRelatedRecords, ({ one }) => ({
  tenant: one(tenants, {
    fields: [leadRelatedRecords.tenantId],
    references: [tenants.id],
  }),
  lead: one(leads, {
    fields: [leadRelatedRecords.leadId],
    references: [leads.id],
  }),
}));

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [quotes.tenantId],
    references: [tenants.id],
  }),
  lead: one(leads, {
    fields: [quotes.leadId],
    references: [leads.id],
  }),
  customer: one(customers, {
    fields: [quotes.customerId],
    references: [customers.id],
  }),
  createdByUser: one(users, {
    fields: [quotes.createdBy],
    references: [users.id],
  }),
  lineItems: many(quoteLineItems),
}));

export const quoteLineItemsRelations = relations(quoteLineItems, ({ one }) => ({
  tenant: one(tenants, {
    fields: [quoteLineItems.tenantId],
    references: [tenants.id],
  }),
  quote: one(quotes, {
    fields: [quoteLineItems.quoteId],
    references: [quotes.id],
  }),
}));

// Product Management Relations
export const productModelsRelations = relations(productModels, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [productModels.tenantId],
    references: [tenants.id],
  }),
  accessories: many(productAccessories),
  cpcRates: many(cpcRates),
}));

export const productAccessoriesRelations = relations(productAccessories, ({ one }) => ({
  tenant: one(tenants, {
    fields: [productAccessories.tenantId],
    references: [tenants.id],
  }),
  model: one(productModels, {
    fields: [productAccessories.modelId],
    references: [productModels.id],
  }),
}));

export const cpcRatesRelations = relations(cpcRates, ({ one }) => ({
  tenant: one(tenants, {
    fields: [cpcRates.tenantId],
    references: [tenants.id],
  }),
  model: one(productModels, {
    fields: [cpcRates.modelId],
    references: [productModels.id],
  }),
}));

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  teams: many(teams),
  customers: many(customers),
  equipment: many(equipment),
  contracts: many(contracts),
  contractTieredRates: many(contractTieredRates),
  serviceTickets: many(serviceTickets),
  inventoryItems: many(inventoryItems),
  technicians: many(technicians),
  meterReadings: many(meterReadings),
  invoices: many(invoices),
  invoiceLineItems: many(invoiceLineItems),
  leads: many(leads),
  companies: many(companies),
  companyContacts: many(companyContacts),
  quotes: many(quotes),
  userCustomerAssignments: many(userCustomerAssignments),
  productModels: many(productModels),
  productAccessories: many(productAccessories),
  cpcRates: many(cpcRates),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [customers.tenantId],
    references: [tenants.id],
  }),
  equipment: many(equipment),
  contracts: many(contracts),
  serviceTickets: many(serviceTickets),
  userAssignments: many(userCustomerAssignments),
  quotes: many(quotes),
}));

export const equipmentRelations = relations(equipment, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [equipment.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [equipment.customerId],
    references: [customers.id],
  }),
  serviceTickets: many(serviceTickets),
  meterReadings: many(meterReadings),
  invoiceLineItems: many(invoiceLineItems),
}));

export const contractsRelations = relations(contracts, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [contracts.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [contracts.customerId],
    references: [customers.id],
  }),
  assignedSalesperson: one(users, {
    fields: [contracts.assignedSalespersonId],
    references: [users.id],
  }),
  tieredRates: many(contractTieredRates),
  meterReadings: many(meterReadings),
  invoices: many(invoices),
}));

export const contractTieredRatesRelations = relations(contractTieredRates, ({ one }) => ({
  tenant: one(tenants, {
    fields: [contractTieredRates.tenantId],
    references: [tenants.id],
  }),
  contract: one(contracts, {
    fields: [contractTieredRates.contractId],
    references: [contracts.id],
  }),
}));

export const serviceTicketsRelations = relations(serviceTickets, ({ one }) => ({
  tenant: one(tenants, {
    fields: [serviceTickets.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [serviceTickets.customerId],
    references: [customers.id],
  }),
  equipment: one(equipment, {
    fields: [serviceTickets.equipmentId],
    references: [equipment.id],
  }),
  assignedTechnician: one(technicians, {
    fields: [serviceTickets.assignedTechnicianId],
    references: [technicians.id],
  }),
  createdByUser: one(users, {
    fields: [serviceTickets.createdBy],
    references: [users.id],
  }),
}));

export const inventoryItemsRelations = relations(inventoryItems, ({ one }) => ({
  tenant: one(tenants, {
    fields: [inventoryItems.tenantId],
    references: [tenants.id],
  }),
}));

export const techniciansRelations = relations(technicians, ({ one }) => ({
  tenant: one(tenants, {
    fields: [technicians.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [technicians.userId],
    references: [users.id],
  }),
}));

export const meterReadingsRelations = relations(meterReadings, ({ one }) => ({
  tenant: one(tenants, {
    fields: [meterReadings.tenantId],
    references: [tenants.id],
  }),
  equipment: one(equipment, {
    fields: [meterReadings.equipmentId],
    references: [equipment.id],
  }),
  contract: one(contracts, {
    fields: [meterReadings.contractId],
    references: [contracts.id],
  }),
  createdByUser: one(users, {
    fields: [meterReadings.createdBy],
    references: [users.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [invoices.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [invoices.customerId],
    references: [customers.id],
  }),
  contract: one(contracts, {
    fields: [invoices.contractId],
    references: [contracts.id],
  }),
  createdByUser: one(users, {
    fields: [invoices.createdBy],
    references: [users.id],
  }),
  lineItems: many(invoiceLineItems),
}));

export const invoiceLineItemsRelations = relations(invoiceLineItems, ({ one }) => ({
  tenant: one(tenants, {
    fields: [invoiceLineItems.tenantId],
    references: [tenants.id],
  }),
  invoice: one(invoices, {
    fields: [invoiceLineItems.invoiceId],
    references: [invoices.id],
  }),
  equipment: one(equipment, {
    fields: [invoiceLineItems.equipmentId],
    references: [equipment.id],
  }),
  meterReading: one(meterReadings, {
    fields: [invoiceLineItems.meterReadingId],
    references: [meterReadings.id],
  }),
}));

// Deal relations
export const dealStagesRelations = relations(dealStages, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [dealStages.tenantId],
    references: [tenants.id],
  }),
  deals: many(deals),
}));

export const dealsRelations = relations(deals, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [deals.tenantId],
    references: [tenants.id],
  }),
  stage: one(dealStages, {
    fields: [deals.stageId],
    references: [dealStages.id],
  }),
  owner: one(users, {
    fields: [deals.ownerId],
    references: [users.id],
  }),
  customer: one(customers, {
    fields: [deals.customerId],
    references: [customers.id],
  }),
  createdBy: one(users, {
    fields: [deals.createdById],
    references: [users.id],
  }),
  activities: many(dealActivities),
}));

export const dealActivitiesRelations = relations(dealActivities, ({ one }) => ({
  tenant: one(tenants, {
    fields: [dealActivities.tenantId],
    references: [tenants.id],
  }),
  deal: one(deals, {
    fields: [dealActivities.dealId],
    references: [deals.id],
  }),
  user: one(users, {
    fields: [dealActivities.userId],
    references: [users.id],
  }),
}));

// CRM Goal Management Relations
export const salesGoalsRelations = relations(salesGoals, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [salesGoals.tenantId],
    references: [tenants.id],
  }),
  assignedToUser: one(users, {
    fields: [salesGoals.assignedToUserId],
    references: [users.id],
  }),
  assignedToTeam: one(salesTeams, {
    fields: [salesGoals.assignedToTeamId],
    references: [salesTeams.id],
  }),
  assignedByUser: one(users, {
    fields: [salesGoals.assignedBy],
    references: [users.id],
  }),
  goalProgress: many(goalProgress),
}));

export const salesTeamsRelations = relations(salesTeams, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [salesTeams.tenantId],
    references: [tenants.id],
  }),
  parentTeam: one(salesTeams, {
    fields: [salesTeams.parentTeamId],
    references: [salesTeams.id],
  }),
  childTeams: many(salesTeams),
  manager: one(users, {
    fields: [salesTeams.managerId],
    references: [users.id],
  }),
  teamMembers: many(salesTeamMembers),
  goals: many(salesGoals),
  activityReports: many(activityReports),
}));

export const salesTeamMembersRelations = relations(salesTeamMembers, ({ one }) => ({
  tenant: one(tenants, {
    fields: [salesTeamMembers.tenantId],
    references: [tenants.id],
  }),
  team: one(salesTeams, {
    fields: [salesTeamMembers.teamId],
    references: [salesTeams.id],
  }),
  user: one(users, {
    fields: [salesTeamMembers.userId],
    references: [users.id],
  }),
}));

export const activityReportsRelations = relations(activityReports, ({ one }) => ({
  tenant: one(tenants, {
    fields: [activityReports.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [activityReports.userId],
    references: [users.id],
  }),
  team: one(salesTeams, {
    fields: [activityReports.teamId],
    references: [salesTeams.id],
  }),
}));

export const goalProgressRelations = relations(goalProgress, ({ one }) => ({
  tenant: one(tenants, {
    fields: [goalProgress.tenantId],
    references: [tenants.id],
  }),
  goal: one(salesGoals, {
    fields: [goalProgress.goalId],
    references: [salesGoals.id],
  }),
}));

// Sales Analytics Relations
export const salesMetricsRelations = relations(salesMetrics, ({ one }) => ({
  tenant: one(tenants, {
    fields: [salesMetrics.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [salesMetrics.userId],
    references: [users.id],
  }),
  team: one(salesTeams, {
    fields: [salesMetrics.teamId],
    references: [salesTeams.id],
  }),
}));

export const conversionFunnelRelations = relations(conversionFunnel, ({ one }) => ({
  tenant: one(tenants, {
    fields: [conversionFunnel.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [conversionFunnel.userId],
    references: [users.id],
  }),
  team: one(salesTeams, {
    fields: [conversionFunnel.teamId],
    references: [salesTeams.id],
  }),
}));

export const managerInsightsRelations = relations(managerInsights, ({ one }) => ({
  tenant: one(tenants, {
    fields: [managerInsights.tenantId],
    references: [tenants.id],
  }),
  manager: one(users, {
    fields: [managerInsights.managerId],
    references: [users.id],
  }),
  user: one(users, {
    fields: [managerInsights.userId],
    references: [users.id],
  }),
  team: one(salesTeams, {
    fields: [managerInsights.teamId],
    references: [salesTeams.id],
  }),
}));

// Type exports
export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;
export type CompanyContact = typeof companyContacts.$inferSelect;
export type InsertCompanyContact = typeof companyContacts.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;
export type Deal = typeof deals.$inferSelect;
export type InsertDeal = typeof deals.$inferInsert;
export type DealStage = typeof dealStages.$inferSelect;
export type InsertDealStage = typeof dealStages.$inferInsert;
export type DealActivity = typeof dealActivities.$inferSelect;
export type InsertDealActivity = typeof dealActivities.$inferInsert;
// Moved to main type exports section to avoid duplicates

// CRM Goal Management Types
export type SalesGoal = typeof salesGoals.$inferSelect;
export type InsertSalesGoal = typeof salesGoals.$inferInsert;
export type SalesTeam = typeof salesTeams.$inferSelect;
export type InsertSalesTeam = typeof salesTeams.$inferInsert;
export type SalesTeamMember = typeof salesTeamMembers.$inferSelect;
export type InsertSalesTeamMember = typeof salesTeamMembers.$inferInsert;
export type ActivityReport = typeof activityReports.$inferSelect;
export type InsertActivityReport = typeof activityReports.$inferInsert;
export type GoalProgress = typeof goalProgress.$inferSelect;
export type InsertGoalProgress = typeof goalProgress.$inferInsert;

// Analytics Types
export type SalesMetrics = typeof salesMetrics.$inferSelect;
export type InsertSalesMetrics = typeof salesMetrics.$inferInsert;
export type ConversionFunnel = typeof conversionFunnel.$inferSelect;
export type InsertConversionFunnel = typeof conversionFunnel.$inferInsert;
export type ManagerInsight = typeof managerInsights.$inferSelect;
export type InsertManagerInsight = typeof managerInsights.$inferInsert;

// Customer Number Configuration Types
export type CustomerNumberConfig = typeof customerNumberConfig.$inferSelect;
export type InsertCustomerNumberConfig = typeof customerNumberConfig.$inferInsert;
export type CustomerNumberHistory = typeof customerNumberHistory.$inferSelect;
export type InsertCustomerNumberHistory = typeof customerNumberHistory.$inferInsert;

// CRM Goal Management Zod Schemas
export const insertSalesGoalSchema = createInsertSchema(salesGoals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSalesTeamSchema = createInsertSchema(salesTeams).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSalesTeamMemberSchema = createInsertSchema(salesTeamMembers).omit({
  id: true,
  createdAt: true,
});

export const insertActivityReportSchema = createInsertSchema(activityReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGoalProgressSchema = createInsertSchema(goalProgress).omit({
  id: true,
  createdAt: true,
});

// Analytics Zod Schemas
export const insertSalesMetricsSchema = createInsertSchema(salesMetrics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConversionFunnelSchema = createInsertSchema(conversionFunnel).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertManagerInsightsSchema = createInsertSchema(managerInsights).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Customer Number Configuration Schemas
export const insertCustomerNumberConfigSchema = createInsertSchema(customerNumberConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCustomerNumberHistorySchema = createInsertSchema(customerNumberHistory).omit({
  id: true,
  generatedAt: true,
});

// Legacy types for backward compatibility - moved to main exports

// Insert schemas for forms
export const insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
  createdAt: true,
});

export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserCustomerAssignmentSchema = createInsertSchema(userCustomerAssignments).omit({
  id: true,
  createdAt: true,
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCompanyContactSchema = createInsertSchema(companyContacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeadActivitySchema = createInsertSchema(leadActivities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeadContactSchema = createInsertSchema(leadContacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeadRelatedRecordSchema = createInsertSchema(leadRelatedRecords).omit({
  id: true,
  createdAt: true,
});

export const insertQuoteSchema = createInsertSchema(quotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertQuoteLineItemSchema = createInsertSchema(quoteLineItems).omit({
  id: true,
  createdAt: true,
});

export const insertTenantSchema = createInsertSchema(tenants).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEquipmentSchema = createInsertSchema(equipment).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContractSchema = createInsertSchema(contracts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContractTieredRateSchema = createInsertSchema(contractTieredRates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertServiceTicketSchema = createInsertSchema(serviceTickets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInventoryItemSchema = createInsertSchema(inventoryItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTechnicianSchema = createInsertSchema(technicians).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMeterReadingSchema = createInsertSchema(meterReadings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInvoiceLineItemSchema = createInsertSchema(invoiceLineItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Backward compatibility alias for existing client code
export const insertCustomerInteractionSchema = insertLeadActivitySchema;

export const insertDealSchema = createInsertSchema(deals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDealStageSchema = createInsertSchema(dealStages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDealActivitySchema = createInsertSchema(dealActivities).omit({
  id: true,
  createdAt: true,
});

// Additional Type exports
export type UpsertUser = typeof users.$inferInsert;
export type InsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Role = typeof roles.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type UserCustomerAssignment = typeof userCustomerAssignments.$inferSelect;
export type LeadActivity = typeof leadActivities.$inferSelect;
export type LeadContact = typeof leadContacts.$inferSelect;
export type LeadRelatedRecord = typeof leadRelatedRecords.$inferSelect;
export type Quote = typeof quotes.$inferSelect;
export type QuoteLineItem = typeof quoteLineItems.$inferSelect;
export type Equipment = typeof equipment.$inferSelect;
export type Contract = typeof contracts.$inferSelect;
export type ContractTieredRate = typeof contractTieredRates.$inferSelect;
export type InsertContractTieredRate = typeof contractTieredRates.$inferInsert;
export type ServiceTicket = typeof serviceTickets.$inferSelect;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type Technician = typeof technicians.$inferSelect;
export type MeterReading = typeof meterReadings.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

// Backward compatibility type aliases
export type LeadInteraction = LeadActivity;
export type CustomerInteraction = LeadActivity;

// Product Management Insert Schemas
export const insertProductModelSchema = createInsertSchema(productModels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductAccessorySchema = createInsertSchema(productAccessories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCpcRateSchema = createInsertSchema(cpcRates).omit({
  id: true,
  createdAt: true,
});

// Professional Services
export const professionalServices = pgTable("professional_services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  productCode: varchar("product_code").notNull(),
  productName: varchar("product_name").notNull(),
  category: varchar("category").default("Professional Services"),
  accessoryType: varchar("accessory_type"),
  description: text("description"),
  summary: text("summary"),
  note: text("note"),
  eaNotes: text("ea_notes"),
  relatedProducts: text("related_products"),
  
  // Flags
  isActive: boolean("is_active").default(true),
  availableForAll: boolean("available_for_all").default(false),
  repostEdit: boolean("repost_edit").default(false),
  salesRepCredit: boolean("sales_rep_credit").default(true),
  funding: boolean("funding").default(true),
  
  // Pricing Information
  lease: boolean("lease").default(false),
  paymentType: varchar("payment_type"),
  msrp: decimal("msrp"),
  
  // Pricing Tiers
  newActive: boolean("new_active").default(false),
  newRepPrice: decimal("new_rep_price"),
  upgradeActive: boolean("upgrade_active").default(false),
  upgradeRepPrice: decimal("upgrade_rep_price"),
  lexmarkActive: boolean("lexmark_active").default(false),
  lexmarkRepPrice: decimal("lexmark_rep_price"),
  graphicActive: boolean("graphic_active").default(false),
  graphicRepPrice: decimal("graphic_rep_price"),
  
  // Product Tags
  manufacturer: varchar("manufacturer"),
  manufacturerProductCode: varchar("manufacturer_product_code"),
  model: varchar("model"),
  units: varchar("units"),
  environment: varchar("environment"),
  colorMode: varchar("color_mode"),
  eaItemNumber: varchar("ea_item_number"),
  
  // System Information
  priceBookId: varchar("price_book_id"),
  tempKey: varchar("temp_key"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProfessionalServiceSchema = createInsertSchema(professionalServices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Service Products
export const serviceProducts = pgTable("service_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  productCode: varchar("product_code").notNull(),
  productName: varchar("product_name").notNull(),
  category: varchar("category").default("Service"),
  serviceType: varchar("service_type"),
  pricingLevel: varchar("pricing_level"),
  description: text("description"),
  summary: text("summary"),
  note: text("note"),
  eaNotes: text("ea_notes"),
  relatedProducts: text("related_products"),
  
  // Flags
  isActive: boolean("is_active").default(true),
  availableForAll: boolean("available_for_all").default(false),
  repostEdit: boolean("repost_edit").default(false),
  salesRepCredit: boolean("sales_rep_credit").default(true),
  funding: boolean("funding").default(true),
  
  // Pricing Information
  lease: boolean("lease").default(false),
  paymentType: varchar("payment_type"),
  
  // Pricing Tiers
  newActive: boolean("new_active").default(false),
  newRepPrice: decimal("new_rep_price"),
  upgradeActive: boolean("upgrade_active").default(false),
  upgradeRepPrice: decimal("upgrade_rep_price"),
  lexmarkActive: boolean("lexmark_active").default(false),
  lexmarkRepPrice: decimal("lexmark_rep_price"),
  graphicActive: boolean("graphic_active").default(false),
  graphicRepPrice: decimal("graphic_rep_price"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type ServiceProduct = typeof serviceProducts.$inferSelect;
export type InsertServiceProduct = typeof serviceProducts.$inferInsert;

export const insertServiceProductSchema = createInsertSchema(serviceProducts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Software Products
export const softwareProducts = pgTable("software_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  productCode: varchar("product_code").notNull(),
  productName: varchar("product_name").notNull(),
  productType: varchar("product_type"),
  category: varchar("category"),
  accessoryType: varchar("accessory_type"),
  description: text("description"),
  summary: text("summary"),
  note: text("note"),
  eaNotes: text("ea_notes"),
  configNote: text("config_note"),
  relatedProducts: text("related_products"),
  
  // Flags
  isActive: boolean("is_active").default(true),
  availableForAll: boolean("available_for_all").default(false),
  repostEdit: boolean("repost_edit").default(false),
  salesRepCredit: boolean("sales_rep_credit").default(true),
  funding: boolean("funding").default(true),
  
  // Pricing Information
  lease: boolean("lease").default(false),
  paymentType: varchar("payment_type"),
  
  // Standard Pricing
  standardActive: boolean("standard_active").default(false),
  standardCost: decimal("standard_cost"),
  standardRepPrice: decimal("standard_rep_price"),
  
  // New Pricing
  newActive: boolean("new_active").default(false),
  newCost: decimal("new_cost"),
  newRepPrice: decimal("new_rep_price"),
  
  // Upgrade Pricing
  upgradeActive: boolean("upgrade_active").default(false),
  upgradeCost: decimal("upgrade_cost"),
  upgradeRepPrice: decimal("upgrade_rep_price"),
  
  // System Information
  priceBookId: varchar("price_book_id"),
  tempKey: varchar("temp_key"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type SoftwareProduct = typeof softwareProducts.$inferSelect;
export type InsertSoftwareProduct = typeof softwareProducts.$inferInsert;

export const insertSoftwareProductSchema = createInsertSchema(softwareProducts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Supplies
export const supplies = pgTable("supplies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  productCode: varchar("product_code").notNull(),
  productName: varchar("product_name").notNull(),
  productType: varchar("product_type").default("Supplies"),
  dealerComp: varchar("dealer_comp"),
  inventory: varchar("inventory"),
  inStock: varchar("in_stock"),
  summary: text("summary"),
  note: text("note"),
  eaNotes: text("ea_notes"),
  relatedProducts: text("related_products"),
  
  // Flags
  isActive: boolean("is_active").default(true),
  availableForAll: boolean("available_for_all").default(false),
  repostEdit: boolean("repost_edit").default(false),
  salesRepCredit: boolean("sales_rep_credit").default(true),
  funding: boolean("funding").default(true),
  
  // Pricing Information
  lease: boolean("lease").default(false),
  paymentType: varchar("payment_type"),
  
  // Pricing Tiers
  newActive: boolean("new_active").default(false),
  newRepPrice: decimal("new_rep_price"),
  upgradeActive: boolean("upgrade_active").default(false),
  upgradeRepPrice: decimal("upgrade_rep_price"),
  lexmarkActive: boolean("lexmark_active").default(false),
  lexmarkRepPrice: decimal("lexmark_rep_price"),
  graphicActive: boolean("graphic_active").default(false),
  graphicRepPrice: decimal("graphic_rep_price"),
  
  // System Information
  priceBookId: varchar("price_book_id"),
  tempKey: varchar("temp_key"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Supply = typeof supplies.$inferSelect;
export type InsertSupply = typeof supplies.$inferInsert;

export const insertSupplySchema = createInsertSchema(supplies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// IT/Managed Services
export const managedServices = pgTable("managed_services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  productCode: varchar("product_code").notNull(),
  productName: varchar("product_name").notNull(),
  category: varchar("category").default("IT Services"),
  serviceType: varchar("service_type"),
  serviceLevel: varchar("service_level"),
  description: text("description"),
  summary: text("summary"),
  note: text("note"),
  eaNotes: text("ea_notes"),
  configNote: text("config_note"),
  relatedProducts: text("related_products"),
  
  // IT-specific fields
  supportHours: varchar("support_hours"),
  responseTime: varchar("response_time"),
  includesHardware: boolean("includes_hardware").default(false),
  remoteMgmt: boolean("remote_mgmt").default(false),
  onsiteSupport: boolean("onsite_support").default(false),
  
  // Flags
  isActive: boolean("is_active").default(true),
  availableForAll: boolean("available_for_all").default(false),
  repostEdit: boolean("repost_edit").default(false),
  salesRepCredit: boolean("sales_rep_credit").default(true),
  funding: boolean("funding").default(true),
  
  // Pricing Information
  lease: boolean("lease").default(false),
  paymentType: varchar("payment_type"),
  
  // Pricing Tiers
  newActive: boolean("new_active").default(false),
  newRepPrice: decimal("new_rep_price"),
  upgradeActive: boolean("upgrade_active").default(false),
  upgradeRepPrice: decimal("upgrade_rep_price"),
  lexmarkActive: boolean("lexmark_active").default(false),
  lexmarkRepPrice: decimal("lexmark_rep_price"),
  graphicActive: boolean("graphic_active").default(false),
  graphicRepPrice: decimal("graphic_rep_price"),
  
  // System Information
  priceBookId: varchar("price_book_id"),
  tempKey: varchar("temp_key"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type ManagedService = typeof managedServices.$inferSelect;
export type InsertManagedService = typeof managedServices.$inferInsert;

export const insertManagedServiceSchema = createInsertSchema(managedServices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// =====================================================================
// ENHANCED SALESFORCE INTEGRATION RELATIONS
// =====================================================================

// Enhanced Contacts Relations (Salesforce-style)
export const enhancedContactsRelations = relations(enhancedContacts, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [enhancedContacts.tenantId],
    references: [tenants.id],
  }),
  company: one(businessRecords, {
    fields: [enhancedContacts.companyId],
    references: [businessRecords.id],
    relationName: "companyContacts"
  }),
  reportsToContact: one(enhancedContacts, {
    fields: [enhancedContacts.reportsToContactId],
    references: [enhancedContacts.id],
    relationName: "contactHierarchy"
  }),
  directReports: many(enhancedContacts, {
    relationName: "contactHierarchy"
  }),
  owner: one(users, {
    fields: [enhancedContacts.ownerId],
    references: [users.id],
  }),
}));

// Opportunities Relations (Salesforce-style)
export const opportunitiesRelations = relations(opportunities, ({ one }) => ({
  tenant: one(tenants, {
    fields: [opportunities.tenantId],
    references: [tenants.id],
  }),
  account: one(businessRecords, {
    fields: [opportunities.accountId],
    references: [businessRecords.id],
    relationName: "accountOpportunities"
  }),
  owner: one(users, {
    fields: [opportunities.ownerId],
    references: [users.id],
  }),
}));

// Enhanced Products Relations (Salesforce-compatible)
export const enhancedProductsRelations = relations(enhancedProducts, ({ one }) => ({
  tenant: one(tenants, {
    fields: [enhancedProducts.tenantId],
    references: [tenants.id],
  }),
}));

// =====================================================================
// ENHANCED TYPE EXPORTS FOR SALESFORCE INTEGRATION
// =====================================================================

// Enhanced Salesforce-compatible types
export type BusinessRecord = typeof businessRecords.$inferSelect;
export type InsertBusinessRecord = typeof businessRecords.$inferInsert;
export type EnhancedContact = typeof enhancedContacts.$inferSelect;
export type InsertEnhancedContact = typeof enhancedContacts.$inferInsert;
export type Opportunity = typeof opportunities.$inferSelect;
export type InsertOpportunity = typeof opportunities.$inferInsert;
export type EnhancedProduct = typeof enhancedProducts.$inferSelect;
export type InsertEnhancedProduct = typeof enhancedProducts.$inferInsert;

// Enhanced Salesforce-compatible insert schemas
export const insertBusinessRecordSchema = createInsertSchema(businessRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEnhancedContactSchema = createInsertSchema(enhancedContacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOpportunitySchema = createInsertSchema(opportunities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEnhancedProductSchema = createInsertSchema(enhancedProducts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// =====================================================================
// UNIFIED DATA ENRICHMENT TABLES
// =====================================================================

// Enriched Contacts - Unified table for ZoomInfo and Apollo.io contact data
export const enrichedContacts = pgTable("enriched_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // External System IDs
  zoominfo_contact_id: varchar("zoominfo_contact_id"),
  apollo_contact_id: varchar("apollo_contact_id"),
  
  // Core Identity
  first_name: varchar("first_name").notNull(),
  last_name: varchar("last_name").notNull(),
  full_name: varchar("full_name"),
  email: varchar("email"),
  direct_phone: varchar("direct_phone"),
  mobile_phone: varchar("mobile_phone"),
  
  // Professional Information
  job_title: varchar("job_title"),
  management_level: varchar("management_level"), // C-Level, VP, Director, Manager, Individual Contributor
  department: varchar("department"),
  sub_department: varchar("sub_department"),
  job_function: varchar("job_function"),
  
  // Company Context
  company_external_id: varchar("company_external_id"),
  company_name: varchar("company_name"),
  company_domain: varchar("company_domain"),
  
  // Location Information
  city: varchar("city"),
  state: varchar("state"),
  country: varchar("country"),
  zip_code: varchar("zip_code"),
  time_zone: varchar("time_zone"),
  
  // Social Media & Professional Networks
  linkedin_url: varchar("linkedin_url"),
  twitter_url: varchar("twitter_url"),
  facebook_url: varchar("facebook_url"),
  
  // Enrichment Quality & Metadata
  person_score: integer("person_score"),
  is_verified: boolean("is_verified").default(false),
  email_verification_status: varchar("email_verification_status"), // verified, unverified, bounced
  
  // Professional History (JSON fields)
  work_history: jsonb("work_history"),
  education_history: jsonb("education_history"),
  skills: jsonb("skills"),
  
  // Prospecting Status
  prospecting_status: varchar("prospecting_status").default('new'), // new, contacted, qualified, opportunity, closed
  lead_score: integer("lead_score"),
  priority_level: varchar("priority_level").default('medium'), // high, medium, low
  
  // Data Source Tracking
  enrichment_source: varchar("enrichment_source"), // zoominfo, apollo, manual
  last_enriched_date: timestamp("last_enriched_date"),
  
  // Audit Trail
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Enriched Companies - Unified table for ZoomInfo and Apollo.io company data
export const enrichedCompanies = pgTable("enriched_companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // External System IDs
  zoominfo_company_id: varchar("zoominfo_company_id"),
  apollo_company_id: varchar("apollo_company_id"),
  
  // Core Identity
  company_name: varchar("company_name").notNull(),
  website: varchar("website"),
  primary_domain: varchar("primary_domain"),
  main_phone: varchar("main_phone"),
  
  // Business Information
  primary_industry: varchar("primary_industry"),
  sub_industry: varchar("sub_industry"),
  employee_count: integer("employee_count"),
  employee_range: varchar("employee_range"),
  annual_revenue: decimal("annual_revenue"),
  revenue_range: varchar("revenue_range"),
  founded_year: integer("founded_year"),
  company_type: varchar("company_type"), // Public, Private, Non-Profit, Government
  stock_ticker: varchar("stock_ticker"),
  
  // Location Information (Headquarters)
  street_address: varchar("street_address"),
  city: varchar("city"),
  state: varchar("state"),
  zip_code: varchar("zip_code"),
  country: varchar("country"),
  
  // Corporate Structure
  parent_company_id: varchar("parent_company_id"),
  parent_company_name: varchar("parent_company_name"),
  
  // Technology & Business Intelligence
  technologies: jsonb("technologies"),
  departments: jsonb("departments"),
  key_executives: jsonb("key_executives"),
  business_keywords: jsonb("business_keywords"),
  
  // Funding Information (Apollo)
  total_funding: decimal("total_funding"),
  funding_stage: varchar("funding_stage"),
  last_funding_date: timestamp("last_funding_date"),
  
  // Account Intelligence
  company_score: integer("company_score"),
  target_account_tier: varchar("target_account_tier"), // enterprise, mid_market, smb
  account_priority: varchar("account_priority").default('medium'), // high, medium, low
  
  // Data Source Tracking
  enrichment_source: varchar("enrichment_source"), // zoominfo, apollo, manual
  last_enriched_date: timestamp("last_enriched_date"),
  
  // Audit Trail
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Intent Data - Buying signals and research activity
export const enrichedIntentData = pgTable("enriched_intent_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Company Association
  company_external_id: varchar("company_external_id").notNull(),
  company_name: varchar("company_name"),
  
  // Intent Intelligence
  intent_topic: varchar("intent_topic"),
  topic_category: varchar("topic_category"),
  intent_score: integer("intent_score"),
  intent_level: varchar("intent_level"), // High, Medium, Low
  buying_stage: varchar("buying_stage"), // Awareness, Consideration, Decision, Purchase
  decision_timeframe: varchar("decision_timeframe"), // Immediate, 1-3 months, 3-6 months, 6+ months
  
  // Activity Tracking
  is_trending: boolean("is_trending").default(false),
  first_seen_date: timestamp("first_seen_date"),
  last_activity_date: timestamp("last_activity_date"),
  days_active: integer("days_active"),
  
  // Research Context
  intent_keywords: jsonb("intent_keywords"),
  research_areas: jsonb("research_areas"),
  competitor_activity: jsonb("competitor_activity"),
  
  // Sales Intelligence
  sales_opportunity_score: integer("sales_opportunity_score"),
  recommended_actions: jsonb("recommended_actions"),
  optimal_timing_window: varchar("optimal_timing_window"),
  
  // Data Source
  data_source: varchar("data_source").default('zoominfo'), // zoominfo, apollo, internal
  
  // Audit Trail
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Organizational Hierarchy - Decision maker mapping and influence analysis
export const enrichedOrgHierarchy = pgTable("enriched_org_hierarchy", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Person & Company Association
  company_external_id: varchar("company_external_id").notNull(),
  person_external_id: varchar("person_external_id").notNull(),
  
  // Hierarchy Structure
  manager_person_id: varchar("manager_person_id"),
  department_name: varchar("department_name"),
  organizational_level: integer("organizational_level"),
  team_size: integer("team_size"),
  direct_reports_count: integer("direct_reports_count"),
  
  // Decision Making Power
  decision_making_power: varchar("decision_making_power"), // High, Medium, Low
  has_budget_authority: boolean("has_budget_authority").default(false),
  procurement_influence_level: varchar("procurement_influence_level"),
  
  // Influence Metrics
  influence_score: integer("influence_score"),
  accessibility_score: integer("accessibility_score"),
  
  // Relationship Mapping
  hierarchy_path: jsonb("hierarchy_path"),
  peer_contacts: jsonb("peer_contacts"),
  subordinate_contacts: jsonb("subordinate_contacts"),
  
  // Data Source
  data_source: varchar("data_source").default('zoominfo'),
  
  // Audit Trail
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Enrichment Activities - Track all enrichment activities and prospecting actions
export const enrichmentActivities = pgTable("enrichment_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Target Association
  contact_id: varchar("contact_id"), // enriched_contacts.id
  company_id: varchar("company_id"), // enriched_companies.id
  
  // Activity Details
  activity_type: varchar("activity_type").notNull(), // enrichment, outreach, qualification, meeting
  activity_subtype: varchar("activity_subtype"), // email, call, linkedin, research
  activity_description: text("activity_description"),
  
  // Activity Outcome
  outcome: varchar("outcome"), // successful, failed, no_response, interested, not_qualified
  outcome_details: text("outcome_details"),
  
  // Prospecting Context
  campaign_name: varchar("campaign_name"),
  sequence_step: integer("sequence_step"),
  follow_up_required: boolean("follow_up_required").default(false),
  next_action_date: timestamp("next_action_date"),
  next_action_type: varchar("next_action_type"),
  
  // Performance Tracking
  response_time_hours: integer("response_time_hours"),
  engagement_score: integer("engagement_score"),
  lead_quality_score: integer("lead_quality_score"),
  
  // User & Assignment
  assigned_user_id: varchar("assigned_user_id"),
  completed_by_user_id: varchar("completed_by_user_id"),
  
  // Audit Trail
  scheduled_date: timestamp("scheduled_date"),
  completed_date: timestamp("completed_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Prospecting Campaigns - Organize outreach efforts and track performance
export const prospectingCampaigns = pgTable("prospecting_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Campaign Details
  campaign_name: varchar("campaign_name").notNull(),
  campaign_description: text("campaign_description"),
  campaign_type: varchar("campaign_type"), // email_sequence, call_campaign, linkedin_outreach, multi_channel
  
  // Targeting Criteria
  target_industries: jsonb("target_industries"),
  target_company_sizes: jsonb("target_company_sizes"),
  target_job_titles: jsonb("target_job_titles"),
  target_management_levels: jsonb("target_management_levels"),
  target_technologies: jsonb("target_technologies"),
  
  // Campaign Configuration
  sequence_steps: jsonb("sequence_steps"),
  follow_up_cadence: jsonb("follow_up_cadence"),
  personalization_rules: jsonb("personalization_rules"),
  
  // Performance Metrics
  total_contacts: integer("total_contacts").default(0),
  contacts_reached: integer("contacts_reached").default(0),
  responses_received: integer("responses_received").default(0),
  meetings_booked: integer("meetings_booked").default(0),
  opportunities_created: integer("opportunities_created").default(0),
  
  // Calculated Rates
  response_rate: decimal("response_rate"),
  meeting_rate: decimal("meeting_rate"),
  opportunity_rate: decimal("opportunity_rate"),
  
  // Campaign Status
  status: varchar("status").default('draft'), // draft, active, paused, completed, archived
  start_date: timestamp("start_date"),
  end_date: timestamp("end_date"),
  
  // Team Assignment
  campaign_owner_id: varchar("campaign_owner_id"),
  team_members: jsonb("team_members"),
  
  // Audit Trail
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Type exports for enrichment tables
export type EnrichedContact = typeof enrichedContacts.$inferSelect;
export type InsertEnrichedContact = typeof enrichedContacts.$inferInsert;
export type EnrichedCompany = typeof enrichedCompanies.$inferSelect;
export type InsertEnrichedCompany = typeof enrichedCompanies.$inferInsert;
export type EnrichedIntentData = typeof enrichedIntentData.$inferSelect;
export type InsertEnrichedIntentData = typeof enrichedIntentData.$inferInsert;
export type EnrichedOrgHierarchy = typeof enrichedOrgHierarchy.$inferSelect;
export type InsertEnrichedOrgHierarchy = typeof enrichedOrgHierarchy.$inferInsert;
export type EnrichmentActivity = typeof enrichmentActivities.$inferSelect;
export type InsertEnrichmentActivity = typeof enrichmentActivities.$inferInsert;
export type ProspectingCampaign = typeof prospectingCampaigns.$inferSelect;
export type InsertProspectingCampaign = typeof prospectingCampaigns.$inferInsert;

// Zod schemas for enrichment tables
export const insertEnrichedContactSchema = createInsertSchema(enrichedContacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEnrichedCompanySchema = createInsertSchema(enrichedCompanies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEnrichedIntentDataSchema = createInsertSchema(enrichedIntentData).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEnrichedOrgHierarchySchema = createInsertSchema(enrichedOrgHierarchy).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEnrichmentActivitySchema = createInsertSchema(enrichmentActivities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProspectingCampaignSchema = createInsertSchema(prospectingCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// =====================================================================
// ENRICHMENT RELATIONS
// =====================================================================

// Enriched Contacts Relations
export const enrichedContactsRelations = relations(enrichedContacts, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [enrichedContacts.tenantId],
    references: [tenants.id],
  }),
  company: one(enrichedCompanies, {
    fields: [enrichedContacts.company_external_id],
    references: [enrichedCompanies.id],
    relationName: "contactCompany"
  }),
  activities: many(enrichmentActivities, {
    relationName: "contactActivities"
  }),
  hierarchyData: one(enrichedOrgHierarchy, {
    fields: [enrichedContacts.zoominfo_contact_id],
    references: [enrichedOrgHierarchy.person_external_id],
    relationName: "contactHierarchy"
  }),
}));

// Enriched Companies Relations
export const enrichedCompaniesRelations = relations(enrichedCompanies, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [enrichedCompanies.tenantId],
    references: [tenants.id],
  }),
  contacts: many(enrichedContacts, {
    relationName: "contactCompany"
  }),
  activities: many(enrichmentActivities, {
    relationName: "companyActivities"
  }),
  intentData: many(enrichedIntentData, {
    relationName: "companyIntent"
  }),
  orgHierarchy: many(enrichedOrgHierarchy, {
    relationName: "companyHierarchy"
  }),
}));

// Enriched Intent Data Relations
export const enrichedIntentDataRelations = relations(enrichedIntentData, ({ one }) => ({
  tenant: one(tenants, {
    fields: [enrichedIntentData.tenantId],
    references: [tenants.id],
  }),
  company: one(enrichedCompanies, {
    fields: [enrichedIntentData.company_external_id],
    references: [enrichedCompanies.id],
    relationName: "companyIntent"
  }),
}));

// Enriched Org Hierarchy Relations
export const enrichedOrgHierarchyRelations = relations(enrichedOrgHierarchy, ({ one }) => ({
  tenant: one(tenants, {
    fields: [enrichedOrgHierarchy.tenantId],
    references: [tenants.id],
  }),
  company: one(enrichedCompanies, {
    fields: [enrichedOrgHierarchy.company_external_id],
    references: [enrichedCompanies.id],
    relationName: "companyHierarchy"
  }),
  contact: one(enrichedContacts, {
    fields: [enrichedOrgHierarchy.person_external_id],
    references: [enrichedContacts.zoominfo_contact_id],
    relationName: "contactHierarchy"
  }),
}));

// Enrichment Activities Relations
export const enrichmentActivitiesRelations = relations(enrichmentActivities, ({ one }) => ({
  tenant: one(tenants, {
    fields: [enrichmentActivities.tenantId],
    references: [tenants.id],
  }),
  contact: one(enrichedContacts, {
    fields: [enrichmentActivities.contact_id],
    references: [enrichedContacts.id],
    relationName: "contactActivities"
  }),
  company: one(enrichedCompanies, {
    fields: [enrichmentActivities.company_id],
    references: [enrichedCompanies.id],
    relationName: "companyActivities"
  }),
  assignedUser: one(users, {
    fields: [enrichmentActivities.assigned_user_id],
    references: [users.id],
    relationName: "assignedActivities"
  }),
  completedByUser: one(users, {
    fields: [enrichmentActivities.completed_by_user_id],
    references: [users.id],
    relationName: "completedActivities"
  }),
}));

// Prospecting Campaigns Relations
export const prospectingCampaignsRelations = relations(prospectingCampaigns, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [prospectingCampaigns.tenantId],
    references: [tenants.id],
  }),
  owner: one(users, {
    fields: [prospectingCampaigns.campaign_owner_id],
    references: [users.id],
    relationName: "ownedCampaigns"
  }),
}));

// Re-export equipment lifecycle types
export * from "./equipment-schema";

// ============= TASK MANAGEMENT SYSTEM =============

// Tasks table
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  title: varchar("title").notNull(),
  description: text("description"),
  status: varchar("status").notNull().default("todo"), // todo, in_progress, completed, cancelled
  priority: varchar("priority").notNull().default("medium"), // low, medium, high, urgent
  assignedTo: varchar("assigned_to"), // user id
  projectId: varchar("project_id"),
  customerId: varchar("customer_id"),
  dueDate: timestamp("due_date"),
  estimatedHours: integer("estimated_hours"),
  actualHours: integer("actual_hours"),
  completionPercentage: integer("completion_percentage").default(0),
  tags: text("tags").array(),
  createdBy: varchar("created_by").notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Projects table
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  name: varchar("name").notNull(),
  description: text("description"),
  status: varchar("status").notNull().default("active"), // active, completed, on_hold, cancelled
  customerId: varchar("customer_id"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  estimatedHours: integer("estimated_hours"),
  actualHours: integer("actual_hours"),
  budget: decimal("budget", { precision: 10, scale: 2 }),
  completionPercentage: integer("completion_percentage").default(0),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// System Alerts table
export const systemAlerts = pgTable("system_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  type: varchar("type").notNull(), // info, warning, error, success
  category: varchar("category").notNull(), // system, security, performance, business
  message: text("message").notNull(),
  details: jsonb("details"),
  severity: varchar("severity").default("medium"), // low, medium, high, critical
  source: varchar("source"), // which system component generated the alert
  resolved: boolean("resolved").default(false),
  resolvedBy: varchar("resolved_by"),
  resolvedAt: timestamp("resolved_at"),
  acknowledgedBy: varchar("acknowledged_by"),
  acknowledgedAt: timestamp("acknowledged_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Performance Metrics table
export const performanceMetrics = pgTable("performance_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  metricType: varchar("metric_type").notNull(), // response_time, cpu_usage, memory_usage, disk_usage, throughput
  value: decimal("value", { precision: 10, scale: 4 }).notNull(),
  unit: varchar("unit").notNull(), // ms, %, GB, requests/min
  endpoint: varchar("endpoint"), // for API response times
  timestamp: timestamp("timestamp").defaultNow(),
  metadata: jsonb("metadata"),
});

// System Integrations table
export const systemIntegrations = pgTable("system_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  name: varchar("name").notNull(),
  provider: varchar("provider").notNull(),
  type: varchar("type").notNull(), // oauth, api, webhook
  status: varchar("status").notNull().default("disconnected"), // active, inactive, error, pending
  configuration: jsonb("configuration"), // API keys, endpoints, etc.
  credentials: jsonb("credentials"), // OAuth tokens, API keys, etc.
  lastSync: timestamp("last_sync"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas and types for new tables
export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSystemAlertSchema = createInsertSchema(systemAlerts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPerformanceMetricSchema = createInsertSchema(performanceMetrics).omit({
  id: true,
  timestamp: true,
});

export const insertSystemIntegrationSchema = createInsertSchema(systemIntegrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type SystemAlert = typeof systemAlerts.$inferSelect;
export type InsertSystemAlert = z.infer<typeof insertSystemAlertSchema>;
export type PerformanceMetric = typeof performanceMetrics.$inferSelect;
export type InsertPerformanceMetric = z.infer<typeof insertPerformanceMetricSchema>;
export type SystemIntegration = typeof systemIntegrations.$inferSelect;
export type InsertSystemIntegration = z.infer<typeof insertSystemIntegrationSchema>;

// Product Management Types (consolidated)
export type ProductModel = typeof productModels.$inferSelect;
export type ProductAccessory = typeof productAccessories.$inferSelect;
export type CpcRate = typeof cpcRates.$inferSelect;
export type ProfessionalService = typeof professionalServices.$inferSelect;

// Product Management Insert Types (consolidated)
export type InsertProductModel = z.infer<typeof insertProductModelSchema>;
export type InsertProductAccessory = z.infer<typeof insertProductAccessorySchema>;
export type InsertCpcRate = z.infer<typeof insertCpcRateSchema>;
export type InsertProfessionalService = z.infer<typeof insertProfessionalServiceSchema>;

// ============= QUOTE/PROPOSAL GENERATION SYSTEM =============
// Note: proposals table is defined above with comprehensive fields for quote and proposal management

// Equipment Packages - Pre-configured equipment bundles
export const equipmentPackages = pgTable("equipment_packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Package Details
  packageName: varchar("package_name").notNull(),
  packageCode: varchar("package_code"), // Internal reference
  category: varchar("category"), // office_solution, production_solution, managed_print, etc.
  description: text("description"),
  
  // Package Configuration
  equipment: jsonb("equipment").$type<Array<{
    modelId: string;
    quantity: number;
    unitPrice: number;
    description?: string;
    isOptional?: boolean;
  }>>(),
  
  accessories: jsonb("accessories").$type<Array<{
    accessoryId: string;
    quantity: number;
    unitPrice: number;
    description?: string;
    isOptional?: boolean;
  }>>(),
  
  services: jsonb("services").$type<Array<{
    serviceId: string;
    serviceType: string;
    monthlyPrice: number;
    description?: string;
    isOptional?: boolean;
  }>>(),
  
  // Pricing
  totalValue: decimal("total_value"),
  discountPercentage: decimal("discount_percentage"),
  marginPercentage: decimal("margin_percentage"),
  
  // Package Settings
  isActive: boolean("is_active").default(true),
  allowCustomization: boolean("allow_customization").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Main Proposals Table
export const proposals = pgTable("proposals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Proposal Identification
  proposalNumber: varchar("proposal_number").notNull().unique(),
  version: varchar("version").default("1.0"),
  title: varchar("title").notNull(),
  
  // Customer Information
  businessRecordId: varchar("business_record_id").notNull(),
  contactId: varchar("contact_id"), // Primary contact for this proposal
  
  // Assignment and Ownership
  createdBy: varchar("created_by").notNull(),
  assignedTo: varchar("assigned_to").notNull(),
  teamId: varchar("team_id"), // Sales team responsible
  
  // Proposal Details
  proposalType: varchar("proposal_type").notNull(), // equipment_lease, service_contract, etc.
  description: text("description"),
  
  // Content Sections
  executiveSummary: text("executive_summary"),
  companyIntroduction: text("company_introduction"),
  solutionOverview: text("solution_overview"),
  termsAndConditions: text("terms_and_conditions"),
  investmentSummary: text("investment_summary"),
  nextSteps: text("next_steps"),
  
  // Pricing Information
  subtotal: decimal("subtotal").default("0"),
  discountAmount: decimal("discount_amount").default("0"),
  discountPercentage: decimal("discount_percentage").default("0"),
  taxAmount: decimal("tax_amount").default("0"),
  totalAmount: decimal("total_amount").default("0"),
  
  // Validity and Timeline
  validUntil: timestamp("valid_until"),
  estimatedStartDate: timestamp("estimated_start_date"),
  estimatedEndDate: timestamp("estimated_end_date"),
  
  // Template and Customization
  templateId: varchar("template_id"), // references proposal_templates.id
  customStyling: jsonb("custom_styling").default('{}'), // Company branding, colors, fonts
  
  // Status and Tracking
  status: varchar("status").default("draft"), // draft, sent, viewed, accepted, rejected, expired
  priority: varchar("priority").default("medium"), // low, medium, high, urgent
  
  // Timestamps for status tracking
  sentAt: timestamp("sent_at"),
  viewedAt: timestamp("viewed_at"),
  acceptedAt: timestamp("accepted_at"),
  rejectedAt: timestamp("rejected_at"),
  
  // Analytics and Tracking
  openCount: integer("open_count").default(0),
  lastOpenedAt: timestamp("last_opened_at"),
  
  // Internal Notes and Comments
  internalNotes: text("internal_notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Proposal Line Items - Individual items/services in a proposal
export const proposalLineItems = pgTable("proposal_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  proposalId: varchar("proposal_id").notNull(),
  
  // Line Item Details
  lineNumber: integer("line_number").notNull(),
  itemType: varchar("item_type").notNull(), // equipment, accessory, service, software, supply
  productId: varchar("product_id"), // Reference to product table
  productName: varchar("product_name").notNull(),
  description: text("description"),
  
  // Pricing Details
  quantity: integer("quantity").default(1),
  unitPrice: decimal("unit_price").notNull(),
  unitCost: decimal("unit_cost"), // Internal cost
  totalPrice: decimal("total_price").notNull(),
  
  // Service-specific fields
  serviceFrequency: varchar("service_frequency"), // monthly, quarterly, annually
  serviceDuration: varchar("service_duration"), // Contract duration
  
  // Equipment-specific fields
  equipmentCondition: varchar("equipment_condition"), // new, refurbished, demo
  warrantyInfo: text("warranty_info"),
  
  // Configuration and Options
  isOptional: boolean("is_optional").default(false),
  isAlternative: boolean("is_alternative").default(false),
  packageId: varchar("package_id"), // If part of an equipment package
  
  // Additional Details
  specifications: jsonb("specifications"),
  alternativeOptions: jsonb("alternative_options").$type<{
    productId?: string;
    productName?: string;
    unitPrice?: number;
    description?: string;
  }>(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Proposal Comments and Communication
export const proposalComments = pgTable("proposal_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  proposalId: varchar("proposal_id").notNull(),
  
  // Comment Details
  commentType: varchar("comment_type").default("general"), // general, revision_request, approval, internal
  content: text("content").notNull(),
  
  // Author Information
  authorId: varchar("author_id").notNull(),
  authorName: varchar("author_name").notNull(),
  authorRole: varchar("author_role"), // salesperson, manager, customer
  
  // Visibility and Status
  isInternal: boolean("is_internal").default(false),
  isResolved: boolean("is_resolved").default(false),
  
  // Attachments
  attachments: jsonb("attachments").$type<Array<{
    fileName: string;
    fileUrl: string;
    fileType: string;
    fileSize: number;
  }>>(),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Proposal Templates - Reusable proposal templates for different scenarios
export const proposalTemplates = pgTable("proposal_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Template Identification
  name: varchar("name").notNull(), // e.g., "Enterprise Equipment Lease", "Service Contract Standard"
  description: text("description"),
  category: varchar("category").notNull(), // equipment_lease, service_contract, managed_services, hybrid
  
  // Template Settings
  isActive: boolean("is_active").default(true),
  isDefault: boolean("is_default").default(false), // Default template for category
  accessLevel: varchar("access_level").default("company"), // company, team, user - who can use this template
  
  // Styling and Branding
  styling: jsonb("styling").default('{}').$type<{
    primaryColor?: string;
    secondaryColor?: string;
    logoUrl?: string;
    fontFamily?: string;
    headerStyle?: string;
    footerContent?: string;
  }>(),
  
  // Created by and ownership
  createdBy: varchar("created_by").notNull(),
  teamId: varchar("team_id"), // If team-specific template
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Proposal Template Sections - Configurable sections that can be reordered and customized
export const proposalTemplateSections = pgTable("proposal_template_sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  templateId: varchar("template_id").notNull(), // references proposal_templates.id
  
  // Section Configuration
  sectionType: varchar("section_type").notNull(), // cover_page, executive_summary, company_intro, solution_overview, pricing, terms, team, guarantees, next_steps, custom
  sectionTitle: varchar("section_title").notNull(),
  displayOrder: integer("display_order").notNull(),
  
  // Content and Behavior
  isRequired: boolean("is_required").default(false),
  isVisible: boolean("is_visible").default(true),
  isEditable: boolean("is_editable").default(true),
  defaultContent: text("default_content"), // Default text content for this section
  
  // Section Settings
  settings: jsonb("settings").default('{}').$type<{
    showInTOC?: boolean; // Show in table of contents
    pageBreakBefore?: boolean;
    pageBreakAfter?: boolean;
    backgroundImage?: string;
    customStyling?: Record<string, any>;
  }>(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Proposal Content Blocks - Reusable content blocks that can be inserted into proposals
export const proposalContentBlocks = pgTable("proposal_content_blocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Block Identification
  name: varchar("name").notNull(),
  blockType: varchar("block_type").notNull(), // company_intro, value_prop, guarantee, team_bio, testimonial, case_study, technical_specs
  category: varchar("category"), // Optional grouping
  
  // Content
  title: varchar("title"),
  content: text("content").notNull(),
  htmlContent: text("html_content"), // Rich formatted version
  
  // Usage and Access
  isGlobal: boolean("is_global").default(false), // Available to all users in tenant
  createdBy: varchar("created_by").notNull(),
  teamId: varchar("team_id"), // If team-specific
  
  // Metadata
  tags: jsonb("tags").default('[]').$type<string[]>(), // For filtering and search
  usageCount: integer("usage_count").default(0),
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Proposal Sections - Actual sections in a specific proposal (generated from template)
export const proposalSections = pgTable("proposal_sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  proposalId: varchar("proposal_id").notNull(), // references proposals.id
  
  // Section Details
  sectionType: varchar("section_type").notNull(),
  sectionTitle: varchar("section_title").notNull(),
  displayOrder: integer("display_order").notNull(),
  
  // Content
  content: text("content"),
  htmlContent: text("html_content"),
  
  // Status and Settings
  isVisible: boolean("is_visible").default(true),
  isCompleted: boolean("is_completed").default(false), // Has content been added
  
  // Template Reference
  templateSectionId: varchar("template_section_id"), // references proposal_template_sections.id
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Company Branding Profiles - Store company-specific branding for proposals
export const companyBrandingProfiles = pgTable("company_branding_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Profile Details
  name: varchar("name").notNull(), // e.g., "Main Brand", "Enterprise Division"
  isDefault: boolean("is_default").default(false),
  
  // Branding Elements
  companyName: varchar("company_name").notNull(),
  tagline: varchar("tagline"),
  logoUrl: varchar("logo_url"),
  websiteUrl: varchar("website_url"),
  
  // Color Scheme
  primaryColor: varchar("primary_color").default("#0066CC"),
  secondaryColor: varchar("secondary_color").default("#F8F9FA"),
  accentColor: varchar("accent_color").default("#28A745"),
  textColor: varchar("text_color").default("#212529"),
  
  // Typography
  headingFont: varchar("heading_font").default("Inter"),
  bodyFont: varchar("body_font").default("Inter"),
  
  // Contact Information
  address: text("address"),
  phone: varchar("phone"),
  email: varchar("email"),
  
  // Social Media
  socialLinks: jsonb("social_links").default('{}').$type<{
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
  }>(),
  
  // Additional Styling
  customCSS: text("custom_css"), // Custom CSS for advanced styling
  
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Proposal Analytics and Tracking
export const proposalAnalytics = pgTable("proposal_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  proposalId: varchar("proposal_id").notNull(),
  
  // Event Details
  eventType: varchar("event_type").notNull(), // opened, downloaded, shared, status_change
  eventTimestamp: timestamp("event_timestamp").defaultNow(),
  
  // Event Context
  eventDetails: jsonb("event_details").$type<{
    deviceType?: string;
    ipAddress?: string;
    userAgent?: string;
    previousStatus?: string;
    newStatus?: string;
  }>(),
  
  // User Information (if applicable)
  userId: varchar("user_id"),
  customerUserId: varchar("customer_user_id"), // If customer has login access
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Proposal Approvals (for internal approval workflows)
export const proposalApprovals = pgTable("proposal_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  proposalId: varchar("proposal_id").notNull(),
  
  // Approval Details
  approvalLevel: varchar("approval_level").notNull(), // manager, director, executive
  requiredBy: varchar("required_by"), // User who needs to approve
  approvedBy: varchar("approved_by"), // User who approved
  
  // Status and Decisions
  status: varchar("status").default("pending"), // pending, approved, rejected
  approvalComments: text("approval_comments"),
  
  // Timestamps
  requestedAt: timestamp("requested_at").defaultNow(),
  respondedAt: timestamp("responded_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertEquipmentPackageSchema = createInsertSchema(equipmentPackages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProposalSchema = createInsertSchema(proposals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProposalLineItemSchema = createInsertSchema(proposalLineItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProposalCommentSchema = createInsertSchema(proposalComments).omit({
  id: true,
  createdAt: true,
});

export const insertProposalAnalyticsSchema = createInsertSchema(proposalAnalytics).omit({
  id: true,
  createdAt: true,
});

export const insertProposalApprovalSchema = createInsertSchema(proposalApprovals).omit({
  id: true,
  createdAt: true,
});

// Types
export type ProposalTemplate = typeof proposalTemplates.$inferSelect;
export type InsertProposalTemplate = typeof proposalTemplates.$inferInsert;
export type EquipmentPackage = typeof equipmentPackages.$inferSelect;
export type InsertEquipmentPackage = typeof equipmentPackages.$inferInsert;
export type Proposal = typeof proposals.$inferSelect;
export type InsertProposal = typeof proposals.$inferInsert;
export type ProposalLineItem = typeof proposalLineItems.$inferSelect;
export type InsertProposalLineItem = typeof proposalLineItems.$inferInsert;
export type ProposalComment = typeof proposalComments.$inferSelect;
export type InsertProposalComment = typeof proposalComments.$inferInsert;
export type ProposalAnalytics = typeof proposalAnalytics.$inferSelect;
export type InsertProposalAnalytics = typeof proposalAnalytics.$inferInsert;
export type ProposalApproval = typeof proposalApprovals.$inferSelect;
export type InsertProposalApproval = typeof proposalApprovals.$inferInsert;

// ============= PRICING SYSTEM =============

// Company Pricing Settings - Global markup rules
export const companyPricingSettings = pgTable("company_pricing_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Global Settings
  defaultMarkupPercentage: decimal("default_markup_percentage", { precision: 5, scale: 2 }).notNull().default("20.00"),
  allowSalespersonOverride: boolean("allow_salesperson_override").default(true),
  minimumGrossProfitPercentage: decimal("minimum_gross_profit_percentage", { precision: 5, scale: 2 }).default("5.00"),
  
  // Settings
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Product Pricing - Individual product pricing overrides
export const productPricing = pgTable("product_pricing", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Product Reference (flexible for any product type)
  productId: varchar("product_id").notNull(),
  productType: varchar("product_type").notNull(), // "model", "accessory", "service", "software", etc.
  
  // Pricing Layers
  dealerCost: decimal("dealer_cost", { precision: 12, scale: 2 }).notNull(),
  companyMarkupPercentage: decimal("company_markup_percentage", { precision: 5, scale: 2 }), // Override global setting
  companyPrice: decimal("company_price", { precision: 12, scale: 2 }).notNull(), // Calculated: dealer_cost * (1 + markup%)
  
  // Pricing Rules
  minimumSalePrice: decimal("minimum_sale_price", { precision: 12, scale: 2 }), // Minimum price salespeople can sell at
  suggestedRetailPrice: decimal("suggested_retail_price", { precision: 12, scale: 2 }), // MSRP
  
  // Status
  isActive: boolean("is_active").default(true),
  effectiveDate: timestamp("effective_date").defaultNow(),
  expirationDate: timestamp("expiration_date"),
  
  // Tracking
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Quote Pricing - Salesperson pricing at quote level
export const quotePricing = pgTable("quote_pricing", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Quote Reference
  leadId: varchar("lead_id"), // If quote is for a lead
  customerId: varchar("customer_id"), // If quote is for existing customer
  quoteNumber: varchar("quote_number").notNull(),
  
  // Blanket Pricing Settings
  blanketGrossProfitPercentage: decimal("blanket_gross_profit_percentage", { precision: 5, scale: 2 }).default("10.00"),
  applyBlanketToAllItems: boolean("apply_blanket_to_all_items").default(true),
  
  // Quote Totals
  totalDealerCost: decimal("total_dealer_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  totalCompanyPrice: decimal("total_company_price", { precision: 12, scale: 2 }).notNull().default("0"),
  totalSalePrice: decimal("total_sale_price", { precision: 12, scale: 2 }).notNull().default("0"),
  totalGrossProfit: decimal("total_gross_profit", { precision: 12, scale: 2 }).notNull().default("0"),
  totalGrossProfitPercentage: decimal("total_gross_profit_percentage", { precision: 5, scale: 2 }).default("0"),
  
  // Status
  status: varchar("status").notNull().default("draft"), // draft, pending, approved, sent, closed
  
  // Tracking
  createdBy: varchar("created_by").notNull(), // Salesperson
  approvedBy: varchar("approved_by"),
  approvedDate: timestamp("approved_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Quote Line Items With Pricing - Individual product pricing in quotes
export const quotePricingLineItems = pgTable("quote_pricing_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // References
  quotePricingId: varchar("quote_pricing_id").notNull(),
  productId: varchar("product_id").notNull(),
  productType: varchar("product_type").notNull(),
  lineNumber: integer("line_number").notNull(),
  
  // Product Details
  productName: varchar("product_name").notNull(),
  productDescription: text("product_description"),
  productSku: varchar("product_sku"),
  
  // Quantity
  quantity: integer("quantity").notNull().default(1),
  
  // Pricing Breakdown (per unit)
  dealerCost: decimal("dealer_cost", { precision: 12, scale: 2 }).notNull(),
  companyPrice: decimal("company_price", { precision: 12, scale: 2 }).notNull(),
  salePrice: decimal("sale_price", { precision: 12, scale: 2 }).notNull(),
  
  // Line Item Totals
  totalDealerCost: decimal("total_dealer_cost", { precision: 12, scale: 2 }).notNull(),
  totalCompanyPrice: decimal("total_company_price", { precision: 12, scale: 2 }).notNull(),
  totalSalePrice: decimal("total_sale_price", { precision: 12, scale: 2 }).notNull(),
  
  // Profit Calculations
  unitGrossProfit: decimal("unit_gross_profit", { precision: 12, scale: 2 }).notNull(),
  totalGrossProfit: decimal("total_gross_profit", { precision: 12, scale: 2 }).notNull(),
  grossProfitPercentage: decimal("gross_profit_percentage", { precision: 5, scale: 2 }).notNull(),
  
  // Override Settings
  useCustomGrossProfit: boolean("use_custom_gross_profit").default(false),
  customGrossProfitPercentage: decimal("custom_gross_profit_percentage", { precision: 5, scale: 2 }),
  
  // Notes
  notes: text("notes"),
  
  // Tracking
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============= ACCOUNTING MODULES =============

// Vendors (Suppliers)
// Note: vendors table is defined above with full E-Automate compatibility

// Accounts Payable
export const accountsPayable = pgTable("accounts_payable", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Reference Information
  vendorId: varchar("vendor_id").notNull(),
  billNumber: varchar("bill_number").notNull(),
  purchaseOrderNumber: varchar("purchase_order_number"),
  referenceNumber: varchar("reference_number"),
  
  // Bill Details
  billDate: timestamp("bill_date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  description: text("description"),
  
  // Financial Information
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }).default("0"),
  balanceAmount: decimal("balance_amount", { precision: 12, scale: 2 }).notNull(),
  
  // Status & Classification
  status: varchar("status").notNull().default("pending"),
  priority: varchar("priority").default("normal"),
  category: varchar("category"),
  department: varchar("department"),
  
  // Payment Information
  paymentMethod: varchar("payment_method"),
  paymentDate: timestamp("payment_date"),
  checkNumber: varchar("check_number"),
  
  // Approval Workflow
  approvedBy: varchar("approved_by"),
  approvedDate: timestamp("approved_date"),
  approvalNotes: text("approval_notes"),
  
  // Tracking
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Accounts Receivable
export const accountsReceivable = pgTable("accounts_receivable", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Reference Information
  customerId: varchar("customer_id").notNull(),
  invoiceNumber: varchar("invoice_number").notNull(),
  contractId: varchar("contract_id"),
  salesOrderNumber: varchar("sales_order_number"),
  
  // Invoice Details
  invoiceDate: timestamp("invoice_date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  description: text("description"),
  
  // Financial Information
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }).default("0"),
  balanceAmount: decimal("balance_amount", { precision: 12, scale: 2 }).notNull(),
  
  // Status & Classification
  status: varchar("status").notNull().default("outstanding"),
  invoiceType: varchar("invoice_type").notNull(),
  category: varchar("category"),
  
  // Payment Information
  paymentTerms: varchar("payment_terms").default("Net 30"),
  paymentMethod: varchar("payment_method"),
  lastPaymentDate: timestamp("last_payment_date"),
  
  // Collections & Follow-up
  followUpDate: timestamp("follow_up_date"),
  collectionNotes: text("collection_notes"),
  daysOverdue: integer("days_overdue").default(0),
  
  // Tracking
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Chart of Accounts
export const chartOfAccounts = pgTable("chart_of_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Account Information
  accountCode: varchar("account_code").notNull(),
  accountName: varchar("account_name").notNull(),
  accountType: varchar("account_type").notNull(),
  accountSubtype: varchar("account_subtype"),
  
  // Hierarchy
  parentAccountId: varchar("parent_account_id"),
  level: integer("level").default(1),
  
  // Settings
  description: text("description"),
  isActive: boolean("is_active").default(true),
  isSystem: boolean("is_system").default(false),
  
  // Balance Information
  currentBalance: decimal("current_balance", { precision: 12, scale: 2 }).default("0"),
  debitBalance: decimal("debit_balance", { precision: 12, scale: 2 }).default("0"),
  creditBalance: decimal("credit_balance", { precision: 12, scale: 2 }).default("0"),
  
  // Tracking
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Purchase Orders
export const purchaseOrders = pgTable("purchase_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Reference Information
  poNumber: varchar("po_number").notNull(),
  vendorId: varchar("vendor_id").notNull(),
  requestedBy: varchar("requested_by").notNull(),
  
  // Order Details
  orderDate: timestamp("order_date").notNull(),
  expectedDate: timestamp("expected_date"),
  description: text("description"),
  
  // Financial Information
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).default("0"),
  shippingAmount: decimal("shipping_amount", { precision: 12, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  
  // Status
  status: varchar("status").notNull().default("draft"),
  
  // Delivery Information
  deliveryAddress: text("delivery_address"),
  specialInstructions: text("special_instructions"),
  
  // Approval
  approvedBy: varchar("approved_by"),
  approvedDate: timestamp("approved_date"),
  
  // Tracking
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Purchase Order Line Items
export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Reference
  purchaseOrderId: varchar("purchase_order_id").notNull(),
  lineNumber: integer("line_number").notNull(),
  
  // Product Information
  itemDescription: text("item_description").notNull(),
  itemCode: varchar("item_code"),
  
  // Quantity & Pricing
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  
  // Status
  receivedQuantity: integer("received_quantity").default(0),
  
  // Tracking
  createdAt: timestamp("created_at").defaultNow(),
});

// Accounting Types
export type Vendor = typeof vendors.$inferSelect;
export type InsertVendor = typeof vendors.$inferInsert;

export type AccountsPayable = typeof accountsPayable.$inferSelect;
export type InsertAccountsPayable = typeof accountsPayable.$inferInsert;

export type AccountsReceivable = typeof accountsReceivable.$inferSelect;
export type InsertAccountsReceivable = typeof accountsReceivable.$inferInsert;

export type ChartOfAccount = typeof chartOfAccounts.$inferSelect;
export type InsertChartOfAccount = typeof chartOfAccounts.$inferInsert;

export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type InsertPurchaseOrder = typeof purchaseOrders.$inferInsert;

export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type InsertPurchaseOrderItem = typeof purchaseOrderItems.$inferInsert;

// Pricing System Types
export type CompanyPricingSetting = typeof companyPricingSettings.$inferSelect;
export type InsertCompanyPricingSetting = typeof companyPricingSettings.$inferInsert;

export type ProductPricing = typeof productPricing.$inferSelect;
export type InsertProductPricing = typeof productPricing.$inferInsert;

export type QuotePricing = typeof quotePricing.$inferSelect;
export type InsertQuotePricing = typeof quotePricing.$inferInsert;

export type QuotePricingLineItem = typeof quotePricingLineItems.$inferSelect;
export type InsertQuotePricingLineItem = typeof quotePricingLineItems.$inferInsert;

// Pricing Schema Validations
export const insertCompanyPricingSettingSchema = createInsertSchema(companyPricingSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductPricingSchema = createInsertSchema(productPricing).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertQuotePricingSchema = createInsertSchema(quotePricing).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertQuotePricingLineItemSchema = createInsertSchema(quotePricingLineItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Accounting Schema Validations
export const insertVendorSchema = createInsertSchema(vendors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAccountsPayableSchema = createInsertSchema(accountsPayable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAccountsReceivableSchema = createInsertSchema(accountsReceivable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChartOfAccountSchema = createInsertSchema(chartOfAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPurchaseOrderItemSchema = createInsertSchema(purchaseOrderItems).omit({
  id: true,
  createdAt: true,
});

// User Settings Schema Validations
export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;

// Social Media Post Generator Schema
export const socialMediaPosts = pgTable("social_media_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Generation metadata
  generationType: varchar("generation_type").notNull(), // manual, scheduled, cron
  status: varchar("status").notNull().default("draft"), // draft, generated, published, failed
  
  // Claude API Integration
  claudeModel: varchar("claude_model").default("claude-sonnet-4-20250514"),
  claudePrompt: text("claude_prompt"),
  claudeResponse: jsonb("claude_response"),
  
  // Post Content
  title: varchar("title").notNull(),
  shortContent: text("short_content").notNull(), // Twitter < 200 chars
  longContent: text("long_content").notNull(), // Facebook/LinkedIn
  websiteLink: varchar("website_link").default("https://printyx.net"),
  
  // Scheduling & Automation
  scheduledFor: timestamp("scheduled_for"),
  cronExpression: varchar("cron_expression"), // For recurring posts
  isRecurring: boolean("is_recurring").default(false),
  
  // Webhook & Broadcasting
  webhookUrl: varchar("webhook_url"),
  webhookPayload: jsonb("webhook_payload"),
  webhookStatus: varchar("webhook_status"), // pending, sent, failed
  webhookSentAt: timestamp("webhook_sent_at"),
  
  // Platform targeting
  targetPlatforms: jsonb("target_platforms"), // ["twitter", "facebook", "linkedin"]
  
  // Audit fields
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const socialMediaCronJobs = pgTable("social_media_cron_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  name: varchar("name").notNull(),
  description: text("description"),
  cronExpression: varchar("cron_expression").notNull(), // 0 9 * * 1 (every Monday at 9 AM)
  isActive: boolean("is_active").default(true),
  
  // Post generation settings
  promptTemplate: text("prompt_template").notNull(),
  targetPlatforms: jsonb("target_platforms").notNull(),
  webhookUrl: varchar("webhook_url").notNull(),
  
  // Execution tracking
  lastExecuted: timestamp("last_executed"),
  nextExecution: timestamp("next_execution"),
  executionCount: integer("execution_count").default(0),
  failureCount: integer("failure_count").default(0),
  
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Drizzle schemas for validation
export const insertSocialMediaPostSchema = createInsertSchema(socialMediaPosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSocialMediaCronJobSchema = createInsertSchema(socialMediaCronJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SocialMediaPost = typeof socialMediaPosts.$inferSelect;
export type InsertSocialMediaPost = z.infer<typeof insertSocialMediaPostSchema>;
export type SocialMediaCronJob = typeof socialMediaCronJobs.$inferSelect;
export type InsertSocialMediaCronJob = z.infer<typeof insertSocialMediaCronJobSchema>;

// ============= PROPOSAL SYSTEM SCHEMAS =============

// Proposal Template Schemas
export const insertProposalTemplateSchema = createInsertSchema(proposalTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProposalTemplateSectionSchema = createInsertSchema(proposalTemplateSections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProposalContentBlockSchema = createInsertSchema(proposalContentBlocks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProposalSectionSchema = createInsertSchema(proposalSections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCompanyBrandingProfileSchema = createInsertSchema(companyBrandingProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Proposal System Types
export type ProposalTemplate = typeof proposalTemplates.$inferSelect;
export type InsertProposalTemplate = z.infer<typeof insertProposalTemplateSchema>;
export type ProposalTemplateSection = typeof proposalTemplateSections.$inferSelect;
export type InsertProposalTemplateSection = z.infer<typeof insertProposalTemplateSectionSchema>;
export type ProposalContentBlock = typeof proposalContentBlocks.$inferSelect;
export type InsertProposalContentBlock = z.infer<typeof insertProposalContentBlockSchema>;
export type ProposalSection = typeof proposalSections.$inferSelect;
export type InsertProposalSection = z.infer<typeof insertProposalSectionSchema>;
export type CompanyBrandingProfile = typeof companyBrandingProfiles.$inferSelect;
export type InsertCompanyBrandingProfile = z.infer<typeof insertCompanyBrandingProfileSchema>;