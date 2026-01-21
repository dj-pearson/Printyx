import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  jsonb,
  index,
  boolean,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/**
 * Client Registrations
 * Stores registered monitoring clients (customer installations)
 */
export const clientRegistrations = pgTable(
  'client_registrations',
  {
    id: serial('id').primaryKey(),
    tenantId: integer('tenant_id').notNull(),
    clientId: text('client_id').notNull().unique(), // e.g., "client-001"
    clientName: text('client_name').notNull(), // e.g., "Main Office"
    location: text('location'), // Optional physical location
    apiKey: text('api_key').notNull().unique(), // For authentication
    status: text('status').notNull().default('active'), // active, inactive, disabled
    lastHeartbeat: timestamp('last_heartbeat'),
    clientVersion: text('client_version'), // e.g., "1.0.0"
    installedAt: timestamp('installed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('client_registrations_tenant_idx').on(table.tenantId),
    clientIdIdx: index('client_registrations_client_id_idx').on(table.clientId),
    apiKeyIdx: index('client_registrations_api_key_idx').on(table.apiKey),
  }),
);

/**
 * Client Collected Metrics
 * Time-series data collected by monitoring clients from devices
 */
export const clientCollectedMetrics = pgTable(
  'client_collected_metrics',
  {
    id: serial('id').primaryKey(),
    tenantId: integer('tenant_id').notNull(),
    clientId: text('client_id').notNull(),

    // Device identification
    serialNumber: text('serial_number').notNull(),
    ipAddress: text('ip_address').notNull(),
    manufacturer: text('manufacturer'),
    model: text('model'),
    deviceName: text('device_name'), // Friendly name

    // Toner levels (percentage 0-100)
    tonerBlack: integer('toner_black'),
    tonerCyan: integer('toner_cyan'),
    tonerMagenta: integer('toner_magenta'),
    tonerYellow: integer('toner_yellow'),

    // Paper levels (percentage 0-100 per tray)
    paperTray1: integer('paper_tray1'),
    paperTray2: integer('paper_tray2'),
    paperTray3: integer('paper_tray3'),
    paperTray4: integer('paper_tray4'),

    // Meter readings (cumulative counters)
    totalImpressions: integer('total_impressions'),
    bwImpressions: integer('bw_impressions'),
    colorImpressions: integer('color_impressions'),
    largeImpressions: integer('large_impressions'), // A3/Ledger

    // Supply information
    fuserLife: integer('fuser_life'), // percentage remaining
    drumLife: integer('drum_life'), // percentage remaining
    transferBeltLife: integer('transfer_belt_life'),

    // Status
    deviceStatus: text('device_status').notNull(), // online, offline, error, maintenance, warning
    errorCodes: text('error_codes').array(),
    warningCodes: text('warning_codes').array(),

    // Metadata
    collectionTimestamp: timestamp('collection_timestamp').notNull(), // When client collected data
    receivedAt: timestamp('received_at').defaultNow().notNull(), // When server received data
    rawData: jsonb('raw_data'), // Full collector response for debugging
  },
  (table) => ({
    tenantSerialIdx: index('client_collected_metrics_tenant_serial_idx').on(
      table.tenantId,
      table.serialNumber,
    ),
    collectionTimeIdx: index('client_collected_metrics_collection_time_idx').on(
      table.collectionTimestamp,
    ),
    clientIdIdx: index('client_collected_metrics_client_id_idx').on(table.clientId),
    deviceStatusIdx: index('client_collected_metrics_device_status_idx').on(table.deviceStatus),
    receivedAtIdx: index('client_collected_metrics_received_at_idx').on(table.receivedAt),
  }),
);

/**
 * Monitored Devices
 * Master list of devices being monitored (configuration)
 */
export const monitoredDevices = pgTable(
  'monitored_devices',
  {
    id: serial('id').primaryKey(),
    tenantId: integer('tenant_id').notNull(),
    clientId: text('client_id').notNull(),

    // Device identification
    serialNumber: text('serial_number').notNull(),
    ipAddress: text('ip_address').notNull(),
    hostname: text('hostname'),
    deviceName: text('device_name'), // User-friendly name
    manufacturer: text('manufacturer'),
    model: text('model'),

    // Connection configuration
    protocol: text('protocol').notNull(), // snmp, http, https
    snmpVersion: text('snmp_version'), // 1, 2c, 3
    snmpCommunity: text('snmp_community'), // Encrypted at rest
    snmpPort: integer('snmp_port').default(161),
    snmpUsername: text('snmp_username'), // SNMPv3
    snmpAuthProtocol: text('snmp_auth_protocol'), // MD5, SHA
    snmpAuthPassword: text('snmp_auth_password'), // Encrypted
    snmpPrivProtocol: text('snmp_priv_protocol'), // DES, AES
    snmpPrivPassword: text('snmp_priv_password'), // Encrypted

    httpPort: integer('http_port'),
    httpUsername: text('http_username'),
    httpPassword: text('http_password'), // Encrypted

    // OID configuration (JSONB for flexibility)
    customOids: jsonb('custom_oids'), // { tonerBlack: "1.3.6.1...", totalCounter: "..." }

    // Monitoring settings
    enabled: boolean('enabled').notNull().default(true),
    pollingInterval: integer('polling_interval').default(300), // seconds

    // Alert thresholds (device-specific overrides)
    tonerAlertThreshold: integer('toner_alert_threshold').default(15),
    paperAlertThreshold: integer('paper_alert_threshold').default(20),

    // Status tracking
    lastSeen: timestamp('last_seen'),
    lastSuccessfulCollection: timestamp('last_successful_collection'),
    consecutiveFailures: integer('consecutive_failures').default(0),

    // Metadata
    discoveredAt: timestamp('discovered_at'),
    addedAt: timestamp('added_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantClientIdx: index('monitored_devices_tenant_client_idx').on(
      table.tenantId,
      table.clientId,
    ),
    serialNumberIdx: index('monitored_devices_serial_number_idx').on(table.serialNumber),
    ipAddressIdx: index('monitored_devices_ip_address_idx').on(table.ipAddress),
    enabledIdx: index('monitored_devices_enabled_idx').on(table.enabled),
  }),
);

/**
 * Client Activity Logs
 * Audit trail for client operations
 */
export const clientActivityLogs = pgTable(
  'client_activity_logs',
  {
    id: serial('id').primaryKey(),
    tenantId: integer('tenant_id').notNull(),
    clientId: text('client_id').notNull(),
    eventType: text('event_type').notNull(), // heartbeat, metrics, error, config_update, discovery, offline, online
    eventData: jsonb('event_data'), // Additional context
    severity: text('severity').notNull().default('info'), // info, warning, error, critical
    message: text('message'),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
  },
  (table) => ({
    tenantClientIdx: index('client_activity_logs_tenant_client_idx').on(
      table.tenantId,
      table.clientId,
    ),
    eventTypeIdx: index('client_activity_logs_event_type_idx').on(table.eventType),
    timestampIdx: index('client_activity_logs_timestamp_idx').on(table.timestamp),
    severityIdx: index('client_activity_logs_severity_idx').on(table.severity),
  }),
);

/**
 * Toner Alerts
 * Alert history for low toner/supplies
 */
export const tonerAlerts = pgTable(
  'toner_alerts',
  {
    id: serial('id').primaryKey(),
    tenantId: integer('tenant_id').notNull(),
    clientId: text('client_id').notNull(),
    deviceId: integer('device_id'), // Reference to monitored_devices
    serialNumber: text('serial_number').notNull(),

    // Alert details
    alertType: text('alert_type').notNull(), // toner_low, toner_empty, paper_low, fuser_low, drum_low
    supplyType: text('supply_type').notNull(), // black, cyan, magenta, yellow, paper, fuser, drum
    currentLevel: integer('current_level'), // percentage
    threshold: integer('threshold'), // percentage that triggered alert

    // Status
    status: text('status').notNull().default('active'), // active, acknowledged, resolved, ordered
    acknowledgedAt: timestamp('acknowledged_at'),
    acknowledgedBy: integer('acknowledged_by'), // user_id
    resolvedAt: timestamp('resolved_at'),

    // Order tracking
    orderCreated: boolean('order_created').default(false),
    orderReference: text('order_reference'), // PO number, order ID, etc.

    // Metadata
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantDeviceIdx: index('toner_alerts_tenant_device_idx').on(table.tenantId, table.serialNumber),
    statusIdx: index('toner_alerts_status_idx').on(table.status),
    createdAtIdx: index('toner_alerts_created_at_idx').on(table.createdAt),
  }),
);

/**
 * OID Mappings
 * Manufacturer-specific OID presets
 */
export const oidMappings = pgTable(
  'oid_mappings',
  {
    id: serial('id').primaryKey(),
    manufacturer: text('manufacturer').notNull(), // Canon, Xerox, HP, Ricoh, etc.
    modelSeries: text('model_series'), // e.g., "iR-ADV", "VersaLink", null for all models
    mappingName: text('mapping_name').notNull(), // e.g., "Canon iR-ADV Standard"

    // OID definitions (JSONB for flexibility)
    oids: jsonb('oids').notNull(), // { tonerBlack: "1.3.6.1...", totalCounter: "...", ... }

    // Metadata
    isDefault: boolean('is_default').default(false), // Default preset for this manufacturer
    isCustom: boolean('is_custom').default(false), // User-created vs system preset
    createdBy: integer('created_by'), // user_id for custom mappings

    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    manufacturerIdx: index('oid_mappings_manufacturer_idx').on(table.manufacturer),
    defaultIdx: index('oid_mappings_default_idx').on(table.isDefault),
  }),
);

/**
 * Device Meter History
 * Aggregated meter readings for billing and analytics
 */
export const deviceMeterHistory = pgTable(
  'device_meter_history',
  {
    id: serial('id').primaryKey(),
    tenantId: integer('tenant_id').notNull(),
    serialNumber: text('serial_number').notNull(),

    // Meter readings at specific point in time
    totalImpressions: integer('total_impressions'),
    bwImpressions: integer('bw_impressions'),
    colorImpressions: integer('color_impressions'),

    // Calculated differentials (new impressions since last reading)
    totalDiff: integer('total_diff'),
    bwDiff: integer('bw_diff'),
    colorDiff: integer('color_diff'),

    // Billing period
    billingPeriodStart: timestamp('billing_period_start'),
    billingPeriodEnd: timestamp('billing_period_end'),

    // Metadata
    readingTimestamp: timestamp('reading_timestamp').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantSerialIdx: index('device_meter_history_tenant_serial_idx').on(
      table.tenantId,
      table.serialNumber,
    ),
    readingTimeIdx: index('device_meter_history_reading_time_idx').on(table.readingTimestamp),
    billingPeriodIdx: index('device_meter_history_billing_period_idx').on(
      table.billingPeriodStart,
      table.billingPeriodEnd,
    ),
  }),
);

// Relations
export const clientRegistrationsRelations = relations(clientRegistrations, ({ many }) => ({
  devices: many(monitoredDevices),
  metrics: many(clientCollectedMetrics),
  activityLogs: many(clientActivityLogs),
  alerts: many(tonerAlerts),
}));

export const monitoredDevicesRelations = relations(monitoredDevices, ({ one, many }) => ({
  client: one(clientRegistrations, {
    fields: [monitoredDevices.clientId],
    references: [clientRegistrations.clientId],
  }),
  metrics: many(clientCollectedMetrics),
  alerts: many(tonerAlerts),
}));

export const clientCollectedMetricsRelations = relations(clientCollectedMetrics, ({ one }) => ({
  client: one(clientRegistrations, {
    fields: [clientCollectedMetrics.clientId],
    references: [clientRegistrations.clientId],
  }),
}));

export const tonerAlertsRelations = relations(tonerAlerts, ({ one }) => ({
  client: one(clientRegistrations, {
    fields: [tonerAlerts.clientId],
    references: [clientRegistrations.clientId],
  }),
  device: one(monitoredDevices, {
    fields: [tonerAlerts.deviceId],
    references: [monitoredDevices.id],
  }),
}));

// Export types
export type ClientRegistration = typeof clientRegistrations.$inferSelect;
export type NewClientRegistration = typeof clientRegistrations.$inferInsert;
export type ClientCollectedMetric = typeof clientCollectedMetrics.$inferSelect;
export type NewClientCollectedMetric = typeof clientCollectedMetrics.$inferInsert;
export type MonitoredDevice = typeof monitoredDevices.$inferSelect;
export type NewMonitoredDevice = typeof monitoredDevices.$inferInsert;
export type ClientActivityLog = typeof clientActivityLogs.$inferSelect;
export type NewClientActivityLog = typeof clientActivityLogs.$inferInsert;
export type TonerAlert = typeof tonerAlerts.$inferSelect;
export type NewTonerAlert = typeof tonerAlerts.$inferInsert;
export type OidMapping = typeof oidMappings.$inferSelect;
export type NewOidMapping = typeof oidMappings.$inferInsert;
export type DeviceMeterHistory = typeof deviceMeterHistory.$inferSelect;
export type NewDeviceMeterHistory = typeof deviceMeterHistory.$inferInsert;
