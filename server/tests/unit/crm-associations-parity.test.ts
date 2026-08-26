// COP-M05 parity lock for the CRM association vocabulary.
//
// The rules live twice: shared/crm-associations-schema.ts for Express and
// supabase/functions/_shared/crm-associations.ts for the edge functions. The
// Node file imports drizzle-zod and cannot be loaded in Deno, which is why the
// copy exists; this suite is what stops the two drifting.
//
// The gap this closed: the crm edge function accepted ANY string as
// sourceType/targetType while Express validated against CRM_ASSOCIABLE_TYPES.
// Production runs the edge function, so the validation was on the host that
// does not serve users.
import { describe, it, expect } from 'vitest';

import * as node from '@shared/crm-associations-schema';
import * as edge from '../../../supabase/functions/_shared/crm-associations';

describe('the association vocabulary matches across copies', () => {
  it('CRM_ASSOCIABLE_TYPES is identical', () => {
    expect(edge.CRM_ASSOCIABLE_TYPES).toEqual(node.CRM_ASSOCIABLE_TYPES);
  });

  it('CRM_RECORD_TYPES is identical', () => {
    expect(edge.CRM_RECORD_TYPES).toEqual(node.CRM_RECORD_TYPES);
  });

  it('DEAL_EQUIPMENT_RELATIONS is identical', () => {
    expect(edge.DEAL_EQUIPMENT_RELATIONS).toEqual(node.DEAL_EQUIPMENT_RELATIONS);
  });

  it('includes equipment, which is what COP-M05 added', () => {
    expect(node.CRM_ASSOCIABLE_TYPES).toContain('equipment');
  });
});

const links = [
  { sourceType: 'deal', targetType: 'equipment', relation: 'replaces' },
  { sourceType: 'deal', targetType: 'equipment', relation: 'places' },
  { sourceType: 'equipment', targetType: 'deal', relation: 'replaces' },
  // No relation at all means the 'related' default, which says nothing about
  // direction and is rejected for this pair.
  { sourceType: 'deal', targetType: 'equipment' },
  { sourceType: 'deal', targetType: 'equipment', relation: 'related' },
  { sourceType: 'deal', targetType: 'equipment', relation: 'swaps' },
  // Every other pair keeps the free-form label.
  { sourceType: 'deal', targetType: 'contact', relation: 'related' },
  { sourceType: 'task', targetType: 'deal' },
];

describe('dealEquipmentRelationError agrees across copies', () => {
  it.each(links)('%o', (link) => {
    expect(edge.dealEquipmentRelationError(link)).toEqual(node.dealEquipmentRelationError(link));
  });

  it('accepts both roles and rejects everything else on a deal-equipment link', () => {
    for (const relation of node.DEAL_EQUIPMENT_RELATIONS) {
      expect(
        node.dealEquipmentRelationError({
          sourceType: 'deal',
          targetType: 'equipment',
          relation,
        }),
      ).toBeNull();
    }
    expect(
      node.dealEquipmentRelationError({
        sourceType: 'deal',
        targetType: 'equipment',
        relation: 'related',
      }),
    ).toMatch(/needs relation/);
  });

  it('leaves non-equipment pairs alone', () => {
    expect(
      node.dealEquipmentRelationError({
        sourceType: 'deal',
        targetType: 'contact',
        relation: 'whatever',
      }),
    ).toBeNull();
  });
});

describe('insertCrmAssociationSchema enforces the same rule Zod-side', () => {
  it('rejects a deal-equipment link with no role', () => {
    const result = node.insertCrmAssociationSchema.safeParse({
      sourceType: 'deal',
      sourceId: 'd1',
      targetType: 'equipment',
      targetId: 'e1',
    });
    expect(result.success).toBe(false);
  });

  it('accepts one with a role', () => {
    const result = node.insertCrmAssociationSchema.safeParse({
      sourceType: 'deal',
      sourceId: 'd1',
      targetType: 'equipment',
      targetId: 'e1',
      relation: 'replaces',
    });
    expect(result.success).toBe(true);
  });

  it('accepts equipment as a record type at all, which it did not before', () => {
    const result = node.insertCrmAssociationSchema.safeParse({
      sourceType: 'equipment',
      sourceId: 'e1',
      targetType: 'deal',
      targetId: 'd1',
      relation: 'places',
    });
    expect(result.success).toBe(true);
  });
});

describe('associationCreateError is the edge-side equivalent of the Zod schema', () => {
  const cases: Array<[string, Record<string, unknown>, boolean]> = [
    ['missing fields', { sourceType: 'deal' }, false],
    [
      'unknown source type',
      { sourceType: 'widget', sourceId: 'a', targetType: 'deal', targetId: 'b' },
      false,
    ],
    [
      'unknown target type',
      { sourceType: 'deal', sourceId: 'a', targetType: 'widget', targetId: 'b' },
      false,
    ],
    [
      'over-long relation',
      {
        sourceType: 'deal',
        sourceId: 'a',
        targetType: 'contact',
        targetId: 'b',
        relation: 'x'.repeat(41),
      },
      false,
    ],
    [
      'deal-equipment with no role',
      { sourceType: 'deal', sourceId: 'a', targetType: 'equipment', targetId: 'b' },
      false,
    ],
    [
      'deal-equipment with a role',
      {
        sourceType: 'deal',
        sourceId: 'a',
        targetType: 'equipment',
        targetId: 'b',
        relation: 'places',
      },
      true,
    ],
    [
      'ordinary pair',
      { sourceType: 'task', sourceId: 'a', targetType: 'deal', targetId: 'b' },
      true,
    ],
  ];

  it.each(cases)('%s', (_name, body, ok) => {
    const error = edge.associationCreateError(body);
    expect(error === null).toBe(ok);
  });

  it('matches the Zod schema on every case above', () => {
    for (const [, body, ok] of cases) {
      // safeParse also enforces min-length ids, which associationCreateError
      // covers with its presence check, so the two verdicts should agree.
      expect(node.insertCrmAssociationSchema.safeParse(body).success).toBe(ok);
    }
  });
});
