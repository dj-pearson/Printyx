/**
 * Every user landed on the DEFAULT dashboard, whatever their role (WF-R-10).
 *
 * usePermissions returned `roleCode = role?.code || role?.name || 'USER'`,
 * which is always truthy. RoleBasedDashboard opened with
 * `if (roleCode) return roleCode.toUpperCase()`, so that short-circuited every
 * branch beneath it - the `role?.code` check, the level ladder and the
 * department ladder had never run. With a role whose code was null, it
 * upper-cased a DISPLAY NAME ("Company Administrator"), matched no key in
 * DEFAULT_ROLE_LAYOUTS, and fell to DEFAULT: four generic widgets, for
 * everybody.
 *
 * The second half was coverage. Migration 0072 seeds 45 role codes and the
 * registry held 13 layouts, so 32 codes had nowhere to go even once the
 * resolution was fixed - the story's own note says twelve, which was true of a
 * smaller catalogue.
 *
 * The seeded codes are READ OUT OF THE MIGRATION here rather than typed into
 * the test, so a role added to the catalogue without a layout fails this file
 * rather than silently landing on DEFAULT. That is the same shape WF-R-03 used
 * for the level ladder, and it is what caught the count being stale.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_ROLE_LAYOUTS,
  ROLE_LAYOUT_ALIASES,
  getDefaultLayout,
  resolveRoleLayoutKey,
} from '../../../client/src/lib/dashboard-widget-registry';

const repo = join(__dirname, '../../..');

/**
 * Every role the migration chain seeds, read out of the SQL.
 *
 * Every migration that inserts into `roles`, not just the catalogue one: WF-R-11
 * added seven more in 0081 and a test pinned to 0072 would have passed while
 * four of them landed on DEFAULT. The shape is
 * ('Display Name', 'CODE', 'scope', 'department', level, ...), and 0081 wraps
 * its rows across lines, so the match is not anchored to the line start.
 */
function seededRoles(): Array<{ code: string; department: string; level: number }> {
  const dir = join(repo, 'drizzle/migrations');
  const roles = new Map<string, { code: string; department: string; level: number }>();
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    const sql = readFileSync(join(dir, file), 'utf8');
    if (!/INSERT INTO roles\s*\(/i.test(sql)) continue;
    for (const m of sql.matchAll(
      /\('[^']*',\s*'([A-Z_]+)',\s*'[a-z_]+',\s*'([a-z_]*)',\s*(\d+)/g,
    )) {
      // ON CONFLICT (code) DO NOTHING, so the first migration to name a code wins.
      if (!roles.has(m[1])) {
        roles.set(m[1], { code: m[1], department: m[2], level: Number(m[3]) });
      }
    }
  }
  return [...roles.values()];
}

describe('the seed catalogue is the source of truth for this test', () => {
  it('reads every role out of every migration that seeds one', () => {
    const roles = seededRoles();
    expect(roles.length).toBeGreaterThanOrEqual(52);
    expect(roles.map((r) => r.code)).toContain('COMPANY_ADMIN');
    expect(roles.map((r) => r.code)).toContain('PURCHASING_AGENT');
    expect(new Set(roles.map((r) => r.code)).size).toBe(roles.length);
  });
});

describe('every seeded role resolves to a real, non-DEFAULT layout', () => {
  for (const role of seededRoles()) {
    it(`${role.code} does not fall to DEFAULT`, () => {
      const key = resolveRoleLayoutKey({
        code: role.code,
        level: role.level,
        department: role.department,
      });
      expect(key, `${role.code} resolved to ${key}`).not.toBe('DEFAULT');
      expect(DEFAULT_ROLE_LAYOUTS[key], `layout ${key} does not exist`).toBeDefined();
      expect(getDefaultLayout(key).length).toBeGreaterThan(0);
    });
  }
});

describe('the alias table points somewhere real', () => {
  it('every alias target is a defined layout and none is DEFAULT', () => {
    for (const [code, target] of Object.entries(ROLE_LAYOUT_ALIASES)) {
      expect(target, `${code} aliases to DEFAULT`).not.toBe('DEFAULT');
      expect(DEFAULT_ROLE_LAYOUTS[target], `${code} -> ${target} is not a layout`).toBeDefined();
    }
  });

  it('never aliases a code that has a layout of its own', () => {
    // An alias shadowing a real layout would be silently dead, because the
    // resolver checks DEFAULT_ROLE_LAYOUTS first.
    for (const code of Object.keys(ROLE_LAYOUT_ALIASES)) {
      expect(DEFAULT_ROLE_LAYOUTS[code], `${code} has both a layout and an alias`).toBeUndefined();
    }
  });

  it('holds no entry the department-and-level ladder already produces', () => {
    // The first cut of this table mapped all 32 unmapped codes by hand, and 24
    // of those rows turned out to say exactly what the ladder says. A table
    // where two thirds of the rows do nothing hides which rows matter, and a
    // redundant row silently PINS a code if the ladder ever changes. The ladder
    // is the rule; an entry here means the rule is wrong for that code.
    const seeded = new Map(seededRoles().map((r) => [r.code, r]));
    for (const [code, target] of Object.entries(ROLE_LAYOUT_ALIASES)) {
      const role = seeded.get(code);
      if (!role) continue;
      const ladder = resolveRoleLayoutKey({
        code: 'CODE_THE_TABLE_DOES_NOT_HOLD',
        level: role.level,
        department: role.department,
      });
      expect(
        ladder,
        `${code} -> ${target} is what the ladder already gives; delete the alias`,
      ).not.toBe(target);
    }
  });
});

describe('resolveRoleLayoutKey', () => {
  it('gives a seeded SALES_REP the SALES_REP layout', () => {
    expect(resolveRoleLayoutKey({ code: 'SALES_REP', level: 1, department: 'sales' })).toBe(
      'SALES_REP',
    );
  });

  it('gives a DISTRICT_MANAGER a regional layout, not DEFAULT', () => {
    expect(resolveRoleLayoutKey({ code: 'DISTRICT_MANAGER', level: 5, department: 'sales' })).toBe(
      'REGIONAL_MANAGER',
    );
  });

  it('never treats a display name as a code', () => {
    // The exact failure: "Company Administrator" upper-cased to
    // "COMPANY ADMINISTRATOR", which is not a key. It has no department or
    // level here either, so DEFAULT is the correct answer - the point is that
    // it does not silently resolve to COMPANY_ADMIN.
    expect(resolveRoleLayoutKey({ code: 'Company Administrator' })).toBe('DEFAULT');
  });

  it('infers from department and level when the code is absent', () => {
    expect(resolveRoleLayoutKey({ code: null, level: 4, department: 'sales' })).toBe(
      'SALES_MANAGER',
    );
    expect(resolveRoleLayoutKey({ code: '', level: 4, department: 'service' })).toBe(
      'SERVICE_MANAGER',
    );
  });

  it('checks department before level, which the old order did not', () => {
    // The old inference tested `level >= 4 -> LOCATION_MANAGER` before it
    // looked at the department, so a level-4 Sales Manager got the generic
    // location layout while a purpose-built one sat unused.
    expect(resolveRoleLayoutKey({ level: 4, department: 'sales' })).toBe('SALES_MANAGER');
    expect(resolveRoleLayoutKey({ level: 4, department: '' })).toBe('LOCATION_MANAGER');
  });

  it('puts a platform user on the platform layout whatever their code says', () => {
    expect(resolveRoleLayoutKey({ code: 'SALES_REP', level: 1, isPlatformUser: true })).toBe(
      'PLATFORM_ADMIN',
    );
  });

  it('falls through to inference for a code it has never seen', () => {
    // A code invented by a tenant should still get something better than
    // DEFAULT when level and department say what it is.
    expect(resolveRoleLayoutKey({ code: 'BESPOKE_ROLE', level: 3, department: 'service' })).toBe(
      'SERVICE_SUPERVISOR',
    );
  });
});

describe('the two call sites no longer read a display name', () => {
  const code = (p: string) =>
    readFileSync(join(repo, p), 'utf8')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');

  it('usePermissions exposes the code, not role.name', () => {
    const src = code('client/src/hooks/usePermissions.ts');
    expect(src).not.toMatch(/roleCode[^=]*=\s*role\?\.code\s*\|\|\s*role\?\.name/);
    expect(src).toMatch(/const roleCode: string = role\?\.code \|\| '';/);
  });

  it('RoleBasedDashboard resolves through the shared function', () => {
    const src = code('client/src/components/dashboards/RoleBasedDashboard.tsx');
    expect(src).toContain('resolveRoleLayoutKey({');
    // The short-circuit that made every branch below it dead.
    expect(src).not.toContain('if (roleCode) return roleCode.toUpperCase()');
  });
});
