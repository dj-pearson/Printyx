/**
 * COMPREHENSIVE PLATFORM CRM SCHEMA
 *
 * Full-featured CRM for platform-level tenant lifecycle management
 * Mirrors the robust tenant-level CRM but adapted for managing prospects and tenants
 *
 * Features:
 * - Unified business records (zero-data-loss prospect → tenant conversion)
 * - Sales pipeline and deal management
 * - Contact management with roles
 * - AI-powered lead scoring and BANT qualification
 * - Territory management and lead assignment
 * - Customer success (health scores, churn prediction, renewals)
 * - Complete activity tracking (calls, emails, meetings, demos)
 * - Sales goals and performance management
 * - Advanced analytics and reporting
 * - Workflow automation for lifecycle management
 */

import {
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  decimal,
  jsonb,
  index,
  pgEnum,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants, users } from './schema';
import { createInsertSchema } from 'drizzle-zod';

// ============================================================================
// ENUMS
// ============================================================================

export const platformRecordTypeEnum = pgEnum('platform_record_type', ['prospect', 'tenant']);

export const platformRecordStatusEnum = pgEnum('platform_record_status', [
  // Prospect statuses
  'new',
  'contacted',
  'qualified',
  'demo_scheduled',
  'demo_completed',
  'trial_started',
  'trial_active',
  'proposal_sent',
  'negotiating',
  // Tenant statuses
  'active_customer',
  'at_risk',
  'renewal_pending',
  'churned',
  'former_customer',
  // Terminal statuses
  'lost',
  'disqualified',
  'not_a_fit',
]);

export const platformDealStageEnum = pgEnum('platform_deal_stage', [
  'prospecting',
  'qualification',
  'demo_scheduled',
  'demo_completed',
  'trial_started',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
]);

export const platformActivityTypeEnum = pgEnum('platform_activity_type', [
  'call',
  'email',
  'meeting',
  'demo',
  'proposal',
  'trial_check_in',
  'support_ticket',
  'renewal_discussion',
  'executive_review',
  'note',
  'task',
]);

export const platformHealthStatusEnum = pgEnum('platform_health_status', [
  'excellent',
  'healthy',
  'at_risk',
  'critical',
  'churned',
]);

export const platformChurnRiskEnum = pgEnum('platform_churn_risk', [
  'very_low',
  'low',
  'medium',
  'high',
  'critical',
]);

export const platformLeadGradeEnum = pgEnum('platform_lead_grade', [
  'A+',
  'A',
  'B+',
  'B',
  'C+',
  'C',
  'D',
  'F',
]);

export const platformLeadTierEnum = pgEnum('platform_lead_tier', ['hot', 'warm', 'cold']);

// ============================================================================
// PLATFORM BUSINESS RECORDS (Unified Prospects & Tenants)
// ============================================================================

export const platformBusinessRecords = pgTable(
  'platform_business_records',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    // Record Type & Status (Unified Model)
    recordType: platformRecordTypeEnum('record_type').notNull().default('prospect'),
    status: platformRecordStatusEnum('status').notNull().default('new'),
    previousStatus: platformRecordStatusEnum('previous_status'),

    // Company Information
    companyName: varchar('company_name', { length: 255 }).notNull(),
    companyDisplayId: varchar('company_display_id', { length: 20 }).unique(), // e.g., "P00001" for prospects, "T00001" for tenants
    website: varchar('website', { length: 255 }),
    industry: varchar('industry', { length: 100 }),
    companySize: varchar('company_size', { length: 50 }), // small, medium, large, enterprise
    employeeCount: integer('employee_count'),
    annualRevenue: decimal('annual_revenue', { precision: 15, scale: 2 }),

    // Primary Contact Information
    primaryContactName: varchar('primary_contact_name', { length: 255 }),
    primaryContactEmail: varchar('primary_contact_email', { length: 255 }),
    primaryContactPhone: varchar('primary_contact_phone', { length: 20 }),
    primaryContactTitle: varchar('primary_contact_title', { length: 100 }),

    // Address
    addressLine1: varchar('address_line1', { length: 255 }),
    addressLine2: varchar('address_line2', { length: 255 }),
    city: varchar('city', { length: 100 }),
    state: varchar('state', { length: 50 }),
    postalCode: varchar('postal_code', { length: 20 }),
    country: varchar('country', { length: 100 }).default('USA'),
    timezone: varchar('timezone', { length: 50 }),

    // Lead Information
    leadSource: varchar('lead_source', { length: 100 }), // website, referral, marketing_campaign, inbound, outbound, partner
    leadScore: integer('lead_score').default(0), // 0-100
    leadGrade: platformLeadGradeEnum('lead_grade'),
    leadTier: platformLeadTierEnum('lead_tier'),
    qualificationScore: integer('qualification_score').default(0), // 0-100

    // UTM Tracking
    utmSource: varchar('utm_source', { length: 100 }),
    utmCampaign: varchar('utm_campaign', { length: 100 }),
    utmMedium: varchar('utm_medium', { length: 100 }),
    utmContent: varchar('utm_content', { length: 255 }),
    utmTerm: varchar('utm_term', { length: 100 }),

    // Interest & Needs
    productInterest: jsonb('product_interest').default(sql`'[]'::jsonb`), // Features interested in
    painPoints: jsonb('pain_points').default(sql`'[]'::jsonb`),
    competitorInfo: text('competitor_info'),

    // Sales Pipeline
    salesStage: varchar('sales_stage', { length: 50 }),
    estimatedValue: decimal('estimated_value', { precision: 12, scale: 2 }), // Estimated ARR
    probability: integer('probability'), // 0-100
    expectedCloseDate: timestamp('expected_close_date'),

    // Assignment
    assignedSalesRep: varchar('assigned_sales_rep'), // User ID
    assignedCSM: varchar('assigned_csm'), // Customer Success Manager ID
    territory: varchar('territory', { length: 100 }),

    // Tenant Linkage (after conversion)
    tenantId: varchar('tenant_id').references(() => tenants.id),
    primaryUserId: varchar('primary_user_id').references(() => users.id),

    // Trial Information
    trialPlanSelected: varchar('trial_plan_selected', { length: 50 }),
    trialStartedAt: timestamp('trial_started_at'),
    trialEndDate: timestamp('trial_end_date'),
    trialStatus: varchar('trial_status', { length: 20 }), // active, expired, converted, cancelled

    // Customer Information (after conversion)
    customerSince: timestamp('customer_since'), // When they became a paying customer
    currentMRR: decimal('current_mrr', { precision: 10, scale: 2 }),
    currentARR: decimal('current_arr', { precision: 12, scale: 2 }),
    lifetimeValue: decimal('lifetime_value', { precision: 12, scale: 2 }),

    // Contract & Renewal
    contractStartDate: timestamp('contract_start_date'),
    contractEndDate: timestamp('contract_end_date'),
    renewalDate: timestamp('renewal_date'),
    autoRenew: boolean('auto_renew').default(false),

    // Churn Information
    churnRisk: platformChurnRiskEnum('churn_risk'),
    churnProbability: decimal('churn_probability', { precision: 5, scale: 4 }), // 0.0000 to 1.0000
    churnedAt: timestamp('churned_at'),
    churnReason: text('churn_reason'),
    winbackEligible: boolean('winback_eligible').default(true),

    // Engagement Metrics
    emailVerified: boolean('email_verified').default(false),
    emailsOpened: integer('emails_opened').default(0),
    emailsClicked: integer('emails_clicked').default(0),
    demosRequested: integer('demos_requested').default(0),
    demosCompleted: integer('demos_completed').default(0),
    lastEngagementDate: timestamp('last_engagement_date'),
    engagementScore: integer('engagement_score').default(0), // 0-100

    // Activity Tracking
    lastContactDate: timestamp('last_contact_date'),
    nextFollowUpDate: timestamp('next_follow_up_date'),
    totalActivities: integer('total_activities').default(0),
    totalCalls: integer('total_calls').default(0),
    totalEmails: integer('total_emails').default(0),
    totalMeetings: integer('total_meetings').default(0),

    // NPS & Satisfaction
    npsScore: integer('nps_score'), // -100 to 100
    csatScore: decimal('csat_score', { precision: 3, scale: 2 }), // 0.00 to 5.00
    lastSurveyDate: timestamp('last_survey_date'),

    // Tags & Categorization
    tags: jsonb('tags').default(sql`'[]'::jsonb`),
    customFields: jsonb('custom_fields').default(sql`'{}'::jsonb`),

    // Notes
    notes: text('notes'),
    internalNotes: text('internal_notes'), // Not visible to customer

    // Priority & Flags
    priority: varchar('priority', { length: 20 }).default('medium'), // low, medium, high, critical
    isStrategic: boolean('is_strategic').default(false), // Strategic account flag
    requiresApproval: boolean('requires_approval').default(false),

    // Conversion Tracking
    convertedFromProspectAt: timestamp('converted_from_prospect_at'),
    convertedBy: varchar('converted_by'), // User ID who converted
    conversionSource: varchar('conversion_source', { length: 100 }), // trial, sales, partner

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    deletedAt: timestamp('deleted_at'), // Soft delete
  },
  (table) => ({
    companyNameIdx: index('platform_business_records_company_name_idx').on(table.companyName),
    emailIdx: index('platform_business_records_email_idx').on(table.primaryContactEmail),
    statusIdx: index('platform_business_records_status_idx').on(table.status),
    recordTypeIdx: index('platform_business_records_type_idx').on(table.recordType),
    tenantIdIdx: index('platform_business_records_tenant_id_idx').on(table.tenantId),
    assignedRepIdx: index('platform_business_records_assigned_rep_idx').on(table.assignedSalesRep),
    leadScoreIdx: index('platform_business_records_lead_score_idx').on(table.leadScore),
    nextFollowUpIdx: index('platform_business_records_next_followup_idx').on(
      table.nextFollowUpDate,
    ),
    createdAtIdx: index('platform_business_records_created_at_idx').on(table.createdAt),
  }),
);

// ============================================================================
// PLATFORM CONTACTS
// ============================================================================

export const platformContacts = pgTable(
  'platform_contacts',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    businessRecordId: varchar('business_record_id')
      .notNull()
      .references(() => platformBusinessRecords.id, { onDelete: 'cascade' }),

    // Contact Information
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    fullName: varchar('full_name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 20 }),
    mobilePhone: varchar('mobile_phone', { length: 20 }),

    // Professional Information
    title: varchar('title', { length: 100 }),
    department: varchar('department', { length: 100 }),
    role: varchar('role', { length: 50 }), // decision_maker, influencer, champion, end_user, gatekeeper

    // Contact Hierarchy
    reportsToId: varchar('reports_to_id').references(() => platformContacts.id),
    isDecisionMaker: boolean('is_decision_maker').default(false),
    isPrimaryContact: boolean('is_primary_contact').default(false),

    // Engagement
    emailOptIn: boolean('email_opt_in').default(true),
    phoneOptIn: boolean('phone_opt_in').default(true),
    preferredContactMethod: varchar('preferred_contact_method', { length: 20 }), // email, phone, linkedin

    // Social Media
    linkedinUrl: varchar('linkedin_url', { length: 255 }),
    twitterHandle: varchar('twitter_handle', { length: 100 }),

    // Activity Tracking
    lastContactDate: timestamp('last_contact_date'),
    nextFollowUpDate: timestamp('next_follow_up_date'),
    emailsReceived: integer('emails_received').default(0),
    emailsOpened: integer('emails_opened').default(0),
    emailsClicked: integer('emails_clicked').default(0),

    // Status
    isActive: boolean('is_active').default(true),

    // Notes
    notes: text('notes'),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    businessRecordIdIdx: index('platform_contacts_business_record_id_idx').on(
      table.businessRecordId,
    ),
    emailIdx: index('platform_contacts_email_idx').on(table.email),
    isPrimaryIdx: index('platform_contacts_is_primary_idx').on(table.isPrimaryContact),
  }),
);

// ============================================================================
// PLATFORM DEALS (Sales Pipeline)
// ============================================================================

export const platformDeals = pgTable(
  'platform_deals',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    businessRecordId: varchar('business_record_id')
      .notNull()
      .references(() => platformBusinessRecords.id, { onDelete: 'cascade' }),

    // Deal Information
    dealName: varchar('deal_name', { length: 255 }).notNull(),
    description: text('description'),
    dealType: varchar('deal_type', { length: 50 }), // new_business, expansion, renewal, upgrade

    // Pipeline Stage
    stage: platformDealStageEnum('stage').notNull().default('prospecting'),
    previousStage: platformDealStageEnum('previous_stage'),
    status: varchar('status', { length: 20 }).default('open'), // open, won, lost

    // Financial
    dealValue: decimal('deal_value', { precision: 12, scale: 2 }).notNull(), // ARR
    estimatedMRR: decimal('estimated_mrr', { precision: 10, scale: 2 }),
    probability: integer('probability').notNull(), // 0-100
    weightedValue: decimal('weighted_value', { precision: 12, scale: 2 }), // dealValue * probability

    // Timeline
    expectedCloseDate: timestamp('expected_close_date'),
    actualCloseDate: timestamp('actual_close_date'),

    // Product/Plan Information
    planInterested: varchar('plan_interested', { length: 50 }), // starter, professional, enterprise
    billingCycle: varchar('billing_cycle', { length: 20 }), // monthly, annual
    seatsRequested: integer('seats_requested'),

    // Assignment
    ownerId: varchar('owner_id').notNull(), // Sales rep user ID
    assignedCSM: varchar('assigned_csm'), // Post-sale CSM assignment

    // BANT Qualification
    budgetConfirmed: boolean('budget_confirmed').default(false),
    authorityConfirmed: boolean('authority_confirmed').default(false),
    needConfirmed: boolean('need_confirmed').default(false),
    timelineConfirmed: boolean('timeline_confirmed').default(false),
    bantScore: integer('bant_score').default(0), // 0-100

    // Sales Process
    proposalSent: boolean('proposal_sent').default(false),
    proposalSentAt: timestamp('proposal_sent_at'),
    contractSent: boolean('contract_sent').default(false),
    contractSentAt: timestamp('contract_sent_at'),
    demoCompleted: boolean('demo_completed').default(false),
    demoCompletedAt: timestamp('demo_completed_at'),

    // Competition
    competitorInfo: text('competitor_info'),
    competitorsIdentified: jsonb('competitors_identified').default(sql`'[]'::jsonb`),

    // Outcome Information
    lostReason: text('lost_reason'),
    lostToCompetitor: varchar('lost_to_competitor', { length: 100 }),
    winReason: text('win_reason'),

    // Commission
    commissionAmount: decimal('commission_amount', { precision: 10, scale: 2 }),
    commissionPaid: boolean('commission_paid').default(false),

    // Forecasting
    forecastCategory: varchar('forecast_category', { length: 20 }), // pipeline, best_case, committed, closed

    // Engagement
    lastActivityDate: timestamp('last_activity_date'),
    nextActivityDate: timestamp('next_activity_date'),

    // Tags & Notes
    tags: jsonb('tags').default(sql`'[]'::jsonb`),
    notes: text('notes'),
    internalNotes: text('internal_notes'),

    // Priority
    priority: varchar('priority', { length: 20 }).default('medium'),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    createdBy: varchar('created_by'),
    updatedAt: timestamp('updated_at').defaultNow(),
    closedAt: timestamp('closed_at'),
  },
  (table) => ({
    businessRecordIdIdx: index('platform_deals_business_record_id_idx').on(table.businessRecordId),
    stageIdx: index('platform_deals_stage_idx').on(table.stage),
    statusIdx: index('platform_deals_status_idx').on(table.status),
    ownerIdIdx: index('platform_deals_owner_id_idx').on(table.ownerId),
    expectedCloseDateIdx: index('platform_deals_expected_close_date_idx').on(
      table.expectedCloseDate,
    ),
    createdAtIdx: index('platform_deals_created_at_idx').on(table.createdAt),
  }),
);

// ============================================================================
// PLATFORM ACTIVITIES (Call, Email, Meeting Tracking)
// ============================================================================

export const platformActivities = pgTable(
  'platform_activities',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    businessRecordId: varchar('business_record_id')
      .notNull()
      .references(() => platformBusinessRecords.id, { onDelete: 'cascade' }),
    dealId: varchar('deal_id').references(() => platformDeals.id, { onDelete: 'cascade' }),
    contactId: varchar('contact_id').references(() => platformContacts.id),

    // Activity Type
    activityType: platformActivityTypeEnum('activity_type').notNull(),

    // Activity Details
    subject: varchar('subject', { length: 255 }).notNull(),
    description: text('description'),
    activityDate: timestamp('activity_date').notNull().defaultNow(),

    // Call-specific fields
    callDuration: integer('call_duration_minutes'),
    callOutcome: varchar('call_outcome', { length: 50 }), // answered, no_answer, voicemail, busy
    callRecordingUrl: varchar('call_recording_url'),
    callDisposition: varchar('call_disposition', { length: 100 }), // interested, not_interested, callback, qualified, etc.

    // Email-specific fields
    emailFrom: varchar('email_from', { length: 255 }),
    emailTo: varchar('email_to', { length: 255 }),
    emailCc: varchar('email_cc'),
    emailSubject: varchar('email_subject', { length: 255 }),
    emailBody: text('email_body'),
    emailOpened: boolean('email_opened').default(false),
    emailClicked: boolean('email_clicked').default(false),
    emailReplied: boolean('email_replied').default(false),

    // Meeting-specific fields
    meetingDate: timestamp('meeting_date'),
    meetingDuration: integer('meeting_duration_minutes'),
    meetingType: varchar('meeting_type', { length: 50 }), // phone, in_person, video, demo
    meetingLocation: varchar('meeting_location'),
    meetingAttendees: jsonb('meeting_attendees').default(sql`'[]'::jsonb`),
    meetingNotes: text('meeting_notes'),
    meetingOutcome: varchar('meeting_outcome', { length: 100 }),

    // Demo-specific fields
    demoType: varchar('demo_type', { length: 50 }), // standard, custom, technical
    featuresShown: jsonb('features_shown').default(sql`'[]'::jsonb`),
    demoFeedback: text('demo_feedback'),

    // Task fields
    taskDueDate: timestamp('task_due_date'),
    taskCompleted: boolean('task_completed').default(false),
    taskCompletedAt: timestamp('task_completed_at'),
    taskPriority: varchar('task_priority', { length: 20 }),

    // Sentiment Analysis
    sentiment: varchar('sentiment', { length: 20 }), // positive, neutral, negative
    sentimentScore: decimal('sentiment_score', { precision: 5, scale: 4 }), // -1.0000 to 1.0000

    // Related Records
    relatedRecords: jsonb('related_records').default(sql`'{}'::jsonb`), // Links to other entities

    // Outcome
    outcome: varchar('outcome', { length: 100 }),
    nextSteps: text('next_steps'),

    // Assignment
    createdBy: varchar('created_by').notNull(), // User ID
    assignedTo: varchar('assigned_to'), // For tasks

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    businessRecordIdIdx: index('platform_activities_business_record_id_idx').on(
      table.businessRecordId,
    ),
    dealIdIdx: index('platform_activities_deal_id_idx').on(table.dealId),
    activityTypeIdx: index('platform_activities_type_idx').on(table.activityType),
    activityDateIdx: index('platform_activities_date_idx').on(table.activityDate),
    createdByIdx: index('platform_activities_created_by_idx').on(table.createdBy),
  }),
);

// ============================================================================
// PLATFORM LEAD SCORING
// ============================================================================

export const platformLeadScoringRules = pgTable('platform_lead_scoring_rules', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Rule Details
  ruleName: varchar('rule_name', { length: 255 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(), // demographic, firmographic, behavioral, engagement, bant
  description: text('description'),

  // Conditions
  fieldName: varchar('field_name', { length: 100 }).notNull(),
  operator: varchar('operator', { length: 20 }).notNull(), // equals, greater_than, less_than, contains, in_list, etc.
  value: jsonb('value').notNull(),

  // Scoring
  points: integer('points').notNull(), // Points to award
  maxPoints: integer('max_points'), // Maximum points this rule can contribute

  // Priority
  priority: integer('priority').default(0), // Higher priority rules evaluated first
  weight: decimal('weight', { precision: 5, scale: 2 }).default('1.0'),

  // Status
  isActive: boolean('is_active').default(true),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  createdBy: varchar('created_by'),
});

export const platformLeadScoreCalculations = pgTable(
  'platform_lead_score_calculations',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    businessRecordId: varchar('business_record_id')
      .notNull()
      .references(() => platformBusinessRecords.id, { onDelete: 'cascade' })
      .unique(),

    // Score Breakdown
    demographicScore: integer('demographic_score').default(0), // 0-100
    firmographicScore: integer('firmographic_score').default(0),
    behavioralScore: integer('behavioral_score').default(0),
    engagementScore: integer('engagement_score').default(0),
    bantScore: integer('bant_score').default(0),

    // Total Score
    totalScore: integer('total_score').notNull().default(0), // 0-100

    // Lead Grade & Tier
    leadGrade: platformLeadGradeEnum('lead_grade').notNull().default('F'),
    leadTier: platformLeadTierEnum('lead_tier').notNull().default('cold'),

    // ML Predictions
    mlPredictionScore: decimal('ml_prediction_score', { precision: 5, scale: 4 }), // 0.0000 to 1.0000
    conversionProbability: decimal('conversion_probability', { precision: 5, scale: 4 }),
    estimatedTimeToConversion: integer('estimated_time_to_conversion_days'),
    confidenceLevel: decimal('confidence_level', { precision: 5, scale: 4 }),
    modelVersion: varchar('model_version', { length: 50 }),

    // Recommended Actions
    recommendedAction: varchar('recommended_action', { length: 50 }), // contact_immediately, nurture, disqualify, etc.
    recommendedNextSteps: jsonb('recommended_next_steps').default(sql`'[]'::jsonb`),

    // Calculation Details
    factorsConsidered: integer('factors_considered').default(0),
    rulesApplied: jsonb('rules_applied').default(sql`'[]'::jsonb`), // Array of rule IDs

    // Timestamps
    calculatedAt: timestamp('calculated_at').defaultNow(),
    nextCalculation: timestamp('next_calculation'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    businessRecordIdIdx: index('platform_lead_score_business_record_id_idx').on(
      table.businessRecordId,
    ),
    totalScoreIdx: index('platform_lead_score_total_score_idx').on(table.totalScore),
    leadGradeIdx: index('platform_lead_score_grade_idx').on(table.leadGrade),
  }),
);

// ============================================================================
// PLATFORM BANT QUALIFICATION
// ============================================================================

export const platformBantQualification = pgTable(
  'platform_bant_qualification',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    businessRecordId: varchar('business_record_id')
      .notNull()
      .references(() => platformBusinessRecords.id, { onDelete: 'cascade' })
      .unique(),
    dealId: varchar('deal_id').references(() => platformDeals.id),

    // Budget (0-25 points)
    budgetIdentified: boolean('budget_identified').default(false),
    budgetAmount: decimal('budget_amount', { precision: 12, scale: 2 }),
    budgetTimeframe: varchar('budget_timeframe', { length: 50 }), // q1, q2, fiscal_year, etc.
    budgetApproved: boolean('budget_approved').default(false),
    budgetScore: integer('budget_score').default(0), // 0-25
    budgetNotes: text('budget_notes'),

    // Authority (0-25 points)
    decisionMakerIdentified: boolean('decision_maker_identified').default(false),
    decisionMakerName: varchar('decision_maker_name', { length: 255 }),
    decisionMakerTitle: varchar('decision_maker_title', { length: 100 }),
    decisionMakerContactId: varchar('decision_maker_contact_id').references(
      () => platformContacts.id,
    ),
    decisionProcess: text('decision_process'),
    influencersIdentified: jsonb('influencers_identified').default(sql`'[]'::jsonb`),
    authorityScore: integer('authority_score').default(0), // 0-25
    authorityNotes: text('authority_notes'),

    // Need (0-25 points)
    needIdentified: boolean('need_identified').default(false),
    needType: varchar('need_type', { length: 100 }), // growth, replacement, efficiency, compliance
    needUrgency: varchar('need_urgency', { length: 20 }), // critical, high, medium, low
    needDescription: text('need_description'),
    painPoints: jsonb('pain_points').default(sql`'[]'::jsonb`),
    currentSolution: text('current_solution'),
    needScore: integer('need_score').default(0), // 0-25
    needNotes: text('need_notes'),

    // Timeline (0-25 points)
    timelineIdentified: boolean('timeline_identified').default(false),
    expectedDecisionDate: timestamp('expected_decision_date'),
    expectedImplementationDate: timestamp('expected_implementation_date'),
    decisionTimeline: varchar('decision_timeline', { length: 50 }), // immediate, 30_days, 90_days, etc.
    implementationTimeline: varchar('implementation_timeline', { length: 50 }),
    blockers: jsonb('blockers').default(sql`'[]'::jsonb`),
    timelineScore: integer('timeline_score').default(0), // 0-25
    timelineNotes: text('timeline_notes'),

    // Overall Assessment
    totalBantScore: integer('total_bant_score').default(0), // 0-100
    qualificationStatus: varchar('qualification_status', { length: 50 }), // unqualified, partially_qualified, qualified, highly_qualified
    qualifiedDate: timestamp('qualified_date'),
    disqualifiedDate: timestamp('disqualified_date'),
    disqualifiedReason: text('disqualified_reason'),

    // Competitive Information
    competitorsEvaluating: jsonb('competitors_evaluating').default(sql`'[]'::jsonb`),
    ourAdvantages: text('our_advantages'),
    competitorAdvantages: text('competitor_advantages'),

    // Assessment
    assessedBy: varchar('assessed_by'), // User ID
    lastAssessedAt: timestamp('last_assessed_at'),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    businessRecordIdIdx: index('platform_bant_business_record_id_idx').on(table.businessRecordId),
    totalScoreIdx: index('platform_bant_total_score_idx').on(table.totalBantScore),
  }),
);

// ============================================================================
// PLATFORM SALES TERRITORIES
// ============================================================================

export const platformSalesTerritories = pgTable(
  'platform_sales_territories',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    // Territory Details
    name: varchar('name', { length: 100 }).notNull(),
    code: varchar('code', { length: 20 }).unique(),
    description: text('description'),
    territoryType: varchar('territory_type', { length: 50 }), // geographic, industry, company_size, named_accounts

    // Geographic Rules
    countries: jsonb('countries').default(sql`'[]'::jsonb`),
    states: jsonb('states').default(sql`'[]'::jsonb`),
    cities: jsonb('cities').default(sql`'[]'::jsonb`),
    postalCodes: jsonb('postal_codes').default(sql`'[]'::jsonb`),

    // Account Rules
    industries: jsonb('industries').default(sql`'[]'::jsonb`),
    companySizeMin: integer('company_size_min'),
    companySizeMax: integer('company_size_max'),
    revenueMin: decimal('revenue_min', { precision: 15, scale: 2 }),
    revenueMax: decimal('revenue_max', { precision: 15, scale: 2 }),
    accountTiers: jsonb('account_tiers').default(sql`'[]'::jsonb`),

    // Ownership
    ownerId: varchar('owner_id').notNull(), // Primary rep
    teamMembers: jsonb('team_members').default(sql`'[]'::jsonb`), // Array of user IDs
    managerId: varchar('manager_id'),

    // Quotas
    monthlyQuota: decimal('monthly_quota', { precision: 12, scale: 2 }),
    quarterlyQuota: decimal('quarterly_quota', { precision: 12, scale: 2 }),
    annualQuota: decimal('annual_quota', { precision: 12, scale: 2 }),

    // Performance Tracking
    currentPipeline: decimal('current_pipeline', { precision: 12, scale: 2 }).default('0'),
    activeProspectsCount: integer('active_prospects_count').default(0),
    activeDealsCount: integer('active_deals_count').default(0),

    // Status
    isActive: boolean('is_active').default(true),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    ownerIdIdx: index('platform_territories_owner_id_idx').on(table.ownerId),
  }),
);

// ============================================================================
// PLATFORM LEAD ASSIGNMENT
// ============================================================================

export const platformLeadAssignmentRules = pgTable('platform_lead_assignment_rules', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Rule Details
  ruleName: varchar('rule_name', { length: 255 }).notNull(),
  description: text('description'),
  priority: integer('priority').default(0), // Higher priority first

  // Assignment Strategy
  assignmentType: varchar('assignment_type', { length: 50 }), // territory, round_robin, skill_based, workload_balanced, manual

  // Matching Criteria
  leadSource: jsonb('lead_source').default(sql`'[]'::jsonb`),
  leadScoreMin: integer('lead_score_min'),
  leadScoreMax: integer('lead_score_max'),
  industries: jsonb('industries').default(sql`'[]'::jsonb`),
  companySize: jsonb('company_size').default(sql`'[]'::jsonb`),
  dealSizeMin: decimal('deal_size_min', { precision: 12, scale: 2 }),
  dealSizeMax: decimal('deal_size_max', { precision: 12, scale: 2 }),
  geography: jsonb('geography').default(sql`'{}'::jsonb`),

  // Round-Robin Configuration
  roundRobinUsers: jsonb('round_robin_users').default(sql`'[]'::jsonb`), // Array of user IDs
  currentIndex: integer('current_index').default(0),
  skipUnavailable: boolean('skip_unavailable').default(true),
  respectCapacity: boolean('respect_capacity').default(true),

  // Assignment Target
  assignToTerritoryId: varchar('assign_to_territory_id').references(
    () => platformSalesTerritories.id,
  ),
  assignToUserId: varchar('assign_to_user_id'),

  // Capacity & Limits
  maxLeadsPerRep: integer('max_leads_per_rep'),
  maxLeadsPerDay: integer('max_leads_per_day'),

  // Timing
  assignImmediately: boolean('assign_immediately').default(true),
  delayMinutes: integer('delay_minutes').default(0),
  businessHoursOnly: boolean('business_hours_only').default(false),

  // Status
  isActive: boolean('is_active').default(true),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  createdBy: varchar('created_by'),
});

export const platformRepCapacity = pgTable('platform_rep_capacity', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar('user_id').notNull().unique(),

  // Capacity Limits
  maxActiveProspects: integer('max_active_prospects').default(50),
  maxNewProspectsPerDay: integer('max_new_prospects_per_day').default(5),
  maxNewProspectsPerWeek: integer('max_new_prospects_per_week').default(20),

  // Current Load
  currentActiveProspects: integer('current_active_prospects').default(0),
  prospectsAssignedToday: integer('prospects_assigned_today').default(0),
  prospectsAssignedThisWeek: integer('prospects_assigned_this_week').default(0),

  // Availability
  isAvailable: boolean('is_available').default(true),
  unavailableReason: varchar('unavailable_reason', { length: 100 }),
  unavailableUntil: timestamp('unavailable_until'),

  // Skills & Specializations
  skills: jsonb('skills').default(sql`'[]'::jsonb`),
  specializations: jsonb('specializations').default(sql`'[]'::jsonb`), // industries, company sizes, etc.

  // Performance Metrics
  averageResponseTimeMinutes: integer('average_response_time_minutes'),
  conversionRate: decimal('conversion_rate', { precision: 5, scale: 2 }),
  averageDealSize: decimal('average_deal_size', { precision: 12, scale: 2 }),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastResetAt: timestamp('last_reset_at').defaultNow(), // For daily/weekly counters
});

export const platformLeadAssignmentHistory = pgTable(
  'platform_lead_assignment_history',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    businessRecordId: varchar('business_record_id')
      .notNull()
      .references(() => platformBusinessRecords.id, { onDelete: 'cascade' }),

    // Assignment Details
    assignedFrom: varchar('assigned_from'), // Previous owner
    assignedTo: varchar('assigned_to').notNull(), // New owner
    assignmentReason: varchar('assignment_reason', { length: 100 }), // rule_based, manual, round_robin, territory, reassignment
    ruleId: varchar('rule_id').references(() => platformLeadAssignmentRules.id),

    // Response Tracking
    firstResponseAt: timestamp('first_response_at'),
    firstResponseTimeMinutes: integer('first_response_time_minutes'),
    acceptedAt: timestamp('accepted_at'),
    rejectedAt: timestamp('rejected_at'),
    rejectionReason: text('rejection_reason'),

    // Assignment Context
    assignedBy: varchar('assigned_by'), // User ID who made the assignment
    notes: text('notes'),

    // Timestamp
    assignedAt: timestamp('assigned_at').defaultNow(),
  },
  (table) => ({
    businessRecordIdIdx: index('platform_assignment_history_record_id_idx').on(
      table.businessRecordId,
    ),
    assignedToIdx: index('platform_assignment_history_assigned_to_idx').on(table.assignedTo),
  }),
);

// ============================================================================
// PLATFORM CUSTOMER SUCCESS
// ============================================================================

export const platformHealthScores = pgTable(
  'platform_health_scores',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    businessRecordId: varchar('business_record_id')
      .notNull()
      .references(() => platformBusinessRecords.id, { onDelete: 'cascade' })
      .unique(),
    tenantId: varchar('tenant_id').references(() => tenants.id),

    // Overall Health
    overallScore: integer('overall_score').notNull(), // 0-100
    healthStatus: platformHealthStatusEnum('health_status').notNull(),
    trend: varchar('trend', { length: 20 }), // improving, stable, declining

    // Component Scores (0-100 each)
    usageScore: integer('usage_score').default(0),
    engagementScore: integer('engagement_score').default(0),
    adoptionScore: integer('adoption_score').default(0),
    supportScore: integer('support_score').default(0),
    paymentScore: integer('payment_score').default(0),
    satisfactionScore: integer('satisfaction_score').default(0),

    // Key Metrics
    daysSinceLastLogin: integer('days_since_last_login'),
    activeUsersPercent: integer('active_users_percent'),
    featuresAdopted: integer('features_adopted'),
    totalFeatures: integer('total_features'),
    openSupportTickets: integer('open_support_tickets').default(0),
    avgTicketResolutionDays: decimal('avg_ticket_resolution_days', { precision: 5, scale: 2 }),
    overdueInvoices: integer('overdue_invoices').default(0),
    daysSinceLastPayment: integer('days_since_last_payment'),

    // NPS & Satisfaction
    npsScore: integer('nps_score'), // -100 to 100
    csatScore: decimal('csat_score', { precision: 3, scale: 2 }), // 0.00 to 5.00
    lastSurveyDate: timestamp('last_survey_date'),

    // Risk Factors & Strengths
    riskFactors: jsonb('risk_factors').default(sql`'[]'::jsonb`),
    strengthFactors: jsonb('strength_factors').default(sql`'[]'::jsonb`),

    // Recommendations
    recommendations: jsonb('recommendations').default(sql`'[]'::jsonb`),

    // Calculation Details
    calculatedAt: timestamp('calculated_at').defaultNow(),
    calculatedBy: varchar('calculated_by'), // user_id or 'system'
    nextCalculationDue: timestamp('next_calculation_due'),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    businessRecordIdIdx: index('platform_health_scores_record_id_idx').on(table.businessRecordId),
    healthStatusIdx: index('platform_health_scores_status_idx').on(table.healthStatus),
    overallScoreIdx: index('platform_health_scores_overall_idx').on(table.overallScore),
  }),
);

export const platformChurnPredictions = pgTable(
  'platform_churn_predictions',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    businessRecordId: varchar('business_record_id')
      .notNull()
      .references(() => platformBusinessRecords.id, { onDelete: 'cascade' }),
    tenantId: varchar('tenant_id').references(() => tenants.id),

    // Prediction Results
    churnRisk: platformChurnRiskEnum('churn_risk').notNull(),
    churnProbability: decimal('churn_probability', { precision: 5, scale: 4 }).notNull(), // 0.0000 to 1.0000
    confidenceLevel: decimal('confidence_level', { precision: 5, scale: 4 }), // Model confidence

    // Timeline
    predictedChurnDate: timestamp('predicted_churn_date'),
    daysUntilChurn: integer('days_until_churn'),
    contractEndDate: timestamp('contract_end_date'),
    daysUntilRenewal: integer('days_until_renewal'),

    // Contributing Factors
    primaryRiskFactors: jsonb('primary_risk_factors').default(sql`'[]'::jsonb`),
    secondaryRiskFactors: jsonb('secondary_risk_factors').default(sql`'[]'::jsonb`),

    // Model Information
    modelVersion: varchar('model_version', { length: 50 }),
    modelType: varchar('model_type', { length: 50 }), // rules_based, ml_logistic, ml_random_forest, ensemble
    featureImportance: jsonb('feature_importance').default(sql`'{}'::jsonb`),

    // Financial Impact
    estimatedMRR: decimal('estimated_mrr', { precision: 10, scale: 2 }),
    estimatedARR: decimal('estimated_arr', { precision: 12, scale: 2 }),
    estimatedLTV: decimal('estimated_ltv', { precision: 12, scale: 2 }),
    retentionCost: decimal('retention_cost', { precision: 10, scale: 2 }),

    // Action Tracking
    interventionRequired: boolean('intervention_required').default(false),
    interventionTriggered: boolean('intervention_triggered').default(false),
    interventionId: varchar('intervention_id'),

    // Prediction Metadata
    predictedAt: timestamp('predicted_at').defaultNow(),
    predictedBy: varchar('predicted_by'), // 'system' or user_id
    nextPrediction: timestamp('next_prediction'),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    businessRecordIdIdx: index('platform_churn_predictions_record_id_idx').on(
      table.businessRecordId,
    ),
    churnRiskIdx: index('platform_churn_predictions_risk_idx').on(table.churnRisk),
    predictedChurnDateIdx: index('platform_churn_predictions_date_idx').on(
      table.predictedChurnDate,
    ),
  }),
);

export const platformSuccessInterventions = pgTable(
  'platform_success_interventions',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    businessRecordId: varchar('business_record_id')
      .notNull()
      .references(() => platformBusinessRecords.id, { onDelete: 'cascade' }),

    // Intervention Details
    interventionType: varchar('intervention_type', { length: 50 }), // outreach, training, discount, upgrade_offer, executive_review
    trigger: varchar('trigger', { length: 100 }), // churn_risk, health_decline, usage_drop, payment_issue, manual
    priority: varchar('priority', { length: 20 }), // low, medium, high, critical

    // Status
    status: varchar('status', { length: 20 }).default('pending'), // pending, scheduled, in_progress, completed, cancelled
    outcome: varchar('outcome', { length: 50 }), // successful, partially_successful, unsuccessful, pending_followup

    // Assignment
    assignedTo: varchar('assigned_to'), // CSM user ID
    assignedAt: timestamp('assigned_at'),
    dueDate: timestamp('due_date'),

    // Execution
    scheduledDate: timestamp('scheduled_date'),
    executedAt: timestamp('executed_at'),
    completedAt: timestamp('completed_at'),

    // Details
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    actionItems: jsonb('action_items').default(sql`'[]'::jsonb`),
    notes: text('notes'),

    // Customer Response
    customerResponse: varchar('customer_response', { length: 50 }), // positive, neutral, negative, no_response
    followUpRequired: boolean('follow_up_required').default(false),
    followUpDate: timestamp('follow_up_date'),

    // Impact Tracking
    healthScoreBefore: integer('health_score_before'),
    healthScoreAfter: integer('health_score_after'),
    churnRiskBefore: platformChurnRiskEnum('churn_risk_before'),
    churnRiskAfter: platformChurnRiskEnum('churn_risk_after'),

    // Related Records
    relatedHealthScoreId: varchar('related_health_score_id').references(
      () => platformHealthScores.id,
    ),
    relatedChurnPredictionId: varchar('related_churn_prediction_id').references(
      () => platformChurnPredictions.id,
    ),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    createdBy: varchar('created_by'),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    businessRecordIdIdx: index('platform_interventions_record_id_idx').on(table.businessRecordId),
    statusIdx: index('platform_interventions_status_idx').on(table.status),
    assignedToIdx: index('platform_interventions_assigned_to_idx').on(table.assignedTo),
    dueDateIdx: index('platform_interventions_due_date_idx').on(table.dueDate),
  }),
);

export const platformRenewalOpportunities = pgTable(
  'platform_renewal_opportunities',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    businessRecordId: varchar('business_record_id')
      .notNull()
      .references(() => platformBusinessRecords.id, { onDelete: 'cascade' }),
    tenantId: varchar('tenant_id').references(() => tenants.id),

    // Renewal Details
    renewalType: varchar('renewal_type', { length: 50 }), // standard_renewal, expansion, downsizing, at_risk
    renewalStatus: varchar('renewal_status', { length: 50 }), // upcoming, in_progress, won, lost, cancelled
    renewalProbability: decimal('renewal_probability', { precision: 5, scale: 4 }), // 0.0000 to 1.0000

    // Timeline
    contractEndDate: timestamp('contract_end_date').notNull(),
    daysUntilRenewal: integer('days_until_renewal'),
    outreachStartDate: timestamp('outreach_start_date'),
    targetCloseDate: timestamp('target_close_date'),
    actualRenewalDate: timestamp('actual_renewal_date'),

    // Financial
    currentMRR: decimal('current_mrr', { precision: 10, scale: 2 }),
    projectedMRR: decimal('projected_mrr', { precision: 10, scale: 2 }),
    mrrChange: decimal('mrr_change', { precision: 10, scale: 2 }),
    mrrChangePercent: decimal('mrr_change_percent', { precision: 5, scale: 2 }),
    currentContractValue: decimal('current_contract_value', { precision: 12, scale: 2 }),
    projectedContractValue: decimal('projected_contract_value', { precision: 12, scale: 2 }),

    // Expansion Opportunities
    expansionPotential: varchar('expansion_potential', { length: 50 }), // high, medium, low, none
    suggestedAddOns: jsonb('suggested_add_ons').default(sql`'[]'::jsonb`),
    suggestedUpgrades: jsonb('suggested_upgrades').default(sql`'[]'::jsonb`),
    estimatedExpansionValue: decimal('estimated_expansion_value', { precision: 12, scale: 2 }),

    // Risk Assessment
    renewalRisk: platformChurnRiskEnum('renewal_risk'),
    riskFactors: jsonb('risk_factors').default(sql`'[]'::jsonb`),
    strengthFactors: jsonb('strength_factors').default(sql`'[]'::jsonb`),

    // Engagement
    assignedCSM: varchar('assigned_csm'),
    assignedSalesRep: varchar('assigned_sales_rep'),
    lastContactDate: timestamp('last_contact_date'),
    nextContactDate: timestamp('next_contact_date'),
    contactFrequency: varchar('contact_frequency', { length: 50 }), // weekly, biweekly, monthly

    // Action Plan
    actionPlan: text('action_plan'),
    internalNotes: text('internal_notes'),
    competitorThreats: text('competitor_threats'),

    // Outcome
    outcomeNotes: text('outcome_notes'),
    lostReason: text('lost_reason'),
    winReason: text('win_reason'),

    // Related Records
    relatedHealthScoreId: varchar('related_health_score_id').references(
      () => platformHealthScores.id,
    ),
    relatedChurnPredictionId: varchar('related_churn_prediction_id').references(
      () => platformChurnPredictions.id,
    ),
    quoteId: varchar('quote_id'),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    businessRecordIdIdx: index('platform_renewals_record_id_idx').on(table.businessRecordId),
    contractEndDateIdx: index('platform_renewals_contract_end_idx').on(table.contractEndDate),
    renewalStatusIdx: index('platform_renewals_status_idx').on(table.renewalStatus),
  }),
);

// ============================================================================
// PLATFORM SALES GOALS & PERFORMANCE
// ============================================================================

export const platformSalesGoals = pgTable(
  'platform_sales_goals',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    // Goal Details
    goalName: varchar('goal_name', { length: 255 }).notNull(),
    goalType: varchar('goal_type', { length: 50 }).notNull(), // new_tenants, arr_booked, deals_closed, activities, etc.
    metricType: varchar('metric_type', { length: 50 }), // count, revenue, percentage

    // Target
    targetValue: decimal('target_value', { precision: 15, scale: 2 }).notNull(),
    currentValue: decimal('current_value', { precision: 15, scale: 2 }).default('0'),
    achievementPercent: integer('achievement_percent').default(0),

    // Period
    period: varchar('period', { length: 20 }).notNull(), // daily, weekly, monthly, quarterly, yearly
    startDate: timestamp('start_date').notNull(),
    endDate: timestamp('end_date').notNull(),

    // Assignment
    assignedToUserId: varchar('assigned_to_user_id'),
    assignedToTeamId: varchar('assigned_to_team_id'),
    territory: varchar('territory'),

    // Status
    isActive: boolean('is_active').default(true),
    isAchieved: boolean('is_achieved').default(false),
    achievedAt: timestamp('achieved_at'),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    createdBy: varchar('created_by'),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    assignedUserIdx: index('platform_goals_assigned_user_idx').on(table.assignedToUserId),
    periodIdx: index('platform_goals_period_idx').on(table.period, table.startDate),
  }),
);

export const platformActivityReports = pgTable(
  'platform_activity_reports',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    // Report Period
    period: varchar('period', { length: 20 }).notNull(), // daily, weekly, monthly, quarterly
    periodStart: timestamp('period_start').notNull(),
    periodEnd: timestamp('period_end').notNull(),

    // User/Team
    userId: varchar('user_id'),
    teamId: varchar('team_id'),

    // Activity Counts
    totalCalls: integer('total_calls').default(0),
    connectedCalls: integer('connected_calls').default(0),
    totalEmails: integer('total_emails').default(0),
    emailReplies: integer('email_replies').default(0),
    totalMeetings: integer('total_meetings').default(0),
    meetingsHeld: integer('meetings_held').default(0),
    totalDemos: integer('total_demos').default(0),
    demosCompleted: integer('demos_completed').default(0),

    // Prospect & Deal Metrics
    newProspects: integer('new_prospects').default(0),
    qualifiedProspects: integer('qualified_prospects').default(0),
    newDeals: integer('new_deals').default(0),
    dealsWon: integer('deals_won').default(0),
    dealsLost: integer('deals_lost').default(0),
    dealsInProgress: integer('deals_in_progress').default(0),

    // Revenue Metrics
    totalARRBooked: decimal('total_arr_booked', { precision: 12, scale: 2 }).default('0'),
    averageDealSize: decimal('average_deal_size', { precision: 12, scale: 2 }),
    pipelineValue: decimal('pipeline_value', { precision: 12, scale: 2 }).default('0'),

    // Conversion Rates
    callConnectRate: decimal('call_connect_rate', { precision: 5, scale: 2 }),
    emailReplyRate: decimal('email_reply_rate', { precision: 5, scale: 2 }),
    meetingShowRate: decimal('meeting_show_rate', { precision: 5, scale: 2 }),
    demoToTrialRate: decimal('demo_to_trial_rate', { precision: 5, scale: 2 }),
    trialToCustomerRate: decimal('trial_to_customer_rate', { precision: 5, scale: 2 }),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    userPeriodIdx: unique('platform_activity_reports_user_period_idx').on(
      table.userId,
      table.period,
      table.periodStart,
    ),
    periodIdx: index('platform_activity_reports_period_idx').on(table.period, table.periodStart),
  }),
);

// ============================================================================
// PLATFORM ANALYTICS
// ============================================================================

export const platformCohortAnalysis = pgTable(
  'platform_cohort_analysis',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    // Cohort Definition
    cohortName: varchar('cohort_name', { length: 255 }).notNull(),
    cohortPeriod: varchar('cohort_period', { length: 20 }), // monthly, quarterly, yearly
    cohortDate: timestamp('cohort_date').notNull(), // Start date of cohort

    // Cohort Size
    initialSize: integer('initial_size').notNull(),
    currentSize: integer('current_size').notNull(),
    retentionRate: decimal('retention_rate', { precision: 5, scale: 2 }),

    // Revenue Metrics
    initialMRR: decimal('initial_mrr', { precision: 12, scale: 2 }),
    currentMRR: decimal('current_mrr', { precision: 12, scale: 2 }),
    cumulativeRevenue: decimal('cumulative_revenue', { precision: 15, scale: 2 }),
    averageLTV: decimal('average_ltv', { precision: 12, scale: 2 }),

    // Acquisition Metrics
    averageCAC: decimal('average_cac', { precision: 10, scale: 2 }),
    ltvToCacRatio: decimal('ltv_to_cac_ratio', { precision: 5, scale: 2 }),

    // Churn Metrics
    churnedCount: integer('churned_count').default(0),
    churnRate: decimal('churn_rate', { precision: 5, scale: 2 }),
    averageTenureMonths: decimal('average_tenure_months', { precision: 5, scale: 2 }),

    // Expansion
    expandedCount: integer('expanded_count').default(0),
    expansionMRR: decimal('expansion_mrr', { precision: 12, scale: 2 }),
    netRevenueRetention: decimal('net_revenue_retention', { precision: 5, scale: 2 }),

    // Cohort Characteristics
    leadSource: jsonb('lead_source').default(sql`'{}'::jsonb`),
    industryBreakdown: jsonb('industry_breakdown').default(sql`'{}'::jsonb`),
    companySizeBreakdown: jsonb('company_size_breakdown').default(sql`'{}'::jsonb`),

    // Calculation Details
    calculatedAt: timestamp('calculated_at').defaultNow(),
    periodsCovered: integer('periods_covered'), // Number of periods since cohort start

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    cohortDateIdx: index('platform_cohort_analysis_date_idx').on(table.cohortDate),
  }),
);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type PlatformBusinessRecord = typeof platformBusinessRecords.$inferSelect;
export type NewPlatformBusinessRecord = typeof platformBusinessRecords.$inferInsert;

export type PlatformContact = typeof platformContacts.$inferSelect;
export type NewPlatformContact = typeof platformContacts.$inferInsert;

export type PlatformDeal = typeof platformDeals.$inferSelect;
export type NewPlatformDeal = typeof platformDeals.$inferInsert;

export type PlatformActivity = typeof platformActivities.$inferSelect;
export type NewPlatformActivity = typeof platformActivities.$inferInsert;

export type PlatformLeadScoringRule = typeof platformLeadScoringRules.$inferSelect;
export type NewPlatformLeadScoringRule = typeof platformLeadScoringRules.$inferInsert;

export type PlatformLeadScoreCalculation = typeof platformLeadScoreCalculations.$inferSelect;
export type NewPlatformLeadScoreCalculation = typeof platformLeadScoreCalculations.$inferInsert;

export type PlatformBantQualification = typeof platformBantQualification.$inferSelect;
export type NewPlatformBantQualification = typeof platformBantQualification.$inferInsert;

export type PlatformSalesTerritory = typeof platformSalesTerritories.$inferSelect;
export type NewPlatformSalesTerritory = typeof platformSalesTerritories.$inferInsert;

export type PlatformLeadAssignmentRule = typeof platformLeadAssignmentRules.$inferSelect;
export type NewPlatformLeadAssignmentRule = typeof platformLeadAssignmentRules.$inferInsert;

export type PlatformRepCapacity = typeof platformRepCapacity.$inferSelect;
export type NewPlatformRepCapacity = typeof platformRepCapacity.$inferInsert;

export type PlatformLeadAssignmentHistory = typeof platformLeadAssignmentHistory.$inferSelect;
export type NewPlatformLeadAssignmentHistory = typeof platformLeadAssignmentHistory.$inferInsert;

export type PlatformHealthScore = typeof platformHealthScores.$inferSelect;
export type NewPlatformHealthScore = typeof platformHealthScores.$inferInsert;

export type PlatformChurnPrediction = typeof platformChurnPredictions.$inferSelect;
export type NewPlatformChurnPrediction = typeof platformChurnPredictions.$inferInsert;

export type PlatformSuccessIntervention = typeof platformSuccessInterventions.$inferSelect;
export type NewPlatformSuccessIntervention = typeof platformSuccessInterventions.$inferInsert;

export type PlatformRenewalOpportunity = typeof platformRenewalOpportunities.$inferSelect;
export type NewPlatformRenewalOpportunity = typeof platformRenewalOpportunities.$inferInsert;

export type PlatformSalesGoal = typeof platformSalesGoals.$inferSelect;
export type NewPlatformSalesGoal = typeof platformSalesGoals.$inferInsert;

export type PlatformActivityReport = typeof platformActivityReports.$inferSelect;
export type NewPlatformActivityReport = typeof platformActivityReports.$inferInsert;

export type PlatformCohortAnalysis = typeof platformCohortAnalysis.$inferSelect;
export type NewPlatformCohortAnalysis = typeof platformCohortAnalysis.$inferInsert;
