// Territories — merged handler for both legacy URL prefixes:
//
//   /sales-territories/*   (5 endpoints — simple CRUD, from routes-lead-assignment.ts)
//   /territories/*         (8 endpoints — types, CRUD, match, assign-lead, stats,
//                            from routes-territory-management.ts)
//
// Both operate on the same `sales_territories` table; the split came from two
// Express files growing in parallel. The dispatcher passes the matched prefix
// so we can gate the richer /territories/* routes (match/stats/types).

import { errorResponse, jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';
import { findMatchingTerritory, territoryMatchesStrict } from '../_territory.ts';

const TERRITORY_TYPES = {
  geographic: {
    name: 'Geographic',
    description: 'Territory based on location (country, state, city, zip)',
  },
  industry: { name: 'Industry', description: 'Territory based on industry vertical' },
  account_size: { name: 'Account Size', description: 'Territory based on company size or revenue' },
  product_line: { name: 'Product Line', description: 'Territory based on product focus' },
  named_accounts: {
    name: 'Named Accounts',
    description: 'Specific accounts assigned to territory',
  },
} as const;

export async function handleTerritories(
  req: Request,
  ctx: HandlerCtx,
  matchedPrefix: string,
): Promise<Response | null> {
  const { method, pathParts, auth, db, requestId } = ctx;
  const isRichPrefix = matchedPrefix === '/territories';
  const first = pathParts[0];
  const second = pathParts[1];

  // ─── Rich-prefix-only endpoints (/territories/*) ─────────────────────────

  if (isRichPrefix && first === 'types' && method === 'GET') {
    return jsonResponse({ territoryTypes: TERRITORY_TYPES }, 200, req, requestId);
  }

  if (isRichPrefix && first === 'match' && method === 'POST') {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const territory = await findMatchingTerritory(db, auth.tenantId, body);
    return jsonResponse({ territory }, 200, req, requestId);
  }

  if (isRichPrefix && first === 'stats' && method === 'GET') {
    return await getStats(req, ctx);
  }

  if (isRichPrefix && first && second === 'assign-lead' && method === 'POST') {
    return await assignLeadToTerritory(req, ctx, first);
  }

  // Delegate sub-paths the territory-management router mirrored. The dispatcher
  // hasn't re-routed them; we forward here to keep one territory handler.
  if (isRichPrefix && first === 'rules') {
    const { handleRules } = await import('./rules.ts');
    return handleRules(req, { ...ctx, pathParts: pathParts.slice(1) });
  }
  if (isRichPrefix && first === 'capacity') {
    const { handleCapacity } = await import('./capacity.ts');
    return handleCapacity(req, { ...ctx, pathParts: pathParts.slice(1) });
  }
  if (isRichPrefix && first === 'history') {
    const { handleHistory } = await import('./history.ts');
    // /territories/history/lead/:leadId and /territories/history/rep/:userId
    return handleHistory(
      req,
      { ...ctx, pathParts: pathParts.slice(1) },
      '/lead-assignment-history',
    );
  }

  // ─── Shared CRUD (both /sales-territories and /territories) ──────────────

  const territoryId = first;

  if (method === 'GET' && !territoryId) {
    const { data, error } = await db
      .from('sales_territories')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .order('priority', { ascending: false });
    if (error) {
      return errorResponse(500, 'Failed to fetch territories', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    return jsonResponse(data ?? [], 200, req, requestId);
  }

  if (method === 'GET' && territoryId) {
    const { data, error } = await db
      .from('sales_territories')
      .select('*')
      .eq('id', territoryId)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (error) {
      return errorResponse(500, 'Failed to fetch territory', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    if (!data)
      return errorResponse(404, 'Territory not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'POST' && !territoryId) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return errorResponse(400, 'Invalid JSON body', req, { code: 'INVALID_JSON', requestId });
    }
    const row = mapTerritoryFields(body);
    row.tenant_id = auth.tenantId;
    const { data, error } = await db.from('sales_territories').insert(row).select().maybeSingle();
    if (error) {
      return errorResponse(500, 'Failed to create territory', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    return jsonResponse(data, 201, req, requestId);
  }

  if ((method === 'PUT' || method === 'PATCH') && territoryId) {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return errorResponse(400, 'Invalid JSON body', req, { code: 'INVALID_JSON', requestId });
    }
    const row = mapTerritoryFields(body);
    row.updated_at = new Date().toISOString();
    const { data, error } = await db
      .from('sales_territories')
      .update(row)
      .eq('id', territoryId)
      .eq('tenant_id', auth.tenantId)
      .select()
      .maybeSingle();
    if (error) {
      return errorResponse(500, 'Failed to update territory', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    if (!data)
      return errorResponse(404, 'Territory not found', req, { code: 'NOT_FOUND', requestId });
    return jsonResponse(data, 200, req, requestId);
  }

  if (method === 'DELETE' && territoryId) {
    const { error } = await db
      .from('sales_territories')
      .delete()
      .eq('id', territoryId)
      .eq('tenant_id', auth.tenantId);
    if (error) {
      return errorResponse(500, 'Failed to delete territory', req, {
        code: 'DB_ERROR',
        details: error,
        requestId,
      });
    }
    return jsonResponse({ success: true }, 200, req, requestId);
  }

  return null;
}

// ─── /territories/:id/assign-lead ─────────────────────────────────────────────

async function assignLeadToTerritory(
  req: Request,
  ctx: HandlerCtx,
  territoryId: string,
): Promise<Response> {
  const { auth, db, requestId } = ctx;
  const body = (await req.json().catch(() => ({}))) as { leadId?: string };
  if (!body.leadId) {
    return errorResponse(400, 'leadId is required', req, {
      code: 'VALIDATION_ERROR',
      requestId,
    });
  }

  const { data: territory, error: tErr } = await db
    .from('sales_territories')
    .select('id, owner_id, territory_name')
    .eq('id', territoryId)
    .eq('tenant_id', auth.tenantId)
    .maybeSingle();
  if (tErr) {
    return errorResponse(500, 'Failed to load territory', req, {
      code: 'DB_ERROR',
      details: tErr,
      requestId,
    });
  }
  if (!territory) {
    return errorResponse(404, 'Territory not found', req, { code: 'NOT_FOUND', requestId });
  }
  if (!territory.owner_id) {
    return errorResponse(400, 'Territory has no assigned owner', req, {
      code: 'NO_TERRITORY_OWNER',
      requestId,
    });
  }

  // Update lead owner
  await db
    .from('business_records')
    .update({ owner_id: territory.owner_id, updated_at: new Date().toISOString() })
    .eq('id', body.leadId)
    .eq('tenant_id', auth.tenantId);

  // Record history
  await db.from('lead_assignment_history').insert({
    tenant_id: auth.tenantId,
    lead_id: body.leadId,
    assigned_to: territory.owner_id,
    assignment_reason: 'territory_match',
    assigned_by: auth.userId,
    assignment_notes: `Assigned based on territory: ${territory.territory_name}`,
  });

  // Bump territory active leads count via RPC for atomicity — but we don't
  // have a dedicated helper; a plain update is fine here (no concurrency
  // concern on a per-territory counter bumped by a manual action).
  const { data: current } = await db
    .from('sales_territories')
    .select('active_leads_count')
    .eq('id', territoryId)
    .maybeSingle();
  const next = ((current?.active_leads_count as number | null) ?? 0) + 1;
  await db
    .from('sales_territories')
    .update({ active_leads_count: next, updated_at: new Date().toISOString() })
    .eq('id', territoryId)
    .eq('tenant_id', auth.tenantId);

  return jsonResponse(
    { message: 'Lead assigned to territory successfully', territoryId, leadId: body.leadId },
    200,
    req,
    requestId,
  );
}

// ─── /territories/stats ───────────────────────────────────────────────────────

async function getStats(req: Request, ctx: HandlerCtx): Promise<Response> {
  const { auth, db, requestId } = ctx;

  // Five counts. supabase-js doesn't group-by cleanly; use separate HEAD
  // counts for the simple totals and a full-row fetch for the type grouping.
  const [total, active, rows, unassigned, reps] = await Promise.all([
    db
      .from('sales_territories')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', auth.tenantId),
    db
      .from('sales_territories')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', auth.tenantId)
      .eq('is_active', true),
    db
      .from('sales_territories')
      .select('territory_type, active_leads_count')
      .eq('tenant_id', auth.tenantId),
    db
      .from('business_records')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', auth.tenantId)
      .is('owner_id', null)
      .eq('status', 'lead'),
    db
      .from('rep_capacity')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', auth.tenantId)
      .eq('is_available', true),
  ]);

  const byType: Record<string, number> = {};
  let totalLeadsAssigned = 0;
  for (const r of (rows.data ?? []) as Array<{
    territory_type: string | null;
    active_leads_count: number | null;
  }>) {
    const t = r.territory_type ?? 'unknown';
    byType[t] = (byType[t] ?? 0) + 1;
    totalLeadsAssigned += r.active_leads_count ?? 0;
  }

  return jsonResponse(
    {
      totalTerritories: total.count ?? 0,
      activeTerritories: active.count ?? 0,
      byType,
      totalLeadsAssigned,
      unassignedLeads: unassigned.count ?? 0,
      repsWithCapacity: reps.count ?? 0,
    },
    200,
    req,
    requestId,
  );
}

// ─── Field mapping ────────────────────────────────────────────────────────────

function mapTerritoryFields(body: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  const src = (camel: string, snake: string) => body[camel] ?? body[snake];

  if (src('territoryName', 'territory_name') !== undefined)
    r.territory_name = src('territoryName', 'territory_name');
  if (src('territoryCode', 'territory_code') !== undefined)
    r.territory_code = src('territoryCode', 'territory_code');
  if (body.description !== undefined) r.description = body.description;
  if (src('territoryType', 'territory_type') !== undefined)
    r.territory_type = src('territoryType', 'territory_type');
  if (src('geographicRules', 'geographic_rules') !== undefined)
    r.geographic_rules = src('geographicRules', 'geographic_rules');
  if (src('accountRules', 'account_rules') !== undefined)
    r.account_rules = src('accountRules', 'account_rules');
  if (src('productFocus', 'product_focus') !== undefined)
    r.product_focus = src('productFocus', 'product_focus');
  if (src('isActive', 'is_active') !== undefined) r.is_active = src('isActive', 'is_active');
  if (body.priority !== undefined) r.priority = body.priority;
  if (src('ownerId', 'owner_id') !== undefined) r.owner_id = src('ownerId', 'owner_id');
  if (src('teamMembers', 'team_members') !== undefined)
    r.team_members = src('teamMembers', 'team_members');
  if (src('managerId', 'manager_id') !== undefined) r.manager_id = src('managerId', 'manager_id');
  if (src('monthlyQuota', 'monthly_quota') !== undefined)
    r.monthly_quota = src('monthlyQuota', 'monthly_quota');

  return r;
}

// Re-export so the dispatcher can tap the strict matcher if needed.
export { territoryMatchesStrict };
