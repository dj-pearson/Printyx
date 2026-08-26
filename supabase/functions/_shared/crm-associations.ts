/**
 * CRM association vocabulary — Deno copy (COP-M05).
 *
 * shared/crm-associations-schema.ts is the Node twin and holds the Drizzle
 * table plus the Zod schema; this file carries only the parts an edge function
 * needs, because the Node file imports drizzle-zod and cannot be loaded here.
 * server/tests/unit/crm-associations-parity.test.ts imports both and fails if
 * they drift.
 *
 * Why this exists at all: the crm edge function accepted ANY string as
 * sourceType/targetType, while Express validated against CRM_ASSOCIABLE_TYPES.
 * Production runs the edge function, so the validation that existed was on the
 * host that does not serve users.
 */

export const CRM_RECORD_TYPES = ['deal', 'lead', 'contact', 'company'] as const;

export const CRM_ASSOCIABLE_TYPES = [
  'deal',
  'lead',
  'contact',
  'company',
  'task',
  'activity',
  'note',
  'equipment',
] as const;

/**
 * A deal<->equipment link MUST say which way it points. 'replaces' is a machine
 * going out (its buyout and current volume price the deal); 'places' is a machine
 * going in. The default 'related' is meaningless here.
 */
export const DEAL_EQUIPMENT_RELATIONS = ['replaces', 'places'] as const;

export type CrmAssociableType = (typeof CRM_ASSOCIABLE_TYPES)[number];
export type DealEquipmentRelation = (typeof DEAL_EQUIPMENT_RELATIONS)[number];

export function isCrmAssociableType(value: unknown): value is CrmAssociableType {
  return typeof value === 'string' && (CRM_ASSOCIABLE_TYPES as readonly string[]).includes(value);
}

/** True when the pair is a deal<->equipment link, in either direction. */
export function isDealEquipmentLink(sourceType: string, targetType: string): boolean {
  return (
    (sourceType === 'deal' && targetType === 'equipment') ||
    (sourceType === 'equipment' && targetType === 'deal')
  );
}

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

/**
 * Full validation for an association create. Returns an error message or null.
 * Mirrors what insertCrmAssociationSchema enforces on the Node side.
 */
export function associationCreateError(body: {
  sourceType?: unknown;
  sourceId?: unknown;
  targetType?: unknown;
  targetId?: unknown;
  relation?: unknown;
}): string | null {
  if (!body.sourceType || !body.sourceId || !body.targetType || !body.targetId) {
    return 'sourceType, sourceId, targetType, targetId are required';
  }
  if (!isCrmAssociableType(body.sourceType)) {
    return `sourceType must be one of ${CRM_ASSOCIABLE_TYPES.join(', ')}`;
  }
  if (!isCrmAssociableType(body.targetType)) {
    return `targetType must be one of ${CRM_ASSOCIABLE_TYPES.join(', ')}`;
  }
  if (body.relation !== undefined && body.relation !== null) {
    if (typeof body.relation !== 'string' || body.relation.length > 40) {
      return 'relation must be a string of at most 40 characters';
    }
  }
  return dealEquipmentRelationError({
    sourceType: body.sourceType,
    targetType: body.targetType,
    relation: (body.relation as string | undefined) ?? undefined,
  });
}
