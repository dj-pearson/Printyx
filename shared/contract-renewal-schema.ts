import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  decimal,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/**
 * Contract Renewal Autopilot Schema
 *
 * Automated contract renewal system that uses AI to:
 * - Monitor contract expiration dates
 * - Predict renewal likelihood based on customer engagement
 * - Automatically generate renewal proposals
 * - Optimize pricing based on usage and market data
 * - Automate renewal workflows and communications
 * - Reduce churn through proactive engagement
 */

export const contractStatusEnum = pgEnum('contract_status', [
  'active', // Currently active
  'expiring_soon', // Within renewal window
  'renewal_proposed', // Proposal sent to customer
  'renewal_negotiating', // In negotiation
  'renewed', // Successfully renewed
  'expired', // Contract expired
  'cancelled', // Customer cancelled
  'churned', // Lost to competitor
]);

export const renewalRiskEnum = pgEnum('renewal_risk', [
  'very_low', // 90%+ renewal probability
  'low', // 70-90% renewal probability
  'medium', // 50-70% renewal probability
  'high', // 30-50% renewal probability
  'very_high', // <30% renewal probability
]);

export const contractTypeEnum = pgEnum('contract_type', [
  'service_agreement',
  'equipment_lease',
  'supplies_contract',
  'managed_print_services',
  'full_service',
  'custom',
]);

export const renewalActionEnum = pgEnum('renewal_action', [
  'monitor', // Continue monitoring
  'send_proposal', // AI recommends sending proposal
  'schedule_call', // Schedule renewal discussion
  'offer_incentive', // Provide renewal incentive
  'escalate_to_sales', // Requires sales team intervention
  'increase_engagement', // Improve customer interaction
  'address_concerns', // Resolve customer issues first
]);

/**
 * Contract Renewal Tracking Table
 * Monitors all active contracts and renewal opportunities
 */
export const contractRenewalTracking = pgTable('contract_renewal_tracking', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer('tenant_id').notNull(),

  // Contract Details
  contractId: integer('contract_id').notNull(),
  contractNumber: text('contract_number').notNull(),
  contractType: contractTypeEnum('contract_type').notNull(),
  customerId: integer('customer_id').notNull(),
  customerName: text('customer_name').notNull(),

  // Dates
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  daysUntilExpiration: integer('days_until_expiration').notNull(),
  renewalWindowStart: timestamp('renewal_window_start'), // Typically 90 days before expiration

  // Current Contract Value
  monthlyRecurringRevenue: decimal('monthly_recurring_revenue', { precision: 10, scale: 2 }),
  annualContractValue: decimal('annual_contract_value', { precision: 10, scale: 2 }),
  totalContractValue: decimal('total_contract_value', { precision: 10, scale: 2 }),

  // Status & Risk
  status: contractStatusEnum('status').default('active'),
  renewalRisk: renewalRiskEnum('renewal_risk').default('low'),
  renewalProbability: integer('renewal_probability'), // 0-100%
  churnRiskScore: integer('churn_risk_score'), // 0-100 (higher = more risk)

  // AI Analysis
  aiAnalysis: jsonb('ai_analysis'), // Detailed AI insights from Claude
  riskFactors: jsonb('risk_factors'), // Array of identified risk factors
  opportunityFactors: jsonb('opportunity_factors'), // Upsell/expansion opportunities
  recommendedAction: renewalActionEnum('recommended_action').default('monitor'),
  confidenceScore: integer('confidence_score'), // AI confidence 0-100%

  // Customer Engagement Metrics
  lastInteractionDate: timestamp('last_interaction_date'),
  interactionFrequency: decimal('interaction_frequency', { precision: 10, scale: 2 }), // Interactions per month
  npsScore: integer('nps_score'), // Net Promoter Score
  satisfactionScore: integer('satisfaction_score'), // 1-5
  supportTicketsLast90Days: integer('support_tickets_last_90_days').default(0),
  escalationsLast90Days: integer('escalations_last_90_days').default(0),

  // Usage & Performance
  equipmentCount: integer('equipment_count').default(0),
  averageUptime: decimal('average_uptime', { precision: 5, scale: 2 }), // Percentage
  serviceCallsLast90Days: integer('service_calls_last_90_days').default(0),
  averageResponseTime: decimal('average_response_time', { precision: 10, scale: 2 }), // Hours
  firstTimeFixRate: decimal('first_time_fix_rate', { precision: 5, scale: 2 }), // Percentage

  // Renewal Proposal Details
  proposalGenerated: boolean('proposal_generated').default(false),
  proposalGeneratedAt: timestamp('proposal_generated_at'),
  proposalSentAt: timestamp('proposal_sent_at'),
  proposalViewedAt: timestamp('proposal_viewed_at'),
  proposalAcceptedAt: timestamp('proposal_accepted_at'),

  // Proposed Renewal Terms
  proposedMrr: decimal('proposed_mrr', { precision: 10, scale: 2 }),
  proposedAcv: decimal('proposed_acv', { precision: 10, scale: 2 }),
  proposedTermMonths: integer('proposed_term_months'),
  proposedDiscount: decimal('proposed_discount', { precision: 5, scale: 2 }), // Percentage
  upsellOpportunities: jsonb('upsell_opportunities'), // Recommended additional services

  // Automation Status
  autoRenewalEnabled: boolean('auto_renewal_enabled').default(false),
  autoRenewalApproved: boolean('auto_renewal_approved').default(false),
  remindersSent: integer('reminders_sent').default(0),
  lastReminderSentAt: timestamp('last_reminder_sent_at'),

  // Sales Assignment
  assignedSalesRep: integer('assigned_sales_rep_id'),
  assignedSalesRepName: text('assigned_sales_rep_name'),
  salesRepNotified: boolean('sales_rep_notified').default(false),
  salesRepNotifiedAt: timestamp('sales_rep_notified_at'),

  // Notes & Actions
  notes: text('notes'),
  actionItems: jsonb('action_items'), // Array of pending actions

  // Outcome Tracking
  renewalOutcome: text('renewal_outcome'), // 'renewed', 'churned', 'pending'
  renewalDate: timestamp('renewal_date'),
  churnDate: timestamp('churn_date'),
  churnReason: text('churn_reason'),
  competitorName: text('competitor_name'), // If churned to competitor

  // Metadata
  lastAnalyzedAt: timestamp('last_analyzed_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * Renewal Proposals Table
 * Auto-generated renewal proposals with AI-optimized pricing
 */
export const renewalProposals = pgTable('renewal_proposals', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer('tenant_id').notNull(),

  // Reference
  contractRenewalTrackingId: integer('contract_renewal_tracking_id').notNull(),
  contractId: integer('contract_id').notNull(),
  customerId: integer('customer_id').notNull(),
  customerName: text('customer_name').notNull(),

  // Proposal Details
  proposalNumber: text('proposal_number').notNull().unique(), // REN-{timestamp}-{random}
  proposalDate: timestamp('proposal_date').notNull().defaultNow(),
  expirationDate: timestamp('expiration_date').notNull(), // Proposal valid until

  // Current Contract Summary
  currentMrr: decimal('current_mrr', { precision: 10, scale: 2 }),
  currentAcv: decimal('current_acv', { precision: 10, scale: 2 }),
  currentTermMonths: integer('current_term_months'),

  // Proposed Terms
  proposedMrr: decimal('proposed_mrr', { precision: 10, scale: 2 }).notNull(),
  proposedAcv: decimal('proposed_acv', { precision: 10, scale: 2 }).notNull(),
  proposedTermMonths: integer('proposed_term_months').notNull(),
  proposedStartDate: timestamp('proposed_start_date').notNull(),
  proposedEndDate: timestamp('proposed_end_date').notNull(),

  // Pricing Strategy
  basePrice: decimal('base_price', { precision: 10, scale: 2 }),
  discountPercentage: decimal('discount_percentage', { precision: 5, scale: 2 }),
  discountAmount: decimal('discount_amount', { precision: 10, scale: 2 }),
  incentiveOffered: text('incentive_offered'), // Description of incentive
  incentiveValue: decimal('incentive_value', { precision: 10, scale: 2 }),

  // AI Optimization
  aiPricingStrategy: jsonb('ai_pricing_strategy'), // AI reasoning for pricing
  competitiveAnalysis: jsonb('competitive_analysis'), // Market positioning
  valueProposition: jsonb('value_proposition'), // Key selling points
  riskMitigation: jsonb('risk_mitigation'), // Address customer concerns

  // Upsell Opportunities
  baseServicesIncluded: jsonb('base_services_included'),
  additionalServicesOffered: jsonb('additional_services_offered'),
  upsellValue: decimal('upsell_value', { precision: 10, scale: 2 }),

  // Proposal Content
  executiveSummary: text('executive_summary'),
  servicesSummary: text('services_summary'),
  pricingSummary: text('pricing_summary'),
  termsAndConditions: text('terms_and_conditions'),
  customMessage: text('custom_message'),

  // Engagement Tracking
  sentVia: text('sent_via'), // 'email', 'portal', 'in_person'
  sentAt: timestamp('sent_at'),
  viewedAt: timestamp('viewed_at'),
  viewCount: integer('view_count').default(0),
  timeSpentViewing: integer('time_spent_viewing'), // Seconds
  questionsAsked: integer('questions_asked').default(0),

  // Response
  customerResponse: text('customer_response'), // 'accepted', 'rejected', 'negotiating', 'pending'
  responseDate: timestamp('response_date'),
  counterOfferReceived: boolean('counter_offer_received').default(false),
  counterOfferDetails: jsonb('counter_offer_details'),
  rejectionReason: text('rejection_reason'),

  // Follow-up
  followUpScheduled: boolean('follow_up_scheduled').default(false),
  followUpDate: timestamp('follow_up_date'),
  followUpCompleted: boolean('follow_up_completed').default(false),

  // Outcome
  status: text('status').default('draft'), // 'draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'
  acceptedAt: timestamp('accepted_at'),
  signedDocumentUrl: text('signed_document_url'),

  // Metadata
  generatedBy: text('generated_by').default('ai_autopilot'), // 'ai_autopilot', 'sales_rep'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * Renewal Automation Rules Table
 * Tenant-specific renewal automation configuration
 */
export const renewalAutomationRules = pgTable('renewal_automation_rules', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer('tenant_id').notNull().unique(),

  // Renewal Window Configuration
  renewalWindowDays: integer('renewal_window_days').default(90), // Start renewal process 90 days before expiration
  earlyRenewalIncentiveDays: integer('early_renewal_incentive_days').default(120), // Incentive for early renewal
  earlyRenewalDiscountPercent: decimal('early_renewal_discount_percent', {
    precision: 5,
    scale: 2,
  }).default('5.00'),

  // Auto-Renewal Settings
  autoRenewalEnabled: boolean('auto_renewal_enabled').default(true),
  requireCustomerApproval: boolean('require_customer_approval').default(true),
  autoAcceptThreshold: decimal('auto_accept_threshold', { precision: 10, scale: 2 }).default(
    '5000.00',
  ), // Dollar threshold

  // Risk Thresholds
  lowRiskThreshold: integer('low_risk_threshold').default(70), // >70% renewal probability
  mediumRiskThreshold: integer('medium_risk_threshold').default(50), // 50-70%
  highRiskThreshold: integer('high_risk_threshold').default(30), // <30% = high risk

  // Pricing Automation
  autoPricingEnabled: boolean('auto_pricing_enabled').default(true),
  maxDiscountPercent: decimal('max_discount_percent', { precision: 5, scale: 2 }).default('15.00'),
  minPriceIncreasePercent: decimal('min_price_increase_percent', {
    precision: 5,
    scale: 2,
  }).default('0.00'),
  maxPriceIncreasePercent: decimal('max_price_increase_percent', {
    precision: 5,
    scale: 2,
  }).default('5.00'),
  marketRateAdjustment: boolean('market_rate_adjustment').default(true),

  // Communication Automation
  autoSendProposals: boolean('auto_send_proposals').default(true),
  reminderFrequencyDays: integer('reminder_frequency_days').default(14), // Send reminders every 14 days
  maxReminders: integer('max_reminders').default(3),
  escalationEnabled: boolean('escalation_enabled').default(true),
  escalationDaysBeforeExpiry: integer('escalation_days_before_expiry').default(30),

  // Sales Team Notification
  notifySalesOnHighRisk: boolean('notify_sales_on_high_risk').default(true),
  notifySalesOnLargeContracts: boolean('notify_sales_on_large_contracts').default(true),
  largeContractThreshold: decimal('large_contract_threshold', { precision: 10, scale: 2 }).default(
    '10000.00',
  ),

  // AI Configuration
  aiAnalysisEnabled: boolean('ai_analysis_enabled').default(true),
  aiProposalGeneration: boolean('ai_proposal_generation').default(true),
  minimumConfidenceScore: integer('minimum_confidence_score').default(75), // 75%

  // Business Rules
  blockRenewalIfOutstanding: boolean('block_renewal_if_outstanding').default(true), // Outstanding invoices
  requireServiceReviewMeeting: boolean('require_service_review_meeting').default(false),
  minimumContractTermMonths: integer('minimum_contract_term_months').default(12),
  maximumContractTermMonths: integer('maximum_contract_term_months').default(60),

  // Upsell Configuration
  enableUpsellRecommendations: boolean('enable_upsell_recommendations').default(true),
  upsellMinimumPercent: decimal('upsell_minimum_percent', { precision: 5, scale: 2 }).default(
    '10.00',
  ),
  upsellMaximumPercent: decimal('upsell_maximum_percent', { precision: 5, scale: 2 }).default(
    '30.00',
  ),

  // Metadata
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * Renewal Analytics Table
 * Track renewal performance and ROI
 */
export const renewalAnalytics = pgTable('renewal_analytics', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer('tenant_id').notNull(),

  // Time Period
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  periodType: text('period_type').notNull(), // 'daily', 'weekly', 'monthly', 'quarterly'

  // Contract Volume
  contractsExpiring: integer('contracts_expiring').default(0),
  contractsRenewed: integer('contracts_renewed').default(0),
  contractsChurned: integer('contracts_churned').default(0),
  renewalRate: decimal('renewal_rate', { precision: 5, scale: 2 }), // Percentage

  // Financial Impact
  mrrAtRisk: decimal('mrr_at_risk', { precision: 10, scale: 2 }).default('0.00'),
  mrrRetained: decimal('mrr_retained', { precision: 10, scale: 2 }).default('0.00'),
  mrrExpanded: decimal('mrr_expanded', { precision: 10, scale: 2 }).default('0.00'), // Upsells
  mrrChurned: decimal('mrr_churned', { precision: 10, scale: 2 }).default('0.00'),
  totalRevenueSaved: decimal('total_revenue_saved', { precision: 10, scale: 2 }).default('0.00'),

  // Automation Performance
  proposalsAutoGenerated: integer('proposals_auto_generated').default(0),
  proposalsManuallyCreated: integer('proposals_manually_created').default(0),
  autoRenewalSuccessRate: decimal('auto_renewal_success_rate', { precision: 5, scale: 2 }),
  averageDaysToRenewal: decimal('average_days_to_renewal', { precision: 10, scale: 2 }),

  // AI Performance
  aiPredictionAccuracy: decimal('ai_prediction_accuracy', { precision: 5, scale: 2 }),
  averageConfidenceScore: decimal('average_confidence_score', { precision: 5, scale: 2 }),
  highRiskContractsSaved: integer('high_risk_contracts_saved').default(0),

  // Customer Engagement
  averageProposalViewTime: integer('average_proposal_view_time'), // Seconds
  proposalAcceptanceRate: decimal('proposal_acceptance_rate', { precision: 5, scale: 2 }),
  averageResponseTime: decimal('average_response_time', { precision: 10, scale: 2 }), // Days

  // Time Savings
  hoursSavedByAutomation: decimal('hours_saved_by_automation', { precision: 10, scale: 2 }).default(
    '0.00',
  ),
  manualHoursRequired: decimal('manual_hours_required', { precision: 10, scale: 2 }).default(
    '0.00',
  ),

  // Metadata
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/**
 * Renewal Communication Log Table
 * Track all automated and manual communications
 */
export const renewalCommunicationLog = pgTable('renewal_communication_log', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  tenantId: integer('tenant_id').notNull(),

  // Reference
  contractRenewalTrackingId: integer('contract_renewal_tracking_id').notNull(),
  renewalProposalId: integer('renewal_proposal_id'),
  customerId: integer('customer_id').notNull(),

  // Communication Details
  communicationType: text('communication_type').notNull(), // 'email', 'phone', 'meeting', 'portal_message'
  subject: text('subject'),
  message: text('message'),
  sentAt: timestamp('sent_at').notNull().defaultNow(),

  // Automation
  automatedMessage: boolean('automated_message').default(true),
  templateUsed: text('template_used'),
  triggeredBy: text('triggered_by'), // 'expiration_reminder', 'proposal_sent', 'follow_up'

  // Engagement
  opened: boolean('opened').default(false),
  openedAt: timestamp('opened_at'),
  clicked: boolean('clicked').default(false),
  clickedAt: timestamp('clicked_at'),
  replied: boolean('replied').default(false),
  repliedAt: timestamp('replied_at'),
  replyContent: text('reply_content'),

  // Metadata
  sentBy: integer('sent_by_user_id'),
  sentByName: text('sent_by_name'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Relations
export const contractRenewalTrackingRelations = relations(contractRenewalTracking, ({ many }) => ({
  proposals: many(renewalProposals),
  communications: many(renewalCommunicationLog),
}));

export const renewalProposalsRelations = relations(renewalProposals, ({ one, many }) => ({
  tracking: one(contractRenewalTracking, {
    fields: [renewalProposals.contractRenewalTrackingId],
    references: [contractRenewalTracking.id],
  }),
  communications: many(renewalCommunicationLog),
}));

export const renewalCommunicationLogRelations = relations(renewalCommunicationLog, ({ one }) => ({
  tracking: one(contractRenewalTracking, {
    fields: [renewalCommunicationLog.contractRenewalTrackingId],
    references: [contractRenewalTracking.id],
  }),
  proposal: one(renewalProposals, {
    fields: [renewalCommunicationLog.renewalProposalId],
    references: [renewalProposals.id],
  }),
}));
