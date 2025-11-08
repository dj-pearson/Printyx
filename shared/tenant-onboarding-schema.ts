/**
 * Tenant Onboarding Database Schema
 * Tables for tenant templates, onboarding wizard, integration setup, and health validation
 */

import { pgTable, uuid, varchar, text, timestamp, jsonb, boolean, integer, pgEnum, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// ============= ENUMS =============

export const onboardingStatusEnum = pgEnum('onboarding_status', ['not_started', 'in_progress', 'completed', 'abandoned', 'failed']);

export const onboardingStepStatusEnum = pgEnum('onboarding_step_status', ['pending', 'in_progress', 'completed', 'skipped', 'failed']);

export const companySizeEnum = pgEnum('company_size', ['small', 'medium', 'large', 'enterprise']);

export const industryTypeEnum = pgEnum('industry_type', [
  'managed_print_services',
  'it_services',
  'equipment_rental',
  'field_services',
  'manufacturing',
  'healthcare',
  'education',
  'finance',
  'retail',
  'other'
]);

export const integrationStatusEnum = pgEnum('integration_status', ['not_configured', 'configuring', 'testing', 'active', 'failed', 'disabled']);

export const healthScoreGradeEnum = pgEnum('health_score_grade', ['excellent', 'good', 'fair', 'poor', 'critical']);

// ============= TENANT ONBOARDING TEMPLATES TABLE =============

export const tenantOnboardingTemplates = pgTable("tenant_onboarding_templates", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Template Identity
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  industry: industryTypeEnum("industry").notNull(),
  companySize: companySizeEnum("company_size").notNull(),

  // Organizational Structure Template
  organizationalStructure: jsonb("organizational_structure").$type<{
    companyLevel: { name: string; description?: string };
    regionalLevel?: {
      enabled: boolean;
      defaultCount: number;
      naming: string; // e.g., "Region {number}"
    };
    locationLevel?: {
      enabled: boolean;
      defaultCount: number;
      naming: string;
    };
  }>().notNull(),

  // Subscription Configuration
  subscriptionPlan: varchar("subscription_plan", { length: 100 }), // 'basic', 'professional', 'enterprise'
  defaultBillingCycle: varchar("default_billing_cycle", { length: 50 }), // 'monthly', 'annual'
  defaultTrialDays: integer("default_trial_days"),

  // User Role Templates
  userRoleTemplates: jsonb("user_role_templates").$type<Array<{
    roleType: string; // 'company_admin', 'regional_manager', 'location_manager', 'technician'
    count: number;
    roleIds: string[];
    permissions: any;
  }>>(),

  // Integration Configuration
  integrationConfigs: jsonb("integration_configs").$type<{
    quickbooks?: {
      enabled: boolean;
      autoSync: boolean;
      syncSchedule?: string;
      fieldMapping?: any;
    };
    salesforce?: {
      enabled: boolean;
      bidirectional: boolean;
      conflictResolution?: string;
      fieldMapping?: any;
    };
    eAutomate?: {
      enabled: boolean;
      equipmentTracking: boolean;
    };
    email?: {
      enabled: boolean;
      smtp: boolean;
      imap: boolean;
    };
  }>(),

  // Custom Fields Configuration
  customFields: jsonb("custom_fields").$type<{
    customers?: Array<{
      fieldName: string;
      fieldType: string;
      required: boolean;
      defaultValue?: any;
    }>;
    equipment?: Array<{
      fieldName: string;
      fieldType: string;
      required: boolean;
      defaultValue?: any;
    }>;
    serviceTickets?: Array<{
      fieldName: string;
      fieldType: string;
      required: boolean;
      defaultValue?: any;
    }>;
  }>(),

  // Workflow Templates
  workflows: jsonb("workflows").$type<{
    serviceTicketRouting?: {
      enabled: boolean;
      rules: Array<{
        condition: string;
        action: string;
      }>;
    };
    approvalChains?: {
      enabled: boolean;
      thresholds: any;
    };
    notifications?: {
      enabled: boolean;
      templates: string[];
    };
  }>(),

  // Sample/Initial Data
  sampleData: jsonb("sample_data").$type<{
    customers?: {
      enabled: boolean;
      count: number;
    };
    equipment?: {
      enabled: boolean;
      catalog: string[]; // Product types to include
    };
    inventory?: {
      enabled: boolean;
      partsCategories: string[];
    };
  }>(),

  // Default Settings
  settings: jsonb("settings").$type<{
    timezone?: string;
    currency?: string;
    dateFormat?: string;
    timeFormat?: string;
    language?: string;
    theme?: string;
  }>(),

  // Branding
  brandingOptions: jsonb("branding_options").$type<{
    allowCustomLogo?: boolean;
    allowCustomColors?: boolean;
    defaultColors?: {
      primary?: string;
      secondary?: string;
    };
  }>(),

  // Performance Metrics
  usageCount: integer("usage_count").default(0),
  avgOnboardingTime: integer("avg_onboarding_time_minutes"),
  successRate: integer("success_rate_percent"),
  lastUsed: timestamp("last_used"),

  // Template Status
  isActive: boolean("is_active").default(true),
  isDefault: boolean("is_default").default(false), // Default for industry/size combination

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: uuid("created_by"),
});

// ============= TENANT ONBOARDING SESSIONS TABLE =============

export const tenantOnboardingSessions = pgTable("tenant_onboarding_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Session Identity
  sessionToken: varchar("session_token", { length: 255 }).notNull().unique(),
  templateId: uuid("template_id"), // Can be null if custom onboarding

  // Current State
  currentStep: integer("current_step").notNull().default(1),
  totalSteps: integer("total_steps").notNull().default(8),
  status: onboardingStatusEnum("status").notNull().default('not_started'),

  // Step Data (collected through wizard)
  stepData: jsonb("step_data").$type<{
    step1_companyInfo?: {
      companyName: string;
      industry: string;
      companySize: string;
      address?: any;
      logo?: string;
      primaryAdminEmail: string;
      primaryAdminName: string;
    };
    step2_orgStructure?: {
      regionalOffices: Array<{
        name: string;
        location?: string;
      }>;
      serviceLocations: Array<{
        name: string;
        regionalOffice?: string;
        address?: any;
      }>;
    };
    step3_subscription?: {
      plan: string;
      billingCycle: string;
      trialPeriod: number;
      paymentMethod?: string;
    };
    step4_users?: {
      users: Array<{
        name: string;
        email: string;
        role: string;
        department?: string;
        location?: string;
      }>;
      ssoEnabled: boolean;
    };
    step5_integrations?: {
      quickbooks?: { configured: boolean; settings?: any };
      salesforce?: { configured: boolean; settings?: any };
      email?: { configured: boolean; settings?: any };
    };
    step6_dataImport?: {
      customersImported: number;
      equipmentImported: number;
      contractsImported: number;
      inventoryImported: number;
    };
    step7_customization?: {
      customFields: any[];
      workflows: any[];
      emailTemplates: string[];
      branding: any;
    };
    step8_verification?: {
      checksCompleted: string[];
      healthScore: number;
    };
  }>(),

  // Progress Tracking
  progressPercent: integer("progress_percent").default(0),
  stepsCompleted: jsonb("steps_completed").$type<number[]>().default([]),

  // Validation Errors
  validationErrors: jsonb("validation_errors").$type<{
    [stepNumber: string]: string[];
  }>(),

  // Created Tenant (on completion)
  tenantId: uuid("tenant_id"), // Set when onboarding completes
  tenantActivated: boolean("tenant_activated").default(false),

  // Session Management
  createdBy: uuid("created_by").notNull(),
  lastAccessedAt: timestamp("last_accessed_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"), // Sessions expire after inactivity

  // Timeline
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  abandonedAt: timestamp("abandoned_at"),
  failedAt: timestamp("failed_at"),

  // Error Tracking
  errorMessage: text("error_message"),
  errorDetails: jsonb("error_details"),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============= INTEGRATION SETUP LOGS TABLE =============

export const integrationSetupLogs = pgTable("integration_setup_logs", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Reference
  onboardingSessionId: uuid("onboarding_session_id"),
  tenantId: uuid("tenant_id"), // Can be set post-onboarding too

  // Integration Details
  integrationType: varchar("integration_type", { length: 100 }).notNull(), // 'quickbooks', 'salesforce', 'email', etc.
  integrationName: varchar("integration_name", { length: 255 }),

  // Setup Steps
  setupSteps: jsonb("setup_steps").$type<Array<{
    stepNumber: number;
    stepName: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    startedAt?: string;
    completedAt?: string;
    error?: string;
  }>>().notNull(),

  // Configuration
  configuration: jsonb("configuration").$type<{
    credentials?: any; // Encrypted separately
    settings?: any;
    fieldMapping?: any;
    syncSchedule?: string;
  }>(),

  // Testing
  testsPassed: boolean("tests_passed").default(false),
  testResults: jsonb("test_results").$type<{
    connectionTest?: { passed: boolean; message?: string };
    authTest?: { passed: boolean; message?: string };
    syncTest?: { passed: boolean; recordCount?: number; message?: string };
  }>(),

  // Auto-Configuration
  autoConfigured: boolean("auto_configured").default(false),
  autoConfigurationScore: integer("auto_configuration_score"), // 0-100, how much was automated

  // Status
  status: integrationStatusEnum("status").notNull().default('not_configured'),

  // Performance
  setupDuration: integer("setup_duration_minutes"),
  initialSyncDuration: integer("initial_sync_duration_minutes"),
  recordsSynced: integer("records_synced"),

  // Errors
  errorCount: integer("error_count").default(0),
  lastError: text("last_error"),

  // Timestamps
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============= DATA IMPORT VALIDATIONS TABLE =============

export const dataImportValidations = pgTable("data_import_validations", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Reference
  onboardingSessionId: uuid("onboarding_session_id"),
  tenantId: uuid("tenant_id"),

  // Import Details
  dataType: varchar("data_type", { length: 100 }).notNull(), // 'customers', 'equipment', 'contracts', 'inventory'
  fileName: varchar("file_name", { length: 255 }),
  fileSize: integer("file_size_bytes"),

  // Column Mapping
  detectedColumns: jsonb("detected_columns").$type<string[]>(),
  columnMappings: jsonb("column_mappings").$type<{
    [csvColumn: string]: {
      mappedTo: string;
      confidence: number; // 0-100
      dataType: string;
    };
  }>(),

  // Validation Results
  totalRows: integer("total_rows").notNull(),
  validRows: integer("valid_rows").default(0),
  invalidRows: integer("invalid_rows").default(0),
  warningRows: integer("warning_rows").default(0),

  // Errors & Warnings
  errors: jsonb("errors").$type<Array<{
    row: number;
    column?: string;
    errorType: string;
    message: string;
    value?: string;
  }>>(),
  warnings: jsonb("warnings").$type<Array<{
    row: number;
    column?: string;
    warningType: string;
    message: string;
    suggestion?: string;
  }>>(),

  // Duplicate Detection
  duplicatesFound: integer("duplicates_found").default(0),
  duplicateDetails: jsonb("duplicate_details").$type<Array<{
    row: number;
    duplicateOf: number;
    matchingFields: string[];
    mergeRecommended: boolean;
  }>>(),

  // Bulk Fix Suggestions
  bulkFixSuggestions: jsonb("bulk_fix_suggestions").$type<Array<{
    suggestionType: string; // 'format_phone', 'standardize_address', 'merge_duplicates'
    description: string;
    affectedRows: number[];
    autoApplicable: boolean;
    applied: boolean;
  }>>(),

  // Import Execution
  importExecuted: boolean("import_executed").default(false),
  importedRows: integer("imported_rows"),
  failedRows: integer("failed_rows"),
  importedAt: timestamp("imported_at"),

  // Rollback Capability
  rollbackSupported: boolean("rollback_supported").default(true),
  rolledBack: boolean("rolled_back").default(false),
  rollbackAt: timestamp("rollback_at"),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============= TENANT HEALTH SCORES TABLE =============

export const tenantHealthScores = pgTable("tenant_health_scores", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Reference
  tenantId: uuid("tenant_id").notNull().unique(), // One health score per tenant

  // Overall Score
  overallScore: integer("overall_score").notNull(), // 0-100
  overallGrade: healthScoreGradeEnum("overall_grade").notNull(),

  // Component Scores
  isolationScore: integer("isolation_score").notNull(), // 0-100
  isolationGrade: healthScoreGradeEnum("isolation_grade"),

  accessScore: integer("access_score").notNull(),
  accessGrade: healthScoreGradeEnum("access_grade"),

  integrationScore: integer("integration_score").notNull(),
  integrationGrade: healthScoreGradeEnum("integration_grade"),

  dataQualityScore: integer("data_quality_score").notNull(),
  dataQualityGrade: healthScoreGradeEnum("data_quality_grade"),

  performanceScore: integer("performance_score").notNull(),
  performanceGrade: healthScoreGradeEnum("performance_grade"),

  // Detailed Validation Results
  validationResults: jsonb("validation_results").$type<{
    tenantIsolation: Array<{
      check: string;
      passed: boolean;
      message?: string;
    }>;
    userAccess: Array<{
      check: string;
      passed: boolean;
      message?: string;
    }>;
    integrationHealth: Array<{
      integration: string;
      check: string;
      passed: boolean;
      message?: string;
    }>;
    dataQuality: Array<{
      check: string;
      passed: boolean;
      message?: string;
    }>;
    performance: Array<{
      metric: string;
      value: number;
      threshold: number;
      passed: boolean;
    }>;
  }>(),

  // Recommendations
  recommendations: jsonb("recommendations").$type<Array<{
    priority: 'high' | 'medium' | 'low';
    category: string;
    title: string;
    description: string;
    actionable: boolean;
    action?: string;
  }>>(),

  // Issues Found
  criticalIssues: integer("critical_issues").default(0),
  warnings: integer("warnings").default(0),

  // Performance Metrics
  dashboardLoadTime: integer("dashboard_load_time_ms"),
  avgQueryTime: integer("avg_query_time_ms"),
  errorRate: decimal("error_rate", { precision: 5, scale: 2 }),

  // Trend
  previousScore: integer("previous_score"),
  scoreChange: integer("score_change"), // +/- from previous
  trend: varchar("trend", { length: 20 }), // 'improving', 'stable', 'declining'

  // Calculation Details
  checksPerformed: integer("checks_performed").notNull(),
  checksPassed: integer("checks_passed").notNull(),
  checksPassRate: integer("checks_pass_rate").notNull(), // percentage

  // Timestamps
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  nextCalculation: timestamp("next_calculation"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============= ONBOARDING ANALYTICS TABLE =============

export const onboardingAnalytics = pgTable("onboarding_analytics", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Time Period
  period: varchar("period", { length: 50 }).notNull(), // 'weekly', 'monthly', 'quarterly'
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),

  // Volume Metrics
  onboardingsStarted: integer("onboardings_started").default(0),
  onboardingsCompleted: integer("onboardings_completed").default(0),
  onboardingsAbandoned: integer("onboardings_abandoned").default(0),
  onboardingsFailed: integer("onboardings_failed").default(0),

  // Success Metrics
  completionRate: integer("completion_rate_percent"),
  avgCompletionTime: integer("avg_completion_time_minutes"),
  medianCompletionTime: integer("median_completion_time_minutes"),

  // Template Usage
  templateUsage: jsonb("template_usage").$type<{
    [templateId: string]: {
      templateName: string;
      count: number;
      successRate: number;
      avgTime: number;
    };
  }>(),

  // Step Analytics
  stepMetrics: jsonb("step_metrics").$type<{
    [stepNumber: string]: {
      stepName: string;
      avgTimeSpent: number; // minutes
      completionRate: number; // percentage
      commonErrors: string[];
    };
  }>(),

  // Bottlenecks
  commonBottlenecks: jsonb("common_bottlenecks").$type<Array<{
    step: number;
    stepName: string;
    avgStuckTime: number; // minutes users spend stuck on this step
    abandonmentRate: number; // percentage who abandon at this step
  }>>(),

  // Integration Metrics
  integrationSetupMetrics: jsonb("integration_setup_metrics").$type<{
    [integrationType: string]: {
      setupAttempts: number;
      setupSuccesses: number;
      avgSetupTime: number;
      commonErrors: string[];
    };
  }>(),

  // Data Import Metrics
  dataImportMetrics: jsonb("data_import_metrics").$type<{
    avgCustomersImported: number;
    avgEquipmentImported: number;
    avgErrorRate: number; // percentage
    commonValidationErrors: string[];
  }>(),

  // Health Score Distribution
  healthScoreDistribution: jsonb("health_score_distribution").$type<{
    excellent: number; // count
    good: number;
    fair: number;
    poor: number;
    critical: number;
  }>(),

  // Timestamps
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============= TENANT CLONE OPERATIONS TABLE =============

export const tenantCloneOperations = pgTable("tenant_clone_operations", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Clone Details
  sourceTenantId: uuid("source_tenant_id").notNull(),
  targetTenantId: uuid("target_tenant_id"), // Set when clone completes
  cloneType: varchar("clone_type", { length: 50 }).notNull(), // 'full', 'configuration_only', 'structure_only'

  // What to Clone
  cloneSettings: jsonb("clone_settings").$type<{
    organizationalStructure: boolean;
    roleAssignments: boolean; // Role types, not actual users
    customFields: boolean;
    workflows: boolean;
    integrationSettings: boolean; // Requires re-auth
    emailTemplates: boolean;
    branding: boolean;
    sampleData: boolean;
  }>().notNull(),

  // Progress
  status: onboardingStatusEnum("status").notNull().default('not_started'),
  progressPercent: integer("progress_percent").default(0),

  // Items Cloned
  itemsCloned: jsonb("items_cloned").$type<{
    organizationalUnits: number;
    roleTemplates: number;
    customFields: number;
    workflows: number;
    emailTemplates: number;
  }>(),

  // Modifications
  modifications: jsonb("modifications").$type<Array<{
    field: string;
    originalValue: any;
    newValue: any;
  }>>(),

  // Execution Details
  initiatedBy: uuid("initiated_by").notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  duration: integer("duration_minutes"),

  // Errors
  errorCount: integer("error_count").default(0),
  errors: jsonb("errors").$type<Array<{
    step: string;
    error: string;
  }>>(),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============= INSERT SCHEMAS =============

export const insertTenantOnboardingTemplateSchema = createInsertSchema(tenantOnboardingTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTenantOnboardingSessionSchema = createInsertSchema(tenantOnboardingSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIntegrationSetupLogSchema = createInsertSchema(integrationSetupLogs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDataImportValidationSchema = createInsertSchema(dataImportValidations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTenantHealthScoreSchema = createInsertSchema(tenantHealthScores).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOnboardingAnalyticsSchema = createInsertSchema(onboardingAnalytics).omit({
  id: true,
  createdAt: true,
});

export const insertTenantCloneOperationSchema = createInsertSchema(tenantCloneOperations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ============= TYPE EXPORTS =============

export type TenantOnboardingTemplate = typeof tenantOnboardingTemplates.$inferSelect;
export type InsertTenantOnboardingTemplate = typeof tenantOnboardingTemplates.$inferInsert;

export type TenantOnboardingSession = typeof tenantOnboardingSessions.$inferSelect;
export type InsertTenantOnboardingSession = typeof tenantOnboardingSessions.$inferInsert;

export type IntegrationSetupLog = typeof integrationSetupLogs.$inferSelect;
export type InsertIntegrationSetupLog = typeof integrationSetupLogs.$inferInsert;

export type DataImportValidation = typeof dataImportValidations.$inferSelect;
export type InsertDataImportValidation = typeof dataImportValidations.$inferInsert;

export type TenantHealthScore = typeof tenantHealthScores.$inferSelect;
export type InsertTenantHealthScore = typeof tenantHealthScores.$inferInsert;

export type OnboardingAnalytics = typeof onboardingAnalytics.$inferSelect;
export type InsertOnboardingAnalytics = typeof onboardingAnalytics.$inferInsert;

export type TenantCloneOperation = typeof tenantCloneOperations.$inferSelect;
export type InsertTenantCloneOperation = typeof tenantCloneOperations.$inferInsert;
