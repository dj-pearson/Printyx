/**
 * Quarterly Business Review (QBR) Decks Schema (US-SUPER-004).
 *
 * Overnight-generated per-customer QBR decks (usage trends, downtime, savings,
 * upgrade pitch) so a rep can run quarterly reviews without building slides.
 *
 *   - qbr_reports      : one generated deck per (customer, quarter)
 *   - qbr_suppressions : customers who don't want QBRs
 *
 * The generator assembles real fleet/usage/service data into content_jsonb,
 * adds Claude-generated recommendations (deterministic fallback when no key),
 * renders HTML + PDF server-side, and uploads via the project storage
 * abstraction. The rep reviews/edits section overrides before sending.
 *
 * Cross-table FKs (business_records) are enforced in the backfill migration
 * only (mirrors the churn/renewal exemplars). Re-exported from shared/schema.ts.
 *
 * TODO(rbac): gate routes with requirePermission(['sales.qbr.manage']) once that
 * permission exists; until then requireAuth + tenant scoping.
 */

import { index, jsonb, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

/** Deck lifecycle. */
export const QBR_STATUSES = ['draft', 'reviewed', 'sent'] as const;
export type QbrStatus = (typeof QBR_STATUSES)[number];

// ---------------------------------------------------------------------------
// qbr_reports — one deck per (customer, quarter)
// ---------------------------------------------------------------------------
export const qbrReports = pgTable(
  'qbr_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    customerId: varchar('customer_id').notNull(),
    /** e.g. "2026-Q2". */
    quarter: varchar('quarter', { length: 12 }).notNull(),
    /** draft | reviewed | sent. */
    status: varchar('status', { length: 16 }).notNull().default('draft'),
    /**
     * Assembled deck: {
     *   cover, fleet[], usageTrend[], downtimeByMachine[], topIssues[],
     *   supplyCost, recommendations[], forecast, sectionOverrides{}
     * }
     */
    content: jsonb('content'),
    /** Rendered artifacts (project storage abstraction URLs). */
    pdfUrl: varchar('pdf_url'),
    htmlUrl: varchar('html_url'),
    generatedAt: timestamp('generated_at').notNull().defaultNow(),
    sentAt: timestamp('sent_at'),
    sentByUserId: varchar('sent_by_user_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('qbr_reports_tenant_idx').on(table.tenantId),
    tenantCustomerIdx: index('qbr_reports_tenant_customer_idx').on(
      table.tenantId,
      table.customerId,
    ),
    tenantCustomerQuarterUnique: uniqueIndex('qbr_reports_tenant_customer_quarter_uq').on(
      table.tenantId,
      table.customerId,
      table.quarter,
    ),
  }),
);

// ---------------------------------------------------------------------------
// qbr_suppressions — customers who don't want QBRs
// ---------------------------------------------------------------------------
export const qbrSuppressions = pgTable(
  'qbr_suppressions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    customerId: varchar('customer_id').notNull(),
    reason: varchar('reason'),
    createdByUserId: varchar('created_by_user_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantCustomerUnique: uniqueIndex('qbr_suppressions_tenant_customer_uq').on(
      table.tenantId,
      table.customerId,
    ),
  }),
);

export type QbrReport = typeof qbrReports.$inferSelect;
export type NewQbrReport = typeof qbrReports.$inferInsert;
export type QbrSuppression = typeof qbrSuppressions.$inferSelect;
