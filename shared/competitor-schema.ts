/**
 * Competitive knockout intelligence (COP-B10).
 *
 * The data was already being captured and surfaced in no selling motion at all:
 * `business_records.competitor_name`, `business_records.main_competitors` and
 * `business_records.deactivation_reason` ('competitor_switch'), plus COP-M04's
 * `deals.incumbent_vendor`. Four free-text columns on two tables, with nothing
 * tying them together.
 *
 * ONE TABLE IS THE VOCABULARY AND THE CONTENT. `competitor_battlecards` holds
 * the canonical competitor - its name, the spellings people actually type, and
 * what a rep needs to know when they meet it. Making the battlecard the
 * vocabulary rather than adding a separate `competitors` lookup is deliberate:
 * a second table would need its own admin screen, and a competitor with no
 * battlecard is a competitor nobody has written anything about, which is
 * exactly what an empty battlecard row already says.
 *
 * WHY NOT NORMALIZE THE EXISTING COLUMNS INTO AN FK. Those four columns hold
 * years of what reps typed. Rewriting them to ids would need a migration that
 * decides, unreviewed, that 'Xerox Corp' and 'xerox' and 'XEROX' are the same
 * company - and would destroy the original text if it decided wrong. Instead
 * the columns stay as they are and `slug` is matched against them at read time
 * through one shared normalizer (supabase/functions/_shared/competitor.ts), so
 * AC5's "one vocabulary" is a resolution rule rather than a destructive write.
 * An unrecognized spelling shows up as an unmatched competitor the admin can
 * claim with an alias, which is a smaller and more honest failure than a
 * silently mis-merged account.
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core';

/** One entry of the objection handling list. */
export interface CompetitorObjection {
  objection: string;
  response: string;
}

export const competitorBattlecards = pgTable(
  'competitor_battlecards',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),

    /** Display name, as the dealer writes it: 'Xerox', 'Konica Minolta'. */
    name: varchar('name', { length: 120 }).notNull(),
    /**
     * Normalized match key, from normalizeCompetitorKey(). Unique per tenant,
     * so two admins cannot create 'Xerox' and 'XEROX Corp.' as rival records.
     */
    slug: varchar('slug', { length: 120 }).notNull(),
    /**
     * Other spellings that resolve here, normalized the same way. This is how a
     * rep's free text reaches the right battlecard without anybody editing the
     * rep's text.
     */
    aliases: jsonb('aliases')
      .$type<string[]>()
      .default(sql`'[]'::jsonb`),

    /** How we position against them. Plain prose, shown to the rep verbatim. */
    positioning: text('positioning'),
    /** [{ objection, response }] - what they say, and what to say back. */
    commonObjections: jsonb('common_objections').$type<CompetitorObjection[]>(),
    /** Where we win, and where we do not. The second half is the useful one. */
    whereWeWin: text('where_we_win'),
    whereWeLose: text('where_we_lose'),

    isActive: boolean('is_active').notNull().default(true),

    createdBy: varchar('created_by'),
    updatedBy: varchar('updated_by'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantSlugUnique: unique('competitor_battlecards_tenant_slug_uq').on(
      table.tenantId,
      table.slug,
    ),
    tenantActiveIdx: index('competitor_battlecards_tenant_active_idx').on(
      table.tenantId,
      table.isActive,
    ),
  }),
);

export type CompetitorBattlecard = typeof competitorBattlecards.$inferSelect;
export type NewCompetitorBattlecard = typeof competitorBattlecards.$inferInsert;
