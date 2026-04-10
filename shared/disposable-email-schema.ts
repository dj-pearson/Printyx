/**
 * Disposable Email Domains Schema
 *
 * Platform-global blocklist of disposable / throwaway email providers used to
 * reject accounts created from temporary mailboxes at signup.
 *
 * This table is NOT per-tenant. It is a global security policy managed by
 * platform administrators. The initial list is seeded from the public
 * disposable-email-domains/disposable-email-domains repository on GitHub.
 */

import { sql } from 'drizzle-orm';
import {
  pgTable,
  varchar,
  text,
  boolean,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const disposableEmailDomains = pgTable(
  'disposable_email_domains',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    // The lowercase email domain (e.g. "mailinator.com"). Always stored lowercase.
    domain: varchar('domain', { length: 255 }).notNull(),
    // Whether this domain is currently being blocked. Keeping the row while
    // toggling this flag lets admins temporarily allow a domain without
    // losing the audit trail.
    isBlocked: boolean('is_blocked').default(true).notNull(),
    // Origin of the entry: "seed" (imported from public list), "manual"
    // (added by an admin in the UI), or "import" (bulk import).
    source: varchar('source', { length: 32 }).default('manual').notNull(),
    // Free-form admin notes explaining why this domain was added/allowed.
    notes: text('notes'),
    // User ID of the admin who last touched the record.
    addedBy: varchar('added_by'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    domainUnique: unique('disposable_email_domains_domain_unique').on(table.domain),
    isBlockedIdx: index('disposable_email_domains_is_blocked_idx').on(table.isBlocked),
  }),
);

export type DisposableEmailDomain = typeof disposableEmailDomains.$inferSelect;
export type InsertDisposableEmailDomain = typeof disposableEmailDomains.$inferInsert;

// Domain validation: lowercase letters, digits, hyphens, dots, with a valid TLD
const domainRegex = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;

export const insertDisposableEmailDomainSchema = createInsertSchema(disposableEmailDomains, {
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Domain is too short')
    .max(255, 'Domain must be 255 characters or fewer')
    .regex(domainRegex, 'Enter a valid domain name, e.g. "mailinator.com"'),
  source: z.enum(['seed', 'manual', 'import']).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export const updateDisposableEmailDomainSchema = z.object({
  isBlocked: z.boolean().optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export const bulkInsertDisposableEmailDomainsSchema = z.object({
  domains: z
    .array(
      z
        .string()
        .trim()
        .toLowerCase()
        .min(3)
        .max(255)
        .regex(domainRegex, 'Invalid domain'),
    )
    .min(1)
    .max(5000),
  source: z.enum(['seed', 'manual', 'import']).default('import'),
  notes: z.string().max(2000).optional().nullable(),
});
