// Direct lead assignment via rules engine.
//
// POST /assign-lead — evaluate rules, pick a rep, write history.
//
// Body: { leadId, leadData, assignedBy? }
//   leadData: { source, score, industry, companySize, dealSize, state,
//               country, productInterest, ... }
//
// Matches the first active rule by priority; dispatches by rule.assignment_type:
//   - round_robin → delegate to lead_assignment_round_robin() SQL function
//     (atomic pointer advance)
//   - territory   → use territory.owner_id
//   - default     → rule.assign_to_user_id

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

interface LeadData {
  source?: string;
  score?: number;
  industry?: string;
  companySize?: number;
  dealSize?: number;
  country?: string;
  state?: string;
  city?: string;
  productInterest?: string[];
  [k: string]: unknown;
}

interface Rule {
  id: string;
  rule_name: string;
  priority: number;
  is_active: boolean;
  assignment_type: string;
  territory_id: string | null;
  assign_to_user_id: string | null;
  criteria: Record<string, unknown>;
  round_robin_config: { userIds?: string[]; currentIndex?: number } | null;
}

export async function handleAssign(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, auth, db, requestId } = ctx;
  if (method !== 'POST') return null;

  const body = (await req.json().catch(() => null)) as {
    leadId?: string;
    leadData?: LeadData;
    assignedBy?: string;
  } | null;
  if (!body?.leadId) {
    return errorResponse(400, 'leadId is required', req, {
      code: 'VALIDATION_ERROR',
      requestId,
    });
  }
  const leadData: LeadData = body.leadData ?? {};

  const { data: rules, error: rulesErr } = await db
    .from('lead_assignment_rules')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .eq('is_active', true)
    .order('priority', { ascending: false });
  if (rulesErr) {
    return errorResponse(500, 'Failed to load rules', req, {
      code: 'DB_ERROR',
      details: rulesErr,
      requestId,
    });
  }

  const matched = ((rules ?? []) as Rule[]).find((r) => matchesRule(leadData, r));
  if (!matched) {
    return errorResponse(400, 'No matching assignment rule found', req, {
      code: 'NO_RULE_MATCH',
      requestId,
    });
  }

  let assignedTo: string | null = null;

  switch (matched.assignment_type) {
    case 'round_robin': {
      const rpc = await db.rpc('lead_assignment_round_robin', {
        p_tenant_id: auth.tenantId,
        p_rule_id: matched.id,
      });
      if (rpc.error) {
        return errorResponse(500, 'Round-robin failed', req, {
          code: 'ROUND_ROBIN_ERROR',
          details: rpc.error,
          requestId,
        });
      }
      assignedTo = (rpc.data as { userId?: string | null })?.userId ?? null;
      break;
    }
    case 'territory': {
      if (matched.territory_id) {
        const { data: territory } = await db
          .from('sales_territories')
          .select('owner_id')
          .eq('id', matched.territory_id)
          .eq('tenant_id', auth.tenantId)
          .maybeSingle();
        assignedTo = (territory?.owner_id as string) ?? null;
      }
      break;
    }
    default:
      assignedTo = matched.assign_to_user_id;
  }

  if (!assignedTo) {
    return errorResponse(400, 'Could not determine assignment target', req, {
      code: 'NO_TARGET',
      requestId,
    });
  }

  // Record history
  const hist = await db
    .from('lead_assignment_history')
    .insert({
      tenant_id: auth.tenantId,
      lead_id: body.leadId,
      assigned_to: assignedTo,
      assignment_reason: matched.assignment_type,
      rule_id: matched.id,
      assigned_by: body.assignedBy ?? auth.userId,
    })
    .select()
    .maybeSingle();
  if (hist.error) {
    return errorResponse(500, 'Failed to record assignment', req, {
      code: 'DB_ERROR',
      details: hist.error,
      requestId,
    });
  }

  // Update lead owner
  await db
    .from('business_records')
    .update({ owner_id: assignedTo, status: 'assigned', updated_at: new Date().toISOString() })
    .eq('id', body.leadId)
    .eq('tenant_id', auth.tenantId);

  // Rule stats — only if round-robin didn't already do it via rpc
  if (matched.assignment_type !== 'round_robin') {
    // Fetch + increment — tolerable race since assignments_count is cosmetic.
    const { data: current } = await db
      .from('lead_assignment_rules')
      .select('assignments_count')
      .eq('id', matched.id)
      .maybeSingle();
    const next = ((current?.assignments_count as number | null) ?? 0) + 1;
    await db
      .from('lead_assignment_rules')
      .update({
        assignments_count: next,
        last_assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', matched.id);
  }

  // Bump rep load counter
  await db.rpc('lead_assignment_bump_rep_load', {
    p_tenant_id: auth.tenantId,
    p_user_id: assignedTo,
  });

  return jsonResponse(
    {
      success: true,
      assignment: hist.data,
      assignedTo,
      ruleUsed: matched.rule_name,
    },
    200,
    req,
    requestId,
  );
}

// Ported from server/routes-lead-assignment.ts::matchesRule
function matchesRule(lead: LeadData, rule: Rule): boolean {
  const c = rule.criteria as Record<string, any>;
  if (!c) return true;

  if (c.leadSource?.length && !c.leadSource.includes(lead.source)) return false;
  if (c.leadScore) {
    if (c.leadScore.min !== undefined && (lead.score ?? 0) < c.leadScore.min) return false;
    if (c.leadScore.max !== undefined && (lead.score ?? 0) > c.leadScore.max) return false;
  }
  if (c.industry?.length && !c.industry.includes(lead.industry)) return false;
  if (c.companySize) {
    if (c.companySize.min !== undefined && (lead.companySize ?? 0) < c.companySize.min)
      return false;
    if (c.companySize.max !== undefined && (lead.companySize ?? 0) > c.companySize.max)
      return false;
  }
  if (c.dealSize) {
    if (c.dealSize.min !== undefined && (lead.dealSize ?? 0) < c.dealSize.min) return false;
    if (c.dealSize.max !== undefined && (lead.dealSize ?? 0) > c.dealSize.max) return false;
  }
  if (c.geography) {
    if (c.geography.states?.length && !c.geography.states.includes(lead.state)) return false;
    if (c.geography.countries?.length && !c.geography.countries.includes(lead.country))
      return false;
  }
  if (c.productInterest?.length) {
    const li = lead.productInterest ?? [];
    if (!c.productInterest.some((p: string) => li.includes(p))) return false;
  }
  return true;
}
