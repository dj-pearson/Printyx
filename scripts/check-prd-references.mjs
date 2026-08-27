#!/usr/bin/env node
/**
 * PRD file-reference ratchet.
 *
 * WHAT IT IS FOR. A story's acceptance criteria name the files to change. When
 * someone deletes or moves one of those files, nothing tells the story, and the
 * next person to pick it up works from a map of a place that no longer exists.
 * That happened three times in one session:
 *
 *   - AUDIT-016 deleted pages/CustomerPortal.tsx, which silently RESOLVED CR-015
 *     ("move the portal session token out of localStorage") — the token's only
 *     writer went with it. CR-015 sat open afterwards describing a file that was
 *     not there.
 *   - The same deletion voided AUDIT-014's second acceptance criterion, which
 *     that story had to discover and annotate by hand.
 *   - CR-034 spent three batches typing five role dashboards before anyone
 *     checked they were unrouted (that is check:orphans' story now).
 *
 * So this fails when a path named in an OPEN story stops resolving. It is not a
 * claim that the story is wrong — see the caveats — it is a prompt to re-read it.
 *
 * WHAT A FINDING DOES AND DOES NOT MEAN:
 *   - A NEW finding means a path that used to resolve no longer does. Someone
 *     deleted or moved it. Re-read the story: it may be resolved, void, or just
 *     need the path updated.
 *   - The BASELINE is not a defect list. 26 of the 53 entries recorded when this
 *     was written are AOS-* stories naming files they would CREATE, which is what
 *     a forward-looking story is supposed to do. Do not "fix" those.
 *
 * WHY IT DOES NOT TRY TO SAY WHICH: distinguishing "deleted" from "not built
 * yet" needs git history, and this repo is cloned SHALLOW in CI and in the
 * agent sandbox (448 commits at time of writing). A file removed before that
 * boundary is indistinguishable from one that never existed, and an early draft
 * of this script confidently mislabelled several stories on exactly that basis.
 * Reporting only what is checkable — does this path resolve right now — is the
 * honest scope.
 *
 * Paths are resolved CASE-INSENSITIVELY: AUDIT-014 names
 * client/src/pages/Contracts.tsx for a file called contracts.tsx, which is a
 * typo in the story, not a missing file.
 *
 *   node scripts/check-prd-references.mjs
 *   node scripts/check-prd-references.mjs --update-baseline
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const PRD = join(repoRoot, 'prd.json');
const BASELINE = join(repoRoot, 'docs', 'prd-references-baseline.json');
const UPDATE = process.argv.includes('--update-baseline');

const TOP_DIRS =
  '(?:client|server|shared|supabase|scripts|drizzle|tools|tests|k8s|docs|mobile|ios|documents)';
const PATH_RE = new RegExp(
  `\\b(${TOP_DIRS}/[A-Za-z0-9_\\-./]+\\.(?:tsx?|jsx?|mjs|cjs|sql|json|ya?ml|md|sh))\\b`,
  'g',
);

/** Resolve ignoring case, so a story's capitalisation typo is not reported. */
function resolves(relPath) {
  if (existsSync(join(repoRoot, relPath))) return true;
  const abs = join(repoRoot, relPath);
  const wanted = basename(abs).toLowerCase();
  try {
    return readdirSync(dirname(abs)).some((f) => f.toLowerCase() === wanted);
  } catch {
    return false;
  }
}

const prd = JSON.parse(readFileSync(PRD, 'utf8'));
const findings = [];
for (const story of prd.userStories ?? []) {
  if (story.passes) continue;
  const text = [story.title, story.description, ...(story.acceptanceCriteria ?? [])]
    .filter(Boolean)
    .join('\n');
  const seen = new Set();
  let m;
  PATH_RE.lastIndex = 0;
  while ((m = PATH_RE.exec(text)) !== null) seen.add(m[1]);
  for (const p of [...seen].sort()) {
    if (!resolves(p)) findings.push(`${story.id} ${p}`);
  }
}
findings.sort();

const baseline = existsSync(BASELINE)
  ? JSON.parse(readFileSync(BASELINE, 'utf8'))
  : { note: '', allowed: [] };
const allowed = new Set(baseline.allowed ?? []);
const added = findings.filter((f) => !allowed.has(f));
const present = new Set(findings);
const resolved = [...allowed].filter((f) => !present.has(f)).sort();

if (UPDATE) {
  writeFileSync(
    BASELINE,
    `${JSON.stringify(
      {
        note:
          'PRD file-reference ratchet. scripts/check-prd-references.mjs fails when a path named in ' +
          'an OPEN story stops resolving — usually because someone deleted or moved the file, which ' +
          'means that story now describes a place that does not exist and needs re-reading. THIS ' +
          'LIST IS NOT A DEFECT LIST: many entries are forward-looking stories naming files they ' +
          'would create (the AOS-* subsystem is entirely of this kind). Do not "fix" those. ' +
          'Entries leave the list when the path resolves again or the story closes: ' +
          'node scripts/check-prd-references.mjs --update-baseline.',
        count: findings.length,
        allowed: findings,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`✓ Baseline updated: ${findings.length} unresolved story references recorded.`);
  process.exit(0);
}

if (added.length > 0) {
  console.error(`✗ ${added.length} open story reference(s) no longer resolve:\n`);
  for (const f of added) {
    const [id, ...rest] = f.split(' ');
    console.error(`    ${id.padEnd(22)} ${rest.join(' ')}`);
  }
  console.error(
    '\n  A path these stories name is not there any more. Re-read each one: the work may\n' +
      '  already be done, the story may be void, or the path may just need updating —\n' +
      '  all three have happened. Then record the new state with:\n' +
      '      node scripts/check-prd-references.mjs --update-baseline\n',
  );
  process.exit(1);
}

console.log(`✓ No newly stale story references (${findings.length} known).`);
if (resolved.length > 0) {
  console.log(
    `\n  ${resolved.length} baseline entr${resolved.length === 1 ? 'y' : 'ies'} resolved or closed. Tighten:\n` +
      '      node scripts/check-prd-references.mjs --update-baseline\n',
  );
  for (const f of resolved.slice(0, 20)) console.log(`    ${f}`);
}
