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

// A broken toolchain must never look like progress (PROD-001).
//
// On the wrong Node major, engine-strict aborts `npm install` and leaves
// node_modules empty. `tsc` then bails on tsconfig OPTION diagnostics before it
// typechecks a single file, so countErrors() returned 2 — and 2 < baseline meant
// this ratchet printed "errors DECREASED" and exited 0 on an unusable tree,
// inviting someone to tighten the baseline to 2 and destroy the ratchet for good.
//
// Two precise guards (not heuristics on the count, since a real decrease is the
// whole point of the ratchet):
//   1. typescript isn't installed at all
//   2. every diagnostic is config-level (TS5xxx/TS6xxx), meaning tsc never
//      reached the program — impossible to reconcile with a non-zero baseline
function assertTscActuallyRan(out, limit) {
  if (!existsSync(join(repo, 'node_modules', 'typescript', 'package.json'))) {
    console.error('\n✗ typescript is not installed — tsc did not run, so this count is meaningless.');
    console.error('  This is a toolchain failure, not a type-debt change.');
    console.error('  Check your Node version, then reinstall:');
    console.error('    node scripts/check-node-version.mjs && npm install');
    process.exit(1);
  }

  // Prove the compiler is actually invocable. If `tsc --version` can't run,
  // every count below is fiction.
  try {
    execSync('npx tsc --version', {
      cwd: repo,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    console.error('\n✗ `npx tsc --version` failed — the compiler is not runnable.');
    console.error('  This count reflects a broken toolchain, not the codebase.');
    console.error('    node scripts/check-node-version.mjs && npm install');
    process.exit(1);
  }

  // A jump straight to zero from a large baseline is the signature of "tsc never
  // produced diagnostics" (missing binary, empty tree, silent crash) far more
  // often than a genuine clean sweep. Someone who really did fix them all can
  // say so explicitly rather than have it inferred from an absence of output.
  if (countErrors(out) === 0 && limit > 0 && !process.argv.includes('--allow-zero')) {
    console.error(`\n✗ tsc reported ZERO errors against a baseline of ${limit}.`);
    console.error('  Refusing to treat "no output" as "no errors" — that is how a broken');
    console.error('  toolchain silently retires this ratchet.');
    console.error('  If the codebase really is clean, confirm it explicitly:');
    console.error('    node scripts/check-types.mjs --allow-zero');
    process.exit(1);
  }

  const diagnostics = out.match(/: error TS(\d+)/g) || [];
  const allConfigLevel =
    diagnostics.length > 0 && diagnostics.every((d) => /TS[56]\d{3}$/.test(d.trim()));

  if (allConfigLevel && limit > 0) {
    console.error(
      `\n✗ tsc emitted only tsconfig-level diagnostics (${diagnostics.length}) and never typechecked.`,
    );
    console.error('  Refusing to compare that against a baseline of ' + limit + '.');
    console.error('  Usually a wrong Node version / empty node_modules:');
    console.error('    node scripts/check-node-version.mjs && npm install');
    console.error('\n  tsc said:');
    console.error(
      out
        .split('\n')
        .filter((l) => l.includes(': error TS'))
        .slice(0, 5)
        .map((l) => '    ' + l.trim())
        .join('\n'),
    );
    process.exit(1);
  }
}

console.log('Running tsc --noEmit (this takes a couple of minutes)…');
const out = runTsc();
const count = countErrors(out);

// Read any existing baseline BEFORE branching, so the toolchain guard protects
// --update-baseline too. That path is the dangerous one: recording 2 as the
// baseline off a broken tree would silently retire the ratchet.
const priorBaseline = existsSync(baselinePath)
  ? JSON.parse(readFileSync(baselinePath, 'utf-8'))
  : null;
assertTscActuallyRan(out, priorBaseline?.total ?? 0);

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

if (!priorBaseline) {
  console.error(`✗ Missing ${baselinePath}. Run: node scripts/check-types.mjs --update-baseline`);
  process.exit(1);
}

const limit = priorBaseline.total ?? 0;

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
