import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import type { SupabaseUser } from './supabase-auth';

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
          console.log(
            `[TENANT SECURITY] Platform admin accessing tenant ${headerTenantId} (own: ${jwtTenantId})`,
          );
          return next();
        } else {
          // Log the security violation attempt
          console.warn(
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
      // console.log(`[TENANT DEBUG] Using Supabase JWT tenant: ${req.tenantId}`);
      return next();
    }

    // Priority 2: x-tenant-id header (only when no JWT tenant - for API key auth scenarios)
    // Note: API key validation should set req.user.tenantId if authenticated
    if (headerTenantId && headerTenantId.length > 0) {
      // If user is authenticated but has no JWT tenant, validate header against user's DB tenant
      if (req.user?.tenantId && req.user.tenantId !== headerTenantId) {
        const userIsPlatformAdmin =
          req.user?.isPlatformUser || (req.user?.role?.level && req.user.role.level >= 8);
        if (!userIsPlatformAdmin) {
          console.warn(
            `[TENANT SECURITY] User ${req.user?.id} header tenant mismatch: header=${headerTenantId}, user=${req.user.tenantId}`,
          );
          return res.status(403).json({
            error: 'Forbidden',
            message: 'You do not have permission to access this tenant.',
            code: 'TENANT_ACCESS_DENIED',
          });
        }
      }

      req.tenantId = headerTenantId;
      // console.log(`[TENANT DEBUG] Using x-tenant-id header: ${req.tenantId}`);
      return next();
    }

    // Priority 3: User's tenantId (set by isAuthenticated after DB lookup)
    if (req.user?.tenantId) {
      req.tenantId = req.user.tenantId;
      // console.log(`[TENANT DEBUG] Using user tenantId from isAuthenticated: ${req.tenantId}`);
      return next();
    }

    // Priority 4: Already set on request (by isAuthenticated or other middleware)
    if ((req as any).tenantId) {
      // console.log(`[TENANT DEBUG] Using existing req.tenantId: ${(req as any).tenantId}`);
      return next();
    }

    let tenantSlug: string | null = null;
    const host = req.get('host') || '';
    const path = req.path;

    // console.log(`[TENANT DEBUG] Host: ${host}, Path: ${path}`);

    // Priority 5: Subdomain detection (only for production domains)
    if (TENANT_CONFIG.enableSubdomainRouting && host.includes('.printyx.')) {
      const subdomain = host.split('.')[0];
      if (subdomain !== 'www' && subdomain !== 'api' && subdomain.length > 0) {
        tenantSlug = subdomain;
        // console.log(`[TENANT DEBUG] Found subdomain slug: ${tenantSlug}`);
      }
    }

    // Priority 6: Path prefix detection (only if enabled)
    if (!tenantSlug && TENANT_CONFIG.enablePathRouting) {
      const pathSegments = path.split('/').filter((segment) => segment.length > 0);
      if (pathSegments.length > 0 && !pathSegments[0].startsWith('api')) {
        const potentialSlug = pathSegments[0];
        if (potentialSlug !== 'login' && potentialSlug !== 'signup' && potentialSlug !== 'auth') {
          tenantSlug = potentialSlug;
          // console.log(`[TENANT DEBUG] Found path slug: ${tenantSlug}`);
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
      // console.log(`[TENANT DEBUG] Development environment detected, using user tenant or default`);

      if (req.user?.tenantId) {
        req.tenantId = req.user.tenantId;
        // console.log(`[TENANT DEBUG] Using user tenant: ${req.tenantId}`);
      } else if ((req.session as any)?.tenantId) {
        req.tenantId = (req.session as any).tenantId;
        // console.log(`[TENANT DEBUG] Using session tenant: ${req.tenantId}`);
      } else {
        // Default to demo tenant for development
        req.tenantId = process.env.DEMO_TENANT_ID || '550e8400-e29b-41d4-a716-446655440000';
        // console.log(`[TENANT DEBUG] Using default demo tenant: ${req.tenantId}`);
      }

      return next(); // Skip database lookup for development
    }

    // Resolve tenant from database (only for production subdomains/paths)
    if (tenantSlug) {
      const tenant = await storage.getTenantBySlug(tenantSlug);
      if (tenant && tenant.isActive) {
        req.tenant = tenant;
        req.tenantId = tenant.id;
        // console.log(`[TENANT DEBUG] Found tenant in DB: ${tenant.id}`);

        // Store tenant context in session if available
        if (req.session) {
          (req.session as any).tenantId = tenant.id;
          (req.session as any).tenantSlug = tenant.slug;
        }
      } else {
        // console.log(`[TENANT DEBUG] Tenant slug '${tenantSlug}' not found or inactive`);
        return res.status(404).json({
          error: 'Tenant not found',
          message: `The organization "${tenantSlug}" was not found or is inactive.`,
        });
      }
    }

    next();
  } catch (error) {
    console.error('Error resolving tenant:', error);
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
