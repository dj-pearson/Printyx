/**
 * SOC2 Compliance Database Schema
 * Tables for change management, incident response, payment audit trail,
 * data retention policies, and audit log archival
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
  index,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';

// ============= ENUMS =============

// Change Management Enums
export const changeTypeEnum = pgEnum('change_type', [
  'standard', // Pre-approved, low-risk changes
  'normal', // Requires CAB approval
  'emergency', // Urgent changes bypassing normal approval
  'major', // High-impact changes requiring multiple approvals
]);

export const changeStatusEnum = pgEnum('change_status', [
  'draft', // Initial creation
  'pending_review', // Awaiting initial review
  'pending_approval', // Awaiting CAB approval
  'approved', // Approved but not implemented
  'in_progress', // Currently being implemented
  'completed', // Successfully implemented
  'failed', // Implementation failed
  'rolled_back', // Change was reversed
  'cancelled', // Change was cancelled
]);

export const changeRiskLevelEnum = pgEnum('change_risk_level', [
  'low', // Minimal impact, easily reversible
  'medium', // Moderate impact, reversible
  'high', // Significant impact, complex reversal
  'critical', // Major impact, may be irreversible
]);

export const changeEnvironmentEnum = pgEnum('change_environment', [
  'development',
  'staging',
  'production',
  'all',
]);

// Incident Response Enums
export const incidentSeverityEnum = pgEnum('incident_severity', [
  'sev1', // Critical - Complete service outage
  'sev2', // High - Major functionality impaired
  'sev3', // Medium - Minor functionality impaired
  'sev4', // Low - Minimal impact
  'sev5', // Informational - No immediate impact
]);

export const incidentStatusEnum = pgEnum('incident_status', [
  'detected', // Initial detection
  'acknowledged', // Team notified
  'investigating', // Root cause analysis
  'identified', // Cause identified
  'mitigating', // Applying fixes
  'resolved', // Incident resolved
  'closed', // Post-mortem complete
  'reopened', // Incident recurred
]);

export const incidentCategoryEnum = pgEnum('incident_category', [
  'security', // Security breach or vulnerability
  'availability', // Service outage
  'performance', // Degraded performance
  'data_integrity', // Data corruption or loss
  'compliance', // Compliance violation
  'access_control', // Authentication/authorization issues
  'infrastructure', // Hardware or network issues
  'application', // Software bugs
  'third_party', // External service issues
]);

// Payment Audit Enums
export const paymentActionEnum = pgEnum('payment_action', [
  'payment_intent_created',
  'payment_intent_succeeded',
  'payment_intent_failed',
  'payment_intent_cancelled',
  'payment_method_attached',
  'payment_method_detached',
  'payment_method_updated',
  'subscription_created',
  'subscription_updated',
  'subscription_cancelled',
  'subscription_renewed',
  'invoice_created',
  'invoice_paid',
  'invoice_failed',
  'invoice_voided',
  'refund_initiated',
  'refund_completed',
  'refund_failed',
  'dispute_created',
  'dispute_won',
  'dispute_lost',
  'chargeback_received',
  'customer_created',
  'customer_updated',
  'customer_deleted',
]);

// Data Retention Enums
export const retentionPolicyStatusEnum = pgEnum('retention_policy_status', [
  'active',
  'paused',
  'disabled',
]);

export const purgeStatusEnum = pgEnum('purge_status', [
  'pending',
  'in_progress',
  'completed',
  'failed',
  'cancelled',
]);

// Archive Enums
export const archiveStatusEnum = pgEnum('archive_status', [
  'pending',
  'in_progress',
  'completed',
  'failed',
  'restored',
]);

// ============= CHANGE MANAGEMENT TABLES =============

/**
 * Change Requests - Core table for tracking all system changes
 * Implements SOC2 Change Management control requirements
 */
export const changeRequests = pgTable(
  'change_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),

    // Change Identification
    changeNumber: varchar('change_number', { length: 50 }).notNull().unique(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description').notNull(),

    // Classification
    type: changeTypeEnum('type').notNull().default('normal'),
    riskLevel: changeRiskLevelEnum('risk_level').notNull(),
    environment: changeEnvironmentEnum('environment').notNull(),

    // Status Tracking
    status: changeStatusEnum('status').notNull().default('draft'),

    // Ownership
    requesterId: uuid('requester_id').notNull(),
    assigneeId: uuid('assignee_id'),

    // Business Justification
    businessJustification: text('business_justification').notNull(),
    affectedSystems: jsonb('affected_systems').$type<string[]>().notNull(),
    affectedUsers: text('affected_users'),

    // Planning
    plannedStartDate: timestamp('planned_start_date'),
    plannedEndDate: timestamp('planned_end_date'),
    actualStartDate: timestamp('actual_start_date'),
    actualEndDate: timestamp('actual_end_date'),

    // Implementation Details
    implementationPlan: text('implementation_plan'),
    testPlan: text('test_plan'),
    rollbackPlan: text('rollback_plan').notNull(),
    communicationPlan: text('communication_plan'),

    // Risk Assessment
    riskAssessment: jsonb('risk_assessment').$type<{
      identifiedRisks: string[];
      mitigationStrategies: string[];
      residualRisk: string;
      impactAnalysis: string;
    }>(),

    // Approval Information
    approvalDeadline: timestamp('approval_deadline'),
    approvedBy: jsonb('approved_by').$type<
      Array<{
        userId: string;
        userName: string;
        role: string;
        approvedAt: string;
        comments?: string;
      }>
    >(),
    rejectedBy: uuid('rejected_by'),
    rejectionReason: text('rejection_reason'),

    // Implementation Results
    implementationNotes: text('implementation_notes'),
    verificationNotes: text('verification_notes'),
    failureReason: text('failure_reason'),
    rollbackNotes: text('rollback_notes'),

    // Related Changes
    relatedChangeIds: jsonb('related_change_ids').$type<string[]>(),
    parentChangeId: uuid('parent_change_id'),

    // Metadata
    tags: jsonb('tags').$type<string[]>(),
    priority: integer('priority').default(3), // 1 = highest, 5 = lowest

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    submittedAt: timestamp('submitted_at'),
    closedAt: timestamp('closed_at'),
  },
  (table) => ({
    tenantIdx: index('change_requests_tenant_idx').on(table.tenantId),
    statusIdx: index('change_requests_status_idx').on(table.status),
    requesterIdx: index('change_requests_requester_idx').on(table.requesterId),
    createdAtIdx: index('change_requests_created_at_idx').on(table.createdAt),
  }),
);

/**
 * Change Approvals - Individual approval records for changes
 */
export const changeApprovals = pgTable(
  'change_approvals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    changeRequestId: uuid('change_request_id')
      .notNull()
      .references(() => changeRequests.id, { onDelete: 'cascade' }),

    // Approver Information
    approverId: uuid('approver_id').notNull(),
    approverName: varchar('approver_name', { length: 255 }).notNull(),
    approverRole: varchar('approver_role', { length: 100 }).notNull(),

    // Approval Decision
    decision: varchar('decision', { length: 20 }).notNull(), // 'approved', 'rejected', 'pending'
    comments: text('comments'),
    conditions: text('conditions'),

    // Approval Level
    approvalLevel: integer('approval_level').notNull().default(1), // For multi-level approvals
    isRequired: boolean('is_required').default(true),

    // Timestamps
    requestedAt: timestamp('requested_at').defaultNow().notNull(),
    decidedAt: timestamp('decided_at'),
    expiresAt: timestamp('expires_at'),
  },
  (table) => ({
    changeRequestIdx: index('change_approvals_change_request_idx').on(table.changeRequestId),
    approverIdx: index('change_approvals_approver_idx').on(table.approverId),
  }),
);

/**
 * Change History - Complete audit trail of change request modifications
 */
export const changeHistory = pgTable(
  'change_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    changeRequestId: uuid('change_request_id')
      .notNull()
      .references(() => changeRequests.id, { onDelete: 'cascade' }),

    // Actor Information
    actorId: uuid('actor_id').notNull(),
    actorName: varchar('actor_name', { length: 255 }).notNull(),

    // Change Details
    action: varchar('action', { length: 100 }).notNull(),
    fieldName: varchar('field_name', { length: 100 }),
    oldValue: text('old_value'),
    newValue: text('new_value'),

    // Context
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),

    // Timestamps
    timestamp: timestamp('timestamp').defaultNow().notNull(),
  },
  (table) => ({
    changeRequestIdx: index('change_history_change_request_idx').on(table.changeRequestId),
    timestampIdx: index('change_history_timestamp_idx').on(table.timestamp),
  }),
);

// ============= INCIDENT RESPONSE TABLES =============

/**
 * Incidents - Core incident tracking table
 * Implements SOC2 Incident Response requirements
 */
export const incidents = pgTable(
  'incidents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),

    // Incident Identification
    incidentNumber: varchar('incident_number', { length: 50 }).notNull().unique(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description').notNull(),

    // Classification
    severity: incidentSeverityEnum('severity').notNull(),
    category: incidentCategoryEnum('category').notNull(),
    status: incidentStatusEnum('status').notNull().default('detected'),

    // Detection
    detectedAt: timestamp('detected_at').notNull(),
    detectedBy: uuid('detected_by'),
    detectionMethod: varchar('detection_method', { length: 100 }), // 'monitoring', 'user_report', 'audit', 'automated'
    detectionSource: text('detection_source'),

    // Impact Assessment
    impactSummary: text('impact_summary'),
    affectedSystems: jsonb('affected_systems').$type<string[]>(),
    affectedUsers: integer('affected_users'),
    businessImpact: text('business_impact'),
    dataBreachConfirmed: boolean('data_breach_confirmed').default(false),
    piiInvolved: boolean('pii_involved').default(false),

    // Response Team
    incidentCommanderId: uuid('incident_commander_id'),
    assignedTeam: jsonb('assigned_team').$type<
      Array<{
        userId: string;
        userName: string;
        role: string;
        assignedAt: string;
      }>
    >(),

    // Root Cause Analysis
    rootCause: text('root_cause'),
    contributingFactors: jsonb('contributing_factors').$type<string[]>(),

    // Resolution
    resolutionSummary: text('resolution_summary'),
    resolutionActions: jsonb('resolution_actions').$type<
      Array<{
        action: string;
        completedBy: string;
        completedAt: string;
        notes?: string;
      }>
    >(),
    resolvedAt: timestamp('resolved_at'),
    resolvedBy: uuid('resolved_by'),

    // Post-Incident
    lessonsLearned: text('lessons_learned'),
    preventiveMeasures: jsonb('preventive_measures').$type<string[]>(),
    postMortemUrl: text('post_mortem_url'),
    postMortemCompletedAt: timestamp('post_mortem_completed_at'),

    // Communication
    externalNotificationRequired: boolean('external_notification_required').default(false),
    regulatoryNotificationRequired: boolean('regulatory_notification_required').default(false),
    notificationsSent: jsonb('notifications_sent').$type<
      Array<{
        recipient: string;
        type: string;
        sentAt: string;
        sentBy: string;
      }>
    >(),

    // Metrics
    timeToAcknowledge: integer('time_to_acknowledge_minutes'),
    timeToResolve: integer('time_to_resolve_minutes'),

    // Related Items
    relatedIncidentIds: jsonb('related_incident_ids').$type<string[]>(),
    relatedChangeIds: jsonb('related_change_ids').$type<string[]>(),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    closedAt: timestamp('closed_at'),
  },
  (table) => ({
    tenantIdx: index('incidents_tenant_idx').on(table.tenantId),
    statusIdx: index('incidents_status_idx').on(table.status),
    severityIdx: index('incidents_severity_idx').on(table.severity),
    detectedAtIdx: index('incidents_detected_at_idx').on(table.detectedAt),
  }),
);

/**
 * Incident Timeline - Detailed timeline of incident events
 */
export const incidentTimeline = pgTable(
  'incident_timeline',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    incidentId: uuid('incident_id')
      .notNull()
      .references(() => incidents.id, { onDelete: 'cascade' }),

    // Event Details
    eventType: varchar('event_type', { length: 100 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),

    // Actor
    actorId: uuid('actor_id'),
    actorName: varchar('actor_name', { length: 255 }),

    // Metadata
    metadata: jsonb('metadata'),
    isAutomated: boolean('is_automated').default(false),

    // Timestamps
    timestamp: timestamp('timestamp').defaultNow().notNull(),
  },
  (table) => ({
    incidentIdx: index('incident_timeline_incident_idx').on(table.incidentId),
    timestampIdx: index('incident_timeline_timestamp_idx').on(table.timestamp),
  }),
);

/**
 * Incident Escalations - Escalation records for incidents
 */
export const incidentEscalations = pgTable(
  'incident_escalations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    incidentId: uuid('incident_id')
      .notNull()
      .references(() => incidents.id, { onDelete: 'cascade' }),

    // Escalation Details
    fromLevel: integer('from_level').notNull(),
    toLevel: integer('to_level').notNull(),
    reason: text('reason').notNull(),

    // People
    escalatedBy: uuid('escalated_by').notNull(),
    escalatedTo: uuid('escalated_to').notNull(),
    escalatedToName: varchar('escalated_to_name', { length: 255 }),

    // Acknowledgment
    acknowledged: boolean('acknowledged').default(false),
    acknowledgedAt: timestamp('acknowledged_at'),

    // Timestamps
    escalatedAt: timestamp('escalated_at').defaultNow().notNull(),
  },
  (table) => ({
    incidentIdx: index('incident_escalations_incident_idx').on(table.incidentId),
  }),
);

// ============= PAYMENT AUDIT TRAIL TABLES =============

/**
 * Payment Audit Trail - Comprehensive payment action logging for PCI compliance
 */
export const paymentAuditTrail = pgTable(
  'payment_audit_trail',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),

    // Action Details
    action: paymentActionEnum('action').notNull(),
    status: varchar('status', { length: 50 }).notNull(), // 'success', 'failure', 'pending'

    // Payment References
    stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),
    stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
    stripeInvoiceId: varchar('stripe_invoice_id', { length: 255 }),
    stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
    stripePaymentMethodId: varchar('stripe_payment_method_id', { length: 255 }),

    // Internal References
    userId: uuid('user_id'),
    customerId: uuid('customer_id'),
    invoiceId: uuid('invoice_id'),

    // Amount Information (stored in cents)
    amount: integer('amount'),
    currency: varchar('currency', { length: 3 }),

    // Card Information (masked for PCI compliance)
    cardLast4: varchar('card_last4', { length: 4 }),
    cardBrand: varchar('card_brand', { length: 50 }),
    cardExpMonth: integer('card_exp_month'),
    cardExpYear: integer('card_exp_year'),

    // Request Context
    ipAddress: varchar('ip_address', { length: 45 }).notNull(),
    userAgent: text('user_agent'),
    sessionId: varchar('session_id', { length: 255 }),
    requestId: uuid('request_id'),

    // Error Information
    errorCode: varchar('error_code', { length: 100 }),
    errorMessage: text('error_message'),
    declineCode: varchar('decline_code', { length: 100 }),

    // Risk Assessment
    riskLevel: varchar('risk_level', { length: 20 }),
    riskScore: integer('risk_score'),

    // Metadata
    metadata: jsonb('metadata'),
    stripeEventId: varchar('stripe_event_id', { length: 255 }),
    webhookReceived: boolean('webhook_received').default(false),

    // Timestamps
    timestamp: timestamp('timestamp').defaultNow().notNull(),
    processedAt: timestamp('processed_at'),
  },
  (table) => ({
    tenantIdx: index('payment_audit_tenant_idx').on(table.tenantId),
    actionIdx: index('payment_audit_action_idx').on(table.action),
    stripeCustomerIdx: index('payment_audit_stripe_customer_idx').on(table.stripeCustomerId),
    timestampIdx: index('payment_audit_timestamp_idx').on(table.timestamp),
    paymentIntentIdx: index('payment_audit_payment_intent_idx').on(table.stripePaymentIntentId),
  }),
);

/**
 * Payment Method Changes - Track all payment method modifications
 */
export const paymentMethodChanges = pgTable(
  'payment_method_changes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),

    // References
    userId: uuid('user_id').notNull(),
    stripeCustomerId: varchar('stripe_customer_id', { length: 255 }).notNull(),
    stripePaymentMethodId: varchar('stripe_payment_method_id', { length: 255 }).notNull(),

    // Change Details
    changeType: varchar('change_type', { length: 50 }).notNull(), // 'added', 'removed', 'updated', 'set_default'
    previousDefault: boolean('previous_default').default(false),
    newDefault: boolean('new_default').default(false),

    // Card Information (masked)
    cardLast4: varchar('card_last4', { length: 4 }),
    cardBrand: varchar('card_brand', { length: 50 }),

    // Context
    ipAddress: varchar('ip_address', { length: 45 }).notNull(),
    userAgent: text('user_agent'),
    reason: text('reason'),

    // Timestamps
    timestamp: timestamp('timestamp').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('payment_method_changes_tenant_idx').on(table.tenantId),
    userIdx: index('payment_method_changes_user_idx').on(table.userId),
    timestampIdx: index('payment_method_changes_timestamp_idx').on(table.timestamp),
  }),
);

// ============= DATA RETENTION TABLES =============

/**
 * Data Retention Policies - Configurable retention rules per entity type
 */
export const dataRetentionPolicies = pgTable(
  'data_retention_policies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),

    // Policy Identification
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),

    // Target Configuration
    tableName: varchar('table_name', { length: 255 }).notNull(),
    dateField: varchar('date_field', { length: 255 }).notNull(), // Field to check for age
    additionalConditions: jsonb('additional_conditions'), // Extra WHERE conditions

    // Retention Settings
    retentionDays: integer('retention_days').notNull(),
    archiveBeforePurge: boolean('archive_before_purge').default(true),
    archiveDestination: varchar('archive_destination', { length: 255 }), // Archive location

    // Execution Settings
    status: retentionPolicyStatusEnum('status').notNull().default('active'),
    priority: integer('priority').default(5), // 1 = highest
    batchSize: integer('batch_size').default(1000),
    maxExecutionMinutes: integer('max_execution_minutes').default(60),

    // Schedule (cron expression)
    schedule: varchar('schedule', { length: 100 }).default('0 2 * * 0'), // Weekly at 2 AM Sunday
    timezone: varchar('timezone', { length: 100 }).default('UTC'),

    // Legal/Compliance
    legalHold: boolean('legal_hold').default(false),
    legalHoldReason: text('legal_hold_reason'),
    legalHoldUntil: timestamp('legal_hold_until'),

    // Notification Settings
    notifyOnExecution: boolean('notify_on_execution').default(true),
    notifyOnFailure: boolean('notify_on_failure').default(true),
    notificationEmails: jsonb('notification_emails').$type<string[]>(),

    // Statistics
    lastExecutedAt: timestamp('last_executed_at'),
    lastRecordsPurged: integer('last_records_purged'),
    totalRecordsPurged: integer('total_records_purged').default(0),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    createdBy: uuid('created_by').notNull(),
  },
  (table) => ({
    tenantIdx: index('retention_policies_tenant_idx').on(table.tenantId),
    statusIdx: index('retention_policies_status_idx').on(table.status),
    tableIdx: index('retention_policies_table_idx').on(table.tableName),
  }),
);

/**
 * Data Purge Jobs - Track individual purge job executions
 */
export const dataPurgeJobs = pgTable(
  'data_purge_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    policyId: uuid('policy_id')
      .notNull()
      .references(() => dataRetentionPolicies.id, { onDelete: 'cascade' }),

    // Job Details
    status: purgeStatusEnum('status').notNull().default('pending'),
    triggerType: varchar('trigger_type', { length: 50 }).notNull(), // 'scheduled', 'manual', 'gdpr_request'
    triggeredBy: uuid('triggered_by'),

    // Target Information
    tableName: varchar('table_name', { length: 255 }).notNull(),
    cutoffDate: timestamp('cutoff_date').notNull(),

    // Execution Metrics
    recordsIdentified: integer('records_identified').default(0),
    recordsArchived: integer('records_archived').default(0),
    recordsPurged: integer('records_purged').default(0),
    recordsFailed: integer('records_failed').default(0),

    // Timing
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    durationSeconds: integer('duration_seconds'),

    // Results
    archiveLocation: text('archive_location'),
    errorLog: jsonb('error_log').$type<
      Array<{
        recordId: string;
        error: string;
        timestamp: string;
      }>
    >(),

    // Verification
    verificationStatus: varchar('verification_status', { length: 50 }),
    verifiedBy: uuid('verified_by'),
    verifiedAt: timestamp('verified_at'),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('purge_jobs_tenant_idx').on(table.tenantId),
    policyIdx: index('purge_jobs_policy_idx').on(table.policyId),
    statusIdx: index('purge_jobs_status_idx').on(table.status),
    createdAtIdx: index('purge_jobs_created_at_idx').on(table.createdAt),
  }),
);

// ============= AUDIT LOG ARCHIVAL TABLES =============

/**
 * Audit Log Archives - Track archived audit log batches
 */
export const auditLogArchives = pgTable(
  'audit_log_archives',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),

    // Archive Details
    archiveName: varchar('archive_name', { length: 255 }).notNull(),
    status: archiveStatusEnum('status').notNull().default('pending'),

    // Date Range
    startDate: timestamp('start_date').notNull(),
    endDate: timestamp('end_date').notNull(),

    // Content Information
    recordCount: integer('record_count').notNull(),
    originalSizeBytes: integer('original_size_bytes'),
    compressedSizeBytes: integer('compressed_size_bytes'),
    compressionRatio: integer('compression_ratio'), // Percentage saved

    // Storage
    storageLocation: text('storage_location').notNull(),
    storageProvider: varchar('storage_provider', { length: 50 }), // 's3', 'gcs', 'azure_blob', 'local'
    encryptionKey: varchar('encryption_key', { length: 255 }), // Key identifier (not actual key)
    checksumSha256: varchar('checksum_sha256', { length: 64 }).notNull(),

    // Retention
    retainUntil: timestamp('retain_until').notNull(),
    legalHold: boolean('legal_hold').default(false),

    // Metadata
    metadata: jsonb('metadata'),

    // Restoration
    lastRestoredAt: timestamp('last_restored_at'),
    restorationCount: integer('restoration_count').default(0),

    // Timestamps
    archivedAt: timestamp('archived_at').defaultNow().notNull(),
    archivedBy: uuid('archived_by').notNull(),
    deletedAt: timestamp('deleted_at'),
    deletedBy: uuid('deleted_by'),
  },
  (table) => ({
    tenantIdx: index('audit_archives_tenant_idx').on(table.tenantId),
    statusIdx: index('audit_archives_status_idx').on(table.status),
    dateRangeIdx: index('audit_archives_date_range_idx').on(table.startDate, table.endDate),
  }),
);

/**
 * Audit Archive Jobs - Track archive job executions
 */
export const auditArchiveJobs = pgTable(
  'audit_archive_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    archiveId: uuid('archive_id').references(() => auditLogArchives.id, { onDelete: 'set null' }),

    // Job Type
    jobType: varchar('job_type', { length: 50 }).notNull(), // 'archive', 'restore', 'delete'
    status: archiveStatusEnum('status').notNull().default('pending'),

    // Execution Details
    triggeredBy: uuid('triggered_by').notNull(),
    triggerReason: text('trigger_reason'),

    // Progress
    totalRecords: integer('total_records'),
    processedRecords: integer('processed_records').default(0),
    progressPercentage: integer('progress_percentage').default(0),

    // Timing
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    durationSeconds: integer('duration_seconds'),

    // Results
    resultMessage: text('result_message'),
    errorMessage: text('error_message'),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('archive_jobs_tenant_idx').on(table.tenantId),
    statusIdx: index('archive_jobs_status_idx').on(table.status),
    createdAtIdx: index('archive_jobs_created_at_idx').on(table.createdAt),
  }),
);

// ============= RELATIONS =============

export const changeRequestsRelations = relations(changeRequests, ({ many, one }) => ({
  approvals: many(changeApprovals),
  history: many(changeHistory),
  parentChange: one(changeRequests, {
    fields: [changeRequests.parentChangeId],
    references: [changeRequests.id],
  }),
}));

export const changeApprovalsRelations = relations(changeApprovals, ({ one }) => ({
  changeRequest: one(changeRequests, {
    fields: [changeApprovals.changeRequestId],
    references: [changeRequests.id],
  }),
}));

export const changeHistoryRelations = relations(changeHistory, ({ one }) => ({
  changeRequest: one(changeRequests, {
    fields: [changeHistory.changeRequestId],
    references: [changeRequests.id],
  }),
}));

export const incidentsRelations = relations(incidents, ({ many }) => ({
  timeline: many(incidentTimeline),
  escalations: many(incidentEscalations),
}));

export const incidentTimelineRelations = relations(incidentTimeline, ({ one }) => ({
  incident: one(incidents, {
    fields: [incidentTimeline.incidentId],
    references: [incidents.id],
  }),
}));

export const incidentEscalationsRelations = relations(incidentEscalations, ({ one }) => ({
  incident: one(incidents, {
    fields: [incidentEscalations.incidentId],
    references: [incidents.id],
  }),
}));

export const dataRetentionPoliciesRelations = relations(dataRetentionPolicies, ({ many }) => ({
  purgeJobs: many(dataPurgeJobs),
}));

export const dataPurgeJobsRelations = relations(dataPurgeJobs, ({ one }) => ({
  policy: one(dataRetentionPolicies, {
    fields: [dataPurgeJobs.policyId],
    references: [dataRetentionPolicies.id],
  }),
}));

export const auditLogArchivesRelations = relations(auditLogArchives, ({ many }) => ({
  jobs: many(auditArchiveJobs),
}));

export const auditArchiveJobsRelations = relations(auditArchiveJobs, ({ one }) => ({
  archive: one(auditLogArchives, {
    fields: [auditArchiveJobs.archiveId],
    references: [auditLogArchives.id],
  }),
}));

// ============= INSERT SCHEMAS =============

export const insertChangeRequestSchema = createInsertSchema(changeRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChangeApprovalSchema = createInsertSchema(changeApprovals).omit({
  id: true,
  requestedAt: true,
});

export const insertChangeHistorySchema = createInsertSchema(changeHistory).omit({
  id: true,
  timestamp: true,
});

export const insertIncidentSchema = createInsertSchema(incidents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIncidentTimelineSchema = createInsertSchema(incidentTimeline).omit({
  id: true,
  timestamp: true,
});

export const insertIncidentEscalationSchema = createInsertSchema(incidentEscalations).omit({
  id: true,
  escalatedAt: true,
});

export const insertPaymentAuditTrailSchema = createInsertSchema(paymentAuditTrail).omit({
  id: true,
  timestamp: true,
});

export const insertPaymentMethodChangeSchema = createInsertSchema(paymentMethodChanges).omit({
  id: true,
  timestamp: true,
});

export const insertDataRetentionPolicySchema = createInsertSchema(dataRetentionPolicies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDataPurgeJobSchema = createInsertSchema(dataPurgeJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAuditLogArchiveSchema = createInsertSchema(auditLogArchives).omit({
  id: true,
  archivedAt: true,
});

export const insertAuditArchiveJobSchema = createInsertSchema(auditArchiveJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ============= TYPE EXPORTS =============

export type ChangeRequest = typeof changeRequests.$inferSelect;
export type InsertChangeRequest = typeof changeRequests.$inferInsert;

export type ChangeApproval = typeof changeApprovals.$inferSelect;
export type InsertChangeApproval = typeof changeApprovals.$inferInsert;

export type ChangeHistory = typeof changeHistory.$inferSelect;
export type InsertChangeHistory = typeof changeHistory.$inferInsert;

export type Incident = typeof incidents.$inferSelect;
export type InsertIncident = typeof incidents.$inferInsert;

export type IncidentTimeline = typeof incidentTimeline.$inferSelect;
export type InsertIncidentTimeline = typeof incidentTimeline.$inferInsert;

export type IncidentEscalation = typeof incidentEscalations.$inferSelect;
export type InsertIncidentEscalation = typeof incidentEscalations.$inferInsert;

export type PaymentAuditTrail = typeof paymentAuditTrail.$inferSelect;
export type InsertPaymentAuditTrail = typeof paymentAuditTrail.$inferInsert;

export type PaymentMethodChange = typeof paymentMethodChanges.$inferSelect;
export type InsertPaymentMethodChange = typeof paymentMethodChanges.$inferInsert;

export type DataRetentionPolicy = typeof dataRetentionPolicies.$inferSelect;
export type InsertDataRetentionPolicy = typeof dataRetentionPolicies.$inferInsert;

export type DataPurgeJob = typeof dataPurgeJobs.$inferSelect;
export type InsertDataPurgeJob = typeof dataPurgeJobs.$inferInsert;

export type AuditLogArchive = typeof auditLogArchives.$inferSelect;
export type InsertAuditLogArchive = typeof auditLogArchives.$inferInsert;

export type AuditArchiveJob = typeof auditArchiveJobs.$inferSelect;
export type InsertAuditArchiveJob = typeof auditArchiveJobs.$inferInsert;
