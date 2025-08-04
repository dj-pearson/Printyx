/**
 * Enhanced tenant middleware that checks for existence of tenant table
 */
import { Request, Response, NextFunction } from 'express';
import { TenantRequest } from './tenancy';

/**
 * Middleware that requires a tenant to be resolved
 * Returns 401 if no tenant is found
 */
export const requireTenant = (req: TenantRequest, res: Response, next: NextFunction) => {
  if (!req.tenantId) {
    return res.status(401).json({ 
      message: "Tenant identification required",
      code: "TENANT_REQUIRED"
    });
  }
  
  next();
};