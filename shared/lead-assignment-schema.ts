import {
  pgTable,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  text,
  index,
  decimal,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// ==================== Territory Management ====================

export const salesTerritories = pgTable(
  'sales_territories',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),

    // Territory Details
    territoryName: varchar('territory_name', { length: 255 }).notNull(),
    territoryCode: varchar('territory_code', { length: 50 }),
    description: text('description'),

    // Territory Type
    territoryType: varchar('territory_type', { length: 50 }).notNull(), // geographic, industry, account_size, product_line, named_accounts

    // Geographic Boundaries (if applicable)
    geographicRules: jsonb('geographic_rules').$type<{
      countries?: string[];
      states?: string[];
      cities?: string[];
      zipCodes?: string[];
      radius?: { lat: number; lng: number; miles: number };
    }>(),

    // Account-Based Rules
    accountRules: jsonb('account_rules').$type<{
      industries?: string[];
      companySizeMin?: number;
      companySizeMax?: number;
      revenueMin?: number;
      revenueMax?: number;
      accountTiers?: string[];
    }>(),

    // Product/Solution Focus
    productFocus: text('product_focus').array(), // e.g., ['copiers', 'managed_print', 'production_equipment']

    // Territory Status
    isActive: boolean('is_active').notNull().default(true),
    priority: integer('priority').default(0), // Higher priority territories checked first

    // Ownership
    ownerId: varchar('owner_id'), // Primary sales rep
    teamMembers: text('team_members').array(), // Additional team member IDs
    managerId: varchar('manager_id'),

    // Performance Metrics
    monthlyQuota: decimal('monthly_quota', { precision: 12, scale: 2 }),
    currentPipeline: decimal('current_pipeline', { precision: 12, scale: 2 }).default('0'),
    activeLeadsCount: integer('active_leads_count').default(0),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('sales_territories_tenant_idx').on(table.tenantId),
    tenantActiveIdx: index('sales_territories_tenant_active_idx').on(
      table.tenantId,
      table.isActive,
    ),
    ownerIdx: index('sales_territories_owner_idx').on(table.ownerId),
  }),
);

// ==================== Lead Assignment Rules ====================

export const leadAssignmentRules = pgTable(
  'lead_assignment_rules',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),

    // Rule Identification
    ruleName: varchar('rule_name', { length: 255 }).notNull(),
    description: text('description'),

    // Assignment Strategy
    assignmentType: varchar('assignment_type', { length: 50 }).notNull(), // territory, round_robin, skill_based, workload_balanced, manual

    // Matching Criteria
    criteria: jsonb('criteria')
      .$type<{
        leadSource?: string[];
        leadScore?: { min?: number; max?: number };
        industry?: string[];
        companySize?: { min?: number; max?: number };
        dealSize?: { min?: number; max?: number };
        geography?: {
          countries?: string[];
          states?: string[];
          cities?: string[];
          zipCodes?: string[];
        };
        productInterest?: string[];
        customFields?: Record<string, any>;
      }>()
      .notNull(),

    // Assignment Target
    territoryId: varchar('territory_id'), // If territory-based
    assignToUserId: varchar('assign_to_user_id'), // If direct assignment
    assignToTeam: varchar('assign_to_team'), // If team-based

    // Round-Robin Configuration
    roundRobinConfig: jsonb('round_robin_config').$type<{
      userIds: string[];
      currentIndex: number;
      skipUnavailable: boolean;
      respectCapacity: boolean;
    }>(),

    // Capacity & Workload Rules
    respectCapacityLimits: boolean('respect_capacity_limits').default(true),
    maxLeadsPerRep: integer('max_leads_per_rep'),
    maxLeadsPerDay: integer('max_leads_per_day'),

    // Timing & SLA
    assignImmediately: boolean('assign_immediately').default(true),
    delayMinutes: integer('delay_minutes').default(0),
    businessHoursOnly: boolean('business_hours_only').default(false),

    // Escalation Rules
    escalationEnabled: boolean('escalation_enabled').default(false),
    escalateAfterMinutes: integer('escalate_after_minutes').default(60),
    escalateToUserId: varchar('escalate_to_user_id'),

    // Rule Priority & Status
    priority: integer('priority').notNull().default(0), // Higher priority = evaluated first
    isActive: boolean('is_active').notNull().default(true),

    // Performance Tracking
    assignmentsCount: integer('assignments_count').default(0),
    lastAssignedAt: timestamp('last_assigned_at'),

    createdBy: varchar('created_by'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('lead_assignment_rules_tenant_idx').on(table.tenantId),
    tenantActiveIdx: index('lead_assignment_rules_tenant_active_idx').on(
      table.tenantId,
      table.isActive,
    ),
    priorityIdx: index('lead_assignment_rules_priority_idx').on(table.priority),
    territoryIdx: index('lead_assignment_rules_territory_idx').on(table.territoryId),
  }),
);

// ==================== Rep Capacity & Availability ====================

export const repCapacity = pgTable(
  'rep_capacity',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    userId: varchar('user_id').notNull(),

    // Capacity Limits
    maxActiveLeads: integer('max_active_leads').default(50),
    maxNewLeadsPerDay: integer('max_new_leads_per_day').default(10),
    maxNewLeadsPerWeek: integer('max_new_leads_per_week').default(30),

    // Current Load
    currentActiveLeads: integer('current_active_leads').default(0),
    leadsAssignedToday: integer('leads_assigned_today').default(0),
    leadsAssignedThisWeek: integer('leads_assigned_this_week').default(0),

    // Availability Status
    isAvailable: boolean('is_available').default(true),
    unavailableReason: varchar('unavailable_reason', { length: 100 }), // vacation, training, overloaded, other
    unavailableUntil: timestamp('unavailable_until'),

    // Skills & Specializations
    skills: text('skills').array(), // e.g., ['canon_expert', 'large_deals', 'healthcare_vertical']
    certifications: text('certifications').array(),
    languages: text('languages').array(),

    // Performance Metrics
    averageResponseTimeMinutes: integer('average_response_time_minutes'),
    conversionRate: decimal('conversion_rate', { precision: 5, scale: 2 }), // Percentage
    averageDealSize: decimal('average_deal_size', { precision: 12, scale: 2 }),

    // Working Hours
    workingHours: jsonb('working_hours').$type<{
      timezone: string;
      schedule: {
        monday?: { start: string; end: string };
        tuesday?: { start: string; end: string };
        wednesday?: { start: string; end: string };
        thursday?: { start: string; end: string };
        friday?: { start: string; end: string };
        saturday?: { start: string; end: string };
        sunday?: { start: string; end: string };
      };
    }>(),

    lastResetAt: timestamp('last_reset_at').defaultNow(), // For daily/weekly counters
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantUserIdx: index('rep_capacity_tenant_user_idx').on(table.tenantId, table.userId),
    userIdx: index('rep_capacity_user_idx').on(table.userId),
    availableIdx: index('rep_capacity_available_idx').on(table.isAvailable),
  }),
);

// ==================== Lead Assignment History ====================

export const leadAssignmentHistory = pgTable(
  'lead_assignment_history',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    leadId: varchar('lead_id').notNull(),

    // Assignment Details
    assignedFrom: varchar('assigned_from'), // Previous owner (null for initial assignment)
    assignedTo: varchar('assigned_to').notNull(), // New owner
    assignmentReason: varchar('assignment_reason', { length: 100 }).notNull(), // auto_rule, manual_override, round_robin, escalation, territory_change
    ruleId: varchar('rule_id'), // If assigned by rule

    // Context
    assignedBy: varchar('assigned_by'), // User who triggered (or 'system')
    assignmentNotes: text('assignment_notes'),

    // Response Tracking
    firstResponseAt: timestamp('first_response_at'),
    firstResponseTimeMinutes: integer('first_response_time_minutes'),
    acceptedAt: timestamp('accepted_at'),
    rejectedAt: timestamp('rejected_at'),
    rejectionReason: text('rejection_reason'),

    // Metadata
    assignedAt: timestamp('assigned_at').notNull().defaultNow(),
  },
  (table) => ({
    leadIdx: index('lead_assignment_history_lead_idx').on(table.leadId),
    tenantLeadIdx: index('lead_assignment_history_tenant_lead_idx').on(
      table.tenantId,
      table.leadId,
    ),
    assignedToIdx: index('lead_assignment_history_assigned_to_idx').on(table.assignedTo),
    assignedAtIdx: index('lead_assignment_history_assigned_at_idx').on(table.assignedAt),
  }),
);

// ==================== Assignment Queue ====================
// For delayed assignments and workload balancing

export const leadAssignmentQueue = pgTable(
  'lead_assignment_queue',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    leadId: varchar('lead_id').notNull(),

    // Queue Status
    status: varchar('status', { length: 50 }).notNull().default('pending'), // pending, processing, assigned, failed
    priority: integer('priority').default(0), // Higher = process first

    // Assignment Details
    targetUserId: varchar('target_user_id'), // Pre-determined assignee
    ruleId: varchar('rule_id'), // Rule to apply

    // Timing
    scheduleFor: timestamp('schedule_for'), // When to process
    processedAt: timestamp('processed_at'),
    assignedAt: timestamp('assigned_at'),

    // Error Handling
    attemptCount: integer('attempt_count').default(0),
    lastError: text('last_error'),
    maxAttempts: integer('max_attempts').default(3),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantStatusIdx: index('lead_assignment_queue_tenant_status_idx').on(
      table.tenantId,
      table.status,
    ),
    leadIdx: index('lead_assignment_queue_lead_idx').on(table.leadId),
    scheduleIdx: index('lead_assignment_queue_schedule_idx').on(table.scheduleFor),
    priorityIdx: index('lead_assignment_queue_priority_idx').on(table.priority),
  }),
);

// ==================== Zod Schemas ====================

export const insertSalesTerritorySchema = createInsertSchema(salesTerritories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeadAssignmentRuleSchema = createInsertSchema(leadAssignmentRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRepCapacitySchema = createInsertSchema(repCapacity).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeadAssignmentHistorySchema = createInsertSchema(leadAssignmentHistory).omit({
  id: true,
  assignedAt: true,
});

export const insertLeadAssignmentQueueSchema = createInsertSchema(leadAssignmentQueue).omit({
  id: true,
  createdAt: true,
});

// ==================== Type Exports ====================

export type SalesTerritory = typeof salesTerritories.$inferSelect;
export type InsertSalesTerritory = z.infer<typeof insertSalesTerritorySchema>;

export type LeadAssignmentRule = typeof leadAssignmentRules.$inferSelect;
export type InsertLeadAssignmentRule = z.infer<typeof insertLeadAssignmentRuleSchema>;

export type RepCapacity = typeof repCapacity.$inferSelect;
export type InsertRepCapacity = z.infer<typeof insertRepCapacitySchema>;

export type LeadAssignmentHistory = typeof leadAssignmentHistory.$inferSelect;
export type InsertLeadAssignmentHistory = z.infer<typeof insertLeadAssignmentHistorySchema>;

export type LeadAssignmentQueue = typeof leadAssignmentQueue.$inferSelect;
export type InsertLeadAssignmentQueue = z.infer<typeof insertLeadAssignmentQueueSchema>;
