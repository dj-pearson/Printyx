/**
 * Service edge function (PROD-011) — port of the two Express routers that share
 * the /api/service prefix: server/routes-service-knowledge.ts (the RAG search
 * over historical tickets, US-SUPER-006) and server/routes-proactive-maintenance.ts.
 *
 * WHY: both were Express-only, so KnowledgeSearch.tsx and
 * ProactiveServiceDashboard.tsx worked in dev and hard-404'd in production,
 * where getApiUrl() rewrites /api/service -> functions.printyx.net/service with
 * no Express fallback.
 *
 * ROUTES — all EIGHT endpoints across both routers:
 *   POST /knowledge-search                  RAG search (top-N historical fixes)
 *   POST /knowledge-search/backfill         embed the last 24mo of closed tickets
 *   POST /knowledge-search/embed/:ticketId  embed one ticket on demand
 *   GET  /knowledge-search/stats            coverage indicator
 *   GET  /knowledge-search/settings         federation opt-in (v2 flag)
 *   PUT  /knowledge-search/settings
 *   GET  /proactive-maintenance             equipment health + urgency buckets
 *   POST /proactive-maintenance/:equipmentId/schedule   open a PM ticket
 *
 * All eight ship together because proxying forwards the whole prefix and falls
 * through only on a network error, never a 404 — a partial port would take the
 * unported ones from working-in-dev to 404-in-dev.
 *
 * THE EMBEDDING FALLBACK IS LOAD-BEARING. _shared/openai.ts returns null with no
 * OPENAI_API_KEY, and returning that straight through would make every search
 * come back empty. The Express deterministic hash embedding is carried over
 * byte-for-byte (knowledge.ts hashCode/fallbackEmbedding) so that (a) search
 * still works keyless and (b) vectors already stored by the Express fallback
 * stay comparable to ones produced here. Changing that hash silently breaks
 * every stored fallback embedding.
 *
 * GET /proactive-maintenance IS A REPAIR, NOT A TRANSCRIPTION: the Express
 * version selects columns that do not exist and has always 500'd. See
 * maintenance.ts for what was fixed and what was deliberately dropped.
 *
 * v1 is SINGLE-TENANT: every query filters by tenant_id, and the federated
 * cross-tenant pool stays a flag with no read path behind it.
 */

import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { createEmbedding } from '../_shared/openai.ts';
import {
  CLOSED_STATUSES,
  CONTENT_MAX,
  SUMMARY_MAX,
  TWENTY_FOUR_MONTHS_MS,
  buildQueryText,
  buildTicketContent,
  computeModelProxies,
  extractErrorCodes,
  fallbackEmbedding,
  parseBackfillLimit,
  parseSearchInput,
  rankBySimilarity,
  roundRelevance,
  shapeSettings,
  truncate,
  type ModelProxies,
  type TicketLike,
} from './knowledge.ts';
import {
  buildMaintenanceItem,
  proactiveTicketNumber,
  summarize,
  type EquipmentRow,
} from './maintenance.ts';

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
    const { parts } = normalizePath(url.pathname, 'service');
    const [resource, second, third] = parts;
    const method = req.method.toUpperCase();

    if (resource === 'knowledge-search') {
      if (method === 'POST' && !second) return await search(req, admin, tenantId, user.id);
      if (method === 'POST' && second === 'backfill')
        return await backfill(req, admin, tenantId, user.id, url);
      if (method === 'POST' && second === 'embed' && third)
        return await embedOne(req, admin, tenantId, user.id, third);
      if (method === 'GET' && second === 'stats') return await stats(admin, tenantId, req);
      if (method === 'GET' && second === 'settings') return await getSettings(admin, tenantId, req);
      if (method === 'PUT' && second === 'settings')
        return await putSettings(req, admin, tenantId, user.id);
    }

    if (resource === 'proactive-maintenance') {
      if (method === 'GET' && !second) return await maintenanceList(admin, tenantId, req);
      if (method === 'POST' && second && third === 'schedule')
        return await scheduleMaintenance(req, admin, tenantId, user.id, second);
    }

    return createCorsResponse({ message: 'Not found' }, 404, req);
  } catch (error) {
    console.error('service error:', error);
    return createCorsResponse(
      { message: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}

// ---------------------------------------------------------------------------
// Embedding adapter
// ---------------------------------------------------------------------------

/**
 * Embed text, degrading to the deterministic local vector on ANY failure —
 * missing key, rate limit, network, bad shape. The caller is told which was used
 * via `source`, because an 'openai' vector and a 'fallback' vector are NOT
 * comparable to each other and a tenant mid-migration between the two will see
 * degraded relevance.
 */
async function embedText(text: string): Promise<{ embedding: number[]; source: string }> {
  const input = (text ?? '').slice(0, CONTENT_MAX);
  try {
    const vec = await createEmbedding(input);
    if (Array.isArray(vec) && vec.length > 0 && vec.every((n) => Number.isFinite(n))) {
      return { embedding: vec, source: 'openai' };
    }
  } catch (err) {
    console.warn('openai embedding failed; using deterministic fallback:', err);
  }
  return { embedding: fallbackEmbedding(input), source: 'fallback' };
}

/** SHA-256 hex. Web Crypto, so unlike the Express node:crypto version it is async. */
async function sha256(s: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function audit(action: string, ctx: { tenantId: string; userId?: string; extra?: unknown }) {
  console.log(
    JSON.stringify({
      audit: true,
      scope: 'service-knowledge',
      action,
      tenantId: ctx.tenantId,
      userId: ctx.userId ?? 'system',
      timestamp: new Date().toISOString(),
      ...(ctx.extra ? { extra: ctx.extra } : {}),
    }),
  );
}

// ---------------------------------------------------------------------------
// knowledge-search
// ---------------------------------------------------------------------------

async function search(req: Request, admin: Admin, tenantId: string, userId: string) {
  const parsed = parseSearchInput(await safeJson(req));
  if (!parsed.ok) {
    return createCorsResponse({ message: 'Invalid input', errors: parsed.message }, 400, req);
  }
  const input = parsed.value;

  const { embedding: queryEmbedding, source: embeddingSource } = await embedText(
    buildQueryText(input),
  );

  let query = admin
    .from('service_ticket_embeddings')
    .select('ticket_id, machine_model, embedding')
    .eq('tenant_id', tenantId);
  if (input.machine_model) {
    query = query.ilike('machine_model', `%${input.machine_model}%`);
  }
  const { data: embRows, error: embError } = await query;
  if (embError) throw embError;

  const scored = rankBySimilarity(embRows ?? [], queryEmbedding, input.limit);

  if (scored.length === 0) {
    audit('SEARCH', { tenantId, userId, extra: { results: 0 } });
    return createCorsResponse({ results: [], total: 0, embeddingSource }, 200, req);
  }

  const { data: ticketRows, error: ticketError } = await admin
    .from('service_tickets')
    .select('id, ticket_number, title, resolution_notes, parts_used')
    .eq('tenant_id', tenantId)
    .in(
      'id',
      scored.map((s) => s.ticketId),
    );
  if (ticketError) throw ticketError;
  const ticketMap = new Map((ticketRows ?? []).map((t: Record<string, unknown>) => [t.id, t]));

  // One proxy computation per distinct model in the result set, not per hit.
  const distinctModels = Array.from(
    new Set(scored.map((s) => s.machineModel).filter((m): m is string => Boolean(m))),
  );
  const modelProxies = new Map<string, ModelProxies>();
  for (const model of distinctModels) {
    modelProxies.set(model, await proxiesForModel(admin, tenantId, model));
  }

  const results = scored.map((s) => {
    const t = ticketMap.get(s.ticketId) as Record<string, unknown> | undefined;
    const proxies = s.machineModel ? modelProxies.get(s.machineModel) : undefined;
    return {
      ticketId: s.ticketId,
      ticketNumber: (t?.ticket_number as string) ?? null,
      machineModel: s.machineModel,
      relevanceScore: roundRelevance(s.score),
      summary: truncate((t?.resolution_notes as string) || (t?.title as string) || '', SUMMARY_MAX),
      partsSwapped: Array.isArray(t?.parts_used) ? t.parts_used : [],
      meanResolutionTimeHours: proxies?.meanResolutionTimeHours ?? null,
      fixSuccessRate: proxies?.fixSuccessRate ?? null,
    };
  });

  audit('SEARCH', { tenantId, userId, extra: { results: results.length, embeddingSource } });
  return createCorsResponse({ results, total: results.length, embeddingSource }, 200, req);
}

/**
 * service_tickets has no model column, so the model's tickets are reached
 * through equipment.model_number. PostgREST cannot express the Express INNER
 * JOIN, so this is two queries: the tenant's equipment ids for that model, then
 * their tickets. Equivalent, and it short-circuits when the model has no
 * equipment at all.
 */
async function proxiesForModel(
  admin: Admin,
  tenantId: string,
  model: string,
): Promise<ModelProxies> {
  const { data: equipRows, error: equipError } = await admin
    .from('equipment')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('model_number', model);
  if (equipError) throw equipError;

  const ids = (equipRows ?? []).map((e: { id: string }) => e.id);
  if (ids.length === 0) return { meanResolutionTimeHours: null, fixSuccessRate: null };

  const { data: ticketRows, error: ticketError } = await admin
    .from('service_tickets')
    .select('status, created_at, resolved_at')
    .eq('tenant_id', tenantId)
    .in('equipment_id', ids);
  if (ticketError) throw ticketError;

  return computeModelProxies(ticketRows ?? []);
}

async function backfill(req: Request, admin: Admin, tenantId: string, userId: string, url: URL) {
  const limit = parseBackfillLimit(url.searchParams.get('limit'));
  const since = new Date(Date.now() - TWENTY_FOUR_MONTHS_MS).toISOString();

  const { data: tickets, error } = await admin
    .from('service_tickets')
    .select('id, title, description, resolution_notes, parts_used, equipment_id')
    .eq('tenant_id', tenantId)
    .in('status', CLOSED_STATUSES as readonly string[])
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  const rows = tickets ?? [];
  const modelMap = await resolveMachineModels(
    admin,
    tenantId,
    rows.map((t: Record<string, unknown>) => t.equipment_id as string).filter(Boolean),
  );

  let embedded = 0;
  let skipped = 0;
  for (const ticket of rows) {
    const outcome = await embedTicket(admin, tenantId, ticket, modelMap);
    if (outcome === 'embedded') embedded++;
    else skipped++;
  }

  audit('BACKFILL', {
    tenantId,
    userId,
    extra: { scanned: rows.length, embedded, skipped, limit },
  });
  return createCorsResponse({ embedded, skipped, scanned: rows.length }, 200, req);
}

async function embedOne(
  req: Request,
  admin: Admin,
  tenantId: string,
  userId: string,
  ticketId: string,
) {
  const { data: ticket, error } = await admin
    .from('service_tickets')
    .select('id, title, description, resolution_notes, parts_used, equipment_id')
    .eq('id', ticketId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!ticket) return createCorsResponse({ message: 'Ticket not found' }, 404, req);

  const outcome = await embedTicket(admin, tenantId, ticket);
  audit('EMBED_ONE', { tenantId, userId, extra: { ticketId: ticket.id, outcome } });
  return createCorsResponse({ ticketId: ticket.id, outcome }, 200, req);
}

/** equipment_id -> model_number for the given ids (tenant-scoped). */
async function resolveMachineModels(
  admin: Admin,
  tenantId: string,
  equipmentIds: string[],
): Promise<Map<string, string | null>> {
  const ids = Array.from(new Set(equipmentIds.filter(Boolean)));
  if (ids.length === 0) return new Map();

  const { data, error } = await admin
    .from('equipment')
    .select('id, model_number')
    .eq('tenant_id', tenantId)
    .in('id', ids);
  if (error) throw error;

  return new Map(
    (data ?? []).map((r: { id: string; model_number: string | null }) => [
      r.id,
      r.model_number ?? null,
    ]),
  );
}

/**
 * Embed (or re-embed) one ticket; UPSERT on (tenant_id, ticket_id).
 *
 * The content hash short-circuit is what makes the cron backfill cheap: an
 * unchanged ticket costs one SELECT instead of an embedding API call.
 */
async function embedTicket(
  admin: Admin,
  tenantId: string,
  ticket: Record<string, unknown>,
  modelMap?: Map<string, string | null>,
): Promise<'embedded' | 'skipped'> {
  const equipmentId = ticket.equipment_id as string | null;
  let machineModel: string | null = null;
  if (equipmentId) {
    const map = modelMap ?? (await resolveMachineModels(admin, tenantId, [equipmentId]));
    machineModel = map.get(equipmentId) ?? null;
  }

  const content = buildTicketContent(ticket as TicketLike, machineModel);
  const contentHash = await sha256(content);

  const { data: existing, error: existingError } = await admin
    .from('service_ticket_embeddings')
    .select('content_hash')
    .eq('tenant_id', tenantId)
    .eq('ticket_id', ticket.id as string)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing && existing.content_hash === contentHash) return 'skipped';

  const { embedding, source } = await embedText(content);
  const errorCodes = extractErrorCodes(ticket as TicketLike).slice(0, 500) || null;
  const now = new Date().toISOString();

  const { error: upsertError } = await admin.from('service_ticket_embeddings').upsert(
    {
      tenant_id: tenantId,
      ticket_id: ticket.id as string,
      machine_model: machineModel,
      error_codes: errorCodes,
      content: content.slice(0, CONTENT_MAX),
      content_hash: contentHash,
      embedding,
      embedding_source: source,
      embedded_at: now,
      updated_at: now,
    },
    { onConflict: 'tenant_id,ticket_id' },
  );
  if (upsertError) throw upsertError;

  return 'embedded';
}

async function stats(admin: Admin, tenantId: string, req: Request) {
  const [embeddedCount, closedCount, latest] = await Promise.all([
    admin
      .from('service_ticket_embeddings')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
    admin
      .from('service_tickets')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('status', CLOSED_STATUSES as readonly string[]),
    admin
      .from('service_ticket_embeddings')
      .select('embedded_at')
      .eq('tenant_id', tenantId)
      .order('embedded_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return createCorsResponse(
    {
      embeddedCount: embeddedCount.count ?? 0,
      lastEmbeddedAt: latest.data?.embedded_at ?? null,
      totalClosedTickets: closedCount.count ?? 0,
    },
    200,
    req,
  );
}

/** Read the settings row, creating the default one on first access. */
async function loadSettings(admin: Admin, tenantId: string) {
  const { data: existing, error } = await admin
    .from('service_knowledge_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing;

  const { data: created, error: insertError } = await admin
    .from('service_knowledge_settings')
    .upsert({ tenant_id: tenantId }, { onConflict: 'tenant_id', ignoreDuplicates: true })
    .select()
    .maybeSingle();
  if (insertError) throw insertError;
  if (created) return created;

  // ignoreDuplicates returns nothing when a concurrent call won the race.
  const { data: reread } = await admin
    .from('service_knowledge_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return reread;
}

async function getSettings(admin: Admin, tenantId: string, req: Request) {
  const settings = await loadSettings(admin, tenantId);
  if (!settings) return createCorsResponse({ message: 'Failed to load settings' }, 500, req);
  return createCorsResponse(shapeSettings(tenantId, settings), 200, req);
}

async function putSettings(req: Request, admin: Admin, tenantId: string, userId: string) {
  const body = await safeJson(req);
  const federatedOptIn = body.federatedOptIn;
  if (federatedOptIn !== undefined && typeof federatedOptIn !== 'boolean') {
    return createCorsResponse(
      { message: 'Invalid input', errors: 'federatedOptIn must be a boolean' },
      400,
      req,
    );
  }

  await loadSettings(admin, tenantId);

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (userId) updates.updated_by_user_id = userId;
  if (federatedOptIn !== undefined) {
    updates.federated_opt_in = {
      enabled: federatedOptIn,
      consentedAt: new Date().toISOString(),
      consentedByUserId: userId ?? null,
    };
  }

  const { data: updated, error } = await admin
    .from('service_knowledge_settings')
    .update(updates)
    .eq('tenant_id', tenantId)
    .select()
    .maybeSingle();
  if (error) throw error;

  audit('UPDATE_SETTINGS', { tenantId, userId, extra: { federatedOptIn } });
  return createCorsResponse(shapeSettings(tenantId, updated), 200, req);
}

// ---------------------------------------------------------------------------
// proactive-maintenance
// ---------------------------------------------------------------------------

async function maintenanceList(admin: Admin, tenantId: string, req: Request) {
  const { data: equipRows, error } = await admin
    .from('equipment')
    .select(
      'id, serial_number, manufacturer, model_number, customer_id, location_description, last_service_date, next_service_due_date, install_date, equipment_status',
    )
    .eq('tenant_id', tenantId)
    // equipment_status, not status — naming the latter is what made the Express
    // query throw. 'active' is matched case-insensitively because the column is
    // free-text varchar with no enum behind it.
    .ilike('equipment_status', 'active')
    .order('next_service_due_date', { ascending: true });
  if (error) throw error;

  const rows = (equipRows ?? []) as EquipmentRow[];
  const customerNames = await resolveCustomerNames(
    admin,
    tenantId,
    rows.map((r) => r.customer_id).filter((id): id is string => Boolean(id)),
  );

  const now = Date.now();
  const items = rows.map((row) =>
    buildMaintenanceItem(
      row,
      row.customer_id ? (customerNames.get(row.customer_id) ?? null) : null,
      now,
    ),
  );

  return createCorsResponse(
    { success: true, summary: summarize(items), equipment: items },
    200,
    req,
  );
}

async function resolveCustomerNames(
  admin: Admin,
  tenantId: string,
  customerIds: string[],
): Promise<Map<string, string | null>> {
  const ids = Array.from(new Set(customerIds));
  if (ids.length === 0) return new Map();

  const { data, error } = await admin
    .from('business_records')
    .select('id, company_name')
    .eq('tenant_id', tenantId)
    .in('id', ids);
  if (error) throw error;

  return new Map(
    (data ?? []).map((r: { id: string; company_name: string | null }) => [
      r.id,
      r.company_name ?? null,
    ]),
  );
}

async function scheduleMaintenance(
  req: Request,
  admin: Admin,
  tenantId: string,
  userId: string,
  equipmentId: string,
) {
  const body = await safeJson(req);

  const { data: equipmentItem, error } = await admin
    .from('equipment')
    .select('id, customer_id, serial_number, manufacturer, model_number, location_description')
    .eq('id', equipmentId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!equipmentItem) return createCorsResponse({ message: 'Equipment not found' }, 404, req);

  const scheduledDate = typeof body.scheduledDate === 'string' ? body.scheduledDate : null;
  const priority = typeof body.priority === 'string' ? body.priority : 'medium';
  const notes = typeof body.notes === 'string' ? body.notes : null;

  const insert: Record<string, unknown> = {
    tenant_id: tenantId,
    customer_id: equipmentItem.customer_id,
    equipment_id: equipmentItem.id,
    ticket_number: proactiveTicketNumber(Date.now()),
    title:
      `Proactive Maintenance - ${equipmentItem.manufacturer ?? ''} ${equipmentItem.model_number ?? ''}`.trim(),
    description: notes || `Scheduled preventive maintenance for ${equipmentItem.serial_number}`,
    priority,
    status: 'pending',
    customer_address: equipmentItem.location_description,
    created_by: userId || 'system',
  };
  if (scheduledDate) insert.scheduled_date = scheduledDate;

  const { data: ticket, error: insertError } = await admin
    .from('service_tickets')
    .insert(insert)
    .select('id, ticket_number, scheduled_date')
    .single();
  if (insertError) throw insertError;

  return createCorsResponse(
    {
      success: true,
      message: 'Proactive service scheduled successfully',
      ticket: {
        id: ticket.id,
        ticketNumber: ticket.ticket_number,
        scheduledDate: ticket.scheduled_date,
      },
    },
    200,
    req,
  );
}

async function safeJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
