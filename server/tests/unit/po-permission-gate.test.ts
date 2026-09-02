/**
 * WF-P-05: one permission vocabulary for purchase-order approval, on both hosts.
 *
 * Three competed. The sidebar reads operations.po.* (which a seeded
 * OPERATIONS_MANAGER holds). Dev Express checked inventory.po.*, held by NO seeded
 * role, so dev denied every non-admin. The production edge function checked
 * nothing, so production allowed everyone - and production is the host that runs.
 *
 * The interesting part is the link that made a code gate possible at all: WF-R-09
 * fills roles.permissions with MODULE booleans, and flattening a module blob gives
 * module NAMES, so a gate on a three-segment code matched nothing for anybody.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { expandLegacyPermissions as clientExpand } from '../../../client/src/lib/navigation-permissions';
import { expandLegacyPermissions as edgeExpand } from '../../../supabase/functions/_shared/permission-expansion';
import { permissionCodes } from '../../../supabase/functions/_shared/role-claims';
import {
  hasPermissionClaim,
  permissionClaims,
} from '../../../supabase/functions/_shared/permission-claim';

const MODULES = [
  'sales',
  'service',
  'products',
  'inventory',
  'purchasing',
  'billing',
  'finance',
  'reports',
  'system',
];

/** The blob migration 0073 writes for a code. */
function seededBlob(code: string): Record<string, boolean> {
  const sql = readFileSync('drizzle/migrations/0073_role_module_permissions.sql', 'utf8');
  const m = new RegExp(`'${code}', '(\\{[^']*\\})'`).exec(sql);
  expect(m, `${code} must be seeded`).not.toBeNull();
  return JSON.parse(m![1]);
}

function seededLevel(code: string): number {
  const sql = readFileSync('drizzle/migrations/0072_seed_role_catalogue.sql', 'utf8');
  const m = new RegExp(`'${code}', '[a-z_]+', '[a-z_]+', (\\d+),`).exec(sql);
  expect(m, `${code} must be seeded`).not.toBeNull();
  return Number(m![1]);
}

describe('WF-P-05: the expansion agrees on both sides', () => {
  it('matches the client for every module combination at every level', () => {
    // Driven rather than diffed: the two files are separate ports and a textual
    // comparison would pass on two that disagree.
    for (let bits = 0; bits < 1 << MODULES.length; bits += 37) {
      const blob: Record<string, boolean> = {};
      MODULES.forEach((m, i) => (blob[m] = Boolean(bits & (1 << i))));
      for (let level = 1; level <= 8; level++) {
        expect([...edgeExpand(blob, level)].sort(), `bits=${bits} level=${level}`).toEqual(
          [...clientExpand(blob, level)].sort(),
        );
      }
    }
  });

  it('agrees on the empty blob and on every module at once', () => {
    const all = Object.fromEntries(MODULES.map((m) => [m, true]));
    for (let level = 1; level <= 8; level++) {
      expect([...edgeExpand({}, level)]).toEqual([...clientExpand({}, level)]);
      expect([...edgeExpand(all, level)].sort()).toEqual([...clientExpand(all, level)].sort());
    }
  });
});

describe('WF-P-05: the claim carries codes, not module names', () => {
  it('expands a module blob', () => {
    // Flattening {inventory:true} gives ['inventory'] - a module NAME, which
    // matches no gate. This is the bug the expansion exists to fix.
    const codes = permissionCodes({ inventory: true, purchasing: true }, 4);
    expect(codes).toContain('operations.po.approve');
    expect(codes).not.toEqual(['inventory', 'purchasing']);
  });

  it('still flattens a nested three-segment blob, the canonical shape', () => {
    const codes = permissionCodes({ sales: { lead: ['view_own'] } }, 1);
    expect(codes).toEqual(['sales.lead.view_own']);
  });

  it('returns nothing for a blob that is neither', () => {
    expect(permissionCodes(null, 4)).toEqual([]);
    expect(permissionCodes({}, 4)).toEqual([]);
  });
});

describe('WF-P-05: who may approve (AC4)', () => {
  const codesFor = (role: string) => permissionCodes(seededBlob(role), seededLevel(role));

  it('OPERATIONS_MANAGER holds operations.po.approve', () => {
    expect(codesFor('OPERATIONS_MANAGER')).toContain('operations.po.approve');
  });

  it('WAREHOUSE_ASSOCIATE does not', () => {
    const codes = codesFor('WAREHOUSE_ASSOCIATE');
    expect(codes).not.toContain('operations.po.approve');
    // But they can still see the queue and receive against it.
    expect(codes).toContain('operations.po.view');
    expect(codes).toContain('operations.warehouse.receive');
  });

  it('a WAREHOUSE_SUPERVISOR is still below the approval line', () => {
    // Level 3: the ladder starts at 4, the same line purchase-orders draws for
    // lifting the row scope.
    expect(codesFor('WAREHOUSE_SUPERVISOR')).not.toContain('operations.po.approve');
  });

  it('COMPANY_ADMIN holds it, because level 7 gets every module', () => {
    expect(codesFor('COMPANY_ADMIN')).toContain('operations.po.approve');
  });

  it('a SALES_REP holds neither, having no inventory module', () => {
    const codes = codesFor('SALES_REP');
    expect(codes).not.toContain('operations.po.approve');
    expect(codes).not.toContain('operations.po.view');
  });
});

describe('WF-P-05: the claim check itself', () => {
  it('admits a caller whose claim carries the code', () => {
    expect(
      hasPermissionClaim({ permissions: ['operations.po.approve'] }, 'operations.po.approve'),
    ).toBe(true);
  });

  it('DENIES a caller with no permissions claim at all', () => {
    // A token issued before WF-R-03 has no list. Reading "no list" as "everything"
    // is how a gate passes for exactly the people it exists to stop; requireAuth
    // backfills the claim on the first request, so the state is brief.
    expect(hasPermissionClaim({}, 'operations.po.approve')).toBe(false);
    expect(hasPermissionClaim(null, 'operations.po.approve')).toBe(false);
  });

  it('lets a platform admin through, as _shared/rbac.ts does', () => {
    expect(hasPermissionClaim({ isPlatformAdmin: true }, 'operations.po.approve')).toBe(true);
    expect(hasPermissionClaim({ roleLevel: 8 }, 'operations.po.approve')).toBe(true);
  });

  it('ignores a non-string in the claim array', () => {
    expect(permissionClaims({ permissions: ['a', 1, null, 'b'] })).toEqual(['a', 'b']);
    expect(permissionClaims({ permissions: 'nope' })).toEqual([]);
  });
});

describe('WF-P-05: the endpoints are gated and the hosts agree', () => {
  const edge = readFileSync('supabase/functions/purchase-orders/index.ts', 'utf8');

  it('approve, reject and submit require an operations.po code', () => {
    expect(
      [...edge.matchAll(/denyWithoutPermission\('operations\.po\.approve'\)/g)].length,
    ).toBeGreaterThanOrEqual(3); // approve, reject, and status->approved
    expect(edge).toMatch(/denyWithoutPermission\('operations\.po\.create'\)/);
  });

  it('serves /:id/status, which PurchaseOrders.tsx calls and this had no branch for', () => {
    // It worked in dev on Express and 404'd in production.
    expect(edge).toMatch(/subResource === 'status'/);
    const page = readFileSync('client/src/pages/PurchaseOrders.tsx', 'utf8');
    expect(page).toMatch(/\/api\/purchase-orders\/\$\{id\}\/status/);
  });

  it('does not let the status control skip the approval gate', () => {
    // A PATCH to status:'approved' that bypasses the check is the gate not existing.
    expect(edge).toMatch(
      /status === 'approved' \|\| status === 'rejected'[\s\S]{0,160}?operations\.po\.approve/,
    );
  });

  it('the Express router is gone and the prefix is proxied', () => {
    expect(existsSync('server/routes-purchase-orders.ts')).toBe(false);
    const proxy = readFileSync('server/middleware/edge-function-proxy.ts', 'utf8');
    expect(proxy).toMatch(/'\/api\/purchase-orders': 'purchase-orders'/);
    const registry = readFileSync('server/routes-registry.ts', 'utf8');
    expect(registry).not.toMatch(/registerPurchaseOrderRoutes\(app\)/);
  });

  it('the second Express router on the same prefix is gone too', () => {
    // routes-products-crud.ts served four of the same paths - two routers on one
    // prefix, with mount order deciding the winner.
    const crud = readFileSync('server/routes-products-crud.ts', 'utf8');
    expect(crud).not.toMatch(/app\.(get|post)\(\s*'\/api\/purchase-orders/);
  });
});
