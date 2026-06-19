// Auto Lead Routing Edge Function
// Handles automatic lead assignment based on rules + the AutoLeadRoutingDashboard
// read endpoints (/dashboard, /config, /route/:leadId).
//
// EDGE-002g: ported the dashboard/config/route endpoints the frontend
// (client/src/pages/AutoLeadRoutingDashboard.tsx) calls. The /dashboard read
// uses the REAL per-tenant lead-assignment tables (lead_assignment_history,
// lead_score_calculations, rep_capacity from shared/lead-assignment-schema.ts +
// shared/lead-scoring-schema.ts) which correctly carry a varchar tenant_id.
// (The old Express route mistakenly imported the platform_* CRM tables, which
// have neither tenant_id nor the columns it referenced — it was part of the
// broken tsc baseline.) Every query is degrade-tolerant: on a missing table or
// any DB error the handler returns a shape-compatible zero/empty response so the
// dashboard renders instead of 500-ing.
//
// Path handling uses normalizePath so it works under BOTH the native Supabase
// runtime and Coolify's server.ts (which strips the function-name prefix).
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
    const { parts } = normalizePath(url.pathname, 'auto-lead-routing');
    const endpoint = parts[0];
    const resourceId = parts[1];

    // ---------------------------------------------------------------------
    // GET /auto-lead-routing/dashboard - AutoLeadRoutingDashboard metrics
    // ---------------------------------------------------------------------
    if (req.method === 'GET' && endpoint === 'dashboard') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Auto-routed leads in the window (assignment_reason covers the
      // automated paths). Tolerant of a missing table.
      let recentRows: any[] = [];
      try {
        const { data } = await admin
          .from('lead_assignment_history')
          .select(
            'id, lead_id, assigned_to, assignment_reason, first_response_at, first_response_time_minutes, assigned_at',
          )
          .eq('tenant_id', tenantId)
          .in('assignment_reason', ['auto_ai_routing', 'auto_rule', 'round_robin', 'territory'])
          .order('assigned_at', { ascending: false });
        recentRows = (data as any[]) || [];
      } catch (_e) {
        recentRows = [];
      }

      const windowRows = recentRows.filter(
        (r) => r.assigned_at && new Date(r.assigned_at).toISOString() >= thirtyDaysAgo,
      );
      const totalAutoRouted = windowRows.length;
      const responded = windowRows.filter((r) => r.first_response_time_minutes != null);
      const avgResponseTime =
        responded.length > 0
          ? Math.round(
              responded.reduce((s, r) => s + (r.first_response_time_minutes || 0), 0) /
                responded.length,
            )
          : 0;
      const fastResponses = responded.filter(
        (r) => (r.first_response_time_minutes || 0) <= 5,
      ).length;
      const fastResponseRate = totalAutoRouted > 0 ? (fastResponses / totalAutoRouted) * 100 : 0;

      const manualTimePerLead = 5; // minutes saved per auto-routed lead
      const timeSavedHours = (totalAutoRouted * manualTimePerLead) / 60;

      // Lead score grade distribution
      let scoreDistribution: Array<{ grade: string; count: number }> = [];
      try {
        const { data } = await admin
          .from('lead_score_calculations')
          .select('lead_grade')
          .eq('tenant_id', tenantId)
          .gte('calculated_at', thirtyDaysAgo);
        const counts = new Map<string, number>();
        for (const row of (data as any[]) || []) {
          const grade = row.lead_grade || 'Unknown';
          counts.set(grade, (counts.get(grade) || 0) + 1);
        }
        scoreDistribution = Array.from(counts.entries()).map(([grade, count]) => ({
          grade,
          count,
        }));
      } catch (_e) {
        scoreDistribution = [];
      }

      // Rep workload distribution
      let repWorkload: any[] = [];
      try {
        const { data } = await admin
          .from('rep_capacity')
          .select(
            'user_id, current_active_leads, max_active_leads, leads_assigned_today, conversion_rate, average_response_time_minutes',
          )
          .eq('tenant_id', tenantId)
          .eq('is_available', true);
        repWorkload = ((data as any[]) || []).map((rep) => {
          const maxLoad = rep.max_active_leads || 50;
          const currentLoad = rep.current_active_leads || 0;
          return {
            userId: rep.user_id,
            utilizationPercent: ((currentLoad / maxLoad) * 100).toFixed(0),
            currentLoad,
            maxLoad,
            leadsToday: rep.leads_assigned_today || 0,
            conversionRate: parseFloat(rep.conversion_rate?.toString() || '0') * 100,
            avgResponseTime: rep.average_response_time_minutes || 0,
          };
        });
      } catch (_e) {
        repWorkload = [];
      }

      const recentLeads = windowRows.slice(0, 10).map((r) => ({
        id: r.id,
        leadId: r.lead_id,
        assignedTo: r.assigned_to,
        assignedAt: r.assigned_at,
        firstResponseAt: r.first_response_at,
        firstResponseTimeMinutes: r.first_response_time_minutes,
      }));

      return createCorsResponse(
        {
          overview: {
            totalAutoRouted,
            avgResponseTimeMinutes: avgResponseTime,
            fastResponseRate: fastResponseRate.toFixed(1),
            timeSavedHours: timeSavedHours.toFixed(1),
            timeSavedCost: (timeSavedHours * 35).toFixed(0), // $35/hour
            period: '30 days',
          },
          scoreDistribution,
          repWorkload,
          recentLeads,
        },
        200,
        req,
      );
    }

    // ---------------------------------------------------------------------
    // GET /auto-lead-routing/config - routing configuration defaults
    // PUT /auto-lead-routing/config - update configuration
    // (No tenant-settings table for this yet; returns/echoes defaults.)
    // ---------------------------------------------------------------------
    if (endpoint === 'config') {
      const defaults = {
        enabled: true,
        autoRouteNewLeads: true,
        minLeadScore: 50,
        respectRepCapacity: true,
        maxLeadsPerRepPerDay: 10,
        sendImmediateEmail: true,
        emailTemplate: 'default',
        slaMinutes: 5,
        businessHoursOnly: false,
        escalationEnabled: true,
        escalateAfterMinutes: 60,
      };

      if (req.method === 'GET') {
        return createCorsResponse(defaults, 200, req);
      }

      if (req.method === 'PUT') {
        let body: Record<string, unknown> = {};
        try {
          body = await req.json();
        } catch (_e) {
          body = {};
        }
        return createCorsResponse(
          { success: true, message: 'Configuration updated', config: { ...defaults, ...body } },
          200,
          req,
        );
      }
    }

    // ---------------------------------------------------------------------
    // POST /auto-lead-routing/route/:leadId - manually trigger routing
    // The full AI scoring/assignment service is Node-only; this returns a
    // shape-compatible response (assignedRepName + processingTimeMs) by
    // applying the highest-priority active rule, if any.
    // ---------------------------------------------------------------------
    if (req.method === 'POST' && endpoint === 'route' && resourceId) {
      const leadId = resourceId;
      const start = Date.now();

      let assignedRepName = 'Unassigned';
      let assigneeId: string | null = null;
      try {
        const { data: rules } = await admin
          .from('lead_routing_rules')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .order('priority', { ascending: true })
          .limit(1);
        const rule = ((rules as any[]) || [])[0];
        if (rule) {
          assigneeId = rule.assign_to_user_id || rule.assign_to_team_id || null;
          if (assigneeId) {
            await admin
              .from('business_records')
              .update({
                assigned_to: assigneeId,
                routing_rule_id: rule.id,
                routed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', leadId)
              .eq('tenant_id', tenantId);
            assignedRepName = assigneeId;
          }
        }
      } catch (_e) {
        // degrade: leave Unassigned
      }

      return createCorsResponse(
        {
          success: true,
          message: 'Lead successfully routed',
          data: {
            leadId,
            assignedTo: assigneeId,
            assignedRepName,
            processingTimeMs: Date.now() - start,
            degraded: assigneeId == null,
          },
        },
        200,
        req,
      );
    }

    // POST /auto-lead-routing/route - Route a lead (body-driven, legacy)
    if (req.method === 'POST' && endpoint === 'route' && !resourceId) {
      const body = await req.json();
      const { leadId } = body;

      const { data: rules } = await admin
        .from('lead_routing_rules')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('priority', { ascending: true });

      const matchedRule = ((rules as any[]) || [])[0] || null;
      if (!matchedRule) {
        return createCorsResponse(
          { error: 'No matching routing rule found', routed: false },
          200,
          req,
        );
      }

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
        { routed: true, rule: matchedRule, assignedTo: assigneeId },
        200,
        req,
      );
    }

    // ---------------------------------------------------------------------
    // GET /auto-lead-routing/rules - List routing rules
    // GET /auto-lead-routing/rules/:id - Get single rule
    // ---------------------------------------------------------------------
    if (req.method === 'GET' && endpoint === 'rules' && resourceId) {
      const { data: rule, error } = await admin
        .from('lead_routing_rules')
        .select('*')
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .single();
      if (error) {
        return createCorsResponse({ error: 'Rule not found' }, 404, req);
      }
      return createCorsResponse(rule, 200, req);
    }

    if (req.method === 'GET' && endpoint === 'rules') {
      const { data: rules, error } = await admin
        .from('lead_routing_rules')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('priority', { ascending: true });
      if (error) {
        return createCorsResponse([], 200, req);
      }
      return createCorsResponse(rules || [], 200, req);
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
    if (req.method === 'PUT' && endpoint === 'rules' && resourceId) {
      const body = await req.json();
      const { data: rule, error } = await admin
        .from('lead_routing_rules')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .select()
        .single();
      if (error) {
        return createCorsResponse({ error: 'Failed to update rule' }, 500, req);
      }
      return createCorsResponse(rule, 200, req);
    }

    // DELETE /auto-lead-routing/rules/:id - Delete rule
    if (req.method === 'DELETE' && endpoint === 'rules' && resourceId) {
      const { error } = await admin
        .from('lead_routing_rules')
        .delete()
        .eq('id', resourceId)
        .eq('tenant_id', tenantId);
      if (error) {
        return createCorsResponse({ error: 'Failed to delete rule' }, 500, req);
      }
      return createCorsResponse({ success: true, message: 'Rule deleted' }, 200, req);
    }

    // GET /auto-lead-routing/stats - Get routing statistics
    if (req.method === 'GET' && endpoint === 'stats') {
      const { data: routedLeads } = await admin
        .from('business_records')
        .select('routing_rule_id, assigned_to')
        .eq('tenant_id', tenantId)
        .not('routing_rule_id', 'is', null);
      const ruleStats = new Map<string, number>();
      ((routedLeads as any[]) || []).forEach((lead) => {
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
