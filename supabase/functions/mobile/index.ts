// Mobile Field Service Edge Function
// Handles mobile sessions, photos, and offline sync for field technicians
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { resolveScope, rowInScope } from '../_shared/scope.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';
import { WRITE_BATCH, writeInBatches } from '../_shared/batch-fetch.ts';
import {
  OPEN_TICKET_STATUSES,
  SERVICE_TICKET_STATUSES,
  normalizeTicketStatus,
} from '../_shared/service-ticket-vocabulary.ts';
import { fetchAllRows } from '../_shared/paged-select.ts';
import {
  previousUtcMonthStart,
  summariseMobileDashboard,
  toMobileTickets,
} from '../../../shared/mobile-dashboard.ts';

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

    // Extract tenant ID from JWT metadata
    // SEC-TENANT-003: user_metadata is writable by the session holder through
    // supabase.auth.updateUser, and this client uses the service role, which
    // bypasses RLS - so a tenant read from that bag is a tenant of the
    // caller's choosing. resolveTenantId takes app_metadata, then the
    // caller's users row, which neither the user nor the browser can write.
    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);

    if (!tenantId) {
      console.error('No tenant ID found for user:', user.id);
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    // Use service_role client for database operations (bypasses RLS)

    const url = new URL(req.url);
    // server.ts strips the function-name segment before invoking this handler,
    // so the resource is at parts[0]. normalizePath strips an OPTIONAL leading
    // /mobile, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'mobile');
    // Path structure: /mobile/sessions, /mobile/sessions/:id, /mobile/photos, /mobile/photos/:id, /mobile/sync
    const resource = parts[0]; // sessions, photos, sync
    const resourceId = parts[1]; // :id or :ticketId for photos
    const subAction = parts[2]; // /service-tickets/:id/status

    // ========================================
    // SESSIONS ENDPOINTS
    // ========================================

    // GET /mobile/sessions - List active mobile sessions for technician
    /**
     * Whose sessions/tickets is this request about? (WF-V-02)
     *
     * `?technicianId=` was accepted from the caller and used unchecked, so any
     * authenticated member of the tenant could list another technician's sessions,
     * their assigned tickets with customer addresses and phone numbers, and their
     * photos - and could open a session AS them. It is now honoured only when the
     * named technician is inside the caller's WF-R-07 scope: a supervisor may look
     * at their crew, a technician may only be themselves.
     *
     * Returns the resolved id, or null when the caller asked about somebody they
     * may not see - which the branches below answer 403 for rather than quietly
     * substituting the caller, because silently returning different data than was
     * asked for is how a UI comes to show the wrong person's work.
     */
    const resolveTechnicianId = async (): Promise<string | null> => {
      const asked = url.searchParams.get('technicianId') || url.searchParams.get('technician_id');
      if (!asked || asked === user.id) return user.id;

      const scope = await resolveScope(admin, {
        userId: user.id,
        tenantId,
        appMetadata: user.app_metadata,
      });
      // includeUnowned: false - "this row belongs to nobody" is not a reason to
      // let someone act as a named other person.
      return rowInScope({ id: asked }, 'id', scope, { includeUnowned: false }) ? asked : null;
    };

    const notYours = () =>
      createCorsResponse(
        { error: 'That technician is outside your scope', code: 'ROW_OUT_OF_SCOPE' },
        403,
        req,
      );

    if (req.method === 'GET' && resource === 'sessions' && !resourceId) {
      const technicianId = await resolveTechnicianId();
      if (!technicianId) return notYours();
      const status = url.searchParams.get('status');
      const serviceTicketId =
        url.searchParams.get('serviceTicketId') || url.searchParams.get('service_ticket_id');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = admin
        .from('mobile_service_sessions')
        .select(
          `
          *,
          service_ticket:service_tickets!mobile_service_sessions_service_ticket_id_fkey(
            id, ticket_number, title, status, priority,
            customer:business_records!service_tickets_customer_id_fkey(id, company_name, primary_contact_name, primary_contact_phone)
          ),
          technician:users!mobile_service_sessions_technician_id_fkey(id, first_name, last_name, email)
        `,
          { count: 'exact' },
        )
        .eq('tenant_id', tenantId)
        .eq('technician_id', technicianId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq('status', status);
      }

      if (serviceTicketId) {
        query = query.eq('service_ticket_id', serviceTicketId);
      }

      const { data: sessions, error, count } = await query;

      if (error) {
        console.error('Error fetching mobile sessions:', error);
        return createCorsResponse({ error: 'Failed to fetch mobile sessions' }, 500, req);
      }

      return createCorsResponse(
        {
          data: sessions || [],
          total: count || 0,
          limit,
          offset,
        },
        200,
        req,
      );
    }

    // GET /mobile/sessions/:id - Get single session
    if (req.method === 'GET' && resource === 'sessions' && resourceId) {
      const { data: session, error } = await admin
        .from('mobile_service_sessions')
        .select(
          `
          *,
          service_ticket:service_tickets!mobile_service_sessions_service_ticket_id_fkey(
            id, ticket_number, title, description, status, priority, scheduled_date,
            customer:business_records!service_tickets_customer_id_fkey(
              id, company_name, primary_contact_name, primary_contact_email, primary_contact_phone,
              address_line1, address_line2, city, state, postal_code
            ),
            equipment:equipment(id, serial_number, model_number, manufacturer, location_description)
          ),
          technician:users!mobile_service_sessions_technician_id_fkey(id, first_name, last_name, email),
          time_entries:time_tracking_entries(*)
        `,
        )
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching mobile session:', error);
        return createCorsResponse({ error: 'Mobile session not found' }, 404, req);
      }

      return createCorsResponse(session, 200, req);
    }

    // POST /mobile/sessions - Start new mobile session (check-in)
    if (req.method === 'POST' && resource === 'sessions' && !resourceId) {
      const body = await req.json();

      const sessionData = {
        tenant_id: tenantId,
        service_ticket_id: body.serviceTicketId || body.service_ticket_id,
        // WF-V-02: the SESSION's technician is the caller. A body-supplied id let
        // one technician open a check-in against another's name.
        technician_id: user.id,
        check_in_latitude: body.checkInLatitude || body.check_in_latitude || body.latitude,
        check_in_longitude: body.checkInLongitude || body.check_in_longitude || body.longitude,
        check_in_address: body.checkInAddress || body.check_in_address || body.address,
        check_in_timestamp:
          body.checkInTimestamp || body.check_in_timestamp || new Date().toISOString(),
        status: 'checked_in',
        service_notes: body.serviceNotes || body.service_notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (!sessionData.service_ticket_id) {
        return createCorsResponse({ error: 'Service ticket ID is required' }, 400, req);
      }

      const { data: session, error } = await admin
        .from('mobile_service_sessions')
        .insert(sessionData)
        .select()
        .single();

      if (error) {
        console.error('Error creating mobile session:', error);
        return createCorsResponse(
          { error: 'Failed to create mobile session', details: error },
          500,
          req,
        );
      }

      // Create initial time tracking entry
      await admin.from('time_tracking_entries').insert({
        tenant_id: tenantId,
        session_id: session.id,
        latitude: sessionData.check_in_latitude,
        longitude: sessionData.check_in_longitude,
        address: sessionData.check_in_address,
        check_in_type: 'arrival',
        timestamp: sessionData.check_in_timestamp,
        notes: body.notes || 'Check-in at customer location',
        created_at: new Date().toISOString(),
      });

      // Update service ticket status to in_progress
      await admin
        .from('service_tickets')
        .update({
          status: 'in_progress',
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionData.service_ticket_id)
        .eq('tenant_id', tenantId);

      return createCorsResponse(session, 201, req);
    }

    // PUT /mobile/sessions/:id - Update session (check-out, add notes)
    if ((req.method === 'PUT' || req.method === 'PATCH') && resource === 'sessions' && resourceId) {
      const body = await req.json();

      // Fetch current session to calculate hours
      const { data: currentSession } = await admin
        .from('mobile_service_sessions')
        .select('*')
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .single();

      if (!currentSession) {
        return createCorsResponse({ error: 'Mobile session not found' }, 404, req);
      }

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      // Map fields from camelCase to snake_case
      const fieldMap: Record<string, string> = {
        checkOutLatitude: 'check_out_latitude',
        checkOutLongitude: 'check_out_longitude',
        checkOutAddress: 'check_out_address',
        checkOutTimestamp: 'check_out_timestamp',
        totalHours: 'total_hours',
        breakHours: 'break_hours',
        workingHours: 'working_hours',
        status: 'status',
        serviceNotes: 'service_notes',
        customerSignature: 'customer_signature',
      };

      for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
        if (body[camelKey] !== undefined || body[snakeKey] !== undefined) {
          updateData[snakeKey] = body[camelKey] !== undefined ? body[camelKey] : body[snakeKey];
        }
      }

      // Handle check-out scenario
      const isCheckingOut = body.checkOut || body.check_out || updateData.status === 'completed';
      if (isCheckingOut) {
        updateData.check_out_timestamp = updateData.check_out_timestamp || new Date().toISOString();
        updateData.check_out_latitude = updateData.check_out_latitude || body.latitude;
        updateData.check_out_longitude = updateData.check_out_longitude || body.longitude;
        updateData.check_out_address = updateData.check_out_address || body.address;
        updateData.status = 'completed';

        // Calculate total hours if check-in timestamp exists
        if (currentSession.check_in_timestamp && updateData.check_out_timestamp) {
          const checkIn = new Date(currentSession.check_in_timestamp);
          const checkOut = new Date(updateData.check_out_timestamp);
          const totalMs = checkOut.getTime() - checkIn.getTime();
          const totalHours = totalMs / (1000 * 60 * 60);
          updateData.total_hours = totalHours.toFixed(2);

          const breakHours = parseFloat(currentSession.break_hours || '0');
          updateData.working_hours = (totalHours - breakHours).toFixed(2);
        }
      }

      const { data: session, error } = await admin
        .from('mobile_service_sessions')
        .update(updateData)
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating mobile session:', error);
        return createCorsResponse({ error: 'Failed to update mobile session' }, 500, req);
      }

      // Create time tracking entry for check-out
      if (isCheckingOut) {
        await admin.from('time_tracking_entries').insert({
          tenant_id: tenantId,
          session_id: resourceId,
          latitude: updateData.check_out_latitude,
          longitude: updateData.check_out_longitude,
          address: updateData.check_out_address,
          check_in_type: 'departure',
          timestamp: updateData.check_out_timestamp,
          notes: body.notes || 'Check-out from customer location',
          created_at: new Date().toISOString(),
        });

        // Update service ticket status if completed
        if (currentSession.service_ticket_id) {
          await admin
            .from('service_tickets')
            .update({
              status: 'completed',
              resolved_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', currentSession.service_ticket_id)
            .eq('tenant_id', tenantId);
        }
      }

      return createCorsResponse(session, 200, req);
    }

    // GET /mobile/dashboard - the React Native home screen (PROD-008)
    //
    // THREE CONSUMERS, THREE SHAPES, AND THE HANDLER MATCHED NONE OF THEM. The
    // Express version answered a FIXTURE - "TECH-001", a 4.8 rating, 1247
    // completed jobs, $2,340.50 of revenue today, invented customers at
    // invented coordinates - so the dashboard screen showed "$—" and blanks and
    // the field-service screen had nothing to act on, on both hosts, because
    // this function had no branch at all.
    //
    // Served here for the two React Native screens, which read the six stat
    // keys and `tickets`. `client/src/pages/MobileServiceApp.tsx` reads
    // `jobsQueue` and is NOT brought along, deliberately: it dereferences
    // `job.coordinates.lat` and `job.routeOptimization.driveTime` with no
    // guard, and `service_tickets` has no coordinates and nothing in this
    // product computes drive time, traffic or parking notes - so handing it a
    // real queue would turn a fixture into a crash. That page is AUDIT-033's,
    // and the gap is named in `unbacked` rather than filled with plausible
    // numbers.
    //
    // EACH SECTION IS CAUGHT SEPARATELY and answers null on failure. A count
    // of zero is a measurement about a quiet day; a null says the query did not
    // run, and the screen can tell them apart.
    if (req.method === 'GET' && resource === 'dashboard' && !resourceId) {
      const scope = await resolveScope(admin, {
        userId: user.id,
        tenantId,
        appMetadata: user.app_metadata,
      });
      const now = new Date();
      const since = previousUtcMonthStart(now).toISOString();
      const unbacked: string[] = [];

      // The technician's queue. Scoped to the caller unless their tier is
      // wider, the same way the service-tickets list is.
      let tickets: ReturnType<typeof toMobileTickets> | null = null;
      let activeTickets: number | null = null;
      try {
        const rows = await fetchAllRows<any>(() => {
          let q = admin
            .from('service_tickets')
            .select(
              'id, ticket_number, title, description, priority, status, customer_id, customer_address, customer_phone, scheduled_date, estimated_duration, required_parts',
            )
            .eq('tenant_id', tenantId)
            .in('status', OPEN_TICKET_STATUSES);
          if (scope.userIds) q = q.in('assigned_technician_id', scope.userIds);
          return q;
        });

        const customerIds = [...new Set(rows.map((r: any) => r.customer_id).filter(Boolean))];
        const names = new Map<string, string>();
        // PostgREST rejects an .in() with no values, so an empty queue does not
        // issue a lookup that would answer 400.
        if (customerIds.length > 0) {
          const { data: customers } = await admin
            .from('business_records')
            .select('id, company_name')
            .eq('tenant_id', tenantId)
            .in('id', customerIds as string[]);
          for (const c of customers ?? []) {
            if (c.company_name) names.set(c.id, c.company_name);
          }
        }

        tickets = toMobileTickets(
          rows.map((r: any) => ({
            id: r.id,
            ticketNumber: r.ticket_number,
            title: r.title,
            description: r.description,
            priority: r.priority,
            status: r.status,
            customerId: r.customer_id,
            customerAddress: r.customer_address,
            customerPhone: r.customer_phone,
            scheduledDate: r.scheduled_date,
            estimatedDuration: r.estimated_duration,
            requiredParts: r.required_parts,
          })),
          names,
        );
        activeTickets = tickets.length;
      } catch (err) {
        console.error('[mobile] dashboard tickets failed', err);
      }

      let totals: ReturnType<typeof summariseMobileDashboard> | null = null;
      try {
        const [paid, leads] = await Promise.all([
          fetchAllRows<any>(() =>
            admin
              .from('invoices')
              .select('amount_paid, paid_date')
              .eq('tenant_id', tenantId)
              .gte('paid_date', since),
          ),
          fetchAllRows<any>(() =>
            admin
              .from('business_records')
              .select('created_at')
              .eq('tenant_id', tenantId)
              .eq('record_type', 'lead'),
          ),
        ]);
        totals = summariseMobileDashboard(
          paid.map((r: any) => ({ amountPaid: r.amount_paid, paidDate: r.paid_date })),
          leads.map((r: any) => ({ createdAt: r.created_at })),
          now,
        );
      } catch (err) {
        console.error('[mobile] dashboard totals failed', err);
      }

      let totalEquipment: number | null = null;
      try {
        const { count, error } = await admin
          .from('equipment')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId);
        if (error) throw error;
        totalEquipment = count ?? 0;
      } catch (err) {
        console.error('[mobile] dashboard equipment count failed', err);
      }

      if (totals?.uncostedPaidCount) {
        unbacked.push(
          `${totals.uncostedPaidCount} invoice(s) settled this month carry no amount, so revenueMtd is a lower bound`,
        );
      }
      unbacked.push(
        'jobsQueue is not returned: service_tickets has no coordinates, and nothing in this product computes drive time, traffic or parking notes (AUDIT-033)',
      );

      return createCorsResponse(
        {
          openLeads: totals?.openLeads ?? null,
          activeTickets,
          revenueMtd: totals?.revenueMtd ?? null,
          totalEquipment,
          revenueTrend: totals?.revenueTrend ?? null,
          leadsTrend: totals?.leadsTrend ?? null,
          tickets: tickets ?? [],
          scopeTier: scope.tier,
          coversWholeTenant: scope.userIds === null,
          unbacked,
        },
        200,
        req,
      );
    }

    // ========================================
    // TIME TRACKING + TICKET STATUS (PROD-008)
    // ========================================
    //
    // The React Native field-service screen calls all three of these and NONE
    // of them existed here, so every one 404'd in production while Express
    // served them in dev - the dev/prod split running in its worse direction,
    // because production is where the technician is standing.
    //
    // THEY ARE THE SESSION MACHINERY UNDER ANOTHER NAME, so they reuse it
    // rather than opening a second timer model: `mobile_service_sessions`
    // already carries check-in and check-out timestamps, total and working
    // hours, and `time_tracking_entries` is the per-event log hanging off it.
    // The Express versions wrote neither - `stop` bumped `updated_at` and
    // answered `{ stoppedAt }`, so the technician was told the timer had
    // stopped and nothing recorded any time at all.

    /** Is this ticket the caller's to act on? Null means yes. */
    const denyIfTicketOutOfScope = async (ticketId: string): Promise<Response | null> => {
      const { data: ticket } = await admin
        .from('service_tickets')
        .select('id, assigned_technician_id, created_by')
        .eq('id', ticketId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (!ticket) {
        return createCorsResponse({ error: 'Service ticket not found' }, 404, req);
      }
      const scope = await resolveScope(admin, {
        userId: user.id,
        tenantId,
        appMetadata: user.app_metadata,
      });
      if (rowInScope(ticket, ['assigned_technician_id', 'created_by'], scope)) return null;
      return createCorsResponse(
        { error: 'This ticket is outside your scope', code: 'ROW_OUT_OF_SCOPE' },
        403,
        req,
      );
    };

    // POST /mobile/time-tracking/start
    //
    // The Express version set the ticket to `'in-progress'` WITH A HYPHEN,
    // which WF-V-05's CHECK constraint does not allow, so starting a timer was
    // a 23514 surfaced as "Failed to start timer"; and it wrote
    // `assigned_technician_id = caller` with no scope check, so any tenant
    // member could take any ticket by pressing Start.
    if (req.method === 'POST' && resource === 'time-tracking' && resourceId === 'start') {
      const body = await req.json().catch(() => ({}) as Record<string, unknown>);
      const ticketId = (body.ticketId ?? body.ticket_id ?? body.serviceTicketId) as
        | string
        | undefined;
      if (!ticketId) {
        return createCorsResponse({ error: 'ticketId is required' }, 400, req);
      }

      const denied = await denyIfTicketOutOfScope(ticketId);
      if (denied) return denied;

      // Idempotent: pressing Start twice must not open a second session, and a
      // technician who backgrounds the app and returns should find the one they
      // already have rather than starting the clock again.
      const { data: open } = await admin
        .from('mobile_service_sessions')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('service_ticket_id', ticketId)
        .eq('technician_id', user.id)
        .is('check_out_timestamp', null)
        .order('check_in_timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      let session = open;
      if (!session) {
        const startedAt = new Date().toISOString();
        const { data: created, error } = await admin
          .from('mobile_service_sessions')
          .insert({
            tenant_id: tenantId,
            service_ticket_id: ticketId,
            // WF-V-02: the session's technician is the caller, never a
            // body-supplied id.
            technician_id: user.id,
            check_in_latitude: body.latitude ?? null,
            check_in_longitude: body.longitude ?? null,
            check_in_address: body.address ?? null,
            check_in_timestamp: startedAt,
            status: 'in_progress',
            created_at: startedAt,
            updated_at: startedAt,
          })
          .select()
          .single();
        if (error) {
          console.error('Error starting time tracking:', error);
          return createCorsResponse(
            { error: 'Failed to start time tracking', details: error.message },
            500,
            req,
          );
        }
        session = created;

        await admin.from('time_tracking_entries').insert({
          tenant_id: tenantId,
          session_id: session.id,
          latitude: body.latitude ?? null,
          longitude: body.longitude ?? null,
          address: body.address ?? null,
          check_in_type: 'arrival',
          timestamp: startedAt,
          notes: (body.notes as string) ?? 'Timer started',
          created_at: startedAt,
        });
      }

      // Canonical spelling. Starting work on a ticket is the one status change
      // this endpoint makes; everything else goes through /status below.
      const { error: ticketErr } = await admin
        .from('service_tickets')
        .update({ status: 'in_progress', updated_at: new Date().toISOString() })
        .eq('id', ticketId)
        .eq('tenant_id', tenantId);
      if (ticketErr) {
        console.error('Error moving ticket to in_progress:', ticketErr);
      }

      return createCorsResponse(
        {
          success: true,
          sessionId: session.id,
          startedAt: session.check_in_timestamp,
          alreadyRunning: Boolean(open),
        },
        200,
        req,
      );
    }

    // POST /mobile/time-tracking/stop
    //
    // Stopping the clock is NOT finishing the job. The screen has a separate
    // status control, so this closes the session and leaves the ticket where it
    // is - unlike the session check-out path above, which is the "I am done
    // here" action and does complete the ticket.
    if (req.method === 'POST' && resource === 'time-tracking' && resourceId === 'stop') {
      const body = await req.json().catch(() => ({}) as Record<string, unknown>);
      const ticketId = (body.ticketId ?? body.ticket_id ?? body.serviceTicketId) as
        | string
        | undefined;
      if (!ticketId) {
        return createCorsResponse({ error: 'ticketId is required' }, 400, req);
      }

      const denied = await denyIfTicketOutOfScope(ticketId);
      if (denied) return denied;

      const { data: open } = await admin
        .from('mobile_service_sessions')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('service_ticket_id', ticketId)
        .eq('technician_id', user.id)
        .is('check_out_timestamp', null)
        .order('check_in_timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!open) {
        // Not an error - the clock is already stopped. Saying so beats a 500
        // that makes the technician press it again.
        return createCorsResponse(
          { success: true, stopped: false, reason: 'No running timer for this ticket' },
          200,
          req,
        );
      }

      const stoppedAt = new Date().toISOString();
      const totalHours =
        (new Date(stoppedAt).getTime() - new Date(open.check_in_timestamp).getTime()) / 3_600_000;
      const breakHours = Number(open.break_hours ?? 0) || 0;

      const { data: session, error } = await admin
        .from('mobile_service_sessions')
        .update({
          check_out_timestamp: stoppedAt,
          check_out_latitude: body.latitude ?? null,
          check_out_longitude: body.longitude ?? null,
          check_out_address: body.address ?? null,
          // A clock that ran backwards records nothing rather than a negative
          // number somebody gets paid on.
          total_hours: totalHours >= 0 ? totalHours.toFixed(2) : null,
          working_hours: totalHours >= 0 ? Math.max(0, totalHours - breakHours).toFixed(2) : null,
          status: 'completed',
          updated_at: stoppedAt,
        })
        .eq('id', open.id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error stopping time tracking:', error);
        return createCorsResponse(
          { error: 'Failed to stop time tracking', details: error.message },
          500,
          req,
        );
      }

      await admin.from('time_tracking_entries').insert({
        tenant_id: tenantId,
        session_id: open.id,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        address: body.address ?? null,
        check_in_type: 'departure',
        timestamp: stoppedAt,
        notes: (body.notes as string) ?? 'Timer stopped',
        created_at: stoppedAt,
      });

      return createCorsResponse(
        {
          success: true,
          stopped: true,
          sessionId: session.id,
          stoppedAt,
          totalHours: session.total_hours,
          workingHours: session.working_hours,
        },
        200,
        req,
      );
    }

    // POST /mobile/service-tickets/:id/status
    //
    // The Express version passed the body straight through, so anything outside
    // WF-V-05's vocabulary was a 23514 reported as a generic failure. Aliases
    // are normalized ('in-progress' means the same thing) and an unknown value
    // is refused WITH the vocabulary, which is the part that stops it growing a
    // fifth spelling.
    if (
      (req.method === 'POST' || req.method === 'PATCH') &&
      resource === 'service-tickets' &&
      resourceId &&
      subAction === 'status'
    ) {
      const body = await req.json().catch(() => ({}) as Record<string, unknown>);
      const status = normalizeTicketStatus(body.status);
      if (!status) {
        return createCorsResponse(
          {
            error: 'Unknown ticket status',
            code: 'UNKNOWN_STATUS',
            allowed: SERVICE_TICKET_STATUSES,
          },
          400,
          req,
        );
      }

      const denied = await denyIfTicketOutOfScope(resourceId);
      if (denied) return denied;

      const nowIso = new Date().toISOString();
      const patch: Record<string, unknown> = { status, updated_at: nowIso };
      if (status === 'completed') patch.resolved_at = nowIso;

      const { data: ticket, error } = await admin
        .from('service_tickets')
        .update(patch)
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .select('id, status, resolved_at')
        .maybeSingle();

      if (error) {
        console.error('Error updating ticket status:', error);
        return createCorsResponse(
          { error: 'Failed to update ticket status', details: error.message },
          500,
          req,
        );
      }

      return createCorsResponse({ success: true, status, ticket }, 200, req);
    }

    // ========================================
    // PHOTOS ENDPOINTS
    // ========================================

    // POST /mobile/photos - Upload photo metadata (actual file handled separately)
    if (req.method === 'POST' && resource === 'photos' && !resourceId) {
      const body = await req.json();

      const photoData = {
        tenant_id: tenantId,
        service_ticket_id: body.serviceTicketId || body.service_ticket_id,
        session_id: body.sessionId || body.session_id || null,
        file_name: body.fileName || body.file_name,
        original_name: body.originalName || body.original_name || body.fileName || body.file_name,
        mime_type: body.mimeType || body.mime_type || 'image/jpeg',
        file_size: body.fileSize || body.file_size || null,
        object_path: body.objectPath || body.object_path,
        latitude: body.latitude || null,
        longitude: body.longitude || null,
        address: body.address || null,
        category: body.category || 'during', // 'before', 'during', 'after', 'damage', 'parts', 'completed'
        description: body.description || null,
        taken_at: body.takenAt || body.taken_at || new Date().toISOString(),
        uploaded_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      if (!photoData.service_ticket_id) {
        return createCorsResponse({ error: 'Service ticket ID is required' }, 400, req);
      }

      if (!photoData.file_name || !photoData.object_path) {
        return createCorsResponse({ error: 'File name and object path are required' }, 400, req);
      }

      const { data: photo, error } = await admin
        .from('service_photos')
        .insert(photoData)
        .select()
        .single();

      if (error) {
        console.error('Error creating photo record:', error);
        return createCorsResponse(
          { error: 'Failed to create photo record', details: error },
          500,
          req,
        );
      }

      return createCorsResponse(photo, 201, req);
    }

    // GET /mobile/photos/:ticketId - Get photos for a service ticket
    if (req.method === 'GET' && resource === 'photos' && resourceId) {
      const category = url.searchParams.get('category');
      const sessionId = url.searchParams.get('sessionId') || url.searchParams.get('session_id');
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = admin
        .from('service_photos')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('service_ticket_id', resourceId)
        .order('taken_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (category) {
        query = query.eq('category', category);
      }

      if (sessionId) {
        query = query.eq('session_id', sessionId);
      }

      const { data: photos, error, count } = await query;

      if (error) {
        console.error('Error fetching photos:', error);
        return createCorsResponse({ error: 'Failed to fetch photos' }, 500, req);
      }

      return createCorsResponse(
        {
          data: photos || [],
          total: count || 0,
          limit,
          offset,
        },
        200,
        req,
      );
    }

    // DELETE /mobile/photos/:id - Delete photo
    if (req.method === 'DELETE' && resource === 'photos' && resourceId) {
      // Fetch photo to get object path for storage deletion
      const { data: photo } = await admin
        .from('service_photos')
        .select('object_path')
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .single();

      if (!photo) {
        return createCorsResponse({ error: 'Photo not found' }, 404, req);
      }

      // Delete from database
      const { error } = await admin
        .from('service_photos')
        .delete()
        .eq('id', resourceId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting photo:', error);
        return createCorsResponse({ error: 'Failed to delete photo' }, 500, req);
      }

      // Note: Actual file deletion from storage should be handled separately
      // or through a storage trigger/lifecycle policy
      return createCorsResponse(
        {
          success: true,
          message: 'Photo deleted',
          objectPath: photo.object_path,
        },
        200,
        req,
      );
    }

    // ========================================
    // SYNC ENDPOINTS
    // ========================================

    // GET /mobile/sync - Get data to sync to mobile device
    if (req.method === 'GET' && resource === 'sync') {
      const technicianId = await resolveTechnicianId();
      if (!technicianId) return notYours();
      const lastSyncAt = url.searchParams.get('lastSyncAt') || url.searchParams.get('last_sync_at');
      const includeCompleted = url.searchParams.get('includeCompleted') === 'true';

      // Fetch assigned service tickets
      let ticketsQuery = admin
        .from('service_tickets')
        .select(
          `
          *,
          customer:business_records!service_tickets_customer_id_fkey(
            id, company_name, primary_contact_name, primary_contact_email, primary_contact_phone,
            address_line1, address_line2, city, state, postal_code
          ),
          equipment:equipment(id, serial_number, model_number, manufacturer, location_description)
        `,
        )
        .eq('tenant_id', tenantId)
        .eq('assigned_technician_id', technicianId)
        .order('scheduled_date', { ascending: true });

      if (!includeCompleted) {
        ticketsQuery = ticketsQuery.not('status', 'eq', 'completed');
      }

      if (lastSyncAt) {
        ticketsQuery = ticketsQuery.gte('updated_at', lastSyncAt);
      }

      const { data: tickets, error: ticketsError } = await ticketsQuery;

      if (ticketsError) {
        console.error('Error fetching tickets for sync:', ticketsError);
        return createCorsResponse({ error: 'Failed to fetch sync data' }, 500, req);
      }

      // Fetch active sessions
      const { data: sessions, error: sessionsError } = await admin
        .from('mobile_service_sessions')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('technician_id', technicianId)
        .neq('status', 'completed')
        .order('created_at', { ascending: false });

      if (sessionsError) {
        console.error('Error fetching sessions for sync:', sessionsError);
      }

      // Fetch photos for active tickets
      const ticketIds = tickets?.map((t: any) => t.id) || [];
      let photos: any[] = [];
      if (ticketIds.length > 0) {
        const { data: photoData, error: photosError } = await admin
          .from('service_photos')
          .select('*')
          .eq('tenant_id', tenantId)
          .in('service_ticket_id', ticketIds);

        if (!photosError) {
          photos = photoData || [];
        }
      }

      return createCorsResponse(
        {
          syncedAt: new Date().toISOString(),
          technician: {
            id: user.id,
            email: user.email,
          },
          data: {
            serviceTickets: tickets || [],
            activeSessions: sessions || [],
            photos: photos,
          },
          counts: {
            serviceTickets: tickets?.length || 0,
            activeSessions: sessions?.length || 0,
            photos: photos.length,
          },
        },
        200,
        req,
      );
    }

    // POST /mobile/sync - Submit offline data from mobile
    if (req.method === 'POST' && resource === 'sync') {
      const body = await req.json();
      const results: {
        sessions: { created: number; updated: number; errors: string[] };
        photos: { created: number; errors: string[] };
        timeEntries: { created: number; errors: string[] };
        locationHistory: { created: number; errors: string[] };
      } = {
        sessions: { created: 0, updated: 0, errors: [] },
        photos: { created: 0, errors: [] },
        timeEntries: { created: 0, errors: [] },
        locationHistory: { created: 0, errors: [] },
      };

      // Process session updates
      if (body.sessions && Array.isArray(body.sessions)) {
        for (const sessionData of body.sessions) {
          try {
            const data = {
              tenant_id: tenantId,
              service_ticket_id: sessionData.serviceTicketId || sessionData.service_ticket_id,
              technician_id: sessionData.technicianId || sessionData.technician_id || user.id,
              check_in_latitude: sessionData.checkInLatitude || sessionData.check_in_latitude,
              check_in_longitude: sessionData.checkInLongitude || sessionData.check_in_longitude,
              check_in_address: sessionData.checkInAddress || sessionData.check_in_address,
              check_in_timestamp: sessionData.checkInTimestamp || sessionData.check_in_timestamp,
              check_out_latitude: sessionData.checkOutLatitude || sessionData.check_out_latitude,
              check_out_longitude: sessionData.checkOutLongitude || sessionData.check_out_longitude,
              check_out_address: sessionData.checkOutAddress || sessionData.check_out_address,
              check_out_timestamp: sessionData.checkOutTimestamp || sessionData.check_out_timestamp,
              total_hours: sessionData.totalHours || sessionData.total_hours,
              break_hours: sessionData.breakHours || sessionData.break_hours,
              working_hours: sessionData.workingHours || sessionData.working_hours,
              status: sessionData.status,
              service_notes: sessionData.serviceNotes || sessionData.service_notes,
              customer_signature: sessionData.customerSignature || sessionData.customer_signature,
              updated_at: new Date().toISOString(),
            };

            if (sessionData.id) {
              // Update existing session
              const { error } = await admin
                .from('mobile_service_sessions')
                .update(data)
                .eq('id', sessionData.id)
                .eq('tenant_id', tenantId);

              if (error) {
                results.sessions.errors.push(
                  `Failed to update session ${sessionData.id}: ${error.message}`,
                );
              } else {
                results.sessions.updated++;
              }
            } else {
              // Create new session
              data.created_at = new Date().toISOString();
              const { error } = await admin.from('mobile_service_sessions').insert(data);

              if (error) {
                results.sessions.errors.push(`Failed to create session: ${error.message}`);
              } else {
                results.sessions.created++;
              }
            }
          } catch (err) {
            results.sessions.errors.push(`Session processing error: ${err}`);
          }
        }
      }

      // Process photo metadata
      if (body.photos && Array.isArray(body.photos)) {
        const photoRows: Record<string, unknown>[] = [];
        for (const photoData of body.photos) {
          try {
            const data = {
              tenant_id: tenantId,
              service_ticket_id: photoData.serviceTicketId || photoData.service_ticket_id,
              session_id: photoData.sessionId || photoData.session_id,
              file_name: photoData.fileName || photoData.file_name,
              original_name: photoData.originalName || photoData.original_name,
              mime_type: photoData.mimeType || photoData.mime_type || 'image/jpeg',
              file_size: photoData.fileSize || photoData.file_size,
              object_path: photoData.objectPath || photoData.object_path,
              latitude: photoData.latitude,
              longitude: photoData.longitude,
              address: photoData.address,
              category: photoData.category || 'during',
              description: photoData.description,
              taken_at: photoData.takenAt || photoData.taken_at,
              uploaded_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            };

            photoRows.push(data);
          } catch (err) {
            results.photos.errors.push(`Photo processing error: ${err}`);
          }
        }

        // PERF-NPLUS1-002: one insert per 200 photos rather than one per photo.
        // A technician syncing a day's work offline posts every photo at once,
        // and this was a round trip each in a request the app retries on
        // timeout. onError keeps the per-photo failure message the response
        // reports - a batched write that silently returned fewer rows would
        // turn a named failure into a missing record.
        results.photos.created = (
          await writeInBatches(
            photoRows,
            (batch) => admin.from('service_photos').insert(batch).select('id'),
            WRITE_BATCH,
            (_row, error) =>
              results.photos.errors.push(
                `Failed to create photo: ${(error as { message?: string })?.message ?? error}`,
              ),
          )
        ).length;
      }

      // Process time tracking entries
      if (body.timeEntries && Array.isArray(body.timeEntries)) {
        const timeEntryRows: Record<string, unknown>[] = [];
        for (const entryData of body.timeEntries) {
          try {
            const data = {
              tenant_id: tenantId,
              session_id: entryData.sessionId || entryData.session_id,
              latitude: entryData.latitude,
              longitude: entryData.longitude,
              address: entryData.address,
              check_in_type: entryData.checkInType || entryData.check_in_type,
              timestamp: entryData.timestamp,
              notes: entryData.notes,
              created_at: new Date().toISOString(),
            };

            timeEntryRows.push(data);
          } catch (err) {
            results.timeEntries.errors.push(`Time entry processing error: ${err}`);
          }
        }

        results.timeEntries.created = (
          await writeInBatches(
            timeEntryRows,
            (batch) => admin.from('time_tracking_entries').insert(batch).select('id'),
            WRITE_BATCH,
            (_row, error) =>
              results.timeEntries.errors.push(
                `Failed to create time entry: ${(error as { message?: string })?.message ?? error}`,
              ),
          )
        ).length;
      }

      // Process location history
      if (body.locationHistory && Array.isArray(body.locationHistory)) {
        const locationRows: Record<string, unknown>[] = [];
        for (const locationData of body.locationHistory) {
          try {
            const data = {
              tenant_id: tenantId,
              technician_id: locationData.technicianId || locationData.technician_id || user.id,
              session_id: locationData.sessionId || locationData.session_id,
              latitude: locationData.latitude,
              longitude: locationData.longitude,
              accuracy: locationData.accuracy,
              address: locationData.address,
              timestamp: locationData.timestamp,
              speed: locationData.speed,
              heading: locationData.heading,
              created_at: new Date().toISOString(),
            };

            locationRows.push(data);
          } catch (err) {
            results.locationHistory.errors.push(`Location history processing error: ${err}`);
          }
        }

        results.locationHistory.created = (
          await writeInBatches(
            locationRows,
            (batch) => admin.from('location_history').insert(batch).select('id'),
            WRITE_BATCH,
            (_row, error) =>
              results.locationHistory.errors.push(
                `Failed to create location entry: ${(error as { message?: string })?.message ?? error}`,
              ),
          )
        ).length;
      }

      const hasErrors =
        results.sessions.errors.length > 0 ||
        results.photos.errors.length > 0 ||
        results.timeEntries.errors.length > 0 ||
        results.locationHistory.errors.length > 0;

      return createCorsResponse(
        {
          success: !hasErrors,
          syncedAt: new Date().toISOString(),
          results,
          summary: {
            sessionsCreated: results.sessions.created,
            sessionsUpdated: results.sessions.updated,
            photosCreated: results.photos.created,
            timeEntriesCreated: results.timeEntries.created,
            locationEntriesCreated: results.locationHistory.created,
            totalErrors:
              results.sessions.errors.length +
              results.photos.errors.length +
              results.timeEntries.errors.length +
              results.locationHistory.errors.length,
          },
        },
        hasErrors ? 207 : 200, // 207 Multi-Status if partial success
        req,
      );
    }

    // Method not allowed
    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Unexpected error in mobile function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
