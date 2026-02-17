import type { Express } from 'express';
import { requireSupabaseAuth as requireAuth } from './middleware/supabase-auth';
import { getUserId, getTenantId } from './utils/auth-helpers';
import { notificationService } from './services/notification-service';
import { createModuleLogger } from './lib/logger';

const log = createModuleLogger('routes-notifications');

export function registerNotificationRoutes(app: Express) {
  /**
   * GET /api/notifications
   * List notifications for the authenticated user.
   * Query params: limit, offset, unreadOnly
   */
  app.get('/api/notifications', requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const tenantId = getTenantId(req);
      if (!userId || !tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      const unreadOnly = req.query.unreadOnly === 'true';

      const notifications = await notificationService.getForUser(userId, tenantId, {
        limit,
        offset,
        unreadOnly,
      });

      return res.json(notifications);
    } catch (error) {
      log.error('Failed to fetch notifications', error);
      return res.status(500).json({ message: 'Failed to fetch notifications' });
    }
  });

  /**
   * GET /api/notifications/unread-count
   * Get unread notification count.
   */
  app.get('/api/notifications/unread-count', requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const tenantId = getTenantId(req);
      if (!userId || !tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const count = await notificationService.getUnreadCount(userId, tenantId);
      return res.json({ count });
    } catch (error) {
      log.error('Failed to fetch unread count', error);
      return res.status(500).json({ message: 'Failed to fetch unread count' });
    }
  });

  /**
   * POST /api/notifications/:id/read
   * Mark a single notification as read.
   */
  app.post('/api/notifications/:id/read', requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const tenantId = getTenantId(req);
      if (!userId || !tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const updated = await notificationService.markAsRead(req.params.id, userId, tenantId);
      if (!updated) {
        return res.status(404).json({ message: 'Notification not found' });
      }

      return res.json(updated);
    } catch (error) {
      log.error('Failed to mark notification as read', error);
      return res.status(500).json({ message: 'Failed to mark notification as read' });
    }
  });

  /**
   * POST /api/notifications/read-all
   * Mark all notifications as read for the current user.
   */
  app.post('/api/notifications/read-all', requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const tenantId = getTenantId(req);
      if (!userId || !tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      await notificationService.markAllAsRead(userId, tenantId);
      return res.json({ success: true });
    } catch (error) {
      log.error('Failed to mark all notifications as read', error);
      return res.status(500).json({ message: 'Failed to mark all notifications as read' });
    }
  });

  /**
   * DELETE /api/notifications/:id
   * Delete a notification.
   */
  app.delete('/api/notifications/:id', requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req);
      const tenantId = getTenantId(req);
      if (!userId || !tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const deleted = await notificationService.delete(req.params.id, userId, tenantId);
      if (!deleted) {
        return res.status(404).json({ message: 'Notification not found' });
      }

      return res.json({ success: true });
    } catch (error) {
      log.error('Failed to delete notification', error);
      return res.status(500).json({ message: 'Failed to delete notification' });
    }
  });
}
