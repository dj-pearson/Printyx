/**
 * WF-R-02: the role catalogue signup depends on is seeded automatically.
 *
 * supabase/functions/signup/ looks up roles.code='COMPANY_ADMIN', and when the row
 * is absent it DELETES THE TENANT IT JUST CREATED and answers MISSING_ADMIN_ROLE.
 * The only three files that wrote System A roles - role-seeder.ts,
 * multi-location-role-seeder.ts and initialize-roles.ts - had no importer and no
 * npm script between them, so on a fresh database signup could not succeed at all.
 * `npm run seed:rbac` fills System B, which signup never reads.
 *
 * roles has no tenant_id and code is UNIQUE, so the catalogue is global and the
 * seed is a journaled, idempotent migration. This parses that migration and checks
 * the catalogue against the three things that consume it, because a seed nobody
 * checks drifts from its consumers silently - which is how COMPANY_ADMIN came to be
 * seeded at level 5 while the gates read 7.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { ROLE_LEVEL } from '../../../supabase/functions/_shared/rbac';

const SQL = readFileSync('drizzle/migrations/0072_seed_role_catalogue.sql', 'utf8');

interface SeededRole {
  name: string;
  code: string;
  roleType: string;
  department: string;
  level: number;
}

/** Every VALUES row in the seed, in order. */
const roles: SeededRole[] = [
  ...SQL.matchAll(/^\s*\('([^']*)', '([A-Z_]+)', '([a-z_]+)', '([a-z_]+)', (\d+),/gm),
].map((m) => ({ name: m[1], code: m[2], roleType: m[3], department: m[4], level: Number(m[5]) }));

describe('WF-R-02: the seeded catalogue', () => {
  it('parses, so the assertions below are about real rows', () => {
    expect(roles.length).toBeGreaterThan(0);
  });

  it('gives every role a level in 1..8', () => {
    for (const r of roles) {
      expect(Number.isInteger(r.level), `${r.code} level`).toBe(true);
      expect(r.level, `${r.code} level`).toBeGreaterThanOrEqual(1);
      expect(r.level, `${r.code} level`).toBeLessThanOrEqual(8);
    }
  });

  it('has no duplicate code, which the UNIQUE constraint would reject anyway', () => {
    const codes = roles.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('is idempotent, so re-running a migration chain cannot double-insert', () => {
    expect(SQL).toMatch(/ON CONFLICT \(code\) DO NOTHING/i);
  });
});

describe('WF-R-02: the catalogue satisfies the things that read it', () => {
  it('contains COMPANY_ADMIN, without which signup deletes the tenant it created', () => {
    const admin = roles.find((r) => r.code === 'COMPANY_ADMIN');
    expect(admin, 'COMPANY_ADMIN is what supabase/functions/signup/ looks up').toBeDefined();
  });

  it('places the ladder roles at the level _shared/rbac.ts enforces on', () => {
    // The correction this story makes: role-seeder.ts put COMPANY_ADMIN at 5 and
    // ROOT_ADMIN at 7, while ROLE_LEVEL - which every edge-function gate reads -
    // says 7 and 8. A company admin seeded at 5 fails
    // requireRoleLevel(ctx, ROLE_LEVEL.COMPANY_ADMIN) on its own platform.
    const level = (code: string) => roles.find((r) => r.code === code)?.level;
    expect(level('COMPANY_ADMIN')).toBe(ROLE_LEVEL.COMPANY_ADMIN);
    expect(level('PLATFORM_ADMIN')).toBe(ROLE_LEVEL.PLATFORM_ADMIN);
    expect(level('REGIONAL_MANAGER')).toBe(ROLE_LEVEL.REGIONAL_MANAGER);
    expect(level('SALES_REP')).toBe(ROLE_LEVEL.INDIVIDUAL);
  });

  it('covers every role template rbac-seeder.ts documents', () => {
    // AC4 names server/database-updater/seeders/rbac-seeder.ts as the catalogue of
    // record. That file seeds System B (enhanced_roles), which WF-R-01 retired, but
    // its 35 ROLE_TEMPLATES are the dealer org chart this repo already documents -
    // so the codes carry over even though the table does not.
    const seeder = readFileSync('server/database-updater/seeders/rbac-seeder.ts', 'utf8');
    const body = seeder.slice(seeder.indexOf('const ROLE_TEMPLATES'));
    const templates = [
      ...body.matchAll(
        /code: '([A-Z_]+)',\s*\n\s*description: '[^']*',\s*\n\s*hierarchyLevel: 'level_(\d)'/g,
      ),
    ].map((m) => ({ code: m[1], level: Number(m[2]) }));
    expect(templates.length).toBeGreaterThanOrEqual(34);

    const byCode = new Map(roles.map((r) => [r.code, r]));
    const missing = templates.filter((t) => !byCode.has(t.code)).map((t) => t.code);
    expect(missing, `template codes with no seeded role: ${missing.join(', ')}`).toEqual([]);

    // The levels agree with the templates everywhere except where ROLE_LEVEL
    // contradicts them - one code, COMPANY_ADMIN, which the templates put at 5.
    const disagree = templates
      .filter((t) => byCode.get(t.code)!.level !== t.level)
      .map((t) => `${t.code} ${t.level}->${byCode.get(t.code)!.level}`);
    expect(disagree).toEqual(['COMPANY_ADMIN 5->7']);
  });

  it('covers every role code the dashboard registry keys a layout on', async () => {
    const registry = readFileSync('client/src/lib/dashboard-widget-registry.ts', 'utf8');
    const layoutCodes = [...registry.matchAll(/^ {2}([A-Z][A-Z_]+):\s*\[/gm)].map((m) => m[1]);
    expect(layoutCodes.length).toBeGreaterThan(5);

    const seeded = new Set(roles.map((r) => r.code));
    const missing = layoutCodes.filter((c) => !seeded.has(c) && c !== 'DEFAULT');
    // A layout keyed on a code no role can hold is a dashboard nobody sees.
    expect(missing, `dashboard layouts with no seeded role: ${missing.join(', ')}`).toEqual([]);
  });
});

describe('WF-R-02: the superseded seeders are gone', () => {
  it('none of the three orphaned System A seeders remains', async () => {
    const { existsSync } = await import('fs');
    for (const f of [
      'server/role-seeder.ts',
      'server/multi-location-role-seeder.ts',
      'server/initialize-roles.ts',
    ]) {
      expect(existsSync(f), `${f} should be deleted`).toBe(false);
    }
  });
});
