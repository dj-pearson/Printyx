// Route-ownership ratchet guard (EDGE-018, completes EDGE-017 AC #2).
//
// FAILS (exit 1) when a frontend-referenced /api/* route newly resolves to BOTH
// an Express handler AND an edge function with no proxy-map entry (ambiguous
// ownership = the `both-divergent` class), OR when a new frontend call has no
// edge function at all (`missing-edge` = a prod blocker). "New" means: present
// in the live classification but NOT in docs/route-ownership-baseline.json.
//
// LIVE/DEAD: a missing-edge domain only gates when a file REACHABLE from
// App.tsx/main.tsx calls it. An orphaned page's fetch never runs, so failing CI
// over it blocks a 404 nobody can hit and buries the real ones — the same rule
// scripts/check-nav-targets.mjs applies to nav targets. New domains whose only
// callers are orphans are REPORTED (dead-code worklist), not gated. Of the
// grandfathered missing-edge set, 34 are live prod 404s and 10 are dead callers.
//
// This is a RATCHET, not a big-bang gate: the both-divergent + missing-edge
// domains that already exist are grandfathered in the baseline so CI stays green
// today. The guard only fails on REGRESSIONS — a PR that adds a brand-new
// ambiguous or prod-blocking route. When existing debt is resolved, drop the
// domain from the baseline (or run --update-baseline). The baseline stores the
// FULL missing-edge list (a superset of the live one), so it keeps working as a
// membership test regardless of which side of the split a domain is on.
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

const { byClass, byClassLive, byClassDead, reachabilityTrusted, unfollowableImportFile } =
  computeParity(repo);

if (!reachabilityTrusted) {
  console.log(
    `ℹ LIVE/DEAD split DISABLED — ${unfollowableImportFile} uses an import this walk cannot follow` +
      ` (import.meta.glob or a computed specifier), so every call is treated as live and gates.` +
      ` This is the fail-safe direction; teach reachableClientFiles() the pattern to re-enable it.`,
  );
}
const current = {
  bothDivergent: byClass('both-divergent'),
  missingEdge: byClass('missing-edge'),
  // PA-022: the subset nothing serves on EITHER host. It used to be folded into
  // missing-edge, which reads as "works in dev, 404s in prod" and is the wrong
  // instruction: here there is no handler to proxy or port, so the fix is to
  // build the endpoint or delete the call. It is empty today and gated at zero
  // rather than baselined, because a domain in it is broken for everyone -
  // there is no dev-only grace period in which someone might notice.
  deadInBoth: byClass('dead-in-both'),
};

// A missing-edge domain is only a PROD BLOCKER when a file a user can actually
// reach calls it. Orphaned callers produce a fetch that never runs, so gating on
// them fails CI for a 404 nobody can hit — and, worse, buries the real ones.
// Only LIVE domains gate; dead ones are reported as a dead-code worklist.
// Same LIVE/DEAD split, and the same rule, as scripts/check-nav-targets.mjs.
const liveMissing = new Set(byClassLive('missing-edge'));
const deadMissing = byClassDead('missing-edge');
const liveDeadInBoth = byClassLive('dead-in-both');
const deadDeadInBoth = byClassDead('dead-in-both');

const note =
  'EDGE-018 ratchet baseline. Grandfathered route-ownership debt as of the audit date. ' +
  'scripts/check-route-ownership.mjs FAILS CI when a NEW both-divergent (ambiguous Express+edge, unproxied) ' +
  'or missing-edge (frontend calls it, no edge fn) domain appears that is not listed here. ' +
  'To resolve debt: fix the domain (proxy/retire/port) and remove it from the matching list, then re-run ' +
  'npm run audit:routes. Regenerate this file with: node scripts/check-route-ownership.mjs --update-baseline. ' +
  'EDGE-020 (2026-07-29): bothDivergent GREW 59 -> 69, which is a DETECTION FIX, not a regression. Express ' +
  'detection previously matched only app.METHOD("/api/x"), missing every route declared on a Router — both ' +
  'the absolute form (router.get("/api/x") + app.use(router)) and the prefixed form (router.get("/x") + ' +
  'app.use("/api", router)). Those 10 domains were always divergent; the tool simply could not see them, and ' +
  'reported several as edge-only "fully migrated". Each was hand-verified before baselining. PA-022 (2026-08-30): the dead-in-both class was split out of missing-edge - a domain a live page calls that NEITHER Express nor an edge function serves. It is gated at zero rather than grandfathered, so deadInBoth here should always be empty; if it is not, something was baselined that should have been fixed.';

if (update) {
  writeFileSync(
    baselinePath,
    JSON.stringify(
      {
        note,
        bothDivergent: current.bothDivergent,
        missingEdge: current.missingEdge,
        deadInBoth: current.deadInBoth,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `Baseline updated: bothDivergent=${current.bothDivergent.length}` +
      ` missingEdge=${current.missingEdge.length} deadInBoth=${current.deadInBoth.length}`,
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
// Gate on LIVE only (see the liveMissing comment above). The baseline still
// stores the FULL list, so it stays a superset — a domain that is new AND live
// is caught, and a dead one is merely reported.
const newMissing = current.missingEdge.filter((d) => !baseMissing.has(d) && liveMissing.has(d));
const newMissingDead = current.missingEdge.filter(
  (d) => !baseMissing.has(d) && !liveMissing.has(d),
);

// Resolved debt is informational — it never fails the build, but we nudge to
// tighten the ratchet so resolved domains can't silently regress later.
const resolvedBoth = [...baseBoth].filter((d) => !current.bothDivergent.includes(d));
const resolvedMissing = [...baseMissing].filter((d) => !current.missingEdge.includes(d));

// deadInBoth is NOT baselined away: it is at zero and stays there. Only a live
// caller gates, for the same reason missing-edge does - a call inside an
// orphaned file can never run.
const fail = newBoth.length > 0 || newMissing.length > 0 || liveDeadInBoth.length > 0;

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

if (liveDeadInBoth.length) {
  console.error(
    `\n✗ ${liveDeadInBoth.length} route(s) that NOTHING serves - no Express handler and no edge` +
      ` function - called from a live page:`,
  );
  for (const d of liveDeadInBoth) console.error(`    /api/${d}`);
  console.error(
    '  This is broken on every host, not just production, and presents as an empty section rather',
  );
  console.error(
    '  than an error. Fix: build the endpoint, or delete the call. Do NOT baseline it.',
  );
}

if (deadDeadInBoth.length) {
  console.log(
    `\nℹ ${deadDeadInBoth.length} domain(s) nothing serves whose only callers are orphaned files` +
      ` - not gated, since the call can never run:`,
  );
  for (const d of deadDeadInBoth) console.log(`    /api/${d}`);
}

if (newMissingDead.length) {
  console.log(
    `\nℹ ${newMissingDead.length} new missing-edge domain(s) whose ONLY callers are orphaned files` +
      ` — not gated, since the call can never run:`,
  );
  for (const d of newMissingDead) console.log(`    /api/${d}`);
  console.log('  Fix: delete the dead caller (a dead-code story), or wire the page up.');
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
    `(${baseBoth.size} both-divergent + ${baseMissing.size} missing-edge grandfathered; ` +
    `of the grandfathered missing-edge, ${liveMissing.size} are LIVE prod 404s and ` +
    `${deadMissing.length} have only orphaned callers; ` +
    `${current.deadInBoth.length} served-by-nothing, gated at zero).`,
);
process.exit(0);
