/**
 * The tier model, proved against real rows (WF-R-12).
 *
 * RBAC-008 asked for exactly this in its acceptance criterion 7 - a rep-A /
 * rep-B isolation test - and closed without one. WF-R-04 through WF-R-07 then
 * applied tier scoping to twenty-odd endpoints on the strength of a unit test
 * driving a FAKE PostgREST. That test is good and it stays; what it cannot do
 * is prove the org structure resolves correctly over data that actually exists,
 * because it supplies the org structure itself.
 *
 * So this suite seeds a real PostgreSQL - the COP-M07 scratch recipe - with six
 * users in one tenant across two teams, two locations and one region, and runs
 * the REAL resolver over them. No fixture stands in for the database.
 *
 * WHAT IT DOES NOT PROVE, stated so a green run is not read as more than it is.
 * PostgREST is not running here, so the filter STRINGS applyUserScope builds are
 * not executed by PostgREST; row visibility is decided by rowInScope, the same
 * module's pure predicate, over rows read out of Postgres. The two are meant to
 * agree and scope-resolver.test.ts covers the string side. What is new here is
 * that resolveScope's five org-structure lookups run against real rows: a real
 * users table with real team_id, manager_id, primary_location_id and region_id,
 * and a real locations table with a real region_id.
 *
 * SKIPPED, NOT FAILED, WITHOUT A DATABASE. Set RBAC_TEST_DATABASE_URL to a
 * scratch Postgres to run it. A suite that fails on a laptop with no server
 * gets deleted; one that says why it skipped gets run.
 *
 * IT IS ITS OWN VARIABLE, NOT DATABASE_URL, and that is not tidiness.
 * server/tests/setup.ts deliberately assigns DATABASE_URL an unusable
 * placeholder - postgresql://unit-test@127.0.0.1:1/... - so that downstream
 * `if (!process.env.DATABASE_URL)` guards see a value and unit tests do not
 * wander onto a real server. Falling back to it means this suite believes it
 * has a database, tries to connect to port 1, and reports something other than
 * what happened. Found by running it with no database and getting a silent
 * skip of the whole file rather than the one honest message below.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  applyUserScope,
  resolveScope,
  rowInScope,
  tierForLevel,
  unscopedAtLevel,
  type ResolvedScope,
  type ScopeClient,
} from '../../../supabase/functions/_shared/scope';

const CONN = process.env.RBAC_TEST_DATABASE_URL || '';
const SCHEMA = 'rbac_tier_isolation';

/**
 * A PostgREST-shaped client over real SQL, supporting exactly the operators
 * resolveScope uses: select / eq / in / limit / maybeSingle, and awaiting the
 * chain for the many-row case.
 *
 * Deliberately tiny. A fuller adapter would be re-implementing PostgREST, and a
 * re-implementation is not evidence about the real one - it is a second thing
 * to get wrong. The closed set is the point: if resolveScope ever needs an
 * operator this does not have, the chain throws rather than silently returning
 * the wrong rows, and resolveScope's own catch degrades to `own`, which this
 * suite asserts is NOT what happens.
 */
function sqlClient(pool: { query: (t: string, v?: unknown[]) => Promise<{ rows: any[] }> }) {
  const build = (table: string) => {
    const wheres: string[] = [];
    const values: unknown[] = [];
    let cols = '*';
    let limit: number | null = null;

    const chain: any = {
      select(c: string) {
        cols = c;
        return chain;
      },
      eq(col: string, val: unknown) {
        values.push(val);
        wheres.push(`"${col}" = $${values.length}`);
        return chain;
      },
      in(col: string, vals: unknown[]) {
        values.push(vals);
        wheres.push(`"${col}" = ANY($${values.length})`);
        return chain;
      },
      limit(n: number) {
        limit = n;
        return chain;
      },
      async run() {
        const text =
          `SELECT ${cols} FROM ${SCHEMA}."${table}"` +
          (wheres.length ? ` WHERE ${wheres.join(' AND ')}` : '') +
          (limit === null ? '' : ` LIMIT ${limit}`);
        const { rows } = await pool.query(text, values);
        return rows;
      },
      async maybeSingle() {
        const rows = await chain.run();
        return { data: rows[0] ?? null, error: null };
      },
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
        return chain.run().then((rows: unknown[]) => resolve({ data: rows, error: null }), reject);
      },
    };
    return chain;
  };
  return { from: (table: string) => build(table) } as ScopeClient;
}

const TENANT = '11111111-1111-1111-1111-111111111111';
const OTHER_TENANT = '22222222-2222-2222-2222-222222222222';
const REGION = '33333333-3333-3333-3333-333333333333';

const LOC_NORTH = '44444444-4444-4444-4444-444444444444';
const LOC_SOUTH = '55555555-5555-5555-5555-555555555555';

/** Six users: two reps under one manager, a second manager in another team. */
const U = {
  repA: 'aaaaaaaa-0000-0000-0000-000000000001',
  repB: 'aaaaaaaa-0000-0000-0000-000000000002',
  managerNorth: 'bbbbbbbb-0000-0000-0000-000000000001',
  managerSouth: 'bbbbbbbb-0000-0000-0000-000000000002',
  regional: 'cccccccc-0000-0000-0000-000000000001',
  executive: 'dddddddd-0000-0000-0000-000000000001',
} as const;

const TEAM_NORTH = 'team-north';
const TEAM_SOUTH = 'team-south';

const meta = (level: number) => ({ roleLevel: level });

let pool: any;
let db: ScopeClient;
const available = CONN.length > 0;

beforeAll(async () => {
  if (!available) return;
  const { Pool } = await import('pg');
  pool = new Pool({ connectionString: CONN });

  await pool.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
  await pool.query(`CREATE SCHEMA ${SCHEMA}`);
  await pool.query(`
    CREATE TABLE ${SCHEMA}.users (
      id varchar PRIMARY KEY,
      tenant_id varchar NOT NULL,
      team_id varchar,
      manager_id varchar,
      primary_location_id varchar,
      region_id varchar
    );
    CREATE TABLE ${SCHEMA}.locations (
      id varchar PRIMARY KEY,
      tenant_id varchar NOT NULL,
      region_id varchar
    );
    CREATE TABLE ${SCHEMA}.rows_under_test (
      id varchar PRIMARY KEY,
      tenant_id varchar NOT NULL,
      owner_id varchar,
      table_name varchar NOT NULL
    );
  `);

  await pool.query(
    `INSERT INTO ${SCHEMA}.locations (id, tenant_id, region_id) VALUES ($1,$3,$4), ($2,$3,$4)`,
    [LOC_NORTH, LOC_SOUTH, TENANT, REGION],
  );

  const users: Array<[string, string, string | null, string | null, string | null, string | null]> =
    [
      [U.repA, TENANT, TEAM_NORTH, U.managerNorth, LOC_NORTH, REGION],
      [U.repB, TENANT, TEAM_NORTH, U.managerNorth, LOC_NORTH, REGION],
      [U.managerNorth, TENANT, TEAM_NORTH, U.regional, LOC_NORTH, REGION],
      [U.managerSouth, TENANT, TEAM_SOUTH, U.regional, LOC_SOUTH, REGION],
      [U.regional, TENANT, null, U.executive, LOC_NORTH, REGION],
      [U.executive, TENANT, null, null, LOC_NORTH, REGION],
      // A user in another tenant, to prove nothing crosses the boundary.
      ['eeeeeeee-0000-0000-0000-000000000001', OTHER_TENANT, TEAM_NORTH, null, LOC_NORTH, REGION],
    ];
  for (const u of users) {
    await pool.query(
      `INSERT INTO ${SCHEMA}.users (id, tenant_id, team_id, manager_id, primary_location_id, region_id)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      u,
    );
  }

  // One row per owner per endpoint table, plus an unowned row per table.
  const owners = [U.repA, U.repB, U.managerNorth, U.managerSouth, U.regional, U.executive, null];
  for (const table of ENDPOINTS) {
    for (const owner of owners) {
      await pool.query(
        `INSERT INTO ${SCHEMA}.rows_under_test (id, tenant_id, owner_id, table_name)
         VALUES ($1,$2,$3,$4)`,
        [`${table}:${owner ?? 'unowned'}`, TENANT, owner, table],
      );
    }
  }

  db = sqlClient(pool);
});

afterAll(async () => {
  if (pool) {
    await pool.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await pool.end();
  }
});

/** The nine endpoints AC1 names. */
const ENDPOINTS = [
  'business_records',
  'deals',
  'proposals',
  'service_tickets',
  'tasks',
  'invoices',
  'meter_readings',
  'purchase_orders',
  'equipment',
] as const;

const scopeFor = (userId: string, level: number) =>
  resolveScope(db, { userId, tenantId: TENANT, appMetadata: meta(level) });

async function visibleOwners(scope: ResolvedScope, table: string): Promise<Set<string>> {
  const { rows } = await pool.query(
    `SELECT id, owner_id FROM ${SCHEMA}.rows_under_test WHERE tenant_id = $1 AND table_name = $2`,
    [TENANT, table],
  );
  const seen = new Set<string>();
  for (const row of rows) {
    if (rowInScope(row, 'owner_id', scope)) seen.add(row.owner_id ?? 'unowned');
  }
  return seen;
}

describe.skipIf(!available)('WF-R-12: tier isolation over real rows', () => {
  it('resolves each tier from the real org structure, with no degradation', async () => {
    // A degraded scope means the org structure could not answer, and every
    // assertion below would then be testing the fallback rather than the tier.
    for (const [userId, level, tier] of [
      [U.repA, 1, 'own'],
      [U.managerNorth, 4, 'team'],
      [U.regional, 5, 'regional'],
      [U.executive, 7, 'company'],
    ] as const) {
      const scope = await scopeFor(userId, level);
      expect(scope.tier, `${tier} for level ${level}`).toBe(tier);
      expect(scope.degradedFrom, `${tier} degraded`).toBeNull();
      expect(tierForLevel(level)).toBe(tier);
    }
  });

  it('a level-1 rep sees only their own rows, on every endpoint', async () => {
    const scope = await scopeFor(U.repA, 1);
    expect(scope.userIds).toEqual([U.repA]);
    for (const table of ENDPOINTS) {
      const seen = await visibleOwners(scope, table);
      // `own` excludes unowned rows: own means mine.
      expect([...seen].sort(), table).toEqual([U.repA]);
    }
  });

  it("rep A cannot see rep B's rows, which is the test RBAC-008 closed without", async () => {
    const scope = await scopeFor(U.repA, 1);
    for (const table of ENDPOINTS) {
      expect((await visibleOwners(scope, table)).has(U.repB), table).toBe(false);
    }
  });

  it('a manager sees their own team and not the other one', async () => {
    const north = await scopeFor(U.managerNorth, 4);
    expect(new Set(north.userIds!)).toEqual(new Set([U.managerNorth, U.repA, U.repB]));

    for (const table of ENDPOINTS) {
      const seen = await visibleOwners(north, table);
      expect(seen.has(U.repA), table).toBe(true);
      expect(seen.has(U.repB), table).toBe(true);
      expect(seen.has(U.managerSouth), `${table}: cross-team leak`).toBe(false);
    }
  });

  it('the other team’s manager is isolated the same way', async () => {
    const south = await scopeFor(U.managerSouth, 4);
    for (const table of ENDPOINTS) {
      const seen = await visibleOwners(south, table);
      expect(seen.has(U.repA), `${table}: cross-team leak`).toBe(false);
      expect(seen.has(U.repB), `${table}: cross-team leak`).toBe(false);
    }
  });

  it('the regional manager sees both teams', async () => {
    const scope = await scopeFor(U.regional, 5);
    expect(scope.locationIds!.sort()).toEqual([LOC_NORTH, LOC_SOUTH].sort());
    for (const table of ENDPOINTS) {
      const seen = await visibleOwners(scope, table);
      expect(seen.has(U.repA), table).toBe(true);
      expect(seen.has(U.managerSouth), table).toBe(true);
    }
  });

  it('the executive sees the whole tenant, including unowned rows', async () => {
    const scope = await scopeFor(U.executive, 7);
    expect(scope.userIds).toBeNull();
    for (const table of ENDPOINTS) {
      const seen = await visibleOwners(scope, table);
      expect(seen.size, table).toBe(7);
      expect(seen.has('unowned'), table).toBe(true);
    }
  });

  it('an unowned row stays visible above `own` scope, so a shared queue does not empty', async () => {
    const manager = await scopeFor(U.managerNorth, 4);
    const rep = await scopeFor(U.repA, 1);
    expect((await visibleOwners(manager, 'tasks')).has('unowned')).toBe(true);
    expect((await visibleOwners(rep, 'tasks')).has('unowned')).toBe(false);
  });

  it('never resolves a user from another tenant', async () => {
    const scope = await scopeFor(U.regional, 5);
    expect(scope.userIds).not.toContain('eeeeeeee-0000-0000-0000-000000000001');
  });

  it('a level-1 write against another user’s row is out of scope, which the handler answers 403', async () => {
    // rowInScope is the predicate every scoped write checks before it touches a
    // row; false here is what becomes the 403.
    const rep = await scopeFor(U.repA, 1);
    const { rows } = await pool.query(
      `SELECT id, owner_id FROM ${SCHEMA}.rows_under_test WHERE owner_id = $1 AND table_name = 'deals'`,
      [U.repB],
    );
    expect(rows).toHaveLength(1);
    expect(rowInScope(rows[0], 'owner_id', rep)).toBe(false);
    expect(rowInScope({ id: 'x', owner_id: U.repA }, 'owner_id', rep)).toBe(true);
  });

  it('a purchase-order approver is unscoped from level 4, per unscopedAtLevel', async () => {
    // The worked example in scope.ts: an approver must see every order waiting
    // on them, including ones raised outside their team.
    const manager = unscopedAtLevel(await scopeFor(U.managerNorth, 4), 4);
    expect(manager.userIds).toBeNull();
    const seen = await visibleOwners(manager, 'purchase_orders');
    expect(seen.has(U.managerSouth)).toBe(true);
  });

  it('builds a filter naming only the resolved users', async () => {
    // The string side, so the two halves are seen to agree on one scope.
    const captured: string[] = [];
    const fake = { or: (expr: string) => (captured.push(expr), fake) };
    applyUserScope(fake, 'owner_id', await scopeFor(U.managerNorth, 4));
    expect(captured).toHaveLength(1);
    expect(captured[0]).toContain(U.repA);
    expect(captured[0]).not.toContain(U.managerSouth);
  });
});

describe.skipIf(available)('WF-R-12 needs a database', () => {
  it('says so rather than failing', () => {
    expect(CONN).toBe('');
    console.warn(
      'rbac-tier-isolation: skipped. Set RBAC_TEST_DATABASE_URL to a scratch Postgres ' +
        '(the COP-M07 recipe in CLAUDE.md) to run it. Not DATABASE_URL: the unit-test ' +
        'setup assigns that an unusable placeholder on purpose.',
    );
  });
});
