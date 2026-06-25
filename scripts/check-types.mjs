// TypeScript-error ratchet (QUALITY-002 / QUALITY-003).
//
// The repo does not typecheck clean (thousands of pre-existing errors), so we
// can't gate CI on `tsc` exiting 0. Instead this RATCHET runs `tsc --noEmit`,
// counts the errors, and FAILS only when the count GROWS beyond the committed
// baseline (docs/typecheck-baseline.json). That lets the codebase burn the
// debt down over time while guaranteeing no PR makes it worse.
//
// Usage:
//   node scripts/check-types.mjs                 # check against baseline (CI)
//   node scripts/check-types.mjs --update-baseline   # record current count
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = join(repo, 'docs', 'typecheck-baseline.json');
const update = process.argv.includes('--update-baseline');

function runTsc() {
  try {
    // tsc exits 0 when clean; capture either way.
    const out = execSync('npx tsc --noEmit --pretty false', {
      cwd: repo,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=8192' },
    });
    return out;
  } catch (e) {
    // Non-zero exit (errors present) — stdout holds the diagnostics.
    return `${e.stdout || ''}${e.stderr || ''}`;
  }
}

function countErrors(out) {
  // Prefer tsc's own summary line, e.g. "Found 6176 errors in 412 files."
  const m = out.match(/Found (\d+) errors? in \d+ files?\./);
  if (m) return Number(m[1]);
  // Fallback: count primary diagnostic lines ("path(line,col): error TSxxxx").
  return (out.match(/: error TS\d+/g) || []).length;
}

console.log('Running tsc --noEmit (this takes a couple of minutes)…');
const out = runTsc();
const count = countErrors(out);

if (update) {
  writeFileSync(
    baselinePath,
    JSON.stringify(
      {
        note: 'QUALITY-002 tsc-error ratchet baseline. scripts/check-types.mjs fails CI only when the error count grows above `total`. Lower it (never raise it) as debt is fixed: node scripts/check-types.mjs --update-baseline.',
        total: count,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`Baseline updated: total=${count}`);
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  console.error(`✗ Missing ${baselinePath}. Run: node scripts/check-types.mjs --update-baseline`);
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf-8'));
const limit = baseline.total ?? 0;

if (count > limit) {
  console.error(
    `\n✗ TypeScript errors INCREASED: ${count} (baseline ${limit}, +${count - limit}).`,
  );
  console.error('  Fix the new type errors, or — if intentional — they must reduce the count.');
  console.error('  Re-run locally: npm run check');
  process.exit(1);
}

if (count < limit) {
  console.log(
    `\n✓ TypeScript errors DECREASED: ${count} (baseline ${limit}, -${limit - count}). ` +
      `Tighten the ratchet: node scripts/check-types.mjs --update-baseline`,
  );
  process.exit(0);
}

console.log(`✓ TypeScript error count holds at ${count} (baseline ${limit}).`);
process.exit(0);
