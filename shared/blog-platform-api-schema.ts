/**
 * Blog Platform / Infrastructure Schema — Universal Blog System (US-BLOG-079..085)
 *
 * Platform-layer tables that turn the blog module into a programmable,
 * white-labelable, compliance-ready product:
 *
 *   US-BLOG-079 (webhooks):       blog_webhooks, blog_webhook_deliveries
 *   US-BLOG-080 (public API):     blog_api_keys, blog_api_usage
 *   US-BLOG-081 (backup/export):  blog_backups, blog_backup_config
 *   US-BLOG-083 (white-label):    blog_widget_config
 *   US-BLOG-084 (compliance):     blog_dsar_requests
 *
 * No new tables are required for US-BLOG-085 (smoke test) — it exercises the
 * existing blog_* tables end-to-end with mocked adapters.
 *
 * Conventions (match shared/blog-schema.ts):
 *   - tenant_id: varchar NOT NULL with index
 *   - created_by_user_id: varchar (matches users.id)
 *   - Blog-internal IDs: uuid (new tables, no legacy)
 *   - Secrets / API keys are NEVER stored in plaintext: webhook secrets and CMS
 *     creds are AES-256-GCM encrypted (encrypted_config jsonb); API keys are
 *     stored as a SHA-256 hash (key_hash) + a non-secret key_prefix for lookup.
 *   - Soft-delete via deleted_at on user-facing config tables.
 *   - FKs to existing blog tables live ONLY in the backfill migration.
 *
 * Re-exported from shared/schema.ts via `export * from './blog-platform-api-schema'`
 * (do that in a separate change — this file does not modify schema.ts).
 */

import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Shared enum-ish constants (validated in the edge fn via Zod; plain varchar
// columns so new values ship without a migration).
// ---------------------------------------------------------------------------

/** Webhook event types (US-BLOG-079). */
export const WEBHOOK_EVENTS = [
  'post.created',
  'post.updated',
  'post.published',
  'post.refreshed',
  'distribution.sent',
  'distribution.failed',
  'brief.approved',
  'refresh_queue.added',
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/** Delivery lifecycle for a single (webhook, event) attempt chain. */
export const WEBHOOK_DELIVERY_STATUSES = [
  'pending', // queued, not yet attempted
  'delivering', // in-flight
  'delivered', // 2xx received
  'failed', // non-2xx / network error, will retry
  'dead', // exhausted max attempts → dead-letter
] as const;
export type WebhookDeliveryStatus = (typeof WEBHOOK_DELIVERY_STATUSES)[number];

/** Public-API read scopes granted to an API key (US-BLOG-080). */
export const BLOG_API_KEY_SCOPES = [
  'keywords:read',
  'briefs:read',
  'posts:read',
  'distributions:read',
  'performance:read',
] as const;
export type BlogApiKeyScope = (typeof BLOG_API_KEY_SCOPES)[number];

export const BACKUP_STATUSES = ['pending', 'running', 'completed', 'failed', 'expired'] as const;
export type BackupStatus = (typeof BACKUP_STATUSES)[number];

export const DSAR_TYPES = ['access', 'erasure'] as const;
export type DsarType = (typeof DSAR_TYPES)[number];

export const DSAR_STATUSES = ['requested', 'processing', 'completed', 'failed'] as const;
export type DsarStatus = (typeof DSAR_STATUSES)[number];

// ---------------------------------------------------------------------------
// US-BLOG-079 — blog_webhooks: per-workspace webhook subscription config
// ---------------------------------------------------------------------------
export const blogWebhooks = pgTable(
  'blog_webhooks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** Human label for the consumer endpoint. */
    name: varchar('name', { length: 200 }).notNull(),
    /** Destination URL we POST signed payloads to. */
    url: varchar('url', { length: 2000 }).notNull(),
    /**
     * HMAC signing secret, AES-256-GCM encrypted (EncryptedCredential envelope).
     * Never returned to API clients — only a secret_set boolean marker is.
     */
    encryptedSecret: jsonb('encrypted_secret'),
    /** Subset of WEBHOOK_EVENTS this endpoint subscribes to. Empty/null = all. */
    eventFilter: varchar('event_filter', { length: 60 }).array(),
    /** { maxAttempts, backoffBaseSeconds, backoffFactor }. */
    retryPolicy: jsonb('retry_policy'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_webhooks_tenant_idx').on(table.tenantId),
    tenantActiveIdx: index('blog_webhooks_tenant_active_idx').on(table.tenantId, table.isActive),
  }),
);

export type BlogWebhook = typeof blogWebhooks.$inferSelect;
export type NewBlogWebhook = typeof blogWebhooks.$inferInsert;

// ---------------------------------------------------------------------------
// US-BLOG-079 — blog_webhook_deliveries: one row per (event, webhook) attempt
// chain. Records payload, signature, every attempt's response, and dead-letter.
// ---------------------------------------------------------------------------
export const blogWebhookDeliveries = pgTable(
  'blog_webhook_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** FK → blog_webhooks.id (enforced in migration). */
    webhookId: uuid('webhook_id').notNull(),
    eventType: varchar('event_type', { length: 60 }).notNull(),
    /** Signed JSON body delivered to the consumer. */
    payload: jsonb('payload').notNull(),
    /** HMAC-SHA256 hex signature sent in X-Blog-Signature. */
    signature: varchar('signature', { length: 128 }),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    attemptCount: integer('attempt_count').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(5),
    /** Last HTTP status from the consumer (null until first attempt). */
    lastResponseStatus: integer('last_response_status'),
    /** Truncated response body / error text from the last attempt. */
    lastResponseBody: varchar('last_response_body', { length: 2000 }),
    /** When the next retry becomes eligible (exponential backoff). */
    nextAttemptAt: timestamp('next_attempt_at'),
    deliveredAt: timestamp('delivered_at'),
    /** Full attempt history: [{ attempt, at, status, ms, error? }]. */
    attempts: jsonb('attempts'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('blog_webhook_deliveries_tenant_idx').on(table.tenantId),
    webhookIdx: index('blog_webhook_deliveries_webhook_idx').on(table.webhookId),
    statusIdx: index('blog_webhook_deliveries_status_idx').on(table.status, table.nextAttemptAt),
  }),
);

export type BlogWebhookDelivery = typeof blogWebhookDeliveries.$inferSelect;
export type NewBlogWebhookDelivery = typeof blogWebhookDeliveries.$inferInsert;

// ---------------------------------------------------------------------------
// US-BLOG-080 — blog_api_keys: scoped public-API keys per workspace. We store
// a SHA-256 HASH of the secret (never plaintext) plus a short non-secret prefix
// for display/lookup. The full key is shown exactly once at creation time.
// ---------------------------------------------------------------------------
export const blogApiKeys = pgTable(
  'blog_api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    /** Non-secret prefix shown in UIs, e.g. "blogk_live_3f9a". */
    keyPrefix: varchar('key_prefix', { length: 32 }).notNull(),
    /** SHA-256 hex digest of the full key. Lookup is by hash, never plaintext. */
    keyHash: varchar('key_hash', { length: 64 }).notNull(),
    /** Subset of API_KEY_SCOPES this key may exercise. */
    scopes: varchar('scopes', { length: 40 }).array(),
    /** Max requests per rate-limit window (per key). */
    rateLimitPerMinute: integer('rate_limit_per_minute').notNull().default(120),
    lastUsedAt: timestamp('last_used_at'),
    expiresAt: timestamp('expires_at'),
    revokedAt: timestamp('revoked_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_api_keys_tenant_idx').on(table.tenantId),
    // Hash lookup must be global (resolve key → tenant) so it is indexed alone.
    hashIdx: index('blog_api_keys_hash_idx').on(table.keyHash),
  }),
);

export type BlogApiKey = typeof blogApiKeys.$inferSelect;
export type NewBlogApiKey = typeof blogApiKeys.$inferInsert;

// ---------------------------------------------------------------------------
// US-BLOG-080 — blog_api_usage: rolling per-key request counter for rate
// limiting + usage analytics. One row per (api_key, window_start) minute bucket.
// ---------------------------------------------------------------------------
export const blogApiUsage = pgTable(
  'blog_api_usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    apiKeyId: uuid('api_key_id').notNull(),
    /** Truncated-to-minute UTC window this counter covers. */
    windowStart: timestamp('window_start').notNull(),
    requestCount: integer('request_count').notNull().default(0),
    /** Last endpoint hit in this window (for lightweight analytics). */
    lastEndpoint: varchar('last_endpoint', { length: 200 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('blog_api_usage_tenant_idx').on(table.tenantId),
    keyWindowIdx: index('blog_api_usage_key_window_idx').on(table.apiKeyId, table.windowStart),
  }),
);

export type BlogApiUsage = typeof blogApiUsage.$inferSelect;
export type NewBlogApiUsage = typeof blogApiUsage.$inferInsert;

// ---------------------------------------------------------------------------
// US-BLOG-081 — blog_backups: persisted backup/export run records.
// ---------------------------------------------------------------------------
export const blogBackups = pgTable(
  'blog_backups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** 'manual' | 'scheduled' */
    kind: varchar('kind', { length: 20 }).notNull().default('manual'),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    /** Manifest describing the bundle contents (counts + file refs). */
    manifest: jsonb('manifest'),
    /** S3-compatible object key once uploaded (ZIP streaming is a TODO). */
    storageKey: varchar('storage_key', { length: 500 }),
    sizeBytes: integer('size_bytes'),
    /** Retention expiry; rows past this are purged by the cron sweep. */
    expiresAt: timestamp('expires_at'),
    error: varchar('error', { length: 2000 }),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_backups_tenant_idx').on(table.tenantId),
    tenantStatusIdx: index('blog_backups_tenant_status_idx').on(table.tenantId, table.status),
  }),
);

export type BlogBackup = typeof blogBackups.$inferSelect;
export type NewBlogBackup = typeof blogBackups.$inferInsert;

// ---------------------------------------------------------------------------
// US-BLOG-081 — blog_backup_config: per-workspace scheduled-backup settings.
// One row per tenant (enforced by unique index in the migration).
// ---------------------------------------------------------------------------
export const blogBackupConfig = pgTable(
  'blog_backup_config',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    scheduledEnabled: boolean('scheduled_enabled').notNull().default(false),
    /** Retention window for scheduled bundles, default 30 days. */
    retentionDays: integer('retention_days').notNull().default(30),
    /** S3-compatible target config (bucket, prefix, region). Creds encrypted. */
    storageConfig: jsonb('storage_config'),
    /** AES-256-GCM encrypted storage credentials (EncryptedCredential envelope). */
    encryptedStorageCreds: jsonb('encrypted_storage_creds'),
    lastBackupAt: timestamp('last_backup_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_backup_config_tenant_idx').on(table.tenantId),
  }),
);

export type BlogBackupConfig = typeof blogBackupConfig.$inferSelect;
export type NewBlogBackupConfig = typeof blogBackupConfig.$inferInsert;

// ---------------------------------------------------------------------------
// US-BLOG-083 — blog_widget_config: white-label + embeddable-widget config and
// the per-workspace SSO shared secret (encrypted).
// ---------------------------------------------------------------------------
export const blogWidgetConfig = pgTable(
  'blog_widget_config',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** Hide the "Powered by Blog System" branding for white-label hosts. */
    hideBranding: boolean('hide_branding').notNull().default(false),
    logoUrl: varchar('logo_url', { length: 2000 }),
    /** Named theme preset, e.g. 'light' | 'dark' | 'custom'. */
    theme: varchar('theme', { length: 40 }).notNull().default('light'),
    /** CSS custom properties surfaced to the host, e.g. { "--blog-accent": "#0af" }. */
    cssVariables: jsonb('css_variables'),
    /**
     * AES-256-GCM encrypted shared secret used to verify SSO tokens the parent
     * app issues (HMAC-signed). Never returned; sso_secret_set marker instead.
     */
    encryptedSsoSecret: jsonb('encrypted_sso_secret'),
    /** SSO session validity window in seconds (default 1h). */
    ssoSessionTtlSeconds: integer('sso_session_ttl_seconds').notNull().default(3600),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    deletedAt: timestamp('deleted_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_widget_config_tenant_idx').on(table.tenantId),
  }),
);

export type BlogWidgetConfig = typeof blogWidgetConfig.$inferSelect;
export type NewBlogWidgetConfig = typeof blogWidgetConfig.$inferInsert;

// ---------------------------------------------------------------------------
// US-BLOG-084 — blog_dsar_requests: GDPR/CCPA data-subject access & erasure log.
// ---------------------------------------------------------------------------
export const blogDsarRequests = pgTable(
  'blog_dsar_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** The data subject (user) the request concerns. */
    subjectUserId: varchar('subject_user_id').notNull(),
    /** 'access' (export) | 'erasure' (anonymize). */
    requestType: varchar('request_type', { length: 20 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('requested'),
    /** Counts/summary of what was exported or anonymized. */
    result: jsonb('result'),
    error: varchar('error', { length: 2000 }),
    requestedAt: timestamp('requested_at').notNull().defaultNow(),
    completedAt: timestamp('completed_at'),
    createdByUserId: varchar('created_by_user_id'),
  },
  (table) => ({
    tenantIdx: index('blog_dsar_requests_tenant_idx').on(table.tenantId),
    subjectIdx: index('blog_dsar_requests_subject_idx').on(table.subjectUserId),
  }),
);

export type BlogDsarRequest = typeof blogDsarRequests.$inferSelect;
export type NewBlogDsarRequest = typeof blogDsarRequests.$inferInsert;
