// Saved Views Edge Function
// Replaces server/routes-saved-views.ts (~490 lines, 8 endpoints).
//
// CRM saved-view CRUD + pinning. Tables: saved_views, saved_view_pins.
//
// URL layout (all under /saved-views):
//   GET    /                         — list views accessible to user (own + team + everyone)
//                                      with isPinned flag derived from saved_view_pins
//   GET    /:id                      — single view (private check enforced)
//   POST   /                         — create view (defaults to visibility='private')
//   PUT    /:id                      — update view (owner or admin)
//   DELETE /:id                      — delete view (owner or admin; can't delete is_system_view)
//   POST   /:id/clone                — duplicate view (always private to caller)
//   PUT    /:id/pin                  — pin view to user's nav (auto sort_order)
//   PUT    /:id/unpin                — remove pin
//   PUT    /pins/reorder             — reorder user's pinned views
//
// Visibility levels: 'private' | 'team' | 'everyone'.
// Admin override: roleLevel >= 7 can edit/delete others' views.

import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

const VALID_OBJECT_TYPES = new Set(['deals', 'leads', 'contacts', 'companies', 'opportunities']);
const VALID_VISIBILITIES = new Set(['private', 'team', 'everyone']);

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

    // Read role level for admin override on update/delete
    const roleLevel =
      (user.app_metadata?.roleLevel as number | undefined) ??
      (user.user_metadata?.roleLevel as number | undefined) ??
      0;
    const isAdmin = roleLevel >= 7;

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'saved-views');
    const first = parts[0]; // ':id' or 'pins'
    const second = parts[1]; // 'clone' / 'pin' / 'unpin' / 'reorder'

    // ─── PUT /pins/reorder (named route — must come before /:id branches) ────
    if (req.method === 'PUT' && first === 'pins' && second === 'reorder') {
      return await reorderPins(admin, user.id, req);
    }

    // ─── GET / (list) ────────────────────────────────────────────────────────
    if (req.method === 'GET' && !first) {
      return await listViews(admin, tenantId, user.id, url, req);
    }

    // ─── POST / (create) ─────────────────────────────────────────────────────
    if (req.method === 'POST' && !first) {
      return await createView(admin, tenantId, user.id, req);
    }

    // ─── /:id and /:id/<action> ──────────────────────────────────────────────
    if (first) {
      if (req.method === 'GET' && !second) {
        return await getView(admin, tenantId, user.id, first, req);
      }
      if (req.method === 'PUT' && !second) {
        return await updateView(admin, tenantId, user.id, isAdmin, first, req);
      }
      if (req.method === 'DELETE' && !second) {
        return await deleteView(admin, tenantId, user.id, isAdmin, first, req);
      }
      if (req.method === 'POST' && second === 'clone') {
        return await cloneView(admin, tenantId, user.id, first, req);
      }
      if (req.method === 'PUT' && second === 'pin') {
        return await pinView(admin, user.id, first, req);
      }
      if (req.method === 'PUT' && second === 'unpin') {
        return await unpinView(admin, user.id, first, req);
      }
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in saved-views function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}

// ─── handlers ───────────────────────────────────────────────────────────────

async function listViews(
  admin: Admin,
  tenantId: string,
  userId: string,
  url: URL,
  req: Request,
): Promise<Response> {
  const objectType = url.searchParams.get('objectType');
  if (!objectType) {
    return createCorsResponse({ error: 'objectType query parameter is required' }, 400, req);
  }
  if (!VALID_OBJECT_TYPES.has(objectType)) {
    return createCorsResponse(
      { error: `Invalid objectType. Must be one of: ${Array.from(VALID_OBJECT_TYPES).join(', ')}` },
      400,
      req,
    );
  }

  const { data: views, error } = await admin
    .from('saved_views')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('object_type', objectType)
    .or(`user_id.eq.${userId},visibility.eq.team,visibility.eq.everyone`)
    .order('is_default', { ascending: false })
    .order('is_system_view', { ascending: false })
    .order('name', { ascending: true });

  if (error) {
    return createCorsResponse({ error: 'Failed to fetch saved views' }, 500, req);
  }

  // Pinned views for sort/state
  const { data: pins } = await admin
    .from('saved_view_pins')
    .select('view_id, sort_order')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true });

  const pinMap = new Map<string, number>();
  for (const p of (pins ?? []) as Array<{ view_id: string; sort_order: number }>) {
    pinMap.set(p.view_id, p.sort_order);
  }

  const result = (views ?? []).map((v: any) => ({
    ...v,
    isPinned: pinMap.has(v.id),
    pinSortOrder: pinMap.get(v.id) ?? null,
  }));

  return createCorsResponse(result, 200, req);
}

async function getView(
  admin: Admin,
  tenantId: string,
  userId: string,
  viewId: string,
  req: Request,
): Promise<Response> {
  const { data: view, error } = await admin
    .from('saved_views')
    .select('*')
    .eq('id', viewId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !view) {
    return createCorsResponse({ error: 'View not found' }, 404, req);
  }
  const v = view as Record<string, unknown>;
  if (v.user_id !== userId && v.visibility === 'private') {
    return createCorsResponse({ error: 'Access denied' }, 403, req);
  }
  return createCorsResponse(view, 200, req);
}

async function createView(
  admin: Admin,
  tenantId: string,
  userId: string,
  req: Request,
): Promise<Response> {
  const body = await req.json();
  const objectType = body.objectType as string | undefined;
  const name = body.name as string | undefined;

  if (!objectType || !VALID_OBJECT_TYPES.has(objectType)) {
    return createCorsResponse({ error: 'Invalid or missing objectType' }, 400, req);
  }
  if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 255) {
    return createCorsResponse({ error: 'name is required (1-255 chars)' }, 400, req);
  }

  const visibility = body.visibility ?? 'private';
  if (!VALID_VISIBILITIES.has(visibility)) {
    return createCorsResponse({ error: 'Invalid visibility' }, 400, req);
  }

  const { data: created, error } = await admin
    .from('saved_views')
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      object_type: objectType,
      name: name.trim(),
      filter_definition: body.filterDefinition ?? null,
      sort_config: body.sortConfig ?? null,
      column_config: body.columnConfig ?? null,
      board_config: body.boardConfig ?? null,
      visibility,
      is_default: body.isDefault === true,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating saved view:', error);
    return createCorsResponse({ error: 'Failed to create saved view' }, 500, req);
  }
  return createCorsResponse(created, 201, req);
}

async function updateView(
  admin: Admin,
  tenantId: string,
  userId: string,
  isAdmin: boolean,
  viewId: string,
  req: Request,
): Promise<Response> {
  const { data: existing } = await admin
    .from('saved_views')
    .select('user_id')
    .eq('id', viewId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!existing) {
    return createCorsResponse({ error: 'View not found' }, 404, req);
  }
  if ((existing as Record<string, unknown>).user_id !== userId && !isAdmin) {
    return createCorsResponse(
      { error: 'Only the view owner or an admin can update this view' },
      403,
      req,
    );
  }

  const body = await req.json();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) update.name = body.name;
  if (body.objectType !== undefined) {
    if (!VALID_OBJECT_TYPES.has(body.objectType)) {
      return createCorsResponse({ error: 'Invalid objectType' }, 400, req);
    }
    update.object_type = body.objectType;
  }
  if (body.filterDefinition !== undefined) update.filter_definition = body.filterDefinition;
  if (body.sortConfig !== undefined) update.sort_config = body.sortConfig;
  if (body.columnConfig !== undefined) update.column_config = body.columnConfig;
  if (body.boardConfig !== undefined) update.board_config = body.boardConfig;
  if (body.visibility !== undefined) {
    if (!VALID_VISIBILITIES.has(body.visibility)) {
      return createCorsResponse({ error: 'Invalid visibility' }, 400, req);
    }
    update.visibility = body.visibility;
  }
  if (body.isDefault !== undefined) update.is_default = body.isDefault === true;

  const { data: updated, error } = await admin
    .from('saved_views')
    .update(update)
    .eq('id', viewId)
    .select()
    .single();

  if (error) {
    return createCorsResponse({ error: 'Failed to update saved view' }, 500, req);
  }
  return createCorsResponse(updated, 200, req);
}

async function deleteView(
  admin: Admin,
  tenantId: string,
  userId: string,
  isAdmin: boolean,
  viewId: string,
  req: Request,
): Promise<Response> {
  const { data: existing } = await admin
    .from('saved_views')
    .select('user_id, is_system_view')
    .eq('id', viewId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!existing) {
    return createCorsResponse({ error: 'View not found' }, 404, req);
  }
  const e = existing as Record<string, unknown>;
  if (e.is_system_view === true) {
    return createCorsResponse({ error: 'Cannot delete system default views' }, 403, req);
  }
  if (e.user_id !== userId && !isAdmin) {
    return createCorsResponse(
      { error: 'Only the view owner or an admin can delete this view' },
      403,
      req,
    );
  }

  // Delete pins first (no FK cascade assumed; mirrors Express order)
  await admin.from('saved_view_pins').delete().eq('view_id', viewId);
  await admin.from('saved_views').delete().eq('id', viewId);

  return createCorsResponse({ message: 'View deleted successfully' }, 200, req);
}

async function cloneView(
  admin: Admin,
  tenantId: string,
  userId: string,
  viewId: string,
  req: Request,
): Promise<Response> {
  const { data: source } = await admin
    .from('saved_views')
    .select('*')
    .eq('id', viewId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!source) {
    return createCorsResponse({ error: 'View not found' }, 404, req);
  }
  const s = source as Record<string, unknown>;
  if (s.user_id !== userId && s.visibility === 'private') {
    return createCorsResponse({ error: 'Access denied' }, 403, req);
  }

  let body: { name?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body OK */
  }
  const cloneName = body.name || `${s.name as string} (Copy)`;

  const { data: cloned, error } = await admin
    .from('saved_views')
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      object_type: s.object_type,
      name: cloneName,
      filter_definition: s.filter_definition ?? null,
      sort_config: s.sort_config ?? null,
      column_config: s.column_config ?? null,
      board_config: s.board_config ?? null,
      visibility: 'private',
      is_default: false,
      is_system_view: false,
    })
    .select()
    .single();

  if (error) {
    return createCorsResponse({ error: 'Failed to clone saved view' }, 500, req);
  }
  return createCorsResponse(cloned, 201, req);
}

async function pinView(
  admin: Admin,
  userId: string,
  viewId: string,
  req: Request,
): Promise<Response> {
  // Already pinned?
  const { data: existingPin } = await admin
    .from('saved_view_pins')
    .select('*')
    .eq('user_id', userId)
    .eq('view_id', viewId)
    .maybeSingle();

  if (existingPin) {
    return createCorsResponse({ message: 'View already pinned', pin: existingPin }, 200, req);
  }

  // Compute next sort order in JS (Supabase JS doesn't have MAX aggregation
  // in select; pull all pins for this user — bounded list).
  const { data: pins } = await admin
    .from('saved_view_pins')
    .select('sort_order')
    .eq('user_id', userId);

  const maxSort = ((pins ?? []) as Array<{ sort_order: number }>).reduce(
    (m, p) => (p.sort_order > m ? p.sort_order : m),
    0,
  );

  const { data: pin, error } = await admin
    .from('saved_view_pins')
    .insert({
      user_id: userId,
      view_id: viewId,
      sort_order: maxSort + 1,
    })
    .select()
    .single();

  if (error) {
    return createCorsResponse({ error: 'Failed to pin view' }, 500, req);
  }
  return createCorsResponse(pin, 200, req);
}

async function unpinView(
  admin: Admin,
  userId: string,
  viewId: string,
  req: Request,
): Promise<Response> {
  await admin.from('saved_view_pins').delete().eq('user_id', userId).eq('view_id', viewId);

  return createCorsResponse({ message: 'View unpinned successfully' }, 200, req);
}

async function reorderPins(admin: Admin, userId: string, req: Request): Promise<Response> {
  const body = await req.json();
  const pinOrder = body.pinOrder as Array<{ viewId: string; sortOrder: number }> | undefined;
  if (!Array.isArray(pinOrder)) {
    return createCorsResponse({ error: 'pinOrder array is required' }, 400, req);
  }

  for (const item of pinOrder) {
    if (!item.viewId || typeof item.sortOrder !== 'number') continue;
    await admin
      .from('saved_view_pins')
      .update({ sort_order: item.sortOrder })
      .eq('user_id', userId)
      .eq('view_id', item.viewId);
  }

  return createCorsResponse({ message: 'Pin order updated' }, 200, req);
}
