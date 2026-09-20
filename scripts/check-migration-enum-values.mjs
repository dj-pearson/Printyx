#!/usr/bin/env node
/**
 * Enum values a migration writes that the enum does not have (round 89).
 *
 * WHY THIS EXISTS. `0072_seed_role_catalogue.sql` inserted 45 roles, 21 of them
 * naming a `role_type` the enum has never had - 'platform_role',
 * 'company_role', 'regional_role', 'location_role', where `0000` declares
 * 'platform_admin', 'company_admin', 'regional_manager', 'location_manager',
 * 'department_role'. It was ONE statement, so all 45 rows failed on 22P02 and
 * not a single row was ever inserted on any database.
 *
 * DRIZZLE RUNS THE WHOLE CHAIN IN ONE TRANSACTION, so that did not fail one
 * migration: it made `npm run db:migrate` unable to create a database at all,
 * leaving zero tables behind. PA-032 ("make a fresh database provisionable from
 * versioned migrations alone") verified db:migrate green at 43 migrations; this
 * file is 72 of 80, so the guarantee had been gone for 29 migrations with
 * nothing checking. The casualty was the feature the migration exists for:
 * `signup` answers MISSING_ADMIN_ROLE when roles.code='COMPANY_ADMIN' is
 * absent, and tells the operator to "apply the migration chain and retry".
 *
 * WHAT IT CHECKS. It replays the chain in journal order, tracking every enum's
 * membership (`CREATE TYPE ... AS ENUM`, plus `ALTER TYPE ... ADD VALUE`) and
 * every column declared with an enum type, then checks each INSERT's VALUES
 * literals in the enum columns' positions. A value that is not a member at that
 * point in the chain is a guaranteed 22P02.
 *
 * WHAT IT DOES NOT CATCH, stated so a pass is not read as more than it is:
 * values built by expression or subquery rather than written as literals,
 * UPDATEs (only INSERT ... VALUES is parsed), and columns whose enum type is
 * introduced by a later ALTER TABLE. It is a targeted check for the shape that
 * cost a provisionable database, not a SQL type checker.
 *
 * Usage: node scripts/check-migration-enum-values.mjs [--list]
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(repo, 'drizzle', 'migrations');
const list = process.argv.includes('--list');

const CREATE_ENUM = /CREATE TYPE\s+(?:"public"\.)?"?([a-z_]+)"?\s+AS ENUM\s*\(([^)]*)\)/gi;
const ALTER_ENUM =
  /ALTER TYPE\s+(?:"public"\.)?"?([a-z_]+)"?\s+ADD VALUE\s+(?:IF NOT EXISTS\s+)?'([^']+)'/gi;
const CREATE_TABLE = /CREATE TABLE\s+(?:IF NOT EXISTS\s+)?"?([a-z_]+)"?\s*\(([\s\S]*?)\n\)/gi;
const INSERT = /INSERT INTO\s+"?([a-z_]+)"?\s*\(([^)]*)\)\s*VALUES([\s\S]*?);/gi;

const members = (raw) => raw.split(',').map((v) => v.trim().replace(/^'|'$/g, ''));

/** Split one VALUES row into its top-level literals, respecting quotes and casts. */
function splitRow(row) {
  const out = [];
  let cur = '';
  let inStr = false;
  let depth = 0;
  for (let i = 0; i < row.length; i++) {
    const c = row[i];
    if (inStr) {
      if (c === "'" && row[i + 1] === "'") {
        cur += "''";
        i++;
        continue;
      }
      if (c === "'") inStr = false;
      cur += c;
      continue;
    }
    if (c === "'") {
      inStr = true;
      cur += c;
      continue;
    }
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** The (a, b, c) tuples of a VALUES clause, as raw inner strings. */
function valueRows(clause) {
  const rows = [];
  let depth = 0;
  let start = -1;
  let inStr = false;
  for (let i = 0; i < clause.length; i++) {
    const c = clause[i];
    if (inStr) {
      if (c === "'" && clause[i + 1] === "'") i++;
      else if (c === "'") inStr = false;
      continue;
    }
    if (c === "'") inStr = true;
    else if (c === '(') {
      if (depth === 0) start = i + 1;
      depth++;
    } else if (c === ')') {
      depth--;
      if (depth === 0 && start > -1) rows.push(clause.slice(start, i));
    }
  }
  return rows;
}

/**
 * Exported so the behaviour can be TESTED rather than read.
 *
 * A mutation that gutted the ALTER TYPE accumulation survived a source-level
 * assertion, because the regex CONSTANT it matched was still there - and the
 * real chain happens not to insert any ALTER-added value, so the branch is
 * correct and unexercised. Calling this with a fixture is the only thing that
 * proves the value comes out.
 *
 * @param {{rel: string, sql: string}[]} migrations in journal order
 */
export function analyzeChain(migrations) {
  /** enum name -> Set of members, accumulated in order. */
  const enums = new Map();
  /** "table.column" -> enum name. */
  const enumColumns = new Map();
  const findings = [];

  for (const { rel, sql } of migrations) {
    const src = sql.replace(/^--.*$/gm, '');

    for (const m of src.matchAll(CREATE_ENUM)) enums.set(m[1], new Set(members(m[2])));
    for (const m of src.matchAll(ALTER_ENUM)) {
      if (!enums.has(m[1])) enums.set(m[1], new Set());
      enums.get(m[1]).add(m[2]);
    }

    for (const t of src.matchAll(CREATE_TABLE)) {
      const table = t[1];
      for (const line of t[2].split('\n')) {
        const col = line.match(/^\s*"([a-z_]+)"\s+"?([a-z_]+)"?/);
        if (col && enums.has(col[2])) enumColumns.set(`${table}.${col[1]}`, col[2]);
      }
    }

    for (const ins of src.matchAll(INSERT)) {
      const table = ins[1];
      const cols = ins[2].split(',').map((c) => c.trim().replace(/"/g, ''));
      const positions = cols
        .map((c, i) => ({ i, col: c, type: enumColumns.get(`${table}.${c}`) }))
        .filter((p) => p.type);
      if (positions.length === 0) continue;

      for (const row of valueRows(ins[3])) {
        const cells = splitRow(row);
        if (cells.length !== cols.length) continue; // not a plain literal row
        for (const p of positions) {
          const cell = cells[p.i];
          const lit = cell?.match(/^'([^']*)'(?:::[a-z_ ]+)?$/);
          if (!lit) continue;
          if (!enums.get(p.type).has(lit[1])) {
            findings.push({ file: rel, table, column: p.col, type: p.type, value: lit[1] });
          }
        }
      }
    }
  }

  return { enums, enumColumns, findings };
}

/** Read the journal in order. Only the CLI touches the filesystem. */
function loadChain() {
  const journal = JSON.parse(readFileSync(join(dir, 'meta', '_journal.json'), 'utf8'));
  return journal.entries
    .map((e) => ({ rel: `drizzle/migrations/${e.tag}.sql`, file: join(dir, `${e.tag}.sql`) }))
    .filter((e) => existsSync(e.file))
    .map((e) => ({ rel: e.rel, sql: readFileSync(e.file, 'utf8') }));
}

const { enums, enumColumns, findings } = analyzeChain(loadChain());

if (list) {
  console.log(`  ${enums.size} enum type(s), ${enumColumns.size} enum column(s) tracked.`);
  for (const f of findings) {
    console.log(`  ${f.file}  ${f.table}.${f.column} = '${f.value}' (enum ${f.type})`);
  }
}

// A floor: a parser that stops matching must fail, not pass in silence.
if (enums.size < 10 || enumColumns.size < 10) {
  console.error(
    `✗ Parsed only ${enums.size} enum type(s) and ${enumColumns.size} enum column(s).\n` +
      '  That is too few to be real - the chain or the patterns changed. Not a pass.',
  );
  process.exit(2);
}

if (findings.length > 0) {
  console.error('✗ Migration writes a value its enum does not have:\n');
  for (const f of findings) {
    console.error(
      `    ${f.file}\n      ${f.table}.${f.column} = '${f.value}'\n` +
        `      enum ${f.type} has: ${[...enums.get(f.type)].join(', ')}`,
    );
  }
  console.error(
    '\nEvery one is a guaranteed 22P02. drizzle runs the whole chain in ONE\n' +
      'transaction, so this does not fail one migration - it makes db:migrate\n' +
      'unable to create a database at all.',
  );
  process.exit(1);
}

console.log(
  `✓ Every enum literal in the migration chain is a member of its type ` +
    `(${enums.size} types, ${enumColumns.size} columns).`,
);
