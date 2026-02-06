import express, { Request, Response } from 'express';
import { storage } from '../storage';
import { z } from 'zod';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('gps-tracking-routes');

import {
  insertTechnicianLocationSchema,
  insertLocationHistorySchema,
  insertRouteAssignmentSchema,
  insertRouteDeviationSchema,
  insertEtaCalculationSchema,
  insertGeofenceSchema,
  insertGeofenceEventSchema,
} from '@shared/gps-tracking-schema';

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

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// ==================== Technician Locations ====================

// GET /api/gps/technicians/locations - Get all active technician locations
router.get('/technicians/locations', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const locations = await storage.getActiveTechnicianLocations(user.tenantId);
    res.json(locations);
  } catch (error) {
    log.error('Get active technician locations error:', error);
    res.status(500).json({ error: 'Failed to fetch active technician locations' });
  }
});

// GET /api/gps/technicians/:id/location - Get current location for specific technician
router.get('/technicians/:id/location', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const location = await storage.getTechnicianLocation(req.params.id, user.tenantId);

    if (!location) {
      return res.status(404).json({ error: 'Technician location not found' });
    }

    res.json(location);
  } catch (error) {
    log.error('Get technician location error:', error);
    res.status(500).json({ error: 'Failed to fetch technician location' });
  }
});

// PUT /api/gps/technicians/:id/location - Update technician location (from mobile app)
router.put('/technicians/:id/location', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const data = insertTechnicianLocationSchema.parse(req.body);
    const location = await storage.updateTechnicianLocation(req.params.id, {
      ...data,
      tenantId: user.tenantId,
      technicianId: req.params.id,
    });

    res.json(location);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Update technician location error:', error);
    res.status(500).json({ error: 'Failed to update technician location' });
  }
});

// GET /api/gps/technicians/status/:status - Get technicians by status
router.get('/technicians/status/:status', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const locations = await storage.getTechnicianLocationsByStatus(
      user.tenantId,
      req.params.status,
    );

    res.json(locations);
  } catch (error) {
    log.error('Get technicians by status error:', error);
    res.status(500).json({ error: 'Failed to fetch technicians by status' });
  }
});

// GET /api/gps/technicians/nearby - Find nearby technicians (query params: lat, lng, radius)
router.get('/technicians/nearby', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { lat, lng, radius } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const latitude = parseFloat(lat as string);
    const longitude = parseFloat(lng as string);
    const radiusMeters = radius ? parseFloat(radius as string) : 5000; // Default 5km

    if (isNaN(latitude) || isNaN(longitude) || isNaN(radiusMeters)) {
      return res.status(400).json({ error: 'Invalid coordinates or radius' });
    }

    const allLocations = await storage.getActiveTechnicianLocations(user.tenantId);

    // Filter locations within radius
    const nearbyTechnicians = allLocations
      .map((location) => ({
        ...location,
        distance: calculateDistance(
          latitude,
          longitude,
          parseFloat(location.latitude),
          parseFloat(location.longitude),
        ),
      }))
      .filter((location) => location.distance <= radiusMeters)
      .sort((a, b) => a.distance - b.distance);

    res.json(nearbyTechnicians);
  } catch (error) {
    log.error('Find nearby technicians error:', error);
    res.status(500).json({ error: 'Failed to find nearby technicians' });
  }
});

// ==================== Location History ====================

// GET /api/gps/technicians/:id/history - Get location history for technician
router.get('/technicians/:id/history', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { startDate, endDate, activityType, ticketId } = req.query;

    const filters: any = {};
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);
    if (activityType) filters.activityType = activityType as string;
    if (ticketId) filters.ticketId = ticketId as string;

    const history = await storage.getGpsLocationHistory(req.params.id, user.tenantId, filters);

    res.json(history);
  } catch (error) {
    log.error('Get location history error:', error);
    res.status(500).json({ error: 'Failed to fetch location history' });
  }
});

// POST /api/gps/location-history - Create location history snapshot
router.post('/location-history', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const data = insertLocationHistorySchema.parse(req.body);
    const history = await storage.createGpsLocationHistory({
      ...data,
      tenantId: user.tenantId,
    });

    res.status(201).json(history);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Create location history error:', error);
    res.status(500).json({ error: 'Failed to create location history' });
  }
});

// GET /api/gps/tickets/:ticketId/activity-timeline - Get activity timeline for ticket
router.get('/tickets/:ticketId/activity-timeline', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const timeline = await storage.getTicketActivityTimeline(req.params.ticketId, user.tenantId);

    res.json(timeline);
  } catch (error) {
    log.error('Get ticket activity timeline error:', error);
    res.status(500).json({ error: 'Failed to fetch ticket activity timeline' });
  }
});

// GET /api/gps/technicians/:id/distance - Calculate distance traveled (query params: startDate, endDate)
router.get('/technicians/:id/distance', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    const distance = await storage.calculateDistanceTraveled(
      req.params.id,
      user.tenantId,
      start,
      end,
    );

    res.json({
      technicianId: req.params.id,
      startDate: start,
      endDate: end,
      totalDistanceMeters: distance,
    });
  } catch (error) {
    log.error('Calculate distance traveled error:', error);
    res.status(500).json({ error: 'Failed to calculate distance traveled' });
  }
});

// ==================== Route Assignments ====================

// GET /api/gps/routes - List all routes with filtering
router.get('/routes', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { technicianId, routeDate, routeStatus } = req.query;

    const filters: any = {};
    if (technicianId) filters.technicianId = technicianId as string;
    if (routeDate) filters.routeDate = new Date(routeDate as string);
    if (routeStatus) filters.routeStatus = routeStatus as string;

    const routes = await storage.getRouteAssignments(user.tenantId, filters);

    res.json(routes);
  } catch (error) {
    log.error('Get route assignments error:', error);
    res.status(500).json({ error: 'Failed to fetch route assignments' });
  }
});

// GET /api/gps/routes/:id - Get specific route
router.get('/routes/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const route = await storage.getRouteAssignment(req.params.id, user.tenantId);

    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }

    res.json(route);
  } catch (error) {
    log.error('Get route assignment error:', error);
    res.status(500).json({ error: 'Failed to fetch route assignment' });
  }
});

// POST /api/gps/routes - Create new route
router.post('/routes', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const data = insertRouteAssignmentSchema.parse(req.body);
    const route = await storage.createRouteAssignment({
      ...data,
      tenantId: user.tenantId,
      createdBy: user.id,
    });

    res.status(201).json(route);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Create route assignment error:', error);
    res.status(500).json({ error: 'Failed to create route assignment' });
  }
});

// PUT /api/gps/routes/:id - Update route
router.put('/routes/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const existing = await storage.getRouteAssignment(req.params.id, user.tenantId);
    if (!existing) {
      return res.status(404).json({ error: 'Route not found' });
    }

    const data = insertRouteAssignmentSchema.partial().parse(req.body);
    const updated = await storage.updateRouteAssignment(req.params.id, user.tenantId, data);

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Update route assignment error:', error);
    res.status(500).json({ error: 'Failed to update route assignment' });
  }
});

// DELETE /api/gps/routes/:id - Delete route
router.delete('/routes/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const route = await storage.getRouteAssignment(req.params.id, user.tenantId);
    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }

    await storage.deleteRouteAssignment(req.params.id, user.tenantId);
    res.status(204).send();
  } catch (error) {
    log.error('Delete route assignment error:', error);
    res.status(500).json({ error: 'Failed to delete route assignment' });
  }
});

// POST /api/gps/routes/:id/start - Start a route
router.post('/routes/:id/start', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const route = await storage.getRouteAssignment(req.params.id, user.tenantId);
    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }

    const startSchema = z.object({
      startLocation: z.object({
        lat: z.number(),
        lng: z.number(),
        address: z.string().optional(),
      }),
    });

    const { startLocation } = startSchema.parse(req.body);

    const updated = await storage.startRoute(req.params.id, user.tenantId, startLocation);

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Start route error:', error);
    res.status(500).json({ error: 'Failed to start route' });
  }
});

// POST /api/gps/routes/:id/complete - Complete a route
router.post('/routes/:id/complete', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const route = await storage.getRouteAssignment(req.params.id, user.tenantId);
    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }

    const completeSchema = z.object({
      endLocation: z.object({
        lat: z.number(),
        lng: z.number(),
        address: z.string().optional(),
      }),
      actualDuration: z.number().optional(),
    });

    const { endLocation, actualDuration } = completeSchema.parse(req.body);

    const updated = await storage.completeRoute(
      req.params.id,
      user.tenantId,
      endLocation,
      actualDuration,
    );

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Complete route error:', error);
    res.status(500).json({ error: 'Failed to complete route' });
  }
});

// PATCH /api/gps/routes/:id/progress - Update route progress
router.patch('/routes/:id/progress', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const route = await storage.getRouteAssignment(req.params.id, user.tenantId);
    if (!route) {
      return res.status(404).json({ error: 'Route not found' });
    }

    const progressSchema = z.object({
      completedStops: z.number(),
      waypoints: z.any().optional(),
    });

    const data = progressSchema.parse(req.body);

    const updated = await storage.updateRouteProgress(req.params.id, user.tenantId, data);

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Update route progress error:', error);
    res.status(500).json({ error: 'Failed to update route progress' });
  }
});

// ==================== Route Deviations ====================

// GET /api/gps/deviations - List route deviations with filtering
router.get('/deviations', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { routeId, technicianId, deviationType, severity, resolved } = req.query;

    const filters: any = {};
    if (routeId) filters.routeId = routeId as string;
    if (technicianId) filters.technicianId = technicianId as string;
    if (deviationType) filters.deviationType = deviationType as string;
    if (severity) filters.severity = severity as string;
    if (resolved !== undefined) filters.resolved = resolved === 'true';

    const deviations = await storage.getRouteDeviations(user.tenantId, filters);

    res.json(deviations);
  } catch (error) {
    log.error('Get route deviations error:', error);
    res.status(500).json({ error: 'Failed to fetch route deviations' });
  }
});

// GET /api/gps/deviations/unresolved - Get unresolved deviations
router.get('/deviations/unresolved', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const deviations = await storage.getRouteDeviations(user.tenantId, { resolved: false });

    res.json(deviations);
  } catch (error) {
    log.error('Get unresolved deviations error:', error);
    res.status(500).json({ error: 'Failed to fetch unresolved deviations' });
  }
});

// GET /api/gps/deviations/:id - Get specific deviation
router.get('/deviations/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const deviation = await storage.getRouteDeviation(req.params.id, user.tenantId);

    if (!deviation) {
      return res.status(404).json({ error: 'Deviation not found' });
    }

    res.json(deviation);
  } catch (error) {
    log.error('Get route deviation error:', error);
    res.status(500).json({ error: 'Failed to fetch route deviation' });
  }
});

// POST /api/gps/deviations - Create deviation record
router.post('/deviations', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const data = insertRouteDeviationSchema.parse(req.body);
    const deviation = await storage.createRouteDeviation({
      ...data,
      tenantId: user.tenantId,
    });

    res.status(201).json(deviation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Create route deviation error:', error);
    res.status(500).json({ error: 'Failed to create route deviation' });
  }
});

// POST /api/gps/deviations/:id/acknowledge - Acknowledge deviation
router.post('/deviations/:id/acknowledge', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const deviation = await storage.getRouteDeviation(req.params.id, user.tenantId);
    if (!deviation) {
      return res.status(404).json({ error: 'Deviation not found' });
    }

    const acknowledgeSchema = z.object({
      acknowledgedBy: z.string(),
    });

    const { acknowledgedBy } = acknowledgeSchema.parse(req.body);

    const updated = await storage.acknowledgeDeviation(
      req.params.id,
      user.tenantId,
      acknowledgedBy,
    );

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Acknowledge deviation error:', error);
    res.status(500).json({ error: 'Failed to acknowledge deviation' });
  }
});

// POST /api/gps/deviations/:id/resolve - Resolve deviation
router.post('/deviations/:id/resolve', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const deviation = await storage.getRouteDeviation(req.params.id, user.tenantId);
    if (!deviation) {
      return res.status(404).json({ error: 'Deviation not found' });
    }

    const resolveSchema = z.object({
      resolvedBy: z.string(),
      resolutionNotes: z.string().optional(),
    });

    const { resolvedBy, resolutionNotes } = resolveSchema.parse(req.body);

    const updated = await storage.resolveDeviation(
      req.params.id,
      user.tenantId,
      resolvedBy,
      resolutionNotes,
    );

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Resolve deviation error:', error);
    res.status(500).json({ error: 'Failed to resolve deviation' });
  }
});

// ==================== ETA Calculations ====================

// GET /api/gps/etas - List ETA calculations
router.get('/etas', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { ticketId, technicianId, routeId } = req.query;

    const filters: any = {};
    if (ticketId) filters.ticketId = ticketId as string;
    if (technicianId) filters.technicianId = technicianId as string;
    if (routeId) filters.routeId = routeId as string;

    const etas = await storage.getEtaCalculations(user.tenantId, filters);

    res.json(etas);
  } catch (error) {
    log.error('Get ETA calculations error:', error);
    res.status(500).json({ error: 'Failed to fetch ETA calculations' });
  }
});

// GET /api/gps/etas/:id - Get specific ETA
router.get('/etas/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const eta = await storage.getEtaCalculation(req.params.id, user.tenantId);

    if (!eta) {
      return res.status(404).json({ error: 'ETA calculation not found' });
    }

    res.json(eta);
  } catch (error) {
    log.error('Get ETA calculation error:', error);
    res.status(500).json({ error: 'Failed to fetch ETA calculation' });
  }
});

// POST /api/gps/etas - Create ETA calculation
router.post('/etas', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const data = insertEtaCalculationSchema.parse(req.body);
    const eta = await storage.createEtaCalculation({
      ...data,
      tenantId: user.tenantId,
    });

    res.status(201).json(eta);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Create ETA calculation error:', error);
    res.status(500).json({ error: 'Failed to create ETA calculation' });
  }
});

// GET /api/gps/tickets/:ticketId/eta - Get latest ETA for ticket
router.get('/tickets/:ticketId/eta', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const eta = await storage.getLatestEtaForTicket(req.params.ticketId, user.tenantId);

    if (!eta) {
      return res.status(404).json({ error: 'No ETA found for this ticket' });
    }

    res.json(eta);
  } catch (error) {
    log.error('Get latest ETA for ticket error:', error);
    res.status(500).json({ error: 'Failed to fetch latest ETA for ticket' });
  }
});

// PATCH /api/gps/etas/:id/arrival - Update actual arrival time
router.patch('/etas/:id/arrival', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const eta = await storage.getEtaCalculation(req.params.id, user.tenantId);
    if (!eta) {
      return res.status(404).json({ error: 'ETA calculation not found' });
    }

    const arrivalSchema = z.object({
      actualArrivalTime: z.coerce.date(),
    });

    const { actualArrivalTime } = arrivalSchema.parse(req.body);

    const updated = await storage.updateEtaArrival(req.params.id, user.tenantId, actualArrivalTime);

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Update ETA arrival error:', error);
    res.status(500).json({ error: 'Failed to update ETA arrival' });
  }
});

// GET /api/gps/technicians/:id/eta-accuracy - Get ETA accuracy metrics
router.get('/technicians/:id/eta-accuracy', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;

    const accuracy = await storage.getEtaAccuracyMetrics(req.params.id, user.tenantId, start, end);

    res.json(accuracy);
  } catch (error) {
    log.error('Get ETA accuracy metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch ETA accuracy metrics' });
  }
});

// ==================== Geofences ====================

// GET /api/gps/geofences - List geofences
router.get('/geofences', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { geofenceType, isActive, customerId } = req.query;

    const filters: any = {};
    if (geofenceType) filters.geofenceType = geofenceType as string;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (customerId) filters.customerId = customerId as string;

    const geofences = await storage.getGeofences(user.tenantId, filters);

    res.json(geofences);
  } catch (error) {
    log.error('Get geofences error:', error);
    res.status(500).json({ error: 'Failed to fetch geofences' });
  }
});

// GET /api/gps/geofences/:id - Get specific geofence
router.get('/geofences/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const geofence = await storage.getGeofence(req.params.id, user.tenantId);

    if (!geofence) {
      return res.status(404).json({ error: 'Geofence not found' });
    }

    res.json(geofence);
  } catch (error) {
    log.error('Get geofence error:', error);
    res.status(500).json({ error: 'Failed to fetch geofence' });
  }
});

// POST /api/gps/geofences - Create geofence (Admin/Manager only)
router.post('/geofences', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res
      .status(403)
      .json({ error: 'Forbidden: Admin or Manager role required to manage geofences' });
  }

  try {
    const data = insertGeofenceSchema.parse(req.body);
    const geofence = await storage.createGeofence({
      ...data,
      tenantId: user.tenantId,
      createdBy: user.id,
    });

    res.status(201).json(geofence);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Create geofence error:', error);
    res.status(500).json({ error: 'Failed to create geofence' });
  }
});

// PUT /api/gps/geofences/:id - Update geofence (Admin/Manager only)
router.put('/geofences/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res
      .status(403)
      .json({ error: 'Forbidden: Admin or Manager role required to manage geofences' });
  }

  try {
    const existing = await storage.getGeofence(req.params.id, user.tenantId);
    if (!existing) {
      return res.status(404).json({ error: 'Geofence not found' });
    }

    const data = insertGeofenceSchema.partial().parse(req.body);
    const updated = await storage.updateGeofence(req.params.id, user.tenantId, data);

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Update geofence error:', error);
    res.status(500).json({ error: 'Failed to update geofence' });
  }
});

// DELETE /api/gps/geofences/:id - Delete geofence (Admin/Manager only)
router.delete('/geofences/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res
      .status(403)
      .json({ error: 'Forbidden: Admin or Manager role required to manage geofences' });
  }

  try {
    const geofence = await storage.getGeofence(req.params.id, user.tenantId);
    if (!geofence) {
      return res.status(404).json({ error: 'Geofence not found' });
    }

    await storage.deleteGeofence(req.params.id, user.tenantId);
    res.status(204).send();
  } catch (error) {
    log.error('Delete geofence error:', error);
    res.status(500).json({ error: 'Failed to delete geofence' });
  }
});

// POST /api/gps/geofences/check - Check if location is in geofence
router.post('/geofences/check', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const checkSchema = z.object({
      geofenceId: z.string(),
      latitude: z.number(),
      longitude: z.number(),
    });

    const { geofenceId, latitude, longitude } = checkSchema.parse(req.body);

    const geofence = await storage.getGeofence(geofenceId, user.tenantId);
    if (!geofence) {
      return res.status(404).json({ error: 'Geofence not found' });
    }

    const isInside = await storage.checkGeofence(geofenceId, user.tenantId, latitude, longitude);

    res.json({ geofenceId, latitude, longitude, isInside });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Check geofence error:', error);
    res.status(500).json({ error: 'Failed to check geofence' });
  }
});

// ==================== Geofence Events ====================

// GET /api/gps/geofence-events - List geofence events
router.get('/geofence-events', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { geofenceId, technicianId, eventType, ticketId } = req.query;

    const filters: any = {};
    if (geofenceId) filters.geofenceId = geofenceId as string;
    if (technicianId) filters.technicianId = technicianId as string;
    if (eventType) filters.eventType = eventType as string;
    if (ticketId) filters.ticketId = ticketId as string;

    const events = await storage.getGeofenceEvents(user.tenantId, filters);

    res.json(events);
  } catch (error) {
    log.error('Get geofence events error:', error);
    res.status(500).json({ error: 'Failed to fetch geofence events' });
  }
});

// POST /api/gps/geofence-events - Create geofence event
router.post('/geofence-events', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const data = insertGeofenceEventSchema.parse(req.body);
    const event = await storage.createGeofenceEvent({
      ...data,
      tenantId: user.tenantId,
    });

    res.status(201).json(event);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Create geofence event error:', error);
    res.status(500).json({ error: 'Failed to create geofence event' });
  }
});

// GET /api/gps/technicians/:id/geofence-events - Get events for technician
router.get('/technicians/:id/geofence-events', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { startDate, endDate, eventType } = req.query;

    const filters: any = {};
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);
    if (eventType) filters.eventType = eventType as string;

    const events = await storage.getGeofenceEventsForTechnician(
      req.params.id,
      user.tenantId,
      filters,
    );

    res.json(events);
  } catch (error) {
    log.error('Get technician geofence events error:', error);
    res.status(500).json({ error: 'Failed to fetch technician geofence events' });
  }
});

// GET /api/gps/tickets/:ticketId/geofence-events - Get events for ticket
router.get('/tickets/:ticketId/geofence-events', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const events = await storage.getGeofenceEventsForTicket(req.params.ticketId, user.tenantId);

    res.json(events);
  } catch (error) {
    log.error('Get ticket geofence events error:', error);
    res.status(500).json({ error: 'Failed to fetch ticket geofence events' });
  }
});

export default router;
