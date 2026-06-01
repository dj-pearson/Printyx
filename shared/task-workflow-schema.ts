/**
 * TASK WORKFLOW SCHEMA
 *
 * Human-centric, customizable workflows for the Tasks module (TWF-###).
 *
 * A "task workflow" is an ordered sequence of steps. Each step has a title,
 * details, and an assignee. Steps are grouped into STAGES via `stageIndex`:
 * steps that share a stageIndex run in PARALLEL, and the workflow only advances
 * to the next stageIndex once every step in the current stage is completed.
 * When a stage activates, each newly-active step's assignee is notified
 * (email + in-app) with a deep link to that step.
 *
 * A workflow can be a one-off INSTANCE or a reusable TEMPLATE (`isTemplate`).
 * The `ownerId` (creator) has full project-management control, and may delegate
 * it by setting `projectManagerId`. PMs can progress (advance) or regress
 * (send back to a prior stage for revisions); every such action is recorded in
 * `task_workflow_events` for a full audit trail.
 *
 * Designed to be net-new and decoupled from the system-action
 * `workflow-automation-schema` (that engine automates system actions; this one
 * coordinates people).
 */
import { sql } from 'drizzle-orm';
import {
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const taskWorkflowStatusEnum = pgEnum('task_workflow_status', [
  'draft', // being built / not yet started
  'active', // running
  'completed', // all stages done
  'archived', // hidden but retained
  'cancelled',
]);

export const taskWorkflowStepStatusEnum = pgEnum('task_workflow_step_status', [
  'pending', // not yet reached
  'active', // current stage, assignee notified, awaiting work
  'in_progress', // assignee has started
  'completed',
  'blocked',
  'skipped',
]);

export const taskWorkflowSourceEnum = pgEnum('task_workflow_source', [
  'manual',
  'image',
  'csv',
  'xlsx',
  'template',
]);

export const taskWorkflowEventTypeEnum = pgEnum('task_workflow_event_type', [
  'created',
  'started',
  'step_completed',
  'step_reopened',
  'step_assigned',
  'advanced',
  'regressed',
  'reassigned',
  'commented',
  'published',
  'archived',
  'notified',
]);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

/** A workflow (one-off instance or reusable template). */
export const taskWorkflows = pgTable(
  'task_workflows',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),

    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    status: taskWorkflowStatusEnum('status').default('draft').notNull(),

    // Template support
    isTemplate: boolean('is_template').default(false).notNull(),
    templateId: varchar('template_id'), // which template this instance was created from

    // Project-management control
    ownerId: varchar('owner_id').notNull(), // creator — full control
    projectManagerId: varchar('project_manager_id'), // delegated PM (defaults to owner if null)

    // Runtime position (instances only). The lowest stageIndex that still has
    // incomplete steps. -1 once the whole workflow is complete.
    currentStageIndex: integer('current_stage_index').default(0).notNull(),

    // Provenance of how the steps were built
    sourceType: taskWorkflowSourceEnum('source_type').default('manual').notNull(),
    sourceFileName: varchar('source_file_name', { length: 512 }),

    // { notifyByEmail: boolean, notifyInApp: boolean, autoAdvance: boolean,
    //   allowExternalAssignees: boolean }
    settings: jsonb('settings').$type<Record<string, any>>().default({}),

    createdBy: varchar('created_by').notNull(),
    lastModifiedBy: varchar('last_modified_by'),

    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => ({
    tenantIdx: index('task_workflows_tenant_idx').on(t.tenantId),
    tenantStatusIdx: index('task_workflows_tenant_status_idx').on(t.tenantId, t.status),
    templateIdx: index('task_workflows_template_idx').on(t.tenantId, t.isTemplate),
  }),
);

/** An individual step within a workflow. Steps sharing a stageIndex are parallel. */
export const taskWorkflowSteps = pgTable(
  'task_workflow_steps',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    workflowId: varchar('workflow_id').notNull(),

    title: varchar('title', { length: 512 }).notNull(),
    details: text('details'),

    // Sequencing. Same stageIndex => parallel; orderIndex orders within a stage.
    stageIndex: integer('stage_index').default(0).notNull(),
    orderIndex: integer('order_index').default(0).notNull(),

    // Assignment. assigneeName preserves the raw parsed label (e.g. "Tay on ITT
    // Form") for display and for unmatched/ambiguous parses. assigneeUserId is
    // the resolved internal user; assigneeEmail supports external (non-user)
    // assignees who still receive the notification + a link.
    assigneeUserId: varchar('assignee_user_id'),
    assigneeName: varchar('assignee_name', { length: 255 }),
    assigneeEmail: varchar('assignee_email', { length: 320 }),

    status: taskWorkflowStepStatusEnum('status').default('pending').notNull(),

    dueAt: timestamp('due_at'),
    notifiedAt: timestamp('notified_at'), // when the assignment notification was last sent
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
    completedBy: varchar('completed_by'),

    metadata: jsonb('metadata').$type<Record<string, any>>().default({}),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => ({
    workflowIdx: index('task_workflow_steps_workflow_idx').on(t.tenantId, t.workflowId),
    assigneeIdx: index('task_workflow_steps_assignee_idx').on(t.tenantId, t.assigneeUserId),
    stageIdx: index('task_workflow_steps_stage_idx').on(t.workflowId, t.stageIndex),
  }),
);

/** Append-only history of workflow + step lifecycle events (the activity log). */
export const taskWorkflowEvents = pgTable(
  'task_workflow_events',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    workflowId: varchar('workflow_id').notNull(),
    stepId: varchar('step_id'), // null for workflow-level events

    eventType: taskWorkflowEventTypeEnum('event_type').notNull(),
    actorUserId: varchar('actor_user_id'), // who performed the action (null = system)

    fromStageIndex: integer('from_stage_index'),
    toStageIndex: integer('to_stage_index'),

    note: text('note'),
    metadata: jsonb('metadata').$type<Record<string, any>>().default({}),

    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => ({
    workflowIdx: index('task_workflow_events_workflow_idx').on(t.tenantId, t.workflowId),
    createdIdx: index('task_workflow_events_created_idx').on(t.workflowId, t.createdAt),
  }),
);

// ---------------------------------------------------------------------------
// Insert schemas
// ---------------------------------------------------------------------------

export const insertTaskWorkflowSchema = createInsertSchema(taskWorkflows);
export const insertTaskWorkflowStepSchema = createInsertSchema(taskWorkflowSteps);
export const insertTaskWorkflowEventSchema = createInsertSchema(taskWorkflowEvents);

// ---------------------------------------------------------------------------
// Select / Insert types
// ---------------------------------------------------------------------------

export type TaskWorkflow = typeof taskWorkflows.$inferSelect;
export type TaskWorkflowStep = typeof taskWorkflowSteps.$inferSelect;
export type TaskWorkflowEvent = typeof taskWorkflowEvents.$inferSelect;

export type InsertTaskWorkflow = z.infer<typeof insertTaskWorkflowSchema>;
export type InsertTaskWorkflowStep = z.infer<typeof insertTaskWorkflowStepSchema>;
export type InsertTaskWorkflowEvent = z.infer<typeof insertTaskWorkflowEventSchema>;

// ---------------------------------------------------------------------------
// Shared shapes used by the parse/draft flow (not persisted directly)
// ---------------------------------------------------------------------------

/** A single step as produced by the parser, before the creator confirms it. */
export interface ParsedWorkflowStep {
  title: string;
  details?: string;
  stageIndex: number;
  /** Raw assignee label as found in the source (e.g. "Tay on ITT Form"). */
  assigneeName?: string;
  /** Best-guess matched user id, if any. */
  suggestedAssigneeUserId?: string | null;
  /** 0..1 confidence of the suggested match. */
  matchConfidence?: number;
}

export interface ParsedWorkflowDraft {
  suggestedName?: string;
  sourceType: 'manual' | 'image' | 'csv' | 'xlsx';
  sourceFileName?: string;
  steps: ParsedWorkflowStep[];
  /** Distinct raw assignee names that could not be matched to a user. */
  unmatchedAssignees: string[];
}
