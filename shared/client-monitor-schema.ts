import { sql, relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  boolean,
  pgEnum,
  uuid,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { deviceRegistrations, deviceMetrics } from './manufacturer-integration-schema';

// Enums for monitoring clients
export const clientStatusEnum = pgEnum('client_status', [
  'active',
  'inactive',
  'error',
  'pending_setup',
]);

export const clientTypeEnum = pgEnum('client_type', [
  'on_premise', // Deployed at customer location
  'cloud', // Cloud-based collector
  'hybrid', // Mix of both
]);

// Monitoring Client Registration
export const monitoringClients = pgTable(
  'monitoring_clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    clientId: varchar('client_id', { length: 100 }).notNull().unique(), // Unique identifier for client
    clientName: varchar('client_name', { length: 255 }).notNull(),
    clientType: clientTypeEnum('client_type').default('on_premise').notNull(),
    status: clientStatusEnum('status').default('pending_setup').notNull(),

    // Authentication
    apiKey: varchar('api_key', { length: 255 }).notNull().unique(), // Hashed API key
    apiKeyLastRotated: timestamp('api_key_last_rotated'),

    // Client information
    version: varchar('version', { length: 50 }),
    hostname: varchar('hostname', { length: 255 }),
    ipAddress: varchar('ip_address', { length: 45 }),
    networkRanges: text('network_ranges').array(), // IP ranges to monitor

    // Configuration
    configuration: jsonb('configuration').default({
      pollingInterval: 300, // seconds
      discoveryEnabled: true,
      retryAttempts: 3,
      timeout: 10000, // milliseconds
      tonerThreshold: 15, // percent
      paperThreshold: 20, // percent
    }),

    // Activity tracking
    lastHeartbeat: timestamp('last_heartbeat'),
    lastSuccessfulCollection: timestamp('last_successful_collection'),
    totalDevicesMonitored: jsonb('total_devices_monitored').default(0),
    totalMetricsCollected: jsonb('total_metrics_collected').default(0),

    // Metadata
    description: text('description'),
    location: varchar('location', { length: 255 }),
    contactEmail: varchar('contact_email', { length: 255 }),

    // Optional pointer to the customer (business_records row) this client
    // monitors. Filled when an admin creates a client in the UI and picks a
    // customer; the bundled installer can then surface customer context to
    // the operator without making a second lookup.
    customerId: varchar('customer_id', { length: 255 }),

    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at')
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at')
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    tenantClientIdx: index('tenant_client_idx').on(table.tenantId, table.clientId),
    statusIdx: index('client_status_idx').on(table.status),
    lastHeartbeatIdx: index('client_heartbeat_idx').on(table.lastHeartbeat),
    apiKeyIdx: index('client_api_key_idx').on(table.apiKey),
  }),
);

// Client Activity Logs
export const clientActivityLogs = pgTable(
  'client_activity_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => monitoringClients.id, { onDelete: 'cascade' }),

    activity: varchar('activity', { length: 100 }).notNull(), // 'heartbeat', 'metrics_submitted', 'error', 'config_update'
    status: varchar('status', { length: 50 }).notNull(), // 'success', 'error', 'warning'
    message: text('message'),
    details: jsonb('details').default({}),

    // Metrics for this submission
    devicesInSubmission: jsonb('devices_in_submission').default(0),
    metricsCount: jsonb('metrics_count').default(0),

    errorCode: varchar('error_code', { length: 50 }),
    timestamp: timestamp('timestamp')
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    tenantTimeIdx: index('client_tenant_time_idx').on(table.tenantId, table.timestamp),
    clientTimeIdx: index('client_activity_time_idx').on(table.clientId, table.timestamp),
    activityIdx: index('client_activity_idx').on(table.activity),
    statusIdx: index('client_activity_status_idx').on(table.status),
  }),
);

// Client Discovered Devices (before registration)
export const clientDiscoveredDevices = pgTable(
  'client_discovered_devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => monitoringClients.id, { onDelete: 'cascade' }),

    // Device identification
    ipAddress: varchar('ip_address', { length: 45 }).notNull(),
    macAddress: varchar('mac_address', { length: 17 }),
    serialNumber: varchar('serial_number', { length: 255 }),
    manufacturer: varchar('manufacturer', { length: 100 }),
    model: varchar('model', { length: 255 }),

    // Discovery information
    protocol: varchar('protocol', { length: 50 }), // 'snmp', 'http', 'https'
    capabilities: jsonb('capabilities').default([]),

    // Registration status
    isRegistered: boolean('is_registered').default(false),
    registeredDeviceId: uuid('registered_device_id').references(() => deviceRegistrations.id),

    firstDiscovered: timestamp('first_discovered')
      .default(sql`now()`)
      .notNull(),
    lastSeen: timestamp('last_seen')
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp('updated_at')
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    tenantClientIdx: index('discovered_tenant_client_idx').on(table.tenantId, table.clientId),
    ipAddressIdx: index('discovered_ip_idx').on(table.ipAddress),
    registeredIdx: index('discovered_registered_idx').on(table.isRegistered),
    lastSeenIdx: index('discovered_last_seen_idx').on(table.lastSeen),
  }),
);

// Enrollment tokens for the bootstrap flow.
//
// An admin generates a one-time, short-lived token in the platform; the
// installer trades the token for the client's permanent API key over HTTPS.
// The token is stored as a SHA-256 hash so a database leak does not surrender
// usable enrollment material.
export const clientEnrollmentTokens = pgTable(
  'client_enrollment_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => monitoringClients.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(), // sha256 hex
    createdByUserId: varchar('created_by_user_id', { length: 255 }),
    expiresAt: timestamp('expires_at').notNull(),
    usedAt: timestamp('used_at'),
    usedFromIp: varchar('used_from_ip', { length: 45 }),
    usedFromHostname: varchar('used_from_hostname', { length: 255 }),
    revokedAt: timestamp('revoked_at'),
    createdAt: timestamp('created_at')
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    tenantIdx: index('enrollment_tenant_idx').on(table.tenantId),
    clientIdx: index('enrollment_client_idx').on(table.clientId),
    tokenHashIdx: index('enrollment_token_hash_idx').on(table.tokenHash),
    expiresIdx: index('enrollment_expires_idx').on(table.expiresAt),
  }),
);

// Remote-control commands queued for a monitoring client.
//
// The platform writes a row here when an operator wants the agent to do
// something (rescan the network, reload config, rotate its API key, force
// a metrics submission). The agent reads pending commands on every
// heartbeat, executes them, and posts the result back via
// /api/client-metrics/commands/:id/ack.
//
// Status flow:
//   queued -> dispatched (agent picked it up) -> done | failed | expired
export const clientCommands = pgTable(
  'client_commands',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => monitoringClients.id, { onDelete: 'cascade' }),
    // Command discriminator: 'rescan', 'reload-config', 'force-submit',
    // 'rotate-key', 'restart'. New commands are added by the agent's
    // CommandProcessor switch — anything it doesn't recognise is acked
    // with status='failed' so the queue doesn't stick.
    command: varchar('command', { length: 64 }).notNull(),
    payload: jsonb('payload').default({}),
    status: varchar('status', { length: 32 }).notNull().default('queued'),
    issuedByUserId: varchar('issued_by_user_id', { length: 255 }),
    dispatchedAt: timestamp('dispatched_at'),
    completedAt: timestamp('completed_at'),
    expiresAt: timestamp('expires_at').notNull(),
    result: jsonb('result'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at')
      .default(sql`now()`)
      .notNull(),
  },
  (table) => ({
    clientStatusIdx: index('client_commands_client_status_idx').on(table.clientId, table.status),
    expiresIdx: index('client_commands_expires_idx').on(table.expiresAt),
  }),
);

// Relations
export const monitoringClientsRelations = relations(monitoringClients, ({ many }) => ({
  activityLogs: many(clientActivityLogs),
  discoveredDevices: many(clientDiscoveredDevices),
  enrollmentTokens: many(clientEnrollmentTokens),
  commands: many(clientCommands),
}));

export const clientCommandsRelations = relations(clientCommands, ({ one }) => ({
  client: one(monitoringClients, {
    fields: [clientCommands.clientId],
    references: [monitoringClients.id],
  }),
}));

export const clientEnrollmentTokensRelations = relations(clientEnrollmentTokens, ({ one }) => ({
  client: one(monitoringClients, {
    fields: [clientEnrollmentTokens.clientId],
    references: [monitoringClients.id],
  }),
}));

export const clientActivityLogsRelations = relations(clientActivityLogs, ({ one }) => ({
  client: one(monitoringClients, {
    fields: [clientActivityLogs.clientId],
    references: [monitoringClients.id],
  }),
}));

export const clientDiscoveredDevicesRelations = relations(clientDiscoveredDevices, ({ one }) => ({
  client: one(monitoringClients, {
    fields: [clientDiscoveredDevices.clientId],
    references: [monitoringClients.id],
  }),
  registeredDevice: one(deviceRegistrations, {
    fields: [clientDiscoveredDevices.registeredDeviceId],
    references: [deviceRegistrations.id],
  }),
}));

// Insert schemas
export const insertMonitoringClientSchema = createInsertSchema(monitoringClients);
export const insertClientActivityLogSchema = createInsertSchema(clientActivityLogs);
export const insertClientDiscoveredDeviceSchema = createInsertSchema(clientDiscoveredDevices);
export const insertClientEnrollmentTokenSchema = createInsertSchema(clientEnrollmentTokens);
export const insertClientCommandSchema = createInsertSchema(clientCommands);

// Types
export type MonitoringClient = typeof monitoringClients.$inferSelect;
export type InsertMonitoringClient = z.infer<typeof insertMonitoringClientSchema>;
export type ClientActivityLog = typeof clientActivityLogs.$inferSelect;
export type InsertClientActivityLog = z.infer<typeof insertClientActivityLogSchema>;
export type ClientDiscoveredDevice = typeof clientDiscoveredDevices.$inferSelect;
export type InsertClientDiscoveredDevice = z.infer<typeof insertClientDiscoveredDeviceSchema>;
export type ClientEnrollmentToken = typeof clientEnrollmentTokens.$inferSelect;
export type InsertClientEnrollmentToken = z.infer<typeof insertClientEnrollmentTokenSchema>;
export type ClientCommand = typeof clientCommands.$inferSelect;
export type InsertClientCommand = z.infer<typeof insertClientCommandSchema>;

// Request validation schemas
export const clientMetricSubmissionSchema = z.object({
  clientId: z.string().min(1),
  clientVersion: z.string().optional(),
  timestamp: z.string().datetime(),
  devices: z.array(
    z.object({
      serialNumber: z.string().min(1),
      ipAddress: z.string().ip().optional(),
      macAddress: z.string().optional(),
      manufacturer: z.string().optional(),
      model: z.string().optional(),
      tonerLevels: z.record(z.number().min(0).max(100)).optional(),
      paperLevels: z.record(z.number().min(0).max(100)).optional(),
      meters: z
        .object({
          totalImpressions: z.number().optional(),
          bwImpressions: z.number().optional(),
          colorImpressions: z.number().optional(),
          largeImpressions: z.number().optional(),
        })
        .optional(),
      deviceStatus: z.enum(['online', 'offline', 'error', 'maintenance', 'unknown']).optional(),
      errorCodes: z.array(z.string()).optional(),
      collectionTimestamp: z.string().datetime(),
      rawData: z.any().optional(),
    }),
  ),
});

export type ClientMetricSubmission = z.infer<typeof clientMetricSubmissionSchema>;
