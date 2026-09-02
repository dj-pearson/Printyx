#!/usr/bin/env -S npx tsx
/**
 * A column that exists in the database must exist in the schema.
 *
 * The inverse of check:phantom-cols. That one finds code naming a column the
 * table does not have; this one finds a column the table HAS that the Drizzle
 * declaration does not mention.
 *
 * WHY IT MATTERS, and it is not what you would guess. There is no DROP risk: a
 * column that was never in the declaration was never in drizzle-kit's snapshot
 * either, so db:generate does not know to remove it. The cost is BLINDNESS.
 * Every tool here reads the declaration - the snapshot, check:phantom-cols, tsc
 * - so an undeclared column is invisible to all of them, and code that reads it
 * correctly gets reported as a defect. AUDIT-037 spent a pass proving that eight
 * "phantom" references on `proposals` were nothing of the kind: the columns had
 * been added by four hand-written migrations (0000, 0042, 0045, 0047) and none
 * of them came back to shared/schema.ts.
 *
 * HOW IT READS THE DATABASE: by replaying the journal, not by connecting. That
 * keeps it runnable in CI with no credentials, and it is the same technique
 * check:tenant-id-types and check:fk-id-types use. CREATE TABLE establishes the
 * column set, ADD COLUMN extends it, DROP COLUMN reduces it.
 *
 * WHAT IT CANNOT SEE: an unjournaled .sql (drizzle/migrations/_*.sql), which is
 * never applied by the migrator anyway and is check:migrations' story; and a
 * table in no Drizzle schema at all, which is check:phantom-cols'.
 *
 *   npx tsx scripts/check-declared-columns.mts
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { is } from 'drizzle-orm';
import { PgTable, getTableConfig } from 'drizzle-orm/pg-core';

const repo = join(import.meta.dirname, '..');

const mod = (await import('../shared/drizzle-schema.ts')) as Record<string, unknown>;
const declared = new Map<string, Set<string>>();
for (const value of Object.values(mod)) {
  if (!is(value as any, PgTable)) continue;
  const cfg = getTableConfig(value as any);
  declared.set(cfg.name, new Set(cfg.columns.map((c) => c.name)));
}

const migrations = join(repo, 'drizzle/migrations');
const journal = JSON.parse(readFileSync(join(migrations, 'meta/_journal.json'), 'utf8'));
const stripSql = (s: string) => s.replace(/^\s*--.*$/gm, '');

const physical = new Map<string, Set<string>>();
for (const entry of [...journal.entries].sort((a: any, b: any) => a.idx - b.idx)) {
  const file = join(migrations, `${entry.tag}.sql`);
  if (!existsSync(file)) continue;
  const sql = stripSql(readFileSync(file, 'utf8'));

  for (const create of sql.matchAll(
    /CREATE TABLE (?:IF NOT EXISTS )?"([a-z0-9_]+)" \(([\s\S]*?)\n\);/g,
  )) {
    const set = physical.get(create[1]) ?? new Set<string>();
    for (const col of create[2].matchAll(/^\s*"([a-z0-9_]+)"\s+/gm)) set.add(col[1]);
    physical.set(create[1], set);
  }
  for (const alter of sql.matchAll(/ALTER TABLE "([a-z0-9_]+)"([\s\S]*?);/g)) {
    const set = physical.get(alter[1]) ?? new Set<string>();
    for (const col of alter[2].matchAll(/ADD COLUMN (?:IF NOT EXISTS )?"([a-z0-9_]+)"/g)) {
      set.add(col[1]);
    }
    for (const col of alter[2].matchAll(/DROP COLUMN (?:IF EXISTS )?"([a-z0-9_]+)"/g)) {
      set.delete(col[1]);
    }
    physical.set(alter[1], set);
  }
  for (const drop of sql.matchAll(/DROP TABLE (?:IF EXISTS )?"([a-z0-9_]+)"/g)) {
    physical.delete(drop[1]);
  }
}

const findings: string[] = [];
for (const [table, columns] of [...physical].sort()) {
  const decl = declared.get(table);
  if (!decl) continue; // no Drizzle declaration at all - a different story
  for (const column of [...columns].sort()) {
    if (!decl.has(column)) findings.push(`${table}.${column}`);
  }
}

if (findings.length > 0) {
  console.error(`✗ ${findings.length} column(s) the database has and the schema does not:\n`);
  for (const f of findings) console.error(`    ${f}`);
  console.error(
    '\nEvery tool here reads the declaration, so an undeclared column is invisible to all of\n' +
      'them - and code that reads it correctly gets reported as a phantom. Add it to the\n' +
      'pgTable in shared/, matching the type the migration created.',
  );
  process.exit(1);
}

console.log(
  `✓ Every column the migrations create is declared (${physical.size} table(s) replayed).`,
);
