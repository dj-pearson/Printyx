/**
 * User Lifecycle Management Database Schema
 * Tables for user provisioning templates, onboarding/offboarding workflows, and access reviews
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

export const lifecycleEventTypeEnum = pgEnum('lifecycle_event_type', [
  'onboarding_started',
  'onboarding_in_progress',
  'onboarding_completed',
  'onboarding_failed',
  'offboarding_started',
  'offboarding_in_progress',
  'offboarding_completed',
  'offboarding_failed',
  'role_changed',
  'access_granted',
  'access_revoked',
  'access_review_started',
  'access_review_completed',
]);

export const lifecycleStatusEnum = pgEnum('lifecycle_status', [
  'pending',
  'in_progress',
  'completed',
  'failed',
]);

export const accessReviewStatusEnum = pgEnum('access_review_status', [
  'not_started',
  'in_progress',
  'completed',
  'overdue',
]);

export const reviewDecisionEnum = pgEnum('review_decision', [
  'approved',
  'revoked',
  'modified',
  'escalated',
]);

// ============= USER PROVISIONING TEMPLATES TABLE =============

export const userProvisioningTemplates = pgTable('user_provisioning_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id'), // Null for platform-wide templates

  // Template Identity
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }), // 'sales', 'service', 'operations', 'finance', 'admin'
  jobTitle: varchar('job_title', { length: 255 }), // Associated job title

  // Role Configuration
  roleIds: jsonb('role_ids').$type<string[]>().notNull(), // Array of role IDs to assign
  primaryRoleId: uuid('primary_role_id'), // Main role
  temporaryRoleIds: jsonb('temporary_role_ids').$type<string[]>(), // Roles that expire
  temporaryRoleDuration: integer('temporary_role_duration_days'), // Days until temp roles expire

  // Permission Configuration
  permissions: jsonb('permissions').$type<{
    [resource: string]: {
      create?: boolean;
      read?: boolean;
      update?: boolean;
      delete?: boolean;
      export?: boolean;
    };
  }>(),
  permissionOverrides: jsonb('permission_overrides').$type<{
    [permissionKey: string]: boolean;
  }>(), // Specific permission overrides

  // User Preferences
  preferences: jsonb('preferences').$type<{
    timezone?: string;
    currency?: string;
    dateFormat?: string;
    timeFormat?: string;
    language?: string;
    theme?: string;
  }>(),

  // Notification Settings
  notificationSettings: jsonb('notification_settings').$type<{
    email?: boolean;
    push?: boolean;
    sms?: boolean;
    marketing?: boolean;
    slack?: boolean;
  }>(),

  // Integration Access
  integrationAccess: jsonb('integration_access').$type<{
    salesforce?: boolean;
    quickbooks?: boolean;
    zoominfo?: boolean;
    apollo?: boolean;
    mobileApp?: boolean;
  }>(),

  // Organizational Assignment
  defaultDepartment: varchar('default_department', { length: 255 }),
  defaultLocation: uuid('default_location_id'), // Default location assignment
  organizationalUnitLevel: varchar('organizational_unit_level', { length: 50 }), // 'location', 'regional', 'company', 'platform'

  // Onboarding Configuration
  onboardingSteps: jsonb('onboarding_steps').$type<
    Array<{
      stepNumber: number;
      stepName: string;
      description: string;
      automated: boolean;
      assignedTo?: 'admin' | 'manager' | 'user';
      daysToComplete?: number;
    }>
  >(),
  sendWelcomeEmail: boolean('send_welcome_email').default(true),
  welcomeEmailTemplate: varchar('welcome_email_template', { length: 100 }),
  assignOnboardingBuddy: boolean('assign_onboarding_buddy').default(false),
  checkInDays: jsonb('check_in_days').$type<number[]>(), // Days after start to check in (e.g., [3, 7, 30])

  // Usage & Performance
  usageCount: integer('usage_count').default(0),
  avgOnboardingTime: integer('avg_onboarding_time_minutes'), // Average time to complete onboarding
  successRate: integer('success_rate_percent'), // Percentage of successful onboardings
  lastUsedAt: timestamp('last_used_at'),

  // Template Management
  isActive: boolean('is_active').default(true),
  isDefault: boolean('is_default').default(false), // Default template for category
  createdBy: uuid('created_by').notNull(),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============= USER LIFECYCLE EVENTS TABLE =============

export const userLifecycleEvents = pgTable('user_lifecycle_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),

  // Event Identity
  userId: uuid('user_id').notNull(),
  eventType: lifecycleEventTypeEnum('event_type').notNull(),
  status: lifecycleStatusEnum('status').notNull(),

  // Event Details
  templateId: uuid('template_id'), // If provisioned from template
  triggeredBy: uuid('triggered_by').notNull(), // Admin who initiated
  automatedAction: boolean('automated_action').default(false),

  // Event Metadata
  metadata: jsonb('metadata').$type<{
    oldRoles?: string[];
    newRoles?: string[];
    transferredTo?: string;
    reason?: string;
    exportedData?: boolean;
    notificationsSent?: string[];
    errors?: string[];
    [key: string]: any;
  }>(),

  // Progress Tracking
  stepsCompleted: integer('steps_completed').default(0),
  stepsTotal: integer('steps_total'),
  currentStep: varchar('current_step', { length: 255 }),

  // Timing
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  failedAt: timestamp('failed_at'),

  // Errors
  errorMessage: text('error_message'),
  errorDetails: jsonb('error_details'),

  // Audit
  notes: text('notes'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============= ONBOARDING CHECKLISTS TABLE =============

export const onboardingChecklists = pgTable('onboarding_checklists', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),

  // Checklist Identity
  userId: uuid('user_id').notNull(),
  lifecycleEventId: uuid('lifecycle_event_id'), // Link to lifecycle event

  // Checklist Items
  items: jsonb('items')
    .$type<
      Array<{
        id: string;
        stepNumber: number;
        stepName: string;
        description: string;
        assignedTo: 'admin' | 'manager' | 'user';
        status: 'pending' | 'in_progress' | 'completed' | 'skipped';
        automated: boolean;
        completedAt?: string;
        completedBy?: string;
        notes?: string;
      }>
    >()
    .notNull(),

  // Progress
  totalItems: integer('total_items').notNull(),
  completedItems: integer('completed_items').default(0),
  progressPercent: integer('progress_percent').default(0),

  // Timeline
  startedAt: timestamp('started_at').defaultNow().notNull(),
  targetCompletionDate: timestamp('target_completion_date'),
  completedAt: timestamp('completed_at'),

  // Check-ins
  checkIns: jsonb('check_ins').$type<
    Array<{
      day: number;
      scheduledAt: string;
      completedAt?: string;
      notes?: string;
      issues?: string[];
    }>
  >(),
  nextCheckIn: timestamp('next_check_in'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============= OFFBOARDING WORKFLOWS TABLE =============

export const offboardingWorkflows = pgTable('offboarding_workflows', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),

  // Workflow Identity
  userId: uuid('user_id').notNull(),
  lifecycleEventId: uuid('lifecycle_event_id'),
  initiatedBy: uuid('initiated_by').notNull(),

  // Offboarding Details
  reason: varchar('reason', { length: 255 }).notNull(), // 'resignation', 'termination', 'retirement', 'transfer'
  lastWorkingDay: timestamp('last_working_day').notNull(),

  // Data Transfer
  transferOwnershipTo: uuid('transfer_ownership_to'), // Manager or replacement
  recordsTransferred: integer('records_transferred'),
  transferDetails: jsonb('transfer_details').$type<{
    customers?: number;
    leads?: number;
    opportunities?: number;
    serviceTickets?: number;
    [key: string]: number;
  }>(),

  // Data Export
  dataExported: boolean('data_exported').default(false),
  dataExportPath: varchar('data_export_path', { length: 500 }),
  dataExportSize: integer('data_export_size_bytes'),
  dataExportedAt: timestamp('data_exported_at'),

  // Access Revocation
  accessRevoked: boolean('access_revoked').default(false),
  accessRevokedAt: timestamp('access_revoked_at'),
  rolesRevoked: jsonb('roles_revoked').$type<string[]>(),
  integrationsRevoked: jsonb('integrations_revoked').$type<string[]>(),
  sessionsTerminated: integer('sessions_terminated'),

  // Equipment & Assets
  equipmentReturned: boolean('equipment_returned').default(false),
  equipmentList: jsonb('equipment_list').$type<
    Array<{
      itemType: string;
      serialNumber?: string;
      returnedAt?: string;
    }>
  >(),

  // Exit Interview
  exitInterviewCompleted: boolean('exit_interview_completed').default(false),
  exitInterviewNotes: text('exit_interview_notes'),
  exitInterviewDate: timestamp('exit_interview_date'),

  // Notifications
  notificationsSent: jsonb('notifications_sent').$type<{
    manager?: boolean;
    hr?: boolean;
    it?: boolean;
    securityTeam?: boolean;
    finance?: boolean;
  }>(),

  // Compliance & Audit
  complianceChecklist: jsonb('compliance_checklist').$type<
    Array<{
      item: string;
      completed: boolean;
      completedAt?: string;
      notes?: string;
    }>
  >(),
  auditReportGenerated: boolean('audit_report_generated').default(false),
  auditReportPath: varchar('audit_report_path', { length: 500 }),

  // Status
  status: lifecycleStatusEnum('status').notNull().default('pending'),

  // Timestamps
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============= ACCESS REVIEWS TABLE =============

export const accessReviews = pgTable('access_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),

  // Review Identity
  reviewPeriod: varchar('review_period', { length: 50 }).notNull(), // 'Q1-2025', 'Q2-2025', etc.
  reviewYear: integer('review_year').notNull(),
  reviewQuarter: integer('review_quarter').notNull(), // 1-4

  // Review Scope
  managerId: uuid('manager_id').notNull(), // Manager conducting review
  organizationalUnit: uuid('organizational_unit_id'), // Scope to specific unit
  userCount: integer('user_count').notNull(),

  // Status
  status: accessReviewStatusEnum('status').notNull().default('not_started'),

  // Timeline
  scheduledDate: timestamp('scheduled_date').notNull(),
  startedAt: timestamp('started_at'),
  dueDate: timestamp('due_date').notNull(),
  completedAt: timestamp('completed_at'),

  // Progress
  reviewedUsers: integer('reviewed_users').default(0),
  progressPercent: integer('progress_percent').default(0),

  // Results
  accessApproved: integer('access_approved').default(0),
  accessRevoked: integer('access_revoked').default(0),
  accessModified: integer('access_modified').default(0),
  escalations: integer('escalations').default(0),

  // Notifications
  remindersSent: integer('reminders_sent').default(0),
  lastReminderSent: timestamp('last_reminder_sent'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============= ACCESS REVIEW CERTIFICATIONS TABLE =============

export const accessReviewCertifications = pgTable('access_review_certifications', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Certification Identity
  accessReviewId: uuid('access_review_id').notNull(),
  userId: uuid('user_id').notNull(), // User being reviewed
  reviewedBy: uuid('reviewed_by').notNull(), // Manager doing review

  // User Details (snapshot at review time)
  userSnapshot: jsonb('user_snapshot')
    .$type<{
      name: string;
      email: string;
      department?: string;
      jobTitle?: string;
      location?: string;
    }>()
    .notNull(),

  // Current Access (at review time)
  currentRoles: jsonb('current_roles').$type<string[]>().notNull(),
  currentPermissions: jsonb('current_permissions')
    .$type<{
      [resource: string]: string[];
    }>()
    .notNull(),
  elevatedAccess: jsonb('elevated_access').$type<
    Array<{
      permission: string;
      grantedAt: string;
      lastUsed?: string;
    }>
  >(),

  // Review Decision
  decision: reviewDecisionEnum('decision').notNull(),
  decisionNotes: text('decision_notes'),

  // Changes Made
  rolesRevoked: jsonb('roles_revoked').$type<string[]>(),
  rolesAdded: jsonb('roles_added').$type<string[]>(),
  permissionsChanged: jsonb('permissions_changed').$type<{
    [permissionKey: string]: {
      from: boolean;
      to: boolean;
    };
  }>(),

  // Usage Analysis
  lastLoginDate: timestamp('last_login_date'),
  daysSinceLastLogin: integer('days_since_last_login'),
  unusedPermissions: jsonb('unused_permissions').$type<string[]>(), // Permissions granted but never used

  // Certification
  certified: boolean('certified').default(false),
  certifiedAt: timestamp('certified_at'),
  certificationExpires: timestamp('certification_expires'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============= BULK USER OPERATIONS TABLE =============

export const bulkUserOperations = pgTable('bulk_user_operations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),

  // Operation Identity
  operationType: varchar('operation_type', { length: 50 }).notNull(), // 'import', 'role_change', 'status_change', 'delete'
  initiatedBy: uuid('initiated_by').notNull(),

  // Operation Details
  fileName: varchar('file_name', { length: 255 }), // For CSV imports
  templateUsed: uuid('template_id'), // For provisioning

  // Scope
  totalRecords: integer('total_records').notNull(),
  processedRecords: integer('processed_records').default(0),
  successfulRecords: integer('successful_records').default(0),
  failedRecords: integer('failed_records').default(0),

  // Status
  status: lifecycleStatusEnum('status').notNull().default('pending'),

  // Progress
  progressPercent: integer('progress_percent').default(0),

  // Results
  results: jsonb('results').$type<
    Array<{
      row: number;
      userId?: string;
      status: 'success' | 'failed';
      error?: string;
    }>
  >(),

  // Errors
  errorSummary: jsonb('error_summary').$type<{
    [errorType: string]: number;
  }>(),
  errorDetails: text('error_details'),

  // Rollback
  rollbackSupported: boolean('rollback_supported').default(false),
  rolledBack: boolean('rolled_back').default(false),
  rollbackAt: timestamp('rollback_at'),

  // Timestamps
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============= USER IMPERSONATION SESSIONS TABLE =============

export const userImpersonationSessions = pgTable('user_impersonation_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),

  // Session Identity
  adminId: uuid('admin_id').notNull(), // Admin doing impersonation
  impersonatedUserId: uuid('impersonated_user_id').notNull(),

  // Session Details
  reason: text('reason').notNull(), // Why impersonation is needed
  ticketNumber: varchar('ticket_number', { length: 100 }), // Support ticket reference

  // Access Log
  actionsPerformed: jsonb('actions_performed').$type<
    Array<{
      timestamp: string;
      action: string;
      resource: string;
      details?: string;
    }>
  >(),

  // Session Lifecycle
  startedAt: timestamp('started_at').defaultNow().notNull(),
  endedAt: timestamp('ended_at'),
  duration: integer('duration_minutes'),

  // Security
  ipAddress: varchar('ip_address', { length: 45 }).notNull(),
  userAgent: text('user_agent'),

  // Status
  isActive: boolean('is_active').default(true),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============= INSERT SCHEMAS =============

export const insertUserProvisioningTemplateSchema = createInsertSchema(
  userProvisioningTemplates,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserLifecycleEventSchema = createInsertSchema(userLifecycleEvents).omit({
  id: true,
  createdAt: true,
});

export const insertOnboardingChecklistSchema = createInsertSchema(onboardingChecklists).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOffboardingWorkflowSchema = createInsertSchema(offboardingWorkflows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAccessReviewSchema = createInsertSchema(accessReviews).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAccessReviewCertificationSchema = createInsertSchema(
  accessReviewCertifications,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBulkUserOperationSchema = createInsertSchema(bulkUserOperations).omit({
  id: true,
  createdAt: true,
});

export const insertUserImpersonationSessionSchema = createInsertSchema(
  userImpersonationSessions,
).omit({
  id: true,
  createdAt: true,
});

// ============= TYPE EXPORTS =============

export type UserProvisioningTemplate = typeof userProvisioningTemplates.$inferSelect;
export type InsertUserProvisioningTemplate = typeof userProvisioningTemplates.$inferInsert;

export type UserLifecycleEvent = typeof userLifecycleEvents.$inferSelect;
export type InsertUserLifecycleEvent = typeof userLifecycleEvents.$inferInsert;

export type OnboardingChecklist = typeof onboardingChecklists.$inferSelect;
export type InsertOnboardingChecklist = typeof onboardingChecklists.$inferInsert;

export type OffboardingWorkflow = typeof offboardingWorkflows.$inferSelect;
export type InsertOffboardingWorkflow = typeof offboardingWorkflows.$inferInsert;

export type AccessReview = typeof accessReviews.$inferSelect;
export type InsertAccessReview = typeof accessReviews.$inferInsert;

export type AccessReviewCertification = typeof accessReviewCertifications.$inferSelect;
export type InsertAccessReviewCertification = typeof accessReviewCertifications.$inferInsert;

export type BulkUserOperation = typeof bulkUserOperations.$inferSelect;
export type InsertBulkUserOperation = typeof bulkUserOperations.$inferInsert;

export type UserImpersonationSession = typeof userImpersonationSessions.$inferSelect;
export type InsertUserImpersonationSession = typeof userImpersonationSessions.$inferInsert;
