/**
 * Structured Logging Service using Pino
 *
 * Features:
 * - JSON structured logging
 * - Log levels (trace, debug, info, warn, error, fatal)
 * - Correlation ID propagation
 * - Child loggers with context
 * - Pretty printing in development
 * - External transport support (CloudWatch, ELK, etc.)
 */

import pino from 'pino';
import type { Logger, LoggerOptions, DestinationStream, LogFn } from 'pino';
import { AsyncLocalStorage } from 'async_hooks';

// Types for log context
export interface LogContext {
  requestId?: string;
  userId?: string;
  tenantId?: string;
  sessionId?: string;
  module?: string;
  operation?: string;
  [key: string]: unknown;
}

// Async local storage for request-scoped context
export const logContext = new AsyncLocalStorage<LogContext>();

// Log levels mapped to Pino levels
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';

// Configuration from environment
const LOG_LEVEL = (process.env.LOG_LEVEL as LogLevel) || 'info';
const NODE_ENV = process.env.NODE_ENV || 'development';
const APP_NAME = process.env.APP_NAME || 'printyx';
const APP_VERSION = process.env.APP_VERSION || '1.0.0';

// Custom log levels for Printyx
const customLevels = {
  audit: 35, // Between info (30) and warn (40)
  metric: 25, // Between debug (20) and info (30)
};

// Build base logger options
function buildLoggerOptions(): LoggerOptions {
  const isDevelopment = NODE_ENV === 'development';

  const baseOptions: LoggerOptions = {
    level: LOG_LEVEL,
    customLevels,
    base: {
      app: APP_NAME,
      version: APP_VERSION,
      env: NODE_ENV,
      pid: process.pid,
      hostname: process.env.HOSTNAME || 'unknown',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
      bindings: (bindings) => ({
        pid: bindings.pid,
        host: bindings.hostname,
      }),
    },
    // Redact sensitive fields
    redact: {
      paths: [
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
        'cookie',
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers.set-cookie',
        '*.password',
        '*.token',
        '*.secret',
      ],
      censor: '[REDACTED]',
    },
    // Serializers for common objects
    serializers: {
      req: (req) => ({
        id: req.id || req.requestId,
        method: req.method,
        url: req.url,
        path: req.path,
        query: req.query,
        params: req.params,
        remoteAddress: req.ip || req.remoteAddress,
        userAgent: req.headers?.['user-agent'],
      }),
      res: (res) => ({
        statusCode: res.statusCode,
        responseTime: res.responseTime,
      }),
      err: pino.stdSerializers.err,
    },
  };

  // Pretty print in development
  if (isDevelopment) {
    return {
      ...baseOptions,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
          messageFormat: '{if requestId}[{requestId}] {end}{msg}',
        },
      },
    };
  }

  return baseOptions;
}

// Create destinations array for multi-transport in production
function createDestinations(): DestinationStream | undefined {
  const isDevelopment = NODE_ENV === 'development';

  // In development, pino-pretty handles output via transport option
  if (isDevelopment) {
    return undefined;
  }

  // Production: JSON to stdout (can be picked up by log aggregators)
  return pino.destination({ sync: false });
}

// Create the base logger
const destination = createDestinations();
const loggerOptions = buildLoggerOptions();

export const logger: Logger = destination ? pino(loggerOptions, destination) : pino(loggerOptions);

// Extended logger type with custom levels
type ExtendedLogger = Logger & {
  audit: LogFn;
  metric: LogFn;
};

/**
 * Create a child logger with additional context
 */
export function createChildLogger(context: LogContext): Logger {
  return logger.child(context);
}

/**
 * Get current request context from AsyncLocalStorage
 */
export function getRequestContext(): LogContext | undefined {
  return logContext.getStore();
}

/**
 * Run a function with request context
 */
export function withRequestContext<T>(context: LogContext, fn: () => T): T {
  return logContext.run(context, fn);
}

/**
 * Create a logger that automatically includes request context
 */
export function createContextualLogger(module?: string): Logger {
  const context = getRequestContext() || {};
  return logger.child({ ...context, module });
}

/**
 * Log with automatic context injection
 * This function checks AsyncLocalStorage for request context
 */
export const log = {
  trace: (obj: object | string, msg?: string) => {
    const context = getRequestContext() || {};
    if (typeof obj === 'string') {
      logger.trace(context, obj);
    } else {
      logger.trace({ ...context, ...obj }, msg);
    }
  },
  debug: (obj: object | string, msg?: string) => {
    const context = getRequestContext() || {};
    if (typeof obj === 'string') {
      logger.debug(context, obj);
    } else {
      logger.debug({ ...context, ...obj }, msg);
    }
  },
  info: (obj: object | string, msg?: string) => {
    const context = getRequestContext() || {};
    if (typeof obj === 'string') {
      logger.info(context, obj);
    } else {
      logger.info({ ...context, ...obj }, msg);
    }
  },
  warn: (obj: object | string, msg?: string) => {
    const context = getRequestContext() || {};
    if (typeof obj === 'string') {
      logger.warn(context, obj);
    } else {
      logger.warn({ ...context, ...obj }, msg);
    }
  },
  error: (obj: object | string | Error, msg?: string) => {
    const context = getRequestContext() || {};
    if (obj instanceof Error) {
      logger.error({ ...context, err: obj }, msg || obj.message);
    } else if (typeof obj === 'string') {
      logger.error(context, obj);
    } else {
      logger.error({ ...context, ...obj }, msg);
    }
  },
  fatal: (obj: object | string | Error, msg?: string) => {
    const context = getRequestContext() || {};
    if (obj instanceof Error) {
      logger.fatal({ ...context, err: obj }, msg || obj.message);
    } else if (typeof obj === 'string') {
      logger.fatal(context, obj);
    } else {
      logger.fatal({ ...context, ...obj }, msg);
    }
  },
  audit: (obj: object | string, msg?: string) => {
    const context = getRequestContext() || {};
    const auditLogger = logger as ExtendedLogger;
    if (typeof obj === 'string') {
      auditLogger.audit(context, obj);
    } else {
      auditLogger.audit({ ...context, ...obj }, msg);
    }
  },
  metric: (obj: object | string, msg?: string) => {
    const context = getRequestContext() || {};
    const metricLogger = logger as ExtendedLogger;
    if (typeof obj === 'string') {
      metricLogger.metric(context, obj);
    } else {
      metricLogger.metric({ ...context, ...obj }, msg);
    }
  },
};

/**
 * Module-specific logger factory
 * Creates a logger with a predefined module context
 */
export function createModuleLogger(moduleName: string): typeof log {
  const moduleContext = { module: moduleName };

  return {
    trace: (obj: object | string, msg?: string) => {
      const context = { ...moduleContext, ...(getRequestContext() || {}) };
      if (typeof obj === 'string') {
        logger.trace(context, obj);
      } else {
        logger.trace({ ...context, ...obj }, msg);
      }
    },
    debug: (obj: object | string, msg?: string) => {
      const context = { ...moduleContext, ...(getRequestContext() || {}) };
      if (typeof obj === 'string') {
        logger.debug(context, obj);
      } else {
        logger.debug({ ...context, ...obj }, msg);
      }
    },
    info: (obj: object | string, msg?: string) => {
      const context = { ...moduleContext, ...(getRequestContext() || {}) };
      if (typeof obj === 'string') {
        logger.info(context, obj);
      } else {
        logger.info({ ...context, ...obj }, msg);
      }
    },
    warn: (obj: object | string, msg?: string) => {
      const context = { ...moduleContext, ...(getRequestContext() || {}) };
      if (typeof obj === 'string') {
        logger.warn(context, obj);
      } else {
        logger.warn({ ...context, ...obj }, msg);
      }
    },
    error: (obj: object | string | Error, msg?: string) => {
      const context = { ...moduleContext, ...(getRequestContext() || {}) };
      if (obj instanceof Error) {
        logger.error({ ...context, err: obj }, msg || obj.message);
      } else if (typeof obj === 'string') {
        logger.error(context, obj);
      } else {
        logger.error({ ...context, ...obj }, msg);
      }
    },
    fatal: (obj: object | string | Error, msg?: string) => {
      const context = { ...moduleContext, ...(getRequestContext() || {}) };
      if (obj instanceof Error) {
        logger.fatal({ ...context, err: obj }, msg || obj.message);
      } else if (typeof obj === 'string') {
        logger.fatal(context, obj);
      } else {
        logger.fatal({ ...context, ...obj }, msg);
      }
    },
    audit: (obj: object | string, msg?: string) => {
      const context = { ...moduleContext, ...(getRequestContext() || {}) };
      const auditLogger = logger as ExtendedLogger;
      if (typeof obj === 'string') {
        auditLogger.audit(context, obj);
      } else {
        auditLogger.audit({ ...context, ...obj }, msg);
      }
    },
    metric: (obj: object | string, msg?: string) => {
      const context = { ...moduleContext, ...(getRequestContext() || {}) };
      const metricLogger = logger as ExtendedLogger;
      if (typeof obj === 'string') {
        metricLogger.metric(context, obj);
      } else {
        metricLogger.metric({ ...context, ...obj }, msg);
      }
    },
  };
}

// Export default logger for backward compatibility
export default logger;
