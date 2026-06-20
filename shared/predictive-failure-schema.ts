/**
 * Predictive Failure Dispatch Schema (US-SUPER-001).
 *
 * Persists the predictive-failure agent's per-machine risk predictions plus the
 * per-tenant agent settings (kill switch + confidence threshold). Predictions
 * above the tenant threshold auto-create draft service tickets in pending_review
 * status, linked back via prediction_id; the /service/predictions page drives the
 * approve-and-dispatch / snooze / dismiss workflow and exposes precision/recall.
 *
 * Builds on the existing equipment + enhanced-service + intelligent-alerts data.
 * Cross-table FKs (machines, service_tickets) are enforced in the backfill
 * migration only, mirroring the blog-module convention, to keep this file
 * import-light and migration-safe.
 *
 * Re-exported from shared/schema.ts.
 */

import {
  boolean,
  doublePrecision,
  index,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/** Lifecycle of a prediction. */
export const FAILURE_PREDICTION_STATUSES = [
  'pending',
  'approved',
  'dismissed',
  'snoozed',
  'expired',
] as const;
export type FailurePredictionStatus = (typeof FAILURE_PREDICTION_STATUSES)[number];

// ---------------------------------------------------------------------------
// equipment_failure_predictions — one risk prediction per (machine, run)
// ---------------------------------------------------------------------------
export const equipmentFailurePredictions = pgTable(
  'equipment_failure_predictions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** Machine/equipment id (FK enforced in migration). */
    machineId: varchar('machine_id').notNull(),
    predictedWindowStart: timestamp('predicted_window_start'),
    predictedWindowEnd: timestamp('predicted_window_end'),
    /** 0..1 model confidence. */
    confidence: doublePrecision('confidence').notNull().default(0),
    /**
     * Per-signal contributions, e.g.:
     *   { meter_accel: {value, weight}, error_freq: {...}, days_since_service: {...},
     *     model_age: {...}, toner_anomaly: {...}, suggested_parts: [...] }
     */
    signals: jsonb('signals'),
    /** Denormalized contract value used for the confidence × value sort. */
    contractValue: doublePrecision('contract_value').default(0),
    /** Draft service ticket created on prediction (FK enforced in migration). */
    serviceTicketId: varchar('service_ticket_id'),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    /** Set when a closed ticket within 30d confirms the same root cause (precision/recall). */
    outcome: varchar('outcome', { length: 20 }), // true_positive | false_positive | null
    snoozedUntil: timestamp('snoozed_until'),
    reviewedByUserId: varchar('reviewed_by_user_id'),
    reviewedAt: timestamp('reviewed_at'),
    generatedAt: timestamp('generated_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('equipment_failure_predictions_tenant_idx').on(table.tenantId),
    tenantStatusIdx: index('equipment_failure_predictions_tenant_status_idx').on(
      table.tenantId,
      table.status,
    ),
    tenantMachineIdx: index('equipment_failure_predictions_tenant_machine_idx').on(
      table.tenantId,
      table.machineId,
    ),
  }),
);

// ---------------------------------------------------------------------------
// predictive_dispatch_settings — per-tenant kill switch + threshold
// ---------------------------------------------------------------------------
export const predictiveDispatchSettings = pgTable('predictive_dispatch_settings', {
  tenantId: varchar('tenant_id').primaryKey(),
  /** Kill switch — when paused, the daily agent skips and logs the skip. */
  agentEnabled: boolean('agent_enabled').notNull().default(true),
  /** Auto-create draft tickets for predictions at/above this confidence (0..1). */
  confidenceThreshold: doublePrecision('confidence_threshold').notNull().default(0.7),
  pausedAt: timestamp('paused_at'),
  pausedReason: varchar('paused_reason', { length: 500 }),
  updatedByUserId: varchar('updated_by_user_id'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type EquipmentFailurePrediction = typeof equipmentFailurePredictions.$inferSelect;
export type NewEquipmentFailurePrediction = typeof equipmentFailurePredictions.$inferInsert;
export type PredictiveDispatchSettings = typeof predictiveDispatchSettings.$inferSelect;
