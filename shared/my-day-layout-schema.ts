/**
 * Per-user My Day card layout (COP-B01 AC2).
 *
 * ITS OWN TABLE, DELIBERATELY, rather than a third tenant in `dashboard_layouts`.
 * That table is already contested: `dashboard-widgets`' /user-layout and
 * `dashboard/handlers/layouts` both claim "the one custom layout per user" and
 * both read `(tenant_id, user_id, is_user_custom)` with NO name or surface
 * filter - so a layout saved on one surface can already be returned to the
 * other, whichever row sorts first. Adding a third writer to that would have
 * made an existing collision worse and blamed it on this story. The pre-existing
 * defect is recorded in COP-B01's notes; this table simply does not join it.
 *
 * One row per user per tenant, enforced by the unique index rather than by an
 * update-then-insert that races.
 */

import { sql } from 'drizzle-orm';
import { jsonb, pgTable, timestamp, unique, varchar } from 'drizzle-orm/pg-core';

export const myDayLayouts = pgTable(
  'my_day_layouts',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    userId: varchar('user_id').notNull(),
    /** MyDayCardPref[]: {id, order, hidden?}. Hidden cards are KEPT. */
    cards: jsonb('cards')
      .notNull()
      .default(sql`'[]'::jsonb`),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    userUnique: unique('my_day_layouts_tenant_user_uq').on(table.tenantId, table.userId),
  }),
);

export type MyDayLayoutRow = typeof myDayLayouts.$inferSelect;
