import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, decimal, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Purchase Orders table
export const purchaseOrders = pgTable("purchase_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  poNumber: varchar("po_number", { length: 50 }).notNull(),
  vendorId: uuid("vendor_id").notNull(),
  orderDate: timestamp("order_date").defaultNow(),
  expectedDeliveryDate: timestamp("expected_delivery_date"),
  status: varchar("status").notNull().default("pending"), // pending, approved, ordered, received, cancelled
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }),
  notes: text("notes"),
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Purchase Order Line Items
export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  purchaseOrderId: uuid("purchase_order_id").notNull(),
  productId: uuid("product_id"),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }),
  serialNumber: varchar("serial_number", { length: 100 }),
  receivedQuantity: integer("received_quantity").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Warehouse Operations table
export const warehouseOperations = pgTable("warehouse_operations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  equipmentId: uuid("equipment_id").notNull(),
  operationType: varchar("operation_type").notNull(), // receiving, quality_control, staging, shipping
  status: varchar("status").notNull().default("pending"), // pending, in_progress, completed, failed
  assignedTo: uuid("assigned_to"),
  scheduledDate: timestamp("scheduled_date"),
  completedDate: timestamp("completed_date"),
  notes: text("notes"),
  qualityControlChecks: jsonb("quality_control_checks"),
  photos: jsonb("photos"), // Array of photo URLs
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Equipment Lifecycle Tracking
export const equipmentLifecycle = pgTable("equipment_lifecycle", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  equipmentId: uuid("equipment_id").notNull().unique(),
  serialNumber: varchar("serial_number", { length: 100 }).notNull(),
  manufacturer: varchar("manufacturer", { length: 100 }),
  model: varchar("model", { length: 100 }),
  qrCode: varchar("qr_code", { length: 255 }),
  currentStage: varchar("current_stage").notNull().default("ordered"), // ordered, received, staged, delivered, installed, active, retired
  currentLocation: varchar("current_location"),
  customerId: uuid("customer_id"),
  purchaseOrderId: uuid("purchase_order_id"),
  warrantyStartDate: timestamp("warranty_start_date"),
  warrantyEndDate: timestamp("warranty_end_date"),
  warrantyRegistered: boolean("warranty_registered").default(false),
  lastServiceDate: timestamp("last_service_date"),
  metadata: jsonb("metadata"), // Flexible storage for manufacturer-specific data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Delivery Schedules
export const deliverySchedules = pgTable("delivery_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  equipmentId: uuid("equipment_id").notNull(),
  customerId: uuid("customer_id").notNull(),
  scheduledDate: timestamp("scheduled_date").notNull(),
  timeWindow: varchar("time_window"), // morning, afternoon, specific time
  deliveryType: varchar("delivery_type").notNull().default("standard"), // standard, white_glove, inside_delivery
  specialInstructions: text("special_instructions"),
  deliveryAddress: jsonb("delivery_address").notNull(),
  contactPerson: varchar("contact_person"),
  contactPhone: varchar("contact_phone"),
  status: varchar("status").notNull().default("scheduled"), // scheduled, dispatched, in_transit, delivered, failed
  driverId: uuid("driver_id"),
  vehicleId: varchar("vehicle_id"),
  actualDeliveryTime: timestamp("actual_delivery_time"),
  deliveryNotes: text("delivery_notes"),
  signatureUrl: varchar("signature_url"),
  photoUrls: jsonb("photo_urls"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Installation Schedules
export const installationSchedules = pgTable("installation_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  equipmentId: uuid("equipment_id").notNull(),
  customerId: uuid("customer_id").notNull(),
  technicianId: uuid("technician_id").notNull(),
  scheduledDate: timestamp("scheduled_date").notNull(),
  estimatedDuration: integer("estimated_duration"), // in minutes
  installationType: varchar("installation_type").notNull(), // standard, network_setup, training_included
  siteRequirements: jsonb("site_requirements"),
  preInstallationChecklist: jsonb("pre_installation_checklist"),
  status: varchar("status").notNull().default("scheduled"), // scheduled, in_progress, completed, cancelled, rescheduled
  actualStartTime: timestamp("actual_start_time"),
  actualEndTime: timestamp("actual_end_time"),
  installationNotes: text("installation_notes"),
  customerSignature: varchar("customer_signature"),
  installationPhotos: jsonb("installation_photos"),
  configurationBackup: jsonb("configuration_backup"),
  trainingProvided: boolean("training_provided").default(false),
  customerSatisfactionRating: integer("customer_satisfaction_rating"),
  followUpRequired: boolean("follow_up_required").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Compliance Documentation
export const complianceDocuments = pgTable("compliance_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  equipmentId: uuid("equipment_id").notNull(),
  documentType: varchar("document_type").notNull(), // warranty_registration, installation_certificate, compliance_check, photo_documentation
  documentUrl: varchar("document_url"),
  metadata: jsonb("metadata"),
  verificationStatus: varchar("verification_status").default("pending"), // pending, verified, rejected
  verifiedBy: uuid("verified_by"),
  verificationDate: timestamp("verification_date"),
  expirationDate: timestamp("expiration_date"),
  reminderSent: boolean("reminder_sent").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Technician Certifications
export const technicianCertifications = pgTable("technician_certifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  technicianId: uuid("technician_id").notNull(),
  certificationType: varchar("certification_type").notNull(), // canon_cct, xerox_xct, hp_ase, kyocera_kcst, comptia_pdi
  certificationNumber: varchar("certification_number"),
  issuedDate: timestamp("issued_date"),
  expirationDate: timestamp("expiration_date"),
  certificationBody: varchar("certification_body"),
  documentUrl: varchar("document_url"),
  isActive: boolean("is_active").default(true),
  reminderSent: boolean("reminder_sent").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const purchaseOrdersRelations = relations(purchaseOrders, ({ many }) => ({
  items: many(purchaseOrderItems),
}));

export const purchaseOrderItemsRelations = relations(purchaseOrderItems, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseOrderItems.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
}));

export const equipmentLifecycleRelations = relations(equipmentLifecycle, ({ one, many }) => ({
  warehouseOperations: many(warehouseOperations),
  deliverySchedule: one(deliverySchedules),
  installationSchedule: one(installationSchedules),
  complianceDocuments: many(complianceDocuments),
}));

// Insert schemas
export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWarehouseOperationSchema = createInsertSchema(warehouseOperations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEquipmentLifecycleSchema = createInsertSchema(equipmentLifecycle).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDeliveryScheduleSchema = createInsertSchema(deliverySchedules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInstallationScheduleSchema = createInsertSchema(installationSchedules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertComplianceDocumentSchema = createInsertSchema(complianceDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTechnicianCertificationSchema = createInsertSchema(technicianCertifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type WarehouseOperation = typeof warehouseOperations.$inferSelect;
export type InsertWarehouseOperation = z.infer<typeof insertWarehouseOperationSchema>;
export type EquipmentLifecycle = typeof equipmentLifecycle.$inferSelect;
export type InsertEquipmentLifecycle = z.infer<typeof insertEquipmentLifecycleSchema>;
export type DeliverySchedule = typeof deliverySchedules.$inferSelect;
export type InsertDeliverySchedule = z.infer<typeof insertDeliveryScheduleSchema>;
export type InstallationSchedule = typeof installationSchedules.$inferSelect;
export type InsertInstallationSchedule = z.infer<typeof insertInstallationScheduleSchema>;
export type ComplianceDocument = typeof complianceDocuments.$inferSelect;
export type InsertComplianceDocument = z.infer<typeof insertComplianceDocumentSchema>;
export type TechnicianCertification = typeof technicianCertifications.$inferSelect;
export type InsertTechnicianCertification = z.infer<typeof insertTechnicianCertificationSchema>;