import { pgTable, varchar, timestamp, integer, decimal, boolean, text, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// ==================== Customer Health Scores ====================

export const customerHealthScores = pgTable('customer_health_scores', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id').notNull(),
  customerId: varchar('customer_id').notNull(),
  
  // Overall health metrics
  overallScore: integer('overall_score').notNull(), // 0-100
  healthStatus: varchar('health_status').notNull(), // 'critical', 'at_risk', 'healthy', 'excellent'
  trend: varchar('trend').notNull(), // 'declining', 'stable', 'improving'
  
  // Component scores (0-100 each)
  usageScore: integer('usage_score').notNull(),
  engagementScore: integer('engagement_score').notNull(),
  supportScore: integer('support_score').notNull(),
  paymentScore: integer('payment_score').notNull(),
  satisfactionScore: integer('satisfaction_score').notNull(),
  
  // Metrics
  daysSinceLastService: integer('days_since_last_service'),
  openTicketsCount: integer('open_tickets_count').default(0),
  overdueInvoicesCount: integer('overdue_invoices_count').default(0),
  npsScore: integer('nps_score'), // -100 to 100
  csat: decimal('csat', { precision: 3, scale: 2 }), // 0.00 to 5.00
  
  // Analysis
  riskFactors: text('risk_factors').array(),
  strengthFactors: text('strength_factors').array(),
  recommendations: text('recommendations').array(),
  
  // Metadata
  calculatedAt: timestamp('calculated_at').notNull().defaultNow(),
  calculatedBy: varchar('calculated_by'), // 'system' or userId
  nextCalculationDue: timestamp('next_calculation_due'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  tenantCustomerIdx: index('health_scores_tenant_customer_idx').on(table.tenantId, table.customerId),
  tenantStatusIdx: index('health_scores_tenant_status_idx').on(table.tenantId, table.healthStatus),
  tenantTrendIdx: index('health_scores_tenant_trend_idx').on(table.tenantId, table.trend),
  tenantScoreIdx: index('health_scores_tenant_score_idx').on(table.tenantId, table.overallScore),
  calculatedAtIdx: index('health_scores_calculated_at_idx').on(table.calculatedAt),
  nextCalcIdx: index('health_scores_next_calc_idx').on(table.nextCalculationDue),
}));

export const insertCustomerHealthScoreSchema = createInsertSchema(customerHealthScores).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCustomerHealthScore = z.infer<typeof insertCustomerHealthScoreSchema>;
export type CustomerHealthScore = typeof customerHealthScores.$inferSelect;

// ==================== Churn Predictions ====================

export const churnPredictions = pgTable('churn_predictions', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id').notNull(),
  customerId: varchar('customer_id').notNull(),
  
  // Prediction results
  churnRisk: varchar('churn_risk').notNull(), // 'very_low', 'low', 'medium', 'high', 'critical'
  churnProbability: decimal('churn_probability', { precision: 5, scale: 4 }).notNull(), // 0.0000 to 1.0000
  confidenceLevel: decimal('confidence_level', { precision: 5, scale: 4 }).notNull(), // Model confidence
  
  // Timeline predictions
  predictedChurnDate: timestamp('predicted_churn_date'),
  daysUntilChurn: integer('days_until_churn'),
  contractEndDate: timestamp('contract_end_date'),
  
  // Contributing factors
  primaryRiskFactors: text('primary_risk_factors').array(),
  secondaryRiskFactors: text('secondary_risk_factors').array(),
  
  // Model information
  modelVersion: varchar('model_version').notNull(),
  modelType: varchar('model_type').notNull(), // 'rules_based', 'ml_logistic', 'ml_random_forest', 'ensemble'
  featureImportance: text('feature_importance'), // JSON object
  
  // Financial impact
  estimatedMrr: decimal('estimated_mrr', { precision: 12, scale: 2 }),
  estimatedLtv: decimal('estimated_ltv', { precision: 12, scale: 2 }),
  retentionCost: decimal('retention_cost', { precision: 12, scale: 2 }),
  
  // Action status
  interventionRequired: boolean('intervention_required').default(false),
  interventionTriggered: boolean('intervention_triggered').default(false),
  interventionId: varchar('intervention_id'),
  
  // Metadata
  predictedAt: timestamp('predicted_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'), // When prediction should be recalculated
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  tenantCustomerIdx: index('churn_pred_tenant_customer_idx').on(table.tenantId, table.customerId),
  tenantRiskIdx: index('churn_pred_tenant_risk_idx').on(table.tenantId, table.churnRisk),
  tenantProbabilityIdx: index('churn_pred_tenant_probability_idx').on(table.tenantId, table.churnProbability),
  tenantInterventionIdx: index('churn_pred_tenant_intervention_idx').on(table.tenantId, table.interventionRequired),
  predictedChurnIdx: index('churn_pred_predicted_churn_idx').on(table.predictedChurnDate),
  expiresAtIdx: index('churn_pred_expires_at_idx').on(table.expiresAt),
}));

export const insertChurnPredictionSchema = createInsertSchema(churnPredictions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertChurnPrediction = z.infer<typeof insertChurnPredictionSchema>;
export type ChurnPrediction = typeof churnPredictions.$inferSelect;

// ==================== Success Interventions ====================

export const successInterventions = pgTable('success_interventions', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id').notNull(),
  customerId: varchar('customer_id').notNull(),
  
  // Intervention details
  interventionType: varchar('intervention_type').notNull(), // 'outreach', 'training', 'discount', 'upgrade_offer', 'executive_review', 'health_check'
  trigger: varchar('trigger').notNull(), // 'churn_risk', 'health_decline', 'usage_drop', 'support_spike', 'payment_issue', 'manual'
  priority: varchar('priority').notNull(), // 'low', 'medium', 'high', 'critical'
  
  // Status and workflow
  status: varchar('status').notNull(), // 'pending', 'scheduled', 'in_progress', 'completed', 'cancelled', 'failed'
  outcome: varchar('outcome'), // 'successful', 'partially_successful', 'unsuccessful', 'pending_followup'
  
  // Assignment
  assignedTo: varchar('assigned_to'), // userId of CSM
  assignedAt: timestamp('assigned_at'),
  dueDate: timestamp('due_date'),
  
  // Execution details
  scheduledDate: timestamp('scheduled_date'),
  executedAt: timestamp('executed_at'),
  completedAt: timestamp('completed_at'),
  
  // Content
  title: varchar('title').notNull(),
  description: text('description'),
  actionItems: text('action_items').array(),
  notes: text('notes'),
  
  // Results
  customerResponse: varchar('customer_response'), // 'positive', 'neutral', 'negative', 'no_response'
  followUpRequired: boolean('follow_up_required').default(false),
  followUpDate: timestamp('follow_up_date'),
  
  // Impact tracking
  healthScoreBefore: integer('health_score_before'),
  healthScoreAfter: integer('health_score_after'),
  churnRiskBefore: varchar('churn_risk_before'),
  churnRiskAfter: varchar('churn_risk_after'),
  
  // Related records
  relatedHealthScoreId: varchar('related_health_score_id'),
  relatedChurnPredictionId: varchar('related_churn_prediction_id'),
  relatedTicketIds: text('related_ticket_ids').array(),
  
  // Automation
  automatedAction: boolean('automated_action').default(false),
  workflowId: varchar('workflow_id'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: varchar('created_by'),
}, (table) => ({
  tenantCustomerIdx: index('interventions_tenant_customer_idx').on(table.tenantId, table.customerId),
  tenantStatusIdx: index('interventions_tenant_status_idx').on(table.tenantId, table.status),
  tenantTypeIdx: index('interventions_tenant_type_idx').on(table.tenantId, table.interventionType),
  tenantPriorityIdx: index('interventions_tenant_priority_idx').on(table.tenantId, table.priority),
  assignedToIdx: index('interventions_assigned_to_idx').on(table.assignedTo),
  dueDateIdx: index('interventions_due_date_idx').on(table.dueDate),
  scheduledDateIdx: index('interventions_scheduled_date_idx').on(table.scheduledDate),
}));

export const insertSuccessInterventionSchema = createInsertSchema(successInterventions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSuccessIntervention = z.infer<typeof insertSuccessInterventionSchema>;
export type SuccessIntervention = typeof successInterventions.$inferSelect;

// ==================== Customer Journeys ====================

export const customerJourneys = pgTable('customer_journeys', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id').notNull(),
  customerId: varchar('customer_id').notNull(),
  
  // Journey stage
  currentStage: varchar('current_stage').notNull(), // 'onboarding', 'adoption', 'growth', 'maturity', 'renewal', 'at_risk', 'churned'
  previousStage: varchar('previous_stage'),
  stageEnteredAt: timestamp('stage_entered_at').notNull(),
  daysSinceStageChange: integer('days_since_stage_change').default(0),
  
  // Journey metrics
  totalDaysAsCustomer: integer('total_days_as_customer').default(0),
  lifecyclePhase: varchar('lifecycle_phase').notNull(), // 'new', 'established', 'mature', 'declining'
  
  // Milestones completed
  onboardingCompleted: boolean('onboarding_completed').default(false),
  onboardingCompletedAt: timestamp('onboarding_completed_at'),
  firstServiceCompleted: boolean('first_service_completed').default(false),
  firstServiceCompletedAt: timestamp('first_service_completed_at'),
  firstRenewalCompleted: boolean('first_renewal_completed').default(false),
  firstRenewalCompletedAt: timestamp('first_renewal_completed_at'),
  
  // Touchpoints tracking
  totalTouchpoints: integer('total_touchpoints').default(0),
  lastTouchpointDate: timestamp('last_touchpoint_date'),
  lastTouchpointType: varchar('last_touchpoint_type'), // 'service', 'support', 'sales', 'csm', 'billing'
  
  // Engagement patterns
  avgDaysBetweenTouchpoints: integer('avg_days_between_touchpoints'),
  engagementTrend: varchar('engagement_trend'), // 'increasing', 'stable', 'decreasing'
  
  // Predicted next actions
  nextExpectedStage: varchar('next_expected_stage'),
  predictedStageChangeDate: timestamp('predicted_stage_change_date'),
  recommendedActions: text('recommended_actions').array(),
  
  // Journey health
  journeyHealth: varchar('journey_health').notNull(), // 'on_track', 'needs_attention', 'off_track'
  blockers: text('blockers').array(),
  
  // Related records
  currentInterventionId: varchar('current_intervention_id'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  tenantCustomerIdx: index('journeys_tenant_customer_idx').on(table.tenantId, table.customerId),
  tenantStageIdx: index('journeys_tenant_stage_idx').on(table.tenantId, table.currentStage),
  tenantPhaseIdx: index('journeys_tenant_phase_idx').on(table.tenantId, table.lifecyclePhase),
  tenantHealthIdx: index('journeys_tenant_health_idx').on(table.tenantId, table.journeyHealth),
  stageEnteredIdx: index('journeys_stage_entered_idx').on(table.stageEnteredAt),
  lastTouchpointIdx: index('journeys_last_touchpoint_idx').on(table.lastTouchpointDate),
}));

export const insertCustomerJourneySchema = createInsertSchema(customerJourneys).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCustomerJourney = z.infer<typeof insertCustomerJourneySchema>;
export type CustomerJourney = typeof customerJourneys.$inferSelect;

// ==================== Renewal Opportunities ====================

export const renewalOpportunities = pgTable('renewal_opportunities', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id').notNull(),
  customerId: varchar('customer_id').notNull(),
  contractId: varchar('contract_id').notNull(),
  
  // Renewal details
  renewalType: varchar('renewal_type').notNull(), // 'standard_renewal', 'expansion', 'downsizing', 'at_risk'
  renewalStatus: varchar('renewal_status').notNull(), // 'upcoming', 'in_progress', 'won', 'lost', 'cancelled'
  renewalProbability: decimal('renewal_probability', { precision: 5, scale: 4 }).notNull(), // 0.0000 to 1.0000
  
  // Timeline
  contractEndDate: timestamp('contract_end_date').notNull(),
  daysUntilRenewal: integer('days_until_renewal').notNull(),
  outreachStartDate: timestamp('outreach_start_date'), // When to start renewal conversation
  targetCloseDate: timestamp('target_close_date'),
  actualRenewalDate: timestamp('actual_renewal_date'),
  
  // Financial details
  currentMrr: decimal('current_mrr', { precision: 12, scale: 2 }).notNull(),
  projectedMrr: decimal('projected_mrr', { precision: 12, scale: 2 }).notNull(),
  mrrChange: decimal('mrr_change', { precision: 12, scale: 2 }),
  mrrChangePercent: decimal('mrr_change_percent', { precision: 5, scale: 2 }),
  
  currentContractValue: decimal('current_contract_value', { precision: 12, scale: 2 }),
  projectedContractValue: decimal('projected_contract_value', { precision: 12, scale: 2 }),
  
  // Expansion opportunities
  expansionPotential: boolean('expansion_potential').default(false),
  suggestedAddOns: text('suggested_add_ons').array(),
  suggestedUpgrades: text('suggested_upgrades').array(),
  estimatedExpansionValue: decimal('estimated_expansion_value', { precision: 12, scale: 2 }),
  
  // Risk assessment
  renewalRisk: varchar('renewal_risk').notNull(), // 'very_low', 'low', 'medium', 'high', 'critical'
  riskFactors: text('risk_factors').array(),
  strengthFactors: text('strength_factors').array(),
  
  // Engagement
  assignedCsm: varchar('assigned_csm'), // userId of Customer Success Manager
  assignedSalesRep: varchar('assigned_sales_rep'), // userId of Sales Rep
  lastContactDate: timestamp('last_contact_date'),
  nextContactDate: timestamp('next_contact_date'),
  contactFrequency: varchar('contact_frequency'), // 'weekly', 'biweekly', 'monthly'
  
  // Actions and notes
  actionPlan: text('action_plan').array(),
  internalNotes: text('internal_notes'),
  competitorThreats: text('competitor_threats').array(),
  
  // Outcome tracking
  outcomeNotes: text('outcome_notes'),
  lostReason: varchar('lost_reason'),
  winReason: varchar('win_reason'),
  
  // Related records
  relatedHealthScoreId: varchar('related_health_score_id'),
  relatedChurnPredictionId: varchar('related_churn_prediction_id'),
  relatedInterventionIds: text('related_intervention_ids').array(),
  quoteId: varchar('quote_id'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: varchar('created_by'),
}, (table) => ({
  tenantCustomerIdx: index('renewals_tenant_customer_idx').on(table.tenantId, table.customerId),
  tenantContractIdx: index('renewals_tenant_contract_idx').on(table.tenantId, table.contractId),
  tenantStatusIdx: index('renewals_tenant_status_idx').on(table.tenantId, table.renewalStatus),
  tenantRiskIdx: index('renewals_tenant_risk_idx').on(table.tenantId, table.renewalRisk),
  tenantDaysUntilIdx: index('renewals_tenant_days_until_idx').on(table.tenantId, table.daysUntilRenewal),
  contractEndDateIdx: index('renewals_contract_end_date_idx').on(table.contractEndDate),
  assignedCsmIdx: index('renewals_assigned_csm_idx').on(table.assignedCsm),
  assignedSalesIdx: index('renewals_assigned_sales_idx').on(table.assignedSalesRep),
  nextContactIdx: index('renewals_next_contact_idx').on(table.nextContactDate),
}));

export const insertRenewalOpportunitySchema = createInsertSchema(renewalOpportunities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRenewalOpportunity = z.infer<typeof insertRenewalOpportunitySchema>;
export type RenewalOpportunity = typeof renewalOpportunities.$inferSelect;
