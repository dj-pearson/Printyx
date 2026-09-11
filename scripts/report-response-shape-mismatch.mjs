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
 * WHY A REPORT. The shape half cannot tell WHICH branch serves a given sub-path,
 * so a function that returns an array from one branch and an envelope from
 * another satisfies it either way. That is exactly the platform CRM's shape -
 * contacts returns a bare array while deals returns an envelope - so a gate
 * built on that rule alone would have missed SHAPE-ENVELOPE-001 and would fail
 * on correct code elsewhere.
 *
 * The branch half answers a narrower question soundly: does ANY branch of the
 * function name this sub-path at all? A "no" is a 404 in production, and dev
 * may well answer it from Express, which is how both real findings survived.
 * Its segment scan is deliberately LENIENT - every token in the source, not
 * just quoted literals - because a branch is written half a dozen ways here
 * (`resource === 'x'`, `path === '/x'`, a regex, a dispatch table), and an
 * anchored scan reported proposals as not serving /proposal-templates when it
 * matches `path === '/proposal-templates'`. A false negative costs a finding; a
 * false positive costs trust in the whole report.
 *
 * ALL 13 OF THE OLD CANDIDATES WERE READ BY HAND (SHAPE-ENVELOPE-002) AND NOT
 * ONE WAS A SHAPE MISMATCH. Nine were customer-portal and platform list pages
 * whose endpoints DO send `{ success, data: [...] }` - two script bugs between
 * them: `data:` was required to be the FIRST key in the envelope, and a response
 * body that is a plain identifier (`createCorsResponse(csms, 200, req)`) was
 * read as "sends no array" when the array is simply built above the return.
 * Identifier bodies are UNRESOLVED now, not evidence. Two were orphan files.
 * Two were real, and neither was a shape problem: ServiceAnalytics and
 * EquipmentTransitionHistory ask for paths no branch of their edge function
 * serves, which is why the branch narrowing below is the part of this script
 * that earns its keep. One live defect it did NOT report was found while
 * checking the others - customer-portal's knowledge-base branch nests its list
 * under `data: { articles }`, and the page read the whole envelope as an array,
 * so the Help Center tab threw rather than rendering. A `queryFn` makes a query
 * invisible here, and that is where it hid.
 *
 * The earlier rounds, kept because each is still a rule this needs:
 * The first run said 42; five rounds of checking findings against the source
 * removed 29 of them, and every one was a rule this script did not know yet:
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
  let opaque = false;
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
        // `data:` need not be the FIRST key. customer-portal answers
        // `{ success: true, data: [...] }`, which an anchored pattern misses -
        // it reported all five of that function's list pages as sending no
        // array. The negative lookahead keeps `data: {` out: an object under
        // `data` is NOT unwrapped, and the knowledge-base branch returning
        // `data: { articles, categories }` is exactly the live defect this
        // report exists to catch.
        const dataEnvelope = new RegExp(
          `${RESP}\\(\\s*\\{[^{}]{0,200}?\\bdata\\s*:\\s*(?!\\{)`,
        ).test(src);
        // A RESPONSE BODY THAT IS A PLAIN IDENTIFIER SAYS NOTHING. `users`
        // answers `createCorsResponse(transformedUsers, 200, req)` and
        // `platform-cs` answers `createCorsResponse(csms, 200, req)` - both bare
        // arrays, both reported as "never sends an array" because the array is
        // built above the return. Resolving the variable is a data-flow problem;
        // until it is solved these are UNRESOLVED, which is the honest answer,
        // and they are counted rather than silently dropped.
        const identifierBody = new RegExp(`${RESP}\\(\\s*[A-Za-z_$][\\w$]*\\s*,`).test(src);
        if (bareArray || dataEnvelope) found = true;
        if (identifierBody) opaque = true;
      }
    }
  })(dir);
  // "Yes" wins over "cannot tell": a function with one literal array branch
  // answers the question whatever else it does.
  const verdict = found ? true : opaque ? null : false;
  returnsArray.set(fnDir, verdict);
  return verdict;
}

/**
 * Every static path segment any branch of a function tests for.
 *
 * This is the branch narrowing SHAPE-ENVELOPE-002 carries, at the only
 * resolution that is cheap and sound: which sub-paths the function knows about
 * at all. It does not say WHICH branch serves a path - that needs the dispatch
 * graph - but "no branch anywhere names this segment" is a finding on its own,
 * and a stronger one than a shape mismatch: the request 404s rather than
 * rendering wrong. Both real defects this found were that shape, and both were
 * invisible in dev because Express served them there.
 */
const segmentsByFn = new Map();
function knownSegments(fnDir) {
  if (segmentsByFn.has(fnDir)) return segmentsByFn.get(fnDir);
  const dir = path.join('supabase/functions', fnDir);
  if (!fs.existsSync(dir)) {
    segmentsByFn.set(fnDir, null);
    return null;
  }
  const segs = new Set();
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
        // Every hyphenated-or-plain token in the source, not just quoted ones.
        // A branch is written half a dozen ways here - `resource === 'x'`,
        // `path === '/x'`, `/^\/x\/([^/]+)$/`, a key in a dispatch table - and
        // an anchored quoted-literal scan reported proposals as not serving
        // /proposal-templates when it matches `path === '/proposal-templates'`
        // six lines apart. Leniency is the right error here: the claim being
        // made is "no branch names this AT ALL", so a false negative costs a
        // finding while a false positive costs trust in the whole report.
        for (const tok of src.matchAll(/[a-z][a-z0-9-]{1,60}/gi)) segs.add(tok[0].toLowerCase());
      }
    }
  })(dir);
  segmentsByFn.set(fnDir, segs);
  return segs;
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
const missing = [];
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

    const km = body.match(/queryKey\s*:\s*\[\s*[`'"](\/api\/[a-z0-9-]+)((?:\/[^`'"?\s]*)*)/i);
    if (!km) continue;
    const seg = km[1].replace('/api/', '');
    // First static sub-segment, if the key has one. `${...}` and anything with
    // an interpolation in it is skipped - that is an id, not a branch name.
    const subPath = (km[2] ?? '')
      .split('/')
      .filter(Boolean)
      .find((part) => /^[a-z][a-z0-9-]*$/.test(part));

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
    const line = src.slice(0, m.index).split('\n').length;

    if (subPath) {
      const segs = knownSegments(seg);
      if (segs && !segs.has(subPath)) {
        missing.push(
          `${file}:${line}  /api/${seg}/${subPath} - no branch of supabase/functions/${seg}/ names "${subPath}"`,
        );
        continue;
      }
    }

    const arrayCapable = functionReturnsBareArray(seg);
    if (arrayCapable === null) {
      unresolved++;
      continue;
    }
    if (arrayCapable) continue;

    findings.push(
      `${file}:${line}  reads /api/${seg} as an array; that function has no branch returning one`,
    );
  }
}

if (missing.length) {
  console.log('NO BRANCH SERVES THIS PATH (404 in production; dev may still answer from Express):');
  for (const f of missing) console.log('  ' + f);
  console.log('');
}
if (findings.length) console.log('SHAPE MISMATCH CANDIDATES:');
for (const f of findings) console.log('  ' + f);
console.log(
  `\n${missing.length} path(s) no branch serves; ${findings.length} page(s) read an array from a` +
    ` function that never sends one. ${checked} array-reading queries checked,` +
    ` ${unresolved} unresolvable (no matching function directory, or a response body that is a` +
    ` variable rather than a literal).`,
);
console.log(
  'REPORT ONLY: a function returning an array from one branch and an envelope from another\n' +
    'satisfies this either way. Narrowing to the branch is SHAPE-ENVELOPE-002.',
);
