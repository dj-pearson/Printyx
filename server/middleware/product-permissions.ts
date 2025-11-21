import type { RequestHandler } from "express";

/**
 * Product Permissions Middleware
 *
 * Role hierarchy (from highest to lowest):
 * 1. Platform Admin
 * 2. Super Admin
 * 3. Admin
 * 4. Manager
 * 5. Standard User (Sales Rep)
 * 6. Support
 * 7. Read-Only
 * 8. Guest
 */

// Role levels for comparison
const ROLE_LEVELS = {
  'platform-admin': 1,
  'platform_admin': 1,
  'super-admin': 2,
  'super_admin': 2,
  'admin': 3,
  'manager': 4,
  'standard': 5,
  'standard_user': 5,
  'sales_rep': 5,
  'support': 6,
  'read-only': 7,
  'read_only': 7,
  'guest': 8,
};

/**
 * Get user's role level
 */
function getUserRoleLevel(req: any): number {
  const userRole = req.user?.role || req.session?.user?.role || 'guest';
  const normalizedRole = userRole.toLowerCase().replace(/ /g, '_');
  return ROLE_LEVELS[normalizedRole as keyof typeof ROLE_LEVELS] || 999;
}

/**
 * Get user's role name for logging
 */
function getUserRoleName(req: any): string {
  return req.user?.role || req.session?.user?.role || 'guest';
}

/**
 * Middleware: Require Manager role or above for product management
 * Managers (level 4) and above can manage products
 */
export const requireProductManager: RequestHandler = (req: any, res, next) => {
  try {
    const roleLevel = getUserRoleLevel(req);
    const roleName = getUserRoleName(req);

    if (roleLevel <= 4) {
      return next();
    }

    return res.status(403).json({
      error: "Access denied",
      message: "Manager role or higher required for product management",
      requiredRole: "Manager",
      currentRole: roleName
    });
  } catch (error) {
    console.error("Product manager permission check error:", error);
    return res.status(500).json({ error: "Permission check failed" });
  }
};

/**
 * Middleware: Require Admin role or above for product deletion
 * Admins (level 3) and above can delete products
 */
export const requireProductAdmin: RequestHandler = (req: any, res, next) => {
  try {
    const roleLevel = getUserRoleLevel(req);
    const roleName = getUserRoleName(req);

    if (roleLevel <= 3) {
      return next();
    }

    return res.status(403).json({
      error: "Access denied",
      message: "Admin role or higher required for product deletion",
      requiredRole: "Admin",
      currentRole: roleName
    });
  } catch (error) {
    console.error("Product admin permission check error:", error);
    return res.status(500).json({ error: "Permission check failed" });
  }
};

/**
 * Middleware: Require Manager role or above for inventory management
 * Managers (level 4) and above can manage inventory
 */
export const requireInventoryManager: RequestHandler = (req: any, res, next) => {
  try {
    const roleLevel = getUserRoleLevel(req);
    const roleName = getUserRoleName(req);

    if (roleLevel <= 4) {
      return next();
    }

    return res.status(403).json({
      error: "Access denied",
      message: "Manager role or higher required for inventory management",
      requiredRole: "Manager",
      currentRole: roleName
    });
  } catch (error) {
    console.error("Inventory manager permission check error:", error);
    return res.status(500).json({ error: "Permission check failed" });
  }
};

/**
 * Helper: Check if user can manage products (create/edit)
 */
export function canManageProducts(req: any): boolean {
  const roleLevel = getUserRoleLevel(req);
  return roleLevel <= 4; // Managers and above
}

/**
 * Helper: Check if user can delete products
 */
export function canDeleteProducts(req: any): boolean {
  const roleLevel = getUserRoleLevel(req);
  return roleLevel <= 3; // Admins and above
}

/**
 * Helper: Check if user can manage inventory
 */
export function canManageInventory(req: any): boolean {
  const roleLevel = getUserRoleLevel(req);
  return roleLevel <= 4; // Managers and above
}

/**
 * Helper: Get user role information for logging/debugging
 */
export function getUserRoleInfo(req: any): { role: string; level: number } {
  return {
    role: getUserRoleName(req),
    level: getUserRoleLevel(req)
  };
}
