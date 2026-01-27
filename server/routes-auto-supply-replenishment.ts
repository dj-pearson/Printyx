import { Router, type Request, Response, NextFunction } from 'express';
import { db } from './db';
import { eq, and, desc } from 'drizzle-orm';
import { supplyMonitoring, autoSupplyOrders } from '@shared/schema';
import * as supplyService from './services/auto-supply-replenishment-service';
// RBAC Integration
import {
  enhanceUserContext,
  requirePermission,
  PERMISSIONS,
  type AuthenticatedRequest,
} from './middleware/rbac-route-helper';

const router = Router();

/**
 * Auto-Supply Replenishment Routes
 *
 * Automated supply monitoring and ordering endpoints
 */

// Middleware to check tenant
function requireTenant(req: Request, res: Response, next: NextFunction) {
  const tenantId = (req as any).tenantId || (req.session as any)?.tenantId;
  if (!tenantId) {
    return res.status(403).json({ error: 'Tenant context required' });
  }
  (req as any).tenantId = tenantId;
  next();
}

router.use(requireTenant);
// Apply RBAC context to all auto-supply-replenishment routes
router.use(enhanceUserContext);

/**
 * GET /api/auto-supply-replenishment/dashboard
 * Get dashboard metrics and overview
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const metrics = await supplyService.getDashboardMetrics(tenantId);
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    res.status(500).json({
      error: 'Failed to fetch dashboard metrics',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/auto-supply-replenishment/supplies
 * Get all monitored supplies with optional filtering
 */
router.get('/supplies', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const { status, priority } = req.query;

    let query = db.query.supplyMonitoring.findMany({
      where: eq(supplyMonitoring.tenantId, tenantId),
      orderBy: [desc(supplyMonitoring.lastCheckedAt)],
      limit: 100,
    });

    const supplies = await query;
    res.json(supplies);
  } catch (error) {
    console.error('Error fetching supplies:', error);
    res.status(500).json({
      error: 'Failed to fetch supplies',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/auto-supply-replenishment/low-supplies
 * Get supplies that are low or need ordering
 */
router.get('/low-supplies', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const lowSupplies = await supplyService.getLowSupplyAlerts(tenantId);
    res.json(lowSupplies);
  } catch (error) {
    console.error('Error fetching low supplies:', error);
    res.status(500).json({
      error: 'Failed to fetch low supplies',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/auto-supply-replenishment/analyze/:supplyMonitoringId
 * Analyze a single supply and predict depletion
 */
router.post('/analyze/:supplyMonitoringId', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const supplyMonitoringId = parseInt(req.params.supplyMonitoringId);

    if (isNaN(supplyMonitoringId)) {
      return res.status(400).json({ error: 'Invalid supply monitoring ID' });
    }

    const analysis = await supplyService.analyzeSupplyLevel(tenantId, supplyMonitoringId);
    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing supply:', error);
    res.status(500).json({
      error: 'Failed to analyze supply',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/auto-supply-replenishment/analyze-all
 * Batch analyze all supplies for the tenant
 */
router.post('/analyze-all', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const results = await supplyService.analyzeTenantSupplies(tenantId);
    res.json(results);
  } catch (error) {
    console.error('Error analyzing all supplies:', error);
    res.status(500).json({
      error: 'Failed to analyze supplies',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/auto-supply-replenishment/create-order/:supplyMonitoringId
 * Create an automatic supply order
 */
router.post('/create-order/:supplyMonitoringId', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const supplyMonitoringId = parseInt(req.params.supplyMonitoringId);

    if (isNaN(supplyMonitoringId)) {
      return res.status(400).json({ error: 'Invalid supply monitoring ID' });
    }

    // First analyze to get recommendations
    const analysis = await supplyService.analyzeSupplyLevel(tenantId, supplyMonitoringId);

    // Create order
    const order = await supplyService.createAutoSupplyOrder(tenantId, supplyMonitoringId, analysis);
    res.json(order);
  } catch (error) {
    console.error('Error creating supply order:', error);
    res.status(500).json({
      error: 'Failed to create supply order',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/auto-supply-replenishment/orders
 * Get recent supply orders
 */
router.get('/orders', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const limit = parseInt(req.query.limit as string) || 20;
    const orders = await supplyService.getRecentOrders(tenantId, limit);
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      error: 'Failed to fetch orders',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/auto-supply-replenishment/orders/:orderId
 * Get specific order details
 */
router.get('/orders/:orderId', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const orderId = parseInt(req.params.orderId);

    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    const order = await db.query.autoSupplyOrders.findFirst({
      where: and(eq(autoSupplyOrders.id, orderId), eq(autoSupplyOrders.tenantId, tenantId)),
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      error: 'Failed to fetch order',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PATCH /api/auto-supply-replenishment/orders/:orderId/status
 * Update order status (e.g., mark as delivered, installed)
 */
router.patch('/orders/:orderId/status', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const orderId = parseInt(req.params.orderId);
    const { status, trackingNumber, actualDeliveryDate, notes } = req.body;

    if (isNaN(orderId)) {
      return res.status(400).json({ error: 'Invalid order ID' });
    }

    const updates: any = {
      updatedAt: new Date(),
    };

    if (status) updates.status = status;
    if (trackingNumber) updates.trackingNumber = trackingNumber;
    if (actualDeliveryDate) updates.actualDeliveryDate = new Date(actualDeliveryDate);
    if (notes) updates.notes = notes;

    const [updatedOrder] = await db
      .update(autoSupplyOrders)
      .set(updates)
      .where(and(eq(autoSupplyOrders.id, orderId), eq(autoSupplyOrders.tenantId, tenantId)))
      .returning();

    if (!updatedOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(updatedOrder);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      error: 'Failed to update order status',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/auto-supply-replenishment/rules
 * Get replenishment automation rules
 */
router.get('/rules', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const rules = await supplyService.getReplenishmentRules(tenantId);
    res.json(rules);
  } catch (error) {
    console.error('Error fetching rules:', error);
    res.status(500).json({
      error: 'Failed to fetch rules',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/auto-supply-replenishment/rules
 * Update replenishment automation rules
 */
router.put('/rules', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const updates = req.body;
    const rules = await supplyService.updateReplenishmentRules(tenantId, updates);
    res.json(rules);
  } catch (error) {
    console.error('Error updating rules:', error);
    res.status(500).json({
      error: 'Failed to update rules',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/auto-supply-replenishment/supply/:supplyMonitoringId
 * Get detailed supply information with history
 */
router.get('/supply/:supplyMonitoringId', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const supplyMonitoringId = parseInt(req.params.supplyMonitoringId);

    if (isNaN(supplyMonitoringId)) {
      return res.status(400).json({ error: 'Invalid supply monitoring ID' });
    }

    const supply = await db.query.supplyMonitoring.findFirst({
      where: and(
        eq(supplyMonitoring.id, supplyMonitoringId),
        eq(supplyMonitoring.tenantId, tenantId),
      ),
      with: {
        orders: {
          orderBy: [desc(autoSupplyOrders.orderDate)],
          limit: 10,
        },
        usageHistory: {
          orderBy: [desc((s: any) => s.dateRecorded)],
          limit: 30,
        },
      },
    });

    if (!supply) {
      return res.status(404).json({ error: 'Supply not found' });
    }

    res.json(supply);
  } catch (error) {
    console.error('Error fetching supply details:', error);
    res.status(500).json({
      error: 'Failed to fetch supply details',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PATCH /api/auto-supply-replenishment/supply/:supplyMonitoringId
 * Update supply monitoring configuration
 */
router.patch('/supply/:supplyMonitoringId', async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).tenantId;
    const supplyMonitoringId = parseInt(req.params.supplyMonitoringId);
    const { reorderThreshold, reorderQuantity, autoOrderEnabled } = req.body;

    if (isNaN(supplyMonitoringId)) {
      return res.status(400).json({ error: 'Invalid supply monitoring ID' });
    }

    const updates: any = {
      updatedAt: new Date(),
    };

    if (reorderThreshold !== undefined) updates.reorderThreshold = reorderThreshold;
    if (reorderQuantity !== undefined) updates.reorderQuantity = reorderQuantity;
    if (autoOrderEnabled !== undefined) updates.autoOrderEnabled = autoOrderEnabled;

    const [updatedSupply] = await db
      .update(supplyMonitoring)
      .set(updates)
      .where(
        and(eq(supplyMonitoring.id, supplyMonitoringId), eq(supplyMonitoring.tenantId, tenantId)),
      )
      .returning();

    if (!updatedSupply) {
      return res.status(404).json({ error: 'Supply not found' });
    }

    res.json(updatedSupply);
  } catch (error) {
    console.error('Error updating supply:', error);
    res.status(500).json({
      error: 'Failed to update supply',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
