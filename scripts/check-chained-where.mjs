#!/usr/bin/env node
/**
 * QUALITY-002 / tenant-isolation guard: a drizzle query builder that has
 * .where() applied to it more than once.
 *
 * WHY THIS IS NOT A STYLE RULE. drizzle's where() ASSIGNS the predicate, it does
 * not AND it:
 *
 *     where(where) { ...; this.config.where = where; return this; }
 *     node_modules/drizzle-orm/pg-core/query-builders/select.js:504
 *
 * So the common "start with the tenant scope, then add filters conditionally"
 * shape silently discards the tenant scope the moment any filter applies:
 *
 *     let query = db.select().from(t).where(eq(t.tenantId, tenantId));
 *     if (category) query = query.where(eq(t.category, category));   // <-- tenant gone
 *
 * That is a cross-tenant read, reachable by adding one query parameter. Three
 * were found by hand in one session (routes-product-models list, storage
 * getSystemAlerts, and the pattern below), each masked by an unrelated crash in
 * the same query, which is why none had been reported.
 *
 * tsc catches only the subset where the builder's type has already Omit'd
 * `where` - that happens after .orderBy()/.limit(), not after a bare .where() -
 * so most instances typecheck cleanly. Hence a scanner.
 *
 * The fix is always the same: collect the conditions and pass them to and() once.
 *
 * Usage:
 *   node scripts/check-chained-where.mjs                 # gate
 *   node scripts/check-chained-where.mjs --list          # show every finding
 *   node scripts/check-chained-where.mjs --update-baseline
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const BASELINE = join(ROOT, 'docs', 'chained-where-baseline.json');
const SCAN_DIRS = ['server'];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.ts$/.test(entry) && !/\.test\.ts$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Blank out comments and string/template bodies so a `.where(` inside one is not
 * counted. Line comments first: a doc comment containing a block-comment opener
 * would otherwise swallow the rest of the file.
 */
function blankOut(src) {
  let out = src
    .replace(/^[ \t]*\/\/.*$/gm, (m) => ' '.repeat(m.length))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  // Strings and templates -> same-length blanks, newlines preserved.
  out = out.replace(/(['"`])(?:\\.|(?!\1)[\s\S])*\1/g, (m) => m.replace(/[^\n]/g, ' '));
  return out;
}

const lineOf = (src, index) => src.slice(0, index).split('\n').length;

/**
 * Count where() applications per query-builder variable.
 *
 * Two shapes are counted:
 *   1. `let q = db.select()....where(...)`  - the initializer's own where()
 *   2. `q = q.where(...)`                   - a later re-application
 *
 * A fresh `let`/`const`/`var` binding of the same name resets its count, so two
 * independent queries in one function are not conflated.
 */
function findingsFor(file) {
  const raw = readFileSync(file, 'utf8');
  const src = blankOut(raw);
  const rel = relative(ROOT, file);
  const counts = new Map(); // name -> { applications: number, firstLine: number }
  const findings = [];

  // Declarations that create a builder, with everything up to the terminating ;
  const declRe = /\b(?:let|const|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([\s\S]*?);/g;
  // No line-start anchor: `if (category) q = q.where(...)` is the same bug on one
  // line, and the first version missed it - caught by mutation-testing the
  // detector against the real routes-product-models shape rather than a
  // synthetic one. Requiring the SAME identifier on both sides of the `=` is
  // what keeps this from over-matching.
  const reassignRe = /([A-Za-z_$][\w$]*)\s*=\s*\1\s*\n?\s*\.where\(/g;

  // Walk declarations and reassignments in source order.
  const events = [];
  let m;
  while ((m = declRe.exec(src))) {
    const [, name, init] = m;
    if (!/\bdb\s*\.\s*(?:select|selectDistinct|update|delete)\b/.test(init)) continue;
    events.push({
      kind: 'decl',
      name,
      index: m.index,
      wheres: (init.match(/\.where\(/g) || []).length,
    });
  }
  while ((m = reassignRe.exec(src))) {
    events.push({ kind: 'reassign', name: m[1], index: m.index });
  }
  events.sort((a, b) => a.index - b.index);

  for (const ev of events) {
    if (ev.kind === 'decl') {
      counts.set(ev.name, { applications: ev.wheres, line: lineOf(src, ev.index) });
      continue;
    }
    const state = counts.get(ev.name);
    if (!state) continue; // not a builder we tracked
    state.applications += 1;
    if (state.applications > 1) {
      findings.push(`${rel}:${lineOf(src, ev.index)} ${ev.name}`);
    }
  }

  // A single chained expression carrying two where() calls: .where(a).where(b),
  // possibly with other calls in between.
  //
  // This CANNOT be a regex over a bounded window. The first version used
  // /\.where\([\s\S]{0,400}?\)\s*\.where\(/ and reported 500 sites, nearly all of
  // them two CORRECT single-where queries that happened to sit within 400
  // characters of each other. A lazy quantifier does not respect statement
  // boundaries. So: find the matching close paren, then walk only the calls
  // actually chained onto it.
  for (let i = src.indexOf('.where('); i !== -1; i = src.indexOf('.where(', i + 1)) {
    let j = i + '.where('.length;
    let depth = 1;
    while (j < src.length && depth > 0) {
      if (src[j] === '(') depth++;
      else if (src[j] === ')') depth--;
      j++;
    }
    if (depth !== 0) continue; // unbalanced: give up on this one rather than guess

    // Walk the chain that follows, stopping at anything that is not `.name(`.
    let k = j;
    while (true) {
      while (k < src.length && /\s/.test(src[k])) k++;
      if (src[k] !== '.') break;
      const name = /^\.([A-Za-z_$][\w$]*)\(/.exec(src.slice(k));
      if (!name) break;
      if (name[1] === 'where') {
        findings.push(`${rel}:${lineOf(src, k)} chained`);
        break;
      }
      k += name[0].length;
      depth = 1;
      while (k < src.length && depth > 0) {
        if (src[k] === '(') depth++;
        else if (src[k] === ')') depth--;
        k++;
      }
      if (depth !== 0) break;
    }
  }

  return findings;
}

const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));
const findings = files.flatMap(findingsFor).sort();

/**
 * The baseline is keyed by FILE and COUNT, not by file:line.
 *
 * The first version keyed on file:line and was immediately wrong in practice:
 * storage.ts is 9,000 lines, so editing anything above a known site renumbered
 * it and the gate reported an old finding as new. Verified while
 * mutation-testing - restoring one historical bug reported five findings, four
 * of them line shifts. A per-file count is stable under unrelated edits and
 * still fails on a genuinely new one. Line numbers come from --list, which
 * reads the live tree.
 */
function countByFile(list) {
  const counts = {};
  for (const f of list) {
    const file = f.slice(0, f.lastIndexOf(':'));
    counts[file] = (counts[file] ?? 0) + 1;
  }
  return counts;
}

const current = countByFile(findings);

const args = process.argv.slice(2);
if (args.includes('--update-baseline')) {
  // QUALITY-002: the baseline is closed at 0, so a refresh must never be the way
  // a new chained where() gets accepted. Recording findings here would re-open
  // the class silently, which is exactly how the original 24 accumulated.
  const found = Object.values(current).reduce((a, b) => a + b, 0);
  if (found > 0) {
    console.error(
      `✗ Refusing to baseline ${found} chained-where site(s) across ` +
        `${Object.keys(current).length} file(s). This ratchet is closed at 0.\n` +
        '  Collect the conditions into an array and pass them to and() in one\n' +
        '  where() call, then re-run.\n',
    );
    for (const f of findings) console.error(`    ${f}`);
    process.exit(1);
  }
  writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        note: 'QUALITY-002 chained-.where() ratchet. drizzle where() ASSIGNS rather than ANDs, so a second application discards the first predicate - usually the tenant scope. Each count is the number of queries in that file whose earlier predicate may be silently dropped. Keyed by file rather than file:line so unrelated edits do not renumber entries. Shrink these counts, never grow them: fix by collecting conditions into and(). Regenerate with node scripts/check-chained-where.mjs --update-baseline.',
        counts: current,
      },
      null,
      2,
    ) + '\n',
  );
  const total = Object.values(current).reduce((a, b) => a + b, 0);
  console.log(
    `✓ Baseline updated: ${total} chained-where site(s) across ${Object.keys(current).length} file(s).`,
  );
  process.exit(0);
}

let baseline = {};
try {
  baseline = JSON.parse(readFileSync(BASELINE, 'utf8')).counts ?? {};
} catch {
  baseline = {};
}

// QUALITY-002: the baseline reached 0, so this is a HARD GATE now. Refuse to let
// it grow back — an --update-baseline that would record a non-empty list is
// rejected rather than silently re-opening the class. The 24 originals included
// two real cross-tenant leaks (warehouse kitting operations and auto-invoices,
// where any query filter replaced the tenant predicate outright) and a margin
// report that leaked every tenant's quotes because `.$dynamic()` made the same
// chain type-check.
const baselineTotal = Object.values(baseline).reduce((a, b) => a + b, 0);
if (baselineTotal > 0) {
  console.error(
    `✗ ${BASELINE} is meant to stay empty (QUALITY-002) but records ${baselineTotal} site(s).\n` +
      '  Fix the query instead of baselining it: collect the conditions into an\n' +
      '  array and pass them to and() in a single where() call.',
  );
  process.exit(1);
}

if (args.includes('--list')) {
  for (const f of findings) console.log('  ' + f);
  const total = Object.values(current).reduce((a, b) => a + b, 0);
  console.log(`${total} total across ${Object.keys(current).length} file(s).`);
  process.exit(0);
}

const grown = Object.entries(current).filter(([file, n]) => n > (baseline[file] ?? 0));
const shrunk = Object.entries(baseline).filter(([file, n]) => (current[file] ?? 0) < n);

if (grown.length > 0) {
  console.error('✗ chained .where() count grew:\n');
  for (const [file, n] of grown) {
    console.error(`    ${file}: ${baseline[file] ?? 0} -> ${n}`);
    for (const f of findings.filter((x) => x.startsWith(file + ':'))) console.error(`      ${f}`);
  }
  console.error(
    '\ndrizzle where() ASSIGNS rather than ANDs, so the earlier predicate - usually\n' +
      'the tenant scope - is discarded. Collect the conditions and pass them to\n' +
      'and() once. See scripts/check-chained-where.mjs for the mechanism.',
  );
  process.exit(1);
}

const total = Object.values(current).reduce((a, b) => a + b, 0);
console.log(
  `✓ No new chained .where() calls (${total} baselined across ${Object.keys(current).length} file(s)` +
    (shrunk.length ? `; ${shrunk.length} file(s) improved - tighten with --update-baseline` : '') +
    ').',
);
