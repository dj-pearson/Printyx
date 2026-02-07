import express from 'express';
import { db } from './db';
import { clientCollectedMetrics, tonerAlerts } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { resolveTenant, requireTenant, type TenantRequest } from './middleware/tenancy';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-device-monitoring');

// RBAC Integration
import {
  enhanceUserContext,
  requirePermission,
  PERMISSIONS,
  type AuthenticatedRequest,
} from './middleware/rbac-route-helper';
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

const router = express.Router();

// Apply RBAC context to all device monitoring routes
router.use(enhanceUserContext);

/**
 * Get latest metrics for all devices
 * Returns the most recent metric for each unique device
 */
router.get('/latest-metrics', resolveTenant, requireTenant, async (req: TenantRequest, res) => {
  try {
    const tenantId = req.tenantId!;

    // Get all metrics for this tenant, ordered by timestamp
    const metrics = await db.query.clientCollectedMetrics.findMany({
      where: eq(clientCollectedMetrics.tenantId, tenantId),
      orderBy: [desc(clientCollectedMetrics.collectionTimestamp)],
      limit: 1000, // Reasonable limit
    });

    res.json({ metrics });
  } catch (error) {
    log.error('Error fetching latest metrics:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * Get metrics history for a specific device
 */
router.get(
  '/device/:serialNumber/history',
  resolveTenant,
  requireTenant,
  async (req: TenantRequest, res) => {
    try {
      const { serialNumber } = req.params;
      const tenantId = req.tenantId!;
      const limit = parseInt(req.query.limit as string) || 100;

      const metrics = await db.query.clientCollectedMetrics.findMany({
        where: and(
          eq(clientCollectedMetrics.tenantId, tenantId),
          eq(clientCollectedMetrics.serialNumber, serialNumber),
        ),
        orderBy: [desc(clientCollectedMetrics.collectionTimestamp)],
        limit,
      });

      res.json({ metrics });
    } catch (error) {
      log.error('Error fetching device history:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },
);

/**
 * Get active alerts for all devices
 */
router.get('/active-alerts', resolveTenant, requireTenant, async (req: TenantRequest, res) => {
  try {
    const tenantId = req.tenantId!;

    const alerts = await db.query.tonerAlerts.findMany({
      where: and(eq(tonerAlerts.tenantId, tenantId), eq(tonerAlerts.status, 'active')),
      orderBy: [desc(tonerAlerts.createdAt)],
    });

    res.json({ alerts });
  } catch (error) {
    log.error('Error fetching active alerts:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * Get alerts for a specific device
 */
router.get(
  '/device/:serialNumber/alerts',
  resolveTenant,
  requireTenant,
  async (req: TenantRequest, res) => {
    try {
      const { serialNumber } = req.params;
      const tenantId = req.tenantId!;
      const includeResolved = req.query.includeResolved === 'true';

      const whereClause = includeResolved
        ? and(eq(tonerAlerts.tenantId, tenantId), eq(tonerAlerts.serialNumber, serialNumber))
        : and(
            eq(tonerAlerts.tenantId, tenantId),
            eq(tonerAlerts.serialNumber, serialNumber),
            eq(tonerAlerts.status, 'active'),
          );

      const alerts = await db.query.tonerAlerts.findMany({
        where: whereClause,
        orderBy: [desc(tonerAlerts.createdAt)],
      });

      res.json({ alerts });
    } catch (error) {
      log.error('Error fetching device alerts:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },
);

/**
 * Acknowledge an alert
 */
router.post(
  '/alerts/:alertId/acknowledge',
  resolveTenant,
  requireTenant,
  async (req: TenantRequest, res) => {
    try {
      const { alertId } = req.params;
      const tenantId = req.tenantId!;
      const userId = req.user?.id;

      // Verify alert belongs to tenant
      const alert = await db.query.tonerAlerts.findFirst({
        where: and(eq(tonerAlerts.id, parseInt(alertId)), eq(tonerAlerts.tenantId, tenantId)),
      });

      if (!alert) {
        return res.status(404).json({ message: 'Alert not found' });
      }

      // Update alert
      await db
        .update(tonerAlerts)
        .set({
          status: 'acknowledged',
          acknowledgedAt: new Date(),
          acknowledgedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(tonerAlerts.id, parseInt(alertId)));

      res.json({ message: 'Alert acknowledged successfully' });
    } catch (error) {
      log.error('Error acknowledging alert:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },
);

/**
 * Mark alert as resolved
 */
router.post(
  '/alerts/:alertId/resolve',
  resolveTenant,
  requireTenant,
  async (req: TenantRequest, res) => {
    try {
      const { alertId } = req.params;
      const tenantId = req.tenantId!;

      // Verify alert belongs to tenant
      const alert = await db.query.tonerAlerts.findFirst({
        where: and(eq(tonerAlerts.id, parseInt(alertId)), eq(tonerAlerts.tenantId, tenantId)),
      });

      if (!alert) {
        return res.status(404).json({ message: 'Alert not found' });
      }

      // Update alert
      await db
        .update(tonerAlerts)
        .set({
          status: 'resolved',
          resolvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tonerAlerts.id, parseInt(alertId)));

      res.json({ message: 'Alert resolved successfully' });
    } catch (error) {
      log.error('Error resolving alert:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },
);

/**
 * Get device statistics
 */
router.get('/statistics', resolveTenant, requireTenant, async (req: TenantRequest, res) => {
  try {
    const tenantId = req.tenantId!;

    // Get unique device count and total impressions
    const [stats] = await db
      .select({
        uniqueDevices: sql<number>`COUNT(DISTINCT ${clientCollectedMetrics.serialNumber})::int`,
        totalImpressions: sql<number>`SUM(${clientCollectedMetrics.totalImpressions})::bigint`,
        onlineDevices: sql<number>`COUNT(DISTINCT CASE WHEN ${clientCollectedMetrics.deviceStatus} = 'online' THEN ${clientCollectedMetrics.serialNumber} END)::int`,
      })
      .from(clientCollectedMetrics)
      .where(eq(clientCollectedMetrics.tenantId, tenantId));

    // Get active alert count
    const [alertStats] = await db
      .select({
        activeAlerts: sql<number>`COUNT(*)::int`,
      })
      .from(tonerAlerts)
      .where(and(eq(tonerAlerts.tenantId, tenantId), eq(tonerAlerts.status, 'active')));

    res.json({
      statistics: {
        totalDevices: stats?.uniqueDevices || 0,
        onlineDevices: stats?.onlineDevices || 0,
        totalImpressions: stats?.totalImpressions || 0,
        activeAlerts: alertStats?.activeAlerts || 0,
      },
    });
  } catch (error) {
    log.error('Error fetching statistics:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
