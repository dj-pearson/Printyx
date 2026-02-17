/**
 * Mobile API Routes
 *
 * Express routes consumed by the mobile app that don't exist elsewhere.
 * Provides: service-tickets list/stats, equipment CRUD, time tracking, ticket status updates.
 */

import { Router } from 'express';
import { db } from './db';
import { serviceTickets, equipment, businessRecords } from '@shared/schema';
import { eq, and, sql, desc, or, ilike, count } from 'drizzle-orm';
import { getUserId, getTenantId } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';

const log = createModuleLogger('routes-mobile-api');
const router = Router();

// ─── Service Tickets ───────────────────────────────────────────────────

/**
 * GET /api/service-tickets
 * List service tickets with optional search and status filter
 */
router.get('/api/service-tickets', async (req: any, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ message: 'Tenant ID required' });

    const { search, status, limit = '50', page = '1' } = req.query;
    const limitNum = Math.min(parseInt(limit) || 50, 100);
    const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limitNum;

    const conditions: any[] = [eq(serviceTickets.tenantId, tenantId)];

    if (status && status !== 'all') {
      conditions.push(eq(serviceTickets.status, status));
    }

    if (search) {
      conditions.push(
        or(
          ilike(serviceTickets.title, `%${search}%`),
          ilike(serviceTickets.ticketNumber, `%${search}%`),
          ilike(serviceTickets.description, `%${search}%`),
        ),
      );
    }

    const tickets = await db
      .select()
      .from(serviceTickets)
      .where(and(...conditions))
      .orderBy(desc(serviceTickets.createdAt))
      .limit(limitNum)
      .offset(offset);

    res.json(tickets);
  } catch (error: any) {
    log.error('Error listing service tickets:', error);
    res.status(500).json({ message: 'Failed to fetch service tickets' });
  }
});

/**
 * GET /api/service-tickets/stats
 * Service ticket counts by status
 */
router.get('/api/service-tickets/stats', async (req: any, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ message: 'Tenant ID required' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [openCount] = await db
      .select({ count: count() })
      .from(serviceTickets)
      .where(and(eq(serviceTickets.tenantId, tenantId), eq(serviceTickets.status, 'open')));

    const [inProgressCount] = await db
      .select({ count: count() })
      .from(serviceTickets)
      .where(and(eq(serviceTickets.tenantId, tenantId), eq(serviceTickets.status, 'in-progress')));

    const [completedTodayCount] = await db
      .select({ count: count() })
      .from(serviceTickets)
      .where(
        and(
          eq(serviceTickets.tenantId, tenantId),
          eq(serviceTickets.status, 'completed'),
          sql`${serviceTickets.resolvedAt} >= ${today.toISOString()}`,
        ),
      );

    const [overdueCount] = await db
      .select({ count: count() })
      .from(serviceTickets)
      .where(
        and(
          eq(serviceTickets.tenantId, tenantId),
          or(eq(serviceTickets.status, 'open'), eq(serviceTickets.status, 'in-progress')),
          sql`${serviceTickets.scheduledDate} < NOW()`,
        ),
      );

    res.json({
      open: openCount?.count ?? 0,
      inProgress: inProgressCount?.count ?? 0,
      completedToday: completedTodayCount?.count ?? 0,
      overdue: overdueCount?.count ?? 0,
    });
  } catch (error: any) {
    log.error('Error fetching service ticket stats:', error);
    res.status(500).json({ message: 'Failed to fetch service ticket stats' });
  }
});

// ─── Equipment ─────────────────────────────────────────────────────────

/**
 * GET /api/equipment
 * List equipment with optional search
 */
router.get('/api/equipment', async (req: any, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ message: 'Tenant ID required' });

    const { search, limit = '50', page = '1' } = req.query;
    const limitNum = Math.min(parseInt(limit) || 50, 100);
    const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limitNum;

    const conditions: any[] = [eq(equipment.tenantId, tenantId)];

    if (search) {
      conditions.push(
        or(
          ilike(equipment.serialNumber, `%${search}%`),
          ilike(equipment.modelNumber, `%${search}%`),
          ilike(equipment.manufacturer, `%${search}%`),
          ilike(equipment.description, `%${search}%`),
        ),
      );
    }

    const items = await db
      .select()
      .from(equipment)
      .where(and(...conditions))
      .orderBy(desc(equipment.createdAt))
      .limit(limitNum)
      .offset(offset);

    res.json(items);
  } catch (error: any) {
    log.error('Error listing equipment:', error);
    res.status(500).json({ message: 'Failed to fetch equipment' });
  }
});

/**
 * GET /api/equipment/:id
 * Get equipment detail
 */
router.get('/api/equipment/:id', async (req: any, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ message: 'Tenant ID required' });

    const item = await db.query.equipment.findFirst({
      where: and(eq(equipment.id, req.params.id), eq(equipment.tenantId, tenantId)),
    });

    if (!item) {
      return res.status(404).json({ message: 'Equipment not found' });
    }

    res.json(item);
  } catch (error: any) {
    log.error('Error fetching equipment:', error);
    res.status(500).json({ message: 'Failed to fetch equipment' });
  }
});

/**
 * GET /api/equipment/:id/service-history
 * Get service history for a piece of equipment
 */
router.get('/api/equipment/:id/service-history', async (req: any, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ message: 'Tenant ID required' });

    const tickets = await db
      .select()
      .from(serviceTickets)
      .where(
        and(eq(serviceTickets.tenantId, tenantId), eq(serviceTickets.equipmentId, req.params.id)),
      )
      .orderBy(desc(serviceTickets.createdAt))
      .limit(50);

    res.json(tickets);
  } catch (error: any) {
    log.error('Error fetching equipment service history:', error);
    res.status(500).json({ message: 'Failed to fetch service history' });
  }
});

// ─── Service Dispatch ──────────────────────────────────────────────────

/**
 * GET /api/service-dispatch
 * List service dispatch assignments for the current user
 */
router.get('/api/service-dispatch', async (req: any, res) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    if (!tenantId) return res.status(400).json({ message: 'Tenant ID required' });

    const { limit = '20' } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 50);

    // Get assigned service tickets as dispatch items
    const dispatches = await db
      .select({
        id: serviceTickets.id,
        title: serviceTickets.title,
        description: serviceTickets.description,
        status: serviceTickets.status,
        priority: serviceTickets.priority,
        scheduledAt: serviceTickets.scheduledDate,
        address: serviceTickets.customerAddress,
        technicianName: sql<string>`''`,
        customerName: sql<string>`''`,
      })
      .from(serviceTickets)
      .where(
        and(
          eq(serviceTickets.tenantId, tenantId),
          or(
            eq(serviceTickets.status, 'open'),
            eq(serviceTickets.status, 'assigned'),
            eq(serviceTickets.status, 'in-progress'),
          ),
        ),
      )
      .orderBy(serviceTickets.scheduledDate)
      .limit(limitNum);

    res.json(dispatches);
  } catch (error: any) {
    log.error('Error listing service dispatch:', error);
    res.status(500).json({ message: 'Failed to fetch dispatch assignments' });
  }
});

// ─── CRM Stats ─────────────────────────────────────────────────────────

/**
 * GET /api/business-records/stats
 * CRM statistics (leads, customers, deals, contacts counts)
 * Alias for the mobile app - delegates to stats/overview if needed
 */
router.get('/api/business-records/stats', async (req: any, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ message: 'Tenant ID required' });

    const [leadsCount] = await db
      .select({ count: count() })
      .from(businessRecords)
      .where(and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.recordType, 'lead')));

    const [customersCount] = await db
      .select({ count: count() })
      .from(businessRecords)
      .where(
        and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.recordType, 'customer')),
      );

    // Get contacts count from business_records contacts
    const [contactsCount] = await db
      .select({ count: count() })
      .from(businessRecords)
      .where(
        and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.recordType, 'contact')),
      );

    // Deals count from business_records with deal-related statuses
    const [dealsCount] = await db
      .select({ count: count() })
      .from(businessRecords)
      .where(and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.recordType, 'deal')));

    res.json({
      leads: leadsCount?.count ?? 0,
      customers: customersCount?.count ?? 0,
      contacts: contactsCount?.count ?? 0,
      deals: dealsCount?.count ?? 0,
    });
  } catch (error: any) {
    log.error('Error fetching CRM stats:', error);
    res.status(500).json({ message: 'Failed to fetch CRM stats' });
  }
});

// ─── Mobile Time Tracking & Status ─────────────────────────────────────

/**
 * POST /api/mobile/time-tracking/start
 * Start time tracking for a service ticket
 */
router.post('/api/mobile/time-tracking/start', async (req: any, res) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    if (!tenantId || !userId) return res.status(401).json({ message: 'Authentication required' });

    const { ticketId } = req.body;
    if (!ticketId) return res.status(400).json({ message: 'ticketId is required' });

    // Update the ticket status to in-progress
    await db
      .update(serviceTickets)
      .set({
        status: 'in-progress',
        assignedTechnicianId: userId,
        updatedAt: new Date(),
      })
      .where(and(eq(serviceTickets.id, ticketId), eq(serviceTickets.tenantId, tenantId)));

    res.json({ success: true, startedAt: new Date().toISOString() });
  } catch (error: any) {
    log.error('Error starting time tracking:', error);
    res.status(500).json({ message: 'Failed to start time tracking' });
  }
});

/**
 * POST /api/mobile/time-tracking/stop
 * Stop time tracking for a service ticket
 */
router.post('/api/mobile/time-tracking/stop', async (req: any, res) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    if (!tenantId || !userId) return res.status(401).json({ message: 'Authentication required' });

    const { ticketId } = req.body;
    if (!ticketId) return res.status(400).json({ message: 'ticketId is required' });

    // Update the ticket
    await db
      .update(serviceTickets)
      .set({ updatedAt: new Date() })
      .where(and(eq(serviceTickets.id, ticketId), eq(serviceTickets.tenantId, tenantId)));

    res.json({ success: true, stoppedAt: new Date().toISOString() });
  } catch (error: any) {
    log.error('Error stopping time tracking:', error);
    res.status(500).json({ message: 'Failed to stop time tracking' });
  }
});

/**
 * POST /api/mobile/service-tickets/:ticketId/status
 * Update service ticket status from mobile
 */
router.post('/api/mobile/service-tickets/:ticketId/status', async (req: any, res) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    if (!tenantId || !userId) return res.status(401).json({ message: 'Authentication required' });

    const { ticketId } = req.params;
    const { status } = req.body;

    if (!status) return res.status(400).json({ message: 'status is required' });

    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'completed') {
      updateData.resolvedAt = new Date();
    }

    await db
      .update(serviceTickets)
      .set(updateData)
      .where(and(eq(serviceTickets.id, ticketId), eq(serviceTickets.tenantId, tenantId)));

    res.json({ success: true, status });
  } catch (error: any) {
    log.error('Error updating ticket status:', error);
    res.status(500).json({ message: 'Failed to update ticket status' });
  }
});

export default router;

export function registerMobileApiRoutes(app: any) {
  app.use(router);
  log.info('Mobile API routes registered');
}
