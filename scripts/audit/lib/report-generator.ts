/**
 * Report Generator
 *
 * Shared issue construction + report persistence for the scripts/audit/* suite.
 *
 * Every audit script (api-endpoint, edge-function, api-contract, route-overlap,
 * database-rls, security) builds an AuditReport and hands it to generateReport(),
 * which writes a timestamped JSON + Markdown pair plus a stable `<type>-latest.*`
 * copy. run-all.ts then reads the `-latest.json` files back and rolls them into a
 * single comprehensive Markdown report.
 *
 * Output layout (./audit-reports, gitignored):
 *   api-endpoints-2026-07-27T13-40-00.json   ← immutable snapshot
 *   api-endpoints-2026-07-27T13-40-00.md
 *   api-endpoints-latest.json                ← what run-all.ts consumes
 *   api-endpoints-latest.md
 *   comprehensive-latest.md
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { AuditIssue, AuditReport } from './types';

// ============================================================================
// Configuration
// ============================================================================

const REPORTS_DIR = './audit-reports';

const SEVERITY_ORDER: Record<AuditIssue['severity'], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const SEVERITY_ICON: Record<AuditIssue['severity'], string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '⚪',
};

// ============================================================================
// Issue Construction
// ============================================================================

/**
 * Build an AuditIssue.
 *
 * `type` is derived from severity rather than passed in: critical/high are errors,
 * medium is a warning, low is informational. That keeps call sites to the five
 * fields that actually vary.
 */
export function createIssue(
  category: AuditIssue['category'],
  severity: AuditIssue['severity'],
  message: string,
  resource: string,
  extra: {
    sourceFile?: string;
    lineNumber?: number;
    suggestedFix?: string;
  } = {},
): AuditIssue {
  // Stable across runs so the error database can dedupe an issue that persists.
  const signature = `${category}|${severity}|${resource}|${message}`;
  const id = crypto.createHash('sha1').update(signature).digest('hex').slice(0, 12);

  return {
    id,
    type:
      severity === 'critical' || severity === 'high'
        ? 'error'
        : severity === 'medium'
          ? 'warning'
          : 'info',
    category,
    message,
    resource,
    severity,
    ...(extra.sourceFile !== undefined ? { sourceFile: extra.sourceFile } : {}),
    ...(extra.lineNumber !== undefined ? { lineNumber: extra.lineNumber } : {}),
    ...(extra.suggestedFix !== undefined ? { suggestedFix: extra.suggestedFix } : {}),
  };
}

// ============================================================================
// Helpers
// ============================================================================

function ensureReportsDir(): void {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
}

/** Filesystem-safe ISO timestamp: 2026-07-27T13-40-00 */
function fileTimestamp(date: Date): string {
  return date.toISOString().replace(/:/g, '-').replace(/\..+$/, '');
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function sortIssues(issues: AuditIssue[]): AuditIssue[] {
  return [...issues].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      a.category.localeCompare(b.category) ||
      a.resource.localeCompare(b.resource),
  );
}

function countBy<T extends string>(items: T[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) counts[item] = (counts[item] ?? 0) + 1;
  return counts;
}

function locationOf(issue: AuditIssue): string {
  if (!issue.sourceFile) return '';
  return issue.lineNumber ? `${issue.sourceFile}:${issue.lineNumber}` : issue.sourceFile;
}

/** A report's timestamp survives a JSON round-trip as a string. */
function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

// ============================================================================
// Markdown Rendering
// ============================================================================

function renderIssueTable(issues: AuditIssue[]): string[] {
  const lines: string[] = [
    '| Severity | Category | Resource | Message | Location |',
    '| --- | --- | --- | --- | --- |',
  ];

  for (const issue of issues) {
    const cells = [
      `${SEVERITY_ICON[issue.severity]} ${issue.severity}`,
      issue.category,
      issue.resource,
      issue.message,
      locationOf(issue),
    ].map((cell) => String(cell).replace(/\|/g, '\\|').replace(/\n/g, ' '));

    lines.push(`| ${cells.join(' | ')} |`);
  }

  return lines;
}

function renderReportMarkdown(report: AuditReport): string {
  const timestamp = asDate(report.timestamp);
  const issues = sortIssues(report.issues);
  const bySeverity = countBy(issues.map((i) => i.severity));
  const byCategory = countBy(issues.map((i) => i.category));

  const lines: string[] = [
    `# Audit Report: ${report.type}`,
    '',
    `- **Generated:** ${timestamp.toISOString()}`,
    `- **Duration:** ${formatDuration(report.duration)}`,
    `- **Checks:** ${report.summary.total} total · ${report.summary.passed} passed · ${report.summary.failed} failed · ${report.summary.warnings} warnings · ${report.summary.skipped} skipped`,
    `- **Issues:** ${issues.length}`,
    '',
  ];

  if (issues.length > 0) {
    lines.push('## Issue Counts', '');
    lines.push('| Severity | Count |', '| --- | --- |');
    for (const severity of ['critical', 'high', 'medium', 'low'] as const) {
      if (bySeverity[severity]) {
        lines.push(`| ${SEVERITY_ICON[severity]} ${severity} | ${bySeverity[severity]} |`);
      }
    }
    lines.push('');

    lines.push('| Category | Count |', '| --- | --- |');
    for (const [category, count] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
      lines.push(`| ${category} | ${count} |`);
    }
    lines.push('');

    // Critical and high issues get their own section so they cannot be missed
    // in a report that may run to hundreds of rows.
    const blocking = issues.filter((i) => i.severity === 'critical' || i.severity === 'high');
    if (blocking.length > 0) {
      lines.push(`## Must Fix (${blocking.length})`, '', ...renderIssueTable(blocking), '');

      const withFix = blocking.filter((i) => i.suggestedFix);
      if (withFix.length > 0) {
        lines.push('### Suggested Fixes', '');
        for (const issue of withFix) {
          lines.push(`- **${issue.resource}** — ${issue.message}`, `  - ${issue.suggestedFix}`);
        }
        lines.push('');
      }
    }

    lines.push(`## All Issues (${issues.length})`, '', ...renderIssueTable(issues), '');
  } else {
    lines.push('## Issues', '', '✅ No issues found.', '');
  }

  return lines.join('\n');
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Persist a single audit report as JSON + Markdown.
 * Writes both a timestamped snapshot and the `<type>-latest.*` pair that
 * run-all.ts reads back.
 */
export function generateReport(report: AuditReport): { jsonPath: string; mdPath: string } {
  ensureReportsDir();

  const stamp = fileTimestamp(asDate(report.timestamp));
  const json = JSON.stringify(report, null, 2);
  const md = renderReportMarkdown(report);

  const jsonPath = path.join(REPORTS_DIR, `${report.type}-${stamp}.json`);
  const mdPath = path.join(REPORTS_DIR, `${report.type}-${stamp}.md`);

  fs.writeFileSync(jsonPath, json);
  fs.writeFileSync(mdPath, md);

  fs.writeFileSync(path.join(REPORTS_DIR, `${report.type}-latest.json`), json);
  fs.writeFileSync(path.join(REPORTS_DIR, `${report.type}-latest.md`), md);

  return { jsonPath, mdPath };
}

/**
 * Roll every per-audit report into one Markdown summary.
 * Returns the path written.
 */
export function generateComprehensiveReport(reports: AuditReport[]): string {
  ensureReportsDir();

  const generatedAt = new Date();
  const allIssues = sortIssues(reports.flatMap((r) => r.issues));
  const bySeverity = countBy(allIssues.map((i) => i.severity));

  const totals = reports.reduce(
    (acc, r) => ({
      total: acc.total + r.summary.total,
      passed: acc.passed + r.summary.passed,
      failed: acc.failed + r.summary.failed,
      warnings: acc.warnings + r.summary.warnings,
      skipped: acc.skipped + r.summary.skipped,
    }),
    { total: 0, passed: 0, failed: 0, warnings: 0, skipped: 0 },
  );

  const lines: string[] = [
    '# Comprehensive Audit Report',
    '',
    `- **Generated:** ${generatedAt.toISOString()}`,
    `- **Audits included:** ${reports.length}`,
    `- **Checks:** ${totals.total} total · ${totals.passed} passed · ${totals.failed} failed · ${totals.warnings} warnings · ${totals.skipped} skipped`,
    `- **Issues:** ${allIssues.length} (` +
      (['critical', 'high', 'medium', 'low'] as const)
        .map((s) => `${s}: ${bySeverity[s] ?? 0}`)
        .join(', ') +
      ')',
    '',
    '## Per-Audit Summary',
    '',
    '| Audit | Checks | Passed | Failed | Issues | Critical | High | Duration |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ];

  for (const report of reports) {
    const counts = countBy(report.issues.map((i) => i.severity));
    lines.push(
      `| ${report.type} | ${report.summary.total} | ${report.summary.passed} | ${report.summary.failed} | ` +
        `${report.issues.length} | ${counts.critical ?? 0} | ${counts.high ?? 0} | ${formatDuration(report.duration)} |`,
    );
  }
  lines.push('');

  const blocking = allIssues.filter((i) => i.severity === 'critical' || i.severity === 'high');
  if (blocking.length > 0) {
    lines.push(
      `## Must Fix Across All Audits (${blocking.length})`,
      '',
      ...renderIssueTable(blocking),
      '',
    );
  } else {
    lines.push('## Must Fix Across All Audits', '', '✅ No critical or high-severity issues.', '');
  }

  lines.push('## Full Reports', '');
  for (const report of reports) {
    lines.push(`- \`${REPORTS_DIR}/${report.type}-latest.md\``);
  }
  lines.push('');

  const md = lines.join('\n');
  const stamp = fileTimestamp(generatedAt);
  const outPath = path.join(REPORTS_DIR, `comprehensive-${stamp}.md`);

  fs.writeFileSync(outPath, md);
  fs.writeFileSync(path.join(REPORTS_DIR, 'comprehensive-latest.md'), md);

  return outPath;
}
