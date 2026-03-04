/**
 * SEC-016: Dependency Supply Chain Security Check
 *
 * Scans package.json and package-lock.json for supply chain risks:
 * - Typosquatting detection via Levenshtein distance against critical dependencies
 * - Detection of packages with preinstall/postinstall lifecycle scripts
 * - Structured output with safe/unsafe status and issue details
 *
 * Run with: npx tsx scripts/supply-chain-check.ts
 * Or:       npm run audit:supply-chain
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

interface SupplyChainIssue {
  type: 'typosquatting' | 'lifecycle-script';
  severity: 'critical' | 'high' | 'medium';
  package: string;
  message: string;
  details?: string;
}

interface SupplyChainResult {
  safe: boolean;
  issues: SupplyChainIssue[];
  summary: {
    totalDependencies: number;
    checkedAt: string;
    typosquattingChecks: number;
    lifecycleScriptChecks: number;
  };
}

// ============================================================================
// Critical Dependencies (known good names)
// ============================================================================

const CRITICAL_DEPENDENCIES: string[] = [
  'express',
  'drizzle-orm',
  '@supabase/supabase-js',
  'jsonwebtoken',
  'bcrypt',
  'helmet',
  'cors',
  'dotenv',
  'zod',
  'pg',
  'postgres',
  'passport',
  'cookie-parser',
  'express-rate-limit',
  'compression',
  'morgan',
  'winston',
  'uuid',
  'axios',
  'node-fetch',
  'crypto-js',
  'jose',
  'nodemailer',
];

// ============================================================================
// Levenshtein Distance
// ============================================================================

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Create a matrix of distances
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0),
  );

  // Initialize base cases
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Fill the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

// ============================================================================
// Typosquatting Detection
// ============================================================================

function checkTyposquatting(depNames: string[]): SupplyChainIssue[] {
  const issues: SupplyChainIssue[] = [];

  for (const dep of depNames) {
    // Skip if this IS a critical dependency (exact match)
    if (CRITICAL_DEPENDENCIES.includes(dep)) {
      continue;
    }

    // For scoped packages, compare against scoped critical deps
    // For unscoped packages, compare against unscoped critical deps
    for (const critical of CRITICAL_DEPENDENCIES) {
      // Skip exact match
      if (dep === critical) continue;

      // Extract the package name portion (without scope) for comparison
      const depName = dep.startsWith('@') ? dep : dep;
      const critName = critical.startsWith('@') ? critical : critical;

      const distance = levenshteinDistance(depName, critName);

      // Flag if within Levenshtein distance of 2 (but not 0, which is exact match)
      if (distance > 0 && distance <= 2) {
        issues.push({
          type: 'typosquatting',
          severity: 'critical',
          package: dep,
          message: `Potential typosquatting: "${dep}" is similar to critical dependency "${critical}" (Levenshtein distance: ${distance})`,
          details: `This package name is suspiciously close to "${critical}". Verify this is the intended package.`,
        });
      }
    }
  }

  return issues;
}

// ============================================================================
// Lifecycle Script Detection
// ============================================================================

function checkLifecycleScripts(lockfilePath: string): SupplyChainIssue[] {
  const issues: SupplyChainIssue[] = [];

  if (!fs.existsSync(lockfilePath)) {
    console.warn(`  Warning: package-lock.json not found at ${lockfilePath}`);
    return issues;
  }

  let lockfile: {
    packages?: Record<string, { scripts?: Record<string, string>; hasInstallScript?: boolean }>;
  };

  try {
    const content = fs.readFileSync(lockfilePath, 'utf-8');
    lockfile = JSON.parse(content);
  } catch (err) {
    console.warn(`  Warning: Could not parse package-lock.json: ${err}`);
    return issues;
  }

  const dangerousScripts = ['preinstall', 'postinstall', 'install', 'preuninstall', 'postuninstall'];

  // Check packages in lockfile v2/v3 format
  if (lockfile.packages) {
    for (const [pkgPath, pkgData] of Object.entries(lockfile.packages)) {
      // Skip the root package (empty string key)
      if (!pkgPath || pkgPath === '') continue;

      // Extract package name from the path
      const pkgName = pkgPath.replace(/^node_modules\//, '');

      // Check hasInstallScript flag (lockfile v3)
      if (pkgData.hasInstallScript) {
        issues.push({
          type: 'lifecycle-script',
          severity: 'medium',
          package: pkgName,
          message: `Package "${pkgName}" has install lifecycle scripts`,
          details:
            'Packages with install scripts can execute arbitrary code during npm install. Verify this is expected.',
        });
        continue;
      }

      // Check for explicit script entries
      if (pkgData.scripts) {
        const foundScripts = dangerousScripts.filter((s) => s in pkgData.scripts!);
        if (foundScripts.length > 0) {
          issues.push({
            type: 'lifecycle-script',
            severity: 'medium',
            package: pkgName,
            message: `Package "${pkgName}" has lifecycle scripts: ${foundScripts.join(', ')}`,
            details:
              'Lifecycle scripts can execute arbitrary code during npm install. Verify this is expected.',
          });
        }
      }
    }
  }

  return issues;
}

// ============================================================================
// Main Check
// ============================================================================

function runSupplyChainCheck(): SupplyChainResult {
  const rootDir = process.cwd();
  const pkgPath = path.join(rootDir, 'package.json');
  const lockPath = path.join(rootDir, 'package-lock.json');

  // Read package.json
  if (!fs.existsSync(pkgPath)) {
    console.error('Error: package.json not found in current directory');
    process.exit(1);
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
    ...Object.keys(pkg.optionalDependencies || {}),
  ];

  console.log('\n========================================================');
  console.log('  SEC-016: Dependency Supply Chain Security Check');
  console.log('========================================================\n');
  console.log(`  Total dependencies in package.json: ${allDeps.length}`);
  console.log(`  Critical dependencies tracked: ${CRITICAL_DEPENDENCIES.length}\n`);

  // Run typosquatting checks
  console.log('  [1/2] Checking for typosquatting...');
  const typosquattingIssues = checkTyposquatting(allDeps);
  console.log(`         Found ${typosquattingIssues.length} potential issue(s)\n`);

  // Run lifecycle script checks
  console.log('  [2/2] Checking for lifecycle scripts...');
  const lifecycleIssues = checkLifecycleScripts(lockPath);
  console.log(`         Found ${lifecycleIssues.length} package(s) with lifecycle scripts\n`);

  const allIssues = [...typosquattingIssues, ...lifecycleIssues];
  const hasCritical = allIssues.some((i) => i.severity === 'critical');

  const result: SupplyChainResult = {
    safe: !hasCritical,
    issues: allIssues,
    summary: {
      totalDependencies: allDeps.length,
      checkedAt: new Date().toISOString(),
      typosquattingChecks: typosquattingIssues.length,
      lifecycleScriptChecks: lifecycleIssues.length,
    },
  };

  // Print results
  console.log('========================================================');
  console.log('  Results');
  console.log('========================================================\n');

  if (allIssues.length === 0) {
    console.log('  Status: SAFE - No supply chain issues detected\n');
  } else {
    console.log(`  Status: ${hasCritical ? 'UNSAFE' : 'WARNINGS'} - ${allIssues.length} issue(s) found\n`);

    // Group by type
    if (typosquattingIssues.length > 0) {
      console.log('  Typosquatting Risks:');
      for (const issue of typosquattingIssues) {
        console.log(`    [CRITICAL] ${issue.message}`);
      }
      console.log('');
    }

    if (lifecycleIssues.length > 0) {
      console.log('  Lifecycle Script Risks:');
      for (const issue of lifecycleIssues) {
        console.log(`    [MEDIUM]   ${issue.message}`);
      }
      console.log('');
    }
  }

  // Write JSON report
  const reportDir = path.join(rootDir, 'audit-reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  const reportPath = path.join(reportDir, 'supply-chain-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
  console.log(`  Report saved to: ${reportPath}\n`);

  return result;
}

// ============================================================================
// CLI Entry Point
// ============================================================================

const result = runSupplyChainCheck();

if (!result.safe) {
  console.log('  Exiting with code 1 due to critical supply chain issues.\n');
  process.exit(1);
} else if (result.issues.length > 0) {
  console.log('  Exiting with code 0 (warnings only, no critical issues).\n');
} else {
  console.log('  All clear.\n');
}
