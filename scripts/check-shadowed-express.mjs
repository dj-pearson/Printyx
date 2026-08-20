#!/usr/bin/env node
/**
 * check-shadowed-express.mjs — PROD-008 ratchet.
 *
 * Express matches the FIRST handler registered for a path, and
 * registerEdgeFunctionProxy runs before every domain registration. So any
 * Express handler whose path sits under a crmProxies prefix is unreachable: the
 * proxy claims the request in dev, and production never reaches Express at all
 * (the frontend rewrites /api/x to functions.printyx.net/x with no fallback).
 *
 * That is a hazard, not tidy-up. EDGE-016 is the worked example: nine
 * monitoring-clients handlers sat behind a proxy entry and had silently drifted
 * from the live copy - the UI called /regenerate-key while Express implemented
 * /rotate-key - so a fix applied there would have looked shipped and changed
 * nothing.
 *
 * The baseline is the backlog. It only shrinks: retire the handler, or port what
 * it does into the edge function and then retire it.
 *
 * Usage:
 *   node scripts/check-shadowed-express.mjs                  # check (CI)
 *   node scripts/check-shadowed-express.mjs --update-baseline
 *   node scripts/check-shadowed-express.mjs --list
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const repo = join(fileURLToPath(import.meta.url), '..', '..');
const proxyPath = join(repo, 'server', 'middleware', 'edge-function-proxy.ts');
const baselinePath = join(repo, 'docs', 'shadowed-express-baseline.json');
const update = process.argv.includes('--update-baseline');
const list = process.argv.includes('--list');

/** Every prefix in the crmProxies map. Both the string and object forms. */
function proxiedPrefixes() {
  const src = readFileSync(proxyPath, 'utf8');
  const start = src.indexOf('const crmProxies');
  const end = src.indexOf('for (const [prefix, functionName]');
  if (start < 0 || end < 0) {
    console.error('Could not locate the crmProxies map in edge-function-proxy.ts.');
    process.exit(1);
  }
  return [...src.slice(start, end).matchAll(/'(\/api\/[^']+)':/g)].map((m) => m[1]);
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    // tests/ describe routes in fixtures and assertions, not registrations.
    if (entry === 'node_modules' || entry === 'tests') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.ts$/.test(entry)) out.push(full);
  }
  return out;
}

const prefixes = proxiedPrefixes();
// Longest first, so /api/public/calculator is reported against itself rather
// than against /api/public.
prefixes.sort((a, b) => b.length - a.length);

const findings = [];
for (const file of walk(join(repo, 'server'))) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/(?:app|router)\.(get|post|put|patch|delete)\(\s*'(\/api\/[^']+)'/g)) {
    const path = m[2];
    const prefix = prefixes.find((p) => path === p || path.startsWith(p + '/'));
    if (!prefix) continue;
    findings.push({
      file: relative(repo, file).replace(/\\/g, '/'),
      line: src.slice(0, m.index).split('\n').length,
      route: `${m[1].toUpperCase()} ${path}`,
      prefix,
    });
  }
}
findings.sort((a, b) => a.route.localeCompare(b.route) || a.file.localeCompare(b.file));

// Keyed on route + file, not line, so reformatting neither invents nor retires
// a finding.
const key = (f) => `${f.route} (${f.file})`;

if (list) {
  const byPrefix = new Map();
  for (const f of findings) {
    if (!byPrefix.has(f.prefix)) byPrefix.set(f.prefix, []);
    byPrefix.get(f.prefix).push(f);
  }
  for (const [prefix, rows] of [...byPrefix.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n${prefix}  (${rows.length})`);
    for (const r of rows) console.log(`    ${r.route}  ${r.file}:${r.line}`);
  }
  console.log(
    `\n${findings.length} shadowed handler(s) across ${byPrefix.size} of ${prefixes.length} proxied prefixes.`,
  );
  process.exit(0);
}

if (update) {
  writeFileSync(
    baselinePath,
    JSON.stringify(
      {
        note:
          'PROD-008: Express handlers under a crmProxies prefix. The proxy is registered first, ' +
          'so these never run in dev; production never reaches Express at all. Each is either dead ' +
          'code to delete or behaviour to port into the edge function and then delete. This list ' +
          'only shrinks.',
        allowed: [...new Set(findings.map(key))].sort(),
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`✓ Baseline updated: ${new Set(findings.map(key)).size} shadowed handler(s).`);
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  console.error(`Missing ${relative(repo, baselinePath)}. Run with --update-baseline first.`);
  process.exit(1);
}

const allowed = new Set(JSON.parse(readFileSync(baselinePath, 'utf8')).allowed);
const novel = findings.filter((f) => !allowed.has(key(f)));

if (novel.length > 0) {
  console.error(`✗ ${novel.length} NEW shadowed Express handler(s):\n`);
  for (const f of novel) console.error(`  ${f.route}  ${f.file}:${f.line}  (under ${f.prefix})`);
  console.error(
    '\nThe edge-function proxy claims this prefix before any domain route registers, and\n' +
      'production never reaches Express. A handler here is dead on arrival - implement it in\n' +
      'the matching supabase/functions/ directory instead.',
  );
  process.exit(1);
}

const fixed = [...allowed].filter((a) => !findings.some((f) => key(f) === a));
if (fixed.length > 0) {
  console.log(`✓ No new shadowed handlers. ${fixed.length} baselined entr(ies) are gone:`);
  for (const f of fixed.slice(0, 10)) console.log(`    ${f}`);
  if (fixed.length > 10) console.log(`    …and ${fixed.length - 10} more`);
  console.log('  Tighten with: node scripts/check-shadowed-express.mjs --update-baseline');
} else {
  console.log(`✓ No new shadowed Express handlers (${allowed.size} known).`);
}
