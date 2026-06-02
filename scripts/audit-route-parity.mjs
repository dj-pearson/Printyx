// Route-parity audit (EDGE-012). Heuristic, re-runnable source of truth for
// where every /api/* route is actually served — and where dev (Express) and
// prod (edge functions) diverge.
//
// ARCHITECTURE FACT this encodes:
//   - PROD: the frontend calls functions.printyx.net/<route> directly for ALL
//     /api/* (client/src/lib/config.ts getApiUrl strips /api/ and targets the
//     functions host). Express is NOT in the prod frontend path.
//   - DEV: relative /api/* → Vite proxy → Express, which serves locally EXCEPT
//     for the prefixes listed in edge-function-proxy.ts (forwarded to edge).
//   - Express stays canonical regardless for /api/client-metrics/* (the
//     monitoring agent) and /install/* (installer assets).
//
// Classification per top-level /api/<segment>:
//   missing-edge   — frontend calls it, NO edge function  => PROD BLOCKER
//   both-divergent — Express handler + edge function, NOT proxied => dev≠prod
//   proxied        — in the proxy map (dev forwards to edge; aligned)
//   express-only   — Express handler, no edge function (not yet migrated)
//   dead-express   — Express + edge exist, but no frontend reference
//   edge-only      — edge function exists, no Express handler (fully migrated)
//
// Output: docs/route-parity-matrix.md. Heuristic (regex over source) — treat
// as a worklist to confirm per-domain, not as ground truth.
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');

// Express stays canonical for these regardless of edge presence — agent
// ingest, auth/session infra, telemetry, and installer/health endpoints that
// are intentionally NOT edge functions.
const EXPRESS_CANONICAL = new Set([
  'client-metrics', // monitoring agent ingest (submit/heartbeat/config/install-report)
  'device-monitoring', // live device-monitoring read path (routes-device-monitoring.ts)
  'auth', // GoTrue/session bridge
  'me', // session identity
  'trial', // trial bootstrap
  'validate', // server-side validation endpoints
  'public', // public assets
  'client-errors', // browser error sink
  'mobile-logs', // remote log sink
  'health', // readiness/liveness
  'csp-report', // CSP violation sink
]);

// Proxy entries of the form '/api/x': { fn: 'reports', pathPrefix: '/kpis' }
// are ALSO aligned (dev forwards to an edge fn under a different name). Seed
// known multi-segment redirects so they aren't flagged missing-edge.
const PROXY_REDIRECTS = new Set(['kpis', 'reporting', 'scheduled-reports']);

function walk(dir, exts, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
      walk(full, exts, out);
    } else if (exts.some((e) => entry.endsWith(e))) {
      out.push(full);
    }
  }
  return out;
}

function readAll(files) {
  return files.map((f) => {
    try {
      return readFileSync(f, 'utf-8');
    } catch {
      return '';
    }
  });
}

// First path segment after /api/.
const seg = (p) => p.replace(/^\/?api\//, '').split(/[/?'"`)\s]/)[0];

// 1. Edge functions that exist.
const edgeDir = join(repo, 'supabase', 'functions');
const edgeFns = new Set(
  existsSync(edgeDir)
    ? readdirSync(edgeDir).filter((d) => {
        if (d.startsWith('_') || d.includes('.')) return false;
        try {
          return statSync(join(edgeDir, d)).isDirectory();
        } catch {
          return false;
        }
      })
    : [],
);

// 2. Proxy-map prefixes (dev → edge).
const proxySrc = existsSync(join(repo, 'server/middleware/edge-function-proxy.ts'))
  ? readFileSync(join(repo, 'server/middleware/edge-function-proxy.ts'), 'utf-8')
  : '';
const proxied = new Set([
  ...[...proxySrc.matchAll(/'\/api\/([a-z0-9-]+)'/g)].map((m) => m[1]),
  ...PROXY_REDIRECTS,
]);

// 3. Frontend-called /api/* segments.
const clientText = readAll(walk(join(repo, 'client', 'src'), ['.ts', '.tsx'])).join('\n');
const frontendCalls = new Set(
  [...clientText.matchAll(/['"`]\/api\/([a-z0-9-]+)/g)].map((m) => m[1]),
);

// 4. Express-served /api/* segments (app.METHOD('/api/x') and app.use('/api/x')).
const serverText = readAll(walk(join(repo, 'server'), ['.ts'])).join('\n');
const expressServed = new Set(
  [...serverText.matchAll(/app\.(?:get|post|put|patch|delete|use|all)\(\s*['"`]\/api\/([a-z0-9-]+)/g)].map(
    (m) => m[1],
  ),
);

// Universe of domains to classify: everything the frontend calls, plus every
// edge fn and Express route (so we also surface dead/edge-only).
const domains = new Set([...frontendCalls, ...edgeFns, ...expressServed]);

function classify(d) {
  const fe = frontendCalls.has(d);
  const edge = edgeFns.has(d);
  const exp = expressServed.has(d);
  const px = proxied.has(d);
  if (EXPRESS_CANONICAL.has(d)) return 'express-canonical';
  if (px) return 'proxied'; // dev forwards to edge (possibly under another name) → aligned
  if (fe && !edge) return 'missing-edge';
  if (exp && edge && fe) return 'both-divergent';
  if (exp && edge && !fe) return 'dead-express';
  if (exp && !edge) return 'express-only';
  if (edge && !exp) return 'edge-only';
  return 'other';
}

const rows = [...domains]
  .sort()
  .map((d) => ({
    domain: d,
    frontend: frontendCalls.has(d),
    edge: edgeFns.has(d),
    express: expressServed.has(d),
    proxied: proxied.has(d),
    klass: classify(d),
  }));

const counts = {};
for (const r of rows) counts[r.klass] = (counts[r.klass] || 0) + 1;

const yn = (b) => (b ? '✅' : '·');
const order = [
  'missing-edge',
  'both-divergent',
  'express-only',
  'dead-express',
  'proxied',
  'edge-only',
  'express-canonical',
  'other',
];
const blurb = {
  'missing-edge': 'Frontend calls it, NO edge function → **PROD BLOCKER**',
  'both-divergent': 'Express + edge both exist, not proxied → dev ≠ prod (maintenance trap)',
  'express-only': 'Express handler, no edge function → not yet migrated',
  'dead-express': 'Express + edge exist, no frontend ref → Express likely dead',
  proxied: 'In proxy map → dev forwards to edge (aligned)',
  'edge-only': 'Edge function only, no Express handler → fully migrated',
  'express-canonical': 'Express is canonical by design (agent ingest)',
  other: 'Unclassified',
};

let md = `# Route Parity Matrix (EDGE-012)\n\n`;
md += `> Generated by \`scripts/audit-route-parity.mjs\`. Heuristic (regex over source) — confirm per-domain before acting.\n\n`;
md += `**Architecture:** prod frontend → \`functions.printyx.net/<route>\` (edge) for ALL \`/api/*\` via \`getApiUrl\`. `;
md += `The Express proxy map (${proxied.size} prefixes) only affects **dev**. Express stays canonical for \`/api/client-metrics/*\` (agent) and \`/install/*\`.\n\n`;
md += `**Totals:** ${rows.length} domains · ${edgeFns.size} edge fns · ${expressServed.size} Express-served · ${frontendCalls.size} frontend-called · ${proxied.size} proxied\n\n`;
md += `## Summary by class\n\n| Class | Count | Meaning |\n|---|---|---|\n`;
for (const k of order) if (counts[k]) md += `| \`${k}\` | ${counts[k]} | ${blurb[k]} |\n`;

md += `\n## Action-needed first\n`;
for (const k of ['missing-edge', 'both-divergent']) {
  const list = rows.filter((r) => r.klass === k).map((r) => r.domain);
  md += `\n**${k}** (${list.length}): ${list.length ? list.map((d) => `\`${d}\``).join(', ') : '_none_'}\n`;
}

md += `\n## Full matrix\n\n| Domain | Frontend | Edge fn | Express | Proxied | Class |\n|---|:--:|:--:|:--:|:--:|---|\n`;
for (const k of order) {
  for (const r of rows.filter((x) => x.klass === k)) {
    md += `| \`${r.domain}\` | ${yn(r.frontend)} | ${yn(r.edge)} | ${yn(r.express)} | ${yn(r.proxied)} | \`${r.klass}\` |\n`;
  }
}

const outPath = join(repo, 'docs', 'route-parity-matrix.md');
writeFileSync(outPath, md);

// Machine-readable companion the dev divergence detector loads at startup.
const byClass = (k) => rows.filter((r) => r.klass === k).map((r) => r.domain);
writeFileSync(
  join(repo, 'docs', 'route-divergence.json'),
  JSON.stringify(
    {
      note: 'Generated by scripts/audit-route-parity.mjs — heuristic worklist, not ground truth. Re-run: npm run audit:routes',
      bothDivergent: byClass('both-divergent'),
      missingEdge: byClass('missing-edge'),
      deadExpress: byClass('dead-express'),
      proxied: [...proxied].sort(),
      expressCanonical: [...EXPRESS_CANONICAL].sort(),
    },
    null,
    2,
  ),
);

// Console summary.
console.log('Route parity audit:');
for (const k of order) if (counts[k]) console.log(`  ${k.padEnd(18)} ${counts[k]}`);
console.log(`\nWrote ${outPath}`);
const blockers = rows.filter((r) => r.klass === 'missing-edge').map((r) => r.domain);
if (blockers.length) {
  console.log(`\n⚠ ${blockers.length} potential prod blockers (frontend calls, no edge fn):`);
  console.log('  ' + blockers.join(', '));
}
