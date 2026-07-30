// Node-version preflight (PROD-001).
//
// package.json pins `engines.node: "20.x"` and .npmrc sets `engine-strict=true`.
// On the wrong major, `npm install` ABORTS and leaves node_modules EMPTY — and
// every downstream command then fails in a way that points at the code instead
// of at the toolchain:
//
//   - `tsc` reports only a couple of tsconfig option errors (it bails before it
//     ever typechecks), which made the type ratchet report "errors DECREASED"
//     and exit 0 on a completely unusable tree
//   - `vitest` is simply absent, so the test suite "has no tests"
//   - the app looks catastrophically broken when nothing is wrong with it
//
// This script is intentionally DEPENDENCY-FREE (it runs as `preinstall`, before
// anything is installed) and reads the required range from package.json so there
// is exactly one source of truth.
//
// Usage:
//   node scripts/check-node-version.mjs        # exit 1 with an actionable message
//   node scripts/check-node-version.mjs --warn # never exit non-zero (advisory)
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const warnOnly = process.argv.includes('--warn');

const pkg = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf-8'));
const required = pkg.engines?.node ?? '';

// We only need the major from a "20.x"-style pin — deliberately not a full
// semver-range implementation, since that would need a dependency.
const wantMajor = Number(required.match(/(\d+)/)?.[1]);
const haveMajor = Number(process.versions.node.split('.')[0]);

if (!Number.isFinite(wantMajor)) {
  // Nothing to enforce — don't invent a constraint.
  process.exit(0);
}

if (haveMajor === wantMajor) {
  process.exit(0);
}

const msg = [
  '',
  '━'.repeat(72),
  `  Wrong Node version: you are on v${process.versions.node}, this repo requires ${required}`,
  '━'.repeat(72),
  '',
  '  .npmrc sets engine-strict=true, so `npm install` will ABORT on this',
  '  version and leave node_modules EMPTY. Every command you run afterwards',
  '  will fail for a reason that has nothing to do with the actual cause:',
  '',
  `    - tsc bails before typechecking and reports only tsconfig errors`,
  `    - vitest is missing entirely, so the suite reports no tests`,
  `    - the app appears broken when it is not`,
  '',
  `  Fix: switch to Node ${wantMajor} and install again.`,
  '',
  `    nvm use ${wantMajor}          # or: fnm use ${wantMajor}`,
  '    npm install',
  '',
  `  The pinned version also lives in .nvmrc (currently ${wantMajor}).`,
  '━'.repeat(72),
  '',
].join('\n');

if (warnOnly) {
  console.warn(msg);
  process.exit(0);
}

console.error(msg);
process.exit(1);
