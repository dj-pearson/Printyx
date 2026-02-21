/**
 * Feature Flag Middleware
 * US-035: Route-level feature flag gating.
 *
 * Usage:
 *   app.get('/api/beta', requireFeatureFlag('beta_feature'), handler);
 */

import type { Request, Response, NextFunction } from 'express';
import { isEnabled } from '../services/feature-flags-service';
import { getUserId, getTenantId } from '../utils/auth-helpers';

/**
 * Middleware factory that gates a route behind a feature flag.
 * Returns 404 if the flag is disabled for the requesting user/tenant.
 */
export function requireFeatureFlag(flagName: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getUserId(req) ?? undefined;
      const tenantId = getTenantId(req) ?? undefined;

      const enabled = await isEnabled(flagName, { userId, tenantId });

      if (!enabled) {
        res.status(404).json({ message: 'Not found' });
        return;
      }

      next();
    } catch {
      // On error, fail closed (deny access)
      res.status(404).json({ message: 'Not found' });
    }
  };
}
