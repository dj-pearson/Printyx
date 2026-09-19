/**
 * Suggested Tasks (COP-B03).
 *
 * One row per live signal, with the CONDITION as the dedupe key rather than the
 * moment it was detected. That choice is what makes the story's two hardest
 * criteria work at once: re-running the sweep collides instead of duplicating
 * (AC7), and a suggestion whose condition has cleared simply stops being
 * regenerated and is expired by set difference (AC4).
 *
 * Contrast with `radar_plays`, which DOES date-stamp its key: there, a lease
 * whose end date moves is a genuinely new opportunity. Here, a deal quiet for
 * 30 days and the same deal quiet for 45 are one unfinished task, and re-raising
 * it daily would be precisely the "stale suggestion" AC4 forbids, wearing a
 * fresh id.
 *
 * A DISMISSAL IS RECORDED AND STICKY (AC6). A dismissed suggestion is not
 * re-opened by the next sweep even though its signal is still live - the rep
 * has already said they know. It is the sweep's job to stop suggesting, not to
 * argue.
 */

import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core';

export const SUGGESTION_STATUSES = ['open', 'dismissed', 'done', 'expired'] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

export const suggestedTasks = pgTable(
  'suggested_tasks',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),

    suggestionType: varchar('suggestion_type', { length: 40 }).notNull(),
    /** type:recordId. Names the CONDITION - see the header. */
    dedupeKey: varchar('dedupe_key', { length: 200 }).notNull(),

    /** deal | quote | play | account. */
    recordType: varchar('record_type', { length: 20 }).notNull(),
    recordId: varchar('record_id').notNull(),

    reason: text('reason').notNull(),
    /** Imperative. "Call the contact", not "review this deal". */
    action: text('action').notNull(),
    score: integer('score').notNull().default(0),

    ownerId: varchar('owner_id'),
    customerId: varchar('customer_id'),
    companyName: varchar('company_name'),

    status: varchar('status', { length: 20 }).notNull().default('open'),
    dismissedReason: varchar('dismissed_reason'),
    resolvedBy: varchar('resolved_by'),
    resolvedAt: timestamp('resolved_at'),

    detectedAt: timestamp('detected_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    // AC7 is this constraint. Without it a nightly sweep multiplies every
    // suggestion by the number of nights it has run.
    dedupeUnique: unique('suggested_tasks_dedupe_uq').on(table.tenantId, table.dedupeKey),
    tenantStatusIdx: index('suggested_tasks_tenant_status_idx').on(table.tenantId, table.status),
    tenantOwnerIdx: index('suggested_tasks_tenant_owner_idx').on(table.tenantId, table.ownerId),
  }),
);

/** Per-tenant type toggles and thresholds (AC5). */
export const suggestedTaskSettings = pgTable('suggested_task_settings', {
  tenantId: varchar('tenant_id').primaryKey(),
  /** Days before expiry that a quote becomes a suggestion. */
  quoteExpiryWindowDays: integer('quote_expiry_window_days').notNull().default(14),
  /** Suggestion types switched off for this tenant. */
  disabledTypes: jsonb('disabled_types')
    .$type<string[]>()
    .default(sql`'[]'::jsonb`),
  /** AC5's kill switch, mirroring the radar's. */
  sweepEnabled: integer('sweep_enabled').notNull().default(1),
  updatedByUserId: varchar('updated_by_user_id'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type SuggestedTask = typeof suggestedTasks.$inferSelect;
export type NewSuggestedTask = typeof suggestedTasks.$inferInsert;
