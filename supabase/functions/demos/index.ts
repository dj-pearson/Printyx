// Demos Edge Function
// Handles demo scheduling and management, over `demo_schedules`.
//
// PA-052. Every branch here used to be a TODO saying the demos table did not
// exist. It has existed since migration 0000 (drizzle/migrations/0000_*.sql,
// 60+ columns, re-exported from shared/schema.ts as demoSchedules), so the page
// at /demo-scheduling had never persisted anything on either host:
//
//   prod  GET  /demos          -> [] unconditionally
//         POST /demos          -> 201 { success: true, message: 'Demo scheduled' },
//                                 writing nothing, while the page toasted
//                                 "scheduled successfully"
//         PUT  /demos/:id/status -> no branch, fell to the trailing 405
//         GET  /demos/customers  -> 42703: it selected `status` from `companies`,
//                                 which has no such column, so the customer
//                                 dropdown was empty and no demo could be started
//   dev   served by a fixture in routes-sample-data.ts returning one invented
//         demo for "ABC Corporation"; POST and the status update had no handler
//         at all. server/routes-demo-scheduling.ts looked like the real router
//         and was registered by nothing - and its own POST said "return success
//         response until schema is updated" too.
//
// Customers come from `business_records`, not `companies`: demo_schedules.
// business_record_id names that table, and the page's Customer interface reads
// primaryContactName/primaryContactEmail/addressLine1, which only it has.
// COP-B00 is still open on which of the two is canonical CRM-wide; this follows
// the column name and the equipment function's precedent.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { toCamel } from '../_shared/case.ts';

// demo_schedules.status / confirmation_status vocabularies, from the column
// comments. Validated on write so a typo cannot land a status the board's
// filters will never match.
const DEMO_STATUSES = ['scheduled', 'confirmed', 'completed', 'cancelled', 'rescheduled'];
const CONFIRMATION_STATUSES = ['pending', 'confirmed', 'declined'];

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
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenant_id as string) || (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    // server.ts strips the function-name segment before invoking this handler,
    // so the resource is at parts[0]. normalizePath strips an OPTIONAL leading
    // /demos, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'demos');
    const subRoute = parts[0]; // e.g., 'customers'
    const demoId = parts[0] && parts[0] !== 'customers' ? parts[0] : null;
    const subResource = parts[1]; // e.g., 'status'

    // GET /demos/customers - Customers a demo can be booked against
    if (req.method === 'GET' && subRoute === 'customers') {
      const { data: customers, error } = await admin
        .from('business_records')
        .select(
          'id, company_name, primary_contact_name, primary_contact_email, primary_contact_phone, address_line1, city, state, postal_code',
        )
        .eq('tenant_id', tenantId)
        .order('company_name');

      if (error) {
        console.error('Error fetching demo customers:', error);
        return createCorsResponse({ error: 'Failed to fetch customers' }, 500, req);
      }

      // The page reads companyName / primaryContactName / zipCode off each row.
      return createCorsResponse(
        (customers || []).map((c: any) => ({
          id: c.id,
          companyName: c.company_name,
          primaryContactName: c.primary_contact_name,
          email: c.primary_contact_email,
          phone: c.primary_contact_phone,
          addressLine1: c.address_line1,
          city: c.city,
          state: c.state,
          zipCode: c.postal_code,
        })),
        200,
        req,
      );
    }

    // GET /demos - List this tenant's demos, soonest last
    if (req.method === 'GET' && !demoId) {
      const status = url.searchParams.get('status');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '200'), 500);

      let query = admin
        .from('demo_schedules')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('scheduled_date', { ascending: false })
        .limit(limit);

      if (status) query = query.eq('status', status);

      const { data: demos, error } = await query;

      if (error) {
        console.error('Error fetching demos:', error);
        return createCorsResponse({ error: 'Failed to fetch demos' }, 500, req);
      }

      return createCorsResponse(toCamel(demos || []), 200, req);
    }

    // GET /demos/:id - Single demo
    if (req.method === 'GET' && demoId) {
      const { data: demo, error } = await admin
        .from('demo_schedules')
        .select('*')
        .eq('id', demoId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching demo:', error);
        return createCorsResponse({ error: 'Failed to fetch demo' }, 500, req);
      }

      if (!demo) {
        return createCorsResponse({ error: 'Demo not found' }, 404, req);
      }

      return createCorsResponse(toCamel(demo), 200, req);
    }

    // PUT|PATCH /demos/:id/status - Move a demo through its lifecycle
    if ((req.method === 'PUT' || req.method === 'PATCH') && demoId && subResource === 'status') {
      const body = await req.json().catch(() => ({}));
      const status = body.status;
      const confirmationStatus = body.confirmationStatus ?? body.confirmation_status;

      if (status !== undefined && !DEMO_STATUSES.includes(status)) {
        return createCorsResponse(
          { error: `status must be one of: ${DEMO_STATUSES.join(', ')}` },
          400,
          req,
        );
      }

      if (
        confirmationStatus !== undefined &&
        confirmationStatus !== null &&
        !CONFIRMATION_STATUSES.includes(confirmationStatus)
      ) {
        return createCorsResponse(
          { error: `confirmationStatus must be one of: ${CONFIRMATION_STATUSES.join(', ')}` },
          400,
          req,
        );
      }

      if (status === undefined && confirmationStatus === undefined) {
        return createCorsResponse({ error: 'Nothing to update' }, 400, req);
      }

      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (status !== undefined) {
        update.status = status;
        // `completed` is the only status that means the demo happened.
        if (status === 'completed') update.demo_completed = true;
      }
      if (confirmationStatus !== undefined) {
        update.confirmation_status = confirmationStatus;
        update.confirmation_date =
          confirmationStatus === 'confirmed' ? new Date().toISOString() : null;
      }

      const { data: demo, error } = await admin
        .from('demo_schedules')
        .update(update)
        .eq('id', demoId)
        .eq('tenant_id', tenantId)
        .select()
        .maybeSingle();

      if (error) {
        console.error('Error updating demo status:', error);
        return createCorsResponse({ error: 'Failed to update demo status' }, 500, req);
      }

      if (!demo) {
        return createCorsResponse({ error: 'Demo not found' }, 404, req);
      }

      return createCorsResponse(toCamel(demo), 200, req);
    }

    // An unknown sub-resource is a 404, not a silent fall-through to the
    // single-demo or create branch.
    if (demoId && subResource) {
      return createCorsResponse({ error: `Unknown demo sub-resource: ${subResource}` }, 404, req);
    }

    // POST /demos - Book a demo
    if (req.method === 'POST' && !demoId) {
      const body = await req.json().catch(() => ({}));

      const businessRecordId = body.businessRecordId ?? body.business_record_id;
      const scheduledDate = body.scheduledDate ?? body.scheduled_date;
      const scheduledTime = body.scheduledTime ?? body.scheduled_time;
      const demoType = body.demoType ?? body.demo_type;
      const demoLocation = body.demoLocation ?? body.demo_location;

      // Every one of these is NOT NULL on demo_schedules, so an insert missing
      // one is a 23502 the caller cannot read. Name them instead.
      const missing: string[] = [];
      if (!businessRecordId) missing.push('businessRecordId');
      if (!scheduledDate) missing.push('scheduledDate');
      if (!scheduledTime) missing.push('scheduledTime');
      if (!demoType) missing.push('demoType');
      if (!demoLocation) missing.push('demoLocation');
      if (missing.length) {
        return createCorsResponse(
          { error: `Missing required field(s): ${missing.join(', ')}` },
          400,
          req,
        );
      }

      // customer_name and contact_person are NOT NULL and the form does not
      // collect them - they belong to the record the user picked.
      const { data: record, error: recordError } = await admin
        .from('business_records')
        .select(
          'id, company_name, primary_contact_name, primary_contact_email, primary_contact_phone',
        )
        .eq('id', businessRecordId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (recordError) {
        console.error('Error loading business record for demo:', recordError);
        return createCorsResponse({ error: 'Failed to load customer' }, 500, req);
      }

      if (!record) {
        return createCorsResponse({ error: 'Customer not found' }, 404, req);
      }

      const equipmentModels = Array.isArray(body.equipmentModels)
        ? body.equipmentModels
        : typeof body.equipmentModels === 'string' && body.equipmentModels.trim()
          ? body.equipmentModels.split(',').map((m: string) => m.trim())
          : [];

      const insertRow = {
        tenant_id: tenantId,
        business_record_id: businessRecordId,
        customer_name: record.company_name,
        // contact_person is NOT NULL; a record with no named contact falls back
        // to the company so the booking is not blocked by missing CRM data.
        contact_person: record.primary_contact_name || record.company_name,
        contact_email: record.primary_contact_email ?? null,
        contact_phone: record.primary_contact_phone ?? null,
        demo_type: demoType,
        demo_objectives: body.demoObjectives ?? null,
        scheduled_date: new Date(scheduledDate).toISOString(),
        scheduled_time: scheduledTime,
        duration: Number(body.duration) || 60,
        demo_location: demoLocation,
        customer_address: body.demoAddress ?? body.customerAddress ?? null,
        equipment_models: equipmentModels,
        assigned_sales_rep: body.assignedSalesRep || user.id,
        status: 'scheduled',
        confirmation_status: 'pending',
        special_requirements: body.customerRequirements ?? null,
        proposal_amount:
          body.proposalAmount === undefined ||
          body.proposalAmount === null ||
          body.proposalAmount === ''
            ? null
            : String(body.proposalAmount),
        created_by: user.id,
      };

      const { data: demo, error } = await admin
        .from('demo_schedules')
        .insert(insertRow)
        .select()
        .single();

      if (error) {
        console.error('Error creating demo:', error);
        return createCorsResponse({ error: 'Failed to schedule demo', details: error }, 500, req);
      }

      return createCorsResponse(toCamel(demo), 201, req);
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Error in demos function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
