import type { RequestHandler } from 'express';
import { storage } from './storage';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('rbac-middleware');

// Enhanced authentication middleware with role-based access control
export interface AuthenticatedRequest extends Express.Request {
  user: {
    claims: {
      sub: string;
      email?: string;
      first_name?: string;
      last_name?: string;
      profile_image_url?: string;
      iat?: number;
      exp?: number;
    };
    access_token: string;
    refresh_token?: string;
    expires_at: number;
    // Enhanced RBAC properties
    roleLevel?: number;
    department?: string;
    teamId?: string;
    tenantId?: string;
  };
}

/**
 * Coarse role-name shorthands used in `requireRole([...])` calls, mapped to the
 * MINIMUM `role.level` (DB hierarchy: Sales Rep/Service Tech = 1, Team Lead = 2,
 * Manager = 3, Director = 4, Company Admin = 5, Printyx Support = 6,
 * Root/Platform Admin = 7) that satisfies them.
 *
 * `requireRole([...])` grants the LOWEST listed tier and everyone above it
 * (hierarchical: a manager can reach a route gated to sales reps). Functional
 * roles (compliance/legal/security) sit at company-admin level so a route like
 * `requireRole(['admin', 'compliance_officer', 'legal', 'manager'])` admits
 * managers and up — matching the explicit list the route author wrote.
 */
const ROLE_NAME_MIN_LEVEL: Record<string, number> = {
  guest: 1,
  user: 1,
  employee: 1,
  sales_rep: 1,
  service_tech: 1,
  technician: 1,
  team_lead: 2,
  manager: 3,
  director: 4,
  admin: 5,
  company_admin: 5,
  compliance_officer: 5,
  legal: 5,
  security_officer: 5,
  printyx_support: 6,
  platform_admin: 7,
  root_admin: 7,
  super_admin: 7,
};

/**
 * Resolve a `requireRole` argument (a numeric minimum level, or an array of
 * role-name shorthands) to the minimum acceptable `role.level`.
 */
function resolveMinimumLevel(rolesOrLevel: string[] | number): number {
  if (typeof rolesOrLevel === 'number') return rolesOrLevel;
  if (!rolesOrLevel.length) return Number.POSITIVE_INFINITY; // empty list => deny
  return Math.min(...rolesOrLevel.map((r) => ROLE_NAME_MIN_LEVEL[r.toLowerCase()] ?? 1));
}

// Role-based permission checking middleware. Accepts either a numeric minimum
// role level (e.g. requireRole(3)) or an array of role-name shorthands
// (e.g. requireRole(['admin', 'manager'])).
export const requireRole = (
  rolesOrLevel: string[] | number,
  department?: string,
): RequestHandler => {
  const minimumLevel = resolveMinimumLevel(rolesOrLevel);
  return async (req: any, res, next) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized - No user ID' });
      }

      // Get user with role information
      const userWithRole = await storage.getUserWithRole(userId);

      if (!userWithRole || !userWithRole.role) {
        return res.status(403).json({ message: 'Access denied - No role assigned' });
      }

      const { role, team, tenantId } = userWithRole;

      // Check minimum role level
      if (role.level < minimumLevel) {
        return res.status(403).json({
          message: `Access denied - Requires level ${minimumLevel} or higher`,
        });
      }

      // Check department access if specified
      if (department && role.department !== department && role.level < 4) {
        // Directors and above can cross departments
        return res.status(403).json({
          message: `Access denied - Requires ${department} department access`,
        });
      }

      // Enhance request with RBAC context
      req.user.roleLevel = role.level;
      req.user.department = role.department;
      req.user.teamId = team?.id;
      req.user.tenantId = tenantId || undefined;

      next();
    } catch (error) {
      log.error('Role-based access control error:', error);
      res.status(500).json({ message: 'Internal server error during authorization' });
    }
  };
};

// Department-specific middleware shortcuts
export const requireSalesAccess = (minimumLevel: number = 1) => requireRole(minimumLevel, 'sales');
export const requireServiceAccess = (minimumLevel: number = 1) =>
  requireRole(minimumLevel, 'service');
export const requireFinanceAccess = (minimumLevel: number = 1) =>
  requireRole(minimumLevel, 'finance');
export const requirePurchasingAccess = (minimumLevel: number = 1) =>
  requireRole(minimumLevel, 'purchasing');
export const requireAdminAccess = (minimumLevel: number = 4) => requireRole(minimumLevel, 'admin');

// Manager-level access (level 3+)
export const requireManagerAccess = (department?: string) => requireRole(3, department);

// Director-level access (level 4+) - can access cross-department data
export const requireDirectorAccess = () => requireRole(4);

// Admin-level access (level 5)
export const requireSystemAdmin = () => requireRole(5, 'admin');
