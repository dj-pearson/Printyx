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

// User storage table - required for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  tenantId: varchar("tenant_id").notNull(),
  role: varchar("role").notNull().default('user'),
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

// Customers table
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  name: varchar("name").notNull(),
  email: varchar("email"),
  phone: varchar("phone"),
  address: text("address"),
  contactPerson: varchar("contact_person"),
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
  requiredParts: text("required_parts").array(), // JSON array of part IDs and quantities
  workOrderNotes: text("work_order_notes"),
  resolutionNotes: text("resolution_notes"),
  customerSignature: text("customer_signature"), // base64 encoded signature
  partsUsed: text("parts_used").array(), // JSON array of actual parts used
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
  skills: text("skills").array(), // e.g., ['printer_repair', 'network_setup', 'maintenance']
  certifications: text("certifications").array(),
  currentLocation: text("current_location"), // JSON with lat/lng
  isActive: boolean("is_active").default(true),
  isAvailable: boolean("is_available").default(true),
  workingHours: text("working_hours"), // JSON with schedule
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
  startTime: varchar("start_time").notNull(), // HH:MM format
  endTime: varchar("end_time").notNull(), // HH:MM format
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
  collectionMethod: varchar("collection_method").notNull().default('manual'), // manual, email, dca
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
  status: varchar("status").notNull().default('draft'), // draft, sent, paid, overdue
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
  lineType: varchar("line_type").notNull().default('meter'), // meter, base, service, supply
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
}));

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  customers: many(customers),
  equipment: many(equipment),
  contracts: many(contracts),
  serviceTickets: many(serviceTickets),
  inventoryItems: many(inventoryItems),
  technicians: many(technicians),
  meterReadings: many(meterReadings),
  invoices: many(invoices),
  invoiceLineItems: many(invoiceLineItems),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [customers.tenantId],
    references: [tenants.id],
  }),
  equipment: many(equipment),
  contracts: many(contracts),
  serviceTickets: many(serviceTickets),
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

// Meter readings relations
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

// Invoices relations
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

// Invoice line items relations
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

// Insert schemas
export const insertTenantSchema = createInsertSchema(tenants).omit({
  createdAt: true,
  updatedAt: true,
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

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;
export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type Equipment = typeof equipment.$inferSelect;
export type InsertContract = z.infer<typeof insertContractSchema>;
export type Contract = typeof contracts.$inferSelect;
export type InsertServiceTicket = z.infer<typeof insertServiceTicketSchema>;
export type ServiceTicket = typeof serviceTickets.$inferSelect;
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InsertTechnician = z.infer<typeof insertTechnicianSchema>;
export type Technician = typeof technicians.$inferSelect;
export type InsertMeterReading = z.infer<typeof insertMeterReadingSchema>;
export type MeterReading = typeof meterReadings.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoiceLineItem = z.infer<typeof insertInvoiceLineItemSchema>;
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;

// Enhanced CRM tables for sales pipeline and customer management
export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  companyName: varchar("company_name").notNull(),
  contactName: varchar("contact_name").notNull(),
  email: varchar("email"),
  phone: varchar("phone"),
  address: text("address"),
  source: varchar("source").notNull().default('website'), // website, referral, cold_call, trade_show
  status: varchar("status").notNull().default('new'), // new, qualified, proposal, negotiation, closed_won, closed_lost
  assignedSalesRepId: varchar("assigned_sales_rep_id"),
  estimatedValue: decimal("estimated_value", { precision: 10, scale: 2 }).default('0'),
  estimatedCloseDate: timestamp("estimated_close_date"),
  notes: text("notes"),
  lastContactDate: timestamp("last_contact_date"),
  nextFollowUpDate: timestamp("next_follow_up_date"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  leadId: varchar("lead_id"),
  customerId: varchar("customer_id"),
  quoteNumber: varchar("quote_number").notNull(),
  title: varchar("title").notNull(),
  description: text("description"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull().default('0'),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).default('0'),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status").notNull().default('draft'), // draft, sent, accepted, declined, expired
  validUntil: timestamp("valid_until").notNull(),
  sentDate: timestamp("sent_date"),
  acceptedDate: timestamp("accepted_date"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const quoteLineItems = pgTable("quote_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  quoteId: varchar("quote_id").notNull(),
  description: varchar("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 4 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  itemType: varchar("item_type").notNull().default('service'), // equipment, service, supply, maintenance
  createdAt: timestamp("created_at").defaultNow(),
});

export const customerInteractions = pgTable("customer_interactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  customerId: varchar("customer_id"),
  leadId: varchar("lead_id"),
  interactionType: varchar("interaction_type").notNull(), // call, email, meeting, note, demo
  subject: varchar("subject").notNull(),
  description: text("description"),
  outcome: varchar("outcome"), // positive, neutral, negative, follow_up_required
  nextAction: text("next_action"),
  scheduledDate: timestamp("scheduled_date"),
  completedDate: timestamp("completed_date"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const customerContacts = pgTable("customer_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  customerId: varchar("customer_id").notNull(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  title: varchar("title"),
  email: varchar("email"),
  phone: varchar("phone"),
  mobile: varchar("mobile"),
  isPrimary: boolean("is_primary").default(false),
  department: varchar("department"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// CRM Type exports
export type Lead = typeof leads.$inferSelect;
export type Quote = typeof quotes.$inferSelect;
export type QuoteLineItem = typeof quoteLineItems.$inferSelect;
export type CustomerInteraction = typeof customerInteractions.$inferSelect;
export type CustomerContact = typeof customerContacts.$inferSelect;

// CRM Insert schemas
export const insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true, updatedAt: true });
export const insertQuoteSchema = createInsertSchema(quotes).omit({ id: true, quoteNumber: true, createdAt: true, updatedAt: true });
export const insertQuoteLineItemSchema = createInsertSchema(quoteLineItems).omit({ id: true, createdAt: true });
export const insertCustomerInteractionSchema = createInsertSchema(customerInteractions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCustomerContactSchema = createInsertSchema(customerContacts).omit({ id: true, createdAt: true, updatedAt: true });

// CRM Insert types
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type InsertQuoteLineItem = z.infer<typeof insertQuoteLineItemSchema>;
export type InsertCustomerInteraction = z.infer<typeof insertCustomerInteractionSchema>;
export type InsertCustomerContact = z.infer<typeof insertCustomerContactSchema>;
