/**
 * Error Tracker Script
 *
 * Aggregates issues from audit reports, deduplicates errors, and tracks historical trends.
 * Run with: npm run audit:errors
 *
 * Commands:
 *   --sync         Sync errors from latest audit reports
 *   --stats        Show error statistics
 *   --list         List all errors
 *   --open         List open errors only
 *   --critical     List critical errors only
 *   --resolve <id> Mark an error as resolved
 *   --ignore <id>  Mark an error as won't fix
 *   --note <id> <note>  Add a note to an error
 *   --export       Export errors to markdown
 */

import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';
import {
  loadDatabase,
  saveDatabase,
  trackIssuesAsErrors,
  updateErrorStatus,
  addErrorNote,
  getOpenErrors,
  getErrorStats,
  recordSnapshot,
  getTrends,
  printErrorStats,
  printErrorList,
} from './lib/error-database';
import type { AuditReport, AuditIssue, TrackedError, ErrorDatabase } from './lib/types';

// Load environment variables
config();

// ============================================================================
// Configuration
// ============================================================================

const REPORTS_DIR = './audit-reports';

// Audit types to sync
const AUDIT_TYPES = [
  'api-endpoints',
  'edge-functions',
  'api-contracts',
  'route-overlaps',
  'database-rls',
  'security',
];

// ============================================================================
// Report Loading
// ============================================================================

interface LoadedReport {
  type: string;
  report: AuditReport;
}

function loadLatestReports(): LoadedReport[] {
  const reports: LoadedReport[] = [];

  if (!fs.existsSync(REPORTS_DIR)) {
    return reports;
  }

  for (const auditType of AUDIT_TYPES) {
    const latestFile = path.join(REPORTS_DIR, `${auditType}-latest.json`);

    if (fs.existsSync(latestFile)) {
      try {
        const content = fs.readFileSync(latestFile, 'utf-8');
        const report = JSON.parse(content) as AuditReport;
        reports.push({ type: auditType, report });
      } catch (error) {
        console.warn(`Failed to load ${auditType} report: ${(error as Error).message}`);
      }
    }
  }

  return reports;
}

// ============================================================================
// Sync Command
// ============================================================================

function syncErrors(db: ErrorDatabase, verbose: boolean = false): void {
  console.log('\n🔄 Syncing errors from audit reports...\n');

  const reports = loadLatestReports();

  if (reports.length === 0) {
    console.log('   No audit reports found. Run audits first.\n');
    return;
  }

  let totalIssues = 0;
  let newErrors = 0;
  let updatedErrors = 0;

  // Track existing error signatures for comparison
  const existingSignatures = new Set(db.errors.map((e) => e.signature));
  const initialErrorCount = db.errors.length;

  for (const { type, report } of reports) {
    if (verbose) {
      console.log(`   Processing ${type}: ${report.issues.length} issues`);
    }

    totalIssues += report.issues.length;

    const tracked = trackIssuesAsErrors(db, report.issues, type);

    for (const error of tracked) {
      if (!existingSignatures.has(error.signature)) {
        newErrors++;
        existingSignatures.add(error.signature);
      } else {
        updatedErrors++;
      }
    }
  }

  // Record snapshot for trend analysis
  recordSnapshot(db);

  // Save database
  saveDatabase(db);

  console.log(`   Reports processed: ${reports.length}`);
  console.log(`   Total issues: ${totalIssues}`);
  console.log(`   New errors tracked: ${newErrors}`);
  console.log(`   Existing errors updated: ${updatedErrors}`);
  console.log(`   Total errors in database: ${db.errors.length}\n`);
}

// ============================================================================
// Export Command
// ============================================================================

function exportErrors(db: ErrorDatabase): void {
  const stats = getErrorStats(db);
  const trends = getTrends(db);
  const outputPath = path.join(REPORTS_DIR, 'errors', 'error-report.md');

  const openErrors = db.errors.filter((e) => e.status === 'open');
  const criticalErrors = openErrors.filter((e) => e.severity === 'critical');
  const highErrors = openErrors.filter((e) => e.severity === 'high');

  let md = `# Error Tracking Report

**Generated:** ${new Date().toISOString()}
**Total Errors:** ${stats.total}
**Open Errors:** ${stats.open}

## Trend Analysis

| Metric | Value |
|--------|-------|
| Weekly Change | ${trends.weeklyChange >= 0 ? '+' : ''}${trends.weeklyChange} (${trends.openTrend}) |
| Monthly Change | ${trends.monthlyChange >= 0 ? '+' : ''}${trends.monthlyChange} (${trends.totalTrend}) |

## Status Summary

| Status | Count |
|--------|-------|
| Open | ${stats.open} |
| Investigating | ${stats.investigating} |
| Fixed | ${stats.fixed} |
| Won't Fix | ${stats.wontFix} |

## By Severity

| Severity | Count |
|----------|-------|
${Object.entries(stats.bySeverity)
  .sort((a, b) => getSeverityOrder(a[0]) - getSeverityOrder(b[0]))
  .map(([sev, count]) => `| ${formatSeverity(sev)} | ${count} |`)
  .join('\n')}

## By Category

| Category | Count |
|----------|-------|
${Object.entries(stats.byCategory)
  .sort((a, b) => b[1] - a[1])
  .map(([cat, count]) => `| ${cat} | ${count} |`)
  .join('\n')}

## Critical Errors (${criticalErrors.length})

${criticalErrors.length === 0 ? '_No critical errors._' : criticalErrors.map(formatErrorDetail).join('\n\n')}

## High Priority Errors (${highErrors.length})

${highErrors.length === 0 ? '_No high priority errors._' : highErrors.map(formatErrorDetail).join('\n\n')}

## Recently Seen Errors

${stats.recentErrors.map(formatErrorDetail).join('\n\n')}

## Oldest Open Errors

${stats.oldestOpen.map(formatErrorDetail).join('\n\n')}

---
*Error report generated by Printyx Audit System*
`;

  // Ensure directory exists
  const errorDir = path.dirname(outputPath);
  if (!fs.existsSync(errorDir)) {
    fs.mkdirSync(errorDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, md);
  console.log(`\n📄 Error report exported to: ${outputPath}\n`);
}

function formatErrorDetail(error: TrackedError): string {
  return `### ${getSeverityIcon(error.severity)} ${error.message}

- **ID:** \`${error.id}\`
- **Category:** ${error.category}
- **Status:** ${error.status}
- **First Seen:** ${formatDate(error.firstSeen)}
- **Last Seen:** ${formatDate(error.lastSeen)}
- **Occurrences:** ${error.occurrences}
- **Affected Resources:** ${error.affectedResources.join(', ')}
- **Audit Types:** ${error.auditTypes.join(', ')}
${error.notes?.length ? `- **Notes:**\n${error.notes.map((n) => `  - ${n}`).join('\n')}` : ''}`;
}

function getSeverityIcon(severity: string): string {
  switch (severity) {
    case 'critical':
      return '🔴';
    case 'high':
      return '🟠';
    case 'medium':
      return '🟡';
    case 'low':
      return '🟢';
    default:
      return '⚪';
  }
}

function formatSeverity(severity: string): string {
  switch (severity) {
    case 'critical':
      return '🔴 Critical';
    case 'high':
      return '🟠 High';
    case 'medium':
      return '🟡 Medium';
    case 'low':
      return '🟢 Low';
    default:
      return severity;
  }
}

function getSeverityOrder(severity: string): number {
  switch (severity) {
    case 'critical':
      return 0;
    case 'high':
      return 1;
    case 'medium':
      return 2;
    case 'low':
      return 3;
    default:
      return 4;
  }
}

function formatDate(date: Date): string {
  if (typeof date === 'string') {
    date = new Date(date);
  }
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

// ============================================================================
// CLI Commands
// ============================================================================

function printHelp(): void {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║              ERROR TRACKER                                 ║
╚════════════════════════════════════════════════════════════╝

Usage: npm run audit:errors [command] [options]

Commands:
  --sync         Sync errors from latest audit reports
  --stats        Show error statistics
  --list         List all errors
  --open         List open errors only
  --critical     List critical errors only
  --high         List high priority errors only
  --resolve <id> Mark an error as resolved
  --ignore <id>  Mark an error as won't fix
  --note <id> <note>  Add a note to an error
  --export       Export errors to markdown report

Options:
  -v, --verbose  Show detailed output

Examples:
  npm run audit:errors -- --sync
  npm run audit:errors -- --stats
  npm run audit:errors -- --resolve err-1234567890-abc123
  npm run audit:errors -- --note err-1234567890-abc123 "Fixed in PR #123"
`);
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const verbose = args.includes('-v') || args.includes('--verbose');

  // Load database
  const db = loadDatabase();

  // Default to stats if no command
  if (args.length === 0 || (args.length === 1 && verbose)) {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║              ERROR TRACKER                                 ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    printErrorStats(db);

    const openErrors = getOpenErrors(db);
    if (openErrors.length > 0) {
      console.log('\nOpen Errors:');
      printErrorList(openErrors.slice(0, 10), 10);
    }

    console.log('\nUse --help for available commands\n');
    return;
  }

  // Process commands
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  if (args.includes('--sync')) {
    syncErrors(db, verbose);
    return;
  }

  if (args.includes('--stats')) {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║              ERROR TRACKER - STATISTICS                    ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    printErrorStats(db);
    return;
  }

  if (args.includes('--list')) {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║              ERROR TRACKER - ALL ERRORS                    ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    printErrorList(db.errors);
    return;
  }

  if (args.includes('--open')) {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║              ERROR TRACKER - OPEN ERRORS                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    const openErrors = getOpenErrors(db);
    printErrorList(openErrors);
    console.log(`\nTotal open errors: ${openErrors.length}\n`);
    return;
  }

  if (args.includes('--critical')) {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║              ERROR TRACKER - CRITICAL ERRORS               ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    const criticalErrors = db.errors.filter(
      (e) => e.severity === 'critical' && e.status === 'open',
    );
    printErrorList(criticalErrors);
    console.log(`\nTotal critical errors: ${criticalErrors.length}\n`);
    return;
  }

  if (args.includes('--high')) {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║              ERROR TRACKER - HIGH PRIORITY ERRORS          ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    const highErrors = db.errors.filter((e) => e.severity === 'high' && e.status === 'open');
    printErrorList(highErrors);
    console.log(`\nTotal high priority errors: ${highErrors.length}\n`);
    return;
  }

  if (args.includes('--resolve')) {
    const resolveIndex = args.indexOf('--resolve');
    const errorId = args[resolveIndex + 1];

    if (!errorId) {
      console.error('Error: Please provide an error ID to resolve');
      return;
    }

    const error = updateErrorStatus(db, errorId, 'fixed', {
      date: new Date(),
      description: 'Marked as resolved via CLI',
    });

    if (error) {
      saveDatabase(db);
      console.log(`\n✓ Error ${errorId} marked as fixed\n`);
    } else {
      console.error(`\nError: Could not find error with ID ${errorId}\n`);
    }
    return;
  }

  if (args.includes('--ignore')) {
    const ignoreIndex = args.indexOf('--ignore');
    const errorId = args[ignoreIndex + 1];

    if (!errorId) {
      console.error('Error: Please provide an error ID to ignore');
      return;
    }

    const error = updateErrorStatus(db, errorId, 'wont-fix', {
      date: new Date(),
      description: "Marked as won't fix via CLI",
    });

    if (error) {
      saveDatabase(db);
      console.log(`\n✓ Error ${errorId} marked as won't fix\n`);
    } else {
      console.error(`\nError: Could not find error with ID ${errorId}\n`);
    }
    return;
  }

  if (args.includes('--note')) {
    const noteIndex = args.indexOf('--note');
    const errorId = args[noteIndex + 1];
    const note = args.slice(noteIndex + 2).join(' ');

    if (!errorId || !note) {
      console.error('Error: Please provide an error ID and note');
      console.error('Usage: --note <error-id> <note text>');
      return;
    }

    const error = addErrorNote(db, errorId, note);

    if (error) {
      saveDatabase(db);
      console.log(`\n✓ Note added to error ${errorId}\n`);
    } else {
      console.error(`\nError: Could not find error with ID ${errorId}\n`);
    }
    return;
  }

  if (args.includes('--export')) {
    exportErrors(db);
    return;
  }

  // Unknown command
  console.error(`Unknown command: ${args[0]}`);
  printHelp();
}

// ============================================================================
// Entry Point
// ============================================================================

main().catch((error) => {
  console.error('Error tracker failed:', error);
  process.exit(1);
});
