/**
 * Chrome-extension API keys (PA-044).
 *
 * Stores only a SHA-256 hash of each generated key plus a non-secret lookup
 * prefix, with expiry + revocation. The plaintext key is shown to the user once
 * at generation and never persisted.
 */
import { pgTable, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';

export const extensionApiKeys = pgTable(
  'extension_api_keys',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    userId: varchar('user_id').notNull(),
    // SHA-256 hex of the full key — never the plaintext.
    keyHash: varchar('key_hash').notNull(),
    // Non-secret leading chars of the key, used to look the row up fast.
    keyPrefix: varchar('key_prefix').notNull(),
    name: varchar('name'),
    lastUsedAt: timestamp('last_used_at'),
    expiresAt: timestamp('expires_at'),
    revokedAt: timestamp('revoked_at'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    prefixIdx: index('extension_api_keys_prefix_idx').on(table.keyPrefix),
    tenantIdx: index('extension_api_keys_tenant_idx').on(table.tenantId),
  }),
);

export const insertExtensionApiKeySchema = createInsertSchema(extensionApiKeys).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true,
});

export type ExtensionApiKey = typeof extensionApiKeys.$inferSelect;
export type InsertExtensionApiKey = typeof extensionApiKeys.$inferInsert;
