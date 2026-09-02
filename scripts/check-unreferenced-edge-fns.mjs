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
 * EVERY CLIENT TREE IS SCANNED, not just the web app. This repo ships six more:
 * printyx-client, printyx-desktop, mobile-app, mobile, browser-extensions,
 * printyx-extension and the iOS project. The first version of this script read
 * client/src alone and called that a blind spot; it was worse than that, because
 * `today-dashboard` was reported unreferenced and then written up as a dead
 * duplicate, when ios/Printyx/Core/Network/APIEndpoint.swift calls it. Source
 * files only - a path named in a SECURITY.md is documentation, not a caller, and
 * counting it put a phantom reference on `client-metrics`.
 *
 * pg_cron COUNTS AS A CALLER. drizzle/cron/*.sql posts to edge functions through
 * pg_net.http_post, which is a real invocation path with no client involved -
 * email-marketing and field-service are reached only that way and were false
 * positives until this was added. _shared/cron-auth.ts is the helper such a
 * handler is meant to use to verify the call; nothing imports it today, which is
 * worth knowing but does not change reachability.
 *
 * WHAT IT CANNOT SEE, stated so a pass is never read as proof:
 *   - Other server-to-server callers, and anything invoked by a provider webhook.
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

/** Directories holding a client that can call an edge function. */
const CLIENT_TREES = [
  join('client', 'src'),
  'printyx-client',
  'printyx-desktop',
  'mobile-app',
  'mobile',
  'browser-extensions',
  'printyx-extension',
  'ios',
];

const SOURCE = /\.(ts|tsx|js|jsx|mjs|cjs|swift|kt|java|dart)$/;

/**
 * Every /api/<segment> any client source names, matched exactly.
 *
 * COMMENTS ARE STRIPPED, and the reason is the sharpest version of a trap this
 * repo keeps hitting. ManufacturerIntegrationDevices.tsx carries the line
 * "PA-054: /api/devices is proxied by neither host, so all three of this page's
 * calls 404'd in production" - a comment recording that the page STOPPED
 * calling that prefix. Unstripped, it was the only thing keeping `devices` off
 * this list: the note explaining the removal faked the reference it was
 * documenting. That is the same failure mode CLAUDE.md records for `fleet`,
 * where a mistaken reference was the only thing making this guard pass, so the
 * guard was wrong in both directions on the same question.
 *
 * The proxy and dispatcher scans below already stripped; only this one did not.
 */
function clientSegments() {
  const segments = new Set();
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (SOURCE.test(entry)) {
        const src = stripComments(readFileSync(full, 'utf8'));
        for (const m of src.matchAll(/\/api\/([a-z0-9-]+)/g)) {
          segments.add(m[1]);
        }
      }
    }
  };
  for (const tree of CLIENT_TREES) walk(join(ROOT, tree));
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

/** Edge functions invoked by pg_cron through drizzle/cron/*.sql. */
function cronInvoked() {
  const invoked = new Set();
  const dir = join(ROOT, 'drizzle', 'cron');
  if (!existsSync(dir)) return invoked;
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith('.sql')) continue;
    const sql = readFileSync(join(dir, entry), 'utf8');
    for (const m of sql.matchAll(/functions[a-z.]*\/([a-z0-9-]+)/g)) invoked.add(m[1]);
  }
  return invoked;
}

const functions = edgeFunctions();
const called = clientSegments();
const aliased = aliasedFunctions();
const scheduled = cronInvoked();

const unreferenced = functions.filter(
  (fn) => !called.has(fn) && !aliased.has(fn) && !scheduled.has(fn),
);

if (UPDATE) {
  writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        note:
          'Edge functions nothing reaches: no client tree names /api/<its-directory-name>, no ' +
          'crmProxies alias or server.ts override maps a segment onto it, and no pg_cron job in ' +
          'drizzle/cron/*.sql posts to it. Each is a back end with no caller - wire it, delete ' +
          'it, or record that it is reached server-to-server. A TODO list, not settled debt. ' +
          'See scripts/check-unreferenced-edge-fns.mjs.',
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
  console.error(`✗ ${added.length} NEW edge function(s) that no client tree calls:\n`);
  for (const fn of added) console.error(`    supabase/functions/${fn}/`);
  console.error(
    '\nA back end with no caller is half a feature. Give it a caller, or if it is reached\n' +
      'server-to-server or by a provider webhook, record it with:\n' +
      '    node scripts/check-unreferenced-edge-fns.mjs --update-baseline',
  );
  process.exit(1);
}

// A baselined entry leaves the list two ways, and they are not the same result:
// something now calls it, or the directory is gone. Reporting a deletion as
// "now reachable" misstates the work that was done.
const fixed = [...baseline].filter((fn) => !unreferenced.includes(fn));
if (fixed.length > 0) {
  const gone = fixed.filter((fn) => !functions.includes(fn));
  const wired = fixed.filter((fn) => functions.includes(fn));
  console.log(
    `✓ No new unreferenced edge functions. ${fixed.length} baselined entr(ies) resolved:`,
  );
  for (const fn of wired) console.log(`    ${fn} (now called)`);
  for (const fn of gone) console.log(`    ${fn} (deleted)`);
  console.log('  Tighten with: node scripts/check-unreferenced-edge-fns.mjs --update-baseline');
} else {
  console.log(
    `✓ No new unreferenced edge functions (${unreferenced.length} baselined of ${functions.length}).`,
  );
}
