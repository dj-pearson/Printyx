/**
 * Installed-Base Opportunity Radar (COP-B04).
 *
 * Every lease expiry, contract end, meter overage and dead device in the
 * installed base is already a dated, quantified sales trigger sitting in the
 * database, and until now it drove no pipeline at all -
 * `equipment.lease_expires_date` was rendered in exactly one place, as a badge.
 *
 * A PLAY IS STORED, NOT COMPUTED ON READ, and that is the whole design. Three
 * of the story's criteria are impossible against a computed-on-read list:
 * dismissing a play has to stick (AC6), re-running the scan must not duplicate
 * (AC7), and play-to-deal conversion has to be reportable afterwards (AC6). All
 * three need a row.
 *
 * IDEMPOTENCY IS A UNIQUE INDEX, not a scan-time lookup. `dedupe_key` is
 * derived from the trigger itself - play type, the machine or contract it is
 * about, and the date it becomes live - so re-running the scan collides rather
 * than inserting. The same pattern workflow_executions uses (migration 0025).
 * A play whose underlying date MOVES gets a new key and a new play, which is
 * correct: a lease that was re-papered to expire a year later is a different
 * opportunity, not an update to the old one.
 */

import { sql } from 'drizzle-orm';
import {
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * The triggers the scan detects. Each is a dated, quantified fact about the
 * installed base - never a guess about intent.
 *
 * `service_burden` is named for what the data supports. AC2 asks for "machine
 * past a service-cost/margin threshold" and NO cost column exists on
 * service_tickets or anywhere else in the schema, so this counts CALLS over a
 * window rather than dollars. Calling it a cost threshold would be a number
 * with nothing behind it; the gap is reported on the response instead.
 */
export const RADAR_PLAY_TYPES = [
  'lease_expiring',
  'contract_ending',
  'volume_over_tier',
  'service_burden',
  'color_underused',
  'meters_not_reporting',
] as const;
export type RadarPlayType = (typeof RADAR_PLAY_TYPES)[number];

export const RADAR_PLAY_STATUSES = ['open', 'dismissed', 'converted'] as const;
export type RadarPlayStatus = (typeof RADAR_PLAY_STATUSES)[number];

export const radarPlays = pgTable(
  'radar_plays',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),

    playType: varchar('play_type', { length: 40 }).notNull(),
    /** Collides on a re-scan. See the header for why a moved date is a NEW play. */
    dedupeKey: varchar('dedupe_key', { length: 200 }).notNull(),

    /** The account, as a business_records id. */
    customerId: varchar('customer_id'),
    companyName: varchar('company_name'),
    /** The machines this play is about. Attached to the deal on conversion. */
    equipmentIds: jsonb('equipment_ids')
      .$type<string[]>()
      .default(sql`'[]'::jsonb`),
    /** The contract, when the trigger is one. */
    contractId: varchar('contract_id'),

    /** Plain language, shown to the rep verbatim. */
    reason: text('reason').notNull(),
    /** When the trigger becomes live - a lease end, a contract end, today. */
    triggerDate: timestamp('trigger_date'),
    /** Estimated annual value. NULL when it cannot be derived - never zero. */
    estimatedValue: decimal('estimated_value', { precision: 14, scale: 2 }),
    /** 0-100. Value and urgency combined; the inputs are on the row. */
    score: integer('score').notNull().default(0),
    /** What the score was built from, so a rep can disagree with it. */
    scoreFactors: jsonb('score_factors').$type<Record<string, unknown>>(),

    /** The rep who owns the account, for scoping. */
    ownerId: varchar('owner_id'),

    status: varchar('status', { length: 20 }).notNull().default('open'),
    /** AC6: the outcome, so play-to-deal and play-to-won are reportable. */
    dealId: varchar('deal_id'),
    dismissedReason: varchar('dismissed_reason'),
    resolvedBy: varchar('resolved_by'),
    resolvedAt: timestamp('resolved_at'),

    detectedAt: timestamp('detected_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    // AC7. The scan inserts with ignoreDuplicates and this is what makes that
    // safe; without it a nightly scan multiplies every play by the number of
    // nights it has run.
    dedupeUnique: unique('radar_plays_dedupe_uq').on(table.tenantId, table.dedupeKey),
    tenantStatusIdx: index('radar_plays_tenant_status_idx').on(table.tenantId, table.status),
    tenantOwnerIdx: index('radar_plays_tenant_owner_idx').on(table.tenantId, table.ownerId),
  }),
);

/**
 * Per-tenant windows and thresholds (AC5).
 *
 * Defaults are the copier-industry norms the story names, not numbers picked to
 * make a demo look busy: a lease conversation starts ~4 months out, and a
 * volume overage matters at 15% because below that it is noise in the meter.
 */
export const radarSettings = pgTable('radar_settings', {
  tenantId: varchar('tenant_id').primaryKey(),

  /** Days ahead to look for an expiring lease. */
  leaseWindowDays: integer('lease_window_days').notNull().default(120),
  /** Days ahead to look for an ending service contract. */
  contractWindowDays: integer('contract_window_days').notNull().default(90),
  /** Volume over the contracted tier, as a percentage, before it is a play. */
  volumeOveragePct: integer('volume_overage_pct').notNull().default(15),
  /** Service calls on one machine within the lookback before it is a play. */
  serviceCallThreshold: integer('service_call_threshold').notNull().default(4),
  serviceLookbackDays: integer('service_lookback_days').notNull().default(180),
  /** Colour share below this on a colour-capable device is underuse. */
  colorUnderusePct: integer('color_underuse_pct').notNull().default(5),
  /** Days without a meter reading before a device counts as not reporting. */
  meterSilenceDays: integer('meter_silence_days').notNull().default(90),

  /** AC5: the scan honours this the way the workflow kill switch works. */
  scanEnabled: integer('scan_enabled').notNull().default(1),

  updatedByUserId: varchar('updated_by_user_id'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type RadarPlay = typeof radarPlays.$inferSelect;
export type NewRadarPlay = typeof radarPlays.$inferInsert;
export type RadarSettings = typeof radarSettings.$inferSelect;
