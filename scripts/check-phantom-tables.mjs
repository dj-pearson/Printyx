#!/usr/bin/env node
/**
 * Phantom table checker (PROD-008b).
 *
 * check:phantom-cols verifies the COLUMNS an edge function names. Nothing
 * verified the TABLE. That gap cost the notification bell: the notifications
 * edge function queried `.from('notifications')`, a relation in no Drizzle
 * schema and no migration — the real table is `user_notifications` — and every
 * branch caught the resulting 42P01/PGRST205 and returned an empty list. So the
 * bell showed nothing, permanently, while three server-side producers kept
 * writing real rows. A silent fallback around a phantom relation converts a
 * loud deploy failure into a feature that quietly does nothing.
 *
 * WHAT THIS PROVES, AND WHAT IT DOES NOT.
 *
 * It proves a name is absent from the two sources the repository controls:
 * `pgTable(...)`/`pgView(...)` in shared/, and CREATE TABLE/VIEW in
 * drizzle/{migrations,functions,rls}. It does NOT prove the relation is missing
 * from the database. COP-M00 counted 107 tables that exist live and are in no
 * Drizzle schema, created by db:push before the migration workflow landed. So a
 * name on this list is a QUESTION, not a defect.
 *
 * database-schema-report.json is not usable as the authority: it is a June
 * snapshot that predates web_forms, among others.
 *
 * What turns a question into a defect is corroboration, and there are two
 * cheap kinds:
 *   1. A sibling Express handler serving the same feature off a DIFFERENT
 *      table. That is exactly how the notifications case surfaced.
 *   2. The handler swallowing 42P01/PGRST205. If a missing table is reported as
 *      an empty result, nobody will ever see it fail. That combination is
 *      currently EMPTY and should stay that way — it is the one condition here
 *      worth treating as a hard error rather than a baseline entry.
 *
 * Usage:
 *   node scripts/check-phantom-tables.mjs
 *   node scripts/check-phantom-tables.mjs --update-baseline
 *   node scripts/check-phantom-tables.mjs --list
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const repo = join(fileURLToPath(import.meta.url), '..', '..');
const baselinePath = join(repo, 'docs', 'phantom-tables-baseline.json');
const update = process.argv.includes('--update-baseline');
const list = process.argv.includes('--list');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.ts$/.test(entry)) out.push(full);
  }
  return out;
}

/** Relations the repository declares: Drizzle definitions plus raw SQL DDL. */
function knownRelations() {
  const known = new Set();
  for (const file of walk(join(repo, 'shared'))) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/pgTable\(\s*'([^']+)'/g)) known.add(m[1]);
    for (const m of src.matchAll(/pgView\(\s*'([^']+)'/g)) known.add(m[1]);
  }
  for (const dir of ['drizzle/migrations', 'drizzle/functions', 'drizzle/rls']) {
    const abs = join(repo, dir);
    if (!existsSync(abs)) continue;
    for (const entry of readdirSync(abs)) {
      if (!entry.endsWith('.sql')) continue;
      const src = readFileSync(join(abs, entry), 'utf8');
      for (const m of src.matchAll(
        /CREATE\s+(?:OR\s+REPLACE\s+)?(?:MATERIALIZED\s+)?(?:TABLE|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?"?(?:public\.)?"?([a-zA-Z0-9_]+)"?/gi,
      )) {
        known.add(m[1]);
      }
    }
  }
  return known;
}

const known = knownRelations();
const findings = [];
const swallowing = [];
const fabricating = [];

/**
 * An error branch that answers with invented rows.
 *
 * The swallowing rule above keys on the 42P01/PGRST205 literal, and the two
 * worst instances in this tree did not test the code at all: `if (error) {` and
 * then a 200 carrying a hand-written array of objects. auto-lead-routing
 * returned two "sample" routing rules for `lead_routing_rules`, a relation
 * named by no schema, no migration and no other file in the repository, so the
 * routing UI listed rules that did not exist and could not be edited.
 * commission returned a "Sales Rep Standard" plan with 5%/6.5%/8% tiers, which
 * is a rep reading fabricated numbers as their own pay structure.
 *
 * This is a hard gate at zero rather than a baseline: a caller cannot tell
 * invented data from real data, so there is no version of it that is merely
 * debt. Matching is deliberately narrow - an `if (error)` block whose body
 * returns an array-of-objects literal - which misses a fabricated SINGLE object
 * and anything returned via a named constant. Both would be worth catching; the
 * narrow form is what has actually occurred.
 *
 * The block end is the first closing brace at ANY indent, not the one matching
 * the `if`. A version anchored to the outer brace missed the commission case
 * entirely: its fabricated plan runs ~60 lines and the block never closed
 * inside the scan window. Ending early is safe here because the array literal
 * that decides the finding opens before any brace can close.
 */
const ERROR_BRANCH = /if\s*\(\s*(?:\w+\.)?error\s*\)\s*\{([\s\S]{0,600}?)\n\s*\}/g;
const RETURNS_ROW_LITERAL = /return[\s\S]{0,160}?\[\s*\{/;

/**
 * PA-031: strip comments before matching. `_shared/case.ts` documents its usage
 * with `db.from('t')` inside a JSDoc block, and that produced a phantom table
 * called `t` — a finding about a code sample, baselined as though it were a
 * defect. Same limitation the nav-target checker had.
 *
 * Deliberately crude: it does not parse, so a `//` inside a string literal takes
 * the rest of that line with it. A `.from('x')` is never to the right of one in
 * this codebase, and over-stripping loses a finding rather than inventing one.
 */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

for (const file of walk(join(repo, 'supabase', 'functions'))) {
  const src = stripComments(readFileSync(file, 'utf8'));
  const swallows = /42P01|PGRST205/.test(src);
  const rel = relative(repo, file).replace(/\\/g, '/');
  const seen = new Set();
  for (const m of src.matchAll(/\.from\(\s*'([a-zA-Z0-9_]+)'\s*\)/g)) {
    const table = m[1];
    if (known.has(table) || seen.has(table)) continue;
    seen.add(table);
    findings.push({ table, file: rel });
    if (swallows) swallowing.push({ table, file: rel });
  }

  for (const m of src.matchAll(ERROR_BRANCH)) {
    if (RETURNS_ROW_LITERAL.test(m[1])) {
      fabricating.push(rel);
      break;
    }
  }
}

const key = (f) => `${f.table} (${f.file})`;

if (list) {
  const byTable = new Map();
  for (const f of findings) {
    if (!byTable.has(f.table)) byTable.set(f.table, []);
    byTable.get(f.table).push(f.file);
  }
  for (const [table, files] of [...byTable].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n${table}  (${files.length} function(s))`);
    for (const f of files) console.log(`    ${f}`);
  }
  console.log(`\n${findings.length} reference(s) to ${byTable.size} undeclared relation(s).`);
  process.exit(0);
}

if (update) {
  writeFileSync(
    baselinePath,
    JSON.stringify(
      {
        note:
          'PROD-008b: edge-function .from() names absent from BOTH the Drizzle definitions in ' +
          'shared/ and the CREATE TABLE/VIEW statements in drizzle/. Absence here is a question, ' +
          'not a defect: 107 tables exist live with no Drizzle schema (db:push, pre-migrations). ' +
          'Confirm against the database before treating an entry as broken. The list may not grow.',
        allowed: [...new Set(findings.map(key))].sort(),
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `✓ Baseline updated: ${new Set(findings.map(key)).size} undeclared table reference(s).`,
  );
  process.exit(0);
}

// Invented rows on an error path, checked before the baseline for the reason in
// the ERROR_BRANCH comment: the caller cannot tell them from real ones.
if (fabricating.length > 0) {
  console.error(`\u2717 ${fabricating.length} error branch(es) returning fabricated rows:\n`);
  for (const f of fabricating) console.error(`  ${f}`);
  console.error(
    '\nA 200 carrying hand-written objects is indistinguishable from real data to every\n' +
      'caller. Return the error. This is how a commission page showed invented 5%/6.5%/8%\n' +
      'tiers and a routing page listed rules that did not exist.',
  );
  process.exit(1);
}

// A handler that swallows 42P01 CANNOT report a missing table, so this pairing is
// never acceptable regardless of the baseline.
if (swallowing.length > 0) {
  console.error(
    `✗ ${swallowing.length} undeclared table(s) queried by a function that swallows 42P01/PGRST205:\n`,
  );
  for (const f of swallowing) console.error(`  ${f.table}  ${f.file}`);
  console.error(
    '\nA missing relation here is reported to the caller as an empty result, so the failure is\n' +
      'invisible. Either confirm the table exists and drop the catch, or point the query at the\n' +
      'relation that does exist. This is how the notification bell stayed empty for months.',
  );
  process.exit(1);
}

if (!existsSync(baselinePath)) {
  console.error(`Missing ${relative(repo, baselinePath)}. Run with --update-baseline first.`);
  process.exit(1);
}

const allowed = new Set(JSON.parse(readFileSync(baselinePath, 'utf8')).allowed);
const novel = findings.filter((f) => !allowed.has(key(f)));

if (novel.length > 0) {
  console.error(`✗ ${novel.length} NEW undeclared table reference(s):\n`);
  for (const f of novel) console.error(`  ${f.table}  ${f.file}`);
  console.error(
    '\nAdd the table to a Drizzle schema and a migration, or point the query at the relation\n' +
      'that exists. If it is a live db:push table, record it with --update-baseline and say so.',
  );
  process.exit(1);
}

const fixed = [...allowed].filter((a) => !findings.some((f) => key(f) === a));
if (fixed.length > 0) {
  console.log(`✓ No new undeclared tables. ${fixed.length} baselined entr(ies) are gone:`);
  for (const f of fixed.slice(0, 10)) console.log(`    ${f}`);
  if (fixed.length > 10) console.log(`    …and ${fixed.length - 10} more`);
  console.log('  Tighten with: node scripts/check-phantom-tables.mjs --update-baseline');
  process.exit(0);
}

console.log(
  `✓ No undeclared tables behind a silent catch, and none new (${allowed.size} baselined).`,
);
