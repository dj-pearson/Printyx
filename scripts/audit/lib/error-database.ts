/**
 * Error Database
 * Persistent error tracking and management
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { TrackedError, ErrorDatabase, AuditIssue } from './types';

// ============================================================================
// Configuration
// ============================================================================

const DB_DIR = './audit-reports/errors';
const DB_FILE = path.join(DB_DIR, 'errors.json');
const TRENDS_FILE = path.join(DB_DIR, 'trends.json');

// ============================================================================
// Database Operations
// ============================================================================

function ensureDbDir(): void {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

export function loadDatabase(): ErrorDatabase {
  ensureDbDir();

  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const db = JSON.parse(content);
      // Convert date strings back to Date objects
      db.lastUpdated = new Date(db.lastUpdated);
      db.errors = db.errors.map((e: TrackedError) => ({
        ...e,
        firstSeen: new Date(e.firstSeen),
        lastSeen: new Date(e.lastSeen),
        resolution: e.resolution
          ? {
              ...e.resolution,
              date: new Date(e.resolution.date),
            }
          : undefined,
      }));
      db.history = db.history.map((h: ErrorDatabase['history'][0]) => ({
        ...h,
        date: new Date(h.date),
      }));
      return db;
    } catch {
      console.warn('Failed to load error database, creating new one');
    }
  }

  // Create new database
  return {
    version: 1,
    lastUpdated: new Date(),
    errors: [],
    history: [],
  };
}

export function saveDatabase(db: ErrorDatabase): void {
  ensureDbDir();
  db.lastUpdated = new Date();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ============================================================================
// Error Tracking
// ============================================================================

/**
 * Generate a signature for error deduplication
 */
export function generateErrorSignature(error: Partial<TrackedError>): string {
  const sigData = `${error.category}:${error.message}:${error.affectedResources?.join(',')}`;
  return crypto.createHash('md5').update(sigData).digest('hex').substring(0, 12);
}

/**
 * Track a new error or update existing one
 */
export function trackError(
  db: ErrorDatabase,
  error: Omit<TrackedError, 'id' | 'signature' | 'firstSeen' | 'lastSeen' | 'occurrences'>,
): TrackedError {
  const signature = generateErrorSignature(error);

  // Check if error already exists
  const existing = db.errors.find((e) => e.signature === signature);

  if (existing) {
    // Update existing error
    existing.lastSeen = new Date();
    existing.occurrences++;
    // Add any new affected resources
    error.affectedResources?.forEach((r) => {
      if (!existing.affectedResources.includes(r)) {
        existing.affectedResources.push(r);
      }
    });
    // Add any new audit types
    error.auditTypes?.forEach((t) => {
      if (!existing.auditTypes.includes(t)) {
        existing.auditTypes.push(t);
      }
    });
    return existing;
  }

  // Create new error
  const newError: TrackedError = {
    id: `err-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    signature,
    firstSeen: new Date(),
    lastSeen: new Date(),
    occurrences: 1,
    ...error,
  };

  db.errors.push(newError);
  return newError;
}

/**
 * Track errors from audit issues
 */
export function trackIssuesAsErrors(
  db: ErrorDatabase,
  issues: AuditIssue[],
  auditType: string,
): TrackedError[] {
  const tracked: TrackedError[] = [];

  for (const issue of issues) {
    const error = trackError(db, {
      message: issue.message,
      category: issue.category,
      severity: issue.severity,
      status: 'open',
      affectedResources: [issue.resource],
      auditTypes: [auditType],
    });
    tracked.push(error);
  }

  return tracked;
}

/**
 * Update error status
 */
export function updateErrorStatus(
  db: ErrorDatabase,
  errorId: string,
  status: TrackedError['status'],
  resolution?: TrackedError['resolution'],
): TrackedError | null {
  const error = db.errors.find((e) => e.id === errorId);
  if (!error) return null;

  error.status = status;
  if (resolution) {
    error.resolution = resolution;
  }

  return error;
}

/**
 * Add note to error
 */
export function addErrorNote(
  db: ErrorDatabase,
  errorId: string,
  note: string,
): TrackedError | null {
  const error = db.errors.find((e) => e.id === errorId);
  if (!error) return null;

  if (!error.notes) {
    error.notes = [];
  }
  error.notes.push(`[${new Date().toISOString()}] ${note}`);

  return error;
}

// ============================================================================
// Error Analysis
// ============================================================================

export function getOpenErrors(db: ErrorDatabase): TrackedError[] {
  return db.errors.filter((e) => e.status === 'open');
}

export function getErrorsByCategory(db: ErrorDatabase): Record<string, TrackedError[]> {
  return db.errors.reduce(
    (groups, error) => {
      if (!groups[error.category]) {
        groups[error.category] = [];
      }
      groups[error.category].push(error);
      return groups;
    },
    {} as Record<string, TrackedError[]>,
  );
}

export function getErrorsBySeverity(db: ErrorDatabase): Record<string, TrackedError[]> {
  return db.errors.reduce(
    (groups, error) => {
      if (!groups[error.severity]) {
        groups[error.severity] = [];
      }
      groups[error.severity].push(error);
      return groups;
    },
    {} as Record<string, TrackedError[]>,
  );
}

export function getErrorStats(db: ErrorDatabase): {
  total: number;
  open: number;
  investigating: number;
  fixed: number;
  wontFix: number;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
  recentErrors: TrackedError[];
  oldestOpen: TrackedError[];
} {
  const open = db.errors.filter((e) => e.status === 'open');
  const investigating = db.errors.filter((e) => e.status === 'investigating');
  const fixed = db.errors.filter((e) => e.status === 'fixed');
  const wontFix = db.errors.filter((e) => e.status === 'wont-fix');

  const bySeverity: Record<string, number> = {};
  const byCategory: Record<string, number> = {};

  for (const error of db.errors) {
    bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
    byCategory[error.category] = (byCategory[error.category] || 0) + 1;
  }

  // Recent errors (last 24 hours)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentErrors = db.errors
    .filter((e) => e.lastSeen > oneDayAgo)
    .sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())
    .slice(0, 10);

  // Oldest open errors
  const oldestOpen = open
    .sort((a, b) => a.firstSeen.getTime() - b.firstSeen.getTime())
    .slice(0, 10);

  return {
    total: db.errors.length,
    open: open.length,
    investigating: investigating.length,
    fixed: fixed.length,
    wontFix: wontFix.length,
    bySeverity,
    byCategory,
    recentErrors,
    oldestOpen,
  };
}

// ============================================================================
// Trend Analysis
// ============================================================================

export function recordSnapshot(db: ErrorDatabase): void {
  const stats = getErrorStats(db);

  db.history.push({
    date: new Date(),
    totalErrors: db.errors.length,
    bySeverity: stats.bySeverity,
    byStatus: {
      open: stats.open,
      investigating: stats.investigating,
      fixed: stats.fixed,
      'wont-fix': stats.wontFix,
    },
  });

  // Keep only last 90 days of history
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  db.history = db.history.filter((h) => h.date > ninetyDaysAgo);
}

export function getTrends(db: ErrorDatabase): {
  totalTrend: 'increasing' | 'decreasing' | 'stable';
  openTrend: 'increasing' | 'decreasing' | 'stable';
  weeklyChange: number;
  monthlyChange: number;
} {
  if (db.history.length < 2) {
    return {
      totalTrend: 'stable',
      openTrend: 'stable',
      weeklyChange: 0,
      monthlyChange: 0,
    };
  }

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const currentOpen = db.errors.filter((e) => e.status === 'open').length;

  // Find snapshots closest to our target dates
  const weeklySnapshot = db.history
    .filter((h) => h.date <= oneWeekAgo)
    .sort((a, b) => b.date.getTime() - a.date.getTime())[0];

  const monthlySnapshot = db.history
    .filter((h) => h.date <= oneMonthAgo)
    .sort((a, b) => b.date.getTime() - a.date.getTime())[0];

  const weeklyOpen = weeklySnapshot?.byStatus?.open ?? currentOpen;
  const monthlyOpen = monthlySnapshot?.byStatus?.open ?? currentOpen;

  const weeklyChange = currentOpen - weeklyOpen;
  const monthlyChange = currentOpen - monthlyOpen;

  return {
    totalTrend: getTrendDirection(monthlyChange),
    openTrend: getTrendDirection(weeklyChange),
    weeklyChange,
    monthlyChange,
  };
}

function getTrendDirection(change: number): 'increasing' | 'decreasing' | 'stable' {
  if (change > 0) return 'increasing';
  if (change < 0) return 'decreasing';
  return 'stable';
}

// ============================================================================
// CLI Helpers
// ============================================================================

export function printErrorStats(db: ErrorDatabase): void {
  const stats = getErrorStats(db);
  const trends = getTrends(db);

  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║          ERROR TRACKER STATISTICS          ║');
  console.log('╠════════════════════════════════════════════╣');
  console.log(`║  Total Errors:        ${String(stats.total).padStart(18)} ║`);
  console.log(`║  Open:                ${String(stats.open).padStart(18)} ║`);
  console.log(`║  Investigating:       ${String(stats.investigating).padStart(18)} ║`);
  console.log(`║  Fixed:               ${String(stats.fixed).padStart(18)} ║`);
  console.log(`║  Won't Fix:           ${String(stats.wontFix).padStart(18)} ║`);
  console.log('╠════════════════════════════════════════════╣');
  console.log(
    `║  Weekly Trend:        ${(trends.weeklyChange >= 0 ? '+' : '') + trends.weeklyChange} (${trends.openTrend})`.padEnd(
      44,
    ) + '║',
  );
  console.log(
    `║  Monthly Trend:       ${(trends.monthlyChange >= 0 ? '+' : '') + trends.monthlyChange} (${trends.totalTrend})`.padEnd(
      44,
    ) + '║',
  );
  console.log('╚════════════════════════════════════════════╝\n');

  if (stats.bySeverity.critical) {
    console.log(`🔴 Critical: ${stats.bySeverity.critical}`);
  }
  if (stats.bySeverity.high) {
    console.log(`🟠 High: ${stats.bySeverity.high}`);
  }
  if (stats.bySeverity.medium) {
    console.log(`🟡 Medium: ${stats.bySeverity.medium}`);
  }
  if (stats.bySeverity.low) {
    console.log(`🟢 Low: ${stats.bySeverity.low}`);
  }
}

export function printErrorList(errors: TrackedError[], limit: number = 20): void {
  const displayErrors = errors.slice(0, limit);

  console.log(
    '\n┌────────────────────────────────────────────────────────────────────────────────┐',
  );
  console.log('│ ID           │ Severity │ Status        │ Message                              │');
  console.log('├────────────────────────────────────────────────────────────────────────────────┤');

  for (const error of displayErrors) {
    const id = error.id.substring(0, 12).padEnd(12);
    const severity = error.severity.padEnd(8);
    const status = error.status.padEnd(13);
    const message = error.message.substring(0, 36).padEnd(36);
    console.log(`│ ${id} │ ${severity} │ ${status} │ ${message} │`);
  }

  console.log('└────────────────────────────────────────────────────────────────────────────────┘');

  if (errors.length > limit) {
    console.log(`\n... and ${errors.length - limit} more errors`);
  }
}

// ============================================================================
// Export
// ============================================================================

export default {
  loadDatabase,
  saveDatabase,
  generateErrorSignature,
  trackError,
  trackIssuesAsErrors,
  updateErrorStatus,
  addErrorNote,
  getOpenErrors,
  getErrorsByCategory,
  getErrorsBySeverity,
  getErrorStats,
  recordSnapshot,
  getTrends,
  printErrorStats,
  printErrorList,
};
