#!/usr/bin/env node
/**
 * Routed pages nothing points at — the mirror of check:nav-targets.
 *
 * check:nav-targets asks "does this nav target resolve to a route?". It cannot
 * ask the reverse, and the reverse is a real failure: a page can be routed,
 * permission-gated and complete while NOTHING links to it, so the only way in
 * is typing the URL. CRMX-016 records a whole booking feature - three pages,
 * two edge functions, two proxy entries - sitting unreachable because App.tsx
 * lazily imported the components and never routed them. This is that failure
 * one layer up: routed, and still unreachable.
 *
 * WHAT FOUND IT. COP-B10 and COP-B13 shipped /competitors and /playbooks
 * earlier in this same session with Route lines, navigation-permissions entries
 * and no sidebar entry. check:nav was green - it only checks that targets
 * resolve, and these were not targets. check:orphan-files was green too,
 * because App.tsx lazily imports both, so as FILES they are reachable. Two
 * finished features were invisible to every user and to every guard.
 *
 * WHY THE RULE IS NARROW. Most routes should not be linked from a nav:
 *
 *   - a detail route (/crm/deals/:id) is reached from its list
 *   - a redirect (LegacyRedirect) exists to be typed, not linked
 *   - a public no-shell page (/p/:token) arrives from an email
 *
 * So only PARAMETERLESS routes count, and "pointed at" means named anywhere in
 * client source outside App.tsx - a sidebar entry, a <Link>, a navigate(), a
 * command-palette action, a dashboard widget. That is deliberately generous:
 * the question is whether a user can GET there, not whether it is in the
 * sidebar. On the current tree it reports 70 of 291.
 *
 * Blind spots, stated so a clean run is not read as proof: a path assembled at
 * runtime (`/service/${slug}`) satisfies this check without linking anything,
 * and a link inside a component that is itself unreachable counts as a link -
 * check:orphan-files owns that question.
 *
 * Usage:
 *   node scripts/check-unlinked-routes.mjs
 *   node scripts/check-unlinked-routes.mjs --update-baseline
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const appTsx = join(repo, 'client/src/App.tsx');
const clientSrc = join(repo, 'client/src');
const baselinePath = join(repo, 'docs', 'unlinked-routes-baseline.json');
const update = process.argv.includes('--update-baseline');

/** Comments are stripped on BOTH sides: a commented-out route is not a route,
 *  and a path named only in a comment explaining its removal is not a link. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(entry)) out.push(full);
  }
  return out;
}

const app = stripComments(readFileSync(appTsx, 'utf8'));

const routes = [
  ...new Set(
    [...app.matchAll(/<Route\s[^>]*path=(?:"([^"]+)"|\{`([^`]+)`\}|'([^']+)')/g)]
      .map((m) => m[1] ?? m[2] ?? m[3])
      .filter(Boolean),
  ),
].filter((p) => p.startsWith('/') && p.length > 1 && !p.includes(':') && !p.includes('*'));

/**
 * Files that NAME a path without pointing anybody at it. Excluding them is the
 * difference between this guard working and passing vacuously: caught by
 * mutation, when removing both sidebar entries I had just added left the guard
 * green because navigation-permissions.ts lists every gated path and that read
 * as a link.
 */
const NOT_A_LINK = [
  join(clientSrc, 'lib/navigation-permissions.ts'),
  join(clientSrc, 'lib/rbac-route-helper.ts'),
];

const sources = walk(clientSrc).filter((f) => f !== appTsx && !NOT_A_LINK.includes(f));
const blob = sources.map((f) => stripComments(readFileSync(f, 'utf8'))).join('\n');

/** Named in a string anywhere outside App.tsx, allowing a query or fragment. */
function isPointedAt(path) {
  const escaped = path.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');
  return new RegExp(`['"\`]${escaped}(?:['"\`?#/])`).test(blob);
}

const findings = routes.filter((p) => !isPointedAt(p)).sort();

if (update) {
  writeFileSync(
    baselinePath,
    `${JSON.stringify(
      {
        note:
          'Parameterless routes that nothing in client source links to, so the only way in is ' +
          'typing the URL. Shrink-only. Each is either a page that needs a nav entry or a link, ' +
          'or a page to retire — see scripts/check-unlinked-routes.mjs.',
        count: findings.length,
        routes: findings,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`✓ Baseline written: ${findings.length} unlinked route(s).`);
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  console.error(`✗ Missing ${baselinePath}. Run with --update-baseline to create it.`);
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const known = new Set(baseline.routes ?? []);
const added = findings.filter((p) => !known.has(p));
const gone = [...known].filter((p) => !findings.includes(p));

if (added.length > 0) {
  console.error(`✗ ${added.length} newly routed page(s) that nothing links to:\n`);
  for (const p of added) console.error(`    ${p}`);
  console.error(
    '\n  A routed page with no nav entry and no in-app link is reachable only by typing\n' +
      '  the URL. Add it to the sidebar or link it from where a user would look for it,\n' +
      '  or retire the route. check:nav cannot see this - it checks that TARGETS resolve,\n' +
      '  and a page nothing points at is not a target.',
  );
  process.exit(1);
}

console.log(`✓ No newly unlinked routes (${findings.length} baselined of ${routes.length}).`);

if (gone.length > 0) {
  console.log(`\n  ${gone.length} baselined route(s) now linked or gone:`);
  for (const p of gone.sort()) console.log(`    ${p}`);
  console.log('  Tighten: node scripts/check-unlinked-routes.mjs --update-baseline');
}
