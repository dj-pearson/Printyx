/**
 * The product catalogue is no longer writable by every authenticated user
 * (SEC-EDGE-001).
 *
 * 281 of 284 edge functions authenticate the user, resolve the tenant and stop.
 * Production serves the catalogue from these functions, so any member of a
 * tenant - a technician, an inside sales rep - could add, edit or delete a
 * product model, a supply or a vendor. The Express handlers beside them DID
 * carry a gate, which is the sharper version of the finding: somebody noticed,
 * fixed it on the side that stopped running, and the fix has been inert since
 * the prefix was proxied.
 *
 * Reads stay open, because the pages beside them set no minimum level: a rep
 * pricing a quote and a technician looking up a part both have to see the
 * catalogue. What was open and should not have been is the write.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  _clearPermissionCache,
  denyBelowLevel,
  denyWithoutPermission,
  roleLevelClaim,
} from '../../../supabase/functions/_shared/rbac.ts';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

const GATED = [
  'product-models',
  'product-accessories',
  'products',
  'supplies',
  'inventory',
  'vendors',
];

/** A stub that answers the one users→roles join these helpers make. */
function stubAdmin(row: unknown, throws = false) {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq']) chain[m] = () => chain;
  chain.maybeSingle = async () => {
    if (throws) throw new Error('connection reset');
    return { data: row, error: null };
  };
  return { from: () => chain } as never;
}

describe('the gate is on every write and on no read', () => {
  for (const fn of GATED) {
    const src = read(`supabase/functions/${fn}/index.ts`);

    it(`${fn} gates non-GET methods`, () => {
      expect(src).toContain("req.method !== 'GET' && req.method !== 'HEAD'");
      expect(src).toContain('denyWithoutPermission(admin, user, WRITE_PERMISSION)');
    });

    it(`${fn} names a code the seeder creates`, () => {
      // SEC-EDGE-002's whole point: a gate on an unseeded code denies every
      // role below platform admin, so copying the old Express code here would
      // have swapped one wrong answer for another.
      const seeded = read('server/database-updater/seeders/rbac-seeder.ts');
      const code = /const WRITE_PERMISSION = '([^']+)'/.exec(src)?.[1];
      expect(code).toBe('operations.inventory.manage');
      expect(seeded).toContain(`code: '${code}'`);
    });

    it(`${fn} gates before it dispatches`, () => {
      // After the gate the handler branches on method and path. A gate placed
      // after the first branch guards nothing that returns early.
      const gateAt = src.indexOf('denyWithoutPermission');
      const firstBranch = src.search(/if \(req\.method === '(POST|PUT|PATCH|DELETE)'/);
      expect(gateAt).toBeGreaterThan(0);
      if (firstBranch > 0) expect(gateAt).toBeLessThan(firstBranch);
    });
  }
});

describe('a stale token does not lock its owner out', () => {
  it('an absent level claim falls through to the database', async () => {
    // getRoleLevel answers 1 with no claim, which is right for a claim check
    // and wrong as an authorisation decision: WF-R-03 writes the claim at role
    // assignment plus a backfill, so a token minted before then carries none.
    // Gating on the claim alone would 403 a company admin out of their own
    // catalogue on deploy day and tell them their role was too low.
    _clearPermissionCache();
    const user = { id: 'u1', app_metadata: {} };
    expect(roleLevelClaim(user)).toBe(null);
    expect(await denyBelowLevel(stubAdmin({ role: { level: 5 } }), user, 4)).toBe(null);
  });

  it('a present claim is trusted without a query', async () => {
    _clearPermissionCache();
    // The claim is signed. Re-reading it would cost a query per request.
    const denied = await denyBelowLevel(
      stubAdmin(null, true),
      { id: 'u2', app_metadata: { roleLevel: 6 } },
      4,
    );
    expect(denied).toBe(null);
  });

  it('a permission claim missing from the token is read from the role', async () => {
    _clearPermissionCache();
    const denied = await denyWithoutPermission(
      stubAdmin({ role: { permissions: { operations: { inventory: ['manage'] } } } }),
      { id: 'u3', app_metadata: {} },
      'operations.inventory.manage',
    );
    expect(denied).toBe(null);
  });
});

describe('it fails closed', () => {
  it('a failed level lookup denies rather than admits', async () => {
    _clearPermissionCache();
    const denied = await denyBelowLevel(stubAdmin(null, true), { id: 'u4', app_metadata: {} }, 4);
    expect(denied?.code).toBe('INSUFFICIENT_ROLE');
    expect(denied?.actual).toBe(1);
  });

  it('a failed permission lookup denies rather than admits', async () => {
    _clearPermissionCache();
    const denied = await denyWithoutPermission(
      stubAdmin(null, true),
      { id: 'u5', app_metadata: {} },
      'operations.inventory.manage',
    );
    expect(denied?.code).toBe('MISSING_PERMISSION');
  });

  it('a user with a different permission is denied', async () => {
    _clearPermissionCache();
    const denied = await denyWithoutPermission(
      stubAdmin({ role: { permissions: { operations: { inventory: ['view'] } } } }),
      { id: 'u6', app_metadata: {} },
      'operations.inventory.manage',
    );
    expect(denied?.required).toEqual(['operations.inventory.manage']);
  });

  it('a platform admin passes without a lookup', async () => {
    _clearPermissionCache();
    const denied = await denyWithoutPermission(
      stubAdmin(null, true),
      { id: 'u7', app_metadata: { roleLevel: 8 } },
      'operations.inventory.manage',
    );
    expect(denied).toBe(null);
  });
});

describe('the denial says what is needed', () => {
  it('names the permission, not just "forbidden"', async () => {
    // A 403 that says only "forbidden" sends the user to support.
    _clearPermissionCache();
    const denied = await denyWithoutPermission(
      stubAdmin({ role: { permissions: {} } }),
      { id: 'u8', app_metadata: {} },
      'operations.inventory.manage',
    );
    expect(denied?.error).toContain('operations.inventory.manage');
  });

  it('names the level held and the level required', async () => {
    _clearPermissionCache();
    const denied = await denyBelowLevel(
      stubAdmin({ role: { level: 2 } }),
      { id: 'u9', app_metadata: {} },
      5,
    );
    expect(denied?.required).toBe(5);
    expect(denied?.actual).toBe(2);
  });
});

describe('the ratchet moved', () => {
  it('none of the six is still recorded as open to all roles', () => {
    const baseline = JSON.parse(read('docs/edge-rbac-baseline.json'));
    for (const fn of GATED) {
      expect(baseline.openToAllRoles, fn).not.toContain(fn);
    }
  });
});
