import { Router } from 'express';
import { db } from './db';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-mobile-technician');

import {
  phoneInTickets,
  equipment,
  businessRecords,
  users,
  servicePhotos,
  locationHistory,
} from '@shared/schema';
import { eq, and, or, gte, desc, inArray, count } from 'drizzle-orm';
import multer from 'multer';
import { storage } from './storage';
import { getUserId, getTenantId } from './utils/auth-helpers';

const router = Router();

// Configure multer for photo uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

/**
 * GET /api/mobile/sync
 *
 * Initial data sync for offline usage
 * Downloads all data needed for a technician to work offline
 */
router.get('/sync', async (req: any, res) => {
  try {
    const tenantId = getTenantId(req);
    const technicianId = getUserId(req);
    const since = req.query.since; // Last sync timestamp for incremental sync

    // Get assigned tickets (open or in progress)
    const tickets = await db.query.phoneInTickets.findMany({
      where: and(
        eq(phoneInTickets.tenantId, tenantId),
        or(
          eq(phoneInTickets.assignedTo, technicianId),
          eq(phoneInTickets.enhancedTicketStatus, 'new'),
        ),
        since ? gte(phoneInTickets.updatedAt, new Date(since)) : undefined,
      ),
      with: {
        customer: true,
        equipment: true,
      },
      limit: 100, // Reasonable limit for mobile
    });

    // Get equipment the technician might service
    const equipmentList = await db.query.equipment.findMany({
      where: eq(equipment.tenantId, tenantId),
      limit: 500,
    });

    // Get customers
    const customers = await db.query.businessRecords.findMany({
      where: eq(businessRecords.tenantId, tenantId),
      limit: 500,
    });

    // Get technician's own profile
    const technician = await db.query.users.findFirst({
      where: and(eq(users.id, technicianId), eq(users.tenantId, tenantId)),
    });

    res.json({
      tickets,
      equipment: equipmentList,
      customers,
      technician,
      syncTimestamp: new Date().toISOString(),
      hasMore: false, // For pagination in future
    });
  } catch (error) {
    log.error('[MobileAPI] Sync error:', error);
    res.status(500).json({
      message: 'Sync failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/mobile/tickets
 *
 * Get tickets assigned to this technician
 */
router.get('/tickets', async (req: any, res) => {
  try {
    const { tenantId } = req;
    const technicianId = req.user?.id || req.user?.claims?.sub || req.session?.userId;
    const status = req.query.status; // Filter by status

    let whereConditions: any = and(
      eq(phoneInTickets.tenantId, tenantId),
      eq(phoneInTickets.assignedTo, technicianId),
    );

    if (status) {
      whereConditions = and(whereConditions, eq(phoneInTickets.enhancedTicketStatus, status));
    }

    const tickets = await db.query.phoneInTickets.findMany({
      where: whereConditions,
      with: {
        customer: true,
        equipment: true,
      },
      orderBy: [desc(phoneInTickets.createdAt)],
      limit: 50,
    });

    res.json({ tickets });
  } catch (error) {
    log.error('[MobileAPI] Error fetching tickets:', error);
    res.status(500).json({ message: 'Failed to fetch tickets' });
  }
});

/**
 * GET /api/mobile/tickets/:id
 *
 * Get single ticket details
 */
router.get('/tickets/:id', async (req: any, res) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;

    const ticket = await db.query.phoneInTickets.findFirst({
      where: and(eq(phoneInTickets.id, id), eq(phoneInTickets.tenantId, tenantId)),
      with: {
        customer: true,
        equipment: true,
      },
    });

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Get photos for this ticket
    const photos = await db.query.servicePhotos.findMany({
      where: eq(servicePhotos.ticketId, id),
      orderBy: [desc(servicePhotos.capturedAt)],
    });

    res.json({ ticket, photos });
  } catch (error) {
    log.error('[MobileAPI] Error fetching ticket:', error);
    res.status(500).json({ message: 'Failed to fetch ticket' });
  }
});

/**
 * PATCH /api/mobile/tickets/:id
 *
 * Update ticket from mobile app
 */
router.patch('/tickets/:id', async (req: any, res) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;
    const { status, notes, partsUsed, timeSpent, resolution } = req.body;

    const updates: any = {
      updatedAt: new Date(),
    };

    if (status) updates.enhancedTicketStatus = status;
    if (notes) updates.notes = notes;
    if (partsUsed) updates.partsUsed = partsUsed;
    if (timeSpent) updates.timeSpent = timeSpent;
    if (resolution) updates.resolution = resolution;

    const [ticket] = await db
      .update(phoneInTickets)
      .set(updates)
      .where(and(eq(phoneInTickets.id, id), eq(phoneInTickets.tenantId, tenantId)))
      .returning();

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    res.json({ ticket });
  } catch (error) {
    log.error('[MobileAPI] Ticket update error:', error);
    res.status(500).json({ message: 'Update failed' });
  }
});

/**
 * POST /api/mobile/tickets/:id/start
 *
 * Mark ticket as started (technician arrived on site)
 */
router.post('/tickets/:id/start', async (req: any, res) => {
  try {
    const { tenantId } = req;
    const technicianId = req.user?.id || req.user?.claims?.sub || req.session?.userId;
    const { id } = req.params;
    const { latitude, longitude } = req.body;

    // Update ticket status
    const [ticket] = await db
      .update(phoneInTickets)
      .set({
        enhancedTicketStatus: 'in_progress',
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(phoneInTickets.id, id), eq(phoneInTickets.tenantId, tenantId)))
      .returning();

    // Log location if provided
    if (latitude && longitude) {
      await db.insert(locationHistory).values({
        userId: technicianId,
        ticketId: id,
        tenantId,
        latitude,
        longitude,
        accuracy: req.body.accuracy || null,
        eventType: 'check_in',
        timestamp: new Date(),
      });
    }

    res.json({ ticket });
  } catch (error) {
    log.error('[MobileAPI] Start ticket error:', error);
    res.status(500).json({ message: 'Failed to start ticket' });
  }
});

/**
 * POST /api/mobile/tickets/:id/complete
 *
 * Complete ticket with signature
 */
router.post('/tickets/:id/complete', async (req: any, res) => {
  try {
    const { tenantId } = req;
    const technicianId = req.user?.id || req.user?.claims?.sub || req.session?.userId;
    const { id } = req.params;
    const {
      signature,
      signatureName,
      signatureTitle,
      resolution,
      partsUsed,
      timeSpent,
      latitude,
      longitude,
    } = req.body;

    // Update ticket
    const [ticket] = await db
      .update(phoneInTickets)
      .set({
        enhancedTicketStatus: 'completed',
        completedAt: new Date(),
        resolution,
        partsUsed,
        timeSpent,
        customerSignature: signature,
        customerSignatureName: signatureName,
        customerSignatureTitle: signatureTitle,
        updatedAt: new Date(),
      })
      .where(and(eq(phoneInTickets.id, id), eq(phoneInTickets.tenantId, tenantId)))
      .returning();

    // Log completion location
    if (latitude && longitude) {
      await db.insert(locationHistory).values({
        userId: technicianId,
        ticketId: id,
        tenantId,
        latitude,
        longitude,
        accuracy: req.body.accuracy || null,
        eventType: 'check_out',
        timestamp: new Date(),
      });
    }

    // TODO: Generate PDF service report
    // TODO: Send email to customer

    res.json({
      ticket,
      message: 'Ticket completed successfully',
    });
  } catch (error) {
    log.error('[MobileAPI] Complete ticket error:', error);
    res.status(500).json({ message: 'Failed to complete ticket' });
  }
});

/**
 * POST /api/mobile/tickets/:id/photos
 *
 * Upload photos for ticket
 */
router.post('/tickets/:id/photos', upload.array('photos', 10), async (req: any, res) => {
  try {
    const { tenantId } = req;
    const technicianId = req.user?.id || req.user?.claims?.sub || req.session?.userId;
    const { id } = req.params;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'No photos uploaded' });
    }

    const uploadedPhotos = [];

    // Upload each photo to storage
    for (const file of files) {
      const filename = `tickets/${id}/${Date.now()}-${file.originalname}`;

      // Upload to storage (Google Cloud Storage or local)
      const url = await storage.upload(file.buffer, filename, {
        contentType: file.mimetype,
      });

      // Save photo record to database
      const [photo] = await db
        .insert(servicePhotos)
        .values({
          ticketId: id,
          tenantId,
          uploadedBy: technicianId,
          filename,
          url,
          mimeType: file.mimetype,
          size: file.size,
          caption: req.body[`caption_${file.originalname}`] || null,
          capturedAt: new Date(),
        })
        .returning();

      uploadedPhotos.push(photo);
    }

    res.json({
      photos: uploadedPhotos,
      message: `${uploadedPhotos.length} photo(s) uploaded successfully`,
    });
  } catch (error) {
    log.error('[MobileAPI] Photo upload error:', error);
    res.status(500).json({ message: 'Photo upload failed' });
  }
});

/**
 * POST /api/mobile/tickets/:id/notes
 *
 * Add note to ticket
 */
router.post('/tickets/:id/notes', async (req: any, res) => {
  try {
    const { tenantId } = req;
    const technicianId = req.user?.id || req.user?.claims?.sub || req.session?.userId;
    const { id } = req.params;
    const { note, isInternal } = req.body;

    if (!note) {
      return res.status(400).json({ message: 'Note is required' });
    }

    // Get current notes
    const ticket = await db.query.phoneInTickets.findFirst({
      where: and(eq(phoneInTickets.id, id), eq(phoneInTickets.tenantId, tenantId)),
    });

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Append new note
    const timestamp = new Date().toISOString();
    const newNote = `[${timestamp}] ${req.session.user?.name || 'Technician'}: ${note}${isInternal ? ' (Internal)' : ''}`;
    const updatedNotes = ticket.notes ? `${ticket.notes}\n\n${newNote}` : newNote;

    // Update ticket
    const [updated] = await db
      .update(phoneInTickets)
      .set({
        notes: updatedNotes,
        updatedAt: new Date(),
      })
      .where(eq(phoneInTickets.id, id))
      .returning();

    res.json({
      ticket: updated,
      message: 'Note added successfully',
    });
  } catch (error) {
    log.error('[MobileAPI] Add note error:', error);
    res.status(500).json({ message: 'Failed to add note' });
  }
});

/**
 * GET /api/mobile/equipment/:id
 *
 * Get equipment details (for QR code scanning)
 */
router.get('/equipment/:id', async (req: any, res) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;

    const equipmentItem = await db.query.equipment.findFirst({
      where: and(eq(equipment.id, id), eq(equipment.tenantId, tenantId)),
      with: {
        customer: true,
      },
    });

    if (!equipmentItem) {
      return res.status(404).json({ message: 'Equipment not found' });
    }

    // Get recent service history for this equipment
    const recentTickets = await db.query.phoneInTickets.findMany({
      where: and(eq(phoneInTickets.equipmentId, id), eq(phoneInTickets.tenantId, tenantId)),
      orderBy: [desc(phoneInTickets.createdAt)],
      limit: 5,
    });

    res.json({
      equipment: equipmentItem,
      recentTickets,
    });
  } catch (error) {
    log.error('[MobileAPI] Equipment fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch equipment' });
  }
});

/**
 * POST /api/mobile/equipment/scan
 *
 * Look up equipment by QR code or serial number
 */
router.post('/equipment/scan', async (req: any, res) => {
  try {
    const { tenantId } = req;
    const { qrCode, serialNumber } = req.body;

    if (!qrCode && !serialNumber) {
      return res.status(400).json({ message: 'QR code or serial number required' });
    }

    // Try to find equipment by ID (from QR code) or serial number
    const equipmentItem = await db.query.equipment.findFirst({
      where: and(
        eq(equipment.tenantId, tenantId),
        or(
          qrCode ? eq(equipment.id, qrCode) : undefined,
          serialNumber ? eq(equipment.serialNumber, serialNumber) : undefined,
        ),
      ),
      with: {
        customer: true,
      },
    });

    if (!equipmentItem) {
      return res.status(404).json({ message: 'Equipment not found' });
    }

    res.json({ equipment: equipmentItem });
  } catch (error) {
    log.error('[MobileAPI] Equipment scan error:', error);
    res.status(500).json({ message: 'Scan failed' });
  }
});

/**
 * POST /api/mobile/location
 *
 * Track technician location (for GPS tracking)
 */
router.post('/location', async (req: any, res) => {
  try {
    const { tenantId } = req;
    const technicianId = req.user?.id || req.user?.claims?.sub || req.session?.userId;
    const { latitude, longitude, accuracy, ticketId, eventType } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ message: 'Latitude and longitude required' });
    }

    await db.insert(locationHistory).values({
      userId: technicianId,
      ticketId: ticketId || null,
      tenantId,
      latitude,
      longitude,
      accuracy: accuracy || null,
      eventType: eventType || 'location_update',
      timestamp: new Date(),
    });

    res.json({ message: 'Location tracked successfully' });
  } catch (error) {
    log.error('[MobileAPI] Location tracking error:', error);
    res.status(500).json({ message: 'Location tracking failed' });
  }
});

/**
 * GET /api/mobile/stats
 *
 * Get technician performance stats
 */
router.get('/stats', async (req: any, res) => {
  try {
    const { tenantId } = req;
    const technicianId = req.user?.id || req.user?.claims?.sub || req.session?.userId;

    // Get counts by status
    const stats = await db
      .select({
        status: phoneInTickets.enhancedTicketStatus,
        count: count(),
      })
      .from(phoneInTickets)
      .where(
        and(eq(phoneInTickets.tenantId, tenantId), eq(phoneInTickets.assignedTo, technicianId)),
      )
      .groupBy(phoneInTickets.enhancedTicketStatus);

    const statsByStatus = stats.reduce((acc: any, stat: any) => {
      acc[stat.status] = Number(stat.count);
      return acc;
    }, {});

    res.json({
      open: statsByStatus.new || 0,
      inProgress: statsByStatus.in_progress || 0,
      completed: statsByStatus.completed || 0,
      total: Object.values(statsByStatus).reduce((sum: number, count: any) => sum + count, 0),
    });
  } catch (error) {
    log.error('[MobileAPI] Stats error:', error);
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
});

export default router;
