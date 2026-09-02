#!/usr/bin/env node
/**
 * Tables a feature reads that nothing ever writes.
 *
 * THE WORKED EXAMPLE. supabase/functions/performance/ answered the alert bell
 * from `system_alerts`. The table is real and correct; the only insert against
 * it anywhere is storage.createSystemAlert, which no caller names. So
 * SystemAlertBell, PageAlerts and the notification-bell fallback were
 * permanently empty in production, and nothing anywhere reported an error -
 * an empty list is a perfectly good answer to "what alerts are there".
 *
 * That is the shape: a read path that is correct, a table that exists, and no
 * producer. It renders as a feature nobody uses rather than a feature that does
 * not work, which is why it survives review.
 *
 * WHAT COUNTS AS A WRITER: `.from('t').insert(`/`.upsert(` anywhere in
 * supabase/functions or server, `db.insert(camelCaseTable)` in server code, or
 * an `INSERT INTO t` in drizzle/**.sql (seeds and cron jobs included).
 *
 * WHAT THIS CANNOT SEE, and each of these is a real way to be a false positive:
 *   - An external system writing the table directly (this repo syncs from
 *     E-Automate; those rows arrive outside the codebase).
 *   - A writer whose table name is built at runtime.
 *   - A writer that exists but is unreachable - system_alerts itself would NOT
 *     be reported here, because its insert exists. Unreachable-writer is a
 *     harder question and this check does not attempt it.
 *   - Views, which are derived by definition and are excluded.
 *   - Tables that do not exist at all; those are check:phantom-tables' story
 *     and are excluded so the two lists stay disjoint.
 *
 * So an entry here is a QUESTION - "who fills this in?" - not a defect. The
 * answer is usually one of: a UI that was never built, an importer that was
 * never wired, or an external feed that should be named in a comment. Record
 * which, rather than deleting the read.
 *
 *   node scripts/check-unwritten-tables.mjs
 *   node scripts/check-unwritten-tables.mjs --update-baseline
 *   node scripts/check-unwritten-tables.mjs --list
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const baselinePath = join(repo, 'docs', 'unwritten-tables-baseline.json');
const update = process.argv.includes('--update-baseline');
const list = process.argv.includes('--list');

/** Comments stripped both directions: a comment naming a table is not a read, and one naming an insert is not a writer. */
const stripComments = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/^\s*--.*$/gm, '');

function walk(dir, test, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, test, out);
    else if (test(entry)) out.push(full);
  }
  return out;
}

const camel = (t) => t.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

/** Declared relations, and which of them are views. */
function relations() {
  const declared = new Set();
  const views = new Set();
  for (const file of walk(join(repo, 'shared'), (f) => f.endsWith('.ts'))) {
    for (const m of stripComments(readFileSync(file, 'utf8')).matchAll(
      /pgTable\(\s*'([a-z_]+)'/g,
    )) {
      declared.add(m[1]);
    }
  }
  for (const file of walk(join(repo, 'drizzle'), (f) => f.endsWith('.sql'))) {
    const src = stripComments(readFileSync(file, 'utf8'));
    const table = /create\s+table\s+(?:if\s+not\s+exists\s+)?"?(?:public\.)?"?([a-z_]+)"?/gi;
    const view =
      /create\s+(?:or\s+replace\s+)?(?:materialized\s+)?view\s+(?:if\s+not\s+exists\s+)?"?(?:public\.)?"?([a-z_]+)"?/gi;
    for (const m of src.matchAll(table)) declared.add(m[1]);
    for (const m of src.matchAll(view)) {
      declared.add(m[1]);
      views.add(m[1]);
    }
  }
  return { declared, views };
}

const { declared, views } = relations();

const edgeFiles = walk(join(repo, 'supabase', 'functions'), (f) => f.endsWith('.ts'));
const reads = new Map();
for (const file of edgeFiles) {
  const src = stripComments(readFileSync(file, 'utf8'));
  for (const m of src.matchAll(/\.from\(\s*'([a-z_]+)'\s*\)\s*\.select/g)) {
    if (!reads.has(m[1])) reads.set(m[1], new Set());
    reads.get(m[1]).add(relative(repo, file).replace(/\\/g, '/'));
  }
}

const writerCorpus = [
  ...edgeFiles,
  ...walk(join(repo, 'server'), (f) => f.endsWith('.ts')),
  ...walk(join(repo, 'scripts'), (f) => /\.(ts|mjs|cjs)$/.test(f)),
  ...walk(join(repo, 'drizzle'), (f) => f.endsWith('.sql')),
].map((f) => stripComments(readFileSync(f, 'utf8')));

function hasWriter(table) {
  const postgrest = new RegExp(`from\\(\\s*'${table}'\\s*\\)\\s*\\.(insert|upsert)`);
  const drizzle = new RegExp(`insert\\(\\s*${camel(table)}\\s*\\)`);
  // WF-C-01: the schema qualifier is optional AND it was the bug. This missed
  // `INSERT INTO public.pipeline_automation_logs` in drizzle/functions/
  // pipeline-config.sql, so a table with a real producer - a SQL function, which
  // is exactly the "external system fills it" case this guard exists to ask
  // about - was reported as unwritten the moment its TypeScript writer went away.
  const raw = new RegExp(`insert\\s+into\\s+(?:"?public"?\\.)?"?${table}"?`, 'i');
  return writerCorpus.some((text) => postgrest.test(text) || drizzle.test(text) || raw.test(text));
}

const findings = [...reads.keys()]
  .filter((t) => declared.has(t) && !views.has(t) && !hasWriter(t))
  .sort()
  .map((table) => ({ table, readers: [...reads.get(table)].sort() }));

if (list) {
  for (const f of findings) {
    console.log(`\n${f.table}`);
    for (const r of f.readers) console.log(`    ${r}`);
  }
  console.log(`\n${findings.length} table(s) read and never written.`);
  process.exit(0);
}

if (update) {
  writeFileSync(
    baselinePath,
    JSON.stringify(
      {
        note:
          'Declared tables (not views) that an edge function reads and that nothing anywhere ' +
          'inserts into. Each is a question - who fills this in? - not a defect: the answer is ' +
          'usually a UI that was never built, an importer never wired, or an external feed that ' +
          'should be named in a comment. See scripts/check-unwritten-tables.mjs. Do not grow it.',
        generated: new Date().toISOString().slice(0, 10),
        ofTablesRead: reads.size,
        tables: findings.map((f) => f.table),
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `Baseline updated: ${findings.length} of ${reads.size} tables read are never written.`,
  );
  process.exit(0);
}

const baseline = existsSync(baselinePath)
  ? new Set(JSON.parse(readFileSync(baselinePath, 'utf8')).tables ?? [])
  : new Set();

const added = findings.filter((f) => !baseline.has(f.table));
if (added.length > 0) {
  console.error(`✗ ${added.length} NEW table(s) read by a feature that nothing writes:\n`);
  for (const f of added) {
    console.error(`  ${f.table}`);
    for (const r of f.readers) console.error(`      ${r}`);
  }
  console.error(
    '\nA correct read of an empty table answers 200 with [], so this fails silently and looks\n' +
      'like a feature nobody uses. Add the producer, or record in a comment which external\n' +
      'system fills the table, then:\n' +
      '    node scripts/check-unwritten-tables.mjs --update-baseline',
  );
  process.exit(1);
}

const fixed = [...baseline].filter((t) => !findings.some((f) => f.table === t));
if (fixed.length > 0) {
  console.log(`✓ No new unwritten tables. ${fixed.length} baselined now have a producer:`);
  for (const t of fixed) console.log(`    ${t}`);
  console.log('  Tighten with: node scripts/check-unwritten-tables.mjs --update-baseline');
} else {
  console.log(`✓ No new unwritten tables (${findings.length} baselined of ${reads.size} read).`);
}
