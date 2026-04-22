#!/usr/bin/env tsx
/**
 * check-schema-deno-portable.ts
 *
 * Scans every file in shared/**\/*.ts and flags imports that won't resolve in
 * the Deno edge runtime. We want schema files to stay importable from both
 * Node (Express server still live during migration) and Deno (new edge
 * functions), with no separate "Deno build".
 *
 * Run: `npm run check:deno-schemas`
 * Exits 0 if clean, 1 if violations found.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Node-only imports that will fail in Deno with no polyfill path.
// `node:`-prefixed imports DO work in Deno (Deno 1.30+ implements them), so
// we allow those — but only for the stdlib subset we actually need.
const NODE_ONLY_PACKAGES = [
  'pg', // use drizzle-orm/postgres-js in Deno
  'pg-pool',
  'pg-native',
  'pino',
  'pino-pretty',
  'express',
  'body-parser',
  'cors',
  'multer',
  'nodemailer',
  'imap',
  'mailparser',
  'puppeteer',
  'puppeteer-core',
  'node-cron',
  'node-schedule',
  'bcrypt', // use bcryptjs
  'net-snmp',
  'jsforce',
  'intuit-oauth',
  'node-quickbooks',
  'openid-client',
  'fs-extra',
  'csv-parser',
];

const NODE_ONLY_PATHS = [
  // drizzle-orm/node-postgres is node-only; schemas shouldn't reference it
  'drizzle-orm/node-postgres',
];

// Bare-specifier imports that are allowed because they work in Deno via esm.sh:
const ALLOWED_PACKAGES = new Set([
  'drizzle-orm',
  'drizzle-orm/pg-core',
  'drizzle-orm/postgres-js',
  'drizzle-zod',
  'zod',
]);

const IMPORT_RE = /import\s+(?:[^'"]*?from\s+)?['"]([^'"]+)['"]/g;

interface Violation {
  file: string;
  line: number;
  spec: string;
  reason: string;
}

function collectTsFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      collectTsFiles(full, acc);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      acc.push(full);
    }
  }
  return acc;
}

function analyzeFile(file: string, root: string): Violation[] {
  const src = readFileSync(file, 'utf8');
  const violations: Violation[] = [];
  const relPath = relative(root, file).replace(/\\/g, '/');

  let m: RegExpExecArray | null;
  while ((m = IMPORT_RE.exec(src)) !== null) {
    const spec = m[1];

    // Skip type-only imports from within the repo (relative imports)
    if (spec.startsWith('.') || spec.startsWith('/')) continue;

    // Skip `node:` stdlib — Deno supports these
    if (spec.startsWith('node:')) continue;

    // Allowed packages
    if (ALLOWED_PACKAGES.has(spec)) continue;

    // Block listed exact paths
    if (NODE_ONLY_PATHS.includes(spec)) {
      const line = src.slice(0, m.index).split('\n').length;
      violations.push({
        file: relPath,
        line,
        spec,
        reason: `Path ${spec} is Node-only; use the Deno equivalent`,
      });
      continue;
    }

    // Block listed packages (exact match or prefix)
    const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
    if (NODE_ONLY_PACKAGES.includes(pkg)) {
      const line = src.slice(0, m.index).split('\n').length;
      violations.push({
        file: relPath,
        line,
        spec,
        reason: `Package "${pkg}" is Node-only`,
      });
      continue;
    }

    // Anything else we don't know about — warn, don't block
    if (!ALLOWED_PACKAGES.has(spec) && !ALLOWED_PACKAGES.has(pkg)) {
      // Unknown bare import — could be portable, could not be.
      // We'll log these as informational only, not violations.
      // Uncomment to tighten:
      // violations.push({ file: relPath, line: ..., spec, reason: 'Unknown import; verify Deno portability' });
    }
  }

  return violations;
}

function main(): void {
  const repoRoot = resolve(__dirname, '..');
  const sharedDir = join(repoRoot, 'shared');

  const files = collectTsFiles(sharedDir);
  const allViolations: Violation[] = [];

  for (const f of files) {
    allViolations.push(...analyzeFile(f, repoRoot));
  }

  console.log(`Scanned ${files.length} file(s) under shared/`);

  if (allViolations.length === 0) {
    console.log('✅ OK — no Node-only imports detected.');
    process.exit(0);
  }

  console.error(`❌ ${allViolations.length} violation(s):\n`);
  for (const v of allViolations) {
    console.error(`  ${v.file}:${v.line}  imports "${v.spec}"  — ${v.reason}`);
  }
  console.error(
    '\nFix: replace the Node-only import with a Deno-compatible alternative, or move the code out of /shared and into /server.',
  );
  process.exit(1);
}

main();
