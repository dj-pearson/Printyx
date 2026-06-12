/**
 * CSRF Protection Middleware
 *
 * Uses csrf-csrf (double-submit cookie pattern) to protect mutation endpoints.
 * Skips CSRF validation for:
 *  - GET/HEAD/OPTIONS requests (safe methods)
 *  - Requests with Bearer JWT token (no cookie-based session → no CSRF risk)
 *  - Requests with API key header (server-to-server)
 *  - Explicitly exempted paths (webhooks, auth endpoints)
 */

import { doubleCsrf } from 'csrf-csrf';
import { Request, Response, NextFunction } from 'express';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('csrf-protection');

const CSRF_SECRET =
  process.env.CSRF_SECRET ||
  process.env.SESSION_SECRET ||
  'printyx-csrf-secret-change-in-production';

const { generateToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => CSRF_SECRET,
  cookieName: '__csrf',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  },
  getTokenFromRequest: (req: Request) => {
    // Check X-CSRF-Token header first, then x-csrf-token (lowercase)
    return (req.headers['x-csrf-token'] as string) || (req.headers['x-xsrf-token'] as string) || '';
  },
});

// Paths exempt from CSRF validation (webhooks, external callbacks)
const EXEMPT_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/signup',
  '/api/quickbooks/webhook',
  '/api/salesforce/webhook',
  '/api/integrations/webhook',
  '/api/stripe/webhook',
  // Error-boundary reports must always deliver, even when the client is too
  // broken to fetch a CSRF token first (validated, log-only, rate-limited)
  '/api/client-errors',
];

/**
 * Determine if a request should skip CSRF validation
 */
function shouldSkipCsrf(req: Request): boolean {
  // Safe methods don't need CSRF protection
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;

  // Non-API paths don't need CSRF
  if (!req.path.startsWith('/api')) return true;

  // Bearer JWT auth doesn't use cookies → no CSRF risk
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) return true;

  // API key auth is server-to-server → no CSRF risk
  if (req.headers['x-api-key']) return true;

  // Exempt paths (webhooks, external callbacks)
  if (EXEMPT_PATHS.some((p) => req.path.startsWith(p))) return true;

  return false;
}

/**
 * CSRF middleware that wraps csrf-csrf with smart skipping
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  if (shouldSkipCsrf(req)) {
    return next();
  }

  doubleCsrfProtection(req, res, (err: any) => {
    if (err) {
      log.warn({ path: req.path, method: req.method, ip: req.ip }, 'CSRF validation failed');
      return res.status(403).json({
        message: 'CSRF validation failed',
        code: 'CSRF_ERROR',
      });
    }
    next();
  });
}

/**
 * CSRF token endpoint handler
 * GET /api/csrf-token
 */
export function csrfTokenHandler(req: Request, res: Response) {
  try {
    const token = generateToken(req, res);
    res.json({ csrfToken: token });
  } catch (error) {
    log.error('Error generating CSRF token:', error);
    res.json({ csrfToken: null });
  }
}

export { generateToken };
