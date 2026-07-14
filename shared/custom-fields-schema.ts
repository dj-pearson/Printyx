/**
 * Custom Fields Schema (CRMX-003)
 *
 * User-defined fields on canonical CRM objects (business_records leads/customers,
 * companyContacts, deals, companies). Admins define fields here; values are stored
 * on the object's existing `customFields` jsonb column, keyed by `key`.
 *
 * This is the platform primitive that lets a dealer bend the CRM to their process
 * without a code change — the single largest platform gap vs HubSpot.
 *
 * Read/write contract for values (documented, no separate value table):
 *   - A definition with objectType='deals', key='contract_term' declares a field.
 *   - The value lives at `deals.customFields->>'contract_term'` (jsonb), keyed by `key`.
 *   - Reads/writes go through the object's normal API; validateCustomFieldValues()
 *     (server/routes-custom-fields.ts) enforces required/typed definitions on write.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// ==================== Enums ====================

// Distinct name from crm-views' `crm_object_type` (avoids a pgEnum name conflict).
export const customFieldObjectTypeEnum = pgEnum('custom_field_object_type', [
  'deals',
  'leads',
  'contacts',
  'companies',
]);

export const customFieldTypeEnum = pgEnum('custom_field_type', [
  'text',
  'number',
  'date',
  'boolean',
  'select',
  'multiselect',
  'url',
  'email',
]);

export const CUSTOM_FIELD_OBJECT_TYPES = ['deals', 'leads', 'contacts', 'companies'] as const;

export const CUSTOM_FIELD_TYPES = [
  'text',
  'number',
  'date',
  'boolean',
  'select',
  'multiselect',
  'url',
  'email',
] as const;

// ==================== Table ====================

export const customFieldDefinitions = pgTable(
  'custom_field_definitions',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),

    objectType: customFieldObjectTypeEnum('object_type').notNull(),
    // Machine key used inside the object's customFields jsonb (e.g. "contract_term").
    key: varchar('key', { length: 64 }).notNull(),
    // Human label shown in the UI.
    label: varchar('label', { length: 255 }).notNull(),
    fieldType: customFieldTypeEnum('field_type').notNull(),
    // For select/multiselect: array of { value, label }. Null otherwise.
    options: jsonb('options').$type<Array<{ value: string; label: string }>>(),
    required: boolean('required').notNull().default(false),
    // Stored as text; coerced per fieldType at read/validate time.
    defaultValue: text('default_value'),
    description: text('description'),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),

    createdBy: varchar('created_by'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    // One key per object type per tenant.
    tenantObjectKeyUnique: unique('custom_field_definitions_tenant_object_key_uq').on(
      table.tenantId,
      table.objectType,
      table.key,
    ),
    tenantObjectIdx: index('custom_field_definitions_tenant_object_idx').on(
      table.tenantId,
      table.objectType,
    ),
  }),
);

// ==================== Zod ====================

const optionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
});

// A field `key` must be a safe jsonb key: lowercase snake, starts with a letter.
const fieldKeySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/, 'key must be lower_snake_case and start with a letter');

export const insertCustomFieldDefinitionSchema = createInsertSchema(customFieldDefinitions, {
  key: fieldKeySchema,
  label: z.string().min(1).max(255),
  objectType: z.enum(CUSTOM_FIELD_OBJECT_TYPES),
  fieldType: z.enum(CUSTOM_FIELD_TYPES),
  options: z.array(optionSchema).nullable().optional(),
  required: z.boolean().optional(),
  defaultValue: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
}).omit({
  id: true,
  tenantId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
});

export const updateCustomFieldDefinitionSchema = insertCustomFieldDefinitionSchema
  .partial()
  // objectType + key are identity — not editable after creation.
  .omit({ objectType: true, key: true });

export type CustomFieldDefinition = typeof customFieldDefinitions.$inferSelect;
export type InsertCustomFieldDefinition = z.infer<typeof insertCustomFieldDefinitionSchema>;
export type CustomFieldObjectType = (typeof CUSTOM_FIELD_OBJECT_TYPES)[number];
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];
