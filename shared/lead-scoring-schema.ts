import { pgTable, varchar, integer, decimal, boolean, timestamp, jsonb, text, serial } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ==================== Lead Scoring Rules ====================
// Define configurable scoring rules with weights and conditions
export const leadScoringRules = pgTable("lead_scoring_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Rule Identification
  ruleName: varchar("rule_name").notNull(),
  ruleDescription: text("rule_description"),
  category: varchar("category").notNull(), // demographic, firmographic, behavioral, engagement, bant
  
  // Scoring Configuration
  field: varchar("field").notNull(), // Field to evaluate (e.g., 'annualRevenue', 'employeeCount', 'industry')
  operator: varchar("operator").notNull(), // equals, not_equals, greater_than, less_than, contains, in_list, etc.
  value: jsonb("value").notNull(), // Value to compare against (can be number, string, array)
  scorePoints: integer("score_points").notNull(), // Points awarded when rule matches
  maxScore: integer("max_score"), // Maximum score this rule can contribute
  
  // Rule Priority & Status
  priority: integer("priority").default(0), // Higher priority rules evaluated first
  isActive: boolean("is_active").default(true),
  
  // Metadata
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ==================== Lead Scoring Factors ====================
// Track individual scoring factor contributions for transparency
export const leadScoringFactors = pgTable("lead_scoring_factors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull(), // References business_records.id
  ruleId: varchar("rule_id").notNull(), // References lead_scoring_rules.id
  tenantId: varchar("tenant_id").notNull(),
  
  // Factor Details
  factorName: varchar("factor_name").notNull(),
  factorCategory: varchar("factor_category").notNull(),
  pointsAwarded: integer("points_awarded").notNull(),
  
  // Rule Evaluation Context
  evaluatedField: varchar("evaluated_field"),
  evaluatedValue: jsonb("evaluated_value"),
  ruleCondition: jsonb("rule_condition"),
  
  // Timestamps
  evaluatedAt: timestamp("evaluated_at").defaultNow(),
});

// ==================== BANT Qualification Criteria ====================
// Budget, Authority, Need, Timeline framework for lead qualification
export const bantQualificationCriteria = pgTable("bant_qualification_criteria", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull(), // References business_records.id
  tenantId: varchar("tenant_id").notNull(),
  
  // Budget
  budgetIdentified: boolean("budget_identified").default(false),
  budgetAmount: decimal("budget_amount", { precision: 15, scale: 2 }),
  budgetTimeframe: varchar("budget_timeframe"), // current_quarter, next_quarter, this_year, next_year
  budgetApproved: boolean("budget_approved").default(false),
  budgetScore: integer("budget_score").default(0), // 0-25 points
  budgetNotes: text("budget_notes"),
  
  // Authority
  decisionMakerIdentified: boolean("decision_maker_identified").default(false),
  decisionMakerName: varchar("decision_maker_name"),
  decisionMakerTitle: varchar("decision_maker_title"),
  decisionMakerContact: varchar("decision_maker_contact"),
  decisionProcess: text("decision_process"), // Procurement process, approvals needed, etc.
  authorityScore: integer("authority_score").default(0), // 0-25 points
  authorityNotes: text("authority_notes"),
  
  // Need
  needIdentified: boolean("need_identified").default(false),
  needType: varchar("need_type"), // new_equipment, replacement, expansion, cost_reduction, service_improvement
  needUrgency: varchar("need_urgency"), // critical, high, medium, low
  needDescription: text("need_description"),
  painPoints: jsonb("pain_points"), // Array of pain points
  needScore: integer("need_score").default(0), // 0-25 points
  needNotes: text("need_notes"),
  
  // Timeline
  timelineIdentified: boolean("timeline_identified").default(false),
  expectedCloseDate: timestamp("expected_close_date"),
  decisionTimeline: varchar("decision_timeline"), // immediate, 30_days, 90_days, 6_months, 1_year
  implementationTimeline: varchar("implementation_timeline"),
  blockers: jsonb("blockers"), // Array of potential delays/blockers
  timelineScore: integer("timeline_score").default(0), // 0-25 points
  timelineNotes: text("timeline_notes"),
  
  // Overall BANT Assessment
  totalBantScore: integer("total_bant_score").default(0), // Sum of all 4 components (0-100)
  qualificationStatus: varchar("qualification_status").default("unqualified"), // unqualified, partially_qualified, qualified, highly_qualified
  qualifiedDate: timestamp("qualified_date"),
  disqualifiedReason: text("disqualified_reason"),
  
  // Metadata
  assessedBy: varchar("assessed_by"),
  lastAssessedAt: timestamp("last_assessed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ==================== Lead Score Calculations ====================
// Historical record of all score calculations for audit trail
export const leadScoreCalculations = pgTable("lead_score_calculations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull(), // References business_records.id
  tenantId: varchar("tenant_id").notNull(),
  
  // Score Breakdown
  demographicScore: integer("demographic_score").default(0), // Company size, industry, location
  firmographicScore: integer("firmographic_score").default(0), // Revenue, employee count, growth
  behavioralScore: integer("behavioral_score").default(0), // Website visits, email opens, content downloads
  engagementScore: integer("engagement_score").default(0), // Call responses, meeting attendance, proposal requests
  bantScore: integer("bant_score").default(0), // BANT qualification score
  
  // Total Score
  totalScore: integer("total_score").notNull().default(0), // Sum of all components (0-100)
  previousScore: integer("previous_score"), // Previous score for comparison
  scoreChange: integer("score_change"), // Delta from previous calculation
  
  // Lead Grade/Tier
  leadGrade: varchar("lead_grade"), // A+, A, B+, B, C+, C, D
  leadTier: varchar("lead_tier"), // hot, warm, cold
  
  // Prediction & Confidence
  predictionScore: decimal("prediction_score", { precision: 5, scale: 2 }), // ML-based probability of conversion (0-100)
  confidenceLevel: varchar("confidence_level"), // high, medium, low
  recommendedAction: varchar("recommended_action"), // contact_immediately, nurture, disqualify, request_more_info
  
  // Calculation Metadata
  calculationMethod: varchar("calculation_method").default("rule_based"), // rule_based, ml_model, hybrid
  rulesApplied: jsonb("rules_applied"), // Array of rule IDs that contributed to score
  calculationDuration: integer("calculation_duration_ms"), // Time taken to calculate (milliseconds)
  
  // Timestamps
  calculatedAt: timestamp("calculated_at").defaultNow(),
});

// ==================== Lead Qualification History ====================
// Track changes in lead qualification status over time
export const leadQualificationHistory = pgTable("lead_qualification_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull(), // References business_records.id
  tenantId: varchar("tenant_id").notNull(),
  
  // Qualification Change
  previousStatus: varchar("previous_status"),
  newStatus: varchar("new_status").notNull(), // unqualified, mql, sql, opportunity, customer
  statusReason: text("status_reason"),
  
  // Score Context
  scoreAtChange: integer("score_at_change"),
  bantScoreAtChange: integer("bant_score_at_change"),
  
  // Attribution
  changedBy: varchar("changed_by"), // User who made the change
  changeReason: varchar("change_reason"), // automatic, manual_review, score_threshold, bant_assessment
  
  // Additional Context
  notes: text("notes"),
  metadata: jsonb("metadata"),
  
  // Timestamps
  changedAt: timestamp("changed_at").defaultNow(),
});

// ==================== Lead Engagement Tracking ====================
// Track lead engagement activities for behavioral scoring
export const leadEngagementTracking = pgTable("lead_engagement_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").notNull(), // References business_records.id
  tenantId: varchar("tenant_id").notNull(),
  
  // Engagement Type
  engagementType: varchar("engagement_type").notNull(), // email_open, email_click, website_visit, form_submit, call_answered, meeting_attended
  engagementChannel: varchar("engagement_channel"), // email, phone, website, social, in_person
  
  // Engagement Details
  engagementSource: varchar("engagement_source"), // campaign_id, email_id, website_page, etc.
  engagementValue: integer("engagement_value").default(1), // Weighted value of this engagement
  engagementMetadata: jsonb("engagement_metadata"),
  
  // Attribution
  campaignId: varchar("campaign_id"),
  userId: varchar("user_id"), // Sales rep or user associated with engagement
  
  // Timestamps
  engagedAt: timestamp("engaged_at").defaultNow(),
});

// ==================== Zod Schemas for Validation ====================

export const insertLeadScoringRuleSchema = createInsertSchema(leadScoringRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeadScoringFactorSchema = createInsertSchema(leadScoringFactors).omit({
  id: true,
  evaluatedAt: true,
});

export const insertBantQualificationSchema = createInsertSchema(bantQualificationCriteria).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeadScoreCalculationSchema = createInsertSchema(leadScoreCalculations).omit({
  id: true,
  calculatedAt: true,
});

export const insertLeadQualificationHistorySchema = createInsertSchema(leadQualificationHistory).omit({
  id: true,
  changedAt: true,
});

export const insertLeadEngagementTrackingSchema = createInsertSchema(leadEngagementTracking).omit({
  id: true,
  engagedAt: true,
});

// ==================== TypeScript Types ====================

export type LeadScoringRule = typeof leadScoringRules.$inferSelect;
export type InsertLeadScoringRule = z.infer<typeof insertLeadScoringRuleSchema>;

export type LeadScoringFactor = typeof leadScoringFactors.$inferSelect;
export type InsertLeadScoringFactor = z.infer<typeof insertLeadScoringFactorSchema>;

export type BantQualificationCriteria = typeof bantQualificationCriteria.$inferSelect;
export type InsertBantQualification = z.infer<typeof insertBantQualificationSchema>;

export type LeadScoreCalculation = typeof leadScoreCalculations.$inferSelect;
export type InsertLeadScoreCalculation = z.infer<typeof insertLeadScoreCalculationSchema>;

export type LeadQualificationHistory = typeof leadQualificationHistory.$inferSelect;
export type InsertLeadQualificationHistory = z.infer<typeof insertLeadQualificationHistorySchema>;

export type LeadEngagementTracking = typeof leadEngagementTracking.$inferSelect;
export type InsertLeadEngagementTracking = z.infer<typeof insertLeadEngagementTrackingSchema>;
