// Auto Lead Routing Edge Function
// Handles automatic lead assignment based on rules
//
// WF-S-02. This file used to read and write `lead_routing_rules`, a relation
// named here and NOWHERE else in the repository - no Drizzle schema, no
// migration, no RLS file, no seeder - so every rule endpoint was a 42P01 that
// EDGE-002g had already dressed as two hardcoded "sample rules" once and then
// as a 503.
//
// The table this needed ALREADY EXISTED under another name:
// `lead_assignment_rules`, declared in shared/lead-assignment-schema.ts, created
// by migration 0000, and served by server/routes-lead-assignment.ts with no
// caller. Creating a second rules table to satisfy the old column names would
// have entrenched the duplicate model rather than removing it, so this reads the
// real one. Column names differ and are mapped in toRoutingRule/fromRoutingRule
// below: rule_name, criteria, assignment_type, assign_to_team.
//
// The MATCHING is new too. /route took rules[0] and said so in a comment - the
// loop that once stood there broke on its first iteration - so a $400 toner lead
// and a fifty-machine fleet lead went to the same rep. _shared/lead-routing.ts
// evaluates the criteria the table declares.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import {
  resolveAssignee,
  selectRule,
  type LeadRoutingRule,
  type RoutableLead,
} from '../_shared/lead-routing.ts';

const RULES_TABLE = 'lead_assignment_rules';

/** The API shape the dashboard speaks, from a lead_assignment_rules row. */
function toRoutingRule(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.rule_name,
    description: row.description,
    criteria: row.criteria ?? {},
    assignmentMethod: row.assignment_type,
    assignToUserId: row.assign_to_user_id,
    assignToTeam: row.assign_to_team,
    territoryId: row.territory_id,
    roundRobinConfig: row.round_robin_config,
    priority: row.priority,
    isActive: row.is_active,
    assignmentsCount: row.assignments_count,
    lastAssignedAt: row.last_assigned_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Only real columns. An unknown key is dropped by PostgREST with no error. */
function fromRoutingRule(body: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const set = (column: string, ...keys: string[]) => {
    for (const key of keys) {
      if (body[key] !== undefined) {
        patch[column] = body[key];
        return;
      }
    }
  };
  set('rule_name', 'name', 'ruleName', 'rule_name');
  set('description', 'description');
  set('criteria', 'criteria', 'conditions');
  set('assignment_type', 'assignmentMethod', 'assignmentType', 'assignment_type');
  set('assign_to_user_id', 'assignToUserId', 'assign_to_user_id');
  set('assign_to_team', 'assignToTeam', 'assignToTeamId', 'assign_to_team');
  set('territory_id', 'territoryId', 'territory_id');
  set('round_robin_config', 'roundRobinConfig', 'round_robin_config');
  set('priority', 'priority');
  set('is_active', 'isActive', 'is_active');
  return patch;
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

    // GET /auto-lead-routing/rules/:id - Get single rule
    //
    // BEFORE the list branch. It used to sit after one that tested only
    // `endpoint === 'rules'`, so /rules/:id never reached it - every request for
    // one rule answered with the whole list at 200, which no caller could tell
    // from a rule that happened to be alone.
    if (req.method === 'GET' && endpoint === 'rules' && ruleId) {
      const { data: rule, error } = await admin
        .from(RULES_TABLE)
        .select('*')
        .eq('id', ruleId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error || !rule) {
        return createCorsResponse({ error: 'Rule not found' }, 404, req);
      }

      return createCorsResponse(toRoutingRule(rule), 200, req);
    }

    // GET /auto-lead-routing/rules - List routing rules
    //
    // HIGHEST priority first, which is what lead_assignment_rules.priority says
    // in its own comment. The old order was ascending, so the LOWEST-priority
    // rule would have won every lead the day the table existed.
    if (req.method === 'GET' && endpoint === 'rules') {
      const { data: rules, error } = await admin
        .from(RULES_TABLE)
        .select('*')
        .eq('tenant_id', tenantId)
        .order('priority', { ascending: false });

      if (error) {
        console.error('Error listing routing rules:', error);
        return createCorsResponse({ error: 'Failed to list rules' }, 500, req);
      }

      return createCorsResponse((rules ?? []).map(toRoutingRule), 200, req);
    }

    // POST /auto-lead-routing/rules - Create routing rule
    if (req.method === 'POST' && endpoint === 'rules') {
      const body = await req.json();

      const patch = fromRoutingRule(body);
      // rule_name, assignment_type and criteria are NOT NULL, so a 400 naming
      // the field beats a 23502 the caller reads as a server fault.
      const missing: string[] = [];
      if (!patch.rule_name) missing.push('name');
      if (!patch.assignment_type) missing.push('assignmentMethod');
      if (missing.length > 0) {
        return createCorsResponse(
          { error: `Missing required field(s): ${missing.join(', ')}`, missing },
          400,
          req,
        );
      }

      const ruleData = {
        ...patch,
        tenant_id: tenantId,
        criteria: patch.criteria ?? {},
        priority: patch.priority ?? 100,
        is_active: patch.is_active !== false,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: rule, error } = await admin
        .from(RULES_TABLE)
        .insert(ruleData)
        .select()
        .single();

      if (error) {
        console.error('Error creating routing rule:', error);
        return createCorsResponse({ error: 'Failed to create rule', details: error }, 500, req);
      }

      return createCorsResponse(toRoutingRule(rule), 201, req);
    }

    // PUT /auto-lead-routing/rules/:id - Update rule
    if (req.method === 'PUT' && endpoint === 'rules' && ruleId) {
      const body = await req.json();

      // `...body` used to be spread straight into the update. PostgREST rejects
      // an unknown column, so a caller sending a camelCase field failed the whole
      // write; mapping first keeps the write to columns that exist.
      const { data: rule, error } = await admin
        .from(RULES_TABLE)
        .update({ ...fromRoutingRule(body), updated_at: new Date().toISOString() })
        .eq('id', ruleId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update rule' }, 500, req);
      }

      return createCorsResponse(toRoutingRule(rule), 200, req);
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

      const { data: rules, error: rulesError } = await admin
        .from(RULES_TABLE)
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('priority', { ascending: false });

      if (rulesError) {
        console.error('Error loading routing rules:', rulesError);
        return createCorsResponse({ error: 'Failed to load routing rules' }, 500, req);
      }

      // The lead itself, because the criteria are about the lead and the caller
      // may send none. leadData from the body wins where present so a caller
      // routing a record it has not stored yet still gets real matching.
      const { data: record } = await admin
        .from('business_records')
        // The real column names: business_records stores the lead source as
        // `source` and the deal size as `estimated_deal_value`. check:phantom-cols
        // caught both, which is what it is for - neither is visible to tsc.
        .select(
          'id, source, lead_score, industry, employee_count, estimated_deal_value, country, state, city, postal_code',
        )
        .eq('id', leadId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      const supplied = (leadData ?? {}) as Record<string, unknown>;
      const lead: RoutableLead = {
        leadSource: (supplied.leadSource as string) ?? record?.source ?? null,
        leadScore: (supplied.leadScore as number) ?? record?.lead_score ?? null,
        industry: (supplied.industry as string) ?? record?.industry ?? null,
        employeeCount: (supplied.employeeCount as number) ?? record?.employee_count ?? null,
        estimatedAmount:
          (supplied.estimatedAmount as number) ?? record?.estimated_deal_value ?? null,
        country: (supplied.country as string) ?? record?.country ?? null,
        state: (supplied.state as string) ?? record?.state ?? null,
        city: (supplied.city as string) ?? record?.city ?? null,
        postalCode: (supplied.postalCode as string) ?? record?.postal_code ?? null,
        productInterest: (supplied.productInterest as string) ?? null,
      };

      // WF-S-02: the criteria are EVALUATED now. This used to be rules[0].
      const selection = selectRule((rules ?? []) as LeadRoutingRule[], lead);
      const matchedRule = selection.rule;

      if (!matchedRule) {
        return createCorsResponse(
          {
            routed: false,
            error:
              (rules ?? []).length === 0
                ? 'No active routing rule configured'
                : 'No active routing rule matches this lead',
            // Which criterion each rule failed on, so an admin can see why
            // rather than guessing at the rule editor.
            considered: selection.considered,
          },
          200,
          req,
        );
      }

      // Who it goes to. A team or territory rule has nowhere to land -
      // business_records holds an owner, not a team - so that is reported.
      const choice = resolveAssignee(matchedRule as LeadRoutingRule);
      const assignedUserId = choice.userId;
      const unpersisted: string[] = [
        'routingRuleId / routedAt: business_records records neither which rule routed it nor when',
      ];
      if (choice.reason) unpersisted.push(choice.reason);

      if (assignedUserId) {
        await admin
          .from('business_records')
          .update({
            owner_id: assignedUserId,
            assigned_sales_rep: assignedUserId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', leadId)
          .eq('tenant_id', tenantId);

        // The rule's own counters, which the table declares and nothing set.
        // Advancing the round-robin index here is what stops every lead going to
        // the same first rep in the pool.
        const rulePatch: Record<string, unknown> = {
          assignments_count: Number(matchedRule.assignments_count ?? 0) + 1,
          last_assigned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (choice.nextRoundRobinIndex !== undefined) {
          rulePatch.round_robin_config = {
            ...(matchedRule.round_robin_config ?? {}),
            currentIndex: choice.nextRoundRobinIndex,
          };
        }
        await admin
          .from(RULES_TABLE)
          .update(rulePatch)
          .eq('id', matchedRule.id)
          .eq('tenant_id', tenantId);
      }

      return createCorsResponse(
        {
          routed: Boolean(assignedUserId),
          rule: toRoutingRule(matchedRule as Record<string, unknown>),
          assignedTo: assignedUserId,
          // Now true, and the shape is kept so an existing caller still reads it.
          conditionsEvaluated: true,
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
        .from(RULES_TABLE)
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
