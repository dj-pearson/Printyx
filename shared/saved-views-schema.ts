import {
  pgTable,
  varchar,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

/**
 * Saved views for CRM index pages (deals, leads, contacts, companies).
 * Mirrors HubSpot's saved views system: each view stores its filter
 * conditions, sort, visible columns, and board (kanban) configuration.
 */
export const savedViews = pgTable(
  'saved_views',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    // Creator of the view. Null for system-seeded default views.
    userId: varchar('user_id'),
    objectType: varchar('object_type', { length: 30 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    // Array of filter conditions: [{ field, operator, value, conjunction }]
    filterDefinition: jsonb('filter_definition')
      .notNull()
      .default(sql`'[]'::jsonb`),
    // { field, direction }
    sortConfig: jsonb('sort_config'),
    // { columns: [{ field, visible, order }] }
    columnConfig: jsonb('column_config'),
    // { cardFields, columnTotals, groupBy }
    boardConfig: jsonb('board_config'),
    visibility: varchar('visibility', { length: 20 }).notNull().default('private'),
    isDefault: boolean('is_default').notNull().default(false),
    isPinned: boolean('is_pinned').notNull().default(false),
    // System-seeded views ('All Records', 'My Records', 'Recently Modified') cannot be deleted.
    isSystem: boolean('is_system').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantObjectIdx: index('saved_views_tenant_object_idx').on(table.tenantId, table.objectType),
    tenantUserIdx: index('saved_views_tenant_user_idx').on(table.tenantId, table.userId),
  }),
);

/**
 * Tracks which saved views a user has pinned as tabs (and their tab order).
 */
export const savedViewPins = pgTable(
  'saved_view_pins',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    viewId: varchar('view_id').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('saved_view_pins_user_idx').on(table.userId),
    userViewIdx: index('saved_view_pins_user_view_idx').on(table.userId, table.viewId),
  }),
);

export const SAVED_VIEW_OBJECT_TYPES = ['deals', 'leads', 'contacts', 'companies'] as const;
export const SAVED_VIEW_VISIBILITIES = ['private', 'team', 'everyone'] as const;

export const filterConditionSchema = z.object({
  field: z.string().min(1).max(100),
  operator: z.enum([
    'eq',
    'neq',
    'contains',
    'startsWith',
    'gt',
    'gte',
    'lt',
    'lte',
    'before',
    'after',
    'between',
    'lastNDays',
    'is',
    'isNot',
    'isAny',
    'isEmpty',
    'isNotEmpty',
  ]),
  value: z.unknown().optional(),
  conjunction: z.enum(['AND', 'OR']).optional(),
});

export const sortConfigSchema = z.object({
  field: z.string().min(1).max(100),
  direction: z.enum(['asc', 'desc']),
});

export const insertSavedViewSchema = createInsertSchema(savedViews);

export const createSavedViewBodySchema = z.object({
  objectType: z.enum(SAVED_VIEW_OBJECT_TYPES),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  filterDefinition: z.array(filterConditionSchema).optional().default([]),
  sortConfig: sortConfigSchema.nullable().optional(),
  columnConfig: z.unknown().optional(),
  boardConfig: z.unknown().optional(),
  visibility: z.enum(SAVED_VIEW_VISIBILITIES).optional().default('private'),
  isDefault: z.boolean().optional().default(false),
});

export const updateSavedViewBodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  filterDefinition: z.array(filterConditionSchema).optional(),
  sortConfig: sortConfigSchema.nullable().optional(),
  columnConfig: z.unknown().optional(),
  boardConfig: z.unknown().optional(),
  visibility: z.enum(SAVED_VIEW_VISIBILITIES).optional(),
  isDefault: z.boolean().optional(),
});

export type SavedView = typeof savedViews.$inferSelect;
export type InsertSavedView = typeof savedViews.$inferInsert;
export type SavedViewPin = typeof savedViewPins.$inferSelect;
