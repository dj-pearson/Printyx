/**
 * Manufacturer Orders edge function.
 *
 * Replaces server/routes/manufacturer-order-routes.ts (1,184 loc, 43 endpoints).
 *
 * URL prefix: /manufacturer-orders/*
 *
 * Resource groups:
 *   /connections/*                      → handlers/connections.ts   (7)
 *   /                  (orders root)    → handlers/orders.ts        (8)
 *   /:orderId/line-items + /line-items  → handlers/line-items.ts    (7)
 *   /:orderId/confirmations + /confirmations → handlers/confirmations.ts (5)
 *   /:orderId/shipments + /shipments    → handlers/shipments.ts     (8)
 *   /:orderId/exceptions + /exceptions  → handlers/exceptions.ts    (7)
 *   /analytics/dashboard                → handlers/analytics.ts     (1)
 *
 * One-time SQL:
 *   \i drizzle/rls/manufacturer-orders-tables.sql
 *   \i drizzle/rls/manufacturer-orders.sql
 */

import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { errorResponse, generateRequestId } from '../_shared/http.ts';
import { createLogger } from '../_shared/logger.ts';

import { handleConnections } from './handlers/connections.ts';
import { handleOrders } from './handlers/orders.ts';
import { handleLineItems } from './handlers/line-items.ts';
import { handleConfirmations } from './handlers/confirmations.ts';
import { handleShipments } from './handlers/shipments.ts';
import { handleExceptions } from './handlers/exceptions.ts';
import { handleAnalytics } from './handlers/analytics.ts';

const log = createLogger('manufacturer-orders');

function stripPrefix(path: string): string {
  return (
    path
      .replace(/\/+/g, '/')
      .replace(/^\/manufacturer-orders/, '')
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
    const second = parts[1];
    const third = parts[2];

    const ctx = { auth, db, requestId, pathParts: [] as string[], method, url };

    let result: Response | null = null;

    // Flat top-level resources
    if (first === 'connections') {
      result = await handleConnections(req, { ...ctx, pathParts: parts.slice(1) });
    } else if (first === 'line-items') {
      result = await handleLineItems(req, { ...ctx, pathParts: parts.slice(1) });
    } else if (first === 'confirmations') {
      result = await handleConfirmations(req, { ...ctx, pathParts: parts.slice(1) });
    } else if (first === 'shipments') {
      result = await handleShipments(req, { ...ctx, pathParts: parts.slice(1) });
    } else if (first === 'exceptions') {
      result = await handleExceptions(req, { ...ctx, pathParts: parts.slice(1) });
    } else if (first === 'analytics' && second === 'dashboard') {
      result = await handleAnalytics(req, { ...ctx, pathParts: [] });
    } else if (first && second === 'line-items') {
      // /:orderId/line-items[/bulk]
      result = await handleLineItems(req, {
        ...ctx,
        pathParts: ['for-order', first, ...parts.slice(2)],
      });
    } else if (first && second === 'confirmations') {
      // /:orderId/confirmations
      result = await handleConfirmations(req, {
        ...ctx,
        pathParts: ['for-order', first, ...parts.slice(2)],
      });
    } else if (first && second === 'shipments') {
      // /:orderId/shipments
      result = await handleShipments(req, {
        ...ctx,
        pathParts: ['for-order', first, ...parts.slice(2)],
      });
    } else if (first && second === 'exceptions') {
      // /:orderId/exceptions
      result = await handleExceptions(req, {
        ...ctx,
        pathParts: ['for-order', first, ...parts.slice(2)],
      });
    } else if (first && second === 'submit') {
      result = await handleOrders(req, { ...ctx, pathParts: ['submit', first] });
    } else if (first && second === 'acknowledge') {
      result = await handleOrders(req, { ...ctx, pathParts: ['acknowledge', first] });
    } else if (first && second === 'fulfillment') {
      result = await handleOrders(req, { ...ctx, pathParts: ['fulfillment', first] });
    } else {
      // Core orders: /, /:id
      result = await handleOrders(req, { ...ctx, pathParts: parts });
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
