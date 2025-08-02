import { pgTable, text, integer, boolean, decimal, timestamp, varchar, uuid, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums for service analysis
export const serviceOutcomeEnum = pgEnum('service_outcome', [
  'resolved', 'partial_fix', 'requires_parts', 'requires_escalation', 
  'customer_declined', 'follow_up_needed', 'warranty_claim', 'preventive_maintenance'
]);

export const partsOrderStatusEnum = pgEnum('parts_order_status', [
  'pending', 'ordered', 'shipped', 'delivered', 'installed', 'returned'
]);

export const analysisTypeEnum = pgEnum('analysis_type', [
  'diagnostic', 'repair', 'maintenance', 'installation', 'inspection', 'training'
]);

// Service Call Analysis Table
export const serviceCallAnalysis = pgTable("service_call_analysis", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  serviceTicketId: uuid("service_ticket_id").notNull(),
  technicianId: uuid("technician_id").notNull(),
  
  // Call Details
  callStartTime: timestamp("call_start_time").notNull(),
  callEndTime: timestamp("call_end_time"),
  actualArrivalTime: timestamp("actual_arrival_time"),
  onSiteTime: integer("on_site_time_minutes"), // Minutes spent on site
  travelTime: integer("travel_time_minutes"),
  
  // Analysis Details
  analysisType: analysisTypeEnum("analysis_type").notNull(),
  problemDescription: text("problem_description").notNull(),
  rootCause: text("root_cause"),
  actionsTaken: jsonb("actions_taken").$type<string[]>().default([]),
  outcome: serviceOutcomeEnum("outcome").notNull(),
  
  // Technical Details
  equipmentCondition: text("equipment_condition"),
  meterReading: integer("meter_reading"),
  diagnosticCodes: jsonb("diagnostic_codes").$type<string[]>().default([]),
  
  // Customer Interaction
  customerPresent: boolean("customer_present").default(false),
  customerSignature: text("customer_signature"),
  customerFeedback: text("customer_feedback"),
  customerSatisfactionScore: integer("customer_satisfaction_score"), // 1-5
  
  // Follow-up Requirements
  followUpRequired: boolean("follow_up_required").default(false),
  followUpDate: timestamp("follow_up_date"),
  followUpReason: text("follow_up_reason"),
  
  // Financial
  laborHours: decimal("labor_hours", { precision: 4, scale: 2 }),
  laborRate: decimal("labor_rate", { precision: 10, scale: 2 }),
  totalLaborCost: decimal("total_labor_cost", { precision: 10, scale: 2 }),
  
  // Photos and Documentation
  beforePhotos: jsonb("before_photos").$type<string[]>().default([]),
  afterPhotos: jsonb("after_photos").$type<string[]>().default([]),
  serviceReportUrl: text("service_report_url"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Parts Required/Used Table
export const servicePartsUsed = pgTable("service_parts_used", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  analysisId: uuid("analysis_id").notNull(),
  
  // Part Details
  partNumber: varchar("part_number", { length: 100 }).notNull(),
  partName: varchar("part_name", { length: 255 }).notNull(),
  partDescription: text("part_description"),
  
  // Usage
  quantityUsed: integer("quantity_used").notNull(),
  quantityWasted: integer("quantity_wasted").default(0),
  
  // Inventory Status
  wasInStock: boolean("was_in_stock").default(false),
  inventoryItemId: uuid("inventory_item_id"),
  
  // Costs
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }),
  billable: boolean("billable").default(true),
  
  // Warranty
  warrantyPeriod: integer("warranty_period_months"),
  serialNumbers: jsonb("serial_numbers").$type<string[]>().default([]),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Parts Orders Table
export const partsOrders = pgTable("parts_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  analysisId: uuid("analysis_id").notNull(),
  serviceTicketId: uuid("service_ticket_id").notNull(),
  
  // Order Details
  orderNumber: varchar("order_number", { length: 100 }).notNull(),
  vendorId: uuid("vendor_id"),
  vendorName: varchar("vendor_name", { length: 255 }).notNull(),
  
  // Status and Timing
  status: partsOrderStatusEnum("status").notNull().default('pending'),
  orderDate: timestamp("order_date").notNull(),
  expectedDeliveryDate: timestamp("expected_delivery_date"),
  actualDeliveryDate: timestamp("actual_delivery_date"),
  
  // Financial
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  tax: decimal("tax", { precision: 10, scale: 2 }).default('0'),
  shipping: decimal("shipping", { precision: 10, scale: 2 }).default('0'),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  
  // Priority and Instructions
  priority: varchar("priority", { length: 20 }).notNull().default('normal'),
  rushOrder: boolean("rush_order").default(false),
  specialInstructions: text("special_instructions"),
  
  // Delivery
  deliveryAddress: text("delivery_address"),
  trackingNumber: varchar("tracking_number", { length: 100 }),
  
  // Follow-up Service
  followUpTicketId: uuid("follow_up_ticket_id"),
  installationScheduled: boolean("installation_scheduled").default(false),
  installationDate: timestamp("installation_date"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Parts Order Items Table  
export const partsOrderItems = pgTable("parts_order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  orderId: uuid("order_id").notNull(),
  
  // Part Details
  partNumber: varchar("part_number", { length: 100 }).notNull(),
  partName: varchar("part_name", { length: 255 }).notNull(),
  partDescription: text("part_description"),
  
  // Order Details
  quantityOrdered: integer("quantity_ordered").notNull(),
  quantityReceived: integer("quantity_received").default(0),
  quantityBackordered: integer("quantity_backordered").default(0),
  
  // Pricing
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }).default('0'),
  lineTotal: decimal("line_total", { precision: 10, scale: 2 }).notNull(),
  
  // Status
  itemStatus: partsOrderStatusEnum("item_status").notNull().default('pending'),
  expectedDate: timestamp("expected_date"),
  receivedDate: timestamp("received_date"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const serviceCallAnalysisRelations = relations(serviceCallAnalysis, ({ many, one }) => ({
  partsUsed: many(servicePartsUsed),
  partsOrders: many(partsOrders),
}));

export const servicePartsUsedRelations = relations(servicePartsUsed, ({ one }) => ({
  analysis: one(serviceCallAnalysis, {
    fields: [servicePartsUsed.analysisId],
    references: [serviceCallAnalysis.id],
  }),
}));

export const partsOrdersRelations = relations(partsOrders, ({ many, one }) => ({
  analysis: one(serviceCallAnalysis, {
    fields: [partsOrders.analysisId],
    references: [serviceCallAnalysis.id],
  }),
  items: many(partsOrderItems),
}));

export const partsOrderItemsRelations = relations(partsOrderItems, ({ one }) => ({
  order: one(partsOrders, {
    fields: [partsOrderItems.orderId],
    references: [partsOrders.id],
  }),
}));

// Insert Schemas
export const insertServiceCallAnalysisSchema = createInsertSchema(serviceCallAnalysis).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertServicePartsUsedSchema = createInsertSchema(servicePartsUsed).omit({
  id: true,
  createdAt: true,
});

export const insertPartsOrderSchema = createInsertSchema(partsOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPartsOrderItemSchema = createInsertSchema(partsOrderItems).omit({
  id: true,
  createdAt: true,
});

// Types
export type ServiceCallAnalysis = typeof serviceCallAnalysis.$inferSelect;
export type ServicePartsUsed = typeof servicePartsUsed.$inferSelect;
export type PartsOrder = typeof partsOrders.$inferSelect;
export type PartsOrderItem = typeof partsOrderItems.$inferSelect;

export type InsertServiceCallAnalysis = z.infer<typeof insertServiceCallAnalysisSchema>;
export type InsertServicePartsUsed = z.infer<typeof insertServicePartsUsedSchema>;
export type InsertPartsOrder = z.infer<typeof insertPartsOrderSchema>;
export type InsertPartsOrderItem = z.infer<typeof insertPartsOrderItemSchema>;