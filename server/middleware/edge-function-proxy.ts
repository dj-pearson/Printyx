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
  //   - catalog, customer-portal, etc. (RISKY domains tracked in
  //     EDGE-002b-EDGE-002k follow-ups in prd.json)
  //   - client-metrics (DEPRECATED edge function — frontend uses Express
  //     `routes-client-monitoring.ts` for the live device-monitoring path)
  //
  // Multipart uploads (CSV imports) and binary downloads (PDFs, ZIPs) are
  // now handled correctly by `forwardToEdgeFunction` (EDGE-002l).
  const crmProxies: Record<string, ProxyTarget> = {
    // Core CRM (EDGE-001 baseline)
    '/api/business-records': 'business-records',
    // WF-V-01. server/routes-mobile-api.ts served the list and /stats in dev and
    // joined equipment + technicians with Drizzle, so the dispatcher queue looked
    // correct locally while production - which reaches this function directly -
    // showed a blank machine and a blank technician on every ticket. AUDIT-013
    // fixed the dev half only.
    //
    // ORDERING MATTERS HERE, not un-proxying: routes-service-analysis.ts owns
    // /api/service-tickets/:id/analysis, which this function does not serve, so
    // that router is registered BEFORE the proxy in routes-registry.ts. The proxy
    // forwards the whole prefix and falls through only on a network error, never
    // a 404, so without that ordering the analysis panel would go from
    // working-in-dev to 404-in-dev.
    '/api/service-tickets': 'service-tickets',
    // WF-L-03. The board's three calls - the bare list, POST and
    // PATCH /:id/status - fell to the edge function's terminal 404, so
    // WarehouseOperations.tsx worked only in dev, where server/routes-warehouse.ts
    // served them. EDGE-002h missed it because that check compares NAMED
    // sub-paths and the bare list has no name. The whole prefix is safe to proxy:
    // the edge function now covers every path the Express router had, and the
    // router's other prefixes (/api/build-processes, /api/delivery-schedules,
    // /api/serial-numbers, /api/equipment) are untouched by this entry.
    '/api/warehouse-operations': 'warehouse-operations',
    // WF-V-04. server/routes-preventive-maintenance.ts answered this prefix from
    // hard-coded fixtures whose own comments said "until schema is updated", AND
    // was never registered - so /api/maintenance/* 404'd in dev and hit the edge
    // function in production. The function reads maintenance_schedules and
    // maintenance_records, which migration 0071 finally declares, and now serves
    // the /analytics and /auto-generate paths the page calls too.
    '/api/maintenance': 'maintenance',
    '/api/companies': 'companies',
    // PA-021. /api/customers used to be special-cased below to the `companies`
    // function for the bare list, with only /:id/:sub forwarded to `customers`.
    // That made dev and prod answer the SAME url from DIFFERENT functions:
    // production has no way to reach `companies` under this prefix, because
    // getApiUrl rewrites /api/customers straight to functions.printyx.net/
    // customers. The two disagreed on shape as well - `companies` returns
    // { data, total, page, limit } and `customers` returns a bare array, which
    // iOS decodes as [BusinessRecord]. Both read the same `companies` table, so
    // the redirect bought nothing and cost a divergence. Dev now runs what
    // production runs, for the list, the single record, POST/PATCH/DELETE and
    // every sub-resource.
    '/api/customers': 'customers',
    // PA-052: /demo-scheduling calls exactly three paths - /api/demos,
    // /api/demos/customers and /api/demos/:id/status - and the demos edge
    // function now serves all three off demo_schedules. Dev was answering the
    // first from a one-row "ABC Corporation" fixture in routes-sample-data.ts
    // and 404ing the other two, so the whole page disagreed with production.
    // Safe as a whole-prefix entry because nothing else in any client tree
    // calls /api/demos.
    '/api/demos': 'demos',
    '/api/deals': 'deals',
    // COP-B10: competitive knockout intelligence. A new prefix with no Express
    // handler at all, so the whole-prefix entry cannot shadow anything.
    '/api/competitors': 'competitors',
    // COP-B13: copier sales playbooks. Same - a new prefix, nothing to shadow.
    '/api/playbooks': 'playbooks',
    // COP-B09: sales territories. The edge function has had full CRUD all
    // along and nothing called it; Express served the same paths, so dev and
    // prod ran different code for a surface with no users. One host now.
    '/api/sales-territories': 'sales-territories',
    // COP-B04: the installed-base opportunity radar. New prefix, no Express handler.
    '/api/opportunity-radar': 'opportunity-radar',
    // COP-B03: suggested tasks. New prefix, no Express handler.
    '/api/suggested-tasks': 'suggested-tasks',
    // CRM-008: record page layouts. The Express router this replaces could
    // never run in production and nothing called it; see the fn header.
    '/api/record-layout-config': 'record-layout-config',
    // COP-B05: the fleet assessment / TCO builder. New prefix, no Express handler.
    '/api/fleet-assessment': 'fleet-assessment',
    '/api/contacts': 'contacts',
    // WF-S-06: the CRM Goals page. Its eleven endpoints now all live in the crm
    // edge function, so dev and prod run the same code and
    // server/routes-crm-goals.ts is gone.
    '/api/crm': 'crm',
    '/api/opportunities': 'opportunities',
    '/api/quotes': 'quotes',
    '/api/proposals': 'proposals',
    '/api/reports': 'reports',

    // WF-C-06. The Express handlers for these three were correct and had no
    // caller; the edge functions production reaches queried a table that does
    // not exist. The edge side now serves the real tables and the Express
    // handlers are gone, so these entries make dev and prod one implementation.
    // NOT /api/implementation-projects - no edge function serves it and a bare
    // prefix entry would take it from working-in-dev to 404-in-dev.
    '/api/sales-handoffs': 'sales-handoffs',
    '/api/handoff-tasks': 'handoff-tasks',
    '/api/handoff-task-templates': 'handoff-task-templates',

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

    // WF-L-07. Nothing else serves /api/field-service, so a plain entry is safe:
    // server/routes/field-service-routes.ts mounts its installations,
    // installation-checklists and service-signatures paths at the /api ROOT, a
    // different prefix - and every one of its handlers reads req.session.user,
    // which nothing assigns, so all seven answer 401 regardless
    // (SEC-SESSION-001). The edge function is the only real path and had no
    // caller in any of the seven client trees until this story.
    '/api/field-service': 'field-service',

    // WF-L-06 scoped /api/equipment-lifecycle per path, because
    // routes-equipment-lifecycle-state-machine.ts still owned the transition
    // paths on Express. Round 158: the edge function serves every one of them
    // now (/:id/transition, /available-transitions, /can-transition/:toStage,
    // /transitions/history, /stages), and the Express router was the reason dev
    // 404'd /transitions/history - it only knew /:id/transitions. The router is
    // deleted and the prefix proxied whole. Its two rollback paths had no
    // caller in any client tree and are not ported.
    '/api/equipment-lifecycle': 'equipment-lifecycle',

    // DASH-METRICS-001. /api/dashboard is SCOPED PER PATH, not proxied whole,
    // and that is deliberate: server/routes-dashboard-customization.ts mounts at
    // the /api/dashboard ROOT and owns /layout, /preferences and /snapshot(s),
    // which no edge function serves. A bare '/api/dashboard' entry would take
    // that router off Express and give dev a 404 where it has working handlers -
    // the exact failure the header above warns about. Same reasoning as the
    // per-path /api/sales-pipeline entries.
    //
    // Order is load-bearing twice over. Express matches app.use prefixes in
    // registration order, so /api/dashboard/widgets and /api/dashboard/user-layout
    // come first: those two are served by `dashboard-widgets`, which
    // supabase/functions/server.ts already routes them to in production. Nothing
    // served them in DEV - registerDashboardWidgetRoutes was retired when that
    // function landed and no proxy entry replaced it - so a saved dashboard
    // layout 404'd locally while working in prod, the opposite of the usual
    // split. /api/dashboard/widgets also shadows the customization router's own
    // GET /widgets, which production could never reach either way.
    //
    // The rest go to `dashboard`, which now serves layouts, metrics/:type,
    // charts/:type, activity, urgent, my-tasks, team-performance, recent-tickets,
    // top-customers and alerts alongside card-config and modules. The three
    // Express routers that owned those are deleted. One of them could never have
    // worked at all: routes-dashboard-layouts read dashboard_layouts through the
    // shared/reporting-schema declaration, and migration 0002 dropped four of the
    // columns it filtered and inserted on, so Save on /custom-dashboard threw in
    // dev and 404'd in prod.
    '/api/dashboard/widgets': { fn: 'dashboard-widgets', pathPrefix: '/widgets' },
    '/api/dashboard/user-layout': { fn: 'dashboard-widgets', pathPrefix: '/user-layout' },
    // COP-B01: the My Day card layout. Its own table, so it does not join the
    // two handlers already contesting dashboard_layouts.
    '/api/dashboard/my-day-layout': { fn: 'dashboard', pathPrefix: '/my-day-layout' },
    '/api/dashboard/layouts': { fn: 'dashboard', pathPrefix: '/layouts' },
    '/api/dashboard/metrics': { fn: 'dashboard', pathPrefix: '/metrics' },
    '/api/dashboard/charts': { fn: 'dashboard', pathPrefix: '/charts' },
    '/api/dashboard/activity': { fn: 'dashboard', pathPrefix: '/activity' },
    '/api/dashboard/urgent': { fn: 'dashboard', pathPrefix: '/urgent' },
    '/api/dashboard/my-tasks': { fn: 'dashboard', pathPrefix: '/my-tasks' },
    '/api/dashboard/team-performance': { fn: 'dashboard', pathPrefix: '/team-performance' },
    '/api/dashboard/recent-tickets': { fn: 'dashboard', pathPrefix: '/recent-tickets' },
    '/api/dashboard/top-customers': { fn: 'dashboard', pathPrefix: '/top-customers' },
    '/api/dashboard/alerts': { fn: 'dashboard', pathPrefix: '/alerts' },
    '/api/dashboard/card-config': { fn: 'dashboard', pathPrefix: '/card-config' },
    '/api/dashboard/modules': { fn: 'dashboard', pathPrefix: '/modules' },

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

    // COP-I05 later pointed the command palette back at /api/universal-search,
    // which no edge function served — global search 404'd in production. The
    // universal-search function is the prod implementation; this entry makes dev
    // exercise it too. server/routes-universal-search.ts stays as the network-
    // error fallback.
    '/api/universal-search': 'universal-search',

    // PROD-014: white-label had no edge function, so WhiteLabelDashboard could
    // neither load nor save branding in production. Dir name matches the URL
    // segment, so a plain entry is enough — no server.ts override needed.
    '/api/white-label': 'white-label',

    // PROD-013: neither domain had an edge function. /api/accessories is the
    // accessory<->model compatibility join behind the EnhancedProductAccessories
    // dialog (the accessories themselves live in product-accessories);
    // /api/contract-tiered-rates backs the MeterBilling rate table. Dir names
    // match the URL segments, so plain entries are enough.
    '/api/accessories': 'accessories',
    '/api/contract-tiered-rates': 'contract-tiered-rates',

    // PROD-013: /api/documents (formerly server/routes-documents.ts, retired by
    // PROD-008b) had no edge
    // function, so DocumentBuilder could not list, create or export agreements
    // in production. NOTE this forwards the WHOLE prefix, which also covers the
    // /generate, /batch-generate, /generated, /upload, /uploads and /ai-extract
    // paths in routes-document-automation.ts — those have ZERO callers anywhere
    // in client/src (checked), so nothing regresses, but a new caller for one of
    // them needs a handler in the edge function, not just the Express route.
    '/api/documents': 'documents',

    // PROD-011: renewal-autoquote had no edge function, so the whole renewal
    // dashboard 404'd in production. Dir name matches the URL segment.
    '/api/renewal-autoquote': 'renewal-autoquote',

    // AUDIT-027: /api/user/* - the Settings page and the notification dialog.
    // The `user` directory has always existed, so production has always been
    // served by supabase/functions/user/; what was missing is this entry, so
    // DEV ran server/routes-settings.ts instead and the two disagreed about
    // where the data goes. Express wrote phone/jobTitle/department to
    // user_settings and changed passwords by rehashing users.password_hash; the
    // edge function writes those three to users.metadata (they have no column -
    // see _shared/user-profile.ts) and changes passwords through GoTrue,
    // verifying the current one with signInWithPassword first. Same page, same
    // fields, different rows and a different credential store, so testing this
    // surface in dev proved nothing about production.
    '/api/user': 'user',

    // SEC-MFA-001: /api/mfa. Both backends implement MFA in full and neither was
    // reachable - no client tree named the prefix until the Settings card
    // landed. They also disagreed on the control that matters: Express verified
    // a TOTP token before disabling, the edge function did not, so production
    // was the weaker of the two. The edge function requires a code now, and
    // proxying makes dev exercise the same handler.
    '/api/mfa': 'mfa',

    // SEC-SESSION-001: both of these were served in dev by routers that
    // authenticate against req.session.user, which nothing assigns - so every
    // request got a 401 while the edge functions behind the same prefixes
    // worked fine in production. Proxying is the fix rather than repairing the
    // routers, because the edge functions already cover what the frontend
    // calls: the campaigns list (useEmailSequences) and /api/lead-scoring/bant/:id
    // (BANTAssessment).
    //
    // AUDIT-037 moved the campaigns half. The prefix used to be
    // /api/email-campaigns -> supabase/functions/email-campaigns/, a function
    // supabase/functions/email-marketing/'s own header records as absorbed
    // ("they get deleted in PR 2 after 48h soak"). PR 2 never landed and the
    // surviving standalone was the broken copy - it wrote name/from_name/
    // from_email/reply_to/html_content/text_content/scheduled_at, none of which
    // is a column, and its /send and /stats used email_campaign_sends and
    // customer_segment_members, neither of which is a table. It is deleted, and
    // /api/email-marketing reaches the canonical dispatcher instead. Nothing is
    // shadowed by this entry: routes/email-marketing-routes.ts mounts at the
    // /api ROOT and owns /api/email-templates, /api/email-campaigns and five
    // more, not this prefix.
    '/api/email-marketing': 'email-marketing',
    '/api/lead-scoring': 'lead-scoring',

    // AUDIT-021: /api/performance. supabase/functions/performance/ answers
    // /metrics, /alerts and /health from performance_metrics and system_alerts,
    // with an `unbacked` array for what those tables cannot say. Express served
    // dev from routes/performance-routes.ts, which INVENTED all of it - uptime
    // 99 + random*0.99, throughput random*500 + 800, an error rate, disk usage
    // and an active-user count, each changing on every refresh. Proxying makes
    // dev show what production shows.
    '/api/performance': 'performance',

    // AUDIT-029: /api/device-monitoring. Three routed pages call this prefix -
    // DeviceMonitoring, SupplyRunway and SupplyOrders - and nothing served it in
    // production until supabase/functions/device-monitoring/ existed. Both hosts
    // now share the projection and the forecast from
    // _shared/device-monitoring-shape.ts, so proxying makes dev exercise the
    // handler production uses rather than a second implementation of it.
    '/api/device-monitoring': 'device-monitoring',

    // CR-017: /api/commission. Dev used to be served by two Express routers on
    // the same prefix - routes-operations-extended (mounted first, so it won
    // /calculations and /disputes) over five tables that exist in no schema and
    // no migration, and routes-commission (a hardcoded "Sales Rep Standard" plan
    // with 5%/6.5%/8% tiers) for /plans and /analytics. Production has always
    // run supabase/functions/commission/, which reads the real tables and covers
    // every path CommissionManagement.tsx calls. Both routers are deleted and
    // the prefix is proxied, so dev runs the same handler. POST /calculate had
    // no Express handler at all under either router, so it worked only in prod.
    '/api/commission': 'commission',

    // PROD-012: voice-agent had no edge function, so the after-hours intake
    // surface 404'd in production. Dir name matches the URL segment.
    '/api/voice-agent': 'voice-agent',

    // PROD-012: voice-ticket-close had no edge function, so the field-tech voice
    // close flow 404'd in production. Dir name matches the URL segment.
    '/api/voice-ticket-close': 'voice-ticket-close',

    // PROD-012: email-autopilot had no edge function, so the rep draft-review
    // surface 404'd in production. Dir name matches the URL segment.
    '/api/email-autopilot': 'email-autopilot',

    // AUDIT-015: ai-search. REQUIRED, not defensive — without this entry dev 404s.
    //
    // Nothing in Express serves /api/ai-search/*. The legacy router
    // (server/routes/ai-search-knowledge-routes.ts) is mounted at /api with paths
    // like '/search/semantic', so it answers on /api/search/* and /api/knowledge/*
    // — different prefixes entirely, and it has no callers left. It is also MOCK to
    // the core (getMockEmbeddings(), "in production this would query the database"),
    // so it must NOT serve this page; the edge function is the only real
    // implementation.
    //
    // Parity verified against supabase/functions/ai-search/index.ts: the dashboard
    // calls exactly GET /search/suggestions, GET /search/analytics,
    // GET /knowledge/entities, POST /search/semantic and POST /search/feedback, all
    // dispatched there. Dir name == prefix segment, so no server.ts override is
    // needed (the EDGE-004 decision rule); prod strips the fn-name segment and the
    // fn's stripPrefix tolerates its absence.
    '/api/ai-search': 'ai-search',

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

    // SUPA-011: lease-payments is served by the `leases` edge fn (handlers/
    // payments.ts), which keys off pathParts[0]==='lease-payments'. Production
    // already resolves this via a server.ts override (functionName
    // 'lease-payments'→'leases', stripSegments=0, so the segment survives). This
    // dev entry re-adds the /lease-payments prefix (like kpis/reporting/scheduled)
    // so dev matches prod. Verified: leases/index.ts case 'lease-payments' →
    // handlePayments handles /:id/process (the LeaseDetail.tsx:82 call).
    '/api/lease-payments': { fn: 'leases', pathPrefix: '/lease-payments' },

    // SUPA-011 (drift cleanup): ai-employees is served by the `ai-employee` edge
    // fn, which keys off pathParts[0]==='ai-employees'. Production already resolves
    // it via a server.ts override (functionName 'ai-employees'→'ai-employee',
    // stripSegments=0). This dev entry re-adds the prefix so dev matches prod.
    // (Pre-existing upstream drift surfaced by the route-ownership guard; same
    // clean pattern as lease-payments, so resolved here rather than grandfathered.)
    '/api/ai-employees': { fn: 'ai-employee', pathPrefix: '/ai-employees' },

    // SEC-EDGE-001 batch 15: auto-lead-routing. AutoLeadRoutingDashboard.tsx is
    // routed and calls /dashboard, /config and /rules. Express served the first
    // two and had NO /rules handler at all, so listing, creating and deleting a
    // routing rule - three controls on a live page - 404'd in dev while working
    // in production. Its /config PUT was worse than missing: it logged the body
    // and answered success without storing anything, so a user toggling routing
    // settings was told "saved successfully" and lost them on reload.
    //
    // The edge function covers /rules (GET/POST/PUT/DELETE), /dashboard,
    // /config (GET/PUT, stored under tenants.metadata.autoLeadRouting) and
    // POST /route[/:leadId]. Its /dashboard returns the same four keys the page
    // reads - overview, scoreDistribution, repWorkload, recentLeads - checked
    // against the page rather than assumed, because a proxy entry changes what
    // dev answers.
    //
    // NOT carried over, and neither has a caller in any client tree:
    // POST /route-batch and GET /preview/:leadId.
    '/api/auto-lead-routing': 'auto-lead-routing',

    // EDGE-002a: billing — full frontend parity audited 2026-06-11
    // (analytics + 3 sub-routes, invoices list/:id/pay/email/pdf/
    // generate-from-contract, rules + activate/deactivate, configurations,
    // cycles + run, adjustments, payment-methods, info, address,
    // service-entries, generate-invoices, contract-profitability).
    '/api/billing': 'billing',

    // EDGE-002b: customer-portal — full frontend parity audited 2026-06-11
    // (dashboard, equipment [+`equipment` alias key], supply-orders GET/POST,
    // knowledge-base, service-requests list [page/search]/detail/:id/history,
    // maintenance-availability, maintenance-appointments CRUD + reschedule,
    // satisfaction surveys list/detail/start/submit + analytics,
    // usage-analytics, equipment-health). The legacy /auth/* + /notifications
    // paths (CustomerPortal.tsx standalone portal-session login) were already
    // unserved by Express (routes-customer-portal.ts never had them) — equally
    // 404 before and after this proxy entry.
    '/api/customer-portal': 'customer-portal',

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
    // QUALITY-002: /api/predictive-dispatch. The Express router that served
    // this prefix is DELETED - it referenced three tables that exist in no
    // schema or migration (service_calls_enhanced, equipment_metrics,
    // technician_resources_enhanced) as UNDEFINED IDENTIFIERS, 59 TS2304s, so
    // every one of its handlers was a guaranteed ReferenceError. Production
    // already ran supabase/functions/predictive-dispatch/, which reads the real
    // tables (device_metrics, equipment, service_tickets, technicians,
    // service_calls, equipment_failure_predictions) and covers every path
    // PredictiveServiceDispatchDashboard.tsx calls plus five more. This entry
    // points dev at the same function so the page stops throwing there.
    // CR-017: /api/financial. The Express router here queried four tables that
    // exist in no schema or migration - financial_forecasts,
    // cash_flow_projections, profitability_analysis, financial_kpis - through
    // db.$client.query() RAW SQL, so tsc never saw them and all six endpoints
    // 500'd on a missing relation in dev. Production already ran
    // supabase/functions/financial/, which DERIVES the same figures from real
    // tables (contracts, invoices, quotes) rather than storing them.
    //
    // PARTIAL PARITY, stated because this entry changes dev behaviour in two
    // directions: metrics, forecasts and cash-flow go from 500 to WORKING; kpis,
    // profitability and profitability/run go from 500 to 404, which is what
    // production already returns for them. Dev now matches prod on all six
    // instead of failing differently on all six. FinancialForecasting.tsx
    // defaults each list to [] and each figure to 0, so an absent endpoint
    // renders empty rather than fabricated - the same as today.
    '/api/financial': 'financial',
    '/api/predictive-dispatch': 'predictive-dispatch',
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

    // PROD-014: workflow-automation dashboard. Nothing served this prefix on
    // the functions host, so AutopilotDashboard.tsx and WorkflowAutomation.tsx
    // 404'd in production. The two Express handlers that answered in dev
    // (routes-workflow-mobile.ts, routes-sample-data.ts) returned the same
    // invented figures for every tenant, so the new edge fn derives the
    // dashboard from the real CRMX-008 runtime tables instead and this entry
    // makes dev match prod. Only /api/workflow-automation is forwarded - the
    // registered runtime router lives at /api/workflows, /api/executions and
    // /api/workflow-events and is untouched.
    '/api/workflow-automation': 'workflow-automation',

    // PROD-008: journal-entries. Dev ran the Express handlers in
    // routes-financial.ts while prod ran the edge fn, and the two disagreed on
    // the list shape, the create payload and the update verb - so the live page
    // threw on load, every edit 404'd, and every entry was saved with zero
    // totals. The edge fn is now the single implementation and this makes dev
    // match it. Only /api/journal-entries moves; /api/chart-of-accounts stays
    // on Express in the same file.
    '/api/journal-entries': 'journal-entries',

    // PROD-008: chart-of-accounts, the other half of the retired
    // routes-financial.ts. Editing an account was broken on BOTH hosts - Express
    // never had a /:id handler, and the edge fn implemented PUT while the page
    // sends PATCH - so this closes a dead feature rather than only aligning two
    // live ones. With both prefixes proxied, routes-financial.ts has no routes
    // left and is deleted.
    '/api/chart-of-accounts': 'chart-of-accounts',

    // PROD-008: contracts. Dev ran two handlers in routes-workflow-mobile.ts
    // returning a bare array of camelCase rows; prod ran the edge fn returning
    // { data, total, page, limit } of snake_case rows. Two of the four consuming
    // pages called .map on that envelope, so they threw on load in production.
    // The edge fn is the superset (it also serves /:id, tiered-rates, PATCH and
    // DELETE), so the Express pair is retired and this makes dev match prod.
    '/api/contracts': 'contracts',

    // PROD-008: leases. The edge fn was already the canonical implementation -
    // its header says so, and AUDIT-012 added the server.ts aliases that make
    // the three sibling prefixes resolve in prod - but nothing ever proxied dev
    // or retired server/routes/lease-routes.ts, so dev kept running the 28
    // Express endpoints. Leases.tsx did `(response || []).map(...)` against the
    // edge fn's { data, total, page, limit }, which is a TypeError, so the page
    // threw on load in production.
    //
    // The three siblings need the object form: the mount strips their prefix,
    // but server.ts aliases them with stripSegments = 0 because that segment is
    // the leases dispatcher's discriminator, so pathPrefix has to put it back.
    // ('/api/lease-payments' is NOT repeated here - SUPA-011 already added it
    // above. A duplicate key is silently last-wins at runtime; tsc caught it
    // with TS1117, which is the only reason it did not ship.)
    '/api/leases': 'leases',
    '/api/lease-renewals': { fn: 'leases', pathPrefix: '/lease-renewals' },
    '/api/lease-dispositions': { fn: 'leases', pathPrefix: '/lease-dispositions' },

    // EDGE-005a: accounts-payable / accounts-receivable. The frontend calls the
    // FLAT /api/accounts-{payable,receivable}[/:id] shape (list/create at root,
    // get/update/delete on /:id). The edge handlers were rewritten to serve that
    // shape against the canonical accounts_payable / accounts_receivable tables.
    // Dev forwards to the singular account-* function dirs (prod aliases the
    // plural segment in server.ts), so dev matches prod.
    '/api/accounts-payable': 'account-payable',
    '/api/accounts-receivable': 'account-receivable',

    // EDGE-005e: signatures. The frontend was consolidated off the three flat
    // /api/signature-{requests,templates,analytics} prefixes onto sub-paths of
    // the existing modular signatures edge fn (/api/signatures/{requests,
    // templates,analytics}). The dispatcher accepts both the bare and the
    // legacy signature-prefixed resource names. Proxying here makes dev match
    // prod (functions-direct, where server.ts resolves the `signatures` dir).
    '/api/signatures': 'signatures',

    // EDGE-005f: three alias targets whose frontend prefix differs from the
    // edge function dir name (prod resolves them via server.ts route overrides).
    //  - /api/deployment/{readiness,metrics} → deployment-readiness fn.
    //  - /api/integration-hub/dashboard → integrations fn (/dashboard handler).
    //  - /api/public/calculator/* → public-calculator fn (UNAUTHENTICATED
    //    marketing calculator; pathPrefix re-adds the /calculator segment the
    //    mount strips so the dispatcher sees /calculator/<sub>).
    '/api/deployment': 'deployment-readiness',
    '/api/integration-hub': 'integrations',
    '/api/public/calculator': { fn: 'public-calculator', pathPrefix: '/calculator' },
    // CRMX-011: unauthenticated web-form capture.
    '/api/public/forms': { fn: 'public-forms', pathPrefix: '/forms' },
    // CRMX-016: public Calendly-style booking pages + authenticated admin CRUD.
    '/api/public/booking': { fn: 'public-booking', pathPrefix: '/booking' },
    '/api/booking-pages': 'booking-pages',

    // WF-S-05: Apollo lead enrichment. The whole prefix, because the edge fn
    // now covers every path the frontend calls - search, enrich,
    // leads/:id/add-to-crm, leads/bulk-add, stats, usage and the four
    // credentials endpoints - and server/routes/apollo-routes.ts is gone. Until
    // this entry existed, dev ran Express against the real Apollo API while
    // production ran an edge function whose /search returned an empty list at
    // 200, and whose credential panel 404'd.
    '/api/apollo': 'apollo',

    // WF-S-10: enrichment. The edge function serves every endpoint any client
    // calls - DataEnrichment.tsx asks for contacts, companies, campaigns and
    // analytics and nothing else, across all eight trees - and it carries the
    // import branches that WRITE enriched_contacts.
    // server/routes-data-enrichment.ts is deleted with this entry, so dev stops
    // answering four endpoints production has always 404'd: GET /contacts/:id,
    // POST /contacts, and the two /search/{zoominfo,apollo}/build helpers,
    // which returned a query OBJECT for the caller to send itself and had no
    // caller anywhere.
    '/api/enrichment': 'enrichment',

    // WF-P-06: placing an approved PO with the manufacturer. No Express router
    // ever served this prefix, so proxying it is the whole of dev's story too -
    // there is nothing to shadow.
    '/api/manufacturer-orders': 'manufacturer-orders',

    // AI-001: /api/ai/gpt5/* → ai-gpt5 fn. Only the gpt5 sub-path is proxied;
    // the rest of /api/ai (ai-routes-simple) stays on Express, which is correct
    // because nothing in the frontend calls it. pathPrefix re-adds the /gpt5
    // segment the mount strips, so the handler's normalizePath(..., 'gpt5')
    // sees the same URL it sees in production.
    '/api/ai/gpt5': { fn: 'ai-gpt5', pathPrefix: '/gpt5' },

    // EDGE-005c: phone-in-tickets. The search-companies/search-contacts/
    // equipment sub-routes the PhoneInTicketCreator calls were ported into the
    // phone-in-tickets edge fn (previously Express-only under the legacy
    // /api/phone-tickets prefix, which 404'd in prod). Frontend now calls
    // /api/phone-in-tickets/*; proxying here makes dev match prod (functions-direct).
    '/api/phone-in-tickets': 'phone-in-tickets',

    // EDGE-004: platform-admin CRM endpoints. Only /api/platform-deals had an
    // edge function before; the other four 404'd in prod where the frontend
    // bypasses Express. New edge fns (platform-crm already existed) serve the
    // root-admin platform CRM / activities / analytics / customer-success pages.
    // Dir name == prefix segment, so no server.ts override is needed.
    '/api/platform-crm': 'platform-crm',
    '/api/platform-deals': 'platform-deals',
    '/api/platform-activities': 'platform-activities',
    '/api/platform-analytics': 'platform-analytics',
    '/api/platform-cs': 'platform-cs',

    // CRMX-003 leftover: the custom-fields edge fn and the Express handler in
    // routes-custom-fields.ts both served /api/custom-fields with no proxy
    // entry, which check:routes flags as ambiguous ownership. Prod already
    // bypasses Express and hits the edge fn, so this only makes dev match prod.
    // PROD-008b retired routes-custom-fields.ts entirely; its shared
    // validateCustomFieldValues moved to lib/custom-field-validation.ts, whose
    // last caller (the /api/customers write path in routes-business-records.ts)
    // PA-021 removed - so nothing validates custom-field VALUES on a write now,
    // and nothing did in production before either. See that file's header. Dir
    // name == prefix segment, no override needed.
    '/api/custom-fields': 'custom-fields',

    // New edge fns for three domains that 404'd in PROD — the frontend calls
    // them but only Express served them, and prod bypasses Express entirely.
    // Proxying dev too is the point: without an entry the new functions would
    // run ONLY in prod, which is the "invisible in dev" trap that let these
    // rot in the first place. Dir name == prefix segment, no override needed.
    //
    // PROD-008b retired BOTH Express routers that used to share these prefixes:
    // routes-web-forms.ts and routes-email-sequences.ts. Each edge function had
    // full handler coverage and already returned camelCase rows, so both were
    // clean retirements — the audit:routes false negative these two used to
    // demonstrate (full '/api/...' paths declared inside a Router mounted with a
    // bare `app.use(router)`, which its Express detection misses) no longer has
    // an instance here, but the tool still has the blind spot.
    '/api/web-forms': 'web-forms',
    '/api/email-sequences': 'email-sequences',

    // EDGE-022. pipeline-forecast is proxied because its edge fn has FULL
    // parity — Express serves exactly one endpoint on that prefix.
    // /api/sales-forecasts is deliberately NOT proxied: Express also has a
    // POST (routes-sales-forecasting.ts) that the edge fn does not implement,
    // and a proxy forwards the whole prefix, so an entry would take that write
    // from working-in-dev to 404-in-dev. Same call as /api/ai-employees above.
    '/api/pipeline-forecast': 'pipeline-forecast',

    // EDGE-023. Proxied because the edge fn has FULL parity — all seven Express
    // endpoints (list, export.csv, GET/PUT settings, refresh, digest/preview,
    // :contractId) are implemented.
    '/api/contract-pnl': 'contract-pnl',

    // PROD-010. Proxied because the edge fn implements ALL SEVEN Express
    // endpoints on this prefix (list, generate, GET/POST suppressions, GET/PATCH
    // /:id, /:id/send) — the full-parity bar the entries above are held to.
    //
    // One behavior DOES change in dev, deliberately: generate no longer produces
    // a PDF. Express renders it with Playwright/Chromium, which cannot run in the
    // Deno runtime, so the edge fn stores the HTML artifact and leaves pdf_url
    // null (a path Express already takes whenever Chromium is absent).
    //
    // Proxying anyway is the point: production has NO qbr function today, so the
    // page 404s there entirely. Leaving dev on Express would keep PDFs working on
    // developer machines while prod silently lacked them — precisely the
    // works-in-dev/broken-in-prod split this batch of stories exists to close.
    // Restoring PDFs means rendering outside the edge runtime, for both.
    '/api/qbr': 'qbr',

    // PROD-010. Full parity: /dashboard is the ONLY endpoint Express serves on
    // this prefix (routes-sample-data.ts) and the only one the page calls.
    //
    // /api/business-process was the one domain in this batch that stayed
    // unported, twice, because both of its Express handlers returned hardcoded
    // numbers with ZERO database access and porting them would have published
    // fabricated business metrics to production. That is now RESOLVED BY
    // DELETION rather than left open: PROD-010 removed both handlers, the
    // unregistered 746-line routes-business-process-optimization.ts and the
    // page itself, along with the identical /api/incident-response mock and
    // IncidentResponseSystem.tsx. missingEdge is 0 as a result. Neither page
    // ever rendered the fixtures anyway - both passed filter state in the query
    // key, and a query key IS a url, so both requested /dashboard/all/all and
    // 404'd in dev as well as prod.
    '/api/ai-analytics': 'ai-analytics',

    // PROD-010. Full parity: all SEVEN Express endpoints are implemented
    // (score, scores, scores/:id/history, save-plan, GET/PUT settings,
    // digest/preview), which is also everything CustomerRisk.tsx calls.
    // Digest ASSEMBLY is real; delivery stays a stub, exactly as in Express.
    '/api/churn-risk': 'churn-risk',

    // PROD-010. Full parity: all EIGHT Express endpoints (score, predictions,
    // predictions/:id/{approve,snooze,dismiss}, GET/PUT settings, accuracy).
    // The agent kill switch (predictive_dispatch_settings.agent_enabled) is
    // honored on the edge path too — this endpoint dispatches technicians, so a
    // port that ignored the pause would make that button a no-op in production.
    '/api/predictive-failure': 'predictive-failure',

    // PROD-010. Full parity: all SIX Express endpoints (generate, list,
    // GET/PUT preferences, stats, :id/open), which is also everything
    // DailyBriefings.tsx calls. All six had to ship together — proxying forwards
    // the whole prefix, so a partial port would have taken the rest from
    // working-in-dev to 404-in-dev.
    '/api/daily-briefing': 'daily-briefing',

    // PROD-011. Full parity: all FOUR Express endpoints (classify,
    // classifications/:requestId, rate, timeline/:requestId), which is also
    // everything CustomerPortalService.tsx calls.
    '/api/portal-service': 'portal-service',

    // PROD-011. The edge fn is a superset of the Express prefix: it keeps
    // /:sessionId/workflow-steps (the only endpoint the two sides ever agreed
    // on) and adds the two URLs TechnicianTicketWorkflow.tsx calls that existed
    // nowhere — /:ticketId and /:sessionId/complete-step. Express's
    // /:sessionId/update-step had zero callers and is removed with it, so
    // nothing regresses from working-in-dev.
    '/api/technician-sessions': 'technician-sessions',

    // PROD-011. Full parity: all EIGHT endpoints across the TWO Express routers
    // that shared this prefix — routes-service-knowledge.ts (search, backfill,
    // embed/:ticketId, stats, GET/PUT settings) and routes-proactive-maintenance.ts
    // (list, :equipmentId/schedule) — which covers everything KnowledgeSearch.tsx
    // and ProactiveServiceDashboard.tsx call. Both had to ship together:
    // proxying forwards the whole prefix, so porting one would have taken the
    // other from working-in-dev to 404-in-dev.
    //
    // PROD-008b then retired BOTH: routes-service-knowledge.ts and
    // routes-proactive-maintenance.ts. No Express router serves this prefix now.
    //
    // app.use() matches on path-segment boundaries, so this entry captures
    // /api/service and /api/service/* only — NOT /api/service-tickets, which
    // keeps its own function. normalizePath is anchored the same way.
    '/api/service': 'service',

    // Round 146. Express served this prefix from routes-misc-stubs.ts, a
    // "TODO: Implement actual service analytics" router answering zeros for
    // every count and [] for every list, so on a developer machine the Service
    // Analytics page reported a tenant with no tickets at all while production
    // counted real ones. The edge function covers both paths the page calls
    // (GET / and GET /trends); the stub is deleted, so dev now runs the handler
    // production runs.
    '/api/service-analytics': 'service-analytics',

    // Round 147. The Express router for this prefix gated on req.session.userId,
    // which the product's login never sets, so it answered 401 to everyone, and
    // its tenant fallback was the zero uuid. The edge function is the port of
    // the same engine and serves every path it did (/, /summary, /priorities,
    // /category/:slug, POST /refresh).
    '/api/content-gap-analysis': 'content-gap-analysis',

    // Round 152. Express served this prefix from routes-social-media.ts with no
    // role check on broadcast or the scheduled jobs, and answered camelCase rows
    // while the edge function answered snake_case, so the page rendered on one
    // host and not the other. The edge function covers all ten paths the page
    // calls and now camelises; dev runs it too.
    '/api/social-media': 'social-media',

    // Round 153. Scoped, not the whole prefix: POST /api/chatbot/query stays on
    // Express because the edge function answers it with a deliberate 501. The
    // other six paths ran on an Express copy with no role gate while production
    // requires a manager to change a workspace install or a user mapping.
    '/api/chatbot/connections': { fn: 'chatbot', pathPrefix: '/connections' },
    '/api/chatbot/connect': { fn: 'chatbot', pathPrefix: '/connect' },
    '/api/chatbot/links': { fn: 'chatbot', pathPrefix: '/links' },
    '/api/chatbot/query-log': { fn: 'chatbot', pathPrefix: '/query-log' },

    // Round 154. Express served this from routes-audit-logs.ts: the same
    // { logs, pagination } shape, but with no cap on `limit` and a tenant read
    // from an x-tenant-id header when the user carried none. The edge function
    // is what production runs and covers the one path the viewer calls.
    '/api/audit-logs': 'audit-logs',

    // Round 154. Express served this prefix from routes-software-products.ts:
    // no role check on writes (the edge function requires
    // operations.inventory.manage, SEC-EDGE-001 round 74), and no /import or
    // /dedupe branch although the page calls both, so dev 404'd on them.
    '/api/software-products': 'software-products',

    // Round 156. No Express router serves this prefix, so on a developer
    // machine usePricingVisibility() 404'd - and in production it received a
    // stored row instead of a per-caller answer. The edge function now answers
    // per caller; dev runs it too.
    '/api/pricing-settings': 'pricing-settings',

    // Round 157. Express served /api/dashboards/today from
    // routes-today-dashboard.ts, which answered neither awaitingSignature nor
    // meetingsNeedingFollowUp nor the scope fields COP-B01 round 105 added, so
    // on a developer machine those My Day cards were always empty. The edge
    // function's /today is a strict superset; dev runs it too.
    '/api/dashboards': 'dashboards',

    // Round 159. Express served this from routes-templates.ts over
    // project_templates while production read `templates`, a table that does
    // not exist, so the Templates view worked only in dev. The edge function
    // reads project_templates now and the Express router is deleted.
    '/api/templates': 'templates',

    // Round 160. routes-tasks.ts kept /api/projects off the proxy because
    // /api/projects/:id/create-template lived on Express; round 159 deleted that
    // (no caller). Express also had no PATCH /:id, which HandoffProject uses
    // for milestones, so dev 404'd it. The edge function serves every path.
    '/api/projects': 'projects',

    // PROD-011. Full parity: all EIGHT Express endpoints (inbound, submit,
    // submissions list/:id/approve/reject, GET/PUT settings), which is also
    // everything MeterReadReview.tsx calls. This pipeline writes billing rows,
    // so the port keeps the guard that a fallback extraction can never
    // auto-approve — see the edge fn header.
    '/api/meter-reads': 'meter-reads',

    // PROD-011. Full parity: all ELEVEN Express endpoints (generate,
    // recommendations list/:id/export.csv/pick/receive, inventory, GET/PUT
    // settings, callbacks, stats), which is also everything TruckStocking.tsx
    // calls. The CSV export returns text/csv rather than JSON, so the page now
    // fetches it with auth headers instead of window.open — a plain navigation
    // carries no Bearer token and 401s against the edge function.
    '/api/truck-stock': 'truck-stock',

    // PROD-011, the last domain in the batch. Full parity: all TWELVE Express
    // endpoints (capture, evaluate, run, levels, orders list/:id/ship/:id/cancel,
    // machines/:id/ship-now, GET/PUT tenant settings, GET/PUT machine settings),
    // which is also everything TonerReplenish.tsx calls. This pipeline creates
    // orders without a human in the loop, so the port keeps every suppression —
    // customer-managed, auto-ship-off, open-order dedupe and the cost gate. See
    // the edge fn header.
    '/api/toner-replenish': 'toner-replenish',

    // AUDIT-019. SystemSecurity.tsx now reads GET /api/admin/system-health,
    // which exists ONLY in supabase/functions/admin/ - no Express router serves
    // it, so without this entry the page would work in prod and 404 in dev,
    // the same invisible-in-dev trap the other entries here exist to close.
    //
    // Scoped to the single path, not the /api/admin prefix: routes-registry
    // mounts routes-admin-workflows at /api/admin and app.use() matches on
    // segment boundaries, so proxying the bare prefix would take every workflow
    // endpoint from working-in-dev to 404-in-dev. pathPrefix re-adds the
    // segment the mount strips, so the edge fn sees /system-health and
    // normalizePath resolves parts[0] the same way it does in prod. The proxy
    // registers at line ~297 of routes-registry, ahead of the /api/admin mount,
    // so this wins for this one path and nothing else changes.
    '/api/admin/system-health': { fn: 'admin', pathPrefix: '/system-health' },

    // ROUND 133. TWO SCOPED ENTRIES, not the whole prefix: Express still owns
    // PUT/DELETE /api/onboarding/sections/:id and /tasks/:id, which the edge
    // function does not serve, so a bare '/api/onboarding' entry would take
    // those from working-in-dev to 404-in-dev (they already 404 in production).
    //
    // These two were Express-only, so the routed pages behind them -
    // GettingStarted.tsx and SetupWizard.tsx, the first two screens a new
    // tenant sees - 404'd for every deployed user. The proxy makes dev run what
    // production runs; the Express handlers are deleted rather than shadowed.
    '/api/onboarding/getting-started': { fn: 'onboarding', pathPrefix: '/getting-started' },
    '/api/onboarding/wizard-state': { fn: 'onboarding', pathPrefix: '/wizard-state' },

    // WF-R-08. Same reasoning, four more paths, and they close a DEV-ONLY 404
    // rather than opening one: /admin/user-management is a routed page calling
    // /api/admin/users, and no Express router owns that prefix - routes-registry
    // mounts /api/admin/knowledge-base, /subscriptions and /seed and nothing else
    // (routes-admin-workflows was deleted by QUALITY-002). So the page worked in
    // production and 404'd in dev. Scoped per path for exactly that reason: a bare
    // '/api/admin' entry would swallow the three prefixes Express does own.
    // WF-P-05. /api/purchase-orders was served by Express in dev and by the edge
    // function in production - the both-divergent class - and the two disagreed
    // about who may approve: Express required inventory.po.*, which NO seeded role
    // holds, so dev denied every non-admin; the edge function checked nothing, so
    // production allowed everyone. The Express router is deleted and the prefix is
    // proxied, after porting the /:id/status branch it had and the edge function
    // did not (PurchaseOrders.tsx calls it, so that control 404'd in production).
    '/api/purchase-orders': 'purchase-orders',

    '/api/admin/users': { fn: 'admin', pathPrefix: '/users' },
    '/api/admin/locations': { fn: 'admin', pathPrefix: '/locations' },
    '/api/admin/regions': { fn: 'admin', pathPrefix: '/regions' },
    '/api/admin/teams': { fn: 'admin', pathPrefix: '/teams' },

    // AUDIT-019. MeetingTranscription.tsx now calls this instead of rendering
    // three hardcoded recordings. The meeting-transcription edge fn was fully
    // built (upload, transcription, notes, highlights, search, analytics,
    // consent) and had ZERO callers, so nothing had ever exercised it from
    // either host. Dir name == prefix segment, so a plain entry is enough.
    '/api/meeting-transcription': 'meeting-transcription',

    // PROD-014. /api/erp-integration had no edge function, so ERPIntegration.tsx
    // 404'd in prod. The Express handler it would have been ported from was a
    // 670-line fixture and has been deleted; the new fn reads
    // system_integrations + integration_metrics. Dir name == prefix segment.
    '/api/erp-integration': 'erp-integration',

    // COP-E02. supabase/functions/sales-pipeline/ serves SalesPipelineWorkflow,
    // and routes-registry retired its Express router when it was migrated - but
    // no proxy entry replaced it, so every read the page makes 404'd in dev
    // while working in prod. The usual divergence, inverted.
    //
    // Scoped to the three paths the edge fn owns, NOT the /api/sales-pipeline
    // prefix: routes-sales-forecasting.ts still owns PUT /api/sales-pipeline/:id
    // over forecast_pipeline_items - a different table behind the same prefix -
    // and proxying the whole prefix would take that write from working-in-dev to
    // 404-in-dev. pathPrefix re-adds the segment app.use() strips.
    '/api/sales-pipeline/opportunities': {
      fn: 'sales-pipeline',
      pathPrefix: '/opportunities',
    },
    // PA-022. /api/sales-forecasts had an Express handler AND an edge function
    // with no proxy entry, so SalesPipelineForecasting and SalesCommandCenter
    // listed forecasts from different code depending on the host. The three
    // Express handlers are deleted; the edge function covers both reads, and
    // the POST it does not cover has no caller in any client tree.
    '/api/sales-forecasts': 'sales-forecasts',
    // PA-052. CalendarProvider now calls /api/meetings/calendar/* - the surface
    // supabase/functions/meetings/ already serves over calendar_connections and
    // calendar_events, with the real Google and Microsoft clients. Express owns
    // the REST of /api/meetings (meeting-scheduling-routes and
    // meeting-transcription-routes, both mounted at the /api root), and serves
    // nothing under /calendar, so this is scoped to that sub-path: a whole-prefix
    // entry would take the scheduling and transcription handlers from
    // working-in-dev to 404-in-dev.
    '/api/meetings/calendar': { fn: 'meetings', pathPrefix: '/calendar' },
    // PA-056. The calendar CONSENT flow, distinct from oauth-proxy (which asks
    // for sign-in scopes) and from server/integrations/routes.ts (Express-only,
    // and it writes system_integrations while the events code reads
    // calendar_connections). Only /authorize goes through here; the provider's
    // redirect lands on the functions host directly, because it carries no JWT
    // and dev has no public URL for a provider to call back to.
    '/api/calendar-oauth': 'calendar-oauth',
    //
    // PROD-008. /api/catalog is the PLATFORM MASTER catalogue on Express and
    // was the TENANT's own product_models in the edge function, so the two
    // hosts answered 200 about different tables and ProductHubUnified was
    // broken five different ways in production. The edge function serves the
    // master catalogue now and the Express router is deleted, so this entry
    // makes dev run what production runs rather than papering over a gap.
    // /api/enabled-products goes with it: the page reads the master catalogue
    // and the tenant's enabled set together, and its Express handler lived in
    // the same deleted file.
    '/api/catalog': 'catalog',
    '/api/enabled-products': 'enabled-products',
    '/api/sales-pipeline/rep-metrics': { fn: 'sales-pipeline', pathPrefix: '/rep-metrics' },
    '/api/sales-pipeline/summary': { fn: 'sales-pipeline', pathPrefix: '/summary' },
    '/api/sales-pipeline/stages': { fn: 'sales-pipeline', pathPrefix: '/stages' },
    //
    // PROD-008: SCOPED, not the whole /api/mobile prefix. The edge function
    // now serves time tracking and the ticket-status write, so dev and
    // production run one implementation - but /api/mobile/dashboard and
    // /api/mobile/jobs/:jobId are still Express-only, and a bare '/api/mobile'
    // entry would take those from working-in-dev to 404-in-dev. The note in
    // server/routes-registry.ts that set that condition is the reason these two
    // are here and a third is not.
    '/api/mobile/time-tracking': { fn: 'mobile', pathPrefix: '/time-tracking' },
    '/api/mobile/service-tickets': { fn: 'mobile', pathPrefix: '/service-tickets' },
    //
    // LAUNCH-008: self-service registration. The signup page used to call
    // supabase.auth.signUp directly, so this edge function - the only thing
    // that creates the tenant, the users row and app_metadata.tenantId - had
    // no caller in any client tree. Repointing the page means dev needs to run
    // the same handler production does: /api/signup has never had an Express
    // route (the legacy one is /api/auth/signup, a different prefix and a
    // different auth model - it bcrypts a password into `users` and creates no
    // GoTrue user at all), so without this entry the page would 404 on every
    // developer machine. app.use matches on segment boundaries, so this does
    // NOT capture /api/signup-crm.
    '/api/signup': 'signup',
    //
    // /api/ai-employees is deliberately NOT here. Its edge fn covers the two
    // READ endpoints the dashboard calls, but the Express router also owns
    // create / tasks / workflows-execute, which run agents through
    // ClaudeAIService and are not ported. Proxying forwards the WHOLE prefix and
    // falls through only on a network error, never a 404 (see the CLAUDE.md
    // warning), so an entry here would take those write endpoints from
    // working-in-dev to 404-in-dev. Prod is unaffected either way: it never
    // reached Express, which is why the read endpoints were 404ing there.
  };

  for (const [prefix, functionName] of Object.entries(crmProxies)) {
    PROXIED_PREFIXES.add(prefix.replace(/^\/api\//, ''));
    app.use(prefix, createProxyHandler(functionName));
  }
  // PA-021 removed two special-cased forwards that used to live here: a bare
  // GET /api/customers redirect to the `companies` function, and an explicit
  // GET /api/customers/:id/:sub forward. Both are covered by the plain
  // '/api/customers' proxy entry above, which is also what production does.
  //
  // The sub-resource forward had a second problem the entry fixes: it matched
  // exactly three segments, so /api/customers/:id/metrics/history fell through
  // to Express while /api/customers/:id/devices did not. One tab of the
  // Customer Detail page was served by a different backend from its neighbour.

  log.info('✅ Edge function proxy registered for CRM routes');
}

// Export internals for testing
export const __test = {
  isTextContentType,
  buildProxyHeaders,
  readRawBody,
  forwardToEdgeFunction,
};
