// Deal Desk Rules Edge Function
// Handles deal desk approval rules
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
    const ruleId = pathParts[2]; // deal-desk/rules/:id

    // GET /deal-desk/rules - List rules
    if (req.method === 'GET' && !ruleId) {
      const { data: rules, error } = await admin
        .from('deal_desk_rules')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('priority', { ascending: true });

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch deal desk rules' }, 500, req);
      }

      return createCorsResponse(rules || [], 200, req);
    }

    // POST /deal-desk/rules - Create rule
    if (req.method === 'POST' && !ruleId) {
      const body = await req.json();

      const { data: rule, error } = await admin
        .from('deal_desk_rules')
        .insert({
          tenant_id: tenantId,
          name: body.name,
          description: body.description,
          rule_type: body.ruleType || body.rule_type,
          conditions: body.conditions || {},
          approvers: body.approvers || [],
          priority: body.priority || 0,
          is_active: body.isActive !== false,
          created_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create deal desk rule' }, 500, req);
      }

      return createCorsResponse(rule, 201, req);
    }

    // PUT /deal-desk/rules/:id - Update rule
    if (req.method === 'PUT' && ruleId) {
      const body = await req.json();

      const { data: rule, error } = await admin
        .from('deal_desk_rules')
        .update({
          name: body.name,
          description: body.description,
          rule_type: body.ruleType || body.rule_type,
          conditions: body.conditions,
          approvers: body.approvers,
          priority: body.priority,
          is_active: body.isActive ?? body.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ruleId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update deal desk rule' }, 500, req);
      }

      return createCorsResponse(rule, 200, req);
    }

    // DELETE /deal-desk/rules/:id - Delete rule
    if (req.method === 'DELETE' && ruleId) {
      const { error } = await admin
        .from('deal_desk_rules')
        .delete()
        .eq('id', ruleId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete deal desk rule' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Deal desk rule deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in deal-desk-rules function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
