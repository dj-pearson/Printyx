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
 *   - a payload whose keys are assembled at runtime (a spread, a camel-to-snake
 *     field map, Object.assign). A payload built as a NAMED VARIABLE used to be
 *     here too and no longer is - see the resolution rule at the insert/update
 *     scan, and note that it resolves the nearest preceding BINDING, so a
 *     variable assigned from a function call resolves to nothing rather than to
 *     an older literal of the same name.
 *   - column names assembled at runtime, and field maps keyed camel -> snake.
 *   - tables that exist live but are in no Drizzle schema (COP-M00 counted 107
 *     of them, created by db:push). Those are reported as unknown, not failed.
 *   - a handler that holds a query in a VARIABLE and then runs a second
 *     .from('other_table') before applying that variable's filters. Attribution
 *     is positional (see tableFor), so those filters are blamed on the second
 *     table. Round 15 hit this while adding a lookup to meter-readings; the fix
 *     was to hoist the lookup above the query it feeds, which is also the
 *     clearer shape. A non-literal .from() no longer reaches backwards, but an
 *     interleaved LITERAL one still does.
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

/**
 * Written into the baseline on every regeneration. See the comment at the
 * writeFileSync below for why it is a constant rather than JSON prose.
 */
const BASELINE_NOTE = [
  'Column literals handed to PostgREST that are not columns on the table the call chain is on.',
  'Each entry is a runtime 42703 waiting for the code path to run. Fix them; do not grow this list.',
  'Regenerate with: npx tsx scripts/check-phantom-columns.ts --update-baseline',
  '',
  'IT HAS GROWN TWICE BY SEEING MORE, NOT BY CODE GETTING WORSE. 152 -> 280 when it stopped skipping',
  'tables declared twice with different shapes (shared/drizzle-schema.ts resolves every collision, so',
  'whatever it exports is the shape the migrations built), and 262 -> 383 when it stopped reading only',
  'INLINE object literals. Most handlers build a payload as a named variable, so `const poData = { … }`',
  'followed by `.insert(poData)` was invisible - that hid the larger half of the purchase-order cluster',
  'and a user-creation insert writing phone, job_title and department, three columns CLAUDE.md already',
  'records as absent from `users`.',
  '',
  'Named payloads resolve to the NEAREST PRECEDING BINDING, used only if that binding is an object',
  'literal. Two looser rules were tried and both invented findings: pooling declarations by name across',
  "a file attributed one table's payload to another table's insert (39 phantom columns on a ten-key",
  'row), and taking the nearest preceding LITERAL reached past `const x = someFn()` to an older literal',
  'of the same name (eighteen more).',
  '',
  'AUDIT-037 carries the backlog. Shrink this list by fixing the code or settling a table collision -',
  'never by re-widening a skip, which would look like progress.',
  '',
  'DO NOT WORK THIS LIST TOP-DOWN. Roughly half of it sits in edge functions that nothing calls (cross',
  'it against docs/unreferenced-edge-fns-baseline.json), where a phantom column cannot hurt anyone and',
  'fixing it is building for a caller that does not exist. The entries worth fixing are the ones in a',
  'REACHABLE function: those are live 42703s under a screen somebody opens.',
].join(' ');
const triage = process.argv.includes('--triage');

// ─── 1. Physical columns, per physical table name ──────────────────────────
//
// Every shared/*.ts is loaded separately, which is how a table declared twice
// with two different shapes is DETECTED. It used to also be the end of the
// story: such a table was marked AMBIGUOUS and skipped, on the reasoning that
// there is no way to know from the code which shape is live.
//
// There is. shared/drizzle-schema.ts is the single entry point drizzle-kit
// reads, and it resolves every collision by hand — picking one declaration and
// SKIPPING the other by name, with a comment saying so. Whatever it exports is
// therefore the shape every migration was generated against, which makes it the
// shape the database has. So an ambiguous table is RESOLVED against that entry
// point, and only a table it does not export stays skipped.
//
// This was not academic. AUDIT-035 found two live defects inside the skip:
// proposal_line_items lost QUOTE-017's recurring columns, so a monthly charge
// saved as a one-time amount, and proposal_templates named ten columns the table
// does not have, so a template could never be created. Both were invisible here
// for as long as the ambiguity was treated as unanswerable.
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
// Resolve the ambiguity against the entry point drizzle-kit actually reads.
const resolvedTables = new Set<string>();
try {
  const entry = (await import(join(repo, 'shared', 'drizzle-schema.ts'))) as Record<
    string,
    unknown
  >;
  for (const value of Object.values(entry)) {
    if (!is(value as any, PgTable)) continue;
    const cfg = getTableConfig(value as any);
    if (!ambiguousTables.has(cfg.name)) continue;
    // The entry point's shape wins outright - the merged union collected above
    // would still contain the losing declaration's columns.
    tableColumns.set(cfg.name, new Set(cfg.columns.map((c) => c.name)));
    resolvedTables.add(cfg.name);
  }
} catch {
  // If the entry point will not load, fall back to skipping every ambiguous
  // table rather than checking against a half-built map.
}
for (const name of ambiguousTables) {
  if (!resolvedTables.has(name)) tableColumns.delete(name);
}
for (const name of resolvedTables) ambiguousTables.delete(name);

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

/** `.from` on these is a JS builtin, not a PostgREST query. */
const NON_QUERY_FROM_RECEIVERS = new Set(['Array', 'Buffer', 'String', 'Uint8Array', 'Object']);

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

/** Nearest preceding .from(...). These handlers build one query at a time, so
 *  the last table named before a filter is the table that filter runs against.
 *
 *  A `.from(someVariable)` names a table this check cannot resolve, so it marks
 *  the position with table: null and everything after it is skipped rather than
 *  attributed to whatever literal happened to come earlier in the file. Without
 *  that, reports/handlers/custom-reports.ts built `db.from(table)` over
 *  business_records and its `.eq('record_type', ...)` was reported against
 *  report_definitions — a filter on a real column, flagged as phantom. The same
 *  staleness hides real defects the other way round, so this is not only noise. */
function tableFor(
  froms: Array<{ index: number; table: string | null }>,
  index: number,
): string | null {
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

/** Every `.from(` that starts a PostgREST chain, in source order.
 *
 *  A quoted argument is the table. Anything else — a variable, a template
 *  literal, a storage bucket — is unresolvable and gets a null entry so that
 *  tableFor() stops rather than reaching back to a stale literal. Array.from and
 *  friends are not query builders and are dropped. */
function collectFroms(source: string): Array<{ index: number; table: string | null }> {
  const out: Array<{ index: number; table: string | null }> = [];
  for (const m of source.matchAll(/(\w+)?\s*\.from\(\s*([^)]*)\)/g)) {
    const receiver = m[1] ?? '';
    if (NON_QUERY_FROM_RECEIVERS.has(receiver)) continue;
    const arg = m[2].trim();
    const literal = /^'([a-z0-9_]+)'$/.exec(arg);
    // A storage bucket is not a table even when it is written as a literal.
    const isStorage = receiver === 'storage';
    out.push({
      index: m.index ?? 0,
      table: literal && !isStorage ? literal[1] : null,
    });
  }

  // helper(client, 'table', (q) => q.eq(...)) — the table is an ARGUMENT and the
  // filters live in a callback, so positional attribution blamed them on
  // whatever .from() came earlier. daily-briefing's countRows() helper produced
  // three such false reports, each naming a column that is real on the table
  // actually queried. The callback region is scoped to the named table, then
  // whatever was in effect before the call is restored at its closing paren.
  for (const m of source.matchAll(/\b\w+\(\s*[\w.]+\s*,\s*'([a-z0-9_]+)'\s*,\s*(?=\()/g)) {
    const table = m[1];
    if (!tableColumns.has(table)) continue;
    const start = m.index ?? 0;
    const end = matchingParen(source, source.indexOf('(', start));
    if (end < 0) continue;
    const restore = tableFor(out, start);
    out.push({ index: start, table });
    out.push({ index: end, table: restore });
  }

  out.sort((a, b) => a.index - b.index);
  return out;
}

/** Index of the ')' closing the '(' at `open`, or -1. */
function matchingParen(source: string, open: number): number {
  if (open < 0) return -1;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '(') depth++;
    else if (source[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Column literals sitting after a `.from(...)` this check could not resolve. */
let unresolved = 0;

function scan(source: string): Ref[] {
  const refs: Ref[] = [];
  const froms = collectFroms(source);
  if (froms.length === 0) return refs;

  const push = (index: number, column: string, kind: string) => {
    if (!looksLikeColumn(column)) return;
    const table = tableFor(froms, index);
    if (!table) {
      // Counted rather than dropped quietly: a column here is unchecked, not
      // proven fine. This is the same class of blind spot as a table missing
      // from the Drizzle schema, and it is reported the same way.
      unresolved++;
      return;
    }
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
    const body = balancedBody(source, (m.index ?? 0) + m[0].length - 1);
    for (const key of topLevelKeys(body)) push(m.index ?? 0, key, m[1]);
  }

  // .insert(payload) / .update(payload) where `payload` is a NAMED VARIABLE.
  //
  // AUDIT-037: this used to be a stated blind spot, and it hid the larger half
  // of the purchase-order cluster - `const poData = { … }` followed by
  // `.insert(poData)` writes nine columns that do not exist, and none was
  // reported while the inline-literal scan was the only one.
  //
  // Resolution is by NEAREST PRECEDING DECLARATION, not by name across the
  // file. `row`, `payload` and `updateData` are reused constantly - one file had
  // four different `const row = {…}` for four different tables - and pooling
  // them by name attributed every table's columns to every insert. That
  // reported 39 phantom columns on a ten-key payload, which is the kind of noise
  // a real finding hides in.
  //
  // Two sources of keys: the object literal the variable is declared with, and
  // any `payload.column = …` assignment BETWEEN that declaration and the call,
  // which is how a handler builds a partial update.
  // EVERY binding of a name is collected, not only the object literals. The
  // nearest preceding one decides, and it is used ONLY if it is a literal - so
  // `const insertRow = normalizeLineItem(...)` resolves to nothing rather than
  // reaching further back to an unrelated `const insertRow = { … }` earlier in
  // the same file. That reach-back attributed one payload to another table's
  // insert and reported eighteen phantom columns that were not there.
  const declarations: { name: string; at: number; keys: string[] | null }[] = [];
  for (const d of source.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*/g)) {
    const at = d.index ?? 0;
    const rhs = at + d[0].length;
    declarations.push({
      name: d[1],
      at,
      keys: source[rhs] === '{' ? topLevelKeys(balancedBody(source, rhs)) : null,
    });
  }
  // A later bare re-assignment invalidates the literal too.
  for (const r of source.matchAll(/^\s*([A-Za-z_$][\w$]*)\s*=\s*(?!=)/gm)) {
    declarations.push({ name: r[1], at: r.index ?? 0, keys: null });
  }

  const assignments: { name: string; at: number; key: string }[] = [];
  for (const a of source.matchAll(/\b([A-Za-z_$][\w$]*)\.([a-z][a-z0-9_]*)\s*=\s*(?!=)/g)) {
    assignments.push({ name: a[1], at: a.index ?? 0, key: a[2] });
  }

  for (const m of source.matchAll(/\.(insert|update)\(\s*([A-Za-z_$][\w$]*)\s*[,)]/g)) {
    const callAt = m.index ?? 0;
    const decl = declarations
      .filter((d) => d.name === m[2] && d.at < callAt)
      .sort((a, b) => b.at - a.at)[0];
    if (!decl || !decl.keys) continue;
    const keys = new Set(decl.keys);
    for (const a of assignments) {
      if (a.name === m[2] && a.at > decl.at && a.at < callAt) keys.add(a.key);
    }
    for (const key of keys) push(callAt, key, m[1]);
  }

  return refs;
}

/**
 * Top-level keys of a brace-balanced object body. A nested object's keys belong
 * to a jsonb value, not to the table.
 */
function topLevelKeys(body: string): string[] {
  const keys: string[] = [];
  let nest = 0;
  for (const km of body.matchAll(/([{}]|(?:^|[,{\n])\s*([a-z][a-z0-9_]*)\s*:)/g)) {
    if (km[1] === '{') nest++;
    else if (km[1] === '}') nest--;
    else if (km[2] && nest === 1) keys.push(km[2]);
  }
  return keys;
}

/** The brace-balanced body starting at the `{` at `start`, inclusive of it. */
function balancedBody(source: string, start: number): string {
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(start, i);
    }
  }
  return '';
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
        // The note lives HERE, not in the JSON. --update-baseline rewrites the
        // file wholesale, so prose added to the baseline by hand is silently
        // lost on the next regeneration - which happened twice before anyone
        // noticed, both times taking the explanation of why the list had grown.
        note: BASELINE_NOTE,
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
    `declared twice with different shapes, ${unknownCount} reference(s), skipped; ` +
    `${unresolved} reference(s) after an unresolved .from(...) also skipped).`,
);
