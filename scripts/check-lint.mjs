// ESLint problem-count ratchet (PA-048).
//
// Enabling real TypeScript linting (eslint.config.js) surfaces a large
// pre-existing backlog, so CI cannot gate on `eslint` exiting 0. Instead this
// RATCHET runs ESLint over the repo, counts total problems (errors +
// warnings), and FAILS only when the count GROWS beyond the committed baseline
// (docs/lint-baseline.json). That lets the backlog be burned down over time
// while guaranteeing no change makes it worse. Same pattern as the typecheck
// ratchet (scripts/check-types.mjs).
//
// Usage:
//   node scripts/check-lint.mjs                  # check against baseline (CI)
//   node scripts/check-lint.mjs --update-baseline    # record current count
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = join(repo, 'docs', 'lint-baseline.json');
const update = process.argv.includes('--update-baseline');

function runEslint() {
  try {
    // ESLint exits 0 when clean, 1 when problems found; both print JSON to
    // stdout. A non-zero exit for any OTHER reason (config error, crash) throws
    // without parseable stdout and is handled below.
    return execFileSync('npx', ['eslint', '.', '--format', 'json'], {
      cwd: repo,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 256 * 1024 * 1024,
    });
  } catch (e) {
    if (e.stdout && e.stdout.trim().startsWith('[')) return e.stdout;
    console.error('✗ ESLint failed to run (not a lint-findings failure):');
    console.error(`${e.stdout || ''}${e.stderr || ''}`.slice(0, 4000));
    process.exit(2);
  }
}

function summarize(jsonText) {
  const report = JSON.parse(jsonText);
  let errors = 0;
  let warnings = 0;
  for (const file of report) {
    errors += file.errorCount || 0;
    warnings += file.warningCount || 0;
  }
  return { errors, warnings, total: errors + warnings };
}

console.log('Running eslint over the repo (this takes a minute)…');
const { errors, warnings, total } = summarize(runEslint());
console.log(`Current: ${total} problems (${errors} errors, ${warnings} warnings).`);

if (update) {
  writeFileSync(
    baselinePath,
    JSON.stringify(
      {
        note:
          'PA-048 ESLint problem-count ratchet baseline. scripts/check-lint.mjs ' +
          'fails CI only when total (errors + warnings) grows above `total`. Lower ' +
          'it (never raise it) as debt is fixed: node scripts/check-lint.mjs --update-baseline.',
        total,
        errors,
        warnings,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`Baseline updated: total=${total}`);
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  console.error(`✗ Missing ${baselinePath}. Run: node scripts/check-lint.mjs --update-baseline`);
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf-8'));
const limit = baseline.total ?? 0;

if (total > limit) {
  console.error(`\n✗ ESLint problems INCREASED: ${total} (baseline ${limit}, +${total - limit}).`);
  console.error('  Fix the new lint problems, or — if intentional — they must reduce the count.');
  console.error('  Re-run locally: npm run lint');
  process.exit(1);
}

if (total < limit) {
  console.log(
    `\n✓ ESLint problems DECREASED: ${total} (baseline ${limit}, -${limit - total}). ` +
      `Tighten the ratchet: node scripts/check-lint.mjs --update-baseline`,
  );
  process.exit(0);
}

console.log(`✓ ESLint problem count holds at ${total} (baseline ${limit}).`);
process.exit(0);
