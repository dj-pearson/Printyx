// Minimal local RBAC helper — ported from server/routes/lead-scoring-routes.ts::isAdminOrManager.
// Checks auth context role (string or role-level) for admin/manager/executive.

import type { AuthContext } from '../_shared/auth.ts';

export function isAdminOrManager(auth: AuthContext): boolean {
  const role = String(
    (auth.supabaseUser as any)?.app_metadata?.role ??
      (auth.supabaseUser as any)?.user_metadata?.role ??
      '',
  ).toLowerCase();
  if (!role) return false;
  return role.includes('admin') || role.includes('manager') || role.includes('executive');
}
