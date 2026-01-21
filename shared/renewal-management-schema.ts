import {
  pgTable,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  text,
  index,
  decimal,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// ==================== Contract Renewals ====================

export const contractRenewals = pgTable(
  'contract_renewals',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    customerId: varchar('customer_id').notNull(),
    contractId: varchar('contract_id').notNull(),

    // Renewal Details
    renewalStatus: varchar('renewal_status', { length: 50 }).notNull().default('pending'), // pending, in_progress, won, lost, cancelled
    renewalType: varchar('renewal_type', { length: 50 }).notNull(), // auto_renewal, negotiated_renewal, expansion, contraction

    // Timeline
    contractStartDate: timestamp('contract_start_date').notNull(),
    contractEndDate: timestamp('contract_end_date').notNull(),
    renewalNoticeDate: timestamp('renewal_notice_date'), // When customer must notify by
    renewalTargetDate: timestamp('renewal_target_date'), // When we want renewal closed

    // Current Contract Value
    currentMrr: decimal('current_mrr', { precision: 12, scale: 2 }), // Monthly Recurring Revenue
    currentArr: decimal('current_arr', { precision: 12, scale: 2 }), // Annual Recurring Revenue
    currentContractValue: decimal('current_contract_value', { precision: 12, scale: 2 }).notNull(),
    currentTerm: integer('current_term'), // months

    // Proposed Renewal
    proposedMrr: decimal('proposed_mrr', { precision: 12, scale: 2 }),
    proposedArr: decimal('proposed_arr', { precision: 12, scale: 2 }),
    proposedContractValue: decimal('proposed_contract_value', { precision: 12, scale: 2 }),
    proposedTerm: integer('proposed_term'), // months
    proposedStartDate: timestamp('proposed_start_date'),

    // Change Analysis
    valueChange: decimal('value_change', { precision: 12, scale: 2 }), // Difference from current
    valueChangePercentage: decimal('value_change_percentage', { precision: 5, scale: 2 }),
    termChange: integer('term_change'), // Difference in months

    // Renewal Health
    renewalRiskScore: integer('renewal_risk_score').default(50), // 0-100, higher = more risk
    renewalRiskLevel: varchar('renewal_risk_level', { length: 50 }), // low, medium, high, critical
    churnProbability: decimal('churn_probability', { precision: 5, scale: 4 }), // 0.0000 to 1.0000

    // Risk Factors
    riskFactors: jsonb('risk_factors').$type<
      Array<{
        factor: string;
        severity: string;
        impact: string;
        notes?: string;
      }>
    >(),

    strengths: jsonb('strengths').$type<
      Array<{
        factor: string;
        impact: string;
      }>
    >(),

    // Ownership
    accountOwnerId: varchar('account_owner_id'), // Current CSM/Account Manager
    renewalOwnerId: varchar('renewal_owner_id'), // Who's driving renewal
    executiveSponsor: varchar('executive_sponsor'),

    // Customer Engagement
    lastContactDate: timestamp('last_contact_date'),
    nextContactDate: timestamp('next_contact_date'),
    qbrScheduled: boolean('qbr_scheduled').default(false),
    qbrDate: timestamp('qbr_date'),
    executiveReviewScheduled: boolean('executive_review_scheduled').default(false),

    // Renewal Strategy
    renewalStrategy: text('renewal_strategy'),
    competitiveThreats: text('competitive_threats').array(),
    upsellOpportunities: text('upsell_opportunities').array(),

    // Pricing & Discounts
    currentDiscount: decimal('current_discount', { precision: 5, scale: 2 }),
    proposedDiscount: decimal('proposed_discount', { precision: 5, scale: 2 }),
    discountApprovalRequired: boolean('discount_approval_required').default(false),
    discountApprovedBy: varchar('discount_approved_by'),

    // Proposal & Contract
    renewalProposalId: varchar('renewal_proposal_id'),
    renewalProposalSentAt: timestamp('renewal_proposal_sent_at'),
    renewalContractId: varchar('renewal_contract_id'),
    renewalContractSignedAt: timestamp('renewal_contract_signed_at'),

    // Completion
    renewalClosedDate: timestamp('renewal_closed_date'),
    renewalWonReason: text('renewal_won_reason'),
    renewalLostReason: text('renewal_lost_reason'),
    churnedToCompetitor: varchar('churned_to_competitor'),

    // Automation & Alerts
    alertsEnabled: boolean('alerts_enabled').default(true),
    day180AlertSent: boolean('day_180_alert_sent').default(false),
    day90AlertSent: boolean('day_90_alert_sent').default(false),
    day60AlertSent: boolean('day_60_alert_sent').default(false),
    day30AlertSent: boolean('day_30_alert_sent').default(false),
    day7AlertSent: boolean('day_7_alert_sent').default(false),

    // Notes
    internalNotes: text('internal_notes'),
    customerFeedback: text('customer_feedback'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('contract_renewals_tenant_idx').on(table.tenantId),
    customerIdx: index('contract_renewals_customer_idx').on(table.customerId),
    contractIdx: index('contract_renewals_contract_idx').on(table.contractId),
    statusIdx: index('contract_renewals_status_idx').on(table.renewalStatus),
    endDateIdx: index('contract_renewals_end_date_idx').on(table.contractEndDate),
    riskLevelIdx: index('contract_renewals_risk_level_idx').on(table.renewalRiskLevel),
    ownerIdx: index('contract_renewals_owner_idx').on(table.renewalOwnerId),
  }),
);

// ==================== Renewal Activities ====================

export const renewalActivities = pgTable(
  'renewal_activities',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    renewalId: varchar('renewal_id').notNull(),

    // Activity Details
    activityType: varchar('activity_type', { length: 50 }).notNull(), // call, email, meeting, qbr, proposal_sent, contract_sent, follow_up
    activitySubject: varchar('activity_subject', { length: 255 }),
    activityDescription: text('activity_description'),

    // Participants
    performedBy: varchar('performed_by'),
    customerContacts: text('customer_contacts').array(),

    // Outcome
    outcome: varchar('outcome', { length: 100 }), // positive, neutral, negative, no_response
    nextSteps: text('next_steps'),

    // Engagement Metrics
    customerSentiment: varchar('customer_sentiment', { length: 50 }), // very_positive, positive, neutral, negative, very_negative
    renewalLikelihood: varchar('renewal_likelihood', { length: 50 }), // very_likely, likely, uncertain, unlikely, very_unlikely

    // Follow-up
    followUpRequired: boolean('follow_up_required').default(false),
    followUpDate: timestamp('follow_up_date'),
    followUpAssignedTo: varchar('follow_up_assigned_to'),

    // Timestamps
    activityDate: timestamp('activity_date').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    renewalIdx: index('renewal_activities_renewal_idx').on(table.renewalId),
    tenantRenewalIdx: index('renewal_activities_tenant_renewal_idx').on(
      table.tenantId,
      table.renewalId,
    ),
    activityDateIdx: index('renewal_activities_date_idx').on(table.activityDate),
    followUpIdx: index('renewal_activities_follow_up_idx').on(table.followUpDate),
  }),
);

// ==================== Renewal Playbooks ====================

export const renewalPlaybooks = pgTable(
  'renewal_playbooks',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),

    // Playbook Details
    playbookName: varchar('playbook_name', { length: 255 }).notNull(),
    description: text('description'),

    // Trigger Conditions
    triggerConditions: jsonb('trigger_conditions').$type<{
      daysBeforeRenewal?: number;
      contractValueMin?: number;
      contractValueMax?: number;
      riskLevel?: string[];
      customerTier?: string[];
      churnProbabilityMin?: number;
    }>(),

    // Playbook Steps
    steps: jsonb('steps')
      .$type<
        Array<{
          stepName: string;
          description: string;
          orderIndex: number;
          daysBeforeRenewal: number; // When to execute relative to renewal date
          assignToRole: string; // csm, account_executive, executive
          actionType: string; // email, call, meeting, qbr, send_proposal
          automationWorkflowId?: string;
          isRequired: boolean;
          completionCriteria?: string;
        }>
      >()
      .notNull(),

    // Success Metrics
    successRate: decimal('success_rate', { precision: 5, scale: 2 }),
    timesUsed: integer('times_used').default(0),
    averageDaysToClose: decimal('average_days_to_close', { precision: 8, scale: 2 }),

    // Settings
    isActive: boolean('is_active').default(true),
    isDefault: boolean('is_default').default(false),

    createdBy: varchar('created_by'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('renewal_playbooks_tenant_idx').on(table.tenantId),
    activeIdx: index('renewal_playbooks_active_idx').on(table.isActive),
  }),
);

// ==================== Expansion Opportunities ====================

export const expansionOpportunities = pgTable(
  'expansion_opportunities',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    customerId: varchar('customer_id').notNull(),
    renewalId: varchar('renewal_id'), // If tied to renewal

    // Opportunity Details
    opportunityType: varchar('opportunity_type', { length: 50 }).notNull(), // upsell, cross_sell, additional_users, new_location
    opportunitySource: varchar('opportunity_source', { length: 50 }), // usage_analysis, customer_request, qbr, proactive_outreach

    // Trigger/Insight
    triggerEvent: varchar('trigger_event', { length: 255 }),
    insight: text('insight'), // What data/behavior led to this opportunity

    // Financial Impact
    estimatedMrr: decimal('estimated_mrr', { precision: 12, scale: 2 }),
    estimatedArr: decimal('estimated_arr', { precision: 12, scale: 2 }),
    estimatedOneTimeRevenue: decimal('estimated_one_time_revenue', { precision: 12, scale: 2 }),
    confidenceLevel: varchar('confidence_level', { length: 50 }), // low, medium, high

    // Proposed Solution
    proposedProducts: jsonb('proposed_products').$type<
      Array<{
        productId: string;
        productName: string;
        quantity: number;
        mrr: number;
      }>
    >(),

    proposedServices: jsonb('proposed_services').$type<
      Array<{
        serviceType: string;
        description: string;
        mrr?: number;
        oneTimePrice?: number;
      }>
    >(),

    // Status
    status: varchar('status', { length: 50 }).notNull().default('identified'), // identified, qualified, pitched, proposal_sent, won, lost
    priority: varchar('priority', { length: 50 }).default('medium'), // low, medium, high, critical

    // Ownership
    identifiedBy: varchar('identified_by'),
    ownerId: varchar('owner_id'),

    // Timeline
    identifiedAt: timestamp('identified_at').notNull().defaultNow(),
    targetCloseDate: timestamp('target_close_date'),
    closedAt: timestamp('closed_at'),

    // Outcome
    actualRevenue: decimal('actual_revenue', { precision: 12, scale: 2 }),
    outcomeNotes: text('outcome_notes'),

    // Notes
    notes: text('notes'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('expansion_opportunities_tenant_idx').on(table.tenantId),
    customerIdx: index('expansion_opportunities_customer_idx').on(table.customerId),
    statusIdx: index('expansion_opportunities_status_idx').on(table.status),
    ownerIdx: index('expansion_opportunities_owner_idx').on(table.ownerId),
  }),
);

// ==================== Zod Schemas ====================

export const insertContractRenewalSchema = createInsertSchema(contractRenewals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRenewalActivitySchema = createInsertSchema(renewalActivities).omit({
  id: true,
  createdAt: true,
});

export const insertRenewalPlaybookSchema = createInsertSchema(renewalPlaybooks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertExpansionOpportunitySchema = createInsertSchema(expansionOpportunities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ==================== Type Exports ====================

export type ContractRenewal = typeof contractRenewals.$inferSelect;
export type InsertContractRenewal = z.infer<typeof insertContractRenewalSchema>;

export type RenewalActivity = typeof renewalActivities.$inferSelect;
export type InsertRenewalActivity = z.infer<typeof insertRenewalActivitySchema>;

export type RenewalPlaybook = typeof renewalPlaybooks.$inferSelect;
export type InsertRenewalPlaybook = z.infer<typeof insertRenewalPlaybookSchema>;

export type ExpansionOpportunity = typeof expansionOpportunities.$inferSelect;
export type InsertExpansionOpportunity = z.infer<typeof insertExpansionOpportunitySchema>;
