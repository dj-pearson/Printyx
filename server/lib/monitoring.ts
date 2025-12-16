/**
 * Unified Monitoring Module
 *
 * This module provides a single entry point for all monitoring functionality:
 * - Structured logging (Pino)
 * - APM integration (Sentry/DataDog/New Relic)
 * - Log aggregation (CloudWatch/Elasticsearch/Splunk)
 * - Database query logging
 * - HTTP request/response logging
 *
 * Usage:
 *   import { initMonitoring, shutdownMonitoring, logger, log } from './lib/monitoring';
 *
 *   // Initialize at app startup
 *   await initMonitoring();
 *
 *   // Use structured logging
 *   log.info('Server started');
 *   log.error(new Error('Something went wrong'), 'Error occurred');
 *
 *   // Shutdown gracefully
 *   await shutdownMonitoring();
 */

import type { Express } from 'express';
import {
  setupLoggingMiddleware,
  setupErrorLoggingMiddleware,
  type LoggingMiddlewareOptions,
} from '../middleware/logging-middleware';

// Re-export logger utilities
export {
  logger,
  log,
  createChildLogger,
  createModuleLogger,
  createContextualLogger,
  withRequestContext,
  getRequestContext,
  logContext,
  type LogContext,
  type LogLevel,
} from './logger';

// Re-export APM utilities
export {
  initAPM,
  getAPM,
  shutdownAPM,
  apmErrorHandler,
  apmRequestHandler,
  setupSentryMiddleware,
  setupSentryErrorHandler,
  withSpan,
  traceDBOperation,
  traceHTTPCall,
  Sentry,
  type APMInstance,
  type APMProvider,
  type APMConfig,
} from './apm';

// Re-export log transport utilities
export {
  createTransportStream,
  shutdownTransport,
  getTransportConfig,
  type LogTransportProvider,
  type TransportConfig,
} from './log-transports';

// Re-export database logging utilities
export {
  DrizzleLogger,
  drizzleLogger,
  tracedDbOperation,
  getQueryStats,
  resetQueryStats,
  queryStatsHandler,
} from './db-logger';

// Re-export HTTP logging middleware
export {
  setupLoggingMiddleware,
  setupErrorLoggingMiddleware,
  requestIdMiddleware,
  contextMiddleware,
  httpLoggingMiddleware,
  errorLoggingMiddleware,
  auditLoggingMiddleware,
  performanceMiddleware,
  type LoggingMiddlewareOptions,
} from '../middleware/logging-middleware';

import { createModuleLogger } from './logger';
import { initAPM, shutdownAPM, setupSentryMiddleware, setupSentryErrorHandler } from './apm';
import { shutdownTransport } from './log-transports';

const log = createModuleLogger('monitoring');

// Initialization state
let isInitialized = false;

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
  /** Enable APM (default: true if SENTRY_DSN or APM_PROVIDER is set) */
  enableAPM?: boolean;
  /** Enable log aggregation (default: true if LOG_TRANSPORT is set) */
  enableLogAggregation?: boolean;
  /** Enable database query logging (default: true in development) */
  enableDbLogging?: boolean;
  /** Enable HTTP request/response logging (default: true) */
  enableHttpLogging?: boolean;
}

/**
 * Initialize all monitoring systems
 *
 * This should be called at application startup, before any routes are registered.
 */
export async function initMonitoring(config: MonitoringConfig = {}): Promise<void> {
  if (isInitialized) {
    log.warn('Monitoring already initialized');
    return;
  }

  const {
    enableAPM = !!process.env.SENTRY_DSN || !!process.env.APM_PROVIDER,
    enableLogAggregation = !!process.env.LOG_TRANSPORT,
  } = config;

  log.info(
    {
      enableAPM,
      enableLogAggregation,
      nodeEnv: process.env.NODE_ENV,
      logLevel: process.env.LOG_LEVEL || 'info',
    },
    'Initializing monitoring systems',
  );

  // Initialize APM
  if (enableAPM) {
    await initAPM();
  }

  // Log aggregation is automatically configured via Pino transports
  if (enableLogAggregation) {
    log.info({ transport: process.env.LOG_TRANSPORT }, 'Log aggregation enabled');
  }

  isInitialized = true;
  log.info('Monitoring systems initialized successfully');
}

/**
 * Setup Express middleware for monitoring
 *
 * This should be called after app creation but before routes.
 */
export function setupMonitoringMiddleware(
  app: Express,
  options: {
    loggingOptions?: LoggingMiddlewareOptions;
  } = {},
): void {
  // Setup Sentry middleware (must be first)
  setupSentryMiddleware(app);

  // Setup logging middleware
  setupLoggingMiddleware(app, options.loggingOptions);

  log.debug('Monitoring middleware configured');
}

/**
 * Setup error handling middleware for monitoring
 *
 * This should be called after all routes are registered.
 */
export function setupMonitoringErrorHandlers(app: Express): void {
  // Setup error logging middleware
  setupErrorLoggingMiddleware(app);

  // Setup Sentry error handler
  setupSentryErrorHandler(app);

  log.debug('Monitoring error handlers configured');
}

/**
 * Shutdown monitoring gracefully
 *
 * This should be called when the application is shutting down.
 */
export async function shutdownMonitoring(): Promise<void> {
  if (!isInitialized) {
    return;
  }

  log.info('Shutting down monitoring systems...');

  try {
    // Shutdown APM
    await shutdownAPM();

    // Shutdown log transports
    await shutdownTransport();

    isInitialized = false;
    log.info('Monitoring systems shutdown complete');
  } catch (error) {
    log.error(error as Error, 'Error during monitoring shutdown');
  }
}

/**
 * Health check for monitoring systems
 */
export function getMonitoringHealth(): {
  initialized: boolean;
  apm: { enabled: boolean; provider: string | undefined };
  logging: { level: string; transport: string | undefined };
  database: { queryLogging: boolean };
} {
  return {
    initialized: isInitialized,
    apm: {
      enabled: !!process.env.SENTRY_DSN || !!process.env.APM_PROVIDER,
      provider: process.env.APM_PROVIDER || (process.env.SENTRY_DSN ? 'sentry' : undefined),
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info',
      transport: process.env.LOG_TRANSPORT,
    },
    database: {
      queryLogging: process.env.DB_LOG_QUERIES !== 'false',
    },
  };
}

/**
 * Express endpoint handler for monitoring health
 */
export function monitoringHealthHandler() {
  return (_req: unknown, res: { json: (data: unknown) => void }) => {
    res.json(getMonitoringHealth());
  };
}
