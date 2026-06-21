/**
 * Tech Knowledge Graph — RAG over historical service tickets (US-SUPER-006).
 *
 * A field tech searches "E-225 on iR-ADV C5560" and gets the top historical
 * fixes for that symptom on that model. This proprietary failure-and-fix data
 * is Printyx's competitive moat.
 *
 *   - service_ticket_embeddings : sidecar embedding per closed ticket (avoids a
 *     risky column add on service_tickets) — content + jsonb embedding vector
 *   - service_knowledge_settings: per-tenant federation opt-in (v2, default off)
 *
 * The embedding is stored as a jsonb float array so cosine similarity works in
 * v1 without pgvector (offline-safe); the backfill migration ALSO enables the
 * pgvector extension and adds a real `vector(1536)` column + ivfflat index for
 * the production similarity path. Embeddings are produced via a named adapter
 * (OpenAI text-embedding-3-small) with a deterministic offline fallback.
 *
 * v1 is SINGLE-TENANT (every query scoped by tenant_id). The federated
 * cross-tenant pool (with PII redaction + explicit opt-in) is v2.
 *
 * Re-exported from shared/schema.ts.
 * TODO(rbac): requirePermission(['service.knowledge.search']) once it exists.
 */

import { index, jsonb, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

export const EMBEDDING_DIMS = 1536; // OpenAI text-embedding-3-small

// ---------------------------------------------------------------------------
// service_ticket_embeddings — one embedding row per closed ticket
// ---------------------------------------------------------------------------
export const serviceTicketEmbeddings = pgTable(
  'service_ticket_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** service_tickets.id. */
    ticketId: varchar('ticket_id').notNull(),
    /** Denormalized for filtering + display. */
    machineModel: varchar('machine_model'),
    /** Error codes mentioned on the ticket (space/comma-joined). */
    errorCodes: varchar('error_codes', { length: 500 }),
    /** The concatenated text that was embedded (resolution + parts + model + codes). */
    content: varchar('content', { length: 8000 }),
    /** SHA-256 of `content` — re-embed only when it changes. */
    contentHash: varchar('content_hash'),
    /** Float[] embedding (length EMBEDDING_DIMS). Mirrored to a pgvector column in prod. */
    embedding: jsonb('embedding'),
    /** 'openai' | 'fallback' (deterministic local hash embedding). */
    embeddingSource: varchar('embedding_source', { length: 16 }).notNull().default('fallback'),
    embeddedAt: timestamp('embedded_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('service_ticket_embeddings_tenant_idx').on(table.tenantId),
    tenantTicketUnique: uniqueIndex('service_ticket_embeddings_tenant_ticket_uq').on(
      table.tenantId,
      table.ticketId,
    ),
    tenantModelIdx: index('service_ticket_embeddings_tenant_model_idx').on(
      table.tenantId,
      table.machineModel,
    ),
  }),
);

// ---------------------------------------------------------------------------
// service_knowledge_settings — per-tenant federation opt-in (v2)
// ---------------------------------------------------------------------------
export const serviceKnowledgeSettings = pgTable('service_knowledge_settings', {
  tenantId: varchar('tenant_id').primaryKey(),
  /** Opt in to the federated cross-tenant pool (PII-redacted). Default OFF. */
  federatedOptIn: jsonb('federated_opt_in'), // { enabled: boolean, consentedAt, consentedByUserId }
  updatedByUserId: varchar('updated_by_user_id'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type ServiceTicketEmbedding = typeof serviceTicketEmbeddings.$inferSelect;
export type NewServiceTicketEmbedding = typeof serviceTicketEmbeddings.$inferInsert;
export type ServiceKnowledgeSettings = typeof serviceKnowledgeSettings.$inferSelect;
