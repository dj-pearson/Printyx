// Renewal Activities Edge Function
// Handles renewal activity tracking
//
// SEC-EDGE-001 batch 16: every branch here named columns the table does not
// have, so nothing this function does could ever have worked. `renewal_activities`
// stores activity_subject / activity_description / performed_by / activity_date
// and has no subject, description, performed_by_id, scheduled_at or completed_at.
// The list also embedded `performed_by:performed_by_id (id, full_name)`, which is
// wrong twice - the FK column is performed_by, and `users` has first_name /
// last_name - and an embed that cannot resolve takes the WHOLE query down rather
// than one field.
//
// Nothing calls this yet (docs/unreferenced-edge-fns-baseline.json). It is the
// only implementation of the table, so the columns are corrected rather than the
// function deleted - COP-B03's rule, where the first caller inherits whatever is
// left here.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';

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

    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'renewal-activities');
    const activityId = parts[0];

    // GET /renewal-activities - List renewal activities
    if (req.method === 'GET' && !activityId) {
      const renewalId = url.searchParams.get('renewalId');
      const type = url.searchParams.get('type');

      let query = admin
        .from('renewal_activities')
        .select('*')
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

      // Both spellings accepted on the way in; only real columns go out.
      // activity_date is when the activity happened - the table has no
      // scheduled_at/completed_at pair, so a caller sending either is read as
      // that one timestamp rather than silently dropped.
      const activityData = {
        tenant_id: tenantId,
        renewal_id: body.renewalId || body.renewal_id,
        activity_type: body.activityType || body.activity_type,
        activity_subject: body.activitySubject || body.activity_subject || body.subject,
        activity_description:
          body.activityDescription || body.activity_description || body.description,
        outcome: body.outcome,
        next_steps: body.nextSteps || body.next_steps,
        customer_sentiment: body.customerSentiment || body.customer_sentiment,
        renewal_likelihood: body.renewalLikelihood || body.renewal_likelihood,
        follow_up_required: body.followUpRequired ?? body.follow_up_required,
        follow_up_date: body.followUpDate || body.follow_up_date,
        performed_by: body.performedBy || body.performed_by || user.id,
        activity_date:
          body.activityDate ||
          body.activity_date ||
          body.completedAt ||
          body.completed_at ||
          new Date().toISOString(),
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
        // Only the fields the caller sent: a blanket object nulls every column
        // a partial form omits (COP-B03).
        .update(
          Object.fromEntries(
            Object.entries({
              activity_subject: body.activitySubject ?? body.activity_subject ?? body.subject,
              activity_description:
                body.activityDescription ?? body.activity_description ?? body.description,
              outcome: body.outcome,
              next_steps: body.nextSteps ?? body.next_steps,
              customer_sentiment: body.customerSentiment ?? body.customer_sentiment,
              renewal_likelihood: body.renewalLikelihood ?? body.renewal_likelihood,
              follow_up_required: body.followUpRequired ?? body.follow_up_required,
              follow_up_date: body.followUpDate ?? body.follow_up_date,
              activity_date: body.activityDate ?? body.activity_date,
            }).filter(([, v]) => v !== undefined),
          ),
        )
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
