/**
 * In-App Notification Routes
 *
 * CRUD endpoints for user notifications with WebSocket real-time delivery.
 */

import type { Express, Request, Response } from 'express';
import { eq, and, desc, sql, isNull, or, gt } from 'drizzle-orm';
import { db } from './db';
import { userNotifications } from '../shared/schema';
import { requireAuth } from './replitAuth';
import { getUserId, getTenantId } from './utils/auth-helpers';
import { webSocketService } from './websocket-service';
import { createModuleLogger } from './lib/logger';

const log = createModuleLogger('notifications');

export function registerNotificationRoutes(app: Express): void {
  // ─── GET /api/notifications ────────────────────────────────────────
  // List notifications for the current user (with optional filters)
  app.get('/api/notifications', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const tenantId = getTenantId(req);
      if (!userId || !tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const { type, read, limit: limitParam } = req.query;
      const limit = Math.min(parseInt(limitParam as string) || 50, 100);

      const conditions = [
        eq(userNotifications.tenantId, tenantId),
        eq(userNotifications.userId, userId),
        or(isNull(userNotifications.expiresAt), gt(userNotifications.expiresAt, new Date())),
      ];

      if (type && typeof type === 'string') {
        conditions.push(eq(userNotifications.type, type));
      }
      if (read === 'true') {
        conditions.push(eq(userNotifications.read, true));
      } else if (read === 'false') {
        conditions.push(eq(userNotifications.read, false));
      }

      const notifications = await db
        .select()
        .from(userNotifications)
        .where(and(...conditions))
        .orderBy(desc(userNotifications.createdAt))
        .limit(limit);

      res.json(notifications);
    } catch (error: any) {
      log.error('Error fetching notifications:', error);
      res.status(500).json({ message: 'Failed to fetch notifications' });
    }
  });

  // ─── GET /api/notifications/unread-count ───────────────────────────
  app.get('/api/notifications/unread-count', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const tenantId = getTenantId(req);
      if (!userId || !tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const result = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(userNotifications)
        .where(
          and(
            eq(userNotifications.tenantId, tenantId),
            eq(userNotifications.userId, userId),
            eq(userNotifications.read, false),
            or(isNull(userNotifications.expiresAt), gt(userNotifications.expiresAt, new Date())),
          ),
        );

      res.json({ count: result[0]?.count ?? 0 });
    } catch (error: any) {
      log.error('Error fetching unread count:', error);
      res.status(500).json({ message: 'Failed to fetch unread count' });
    }
  });

  // ─── POST /api/notifications/:id/read ──────────────────────────────
  // Mark a single notification as read
  app.post('/api/notifications/:id/read', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const tenantId = getTenantId(req);
      if (!userId || !tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const { id } = req.params;

      const updated = await db
        .update(userNotifications)
        .set({ read: true, readAt: new Date() })
        .where(
          and(
            eq(userNotifications.id, id),
            eq(userNotifications.tenantId, tenantId),
            eq(userNotifications.userId, userId),
          ),
        )
        .returning();

      if (updated.length === 0) {
        return res.status(404).json({ message: 'Notification not found' });
      }

      res.json(updated[0]);
    } catch (error: any) {
      log.error('Error marking notification as read:', error);
      res.status(500).json({ message: 'Failed to mark notification as read' });
    }
  });

  // ─── POST /api/notifications/read-all ──────────────────────────────
  // Mark all notifications as read for the current user
  app.post('/api/notifications/read-all', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const tenantId = getTenantId(req);
      if (!userId || !tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      await db
        .update(userNotifications)
        .set({ read: true, readAt: new Date() })
        .where(
          and(
            eq(userNotifications.tenantId, tenantId),
            eq(userNotifications.userId, userId),
            eq(userNotifications.read, false),
          ),
        );

      res.json({ message: 'All notifications marked as read' });
    } catch (error: any) {
      log.error('Error marking all as read:', error);
      res.status(500).json({ message: 'Failed to mark all as read' });
    }
  });

  // ─── DELETE /api/notifications/:id ─────────────────────────────────
  app.delete('/api/notifications/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const tenantId = getTenantId(req);
      if (!userId || !tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const { id } = req.params;

      const deleted = await db
        .delete(userNotifications)
        .where(
          and(
            eq(userNotifications.id, id),
            eq(userNotifications.tenantId, tenantId),
            eq(userNotifications.userId, userId),
          ),
        )
        .returning();

      if (deleted.length === 0) {
        return res.status(404).json({ message: 'Notification not found' });
      }

      res.json({ message: 'Notification deleted' });
    } catch (error: any) {
      log.error('Error deleting notification:', error);
      res.status(500).json({ message: 'Failed to delete notification' });
    }
  });

  // ─── POST /api/notifications ───────────────────────────────────────
  // Create a notification (internal use / admin)
  app.post('/api/notifications', requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const { userId, type, priority, category, title, message, actionUrl, actionLabel, metadata } =
        req.body;

      if (!userId || !title || !message) {
        return res.status(400).json({ message: 'userId, title, and message are required' });
      }

      const [notification] = await db
        .insert(userNotifications)
        .values({
          tenantId,
          userId,
          type: type || 'general',
          priority: priority || 'medium',
          category: category || 'system',
          title,
          message,
          actionUrl,
          actionLabel,
          metadata,
        })
        .returning();

      // Broadcast via WebSocket for real-time delivery
      webSocketService.broadcastNotification(userId, tenantId, notification);

      res.status(201).json(notification);
    } catch (error: any) {
      log.error('Error creating notification:', error);
      res.status(500).json({ message: 'Failed to create notification' });
    }
  });

  log.info('Notification routes registered');
}
