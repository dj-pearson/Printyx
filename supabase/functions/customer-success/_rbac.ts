// Customer-success RBAC — ported from customer-success-routes.ts::isAdminOrManager.
// Checks auth context roleLevel ≥ 4 (Manager).

import type { AuthContext } from '../_shared/auth.ts';

export function isManagerOrAbove(auth: AuthContext): boolean {
  // deno-lint-ignore no-explicit-any
  const u = auth.supabaseUser as any;
  const raw =
    u?.app_metadata?.roleLevel ??
    u?.app_metadata?.role_level ??
    u?.user_metadata?.roleLevel ??
    u?.user_metadata?.role_level ??
    1;
  const level = typeof raw === 'number' ? raw : parseInt(String(raw), 10) || 1;
  if (level >= 4) return true;

  // Fallback: role string check (same heuristic as lead-scoring/_rbac.ts)
  const role = String(u?.app_metadata?.role ?? u?.user_metadata?.role ?? '').toLowerCase();
  return role.includes('admin') || role.includes('manager') || role.includes('executive');
}
