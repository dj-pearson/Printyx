#!/usr/bin/env node
/**
 * COP-I01 AC1 and AC6: a repeatable benchmark for the CRM list and board
 * queries, and the reason the index work below is not guesswork.
 *
 * WHAT THIS MEASURES AND WHAT IT DOES NOT, because a benchmark whose scope
 * nobody wrote down gets quoted as if it covered everything.
 *
 *   MEASURED: the database time for the exact query SHAPES the CRM index
 *   endpoints issue - the filters, the sort, the LIMIT/OFFSET window and the
 *   exact count - against a tenant seeded to a chosen size. That is where
 *   sub-second and not-sub-second are decided at 5,000 records, because a
 *   sequential scan over a tenant is the only thing at this size that costs
 *   hundreds of milliseconds.
 *
 *   NOT MEASURED: PostgREST's own overhead, the network, JSON serialisation,
 *   and React render time. A green run here is a necessary condition for AC1,
 *   not a sufficient one, and the output says so.
 *
 * It needs a Postgres it may WRITE to - it seeds and then deletes its own
 * tenant - so it refuses to run against anything but an explicitly supplied
 * URL. Never point it at production.
 *
 * Usage:
 *   BENCH_DATABASE_URL=postgresql://... node scripts/bench-crm-lists.mjs
 *   BENCH_DATABASE_URL=... node scripts/bench-crm-lists.mjs --rows 5000 --runs 5
 */
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const url = process.env.BENCH_DATABASE_URL;
if (!url) {
  console.error(
    '✗ BENCH_DATABASE_URL is required. This script SEEDS AND DELETES rows, so it will not\n' +
      '  fall back to DATABASE_URL. Point it at a scratch database (the COP-M07 recipe in\n' +
      '  CLAUDE.md) and never at production.',
  );
  process.exit(2);
}

const ROWS = Number(argValue('rows', 5000));
/**
 * Rows belonging to OTHER tenants, sitting in the same table.
 *
 * THE FIRST CUT OF THIS BENCHMARK WAS WRONG AND SAID SO OUT LOUD: with 5,000
 * rows in one tenant and nothing else in the table, every query came back in
 * 2-6ms WITH A SEQUENTIAL SCAN, because scanning 5,000 rows is cheap. It
 * measured a number nobody experiences. A multi-tenant table is the real
 * shape - a tenant with 5,000 accounts lives inside a table holding every
 * other tenant's too - and without a tenant-scoped index the scan is charged
 * for all of them. That is what AC5 is about, and the default reflects it.
 */
const NOISE = Number(argValue('noise', 95000));
const RUNS = Number(argValue('runs', 5));
/** AC1's bar. A query slower than this fails the run. */
const BUDGET_MS = Number(argValue('budget', 250));

const tenantId = `bench-${randomUUID()}`;

/**
 * The query shapes, lifted from the endpoints rather than invented:
 *
 *  - accounts list: supabase/functions/business-records/index.ts reads
 *    `companies` filtered by tenant, optionally by business_record_type and
 *    activity, sorted created_at DESC, with an exact count and a page window.
 *  - deals board: supabase/functions/pipeline-config reads `deals` by tenant
 *    and stage.
 *  - forecast: deals by tenant ordered on expected_close_date.
 */
const QUERIES = [
  {
    name: 'accounts list (page 1, exact count)',
    sql: `SELECT count(*) OVER () AS total, * FROM companies
            WHERE tenant_id = $1
            ORDER BY created_at DESC
            LIMIT 100 OFFSET 0`,
  },
  {
    name: 'accounts list filtered by type',
    sql: `SELECT count(*) OVER () AS total, * FROM companies
            WHERE tenant_id = $1 AND business_record_type = 'Customer'
            ORDER BY created_at DESC
            LIMIT 100 OFFSET 0`,
  },
  {
    name: 'accounts list deep page (offset 4900)',
    sql: `SELECT * FROM companies
            WHERE tenant_id = $1
            ORDER BY created_at DESC
            LIMIT 100 OFFSET 4900`,
  },
  {
    name: 'deals board by stage',
    sql: `SELECT * FROM deals
            WHERE tenant_id = $1 AND stage_id = 'stage-2'
            ORDER BY created_at DESC
            LIMIT 200`,
  },
  {
    name: 'deals by owner (rep book)',
    sql: `SELECT * FROM deals
            WHERE tenant_id = $1 AND owner_id = 'rep-3'
            ORDER BY created_at DESC
            LIMIT 200`,
  },
  {
    name: 'forecast by close date',
    sql: `SELECT * FROM deals
            WHERE tenant_id = $1 AND status = 'open'
            ORDER BY expected_close_date ASC
            LIMIT 200`,
  },

  /**
   * COP-B01 AC5: the My Day workspace, whose bar is "under 1s at realistic
   * data volumes". Six of these run in one Promise.all inside
   * `supabase/functions/dashboards`' /today branch, so the page's database
   * time is roughly the SLOWEST of them rather than their sum - which is
   * exactly why a per-query budget is the right instrument here.
   *
   * Lifted from the handler, not invented: the `.is(completed_date, null)`
   * filter, the or() that expresses "overdue by either date", the sort
   * columns and the limits are all what that branch issues.
   */
  {
    name: 'my-day overdue activities',
    sql: `SELECT * FROM business_record_activities
            WHERE tenant_id = $1
              AND completed_date IS NULL
              AND (due_date <= now() OR scheduled_date <= now() - interval '1 day')
            ORDER BY due_date ASC
            LIMIT 10`,
  },
  {
    name: 'my-day due today',
    sql: `SELECT * FROM business_record_activities
            WHERE tenant_id = $1
              AND completed_date IS NULL
              AND scheduled_date >= date_trunc('day', now())
              AND scheduled_date <= date_trunc('day', now()) + interval '1 day'
            ORDER BY scheduled_date ASC
            LIMIT 20`,
  },
  {
    name: 'my-day stalled deals',
    sql: `SELECT * FROM deals
            WHERE tenant_id = $1 AND status = 'open'
              AND (updated_at < now() - interval '14 days'
                   OR (updated_at IS NULL AND created_at < now() - interval '14 days'))
            ORDER BY updated_at ASC NULLS FIRST
            LIMIT 5`,
  },
  {
    name: 'my-day recent wins',
    sql: `SELECT * FROM deals
            WHERE tenant_id = $1 AND status = 'won'
              AND actual_close_date >= now() - interval '7 days'
            ORDER BY actual_close_date DESC
            LIMIT 5`,
  },
  {
    name: 'my-day team pipeline (COP-B01 AC6)',
    sql: `SELECT owner_id, amount FROM deals
            WHERE tenant_id = $1 AND status = 'open'
              AND owner_id IN ('rep-1','rep-2','rep-3','rep-4','rep-5')`,
  },
  {
    name: 'my-day team activity (COP-B01 AC6)',
    sql: `SELECT created_by, activity_type FROM business_record_activities
            WHERE tenant_id = $1
              AND created_by IN ('rep-1','rep-2','rep-3','rep-4','rep-5')
              AND created_at >= now() - interval '7 days'`,
  },
];

const client = new pg.Client({ connectionString: url });

async function seed() {
  console.log(`Seeding ${ROWS} companies and ${ROWS} deals into tenant ${tenantId}…`);
  await client.query(
    `INSERT INTO companies (tenant_id, business_name, business_record_type, activity, created_by, created_at)
       SELECT $1,
              'Bench Account ' || g,
              (ARRAY['Lead','Customer','Prospect'])[1 + (g % 3)],
              (ARRAY['active','inactive'])[1 + (g % 2)],
              'rep-' || (g % 10),
              now() - (g || ' minutes')::interval
         FROM generate_series(1, $2) g`,
    [tenantId, ROWS],
  );
  // `created_by_id` is NOT NULL on deals and was missing here, so this script
  // could not insert a single deal against a faithfully migrated database -
  // it died on the first seed statement. A benchmark that cannot run is the
  // performance equivalent of a guard that passes vacuously, and its numbers
  // were being quoted. Same for actual_close_date, which the recent-wins
  // query below filters on.
  await client.query(
    `INSERT INTO deals (tenant_id, title, owner_id, created_by_id, stage_id, status, amount,
                        expected_close_date, actual_close_date, created_at, updated_at)
       SELECT $1,
              'Bench Deal ' || g,
              'rep-' || (g % 10),
              'rep-' || (g % 10),
              'stage-' || (g % 6),
              (ARRAY['open','won','lost'])[1 + (g % 3)],
              (1000 + g)::numeric,
              now() + ((g % 180) || ' days')::interval,
              CASE WHEN g % 3 = 1 THEN now() - ((g % 30) || ' days')::interval END,
              now() - (g || ' minutes')::interval,
              -- A third of the open deals are stale, so the stalled-deals query
              -- has something to find rather than measuring an empty result.
              CASE WHEN g % 3 = 0 THEN now() - ((g % 60) || ' days')::interval END
         FROM generate_series(1, $2) g`,
    [tenantId, ROWS],
  );
  // COP-B01 AC5: the My Day workspace reads activities, so they are seeded at
  // the same scale as the deals. `completed_date` null on two thirds of them,
  // because the workspace only ever asks about outstanding work.
  await client.query(
    `INSERT INTO business_record_activities
            (tenant_id, activity_type, subject, created_by, created_at,
             scheduled_date, due_date, completed_date)
       SELECT $1,
              (ARRAY['call','email','meeting','note','task'])[1 + (g % 5)],
              'Bench Activity ' || g,
              'rep-' || (g % 10),
              now() - ((g % 30) || ' days')::interval,
              now() - ((g % 14) || ' days')::interval + ((g % 24) || ' hours')::interval,
              now() - ((g % 14) || ' days')::interval,
              CASE WHEN g % 3 = 0 THEN now() - ((g % 10) || ' days')::interval END
         FROM generate_series(1, $2) g`,
    [tenantId, ROWS],
  );

  if (NOISE > 0) {
    console.log(`Seeding ${NOISE} rows across other tenants, so the scan is charged for them…`);
    await client.query(
      `INSERT INTO companies (tenant_id, business_name, business_record_type, activity, created_by, created_at)
         SELECT 'bench-noise-' || (g % 40), 'Other Account ' || g, 'Customer', 'active', 'rep-1',
                now() - (g || ' minutes')::interval
           FROM generate_series(1, $1) g`,
      [NOISE],
    );
    await client.query(
      `INSERT INTO deals (tenant_id, title, owner_id, created_by_id, stage_id, status, amount,
                          expected_close_date, created_at)
         SELECT 'bench-noise-' || (g % 40), 'Other Deal ' || g, 'rep-1', 'rep-1', 'stage-1', 'open',
                1000::numeric, now(), now() - (g || ' minutes')::interval
           FROM generate_series(1, $1) g`,
      [NOISE],
    );
    await client.query(
      `INSERT INTO business_record_activities
              (tenant_id, activity_type, subject, created_by, created_at, scheduled_date, due_date)
         SELECT 'bench-noise-' || (g % 40), 'call', 'Other Activity ' || g, 'rep-1',
                now() - (g || ' minutes')::interval, now(), now()
           FROM generate_series(1, $1) g`,
      [NOISE],
    );
  }
  await client.query('ANALYZE companies');
  await client.query('ANALYZE deals');
  await client.query('ANALYZE business_record_activities');
}

async function cleanup() {
  await client.query('DELETE FROM companies WHERE tenant_id = $1', [tenantId]);
  await client.query('DELETE FROM deals WHERE tenant_id = $1', [tenantId]);
  await client.query('DELETE FROM business_record_activities WHERE tenant_id = $1', [tenantId]);
  await client.query("DELETE FROM companies WHERE tenant_id LIKE 'bench-noise-%'");
  await client.query("DELETE FROM deals WHERE tenant_id LIKE 'bench-noise-%'");
  await client.query("DELETE FROM business_record_activities WHERE tenant_id LIKE 'bench-noise-%'");
}

/** Median, not mean: one cold run must not decide the verdict either way. */
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function timeQuery(q) {
  // One untimed run first: the first execution of a statement pays for its
  // plan, and measuring that would report a cost no user ever pays twice.
  await client.query(q.sql, [tenantId]);
  const samples = [];
  for (let i = 0; i < RUNS; i += 1) {
    const started = process.hrtime.bigint();
    await client.query(q.sql, [tenantId]);
    samples.push(Number(process.hrtime.bigint() - started) / 1e6);
  }
  const { rows } = await client.query(`EXPLAIN (FORMAT JSON) ${q.sql}`, [tenantId]);
  const plan = JSON.stringify(rows[0]['QUERY PLAN']);
  return {
    name: q.name,
    medianMs: median(samples),
    worstMs: Math.max(...samples),
    // The finding that matters at this size: a scan of the whole table.
    seqScan: plan.includes('"Seq Scan"'),
  };
}

async function main() {
  await client.connect();
  let failed = false;
  try {
    await seed();
    console.log(`\nTiming ${QUERIES.length} queries, ${RUNS} runs each, budget ${BUDGET_MS}ms.\n`);
    const results = [];
    for (const q of QUERIES) results.push(await timeQuery(q));

    const width = Math.max(...results.map((r) => r.name.length));
    for (const r of results) {
      const over = r.medianMs > BUDGET_MS;
      if (over) failed = true;
      console.log(
        `  ${over ? '✗' : '✓'} ${r.name.padEnd(width)}  ` +
          `median ${r.medianMs.toFixed(1).padStart(7)}ms  worst ${r.worstMs.toFixed(1).padStart(7)}ms` +
          `${r.seqScan ? '  [SEQ SCAN]' : ''}`,
      );
    }

    const scans = results.filter((r) => r.seqScan);
    if (scans.length > 0) {
      console.log(
        `\n  ${scans.length} query(ies) scan the whole table (${ROWS} tenant rows inside ` +
          `${ROWS + NOISE} total). A tenant-scoped composite index is what stops the scan being\n` +
          '  charged for every other tenant (AC5).',
      );
    }
    console.log(
      '\n  Scope: database time only. PostgREST overhead, the network, serialisation and\n' +
        '  React render are NOT measured, so a pass here is necessary for AC1 and not sufficient.',
    );
  } finally {
    await cleanup();
    await client.end();
  }
  process.exit(failed ? 1 : 0);
}

main().catch(async (err) => {
  console.error('✗ Benchmark failed:', err.message);
  try {
    await cleanup();
    await client.end();
  } catch {
    // The connection is already gone; nothing to clean up through it.
  }
  process.exit(1);
});
