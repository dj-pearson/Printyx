import { sql, relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  pgEnum,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Manufacturer integration status enum
export const integrationStatusEnum = pgEnum('integration_status', [
  'active',
  'inactive', 
  'error',
  'pending_auth',
  'rate_limited',
  'maintenance'
]);

// Supported manufacturers enum
export const manufacturerEnum = pgEnum('manufacturer', [
  'canon',
  'xerox', 
  'hp',
  'konica_minolta',
  'lexmark',
  'ricoh',
  'sharp',
  'toshiba',
  'other'
]);

// Integration method enum
export const integrationMethodEnum = pgEnum('integration_method', [
  'api',           // Direct API integration
  'snmp',          // SNMP polling
  'email',         // Email-based meter reading
  'manual',        // Manual data entry
  'csv_import',    // CSV file import
  'third_party'    // Through services like FMAudit/Printanista
]);

// Data collection frequency enum
export const collectionFrequencyEnum = pgEnum('collection_frequency', [
  'real_time',     // Real-time updates
  'hourly',        // Every hour
  'daily',         // Once per day
  'weekly',        // Once per week
  'monthly',       // Once per month
  'on_demand'      // Manual trigger only
]);

// Manufacturer API configurations table
export const manufacturerIntegrations = pgTable("manufacturer_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Manufacturer details
  manufacturer: manufacturerEnum("manufacturer").notNull(),
  manufacturerName: varchar("manufacturer_name", { length: 100 }).notNull(),
  platformName: varchar("platform_name", { length: 100 }), // e.g., "ConnectKey", "PrintOS", "bEST"
  
  // Integration configuration
  integrationMethod: integrationMethodEnum("integration_method").notNull(),
  apiEndpoint: varchar("api_endpoint", { length: 500 }),
  apiVersion: varchar("api_version", { length: 20 }),
  
  // Authentication details (encrypted)
  authType: varchar("auth_type", { length: 50 }), // oauth2, api_key, basic_auth, certificate
  authCredentials: jsonb("auth_credentials").default('{}'), // Encrypted credentials
  
  // Collection settings
  collectionFrequency: collectionFrequencyEnum("collection_frequency").default('daily'),
  lastCollectionAt: timestamp("last_collection_at"),
  nextCollectionAt: timestamp("next_collection_at"),
  
  // Status and monitoring
  status: integrationStatusEnum("status").default('inactive'),
  lastError: text("last_error"),
  errorCount: integer("error_count").default(0),
  successfulCollections: integer("successful_collections").default(0),
  
  // Rate limiting
  rateLimitRequests: integer("rate_limit_requests").default(100), // per hour
  rateLimitWindow: integer("rate_limit_window").default(3600), // seconds
  currentRequests: integer("current_requests").default(0),
  rateLimitResetAt: timestamp("rate_limit_reset_at"),
  
  // Configuration settings
  settings: jsonb("settings").default('{}'), // Manufacturer-specific settings
  fieldMappings: jsonb("field_mappings").default('{}'), // Field mapping configuration
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by"),
  isActive: boolean("is_active").default(true),
});

// Device registrations for each manufacturer integration
export const deviceRegistrations = pgTable("device_registrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  integrationId: varchar("integration_id").notNull(), // references manufacturer_integrations.id
  
  // Device identification
  deviceId: varchar("device_id").notNull(), // Manufacturer's device ID
  serialNumber: varchar("serial_number", { length: 100 }),
  modelNumber: varchar("model_number", { length: 100 }),
  deviceName: varchar("device_name", { length: 150 }),
  
  // Network information
  ipAddress: varchar("ip_address", { length: 45 }), // IPv4 or IPv6
  macAddress: varchar("mac_address", { length: 17 }),
  networkPath: varchar("network_path", { length: 255 }),
  
  // Location and assignment
  locationId: varchar("location_id"), // references locations.id
  customerId: varchar("customer_id"), // references customers.id if customer equipment
  
  // Device capabilities
  capabilities: jsonb("capabilities").default('{}'), // What meters/data this device can provide
  supportedMetrics: jsonb("supported_metrics").default('[]'), // Array of metric types
  
  // Collection status
  status: integrationStatusEnum("status").default('active'),
  lastDataCollectedAt: timestamp("last_data_collected_at"),
  nextCollectionAt: timestamp("next_collection_at"),
  
  // Authentication for device-specific access
  deviceAuthCredentials: jsonb("device_auth_credentials").default('{}'), // Encrypted device-specific auth
  
  // Metadata
  registeredAt: timestamp("registered_at").defaultNow(),
  lastUpdatedAt: timestamp("last_updated_at").defaultNow(),
  isActive: boolean("is_active").default(true),
});

// Collected meter data and device metrics
export const deviceMetrics = pgTable("device_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  deviceRegistrationId: varchar("device_registration_id").notNull(), // references device_registrations.id
  integrationId: varchar("integration_id").notNull(), // references manufacturer_integrations.id
  
  // Metric identification
  metricType: varchar("metric_type", { length: 50 }).notNull(), // e.g., "total_prints", "color_prints", "toner_level"
  metricName: varchar("metric_name", { length: 100 }).notNull(),
  metricCategory: varchar("metric_category", { length: 50 }), // e.g., "usage", "supply", "maintenance", "error"
  
  // Metric values
  numericValue: decimal("numeric_value", { precision: 15, scale: 4 }),
  stringValue: varchar("string_value", { length: 255 }),
  booleanValue: boolean("boolean_value"),
  jsonValue: jsonb("json_value"), // For complex data structures
  
  // Measurement details
  unit: varchar("unit", { length: 20 }), // e.g., "pages", "percent", "ml", "count"
  measurementTimestamp: timestamp("measurement_timestamp").notNull(),
  collectedAt: timestamp("collected_at").defaultNow(),
  
  // Data quality and validation
  isValid: boolean("is_valid").default(true),
  validationNotes: text("validation_notes"),
  
  // Raw data preservation
  rawData: jsonb("raw_data").default('{}'), // Original data from manufacturer API
  
  // Metadata
  collectionMethod: integrationMethodEnum("collection_method").notNull(),
  dataSource: varchar("data_source", { length: 100 }), // Specific API endpoint or method
});

// Integration audit logs for troubleshooting and monitoring
export const integrationAuditLogs = pgTable("integration_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  integrationId: varchar("integration_id"), // references manufacturer_integrations.id
  deviceRegistrationId: varchar("device_registration_id"), // references device_registrations.id
  
  // Event details
  eventType: varchar("event_type", { length: 50 }).notNull(), // e.g., "data_collection", "auth_error", "rate_limit"
  eventCategory: varchar("event_category", { length: 30 }).notNull(), // success, error, warning, info
  message: text("message").notNull(),
  
  // Request/Response data
  requestData: jsonb("request_data").default('{}'),
  responseData: jsonb("response_data").default('{}'),
  httpStatusCode: integer("http_status_code"),
  
  // Performance metrics
  responseTimeMs: integer("response_time_ms"),
  dataPointsCollected: integer("data_points_collected").default(0),
  
  // Error information
  errorCode: varchar("error_code", { length: 100 }),
  errorDetails: jsonb("error_details").default('{}'),
  
  // Metadata
  timestamp: timestamp("timestamp").defaultNow(),
  userAgent: varchar("user_agent"),
  ipAddress: varchar("ip_address", { length: 45 }),
});

// Third-party service integrations (FMAudit, Printanista, etc.)
export const thirdPartyIntegrations = pgTable("third_party_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  
  // Service details
  serviceName: varchar("service_name", { length: 100 }).notNull(), // e.g., "FMAudit", "Printanista", "Print Audit"
  serviceType: varchar("service_type", { length: 50 }).notNull(), // e.g., "meter_reading", "fleet_management", "monitoring"
  providerName: varchar("provider_name", { length: 100 }), // e.g., "ECI Solutions", "Printanista"
  
  // Integration configuration
  apiEndpoint: varchar("api_endpoint", { length: 500 }),
  apiVersion: varchar("api_version", { length: 20 }),
  authCredentials: jsonb("auth_credentials").default('{}'), // Encrypted credentials
  
  // Data mapping and synchronization
  dataMapping: jsonb("data_mapping").default('{}'), // How to map third-party data to our schema
  syncFrequency: collectionFrequencyEnum("sync_frequency").default('daily'),
  lastSyncAt: timestamp("last_sync_at"),
  nextSyncAt: timestamp("next_sync_at"),
  
  // Status and monitoring
  status: integrationStatusEnum("status").default('inactive'),
  lastError: text("last_error"),
  errorCount: integer("error_count").default(0),
  successfulSyncs: integer("successful_syncs").default(0),
  
  // Settings
  settings: jsonb("settings").default('{}'),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  isActive: boolean("is_active").default(true),
});

// Relations
export const manufacturerIntegrationsRelations = relations(manufacturerIntegrations, ({ many }) => ({
  deviceRegistrations: many(deviceRegistrations),
  auditLogs: many(integrationAuditLogs),
}));

export const deviceRegistrationsRelations = relations(deviceRegistrations, ({ one, many }) => ({
  integration: one(manufacturerIntegrations, {
    fields: [deviceRegistrations.integrationId],
    references: [manufacturerIntegrations.id],
  }),
  metrics: many(deviceMetrics),
  auditLogs: many(integrationAuditLogs),
}));

export const deviceMetricsRelations = relations(deviceMetrics, ({ one }) => ({
  deviceRegistration: one(deviceRegistrations, {
    fields: [deviceMetrics.deviceRegistrationId],
    references: [deviceRegistrations.id],
  }),
  integration: one(manufacturerIntegrations, {
    fields: [deviceMetrics.integrationId],
    references: [manufacturerIntegrations.id],
  }),
}));

export const integrationAuditLogsRelations = relations(integrationAuditLogs, ({ one }) => ({
  integration: one(manufacturerIntegrations, {
    fields: [integrationAuditLogs.integrationId],
    references: [manufacturerIntegrations.id],
  }),
  deviceRegistration: one(deviceRegistrations, {
    fields: [integrationAuditLogs.deviceRegistrationId],
    references: [deviceRegistrations.id],
  }),
}));

// Zod schemas for validation
export const insertManufacturerIntegrationSchema = createInsertSchema(manufacturerIntegrations);
export const insertDeviceRegistrationSchema = createInsertSchema(deviceRegistrations);
export const insertDeviceMetricSchema = createInsertSchema(deviceMetrics);
export const insertIntegrationAuditLogSchema = createInsertSchema(integrationAuditLogs);
export const insertThirdPartyIntegrationSchema = createInsertSchema(thirdPartyIntegrations);

// TypeScript types
export type ManufacturerIntegration = typeof manufacturerIntegrations.$inferSelect;
export type InsertManufacturerIntegration = typeof manufacturerIntegrations.$inferInsert;
export type DeviceRegistration = typeof deviceRegistrations.$inferSelect;
export type InsertDeviceRegistration = typeof deviceRegistrations.$inferInsert;
export type DeviceMetric = typeof deviceMetrics.$inferSelect;
export type InsertDeviceMetric = typeof deviceMetrics.$inferInsert;
export type IntegrationAuditLog = typeof integrationAuditLogs.$inferSelect;
export type InsertIntegrationAuditLog = typeof integrationAuditLogs.$inferInsert;
export type ThirdPartyIntegration = typeof thirdPartyIntegrations.$inferSelect;
export type InsertThirdPartyIntegration = typeof thirdPartyIntegrations.$inferInsert;