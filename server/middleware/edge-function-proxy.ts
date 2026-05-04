/**
 * Edge Function Proxy Middleware
 *
 * Forwards CRM API requests from Express to Supabase Edge Functions.
 * This ensures that ALL clients (mobile, web, integrations) hitting the
 * Express backend get data from the correct, up-to-date edge functions
 * instead of deprecated Express route handlers that query obsolete tables.
 *
 * The proxy preserves Authentication, tenant ID, and query parameters.
 */

import { Request, Response, NextFunction } from 'express';
import { createModuleLogger } from '../lib/logger';

const log = createModuleLogger('edge-function-proxy');

const EDGE_FUNCTIONS_URL = (
  process.env.SUPABASE_FUNCTIONS_URL ||
  process.env.VITE_FUNCTIONS_URL ||
  'https://functions.printyx.net'
).replace(/\/$/, '');

const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

/**
 * Build request headers for forwarding to edge functions.
 */
function buildProxyHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (req.headers.authorization) {
    headers['Authorization'] = req.headers.authorization;
  }

  // Forward tenant ID from any available source
  const tenantId =
    (req.headers['x-tenant-id'] as string) ||
    (req as any).user?.tenantId ||
    (req as any).supabaseUser?.tenantId;
  if (tenantId) {
    headers['x-tenant-id'] = tenantId;
  }

  // Edge functions require the apikey header (Supabase Kong gateway)
  if (SUPABASE_ANON_KEY) {
    headers['apikey'] = SUPABASE_ANON_KEY;
  }

  return headers;
}

/**
 * Forward an Express request to an edge function URL and pipe the response back.
 */
function forwardToEdgeFunction(req: Request, res: Response, next: NextFunction, edgeUrl: string) {
  const headers = buildProxyHeaders(req);
  const hasBody = ['POST', 'PUT', 'PATCH'].includes(req.method);
  const bodyStr = hasBody && req.body ? JSON.stringify(req.body) : undefined;

  log.info(`[Proxy] ${req.method} ${req.originalUrl} → ${edgeUrl}`);

  fetch(edgeUrl, {
    method: req.method,
    headers,
    body: bodyStr,
  })
    .then(async (response) => {
      const data = await response.text();
      res.status(response.status);

      const contentType = response.headers.get('content-type');
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }

      res.send(data);
    })
    .catch((error) => {
      log.error(`[Proxy] Error forwarding to ${edgeUrl}:`, error);
      // On proxy failure, fall through to the original Express handler
      next();
    });
}

/**
 * Create an Express middleware that proxies requests to a specific edge function.
 *
 * When mounted at /api/companies, req.path becomes relative (e.g. "/" or "/123").
 * This factory captures the edge function name so the middleware knows where to forward.
 *
 * @param functionName - The edge function name (e.g. "companies", "deals")
 */
function createProxyHandler(functionName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // req.path is relative to mount point: "/" for list, "/123" for single, "/stats" for stats
    // req.url includes query string: "/?search=test&limit=50"
    const subPath = req.path === '/' ? '' : req.path;
    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    const edgeUrl = `${EDGE_FUNCTIONS_URL}/${functionName}${subPath}${queryString}`;

    forwardToEdgeFunction(req, res, next, edgeUrl);
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
  // Adding an entry here makes Express stop serving that prefix; every
  // request is forwarded to the edge function (and on a network error,
  // falls through to next() so any remaining Express handler can pick up).
  //
  // Only add a domain here AFTER verifying the edge function dispatcher
  // covers every URL path the frontend (`client/src`) calls. Otherwise
  // requests get a 404 from the edge function (proxy fall-through only
  // triggers on network failure, not on 404 responses).
  //
  // Tracked exceptions (edge function exists but NOT safe to proxy yet):
  //   - billing, catalog, customer-portal, etc. (35 RISKY domains tracked
  //     in EDGE-002a-EDGE-002k follow-ups in prd.json)
  //   - client-metrics (DEPRECATED edge function — frontend uses Express
  //     `routes-client-monitoring.ts` for the live device-monitoring path)
  //   - any /import endpoint (multipart bodies — proxy stringifies as JSON)
  //   - any /pdf or installer.zip endpoint (binary — proxy uses .text())
  const crmProxies: Record<string, string> = {
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
  };

  for (const [prefix, functionName] of Object.entries(crmProxies)) {
    app.use(prefix, createProxyHandler(functionName));
  }

  // Special case: GET /api/customers → companies edge function with recordType=Customer
  // The old mobile app calls /api/customers but there's no "customers" edge function.
  // Route it to the companies edge function with an added recordType filter.
  app.get('/api/customers', (req: Request, res: Response, next: NextFunction) => {
    const search = (req.query as any)?.search || '';
    const limit = (req.query as any)?.limit || '50';
    const offset = (req.query as any)?.offset || '0';
    const qs = `?recordType=Customer&search=${encodeURIComponent(search)}&limit=${limit}&offset=${offset}`;
    const edgeUrl = `${EDGE_FUNCTIONS_URL}/companies${qs}`;

    forwardToEdgeFunction(req, res, next, edgeUrl);
  });

  log.info('✅ Edge function proxy registered for CRM routes');
}
