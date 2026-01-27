// Lead Assignment Rules Edge Function
// Handles lead assignment rule management
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
    const ruleId = pathParts[1];

    // GET /lead-assignment-rules - List rules
    if (req.method === 'GET' && !ruleId) {
      const { data: rules, error } = await admin
        .from('lead_assignment_rules')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('priority', { ascending: true });

      if (error) {
        return createCorsResponse({ error: 'Failed to fetch assignment rules' }, 500, req);
      }

      return createCorsResponse(rules || [], 200, req);
    }

    // GET /lead-assignment-rules/:id - Get single rule
    if (req.method === 'GET' && ruleId) {
      const { data: rule, error } = await admin
        .from('lead_assignment_rules')
        .select('*')
        .eq('id', ruleId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Assignment rule not found' }, 404, req);
      }

      return createCorsResponse(rule, 200, req);
    }

    // POST /lead-assignment-rules - Create rule
    if (req.method === 'POST' && !ruleId) {
      const body = await req.json();

      const { data: rule, error } = await admin
        .from('lead_assignment_rules')
        .insert({
          tenant_id: tenantId,
          name: body.name,
          description: body.description,
          conditions: body.conditions || {},
          assignment_type: body.assignmentType || body.assignment_type || 'round_robin',
          assigned_users: body.assignedUsers || body.assigned_users || [],
          territory_id: body.territoryId || body.territory_id,
          priority: body.priority || 0,
          is_active: body.isActive !== false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create assignment rule' }, 500, req);
      }

      return createCorsResponse(rule, 201, req);
    }

    // PUT /lead-assignment-rules/:id - Update rule
    if (req.method === 'PUT' && ruleId) {
      const body = await req.json();

      const { data: rule, error } = await admin
        .from('lead_assignment_rules')
        .update({
          name: body.name,
          description: body.description,
          conditions: body.conditions,
          assignment_type: body.assignmentType || body.assignment_type,
          assigned_users: body.assignedUsers || body.assigned_users,
          territory_id: body.territoryId || body.territory_id,
          priority: body.priority,
          is_active: body.isActive ?? body.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ruleId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update assignment rule' }, 500, req);
      }

      return createCorsResponse(rule, 200, req);
    }

    // DELETE /lead-assignment-rules/:id - Delete rule
    if (req.method === 'DELETE' && ruleId) {
      const { error } = await admin
        .from('lead_assignment_rules')
        .delete()
        .eq('id', ruleId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete assignment rule' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Assignment rule deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in lead-assignment-rules function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
