/**
 * Routes Entry Point
 *
 * Configures middleware stack and delegates route registration
 * to routes-registry.ts. Creates HTTP server with WebSocket support.
 *
 * Structure:
 * 1. Middleware setup (rate limiting, versioning, auth, CSRF)
 * 2. Route module registration (via routes-registry)
 * 3. Infrastructure (HTTP server, WebSocket, scheduled jobs)
 */

import type { Express } from 'express';
import { createServer, type Server } from 'http';

// ─── Middleware Imports ────────────────────────────────────────────────
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import { csrfProtection, csrfTokenHandler } from './middleware/csrf-protection';
import connectPg from 'connect-pg-simple';
import { globalTieredRateLimit } from './middleware/user-rate-limit';
import { setupAuth } from './replitAuth';
import { blockRegistrations } from './middleware/registration-lock';
import { apiVersioning, legacyRouteSupport, apiVersionInfo } from './middleware/api-versioning';
import { resolveTenant } from './middleware/tenancy';
import { storage } from './storage';

// ─── Route Registry ───────────────────────────────────────────────────
import { registerAllRouteModules } from './routes-registry';

import { getUserId, getTenantId } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes');

// ─── Legacy Auth Middleware (used by setupSalesPipelineRoutes) ─────────
const requireAuth = async (req: any, res: any, next: any) => {
  const isAuthenticated = req.session?.userId || req.user?.id || req.user?.claims?.sub;
  if (!isAuthenticated) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  const userId = req.user?.id || req.user?.claims?.sub || req.session?.userId;
  if (userId && (!req.user || !req.user.tenantId)) {
    try {
      const fullUser = await storage.getUser(userId);
      if (fullUser) {
        req.user = {
          ...req.user,
          id: fullUser.id,
          tenantId: fullUser.tenantId,
          isPlatformUser: fullUser.isPlatformUser,
          email: fullUser.email,
          firstName: fullUser.firstName,
          lastName: fullUser.lastName,
        };
      }
    } catch (error) {
      log.error('Error fetching user details:', error);
    }
  }
  const helperUserId = getUserId(req);
  const helperTenantId = getTenantId(req);
  if (!req.user) {
    req.user = { id: helperUserId, tenantId: helperTenantId };
  } else if (!req.user.tenantId && !req.user.id) {
    req.user = { id: helperUserId, tenantId: helperTenantId };
  }
  next();
};

// ═══════════════════════════════════════════════════════════════════════
// Route Registration
// ═══════════════════════════════════════════════════════════════════════

export async function registerRoutes(app: Express): Promise<Server> {
  // ─── Rate Limiting ────────────────────────────────────────────────
  // Outer safety net: express-rate-limit for absolute max per IP
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later.', code: 'RATE_LIMITED' },
  });
  app.use('/api/', apiLimiter);

  // Tiered per-user rate limiting (auth: 5/min, billing: 20/min, mutation: 100/min, read: 200/min)
  app.use('/api/', globalTieredRateLimit);

  // ─── API Versioning ───────────────────────────────────────────────
  app.use('/api', apiVersioning());
  app.use(
    '/api',
    legacyRouteSupport({
      version: 'v1',
      excludePaths: ['/api/health', '/api/auth', '/api/docs', '/.well-known', '/api/versions'],
      redirect: false,
    }),
  );
  app.get('/api/versions', apiVersionInfo());

  // ─── Tenant Resolution & API Tracking ─────────────────────────────
  app.use('/api', resolveTenant as any);
  const { trackApiCall } = await import('./middleware/subscription');
  app.use('/api', trackApiCall);
  app.use('/api', blockRegistrations);

  // ─── Session Management ───────────────────────────────────────────
  if (app.get('env') === 'production' && !process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable must be set in production');
  }
  let sessionSecret: string;
  if (process.env.SESSION_SECRET) {
    sessionSecret = process.env.SESSION_SECRET;
  } else {
    sessionSecret = require('crypto').randomBytes(32).toString('hex');
    log.warn(
      '[SECURITY WARNING] Using randomly generated session secret for development. Set SESSION_SECRET env var for persistent sessions.',
    );
  }
  const pgStore = connectPg(session);
  const cookieDomain =
    app.get('env') === 'production' && process.env.COOKIE_DOMAIN
      ? process.env.COOKIE_DOMAIN
      : undefined;
  app.use(
    session({
      store: new pgStore({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true,
        tableName: 'sessions',
      }),
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: app.get('env') === 'production',
        httpOnly: true,
        sameSite: app.get('env') === 'production' ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000,
        domain: cookieDomain,
      },
      name: 'sid',
    }),
  );

  // ─── Authentication ───────────────────────────────────────────────
  await setupAuth(app);
  const { authenticateSupabaseJWT } = await import('./middleware/supabase-auth');
  app.use('/api', authenticateSupabaseJWT);

  // Populate req.user for backward compatibility
  app.use('/api', async (req: any, _res, next) => {
    if (req.supabaseUser) {
      req.user = {
        id: req.supabaseUser.id,
        email: req.supabaseUser.email,
        tenantId: req.supabaseUser.tenantId,
        roleId: req.supabaseUser.roleId,
        teamId: req.supabaseUser.teamId,
        accessScope: req.supabaseUser.accessScope,
        isPlatformUser: req.supabaseUser.isPlatformUser,
        firstName: req.supabaseUser.firstName,
        lastName: req.supabaseUser.lastName,
      };
    }
    next();
  });

  // Require authentication (except public paths)
  app.use('/api', async (req: any, res, next) => {
    const publicPaths = [
      '/api/auth',
      '/api/health',
      '/api/csrf-token',
      '/api/trial',
      '/api/knowledge-base',
      '/api/signup-crm',
    ];
    if (publicPaths.some((p) => req.path.startsWith(p))) return next();
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required', code: 'UNAUTHORIZED' });
    }
    next();
  });

  // ─── CSRF Protection (csrf-csrf double-submit pattern) ───────────
  // Skips for: Bearer JWT, API key auth, safe methods, webhooks
  app.use(csrfProtection);

  const csrfTokenLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: { message: 'Too many CSRF token requests, please try again later.' },
    standardHeaders: true,
  });
  app.get('/api/csrf-token', csrfTokenLimiter, csrfTokenHandler);

  // ═════════════════════════════════════════════════════════════════
  // Route Module Registration
  // ═════════════════════════════════════════════════════════════════
  await registerAllRouteModules(app, requireAuth);

  // ═════════════════════════════════════════════════════════════════
  // Infrastructure
  // ═════════════════════════════════════════════════════════════════

  // Database updater manager
  if (process.env.ENABLE_DATABASE_UPDATER === 'true') {
    import('./database-updater')
      .then(({ startDatabaseUpdater }) => {
        startDatabaseUpdater({ enableScheduling: true, logLevel: 'info' }).then(() => {
          log.info('✅ Database Updater system started');
        });
      })
      .catch((err) => log.error('Failed to start Database Updater system:', err));
  } else {
    log.info(
      'ℹ️ Database Updater auto-start disabled (set ENABLE_DATABASE_UPDATER=true to enable)',
    );
  }

  // Auto-seeding (disabled by default)
  if (process.env.ENABLE_AUTO_SEED === 'true' && process.env.NODE_ENV === 'development') {
    log.info('ℹ️ Auto-seeding enabled - this may cause connection issues');
    import('./catalog-seed')
      .then(({ seedMasterCatalog }) => {
        setTimeout(() => {
          seedMasterCatalog().then((success) => {
            if (success) log.info('Master catalog seeded successfully');
          });
        }, 2000);
      })
      .catch((err) => log.error('Failed to load catalog seeding:', err));
  }

  // ─── HTTP Server & WebSocket ──────────────────────────────────────
  const httpServer = createServer(app);

  const enableWebSocket =
    process.env.ENABLE_WEBSOCKET === 'true' || process.env.NODE_ENV === 'production';
  if (enableWebSocket) {
    import('./websocket-service')
      .then(({ webSocketService }) => {
        webSocketService.initialize(httpServer);
        log.info('✅ WebSocket service initialized');
      })
      .catch((err) => log.error('Failed to initialize WebSocket service:', err));
  } else {
    log.info('ℹ️ WebSocket service disabled in dev (set ENABLE_WEBSOCKET=true to enable)');
  }

  // Subscription scheduled jobs
  import('./services/subscription-jobs')
    .then(({ SubscriptionJobs }) => {
      SubscriptionJobs.startAll();
      log.info('✅ Subscription scheduled jobs started');
    })
    .catch((err) => log.error('Failed to start subscription jobs:', err));

  return httpServer;
}
