/**
 * Pipeline Configuration Schema
 * Enables tenant-specific pipeline customization with automation triggers
 */
import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// ==================== Pipeline Templates ====================

export const pipelineTypeEnum = pgEnum('pipeline_type', [
  'new_business',
  'renewals',
  'expansions',
  'upsell',
  'cross_sell',
  'custom',
]);

export const pipelineTemplates = pgTable(
  'pipeline_templates',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),

    // Template Details
    name: varchar('name', { length: 255 }).notNull(),
    pipelineType: pipelineTypeEnum('pipeline_type').notNull(),
    description: text('description'),

    // Configuration
    isActive: boolean('is_active').default(true),
    isDefault: boolean('is_default').default(false),

    // Metadata
    createdBy: varchar('created_by'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    tenantIdx: index('pipeline_templates_tenant_idx').on(table.tenantId),
    tenantActiveIdx: index('pipeline_templates_tenant_active_idx').on(
      table.tenantId,
      table.isActive,
    ),
  }),
);

// ==================== Pipeline Stages (Enhanced) ====================

export const pipelineStages = pgTable(
  'pipeline_stages',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    pipelineTemplateId: varchar('pipeline_template_id').notNull(),

    // Stage Details
    name: varchar('name', { length: 255 }).notNull(),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    description: text('description'),
    color: varchar('color', { length: 7 }).default('#3B82F6'), // Hex color
    icon: varchar('icon', { length: 50 }), // Lucide icon name

    // Order & Behavior
    order: integer('order').notNull(),
    isFinalStage: boolean('is_final_stage').default(false),
    isClosedWon: boolean('is_closed_won').default(false),
    isClosedLost: boolean('is_closed_lost').default(false),

    // Stage Requirements
    requiredFields: jsonb('required_fields').$type<
      Array<{
        fieldName: string;
        fieldLabel: string;
        fieldType: string;
        isRequired: boolean;
        validationRules?: Record<string, any>;
      }>
    >(),

    // SLA Configuration
    slaEnabled: boolean('sla_enabled').default(false),
    slaDays: integer('sla_days'),
    slaHours: integer('sla_hours'),
    slaEscalationEnabled: boolean('sla_escalation_enabled').default(false),
    slaEscalateTo: varchar('sla_escalate_to'), // Role or user ID

    // Automation Triggers
    automationTriggers: jsonb('automation_triggers').$type<
      Array<{
        triggerType: 'on_enter' | 'on_exit' | 'on_sla_breach' | 'on_field_change';
        actionType:
          | 'send_email'
          | 'create_task'
          | 'update_field'
          | 'webhook'
          | 'assign_to'
          | 'notify';
        actionConfig: Record<string, any>;
        isActive: boolean;
      }>
    >(),

    // Probability & Forecasting
    defaultProbability: integer('default_probability').default(50), // 0-100
    includeInForecast: boolean('include_in_forecast').default(true),
    weightedValue: boolean('weighted_value').default(true), // Use probability for weighted pipeline

    // Stage Guidance
    bestPractices: text('best_practices'),
    actionRequired: text('action_required'),
    exitCriteria: text('exit_criteria'),

    // Conversion Metrics (auto-calculated)
    averageDaysInStage: decimal('average_days_in_stage', { precision: 8, scale: 2 }),
    conversionRate: decimal('conversion_rate', { precision: 5, scale: 2 }), // % that move to next stage

    // Settings
    isActive: boolean('is_active').default(true),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    pipelineIdx: index('pipeline_stages_pipeline_idx').on(table.pipelineTemplateId),
    tenantPipelineIdx: index('pipeline_stages_tenant_pipeline_idx').on(
      table.tenantId,
      table.pipelineTemplateId,
    ),
    orderIdx: index('pipeline_stages_order_idx').on(table.order),
  }),
);

// ==================== Stage Transitions (Automation Rules) ====================

export const stageTransitions = pgTable(
  'stage_transitions',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    pipelineTemplateId: varchar('pipeline_template_id').notNull(),

    // Transition Definition
    fromStageId: varchar('from_stage_id').notNull(),
    toStageId: varchar('to_stage_id').notNull(),

    // Transition Rules
    isAutomatic: boolean('is_automatic').default(false),
    automaticConditions: jsonb('automatic_conditions').$type<
      Array<{
        field: string;
        operator: string;
        value: any;
        logicalOperator?: 'AND' | 'OR';
      }>
    >(),

    // Transition Actions
    onTransitionActions: jsonb('on_transition_actions').$type<
      Array<{
        actionType: 'send_email' | 'create_task' | 'update_field' | 'webhook' | 'create_activity';
        actionConfig: Record<string, any>;
      }>
    >(),

    // Validation
    requiresApproval: boolean('requires_approval').default(false),
    approvalRoleId: varchar('approval_role_id'),

    // Settings
    isActive: boolean('is_active').default(true),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    pipelineIdx: index('stage_transitions_pipeline_idx').on(table.pipelineTemplateId),
    fromStageIdx: index('stage_transitions_from_idx').on(table.fromStageId),
    toStageIdx: index('stage_transitions_to_idx').on(table.toStageId),
  }),
);

// ==================== Deal Activities (Enhanced Tracking) ====================

export const dealStageHistory = pgTable(
  'deal_stage_history',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    dealId: varchar('deal_id').notNull(),

    // Stage Change
    fromStageId: varchar('from_stage_id'),
    toStageId: varchar('to_stage_id').notNull(),
    fromStageName: varchar('from_stage_name'),
    toStageName: varchar('to_stage_name').notNull(),

    // Context
    changedBy: varchar('changed_by').notNull(),
    changeReason: text('change_reason'),
    wasAutomatic: boolean('was_automatic').default(false),

    // Timing
    daysInPreviousStage: integer('days_in_previous_stage'),
    enteredAt: timestamp('entered_at').notNull().defaultNow(),

    // Deal State at Time of Change
    dealValue: decimal('deal_value', { precision: 15, scale: 2 }),
    probability: integer('probability'),
    expectedCloseDate: timestamp('expected_close_date'),

    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    dealIdx: index('deal_stage_history_deal_idx').on(table.dealId),
    tenantDealIdx: index('deal_stage_history_tenant_deal_idx').on(table.tenantId, table.dealId),
    enteredAtIdx: index('deal_stage_history_entered_at_idx').on(table.enteredAt),
  }),
);

// ==================== Pipeline Automation Logs ====================

export const pipelineAutomationLogs = pgTable(
  'pipeline_automation_logs',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    dealId: varchar('deal_id').notNull(),
    stageId: varchar('stage_id'),

    // Automation Details
    triggerType: varchar('trigger_type', { length: 50 }).notNull(),
    actionType: varchar('action_type', { length: 50 }).notNull(),
    actionConfig: jsonb('action_config'),

    // Execution
    status: varchar('status', { length: 50 }).notNull(), // success, failed, skipped
    executedAt: timestamp('executed_at').defaultNow(),
    errorMessage: text('error_message'),

    // Result
    resultData: jsonb('result_data'),

    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    dealIdx: index('pipeline_automation_logs_deal_idx').on(table.dealId),
    statusIdx: index('pipeline_automation_logs_status_idx').on(table.status),
    executedAtIdx: index('pipeline_automation_logs_executed_at_idx').on(table.executedAt),
  }),
);

// ==================== Zod Schemas ====================

export const insertPipelineTemplateSchema = createInsertSchema(pipelineTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPipelineStageSchema = createInsertSchema(pipelineStages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  averageDaysInStage: true,
  conversionRate: true,
});

export const insertStageTransitionSchema = createInsertSchema(stageTransitions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDealStageHistorySchema = createInsertSchema(dealStageHistory).omit({
  id: true,
  createdAt: true,
});

export const insertPipelineAutomationLogSchema = createInsertSchema(pipelineAutomationLogs).omit({
  id: true,
  createdAt: true,
});

// ==================== Type Exports ====================

export type PipelineTemplate = typeof pipelineTemplates.$inferSelect;
export type InsertPipelineTemplate = z.infer<typeof insertPipelineTemplateSchema>;

export type PipelineStage = typeof pipelineStages.$inferSelect;
export type InsertPipelineStage = z.infer<typeof insertPipelineStageSchema>;

export type StageTransition = typeof stageTransitions.$inferSelect;
export type InsertStageTransition = z.infer<typeof insertStageTransitionSchema>;

export type DealStageHistory = typeof dealStageHistory.$inferSelect;
export type InsertDealStageHistory = z.infer<typeof insertDealStageHistorySchema>;

export type PipelineAutomationLog = typeof pipelineAutomationLogs.$inferSelect;
export type InsertPipelineAutomationLog = z.infer<typeof insertPipelineAutomationLogSchema>;
