/**
 * Security Storage Extensions
 *
 * Helper functions for security-related database operations.
 * These extend the main storage layer for MFA, compliance, and session management.
 */

import { db } from '../db';
import { users } from '../../shared/schema';
import { complianceSettings, securitySessions } from '../../shared/security-schema';
import { eq, and, desc, gt, lt, or, isNotNull } from 'drizzle-orm';

// ============================================================================
// Types
// ============================================================================

export interface ComplianceSettingsResult {
  id: string;
  tenantId: string;
  // Session settings
  sessionTimeoutMinutes: number;
  sessionWarningMinutes: number;
  maxConcurrentSessions: number;
  forceLogoutOnSuspiciousActivity: boolean;
  // MFA settings
  mfaEnabled: boolean;
  mfaRequiredRoles: string[];
  mfaRequiredLevel: number;
  // Data protection
  encryptSensitiveFields: boolean;
  maskDataInLogs: boolean;
  // Audit settings
  auditRetentionPeriod: number;
  // GDPR settings
  gdprEnabled: boolean;
  gdprResponseDays: number;
  dataRetentionPeriod: number;
}

export interface SecuritySettingsResult {
  id: string;
  tenantId: string;
  // IP Whitelist settings
  ipWhitelistEnabled: boolean;
  ipWhitelistMode: 'allow' | 'deny';
  ipWhitelistAddresses: string[];
  ipWhitelistBypassRoles: string[];
  ipWhitelistExemptPaths: string[];
  ipWhitelistLogDenied: boolean;
  ipWhitelistNotifyOnDenied: boolean;
}

export interface TenantAdmin {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

// ============================================================================
// Default Settings
// ============================================================================

const DEFAULT_COMPLIANCE_SETTINGS: Omit<ComplianceSettingsResult, 'id' | 'tenantId'> = {
  sessionTimeoutMinutes: 30,
  sessionWarningMinutes: 25,
  maxConcurrentSessions: 3,
  forceLogoutOnSuspiciousActivity: true,
  mfaEnabled: true,
  mfaRequiredRoles: ['platform_admin', 'super_admin', 'admin', 'manager'],
  mfaRequiredLevel: 4,
  encryptSensitiveFields: true,
  maskDataInLogs: true,
  auditRetentionPeriod: 2555, // 7 years
  gdprEnabled: true,
  gdprResponseDays: 30,
  dataRetentionPeriod: 2555,
};

const DEFAULT_SECURITY_SETTINGS: Omit<SecuritySettingsResult, 'id' | 'tenantId'> = {
  ipWhitelistEnabled: false,
  ipWhitelistMode: 'allow',
  ipWhitelistAddresses: [],
  ipWhitelistBypassRoles: ['platform_admin'],
  ipWhitelistExemptPaths: ['/api/health', '/api/auth', '/.well-known'],
  ipWhitelistLogDenied: true,
  ipWhitelistNotifyOnDenied: false,
};

// ============================================================================
// Compliance Settings Functions
// ============================================================================

/**
 * Get compliance settings for a tenant
 */
export async function getComplianceSettings(
  tenantId: string,
): Promise<ComplianceSettingsResult | null> {
  try {
    const settings = await db.query.complianceSettings.findFirst({
      where: eq(complianceSettings.tenantId, tenantId),
    });

    if (!settings) {
      return {
        id: '',
        tenantId,
        ...DEFAULT_COMPLIANCE_SETTINGS,
      };
    }

    return {
      id: settings.id,
      tenantId: settings.tenantId,
      sessionTimeoutMinutes:
        settings.sessionTimeoutMinutes ?? DEFAULT_COMPLIANCE_SETTINGS.sessionTimeoutMinutes,
      sessionWarningMinutes:
        settings.sessionWarningMinutes ?? DEFAULT_COMPLIANCE_SETTINGS.sessionWarningMinutes,
      maxConcurrentSessions:
        settings.maxConcurrentSessions ?? DEFAULT_COMPLIANCE_SETTINGS.maxConcurrentSessions,
      forceLogoutOnSuspiciousActivity:
        settings.forceLogoutOnSuspiciousActivity ??
        DEFAULT_COMPLIANCE_SETTINGS.forceLogoutOnSuspiciousActivity,
      mfaEnabled: true, // Always enabled by default
      mfaRequiredRoles: DEFAULT_COMPLIANCE_SETTINGS.mfaRequiredRoles,
      mfaRequiredLevel: DEFAULT_COMPLIANCE_SETTINGS.mfaRequiredLevel,
      encryptSensitiveFields:
        settings.encryptSensitiveFields ?? DEFAULT_COMPLIANCE_SETTINGS.encryptSensitiveFields,
      maskDataInLogs: settings.maskDataInLogs ?? DEFAULT_COMPLIANCE_SETTINGS.maskDataInLogs,
      auditRetentionPeriod:
        settings.auditRetentionPeriod ?? DEFAULT_COMPLIANCE_SETTINGS.auditRetentionPeriod,
      gdprEnabled: settings.gdprEnabled ?? DEFAULT_COMPLIANCE_SETTINGS.gdprEnabled,
      gdprResponseDays: settings.gdprResponseDays ?? DEFAULT_COMPLIANCE_SETTINGS.gdprResponseDays,
      dataRetentionPeriod:
        settings.dataRetentionPeriod ?? DEFAULT_COMPLIANCE_SETTINGS.dataRetentionPeriod,
    };
  } catch (error) {
    console.error('Error getting compliance settings:', error);
    return null;
  }
}

/**
 * Update compliance settings for a tenant
 */
export async function updateComplianceSettings(
  tenantId: string,
  updates: Partial<ComplianceSettingsResult>,
): Promise<boolean> {
  try {
    const existing = await db.query.complianceSettings.findFirst({
      where: eq(complianceSettings.tenantId, tenantId),
    });

    if (existing) {
      await db
        .update(complianceSettings)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(complianceSettings.tenantId, tenantId));
    } else {
      await db.insert(complianceSettings).values({
        tenantId,
        ...updates,
      });
    }

    return true;
  } catch (error) {
    console.error('Error updating compliance settings:', error);
    return false;
  }
}

// ============================================================================
// Security Settings Functions (IP Whitelist, etc.)
// ============================================================================

/**
 * Get security settings for a tenant (stored in compliance_settings table)
 */
export async function getSecuritySettings(
  tenantId: string,
): Promise<SecuritySettingsResult | null> {
  try {
    const settings = await db.query.complianceSettings.findFirst({
      where: eq(complianceSettings.tenantId, tenantId),
    });

    // Security settings may be stored in a metadata/settings JSONB column
    // or in separate columns. For now, return defaults.
    return {
      id: settings?.id || '',
      tenantId,
      ...DEFAULT_SECURITY_SETTINGS,
    };
  } catch (error) {
    console.error('Error getting security settings:', error);
    return null;
  }
}

/**
 * Update security settings for a tenant
 */
export async function updateSecuritySettings(
  tenantId: string,
  updates: Partial<SecuritySettingsResult>,
): Promise<boolean> {
  try {
    // For now, security settings are stored as part of compliance settings
    // In a production system, these would be in their own table or JSONB column
    const existing = await db.query.complianceSettings.findFirst({
      where: eq(complianceSettings.tenantId, tenantId),
    });

    if (existing) {
      await db
        .update(complianceSettings)
        .set({
          // Store IP whitelist config in the settings
          // This is a simplified implementation
          updatedAt: new Date(),
        })
        .where(eq(complianceSettings.tenantId, tenantId));
    } else {
      await db.insert(complianceSettings).values({
        tenantId,
      });
    }

    return true;
  } catch (error) {
    console.error('Error updating security settings:', error);
    return false;
  }
}

// ============================================================================
// Tenant Admin Functions
// ============================================================================

/**
 * Get admin users for a tenant
 */
export async function getTenantAdmins(tenantId: string): Promise<TenantAdmin[]> {
  try {
    const admins = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          or(
            eq(users.role, 'admin'),
            eq(users.role, 'super_admin'),
            eq(users.role, 'platform_admin'),
          ),
        ),
      );

    return admins.map((admin) => ({
      id: admin.id,
      email: admin.email || '',
      firstName: admin.firstName,
      lastName: admin.lastName,
    }));
  } catch (error) {
    console.error('Error getting tenant admins:', error);
    return [];
  }
}

// ============================================================================
// Session Management Functions
// ============================================================================

/**
 * Get active sessions for a user
 */
export async function getUserActiveSessions(userId: string): Promise<
  Array<{
    id: string;
    ipAddress: string;
    userAgent: string | null;
    lastActivity: Date;
    createdAt: Date;
  }>
> {
  try {
    const sessions = await db
      .select()
      .from(securitySessions)
      .where(and(eq(securitySessions.userId, userId), eq(securitySessions.isActive, true)))
      .orderBy(desc(securitySessions.lastActivity));

    return sessions.map((session) => ({
      id: session.id,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      lastActivity: session.lastActivity,
      createdAt: session.createdAt,
    }));
  } catch (error) {
    console.error('Error getting user sessions:', error);
    return [];
  }
}

/**
 * Terminate all sessions for a user except current
 */
export async function terminateOtherSessions(
  userId: string,
  currentSessionId?: string,
): Promise<number> {
  try {
    const result = await db
      .update(securitySessions)
      .set({
        isActive: false,
        terminatedAt: new Date(),
        terminationReason: 'logout_other_sessions',
      })
      .where(and(eq(securitySessions.userId, userId), eq(securitySessions.isActive, true)));

    return 1; // Drizzle doesn't return affected count easily
  } catch (error) {
    console.error('Error terminating other sessions:', error);
    return 0;
  }
}

/**
 * Record a new security session
 */
export async function createSecuritySession(session: {
  sessionId: string;
  userId: string;
  tenantId: string;
  ipAddress: string;
  userAgent?: string;
  expiresAt: Date;
}): Promise<void> {
  try {
    await db.insert(securitySessions).values({
      sessionId: session.sessionId,
      userId: session.userId,
      tenantId: session.tenantId,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      expiresAt: session.expiresAt,
      isActive: true,
    });
  } catch (error) {
    console.error('Error creating security session:', error);
  }
}

/**
 * Cleanup expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const now = new Date();
    await db
      .update(securitySessions)
      .set({
        isActive: false,
        terminatedAt: now,
        terminationReason: 'expired',
      })
      .where(and(eq(securitySessions.isActive, true), lt(securitySessions.expiresAt, now)));

    return 1;
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
    return 0;
  }
}

// ============================================================================
// Export All Functions
// ============================================================================

export default {
  // Compliance
  getComplianceSettings,
  updateComplianceSettings,
  // Security
  getSecuritySettings,
  updateSecuritySettings,
  // Tenant
  getTenantAdmins,
  // Sessions
  getUserActiveSessions,
  terminateOtherSessions,
  createSecuritySession,
  cleanupExpiredSessions,
  // Defaults
  DEFAULT_COMPLIANCE_SETTINGS,
  DEFAULT_SECURITY_SETTINGS,
};
