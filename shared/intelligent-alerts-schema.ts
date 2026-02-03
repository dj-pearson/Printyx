/**
 * Intelligent Alerts & Incident Response Database Schema
 * Tables for AI-powered alert classification, automated containment, and resolution suggestions
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';

// ============= ENUMS =============

export const alertSeverityEnum = pgEnum('alert_severity', ['low', 'medium', 'high', 'critical']);
export const alertPriorityEnum = pgEnum('alert_priority', ['p1', 'p2', 'p3', 'p4']);
export const alertCategoryEnum = pgEnum('alert_category', [
  'data_breach',
  'malware',
  'unauthorized_access',
  'ddos',
  'brute_force',
  'suspicious_data_export',
  'privilege_escalation',
  'account_takeover',
  'phishing',
  'sql_injection',
  'xss',
  'api_abuse',
  'insider_threat',
  'compliance_violation',
  'other',
]);

export const alertStatusEnum = pgEnum('alert_status', [
  'new',
  'triaged',
  'investigating',
  'contained',
  'resolved',
  'false_positive',
]);

export const containmentActionTypeEnum = pgEnum('containment_action_type', [
  'suspend_user',
  'terminate_session',
  'block_ip',
  'quarantine_file',
  'disable_integration',
  'rate_limit',
  'force_password_reset',
  'enable_mfa',
  'restrict_permissions',
  'notify_team',
]);

export const routingReasonEnum = pgEnum('routing_reason', [
  'category_match',
  'workload_balance',
  'expertise_match',
  'availability',
  'escalation',
  'manual_assignment',
]);

export const resolutionConfidenceEnum = pgEnum('resolution_confidence', [
  'very_low',
  'low',
  'medium',
  'high',
  'very_high',
]);

// ============= ALERT TRIAGE RESULTS TABLE =============

export const alertTriageResults = pgTable('alert_triage_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),

  // Alert Reference
  alertId: uuid('alert_id').notNull(), // Links to existing security alert
  alertTitle: varchar('alert_title', { length: 500 }).notNull(),
  alertDescription: text('alert_description'),

  // AI Classification
  aiClassification: jsonb('ai_classification')
    .$type<{
      severity: 'low' | 'medium' | 'high' | 'critical';
      priority: 'p1' | 'p2' | 'p3' | 'p4';
      category: string;
      confidence: number; // 0-100
      reasoning: string;
    }>()
    .notNull(),

  // Context Analysis
  contextGathered: jsonb('context_gathered').$type<{
    recentAuditLogs?: number;
    userHistory?: any;
    systemState?: any;
    relatedAlerts?: string[];
    affectedResources?: string[];
  }>(),

  // Pattern Matching
  similarIncidents: jsonb('similar_incidents').$type<
    Array<{
      incidentId: string;
      similarity: number; // 0-100
      resolution: string;
      resolutionTime: number; // minutes
      successRate: number;
    }>
  >(),

  // Routing Recommendation
  routingRecommendation: jsonb('routing_recommendation').$type<{
    assignTo: string; // User ID
    teamId?: string;
    reason: string;
    alternativeAssignees?: Array<{
      userId: string;
      reason: string;
      score: number;
    }>;
  }>(),

  // Resolution Suggestions
  suggestions: jsonb('suggestions').$type<
    Array<{
      suggestionId: string;
      title: string;
      steps: Array<{
        stepNumber: number;
        description: string;
        automated: boolean;
        command?: string;
      }>;
      estimatedTime: number; // minutes
      successRate: number; // 0-100
      confidence: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
      basedOn?: string; // "Similar to incident #INC-2847"
    }>
  >(),

  // Auto-Containment
  autoContainmentNeeded: boolean('auto_containment_needed').default(false),
  autoContainmentActions: jsonb('auto_containment_actions').$type<
    Array<{
      actionType: string;
      target: string;
      executed: boolean;
      executedAt?: string;
      result?: string;
      error?: string;
    }>
  >(),

  // Risk Assessment
  riskScore: integer('risk_score').notNull(), // 0-100
  riskFactors: jsonb('risk_factors').$type<string[]>(), // Factors contributing to risk
  potentialImpact: text('potential_impact'),

  // Escalation
  requiresEscalation: boolean('requires_escalation').default(false),
  escalationReason: text('escalation_reason'),

  // Confidence & Quality
  overallConfidence: integer('overall_confidence').notNull(), // 0-100
  aiModelVersion: varchar('ai_model_version', { length: 50 }),

  // Human Review
  humanReviewRequired: boolean('human_review_required').default(false),
  humanReviewed: boolean('human_reviewed').default(false),
  reviewedBy: uuid('reviewed_by'),
  reviewedAt: timestamp('reviewed_at'),
  reviewNotes: text('review_notes'),
  classificationAccurate: boolean('classification_accurate'), // Feedback for model training

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============= AUTOMATED CONTAINMENT LOGS TABLE =============

export const automatedContainmentLogs = pgTable('automated_containment_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),

  // Reference
  alertId: uuid('alert_id').notNull(),
  triageResultId: uuid('triage_result_id'),

  // Containment Action
  actionType: containmentActionTypeEnum('action_type').notNull(),
  actionTarget: varchar('action_target', { length: 255 }).notNull(), // User ID, IP address, file path, etc.
  actionDetails: jsonb('action_details').$type<{
    reason: string;
    parameters?: any;
    reversible?: boolean;
    expiresAt?: string;
  }>(),

  // Execution
  automated: boolean('automated').default(true),
  executedBy: uuid('executed_by'), // Admin if manual
  executedAt: timestamp('executed_at').defaultNow().notNull(),

  // Result
  success: boolean('success').notNull(),
  result: text('result'),
  errorMessage: text('error_message'),

  // Reversal
  reversed: boolean('reversed').default(false),
  reversedAt: timestamp('reversed_at'),
  reversedBy: uuid('reversed_by'),
  reversalReason: text('reversal_reason'),

  // Notifications
  notificationsSent: jsonb('notifications_sent').$type<{
    slack?: boolean;
    email?: boolean;
    sms?: boolean;
    pagerduty?: boolean;
  }>(),

  // Audit
  auditLogId: uuid('audit_log_id'), // Link to audit log entry

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============= INCIDENT CORRELATION TABLE =============

export const incidentCorrelations = pgTable('incident_correlations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),

  // Master Incident
  masterIncidentId: uuid('master_incident_id').notNull(), // Primary incident
  masterIncidentTitle: varchar('master_incident_title', { length: 500 }).notNull(),

  // Related Incidents
  relatedIncidentIds: jsonb('related_incident_ids').$type<string[]>().notNull(),
  totalRelatedIncidents: integer('total_related_incidents').notNull(),

  // Correlation Criteria
  correlationFactors: jsonb('correlation_factors').$type<{
    sameUser?: boolean;
    sameIpAddress?: boolean;
    sameResource?: boolean;
    similarPattern?: boolean;
    timeProximity?: boolean; // Within 24 hours
    sameAttackVector?: boolean;
  }>(),

  // Correlation Strength
  correlationStrength: integer('correlation_strength').notNull(), // 0-100
  correlationType: varchar('correlation_type', { length: 100 }), // 'coordinated_attack', 'user_compromise', 'system_vulnerability'

  // Analysis
  attackScope: text('attack_scope'), // Description of full attack scope
  affectedSystems: jsonb('affected_systems').$type<string[]>(),
  affectedUsers: jsonb('affected_users').$type<string[]>(),

  // Impact Assessment
  combinedRiskScore: integer('combined_risk_score'), // 0-100
  estimatedImpact: text('estimated_impact'),

  // Status
  allIncidentsResolved: boolean('all_incidents_resolved').default(false),
  resolvedAt: timestamp('resolved_at'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============= INCIDENT RESOLUTION PATTERNS TABLE =============

export const incidentResolutionPatterns = pgTable('incident_resolution_patterns', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Pattern Identity
  category: alertCategoryEnum('category').notNull(),
  subCategory: varchar('sub_category', { length: 100 }),

  // Pattern Details
  patternName: varchar('pattern_name', { length: 255 }).notNull(),
  description: text('description'),

  // Resolution Steps
  commonResolutionSteps: jsonb('common_resolution_steps')
    .$type<
      Array<{
        stepNumber: number;
        description: string;
        automated: boolean;
        command?: string;
        estimatedDuration?: number; // minutes
      }>
    >()
    .notNull(),

  // Root Causes
  commonRootCauses: jsonb('common_root_causes').$type<
    Array<{
      cause: string;
      frequency: number; // percentage
      indicators: string[];
    }>
  >(),

  // Prevention Measures
  preventionMeasures: jsonb('prevention_measures').$type<
    Array<{
      measure: string;
      effectiveness: number; // 0-100
      implementationDifficulty: 'low' | 'medium' | 'high';
    }>
  >(),

  // Performance Metrics
  avgResolutionTime: integer('avg_resolution_time_minutes').notNull(),
  medianResolutionTime: integer('median_resolution_time_minutes'),
  successRate: integer('success_rate_percent').notNull(), // 0-100
  totalIncidents: integer('total_incidents').default(0),
  totalResolved: integer('total_resolved').default(0),

  // Confidence
  confidence: resolutionConfidenceEnum('confidence').notNull(),

  // Pattern Learning
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
  basedOnIncidents: jsonb('based_on_incidents').$type<string[]>(), // Sample incident IDs

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============= PROACTIVE THREAT DETECTION TABLE =============

export const proactiveThreatDetection = pgTable('proactive_threat_detection', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),

  // Detection Identity
  detectionType: varchar('detection_type', { length: 100 }).notNull(), // 'anomaly', 'pattern', 'behavior'
  threatCategory: alertCategoryEnum('threat_category').notNull(),

  // Detected Anomaly
  anomalyDescription: text('anomaly_description').notNull(),
  detectionReason: text('detection_reason'),

  // Affected Entity
  affectedEntityType: varchar('affected_entity_type', { length: 100 }).notNull(), // 'user', 'ip', 'resource'
  affectedEntityId: varchar('affected_entity_id', { length: 255 }).notNull(),

  // Anomaly Details
  anomalyData: jsonb('anomaly_data').$type<{
    normalBehavior?: any;
    observedBehavior?: any;
    deviation?: number; // percentage or standard deviations
    indicators?: string[];
  }>(),

  // Risk Assessment
  riskScore: integer('risk_score').notNull(), // 0-100
  severity: alertSeverityEnum('severity').notNull(),

  // Status
  status: varchar('status', { length: 50 }).notNull().default('monitoring'), // 'monitoring', 'alert_created', 'false_positive', 'resolved'
  alertCreated: boolean('alert_created').default(false),
  alertId: uuid('alert_id'), // If escalated to alert

  // Monitoring
  firstDetectedAt: timestamp('first_detected_at').notNull(),
  lastDetectedAt: timestamp('last_detected_at').notNull(),
  detectionCount: integer('detection_count').default(1),

  // Resolution
  resolvedAt: timestamp('resolved_at'),
  resolutionNotes: text('resolution_notes'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============= ALERT ROUTING RULES TABLE =============

export const alertRoutingRules = pgTable('alert_routing_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id'),

  // Rule Identity
  ruleName: varchar('rule_name', { length: 255 }).notNull(),
  description: text('description'),
  priority: integer('priority').notNull().default(0), // Higher priority rules evaluated first

  // Conditions
  conditions: jsonb('conditions')
    .$type<{
      category?: string[];
      severity?: string[];
      priority?: string[];
      keywords?: string[];
      affectedSystem?: string[];
      timeOfDay?: { start: string; end: string };
      dayOfWeek?: number[]; // 0-6
    }>()
    .notNull(),

  // Routing Destination
  assignToUserId: uuid('assign_to_user_id'),
  assignToTeamId: uuid('assign_to_team_id'),
  assignToRole: varchar('assign_to_role', { length: 100 }), // 'security_admin', 'it_admin', etc.

  // Load Balancing
  enableLoadBalancing: boolean('enable_load_balancing').default(false),
  maxActiveIncidents: integer('max_active_incidents'), // Per assignee

  // Escalation
  escalationEnabled: boolean('escalation_enabled').default(true),
  escalationTimeMinutes: integer('escalation_time_minutes').default(60),
  escalateToUserId: uuid('escalate_to_user_id'),
  escalateToTeamId: uuid('escalate_to_team_id'),

  // Notifications
  notificationChannels: jsonb('notification_channels').$type<{
    slack?: boolean;
    email?: boolean;
    sms?: boolean;
    pagerduty?: boolean;
  }>(),

  // Rule Status
  isActive: boolean('is_active').default(true),

  // Usage Statistics
  timesTriggered: integer('times_triggered').default(0),
  lastTriggered: timestamp('last_triggered'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdBy: uuid('created_by').notNull(),
});

// ============= RESOLUTION SUGGESTION FEEDBACK TABLE =============

export const resolutionSuggestionFeedback = pgTable('resolution_suggestion_feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: text('tenant_id').notNull(),

  // Reference
  suggestionId: varchar('suggestion_id', { length: 255 }).notNull(),
  triageResultId: uuid('triage_result_id').notNull(),
  incidentId: uuid('incident_id').notNull(),

  // Feedback
  suggestionUsed: boolean('suggestion_used').notNull(),
  suggestionHelpful: boolean('suggestion_helpful'),
  helpfulnessScore: integer('helpfulness_score'), // 1-5

  // Outcome
  incidentResolved: boolean('incident_resolved').notNull(),
  resolutionTime: integer('resolution_time_minutes'),
  stepsFollowed: jsonb('steps_followed').$type<number[]>(), // Which steps were actually followed
  additionalSteps: text('additional_steps'), // Steps not in suggestion that were needed

  // Accuracy
  rootCauseCorrect: boolean('root_cause_correct'),
  estimatedTimeAccurate: boolean('estimated_time_accurate'),

  // Comments
  feedback: text('feedback'),
  improvementSuggestions: text('improvement_suggestions'),

  // Attribution
  providedBy: uuid('provided_by').notNull(), // Admin who provided feedback

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============= INSERT SCHEMAS =============

export const insertAlertTriageResultSchema = createInsertSchema(alertTriageResults).omit({
  id: true,
  createdAt: true,
});

export const insertAutomatedContainmentLogSchema = createInsertSchema(
  automatedContainmentLogs,
).omit({
  id: true,
  createdAt: true,
});

export const insertIncidentCorrelationSchema = createInsertSchema(incidentCorrelations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIncidentResolutionPatternSchema = createInsertSchema(
  incidentResolutionPatterns,
).omit({
  id: true,
  createdAt: true,
});

export const insertProactiveThreatDetectionSchema = createInsertSchema(
  proactiveThreatDetection,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAlertRoutingRuleSchema = createInsertSchema(alertRoutingRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertResolutionSuggestionFeedbackSchema = createInsertSchema(
  resolutionSuggestionFeedback,
).omit({
  id: true,
  createdAt: true,
});

// ============= TYPE EXPORTS =============

export type AlertTriageResult = typeof alertTriageResults.$inferSelect;
export type InsertAlertTriageResult = typeof alertTriageResults.$inferInsert;

export type AutomatedContainmentLog = typeof automatedContainmentLogs.$inferSelect;
export type InsertAutomatedContainmentLog = typeof automatedContainmentLogs.$inferInsert;

export type IncidentCorrelation = typeof incidentCorrelations.$inferSelect;
export type InsertIncidentCorrelation = typeof incidentCorrelations.$inferInsert;

export type IncidentResolutionPattern = typeof incidentResolutionPatterns.$inferSelect;
export type InsertIncidentResolutionPattern = typeof incidentResolutionPatterns.$inferInsert;

export type ProactiveThreatDetection = typeof proactiveThreatDetection.$inferSelect;
export type InsertProactiveThreatDetection = typeof proactiveThreatDetection.$inferInsert;

export type AlertRoutingRule = typeof alertRoutingRules.$inferSelect;
export type InsertAlertRoutingRule = typeof alertRoutingRules.$inferInsert;

export type ResolutionSuggestionFeedback = typeof resolutionSuggestionFeedback.$inferSelect;
export type InsertResolutionSuggestionFeedback = typeof resolutionSuggestionFeedback.$inferInsert;
