#!/usr/bin/env tsx
/**
 * Spread-insert key checker.
 *
 * tsc checks the keys you write DIRECTLY in a `.values({...})` literal, but a
 * spread turns excess-property checking off for everything it carries:
 *
 *   const rows = [{ id, name: 'Acme', companyId }];   // <- no table in sight
 *   for (const row of rows) {
 *     await db.insert(companies).values({ ...row, tenantId }).onConflictDoNothing();
 *   }
 *
 * `tenantId` is checked. `name` and `companyId` are not, and drizzle DROPS keys
 * it does not recognise — `.values()` iterates the TABLE's columns and picks
 * each one out of the object, so an unknown key is silently ignored exactly the
 * way `.set()` ignores one. The row still inserts. It is just missing the data,
 * or it violates a NOT NULL that the dropped key was supposed to fill.
 *
 * That is how server/seeds/seed-all-demo-data.ts came to write `name` on a
 * table whose column is `business_name`: `npm run seed:demo` died on a NOT NULL
 * violation at phase 2, and every phase after it was unreachable.
 *
 * WHAT IT CANNOT SEE, so a pass is not read as proof of correctness:
 *   - a spread of anything but a `for (const x of ARRAY_LITERAL)` loop variable
 *     declared in the same file (function args, mapped rows, `...req.body`).
 *   - keys assembled at runtime, and computed keys.
 *   - tables that are not a bare identifier at the `.insert(...)` call site.
 *   - tables declared twice with different shapes, which are skipped rather
 *     than guessed at.
 *
 * Baseline: docs/spread-insert-keys-baseline.json. Fix them or record them; the
 * count may not grow.
 */
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { is, getTableColumns } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';

const repo = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const BASELINE = join(repo, 'docs', 'spread-insert-keys-baseline.json');
const update = process.argv.includes('--update-baseline');

// ─── 1. exported table identifier -> its drizzle property names ────────────
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
      walk(full, out);
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

const tableProps = new Map<string, Set<string>>();
const ambiguous = new Set<string>();

const schemaFiles = readdirSync(join(repo, 'shared'))
  .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'drizzle-schema.ts')
  .sort();

for (const file of schemaFiles) {
  let mod: Record<string, unknown>;
  try {
    mod = (await import(join(repo, 'shared', file))) as Record<string, unknown>;
  } catch {
    continue;
  }
  for (const [exportName, value] of Object.entries(mod)) {
    if (!is(value as never, PgTable)) continue;
    const props = new Set(Object.keys(getTableColumns(value as never)));
    const seen = tableProps.get(exportName);
    if (seen) {
      // Same identifier re-exported from two modules with a different shape:
      // there is no way to tell which one a call site meant.
      const same = seen.size === props.size && [...props].every((p) => seen.has(p));
      if (!same) ambiguous.add(exportName);
    }
    tableProps.set(exportName, props);
  }
}
for (const name of ambiguous) tableProps.delete(name);

// ─── 2. object-literal key scanning ────────────────────────────────────────
const IDENT = /[A-Za-z_$][\w$]*/y;

/** Walk from the index of an opening brace/bracket to its match, honouring
 *  strings, template literals and comments. Returns the closing index. */
function matchDelimiter(src: string, open: number): number {
  const pairs: Record<string, string> = { '{': '}', '[': ']', '(': ')' };
  const stack: string[] = [pairs[src[open]]];
  let i = open + 1;
  while (i < src.length && stack.length) {
    const ch = src[i];
    if (ch === '/' && src[i + 1] === '/') {
      i = src.indexOf('\n', i);
      if (i === -1) return src.length - 1;
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? src.length : end + 2;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      i += 1;
      while (i < src.length && src[i] !== ch) i += src[i] === '\\' ? 2 : 1;
      i += 1;
      continue;
    }
    if (ch === '{' || ch === '[' || ch === '(') stack.push(pairs[ch]);
    else if (ch === '}' || ch === ']' || ch === ')') {
      if (ch !== stack[stack.length - 1]) return -1; // unbalanced; give up
      stack.pop();
    }
    i += 1;
  }
  return i - 1;
}

/** Keys and `...spreads` written at depth 1 of the object literal whose opening
 *  brace is at `open`. */
function objectMembers(src: string, open: number): { keys: string[]; spreads: string[] } {
  const close = matchDelimiter(src, open);
  const keys: string[] = [];
  const spreads: string[] = [];
  if (close < 0) return { keys, spreads };
  let i = open + 1;
  let depth = 0;
  while (i < close) {
    const ch = src[i];
    if (ch === '/' && src[i + 1] === '/') {
      const nl = src.indexOf('\n', i);
      i = nl === -1 ? close : nl;
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? close : end + 2;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      let j = i + 1;
      while (j < close && src[j] !== quote) j += src[j] === '\\' ? 2 : 1;
      // A quoted key at depth 0 is still a key.
      if (depth === 0) {
        let k = j + 1;
        while (k < close && /\s/.test(src[k])) k += 1;
        if (src[k] === ':') keys.push(src.slice(i + 1, j));
      }
      i = j + 1;
      continue;
    }
    if (ch === '{' || ch === '[' || ch === '(') {
      depth += 1;
      i += 1;
      continue;
    }
    if (ch === '}' || ch === ']' || ch === ')') {
      depth -= 1;
      i += 1;
      continue;
    }
    if (depth === 0 && ch === '.' && src.slice(i, i + 3) === '...') {
      IDENT.lastIndex = i + 3;
      const m = IDENT.exec(src);
      if (m) spreads.push(m[0]);
      i += 3;
      continue;
    }
    if (depth === 0 && /[A-Za-z_$]/.test(ch)) {
      IDENT.lastIndex = i;
      const m = IDENT.exec(src);
      if (m) {
        let k = IDENT.lastIndex;
        while (k < close && /\s/.test(src[k])) k += 1;
        if (src[k] === ':') keys.push(m[0]);
        i = IDENT.lastIndex;
        continue;
      }
    }
    i += 1;
  }
  return { keys, spreads };
}

/** Union of the depth-1 keys of every object literal directly inside the array
 *  whose opening bracket is at `open`. */
function arrayEntryKeys(src: string, open: number): Set<string> {
  const close = matchDelimiter(src, open);
  const keys = new Set<string>();
  if (close < 0) return keys;
  let i = open + 1;
  while (i < close) {
    if (src[i] === '{') {
      for (const key of objectMembers(src, i).keys) keys.add(key);
      const end = matchDelimiter(src, i);
      i = end < 0 ? close : end + 1;
      continue;
    }
    i += 1;
  }
  return keys;
}

// ─── 3. scan ───────────────────────────────────────────────────────────────
type Finding = { file: string; line: number; table: string; key: string };
const findings: Finding[] = [];
const roots = ['server', 'scripts'].map((d) => join(repo, d)).filter((d) => existsSync(d));
const selfPath = fileURLToPath(import.meta.url);
const files = roots.flatMap((d) => walk(d)).filter((f) => f !== selfPath);

for (const full of files) {
  const src = readFileSync(full, 'utf8');
  if (!src.includes('.values(')) continue;
  const rel = relative(repo, full).split('\\').join('/');

  // const NAME = [ ... ];  ->  the keys its entries carry
  const arrays = new Map<string, Set<string>>();
  for (const m of src.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*\[/g)) {
    arrays.set(m[1], arrayEntryKeys(src, m.index + m[0].length - 1));
  }
  // for (const V of NAME)  ->  V carries NAME's keys
  const loopVars = new Map<string, string>();
  for (const m of src.matchAll(
    /for\s*\(\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s+of\s+([A-Za-z_$][\w$]*)\s*\)/g,
  )) {
    loopVars.set(m[1], m[2]);
  }

  for (const m of src.matchAll(/\.insert\(\s*([A-Za-z_$][\w$]*)\s*\)/g)) {
    const table = m[1];
    const props = tableProps.get(table);
    if (!props) continue; // unknown or ambiguous table: not our story
    const valuesAt = src.indexOf('.values(', m.index);
    if (valuesAt === -1 || valuesAt - m.index > 400) continue;
    let brace = valuesAt + '.values('.length;
    while (brace < src.length && /\s/.test(src[brace])) brace += 1;
    if (src[brace] !== '{') continue; // .values(variable) — nothing literal to read
    const { spreads } = objectMembers(src, brace);
    const seen = new Set<string>();
    for (const spread of spreads) {
      const arrayName = loopVars.get(spread);
      if (!arrayName) continue; // spread we cannot resolve
      const keys = arrays.get(arrayName);
      if (!keys) continue;
      for (const key of keys) {
        if (props.has(key) || seen.has(key)) continue;
        seen.add(key);
        findings.push({
          file: rel,
          line: src.slice(0, brace).split('\n').length,
          table,
          key,
        });
      }
    }
  }
}

// ─── 4. ratchet ────────────────────────────────────────────────────────────
// Keyed by file + table + key, never by line: these files get reformatted and a
// line-keyed baseline churns on every edit.
const ids = findings.map((f) => `${f.file}::${f.table}.${f.key}`).sort();

if (update) {
  writeFileSync(BASELINE, JSON.stringify({ known: ids }, null, 2) + '\n');
  console.log(`Baseline updated: ${ids.length} known spread-insert key(s).`);
  process.exit(0);
}

const known: string[] = existsSync(BASELINE)
  ? (JSON.parse(readFileSync(BASELINE, 'utf8')).known ?? [])
  : [];
const knownSet = new Set(known);
const fresh = findings.filter((f) => !knownSet.has(`${f.file}::${f.table}.${f.key}`));

if (fresh.length) {
  console.error(`\n✗ ${fresh.length} spread-insert key(s) that are not columns:\n`);
  for (const f of fresh) {
    console.error(`  ${f.file}:${f.line}  ${f.table} has no column '${f.key}' — drizzle drops it`);
  }
  console.error(
    `\nFix them, or record them with: node --import tsx scripts/check-spread-insert-keys.ts --update-baseline\n`,
  );
  process.exit(1);
}

console.log(
  `✓ No new spread-insert keys outside the table's columns (${ids.length} baselined, ${files.length} file(s) scanned).`,
);
