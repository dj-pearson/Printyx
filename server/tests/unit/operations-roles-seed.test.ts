/**
 * Roles for the middle of the workflow (WF-R-11).
 *
 * The catalogue covered sales, service, finance, warehouse and administration
 * and had nothing for the people between "the deal closed" and "the machine
 * prints" - a buyer, a project coordinator, a delivery and install crew, a
 * network setup technician. Migration 0081 seeds seven.
 *
 * NO NEW PERMISSION CODES, and that is a decision rather than an omission.
 * navigation-permissions.ts derives every granular code from the MODULE
 * booleans on a role plus its level; there is no table of codes to add to. A
 * bespoke code would be satisfiable by nobody, which is SEC-EDGE-002's 77
 * unsatisfiable gates exactly - gates that deny everyone below platform admin.
 * So these roles are made to work with the vocabulary that already exists, and
 * the one derivation change is a split, not an addition.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  expandLegacyPermissions,
  getRoutePermissions,
} from '../../../client/src/lib/navigation-permissions';
import { resolveRoleLayoutKey } from '../../../client/src/lib/dashboard-widget-registry';

const repo = join(__dirname, '../../..');
const migration = readFileSync(
  join(repo, 'drizzle/migrations/0081_wf_r11_operations_roles.sql'),
  'utf8',
);

interface SeededRole {
  code: string;
  department: string;
  level: number;
  modules: Record<string, boolean>;
}

function rolesFromMigration(): SeededRole[] {
  const rows = [
    ...migration.matchAll(
      /\('[^']*',\s*'([A-Z_]+)',\s*'[a-z_]+',\s*'([a-z_]+)',\s*(\d+),\s*\n?\s*'[^']*',\s*\n?\s*'(\{[^']*\})'::jsonb/g,
    ),
  ];
  return rows.map((m) => ({
    code: m[1],
    department: m[2],
    level: Number(m[3]),
    modules: JSON.parse(m[4]),
  }));
}

const EXPECTED = {
  PURCHASING_AGENT: 1,
  PURCHASING_MANAGER: 4,
  PROJECT_COORDINATOR: 2,
  PROJECT_MANAGER: 4,
  DELIVERY_INSTALL_TECH: 1,
  DELIVERY_INSTALL_SUPERVISOR: 3,
  NETWORK_SETUP_TECH: 2,
} as const;

describe('migration 0081 seeds the seven roles the story names', () => {
  const roles = rolesFromMigration();

  it('parses all seven out of the SQL', () => {
    expect(roles.map((r) => r.code).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  for (const [code, level] of Object.entries(EXPECTED)) {
    it(`${code} is seeded at level ${level}`, () => {
      expect(roles.find((r) => r.code === code)?.level).toBe(level);
    });
  }

  it('never leaves a permissions blob empty', () => {
    // WF-R-09: an empty blob expands to an EMPTY permission set at any level,
    // and migration 0073 only fills a blob that is still empty - it has already
    // shipped, so a role seeded after it would keep the empty one forever. That
    // is a lockout, not a gap.
    for (const role of roles) {
      expect(Object.keys(role.modules).length, `${role.code} has an empty blob`).toBeGreaterThan(0);
    }
  });

  it('is idempotent', () => {
    expect(migration).toContain('ON CONFLICT (code) DO NOTHING');
  });
});

describe('each role reaches the pages its stage needs', () => {
  const roles = rolesFromMigration();
  const permsFor = (code: string) => {
    const role = roles.find((r) => r.code === code)!;
    return expandLegacyPermissions(role.modules, role.level);
  };
  const canReach = (code: string, path: string) => {
    const rule = getRoutePermissions(path);
    expect(rule, `${path} has no navigation rule`).toBeDefined();
    if (!rule) return false;
    const role = roles.find((r) => r.code === code)!;
    if (rule.minLevel && role.level < rule.minLevel) return false;
    const perms = permsFor(code);
    return (rule.requiredPermissions ?? []).some((p: string) => perms.has(p));
  };

  it('a Purchasing Agent can open /purchase-orders', () => {
    // THE DEFECT THIS CLOSES. /purchase-orders requires po.view AND po.create,
    // and po.create was granted at level 4 because the only role holding the
    // purchasing module was OPERATIONS_MANAGER. An agent whose entire job is
    // raising purchase orders could not open the page.
    const perms = permsFor('PURCHASING_AGENT');
    expect(perms.has('operations.po.view')).toBe(true);
    expect(perms.has('operations.po.create')).toBe(true);
    expect(canReach('PURCHASING_AGENT', '/purchase-orders')).toBe(true);
  });

  it('but cannot approve one - raising and approving are different acts', () => {
    expect(permsFor('PURCHASING_AGENT').has('operations.po.approve')).toBe(false);
    expect(permsFor('PURCHASING_MANAGER').has('operations.po.approve')).toBe(true);
  });

  it('does not hand po.create to a warehouse role that holds only inventory', () => {
    // The fix names the purchasing MODULE rather than lowering the level, so a
    // level-1 warehouse associate is unaffected.
    expect(expandLegacyPermissions({ inventory: true }, 1).has('operations.po.create')).toBe(false);
    expect(expandLegacyPermissions({ purchasing: true }, 1).has('operations.po.create')).toBe(true);
  });

  it('the delivery and install crew reach equipment lifecycle and warehouse', () => {
    expect(canReach('DELIVERY_INSTALL_TECH', '/equipment-lifecycle')).toBe(true);
    expect(canReach('DELIVERY_INSTALL_SUPERVISOR', '/warehouse-operations')).toBe(true);
  });

  it('a project manager reaches the sales-to-operations handoff queue', () => {
    // /handoffs is minLevel 3 on operations.po.view. Its comment was written
    // waiting for these roles.
    expect(canReach('PROJECT_MANAGER', '/handoffs')).toBe(true);
    expect(canReach('PURCHASING_MANAGER', '/handoffs')).toBe(true);
  });

  it('a network setup technician reaches onboarding', () => {
    expect(canReach('NETWORK_SETUP_TECH', '/onboarding')).toBe(true);
  });
});

describe('the new roles land on a layout built for them', () => {
  for (const role of rolesFromMigration()) {
    it(`${role.code} does not fall to DEFAULT`, () => {
      const key = resolveRoleLayoutKey({
        code: role.code,
        level: role.level,
        department: role.department,
      });
      expect(key, `${role.code} resolved to ${key}`).not.toBe('DEFAULT');
    });
  }
});

describe('no new permission code was invented', () => {
  it('the derivation gained a split, not a new vocabulary entry', () => {
    const src = readFileSync(join(repo, 'client/src/lib/navigation-permissions.ts'), 'utf8');
    // Every code the purchasing block emits must already have existed.
    const block = src.slice(
      src.indexOf('if (modulePermissions.inventory || modulePermissions.purchasing)'),
    );
    const emitted = [...block.slice(0, 2000).matchAll(/perms\.add\('([^']+)'\)/g)].map((m) => m[1]);
    for (const code of emitted) {
      expect(code, `${code} is not module.resource.action`).toMatch(/^[a-z]+\.[a-z_]+\.[a-z_]+$/);
    }
    expect(emitted).toContain('operations.po.create');
    expect(emitted).toContain('operations.po.approve');
  });
});
