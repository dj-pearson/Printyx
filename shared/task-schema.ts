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
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Task priority enum
export const taskPriorityEnum = pgEnum('task_priority', ['low', 'medium', 'high', 'urgent']);

// Task status enum
export const taskStatusEnum = pgEnum('task_status', [
  'todo',
  'in_progress',
  'review',
  'completed',
  'cancelled',
]);

// Project status enum
export const projectStatusEnum = pgEnum('project_status', [
  'planning',
  'active',
  'on_hold',
  'completed',
  'cancelled',
]);

// Tasks table - for both individual tasks and project tasks
/**
 * `tasks` and `projects` are declared in `shared/schema.ts`, NOT here.
 *
 * Both were declared in this file too, and both described tables that do not
 * exist. Measured against a real PostgreSQL with the chain replayed:
 *
 *   tasks     8 phantom columns (parent_task_id, start_date, dependencies,
 *             watchers, time_tracked, comment_count, attachment_count,
 *             custom_fields) and MISSING customer_id, deal_id, handoff_id -
 *             deal_id being the column WF-P-08 added so a task can hang off a
 *             deal, which is the whole point of the deal page's task panel.
 *   projects  9 phantom, 6 missing.
 *
 * `shared/drizzle-schema.ts` already skipped both ("SKIPPED: defined in
 * schema.ts"), so neither ever shaped a migration. THIS ONE HAD A LIVE
 * IMPORTER, unlike the quote tables AUDIT-037 retired the same way:
 * `server/services/team-collaboration-service.ts` reads `tasks` from here. It
 * happens to touch only columns both declarations agree on, so it works - but
 * tsc would have accepted `tasksTable.customFields` just as readily, and that
 * is a 42703 the moment the query runs.
 *
 * The enums and the three tables below are genuinely this file's own.
 */
export { tasks, projects, insertTaskSchema, insertProjectSchema } from './schema';
export type { Task, Project, InsertTask, InsertProject } from './schema';

export const taskComments = pgTable('task_comments', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id').notNull(),
  taskId: varchar('task_id').notNull(),
  userId: varchar('user_id').notNull(),
  comment: text('comment').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Task time tracking
export const timeEntries = pgTable('time_entries', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id').notNull(),
  taskId: varchar('task_id').notNull(),
  userId: varchar('user_id').notNull(),
  description: text('description'),
  hours: integer('hours').notNull(), // In minutes for precision
  entryDate: timestamp('entry_date').notNull(),
  startedAt: timestamp('started_at'), // When timer was started (null for manual entries)
  isRunning: boolean('is_running').default(false), // Whether this is an active timer
  createdAt: timestamp('created_at').defaultNow(),
});

// Project templates for common project types
export const projectTemplates = pgTable('project_templates', {
  id: varchar('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenantId: varchar('tenant_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category'), // e.g. "equipment_installation", "service_campaign"

  // Template structure
  taskTemplate: jsonb('task_template')
    .$type<
      {
        title: string;
        description?: string;
        estimatedHours?: number;
        priority: 'low' | 'medium' | 'high' | 'urgent';
        dependencies?: string[]; // References to other template task IDs
      }[]
    >()
    .default([]),

  isPublic: boolean('is_public').default(false), // Can be shared across tenants
  createdBy: varchar('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Insert schemas
export const insertTaskCommentSchema = createInsertSchema(taskComments);
export const insertTimeEntrySchema = createInsertSchema(timeEntries);
export const insertProjectTemplateSchema = createInsertSchema(projectTemplates);

// Select types
export type TaskComment = typeof taskComments.$inferSelect;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type ProjectTemplate = typeof projectTemplates.$inferSelect;

// Insert types
export type InsertTaskComment = z.infer<typeof insertTaskCommentSchema>;
export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;
export type InsertProjectTemplate = z.infer<typeof insertProjectTemplateSchema>;
