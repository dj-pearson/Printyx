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
import { getUserId, getTenantId } from './utils/auth-helpers';

export function registerActivitiesRoutes(app: Express) {
  // Apply authentication to all activities routes
  app.use('/api/activities', isAuthenticated);

  // ============================================
  // Unified Activities API routes
  // ============================================

  // GET /api/activities - Get all activities for CRM dashboard
  app.get('/api/activities', resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      // Get all activities across all business records for this tenant
      const allActivities = await storage.getAllActivities(tenantId);
      res.json(allActivities);
    } catch (error) {
      console.error('Error fetching all activities:', error);
      res.status(500).json({ message: 'Failed to fetch activities' });
    }
  });

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
      console.error('Error fetching recent activities:', error);
      res.status(500).json({ message: 'Failed to fetch recent activities' });
    }
  });

  // POST /api/activities - Create new activity
  app.post('/api/activities', resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const activityData = {
        ...req.body,
        tenantId,
        createdBy: userId,
        activityDate: req.body.activityDate || new Date(),
      };

      const newActivity = await storage.createActivity(activityData);
      res.status(201).json(newActivity);
    } catch (error) {
      console.error('Error creating activity:', error);
      res.status(500).json({ message: 'Failed to create activity' });
    }
  });

  // GET /api/activities/:id - Get single activity
  app.get('/api/activities/:id', resolveTenant, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = getTenantId(req);

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const activity = await storage.getActivity(id, tenantId);

      if (!activity) {
        return res.status(404).json({ message: 'Activity not found' });
      }

      res.json(activity);
    } catch (error) {
      console.error('Error fetching activity:', error);
      res.status(500).json({ message: 'Failed to fetch activity' });
    }
  });

  // PUT /api/activities/:id - Update activity
  app.put('/api/activities/:id', resolveTenant, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = getTenantId(req);

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const updatedActivity = await storage.updateActivity(id, tenantId, req.body);

      if (!updatedActivity) {
        return res.status(404).json({ message: 'Activity not found' });
      }

      res.json(updatedActivity);
    } catch (error) {
      console.error('Error updating activity:', error);
      res.status(500).json({ message: 'Failed to update activity' });
    }
  });

  // DELETE /api/activities/:id - Delete activity
  app.delete('/api/activities/:id', resolveTenant, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenantId = getTenantId(req);

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const deleted = await storage.deleteActivity(id, tenantId);

      if (!deleted) {
        return res.status(404).json({ message: 'Activity not found' });
      }

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting activity:', error);
      res.status(500).json({ message: 'Failed to delete activity' });
    }
  });

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
      console.error('Error fetching user activities:', error);
      res.status(500).json({ message: 'Failed to fetch user activities' });
    }
  });
}

export default { registerActivitiesRoutes };
