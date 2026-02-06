import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import type { SupabaseUser } from './supabase-auth';
import { isPlatformAdmin, getUserId } from '../utils/auth-helpers';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('tenancy');

export interface TenantRequest extends Request {
  tenant?: {
    id: string;
    name: string;
    slug: string;
    subdomainPrefix?: string;
    pathPrefix?: string;
  };
  tenantId?: string;
  user?: any;
  supabaseUser?: SupabaseUser;
}

/**
 * Security: Log tenant context mismatches for audit trail
 */
function logTenantSecurityEvent(
  eventType: 'TENANT_MISMATCH' | 'CROSS_TENANT_ACCESS' | 'ADMIN_BYPASS',
  details: {
    userId?: string;
    requestedTenantId: string;
    userTenantId?: string;
    isAdmin: boolean;
    path: string;
    method: string;
    ip?: string;
  },
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event: eventType,
    ...details,
  };

  if (eventType === 'TENANT_MISMATCH') {
    log.warn('[SECURITY] Tenant mismatch attempt:', JSON.stringify(logEntry));
  } else if (eventType === 'ADMIN_BYPASS') {
    console.info('[SECURITY] Admin cross-tenant access:', JSON.stringify(logEntry));
  } else {
    console.info('[SECURITY] Tenant event:', JSON.stringify(logEntry));
  }
}

/**
 * Validate that the x-tenant-id header matches the user's assigned tenant.
 * Platform admins can access any tenant.
 * Returns the validated tenant ID or null if validation fails.
 */
function validateTenantHeader(
  req: TenantRequest,
  headerTenantId: string,
): { valid: boolean; tenantId?: string; reason?: string } {
  const userTenantId = req.supabaseUser?.tenantId || req.user?.tenantId;
  const userId = getUserId(req as Request);
  const isAdmin = isPlatformAdmin(req as Request);

  // If user is not authenticated, allow the header (public endpoints)
  if (!userId) {
    return { valid: true, tenantId: headerTenantId };
  }

  // Platform admins can access any tenant
  if (isAdmin) {
    logTenantSecurityEvent('ADMIN_BYPASS', {
      userId,
      requestedTenantId: headerTenantId,
      userTenantId,
      isAdmin: true,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    return { valid: true, tenantId: headerTenantId };
  }

  // If user has no tenant assigned (unusual), reject cross-tenant access
  if (!userTenantId) {
    return {
      valid: false,
      reason: 'User has no assigned tenant',
    };
  }

  // Validate header matches user's assigned tenant
  if (headerTenantId !== userTenantId) {
    logTenantSecurityEvent('TENANT_MISMATCH', {
      userId,
      requestedTenantId: headerTenantId,
      userTenantId,
      isAdmin: false,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    return {
      valid: false,
      reason: 'Tenant ID mismatch - access denied',
    };
  }

  return { valid: true, tenantId: headerTenantId };
}

// Configuration for tenant routing
const TENANT_CONFIG = {
  enableSubdomainRouting: true, // Primary method: xyz-company.printyx.net
  enablePathRouting: false, // Secondary method: printyx.net/xyz-company (disabled by default)
  isDevelopment: process.env.NODE_ENV === 'development',
};

/**
 * Middleware to resolve tenant from multiple sources
 * Priority order:
 * 1. Supabase JWT app_metadata.tenantId (highest priority)
 * 2. x-tenant-id header (for self-hosted/API scenarios)
 * 3. req.user.tenantId (set by isAuthenticated after DB lookup)
 * 4. Already set req.tenantId (by isAuthenticated or other middleware)
 * 5. Subdomain: xyz-company.printyx.net
 * 6. Path prefix: printyx.net/xyz-company/... (if enabled)
 * 7. Session/default fallback (development)
 */
export const resolveTenant = async (req: TenantRequest, res: Response, next: NextFunction) => {
  try {
    // Priority 1: Supabase JWT tenant (from supabase-auth middleware)
    const jwtTenantId = req.supabaseUser?.tenantId;
    const headerTenantId = req.get('x-tenant-id');
    const isPlatformAdmin =
      req.supabaseUser?.isPlatformUser ||
      (req.supabaseUser?.roleLevel && req.supabaseUser.roleLevel >= 8);

    if (jwtTenantId) {
      // Security: If JWT has a tenant, validate x-tenant-id header against it
      if (headerTenantId && headerTenantId !== jwtTenantId) {
        // Only platform admins can access different tenants via header
        if (isPlatformAdmin) {
          req.tenantId = headerTenantId;
          log.info(
            `[TENANT SECURITY] Platform admin accessing tenant ${headerTenantId} (own: ${jwtTenantId})`,
          );
          return next();
        } else {
          // Log the security violation attempt
          log.warn(
            `[TENANT SECURITY] User ${req.supabaseUser?.id} attempted tenant override: header=${headerTenantId}, jwt=${jwtTenantId}`,
          );
          return res.status(403).json({
            error: 'Forbidden',
            message: 'You do not have permission to access this tenant.',
            code: 'TENANT_ACCESS_DENIED',
          });
        }
      }

      req.tenantId = jwtTenantId;
      // log.info(`[TENANT DEBUG] Using Supabase JWT tenant: ${req.tenantId}`);
      return next();
    }

    // Priority 2: x-tenant-id header (for self-hosted and API scenarios)
    // SECURITY: Validate header against user's JWT tenant to prevent cross-tenant access
    if (headerTenantId && headerTenantId.length > 0) {
      const validation = validateTenantHeader(req, headerTenantId);

      if (!validation.valid) {
        return res.status(403).json({
          error: 'Forbidden',
          message: validation.reason || 'Cross-tenant access denied',
          code: 'TENANT_ACCESS_DENIED',
        });
      }

      req.tenantId = validation.tenantId;
      // log.info(`[TENANT DEBUG] Using validated x-tenant-id header: ${req.tenantId}`);
      return next();
    }

    // Priority 3: User's tenantId (set by isAuthenticated after DB lookup)
    if (req.user?.tenantId) {
      req.tenantId = req.user.tenantId;
      // log.info(`[TENANT DEBUG] Using user tenantId from isAuthenticated: ${req.tenantId}`);
      return next();
    }

    // Priority 4: Already set on request (by isAuthenticated or other middleware)
    if ((req as any).tenantId) {
      // log.info(`[TENANT DEBUG] Using existing req.tenantId: ${(req as any).tenantId}`);
      return next();
    }

    let tenantSlug: string | null = null;
    const host = req.get('host') || '';
    const path = req.path;

    // log.info(`[TENANT DEBUG] Host: ${host}, Path: ${path}`);

    // Priority 5: Subdomain detection (only for production domains)
    if (TENANT_CONFIG.enableSubdomainRouting && host.includes('.printyx.')) {
      const subdomain = host.split('.')[0];
      if (subdomain !== 'www' && subdomain !== 'api' && subdomain.length > 0) {
        tenantSlug = subdomain;
        // log.info(`[TENANT DEBUG] Found subdomain slug: ${tenantSlug}`);
      }
    }

    // Priority 6: Path prefix detection (only if enabled)
    if (!tenantSlug && TENANT_CONFIG.enablePathRouting) {
      const pathSegments = path.split('/').filter((segment) => segment.length > 0);
      if (pathSegments.length > 0 && !pathSegments[0].startsWith('api')) {
        const potentialSlug = pathSegments[0];
        if (potentialSlug !== 'login' && potentialSlug !== 'signup' && potentialSlug !== 'auth') {
          tenantSlug = potentialSlug;
          // log.info(`[TENANT DEBUG] Found path slug: ${tenantSlug}`);
        }
      }
    }

    // Priority 7: Development fallback (localhost/replit.dev)
    if (
      !tenantSlug &&
      (host.includes('localhost') ||
        host.includes('replit.dev') ||
        host.includes('kirk.replit.dev'))
    ) {
      // log.info(`[TENANT DEBUG] Development environment detected, using user tenant or default`);

      if (req.user?.tenantId) {
        req.tenantId = req.user.tenantId;
        // log.info(`[TENANT DEBUG] Using user tenant: ${req.tenantId}`);
      } else if ((req.session as any)?.tenantId) {
        req.tenantId = (req.session as any).tenantId;
        // log.info(`[TENANT DEBUG] Using session tenant: ${req.tenantId}`);
      } else {
        // Default to demo tenant for development
        req.tenantId = process.env.DEMO_TENANT_ID || '550e8400-e29b-41d4-a716-446655440000';
        // log.info(`[TENANT DEBUG] Using default demo tenant: ${req.tenantId}`);
      }

      return next(); // Skip database lookup for development
    }

    // Resolve tenant from database (only for production subdomains/paths)
    if (tenantSlug) {
      const tenant = await storage.getTenantBySlug(tenantSlug);
      if (tenant && tenant.isActive) {
        req.tenant = tenant;
        req.tenantId = tenant.id;
        // log.info(`[TENANT DEBUG] Found tenant in DB: ${tenant.id}`);

        // Store tenant context in session if available
        if (req.session) {
          (req.session as any).tenantId = tenant.id;
          (req.session as any).tenantSlug = tenant.slug;
        }
      } else {
        // log.info(`[TENANT DEBUG] Tenant slug '${tenantSlug}' not found or inactive`);
        return res.status(404).json({
          error: 'Tenant not found',
          message: `The organization "${tenantSlug}" was not found or is inactive.`,
        });
      }
    }

    next();
  } catch (error) {
    log.error('Error resolving tenant:', error);
    next(error);
  }
};

/**
 * Middleware to ensure tenant context exists
 */
export const requireTenant = (req: TenantRequest, res: Response, next: NextFunction) => {
  if (!req.tenant && !req.tenantId) {
    return res.status(400).json({
      error: 'Tenant required',
      message:
        'This endpoint requires a valid tenant context. Please access via subdomain or tenant path.',
    });
  }
  next();
};

/**
 * Generate tenant URLs prioritizing subdomain method
 */
export const generateTenantUrls = (tenantSlug: string, baseDomain: string = 'printyx.net') => {
  const urls: any = {
    primary: `https://${tenantSlug}.${baseDomain}`, // Subdomain is primary
    // For development
    primaryDev: `https://${tenantSlug}.replit.dev`,
  };

  // Only include path-based if enabled
  if (TENANT_CONFIG.enablePathRouting) {
    urls.secondary = `https://${baseDomain}/${tenantSlug}`;
    urls.secondaryDev = `https://replit.dev/${tenantSlug}`;
  }

  return urls;
};

/**
 * Toggle tenant routing methods (for admin configuration)
 */
export const updateTenantConfig = (config: Partial<typeof TENANT_CONFIG>) => {
  Object.assign(TENANT_CONFIG, config);
};

/**
 * Utility to create URL-safe slug from company name
 */
export const createSlugFromName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
};
