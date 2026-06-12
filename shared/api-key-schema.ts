/**
 * API Key Management Schema
 *
 * Database schema for API key generation and management
 * for service-to-service authentication.
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  index,
  unique,
  integer,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users, tenants } from './schema';

// API Key Types
export const apiKeyTypeEnum = pgEnum('api_key_type', [
  'service', // Service-to-service communication
  'integration', // Third-party integrations
  'webhook', // Webhook delivery
  'readonly', // Read-only API access
  'admin', // Full administrative access
]);

// API Key Status
export const apiKeyStatusEnum = pgEnum('api_key_status', [
  'active',
  'inactive',
  'expired',
  'revoked',
]);

/**
 * API Keys Table
 *
 * Stores API keys for programmatic access to the API.
 */
export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    // Key identification
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    keyType: apiKeyTypeEnum('key_type').notNull().default('service'),

    // Key data (prefix + last4 are visible, hash is stored for verification)
    keyPrefix: varchar('key_prefix', { length: 20 }).notNull(), // e.g. "pk_live_" + first 8 chars for identification
    keyLast4: varchar('key_last4', { length: 4 }), // Last 4 chars for masked display
    keyHash: varchar('key_hash', { length: 128 }).notNull(), // HMAC-SHA256 hash of the full key
    keySalt: varchar('key_salt', { length: 64 }).notNull(), // Salt used for hashing

    // Status
    status: apiKeyStatusEnum('status').notNull().default('active'),
    isActive: boolean('is_active').notNull().default(true),

    // Expiration
    expiresAt: timestamp('expires_at'),
    neverExpires: boolean('never_expires').notNull().default(false),

    // Permissions and scopes
    scopes: jsonb('scopes').$type<string[]>().default([]),
    permissions: jsonb('permissions').$type<string[]>().default([]),

    // IP restrictions
    allowedIps: jsonb('allowed_ips').$type<string[]>().default([]),
    allowAllIps: boolean('allow_all_ips').notNull().default(true),

    // Rate limiting
    rateLimitPerMinute: integer('rate_limit_per_minute').default(1000),
    rateLimitPerHour: integer('rate_limit_per_hour').default(10000),
    rateLimitPerDay: integer('rate_limit_per_day').default(100000),

    // Usage tracking
    lastUsedAt: timestamp('last_used_at'),
    usageCount: varchar('usage_count', { length: 20 }).default('0'),
    lastUsedIp: varchar('last_used_ip', { length: 45 }),
    lastUsedUserAgent: text('last_used_user_agent'),

    // Environment restrictions
    environment: varchar('environment', { length: 50 }).default('production'), // production, staging, development
    allowedEnvironments: jsonb('allowed_environments').$type<string[]>().default(['production']),

    // Metadata
    metadata: jsonb('metadata').$type<Record<string, any>>().default({}),
    tags: jsonb('tags').$type<string[]>().default([]),

    // Ownership
    createdBy: varchar('created_by').references(() => users.id, { onDelete: 'set null' }),
    revokedBy: varchar('revoked_by').references(() => users.id, { onDelete: 'set null' }),
    revokedAt: timestamp('revoked_at'),
    revokedReason: text('revoked_reason'),

    // Audit fields
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('api_keys_tenant_idx').on(table.tenantId),
    keyPrefixIdx: index('api_keys_key_prefix_idx').on(table.keyPrefix),
    keyHashIdx: index('api_keys_key_hash_idx').on(table.keyHash),
    statusIdx: index('api_keys_status_idx').on(table.status),
    expiresAtIdx: index('api_keys_expires_at_idx').on(table.expiresAt),
    keyTypeIdx: index('api_keys_key_type_idx').on(table.keyType),
    uniqueKeyHash: unique('api_keys_key_hash_unique').on(table.keyHash),
  }),
);

/**
 * API Key Usage Logs
 *
 * Detailed logging of API key usage for audit and analytics.
 */
export const apiKeyUsageLogs = pgTable(
  'api_key_usage_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    apiKeyId: uuid('api_key_id')
      .notNull()
      .references(() => apiKeys.id, { onDelete: 'cascade' }),
    tenantId: varchar('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    // Request details
    requestId: varchar('request_id', { length: 255 }),
    method: varchar('method', { length: 10 }).notNull(),
    path: varchar('path', { length: 1024 }).notNull(),
    queryParams: jsonb('query_params').$type<Record<string, any>>().default({}),

    // Response details
    statusCode: integer('status_code'),
    responseTimeMs: integer('response_time_ms'),
    errorMessage: text('error_message'),

    // Client info
    clientIp: varchar('client_ip', { length: 45 }),
    userAgent: text('user_agent'),
    origin: varchar('origin', { length: 512 }),

    // Timestamp
    timestamp: timestamp('timestamp').defaultNow().notNull(),
  },
  (table) => ({
    apiKeyIdx: index('api_key_usage_logs_api_key_idx').on(table.apiKeyId),
    tenantIdx: index('api_key_usage_logs_tenant_idx').on(table.tenantId),
    timestampIdx: index('api_key_usage_logs_timestamp_idx').on(table.timestamp),
    methodPathIdx: index('api_key_usage_logs_method_path_idx').on(table.method, table.path),
  }),
);

/**
 * API Key Rate Limit Buckets
 *
 * Tracks rate limit usage for sliding window rate limiting.
 */
export const apiKeyRateLimits = pgTable(
  'api_key_rate_limits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    apiKeyId: uuid('api_key_id')
      .notNull()
      .references(() => apiKeys.id, { onDelete: 'cascade' }),

    // Bucket identification
    bucketType: varchar('bucket_type', { length: 20 }).notNull(), // minute, hour, day
    bucketKey: varchar('bucket_key', { length: 50 }).notNull(), // e.g., "2024-01-15T10:30" for minute bucket

    // Count
    requestCount: integer('request_count').notNull().default(0),

    // Timing
    bucketStart: timestamp('bucket_start').notNull(),
    bucketEnd: timestamp('bucket_end').notNull(),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    apiKeyIdx: index('api_key_rate_limits_api_key_idx').on(table.apiKeyId),
    bucketKeyIdx: index('api_key_rate_limits_bucket_key_idx').on(
      table.apiKeyId,
      table.bucketType,
      table.bucketKey,
    ),
    bucketEndIdx: index('api_key_rate_limits_bucket_end_idx').on(table.bucketEnd),
    uniqueBucket: unique('api_key_rate_limits_bucket_unique').on(
      table.apiKeyId,
      table.bucketType,
      table.bucketKey,
    ),
  }),
);

/**
 * API Key Rotations
 *
 * Tracks key rotation history for audit purposes.
 */
export const apiKeyRotations = pgTable(
  'api_key_rotations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    apiKeyId: uuid('api_key_id')
      .notNull()
      .references(() => apiKeys.id, { onDelete: 'cascade' }),
    tenantId: varchar('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),

    // Old key info (hash only for security)
    oldKeyPrefix: varchar('old_key_prefix', { length: 20 }).notNull(),
    oldKeyHash: varchar('old_key_hash', { length: 128 }).notNull(),

    // New key info
    newKeyPrefix: varchar('new_key_prefix', { length: 20 }).notNull(),

    // Rotation details
    rotatedAt: timestamp('rotated_at').defaultNow().notNull(),
    rotatedBy: varchar('rotated_by').references(() => users.id, { onDelete: 'set null' }),
    reason: text('reason'),

    // Grace period for old key
    gracePeriodEndsAt: timestamp('grace_period_ends_at'),
    oldKeyDisabledAt: timestamp('old_key_disabled_at'),
  },
  (table) => ({
    apiKeyIdx: index('api_key_rotations_api_key_idx').on(table.apiKeyId),
    tenantIdx: index('api_key_rotations_tenant_idx').on(table.tenantId),
    rotatedAtIdx: index('api_key_rotations_rotated_at_idx').on(table.rotatedAt),
  }),
);

// Relations
export const apiKeysRelations = relations(apiKeys, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [apiKeys.tenantId],
    references: [tenants.id],
  }),
  createdByUser: one(users, {
    fields: [apiKeys.createdBy],
    references: [users.id],
    relationName: 'apiKeyCreator',
  }),
  revokedByUser: one(users, {
    fields: [apiKeys.revokedBy],
    references: [users.id],
    relationName: 'apiKeyRevoker',
  }),
  usageLogs: many(apiKeyUsageLogs),
  rateLimits: many(apiKeyRateLimits),
  rotations: many(apiKeyRotations),
}));

export const apiKeyUsageLogsRelations = relations(apiKeyUsageLogs, ({ one }) => ({
  apiKey: one(apiKeys, {
    fields: [apiKeyUsageLogs.apiKeyId],
    references: [apiKeys.id],
  }),
  tenant: one(tenants, {
    fields: [apiKeyUsageLogs.tenantId],
    references: [tenants.id],
  }),
}));

export const apiKeyRateLimitsRelations = relations(apiKeyRateLimits, ({ one }) => ({
  apiKey: one(apiKeys, {
    fields: [apiKeyRateLimits.apiKeyId],
    references: [apiKeys.id],
  }),
}));

export const apiKeyRotationsRelations = relations(apiKeyRotations, ({ one }) => ({
  apiKey: one(apiKeys, {
    fields: [apiKeyRotations.apiKeyId],
    references: [apiKeys.id],
  }),
  tenant: one(tenants, {
    fields: [apiKeyRotations.tenantId],
    references: [tenants.id],
  }),
  rotatedByUser: one(users, {
    fields: [apiKeyRotations.rotatedBy],
    references: [users.id],
  }),
}));

// Zod Schemas
export const insertApiKeySchema = createInsertSchema(apiKeys);
export const selectApiKeySchema = createSelectSchema(apiKeys);
export const insertApiKeyUsageLogSchema = createInsertSchema(apiKeyUsageLogs);
export const selectApiKeyUsageLogSchema = createSelectSchema(apiKeyUsageLogs);

// Type exports
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type ApiKeyUsageLog = typeof apiKeyUsageLogs.$inferSelect;
export type NewApiKeyUsageLog = typeof apiKeyUsageLogs.$inferInsert;
export type ApiKeyRateLimit = typeof apiKeyRateLimits.$inferSelect;
export type NewApiKeyRateLimit = typeof apiKeyRateLimits.$inferInsert;
export type ApiKeyRotation = typeof apiKeyRotations.$inferSelect;
export type NewApiKeyRotation = typeof apiKeyRotations.$inferInsert;

// Constants
export const API_KEY_PREFIX = 'pk_'; // Printyx Key prefix
export const API_KEY_LIVE_PREFIX = 'pk_live_';
export const API_KEY_TEST_PREFIX = 'pk_test_';

// Scope definitions
export const API_KEY_SCOPES = {
  // Read scopes
  READ_CUSTOMERS: 'customers:read',
  READ_PRODUCTS: 'products:read',
  READ_ORDERS: 'orders:read',
  READ_INVENTORY: 'inventory:read',
  READ_INVOICES: 'invoices:read',
  READ_REPORTS: 'reports:read',

  // Write scopes
  WRITE_CUSTOMERS: 'customers:write',
  WRITE_PRODUCTS: 'products:write',
  WRITE_ORDERS: 'orders:write',
  WRITE_INVENTORY: 'inventory:write',
  WRITE_INVOICES: 'invoices:write',

  // Admin scopes
  ADMIN_USERS: 'admin:users',
  ADMIN_SETTINGS: 'admin:settings',
  ADMIN_INTEGRATIONS: 'admin:integrations',

  // Special scopes
  WEBHOOKS: 'webhooks:manage',
  BULK_OPERATIONS: 'bulk:operations',
} as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[keyof typeof API_KEY_SCOPES];

// Validation schemas for API
export const createApiKeyRequestSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  keyType: z.enum(['service', 'integration', 'webhook', 'readonly', 'admin']).default('service'),
  scopes: z.array(z.string()).default([]),
  permissions: z.array(z.string()).default([]),
  expiresAt: z.string().datetime().optional(),
  neverExpires: z.boolean().default(false),
  allowedIps: z.array(z.string()).default([]),
  allowAllIps: z.boolean().default(true),
  rateLimitPerMinute: z.number().int().min(1).max(10000).default(1000),
  rateLimitPerHour: z.number().int().min(1).max(100000).default(10000),
  rateLimitPerDay: z.number().int().min(1).max(1000000).default(100000),
  environment: z.enum(['production', 'staging', 'development']).default('production'),
  metadata: z.record(z.any()).default({}),
  tags: z.array(z.string()).default([]),
});

export const updateApiKeyRequestSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  scopes: z.array(z.string()).optional(),
  permissions: z.array(z.string()).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
  neverExpires: z.boolean().optional(),
  allowedIps: z.array(z.string()).optional(),
  allowAllIps: z.boolean().optional(),
  rateLimitPerMinute: z.number().int().min(1).max(10000).optional(),
  rateLimitPerHour: z.number().int().min(1).max(100000).optional(),
  rateLimitPerDay: z.number().int().min(1).max(1000000).optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
  tags: z.array(z.string()).optional(),
});

export type CreateApiKeyRequest = z.infer<typeof createApiKeyRequestSchema>;
export type UpdateApiKeyRequest = z.infer<typeof updateApiKeyRequestSchema>;
