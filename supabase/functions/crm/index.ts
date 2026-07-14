// CRM Edge Function
// Handles CRM goals, dashboard stats, teams, and progress tracking
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
      (user.app_metadata?.tenant_id as string) || (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const subRoute = pathParts[1]; // e.g., 'goals', 'dashboard-stats', 'teams', 'goal-progress'

    // GET /crm/goals - List CRM goals
    if (req.method === 'GET' && subRoute === 'goals') {
      // TODO: Fetch actual goals from database
      return createCorsResponse([], 200, req);
    }

    // POST /crm/goals - Create CRM goal
    if (req.method === 'POST' && subRoute === 'goals') {
      const body = await req.json();
      // TODO: Create goal in database
      return createCorsResponse({ success: true, message: 'Goal created' }, 201, req);
    }

    // GET /crm/dashboard-stats - Dashboard statistics
    if (req.method === 'GET' && subRoute === 'dashboard-stats') {
      // TODO: Calculate real stats from database
      const mockStats = {
        totalLeads: 0,
        totalCustomers: 0,
        totalRevenue: 0,
        activeDeals: 0,
        revenueThisMonth: 0,
        leadsThisMonth: 0,
        customersThisMonth: 0,
        conversionRate: 0,
      };
      return createCorsResponse(mockStats, 200, req);
    }

    // GET /crm/teams - List teams
    if (req.method === 'GET' && subRoute === 'teams') {
      const { data: teams, error } = await admin
        .from('teams')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name');

      if (error) {
        console.error('Error fetching teams:', error);
        return createCorsResponse({ error: 'Failed to fetch teams' }, 500, req);
      }

      return createCorsResponse(teams || [], 200, req);
    }

    // GET /crm/goal-progress - Goal progress tracking
    if (req.method === 'GET' && subRoute === 'goal-progress') {
      const goalId = url.searchParams.get('goalId');
      // TODO: Calculate goal progress from database
      const mockProgress = {
        goalId,
        current: 0,
        target: 0,
        percentage: 0,
        trend: 'up',
      };
      return createCorsResponse(mockProgress, 200, req);
    }

    // ─── CRMX-006: Notes ────────────────────────────────────────────
    const CRM_RECORD_TYPES = new Set(['deal', 'lead', 'contact', 'company']);
    if (subRoute === 'notes') {
      const noteId = pathParts[2];

      if (req.method === 'GET' && !noteId) {
        const parentType = url.searchParams.get('parentType');
        const parentId = url.searchParams.get('parentId');
        if (!parentType || !parentId)
          return createCorsResponse({ error: 'parentType and parentId are required' }, 400, req);
        const { data, error } = await admin
          .from('crm_notes')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('parent_type', parentType)
          .eq('parent_id', parentId)
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false });
        if (error) return createCorsResponse({ error: error.message }, 500, req);
        return createCorsResponse({ data: data ?? [], total: (data ?? []).length }, 200, req);
      }

      if (req.method === 'POST' && !noteId) {
        const body = await req.json().catch(() => ({}));
        if (!CRM_RECORD_TYPES.has(body.parentType) || !body.parentId || !body.body)
          return createCorsResponse(
            { error: 'parentType, parentId and body are required' },
            400,
            req,
          );
        const { data, error } = await admin
          .from('crm_notes')
          .insert({
            tenant_id: tenantId,
            parent_type: body.parentType,
            parent_id: body.parentId,
            body: body.body,
            is_pinned: body.isPinned ?? false,
            author_id: user.id,
          })
          .select()
          .single();
        if (error) return createCorsResponse({ error: error.message }, 500, req);
        return createCorsResponse(data, 201, req);
      }

      if (req.method === 'PATCH' && noteId) {
        const body = await req.json().catch(() => ({}));
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (body.body !== undefined) patch.body = body.body;
        if (body.isPinned !== undefined) patch.is_pinned = body.isPinned;
        const { data, error } = await admin
          .from('crm_notes')
          .update(patch)
          .eq('id', noteId)
          .eq('tenant_id', tenantId)
          .select()
          .maybeSingle();
        if (error) return createCorsResponse({ error: error.message }, 500, req);
        if (!data) return createCorsResponse({ error: 'Note not found' }, 404, req);
        return createCorsResponse(data, 200, req);
      }

      if (req.method === 'DELETE' && noteId) {
        const { data, error } = await admin
          .from('crm_notes')
          .delete()
          .eq('id', noteId)
          .eq('tenant_id', tenantId)
          .select()
          .maybeSingle();
        if (error) return createCorsResponse({ error: error.message }, 500, req);
        if (!data) return createCorsResponse({ error: 'Note not found' }, 404, req);
        return createCorsResponse({ success: true }, 200, req);
      }
    }

    // ─── CRMX-006: Associations ─────────────────────────────────────
    if (subRoute === 'associations') {
      const assocId = pathParts[2];

      if (req.method === 'GET' && !assocId) {
        const type = url.searchParams.get('type');
        const id = url.searchParams.get('id');
        if (!type || !id)
          return createCorsResponse({ error: 'type and id are required' }, 400, req);
        const { data, error } = await admin
          .from('crm_associations')
          .select('*')
          .eq('tenant_id', tenantId)
          .or(
            `and(source_type.eq.${type},source_id.eq.${id}),and(target_type.eq.${type},target_id.eq.${id})`,
          )
          .order('created_at', { ascending: false });
        if (error) return createCorsResponse({ error: error.message }, 500, req);
        return createCorsResponse({ data: data ?? [], total: (data ?? []).length }, 200, req);
      }

      if (req.method === 'POST' && !assocId) {
        const body = await req.json().catch(() => ({}));
        if (!body.sourceType || !body.sourceId || !body.targetType || !body.targetId)
          return createCorsResponse(
            { error: 'sourceType, sourceId, targetType, targetId are required' },
            400,
            req,
          );
        const { data, error } = await admin
          .from('crm_associations')
          .insert({
            tenant_id: tenantId,
            source_type: body.sourceType,
            source_id: body.sourceId,
            target_type: body.targetType,
            target_id: body.targetId,
            relation: body.relation ?? 'related',
            created_by: user.id,
          })
          .select()
          .single();
        if (error) {
          if ((error as { code?: string }).code === '23505')
            return createCorsResponse({ error: 'This association already exists' }, 409, req);
          return createCorsResponse({ error: error.message }, 500, req);
        }
        return createCorsResponse(data, 201, req);
      }

      if (req.method === 'DELETE' && assocId) {
        const { data, error } = await admin
          .from('crm_associations')
          .delete()
          .eq('id', assocId)
          .eq('tenant_id', tenantId)
          .select()
          .maybeSingle();
        if (error) return createCorsResponse({ error: error.message }, 500, req);
        if (!data) return createCorsResponse({ error: 'Association not found' }, 404, req);
        return createCorsResponse({ success: true }, 200, req);
      }
    }

    return createCorsResponse({ error: 'Route not found' }, 404, req);
  } catch (error) {
    console.error('Error in crm function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
