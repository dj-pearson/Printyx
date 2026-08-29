// Auto Lead Routing Edge Function
// Handles automatic lead assignment based on rules
//
// `lead_routing_rules` is named by this file and by nothing else in the
// repository: no Drizzle schema, no migration under drizzle/, no server code,
// no seeder. If it is not present as untracked drift then every read here is a
// 42P01, and PostgREST reports that by leaving `.data` null rather than
// throwing. This file used to answer that with two hardcoded "sample rules"
// from GET /rules and with `{ routed: false, error: 'No matching routing rule
// found' }` from POST /route — a missing relation presented as an empty
// configuration. Both now say which relation is missing (503
// ROUTING_RULES_UNAVAILABLE) so the failure is visible instead of looking like
// a tenant that has not set any rules up yet.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { isMissingTableError } from '../_shared/postgrest-errors.ts';

// 503 rather than 500: the request is well formed and retrying it will work
// once the relation exists. The table name is in the body because "no rules
// configured" and "no such table" are indistinguishable to a caller otherwise.
function routingRulesUnavailable(req: Request, error: unknown): Response {
  console.error('lead_routing_rules is unavailable:', error);
  return createCorsResponse(
    {
      error: 'Lead routing rules are unavailable: relation lead_routing_rules does not exist',
      code: 'ROUTING_RULES_UNAVAILABLE',
      table: 'lead_routing_rules',
    },
    503,
    req,
  );
}

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
    // parts[1] is the rule id on /rules/:id and the lead id on /route/:leadId.
    const ruleId = parts[1];
    const pathLeadId = parts[1];

    // GET /auto-lead-routing/rules - List routing rules
    if (req.method === 'GET' && endpoint === 'rules') {
      const { data: rules, error } = await admin
        .from('lead_routing_rules')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('priority', { ascending: true });

      if (error) {
        if (isMissingTableError(error)) return routingRulesUnavailable(req, error);
        console.error('Error listing routing rules:', error);
        return createCorsResponse({ error: 'Failed to list rules' }, 500, req);
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

    // ─── Dashboard + config (EDGE-002g) ─────────────────────────────────────
    //
    // AutoLeadRoutingDashboard.tsx calls /dashboard and /config, neither of
    // which existed here, so both were hard 404s in production. Ported from
    // server/routes-auto-lead-routing.ts against the real columns.
    //
    // Shapes are dictated by the page: it reads overview.{totalAutoRouted,
    // avgResponseTimeMinutes, fastResponseRate, timeSavedHours, timeSavedCost,
    // period}, repWorkload[].{userId, currentLoad, maxLoad, leadsToday,
    // conversionRate, utilizationPercent}, recentLeads[].{id, leadId,
    // assignedTo, assignedAt, firstResponseAt, firstResponseTimeMinutes} and
    // scoreDistribution[].{grade, count} — all camelCase.

    // GET /auto-lead-routing/dashboard
    if (req.method === 'GET' && endpoint === 'dashboard') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // AVG and GROUP BY are not expressible in PostgREST, so the rows come
      // back and are aggregated here — same division of labour as the Express
      // version, which used SQL for it.
      const [routed, scores, capacity, recent] = await Promise.all([
        admin
          .from('lead_assignment_history')
          .select('first_response_time_minutes')
          .eq('tenant_id', tenantId)
          .eq('assignment_reason', 'auto_ai_routing')
          .gte('assigned_at', thirtyDaysAgo),
        admin
          .from('lead_score_calculations')
          .select('lead_grade')
          .eq('tenant_id', tenantId)
          .gte('calculated_at', thirtyDaysAgo),
        admin
          .from('rep_capacity')
          .select(
            'user_id, current_active_leads, max_active_leads, leads_assigned_today, conversion_rate, average_response_time_minutes',
          )
          .eq('tenant_id', tenantId)
          .eq('is_available', true),
        admin
          .from('lead_assignment_history')
          .select(
            'id, lead_id, assigned_to, assigned_at, first_response_at, first_response_time_minutes',
          )
          .eq('tenant_id', tenantId)
          .eq('assignment_reason', 'auto_ai_routing')
          .order('assigned_at', { ascending: false })
          .limit(10),
      ]);

      const routedRows = routed.data ?? [];
      const totalAutoRouted = routedRows.length;
      const responded = routedRows.filter(
        (r: any) => typeof r.first_response_time_minutes === 'number',
      );
      const avgResponseTimeMinutes = responded.length
        ? Math.round(
            responded.reduce((sum: number, r: any) => sum + r.first_response_time_minutes, 0) /
              responded.length,
          )
        : 0;
      const fastResponses = responded.filter((r: any) => r.first_response_time_minutes <= 5).length;
      const fastResponseRate = totalAutoRouted > 0 ? (fastResponses / totalAutoRouted) * 100 : 0;

      const gradeCounts = new Map<string, number>();
      for (const row of scores.data ?? []) {
        const grade = (row as any).lead_grade ?? 'ungraded';
        gradeCounts.set(grade, (gradeCounts.get(grade) ?? 0) + 1);
      }

      // Express assumes manual routing costs 5 minutes per lead at $35/hour.
      const timeSavedHours = (totalAutoRouted * 5) / 60;

      return createCorsResponse(
        {
          overview: {
            totalAutoRouted,
            avgResponseTimeMinutes,
            fastResponseRate: fastResponseRate.toFixed(1),
            timeSavedHours: timeSavedHours.toFixed(1),
            timeSavedCost: (timeSavedHours * 35).toFixed(0),
            period: '30 days',
          },
          scoreDistribution: Array.from(gradeCounts.entries()).map(([grade, count]) => ({
            grade,
            count,
          })),
          repWorkload: (capacity.data ?? []).map((rep: any) => {
            const maxLoad = rep.max_active_leads || 50;
            const currentLoad = rep.current_active_leads || 0;
            return {
              userId: rep.user_id,
              utilizationPercent: ((currentLoad / maxLoad) * 100).toFixed(0),
              currentLoad,
              maxLoad,
              leadsToday: rep.leads_assigned_today,
              conversionRate: parseFloat(String(rep.conversion_rate ?? '0')) * 100,
              avgResponseTime: rep.average_response_time_minutes,
            };
          }),
          recentLeads: (recent.data ?? []).map((row: any) => ({
            id: row.id,
            leadId: row.lead_id,
            assignedTo: row.assigned_to,
            assignedAt: row.assigned_at,
            firstResponseAt: row.first_response_at,
            firstResponseTimeMinutes: row.first_response_time_minutes,
          })),
        },
        200,
        req,
      );
    }

    // GET/PUT /auto-lead-routing/config
    //
    // The Express version returns hardcoded defaults with a "TODO: Fetch from
    // tenant settings table", and its PUT logs the body and answers success
    // without storing anything — so a user toggling these settings is told
    // "saved successfully" and loses them on reload. Rather than port that,
    // the config lives under tenants.metadata.autoLeadRouting, the same
    // free-form jsonb column the admin settings endpoint uses. Defaults are
    // preserved so an unset tenant reads exactly what Express returned.
    if (endpoint === 'config' && (req.method === 'GET' || req.method === 'PUT')) {
      const AUTO_ROUTING_DEFAULTS = {
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

      const { data: tenant } = await admin
        .from('tenants')
        .select('metadata')
        .eq('id', tenantId)
        .maybeSingle();
      const metadata = (tenant?.metadata ?? {}) as Record<string, unknown>;
      const stored = (metadata.autoLeadRouting ?? {}) as Record<string, unknown>;

      if (req.method === 'GET') {
        return createCorsResponse({ ...AUTO_ROUTING_DEFAULTS, ...stored }, 200, req);
      }

      const incoming = await req.json().catch(() => ({}) as Record<string, unknown>);
      const merged = { ...AUTO_ROUTING_DEFAULTS, ...stored, ...incoming };

      // Merge into metadata rather than replacing it: admin settings shares
      // this column.
      const { error: saveError } = await admin
        .from('tenants')
        .update({
          metadata: { ...metadata, autoLeadRouting: merged },
          updated_at: new Date().toISOString(),
        })
        .eq('id', tenantId);

      if (saveError) {
        console.error('Error saving auto-routing config:', saveError);
        return createCorsResponse({ error: 'Failed to update configuration' }, 500, req);
      }

      return createCorsResponse(
        { success: true, message: 'Configuration updated', config: merged },
        200,
        req,
      );
    }

    // POST /auto-lead-routing/route[/:leadId] - Route a lead
    //
    // AutoLeadRoutingDashboard.tsx calls POST /route/${leadId} with NO body, so
    // the unconditional req.json() threw on an empty body and leadId was only
    // ever read from a body that was not sent. Both forms work now.
    if (req.method === 'POST' && endpoint === 'route') {
      const body = await req.json().catch(() => ({}) as Record<string, unknown>);
      const leadId = pathLeadId ?? (body.leadId as string | undefined);
      const leadData = body.leadData;

      if (!leadId) {
        return createCorsResponse(
          { error: 'leadId is required', code: 'LEAD_ID_REQUIRED' },
          400,
          req,
        );
      }

      // Get active rules
      const { data: rules, error: rulesError } = await admin
        .from('lead_routing_rules')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('priority', { ascending: true });

      if (rulesError) {
        if (isMissingTableError(rulesError)) return routingRulesUnavailable(req, rulesError);
        console.error('Error loading routing rules:', rulesError);
        return createCorsResponse({ error: 'Failed to load routing rules' }, 500, req);
      }

      // Lowest `priority` wins. `rule.conditions` is NOT evaluated — the loop
      // that used to stand here broke on its first iteration, so it was already
      // first-wins; writing it as an index makes that legible and stops it
      // reading like matching that works. The response says so rather than
      // implying the winning rule's conditions were checked.
      const matchedRule = (rules ?? [])[0] ?? null;

      if (!matchedRule) {
        return createCorsResponse(
          { error: 'No active routing rule configured', routed: false },
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
          // The rule was chosen by priority alone; nothing compared the lead
          // against rule.conditions. Callers that need condition matching must
          // not read this as "the lead qualified".
          conditionsEvaluated: false,
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
