/**
 * The platform tenant-health score, and the sweep that fires it.
 *
 * `platform_health_scores` had NO WRITER in the repo: the scorer existed,
 * worked, and was called by no client tree and no cron file, so the table had
 * never held a row and /platform-customer-success rendered an empty table with
 * zeroed headline cards. Firing it was only half the job - four of the six
 * factors it weighted were constants over columns nothing writes, so switching
 * the sweep on without this rewrite would have PUBLISHED that to every
 * account's churn_risk.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  MIN_COVERAGE,
  churnRiskFor,
  lastActivityAt,
  scoreTenantHealth,
  type PlatformRecordRow,
} from '@shared/platform-health-score';

const repo = process.cwd();
const FN = join(repo, 'supabase/functions/platform-cs/index.ts');
const PAGE = join(repo, 'client/src/pages/PlatformCustomerSuccess.tsx');
const CRON = join(repo, 'drizzle/cron/platform-cs.sql');
const CRON_README = join(repo, 'drizzle/cron/README.md');

function strip(src: string) {
  return src
    .replace(/(?<![:/])\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length));
}

const NOW = new Date('2026-09-21T12:00:00Z');
/** A tenant with both measurable factors present. */
const healthy = (over: Partial<PlatformRecordRow> = {}): PlatformRecordRow => ({
  id: 'br-1',
  record_type: 'tenant',
  status: 'active_customer',
  company_name: 'Acme Copiers',
  current_mrr: 2400,
  last_contact_date: '2026-09-20T09:00:00Z',
  ...over,
});

describe('what the score refuses to invent', () => {
  it('reports the four unmeasured factors by name rather than scoring them', () => {
    const r = scoreTenantHealth(healthy(), NOW);
    const unmeasured = r.factors.filter((f) => f.score === null).map((f) => f.key);
    // Product usage, adoption and support have no writer anywhere; satisfaction
    // has none either until an NPS or CSAT lands on the record.
    expect(unmeasured.sort()).toEqual(['adoption', 'productUsage', 'satisfaction', 'support']);
    for (const f of r.factors.filter((x) => x.score === null)) {
      expect(f.reason, `${f.key} must say why it is unmeasured`).toBeTruthy();
      expect(f.reason!.length).toBeGreaterThan(20);
    }
    expect(r.unmeasured.length).toBe(4);
  });

  it('never scores product usage, adoption or support as a constant', () => {
    // The old scorer used engagement_score || 0 (always 0 - nothing writes it),
    // a literal 70 and a literal 85. Vary everything the row can carry and
    // those three must stay null on every input.
    for (const over of [
      {},
      { current_mrr: 0 },
      { nps_score: 90 },
      { last_contact_date: null },
      { status: 'churned' },
    ]) {
      const r = scoreTenantHealth(healthy(over as Partial<PlatformRecordRow>), NOW);
      for (const key of ['productUsage', 'adoption', 'support']) {
        expect(r.factors.find((f) => f.key === key)!.score, key).toBeNull();
      }
    }
  });

  it('an absent MRR is unmeasured, not half-healthy', () => {
    // `mrr ? 100 : 50` called an unfilled field a 50.
    const absent = scoreTenantHealth(healthy({ current_mrr: null }), NOW);
    expect(absent.factors.find((f) => f.key === 'payment')!.score).toBeNull();
    // A recorded zero IS a measurement and scores zero.
    const zero = scoreTenantHealth(healthy({ current_mrr: 0 }), NOW);
    expect(zero.factors.find((f) => f.key === 'payment')!.score).toBe(0);
  });

  it('an account with no activity logged is unmeasured, not 999 days idle', () => {
    const r = scoreTenantHealth(
      healthy({ last_contact_date: null, last_engagement_date: null }),
      NOW,
    );
    expect(r.daysSinceLastActivity).toBeNull();
    expect(r.factors.find((f) => f.key === 'outreachRecency')!.score).toBeNull();
    // and it must not be reported as a risk, which is what the 999 sentinel did
    expect(r.riskFactors).not.toContain('No recent activity');
  });
});

describe('renormalisation', () => {
  it('divides by the measured weight, so removing a fabricated factor is not a collapse', () => {
    const r = scoreTenantHealth(healthy(), NOW);
    const measured = r.factors.filter((f) => f.score !== null);
    const weighted = measured.reduce((sum, f) => sum + (f.score as number) * f.weight, 0);
    expect(r.coverage).toBeCloseTo(
      measured.reduce((s, f) => s + f.weight, 0),
      6,
    );
    expect(r.overallScore).toBe(Math.round(weighted / r.coverage));
    // The proof it renormalises: a tenant perfect on everything measured scores
    // 100, not 100 * coverage.
    const perfect = scoreTenantHealth(
      healthy({ last_contact_date: NOW.toISOString(), nps_score: 100 }),
      NOW,
    );
    expect(perfect.overallScore).toBe(100);
  });

  it('coverage names the fraction that had data behind it', () => {
    const two = scoreTenantHealth(healthy(), NOW);
    const three = scoreTenantHealth(healthy({ nps_score: 40 }), NOW);
    expect(three.coverage).toBeGreaterThan(two.coverage);
    expect(three.coverage).toBeLessThanOrEqual(1);
  });
});

describe('too little measured produces no row', () => {
  it('skips rather than inventing a value for two NOT NULL columns', () => {
    const r = scoreTenantHealth(
      { id: 'br-2', record_type: 'tenant', current_mrr: null, last_contact_date: null },
      NOW,
    );
    expect(r.overallScore).toBeNull();
    expect(r.healthStatus).toBeNull();
    expect(r.skipped).toBeTruthy();
    expect(r.coverage).toBeLessThan(MIN_COVERAGE);
  });

  it('one factor alone is below the floor', () => {
    const onlyPayment = scoreTenantHealth(
      { id: 'br-3', record_type: 'tenant', current_mrr: 500, last_contact_date: null },
      NOW,
    );
    // 0.2 < 0.3: a composite resting on one factor is that factor wearing a
    // composite's name.
    expect(onlyPayment.overallScore).toBeNull();
    expect(MIN_COVERAGE).toBeGreaterThan(0.2);
  });

  it('the floor is a real threshold, not a disabled one', () => {
    expect(MIN_COVERAGE).toBeGreaterThan(0);
    expect(MIN_COVERAGE).toBeLessThan(1);
  });
});

describe('status and churn risk', () => {
  it('a churned account is churned whatever the factors say', () => {
    for (const status of ['churned', 'former_customer']) {
      const r = scoreTenantHealth(healthy({ status, nps_score: 100 }), NOW);
      expect(r.healthStatus, status).toBe('churned');
    }
  });

  it('every status it can emit is a member of the migration 0000 enum', () => {
    const chain = readFileSync(join(repo, 'drizzle/migrations/0000_fuzzy_blizzard.sql'), 'utf8');
    const m = /CREATE TYPE "public"\."platform_health_status" AS ENUM\(([^)]*)\)/.exec(chain);
    expect(m).not.toBeNull();
    const members = [...m![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
    const emitted = new Set<string>();
    for (const over of [
      { last_contact_date: NOW.toISOString(), nps_score: 100 },
      { last_contact_date: '2026-09-10T00:00:00Z' },
      { last_contact_date: '2026-08-20T00:00:00Z', current_mrr: 0 },
      { last_contact_date: '2026-06-01T00:00:00Z', current_mrr: 0 },
      { status: 'churned' },
    ]) {
      const r = scoreTenantHealth(healthy(over as Partial<PlatformRecordRow>), NOW);
      if (r.healthStatus) emitted.add(r.healthStatus);
    }
    expect(emitted.size).toBeGreaterThan(2);
    for (const e of emitted) expect(members, e).toContain(e);
  });

  it('churn risk maps onto the platform_churn_risk enum', () => {
    const chain = readFileSync(join(repo, 'drizzle/migrations/0000_fuzzy_blizzard.sql'), 'utf8');
    const m = /CREATE TYPE "public"\."platform_churn_risk" AS ENUM\(([^)]*)\)/.exec(chain);
    const members = [...m![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
    for (const s of ['excellent', 'healthy', 'at_risk', 'critical', 'churned'] as const) {
      const risk = churnRiskFor(s);
      expect(risk, s).not.toBeNull();
      expect(members, `${s} -> ${risk}`).toContain(risk!);
    }
    expect(churnRiskFor(null)).toBeNull();
  });
});

describe('risk factors only cite what was measured', () => {
  it('does not flag low usage, which the old scorer put on every account', () => {
    // usageScore was always 0, so `if (usageScore < 50) push('Low usage')`
    // fired for every tenant on the platform.
    const r = scoreTenantHealth(healthy(), NOW);
    expect(r.riskFactors.join(' ')).not.toMatch(/Low usage/i);
  });

  it('does not cite NPS when none is recorded', () => {
    const r = scoreTenantHealth(healthy(), NOW);
    expect(r.riskFactors).not.toContain('Negative NPS');
    expect(r.strengthFactors).not.toContain('High NPS');
  });

  it('cites a stale account that really is stale', () => {
    const r = scoreTenantHealth(healthy({ last_contact_date: '2026-05-01T00:00:00Z' }), NOW);
    expect(r.riskFactors).toContain('No recent activity');
  });
});

describe('lastActivityAt', () => {
  it('takes the most recent of the two columns', () => {
    const a = lastActivityAt({
      last_contact_date: '2026-01-01T00:00:00Z',
      last_engagement_date: '2026-06-01T00:00:00Z',
    });
    expect(a?.toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });
  it('is null when neither is set', () => {
    expect(lastActivityAt({})).toBeNull();
    expect(lastActivityAt({ last_contact_date: '' })).toBeNull();
  });
});

describe('the edge function calls the shared module rather than its own copy', () => {
  const fn = strip(readFileSync(FN, 'utf8'));

  it('imports it, and the specifier resolves on disk', () => {
    const m = /from\s+'([^']*shared\/platform-health-score\.ts)'/.exec(fn);
    expect(m, 'platform-cs must import the shared scorer').not.toBeNull();
    // Resolve rather than pinning a depth: a handler is four levels deep and an
    // index.ts is three, and the wrong one is a silent production 404.
    expect(existsSync(join(repo, 'supabase/functions/platform-cs', m![1]))).toBe(true);
  });

  it('CALLS it - an import nothing invokes reads as wired and decides nothing', () => {
    expect(fn).toMatch(/scoreTenantHealth\s*\(/);
    expect(fn).toMatch(/churnRiskFor\s*\(/);
  });

  it('keeps no second copy of the arithmetic', () => {
    // The literals that were the four constants.
    expect(fn).not.toMatch(/adoptionScore\s*=\s*\d/);
    expect(fn).not.toMatch(/supportScore\s*=\s*\d/);
    expect(fn).not.toMatch(/engagement_score\s*\|\|\s*0/);
    // and no second weighting
    expect(fn).not.toMatch(/\*\s*0\.15\s*\+/);
  });

  it('routes both entry points through one store function', () => {
    const calls = [...fn.matchAll(/scoreAndStore\s*\(/g)];
    // one definition + the button + the sweep
    expect(calls.length).toBeGreaterThanOrEqual(3);
    expect([...fn.matchAll(/\.from\('platform_health_scores'\)\s*\n?\s*\.upsert/g)].length).toBe(1);
  });
});

describe('the sweep', () => {
  const raw = readFileSync(FN, 'utf8');
  const fn = strip(raw);

  it('authenticates with the cron token and nothing else', () => {
    expect(fn).toMatch(/isCronRequest\s*\(\s*req\s*\)/);
    expect(fn).toMatch(/CRON_ONLY/);
  });

  it('sits ABOVE auth.getUser, because pg_cron carries no user JWT', () => {
    const sweep = fn.indexOf("'calculate-all'");
    const getUser = fn.indexOf('auth.getUser');
    expect(sweep).toBeGreaterThan(-1);
    expect(getUser).toBeGreaterThan(-1);
    expect(sweep).toBeLessThan(getUser);
  });

  it('pages rather than capping - a flat limit re-finds page one every night', () => {
    const at = fn.indexOf("'calculate-all'");
    const end = fn.indexOf('const authHeader', at);
    const branch = fn.slice(at, end);
    expect(branch).toMatch(/fetchAllRows/);
    expect(branch).not.toMatch(/\.limit\(/);
  });

  it('records a failure and steps over it rather than aborting the platform', () => {
    const at = fn.indexOf("'calculate-all'");
    const end = fn.indexOf('const authHeader', at);
    const branch = fn.slice(at, end);
    expect(branch).toMatch(/catch\s*\(/);
    expect(branch).toMatch(/failures\.push/);
    // and an all-failed sweep is not a 200 nobody reads
    expect(branch).toMatch(/allFailed/);
    expect(branch).toMatch(/allFailed\s*\?\s*500\s*:\s*200/);
  });

  it('writes no user id for a scheduled run', () => {
    const at = fn.indexOf("'calculate-all'");
    const end = fn.indexOf('const authHeader', at);
    expect(fn.slice(at, end)).toMatch(/scoreAndStore\([^)]*,\s*null\s*\)/);
  });
});

describe('the schedule is known to exist', () => {
  it('has a cron file posting to the sweep', () => {
    expect(existsSync(CRON)).toBe(true);
    const sql = readFileSync(CRON, 'utf8');
    expect(sql).toMatch(/platform-cs\/health-scores\/calculate-all/);
    expect(sql).toMatch(/app\.internal_cron_token/);
    // idempotent: unschedule guards the schedule
    expect(sql).toMatch(/cron\.unschedule\('platform-cs-health-scores'\)/);
  });

  it('is listed in the README inventory, which is how a job stops being forgotten', () => {
    const readme = readFileSync(CRON_README, 'utf8');
    const job = /cron\.schedule\(\s*'([a-z-]+)'/.exec(readFileSync(CRON, 'utf8'))![1];
    expect(readme).toContain(`\`${job}\``);
    expect(readme).toContain('platform-cs.sql');
  });

  it('does not collide with a job already on that minute', () => {
    const mine = /cron\.schedule\(\s*'[a-z-]+',\s*'([^']+)'/.exec(readFileSync(CRON, 'utf8'))![1];
    const readme = readFileSync(CRON_README, 'utf8');
    const rows = [...readme.matchAll(/^\|\s*`([a-z-]+)`\s*\|[^|]*\|\s*`([^`]+)`/gm)];
    expect(rows.length).toBeGreaterThan(10);
    const clashes = rows.filter((r) => r[2] === mine && r[1] !== 'platform-cs-health-scores');
    expect(clashes.map((c) => c[1])).toEqual([]);
  });
});

describe('the page stops claiming what nothing measures', () => {
  const page = strip(readFileSync(PAGE, 'utf8'));

  it('no longer reports every tenant as onboarded', () => {
    expect(page).not.toMatch(/onboardingStatus/);
    expect(page).not.toMatch(/onboardingProgress/);
  });

  it('no longer renders 0/0 users or 0% adoption', () => {
    expect(page).not.toMatch(/\{tenant\.activeUsers\}\/\{tenant\.totalUsers\}/);
    expect(page).not.toMatch(/\{tenant\.featureAdoption\}%/);
  });

  it('nulls the unmeasured fields rather than zeroing them', () => {
    expect(page).toMatch(/activeUsers:\s*null/);
    expect(page).toMatch(/totalUsers:\s*null/);
    expect(page).toMatch(/loginFrequency:\s*null/);
  });

  it('shows a CSM name rather than the stored user id', () => {
    expect(page).toMatch(/csmNameById/);
  });
});
