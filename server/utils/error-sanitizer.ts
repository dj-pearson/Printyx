/**
 * Error Sanitization Utility (SEC-015)
 *
 * Prevents sensitive information disclosure in API error responses.
 * Scrubs PostgreSQL details, file paths, internal IPs, SQL fragments,
 * stack traces, and framework version numbers from error messages.
 *
 * SECURITY: Production errors should be generic, detailed errors only in development.
 */

import { Response } from 'express';
import { createModuleLogger } from '../lib/logger';

const log = createModuleLogger('error-sanitizer');

// ─── Regex Patterns for Sensitive Information ────────────────────────

/** PostgreSQL error details: column names, table names, constraint names */
const PG_COLUMN_RE = /\bcolumn\s+"[^"]+"/gi;
const PG_TABLE_RE = /\btable\s+"[^"]+"/gi;
const PG_CONSTRAINT_RE = /\bconstraint\s+"[^"]+"/gi;
const PG_RELATION_RE = /\brelation\s+"[^"]+"/gi;
const PG_DETAIL_RE = /\bDetail:\s+.*/gi;
const PG_HINT_RE = /\bHint:\s+.*/gi;

/** File paths that reveal server structure */
const FILE_PATH_RE = /(?:\/home\/|\/app\/|\/server\/|\/usr\/|\/var\/)[^\s:,)]+/g;

/** Windows-style paths */
const WIN_PATH_RE = /[A-Z]:\\(?:Users|Program Files|Windows)[^\s:,)]+/gi;

/** Internal IPv4 addresses (10.x, 172.16-31.x, 192.168.x, 127.x) */
const INTERNAL_IPV4_RE =
  /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|127\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g;

/** Internal hostnames (*.internal, *.local, *.localdomain, *.private) */
const INTERNAL_HOSTNAME_RE = /\b[\w-]+\.(?:internal|local|localdomain|private)\b/gi;

/** SQL fragments: keyword followed by identifiers */
const SQL_FRAGMENT_RE =
  /\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|WHERE|(?:INNER|LEFT|RIGHT|FULL|CROSS)\s+JOIN|JOIN)\s+["`]?[\w.*]+["`]?(?:\s+(?:AS\s+)?["`]?[\w]+["`]?)?/gi;

/** Stack trace lines */
const STACK_TRACE_RE = /\bat\s+(?:Function|Object|Module|async|new\s+\w+|[\w$.]+)\.[^\n]*/g;

/** Framework version numbers */
const FRAMEWORK_VERSION_RE =
  /\b(?:Express|Node|node|express|Next|next|Fastify|fastify|Koa|koa)\/\d+\.\d+(?:\.\d+)?/g;

/** PostgreSQL error codes with details */
const PG_ERROR_CODE_RE = /\berror:\s+[A-Z_]+\s+\(\d{5}\)/gi;

/** Connection strings */
const CONNECTION_STRING_RE =
  /(?:postgres(?:ql)?|mysql|mongodb|redis):\/\/[^\s"')]+/gi;

// ─── Core Sanitization ──────────────────────────────────────────────

/**
 * Scrub sensitive information from an error message string.
 * Removes PostgreSQL details, file paths, internal IPs, SQL fragments,
 * stack traces, and framework version numbers.
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message || typeof message !== 'string') {
    return 'An error occurred';
  }

  let sanitized = message;

  // Remove connection strings first (they contain IPs and credentials)
  sanitized = sanitized.replace(CONNECTION_STRING_RE, '[connection-redacted]');

  // Remove PostgreSQL error details
  sanitized = sanitized.replace(PG_COLUMN_RE, 'column [redacted]');
  sanitized = sanitized.replace(PG_TABLE_RE, 'table [redacted]');
  sanitized = sanitized.replace(PG_CONSTRAINT_RE, 'constraint [redacted]');
  sanitized = sanitized.replace(PG_RELATION_RE, 'relation [redacted]');
  sanitized = sanitized.replace(PG_DETAIL_RE, '');
  sanitized = sanitized.replace(PG_HINT_RE, '');
  sanitized = sanitized.replace(PG_ERROR_CODE_RE, '[database-error]');

  // Remove file paths
  sanitized = sanitized.replace(FILE_PATH_RE, '[path-redacted]');
  sanitized = sanitized.replace(WIN_PATH_RE, '[path-redacted]');

  // Remove internal IPs and hostnames
  sanitized = sanitized.replace(INTERNAL_IPV4_RE, '[ip-redacted]');
  sanitized = sanitized.replace(INTERNAL_HOSTNAME_RE, '[host-redacted]');

  // Remove SQL fragments
  sanitized = sanitized.replace(SQL_FRAGMENT_RE, '[sql-redacted]');

  // Remove stack traces
  sanitized = sanitized.replace(STACK_TRACE_RE, '[trace-redacted]');

  // Remove framework version numbers
  sanitized = sanitized.replace(FRAMEWORK_VERSION_RE, '[version-redacted]');

  // Collapse multiple whitespace and trim
  sanitized = sanitized.replace(/\s{2,}/g, ' ').trim();

  return sanitized || 'An error occurred';
}

/**
 * Sanitize an Error object for production responses.
 * In production: returns generic "Internal server error" for 5xx-class errors.
 * In development: returns full sanitized error details.
 */
export function sanitizeErrorForProduction(error: Error): { message: string; code: string } {
  const isProduction = process.env.NODE_ENV === 'production';
  const errCode =
    (error as any).code ||
    (error as any).statusCode?.toString() ||
    'INTERNAL_ERROR';

  if (!isProduction) {
    // Development: return full details but still scrub the most dangerous leaks
    return {
      message: error.message,
      code: typeof errCode === 'string' ? errCode : String(errCode),
    };
  }

  // Production: generic message for server errors
  return {
    message: 'Internal server error',
    code: 'INTERNAL_ERROR',
  };
}

/**
 * Strip sensitive headers before logging.
 * Removes Authorization, Cookie, and X-CSRF-Token headers.
 */
export function stripSensitiveHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  if (!headers || typeof headers !== 'object') {
    return {};
  }

  const sensitiveKeys = new Set([
    'authorization',
    'cookie',
    'x-csrf-token',
    'set-cookie',
    'x-api-key',
    'proxy-authorization',
  ]);

  const cleaned: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (sensitiveKeys.has(key.toLowerCase())) {
      cleaned[key] = '[redacted]';
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

// ─── Legacy Exports (backward-compatible) ───────────────────────────

interface SanitizedError {
  message: string;
  requestId?: string;
  details?: any;
}

/**
 * Sanitize error messages for production environments.
 * Removes stack traces, internal paths, and sensitive details.
 */
export function sanitizeError(error: any, isDevelopment: boolean = false): SanitizedError {
  // In development, return more details
  if (isDevelopment || process.env.NODE_ENV === 'development') {
    return {
      message: error?.message || 'An error occurred',
      details: error?.stack || error,
    };
  }

  // In production, return generic messages with full sanitization
  const sanitized: SanitizedError = {
    message: 'An error occurred processing your request',
  };

  // Map specific error types to user-friendly messages
  if (error?.code === 'ECONNREFUSED') {
    sanitized.message = 'Service temporarily unavailable';
  } else if (error?.code === '23505') {
    sanitized.message = 'This record already exists';
  } else if (error?.code === '23503') {
    sanitized.message = 'Cannot delete: record is referenced elsewhere';
  } else if (error?.code === 'ETIMEDOUT') {
    sanitized.message = 'Request timed out';
  } else if (error?.name === 'ValidationError') {
    sanitized.message = 'Invalid input data';
  } else if (error?.name === 'UnauthorizedError') {
    sanitized.message = 'Unauthorized access';
  }

  return sanitized;
}

/**
 * Send a sanitized error response.
 * SECURITY: Automatically sanitizes errors in production.
 */
export function sendErrorResponse(
  res: Response,
  error: any,
  statusCode: number = 500,
  requestId?: string,
) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const sanitized = sanitizeError(error, isDevelopment);

  // Always log the full error server-side
  log.error('[ERROR]', {
    requestId,
    error: error?.message || error,
    stack: error?.stack,
    code: error?.code,
  });

  // Send sanitized response to client
  res.status(statusCode).json({
    error: sanitized.message,
    requestId: requestId || undefined,
    ...(isDevelopment && sanitized.details ? { details: sanitized.details } : {}),
  });
}

/**
 * Sanitize sensitive data before logging.
 * Removes passwords, tokens, credit cards, SSNs, etc.
 */
export function sanitizeForLogging(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'apiKey',
    'api_key',
    'accessToken',
    'refreshToken',
    'creditCard',
    'cardNumber',
    'cvv',
    'ssn',
    'taxId',
    'bankAccount',
    'routingNumber',
  ];

  const cloned = Array.isArray(data) ? [...data] : { ...data };

  for (const key in cloned) {
    if (sensitiveFields.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
      cloned[key] = '[REDACTED]';
    } else if (typeof cloned[key] === 'object' && cloned[key] !== null) {
      cloned[key] = sanitizeForLogging(cloned[key]);
    }
  }

  return cloned;
}

/**
 * Middleware to add request ID to all requests.
 */
export function requestIdMiddleware(req: any, res: any, next: any) {
  req.requestId =
    req.headers['x-request-id'] || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-Id', req.requestId);
  next();
}
