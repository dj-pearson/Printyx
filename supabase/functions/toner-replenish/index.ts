/**
 * Multi-vendor toner auto-replenish edge function (PROD-011) — port of
 * server/routes-toner-replenish.ts (US-SUPER-012).
 *
 * Toner ships before a machine runs out. A daily pipeline captures each
 * machine's supply levels, regresses the last 14 days to predict the depletion
 * date, and creates a replenishment order when depletion lands inside the
 * lead-time + safety-buffer window. Orders auto-ship under the cost ceiling and
 * otherwise wait for approval.
 *
 * WHY: Express-only, so TonerReplenish.tsx worked in dev and hard-404'd in
 * production, where getApiUrl() rewrites /api/toner-replenish ->
 * functions.printyx.net/toner-replenish with no Express fallback.
 *
 * ROUTES — all TWELVE Express endpoints, which is everything the page calls:
 *   POST /capture                              read levels (cron-callable)
 *   POST /evaluate                             regress + create orders (cron-callable)
 *   POST /run                                  capture then evaluate
 *   GET  /levels?machineId=                    latest level per machine+color
 *   GET  /orders?status=                       orders list, newest first
 *   POST /orders/:id/ship                      approve & ship
 *   POST /orders/:id/cancel                    cancel
 *   POST /machines/:machineId/ship-now         emergency manual order + ship
 *   GET  /settings                             tenant settings (getOrCreate)
 *   PUT  /settings                             update tenant settings
 *   GET  /machines/:machineId/settings         per-machine settings (getOrCreate)
 *   PUT  /machines/:machineId/settings         update per-machine settings
 *
 * THIS PIPELINE SPENDS MONEY WITHOUT A HUMAN — an auto_ship order becomes a
 * cartridge on a truck — so the suppressions are the point, not decoration, and
 * are preserved exactly (see isSuppressed / orderStatusFor in replenish.ts):
 *   - a CUSTOMER-MANAGED machine never orders unless its emergency override is
 *     set; that customer buys their own toner and shipping to them bills for
 *     something they did not ask for
 *   - autoShipEnabled=false suppresses independently, on the operator side
 *   - a machine+color with an order already in flight never gets a second one
 *   - the cost gate is the MINIMUM of the tenant threshold and the machine
 *     ceiling, so the tighter limit always wins
 *   - a flat or RISING level curve predicts nothing: someone just replaced the
 *     cartridge, and ordering off a rising curve ships toner nobody needs
 *
 * STUBS carried over unchanged and still marked as such: vendor levels are
 * DETERMINISTIC SYNTHETIC readings written with source='injected' (TODO(ABK):
 * wire the real multi-vendor adapters), the per-color unit cost is a fixed
 * proxy, and the tracking number is generated rather than obtained from a
 * carrier.
 */

import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { sendEmail } from '../email-marketing/_sendgrid.ts';
import {
  DAY_MS,
  DEFAULT_LEAD_TIME_DAYS,
  FOURTEEN_DAYS_MS,
  OPEN_ORDER_STATUSES,
  TONER_UNIT_COST,
  colorKeyOf,
  fetchVendorSupplyLevels,
  groupReadings,
  isSuppressed,
  latestPerMachineColor,
  num,
  orderKey,
  orderStatusFor,
  parseCapture,
  parseMachineSettings,
  parseOrderStatusFilter,
  parseShipNow,
  parseTenantSettings,
  predictDepletion,
  supplyName,
  toLevel,
  toMachineSettings,
  toOrder,
  toTenantSettings,
  triggerReason,
  windowDays,
  type MachineRow,
} from './replenish.ts';

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
    const { parts } = normalizePath(url.pathname, 'toner-replenish');
    const [resource, second, third] = parts;
    const method = req.method.toUpperCase();

    if (method === 'POST' && resource === 'capture')
      return await capture(req, admin, tenantId, user.id);
    if (method === 'POST' && resource === 'evaluate') {
      const result = await runEvaluate(admin, tenantId, user.id);
      return createCorsResponse(result, 200, req);
    }
    if (method === 'POST' && resource === 'run') {
      const captureResult = await runCapture(admin, tenantId);
      const evaluate = await runEvaluate(admin, tenantId, user.id);
      audit('RUN', { tenantId, userId: user.id, extra: { capture: captureResult, evaluate } });
      return createCorsResponse({ capture: captureResult, evaluate }, 200, req);
    }

    if (method === 'GET' && resource === 'levels')
      return await listLevels(admin, tenantId, url, req);

    if (resource === 'orders') {
      if (method === 'GET' && !second) return await listOrders(admin, tenantId, url, req);
      if (method === 'POST' && second && third === 'ship')
        return await shipOrder(admin, tenantId, user.id, second, req);
      if (method === 'POST' && second && third === 'cancel')
        return await cancelOrder(admin, tenantId, user.id, second, req);
    }

    if (resource === 'settings') {
      if (method === 'GET') {
        const row = await loadTenantSettings(admin, tenantId);
        return createCorsResponse(toTenantSettings(tenantId, row), 200, req);
      }
      if (method === 'PUT') return await putTenantSettings(req, admin, tenantId, user.id);
    }

    if (resource === 'machines' && second) {
      if (method === 'POST' && third === 'ship-now')
        return await shipNow(req, admin, tenantId, user.id, second);
      if (method === 'GET' && third === 'settings') {
        const row = await loadMachineSettings(admin, tenantId, second);
        if (!row)
          return createCorsResponse({ message: 'Failed to load machine settings' }, 500, req);
        return createCorsResponse(toMachineSettings(row), 200, req);
      }
      if (method === 'PUT' && third === 'settings')
        return await putMachineSettings(req, admin, tenantId, user.id, second);
    }

    return createCorsResponse({ message: 'Not found' }, 404, req);
  } catch (error) {
    console.error('toner-replenish error:', error);
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
      scope: 'toner-replenish',
      action,
      tenantId: ctx.tenantId,
      userId: ctx.userId ?? 'system',
      timestamp: new Date().toISOString(),
      ...(ctx.extra ? { extra: ctx.extra } : {}),
    }),
  );
}

// ---------------------------------------------------------------------------
// Settings (getOrCreate)
// ---------------------------------------------------------------------------

async function loadTenantSettings(admin: Admin, tenantId: string) {
  const { data: existing, error } = await admin
    .from('tenant_supply_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing;

  const { data: created, error: insertError } = await admin
    .from('tenant_supply_settings')
    .upsert({ tenant_id: tenantId }, { onConflict: 'tenant_id', ignoreDuplicates: true })
    .select()
    .maybeSingle();
  if (insertError) throw insertError;
  if (created) return created;

  const { data: reread } = await admin
    .from('tenant_supply_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return reread;
}

async function loadMachineSettings(admin: Admin, tenantId: string, machineId: string) {
  const { data: existing, error } = await admin
    .from('machine_supply_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('machine_id', machineId)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing;

  const { data: created, error: insertError } = await admin
    .from('machine_supply_settings')
    .upsert(
      { tenant_id: tenantId, machine_id: machineId },
      { onConflict: 'tenant_id,machine_id', ignoreDuplicates: true },
    )
    .select()
    .maybeSingle();
  if (insertError) throw insertError;
  if (created) return created;

  const { data: reread } = await admin
    .from('machine_supply_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('machine_id', machineId)
    .maybeSingle();
  return reread;
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

async function runCapture(admin: Admin, tenantId: string, machineId?: string) {
  let query = admin
    .from('equipment')
    .select('id, serial_number, model_number, manufacturer, customer_id, is_color_capable')
    .eq('tenant_id', tenantId);
  if (machineId) query = query.eq('id', machineId);

  const { data: machines, error } = await query;
  if (error) throw error;

  const now = Date.now();
  const capturedAt = new Date(now).toISOString();
  const rows: Array<Record<string, unknown>> = [];

  for (const machine of (machines ?? []) as MachineRow[]) {
    for (const level of fetchVendorSupplyLevels(machine, now)) {
      rows.push({
        tenant_id: tenantId,
        machine_id: machine.id,
        color: level.color,
        percent_remaining: level.percentRemaining,
        page_count_remaining: level.pageCountRemaining,
        // The marker that distinguishes a synthetic reading from a real vendor
        // one once it is in the table. Do not drop it.
        source: 'injected',
        captured_at: capturedAt,
      });
    }
  }

  if (rows.length > 0) {
    const { error: insertError } = await admin.from('machine_supply_levels').insert(rows);
    if (insertError) throw insertError;
  }

  return { machines: (machines ?? []).length, readings: rows.length };
}

async function runEvaluate(admin: Admin, tenantId: string, userId: string | undefined) {
  const tenant = await loadTenantSettings(admin, tenantId);
  const settings = toTenantSettings(tenantId, tenant);
  const approvalThreshold = settings.approvalCostThreshold;

  const now = Date.now();
  const since = new Date(now - FOURTEEN_DAYS_MS).toISOString();

  const { data: recent, error: readingError } = await admin
    .from('machine_supply_levels')
    .select('machine_id, color, percent_remaining, captured_at')
    .eq('tenant_id', tenantId)
    .gte('captured_at', since)
    .order('captured_at', { ascending: false });
  if (readingError) throw readingError;

  const byKey = groupReadings(recent ?? []);

  const { data: openOrders, error: orderError } = await admin
    .from('supply_orders')
    .select('machine_id, color')
    .eq('tenant_id', tenantId)
    .in('status', OPEN_ORDER_STATUSES);
  if (orderError) throw orderError;
  const openSet = new Set((openOrders ?? []).map((o) => orderKey(o.machine_id, o.color)));

  const machineSettingsCache = new Map<string, Record<string, unknown> | null>();
  const inserts: Array<Record<string, unknown>> = [];
  let evaluated = 0;

  for (const [key, readings] of Array.from(byKey.entries())) {
    evaluated++;
    const [machineId, color] = key.split('::');

    let machineSettings = machineSettingsCache.get(machineId);
    if (machineSettings === undefined) {
      machineSettings = await loadMachineSettings(admin, tenantId, machineId);
      machineSettingsCache.set(machineId, machineSettings);
    }
    if (isSuppressed(machineSettings)) continue;

    const predicted = predictDepletion(readings, now);
    if (!predicted) continue;

    const { lead, buffer } = windowDays(machineSettings, {
      lead: settings.defaultLeadTimeDays,
      buffer: settings.defaultSafetyBufferDays,
    });
    if (predicted.getTime() >= now + (lead + buffer) * DAY_MS) continue;

    if (openSet.has(key)) continue;

    const colorKey = colorKeyOf(color);
    const unitCost = TONER_UNIT_COST[colorKey];
    const totalCost = unitCost;

    inserts.push({
      tenant_id: tenantId,
      machine_id: machineId,
      color,
      status: orderStatusFor({
        totalCost,
        approvalThreshold,
        costCeiling:
          machineSettings?.cost_ceiling == null ? null : num(machineSettings.cost_ceiling),
      }),
      vendor: null,
      part_number: null,
      supply_name: supplyName(colorKey),
      quantity: 1,
      unit_cost: unitCost.toFixed(2),
      total_cost: totalCost.toFixed(2),
      predicted_depletion_date: predicted.toISOString(),
      trigger_reason: triggerReason(predicted, lead, buffer),
      is_emergency: false,
      created_by_user_id: userId ?? null,
    });
    // Guards against a second order for the same machine+color inside THIS run,
    // which the per-run openSet would otherwise miss.
    openSet.add(key);
  }

  if (inserts.length > 0) {
    const { error: insertError } = await admin.from('supply_orders').insert(inserts);
    if (insertError) throw insertError;
  }

  audit('EVALUATE', { tenantId, userId, extra: { evaluated, created: inserts.length } });
  return { evaluated, created: inserts.length };
}

async function capture(req: Request, admin: Admin, tenantId: string, userId: string) {
  const parsed = parseCapture(await safeJson(req));
  if (!parsed.ok) {
    return createCorsResponse({ message: 'Invalid input', errors: parsed.message }, 400, req);
  }
  const result = await runCapture(admin, tenantId, parsed.value.machineId);
  audit('CAPTURE', { tenantId, userId, extra: result });
  return createCorsResponse(result, 200, req);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

async function listLevels(admin: Admin, tenantId: string, url: URL, req: Request) {
  const machineId = url.searchParams.get('machineId');

  // Express used SELECT DISTINCT ON (machine_id, color), which PostgREST cannot
  // express — so the rows come back newest-first and latestPerMachineColor keeps
  // the first per key. The descending sort is load-bearing: reversed, the
  // dashboard would show each machine's OLDEST toner level.
  let query = admin
    .from('machine_supply_levels')
    .select('id, machine_id, color, percent_remaining, page_count_remaining, source, captured_at')
    .eq('tenant_id', tenantId)
    .order('captured_at', { ascending: false })
    .limit(5000);
  if (machineId) query = query.eq('machine_id', machineId);

  const { data: rows, error } = await query;
  if (error) throw error;

  const latest = latestPerMachineColor(rows ?? []);
  const machineIds = Array.from(new Set(latest.map((r) => r.machine_id).filter(Boolean)));

  const [machines, orders] = await Promise.all([
    machineIds.length
      ? admin
          .from('equipment')
          .select('id, serial_number, model_number, manufacturer, is_color_capable, customer_id')
          .eq('tenant_id', tenantId)
          .in('id', machineIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null }),
    admin
      .from('supply_orders')
      .select('machine_id, color, predicted_depletion_date')
      .eq('tenant_id', tenantId)
      .in('status', ['pending_approval', 'auto_ship', 'shipped'])
      .order('created_at', { ascending: false }),
  ]);
  if (machines.error) throw machines.error;
  if (orders.error) throw orders.error;

  const machineMap = new Map(
    (machines.data ?? []).map((m: Record<string, unknown>) => [m.id as string, m]),
  );

  const customerIds = Array.from(
    new Set(
      (machines.data ?? [])
        .map((m: Record<string, unknown>) => m.customer_id as string)
        .filter(Boolean),
    ),
  );
  const companyNames = new Map<string, string | null>();
  if (customerIds.length > 0) {
    const { data: customers, error: customerError } = await admin
      .from('business_records')
      .select('id, company_name')
      .eq('tenant_id', tenantId)
      .in('id', customerIds);
    if (customerError) throw customerError;
    for (const c of customers ?? []) {
      companyNames.set(c.id as string, (c.company_name as string) ?? null);
    }
  }

  // Newest order per machine+color wins the predicted date.
  const predictedMap = new Map<string, string | null>();
  for (const o of orders.data ?? []) {
    const key = orderKey(o.machine_id, o.color);
    if (!predictedMap.has(key)) {
      predictedMap.set(key, (o.predicted_depletion_date as string) ?? null);
    }
  }

  const data = latest.map((row) => {
    const machine = machineMap.get(row.machine_id);
    const customerId = machine?.customer_id as string | undefined;
    return toLevel(
      row,
      machine,
      customerId ? (companyNames.get(customerId) ?? null) : null,
      predictedMap.get(orderKey(row.machine_id, row.color)) ?? null,
    );
  });

  return createCorsResponse({ data, total: data.length }, 200, req);
}

async function listOrders(admin: Admin, tenantId: string, url: URL, req: Request) {
  let query = admin
    .from('supply_orders')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(500);

  const status = parseOrderStatusFilter(url.searchParams.get('status'));
  if (status) query = query.eq('status', status);

  const { data: rows, error } = await query;
  if (error) throw error;

  const machineIds = Array.from(
    new Set((rows ?? []).map((r) => r.machine_id as string).filter(Boolean)),
  );
  const machineMap = new Map<string, Record<string, unknown>>();
  if (machineIds.length > 0) {
    const { data: machines, error: machineError } = await admin
      .from('equipment')
      .select('id, serial_number, model_number')
      .eq('tenant_id', tenantId)
      .in('id', machineIds);
    if (machineError) throw machineError;
    for (const m of machines ?? []) machineMap.set(m.id as string, m);
  }

  const data = (rows ?? []).map((row) => {
    const machine = machineMap.get(row.machine_id as string);
    return {
      ...toOrder(row),
      serialNumber: (machine?.serial_number as string) ?? null,
      modelNumber: (machine?.model_number as string) ?? null,
    };
  });

  return createCorsResponse({ data, total: data.length }, 200, req);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

async function shipOrder(admin: Admin, tenantId: string, userId: string, id: string, req: Request) {
  const { data: order, error } = await admin
    .from('supply_orders')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!order) return createCorsResponse({ message: 'Order not found' }, 404, req);

  const tenant = toTenantSettings(tenantId, await loadTenantSettings(admin, tenantId));
  const machineSettings = await loadMachineSettings(admin, tenantId, order.machine_id as string);
  const lead =
    machineSettings?.lead_time_days == null
      ? (tenant.defaultLeadTimeDays ?? DEFAULT_LEAD_TIME_DAYS)
      : num(machineSettings.lead_time_days);

  const now = new Date();
  const expectedArrivalDate = new Date(now.getTime() + lead * DAY_MS);
  const trackingNumber = `TRK-${now.getTime()}`; // STUB — no carrier integration.

  const { data: row, error: updateError } = await admin
    .from('supply_orders')
    .update({
      status: 'shipped',
      tracking_number: trackingNumber,
      carrier: 'UPS',
      shipped_at: now.toISOString(),
      expected_arrival_date: expectedArrivalDate.toISOString(),
      customer_notified: true,
      updated_at: now.toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .maybeSingle();
  if (updateError) throw updateError;

  await notifyCustomerShipped(admin, tenantId, order.machine_id as string, {
    supplyName: (order.supply_name as string) ?? null,
    trackingNumber,
    expectedArrivalDate,
  });

  audit('SHIP', { tenantId, userId, extra: { id, trackingNumber } });
  return createCorsResponse(row ? toOrder(row) : null, 200, req);
}

async function cancelOrder(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  const { data: row, error } = await admin
    .from('supply_orders')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!row) return createCorsResponse({ message: 'Order not found' }, 404, req);

  audit('CANCEL', { tenantId, userId, extra: { id } });
  return createCorsResponse(toOrder(row), 200, req);
}

/**
 * Emergency manual order: create it ALREADY shipped, bypassing both the cost
 * gate and the suppressions. That is the point of the button — a machine is
 * down now — so it is a deliberate override rather than a hole, and the row is
 * marked is_emergency so it is distinguishable from pipeline orders after the
 * fact.
 */
async function shipNow(
  req: Request,
  admin: Admin,
  tenantId: string,
  userId: string,
  machineId: string,
) {
  const parsed = parseShipNow(await safeJson(req));
  if (!parsed.ok) {
    return createCorsResponse({ message: 'Invalid input', errors: parsed.message }, 400, req);
  }

  const { data: machine, error } = await admin
    .from('equipment')
    .select('id, is_color_capable')
    .eq('id', machineId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!machine) return createCorsResponse({ message: 'Machine not found' }, 404, req);

  const colorKey = parsed.value.color;
  const unitCost = TONER_UNIT_COST[colorKey];
  const now = new Date();

  const tenant = toTenantSettings(tenantId, await loadTenantSettings(admin, tenantId));
  const machineSettings = await loadMachineSettings(admin, tenantId, machineId);
  const lead =
    machineSettings?.lead_time_days == null
      ? (tenant.defaultLeadTimeDays ?? DEFAULT_LEAD_TIME_DAYS)
      : num(machineSettings.lead_time_days);
  const expectedArrivalDate = new Date(now.getTime() + lead * DAY_MS);
  const trackingNumber = `TRK-${now.getTime()}`; // STUB

  const { data: row, error: insertError } = await admin
    .from('supply_orders')
    .insert({
      tenant_id: tenantId,
      machine_id: machineId,
      color: colorKey,
      status: 'shipped',
      supply_name: supplyName(colorKey),
      quantity: 1,
      unit_cost: unitCost.toFixed(2),
      total_cost: unitCost.toFixed(2),
      trigger_reason: 'Emergency manual ship-now.',
      is_emergency: true,
      tracking_number: trackingNumber,
      carrier: 'UPS',
      shipped_at: now.toISOString(),
      expected_arrival_date: expectedArrivalDate.toISOString(),
      customer_notified: true,
      created_by_user_id: userId ?? null,
    })
    .select()
    .single();
  if (insertError) throw insertError;

  await notifyCustomerShipped(admin, tenantId, machineId, {
    supplyName: (row?.supply_name as string) ?? null,
    trackingNumber,
    expectedArrivalDate,
  });

  audit('EMERGENCY_SHIP', { tenantId, userId, extra: { machineId, color: colorKey } });
  return createCorsResponse(toOrder(row), 201, req);
}

async function putTenantSettings(req: Request, admin: Admin, tenantId: string, userId: string) {
  const parsed = parseTenantSettings(await safeJson(req));
  if (!parsed.ok) {
    return createCorsResponse({ message: 'Invalid input', errors: parsed.message }, 400, req);
  }
  await loadTenantSettings(admin, tenantId);

  const updates: Record<string, unknown> = {
    updated_by_user_id: userId,
    updated_at: new Date().toISOString(),
  };
  if (parsed.value.approvalCostThreshold !== undefined)
    updates.approval_cost_threshold = parsed.value.approvalCostThreshold;
  if (parsed.value.defaultLeadTimeDays !== undefined)
    updates.default_lead_time_days = parsed.value.defaultLeadTimeDays;
  if (parsed.value.defaultSafetyBufferDays !== undefined)
    updates.default_safety_buffer_days = parsed.value.defaultSafetyBufferDays;

  const { data: updated, error } = await admin
    .from('tenant_supply_settings')
    .update(updates)
    .eq('tenant_id', tenantId)
    .select()
    .maybeSingle();
  if (error) throw error;

  audit('UPDATE_SETTINGS', { tenantId, userId, extra: parsed.value });
  return createCorsResponse(toTenantSettings(tenantId, updated), 200, req);
}

async function putMachineSettings(
  req: Request,
  admin: Admin,
  tenantId: string,
  userId: string,
  machineId: string,
) {
  const parsed = parseMachineSettings(await safeJson(req));
  if (!parsed.ok) {
    return createCorsResponse({ message: 'Invalid input', errors: parsed.message }, 400, req);
  }
  const input = parsed.value;
  const now = new Date().toISOString();

  const values: Record<string, unknown> = {
    tenant_id: tenantId,
    machine_id: machineId,
    updated_by_user_id: userId,
    updated_at: now,
  };
  // Only keys the caller actually sent are written; `null` is a real value here
  // (clear the override), which is why the check is `!== undefined`.
  if (input.autoShipEnabled !== undefined) values.auto_ship_enabled = input.autoShipEnabled;
  if (input.costCeiling !== undefined) values.cost_ceiling = input.costCeiling;
  if (input.emergencyOverride !== undefined) values.emergency_override = input.emergencyOverride;
  if (input.customerManaged !== undefined) values.customer_managed = input.customerManaged;
  if (input.leadTimeDays !== undefined) values.lead_time_days = input.leadTimeDays;
  if (input.safetyBufferDays !== undefined) values.safety_buffer_days = input.safetyBufferDays;

  const { data: row, error } = await admin
    .from('machine_supply_settings')
    .upsert(values, { onConflict: 'tenant_id,machine_id' })
    .select()
    .single();
  if (error) throw error;

  audit('UPDATE_MACHINE_SETTINGS', { tenantId, userId, extra: { machineId, ...input } });
  return createCorsResponse(toMachineSettings(row), 200, req);
}

/**
 * Best-effort customer notification. Wrapped so a mail failure cannot roll back
 * a shipment that has already been recorded — the toner is on its way either
 * way, and losing the order row over an SMTP hiccup would be worse than a
 * missing email.
 */
async function notifyCustomerShipped(
  admin: Admin,
  tenantId: string,
  machineId: string,
  order: {
    supplyName: string | null;
    trackingNumber: string | null;
    expectedArrivalDate: Date | null;
  },
) {
  try {
    const { data: machine } = await admin
      .from('equipment')
      .select('customer_id, serial_number, model_number')
      .eq('id', machineId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!machine?.customer_id) return;

    const { data: customer } = await admin
      .from('business_records')
      .select('primary_contact_email, company_name')
      .eq('id', machine.customer_id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const to = customer?.primary_contact_email as string | undefined;
    if (!to) return;

    const eta = order.expectedArrivalDate
      ? order.expectedArrivalDate.toISOString().slice(0, 10)
      : 'soon';
    const device = machine.serial_number ?? machine.model_number ?? 'your device';
    const supply = order.supplyName ?? 'toner';
    const tracking = order.trackingNumber ?? 'pending';

    await sendEmail({
      to,
      from: Deno.env.get('TONER_REPLENISH_FROM_EMAIL') ?? 'noreply@printyx.net',
      subject: `Toner shipment on the way for ${device}`,
      html: `<p>Hi ${customer?.company_name ?? 'there'},</p><p>A ${supply} cartridge is shipping to you (tracking ${tracking}). Expected arrival: ${eta}.</p>`,
      text: `A ${supply} cartridge is shipping to you (tracking ${tracking}). Expected arrival: ${eta}.`,
    });
  } catch (err) {
    console.warn('customer ship notification failed (best-effort):', err);
  }
}

async function safeJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
