// Activities Edge Function
// Handles business record activities (notes, calls, emails, meetings, etc.)
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';
import { applyUserScope, resolveScope } from '../_shared/scope.ts';
import { presentActivity } from '../../../shared/lead-activity-write.ts';
import { ilikeAnyFilter } from '../_shared/postgrest-or.ts';

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

    // SEC-TENANT-003: user_metadata is writable by the session holder through
    // supabase.auth.updateUser, and this client uses the service role, which
    // bypasses RLS - so a tenant read from that bag is a tenant of the
    // caller's choosing. resolveTenantId takes app_metadata, then the
    // caller's users row, which neither the user nor the browser can write.
    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'activities');
    const activityId = parts[0];
    const action = parts[1]; // /:id/complete

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
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (businessRecordId) {
        query = query.eq('business_record_id', businessRecordId);
      }

      if (activityType) {
        query = query.eq('activity_type', activityType);
      }

      if (search) {
        // AUDIT-037: the column is `description`; `notes` is not one, so any
        // search on this list came back 42703. The insert below had already
        // been corrected to description and this filter had not.
        query = query.or(ilikeAnyFilter(['subject', 'description'], search));
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

    // GET /activities/recent - the React Native home screen's activity feed
    //
    // PROD-008. This is the SUPA-024 shape: `recent` is not an id, but the
    // branch below reads parts[0] as one, so the request became a lookup for an
    // activity whose id is the string "recent" and answered 404. The screen has
    // an explicit empty state, so a dealer whose reps log calls all day saw
    // "No recent activity yet" on every open.
    //
    // It must sit ABOVE the :id branch, and `recent` is therefore a reserved
    // activity id - which is free, since these ids are uuids.
    //
    // SCOPED, because the screen is a personal home screen. A rep sees their
    // own, a manager their team's; COP-B01 round 105 found the same surface
    // reading the whole tenant's and reading as the caller's own. The response
    // is a BARE ARRAY - the screen does `Array.isArray(x) ? x : []` - so the
    // tier cannot be reported alongside it the way an envelope would.
    if (req.method === 'GET' && activityId === 'recent' && !action) {
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);

      const scope = await resolveScope(admin, {
        tenantId,
        userId: user.id,
        appMetadata: user.app_metadata as Record<string, unknown> | undefined,
        requestedScope: url.searchParams.get('scope'),
      });

      // `created_by` is the only ownership column this table has: there is no
      // assignee, so who logged it is who owns it (COP-B01).
      let query = admin
        .from('business_record_activities')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);
      query = applyUserScope(query, 'created_by', scope);

      const { data: recent, error } = await query;

      if (error) {
        console.error('Error fetching recent activities:', error);
        return createCorsResponse({ error: 'Failed to fetch recent activities' }, 500, req);
      }

      return createCorsResponse(
        (recent || []).map((row: Record<string, unknown>) => presentActivity(row)),
        200,
        req,
      );
    }

    // GET /activities/:id - Get single activity
    // An unknown sub-resource answers 404 rather than the parent record.
    // PA-020's rule: falling through to the row is what makes the NEXT missing
    // branch invisible - a component mapping over an object renders an empty
    // list and reports nothing, so the gap reads as "no data yet". Non-GET
    // methods already reach the terminal refusal below.
    if (req.method === 'GET' && activityId && action) {
      return createCorsResponse({ error: `Unknown activity sub-resource: ${action}` }, 404, req);
    }

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
    //
    // PROD-008b: the `!activityId` guard is load-bearing. Without it this branch
    // matched ANY POST under the prefix, so POST /activities/bulk-delete and
    // /bulk-update — which server/routes-bulk-operations.ts used to serve and
    // which this function has no branch for — would fall through to here and
    // INSERT a row built from a bulk payload that carries no subject and no
    // activity type. A delete request that silently creates a record is the worst
    // available outcome; an unmatched sub-path now reaches the 405 at the bottom.
    if (req.method === 'POST' && !activityId) {
      const body = await req.json();

      const activityData = {
        tenant_id: tenantId,
        business_record_id: body.businessRecordId || body.business_record_id,
        activity_type: body.activityType || body.activity_type,
        subject: body.subject,
        // AUDIT-037: the column is `description`. `notes` was a 42703, and
        // since PostgREST fails the whole insert on one bad name, logging any
        // activity at all was broken - not just its notes.
        description: body.notes ?? body.description ?? null,
        scheduled_date:
          body.activityDate ||
          body.activity_date ||
          body.scheduledDate ||
          body.scheduled_date ||
          new Date().toISOString(),
        // The only duration this table records is call_duration, an integer of
        // minutes. It is narrower than "activity duration" by name, but it is
        // the same fact and it is the column that exists; adding a second
        // duration would give one activity two.
        call_duration: body.durationMinutes ?? body.duration_minutes ?? null,
        direction: body.direction || null,
        email_to: body.emailTo || body.email_to || null,
        email_cc: body.emailCc || body.email_cc || null,
        outcome: body.outcome || null,
        due_date: body.dueDate || body.due_date || null,
        completed_date: body.completedDate || body.completed_date || null,
        next_action: body.nextAction || body.next_action || null,
        follow_up_date: body.followUpDate || body.follow_up_date || null,
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

      // business_record_activities has no priority column. Its urgency lives in
      // due_date and follow_up_date; a priority string with nothing reading it
      // would be a second, quieter answer to the same question.
      const activityIgnored = body.priority !== undefined ? ['priority'] : [];

      return createCorsResponse(
        activityIgnored.length > 0
          ? {
              ...(activity as Record<string, unknown>),
              unpersisted: [
                'priority: business_record_activities records urgency as due_date / follow_up_date',
              ],
            }
          : activity,
        201,
        req,
      );
    }

    // PATCH /activities/:id/complete - Mark activity as completed
    if (req.method === 'PATCH' && activityId && action === 'complete') {
      let body: { completedAt?: string; outcome?: string } = {};
      try {
        body = await req.json();
      } catch {
        /* allow empty body */
      }

      const { data: activity, error } = await admin
        .from('business_record_activities')
        .update({
          completed_date: body.completedAt || new Date().toISOString(),
          outcome: body.outcome || 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', activityId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error completing activity:', error);
        return createCorsResponse({ error: 'Failed to complete activity' }, 500, req);
      }

      return createCorsResponse(activity, 200, req);
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
        notes: 'description',
        description: 'description',
        activityDate: 'scheduled_date',
        scheduledDate: 'scheduled_date',
        durationMinutes: 'call_duration',
        callDuration: 'call_duration',
        // `call_outcome` is its own column and was missing from this map, so the
        // edit dialog folded a call's outcome into the general `outcome` field
        // and the general one then overwrote it. Two fields, one column, last
        // write wins - and the call outcome was always the loser.
        callOutcome: 'call_outcome',
        direction: 'direction',
        emailTo: 'email_to',
        emailCc: 'email_cc',
        outcome: 'outcome',
        dueDate: 'due_date',
        completedDate: 'completed_date',
        nextAction: 'next_action',
        followUpDate: 'follow_up_date',
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
