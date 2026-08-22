// Deals/Opportunities Edge Function
// Handles sales deals and opportunities management
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { buildSearchOr, DEAL_LIST_SPEC, parseCrmListQuery } from '../_shared/crm-list-query.ts';
import { dispatchWorkflowEventSafe } from '../_shared/workflow-dispatch.ts';
import {
  buildStageNameMap,
  findStageId,
  resolveStageId,
  type DealStageRow,
} from '../_shared/deal-stage.ts';

/** The tenant's pipeline stages. Small table; read once per request. */
async function loadStages(admin: any, tenantId: string): Promise<DealStageRow[]> {
  const { data, error } = await admin
    .from('deal_stages')
    .select('id, name, sort_order, is_active')
    .eq('tenant_id', tenantId);
  if (error) {
    console.error('Error loading deal stages:', error);
    return [];
  }
  return (data ?? []) as DealStageRow[];
}

/**
 * Raw snake row -> the shape the CRM table and the deal pages read.
 *
 * The handler selects '*', so it was returning business_name-style keys while
 * the registry named camelCase ones; Amount, Stage, Close Date, Company and
 * Created were all blank. Aliases are ADDED to the spread, so anything already
 * reading the snake keys keeps working. `stage` is the stage NAME, mapped from
 * stage_id in memory rather than through an FK embed — this handler avoids
 * embeds on purpose (the deals FKs are not reliably in the schema cache).
 */
function toDealResponse(deal: any, stageNames: Record<string, string>) {
  return {
    ...deal,
    title: deal.title,
    amount: deal.amount,
    stageId: deal.stage_id,
    stage: stageNames[deal.stage_id] ?? null,
    ownerId: deal.owner_id,
    customerId: deal.customer_id,
    companyName: deal.company_name,
    dealType: deal.deal_type,
    expectedCloseDate: deal.expected_close_date,
    actualCloseDate: deal.actual_close_date,
    primaryContactName: deal.primary_contact_name,
    primaryContactEmail: deal.primary_contact_email,
    primaryContactPhone: deal.primary_contact_phone,
    productsInterested: deal.products_interested,
    estimatedMonthlyValue: deal.estimated_monthly_value,
    lostReason: deal.lost_reason,
    lastActivityDate: deal.last_activity_date,
    nextFollowUpDate: deal.next_follow_up_date,
    createdById: deal.created_by_id,
    customFields: deal.custom_fields,
    createdAt: deal.created_at,
    updatedAt: deal.updated_at,
  };
}

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

    // Resolve tenant ID from the verified JWT (canonical). The x-tenant-id header
    // is only a fallback and must NEVER override the JWT tenant — otherwise any
    // authenticated user can read/write another tenant by spoofing the header.
    const jwtTenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string);
    const headerTenantId = req.headers.get('x-tenant-id') || undefined;
    const isPlatformAdmin =
      user.app_metadata?.isPlatformAdmin === true || user.app_metadata?.role === 'platform_admin';
    if (headerTenantId && jwtTenantId && headerTenantId !== jwtTenantId && !isPlatformAdmin) {
      return createCorsResponse(
        { error: 'Tenant access denied', code: 'TENANT_ACCESS_DENIED' },
        403,
        req,
      );
    }
    let tenantId = jwtTenantId || headerTenantId;

    if (!tenantId) {
      // Fallback: look up tenant from public.users
      const admin2 = createSupabaseServiceClient();
      const { data: dbUser } = await admin2
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .limit(1)
        .maybeSingle();
      tenantId = dbUser?.tenant_id;
    }

    if (!tenantId) {
      console.error('No tenant ID found for user:', user.id);
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const rawParts = url.pathname.split('/').filter(Boolean);
    // Normalize: strip function name from path if the relay preserved it
    const pathParts = rawParts[0] === 'deals' ? rawParts.slice(1) : rawParts;
    const dealId = pathParts[0];
    const subResource = pathParts[1]; // e.g. /deals/:id/activities

    // ─── /deals/:id/activities (EDGE-005b) ─────────────────────────────────
    // Ported from the legacy Express /api/deals-management/deals/:id/activities.
    // Uses the CANONICAL deal_activities schema (type/description/created_at) —
    // the old Express handler referenced drifted column names (activity_type/
    // created_by/follow_up_date) that do not exist on the table. Response is
    // mapped to camelCase to match the frontend ActivityEntry shape.
    if (dealId && subResource === 'activities') {
      if (req.method === 'GET') {
        const { data, error } = await admin
          .from('deal_activities')
          .select('*')
          .eq('deal_id', dealId)
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching deal activities:', error);
          return createCorsResponse({ error: 'Failed to fetch deal activities' }, 500, req);
        }

        const activities = (data ?? []).map((a: Record<string, any>) => ({
          id: a.id,
          dealId: a.deal_id,
          type: a.type,
          subject: a.subject,
          description: a.description,
          outcome: a.outcome,
          duration: a.duration,
          userId: a.user_id,
          createdAt: a.created_at,
        }));
        return createCorsResponse(activities, 200, req);
      }

      if (req.method === 'POST') {
        const body = await req.json();
        const activityData = {
          tenant_id: tenantId,
          deal_id: dealId,
          type: body.type || body.activityType || 'note',
          subject: body.subject ?? null,
          description: body.description ?? null,
          outcome: body.outcome ?? null,
          duration: body.duration ?? null,
          user_id: user.id,
          created_at: new Date().toISOString(),
        };
        const { data: created, error } = await admin
          .from('deal_activities')
          .insert(activityData)
          .select()
          .single();

        if (error) {
          console.error('Error creating deal activity:', error);
          return createCorsResponse({ error: 'Failed to create deal activity' }, 500, req);
        }
        return createCorsResponse(
          {
            id: created.id,
            dealId: created.deal_id,
            type: created.type,
            subject: created.subject,
            description: created.description,
            outcome: created.outcome,
            duration: created.duration,
            userId: created.user_id,
            createdAt: created.created_at,
          },
          201,
          req,
        );
      }

      return createCorsResponse({ error: 'Method not allowed' }, 405, req);
    }

    // ─── Bulk ops (EDGE-005b) — POST /deals/bulk-update | /deals/bulk-delete ──
    // Ported from legacy Express /api/deals-management/deals/bulk-{update,delete}.
    // COP-M01: this used to name deal_name, deal_value, stage and next_step.
    // None of them are columns on `deals` (migration 0000: title, amount,
    // stage_id, and no next_step at all), so a bulk update touching any of them
    // came back 42703. Aliases for the names callers actually send are kept, but
    // every VALUE below is a real column.
    const BULK_FIELD_MAP: Record<string, string> = {
      title: 'title',
      dealName: 'title',
      description: 'description',
      amount: 'amount',
      dealValue: 'amount',
      value: 'amount',
      stageId: 'stage_id',
      status: 'status',
      priority: 'priority',
      probability: 'probability',
      expectedCloseDate: 'expected_close_date',
      actualCloseDate: 'actual_close_date',
      ownerId: 'owner_id',
      customerId: 'customer_id',
      companyName: 'company_name',
      source: 'source',
      dealType: 'deal_type',
      lostReason: 'lost_reason',
      notes: 'notes',
    };

    if (req.method === 'POST' && dealId === 'bulk-update') {
      const body = await req.json();
      const ids: string[] = Array.isArray(body.dealIds) ? body.dealIds : [];
      const updates: Record<string, any> = body.updates ?? {};
      if (ids.length === 0) {
        return createCorsResponse({ error: 'dealIds required' }, 400, req);
      }
      const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
      for (const [camelKey, snakeKey] of Object.entries(BULK_FIELD_MAP)) {
        if (updates[camelKey] !== undefined) updateData[snakeKey] = updates[camelKey];
        else if (updates[snakeKey] !== undefined) updateData[snakeKey] = updates[snakeKey];
      }
      const { data, error } = await admin
        .from('deals')
        .update(updateData)
        .in('id', ids)
        .eq('tenant_id', tenantId)
        .select('id');
      if (error) {
        console.error('Error bulk-updating deals:', error);
        return createCorsResponse({ error: 'Failed to bulk-update deals' }, 500, req);
      }
      return createCorsResponse({ success: true, updated: data?.length ?? 0 }, 200, req);
    }

    if (req.method === 'POST' && dealId === 'bulk-delete') {
      const body = await req.json();
      const ids: string[] = Array.isArray(body.dealIds) ? body.dealIds : [];
      if (ids.length === 0) {
        return createCorsResponse({ error: 'dealIds required' }, 400, req);
      }
      const { error } = await admin.from('deals').delete().in('id', ids).eq('tenant_id', tenantId);
      if (error) {
        console.error('Error bulk-deleting deals:', error);
        return createCorsResponse({ error: 'Failed to bulk-delete deals' }, 500, req);
      }
      return createCorsResponse({ success: true, deleted: ids.length }, 200, req);
    }

    // GET /deals - List deals
    if (req.method === 'GET' && !dealId) {
      // COP-M01: the search filter named deal_name (42703 -> 500 on every
      // search) and the stage filter named a `stage` column that does not exist;
      // sortBy/sortOrder were ignored entirely. All three now come from the
      // shared spec.
      const q = parseCrmListQuery(url.searchParams, DEAL_LIST_SPEC);
      const ownerId = q.filters.ownerId || url.searchParams.get('owner_id');

      // Select deals without FK joins to avoid schema cache errors
      // (business_records table is deprecated, FK may not exist)
      let query = admin
        .from('deals')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order(q.sortColumn, { ascending: q.ascending })
        .range(q.offset, q.offset + q.limit - 1);

      const stages = await loadStages(admin, tenantId);

      // `stage` carries a slug from the hardcoded picker, so match it against the
      // tenant's own stages rather than comparing it to an id. findStageId does
      // NOT fall back to a default: an unrecognized slug must return nothing,
      // not a different column of the board.
      const requestedStage = q.filters.stageId || q.filters.stage;
      if (requestedStage) {
        query = query.eq('stage_id', findStageId(stages, requestedStage) ?? '');
      }

      if (ownerId) query = query.eq('owner_id', ownerId);
      if (q.filters.status) query = query.eq('status', q.filters.status);
      if (q.filters.priority) query = query.eq('priority', q.filters.priority);
      if (q.filters.customerId) query = query.eq('customer_id', q.filters.customerId);

      const searchOr = buildSearchOr(DEAL_LIST_SPEC, q.search);
      if (searchOr) query = query.or(searchOr);

      const { data: deals, error, count } = await query;

      if (error) {
        console.error('Error fetching deals:', error);
        return createCorsResponse(
          { error: 'Failed to fetch deals', details: error.message },
          500,
          req,
        );
      }

      const stageNames = buildStageNameMap(stages);
      return createCorsResponse(
        {
          data: (deals || []).map((deal: any) => toDealResponse(deal, stageNames)),
          total: count || 0,
          page: q.page,
          limit: q.limit,
        },
        200,
        req,
      );
    }

    // GET /deals/:id - Get single deal
    if (req.method === 'GET' && dealId) {
      // Select deal without FK joins to avoid schema cache errors
      const { data: deal, error } = await admin
        .from('deals')
        .select('*')
        .eq('id', dealId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching deal:', error);
        return createCorsResponse({ error: 'Deal not found' }, 404, req);
      }

      const stageNames = buildStageNameMap(await loadStages(admin, tenantId));
      return createCorsResponse(toDealResponse(deal, stageNames), 200, req);
    }

    // POST /deals - Create deal
    //
    // PROD-008b: `!dealId` is load-bearing. Without it this matched ANY POST
    // under the prefix, so POST /deals/<uuid> or /deals/<uuid>/<anything> the
    // function has no branch for fell through to here and CREATED A NEW DEAL
    // instead of answering 405. Same shape as the activities bulk-delete that
    // inserted a row; on `deals` it manufactures pipeline.
    if (req.method === 'POST' && !dealId) {
      const body = await req.json();

      // COP-M01: this used to insert business_record_id, deal_name, deal_value,
      // stage, next_step and created_by — six columns `deals` does not have —
      // while omitting stage_id and created_by_id, which are NOT NULL. Creating
      // a deal from the CRM page could not succeed in dev or production.
      const title = body.title || body.dealName || body.deal_name;
      if (!title) {
        return createCorsResponse({ error: 'title is required' }, 400, req);
      }

      const stages = await loadStages(admin, tenantId);
      const stageId = resolveStageId(stages, body.stageId || body.stage_id || body.stage);
      if (!stageId) {
        return createCorsResponse(
          {
            error:
              'No pipeline stages are configured for this tenant, so a deal cannot be created yet.',
            code: 'NO_DEAL_STAGES',
          },
          400,
          req,
        );
      }

      const amount = body.amount ?? body.value ?? body.dealValue ?? body.deal_value ?? 0;

      const dealData: Record<string, any> = {
        tenant_id: tenantId,
        title,
        description: body.description || null,
        amount,
        stage_id: stageId,
        probability: body.probability ?? 10,
        expected_close_date: body.expectedCloseDate || body.expected_close_date || null,
        owner_id: body.ownerId || body.owner_id || user.id,
        customer_id: body.customerId || body.customer_id || null,
        company_name: body.companyName || body.company_name || null,
        priority: body.priority || 'medium',
        source: body.source || null,
        deal_type: body.dealType || body.deal_type || null,
        primary_contact_name: body.primaryContactName || body.primary_contact_name || null,
        primary_contact_email: body.primaryContactEmail || body.primary_contact_email || null,
        primary_contact_phone: body.primaryContactPhone || body.primary_contact_phone || null,
        notes: body.notes || null,
        created_by_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (body.customFields || body.custom_fields) {
        dealData.custom_fields = body.customFields || body.custom_fields;
      }

      const { data: deal, error } = await admin.from('deals').insert(dealData).select().single();

      if (error) {
        console.error('Error creating deal:', error);
        return createCorsResponse({ error: 'Failed to create deal', details: error }, 500, req);
      }

      const stageNames = buildStageNameMap(stages);
      return createCorsResponse(toDealResponse(deal, stageNames), 201, req);
    }

    // PATCH /deals/:id - Update deal
    if ((req.method === 'PATCH' || req.method === 'PUT') && dealId) {
      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      // Same correction as the bulk map: every value is a real column. The old
      // map wrote deal_name, deal_value, stage, next_step and closed_date, so an
      // edit that touched the deal's name, amount or stage failed.
      const fieldMap: Record<string, string> = BULK_FIELD_MAP;

      for (const [camelKey, snakeKey] of Object.entries(fieldMap)) {
        if (body[camelKey] !== undefined || body[snakeKey] !== undefined) {
          updateData[snakeKey] = body[camelKey] !== undefined ? body[camelKey] : body[snakeKey];
        }
      }

      // A stage slug has to become a stage_id; an id passes straight through.
      const requestedStage = body.stageId ?? body.stage_id ?? body.stage;
      if (requestedStage !== undefined && requestedStage !== null && requestedStage !== '') {
        const resolved = resolveStageId(await loadStages(admin, tenantId), String(requestedStage));
        if (resolved) updateData.stage_id = resolved;
      }

      const { data: deal, error } = await admin
        .from('deals')
        .update(updateData)
        .eq('id', dealId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating deal:', error);
        return createCorsResponse({ error: 'Failed to update deal' }, 500, req);
      }

      // CRMX-008a: the deal.stage_changed trigger seam.
      //
      // It used to live only in server/routes-deals.ts, under a prefix this
      // edge function is proxied for, so it ran on neither host and no workflow
      // ever enrolled on a stage change. Dedupe by deal + new stage so a
      // repeated PUT does not enrol twice; Safe so automation can never fail
      // the update.
      if (updateData.stage_id) {
        await dispatchWorkflowEventSafe(
          admin,
          tenantId,
          'deal.stage_changed',
          {
            dealId: deal.id,
            recordId: deal.id,
            stageId: deal.stage_id ?? updateData.stage_id,
            status: deal.status,
            amount: deal.amount,
          },
          { dedupeKey: `stage:${deal.id}:${updateData.stage_id}`, initiatedBy: user.id },
        );
      }

      return createCorsResponse(deal, 200, req);
    }

    // DELETE /deals/:id - Delete deal
    if (req.method === 'DELETE' && dealId) {
      const { error } = await admin
        .from('deals')
        .delete()
        .eq('id', dealId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting deal:', error);
        return createCorsResponse({ error: 'Failed to delete deal' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Deal deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Error in deals function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
