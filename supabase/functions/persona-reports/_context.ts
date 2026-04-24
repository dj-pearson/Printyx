import type { AuthContext } from '../_shared/auth.ts';
import type { SupabaseClient } from '../_shared/db.ts';

export interface HandlerCtx {
  auth: AuthContext;
  db: SupabaseClient;
  requestId: string;
  pathParts: string[];
  method: string;
  url: URL;
}

/**
 * RBAC level check — matches enhanced-rbac-middleware::requireLevel() from
 * the Express side. Roles are stored in the JWT's app_metadata.role_level
 * (numeric 1-8) or app_metadata.role (string — mapped at the gate).
 *
 * Level map (from server/middleware/enhanced-rbac-middleware.ts):
 *   8 = Platform Admin
 *   7 = Executive
 *   6 = VP / C-level
 *   5 = Regional Director
 *   4 = Manager
 *   3 = Supervisor
 *   2 = Individual contributor
 *   1 = Guest
 */
export function getRoleLevel(auth: AuthContext): number {
  const meta = auth.supabaseUser.app_metadata ?? {};
  const explicit = Number(meta.role_level);
  if (Number.isFinite(explicit) && explicit >= 1 && explicit <= 8) return explicit;

  const role = String(meta.role ?? '').toLowerCase();
  if (role.includes('platform') || role.includes('super')) return 8;
  if (role.includes('executive') || role.includes('ceo')) return 7;
  if (role.includes('vp') || role.includes('c-level')) return 6;
  if (role.includes('director')) return 5;
  if (role.includes('manager')) return 4;
  if (role.includes('supervisor') || role.includes('lead')) return 3;
  if (role.includes('admin')) return 4;
  return 2;
}

export function hasMinLevel(auth: AuthContext, min: number): boolean {
  return getRoleLevel(auth) >= min;
}

/**
 * Parse `?dateFrom=&dateTo=` query params into ISO date strings (or nulls
 * for the Postgres function defaults). Every report endpoint uses the same
 * date-range convention.
 */
export function parseDateRange(url: URL): {
  dateFrom: string | null;
  dateTo: string | null;
} {
  const dateFrom = url.searchParams.get('dateFrom');
  const dateTo = url.searchParams.get('dateTo');
  return {
    dateFrom: dateFrom ? new Date(dateFrom).toISOString() : null,
    dateTo: dateTo ? new Date(dateTo).toISOString() : null,
  };
}
