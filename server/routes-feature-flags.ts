/**
 * Feature Flags Routes
 * US-035: CRUD endpoints for feature flag management.
 *
 * GET  /api/feature-flags          - List all flags (resolved for current user)
 * GET  /api/feature-flags/raw      - List raw flag records (platform admin)
 * GET  /api/feature-flags/:name    - Get single flag
 * POST /api/feature-flags          - Create flag (platform admin)
 * PUT  /api/feature-flags/:name    - Update flag (platform admin)
 */

import type { Express, Request, Response } from 'express';
import { requireAuth } from './replitAuth';
import { isPlatformAdmin } from './utils/auth-helpers';
import { getUserId, getTenantId } from './utils/auth-helpers';
import featureFlagsService from './services/feature-flags-service';
import { createModuleLogger } from './lib/logger';

const log = createModuleLogger('routes-feature-flags');

export function registerFeatureFlagRoutes(app: Express): void {
  /**
   * GET /api/feature-flags
   * Returns all flags with resolved boolean state for the current user/tenant.
   */
  app.get('/api/feature-flags', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req) ?? undefined;
      const tenantId = getTenantId(req) ?? undefined;

      const flags = await featureFlagsService.getAllFlags({ userId, tenantId });
      res.json(flags);
    } catch (error) {
      log.error('Failed to get feature flags:', error);
      res.status(500).json({ message: 'Failed to retrieve feature flags' });
    }
  });

  /**
   * GET /api/feature-flags/raw
   * Returns raw flag records. Platform admin only.
   */
  app.get('/api/feature-flags/raw', requireAuth, async (req: Request, res: Response) => {
    if (!isPlatformAdmin(req)) {
      res.status(403).json({ message: 'Platform admin access required' });
      return;
    }

    try {
      const flags = await featureFlagsService.listFlags();
      res.json(flags);
    } catch (error) {
      log.error('Failed to list raw feature flags:', error);
      res.status(500).json({ message: 'Failed to retrieve feature flags' });
    }
  });

  /**
   * GET /api/feature-flags/:name
   * Returns a single flag by name.
   */
  app.get('/api/feature-flags/:name', requireAuth, async (req: Request, res: Response) => {
    try {
      const flag = await featureFlagsService.getFlag(req.params.name);
      if (!flag) {
        res.status(404).json({ message: 'Feature flag not found' });
        return;
      }
      res.json(flag);
    } catch (error) {
      log.error('Failed to get feature flag:', error);
      res.status(500).json({ message: 'Failed to retrieve feature flag' });
    }
  });

  /**
   * POST /api/feature-flags
   * Create a new feature flag. Platform admin only.
   */
  app.post('/api/feature-flags', requireAuth, async (req: Request, res: Response) => {
    if (!isPlatformAdmin(req)) {
      res.status(403).json({ message: 'Platform admin access required' });
      return;
    }

    const { name, description, enabled, rolloutPercentage, tenantOverrides } = req.body;

    if (!name || typeof name !== 'string') {
      res.status(400).json({ message: 'Flag name is required' });
      return;
    }

    // Check for duplicate
    const existing = await featureFlagsService.getFlag(name);
    if (existing) {
      res.status(409).json({ message: `Feature flag "${name}" already exists` });
      return;
    }

    try {
      const flag = await featureFlagsService.createFlag({
        name,
        description,
        enabled,
        rolloutPercentage,
        tenantOverrides,
      });
      res.status(201).json(flag);
    } catch (error) {
      log.error('Failed to create feature flag:', error);
      res.status(500).json({ message: 'Failed to create feature flag' });
    }
  });

  /**
   * PUT /api/feature-flags/:name
   * Update a feature flag. Platform admin only.
   */
  app.put('/api/feature-flags/:name', requireAuth, async (req: Request, res: Response) => {
    if (!isPlatformAdmin(req)) {
      res.status(403).json({ message: 'Platform admin access required' });
      return;
    }

    const { enabled, description, rolloutPercentage, tenantOverrides } = req.body;

    try {
      const updated = await featureFlagsService.updateFlag(req.params.name, {
        enabled,
        description,
        rolloutPercentage,
        tenantOverrides,
      });

      if (!updated) {
        res.status(404).json({ message: 'Feature flag not found' });
        return;
      }

      res.json(updated);
    } catch (error) {
      log.error('Failed to update feature flag:', error);
      res.status(500).json({ message: 'Failed to update feature flag' });
    }
  });

  log.info('Feature flag routes registered');
}
