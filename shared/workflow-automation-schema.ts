import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  pgEnum,
  serial,
  unique,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// ==================== Enums ====================

export const workflowStatusEnum = pgEnum('workflow_status', [
  'draft',
  'active',
  'paused',
  'archived',
]);

export const triggerTypeEnum = pgEnum('trigger_type', ['event', 'schedule', 'manual', 'webhook']);

export const stepActionTypeEnum = pgEnum('step_action_type', [
  'email',
  'sms',
  'http_request',
  'database_update',
  'create_task',
  'create_ticket',
  'send_notification',
  'update_crm',
  'generate_invoice',
  'create_quote',
  'schedule_appointment',
  'assign_technician',
  'order_parts',
  'send_webhook',
  'wait_delay',
  'conditional_branch',
  'loop',
  'transform_data',
  'call_integration',
  'require_approval',
  'wait_for_approval',
]);

export const executionStatusEnum = pgEnum('execution_status', [
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
  'paused',
]);

export const stepExecutionStatusEnum = pgEnum('step_execution_status', [
  'pending',
  'running',
  'completed',
  'failed',
  'skipped',
  'retrying',
]);

export const conditionOperatorEnum = pgEnum('condition_operator', [
  'equals',
  'not_equals',
  'greater_than',
  'less_than',
  'greater_than_or_equal',
  'less_than_or_equal',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'in',
  'not_in',
  'is_null',
  'is_not_null',
  'matches_regex',
]);

export const logicalOperatorEnum = pgEnum('logical_operator', ['AND', 'OR', 'NOT']);

// ==================== Core Tables ====================

// 1. Workflows - Main workflow definitions
export const workflows = pgTable(
  'workflows',
  {
    id: varchar('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: varchar('tenant_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    category: varchar('category', { length: 100 }), // e.g., "Customer Management", "Service Management"
    status: workflowStatusEnum('status').notNull().default('draft'),
    currentVersionId: varchar('current_version_id'),
    isTemplate: boolean('is_template').notNull().default(false),
    createdBy: varchar('created_by'),
    lastModifiedBy: varchar('last_modified_by'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('workflows_tenant_idx').on(table.tenantId),
    statusIdx: index('workflows_status_idx').on(table.status),
    categoryIdx: index('workflows_category_idx').on(table.category),
    isTemplateIdx: index('workflows_is_template_idx').on(table.isTemplate),
  }),
);

// 2. Workflow Versions - Immutable version snapshots
export const workflowVersions = pgTable(
  'workflow_versions',
  {
    id: varchar('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workflowId: varchar('workflow_id')
      .notNull()
      .references(() => workflows.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    schemaHash: varchar('schema_hash', { length: 64 }), // SHA-256 of definition
    definition: jsonb('definition').notNull(), // Complete workflow definition as JSON
    changelog: text('changelog'),
    createdBy: varchar('created_by'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    workflowVersionIdx: unique('workflow_version_unique').on(table.workflowId, table.version),
    workflowIdx: index('workflow_versions_workflow_idx').on(table.workflowId),
  }),
);

// 3. Workflow Triggers - Event and schedule triggers
export const workflowTriggers = pgTable(
  'workflow_triggers',
  {
    id: varchar('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workflowId: varchar('workflow_id')
      .notNull()
      .references(() => workflows.id, { onDelete: 'cascade' }),
    type: triggerTypeEnum('type').notNull(),
    eventName: varchar('event_name', { length: 255 }), // For event triggers
    webhookPath: varchar('webhook_path', { length: 255 }), // For webhook triggers
    payloadMapping: jsonb('payload_mapping'), // How to map event payload to workflow context
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    workflowIdx: index('workflow_triggers_workflow_idx').on(table.workflowId),
    typeIdx: index('workflow_triggers_type_idx').on(table.type),
    eventNameIdx: index('workflow_triggers_event_name_idx').on(table.eventName),
  }),
);

// 4. Trigger Schedules - Cron schedules for scheduled triggers
export const triggerSchedules = pgTable(
  'trigger_schedules',
  {
    id: varchar('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    triggerId: varchar('trigger_id')
      .notNull()
      .references(() => workflowTriggers.id, { onDelete: 'cascade' }),
    cronExpression: varchar('cron_expression', { length: 255 }).notNull(),
    timezone: varchar('timezone', { length: 50 }).notNull().default('UTC'),
    nextRunAt: timestamp('next_run_at'),
    lastRunAt: timestamp('last_run_at'),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    triggerIdx: index('trigger_schedules_trigger_idx').on(table.triggerId),
    nextRunIdx: index('trigger_schedules_next_run_idx').on(table.nextRunAt),
  }),
);

// 5. Workflow Conditions - Conditional logic for triggers and steps
export const workflowConditions = pgTable(
  'workflow_conditions',
  {
    id: varchar('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    triggerId: varchar('trigger_id').references(() => workflowTriggers.id, {
      onDelete: 'cascade',
    }),
    stepId: varchar('step_id'), // References workflow_steps (not FK to avoid circular dependency)
    conditionGroup: varchar('condition_group', { length: 50 }), // For grouping (e.g., "group1")
    logicalOperator: logicalOperatorEnum('logical_operator').notNull().default('AND'),
    leftOperand: varchar('left_operand').notNull(), // Field path or value
    operator: conditionOperatorEnum('operator').notNull(),
    rightOperand: varchar('right_operand'), // Field path or value
    dataType: varchar('data_type', { length: 50 }), // string, number, boolean, date
    orderIndex: integer('order_index').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    triggerIdx: index('workflow_conditions_trigger_idx').on(table.triggerId),
    stepIdx: index('workflow_conditions_step_idx').on(table.stepId),
    groupIdx: index('workflow_conditions_group_idx').on(table.conditionGroup),
  }),
);

// 6. Workflow Steps - Individual workflow action steps
export const workflowStepsAutomation = pgTable(
  'workflow_steps_automation',
  {
    id: varchar('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workflowId: varchar('workflow_id')
      .notNull()
      .references(() => workflows.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    actionType: stepActionTypeEnum('action_type').notNull(),
    config: jsonb('config').notNull(), // Action-specific configuration
    orderIndex: integer('order_index').notNull(),
    retryEnabled: boolean('retry_enabled').notNull().default(false),
    maxRetries: integer('max_retries').default(3),
    retryDelaySeconds: integer('retry_delay_seconds').default(60),
    timeoutSeconds: integer('timeout_seconds').default(300),
    continueOnError: boolean('continue_on_error').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    workflowIdx: index('workflow_steps_automation_workflow_idx').on(table.workflowId),
    orderIdx: index('workflow_steps_automation_order_idx').on(table.workflowId, table.orderIndex),
  }),
);

// 7. Workflow Step Transitions - Define next steps based on outcomes
export const workflowStepTransitions = pgTable(
  'workflow_step_transitions',
  {
    id: varchar('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    stepId: varchar('step_id')
      .notNull()
      .references(() => workflowStepsAutomation.id, { onDelete: 'cascade' }),
    condition: varchar('condition', { length: 50 }).notNull(), // "on_success", "on_failure", "on_condition"
    nextStepId: varchar('next_step_id').references(() => workflowStepsAutomation.id),
    conditionExpression: jsonb('condition_expression'), // For conditional routing
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    stepIdx: index('workflow_step_transitions_step_idx').on(table.stepId),
  }),
);

// 8. Workflow Executions - Execution instances
export const workflowExecutions = pgTable(
  'workflow_executions',
  {
    id: varchar('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    workflowId: varchar('workflow_id')
      .notNull()
      .references(() => workflows.id),
    workflowVersionId: varchar('workflow_version_id')
      .notNull()
      .references(() => workflowVersions.id),
    triggerId: varchar('trigger_id').references(() => workflowTriggers.id),
    tenantId: varchar('tenant_id').notNull(),
    status: executionStatusEnum('status').notNull().default('queued'),
    initiatedBy: varchar('initiated_by'), // User ID or "system"
    context: jsonb('context'), // Execution context data
    result: jsonb('result'), // Final execution result
    error: text('error'), // Error details if failed
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    workflowIdx: index('workflow_executions_workflow_idx').on(table.workflowId),
    tenantIdx: index('workflow_executions_tenant_idx').on(table.tenantId),
    statusIdx: index('workflow_executions_status_idx').on(table.status),
    createdAtIdx: index('workflow_executions_created_at_idx').on(table.createdAt),
  }),
);

// 9. Workflow Execution Steps - Per-step execution state
export const workflowExecutionSteps = pgTable(
  'workflow_execution_steps',
  {
    id: varchar('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    executionId: varchar('execution_id')
      .notNull()
      .references(() => workflowExecutions.id, { onDelete: 'cascade' }),
    stepId: varchar('step_id').notNull(), // References workflow_steps_automation.id
    stepName: varchar('step_name', { length: 255 }).notNull(),
    status: stepExecutionStatusEnum('status').notNull().default('pending'),
    input: jsonb('input'), // Step input data
    output: jsonb('output'), // Step output data
    error: text('error'), // Error details if failed
    retryCount: integer('retry_count').notNull().default(0),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    executionIdx: index('workflow_execution_steps_execution_idx').on(table.executionId),
    statusIdx: index('workflow_execution_steps_status_idx').on(table.status),
  }),
);

// 10. Workflow Execution Events - Audit trail
export const workflowExecutionEvents = pgTable(
  'workflow_execution_events',
  {
    id: varchar('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    executionId: varchar('execution_id')
      .notNull()
      .references(() => workflowExecutions.id, { onDelete: 'cascade' }),
    stepExecutionId: varchar('step_execution_id').references(() => workflowExecutionSteps.id, {
      onDelete: 'cascade',
    }),
    eventType: varchar('event_type', { length: 100 }).notNull(), // e.g., "execution_started", "step_completed"
    eventData: jsonb('event_data'),
    message: text('message'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    executionIdx: index('workflow_execution_events_execution_idx').on(table.executionId),
    createdAtIdx: index('workflow_execution_events_created_at_idx').on(table.createdAt),
  }),
);

// 11. Workflow Templates - Reusable workflow templates
export const workflowTemplates = pgTable(
  'workflow_templates',
  {
    id: varchar('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    category: varchar('category', { length: 100 }).notNull(),
    definition: jsonb('definition').notNull(), // Complete workflow template as JSON
    version: varchar('version', { length: 50 }).notNull(),
    previewImage: text('preview_image'), // URL or base64
    complexity: varchar('complexity', { length: 20 }), // "simple", "moderate", "complex"
    estimatedTimeSaved: integer('estimated_time_saved'), // minutes per month
    usageCount: integer('usage_count').notNull().default(0),
    featured: boolean('featured').notNull().default(false),
    createdBy: varchar('created_by'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    categoryIdx: index('workflow_templates_category_idx').on(table.category),
    featuredIdx: index('workflow_templates_featured_idx').on(table.featured),
  }),
);

// 12. Template Variables - Variable definitions for templates
export const templateVariables = pgTable(
  'template_variables',
  {
    id: varchar('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    templateId: varchar('template_id')
      .notNull()
      .references(() => workflowTemplates.id, { onDelete: 'cascade' }),
    variableName: varchar('variable_name', { length: 100 }).notNull(),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    description: text('description'),
    dataType: varchar('data_type', { length: 50 }).notNull(), // string, number, boolean, date, etc.
    defaultValue: text('default_value'),
    required: boolean('required').notNull().default(false),
    validationRules: jsonb('validation_rules'), // JSON schema or validation rules
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    templateIdx: index('template_variables_template_idx').on(table.templateId),
  }),
);

// 13. Workflow Event Registry - Catalog of available business events
export const workflowEventRegistry = pgTable(
  'workflow_event_registry',
  {
    id: varchar('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    eventName: varchar('event_name', { length: 255 }).notNull().unique(),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    description: text('description'),
    category: varchar('category', { length: 100 }).notNull(),
    payloadSchema: jsonb('payload_schema').notNull(), // JSON schema for event payload
    examplePayload: jsonb('example_payload'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    eventNameIdx: index('workflow_event_registry_event_name_idx').on(table.eventName),
    categoryIdx: index('workflow_event_registry_category_idx').on(table.category),
  }),
);

// 14. Assignment Groups - Groups/roles that can be assigned tasks
export const assignmentGroups = pgTable(
  'assignment_groups',
  {
    id: varchar('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: varchar('tenant_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    type: varchar('type', { length: 50 }).notNull(), // "role", "department", "team", "custom"
    members: jsonb('members').$type<string[]>().notNull().default([]), // User IDs
    isActive: boolean('is_active').notNull().default(true),
    createdBy: varchar('created_by'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('assignment_groups_tenant_idx').on(table.tenantId),
    typeIdx: index('assignment_groups_type_idx').on(table.type),
  }),
);

// 15. Workflow Approvals - Track approval requests and responses
export const workflowApprovals = pgTable(
  'workflow_approvals',
  {
    id: varchar('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tenantId: varchar('tenant_id').notNull(),
    executionId: varchar('execution_id')
      .notNull()
      .references(() => workflowExecutions.id, { onDelete: 'cascade' }),
    stepExecutionId: varchar('step_execution_id')
      .notNull()
      .references(() => workflowExecutionSteps.id, { onDelete: 'cascade' }),

    // Assignment - can be user or group
    assignedToUserId: varchar('assigned_to_user_id'), // Direct user assignment
    assignedToGroupId: varchar('assigned_to_group_id').references(() => assignmentGroups.id), // Group assignment

    // Approval details
    status: varchar('status', { length: 50 }).notNull().default('pending'), // "pending", "approved", "rejected", "cancelled"
    approvedBy: varchar('approved_by'), // User ID who approved/rejected
    approvalComment: text('approval_comment'),
    dueDate: timestamp('due_date'),

    // Context data from workflow
    contextData: jsonb('context_data'), // Order number, products, customer info, etc.

    // Timestamps
    requestedAt: timestamp('requested_at').notNull().defaultNow(),
    respondedAt: timestamp('responded_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('workflow_approvals_tenant_idx').on(table.tenantId),
    executionIdx: index('workflow_approvals_execution_idx').on(table.executionId),
    statusIdx: index('workflow_approvals_status_idx').on(table.status),
    assignedUserIdx: index('workflow_approvals_assigned_user_idx').on(table.assignedToUserId),
    assignedGroupIdx: index('workflow_approvals_assigned_group_idx').on(table.assignedToGroupId),
    dueDateIdx: index('workflow_approvals_due_date_idx').on(table.dueDate),
  }),
);

// ==================== Insert Schemas ====================

export const insertWorkflowSchema = createInsertSchema(workflows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkflowVersionSchema = createInsertSchema(workflowVersions).omit({
  id: true,
  createdAt: true,
});

export const insertWorkflowTriggerSchema = createInsertSchema(workflowTriggers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTriggerScheduleSchema = createInsertSchema(triggerSchedules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkflowConditionSchema = createInsertSchema(workflowConditions).omit({
  id: true,
  createdAt: true,
});

export const insertWorkflowStepAutomationSchema = createInsertSchema(workflowStepsAutomation).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkflowStepTransitionSchema = createInsertSchema(workflowStepTransitions).omit({
  id: true,
  createdAt: true,
});

export const insertWorkflowExecutionSchema = createInsertSchema(workflowExecutions).omit({
  id: true,
  createdAt: true,
});

export const insertWorkflowExecutionStepSchema = createInsertSchema(workflowExecutionSteps).omit({
  id: true,
  createdAt: true,
});

export const insertWorkflowExecutionEventSchema = createInsertSchema(workflowExecutionEvents).omit({
  id: true,
  createdAt: true,
});

export const insertWorkflowTemplateSchema = createInsertSchema(workflowTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTemplateVariableSchema = createInsertSchema(templateVariables).omit({
  id: true,
  createdAt: true,
});

export const insertWorkflowEventRegistrySchema = createInsertSchema(workflowEventRegistry).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAssignmentGroupSchema = createInsertSchema(assignmentGroups).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkflowApprovalSchema = createInsertSchema(workflowApprovals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ==================== Types ====================

export type Workflow = typeof workflows.$inferSelect;
export type WorkflowVersion = typeof workflowVersions.$inferSelect;
export type WorkflowTrigger = typeof workflowTriggers.$inferSelect;
export type TriggerSchedule = typeof triggerSchedules.$inferSelect;
export type WorkflowCondition = typeof workflowConditions.$inferSelect;
export type WorkflowStepAutomation = typeof workflowStepsAutomation.$inferSelect;
export type WorkflowStepTransition = typeof workflowStepTransitions.$inferSelect;
export type WorkflowExecution = typeof workflowExecutions.$inferSelect;
export type WorkflowExecutionStep = typeof workflowExecutionSteps.$inferSelect;
export type WorkflowExecutionEvent = typeof workflowExecutionEvents.$inferSelect;
export type WorkflowTemplate = typeof workflowTemplates.$inferSelect;
export type TemplateVariable = typeof templateVariables.$inferSelect;
export type WorkflowEventRegistry = typeof workflowEventRegistry.$inferSelect;
export type AssignmentGroup = typeof assignmentGroups.$inferSelect;
export type WorkflowApproval = typeof workflowApprovals.$inferSelect;

export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;
export type InsertWorkflowVersion = z.infer<typeof insertWorkflowVersionSchema>;
export type InsertWorkflowTrigger = z.infer<typeof insertWorkflowTriggerSchema>;
export type InsertTriggerSchedule = z.infer<typeof insertTriggerScheduleSchema>;
export type InsertWorkflowCondition = z.infer<typeof insertWorkflowConditionSchema>;
export type InsertWorkflowStepAutomation = z.infer<typeof insertWorkflowStepAutomationSchema>;
export type InsertWorkflowStepTransition = z.infer<typeof insertWorkflowStepTransitionSchema>;
export type InsertWorkflowExecution = z.infer<typeof insertWorkflowExecutionSchema>;
export type InsertWorkflowExecutionStep = z.infer<typeof insertWorkflowExecutionStepSchema>;
export type InsertWorkflowExecutionEvent = z.infer<typeof insertWorkflowExecutionEventSchema>;
export type InsertWorkflowTemplate = z.infer<typeof insertWorkflowTemplateSchema>;
export type InsertTemplateVariable = z.infer<typeof insertTemplateVariableSchema>;
export type InsertWorkflowEventRegistry = z.infer<typeof insertWorkflowEventRegistrySchema>;
export type InsertAssignmentGroup = z.infer<typeof insertAssignmentGroupSchema>;
export type InsertWorkflowApproval = z.infer<typeof insertWorkflowApprovalSchema>;
