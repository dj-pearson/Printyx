import type { Express } from 'express';
import { z } from 'zod';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-purchase-orders');

import { insertPurchaseOrderSchema, insertPurchaseOrderItemSchema } from '@shared/schema';
import { storage } from './storage';
import { isAuthenticated } from './replitAuth';
// RBAC Integration
import {
  enhanceUserContext,
  requirePermission,
  PERMISSIONS,
  type AuthenticatedRequest,
} from './middleware/rbac-route-helper';

import { getUserId, getTenantId, authed } from './utils/auth-helpers';
import { badRequest, notFound, serverError } from './lib/error-response';
// Validation schemas for update operations
const purchaseOrderStatusSchema = z.object({
  status: z.enum([
    'draft',
    'pending',
    'approved',
    'ordered',
    'received',
    'cancelled',
    'partially_received',
  ]),
});

const updatePurchaseOrderSchema = z
  .object({
    poNumber: z.string().min(1).optional(),
    vendorId: z.string().min(1).optional(),
    requestedBy: z.string().min(1).optional(),
    orderDate: z.string().or(z.date()).optional(),
    expectedDate: z.string().or(z.date()).nullable().optional(),
    description: z.string().nullable().optional(),
    subtotal: z.string().or(z.number()).optional(),
    taxAmount: z.string().or(z.number()).nullable().optional(),
    shippingAmount: z.string().or(z.number()).nullable().optional(),
    totalAmount: z.string().or(z.number()).optional(),
    status: z
      .enum([
        'draft',
        'pending',
        'approved',
        'ordered',
        'received',
        'cancelled',
        'partially_received',
      ])
      .optional(),
    deliveryAddress: z.string().nullable().optional(),
    specialInstructions: z.string().nullable().optional(),
    approvedBy: z.string().nullable().optional(),
    approvedDate: z.string().or(z.date()).nullable().optional(),
  })
  .strict();

const updatePurchaseOrderItemSchema = z
  .object({
    itemDescription: z.string().min(1).optional(),
    itemCode: z.string().nullable().optional(),
    quantity: z.number().int().positive().optional(),
    unitPrice: z.string().or(z.number()).optional(),
    totalPrice: z.string().or(z.number()).optional(),
    receivedQuantity: z.number().int().min(0).optional(),
  })
  .strict();

export function registerPurchaseOrderRoutes(app: Express) {
  // Apply authentication and RBAC context to all purchase order routes
  // isAuthenticated MUST come first - it populates req.user which enhanceUserContext requires
  app.use('/api/purchase-orders', isAuthenticated, enhanceUserContext);

  // Purchase Orders CRUD routes - requires inventory PO view permission
  app.get(
    '/api/purchase-orders',
    isAuthenticated,
    requirePermission([PERMISSIONS.INVENTORY.PURCHASE_ORDER.VIEW]),
    authed(async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = req.user?.tenantId || (req as any).user?.claims?.tenantId;
        // WF-P-03: mirror the edge function's filters. Both spellings are
        // accepted there, so both are accepted here.
        const q = req.query as Record<string, string | undefined>;
        const purchaseOrders = await storage.getPurchaseOrders(tenantId, {
          sourceContractId: q.contractId || q.source_contract_id,
          sourceDealId: q.dealId || q.source_deal_id,
          customerId: q.customerId || q.customer_id,
        });
        res.json(purchaseOrders);
      } catch (error) {
        log.error('Error fetching purchase orders:', error);
        serverError(res, 'Failed to fetch purchase orders');
      }
    }),
  );

  app.get(
    '/api/purchase-orders/:id',
    isAuthenticated,
    requirePermission([PERMISSIONS.INVENTORY.PURCHASE_ORDER.VIEW]),
    authed(async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = getTenantId(req)!;
        const { id } = req.params;

        const purchaseOrder = await storage.getPurchaseOrder(id, tenantId);
        if (!purchaseOrder) {
          return notFound(res, 'Purchase order not found');
        }

        // Get line items for this purchase order
        const items = await storage.getPurchaseOrderItems(id, tenantId);

        res.json({ ...purchaseOrder, items });
      } catch (error) {
        log.error('Error fetching purchase order:', error);
        serverError(res, 'Failed to fetch purchase order');
      }
    }),
  );

  app.post(
    '/api/purchase-orders',
    isAuthenticated,
    requirePermission([PERMISSIONS.INVENTORY.PURCHASE_ORDER.CREATE]),
    authed(async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = getTenantId(req)!;
        const userId = getUserId(req)!;

        const validatedData = insertPurchaseOrderSchema.parse({
          ...req.body,
          tenantId,
          createdBy: userId,
          requestedBy: req.body.requestedBy || userId,
          // WF-P-03: `contractId` is the name the Book Order link uses. Zod
          // strips unknown keys, so without this line the page's value reaches
          // the parse and is silently dropped - the defect this story is about,
          // one layer further in.
          sourceContractId: req.body.sourceContractId || req.body.contractId || null,
          sourceDealId: req.body.sourceDealId || req.body.dealId || null,
          customerId: req.body.customerId || null,
        });

        const purchaseOrder = await storage.createPurchaseOrder(validatedData);

        // Create line items if provided
        if (req.body.items && Array.isArray(req.body.items)) {
          const items = [];
          for (const [index, item] of req.body.items.entries()) {
            const validatedItem = insertPurchaseOrderItemSchema.parse({
              ...item,
              tenantId,
              purchaseOrderId: purchaseOrder.id,
              lineNumber: index + 1,
            });
            const createdItem = await storage.createPurchaseOrderItem(validatedItem);
            items.push(createdItem);
          }
          res.json({ ...purchaseOrder, items });
        } else {
          res.json(purchaseOrder);
        }
      } catch (error: any) {
        log.error('Error creating purchase order:', error);
        if (error.name === 'ZodError') {
          badRequest(res, 'Invalid data', { details: error.errors });
        } else {
          serverError(res, 'Failed to create purchase order');
        }
      }
    }),
  );

  app.put(
    '/api/purchase-orders/:id',
    isAuthenticated,
    requirePermission([PERMISSIONS.INVENTORY.PURCHASE_ORDER.EDIT]),
    authed(async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = getTenantId(req)!;
        const { id } = req.params;

        const validatedData = updatePurchaseOrderSchema.parse(req.body);

        const purchaseOrder = await storage.updatePurchaseOrder(
          id,
          { ...validatedData, updatedAt: new Date() },
          tenantId,
        );
        if (!purchaseOrder) {
          return notFound(res, 'Purchase order not found');
        }

        res.json(purchaseOrder);
      } catch (error: any) {
        log.error('Error updating purchase order:', error);
        if (error.name === 'ZodError') {
          badRequest(res, 'Invalid data', { details: error.errors });
        } else {
          serverError(res, 'Failed to update purchase order');
        }
      }
    }),
  );

  app.delete(
    '/api/purchase-orders/:id',
    isAuthenticated,
    requirePermission([PERMISSIONS.INVENTORY.PURCHASE_ORDER.DELETE]),
    authed(async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = getTenantId(req)!;
        const { id } = req.params;

        const success = await storage.deletePurchaseOrder(id, tenantId);
        if (!success) {
          return notFound(res, 'Purchase order not found');
        }

        res.json({ success: true });
      } catch (error) {
        log.error('Error deleting purchase order:', error);
        serverError(res, 'Failed to delete purchase order');
      }
    }),
  );

  // Update purchase order status - requires edit permission
  app.patch(
    '/api/purchase-orders/:id/status',
    isAuthenticated,
    requirePermission([PERMISSIONS.INVENTORY.PURCHASE_ORDER.EDIT]),
    authed(async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = getTenantId(req)!;
        const { id } = req.params;

        const { status } = purchaseOrderStatusSchema.parse(req.body);

        const purchaseOrder = await storage.updatePurchaseOrder(
          id,
          {
            status,
            updatedAt: new Date(),
            ...(status === 'approved' && {
              approvedBy: getUserId(req)!,
              approvedDate: new Date(),
            }),
          },
          tenantId,
        );

        if (!purchaseOrder) {
          return notFound(res, 'Purchase order not found');
        }

        res.json(purchaseOrder);
      } catch (error: any) {
        if (error.name === 'ZodError') {
          log.warn('Invalid purchase order status update:', error.errors);
          return badRequest(res, 'Invalid status value', { details: error.errors });
        }
        log.error('Error updating purchase order status:', error);
        serverError(res, 'Failed to update purchase order status');
      }
    }),
  );

  // Purchase Order Items routes - requires view permission
  app.get(
    '/api/purchase-orders/:id/items',
    isAuthenticated,
    requirePermission([PERMISSIONS.INVENTORY.PURCHASE_ORDER.VIEW]),
    authed(async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = getTenantId(req)!;
        const { id } = req.params;

        const items = await storage.getPurchaseOrderItems(id, tenantId);
        res.json(items);
      } catch (error) {
        log.error('Error fetching purchase order items:', error);
        serverError(res, 'Failed to fetch purchase order items');
      }
    }),
  );

  app.post(
    '/api/purchase-orders/:id/items',
    isAuthenticated,
    requirePermission([PERMISSIONS.INVENTORY.PURCHASE_ORDER.EDIT]),
    authed(async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = getTenantId(req)!;
        const { id } = req.params;

        const validatedData = insertPurchaseOrderItemSchema.parse({
          ...req.body,
          tenantId,
          purchaseOrderId: id,
        });

        const item = await storage.createPurchaseOrderItem(validatedData);
        res.json(item);
      } catch (error: any) {
        log.error('Error creating purchase order item:', error);
        if (error.name === 'ZodError') {
          badRequest(res, 'Invalid data', { details: error.errors });
        } else {
          serverError(res, 'Failed to create purchase order item');
        }
      }
    }),
  );

  app.put(
    '/api/purchase-order-items/:id',
    isAuthenticated,
    requirePermission([PERMISSIONS.INVENTORY.PURCHASE_ORDER.EDIT]),
    authed(async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = getTenantId(req)!;
        const { id } = req.params;

        const validatedData = updatePurchaseOrderItemSchema.parse(req.body);

        const item = await storage.updatePurchaseOrderItem(id, validatedData, tenantId);
        if (!item) {
          return notFound(res, 'Purchase order item not found');
        }

        res.json(item);
      } catch (error: any) {
        log.error('Error updating purchase order item:', error);
        if (error.name === 'ZodError') {
          badRequest(res, 'Invalid data', { details: error.errors });
        } else {
          serverError(res, 'Failed to update purchase order item');
        }
      }
    }),
  );

  app.delete(
    '/api/purchase-order-items/:id',
    isAuthenticated,
    requirePermission([PERMISSIONS.INVENTORY.PURCHASE_ORDER.EDIT]),
    authed(async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = getTenantId(req)!;
        const { id } = req.params;

        const success = await storage.deletePurchaseOrderItem(id, tenantId);
        if (!success) {
          return notFound(res, 'Purchase order item not found');
        }

        res.json({ success: true });
      } catch (error) {
        log.error('Error deleting purchase order item:', error);
        serverError(res, 'Failed to delete purchase order item');
      }
    }),
  );

  // Vendors CRUD routes - requires purchase order view permission
  // ── /api/vendors: RETIRED (PROD-008b) ─────────────────────────────────────
  //
  // This file's five vendor handlers duplicated routes-products-crud.ts's five,
  // and both sets were shadowed by the /api/vendors proxy. See the banner there.

  // Purchase Order statistics - requires view permission
  app.get(
    '/api/purchase-orders/stats/summary',
    isAuthenticated,
    requirePermission([PERMISSIONS.INVENTORY.PURCHASE_ORDER.VIEW]),
    authed(async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = getTenantId(req)!;
        const purchaseOrders = await storage.getPurchaseOrders(tenantId);

        const stats = {
          total: purchaseOrders.length,
          draft: purchaseOrders.filter((po) => po.status === 'draft').length,
          pending: purchaseOrders.filter((po) => po.status === 'pending').length,
          approved: purchaseOrders.filter((po) => po.status === 'approved').length,
          ordered: purchaseOrders.filter((po) => po.status === 'ordered').length,
          received: purchaseOrders.filter((po) => po.status === 'received').length,
          cancelled: purchaseOrders.filter((po) => po.status === 'cancelled').length,
          totalValue: purchaseOrders.reduce(
            (sum, po) => sum + parseFloat(po.totalAmount || '0'),
            0,
          ),
          pendingValue: purchaseOrders
            .filter((po) => ['pending', 'approved', 'ordered'].includes(po.status))
            .reduce((sum, po) => sum + parseFloat(po.totalAmount || '0'), 0),
        };

        res.json(stats);
      } catch (error) {
        log.error('Error fetching purchase order stats:', error);
        serverError(res, 'Failed to fetch purchase order statistics');
      }
    }),
  );
}
