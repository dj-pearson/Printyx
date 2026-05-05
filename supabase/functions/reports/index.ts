/**
 * Reports edge function — modular dispatcher.
 *
 * Replaces:
 *   server/routes/director-reports-api.ts        (4 endpoints)
 *   server/routes/executive-reports-api.ts       (4 endpoints)
 *   server/routes/sales-reports-api.ts           (10 endpoints)
 *   server/routes/sales-manager-reports-api.ts   (6 endpoints)
 *   server/routes/sales-supervisor-reports-api.ts(6 endpoints)
 *   server/routes/service-reports-api.ts         (8 endpoints)
 *   server/routes/service-manager-reports-api.ts (6 endpoints)
 *   server/routes/service-supervisor-reports-api.ts(6 endpoints)
 *   server/routes/team-reports-api.ts            (8 endpoints)
 *   server/routes/warehouse-reports-api.ts       (2 endpoints)
 *   server/routes/reporting-api.ts               (9 endpoints, generic engine)
 *   server/routes-reports.ts                     (5 endpoints — second tier)
 *   server/routes-breach-detection.ts            (2 endpoints — breaches)
 *   server/routes-custom-reports.ts              (7 endpoints — custom builder)
 *
 * URL layout (under /reports):
 *   /reports/<dashboard-type>                — legacy cross-domain dashboards
 *                                              (executive-summary, kpi-scorecards,
 *                                               business-insights, competitive-metrics,
 *                                               territory-performance, revenue-attribution)
 *   /reports/dashboards/<dashboard-type>     — same set, namespaced
 *   /reports/<persona>/...                   — director / executive / sales /
 *                                              sales-manager / sales-supervisor /
 *                                              service / service-manager /
 *                                              service-supervisor / team / warehouse
 *   /reports/engine/...                      — generic report engine CRUD
 *   /reports/<second-tier>                   — breaches, breach-summary,
 *                                              customer-health, sales-pipeline,
 *                                              revenue-recognition,
 *                                              service-sla-compliance,
 *                                              technician-utilization
 *   /reports/<frontend-stub>                 — financial-summary, payment-alerts,
 *                                              ar-aging, customer-profitability,
 *                                              cash-flow-forecast, territory-financials,
 *                                              sales-reps, team-performance,
 *                                              pipeline-funnel, service-forecasts,
 *                                              technician-capacity, inventory-forecast,
 *                                              service-summary, revenue
 *   /reports/custom/...                      — list / create / preview / get / update /
 *                                              delete / execute custom user reports
 */

import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { errorResponse, generateRequestId } from '../_shared/http.ts';
import { createLogger } from '../_shared/logger.ts';

import { handleDashboards } from './handlers/dashboards.ts';
import { handleDirector } from './handlers/director.ts';
import { handleExecutive } from './handlers/executive.ts';
import { handleSales } from './handlers/sales.ts';
import { handleReportingEngine } from './handlers/reporting-engine.ts';
import { handleScopedSales } from './handlers/scoped-sales.ts';
import { handleScopedService } from './handlers/scoped-service.ts';
import { handleService } from './handlers/service.ts';
import { handleTeam } from './handlers/team.ts';
import { handleWarehouse } from './handlers/warehouse.ts';
import { handleSecondTier, isSecondTierEndpoint } from './handlers/second-tier.ts';
import { handleFrontendStubs, isFrontendStubEndpoint } from './handlers/frontend-stubs.ts';
import { handleCustomReports } from './handlers/custom-reports.ts';
import { handleKpis } from './handlers/kpis.ts';
import { handleReporting } from './handlers/reporting.ts';
import { handleScheduledReports } from './handlers/scheduled.ts';

const log = createLogger('reports');

const LEGACY_DASHBOARD_TYPES: ReadonlySet<string> = new Set([
  'executive-summary',
  'kpi-scorecards',
  'business-insights',
  'competitive-metrics',
  'territory-performance',
  'revenue-attribution',
]);

function stripPrefix(path: string): string {
  return (
    path
      .replace(/\/+/g, '/')
      .replace(/^\/reports(?=\/|$)/, '')
      .replace(/\/$/, '') || '/'
  );
}

export default async function handler(req: Request) {
  const cors = handleCors(req);
  if (cors) return cors;

  const requestId = generateRequestId();
  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  const startedAt = Date.now();

  try {
    const auth = await requireAuth(req);
    const db = getDb();

    const rest = stripPrefix(url.pathname);
    const pathParts = rest.split('/').filter(Boolean);
    const ctx = { auth, db, requestId, pathParts, method, url };

    let result: Response | null = null;

    const firstSegment = pathParts[0];

    if (firstSegment && LEGACY_DASHBOARD_TYPES.has(firstSegment)) {
      // Backwards compatibility: /reports/<type> → dashboards handler with
      // the original `pathParts` shape it expects (['dashboards', '<type>']).
      result = await handleDashboards(req, {
        ...ctx,
        pathParts: ['dashboards', ...pathParts],
      });
    } else if (firstSegment === 'custom') {
      result = await handleCustomReports(req, ctx);
    } else if (firstSegment === 'kpis') {
      result = await handleKpis(req, ctx);
    } else if (firstSegment === 'reporting') {
      result = await handleReporting(req, ctx);
    } else if (firstSegment === 'scheduled') {
      result = await handleScheduledReports(req, ctx);
    } else if (firstSegment && isSecondTierEndpoint(firstSegment, method)) {
      result = await handleSecondTier(req, ctx);
    } else if (firstSegment && isFrontendStubEndpoint(firstSegment, method)) {
      result = await handleFrontendStubs(req, ctx);
    } else {
      switch (firstSegment) {
        case 'dashboards':
          result = await handleDashboards(req, ctx);
          break;
        case 'director':
          result = await handleDirector(req, ctx);
          break;
        case 'engine':
          result = await handleReportingEngine(req, ctx);
          break;
        case 'executive':
          result = await handleExecutive(req, ctx);
          break;
        case 'sales':
          result = await handleSales(req, ctx);
          break;
        case 'sales-manager':
          result = await handleScopedSales(req, ctx, 'region');
          break;
        case 'sales-supervisor':
          result = await handleScopedSales(req, ctx, 'location');
          break;
        case 'service':
          result = await handleService(req, ctx);
          break;
        case 'service-manager':
          result = await handleScopedService(req, ctx, 'region');
          break;
        case 'service-supervisor':
          result = await handleScopedService(req, ctx, 'location');
          break;
        case 'team':
          result = await handleTeam(req, ctx);
          break;
        case 'warehouse':
          result = await handleWarehouse(req, ctx);
          break;
        default:
          result = null;
      }
    }

    if (!result) {
      return errorResponse(404, 'Not found', req, {
        code: 'NOT_FOUND',
        details: { path: url.pathname, method },
        requestId,
      });
    }
    return result;
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse(err.status, err.message, req, {
        code: err.code.toUpperCase(),
        details: err.details,
        requestId,
      });
    }
    log.error({ requestId, err: String(err), stack: (err as Error)?.stack }, 'request_failed');
    return errorResponse(500, 'Internal server error', req, {
      code: 'INTERNAL',
      requestId,
    });
  } finally {
    log.info(
      { requestId, path: url.pathname, method, durationMs: Date.now() - startedAt },
      'request_complete',
    );
  }
}
