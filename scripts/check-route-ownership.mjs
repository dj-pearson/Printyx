// Route-ownership ratchet guard (EDGE-018, completes EDGE-017 AC #2).
//
// FAILS (exit 1) when a frontend-referenced /api/* route newly resolves to BOTH
// an Express handler AND an edge function with no proxy-map entry (ambiguous
// ownership = the `both-divergent` class), OR when a new frontend call has no
// edge function at all (`missing-edge` = a prod blocker). "New" means: present
// in the live classification but NOT in docs/route-ownership-baseline.json.
//
// This is a RATCHET, not a big-bang gate: the 60 both-divergent + 56
// missing-edge domains that already exist are grandfathered in the baseline so
// CI stays green today. The guard only fails on REGRESSIONS — a PR that adds a
// brand-new ambiguous or prod-blocking route. When existing debt is resolved,
// drop the domain from the baseline (or run --update-baseline).
//
// Usage:
//   node scripts/check-route-ownership.mjs              # check (CI)
//   node scripts/check-route-ownership.mjs --update-baseline   # rewrite baseline
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeParity } from './lib/route-parity.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = join(repo, 'docs', 'route-ownership-baseline.json');
const update = process.argv.includes('--update-baseline');

const { byClass } = computeParity(repo);
const current = {
  bothDivergent: byClass('both-divergent'),
  missingEdge: byClass('missing-edge'),
};

const note =
  'EDGE-018 ratchet baseline. Grandfathered route-ownership debt as of the audit date. ' +
  'scripts/check-route-ownership.mjs FAILS CI when a NEW both-divergent (ambiguous Express+edge, unproxied) ' +
  'or missing-edge (frontend calls it, no edge fn) domain appears that is not listed here. ' +
  'To resolve debt: fix the domain (proxy/retire/port) and remove it from the matching list, then re-run ' +
  'npm run audit:routes. Regenerate this file with: node scripts/check-route-ownership.mjs --update-baseline';

if (update) {
  writeFileSync(
    baselinePath,
    JSON.stringify(
      { note, bothDivergent: current.bothDivergent, missingEdge: current.missingEdge },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `Baseline updated: bothDivergent=${current.bothDivergent.length} missingEdge=${current.missingEdge.length}`,
  );
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  console.error(
    `✗ Missing ${baselinePath}. Run: node scripts/check-route-ownership.mjs --update-baseline`,
  );
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf-8'));
const baseBoth = new Set(baseline.bothDivergent || []);
const baseMissing = new Set(baseline.missingEdge || []);

const newBoth = current.bothDivergent.filter((d) => !baseBoth.has(d));
const newMissing = current.missingEdge.filter((d) => !baseMissing.has(d));

// Resolved debt is informational — it never fails the build, but we nudge to
// tighten the ratchet so resolved domains can't silently regress later.
const resolvedBoth = [...baseBoth].filter((d) => !current.bothDivergent.includes(d));
const resolvedMissing = [...baseMissing].filter((d) => !current.missingEdge.includes(d));

const fail = newBoth.length > 0 || newMissing.length > 0;

if (newBoth.length) {
  console.error(
    `\n✗ ${newBoth.length} NEW ambiguous-ownership route(s) (both Express + edge, not proxied):`,
  );
  for (const d of newBoth) console.error(`    /api/${d}`);
  console.error(
    '  Fix: add a proxy-map entry (dev→edge), retire the Express handler, or document why Express must stay.',
  );
}
if (newMissing.length) {
  console.error(
    `\n✗ ${newMissing.length} NEW missing-edge route(s) (frontend calls it, NO edge fn → PROD 404):`,
  );
  for (const d of newMissing) console.error(`    /api/${d}`);
  console.error('  Fix: add the edge function, or remove the dead frontend call.');
}

if (resolvedBoth.length || resolvedMissing.length) {
  console.log(
    `\nℹ ${resolvedBoth.length + resolvedMissing.length} baseline domain(s) appear resolved` +
      ` — tighten the ratchet with: node scripts/check-route-ownership.mjs --update-baseline`,
  );
}

if (fail) {
  console.error('\nRoute-ownership guard FAILED (regression introduced).');
  process.exit(1);
}

console.log(
  `✓ Route ownership OK — no new ambiguous or missing-edge routes ` +
    `(${baseBoth.size} both-divergent + ${baseMissing.size} missing-edge grandfathered).`,
);
process.exit(0);
