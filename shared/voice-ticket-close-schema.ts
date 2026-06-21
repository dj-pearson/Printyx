/**
 * Voice-First Field Tech Ticket Close Schema (US-SUPER-005).
 *
 * A field tech speaks on their phone (actions, parts, labor); the system
 * transcribes (Whisper), Claude extracts structured fields, the tech reviews/
 * edits, and on confirm the ticket closes — parts deducted from truck inventory
 * (transactional), invoice line items drafted (pending_approval), labor logged.
 *
 *   - voice_ticket_closes : one draft per voice close attempt (transcript +
 *     extracted fields + SKU resolutions + drafted invoice items + status)
 *
 * Whisper transcription + Claude extraction sit behind named adapter stubs with
 * deterministic offline fallbacks. Audio is purged 30 days after close
 * (audio_purge_at); the transcript is retained on the ticket as a voice note.
 * Offline support (IndexedDB queue + sync/retry/dedupe) lives in the frontend.
 *
 * Builds on shared/mobile-service-schema.ts + truck inventory (US-SUPER-007).
 * Re-exported from shared/schema.ts.
 * TODO(rbac): requirePermission(['service.ticket.close']) once it exists.
 */

import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/** Close lifecycle. */
export const VOICE_CLOSE_STATUSES = ['draft', 'confirmed', 'discarded'] as const;
export type VoiceCloseStatus = (typeof VOICE_CLOSE_STATUSES)[number];

export const voiceTicketCloses = pgTable(
  'voice_ticket_closes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** service_tickets.id being closed. */
    ticketId: varchar('ticket_id').notNull(),
    techUserId: varchar('tech_user_id'),
    /** Client-supplied idempotency key (IndexedDB queue dedupe across retries). */
    clientDedupeKey: varchar('client_dedupe_key'),
    /** Audio storage URL (purged after audio_purge_at). */
    audioUrl: varchar('audio_url'),
    /** Whisper transcript (retained on the ticket as tech_voice_note). */
    transcript: varchar('transcript', { length: 8000 }),
    transcriptSource: varchar('transcript_source', { length: 16 }).notNull().default('fallback'),
    /**
     * Claude-extracted structured fields:
     *   { actions_taken, parts_used:[{raw, sku, name, quantity, resolved}],
     *     labor_minutes, follow_up_needed, customer_signature_collected,
     *     customer_satisfaction_note }
     */
    extracted: jsonb('extracted'),
    extractionSource: varchar('extraction_source', { length: 16 }).notNull().default('fallback'),
    /** Per-part SKU resolution: [{ raw, candidates:[{sku,name,score}], chosenSku }]. */
    skuResolutions: jsonb('sku_resolutions'),
    /** Drafted invoice line items (status pending_approval). */
    draftInvoiceItems: jsonb('draft_invoice_items'),
    laborMinutes: integer('labor_minutes'),
    followUpNeeded: boolean('follow_up_needed').notNull().default(false),
    /** draft | confirmed | discarded. */
    status: varchar('status', { length: 12 }).notNull().default('draft'),
    /** Audio retention cutoff (created_at + 30d). */
    audioPurgeAt: timestamp('audio_purge_at'),
    confirmedAt: timestamp('confirmed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('voice_ticket_closes_tenant_idx').on(table.tenantId),
    tenantTicketIdx: index('voice_ticket_closes_tenant_ticket_idx').on(
      table.tenantId,
      table.ticketId,
    ),
    tenantStatusIdx: index('voice_ticket_closes_tenant_status_idx').on(
      table.tenantId,
      table.status,
    ),
    purgeIdx: index('voice_ticket_closes_purge_idx').on(table.audioPurgeAt),
  }),
);

export type VoiceTicketClose = typeof voiceTicketCloses.$inferSelect;
export type NewVoiceTicketClose = typeof voiceTicketCloses.$inferInsert;
