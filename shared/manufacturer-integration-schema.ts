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
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Enums for manufacturer integration
export const manufacturerEnum = pgEnum('manufacturer', [
  'canon',
  'xerox',
  'hp',
  'konica_minolta',
  'lexmark',
  'fmaudit',
  'printanista',
]);

export const integrationStatusEnum = pgEnum('integration_status', [
  'active',
  'inactive',
  'error',
  'pending',
]);

export const collectionFrequencyEnum = pgEnum('collection_frequency', [
  'real_time',
  'hourly',
  'daily',
  'weekly',
  'monthly',
]);

export const deviceStatusEnum = pgEnum('device_status', [
  'online',
  'offline',
  'error',
  'maintenance',
  'unknown',
]);

export const authMethodEnum = pgEnum('auth_method', [
  'api_key',
  'oauth2',
  'basic_auth',
  'certificate',
  'hmac',
]);

// Manufacturer Integration Configuration
export const manufacturerIntegrations = pgTable(
  'manufacturer_integrations',
  {
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
    createdAt: timestamp('created_at')
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at')
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    tenantManufacturerIdx: index('tenant_manufacturer_idx').on(table.tenantId, table.manufacturer),
    statusIdx: index('integration_status_idx').on(table.status),
    nextSyncIdx: index('next_sync_idx').on(table.nextSync),
  }),
);

// Device Registration and Management
export const deviceRegistrations = pgTable(
  'device_registrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    integrationId: uuid('integration_id')
      .notNull()
      .references(() => manufacturerIntegrations.id, { onDelete: 'cascade' }),
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
    // Optional pointer to the customer (business_records row) this device
    // belongs to. Denormalised from monitoring_clients.customer_id at
    // ingest time so auto-order, supply-runway-by-customer, etc. don't
    // need a 3-way join. Update by re-running /submit after relinking
    // the agent's customer in the platform UI.
    customerId: varchar('customer_id', { length: 255 }),
    lastSeen: timestamp('last_seen'),
    registeredAt: timestamp('registered_at')
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at')
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    tenantDeviceIdx: index('tenant_device_idx').on(table.tenantId, table.deviceId),
    integrationIdx: index('device_integration_idx').on(table.integrationId),
    statusIdx: index('device_status_idx').on(table.status),
    lastSeenIdx: index('device_last_seen_idx').on(table.lastSeen),
  }),
);

// Device Metrics and Meter Readings
export const deviceMetrics = pgTable(
  'device_metrics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => deviceRegistrations.id, { onDelete: 'cascade' }),
    integrationId: uuid('integration_id')
      .notNull()
      .references(() => manufacturerIntegrations.id, { onDelete: 'cascade' }),
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

    createdAt: timestamp('created_at')
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    tenantDeviceTimeIdx: index('tenant_device_time_idx').on(
      table.tenantId,
      table.deviceId,
      table.collectionTimestamp,
    ),
    collectionTimeIdx: index('collection_timestamp_idx').on(table.collectionTimestamp),
    deviceIdx: index('metrics_device_idx').on(table.deviceId),
  }),
);

// Integration Audit Logs
export const integrationAuditLogs = pgTable(
  'integration_audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    integrationId: uuid('integration_id').references(() => manufacturerIntegrations.id, {
      onDelete: 'cascade',
    }),
    deviceId: uuid('device_id').references(() => deviceRegistrations.id, { onDelete: 'cascade' }),
    action: varchar('action', { length: 100 }).notNull(), // 'sync', 'register', 'error', 'config_change'
    status: varchar('status', { length: 50 }).notNull(), // 'success', 'error', 'warning'
    message: text('message'),
    details: jsonb('details').default({}),
    responseTime: integer('response_time'), // milliseconds
    errorCode: varchar('error_code', { length: 50 }),
    userId: uuid('user_id'), // Who initiated the action
    timestamp: timestamp('timestamp')
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    tenantTimeIdx: index('tenant_time_idx').on(table.tenantId, table.timestamp),
    integrationTimeIdx: index('integration_time_idx').on(table.integrationId, table.timestamp),
    statusIdx: index('audit_status_idx').on(table.status),
    actionIdx: index('audit_action_idx').on(table.action),
  }),
);

// Materialised device alerts.
//
// Computed from device_metrics on each ingest by alert-materializer.ts.
// Persisting them (instead of deriving on every dashboard read) lets
// operators acknowledge / snooze / manually resolve, and gives us a
// stable id to attach notes / tickets / orders to later.
//
// Lifecycle:
//   active        — supply is over threshold, no operator action
//   acknowledged  — operator has seen it; sticks until the supply
//                   condition clears or the operator resolves
//   snoozed       — temporarily silenced; reverts to 'active' after
//                   snoozed_until elapses if the condition still holds
//   resolved      — supply crossed back over threshold OR operator
//                   manually resolved
//
// Uniqueness constraint (enforced at the table level via partial
// unique index on tenant + device + supply for non-resolved rows) so
// the same supply can't have two open alerts.
export const deviceAlerts = pgTable(
  'device_alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => deviceRegistrations.id, { onDelete: 'cascade' }),
    // 'black' | 'cyan' | 'magenta' | 'yellow' | 'paper-tray1' | 'fuser' | …
    supplyType: varchar('supply_type', { length: 64 }).notNull(),
    // 'low' | 'critical' | 'empty' | 'offline'
    alertType: varchar('alert_type', { length: 32 }).notNull(),
    // 'info' | 'warning' | 'critical'
    severity: varchar('severity', { length: 16 }).notNull(),
    currentValue: integer('current_value'),
    threshold: integer('threshold'),
    // 'active' | 'acknowledged' | 'snoozed' | 'resolved'
    status: varchar('status', { length: 16 }).notNull().default('active'),
    message: text('message'),
    acknowledgedAt: timestamp('acknowledged_at'),
    acknowledgedBy: varchar('acknowledged_by', { length: 255 }),
    snoozedUntil: timestamp('snoozed_until'),
    resolvedAt: timestamp('resolved_at'),
    /**
     * Set when auto-order fired for this alert. Soft pointer to
     * device_supply_orders.id (no FK so the alert can survive an order
     * being deleted in cleanup). Cleared if the order is cancelled.
     */
    triggeredOrderId: uuid('triggered_order_id'),
    firstSeenAt: timestamp('first_seen_at')
      .default(sql`now()`)
      .notNull(),
    lastSeenAt: timestamp('last_seen_at')
      .default(sql`now()`)
      .notNull(),
    createdAt: timestamp('created_at')
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at')
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    tenantStatusIdx: index('device_alerts_tenant_status_idx').on(table.tenantId, table.status),
    deviceIdx: index('device_alerts_device_idx').on(table.deviceId),
    severityIdx: index('device_alerts_severity_idx').on(table.severity),
    snoozeExpiryIdx: index('device_alerts_snooze_expiry_idx').on(table.snoozedUntil),
  }),
);

// Auto-generated supply orders.
//
// Distinct from `customer_supply_orders` (which is the customer-portal
// flow with delivery addresses, invoices, and payment). This table is
// the agent-driven path: when a critical alert materialises and the
// monitoring client has auto-order enabled, a row is inserted here
// with status='pending'. Operators approve / cancel / send to the
// fulfilment side from there.
//
// Status flow:
//   pending  — auto-generated, awaiting operator approval
//   approved — operator approved; ready to be turned into a real order
//   ordered  — fulfilment confirmed
//   shipped  — carrier confirmed dispatch
//   delivered
//   cancelled
export const deviceSupplyOrders = pgTable(
  'device_supply_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    customerId: varchar('customer_id', { length: 255 }), // business_records.id (varchar PK)
    deviceId: uuid('device_id')
      .notNull()
      .references(() => deviceRegistrations.id, { onDelete: 'cascade' }),
    alertId: uuid('alert_id'), // soft FK — alert may be deleted later
    supplyType: varchar('supply_type', { length: 64 }).notNull(),
    productId: varchar('product_id', { length: 255 }), // supplies.id (varchar PK)
    productSku: varchar('product_sku', { length: 100 }),
    productName: varchar('product_name', { length: 255 }),
    quantity: integer('quantity').default(1).notNull(),
    unitPrice: decimal('unit_price', { precision: 10, scale: 2 }),
    totalPrice: decimal('total_price', { precision: 10, scale: 2 }),
    // 'pending' | 'approved' | 'ordered' | 'shipped' | 'delivered' | 'cancelled'
    status: varchar('status', { length: 24 }).default('pending').notNull(),
    // 'auto' (materializer) | 'manual' (operator clicked Order) | 'forecast' (supply runway)
    triggeredBy: varchar('triggered_by', { length: 16 }).default('auto').notNull(),
    triggeredByUserId: varchar('triggered_by_user_id', { length: 255 }),
    approvedAt: timestamp('approved_at'),
    approvedBy: varchar('approved_by', { length: 255 }),
    orderedAt: timestamp('ordered_at'),
    cancelledAt: timestamp('cancelled_at'),
    notes: text('notes'),
    createdAt: timestamp('created_at')
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at')
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    tenantStatusIdx: index('device_supply_orders_tenant_status_idx').on(
      table.tenantId,
      table.status,
    ),
    deviceIdx: index('device_supply_orders_device_idx').on(table.deviceId),
    alertIdx: index('device_supply_orders_alert_idx').on(table.alertId),
    customerIdx: index('device_supply_orders_customer_idx').on(table.customerId),
  }),
);

// Third-Party Integration Support (FMAudit/Printanista)
export const thirdPartyIntegrations = pgTable(
  'third_party_integrations',
  {
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
    createdAt: timestamp('created_at')
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at')
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    tenantProviderIdx: index('tenant_provider_idx').on(table.tenantId, table.providerName),
    statusIdx: index('third_party_status_idx').on(table.status),
  }),
);

// Relations
export const manufacturerIntegrationsRelations = relations(
  manufacturerIntegrations,
  ({ many }) => ({
    devices: many(deviceRegistrations),
    metrics: many(deviceMetrics),
    auditLogs: many(integrationAuditLogs),
  }),
);

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
export const insertDeviceAlertSchema = createInsertSchema(deviceAlerts);
export const insertDeviceSupplyOrderSchema = createInsertSchema(deviceSupplyOrders);

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
export type DeviceAlert = typeof deviceAlerts.$inferSelect;
export type InsertDeviceAlert = z.infer<typeof insertDeviceAlertSchema>;
export type DeviceSupplyOrder = typeof deviceSupplyOrders.$inferSelect;
export type InsertDeviceSupplyOrder = z.infer<typeof insertDeviceSupplyOrderSchema>;
