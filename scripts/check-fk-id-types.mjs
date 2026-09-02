#!/usr/bin/env node
/**
 * A foreign-key column must be able to hold the key it points at.
 *
 * The sibling of check:tenant-id-types, and the same defect one column family
 * over. AUDIT-032 found 21 tables declaring `tenant_id integer` against a
 * `tenants.id` that is a varchar uuid, converted them in migration 0062, and
 * stopped there. The FK columns on those same tables were left alone:
 * `contract_renewal_tracking.contract_id` is `integer NOT NULL` while
 * `contracts.id` is `varchar PRIMARY KEY DEFAULT gen_random_uuid()`.
 *
 * The failure is identical and was reproduced for tenant_id on Postgres 16:
 *
 *   SELECT ... WHERE contract_id = '<uuid>'
 *     -> 22P02 invalid input syntax for type integer
 *   INSERT ... (contract_id) VALUES ('<uuid>')
 *     -> 42804 column is of type integer but expression is of type varchar
 *
 * So a row referencing a real contract cannot be written, and the feature reads
 * as a table nobody has filled in - which is exactly where several of these
 * tables sit in docs/unwritten-tables-baseline.json. The routed
 * /contract-renewal-autopilot dashboard analyses contracts it structurally
 * cannot join to.
 *
 * WHY NOTHING CAUGHT IT is the AUDIT-032 answer verbatim: tsc sees a consistent
 * column type and an `any` id inside each file; check:phantom-cols reads
 * column NAMES in edge functions, not types; and PostgREST leaves `.data` null
 * on error next to a `?? []`, so the symptom is an empty screen.
 *
 * HOW A TARGET IS RESOLVED. By column name only - `contract_id` -> `contracts`,
 * with an explicit map for the irregular plurals. That is deliberately narrow:
 * a name-based rule reports nothing it cannot explain, where a looser one would
 * bury the real cases. It means a differently-named FK is invisible, which is
 * the same blind spot the tenant_id guard documents - `assigned_sales_rep_id`,
 * `sent_by_user_id`, `reviewed_by`, `uploaded_by` and `supplier_id` all point at
 * a uuid-keyed table and none of them is named for it. AUDIT-036 converted those
 * by reading the three schema files by hand; this guard would not have found
 * them.
 *
 * A POLYMORPHIC REFERENCE IS SKIPPED BY RULE, not baselined. When a table holds
 * `<x>_id` beside `<x>_type` the id names no single table, so the column name
 * cannot resolve a target and reporting one is a guess:
 * `document_notifications.document_id` is integer and correct, because its
 * `document_type` selects between two integer-keyed tables. A baseline holding a
 * known non-defect is where a real one hides.
 *
 * TWO SIDES, because either alone can be wrong: the Drizzle declarations, which
 * are what db:generate diffs, and the migration chain replayed in journal
 * order, which is the half that sees a hand-written .sql.
 *
 * Comments are stripped from both sides, and line comments first - a prose path
 * like `/api/*` otherwise opens a block comment that runs to the next `*&#47;`.
 * A guard that reads its own explanation reports the fix as the defect.
 *
 *   node scripts/check-fk-id-types.mjs [--update-baseline]
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SHARED = join(ROOT, 'shared');
const MIGRATIONS = join(ROOT, 'drizzle', 'migrations');
const BASELINE = join(ROOT, 'docs', 'fk-id-types-baseline.json');

const update = process.argv.includes('--update-baseline');

const TEXTUAL_HELPERS = new Set(['varchar', 'text', 'uuid', 'char']);
const TEXTUAL_SQL = /^(varchar|text|uuid|char|character varying|character)\b/i;

const stripTs = (s) => s.replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const stripSql = (s) => s.replace(/^\s*--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** Plurals the naive rule gets wrong. */
const SINGULAR = { companies: 'company', users: 'user', tenants: 'tenant' };
const columnNameFor = (table) =>
  `${SINGULAR[table] ?? table.replace(/ies$/, 'y').replace(/s$/, '')}_id`;

// ─── Pass 1: which tables have a textual primary key ────────────────────────
const segments = [];
for (const entry of readdirSync(SHARED)) {
  if (!entry.endsWith('.ts')) continue;
  const source = stripTs(readFileSync(join(SHARED, entry), 'utf8'));
  const starts = [...source.matchAll(/export const \w+ = pgTable\(\s*\n?\s*'([a-z_0-9]+)'/g)];
  starts.forEach((m, i) => {
    const to = i + 1 < starts.length ? starts[i + 1].index : source.length;
    segments.push({
      file: entry,
      table: m[1],
      body: source.slice(m.index, to),
      source,
      at: m.index,
    });
  });
}

const textualPk = new Set();
for (const seg of segments) {
  if (/\bid:\s*(varchar|uuid|text|char)\('id'\)/.test(seg.body)) textualPk.add(seg.table);
}

/** column name -> the textual-keyed table it names. */
const targetFor = new Map();
for (const table of textualPk) targetFor.set(columnNameFor(table), table);

// ─── Pass 2: integer FK declarations ────────────────────────────────────────
/** `<x>_id` beside `<x>_type` names no single table. */
const isPolymorphic = (body, column) =>
  new RegExp(`'${column.replace(/_id$/, '_type')}'`).test(body);

const failures = [];
for (const seg of segments) {
  for (const m of seg.body.matchAll(/(\w+):\s*([a-zA-Z]+)\(\s*'([a-z_0-9]+_id)'/g)) {
    const [, , helper, column] = m;
    const target = targetFor.get(column);
    if (!target || TEXTUAL_HELPERS.has(helper)) continue;
    if (isPolymorphic(seg.body, column)) continue;
    failures.push(
      `shared/${seg.file}  ${seg.table}.${column} is ${helper}, ${target}.id is textual`,
    );
  }
}

// ─── Pass 3: the migration chain, replayed in journal order ─────────────────
const journalPath = join(MIGRATIONS, 'meta', '_journal.json');
if (existsSync(journalPath)) {
  const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
  const columnTypes = new Map(); // `${table}.${column}` -> sql type
  const pkTypes = new Map(); // table -> sql type of its id column

  for (const entry of [...journal.entries].sort((a, b) => a.idx - b.idx)) {
    const file = join(MIGRATIONS, `${entry.tag}.sql`);
    if (!existsSync(file)) continue;
    const sql = stripSql(readFileSync(file, 'utf8'));

    for (const create of sql.matchAll(
      /CREATE TABLE (?:IF NOT EXISTS )?"([a-z0-9_]+)" \(([\s\S]*?)\n\);/g,
    )) {
      const [, table, body] = create;
      for (const col of body.matchAll(
        /"([a-z0-9_]+)"\s+([a-z0-9_ ()]+?)(?:\s+PRIMARY KEY|\s+GENERATED|\s+DEFAULT|\s+NOT NULL|,|$)/gi,
      )) {
        const [, name, type] = col;
        if (name === 'id') pkTypes.set(table, type.trim());
        else if (name.endsWith('_id')) columnTypes.set(`${table}.${name}`, type.trim());
      }
    }
    for (const alter of sql.matchAll(
      /ALTER TABLE "([a-z0-9_]+)" ALTER COLUMN "([a-z0-9_]+)" SET DATA TYPE ([a-z0-9_ ()]+?)(?:\s+USING|;)/gi,
    )) {
      const [, table, column, type] = alter;
      if (column === 'id') pkTypes.set(table, type.trim());
      else if (column.endsWith('_id')) columnTypes.set(`${table}.${column}`, type.trim());
    }
    for (const drop of sql.matchAll(/DROP TABLE (?:IF EXISTS )?"([a-z0-9_]+)"/g)) {
      pkTypes.delete(drop[1]);
      for (const key of [...columnTypes.keys()]) {
        if (key.startsWith(`${drop[1]}.`)) columnTypes.delete(key);
      }
    }
  }

  const sqlTargetFor = new Map();
  for (const [table, type] of pkTypes) {
    if (TEXTUAL_SQL.test(type)) sqlTargetFor.set(columnNameFor(table), table);
  }

  for (const [key, type] of [...columnTypes].sort()) {
    const column = key.slice(key.indexOf('.') + 1);
    const target = sqlTargetFor.get(column);
    if (!target || TEXTUAL_SQL.test(type)) continue;
    // Same polymorphic rule, read off the schema declaration for that table.
    const seg = segments.find((s) => s.table === key.slice(0, key.indexOf('.')));
    if (seg && isPolymorphic(seg.body, column)) continue;
    failures.push(`drizzle/migrations (replayed)  ${key} is ${type}, ${target}.id is textual`);
  }
}

failures.sort();

if (update) {
  writeFileSync(
    BASELINE,
    `${JSON.stringify(
      {
        note:
          'Foreign-key columns whose type cannot hold the key they name. See scripts/check-fk-id-types.mjs. ' +
          'Every entry is a feature that cannot store a row referencing a real record - the read is a 22P02, ' +
          'the write a 42804, and under PostgREST both read as an empty table. Shrink this list, never grow it: ' +
          'node scripts/check-fk-id-types.mjs --update-baseline',
        total: failures.length,
        offenders: failures,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`✓ Baseline updated: ${failures.length} mistyped foreign-key column(s) recorded.`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error(`✗ Missing baseline ${BASELINE}. Create it with --update-baseline.`);
  process.exit(1);
}

const allowed = new Set(JSON.parse(readFileSync(BASELINE, 'utf8')).offenders);
const added = failures.filter((f) => !allowed.has(f));
const resolved = [...allowed].filter((f) => !failures.includes(f));

if (added.length > 0) {
  console.error(
    `✗ ${added.length} NEW foreign-key column(s) that cannot hold the key they name:\n`,
  );
  for (const failure of added) console.error(`    ${failure}`);
  console.error(
    '\nAn integer column cannot hold a uuid. The read is a 22P02, the write a 42804,\n' +
      'and under PostgREST the failure reads as a table nobody has filled in.\n' +
      'Declare it varchar and generate a migration: npm run db:generate',
  );
  process.exit(1);
}

if (resolved.length > 0) {
  console.log(
    `✓ No new mistyped foreign keys. ${resolved.length} baselined entr(y/ies) now resolve:`,
  );
  for (const f of resolved) console.log(`    ${f}`);
  console.log('  Tighten with: node scripts/check-fk-id-types.mjs --update-baseline');
} else {
  console.log(`✓ No new mistyped foreign-key columns (${allowed.size} baselined).`);
}
