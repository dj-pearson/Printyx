#!/usr/bin/env node
/**
 * A table name inside a raw SQL string is invisible to every other guard.
 *
 * CR-017 removed 28 handlers across routes-operations-extended.ts and
 * routes-workflow-mobile.ts that queried seventeen tables existing in no Drizzle
 * schema and no migration - commission_payments, sales_representatives,
 * iot_devices, field_technicians, mobile_work_orders and the rest. Every one was
 * a permanent 500. Nothing reported them:
 *
 *   tsc cannot see into a template literal.
 *   check:phantom-cols reads supabase/functions only, and checks column names.
 *   check:phantom-tables watches for a swallowed 42P01, which raw pg does not
 *     produce the same way.
 *   A scan for `.from(<drizzle identifier>)` returned ZERO for a file with nine
 *     of them, because the file has no Drizzle calls at all.
 *
 * WHAT COUNTS AS DECLARED: a pgTable in shared/, or a CREATE TABLE / CREATE VIEW
 * in any migration. Both, because the migration chain holds ~107 tables no
 * schema file declares, and dropping either side produces noise rather than
 * findings.
 *
 * FALSE POSITIVES HANDLED BY RULE, not by baseline - a baseline full of known
 * non-defects is where a real one hides:
 *   - CTEs. `WITH ranked AS (...) SELECT ... FROM ranked` is not a table. Names
 *     bound by WITH ... AS are collected per file and excluded.
 *   - Subqueries and set-returning functions: FROM ( and FROM generate_series(.
 *   - System catalogs: information_schema.*, pg_catalog, pg_class, pg_tables,
 *     pg_stat_*.
 *   - SQL keywords that follow FROM in an expression - EXTRACT(EPOCH FROM x),
 *     EXTRACT(MONTH FROM x) - and single-letter aliases.
 *
 * WHAT IT STILL CANNOT SEE: a table name built by interpolation
 * (`FROM ${table}`), a name in a string this regex does not recognise as SQL,
 * and anything outside server/. Those are why this is a ratchet and not proof.
 *
 * The baseline is a TODO list. Its bulk is database-updater/seeders/, which
 * STORE SQL for report definitions to run later rather than executing it - that
 * SQL naming a table the platform does not have is its own finding, just not
 * one that 500s today.
 *
 *   node scripts/check-sql-string-tables.mjs
 *   node scripts/check-sql-string-tables.mjs --update-baseline
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const BASELINE = join(ROOT, 'docs', 'sql-string-tables-baseline.json');
const UPDATE = process.argv.includes('--update-baseline');

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Every table or view the database is known to have. */
function knownRelations() {
  const known = new Set();
  const shared = join(ROOT, 'shared');
  for (const entry of readdirSync(shared)) {
    if (!entry.endsWith('.ts')) continue;
    const source = readFileSync(join(shared, entry), 'utf8');
    for (const m of source.matchAll(/pgTable\(\s*\n?\s*'([a-z0-9_]+)'/g)) known.add(m[1]);
    for (const m of source.matchAll(/pgView\(\s*\n?\s*'([a-z0-9_]+)'/g)) known.add(m[1]);
  }
  const migrations = join(ROOT, 'drizzle', 'migrations');
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) continue;
      if (!entry.endsWith('.sql')) continue;
      const sql = readFileSync(full, 'utf8');
      for (const m of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?"?([a-z0-9_]+)"?/gi)) {
        known.add(m[1].toLowerCase());
      }
      for (const m of sql.matchAll(
        /CREATE (?:OR REPLACE )?(?:MATERIALIZED )?VIEW (?:IF NOT EXISTS )?"?([a-z0-9_]+)"?/gi,
      )) {
        known.add(m[1].toLowerCase());
      }
    }
  };
  walk(migrations);
  const rls = join(ROOT, 'drizzle', 'rls');
  if (existsSync(rls)) walk(rls);
  return known;
}

/** Words that can follow FROM without naming a relation. */
const NOT_A_RELATION = new Set([
  // SUBSTRING(x FROM y), TRIM(BOTH x FROM y)
  'both',
  'leading',
  'trailing',
  'only',
  'lateral',
]);

/**
 * The FROM inside EXTRACT is not a table reference, and the trap is which side
 * the name is on: EXTRACT(MONTH FROM payment_date) puts the COLUMN after FROM,
 * not the field. Listing date-part words as non-relations reads it backwards and
 * reports payment_date as a missing table. These spans are cut out instead.
 */
function withoutExtract(text) {
  return text.replace(/\bEXTRACT\s*\([^()]*\)/gi, ' ');
}

const CATALOG = /^(pg_|information_schema)/;

/**
 * Names bound inside the statement itself: WITH ... AS (...) common table
 * expressions, and the aliases a FROM/JOIN introduces. `WITH ranked AS (...)
 * SELECT * FROM ranked` names no table, and neither does `FROM deals d JOIN d`.
 */
function localNames(text) {
  const names = new Set();
  for (const m of text.matchAll(/\b([a-z_][a-z0-9_]*)\s+AS\s*\(/gi)) names.add(m[1].toLowerCase());
  for (const m of text.matchAll(
    /\b(?:FROM|JOIN)\s+[a-z_][a-z0-9_]*\s+(?:AS\s+)?([a-z_][a-z0-9_]*)/gi,
  )) {
    const alias = m[1].toLowerCase();
    if (
      ![
        'on',
        'where',
        'group',
        'order',
        'left',
        'right',
        'inner',
        'outer',
        'join',
        'limit',
        'having',
        'union',
        'using',
        'set',
        'and',
        'or',
      ].includes(alias)
    ) {
      names.add(alias);
    }
  }
  return names;
}

const known = knownRelations();
const findings = [];

/**
 * The string literals in a source file: template literals and quoted strings.
 *
 * Extracting strings first is what keeps this from reading English. A first cut
 * matched FROM/UPDATE anywhere in the file and reported 515 references, nearly
 * all of them prose - "update the baseline", "read from the schema" - across
 * test descriptions and comments. Only a string that parses as a SQL statement
 * is considered.
 */
function stringLiterals(source) {
  const out = [];
  for (const m of source.matchAll(/`(?:\\.|[^`\\])*`/g)) out.push(m[0].slice(1, -1));
  for (const m of source.matchAll(/'(?:\\.|[^'\\\n])*'/g)) out.push(m[0].slice(1, -1));
  for (const m of source.matchAll(/"(?:\\.|[^"\\\n])*"/g)) out.push(m[0].slice(1, -1));
  return out;
}

/** Does this string actually contain a SQL statement? */
function isSql(text) {
  return (
    /\bSELECT\b[\s\S]*\bFROM\b/.test(text) ||
    /\bINSERT\s+INTO\b/.test(text) ||
    /\bUPDATE\b[\s\S]*\bSET\b/.test(text) ||
    /\bDELETE\s+FROM\b/.test(text)
  );
}

const walkSource = (dir) => {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkSource(full);
      continue;
    }
    if (!entry.endsWith('.ts')) continue;
    const source = stripComments(readFileSync(full, 'utf8'));
    const rel = relative(ROOT, full).replace(/\\/g, '/');

    // CTE names are collected across the WHOLE FILE, not per string. These
    // queries interpolate - `WITH quota_data AS (...) ${filter} ... FROM
    // quota_data` is TWO template literals, so the definition and the use land
    // in different strings and a per-string scan reports the CTE as a missing
    // table. The cost is that a real table sharing a name with a CTE somewhere
    // in the same file goes unreported; that is the cheaper mistake.
    const fileLocals = localNames(source);

    for (const text of stringLiterals(source)) {
      if (!isSql(text)) continue;
      const statement = withoutExtract(text);
      const local = new Set([...fileLocals, ...localNames(statement)]);
      for (const m of statement.matchAll(
        /\b(?:FROM|JOIN|INSERT\s+INTO|UPDATE)\s+([a-z_][a-z0-9_]*)(\s*\()?/g,
      )) {
        const name = m[1].toLowerCase();
        if (m[2]) continue; // a set-returning function, e.g. generate_series(
        if (name.length <= 2) continue; // a table alias, not a table
        if (known.has(name) || local.has(name)) continue;
        if (NOT_A_RELATION.has(name) || CATALOG.test(name)) continue;
        findings.push(`${rel}  ${name}`);
      }
    }
  }
};
walkSource(join(ROOT, 'server'));

const unique = [...new Set(findings)].sort();

if (UPDATE) {
  writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        note:
          'Table names inside raw SQL strings in server/ that exist in no Drizzle schema and no ' +
          'migration. A query naming one is a permanent runtime error that tsc, check:phantom-cols ' +
          'and check:phantom-tables all miss. A TODO list, not settled debt - most of the bulk is ' +
          'database-updater/seeders/, which STORE SQL for report definitions rather than executing ' +
          'it. See scripts/check-sql-string-tables.mjs.',
        total: unique.length,
        references: unique,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`Baseline updated: ${unique.length} undeclared relation reference(s).`);
  process.exit(0);
}

const baseline = existsSync(BASELINE)
  ? new Set(JSON.parse(readFileSync(BASELINE, 'utf8')).references ?? [])
  : new Set();

const added = unique.filter((f) => !baseline.has(f));

if (added.length > 0) {
  console.error(`✗ ${added.length} NEW SQL string(s) naming a relation that does not exist:\n`);
  for (const finding of added) console.error(`    ${finding}`);
  console.error(
    '\nA query naming a table with no schema and no migration is a permanent runtime error,\n' +
      'and nothing else in this repo can see it. Point it at a real table, add the table with\n' +
      'npm run db:generate, or remove the handler.',
  );
  process.exit(1);
}

const fixed = [...baseline].filter((f) => !unique.includes(f));
if (fixed.length > 0) {
  console.log(
    `✓ No new undeclared relations in SQL strings. ${fixed.length} baselined reference(s) resolved.\n` +
      '  Tighten with: node scripts/check-sql-string-tables.mjs --update-baseline',
  );
} else {
  console.log(`✓ No new undeclared relations in SQL strings (${unique.length} baselined).`);
}
