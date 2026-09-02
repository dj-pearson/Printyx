/**
 * Preventive maintenance schedules and records (WF-V-04).
 *
 * supabase/functions/maintenance/ has read and written both of these since it
 * shipped and NEITHER EXISTED IN ANY SCHEMA OR MIGRATION - they were among the
 * undeclared relations in docs/phantom-tables-baseline.json. The two hosts also
 * disagreed about the whole feature: server/routes-preventive-maintenance.ts
 * answered /api/maintenance/* from hard-coded fixtures whose own comments said
 * "Sample maintenance schedules until schema is updated", and that router was
 * never registered, so it was dead in dev as well.
 *
 * The columns here are exactly the ones the edge function reads and writes,
 * recovered from its queries rather than designed fresh: changing the shape would
 * have meant rewriting a working handler to match a table nobody had written down.
 *
 * The migration that captures them is idempotent CREATE TABLE IF NOT EXISTS
 * (COP-M00's reconciliation pattern), because this environment has no credentials
 * for the live project and therefore cannot confirm whether db:push already
 * created them there. That form is correct either way.
 */

import {
  pgTable,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  decimal,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const maintenanceSchedules = pgTable(
  'maintenance_schedules',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    equipmentId: varchar('equipment_id').notNull(),

    name: varchar('name').notNull(),
    description: text('description'),
    /** preventive | corrective | inspection — the edge function defaults to preventive. */
    maintenanceType: varchar('maintenance_type').notNull().default('preventive'),

    /** daily | weekly | monthly | quarterly | yearly, times frequencyValue. */
    frequency: varchar('frequency').notNull().default('monthly'),
    frequencyValue: integer('frequency_value').notNull().default(1),

    nextDueDate: timestamp('next_due_date').notNull(),
    lastCompletedDate: timestamp('last_completed_date'),

    assignedTo: varchar('assigned_to'),
    /** Minutes. */
    estimatedDuration: integer('estimated_duration'),
    checklist: jsonb('checklist'),

    status: varchar('status').notNull().default('active'),

    createdBy: varchar('created_by'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    tenantDueIdx: index('maintenance_schedules_tenant_due_idx').on(
      table.tenantId,
      table.nextDueDate,
    ),
    tenantEquipmentIdx: index('maintenance_schedules_tenant_equipment_idx').on(
      table.tenantId,
      table.equipmentId,
    ),
  }),
);

export const maintenanceRecords = pgTable(
  'maintenance_records',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    scheduleId: varchar('schedule_id'),
    equipmentId: varchar('equipment_id').notNull(),

    maintenanceType: varchar('maintenance_type'),
    completedBy: varchar('completed_by'),
    completedAt: timestamp('completed_at').notNull(),

    notes: text('notes'),
    partsUsed: jsonb('parts_used'),
    laborHours: decimal('labor_hours', { precision: 6, scale: 2 }),
    cost: decimal('cost', { precision: 12, scale: 2 }),

    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    tenantCompletedIdx: index('maintenance_records_tenant_completed_idx').on(
      table.tenantId,
      table.completedAt,
    ),
  }),
);

export type MaintenanceSchedule = typeof maintenanceSchedules.$inferSelect;
export type InsertMaintenanceSchedule = typeof maintenanceSchedules.$inferInsert;
export type MaintenanceRecord = typeof maintenanceRecords.$inferSelect;
export type InsertMaintenanceRecord = typeof maintenanceRecords.$inferInsert;
