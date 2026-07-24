/**
 * Data Retention admin routes.
 *
 * Exposes the (previously uncalled) data-retention engine so an administrator
 * can seed default policies, view metrics, and trigger a run. Scheduled
 * enforcement runs daily from CronService in REPORT-ONLY mode by default;
 * destructive purge is gated behind DATA_RETENTION_PURGE_ENABLED. Manual runs
 * here are dry-run unless the same env flag is enabled AND the caller opts in.
 */

import type { Express, Request, Response } from 'express';
import { requireAuth } from './replitAuth';
import { getUserId, getTenantId, isPlatformAdmin } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';
import {
  listRetentionPolicies,
  getRetentionMetrics,
  initializeDefaultPolicies,
  runScheduledRetention,
} from './services/data-retention-service';

const log = createModuleLogger('data-retention');

const purgeEnabled = () => process.env.DATA_RETENTION_PURGE_ENABLED === 'true';

export function registerDataRetentionRoutes(app: Express) {
  // List this tenant's retention policies.
  app.get('/api/data-retention/policies', requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });
      if (!isPlatformAdmin(req))
        return res.status(403).json({ message: 'Admin privileges required' });

      const { data: policies, total } = await listRetentionPolicies(tenantId);
      res.json({ policies, total, purgeEnabled: purgeEnabled() });
    } catch (error) {
      log.error('Error listing retention policies:', error);
      res.status(500).json({ message: 'Failed to list retention policies' });
    }
  });

  // Retention metrics + upcoming purges for this tenant.
  app.get('/api/data-retention/metrics', requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(401).json({ message: 'Authentication required' });
      if (!isPlatformAdmin(req))
        return res.status(403).json({ message: 'Admin privileges required' });

      const metrics = await getRetentionMetrics(tenantId);
      res.json({ ...metrics, purgeEnabled: purgeEnabled() });
    } catch (error) {
      log.error('Error fetching retention metrics:', error);
      res.status(500).json({ message: 'Failed to fetch retention metrics' });
    }
  });

  // Seed the sensible default retention policies for this tenant.
  app.post(
    '/api/data-retention/initialize-defaults',
    requireAuth,
    async (req: Request, res: Response) => {
      try {
        const userId = getUserId(req);
        const tenantId = getTenantId(req);
        if (!userId || !tenantId)
          return res.status(401).json({ message: 'Authentication required' });
        if (!isPlatformAdmin(req))
          return res.status(403).json({ message: 'Admin privileges required' });

        const policies = await initializeDefaultPolicies(tenantId, userId);
        res.status(201).json({ message: 'Default retention policies created', policies });
      } catch (error) {
        log.error('Error initializing default retention policies:', error);
        res.status(500).json({ message: 'Failed to initialize default policies' });
      }
    },
  );

  // Manually trigger a retention run. Dry-run unless purge is enabled AND the
  // caller explicitly passes { dryRun: false }.
  app.post('/api/data-retention/run', requireAuth, async (req: Request, res: Response) => {
    try {
      if (!isPlatformAdmin(req))
        return res.status(403).json({ message: 'Admin privileges required' });

      const requestedDryRun = req.body?.dryRun !== false;
      const dryRun = requestedDryRun || !purgeEnabled();
      const result = await runScheduledRetention(dryRun);
      res.json({
        ...result,
        note: dryRun ? 'Report-only run; no records were deleted.' : 'Destructive purge executed.',
      });
    } catch (error) {
      log.error('Error running retention:', error);
      res.status(500).json({ message: 'Failed to run retention' });
    }
  });

  log.info('Data retention admin routes registered');
}
