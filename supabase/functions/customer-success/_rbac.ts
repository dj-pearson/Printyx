// Customer-success RBAC, ported from customer-success-routes.ts::isAdminOrManager.
// Manager (level 4) and above.
//
// Round 148. This used to read the role from user_metadata as well as
// app_metadata and to match role NAMES by substring. user_metadata is written by
// the session holder (SEC-TENANT-003), so any member could make themselves a
// manager here; and the substring test let ACCOUNT_EXECUTIVE (a level-3
// individual contributor in migration 0072) through on "executive". The level
// now comes from the app_metadata claim, or users -> roles.level when the token
// carries none, through _shared/rbac.ts - the one resolver every gate shares.

import type { AuthContext } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { ROLE_LEVEL, resolveRoleLevel } from '../_shared/rbac.ts';

export async function isManagerOrAbove(auth: AuthContext): Promise<boolean> {
  const level = await resolveRoleLevel(getDb(), auth.supabaseUser);
  return level >= ROLE_LEVEL.MANAGER;
}
