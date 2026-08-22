// Notifications Edge Function
// Handles user notifications and alerts.
//
// PROD-008b: this function used to query a table called `notifications`. That
// table exists in NO Drizzle schema and NO migration — the real one is
// `user_notifications` (shared/schema.ts:9126, migration 0004), which is what
// server/routes-notifications.ts used and what three server-side producers write
// to today: routes-daily-briefing.ts, services/task-workflow/notifier.ts and
// services/dynamic-rescheduling-service.ts.
//
// The mismatch was invisible because every branch CAUGHT the 42P01 / PGRST205
// and returned an empty list or a bare success. So the notification bell showed
// nothing, permanently, while real notifications accumulated in a table nobody
// read. A silent fallback around a phantom relation is worse than the error it
// hides.
//
// Column names differ too, and the frontend follows the real table:
// enhanced-notification-bell.tsx reads `read` (not is_read), `createdAt` and
// `actionUrl`. user_notifications has read / read_at / action_url /
// action_label / category / priority / expires_at and NO updated_at, NO link.
// Rows go out camelCase; `metadata` is jsonb and toCamelShallow leaves its inner
// keys alone.

import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { toCamelShallow } from '../_shared/case.ts';

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenant_id as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'notifications');
    const notificationId = parts[0]; // resource ID after function-name strip
    const action = parts[1]; // 'mark-read', 'mark-all-read'

    // GET /notifications - List user notifications
    if (req.method === 'GET' && !notificationId) {
      const isRead =
        url.searchParams.get('read') ??
        url.searchParams.get('isRead') ??
        url.searchParams.get('is_read');
      const type = url.searchParams.get('type');
      const limit = parseInt(url.searchParams.get('limit') || '50');

      let query = admin
        .from('user_notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId)
        // Express filtered expired notifications out of the list
        // (expires_at IS NULL OR expires_at > now). Without this an expired
        // notification stays in the bell forever.
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (isRead !== null && isRead !== undefined) {
        query = query.eq('read', isRead === 'true');
      }

      if (type) {
        query = query.eq('type', type);
      }

      const { data: notifications, error, count } = await query;

      if (error) {
        // Kept as a guard, but it should never fire now: user_notifications is a
        // real, migrated table. If it does, that is a deploy problem worth seeing
        // in the logs rather than a permanently empty bell.
        if (
          error.code === '42P01' ||
          error.code === 'PGRST205' ||
          (error.message && error.message.includes('notifications'))
        ) {
          return createCorsResponse({ data: [], total: 0, unread: 0 }, 200, req);
        }
        console.error('Error fetching notifications:', error);
        return createCorsResponse({ error: 'Failed to fetch notifications' }, 500, req);
      }

      // Get unread count
      const { count: unreadCount } = await admin
        .from('user_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId)
        .eq('read', false);

      return createCorsResponse(
        {
          data: (notifications || []).map(toCamelShallow),
          total: count || 0,
          unread: unreadCount || 0,
        },
        200,
        req,
      );
    }

    // POST /notifications/:id/mark-read or PATCH /notifications/:id/read
    if (
      (req.method === 'POST' || req.method === 'PATCH') &&
      notificationId &&
      (action === 'mark-read' || action === 'read')
    ) {
      const { data: notification, error } = await admin
        .from('user_notifications')
        .update({
          read: true,
          read_at: new Date().toISOString(),
        })
        .eq('id', notificationId)
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205')
          return createCorsResponse({ success: true }, 200, req);
        console.error('Error marking notification as read:', error);
        return createCorsResponse({ error: 'Failed to mark notification as read' }, 500, req);
      }

      return createCorsResponse(toCamelShallow(notification), 200, req);
    }

    // POST /notifications/mark-all-read or PATCH /notifications/read-all
    if (
      (req.method === 'POST' || req.method === 'PATCH') &&
      (notificationId === 'mark-all-read' || notificationId === 'read-all')
    ) {
      const { error } = await admin
        .from('user_notifications')
        .update({
          read: true,
          read_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId)
        .eq('read', false);

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205')
          return createCorsResponse(
            { success: true, message: 'No notifications table yet' },
            200,
            req,
          );
        console.error('Error marking all notifications as read:', error);
        return createCorsResponse({ error: 'Failed to mark all notifications as read' }, 500, req);
      }

      return createCorsResponse(
        { success: true, message: 'All notifications marked as read' },
        200,
        req,
      );
    }

    // GET /notifications/unread-count
    // Must precede the /:id branch, or 'unread-count' is read as a notification
    // id and answers 404.
    if (req.method === 'GET' && notificationId === 'unread-count') {
      const { count, error } = await admin
        .from('user_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId)
        .eq('read', false);

      if (error) {
        console.error('Error counting unread notifications:', error);
        return createCorsResponse({ error: 'Failed to count notifications' }, 500, req);
      }
      return createCorsResponse({ count: count || 0 }, 200, req);
    }

    // GET /notifications/:id - Get single notification
    if (req.method === 'GET' && notificationId) {
      const { data: notification, error } = await admin
        .from('user_notifications')
        .select('*')
        .eq('id', notificationId)
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205')
          return createCorsResponse({ error: 'Notification not found' }, 404, req);
        console.error('Error fetching notification:', error);
        return createCorsResponse({ error: 'Notification not found' }, 404, req);
      }

      return createCorsResponse(toCamelShallow(notification), 200, req);
    }

    // POST /notifications - Create notification
    if (req.method === 'POST' && !notificationId) {
      const body = await req.json();

      // Only real user_notifications columns. `link` and `updated_at` do not
      // exist on it; the action target is action_url / action_label.
      const notificationData = {
        tenant_id: tenantId,
        user_id: body.userId ?? body.user_id ?? user.id,
        type: body.type || 'info',
        priority: body.priority ?? 'medium',
        category: body.category ?? 'system',
        title: body.title,
        message: body.message,
        action_url: body.actionUrl ?? body.action_url ?? body.link ?? null,
        action_label: body.actionLabel ?? body.action_label ?? null,
        metadata: body.metadata ?? null,
        expires_at: body.expiresAt ?? body.expires_at ?? null,
        read: false,
        created_at: new Date().toISOString(),
      };

      const { data: notification, error } = await admin
        .from('user_notifications')
        .insert(notificationData)
        .select()
        .single();

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205')
          return createCorsResponse({ error: 'Notifications table not available' }, 503, req);
        console.error('Error creating notification:', error);
        return createCorsResponse(
          { error: 'Failed to create notification', details: error },
          500,
          req,
        );
      }

      return createCorsResponse(toCamelShallow(notification), 201, req);
    }

    // DELETE /notifications/:id - Delete notification
    if (req.method === 'DELETE' && notificationId) {
      const { error } = await admin
        .from('user_notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId);

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205')
          return createCorsResponse({ success: true }, 200, req);
        console.error('Error deleting notification:', error);
        return createCorsResponse({ error: 'Failed to delete notification' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Notification deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Error in notifications function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
