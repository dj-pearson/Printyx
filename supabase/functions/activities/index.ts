// Activities Edge Function
// Handles business record activities (notes, calls, emails, meetings, etc.)
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
    const activityId = pathParts[1];

    // GET /activities - List activities
    if (req.method === 'GET' && !activityId) {
      const businessRecordId =
        url.searchParams.get('businessRecordId') || url.searchParams.get('business_record_id');
      const activityType =
        url.searchParams.get('activityType') || url.searchParams.get('activity_type');
      const search = url.searchParams.get('search');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const offset = (page - 1) * limit;

      let query = admin
        .from('business_record_activities')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('activity_date', { ascending: false })
        .range(offset, offset + limit - 1);

      if (businessRecordId) {
        query = query.eq('business_record_id', businessRecordId);
      }

      if (activityType) {
        query = query.eq('activity_type', activityType);
      }

      if (search) {
        query = query.or(`subject.ilike.%${search}%,notes.ilike.%${search}%`);
      }

      const { data: activities, error, count } = await query;

      if (error) {
        console.error('Error fetching activities:', error);
        return createCorsResponse({ error: 'Failed to fetch activities' }, 500, req);
      }

      return createCorsResponse(
        {
          data: activities || [],
          total: count || 0,
          page,
          limit,
        },
        200,
        req,
      );
    }

    // GET /activities/:id - Get single activity
    if (req.method === 'GET' && activityId) {
      const { data: activity, error } = await admin
        .from('business_record_activities')
        .select('*')
        .eq('id', activityId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching activity:', error);
        return createCorsResponse({ error: 'Activity not found' }, 404, req);
      }

      return createCorsResponse(activity, 200, req);
    }

    // POST /activities - Create activity
    if (req.method === 'POST') {
      const body = await req.json();

      const activityData = {
        tenant_id: tenantId,
        business_record_id: body.businessRecordId || body.business_record_id,
        activity_type: body.activityType || body.activity_type,
        subject: body.subject,
        notes: body.notes || null,
        activity_date: body.activityDate || body.activity_date || new Date().toISOString(),
        duration_minutes: body.durationMinutes || body.duration_minutes || null,
        direction: body.direction || null,
        email_to: body.emailTo || body.email_to || null,
        email_cc: body.emailCc || body.email_cc || null,
        outcome: body.outcome || null,
        due_date: body.dueDate || body.due_date || null,
        completed_date: body.completedDate || body.completed_date || null,
        next_action: body.nextAction || body.next_action || null,
        follow_up_date: body.followUpDate || body.follow_up_date || null,
        priority: body.priority || 'medium',
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: activity, error } = await admin
        .from('business_record_activities')
        .insert(activityData)
        .select()
        .single();

      if (error) {
        console.error('Error creating activity:', error);
        return createCorsResponse({ error: 'Failed to create activity', details: error }, 500, req);
      }

      return createCorsResponse(activity, 201, req);
    }

    // PATCH /activities/:id - Update activity
    if ((req.method === 'PATCH' || req.method === 'PUT') && activityId) {
      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      const fieldMap: Record<string, string> = {
        activityType: 'activity_type',
        subject: 'subject',
        notes: 'notes',
        activityDate: 'activity_date',
        durationMinutes: 'duration_minutes',
        direction: 'direction',
        emailTo: 'email_to',
        emailCc: 'email_cc',
        outcome: 'outcome',
        dueDate: 'due_date',
        completedDate: 'completed_date',
        nextAction: 'next_action',
        followUpDate: 'follow_up_date',
        priority: 'priority',
      };

      for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
        if (body[camelKey] !== undefined || body[snakeKey] !== undefined) {
          updateData[snakeKey] = body[camelKey] !== undefined ? body[camelKey] : body[snakeKey];
        }
      }

      const { data: activity, error } = await admin
        .from('business_record_activities')
        .update(updateData)
        .eq('id', activityId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating activity:', error);
        return createCorsResponse({ error: 'Failed to update activity' }, 500, req);
      }

      return createCorsResponse(activity, 200, req);
    }

    // DELETE /activities/:id - Delete activity
    if (req.method === 'DELETE' && activityId) {
      const { error } = await admin
        .from('business_record_activities')
        .delete()
        .eq('id', activityId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting activity:', error);
        return createCorsResponse({ error: 'Failed to delete activity' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Activity deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Error in activities function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
