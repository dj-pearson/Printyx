/**
 * Renewal Auto-Quote Schema (US-SUPER-010).
 *
 * A daily generator finds active contracts ending in ~90 days, computes the
 * customer's trailing-12-month print actuals, re-tiers CPC from cpc_rates with a
 * growth buffer, and drafts a renewal quote the rep can review and send. We
 * NEVER auto-send — the rep keeps the approval gate.
 *
 *   - renewal_auto_quotes        : one draft per (contract, generation run)
 *   - renewal_autoquote_settings : per-tenant window / growth buffer / toggle
 *   - renewal_suppressions       : customers flagged "manual renewal only"
 *
 * Re-tier source is cpc_rates (volume-banded CPC; min_volume/max_volume + cpc +
 * color_mode) rather than product_pricing, which has no volume tiers. Per-machine
 * usage comes from meter_readings joined through equipment.
 *
 * Win-rate tracking: each draft carries an outcome (pending|won|lost); the stats
 * endpoint compares auto-generated renewal win rate against a manual baseline.
 *
 * Cross-table FKs (contracts, business_records) are enforced in the backfill
 * migration only, keeping this file import-light (mirrors the churn/predictive
 * exemplars). Re-exported from shared/schema.ts.
 *
 * TODO(rbac): gate routes with requirePermission(['sales.renewal.manage']) once
 * that permission exists; until then requireAuth + tenant scoping.
 */

import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/** Draft lifecycle. */
export const RENEWAL_QUOTE_STATUSES = ['renewal_draft', 'sent', 'dismissed'] as const;
export type RenewalQuoteStatus = (typeof RENEWAL_QUOTE_STATUSES)[number];

/** Win-rate outcome. */
export const RENEWAL_OUTCOMES = ['pending', 'won', 'lost'] as const;
export type RenewalOutcome = (typeof RENEWAL_OUTCOMES)[number];

// ---------------------------------------------------------------------------
// renewal_auto_quotes
// ---------------------------------------------------------------------------
export const renewalAutoQuotes = pgTable(
  'renewal_auto_quotes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** The expiring contract this renewal is for (FK in migration). */
    contractId: varchar('contract_id').notNull(),
    /** Same as contractId per the story's "parent_contract_id set" requirement. */
    parentContractId: varchar('parent_contract_id'),
    customerId: varchar('customer_id').notNull(),
    /** renewal_draft | sent | dismissed. */
    status: varchar('status', { length: 24 }).notNull().default('renewal_draft'),
    assignedSalesRep: varchar('assigned_sales_rep'),
    contractEndDate: timestamp('contract_end_date'),
    /** Quote validity (generated_at + settings.expiration_days). */
    expirationDate: timestamp('expiration_date'),

    // --- 12-month actuals -------------------------------------------------
    totalBlackPages: integer('total_black_pages').notNull().default(0),
    totalColorPages: integer('total_color_pages').notNull().default(0),
    monthlyAvgBlack: doublePrecision('monthly_avg_black').notNull().default(0),
    monthlyAvgColor: doublePrecision('monthly_avg_color').notNull().default(0),
    peakMonth: varchar('peak_month'),
    peakVolume: integer('peak_volume').notNull().default(0),
    /** Per-machine breakdown: [{ equipmentId, serial, model, black, color }]. */
    machineBreakdown: jsonb('machine_breakdown'),

    // --- Re-tier ----------------------------------------------------------
    currentBlackRate: doublePrecision('current_black_rate'),
    currentColorRate: doublePrecision('current_color_rate'),
    currentMonthlyBase: doublePrecision('current_monthly_base'),
    recommendedBlackRate: doublePrecision('recommended_black_rate'),
    recommendedColorRate: doublePrecision('recommended_color_rate'),
    recommendedMonthlyBase: doublePrecision('recommended_monthly_base'),
    currentMonthlyRevenue: doublePrecision('current_monthly_revenue').notNull().default(0),
    recommendedMonthlyRevenue: doublePrecision('recommended_monthly_revenue').notNull().default(0),
    /** True when actual usage materially exceeds what the current tier covers. */
    isUnderage: boolean('is_underage').notNull().default(false),
    /** { buffer, blackTier, colorTier, notes } explaining the recommendation. */
    retierDetail: jsonb('retier_detail'),

    /** Prefilled renewal line items (base + per-CPC lines). */
    lineItems: jsonb('line_items'),
    /** Annualized recommended contract value. */
    quoteValue: doublePrecision('quote_value').notNull().default(0),

    // --- Outcome (win-rate tracking) -------------------------------------
    outcome: varchar('outcome', { length: 12 }).notNull().default('pending'),
    outcomeAt: timestamp('outcome_at'),
    outcomeNote: varchar('outcome_note'),

    generatedAt: timestamp('generated_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('renewal_auto_quotes_tenant_idx').on(table.tenantId),
    tenantStatusIdx: index('renewal_auto_quotes_tenant_status_idx').on(
      table.tenantId,
      table.status,
    ),
    tenantContractIdx: index('renewal_auto_quotes_tenant_contract_idx').on(
      table.tenantId,
      table.contractId,
    ),
  }),
);

// ---------------------------------------------------------------------------
// renewal_autoquote_settings
// ---------------------------------------------------------------------------
export const renewalAutoquoteSettings = pgTable('renewal_autoquote_settings', {
  tenantId: varchar('tenant_id').primaryKey(),
  /** Window (days to contract end) the generator scans, inclusive. */
  daysWindowStart: integer('days_window_start').notNull().default(90),
  daysWindowEnd: integer('days_window_end').notNull().default(100),
  /** Growth buffer added to actual usage before re-tiering (percent). */
  growthBufferPct: integer('growth_buffer_pct').notNull().default(10),
  /** Underage flagged when recommended revenue exceeds current by this % (>=). */
  underageThresholdPct: integer('underage_threshold_pct').notNull().default(10),
  /** Renewal quote validity, days from generation. */
  expirationDays: integer('expiration_days').notNull().default(30),
  /** Whether the daily generator runs for this tenant. */
  autoGenerateEnabled: boolean('auto_generate_enabled').notNull().default(true),
  updatedByUserId: varchar('updated_by_user_id'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// renewal_suppressions — customers flagged "manual renewal only"
// ---------------------------------------------------------------------------
export const renewalSuppressions = pgTable(
  'renewal_suppressions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    customerId: varchar('customer_id').notNull(),
    reason: varchar('reason'),
    createdByUserId: varchar('created_by_user_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantCustomerUnique: uniqueIndex('renewal_suppressions_tenant_customer_uq').on(
      table.tenantId,
      table.customerId,
    ),
  }),
);

export type RenewalAutoQuote = typeof renewalAutoQuotes.$inferSelect;
export type NewRenewalAutoQuote = typeof renewalAutoQuotes.$inferInsert;
export type RenewalAutoquoteSettings = typeof renewalAutoquoteSettings.$inferSelect;
export type RenewalSuppression = typeof renewalSuppressions.$inferSelect;
