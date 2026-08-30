/**
 * Route optimization: single and multi-technician route planning. 5 handlers
 * over /api/route-optimization.
 *
 * CANNOT AUTHENTICATE ANYONE - see SEC-SESSION-001 before changing this file.
 *
 * Every handler below reads `req.session.user` as its only source of identity.
 * Nothing in this codebase assigns it: session login sets the flat
 * req.session.userId / req.session.tenantId and the JWT path sets req.user, so
 * each of these answers 401 in dev exactly as it does in production. It has
 * never run. server/types/express-session.d.ts records the same finding and
 * declares the type that lets it compile, which is why tsc sees nothing wrong.
 *
 * No client tree calls /api/route-optimization and there is no edge function.
 * The smallest of this group, and the cheapest to either finish or delete.
 *
 * The fix is one of three, and it is a product call rather than cleanup:
 * migrate the handlers to getUserId/getTenantId from utils/auth-helpers and
 * build the caller, retire the file in favour of an edge function that covers
 * it, or delete it. Populating req.session.user in the login path would revive
 * all twelve files at once and touches security-sensitive code.
 */
import express, { Request, Response } from 'express';
import { z } from 'zod';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('route-optimization-routes');

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
      tenantId: user.tenantId,
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
    log.error('Optimize route error:', error);
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
      tenantId: user.tenantId,
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
    log.error('Create optimized route error:', error);
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
      user.tenantId,
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
    log.error('Reoptimize route error:', error);
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
      user.tenantId,
      new Date(startDate as string),
      new Date(endDate as string),
    );

    res.json(analytics);
  } catch (error) {
    log.error('Get route analytics error:', error);
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
      user.tenantId,
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
    log.error('Multi-technician routing error:', error);
    res.status(500).json({ error: 'Failed to generate multi-technician routes' });
  }
});

export default router;
