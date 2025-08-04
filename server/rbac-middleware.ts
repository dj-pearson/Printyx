import type { RequestHandler } from "express";
import { storage } from "./storage";

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

// Role-based permission checking middleware
export const requireRole = (minimumLevel: number, department?: string): RequestHandler => {
  return async (req: any, res, next) => {
    try {
      const userId = req.user?.claims?.sub;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized - No user ID" });
      }

      // Get user with role information
      const userWithRole = await storage.getUserWithRole(userId);
      
      if (!userWithRole || !userWithRole.role) {
        return res.status(403).json({ message: "Access denied - No role assigned" });
      }

      const { role, team, tenantId } = userWithRole;

      // Check minimum role level
      if (role.level < minimumLevel) {
        return res.status(403).json({ 
          message: `Access denied - Requires level ${minimumLevel} or higher` 
        });
      }

      // Check department access if specified
      if (department && role.department !== department && role.level < 4) { // Directors and above can cross departments
        return res.status(403).json({ 
          message: `Access denied - Requires ${department} department access` 
        });
      }

      // Enhance request with RBAC context
      req.user.roleLevel = role.level;
      req.user.department = role.department;
      req.user.teamId = team?.id;
      req.user.tenantId = tenantId || undefined;

      next();
    } catch (error) {
      console.error("Role-based access control error:", error);
      res.status(500).json({ message: "Internal server error during authorization" });
    }
  };
};

// Department-specific middleware shortcuts
export const requireSalesAccess = (minimumLevel: number = 1) => requireRole(minimumLevel, "sales");
export const requireServiceAccess = (minimumLevel: number = 1) => requireRole(minimumLevel, "service");
export const requireFinanceAccess = (minimumLevel: number = 1) => requireRole(minimumLevel, "finance");
export const requirePurchasingAccess = (minimumLevel: number = 1) => requireRole(minimumLevel, "purchasing");
export const requireAdminAccess = (minimumLevel: number = 4) => requireRole(minimumLevel, "admin");

// Manager-level access (level 3+)
export const requireManagerAccess = (department?: string) => requireRole(3, department);

// Director-level access (level 4+) - can access cross-department data
export const requireDirectorAccess = () => requireRole(4);

// Admin-level access (level 5)
export const requireSystemAdmin = () => requireRole(5, "admin");

// Territory-based data filtering helper
export const getDataFilter = (req: AuthenticatedRequest) => {
  const { roleLevel, teamId, tenantId } = req.user;
  const userId = req.user.claims.sub;

  return {
    userId,
    tenantId: tenantId!,
    roleLevel: roleLevel!,
    teamId,
  };
};

// Permission checking utilities
export const canAccessCustomer = async (req: AuthenticatedRequest, customerId: string): Promise<boolean> => {
  const { userId, tenantId, roleLevel, teamId } = getDataFilter(req);
  
  // Directors and above can access all customers
  if (roleLevel >= 4) return true;
  
  // Get accessible customers for this user's role
  const accessibleCustomers = await storage.getAccessibleCustomers(userId, tenantId, roleLevel, teamId);
  return accessibleCustomers.some(customer => customer.id === customerId);
};

export const canAccessLead = async (req: AuthenticatedRequest, leadId: string): Promise<boolean> => {
  const { userId, tenantId, roleLevel, teamId } = getDataFilter(req);
  
  if (roleLevel >= 4) return true;
  
  const accessibleLeads = await storage.getAccessibleLeads(userId, tenantId, roleLevel, teamId);
  return accessibleLeads.some(lead => lead.id === leadId);
};

export const canAccessServiceTicket = async (req: AuthenticatedRequest, ticketId: string): Promise<boolean> => {
  const { userId, tenantId, roleLevel, teamId } = getDataFilter(req);
  
  if (roleLevel >= 4) return true;
  
  const accessibleTickets = await storage.getAccessibleServiceTickets(userId, tenantId, roleLevel, teamId);
  return accessibleTickets.some(ticket => ticket.id === ticketId);
};

// Data scope middleware - automatically filters data based on user permissions
export const applyScopeFilter: RequestHandler = async (req: any, res, next) => {
  try {
    const { roleLevel, teamId, tenantId } = req.user;
    const userId = req.user.claims.sub;

    // Add scope information to request for use in route handlers
    req.dataScope = {
      userId,
      tenantId: tenantId!,
      roleLevel: roleLevel || 0,
      teamId,
      canAccessAll: (roleLevel || 0) >= 4, // Directors and above see all data
    };

    next();
  } catch (error) {
    console.error("Data scope filtering error:", error);
    res.status(500).json({ message: "Internal server error during data scoping" });
  }
};

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      dataScope?: {
        userId: string;
        tenantId: string;
        roleLevel: number;
        teamId?: string;
        canAccessAll: boolean;
      };
    }
  }
}