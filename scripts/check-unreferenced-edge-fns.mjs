#!/usr/bin/env node
/**
 * Unreferenced edge-function ratchet.
 *
 * THE PATTERN: a complete back end that nothing calls. This session found it
 * three times and no existing guard sees any of them, because each half looks
 * fine on its own:
 *
 *   - CRMX-016's booking surface: three pages, two edge functions, both
 *     proxied, and no <Route> - the whole feature was unreachable.
 *   - PROD-008c/PROD-008d: advanced billing and document automation, real
 *     tables and handlers, no UI and no edge branches.
 *   - AUDIT-023: the public print-cost calculator, whose edge function is live
 *     and proxied and whose page has no URL.
 *
 * check:orphans catches an unreachable PAGE. check:edge-coverage catches a
 * frontend path with no matching branch. check:routes catches ownership
 * ambiguity. None of them catches a whole edge function that no client path
 * names, which is the back-end half of the same defect.
 *
 * REACHABILITY, precisely. In production client/src/lib/config.ts getApiUrl()
 * rewrites /api/<seg> to functions.printyx.net/<seg>, so a function is reachable
 * from the web app when:
 *   1. some client file names /api/<its-own-directory-name>, or
 *   2. it is the target of a crmProxies alias whose URL segment differs from the
 *      directory - `{ fn: 'public-calculator', pathPrefix: '/calculator' }` is
 *      reached as /api/public/calculator - or
 *   3. supabase/functions/server.ts maps a segment onto it (EDGE-005a's
 *      plural-prefix -> singular-directory overrides).
 * Anything else has no path from the browser.
 *
 * SEGMENT MATCHING IS EXACT. The pattern stops at any character outside
 * [a-z0-9-], so `/api/pipeline-config` does NOT count as a reference to the
 * `pipeline` function. A first cut of this check used a \b word boundary while
 * spot-checking and reported 34 phantom callers for `pipeline`, because `-` is
 * itself a word boundary.
 *
 * WHAT IT CANNOT SEE, stated so a pass is never read as proof:
 *   - Callers outside client/src. The mobile apps, the Chrome extension and any
 *     server-to-server caller are invisible here, which is why several such
 *     functions sit in the baseline rather than being reported as defects.
 *   - A path assembled at runtime from a variable.
 *   - supabase.functions.invoke('name'), which bypasses /api entirely. There is
 *     no such call in client/src today - verified - but it would be a blind spot
 *     the moment one is added.
 *
 * The baseline is a TODO list, not settled debt: each entry is a back end with
 * no browser caller, and the answer for each is wire it, delete it, or record
 * why it is reached from somewhere this script cannot see.
 *
 *   node scripts/check-unreferenced-edge-fns.mjs
 *   node scripts/check-unreferenced-edge-fns.mjs --update-baseline
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const BASELINE = join(ROOT, 'docs', 'unreferenced-edge-fns-baseline.json');
const UPDATE = process.argv.includes('--update-baseline');

const FUNCTIONS_DIR = join(ROOT, 'supabase', 'functions');
const PROXY = join(ROOT, 'server', 'middleware', 'edge-function-proxy.ts');
const DISPATCHER = join(FUNCTIONS_DIR, 'server.ts');

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

function edgeFunctions() {
  return readdirSync(FUNCTIONS_DIR)
    .filter((d) => !d.startsWith('_') && !d.startsWith('.'))
    .filter((d) => statSync(join(FUNCTIONS_DIR, d)).isDirectory())
    .sort();
}

/** Every /api/<segment> a file under client/src names, matched exactly. */
function clientSegments() {
  const segments = new Set();
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (/\.(ts|tsx)$/.test(entry)) {
        for (const m of readFileSync(full, 'utf8').matchAll(/\/api\/([a-z0-9-]+)/g)) {
          segments.add(m[1]);
        }
      }
    }
  };
  walk(join(ROOT, 'client', 'src'));
  return segments;
}

/**
 * Functions reached under a URL segment that is not their directory name:
 * crmProxies `{ fn: 'x', pathPrefix: ... }` targets, and server.ts overrides.
 * A plain string target is NOT an alias - `'/api/deals': 'deals'` is reached as
 * /api/deals, which clientSegments already covers.
 */
function aliasedFunctions() {
  const aliased = new Set();
  const proxy = stripComments(readFileSync(PROXY, 'utf8'));
  for (const m of proxy.matchAll(/fn:\s*'([a-z0-9-]+)'/g)) aliased.add(m[1]);

  if (existsSync(DISPATCHER)) {
    const dispatcher = stripComments(readFileSync(DISPATCHER, 'utf8'));
    for (const m of dispatcher.matchAll(/'([a-z0-9-]+)'/g)) aliased.add(m[1]);
  }
  return aliased;
}

const functions = edgeFunctions();
const called = clientSegments();
const aliased = aliasedFunctions();

const unreferenced = functions.filter((fn) => !called.has(fn) && !aliased.has(fn));

if (UPDATE) {
  writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        note:
          'Edge functions no file under client/src reaches: the directory name appears in no ' +
          '/api/<segment> path, and no crmProxies alias or server.ts override maps a segment ' +
          'onto it. Each is a back end with no browser caller - wire it, delete it, or record ' +
          'that it is reached from somewhere this script cannot see (mobile, extension, ' +
          'server-to-server). A TODO list, not settled debt. See scripts/check-unreferenced-edge-fns.mjs.',
        total: unreferenced.length,
        ofFunctions: functions.length,
        unreferenced,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `Baseline updated: ${unreferenced.length} unreferenced of ${functions.length} edge functions.`,
  );
  process.exit(0);
}

const baseline = existsSync(BASELINE)
  ? new Set(JSON.parse(readFileSync(BASELINE, 'utf8')).unreferenced ?? [])
  : new Set();

const added = unreferenced.filter((fn) => !baseline.has(fn));

if (added.length > 0) {
  console.error(`✗ ${added.length} NEW edge function(s) that nothing in client/src calls:\n`);
  for (const fn of added) console.error(`    supabase/functions/${fn}/`);
  console.error(
    '\nA back end with no caller is half a feature. Give it a caller, or if it is reached\n' +
      'from outside client/src (mobile, extension, a provider webhook), record it with:\n' +
      '    node scripts/check-unreferenced-edge-fns.mjs --update-baseline',
  );
  process.exit(1);
}

const fixed = [...baseline].filter((fn) => !unreferenced.includes(fn));
if (fixed.length > 0) {
  console.log(`✓ No new unreferenced edge functions. ${fixed.length} baselined now reachable:`);
  for (const fn of fixed) console.log(`    ${fn}`);
  console.log('  Tighten with: node scripts/check-unreferenced-edge-fns.mjs --update-baseline');
} else {
  console.log(
    `✓ No new unreferenced edge functions (${unreferenced.length} baselined of ${functions.length}).`,
  );
}
