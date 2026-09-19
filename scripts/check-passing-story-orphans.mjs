#!/usr/bin/env node
/**
 * A passing story may not name a deliverable that is an orphan file (WF-G-03).
 *
 * `passes: true` is the only record of what this project believes it has built,
 * and three separate guards already know which files nothing reaches:
 * docs/server-orphans-baseline.json (reachability walk from server/index.ts),
 * docs/orphan-files-baseline.json (import graph from App.tsx) and
 * docs/unreferenced-edge-fns-baseline.json (no client tree, alias, override or
 * pg_cron job names the function). Nothing cross-checked the two, so a story
 * could close on a file that exists, compiles, is tested, and is called by
 * nobody.
 *
 * AUDIT-025 is the case that proves the shape rather than a hypothetical: all 86
 * US-BLOG stories are marked passing, and 19 of the 37 blog edge functions they
 * shipped are reachable by nothing - no client tree, no alias, no cron, no
 * cross-function fetch. The closure criteria never included "something invokes
 * this".
 *
 * ── WHAT IS EXCLUDED, AND WHY IT IS BY RULE RATHER THAN BASELINE ────────────
 *
 * Two kinds of mention are not the defect, and both are recognised from the
 * SENTENCE the path sits in rather than from a list of story ids:
 *
 *   THE STORY DELETED IT. "server/routes-qbr.ts no longer exists", "both were
 *   deleted". A path named as retired is a record, not a claim.
 *
 *   THE STORY SAYS IT IS DEAD. "kept and baselined rather than deleted so the
 *   gap stays on the roadmap", "has no importer and sits in
 *   docs/server-orphans-baseline.json as (test-only)". A story that writes down
 *   the orphan is doing exactly what this guard exists to force; reporting it
 *   back would punish the honest case and teach people to stop writing it down.
 *
 * The defect is an UNACKNOWLEDGED orphan: a story that says "create X" or
 * "implemented in X" with nothing anywhere saying X is unreachable.
 *
 * ── WHY A REPORT WITH A SHRINK-ONLY BASELINE, NOT A GATE AT ZERO ────────────
 *
 * AC3 asks for a report first and a gate once the seed findings are resolved.
 * The seeds (RBAC-008, RBAC-009) are no longer passing, so they are no longer
 * findings - but the first run turned up far more than two, and a gate at zero
 * today would either fail every build or need 70-odd stories reopened in one
 * commit. So: shrink-only, keyed by story id + path, printed in full on every
 * run rather than hidden behind a count. Each entry is a QUESTION - who calls
 * this? - with the same four answers AUDIT-028 gives: a UI never built, an
 * importer never wired, an external caller that should be named in a comment,
 * or a deliverable that should be deleted and the story's criteria corrected.
 *
 * Usage:
 *   node scripts/check-passing-story-orphans.mjs
 *   node scripts/check-passing-story-orphans.mjs --list
 *   node scripts/check-passing-story-orphans.mjs --update-baseline
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(fileURLToPath(import.meta.url), '..', '..');
const read = (p) => JSON.parse(readFileSync(join(repo, p), 'utf8'));

const BASELINE = 'docs/passing-story-orphans-baseline.json';

const prd = read('prd.json');
const serverOrphans = new Set(read('docs/server-orphans-baseline.json').orphans);
const fileOrphans = new Set(read('docs/orphan-files-baseline.json').allowed);
const edgeOrphans = new Set(read('docs/unreferenced-edge-fns-baseline.json').unreferenced);

// A repo path, rooted at one of the directories this project actually has. An
// unrooted match ("index.ts", "the/thing") is noise in prose.
const PATH_RE =
  /(?:client|server|shared|scripts|supabase|drizzle|tools|tests|docs|k8s)\/[\w./@-]*\w/g;

/** Sentences that say the path is gone. */
const RETIRED_RE =
  /\b(?:delet|remov|retir|drop|supersed|replac|purg)\w*|\bno longer exists?\b|\bis gone\b|\bwent with it\b/i;

/** Sentences that say the path is unreachable, which is the honest case. */
const ACKNOWLEDGED_RE =
  /\borphan\w*|\bunreferenced\b|\bunreachable\b|\bbaselined?\b|\bdead code\b|\bno importers?\b|\bno (?:live )?callers?\b|\bnothing (?:calls|imports|reaches|references)\b|\bnever (?:wired|registered|mounted|called|used)\b|\bnot (?:registered|mounted|wired|reachable)\b|\bis(?:n't| not) used\b|\btest-only\b/i;

/**
 * A path cited as EVIDENCE is where a defect was found, not something the story
 * claims to have built. WF-R-03's "Evidence: supabase/functions/signup/index.ts:184-191"
 * names the file whose behaviour the story is about; reporting it as an
 * unreachable deliverable inverts what the sentence says.
 */
const CITATION_RE = /\bevidence\b|\bsource:|\bsee\b|\bcandidate\b|\bfound (?:in|at)\b/i;

/**
 * Edge functions that are reachable by design without a client caller, taken
 * from the note on docs/unreferenced-edge-fns-baseline.json itself: they are
 * invoked by a provider, a browser extension, or a probe rather than by a page.
 * That baseline is a TODO list and does not distinguish them structurally, so a
 * guard reading it inherits the imprecision unless it says so here.
 */
const HEADLESS_EDGE_FNS = new Set([
  'signup',
  'oauth-proxy',
  'chrome-extension',
  'csrf-token',
  'hello',
  'db-probe',
]);

/**
 * The text around each occurrence of `path`, as a window rather than as the
 * containing sentence.
 *
 * A window, because the acknowledgement is usually in the NEXT sentence:
 * "Create server/middleware/scope-middleware.ts. Nothing imports it yet." A
 * sentence-scoped check reports that as an unacknowledged orphan, which is the
 * one thing this guard must not do - it would punish the story that wrote the
 * problem down and teach people to stop. Found by mutation-testing the
 * exclusion, not by reading the code.
 *
 * 350 characters either side is about two sentences of this project's prose.
 * Too wide and an unrelated "deleted" three paragraphs away silences a real
 * finding; the reported context stays the containing sentence so a reviewer
 * sees what the guard matched on.
 */
const CONTEXT_CHARS = 350;

function windowsAround(text, path) {
  const out = [];
  let from = 0;
  for (;;) {
    const at = text.indexOf(path, from);
    if (at === -1) break;
    out.push(
      text
        .slice(Math.max(0, at - CONTEXT_CHARS), at + path.length + CONTEXT_CHARS)
        .replace(/\s+/g, ' '),
    );
    from = at + path.length;
  }
  return out;
}

function sentencesAround(text, path) {
  const out = [];
  let from = 0;
  for (;;) {
    const at = text.indexOf(path, from);
    if (at === -1) break;
    const start = Math.max(0, text.lastIndexOf('.', at - 1) + 1);
    let end = at + path.length;
    // Stop at the next sentence end that is not a file extension.
    for (;;) {
      const dot = text.indexOf('.', end);
      if (dot === -1) {
        end = text.length;
        break;
      }
      if (/[\s\n]/.test(text[dot + 1] ?? ' ')) {
        end = dot;
        break;
      }
      end = dot + 1;
    }
    out.push(text.slice(start, end).replace(/\s+/g, ' ').trim());
    from = at + path.length;
  }
  return out;
}

function classify(path) {
  if (serverOrphans.has(path)) return 'server-orphans';
  if (fileOrphans.has(path)) return 'orphan-files';
  const m = /^supabase\/functions\/([\w-]+)(?:\/|$)/.exec(path);
  if (m && edgeOrphans.has(m[1]) && !HEADLESS_EDGE_FNS.has(m[1])) return 'unreferenced-edge-fns';
  return null;
}

const findings = [];
for (const story of prd.userStories) {
  if (!story.passes) continue;
  const text = [
    story.description ?? '',
    ...(story.acceptanceCriteria ?? []),
    story.notes ?? '',
  ].join('\n');
  for (const raw of new Set(text.match(PATH_RE) ?? [])) {
    const path = raw.replace(/[.,;:)\]]+$/, '');
    const where = classify(path);
    if (!where) continue;

    const scope = windowsAround(text, path);
    if (scope.some((s) => RETIRED_RE.test(s) || ACKNOWLEDGED_RE.test(s) || CITATION_RE.test(s))) {
      continue;
    }
    const context = sentencesAround(text, path);

    findings.push({
      key: `${story.id}::${path}`,
      story: story.id,
      path,
      where,
      context: (context[0] ?? '').slice(0, 220),
    });
  }
}
findings.sort((a, b) => a.key.localeCompare(b.key));

const args = process.argv.slice(2);
let baseline = [];
try {
  baseline = read(BASELINE).entries ?? [];
} catch {
  baseline = [];
}

if (args.includes('--list')) {
  for (const f of findings) {
    console.log(`${f.story}  ${f.path}  [${f.where}]`);
    if (f.context) console.log(`    ${f.context}`);
  }
  console.log(
    `\n${findings.length} finding(s) across ${new Set(findings.map((f) => f.story)).size} passing stories.`,
  );
  process.exit(0);
}

if (args.includes('--update-baseline')) {
  writeFileSync(
    join(repo, BASELINE),
    JSON.stringify(
      {
        note:
          'WF-G-03. Each entry is a passing story naming a deliverable that one of the three orphan ' +
          'baselines says nothing reaches, without the story anywhere saying so. A QUESTION - who calls ' +
          'this? - with four answers: a UI never built, an importer never wired, an external caller that ' +
          'belongs in a comment, or a deliverable to delete with the story criteria corrected. Shrink-only, ' +
          'keyed by story id + path. A TODO list, not settled debt.',
        generatedBy: 'npm run check:story-orphans -- --update-baseline',
        count: findings.length,
        entries: findings.map((f) => f.key),
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`Baseline written: ${findings.length} entr(ies).`);
  process.exit(0);
}

const known = new Set(baseline);
const added = findings.filter((f) => !known.has(f.key));
const fixed = baseline.filter((k) => !findings.some((f) => f.key === k));

if (added.length) {
  console.error(`\n✗ ${added.length} passing story/stories name a deliverable nothing reaches:\n`);
  for (const f of added) {
    console.error(`  ${f.story}  ${f.path}  [${f.where}]`);
    if (f.context) console.error(`      ${f.context}`);
  }
  console.error(
    '\n  Either wire the deliverable up, delete it and correct the story, or say in the\n' +
      '  story that it is unreachable and why - the last one is excluded by rule, because a\n' +
      '  story that writes the orphan down is doing what this guard exists to force.\n',
  );
  process.exit(1);
}

// The whole list prints on every run. A count alone lets 70 open questions read
// as one green tick.
if (findings.length) {
  console.log(
    `check:story-orphans - ${findings.length} passing stories name an unreachable deliverable:\n`,
  );
  const byStory = new Map();
  for (const f of findings) {
    if (!byStory.has(f.story)) byStory.set(f.story, []);
    byStory.get(f.story).push(`${f.path} [${f.where}]`);
  }
  for (const [story, paths] of byStory) console.log(`  ${story}  ${paths.join(', ')}`);
  console.log('');
}
console.log(
  `check:story-orphans - ${findings.length} finding(s) across ${new Set(findings.map((f) => f.story)).size} ` +
    `passing stories (baseline ${baseline.length}` +
    `${fixed.length ? `, ${fixed.length} resolved - tighten with --update-baseline` : ''}).`,
);
