import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Task priority enum
export const taskPriorityEnum = pgEnum("task_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);

// Task status enum
export const taskStatusEnum = pgEnum("task_status", [
  "todo",
  "in_progress",
  "review",
  "completed",
  "cancelled",
]);

// Project status enum
export const projectStatusEnum = pgEnum("project_status", [
  "planning",
  "active",
  "on_hold",
  "completed",
  "cancelled",
]);

// Tasks table - for both individual tasks and project tasks
export const tasks = pgTable("tasks", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: taskStatusEnum("status").default("todo").notNull(),
  priority: taskPriorityEnum("priority").default("medium").notNull(),

  // Assignment
  assignedTo: varchar("assigned_to"), // User ID
  createdBy: varchar("created_by").notNull(),

  // Project relationship
  projectId: varchar("project_id"), // Links to projects table
  parentTaskId: varchar("parent_task_id"), // For subtasks

  // Scheduling
  dueDate: timestamp("due_date"),
  startDate: timestamp("start_date"),
  estimatedHours: integer("estimated_hours"),
  actualHours: integer("actual_hours"),

  // Progress
  completionPercentage: integer("completion_percentage").default(0),

  // Enhanced task management fields
  dependencies: jsonb("dependencies").$type<string[]>().default([]), // Task IDs this task depends on
  watchers: jsonb("watchers").$type<string[]>().default([]), // User IDs watching this task
  timeTracked: integer("time_tracked").default(0), // Minutes tracked
  commentCount: integer("comment_count").default(0),
  attachmentCount: integer("attachment_count").default(0),

  // Metadata
  tags: jsonb("tags").$type<string[]>().default([]),
  customFields: jsonb("custom_fields").$type<Record<string, any>>().default({}),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Projects table - for managing complex multi-step projects
export const projects = pgTable("projects", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  status: projectStatusEnum("status").default("planning").notNull(),

  // Management
  projectManager: varchar("project_manager"), // User ID
  createdBy: varchar("created_by").notNull(),

  // Customer/Contract association
  customerId: varchar("customer_id"), // Links to customers
  contractId: varchar("contract_id"), // Links to contracts

  // Scheduling
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  estimatedBudget: integer("estimated_budget"), // In cents
  actualBudget: integer("actual_budget"), // In cents

  // Progress
  completionPercentage: integer("completion_percentage").default(0),

  // Enhanced task management fields
  color: varchar("color").default("#3b82f6"), // Project color
  template: varchar("template"), // Project template used
  workflow: jsonb("workflow")
    .$type<
      Array<{
        id: string;
        name: string;
        color: string;
        order: number;
        tasks: string[];
      }>
    >()
    .default([]),

  // Metadata
  tags: jsonb("tags").$type<string[]>().default([]),
  customFields: jsonb("custom_fields").$type<Record<string, any>>().default({}),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Task comments for collaboration
export const taskComments = pgTable("task_comments", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  taskId: varchar("task_id").notNull(),
  userId: varchar("user_id").notNull(),
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Task time tracking
export const timeEntries = pgTable("time_entries", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  taskId: varchar("task_id").notNull(),
  userId: varchar("user_id").notNull(),
  description: text("description"),
  hours: integer("hours").notNull(), // In minutes for precision
  entryDate: timestamp("entry_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Project templates for common project types
export const projectTemplates = pgTable("project_templates", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category"), // e.g. "equipment_installation", "service_campaign"

  // Template structure
  taskTemplate: jsonb("task_template")
    .$type<
      {
        title: string;
        description?: string;
        estimatedHours?: number;
        priority: "low" | "medium" | "high" | "urgent";
        dependencies?: string[]; // References to other template task IDs
      }[]
    >()
    .default([]),

  isPublic: boolean("is_public").default(false), // Can be shared across tenants
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertTaskSchema = createInsertSchema(tasks);
export const insertProjectSchema = createInsertSchema(projects);
export const insertTaskCommentSchema = createInsertSchema(taskComments);
export const insertTimeEntrySchema = createInsertSchema(timeEntries);
export const insertProjectTemplateSchema = createInsertSchema(projectTemplates);

// Select types
export type Task = typeof tasks.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type TaskComment = typeof taskComments.$inferSelect;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type ProjectTemplate = typeof projectTemplates.$inferSelect;

// Insert types
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type InsertTaskComment = z.infer<typeof insertTaskCommentSchema>;
export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;
export type InsertProjectTemplate = z.infer<typeof insertProjectTemplateSchema>;
