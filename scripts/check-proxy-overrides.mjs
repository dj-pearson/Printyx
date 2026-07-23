// Proxy-override parity check (PA-019).
//
// The dev edge-function proxy (server/middleware/edge-function-proxy.ts) can map
// a URL prefix to a DIFFERENTLY-named edge function via an object entry:
//   '/api/kpis': { fn: 'reports', pathPrefix: '/kpis' }
// This rewrite is DEV-ONLY. In production the frontend hits the Coolify
// dispatcher (supabase/functions/server.ts) directly, which resolves the
// function from URL segment 0 — here 'kpis' — and 404s because no `kpis`
// function directory exists. Every such {fn,pathPrefix} entry therefore needs a
// matching server.ts route override, or the prefix works in dev and 404s in
// prod (the exact defect PA-019 fixed for kpis/reporting/scheduled-reports).
//
// This check fails when an object-form crmProxies entry has no corresponding
// server.ts override for its first URL segment (and, for multi-segment public/*
// prefixes, the sub-path discriminator).
//
// Usage: node scripts/check-proxy-overrides.mjs
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const proxySrc = readFileSync(resolve(repo, 'server/middleware/edge-function-proxy.ts'), 'utf8');
const serverSrc = readFileSync(resolve(repo, 'supabase/functions/server.ts'), 'utf8');

// Extract object-form proxy entries: '/api/<path>': { fn: '<fn>', pathPrefix: ... }
const entryRe = /'(\/api\/[^']+)':\s*\{\s*fn:\s*'([^']+)'/g;
const entries = [];
let m;
while ((m = entryRe.exec(proxySrc)) !== null) {
  entries.push({ prefix: m[1], fn: m[2] });
}

if (entries.length === 0) {
  console.error('✗ Found no object-form crmProxies entries — parser drift?');
  process.exit(2);
}

// server.ts declares an override for a segment via `functionName === '<seg>'`.
const hasFunctionNameGuard = (seg) =>
  new RegExp(`functionName\\s*===\\s*'${seg.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}'`).test(
    serverSrc,
  );
// Multi-segment public/* prefixes additionally discriminate on subPath[0].
const hasSubPathLiteral = (seg) =>
  new RegExp(`'${seg.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}'`).test(serverSrc);

const problems = [];
for (const { prefix, fn } of entries) {
  const segs = prefix
    .replace(/^\/api\//, '')
    .split('/')
    .filter(Boolean);
  const seg0 = segs[0];

  // If the URL segment equals the target fn name, the dispatcher resolves it
  // natively — no override needed.
  if (seg0 === fn) continue;

  if (!hasFunctionNameGuard(seg0)) {
    problems.push(
      `${prefix} → fn '${fn}': no server.ts override for functionName === '${seg0}' ` +
        `(works in dev, 404s in prod).`,
    );
    continue;
  }
  if (segs.length > 1 && !hasSubPathLiteral(segs[1])) {
    problems.push(
      `${prefix} → fn '${fn}': server.ts handles '${seg0}' but not the sub-path ` +
        `discriminator '${segs[1]}'.`,
    );
  }
}

if (problems.length > 0) {
  console.error('✗ crmProxies {fn,pathPrefix} entries missing a server.ts prod override:\n');
  for (const p of problems) console.error('    ' + p);
  console.error(
    '\nAdd a route override in supabase/functions/server.ts (see the PA-019 / leases / ' +
      'ai-employee blocks) so production resolves the prefix to the target function.',
  );
  process.exit(1);
}

console.log(
  `✓ All ${entries.length} object-form crmProxies entries have a matching server.ts override.`,
);
process.exit(0);
