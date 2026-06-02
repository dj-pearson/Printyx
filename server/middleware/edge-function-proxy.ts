/**
 * Edge Function Proxy Middleware
 *
 * Forwards API requests from Express to Supabase Edge Functions so all
 * clients (mobile, web, integrations) hitting the Express backend get
 * canonical responses from the up-to-date edge functions instead of
 * legacy Express handlers that may query obsolete tables.
 *
 * Body handling:
 *   - JSON / urlencoded: re-serialize req.body (express.json/urlencoded
 *     already parsed it, so the original stream is gone).
 *   - multipart/form-data: read the raw stream into a buffer and forward.
 *     Express body-parser doesn't touch multipart, so req is still readable.
 *   - GET / DELETE / no body: no body sent.
 *
 * Response handling:
 *   - Text-like (JSON, text/*, xml, html, csv): response.text() → res.send.
 *   - Binary (PDF, ZIP, image, octet-stream): response.arrayBuffer() →
 *     res.end(Buffer). Required for invoice PDFs, installer ZIPs, etc.
 *
 * On a network error, the proxy calls next() so a fallback Express handler
 * (if mounted later) can pick up the request. Note this does NOT trigger on
 * a 404/500 from the edge function — those are returned to the client as-is.
 */

import type { Request, Response as ExpressResponse, NextFunction } from 'express';
import { createModuleLogger } from '../lib/logger';

const log = createModuleLogger('edge-function-proxy');

const EDGE_FUNCTIONS_URL = (
  process.env.SUPABASE_FUNCTIONS_URL ||
  process.env.VITE_FUNCTIONS_URL ||
  'https://functions.printyx.net'
).replace(/\/$/, '');

const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH']);

/**
 * Segment names (e.g. 'monitoring-clients') that Express forwards to an edge
 * function in dev. Populated during registerEdgeFunctionProxy. The dev
 * divergence detector reads this to know which "both-divergent" domains have
 * already been folded in (so it stops warning about them).
 */
export const PROXIED_PREFIXES = new Set<string>();

/**
 * True if the response Content-Type is safe to read as text.
 * Anything else (PDFs, ZIPs, images, octet-stream) is treated as binary.
 */
export function isTextContentType(contentType: string | null | undefined): boolean {
  if (!contentType) return true; // no content-type → assume text/plain
  const ct = contentType.toLowerCase();
  return (
    ct.includes('json') ||
    ct.startsWith('text/') ||
    ct.includes('xml') ||
    ct.includes('javascript') ||
    ct.includes('html') ||
    ct.includes('csv') ||
    ct.includes('urlencoded')
  );
}

/**
 * Build outgoing request headers. Caller decides whether to forward the
 * incoming Content-Type (for multipart pass-through) or set
 * application/json (for JSON re-serialization).
 */
function buildProxyHeaders(req: Request, mode: 'json' | 'passthrough' | 'none'): Headers {
  const headers = new Headers();

  if (mode === 'json') {
    headers.set('Content-Type', 'application/json');
  } else if (mode === 'passthrough') {
    const incoming = req.headers['content-type'];
    if (incoming) headers.set('Content-Type', incoming as string);
  }

  if (req.headers.authorization) {
    headers.set('Authorization', req.headers.authorization as string);
  }

  const tenantId =
    (req.headers['x-tenant-id'] as string | undefined) ||
    (req as any).user?.tenantId ||
    (req as any).supabaseUser?.tenantId;
  if (tenantId) {
    headers.set('x-tenant-id', tenantId);
  }

  if (SUPABASE_ANON_KEY) {
    headers.set('apikey', SUPABASE_ANON_KEY);
  }

  return headers;
}

/**
 * Read the entire request body into a Buffer. Used for multipart forwarding
 * where the original boundary must be preserved byte-for-byte.
 */
async function readRawBody(req: Request): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks);
}

/**
 * Forward an Express request to an edge function URL and pipe the response
 * back. Handles JSON, multipart, and binary responses correctly.
 */
async function forwardToEdgeFunction(
  req: Request,
  res: ExpressResponse,
  next: NextFunction,
  edgeUrl: string,
): Promise<void> {
  const reqContentType = (req.headers['content-type'] || '').toLowerCase();
  const isMultipart = reqContentType.includes('multipart/');
  const isWriteMethod = WRITE_METHODS.has(req.method);

  let headers: Headers;
  let body: BodyInit | undefined;

  try {
    if (!isWriteMethod) {
      headers = buildProxyHeaders(req, 'none');
      body = undefined;
    } else if (isMultipart) {
      // Stream raw body — body-parser doesn't touch multipart, so req is
      // still readable. Preserve the original Content-Type (with boundary).
      const raw = await readRawBody(req);
      headers = buildProxyHeaders(req, 'passthrough');
      body = raw;
    } else if (req.body !== undefined && req.body !== null) {
      // express.json() or express.urlencoded() already consumed the stream
      // and parsed the body; re-serialize as JSON for the edge function.
      headers = buildProxyHeaders(req, 'json');
      body = JSON.stringify(req.body);
    } else {
      headers = buildProxyHeaders(req, 'none');
      body = undefined;
    }
  } catch (err) {
    log.error(`[Proxy] Failed to read request body for ${edgeUrl}: ${String(err)}`);
    return next();
  }

  log.info(`[Proxy] ${req.method} ${req.originalUrl} → ${edgeUrl}`);

  let response: globalThis.Response;
  try {
    response = await fetch(edgeUrl, {
      method: req.method,
      headers,
      body,
    });
  } catch (error) {
    log.error(`[Proxy] Network error forwarding to ${edgeUrl}: ${String(error)}`);
    return next();
  }

  res.status(response.status);

  // Forward content-related response headers. We avoid blanket-copying every
  // header (e.g. content-encoding, transfer-encoding, content-length all
  // become inaccurate after Express re-encodes the body).
  const respContentType = response.headers.get('content-type');
  if (respContentType) res.setHeader('Content-Type', respContentType);

  const respDisposition = response.headers.get('content-disposition');
  if (respDisposition) res.setHeader('Content-Disposition', respDisposition);

  const cacheControl = response.headers.get('cache-control');
  if (cacheControl) res.setHeader('Cache-Control', cacheControl);

  try {
    if (isTextContentType(respContentType)) {
      const data = await response.text();
      res.send(data);
    } else {
      const buf = await response.arrayBuffer();
      res.end(Buffer.from(buf));
    }
  } catch (error) {
    log.error(`[Proxy] Failed to read response body from ${edgeUrl}: ${String(error)}`);
    if (!res.headersSent) res.status(502);
    res.end();
  }
}

/**
 * Per-prefix proxy target. The simple form is just an edge function name
 * (e.g. 'companies'); the object form supports re-routing to a sub-path of
 * a multi-handler edge function (e.g. /api/kpis/* → reports edge function
 * with /kpis/* path).
 */
type ProxyTarget = string | { fn: string; pathPrefix: string };

/**
 * Create an Express middleware that proxies requests to a specific edge function.
 *
 * When mounted at /api/companies, req.path becomes relative (e.g. "/" or "/123").
 * This factory captures the edge function name so the middleware knows where to forward.
 */
function createProxyHandler(target: ProxyTarget) {
  const fn = typeof target === 'string' ? target : target.fn;
  const pathPrefix = typeof target === 'string' ? '' : target.pathPrefix;

  return (req: Request, res: ExpressResponse, next: NextFunction) => {
    // req.path is relative to mount point: "/" for list, "/123" for single, "/stats" for stats
    // req.url includes query string: "/?search=test&limit=50"
    const subPath = req.path === '/' ? '' : req.path;
    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    const edgeUrl = `${EDGE_FUNCTIONS_URL}/${fn}${pathPrefix}${subPath}${queryString}`;

    void forwardToEdgeFunction(req, res, next, edgeUrl);
  };
}

/**
 * Register the edge function proxy for all CRM routes.
 * Must be called BEFORE existing CRM route registrations so the proxy
 * intercepts requests before the legacy Express handlers.
 */
export function registerEdgeFunctionProxy(app: any) {
  log.info('Registering edge function proxy → ' + EDGE_FUNCTIONS_URL);

  // /api/<prefix> → forward to matching edge function.
  //
  // IMPORTANT — this map only affects DEV. In production the frontend calls
  // functions.printyx.net/<route> DIRECTLY (client/src/lib/config.ts getApiUrl
  // strips /api/ and targets the functions host), so prod never touches
  // Express for /api/* except the agent ingest path (/api/client-metrics/*)
  // and /install/*. Adding an entry here makes DEV forward that prefix to the
  // same edge function prod already uses — i.e. it makes dev match prod. It
  // CANNOT affect prod. (See EDGE-013 + docs/route-parity-matrix.md.)
  //
  // Adding an entry makes Express stop serving that prefix in dev; the request
  // is forwarded to the edge function (and on a network error, falls through
  // to next() so any remaining Express handler can pick up).
  //
  // Still: only add a domain AFTER verifying the edge function dispatcher
  // covers every URL path the frontend (`client/src`) calls — otherwise dev
  // requests get a 404 from the edge function (fall-through only triggers on
  // network failure, not on 404s). The win is that a parity gap now fails
  // loudly in dev instead of silently in prod.
  //
  // Tracked exceptions (edge function exists but NOT safe to proxy yet):
  //   - billing, catalog, customer-portal, etc. (35 RISKY domains tracked
  //     in EDGE-002a-EDGE-002k follow-ups in prd.json)
  //   - client-metrics (DEPRECATED edge function — frontend uses Express
  //     `routes-client-monitoring.ts` for the live device-monitoring path)
  //
  // Multipart uploads (CSV imports) and binary downloads (PDFs, ZIPs) are
  // now handled correctly by `forwardToEdgeFunction` (EDGE-002l).
  const crmProxies: Record<string, ProxyTarget> = {
    // Core CRM (EDGE-001 baseline)
    '/api/business-records': 'business-records',
    '/api/companies': 'companies',
    '/api/deals': 'deals',
    '/api/contacts': 'contacts',
    '/api/opportunities': 'opportunities',
    '/api/quotes': 'quotes',
    '/api/proposals': 'proposals',
    '/api/reports': 'reports',

    // EDGE-002 Tier 1 SAFE batch (audit-verified 2026-05-04)
    '/api/api-keys': 'api-keys',
    '/api/company-contacts': 'company-contacts',
    '/api/cross-module': 'cross-module',
    '/api/feature-flags': 'feature-flags',
    '/api/knowledge-base': 'knowledge-base',
    '/api/notifications': 'notifications',
    '/api/roles': 'roles',
    '/api/tasks': 'tasks',
    '/api/territories': 'territories',
    '/api/users': 'users',
    '/api/vendors': 'vendors',
    '/api/webhooks': 'webhooks',

    // EDGE-003: KPIs and reporting catalog/exports/dashboard live inside the
    // reports edge function (handlers/kpis.ts, handlers/reporting.ts).
    '/api/kpis': { fn: 'reports', pathPrefix: '/kpis' },
    '/api/reporting': { fn: 'reports', pathPrefix: '/reporting' },

    // EDGE-002k: small bundled fixes — activities (+/:id/complete),
    // customer-numbers (rewrote to match real schema), customer-success
    // (added usage-analytics/satisfaction/calculate-health stubs), company-ids
    // (added missing-ids/backfill/preview-slug/generate/:id with proper named-
    // route precedence).
    '/api/activities': 'activities',
    '/api/customer-numbers': 'customer-numbers',
    '/api/customer-success': 'customer-success',
    '/api/company-ids': 'company-ids',

    // EDGE-005: defensive proxy for the search endpoint. Frontend's
    // command-palette was the only stale /api/universal-search caller;
    // it was rewritten to /api/search to match the canonical edge function.
    '/api/search': 'search',

    // EDGE-005d top: sales-rep-assignments (17 frontend callsites; biggest
    // production 404 in the audit). New edge function ports 9 endpoints from
    // server/routes-sales-rep-assignments.ts.
    '/api/sales-rep-assignments': 'sales-rep-assignments',

    // EDGE-005d: saved-views (8 frontend callsites). CRM saved-view CRUD +
    // pinning. New edge function ports server/routes-saved-views.ts.
    '/api/saved-views': 'saved-views',

    // EDGE-005d: scheduled-reports (11 frontend callsites). Ported as a new
    // handler under reports/handlers/scheduled.ts; pathPrefix routes
    // /api/scheduled-reports/* → /reports/scheduled/*.
    '/api/scheduled-reports': { fn: 'reports', pathPrefix: '/scheduled' },

    // EDGE-005d-remainder: security (7 frontend callsites). Platform-admin
    // gated. New edge function ports server/routes-security-dashboard.ts
    // with corrected schema (audit_logs.timestamp not .created_at, etc.).
    '/api/security': 'security',

    // EDGE-005d-remainder: service-products (6 frontend callsites). Distinct
    // table from products/software-products with service-specific pricing
    // tiers; standalone edge fn rather than a merge.
    '/api/service-products': 'service-products',

    // EDGE-005d-remainder: predictive-maintenance (6 frontend callsites).
    // Dashboard + parts-forecast aggregations are portable; AI analysis paths
    // return degraded responses (require Claude integration port).
    '/api/predictive-maintenance': 'predictive-maintenance',

    // EDGE-013: monitoring-clients. Verified parity — the edge function
    // (supabase/functions/monitoring-clients/) handles every path the
    // Monitoring Clients UI calls: list/detail/create/PATCH/delete,
    // regenerate-key, enrollment-token, installer.zip, commands. Folding it in
    // makes dev match prod (prod already hits this edge fn directly) and fixes
    // real dev bugs: Express returned a bare array for the list (UI expects
    // {clients}) and lacked /regenerate-key + PATCH. NOTE: this only forwards
    // the /api/monitoring-clients prefix — the agent ingest path
    // /api/client-metrics/* stays on Express (routes-client-monitoring.ts).
    '/api/monitoring-clients': 'monitoring-clients',
  };

  for (const [prefix, functionName] of Object.entries(crmProxies)) {
    PROXIED_PREFIXES.add(prefix.replace(/^\/api\//, ''));
    app.use(prefix, createProxyHandler(functionName));
  }
  // Special-cased forwards below that aren't in crmProxies but are still
  // edge-served in dev (keep PROXIED_PREFIXES in sync for the divergence check).
  PROXIED_PREFIXES.add('customers');

  // Special case: GET /api/customers → companies edge function with recordType=Customer
  // The old mobile app calls /api/customers but there's no "customers" edge function.
  // Route it to the companies edge function with an added recordType filter.
  app.get('/api/customers', (req: Request, res: ExpressResponse, next: NextFunction) => {
    const search = (req.query as any)?.search || '';
    const limit = (req.query as any)?.limit || '50';
    const offset = (req.query as any)?.offset || '0';
    const qs = `?recordType=Customer&search=${encodeURIComponent(search)}&limit=${limit}&offset=${offset}`;
    const edgeUrl = `${EDGE_FUNCTIONS_URL}/companies${qs}`;

    void forwardToEdgeFunction(req, res, next, edgeUrl);
  });

  log.info('✅ Edge function proxy registered for CRM routes');
}

// Export internals for testing
export const __test = {
  isTextContentType,
  buildProxyHeaders,
  readRawBody,
  forwardToEdgeFunction,
};
