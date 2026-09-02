/**
 * Mobile API Routes
 *
 * Express routes consumed by the mobile app that don't exist elsewhere.
 * Provides: service-tickets list/stats, equipment CRUD, time tracking, ticket status updates.
 */

import { Router, type Request, type Response } from 'express';
import { db } from './db';
import {
  serviceTickets,
  equipment,
  businessRecords,
  technicians,
  meterReadings,
} from '@shared/schema';
import { equipmentLifecycle } from '@shared/equipment-schema';
import { lifecycleRowForReceivedUnit } from './lib/equipment-serialization';
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
// WF-V-01: GET /api/service-tickets and GET /api/service-tickets/stats used to
// live here, and they were the reason the dispatcher queue looked right in dev
// and wrong in production. This handler joined business_records, equipment and
// technicians with Drizzle; supabase/functions/service-tickets/ - which is what
// production reaches - joined none of them, so equipmentModel and
// assignedTechnician were blank on every ticket, and so was customerName,
// because the edge function emitted customer_name and ServiceHub.tsx reads
// customerName. AUDIT-013 fixed this half and nobody connected the two.
//
// /api/service-tickets is in crmProxies now and the edge function does all three
// joins, so both hosts answer the same shape from one implementation. The
// /:id/analysis route (routes-service-analysis.ts) is registered BEFORE the proxy
// in routes-registry.ts, because the edge function does not serve it.
//
// The two /stats implementations disagreed about the status vocabulary -
// 'in-progress' here, 'in_progress' there, and 'completed' counted as resolved
// only here - so the edge version now counts both spellings. See the WF-V-01
// note for the vocabulary question itself.

// ─── Equipment ─────────────────────────────────────────────────────────

/**
 * GET /api/equipment
 * List equipment with optional search
 */
router.get('/api/equipment', async (req: any, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ message: 'Tenant ID required' });

    const { search, customerId, limit = '50', page = '1' } = req.query;
    const limitNum = Math.min(parseInt(limit) || 50, 100);
    const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limitNum;

    const conditions: any[] = [eq(equipment.tenantId, tenantId)];

    // COP-M05: the equipment edge function has honoured ?customerId= all along
    // and this handler ignored it, so a picker scoped to one account showed the
    // whole tenant's fleet in dev and the right fleet in production.
    if (customerId) {
      conditions.push(eq(equipment.customerId, customerId as string));
    }

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
 * POST /api/equipment
 *
 * WF-L-04. The edge function has served this since it was written and Express
 * served only GETs, so `/api/equipment` being both-divergent meant a create would
 * have worked in production and 404'd in dev - the usual divergence, inverted.
 * The prefix cannot simply be proxied: the edge function 404s any sub-resource it
 * does not know, and Express owns /:id/service-history and the QR routes.
 *
 * Column-for-column the same write the edge function makes, including the two
 * links migration 0077 added. customer_id is optional now: a unit received into
 * the warehouse belongs to nobody until it is delivered.
 */
router.post('/api/equipment', async (req: any, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ message: 'Tenant ID required' });

    const body = req.body ?? {};
    const serialNumber = String(body.serialNumber ?? body.serial_number ?? '').trim();
    if (!serialNumber) {
      // The key meter readings, service tickets and contracts all join on.
      return res.status(400).json({ message: 'serialNumber is required' });
    }

    const [created] = await db
      .insert(equipment)
      .values({
        tenantId,
        customerId: body.customerId ?? body.customer_id ?? null,
        serialNumber,
        modelNumber: body.modelNumber ?? body.model_number ?? null,
        manufacturer: body.manufacturer ?? null,
        description: body.description ?? null,
        assetTag: body.assetTag ?? body.asset_tag ?? null,
        locationDescription: body.locationDescription ?? body.location_description ?? null,
        installDate: body.installDate ? new Date(body.installDate) : null,
        ipAddress: body.ipAddress ?? body.ip_address ?? null,
        meterType: body.meterType ?? body.meter_type ?? null,
        equipmentStatus: body.equipmentStatus ?? body.equipment_status ?? 'active',
        purchaseOrderId: body.purchaseOrderId ?? body.purchase_order_id ?? null,
        purchaseOrderItemId: body.purchaseOrderItemId ?? body.purchase_order_item_id ?? null,
      })
      .returning();

    // WF-L-04: a unit received against a purchase order enters the lifecycle at
    // stage `received`. Best-effort, exactly as on the other host: the equipment
    // row is the thing that had to exist.
    if (created?.purchaseOrderId) {
      try {
        await db.insert(equipmentLifecycle).values(
          lifecycleRowForReceivedUnit(
            {
              tenant_id: tenantId,
              serial_number: created.serialNumber,
              manufacturer: created.manufacturer,
              model_number: created.modelNumber,
              customer_id: created.customerId,
              location_description: created.locationDescription,
              purchase_order_id: created.purchaseOrderId,
            },
            created.id,
          ) as any,
        );
      } catch (lifecycleError) {
        log.error('Error creating equipment lifecycle row:', lifecycleError);
      }
    }

    res.status(201).json(created);
  } catch (error: any) {
    // A duplicate serial is a real answer, not a fault: the column is unique.
    if (String(error?.code) === '23505') {
      return res.status(409).json({ message: 'That serial number is already registered' });
    }
    log.error('Error creating equipment:', error);
    res.status(500).json({ message: 'Failed to create equipment' });
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

/**
 * GET /api/equipment/:id/meter-readings
 * Meter readings for one machine, newest first.
 *
 * PA-052: /api/equipment is not proxied, so dev is Express and prod is the
 * equipment edge function. This mirrors the branch added there — without it
 * the tab 404s in dev and answers 200 with the equipment ROW in prod.
 */
router.get('/api/equipment/:id/meter-readings', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ message: 'Tenant ID required' });

    const limitNum = Math.min(parseInt(String(req.query.limit ?? '')) || 50, 200);

    const readings = await db
      .select()
      .from(meterReadings)
      .where(
        and(eq(meterReadings.tenantId, tenantId), eq(meterReadings.equipmentId, req.params.id)),
      )
      .orderBy(desc(meterReadings.readingDate))
      .limit(limitNum);

    res.json(readings);
  } catch (error) {
    log.error('Error fetching equipment meter readings:', error);
    res.status(500).json({ message: 'Failed to fetch meter readings' });
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
// GET /api/business-records/stats was removed here (PROD-008b). The
// business-records edge function serves it — its branch is keyed on
// recordId === 'stats' and its comment names both /stats and /stats/overview.

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
