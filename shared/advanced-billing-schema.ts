import { pgTable, varchar, text, timestamp, decimal, integer, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const billingRules = pgTable("billing_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  ruleName: varchar("rule_name").notNull(),
  ruleDescription: text("rule_description"),
  ruleType: varchar("rule_type").notNull(), // tiered, volume_discount, time_based, overage, flat_rate, custom
  ruleStatus: varchar("rule_status").default("active"), // active, inactive, draft
  
  priority: integer("priority").default(0),
  
  contractId: varchar("contract_id"),
  customerId: varchar("customer_id"),
  equipmentId: varchar("equipment_id"),
  productCategory: varchar("product_category"),
  
  applicableToAllCustomers: boolean("applicable_to_all_customers").default(false),
  applicableToAllEquipment: boolean("applicable_to_all_equipment").default(false),
  
  effectiveStartDate: timestamp("effective_start_date").notNull(),
  effectiveEndDate: timestamp("effective_end_date"),
  
  billingCycle: varchar("billing_cycle").default("monthly"), // daily, weekly, monthly, quarterly, annual
  
  tieredRates: jsonb("tiered_rates"), // [{ minVolume: 0, maxVolume: 1000, rate: 0.01 }, ...]
  
  baseCharge: decimal("base_charge", { precision: 10, scale: 2 }),
  minimumCharge: decimal("minimum_charge", { precision: 10, scale: 2 }),
  maximumCharge: decimal("maximum_charge", { precision: 10, scale: 2 }),
  
  bwRate: decimal("bw_rate", { precision: 6, scale: 4 }),
  colorRate: decimal("color_rate", { precision: 6, scale: 4 }),
  
  baseVolumeBw: integer("base_volume_bw").default(0),
  baseVolumeColor: integer("base_volume_color").default(0),
  
  overageMultiplier: decimal("overage_multiplier", { precision: 5, scale: 2 }).default("1.0"),
  
  volumeDiscounts: jsonb("volume_discounts"), // [{ threshold: 10000, discountPercent: 5 }, ...]
  
  timeBasedPricing: jsonb("time_based_pricing"), // { peakHours: { start: 9, end: 17, multiplier: 1.2 }, ... }
  
  allowNegativeBalance: boolean("allow_negative_balance").default(false),
  roundingMethod: varchar("rounding_method").default("nearest"), // up, down, nearest
  roundingPrecision: integer("rounding_precision").default(2),
  
  customCalculationFormula: text("custom_calculation_formula"),
  
  metadata: jsonb("metadata"),
  
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("billing_rules_tenant_id_idx").on(table.tenantId),
  tenantStatusIdx: index("billing_rules_tenant_status_idx").on(table.tenantId, table.ruleStatus),
  tenantContractIdx: index("billing_rules_tenant_contract_idx").on(table.tenantId, table.contractId),
  tenantCustomerIdx: index("billing_rules_tenant_customer_idx").on(table.tenantId, table.customerId),
  tenantEffectiveIdx: index("billing_rules_tenant_effective_idx").on(table.tenantId, table.effectiveStartDate),
}));

export const meterAnomalies = pgTable("meter_anomalies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  meterReadingId: varchar("meter_reading_id").notNull(),
  equipmentId: varchar("equipment_id").notNull(),
  contractId: varchar("contract_id"),
  customerId: varchar("customer_id"),
  
  anomalyType: varchar("anomaly_type").notNull(), // spike, negative_reading, stagnant, out_of_range, sudden_drop, inconsistent_pattern
  severity: varchar("severity").notNull(), // low, medium, high, critical
  
  detectedAt: timestamp("detected_at").notNull().defaultNow(),
  detectionMethod: varchar("detection_method").notNull(), // automated, manual
  
  currentBwReading: integer("current_bw_reading"),
  currentColorReading: integer("current_color_reading"),
  previousBwReading: integer("previous_bw_reading"),
  previousColorReading: integer("previous_color_reading"),
  expectedBwReading: integer("expected_bw_reading"),
  expectedColorReading: integer("expected_color_reading"),
  
  bwDeviation: integer("bw_deviation"), // Difference from expected
  colorDeviation: integer("color_deviation"),
  bwDeviationPercent: decimal("bw_deviation_percent", { precision: 5, scale: 2 }),
  colorDeviationPercent: decimal("color_deviation_percent", { precision: 5, scale: 2 }),
  
  anomalyDescription: text("anomaly_description"),
  suggestedAction: text("suggested_action"),
  
  requiresReview: boolean("requires_review").default(true),
  reviewed: boolean("reviewed").default(false),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: varchar("reviewed_by"),
  reviewNotes: text("review_notes"),
  
  resolved: boolean("resolved").default(false),
  resolvedAt: timestamp("resolved_at"),
  resolutionMethod: varchar("resolution_method"), // accepted, corrected, meter_replaced, customer_contacted
  resolutionNotes: text("resolution_notes"),
  
  correctedBwReading: integer("corrected_bw_reading"),
  correctedColorReading: integer("corrected_color_reading"),
  
  autoNotificationSent: boolean("auto_notification_sent").default(false),
  notifiedUsers: jsonb("notified_users"), // ["user-id-1", "user-id-2"]
  
  impactOnBilling: boolean("impact_on_billing").default(false),
  affectedInvoiceIds: jsonb("affected_invoice_ids"),
  
  metadata: jsonb("metadata"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("meter_anomalies_tenant_id_idx").on(table.tenantId),
  tenantMeterIdx: index("meter_anomalies_tenant_meter_idx").on(table.tenantId, table.meterReadingId),
  tenantEquipmentIdx: index("meter_anomalies_tenant_equipment_idx").on(table.tenantId, table.equipmentId),
  tenantTypeIdx: index("meter_anomalies_tenant_type_idx").on(table.tenantId, table.anomalyType),
  tenantSeverityIdx: index("meter_anomalies_tenant_severity_idx").on(table.tenantId, table.severity),
  tenantResolvedIdx: index("meter_anomalies_tenant_resolved_idx").on(table.tenantId, table.resolved),
}));

export const billingDisputes = pgTable("billing_disputes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  disputeNumber: varchar("dispute_number").unique().notNull(),
  
  invoiceId: varchar("invoice_id").notNull(),
  customerId: varchar("customer_id").notNull(),
  equipmentId: varchar("equipment_id"),
  meterReadingId: varchar("meter_reading_id"),
  
  disputeType: varchar("dispute_type").notNull(), // meter_reading, pricing, service_quality, billing_error, unauthorized_charge
  disputeStatus: varchar("dispute_status").default("open"), // open, under_review, resolved, closed, escalated
  severity: varchar("severity").default("medium"), // low, medium, high, critical
  
  disputedAmount: decimal("disputed_amount", { precision: 10, scale: 2 }).notNull(),
  approvedCreditAmount: decimal("approved_credit_amount", { precision: 10, scale: 2 }).default("0"),
  
  customerComplaint: text("customer_complaint").notNull(),
  customerContactName: varchar("customer_contact_name"),
  customerContactEmail: varchar("customer_contact_email"),
  customerContactPhone: varchar("customer_contact_phone"),
  
  filedDate: timestamp("filed_date").notNull().defaultNow(),
  dueDate: timestamp("due_date"),
  
  assignedTo: varchar("assigned_to"),
  assignedAt: timestamp("assigned_at"),
  
  priorityLevel: integer("priority_level").default(3), // 1 (highest) to 5 (lowest)
  
  internalNotes: text("internal_notes"),
  researchNotes: text("research_notes"),
  
  resolutionType: varchar("resolution_type"), // credit_issued, invoice_corrected, no_action, partial_credit, waived
  resolutionDescription: text("resolution_description"),
  resolutionDate: timestamp("resolution_date"),
  resolvedBy: varchar("resolved_by"),
  
  creditMemoId: varchar("credit_memo_id"),
  creditMemoNumber: varchar("credit_memo_number"),
  creditMemoAmount: decimal("credit_memo_amount", { precision: 10, scale: 2 }),
  creditMemoIssued: boolean("credit_memo_issued").default(false),
  creditMemoIssuedAt: timestamp("credit_memo_issued_at"),
  
  correctedInvoiceId: varchar("corrected_invoice_id"),
  
  communicationLog: jsonb("communication_log"), // [{ date, user, type, message }, ...]
  
  requiresManagerApproval: boolean("requires_manager_approval").default(false),
  managerApproved: boolean("manager_approved"),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  approvalNotes: text("approval_notes"),
  
  escalated: boolean("escalated").default(false),
  escalatedTo: varchar("escalated_to"),
  escalatedAt: timestamp("escalated_at"),
  escalationReason: text("escalation_reason"),
  
  customerSatisfactionRating: integer("customer_satisfaction_rating"), // 1-5
  customerFeedback: text("customer_feedback"),
  
  preventativeAction: text("preventative_action"), // What was done to prevent future disputes
  
  metadata: jsonb("metadata"),
  
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("billing_disputes_tenant_id_idx").on(table.tenantId),
  tenantStatusIdx: index("billing_disputes_tenant_status_idx").on(table.tenantId, table.disputeStatus),
  tenantInvoiceIdx: index("billing_disputes_tenant_invoice_idx").on(table.tenantId, table.invoiceId),
  tenantCustomerIdx: index("billing_disputes_tenant_customer_idx").on(table.tenantId, table.customerId),
  tenantDisputeNumIdx: index("billing_disputes_tenant_dispute_num_idx").on(table.tenantId, table.disputeNumber),
}));

export const invoiceGenerationLogs = pgTable("invoice_generation_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  batchId: varchar("batch_id"),
  generationType: varchar("generation_type").notNull(), // automated, manual, scheduled, triggered
  
  invoiceId: varchar("invoice_id"),
  customerId: varchar("customer_id").notNull(),
  contractId: varchar("contract_id"),
  equipmentId: varchar("equipment_id"),
  
  billingPeriodStart: timestamp("billing_period_start").notNull(),
  billingPeriodEnd: timestamp("billing_period_end").notNull(),
  
  status: varchar("status").notNull(), // success, failed, partial, skipped
  
  meterReadingsUsed: jsonb("meter_readings_used"), // [{ meterReadingId, bw, color }, ...]
  billingRulesApplied: jsonb("billing_rules_applied"), // [{ ruleId, ruleName, amount }, ...]
  
  calculatedSubtotal: decimal("calculated_subtotal", { precision: 10, scale: 2 }),
  calculatedTax: decimal("calculated_tax", { precision: 10, scale: 2 }),
  calculatedTotal: decimal("calculated_total", { precision: 10, scale: 2 }),
  
  lineItemsGenerated: integer("line_items_generated").default(0),
  
  processingTimeMs: integer("processing_time_ms"),
  
  errorOccurred: boolean("error_occurred").default(false),
  errorType: varchar("error_type"),
  errorMessage: text("error_message"),
  errorStack: text("error_stack"),
  
  warningsGenerated: jsonb("warnings_generated"), // [{ type, message }, ...]
  
  skippedReason: text("skipped_reason"),
  
  retriedCount: integer("retried_count").default(0),
  retriedAt: timestamp("retried_at"),
  
  triggeredBy: varchar("triggered_by"), // user-id, system, scheduler
  triggeredByEvent: varchar("triggered_by_event"), // contract_end, meter_submitted, manual_request
  
  sentToCustomer: boolean("sent_to_customer").default(false),
  sentAt: timestamp("sent_at"),
  
  metadata: jsonb("metadata"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("invoice_gen_logs_tenant_id_idx").on(table.tenantId),
  tenantBatchIdx: index("invoice_gen_logs_tenant_batch_idx").on(table.tenantId, table.batchId),
  tenantStatusIdx: index("invoice_gen_logs_tenant_status_idx").on(table.tenantId, table.status),
  tenantInvoiceIdx: index("invoice_gen_logs_tenant_invoice_idx").on(table.tenantId, table.invoiceId),
  tenantCustomerIdx: index("invoice_gen_logs_tenant_customer_idx").on(table.tenantId, table.customerId),
}));

export const billingSchedules = pgTable("billing_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  scheduleName: varchar("schedule_name").notNull(),
  scheduleDescription: text("schedule_description"),
  
  scheduleType: varchar("schedule_type").notNull(), // recurring, one_time
  frequency: varchar("frequency").notNull(), // daily, weekly, monthly, quarterly, annual
  
  contractId: varchar("contract_id"),
  customerId: varchar("customer_id"),
  
  dayOfMonth: integer("day_of_month"), // 1-31 for monthly billing
  dayOfWeek: integer("day_of_week"), // 0-6 for weekly billing
  
  billingCutoffDay: integer("billing_cutoff_day"), // Day before billing period ends
  
  nextRunDate: timestamp("next_run_date").notNull(),
  lastRunDate: timestamp("last_run_date"),
  
  isActive: boolean("is_active").default(true),
  
  autoSendInvoice: boolean("auto_send_invoice").default(false),
  autoApplyLateFees: boolean("auto_apply_late_fees").default(false),
  
  notifyBeforeDays: integer("notify_before_days").default(3),
  
  metadata: jsonb("metadata"),
  
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("billing_schedules_tenant_id_idx").on(table.tenantId),
  tenantActiveIdx: index("billing_schedules_tenant_active_idx").on(table.tenantId, table.isActive),
  tenantContractIdx: index("billing_schedules_tenant_contract_idx").on(table.tenantId, table.contractId),
  tenantNextRunIdx: index("billing_schedules_tenant_next_run_idx").on(table.tenantId, table.nextRunDate),
}));

export const creditMemos = pgTable("credit_memos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  creditMemoNumber: varchar("credit_memo_number").unique().notNull(),
  
  customerId: varchar("customer_id").notNull(),
  invoiceId: varchar("invoice_id"),
  disputeId: varchar("dispute_id"),
  
  creditAmount: decimal("credit_amount", { precision: 10, scale: 2 }).notNull(),
  creditReason: varchar("credit_reason").notNull(), // billing_error, dispute_resolution, goodwill, service_failure
  creditDescription: text("credit_description"),
  
  creditStatus: varchar("credit_status").default("pending"), // pending, approved, issued, applied, voided
  
  appliedToInvoice: boolean("applied_to_invoice").default(false),
  appliedToInvoiceId: varchar("applied_to_invoice_id"),
  appliedAt: timestamp("applied_at"),
  
  issuedDate: timestamp("issued_date").notNull(),
  expirationDate: timestamp("expiration_date"),
  
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  
  voidedBy: varchar("voided_by"),
  voidedAt: timestamp("voided_at"),
  voidReason: text("void_reason"),
  
  metadata: jsonb("metadata"),
  
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdIdx: index("credit_memos_tenant_id_idx").on(table.tenantId),
  tenantStatusIdx: index("credit_memos_tenant_status_idx").on(table.tenantId, table.creditStatus),
  tenantCustomerIdx: index("credit_memos_tenant_customer_idx").on(table.tenantId, table.customerId),
  tenantInvoiceIdx: index("credit_memos_tenant_invoice_idx").on(table.tenantId, table.invoiceId),
  tenantMemoNumIdx: index("credit_memos_tenant_memo_num_idx").on(table.tenantId, table.creditMemoNumber),
}));

export const insertBillingRuleSchema = createInsertSchema(billingRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMeterAnomalySchema = createInsertSchema(meterAnomalies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBillingDisputeSchema = createInsertSchema(billingDisputes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInvoiceGenerationLogSchema = createInsertSchema(invoiceGenerationLogs).omit({
  id: true,
  createdAt: true,
});

export const insertBillingScheduleSchema = createInsertSchema(billingSchedules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreditMemoSchema = createInsertSchema(creditMemos).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type BillingRule = typeof billingRules.$inferSelect;
export type InsertBillingRule = z.infer<typeof insertBillingRuleSchema>;

export type MeterAnomaly = typeof meterAnomalies.$inferSelect;
export type InsertMeterAnomaly = z.infer<typeof insertMeterAnomalySchema>;

export type BillingDispute = typeof billingDisputes.$inferSelect;
export type InsertBillingDispute = z.infer<typeof insertBillingDisputeSchema>;

export type InvoiceGenerationLog = typeof invoiceGenerationLogs.$inferSelect;
export type InsertInvoiceGenerationLog = z.infer<typeof insertInvoiceGenerationLogSchema>;

export type BillingSchedule = typeof billingSchedules.$inferSelect;
export type InsertBillingSchedule = z.infer<typeof insertBillingScheduleSchema>;

export type CreditMemo = typeof creditMemos.$inferSelect;
export type InsertCreditMemo = z.infer<typeof insertCreditMemoSchema>;
