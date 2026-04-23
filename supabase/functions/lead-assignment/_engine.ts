// Routing engine — ported from server/services/auto-lead-routing-service.ts.
//
// Scope (per PRD US-013 §1):
//   - rep scoring (capacity, skills, territory, performance)
//   - assignment writes (business_records.owner_id + lead_assignment_history +
//     rep_capacity counter increment — the last via a PL/pgSQL function so
//     the counter update is atomic, never a read-modify-write race)
//   - dashboard aggregates
//
// Out of scope (handled by other PRDs):
//   - AI lead scoring (US-012 lead-scoring)
//   - Assignment email (Phase 3 email-marketing)
//
// The route() function takes a pre-computed lead score as input. If absent,
// defaults to 50 (neutral) — routing then decides on rep capacity + territory
// match alone. When US-012 lands, the routing handler calls into lead-scoring
// before invoking route() with the real score.

// deno-lint-ignore no-explicit-any
export type DB = any;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BusinessRecordForRouting {
  id: string;
  tenant_id: string;
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  industry?: string | null;
  employee_count?: number | null;
  annual_revenue?: number | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  source?: string | null;
  title?: string | null;
  owner_id?: string | null;
}

export interface RepCapacityRow {
  id: string;
  tenant_id: string;
  user_id: string;
  max_active_leads: number | null;
  current_active_leads: number;
  leads_assigned_today: number;
  leads_assigned_this_week: number;
  is_available: boolean;
  skills: string[] | null;
  conversion_rate: string | null;
  average_response_time_minutes: number | null;
  average_deal_size: string | null;
}

export interface SalesTerritoryRow {
  id: string;
  tenant_id: string;
  territory_name: string;
  owner_id: string | null;
  is_active: boolean;
  geographic_rules: GeographicRules | null;
  account_rules: AccountRules | null;
}

export interface GeographicRules {
  countries?: string[];
  states?: string[];
  cities?: string[];
  zipCodes?: string[];
}

export interface AccountRules {
  industries?: string[];
  companySizeMin?: number;
  companySizeMax?: number;
  accountTiers?: string[];
}

export interface RepScore {
  userId: string;
  userName: string;
  score: number;
  reasons: string[];
  capacity: { available: boolean; currentLoad: number; maxLoad: number };
  performance: { conversionRate: number; avgResponseTime: number; avgDealSize: number };
}

export interface AssignmentDecision {
  success: boolean;
  assignedTo: string;
  assignedRepName: string;
  assignmentReason: string;
  alternativeReps: RepScore[];
  leadScore: number;
  processingTimeMs: number;
}

export interface RouteOptions {
  leadScore?: number; // 0-100; default 50 (neutral) if caller hasn't scored yet
  reason?: string;
  dryRun?: boolean; // preview — don't write
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function route(
  db: DB,
  leadId: string,
  tenantId: string,
  opts: RouteOptions = {},
): Promise<AssignmentDecision> {
  const startedAt = Date.now();
  const leadScore = opts.leadScore ?? 50;

  const { data: lead, error: leadErr } = await db
    .from('business_records')
    .select('*')
    .eq('id', leadId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (leadErr) throw new Error(`Lead lookup failed: ${leadErr.message ?? leadErr}`);
  if (!lead) throw new Error(`Lead ${leadId} not found`);

  const repScores = await scoreReps(db, lead as BusinessRecordForRouting, leadScore, tenantId);
  if (repScores.length === 0) {
    throw new Error('No available sales reps');
  }
  const best = repScores[0];

  if (!opts.dryRun) {
    await assignLeadToRep(db, leadId, best.userId, tenantId, opts.reason ?? 'auto_routing', {
      leadScore,
      notes: `Auto-routed. Score: ${leadScore}/100. Reasons: ${best.reasons.join('; ')}`,
    });
  }

  return {
    success: true,
    assignedTo: best.userId,
    assignedRepName: best.userName,
    assignmentReason: best.reasons.join('; '),
    alternativeReps: repScores.slice(1, 4),
    leadScore,
    processingTimeMs: Date.now() - startedAt,
  };
}

export async function preview(
  db: DB,
  leadId: string,
  tenantId: string,
  leadScore = 50,
): Promise<AssignmentDecision> {
  return await route(db, leadId, tenantId, { leadScore, dryRun: true });
}

// ─── Rep scoring ──────────────────────────────────────────────────────────────

export async function scoreReps(
  db: DB,
  lead: BusinessRecordForRouting,
  leadScore: number,
  tenantId: string,
): Promise<RepScore[]> {
  const { data: reps, error: repsErr } = await db
    .from('rep_capacity')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_available', true);

  if (repsErr) throw new Error(`Rep capacity lookup failed: ${repsErr.message ?? repsErr}`);
  const repList = (reps ?? []) as RepCapacityRow[];
  if (repList.length === 0) return [];

  const userIds = repList.map((r) => r.user_id);
  const userNameMap = await batchGetUserFullNames(db, userIds);

  // Pre-fetch all active territories for these reps in one query
  const { data: territories } = await db
    .from('sales_territories')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .in('owner_id', userIds);
  const territoryByOwner = new Map<string, SalesTerritoryRow[]>();
  for (const t of (territories ?? []) as SalesTerritoryRow[]) {
    if (!t.owner_id) continue;
    const list = territoryByOwner.get(t.owner_id) ?? [];
    list.push(t);
    territoryByOwner.set(t.owner_id, list);
  }

  const scores: RepScore[] = [];
  for (const rep of repList) {
    const reasons: string[] = [];
    let score = 50; // base

    // Capacity
    const maxLoad = rep.max_active_leads ?? 50;
    const utilization = maxLoad > 0 ? (rep.current_active_leads ?? 0) / maxLoad : 0;
    if (utilization < 0.6) {
      score += 20;
      reasons.push('Low workload');
    } else if (utilization < 0.8) {
      score += 10;
      reasons.push('Moderate workload');
    } else {
      score -= 10;
      reasons.push('High workload');
    }

    // Performance: conversion rate
    const conv = parseFloat(rep.conversion_rate ?? '0');
    if (conv > 0.3) {
      score += 15;
      reasons.push(`High conversion rate (${(conv * 100).toFixed(0)}%)`);
    }

    // Performance: response time
    if (rep.average_response_time_minutes !== null && rep.average_response_time_minutes < 10) {
      score += 10;
      reasons.push('Fast response time');
    }

    // Skills present (just a signal — scoring rules define matching)
    if (rep.skills && rep.skills.length > 0) {
      score += 5;
      reasons.push('Has skills tagged');
    }

    // Territory match
    for (const t of territoryByOwner.get(rep.user_id) ?? []) {
      if (leadMatchesTerritory(lead, t)) {
        score += 25;
        reasons.push(`Territory match: ${t.territory_name}`);
        break;
      }
    }

    // High-value lead → top performer
    if (leadScore >= 70 && conv > 0.25) {
      score += 10;
      reasons.push('Top performer for hot lead');
    }

    scores.push({
      userId: rep.user_id,
      userName: userNameMap.get(rep.user_id) ?? rep.user_id,
      score,
      reasons,
      capacity: {
        available: rep.is_available,
        currentLoad: rep.current_active_leads ?? 0,
        maxLoad,
      },
      performance: {
        conversionRate: conv,
        avgResponseTime: rep.average_response_time_minutes ?? 0,
        avgDealSize: parseFloat(rep.average_deal_size ?? '0'),
      },
    });
  }

  return scores.sort((a, b) => b.score - a.score);
}

// ─── Assignment write ─────────────────────────────────────────────────────────

export async function assignLeadToRep(
  db: DB,
  leadId: string,
  repUserId: string,
  tenantId: string,
  reason: string,
  extras: { leadScore?: number; notes?: string; assignedBy?: string } = {},
): Promise<void> {
  // 1. Update lead owner
  const updLead = await db
    .from('business_records')
    .update({
      owner_id: repUserId,
      status: 'assigned',
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId)
    .eq('tenant_id', tenantId);
  if (updLead.error) throw new Error(`Lead update failed: ${updLead.error.message}`);

  // 2. History row
  const histInsert = await db.from('lead_assignment_history').insert({
    tenant_id: tenantId,
    lead_id: leadId,
    assigned_to: repUserId,
    assignment_reason: reason,
    assigned_by: extras.assignedBy ?? 'system',
    assignment_notes: extras.notes ?? null,
  });
  if (histInsert.error) throw new Error(`History insert failed: ${histInsert.error.message}`);

  // 3. Rep capacity counter — via PL/pgSQL to avoid read-modify-write race.
  //    The SQL lives in drizzle/functions/lead-assignment.sql and MUST be
  //    applied before routing goes live. See followup comment in the deploy
  //    notes for the exact command.
  const rpcResult = await db.rpc('lead_assignment_bump_rep_load', {
    p_tenant_id: tenantId,
    p_user_id: repUserId,
  });
  if (rpcResult.error) {
    throw new Error(`Rep capacity counter update failed: ${rpcResult.error.message}`);
  }
}

// ─── Territory matching ───────────────────────────────────────────────────────

export function leadMatchesTerritory(
  lead: BusinessRecordForRouting,
  territory: SalesTerritoryRow,
): boolean {
  const geo = territory.geographic_rules;
  if (geo) {
    if (geo.states && lead.state && geo.states.includes(lead.state)) return true;
    if (geo.cities && lead.city && geo.cities.includes(lead.city)) return true;
    if (geo.zipCodes && lead.postal_code && geo.zipCodes.includes(lead.postal_code)) return true;
  }
  const acct = territory.account_rules;
  if (acct) {
    if (acct.industries && lead.industry && acct.industries.includes(lead.industry)) return true;
  }
  return false;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function batchGetUserFullNames(db: DB, userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (userIds.length === 0) return map;

  const unique = [...new Set(userIds)];
  const { data } = await db.from('users').select('id, first_name, last_name').in('id', unique);

  for (const row of (data ?? []) as Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
  }>) {
    const full = [row.first_name, row.last_name].filter(Boolean).join(' ') || row.id;
    map.set(row.id, full);
  }
  for (const id of userIds) {
    if (!map.has(id)) map.set(id, id);
  }
  return map;
}
