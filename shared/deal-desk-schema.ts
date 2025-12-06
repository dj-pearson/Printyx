/**
 * Deal Desk & Approval Workflow Schema
 * Enterprise-grade pricing governance and approval management
 */
import { sql } from 'drizzle-orm';
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

// ==================== Enums ====================

export const approvalTypeEnum = pgEnum('approval_type', [
  'discount',
  'custom_pricing',
  'payment_terms',
  'contract_terms',
  'deal_structure',
  'pricing_exception',
  'waived_fees',
  'custom_package'
]);

export const approvalStatusEnum = pgEnum('approval_status', [
  'pending',
  'in_review',
  'approved',
  'rejected',
  'escalated',
  'cancelled',
  'expired'
]);

export const approvalChainTypeEnum = pgEnum('approval_chain_type', [
  'sequential',    // Must approve in order
  'parallel',      // All must approve simultaneously
  'conditional',   // Dynamic based on conditions
  'any_one'        // Any single approver can approve
]);

export const thresholdTypeEnum = pgEnum('threshold_type', [
  'discount_percentage',
  'discount_amount',
  'margin_below',
  'deal_value',
  'total_contract_value',
  'payment_terms_days',
  'custom_field'
]);

// ==================== Approval Rules ====================

export const approvalRules = pgTable("approval_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),

  // Rule Details
  ruleName: varchar("rule_name", { length: 255 }).notNull(),
  description: text("description"),
  ruleType: approvalTypeEnum("rule_type").notNull(),

  // Threshold Configuration
  thresholdType: thresholdTypeEnum("threshold_type").notNull(),
  thresholdValue: decimal("threshold_value", { precision: 15, scale: 2 }).notNull(),
  comparisonOperator: varchar("comparison_operator", { length: 20 }).notNull(), // >, <, >=, <=, ==, !=

  // Conditions (optional - for complex rules)
  conditions: jsonb("conditions").$type<Array<{
    field: string;
    operator: string;
    value: any;
    logicalOperator?: 'AND' | 'OR';
  }>>(),

  // Approval Chain Configuration
  approvalChainType: approvalChainTypeEnum("approval_chain_type").notNull(),
  approvers: jsonb("approvers").$type<Array<{
    level: number;
    roleId?: string;
    roleName?: string;
    userId?: string;
    userName?: string;
    isRequired: boolean;
    canDelegate: boolean;
  }>>().notNull(),

  // SLA Configuration
  slaHours: integer("sla_hours").default(24),
  escalationEnabled: boolean("escalation_enabled").default(true),
  escalateToRoleId: varchar("escalate_to_role_id"),
  escalateToUserId: varchar("escalate_to_user_id"),

  // Notifications
  notifyOnCreation: boolean("notify_on_creation").default(true),
  notifyOnApproval: boolean("notify_on_approval").default(true),
  notifyOnRejection: boolean("notify_on_rejection").default(true),
  notifyOnEscalation: boolean("notify_on_escalation").default(true),

  // Priority & Order
  priority: integer("priority").default(0), // Higher priority rules checked first
  order: integer("order").default(0),

  // Settings
  isActive: boolean("is_active").default(true),
  allowSkipForRole: varchar("allow_skip_for_role"), // Certain roles can bypass this rule

  // Metadata
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdx: index('approval_rules_tenant_idx').on(table.tenantId),
  tenantActiveIdx: index('approval_rules_tenant_active_idx').on(table.tenantId, table.isActive),
  ruleTypeIdx: index('approval_rules_rule_type_idx').on(table.ruleType),
  priorityIdx: index('approval_rules_priority_idx').on(table.priority),
}));

// ==================== Approval Requests ====================

export const approvalRequests = pgTable("approval_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),

  // Request Context
  dealId: varchar("deal_id"),
  quoteId: varchar("quote_id"),
  opportunityId: varchar("opportunity_id"),
  customerId: varchar("customer_id"),

  // Request Details
  requestType: approvalTypeEnum("request_type").notNull(),
  requestTitle: varchar("request_title", { length: 500 }).notNull(),
  requestDescription: text("request_description"),

  // Requester Information
  requestedBy: varchar("requested_by").notNull(),
  requestedByName: varchar("requested_by_name"),
  requestedByRole: varchar("requested_by_role"),

  // Pricing Details
  originalPrice: decimal("original_price", { precision: 15, scale: 2 }),
  proposedPrice: decimal("proposed_price", { precision: 15, scale: 2 }),
  discountAmount: decimal("discount_amount", { precision: 15, scale: 2 }),
  discountPercentage: decimal("discount_percentage", { precision: 5, scale: 2 }),

  originalMargin: decimal("original_margin", { precision: 5, scale: 2 }),
  proposedMargin: decimal("proposed_margin", { precision: 5, scale: 2 }),

  dealValue: decimal("deal_value", { precision: 15, scale: 2 }),
  totalContractValue: decimal("total_contract_value", { precision: 15, scale: 2 }),

  // Business Justification
  businessJustification: text("business_justification").notNull(),
  competitiveContext: text("competitive_context"),
  strategicRationale: text("strategic_rationale"),
  riskAssessment: text("risk_assessment"),

  // Custom Terms (if applicable)
  customTerms: jsonb("custom_terms").$type<{
    paymentTerms?: string;
    contractLength?: number;
    specialConditions?: string[];
    additionalServices?: Array<{ service: string; value: number }>;
  }>(),

  // Status & Workflow
  status: approvalStatusEnum("status").notNull().default('pending'),
  currentApprovalLevel: integer("current_approval_level").default(1),

  // Approval Chain (tracks all approvers)
  approvalChain: jsonb("approval_chain").$type<Array<{
    level: number;
    approverId: string;
    approverName: string;
    approverRole: string;
    status: 'pending' | 'approved' | 'rejected' | 'skipped';
    decision?: 'approve' | 'reject' | 'request_changes';
    comments?: string;
    decidedAt?: string;
    delegatedTo?: string;
  }>>().notNull(),

  // SLA & Timing
  slaDeadline: timestamp("sla_deadline"),
  slaBreached: boolean("sla_breached").default(false),
  escalatedAt: timestamp("escalated_at"),
  escalatedTo: varchar("escalated_to"),

  // Decision
  finalDecision: varchar("final_decision", { length: 50 }), // approved, rejected
  finalDecisionBy: varchar("final_decision_by"),
  finalDecisionAt: timestamp("final_decision_at"),
  finalDecisionComments: text("final_decision_comments"),

  // Outcome Tracking
  approvedDiscountPercentage: decimal("approved_discount_percentage", { precision: 5, scale: 2 }),
  approvedMargin: decimal("approved_margin", { precision: 5, scale: 2 }),
  conditionsAttached: jsonb("conditions_attached").$type<Array<{
    condition: string;
    required: boolean;
    completedBy?: string;
    completedAt?: string;
  }>>(),

  // Audit Trail
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  firstReviewedAt: timestamp("first_reviewed_at"),
  completedAt: timestamp("completed_at"),

  // Activity Log
  activityLog: jsonb("activity_log").$type<Array<{
    timestamp: string;
    actor: string;
    action: string;
    details: string;
    metadata?: Record<string, any>;
  }>>().default([]),

  // Notifications
  notificationsSent: jsonb("notifications_sent").$type<Array<{
    type: string;
    recipientId: string;
    sentAt: string;
    channel: 'email' | 'sms' | 'push';
  }>>().default([]),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  tenantIdx: index('approval_requests_tenant_idx').on(table.tenantId),
  dealIdx: index('approval_requests_deal_idx').on(table.dealId),
  quoteIdx: index('approval_requests_quote_idx').on(table.quoteId),
  requestedByIdx: index('approval_requests_requested_by_idx').on(table.requestedBy),
  statusIdx: index('approval_requests_status_idx').on(table.status),
  tenantStatusIdx: index('approval_requests_tenant_status_idx').on(table.tenantId, table.status),
  slaDeadlineIdx: index('approval_requests_sla_deadline_idx').on(table.slaDeadline),
  submittedAtIdx: index('approval_requests_submitted_at_idx').on(table.submittedAt),
}));

// ==================== Approval Comments & Discussions ====================

export const approvalComments = pgTable("approval_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  approvalRequestId: varchar("approval_request_id").notNull(),

  // Comment Details
  commentText: text("comment_text").notNull(),
  commentType: varchar("comment_type", { length: 50 }).default('general'), // general, question, clarification, objection, approval_note

  // Author
  authorId: varchar("author_id").notNull(),
  authorName: varchar("author_name"),
  authorRole: varchar("author_role"),

  // Threading
  parentCommentId: varchar("parent_comment_id"), // For replies

  // Visibility
  isInternal: boolean("is_internal").default(false), // Internal vs. visible to requester
  visibleToRoles: text("visible_to_roles").array(),

  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  approvalRequestIdx: index('approval_comments_request_idx').on(table.approvalRequestId),
  tenantRequestIdx: index('approval_comments_tenant_request_idx').on(table.tenantId, table.approvalRequestId),
  authorIdx: index('approval_comments_author_idx').on(table.authorId),
}));

// ==================== Discount Analytics ====================

export const discountAnalytics = pgTable("discount_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),

  // Time Period
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  periodType: varchar("period_type", { length: 20 }).notNull(), // daily, weekly, monthly, quarterly

  // Aggregation Level
  aggregationLevel: varchar("aggregation_level", { length: 50 }).notNull(), // tenant, user, team, product, region
  aggregationId: varchar("aggregation_id"),

  // Discount Metrics
  totalRequests: integer("total_requests").default(0),
  approvedRequests: integer("approved_requests").default(0),
  rejectedRequests: integer("rejected_requests").default(0),
  pendingRequests: integer("pending_requests").default(0),

  approvalRate: decimal("approval_rate", { precision: 5, scale: 2 }),
  averageDiscountRequested: decimal("average_discount_requested", { precision: 5, scale: 2 }),
  averageDiscountApproved: decimal("average_discount_approved", { precision: 5, scale: 2 }),

  // Value Impact
  totalValueAtRisk: decimal("total_value_at_risk", { precision: 15, scale: 2 }),
  totalValueApproved: decimal("total_value_approved", { precision: 15, scale: 2 }),
  totalRevenueImpact: decimal("total_revenue_impact", { precision: 15, scale: 2 }),
  totalMarginImpact: decimal("total_margin_impact", { precision: 15, scale: 2 }),

  // Timing Metrics
  averageApprovalTimeHours: decimal("average_approval_time_hours", { precision: 8, scale: 2 }),
  slaBreachCount: integer("sla_breach_count").default(0),
  slaBreachRate: decimal("sla_breach_rate", { precision: 5, scale: 2 }),

  // Win Rate Correlation
  dealsWithDiscount: integer("deals_with_discount").default(0),
  dealsWithoutDiscount: integer("deals_without_discount").default(0),
  winRateWithDiscount: decimal("win_rate_with_discount", { precision: 5, scale: 2 }),
  winRateWithoutDiscount: decimal("win_rate_without_discount", { precision: 5, scale: 2 }),

  // Top Approvers
  topApprovers: jsonb("top_approvers").$type<Array<{
    approverId: string;
    approverName: string;
    requestsReviewed: number;
    approvalRate: number;
    avgTimeToDecision: number;
  }>>(),

  calculatedAt: timestamp("calculated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  tenantIdx: index('discount_analytics_tenant_idx').on(table.tenantId),
  periodIdx: index('discount_analytics_period_idx').on(table.periodStart, table.periodEnd),
  aggregationIdx: index('discount_analytics_aggregation_idx').on(table.aggregationLevel, table.aggregationId),
}));

// ==================== Approval Delegation ====================

export const approvalDelegations = pgTable("approval_delegations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),

  // Delegation Details
  delegatorId: varchar("delegator_id").notNull(), // Who is delegating
  delegateId: varchar("delegate_id").notNull(),   // Who receives authority

  // Scope
  delegationType: varchar("delegation_type", { length: 50 }).notNull(), // full, limited, specific_rules
  approvalRuleIds: text("approval_rule_ids").array(), // Specific rules if limited
  maxDiscountPercentage: decimal("max_discount_percentage", { precision: 5, scale: 2 }),
  maxDealValue: decimal("max_deal_value", { precision: 15, scale: 2 }),

  // Time Period
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),

  // Status
  isActive: boolean("is_active").default(true),
  reason: text("reason"), // PTO, busy, temporary assignment, etc.

  // Audit
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  delegatorIdx: index('approval_delegations_delegator_idx').on(table.delegatorId),
  delegateIdx: index('approval_delegations_delegate_idx').on(table.delegateId),
  tenantActiveIdx: index('approval_delegations_tenant_active_idx').on(table.tenantId, table.isActive),
  dateRangeIdx: index('approval_delegations_date_range_idx').on(table.startDate, table.endDate),
}));

// ==================== Zod Schemas ====================

export const insertApprovalRuleSchema = createInsertSchema(approvalRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertApprovalRequestSchema = createInsertSchema(approvalRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertApprovalCommentSchema = createInsertSchema(approvalComments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDiscountAnalyticsSchema = createInsertSchema(discountAnalytics).omit({
  id: true,
  createdAt: true,
});

export const insertApprovalDelegationSchema = createInsertSchema(approvalDelegations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ==================== Type Exports ====================

export type ApprovalRule = typeof approvalRules.$inferSelect;
export type InsertApprovalRule = z.infer<typeof insertApprovalRuleSchema>;

export type ApprovalRequest = typeof approvalRequests.$inferSelect;
export type InsertApprovalRequest = z.infer<typeof insertApprovalRequestSchema>;

export type ApprovalComment = typeof approvalComments.$inferSelect;
export type InsertApprovalComment = z.infer<typeof insertApprovalCommentSchema>;

export type DiscountAnalytics = typeof discountAnalytics.$inferSelect;
export type InsertDiscountAnalytics = z.infer<typeof insertDiscountAnalyticsSchema>;

export type ApprovalDelegation = typeof approvalDelegations.$inferSelect;
export type InsertApprovalDelegation = z.infer<typeof insertApprovalDelegationSchema>;
