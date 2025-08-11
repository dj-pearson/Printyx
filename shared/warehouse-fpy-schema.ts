import { sql } from 'drizzle-orm';
import {
  pgTable,
  timestamp,
  varchar,
  text,
  decimal,
  boolean,
  pgEnum,
  uuid,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Warehouse operation status enum
export const warehouseOperationStatusEnum = pgEnum('warehouse_operation_status', [
  'pending', 'in_progress', 'completed', 'failed', 'cancelled'
]);

// Kit quality status enum
export const kitQualityStatusEnum = pgEnum('kit_quality_status', [
  'pass', 'fail', 'rework_required', 'pending_inspection'
]);

// Warehouse kitting checklist and FPY tracking
export const warehouseKittingOperations = pgTable("warehouse_kitting_operations", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: varchar("tenant_id").notNull(),
  
  // Order reference
  purchaseOrderId: varchar("purchase_order_id"),
  orderNumber: varchar("order_number").notNull(),
  customerId: varchar("customer_id").notNull(),
  
  // Kitting details
  kitName: varchar("kit_name").notNull(),
  equipmentModel: varchar("equipment_model"),
  requiredAccessories: jsonb("required_accessories").$type<string[]>().default([]),
  
  // Quality control
  checklistItems: jsonb("checklist_items").$type<{
    item: string;
    required: boolean;
    completed: boolean;
    notes?: string;
  }[]>().default([]),
  
  // FPY tracking
  firstPassYield: boolean("first_pass_yield").default(false),
  qualityStatus: kitQualityStatusEnum("quality_status").default('pending_inspection'),
  defectsFound: jsonb("defects_found").$type<{
    defectType: string;
    description: string;
    severity: 'minor' | 'major' | 'critical';
    corrected: boolean;
  }[]>().default([]),
  
  // Rework tracking
  reworkRequired: boolean("rework_required").default(false),
  reworkCount: integer("rework_count").default(0),
  reworkNotes: text("rework_notes"),
  
  // Technician and time tracking
  assignedTechnician: varchar("assigned_technician").notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  totalDurationMinutes: integer("total_duration_minutes"),
  
  // Status and completion
  operationStatus: warehouseOperationStatusEnum("operation_status").default('pending'),
  completedBy: varchar("completed_by"),
  supervisorApproval: boolean("supervisor_approval").default(false),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  
  // Asset tracking
  assetTags: jsonb("asset_tags").$type<string[]>().default([]),
  firmwareVersions: jsonb("firmware_versions").$type<Record<string, string>>().default({}),
  serialNumbers: jsonb("serial_numbers").$type<string[]>().default([]),
  
  // Documentation
  photos: jsonb("photos").$type<string[]>().default([]),
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// FPY metrics aggregation table for reporting
export const fpyMetrics = pgTable("fpy_metrics", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: varchar("tenant_id").notNull(),
  
  // Time period
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  
  // Metrics
  totalOperations: integer("total_operations").notNull(),
  firstPassOperations: integer("first_pass_operations").notNull(),
  fpyPercentage: decimal("fpy_percentage", { precision: 5, scale: 2 }).notNull(),
  
  // Breakdown by category
  fpyByTechnician: jsonb("fpy_by_technician").$type<Record<string, { total: number; firstPass: number; percentage: number }>>().default({}),
  fpyByEquipmentType: jsonb("fpy_by_equipment_type").$type<Record<string, { total: number; firstPass: number; percentage: number }>>().default({}),
  
  // Defect analysis
  topDefectTypes: jsonb("top_defect_types").$type<{ defectType: string; count: number; percentage: number }[]>().default([]),
  reworkRate: decimal("rework_rate", { precision: 5, scale: 2 }).default('0'),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Auto-invoice generation tracking
export const autoInvoiceGeneration = pgTable("auto_invoice_generation", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: varchar("tenant_id").notNull(),
  
  // Source reference
  sourceType: varchar("source_type").notNull(), // 'service_ticket', 'warehouse_operation', 'installation', etc.
  sourceId: varchar("source_id").notNull(),
  
  // Invoice details
  invoiceId: varchar("invoice_id"),
  invoiceNumber: varchar("invoice_number"),
  
  // Generation status
  generationStatus: varchar("generation_status").default('pending'), // pending, processing, completed, failed
  generationAttempts: integer("generation_attempts").default(0),
  errorMessage: text("error_message"),
  
  // Timing
  triggeredAt: timestamp("triggered_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  issuanceDelayHours: decimal("issuance_delay_hours", { precision: 8, scale: 2 }),
  
  // Invoice data
  laborHours: decimal("labor_hours", { precision: 6, scale: 2 }),
  laborRate: decimal("labor_rate", { precision: 8, scale: 2 }),
  partsTotal: decimal("parts_total", { precision: 10, scale: 2 }),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const warehouseKittingOperationsRelations = relations(warehouseKittingOperations, ({ one }) => ({
  // Add relations when needed
}));

export const fpyMetricsRelations = relations(fpyMetrics, ({ one }) => ({
  // Add relations when needed
}));

export const autoInvoiceGenerationRelations = relations(autoInvoiceGeneration, ({ one }) => ({
  // Add relations when needed
}));

// Insert schemas
export const insertWarehouseKittingOperationSchema = createInsertSchema(warehouseKittingOperations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFpyMetricSchema = createInsertSchema(fpyMetrics).omit({
  id: true,
  createdAt: true,
});

export const insertAutoInvoiceGenerationSchema = createInsertSchema(autoInvoiceGeneration).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type WarehouseKittingOperation = typeof warehouseKittingOperations.$inferSelect;
export type FpyMetric = typeof fpyMetrics.$inferSelect;
export type AutoInvoiceGeneration = typeof autoInvoiceGeneration.$inferSelect;

export type InsertWarehouseKittingOperation = z.infer<typeof insertWarehouseKittingOperationSchema>;
export type InsertFpyMetric = z.infer<typeof insertFpyMetricSchema>;
export type InsertAutoInvoiceGeneration = z.infer<typeof insertAutoInvoiceGenerationSchema>;