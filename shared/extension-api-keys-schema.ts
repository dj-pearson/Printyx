// PA-044: persisted Chrome-extension API keys.
//
// The extension calls the /api/extension/* endpoints from a different origin
// than the web app, so it authenticates with an API key (not the browser
// session). Keys were generated but never stored, so they could never
// authenticate a later request. This table persists a SHA-256 hash of the key
// (never the raw key), with an expiry and revoke timestamp.
import { pgTable, varchar, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';

export const extensionApiKeys = pgTable('extension_api_keys', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id').notNull(),
  userId: varchar('user_id').notNull(),
  // SHA-256 hex of the raw key — the raw key is shown once and never stored.
  keyHash: varchar('key_hash').notNull(),
  // Leading chars of the raw key, for display/identification only.
  keyPrefix: varchar('key_prefix').notNull(),
  name: varchar('name'),
  expiresAt: timestamp('expires_at'),
  lastUsedAt: timestamp('last_used_at'),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const insertExtensionApiKeySchema = createInsertSchema(extensionApiKeys);
export type ExtensionApiKey = typeof extensionApiKeys.$inferSelect;
export type InsertExtensionApiKey = typeof extensionApiKeys.$inferInsert;
