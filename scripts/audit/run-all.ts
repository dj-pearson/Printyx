/**
 * Main Audit Runner
 *
 * Runs all audits and generates a comprehensive report.
 * Run with: npm run audit:all
 *
 * Options:
 *   --parallel    Run audits in parallel (faster but less readable output)
 *   --api         Run only API endpoint audit
 *   --edge        Run only Edge function audit
 *   --contract    Run only API contract audit
 *   --overlaps    Run only route overlap audit
 *   --rls         Run only database RLS audit
 *   --security    Run only security audit
 *   --errors      Sync errors after audits
 *   -v, --verbose Show detailed output
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn, SpawnOptions } from 'child_process';
import { config } from 'dotenv';
import { generateComprehensiveReport } from './lib/report-generator';
import {
  loadDatabase,
  saveDatabase,
  trackIssuesAsErrors,
  recordSnapshot,
  printErrorStats,
} from './lib/error-database';
import type { AuditReport } from './lib/types';

// Load environment variables
config();

// ============================================================================
// Configuration
// ============================================================================

const REPORTS_DIR = './audit-reports';

interface AuditConfig {
  name: string;
  script: string;
  flag: string;
  description: string;
}

const AUDITS: AuditConfig[] = [
  {
    name: 'API Endpoints',
    script: 'scripts/audit/api-endpoint-audit.ts',
    flag: '--api',
    description: 'Tests all API routes for auth, validation, and tenant isolation',
  },
  {
    name: 'Edge Functions',
    script: 'scripts/audit/edge-function-audit.ts',
    flag: '--edge',
    description: 'Audits Supabase Edge Functions for completeness and auth',
  },
  {
    name: 'API Contracts',
    script: 'scripts/audit/api-contract-audit.ts',
    flag: '--contract',
    description: 'Checks frontend API calls match backend routes',
  },
  {
    name: 'Route Overlaps',
    script: 'scripts/audit/route-overlap-audit.ts',
    flag: '--overlaps',
    description: 'Finds duplicate functionality between Express and Edge',
  },
  {
    name: 'Database RLS',
    script: 'scripts/audit/database-rls-audit.ts',
    flag: '--rls',
    description: 'Audits database tables for tenant isolation',
  },
  {
    name: 'Security',
    script: 'scripts/audit/security-audit.ts',
    flag: '--security',
    description: 'Scans for common security issues',
  },
  {
    name: 'Supply Chain',
    script: 'scripts/supply-chain-check.ts',
    flag: '--supply-chain',
    description: 'Checks for dependency typosquatting and lifecycle script risks',
  },
];

// ============================================================================
// Utilities
// ============================================================================

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

// ============================================================================
// Audit Runner
// ============================================================================

interface AuditResult {
  name: string;
  success: boolean;
  duration: number;
  exitCode: number;
  output: string;
}

async function runAudit(auditConfig: AuditConfig, verbose: boolean): Promise<AuditResult> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    const args = ['--import', 'tsx', auditConfig.script];
    if (verbose) {
      args.push('--verbose');
    }

    const spawnOptions: SpawnOptions = {
      stdio: verbose ? 'inherit' : 'pipe',
      shell: true,
      cwd: process.cwd(),
    };

    const proc = spawn('node', args, spawnOptions);

    let output = '';

    if (!verbose && proc.stdout) {
      proc.stdout.on('data', (data) => {
        output += data.toString();
      });
    }

    if (!verbose && proc.stderr) {
      proc.stderr.on('data', (data) => {
        output += data.toString();
      });
    }

    proc.on('close', (code) => {
      const duration = Date.now() - startTime;
      resolve({
        name: auditConfig.name,
        success: code === 0,
        duration,
        exitCode: code ?? 1,
        output,
      });
    });

    proc.on('error', (error) => {
      const duration = Date.now() - startTime;
      resolve({
        name: auditConfig.name,
        success: false,
        duration,
        exitCode: 1,
        output: error.message,
      });
    });
  });
}

async function runAuditsSequentially(
  audits: AuditConfig[],
  verbose: boolean,
): Promise<AuditResult[]> {
  const results: AuditResult[] = [];

  for (let i = 0; i < audits.length; i++) {
    const audit = audits[i];
    console.log(`\n[${i + 1}/${audits.length}] Running ${audit.name} audit...`);
    console.log(`    ${audit.description}\n`);

    const result = await runAudit(audit, verbose);
    results.push(result);

    const icon = result.success ? '✓' : '✗';
    const status = result.success ? 'PASSED' : 'FAILED';
    console.log(`    ${icon} ${status} (${formatDuration(result.duration)})`);
  }

  return results;
}

async function runAuditsParallel(audits: AuditConfig[], verbose: boolean): Promise<AuditResult[]> {
  console.log('\n🚀 Running all audits in parallel...\n');

  const promises = audits.map((audit) => runAudit(audit, false));
  const results = await Promise.all(promises);

  // Print results
  for (const result of results) {
    const icon = result.success ? '✓' : '✗';
    const status = result.success ? 'PASSED' : 'FAILED';
    console.log(`   ${icon} ${result.name}: ${status} (${formatDuration(result.duration)})`);
  }

  return results;
}

// ============================================================================
// Report Loading
// ============================================================================

function loadLatestReports(): AuditReport[] {
  const reports: AuditReport[] = [];

  const reportTypes = [
    'api-endpoints',
    'edge-functions',
    'api-contracts',
    'route-overlaps',
    'database-rls',
    'security',
  ];

  for (const type of reportTypes) {
    const latestFile = path.join(REPORTS_DIR, `${type}-latest.json`);

    if (fs.existsSync(latestFile)) {
      try {
        const content = fs.readFileSync(latestFile, 'utf-8');
        const report = JSON.parse(content) as AuditReport;
        reports.push(report);
      } catch {
        // Skip invalid reports
      }
    }
  }

  return reports;
}

// ============================================================================
// Error Sync
// ============================================================================

function syncErrors(): void {
  console.log('\n🔄 Syncing errors to tracker...\n');

  const reports = loadLatestReports();
  const db = loadDatabase();

  const reportTypeMap: Record<string, string> = {
    'api-endpoints': 'api-endpoints',
    'edge-functions': 'edge-functions',
    'api-contracts': 'api-contracts',
    'route-overlaps': 'route-overlaps',
    'database-rls': 'database-rls',
    security: 'security',
  };

  let totalIssues = 0;

  for (const report of reports) {
    const auditType = reportTypeMap[report.type] || report.type;
    trackIssuesAsErrors(db, report.issues, auditType);
    totalIssues += report.issues.length;
  }

  recordSnapshot(db);
  saveDatabase(db);

  console.log(`   Synced ${totalIssues} issues from ${reports.length} reports\n`);
  printErrorStats(db);
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const verbose = args.includes('-v') || args.includes('--verbose');
  const parallel = args.includes('--parallel');
  const syncErrorsAfter = args.includes('--errors');

  // Determine which audits to run
  let auditsToRun = AUDITS;

  const specificAudits = AUDITS.filter((a) => args.includes(a.flag));
  if (specificAudits.length > 0) {
    auditsToRun = specificAudits;
  }

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║              PRINTYX AUDIT SUITE                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  console.log(`\nAudits to run: ${auditsToRun.map((a) => a.name).join(', ')}`);

  const startTime = Date.now();

  // Ensure reports directory exists
  ensureDir(REPORTS_DIR);

  // Run audits
  let results: AuditResult[];

  if (parallel) {
    results = await runAuditsParallel(auditsToRun, verbose);
  } else {
    results = await runAuditsSequentially(auditsToRun, verbose);
  }

  const totalDuration = Date.now() - startTime;

  // Generate comprehensive report if all audits were run
  if (auditsToRun.length === AUDITS.length) {
    console.log('\n📊 Generating comprehensive report...');

    const reports = loadLatestReports();
    if (reports.length > 0) {
      const reportPath = generateComprehensiveReport(reports);
      console.log(`   Report saved to: ${reportPath}`);
    }
  }

  // Sync errors if requested
  if (syncErrorsAfter) {
    syncErrors();
  }

  // Print final summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    AUDIT SUITE COMPLETE                    ║');
  console.log('╠════════════════════════════════════════════════════════════╣');

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`║  Audits Run:          ${String(results.length).padStart(35)} ║`);
  console.log(`║  Passed:              ${String(passed).padStart(35)} ║`);
  console.log(`║  Failed:              ${String(failed).padStart(35)} ║`);
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Total Duration:      ${formatDuration(totalDuration).padStart(35)} ║`);
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Print individual results
  console.log('Audit Results:\n');
  for (const result of results) {
    const icon = result.success ? '🟢 ✓' : '🔴 ✗';
    console.log(
      `   ${icon} ${result.name.padEnd(20)} ${formatDuration(result.duration).padStart(10)}`,
    );
  }

  // Load and summarize issues
  const reports = loadLatestReports();
  let totalIssues = 0;
  let criticalIssues = 0;
  let highIssues = 0;

  for (const report of reports) {
    totalIssues += report.issues.length;
    criticalIssues += report.issues.filter((i) => i.severity === 'critical').length;
    highIssues += report.issues.filter((i) => i.severity === 'high').length;
  }

  if (totalIssues > 0) {
    console.log('\nIssue Summary:\n');
    console.log(`   Total Issues: ${totalIssues}`);
    if (criticalIssues > 0) {
      console.log(`   🔴 Critical: ${criticalIssues}`);
    }
    if (highIssues > 0) {
      console.log(`   🟠 High: ${highIssues}`);
    }
  }

  console.log(`\n📁 Reports saved to: ${REPORTS_DIR}/\n`);

  // Exit with error code if any critical audits failed
  if (failed > 0) {
    process.exit(1);
  }
}

// ============================================================================
// Entry Point
// ============================================================================

main().catch((error) => {
  console.error('Audit suite failed:', error);
  process.exit(1);
});
