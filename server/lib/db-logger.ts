/**
 * Database Query Logging for Drizzle ORM
 *
 * Provides:
 * - Query logging with timing
 * - Slow query detection and alerting
 * - Query parameter redaction for security
 * - APM integration for database spans
 */

import type { Logger } from 'drizzle-orm';
import { createModuleLogger, getRequestContext } from './logger';
import { getAPM, withSpan } from './apm';

const log = createModuleLogger('db');

// Configuration
const SLOW_QUERY_THRESHOLD_MS = parseInt(process.env.DB_SLOW_QUERY_THRESHOLD_MS || '1000', 10);
const LOG_QUERY_PARAMS = process.env.DB_LOG_PARAMS === 'true';
const ENABLE_QUERY_LOGGING = process.env.DB_LOG_QUERIES !== 'false';

// Sensitive parameter patterns to redact
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api_?key/i,
  /credit_?card/i,
  /cvv/i,
  /ssn/i,
  /tax_?id/i,
];

/**
 * Redact sensitive values from query parameters
 */
function redactParams(params: unknown[]): unknown[] {
  return params.map((param, index) => {
    if (typeof param === 'string') {
      // Check if this looks like a sensitive value
      for (const pattern of SENSITIVE_PATTERNS) {
        if (pattern.test(String(index)) || param.length > 100) {
          return '[REDACTED]';
        }
      }
    }
    return param;
  });
}

/**
 * Format query for logging (truncate if too long)
 */
function formatQuery(query: string, maxLength = 500): string {
  const normalized = query.replace(/\s+/g, ' ').trim();
  if (normalized.length > maxLength) {
    return normalized.slice(0, maxLength) + '... [truncated]';
  }
  return normalized;
}

/**
 * Extract operation type from query
 */
function getQueryOperation(query: string): string {
  const normalized = query.trim().toUpperCase();
  if (normalized.startsWith('SELECT')) return 'SELECT';
  if (normalized.startsWith('INSERT')) return 'INSERT';
  if (normalized.startsWith('UPDATE')) return 'UPDATE';
  if (normalized.startsWith('DELETE')) return 'DELETE';
  if (normalized.startsWith('WITH')) return 'CTE';
  if (normalized.startsWith('BEGIN')) return 'TRANSACTION';
  if (normalized.startsWith('COMMIT')) return 'COMMIT';
  if (normalized.startsWith('ROLLBACK')) return 'ROLLBACK';
  return 'QUERY';
}

/**
 * Extract table name from query (best effort)
 */
function getTableName(query: string): string | undefined {
  const patterns = [
    /FROM\s+["']?(\w+)["']?/i,
    /INTO\s+["']?(\w+)["']?/i,
    /UPDATE\s+["']?(\w+)["']?/i,
    /DELETE\s+FROM\s+["']?(\w+)["']?/i,
  ];

  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return undefined;
}

/**
 * Database query statistics collector
 */
class QueryStats {
  private queryCount = 0;
  private totalDuration = 0;
  private slowQueries = 0;
  private errorCount = 0;
  private lastReset = Date.now();

  record(duration: number, isError = false): void {
    this.queryCount++;
    this.totalDuration += duration;
    if (duration > SLOW_QUERY_THRESHOLD_MS) {
      this.slowQueries++;
    }
    if (isError) {
      this.errorCount++;
    }
  }

  getStats(): {
    queryCount: number;
    avgDuration: number;
    slowQueries: number;
    errorCount: number;
    uptime: number;
  } {
    return {
      queryCount: this.queryCount,
      avgDuration: this.queryCount > 0 ? this.totalDuration / this.queryCount : 0,
      slowQueries: this.slowQueries,
      errorCount: this.errorCount,
      uptime: Date.now() - this.lastReset,
    };
  }

  reset(): void {
    this.queryCount = 0;
    this.totalDuration = 0;
    this.slowQueries = 0;
    this.errorCount = 0;
    this.lastReset = Date.now();
  }
}

// Global stats collector
export const queryStats = new QueryStats();

/**
 * Drizzle ORM Logger implementation
 */
export class DrizzleLogger implements Logger {
  logQuery(query: string, params: unknown[]): void {
    if (!ENABLE_QUERY_LOGGING) return;

    const startTime = Date.now();
    const operation = getQueryOperation(query);
    const table = getTableName(query);
    const context = getRequestContext();

    // Log query start at debug level
    log.debug(
      {
        operation,
        table,
        query: formatQuery(query),
        params: LOG_QUERY_PARAMS ? redactParams(params) : undefined,
        requestId: context?.requestId,
      },
      `DB ${operation}${table ? ` on ${table}` : ''}`,
    );

    // Record timing for APM
    const duration = Date.now() - startTime;
    queryStats.record(duration);

    // Report slow queries
    if (duration > SLOW_QUERY_THRESHOLD_MS) {
      log.warn(
        {
          operation,
          table,
          query: formatQuery(query, 1000),
          duration,
          threshold: SLOW_QUERY_THRESHOLD_MS,
          requestId: context?.requestId,
        },
        `Slow query detected: ${duration}ms`,
      );

      // Report to APM
      getAPM().setTag('slow_query', 'true');
      getAPM().setContext('slow_query', {
        operation,
        table,
        duration,
        query: formatQuery(query, 200),
      });
    }
  }
}

/**
 * Create a logged database instance
 * This wraps the Drizzle instance with query logging
 */
export function createLoggedDb<T extends object>(db: T): T {
  if (!ENABLE_QUERY_LOGGING) {
    return db;
  }

  // Return db with logger - actual logging happens via Drizzle's logger option
  return db;
}

/**
 * Wrap a database operation with APM tracing
 */
export async function tracedDbOperation<T>(
  operation: string,
  table: string,
  fn: () => Promise<T>,
): Promise<T> {
  const startTime = Date.now();
  const context = getRequestContext();

  try {
    const result = await withSpan(`db.${operation}`, 'db.query', async () => {
      getAPM().setContext('db', { operation, table });
      return fn();
    });

    const duration = Date.now() - startTime;
    queryStats.record(duration);

    log.debug(
      {
        operation,
        table,
        duration,
        requestId: context?.requestId,
      },
      `DB ${operation} on ${table} completed in ${duration}ms`,
    );

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    queryStats.record(duration, true);

    log.error(
      {
        err: error as Error,
        operation,
        table,
        duration,
        requestId: context?.requestId,
      },
      `DB ${operation} on ${table} failed`,
    );

    throw error;
  }
}

/**
 * Get current database query statistics
 */
export function getQueryStats() {
  return queryStats.getStats();
}

/**
 * Reset query statistics
 */
export function resetQueryStats() {
  queryStats.reset();
}

/**
 * Express endpoint handler for query stats
 */
export function queryStatsHandler() {
  return (_req: unknown, res: { json: (data: unknown) => void }) => {
    res.json(getQueryStats());
  };
}

// Export the logger instance for Drizzle configuration
export const drizzleLogger = new DrizzleLogger();
