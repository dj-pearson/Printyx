import {
  pgTable,
  varchar,
  integer,
  decimal,
  boolean,
  timestamp,
  jsonb,
  text,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// ==================== Enums ====================

export const deviceTypeEnum = pgEnum('calculator_device_type', [
  'desktop_printer',
  'copier',
  'mfp',
  'production_printer',
]);

export const fleetAgeEnum = pgEnum('calculator_fleet_age', [
  'under_2_years',
  '2_4_years',
  '5_7_years',
  '8_plus_years',
]);

export const industryTypeEnum = pgEnum('calculator_industry_type', [
  'healthcare',
  'legal',
  'education',
  'financial_services',
  'manufacturing',
  'retail',
  'government',
  'technology',
  'professional_services',
  'non_profit',
  'other',
]);

export const painPointEnum = pgEnum('calculator_pain_point', [
  'high_costs',
  'frequent_breakdowns',
  'supply_management',
  'lack_of_visibility',
]);

export const userRoleEnum = pgEnum('calculator_user_role', [
  'it_manager',
  'office_manager',
  'copier_dealer',
  'owner',
  'other',
]);

export const emailSequenceStatusEnum = pgEnum('email_sequence_status', [
  'pending',
  'sent',
  'opened',
  'clicked',
  'bounced',
  'failed',
]);

// ==================== Calculator Sessions ====================
// Track each calculator usage session with complete input data
export const calculatorSessions = pgTable(
  'calculator_sessions',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sessionKey: varchar('session_key').notNull().unique(), // Public-facing session ID

    // User Context (optional until email capture)
    leadId: varchar('lead_id'), // References calculator_leads.id when email captured
    visitorId: varchar('visitor_id'), // Anonymous tracking ID

    // Fleet Information (Section 1)
    deviceCount: integer('device_count').notNull(),
    deviceTypes: jsonb('device_types').notNull().$type<string[]>(), // Array of device types
    fleetAge: varchar('fleet_age').notNull(), // Uses fleetAgeEnum values
    monthlyPageVolume: integer('monthly_page_volume').notNull(),
    colorRatio: decimal('color_ratio', { precision: 5, scale: 2 }).notNull(), // 0-100 percentage

    // Current Costs (Section 2 - optional)
    monthlySupplieCost: decimal('monthly_supplie_cost', { precision: 10, scale: 2 }),
    monthlyServiceCost: decimal('monthly_service_cost', { precision: 10, scale: 2 }),
    monthlyDowntimeHours: decimal('monthly_downtime_hours', { precision: 6, scale: 2 }),
    monthlyEnergyCost: decimal('monthly_energy_cost', { precision: 10, scale: 2 }),

    // Business Context (Section 3)
    employeeCount: integer('employee_count').notNull(),
    industry: varchar('industry').notNull(), // Uses industryTypeEnum values
    painPoints: jsonb('pain_points').notNull().$type<string[]>(), // Array of pain points

    // Calculated Results (stored for quick retrieval)
    calculatedResults: jsonb('calculated_results').notNull().$type<{
      costPerPageBW: number;
      costPerPageColor: number;
      annualTCO: number;
      hiddenCosts: {
        supplyWaste: number;
        laborCost: number;
        downtimeCost: number;
        energyCost: number;
        serviceFrequency: number;
      };
      benchmarking: {
        industryAverageCostPerPage: number;
        percentageAboveIndustry: number;
        costPerEmployee: number;
        industryAverageCostPerEmployee: number;
        utilizationScore: number;
      };
      savingsOpportunities: {
        consolidation: number;
        upgradeEquipment: number;
        printPolicies: number;
        supplyManagement: number;
        managedPrintServices: number;
        total: number;
      };
    }>(),

    // Completion & Email Capture
    isCompleted: boolean('is_completed').default(false),
    hasEmailCapture: boolean('has_email_capture').default(false),
    pdfDownloaded: boolean('pdf_downloaded').default(false),

    // Analytics
    completionTimeSeconds: integer('completion_time_seconds'),
    sourceUrl: text('source_url'),
    utmSource: varchar('utm_source'),
    utmMedium: varchar('utm_medium'),
    utmCampaign: varchar('utm_campaign'),
    referrer: text('referrer'),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    completedAt: timestamp('completed_at'),
    emailCapturedAt: timestamp('email_captured_at'),
  },
  (table) => ({
    sessionKeyIdx: index('calculator_sessions_session_key_idx').on(table.sessionKey),
    leadIdIdx: index('calculator_sessions_lead_id_idx').on(table.leadId),
    visitorIdIdx: index('calculator_sessions_visitor_id_idx').on(table.visitorId),
    createdAtIdx: index('calculator_sessions_created_at_idx').on(table.createdAt),
    industryIdx: index('calculator_sessions_industry_idx').on(table.industry),
    completedIdx: index('calculator_sessions_completed_idx').on(table.isCompleted),
    emailCaptureIdx: index('calculator_sessions_email_capture_idx').on(table.hasEmailCapture),
  }),
);

// ==================== Calculator Leads ====================
// Captured contact information from email capture form
export const calculatorLeads = pgTable(
  'calculator_leads',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    // Contact Information
    email: varchar('email').notNull(),
    companyName: varchar('company_name').notNull(),
    fullName: varchar('full_name'),
    phone: varchar('phone'),
    role: varchar('role').notNull(), // Uses userRoleEnum values

    // Preferences
    wantsQuarterlyUpdates: boolean('wants_quarterly_updates').default(false),
    isDealerAccount: boolean('is_dealer_account').default(false),

    // Lead Status
    isQualified: boolean('is_qualified').default(false),
    hasBookedDemo: boolean('has_booked_demo').default(false),
    hasStartedTrial: boolean('has_started_trial').default(false),
    hasConvertedToPaid: boolean('has_converted_to_paid').default(false),

    // Linked Sessions (one lead can have multiple calculator sessions)
    sessionCount: integer('session_count').default(1),
    firstSessionId: varchar('first_session_id'),

    // Lead Scoring
    leadScore: integer('lead_score').default(0),
    leadTemperature: varchar('lead_temperature'), // hot, warm, cold

    // Campaign Attribution
    utmSource: varchar('utm_source'),
    utmMedium: varchar('utm_medium'),
    utmCampaign: varchar('utm_campaign'),

    // Email Sequence
    emailSequenceStarted: boolean('email_sequence_started').default(false),
    emailSequenceDay: integer('email_sequence_day').default(0), // Track which day (0-7)
    emailSequenceOptOut: boolean('email_sequence_opt_out').default(false),

    // Notes & Tags
    notes: text('notes'),
    tags: jsonb('tags').$type<string[]>(),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    lastContactedAt: timestamp('last_contacted_at'),
    demoBookedAt: timestamp('demo_booked_at'),
    trialStartedAt: timestamp('trial_started_at'),
    convertedAt: timestamp('converted_at'),
  },
  (table) => ({
    emailIdx: index('calculator_leads_email_idx').on(table.email),
    roleIdx: index('calculator_leads_role_idx').on(table.role),
    isDealerIdx: index('calculator_leads_is_dealer_idx').on(table.isDealerAccount),
    leadScoreIdx: index('calculator_leads_lead_score_idx').on(table.leadScore),
    qualifiedIdx: index('calculator_leads_qualified_idx').on(table.isQualified),
    sequenceIdx: index('calculator_leads_sequence_idx').on(
      table.emailSequenceStarted,
      table.emailSequenceDay,
    ),
    createdAtIdx: index('calculator_leads_created_at_idx').on(table.createdAt),
  }),
);

// ==================== Email Sequence Tracking ====================
// Track individual emails sent in the nurture sequence
export const emailSequenceTracking = pgTable(
  'email_sequence_tracking',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    leadId: varchar('lead_id').notNull(), // References calculator_leads.id

    // Email Details
    sequenceDay: integer('sequence_day').notNull(), // 0 (immediate), 1, 2, 3, 5, 6, 7
    emailSubject: text('email_subject').notNull(),
    emailTemplate: varchar('email_template').notNull(), // Template identifier

    // Delivery Status
    status: varchar('status').notNull().default('pending'), // Uses emailSequenceStatusEnum

    // Engagement Metrics
    sentAt: timestamp('sent_at'),
    openedAt: timestamp('opened_at'),
    clickedAt: timestamp('clicked_at'),
    clickCount: integer('click_count').default(0),
    linksClicked: jsonb('links_clicked').$type<string[]>(), // Array of clicked URLs

    // Delivery Details
    emailProvider: varchar('email_provider'), // resend, sendgrid, etc.
    messageId: varchar('message_id'), // Provider's message ID
    errorMessage: text('error_message'),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    scheduledFor: timestamp('scheduled_for'),
  },
  (table) => ({
    leadIdIdx: index('email_sequence_tracking_lead_id_idx').on(table.leadId),
    sequenceDayIdx: index('email_sequence_tracking_sequence_day_idx').on(table.sequenceDay),
    statusIdx: index('email_sequence_tracking_status_idx').on(table.status),
    scheduledForIdx: index('email_sequence_tracking_scheduled_for_idx').on(table.scheduledFor),
    sentAtIdx: index('email_sequence_tracking_sent_at_idx').on(table.sentAt),
    leadSequenceIdx: index('email_sequence_tracking_lead_sequence_idx').on(
      table.leadId,
      table.sequenceDay,
    ),
  }),
);

// ==================== Industry Benchmarks ====================
// Pre-populated industry benchmark data for comparisons
export const industryBenchmarks = pgTable(
  'industry_benchmarks',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    // Industry & Context
    industry: varchar('industry').notNull(), // Uses industryTypeEnum values
    companySize: varchar('company_size').notNull(), // small (1-50), medium (51-250), large (251-1000), enterprise (1000+)

    // Cost Benchmarks
    avgCostPerPageBW: decimal('avg_cost_per_page_bw', { precision: 6, scale: 4 }).notNull(),
    avgCostPerPageColor: decimal('avg_cost_per_page_color', { precision: 6, scale: 4 }).notNull(),
    avgCostPerEmployee: decimal('avg_cost_per_employee', { precision: 10, scale: 2 }).notNull(),
    avgDevicePerEmployee: decimal('avg_device_per_employee', { precision: 4, scale: 2 }).notNull(),

    // Performance Benchmarks
    avgUtilizationRate: decimal('avg_utilization_rate', { precision: 5, scale: 2 }).notNull(), // Percentage
    avgDowntimeHoursPerMonth: decimal('avg_downtime_hours_per_month', {
      precision: 6,
      scale: 2,
    }).notNull(),
    avgServiceCallsPerDevice: decimal('avg_service_calls_per_device', {
      precision: 4,
      scale: 2,
    }).notNull(),

    // Cost Distribution (percentages)
    suppliesCostPercent: decimal('supplies_cost_percent', { precision: 5, scale: 2 }).notNull(),
    serviceCostPercent: decimal('service_cost_percent', { precision: 5, scale: 2 }).notNull(),
    energyCostPercent: decimal('energy_cost_percent', { precision: 5, scale: 2 }).notNull(),
    laborCostPercent: decimal('labor_cost_percent', { precision: 5, scale: 2 }).notNull(),
    downtimeCostPercent: decimal('downtime_cost_percent', { precision: 5, scale: 2 }).notNull(),

    // Data Source
    dataSource: varchar('data_source'), // "industry_report_2024", "printyx_customer_average", etc.
    sampleSize: integer('sample_size'),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    industryIdx: index('industry_benchmarks_industry_idx').on(table.industry),
    companySizeIdx: index('industry_benchmarks_company_size_idx').on(table.companySize),
    industryCompanySizeIdx: index('industry_benchmarks_industry_company_size_idx').on(
      table.industry,
      table.companySize,
    ),
  }),
);

// ==================== Calculator Analytics Events ====================
// Track detailed user interactions for optimization
export const calculatorAnalyticsEvents = pgTable(
  'calculator_analytics_events',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sessionId: varchar('session_id').notNull(), // References calculator_sessions.id
    visitorId: varchar('visitor_id'),

    // Event Details
    eventType: varchar('event_type').notNull(), // page_view, input_change, section_complete, result_view, email_capture, pdf_download, cta_click, etc.
    eventCategory: varchar('event_category').notNull(), // engagement, conversion, navigation
    eventData: jsonb('event_data').$type<Record<string, any>>(), // Flexible data storage

    // User Context
    userAgent: text('user_agent'),
    ipAddress: varchar('ip_address'),
    deviceType: varchar('device_type'), // mobile, tablet, desktop

    // Timestamps
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    sessionIdIdx: index('calculator_analytics_events_session_id_idx').on(table.sessionId),
    visitorIdIdx: index('calculator_analytics_events_visitor_id_idx').on(table.visitorId),
    eventTypeIdx: index('calculator_analytics_events_event_type_idx').on(table.eventType),
    createdAtIdx: index('calculator_analytics_events_created_at_idx').on(table.createdAt),
    sessionEventIdx: index('calculator_analytics_events_session_event_idx').on(
      table.sessionId,
      table.eventType,
    ),
  }),
);

// ==================== Insert Schemas (Zod Validation) ====================

export const insertCalculatorSessionSchema = createInsertSchema(calculatorSessions, {
  deviceCount: z.number().int().min(1).max(500),
  monthlyPageVolume: z.number().int().min(0).max(10000000),
  colorRatio: z.number().min(0).max(100),
  employeeCount: z.number().int().min(1).max(100000),
  email: z.string().email().optional(),
});

export const insertCalculatorLeadSchema = createInsertSchema(calculatorLeads, {
  email: z.string().email(),
  companyName: z.string().min(1),
  role: z.string().min(1),
});

export const insertEmailSequenceTrackingSchema = createInsertSchema(emailSequenceTracking, {
  sequenceDay: z.number().int().min(0).max(7),
});

export const insertIndustryBenchmarkSchema = createInsertSchema(industryBenchmarks);

export const insertCalculatorAnalyticsEventSchema = createInsertSchema(calculatorAnalyticsEvents);

// ==================== TypeScript Types ====================

export type CalculatorSession = typeof calculatorSessions.$inferSelect;
export type InsertCalculatorSession = z.infer<typeof insertCalculatorSessionSchema>;

export type CalculatorLead = typeof calculatorLeads.$inferSelect;
export type InsertCalculatorLead = z.infer<typeof insertCalculatorLeadSchema>;

export type EmailSequenceTracking = typeof emailSequenceTracking.$inferSelect;
export type InsertEmailSequenceTracking = z.infer<typeof insertEmailSequenceTrackingSchema>;

export type IndustryBenchmark = typeof industryBenchmarks.$inferSelect;
export type InsertIndustryBenchmark = z.infer<typeof insertIndustryBenchmarkSchema>;

export type CalculatorAnalyticsEvent = typeof calculatorAnalyticsEvents.$inferSelect;
export type InsertCalculatorAnalyticsEvent = z.infer<typeof insertCalculatorAnalyticsEventSchema>;
