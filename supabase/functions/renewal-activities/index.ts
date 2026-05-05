// Renewal Activities Edge Function
// Handles renewal activity tracking
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

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
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'renewal-activities');
    const activityId = parts[0];

    // GET /renewal-activities - List renewal activities
    if (req.method === 'GET' && !activityId) {
      const renewalId = url.searchParams.get('renewalId');
      const type = url.searchParams.get('type');

      let query = admin
        .from('renewal_activities')
        .select(
          `
          *,
          performed_by:performed_by_id (id, full_name)
        `,
        )
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (renewalId) query = query.eq('renewal_id', renewalId);
      if (type) query = query.eq('activity_type', type);

      const { data: activities, error } = await query.limit(100);

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch renewal activities' }, 500, req);
      }

      return createCorsResponse(activities || [], 200, req);
    }

    // POST /renewal-activities - Create activity
    if (req.method === 'POST' && !activityId) {
      const body = await req.json();

      const activityData = {
        tenant_id: tenantId,
        renewal_id: body.renewalId || body.renewal_id,
        activity_type: body.activityType || body.activity_type,
        subject: body.subject,
        description: body.description,
        outcome: body.outcome,
        performed_by_id: body.performedById || body.performed_by_id || user.id,
        scheduled_at: body.scheduledAt || body.scheduled_at,
        completed_at: body.completedAt || body.completed_at,
        created_at: new Date().toISOString(),
      };

      const { data: activity, error } = await admin
        .from('renewal_activities')
        .insert(activityData)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create renewal activity' }, 500, req);
      }

      return createCorsResponse(activity, 201, req);
    }

    // PUT /renewal-activities/:id - Update activity
    if (req.method === 'PUT' && activityId) {
      const body = await req.json();

      const { data: activity, error } = await admin
        .from('renewal_activities')
        .update({
          subject: body.subject,
          description: body.description,
          outcome: body.outcome,
          completed_at: body.completedAt || body.completed_at,
        })
        .eq('id', activityId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update renewal activity' }, 500, req);
      }

      return createCorsResponse(activity, 200, req);
    }

    // DELETE /renewal-activities/:id - Delete activity
    if (req.method === 'DELETE' && activityId) {
      const { error } = await admin
        .from('renewal_activities')
        .delete()
        .eq('id', activityId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete renewal activity' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Activity deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in renewal-activities function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
