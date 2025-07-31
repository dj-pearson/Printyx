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
  priority: varchar("priority").notNull().default('medium'),
  status: varchar("status").notNull().default('open'),
  assignedTechnicianId: varchar("assigned_technician_id"),
  createdBy: varchar("created_by").notNull(),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  skills: text("skills").array(),
  isActive: boolean("is_active").default(true),
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
}));

export const contractsRelations = relations(contracts, ({ one }) => ({
  tenant: one(tenants, {
    fields: [contracts.tenantId],
    references: [tenants.id],
  }),
  customer: one(customers, {
    fields: [contracts.customerId],
    references: [customers.id],
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
