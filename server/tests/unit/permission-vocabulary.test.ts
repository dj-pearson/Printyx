/**
 * Every route gate names a code a seeded role can hold (SEC-EDGE-002).
 *
 * 77 Express route gates named codes the RBAC seeder never creates, so each one
 * denied every role below platform admin - a feature that reads as fine-grained
 * and is admin-only, with nothing logged to say so.
 *
 * THE GUARD WAS NAMING THE WRONG PERMISSION. check-permission-vocabulary.mjs
 * built its constant map keyed on the LEAF name - CREATE, VIEW, UPDATE, DELETE -
 * so every module's CREATE overwrote the previous one and the map held whichever
 * came last in the file. PERMISSIONS.INVENTORY.ITEM.CREATE therefore resolved to
 * `platform.tenant.create`, and the guard reported that adding a product model
 * required permission to create a TENANT. The finding was real; the NAMES were
 * fiction, and acting on them would have rewritten gates that only needed
 * repointing. The map is keyed on the full path now, which is what this test
 * exists to hold.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PERMISSIONS } from '../../middleware/rbac-route-helper';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

const seeded = new Set(
  [
    ...read('server/database-updater/seeders/rbac-seeder.ts').matchAll(
      /code: ['"]([a-z_]+\.[a-z_.]+)['"]/g,
    ),
  ].map((m) => m[1]),
);

describe('the constant resolves by full path, not by leaf name', () => {
  it('two modules can both have a CREATE', () => {
    expect(PERMISSIONS.INVENTORY.ITEM.CREATE).not.toBe(PERMISSIONS.PLATFORM.TENANT.CREATE);
  });

  it('the guard sees every code, not one per distinct leaf name', () => {
    // This is what pins the FIX rather than its consequences. Keyed on the leaf
    // the map holds 49 entries for 132 codes, because CREATE, VIEW, UPDATE and
    // DELETE collide across every module and the last one in the file wins. A
    // test that only checks the gates would pass under the broken resolver
    // today, now that the gates happen to name seeded codes - which is exactly
    // how the bug survived this long.
    const out = execFileSync('node', ['scripts/check-permission-vocabulary.mjs', '--list'], {
      cwd: repo,
      encoding: 'utf8',
    });
    const named = /Codes named by the PERMISSIONS constant: (\d+)/.exec(out);
    const declared = [
      ...read('server/middleware/rbac-route-helper.ts').matchAll(
        /^\s*[A-Z][A-Z0-9_]*:\s*['"][a-z_]+\.[a-z_.]+['"]/gm,
      ),
    ].length;
    expect(Number(named?.[1])).toBe(declared);
    expect(declared).toBeGreaterThan(100);
  });

  it('inventory writes are the inventory capability, not a platform one', () => {
    // The sentence the broken guard produced: "creating a product model
    // requires permission to create a tenant".
    expect(PERMISSIONS.INVENTORY.ITEM.CREATE.startsWith('operations.')).toBe(true);
    expect(PERMISSIONS.PLATFORM.TENANT.CREATE.startsWith('platform.')).toBe(true);
  });
});

describe('every gated code is one a seeded role can hold', () => {
  const gated = [
    PERMISSIONS.INVENTORY.ITEM.VIEW,
    PERMISSIONS.INVENTORY.ITEM.CREATE,
    PERMISSIONS.INVENTORY.ITEM.UPDATE,
    PERMISSIONS.INVENTORY.ITEM.DELETE,
    PERMISSIONS.INVENTORY.ITEM.ADJUST,
    PERMISSIONS.INVENTORY.WAREHOUSE.MANAGE,
    PERMISSIONS.SERVICE.DISPATCH.VIEW,
    PERMISSIONS.SERVICE.DISPATCH.SCHEDULE,
    PERMISSIONS.SERVICE.TECHNICIAN.VIEW,
    PERMISSIONS.SERVICE.TECHNICIAN.MANAGE,
  ];

  for (const code of gated) {
    it(`${code} is seeded`, () => {
      expect(seeded.has(code), `${code} is in no seeded role`).toBe(true);
    });
  }

  it('the two codes this story ADDED are seeded and granted', () => {
    // Bent onto an unrelated code they would have granted far more than the
    // route needs, so they were added instead - and a code with no role behind
    // it denies exactly as hard as an unseeded one.
    const seeder = read('server/database-updater/seeders/rbac-seeder.ts');
    for (const code of ['admin.settings.integrations', 'sales.quote.view_margin']) {
      expect(seeded.has(code), `${code} is not in the catalogue`).toBe(true);
      expect(seeder, `${code} is granted to no role`).toContain(`grantSec(roleCode, '${code}')`);
    }
  });

  it('margin visibility stops short of the reps', () => {
    // Dealer cost on a comparable deal is the kind of number a rep can repeat
    // to a customer.
    const seeder = read('server/database-updater/seeders/rbac-seeder.ts');
    const block = seeder.slice(
      seeder.indexOf('const MARGIN_ROLE_CODES'),
      seeder.indexOf('let secMappingsCreated'),
    );
    expect(block).toContain('SALES_MANAGER');
    expect(block).not.toContain("'SALES_REP'");
  });
});

describe('the gate a route names matches the gate its page names', () => {
  const nav = read('client/src/lib/navigation-permissions.ts');

  it('product and inventory routes use the code the pages already require', () => {
    // navigation-permissions.ts was always written against the SEEDED
    // vocabulary; only the route gates were not, which is why the page let a
    // manager in and the endpoint behind it did not.
    expect(nav).toContain("'operations.inventory.view'");
    expect(PERMISSIONS.INVENTORY.ITEM.VIEW).toBe('operations.inventory.view');
  });

  it('technician management uses the schedule capability its page requires', () => {
    expect(nav).toContain("'service.schedule.manage'");
    expect(PERMISSIONS.SERVICE.TECHNICIAN.MANAGE).toBe('service.schedule.manage');
  });

  it('submitting a meter reading is not gated on running meter billing', () => {
    // It asked for FINANCE.BILLING.METER_BILLING - the authority to RUN billing
    // - from the technicians who take the readings.
    const route = read('server/routes-products-crud.ts');
    const post = route.slice(route.indexOf("'/api/meter-readings',\n    ctx,"));
    expect(post.slice(0, 200)).toContain('PERMISSIONS.SERVICE.EQUIPMENT.VIEW');
  });
});

describe('the guard is a hard gate at zero', () => {
  it('the baseline is empty', () => {
    const baseline = JSON.parse(read('docs/permission-vocabulary-baseline.json'));
    expect(baseline.allowed).toEqual([]);
  });

  it('and the guard refuses to run against a non-empty one', () => {
    // Baselining a finding is not a third way to fix it.
    expect(read('scripts/check-permission-vocabulary.mjs')).toContain('is not empty');
  });

  it('reports zero unsatisfiable gates today', () => {
    const out = execFileSync('node', ['scripts/check-permission-vocabulary.mjs', '--triage'], {
      cwd: repo,
      encoding: 'utf8',
    });
    expect(out).toContain('unsatisfiable gates: 0');
  });
});

/**
 * The navigation side speaks the same vocabulary (SEC-EDGE-001).
 *
 * navigation-permissions.ts decides what a user can SEE, and it names the same
 * permission codes the route gates do - so it has the same failure mode, and
 * nothing was checking it. Nine entries named `admin.settings.view` or
 * `admin.settings.update`, neither of which the seeder created, so /settings
 * ITSELF was invisible to every role below platform admin. A user who cannot
 * see a page never reports that it is missing, which is why this went unnoticed
 * while the route half was being ratcheted.
 */
describe('every navigation gate is satisfiable too', () => {
  const nav = read('client/src/lib/navigation-permissions.ts');

  it('no entry names only unseeded codes', () => {
    const unsatisfiable: string[] = [];
    for (const entry of nav.matchAll(/'(\/[^']*)': \{([\s\S]*?)\n  \}/g)) {
      const required = [...entry[2].matchAll(/'([a-z_]+\.[a-z_.]+)'/g)].map((m) => m[1]);
      if (required.length === 0) continue;
      if (!required.some((p) => seeded.has(p))) unsatisfiable.push(entry[1]);
    }
    expect(unsatisfiable).toEqual([]);
  });

  it('the two codes /settings needed are seeded and granted', () => {
    const seeder = read('server/database-updater/seeders/rbac-seeder.ts');
    for (const code of ['admin.settings.view', 'admin.settings.update']) {
      expect(seeded.has(code), `${code} is not in the catalogue`).toBe(true);
      expect(seeder, `${code} is granted to no role`).toContain(`grantSec(roleCode, '${code}')`);
    }
  });

  it('viewing settings reaches further down than changing them', () => {
    // A manager has to be able to open /settings to see how their own tenant
    // is configured; changing it is a different question.
    const seeder = read('server/database-updater/seeders/rbac-seeder.ts');
    const viewBlock = seeder.slice(
      seeder.indexOf("await grantSec(roleCode, 'admin.settings.view')") - 300,
    );
    expect(viewBlock.slice(0, 400)).toContain('SERVICE_MANAGER');
  });

  it('the guard reads the navigation file, not just the server tree', () => {
    expect(read('scripts/check-permission-vocabulary.mjs')).toContain(
      'client/src/lib/navigation-permissions.ts',
    );
  });
});
