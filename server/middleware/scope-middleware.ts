/**
 * Scope Middleware
 *
 * RBAC-008: Centralized helper to apply role-based data scoping to queries.
 *
 * Usage in route handlers:
 *   const scopeFilter = applyScopeFilter(req, table);
 *   const data = await db.select().from(table).where(scopeFilter);
 *
 * Scope tiers:
 *   - Level 1-2 (Individual/Team Lead): Own records only (userId match)
 *   - Level 3-4 (Supervisor/Manager): Team records (teamId match)
 *   - Level 5-6 (Director/Company Dir): Regional records (regionId match)
 *   - Level 7+ (Executive): Company-wide (tenantId only)
 *   - Platform admin: Bypass all scoping
 */

import { SQL, sql, eq, and, or } from 'drizzle-orm';
import { getUserId, getTenantId, isPlatformAdmin } from '../utils/auth-helpers';
import type { Request } from 'express';

export interface ScopeableTable {
  tenantId: any;
  createdBy?: any;
  ownerId?: any;
  assignedTo?: any;
  userId?: any;
  teamId?: any;
  regionId?: any;
  locationId?: any;
}

/**
 * Apply role-based scope filtering to a query.
 *
 * Returns a SQL WHERE clause that restricts results based on the user's role level.
 * Platform admins bypass all filtering.
 *
 * @param req - Express request object with user context
 * @param table - Drizzle table object with scoping fields
 * @param options - Override options
 */
export function applyScopeFilter(
  req: Request,
  table: ScopeableTable,
  options?: {
    ownerField?: 'createdBy' | 'ownerId' | 'assignedTo' | 'userId';
  },
): SQL | undefined {
  const userId = getUserId(req);
  const tenantId = getTenantId(req);

  // Platform admins see everything - documented bypass
  if (isPlatformAdmin(req)) {
    return undefined; // No filter = all records across all tenants
  }

  if (!tenantId) {
    // No tenant context = deny all
    return sql`1 = 0`;
  }

  const user = (req as any).user || {};
  const roleLevel = user.roleLevel || user.role_level || 1;
  const tenantFilter = eq(table.tenantId, tenantId);

  // Level 7+ (Executive/Platform Admin): Company-wide access
  if (roleLevel >= 7) {
    return tenantFilter;
  }

  // Level 5-6 (Regional/Company Director): Regional scope
  if (roleLevel >= 5) {
    const regionId = user.regionId || user.region_id;
    if (regionId && table.regionId) {
      return and(tenantFilter, eq(table.regionId, regionId));
    }
    // Fallback to tenant-wide if no region specified
    return tenantFilter;
  }

  // Level 3-4 (Supervisor/Manager): Team scope
  if (roleLevel >= 3) {
    const teamId = user.teamId || user.team_id;
    if (teamId && table.teamId) {
      return and(tenantFilter, eq(table.teamId, teamId));
    }
    // If no teamId field, fallback to location
    const locationId = user.locationId || user.location_id;
    if (locationId && table.locationId) {
      return and(tenantFilter, eq(table.locationId, locationId));
    }
    return tenantFilter;
  }

  // Level 1-2 (Individual/Team Lead): Own records only
  const ownerField = options?.ownerField || 'ownerId';
  const field = table[ownerField] || table.createdBy || table.ownerId || table.assignedTo;
  if (field && userId) {
    return and(tenantFilter, eq(field, userId));
  }

  return tenantFilter;
}

/**
 * Get the scope level name for the current user's role level.
 */
export function getScopeLevel(roleLevel: number): string {
  if (roleLevel >= 8) return 'platform';
  if (roleLevel >= 7) return 'company';
  if (roleLevel >= 5) return 'regional';
  if (roleLevel >= 3) return 'team';
  return 'own';
}
