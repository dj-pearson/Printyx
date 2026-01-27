import express, { Request, Response } from 'express';
import { storage } from '../storage';
import { z } from 'zod';
import {
  insertManufacturerConnectionSchema,
  insertManufacturerOrderSchema,
  insertManufacturerOrderLineItemSchema,
  insertManufacturerOrderConfirmationSchema,
  insertManufacturerOrderShipmentSchema,
  insertManufacturerOrderExceptionSchema,
} from '@shared/manufacturer-order-schema';

const router = express.Router();

// Helper function to check if user has admin/manager role
function isAdminOrManager(user: any): boolean {
  if (!user?.role) return false;
  const role = user.role || '';
  const roleLower = role.toLowerCase();
  return (
    roleLower.includes('admin') || roleLower.includes('manager') || roleLower.includes('executive')
  );
}

// Helper function to redact sensitive credential fields from connections
function redactConnectionCredentials(connection: any): any {
  const redacted = { ...connection };

  // Redact sensitive fields with masked values
  if (redacted.apiKey) redacted.apiKey = '••••••••';
  if (redacted.apiSecret) redacted.apiSecret = '••••••••';
  if (redacted.clientId) redacted.clientId = '••••••••';
  if (redacted.clientSecret) redacted.clientSecret = '••••••••';
  if (redacted.accessToken) redacted.accessToken = '••••••••';
  if (redacted.refreshToken) redacted.refreshToken = '••••••••';
  if (redacted.webhookSecret) redacted.webhookSecret = '••••••••';
  if (redacted.ediPassword) redacted.ediPassword = '••••••••';
  if (redacted.portalUsername) redacted.portalUsername = '••••••••';
  if (redacted.portalPassword) redacted.portalPassword = '••••••••';

  return redacted;
}

// ==================== Manufacturer Connections ====================

// GET /api/manufacturer-orders/connections - Get all manufacturer connections
router.get('/connections', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { manufacturerType, connectionStatus } = req.query;

    const connections = await storage.getManufacturerConnections(user.tenant_id, {
      manufacturerType: manufacturerType as string | undefined,
      connectionStatus: connectionStatus as string | undefined,
    });

    // Redact sensitive credentials for non-admin users
    const responseData = isAdminOrManager(user)
      ? connections
      : connections.map(redactConnectionCredentials);

    res.json(responseData);
  } catch (error) {
    console.error('Get manufacturer connections error:', error);
    res.status(500).json({ error: 'Failed to fetch manufacturer connections' });
  }
});

// GET /api/manufacturer-orders/connections/:id - Get a specific connection
router.get('/connections/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const connection = await storage.getManufacturerConnection(req.params.id);

    if (!connection || connection.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    // Redact sensitive credentials for non-admin users
    const responseData = isAdminOrManager(user)
      ? connection
      : redactConnectionCredentials(connection);

    res.json(responseData);
  } catch (error) {
    console.error('Get manufacturer connection error:', error);
    res.status(500).json({ error: 'Failed to fetch manufacturer connection' });
  }
});

// POST /api/manufacturer-orders/connections - Create a new connection (Admin/Manager only)
router.post('/connections', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Check for admin/manager role
  if (!isAdminOrManager(user)) {
    return res.status(403).json({
      error: 'Forbidden: Admin or Manager role required to manage manufacturer connections',
    });
  }

  try {
    const data = insertManufacturerConnectionSchema.parse(req.body);
    const connection = await storage.createManufacturerConnection({
      ...data,
      tenantId: user.tenant_id,
    });

    res.status(201).json(connection);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Create manufacturer connection error:', error);
    res.status(500).json({ error: 'Failed to create manufacturer connection' });
  }
});

// PUT /api/manufacturer-orders/connections/:id - Update a connection (Admin/Manager only)
router.put('/connections/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Check for admin/manager role
  if (!isAdminOrManager(user)) {
    return res.status(403).json({
      error: 'Forbidden: Admin or Manager role required to manage manufacturer connections',
    });
  }

  try {
    const existing = await storage.getManufacturerConnection(req.params.id);
    if (!existing || existing.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const data = insertManufacturerConnectionSchema.partial().parse(req.body);
    const updated = await storage.updateManufacturerConnection(req.params.id, user.tenant_id, data);

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Update manufacturer connection error:', error);
    res.status(500).json({ error: 'Failed to update manufacturer connection' });
  }
});

// DELETE /api/manufacturer-orders/connections/:id - Delete a connection (Admin/Manager only)
router.delete('/connections/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Check for admin/manager role
  if (!isAdminOrManager(user)) {
    return res.status(403).json({
      error: 'Forbidden: Admin or Manager role required to manage manufacturer connections',
    });
  }

  try {
    const connection = await storage.getManufacturerConnection(req.params.id);
    if (!connection || connection.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    await storage.deleteManufacturerConnection(req.params.id, user.tenant_id);
    res.status(204).send();
  } catch (error) {
    console.error('Delete manufacturer connection error:', error);
    res.status(500).json({ error: 'Failed to delete manufacturer connection' });
  }
});

// POST /api/manufacturer-orders/connections/:id/test - Test a connection
router.post('/connections/:id/test', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const connection = await storage.getManufacturerConnection(req.params.id);
    if (!connection || connection.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const result = await storage.testManufacturerConnection(req.params.id, user.tenant_id);
    res.json(result);
  } catch (error) {
    console.error('Test manufacturer connection error:', error);
    res.status(500).json({ error: 'Failed to test manufacturer connection' });
  }
});

// PATCH /api/manufacturer-orders/connections/:id/health - Update connection health
router.patch('/connections/:id/health', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const connection = await storage.getManufacturerConnection(req.params.id);
    if (!connection || connection.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const healthSchema = z.object({
      lastConnectionTest: z.coerce.date().optional(),
      lastSuccessfulOrder: z.coerce.date().optional(),
      lastError: z.string().optional(),
      consecutiveFailures: z.number().optional(),
    });

    const data = healthSchema.parse(req.body);
    const updated = await storage.updateConnectionHealth(req.params.id, user.tenant_id, data);

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Update connection health error:', error);
    res.status(500).json({ error: 'Failed to update connection health' });
  }
});

// ==================== Manufacturer Orders ====================

// GET /api/manufacturer-orders - Get all manufacturer orders
router.get('/', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { connectionId, orderStatus, startDate, endDate } = req.query;

    const orders = await storage.getManufacturerOrders(user.tenant_id, {
      connectionId: connectionId as string | undefined,
      orderStatus: orderStatus as string | undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });

    res.json(orders);
  } catch (error) {
    console.error('Get manufacturer orders error:', error);
    res.status(500).json({ error: 'Failed to fetch manufacturer orders' });
  }
});

// GET /api/manufacturer-orders/:id - Get a specific order
router.get('/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const order = await storage.getManufacturerOrder(req.params.id);

    if (!order || order.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error('Get manufacturer order error:', error);
    res.status(500).json({ error: 'Failed to fetch manufacturer order' });
  }
});

// POST /api/manufacturer-orders - Create a new order
router.post('/', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const data = insertManufacturerOrderSchema.parse(req.body);
    const order = await storage.createManufacturerOrder({
      ...data,
      tenantId: user.tenant_id,
    });

    res.status(201).json(order);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Create manufacturer order error:', error);
    res.status(500).json({ error: 'Failed to create manufacturer order' });
  }
});

// PUT /api/manufacturer-orders/:id - Update an order
router.put('/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const existing = await storage.getManufacturerOrder(req.params.id);
    if (!existing || existing.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const data = insertManufacturerOrderSchema.partial().parse(req.body);
    const updated = await storage.updateManufacturerOrder(req.params.id, user.tenant_id, data);

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Update manufacturer order error:', error);
    res.status(500).json({ error: 'Failed to update manufacturer order' });
  }
});

// DELETE /api/manufacturer-orders/:id - Delete an order
router.delete('/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const order = await storage.getManufacturerOrder(req.params.id);
    if (!order || order.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Order not found' });
    }

    await storage.deleteManufacturerOrder(req.params.id, user.tenant_id);
    res.status(204).send();
  } catch (error) {
    console.error('Delete manufacturer order error:', error);
    res.status(500).json({ error: 'Failed to delete manufacturer order' });
  }
});

// POST /api/manufacturer-orders/:id/submit - Submit an order to manufacturer
router.post('/:id/submit', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const order = await storage.getManufacturerOrder(req.params.id);
    if (!order || order.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const submitted = await storage.submitOrder(req.params.id, user.tenant_id);
    res.json(submitted);
  } catch (error) {
    console.error('Submit manufacturer order error:', error);
    res.status(500).json({ error: 'Failed to submit manufacturer order' });
  }
});

// POST /api/manufacturer-orders/:id/acknowledge - Acknowledge an order from manufacturer
router.post('/:id/acknowledge', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const order = await storage.getManufacturerOrder(req.params.id);
    if (!order || order.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const acknowledgeSchema = z.object({
      manufacturerOrderNumber: z.string(),
    });

    const { manufacturerOrderNumber } = acknowledgeSchema.parse(req.body);
    const acknowledged = await storage.acknowledgeOrder(
      req.params.id,
      user.tenant_id,
      manufacturerOrderNumber,
    );

    res.json(acknowledged);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Acknowledge manufacturer order error:', error);
    res.status(500).json({ error: 'Failed to acknowledge manufacturer order' });
  }
});

// PATCH /api/manufacturer-orders/:id/fulfillment - Update order fulfillment
router.patch('/:id/fulfillment', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const order = await storage.getManufacturerOrder(req.params.id);
    if (!order || order.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const fulfillmentSchema = z.object({
      totalQuantityShipped: z.number().optional(),
      totalQuantityDelivered: z.number().optional(),
      totalQuantityCancelled: z.number().optional(),
    });

    const data = fulfillmentSchema.parse(req.body);
    const updated = await storage.updateOrderFulfillment(req.params.id, user.tenant_id, data);

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Update order fulfillment error:', error);
    res.status(500).json({ error: 'Failed to update order fulfillment' });
  }
});

// ==================== Manufacturer Order Line Items ====================

// GET /api/manufacturer-orders/:orderId/line-items - Get all line items for an order
router.get('/:orderId/line-items', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Verify order belongs to tenant
    const order = await storage.getManufacturerOrder(req.params.orderId);
    if (!order || order.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const lineItems = await storage.getOrderLineItems(req.params.orderId);
    res.json(lineItems);
  } catch (error) {
    console.error('Get order line items error:', error);
    res.status(500).json({ error: 'Failed to fetch order line items' });
  }
});

// GET /api/manufacturer-orders/line-items/:id - Get a specific line item
router.get('/line-items/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const lineItem = await storage.getOrderLineItem(req.params.id);

    if (!lineItem || lineItem.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Line item not found' });
    }

    res.json(lineItem);
  } catch (error) {
    console.error('Get order line item error:', error);
    res.status(500).json({ error: 'Failed to fetch order line item' });
  }
});

// POST /api/manufacturer-orders/:orderId/line-items - Create a new line item
router.post('/:orderId/line-items', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Verify order belongs to tenant
    const order = await storage.getManufacturerOrder(req.params.orderId);
    if (!order || order.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const data = insertManufacturerOrderLineItemSchema.parse(req.body);
    const lineItem = await storage.createOrderLineItem({
      ...data,
      tenantId: user.tenant_id,
      orderId: req.params.orderId,
    });

    res.status(201).json(lineItem);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Create order line item error:', error);
    res.status(500).json({ error: 'Failed to create order line item' });
  }
});

// POST /api/manufacturer-orders/:orderId/line-items/bulk - Create multiple line items
router.post('/:orderId/line-items/bulk', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Verify order belongs to tenant
    const order = await storage.getManufacturerOrder(req.params.orderId);
    if (!order || order.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const bulkSchema = z.object({
      lineItems: z.array(insertManufacturerOrderLineItemSchema),
    });

    const { lineItems: itemsData } = bulkSchema.parse(req.body);
    const lineItems = await storage.bulkCreateOrderLineItems(
      itemsData.map((item) => ({
        ...item,
        tenantId: user.tenant_id,
        orderId: req.params.orderId,
      })),
    );

    res.status(201).json(lineItems);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Bulk create order line items error:', error);
    res.status(500).json({ error: 'Failed to create order line items' });
  }
});

// PUT /api/manufacturer-orders/line-items/:id - Update a line item
router.put('/line-items/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const existing = await storage.getOrderLineItem(req.params.id);
    if (!existing || existing.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Line item not found' });
    }

    const data = insertManufacturerOrderLineItemSchema.partial().parse(req.body);
    const updated = await storage.updateOrderLineItem(req.params.id, user.tenant_id, data);

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Update order line item error:', error);
    res.status(500).json({ error: 'Failed to update order line item' });
  }
});

// DELETE /api/manufacturer-orders/line-items/:id - Delete a line item
router.delete('/line-items/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const lineItem = await storage.getOrderLineItem(req.params.id);
    if (!lineItem || lineItem.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Line item not found' });
    }

    await storage.deleteOrderLineItem(req.params.id, user.tenant_id);
    res.status(204).send();
  } catch (error) {
    console.error('Delete order line item error:', error);
    res.status(500).json({ error: 'Failed to delete order line item' });
  }
});

// PATCH /api/manufacturer-orders/line-items/:id/shipment - Update line item shipment
router.patch('/line-items/:id/shipment', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const lineItem = await storage.getOrderLineItem(req.params.id);
    if (!lineItem || lineItem.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Line item not found' });
    }

    const shipmentSchema = z.object({
      quantityShipped: z.number().optional(),
      quantityDelivered: z.number().optional(),
      actualShipDate: z.coerce.date().optional(),
    });

    const data = shipmentSchema.parse(req.body);
    const updated = await storage.updateLineItemShipment(req.params.id, user.tenant_id, data);

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Update line item shipment error:', error);
    res.status(500).json({ error: 'Failed to update line item shipment' });
  }
});

// ==================== Manufacturer Order Confirmations ====================

// GET /api/manufacturer-orders/:orderId/confirmations - Get all confirmations for an order
router.get('/:orderId/confirmations', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Verify order belongs to tenant
    const order = await storage.getManufacturerOrder(req.params.orderId);
    if (!order || order.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const confirmations = await storage.getOrderConfirmations(req.params.orderId);
    res.json(confirmations);
  } catch (error) {
    console.error('Get order confirmations error:', error);
    res.status(500).json({ error: 'Failed to fetch order confirmations' });
  }
});

// GET /api/manufacturer-orders/confirmations/:id - Get a specific confirmation
router.get('/confirmations/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const confirmation = await storage.getOrderConfirmation(req.params.id);

    if (!confirmation || confirmation.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Confirmation not found' });
    }

    res.json(confirmation);
  } catch (error) {
    console.error('Get order confirmation error:', error);
    res.status(500).json({ error: 'Failed to fetch order confirmation' });
  }
});

// POST /api/manufacturer-orders/:orderId/confirmations - Create a new confirmation
router.post('/:orderId/confirmations', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Verify order belongs to tenant
    const order = await storage.getManufacturerOrder(req.params.orderId);
    if (!order || order.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const data = insertManufacturerOrderConfirmationSchema.parse(req.body);
    const confirmation = await storage.createOrderConfirmation({
      ...data,
      tenantId: user.tenant_id,
      orderId: req.params.orderId,
    });

    res.status(201).json(confirmation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Create order confirmation error:', error);
    res.status(500).json({ error: 'Failed to create order confirmation' });
  }
});

// PUT /api/manufacturer-orders/confirmations/:id - Update a confirmation
router.put('/confirmations/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const existing = await storage.getOrderConfirmation(req.params.id);
    if (!existing || existing.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Confirmation not found' });
    }

    const data = insertManufacturerOrderConfirmationSchema.partial().parse(req.body);
    const updated = await storage.updateOrderConfirmation(req.params.id, user.tenant_id, data);

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Update order confirmation error:', error);
    res.status(500).json({ error: 'Failed to update order confirmation' });
  }
});

// POST /api/manufacturer-orders/confirmations/:id/process - Process a confirmation
router.post('/confirmations/:id/process', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const confirmation = await storage.getOrderConfirmation(req.params.id);
    if (!confirmation || confirmation.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Confirmation not found' });
    }

    const processed = await storage.processConfirmation(req.params.id, user.tenant_id);
    res.json(processed);
  } catch (error) {
    console.error('Process order confirmation error:', error);
    res.status(500).json({ error: 'Failed to process order confirmation' });
  }
});

// ==================== Manufacturer Order Shipments ====================

// GET /api/manufacturer-orders/:orderId/shipments - Get all shipments for an order
router.get('/:orderId/shipments', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Verify order belongs to tenant
    const order = await storage.getManufacturerOrder(req.params.orderId);
    if (!order || order.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const shipments = await storage.getOrderShipments(req.params.orderId);
    res.json(shipments);
  } catch (error) {
    console.error('Get order shipments error:', error);
    res.status(500).json({ error: 'Failed to fetch order shipments' });
  }
});

// GET /api/manufacturer-orders/shipments/:id - Get a specific shipment
router.get('/shipments/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const shipment = await storage.getOrderShipment(req.params.id);

    if (!shipment || shipment.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    res.json(shipment);
  } catch (error) {
    console.error('Get order shipment error:', error);
    res.status(500).json({ error: 'Failed to fetch order shipment' });
  }
});

// GET /api/manufacturer-orders/shipments/tracking/:trackingNumber - Get shipment by tracking number
router.get('/shipments/tracking/:trackingNumber', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const shipment = await storage.getShipmentByTrackingNumber(
      req.params.trackingNumber,
      user.tenant_id,
    );

    if (!shipment) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    res.json(shipment);
  } catch (error) {
    console.error('Get shipment by tracking number error:', error);
    res.status(500).json({ error: 'Failed to fetch shipment' });
  }
});

// POST /api/manufacturer-orders/:orderId/shipments - Create a new shipment
router.post('/:orderId/shipments', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Verify order belongs to tenant
    const order = await storage.getManufacturerOrder(req.params.orderId);
    if (!order || order.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const data = insertManufacturerOrderShipmentSchema.parse(req.body);
    const shipment = await storage.createOrderShipment({
      ...data,
      tenantId: user.tenant_id,
      orderId: req.params.orderId,
    });

    res.status(201).json(shipment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Create order shipment error:', error);
    res.status(500).json({ error: 'Failed to create order shipment' });
  }
});

// PUT /api/manufacturer-orders/shipments/:id - Update a shipment
router.put('/shipments/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const existing = await storage.getOrderShipment(req.params.id);
    if (!existing || existing.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    const data = insertManufacturerOrderShipmentSchema.partial().parse(req.body);
    const updated = await storage.updateOrderShipment(req.params.id, user.tenant_id, data);

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Update order shipment error:', error);
    res.status(500).json({ error: 'Failed to update order shipment' });
  }
});

// DELETE /api/manufacturer-orders/shipments/:id - Delete a shipment
router.delete('/shipments/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const shipment = await storage.getOrderShipment(req.params.id);
    if (!shipment || shipment.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    await storage.deleteOrderShipment(req.params.id, user.tenant_id);
    res.status(204).send();
  } catch (error) {
    console.error('Delete order shipment error:', error);
    res.status(500).json({ error: 'Failed to delete order shipment' });
  }
});

// PATCH /api/manufacturer-orders/shipments/:id/tracking - Update shipment tracking
router.patch('/shipments/:id/tracking', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const shipment = await storage.getOrderShipment(req.params.id);
    if (!shipment || shipment.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    const trackingSchema = z.object({
      shipmentStatus: z.string().optional(),
      trackingEvents: z.any().optional(),
      lastTrackingUpdate: z.coerce.date().optional(),
    });

    const data = trackingSchema.parse(req.body);
    const updated = await storage.updateShipmentTracking(req.params.id, user.tenant_id, data);

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Update shipment tracking error:', error);
    res.status(500).json({ error: 'Failed to update shipment tracking' });
  }
});

// POST /api/manufacturer-orders/shipments/:id/deliver - Mark shipment as delivered
router.post('/shipments/:id/deliver', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const shipment = await storage.getOrderShipment(req.params.id);
    if (!shipment || shipment.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    const deliverySchema = z.object({
      actualDeliveryDate: z.coerce.date().optional(),
      deliveredTo: z.string().optional(),
      signatureName: z.string().optional(),
    });

    const data = deliverySchema.parse(req.body);
    const delivered = await storage.deliverShipment(req.params.id, user.tenant_id, data);

    res.json(delivered);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Deliver shipment error:', error);
    res.status(500).json({ error: 'Failed to deliver shipment' });
  }
});

// ==================== Manufacturer Order Exceptions ====================

// GET /api/manufacturer-orders/:orderId/exceptions - Get all exceptions for an order
router.get('/:orderId/exceptions', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Verify order belongs to tenant
    const order = await storage.getManufacturerOrder(req.params.orderId);
    if (!order || order.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const exceptions = await storage.getOrderExceptions(req.params.orderId);
    res.json(exceptions);
  } catch (error) {
    console.error('Get order exceptions error:', error);
    res.status(500).json({ error: 'Failed to fetch order exceptions' });
  }
});

// GET /api/manufacturer-orders/exceptions/unresolved - Get all unresolved exceptions
router.get('/exceptions/unresolved', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { severity, exceptionType } = req.query;

    const exceptions = await storage.getUnresolvedExceptions(user.tenant_id, {
      severity: severity as string | undefined,
      exceptionType: exceptionType as string | undefined,
    });

    res.json(exceptions);
  } catch (error) {
    console.error('Get unresolved exceptions error:', error);
    res.status(500).json({ error: 'Failed to fetch unresolved exceptions' });
  }
});

// GET /api/manufacturer-orders/exceptions/:id - Get a specific exception
router.get('/exceptions/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const exception = await storage.getOrderException(req.params.id);

    if (!exception || exception.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Exception not found' });
    }

    res.json(exception);
  } catch (error) {
    console.error('Get order exception error:', error);
    res.status(500).json({ error: 'Failed to fetch order exception' });
  }
});

// POST /api/manufacturer-orders/exceptions - Create a new exception
router.post('/exceptions', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const data = insertManufacturerOrderExceptionSchema.parse(req.body);
    const exception = await storage.createOrderException({
      ...data,
      tenantId: user.tenant_id,
    });

    res.status(201).json(exception);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Create order exception error:', error);
    res.status(500).json({ error: 'Failed to create order exception' });
  }
});

// PUT /api/manufacturer-orders/exceptions/:id - Update an exception
router.put('/exceptions/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const existing = await storage.getOrderException(req.params.id);
    if (!existing || existing.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Exception not found' });
    }

    const data = insertManufacturerOrderExceptionSchema.partial().parse(req.body);
    const updated = await storage.updateOrderException(req.params.id, user.tenant_id, data);

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Update order exception error:', error);
    res.status(500).json({ error: 'Failed to update order exception' });
  }
});

// POST /api/manufacturer-orders/exceptions/:id/resolve - Resolve an exception
router.post('/exceptions/:id/resolve', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const exception = await storage.getOrderException(req.params.id);
    if (!exception || exception.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Exception not found' });
    }

    const resolveSchema = z.object({
      resolutionNotes: z.string(),
    });

    const { resolutionNotes } = resolveSchema.parse(req.body);
    const resolved = await storage.resolveException(
      req.params.id,
      user.tenant_id,
      user.id,
      resolutionNotes,
    );

    res.json(resolved);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Resolve exception error:', error);
    res.status(500).json({ error: 'Failed to resolve exception' });
  }
});

// POST /api/manufacturer-orders/exceptions/:id/retry - Retry a failed order
router.post('/exceptions/:id/retry', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const exception = await storage.getOrderException(req.params.id);
    if (!exception || exception.tenant_id !== user.tenant_id) {
      return res.status(404).json({ error: 'Exception not found' });
    }

    const result = await storage.retryFailedOrder(req.params.id, user.tenant_id);
    res.json(result);
  } catch (error) {
    console.error('Retry failed order error:', error);
    res.status(500).json({ error: 'Failed to retry failed order' });
  }
});

// ==================== Analytics & Reporting ====================

// GET /api/manufacturer-orders/analytics - Get manufacturer order analytics (Admin/Manager only)
router.get('/analytics/dashboard', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Check for admin/manager role for analytics
  if (!isAdminOrManager(user)) {
    return res
      .status(403)
      .json({ error: 'Forbidden: Admin or Manager role required to view analytics' });
  }

  try {
    const { connectionId, startDate, endDate } = req.query;

    const analytics = await storage.getManufacturerOrderAnalytics(user.tenant_id, {
      connectionId: connectionId as string | undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });

    res.json(analytics);
  } catch (error) {
    console.error('Get manufacturer order analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;
