/**
 * Which `/api` paths are reachable without a session (CR-014, LAUNCH-008).
 *
 * THE LIST WAS WRITTEN WITH THE MOUNT PREFIX AND COMPARED AGAINST A PATH THAT
 * HAS IT STRIPPED, so it matched nothing and no path was public. The gate lives
 * under `app.use('/api', ...)`, and Express rewrites `req.url` inside a mounted
 * handler: a request for `/api/health` arrives with `req.path === '/health'`
 * and `req.baseUrl === '/api'`. Comparing that to the literal `/api/health` is
 * false for every entry, so an unauthenticated caller was 401'd on the health
 * probe, the CSRF token, the inbound webhook receiver and the rest - in dev,
 * which is the only host that runs this gate at all.
 *
 * It is the same mistake CLAUDE.md already records one middleware over:
 * "pathRequiresMfa(req.path) can never match, because app.use(path, mw) strips
 * the mount prefix". There it made a control inert; here it made a gate refuse
 * everything it was written to let through.
 *
 * THE LIST STAYS IN FULL `/api/...` FORM and the CALLER supplies the full path
 * (`req.baseUrl + req.path`), rather than the list being rewritten to the
 * stripped shape. These paths are named as `/api/health` everywhere else in the
 * repo - in the proxy table, in the route registry, in conversation - and a
 * list spelled a second way is a list somebody re-breaks the next time the
 * mount moves.
 *
 * Pure, so the property is tested against real inputs instead of read as text.
 */

/**
 * Prefixes served without authentication.
 *
 * Each is public for a reason of its own, not as a convenience:
 *  - /api/auth          the login and password-reset handlers themselves.
 *  - /api/health        liveness, read by the platform before there is a user.
 *  - /api/csrf-token    fetched to make the first authenticated write possible.
 *  - /api/trial         the unauthenticated trial-request surface.
 *  - /api/knowledge-base public help content.
 *  - /api/signup-crm    the marketing-site lead capture.
 *  - /api/signup        self-service registration: the caller has no account
 *                       yet by definition (LAUNCH-008). The edge function it
 *                       proxies to is rate limited rather than authenticated.
 *  - /api/webhooks      providers sign their deliveries; they carry no JWT, and
 *                       a 401 here silently drops Stripe and Google Calendar
 *                       events (INTEG-WEBHOOK-001).
 */
export const PUBLIC_API_PATHS = [
  '/api/auth',
  '/api/health',
  '/api/csrf-token',
  '/api/trial',
  '/api/knowledge-base',
  '/api/signup-crm',
  '/api/signup',
  '/api/webhooks',
] as const;

/**
 * Whether a FULL api path (`/api/...`, no query string) is public.
 *
 * Matches the path exactly or a proper sub-path at a SEGMENT BOUNDARY, so
 * `/api/authx` and `/api/health-internal` are not public (CR-014) and
 * `/api/signup-crm` is not reached through the `/api/signup` entry. The
 * boundary rule is the whole reason this is not a `startsWith`.
 */
export function isPublicApiPath(fullPath: string): boolean {
  const path = String(fullPath ?? '').split('?')[0];
  return PUBLIC_API_PATHS.some((p) => path === p || path.startsWith(p + '/'));
}

/**
 * The full path a handler mounted at a prefix should test.
 *
 * `req.path` alone is the sub-path and `req.originalUrl` carries the query
 * string; this is the one expression that is neither.
 */
export function fullApiPath(req: { baseUrl?: string; path?: string }): string {
  return `${req.baseUrl ?? ''}${req.path ?? ''}`;
}
