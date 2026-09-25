#!/usr/bin/env node
/**
 * Edge-path coverage guard (PROD-014).
 *
 * A domain can have an edge function and still 404 in production on most of
 * what the frontend calls it for. `check:routes` classifies per DOMAIN, so it
 * reports such a domain as "both divergent" and moves on. This looks INSIDE the
 * domain: for every literal sub-path a reachable client file calls
 * (/api/<domain>/<segment>), does that segment appear anywhere in the domain's
 * edge function source?
 *
 * PA-025 EXTENDED IT PAST AN ID. The original regex captured one segment and
 * `isLiteralSegment` rejected anything holding a `$` or `{`, so a call shaped
 *
 *     `/api/equipment/${id}/meter-readings`
 *
 * was dropped ENTIRELY: the placeholder failed the literal test and the
 * `meter-readings` behind it was never looked at. That is the PA-020 defect
 * class - a sub-resource after an id - and it is the worst-behaved one, because
 * such a request does not 404. The handler reads parts[0] as the id, never
 * looks at parts[1], and answers 200 WITH THE PARENT OBJECT. A component
 * mapping over it renders an empty list and reports nothing. PA-020 found five
 * tabs like that on one page; this found the same shape live in `equipment`.
 *
 * A path is now normalized to a SHAPE - `${...}` and `:param` become `:id` -
 * and every literal segment AFTER the first placeholder is checked. Baseline
 * entries are shape strings, so `equipment/:id/meter-readings` sits beside the
 * older depth-1 `admin/audit-logs` in the same list. A literal at depth 1 is
 * deliberately NOT re-reported through this path; the original branch owns it,
 * and reporting both would put one defect in the baseline twice.
 *
 * A segment that appears nowhere is not proof of a 404 — a handler could
 * dispatch on a variable — but every real defect found this way had the same
 * shape, and the shape is worse than a 404 when the request falls through to a
 * generic branch instead:
 *
 *   DELETE /product-models/bulk-delete  -> delete where id = 'bulk-delete'
 *   POST   /invoices/bulk-delete        -> the CREATE-invoice branch
 *
 * `id` is a varchar, so the first matched no row, PostgREST reported no error,
 * and the user was told the bulk delete succeeded.
 *
 * WF-G-05 ADDED THE METHOD, AND THE BARE PREFIX WITH IT. Everything above keys
 * on a NAMED SEGMENT after the domain, so a page whose list and create calls hit
 * the prefix itself was invisible: `useQuery(['/api/warehouse-operations'])` and
 * `apiRequest('/api/warehouse-operations', 'POST', data)` carry no segment to
 * look for. EDGE-002h audited that domain and reported only `/stats` missing,
 * because the bare GET and the bare POST could not be seen - and both were in
 * fact absent until WF-L-03 added them.
 *
 * So a bare call is now recorded as a method: the page's verb decides which
 * branch has to exist, and `GET /x` and `POST /x` are different endpoints that
 * happen to share a URL. An entry reads `warehouse-operations/#POST`; the `#`
 * keeps it from ever colliding with a segment name.
 *
 * SCOPED TO THE BARE PREFIX, NOT TO `/:id`, and that is deliberate. AC1 lists
 * four shapes; two of them are already covered - a literal after a placeholder
 * is what PA-025 added above - and a bare `/:id` is genuinely ambiguous, because
 * the id branch is usually the FALLTHROUGH rather than a branch of its own.
 * Reporting it would mean reporting almost every domain, which is the kind of
 * noise a real finding hides in.
 *
 * WHAT COUNTS AS A BRANCH, and it is generous on purpose. A method test paired
 * with an emptiness test anywhere in the same condition: `!endpoint`,
 * `!secondSegment`, `parts.length === 0`, `!parts[0]`. A false NEGATIVE here
 * costs a missed report; a false positive de-gates a domain that is actually
 * broken, which is the worse trade and is what the word-boundary rule above
 * already got wrong once.
 *
 * PROD-008 WIDENED THE CORPUS, AND THAT IS WHY THE BASELINE GREW. Everything
 * above reads `client/src` and nothing else, because computeParity - which this
 * shares with check:routes - walks that one tree. This repo ships SEVEN more
 * clients (printyx-client, printyx-desktop, mobile-app, mobile,
 * browser-extensions, printyx-extension and the iOS project), and
 * check:unreferenced-edge-fns already had to learn that lesson once: reading
 * client/src alone reported five functions as unreferenced that the iOS app
 * calls. The same blind spot hid a live defect here. iOS posts to
 * /api/leads/:id/activities from its quick-log FAB and its offline write queue,
 * the leads function had no `activities` branch, and this guard could not see
 * the caller, so `leads` carried one baselined gap (import-eda) and read as
 * otherwise covered.
 *
 * Native placeholders are their own syntax. Swift interpolates with `\(id)` and
 * Kotlin with `$id`; the shape normalizer only understood `${...}` and `:param`,
 * so `/api/leads/\(leadId)/activities` produced no placeholder, `activities`
 * was never treated as sitting behind an id, and the path was dropped even once
 * the file was in the corpus. Both forms are placeholders now.
 *
 * The native trees get no reachability walk - there is no import graph to
 * follow from a .swift file here - so every native source counts as live. That
 * is the same safe direction route-parity takes when its own walk cannot be
 * trusted.
 *
 * Ratchet, not a gate: docs/edge-path-coverage-baseline.json records what is
 * known. The check fails on anything NEW and reports what has been resolved.
 *
 *   node scripts/check-edge-path-coverage.mjs [--update-baseline] [--list]
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeParity } from './lib/route-parity.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = join(repo, 'docs/edge-path-coverage-baseline.json');

/**
 * Source with comments removed.
 *
 * Scanning raw text was the first version and it was wrong: the comment ABOVE
 * a branch usually names the very path the branch handles, so renaming the
 * branch and leaving the comment kept the check green. Verified by mutation —
 * with comments included, renaming 'bulk-delete' to 'bulkDelete' passed.
 *
 * String state is tracked so a `//` inside a URL or a quoted path is not read
 * as the start of a comment.
 */
function stripComments(src) {
  let out = '';
  let quote = null;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      out += ch;
      if (ch === '\\') {
        out += src[++i] ?? '';
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      out += '\n';
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i++;
      continue;
    }
    out += ch;
  }
  return out;
}

/** Concatenated, comment-stripped .ts source of an edge function directory. */
function readDirSrc(dir) {
  let out = '';
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out += readDirSrc(p);
    else if (p.endsWith('.ts')) out += stripComments(readFileSync(p, 'utf8'));
  }
  return out;
}

/** Segments that are never a route: template holes and path variables. */
function isLiteralSegment(segment) {
  return /^[a-z0-9][a-z0-9-]*$/.test(segment);
}

/** `${expr}` in a template literal, or `:param` in a route string. */
function isPlaceholder(segment) {
  return (
    /^\$\{[^}]*\}$/.test(segment) ||
    /^:[A-Za-z]/.test(segment) ||
    // Swift: "/api/leads/\(leadId)/activities"
    /^\\\([^)]*\)$/.test(segment) ||
    // Kotlin / shell-style: "/api/leads/$leadId/activities"
    /^\$[A-Za-z_][\w$.]*$/.test(segment)
  );
}

/**
 * Split a raw path tail into shape segments, or null if it cannot be read.
 *
 * The match stops at whitespace, so an interpolation containing a space
 * (`${opts.format ?? 'pdf'}`) arrives truncated as `${opts`. Returning null
 * there matters: guessing would have put `proposals/:id/export` in the baseline
 * off a fragment, and a baseline holding a misread entry is where a real one
 * hides.
 */
function shapeSegments(rawTail) {
  const opens = (rawTail.match(/\$\{/g) ?? []).length;
  const closes = (rawTail.match(/\}/g) ?? []).length;
  if (opens !== closes) return null;
  return rawTail.split('/').filter(Boolean);
}

/**
 * Does the edge function name this segment as a ROUTE TOKEN?
 *
 * Two wrong versions came before this one, in both directions.
 *
 * Quoted-literal only (`'seg'`) was the original, and it missed three of the
 * first four deep paths I spot-checked, because a handler can name a segment
 * without quoting it on its own:
 *
 *     if (path === '/summary')                       // sales-pipeline
 *     path.match(/^\/public\/([^/]+)\/respond$/)     // proposals
 *
 * A plain word-boundary search fixed those and broke something worse: it
 * "resolved" `admin/security` against the prose string 'Multiple critical
 * security events in the last 7 days', and `analytics/metrics` against a local
 * `const metrics`. Twenty-five baselined gaps disappeared on that rule, which
 * would have been a silent de-gating dressed up as progress.
 *
 * So the segment must sit between path/quote delimiters: preceded by a quote,
 * a backtick or a slash, and followed by one of those or by a regex anchor.
 * Prose and identifiers have a space or a letter on at least one side and are
 * rejected; every real dispatch form above is accepted.
 */
function appearsIn(src, segment) {
  const esc = segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`['"\`/]${esc}(?=['"\`/$?\\\\)])`).test(src);
}

/**
 * HTTP methods a bare-prefix call can carry. A literal path with no method
 * beside it is a read - that is what a TanStack queryKey is, and what
 * `apiRequest(url)` defaults to.
 */
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Methods this client file uses against the domain's BARE prefix.
 *
 * TWO CALL SHAPES ONLY, and the narrowness is the point - a literal that merely
 * SPELLS the prefix is not a request to it:
 *
 *   apiRequest('/api/x')            -> GET      apiRequest('/api/x', 'POST') -> POST
 *   queryKey: ['/api/x']            -> GET
 *
 * A MULTI-ELEMENT QUERY KEY IS NOT A BARE PATH. getQueryFn joins a key with
 * '/', so `['/api/quote-line-items', quote.id]` requests
 * /api/quote-line-items/<id>. Counting it as a bare GET reported a domain whose
 * only caller asks for one row.
 *
 * AN INVALIDATION IS NOT A CALL. `invalidateQueries({ queryKey: ['/api/x'] })`
 * is a cache operation, and TanStack matches it as a PREFIX - so the bare
 * spelling appears in files that only ever request deeper paths. That is the
 * same false positive PROD-020 found in the static route audit, where
 * quote-templates turned out to be an api-shaped cache key with no network call
 * behind it.
 */
function bareMethodsIn(text, domain) {
  const found = new Set();
  const esc = domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const record = (index, method) => {
    const around = text.slice(Math.max(0, index - 120), index + 40);
    if (/invalidate|removeQueries|cancelQueries|setQueryData|prefetch/.test(around)) return;
    const m = (method ?? 'GET').toUpperCase();
    if (METHODS.includes(m)) found.add(m);
  };

  // apiRequest('/api/x') or apiRequest('/api/x', 'POST', ...)
  const callRe = new RegExp(
    `apiRequest\\(\\s*(['"\`])/api/${esc}\\1\\s*(?:,\\s*(['"\`])(\\w+)\\2)?`,
    'g',
  );
  for (const m of text.matchAll(callRe)) record(m.index, m[3]);

  // queryKey: ['/api/x']  - exactly one element, so the joined URL is the prefix
  const keyRe = new RegExp(`queryKey:\\s*\\[\\s*(['"\`])/api/${esc}\\1\\s*\\]`, 'g');
  for (const m of text.matchAll(keyRe)) record(m.index, 'GET');

  return found;
}

/**
 * Text that says "the path is empty here".
 *
 * `!id`, `!parts[0]`, `parts.length === 0`, `segment === undefined`, and the
 * inverted form audit-logs uses - `rest !== '/'` guarding an early return, so
 * everything after it IS the bare path.
 */
const EMPTY_PATH_TEST =
  /!\s*[A-Za-z_$][\w$]*(?:\s*\[\s*\d+\s*\])?\s*[)&|{]|\.length\s*===\s*0|===\s*undefined|===\s*''|!==\s*'\/'/;

/**
 * A condition that names a specific sub-path: `endpoint === 'stats'`,
 * `&& resourceId`, `parts[0] === 'x'`. Its presence means the branch is NOT the
 * bare one.
 */
const SEGMENT_TEST = /===\s*['"`][a-z][\w-]*['"`]|&&\s*[A-Za-z_$][\w$]*\s*[)&{]/;

/**
 * Does the edge function have a branch for METHOD against the bare path?
 *
 * Three idioms in this tree, and getting to three took two wrong rules, each
 * caught by running the check rather than by reading it:
 *
 *   1. Same condition:   if (req.method === 'GET' && !equipmentId)
 *   2. Enclosing guard:  if (!id) { if (req.method === 'GET') ... }
 *   3. UNCONDITIONAL:    if (req.method === 'POST') { ... }
 *
 * The first rule looked only FORWARD from the method test and reported nearly
 * every domain as missing its own list endpoint, because idiom 2 is the
 * commonest here. The second added the backward window and still reported
 * business-records and equipment, because idiom 3 needs no path test at all -
 * a method branch with nothing else in its condition handles the bare path by
 * definition, and that is how most create endpoints are written.
 *
 * Generous on purpose. A false negative costs a missed report; a false positive
 * de-gates a domain that is actually broken, which is the worse trade and is
 * what the word-boundary rule above already got wrong once.
 */
function hasBareBranch(src, method) {
  // Idiom 4: no method dispatch anywhere. deal-stages answers a hardcoded list
  // whatever verb arrives, so every method reaches it - including the bare one.
  // Reported as missing until this rule existed, which is the clearest kind of
  // false positive: the endpoint is the one thing the function does.
  if (!/method\s*[=!]==\s*['"`]/.test(src)) return true;

  const methodRe = new RegExp(`method\\s*[=!]==\\s*['"\`]${method}['"\`]`, 'g');
  for (const m of src.matchAll(methodRe)) {
    const after = src.slice(m.index, m.index + 220).split('{')[0];
    const before = src.slice(Math.max(0, m.index - 260), m.index);

    // An emptiness test in the SAME condition only counts when the condition
    // says nothing about a segment. managed-services has
    // `GET && endpoint === 'contracts' && !contractId`: the `!contractId` is
    // about the segment AFTER 'contracts', not about the bare path, and reading
    // it as one hid that page's own list query.
    if (EMPTY_PATH_TEST.test(after + ')') && !SEGMENT_TEST.test(after)) return true;
    if (EMPTY_PATH_TEST.test(before)) return true;

    // Idiom 3: the condition holds the method test and nothing else. Read back
    // to the `if (` that opens it, so a neighbouring branch on the line above
    // cannot be mistaken for part of this condition.
    const open = before.lastIndexOf('if (');
    if (open === -1) continue;
    const condition = before.slice(open + 4) + after;
    const remainder = condition.replace(methodRe, '').replace(/req\.?/g, '');
    if (!SEGMENT_TEST.test(remainder) && !/[A-Za-z_$][\w$]*\s*===/.test(remainder)) return true;
  }
  return false;
}

/**
 * Route overrides in supabase/functions/server.ts, as domain -> segment -> fn.
 *
 * A DOMAIN'S OWN DIRECTORY IS NOT ALWAYS THE HANDLER. server.ts rewrites the
 * resolved function name for a few first sub-segments before dispatching, so
 * /dashboard/widgets and /dashboard/user-layout are served by `dashboard-widgets`
 * and not by `dashboard` at all. Reading only the domain directory reported both
 * as coverage gaps, and they sat in the baseline for months asserting that
 * production 404'd on a path production serves - a baseline entry that is not a
 * defect, which is exactly where a real one hides (DASH-METRICS-001).
 *
 * Only the `functionName === 'x' && (subPath[0] === 'a' ...)` shape is read.
 * Anything else in server.ts is left alone rather than guessed at, so a missed
 * override still reports a gap - the safe direction.
 */
function aliasTargets() {
  const out = {};
  let src;
  try {
    src = stripComments(readFileSync(join(repo, 'supabase/functions/server.ts'), 'utf8'));
  } catch {
    return out;
  }
  const blocks = src.matchAll(
    /functionName === '([a-z0-9-]+)'\s*&&\s*\(?([^)]*subPath\[0\][^)]*)\)?\s*\)?\s*\{([\s\S]{0,200}?)\}/g,
  );
  for (const block of blocks) {
    const domain = block[1];
    const assigned = /functionName = '([a-z0-9-]+)'/.exec(block[3]);
    if (!assigned) continue;
    for (const seg of block[2].matchAll(/subPath\[0\] === '([a-z0-9-]+)'/g)) {
      (out[domain] ??= {})[seg[1]] = assigned[1];
    }
  }
  return out;
}

/**
 * Whole-prefix renames in server.ts, as domain -> fn (round 220).
 *
 * `if (functionName === 'ai-employees') { functionName = 'ai-employee'; ... }`
 * sends EVERY request under the prefix to another directory, so the domain's
 * own directory - when one exists at all - is never executed. Reading it
 * anyway reported three paths the real handler serves as gaps, while the
 * unreachable plural directory it read was the thing actually out of date.
 * Only a condition naming functionName alone counts; one that also tests
 * subPath is a per-segment override, which aliasTargets() reads.
 */
export function wholeAliasTargets(src) {
  const out = {};
  if (src === undefined) {
    try {
      src = stripComments(readFileSync(join(repo, 'supabase/functions/server.ts'), 'utf8'));
    } catch {
      return out;
    }
  }
  for (const m of src.matchAll(
    /if \(functionName === '([a-z0-9-]+)'\)\s*\{\s*functionName = '([a-z0-9-]+)';/g,
  )) {
    out[m[1]] = m[2];
  }
  return out;
}

/**
 * Client trees beyond `client/src`, and the source extensions each one uses.
 *
 * Same list as check:unreferenced-edge-fns, for the same reason: a caller in
 * the iOS project is a caller. Documentation is not - a path named in a
 * SECURITY.md is prose - so only source files are read.
 */
const NATIVE_TREES = [
  'printyx-client',
  'printyx-desktop',
  'mobile-app',
  'mobile',
  'browser-extensions',
  'printyx-extension',
  'ios',
];
const NATIVE_SOURCE = /\.(ts|tsx|js|jsx|mjs|cjs|swift|kt|java|dart)$/;

/**
 * Tests are not production surface.
 *
 * ios/PrintyxTests names `/api/leads/123/activities` and `/api/leads/abc/...`
 * as fixtures, and without this the ids `123` and `abc` arrive as literal
 * depth-1 segments and land in the baseline as if two endpoints were missing.
 * Same exclusion, same reasoning, as route-parity applies to server routers
 * declared inside supertest fixtures.
 */
const NATIVE_TEST =
  /(^|[\\/])(tests?|__tests__|spec|specs)[\\/]|[\\/][^\\/]*(Tests|\.test|\.spec)\.[a-z]+$/i;

/** Every source file under the non-web client trees. */
function nativeClientFiles() {
  const out = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      if (
        entry === 'node_modules' ||
        entry === 'dist' ||
        entry === 'build' ||
        entry.startsWith('.')
      )
        continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (NATIVE_SOURCE.test(entry) && !NATIVE_TEST.test(full)) out.push(full);
    }
  };
  for (const tree of NATIVE_TREES) walk(join(repo, tree));
  return out;
}

/** domain -> native files naming `/api/<domain>/...` or the bare prefix. */
function nativeCallersByDomain() {
  const byDomain = new Map();
  for (const file of nativeClientFiles()) {
    let text;
    try {
      text = stripComments(readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    for (const m of text.matchAll(/\/api\/([a-z0-9-]+)/g)) {
      const domain = m[1];
      if (!byDomain.has(domain)) byDomain.set(domain, []);
      const list = byDomain.get(domain);
      if (!list.includes(file)) list.push(file);
    }
  }
  return byDomain;
}

export function computeCoverageGaps() {
  const parity = computeParity(repo);
  const aliases = aliasTargets();
  const renamed = wholeAliasTargets();
  const native = nativeCallersByDomain();
  const gaps = {};

  for (const row of parity.rows) {
    if (!row.edge) continue;
    const nativeFiles = native.get(row.domain) ?? [];
    if (!row.frontendLive && nativeFiles.length === 0) continue;
    const dir = join(repo, 'supabase/functions', renamed[row.domain] ?? row.domain);
    if (!existsSync(dir)) continue;
    const src = readDirSrc(dir);

    const segments = new Set();
    const deepShapes = new Set();
    const bareMethods = new Set();
    // Native sources get no reachability walk, so all of them count as live.
    for (const file of [...row.callers.live, ...nativeFiles]) {
      let text;
      try {
        // Comments are stripped from the CLIENT too, not only the edge
        // function. A path named in a comment is not a call: usePricingVisibility.ts
        // explains in prose that /api/pricing/visibility used to be wrong, and
        // that comment alone put a phantom entry in this baseline. A phantom
        // entry is worse than a missing one — a real gap can hide among them.
        text = stripComments(readFileSync(file, 'utf8'));
      } catch {
        continue;
      }
      // Depth 1: the original check, unchanged.
      const re = new RegExp(`['"\`]/api/${row.domain}/([^'"\`?\\s/]+)`, 'g');
      for (const m of text.matchAll(re)) {
        if (isLiteralSegment(m[1])) segments.add(m[1]);
      }

      // Deeper: a literal sitting behind an id. Same emptiness test, but the
      // ENTRY is the whole shape, so the report names the path a page calls
      // rather than a bare word that could belong to any depth.
      const deepRe = new RegExp(`['"\`]/api/${row.domain}/([^'"\`?\\s]+)`, 'g');
      for (const m of text.matchAll(deepRe)) {
        const segs = shapeSegments(m[1]);
        if (!segs || !segs.some(isPlaceholder)) continue;
        let afterPlaceholder = false;
        let unhandled = false;
        for (const seg of segs) {
          if (isPlaceholder(seg)) {
            afterPlaceholder = true;
            continue;
          }
          if (!afterPlaceholder || !isLiteralSegment(seg)) continue;
          if (!appearsIn(src, seg)) unhandled = true;
        }
        if (unhandled) deepShapes.add(segs.map((s) => (isPlaceholder(s) ? ':id' : s)).join('/'));
      }

      // WF-G-05: the bare prefix, which carries no segment to search for.
      for (const method of bareMethodsIn(text, row.domain)) bareMethods.add(method);
    }

    // A segment server.ts hands to another function is searched in THAT
    // function's source, not this one's.
    const aliasForDomain = aliases[row.domain] ?? {};
    const aliasSrc = {};
    const sourceFor = (segment) => {
      const target = aliasForDomain[segment];
      if (!target) return src;
      const targetDir = join(repo, 'supabase/functions', target);
      if (!existsSync(targetDir)) return src;
      aliasSrc[target] ??= readDirSrc(targetDir);
      return `${src}\n${aliasSrc[target]}`;
    };

    const missing = [...segments].filter((s) => !appearsIn(sourceFor(s), s));
    const missingBare = [...bareMethods].filter((m) => !hasBareBranch(src, m)).map((m) => `#${m}`);
    const entries = [...new Set([...missing, ...deepShapes, ...missingBare])].sort();
    if (entries.length) gaps[row.domain] = entries;
  }

  return gaps;
}

function flatten(gaps) {
  return new Set(Object.entries(gaps).flatMap(([d, segs]) => segs.map((s) => `${d}/${s}`)));
}

/**
 * The note already in the baseline, so --update-baseline does not destroy it.
 *
 * This writer used to regenerate its note on every run, which is exactly the
 * defect round 82 found in check:raw-body-writes: the paragraph explaining WHY
 * a count jumped is the one thing stopping the next reader taking the longer
 * list for a regression, and the next tighten silently threw it away.
 */
function existingNote() {
  try {
    const note = JSON.parse(readFileSync(baselinePath, 'utf8')).note;
    return typeof note === 'string' && note.length > 0 ? note : null;
  } catch {
    return null;
  }
}

/**
 * All of the IO, behind an entry-point test.
 *
 * `computeCoverageGaps` is exported so a test can call it, and top-level code in
 * an ESM module runs on import - so without this, importing the analysis also
 * ran the comparison and could `process.exit(1)` out of a test run the moment a
 * new gap appeared. `import.meta.main` is a Deno API and is always undefined in
 * Node, which this repo has already paid for once in a seeder that did nothing.
 */
function main() {
  const args = process.argv.slice(2);
  const gaps = computeCoverageGaps();

  if (args.includes('--list')) {
    for (const [domain, segments] of Object.entries(gaps).sort()) {
      console.log(`${domain}: ${segments.join(', ')}`);
    }
    const total = [...flatten(gaps)].length;
    console.log(`\n${Object.keys(gaps).length} domain(s), ${total} path(s).`);
    process.exit(0);
  }

  if (args.includes('--update-baseline')) {
    writeFileSync(
      baselinePath,
      JSON.stringify(
        {
          note:
            existingNote() ??
            'Sub-paths a reachable client file calls whose literal segment appears nowhere in ' +
              "that domain's edge function. An entry is either a bare segment (/api/<domain>/<seg>) " +
              'or, since PA-025, a normalized shape with ids collapsed to :id ' +
              '(/api/<domain>/:id/<seg>). Likely prod-only 404s, or worse - a request that falls ' +
              'through to a generic :id branch and answers 200 with the PARENT OBJECT, which a ' +
              'component maps over and renders as empty. Do not grow this list; see ' +
              'scripts/check-edge-path-coverage.mjs.',
          gaps,
        },
        null,
        2,
      ) + '\n',
    );
    const total = [...flatten(gaps)].length;
    console.log(`Baseline updated: ${Object.keys(gaps).length} domain(s), ${total} path(s).`);
    process.exit(0);
  }

  if (!existsSync(baselinePath)) {
    console.error(`No baseline at ${baselinePath}. Create one with --update-baseline.`);
    process.exit(1);
  }

  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')).gaps ?? {};
  const known = flatten(baseline);
  const current = flatten(gaps);

  const added = [...current].filter((p) => !known.has(p)).sort();
  const resolved = [...known].filter((p) => !current.has(p)).sort();

  if (added.length) {
    console.error(
      `✗ ${added.length} NEW frontend path(s) with no matching segment in the edge function:`,
    );
    for (const p of added) console.error(`    /api/${p}`);
    console.error(
      '\n  Either implement the branch, or — if the handler dispatches on a variable — confirm it\n' +
        '  resolves and re-baseline with: node scripts/check-edge-path-coverage.mjs --update-baseline',
    );
    process.exit(1);
  }

  if (resolved.length) {
    console.log(`ℹ ${resolved.length} baselined path(s) now resolve:`);
    for (const p of resolved.slice(0, 12)) console.log(`    /api/${p}`);
    if (resolved.length > 12) console.log(`    …and ${resolved.length - 12} more`);
    console.log('  Tighten with: node scripts/check-edge-path-coverage.mjs --update-baseline');
  }

  console.log(
    `✓ No new edge-path coverage gaps (${known.size} baselined across ${Object.keys(baseline).length} domain(s)).`,
  );
}

const isEntryPoint =
  !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntryPoint) main();
