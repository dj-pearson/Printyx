/**
 * CRMX-009: email sequence / drip enrollment + per-recipient state.
 *
 * email_campaigns already stores sequence_steps (jsonb) + current_step +
 * schedule_type, but nothing tracks WHO is in a sequence or advances them. This
 * table is the missing per-recipient state; server/services/email-sequence-scheduler.ts
 * advances enrollments, sends each step through the SendGrid email service, and
 * respects suppressions/unsubscribes + tenant sending limits.
 */
import { sql } from 'drizzle-orm';
import {
  index,
  uniqueIndex,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export interface SequenceStepHistoryEntry {
  step: number;
  sentAt: string;
  status: 'sent' | 'failed' | 'skipped';
  messageId?: string;
  error?: string;
}

export const emailSequenceEnrollments = pgTable(
  'email_sequence_enrollments',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    campaignId: varchar('campaign_id').notNull(), // an email_campaigns row (drip)

    recipientEmail: varchar('recipient_email').notNull(),
    businessRecordId: varchar('business_record_id'),
    contactId: varchar('contact_id'),

    // 0-based index of the NEXT step to send.
    currentStep: integer('current_step').notNull().default(0),
    // active | sending | completed | stopped | unsubscribed | bounced | failed
    status: varchar('status', { length: 20 }).notNull().default('active'),
    // When the current step becomes due. NULL while a send is in flight.
    nextSendAt: timestamp('next_send_at'),
    lastSentAt: timestamp('last_sent_at'),
    stoppedReason: text('stopped_reason'),
    sendCount: integer('send_count').notNull().default(0),
    history: jsonb('history').$type<SequenceStepHistoryEntry[]>().notNull().default([]),

    enrolledBy: varchar('enrolled_by'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('email_seq_enroll_tenant_idx').on(table.tenantId),
    campaignIdx: index('email_seq_enroll_campaign_idx').on(table.campaignId),
    statusIdx: index('email_seq_enroll_status_idx').on(table.status),
    nextSendIdx: index('email_seq_enroll_next_send_idx').on(table.nextSendAt),
    campaignEmailUnique: uniqueIndex('email_seq_enroll_campaign_email_unique').on(
      table.campaignId,
      table.recipientEmail,
    ),
  }),
);

export const insertEmailSequenceEnrollmentSchema = createInsertSchema(
  emailSequenceEnrollments,
).omit({
  id: true,
  tenantId: true,
  status: true,
  currentStep: true,
  sendCount: true,
  history: true,
  lastSentAt: true,
  createdAt: true,
  updatedAt: true,
});

export type EmailSequenceEnrollment = typeof emailSequenceEnrollments.$inferSelect;
export type InsertEmailSequenceEnrollment = z.infer<typeof insertEmailSequenceEnrollmentSchema>;
