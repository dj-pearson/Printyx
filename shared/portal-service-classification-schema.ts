/**
 * Portal NL Service-Request Classification Schema (US-SUPER-011).
 *
 * The customer self-service portal scaffolding already exists
 * (shared/customer-portal-schema.ts: customer_service_requests, status history,
 * notifications, satisfaction surveys). The net-new layer for "describe the
 * problem in plain English → dispatch the right tech with the right parts" is
 * the AI classification, persisted here:
 *
 *   - portal_service_classifications : one Claude classification per portal
 *     service request — category, suggested priority, recommended parts,
 *     suggested tech, matched playbook, confidence, and the internal
 *     service_ticket it produced.
 *
 * request_id stores the customer_service_requests.id (a uuid string); it is kept
 * as a plain varchar (no hard FK — the portal table's id is a uuid column) and
 * indexed, mirroring the import-light convention of the other US-SUPER schemas.
 *
 * Re-exported from shared/schema.ts.
 * Auth: the portal route uses requireAuth + tenant scoping + the request's
 * customer context (same primitives requireCustomerPortalAuth builds on).
 */

import {
  doublePrecision,
  index,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const portalServiceClassifications = pgTable(
  'portal_service_classifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** customer_service_requests.id (uuid string). */
    requestId: varchar('request_id').notNull(),
    /** The internal service_tickets.id created from this request, if any. */
    serviceTicketId: varchar('service_ticket_id'),
    /** The customer's free-text problem description that was classified. */
    rawText: varchar('raw_text', { length: 2000 }),
    /** Classified issue category, e.g. 'paper_jam' | 'print_quality' | 'mechanical_noise'. */
    category: varchar('category', { length: 80 }),
    /** Suggested ticket priority: low | medium | high | urgent. */
    suggestedPriority: varchar('suggested_priority', { length: 16 }),
    /** [{ partNumber, name, reason }] recommended parts to load. */
    recommendedParts: jsonb('recommended_parts'),
    /** Suggested technician id (best-effort match). */
    suggestedTechId: varchar('suggested_tech_id'),
    /** Matched service playbook { key, title, steps[] }. */
    playbook: jsonb('playbook'),
    /** 0..1 model confidence in the classification. */
    confidence: doublePrecision('confidence'),
    /** 'ai' | 'fallback' (deterministic keyword classifier when no model). */
    source: varchar('source', { length: 12 }).notNull().default('fallback'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('portal_service_classifications_tenant_idx').on(table.tenantId),
    tenantRequestIdx: index('portal_service_classifications_tenant_request_idx').on(
      table.tenantId,
      table.requestId,
    ),
  }),
);

export type PortalServiceClassification = typeof portalServiceClassifications.$inferSelect;
export type NewPortalServiceClassification = typeof portalServiceClassifications.$inferInsert;
