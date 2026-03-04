#!/usr/bin/env npx tsx
/**
 * SEC-007: Dependency Security Check
 *
 * Verifies dependency integrity and detects potential supply-chain attacks:
 * - Typosquatting detection for critical packages (fuzzy matching)
 * - package-lock.json integrity verification
 * - Flagging packages with install scripts from unknown publishers
 *
 * Run with: npx tsx scripts/dependency-check.ts
 * Or:       npm run audit:deps
 */

import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { execSync } from 'child_process';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Critical dependencies that are high-value targets for typosquatting.
 * Each entry contains the canonical name and common misspellings to watch for.
 */
const CRITICAL_PACKAGES: Array<{ canonical: string; description: string }> = [
  { canonical: 'express', description: 'Web framework' },
  { canonical: 'drizzle-orm', description: 'Database ORM' },
  { canonical: '@supabase/supabase-js', description: 'Supabase client' },
  { canonical: 'jsonwebtoken', description: 'JWT library' },
  { canonical: 'bcrypt', description: 'Password hashing' },
  { canonical: 'helmet', description: 'Security headers' },
  { canonical: 'pg', description: 'PostgreSQL client' },
  { canonical: 'zod', description: 'Schema validation' },
  { canonical: 'stripe', description: 'Payment processing' },
  { canonical: 'pino', description: 'Logging library' },
  { canonical: 'cors', description: 'CORS middleware' },
  { canonical: 'dotenv', description: 'Environment variables' },
];

/** Known trusted npm publishers/scopes */
const TRUSTED_SCOPES = [
  '@supabase',
  '@tanstack',
  '@radix-ui',
  '@types',
  '@stripe',
  '@sentry',
  '@aws-sdk',
  '@hookform',
  '@vitejs',
  '@typescript-eslint',
  '@playwright',
  '@storybook',
  '@tailwindcss',
  '@replit',
  '@sendgrid',
  '@anthropic-ai',
  '@google-cloud',
  '@microsoft',
  '@dnd-kit',
  '@uppy',
  '@vitest',
  '@jridgewell',
];

// ============================================================================
// Types
// ============================================================================

interface CheckResult {
  check: string;
  passed: boolean;
  details: string;
  severity: 'critical' | 'high' | 'medium' | 'info';
  findings: string[];
}

interface DependencyCheckReport {
  timestamp: string;
  results: CheckResult[];
  totalChecks: number;
  passed: number;
  failed: number;
  hasCritical: boolean;
}

// ============================================================================
// Levenshtein Distance (Typosquat Detection)
// ============================================================================

/**
 * Compute the Levenshtein edit distance between two strings.
 * Used to detect package names that are suspiciously close to known critical packages.
 */
function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1, // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Normalize a package name for comparison by stripping scope and lowering case.
 */
function normalizePackageName(name: string): string {
  return name.replace(/^@[^/]+\//, '').toLowerCase();
}

// ============================================================================
// Check: Typosquatting Detection
// ============================================================================

export function checkTyposquatting(packageNames: string[]): CheckResult {
  const findings: string[] = [];
  const canonicalNames = CRITICAL_PACKAGES.map((p) => p.canonical);

  for (const pkg of packageNames) {
    // Skip if it IS a critical package (exact match)
    if (canonicalNames.includes(pkg)) continue;

    // Skip trusted scopes
    if (TRUSTED_SCOPES.some((scope) => pkg.startsWith(scope + '/'))) continue;

    const normalizedPkg = normalizePackageName(pkg);

    for (const critical of CRITICAL_PACKAGES) {
      const normalizedCritical = normalizePackageName(critical.canonical);

      // Skip comparing against itself
      if (normalizedPkg === normalizedCritical) continue;

      const distance = levenshtein(normalizedPkg, normalizedCritical);

      // Flag packages within edit distance of 1-2 of a critical package
      // but only for packages with length > 3 (avoid false positives on short names)
      if (distance > 0 && distance <= 2 && normalizedCritical.length > 3) {
        findings.push(
          `"${pkg}" is suspiciously similar to critical package "${critical.canonical}" ` +
            `(${critical.description}, edit distance: ${distance})`,
        );
      }

      // Also check for common typosquat patterns
      if (
        normalizedPkg === normalizedCritical.replace(/-/g, '') || // removed hyphens
        normalizedPkg === normalizedCritical.replace(/-/g, '_') || // hyphens to underscores
        normalizedPkg === normalizedCritical + 's' || // added trailing 's'
        normalizedPkg === normalizedCritical + 'js' || // added 'js' suffix
        normalizedPkg === normalizedCritical + '-js' // added '-js' suffix
      ) {
        if (!findings.some((f) => f.includes(`"${pkg}"`))) {
          findings.push(
            `"${pkg}" matches a common typosquat pattern for "${critical.canonical}" (${critical.description})`,
          );
        }
      }
    }
  }

  return {
    check: 'Typosquatting Detection',
    passed: findings.length === 0,
    details:
      findings.length === 0
        ? `Checked ${packageNames.length} packages against ${CRITICAL_PACKAGES.length} critical packages - no typosquats detected`
        : `Found ${findings.length} suspicious package name(s)`,
    severity: findings.length > 0 ? 'critical' : 'info',
    findings,
  };
}

// ============================================================================
// Check: package-lock.json Integrity
// ============================================================================

export function checkLockfileIntegrity(rootDir: string): CheckResult {
  const findings: string[] = [];
  const lockfilePath = path.join(rootDir, 'package-lock.json');
  const packageJsonPath = path.join(rootDir, 'package.json');

  // Verify lockfile exists
  if (!fs.existsSync(lockfilePath)) {
    return {
      check: 'Lockfile Integrity',
      passed: false,
      details: 'package-lock.json not found',
      severity: 'critical',
      findings: ['package-lock.json is missing - dependencies are not pinned'],
    };
  }

  // Verify package.json exists
  if (!fs.existsSync(packageJsonPath)) {
    return {
      check: 'Lockfile Integrity',
      passed: false,
      details: 'package.json not found',
      severity: 'critical',
      findings: ['package.json is missing'],
    };
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const lockfile = JSON.parse(fs.readFileSync(lockfilePath, 'utf-8'));

    // Check lockfile version
    if (lockfile.lockfileVersion && lockfile.lockfileVersion < 2) {
      findings.push(
        `Lockfile version ${lockfile.lockfileVersion} is outdated - consider upgrading to v3 (npm 7+)`,
      );
    }

    // Verify all declared dependencies appear in lockfile
    const allDeps = {
      ...(packageJson.dependencies || {}),
      ...(packageJson.devDependencies || {}),
    };

    const lockPackages = lockfile.packages || {};

    for (const depName of Object.keys(allDeps)) {
      const lockKey = `node_modules/${depName}`;
      if (!lockPackages[lockKey] && !lockPackages[''] /* root */) {
        // Check if it might be nested
        const found = Object.keys(lockPackages).some((k) => k.endsWith(`/${depName}`));
        if (!found) {
          findings.push(`Dependency "${depName}" declared in package.json but not found in lockfile`);
        }
      }
    }

    // Verify lockfile has integrity hashes for top-level packages
    let missingIntegrity = 0;
    for (const [key, value] of Object.entries(lockPackages)) {
      if (key === '') continue; // Skip root
      const pkg = value as Record<string, unknown>;
      if (!pkg.integrity && !pkg.link) {
        missingIntegrity++;
      }
    }

    if (missingIntegrity > 0) {
      findings.push(
        `${missingIntegrity} package(s) in lockfile are missing integrity hashes - ` +
          `run "npm install" to regenerate`,
      );
    }
  } catch (err) {
    findings.push(`Failed to parse lockfile: ${err instanceof Error ? err.message : String(err)}`);
  }

  return {
    check: 'Lockfile Integrity',
    passed: findings.length === 0,
    details:
      findings.length === 0
        ? 'package-lock.json integrity verified'
        : `Found ${findings.length} lockfile issue(s)`,
    severity: findings.length > 0 ? 'high' : 'info',
    findings,
  };
}

// ============================================================================
// Check: Install Scripts from Unknown Publishers
// ============================================================================

export function checkInstallScripts(rootDir: string): CheckResult {
  const findings: string[] = [];
  const lockfilePath = path.join(rootDir, 'package-lock.json');

  if (!fs.existsSync(lockfilePath)) {
    return {
      check: 'Install Script Audit',
      passed: false,
      details: 'package-lock.json not found',
      severity: 'high',
      findings: ['Cannot audit install scripts without package-lock.json'],
    };
  }

  try {
    const lockfile = JSON.parse(fs.readFileSync(lockfilePath, 'utf-8'));
    const packages = lockfile.packages || {};

    for (const [key, value] of Object.entries(packages)) {
      if (key === '') continue; // Skip root package
      const pkg = value as Record<string, unknown>;

      // Check if package has install/preinstall/postinstall scripts
      if (pkg.hasInstallScript) {
        const pkgName = key.replace(/^node_modules\//, '');

        // Check if it's from a trusted scope
        const isTrusted = TRUSTED_SCOPES.some((scope) => pkgName.startsWith(scope + '/'));

        // Known packages with legitimate install scripts
        const knownInstallScripts = [
          'bcrypt',
          'sharp',
          'canvas',
          'sqlite3',
          'puppeteer',
          'esbuild',
          '@esbuild',
          'bufferutil',
          'utf-8-validate',
          'cpu-features',
          'ssh2',
          'husky',
          '@sentry/profiling-node',
          'tesseract.js',
          'playwright',
          '@playwright/test',
          'playwright-core',
          'node-gyp',
        ];

        const isKnown = knownInstallScripts.some(
          (known) => pkgName === known || pkgName.startsWith(known + '/'),
        );

        if (!isTrusted && !isKnown) {
          findings.push(
            `"${pkgName}" has install scripts - verify this is expected and from a trusted publisher`,
          );
        }
      }
    }
  } catch (err) {
    findings.push(
      `Failed to parse lockfile for install script audit: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return {
    check: 'Install Script Audit',
    passed: findings.length === 0,
    details:
      findings.length === 0
        ? 'No unexpected install scripts found'
        : `Found ${findings.length} package(s) with install scripts from non-trusted publishers`,
    severity: findings.length > 0 ? 'medium' : 'info',
    findings,
  };
}

// ============================================================================
// Run All Checks
// ============================================================================

export function runDependencyCheck(rootDir: string): DependencyCheckReport {
  const packageJsonPath = path.join(rootDir, 'package.json');

  // Collect all package names
  let packageNames: string[] = [];
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    packageNames = [
      ...Object.keys(packageJson.dependencies || {}),
      ...Object.keys(packageJson.devDependencies || {}),
      ...Object.keys(packageJson.optionalDependencies || {}),
    ];
  } catch {
    // If we can't read package.json, the individual checks will report errors
  }

  const results: CheckResult[] = [
    checkTyposquatting(packageNames),
    checkLockfileIntegrity(rootDir),
    checkInstallScripts(rootDir),
  ];

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const hasCritical = results.some((r) => !r.passed && r.severity === 'critical');

  return {
    timestamp: new Date().toISOString(),
    results,
    totalChecks: results.length,
    passed,
    failed,
    hasCritical,
  };
}

// ============================================================================
// CLI Output
// ============================================================================

function printReport(report: DependencyCheckReport): void {
  console.log(
    '\n' +
      '='.repeat(64) +
      '\n' +
      '  SEC-007: Dependency Security Check\n' +
      '='.repeat(64) +
      '\n',
  );

  for (const result of report.results) {
    const icon = result.passed ? '[PASS]' : '[FAIL]';
    const severityTag = result.passed ? '' : ` [${result.severity.toUpperCase()}]`;
    console.log(`${icon}${severityTag} ${result.check}`);
    console.log(`      ${result.details}`);

    if (result.findings.length > 0) {
      for (const finding of result.findings) {
        console.log(`      - ${finding}`);
      }
    }
    console.log('');
  }

  console.log('-'.repeat(64));
  console.log(
    `Total: ${report.totalChecks} checks | Passed: ${report.passed} | Failed: ${report.failed}`,
  );

  if (report.hasCritical) {
    console.log('\n[CRITICAL] Critical security issues found. Resolve before deploying.\n');
  } else if (report.failed > 0) {
    console.log('\nSome checks failed. Review findings above.\n');
  } else {
    console.log('\nAll dependency security checks passed.\n');
  }
}

// ============================================================================
// Entry Point
// ============================================================================

function main(): void {
  const rootDir = process.cwd();
  const report = runDependencyCheck(rootDir);
  printReport(report);

  if (report.hasCritical) {
    process.exit(1);
  }
}

// Run if executed directly
const isMainModule =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`;

if (isMainModule) {
  main();
}
