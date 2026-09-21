/**
 * Every scheduled HTTP job must post to a path something serves.
 *
 * WHY THIS EXISTS. `drizzle/cron/reports.sql` posted to
 * /reports/schedule/dispatch-due every fifteen minutes from the day it shipped;
 * the reports dispatcher routed /<reportId>/schedule and nothing named
 * dispatch-due, so every tick was a 404 and no scheduled report ever fired
 * (round 144). Nothing could see it: the function exists, the cron file exists,
 * `drizzle/cron/README.md` lists the job with its cadence, and pg_net discards
 * the response - so a reader checking whether scheduled reports run finds every
 * piece of evidence except the one that matters.
 *
 * Running this over the whole directory found TEN more, which is why it is a
 * guard rather than a fix. One was a plain URL error and is fixed in the same
 * commit (mileage.sql posted to /field-service/mileage/auto-generate, where
 * that dispatcher switches on segment 0 and the case is `auto-generate`). The
 * other nine are in docs/cron-endpoint-baseline.json with a verdict each:
 * monthly invoicing, daily meter aggregation, subscription trials,
 * subscription renewals, contract renewal notices, email campaign dispatch,
 * lease payment notices, health-score recalc and at-risk alerting all post to
 * segments that appear NOWHERE in their target function, and eight of the nine
 * describe work nothing anywhere performs - so the URL is the smaller half.
 *
 * THE RULE IS TWO QUESTIONS, and the second is the one round 144 needed:
 *   1. does the edge function DIRECTORY exist?
 *   2. is every sub-segment of the URL COMPARED AGAINST somewhere in it?
 *
 * Question 2 is deliberately lenient about HOW - an equality, a case label, a
 * negation or a ternary all count - because this tree spells routing several
 * ways and a false positive here de-gates a schedule that really is broken,
 * which is the worse trade (the same reasoning check:edge-path-coverage's
 * header records for its own generosity).
 *
 * Baselined entries carry a VERDICT and a REASON each, because a flat list of
 * nine dead schedules reads the same whether somebody examined them or nobody
 * did - the treatment docs/edge-rbac-triage.json established.
 */
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CRON_DIR = join(repo, 'drizzle/cron');
const FN_DIR = join(repo, 'supabase/functions');
const BASELINE = join(repo, 'docs/cron-endpoint-baseline.json');

/** Below this the walk has stopped matching and a clean run proves nothing. */
export const MIN_JOBS = 10;

export function stripComments(src) {
  return src
    .replace(/(?<![:/])\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length));
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e.startsWith('.')) continue;
    const f = join(dir, e);
    if (statSync(f).isDirectory()) walk(f, out);
    else out.push(f);
  }
  return out;
}

/** Every `functions.printyx.net/<path>` a cron file posts to. */
export function cronTargets(dir = CRON_DIR) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql'))) {
    const sql = readFileSync(join(dir, file), 'utf8');
    for (const m of sql.matchAll(/functions\.printyx\.net\/([a-z0-9\-/]+)/g)) {
      const segs = m[1].split('/').filter(Boolean);
      if (!segs.length) continue;
      out.push({ file, path: m[1], fn: segs[0], subs: segs.slice(1) });
    }
  }
  return out;
}

function functionSource(fn, fnDir = FN_DIR) {
  const dir = join(fnDir, fn);
  if (!existsSync(dir)) return null;
  let src = '';
  for (const f of walk(dir))
    if (f.endsWith('.ts')) src += stripComments(readFileSync(f, 'utf8')) + '\n';
  return src;
}

export function analyze(cronDir = CRON_DIR, fnDir = FN_DIR) {
  const findings = [];
  const targets = cronTargets(cronDir);
  for (const t of targets) {
    const src = functionSource(t.fn, fnDir);
    if (src === null) {
      findings.push({ ...t, kind: 'missing-function', unrouted: [] });
      continue;
    }
    const unrouted = t.subs.filter((seg) => {
      // No placeholder skip here, deliberately. An id placeholder would not be
      // a literal to route - but cronTargets' URL pattern is [a-z0-9-/]+, so a
      // ':' or '$' ends the capture and no segment reaching this point can be
      // one. A guard against it would be a branch that cannot fire, which reads
      // as load-bearing and is not.
      const cmp = new RegExp(
        `(===\\s*'${seg}'|!==\\s*'${seg}'|case\\s+'${seg}'|\\?\\s*'${seg}'|'${seg}'\\s*:|\\[\\s*'${seg}'\\s*\\])`,
      );
      return !cmp.test(src);
    });
    if (unrouted.length) findings.push({ ...t, kind: 'unrouted-path', unrouted });
  }
  return { targets, findings };
}

function loadBaseline() {
  if (!existsSync(BASELINE)) return { note: '', entries: {} };
  return JSON.parse(readFileSync(BASELINE, 'utf8'));
}

/** Preserve a hand-written note across --update-baseline (round 82). */
function existingNote() {
  return loadBaseline().note || '';
}

function main() {
  const update = process.argv.includes('--update-baseline');
  const { targets, findings } = analyze();

  if (targets.length < MIN_JOBS) {
    console.error(
      `check:cron-endpoints: only ${targets.length} scheduled HTTP job(s) found (floor ${MIN_JOBS}).\n` +
        'The walk has stopped matching; a clean run would prove nothing.',
    );
    process.exit(2);
  }

  if (update) {
    const base = loadBaseline();
    const entries = {};
    for (const f of findings) {
      const prev = base.entries?.[f.path];
      entries[f.path] = prev ?? {
        file: f.file,
        kind: f.kind,
        verdict: 'unexamined',
        why: '',
      };
      entries[f.path].file = f.file;
      entries[f.path].kind = f.kind;
    }
    writeFileSync(
      BASELINE,
      JSON.stringify(
        { note: existingNote(), generated: new Date().toISOString().slice(0, 10), entries },
        null,
        2,
      ) + '\n',
    );
    console.log(`Baseline updated: ${Object.keys(entries).length} dead cron endpoint(s).`);
    return;
  }

  const base = loadBaseline();
  const known = base.entries ?? {};
  const unknown = findings.filter((f) => !known[f.path]);
  // A baselined path that now resolves is a stale entry claiming credit.
  const stale = Object.keys(known).filter((p) => !findings.some((f) => f.path === p));
  // An entry with no reason is the flat list this file exists to replace.
  const unreasoned = Object.entries(known).filter(([, v]) => !v.why || v.why.length < 40);

  let bad = false;
  if (unknown.length) {
    bad = true;
    console.error('check:cron-endpoints: scheduled job(s) posting to a path nothing serves:\n');
    for (const f of unknown) {
      console.error(
        `  ${f.file}: /${f.path}  ${f.kind === 'missing-function' ? '(no such edge function)' : `(no routing comparison for: ${f.unrouted.join(', ')})`}`,
      );
    }
    console.error('\npg_net discards the response, so these fail in silence every tick.');
  }
  if (stale.length) {
    bad = true;
    console.error(
      `\ncheck:cron-endpoints: baselined path(s) that now resolve - tighten:\n  ${stale.join('\n  ')}`,
    );
  }
  if (unreasoned.length) {
    bad = true;
    console.error(
      `\ncheck:cron-endpoints: baselined path(s) with no reason:\n  ${unreasoned.map(([p]) => p).join('\n  ')}`,
    );
  }
  if (bad) process.exit(1);

  console.log(
    `✓ ${targets.length} scheduled HTTP job(s); every path resolves (${Object.keys(known).length} baselined, each with a verdict).`,
  );
}

const isEntryPoint =
  !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntryPoint) main();
