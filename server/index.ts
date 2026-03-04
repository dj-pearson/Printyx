// Load environment variables FIRST before anything else
import { config as dotenvConfig } from 'dotenv';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('index');

dotenvConfig(); // Load .env file

// Validate environment configuration early
import { validateEnvironmentOrFail } from './lib/env-validation';
validateEnvironmentOrFail();

import express, { type Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import { registerRoutes } from './routes';
import { seedDashboardWidgets } from './seed-dashboard-widgets';
import { randomUUID, createHash } from 'crypto';
import fs from 'fs';
import { setupVite, serveStatic, log } from './vite';
import {
  initMonitoring,
  setupMonitoringMiddleware,
  setupMonitoringErrorHandlers,
  shutdownMonitoring,
  createModuleLogger,
  getAPM,
  getMonitoringHealth,
  getQueryStats,
} from './lib/monitoring';
import { setupOpenApi } from './openapi';
import { globalErrorHandler } from './middleware/error-handler';
import { closeDbConnections } from './db';
import { shutdownCache } from './lib/redis-client';

const app = express();

// Create module logger for server
const serverLog = createModuleLogger('server');

// Trust reverse proxy (needed for secure cookies and rate limits behind proxies)
app.set('trust proxy', 1);

// CSP nonce generation middleware - must run before helmet
app.use((req: Request, res: Response, next: NextFunction) => {
  // Generate a unique nonce for each request
  (res as any).cspNonce = randomUUID().replace(/-/g, '');
  next();
});

// Security headers
const isProduction = process.env.NODE_ENV === 'production';

app.use((req: Request, res: Response, next: NextFunction) => {
  const nonce = (res as any).cspNonce;

  const helmetMiddleware = helmet({
    contentSecurityPolicy: isProduction
      ? {
          useDefaults: false,
          directives: {
            'default-src': ["'self'"],
            'script-src': ["'self'", `'nonce-${nonce}'`],
            'style-src': ["'self'", "'unsafe-inline'", 'https:'],
            'img-src': ["'self'", 'data:', 'blob:', 'https:'],
            'font-src': ["'self'", 'https:', 'data:'],
            'connect-src': [
              "'self'",
              'wss:',
              'https://api.printyx.net',
              'https://functions.printyx.net',
            ],
            'frame-ancestors': ["'none'"],
            'object-src': ["'none'"],
            'base-uri': ["'self'"],
            'form-action': ["'self'"],
            'report-uri': ['/api/csp-report'],
            'report-to': ['csp-endpoint'],
          },
        }
      : false, // Disable CSP in development for Vite HMR compatibility
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' as const },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    frameguard: { action: 'deny' },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    hidePoweredBy: true,
    xContentTypeOptions: true, // X-Content-Type-Options: nosniff
  });

  helmetMiddleware(req, res, next);
});

// Permissions-Policy header (not provided by helmet v7 directly)
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(self)',
  );
  next();
});

// Setup monitoring middleware (includes request ID, context injection, HTTP logging)
// This replaces the manual request ID assignment with comprehensive monitoring
setupMonitoringMiddleware(app, {
  loggingOptions: {
    logRequestBody: false,
    logResponseBody: false,
    excludePaths: [
      '/health',
      '/healthz',
      '/ready',
      '/readyz',
      '/live',
      '/livez',
      '/_health',
      '/favicon.ico',
    ],
    auditPaths: ['/api/root-admin', '/api/security', '/api/platform', '/api/seo'],
  },
});

// SEC-010: CORS hardening with environment-specific origin validation
import { getCorsConfig, getValidatedOrigin, isMutationMethod } from './config/cors';

const currentEnv = process.env.NODE_ENV || 'development';
const corsConfig = getCorsConfig(currentEnv);
const corsLog = createModuleLogger('cors');

// Primary CORS middleware - validates origins and sets headers explicitly
// Never uses wildcard `*`, never reflects arbitrary Origin headers
app.use((req, res, next) => {
  const origin = req.headers.origin as string | undefined;
  const allowedOrigin = getValidatedOrigin(origin, currentEnv);

  if (allowedOrigin) {
    // Set CORS headers with the validated, specific origin (never *)
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', corsConfig.methods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', corsConfig.allowedHeaders.join(', '));
    res.setHeader('Access-Control-Expose-Headers', corsConfig.exposedHeaders.join(', '));
    res.setHeader('Access-Control-Max-Age', String(corsConfig.maxAge));
    // Vary by Origin so caches don't mix up responses for different origins
    res.setHeader('Vary', 'Origin');

    corsLog.debug({ origin: allowedOrigin }, 'CORS allowed origin');
  } else if (origin) {
    // Origin was provided but not in allowlist - do NOT set any CORS headers
    // This means the browser will block the response on the client side
    corsLog.warn({ origin }, 'CORS blocked unknown origin');
  }
  // No origin header = same-origin or server-to-server; no CORS headers needed

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    if (allowedOrigin) {
      return res.status(204).end();
    } else {
      return res.status(403).json({ error: 'CORS not allowed for this origin' });
    }
  }

  // Enforce Origin header on mutation requests in production/staging
  if (corsConfig.enforceMutationOrigin && isMutationMethod(req.method)) {
    if (!origin) {
      corsLog.warn(
        { method: req.method, path: req.path },
        'Mutation request missing Origin header',
      );
      return res.status(403).json({
        message: 'Origin header is required for mutation requests',
        code: 'MISSING_ORIGIN',
      });
    }
    if (!allowedOrigin) {
      corsLog.warn(
        { method: req.method, path: req.path, origin },
        'Mutation request from non-allowlisted origin',
      );
      return res.status(403).json({
        message: 'Origin not allowed',
        code: 'ORIGIN_NOT_ALLOWED',
      });
    }
  }

  next();
});

// Backup cors package layer - uses the same validation logic
// Ensures consistent behavior even if a proxy strips our manual headers
app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = getValidatedOrigin(origin, currentEnv);
      if (allowed) {
        callback(null, allowed);
      } else if (!origin) {
        // No origin = same-origin/server-to-server, allow without setting CORS origin
        callback(null, false);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: corsConfig.methods,
    allowedHeaders: corsConfig.allowedHeaders,
    exposedHeaders: corsConfig.exposedHeaders,
    maxAge: corsConfig.maxAge,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  }),
);

// Compression
app.use(compression());

// SECURITY FIX: Add request size limits to prevent DoS
// 1MB limit for normal JSON/form payloads; file uploads use multer with separate limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Input sanitization - strip XSS, null bytes, control chars, reject path traversal
import { inputSanitization } from './middleware/input-sanitization';
app.use(inputSanitization);

// Audit log for root-admin actions and sensitive endpoints
// Note: This is now primarily handled by the structured logging middleware,
// but we keep file-based audit logging for compliance/backup purposes
app.use((req: any, res, next) => {
  const startAt = Date.now();
  const shouldAudit =
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
    (req.path.startsWith('/api/root-admin') ||
      req.path.startsWith('/api/seo') ||
      req.path.startsWith('/api/platform') ||
      req.path.startsWith('/api/security'));

  if (!shouldAudit) return next();

  const onFinish = () => {
    res.removeListener('finish', onFinish);
    try {
      const durationMs = Date.now() - startAt;
      const payloadHash = createHash('sha256')
        .update(JSON.stringify(req.body || {}))
        .digest('hex');
      const tenantId = req.header('x-tenant-id');
      const userId = req.session?.userId || req.user?.id;
      const record = {
        ts: new Date().toISOString(),
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl || req.path,
        status: res.statusCode,
        durationMs,
        userId,
        tenantId,
        payloadHash,
      };
      const line = JSON.stringify(record) + '\n';
      try {
        fs.appendFileSync('server/audit.log', line, { encoding: 'utf8' });
      } catch {
        // best-effort; ignore write errors
      }
    } catch {
      // swallow audit errors
    }
  };

  res.on('finish', onFinish);
  next();
});

// Legacy request logging middleware - kept for backward compatibility
// Primary logging is now handled by setupMonitoringMiddleware above
// This can be removed once all teams have migrated to structured logging
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on('finish', () => {
    const duration = Date.now() - start;
    // Only log in development mode for legacy format
    if (
      path.startsWith('/api') &&
      process.env.NODE_ENV === 'development' &&
      process.env.LEGACY_LOGGING === 'true'
    ) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + '…';
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize monitoring systems (APM, structured logging, log aggregation)
  await initMonitoring();

  const server = await registerRoutes(app);

  // Setup OpenAPI/Swagger documentation
  setupOpenApi(app);
  serverLog.info('OpenAPI documentation available at /api/docs');

  // Add monitoring health and stats endpoints
  app.get('/api/monitoring/health', (_req, res) => {
    res.json(getMonitoringHealth());
  });

  app.get('/api/monitoring/db-stats', (_req, res) => {
    res.json(getQueryStats());
  });

  // Setup monitoring error handlers (must be after routes, before other error handlers)
  setupMonitoringErrorHandlers(app);

  // Global error handler (catches AppError subclasses + unhandled errors)
  app.use(globalErrorHandler);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get('env') === 'development') {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);

  // Windows-compatible listen options (reusePort not supported on Windows)
  const isWindows = process.platform === 'win32';
  const listenOptions: any = {
    port,
    host: isWindows ? '127.0.0.1' : '0.0.0.0', // Use localhost on Windows
  };

  // Only add reusePort on non-Windows platforms
  if (!isWindows) {
    listenOptions.reusePort = true;
  }

  server.listen(listenOptions, async () => {
    serverLog.info({ port }, `Server listening on port ${port}`);

    // Initialize cron jobs for automated tasks
    try {
      const { cronService } = await import('./services/cron-service');
      cronService.initialize();
      serverLog.info('Cron jobs initialized successfully');
    } catch (error) {
      serverLog.warn({ err: error as Error }, 'Failed to initialize cron jobs');
    }

    // Initialize email monitors for all enabled tenants
    try {
      const { startAllEmailMonitors } = await import('./services/email-monitor-service');
      await startAllEmailMonitors();
      serverLog.info('Email monitors initialized successfully');
    } catch (error) {
      serverLog.warn({ err: error as Error }, 'Failed to initialize email monitors');
    }
  });

  // Graceful shutdown handling
  let isShuttingDown = false;
  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    serverLog.info({ signal }, 'Received shutdown signal, initiating graceful shutdown...');

    // Force exit after 30 seconds
    const forceTimer = setTimeout(() => {
      serverLog.error('Forced shutdown after 30s timeout');
      process.exit(1);
    }, 30000);
    forceTimer.unref();

    // 1. Stop accepting new HTTP connections (in-flight requests continue)
    server.close(() => {
      serverLog.info('HTTP server closed, all in-flight requests completed');
    });

    // 2. Notify WebSocket clients and close after 5 seconds
    try {
      const { webSocketService } = await import('./websocket-service');
      const clientCount = webSocketService.getConnectedClients();
      if (clientCount > 0) {
        serverLog.info({ clientCount }, 'Notifying WebSocket clients of shutdown');
        webSocketService.broadcastDataUpdate('system', {
          type: 'server-shutdown',
          message: 'Server is shutting down',
        });
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
      webSocketService.destroy();
      serverLog.info('WebSocket connections closed');
    } catch {
      // WebSocket service may not be initialized
    }

    // 3. Shutdown monitoring systems (flush logs, close APM)
    try {
      await shutdownMonitoring();
      serverLog.info('Monitoring shutdown complete');
    } catch (err) {
      serverLog.error({ err }, 'Error shutting down monitoring');
    }

    // 4. Close Redis/cache connections
    try {
      await shutdownCache();
      serverLog.info('Redis/cache connections closed');
    } catch (err) {
      serverLog.error({ err }, 'Error closing Redis connections');
    }

    // 5. Drain database connection pool
    try {
      await closeDbConnections();
      serverLog.info('Database connections closed');
    } catch (err) {
      serverLog.error({ err }, 'Error closing database connections');
    }

    serverLog.info('Graceful shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
})();
