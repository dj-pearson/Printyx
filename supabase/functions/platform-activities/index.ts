// Platform Activities Edge Function
// Manages activity tracking for the platform CRM (calls, emails, meetings, demos,
// tasks) for Root Admins. Ports server/routes-platform-activities.ts.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

// camelCase sortBy (from the frontend) → real snake_case column
const SORT_COLUMN_MAP: Record<string, string> = {
  activityDate: 'activity_date',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  activityType: 'activity_type',
  subject: 'subject',
};

// Increment the parent business record's denormalized activity counters.
// Supabase has no atomic `col = col + 1` via the JS builder, so read-modify-write.
async function bumpBusinessRecord(
  admin: any,
  businessRecordId: string,
  patch: { activityDate?: string; deltas?: Record<string, number> },
) {
  if (!businessRecordId) return;
  const { data: record } = await admin
    .from('platform_business_records')
    .select(
      'total_activities, total_calls, total_emails, total_meetings, demos_completed, emails_opened, emails_clicked',
    )
    .eq('id', businessRecordId)
    .single();
  if (!record) return;

  const update: Record<string, unknown> = {
    last_contact_date: patch.activityDate || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  for (const [col, delta] of Object.entries(patch.deltas || {})) {
    update[col] = (Number(record[col]) || 0) + delta;
  }
  await admin.from('platform_business_records').update(update).eq('id', businessRecordId);
}

export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Extract and validate JWT
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    // Use service_role client for database operations
    const admin = createSupabaseServiceClient();

    // Check for root admin access (role level 7+ or can_access_all_tenants)
    const { data: userWithRole } = await admin
      .from('users')
      .select('role_id, roles!inner(level, can_access_all_tenants)')
      .eq('id', user.id)
      .single();

    const roleLevel = (userWithRole?.roles as any)?.level || 0;
    const canAccessAllTenants = (userWithRole?.roles as any)?.can_access_all_tenants || false;

    if (roleLevel < 7 && !canAccessAllTenants) {
      return createCorsResponse({ error: 'Root admin access required' }, 403, req);
    }

    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'platform-activities');
    const endpoint = parts[0];
    const subResource = parts[1];

    // ========================================================================
    // GET /platform-activities/stats — activity statistics
    // ========================================================================
    if (req.method === 'GET' && endpoint === 'stats') {
      const businessRecordId = url.searchParams.get('businessRecordId');
      const createdBy = url.searchParams.get('createdBy');
      const startDate = url.searchParams.get('startDate');
      const endDate = url.searchParams.get('endDate');

      let query = admin.from('platform_activities').select('*');
      if (businessRecordId) query = query.eq('business_record_id', businessRecordId);
      if (createdBy) query = query.eq('created_by', createdBy);
      if (startDate) query = query.gte('activity_date', new Date(startDate).toISOString());
      if (endDate) query = query.lte('activity_date', new Date(endDate).toISOString());

      const { data: rows, error } = await query;
      if (error) {
        console.error('Error fetching activity stats:', error);
        return createCorsResponse({ error: 'Failed to fetch activity statistics' }, 500, req);
      }
      const activities = rows || [];

      const countsByType: Record<string, number> = {};
      for (const a of activities) {
        const t = a.activity_type as string;
        countsByType[t] = (countsByType[t] || 0) + 1;
      }
      const activityCounts = Object.entries(countsByType).map(([activityType, count]) => ({
        activityType,
        count,
      }));

      const calls = activities.filter((a: any) => a.activity_type === 'call');
      const answeredCalls = calls.filter((a: any) => a.call_outcome === 'answered').length;
      const callDurations = calls
        .map((a: any) => Number(a.call_duration_minutes))
        .filter((n: number) => !Number.isNaN(n));
      const callMetrics = {
        totalCalls: calls.length,
        avgDuration: callDurations.length
          ? callDurations.reduce((s: number, n: number) => s + n, 0) / callDurations.length
          : null,
        answeredCalls,
      };

      const emails = activities.filter((a: any) => a.activity_type === 'email');
      const emailMetrics = {
        totalEmails: emails.length,
        openedEmails: emails.filter((a: any) => a.email_opened === true).length,
        clickedEmails: emails.filter((a: any) => a.email_clicked === true).length,
        repliedEmails: emails.filter((a: any) => a.email_replied === true).length,
      };

      const meetings = activities.filter((a: any) => a.activity_type === 'meeting');
      const meetingDurations = meetings
        .map((a: any) => Number(a.meeting_duration_minutes))
        .filter((n: number) => !Number.isNaN(n));
      const meetingMetrics = {
        totalMeetings: meetings.length,
        avgDuration: meetingDurations.length
          ? meetingDurations.reduce((s: number, n: number) => s + n, 0) / meetingDurations.length
          : null,
      };

      return createCorsResponse(
        { activityCounts, callMetrics, emailMetrics, meetingMetrics },
        200,
        req,
      );
    }

    // ========================================================================
    // GET /platform-activities — list with filtering + pagination
    // ========================================================================
    if (req.method === 'GET' && !endpoint) {
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;
      const businessRecordId = url.searchParams.get('businessRecordId');
      const dealId = url.searchParams.get('dealId');
      const contactId = url.searchParams.get('contactId');
      const activityTypes = url.searchParams.getAll('activityType');
      const createdBy = url.searchParams.get('createdBy');
      const startDate = url.searchParams.get('startDate');
      const endDate = url.searchParams.get('endDate');
      const sortBy = url.searchParams.get('sortBy') || 'activityDate';
      const sortOrder = (url.searchParams.get('sortOrder') || 'desc').toLowerCase();
      const sortColumn = SORT_COLUMN_MAP[sortBy] || 'activity_date';

      let query = admin
        .from('platform_activities')
        .select('*', { count: 'exact' })
        .order(sortColumn, { ascending: sortOrder === 'asc' })
        .range(offset, offset + limit - 1);

      if (businessRecordId) query = query.eq('business_record_id', businessRecordId);
      if (dealId) query = query.eq('deal_id', dealId);
      if (contactId) query = query.eq('contact_id', contactId);
      if (activityTypes.length === 1) query = query.eq('activity_type', activityTypes[0]);
      else if (activityTypes.length > 1) query = query.in('activity_type', activityTypes);
      if (createdBy) query = query.eq('created_by', createdBy);
      if (startDate) query = query.gte('activity_date', new Date(startDate).toISOString());
      if (endDate) query = query.lte('activity_date', new Date(endDate).toISOString());

      const { data: activities, error, count } = await query;
      if (error) {
        console.error('Error fetching activities:', error);
        return createCorsResponse({ error: 'Failed to fetch activities' }, 500, req);
      }

      const totalRecords = count || 0;
      const totalPages = Math.ceil(totalRecords / limit);
      return createCorsResponse(
        {
          activities: activities || [],
          pagination: {
            page,
            limit,
            totalRecords,
            totalPages,
            hasMore: page < totalPages,
          },
        },
        200,
        req,
      );
    }

    // ========================================================================
    // POST /platform-activities/log-call|log-email|log-meeting|log-demo
    // ========================================================================
    if (req.method === 'POST' && endpoint === 'log-call') {
      const body = await req.json();
      if (!body.businessRecordId) {
        return createCorsResponse({ error: 'businessRecordId is required' }, 400, req);
      }
      const { data: activity, error } = await admin
        .from('platform_activities')
        .insert({
          business_record_id: body.businessRecordId,
          deal_id: body.dealId || null,
          contact_id: body.contactId || null,
          activity_type: 'call',
          subject: body.subject || 'Phone call',
          description: body.description || null,
          activity_date: new Date().toISOString(),
          call_outcome: body.callOutcome || null,
          call_duration_minutes: body.callDuration ?? null,
          call_disposition: body.callDisposition || null,
          next_steps: body.nextSteps || null,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) {
        console.error('Error logging call:', error);
        return createCorsResponse({ error: 'Failed to log call' }, 500, req);
      }
      await bumpBusinessRecord(admin, body.businessRecordId, {
        deltas: { total_activities: 1, total_calls: 1 },
      });
      return createCorsResponse(activity, 201, req);
    }

    if (req.method === 'POST' && endpoint === 'log-email') {
      const body = await req.json();
      if (!body.businessRecordId) {
        return createCorsResponse({ error: 'businessRecordId is required' }, 400, req);
      }
      const { data: activity, error } = await admin
        .from('platform_activities')
        .insert({
          business_record_id: body.businessRecordId,
          deal_id: body.dealId || null,
          contact_id: body.contactId || null,
          activity_type: 'email',
          subject: body.emailSubject || 'Email sent',
          activity_date: new Date().toISOString(),
          email_from: body.emailFrom || null,
          email_to: body.emailTo || null,
          email_subject: body.emailSubject || null,
          email_body: body.emailBody || null,
          email_opened: body.emailOpened ?? false,
          email_clicked: body.emailClicked ?? false,
          email_replied: body.emailReplied ?? false,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) {
        console.error('Error logging email:', error);
        return createCorsResponse({ error: 'Failed to log email' }, 500, req);
      }
      await bumpBusinessRecord(admin, body.businessRecordId, {
        deltas: {
          total_activities: 1,
          total_emails: 1,
          emails_opened: body.emailOpened ? 1 : 0,
          emails_clicked: body.emailClicked ? 1 : 0,
        },
      });
      return createCorsResponse(activity, 201, req);
    }

    if (req.method === 'POST' && endpoint === 'log-meeting') {
      const body = await req.json();
      if (!body.businessRecordId) {
        return createCorsResponse({ error: 'businessRecordId is required' }, 400, req);
      }
      const { data: activity, error } = await admin
        .from('platform_activities')
        .insert({
          business_record_id: body.businessRecordId,
          deal_id: body.dealId || null,
          contact_id: body.contactId || null,
          activity_type: 'meeting',
          subject: body.subject || 'Meeting',
          activity_date: new Date().toISOString(),
          meeting_date: body.meetingDate
            ? new Date(body.meetingDate).toISOString()
            : new Date().toISOString(),
          meeting_duration_minutes: body.meetingDuration ?? null,
          meeting_type: body.meetingType || null,
          meeting_attendees: body.meetingAttendees ?? [],
          meeting_notes: body.meetingNotes || null,
          meeting_outcome: body.meetingOutcome || null,
          next_steps: body.nextSteps || null,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) {
        console.error('Error logging meeting:', error);
        return createCorsResponse({ error: 'Failed to log meeting' }, 500, req);
      }
      await bumpBusinessRecord(admin, body.businessRecordId, {
        deltas: { total_activities: 1, total_meetings: 1 },
      });
      return createCorsResponse(activity, 201, req);
    }

    if (req.method === 'POST' && endpoint === 'log-demo') {
      const body = await req.json();
      if (!body.businessRecordId) {
        return createCorsResponse({ error: 'businessRecordId is required' }, 400, req);
      }
      const { data: activity, error } = await admin
        .from('platform_activities')
        .insert({
          business_record_id: body.businessRecordId,
          deal_id: body.dealId || null,
          contact_id: body.contactId || null,
          activity_type: 'demo',
          subject: body.subject || 'Product demo',
          activity_date: new Date().toISOString(),
          demo_type: body.demoType || null,
          features_shown: body.featuresShown ?? [],
          demo_feedback: body.demoFeedback || null,
          next_steps: body.nextSteps || null,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) {
        console.error('Error logging demo:', error);
        return createCorsResponse({ error: 'Failed to log demo' }, 500, req);
      }
      await bumpBusinessRecord(admin, body.businessRecordId, {
        deltas: { total_activities: 1, demos_completed: 1 },
      });
      return createCorsResponse(activity, 201, req);
    }

    // ========================================================================
    // POST /platform-activities — create a generic activity
    // ========================================================================
    if (req.method === 'POST' && !endpoint) {
      const body = await req.json();
      if (!body.businessRecordId) {
        return createCorsResponse({ error: 'businessRecordId is required' }, 400, req);
      }
      if (!body.activityType) {
        return createCorsResponse({ error: 'activityType is required' }, 400, req);
      }

      const insert: Record<string, unknown> = {
        ...body,
        business_record_id: body.businessRecordId,
        activity_type: body.activityType,
        created_by: body.createdBy || user.id,
        activity_date: body.activityDate
          ? new Date(body.activityDate).toISOString()
          : new Date().toISOString(),
      };
      // Drop camelCase aliases that have snake_case equivalents to avoid unknown columns.
      delete insert.businessRecordId;
      delete insert.activityType;
      delete insert.createdBy;
      delete insert.activityDate;
      delete insert.dealId;
      if (body.dealId) insert.deal_id = body.dealId;
      delete insert.contactId;
      if (body.contactId) insert.contact_id = body.contactId;

      const { data: newActivity, error } = await admin
        .from('platform_activities')
        .insert(insert)
        .select()
        .single();
      if (error) {
        console.error('Error creating activity:', error);
        return createCorsResponse({ error: 'Failed to create activity' }, 500, req);
      }

      const deltas: Record<string, number> = { total_activities: 1 };
      if (body.activityType === 'call') deltas.total_calls = 1;
      else if (body.activityType === 'email') deltas.total_emails = 1;
      else if (body.activityType === 'meeting') deltas.total_meetings = 1;
      await bumpBusinessRecord(admin, body.businessRecordId, {
        activityDate: newActivity.activity_date,
        deltas,
      });

      return createCorsResponse(newActivity, 201, req);
    }

    // ========================================================================
    // PATCH /platform-activities/:id/complete-task
    // ========================================================================
    if (req.method === 'PATCH' && endpoint && subResource === 'complete-task') {
      const { data: completedTask, error } = await admin
        .from('platform_activities')
        .update({
          task_completed: true,
          task_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', endpoint)
        .eq('activity_type', 'task')
        .select()
        .single();
      if (error || !completedTask) {
        return createCorsResponse({ error: 'Task not found' }, 404, req);
      }
      return createCorsResponse(completedTask, 200, req);
    }

    // ========================================================================
    // PATCH /platform-activities/:id — update
    // ========================================================================
    if (req.method === 'PATCH' && endpoint && !subResource) {
      const body = await req.json();
      const { data: updated, error } = await admin
        .from('platform_activities')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', endpoint)
        .select()
        .single();
      if (error || !updated) {
        return createCorsResponse({ error: 'Activity not found' }, 404, req);
      }
      return createCorsResponse(updated, 200, req);
    }

    // ========================================================================
    // DELETE /platform-activities/:id
    // ========================================================================
    if (req.method === 'DELETE' && endpoint && !subResource) {
      const { data: deleted, error } = await admin
        .from('platform_activities')
        .delete()
        .eq('id', endpoint)
        .select()
        .single();
      if (error || !deleted) {
        return createCorsResponse({ error: 'Activity not found' }, 404, req);
      }
      return createCorsResponse(
        { message: 'Activity deleted successfully', activity: deleted },
        200,
        req,
      );
    }

    // ========================================================================
    // GET /platform-activities/:id — single activity (+ related)
    // ========================================================================
    if (req.method === 'GET' && endpoint && !subResource) {
      const { data: activity, error } = await admin
        .from('platform_activities')
        .select('*')
        .eq('id', endpoint)
        .single();
      if (error || !activity) {
        return createCorsResponse({ error: 'Activity not found' }, 404, req);
      }

      const businessRecord = activity.business_record_id
        ? (
            await admin
              .from('platform_business_records')
              .select('*')
              .eq('id', activity.business_record_id)
              .single()
          ).data
        : null;
      const deal = activity.deal_id
        ? (await admin.from('platform_deals').select('*').eq('id', activity.deal_id).single()).data
        : null;

      return createCorsResponse({ activity, businessRecord, deal }, 200, req);
    }

    // Method/endpoint not found
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in platform-activities function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
