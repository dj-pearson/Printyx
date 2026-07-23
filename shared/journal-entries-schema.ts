// PA-045: GL journal entries.
//
// A flat header-level model matching the JournalEntries admin UI (entry number,
// description, date, reference, header debit/credit totals, status) — not a
// double-entry line-item ledger. Debits must equal credits (enforced in the
// route). The endpoint previously returned 501 "not implemented".
import { pgTable, varchar, text, numeric, timestamp, date } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';

export const journalEntries = pgTable('journal_entries', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id').notNull(),
  entryNumber: varchar('entry_number').notNull(),
  description: text('description').notNull(),
  entryDate: date('entry_date').notNull(),
  reference: varchar('reference'),
  totalDebit: numeric('total_debit', { precision: 14, scale: 2 }).notNull().default('0'),
  totalCredit: numeric('total_credit', { precision: 14, scale: 2 }).notNull().default('0'),
  status: varchar('status').notNull().default('draft'),
  createdBy: varchar('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const insertJournalEntrySchema = createInsertSchema(journalEntries);
export type JournalEntry = typeof journalEntries.$inferSelect;
export type InsertJournalEntry = typeof journalEntries.$inferInsert;
