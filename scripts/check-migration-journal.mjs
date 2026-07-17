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
//   (d) journal `idx` values are not a contiguous 0..N-1 sequence.
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

  console.log(
    `Checked ${files.length} migration file(s) against ${entries.length} journal entry(ies).`,
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

console.log('✓ Migration-journal guard passed: every migration file is journaled, prefixes unique, idx contiguous.');
