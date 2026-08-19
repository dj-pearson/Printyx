#!/usr/bin/env tsx
/**
 * Phantom column checker (COP-M01).
 *
 * Edge functions talk to PostgREST by naming columns in strings. Nothing checks
 * those strings, so a column that does not exist is a runtime 42703 — a 500 the
 * moment someone types in a search box — and it is invisible to tsc, to lint and
 * to every test that does not hit a database.
 *
 * Three of these were found by hand in three consecutive passes, each one
 * breaking a page that looked finished:
 *
 *   companies.email      — in the search or() filter. Every company search 500'd,
 *                          including the quote builder's customer picker.
 *   deals.deal_name      — same, on the deals search.
 *   deals.deal_value     — in the insert and both update maps, so creating or
 *   deals.stage            editing a deal failed on the fields people edit.
 *
 * This finds the rest of them statically, by reading the Drizzle table
 * definitions (671 tables) and checking every column literal an edge function
 * hands to PostgREST against the table the call chain is on.
 *
 * WHAT IT CANNOT SEE, so that nobody reads a pass as proof of correctness:
 *   - insert/update payloads built as a named variable rather than an inline
 *     object literal. The deals insert was one of those.
 *   - column names assembled at runtime, and field maps keyed camel -> snake.
 *   - tables that exist live but are in no Drizzle schema (COP-M00 counted 107
 *     of them, created by db:push). Those are reported as unknown, not failed.
 *
 * Baseline: docs/phantom-columns-baseline.json. Fix them or record them; the
 * count may not grow.
 */
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { is } from 'drizzle-orm';
import { PgTable, getTableConfig } from 'drizzle-orm/pg-core';

import { readdirSync as readSchemaDir } from 'node:fs';

const repo = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const BASELINE = join(repo, 'docs', 'phantom-columns-baseline.json');
const update = process.argv.includes('--update-baseline');
const triage = process.argv.includes('--triage');

// ─── 1. Physical columns, per physical table name ──────────────────────────
//
// Every shared/*.ts is loaded separately rather than through
// shared/drizzle-schema.ts, because that entry point re-exports and so shows
// only ONE definition per table name. Four table names are declared twice with
// different shapes (see check:dup-tables) — blog_posts most consequentially —
// and for those there is no way to know from the code which one is live. Those
// tables are marked AMBIGUOUS and skipped: reporting them would be reporting a
// schema collision as a query bug, which is a different story with a different
// fix.
const tableColumns = new Map<string, Set<string>>();
const ambiguousTables = new Set<string>();
const signatures = new Map<string, Set<string>>();

const schemaFiles = readSchemaDir(join(repo, 'shared'))
  .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'drizzle-schema.ts')
  .sort();

for (const file of schemaFiles) {
  let mod: Record<string, unknown>;
  try {
    mod = (await import(join(repo, 'shared', file))) as Record<string, unknown>;
  } catch {
    continue; // a module that will not load cannot contribute a table
  }
  for (const value of Object.values(mod)) {
    if (!is(value as any, PgTable)) continue;
    const cfg = getTableConfig(value as any);
    const columns = new Set(cfg.columns.map((c) => c.name));
    const signature = [...columns].sort().join(',');
    const seen = signatures.get(cfg.name);
    if (seen && !seen.has(signature)) {
      ambiguousTables.add(cfg.name);
    }
    (seen ?? signatures.set(cfg.name, new Set()).get(cfg.name)!).add(signature);
    const existing = tableColumns.get(cfg.name) ?? new Set<string>();
    for (const column of columns) existing.add(column);
    tableColumns.set(cfg.name, existing);
  }
}
for (const name of ambiguousTables) tableColumns.delete(name);

// ─── 2. Column literals an edge function hands to PostgREST ────────────────
const FILTER_METHODS = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'like',
  'ilike',
  'is',
  'in',
  'contains',
  'containedBy',
  'overlaps',
  'order',
];

/** A string that could not be a column name — skip rather than guess. */
function looksLikeColumn(token: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(token) && token.length <= 63;
}

interface Ref {
  table: string;
  column: string;
  line: number;
  kind: string;
}

function lineAt(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

/** Nearest preceding .from('x'). These handlers build one query at a time, so
 *  the last table named before a filter is the table that filter runs against. */
function tableFor(froms: Array<{ index: number; table: string }>, index: number): string | null {
  let current: string | null = null;
  for (const f of froms) {
    if (f.index > index) break;
    current = f.table;
  }
  return current;
}

/**
 * Drop `relation ( … )` embeds from a select list, along with the relation name
 * itself — those are PostgREST joins, not columns on this table.
 */
function stripEmbeds(list: string): string {
  let out = '';
  let depth = 0;
  for (const ch of list) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (depth === 0) out += ch;
  }
  // A relation name is whatever preceded the paren; it is left as a bare token,
  // so drop any token that the original text followed with '('.
  const embedded = new Set([...list.matchAll(/([a-z_][a-z0-9_]*)\s*\(/g)].map((m) => m[1]));
  return (
    out
      .split(',')
      // The alias comes first in `alias:relation(...)`, so resolve the token to
      // the name that actually followed the paren before deciding.
      .filter((token) => !embedded.has(token.trim().split(':').pop()?.trim() ?? ''))
      .join(',')
  );
}

function scan(source: string): Ref[] {
  const refs: Ref[] = [];
  const froms = [...source.matchAll(/\.from\(\s*'([a-z0-9_]+)'\s*\)/g)].map((m) => ({
    index: m.index ?? 0,
    table: m[1],
  }));
  if (froms.length === 0) return refs;

  const push = (index: number, column: string, kind: string) => {
    const table = tableFor(froms, index);
    if (!table || !looksLikeColumn(column)) return;
    refs.push({ table, column, line: lineAt(source, index), kind });
  };

  // .eq('col', …) and friends, plus .order('col', …)
  for (const m of source.matchAll(
    new RegExp(`\\.(${FILTER_METHODS.join('|')})\\(\\s*'([^']+)'`, 'g'),
  )) {
    push(m.index ?? 0, m[2], m[1]);
  }

  // .or(`a.ilike.%x%,b.eq.1`) — comma-delimited, column before the first dot.
  for (const m of source.matchAll(/\.or\(\s*[`'"]([^`'"]+)[`'"]/g)) {
    for (const clause of m[1].split(',')) {
      const column = clause.trim().split('.')[0];
      if (column) push(m.index ?? 0, column, 'or');
    }
  }

  // Columns INSIDE an embed belong to the embedded relation, not to the table
  // the chain is on. Two bad ones (contracts.name, contracts.value) were found
  // by reading rather than by this check, which is what prompted it.
  for (const m of source.matchAll(/\.select\(\s*(['`])([^'`]+)\1/g)) {
    // `relation(...)`, `alias:relation(...)` and PostgREST's disambiguating
    // `relation!constraint_name(...)` all name the same table.
    for (const embed of m[2].matchAll(/([a-z_][a-z0-9_]*)(?:!\w+)?\s*\(([^()]*)\)/g)) {
      const relation = embed[1];
      const columns = tableColumns.get(relation);
      if (!columns || ambiguousTables.has(relation)) continue;
      if (embed[2].includes('*')) continue;
      for (const raw of embed[2].split(',')) {
        const token = raw.trim().split(':').pop()?.trim() ?? '';
        if (!token || !looksLikeColumn(token)) continue;
        if (columns.has(token)) continue;
        refs.push({
          table: relation,
          column: token,
          line: lineAt(source, m.index ?? 0),
          kind: 'embed',
        });
      }
    }
  }

  // .select('a, b, c') and .select(`a, b, roles ( … )`).
  //
  // Backtick selects were invisible in the first version of this check, and they
  // are exactly where the long multi-line column lists live — /user/profile named
  // six phantom columns inside one. Embedded relations are stripped rather than
  // skipping the whole list, so the top-level columns around an embed still get
  // checked. A '*' anywhere means the list is not an enumeration of columns.
  for (const m of source.matchAll(/\.select\(\s*(['`])([^'`]+)\1/g)) {
    const list = stripEmbeds(m[2]);
    if (list.includes('*')) continue;
    for (const raw of list.split(',')) {
      const token = raw.trim().split(':').pop()?.trim() ?? '';
      if (token) push(m.index ?? 0, token, 'select');
    }
  }

  // .insert({ … }) / .update({ … }) with an INLINE object literal.
  for (const m of source.matchAll(/\.(insert|update)\(\s*\{/g)) {
    const start = (m.index ?? 0) + m[0].length - 1;
    let depth = 0;
    let end = start;
    for (let i = start; i < source.length; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    const body = source.slice(start, end);
    // Only top-level keys: a nested object's keys belong to a jsonb value.
    let nest = 0;
    for (const km of body.matchAll(/([{}]|(?:^|[,{\n])\s*([a-z][a-z0-9_]*)\s*:)/g)) {
      if (km[1] === '{') nest++;
      else if (km[1] === '}') nest--;
      else if (km[2] && nest === 1) push(m.index ?? 0, km[2], m[1]);
    }
  }

  return refs;
}

// ─── 3. Walk the edge functions ────────────────────────────────────────────
function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules') continue;
      walk(full, out);
    } else if (entry.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

const files = walk(join(repo, 'supabase', 'functions')).filter(
  (f) => !f.endsWith(`functions${'/'}server.ts`),
);

const findings: Array<{ id: string; detail: string }> = [];
const unknownTables = new Map<string, number>();

for (const file of files) {
  const rel = relative(repo, file).replace(/\\/g, '/');
  let source: string;
  try {
    source = readFileSync(file, 'utf-8');
  } catch {
    continue;
  }
  for (const ref of scan(source)) {
    if (ambiguousTables.has(ref.table)) continue;
    const columns = tableColumns.get(ref.table);
    if (!columns) {
      unknownTables.set(ref.table, (unknownTables.get(ref.table) ?? 0) + 1);
      continue;
    }
    if (columns.has(ref.column)) continue;
    findings.push({
      id: `${rel}:${ref.table}.${ref.column}`,
      detail: `${rel}:${ref.line} — ${ref.table}.${ref.column} (${ref.kind}) is not a column`,
    });
  }
}

// Distinct ids: the same phantom named twice in one file is one defect.
const byId = new Map<string, string>();
for (const f of findings) if (!byId.has(f.id)) byId.set(f.id, f.detail);
const current = [...byId.keys()].sort();

if (triage) {
  // For each finding, name the columns the table DOES have that look closest.
  // The point is to separate a rename (an obvious neighbour) from a table that
  // was written against a different design entirely (no neighbour at all) —
  // the second kind is a redesign and should not be attempted as a rename.
  const score = (a: string, b: string): number => {
    if (a === b) return 1;
    const at = new Set(a.split('_'));
    const bt = new Set(b.split('_'));
    let shared = 0;
    for (const t of at) if (bt.has(t)) shared++;
    const tokenScore = shared / Math.max(at.size, bt.size);
    const substring = a.includes(b) || b.includes(a) ? 0.5 : 0;
    return Math.max(tokenScore, substring);
  };

  const lines: string[] = [];
  let renameable = 0;
  for (const id of current) {
    const [file, rest] = [id.slice(0, id.lastIndexOf(':')), id.slice(id.lastIndexOf(':') + 1)];
    const dot = rest.lastIndexOf('.');
    const table = rest.slice(0, dot);
    const column = rest.slice(dot + 1);
    const columns = tableColumns.get(table);
    if (!columns) continue;
    const ranked = [...columns]
      .map((c) => ({ c, s: score(column, c) }))
      .filter((r) => r.s >= 0.34)
      .sort((a, b) => b.s - a.s)
      .slice(0, 3)
      .map((r) => r.c);
    if (ranked.length > 0) renameable++;
    lines.push(
      `| \`${table}.${column}\` | ${ranked.length ? ranked.map((c) => `\`${c}\``).join(', ') : '**none — redesign, not a rename**'} | ${file.replace('supabase/functions/', '')} |`,
    );
  }

  console.log('# Phantom column triage\n');
  console.log(
    'Generated by `npx tsx scripts/check-phantom-columns.ts --triage`. Regenerate after any\n' +
      'burn-down; do not hand-edit.\n',
  );
  console.log(
    `${current.length} references. ${renameable} have a textually similar column on the same ` +
      `table, so they are probably renames; ${current.length - renameable} have none.\n`,
  );
  console.log(
    'Read the second number as "needs a look", not as "needs a redesign". The match is\n' +
      'textual, so it misses renames between names that mean the same thing and share no\n' +
      'letters — `audit_logs.created_at` really is just `timestamp`, and this table says\n' +
      '"none" for it. What the column says reliably is where a substitution is NOT obvious,\n' +
      'which is exactly where guessing has been the expensive mistake.\n',
  );
  console.log('| phantom | closest real columns | file |');
  console.log('| --- | --- | --- |');
  for (const line of lines.sort()) console.log(line);
  process.exit(0);
}

if (update) {
  writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        note:
          'Column literals handed to PostgREST that are not columns on the table the call chain is on. ' +
          'Each entry is a runtime 42703 waiting for the code path to run. Fix them; do not grow this list. ' +
          'Regenerate with: npx tsx scripts/check-phantom-columns.ts --update-baseline',
        allowed: current,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`Baseline updated: ${current.length} phantom column reference(s).`);
  process.exit(0);
}

let baseline: string[] = [];
if (existsSync(BASELINE)) {
  baseline = JSON.parse(readFileSync(BASELINE, 'utf-8')).allowed ?? [];
}
const allowed = new Set(baseline);

const added = current.filter((id) => !allowed.has(id));
const resolved = baseline.filter((id) => !byId.has(id));

if (added.length > 0) {
  console.error(`\n${added.length} new phantom column reference(s):\n`);
  for (const id of added) console.error(`  ${byId.get(id)}`);
  console.error(
    '\nEach of these is a 42703 at runtime, not a type error. Point the call at a real ' +
      'column (see the table in shared/), or record it with --update-baseline if the table ' +
      'genuinely lives outside the Drizzle schema.\n',
  );
  process.exit(1);
}

if (resolved.length > 0) {
  console.log(
    `\nℹ ${resolved.length} baseline entr(ies) appear fixed — tighten with: ` +
      'npx tsx scripts/check-phantom-columns.ts --update-baseline',
  );
}

const unknownCount = [...unknownTables.values()].reduce((a, b) => a + b, 0);
console.log(
  `✓ No new phantom column references (${current.length} baselined; ` +
    `${unknownTables.size} table(s) not in any Drizzle schema and ${ambiguousTables.size} ` +
    `declared twice with different shapes, ${unknownCount} reference(s), skipped).`,
);
