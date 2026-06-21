/**
 * Slack/Teams Natural-Language Printyx Bot Schema (US-SUPER-014) — READ-ONLY v1.
 *
 * A dealer manager asks "what happened with Acme this week?" from Slack/Teams
 * and gets the answer with deep links back to Printyx. v1 is READ-ONLY (no
 * writes); a Claude agent selects among named read-only query tools, scoped to
 * what the mapped Printyx user is allowed to see, and every query is audited.
 *
 *   - chatbot_connections : per-tenant Slack/Teams workspace install (encrypted OAuth tokens)
 *   - chatbot_user_links  : Slack/Teams user → Printyx user (mapped by verified email)
 *   - chatbot_query_log   : append-only audit of every query (actor, channel, question, tools, response)
 *
 * OAuth + platform replies sit behind named adapter stubs; tokens encrypted
 * (credential vault) and never returned. Re-exported from shared/schema.ts.
 * TODO(rbac): requirePermission(['integrations.chatbot.manage']) for the admin
 * routes once it exists; the query itself is scoped to the mapped user's RBAC.
 */

import {
  boolean,
  index,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const CHATBOT_PLATFORMS = ['slack', 'teams'] as const;
export type ChatbotPlatform = (typeof CHATBOT_PLATFORMS)[number];

// ---------------------------------------------------------------------------
// chatbot_connections — per-tenant workspace install
// ---------------------------------------------------------------------------
export const chatbotConnections = pgTable(
  'chatbot_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** slack | teams. */
    platform: varchar('platform', { length: 12 }).notNull(),
    /** Slack team id / Teams tenant id. */
    teamId: varchar('team_id').notNull(),
    teamName: varchar('team_name'),
    /** Encrypted OAuth tokens (bot token, etc.); never returned. */
    encryptedTokens: jsonb('encrypted_tokens'),
    enabled: boolean('enabled').notNull().default(true),
    installedByUserId: varchar('installed_by_user_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('chatbot_connections_tenant_idx').on(table.tenantId),
    tenantPlatformTeamUnique: uniqueIndex('chatbot_connections_tenant_platform_team_uq').on(
      table.tenantId,
      table.platform,
      table.teamId,
    ),
  }),
);

// ---------------------------------------------------------------------------
// chatbot_user_links — Slack/Teams user → Printyx user (by verified email)
// ---------------------------------------------------------------------------
export const chatbotUserLinks = pgTable(
  'chatbot_user_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    platform: varchar('platform', { length: 12 }).notNull(),
    /** Slack/Teams user id. */
    platformUserId: varchar('platform_user_id').notNull(),
    /** The email used to match — must verify against the Printyx user. */
    email: varchar('email'),
    /** Mapped Printyx users.id (RBAC scoping uses this). */
    printyxUserId: varchar('printyx_user_id'),
    verified: boolean('verified').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantPlatformUserUnique: uniqueIndex('chatbot_user_links_tenant_platform_user_uq').on(
      table.tenantId,
      table.platform,
      table.platformUserId,
    ),
  }),
);

// ---------------------------------------------------------------------------
// chatbot_query_log — append-only audit of every query
// ---------------------------------------------------------------------------
export const chatbotQueryLog = pgTable(
  'chatbot_query_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    platform: varchar('platform', { length: 12 }),
    channel: varchar('channel'),
    platformUserId: varchar('platform_user_id'),
    /** Resolved Printyx user (null when unmapped → access denied). */
    printyxUserId: varchar('printyx_user_id'),
    question: varchar('question', { length: 2000 }),
    /** Which read-only tools the agent invoked: [{ tool, args }]. */
    toolsCalled: jsonb('tools_called'),
    /** Truncated response for audit. */
    responseExcerpt: varchar('response_excerpt', { length: 2000 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('chatbot_query_log_tenant_idx').on(table.tenantId),
    tenantCreatedIdx: index('chatbot_query_log_tenant_created_idx').on(
      table.tenantId,
      table.createdAt,
    ),
  }),
);

export type ChatbotConnection = typeof chatbotConnections.$inferSelect;
export type ChatbotUserLink = typeof chatbotUserLinks.$inferSelect;
export type ChatbotQueryLog = typeof chatbotQueryLog.$inferSelect;
