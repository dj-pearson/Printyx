/**
 * Platform Integrations Schema
 *
 * Third-party integration configurations + webhook delivery for a tenant. These
 * tables back two edge functions that were shipped before the schema was
 * defined:
 *   - supabase/functions/integrations/   (GET/POST /integrations/:type/config etc.)
 *   - supabase/functions/webhooks/       (GET/POST /webhooks, /webhooks/:id/logs, etc.)
 *
 * Supported integration types (from the edge function's INTEGRATION_CONFIGS):
 *   eautomate, quickbooks, salesforce, apollo, zoominfo, openai, anthropic
 *
 * Tables
 * ──────
 *   platform_integrations      One row per (tenant, integration_key). Holds
 *                              credentials (jsonb, must be redacted on read),
 *                              config, field mappings, sync cadence, status.
 *
 *   integration_webhooks       Per-integration webhook subscriptions — used by
 *                              the integration to emit events back out.
 *
 *   integration_sync_logs      Sync history: pull/push, entity type, counts,
 *                              status, timestamps.
 *
 *   webhooks                   Generic outbound webhooks (not tied to an
 *                              integration — used for standalone events like
 *                              customer.created, invoice.paid, etc.).
 *
 *   webhook_logs               Delivery attempts per `webhooks` row — payload,
 *                              response status, success/error.
 *
 * Security
 * ────────
 *   - `credentials` in platform_integrations is sensitive; redact on every
 *     SELECT response using supabase/functions/_shared/credentials.ts.
 *   - `secret` in integration_webhooks and webhooks is sensitive; same rule.
 *   - RLS policies live in drizzle/rls/platform-integrations.sql (standard
 *     tenant-scoped 4-policy template).
 */

import {
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// ==================== Platform Integrations ====================

export const platformIntegrations = pgTable(
  'platform_integrations',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),

    // Integration identity
    integrationKey: varchar('integration_key', { length: 64 }).notNull(), // e.g. 'quickbooks'
    integrationName: varchar('integration_name', { length: 128 }).notNull(), // e.g. 'QuickBooks'
    category: varchar('category', { length: 32 }).notNull(), // 'erp' | 'crm' | 'ai' | 'data-enrichment' etc.

    // Config payloads — stored as jsonb so per-integration shape can vary.
    // credentials: sensitive — NEVER return raw from any handler (see _shared/credentials.ts).
    credentials: jsonb('credentials').$type<Record<string, unknown>>().notNull().default({}),
    config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
    fieldMappings: jsonb('field_mappings').$type<Record<string, unknown>>().notNull().default({}),

    // Cadence
    syncFrequency: varchar('sync_frequency', { length: 32 }).notNull().default('manual'), // 'manual' | 'hourly' | 'daily' | 'weekly'

    // State
    status: varchar('status', { length: 32 }).notNull().default('configured'), // 'configured' | 'active' | 'error' | 'paused'
    lastSyncedAt: timestamp('last_synced_at'),
    lastSyncStatus: varchar('last_sync_status', { length: 32 }),
    lastErrorMessage: text('last_error_message'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantKeyUnique: uniqueIndex('platform_integrations_tenant_key_unique').on(
      table.tenantId,
      table.integrationKey,
    ),
    tenantIdx: index('platform_integrations_tenant_idx').on(table.tenantId),
    statusIdx: index('platform_integrations_status_idx').on(table.tenantId, table.status),
  }),
);

// ==================== Integration Webhooks ====================
// Webhook subscriptions scoped to a specific integration (e.g., "Salesforce
// should notify us when a record changes"). Distinct from the standalone
// `webhooks` table below.

export const integrationWebhooks = pgTable(
  'integration_webhooks',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    integrationId: varchar('integration_id').notNull(), // FK-ish (no DB constraint — app-enforced)

    webhookUrl: text('webhook_url').notNull(),
    eventTypes: jsonb('event_types').$type<string[]>().notNull().default([]),
    secret: text('secret').notNull(), // HMAC signing secret — sensitive
    isActive: boolean('is_active').notNull().default(true),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('integration_webhooks_tenant_idx').on(table.tenantId),
    integrationIdx: index('integration_webhooks_integration_idx').on(table.integrationId),
  }),
);

// ==================== Integration Sync Logs ====================

export const integrationSyncLogs = pgTable(
  'integration_sync_logs',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    integrationId: varchar('integration_id').notNull(),
    tenantId: varchar('tenant_id').notNull(), // denormalized for RLS + fast tenant filtering

    syncType: varchar('sync_type', { length: 16 }).notNull().default('pull'), // 'pull' | 'push' | 'full'
    entityType: varchar('entity_type', { length: 64 }), // 'customers' | 'invoices' | 'equipment' etc.
    status: varchar('status', { length: 24 }).notNull().default('in_progress'), // 'in_progress' | 'completed' | 'failed' | 'cancelled'

    recordsFetched: integer('records_fetched').default(0),
    recordsCreated: integer('records_created').default(0),
    recordsUpdated: integer('records_updated').default(0),
    recordsFailed: integer('records_failed').default(0),
    errorMessage: text('error_message'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),

    startedAt: timestamp('started_at').notNull().defaultNow(),
    completedAt: timestamp('completed_at'),
  },
  (table) => ({
    integrationIdx: index('integration_sync_logs_integration_idx').on(table.integrationId),
    tenantStartedIdx: index('integration_sync_logs_tenant_started_idx').on(
      table.tenantId,
      table.startedAt,
    ),
  }),
);

// ==================== Generic Webhooks ====================
// Standalone outbound webhooks for platform events (customer.created,
// invoice.paid, work_order.completed, etc.). Not tied to a specific
// third-party integration.

export const webhooks = pgTable(
  'webhooks',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),

    name: varchar('name', { length: 128 }).notNull(),
    url: text('url').notNull(),
    events: jsonb('events').$type<string[]>().notNull().default([]),
    secret: text('secret').notNull(), // signing secret — sensitive
    headers: jsonb('headers').$type<Record<string, string>>().notNull().default({}), // custom headers to send
    retryCount: integer('retry_count').notNull().default(3),
    isActive: boolean('is_active').notNull().default(true),

    createdBy: varchar('created_by'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('webhooks_tenant_idx').on(table.tenantId),
  }),
);

// ==================== Webhook Delivery Logs ====================

export const webhookLogs = pgTable(
  'webhook_logs',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    webhookId: varchar('webhook_id').notNull(),
    tenantId: varchar('tenant_id').notNull(), // denormalized for RLS (copy from parent webhook on insert)

    event: varchar('event', { length: 64 }).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),

    responseStatus: integer('response_status'),
    responseBody: text('response_body'),
    errorMessage: text('error_message'),
    success: boolean('success').notNull().default(false),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    webhookIdx: index('webhook_logs_webhook_idx').on(table.webhookId, table.createdAt),
    tenantIdx: index('webhook_logs_tenant_idx').on(table.tenantId, table.createdAt),
  }),
);

// ==================== Zod Insert Schemas ====================

export const insertPlatformIntegrationSchema = createInsertSchema(platformIntegrations).extend({
  credentials: z.record(z.unknown()).default({}),
  config: z.record(z.unknown()).default({}),
  fieldMappings: z.record(z.unknown()).default({}),
});

export const insertIntegrationWebhookSchema = createInsertSchema(integrationWebhooks).extend({
  eventTypes: z.array(z.string()).default([]),
});

export const insertIntegrationSyncLogSchema = createInsertSchema(integrationSyncLogs);

export const insertWebhookSchema = createInsertSchema(webhooks).extend({
  events: z.array(z.string()).default([]),
  headers: z.record(z.string()).default({}),
});

export const insertWebhookLogSchema = createInsertSchema(webhookLogs);

// ==================== Inferred Types ====================

export type PlatformIntegration = typeof platformIntegrations.$inferSelect;
export type NewPlatformIntegration = typeof platformIntegrations.$inferInsert;

export type IntegrationWebhook = typeof integrationWebhooks.$inferSelect;
export type NewIntegrationWebhook = typeof integrationWebhooks.$inferInsert;

export type IntegrationSyncLog = typeof integrationSyncLogs.$inferSelect;
export type NewIntegrationSyncLog = typeof integrationSyncLogs.$inferInsert;

export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;

export type WebhookLog = typeof webhookLogs.$inferSelect;
export type NewWebhookLog = typeof webhookLogs.$inferInsert;
