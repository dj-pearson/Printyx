#!/usr/bin/env node
// db-generate.mjs  (COP-M00)
//
// Wrapper around `drizzle-kit generate` that fixes the filename-numbering defect.
//
// drizzle-kit names a new migration from the JOURNAL LENGTH, while the files on
// disk are numbered independently. SUPA-002 renumbered 21 orphans up to 0056 so
// their `when` values sort after everything already applied, and that numbering
// is load-bearing (drizzle's migrator applies a migration only when
// lastDbMigration.created_at < migration.folderMillis). With 41 journal entries
// and files running to 0057, drizzle-kit picks 0041_* and collides with
// 0041_blog_revision_retention_days.sql, which fails `npm run check:migrations`.
//
// So: run drizzle-kit, then renumber whatever it just wrote to (highest prefix
// on disk + 1) and rewrite the journal tag to match. The migrator resolves files
// by `${entry.tag}.sql` and tracks applied state by sha256 of file CONTENT, so
// renaming before the migration is ever applied is safe. The SQL is untouched.

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, renameSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const migrationsDir = resolve(repoRoot, 'drizzle/migrations');
const journalPath = resolve(migrationsDir, 'meta/_journal.json');

const readJournal = () => JSON.parse(readFileSync(journalPath, 'utf8'));
const numberedFiles = () => readdirSync(migrationsDir).filter((f) => /^\d{4}_.*\.sql$/.test(f));

const before = readJournal().entries.length;

const run = spawnSync('npx', ['drizzle-kit', 'generate', ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: repoRoot,
});
if (run.status !== 0) process.exit(run.status ?? 1);

const journal = readJournal();
if (journal.entries.length === before) {
  // No schema changes, so drizzle-kit wrote nothing.
  process.exit(0);
}

const entry = journal.entries[journal.entries.length - 1];
const oldTag = entry.tag;
const oldPath = resolve(migrationsDir, `${oldTag}.sql`);
if (!existsSync(oldPath)) {
  console.error(`✗ Journal gained "${oldTag}" but ${oldTag}.sql is not on disk. Not renumbering.`);
  process.exit(1);
}

const highest = numberedFiles()
  .filter((f) => f !== `${oldTag}.sql`)
  .reduce((max, f) => Math.max(max, Number(f.slice(0, 4))), -1);

const nextPrefix = String(highest + 1).padStart(4, '0');
if (nextPrefix === oldTag.slice(0, 4)) {
  console.log(`✓ ${oldTag}.sql already carries the next free prefix.`);
  process.exit(0);
}

const newTag = `${nextPrefix}${oldTag.slice(4)}`;
renameSync(oldPath, resolve(migrationsDir, `${newTag}.sql`));
entry.tag = newTag;
writeFileSync(journalPath, JSON.stringify(journal, null, 2) + '\n');

console.log(`✓ Renumbered ${oldTag}.sql -> ${newTag}.sql (journal tag updated).`);
console.log(`  Review the SQL, then: npm run check:migrations && npm run db:migrate`);
