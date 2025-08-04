import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

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
}

// Configuration for tenant routing
const TENANT_CONFIG = {
  enableSubdomainRouting: true,    // Primary method: xyz-company.printyx.net
  enablePathRouting: false,        // Secondary method: printyx.net/xyz-company (disabled by default)
  isDevelopment: process.env.NODE_ENV === 'development'
};

/**
 * Middleware to resolve tenant primarily from subdomain
 * Primary: xyz-company.printyx.net (subdomain)
 * Fallback: printyx.net/xyz-company/... (path-based, if enabled)
 */
export const resolveTenant = async (req: TenantRequest, res: Response, next: NextFunction) => {
  try {
    let tenantSlug: string | null = null;
    const host = req.get('host') || '';
    const path = req.path;

    // console.log(`[TENANT DEBUG] Host: ${host}, Path: ${path}`);

    // Method 1: Subdomain detection (Primary - only for production domains)
    if (TENANT_CONFIG.enableSubdomainRouting && host.includes('.printyx.')) {
      const subdomain = host.split('.')[0];
      if (subdomain !== 'www' && subdomain !== 'api' && subdomain.length > 0) {
        tenantSlug = subdomain;
        // console.log(`[TENANT DEBUG] Found subdomain slug: ${tenantSlug}`);
      }
    }

    // Method 2: Path prefix detection (Secondary - only if enabled)
    if (!tenantSlug && TENANT_CONFIG.enablePathRouting) {
      const pathSegments = path.split('/').filter(segment => segment.length > 0);
      if (pathSegments.length > 0 && !pathSegments[0].startsWith('api')) {
        const potentialSlug = pathSegments[0];
        if (potentialSlug !== 'login' && potentialSlug !== 'signup' && potentialSlug !== 'auth') {
          tenantSlug = potentialSlug;
          // console.log(`[TENANT DEBUG] Found path slug: ${tenantSlug}`);
        }
      }
    }

    // For development (localhost/replit.dev/kirk.replit.dev), skip tenant slug resolution and use defaults
    if (!tenantSlug && (host.includes('localhost') || host.includes('replit.dev') || host.includes('kirk.replit.dev'))) {
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
          message: `The organization "${tenantSlug}" was not found or is inactive.`
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
      message: 'This endpoint requires a valid tenant context. Please access via subdomain or tenant path.'
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