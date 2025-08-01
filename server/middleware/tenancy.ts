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
}

/**
 * Middleware to resolve tenant from subdomain or path
 * Supports:
 * - xyz-company.printyx.net (subdomain)
 * - printyx.net/xyz-company/... (path-based)
 */
export const resolveTenant = async (req: TenantRequest, res: Response, next: NextFunction) => {
  try {
    let tenantSlug: string | null = null;
    const host = req.get('host') || '';
    const path = req.path;

    // Method 1: Subdomain detection (xyz-company.printyx.net)
    if (host.includes('.printyx.') || host.includes('.replit.')) {
      const subdomain = host.split('.')[0];
      if (subdomain !== 'www' && subdomain !== 'api' && subdomain.length > 0) {
        tenantSlug = subdomain;
      }
    }

    // Method 2: Path prefix detection (/xyz-company/...)
    if (!tenantSlug) {
      const pathSegments = path.split('/').filter(segment => segment.length > 0);
      if (pathSegments.length > 0 && !pathSegments[0].startsWith('api')) {
        // Check if first segment is a tenant slug
        const potentialSlug = pathSegments[0];
        if (potentialSlug !== 'login' && potentialSlug !== 'signup' && potentialSlug !== 'auth') {
          tenantSlug = potentialSlug;
        }
      }
    }

    // Resolve tenant from database
    if (tenantSlug) {
      const tenant = await storage.getTenantBySlug(tenantSlug);
      if (tenant && tenant.isActive) {
        req.tenant = tenant;
        req.tenantId = tenant.id;
        
        // Store tenant context in session if available
        if (req.session) {
          req.session.tenantId = tenant.id;
          req.session.tenantSlug = tenant.slug;
        }
      } else {
        // Invalid tenant slug - return 404
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
 * Generate tenant URLs for different routing methods
 */
export const generateTenantUrls = (tenantSlug: string, baseDomain: string = 'printyx.net') => {
  return {
    subdomain: `https://${tenantSlug}.${baseDomain}`,
    pathBased: `https://${baseDomain}/${tenantSlug}`,
    // For development
    subdomainDev: `https://${tenantSlug}.replit.dev`,
    pathBasedDev: `https://replit.dev/${tenantSlug}`
  };
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