/**
 * Customer Churn-Risk Scoring Schema (US-SUPER-009).
 *
 * Persists the weekly churn-risk agent's per-customer scores plus the per-tenant
 * scoring config (signal weights + band thresholds + Monday digest toggle).
 *
 * Scoring inputs (computed from existing data in routes-churn-risk.ts):
 *   - ticket_delta     : 90-day service-ticket count vs the 12-month monthly baseline
 *   - ar_past_due      : days-past-due on open AR (invoices.balance_due / due_date)
 *   - meter_trend      : 3-month rolling avg vs 12-month avg (meter_readings)
 *   - email_sentiment  : inbound email sentiment (STUB — omitted until email sync lands; see route TODO)
 *   - renewal_proximity: contract days-to-renewal (contracts.end_date)
 *
 * The /customers/risk page (OWNER-oriented) lists at-risk customers sorted by
 * contract value × score with reason chips, a 52-week sparkline, save-plan
 * drafting, and the settings panel + Monday digest preview.
 *
 * Cross-table FKs (business_records, contracts, invoices, service_tickets,
 * meter_readings) are enforced in the backfill migration only, mirroring the
 * predictive-failure + blog conventions, to keep this file import-light and
 * migration-safe.
 *
 * Re-exported from shared/schema.ts.
 */

import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/** Risk bands derived from the score via the per-tenant thresholds. */
export const CHURN_RISK_BANDS = ['healthy', 'watch', 'at_risk'] as const;
export type ChurnRiskBand = (typeof CHURN_RISK_BANDS)[number];

// ---------------------------------------------------------------------------
// customer_churn_scores — one score row per (customer, run)
// ---------------------------------------------------------------------------
export const customerChurnScores = pgTable(
  'customer_churn_scores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** Customer / business_records id (FK enforced in migration). */
    customerId: varchar('customer_id').notNull(),
    /** Blended 0..100 churn-risk score. */
    score: doublePrecision('score').notNull().default(0),
    /** healthy | watch | at_risk (derived from thresholds at scoring time). */
    band: varchar('band', { length: 20 }).notNull().default('healthy'),
    /**
     * Per-input contribution, e.g.:
     *   { ticket_delta: {value, weight, detail}, ar_past_due: {...},
     *     meter_trend: {...}, renewal_proximity: {...}, reasons: [...] }
     */
    signals: jsonb('signals'),
    /** Denormalized annual contract value used for the value × score sort. */
    contractValue: doublePrecision('contract_value').default(0),
    calculatedAt: timestamp('calculated_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('customer_churn_scores_tenant_idx').on(table.tenantId),
    tenantCustomerIdx: index('customer_churn_scores_tenant_customer_idx').on(
      table.tenantId,
      table.customerId,
    ),
    tenantBandIdx: index('customer_churn_scores_tenant_band_idx').on(table.tenantId, table.band),
  }),
);

// ---------------------------------------------------------------------------
// churn_risk_settings — per-tenant weights, thresholds, digest toggle
// ---------------------------------------------------------------------------
export const churnRiskSettings = pgTable('churn_risk_settings', {
  tenantId: varchar('tenant_id').primaryKey(),
  /**
   * Per-signal weights (sum need not be 1.0 — normalized at scoring time):
   *   { ticket_delta, ar_past_due, meter_trend, renewal_proximity, email_sentiment }
   */
  weights: jsonb('weights'),
  /** score >= watch_threshold && < at_risk_threshold => 'watch'. */
  watchThreshold: integer('watch_threshold').notNull().default(31),
  /** score >= at_risk_threshold => 'at_risk'. */
  atRiskThreshold: integer('at_risk_threshold').notNull().default(61),
  /** Whether the Monday 7am OWNER digest is assembled/sent for this tenant. */
  digestEnabled: boolean('digest_enabled').notNull().default(true),
  updatedByUserId: varchar('updated_by_user_id'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type CustomerChurnScore = typeof customerChurnScores.$inferSelect;
export type NewCustomerChurnScore = typeof customerChurnScores.$inferInsert;
export type ChurnRiskSettings = typeof churnRiskSettings.$inferSelect;
