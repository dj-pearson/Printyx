/**
 * Approval SLA breaches are noticed without a manual curl (QUALITY-002).
 *
 * `POST /deal-desk/check-sla` shipped with a comment saying its pg_cron entry
 * was "Phase 6 US-026". That was never built, `drizzle/cron/` had no deal-desk
 * file, and no client tree calls the endpoint - so `sla_breached` flipped only
 * when somebody ran a curl by hand. That column is what the deal desk's
 * compliance analytics are computed from, so an unmarked breach is not just a
 * missing alert: it makes the SLA figures wrong in the flattering direction.
 *
 * Read from source, because nothing typechecks the edge tree and a cron job is
 * three strings that have to agree: the URL in the .sql, the path the handler
 * branches on, and the job name in the header.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

const FN = read('supabase/functions/deal-desk/index.ts');
const CRON = read('drizzle/cron/deal-desk-sla.sql');
const README = read('drizzle/cron/README.md');

/** Comments blanked, for the absence assertions - this file and the handler
 *  both name `.limit(500)` in prose explaining why it is gone. */
const CODE = FN.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

describe('the schedule and the handler agree on a path', () => {
  it('the cron posts to the branch the handler serves', () => {
    const url = /url := '([^']+)'/.exec(CRON)?.[1];
    expect(url).toBe('https://functions.printyx.net/deal-desk/check-sla/all');
    // The dispatcher strips segment 0, so the handler sees /check-sla/all.
    expect(CODE).toContain("cronParts[0] === 'check-sla' && cronParts[1] === 'all'");
  });

  it('routes through normalizePath rather than indexing the raw split', () => {
    expect(CODE).toContain("normalizePath(cronUrl.pathname, 'deal-desk')");
  });

  it('carries the cron token and names the job', () => {
    expect(CRON).toContain("current_setting('app.internal_cron_token', true)");
    expect(CRON).toContain("'X-Cron-Job', 'deal-desk-sla-check'");
  });

  it('is idempotent as a schedule, like every other file here', () => {
    expect(CRON).toContain("cron.unschedule('deal-desk-sla-check')");
    expect(CRON).toContain("cron.schedule(\n  'deal-desk-sla-check',");
  });

  it('runs hourly, because an SLA deadline is measured in hours', () => {
    // A nightly sweep would report a breach up to 24 hours late and stamp
    // escalated_at with the sweep time rather than anything near the deadline.
    const schedule = /cron\.schedule\(\n\s*'deal-desk-sla-check',\n\s*'([^']+)'/.exec(CRON)?.[1];
    expect(schedule).toMatch(/^\d+ \* \* \* \*$/);
  });

  /**
   * Three things have to agree and none of them was checked: the jobs actually
   * scheduled across drizzle/cron/*.sql, the rows in the README table, and the
   * total printed under it. The total said 16 while the table listed 19 - drift
   * in the one document whose job is to answer "what runs on a schedule here".
   * A file missing from that table is how a job stops being known to exist;
   * booking-reminders sat unlisted for three days.
   */
  it('the README inventory matches what is actually scheduled', () => {
    const scheduled = new Set<string>();
    for (const file of readdirSync(join(repo, 'drizzle/cron')).filter((f) => f.endsWith('.sql'))) {
      const src = read(`drizzle/cron/${file}`);
      for (const m of src.matchAll(/cron\.schedule\(\s*\n?\s*'([a-z0-9-]+)'/g)) {
        scheduled.add(m[1]);
      }
    }
    const rows = [...README.matchAll(/^\| `([a-z0-9-]+)`/gm)].map((m) => m[1]);

    expect(scheduled.size).toBeGreaterThan(10);
    expect([...scheduled].filter((j) => !rows.includes(j))).toEqual([]);
    expect(rows.filter((r) => !scheduled.has(r))).toEqual([]);

    const total = Number(/\*\*Total: (\d+) jobs\.\*\*/.exec(README)?.[1]);
    expect(total).toBe(scheduled.size);
    expect(scheduled.has('deal-desk-sla-check')).toBe(true);
  });
});

describe("the sweep is the scheduler's alone", () => {
  it('rejects anything without the cron token - there is no user fallback', () => {
    expect(CODE).toContain('if (!isCronRequest(req))');
    expect(CODE).toContain("code: 'CRON_ONLY'");
  });

  it('runs above auth.getUser, because pg_cron carries no user JWT', () => {
    const cronAt = CODE.indexOf('isCronRequest(req)');
    const authAt = CODE.indexOf('supabase.auth.getUser');
    expect(cronAt).toBeGreaterThan(0);
    expect(cronAt).toBeLessThan(authAt);
  });

  it('imports the helper it calls', () => {
    // The edge tree is outside tsc, so a missing import is a runtime
    // ReferenceError rather than a compile error.
    expect(FN).toContain("from '../_shared/cron-auth.ts'");
  });

  it('one tenant cannot take the sweep down with it', () => {
    expect(CODE).toContain('failures.push({ tenantId, error: message })');
    expect(CODE).toContain('failed: failures.length');
    // A sweep where everything failed is not a 200 with a detail field.
    expect(CODE).toContain('failures.length > 0 && swept === 0 ? 500 : 200');
  });
});

describe('the button and the schedule run the same code', () => {
  it('both go through runSlaCheck', () => {
    // A scheduled check that drifted from the one a manager can press would be
    // two jobs, and only one of them ever gets looked at.
    expect(CODE.match(/runSlaCheck\(admin, tenantId\)/g) ?? []).toHaveLength(2);
  });

  it('pages instead of capping, so a backlog can clear', () => {
    // The inline version took a flat .limit(500) and reported what it found.
    // On an hourly schedule a tenant past that cap would never catch up,
    // because each run re-found the same first 500.
    expect(CODE).not.toContain('.limit(500)');
    expect(CODE).toContain('if (ids.length < PAGE) break;');
  });

  it('the write is filtered by tenant, not authorised by the id list', () => {
    // SEC-TENANT-005: an id is not an authorisation check.
    const fn = CODE.slice(CODE.indexOf('export async function runSlaCheck'));
    const update = fn.slice(fn.indexOf('.update({ sla_breached: true'));
    expect(update.slice(0, 300)).toContain(".eq('tenant_id', tenantId)");
  });

  it('is idempotent, so a double fire claims nothing twice', () => {
    const fn = CODE.slice(CODE.indexOf('export async function runSlaCheck'));
    expect(fn.slice(0, 1800)).toContain(".eq('sla_breached', false)");
  });
});

describe('what is still missing is said out loud', () => {
  it('both responses say a breach is marked and nobody is told', () => {
    // The edge function sends no email; the Express service that did was an
    // orphan and is deleted. Marking a breach silently is a smaller gap than
    // an unmarked one, but it is still a gap.
    expect(FN).toContain('notification dispatch');
    expect(FN.match(/followUp:/g) ?? []).toHaveLength(2);
  });
});
