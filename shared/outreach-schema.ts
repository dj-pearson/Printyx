/**
 * Outreach Schema
 *
 * Tables powering the AI-assisted outbound email/LinkedIn generator.
 * Single-tenant feature gated by OUTREACH_ENABLED_TENANTS env flag (see server/routes/outreach-routes.ts).
 *
 * Design notes:
 * - `business_contexts` can be tenant-scoped (per dealership) or user-scoped (per rep).
 *   Per-user overrides the per-tenant default when present.
 * - `rep_specializations` lets one user carry multiple specialties with weights (e.g., 70% copier / 30% production).
 *   The AI prompt blends knowledge packs proportional to the weights.
 * - `outreach_prospects` is a lightweight staging table so reps can paste in prospects
 *   without first creating a full business_records row.
 * - `outreach_drafts` persists per-prospect generated copy so reps can revisit / mark-sent.
 */

import {
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// ==================== Specialty Enum Values ====================
// Kept as string constants (not pgEnum) so tenants can extend later without migrations.
export const OUTREACH_SPECIALTIES = [
  'copier_mfp', // Copier / MFP (general office imaging)
  'production_print', // Production print (high-volume, color-critical)
  'production_finishing', // Folding, binding, stitching, perfing
  'managed_it', // Managed IT services
  'software', // Document / workflow / ECM software
  'managed_print', // MPS (hybrid motion across fleet + service)
  'wide_format', // Wide / large format
] as const;

export type OutreachSpecialty = (typeof OUTREACH_SPECIALTIES)[number];

// ==================== Business Contexts ====================
// Equivalent to the article's /business-context folder (icp.md, offer.md, etc.)
// Stored as structured fields for programmatic use, plus a freeform notes field.
export const businessContexts = pgTable(
  'business_contexts',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    userId: varchar('user_id'), // null = tenant default, non-null = user override

    // ICP
    icpSummary: text('icp_summary'), // One-paragraph description of who we sell to
    icpCompanySize: text('icp_company_size'), // e.g. "5-250 employees"
    icpIndustries: text('icp_industries').array(),
    icpGeographies: text('icp_geographies').array(),
    icpBuyerTitles: text('icp_buyer_titles').array(),
    icpPainPoints: text('icp_pain_points').array(),
    icpTriggerSignals: text('icp_trigger_signals').array(), // e.g. "lease expiring", "new office opened"

    // Offer
    offerSummary: text('offer_summary'),
    offerOutcomes: text('offer_outcomes').array(), // Outcomes we deliver
    offerDifferentiators: text('offer_differentiators').array(),
    offerProof: text('offer_proof').array(), // Social proof snippets

    // Positioning
    positioningStatement: text('positioning_statement'),
    positioningObjections:
      jsonb('positioning_objections').$type<Array<{ objection: string; response: string }>>(),
    notForCustomers: text('not_for_customers').array(), // Who we don't sell to

    // Past Wins
    pastWins: jsonb('past_wins').$type<
      Array<{
        company: string;
        industry?: string;
        size?: string;
        howFound?: string;
        triggerToBuy?: string;
        outcome?: string;
      }>
    >(),

    // Tools & sending stack (informational; generator may reference)
    toolsNotes: text('tools_notes'),

    // Freeform additional context piped directly into prompts
    additionalNotes: text('additional_notes'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('business_contexts_tenant_idx').on(table.tenantId),
    tenantUserIdx: uniqueIndex('business_contexts_tenant_user_uniq').on(
      table.tenantId,
      table.userId,
    ),
  }),
);

// ==================== Rep Specializations ====================
// A user can carry multiple specialties, each with a weight 0-100.
// Weights are normalized at prompt-build time.
export const repSpecializations = pgTable(
  'rep_specializations',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    userId: varchar('user_id').notNull(),

    specialty: varchar('specialty', { length: 50 }).notNull(), // one of OUTREACH_SPECIALTIES
    weight: integer('weight').notNull().default(100), // 0-100
    experienceYears: integer('experience_years'),
    personalNotes: text('personal_notes'), // Rep's own voice/style notes

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantUserIdx: index('rep_specializations_tenant_user_idx').on(table.tenantId, table.userId),
    userSpecialtyUniq: uniqueIndex('rep_specializations_user_specialty_uniq').on(
      table.userId,
      table.specialty,
    ),
  }),
);

// ==================== Outreach Sequences ====================
// A saved sequence template. Sequences have steps (email or linkedin touches).
export const outreachSequences = pgTable(
  'outreach_sequences',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    userId: varchar('user_id').notNull(), // Owning rep

    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),

    // What angle/signal this sequence targets. Drives AI generation.
    angle: text('angle'), // e.g. "lease expiring in 90 days", "new office opening"
    targetSpecialty: varchar('target_specialty', { length: 50 }), // Optional specialty override

    // Channel mix
    includesEmail: boolean('includes_email').notNull().default(true),
    includesLinkedin: boolean('includes_linkedin').notNull().default(false),
    isDreamAccountOnly: boolean('is_dream_account_only').notNull().default(false), // Top 10% filter

    // AI metadata — what was used to generate this
    generationContext: jsonb('generation_context').$type<{
      modelUsed?: string;
      specialtyBlend?: Array<{ specialty: string; weight: number }>;
      businessContextId?: string;
      generatedAt?: string;
    }>(),

    isActive: boolean('is_active').notNull().default(true),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantUserIdx: index('outreach_sequences_tenant_user_idx').on(table.tenantId, table.userId),
  }),
);

// ==================== Outreach Sequence Steps ====================
export const outreachSequenceSteps = pgTable(
  'outreach_sequence_steps',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    sequenceId: varchar('sequence_id').notNull(),

    stepOrder: integer('step_order').notNull(), // 1-based
    channel: varchar('channel', { length: 20 }).notNull(), // 'email' | 'linkedin_connect' | 'linkedin_message' | 'linkedin_inmail'
    dayOffset: integer('day_offset').notNull().default(0), // Days after sequence start

    // Template content — subject + body with {{token}} placeholders
    subjectTemplate: text('subject_template'), // Null for LinkedIn steps
    bodyTemplate: text('body_template').notNull(),

    // AI-generated variants for the rep to choose between
    variants:
      jsonb('variants').$type<Array<{ subject?: string; body: string; rationale?: string }>>(),

    // Spam linter flags at generation time
    spamFlags: jsonb('spam_flags').$type<string[]>(),

    notes: text('notes'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    sequenceIdx: index('outreach_sequence_steps_sequence_idx').on(table.sequenceId),
    tenantIdx: index('outreach_sequence_steps_tenant_idx').on(table.tenantId),
  }),
);

// ==================== Outreach Prospects ====================
// Lightweight staging. Reps can paste in a prospect name/company without creating a business_record.
// Later, if the prospect engages, we promote to business_records.
export const outreachProspects = pgTable(
  'outreach_prospects',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    userId: varchar('user_id').notNull(),

    // Link back to business_records if already there
    businessRecordId: varchar('business_record_id'),

    // Core fields
    firstName: varchar('first_name', { length: 100 }),
    lastName: varchar('last_name', { length: 100 }),
    title: varchar('title', { length: 255 }),
    email: varchar('email', { length: 255 }),
    linkedinUrl: varchar('linkedin_url', { length: 500 }),
    phone: varchar('phone', { length: 50 }),

    companyName: varchar('company_name', { length: 255 }),
    companyWebsite: varchar('company_website', { length: 500 }),
    industry: varchar('industry', { length: 100 }),
    employeeCount: integer('employee_count'),
    city: varchar('city', { length: 100 }),
    state: varchar('state', { length: 100 }),

    // Signal / angle fields — what makes this prospect timely
    triggerSignal: text('trigger_signal'), // e.g. "lease expires 2026-08, hired 12 reps, opened new office"
    customFields: jsonb('custom_fields').$type<Record<string, unknown>>(),

    source: varchar('source', { length: 100 }), // 'manual', 'business_records', 'google_maps', 'apollo', etc.

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantUserIdx: index('outreach_prospects_tenant_user_idx').on(table.tenantId, table.userId),
    emailIdx: index('outreach_prospects_email_idx').on(table.email),
  }),
);

// ==================== Outreach Drafts ====================
// A personalized draft generated for (sequence × prospect). Ready to copy/paste.
export const outreachDrafts = pgTable(
  'outreach_drafts',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    userId: varchar('user_id').notNull(),

    sequenceId: varchar('sequence_id'), // Null if ad-hoc (one-off generation)
    stepId: varchar('step_id'), // Null if ad-hoc
    prospectId: varchar('prospect_id').notNull(),

    channel: varchar('channel', { length: 20 }).notNull(), // 'email' | 'linkedin_connect' | 'linkedin_message' | 'linkedin_inmail'
    subject: text('subject'),
    body: text('body').notNull(),

    // AI variants the rep can choose between
    variants:
      jsonb('variants').$type<Array<{ subject?: string; body: string; rationale?: string }>>(),
    selectedVariantIndex: integer('selected_variant_index').default(0),

    // Lifecycle
    status: varchar('status', { length: 30 }).notNull().default('draft'),
    // 'draft' | 'copied' | 'sent' | 'replied' | 'booked' | 'skipped'

    markedSentAt: timestamp('marked_sent_at'),
    markedRepliedAt: timestamp('marked_replied_at'),
    repliedSentiment: varchar('replied_sentiment', { length: 20 }), // 'positive' | 'neutral' | 'negative' | 'ooo'
    meetingBooked: boolean('meeting_booked').notNull().default(false),

    // What context was used to generate
    generationContext: jsonb('generation_context').$type<{
      modelUsed?: string;
      specialtyBlend?: Array<{ specialty: string; weight: number }>;
      angle?: string;
      businessContextId?: string;
      spamFlags?: string[];
      generatedAt?: string;
    }>(),

    notes: text('notes'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantUserIdx: index('outreach_drafts_tenant_user_idx').on(table.tenantId, table.userId),
    prospectIdx: index('outreach_drafts_prospect_idx').on(table.prospectId),
    statusIdx: index('outreach_drafts_status_idx').on(table.tenantId, table.status),
  }),
);

// ==================== Insert Schemas (Zod) ====================

export const insertBusinessContextSchema = createInsertSchema(businessContexts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRepSpecializationSchema = createInsertSchema(repSpecializations)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    specialty: z.enum(OUTREACH_SPECIALTIES),
    weight: z.number().min(0).max(100),
  });

export const insertOutreachSequenceSchema = createInsertSchema(outreachSequences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOutreachSequenceStepSchema = createInsertSchema(outreachSequenceSteps).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOutreachProspectSchema = createInsertSchema(outreachProspects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOutreachDraftSchema = createInsertSchema(outreachDrafts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ==================== Types ====================

export type BusinessContext = typeof businessContexts.$inferSelect;
export type InsertBusinessContext = z.infer<typeof insertBusinessContextSchema>;

export type RepSpecialization = typeof repSpecializations.$inferSelect;
export type InsertRepSpecialization = z.infer<typeof insertRepSpecializationSchema>;

export type OutreachSequence = typeof outreachSequences.$inferSelect;
export type InsertOutreachSequence = z.infer<typeof insertOutreachSequenceSchema>;

export type OutreachSequenceStep = typeof outreachSequenceSteps.$inferSelect;
export type InsertOutreachSequenceStep = z.infer<typeof insertOutreachSequenceStepSchema>;

export type OutreachProspect = typeof outreachProspects.$inferSelect;
export type InsertOutreachProspect = z.infer<typeof insertOutreachProspectSchema>;

export type OutreachDraft = typeof outreachDrafts.$inferSelect;
export type InsertOutreachDraft = z.infer<typeof insertOutreachDraftSchema>;
