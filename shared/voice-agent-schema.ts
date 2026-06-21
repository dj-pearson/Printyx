/**
 * Voice Phone Agent for After-Hours Service Intake Schema (US-SUPER-013).
 *
 * A Twilio voice AI agent picks up after-hours service calls, takes the ticket,
 * dispatches the on-call tech for P1, and queues a ticket otherwise — recovering
 * the ~20% of calls lost when no one answers.
 *
 *   - voice_agent_settings : per-tenant kill switch + after-hours-only toggle +
 *     languages + PII redaction + Twilio number + encrypted Twilio/ElevenLabs creds
 *   - voice_agent_calls    : one row per handled call (transcript, recording,
 *     detected issue + priority, created ticket, escalation, per-call cost metering)
 *
 * The real-time stack (Twilio Media Streams + Claude streaming + ElevenLabs)
 * sits behind named adapter stubs; the intake endpoint is exercisable from a
 * call-end summary offline. Credentials encrypted (credential vault), never
 * returned. Recordings purged after 90 days; PII (card numbers) redactable.
 * On-call rotation read best-effort from team-alerts (alert_configurations).
 *
 * Re-exported from shared/schema.ts.
 * TODO(rbac): requirePermission(['service.voice_agent.manage']) once it exists.
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

export const VOICE_CALL_PRIORITIES = ['P1', 'P2', 'P3'] as const;
export type VoiceCallPriority = (typeof VOICE_CALL_PRIORITIES)[number];

// ---------------------------------------------------------------------------
// voice_agent_settings — per-tenant config + kill switch
// ---------------------------------------------------------------------------
export const voiceAgentSettings = pgTable('voice_agent_settings', {
  tenantId: varchar('tenant_id').primaryKey(),
  /** Kill switch — the agent only answers when enabled. Default OFF. */
  enabled: boolean('enabled').notNull().default(false),
  /** v1 default: only answer after hours (vs 24/7). */
  afterHoursOnly: boolean('after_hours_only').notNull().default(true),
  /** Business hours definition used by the after-hours gate: { tz, days:{...} }. */
  businessHours: jsonb('business_hours'),
  /** Enabled languages (detect from first 5s). Default en + es. */
  languages: jsonb('languages'),
  /** Mask card numbers from the stored transcript. */
  piiRedaction: boolean('pii_redaction').notNull().default(true),
  /** The provisioned Twilio number for this tenant. */
  twilioNumber: varchar('twilio_number'),
  /** Encrypted Twilio + ElevenLabs creds; never returned (*_set markers only). */
  encryptedConfig: jsonb('encrypted_config'),
  updatedByUserId: varchar('updated_by_user_id'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// voice_agent_calls — one row per handled call
// ---------------------------------------------------------------------------
export const voiceAgentCalls = pgTable(
  'voice_agent_calls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    /** Twilio Call SID. */
    callSid: varchar('call_sid'),
    fromNumber: varchar('from_number'),
    /** ANI-matched customer (business_records.id). */
    callerCustomerId: varchar('caller_customer_id'),
    /** Detected language (en | es). */
    language: varchar('language', { length: 8 }),
    transcript: varchar('transcript', { length: 8000 }),
    /** Recording storage URL (purged after recording_purge_at). */
    recordingUrl: varchar('recording_url'),
    recordingPurgeAt: timestamp('recording_purge_at'),
    /** Extracted issue summary + machine id/location + callback number. */
    detectedIssue: varchar('detected_issue', { length: 2000 }),
    machineRef: varchar('machine_ref'),
    callbackNumber: varchar('callback_number'),
    /** P1 | P2 | P3 from keyword classification. */
    priority: varchar('priority', { length: 4 }),
    /** The created service_tickets.id. */
    ticketId: varchar('ticket_id'),
    /** P1 → paged on-call tech (team-alerts rotation). */
    escalated: boolean('escalated').notNull().default(false),
    onCallTechId: varchar('on_call_tech_id'),
    /** Per-call cost metering. */
    twilioCost: doublePrecision('twilio_cost').notNull().default(0),
    aiCost: doublePrecision('ai_cost').notNull().default(0),
    totalCost: doublePrecision('total_cost').notNull().default(0),
    durationSeconds: integer('duration_seconds').notNull().default(0),
    status: varchar('status', { length: 16 }).notNull().default('completed'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('voice_agent_calls_tenant_idx').on(table.tenantId),
    tenantCreatedIdx: index('voice_agent_calls_tenant_created_idx').on(
      table.tenantId,
      table.createdAt,
    ),
    purgeIdx: index('voice_agent_calls_purge_idx').on(table.recordingPurgeAt),
  }),
);

export type VoiceAgentSettings = typeof voiceAgentSettings.$inferSelect;
export type VoiceAgentCall = typeof voiceAgentCalls.$inferSelect;
export type NewVoiceAgentCall = typeof voiceAgentCalls.$inferInsert;
