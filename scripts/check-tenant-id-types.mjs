#!/usr/bin/env node
/**
 * tenant_id must be able to hold a tenant id.
 *
 * `tenants.id` is `varchar PRIMARY KEY DEFAULT gen_random_uuid()`. Twenty-one
 * tables across four schema files declared `tenant_id integer NOT NULL` anyway,
 * and an integer column cannot hold a uuid, so neither half of multi-tenancy
 * worked on any of them (AUDIT-032). Reproduced against Postgres 16:
 *
 *   SELECT ... WHERE tenant_id = '<uuid>'
 *     -> 22P02 invalid input syntax for type integer
 *   INSERT ... (tenant_id) VALUES ('<uuid>')
 *     -> 42804 column is of type integer but expression is of type varchar
 *
 * WHY NOTHING CAUGHT IT. tsc cannot: the Drizzle column type and the tenantId
 * variable are both consistent within a file, so `eq(t.tenantId, tenantId)`
 * typechecks whenever the caller's tenantId is typed `any`, which it is
 * throughout the Express layer. check:phantom-cols reads edge functions and
 * checks column NAMES, not types. And PostgREST leaves `.data` null on error
 * while this codebase writes `?? []` around it - so the symptom was an empty
 * dashboard, indistinguishable from a table nobody has filled in yet. Several
 * of these tables sat in the unwritten-tables baseline for exactly that reason.
 *
 * TWO SIDES ARE CHECKED, because either alone can be wrong:
 *
 *   The Drizzle schemas, which are what db:generate diffs. A declaration is
 *   flagged unless its column helper is a text type.
 *
 *   The migrations, replayed in journal order - CREATE TABLE establishes the
 *   type and a later `ALTER COLUMN "tenant_id" SET DATA TYPE` changes it. This
 *   is the half that catches a hand-written .sql, which the schema scan cannot
 *   see. Replay order matters: 0000 creates these columns as integer and 0062
 *   converts them, so reading either file alone gives the wrong answer.
 *
 * WHAT IT CANNOT SEE: a table in no Drizzle schema and no migration (the drift
 * tables), and a column named something other than tenant_id.
 *
 * Comments are stripped from both sides. The migration this guard was written
 * for spells out `tenant_id integer` in its own header, and a check that reads
 * its own explanation reports the fix as the defect.
 *
 *   node scripts/check-tenant-id-types.mjs
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SHARED = join(ROOT, 'shared');
const MIGRATIONS = join(ROOT, 'drizzle', 'migrations');

/** Column helpers that can hold a uuid string. */
const TEXTUAL_HELPERS = new Set(['varchar', 'text', 'uuid', 'char']);
const TEXTUAL_SQL = /^(varchar|text|uuid|char|character varying|character)\b/i;

const stripTs = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const stripSql = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*--.*$/gm, '');

const failures = [];

// ─── Drizzle schemas ────────────────────────────────────────────────────────
for (const entry of readdirSync(SHARED)) {
  if (!entry.endsWith('.ts')) continue;
  const source = stripTs(readFileSync(join(SHARED, entry), 'utf8'));
  for (const m of source.matchAll(/tenantId:\s*([a-zA-Z]+)\(\s*'tenant_id'/g)) {
    if (!TEXTUAL_HELPERS.has(m[1])) {
      const line = source.slice(0, m.index).split('\n').length;
      failures.push(`shared/${entry}:${line}  tenantId: ${m[1]}('tenant_id')`);
    }
  }
}

// ─── Migrations, replayed in journal order ──────────────────────────────────
const journalPath = join(MIGRATIONS, 'meta', '_journal.json');
if (existsSync(journalPath)) {
  const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
  const types = new Map(); // table -> tenant_id sql type

  for (const entry of [...journal.entries].sort((a, b) => a.idx - b.idx)) {
    const file = join(MIGRATIONS, `${entry.tag}.sql`);
    if (!existsSync(file)) continue;
    const sql = stripSql(readFileSync(file, 'utf8'));

    for (const create of sql.matchAll(
      /CREATE TABLE (?:IF NOT EXISTS )?"([a-z0-9_]+)" \(([\s\S]*?)\n\);/g,
    )) {
      const column = create[2].match(
        /"tenant_id"\s+([a-z0-9_ ()]+?)(?:\s+DEFAULT|\s+NOT NULL|,|$)/i,
      );
      if (column) types.set(create[1], column[1].trim());
    }
    for (const alter of sql.matchAll(
      /ALTER TABLE "([a-z0-9_]+)" ALTER COLUMN "tenant_id" SET DATA TYPE ([a-z0-9_ ()]+?)(?:\s+USING|;)/gi,
    )) {
      types.set(alter[1], alter[2].trim());
    }
    for (const drop of sql.matchAll(/DROP TABLE (?:IF EXISTS )?"([a-z0-9_]+)"/g)) {
      types.delete(drop[1]);
    }
  }

  for (const [table, type] of [...types].sort()) {
    if (!TEXTUAL_SQL.test(type)) {
      failures.push(`drizzle/migrations (replayed)  ${table}.tenant_id is ${type}`);
    }
  }
}

if (failures.length > 0) {
  console.error(`✗ ${failures.length} tenant_id column(s) that cannot hold a tenant id:\n`);
  for (const failure of failures) console.error(`    ${failure}`);
  console.error(
    '\ntenants.id is a varchar uuid. An integer tenant_id makes every read a 22P02 and\n' +
      'every write a 42804 - and under PostgREST the read failure reads as an empty table.\n' +
      'Declare it varchar and generate a migration: npm run db:generate',
  );
  process.exit(1);
}

console.log('✓ Every declared tenant_id column can hold a tenant id.');
