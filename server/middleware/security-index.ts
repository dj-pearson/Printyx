/**
 * Security Middleware Index
 *
 * Central export point for all security-related middleware.
 * Provides a unified interface for security features.
 */

// MFA Enforcement
export {
  requireMfaForAdmins,
  requireMfaVerification,
  markMfaVerified,
  clearMfaVerification,
  getTenantMfaSettings,
  getUsersNeedingMfa,
  DEFAULT_MFA_REQUIRED_ROLES,
  MFA_REQUIRED_LEVEL,
  MFA_REQUIRED_PATHS,
} from './mfa-enforcement';

// Session Timeout
export {
  enforceSessionTimeout,
  extendSessionOnActivity,
  initializeSession,
  updateSessionActivity,
  isSessionExpired,
  getTimeUntilWarning,
  getSessionConfig,
  logoutOtherSessions,
  cleanupExpiredSessions,
  getActiveSessions,
  terminateSession,
  DEFAULT_SESSION_CONFIG,
} from './session-timeout';

// IP Whitelist
export {
  enforceIpWhitelist,
  getClientIp,
  isIpAllowed,
  getTenantIpConfig,
  clearIpConfigCache,
  validateWhitelistEntries,
  updateTenantIpWhitelist,
  DEFAULT_IP_CONFIG,
} from './ip-whitelist';

// API Versioning
export {
  apiVersioning,
  createVersionedRouter,
  versionedHandler,
  routeAlias,
  legacyRouteSupport,
  apiVersionInfo,
  extractVersion,
  API_VERSIONS,
  VERSION_CONFIG,
  VERSION_HEADERS,
} from './api-versioning';

// Enhanced Validation
export {
  validate,
  validateData,
  schemaRegistry,
  uuidSchema,
  emailSchema,
  phoneSchema,
  urlSchema,
  safeStringSchema,
  positiveIntSchema,
  nonNegativeIntSchema,
  moneySchema,
  dateStringSchema,
  dateRangeSchema,
  paginationSchema,
  searchSchema,
  sortSchema,
  listQuerySchema,
  businessRecordSchemas,
  dealSchemas,
  userSchemas,
  serviceTicketSchemas,
  mfaVerifySchema,
  ipWhitelistEntrySchema,
  apiKeyCreateSchema,
} from './enhanced-validation';

// Re-export types
export type { IpWhitelistConfig } from './ip-whitelist';
export type { ApiVersion } from './api-versioning';

/**
 * Apply all security middleware to an Express app
 *
 * Usage:
 *   import { applySecurityMiddleware } from './middleware/security-index';
 *   applySecurityMiddleware(app, { ... });
 */
import { Application } from 'express';
import { enforceSessionTimeout, extendSessionOnActivity } from './session-timeout';
import { enforceIpWhitelist } from './ip-whitelist';
import { apiVersioning, legacyRouteSupport } from './api-versioning';
import { requireMfaForAdmins } from './mfa-enforcement';

export interface SecurityMiddlewareOptions {
  // Session timeout options
  sessionTimeout?: {
    enabled?: boolean;
    excludePaths?: string[];
  };

  // IP whitelist options
  ipWhitelist?: {
    enabled?: boolean;
    requireWhitelist?: boolean;
    additionalWhitelist?: string[];
  };

  // API versioning options
  apiVersioning?: {
    enabled?: boolean;
    requireVersion?: boolean;
  };

  // MFA enforcement options
  mfaEnforcement?: {
    enabled?: boolean;
    adminPaths?: string[];
  };
}

export function applySecurityMiddleware(
  app: Application,
  options: SecurityMiddlewareOptions = {},
): void {
  const {
    sessionTimeout = { enabled: true },
    ipWhitelist = { enabled: true },
    apiVersioning: versioningOptions = { enabled: true },
    mfaEnforcement = { enabled: true },
  } = options;

  // Session timeout enforcement
  if (sessionTimeout.enabled) {
    app.use(
      enforceSessionTimeout({
        excludePaths: sessionTimeout.excludePaths || ['/api/health', '/api/auth', '/.well-known'],
      }),
    );
    app.use('/api', extendSessionOnActivity());
  }

  // IP whitelist enforcement
  if (ipWhitelist.enabled) {
    app.use(
      enforceIpWhitelist({
        requireWhitelist: ipWhitelist.requireWhitelist,
        additionalWhitelist: ipWhitelist.additionalWhitelist,
      }),
    );
  }

  // API versioning
  if (versioningOptions.enabled) {
    app.use(
      apiVersioning({
        requireVersion: versioningOptions.requireVersion,
      }),
    );
    app.use(
      legacyRouteSupport({
        excludePaths: ['/api/health', '/api/auth', '/api/docs', '/.well-known'],
      }),
    );
  }

  // MFA enforcement for admin routes
  if (mfaEnforcement.enabled) {
    const adminPaths = mfaEnforcement.adminPaths || [
      '/api/root-admin',
      '/api/platform',
      '/api/security',
      '/api/users/bulk',
    ];

    for (const path of adminPaths) {
      app.use(path, requireMfaForAdmins());
    }
  }
}

/**
 * Get security configuration summary
 */
export function getSecurityConfig(): {
  mfa: typeof import('./mfa-enforcement').default;
  session: typeof import('./session-timeout').default;
  ipWhitelist: typeof import('./ip-whitelist').default;
  versioning: typeof import('./api-versioning').default;
  validation: typeof import('./enhanced-validation').default;
} {
  return {
    mfa: require('./mfa-enforcement').default,
    session: require('./session-timeout').default,
    ipWhitelist: require('./ip-whitelist').default,
    versioning: require('./api-versioning').default,
    validation: require('./enhanced-validation').default,
  };
}

export default {
  applySecurityMiddleware,
  getSecurityConfig,
};
