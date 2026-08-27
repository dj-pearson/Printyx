#!/usr/bin/env node
// check-migration-journal.mjs  (SUPA-005)
//
// CI guard against drizzle migration-journal drift — the root cause behind
// SUPA-002. `npm run db:migrate` uses drizzle's native migrator, which ONLY
// applies migrations listed in drizzle/migrations/meta/_journal.json. If a
// *.sql migration file exists on disk without a journal entry, it is silently
// NEVER applied → the live DB is missing schema.
//
// Fails (exit 1) when:
//   (a) a numbered migration *.sql file has no matching _journal.json entry,
//   (b) a _journal.json entry has no matching *.sql file,
//   (c) two migration files share the same 4-digit numeric prefix,
//   (d) journal `idx` values are not a contiguous 0..N-1 sequence,
//   (e) COP-M00: the LAST journal entry has no meta/NNNN_snapshot.json (hard),
//       or the mid-chain snapshot gap has widened past its baseline (ratchet).
//
// (e) is a DIFFERENT failure from (a)-(d) and the journal can be perfectly
// healthy while it holds. drizzle-kit diffs your schema against the snapshot of
// the LAST journal entry. When that snapshot is missing it silently falls back to
// the newest one it can find, so `db:generate` re-emits every change made since
// then — in this repo that produced a 2,281-line / 141-statement migration and a
// filename that collided with an existing file. The journal guard passed the
// whole time, which is exactly why this check had to be added.
//
// Only the LAST entry's snapshot drives `generate`, so that one is a hard gate.
// The 25 mid-chain gaps (idx 10-13, 19-39) affect nothing drizzle-kit does today
// and stay a ratchet.
//
// Usage: node scripts/check-migration-journal.mjs
// Wire:  package.json "audit:migrations": "node scripts/check-migration-journal.mjs"

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const migrationsDir = resolve(repoRoot, 'drizzle/migrations');
const journalPath = resolve(migrationsDir, 'meta/_journal.json');

const problems = [];

// --- gather numbered migration files (NNNN_name.sql) ------------------------
const files = readdirSync(migrationsDir)
  .filter((f) => /^\d{4}_.*\.sql$/.test(f))
  .sort();

const byPrefix = new Map();
for (const f of files) {
  const prefix = f.slice(0, 4);
  if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
  byPrefix.get(prefix).push(f);
}

// (c) duplicate prefixes
for (const [prefix, group] of byPrefix) {
  if (group.length > 1) {
    problems.push(
      `Duplicate migration prefix ${prefix}: ${group.join(', ')} — renumber so each 4-digit prefix is unique.`,
    );
  }
}

// --- read journal -----------------------------------------------------------
if (!existsSync(journalPath)) {
  problems.push(`Missing journal: ${journalPath}`);
} else {
  const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
  const entries = journal.entries ?? [];
  const journalTags = new Set(entries.map((e) => e.tag));
  const fileTags = new Set(files.map((f) => f.replace(/\.sql$/, '')));

  // (a) file with no journal entry -> will NEVER be applied
  for (const tag of fileTags) {
    if (!journalTags.has(tag)) {
      problems.push(
        `Migration file ${tag}.sql has NO journal entry → db:migrate will never apply it. Add it via db:generate or reconcile the journal (SUPA-002).`,
      );
    }
  }

  // (b) journal entry with no file
  for (const tag of journalTags) {
    if (!fileTags.has(tag)) {
      problems.push(`Journal entry "${tag}" has no matching ${tag}.sql file.`);
    }
  }

  // (d) contiguous idx
  const idxs = entries.map((e) => e.idx).sort((a, b) => a - b);
  for (let i = 0; i < idxs.length; i++) {
    if (idxs[i] !== i) {
      problems.push(
        `Journal idx sequence not contiguous: expected ${i}, found ${idxs[i]} (entries must be idx 0..N-1 in order).`,
      );
      break;
    }
  }

  // --- (e) COP-M00: every journal entry needs its snapshot ------------------
  const metaDir = resolve(migrationsDir, 'meta');
  const snapshots = new Set(
    readdirSync(metaDir)
      .filter((f) => /^\d{4}_snapshot\.json$/.test(f))
      .map((f) => Number(f.slice(0, 4))),
  );
  const missingSnapshots = entries.map((e) => e.idx).filter((idx) => !snapshots.has(idx));

  // The HARD gate: drizzle-kit diffs against the snapshot of the LAST journal
  // entry and nothing else. Lose that one and `db:generate` silently re-emits
  // every change made since whatever older snapshot it falls back to.
  const head = entries[entries.length - 1];
  if (head && !snapshots.has(head.idx)) {
    problems.push(
      `The last journal entry (idx ${head.idx}, "${head.tag}") has no ` +
        `meta/${String(head.idx).padStart(4, '0')}_snapshot.json. drizzle-kit will fall back to ` +
        `an older snapshot and re-emit every change made since it. Regenerate via ` +
        `npm run db:generate — never hand-write the snapshot. See COP-M00.`,
    );
  }

  // RATCHET, not a hard gate, for the MID-CHAIN gaps. 25 snapshots are missing
  // (idx 10-13 and 19-39) and restoring them would mean replaying history that
  // drizzle-kit cannot reconstruct from SQL. Nothing in the generate path reads
  // them, so failing outright would break CI on a pre-existing, inert condition.
  // Fail only when it gets WORSE — same shape as the typecheck and
  // route-ownership ratchets in this repo.
  const SNAPSHOT_GAP_BASELINE = 25;
  if (missingSnapshots.length > SNAPSHOT_GAP_BASELINE) {
    const shown = missingSnapshots.slice(0, 10).join(', ');
    const more = missingSnapshots.length > 10 ? `, +${missingSnapshots.length - 10} more` : '';
    problems.push(
      `Snapshot gap WIDENED: ${missingSnapshots.length} journal entr(ies) have no ` +
        `meta/NNNN_snapshot.json (baseline ${SNAPSHOT_GAP_BASELINE}): idx ${shown}${more}. ` +
        `Generate migrations with npm run db:generate so each one leaves its snapshot behind.`,
    );
  } else if (missingSnapshots.length > 0) {
    console.warn(
      `⚠ ${missingSnapshots.length} mid-chain journal entr(ies) have no snapshot (known, ` +
        `baseline ${SNAPSHOT_GAP_BASELINE}). Inert — only the LAST entry's snapshot drives ` +
        `db:generate, and that one is checked above. See docs/COP-M00-migration-tooling.md.`,
    );
  }

  console.log(
    `Checked ${files.length} migration file(s) against ${entries.length} journal entry(ies), ` +
      `and ${entries.length - missingSnapshots.length}/${entries.length} snapshot(s).`,
  );
}

if (problems.length) {
  console.error(`\n✗ Migration-journal guard FAILED (${problems.length} problem(s)):`);
  for (const p of problems) console.error(`    ${p}`);
  console.error(
    `\nFix: reconcile drizzle/migrations/meta/_journal.json with the files on disk (SUPA-002), then re-run.`,
  );
  process.exit(1);
}

console.log(
  '✓ Migration-journal guard passed: every migration file is journaled, prefixes unique, idx contiguous.',
);
