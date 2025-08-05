import { Router } from 'express';
import { db } from './db';
import { 
  customerPortalAccess, 
  customerServiceRequests, 
  customerMeterSubmissions,
  customerSupplyOrders,
  customerPayments,
  customerNotifications,
  customerPortalActivityLog
} from '../shared/schema';
import { eq, and, desc } from 'drizzle-orm';

// Use the same auth pattern as main routes file
const requireAuth = (req: any, res: any, next: any) => {
  // Check for session-based auth (legacy) or user object (current)
  const isAuthenticated =
    req.session?.userId || req.user?.id || req.user?.claims?.sub;

  if (!isAuthenticated) {
    return res.status(401).json({ message: "Authentication required" });
  }

  // Add user context for backwards compatibility
  if (!req.user) {
    req.user = {
      id: req.session.userId,
      tenantId: req.session.tenantId || req.user?.tenantId,
    };
  } else if (!req.user.tenantId && !req.user.id) {
    // If we have user claims but no structured user object, build it
    req.user = {
      id: req.user.claims?.sub || req.user.id,
      tenantId: req.user.tenantId || req.session?.tenantId,
    };
  }

  next();
};

const router = Router();

// Customer Portal Dashboard - Get portal statistics
router.get('/dashboard/stats', requireAuth, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID required" });
    }

    // Get total counts for dashboard metrics
    const [
      portalUsersCount,
      serviceRequestsCount,
      meterSubmissionsCount,
      supplyOrdersCount,
      paymentsCount,
      notificationsCount
    ] = await Promise.all([
      db.select().from(customerPortalAccess).where(eq(customerPortalAccess.tenantId, tenantId)),
      db.select().from(customerServiceRequests).where(eq(customerServiceRequests.tenantId, tenantId)),
      db.select().from(customerMeterSubmissions).where(eq(customerMeterSubmissions.tenantId, tenantId)),
      db.select().from(customerSupplyOrders).where(eq(customerSupplyOrders.tenantId, tenantId)),
      db.select().from(customerPayments).where(eq(customerPayments.tenantId, tenantId)),
      db.select().from(customerNotifications).where(eq(customerNotifications.tenantId, tenantId))
    ]);

    const stats = {
      totalPortalUsers: portalUsersCount.length,
      totalServiceRequests: serviceRequestsCount.length,
      totalMeterSubmissions: meterSubmissionsCount.length,
      totalSupplyOrders: supplyOrdersCount.length,
      totalPayments: paymentsCount.length,
      totalNotifications: notificationsCount.length,
      activeUsers: portalUsersCount.filter(user => user.status === 'active').length,
      pendingRequests: serviceRequestsCount.filter(request => request.status === 'submitted').length,
      unreadNotifications: notificationsCount.filter(notification => !notification.isPortalRead).length
    };

    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error fetching customer portal stats:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch customer portal statistics',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get all portal users for a tenant
router.get('/users', requireAuth, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID required" });
    }

    const users = await db
      .select()
      .from(customerPortalAccess)
      .where(eq(customerPortalAccess.tenantId, tenantId))
      .orderBy(desc(customerPortalAccess.createdAt));

    res.json({ success: true, users });
  } catch (error) {
    console.error('Error fetching customer portal users:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch portal users',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get recent service requests
router.get('/service-requests/recent', requireAuth, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID required" });
    }

    const limit = parseInt(req.query.limit as string) || 10;
    
    const requests = await db
      .select()
      .from(customerServiceRequests)
      .where(eq(customerServiceRequests.tenantId, tenantId))
      .orderBy(desc(customerServiceRequests.submittedAt))
      .limit(limit);

    res.json({ success: true, requests });
  } catch (error) {
    console.error('Error fetching recent service requests:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch recent service requests',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get recent meter submissions
router.get('/meter-submissions/recent', requireAuth, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID required" });
    }

    const limit = parseInt(req.query.limit as string) || 10;
    
    const submissions = await db
      .select()
      .from(customerMeterSubmissions)
      .where(eq(customerMeterSubmissions.tenantId, tenantId))
      .orderBy(desc(customerMeterSubmissions.submissionDate))
      .limit(limit);

    res.json({ success: true, submissions });
  } catch (error) {
    console.error('Error fetching recent meter submissions:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch recent meter submissions',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Test database connectivity
router.get('/test', requireAuth, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    
    // Test all customer portal tables exist
    const tableTests = await Promise.all([
      db.select().from(customerPortalAccess).limit(1),
      db.select().from(customerServiceRequests).limit(1),
      db.select().from(customerMeterSubmissions).limit(1),
      db.select().from(customerSupplyOrders).limit(1),
      db.select().from(customerPayments).limit(1),
      db.select().from(customerNotifications).limit(1),
      db.select().from(customerPortalActivityLog).limit(1)
    ]);

    res.json({ 
      success: true, 
      message: 'Customer portal database tables are properly configured',
      tablesVerified: [
        'customer_portal_access',
        'customer_service_requests', 
        'customer_meter_submissions',
        'customer_supply_orders',
        'customer_payments',
        'customer_notifications',
        'customer_portal_activity_log'
      ],
      tenantId
    });
  } catch (error) {
    console.error('Error testing customer portal database:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Database test failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;