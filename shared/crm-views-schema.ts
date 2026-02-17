/**
 * CRM Saved Views Schema
 * Persistent view management for CRM index pages (deals, leads, contacts, companies)
 * Replaces localStorage-based saved filters with a proper backend.
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
  boolean,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// ==================== Enums ====================

export const viewVisibilityEnum = pgEnum('view_visibility', [
  'private',
  'team',
  'everyone',
]);

export const crmObjectTypeEnum = pgEnum('crm_object_type', [
  'deals',
  'leads',
  'contacts',
  'companies',
  'opportunities',
]);

// ==================== Saved Views ====================

export const savedViews = pgTable(
  'saved_views',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    userId: varchar('user_id').notNull(), // creator

    // View Identity
    objectType: crmObjectTypeEnum('object_type').notNull(),
    name: varchar('name', { length: 255 }).notNull(),

    // View Configuration (jsonb)
    filterDefinition: jsonb('filter_definition').$type<
      Array<{
        field: string;
        operator: string;
        value: any;
        conjunction?: 'AND' | 'OR';
      }>
    >(),
    sortConfig: jsonb('sort_config').$type<{
      field: string;
      direction: 'asc' | 'desc';
    }>(),
    columnConfig: jsonb('column_config').$type<
      Array<{
        field: string;
        label: string;
        visible: boolean;
        width?: number;
        order: number;
      }>
    >(),
    boardConfig: jsonb('board_config').$type<{
      cardFields?: Array<{ field: string; label: string; position: number; format?: string }>;
      columnTotals?: 'sum' | 'count' | 'weighted' | 'average' | 'none';
      groupBy?: string;
    }>(),

    // Sharing & Defaults
    visibility: viewVisibilityEnum('visibility').default('private').notNull(),
    isDefault: boolean('is_default').default(false),
    isSystemView: boolean('is_system_view').default(false), // cannot be deleted

    // Metadata
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    tenantIdx: index('saved_views_tenant_idx').on(table.tenantId),
    tenantObjectIdx: index('saved_views_tenant_object_idx').on(
      table.tenantId,
      table.objectType,
    ),
    userIdx: index('saved_views_user_idx').on(table.userId),
    tenantUserObjectIdx: index('saved_views_tenant_user_object_idx').on(
      table.tenantId,
      table.userId,
      table.objectType,
    ),
  }),
);

// ==================== Saved View Pins ====================

export const savedViewPins = pgTable(
  'saved_view_pins',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar('user_id').notNull(),
    viewId: varchar('view_id').notNull(),
    sortOrder: integer('sort_order').default(0),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    userIdx: index('saved_view_pins_user_idx').on(table.userId),
    viewIdx: index('saved_view_pins_view_idx').on(table.viewId),
    userViewIdx: index('saved_view_pins_user_view_idx').on(
      table.userId,
      table.viewId,
    ),
  }),
);

// ==================== Board Card Configs (CRM-004) ====================

export const boardCardConfigs = pgTable(
  'board_card_configs',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    pipelineId: varchar('pipeline_id'),
    viewId: varchar('view_id'), // nullable - null = pipeline default
    userId: varchar('user_id'), // nullable - null = global config

    // Card Configuration
    cardFields: jsonb('card_fields').$type<
      Array<{
        field: string;
        label: string;
        position: number;
        format?: string;
      }>
    >(),
    tagDisplayEnabled: boolean('tag_display_enabled').default(true),
    maxFieldsShown: integer('max_fields_shown').default(5),
    cardStyle: varchar('card_style', { length: 20 }).default('standard'), // compact|standard|detailed

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    tenantIdx: index('board_card_configs_tenant_idx').on(table.tenantId),
    pipelineIdx: index('board_card_configs_pipeline_idx').on(table.pipelineId),
    tenantPipelineIdx: index('board_card_configs_tenant_pipeline_idx').on(
      table.tenantId,
      table.pipelineId,
    ),
  }),
);

// ==================== Deal Tags (CRM-004) ====================

export const dealTags = pgTable(
  'deal_tags',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    color: varchar('color', { length: 7 }).default('#3B82F6'), // hex
    description: text('description'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    tenantIdx: index('deal_tags_tenant_idx').on(table.tenantId),
  }),
);

// ==================== Deal Tag Assignments (CRM-004) ====================

export const dealTagAssignments = pgTable(
  'deal_tag_assignments',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    dealId: varchar('deal_id').notNull(),
    tagId: varchar('tag_id').notNull(),
    assignedBy: varchar('assigned_by'),
    assignedAt: timestamp('assigned_at').defaultNow(),
  },
  (table) => ({
    dealIdx: index('deal_tag_assignments_deal_idx').on(table.dealId),
    tagIdx: index('deal_tag_assignments_tag_idx').on(table.tagId),
    dealTagIdx: index('deal_tag_assignments_deal_tag_idx').on(
      table.dealId,
      table.tagId,
    ),
  }),
);

// ==================== Record Layout Configs (CRM-008) ====================

export const recordLayoutConfigs = pgTable(
  'record_layout_configs',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),
    objectType: crmObjectTypeEnum('object_type').notNull(),
    roleId: varchar('role_id'), // nullable - null = default layout

    // Layout Sections
    layoutSections: jsonb('layout_sections').$type<
      Array<{
        sectionId: string;
        title: string;
        position: 'header' | 'left' | 'center' | 'right';
        order: number;
        propertyFields: Array<{
          field: string;
          label: string;
          editable: boolean;
        }>;
        collapsed: boolean;
      }>
    >(),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    tenantIdx: index('record_layout_configs_tenant_idx').on(table.tenantId),
    tenantObjectIdx: index('record_layout_configs_tenant_object_idx').on(
      table.tenantId,
      table.objectType,
    ),
  }),
);

// ==================== Zod Schemas ====================

// Filter condition schema for validation
const filterConditionSchema = z.object({
  field: z.string(),
  operator: z.string(),
  value: z.any(),
  conjunction: z.enum(['AND', 'OR']).optional(),
});

const sortConfigSchema = z.object({
  field: z.string(),
  direction: z.enum(['asc', 'desc']),
});

const columnConfigSchema = z.object({
  field: z.string(),
  label: z.string(),
  visible: z.boolean(),
  width: z.number().optional(),
  order: z.number(),
});

const boardConfigSchema = z.object({
  cardFields: z.array(z.object({
    field: z.string(),
    label: z.string(),
    position: z.number(),
    format: z.string().optional(),
  })).optional(),
  columnTotals: z.enum(['sum', 'count', 'weighted', 'average', 'none']).optional(),
  groupBy: z.string().optional(),
});

export const insertSavedViewSchema = createInsertSchema(savedViews).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  filterDefinition: z.array(filterConditionSchema).optional().nullable(),
  sortConfig: sortConfigSchema.optional().nullable(),
  columnConfig: z.array(columnConfigSchema).optional().nullable(),
  boardConfig: boardConfigSchema.optional().nullable(),
});

export const updateSavedViewSchema = insertSavedViewSchema.partial().omit({
  tenantId: true,
  userId: true,
});

export const insertSavedViewPinSchema = createInsertSchema(savedViewPins).omit({
  id: true,
  createdAt: true,
});

export const insertBoardCardConfigSchema = createInsertSchema(boardCardConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDealTagSchema = createInsertSchema(dealTags).omit({
  id: true,
  createdAt: true,
});

export const insertDealTagAssignmentSchema = createInsertSchema(dealTagAssignments).omit({
  id: true,
  assignedAt: true,
});

export const insertRecordLayoutConfigSchema = createInsertSchema(recordLayoutConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ==================== Type Exports ====================

export type SavedView = typeof savedViews.$inferSelect;
export type InsertSavedView = z.infer<typeof insertSavedViewSchema>;

export type SavedViewPin = typeof savedViewPins.$inferSelect;
export type InsertSavedViewPin = z.infer<typeof insertSavedViewPinSchema>;

export type BoardCardConfig = typeof boardCardConfigs.$inferSelect;
export type InsertBoardCardConfig = z.infer<typeof insertBoardCardConfigSchema>;

export type DealTag = typeof dealTags.$inferSelect;
export type InsertDealTag = z.infer<typeof insertDealTagSchema>;

export type DealTagAssignment = typeof dealTagAssignments.$inferSelect;
export type InsertDealTagAssignment = z.infer<typeof insertDealTagAssignmentSchema>;

export type RecordLayoutConfig = typeof recordLayoutConfigs.$inferSelect;
export type InsertRecordLayoutConfig = z.infer<typeof insertRecordLayoutConfigSchema>;
