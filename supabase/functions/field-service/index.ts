/**
 * Field Service edge function (canonical).
 *
 * Replaces 5 Express route files (3,060 loc, ~97 endpoints):
 *   server/routes/field-service-routes.ts       (installations, checklists, signatures)
 *   server/routes/geofence-alerts-routes.ts     (rules, alerts, subscriptions, stats)
 *   server/routes/gps-tracking-routes.ts        (locations, routes, deviations, ETAs, geofences)
 *   server/routes/mileage-routes.ts             (records, reports, vehicles)
 *   server/routes/route-optimization-routes.ts  (optimize, multi-technician)
 *
 * PRD suggested splitting into 3 edge functions (office, tracking, alerts). We
 * keep one function with handler-module separation; splitting is a performance
 * tweak that can happen later once we see real cold-start + Realtime metrics.
 *
 * Realtime subscription swap for technician_locations (PRD §4) is deferred to
 * Phase 6 US-027. This port just writes the table — any downstream WS → Realtime
 * migration reuses the same writes.
 *
 * URL prefix: /field-service/*
 *
 * One-time SQL:
 *   \i drizzle/rls/field-service-tables.sql
 *   \i drizzle/rls/field-service.sql
 */

import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { errorResponse, generateRequestId } from '../_shared/http.ts';
import { createLogger } from '../_shared/logger.ts';

import { handleInstallations } from './handlers/installations.ts';
import { handleChecklists } from './handlers/checklists.ts';
import { handleSignatures } from './handlers/signatures.ts';
import { handleLocations } from './handlers/locations.ts';
import { handleGeofences } from './handlers/geofences.ts';
import { handleGeofenceAlerts } from './handlers/geofence-alerts.ts';
import { handleRoutes } from './handlers/routes.ts';
import { handleMileage } from './handlers/mileage.ts';
import { handleStubs } from './handlers/stubs.ts';

const log = createLogger('field-service');

function stripPrefix(path: string): string {
  return (
    path
      .replace(/\/+/g, '/')
      .replace(/^\/field-service/, '')
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
  const sub = stripPrefix(url.pathname);

  try {
    const auth = await requireAuth(req);
    const db = getDb();
    const parts = sub.split('/').filter(Boolean);
    const first = parts[0];
    const ctx = { auth, db, requestId, pathParts: parts.slice(1), method, url };

    let result: Response | null = null;
    switch (first) {
      case 'installations':
        result = await handleInstallations(req, ctx);
        break;
      case 'installation-checklists':
        result = await handleChecklists(req, ctx);
        break;
      case 'service-signatures':
        result = await handleSignatures(req, ctx);
        break;
      case 'technicians':
      case 'locations':
      case 'location-history':
        result = await handleLocations(req, { ...ctx, pathParts: parts });
        break;
      case 'tickets':
        // /tickets/:id/activity-timeline, /tickets/:id/eta, /tickets/:id/events
        result = await handleLocations(req, { ...ctx, pathParts: parts });
        break;
      case 'geofences':
        result = await handleGeofences(req, ctx);
        break;
      case 'geofence-events':
      case 'process-event':
      case 'check-dwell':
        result = await handleGeofences(req, { ...ctx, pathParts: parts });
        break;
      case 'rules':
      case 'alerts':
      case 'dwell-sessions':
      case 'subscriptions':
      case 'statistics':
        result = await handleGeofenceAlerts(req, { ...ctx, pathParts: parts });
        break;
      case 'routes':
      case 'deviations':
      case 'optimize':
      case 'multi-technician':
        result = await handleRoutes(req, { ...ctx, pathParts: parts });
        break;
      case 'records':
      case 'summary':
      case 'reports':
      case 'rates':
      case 'irs-log':
      case 'vehicles':
      case 'auto-generate':
        result = await handleMileage(req, { ...ctx, pathParts: parts });
        break;
      case 'etas':
        result = await handleStubs(req, { ...ctx, pathParts: parts });
        break;
      default:
        result = null;
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
