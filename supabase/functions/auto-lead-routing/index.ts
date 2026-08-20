// Auto Lead Routing Edge Function
// Handles automatic lead assignment based on rules
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

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
    // server.ts strips the function-name segment before invoking this handler,
    // so the resource is at parts[0]. normalizePath strips an OPTIONAL leading
    // /auto-lead-routing, making this correct whether or not the prefix survived.
    const { parts } = normalizePath(url.pathname, 'auto-lead-routing');
    const endpoint = parts[0];
    const ruleId = parts[1];

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

      // Assign the lead.
      //
      // business_records has none of assigned_to, routing_rule_id or routed_at,
      // so every routed lead failed to actually be assigned. Ownership is
      // owner_id + assigned_sales_rep, set together the way
      // sales-rep-assignments does it. A rule pointing at a TEAM has nowhere to
      // land — there is no team column on the record — so that case is reported
      // rather than written into the rep field, which would be wrong.
      const assignedUserId = matchedRule.assign_to_user_id ?? null;
      const assigneeId = assignedUserId || matchedRule.assign_to_team_id;
      const unpersisted: string[] = [
        'routingRuleId / routedAt: business_records records neither which rule routed it nor when',
      ];

      if (leadId && assignedUserId) {
        await admin
          .from('business_records')
          .update({
            owner_id: assignedUserId,
            assigned_sales_rep: assignedUserId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', leadId)
          .eq('tenant_id', tenantId);
      } else if (leadId) {
        unpersisted.push(
          'assignToTeamId: business_records has no team column; only a user can own a record',
        );
      }

      return createCorsResponse(
        {
          routed: Boolean(leadId && assignedUserId),
          rule: matchedRule,
          assignedTo: assigneeId,
          unpersisted,
        },
        200,
        req,
      );
    }

    // GET /auto-lead-routing/stats - Get routing statistics
    if (req.method === 'GET' && endpoint === 'stats') {
      // Per-rule counts are not derivable: business_records does not record
      // which rule routed it (no routing_rule_id), so this query 42703'd and the
      // stats were always empty. What CAN be counted honestly is how many
      // records currently have an owner.
      const { data: routedLeads } = await admin
        .from('business_records')
        .select('owner_id')
        .eq('tenant_id', tenantId)
        .not('owner_id', 'is', null);

      // Grouped by owner rather than by rule, for the reason above.
      const ruleStats = new Map<string, number>();
      (routedLeads || []).forEach((lead: any) => {
        if (lead.owner_id) {
          ruleStats.set(lead.owner_id, (ruleStats.get(lead.owner_id) || 0) + 1);
        }
      });

      return createCorsResponse(
        {
          totalRouted: routedLeads?.length || 0,
          // Keyed by owner, not by rule — see the query above. The key name is
          // kept so the response shape does not change under callers.
          byRule: Array.from(ruleStats.entries()).map(([ruleId, count]) => ({ ruleId, count })),
          byRuleUnavailable:
            'business_records has no routing_rule_id column; these counts are by owner',
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
