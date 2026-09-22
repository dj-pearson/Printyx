/**
 * Copier sales playbooks — guided discovery inside the record (COP-B13).
 *
 * The industry motion (fleet walk, volume qualification, lease-position
 * discovery, committee mapping) was tribal knowledge with no support in the
 * product. These two tables put the questions in front of the rep while they
 * are on the call, and — the part that matters — put the ANSWERS somewhere the
 * radar and the forecast can read.
 *
 * WHY THE WRITE-BACK IS THE WHOLE POINT. A playbook whose answers land in free
 * text is a notes template with extra steps. `writeBackField` on a question
 * names a real column, so "what is their monthly colour volume?" fills
 * `deals.current_monthly_volume_color` and COP-B11 scores it, COP-B04 can
 * target on it and COP-I06 can forecast it. The set of nameable columns is a
 * fixed ALLOW-LIST in supabase/functions/_shared/playbook.ts, not a free
 * string: an admin authoring a playbook must not be able to aim a write at an
 * arbitrary column, and an allow-list is the only version of this that is safe
 * to expose to an authoring UI.
 *
 * TWO TABLES, NOT FOUR. Questions live as jsonb on the playbook and answers as
 * jsonb on the run. A question is only ever read as part of its playbook and an
 * answer only as part of its run, so rows for each would buy joins and nothing
 * else. The trade is that a question id has to be stable once answers exist —
 * the authoring path keeps ids across edits for exactly that reason.
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core';

/** What a question asks for, and therefore how its answer is coerced. */
export const PLAYBOOK_ANSWER_TYPES = [
  'text',
  'number',
  'currency',
  'boolean',
  'select',
  'multiselect',
  'date',
] as const;
export type PlaybookAnswerType = (typeof PLAYBOOK_ANSWER_TYPES)[number];

/** Which record a playbook runs against. */
export const PLAYBOOK_PARENT_TYPES = ['deal', 'contact', 'company'] as const;
export type PlaybookParentType = (typeof PLAYBOOK_PARENT_TYPES)[number];

export interface PlaybookQuestion {
  /** Stable across edits — answers are keyed on it. */
  id: string;
  prompt: string;
  helpText?: string | null;
  answerType: PlaybookAnswerType;
  /** For select/multiselect. */
  options?: string[] | null;
  /**
   * An allow-listed field key (see _shared/playbook.ts WRITE_BACK_FIELDS), or
   * null for a question whose answer is only worth reading back on the record.
   */
  writeBackField?: string | null;
  required?: boolean;
}

export const salesPlaybooks = pgTable(
  'sales_playbooks',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),

    name: varchar('name', { length: 160 }).notNull(),
    /** Stable key for the starter motions: fleet_walk, volume_qualification, … */
    motion: varchar('motion', { length: 60 }),
    description: text('description'),

    /** deal | contact | company. */
    appliesTo: varchar('applies_to', { length: 20 }).notNull().default('deal'),
    questions: jsonb('questions')
      .$type<PlaybookQuestion[]>()
      .default(sql`'[]'::jsonb`),

    /** AC5: entering this stage starts a run. Legacy deal_stages.id, as deals.stage_id holds. */
    triggerStageId: varchar('trigger_stage_id'),
    /**
     * AC4. When true, an incomplete run BLOCKS a stage advance past the
     * trigger stage. Default false on purpose: a gate somebody did not ask for
     * is a rep who cannot move their own deal.
     */
    gatesStageAdvance: boolean('gates_stage_advance').notNull().default(false),

    isActive: boolean('is_active').notNull().default(true),
    createdBy: varchar('created_by'),
    updatedBy: varchar('updated_by'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantActiveIdx: index('sales_playbooks_tenant_active_idx').on(table.tenantId, table.isActive),
    tenantTriggerIdx: index('sales_playbooks_tenant_trigger_idx').on(
      table.tenantId,
      table.triggerStageId,
    ),
  }),
);

export const salesPlaybookRuns = pgTable(
  'sales_playbook_runs',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    playbookId: varchar('playbook_id').notNull(),

    /** The record being worked. */
    parentType: varchar('parent_type', { length: 20 }).notNull(),
    parentId: varchar('parent_id').notNull(),

    /** { [questionId]: coerced value }. */
    answers: jsonb('answers')
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`),
    /**
     * What the last save actually wrote, per field, so a rep can see that their
     * answer reached the record rather than taking it on trust.
     */
    writeBackLog: jsonb('write_back_log').$type<Record<string, unknown>>(),

    /** in_progress | complete. Derived from required answers, stored for filtering. */
    status: varchar('status', { length: 20 }).notNull().default('in_progress'),

    startedBy: varchar('started_by'),
    startedAt: timestamp('started_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    completedAt: timestamp('completed_at'),
  },
  (table) => ({
    // One run per playbook per record: reopening a playbook resumes it rather
    // than starting a second set of answers to the same questions.
    runUnique: unique('sales_playbook_runs_record_uq').on(
      table.tenantId,
      table.playbookId,
      table.parentType,
      table.parentId,
    ),
    tenantRecordIdx: index('sales_playbook_runs_tenant_record_idx').on(
      table.tenantId,
      table.parentType,
      table.parentId,
    ),
  }),
);

export type SalesPlaybook = typeof salesPlaybooks.$inferSelect;
export type NewSalesPlaybook = typeof salesPlaybooks.$inferInsert;
export type SalesPlaybookRun = typeof salesPlaybookRuns.$inferSelect;
export type NewSalesPlaybookRun = typeof salesPlaybookRuns.$inferInsert;
