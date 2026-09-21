/**
 * A scheduled job must post to a path something serves.
 *
 * pg_net discards the response, so a cron URL that 404s is the quietest
 * failure this repo has: the edge function exists, the cron file exists,
 * drizzle/cron/README.md lists the job with its cadence, and every piece of
 * evidence a reader checks says the feature runs. Round 144 found the first
 * (scheduled reports, dead since the day it shipped) by reading the reports
 * dispatcher; running the same question over the whole directory found NINE
 * more, which is why this is a guard rather than a fix.
 *
 * The properties asserted here, and why each one:
 *
 *  - RUNNABLE IS NOT RUN (CR-023). A guard in package.json and in no workflow
 *    catches nothing, and `audit:sqli` sat exactly that way. Both wirings are
 *    checked.
 *  - The analysis is exercised against FIXTURES with an accept case AND a
 *    reject case (round 89): a source check cannot tell a working rule from a
 *    disabled one, because the constant is still in the file either way.
 *  - Every baselined entry carries a verdict and a reason, so a flat list of
 *    nine dead schedules cannot read the same whether somebody examined them
 *    or nobody did (the docs/edge-rbac-triage.json treatment).
 *  - The floor is EXPORTED and asserted where a test can see it. Round 120 and
 *    round 121 each lost the same mutant to a floor that lived inside main().
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  MIN_JOBS,
  analyze,
  cronTargets,
  stripComments,
} from '../../../scripts/check-cron-endpoints.mjs';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

const VERDICTS = new Set(['unbuilt', 'wrong-path']);

describe('the guard is wired, not merely runnable', () => {
  it('package.json declares check:cron-endpoints', () => {
    expect(read('package.json')).toContain('"check:cron-endpoints"');
  });

  it('CI runs it - a guard in no workflow catches nothing (CR-023)', () => {
    expect(read('.github/workflows/ci.yml')).toContain('npm run check:cron-endpoints');
  });
});

describe('the walk is not vacuous', () => {
  it('MIN_JOBS is a meaningful floor, not a disabled one', () => {
    // Exported so this is a claim about the VALUE. A source assertion that
    // `process.exit(2)` appears in the file passes whether the floor is 10 or
    // 0, which is the mutant rounds 120 and 121 both lost.
    expect(MIN_JOBS).toBeGreaterThanOrEqual(10);
  });

  it('the real directory is above the floor', () => {
    expect(cronTargets().length).toBeGreaterThan(MIN_JOBS);
  });

  it('every target names a function directory and at least one sub-segment', () => {
    for (const t of cronTargets()) {
      expect(t.fn).toMatch(/^[a-z0-9-]+$/);
      expect(t.subs.length).toBeGreaterThan(0);
    }
  });
});

describe('the routing rule fires, and only on a real gap', () => {
  const fixture = () => {
    const dir = mkdtempSync(join(tmpdir(), 'cron-endpoints-'));
    mkdirSync(join(dir, 'cron'), { recursive: true });
    mkdirSync(join(dir, 'fn/widgets'), { recursive: true });
    return dir;
  };

  const sql = (path: string) =>
    `SELECT cron.schedule('j','0 1 * * *',$$ SELECT net.http_post(\n` +
    `  url := 'https://functions.printyx.net/${path}'\n);$$);\n`;

  it('REJECT: a segment nothing compares against is reported', () => {
    const dir = fixture();
    try {
      writeFileSync(join(dir, 'cron/a.sql'), sql('widgets/sweep'));
      writeFileSync(join(dir, 'fn/widgets/index.ts'), `if (resource === 'list') {}\n`);
      const { findings } = analyze(join(dir, 'cron'), join(dir, 'fn'));
      expect(findings).toHaveLength(1);
      expect(findings[0].kind).toBe('unrouted-path');
      expect(findings[0].unrouted).toEqual(['sweep']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('ACCEPT: a segment the function routes is not reported', () => {
    // Without this the rule could report everything and the reject case above
    // would still pass.
    const dir = fixture();
    try {
      writeFileSync(join(dir, 'cron/a.sql'), sql('widgets/sweep'));
      writeFileSync(join(dir, 'fn/widgets/index.ts'), `if (resource === 'sweep') {}\n`);
      expect(analyze(join(dir, 'cron'), join(dir, 'fn')).findings).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a missing function DIRECTORY is its own finding', () => {
    const dir = fixture();
    try {
      writeFileSync(join(dir, 'cron/a.sql'), sql('gadgets/sweep'));
      const { findings } = analyze(join(dir, 'cron'), join(dir, 'fn'));
      expect(findings).toHaveLength(1);
      expect(findings[0].kind).toBe('missing-function');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a routing comparison inside a COMMENT does not clear a segment', () => {
    // The comment trap, which this repo has now recorded thirteen times: a
    // header explaining that `sweep` is NOT served would otherwise satisfy the
    // rule that looks for `'sweep'`.
    const dir = fixture();
    try {
      writeFileSync(join(dir, 'cron/a.sql'), sql('widgets/sweep'));
      writeFileSync(
        join(dir, 'fn/widgets/index.ts'),
        `// There is no branch for resource === 'sweep' yet.\nif (resource === 'list') {}\n`,
      );
      const { findings } = analyze(join(dir, 'cron'), join(dir, 'fn'));
      expect(findings.map((f: { unrouted: string[] }) => f.unrouted)).toEqual([['sweep']]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a cron URL cannot carry an id placeholder, so the rule needs no skip', () => {
    // cronTargets' pattern is [a-z0-9-/]+, so ':' or '$' ends the capture and
    // a placeholder can never reach the routing rule. Asserted rather than
    // guarded against: a branch that cannot fire reads as load-bearing.
    for (const t of cronTargets()) {
      for (const seg of t.subs) expect(seg).not.toMatch(/^[:$]/);
    }
  });
});

describe('stripComments keeps a URL intact', () => {
  it('does not eat the rest of a line at https://', () => {
    // check:seo-assets' own mutant: /\/\/.*$/ finds the // inside https:// and
    // blanks everything after it, so the walk reads healthy while matching
    // nothing.
    expect(stripComments(`const u = 'https://x/y';`)).toContain('https://x/y');
  });

  it('blanks a line comment', () => {
    expect(stripComments(`// resource === 'sweep'\nok`)).not.toContain('sweep');
  });
});

describe('the baseline is a worklist, not a tally', () => {
  const base = JSON.parse(read('docs/cron-endpoint-baseline.json'));
  const entries = Object.entries(base.entries) as [string, Record<string, string>][];

  it('has a hand-written note explaining the class', () => {
    expect(base.note.length).toBeGreaterThan(200);
  });

  it('the writer preserves that note across --update-baseline (round 82)', () => {
    expect(read('scripts/check-cron-endpoints.mjs')).toContain('function existingNote()');
  });

  it('every entry carries a verdict from the vocabulary', () => {
    expect(entries.length).toBeGreaterThan(0);
    for (const [path, v] of entries) {
      expect(VERDICTS.has(v.verdict), `${path}: ${v.verdict}`).toBe(true);
    }
  });

  it('every entry says WHY, at length - a one-line reason is the flat list again', () => {
    for (const [path, v] of entries) {
      expect(v.why.length, `${path}`).toBeGreaterThanOrEqual(120);
    }
  });

  it('each baselined path is still a real finding, so none is pre-forgiveness', () => {
    // A stale entry claims credit for debt that was fixed, and a path returning
    // under that name arrives already forgiven - the defect check:error-shape's
    // baseline had when four of its files no longer existed.
    const found = new Set(analyze().findings.map((f: { path: string }) => f.path));
    for (const [path] of entries) expect(found.has(path), path).toBe(true);
  });

  it('a wrong-path entry names the endpoint that DOES serve it', () => {
    // The difference between the two verdicts is whether there is somewhere to
    // repoint the schedule, so a wrong-path verdict with no destination is an
    // unbuilt one wearing a cheaper label.
    for (const [path, v] of entries) {
      if (v.verdict !== 'wrong-path') continue;
      expect(v.why, path).toMatch(/\/[a-z-]+\/[a-z-]+/);
    }
  });
});

describe('the mileage job posts where field-service routes (round 145)', () => {
  const sql = read('drizzle/cron/mileage.sql');
  const fn = stripComments(read('supabase/functions/field-service/index.ts'));

  it('no longer posts to the /mileage/ prefix', () => {
    // The dispatcher switches on SEGMENT 0, where the cases are records,
    // summary, reports, rates, irs-log, vehicles and auto-generate - so
    // `mileage` fell to `default: null` and every nightly tick was a 404.
    const url = /functions\.printyx\.net\/([a-z0-9\-/]+)/.exec(stripComments(sql))?.[1];
    expect(url).toBe('field-service/auto-generate');
  });

  it('and field-service really routes that segment', () => {
    expect(fn).toContain("case 'auto-generate':");
  });

  it('the README row matches the URL the job posts to', () => {
    // The README is what a reader consults to find out what runs; a row that
    // names the old path outlives the fix (the stale-comment shape).
    const row = read('drizzle/cron/README.md')
      .split('\n')
      .find((l) => l.includes('mileage-auto-generate-nightly'));
    expect(row).toBeDefined();
    expect(row).toContain('/field-service/auto-generate');
    expect(row).not.toContain('/field-service/mileage/');
  });

  it('the handler behind it is still a stub, and the cron file says so', () => {
    // This fixed the ROUTING, not the feature. If somebody builds the
    // aggregation the comment stops being true, and they should find out here
    // rather than leaving a note that now misdescribes the code.
    expect(read('supabase/functions/field-service/handlers/mileage.ts')).toContain('stub: true');
    expect(sql).toMatch(/stub/i);
  });
});

describe('invoice generation reads every pending reading', () => {
  const src = read('supabase/functions/billing/handlers/generate-invoices.ts');

  it('pages the pending-readings query instead of taking one PostgREST page', () => {
    // A truncated COUNT is worse than a truncated list: "Generated N invoices"
    // is read as "this month is billed". Bound to the ASSIGNMENT rather than to
    // the file, because round 144 lost a mutant to a `toMatch(/fetchAllRows/)`
    // that was satisfied by the import line.
    const at = src.indexOf('pendingReadings = await');
    expect(at).toBeGreaterThan(-1);
    expect(src.slice(at, at + 200)).toMatch(/await fetchAllRows<[^>]*>\(\s*\(\)\s*=>/);
  });

  it('and still scopes that read to the tenant', () => {
    const at = src.indexOf('pendingReadings = await');
    expect(src.slice(at, at + 300)).toContain(".eq('tenant_id', tenantId)");
  });

  it('a failed read throws rather than being read as an empty month', () => {
    const at = src.indexOf('pendingReadings = await');
    expect(src.slice(at, at + 500)).toMatch(/catch[\s\S]{0,120}throw new Error/);
  });
});
