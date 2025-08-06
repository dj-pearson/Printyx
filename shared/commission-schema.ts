/**
 * Commission Management Schema
 * Complete database structure for commission tracking, calculations, and management
 */
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

// Enums
export const planTypeEnum = pgEnum('plan_type', [
  'sales_rep',
  'sales_manager', 
  'service_tech',
  'account_manager',
  'inside_sales',
  'field_sales'
]);

export const paymentFrequencyEnum = pgEnum('payment_frequency', [
  'weekly',
  'bi_weekly', 
  'monthly',
  'quarterly',
  'annually'
]);

export const calculationStatusEnum = pgEnum('calculation_status', [
  'draft',
  'calculated',
  'approved', 
  'paid',
  'disputed',
  'cancelled'
]);

export const disputeStatusEnum = pgEnum('dispute_status', [
  'submitted',
  'under_review',
  'escalated',
  'resolved',
  'rejected',
  'closed'
]);

export const disputeTypeEnum = pgEnum('dispute_type', [
  'calculation_error',
  'split_commission',
  'chargeback_dispute',
  'rate_dispute',
  'quota_dispute',
  'bonus_dispute'
]);

export const adjustmentTypeEnum = pgEnum('adjustment_type', [
  'chargeback',
  'bonus',
  'penalty',
  'correction',
  'manual_adjustment',
  'split_adjustment'
]);

// Commission Plans Table
export const commissionPlans = pgTable("commission_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  planName: varchar("plan_name").notNull(),
  planType: planTypeEnum("plan_type").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  effectiveDate: timestamp("effective_date").notNull(),
  endDate: timestamp("end_date"), // null means no end date
  
  // Payment settings
  paymentFrequency: paymentFrequencyEnum("payment_frequency").notNull().default('monthly'),
  paymentDelay: integer("payment_delay").notNull().default(30), // days after qualifying event
  minimumCommissionPayment: decimal("minimum_commission_payment", { precision: 10, scale: 2 }).default('0.00'),
  
  // Rules and settings
  splitCommissionAllowed: boolean("split_commission_allowed").notNull().default(false),
  chargebackEnabled: boolean("chargeback_enabled").notNull().default(true),
  chargebackPeriod: integer("chargeback_period").notNull().default(90), // days
  
  // Metadata
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
  createdBy: varchar("created_by").notNull(),
  updatedBy: varchar("updated_by")
}, (table) => ({
  tenantIdIdx: index("commission_plans_tenant_id_idx").on(table.tenantId),
  activeIdx: index("commission_plans_active_idx").on(table.isActive),
  effectiveDateIdx: index("commission_plans_effective_date_idx").on(table.effectiveDate)
}));

// Commission Plan Tiers
export const commissionPlanTiers = pgTable("commission_plan_tiers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").notNull(),
  tierLevel: integer("tier_level").notNull(),
  tierName: varchar("tier_name").notNull(),
  minimumSales: decimal("minimum_sales", { precision: 15, scale: 2 }).notNull().default('0.00'),
  maximumSales: decimal("maximum_sales", { precision: 15, scale: 2 }), // null = no maximum
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).notNull(), // percentage
  bonusThreshold: decimal("bonus_threshold", { precision: 15, scale: 2 }),
  bonusAmount: decimal("bonus_amount", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
}, (table) => ({
  planIdIdx: index("commission_plan_tiers_plan_id_idx").on(table.planId),
  tierLevelIdx: index("commission_plan_tiers_tier_level_idx").on(table.tierLevel)
}));

// Product Category Rates
export const commissionProductRates = pgTable("commission_product_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: varchar("plan_id").notNull(),
  category: varchar("category").notNull(), // new_equipment, used_equipment, service_contracts, supplies, software, billable_hours, parts_markup, addon_sales
  categoryName: varchar("category_name").notNull(),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).notNull(), // percentage
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
}, (table) => ({
  planIdIdx: index("commission_product_rates_plan_id_idx").on(table.planId),
  categoryIdx: index("commission_product_rates_category_idx").on(table.category)
}));

// Employee Commission Assignments
export const employeeCommissionAssignments = pgTable("employee_commission_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  employeeId: varchar("employee_id").notNull(), // references users.id
  planId: varchar("plan_id").notNull(),
  effectiveDate: timestamp("effective_date").notNull(),
  endDate: timestamp("end_date"), // null means current assignment
  quotaTarget: decimal("quota_target", { precision: 15, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  
  // Override settings per employee
  customRates: jsonb("custom_rates"), // Override specific rates if needed
  
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
  assignedBy: varchar("assigned_by").notNull()
}, (table) => ({
  tenantIdIdx: index("employee_commission_assignments_tenant_id_idx").on(table.tenantId),
  employeeIdIdx: index("employee_commission_assignments_employee_id_idx").on(table.employeeId),
  planIdIdx: index("employee_commission_assignments_plan_id_idx").on(table.planId),
  activeIdx: index("employee_commission_assignments_active_idx").on(table.isActive),
  effectiveDateIdx: index("employee_commission_assignments_effective_date_idx").on(table.effectiveDate)
}));

// Commission Calculations (Main calculations per period)
export const commissionCalculations = pgTable("commission_calculations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  employeeId: varchar("employee_id").notNull(),
  planId: varchar("plan_id").notNull(),
  calculationPeriodStart: timestamp("calculation_period_start").notNull(),
  calculationPeriodEnd: timestamp("calculation_period_end").notNull(),
  periodName: varchar("period_name").notNull(), // "January 2025", "Q1 2025", etc.
  
  // Sales metrics for the period
  totalSales: decimal("total_sales", { precision: 15, scale: 2 }).notNull().default('0.00'),
  quotaTarget: decimal("quota_target", { precision: 15, scale: 2 }),
  quotaAchievement: decimal("quota_achievement", { precision: 5, scale: 2 }), // percentage
  
  // Calculation results
  grossCommission: decimal("gross_commission", { precision: 12, scale: 2 }).notNull().default('0.00'),
  totalBonuses: decimal("total_bonuses", { precision: 12, scale: 2 }).notNull().default('0.00'),
  totalAdjustments: decimal("total_adjustments", { precision: 12, scale: 2 }).notNull().default('0.00'),
  netCommission: decimal("net_commission", { precision: 12, scale: 2 }).notNull().default('0.00'),
  
  // Status and processing
  status: calculationStatusEnum("status").notNull().default('draft'),
  calculatedAt: timestamp("calculated_at").default(sql`now()`),
  approvedAt: timestamp("approved_at"),
  paidAt: timestamp("paid_at"),
  payoutDate: timestamp("payout_date"),
  
  // Metadata
  calculatedBy: varchar("calculated_by"),
  approvedBy: varchar("approved_by"),
  notes: text("notes"),
  
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
}, (table) => ({
  tenantIdIdx: index("commission_calculations_tenant_id_idx").on(table.tenantId),
  employeeIdIdx: index("commission_calculations_employee_id_idx").on(table.employeeId),
  planIdIdx: index("commission_calculations_plan_id_idx").on(table.planId),
  statusIdx: index("commission_calculations_status_idx").on(table.status),
  periodIdx: index("commission_calculations_period_idx").on(table.calculationPeriodStart, table.calculationPeriodEnd),
  payoutDateIdx: index("commission_calculations_payout_date_idx").on(table.payoutDate)
}));

// Commission Calculation Details (breakdown by category)
export const commissionCalculationDetails = pgTable("commission_calculation_details", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  calculationId: varchar("calculation_id").notNull(),
  category: varchar("category").notNull(),
  categoryName: varchar("category_name").notNull(),
  salesAmount: decimal("sales_amount", { precision: 15, scale: 2 }).notNull().default('0.00'),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).notNull(),
  commissionAmount: decimal("commission_amount", { precision: 12, scale: 2 }).notNull().default('0.00'),
  description: text("description"),
  
  // Additional metrics for service techs
  billableHours: decimal("billable_hours", { precision: 8, scale: 2 }),
  hourlyRate: decimal("hourly_rate", { precision: 8, scale: 2 }),
  
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
}, (table) => ({
  calculationIdIdx: index("commission_calculation_details_calculation_id_idx").on(table.calculationId),
  categoryIdx: index("commission_calculation_details_category_idx").on(table.category)
}));

// Commission Bonuses (tier bonuses, quota bonuses, etc.)
export const commissionBonuses = pgTable("commission_bonuses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  calculationId: varchar("calculation_id").notNull(),
  bonusType: varchar("bonus_type").notNull(), // tier_bonus, quota_bonus, performance_bonus, etc.
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  eligibilityMet: boolean("eligibility_met").notNull().default(false),
  
  // Eligibility criteria (stored as JSON for flexibility)
  eligibilityCriteria: jsonb("eligibility_criteria"),
  
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
}, (table) => ({
  calculationIdIdx: index("commission_bonuses_calculation_id_idx").on(table.calculationId),
  bonusTypeIdx: index("commission_bonuses_bonus_type_idx").on(table.bonusType)
}));

// Commission Adjustments (chargebacks, corrections, etc.)
export const commissionAdjustments = pgTable("commission_adjustments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  calculationId: varchar("calculation_id"), // can be null for standalone adjustments
  employeeId: varchar("employee_id").notNull(),
  adjustmentType: adjustmentTypeEnum("adjustment_type").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(), // can be positive or negative
  reason: text("reason").notNull(),
  description: text("description"),
  
  // Reference information
  referenceType: varchar("reference_type"), // quote, invoice, contract, etc.
  referenceId: varchar("reference_id"),
  referenceName: varchar("reference_name"),
  
  // Processing information
  isProcessed: boolean("is_processed").notNull().default(false),
  processedAt: timestamp("processed_at"),
  processedBy: varchar("processed_by"),
  
  // Approval workflow
  requiresApproval: boolean("requires_approval").notNull().default(true),
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by"),
  
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
  createdBy: varchar("created_by").notNull()
}, (table) => ({
  tenantIdIdx: index("commission_adjustments_tenant_id_idx").on(table.tenantId),
  calculationIdIdx: index("commission_adjustments_calculation_id_idx").on(table.calculationId),
  employeeIdIdx: index("commission_adjustments_employee_id_idx").on(table.employeeId),
  adjustmentTypeIdx: index("commission_adjustments_adjustment_type_idx").on(table.adjustmentType),
  processedIdx: index("commission_adjustments_processed_idx").on(table.isProcessed)
}));

// Commission Disputes
export const commissionDisputes = pgTable("commission_disputes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  disputeNumber: varchar("dispute_number").notNull().unique(),
  calculationId: varchar("calculation_id").notNull(),
  employeeId: varchar("employee_id").notNull(),
  
  // Dispute details
  disputeType: disputeTypeEnum("dispute_type").notNull(),
  status: disputeStatusEnum("status").notNull().default('submitted'),
  priority: varchar("priority").notNull().default('medium'), // low, medium, high, urgent
  
  // Amounts
  disputedAmount: decimal("disputed_amount", { precision: 12, scale: 2 }).notNull(),
  expectedAmount: decimal("expected_amount", { precision: 12, scale: 2 }).notNull(),
  difference: decimal("difference", { precision: 12, scale: 2 }).notNull(),
  
  // Description and reasoning
  description: text("description").notNull(),
  employeeComments: text("employee_comments"),
  managerComments: text("manager_comments"),
  
  // Assignment and resolution
  assignedTo: varchar("assigned_to"), // manager or admin user ID
  estimatedResolution: timestamp("estimated_resolution"),
  actualResolution: timestamp("actual_resolution"),
  resolutionType: varchar("resolution_type"), // adjustment_approved, dispute_rejected, partial_adjustment, etc.
  adjustmentAmount: decimal("adjustment_amount", { precision: 12, scale: 2 }),
  resolutionNotes: text("resolution_notes"),
  
  // Tracking
  submittedDate: timestamp("submitted_date").notNull().default(sql`now()`),
  lastUpdated: timestamp("last_updated").notNull().default(sql`now()`),
  submittedBy: varchar("submitted_by").notNull(),
  resolvedBy: varchar("resolved_by"),
  
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
}, (table) => ({
  tenantIdIdx: index("commission_disputes_tenant_id_idx").on(table.tenantId),
  disputeNumberIdx: index("commission_disputes_dispute_number_idx").on(table.disputeNumber),
  calculationIdIdx: index("commission_disputes_calculation_id_idx").on(table.calculationId),
  employeeIdIdx: index("commission_disputes_employee_id_idx").on(table.employeeId),
  statusIdx: index("commission_disputes_status_idx").on(table.status),
  assignedToIdx: index("commission_disputes_assigned_to_idx").on(table.assignedTo)
}));

// Commission Dispute History (audit trail)
export const commissionDisputeHistory = pgTable("commission_dispute_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  disputeId: varchar("dispute_id").notNull(),
  action: varchar("action").notNull(), // dispute_submitted, assigned_to_manager, under_review, resolved, etc.
  user: varchar("user").notNull(),
  userId: varchar("user_id"),
  description: text("description").notNull(),
  previousStatus: disputeStatusEnum("previous_status"),
  newStatus: disputeStatusEnum("new_status"),
  metadata: jsonb("metadata"), // Additional context data
  
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
}, (table) => ({
  disputeIdIdx: index("commission_dispute_history_dispute_id_idx").on(table.disputeId),
  actionIdx: index("commission_dispute_history_action_idx").on(table.action),
  createdAtIdx: index("commission_dispute_history_created_at_idx").on(table.createdAt)
}));

// Commission Sales Transactions (links commissions to actual sales)
export const commissionSalesTransactions = pgTable("commission_sales_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  calculationId: varchar("calculation_id"),
  employeeId: varchar("employee_id").notNull(),
  
  // Transaction details
  transactionType: varchar("transaction_type").notNull(), // quote, invoice, contract, service_call
  transactionId: varchar("transaction_id").notNull(), // ID of the quote, invoice, etc.
  transactionNumber: varchar("transaction_number"),
  transactionDate: timestamp("transaction_date").notNull(),
  
  // Customer information
  customerId: varchar("customer_id"),
  customerName: varchar("customer_name"),
  
  // Financial details
  saleAmount: decimal("sale_amount", { precision: 15, scale: 2 }).notNull(),
  commissionableAmount: decimal("commissionable_amount", { precision: 15, scale: 2 }).notNull(),
  category: varchar("category").notNull(), // new_equipment, used_equipment, service_contracts, etc.
  
  // Commission calculation
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).notNull(),
  commissionAmount: decimal("commission_amount", { precision: 12, scale: 2 }).notNull(),
  
  // Split commission handling
  isSplitCommission: boolean("is_split_commission").notNull().default(false),
  splitPercentage: decimal("split_percentage", { precision: 5, scale: 2 }).default('100.00'),
  primaryEmployeeId: varchar("primary_employee_id"), // If this is a split, who's the primary
  
  // Status and processing
  isProcessed: boolean("is_processed").notNull().default(false),
  processedAt: timestamp("processed_at"),
  isChargedBack: boolean("is_charged_back").notNull().default(false),
  chargedBackAt: timestamp("charged_back_at"),
  chargebackReason: text("chargeback_reason"),
  
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
}, (table) => ({
  tenantIdIdx: index("commission_sales_transactions_tenant_id_idx").on(table.tenantId),
  calculationIdIdx: index("commission_sales_transactions_calculation_id_idx").on(table.calculationId),
  employeeIdIdx: index("commission_sales_transactions_employee_id_idx").on(table.employeeId),
  transactionTypeIdx: index("commission_sales_transactions_transaction_type_idx").on(table.transactionType),
  transactionIdIdx: index("commission_sales_transactions_transaction_id_idx").on(table.transactionId),
  transactionDateIdx: index("commission_sales_transactions_transaction_date_idx").on(table.transactionDate),
  processedIdx: index("commission_sales_transactions_processed_idx").on(table.isProcessed),
  chargedBackIdx: index("commission_sales_transactions_charged_back_idx").on(table.isChargedBack)
}));

// Relations
export const commissionPlansRelations = relations(commissionPlans, ({ many, one }) => ({
  tiers: many(commissionPlanTiers),
  productRates: many(commissionProductRates),
  assignments: many(employeeCommissionAssignments),
  calculations: many(commissionCalculations),
}));

export const commissionPlanTiersRelations = relations(commissionPlanTiers, ({ one }) => ({
  plan: one(commissionPlans, {
    fields: [commissionPlanTiers.planId],
    references: [commissionPlans.id],
  }),
}));

export const commissionProductRatesRelations = relations(commissionProductRates, ({ one }) => ({
  plan: one(commissionPlans, {
    fields: [commissionProductRates.planId],
    references: [commissionPlans.id],
  }),
}));

export const employeeCommissionAssignmentsRelations = relations(employeeCommissionAssignments, ({ one, many }) => ({
  plan: one(commissionPlans, {
    fields: [employeeCommissionAssignments.planId],
    references: [commissionPlans.id],
  }),
  calculations: many(commissionCalculations),
}));

export const commissionCalculationsRelations = relations(commissionCalculations, ({ one, many }) => ({
  plan: one(commissionPlans, {
    fields: [commissionCalculations.planId],
    references: [commissionPlans.id],
  }),
  assignment: one(employeeCommissionAssignments, {
    fields: [commissionCalculations.employeeId],
    references: [employeeCommissionAssignments.employeeId],
  }),
  details: many(commissionCalculationDetails),
  bonuses: many(commissionBonuses),
  adjustments: many(commissionAdjustments),
  disputes: many(commissionDisputes),
  salesTransactions: many(commissionSalesTransactions),
}));

export const commissionCalculationDetailsRelations = relations(commissionCalculationDetails, ({ one }) => ({
  calculation: one(commissionCalculations, {
    fields: [commissionCalculationDetails.calculationId],
    references: [commissionCalculations.id],
  }),
}));

export const commissionBonusesRelations = relations(commissionBonuses, ({ one }) => ({
  calculation: one(commissionCalculations, {
    fields: [commissionBonuses.calculationId],
    references: [commissionCalculations.id],
  }),
}));

export const commissionAdjustmentsRelations = relations(commissionAdjustments, ({ one }) => ({
  calculation: one(commissionCalculations, {
    fields: [commissionAdjustments.calculationId],
    references: [commissionCalculations.id],
  }),
}));

export const commissionDisputesRelations = relations(commissionDisputes, ({ one, many }) => ({
  calculation: one(commissionCalculations, {
    fields: [commissionDisputes.calculationId],
    references: [commissionCalculations.id],
  }),
  history: many(commissionDisputeHistory),
}));

export const commissionDisputeHistoryRelations = relations(commissionDisputeHistory, ({ one }) => ({
  dispute: one(commissionDisputes, {
    fields: [commissionDisputeHistory.disputeId],
    references: [commissionDisputes.id],
  }),
}));

export const commissionSalesTransactionsRelations = relations(commissionSalesTransactions, ({ one }) => ({
  calculation: one(commissionCalculations, {
    fields: [commissionSalesTransactions.calculationId],
    references: [commissionCalculations.id],
  }),
}));

// Zod schemas for validation
export const insertCommissionPlanSchema = createInsertSchema(commissionPlans);
export const insertCommissionPlanTierSchema = createInsertSchema(commissionPlanTiers);
export const insertCommissionProductRateSchema = createInsertSchema(commissionProductRates);
export const insertEmployeeCommissionAssignmentSchema = createInsertSchema(employeeCommissionAssignments);
export const insertCommissionCalculationSchema = createInsertSchema(commissionCalculations);
export const insertCommissionCalculationDetailSchema = createInsertSchema(commissionCalculationDetails);
export const insertCommissionBonusSchema = createInsertSchema(commissionBonuses);
export const insertCommissionAdjustmentSchema = createInsertSchema(commissionAdjustments);
export const insertCommissionDisputeSchema = createInsertSchema(commissionDisputes);
export const insertCommissionDisputeHistorySchema = createInsertSchema(commissionDisputeHistory);
export const insertCommissionSalesTransactionSchema = createInsertSchema(commissionSalesTransactions);

// TypeScript types
export type CommissionPlan = typeof commissionPlans.$inferSelect;
export type InsertCommissionPlan = typeof commissionPlans.$inferInsert;

export type CommissionPlanTier = typeof commissionPlanTiers.$inferSelect;
export type InsertCommissionPlanTier = typeof commissionPlanTiers.$inferInsert;

export type CommissionProductRate = typeof commissionProductRates.$inferSelect;
export type InsertCommissionProductRate = typeof commissionProductRates.$inferInsert;

export type EmployeeCommissionAssignment = typeof employeeCommissionAssignments.$inferSelect;
export type InsertEmployeeCommissionAssignment = typeof employeeCommissionAssignments.$inferInsert;

export type CommissionCalculation = typeof commissionCalculations.$inferSelect;
export type InsertCommissionCalculation = typeof commissionCalculations.$inferInsert;

export type CommissionCalculationDetail = typeof commissionCalculationDetails.$inferSelect;
export type InsertCommissionCalculationDetail = typeof commissionCalculationDetails.$inferInsert;

export type CommissionBonus = typeof commissionBonuses.$inferSelect;
export type InsertCommissionBonus = typeof commissionBonuses.$inferInsert;

export type CommissionAdjustment = typeof commissionAdjustments.$inferSelect;
export type InsertCommissionAdjustment = typeof commissionAdjustments.$inferInsert;

export type CommissionDispute = typeof commissionDisputes.$inferSelect;
export type InsertCommissionDispute = typeof commissionDisputes.$inferInsert;

export type CommissionDisputeHistory = typeof commissionDisputeHistory.$inferSelect;
export type InsertCommissionDisputeHistory = typeof commissionDisputeHistory.$inferInsert;

export type CommissionSalesTransaction = typeof commissionSalesTransactions.$inferSelect;
export type InsertCommissionSalesTransaction = typeof commissionSalesTransactions.$inferInsert;