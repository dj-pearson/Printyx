/**
 * CRMX-011: Web forms builder + landing-page lead capture.
 *
 * `web_forms` are tenant-owned form definitions (fields + mapping + settings)
 * that render as an embeddable/hosted public form. `web_form_submissions` are
 * the raw captures; a Node processor turns each into a business_records lead
 * (dedup, scoring, routing, workflow trigger). See:
 *   - supabase/functions/public-forms/    (public GET def + POST submit)
 *   - server/routes-web-forms.ts          (admin CRUD + submissions list)
 *   - server/services/web-form-processor.ts (new-submission processor)
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
  boolean,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// A single field on a form definition.
export interface WebFormField {
  key: string; // stable field key (payload key)
  label: string;
  type: 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'checkbox' | 'number' | 'url';
  required?: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>; // for select
  // Where this field maps on the created lead: a business_records column
  // (e.g. 'companyName', 'primaryContactEmail') or 'cf_<key>' for a custom field.
  mapTo?: string;
  order: number;
}

export interface WebFormSettings {
  submitButtonText?: string;
  successMessage?: string;
  redirectUrl?: string;
  notifyEmails?: string[];
  defaultOwnerId?: string;
  leadSource?: string; // stored on business_records.source (defaults 'web_form')
  // Workflow to enroll on submission (CRMX-008), e.g. an autoresponder/nurture.
  autoresponderWorkflowId?: string;
}

export const webForms = pgTable(
  'web_forms',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    // URL slug for the hosted form (/f/:slug), unique per tenant.
    slug: varchar('slug', { length: 255 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 20 }).notNull().default('draft'), // draft | published | archived

    fields: jsonb('fields').$type<WebFormField[]>().notNull().default([]),
    settings: jsonb('settings').$type<WebFormSettings>(),

    // Opaque token the embed/hosted form presents; lets the public endpoint
    // resolve the form without exposing internal ids or requiring auth.
    publicToken: varchar('public_token').notNull(),

    submissionCount: integer('submission_count').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),

    createdBy: varchar('created_by'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('web_forms_tenant_idx').on(table.tenantId),
    tenantSlugUnique: uniqueIndex('web_forms_tenant_slug_unique').on(table.tenantId, table.slug),
    tokenIdx: index('web_forms_public_token_idx').on(table.publicToken),
    statusIdx: index('web_forms_status_idx').on(table.status),
  }),
);

export const webFormSubmissions = pgTable(
  'web_form_submissions',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    formId: varchar('form_id').notNull(),
    // The lead this submission created or matched (null until processed / on spam).
    businessRecordId: varchar('business_record_id'),

    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    utm: jsonb('utm').$type<Record<string, string>>(),
    referrer: text('referrer'),
    ipAddress: varchar('ip_address'),
    userAgent: text('user_agent'),

    // new → processed | duplicate | spam | error
    status: varchar('status', { length: 20 }).notNull().default('new'),
    dedupedToExisting: boolean('deduped_to_existing').notNull().default(false),
    processingError: text('processing_error'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    processedAt: timestamp('processed_at'),
  },
  (table) => ({
    tenantIdx: index('web_form_submissions_tenant_idx').on(table.tenantId),
    formIdx: index('web_form_submissions_form_idx').on(table.formId),
    statusIdx: index('web_form_submissions_status_idx').on(table.status),
    createdAtIdx: index('web_form_submissions_created_at_idx').on(table.createdAt),
  }),
);

// ==================== Zod ====================

const webFormFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['text', 'email', 'phone', 'textarea', 'select', 'checkbox', 'number', 'url']),
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  mapTo: z.string().optional(),
  order: z.number(),
});

export const insertWebFormSchema = createInsertSchema(webForms, {
  fields: z.array(webFormFieldSchema),
}).omit({
  id: true,
  tenantId: true,
  slug: true, // server-generated
  publicToken: true, // server-generated
  submissionCount: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWebFormSubmissionSchema = createInsertSchema(webFormSubmissions).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});

export type WebForm = typeof webForms.$inferSelect;
export type WebFormSubmission = typeof webFormSubmissions.$inferSelect;
export type InsertWebForm = z.infer<typeof insertWebFormSchema>;
export type InsertWebFormSubmission = z.infer<typeof insertWebFormSubmissionSchema>;
