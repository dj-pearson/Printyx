/**
 * Data provenance and Article 14 notice tracking (LEGAL-008).
 *
 * GDPR Article 14 covers personal data NOT obtained from the data subject. When
 * a contact record is bought from Apollo or ZoomInfo, that person never gave us
 * their details and does not know we hold them, so they are owed a notice
 * within a month of acquisition. Nothing tracked which records came from an
 * enrichment provider, so the notice could not have been sent even in principle.
 *
 * Two tables rather than columns on the canonical tables:
 *
 * 1. `contact_data_provenance` records where a record came from. It is keyed by
 *    subject type and id rather than a foreign key, because the same question
 *    applies to a contact (companyContacts) and to a company record
 *    (business_records), and the CRM is mid-migration between duplicate models
 *    (docs/crm-canonical-model.md). A join table survives that migration; two
 *    sets of added columns would have to move with it.
 *
 * 2. `contact_suppressions` is the durable half. An erasure or objection that
 *    only deletes the row is undone by the next enrichment run, which cheerfully
 *    re-acquires the same person from the same provider. Suppression has to
 *    outlive the record it suppresses, so it is keyed by the identifier the
 *    provider matches on - email or domain - and NOT deleted when the contact
 *    is.
 */

import { sql } from 'drizzle-orm';
import { index, pgTable, timestamp, uniqueIndex, varchar, text, jsonb } from 'drizzle-orm/pg-core';

/** Where a record came from. `customer` means the tenant supplied it themselves. */
export const PROVENANCE_SOURCES = [
  'customer',
  'apollo',
  'zoominfo',
  'import',
  'web_form',
  'unknown',
] as const;
export type ProvenanceSource = (typeof PROVENANCE_SOURCES)[number];

/** Sources that trigger an Article 14 obligation: the subject did not give us the data. */
export const INDIRECT_SOURCES: ProvenanceSource[] = ['apollo', 'zoominfo'];

export const ART14_NOTICE_STATUSES = [
  'not_required', // obtained from the subject, so Art. 13 applied at collection
  'pending', // owed, not yet sent
  'sent',
  'suppressed', // subject objected or was erased; do not contact
  'exempt', // Art. 14(5) exemption claimed, reason recorded
] as const;

export const contactDataProvenance = pgTable(
  'contact_data_provenance',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),

    /** 'contact' (companyContacts) or 'company' (business_records). */
    subjectType: varchar('subject_type', { length: 20 }).notNull(),
    subjectId: varchar('subject_id').notNull(),

    /** The identifier the provider matched on, kept so suppression can outlive the row. */
    subjectEmail: varchar('subject_email', { length: 320 }),

    source: varchar('source', { length: 32 }).notNull(),
    /** Provider's own record id, where one came back. */
    sourceRecordId: varchar('source_record_id', { length: 128 }),
    acquiredAt: timestamp('acquired_at').notNull().defaultNow(),

    /** Which fields the provider supplied, so a subject-access request can answer precisely. */
    fieldsAcquired: jsonb('fields_acquired').$type<string[]>().default([]),

    art14NoticeStatus: varchar('art14_notice_status', { length: 20 })
      .notNull()
      .default('not_required'),
    art14NoticeSentAt: timestamp('art14_notice_sent_at'),
    /** Required when status is 'exempt'. */
    art14ExemptionReason: text('art14_exemption_reason'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('contact_data_provenance_tenant_idx').on(table.tenantId),
    subjectIdx: uniqueIndex('contact_data_provenance_subject_uq').on(
      table.tenantId,
      table.subjectType,
      table.subjectId,
    ),
    emailIdx: index('contact_data_provenance_email_idx').on(table.tenantId, table.subjectEmail),
    noticeIdx: index('contact_data_provenance_notice_idx').on(
      table.tenantId,
      table.art14NoticeStatus,
    ),
  }),
);

/**
 * People who must not be re-acquired.
 *
 * Deliberately NOT scoped to a contact row. The row is what gets deleted; the
 * suppression is what has to survive it, or the next enrichment run silently
 * undoes the erasure.
 */
export const contactSuppressions = pgTable(
  'contact_suppressions',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),

    /** Lower-cased email. The identifier enrichment providers match on. */
    email: varchar('email', { length: 320 }).notNull(),

    /** 'objection' (Art. 21), 'erasure' (Art. 17), 'manual'. */
    reason: varchar('reason', { length: 32 }).notNull(),
    reasonDetail: text('reason_detail'),

    /** How the request arrived, for the audit trail. */
    source: varchar('source', { length: 32 }).notNull().default('privacy_request'),

    suppressedAt: timestamp('suppressed_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantEmailUnique: uniqueIndex('contact_suppressions_tenant_email_uq').on(
      table.tenantId,
      table.email,
    ),
    emailIdx: index('contact_suppressions_email_idx').on(table.email),
  }),
);

export type ContactDataProvenance = typeof contactDataProvenance.$inferSelect;
export type InsertContactDataProvenance = typeof contactDataProvenance.$inferInsert;
export type ContactSuppression = typeof contactSuppressions.$inferSelect;
export type InsertContactSuppression = typeof contactSuppressions.$inferInsert;
