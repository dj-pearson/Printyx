#!/usr/bin/env node
// Guaranteed-throw TypeScript errors — a HARD GATE, not a ratchet.
//
// Most tsc diagnostics describe a type mismatch: the code runs, it just may not
// mean what you think. A handful guarantee a RUNTIME THROW on the very first
// execution of that line:
//
//   TS2304  Cannot find name 'x'                    → ReferenceError
//   TS2552  Cannot find name 'x'. Did you mean 'y'? → ReferenceError (typo)
//   TS2448  Block-scoped variable used before declaration → TDZ ReferenceError
//   TS2454  Variable is used before being assigned        → TDZ ReferenceError
//
// These are bug reports, not type debt. Three live crashes were found in one
// sweep precisely because they had been sitting inside the 1000-plus error
// budget that check-types.mjs counts:
//   - EnhancedOnboardingForm white-screened on mount (TS2448 on a useEffect
//     dependency array placed above its useForm call);
//   - POST /api/contract-renewal/proposals/:id/send threw on every call (TS2552,
//     a shorthand property one letter off from the variable in scope);
//   - the signup-crm conversion funnel threw on every call (TS2448, a local
//     shadowing drizzle's count() inside its own initializer).
//
// So this check is zero-tolerance, with one recorded exclusion. Adding a file to
// EXCLUDED requires a reason a reviewer can check.
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');

const CODES = ['TS2304', 'TS2552', 'TS2448', 'TS2454'];

// Files allowed to carry these errors, each with the reason it cannot be fixed
// by editing the file alone.
const EXCLUDED = new Map([
  [
    'server/routes-predictive-service-dispatch.ts',
    'References serviceCallsEnhanced / equipmentMetrics / technicianResourcesEnhanced, ' +
      'which exist in no schema or migration. These endpoints already fail at runtime; ' +
      'fixing them needs new tables plus a migration, not an import. Tracked in CLAUDE.md.',
  ],
]);

function runTsc() {
  try {
    return execSync('npx tsc --noEmit --pretty false', {
      cwd: repo,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=8192' },
    });
  } catch (e) {
    return `${e.stdout || ''}${e.stderr || ''}`;
  }
}

const out = runTsc();
const pattern = new RegExp(`^(\\S+?)\\((\\d+),\\d+\\): error (${CODES.join('|')}): (.*)$`);

const findings = [];
for (const line of out.split('\n')) {
  const m = pattern.exec(line.trim());
  if (!m) continue;
  const file = m[1].replace(/\\/g, '/');
  if (EXCLUDED.has(file)) continue;
  findings.push({ file, line: Number(m[2]), code: m[3], message: m[4] });
}

if (findings.length > 0) {
  console.error(`✗ ${findings.length} error(s) that throw at runtime, not type mismatches:\n`);
  for (const f of findings) {
    console.error(`    ${f.file}:${f.line}  ${f.code}: ${f.message}`);
  }
  console.error(
    '\n  Each of these is a ReferenceError the first time that line runs.\n' +
      '  Fix them; do not absorb them into the check-types baseline.',
  );
  process.exit(1);
}

const excused = [...EXCLUDED.keys()].length;
console.log(
  `✓ No runtime-throwing type errors (${CODES.join(', ')}); ${excused} file(s) excluded by record.`,
);
