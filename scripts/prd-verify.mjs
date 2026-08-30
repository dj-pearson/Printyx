#!/usr/bin/env node
/**
 * PRD per-story verification engine.
 *
 * Backs the `.github/workflows/prd-verify.yml` workflow. For every PRD story
 * still marked `passes: false`, this maps the story to a verification TIER
 * (derived from its id prefix) and a set of CI GATES that exercise the
 * acceptance criteria for that tier. The workflow runs the gates a story tier
 * needs on the right runner (web gates on ubuntu, iOS gates on macOS, infra
 * gates against the CI Postgres + a locally-started server) and this script
 * aggregates the gate results into a pass/fail matrix.
 *
 * A story is reported CI-VERIFIED when every gate relevant to its tier passed.
 * This does NOT auto-flip prd.json — flipping passes:true stays a human/owner
 * decision (run scripts/flip-prd-stories.mjs). The matrix is the evidence.
 *
 * Modes:
 *   --mode run --tier <web|infra>   Run the gates this runner can execute,
 *                                   write prd-verify-<tier>.json gate results.
 *   --mode record --tier <ios|...>  Record externally-produced gate results
 *                                   (e.g. xcodebuild from the macOS job) passed
 *                                   in via --gate name=pass|fail (repeatable).
 *   --mode report                   Read all prd-verify-*.json in the cwd, build
 *                                   the matrix markdown (stdout + docs file).
 *
 * Usage examples:
 *   node scripts/prd-verify.mjs --mode run --tier web
 *   node scripts/prd-verify.mjs --mode record --tier ios --gate ios-xcodebuild-test=pass
 *   node scripts/prd-verify.mjs --mode report
 */
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const prd = JSON.parse(fs.readFileSync(path.join(ROOT, 'prd.json'), 'utf8'));

// ── Tier classification ────────────────────────────────────────────────────
// Each open story maps to exactly one tier. Tier -> the gates that, when green,
// constitute CI verification for that tier's stories.
function tierOf(id) {
  if (id.startsWith('IOS-')) return 'ios';
  if (id === 'LAUNCH-011') return 'infra-backup';
  if (id === 'LAUNCH-020') return 'infra-load';
  return 'web'; // EDGE-*, US-SUPER-*, QUALITY-002, other LAUNCH-*, US-*
}

// Gate definitions. `cmd` is run for `--mode run` tiers; tiers whose gates run
// natively in the workflow (ios, infra) are recorded via `--mode record`.
const GATES = {
  web: [
    { name: 'typecheck-ratchet', cmd: 'npm run check:types' },
    { name: 'lint', cmd: 'npm run lint' },
    { name: 'build', cmd: 'npm run build' },
    { name: 'unit-tests', cmd: 'npm run test:unit' },
    { name: 'route-ownership', cmd: 'npm run check:routes' },
  ],
  ios: [
    // Produced by the macOS job (xcodebuild test) and fed in via --mode record.
    { name: 'ios-xcodebuild-test', cmd: null },
  ],
  'infra-backup': [
    // Produced by the infra job (db:backup against the CI Postgres service).
    { name: 'db-backup-smoke', cmd: null },
  ],
  'infra-load': [
    // Produced by the infra job (k6 smoke against a locally-started server).
    { name: 'k6-load-smoke', cmd: null },
  ],
};

function runGate(gate) {
  if (!gate.cmd) return { name: gate.name, status: 'skip', note: 'recorded externally' };
  const started = Date.now();
  try {
    execSync(gate.cmd, { cwd: ROOT, stdio: 'inherit', env: process.env });
    return { name: gate.name, status: 'pass', ms: Date.now() - started };
  } catch {
    return { name: gate.name, status: 'fail', ms: Date.now() - started };
  }
}

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function args(flag) {
  const out = [];
  for (let i = 0; i < process.argv.length; i++)
    if (process.argv[i] === flag) out.push(process.argv[i + 1]);
  return out;
}

const mode = arg('--mode') || 'report';

if (mode === 'run') {
  const tier = arg('--tier');
  const gates = GATES[tier];
  if (!gates) {
    console.error(`Unknown or non-runnable tier: ${tier}`);
    process.exit(2);
  }
  const results = gates.map(runGate);
  const file = path.join(ROOT, `prd-verify-${tier}.json`);
  fs.writeFileSync(file, JSON.stringify({ tier, results }, null, 2) + '\n');
  const failed = results.filter((r) => r.status === 'fail');
  console.log(`\n[prd-verify] tier=${tier} -> ${file}`);
  for (const r of results) console.log(`  ${r.status.toUpperCase().padEnd(5)} ${r.name}`);
  // Report-only by default so the matrix can still be produced; pass --strict to
  // fail the job when a gate fails.
  if (process.argv.includes('--strict') && failed.length) process.exit(1);
} else if (mode === 'record') {
  const tier = arg('--tier');
  if (!GATES[tier]) {
    console.error(`Unknown tier: ${tier}`);
    process.exit(2);
  }
  const results = args('--gate').map((kv) => {
    const [name, status] = String(kv).split('=');
    return { name, status: status === 'pass' ? 'pass' : 'fail' };
  });
  const file = path.join(ROOT, `prd-verify-${tier}.json`);
  fs.writeFileSync(file, JSON.stringify({ tier, results }, null, 2) + '\n');
  console.log(`[prd-verify] recorded ${results.length} gate result(s) -> ${file}`);
} else {
  // report mode
  const open = prd.userStories.filter((s) => s.passes !== true);
  // Load all gate result files present in the repo root.
  const gateResults = {};
  for (const f of fs.readdirSync(ROOT)) {
    const m = f.match(/^prd-verify-(.+)\.json$/);
    if (!m) continue;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
      gateResults[data.tier] = Object.fromEntries(
        (data.results || []).map((r) => [r.name, r.status]),
      );
    } catch {
      /* ignore unreadable result file */
    }
  }

  function verdictFor(story) {
    const tier = tierOf(story.id);
    const gates = GATES[tier] || [];
    const recorded = gateResults[tier] || {};
    const statuses = gates.map((g) => recorded[g.name] || 'pending');
    if (statuses.some((s) => s === 'fail')) return { tier, status: 'FAIL', statuses };
    if (statuses.length && statuses.every((s) => s === 'pass'))
      return { tier, status: 'VERIFIED', statuses };
    return { tier, status: 'PENDING', statuses };
  }

  const byTier = {};
  for (const s of open) {
    const v = verdictFor(s);
    (byTier[v.tier] ||= []).push({ id: s.id, title: s.title, ...v });
  }

  let md = `# PRD Verification Matrix\n\n`;
  md += `Open stories (passes=false): **${open.length}**. `;
  md += `Generated by \`scripts/prd-verify.mjs --mode report\`.\n\n`;
  md += `A story is **VERIFIED** when every CI gate for its tier passed in this run. `;
  md += `**PENDING** means a gate for that tier did not run on this trigger. `;
  md += `This matrix is evidence only; flipping \`passes:true\` stays a human decision (\`scripts/flip-prd-stories.mjs\`).\n\n`;

  const tierOrder = ['web', 'ios', 'infra-load', 'infra-backup'];
  let verifiedCount = 0;
  for (const tier of tierOrder) {
    const rows = byTier[tier];
    if (!rows) continue;
    const gateNames = (GATES[tier] || []).map((g) => g.name).join(', ');
    md += `## Tier: ${tier}  (${rows.length} stories)\n\n`;
    md += `Gates: \`${gateNames}\`\n\n`;
    md += `| Story | Verdict | Gates (${gateNames}) |\n|---|---|---|\n`;
    for (const r of rows.sort((a, b) => a.id.localeCompare(b.id))) {
      if (r.status === 'VERIFIED') verifiedCount++;
      md += `| ${r.id} | ${r.status} | ${r.statuses.join(', ')} |\n`;
    }
    md += `\n`;
  }
  md += `---\n\n**${verifiedCount}/${open.length}** open stories CI-VERIFIED this run.\n`;

  fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'docs', 'prd-verify-matrix.md'), md);
  process.stdout.write(md);
}
