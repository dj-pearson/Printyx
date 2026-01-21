import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  decimal,
  uuid,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Purchase Orders table
export const purchaseOrders = pgTable('purchase_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  poNumber: varchar('po_number', { length: 50 }).notNull(),
  vendorId: uuid('vendor_id').notNull(),
  orderDate: timestamp('order_date').defaultNow(),
  expectedDeliveryDate: timestamp('expected_delivery_date'),
  status: varchar('status').notNull().default('pending'), // pending, approved, ordered, received, cancelled
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }),
  notes: text('notes'),
  createdBy: uuid('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Purchase Order Line Items
export const purchaseOrderItems = pgTable('purchase_order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  purchaseOrderId: uuid('purchase_order_id').notNull(),
  productId: uuid('product_id'),
  description: text('description').notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }),
  totalPrice: decimal('total_price', { precision: 10, scale: 2 }),
  serialNumber: varchar('serial_number', { length: 100 }),
  receivedQuantity: integer('received_quantity').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Warehouse Operations table
export const warehouseOperations = pgTable('warehouse_operations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  equipmentId: uuid('equipment_id').notNull(),
  operationType: varchar('operation_type').notNull(), // receiving, quality_control, staging, shipping
  status: varchar('status').notNull().default('pending'), // pending, in_progress, completed, failed
  assignedTo: uuid('assigned_to'),
  scheduledDate: timestamp('scheduled_date'),
  completedDate: timestamp('completed_date'),
  notes: text('notes'),
  qualityControlChecks: jsonb('quality_control_checks'),
  photos: jsonb('photos'), // Array of photo URLs
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Equipment Lifecycle Tracking
export const equipmentLifecycle = pgTable('equipment_lifecycle', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  equipmentId: uuid('equipment_id').notNull().unique(),
  serialNumber: varchar('serial_number', { length: 100 }).notNull(),
  manufacturer: varchar('manufacturer', { length: 100 }),
  model: varchar('model', { length: 100 }),
  qrCode: varchar('qr_code', { length: 255 }),
  currentStage: varchar('current_stage').notNull().default('ordered'), // ordered, received, staged, delivered, installed, active, retired
  currentLocation: varchar('current_location'),
  customerId: uuid('customer_id'),
  purchaseOrderId: uuid('purchase_order_id'),
  warrantyStartDate: timestamp('warranty_start_date'),
  warrantyEndDate: timestamp('warranty_end_date'),
  warrantyRegistered: boolean('warranty_registered').default(false),
  lastServiceDate: timestamp('last_service_date'),
  metadata: jsonb('metadata'), // Flexible storage for manufacturer-specific data
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Delivery Schedules
export const deliverySchedules = pgTable('delivery_schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  equipmentId: uuid('equipment_id').notNull(),
  customerId: uuid('customer_id').notNull(),
  scheduledDate: timestamp('scheduled_date').notNull(),
  timeWindow: varchar('time_window'), // morning, afternoon, specific time
  deliveryType: varchar('delivery_type').notNull().default('standard'), // standard, white_glove, inside_delivery
  specialInstructions: text('special_instructions'),
  deliveryAddress: jsonb('delivery_address').notNull(),
  contactPerson: varchar('contact_person'),
  contactPhone: varchar('contact_phone'),
  status: varchar('status').notNull().default('scheduled'), // scheduled, dispatched, in_transit, delivered, failed
  driverId: uuid('driver_id'),
  vehicleId: varchar('vehicle_id'),
  actualDeliveryTime: timestamp('actual_delivery_time'),
  deliveryNotes: text('delivery_notes'),
  signatureUrl: varchar('signature_url'),
  photoUrls: jsonb('photo_urls'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Installation Schedules
export const installationSchedules = pgTable('installation_schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  equipmentId: uuid('equipment_id').notNull(),
  customerId: uuid('customer_id').notNull(),
  technicianId: uuid('technician_id').notNull(),
  scheduledDate: timestamp('scheduled_date').notNull(),
  estimatedDuration: integer('estimated_duration'), // in minutes
  installationType: varchar('installation_type').notNull(), // standard, network_setup, training_included
  siteRequirements: jsonb('site_requirements'),
  preInstallationChecklist: jsonb('pre_installation_checklist'),
  status: varchar('status').notNull().default('scheduled'), // scheduled, in_progress, completed, cancelled, rescheduled
  actualStartTime: timestamp('actual_start_time'),
  actualEndTime: timestamp('actual_end_time'),
  installationNotes: text('installation_notes'),
  customerSignature: varchar('customer_signature'),
  installationPhotos: jsonb('installation_photos'),
  configurationBackup: jsonb('configuration_backup'),
  trainingProvided: boolean('training_provided').default(false),
  customerSatisfactionRating: integer('customer_satisfaction_rating'),
  followUpRequired: boolean('follow_up_required').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Compliance Documentation
export const complianceDocuments = pgTable('compliance_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  equipmentId: uuid('equipment_id').notNull(),
  documentType: varchar('document_type').notNull(), // warranty_registration, installation_certificate, compliance_check, photo_documentation
  documentUrl: varchar('document_url'),
  metadata: jsonb('metadata'),
  verificationStatus: varchar('verification_status').default('pending'), // pending, verified, rejected
  verifiedBy: uuid('verified_by'),
  verificationDate: timestamp('verification_date'),
  expirationDate: timestamp('expiration_date'),
  reminderSent: boolean('reminder_sent').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Technician Certifications
export const technicianCertifications = pgTable('technician_certifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  technicianId: uuid('technician_id').notNull(),
  certificationType: varchar('certification_type').notNull(), // canon_cct, xerox_xct, hp_ase, kyocera_kcst, comptia_pdi
  certificationNumber: varchar('certification_number'),
  issuedDate: timestamp('issued_date'),
  expirationDate: timestamp('expiration_date'),
  certificationBody: varchar('certification_body'),
  documentUrl: varchar('document_url'),
  isActive: boolean('is_active').default(true),
  reminderSent: boolean('reminder_sent').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
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

export const insertTechnicianCertificationSchema = createInsertSchema(
  technicianCertifications,
).omit({
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

// ===================================================================
// STATE MACHINE & WORKFLOW ENHANCEMENTS - Improvement #2
// ===================================================================

// Equipment Lifecycle Transitions - State Machine History
export const equipmentLifecycleTransitions = pgTable('equipment_lifecycle_transitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  equipmentId: uuid('equipment_id').notNull(),

  fromStage: varchar('from_stage', { length: 50 }), // null for initial state
  toStage: varchar('to_stage', { length: 50 }).notNull(),

  transitionType: varchar('transition_type', { length: 50 }).notNull(), // automatic, manual, scheduled, rollback
  triggeredBy: uuid('triggered_by'), // user who initiated
  triggeredAt: timestamp('triggered_at').notNull().defaultNow(),

  reason: text('reason'), // optional explanation
  metadata: jsonb('metadata'), // transition-specific data

  validationsPassed: jsonb('validations_passed'), // checklist of validations that passed
  validationsFailed: jsonb('validations_failed'), // any failed validations

  isRollback: boolean('is_rollback').default(false),
  rollbackReason: text('rollback_reason'),

  status: varchar('status', { length: 20 }).notNull().default('completed'), // pending, in_progress, completed, failed, rolled_back

  createdAt: timestamp('created_at').defaultNow(),
});

// Lifecycle Transition Rules - Define valid state transitions
export const lifecycleTransitionRules = pgTable('lifecycle_transition_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),

  fromStage: varchar('from_stage', { length: 50 }).notNull(),
  toStage: varchar('to_stage', { length: 50 }).notNull(),

  isAllowed: boolean('is_allowed').notNull().default(true),

  requiredValidations: jsonb('required_validations'),
  // Example: ["delivery_signature_collected", "installation_completed", "customer_training_done"]

  autoTriggerConditions: jsonb('auto_trigger_conditions'),
  // Example: {"after_hours": 48, "when_status": "completed"}

  notificationTemplates: jsonb('notification_templates'),
  // Who to notify and what template to use

  allowRollback: boolean('allow_rollback').default(false),
  rollbackTimeLimitHours: integer('rollback_time_limit_hours'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Equipment Disposal Workflow
export const equipmentDisposal = pgTable('equipment_disposal', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  equipmentId: uuid('equipment_id').notNull(),

  disposalType: varchar('disposal_type', { length: 50 }).notNull(),
  // Types: recycle, donate, trade_in, landfill, resell

  disposalDate: timestamp('disposal_date').notNull(),
  disposalVendor: varchar('disposal_vendor', { length: 200 }),
  disposalCost: decimal('disposal_cost', { precision: 10, scale: 2 }),

  // Environmental compliance
  certificateOfDestruction: varchar('certificate_url', { length: 500 }),
  dataWipedConfirmation: boolean('data_wiped').notNull().default(false),
  environmentalCompliance: boolean('environmental_compliance').default(true),

  // Financial
  assetWriteOffAmount: decimal('write_off_amount', { precision: 10, scale: 2 }),
  salvageValue: decimal('salvage_value', { precision: 10, scale: 2 }),

  // Documentation
  disposalPhotos: jsonb('disposal_photos'), // array of URLs
  disposalNotes: text('disposal_notes'),

  approvedBy: uuid('approved_by'),
  approvedAt: timestamp('approved_at'),

  status: varchar('status', { length: 20 }).default('pending'), // pending, approved, scheduled, completed

  createdAt: timestamp('created_at').defaultNow(),
  createdBy: uuid('created_by'),
});

// Equipment Trade-In Management
export const equipmentTradeIns = pgTable('equipment_trade_ins', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),

  // Trade-in equipment (what customer is trading in)
  tradeInEquipmentId: uuid('trade_in_equipment_id'),

  // New equipment (what customer is upgrading to)
  newEquipmentId: uuid('new_equipment_id'),

  customerId: uuid('customer_id').notNull(),

  // Evaluation
  evaluationDate: timestamp('evaluation_date'),
  evaluatedBy: uuid('evaluated_by'),

  condition: varchar('condition', { length: 50 }), // excellent, good, fair, poor

  estimatedValue: decimal('estimated_value', { precision: 10, scale: 2 }),
  approvedValue: decimal('approved_value', { precision: 10, scale: 2 }),

  // Meter readings at trade-in
  bwMeterReading: integer('bw_meter_reading'),
  colorMeterReading: integer('color_meter_reading'),

  // Trade-in credit
  creditAmount: decimal('credit_amount', { precision: 10, scale: 2 }),
  creditAppliedTo: varchar('credit_applied_to', { length: 100 }), // new_purchase, account_credit, cash_refund

  // Checklist
  evaluationChecklist: jsonb('evaluation_checklist'),
  // Example: {"physical_condition": "good", "functional_status": "working", "accessories_included": true}

  photos: jsonb('photos'), // evaluation photos
  notes: text('notes'),

  status: varchar('status', { length: 20 }).default('pending'),
  // Status: pending_evaluation, evaluated, approved, completed, rejected

  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

// Equipment Transfer Workflow
export const equipmentTransfers = pgTable('equipment_transfers', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  equipmentId: uuid('equipment_id').notNull(),

  transferType: varchar('transfer_type', { length: 50 }).notNull(),
  // Types: customer_to_customer, location_to_location, warehouse_to_customer, customer_to_warehouse

  // From
  fromCustomerId: uuid('from_customer_id'),
  fromLocation: varchar('from_location', { length: 200 }),

  // To
  toCustomerId: uuid('to_customer_id'),
  toLocation: varchar('to_location', { length: 200 }),

  transferDate: timestamp('transfer_date').notNull(),

  // Reason & approval
  transferReason: text('transfer_reason'),
  requestedBy: uuid('requested_by'),
  approvedBy: uuid('approved_by'),
  approvedAt: timestamp('approved_at'),

  // Logistics
  deliveryScheduleId: uuid('delivery_schedule_id'),
  installationScheduleId: uuid('installation_schedule_id'),

  // Financial implications
  transferCost: decimal('transfer_cost', { precision: 10, scale: 2 }),
  billedToCustomer: boolean('billed_to_customer').default(false),

  // Compliance
  complianceDocuments: jsonb('compliance_documents'),
  // Transfer authorization, customer acceptance, etc.

  notes: text('notes'),

  status: varchar('status', { length: 20 }).default('pending'),
  // Status: pending_approval, approved, scheduled, in_transit, completed, cancelled

  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

// Equipment Bulk Operations
export const equipmentBulkOperations = pgTable('equipment_bulk_operations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),

  operationType: varchar('operation_type', { length: 50 }).notNull(),
  // Types: stage_transition, location_update, customer_assignment, disposal, transfer

  equipmentIds: jsonb('equipment_ids').notNull(), // array of equipment IDs

  operationData: jsonb('operation_data').notNull(),
  // Operation-specific parameters

  status: varchar('status', { length: 20 }).default('pending'),
  // Status: pending, in_progress, completed, partially_failed, failed

  totalCount: integer('total_count').notNull(),
  successCount: integer('success_count').default(0),
  failedCount: integer('failed_count').default(0),

  results: jsonb('results'),
  // Array of results per equipment: {equipmentId, success, error}

  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),

  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relations for new tables
export const equipmentLifecycleTransitionsRelations = relations(
  equipmentLifecycleTransitions,
  ({ one }) => ({
    equipment: one(equipmentLifecycle, {
      fields: [equipmentLifecycleTransitions.equipmentId],
      references: [equipmentLifecycle.equipmentId],
    }),
  }),
);

export const equipmentDisposalRelations = relations(equipmentDisposal, ({ one }) => ({
  equipment: one(equipmentLifecycle, {
    fields: [equipmentDisposal.equipmentId],
    references: [equipmentLifecycle.equipmentId],
  }),
}));

export const equipmentTradeInsRelations = relations(equipmentTradeIns, ({ one }) => ({
  tradeInEquipment: one(equipmentLifecycle, {
    fields: [equipmentTradeIns.tradeInEquipmentId],
    references: [equipmentLifecycle.equipmentId],
  }),
  newEquipment: one(equipmentLifecycle, {
    fields: [equipmentTradeIns.newEquipmentId],
    references: [equipmentLifecycle.equipmentId],
  }),
}));

export const equipmentTransfersRelations = relations(equipmentTransfers, ({ one }) => ({
  equipment: one(equipmentLifecycle, {
    fields: [equipmentTransfers.equipmentId],
    references: [equipmentLifecycle.equipmentId],
  }),
  deliverySchedule: one(deliverySchedules, {
    fields: [equipmentTransfers.deliveryScheduleId],
    references: [deliverySchedules.id],
  }),
  installationSchedule: one(installationSchedules, {
    fields: [equipmentTransfers.installationScheduleId],
    references: [installationSchedules.id],
  }),
}));

// Insert schemas for new tables
export const insertEquipmentLifecycleTransitionSchema = createInsertSchema(
  equipmentLifecycleTransitions,
).omit({
  id: true,
  createdAt: true,
});

export const insertLifecycleTransitionRuleSchema = createInsertSchema(
  lifecycleTransitionRules,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEquipmentDisposalSchema = createInsertSchema(equipmentDisposal).omit({
  id: true,
  createdAt: true,
});

export const insertEquipmentTradeInSchema = createInsertSchema(equipmentTradeIns).omit({
  id: true,
  createdAt: true,
});

export const insertEquipmentTransferSchema = createInsertSchema(equipmentTransfers).omit({
  id: true,
  createdAt: true,
});

export const insertEquipmentBulkOperationSchema = createInsertSchema(equipmentBulkOperations).omit({
  id: true,
  createdAt: true,
});

// Types for new tables
export type EquipmentLifecycleTransition = typeof equipmentLifecycleTransitions.$inferSelect;
export type InsertEquipmentLifecycleTransition = z.infer<
  typeof insertEquipmentLifecycleTransitionSchema
>;
export type LifecycleTransitionRule = typeof lifecycleTransitionRules.$inferSelect;
export type InsertLifecycleTransitionRule = z.infer<typeof insertLifecycleTransitionRuleSchema>;
export type EquipmentDisposal = typeof equipmentDisposal.$inferSelect;
export type InsertEquipmentDisposal = z.infer<typeof insertEquipmentDisposalSchema>;
export type EquipmentTradeIn = typeof equipmentTradeIns.$inferSelect;
export type InsertEquipmentTradeIn = z.infer<typeof insertEquipmentTradeInSchema>;
export type EquipmentTransfer = typeof equipmentTransfers.$inferSelect;
export type InsertEquipmentTransfer = z.infer<typeof insertEquipmentTransferSchema>;
export type EquipmentBulkOperation = typeof equipmentBulkOperations.$inferSelect;
export type InsertEquipmentBulkOperation = z.infer<typeof insertEquipmentBulkOperationSchema>;
export type TechnicianCertification = typeof technicianCertifications.$inferSelect;
export type InsertTechnicianCertification = z.infer<typeof insertTechnicianCertificationSchema>;
