// Service Tickets Edge Function
// Handles service ticket CRUD and dispatch operations
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { enrichTickets } from './_enrich.ts';
import { applyUserScope, resolveScope, rowInScope } from '../_shared/scope.ts';
import {
  ATTACHMENT_BUCKET,
  ATTACHMENT_URL_TTL_SECONDS,
  MAX_ATTACHMENT_BYTES,
  planTicketAttachment,
} from '../_shared/ticket-attachment.ts';
import { applyTicketFields, assignmentNotification, dispatchLoad } from './_dispatch.ts';
import {
  OPEN_TICKET_STATUSES,
  SERVICE_TICKET_PRIORITIES,
  SERVICE_TICKET_STATUSES,
  normalizeTicketPriority,
  normalizeTicketStatus,
  PRIORITY_ALIASES,
  STATUS_ALIASES,
  ticketVocabulary,
} from '../_shared/service-ticket-vocabulary.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';
import { toCamelShallow } from '../_shared/case.ts';
import { buildAnalysisRow, ticketStatusForOutcome } from '../_shared/service-call-analysis.ts';
import { ilikeAnyFilter } from '../_shared/postgrest-or.ts';

// Helper: Batch-enrich records with customer names from business_records
/**
 * Create the attachments bucket if it is missing, PRIVATE.
 *
 * `public: false` is the whole point and is not a default worth relying on -
 * docs/storage-bucket-inventory.md records that reading the code tells you
 * nothing about whether an object is world-readable, so the creation call says
 * it explicitly and the allowed types are pinned at the bucket as well as in
 * the planner.
 */
async function ensureAttachmentBucket(admin: {
  storage: {
    getBucket: (id: string) => Promise<{ data: unknown }>;
    createBucket: (id: string, opts: Record<string, unknown>) => Promise<unknown>;
  };
}) {
  const { data } = await admin.storage.getBucket(ATTACHMENT_BUCKET);
  if (data) return;
  await admin.storage.createBucket(ATTACHMENT_BUCKET, {
    public: false,
    fileSizeLimit: MAX_ATTACHMENT_BYTES,
  });
}

export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Extract and validate JWT
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

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
    const { parts } = normalizePath(url.pathname, 'service-tickets');
    const ticketId = parts[0]; // /service-tickets/:id
    const subResource = parts[1]; // /service-tickets/:id/updates

    // GET /service-tickets/stats - status/priority counts across ALL tickets
    // (not just the current page) for the dashboard stat cards.
    /**
     * WF-R-07: is this ticket the caller's to act on?
     *
     * A list filter narrows what a technician can BROWSE and says nothing about a
     * write aimed at an id, so before this any authenticated member of the tenant
     * could reassign, close, void or delete anybody's ticket. Returns null when
     * the write may proceed, and null for a ticket that does not exist so the
     * handler keeps answering its own 404 instead of leaking which ids are real.
     */
    const denyIfTicketOutOfScope = async (id: string): Promise<Response | null> => {
      const { data: existing } = await admin
        .from('service_tickets')
        .select('id, assigned_technician_id, created_by')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (!existing) return null;

      const scope = await resolveScope(admin, {
        userId: user.id,
        tenantId,
        appMetadata: user.app_metadata,
      });
      if (rowInScope(existing, ['assigned_technician_id', 'created_by'], scope)) return null;

      return createCorsResponse(
        { error: 'This ticket is outside your scope', code: 'ROW_OUT_OF_SCOPE' },
        403,
        req,
      );
    };

    // GET /service-tickets/vocabulary - the one status and priority list
    //
    // WF-V-05. Four vocabularies were in play and no constraint enforced any, so
    // a filter offering `new` matched nothing and one offering `emergency`
    // matched nothing either. Served rather than duplicated into each select, so
    // adding a status is one edit.
    if (req.method === 'GET' && ticketId === 'vocabulary' && !subResource) {
      return createCorsResponse(ticketVocabulary(), 200, req);
    }

    if (req.method === 'GET' && ticketId === 'stats') {
      const base = () =>
        admin
          .from('service_tickets')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId);
      // WF-V-01 counted BOTH spellings because the vocabulary was unsettled;
      // WF-V-05 settled it, so the alias lists come from the vocabulary module
      // instead of being written out here. They are still counted - rows written
      // before the backfill may carry the old spelling - but from one list, so a
      // new alias reaches the stats card without a second edit.
      const alias = (canonical: string) => [
        canonical,
        ...Object.entries(STATUS_ALIASES)
          .filter(([, v]) => v === canonical)
          .map(([k]) => k),
      ];
      const [total, open, inProgress, urgent, resolved] = await Promise.all([
        base(),
        base().in('status', alias('open')),
        base().in('status', alias('in_progress')),
        base().in('priority', [
          'urgent',
          ...Object.entries(PRIORITY_ALIASES)
            .filter(([, v]) => v === 'urgent')
            .map(([k]) => k),
        ]),
        base().in('status', alias('completed')),
      ]);
      return createCorsResponse(
        {
          total: total.count || 0,
          open: open.count || 0,
          in_progress: inProgress.count || 0,
          urgent: urgent.count || 0,
          resolved: resolved.count || 0,
        },
        200,
        req,
      );
    }

    // GET /service-tickets - List all tickets with filters
    // GET /service-tickets/dispatch-load - open ticket counts per technician
    //
    // WF-V-03. The board needs "how busy is each technician" and the honest source
    // is the tickets themselves. Counted SERVER-side rather than from the board's
    // own ticket list, because that list is scoped to the caller and counting from
    // it would under-report anyone whose other work the dispatcher cannot see - a
    // number that looks precise and is quietly wrong.
    if (req.method === 'GET' && ticketId === 'dispatch-load' && !subResource) {
      const { data: rows, error } = await admin
        .from('service_tickets')
        .select('assigned_technician_id, status, scheduled_date')
        .eq('tenant_id', tenantId)
        .in('status', OPEN_TICKET_STATUSES)
        .limit(2000);

      if (error) {
        console.error('Error computing dispatch load:', error);
        return createCorsResponse({ error: 'Failed to compute dispatch load' }, 500, req);
      }

      const today = new Date().toISOString().slice(0, 10);
      const summary = dispatchLoad(rows ?? [], today);

      return createCorsResponse(summary, 200, req);
    }

    if (req.method === 'GET' && !ticketId) {
      const status = url.searchParams.get('status');
      const priority = url.searchParams.get('priority');
      const customerId = url.searchParams.get('customerId') || url.searchParams.get('customer_id');
      const technicianId =
        url.searchParams.get('technicianId') || url.searchParams.get('technician_id');
      const search = url.searchParams.get('search');
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = admin
        .from('service_tickets')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // WF-R-04: a technician's queue is their own tickets, not the tenant's.
      // Unassigned tickets stay visible above `own` scope - a dispatch queue that
      // hides the work nobody has picked up yet is worse than no filter at all.
      const scope = await resolveScope(admin, {
        userId: user.id,
        tenantId,
        appMetadata: user.app_metadata,
        requestedScope: url.searchParams.get('scope'),
      });
      query = applyUserScope(query, ['assigned_technician_id', 'created_by'], scope);

      if (status) {
        query = query.eq('status', status);
      }

      if (priority) {
        query = query.eq('priority', priority);
      }

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      if (technicianId) {
        query = query.eq('assigned_technician_id', technicianId);
      }

      if (search) {
        query = query.or(ilikeAnyFilter(['ticket_number', 'title', 'description'], search));
      }

      const { data: tickets, error, count } = await query;

      if (error) {
        console.error('Error fetching service tickets:', error);
        return createCorsResponse({ error: 'Failed to fetch service tickets' }, 500, req);
      }

      // WF-V-01: the machine and the technician, not just the customer.
      const enriched = await enrichTickets(admin, tenantId, tickets || []);
      return createCorsResponse({ data: enriched, total: count || 0 }, 200, req);
    }

    // GET/POST /service-tickets/:id/analysis
    //
    // Round 163. ServiceTicketAnalysis.tsx lists and records visit analyses
    // here and nothing served it on either host: this function had no
    // `analysis` branch, and /api/service-tickets is proxied, so the Express
    // handlers for this path never ran in dev either. The write plan and the
    // ticket side effect live in _shared/service-call-analysis.ts. The ticket
    // must exist and be in the caller's scope before either half runs.
    if (ticketId && subResource === 'analysis' && (req.method === 'GET' || req.method === 'POST')) {
      const { data: ticketRow, error: ticketError } = await admin
        .from('service_tickets')
        .select('id')
        .eq('id', ticketId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (ticketError) {
        return createCorsResponse({ error: 'Failed to load ticket' }, 500, req);
      }
      if (!ticketRow) {
        return createCorsResponse({ error: 'Service ticket not found' }, 404, req);
      }
      const denied = await denyIfTicketOutOfScope(ticketId);
      if (denied) return denied;

      if (req.method === 'GET') {
        const { data: analyses, error } = await admin
          .from('service_call_analysis')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('service_ticket_id', ticketId)
          .order('created_at', { ascending: false });
        if (error) {
          return createCorsResponse({ error: 'Failed to fetch service analysis' }, 500, req);
        }
        return createCorsResponse((analyses ?? []).map(toCamelShallow), 200, req);
      }

      const body = await req.json().catch(() => ({}));
      const plan = buildAnalysisRow(body, { tenantId, ticketId, userId: user.id }, 'create');
      if (plan.invalid.length > 0) {
        return createCorsResponse(
          { error: 'Invalid analysis', code: 'INVALID_ANALYSIS', invalid: plan.invalid },
          400,
          req,
        );
      }

      const { data: analysis, error } = await admin
        .from('service_call_analysis')
        .insert(plan.row)
        .select()
        .single();
      if (error) {
        console.error('Error creating service analysis:', error);
        return createCorsResponse({ error: 'Failed to create service analysis' }, 500, req);
      }

      // The analysis is stored; the ticket move is reported rather than
      // allowed to fail the request, because the analysis is the record.
      const nextStatus = ticketStatusForOutcome(plan.row.outcome);
      let ticketStatusUpdated: boolean | null = null;
      if (nextStatus) {
        const { error: statusError } = await admin
          .from('service_tickets')
          .update({ status: nextStatus, updated_at: new Date().toISOString() })
          .eq('id', ticketId)
          .eq('tenant_id', tenantId);
        ticketStatusUpdated = !statusError;
        if (statusError) console.error('Error moving ticket after analysis:', statusError.message);
      }

      return createCorsResponse(
        {
          ...toCamelShallow(analysis),
          ticketStatus: nextStatus,
          ticketStatusUpdated,
          ignoredFields: plan.ignoredFields,
        },
        201,
        req,
      );
    }

    // GET /service-tickets/:id/updates - Get ticket timeline/updates
    if (req.method === 'GET' && ticketId && subResource === 'updates') {
      const { data: updates, error } = await admin
        .from('service_ticket_updates')
        .select('*')
        .eq('ticket_id', ticketId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching ticket updates:', error);
        return createCorsResponse({ error: 'Failed to fetch ticket updates' }, 500, req);
      }

      // Enrich updates with user info
      if (updates && updates.length > 0) {
        const userIds = [...new Set(updates.map((u: any) => u.updated_by).filter(Boolean))];
        if (userIds.length > 0) {
          const { data: users } = await admin
            .from('users')
            .select('id, first_name, last_name, email')
            .in('id', userIds);
          const userMap = new Map((users || []).map((u: any) => [u.id, u]));
          const enrichedUpdates = updates.map((u: any) => ({
            ...u,
            user: userMap.get(u.updated_by) || null,
          }));
          return createCorsResponse(enrichedUpdates, 200, req);
        }
      }

      return createCorsResponse(updates || [], 200, req);
    }

    // GET/POST /service-tickets/:id/attachments
    //
    // PROD-008. The iOS ticket photo picker posts here and NOTHING served it:
    // this function had no `attachments` branch, so the upload fell through to
    // the trailing 405, and Express has no handler either. `POST /mobile/photos`
    // reads like the existing implementation and is not - its own header says
    // "actual file handled separately" and it requires an `object_path` that
    // nothing in this tree produces, so the metadata half shipped and the file
    // half never did.
    //
    // The bytes go THROUGH the function (SEC-SVG-002) into a PRIVATE bucket,
    // and what comes back out is a short-lived signed URL: a site photo carries
    // a customer's equipment, serials and premises, so this is the
    // qbr-artifacts case and not the public-logo one.
    if (
      ticketId &&
      subResource === 'attachments' &&
      (req.method === 'GET' || req.method === 'POST')
    ) {
      // Not-found is answered here rather than inside denyIfTicketOutOfScope,
      // which returns null for a missing ticket on purpose so each handler
      // keeps its own 404 and no branch leaks which ids are real.
      const { data: ticket } = await admin
        .from('service_tickets')
        .select('id')
        .eq('id', ticketId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (!ticket) {
        return createCorsResponse({ error: 'Service ticket not found' }, 404, req);
      }

      const denied = await denyIfTicketOutOfScope(ticketId);
      if (denied) return denied;

      if (req.method === 'GET') {
        const { data: photos, error } = await admin
          .from('service_photos')
          .select('*')
          .eq('service_ticket_id', ticketId)
          .eq('tenant_id', tenantId)
          .order('taken_at', { ascending: false });

        if (error) {
          console.error('Error fetching ticket attachments:', error);
          return createCorsResponse({ error: 'Failed to fetch attachments' }, 500, req);
        }

        // Signed, never public. getPublicUrl hands back a URL whether or not
        // the bucket is public, which is exactly how the QBR decks came to be
        // world-readable - a link that looks right is not evidence the object
        // is meant to be fetchable.
        //
        // One batched call rather than one per row: createSignedUrls takes the
        // whole list, so a ticket with twenty photos is one round trip and the
        // N+1 report has nothing to classify.
        const paths = (photos ?? []).map((p: any) => p.object_path).filter(Boolean);
        const signedByPath = new Map<string, string>();
        if (paths.length > 0) {
          const { data: signedList } = await admin.storage
            .from(ATTACHMENT_BUCKET)
            .createSignedUrls(paths, ATTACHMENT_URL_TTL_SECONDS);
          for (const entry of signedList ?? []) {
            if (entry.path && entry.signedUrl) signedByPath.set(entry.path, entry.signedUrl);
          }
        }
        return createCorsResponse(
          (photos ?? []).map((photo: any) => ({
            ...photo,
            url: signedByPath.get(photo.object_path) ?? null,
          })),
          200,
          req,
        );
      }

      const body = await req.json().catch(() => ({}) as Record<string, unknown>);
      const plan = planTicketAttachment(body, {
        tenantId,
        ticketId,
        uuid: crypto.randomUUID(),
      });

      if (plan.error || !plan.bytes || !plan.storagePath || !plan.mime) {
        return createCorsResponse(
          {
            error: plan.error?.message ?? 'Attachment rejected',
            code: plan.error?.code ?? 'ATTACHMENT_REJECTED',
          },
          plan.error?.status ?? 400,
          req,
        );
      }

      await ensureAttachmentBucket(admin);

      const { error: upErr } = await admin.storage
        .from(ATTACHMENT_BUCKET)
        .upload(plan.storagePath, plan.bytes, {
          // The SNIFFED type. The client's `mimeType` is a string it chose.
          contentType: plan.mime,
          upsert: false,
        });
      if (upErr) {
        console.error('Error uploading ticket attachment:', upErr);
        return createCorsResponse(
          { error: 'Failed to store attachment', details: upErr.message },
          500,
          req,
        );
      }

      const { data: photo, error } = await admin
        .from('service_photos')
        .insert({
          tenant_id: tenantId,
          service_ticket_id: ticketId,
          file_name: plan.fileName,
          original_name: plan.originalName,
          mime_type: plan.mime,
          file_size: plan.bytes.length,
          object_path: plan.storagePath,
          category: typeof body.category === 'string' ? body.category : 'during',
          description: typeof body.description === 'string' ? body.description : null,
          taken_at: new Date().toISOString(),
          uploaded_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        // The object is already in the bucket, so leaving it there on a failed
        // insert is an orphan nothing can reach. Remove it and report the
        // failure rather than answering 201 for a photo with no row.
        await admin.storage.from(ATTACHMENT_BUCKET).remove([plan.storagePath]);
        console.error('Error recording ticket attachment:', error);
        return createCorsResponse(
          { error: 'Failed to record attachment', details: error.message },
          500,
          req,
        );
      }

      const { data: signed } = await admin.storage
        .from(ATTACHMENT_BUCKET)
        .createSignedUrl(plan.storagePath, ATTACHMENT_URL_TTL_SECONDS);

      return createCorsResponse({ ...photo, url: signed?.signedUrl ?? null }, 201, req);
    }

    // GET /service-tickets/:id - Get single ticket
    // An unknown sub-resource answers 404 rather than the parent record.
    // PA-020's rule: falling through to the row is what makes the NEXT missing
    // branch invisible - a component mapping over an object renders an empty
    // list and reports nothing, so the gap reads as "no data yet". Non-GET
    // methods already reach the terminal refusal below.
    if (req.method === 'GET' && ticketId && subResource) {
      return createCorsResponse(
        { error: `Unknown service ticket sub-resource: ${subResource}` },
        404,
        req,
      );
    }

    if (req.method === 'GET' && ticketId) {
      const { data: ticket, error } = await admin
        .from('service_tickets')
        .select('*')
        .eq('id', ticketId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching service ticket:', error);
        return createCorsResponse({ error: 'Service ticket not found' }, 404, req);
      }

      // Also fetch ticket updates
      const { data: updates } = await admin
        .from('service_ticket_updates')
        .select('*')
        .eq('ticket_id', ticketId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      // WF-V-01: the same three joins as the list, so a ticket does not gain or
      // lose fields depending on which screen opened it.
      const [enrichedTicket] = await enrichTickets(admin, tenantId, [ticket]);

      return createCorsResponse({ ...enrichedTicket, updates: updates || [] }, 200, req);
    }

    // POST /service-tickets - Create new ticket
    if (req.method === 'POST' && !ticketId) {
      const body = await req.json();

      // WF-V-05: refuse a status or priority outside the vocabulary. Sending one
      // used to store it, and a ticket in a status no filter offers is invisible
      // on every board that lists by status.
      const badStatus = body.status !== undefined && normalizeTicketStatus(body.status) === null;
      const badPriority =
        body.priority !== undefined && normalizeTicketPriority(body.priority) === null;
      if (badStatus || badPriority) {
        return createCorsResponse(
          {
            error: 'Unknown status or priority',
            code: 'INVALID_TICKET_VOCABULARY',
            rejected: [
              ...(badStatus ? [{ field: 'status', value: body.status }] : []),
              ...(badPriority ? [{ field: 'priority', value: body.priority }] : []),
            ],
            allowed: { status: SERVICE_TICKET_STATUSES, priority: SERVICE_TICKET_PRIORITIES },
          },
          400,
          req,
        );
      }

      // Generate ticket number if not provided
      const ticketNumber = body.ticketNumber || body.ticket_number || `TKT-${Date.now()}`;

      const ticketData = {
        tenant_id: tenantId,
        customer_id: body.customerId || body.customer_id,
        equipment_id: body.equipmentId || body.equipment_id || null,
        ticket_number: ticketNumber,
        title: body.title,
        description: body.description || null,
        // WF-V-05: normalized, and an unknown value is refused above rather
        // than written into a column no filter can match.
        priority: normalizeTicketPriority(body.priority) ?? 'medium',
        status: normalizeTicketStatus(body.status) ?? 'open',
        assigned_technician_id: body.assignedTechnicianId || body.assigned_technician_id || null,
        scheduled_date: body.scheduledDate || body.scheduled_date || null,
        estimated_duration: body.estimatedDuration || body.estimated_duration || null,
        customer_address: body.customerAddress || body.customer_address || null,
        customer_phone: body.customerPhone || body.customer_phone || null,
        required_skills: body.requiredSkills || body.required_skills || null,
        required_parts: body.requiredParts || body.required_parts || null,
        work_order_notes: body.workOrderNotes || body.work_order_notes || null,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: ticket, error } = await admin
        .from('service_tickets')
        .insert(ticketData)
        .select()
        .single();

      if (error) {
        console.error('Error creating service ticket:', error);
        return createCorsResponse(
          { error: 'Failed to create service ticket', details: error },
          500,
          req,
        );
      }

      // Create initial update entry
      await admin.from('service_ticket_updates').insert({
        tenant_id: tenantId,
        ticket_id: ticket.id,
        update_type: 'status_change',
        new_value: 'open',
        notes: 'Ticket created',
        updated_by: user.id,
        created_at: new Date().toISOString(),
      });

      return createCorsResponse(ticket, 201, req);
    }

    // POST /service-tickets/:id/updates - Add update to ticket
    if (req.method === 'POST' && ticketId && subResource === 'updates') {
      // An update is the audit trail of who did what to a ticket. Writing one on
      // somebody else's ticket puts words in their record.
      const denied = await denyIfTicketOutOfScope(ticketId);
      if (denied) return denied;

      const body = await req.json();

      const updateData = {
        tenant_id: tenantId,
        ticket_id: ticketId,
        update_type: body.updateType || body.update_type || 'note',
        old_value: body.oldValue || body.old_value || null,
        new_value: body.newValue || body.new_value || null,
        notes: body.notes || null,
        updated_by: user.id,
        created_at: new Date().toISOString(),
      };

      const { data: update, error } = await admin
        .from('service_ticket_updates')
        .insert(updateData)
        .select()
        .single();

      if (error) {
        console.error('Error creating ticket update:', error);
        return createCorsResponse({ error: 'Failed to create ticket update' }, 500, req);
      }

      // Update the ticket's updated_at timestamp
      await admin
        .from('service_tickets')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', ticketId)
        .eq('tenant_id', tenantId);

      return createCorsResponse(update, 201, req);
    }

    // PATCH /service-tickets/:id - Update ticket
    if ((req.method === 'PATCH' || req.method === 'PUT') && ticketId && !subResource) {
      // Assign, close and void all arrive here. A technician cannot close another
      // technician's ticket.
      const denied = await denyIfTicketOutOfScope(ticketId);
      if (denied) return denied;

      const body = await req.json();

      // Fetch current ticket for comparison
      const { data: currentTicket } = await admin
        .from('service_tickets')
        .select('*')
        .eq('id', ticketId)
        .eq('tenant_id', tenantId)
        .single();

      const { updateData, changes, rejected } = applyTicketFields(body, currentTicket);
      if (rejected.length > 0) {
        // A status or priority outside the vocabulary is a 400 naming what is
        // allowed, not a silent write that makes the ticket invisible to every
        // filter - which is what happened before there was a vocabulary.
        return createCorsResponse(
          {
            error: 'Unknown status or priority',
            code: 'INVALID_TICKET_VOCABULARY',
            rejected,
            allowed: {
              status: SERVICE_TICKET_STATUSES,
              priority: SERVICE_TICKET_PRIORITIES,
            },
          },
          400,
          req,
        );
      }
      updateData.updated_at = new Date().toISOString();

      // If status is completed, set resolved_at
      if (updateData.status === 'completed' && !currentTicket?.resolved_at) {
        updateData.resolved_at = new Date().toISOString();
      }

      const { data: ticket, error } = await admin
        .from('service_tickets')
        .update(updateData)
        .eq('id', ticketId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating service ticket:', error);
        return createCorsResponse({ error: 'Failed to update service ticket' }, 500, req);
      }

      // Create update entries for significant changes
      for (const change of changes) {
        if (['status', 'assigned_technician_id', 'priority'].includes(change.field)) {
          await admin.from('service_ticket_updates').insert({
            tenant_id: tenantId,
            ticket_id: ticketId,
            update_type: change.field === 'status' ? 'status_change' : 'assignment',
            old_value: String(change.oldValue || ''),
            new_value: String(change.newValue || ''),
            notes: `${change.field} updated`,
            updated_by: user.id,
            created_at: new Date().toISOString(),
          });
        }
      }

      // WF-V-03: tell the technician. A dispatch board that assigns silently means
      // the technician finds out by refreshing their queue, which is how a job sits
      // untouched for an afternoon. Never blocks the assignment: a failed
      // notification must not roll back a real dispatch, and user_notifications may
      // not exist on an older database (the notifications function 503s for that).
      const notification = assignmentNotification(
        changes,
        ticket,
        user.id,
        tenantId,
        ticketId,
        new Date().toISOString(),
      );
      if (notification) {
        try {
          await admin.from('user_notifications').insert(notification);
        } catch (notifyError) {
          console.warn('Assignment notification not sent:', notifyError);
        }
      }

      return createCorsResponse(ticket, 200, req);
    }

    // DELETE /service-tickets/:id - Delete ticket
    if (req.method === 'DELETE' && ticketId) {
      const denied = await denyIfTicketOutOfScope(ticketId);
      if (denied) return denied;

      // First delete related updates
      await admin
        .from('service_ticket_updates')
        .delete()
        .eq('ticket_id', ticketId)
        .eq('tenant_id', tenantId);

      // Then delete the ticket
      const { error } = await admin
        .from('service_tickets')
        .delete()
        .eq('id', ticketId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting service ticket:', error);
        return createCorsResponse({ error: 'Failed to delete service ticket' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Service ticket deleted' }, 200, req);
    }

    // Method not allowed
    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Unexpected error in service-tickets function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
