/**
 * Sales Rep Email Autopilot Schema (US-SUPER-016) — DRAFT MODE, NEVER auto-send.
 *
 * Overnight, per opted-in rep: read inbox + CRM + calendar, classify inbound
 * email (Claude), and draft replies in the rep's voice (last-50-sent style
 * fingerprint + CRM context). Drafts are saved as Gmail/Outlook drafts AND
 * surfaced in Printyx for review. There is NO send scope in v1.
 *
 *   - email_autopilot_accounts     : per-rep Gmail/Outlook connection (encrypted
 *     OAuth tokens, cached voice fingerprint, enabled flag)
 *   - email_autopilot_drafts       : one row per drafted reply (classification +
 *     confidence + draft + external draft id + edit-distance on accept)
 *   - email_autopilot_suppressions : per-contact "never auto-draft" list
 *
 * OAuth + provider draft creation sit behind named adapter stubs; tokens are
 * encrypted (credential vault) and never returned — only *_set booleans. Audit
 * every draft via the [AUDIT] logger. Ships behind a feature flag (enabled flag).
 *
 * Builds on shared/outreach-schema.ts. Re-exported from shared/schema.ts.
 * TODO(rbac): requirePermission(['sales.email_autopilot.use']) once it exists.
 */

import {
  boolean,
  doublePrecision,
  index,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const EMAIL_PROVIDERS = ['gmail', 'outlook'] as const;
export type EmailProvider = (typeof EMAIL_PROVIDERS)[number];

export const EMAIL_CLASSIFICATIONS = ['needs_reply', 'fyi', 'spam'] as const;
export type EmailClassification = (typeof EMAIL_CLASSIFICATIONS)[number];

export const EMAIL_DRAFT_STATUSES = ['draft', 'accepted', 'rejected'] as const;
export type EmailDraftStatus = (typeof EMAIL_DRAFT_STATUSES)[number];

// ---------------------------------------------------------------------------
// email_autopilot_accounts — per-rep connected mailbox
// ---------------------------------------------------------------------------
export const emailAutopilotAccounts = pgTable(
  'email_autopilot_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    userId: varchar('user_id').notNull(),
    /** gmail | outlook. */
    provider: varchar('provider', { length: 12 }).notNull(),
    emailAddress: varchar('email_address'),
    /** Encrypted OAuth tokens (read + create-draft scope ONLY); never returned. */
    encryptedTokens: jsonb('encrypted_tokens'),
    /** Cached style fingerprint from the rep's last ~50 sent emails. */
    voiceFingerprint: jsonb('voice_fingerprint'),
    /** Feature-flag / opt-in toggle (default off — explicit opt-in). */
    enabled: boolean('enabled').notNull().default(false),
    lastScanAt: timestamp('last_scan_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantUserUnique: uniqueIndex('email_autopilot_accounts_tenant_user_uq').on(
      table.tenantId,
      table.userId,
    ),
  }),
);

// ---------------------------------------------------------------------------
// email_autopilot_drafts — one drafted reply per inbound needs_reply email
// ---------------------------------------------------------------------------
export const emailAutopilotDrafts = pgTable(
  'email_autopilot_drafts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    userId: varchar('user_id').notNull(),
    /** Provider message/thread ids. */
    providerMessageId: varchar('provider_message_id'),
    threadId: varchar('thread_id'),
    /** Counterparty. */
    contactEmail: varchar('contact_email'),
    /** Linked CRM record (business_records.id), if matched. */
    crmContactId: varchar('crm_contact_id'),
    /** needs_reply | fyi | spam. */
    classification: varchar('classification', { length: 16 }).notNull().default('needs_reply'),
    classificationConfidence: doublePrecision('classification_confidence'),
    inboundSubject: varchar('inbound_subject', { length: 500 }),
    inboundSnippet: varchar('inbound_snippet', { length: 2000 }),
    draftSubject: varchar('draft_subject', { length: 500 }),
    draftBody: varchar('draft_body', { length: 8000 }),
    draftSource: varchar('draft_source', { length: 12 }).notNull().default('fallback'), // ai | fallback
    /** Gmail/Outlook draft id once created in the rep's mailbox. */
    externalDraftId: varchar('external_draft_id'),
    /** draft | accepted | rejected. */
    status: varchar('status', { length: 12 }).notNull().default('draft'),
    /** Rep's edit-distance % on accept (tone-miss flag when > 50). */
    editDistancePct: doublePrecision('edit_distance_pct'),
    /** The final body the rep accepted (for edit-distance + audit). */
    finalBody: varchar('final_body', { length: 8000 }),
    reviewedAt: timestamp('reviewed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantUserIdx: index('email_autopilot_drafts_tenant_user_idx').on(table.tenantId, table.userId),
    tenantStatusIdx: index('email_autopilot_drafts_tenant_status_idx').on(
      table.tenantId,
      table.status,
    ),
  }),
);

// ---------------------------------------------------------------------------
// email_autopilot_suppressions — per-contact "never auto-draft"
// ---------------------------------------------------------------------------
export const emailAutopilotSuppressions = pgTable(
  'email_autopilot_suppressions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: varchar('tenant_id').notNull(),
    userId: varchar('user_id').notNull(),
    contactEmail: varchar('contact_email').notNull(),
    reason: varchar('reason'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantUserContactUnique: uniqueIndex('email_autopilot_suppressions_uq').on(
      table.tenantId,
      table.userId,
      table.contactEmail,
    ),
  }),
);

export type EmailAutopilotAccount = typeof emailAutopilotAccounts.$inferSelect;
export type EmailAutopilotDraft = typeof emailAutopilotDrafts.$inferSelect;
export type EmailAutopilotSuppression = typeof emailAutopilotSuppressions.$inferSelect;
