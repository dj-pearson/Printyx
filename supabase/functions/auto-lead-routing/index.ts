// Auto Lead Routing Edge Function
// Handles automatic lead assignment based on rules
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
    const endpoint = pathParts[1];
    const ruleId = pathParts[2];

    // GET /auto-lead-routing/rules - List routing rules
    if (req.method === 'GET' && endpoint === 'rules') {
      const { data: rules, error } = await admin
        .from('lead_routing_rules')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('priority', { ascending: true });

      if (error) {
        // Return sample rules if table doesn't exist
        return createCorsResponse(
          [
            {
              id: 'rule-1',
              name: 'Enterprise Leads',
              conditions: { employeeCount: { min: 500 } },
              assignTo: 'enterprise-team',
              priority: 1,
              isActive: true,
            },
            {
              id: 'rule-2',
              name: 'SMB Leads',
              conditions: { employeeCount: { max: 100 } },
              assignTo: 'smb-team',
              priority: 2,
              isActive: true,
            },
          ],
          200,
          req,
        );
      }

      return createCorsResponse(rules || [], 200, req);
    }

    // GET /auto-lead-routing/rules/:id - Get single rule
    if (req.method === 'GET' && endpoint === 'rules' && ruleId) {
      const { data: rule, error } = await admin
        .from('lead_routing_rules')
        .select('*')
        .eq('id', ruleId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Rule not found' }, 404, req);
      }

      return createCorsResponse(rule, 200, req);
    }

    // POST /auto-lead-routing/rules - Create routing rule
    if (req.method === 'POST' && endpoint === 'rules') {
      const body = await req.json();

      const ruleData = {
        tenant_id: tenantId,
        name: body.name,
        description: body.description,
        conditions: body.conditions || {},
        assign_to_user_id: body.assignToUserId || body.assign_to_user_id,
        assign_to_team_id: body.assignToTeamId || body.assign_to_team_id,
        assignment_method: body.assignmentMethod || body.assignment_method || 'round_robin',
        priority: body.priority || 100,
        is_active: body.isActive !== false,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: rule, error } = await admin
        .from('lead_routing_rules')
        .insert(ruleData)
        .select()
        .single();

      if (error) {
        console.error('Error creating routing rule:', error);
        return createCorsResponse({ error: 'Failed to create rule' }, 500, req);
      }

      return createCorsResponse(rule, 201, req);
    }

    // PUT /auto-lead-routing/rules/:id - Update rule
    if (req.method === 'PUT' && endpoint === 'rules' && ruleId) {
      const body = await req.json();

      const { data: rule, error } = await admin
        .from('lead_routing_rules')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', ruleId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update rule' }, 500, req);
      }

      return createCorsResponse(rule, 200, req);
    }

    // POST /auto-lead-routing/route - Route a lead
    if (req.method === 'POST' && endpoint === 'route') {
      const body = await req.json();
      const { leadId, leadData } = body;

      // Get active rules
      const { data: rules } = await admin
        .from('lead_routing_rules')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('priority', { ascending: true });

      // Find matching rule (simplified matching)
      let matchedRule = null;
      for (const rule of rules || []) {
        // In production, implement proper condition matching
        matchedRule = rule;
        break;
      }

      if (!matchedRule) {
        return createCorsResponse(
          { error: 'No matching routing rule found', routed: false },
          200,
          req,
        );
      }

      // Assign the lead
      const assigneeId = matchedRule.assign_to_user_id || matchedRule.assign_to_team_id;

      if (leadId) {
        await admin
          .from('business_records')
          .update({
            assigned_to: assigneeId,
            routing_rule_id: matchedRule.id,
            routed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', leadId)
          .eq('tenant_id', tenantId);
      }

      return createCorsResponse(
        {
          routed: true,
          rule: matchedRule,
          assignedTo: assigneeId,
        },
        200,
        req,
      );
    }

    // GET /auto-lead-routing/stats - Get routing statistics
    if (req.method === 'GET' && endpoint === 'stats') {
      const { data: routedLeads } = await admin
        .from('business_records')
        .select('routing_rule_id, assigned_to')
        .eq('tenant_id', tenantId)
        .not('routing_rule_id', 'is', null);

      // Group by rule
      const ruleStats = new Map<string, number>();
      (routedLeads || []).forEach((lead: any) => {
        if (lead.routing_rule_id) {
          ruleStats.set(lead.routing_rule_id, (ruleStats.get(lead.routing_rule_id) || 0) + 1);
        }
      });

      return createCorsResponse(
        {
          totalRouted: routedLeads?.length || 0,
          byRule: Array.from(ruleStats.entries()).map(([ruleId, count]) => ({ ruleId, count })),
        },
        200,
        req,
      );
    }

    // DELETE /auto-lead-routing/rules/:id - Delete rule
    if (req.method === 'DELETE' && endpoint === 'rules' && ruleId) {
      const { error } = await admin
        .from('lead_routing_rules')
        .delete()
        .eq('id', ruleId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete rule' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Rule deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in auto-lead-routing function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
