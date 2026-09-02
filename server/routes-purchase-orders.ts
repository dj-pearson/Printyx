import type { Express } from 'express';
import { z } from 'zod';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-purchase-orders');

import { insertPurchaseOrderSchema, insertPurchaseOrderItemSchema } from '@shared/schema';
import {
  buildPayableFromReceipt,
  inventoryMovements,
  planReceipt,
  serialCaptureRequired,
  statusAfterReceipt,
  type ReceivableLine,
} from './services/purchase-order-receiving';
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

  // WF-P-02: receive a shipment against a purchase order.
  //
  // /api/purchase-orders is NOT proxied, so this is the dev half of an endpoint
  // supabase/functions/purchase-orders/ serves in production. The arithmetic is
  // the shared module both call, so the two hosts cannot disagree about stock
  // levels; only the I/O differs.
  app.post(
    '/api/purchase-orders/:id/receive',
    isAuthenticated,
    requirePermission([PERMISSIONS.INVENTORY.PURCHASE_ORDER.EDIT]),
    authed(async (req: AuthenticatedRequest, res) => {
      try {
        const tenantId = getTenantId(req)!;
        const userId = getUserId(req)!;
        const { id } = req.params;

        const po = await storage.getPurchaseOrder(id, tenantId);
        if (!po) return notFound(res, 'Purchase order not found');

        if (!['approved', 'ordered', 'partially_received'].includes(po.status)) {
          return badRequest(
            res,
            'Purchase order must be approved, ordered, or partially received to record receipts',
          );
        }

        const entries = Array.isArray(req.body?.items) ? req.body.items : [];
        if (entries.length === 0) {
          return badRequest(res, 'At least one line item must be specified for receiving');
        }

        const receiptDate = req.body?.receiptDate ? new Date(req.body.receiptDate) : new Date();

        // The shared module reads PostgREST's snake_case row keys; Drizzle hands
        // back camelCase, so the rows are mapped rather than the module made
        // bilingual (which would defeat the text-comparison parity test).
        const items = await storage.getPurchaseOrderItems(id, tenantId);
        const lines: ReceivableLine[] = items.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          received_quantity: item.receivedQuantity,
          inventory_item_id: item.inventoryItemId,
          item_description: item.itemDescription,
        }));

        const plan = planReceipt(lines, entries);
        if (plan.receipts.length === 0) {
          return badRequest(res, 'No line item on this purchase order matched the receipt', {
            details: { unknownLineItemIds: plan.unknownLineItemIds },
          });
        }

        // Which of these are tracked one unit at a time. A serialized line
        // records its receipt but does not move bulk inventory: those units
        // become equipment rows (WF-L-04) and counting them here would double
        // them.
        const serialized = new Set<string>();
        for (const receipt of plan.receipts) {
          if (!receipt.inventoryItemId) continue;
          const invItem = await storage.getInventoryItem(receipt.inventoryItemId, tenantId);
          if (invItem?.isSerialized) serialized.add(receipt.inventoryItemId);
        }

        for (const receipt of plan.receipts) {
          await storage.updatePurchaseOrderItem(
            receipt.lineItemId,
            {
              receivedQuantity: receipt.newReceivedQuantity,
              lastReceivedDate: receiptDate,
            },
            tenantId,
          );
        }

        for (const movement of inventoryMovements(plan.receipts, serialized)) {
          const invItem = await storage.getInventoryItem(movement.inventoryItemId, tenantId);
          if (!invItem) continue;
          await storage.updateInventoryItem(
            movement.inventoryItemId,
            {
              quantityOnHand: (invItem.quantityOnHand || 0) + movement.quantity,
              quantityAvailable: (invItem.quantityAvailable || 0) + movement.quantity,
              quantityOnOrder: Math.max(0, (invItem.quantityOnOrder || 0) - movement.quantity),
            },
            tenantId,
          );
        }

        const derivedStatus = statusAfterReceipt(lines, plan.receipts);
        const updated = await storage.updatePurchaseOrder(
          id,
          {
            status: derivedStatus ?? po.status,
            lastReceiptDate: receiptDate,
            receiptNotes: req.body?.notes ?? null,
            receivedBy: userId,
            updatedAt: new Date(),
          },
          tenantId,
        );

        // The expected bill, once per order rather than once per partial
        // receipt. A failure here is reported alongside the receipt rather than
        // failing it: the stock has arrived and the line quantities are already
        // committed, so a 500 would tell the caller none of it happened.
        let payableId: string | null = null;
        let payableError: string | null = null;
        const existing = await storage.getAccountsPayableByPurchaseOrder(id, tenantId);
        if (existing) {
          payableId = existing.id;
        } else {
          try {
            const payable = await storage.createAccountsPayable(
              buildPayableFromReceipt(
                {
                  id: po.id,
                  tenant_id: po.tenantId,
                  vendor_id: po.vendorId,
                  po_number: po.poNumber,
                  subtotal: po.subtotal,
                  tax_amount: po.taxAmount,
                  total_amount: po.totalAmount,
                },
                { receiptDate: receiptDate.toISOString(), createdBy: userId },
              ) as never,
            );
            payableId = payable.id;
          } catch (apError) {
            log.error('Error raising payable for PO receipt:', apError);
            payableError = 'The receipt was recorded but no payable was raised for it';
          }
        }

        res.json({
          ...updated,
          overReceipts: plan.overReceipts,
          requiresSerialCapture: serialCaptureRequired(lines, plan.receipts, serialized),
          unknownLineItemIds: plan.unknownLineItemIds,
          payableId,
          payableError,
        });
      } catch (error) {
        log.error('Error recording purchase order receipt:', error);
        serverError(res, 'Failed to record receipt');
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
