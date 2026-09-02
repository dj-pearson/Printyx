/**
 * WF-R-06: operations, and the first row-level scope check on WRITES.
 *
 * A list filter narrows what a caller can BROWSE and says nothing about a write
 * aimed straight at an id. Before this, a level-1 associate who knew a
 * purchase-order id could approve it - nothing gated /approve at all - and could
 * edit, submit or receive against an order somebody else raised. Same for a
 * warehouse operation's status and a colleague's task.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import {
  resolveScope,
  rowInScope,
  unscopedAtLevel,
  type ResolvedScope,
} from '../../../supabase/functions/_shared/scope';

const read = (p: string) => readFileSync(p, 'utf8');
/** Comments describe a gate as vividly as code applies one. */
const code = (p: string) =>
  read(p)
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith('//') && !t.startsWith('/*') && !t.startsWith('*');
    })
    .join('\n');

const scopeOf = (
  tier: ResolvedScope['tier'],
  userIds: string[] | null,
  roleLevel = 1,
): ResolvedScope => ({
  tier,
  roleLevel,
  userIds,
  locationIds: null,
  crossTenant: false,
  degradedFrom: null,
});

describe('WF-R-06: rowInScope', () => {
  it('admits a row the caller owns', () => {
    expect(rowInScope({ created_by: 'me' }, 'created_by', scopeOf('own', ['me']))).toBe(true);
  });

  it('refuses a row somebody else owns', () => {
    expect(rowInScope({ created_by: 'you' }, 'created_by', scopeOf('own', ['me']))).toBe(false);
  });

  it('admits a row owned by anyone in the caller tier', () => {
    const team = scopeOf('team', ['me', 'report']);
    expect(rowInScope({ created_by: 'report' }, 'created_by', team)).toBe(true);
    expect(rowInScope({ created_by: 'stranger' }, 'created_by', team)).toBe(false);
  });

  it('matches on ANY of several owner columns', () => {
    const s = scopeOf('own', ['me']);
    expect(
      rowInScope({ assigned_to: 'you', created_by: 'me' }, ['assigned_to', 'created_by'], s),
    ).toBe(true);
  });

  it('treats an unowned row as shared work above own scope, and not at it', () => {
    const row = { assigned_to: null, created_by: null };
    expect(rowInScope(row, ['assigned_to', 'created_by'], scopeOf('team', ['me']))).toBe(true);
    expect(rowInScope(row, ['assigned_to', 'created_by'], scopeOf('own', ['me']))).toBe(false);
    expect(
      rowInScope(row, ['assigned_to', 'created_by'], scopeOf('team', ['me']), {
        includeUnowned: false,
      }),
    ).toBe(false);
  });

  it('treats an empty string as unowned, not as an owner id', () => {
    expect(rowInScope({ created_by: '' }, 'created_by', scopeOf('own', ['me']))).toBe(false);
    expect(rowInScope({ created_by: '' }, 'created_by', scopeOf('team', ['me']))).toBe(true);
  });

  it('admits everything for an unscoped caller, and nothing for a missing row', () => {
    expect(rowInScope({ created_by: 'anyone' }, 'created_by', scopeOf('company', null))).toBe(true);
    expect(rowInScope(null, 'created_by', scopeOf('own', ['me']))).toBe(false);
  });
});

describe('WF-R-06: unscopedAtLevel', () => {
  it('lifts the filter at and above the given level', () => {
    const scoped = scopeOf('team', ['me'], 4);
    expect(unscopedAtLevel(scoped, 4).userIds).toBeNull();
    expect(unscopedAtLevel(scoped, 4).tier).toBe('company');
  });

  it('leaves a caller below it untouched', () => {
    const scoped = scopeOf('own', ['me'], 3);
    expect(unscopedAtLevel(scoped, 4)).toEqual(scoped);
  });
});

describe('WF-R-06: purchase orders', () => {
  const src = code('supabase/functions/purchase-orders/index.ts');

  it('is unscoped from level 4, so an approver sees the whole queue', () => {
    expect(src).toMatch(/unscopedAtLevel\(\s*await resolveScope\([\s\S]{0,300}?\),\s*4,?\s*\)/);
  });

  it('requires a permission to approve or reject, which nothing did before', () => {
    // WF-R-06 gated these on level 4. WF-P-05 replaced that with the permission
    // the sidebar already reads - operations.po.approve, which the expansion
    // grants at level 4 with the inventory or purchasing module, so the line is
    // the same one and it is now named the same way on both sides.
    const gates = [...src.matchAll(/denyWithoutPermission\('operations\.po\.approve'\)/g)];
    // approve, reject, and a status PATCH setting approved/rejected.
    expect(gates.length).toBeGreaterThanOrEqual(3);
    expect(src).toMatch(/MISSING_PERMISSION/);
  });

  it('checks the row on every write that is not an approval', () => {
    // submit, receive, update and the status PATCH each address an id directly.
    expect([...src.matchAll(/rowInScope\(\w+, 'created_by', poScope\)/g)]).toHaveLength(4);
  });

  it('selects created_by wherever it checks it', () => {
    // A row check against a column the select omitted is silently always false.
    for (const m of src.matchAll(/rowInScope\((\w+), 'created_by'/g)) {
      const variable = m[1];
      const before = src.slice(0, m.index);
      const fetch = before.lastIndexOf(`data: ${variable}`);
      expect(fetch, `${variable} must be fetched before it is checked`).toBeGreaterThan(0);
      expect(src.slice(fetch, m.index), `${variable} select`).toMatch(/created_by/);
    }
  });
});

describe('WF-R-06: warehouse operations', () => {
  const src = code('supabase/functions/warehouse-operations/index.ts');

  it('scopes the live list on assigned_to', () => {
    expect(src).toMatch(/applyUserScope\(query, 'assigned_to', scope\)/);
  });

  it('checks the row before changing a status', () => {
    expect(src).toMatch(/rowInScope\(existing, 'assigned_to', patchScope\)/);
    expect(src).toMatch(/ROW_OUT_OF_SCOPE/);
  });

  it('does not invent a location filter the table cannot support', () => {
    // AC1 asked for "the location of the operation". warehouse_operations has 13
    // columns and none of them is a location; faking it would be worse than
    // saying so.
    const schema = read('shared/equipment-schema.ts');
    const i = schema.search(/pgTable\(\s*'warehouse_operations'/);
    // Brace-matched: slicing to the next '\n);' runs past the table into the
    // relations block below it, which DOES name a location.
    let depth = 0;
    let block = '';
    for (let j = schema.indexOf('{', i); j < schema.length; j++) {
      if (schema[j] === '{') depth++;
      else if (schema[j] === '}' && --depth === 0) {
        block = schema.slice(i, j);
        break;
      }
    }
    expect(block).toMatch(/'assigned_to'/);
    expect(block).not.toMatch(/location/);
    expect(src).not.toMatch(/'location_id'/);
  });
});

describe('WF-R-06: equipment lifecycle', () => {
  const src = code('supabase/functions/equipment-lifecycle/index.ts');
  const hub = code('supabase/functions/equipment-lifecycle/_hub.ts');

  it('narrows the board to the caller customers', () => {
    expect(src).toMatch(/await accessibleCustomerIds\(admin, tenantId, scope\)/);
    expect(hub).toMatch(
      /if \(filters\.customerIds\) q = q\.in\('customer_id', filters\.customerIds\)/,
    );
  });

  it('matches nothing rather than everything when the customer set overflows', () => {
    expect(src).toMatch(/customers\.overflow \? \[\] : customers\.ids/);
  });

  it('checks the row before a stage transition', () => {
    expect(src).toMatch(/ROW_OUT_OF_SCOPE/);
    expect(src).toMatch(/if \(existingLifecycle\) \{[\s\S]{0,600}?accessibleCustomerIds/);
  });
});

describe('WF-R-06: tasks', () => {
  const src = code('supabase/functions/tasks/handlers/tasks.ts');

  it('guards update and delete, not only the list', () => {
    expect([...src.matchAll(/await denyIfOutOfScope\(ctx, req, id\)/g)]).toHaveLength(2);
  });

  it('lets a missing task fall through to its own 404', () => {
    // Answering 403 for a task that does not exist leaks which ids are real.
    expect(src).toMatch(/if \(!existing\) return null;/);
  });
});

describe('WF-R-06: an unscoped caller reaches every row', () => {
  it('resolves to no filter at level 7, so nothing above is a lockout', async () => {
    const db = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }),
          }),
        }),
      }),
    } as never;
    const scope = await resolveScope(db, {
      userId: 'boss',
      tenantId: 't1',
      appMetadata: { roleLevel: 7 },
    });
    expect(scope.userIds).toBeNull();
    expect(rowInScope({ created_by: 'anyone' }, 'created_by', scope)).toBe(true);
  });
});
