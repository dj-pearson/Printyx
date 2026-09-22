#!/usr/bin/env node
/**
 * A bulk write reports what the database did, never what the caller asked for.
 *
 * Round 132: five endpoints across both hosts answered `deletedCount:
 * ids.length` - the number of ids in the REQUEST. Every one of them filters by
 * `tenant_id`, so an id from another tenant, or one a colleague removed thirty
 * seconds earlier, matched nothing and the response still said "Successfully
 * deleted 20 invoices". The page on top of the invoice one then toasted
 * `ids.length` as well, so the same fiction ran through all three layers.
 *
 * This is round 78's fabricated WRITE outcome in its bulk form, and none of the
 * three fabrication guards can see it: there is no `|| literal`, no
 * `Math.random()` and no static JSX, because THE SUCCESS IS THE EVIDENCE. The
 * correct pattern was already in the tree twice (`product-models` and
 * `software-products` take the length of what the write RETURNED), which is why
 * this is a gate rather than a ratchet: there is no correct version of counting
 * the request.
 *
 * THE RULE: a response field named `<verb>Count` / `deleted` / `updated` in a
 * handler that performs a bulk write must not be assigned from a `.length` of
 * something derived from the request. It must come from the write's own result.
 *
 * STATED BLIND SPOTS, so a green run is not read as more than it is:
 *   - A count laundered through an intermediate variable whose name does not
 *     mention ids (`const n = payload.rows.length; ... deletedCount: n`).
 *   - A bulk endpoint that reports no count at all - honest, and invisible here.
 *   - The `updatedCount: ids.length` shapes that are CORRECT because an
 *     existence check above them 400s on any id the tenant cannot reach; those
 *     are recognised by the check, not baselined.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOTS = ['server', 'supabase/functions'];

/** Below this the walk is not reading the tree it claims to read. */
export const MIN_CORPUS = 200;

export function stripComments(src) {
  const noLine = src.replace(/(?<![:/])\/\/[^\n]*/g, '');
  return noLine.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

/** Response keys that state how many rows a write touched. */
const COUNT_KEYS = /(?:^|[^a-zA-Z])(deletedCount|updatedCount|affectedCount|deleted|updated)\s*:/;

/**
 * A count is FABRICATED when its value is `<something>.length` and that
 * something is reachable from the request rather than from the write.
 *
 * Bound to the assignment, not to a window: the value is everything between the
 * key and the comma or brace that ends it.
 */
export function findFabricatedCounts(src) {
  const code = stripComments(src);
  const out = [];
  const keyRe = new RegExp(COUNT_KEYS.source, 'g');
  for (const m of code.matchAll(keyRe)) {
    const key = m[1];
    const valueStart = m.index + m[0].length;
    // The value ends at the first comma or closing brace at this nesting level.
    let depth = 0;
    let end = valueStart;
    while (end < code.length) {
      const c = code[end];
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') {
        if (depth === 0) break;
        depth--;
      } else if (c === ',' && depth === 0) break;
      end++;
    }
    const value = code.slice(valueStart, end).trim();
    if (!/\.length\b/.test(value)) continue;
    // `x.length` where x names the request's ids rather than the write's result.
    if (/\b(ids|dealIds|recordIds|itemIds|batch|requested|parsed)\b/i.test(value)) {
      const line = code.slice(0, m.index).split('\n').length;
      out.push({ key, value, line });
    }
  }
  return out;
}

export function sourceFiles() {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (entry === 'node_modules' || entry === 'tests' || entry === '__tests__') continue;
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (/\.ts$/.test(entry) && !/\.test\.ts$/.test(entry)) files.push(full);
    }
  };
  for (const root of ROOTS) walk(root);
  return files.sort();
}

export function scan() {
  const files = sourceFiles();
  const findings = [];
  for (const file of files) {
    // This script and its own test necessarily contain the banned shape.
    if (/check-bulk-write-counts/.test(file)) continue;
    for (const hit of findFabricatedCounts(readFileSync(file, 'utf8'))) {
      findings.push({ file, ...hit });
    }
  }
  return { corpus: files.length, findings };
}

function main() {
  const { corpus, findings } = scan();

  if (corpus < MIN_CORPUS) {
    console.error(
      `check:bulk-write-counts - only ${corpus} source file(s) walked (expected >= ${MIN_CORPUS}).`,
    );
    process.exit(2);
  }

  if (findings.length > 0) {
    console.error(
      `check:bulk-write-counts - ${findings.length} bulk write(s) report the REQUEST rather than the result:\n`,
    );
    for (const f of findings) {
      console.error(`  ${f.file}:${f.line}  ${f.key}: ${f.value}`);
    }
    console.error(
      '\nTake the count from what the write returned - `.returning({ id })` on Drizzle,\n' +
        "`.delete().select('id')` on PostgREST - and summarise it through\n" +
        '`summariseBulkWrite` in shared/bulk-result.ts so both hosts answer the same shape.',
    );
    process.exit(1);
  }

  console.log(
    `✓ check:bulk-write-counts - no bulk write reports a count taken from its request (${corpus} files).`,
  );
}

const isEntryPoint =
  !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntryPoint) main();
