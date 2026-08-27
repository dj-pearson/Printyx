/**
 * CRM Notes + Associations Schema (CRMX-006)
 *
 * Two additive primitives every mature CRM has:
 *  - crm_notes: a first-class Note attached polymorphically to any CRM record
 *    (deal/lead/contact/company). Previously notes were only an activity subtype.
 *  - crm_associations: a generic join linking any CRM record to any other
 *    (e.g. a task/activity to a deal, a contact to a company). Lets tasks and
 *    activities be polymorphically associated instead of hard-wired to one FK.
 *
 * Parent/record types are stored as varchar (validated at the API layer) rather
 * than a pgEnum, so new record types don't require an enum migration.
 * Canonical record types: 'deal' | 'lead' | 'contact' | 'company'
 * (see docs/crm-canonical-model.md). Associations also allow 'task' | 'activity' | 'note'.
 */
import { sql } from 'drizzle-orm';
import { boolean, index, pgTable, text, timestamp, unique, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const CRM_RECORD_TYPES = ['deal', 'lead', 'contact', 'company'] as const;
export const CRM_ASSOCIABLE_TYPES = [
  'deal',
  'lead',
  'contact',
  'company',
  'task',
  'activity',
  'note',
  // COP-M05: installed-base machines. A copier deal is defined by the serials it
  // replaces and the serials it places, and `deals` had no link to `equipment`
  // at all. It goes through this generic join rather than a bespoke deal_equipment
  // table, so the link survives the lead -> customer lifecycle like every other
  // association and needs no migration.
  'equipment',
] as const;

/**
 * COP-M05. A deal<->equipment link MUST say which way it points. 'replaces' is a
 * machine going out (its buyout and current volume price the deal); 'places' is a
 * machine going in (it prices the proposal). The default 'related' is meaningless
 * here and would make the Opportunity Radar in COP-B04 unable to tell the two
 * apart, so it is rejected rather than accepted and guessed at later.
 */
export const DEAL_EQUIPMENT_RELATIONS = ['replaces', 'places'] as const;

/** True when the pair is a deal<->equipment link, in either direction. */
export function isDealEquipmentLink(sourceType: string, targetType: string): boolean {
  return (
    (sourceType === 'deal' && targetType === 'equipment') ||
    (sourceType === 'equipment' && targetType === 'deal')
  );
}

/**
 * Returns an error message when the association is a deal<->equipment link
 * carrying a relation outside DEAL_EQUIPMENT_RELATIONS, otherwise null.
 * Duplicated for Deno at supabase/functions/_shared/crm-associations.ts and
 * locked by server/tests/unit/crm-associations-parity.test.ts.
 */
export function dealEquipmentRelationError(link: {
  sourceType: string;
  targetType: string;
  relation?: string | null;
}): string | null {
  if (!isDealEquipmentLink(link.sourceType, link.targetType)) return null;
  const relation = link.relation ?? 'related';
  if ((DEAL_EQUIPMENT_RELATIONS as readonly string[]).includes(relation)) return null;
  return `A deal-equipment association needs relation ${DEAL_EQUIPMENT_RELATIONS.map((r) => `'${r}'`).join(' or ')}, got '${relation}'.`;
}

// ==================== Notes ====================

export const crmNotes = pgTable(
  'crm_notes',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),

    // Polymorphic parent — which record this note is attached to.
    parentType: varchar('parent_type', { length: 20 }).notNull(), // deal|lead|contact|company
    parentId: varchar('parent_id').notNull(),

    body: text('body').notNull(),
    isPinned: boolean('is_pinned').notNull().default(false),

    authorId: varchar('author_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tenantParentIdx: index('crm_notes_tenant_parent_idx').on(
      table.tenantId,
      table.parentType,
      table.parentId,
    ),
  }),
);

// ==================== Associations ====================

export const crmAssociations = pgTable(
  'crm_associations',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tenantId: varchar('tenant_id').notNull(),

    sourceType: varchar('source_type', { length: 20 }).notNull(),
    sourceId: varchar('source_id').notNull(),
    targetType: varchar('target_type', { length: 20 }).notNull(),
    targetId: varchar('target_id').notNull(),
    // Optional relation label, e.g. 'primary_contact', 'related', 'reports_to'.
    relation: varchar('relation', { length: 40 }).notNull().default('related'),

    createdBy: varchar('created_by'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    // A given directed link with a relation is unique.
    linkUnique: unique('crm_associations_link_uq').on(
      table.tenantId,
      table.sourceType,
      table.sourceId,
      table.targetType,
      table.targetId,
      table.relation,
    ),
    tenantSourceIdx: index('crm_associations_tenant_source_idx').on(
      table.tenantId,
      table.sourceType,
      table.sourceId,
    ),
    tenantTargetIdx: index('crm_associations_tenant_target_idx').on(
      table.tenantId,
      table.targetType,
      table.targetId,
    ),
  }),
);

// ==================== Zod ====================

export const insertCrmNoteSchema = createInsertSchema(crmNotes, {
  parentType: z.enum(CRM_RECORD_TYPES),
  parentId: z.string().min(1),
  body: z.string().min(1),
  isPinned: z.boolean().optional(),
}).omit({ id: true, tenantId: true, authorId: true, createdAt: true, updatedAt: true });

export const updateCrmNoteSchema = z.object({
  body: z.string().min(1).optional(),
  isPinned: z.boolean().optional(),
});

export const insertCrmAssociationSchema = createInsertSchema(crmAssociations, {
  sourceType: z.enum(CRM_ASSOCIABLE_TYPES),
  sourceId: z.string().min(1),
  targetType: z.enum(CRM_ASSOCIABLE_TYPES),
  targetId: z.string().min(1),
  relation: z.string().max(40).optional(),
})
  .omit({ id: true, tenantId: true, createdBy: true, createdAt: true })
  // COP-M05: the role is mandatory on a deal<->equipment link. Every other pair
  // keeps the free-form label and its 'related' default.
  .superRefine((link, ctx) => {
    const message = dealEquipmentRelationError(link);
    if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['relation'], message });
  });

export type CrmNote = typeof crmNotes.$inferSelect;
export type InsertCrmNote = z.infer<typeof insertCrmNoteSchema>;
export type CrmAssociation = typeof crmAssociations.$inferSelect;
export type InsertCrmAssociation = z.infer<typeof insertCrmAssociationSchema>;
export type CrmRecordType = (typeof CRM_RECORD_TYPES)[number];
export type CrmAssociableType = (typeof CRM_ASSOCIABLE_TYPES)[number];
