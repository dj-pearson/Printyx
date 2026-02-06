/**
 * MFA Enforcement Middleware
 *
 * Enforces Multi-Factor Authentication requirements for admin and sensitive roles.
 * Implements configurable role-level MFA requirements.
 */

import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { getComplianceSettings } from '../storage/security-storage';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('mfa-enforcement');

// Role levels that require MFA (configurable per tenant)
export const DEFAULT_MFA_REQUIRED_ROLES = [
  'platform_admin',
  'super_admin',
  'admin',
  'manager',
  'finance_admin',
  'security_admin',
];

// Role hierarchy levels that require MFA (level 4+ by default)
export const MFA_REQUIRED_LEVEL = 4; // Manager and above

// Sensitive routes that always require MFA
export const MFA_REQUIRED_PATHS = [
  '/api/root-admin',
  '/api/platform',
  '/api/security',
  '/api/users/bulk',
  '/api/billing',
  '/api/subscriptions',
  '/api/integrations/oauth',
  '/api/export',
  '/api/gdpr',
];

// Sensitive actions that require MFA verification
export const MFA_REQUIRED_ACTIONS = [
  'DELETE',
  'BULK_DELETE',
  'EXPORT_DATA',
  'CHANGE_PASSWORD',
  'MODIFY_PERMISSIONS',
  'CREATE_API_KEY',
];

interface MfaEnforcementOptions {
  requiredRoles?: string[];
  requiredLevel?: number;
  requiredPaths?: string[];
  skipForTestMode?: boolean;
}

/**
 * Get MFA requirement settings for a tenant
 */
export async function getTenantMfaSettings(tenantId: string): Promise<{
  mfaRequiredRoles: string[];
  mfaRequiredLevel: number;
  mfaEnabled: boolean;
}> {
  try {
    // Check tenant compliance settings
    const settings = await getComplianceSettings(tenantId);

    return {
      mfaRequiredRoles: settings?.mfaRequiredRoles || DEFAULT_MFA_REQUIRED_ROLES,
      mfaRequiredLevel: settings?.mfaRequiredLevel || MFA_REQUIRED_LEVEL,
      mfaEnabled: settings?.mfaEnabled !== false, // Default to true
    };
  } catch {
    // Return defaults if settings not found
    return {
      mfaRequiredRoles: DEFAULT_MFA_REQUIRED_ROLES,
      mfaRequiredLevel: MFA_REQUIRED_LEVEL,
      mfaEnabled: true,
    };
  }
}

/**
 * Check if user's role requires MFA
 */
export function roleRequiresMfa(
  userRole: string | undefined,
  userLevel: number | undefined,
  requiredRoles: string[],
  requiredLevel: number,
): boolean {
  // Check by role name
  if (userRole && requiredRoles.includes(userRole)) {
    return true;
  }

  // Check by hierarchy level
  if (userLevel && userLevel >= requiredLevel) {
    return true;
  }

  return false;
}

/**
 * Check if the current path requires MFA
 */
export function pathRequiresMfa(path: string, method: string): boolean {
  // Check if path matches any MFA-required paths
  for (const requiredPath of MFA_REQUIRED_PATHS) {
    if (path.startsWith(requiredPath)) {
      return true;
    }
  }

  // Check for sensitive HTTP methods on certain paths
  if (method === 'DELETE' && path.startsWith('/api/')) {
    return true;
  }

  return false;
}

/**
 * Middleware to require MFA for admin and sensitive roles
 *
 * Usage:
 *   app.use('/api/admin', requireMfaForAdmins());
 *   app.delete('/api/users/:id', requireMfaForAdmins(), deleteUserHandler);
 */
export function requireMfaForAdmins(options: MfaEnforcementOptions = {}) {
  const {
    requiredRoles = DEFAULT_MFA_REQUIRED_ROLES,
    requiredLevel = MFA_REQUIRED_LEVEL,
    requiredPaths = MFA_REQUIRED_PATHS,
    skipForTestMode = true,
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Skip in test mode if configured
      const isTestMode =
        skipForTestMode &&
        (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') &&
        process.env.TEST_MODE === 'true';

      if (isTestMode && req.headers['x-test-auth']) {
        return next();
      }

      // Get user from session
      const user = (req as any).user || req.session?.user;
      if (!user) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'UNAUTHENTICATED',
        });
      }

      // Get user's full profile with role information
      const userWithRole = await storage.getUserWithRole(user.id);
      if (!userWithRole) {
        return res.status(401).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      // Get tenant MFA settings
      const tenantSettings = user.tenantId
        ? await getTenantMfaSettings(user.tenantId)
        : { mfaRequiredRoles: requiredRoles, mfaRequiredLevel: requiredLevel, mfaEnabled: true };

      // Skip if MFA is disabled for tenant
      if (!tenantSettings.mfaEnabled) {
        return next();
      }

      // Check if role requires MFA
      const userRole = userWithRole.role;
      const userLevel = parseRoleLevel(userRole);

      const needsMfa =
        roleRequiresMfa(
          userRole,
          userLevel,
          tenantSettings.mfaRequiredRoles,
          tenantSettings.mfaRequiredLevel,
        ) || pathRequiresMfa(req.path, req.method);

      if (!needsMfa) {
        return next();
      }

      // Check if user has MFA enabled
      const mfaStatus = await storage.getUserMfaStatus(user.id);

      if (!mfaStatus?.enabled) {
        return res.status(403).json({
          error: 'MFA setup required',
          code: 'MFA_REQUIRED',
          message:
            'Your role requires Multi-Factor Authentication. Please enable MFA in your security settings.',
          redirectTo: '/settings/security/mfa',
        });
      }

      // Check if session has verified MFA
      const session = req.session as any;
      if (!session?.mfaVerified) {
        return res.status(403).json({
          error: 'MFA verification required',
          code: 'MFA_VERIFICATION_REQUIRED',
          message: 'Please verify your identity with MFA to continue.',
          challengeRequired: true,
        });
      }

      // Check MFA verification timestamp (require re-verification after 1 hour for sensitive operations)
      const mfaVerifiedAt = session.mfaVerifiedAt;
      const ONE_HOUR = 60 * 60 * 1000;

      if (mfaVerifiedAt && Date.now() - mfaVerifiedAt > ONE_HOUR) {
        // Re-verification needed for sensitive operations
        if (pathRequiresMfa(req.path, req.method)) {
          return res.status(403).json({
            error: 'MFA re-verification required',
            code: 'MFA_REVERIFICATION_REQUIRED',
            message: 'Your MFA session has expired. Please verify again to continue.',
            challengeRequired: true,
          });
        }
      }

      next();
    } catch (error) {
      log.error('MFA enforcement error:', error);
      res.status(500).json({
        error: 'Failed to verify MFA requirements',
        code: 'MFA_CHECK_FAILED',
      });
    }
  };
}

/**
 * Middleware to require MFA verification for specific actions
 *
 * Usage:
 *   app.post('/api/users/:id/permissions', requireMfaVerification(), handler);
 */
export function requireMfaVerification() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user || req.session?.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Check MFA status
      const mfaStatus = await storage.getUserMfaStatus(user.id);
      if (!mfaStatus?.enabled) {
        return next(); // MFA not enabled, skip verification
      }

      // Require MFA verification
      const session = req.session as any;
      if (!session?.mfaVerified) {
        return res.status(403).json({
          error: 'MFA verification required',
          code: 'MFA_VERIFICATION_REQUIRED',
          message: 'Please verify your identity with MFA to continue.',
          challengeRequired: true,
        });
      }

      next();
    } catch (error) {
      log.error('MFA verification check error:', error);
      res.status(500).json({ error: 'Failed to verify MFA status' });
    }
  };
}

/**
 * Mark session as MFA verified
 */
export function markMfaVerified(session: any): void {
  session.mfaVerified = true;
  session.mfaVerifiedAt = Date.now();
}

/**
 * Clear MFA verification from session
 */
export function clearMfaVerification(session: any): void {
  session.mfaVerified = false;
  session.mfaVerifiedAt = null;
}

/**
 * Parse role string to get hierarchy level
 */
function parseRoleLevel(role: string | undefined): number {
  if (!role) return 0;

  const roleLevelMap: Record<string, number> = {
    guest: 1,
    read_only: 1,
    support: 2,
    standard: 3,
    manager: 4,
    admin: 5,
    super_admin: 6,
    platform_admin: 7,
    // Legacy role names
    viewer: 1,
    user: 3,
    supervisor: 4,
    director: 5,
    executive: 6,
    root: 7,
  };

  return roleLevelMap[role.toLowerCase()] || 0;
}

/**
 * Get users in tenant who need MFA but don't have it enabled
 */
export async function getUsersNeedingMfa(tenantId: string): Promise<
  Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  }>
> {
  const tenantSettings = await getTenantMfaSettings(tenantId);

  const allUsers = await db.select().from(users).where(eq(users.tenantId, tenantId));

  const usersNeedingMfa = [];

  for (const user of allUsers) {
    const userWithRole = await storage.getUserWithRole(user.id);
    if (!userWithRole) continue;

    const userLevel = parseRoleLevel(userWithRole.role);
    const needsMfa = roleRequiresMfa(
      userWithRole.role,
      userLevel,
      tenantSettings.mfaRequiredRoles,
      tenantSettings.mfaRequiredLevel,
    );

    if (needsMfa && !user.twoFactorEnabled) {
      usersNeedingMfa.push({
        id: user.id,
        email: user.email || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        role: userWithRole.role || '',
      });
    }
  }

  return usersNeedingMfa;
}

export default {
  requireMfaForAdmins,
  requireMfaVerification,
  markMfaVerified,
  clearMfaVerification,
  getTenantMfaSettings,
  getUsersNeedingMfa,
  DEFAULT_MFA_REQUIRED_ROLES,
  MFA_REQUIRED_LEVEL,
  MFA_REQUIRED_PATHS,
};
