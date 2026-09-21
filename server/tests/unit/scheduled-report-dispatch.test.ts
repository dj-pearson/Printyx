/**
 * Scheduled reports: the sweep the cron job has always posted to, and the
 * success it used to record for mail nobody received.
 *
 * `drizzle/cron/reports.sql` has posted to /reports/schedule/dispatch-due every
 * fifteen minutes since it shipped. The reports dispatcher routes
 * `/<reportId>/schedule` and had NOTHING named dispatch-due, so every tick was
 * a 404 and no scheduled report has ever fired. A cron job aimed at a path that
 * does not exist is worse than no cron job: the README inventory lists it, so a
 * reader concludes the schedule runs.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const strip = (src: string) =>
  src.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length));

const INDEX = 'supabase/functions/reports/index.ts';
const SWEEP = 'supabase/functions/reports/handlers/dispatch-due.ts';
const SCHEDULED = 'supabase/functions/reports/handlers/scheduled.ts';
const ENGINE = 'supabase/functions/reports/handlers/reporting-engine.ts';
const PAGE = 'client/src/pages/ScheduledReportsDashboard.tsx';

describe('every cron URL resolves to a branch that serves it', () => {
  /**
   * DERIVED from the cron file rather than pinned: the defect was a schedule
   * whose URL nothing routed, so an assertion naming the path by hand would
   * have been written against the same wrong string.
   */
  it('the reports schedule posts to a path the dispatcher routes', () => {
    const sql = read('drizzle/cron/reports.sql');
    const m = /functions\.printyx\.net\/reports\/([a-z0-9\-/]+)'/.exec(sql);
    expect(m, 'reports.sql must post to a /reports path').not.toBeNull();
    const segs = m![1].split('/').filter(Boolean);
    expect(segs.length).toBeGreaterThan(1);
    const idx = strip(read(INDEX));
    // Each segment must be compared against, in order, in the routing block.
    for (const seg of segs) {
      expect(idx, `no routing comparison for '${seg}'`).toMatch(new RegExp(`===\\s*'${seg}'`));
    }
  });

  it('and the sweep it reaches is the one that handles due schedules', () => {
    const idx = strip(read(INDEX));
    expect(idx).toMatch(/dispatchDueSchedules\(/);
    expect(existsSync(join(repo, SWEEP))).toBe(true);
  });
});

describe('the sweep', () => {
  const sweep = strip(read(SWEEP));
  const idx = strip(read(INDEX));

  it('is authenticated by the cron token and nothing else', () => {
    expect(idx).toMatch(/isCronRequest\(req\)/);
    expect(idx).toMatch(/CRON_ONLY/);
  });

  it('sits ABOVE requireAuth, because pg_cron carries no user JWT', () => {
    const at = idx.indexOf("'dispatch-due'");
    const auth = idx.indexOf('await requireAuth(req)');
    expect(at).toBeGreaterThan(-1);
    expect(auth).toBeGreaterThan(-1);
    expect(at).toBeLessThan(auth);
  });

  it('pages the due set rather than capping it', () => {
    // Bound to the CALL, not the identifier: the import keeps `fetchAllRows`
    // in the file, so a bare match survives a mutant that stops calling it -
    // the same "a name in an import is not a binding" trap round 142 hit.
    const at = sweep.indexOf('due = ');
    expect(at).toBeGreaterThan(-1);
    const assignment = sweep.slice(at, sweep.indexOf('} catch', at));
    expect(assignment).toMatch(/await fetchAllRows<[^>]*>\(\s*\(\)\s*=>/);
    expect(assignment).not.toMatch(/\.limit\(/);
  });

  it('scopes its update by tenant as well as by id', () => {
    // A sweep has no tenant of its own, which is exactly where a cross-tenant
    // update is easy to write (SEC-TENANT-005).
    const at = sweep.indexOf(".from('report_schedules')\n        .update(");
    expect(at).toBeGreaterThan(-1);
    const chain = sweep.slice(at, sweep.indexOf('if (updError)', at));
    expect(chain).toMatch(/\.eq\('tenant_id', row\.tenant_id\)/);
  });

  it('records a failure and steps over it; an all-failed sweep is not a 200', () => {
    expect(sweep).toMatch(/catch\s*\(/);
    expect(sweep).toMatch(/failures\.push/);
    expect(sweep).toMatch(
      /due\.length\s*>\s*0\s*&&\s*failures\.length\s*===\s*due\.length\s*\?\s*500\s*:\s*200/,
    );
  });

  it('advances next_run with the same function the CRUD paths use', () => {
    // Two implementations of next-run would let a swept schedule and an edited
    // one land on different semantics.
    expect(sweep).toMatch(/calculateNextRun\(/);
    expect(sweep).toMatch(/from '\.\/scheduled\.ts'/);
    expect(strip(read(SCHEDULED))).toMatch(/export function calculateNextRun\(/);
    expect(sweep).not.toMatch(/function calculateNextRun\(/);
  });

  it('does not increment run_count, which the page renders as deliveries', () => {
    expect(sweep).not.toMatch(/run_count/);
  });
});

describe('a run that delivered nothing is not recorded as a success', () => {
  const sched = strip(read(SCHEDULED));

  it('run-now stores failed with the degraded code', () => {
    const at = sched.indexOf('async function runScheduleNow');
    const end = sched.indexOf('async function listExecutions');
    const body = sched.slice(at, end);
    expect(body).toMatch(/status:\s*'failed'/);
    expect(body).toMatch(/error_code:\s*DELIVERY_DEGRADED_CODE/);
    expect(body).not.toMatch(/status:\s*'success'/);
    expect(body).not.toMatch(/last_status:\s*'success'/);
  });

  it('run-now no longer inflates the sent count', () => {
    const at = sched.indexOf('async function runScheduleNow');
    const end = sched.indexOf('async function listExecutions');
    expect(sched.slice(at, end)).not.toMatch(/run_count:/);
  });

  it('and says so in the body too, not only in the row', () => {
    const at = sched.indexOf('async function runScheduleNow');
    const end = sched.indexOf('async function listExecutions');
    const body = sched.slice(at, end);
    expect(body).toMatch(/delivered:\s*false/);
  });

  it('matches the sibling handler, which already recorded this honestly', () => {
    // reporting-engine.ts has always written failed + an error code for the
    // same missing capability. Two handlers in one function disagreeing about
    // whether a gap is a success is the shape this fixes.
    const engine = strip(read(ENGINE));
    expect(engine).toMatch(/status:\s*'failed'/);
    expect(engine).toMatch(/error_code:\s*'EXECUTE_DEGRADED'/);
  });

  it("'failed' is a member of the report_status enum", () => {
    const chain = read('drizzle/migrations/0000_fuzzy_blizzard.sql');
    const m = /CREATE TYPE "public"\."report_status" AS ENUM\(([^)]*)\)/.exec(chain);
    expect(m).not.toBeNull();
    const members = [...m![1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]);
    expect(members).toContain('failed');
    // and the one it replaces really was a member, so this was a choice
    // between two valid values rather than a bug being corrected by accident
    expect(members).toContain('success');
  });

  it('one definition of what a degraded delivery is', () => {
    expect(sched).toMatch(/export const DELIVERY_DEGRADED_CODE/);
    const sweep = strip(read(SWEEP));
    expect(sweep).toMatch(/DELIVERY_DEGRADED_CODE/);
    // the sweep imports it rather than restating the string
    expect(sweep).not.toMatch(/'DELIVERY_DEGRADED'/);
  });
});

describe('the page stops counting deliveries that did not happen', () => {
  const page = strip(read(PAGE));

  it('no hours-saved figure derived from a run count', () => {
    expect(page).not.toMatch(/hours of manual work/);
    expect(page).not.toMatch(/\*\s*0\.25/);
  });

  it('nothing is labelled as delivered', () => {
    expect(page).not.toMatch(/totalDeliveries/);
    expect(page).not.toMatch(/Reports Delivered Automatically/);
    expect(page).not.toMatch(/>Delivered</);
  });

  it('the run figure is labelled as attempts', () => {
    expect(page).toMatch(/runsAttempted/);
    expect(page).toMatch(/Runs attempted/);
  });

  it('and says plainly that delivery is not implemented', () => {
    expect(page).toMatch(/not implemented/i);
  });
});

describe('the schedule stays inventoried', () => {
  it('the job is in the cron README', () => {
    const job = /cron\.schedule\(\s*'([a-z-]+)'/.exec(read('drizzle/cron/reports.sql'))![1];
    expect(read('drizzle/cron/README.md')).toContain(`\`${job}\``);
  });

  it('every HTTP cron job in the tree posts to a real edge function directory', () => {
    // The generalisation of this round: a scheduled POST to a function that
    // does not exist is invisible until somebody reads the SQL.
    const dir = join(repo, 'drizzle/cron');
    const fns = new Set(
      readdirSync(join(repo, 'supabase/functions')).filter(
        (d) => !d.startsWith('_') && !d.includes('.'),
      ),
    );
    const missing: string[] = [];
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql'))) {
      const sql = readFileSync(join(dir, f), 'utf8');
      for (const m of sql.matchAll(/functions\.printyx\.net\/([a-z0-9-]+)/g)) {
        if (!fns.has(m[1])) missing.push(`${f}: ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
