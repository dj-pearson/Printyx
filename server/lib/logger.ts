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
import { config } from '../config';

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

// Configuration from environment (with centralized config fallback)
const LOG_LEVEL = (process.env.LOG_LEVEL as LogLevel) || config.logging.level;
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
/**
 * Structured logger surface. Supports BOTH calling conventions:
 *   log.error({ userId }, 'message')   — pino object-first (mergingObject, msg)
 *   log.error('message', errOrMeta)    — message-first; errOrMeta was previously
 *                                        SILENTLY DROPPED and is now merged so it
 *                                        actually reaches the logs.
 */
export interface StructuredLogger {
  trace: (obj: object | string, msg?: unknown) => void;
  debug: (obj: object | string, msg?: unknown) => void;
  info: (obj: object | string, msg?: unknown) => void;
  warn: (obj: object | string, msg?: unknown) => void;
  error: (obj: object | string | Error, msg?: unknown) => void;
  fatal: (obj: object | string | Error, msg?: unknown) => void;
  audit: (obj: object | string, msg?: unknown) => void;
  metric: (obj: object | string, msg?: unknown) => void;
}

/** Normalize a (legacy message-first) second argument into a mergeable object. */
function metaToObject(meta: unknown): Record<string, unknown> {
  if (meta == null) return {};
  if (meta instanceof Error) return { err: meta };
  if (typeof meta === 'object') return meta as Record<string, unknown>;
  return { detail: meta };
}

/**
 * Build a logger surface over a pino instance, resolving request context lazily.
 * `out` is the underlying pino level fn (so custom levels audit/metric work too).
 */
function buildLogger(getContext: () => object): StructuredLogger {
  const ext = logger as ExtendedLogger;
  const run = (
    out: (o: object, m?: string) => void,
    obj: object | string | Error,
    msg?: unknown,
  ): void => {
    const context = getContext();
    if (obj instanceof Error) {
      out({ ...context, err: obj }, typeof msg === 'string' && msg ? msg : obj.message);
    } else if (typeof obj === 'string') {
      // message-first: obj is the message, msg is optional metadata (was dropped).
      out({ ...context, ...metaToObject(msg) }, obj);
    } else {
      out({ ...context, ...obj }, typeof msg === 'string' ? msg : undefined);
    }
  };
  return {
    trace: (obj, msg) => run((o, m) => logger.trace(o, m), obj, msg),
    debug: (obj, msg) => run((o, m) => logger.debug(o, m), obj, msg),
    info: (obj, msg) => run((o, m) => logger.info(o, m), obj, msg),
    warn: (obj, msg) => run((o, m) => logger.warn(o, m), obj, msg),
    error: (obj, msg) => run((o, m) => logger.error(o, m), obj, msg),
    fatal: (obj, msg) => run((o, m) => logger.fatal(o, m), obj, msg),
    audit: (obj, msg) => run((o, m) => ext.audit(o, m), obj, msg),
    metric: (obj, msg) => run((o, m) => ext.metric(o, m), obj, msg),
  };
}

/**
 * Log with automatic context injection.
 * Checks AsyncLocalStorage for request context.
 */
export const log: StructuredLogger = buildLogger(() => getRequestContext() || {});

/**
 * Module-specific logger factory.
 * Creates a logger with a predefined module context.
 */
export function createModuleLogger(moduleName: string): StructuredLogger {
  const moduleContext = { module: moduleName };
  return buildLogger(() => ({ ...moduleContext, ...(getRequestContext() || {}) }));
}

// Export default logger for backward compatibility
export default logger;
