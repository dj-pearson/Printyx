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

// Role types enum for organizational hierarchy
export const roleTypeEnum = pgEnum('role_type', [
  'platform_admin',    // Printyx system-level roles (Root Admin, Support Staff)
  'company_admin',     // Company tenant admin roles
  'department_role'    // Standard department-based roles within companies
]);

// Role-based access control tables with expanded hierarchy
export const roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 50 }).notNull(), // e.g., "Root Admin", "Printyx Support", "Company Admin", "Sales Rep"
  code: varchar("code", { length: 30 }).notNull().unique(), // e.g., "ROOT_ADMIN", "PRINTYX_SUPPORT", "COMPANY_ADMIN"
  roleType: roleTypeEnum("role_type").notNull().default('department_role'),
  department: varchar("department", { length: 30 }).notNull(), // e.g., "platform", "sales", "service", "admin", "finance"
  level: integer("level").notNull().default(1), // 1=individual, 2=team_lead, 3=manager, 4=director, 5=admin, 6=platform_admin
  description: varchar("description", { length: 255 }),
  permissions: jsonb("permissions").notNull().default('{}'), // JSON object with module permissions
  canAccessAllTenants: boolean("can_access_all_tenants").default(false), // For Printyx platform roles
  canManageUsers: boolean("can_manage_users").default(false), // For admin-level roles
  canViewSystemMetrics: boolean("can_view_system_metrics").default(false), // For platform monitoring
  isSystemRole: boolean("is_system_role").default(false), // For built-in roles that cannot be deleted
  createdAt: timestamp("created_at").defaultNow(),
});

export const teams = pgTable("teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
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

// User storage table with enhanced role-based fields and platform access
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
  isPlatformUser: boolean("is_platform_user").default(false), // True for Printyx staff
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User Settings - Store user preferences, accessibility settings, and profile data
export const userSettings = pgTable("user_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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

// User-Customer assignments for sales territory management
export const userCustomerAssignments = pgTable("user_customer_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
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

// CRM - Simplified Leads table for sales pipeline tracking
export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  companyId: varchar("company_id").notNull(), // Always tied to a company
  contactId: varchar("contact_id").notNull(), // Always tied to a specific contact
  
  // Lead Pipeline Information
  leadSource: varchar("lead_source").notNull().default("website"), // website, referral, cold_call, trade_show, etc.
  leadStatus: varchar("lead_status").notNull().default("new"), // new, qualified, proposal, negotiation, closed_won, closed_lost
  estimatedAmount: decimal("estimated_amount", { precision: 10, scale: 2 }),
  probability: integer("probability").default(50), // 0-100%
  closeDate: timestamp("close_date"),
  
  // Assignment & Ownership
  ownerId: varchar("owner_id"), // User who owns this lead
  leadScore: integer("lead_score").default(0), // 0-100 scoring system
  priority: varchar("priority").default("medium"), // high, medium, low
  
  // Tracking & Notes
  notes: text("notes"),
  lastContactDate: timestamp("last_contact_date"),
  nextFollowUpDate: timestamp("next_follow_up_date"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// CRM - Lead Activities (matching the activity timeline from your screenshots)
export const leadActivities = pgTable("lead_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  leadId: varchar("lead_id").notNull(),
  
  // Activity Details
  activityType: varchar("activity_type").notNull(), // email, call, meeting, demo, proposal, task, note, external
  subject: varchar("subject").notNull(),
  description: text("description"),
  direction: varchar("direction"), // inbound, outbound
  
  // Email Information (when activityType = 'email')
  emailFrom: varchar("email_from"),
  emailTo: text("email_to"), // JSON array for multiple recipients
  emailCc: text("email_cc"),
  emailSubject: varchar("email_subject"),
  emailBody: text("email_body"),
  isShared: boolean("is_shared").default(false), // "Emails are not shared with you..."
  
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

// Customers table
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  name: varchar("name").notNull(),
  email: varchar("email"),
  phone: varchar("phone"),
  address: text("address"),
  contactPerson: varchar("contact_person"),
  accountValue: decimal("account_value", { precision: 10, scale: 2 }),
  lastServiceDate: timestamp("last_service_date"),
  totalPrintVolume: integer("total_print_volume").default(0),
  averageMonthlyVolume: integer("average_monthly_volume").default(0),
  preferredTechnicianId: varchar("preferred_technician_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Equipment table
export const equipment = pgTable("equipment", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  customerId: varchar("customer_id").notNull(),
  serialNumber: varchar("serial_number").notNull(),
  model: varchar("model").notNull(),
  manufacturer: varchar("manufacturer").notNull(),
  location: varchar("location"),
  installDate: timestamp("install_date"),
  blackMeter: integer("black_meter").default(0),
  colorMeter: integer("color_meter").default(0),
  lastMeterReading: timestamp("last_meter_reading"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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
export const inventoryItems = pgTable("inventory_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  name: varchar("name").notNull(),
  partNumber: varchar("part_number"),
  category: varchar("category").notNull(),
  currentStock: integer("current_stock").default(0),
  reorderPoint: integer("reorder_point").default(0),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }),
  supplier: varchar("supplier"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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

// Meter readings table for billing - Enhanced for comprehensive collection methods
export const meterReadings = pgTable("meter_readings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  equipmentId: varchar("equipment_id").notNull(),
  contractId: varchar("contract_id").notNull(),
  
  // Reading Information
  readingDate: timestamp("reading_date").notNull(),
  blackMeter: integer("black_meter").notNull().default(0),
  colorMeter: integer("color_meter").notNull().default(0),
  previousBlackMeter: integer("previous_black_meter").default(0),
  previousColorMeter: integer("previous_color_meter").default(0),
  blackCopies: integer("black_copies").default(0),
  colorCopies: integer("color_copies").default(0),
  
  // Collection Method (PRD requirement)
  collectionMethod: varchar("collection_method").notNull().default('manual'), // manual, dca, email, api, remote_monitoring
  
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
  
  // Quality Control
  isVerified: boolean("is_verified").default(false), // Has reading been verified?
  verifiedBy: varchar("verified_by"), // Who verified the reading
  verifiedAt: timestamp("verified_at"), // When was it verified
  
  // Exceptions and Adjustments
  hasException: boolean("has_exception").default(false),
  exceptionReason: varchar("exception_reason"), // manual_override, billing_dispute, equipment_error
  exceptionNotes: text("exception_notes"),
  adjustmentAmount: decimal("adjustment_amount", { precision: 10, scale: 2 }).default('0'),
  
  // Billing Processing Status
  billingStatus: varchar("billing_status").notNull().default('pending'), // pending, processed, billed, disputed
  invoiceId: varchar("invoice_id"), // Reference to generated invoice
  billingAmount: decimal("billing_amount", { precision: 10, scale: 2 }),
  
  // Tracking
  notes: text("notes"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Invoices table for billing
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  customerId: varchar("customer_id").notNull(),
  contractId: varchar("contract_id").notNull(),
  invoiceNumber: varchar("invoice_number").notNull(),
  billingPeriodStart: timestamp("billing_period_start").notNull(),
  billingPeriodEnd: timestamp("billing_period_end").notNull(),
  monthlyBase: decimal("monthly_base", { precision: 10, scale: 2 }).default('0'),
  blackCopiesTotal: integer("black_copies_total").default(0),
  colorCopiesTotal: integer("color_copies_total").default(0),
  blackAmount: decimal("black_amount", { precision: 10, scale: 2 }).default('0'),
  colorAmount: decimal("color_amount", { precision: 10, scale: 2 }).default('0'),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status").notNull().default('draft'),
  dueDate: timestamp("due_date").notNull(),
  paidDate: timestamp("paid_date"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Invoice line items for detailed billing
export const invoiceLineItems = pgTable("invoice_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  invoiceId: varchar("invoice_id").notNull(),
  equipmentId: varchar("equipment_id").notNull(),
  meterReadingId: varchar("meter_reading_id"),
  description: varchar("description").notNull(),
  quantity: integer("quantity").default(0),
  rate: decimal("rate", { precision: 10, scale: 4 }).default('0'),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  lineType: varchar("line_type").notNull().default('meter'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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

export const leadsRelations = relations(leads, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [leads.tenantId],
    references: [tenants.id],
  }),
  company: one(companies, {
    fields: [leads.companyId],
    references: [companies.id],
  }),
  contact: one(companyContacts, {
    fields: [leads.contactId],
    references: [companyContacts.id],
  }),
  owner: one(users, {
    fields: [leads.ownerId],
    references: [users.id],
  }),
  createdByUser: one(users, {
    fields: [leads.createdBy],
    references: [users.id],
  }),
  activities: many(leadActivities),
  quotes: many(quotes),
}));

export const leadActivitiesRelations = relations(leadActivities, ({ one }) => ({
  tenant: one(tenants, {
    fields: [leadActivities.tenantId],
    references: [tenants.id],
  }),
  lead: one(leads, {
    fields: [leadActivities.leadId],
    references: [leads.id],
  }),
  createdByUser: one(users, {
    fields: [leadActivities.createdBy],
    references: [users.id],
  }),
}));

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

// Legacy types for backward compatibility
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;

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
export type ServiceTicket = typeof serviceTickets.$inferSelect;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type Technician = typeof technicians.$inferSelect;
export type MeterReading = typeof meterReadings.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;

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
  category: varchar("category").notNull(), // Device Management, Accounting, CRM, etc.
  provider: varchar("provider").notNull(),
  description: text("description"),
  status: varchar("status").notNull().default("disconnected"), // connected, disconnected, error, pending
  config: jsonb("config"), // API keys, endpoints, etc.
  lastSync: timestamp("last_sync"),
  syncFrequency: varchar("sync_frequency"), // hourly, daily, weekly
  isActive: boolean("is_active").default(true),
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
export type ServiceProduct = typeof serviceProducts.$inferSelect;
export type SoftwareProduct = typeof softwareProducts.$inferSelect;
export type Supply = typeof supplies.$inferSelect;
export type ManagedService = typeof managedServices.$inferSelect;

// Product Management Insert Types (consolidated)
export type InsertProductModel = z.infer<typeof insertProductModelSchema>;
export type InsertProductAccessory = z.infer<typeof insertProductAccessorySchema>;
export type InsertCpcRate = z.infer<typeof insertCpcRateSchema>;
export type InsertProfessionalService = z.infer<typeof insertProfessionalServiceSchema>;
export type InsertServiceProduct = z.infer<typeof insertServiceProductSchema>;
export type InsertSoftwareProduct = z.infer<typeof insertSoftwareProductSchema>;
export type InsertSupply = z.infer<typeof insertSupplySchema>;
export type InsertManagedService = z.infer<typeof insertManagedServiceSchema>;

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
export const vendors = pgTable("vendors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Basic Information
  vendorNumber: varchar("vendor_number").notNull(),
  companyName: varchar("company_name").notNull(),
  displayName: varchar("display_name"),
  
  // Contact Information
  contactPerson: varchar("contact_person"),
  phone: varchar("phone"),
  email: varchar("email"),
  website: varchar("website"),
  
  // Address Information
  address: text("address"),
  city: varchar("city"),
  state: varchar("state"),
  zipCode: varchar("zip_code"),
  country: varchar("country").default("US"),
  
  // Business Details
  taxId: varchar("tax_id"),
  paymentTerms: varchar("payment_terms").default("Net 30"),
  currency: varchar("currency").default("USD"),
  creditLimit: decimal("credit_limit", { precision: 12, scale: 2 }),
  
  // Categories & Classification
  vendorType: varchar("vendor_type").notNull(),
  category: varchar("category"),
  accountNumber: varchar("account_number"),
  
  // Status & Settings
  status: varchar("status").notNull().default("active"),
  preferred: boolean("preferred").default(false),
  
  // Banking Information
  bankName: varchar("bank_name"),
  accountHolder: varchar("account_holder"),
  routingNumber: varchar("routing_number"),
  bankAccountNumber: varchar("bank_account_number"),
  
  // Tracking
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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