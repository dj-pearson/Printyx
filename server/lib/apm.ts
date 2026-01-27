/**
 * Application Performance Monitoring (APM) Integration
 *
 * Supports multiple APM providers:
 * - Sentry (error tracking + performance monitoring)
 * - DataDog (APM + metrics + logs)
 * - New Relic (APM + infrastructure)
 *
 * The provider is selected via APM_PROVIDER environment variable.
 * Default: Sentry (if SENTRY_DSN is set)
 */

import type { Request, Response, NextFunction, Express, ErrorRequestHandler } from 'express';
import { createModuleLogger } from './logger';

const log = createModuleLogger('apm');

// APM Provider types
export type APMProvider = 'sentry' | 'datadog' | 'newrelic' | 'none';

// APM Configuration
export interface APMConfig {
  provider: APMProvider;
  dsn?: string; // Sentry DSN
  environment: string;
  release?: string;
  debug?: boolean;
  tracesSampleRate?: number;
  profilesSampleRate?: number;
  enableTracing?: boolean;
}

// Transaction context for performance monitoring
export interface TransactionContext {
  name: string;
  op: string;
  description?: string;
  data?: Record<string, unknown>;
}

// Span context for distributed tracing
export interface SpanContext {
  op: string;
  description?: string;
  data?: Record<string, unknown>;
}

// APM instance interface
export interface APMInstance {
  captureException(error: Error, context?: Record<string, unknown>): string | undefined;
  captureMessage(message: string, level?: 'info' | 'warning' | 'error'): string | undefined;
  setUser(user: { id: string; email?: string; username?: string } | null): void;
  setTag(key: string, value: string): void;
  setContext(name: string, context: Record<string, unknown>): void;
  startTransaction(context: TransactionContext): unknown;
  startSpan(context: SpanContext): unknown;
  flush(timeout?: number): Promise<boolean>;
  close(timeout?: number): Promise<boolean>;
}

// Sentry-specific imports and types (lazy loaded)
let Sentry: typeof import('@sentry/node') | null = null;
let SentryProfiler: typeof import('@sentry/profiling-node') | null = null;

// Build configuration from environment
function buildConfig(): APMConfig {
  const provider =
    (process.env.APM_PROVIDER as APMProvider) || (process.env.SENTRY_DSN ? 'sentry' : 'none');

  return {
    provider,
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.APP_VERSION || process.env.npm_package_version,
    debug: process.env.APM_DEBUG === 'true',
    tracesSampleRate: parseFloat(process.env.APM_TRACES_SAMPLE_RATE || '0.1'),
    profilesSampleRate: parseFloat(process.env.APM_PROFILES_SAMPLE_RATE || '0.1'),
    enableTracing: process.env.APM_ENABLE_TRACING !== 'false',
  };
}

// Noop APM instance for when no provider is configured
const noopAPM: APMInstance = {
  captureException: () => undefined,
  captureMessage: () => undefined,
  setUser: () => {},
  setTag: () => {},
  setContext: () => {},
  startTransaction: () => null,
  startSpan: () => null,
  flush: async () => true,
  close: async () => true,
};

// Global APM instance
let apmInstance: APMInstance = noopAPM;
let isInitialized = false;
let currentConfig: APMConfig | null = null;

/**
 * Initialize APM with the specified provider
 * This should be called as early as possible in the application lifecycle
 */
export async function initAPM(customConfig?: Partial<APMConfig>): Promise<APMInstance> {
  if (isInitialized) {
    log.warn('APM already initialized, skipping re-initialization');
    return apmInstance;
  }

  const config: APMConfig = { ...buildConfig(), ...customConfig };
  currentConfig = config;

  log.info({ provider: config.provider, environment: config.environment }, 'Initializing APM');

  try {
    switch (config.provider) {
      case 'sentry':
        apmInstance = await initSentry(config);
        break;
      case 'datadog':
        apmInstance = await initDataDog(config);
        break;
      case 'newrelic':
        apmInstance = await initNewRelic(config);
        break;
      case 'none':
      default:
        log.info('APM disabled - no provider configured');
        apmInstance = noopAPM;
    }

    isInitialized = true;
    log.info({ provider: config.provider }, 'APM initialized successfully');
    return apmInstance;
  } catch (error) {
    log.error(error as Error, 'Failed to initialize APM');
    apmInstance = noopAPM;
    return apmInstance;
  }
}

/**
 * Initialize Sentry SDK
 */
async function initSentry(config: APMConfig): Promise<APMInstance> {
  if (!config.dsn) {
    log.warn('SENTRY_DSN not configured, Sentry disabled');
    return noopAPM;
  }

  try {
    // Dynamic import for Sentry
    Sentry = await import('@sentry/node');

    // Try to load profiling if available
    try {
      SentryProfiler = await import('@sentry/profiling-node');
    } catch {
      log.debug('Sentry profiling not available');
    }

    // Build integrations array
    const integrations: ReturnType<typeof Sentry.getDefaultIntegrations> = [];

    // Add profiling integration if available
    if (SentryProfiler && config.profilesSampleRate && config.profilesSampleRate > 0) {
      integrations.push(SentryProfiler.nodeProfilingIntegration());
    }

    Sentry.init({
      dsn: config.dsn,
      environment: config.environment,
      release: config.release,
      debug: config.debug,
      tracesSampleRate: config.enableTracing ? config.tracesSampleRate : 0,
      profilesSampleRate: config.profilesSampleRate,
      integrations: integrations.length > 0 ? integrations : undefined,
      // Enable distributed tracing for database, http, etc.
      enableTracing: config.enableTracing,
      // Capture unhandled promise rejections
      autoSessionTracking: true,
      // Set sample rate for session replay (if enabled)
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
      // Filter out sensitive data
      beforeSend(event) {
        // Scrub sensitive request data
        if (event.request) {
          if (event.request.headers) {
            delete event.request.headers['authorization'];
            delete event.request.headers['cookie'];
          }
          if (event.request.data && typeof event.request.data === 'object') {
            const data = event.request.data as Record<string, unknown>;
            if ('password' in data) data['password'] = '[REDACTED]';
            if ('token' in data) data['token'] = '[REDACTED]';
            if ('secret' in data) data['secret'] = '[REDACTED]';
          }
        }
        return event;
      },
      // Filter breadcrumbs
      beforeBreadcrumb(breadcrumb) {
        // Don't include console breadcrumbs in production
        if (config.environment === 'production' && breadcrumb.category === 'console') {
          return null;
        }
        return breadcrumb;
      },
    });

    return {
      captureException: (error, context) => {
        if (context) {
          Sentry!.setContext('error_context', context);
        }
        return Sentry!.captureException(error);
      },
      captureMessage: (message, level) => {
        return Sentry!.captureMessage(message, level);
      },
      setUser: (user) => {
        Sentry!.setUser(user);
      },
      setTag: (key, value) => {
        Sentry!.setTag(key, value);
      },
      setContext: (name, context) => {
        Sentry!.setContext(name, context);
      },
      startTransaction: (context) => {
        return Sentry!.startSpan(
          {
            name: context.name,
            op: context.op,
            attributes: context.data as Record<string, string | number | boolean | undefined>,
          },
          () => {},
        );
      },
      startSpan: (context) => {
        return Sentry!.startSpan(
          {
            name: context.description || context.op,
            op: context.op,
            attributes: context.data as Record<string, string | number | boolean | undefined>,
          },
          () => {},
        );
      },
      flush: (timeout) => Sentry!.flush(timeout),
      close: (timeout) => Sentry!.close(timeout),
    };
  } catch (error) {
    log.error(error as Error, 'Failed to initialize Sentry');
    return noopAPM;
  }
}

/**
 * Initialize DataDog APM (placeholder for future implementation)
 */
async function initDataDog(_config: APMConfig): Promise<APMInstance> {
  log.warn('DataDog APM integration not yet implemented');
  // DataDog requires dd-trace package
  // Installation: npm install dd-trace
  // Usage would be:
  // const tracer = require('dd-trace').init({
  //   env: config.environment,
  //   service: 'printyx',
  //   version: config.release,
  // });
  return noopAPM;
}

/**
 * Initialize New Relic APM (placeholder for future implementation)
 */
async function initNewRelic(_config: APMConfig): Promise<APMInstance> {
  log.warn('New Relic APM integration not yet implemented');
  // New Relic requires newrelic package and newrelic.js config file
  // Installation: npm install newrelic
  // require('newrelic') must be the first line in your app
  return noopAPM;
}

/**
 * Get the current APM instance
 */
export function getAPM(): APMInstance {
  return apmInstance;
}

/**
 * Express error handler middleware for APM
 */
export function apmErrorHandler(): ErrorRequestHandler {
  return (err: Error, req: Request, res: Response, next: NextFunction) => {
    // Capture error in APM
    apmInstance.captureException(err, {
      requestId: (req as Request & { requestId?: string }).requestId,
      method: req.method,
      path: req.path,
      query: req.query,
      userId: (req as Request & { session?: { userId?: string } }).session?.userId,
      tenantId: req.header('x-tenant-id'),
    });

    // Pass to next error handler
    next(err);
  };
}

/**
 * Express request handler middleware for APM tracing
 */
export function apmRequestHandler() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Set user context if available
    const session = (req as Request & { session?: { userId?: string } }).session;
    if (session?.userId) {
      apmInstance.setUser({ id: session.userId });
    }

    // Set tenant tag
    const tenantId = req.header('x-tenant-id');
    if (tenantId) {
      apmInstance.setTag('tenant', tenantId);
    }

    // Set request ID tag
    const requestId = (req as Request & { requestId?: string }).requestId;
    if (requestId) {
      apmInstance.setTag('requestId', requestId);
    }

    next();
  };
}

/**
 * Setup Sentry-specific Express middleware
 * This adds request/tracing handlers specific to Sentry
 *
 * Note: Sentry v8 uses automatic instrumentation via `Sentry.init()` with
 * auto-discovery of Express. Manual handlers are no longer required.
 */
export function setupSentryMiddleware(_app: Express): void {
  if (currentConfig?.provider !== 'sentry' || !Sentry) {
    return;
  }

  // Sentry v8+ automatically instruments Express when initialized
  // No manual middleware setup required - tracing is handled via integrations
  log.debug('Sentry middleware configured (auto-instrumentation enabled)');
}

/**
 * Setup Sentry error handler
 * This should be added after all routes but before other error handlers
 *
 * Note: Sentry v8 uses automatic error capturing via the init() configuration.
 * Manual error handlers are optional but can still be used for custom logic.
 */
export function setupSentryErrorHandler(_app: Express): void {
  if (currentConfig?.provider !== 'sentry' || !Sentry) {
    return;
  }

  // Sentry v8+ automatically captures unhandled errors
  // For custom error filtering, use beforeSend in Sentry.init()
  log.debug('Sentry error handler configured (auto-capture enabled)');
}

/**
 * Wrap an async function with APM tracing
 */
export function withSpan<T>(name: string, op: string, fn: () => Promise<T>): Promise<T> {
  if (currentConfig?.provider === 'sentry' && Sentry && currentConfig.enableTracing) {
    return Sentry.startSpan({ name, op }, async () => fn());
  }
  return fn();
}

/**
 * Create a wrapper for database operations with tracing
 */
export function traceDBOperation<T>(
  operation: string,
  table: string,
  fn: () => Promise<T>,
): Promise<T> {
  return withSpan(`db.${operation}`, 'db.query', async () => {
    apmInstance.setContext('db', { operation, table });
    return fn();
  });
}

/**
 * Create a wrapper for external HTTP calls with tracing
 */
export function traceHTTPCall<T>(method: string, url: string, fn: () => Promise<T>): Promise<T> {
  return withSpan(`${method} ${url}`, 'http.client', async () => {
    apmInstance.setContext('http', { method, url });
    return fn();
  });
}

/**
 * Shutdown APM gracefully
 */
export async function shutdownAPM(timeout = 2000): Promise<void> {
  if (!isInitialized) return;

  log.info('Shutting down APM...');
  try {
    await apmInstance.flush(timeout);
    await apmInstance.close(timeout);
    isInitialized = false;
    log.info('APM shutdown complete');
  } catch (error) {
    log.error(error as Error, 'Error during APM shutdown');
  }
}

// Export utilities for manual instrumentation
export { Sentry };
