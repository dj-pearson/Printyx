#!/usr/bin/env node
/**
 * REPORT, not a gate. Pages that treat a query result as an ARRAY where the
 * edge function serving that path returns an OBJECT.
 *
 * This is the seam PA-040 named and nothing watches: check:fabricated wants a
 * `|| literal`, check:no-static-posture wants a literal in JSX,
 * check:no-random-metrics wants Math.random(). None of them compares the keys a
 * page reads against the keys its endpoint sends, and the failure mode is
 * always the same - the page renders an empty state, nothing throws, nothing
 * logs, and both environments agree because both are wrong.
 *
 * Three instances have been found by hand so far: PlatformCohortAnalysis (the
 * page read cohortTable/revenueCohorts while the endpoint sent cohorts/summary),
 * the analytics widgets, and SHAPE-ENVELOPE-001 - where the Deals, Activities
 * and Health tabs of the platform record pages rendered "none" for every tenant
 * because { deals, pagination } was read as an array.
 *
 * THE KEY NAME IS THE WHOLE THING. getQueryFn auto-unwraps a response shaped
 * `{ data: [...] }` and returns the inner array, so every endpoint using the
 * key `data` - vendors, supplies, billing and most of the list surface - is
 * FINE, and an array-reading page against one of those is correct. It unwraps
 * NOTHING ELSE. `{ deals: [...] }`, `{ activities: [...] }`,
 * `{ healthScores: [...] }` arrive as objects, which is precisely why
 * SHAPE-ENVELOPE-001 was real while the vendors and supplies pages are not.
 *
 * Without that distinction this script reported 42 findings, nearly all of them
 * false. It reports a handful now, and they are the shape that actually breaks.
 *
 * HOW IT DECIDES. Page side: a useQuery with a literal /api/... key whose result
 * is used with .map/.filter/.reduce/.length, or typed <T[]>. Endpoint side:
 * resolve /api/<seg> to supabase/functions/<seg>/, and ask whether ANY branch
 * there answers with something the client will see as an array - a bare array,
 * or a `{ data: <array> }` envelope that getQueryFn unwraps. If none does, an
 * array-reading page is worth looking at.
 *
 * WHY A REPORT. The branch-level mapping is not built: the script cannot tell
 * WHICH branch serves a given sub-path, so a function that returns an array from
 * one branch and an envelope from another satisfies it either way. That is
 * exactly the platform CRM's shape - contacts returns a bare array while deals
 * returns an envelope - so a gate built on this rule would have missed
 * SHAPE-ENVELOPE-001 and would fail on correct code elsewhere. Narrowing it to
 * the branch is the work SHAPE-ENVELOPE-002 still carries.
 *
 * THE 13 IT REPORTS ARE CANDIDATES, NOT CONFIRMED DEFECTS. Each still needs the
 * branch read by hand. The first run said 42; five rounds of checking findings
 * against the source removed 29 of them, and every one was a rule this script
 * did not know yet:
 *
 *   1. getQueryFn auto-unwraps `{ data: [...] }` and nothing else.
 *   2. Two response helpers are in use - createCorsResponse AND jsonResponse.
 *   3. `useQuery<{ data: Level[] }>` is a correctly typed envelope; a bare
 *      /\[\]$/ matches the [] inside it.
 *   4. `group.levels.map()` is not a read of a query variable named `levels`.
 *   5. A `select:` transform reshapes the response on purpose.
 *
 * That ratio is the argument for keeping this a report. A gate built on the
 * first cut would have blocked 29 correct pages.
 *
 * Usage: node scripts/report-response-shape-mismatch.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const strip = (s) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n');

/** Does this edge function ever answer a GET with a bare array? */
const returnsArray = new Map();
function functionReturnsBareArray(fnDir) {
  if (returnsArray.has(fnDir)) return returnsArray.get(fnDir);
  const dir = path.join('supabase/functions', fnDir);
  if (!fs.existsSync(dir)) {
    returnsArray.set(fnDir, null); // unresolvable, not a finding
    return null;
  }
  let found = false;
  (function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (p.endsWith('.ts')) {
        let src;
        try {
          src = strip(fs.readFileSync(p, 'utf8'));
        } catch {
          continue;
        }
        // createCorsResponse(<array-ish>, 200 ...) - a bare array, a ?? [], a
        // toCamel(...) of rows, or a mapped list.
        // A bare array, or a `data:` envelope - getQueryFn unwraps the latter
        // and ONLY the latter, so `{ deals: [...] }` is not the same thing.
        // TWO RESPONSE HELPERS. createCorsResponse and jsonResponse are both in
        // use - proposals, tasks and the knowledge-base handlers use the second
        // one - and scanning for only the first reported every function using
        // the other as returning nothing at all.
        const RESP = '(?:createCorsResponse|jsonResponse)';
        // Allow a parenthesised expression before .map( - accessories answers
        // `createCorsResponse(((data as Row[]) || []).map(camelRow), ...)`, which
        // a pattern anchored to an identifier misses.
        const bareArray = new RegExp(
          `${RESP}\\(\\s*(?:\\[|\\(*[A-Za-z_$][\\w$.]*[\\s\\S]{0,60}?\\s*(?:\\?\\?|\\|\\|)\\s*\\[\\]|toCamel\\(|camelRows\\(|\\(*[A-Za-z_$][\\w$.]*[^;]{0,60}?\\.map\\()`,
        ).test(src);
        const dataEnvelope = new RegExp(`${RESP}\\(\\s*\\{\\s*\\n?\\s*data\\s*:`).test(src);
        if (bareArray || dataEnvelope) found = true;
      }
    }
  })(dir);
  returnsArray.set(fnDir, found);
  return found;
}

const pages = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.tsx$/.test(p)) pages.push(p);
  }
})('client/src');

const findings = [];
let checked = 0;
let unresolved = 0;

for (const file of pages) {
  const src = strip(fs.readFileSync(file, 'utf8'));
  const re = /useQuery\s*(?:<([^>]*)>)?\s*\(\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    const generic = (m[1] ?? '').trim();
    const start = re.lastIndex - 1;
    let d = 0;
    let end = -1;
    for (let i = start; i < src.length; i++) {
      if (src[i] === '{') d++;
      else if (src[i] === '}' && --d === 0) {
        end = i;
        break;
      }
    }
    if (end < 0) continue;
    const body = src.slice(start, end + 1);
    if (/queryFn\s*:/.test(body)) continue; // decides its own shape
    // A `select` transform reshapes the response on purpose - the array methods
    // downstream run on the SELECTED value, not the raw one. PlatformCustomerSuccess
    // maps the envelope through mapTenants() and was reported twice for it.
    if (/\bselect\s*:/.test(body)) continue;

    const km = body.match(/queryKey\s*:\s*\[\s*[`'"](\/api\/[a-z0-9-]+)/i);
    if (!km) continue;
    const seg = km[1].replace('/api/', '');

    // Does the page treat it as an array?
    // Bind the name from THIS statement only. Looking back a fixed number of
    // characters reaches into the previous useQuery and picks up its variable,
    // which reported LeaseForm's single-lease fetch as an array read because the
    // `customers` query sat above it. Cut at the nearest `const`.
    const lookback = src.slice(Math.max(0, m.index - 200), m.index);
    const stmt = lookback.slice(lookback.lastIndexOf('const '));
    const nm = stmt.match(/data\s*:\s*([A-Za-z_$][\w$]*)/);
    const name = nm?.[1];
    // TOP-LEVEL array only. `useQuery<{ data: Level[] }>` is a correctly typed
    // envelope, and a bare /\[\]$/ matches the [] inside it - which reported
    // TonerReplenish, where the page already reads the shape properly.
    const typedArray = /\[\]\s*$/.test(generic) && !generic.trim().startsWith('{');
    const usedAsArray =
      name &&
      new RegExp(
        // (?<![.\w$]) so `group.levels.map(...)` does not count as a read of a
        // query variable that happens to share the name `levels`.
        `(?<![.\\w$])${name}\\s*(?:\\?\\.|\\.)\\s*(?:map|filter|reduce|length|some|every)\\b`,
      ).test(src);
    if (!typedArray && !usedAsArray) continue;

    checked++;
    const arrayCapable = functionReturnsBareArray(seg);
    if (arrayCapable === null) {
      unresolved++;
      continue;
    }
    if (arrayCapable) continue;

    findings.push(
      `${file}:${src.slice(0, m.index).split('\n').length}  reads /api/${seg} as an array; that function has no branch returning one`,
    );
  }
}

for (const f of findings) console.log('  ' + f);
console.log(
  `\n${findings.length} page(s) read an array from a function that never sends one.` +
    ` ${checked} array-reading queries checked, ${unresolved} unresolvable (no matching function directory).`,
);
console.log(
  'REPORT ONLY: a function returning an array from one branch and an envelope from another\n' +
    'satisfies this either way. Narrowing to the branch is SHAPE-ENVELOPE-002.',
);
