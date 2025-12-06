/**
 * HTTP Logging Middleware
 *
 * Provides comprehensive request/response logging with:
 * - Correlation ID injection and propagation
 * - Request/response timing
 * - Structured log format
 * - User and tenant context
 * - Error logging with stack traces
 */

import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { randomUUID, createHash } from 'crypto';
import {
  logger,
  withRequestContext,
  type LogContext,
  createModuleLogger,
} from '../lib/logger';
import { getAPM } from '../lib/apm';

const log = createModuleLogger('http');

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
      tenantId?: string;
    }
  }
}

// Use 'any' for session to avoid complex type conflicts with express-session
type AnySession = {
  userId?: string;
  tenantId?: string;
  [key: string]: unknown;
};

// Request with optional session and user
type RequestWithSession = Request & {
  session?: AnySession;
  user?: { id?: string };
};

/**
 * Configuration options for logging middleware
 */
export interface LoggingMiddlewareOptions {
  /** Include request body in logs (default: false for security) */
  logRequestBody?: boolean;
  /** Include response body in logs (default: false for performance) */
  logResponseBody?: boolean;
  /** Maximum body size to log in bytes (default: 10KB) */
  maxBodySize?: number;
  /** Paths to exclude from logging (e.g., health checks) */
  excludePaths?: string[];
  /** Log level for successful requests (default: 'info') */
  successLogLevel?: 'trace' | 'debug' | 'info';
  /** Log level for client errors 4xx (default: 'warn') */
  clientErrorLogLevel?: 'warn' | 'info';
  /** Log level for server errors 5xx (default: 'error') */
  serverErrorLogLevel?: 'error' | 'warn';
  /** Paths to audit with full request/response details */
  auditPaths?: string[];
}

const defaultOptions: LoggingMiddlewareOptions = {
  logRequestBody: false,
  logResponseBody: false,
  maxBodySize: 10240, // 10KB
  excludePaths: ['/health', '/healthz', '/ready', '/live', '/_health'],
  successLogLevel: 'info',
  clientErrorLogLevel: 'warn',
  serverErrorLogLevel: 'error',
  auditPaths: ['/api/root-admin', '/api/security', '/api/platform', '/api/seo'],
};

/**
 * Truncate a string or object to maxSize bytes
 */
function truncateBody(body: unknown, maxSize: number): string | undefined {
  if (!body) return undefined;

  let str: string;
  if (typeof body === 'string') {
    str = body;
  } else {
    try {
      str = JSON.stringify(body);
    } catch {
      return '[non-serializable]';
    }
  }

  if (Buffer.byteLength(str, 'utf8') > maxSize) {
    return str.slice(0, maxSize) + '...[truncated]';
  }

  return str;
}

/**
 * Sanitize sensitive fields from an object
 */
function sanitizeBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;

  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'apiKey',
    'api_key',
    'accessToken',
    'access_token',
    'refreshToken',
    'refresh_token',
    'creditCard',
    'credit_card',
    'cvv',
    'ssn',
    'taxId',
    'tax_id',
    'authorization',
  ];

  const sanitized = { ...(body as Record<string, unknown>) };

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Hash body for audit logging (to track changes without storing sensitive data)
 */
function hashBody(body: unknown): string | undefined {
  if (!body) return undefined;

  try {
    const str = typeof body === 'string' ? body : JSON.stringify(body);
    return createHash('sha256').update(str).digest('hex').slice(0, 16);
  } catch {
    return undefined;
  }
}

/**
 * Determine if a path should be audited
 */
function shouldAudit(path: string, auditPaths: string[]): boolean {
  return auditPaths.some((auditPath) => path.startsWith(auditPath));
}

/**
 * Request ID middleware
 * Assigns or propagates correlation ID for distributed tracing
 */
export function requestIdMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check for incoming trace ID from various headers
    const incomingId =
      req.header('x-request-id') ||
      req.header('x-correlation-id') ||
      req.header('x-trace-id') ||
      req.header('traceparent')?.split('-')[1]; // W3C Trace Context

    const requestId = incomingId || randomUUID();

    // Store on request object
    req.requestId = requestId;
    req.startTime = Date.now();

    // Set response headers for client correlation
    res.setHeader('X-Request-Id', requestId);

    next();
  };
}

/**
 * Context injection middleware
 * Wraps request handling in AsyncLocalStorage context for automatic log correlation
 */
export function contextMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const reqWithSession = req as RequestWithSession;
    const context: LogContext = {
      requestId: req.requestId,
      userId: reqWithSession.session?.userId || reqWithSession.user?.id,
      tenantId: req.tenantId || reqWithSession.session?.tenantId || req.header('x-tenant-id'),
      sessionId: (req as Request & { sessionID?: string }).sessionID,
    };

    // Run the rest of the middleware chain within the context
    withRequestContext(context, () => {
      next();
    });
  };
}

/**
 * HTTP request/response logging middleware
 */
export function httpLoggingMiddleware(options: LoggingMiddlewareOptions = {}) {
  const opts = { ...defaultOptions, ...options };

  return (req: Request, res: Response, next: NextFunction) => {
    const reqWithSession = req as RequestWithSession;
    // Skip excluded paths
    if (opts.excludePaths?.some((path) => req.path.startsWith(path))) {
      return next();
    }

    const startTime = req.startTime || Date.now();
    const isAuditPath = shouldAudit(req.path, opts.auditPaths || []);

    // Capture response body if needed
    let responseBody: unknown;
    if (opts.logResponseBody || isAuditPath) {
      const originalJson = res.json;
      res.json = function (body: unknown) {
        responseBody = body;
        return originalJson.call(this, body);
      };
    }

    // Log on response finish
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      // Determine log level based on status code
      let logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error' = opts.successLogLevel || 'info';
      if (statusCode >= 500) {
        logLevel = opts.serverErrorLogLevel || 'error';
      } else if (statusCode >= 400) {
        logLevel = opts.clientErrorLogLevel || 'warn';
      }

      // Build log entry
      const logEntry: Record<string, unknown> = {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        url: req.originalUrl,
        statusCode,
        duration,
        userAgent: req.get('user-agent'),
        ip: req.ip || req.socket.remoteAddress,
        userId: reqWithSession.session?.userId || reqWithSession.user?.id,
        tenantId: req.tenantId || reqWithSession.session?.tenantId || req.header('x-tenant-id'),
        contentLength: res.get('content-length'),
        contentType: res.get('content-type'),
      };

      // Add request body for audit paths
      if (isAuditPath && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        logEntry.requestBodyHash = hashBody(req.body);
        if (opts.logRequestBody) {
          logEntry.requestBody = truncateBody(
            sanitizeBody(req.body),
            opts.maxBodySize || 10240,
          );
        }
      }

      // Add response body for audit paths
      if (isAuditPath && opts.logResponseBody && responseBody) {
        logEntry.responseBody = truncateBody(responseBody, opts.maxBodySize || 10240);
      }

      // Log with appropriate level
      const message = `${req.method} ${req.path} ${statusCode} ${duration}ms`;

      switch (logLevel) {
        case 'trace':
          log.trace(logEntry, message);
          break;
        case 'debug':
          log.debug(logEntry, message);
          break;
        case 'info':
          log.info(logEntry, message);
          break;
        case 'warn':
          log.warn(logEntry, message);
          break;
        case 'error':
          log.error(logEntry, message);
          break;
      }

      // Report to APM for slow requests
      if (duration > 5000) {
        getAPM().setTag('slow_request', 'true');
        getAPM().setContext('slow_request', {
          duration,
          path: req.path,
          method: req.method,
        });
      }
    });

    next();
  };
}

/**
 * Error logging middleware
 * Captures and logs errors with full context
 */
export function errorLoggingMiddleware(): ErrorRequestHandler {
  return (
    err: Error & { status?: number; statusCode?: number; code?: string; details?: unknown },
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const reqWithSession = req as RequestWithSession;
    const status = err.status || err.statusCode || 500;
    const duration = req.startTime ? Date.now() - req.startTime : 0;

    // Log error with full context
    log.error(
      {
        err,
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        url: req.originalUrl,
        statusCode: status,
        duration,
        userId: reqWithSession.session?.userId || reqWithSession.user?.id,
        tenantId: req.tenantId || reqWithSession.session?.tenantId || req.header('x-tenant-id'),
        errorCode: err.code,
        errorDetails: err.details,
        stack: err.stack,
      },
      `Request error: ${err.message}`,
    );

    // Capture in APM
    getAPM().captureException(err, {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: status,
    });

    // Pass to next error handler
    next(err);
  };
}

/**
 * Audit logging middleware for sensitive operations
 * Writes to both structured logs and audit file
 */
export function auditLoggingMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const reqWithSession = req as RequestWithSession;
    const shouldAuditRequest =
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
      (req.path.startsWith('/api/root-admin') ||
        req.path.startsWith('/api/seo') ||
        req.path.startsWith('/api/platform') ||
        req.path.startsWith('/api/security'));

    if (!shouldAuditRequest) {
      return next();
    }

    const startTime = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - startTime;

      log.audit(
        {
          requestId: req.requestId,
          method: req.method,
          path: req.originalUrl || req.path,
          statusCode: res.statusCode,
          duration,
          userId: reqWithSession.session?.userId || reqWithSession.user?.id,
          tenantId: req.tenantId || reqWithSession.session?.tenantId || req.header('x-tenant-id'),
          bodyHash: hashBody(req.body),
          userAgent: req.get('user-agent'),
          ip: req.ip || req.socket.remoteAddress,
        },
        `Audit: ${req.method} ${req.path}`,
      );
    });

    next();
  };
}

/**
 * Performance tracking middleware
 * Records detailed timing metrics
 */
export function performanceMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const timings: Record<string, number> = {};
    const marks: Record<string, number> = {};

    // Add performance utilities to request
    (req as Request & { perf: typeof perfUtils }).perf = {
      mark: (name: string) => {
        marks[name] = Date.now();
      },
      measure: (name: string, startMark: string) => {
        if (marks[startMark]) {
          timings[name] = Date.now() - marks[startMark];
        }
      },
      getTimings: () => ({ ...timings }),
    };

    const perfUtils = (req as Request & { perf: typeof perfUtils }).perf;

    res.on('finish', () => {
      // Log performance metrics if there are any
      const collectedTimings = perfUtils.getTimings();
      if (Object.keys(collectedTimings).length > 0) {
        logger.child({ module: 'perf' }).debug(
          {
            requestId: req.requestId,
            path: req.path,
            timings: collectedTimings,
          },
          'Request performance timings',
        );
      }
    });

    next();
  };
}

/**
 * Combined logging middleware setup
 * Applies all logging middleware in the correct order
 */
export function setupLoggingMiddleware(
  app: import('express').Express,
  options?: LoggingMiddlewareOptions,
) {
  // 1. Request ID (must be first)
  app.use(requestIdMiddleware());

  // 2. Context injection
  app.use(contextMiddleware());

  // 3. Performance tracking
  app.use(performanceMiddleware());

  // 4. HTTP logging
  app.use(httpLoggingMiddleware(options));

  // 5. Audit logging
  app.use(auditLoggingMiddleware());
}

/**
 * Setup error logging middleware (must be after routes)
 */
export function setupErrorLoggingMiddleware(app: import('express').Express) {
  app.use(errorLoggingMiddleware());
}
