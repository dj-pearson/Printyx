#!/usr/bin/env node
/**
 * Express domains that no client calls (AUDIT-024's Express-side blind spot).
 *
 * CLAUDE.md records that back ends with no caller are the commonest defect
 * shape in this repo, and `check:unreferenced-edge-fns` closed that hole on the
 * EDGE side. Nothing watched the Express side, and five guards each miss it for
 * a different reason:
 *
 *   check:orphan-files          walks pages and components, not routers
 *   check:server-orphans        walks FILE reachability - a router imported by
 *                               routes-registry is "reachable" even if every
 *                               path it serves is dead
 *   check:shadowed-express      finds handlers a proxy shadows; an un-proxied
 *                               router shadows nothing and passes
 *   check:unreferenced-edge-fns needs an edge function to exist
 *   check:routes                classifies FRONTEND-REFERENCED routes only, so
 *                               a route nobody calls is invisible to it by
 *                               design - "missingEdge: 0" means no CALLED route
 *                               lacks an edge function, not that none exists
 *
 * WHAT FOUND IT. CRM-008 (priority 1, marked passing) shipped
 * `record_layout_configs` and `/api/record-layout-config` on Express. Its
 * RecordPageLayout.tsx was never written, nothing calls the endpoint, and there
 * is no edge function, so the route 404s in production and runs for nobody in
 * dev. Every guard above was green.
 *
 * TWO CLASSES, REPORTED SEPARATELY, because they are different problems:
 *
 *   no-edge   Express serves it, no edge function exists, no client calls it.
 *             Dead on both hosts. This is the CRM-008 shape.
 *   edge-too  Express serves it AND an edge function exists, but no client
 *             calls either. Probably a converged domain whose UI was never
 *             built or has been retired - check the edge side before deleting.
 *
 * THE BASELINE IS A WORKLIST, NOT SETTLED DEBT, the same way
 * docs/server-orphans-baseline.json is. Several entries are real features
 * nobody wired (PROD-008c's shape) and several are deletable; this guard cannot
 * tell them apart and should not try.
 *
 * BY RULE, NOT BASELINED: a domain whose caller is not client SOURCE at all.
 * Baselining a known non-defect is where a real one hides, so each exclusion
 * below names its actual caller.
 *
 * Blind spots, stated so a clean run is never read as proof: this works at
 * DOMAIN level (the first path segment after /api), so a router serving one
 * live path and nine dead ones counts as called. It inherits
 * route-parity.mjs's extraction, so a path built by interpolation is invisible
 * on both sides. And a caller outside the client trees - a cron, a webhook, a
 * partner integration - looks identical to no caller, which is why the
 * exclusions below exist.
 *
 * Usage:
 *   node scripts/check-uncalled-express-routes.mjs
 *   node scripts/check-uncalled-express-routes.mjs --update-baseline
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeParity } from './lib/route-parity.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = join(repo, 'docs', 'uncalled-express-baseline.json');
const update = process.argv.includes('--update-baseline');

/**
 * Domains whose caller is real but is not client source, so no walk of the
 * client trees can see it. Each names its caller; an entry without one belongs
 * in the baseline instead.
 */
const CALLED_FROM_ELSEWHERE = {
  'csp-report':
    'The BROWSER posts here, via the CSP report-uri directive set in server/index.ts. No client source references it and none should.',
};

const { expressServed, frontendCalls, edgeFns } = computeParity(repo);

const findings = [...expressServed]
  .filter((domain) => !frontendCalls.has(domain))
  .filter((domain) => !Object.hasOwn(CALLED_FROM_ELSEWHERE, domain))
  .map((domain) => ({ domain, class: edgeFns.has(domain) ? 'edge-too' : 'no-edge' }))
  .sort((a, b) => a.domain.localeCompare(b.domain));

if (update) {
  writeFileSync(
    baselinePath,
    `${JSON.stringify(
      {
        note:
          'Express /api domains no client tree calls. A WORKLIST, not settled debt: some are ' +
          'features nobody wired, some are deletable, and this guard cannot tell them apart. ' +
          'Shrink-only — see scripts/check-uncalled-express-routes.mjs for why five other guards miss these.',
        count: findings.length,
        domains: findings,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`✓ Baseline written: ${findings.length} uncalled Express domain(s).`);
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  console.error(`✗ Missing ${baselinePath}. Run with --update-baseline to create it.`);
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const known = new Set((baseline.domains ?? []).map((d) => d.domain));
const live = new Set(findings.map((f) => f.domain));

const added = findings.filter((f) => !known.has(f.domain));
const gone = [...known].filter((d) => !live.has(d));

if (added.length > 0) {
  console.error(`✗ ${added.length} new Express domain(s) that no client calls:\n`);
  for (const f of added) {
    console.error(
      `    /api/${f.domain}  [${f.class}]${
        f.class === 'no-edge' ? ' — dead on both hosts: prod 404s, dev runs for nobody' : ''
      }`,
    );
  }
  console.error(
    '\n  Either give it a caller, retire it, or - if something outside the client trees\n' +
      '  calls it - add it to CALLED_FROM_ELSEWHERE in this script WITH ITS CALLER NAMED.\n' +
      '  Registering a router is not the same as anybody reaching it (CRM-008).',
  );
  process.exit(1);
}

const noEdge = findings.filter((f) => f.class === 'no-edge').length;
console.log(
  `✓ No new uncalled Express domains (${findings.length} baselined, ${noEdge} of them dead on both hosts).`,
);

if (gone.length > 0) {
  console.log(`\n  ${gone.length} baselined domain(s) now have a caller or are gone:`);
  for (const d of gone.sort()) console.log(`    ${d}`);
  console.log(
    '  Tighten the ratchet: node scripts/check-uncalled-express-routes.mjs --update-baseline',
  );
}
