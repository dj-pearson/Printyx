/**
 * Role management has never been initializable, on any host (round 127).
 *
 * GET /rbac/status gates the whole page on `enhanced_roles` holding a row for
 * the tenant, and the only thing that creates one is POST /rbac/seed - which
 * 501'd on the edge function and, on Express, could not insert a single row:
 * it omitted five NOT NULL columns with no default, wrote five values into an
 * enum that holds none of them, and named four role codes migration 0072's
 * catalogue does not carry. So the setup prompt's button has been dead for
 * every tenant, which matters more since LAUNCH-008 made signup provision one.
 *
 * The plan builder is pure, so most of this runs it rather than reading it.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  RBAC_SEED_DEALER_TYPES,
  RBAC_SEED_TEMPLATES,
  buildRbacSeedPlan,
  type CatalogueRole,
} from '@shared/rbac-seed';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const stripComments = (s: string) =>
  s.replace(/(?<![:/])\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, ' ');

const EDGE = read('supabase/functions/rbac/index.ts');
const EDGE_CODE = stripComments(EDGE);
const EXPRESS_CODE = stripComments(read('server/routes-enhanced-rbac.ts'));
const CATALOGUE_SQL = read('drizzle/migrations/0072_seed_role_catalogue.sql');
const CREATE_SQL = read('drizzle/migrations/0000_fuzzy_blizzard.sql');

/** Every (code, level, role_type) migration 0072 seeds into `roles`. */
function catalogue(): CatalogueRole[] {
  const rows: CatalogueRole[] = [];
  for (const m of CATALOGUE_SQL.matchAll(/'([A-Z_]+)',\s*'([a-z_]+)',\s*'[a-z]+',\s*(\d+)/g)) {
    rows.push({ code: m[1], role_type: m[2], level: Number(m[3]) });
  }
  return rows;
}

/** The columns of one CREATE TABLE in migration 0000. */
function createdColumns(table: string): { name: string; notNull: boolean; hasDefault: boolean }[] {
  const at = CREATE_SQL.indexOf(`CREATE TABLE "${table}" (`);
  expect({ table, found: at > -1 }).toEqual({ table, found: true });
  const body = CREATE_SQL.slice(at, CREATE_SQL.indexOf('\n);', at));
  return [...body.matchAll(/^\t"([a-z_]+)"([^,\n]*)/gm)].map((m) => ({
    name: m[1],
    notNull: /NOT NULL/.test(m[2]),
    hasDefault: /DEFAULT/.test(m[2]),
  }));
}

const seed = (dealerType = 'standard') =>
  buildRbacSeedPlan({
    tenantId: 't1',
    userId: 'u1',
    dealerType,
    catalogue: catalogue(),
    now: new Date('2026-09-21T10:00:00Z'),
  });

describe('the catalogue is the authority for every level', () => {
  it('it parses, so nothing below passes over an empty list', () => {
    const rows = catalogue();
    expect(rows.length).toBeGreaterThan(30);
    expect(rows.find((r) => r.code === 'COMPANY_ADMIN')?.level).toBe(7);
  });

  it('every template code exists in it', () => {
    // The original named OWNER, MANAGER, SERVICE_TECH and ADMIN_ASSISTANT,
    // none of which the catalogue carries - a third role vocabulary beside
    // `roles` and `enhanced_roles`.
    const codes = new Set(catalogue().map((r) => r.code));
    for (const [dealerType, templates] of Object.entries(RBAC_SEED_TEMPLATES)) {
      expect(templates.length).toBeGreaterThan(0);
      for (const t of templates) {
        expect({ dealerType, code: t.code, known: codes.has(t.code) }).toEqual({
          dealerType,
          code: t.code,
          known: true,
        });
      }
    }
  });

  it('a code the catalogue lacks is refused, not given a level', () => {
    const plan = buildRbacSeedPlan({
      tenantId: 't1',
      userId: 'u1',
      dealerType: 'standard',
      catalogue: catalogue().filter((r) => r.code !== 'SALES_REP'),
    });
    expect(plan.error).toMatch(/SALES_REP/);
    expect(plan.roles).toEqual([]);
  });

  it('an unknown dealer type is refused', () => {
    expect(
      buildRbacSeedPlan({
        tenantId: 't1',
        userId: 'u1',
        dealerType: 'enormous',
        catalogue: catalogue(),
      }).error,
    ).toMatch(/Unknown dealer type/);
    expect(RBAC_SEED_DEALER_TYPES.sort()).toEqual(['small', 'standard']);
  });
});

describe('every NOT NULL column is supplied', () => {
  it('on organizational_units', () => {
    // Derived from the migration, so a column added later fails here rather
    // than at runtime - this is the class that killed the original.
    const plan = seed();
    for (const col of createdColumns('organizational_units')) {
      if (!col.notNull || col.hasDefault) continue;
      expect({ column: col.name, supplied: col.name in plan.unit }).toEqual({
        column: col.name,
        supplied: true,
      });
    }
  });

  it('on enhanced_roles, for every role in every template', () => {
    const required = createdColumns('enhanced_roles').filter((c) => c.notNull && !c.hasDefault);
    expect(required.length).toBeGreaterThan(5);
    for (const dealerType of RBAC_SEED_DEALER_TYPES) {
      for (const role of seed(dealerType).roles) {
        for (const col of required) {
          expect({
            dealerType,
            code: role.code,
            column: col.name,
            supplied: col.name in role,
          }).toEqual({ dealerType, code: role.code, column: col.name, supplied: true });
        }
      }
    }
  });

  it('on user_role_assignments', () => {
    const plan = seed();
    for (const col of createdColumns('user_role_assignments')) {
      if (!col.notNull || col.hasDefault) continue;
      expect({ column: col.name, supplied: col.name in plan.assignment }).toEqual({
        column: col.name,
        supplied: true,
      });
    }
  });

  it('and lft/rght/depth are the ones it used to omit', () => {
    // Named explicitly: the two read branches both .order('lft'), so these
    // being absent is what made the promised hierarchy an order over nulls.
    const plan = seed();
    for (const key of ['lft', 'rght', 'depth']) {
      expect({ key, unit: typeof plan.unit[key] }).toEqual({ key, unit: 'number' });
      for (const role of plan.roles) {
        expect({ key, code: role.code, type: typeof role[key] }).toEqual({
          key,
          code: role.code,
          type: 'number',
        });
      }
    }
  });
});

describe('every enum value is a member of its enum', () => {
  const members = (name: string) => {
    const m = new RegExp(`CREATE TYPE "public"\\."${name}" AS ENUM\\(([^)]*)\\)`).exec(CREATE_SQL);
    expect({ name, found: Boolean(m) }).toEqual({ name, found: true });
    return new Set([...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1]));
  };

  it('role_hierarchy_level is level_1..level_8, not COMPANY/INDIVIDUAL', () => {
    const allowed = members('role_hierarchy_level');
    expect(allowed.has('COMPANY')).toBe(false);
    for (const dealerType of RBAC_SEED_DEALER_TYPES) {
      for (const role of seed(dealerType).roles) {
        expect({ code: role.code, value: role.hierarchy_level }).toEqual({
          code: role.code,
          value: role.hierarchy_level,
        });
        expect(allowed.has(role.hierarchy_level as string)).toBe(true);
      }
    }
  });

  it('organizational_tier is lowercase, on both tables', () => {
    const allowed = members('organizational_tier');
    expect(allowed.has('COMPANY')).toBe(false);
    const plan = seed();
    expect(allowed.has(plan.unit.unit_type as string)).toBe(true);
    for (const role of plan.roles) {
      expect(allowed.has(role.organizational_tier as string)).toBe(true);
    }
  });

  it('the hierarchy level is the catalogue level, not a guess', () => {
    const byCode = new Map(catalogue().map((r) => [r.code, r]));
    for (const role of seed().roles) {
      expect({ code: role.code, level: role.hierarchy_level }).toEqual({
        code: role.code,
        level: `level_${byCode.get(role.code as string)!.level}`,
      });
    }
  });
});

describe('the nested set is well formed', () => {
  it('bounds are unique, paired and nested', () => {
    for (const dealerType of RBAC_SEED_DEALER_TYPES) {
      const roles = seed(dealerType).roles;
      const bounds = roles
        .flatMap((r) => [r.lft as number, r.rght as number])
        .sort((a, b) => a - b);
      expect(bounds).toEqual([...Array(roles.length * 2)].map((_, i) => i + 1));
      for (const role of roles) {
        expect((role.rght as number) > (role.lft as number)).toBe(true);
      }
    }
  });

  it('a child sits strictly inside its parent', () => {
    const roles = seed().roles;
    const byId = new Map(roles.map((r) => [r.id as string, r]));
    let nested = 0;
    for (const role of roles) {
      const parent = role.parent_role_id ? byId.get(role.parent_role_id as string) : null;
      if (!parent) continue;
      nested++;
      expect((parent.lft as number) < (role.lft as number)).toBe(true);
      expect((role.rght as number) < (parent.rght as number)).toBe(true);
      expect(role.depth).toBe((parent.depth as number) + 1);
    }
    expect(nested).toBeGreaterThan(0);
  });

  it('there is one root and it is the highest catalogue level', () => {
    for (const dealerType of RBAC_SEED_DEALER_TYPES) {
      const plan = seed(dealerType);
      const roots = plan.roles.filter((r) => r.parent_role_id === null);
      expect({ dealerType, roots: roots.length }).toEqual({ dealerType, roots: 1 });
      expect(roots[0].code).toBe('COMPANY_ADMIN');
      // The caller is assigned the top of the tree, not whichever row the
      // template happened to list first.
      expect(plan.primaryRoleId).toBe(roots[0].id);
      expect(plan.assignment.role_id).toBe(roots[0].id);
    }
  });

  it('every role belongs to the unit the same plan creates', () => {
    const plan = seed();
    for (const role of plan.roles) {
      expect(role.organizational_unit_id).toBe(plan.unit.id);
    }
    expect(plan.assignment.organizational_unit_id).toBe(plan.unit.id);
  });
});

describe('both hosts run the plan, and the edge one is gated', () => {
  it('the edge 501 is gone and the plan is built there', () => {
    expect(EDGE_CODE).not.toMatch(/RBAC_SEED_NOT_PORTED/);
    expect(EDGE_CODE).toMatch(/buildRbacSeedPlan\(/);
  });

  it('express builds the same plan rather than its own literals', () => {
    expect(EXPRESS_CODE).toMatch(/buildRbacSeedPlan\(/);
    // The values that could not be inserted.
    expect(EXPRESS_CODE).not.toMatch(/hierarchy_level: 'COMPANY'/);
    expect(EXPRESS_CODE).not.toMatch(/'INDIVIDUAL'/);
  });

  it('seeding needs a company administrator, checked before anything is written', () => {
    const at = EDGE_CODE.indexOf("endpoint === 'seed'");
    expect(at).toBeGreaterThan(-1);
    const body = EDGE_CODE.slice(at);
    const gate = body.indexOf('COMPANY_ADMIN_LEVEL');
    const write = body.indexOf('.insert(plan.unit)');
    expect({ gated: gate > -1 }).toEqual({ gated: true });
    expect({ order: gate < write && write > -1 }).toEqual({ order: true });
    expect(body.slice(0, gate + 400)).toMatch(/INSUFFICIENT_ROLE/);
  });

  it('the gate reads the global roles level, because enhanced_roles is empty by definition', () => {
    const at = EDGE_CODE.indexOf("endpoint === 'seed'");
    const body = EDGE_CODE.slice(at, at + 1200);
    expect(body).toMatch(/roles!inner\(level\)/);
    expect(body).not.toMatch(/from\('enhanced_roles'\)[\s\S]{0,200}level/);
  });

  it('a second seed is refused rather than stacking a duplicate hierarchy', () => {
    const at = EDGE_CODE.indexOf("endpoint === 'seed'");
    const body = EDGE_CODE.slice(at, EDGE_CODE.indexOf('Endpoint not found', at));
    expect(body).toMatch(/ALREADY_SEEDED/);
    expect(body).toMatch(/\b409\b/);
  });

  it('a failed role insert removes the unit it already wrote', () => {
    const at = EDGE_CODE.indexOf('rolesError');
    expect(at).toBeGreaterThan(-1);
    const body = EDGE_CODE.slice(at, at + 600);
    expect(body).toMatch(/from\('organizational_units'\)[\s\S]{0,80}\.delete\(\)/);
  });
});

describe('the rbac audit trail points at a table that exists', () => {
  it('nothing queries rbac_audit_log any more', () => {
    // Stripped, because the comment explaining the rebind names it.
    expect(EDGE_CODE).not.toMatch(/rbac_audit_log/);
    expect(EDGE).toMatch(/rbac_audit_log/); // the explanation survives
  });

  it('it is gone from the phantom baseline too', () => {
    const baseline = JSON.stringify(JSON.parse(read('docs/phantom-tables-baseline.json')));
    expect(baseline.includes('rbac_audit_log')).toBe(false);
  });

  it('the assignment writes through the one shared writer', () => {
    const at = EDGE_CODE.indexOf("endpoint === 'assign-role'");
    const body = EDGE_CODE.slice(at, EDGE_CODE.indexOf("endpoint === 'status'", at));
    expect(body).toMatch(/writeAuditLog\(/);
    expect(body).toMatch(/action: 'role_assigned'/);
  });

  it('and the read orders by the column audit_logs actually has', () => {
    const at = EDGE_CODE.indexOf("endpoint === 'audit-logs'");
    const body = EDGE_CODE.slice(at, EDGE_CODE.indexOf("endpoint === 'assign-role'", at));
    expect(body).toMatch(/from\('audit_logs'\)/);
    expect(body).toMatch(/\.order\('timestamp'/);
    // COP-M01: audit_logs has `timestamp`, not `created_at`.
    expect(body).not.toMatch(/\.order\('created_at'/);
    // And a failed read is an error, not an empty trail on a security screen.
    expect(body).toMatch(/if \(error\)/);
  });
});

describe('the migration files this derives from are still there', () => {
  it('0072 and 0000 are both journalled', () => {
    const journal = JSON.parse(read('drizzle/migrations/meta/_journal.json'));
    const tags = new Set(journal.entries.map((e: { tag: string }) => e.tag));
    expect(tags.has('0072_seed_role_catalogue')).toBe(true);
    expect(tags.has('0000_fuzzy_blizzard')).toBe(true);
    expect(readdirSync(join(repo, 'drizzle/migrations')).length).toBeGreaterThan(50);
  });
});
