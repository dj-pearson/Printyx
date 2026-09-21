/**
 * The suggestion sweep, and the two retention purges that are NOT scheduled.
 *
 * `suggested_tasks` had no reachable writer: POST /suggested-tasks/sweep is the
 * only thing that fills it, no client tree posts to it and no cron file fired
 * it, while `SuggestedTasksCard` sits in TodayDashboard's card slots. Every
 * rep's My Day carried a permanently empty Suggested Tasks card, which reads as
 * "nothing needs doing" rather than as a feature nobody wired.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.cwd();
const FN = join(repo, 'supabase/functions/suggested-tasks/index.ts');
const CRON = join(repo, 'drizzle/cron/suggested-tasks.sql');
const README = join(repo, 'drizzle/cron/README.md');

function strip(src: string) {
  return src
    .replace(/(?<![:/])\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length));
}
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e.startsWith('.')) continue;
    const f = join(dir, e);
    if (statSync(f).isDirectory()) walk(f, out);
    else out.push(f);
  }
  return out;
}

describe('one sweep implementation, two entry points', () => {
  const fn = strip(readFileSync(FN, 'utf8'));

  it('the per-tenant work is a function, not a branch body', () => {
    expect(fn).toMatch(/async function runSweep\(/);
    // COP-B04: the button and the schedule share it, or they drift.
    const calls = [...fn.matchAll(/runSweep\(/g)];
    expect(calls.length).toBeGreaterThanOrEqual(3); // definition + 2 callers
  });

  it('runSweep closes over nothing from the request handler', () => {
    const body = fn.slice(fn.indexOf('async function runSweep('));
    const end = body.indexOf('\nasync function sweepAllTenants');
    const scoped = body.slice(0, end > 0 ? end : undefined);
    // A closure over req/user/authCtx is what would make it un-callable from
    // the scheduler, which carries neither.
    for (const name of ['authCtx', 'requireManager', 'denyManager', 'createCorsResponse']) {
      expect(scoped, name).not.toMatch(new RegExp(`\\b${name}\\b`));
    }
  });

  it('the upsert that fills the table lives in exactly one place', () => {
    expect([...fn.matchAll(/\.from\('suggested_tasks'\)\s*\n?\s*\.upsert/g)].length).toBe(1);
  });

  it('the manager button still gates, and the cron branch does not use it', () => {
    const btn = fn.indexOf("resource === 'sweep' && !action");
    const after = fn.slice(btn, btn + 400);
    expect(after).toMatch(/requireManager\(\)/);
    const cron = fn.indexOf("cronParts[1] === 'all'");
    const cronBranch = fn.slice(cron, cron + 500);
    expect(cronBranch).toMatch(/isCronRequest\(req\)/);
    expect(cronBranch).not.toMatch(/requireManager/);
  });
});

describe('the cross-tenant sweep', () => {
  const fn = strip(readFileSync(FN, 'utf8'));

  it('sits ABOVE auth.getUser, because pg_cron carries no user JWT', () => {
    const sweep = fn.indexOf("cronParts[1] === 'all'");
    const getUser = fn.indexOf('auth.getUser');
    expect(sweep).toBeGreaterThan(-1);
    expect(getUser).toBeGreaterThan(-1);
    expect(sweep).toBeLessThan(getUser);
  });

  it('records a failure and steps over it rather than aborting every tenant', () => {
    const at = fn.indexOf('async function sweepAllTenants');
    const end = fn.indexOf('export default async function handler');
    const body = fn.slice(at, end);
    expect(body).toMatch(/catch\s*\(/);
    expect(body).toMatch(/failed\.push/);
    // An all-failed sweep is not a success with a detail field.
    expect(body).toMatch(
      /failed\.length\s*>\s*0\s*&&\s*swept\.length\s*===\s*0\s*\?\s*500\s*:\s*200/,
    );
  });

  it('a tenant with the kill switch off is skipped and counted, not failed', () => {
    const at = fn.indexOf('async function sweepAllTenants');
    const end = fn.indexOf('export default async function handler');
    const body = fn.slice(at, end);
    expect(body).toMatch(/result\.skipped/);
    expect(body).toMatch(/skipped\.push/);
    // and the switch itself is honoured inside runSweep, so both entry points
    // respect it
    const run = fn.slice(fn.indexOf('async function runSweep('));
    expect(run.slice(0, run.indexOf('\nasync function sweepAllTenants'))).toMatch(
      /sweep_enabled === 0/,
    );
  });

  it('runs tenants sequentially', () => {
    const at = fn.indexOf('async function sweepAllTenants');
    const end = fn.indexOf('export default async function handler');
    const body = fn.slice(at, end);
    expect(body).toMatch(/for \(const tenantId of/);
    expect(body).not.toMatch(/Promise\.all\(\s*tenants/);
  });
});

describe('the schedule is known to exist', () => {
  it('posts to the sweep with the cron token', () => {
    expect(existsSync(CRON)).toBe(true);
    const sql = readFileSync(CRON, 'utf8');
    expect(sql).toMatch(/suggested-tasks\/sweep\/all/);
    expect(sql).toMatch(/app\.internal_cron_token/);
    expect(sql).toMatch(/cron\.unschedule\('suggested-tasks-sweep'\)/);
  });

  it('is listed in the README inventory', () => {
    const sql = readFileSync(CRON, 'utf8');
    const job = /cron\.schedule\(\s*'([a-z-]+)'/.exec(sql)![1];
    const readme = readFileSync(README, 'utf8');
    expect(readme).toContain(`\`${job}\``);
    expect(readme).toContain('suggested-tasks.sql');
  });

  it('runs after the radar, whose plays it reads', () => {
    const mine = /cron\.schedule\(\s*'[a-z-]+',\s*'(\d+) (\d+)/.exec(readFileSync(CRON, 'utf8'))!;
    const radar = /cron\.schedule\(\s*'[a-z-]+',\s*'(\d+) (\d+)/.exec(
      read('drizzle/cron/opportunity-radar.sql'),
    )!;
    const mins = (m: RegExpExecArray) => Number(m[2]) * 60 + Number(m[1]);
    // suggestionsFromPlays reads radar_plays, so sweeping first would miss a
    // night of plays every night.
    expect(mins(mine)).toBeGreaterThan(mins(radar));
  });

  it('does not collide with a job already on that minute', () => {
    const mine = /cron\.schedule\(\s*'[a-z-]+',\s*'([^']+)'/.exec(readFileSync(CRON, 'utf8'))![1];
    const rows = [
      ...readFileSync(README, 'utf8').matchAll(/^\|\s*`([a-z-]+)`\s*\|[^|]*\|\s*`([^`]+)`/gm),
    ];
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.filter((r) => r[2] === mine && r[1] !== 'suggested-tasks-sweep')).toEqual([]);
  });
});

describe('the card this fills is actually on a screen', () => {
  it('SuggestedTasksCard is in the My Day card slots', () => {
    const page = strip(read('client/src/pages/TodayDashboard.tsx'));
    expect(page).toMatch(/'suggested-tasks':\s*<SuggestedTasksCard/);
  });
});

/**
 * Two retention purges found in the same sweep of batch endpoints, NOT
 * scheduled, and this records why rather than leaving the next reader to
 * rediscover them.
 *
 * `voice-agent/purge-recordings` and `voice-ticket-close/purge-audio` are both
 * correct, both gated, both indexed for the sweep, and both would match NOTHING:
 * they null a URL column that nothing in this repo ever writes. AUDIT-034's rule
 * is that for a control nobody mounted you ask what it would READ and go and
 * look for that column - so scheduling them today would install a retention job
 * that purges nothing while reading as though retention were handled.
 *
 * These assertions FAIL the day a writer appears, which turns the gap into work
 * at the moment it becomes real instead of a note that goes stale.
 */
describe('the voice retention purges have nothing to purge yet', () => {
  const edgeFiles = walk(join(repo, 'supabase/functions')).filter((f) => f.endsWith('.ts'));

  /**
   * Scoped to the function that owns the table, not the whole edge tree:
   * `meeting_recordings` DOES store a recording_url and has its own retention
   * job in retention.sql, so an unscoped scan reports a correct writer for a
   * different table. Which is itself the point - the column name is real
   * elsewhere, and this one is empty.
   */
  const writesColumn = (col: string, onlyIn: string) => {
    const hits: string[] = [];
    for (const f of edgeFiles.filter((x) => x.includes(onlyIn))) {
      const src = strip(readFileSync(f, 'utf8'));
      for (const m of src.matchAll(new RegExp(`${col}\\s*:`, 'g'))) {
        // A write is the column as a key with a value; the purge itself sets it
        // to null, and a select list names it without assigning.
        const tail = src.slice(m.index! + m[0].length, m.index! + m[0].length + 40).trim();
        if (tail.startsWith('null')) continue;
        hits.push(`${f.replace(repo + '/', '')}: ${tail.slice(0, 40)}`);
      }
    }
    return hits;
  };

  it('nothing stores a voice-agent recording URL', () => {
    expect(writesColumn('recording_url', '/voice-agent/')).toEqual([]);
  });

  it('nothing stores a voice-ticket-close audio URL, except the caller-supplied field', () => {
    // The only assignment is `audio_url: body.audioUrl ?? null` and NO client
    // in any tree sends audioUrl, so the column is null in practice.
    const hits = writesColumn('audio_url', '/voice-ticket-close/');
    expect(hits.length).toBeLessThanOrEqual(1);
    for (const h of hits) expect(h).toMatch(/body\.audioUrl/);
    const TREES = [
      'client/src',
      'printyx-client',
      'printyx-desktop',
      'mobile-app',
      'mobile',
      'ios',
    ];
    const senders: string[] = [];
    for (const t of TREES) {
      for (const f of walk(join(repo, t))) {
        if (!/\.(ts|tsx|swift|kt)$/.test(f)) continue;
        if (/\baudioUrl\b/.test(strip(readFileSync(f, 'utf8')))) senders.push(f);
      }
    }
    expect(senders).toEqual([]);
  });

  it('so neither purge is scheduled, and that is deliberate', () => {
    const cron = walk(join(repo, 'drizzle/cron'))
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    expect(cron).not.toMatch(/purge-recordings/);
    expect(cron).not.toMatch(/purge-audio/);
  });

  it('the deadline columns ARE written, which is what makes this a real gap', () => {
    // The row advertises a 90-day / 30-day purge deadline for a field that is
    // always empty, while the transcript - what the customer actually said - is
    // stored with no deadline at all.
    expect(strip(read('supabase/functions/voice-agent/index.ts'))).toMatch(
      /recording_purge_at:\s*new Date/,
    );
    expect(strip(read('supabase/functions/voice-ticket-close/index.ts'))).toMatch(
      /audio_purge_at:\s*new Date/,
    );
  });
});
