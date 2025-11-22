import { pgTable, varchar, integer, boolean, timestamp, jsonb, text, index, decimal } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// ==================== Sales Handoff Checklists ====================

export const salesHandoffChecklists = pgTable('sales_handoff_checklists', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id').notNull(),
  customerId: varchar('customer_id').notNull(),
  opportunityId: varchar('opportunity_id'),
  contractId: varchar('contract_id'),

  // Handoff Status
  status: varchar('status', { length: 50 }).notNull().default('pending'), // pending, in_progress, completed, blocked
  handoffType: varchar('handoff_type', { length: 50 }).notNull(), // new_customer, expansion, renewal, migration

  // Ownership
  salesRepId: varchar('sales_rep_id').notNull(),
  salesRepName: varchar('sales_rep_name'),
  implementationOwnerId: varchar('implementation_owner_id'),
  csmId: varchar('csm_id'), // Customer Success Manager
  installationTechId: varchar('installation_tech_id'),

  // Critical Information
  accountProfile: jsonb('account_profile').$type<{
    primaryContact: {
      name: string;
      title: string;
      email: string;
      phone: string;
      preferredContactMethod: string;
    };
    decisionMakers: Array<{
      name: string;
      title: string;
      role: string;
      influence: string;
    }>;
    companyInfo: {
      industry: string;
      employeeCount: number;
      currentEquipment?: string[];
      painPoints?: string[];
    };
  }>(),

  // Customer Expectations
  customerExpectations: jsonb('customer_expectations').$type<{
    expectedGoLiveDate?: string;
    keySuccessMetrics?: string[];
    businessObjectives?: string[];
    criticalDeadlines?: Array<{ description: string; date: string }>;
    specialRequirements?: string[];
  }>(),

  // Contract Details
  contractSummary: jsonb('contract_summary').$type<{
    contractValue: number;
    term: number; // months
    billingFrequency: string;
    paymentTerms: string;
    autoRenewal: boolean;
    specialTerms?: string[];
  }>(),

  // Equipment & Services
  equipmentDetails: jsonb('equipment_details').$type<Array<{
    productId: string;
    productName: string;
    quantity: number;
    serialNumbers?: string[];
    installLocation: string;
    installRequirements?: string[];
  }>>(),

  servicesIncluded: jsonb('services_included').$type<Array<{
    serviceType: string;
    description: string;
    frequency?: string;
    slaCommitments?: string[];
  }>>(),

  // Technical Requirements
  technicalRequirements: jsonb('technical_requirements').$type<{
    networkRequirements?: string[];
    powerRequirements?: string[];
    spaceRequirements?: string[];
    accessRequirements?: string[];
    integrations?: Array<{ system: string; type: string }>;
  }>(),

  // Installation Details
  installationPlanning: jsonb('installation_planning').$type<{
    siteAddress: string;
    siteSurveyCompleted: boolean;
    siteSurveyDate?: string;
    preferredInstallDate?: string;
    installTimeWindow?: string;
    siteContact: { name: string; phone: string };
    accessInstructions?: string;
  }>(),

  // Training & Support
  trainingRequirements: jsonb('training_requirements').$type<{
    trainingType: string[]; // onsite, remote, self_paced
    numberOfUsers: number;
    userRoles: string[];
    preferredTrainingDates?: string[];
    specialNeeds?: string[];
  }>(),

  // Billing Setup
  billingInformation: jsonb('billing_information').$type<{
    billingContact: {
      name: string;
      email: string;
      phone: string;
    };
    billingAddress: {
      street: string;
      city: string;
      state: string;
      zip: string;
      country: string;
    };
    paymentMethod: string;
    poRequired: boolean;
    taxExempt: boolean;
  }>(),

  // Sales Notes & Context
  salesNotes: text('sales_notes'),
  competitiveInfo: text('competitive_info'),
  dealStory: text('deal_story'), // Why they bought, key selling points
  riskFactors: text('risk_factors').array(),
  opportunityForUpsell: text('opportunity_for_upsell').array(),

  // Handoff Meeting
  handoffMeetingScheduled: boolean('handoff_meeting_scheduled').default(false),
  handoffMeetingDate: timestamp('handoff_meeting_date'),
  handoffMeetingNotes: text('handoff_meeting_notes'),
  attendees: text('attendees').array(),

  // Completion Tracking
  completionPercentage: integer('completion_percentage').default(0),
  requiredFieldsComplete: boolean('required_fields_complete').default(false),
  readyForImplementation: boolean('ready_for_implementation').default(false),

  // Timestamps
  initiatedAt: timestamp('initiated_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  targetCompletionDate: timestamp('target_completion_date'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index('sales_handoff_tenant_idx').on(table.tenantId),
  customerIdx: index('sales_handoff_customer_idx').on(table.customerId),
  statusIdx: index('sales_handoff_status_idx').on(table.status),
  salesRepIdx: index('sales_handoff_sales_rep_idx').on(table.salesRepId),
  csmIdx: index('sales_handoff_csm_idx').on(table.csmId),
}));

// ==================== Handoff Task Templates ====================

export const handoffTaskTemplates = pgTable('handoff_task_templates', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id').notNull(),

  // Template Details
  templateName: varchar('template_name', { length: 255 }).notNull(),
  handoffType: varchar('handoff_type', { length: 50 }).notNull(), // new_customer, expansion, renewal
  description: text('description'),

  // Task Configuration
  tasks: jsonb('tasks').$type<Array<{
    taskName: string;
    description: string;
    assignToRole: string; // sales_rep, csm, implementation, billing, tech
    category: string; // account_setup, technical, training, billing, documentation
    isRequired: boolean;
    orderIndex: number;
    dueInDays: number; // Days from handoff initiation
    dependencies?: string[]; // Task names that must complete first
    automationTrigger?: string; // Workflow to trigger
  }>>().notNull(),

  // Settings
  isActive: boolean('is_active').default(true),
  isDefault: boolean('is_default').default(false),

  createdBy: varchar('created_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index('handoff_task_templates_tenant_idx').on(table.tenantId),
  typeIdx: index('handoff_task_templates_type_idx').on(table.handoffType),
}));

// ==================== Handoff Tasks ====================

export const handoffTasks = pgTable('handoff_tasks', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id').notNull(),
  handoffId: varchar('handoff_id').notNull(),

  // Task Details
  taskName: varchar('task_name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 50 }).notNull(),

  // Assignment
  assignedTo: varchar('assigned_to'),
  assignedToRole: varchar('assigned_to_role'),
  assignedAt: timestamp('assigned_at'),

  // Status
  status: varchar('status', { length: 50 }).notNull().default('pending'), // pending, in_progress, completed, blocked, skipped
  isRequired: boolean('is_required').default(true),
  isBlocking: boolean('is_blocking').default(false), // Blocks handoff completion

  // Dependencies
  dependsOn: text('depends_on').array(), // Task IDs that must complete first
  blockedBy: text('blocked_by').array(), // Issues blocking this task

  // Timing
  dueDate: timestamp('due_date'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  completedBy: varchar('completed_by'),

  // Task Data
  taskData: jsonb('task_data'), // Form data or custom fields
  attachments: jsonb('attachments').$type<Array<{
    fileName: string;
    fileUrl: string;
    uploadedBy: string;
    uploadedAt: string;
  }>>(),

  // Notes
  notes: text('notes'),
  completionNotes: text('completion_notes'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  handoffIdx: index('handoff_tasks_handoff_idx').on(table.handoffId),
  tenantHandoffIdx: index('handoff_tasks_tenant_handoff_idx').on(table.tenantId, table.handoffId),
  assignedToIdx: index('handoff_tasks_assigned_to_idx').on(table.assignedTo),
  statusIdx: index('handoff_tasks_status_idx').on(table.status),
  dueDateIdx: index('handoff_tasks_due_date_idx').on(table.dueDate),
}));

// ==================== Implementation Projects ====================

export const implementationProjects = pgTable('implementation_projects', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id').notNull(),
  customerId: varchar('customer_id').notNull(),
  handoffId: varchar('handoff_id'),

  // Project Details
  projectName: varchar('project_name', { length: 255 }).notNull(),
  projectType: varchar('project_type', { length: 50 }).notNull(), // installation, migration, expansion, training
  status: varchar('status', { length: 50 }).notNull().default('planning'), // planning, scheduled, in_progress, completed, on_hold, cancelled

  // Timeline
  plannedStartDate: timestamp('planned_start_date'),
  plannedEndDate: timestamp('planned_end_date'),
  actualStartDate: timestamp('actual_start_date'),
  actualEndDate: timestamp('actual_end_date'),
  goLiveDate: timestamp('go_live_date'),

  // Team
  projectManagerId: varchar('project_manager_id'),
  teamMembers: text('team_members').array(),

  // Milestones
  milestones: jsonb('milestones').$type<Array<{
    name: string;
    description: string;
    dueDate: string;
    completedDate?: string;
    status: string;
    deliverables?: string[];
  }>>(),

  // Progress Tracking
  completionPercentage: integer('completion_percentage').default(0),
  currentPhase: varchar('current_phase', { length: 100 }),

  // Risk Management
  risks: jsonb('risks').$type<Array<{
    description: string;
    severity: string;
    probability: string;
    mitigation: string;
    status: string;
  }>>(),

  issues: jsonb('issues').$type<Array<{
    description: string;
    priority: string;
    assignedTo: string;
    status: string;
    resolution?: string;
  }>>(),

  // Customer Communication
  lastCustomerUpdate: timestamp('last_customer_update'),
  nextCustomerUpdate: timestamp('next_customer_update'),
  customerSatisfaction: integer('customer_satisfaction'), // 1-5 scale

  // Budget (if applicable)
  budgetedHours: decimal('budgeted_hours', { precision: 8, scale: 2 }),
  actualHours: decimal('actual_hours', { precision: 8, scale: 2 }),

  // Notes
  projectNotes: text('project_notes'),
  lessonsLearned: text('lessons_learned'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index('implementation_projects_tenant_idx').on(table.tenantId),
  customerIdx: index('implementation_projects_customer_idx').on(table.customerId),
  statusIdx: index('implementation_projects_status_idx').on(table.status),
  pmIdx: index('implementation_projects_pm_idx').on(table.projectManagerId),
  goLiveDateIdx: index('implementation_projects_go_live_idx').on(table.goLiveDate),
}));

// ==================== Zod Schemas ====================

export const insertSalesHandoffChecklistSchema = createInsertSchema(salesHandoffChecklists).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHandoffTaskTemplateSchema = createInsertSchema(handoffTaskTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHandoffTaskSchema = createInsertSchema(handoffTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertImplementationProjectSchema = createInsertSchema(implementationProjects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ==================== Type Exports ====================

export type SalesHandoffChecklist = typeof salesHandoffChecklists.$inferSelect;
export type InsertSalesHandoffChecklist = z.infer<typeof insertSalesHandoffChecklistSchema>;

export type HandoffTaskTemplate = typeof handoffTaskTemplates.$inferSelect;
export type InsertHandoffTaskTemplate = z.infer<typeof insertHandoffTaskTemplateSchema>;

export type HandoffTask = typeof handoffTasks.$inferSelect;
export type InsertHandoffTask = z.infer<typeof insertHandoffTaskSchema>;

export type ImplementationProject = typeof implementationProjects.$inferSelect;
export type InsertImplementationProject = z.infer<typeof insertImplementationProjectSchema>;
