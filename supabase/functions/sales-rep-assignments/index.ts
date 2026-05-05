// Sales Rep Assignments Edge Function
// Replaces server/routes-sales-rep-assignments.ts (623 lines, 9 endpoints).
//
// URL layout:
//   GET  /sales-rep-assignments/reps                    — list reps with account counts + summary
//   GET  /sales-rep-assignments/reps/:repId/accounts    — paginated accounts for one rep
//   GET  /sales-rep-assignments/accounts                — all accounts with filters
//   GET  /sales-rep-assignments/unassigned              — paginated unassigned accounts
//   GET  /sales-rep-assignments/zip-summary             — zip code histogram
//   GET  /sales-rep-assignments/history                 — paginated assignment history (enriched)
//   POST /sales-rep-assignments/assign                  — assign one account to a rep
//   POST /sales-rep-assignments/bulk-assign             — assign many accounts to a rep
//   POST /sales-rep-assignments/assign-by-area          — assign by zip/state/city (?preview=true supported)
//
// Tables: business_records (.owner_id, .assigned_sales_rep), lead_assignment_history,
// sales_territories (joined for /reps territories).
//
// All write paths log to lead_assignment_history with the appropriate
// assignment_reason ('manual_override' | 'bulk_reassignment' | 'territory_change').

import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

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
    const { parts } = normalizePath(url.pathname, 'sales-rep-assignments');
    const endpoint = parts[0];
    const param = parts[1];
    const sub = parts[2];

    // ─── GET /reps ───────────────────────────────────────────────────────────
    if (req.method === 'GET' && endpoint === 'reps' && !param) {
      return await listRepsWithCounts(admin, tenantId, req);
    }

    // ─── GET /reps/:repId/accounts ───────────────────────────────────────────
    if (req.method === 'GET' && endpoint === 'reps' && param && sub === 'accounts') {
      return await accountsForRep(admin, tenantId, url, param, req);
    }

    // ─── GET /accounts ───────────────────────────────────────────────────────
    if (req.method === 'GET' && endpoint === 'accounts') {
      return await listAccountsWithFilters(admin, tenantId, url, req);
    }

    // ─── GET /unassigned ─────────────────────────────────────────────────────
    if (req.method === 'GET' && endpoint === 'unassigned') {
      return await listUnassigned(admin, tenantId, url, req);
    }

    // ─── GET /zip-summary ────────────────────────────────────────────────────
    if (req.method === 'GET' && endpoint === 'zip-summary') {
      return await zipSummary(admin, tenantId, req);
    }

    // ─── GET /history ────────────────────────────────────────────────────────
    if (req.method === 'GET' && endpoint === 'history') {
      return await assignmentHistory(admin, tenantId, url, req);
    }

    // ─── POST /assign ────────────────────────────────────────────────────────
    if (req.method === 'POST' && endpoint === 'assign') {
      return await assignOne(admin, tenantId, user.id, req);
    }

    // ─── POST /bulk-assign ───────────────────────────────────────────────────
    if (req.method === 'POST' && endpoint === 'bulk-assign') {
      return await bulkAssign(admin, tenantId, user.id, req);
    }

    // ─── POST /assign-by-area ────────────────────────────────────────────────
    if (req.method === 'POST' && endpoint === 'assign-by-area') {
      return await assignByArea(admin, tenantId, user.id, url, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in sales-rep-assignments function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}

// ─── handlers ───────────────────────────────────────────────────────────────

async function listRepsWithCounts(admin: Admin, tenantId: string, req: Request): Promise<Response> {
  const { data: usersList, error: usersErr } = await admin
    .from('users')
    .select('id, email, first_name, last_name, role, team_id, profile_image_url')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  if (usersErr) {
    return createCorsResponse({ error: 'Failed to fetch users' }, 500, req);
  }

  // Account counts per owner. Supabase JS doesn't have GROUP BY in select(), so
  // pull the owner_id column and aggregate in JS — bounded by tenant rows.
  const { data: ownerRows } = await admin
    .from('business_records')
    .select('owner_id')
    .eq('tenant_id', tenantId)
    .not('owner_id', 'is', null);

  const countMap = new Map<string, number>();
  let assignedTotal = 0;
  for (const r of (ownerRows ?? []) as Array<{ owner_id: string | null }>) {
    if (!r.owner_id) continue;
    countMap.set(r.owner_id, (countMap.get(r.owner_id) ?? 0) + 1);
    assignedTotal++;
  }

  // Unassigned count
  const { count: unassignedCount } = await admin
    .from('business_records')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .is('owner_id', null);

  // Territories per rep
  const { data: territories } = await admin
    .from('sales_territories')
    .select('id, territory_name, owner_id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  const territoryMap = new Map<string, Array<{ id: string; name: string }>>();
  for (const t of (territories ?? []) as Array<Record<string, unknown>>) {
    const oid = t.owner_id as string | null;
    if (!oid) continue;
    const existing = territoryMap.get(oid) ?? [];
    existing.push({ id: t.id as string, name: t.territory_name as string });
    territoryMap.set(oid, existing);
  }

  const reps = (usersList ?? []).map((u: any) => {
    const id = u.id as string;
    return {
      id,
      email: u.email,
      firstName: u.first_name,
      lastName: u.last_name,
      role: u.role,
      teamId: u.team_id,
      profileImageUrl: u.profile_image_url,
      accountCount: countMap.get(id) ?? 0,
      territories: territoryMap.get(id) ?? [],
    };
  });

  const totalAccounts = assignedTotal + (unassignedCount ?? 0);

  return createCorsResponse(
    {
      reps,
      summary: {
        totalReps: reps.length,
        totalAccounts,
        unassignedCount: unassignedCount ?? 0,
        avgPerRep: reps.length > 0 ? Math.round(totalAccounts / reps.length) : 0,
      },
    },
    200,
    req,
  );
}

async function accountsForRep(
  admin: Admin,
  tenantId: string,
  url: URL,
  repId: string,
  req: Request,
): Promise<Response> {
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '25')));
  const offset = (page - 1) * limit;

  const { data, count } = await admin
    .from('business_records')
    .select(
      'id, company_name, record_type, status, phone, billing_city, billing_state, billing_postal_code, territory, owner_id, assigned_sales_rep, estimated_amount, created_at',
      { count: 'exact' },
    )
    .eq('tenant_id', tenantId)
    .eq('owner_id', repId)
    .order('company_name', { ascending: true })
    .range(offset, offset + limit - 1);

  return createCorsResponse(
    {
      accounts: data ?? [],
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: count ? Math.ceil(count / limit) : 1,
      },
    },
    200,
    req,
  );
}

async function listAccountsWithFilters(
  admin: Admin,
  tenantId: string,
  url: URL,
  req: Request,
): Promise<Response> {
  const repFilter = url.searchParams.get('repId');
  const statusFilter = url.searchParams.get('status');
  const assignedOnly = url.searchParams.get('assigned') === 'true';
  const unassignedOnly = url.searchParams.get('unassigned') === 'true';

  let q = admin
    .from('business_records')
    .select(
      'id, company_name, record_type, status, billing_city, billing_state, billing_postal_code, territory, owner_id, assigned_sales_rep',
    )
    .eq('tenant_id', tenantId)
    .order('company_name', { ascending: true })
    .limit(2000);

  if (repFilter) q = q.eq('owner_id', repFilter);
  if (statusFilter) q = q.eq('status', statusFilter);
  if (assignedOnly) q = q.not('owner_id', 'is', null);
  if (unassignedOnly) q = q.is('owner_id', null);

  const { data, error } = await q;
  if (error) {
    return createCorsResponse({ error: 'Failed to fetch accounts' }, 500, req);
  }
  return createCorsResponse(data ?? [], 200, req);
}

async function listUnassigned(
  admin: Admin,
  tenantId: string,
  url: URL,
  req: Request,
): Promise<Response> {
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '25')));
  const offset = (page - 1) * limit;

  const { data, count } = await admin
    .from('business_records')
    .select(
      'id, company_name, record_type, status, phone, billing_city, billing_state, billing_postal_code, territory, created_at',
      { count: 'exact' },
    )
    .eq('tenant_id', tenantId)
    .is('owner_id', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  return createCorsResponse(
    {
      accounts: data ?? [],
      pagination: {
        page,
        limit,
        total: count ?? 0,
        totalPages: count ? Math.ceil(count / limit) : 1,
      },
    },
    200,
    req,
  );
}

async function zipSummary(admin: Admin, tenantId: string, req: Request): Promise<Response> {
  // Aggregate in JS (Supabase JS doesn't have GROUP BY).
  const { data } = await admin
    .from('business_records')
    .select('billing_postal_code')
    .eq('tenant_id', tenantId)
    .not('billing_postal_code', 'is', null);

  const counts = new Map<string, number>();
  for (const r of (data ?? []) as Array<{ billing_postal_code: string | null }>) {
    const z = (r.billing_postal_code ?? '').trim();
    if (!z) continue;
    counts.set(z, (counts.get(z) ?? 0) + 1);
  }

  const summary = Array.from(counts.entries())
    .map(([zip, c]) => ({ zip, count: c }))
    .sort((a, b) => b.count - a.count);

  return createCorsResponse(summary, 200, req);
}

async function assignmentHistory(
  admin: Admin,
  tenantId: string,
  url: URL,
  req: Request,
): Promise<Response> {
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '25')));
  const offset = (page - 1) * limit;
  const repFilter = url.searchParams.get('repId');

  let q = admin
    .from('lead_assignment_history')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('assigned_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (repFilter) {
    q = q.or(`assigned_from.eq.${repFilter},assigned_to.eq.${repFilter}`);
  }

  const { data: history, count } = await q;
  const rows = (history ?? []) as Array<Record<string, unknown>>;

  // Enrich with user names + account names
  const userIds = new Set<string>();
  const accountIds = new Set<string>();
  for (const h of rows) {
    if (h.assigned_from) userIds.add(h.assigned_from as string);
    if (h.assigned_to) userIds.add(h.assigned_to as string);
    if (h.assigned_by) userIds.add(h.assigned_by as string);
    if (h.lead_id) accountIds.add(h.lead_id as string);
  }

  const [usersResult, accountsResult] = await Promise.all([
    userIds.size > 0
      ? admin.from('users').select('id, first_name, last_name').in('id', Array.from(userIds))
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    accountIds.size > 0
      ? admin.from('business_records').select('id, company_name').in('id', Array.from(accountIds))
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ]);

  const userMap = new Map<string, string>();
  for (const u of (usersResult.data ?? []) as Array<Record<string, unknown>>) {
    userMap.set(
      u.id as string,
      `${(u.first_name as string) ?? ''} ${(u.last_name as string) ?? ''}`.trim(),
    );
  }
  const accountMap = new Map<string, string>();
  for (const a of (accountsResult.data ?? []) as Array<Record<string, unknown>>) {
    accountMap.set(a.id as string, (a.company_name as string) ?? 'Unknown');
  }

  const enriched = rows.map((h) => ({
    ...h,
    assignedFromName: h.assigned_from
      ? (userMap.get(h.assigned_from as string) ?? 'Unknown')
      : null,
    assignedToName: userMap.get(h.assigned_to as string) ?? 'Unknown',
    assignedByName: h.assigned_by ? (userMap.get(h.assigned_by as string) ?? 'System') : 'System',
    accountName: accountMap.get(h.lead_id as string) ?? 'Unknown',
  }));

  return createCorsResponse(
    {
      history: enriched,
      pagination: {
        page,
        limit,
        total: count ?? rows.length,
        totalPages: count ? Math.ceil(count / limit) : 1,
      },
    },
    200,
    req,
  );
}

async function assignOne(
  admin: Admin,
  tenantId: string,
  userId: string,
  req: Request,
): Promise<Response> {
  const body = await req.json();
  const accountId = body.accountId as string | undefined;
  const newRepId = body.newRepId as string | undefined;
  const reason = (body.reason as string | undefined) ?? 'manual_override';

  if (!accountId || !newRepId) {
    return createCorsResponse({ error: 'accountId and newRepId are required' }, 400, req);
  }

  // Get current account for previous owner
  const { data: account } = await admin
    .from('business_records')
    .select('id, owner_id')
    .eq('id', accountId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!account) {
    return createCorsResponse({ error: 'Account not found' }, 404, req);
  }
  const previousOwnerId = (account as Record<string, unknown>).owner_id as string | null;

  // Update assignment
  const { error: updateErr } = await admin
    .from('business_records')
    .update({
      owner_id: newRepId,
      assigned_sales_rep: newRepId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', accountId)
    .eq('tenant_id', tenantId);

  if (updateErr) {
    return createCorsResponse({ error: 'Failed to assign account' }, 500, req);
  }

  // Record history
  await admin.from('lead_assignment_history').insert({
    tenant_id: tenantId,
    lead_id: accountId,
    assigned_from: previousOwnerId,
    assigned_to: newRepId,
    assignment_reason: reason,
    assigned_by: userId,
    assignment_notes: reason,
  });

  return createCorsResponse(
    { success: true, accountId, newRepId, previousRepId: previousOwnerId },
    200,
    req,
  );
}

async function bulkAssign(
  admin: Admin,
  tenantId: string,
  userId: string,
  req: Request,
): Promise<Response> {
  const body = await req.json();
  const accountIds = body.accountIds as string[] | undefined;
  const newRepId = body.newRepId as string | undefined;
  const reason = (body.reason as string | undefined) ?? 'bulk_reassignment';

  if (!Array.isArray(accountIds) || accountIds.length === 0 || !newRepId) {
    return createCorsResponse(
      { error: 'accountIds (non-empty array) and newRepId are required' },
      400,
      req,
    );
  }

  const { data: accounts } = await admin
    .from('business_records')
    .select('id, owner_id')
    .eq('tenant_id', tenantId)
    .in('id', accountIds);

  await admin
    .from('business_records')
    .update({
      owner_id: newRepId,
      assigned_sales_rep: newRepId,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .in('id', accountIds);

  const historyEntries = (accounts ?? []).map((a: any) => ({
    tenant_id: tenantId,
    lead_id: a.id,
    assigned_from: a.owner_id ?? null,
    assigned_to: newRepId,
    assignment_reason: reason,
    assigned_by: userId,
    assignment_notes: `Bulk reassignment of ${accountIds.length} accounts`,
  }));

  if (historyEntries.length > 0) {
    await admin.from('lead_assignment_history').insert(historyEntries);
  }

  return createCorsResponse(
    { success: true, assignedCount: (accounts ?? []).length, newRepId },
    200,
    req,
  );
}

async function assignByArea(
  admin: Admin,
  tenantId: string,
  userId: string,
  url: URL,
  req: Request,
): Promise<Response> {
  const body = await req.json();
  const repId = body.repId as string | undefined;
  const method = body.method as 'zip' | 'state' | 'city' | undefined;
  const values = body.values as string[] | undefined;
  const onlyUnassigned = body.onlyUnassigned !== false;

  if (!repId || !method || !Array.isArray(values) || values.length === 0) {
    return createCorsResponse(
      { error: 'repId, method (zip|state|city), and values (non-empty array) are required' },
      400,
      req,
    );
  }
  if (!['zip', 'state', 'city'].includes(method)) {
    return createCorsResponse({ error: "method must be one of 'zip', 'state', 'city'" }, 400, req);
  }

  // Build the area filter on a fresh query each branch (Supabase JS doesn't
  // support detached filter expressions like Drizzle's `or()`).
  function buildScopedQuery() {
    let q = admin
      .from('business_records')
      .select('id, owner_id', { count: 'exact' })
      .eq('tenant_id', tenantId);
    if (method === 'zip') {
      q = q.in('billing_postal_code', values);
    } else if (method === 'state') {
      q = q.in('billing_state', values);
    } else if (method === 'city') {
      // PostgREST 'in' is case-sensitive; original used ILIKE. Use ilike with
      // an OR for each value.
      const orParts = values.map((v) => `billing_city.ilike.${v}`).join(',');
      q = q.or(orParts);
    }
    if (onlyUnassigned) q = q.is('owner_id', null);
    return q;
  }

  // Preview: just count
  if (url.searchParams.get('preview') === 'true') {
    const { count } = await buildScopedQuery();
    return createCorsResponse({ previewCount: count ?? 0 }, 200, req);
  }

  // Get affected for history
  const { data: affected } = await buildScopedQuery();
  const affectedRows = (affected ?? []) as Array<{ id: string; owner_id: string | null }>;

  // Update assignment. Build a NEW scoped update query (the SELECT one is exhausted).
  let upd = admin
    .from('business_records')
    .update({
      owner_id: repId,
      assigned_sales_rep: repId,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId);
  if (method === 'zip') {
    upd = upd.in('billing_postal_code', values);
  } else if (method === 'state') {
    upd = upd.in('billing_state', values);
  } else if (method === 'city') {
    const orParts = values.map((v) => `billing_city.ilike.${v}`).join(',');
    upd = upd.or(orParts);
  }
  if (onlyUnassigned) upd = upd.is('owner_id', null);
  await upd;

  // Record history
  const historyEntries = affectedRows.map((a) => ({
    tenant_id: tenantId,
    lead_id: a.id,
    assigned_from: a.owner_id ?? null,
    assigned_to: repId,
    assignment_reason: 'territory_change',
    assigned_by: userId,
    assignment_notes: `Area assignment by ${method}: ${values.join(', ')}`,
  }));
  if (historyEntries.length > 0) {
    await admin.from('lead_assignment_history').insert(historyEntries);
  }

  return createCorsResponse(
    {
      success: true,
      assignedCount: affectedRows.length,
      repId,
      method,
      values,
    },
    200,
    req,
  );
}
