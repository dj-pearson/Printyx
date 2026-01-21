import {
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants, users } from './schema';

/**
 * PLATFORM SIGNUPS & TRIALS CRM SYSTEM
 * Tracks all platform signups, trials, and conversion metrics
 */

// ============================================================================
// PLATFORM SIGNUPS
// ============================================================================

export const platformSignups = pgTable(
  'platform_signups',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    // Company information
    companyName: varchar('company_name', { length: 255 }).notNull(),
    industry: varchar('industry', { length: 100 }),
    companySize: varchar('company_size', { length: 50 }), // small, medium, large, enterprise

    // Contact information
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 20 }),

    // Trial information
    trialPlanSelected: varchar('trial_plan_selected', { length: 50 }), // starter, professional, enterprise
    interestAreas: jsonb('interest_areas').default(sql`'[]'::jsonb`), // [crm, billing, service, analytics]

    // Signup metadata
    source: varchar('source', { length: 100 }), // website, marketing_campaign, referral, api, manual
    utmSource: varchar('utm_source', { length: 100 }),
    utmCampaign: varchar('utm_campaign', { length: 100 }),
    utmMedium: varchar('utm_medium', { length: 100 }),

    // Status tracking
    status: varchar('status', { length: 20 }).default('pending'), // pending, trial_started, activated, churned, disqualified
    qualificationScore: integer('qualification_score').default(0), // 0-100, based on engagement

    // Link to created tenant (after trial starts)
    tenantId: varchar('tenant_id').references(() => tenants.id),
    primaryUserId: varchar('primary_user_id').references(() => users.id),

    // Engagement tracking
    emailVerified: boolean('email_verified').default(false),
    emailVerifiedAt: timestamp('email_verified_at'),
    trialStartedAt: timestamp('trial_started_at'),
    trialEndedAt: timestamp('trial_ended_at'),
    upgradedAt: timestamp('upgraded_at'),

    // Notes and tags
    notes: text('notes'),
    tags: jsonb('tags').default(sql`'[]'::jsonb`), // for categorization
    assignedTo: varchar('assigned_to'), // sales rep ID

    // Engagement metrics
    emailsOpened: integer('emails_opened').default(0),
    emailsClicked: integer('emails_clicked').default(0),
    demosRequested: integer('demos_requested').default(0),
    docsViewed: integer('docs_viewed').default(0),
    featuresExplored: jsonb('features_explored').default(sql`'[]'::jsonb`),
    lastActivityAt: timestamp('last_activity_at'),

    // Feedback
    feedbackScore: integer('feedback_score'), // 1-5 NPS
    feedbackComment: text('feedback_comment'),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    emailIdx: index('signups_email_idx').on(table.email),
    statusIdx: index('signups_status_idx').on(table.status),
    tenantIdIdx: index('signups_tenant_id_idx').on(table.tenantId),
    createdAtIdx: index('signups_created_at_idx').on(table.createdAt),
    qualificationIdx: index('signups_qualification_idx').on(table.qualificationScore),
  }),
);

// ============================================================================
// TRIAL ACTIVITY LOG
// ============================================================================

export const trialActivityLog = pgTable(
  'trial_activity_log',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    signupId: varchar('signup_id')
      .notNull()
      .references(() => platformSignups.id, { onDelete: 'cascade' }),
    tenantId: varchar('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),

    // Activity type
    activityType: varchar('activity_type', { length: 50 }).notNull(),
    // Types: email_opened, email_clicked, feature_viewed, data_created, report_generated, demo_requested, support_ticket

    description: text('description'),

    // Feature usage
    featureModule: varchar('feature_module', { length: 100 }), // dashboard, crm, billing, service, etc
    actionDetails: jsonb('action_details').default(sql`'{}'::jsonb`),

    // Engagement impact
    engagementValue: integer('engagement_value').default(1), // Weight for scoring

    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    signupIdIdx: index('trial_activity_signup_id_idx').on(table.signupId),
    activityTypeIdx: index('trial_activity_type_idx').on(table.activityType),
    createdAtIdx: index('trial_activity_created_at_idx').on(table.createdAt),
  }),
);

// ============================================================================
// TRIAL COMMUNICATIONS
// ============================================================================

export const trialCommunications = pgTable(
  'trial_communications',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    signupId: varchar('signup_id')
      .notNull()
      .references(() => platformSignups.id, { onDelete: 'cascade' }),

    // Email campaign
    campaignName: varchar('campaign_name', { length: 255 }).notNull(),
    emailTemplate: varchar('email_template', { length: 100 }), // onboarding, feature_highlight, upgrade_prompt, re_engagement, churn_prevention
    subject: varchar('subject', { length: 255 }).notNull(),

    // Delivery
    sentAt: timestamp('sent_at').notNull(),
    openedAt: timestamp('opened_at'),
    clickedAt: timestamp('clicked_at'),

    // Status
    status: varchar('status', { length: 20 }).default('sent'), // pending, sent, opened, clicked, bounced, failed

    // Link tracking
    clickedUrl: varchar('clicked_url'),

    notes: text('notes'),

    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    signupIdIdx: index('communications_signup_id_idx').on(table.signupId),
    sentAtIdx: index('communications_sent_at_idx').on(table.sentAt),
    statusIdx: index('communications_status_idx').on(table.status),
  }),
);

// ============================================================================
// CONVERSION FUNNEL TRACKING
// ============================================================================

export const conversionFunnelEvents = pgTable(
  'conversion_funnel_events',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    signupId: varchar('signup_id')
      .notNull()
      .references(() => platformSignups.id, { onDelete: 'cascade' }),

    // Funnel stage
    stage: varchar('stage', { length: 50 }).notNull(),
    // Stages: signup_created, email_verified, trial_started, first_data_created, feature_used, demo_completed, upgrade_attempted, upgraded, churned

    stageEnteredAt: timestamp('stage_entered_at').defaultNow(),
    stageExitedAt: timestamp('stage_exited_at'),

    // Duration and metrics
    durationMinutes: integer('duration_minutes'),

    metadata: jsonb('metadata').default(sql`'{}'::jsonb`),

    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    signupIdIdx: index('funnel_signup_id_idx').on(table.signupId),
    stageIdx: index('funnel_stage_idx').on(table.stage),
    createdAtIdx: index('funnel_created_at_idx').on(table.createdAt),
  }),
);

// ============================================================================
// EXPORTS
// ============================================================================

export type PlatformSignup = typeof platformSignups.$inferSelect;
export type NewPlatformSignup = typeof platformSignups.$inferInsert;

export type TrialActivityLog = typeof trialActivityLog.$inferSelect;
export type NewTrialActivityLog = typeof trialActivityLog.$inferInsert;

export type TrialCommunication = typeof trialCommunications.$inferSelect;
export type NewTrialCommunication = typeof trialCommunications.$inferInsert;

export type ConversionFunnelEvent = typeof conversionFunnelEvents.$inferSelect;
export type NewConversionFunnelEvent = typeof conversionFunnelEvents.$inferInsert;
