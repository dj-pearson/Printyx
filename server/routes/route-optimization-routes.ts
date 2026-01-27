import express, { Request, Response } from 'express';
import { z } from 'zod';
import {
  routeOptimizationService,
  Waypoint,
  RouteOptimizationInput,
} from '../services/route-optimization-service';

const router = express.Router();

// Validation schemas
const waypointSchema = z.object({
  ticketId: z.string(),
  customerId: z.string().optional(),
  address: z.string(),
  lat: z.number(),
  lng: z.number(),
  sequence: z.number().optional().default(0),
  status: z.enum(['pending', 'in_progress', 'completed', 'skipped']).optional().default('pending'),
  priority: z.number().optional(),
  scheduledTime: z.coerce.date().optional(),
  serviceTimeMinutes: z.number().optional(),
});

const locationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  address: z.string().optional(),
});

const optimizeRouteSchema = z.object({
  startLocation: locationSchema,
  endLocation: locationSchema.optional(),
  waypoints: z.array(waypointSchema),
  algorithm: z.enum(['nearest_neighbor', 'priority_based', 'time_window', 'balanced']).optional(),
  respectPriorities: z.boolean().optional(),
  respectTimeWindows: z.boolean().optional(),
  maxStopsPerRoute: z.number().optional(),
});

const createOptimizedRouteSchema = optimizeRouteSchema.extend({
  technicianId: z.string(),
  routeName: z.string(),
});

// POST /api/route-optimization/optimize - Optimize a route
router.post('/optimize', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const data = optimizeRouteSchema.parse(req.body);

    const input: RouteOptimizationInput = {
      tenantId: user.tenant_id,
      technicianId: user.id, // Will be overridden if specified
      startLocation: data.startLocation,
      endLocation: data.endLocation,
      waypoints: data.waypoints as Waypoint[],
      algorithm: data.algorithm,
      respectPriorities: data.respectPriorities,
      respectTimeWindows: data.respectTimeWindows,
      maxStopsPerRoute: data.maxStopsPerRoute,
    };

    const optimizedRoute = await routeOptimizationService.optimizeRoute(input);
    res.json(optimizedRoute);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Optimize route error:', error);
    res.status(500).json({ error: 'Failed to optimize route' });
  }
});

// POST /api/route-optimization/create - Create an optimized route assignment
router.post('/create', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const data = createOptimizedRouteSchema.parse(req.body);

    const input: RouteOptimizationInput = {
      tenantId: user.tenant_id,
      technicianId: data.technicianId,
      startLocation: data.startLocation,
      endLocation: data.endLocation,
      waypoints: data.waypoints as Waypoint[],
      algorithm: data.algorithm,
      respectPriorities: data.respectPriorities,
      respectTimeWindows: data.respectTimeWindows,
      maxStopsPerRoute: data.maxStopsPerRoute,
    };

    const route = await routeOptimizationService.createOptimizedRoute(input, data.routeName);
    res.status(201).json(route);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Create optimized route error:', error);
    res.status(500).json({ error: 'Failed to create optimized route' });
  }
});

// POST /api/route-optimization/routes/:id/reoptimize - Re-optimize an existing route
router.post('/routes/:id/reoptimize', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const reoptimizeSchema = z.object({
      algorithm: z
        .enum(['nearest_neighbor', 'priority_based', 'time_window', 'balanced'])
        .optional(),
    });

    const { algorithm } = reoptimizeSchema.parse(req.body);

    const optimized = await routeOptimizationService.reoptimizeRoute(
      req.params.id,
      user.tenant_id,
      algorithm,
    );

    if (!optimized) {
      return res.status(404).json({ error: 'Route not found' });
    }

    res.json(optimized);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Reoptimize route error:', error);
    res.status(500).json({ error: 'Failed to reoptimize route' });
  }
});

// GET /api/route-optimization/technicians/:id/analytics - Get route analytics
router.get('/technicians/:id/analytics', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate query parameters are required' });
    }

    const analytics = await routeOptimizationService.getRouteAnalytics(
      req.params.id,
      user.tenant_id,
      new Date(startDate as string),
      new Date(endDate as string),
    );

    res.json(analytics);
  } catch (error) {
    console.error('Get route analytics error:', error);
    res.status(500).json({ error: 'Failed to get route analytics' });
  }
});

// POST /api/route-optimization/multi-technician - Suggest routes for multiple technicians
router.post('/multi-technician', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const multiTechSchema = z.object({
      technicianIds: z.array(z.string()),
      waypoints: z.array(waypointSchema),
      baseLocations: z.record(z.string(), locationSchema),
    });

    const data = multiTechSchema.parse(req.body);

    const baseLocationsMap = new Map<string, { lat: number; lng: number }>();
    Object.entries(data.baseLocations).forEach(([id, loc]) => {
      baseLocationsMap.set(id, { lat: loc.lat, lng: loc.lng });
    });

    const routes = await routeOptimizationService.suggestMultiTechnicianRoutes(
      user.tenant_id,
      data.technicianIds,
      data.waypoints as Waypoint[],
      baseLocationsMap,
    );

    // Convert Map to object for JSON response
    const result: { [key: string]: any } = {};
    routes.forEach((route, techId) => {
      result[techId] = route;
    });

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Multi-technician routing error:', error);
    res.status(500).json({ error: 'Failed to generate multi-technician routes' });
  }
});

export default router;
