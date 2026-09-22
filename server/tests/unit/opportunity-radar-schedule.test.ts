/**
 * The radar actually runs on a schedule now (COP-B04 AC1/AC5).
 *
 * Every other criterion on that story was met - the scan is chunked, idempotent
 * against a unique index, kill-switched per tenant, ranked, territory-scoped
 * and surfaced on the workspace. What it never had was a CALLER: POST /scan was
 * fired by one button on /opportunity-radar and by nothing else, so a play about
 * a lease ending in 90 days was detected the day a rep happened to look. A scan
 * nobody fires is a report, not a radar.
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

const FN = read('supabase/functions/opportunity-radar/index.ts');
const CRON = read('drizzle/cron/opportunity-radar.sql');
const README = read('drizzle/cron/README.md');

/** Source with comments blanked, for the absence assertions only. */
const CODE = FN.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

describe('the schedule and the handler agree on a path', () => {
  it('the cron posts to the branch the handler serves', () => {
    const url = /url := '([^']+)'/.exec(CRON)?.[1];
    expect(url).toBe('https://functions.printyx.net/opportunity-radar/scan/all');
    // The dispatcher strips segment 0, so the handler sees /scan/all.
    expect(CODE).toContain("cronParts[0] === 'scan' && cronParts[1] === 'all'");
  });

  it('routes through normalizePath rather than indexing the raw split', () => {
    // CLAUDE.md's prod-only 404 class: an edge handler never sees its own name.
    expect(CODE).toContain("normalizePath(cronUrl.pathname, 'opportunity-radar')");
  });

  it('carries the cron token and names the job', () => {
    expect(CRON).toContain("current_setting('app.internal_cron_token', true)");
    expect(CRON).toContain("'X-Cron-Job', 'opportunity-radar-scan'");
  });

  it('is idempotent as a schedule, like every other file here', () => {
    expect(CRON).toContain("cron.unschedule('opportunity-radar-scan')");
    expect(CRON).toContain("cron.schedule(\n  'opportunity-radar-scan',");
  });

  it('is in the README inventory', () => {
    // A cron file missing from the table is how a job stops being known to
    // exist. booking-reminders sat unlisted for three days.
    expect(README).toContain('opportunity-radar-scan');
    expect(README).toContain('booking-reminders');
    expect(README).toContain('booking-attempts-prune');
  });

  it('every cron .sql has an inventory row', () => {
    const files = readdirSync(join(repo, 'drizzle/cron')).filter(
      (f) => f.endsWith('.sql') && f !== '_bootstrap.sql',
    );
    const missing = files.filter((f) => !README.includes(f));
    expect(missing).toEqual([]);
  });
});

describe("the sweep is the scheduler's alone", () => {
  it('rejects anything without the cron token - there is no user fallback', () => {
    // A tenant-wide sweep across EVERY tenant is not something any user should
    // be able to trigger. A manager runs their own tenant through POST /scan.
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
    // ReferenceError. check:shared-helper-imports caught exactly this one.
    expect(FN).toContain("from '../_shared/cron-auth.ts'");
  });
});

describe('one tenant cannot take the sweep down with it', () => {
  it('records a failure and steps over it', () => {
    expect(CODE).toContain('failed.push({ tenantId, error: message })');
    expect(CODE).toContain('failures: failed');
  });

  it('a sweep where everything failed is not a 200', () => {
    // The AUDIT-028 shape: a partial sweep read as a quiet night.
    expect(CODE).toContain('failed.length > 0 && scanned.length === 0 ? 500 : 200');
  });

  it('counts skips separately from scans, so the kill switch is visible', () => {
    expect(CODE).toContain('skipped: skipped.length');
  });
});

describe('the button and the schedule run the same code', () => {
  it('both go through runScan', () => {
    // A scheduled scan that drifted from the one a manager can press would be
    // two radars, and only one of them ever gets looked at.
    expect(CODE.match(/runScan\(admin, tenantId/g) ?? []).toHaveLength(2);
  });

  it('runScan still honours the per-tenant kill switch', () => {
    expect(CODE).toContain('settingsRow && settingsRow.scan_enabled === 0 && !force');
  });

  it('a tenant with no settings row is enabled, not skipped', () => {
    // The radar is on by default and opted out of. A truthiness check on the
    // column would silently disable every tenant that never opened settings.
    const scan = CODE.slice(CODE.indexOf('async function runScan'));
    expect(scan.slice(0, 1200)).toContain('settingsRow &&');
  });
});
