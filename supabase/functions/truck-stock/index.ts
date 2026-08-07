/**
 * Truck-stock optimizer edge function (PROD-011) — port of
 * server/routes-truck-stock.ts (US-SUPER-007).
 *
 * Recommends what parts each tech should carry, from their actual last-90-day
 * usage, so techs stop returning to base mid-job. The optimizer produces a
 * per-tech recommendation; the warehouse picks it; the tech confirms receipt,
 * which APPLIES the recommendation to truck_inventory.
 *
 * WHY: Express-only, so TruckStocking.tsx worked in dev and hard-404'd in
 * production, where getApiUrl() rewrites /api/truck-stock ->
 * functions.printyx.net/truck-stock with no Express fallback.
 *
 * ROUTES — all ELEVEN Express endpoints, which is everything the page calls:
 *   POST /generate                          run the optimizer (cron-callable)
 *   GET  /recommendations                   latest recommendation per tech
 *   GET  /recommendations/:id               single recommendation + techName
 *   GET  /recommendations/:id/export.csv    restock pick list
 *   POST /recommendations/:id/pick          status -> picking
 *   POST /recommendations/:id/receive       status -> received; APPLY to truck_inventory
 *   GET  /inventory?techUserId=             a tech's current truck stock
 *   GET  /settings?techUserId=              getOrCreate per-tech capacity
 *   PUT  /settings                          update per-tech capacity
 *   POST /callbacks                         record a "missing part" callback
 *   GET  /stats                             accuracy stats
 *
 * ROUTING ORDER MATTERS: /recommendations/:id/export.csv is matched before the
 * bare /recommendations/:id, and 'export.csv' is checked as an ACTION segment —
 * the dot is part of the segment, not a file extension the dispatcher strips.
 *
 * /receive IS THE ONLY WRITE THAT CHANGES PHYSICAL STOCK. It upserts every
 * recommended SKU into truck_inventory at the recommended quantity, so it is
 * guarded on the recommendation existing and being tenant-scoped first, and the
 * status flip happens only after the upserts land. Reversing that order would
 * mark a truck restocked whose inventory was never written.
 *
 * The optimizer's approximations are carried over unchanged and are documented
 * in optimizer.ts: territory is derived from assigned tickets, recommendedQty is
 * trailing-90-day usage, fillRate is an all-or-nothing coverage proxy, and the
 * part->inventory_items match is fuzzy.
 */

import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import {
  DEFAULT_MAX_DISTINCT_SKUS,
  DEFAULT_MAX_TOTAL_QUANTITY,
  NINETY_DAYS_MS,
  buildCostMap,
  buildPickListCsv,
  computeStats,
  countRecommendedAdditions,
  fillRate,
  latestPerTech,
  num,
  parseCallback,
  parseGenerate,
  parseSettingsInput,
  resolveTechNames,
  selectRecommendedItems,
  tallyUsage,
  toCamelInventory,
  toCamelRecommendation,
  toCamelSettings,
  type RecommendedItem,
} from './optimizer.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

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
      return createCorsResponse({ message: 'Tenant ID is required' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    // Idempotent — the dispatcher strips segment 0 before the handler runs.
    const { parts } = normalizePath(url.pathname, 'truck-stock');
    const [resource, second, third] = parts;
    const method = req.method.toUpperCase();

    if (method === 'POST' && resource === 'generate') {
      return await generate(req, admin, tenantId, user.id);
    }

    if (resource === 'recommendations') {
      if (method === 'GET' && !second) return await listRecommendations(admin, tenantId, req);
      // export.csv BEFORE the bare :id — the dot is part of the segment.
      if (method === 'GET' && second && third === 'export.csv')
        return await exportCsv(admin, tenantId, user.id, second, req);
      if (method === 'GET' && second && !third)
        return await getRecommendation(admin, tenantId, second, req);
      if (method === 'POST' && second && third === 'pick')
        return await markPicking(admin, tenantId, user.id, second, req);
      if (method === 'POST' && second && third === 'receive')
        return await markReceived(admin, tenantId, user.id, second, req);
    }

    if (method === 'GET' && resource === 'inventory') {
      return await listInventory(admin, tenantId, url, req);
    }

    if (resource === 'settings') {
      if (method === 'GET') return await getSettings(admin, tenantId, url, req);
      if (method === 'PUT') return await putSettings(req, admin, tenantId, user.id);
    }

    if (method === 'POST' && resource === 'callbacks') {
      return await recordCallback(req, admin, tenantId, user.id);
    }

    if (method === 'GET' && resource === 'stats') {
      return await stats(admin, tenantId, req);
    }

    return createCorsResponse({ message: 'Not found' }, 404, req);
  } catch (error) {
    console.error('truck-stock error:', error);
    return createCorsResponse(
      { message: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}

function audit(action: string, ctx: { tenantId: string; userId?: string; extra?: unknown }) {
  console.log(
    JSON.stringify({
      audit: true,
      scope: 'truck-stock',
      action,
      tenantId: ctx.tenantId,
      userId: ctx.userId ?? 'system',
      timestamp: new Date().toISOString(),
      ...(ctx.extra ? { extra: ctx.extra } : {}),
    }),
  );
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

async function loadSettings(admin: Admin, tenantId: string, techUserId: string) {
  const { data: existing, error } = await admin
    .from('truck_stock_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('tech_user_id', techUserId)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing;

  const { data: created, error: insertError } = await admin
    .from('truck_stock_settings')
    .upsert(
      { tenant_id: tenantId, tech_user_id: techUserId },
      { onConflict: 'tenant_id,tech_user_id', ignoreDuplicates: true },
    )
    .select()
    .maybeSingle();
  if (insertError) throw insertError;
  if (created) return created;

  // ignoreDuplicates returns nothing when a concurrent call won the race.
  const { data: reread } = await admin
    .from('truck_stock_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('tech_user_id', techUserId)
    .maybeSingle();
  return reread;
}

// ---------------------------------------------------------------------------
// Optimizer
// ---------------------------------------------------------------------------

async function runOptimizer(admin: Admin, tenantId: string, techUserId: string) {
  const since = new Date(Date.now() - NINETY_DAYS_MS).toISOString();

  const { data: tickets, error: ticketError } = await admin
    .from('service_tickets')
    .select('parts_used')
    .eq('tenant_id', tenantId)
    .eq('assigned_technician_id', techUserId)
    .gte('created_at', since);
  if (ticketError) throw ticketError;

  const { usage, partsJobs } = tallyUsage(tickets ?? []);

  const { data: currentRows, error: inventoryError } = await admin
    .from('truck_inventory')
    .select('part_sku, quantity_on_truck')
    .eq('tenant_id', tenantId)
    .eq('tech_user_id', techUserId);
  if (inventoryError) throw inventoryError;

  const currentStock = new Map<string, number>();
  for (const row of currentRows ?? []) {
    currentStock.set(row.part_sku as string, num(row.quantity_on_truck));
  }

  const settings = await loadSettings(admin, tenantId, techUserId);
  const capacityTotal = settings?.max_total_quantity
    ? num(settings.max_total_quantity)
    : DEFAULT_MAX_TOTAL_QUANTITY;
  const capacityDistinct = settings?.max_distinct_skus
    ? num(settings.max_distinct_skus)
    : DEFAULT_MAX_DISTINCT_SKUS;

  const skus = Array.from(usage.keys());
  let costMap = new Map<string, { unitCost: number; description: string }>();
  if (skus.length > 0) {
    // The SKU may match EITHER part_number or name, which PostgREST expresses as
    // an .or() of two .in() filters — one round trip instead of the Express
    // full-table scan.
    const list = skus.map((s) => `"${s.replace(/"/g, '""')}"`).join(',');
    const { data: items, error: itemError } = await admin
      .from('inventory_items')
      .select('part_number, name, item_description, unit_cost')
      .eq('tenant_id', tenantId)
      .or(`part_number.in.(${list}),name.in.(${list})`);
    if (itemError) throw itemError;
    costMap = buildCostMap(items ?? [], skus);
  }

  const { items, recommendedStock } = selectRecommendedItems({
    usage,
    currentStock,
    costMap,
    capacityTotal,
    capacityDistinct,
  });

  return {
    currentFillRate: fillRate(partsJobs, currentStock),
    projectedFillRate: fillRate(partsJobs, recommendedStock),
    capacityTotal,
    capacityDistinct,
    recommendedItems: items,
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

async function generate(req: Request, admin: Admin, tenantId: string, userId: string) {
  const parsed = parseGenerate(await safeJson(req));
  if (!parsed.ok) {
    return createCorsResponse({ message: 'Invalid input', errors: parsed.message }, 400, req);
  }

  let techIds: string[];
  if (parsed.value.techUserId) {
    techIds = [parsed.value.techUserId];
  } else {
    // PostgREST has no SELECT DISTINCT, so the distinct set is built in JS from
    // the ids of tickets in the window.
    const since = new Date(Date.now() - NINETY_DAYS_MS).toISOString();
    const { data: rows, error } = await admin
      .from('service_tickets')
      .select('assigned_technician_id')
      .eq('tenant_id', tenantId)
      .not('assigned_technician_id', 'is', null)
      .gte('created_at', since);
    if (error) throw error;
    techIds = Array.from(
      new Set((rows ?? []).map((r) => r.assigned_technician_id as string).filter(Boolean)),
    );
  }

  let generated = 0;
  for (const techUserId of techIds) {
    const result = await runOptimizer(admin, tenantId, techUserId);
    const { error } = await admin.from('truck_stock_recommendations').insert({
      tenant_id: tenantId,
      tech_user_id: techUserId,
      status: 'draft',
      current_fill_rate: result.currentFillRate,
      projected_fill_rate: result.projectedFillRate,
      capacity_total: result.capacityTotal,
      capacity_distinct: result.capacityDistinct,
      recommended_items: result.recommendedItems,
      generated_at: new Date().toISOString(),
    });
    if (error) throw error;
    generated++;
  }

  audit('GENERATE', { tenantId, userId, extra: { techs: techIds.length, generated } });
  return createCorsResponse({ generated, techs: techIds.length }, 200, req);
}

async function listRecommendations(admin: Admin, tenantId: string, req: Request) {
  const { data: rows, error } = await admin
    .from('truck_stock_recommendations')
    .select('*')
    .eq('tenant_id', tenantId)
    // DESCENDING: latestPerTech keeps the first row it sees per tech.
    .order('generated_at', { ascending: false })
    .limit(2000);
  if (error) throw error;

  const deduped = latestPerTech(rows ?? []);
  const names = await techNames(
    admin,
    tenantId,
    deduped.map((r) => r.tech_user_id as string),
  );

  const data = deduped.map((row) => ({
    ...toCamelRecommendation(row),
    techName: names.get(row.tech_user_id as string) ?? null,
    recommendedAdditions: countRecommendedAdditions(row.recommended_items),
  }));

  return createCorsResponse({ data, total: data.length }, 200, req);
}

async function getRecommendation(admin: Admin, tenantId: string, id: string, req: Request) {
  const row = await findRecommendation(admin, tenantId, id);
  if (!row) return createCorsResponse({ message: 'Recommendation not found' }, 404, req);

  const names = await techNames(admin, tenantId, [row.tech_user_id as string]);
  return createCorsResponse(
    {
      ...toCamelRecommendation(row),
      techName: names.get(row.tech_user_id as string) ?? null,
    },
    200,
    req,
  );
}

async function exportCsv(admin: Admin, tenantId: string, userId: string, id: string, req: Request) {
  const row = await findRecommendation(admin, tenantId, id);
  if (!row) return createCorsResponse({ message: 'Recommendation not found' }, 404, req);

  const csv = buildPickListCsv(row.recommended_items);
  const items = Array.isArray(row.recommended_items) ? row.recommended_items.length : 0;
  audit('EXPORT_CSV', { tenantId, userId, extra: { id, rows: items } });

  // Built by hand rather than through createCorsResponse, which JSON-encodes.
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="truck-stock-${id}.csv"`,
      'Access-Control-Allow-Origin': req.headers.get('Origin') ?? '*',
      'Access-Control-Allow-Credentials': 'true',
      Vary: 'Origin',
    },
  });
}

async function markPicking(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  const now = new Date().toISOString();
  const { data: row, error } = await admin
    .from('truck_stock_recommendations')
    .update({ status: 'picking', picked_at: now, updated_at: now })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!row) return createCorsResponse({ message: 'Recommendation not found' }, 404, req);

  audit('PICK', { tenantId, userId, extra: { id } });
  return createCorsResponse(toCamelRecommendation(row), 200, req);
}

/**
 * The tech confirms receipt. This is the only endpoint that changes what is
 * physically on a truck, so the recommendation is resolved (and tenant-checked)
 * first, the inventory upserts run next, and the status flip comes LAST — a
 * failure part-way leaves the recommendation re-runnable rather than marked
 * received with nothing written.
 */
async function markReceived(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  const rec = await findRecommendation(admin, tenantId, id);
  if (!rec) return createCorsResponse({ message: 'Recommendation not found' }, 404, req);

  const items = Array.isArray(rec.recommended_items)
    ? (rec.recommended_items as RecommendedItem[])
    : [];
  const now = new Date().toISOString();

  if (items.length > 0) {
    const { error: upsertError } = await admin.from('truck_inventory').upsert(
      items.map((item) => ({
        tenant_id: tenantId,
        tech_user_id: rec.tech_user_id,
        part_sku: item.sku,
        quantity_on_truck: num(item.recommendedQty),
        last_audited_at: now,
        updated_at: now,
      })),
      { onConflict: 'tenant_id,tech_user_id,part_sku' },
    );
    if (upsertError) throw upsertError;
  }

  const { data: row, error } = await admin
    .from('truck_stock_recommendations')
    .update({ status: 'received', received_at: now, updated_at: now })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .maybeSingle();
  if (error) throw error;

  audit('RECEIVE', { tenantId, userId, extra: { id, applied: items.length } });
  return createCorsResponse(
    { ...(row ? toCamelRecommendation(row) : {}), applied: items.length },
    200,
    req,
  );
}

async function listInventory(admin: Admin, tenantId: string, url: URL, req: Request) {
  const techUserId = url.searchParams.get('techUserId');
  if (!techUserId) return createCorsResponse({ message: 'techUserId is required' }, 400, req);

  const { data, error } = await admin
    .from('truck_inventory')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('tech_user_id', techUserId)
    .order('quantity_on_truck', { ascending: false });
  if (error) throw error;

  const rows = (data ?? []).map(toCamelInventory);
  return createCorsResponse({ data: rows, total: rows.length }, 200, req);
}

async function getSettings(admin: Admin, tenantId: string, url: URL, req: Request) {
  const techUserId = url.searchParams.get('techUserId');
  if (!techUserId) return createCorsResponse({ message: 'techUserId is required' }, 400, req);

  const settings = await loadSettings(admin, tenantId, techUserId);
  if (!settings) return createCorsResponse({ message: 'Failed to load settings' }, 500, req);
  return createCorsResponse(toCamelSettings(settings), 200, req);
}

async function putSettings(req: Request, admin: Admin, tenantId: string, userId: string) {
  const parsed = parseSettingsInput(await safeJson(req));
  if (!parsed.ok) {
    return createCorsResponse({ message: 'Invalid input', errors: parsed.message }, 400, req);
  }
  const { techUserId, ...rest } = parsed.value;

  await loadSettings(admin, tenantId, techUserId);

  const updates: Record<string, unknown> = {
    updated_by_user_id: userId,
    updated_at: new Date().toISOString(),
  };
  if (rest.maxTotalQuantity !== undefined) updates.max_total_quantity = rest.maxTotalQuantity;
  if (rest.maxDistinctSkus !== undefined) updates.max_distinct_skus = rest.maxDistinctSkus;

  const { data: updated, error } = await admin
    .from('truck_stock_settings')
    .update(updates)
    .eq('tenant_id', tenantId)
    .eq('tech_user_id', techUserId)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!updated) return createCorsResponse({ message: 'Settings not found' }, 404, req);

  audit('UPDATE_SETTINGS', { tenantId, userId, extra: parsed.value });
  return createCorsResponse(toCamelSettings(updated), 200, req);
}

async function recordCallback(req: Request, admin: Admin, tenantId: string, userId: string) {
  const parsed = parseCallback(await safeJson(req));
  if (!parsed.ok) {
    return createCorsResponse({ message: 'Invalid input', errors: parsed.message }, 400, req);
  }
  const input = parsed.value;

  // Best-effort unit cost for the missing SKU, so the callback carries what the
  // stockout cost. Absent is fine; a wrong cost would not be.
  let unitCost: string | null = null;
  if (input.missingPartSku) {
    const quoted = `"${input.missingPartSku.replace(/"/g, '""')}"`;
    const { data: item } = await admin
      .from('inventory_items')
      .select('unit_cost')
      .eq('tenant_id', tenantId)
      .or(`part_number.eq.${quoted},name.eq.${quoted}`)
      .limit(1)
      .maybeSingle();
    if (item?.unit_cost != null) unitCost = String(item.unit_cost);
  }

  const { data: row, error } = await admin
    .from('truck_stock_callbacks')
    .insert({
      tenant_id: tenantId,
      tech_user_id: input.techUserId ?? null,
      ticket_id: input.ticketId ?? null,
      missing_part_sku: input.missingPartSku ?? null,
      note: input.note ?? null,
      unit_cost: unitCost,
      created_by_user_id: userId,
    })
    .select()
    .single();
  if (error) throw error;

  audit('CALLBACK', { tenantId, userId, extra: { sku: input.missingPartSku } });
  return createCorsResponse(row, 201, req);
}

async function stats(admin: Admin, tenantId: string, req: Request) {
  const [callbacksResult, recsResult] = await Promise.all([
    admin.from('truck_stock_callbacks').select('tech_user_id').eq('tenant_id', tenantId),
    admin
      .from('truck_stock_recommendations')
      .select('tech_user_id, generated_at, current_fill_rate, projected_fill_rate')
      .eq('tenant_id', tenantId)
      .order('generated_at', { ascending: false })
      .limit(2000),
  ]);
  if (callbacksResult.error) throw callbacksResult.error;
  if (recsResult.error) throw recsResult.error;

  const callbacks = callbacksResult.data ?? [];
  const latest = latestPerTech(recsResult.data ?? []);
  const computed = computeStats({ callbacks, latestRecs: latest });

  const names = await techNames(admin, tenantId, [
    ...computed.callbacksByTech.map((c) => c.techUserId).filter((id) => id !== 'unassigned'),
    ...latest.map((r) => r.tech_user_id as string),
  ]);

  return createCorsResponse(
    {
      ...computed,
      callbacksByTech: computed.callbacksByTech.map((c) => ({
        ...c,
        techName: names.get(c.techUserId) ?? null,
      })),
    },
    200,
    req,
  );
}

// ---------------------------------------------------------------------------
// Shared lookups
// ---------------------------------------------------------------------------

async function findRecommendation(admin: Admin, tenantId: string, id: string) {
  const { data, error } = await admin
    .from('truck_stock_recommendations')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * techUserId may be a technicians.id OR a technicians.user_id, so both columns
 * are queried and both are indexed in the returned map.
 */
async function techNames(
  admin: Admin,
  tenantId: string,
  techIds: string[],
): Promise<Map<string, string>> {
  const ids = Array.from(new Set(techIds.filter(Boolean)));
  if (ids.length === 0) return new Map();

  const { data, error } = await admin
    .from('technicians')
    .select('id, user_id, first_name, last_name')
    .eq('tenant_id', tenantId)
    .or(`id.in.(${ids.join(',')}),user_id.in.(${ids.join(',')})`);
  if (error) throw error;

  return resolveTechNames(data ?? [], ids);
}

async function safeJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
