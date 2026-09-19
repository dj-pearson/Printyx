// GET /dashboard/layouts/default, POST /dashboard/layouts,
// DELETE /dashboard/layouts/:id - CustomDashboard's saved arrangement.
//
// THIS NEVER WORKED ON EITHER HOST (DASH-METRICS-001). In production
// /api/dashboard/layouts 404'd, because the dashboard edge function served only
// card-config and modules. In dev it 42703'd: server/routes-dashboard-layouts.ts
// imported `dashboardLayouts` from shared/reporting-schema.ts, and migration
// 0002 had already converted the physical table to the OTHER declaration -
// dropping `is_active`, `created_by`, `layout`, `display_order`, `is_public`,
// `allowed_roles`, `allowed_users` and adding `role_id`, `is_user_custom`,
// `columns`, `gap`. The Express handler filtered on is_active and inserted
// created_by and layout, so loading a layout matched nothing and saving one
// threw. The Save button on /custom-dashboard has never persisted anything.
//
// Two declarations of one table is AUDIT-037's shape; shared/drizzle-schema.ts
// resolves this collision in favour of schema-dashboard, which is the shape
// migration 0002 built and the shape this handler binds to.
import { type Admin } from './_context.ts';

export interface LayoutPayload {
  name?: unknown;
  widgets?: unknown;
  columns?: unknown;
  gap?: unknown;
  isDefault?: unknown;
}

export interface SavedLayout {
  id: string | null;
  name: string;
  widgets: unknown[];
  columns: number;
  gap: number;
  isDefault: boolean;
}

/** What a user with no saved layout gets. Empty, so the client applies its own defaults. */
export const EMPTY_LAYOUT: SavedLayout = {
  id: null,
  name: 'Default Dashboard',
  widgets: [],
  columns: 12,
  gap: 4,
  isDefault: true,
};

export function normalizeLayout(body: LayoutPayload): {
  name: string;
  widgets: unknown[];
  columns: number;
  gap: number;
} | null {
  if (!Array.isArray(body.widgets)) return null;
  const columns = Number(body.columns);
  const gap = Number(body.gap);
  return {
    name: typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'My Dashboard',
    widgets: body.widgets,
    columns: Number.isFinite(columns) && columns > 0 ? Math.min(24, Math.round(columns)) : 12,
    gap: Number.isFinite(gap) && gap >= 0 ? Math.min(16, Math.round(gap)) : 4,
  };
}

function toSaved(row: Record<string, unknown>): SavedLayout {
  return {
    id: String(row.id),
    name: String(row.name ?? 'My Dashboard'),
    widgets: Array.isArray(row.widgets) ? (row.widgets as unknown[]) : [],
    columns: Number(row.columns ?? 12),
    gap: Number(row.gap ?? 4),
    isDefault: row.is_default === true,
  };
}

export async function getDefaultLayout(
  admin: Admin,
  tenantId: string,
  userId: string,
): Promise<SavedLayout> {
  const { data, error } = await admin
    .from('dashboard_layouts')
    .select('id, name, widgets, columns, gap, is_default')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('is_user_custom', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? toSaved(data as Record<string, unknown>) : EMPTY_LAYOUT;
}

/**
 * One custom layout per user, replaced in place.
 *
 * It is an update-then-insert rather than an upsert because there is no unique
 * index on (tenant_id, user_id, is_user_custom) to name in onConflict, and
 * upserting without one inserts a duplicate on every save.
 */
export async function saveLayout(
  admin: Admin,
  tenantId: string,
  userId: string,
  layout: { name: string; widgets: unknown[]; columns: number; gap: number },
): Promise<SavedLayout> {
  const now = new Date().toISOString();
  const { data: existing, error: findError } = await admin
    .from('dashboard_layouts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('is_user_custom', true)
    .limit(1)
    .maybeSingle();
  if (findError) throw findError;

  if (existing) {
    const { data, error } = await admin
      .from('dashboard_layouts')
      .update({ ...layout, updated_at: now })
      .eq('id', existing.id)
      .eq('tenant_id', tenantId)
      .select('id, name, widgets, columns, gap, is_default')
      .single();
    if (error) throw error;
    return toSaved(data as Record<string, unknown>);
  }

  const { data, error } = await admin
    .from('dashboard_layouts')
    .insert({
      ...layout,
      tenant_id: tenantId,
      user_id: userId,
      is_user_custom: true,
      is_default: false,
      created_at: now,
      updated_at: now,
    })
    .select('id, name, widgets, columns, gap, is_default')
    .single();
  if (error) throw error;
  return toSaved(data as Record<string, unknown>);
}

export async function deleteLayout(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
): Promise<boolean> {
  // Scoped by tenant AND user: a layout id travels in a URL, and hard to guess
  // is not an authorisation check (SEC-TENANT-005).
  const { data, error } = await admin
    .from('dashboard_layouts')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .select('id');
  if (error) throw error;
  return (data ?? []).length > 0;
}
