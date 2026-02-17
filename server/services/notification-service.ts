import { db } from '../db';
import { userNotifications } from '@shared/notification-schema';
import { eq, and, desc, sql, lt } from 'drizzle-orm';
import { createModuleLogger } from '../lib/logger';

const log = createModuleLogger('notification-service');

export interface CreateNotificationInput {
  tenantId: string;
  userId: string;
  type?: string;
  priority?: string;
  category?: string;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, any>;
}

export class NotificationService {
  /**
   * Create a notification for a user and optionally broadcast via WebSocket.
   */
  async create(input: CreateNotificationInput) {
    try {
      const [notification] = await db
        .insert(userNotifications)
        .values({
          id: sql`gen_random_uuid()::text`,
          tenantId: input.tenantId,
          userId: input.userId,
          type: input.type || 'general',
          priority: input.priority || 'medium',
          category: input.category || 'system',
          title: input.title,
          message: input.message,
          actionUrl: input.actionUrl || null,
          actionLabel: input.actionLabel || null,
          metadata: input.metadata || null,
        })
        .returning();

      // Try to broadcast via WebSocket (fire-and-forget)
      this.broadcastToUser(input.userId, notification).catch(() => {});

      return notification;
    } catch (error) {
      log.error('Failed to create notification', error);
      throw error;
    }
  }

  /**
   * Get notifications for a user with pagination.
   */
  async getForUser(
    userId: string,
    tenantId: string,
    options: { limit?: number; offset?: number; unreadOnly?: boolean } = {},
  ) {
    const { limit = 50, offset = 0, unreadOnly = false } = options;

    const conditions = [
      eq(userNotifications.userId, userId),
      eq(userNotifications.tenantId, tenantId),
    ];

    if (unreadOnly) {
      conditions.push(eq(userNotifications.read, false));
    }

    const notifications = await db
      .select()
      .from(userNotifications)
      .where(and(...conditions))
      .orderBy(desc(userNotifications.createdAt))
      .limit(limit)
      .offset(offset);

    return notifications;
  }

  /**
   * Get unread count for a user.
   */
  async getUnreadCount(userId: string, tenantId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userNotifications)
      .where(
        and(
          eq(userNotifications.userId, userId),
          eq(userNotifications.tenantId, tenantId),
          eq(userNotifications.read, false),
        ),
      );

    return result[0]?.count ?? 0;
  }

  /**
   * Mark a single notification as read.
   */
  async markAsRead(notificationId: string, userId: string, tenantId: string) {
    const [updated] = await db
      .update(userNotifications)
      .set({ read: true, readAt: new Date() })
      .where(
        and(
          eq(userNotifications.id, notificationId),
          eq(userNotifications.userId, userId),
          eq(userNotifications.tenantId, tenantId),
        ),
      )
      .returning();

    return updated;
  }

  /**
   * Mark all notifications as read for a user.
   */
  async markAllAsRead(userId: string, tenantId: string) {
    const result = await db
      .update(userNotifications)
      .set({ read: true, readAt: new Date() })
      .where(
        and(
          eq(userNotifications.userId, userId),
          eq(userNotifications.tenantId, tenantId),
          eq(userNotifications.read, false),
        ),
      );

    return result;
  }

  /**
   * Delete a single notification.
   */
  async delete(notificationId: string, userId: string, tenantId: string) {
    const [deleted] = await db
      .delete(userNotifications)
      .where(
        and(
          eq(userNotifications.id, notificationId),
          eq(userNotifications.userId, userId),
          eq(userNotifications.tenantId, tenantId),
        ),
      )
      .returning();

    return deleted;
  }

  /**
   * Clean up old read notifications (older than 30 days).
   */
  async cleanupOld(tenantId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    await db
      .delete(userNotifications)
      .where(
        and(
          eq(userNotifications.tenantId, tenantId),
          eq(userNotifications.read, true),
          lt(userNotifications.createdAt, thirtyDaysAgo),
        ),
      );
  }

  /**
   * Send notification to user via WebSocket for real-time delivery.
   */
  private async broadcastToUser(userId: string, notification: any) {
    try {
      const { WebSocketService } = await import('../websocket-service');
      const ws = WebSocketService.getInstance();
      ws.sendToUser(userId, {
        type: 'new_notification',
        notification,
      });
    } catch {
      // WebSocket not available - silent fail
    }
  }
}

export const notificationService = new NotificationService();
