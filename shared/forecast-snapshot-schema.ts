/**
 * Forecast commit-vs-actual history (COP-I06, AC4).
 *
 * "Forecast accuracy" is a claim, and a claim needs evidence from before the
 * outcome was known. That is the whole point of this table: it records what was
 * committed FOR a period, AT a moment, so the comparison against what actually
 * closed is a measurement rather than a story told afterwards.
 *
 * ONE ROW PER (tenant, period, owner, captured_at). Not per period: a manager
 * who commits $400k at the start of the month and $250k a week before it closes
 * has said two different things, and both are worth keeping - the shape of that
 * revision over a period IS the accuracy signal. `owner_id` is NULL for a
 * tenant-wide snapshot, so a roll-up and a per-rep capture coexist without
 * reading each other's numbers.
 *
 * VALUES ARE STORED, NOT RECOMPUTED. A snapshot re-derived from today's deals
 * would move every time a deal is edited, which is exactly the thing it exists
 * to prevent. Nothing in this table is a foreign key into `deals` for the same
 * reason: a deal deleted after the fact must not change what was committed.
 */

import { sql } from 'drizzle-orm';
import { decimal, index, integer, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';

export const forecastSnapshots = pgTable(
  'forecast_snapshots',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),

    /** The period being forecast. Calendar dates, compared as day boundaries. */
    periodStart: timestamp('period_start').notNull(),
    periodEnd: timestamp('period_end').notNull(),
    /** NULL for a tenant-wide snapshot; a user id for a per-rep one. */
    ownerId: varchar('owner_id'),

    /** One-time (equipment) revenue by category, as committed at capture time. */
    commitOneTimeValue: decimal('commit_one_time_value', { precision: 14, scale: 2 }),
    bestCaseOneTimeValue: decimal('best_case_one_time_value', { precision: 14, scale: 2 }),
    pipelineOneTimeValue: decimal('pipeline_one_time_value', { precision: 14, scale: 2 }),
    /** Recurring CPC/service, PER MONTH. Never summed with the one-time figures. */
    commitRecurringMonthlyValue: decimal('commit_recurring_monthly_value', {
      precision: 14,
      scale: 2,
    }),

    /** How many deals the snapshot covered, so a thin period is visible as thin. */
    dealCount: integer('deal_count'),
    /** Deals carrying no forecast category when the snapshot was taken. */
    uncategorizedCount: integer('uncategorized_count'),

    capturedBy: varchar('captured_by'),
    capturedAt: timestamp('captured_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantPeriodIdx: index('forecast_snapshots_tenant_period_idx').on(
      table.tenantId,
      table.periodStart,
    ),
    tenantOwnerIdx: index('forecast_snapshots_tenant_owner_idx').on(table.tenantId, table.ownerId),
  }),
);

export type ForecastSnapshot = typeof forecastSnapshots.$inferSelect;
export type NewForecastSnapshot = typeof forecastSnapshots.$inferInsert;
