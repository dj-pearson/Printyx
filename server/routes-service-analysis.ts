import { Express } from 'express';
import { db } from './db';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-service-analysis');

import {
  partsOrders,
  partsOrderItems,
  insertPartsOrderItemSchema,
} from '../shared/service-analysis-schema';
import { eq, and } from 'drizzle-orm';
// Auth helpers for Supabase JWT + session fallback
import { getTenantId } from './utils/auth-helpers';
import { badRequest, notFound, serverError } from './lib/error-response';

// Every handler here reads the tenant from the request and then filters by it.
// getTenantId returns `string | undefined`, and passing undefined into eq() does
// not scope anything — it produces a bound parameter of undefined, which the
// driver rejects. So each handler answers 400 when there is no tenant on the
// request rather than issuing a query that either errors or, worse, reads across
// tenants. This is the 213-site house idiom, not a new one.
export function registerServiceAnalysisRoutes(app: Express) {
  // Round 163: the /api/service-tickets/:id/analysis and /api/service-analysis/*
  // handlers that lived here are deleted. /api/service-tickets is proxied, so
  // the first pair never ran in dev either; /api/service-analysis is proxied now
  // and both are served by edge functions over service_call_analysis. The
  // /api/parts-orders handlers below are a separate question (see
  // docs/route-divergence-triage.json).

  // Update parts order status
  app.patch('/api/parts-orders/:orderId', async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return badRequest(res, 'Tenant ID is required');
      }
      const { orderId } = req.params;
      const { status, trackingNumber, actualDeliveryDate } = req.body;

      const [updatedOrder] = await db
        .update(partsOrders)
        .set({
          status,
          trackingNumber,
          actualDeliveryDate: actualDeliveryDate ? new Date(actualDeliveryDate) : undefined,
          updatedAt: new Date(),
        })
        .where(and(eq(partsOrders.id, orderId), eq(partsOrders.tenantId, tenantId)))
        .returning();

      if (!updatedOrder) {
        return notFound(res, 'Parts order not found');
      }

      res.json(updatedOrder);
    } catch (error) {
      log.error('Error updating parts order:', error);
      serverError(res, 'Failed to update parts order');
    }
  });

  // Add parts order items
  app.post('/api/parts-orders/:orderId/items', async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return badRequest(res, 'Tenant ID is required');
      }
      const { orderId } = req.params;
      const itemsData = req.body.items || [req.body]; // Support both single item and array

      const items = itemsData.map((item: any) =>
        insertPartsOrderItemSchema.parse({
          ...item,
          tenantId,
          orderId,
        }),
      );

      const newItems = await db.insert(partsOrderItems).values(items).returning();

      res.status(201).json(newItems);
    } catch (error) {
      log.error('Error adding parts order items:', error);
      serverError(res, 'Failed to add parts order items');
    }
  });

  // Get parts order items
  app.get('/api/parts-orders/:orderId/items', async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return badRequest(res, 'Tenant ID is required');
      }
      const { orderId } = req.params;

      const items = await db
        .select()
        .from(partsOrderItems)
        .where(and(eq(partsOrderItems.tenantId, tenantId), eq(partsOrderItems.orderId, orderId)));

      res.json(items);
    } catch (error) {
      log.error('Error fetching parts order items:', error);
      serverError(res, 'Failed to fetch parts order items');
    }
  });
}
