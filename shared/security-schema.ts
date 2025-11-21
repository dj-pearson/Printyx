/**
 * Security & Compliance Database Schema
 * Tables for audit logging, data access tracking, GDPR compliance, and session management
 */

import { pgTable, uuid, varchar, text, timestamp, jsonb, boolean, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// ============= ENUMS =============

export const auditSeverityEnum = pgEnum('audit_severity', ['low', 'medium', 'high', 'critical']);
export const auditCategoryEnum = pgEnum('audit_category', ['authentication', 'authorization', 'data_access', 'data_modification', 'system', 'security']);
export const accessTypeEnum = pgEnum('access_type', ['read', 'write', 'delete', 'export']);
export const dataClassificationEnum = pgEnum('data_classification', ['public', 'internal', 'confidential', 'restricted']);
export const gdprRequestTypeEnum = pgEnum('gdpr_request_type', ['access', 'rectification', 'erasure', 'portability', 'restrict_processing', 'object_processing']);
export const gdprStatusEnum = pgEnum('gdpr_status', ['pending', 'in_progress', 'completed', 'rejected']);

// ============= AUDIT LOGS TABLE =============

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  userId: uuid("user_id").notNull(),
  
  // Action Details
  action: varchar("action", { length: 255 }).notNull(), // e.g., "CREATE_CUSTOMER", "UPDATE_SERVICE_TICKET"
  resource: varchar("resource", { length: 255 }).notNull(), // e.g., "customers", "service_tickets"
  resourceId: uuid("resource_id"), // Specific record ID if applicable
  
  // Data Changes
  oldValues: jsonb("old_values"), // Previous values for updates
  newValues: jsonb("new_values"), // New values for creates/updates
  
  // Request Context
  ipAddress: varchar("ip_address", { length: 45 }).notNull(), // Support IPv6
  userAgent: text("user_agent"),
  sessionId: varchar("session_id", { length: 255 }),
  
  // Classification
  severity: auditSeverityEnum("severity").notNull(),
  category: auditCategoryEnum("category").notNull(),
  
  // Metadata
  requestId: uuid("request_id"), // For correlating related audit entries
  parentActionId: uuid("parent_action_id"), // For nested actions
  additionalContext: jsonb("additional_context"), // Any extra context data
  
  // Timestamps
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// ============= DATA ACCESS LOGS TABLE =============

export const dataAccessLogs = pgTable("data_access_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  userId: uuid("user_id").notNull(),
  
  // Access Details
  resource: varchar("resource", { length: 255 }).notNull(),
  resourceId: uuid("resource_id"),
  accessType: accessTypeEnum("access_type").notNull(),
  
  // Query Information
  query: text("query"), // SQL query or API endpoint
  resultCount: integer("result_count"), // Number of records returned
  responseTime: integer("response_time_ms"), // Query execution time
  
  // Request Context
  ipAddress: varchar("ip_address", { length: 45 }).notNull(),
  userAgent: text("user_agent"),
  sessionId: varchar("session_id", { length: 255 }),
  
  // Data Classification
  dataClassification: dataClassificationEnum("data_classification").notNull(),
  containsPII: boolean("contains_pii").default(false), // Personal Identifiable Information
  
  // Security Flags
  suspiciousActivity: boolean("suspicious_activity").default(false),
  riskScore: integer("risk_score").default(0), // 0-100 risk assessment
  
  // Timestamps
  accessedAt: timestamp("accessed_at").defaultNow().notNull(),
});

// ============= ENCRYPTED FIELDS TABLE =============

export const encryptedFields = pgTable("encrypted_fields", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  
  // Field Reference
  tableName: varchar("table_name", { length: 255 }).notNull(),
  recordId: uuid("record_id").notNull(),
  fieldName: varchar("field_name", { length: 255 }).notNull(),
  
  // Encryption Data
  encryptedValue: text("encrypted_value").notNull(),
  encryptionIv: varchar("encryption_iv", { length: 255 }).notNull(),
  encryptionTag: varchar("encryption_tag", { length: 255 }).notNull(),
  encryptionAlgorithm: varchar("encryption_algorithm", { length: 50 }).notNull().default('aes-256-gcm'),
  
  // Key Management
  keyVersion: varchar("key_version", { length: 50 }).notNull().default('v1'),
  encryptedAt: timestamp("encrypted_at").defaultNow().notNull(),
  
  // Access Control
  accessLevel: dataClassificationEnum("access_level").notNull().default('confidential'),
  retentionPeriod: integer("retention_period_days"), // Days to retain encrypted data
  
  // Metadata
  originalDataType: varchar("original_data_type", { length: 50 }), // 'string', 'number', 'date', etc.
  fieldCategory: varchar("field_category", { length: 100 }), // 'personal', 'financial', 'medical', etc.
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============= GDPR REQUESTS TABLE =============

export const gdprRequests = pgTable("gdpr_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  
  // Request Details
  type: gdprRequestTypeEnum("type").notNull(),
  subjectId: uuid("subject_id").notNull(), // User or customer ID
  subjectEmail: varchar("subject_email", { length: 255 }).notNull(),
  requestorId: uuid("requestor_id").notNull(), // Who made the request
  
  // Request Information
  description: text("description").notNull(),
  legalBasis: text("legal_basis"), // Legal justification for the request
  processingPurpose: text("processing_purpose"), // Why the data was processed
  
  // Status & Timeline
  status: gdprStatusEnum("status").notNull().default('pending'),
  priority: auditSeverityEnum("priority").notNull().default('medium'),
  dueDate: timestamp("due_date").notNull(), // 30 days from request by default
  completionDate: timestamp("completion_date"),
  rejectionReason: text("rejection_reason"),
  
  // Scope
  dataCategories: jsonb("data_categories").$type<string[]>().notNull(), // Types of data affected
  affectedSystems: jsonb("affected_systems").$type<string[]>().notNull(), // Systems containing the data
  
  // Verification
  identityVerified: boolean("identity_verified").default(false),
  verificationMethod: varchar("verification_method", { length: 100 }),
  verificationDate: timestamp("verification_date"),
  
  // Response
  responseData: jsonb("response_data"), // For data portability requests
  responseFormat: varchar("response_format", { length: 50 }), // 'json', 'csv', 'pdf', etc.
  responseSize: integer("response_size_bytes"),
  
  // Audit Trail
  processingNotes: text("processing_notes"),
  approvedBy: uuid("approved_by"), // User who approved the request
  approvalDate: timestamp("approval_date"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============= SECURITY SESSIONS TABLE =============

export const securitySessions = pgTable("security_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  
  // Session Identity
  sessionId: varchar("session_id", { length: 255 }).notNull().unique(),
  userId: uuid("user_id").notNull(),
  tenantId: uuid("tenant_id").notNull(),
  
  // Session Context
  ipAddress: varchar("ip_address", { length: 45 }).notNull(),
  userAgent: text("user_agent"),
  deviceFingerprint: varchar("device_fingerprint", { length: 255 }), // Browser fingerprint
  
  // Session Lifecycle
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastActivity: timestamp("last_activity").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  terminatedAt: timestamp("terminated_at"),
  
  // Session State
  isActive: boolean("is_active").default(true),
  timeoutWarningShown: boolean("timeout_warning_shown").default(false),
  
  // Security Flags
  isSuspicious: boolean("is_suspicious").default(false),
  failedLoginAttempts: integer("failed_login_attempts").default(0),
  lastFailedLogin: timestamp("last_failed_login"),
  
  // Multi-Factor Authentication
  mfaVerified: boolean("mfa_verified").default(false),
  mfaMethod: varchar("mfa_method", { length: 50 }), // 'totp', 'sms', 'email', etc.
  mfaVerifiedAt: timestamp("mfa_verified_at"),
  
  // Location & Risk Assessment
  country: varchar("country", { length: 2 }), // ISO country code
  city: varchar("city", { length: 100 }),
  riskScore: integer("risk_score").default(0), // 0-100
  riskFactors: jsonb("risk_factors").$type<string[]>(), // What contributed to risk score
  
  // Termination Reason
  terminationReason: varchar("termination_reason", { length: 100 }), // 'logout', 'timeout', 'admin', 'security'
  terminatedBy: uuid("terminated_by"), // User who terminated (for admin termination)
});

// ============= COMPLIANCE SETTINGS TABLE =============

export const complianceSettings = pgTable("compliance_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull(),
  
  // GDPR Settings
  gdprEnabled: boolean("gdpr_enabled").default(true),
  gdprContactEmail: varchar("gdpr_contact_email", { length: 255 }),
  gdprResponseDays: integer("gdpr_response_days").default(30),
  automaticDataRetention: boolean("automatic_data_retention").default(false),
  dataRetentionPeriod: integer("data_retention_period_days").default(2555), // 7 years default
  
  // Audit Settings
  auditRetentionPeriod: integer("audit_retention_period_days").default(2555), // 7 years
  auditHighRiskOnly: boolean("audit_high_risk_only").default(false),
  auditFailedLoginsOnly: boolean("audit_failed_logins_only").default(false),
  
  // Session Settings
  sessionTimeoutMinutes: integer("session_timeout_minutes").default(30),
  sessionWarningMinutes: integer("session_warning_minutes").default(25),
  maxConcurrentSessions: integer("max_concurrent_sessions").default(3),
  forceLogoutOnSuspiciousActivity: boolean("force_logout_suspicious").default(true),
  
  // Data Protection
  encryptSensitiveFields: boolean("encrypt_sensitive_fields").default(true),
  maskDataInLogs: boolean("mask_data_in_logs").default(true),
  requireDataClassification: boolean("require_data_classification").default(true),
  
  // Notifications
  notifyOnGdprRequest: boolean("notify_on_gdpr_request").default(true),
  notifyOnSuspiciousActivity: boolean("notify_on_suspicious_activity").default(true),
  notifyOnDataBreach: boolean("notify_on_data_breach").default(true),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============= INSERT SCHEMAS =============

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  timestamp: true,
});

export const insertDataAccessLogSchema = createInsertSchema(dataAccessLogs).omit({
  id: true,
  accessedAt: true,
});

export const insertEncryptedFieldSchema = createInsertSchema(encryptedFields).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGdprRequestSchema = createInsertSchema(gdprRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSecuritySessionSchema = createInsertSchema(securitySessions).omit({
  id: true,
  createdAt: true,
});

export const insertComplianceSettingsSchema = createInsertSchema(complianceSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ============= TYPE EXPORTS =============

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

export type DataAccessLog = typeof dataAccessLogs.$inferSelect;
export type InsertDataAccessLog = typeof dataAccessLogs.$inferInsert;

export type EncryptedField = typeof encryptedFields.$inferSelect;
export type InsertEncryptedField = typeof encryptedFields.$inferInsert;

export type GdprRequest = typeof gdprRequests.$inferSelect;
export type InsertGdprRequest = typeof gdprRequests.$inferInsert;

export type SecuritySession = typeof securitySessions.$inferSelect;
export type InsertSecuritySession = typeof securitySessions.$inferInsert;

export type ComplianceSettings = typeof complianceSettings.$inferSelect;
export type InsertComplianceSettings = typeof complianceSettings.$inferInsert;