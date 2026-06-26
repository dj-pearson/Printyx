// Platform Activities Edge Function
// Manages activity tracking for platform CRM (calls, emails, meetings, demos,
// tasks). Root-admin only — the same gate the sibling platform-crm / platform-deals
// functions use (role level >= 7 OR can_access_all_tenants).
//
// Ported from server/routes-platform-activities.ts (EDGE-004). The Express
// router 404s in production because the frontend bypasses Express and hits
// functions.printyx.net/platform-activities directly.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

// camelCase request key -> snake_case column. Only known keys are forwarded to
// PostgREST so an unexpected field can't trigger PGRST204.
const ACTIVITY_COLUMN_MAP: Record<string, string> = {
  businessRecordId: 'business_record_id',
  dealId: 'deal_id',
  contactId: 'contact_id',
  activityType: 'activity_type',
  subject: 'subject',
  description: 'description',
  activityDate: 'activity_date',
  callDuration: 'call_duration_minutes',
  callOutcome: 'call_outcome',
  callRecordingUrl: 'call_recording_url',
  callDisposition: 'call_disposition',
  emailFrom: 'email_from',
  emailTo: 'email_to',
  emailCc: 'email_cc',
  emailSubject: 'email_subject',
  emailBody: 'email_body',
  emailOpened: 'email_opened',
  emailClicked: 'email_clicked',
  emailReplied: 'email_replied',
  meetingDate: 'meeting_date',
  meetingDuration: 'meeting_duration_minutes',
  meetingType: 'meeting_type',
  meetingLocation: 'meeting_location',
  meetingAttendees: 'meeting_attendees',
  meetingNotes: 'meeting_notes',
  meetingOutcome: 'meeting_outcome',
  demoType: 'demo_type',
  featuresShown: 'features_shown',
  demoFeedback: 'demo_feedback',
  taskDueDate: 'task_due_date',
  taskCompleted: 'task_completed',
  taskPriority: 'task_priority',
  sentiment: 'sentiment',
  outcome: 'outcome',
  nextSteps: 'next_steps',
  createdBy: 'created_by',
  assignedTo: 'assigned_to',
};

// Snake_case sort keys the list endpoint accepts (frontend sends camelCase).
const SORT_COLUMN_MAP: Record<string, string> = {
  activityDate: 'activity_date',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  subject: 'subject',
  activityType: 'activity_type',
};

function mapBody(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, col] of Object.entries(ACTIVITY_COLUMN_MAP)) {
    if (body[k] !== undefined) out[col] = body[k];
  }
  return out;
}

// Bump the denormalized counters on the parent business record. Best-effort:
// failures here never fail the activity write.
async function bumpBusinessRecord(
  admin: ReturnType<typeof createSupabaseServiceClient>,
  businessRecordId: string,
  activityType: string,
) {
  try {
    const { data: rec } = await admin
      .from('platform_business_records')
      .select(
        'total_activities, total_calls, total_emails, total_meetings, demos_completed, emails_opened, emails_clicked',
      )
      .eq('id', businessRecordId)
      .single();
    if (!rec) return;
    const update: Record<string, unknown> = {
      last_contact_date: new Date().toISOString(),
      total_activities: (rec.total_activities || 0) + 1,
      updated_at: new Date().toISOString(),
    };
    if (activityType === 'call') update.total_calls = (rec.total_calls || 0) + 1;
    if (activityType === 'email') update.total_emails = (rec.total_emails || 0) + 1;
    if (activityType === 'meeting') update.total_meetings = (rec.total_meetings || 0) + 1;
    if (activityType === 'demo') update.demos_completed = (rec.demos_completed || 0) + 1;
    await admin.from('platform_business_records').update(update).eq('id', businessRecordId);
  } catch (_e) {
    // ignore counter failures
  }
}

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    const admin = createSupabaseServiceClient();

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
    const first = parts[0]; // undefined | 'stats' | '<id>'
    const second = parts[1]; // 'complete-task' for PATCH /:id/complete-task

    // POST /log-call | /log-email | /log-meeting | /log-demo
    if (req.method === 'POST' && first && first.startsWith('log-')) {
      const body = await req.json().catch(() => ({}));
      if (!body.businessRecordId) {
        return createCorsResponse({ error: 'businessRecordId is required' }, 400, req);
      }
      const type = first.slice(4); // call|email|meeting|demo
      const insert = mapBody(body);
      insert.activity_type = type;
      insert.activity_date = body.activityDate || new Date().toISOString();
      insert.created_by = body.createdBy || user.id;
      if (!insert.subject) {
        insert.subject =
          type === 'call'
            ? 'Phone call'
            : type === 'email'
              ? body.emailSubject || 'Email sent'
              : type === 'meeting'
                ? 'Meeting'
                : 'Product demo';
      }
      const { data: activity, error } = await admin
        .from('platform_activities')
        .insert(insert)
        .select()
        .single();
      if (error) {
        console.error('Error logging activity:', error);
        return createCorsResponse({ error: `Failed to log ${type}` }, 500, req);
      }
      await bumpBusinessRecord(admin, body.businessRecordId, type);
      return createCorsResponse(activity, 201, req);
    }

    // GET /stats
    if (req.method === 'GET' && first === 'stats') {
      const businessRecordId = url.searchParams.get('businessRecordId');
      const createdBy = url.searchParams.get('createdBy');
      const startDate = url.searchParams.get('startDate');
      const endDate = url.searchParams.get('endDate');

      let query = admin.from('platform_activities').select('*');
      if (businessRecordId) query = query.eq('business_record_id', businessRecordId);
      if (createdBy) query = query.eq('created_by', createdBy);
      if (startDate) query = query.gte('activity_date', startDate);
      if (endDate) query = query.lte('activity_date', endDate);

      const { data: rows, error } = await query;
      if (error) {
        return createCorsResponse({ error: 'Failed to fetch activity statistics' }, 500, req);
      }
      const all = rows || [];

      const countsMap: Record<string, number> = {};
      for (const a of all) {
        const t = a.activity_type || 'note';
        countsMap[t] = (countsMap[t] || 0) + 1;
      }
      const activityCounts = Object.entries(countsMap).map(([activityType, count]) => ({
        activityType,
        count,
      }));

      const calls = all.filter((a: any) => a.activity_type === 'call');
      const answered = calls.filter((a: any) => a.call_outcome === 'answered').length;
      const callDurations = calls
        .map((a: any) => a.call_duration_minutes)
        .filter((d: any) => typeof d === 'number');
      const callMetrics = {
        totalCalls: calls.length,
        avgDuration:
          callDurations.length > 0
            ? callDurations.reduce((s: number, d: number) => s + d, 0) / callDurations.length
            : null,
        answeredCalls: answered,
      };

      const emails = all.filter((a: any) => a.activity_type === 'email');
      const emailMetrics = {
        totalEmails: emails.length,
        openedEmails: emails.filter((a: any) => a.email_opened === true).length,
        clickedEmails: emails.filter((a: any) => a.email_clicked === true).length,
        repliedEmails: emails.filter((a: any) => a.email_replied === true).length,
      };

      const meetings = all.filter((a: any) => a.activity_type === 'meeting');
      const meetingDurations = meetings
        .map((a: any) => a.meeting_duration_minutes)
        .filter((d: any) => typeof d === 'number');
      const meetingMetrics = {
        totalMeetings: meetings.length,
        avgDuration:
          meetingDurations.length > 0
            ? meetingDurations.reduce((s: number, d: number) => s + d, 0) / meetingDurations.length
            : null,
      };

      return createCorsResponse(
        { activityCounts, callMetrics, emailMetrics, meetingMetrics },
        200,
        req,
      );
    }

    // GET / — list with filters + pagination
    if (req.method === 'GET' && !first) {
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;
      const businessRecordId = url.searchParams.get('businessRecordId');
      const dealId = url.searchParams.get('dealId');
      const contactId = url.searchParams.get('contactId');
      const activityType = url.searchParams.get('activityType');
      const createdBy = url.searchParams.get('createdBy');
      const startDate = url.searchParams.get('startDate');
      const endDate = url.searchParams.get('endDate');
      const sortBy = url.searchParams.get('sortBy') || 'activityDate';
      const sortOrder = url.searchParams.get('sortOrder') || 'desc';
      const sortColumn = SORT_COLUMN_MAP[sortBy] || 'activity_date';

      let query = admin
        .from('platform_activities')
        .select('*', { count: 'exact' })
        .order(sortColumn, { ascending: sortOrder === 'asc' })
        .range(offset, offset + limit - 1);

      if (businessRecordId) query = query.eq('business_record_id', businessRecordId);
      if (dealId) query = query.eq('deal_id', dealId);
      if (contactId) query = query.eq('contact_id', contactId);
      if (activityType) query = query.eq('activity_type', activityType);
      if (createdBy) query = query.eq('created_by', createdBy);
      if (startDate) query = query.gte('activity_date', startDate);
      if (endDate) query = query.lte('activity_date', endDate);

      const { data: activities, error, count } = await query;
      if (error) {
        console.error('Error fetching activities:', error);
        return createCorsResponse({ error: 'Failed to fetch activities' }, 500, req);
      }
      const totalPages = Math.ceil((count || 0) / limit);
      return createCorsResponse(
        {
          activities: activities || [],
          pagination: {
            page,
            limit,
            totalRecords: count || 0,
            totalPages,
            hasMore: page < totalPages,
          },
        },
        200,
        req,
      );
    }

    // POST / — create activity
    if (req.method === 'POST' && !first) {
      const body = await req.json().catch(() => ({}));
      if (!body.businessRecordId) {
        return createCorsResponse({ error: 'businessRecordId is required' }, 400, req);
      }
      if (!body.activityType) {
        return createCorsResponse({ error: 'activityType is required' }, 400, req);
      }
      const insert = mapBody(body);
      insert.created_by = body.createdBy || user.id;
      insert.activity_date = body.activityDate || new Date().toISOString();
      const { data: activity, error } = await admin
        .from('platform_activities')
        .insert(insert)
        .select()
        .single();
      if (error) {
        console.error('Error creating activity:', error);
        return createCorsResponse({ error: 'Failed to create activity' }, 500, req);
      }
      await bumpBusinessRecord(admin, body.businessRecordId, body.activityType);
      return createCorsResponse(activity, 201, req);
    }

    // PATCH /:id/complete-task
    if (req.method === 'PATCH' && first && second === 'complete-task') {
      const { data: completed, error } = await admin
        .from('platform_activities')
        .update({
          task_completed: true,
          task_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', first)
        .eq('activity_type', 'task')
        .select()
        .single();
      if (error || !completed) {
        return createCorsResponse({ error: 'Task not found' }, 404, req);
      }
      return createCorsResponse(completed, 200, req);
    }

    // PATCH /:id — update
    if (req.method === 'PATCH' && first && !second) {
      const body = await req.json().catch(() => ({}));
      const update = mapBody(body);
      update.updated_at = new Date().toISOString();
      const { data: updated, error } = await admin
        .from('platform_activities')
        .update(update)
        .eq('id', first)
        .select()
        .single();
      if (error || !updated) {
        return createCorsResponse({ error: 'Activity not found' }, 404, req);
      }
      return createCorsResponse(updated, 200, req);
    }

    // DELETE /:id
    if (req.method === 'DELETE' && first) {
      const { data: deleted, error } = await admin
        .from('platform_activities')
        .delete()
        .eq('id', first)
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

    // GET /:id — single activity with related record + deal
    if (req.method === 'GET' && first) {
      const { data: activity, error } = await admin
        .from('platform_activities')
        .select('*')
        .eq('id', first)
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
