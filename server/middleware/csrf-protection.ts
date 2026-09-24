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

/**
 * Round 230. This was written against csrf-csrf v3 and the package is v4,
 * which broke it three ways, each proven by mounting it on Express:
 *  - v4 renamed generateToken to generateCsrfToken, so the token endpoint
 *    threw "generateToken is not a function", caught it, and answered 200
 *    with { csrfToken: null } - a success-shaped response carrying no token;
 *  - v4 REQUIRES getSessionIdentifier, which was absent, and renamed the
 *    token retriever to getCsrfTokenFromRequest, so the custom one was
 *    ignored;
 *  - csrf-csrf reads req.cookies and nothing in this app populates it (no
 *    cookie-parser), so validating any cookie-authenticated mutation threw
 *    "Cannot read properties of undefined" and answered 500.
 * Bearer-authenticated requests - the web client's - skip CSRF entirely, which
 * is why nobody saw it.
 */
const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => CSRF_SECRET,
  // Binds a token to the session that fetched it. express-session gives every
  // request a sessionID; an empty string would make any token valid for any
  // session, so a request without one is refused by the token handler below.
  getSessionIdentifier: (req: Request) => (req as Request & { sessionID?: string }).sessionID ?? '',
  cookieName: '__csrf',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  },
  getCsrfTokenFromRequest: (req: Request) =>
    (req.headers['x-csrf-token'] as string) || (req.headers['x-xsrf-token'] as string) || '',
});

/** Parse the Cookie header into req.cookies when nothing else has. */
export function ensureCookies(req: Request): Record<string, string> {
  const r = req as Request & { cookies?: Record<string, string> };
  if (r.cookies) return r.cookies;
  const out: Record<string, string> = {};
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const name = part.slice(0, eq).trim();
    const raw = part.slice(eq + 1).trim();
    try {
      out[name] = decodeURIComponent(raw);
    } catch {
      out[name] = raw;
    }
  }
  r.cookies = out;
  return out;
}

// Paths exempt from CSRF validation (webhooks, external callbacks)
const EXEMPT_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/signup',
  '/api/quickbooks/webhook',
  '/api/salesforce/webhook',
  '/api/integrations/webhook',
  '/api/stripe/webhook',
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

  ensureCookies(req);
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
  if (!(req as Request & { sessionID?: string }).sessionID) {
    return res.status(503).json({
      message: 'CSRF tokens need a session and none is available',
      code: 'CSRF_NO_SESSION',
    });
  }
  try {
    ensureCookies(req);
    const token = generateCsrfToken(req, res);
    res.json({ csrfToken: token });
  } catch (error) {
    // A 200 with a null token read as success; say it failed.
    log.error('Error generating CSRF token:', error);
    res.status(500).json({ message: 'Could not generate a CSRF token', code: 'CSRF_ERROR' });
  }
}

export { generateCsrfToken };
