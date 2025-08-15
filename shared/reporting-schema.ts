// =====================================================================
// COMPREHENSIVE REPORTING SYSTEM SCHEMA
// Phase 1 Implementation - Core Reporting Infrastructure
// =====================================================================

import {
  pgTable,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  timestamp,
  jsonb,
  date,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// =====================================================================
// ENUMS FOR REPORTING SYSTEM
// =====================================================================

export const reportCategoryEnum = pgEnum('report_category', [
  'sales',
  'service', 
  'finance',
  'operations',
  'hr',
  'it',
  'compliance',
  'executive'
]);

export const organizationalScopeEnum = pgEnum('organizational_scope', [
  'platform',
  'company', 
  'regional',
  'location',
  'team',
  'individual'
]);

export const reportVisualizationEnum = pgEnum('report_visualization', [
  'table',
  'chart',
  'dashboard',
  'kpi_widget',
  'chart_table_combo'
]);

export const exportFormatEnum = pgEnum('export_format', [
  'json',
  'csv',
  'xlsx',
  'pdf'
]);

export const reportStatusEnum = pgEnum('report_status', [
  'success',
  'failed',
  'running',
  'timeout',
  'cancelled'
]);

export const performanceLevelEnum = pgEnum('performance_level', [
  'excellent',
  'good', 
  'warning',
  'critical'
]);

export const timePeriodEnum = pgEnum('time_period', [
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'yearly'
]);

export const deliveryMethodEnum = pgEnum('delivery_method', [
  'email',
  'webhook',
  'sftp',
  'download'
]);

export const targetTypeEnum = pgEnum('target_type', [
  'absolute',
  'percentage',
  'ratio'
]);

export const displayFormatEnum = pgEnum('display_format', [
  'number',
  'currency',
  'percentage',
  'decimal'
]);

export const activityTypeEnum = pgEnum('activity_type', [
  'view_report',
  'export_report',
  'schedule_report',
  'customize_dashboard',
  'create_report',
  'share_report'
]);

// =====================================================================
// CORE REPORTING TABLES
// =====================================================================

// Report Definitions - Master catalog of all available reports
export const reportDefinitions = pgTable("report_definitions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Report Identification
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 100 }).notNull(),
  description: text("description"),
  category: reportCategoryEnum("category").notNull(),
  
  // Report Configuration
  sqlQuery: text("sql_query").notNull(),
  defaultParameters: jsonb("default_parameters").default('{}'),
  availableFilters: jsonb("available_filters").default('{}'),
  availableGroupings: jsonb("available_groupings").default('{}'),
  
  // Access Control
  requiredPermissions: jsonb("required_permissions").notNull(),
  organizationalScope: organizationalScopeEnum("organizational_scope").notNull(),
  containsSensitiveData: boolean("contains_sensitive_data").default(false),
  
  // Display Configuration
  defaultVisualization: reportVisualizationEnum("default_visualization").default('table'),
  chartConfig: jsonb("chart_config").default('{}'),
  
  // Performance Settings
  cacheDuration: integer("cache_duration").default(300), // seconds
  queryTimeout: integer("query_timeout").default(30), // seconds
  maxRowLimit: integer("max_row_limit").default(10000),
  
  // Features
  isRealTime: boolean("is_real_time").default(false),
  supportsDrillDown: boolean("supports_drill_down").default(false),
  supportsExport: boolean("supports_export").default(true),
  
  // Status and Metadata
  isActive: boolean("is_active").default(true),
  version: varchar("version", { length: 10 }).default('1.0'),
  tags: jsonb("tags").default('[]'),
  
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_report_definitions_tenant").on(table.tenantId),
  index("idx_report_definitions_category").on(table.category),
  index("idx_report_definitions_scope").on(table.organizationalScope),
  index("idx_report_definitions_code").on(table.code),
]);

// User Report Preferences - Personalization and customization
export const userReportPreferences = pgTable("user_report_preferences", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  reportDefinitionId: varchar("report_definition_id").notNull(),
  
  // Customization Settings
  customFilters: jsonb("custom_filters").default('{}'),
  customGroupings: jsonb("custom_groupings").default('{}'),
  customChartConfig: jsonb("custom_chart_config").default('{}'),
  customColumns: jsonb("custom_columns").default('[]'),
  sortPreferences: jsonb("sort_preferences").default('{}'),
  
  // Dashboard Settings
  favoriteDashboard: boolean("favorite_dashboard").default(false),
  dashboardPosition: integer("dashboard_position"),
  widgetSize: varchar("widget_size", { length: 20 }).default('medium'),
  
  // Access Tracking
  lastAccessed: timestamp("last_accessed"),
  accessCount: integer("access_count").default(0),
  averageViewDuration: integer("average_view_duration"), // seconds
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_user_preferences_user").on(table.userId),
  index("idx_user_preferences_report").on(table.reportDefinitionId),
  index("idx_user_preferences_favorite").on(table.favoriteDashboard),
]);

// Report Schedules - Automated report generation and distribution
export const reportSchedules = pgTable("report_schedules", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  reportDefinitionId: varchar("report_definition_id").notNull(),
  
  // Schedule Configuration
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  cronExpression: varchar("cron_expression", { length: 100 }).notNull(),
  timezone: varchar("timezone", { length: 50 }).default('UTC'),
  
  // Report Parameters
  parameters: jsonb("parameters").default('{}'),
  filters: jsonb("filters").default('{}'),
  
  // Distribution Settings
  recipients: jsonb("recipients").notNull(), // emails and user IDs
  deliveryMethod: deliveryMethodEnum("delivery_method").default('email'),
  exportFormat: exportFormatEnum("export_format").default('pdf'),
  
  // Email Configuration
  emailSubject: varchar("email_subject", { length: 255 }),
  emailBody: text("email_body"),
  attachFileName: varchar("attach_file_name", { length: 255 }),
  
  // Execution Status
  isActive: boolean("is_active").default(true),
  lastRun: timestamp("last_run"),
  nextRun: timestamp("next_run"),
  runCount: integer("run_count").default(0),
  lastStatus: reportStatusEnum("last_status"),
  lastError: text("last_error"),
  
  // Performance Tracking
  averageExecutionTime: integer("average_execution_time"), // milliseconds
  lastExecutionTime: integer("last_execution_time"),
  
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_report_schedules_tenant").on(table.tenantId),
  index("idx_report_schedules_next_run").on(table.nextRun),
  index("idx_report_schedules_active").on(table.isActive),
]);

// Report Executions - Audit trail and performance tracking
export const reportExecutions = pgTable("report_executions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  reportDefinitionId: varchar("report_definition_id").notNull(),
  userId: varchar("user_id"), // NULL for scheduled reports
  scheduleId: varchar("schedule_id"), // NULL for manual reports
  
  // Execution Context
  parameters: jsonb("parameters").default('{}'),
  filters: jsonb("filters").default('{}'),
  
  // Performance Metrics
  executionTimeMs: integer("execution_time_ms"),
  rowCount: integer("row_count"),
  dataSize: integer("data_size"), // bytes
  cacheHit: boolean("cache_hit").default(false),
  
  // Results and Export
  exportFormat: exportFormatEnum("export_format"),
  filePath: varchar("file_path", { length: 500 }),
  fileSize: integer("file_size"), // bytes
  downloadCount: integer("download_count").default(0),
  
  // Status and Error Tracking
  status: reportStatusEnum("status").notNull(),
  errorMessage: text("error_message"),
  errorCode: varchar("error_code", { length: 50 }),
  
  // Timestamps
  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at"),
  
  // Session Information
  sessionId: varchar("session_id"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_report_executions_tenant_date").on(table.tenantId, table.createdAt),
  index("idx_report_executions_user_date").on(table.userId, table.createdAt),
  index("idx_report_executions_report").on(table.reportDefinitionId),
  index("idx_report_executions_status").on(table.status),
]);

// =====================================================================
// KPI MANAGEMENT TABLES
// =====================================================================

// KPI Definitions - Master catalog of Key Performance Indicators
export const kpiDefinitions = pgTable("kpi_definitions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // KPI Identification
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 100 }).notNull(),
  description: text("description"),
  category: reportCategoryEnum("category").notNull(),
  
  // Calculation Configuration
  calculationSql: text("calculation_sql").notNull(),
  targetValue: decimal("target_value", { precision: 15, scale: 2 }),
  targetType: targetTypeEnum("target_type").default('absolute'),
  
  // Display Configuration
  displayFormat: displayFormatEnum("display_format").default('number'),
  prefix: varchar("prefix", { length: 10 }),
  suffix: varchar("suffix", { length: 10 }),
  decimalPlaces: integer("decimal_places").default(0),
  colorScheme: jsonb("color_scheme").default('{}'),
  
  // Alert Configuration
  alertEnabled: boolean("alert_enabled").default(false),
  alertThresholds: jsonb("alert_thresholds").default('{}'),
  alertRecipients: jsonb("alert_recipients").default('[]'),
  
  // Access Control
  requiredPermissions: jsonb("required_permissions").notNull(),
  organizationalScope: organizationalScopeEnum("organizational_scope").notNull(),
  
  // Performance Settings
  refreshFrequency: integer("refresh_frequency").default(3600), // seconds
  cacheDuration: integer("cache_duration").default(300),
  
  // Status and Metadata
  isActive: boolean("is_active").default(true),
  isHighPriority: boolean("is_high_priority").default(false),
  tags: jsonb("tags").default('[]'),
  
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_kpi_definitions_tenant").on(table.tenantId),
  index("idx_kpi_definitions_category").on(table.category),
  index("idx_kpi_definitions_scope").on(table.organizationalScope),
  index("idx_kpi_definitions_code").on(table.code),
]);

// KPI Values - Historical tracking of KPI performance
export const kpiValues = pgTable("kpi_values", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  kpiDefinitionId: varchar("kpi_definition_id").notNull(),
  
  // Dimensional Data
  locationId: varchar("location_id"),
  regionId: varchar("region_id"),
  userId: varchar("user_id"), // For user-specific KPIs
  teamId: varchar("team_id"), // For team-specific KPIs
  departmentId: varchar("department_id"),
  
  // Time Dimensions
  dateValue: date("date_value").notNull(),
  timePeriod: timePeriodEnum("time_period").notNull(),
  fiscalYear: integer("fiscal_year"),
  fiscalQuarter: integer("fiscal_quarter"),
  
  // KPI Values
  actualValue: decimal("actual_value", { precision: 15, scale: 2 }).notNull(),
  targetValue: decimal("target_value", { precision: 15, scale: 2 }),
  varianceValue: decimal("variance_value", { precision: 15, scale: 2 }),
  variancePercentage: decimal("variance_percentage", { precision: 8, scale: 4 }),
  
  // Performance Classification
  performanceLevel: performanceLevelEnum("performance_level"),
  isTargetMet: boolean("is_target_met"),
  alertTriggered: boolean("alert_triggered").default(false),
  
  // Metadata
  calculationTimestamp: timestamp("calculation_timestamp").defaultNow(),
  dataFreshness: timestamp("data_freshness"),
  sourceQuery: text("source_query"),
  
  // Quality Metrics
  dataQualityScore: integer("data_quality_score"),
  confidenceLevel: decimal("confidence_level", { precision: 5, scale: 2 }),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_kpi_values_tenant_date").on(table.tenantId, table.dateValue),
  index("idx_kpi_values_kpi_period").on(table.kpiDefinitionId, table.timePeriod, table.dateValue),
  index("idx_kpi_values_location_date").on(table.locationId, table.dateValue),
  index("idx_kpi_values_user_date").on(table.userId, table.dateValue),
  index("idx_kpi_values_performance").on(table.performanceLevel),
]);

// =====================================================================
// USER ACTIVITY AND ENGAGEMENT TRACKING
// =====================================================================

// User Report Activity - Track user engagement with reporting system
export const userReportActivity = pgTable("user_report_activity", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  userId: varchar("user_id").notNull(),
  
  // Activity Details
  activityType: activityTypeEnum("activity_type").notNull(),
  reportDefinitionId: varchar("report_definition_id"),
  kpiDefinitionId: varchar("kpi_definition_id"),
  
  // Activity Context
  sessionId: varchar("session_id"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  referrer: varchar("referrer"),
  
  // Activity Data
  parameters: jsonb("parameters").default('{}'),
  durationSeconds: integer("duration_seconds"),
  
  // Performance Tracking
  loadTimeMs: integer("load_time_ms"),
  errorOccurred: boolean("error_occurred").default(false),
  errorMessage: text("error_message"),
  
  // Interaction Data
  scrollDepth: integer("scroll_depth"), // percentage
  exportCount: integer("export_count").default(0),
  shareCount: integer("share_count").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_user_activity_user_date").on(table.userId, table.createdAt),
  index("idx_user_activity_tenant_type").on(table.tenantId, table.activityType, table.createdAt),
  index("idx_user_activity_report").on(table.reportDefinitionId),
]);

// =====================================================================
// DASHBOARD CONFIGURATION TABLES
// =====================================================================

// Dashboard Layouts - Store custom dashboard configurations
export const dashboardLayouts = pgTable("dashboard_layouts", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  userId: varchar("user_id"), // NULL for tenant-wide dashboards
  
  // Dashboard Identification
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: reportCategoryEnum("category"),
  
  // Layout Configuration
  layout: jsonb("layout").notNull(), // Grid layout configuration
  widgets: jsonb("widgets").notNull(), // Widget configurations
  
  // Access Control
  isPublic: boolean("is_public").default(false),
  allowedRoles: jsonb("allowed_roles").default('[]'),
  allowedUsers: jsonb("allowed_users").default('[]'),
  
  // Display Settings
  isDefault: boolean("is_default").default(false),
  displayOrder: integer("display_order").default(0),
  
  // Status
  isActive: boolean("is_active").default(true),
  
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_dashboard_layouts_tenant").on(table.tenantId),
  index("idx_dashboard_layouts_user").on(table.userId),
  index("idx_dashboard_layouts_category").on(table.category),
]);

// =====================================================================
// FOREIGN KEY RELATIONSHIPS (will be added to existing schema)
// =====================================================================

// These would be added to the existing schema.ts file as relations:
/*
export const reportDefinitionsRelations = relations(reportDefinitions, ({ many, one }) => ({
  tenant: one(tenants, {
    fields: [reportDefinitions.tenantId],
    references: [tenants.id],
  }),
  executions: many(reportExecutions),
  schedules: many(reportSchedules),
  userPreferences: many(userReportPreferences),
}));

export const kpiDefinitionsRelations = relations(kpiDefinitions, ({ many, one }) => ({
  tenant: one(tenants, {
    fields: [kpiDefinitions.tenantId],
    references: [tenants.id],
  }),
  values: many(kpiValues),
}));

export const reportExecutionsRelations = relations(reportExecutions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [reportExecutions.tenantId],
    references: [tenants.id],
  }),
  reportDefinition: one(reportDefinitions, {
    fields: [reportExecutions.reportDefinitionId],
    references: [reportDefinitions.id],
  }),
  user: one(users, {
    fields: [reportExecutions.userId],
    references: [users.id],
  }),
  schedule: one(reportSchedules, {
    fields: [reportExecutions.scheduleId],
    references: [reportSchedules.id],
  }),
}));
*/
