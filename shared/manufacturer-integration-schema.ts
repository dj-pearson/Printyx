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

// Enums for manufacturer integration
export const manufacturerEnum = pgEnum('manufacturer', [
  'canon',
  'xerox', 
  'hp',
  'konica_minolta',
  'lexmark',
  'fmaudit',
  'printanista'
]);

export const integrationStatusEnum = pgEnum('integration_status', [
  'active',
  'inactive',
  'error',
  'pending'
]);

export const collectionFrequencyEnum = pgEnum('collection_frequency', [
  'real_time',
  'hourly',
  'daily',
  'weekly',
  'monthly'
]);

export const deviceStatusEnum = pgEnum('device_status', [
  'online',
  'offline',
  'error',
  'maintenance',
  'unknown'
]);

export const authMethodEnum = pgEnum('auth_method', [
  'api_key',
  'oauth2',
  'basic_auth',
  'certificate',
  'hmac'
]);

// Manufacturer Integration Configuration
export const manufacturerIntegrations = pgTable('manufacturer_integrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  manufacturer: manufacturerEnum('manufacturer').notNull(),
  integrationName: varchar('integration_name', { length: 255 }).notNull(),
  status: integrationStatusEnum('status').default('pending').notNull(),
  authMethod: authMethodEnum('auth_method').notNull(),
  credentials: jsonb('credentials').notNull(), // Encrypted storage
  apiEndpoint: varchar('api_endpoint', { length: 500 }),
  collectionFrequency: collectionFrequencyEnum('collection_frequency').default('daily').notNull(),
  lastSync: timestamp('last_sync'),
  nextSync: timestamp('next_sync'),
  configuration: jsonb('configuration').default({}),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`now()`).notNull(),
}, (table) => ({
  tenantManufacturerIdx: index('tenant_manufacturer_idx').on(table.tenantId, table.manufacturer),
  statusIdx: index('integration_status_idx').on(table.status),
  nextSyncIdx: index('next_sync_idx').on(table.nextSync),
}));

// Device Registration and Management
export const deviceRegistrations = pgTable('device_registrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  integrationId: uuid('integration_id').notNull().references(() => manufacturerIntegrations.id, { onDelete: 'cascade' }),
  deviceId: varchar('device_id', { length: 255 }).notNull(), // Manufacturer device ID
  deviceName: varchar('device_name', { length: 255 }),
  model: varchar('model', { length: 255 }),
  serialNumber: varchar('serial_number', { length: 255 }),
  ipAddress: varchar('ip_address', { length: 45 }),
  macAddress: varchar('mac_address', { length: 17 }),
  location: varchar('location', { length: 255 }),
  department: varchar('department', { length: 255 }),
  status: deviceStatusEnum('status').default('unknown').notNull(),
  capabilities: jsonb('capabilities').default([]), // Supported features
  lastSeen: timestamp('last_seen'),
  registeredAt: timestamp('registered_at').default(sql`now()`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`now()`).notNull(),
}, (table) => ({
  tenantDeviceIdx: index('tenant_device_idx').on(table.tenantId, table.deviceId),
  integrationIdx: index('device_integration_idx').on(table.integrationId),
  statusIdx: index('device_status_idx').on(table.status),
  lastSeenIdx: index('device_last_seen_idx').on(table.lastSeen),
}));

// Device Metrics and Meter Readings
export const deviceMetrics = pgTable('device_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  deviceId: uuid('device_id').notNull().references(() => deviceRegistrations.id, { onDelete: 'cascade' }),
  integrationId: uuid('integration_id').notNull().references(() => manufacturerIntegrations.id, { onDelete: 'cascade' }),
  collectionTimestamp: timestamp('collection_timestamp').notNull(),
  
  // Meter readings
  totalImpressions: integer('total_impressions'),
  bwImpressions: integer('bw_impressions'),
  colorImpressions: integer('color_impressions'),
  largeImpressions: integer('large_impressions'),
  
  // Device status
  deviceStatus: deviceStatusEnum('device_status').default('unknown'),
  tonerLevels: jsonb('toner_levels').default({}), // {cyan: 75, magenta: 80, yellow: 65, black: 90}
  paperLevels: jsonb('paper_levels').default({}), // {tray1: 80, tray2: 45}
  errorCodes: text('error_codes').array(),
  
  // Performance metrics
  responseTime: integer('response_time'), // milliseconds
  uptime: decimal('uptime', { precision: 5, scale: 2 }), // percentage
  
  // Raw data for debugging
  rawData: jsonb('raw_data'),
  
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
}, (table) => ({
  tenantDeviceTimeIdx: index('tenant_device_time_idx').on(table.tenantId, table.deviceId, table.collectionTimestamp),
  collectionTimeIdx: index('collection_timestamp_idx').on(table.collectionTimestamp),
  deviceIdx: index('metrics_device_idx').on(table.deviceId),
}));

// Integration Audit Logs
export const integrationAuditLogs = pgTable('integration_audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  integrationId: uuid('integration_id').references(() => manufacturerIntegrations.id, { onDelete: 'cascade' }),
  deviceId: uuid('device_id').references(() => deviceRegistrations.id, { onDelete: 'cascade' }),
  action: varchar('action', { length: 100 }).notNull(), // 'sync', 'register', 'error', 'config_change'
  status: varchar('status', { length: 50 }).notNull(), // 'success', 'error', 'warning'
  message: text('message'),
  details: jsonb('details').default({}),
  responseTime: integer('response_time'), // milliseconds
  errorCode: varchar('error_code', { length: 50 }),
  userId: uuid('user_id'), // Who initiated the action
  timestamp: timestamp('timestamp').default(sql`now()`).notNull(),
}, (table) => ({
  tenantTimeIdx: index('tenant_time_idx').on(table.tenantId, table.timestamp),
  integrationTimeIdx: index('integration_time_idx').on(table.integrationId, table.timestamp),
  statusIdx: index('audit_status_idx').on(table.status),
  actionIdx: index('audit_action_idx').on(table.action),
}));

// Third-Party Integration Support (FMAudit/Printanista)
export const thirdPartyIntegrations = pgTable('third_party_integrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  providerName: varchar('provider_name', { length: 100 }).notNull(), // 'FMAudit', 'Printanista'
  integrationName: varchar('integration_name', { length: 255 }).notNull(),
  status: integrationStatusEnum('status').default('pending').notNull(),
  credentials: jsonb('credentials').notNull(), // Encrypted storage
  configuration: jsonb('configuration').default({}),
  supportedManufacturers: manufacturerEnum('supported_manufacturers').array(),
  lastSync: timestamp('last_sync'),
  nextSync: timestamp('next_sync'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').default(sql`now()`).notNull(),
  updatedAt: timestamp('updated_at').default(sql`now()`).notNull(),
}, (table) => ({
  tenantProviderIdx: index('tenant_provider_idx').on(table.tenantId, table.providerName),
  statusIdx: index('third_party_status_idx').on(table.status),
}));

// Relations
export const manufacturerIntegrationsRelations = relations(manufacturerIntegrations, ({ many }) => ({
  devices: many(deviceRegistrations),
  metrics: many(deviceMetrics),
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
  device: one(deviceRegistrations, {
    fields: [deviceMetrics.deviceId],
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
  device: one(deviceRegistrations, {
    fields: [integrationAuditLogs.deviceId],
    references: [deviceRegistrations.id],
  }),
}));

// Insert schemas
export const insertManufacturerIntegrationSchema = createInsertSchema(manufacturerIntegrations);
export const insertDeviceRegistrationSchema = createInsertSchema(deviceRegistrations);
export const insertDeviceMetricSchema = createInsertSchema(deviceMetrics);
export const insertIntegrationAuditLogSchema = createInsertSchema(integrationAuditLogs);
export const insertThirdPartyIntegrationSchema = createInsertSchema(thirdPartyIntegrations);

// Types
export type ManufacturerIntegration = typeof manufacturerIntegrations.$inferSelect;
export type InsertManufacturerIntegration = z.infer<typeof insertManufacturerIntegrationSchema>;
export type DeviceRegistration = typeof deviceRegistrations.$inferSelect;
export type InsertDeviceRegistration = z.infer<typeof insertDeviceRegistrationSchema>;
export type DeviceMetric = typeof deviceMetrics.$inferSelect;
export type InsertDeviceMetric = z.infer<typeof insertDeviceMetricSchema>;
export type IntegrationAuditLog = typeof integrationAuditLogs.$inferSelect;
export type InsertIntegrationAuditLog = z.infer<typeof insertIntegrationAuditLogSchema>;
export type ThirdPartyIntegration = typeof thirdPartyIntegrations.$inferSelect;
export type InsertThirdPartyIntegration = z.infer<typeof insertThirdPartyIntegrationSchema>;