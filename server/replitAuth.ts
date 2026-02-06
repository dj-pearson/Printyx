/**
 * Authentication Module
 *
 * This module handles authentication for the Printyx platform.
 * Primary auth method: Supabase JWT (GoTrue)
 * Fallback: Session-based authentication (for backward compatibility)
 *
 * Migration Note: This file was previously named "replitAuth" when Replit was
 * used for hosting. The name is kept for backward compatibility with imports.
 */

import passport from 'passport';
import session from 'express-session';
import type { Express, RequestHandler } from 'express';
import { storage } from './storage';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('replitAuth');

import {
  authenticateSupabaseJWT,
  isSupabaseAuthenticated,
  type SupabaseUser,
} from './middleware/supabase-auth';

/**
 * Get session middleware configuration
 * Used for backward compatibility with session-based auth
 */
export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week

  return session({
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
    },
  });
}

/**
 * Setup authentication middleware
 * Initializes session and passport for the Express app
 */
export async function setupAuth(app: Express) {
  app.set('trust proxy', 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Basic passport serialization
  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  log.info('[Auth] Authentication middleware initialized (Supabase JWT + session fallback)');
}

/**
 * Authentication middleware
 *
 * Checks for authentication in priority order:
 * 1. Supabase JWT (Authorization: Bearer <token>)
 * 2. Test mode (development only)
 * 3. Session-based auth (backward compatibility)
 */
export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // Priority 1: Check for Supabase JWT authentication
  await new Promise<void>((resolve) => {
    authenticateSupabaseJWT(req, res, () => resolve());
  });

  // If Supabase JWT is valid, use that for authentication
  if (isSupabaseAuthenticated(req)) {
    const supabaseUser = (req as any).supabaseUser as SupabaseUser;

    // If tenantId is not in JWT, try to look it up from database
    let tenantId = supabaseUser.tenantId;
    let roleId = supabaseUser.roleId;

    if (!tenantId || !roleId) {
      try {
        const dbUser = await storage.getUser(supabaseUser.id);
        if (dbUser) {
          tenantId = tenantId || dbUser.tenantId;
          roleId = roleId || dbUser.roleId;
        } else {
          // SECURITY: Require explicit DEMO_TENANT_ID - no hardcoded fallback
          const demoTenantId = process.env.DEMO_TENANT_ID;
          if (!demoTenantId) {
            log.error('[Auth] User not in database and DEMO_TENANT_ID not configured');
            return res.status(401).json({ message: 'User not properly configured' });
          }
          tenantId = tenantId || demoTenantId;
        }
      } catch (error) {
        log.error('[Auth] Error looking up user:', error);
        const demoTenantId = process.env.DEMO_TENANT_ID;
        if (!demoTenantId) {
          return res.status(500).json({ message: 'Authentication configuration error' });
        }
        tenantId = tenantId || demoTenantId;
      }
    }

    // Populate req.user for backward compatibility with existing routes
    req.user = {
      claims: { sub: supabaseUser.id },
      id: supabaseUser.id,
      email: supabaseUser.email,
      tenantId: tenantId,
      roleId: roleId,
      accessScope: supabaseUser.accessScope || 'company',
      isPlatformUser: supabaseUser.isPlatformUser,
      expires_at: supabaseUser.exp,
    };

    // Set tenant context
    (req as any).tenantId = tenantId;

    return next();
  }

  // Priority 2: Test mode (development/test environments only)
  // SECURITY: Requires explicit TEST_AUTH_SECRET - no default fallback
  const isTestMode =
    (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') &&
    process.env.TEST_MODE === 'true';

  const testAuthSecret = process.env.TEST_AUTH_SECRET;
  const demoTenantId = process.env.DEMO_TENANT_ID;

  // SECURITY: Both TEST_AUTH_SECRET and DEMO_TENANT_ID must be explicitly set
  if (isTestMode && testAuthSecret && req.headers['x-test-auth'] === testAuthSecret) {
    if (!demoTenantId) {
      log.error('[SECURITY] Test mode requires DEMO_TENANT_ID to be set');
      return res.status(500).json({ message: 'Test mode configuration error' });
    }

    const testUserId = 'test-user-playwright';
    const defaultTenantId = demoTenantId;

    try {
      // Ensure tenant exists
      let tenant = await storage.getTenant(defaultTenantId);
      if (!tenant) {
        tenant = await storage.createTenant({
          name: 'Default Copier Dealer',
          domain: 'default',
        });
      }

      // Ensure test user exists
      let testUser = await storage.getUser(testUserId);
      if (!testUser) {
        await storage.upsertUser({
          id: testUserId,
          email: 'test@playwright.dev',
          firstName: 'Playwright',
          lastName: 'Test User',
          profileImageUrl: null,
          tenantId: tenant.id,
          role: 'admin',
        });
        testUser = await storage.getUser(testUserId);
      }

      // Populate req.user with test user data
      req.user = {
        claims: {
          sub: testUserId,
          email: 'test@playwright.dev',
          first_name: 'Playwright',
          last_name: 'Test User',
        },
        id: testUserId,
        tenantId: tenant.id,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      };

      req.isAuthenticated = () => true;
      return next();
    } catch (error) {
      log.error('Test auth bypass error:', error);
      return res.status(500).json({ message: 'Test authentication setup failed' });
    }
  }

  // Priority 3: Session-based authentication (backward compatibility)
  const sessionUserId = (req.session as any)?.userId;
  const sessionTenantId = (req.session as any)?.tenantId;
  const user = req.user as any;

  if (sessionUserId && sessionTenantId) {
    if (!user) {
      req.user = {
        claims: { sub: sessionUserId },
        tenantId: sessionTenantId,
        id: sessionUserId,
      };
    } else if (!user.tenantId) {
      user.tenantId = sessionTenantId;
    }
    return next();
  }

  // No valid authentication found
  return res.status(401).json({ message: 'Unauthorized' });
};

/**
 * Alias for isAuthenticated middleware
 * This is the STANDARD auth middleware - import and use this instead of defining locally
 *
 * Usage:
 *   import { requireAuth } from './replitAuth';
 *   router.get('/api/resource', requireAuth, handler);
 *
 * For Supabase-only auth (stricter), use:
 *   import { requireSupabaseAuth } from './middleware/supabase-auth';
 *
 * For routes requiring tenant context, use:
 *   import { protectedRoute } from './middleware/supabase-auth';
 */
export const requireAuth = isAuthenticated;
