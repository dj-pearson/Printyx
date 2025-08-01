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
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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

// Role-based access control tables
export const roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 50 }).notNull(), // e.g., "Sales Rep", "Sales Manager", "Service Tech"
  code: varchar("code", { length: 30 }).notNull().unique(), // e.g., "SALES_REP", "SALES_MGR"
  department: varchar("department", { length: 30 }).notNull(), // e.g., "sales", "service", "admin", "finance"
  level: integer("level").notNull().default(1), // 1=individual, 2=team_lead, 3=manager, 4=director, 5=admin
  description: varchar("description", { length: 255 }),
  permissions: jsonb("permissions").notNull().default('{}'), // JSON object with module permissions
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

// Tenants table for multi-tenancy
export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  domain: varchar("domain").unique(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User storage table with enhanced role-based fields - required for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id"),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  passwordHash: varchar("password_hash"), // bcrypt hashed password
  roleId: varchar("role_id"), // references roles.id
  teamId: varchar("team_id"), // references teams.id
  managerId: varchar("manager_id"), // direct manager - references users.id
  employeeId: varchar("employee_id"), // company employee ID
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
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

// CRM - Enhanced Leads table for comprehensive company/lead management
export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Company Information (matching your CRM screenshots)
  businessName: varchar("business_name").notNull(),
  businessSite: varchar("business_site"), // e.g., "MAURY BLDG 1"
  parentCompany: varchar("parent_company"),
  industry: varchar("industry"),
  description: text("description"),
  
  // Primary Contact
  contactName: varchar("contact_name").notNull(),
  contactTitle: varchar("contact_title"),
  phone: varchar("phone"),
  fax: varchar("fax"),
  email: varchar("email"),
  website: varchar("website"),
  
  // Business Details
  customerNumber: varchar("customer_number"), // For converted customers
  customerSince: timestamp("customer_since"),
  employees: integer("employees"),
  annualRevenue: decimal("annual_revenue", { precision: 12, scale: 2 }),
  numberOfLocations: integer("number_of_locations"),
  sicCode: varchar("sic_code"),
  productServicesInterest: text("product_services_interest"),
  
  // Address Information
  billingAddress: text("billing_address"),
  billingCity: varchar("billing_city"),
  billingState: varchar("billing_state"),
  billingZip: varchar("billing_zip"),
  shippingAddress: text("shipping_address"),
  shippingCity: varchar("shipping_city"),
  shippingState: varchar("shipping_state"),
  shippingZip: varchar("shipping_zip"),
  
  // CRM Status & Pipeline
  recordType: varchar("record_type").notNull().default('lead'), // lead, customer, inactive
  status: varchar("status").notNull().default('new'), // new, contacted, qualified, proposal, closed_won, closed_lost
  priority: varchar("priority").notNull().default('medium'), // low, medium, high
  source: varchar("source"), // website, referral, cold_call, trade_show, etc.
  estimatedValue: decimal("estimated_value", { precision: 10, scale: 2 }),
  estimatedCloseDate: timestamp("estimated_close_date"),
  
  // Contact Management
  assignedSalespersonId: varchar("assigned_salesperson_id"),
  nextCallBack: timestamp("next_call_back"),
  lastContactDate: timestamp("last_contact_date"),
  nextFollowUpDate: timestamp("next_follow_up_date"),
  
  // Notes & Tracking
  notes: text("notes"),
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

// Contracts table
export const contracts = pgTable("contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  customerId: varchar("customer_id").notNull(),
  contractNumber: varchar("contract_number").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  blackRate: decimal("black_rate", { precision: 10, scale: 4 }),
  colorRate: decimal("color_rate", { precision: 10, scale: 4 }),
  monthlyBase: decimal("monthly_base", { precision: 10, scale: 2 }),
  status: varchar("status").notNull().default('active'),
  assignedSalespersonId: varchar("assigned_salesperson_id"), // who manages this contract
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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

// Meter readings table for billing
export const meterReadings = pgTable("meter_readings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  equipmentId: varchar("equipment_id").notNull(),
  contractId: varchar("contract_id").notNull(),
  readingDate: timestamp("reading_date").notNull(),
  blackMeter: integer("black_meter").notNull().default(0),
  colorMeter: integer("color_meter").notNull().default(0),
  previousBlackMeter: integer("previous_black_meter").default(0),
  previousColorMeter: integer("previous_color_meter").default(0),
  blackCopies: integer("black_copies").default(0),
  colorCopies: integer("color_copies").default(0),
  collectionMethod: varchar("collection_method").notNull().default('manual'),
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
  assignedLeads: many(leads),
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

export const leadsRelations = relations(leads, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [leads.tenantId],
    references: [tenants.id],
  }),
  assignedSalesperson: one(users, {
    fields: [leads.assignedSalespersonId],
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

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  teams: many(teams),
  customers: many(customers),
  equipment: many(equipment),
  contracts: many(contracts),
  serviceTickets: many(serviceTickets),
  inventoryItems: many(inventoryItems),
  technicians: many(technicians),
  meterReadings: many(meterReadings),
  invoices: many(invoices),
  invoiceLineItems: many(invoiceLineItems),
  leads: many(leads),
  quotes: many(quotes),
  userCustomerAssignments: many(userCustomerAssignments),
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
  meterReadings: many(meterReadings),
  invoices: many(invoices),
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

// Type exports
export type UpsertUser = typeof users.$inferInsert;
export type InsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Role = typeof roles.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type UserCustomerAssignment = typeof userCustomerAssignments.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type LeadActivity = typeof leadActivities.$inferSelect;
export type LeadContact = typeof leadContacts.$inferSelect;
export type LeadRelatedRecord = typeof leadRelatedRecords.$inferSelect;
export type Quote = typeof quotes.$inferSelect;
export type QuoteLineItem = typeof quoteLineItems.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Equipment = typeof equipment.$inferSelect;
export type Contract = typeof contracts.$inferSelect;
export type ServiceTicket = typeof serviceTickets.$inferSelect;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type Technician = typeof technicians.$inferSelect;
export type MeterReading = typeof meterReadings.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;

// Backward compatibility type aliases
export type LeadInteraction = LeadActivity;
export type CustomerInteraction = LeadActivity;