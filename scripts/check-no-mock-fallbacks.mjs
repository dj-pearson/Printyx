#!/usr/bin/env node
/**
 * COP-I07 guard: keep fabricated data out of CRM/sales surfaces.
 *
 * Two failure modes this catches, both found in the wild in this repo:
 *
 *  1. A mock IDENTIFIER used as a data source — `generateMockTodayData()`,
 *     `const mockAnomalies = [...]` rendered directly. TodayDashboard shipped
 *     a 162-line generator that fired whenever the request failed, so an
 *     outage showed reps invented pipeline, wins and hot leads.
 *
 *  2. A mock returned from a CATCH block. This is the one a naive
 *     `grep '|| mock'` misses entirely, because the fallback hides in
 *     try/catch rather than in a `||` expression. Both real instances in this
 *     repo were of this shape.
 *
 * Scope is deliberately the CRM/sales surfaces this backlog owns, not the whole
 * client — widen DIRS as other domains get cleaned up.
 *
 * Usage: node scripts/check-no-mock-fallbacks.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Files that must stay free of fabricated data. */
const DIRS = [
  'client/src/components/crm',
  'client/src/components/analytics',
  'client/src/components/customer',
  'client/src/components/dashboards',
];

const FILES = [
  'client/src/pages/TodayDashboard.tsx',
  'client/src/pages/DealDetail.tsx',
  'client/src/pages/CrmDealsPage.tsx',
  'client/src/pages/CrmLeadsPage.tsx',
  'client/src/pages/CrmContactsPage.tsx',
  'client/src/pages/CrmCompaniesPage.tsx',
];

// A mock identifier being DEFINED or CALLED. Comments are stripped first, so a
// note explaining a past removal (as in TodayDashboard) does not trip the guard.
const MOCK_IDENT =
  /\b(generateMock\w*|getMock\w*|mockData|MOCK_[A-Z_]+)\b|\bconst\s+mock[A-Z]\w*\s*[:=]/;

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function collect(target) {
  const abs = path.join(ROOT, target);
  if (!fs.existsSync(abs)) return [];
  if (fs.statSync(abs).isFile()) return [target];
  return fs
    .readdirSync(abs, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? collect(path.join(target, e.name))
        : /\.(ts|tsx)$/.test(e.name)
          ? [path.join(target, e.name)]
          : [],
    );
}

const problems = [];
for (const rel of [...DIRS, ...FILES].flatMap(collect)) {
  const raw = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const code = stripComments(raw);

  code.split('\n').forEach((line, i) => {
    if (MOCK_IDENT.test(line)) {
      problems.push({
        rel,
        line: i + 1,
        why: 'mock identifier used as a data source',
        text: line.trim(),
      });
    }
  });

  // catch (...) { ... return <something> } — but only when the fallback INVENTS
  // data. A catch that re-fetches real endpoints is legitimate degradation, not
  // fabrication: role-dashboards.tsx falls back to /api/service-tickets and
  // computes genuine counts, and must not be flagged. The distinction is
  // whether the block goes back to the server for its answer.
  const catchReturn = /catch\s*\([^)]*\)\s*\{[^}]*\breturn\b[^}]*\}/gs;
  let m;
  while ((m = catchReturn.exec(code)) !== null) {
    const block = m[0];
    // Rethrowing or returning nothing is always fine.
    if (/return\s*(;|undefined|null|Promise\.reject|void)/.test(block)) continue;
    // Re-fetching real data is fine.
    if (/\b(apiRequest|fetch|queryClient|axios)\b/.test(block)) continue;
    // Anything else returning a value from a catch is inventing it.
    const line = code.slice(0, m.index).split('\n').length;
    problems.push({
      rel,
      line,
      why: 'catch block returns invented data instead of failing',
      text: block.split('\n')[0].trim(),
    });
  }
}

if (problems.length === 0) {
  console.log('✓ No mock fallbacks in CRM/sales surfaces.');
  process.exit(0);
}

console.error(`✗ Mock-data guard FAILED (${problems.length} problem(s)):\n`);
for (const p of problems) {
  console.error(`    ${p.rel}:${p.line} — ${p.why}`);
  console.error(`        ${p.text}`);
}
console.error(
  '\nFix: render real data, or an honest empty/error state ' +
    '(see client/src/components/ui/not-connected-state.tsx). Never invent numbers.',
);
process.exit(1);
