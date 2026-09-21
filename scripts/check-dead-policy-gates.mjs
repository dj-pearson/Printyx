#!/usr/bin/env node
/**
 * A POLICY GATE on a path production does not serve is not a policy.
 *
 * `getApiUrl` rewrites `/api/<seg>` straight to the functions host in
 * production, so Express answers a path only when NOTHING over there claims
 * the segment: no `crmProxies` entry, no `supabase/functions/<seg>` directory,
 * no `server.ts` alias. Middleware mounted on a claimed path therefore runs on
 * developer machines and on nobody else.
 *
 * That is the architecture for the AMBIENT stack - authentication and tenant
 * resolution are the edge function's own job, and those names are exempt below
 * with that reason. It is NOT the architecture for a policy gate. This session
 * found the same shape five times by hand before anything watched for it:
 *
 *   - LAUNCH-010's login/signup/reset rate limiters, on `/api/auth`, a prefix
 *     production resolves to an edge directory that does not exist while the
 *     web client signs in against GoTrue directly.
 *   - AUDIT-034's IP whitelist and MFA-for-admins, two of whose four target
 *     paths were proxied.
 *   - SEC-003's Helmet configuration, correct and never reaching a document.
 *   - LAUNCH-013's subscription and usage gates (below).
 *
 * The finding is deliberately not "this middleware is wrong". It is "whatever
 * this middleware decides, it decides it for developers only" - which is worth
 * saying out loud next to a name like `enforceUsageLimits`.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const SERVER = join(ROOT, 'server');
const EDGE = join(ROOT, 'supabase/functions');
const PROXY_FILE = join(ROOT, 'server/middleware/edge-function-proxy.ts');
const BASELINE_PATH = join(ROOT, 'docs/dead-policy-gates-baseline.json');

/**
 * Below this the parser is broken and a clean run means nothing. This repo has
 * ~500 `/api` route registrations, so 200 is a floor and not a target. Exported
 * because a floor that lives inside main() is not exercised by importing the
 * module, which is how the same mutant survived in round 120.
 */
export const MIN_REGISTRATIONS = 200;

/**
 * Exempt BY NAME with a reason, never as a silent list. These are the ambient
 * request stack: the edge function calls `auth.getUser` and resolves the
 * tenant itself, so an Express copy not running in production is the design.
 * Anything not named here is treated as a policy decision.
 */
export const AMBIENT = new Map([
  ['requireAuth', 'the edge function authenticates the JWT itself'],
  ['isAuthenticated', 'the edge function authenticates the JWT itself'],
  ['requireSupabaseAuth', 'the edge function authenticates the JWT itself'],
  ['authenticateSupabaseJWT', 'the edge function authenticates the JWT itself'],
  ['protectedRoute', 'auth plus tenant context, both done edge-side'],
  ['resolveTenant', '_shared/resolve-tenant.ts does this edge-side'],
  ['requireTenant', '_shared/resolve-tenant.ts does this edge-side'],
  ['authenticateClient', 'device API-key auth; the edge function has its own'],
]);

/** Not middleware at all - body parsers, cache headers, upload handling. */
export const NOT_A_GATE = new Set([
  'upload',
  'express',
  'cacheControl',
  'etag',
  'ctx',
  'rawBodyParser',
  'bodyParser',
  'cors',
  'compression',
]);

export function stripComments(src) {
  return src
    .replace(/(?<![:/])\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

export function serverFiles() {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!/^(tests|node_modules)$/.test(entry.name)) walk(join(dir, entry.name));
      } else if (entry.name.endsWith('.ts')) out.push(join(dir, entry.name));
    }
  };
  walk(SERVER);
  return out;
}

/** Segments production sends to the functions host rather than to Express. */
export function claimedSegments() {
  const src = readFileSync(PROXY_FILE, 'utf8');
  const at = src.search(/crmProxies\s*[:=][^{]*\{/);
  let depth = 0;
  const start = src.indexOf('{', at);
  let end = start;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) {
      end = i;
      break;
    }
  }
  const segments = new Set();
  for (const m of src.slice(start, end).matchAll(/'\/api\/([a-z0-9-]+)[^']*'\s*:/g)) {
    segments.add(m[1]);
  }
  for (const entry of readdirSync(EDGE, { withFileTypes: true })) {
    if (entry.isDirectory() && !entry.name.startsWith('_')) segments.add(entry.name);
  }
  return segments;
}

/** Balanced-paren argument list of every `app.<verb>('/api/...', ...)`. */
export function routeRegistrations(src) {
  const out = [];
  const re = /\b(?:app|router)\.(get|post|put|patch|delete)\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length;
    const start = i;
    let depth = 1;
    for (; i < src.length && depth > 0; i++) {
      const c = src[i];
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') depth--;
      else if (c === "'" || c === '"' || c === '`') {
        const q = c;
        i++;
        while (i < src.length && src[i] !== q) {
          if (src[i] === '\\') i++;
          i++;
        }
      }
    }
    out.push(src.slice(start, i - 1));
  }
  return out;
}

export function splitArgs(s) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (c === "'" || c === '"' || c === '`') {
      const q = c;
      cur += c;
      i++;
      while (i < s.length && s[i] !== q) {
        if (s[i] === '\\') {
          cur += s[i];
          i++;
        }
        cur += s[i];
        i++;
      }
      cur += s[i];
      continue;
    }
    if (c === ',' && depth === 0) {
      parts.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

export function findings() {
  const claimed = claimedSegments();
  const files = serverFiles();
  const out = [];
  let registrations = 0;

  for (const file of files) {
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const args of routeRegistrations(src)) {
      const parts = splitArgs(args);
      if (parts.length < 2) continue;
      const path = parts[0].match(/^'([^']*)'$/)?.[1];
      if (!path || !path.startsWith('/api/')) continue;
      registrations++;
      const segment = path.split('/')[2];
      if (!claimed.has(segment)) continue;

      // Everything between the path and the final handler is middleware.
      for (const arg of parts.slice(1, -1)) {
        const name = arg.match(/^([A-Za-z_$][\w$]*)/)?.[1];
        if (!name || AMBIENT.has(name) || NOT_A_GATE.has(name)) continue;
        out.push({
          key: `${relative(ROOT, file).split('\\').join('/')}::${name}`,
          gate: name,
          path,
          file: relative(ROOT, file).split('\\').join('/'),
        });
      }
    }
  }
  return { findings: out, registrations, files: files.length };
}

const DEFAULT_NOTE = [
  'Policy gates mounted on an /api path production sends to the functions host,',
  'so each decides only for developer machines. Shrink-only, and every entry',
  'needs a reason - a flat list reads the same whether it was decided or',
  'overlooked. Regenerate with `npm run check:dead-policy-gates -- --update-baseline`.',
].join(' ');

function existingNote(fallback) {
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).note || fallback;
  } catch {
    return fallback;
  }
}

function readAccepted() {
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).accepted ?? {};
  } catch {
    return {};
  }
}

export function compareToBaseline(foundKeys, accepted) {
  const problems = [];
  const found = new Set(foundKeys);
  for (const key of found) {
    const why = accepted[key];
    if (why === undefined) problems.push({ kind: 'new', key });
    else if (!why) problems.push({ kind: 'unreasoned', key });
  }
  for (const key of Object.keys(accepted)) {
    if (!found.has(key)) problems.push({ kind: 'stale', key });
  }
  return problems;
}

function main() {
  const { findings: found, registrations, files } = findings();

  if (registrations < MIN_REGISTRATIONS) {
    console.error(
      `check:dead-policy-gates parsed only ${registrations} route registrations from ${files} ` +
        'files - the walk is broken, so a clean run would mean nothing.',
    );
    process.exit(2);
  }

  const byKey = new Map();
  for (const f of found) {
    if (!byKey.has(f.key)) byKey.set(f.key, []);
    byKey.get(f.key).push(f);
  }

  if (process.argv.includes('--update-baseline')) {
    const prior = readAccepted();
    const accepted = {};
    for (const key of [...byKey.keys()].sort()) accepted[key] = prior[key] ?? '';
    writeFileSync(
      BASELINE_PATH,
      `${JSON.stringify({ note: existingNote(DEFAULT_NOTE), accepted }, null, 2)}\n`,
      'utf8',
    );
    const unreasoned = Object.entries(accepted).filter(([, why]) => !why);
    console.log(`Wrote ${BASELINE_PATH} with ${Object.keys(accepted).length} entries.`);
    if (unreasoned.length) {
      console.error(
        `\n${unreasoned.length} entr(ies) have no reason:\n` +
          unreasoned.map(([k]) => `  ${k}`).join('\n'),
      );
      process.exit(1);
    }
    return;
  }

  const problems = compareToBaseline(byKey.keys(), readAccepted());
  if (!problems.length) {
    console.log(
      `\u2713 Dead policy gates: ${byKey.size} accepted, each with a reason ` +
        `(${registrations} route registrations across ${files} files).`,
    );
    return;
  }

  console.error(`check:dead-policy-gates found ${problems.length} problem(s):\n`);
  for (const p of problems) {
    if (p.kind === 'stale') {
      console.error(`  STALE  ${p.key}\n     no longer found - remove it.\n`);
      continue;
    }
    const sites = byKey.get(p.key) ?? [];
    const label = p.kind === 'new' ? 'NEW' : 'UNREASONED';
    console.error(
      `  ${label}  ${p.key}\n` +
        sites.map((s) => `     ${s.path} - production serves this edge-side`).join('\n') +
        '\n',
    );
  }
  process.exit(1);
}

const isEntryPoint =
  !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntryPoint) main();
