/**
 * Daily Role-Based Morning Briefings Schema (US-SUPER-015).
 *
 * The briefing CONTENT reuses existing data layers (no new data tables); the
 * only net-new persistence is the delivery layer:
 *
 *   - daily_briefing_preferences : per-user opt-out + frequency + A/B variant +
 *                                  channel toggles (email / in-app)
 *   - daily_briefing_log         : one row per generated briefing — role, date,
 *                                  variant, subject, channels, content, open
 *                                  tracking (subject line + open rate = the
 *                                  success metric)
 *
 * The in-app badge reuses the existing user_notifications table; email reuses the
 * existing email infrastructure. Re-exported from shared/schema.ts.
 *
 * TODO(rbac): no special permission — every authenticated user gets their own
 * role-appropriate briefing; the cron runs system-side per tenant.
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

/** Delivery cadence. */
export const BRIEFING_FREQUENCIES = ['daily', 'weekly', 'off'] as const;
export type BriefingFrequency = (typeof BRIEFING_FREQUENCIES)[number];

/** A/B content variant: lead with numbers vs lead with narrative. */
export const BRIEFING_VARIANTS = ['numbers', 'narrative'] as const;
export type BriefingVariant = (typeof BRIEFING_VARIANTS)[number];

/** Role flavor of the briefing. */
export const BRIEFING_ROLES = ['owner', 'service_manager', 'sales_rep'] as const;
export type BriefingRole = (typeof BRIEFING_ROLES)[number];

// ---------------------------------------------------------------------------
// daily_briefing_preferences — per-user opt-out / frequency / variant
// ---------------------------------------------------------------------------
export const dailyBriefingPreferences = pgTable(
  'daily_briefing_preferences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    userId: varchar('user_id').notNull(),
    /** daily | weekly | off. */
    frequency: varchar('frequency', { length: 12 }).notNull().default('daily'),
    /** Role flavor; null = derive from the user's role at send time. */
    role: varchar('role', { length: 24 }),
    emailEnabled: boolean('email_enabled').notNull().default(true),
    inAppEnabled: boolean('in_app_enabled').notNull().default(true),
    /** A/B content variant: numbers | narrative. */
    abVariant: varchar('ab_variant', { length: 12 }).notNull().default('numbers'),
    lastSentAt: timestamp('last_sent_at'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantUserUnique: uniqueIndex('daily_briefing_preferences_tenant_user_uq').on(
      table.tenantId,
      table.userId,
    ),
  }),
);

// ---------------------------------------------------------------------------
// daily_briefing_log — one row per generated briefing (A/B + open-rate metric)
// ---------------------------------------------------------------------------
export const dailyBriefingLog = pgTable(
  'daily_briefing_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    userId: varchar('user_id').notNull(),
    /** owner | service_manager | sales_rep. */
    role: varchar('role', { length: 24 }).notNull(),
    /** Tenant-local briefing date (YYYY-MM-DD). */
    briefingDate: varchar('briefing_date', { length: 10 }).notNull(),
    /** numbers | narrative (A/B variant used). */
    variant: varchar('variant', { length: 12 }).notNull().default('numbers'),
    subject: varchar('subject', { length: 300 }),
    /** Whether each channel was delivered. */
    emailSent: boolean('email_sent').notNull().default(false),
    inAppSent: boolean('in_app_sent').notNull().default(false),
    /** Rendered briefing: { sections[], bullets[], links[], wordCount, source }. */
    content: jsonb('content'),
    sentAt: timestamp('sent_at').notNull().defaultNow(),
    /** Open tracking (email pixel / in-app view) — success metric. */
    openedAt: timestamp('opened_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('daily_briefing_log_tenant_idx').on(table.tenantId),
    tenantUserDateIdx: index('daily_briefing_log_tenant_user_date_idx').on(
      table.tenantId,
      table.userId,
      table.briefingDate,
    ),
    tenantVariantIdx: index('daily_briefing_log_tenant_variant_idx').on(
      table.tenantId,
      table.variant,
    ),
  }),
);

export type DailyBriefingPreferences = typeof dailyBriefingPreferences.$inferSelect;
export type DailyBriefingLog = typeof dailyBriefingLog.$inferSelect;
export type NewDailyBriefingLog = typeof dailyBriefingLog.$inferInsert;
