#!/usr/bin/env node
/**
 * Stale blocker gates in prd.json.
 *
 * WHAT IT IS FOR. Stories record what they are waiting on in prose:
 * "[GATED 2026-08-11: blocked on COP-M00]". Nothing ever revisits that line, so
 * when the blocker lands the gate stays, and the next person reads a story as
 * unstartable that has been startable for weeks.
 *
 * This has now bitten repeatedly. CLAUDE.md records it as a standing lesson -
 * "five COP stories carried [GATED: blocked on COP-M00] after COP-M00, M04 and
 * M07 had all passed" - and the same session found COP-B02 listing closed work
 * as open, COP-B10 citing a column on a different table, COP-M05 complete and
 * unmarked, CRM-008 marked passing with its main deliverable absent, COP-M01
 * describing LeadDetail as unwired when it was rewritten, and a CLAUDE.md note
 * warning that /api/record-layout-config 404s in production after it was given
 * an edge function and a proxy entry. Eight in one session, every one of them
 * cheap to check and expensive to believe.
 *
 * A gate naming a story that PASSES is the one form of staleness a script can
 * settle without judgement, so that is what this checks. It is a HARD GATE at
 * zero rather than a ratchet: unlike a phantom column, there is no version of
 * this that is correct.
 *
 * WHAT IT DOES NOT CLAIM. Clearing a gate does not make the story done, and a
 * story may be blocked on something else entirely - a deployed database, a
 * provider account, a human decision. Those blockers name no story id and this
 * says nothing about them. It reports one thing: this line points at a story
 * that has landed, so re-read it.
 *
 * SCOPE: OPEN stories only, and only gate VERBS.
 *
 * Both narrowings were forced by the first run, which reported 62 findings, and
 * getting them wrong in either direction makes the guard useless. A PASSING
 * story saying "depends on QUOTE-001" is recorded history and the dependency
 * was satisfied - reporting it buries the real findings, which is where a live
 * one hides. And "depends on" / "prerequisite:" describe an ordering, while
 * "blocked on" / "gated on" / "waiting on" describe a story that cannot be
 * started; only the second kind stops someone picking the work up.
 */
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Gate phrasings seen in this file. Deliberately narrow: it has to name a story
 * id as the thing being waited on, so "blocked on a telephony provider account"
 * and "needs the deployed database" are correctly ignored.
 */
const GATE = /(?:blocked on|gated on|waiting on)\s+([A-Z]{2,10}-[A-Z0-9-]+)/gi;

/** Exported so the behaviour can be tested on synthetic stories, not on prd.json. */
export function staleGates(stories) {
  const passing = new Map(stories.map((s) => [s.id, Boolean(s.passes)]));
  const findings = [];
  for (const story of stories) {
    if (story.passes) continue; // a satisfied dependency is history, not a gate
    const notes = typeof story.notes === 'string' ? story.notes : '';
    if (!notes) continue;
    for (const match of notes.matchAll(GATE)) {
      const blocker = match[1].toUpperCase().replace(/[.,;:]$/, '');
      if (!passing.has(blocker)) continue; // not a story id we know; say nothing
      if (!passing.get(blocker)) continue; // genuinely still blocked
      // No self-citation check: only OPEN stories reach this loop, so a story
      // naming itself fails the line above. Mutation testing showed the guard
      // that used to sit here could never fire, and redundant code that looks
      // load-bearing is worse than none.
      findings.push({ id: story.id, blocker, priority: story.priority });
    }
  }
  return findings;
}

// `import.meta.main` is a Deno API and is always undefined in Node (QUALITY-002),
// so the CLI body is guarded by comparing the entry path instead.
const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (!invokedDirectly) {
  // Imported for its predicate; nothing else runs.
} else {
  runCli();
}

function runCli() {
  const prd = JSON.parse(readFileSync(join(root, 'prd.json'), 'utf8'));
  const stories = prd.userStories ?? [];
  const findings = staleGates(stories);

  // A run that parses nothing must fail rather than pass in silence.
  if (stories.length < 100) {
    console.error(`check:stale-gates - only ${stories.length} stories parsed; refusing to pass.`);
    process.exit(1);
  }

  if (findings.length === 0) {
    console.log(
      `check:stale-gates - ${stories.length} stories, no gate names a blocker that has already landed.`,
    );
    process.exit(0);
  }

  console.error(`\n✗ ${findings.length} stale gate(s): the blocker named has already passed.\n`);
  const seen = new Set();
  for (const f of findings) {
    const key = `${f.id}::${f.blocker}`;
    if (seen.has(key)) continue;
    seen.add(key);
    console.error(
      `    ${f.id.padEnd(12)} (priority ${String(f.priority ?? '?').padEnd(3)}) says it is blocked on ${f.blocker}, which PASSES`,
    );
  }
  console.error(`
  Clearing a gate does not make the story done. Re-read it: the work may already
  be finished, the real blocker may be something else, or it may now be startable.
  Record whichever it is in the story's notes and remove the line.
`);
  process.exit(1);
}
