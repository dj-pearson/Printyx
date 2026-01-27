// Notifications Edge Function
// Handles user notifications and alerts
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

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
    const pathParts = url.pathname.split('/').filter(Boolean);
    const notificationId = pathParts[1];
    const action = pathParts[2]; // 'mark-read', 'mark-all-read'

    // GET /notifications - List user notifications
    if (req.method === 'GET' && !notificationId) {
      const isRead = url.searchParams.get('isRead') || url.searchParams.get('is_read');
      const type = url.searchParams.get('type');
      const limit = parseInt(url.searchParams.get('limit') || '50');

      let query = admin
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (isRead !== null && isRead !== undefined) {
        query = query.eq('is_read', isRead === 'true');
      }

      if (type) {
        query = query.eq('type', type);
      }

      const { data: notifications, error, count } = await query;

      if (error) {
        console.error('Error fetching notifications:', error);
        return createCorsResponse({ error: 'Failed to fetch notifications' }, 500, req);
      }

      // Get unread count
      const { count: unreadCount } = await admin
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId)
        .eq('is_read', false);

      return createCorsResponse(
        {
          data: notifications || [],
          total: count || 0,
          unread: unreadCount || 0,
        },
        200,
        req,
      );
    }

    // POST /notifications/:id/mark-read - Mark notification as read
    if (req.method === 'POST' && notificationId && action === 'mark-read') {
      const { data: notification, error } = await admin
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', notificationId)
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error marking notification as read:', error);
        return createCorsResponse({ error: 'Failed to mark notification as read' }, 500, req);
      }

      return createCorsResponse(notification, 200, req);
    }

    // POST /notifications/mark-all-read - Mark all notifications as read
    if (req.method === 'POST' && notificationId === 'mark-all-read') {
      const { error } = await admin
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId)
        .eq('is_read', false);

      if (error) {
        console.error('Error marking all notifications as read:', error);
        return createCorsResponse({ error: 'Failed to mark all notifications as read' }, 500, req);
      }

      return createCorsResponse(
        { success: true, message: 'All notifications marked as read' },
        200,
        req,
      );
    }

    // GET /notifications/:id - Get single notification
    if (req.method === 'GET' && notificationId) {
      const { data: notification, error } = await admin
        .from('notifications')
        .select('*')
        .eq('id', notificationId)
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching notification:', error);
        return createCorsResponse({ error: 'Notification not found' }, 404, req);
      }

      return createCorsResponse(notification, 200, req);
    }

    // POST /notifications - Create notification
    if (req.method === 'POST' && !notificationId) {
      const body = await req.json();

      const notificationData = {
        tenant_id: tenantId,
        user_id: body.user_id || body.user_id || user.id,
        type: body.type || 'info',
        title: body.title,
        message: body.message,
        link: body.link || null,
        is_read: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: notification, error } = await admin
        .from('notifications')
        .insert(notificationData)
        .select()
        .single();

      if (error) {
        console.error('Error creating notification:', error);
        return createCorsResponse(
          { error: 'Failed to create notification', details: error },
          500,
          req,
        );
      }

      return createCorsResponse(notification, 201, req);
    }

    // DELETE /notifications/:id - Delete notification
    if (req.method === 'DELETE' && notificationId) {
      const { error } = await admin
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId);

      if (error) {
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
