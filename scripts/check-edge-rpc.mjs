#!/usr/bin/env node
/**
 * check:edge-rpc - the SQL an edge function calls but does not contain.
 *
 * Edge functions reach for Postgres functions with `.rpc('name', {...})` when
 * PostgREST cannot express a query (GROUP BY, window functions, REFRESH
 * MATERIALIZED VIEW). Those functions live in `drizzle/functions/*.sql`, which
 * is applied BY HAND - `db:migrate` never runs it, by design, because
 * drizzle-kit has no schema delta for a function body. So an edge function can
 * call an RPC that exists in no file at all and nothing anywhere says so: the
 * name is a string, tsc does not reach the edge tree, and the failure is a
 * PostgREST 42883 at runtime.
 *
 * WHAT ROUND 139 FOUND, and why each rule is here.
 *
 * RULE 1 - every `.rpc(name)` resolves to a CREATE FUNCTION in the repo.
 * `geocode-leads` called `exec_sql`, which is defined nowhere. Its result was
 * destructured and never read, so the direct queries below it were not a
 * fallback - they were the only path, and every GET spent a round trip on a
 * call that always failed.
 *
 * RULE 2 - no interpolated SQL string in the edge tree. That same dead call
 * built `WHERE tenant_id = '${tenantId}'` by interpolation. It was safe ONLY
 * because `exec_sql` does not exist, and `exec_sql` is a common Supabase
 * helper somebody adds to a project in an afternoon - so the code was one
 * ops decision away from an injection sink. `sql-injection-prevention.test.ts`
 * could not see it: that suite walks `server/`, and this is the edge tree.
 *
 * RULE 3 - every drizzle/functions/*.sql file is listed in its own README.
 * The table documented 4 of 9 files. The five it omitted hold 13 functions and
 * ELEVEN of them 500 the caller when the file has not been applied, including
 * the deals board's drag-and-drop (`pipeline_deal_transition`) and all five
 * lead-scoring analytics. The four it documented mostly degrade to a fallback,
 * which is why somebody thought to write them down. So the omission correlated
 * exactly with the dangerous half. Same shape as drizzle/cron/README.md
 * printing "16 jobs" over a table listing 19: the one document whose job is to
 * say what exists was the one nobody re-read.
 *
 * FLOORS. A walk that stops matching reports nothing, which is
 * indistinguishable from a clean run, so this exits 2 below MIN_EDGE_FILES or
 * MIN_DEFINITIONS rather than passing.
 */
import fs from 'node:fs';
import path from 'node:path';

export const MIN_EDGE_FILES = 400;
export const MIN_DEFINITIONS = 15;

const EDGE_ROOT = 'supabase/functions';
const FN_DIR = 'drizzle/functions';
const MIGRATIONS = 'drizzle/migrations';

/**
 * Line comments first, then block comments - the other order reads a line
 * comment ending in `/*` as a block opener and blanks the rest of the file.
 * The lookbehind keeps `https://` intact. Blocks become spaces so reported
 * line numbers stay honest.
 *
 * This matters here more than usual: the fix in geocode-leads/index.ts
 * QUOTES the call it removed, so a scan that reads comments reports the
 * explanation as the defect (CLAUDE.md records that trap thirteen times).
 */
export function stripComments(src) {
  return src
    .replace(/(?<![:/])\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length));
}

function walk(dir, out = [], ext = /\.ts$/) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out, ext);
    else if (ext.test(e.name)) out.push(p);
  }
  return out;
}

export function edgeFiles() {
  return walk(EDGE_ROOT);
}

/** Every function name the repo defines, and which file defines it. */
export function definedFunctions() {
  const defs = new Map();
  const sql = [...walk(FN_DIR, [], /\.sql$/), ...walk(MIGRATIONS, [], /\.sql$/)];
  for (const f of sql) {
    const body = fs.readFileSync(f, 'utf8');
    for (const m of body.matchAll(
      /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(/gi,
    )) {
      if (!defs.has(m[1])) defs.set(m[1], f);
    }
  }
  return defs;
}

/** `.rpc('name')` call sites, comments stripped. */
export function rpcCalls(files) {
  const calls = [];
  for (const f of files) {
    const src = stripComments(fs.readFileSync(f, 'utf8'));
    for (const m of src.matchAll(/\.rpc\(\s*['"`]([a-zA-Z0-9_]+)['"`]/g)) {
      calls.push({ file: f, name: m[1], line: src.slice(0, m.index).split('\n').length });
    }
  }
  return calls;
}

/**
 * Template literals that read as SQL AND interpolate. Requiring a verb AND a
 * clause keyword is what keeps English prose out: "update the baseline" has a
 * verb and no FROM/INTO/SET.
 */
export function interpolatedSql(files) {
  const hits = [];
  for (const f of files) {
    const src = stripComments(fs.readFileSync(f, 'utf8'));
    for (const m of src.matchAll(/`([^`]*)`/g)) {
      const body = m[1];
      if (!body.includes('${')) continue;
      if (!/\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b/i.test(body)) continue;
      if (!/\b(FROM|INTO|SET|WHERE)\b/i.test(body)) continue;
      hits.push({
        file: f,
        line: src.slice(0, m.index).split('\n').length,
        preview: body.replace(/\s+/g, ' ').trim().slice(0, 100),
      });
    }
  }
  return hits;
}

/** SQL files in drizzle/functions that the README's table does not list. */
export function undocumentedSqlFiles(dir = FN_DIR) {
  const readme = path.join(dir, 'README.md');
  if (!fs.existsSync(readme)) return fs.readdirSync(dir).filter((f) => f.endsWith('.sql'));
  const text = fs.readFileSync(readme, 'utf8');
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .filter((f) => !text.includes(f));
}

export function analyze() {
  const files = edgeFiles();
  const defs = definedFunctions();
  const calls = rpcCalls(files);
  return {
    fileCount: files.length,
    definitionCount: defs.size,
    unresolved: calls.filter((c) => !defs.has(c.name)),
    interpolated: interpolatedSql(files),
    undocumented: undocumentedSqlFiles(),
  };
}

function main() {
  const r = analyze();

  if (r.fileCount < MIN_EDGE_FILES) {
    console.error(
      `check:edge-rpc - walked only ${r.fileCount} edge file(s), expected >= ${MIN_EDGE_FILES}. ` +
        `The walk is broken; a run that looks at nothing reports nothing.`,
    );
    process.exit(2);
  }
  if (r.definitionCount < MIN_DEFINITIONS) {
    console.error(
      `check:edge-rpc - resolved only ${r.definitionCount} SQL function definition(s), ` +
        `expected >= ${MIN_DEFINITIONS}. The definition scan is broken.`,
    );
    process.exit(2);
  }

  let failed = false;

  if (r.unresolved.length > 0) {
    failed = true;
    console.error(`\ncheck:edge-rpc - ${r.unresolved.length} .rpc() call(s) resolve to nothing:`);
    for (const c of r.unresolved) console.error(`  ${c.file}:${c.line}  ${c.name}()`);
    console.error(
      `\n  Define it in drizzle/functions/<file>.sql (and list that file in the README),\n` +
        `  or stop calling it. A name that exists nowhere is a runtime 42883, and tsc\n` +
        `  cannot see it because the edge tree is outside the project.`,
    );
  }

  if (r.interpolated.length > 0) {
    failed = true;
    console.error(`\ncheck:edge-rpc - ${r.interpolated.length} interpolated SQL string(s):`);
    for (const h of r.interpolated) console.error(`  ${h.file}:${h.line}  ${h.preview}`);
    console.error(
      `\n  Pass values as function arguments. An interpolated identifier is an\n` +
        `  injection sink the moment something can execute the string.`,
    );
  }

  if (r.undocumented.length > 0) {
    failed = true;
    console.error(
      `\ncheck:edge-rpc - ${r.undocumented.length} file(s) missing from ${FN_DIR}/README.md:`,
    );
    for (const f of r.undocumented) console.error(`  ${f}`);
    console.error(
      `\n  These are applied BY HAND, so the README is the only record of what a\n` +
        `  deployment still owes. Add a row naming the functions, the callers, and\n` +
        `  what happens when the file has not been applied (500, or a fallback).`,
    );
  }

  if (failed) process.exit(1);

  console.log(
    `check:edge-rpc - ${rpcCalls(edgeFiles()).length} .rpc() call(s) across ${r.fileCount} edge files ` +
      `all resolve to one of ${r.definitionCount} defined function(s); no interpolated SQL; ` +
      `all ${fs.readdirSync(FN_DIR).filter((f) => f.endsWith('.sql')).length} function file(s) documented.`,
  );
}

const isEntryPoint =
  !!process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isEntryPoint) main();
