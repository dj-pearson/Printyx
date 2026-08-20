/**
 * Activities Routes Module
 * Handles unified activities endpoint for CRM dashboard:
 * - /api/activities - Get all activities across business records
 *
 * Phase 3 Routes Refactor - Migrated from routes.ts
 */

import type { Express } from 'express';
import { storage } from './storage';
import { isAuthenticated } from './replitAuth';
import { resolveTenant, requireTenant, TenantRequest } from './middleware/tenancy';
import { getTenantId } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-activities');

export function registerActivitiesRoutes(app: Express) {
  // Apply authentication to all activities routes
  app.use('/api/activities', isAuthenticated);

  // ============================================
  // Unified Activities API routes
  // ============================================

  // GET /api/activities - Get all activities for CRM dashboard
  // ── /api/activities: PARTLY RETIRED (PROD-008b) ───────────────────────────
  //
  // GET list, POST, GET /:id, PUT /:id and DELETE /:id lived here. /api/activities
  // is in crmProxies and the proxy registers first, so none of them ran in dev;
  // production never reaches Express. The activities edge function covers all
  // five, plus PATCH /:id/complete, which is the third path the frontend calls.
  //
  // STILL HERE and deliberately: GET /recent and GET /user/:userId have no edge
  // counterpart and no frontend caller. Note what the proxy does to /recent - it
  // reaches the edge function's GET /:id branch with activityId='recent', so it
  // looks up an activity whose id is the literal string. Nothing calls it, but
  // that is the failure mode if anything starts to.

  // GET /api/activities/recent - Get recent activities with pagination
  app.get('/api/activities/recent', resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const { limit = '25', offset = '0', type = '' } = req.query;

      const activities = await storage.getRecentActivities(
        tenantId,
        parseInt(limit as string, 10),
        parseInt(offset as string, 10),
        type as string,
      );

      res.json(activities);
    } catch (error) {
      log.error('Error fetching recent activities:', error);
      res.status(500).json({ message: 'Failed to fetch recent activities' });
    }
  });

  // POST /api/activities - Create new activity

  // GET /api/activities/:id - Get single activity

  // PUT /api/activities/:id - Update activity

  // DELETE /api/activities/:id - Delete activity

  // GET /api/activities/user/:userId - Get activities by user
  app.get('/api/activities/user/:userId', resolveTenant, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const tenantId = getTenantId(req);
      const { limit = '50' } = req.query;

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const activities = await storage.getActivitiesByUser(
        userId,
        tenantId,
        parseInt(limit as string, 10),
      );

      res.json(activities);
    } catch (error) {
      log.error('Error fetching user activities:', error);
      res.status(500).json({ message: 'Failed to fetch user activities' });
    }
  });
}

export default { registerActivitiesRoutes };
