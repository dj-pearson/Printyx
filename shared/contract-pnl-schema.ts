/**
 * Contract P&L X-ray Schema (US-SUPER-003).
 *
 * Real-time per-contract margin so a dealer owner can see which service
 * contracts are profitable, which are bleeding, and where to focus renewal
 * negotiation.
 *
 * The heavy lifting is two Postgres MATERIALIZED VIEWS created in the backfill
 * migration (drizzle/migrations/_backfill_contract_pnl.sql), refreshed nightly
 * by the refresh-contract-pnl cron and on-demand (rate-limited) from the page:
 *
 *   - contract_pnl_v          : one row per contract — trailing-12-month raw
 *                               aggregates (copies revenue, base revenue, labor
 *                               hours, parts count, supplies cost).
 *   - contract_pnl_monthly_v  : one row per (contract, month) for the last 12
 *                               months — same raw aggregates per month, powering
 *                               the trend sparkline + per-contract stacked bar.
 *
 * The views store RAW aggregates only; the dollar cost of labor (hours ×
 * burdened rate), parts (count × avg part cost) and financing (monthly_base ×
 * financing rate) is applied at READ time in server/routes-contract-pnl.ts from
 * the per-tenant config below, so changing rates never requires a view refresh.
 *
 * Only the settings table is a real Drizzle table; the materialized views are
 * queried via raw SQL (mirroring the churn-risk DISTINCT ON pattern) and live
 * only in the migration to keep this file import-light and migration-safe.
 *
 * Re-exported from shared/schema.ts.
 *
 * TODO(rbac): gate the routes with requirePermission(['finance.contract.view_pnl'])
 * once that permission string is added to the RBAC matrix (default-granted to
 * OWNER + PLATFORM_ADMIN per the story). Until then the routes use
 * requireAuth + tenant scoping, mirroring the predictive-failure/churn exemplars.
 */

import {
  boolean,
  decimal,
  doublePrecision,
  integer,
  pgTable,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// contract_pnl_settings — per-tenant cost rates, alert threshold, digest toggle
// ---------------------------------------------------------------------------
export const contractPnlSettings = pgTable('contract_pnl_settings', {
  tenantId: varchar('tenant_id').primaryKey(),
  /** Fully-burdened technician cost per labor hour (labor cost = hours × this). */
  techBurdenedRate: decimal('tech_burdened_rate', { precision: 10, scale: 2 })
    .notNull()
    .default('75.00'),
  /** Average cost per part used (parts cost = parts_used count × this). STUB:
   *  service_tickets.parts_used is a name array with no per-part cost; refine
   *  when a parts-catalog cost join is available. */
  avgPartCost: decimal('avg_part_cost', { precision: 10, scale: 2 }).notNull().default('45.00'),
  /** Financing fee as a fraction of monthly_base (financing cost = base × this).
   *  STUB: contracts has no explicit financing column; defaults to 0. */
  financingRate: doublePrecision('financing_rate').notNull().default(0),
  /** Contracts whose GP% drops below this trigger the weekly OWNER digest. */
  gpAlertThreshold: integer('gp_alert_threshold').notNull().default(20),
  /** Whether the weekly below-threshold digest is assembled/sent for this tenant. */
  digestEnabled: boolean('digest_enabled').notNull().default(true),
  /** Last on-demand/cron refresh (used for the per-tenant refresh cooldown). */
  lastRefreshedAt: timestamp('last_refreshed_at'),
  updatedByUserId: varchar('updated_by_user_id'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type ContractPnlSettings = typeof contractPnlSettings.$inferSelect;
export type NewContractPnlSettings = typeof contractPnlSettings.$inferInsert;
