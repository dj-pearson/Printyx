// Lead Assignment History Edge Function
// Handles lead assignment history tracking
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
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const leadId = pathParts[1];

    // GET /lead-assignment-history/:leadId - Get history for lead
    if (req.method === 'GET' && leadId) {
      const { data: history, error } = await admin
        .from('lead_assignment_history')
        .select(
          `
          *,
          assigned_to:assigned_to_id (id, full_name, email),
          assigned_by:assigned_by_id (id, full_name)
        `,
        )
        .eq('lead_id', leadId)
        .eq('tenant_id', tenantId)
        .order('assigned_at', { ascending: false });

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch assignment history' }, 500, req);
      }

      return createCorsResponse(history || [], 200, req);
    }

    // GET /lead-assignment-history - Get all recent history
    if (req.method === 'GET' && !leadId) {
      const limit = parseInt(url.searchParams.get('limit') || '50');

      const { data: history, error } = await admin
        .from('lead_assignment_history')
        .select(
          `
          *,
          lead:lead_id (id, company_name),
          assigned_to:assigned_to_id (id, full_name),
          assigned_by:assigned_by_id (id, full_name)
        `,
        )
        .eq('tenant_id', tenantId)
        .order('assigned_at', { ascending: false })
        .limit(limit);

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch assignment history' }, 500, req);
      }

      return createCorsResponse(history || [], 200, req);
    }

    // POST /lead-assignment-history - Record assignment
    if (req.method === 'POST') {
      const body = await req.json();

      const { data: history, error } = await admin
        .from('lead_assignment_history')
        .insert({
          tenant_id: tenantId,
          lead_id: body.leadId || body.lead_id,
          assigned_to_id: body.assignedToId || body.assigned_to_id,
          assigned_by_id: body.assignedById || body.assigned_by_id || user.id,
          assignment_reason: body.reason || body.assignment_reason || 'manual',
          rule_id: body.ruleId || body.rule_id,
          assigned_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to record assignment' }, 500, req);
      }

      return createCorsResponse(history, 201, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in lead-assignment-history function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
