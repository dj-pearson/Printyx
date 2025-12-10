/**
 * GDPR Core Features Schema
 * Tables for consent management, data processing agreements, data export, and contact deduplication
 */

import { pgTable, uuid, varchar, text, timestamp, jsonb, boolean, integer, pgEnum, index, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod";

// ============= ENUMS =============

export const consentTypeEnum = pgEnum('consent_type', [
  'marketing_email',
  'marketing_sms',
  'marketing_phone',
  'data_processing',
  'profiling',
  'analytics',
  'third_party_sharing',
  'newsletters',
  'product_updates',
  'transactional',
  'research',
  'automated_decisions'
]);

export const consentStatusEnum = pgEnum('consent_status', [
  'given',
  'withdrawn',
  'expired',
  'pending',
  'not_required'
]);

export const consentSourceEnum = pgEnum('consent_source', [
  'web_form',
  'email',
  'phone',
  'in_person',
  'api',
  'import',
  'contract',
  'legitimate_interest'
]);

export const legalBasisEnum = pgEnum('legal_basis', [
  'consent',
  'contract',
  'legal_obligation',
  'vital_interests',
  'public_task',
  'legitimate_interests'
]);

export const dpaStatusEnum = pgEnum('dpa_status', [
  'draft',
  'pending_review',
  'pending_signature',
  'active',
  'expired',
  'terminated',
  'renewed'
]);

export const vendorRiskLevelEnum = pgEnum('vendor_risk_level', [
  'low',
  'medium',
  'high',
  'critical'
]);

export const exportFormatEnum = pgEnum('export_format', [
  'json',
  'csv',
  'xml',
  'pdf',
  'zip'
]);

export const exportStatusEnum = pgEnum('export_status', [
  'pending',
  'processing',
  'completed',
  'failed',
  'expired',
  'downloaded'
]);

export const duplicateMatchTypeEnum = pgEnum('duplicate_match_type', [
  'exact',
  'fuzzy',
  'phonetic',
  'normalized'
]);

export const mergeStrategyEnum = pgEnum('merge_strategy', [
  'keep_primary',
  'keep_secondary',
  'combine',
  'manual'
]);

// ============= CONSENT MANAGEMENT TABLES =============

/**
 * Consent Records Table
 * Tracks individual consent decisions for contacts/users
 */
export const consentRecords = pgTable("consent_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),

  // Subject Information
  subjectType: varchar("subject_type", { length: 50 }).notNull(), // 'user', 'contact', 'lead', 'customer'
  subjectId: uuid("subject_id").notNull(), // Reference to user/contact/business_record
  subjectEmail: varchar("subject_email", { length: 255 }),

  // Consent Details
  consentType: consentTypeEnum("consent_type").notNull(),
  status: consentStatusEnum("status").notNull().default('pending'),
  legalBasis: legalBasisEnum("legal_basis").notNull().default('consent'),

  // Consent Collection
  source: consentSourceEnum("source").notNull(),
  sourceDetails: text("source_details"), // e.g., form URL, campaign name
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),

  // Consent Proof
  proofType: varchar("proof_type", { length: 100 }), // 'checkbox', 'signature', 'double_opt_in', 'verbal', 'written'
  proofReference: text("proof_reference"), // File path, confirmation token, etc.
  consentText: text("consent_text"), // The actual consent text shown to user
  version: varchar("version", { length: 50 }), // Consent policy version

  // Processing Purposes
  processingPurposes: jsonb("processing_purposes").$type<string[]>().default([]),
  dataCategories: jsonb("data_categories").$type<string[]>().default([]),

  // Timing
  givenAt: timestamp("given_at"),
  withdrawnAt: timestamp("withdrawn_at"),
  expiresAt: timestamp("expires_at"),

  // Withdrawal Details
  withdrawalReason: text("withdrawal_reason"),
  withdrawalMethod: varchar("withdrawal_method", { length: 100 }),

  // Metadata
  notes: text("notes"),
  tags: jsonb("tags").$type<string[]>().default([]),

  // Audit
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("consent_records_tenant_idx").on(table.tenantId),
  subjectIdx: index("consent_records_subject_idx").on(table.tenantId, table.subjectType, table.subjectId),
  typeIdx: index("consent_records_type_idx").on(table.tenantId, table.consentType),
  statusIdx: index("consent_records_status_idx").on(table.tenantId, table.status),
  emailIdx: index("consent_records_email_idx").on(table.tenantId, table.subjectEmail),
}));

/**
 * Consent Audit Trail Table
 * Tracks all changes to consent records
 */
export const consentAuditTrail = pgTable("consent_audit_trail", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  consentRecordId: uuid("consent_record_id").notNull(),

  // Change Details
  action: varchar("action", { length: 50 }).notNull(), // 'created', 'updated', 'withdrawn', 'expired', 'renewed'
  previousStatus: consentStatusEnum("previous_status"),
  newStatus: consentStatusEnum("new_status"),
  previousValues: jsonb("previous_values"),
  newValues: jsonb("new_values"),

  // Actor
  changedBy: uuid("changed_by"),
  changedByType: varchar("changed_by_type", { length: 50 }), // 'user', 'system', 'subject', 'admin'

  // Request Context
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),

  // Reason
  reason: text("reason"),

  // Timestamp
  changedAt: timestamp("changed_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("consent_audit_tenant_idx").on(table.tenantId),
  consentRecordIdx: index("consent_audit_consent_idx").on(table.consentRecordId),
  changedAtIdx: index("consent_audit_changed_at_idx").on(table.changedAt),
}));

/**
 * Consent Preferences Template
 * Default consent settings for tenant
 */
export const consentPreferencesTemplate = pgTable("consent_preferences_template", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),

  // Template Details
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isDefault: boolean("is_default").default(false),

  // Default Consent Types Required
  requiredConsents: jsonb("required_consents").$type<string[]>().default([]),
  optionalConsents: jsonb("optional_consents").$type<string[]>().default([]),

  // Default Settings
  defaultLegalBasis: legalBasisEnum("default_legal_basis").default('consent'),
  expirationDays: integer("expiration_days"), // null = no expiration
  requireDoubleOptIn: boolean("require_double_opt_in").default(false),

  // Consent Text Templates
  consentTexts: jsonb("consent_texts").$type<Record<string, string>>().default({}),

  // Status
  isActive: boolean("is_active").default(true),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("consent_template_tenant_idx").on(table.tenantId),
  activeIdx: index("consent_template_active_idx").on(table.tenantId, table.isActive),
}));

// ============= DATA PROCESSING AGREEMENTS TABLES =============

/**
 * Data Processing Agreements Table
 * Tracks DPAs with vendors/processors
 */
export const dataProcessingAgreements = pgTable("data_processing_agreements", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),

  // Agreement Identification
  agreementNumber: varchar("agreement_number", { length: 100 }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),

  // Vendor/Processor Information
  vendorName: varchar("vendor_name", { length: 255 }).notNull(),
  vendorLegalName: varchar("vendor_legal_name", { length: 255 }),
  vendorAddress: text("vendor_address"),
  vendorCountry: varchar("vendor_country", { length: 2 }), // ISO country code
  vendorContactName: varchar("vendor_contact_name", { length: 255 }),
  vendorContactEmail: varchar("vendor_contact_email", { length: 255 }),
  vendorContactPhone: varchar("vendor_contact_phone", { length: 50 }),
  vendorDpoEmail: varchar("vendor_dpo_email", { length: 255 }), // Data Protection Officer
  vendorPrivacyUrl: text("vendor_privacy_url"),

  // Risk Assessment
  riskLevel: vendorRiskLevelEnum("risk_level").default('medium'),
  riskAssessmentDate: timestamp("risk_assessment_date"),
  riskAssessmentNotes: text("risk_assessment_notes"),

  // Agreement Terms
  status: dpaStatusEnum("status").notNull().default('draft'),
  effectiveDate: timestamp("effective_date"),
  expirationDate: timestamp("expiration_date"),
  renewalDate: timestamp("renewal_date"),
  autoRenewal: boolean("auto_renewal").default(false),

  // Data Processing Details
  dataCategories: jsonb("data_categories").$type<string[]>().default([]), // Personal data, financial, health, etc.
  dataSubjects: jsonb("data_subjects").$type<string[]>().default([]), // Customers, employees, contacts, etc.
  processingPurposes: jsonb("processing_purposes").$type<string[]>().default([]),
  processingLocations: jsonb("processing_locations").$type<string[]>().default([]), // Countries where data is processed

  // Sub-processors
  allowsSubprocessors: boolean("allows_subprocessors").default(false),
  subprocessorApprovalRequired: boolean("subprocessor_approval_required").default(true),
  subprocessors: jsonb("subprocessors").$type<Array<{
    name: string;
    purpose: string;
    location: string;
    approvalDate?: string;
  }>>().default([]),

  // Security Measures
  securityMeasures: jsonb("security_measures").$type<string[]>().default([]),
  certifications: jsonb("certifications").$type<string[]>().default([]), // ISO27001, SOC2, etc.
  encryptionAtRest: boolean("encryption_at_rest").default(true),
  encryptionInTransit: boolean("encryption_in_transit").default(true),

  // Data Transfer
  crossBorderTransfer: boolean("cross_border_transfer").default(false),
  transferMechanism: varchar("transfer_mechanism", { length: 100 }), // SCCs, Adequacy, BCRs
  transferCountries: jsonb("transfer_countries").$type<string[]>().default([]),

  // Document Management
  documentUrl: text("document_url"),
  signedCopyUrl: text("signed_copy_url"),

  // Signatures
  ourSignatory: varchar("our_signatory", { length: 255 }),
  ourSignatureDate: timestamp("our_signature_date"),
  vendorSignatory: varchar("vendor_signatory", { length: 255 }),
  vendorSignatureDate: timestamp("vendor_signature_date"),

  // Notifications
  renewalReminderDays: integer("renewal_reminder_days").default(30),
  lastNotificationSent: timestamp("last_notification_sent"),

  // Audit
  createdBy: uuid("created_by"),
  updatedBy: uuid("updated_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("dpa_tenant_idx").on(table.tenantId),
  statusIdx: index("dpa_status_idx").on(table.tenantId, table.status),
  vendorIdx: index("dpa_vendor_idx").on(table.tenantId, table.vendorName),
  expirationIdx: index("dpa_expiration_idx").on(table.expirationDate),
}));

/**
 * DPA Compliance Checks Table
 * Tracks regular compliance audits of vendors
 */
export const dpaComplianceChecks = pgTable("dpa_compliance_checks", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  dpaId: uuid("dpa_id").notNull(),

  // Check Details
  checkType: varchar("check_type", { length: 100 }).notNull(), // 'annual_review', 'security_assessment', 'incident_response', 'certification_verification'
  checkDate: timestamp("check_date").notNull(),
  nextCheckDate: timestamp("next_check_date"),

  // Results
  status: varchar("status", { length: 50 }).notNull(), // 'passed', 'passed_with_issues', 'failed', 'pending'
  overallScore: integer("overall_score"), // 0-100

  // Findings
  findings: jsonb("findings").$type<Array<{
    category: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    recommendation: string;
    status: 'open' | 'in_progress' | 'resolved';
    dueDate?: string;
  }>>().default([]),

  // Evidence
  evidenceUrls: jsonb("evidence_urls").$type<string[]>().default([]),
  notes: text("notes"),

  // Reviewer
  reviewedBy: uuid("reviewed_by"),
  approvedBy: uuid("approved_by"),
  approvalDate: timestamp("approval_date"),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("dpa_check_tenant_idx").on(table.tenantId),
  dpaIdx: index("dpa_check_dpa_idx").on(table.dpaId),
  checkDateIdx: index("dpa_check_date_idx").on(table.checkDate),
}));

// ============= DATA EXPORT TABLES =============

/**
 * Personal Data Exports Table
 * Tracks data export requests for GDPR portability
 */
export const personalDataExports = pgTable("personal_data_exports", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),

  // Request Reference
  gdprRequestId: uuid("gdpr_request_id"), // Links to gdpr_requests if from formal request
  exportNumber: varchar("export_number", { length: 100 }),

  // Subject Information
  subjectType: varchar("subject_type", { length: 50 }).notNull(),
  subjectId: uuid("subject_id").notNull(),
  subjectEmail: varchar("subject_email", { length: 255 }),

  // Request Details
  requestedBy: uuid("requested_by").notNull(),
  requestedByType: varchar("requested_by_type", { length: 50 }).notNull(), // 'subject', 'admin', 'legal', 'system'
  purpose: varchar("purpose", { length: 255 }), // 'portability', 'access_request', 'internal_audit', 'legal'

  // Export Configuration
  format: exportFormatEnum("format").notNull().default('json'),
  includedCategories: jsonb("included_categories").$type<string[]>().default([]),
  excludedCategories: jsonb("excluded_categories").$type<string[]>().default([]),
  includedTables: jsonb("included_tables").$type<string[]>().default([]),
  dateRangeStart: timestamp("date_range_start"),
  dateRangeEnd: timestamp("date_range_end"),

  // Processing Status
  status: exportStatusEnum("status").notNull().default('pending'),
  progress: integer("progress").default(0), // 0-100
  processingStartedAt: timestamp("processing_started_at"),
  processingCompletedAt: timestamp("processing_completed_at"),
  errorMessage: text("error_message"),

  // Export Results
  recordCount: integer("record_count"),
  fileSize: integer("file_size"), // In bytes
  filePath: text("file_path"), // Internal storage path
  downloadUrl: text("download_url"), // Signed/temporary URL
  downloadExpiry: timestamp("download_expiry"),
  downloadCount: integer("download_count").default(0),
  lastDownloadedAt: timestamp("last_downloaded_at"),

  // Security
  encrypted: boolean("encrypted").default(true),
  encryptionKey: varchar("encryption_key", { length: 255 }), // For encrypted exports
  password: varchar("password", { length: 255 }), // For password-protected exports

  // Delivery
  deliveryMethod: varchar("delivery_method", { length: 50 }).default('download'), // 'download', 'email', 'secure_link'
  deliveryEmail: varchar("delivery_email", { length: 255 }),
  deliverySentAt: timestamp("delivery_sent_at"),

  // Verification
  identityVerified: boolean("identity_verified").default(false),
  verificationMethod: varchar("verification_method", { length: 100 }),
  verificationDate: timestamp("verification_date"),

  // Metadata
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  notes: text("notes"),

  // Audit
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"), // Soft delete after expiry
}, (table) => ({
  tenantIdx: index("data_export_tenant_idx").on(table.tenantId),
  subjectIdx: index("data_export_subject_idx").on(table.tenantId, table.subjectId),
  statusIdx: index("data_export_status_idx").on(table.tenantId, table.status),
  gdprRequestIdx: index("data_export_gdpr_request_idx").on(table.gdprRequestId),
}));

/**
 * Data Export Templates Table
 * Pre-configured export templates
 */
export const dataExportTemplates = pgTable("data_export_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),

  // Template Details
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isDefault: boolean("is_default").default(false),

  // Export Configuration
  format: exportFormatEnum("format").default('json'),
  includedCategories: jsonb("included_categories").$type<string[]>().default([]),
  excludedCategories: jsonb("excluded_categories").$type<string[]>().default([]),
  includedTables: jsonb("included_tables").$type<string[]>().default([]),
  fieldMappings: jsonb("field_mappings").$type<Record<string, string>>().default({}),

  // Export Options
  includeMetadata: boolean("include_metadata").default(true),
  includeAuditTrail: boolean("include_audit_trail").default(false),
  anonymizeData: boolean("anonymize_data").default(false),

  // Status
  isActive: boolean("is_active").default(true),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("export_template_tenant_idx").on(table.tenantId),
  activeIdx: index("export_template_active_idx").on(table.tenantId, table.isActive),
}));

// ============= CONTACT DEDUPLICATION TABLES =============

/**
 * Duplicate Detection Rules Table
 * Configurable rules for detecting duplicates
 */
export const duplicateDetectionRules = pgTable("duplicate_detection_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),

  // Rule Details
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  entityType: varchar("entity_type", { length: 50 }).notNull(), // 'contact', 'company', 'lead', 'customer'

  // Matching Configuration
  matchingFields: jsonb("matching_fields").$type<Array<{
    fieldName: string;
    weight: number; // 0-100
    matchType: 'exact' | 'fuzzy' | 'phonetic' | 'normalized';
    caseSensitive?: boolean;
    threshold?: number; // For fuzzy matching (0-100)
  }>>().notNull(),

  // Thresholds
  minimumScore: integer("minimum_score").default(80), // 0-100, below this = no match
  autoMergeThreshold: integer("auto_merge_threshold"), // null = no auto-merge

  // Merge Configuration
  defaultMergeStrategy: mergeStrategyEnum("default_merge_strategy").default('manual'),
  fieldMergeRules: jsonb("field_merge_rules").$type<Record<string, {
    strategy: 'keep_primary' | 'keep_secondary' | 'combine' | 'newer' | 'older' | 'manual';
    combineDelimiter?: string;
  }>>().default({}),

  // Execution Settings
  isActive: boolean("is_active").default(true),
  runOnImport: boolean("run_on_import").default(true),
  runOnCreate: boolean("run_on_create").default(true),
  runOnSchedule: boolean("run_on_schedule").default(false),
  scheduleExpression: varchar("schedule_expression", { length: 100 }), // Cron expression

  // Statistics
  lastRunAt: timestamp("last_run_at"),
  lastRunDuration: integer("last_run_duration_ms"),
  totalDuplicatesFound: integer("total_duplicates_found").default(0),

  // Timestamps
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("dup_rule_tenant_idx").on(table.tenantId),
  entityTypeIdx: index("dup_rule_entity_type_idx").on(table.tenantId, table.entityType),
  activeIdx: index("dup_rule_active_idx").on(table.tenantId, table.isActive),
}));

/**
 * Duplicate Matches Table
 * Stores detected duplicate pairs
 */
export const duplicateMatches = pgTable("duplicate_matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),

  // Detection Rule
  ruleId: uuid("rule_id"),

  // Duplicate Pair
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  primaryRecordId: uuid("primary_record_id").notNull(),
  secondaryRecordId: uuid("secondary_record_id").notNull(),

  // Matching Details
  matchScore: integer("match_score").notNull(), // 0-100
  matchType: duplicateMatchTypeEnum("match_type").notNull(),
  matchedFields: jsonb("matched_fields").$type<Array<{
    fieldName: string;
    primaryValue: string | null;
    secondaryValue: string | null;
    similarity: number;
    matchType: string;
  }>>().default([]),

  // Status
  status: varchar("status", { length: 50 }).notNull().default('pending'), // 'pending', 'reviewing', 'merged', 'dismissed', 'auto_merged'
  confidence: varchar("confidence", { length: 20 }), // 'high', 'medium', 'low'

  // Resolution
  resolution: varchar("resolution", { length: 50 }), // 'merged', 'not_duplicate', 'keep_both', 'merged_reversed'
  resolvedBy: uuid("resolved_by"),
  resolvedAt: timestamp("resolved_at"),
  resolutionNotes: text("resolution_notes"),

  // Merge Details (if merged)
  mergedRecordId: uuid("merged_record_id"),
  mergeStrategy: mergeStrategyEnum("merge_strategy"),

  // Detection Source
  detectedSource: varchar("detected_source", { length: 50 }), // 'import', 'scheduled_scan', 'real_time', 'manual'

  // Timestamps
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("dup_match_tenant_idx").on(table.tenantId),
  statusIdx: index("dup_match_status_idx").on(table.tenantId, table.status),
  primaryIdx: index("dup_match_primary_idx").on(table.primaryRecordId),
  secondaryIdx: index("dup_match_secondary_idx").on(table.secondaryRecordId),
  entityTypeIdx: index("dup_match_entity_idx").on(table.tenantId, table.entityType),
  scoreIdx: index("dup_match_score_idx").on(table.matchScore),
}));

/**
 * Contact Merge History Table
 * Audit trail for all merge operations
 */
export const contactMergeHistory = pgTable("contact_merge_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),

  // Merge Details
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  survivingRecordId: uuid("surviving_record_id").notNull(), // Record that remains
  mergedRecordId: uuid("merged_record_id").notNull(), // Record that was merged into surviving
  duplicateMatchId: uuid("duplicate_match_id"), // Reference to duplicate match if from dedup

  // Record Snapshots
  survivingRecordBefore: jsonb("surviving_record_before"),
  survivingRecordAfter: jsonb("surviving_record_after"),
  mergedRecordSnapshot: jsonb("merged_record_snapshot"), // Full snapshot of merged record before deletion

  // Field-Level Merge Details
  fieldResolutions: jsonb("field_resolutions").$type<Array<{
    fieldName: string;
    survivingValue: any;
    mergedValue: any;
    resultValue: any;
    strategy: string;
    source: 'surviving' | 'merged' | 'combined' | 'manual';
  }>>().default([]),

  // Related Data Updates
  relatedUpdates: jsonb("related_updates").$type<Array<{
    tableName: string;
    recordCount: number;
    fieldUpdated: string;
    oldValue: string;
    newValue: string;
  }>>().default([]),

  // Merge Context
  mergeType: varchar("merge_type", { length: 50 }), // 'manual', 'auto', 'bulk', 'import'
  mergeReason: text("merge_reason"),

  // Rollback Support
  canRollback: boolean("can_rollback").default(true),
  rolledBackAt: timestamp("rolled_back_at"),
  rolledBackBy: uuid("rolled_back_by"),
  rollbackReason: text("rollback_reason"),

  // Actor
  mergedBy: uuid("merged_by").notNull(),

  // Timestamps
  mergedAt: timestamp("merged_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("merge_history_tenant_idx").on(table.tenantId),
  survivingIdx: index("merge_history_surviving_idx").on(table.survivingRecordId),
  mergedIdx: index("merge_history_merged_idx").on(table.mergedRecordId),
  mergedAtIdx: index("merge_history_merged_at_idx").on(table.mergedAt),
}));

/**
 * Duplicate Scan Jobs Table
 * Tracks scheduled and on-demand duplicate scans
 */
export const duplicateScanJobs = pgTable("duplicate_scan_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),

  // Job Details
  name: varchar("name", { length: 255 }),
  jobType: varchar("job_type", { length: 50 }).notNull(), // 'full_scan', 'incremental', 'targeted'
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  ruleId: uuid("rule_id"),

  // Scope (for targeted scans)
  targetRecordIds: jsonb("target_record_ids").$type<string[]>(),

  // Status
  status: varchar("status", { length: 50 }).notNull().default('pending'), // 'pending', 'running', 'completed', 'failed', 'cancelled'
  progress: integer("progress").default(0), // 0-100

  // Timing
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),

  // Results
  recordsScanned: integer("records_scanned").default(0),
  duplicatesFound: integer("duplicates_found").default(0),
  autoMerged: integer("auto_merged").default(0),
  errorMessage: text("error_message"),

  // Triggered By
  triggeredBy: uuid("triggered_by"),
  triggerType: varchar("trigger_type", { length: 50 }), // 'manual', 'scheduled', 'import', 'api'

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("scan_job_tenant_idx").on(table.tenantId),
  statusIdx: index("scan_job_status_idx").on(table.tenantId, table.status),
  scheduledIdx: index("scan_job_scheduled_idx").on(table.scheduledAt),
}));

// ============= RELATIONS =============

export const consentRecordsRelations = relations(consentRecords, ({ many }) => ({
  auditTrail: many(consentAuditTrail),
}));

export const consentAuditTrailRelations = relations(consentAuditTrail, ({ one }) => ({
  consentRecord: one(consentRecords, {
    fields: [consentAuditTrail.consentRecordId],
    references: [consentRecords.id],
  }),
}));

export const dataProcessingAgreementsRelations = relations(dataProcessingAgreements, ({ many }) => ({
  complianceChecks: many(dpaComplianceChecks),
}));

export const dpaComplianceChecksRelations = relations(dpaComplianceChecks, ({ one }) => ({
  dpa: one(dataProcessingAgreements, {
    fields: [dpaComplianceChecks.dpaId],
    references: [dataProcessingAgreements.id],
  }),
}));

export const duplicateMatchesRelations = relations(duplicateMatches, ({ one }) => ({
  rule: one(duplicateDetectionRules, {
    fields: [duplicateMatches.ruleId],
    references: [duplicateDetectionRules.id],
  }),
}));

export const contactMergeHistoryRelations = relations(contactMergeHistory, ({ one }) => ({
  duplicateMatch: one(duplicateMatches, {
    fields: [contactMergeHistory.duplicateMatchId],
    references: [duplicateMatches.id],
  }),
}));

// ============= INSERT SCHEMAS =============

export const insertConsentRecordSchema = createInsertSchema(consentRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConsentAuditTrailSchema = createInsertSchema(consentAuditTrail).omit({
  id: true,
  changedAt: true,
});

export const insertConsentPreferencesTemplateSchema = createInsertSchema(consentPreferencesTemplate).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDataProcessingAgreementSchema = createInsertSchema(dataProcessingAgreements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDpaComplianceCheckSchema = createInsertSchema(dpaComplianceChecks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPersonalDataExportSchema = createInsertSchema(personalDataExports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDataExportTemplateSchema = createInsertSchema(dataExportTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDuplicateDetectionRuleSchema = createInsertSchema(duplicateDetectionRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDuplicateMatchSchema = createInsertSchema(duplicateMatches).omit({
  id: true,
  detectedAt: true,
  updatedAt: true,
});

export const insertContactMergeHistorySchema = createInsertSchema(contactMergeHistory).omit({
  id: true,
  mergedAt: true,
});

export const insertDuplicateScanJobSchema = createInsertSchema(duplicateScanJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ============= TYPE EXPORTS =============

export type ConsentRecord = typeof consentRecords.$inferSelect;
export type InsertConsentRecord = z.infer<typeof insertConsentRecordSchema>;

export type ConsentAuditTrail = typeof consentAuditTrail.$inferSelect;
export type InsertConsentAuditTrail = z.infer<typeof insertConsentAuditTrailSchema>;

export type ConsentPreferencesTemplate = typeof consentPreferencesTemplate.$inferSelect;
export type InsertConsentPreferencesTemplate = z.infer<typeof insertConsentPreferencesTemplateSchema>;

export type DataProcessingAgreement = typeof dataProcessingAgreements.$inferSelect;
export type InsertDataProcessingAgreement = z.infer<typeof insertDataProcessingAgreementSchema>;

export type DpaComplianceCheck = typeof dpaComplianceChecks.$inferSelect;
export type InsertDpaComplianceCheck = z.infer<typeof insertDpaComplianceCheckSchema>;

export type PersonalDataExport = typeof personalDataExports.$inferSelect;
export type InsertPersonalDataExport = z.infer<typeof insertPersonalDataExportSchema>;

export type DataExportTemplate = typeof dataExportTemplates.$inferSelect;
export type InsertDataExportTemplate = z.infer<typeof insertDataExportTemplateSchema>;

export type DuplicateDetectionRule = typeof duplicateDetectionRules.$inferSelect;
export type InsertDuplicateDetectionRule = z.infer<typeof insertDuplicateDetectionRuleSchema>;

export type DuplicateMatch = typeof duplicateMatches.$inferSelect;
export type InsertDuplicateMatch = z.infer<typeof insertDuplicateMatchSchema>;

export type ContactMergeHistory = typeof contactMergeHistory.$inferSelect;
export type InsertContactMergeHistory = z.infer<typeof insertContactMergeHistorySchema>;

export type DuplicateScanJob = typeof duplicateScanJobs.$inferSelect;
export type InsertDuplicateScanJob = z.infer<typeof insertDuplicateScanJobSchema>;
