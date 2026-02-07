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

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' && {
      useDefaults: true,
      directives: {
        'default-src': ["'self'", 'https:'],
        'script-src': ["'self'", "'unsafe-inline'", 'https:'],
        'style-src': ["'self'", "'unsafe-inline'", 'https:'],
        'img-src': ["'self'", 'data:', 'blob:', 'https:'],
        'font-src': ["'self'", 'https:', 'data:'],
        'connect-src': ["'self'", 'https:', 'wss:', 'http:'],
        'frame-ancestors': ["'self'"],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
      },
    },
    referrerPolicy: { policy: 'no-referrer' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    frameguard: process.env.NODE_ENV === 'production' ? { action: 'sameorigin' } : false,
    hsts: { maxAge: 15552000, includeSubDomains: true, preload: true },
    hidePoweredBy: true,
  }),
);

// Permissions-Policy (not provided by helmet v7 directly)
app.use((req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()',
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

// CORS configuration - ALWAYS allow production origins
const allowedOriginsProd = [
  /^https?:\/\/([a-z0-9-]+\.)?printyx\.net$/i,
  'https://printyx.net',
  'https://api.printyx.net', // Allow API subdomain for server-to-server
];

const allowedOriginsDev = [
  'http://localhost:5000',
  'http://localhost:3000',
  'http://localhost:5173', // Vite default
  'http://127.0.0.1:5000',
  'http://127.0.0.1:3000',
  /^https:\/\/.*\.replit\.dev$/, // Replit development environments
];

const isDevelopment = process.env.NODE_ENV !== 'production';

// Helper to check if origin is allowed and return the actual origin string
function getAllowedOrigin(origin: string | undefined): string | false {
  // No origin = server-to-server request, allow but don't set CORS headers
  if (!origin) {
    return false;
  }

  // Check production origins
  const isProdOrigin = allowedOriginsProd.some((o) =>
    o instanceof RegExp ? o.test(origin) : o === origin,
  );
  if (isProdOrigin) {
    return origin; // Return the actual origin string, not true
  }

  // In development, also allow dev origins
  if (isDevelopment) {
    const isDevOrigin = allowedOriginsDev.some((o) =>
      o instanceof RegExp ? o.test(origin) : o === origin,
    );
    if (isDevOrigin) {
      return origin; // Return the actual origin string
    }
  }

  return false;
}

// Manual CORS middleware to ensure headers are set correctly
// This prevents proxies from overriding with Access-Control-Allow-Origin: *
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigin = getAllowedOrigin(origin);

  if (allowedOrigin) {
    // Set CORS headers explicitly with the specific origin (never *)
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-CSRF-Token, X-Requested-With, x-tenant-id, X-Demo-Auth',
    );
    res.setHeader('Access-Control-Expose-Headers', 'X-CSRF-Token');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

    // Log CORS decision
    log.info('[CORS] ✅ Allowed origin:', allowedOrigin);
  } else if (origin) {
    log.error('[CORS] ❌ BLOCKED origin:', origin);
  }

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    if (allowedOrigin) {
      res.setHeader('Vary', 'Origin');
      return res.status(204).end();
    } else {
      return res.status(403).json({ error: 'CORS not allowed for this origin' });
    }
  }

  next();
});

// Also use cors package as backup (it will respect already-set headers)
app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = getAllowedOrigin(origin);
      if (allowed || !origin) {
        // Return the actual origin string, not true
        callback(null, allowed || true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-CSRF-Token',
      'X-Requested-With',
      'x-tenant-id',
      'X-Demo-Auth',
    ],
    exposedHeaders: ['X-CSRF-Token'],
    maxAge: 86400,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  }),
);

// Compression
app.use(compression());

// SECURITY FIX: Add request size limits to prevent DoS
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

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
