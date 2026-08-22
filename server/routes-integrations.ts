import type { Express } from 'express';
import { storage } from './storage';
import { isAuthenticated } from './replitAuth';
import { insertSystemIntegrationSchema } from '@shared/schema';
import { NotFoundError } from './lib/api-errors';

import { getUserId, getTenantId } from './utils/auth-helpers';
// System integrations routes using real database data
export function registerIntegrationRoutes(app: Express) {
  // Get all integrations
  app.get('/api/integrations', isAuthenticated, async (req: any, res, next) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) {
        return res.status(401).json({ message: 'Tenant context required' });
      }
      const integrations = await storage.getSystemIntegrations(tenantId);
      res.json(integrations);
    } catch (error) {
      next(error);
    }
  });

  // Create new integration (ZodError caught by global error handler)
  app.post('/api/integrations', isAuthenticated, async (req: any, res, next) => {
    try {
      const tenantId = req.user?.tenantId;

      const validatedData = insertSystemIntegrationSchema.parse({
        ...req.body,
        tenantId,
      });

      const integration = await storage.createSystemIntegration(validatedData);
      res.status(201).json(integration);
    } catch (error) {
      next(error);
    }
  });

  // Update integration
  app.put('/api/integrations/:id', isAuthenticated, async (req: any, res, next) => {
    try {
      const tenantId = req.user?.tenantId;
      const integrationId = req.params.id;

      const integration = await storage.updateSystemIntegration(integrationId, req.body, tenantId);

      if (!integration) {
        throw new NotFoundError('Integration');
      }

      res.json(integration);
    } catch (error) {
      next(error);
    }
  });

  // Test integration connection
  app.post('/api/integrations/:id/test', isAuthenticated, async (req: any, res, next) => {
    try {
      const tenantId = req.user?.tenantId;
      const integrationId = req.params.id;

      // Mock connection test for now - would implement actual testing logic
      const integration = await storage.updateSystemIntegration(
        integrationId,
        {
          status: 'connected',
          lastSync: new Date(),
          errorMessage: null,
        },
        tenantId,
      );

      if (!integration) {
        throw new NotFoundError('Integration');
      }

      res.json({ success: true, message: 'Connection test successful' });
    } catch (error) {
      next(error);
    }
  });

  // PA-046: the /api/deployment-readiness mock was removed. It returned static,
  // invented metrics (25 checks / 2 critical, etc.) and had NO frontend caller —
  // DeploymentReadiness.tsx reads the real deployment-readiness edge function via
  // /api/deployment/readiness and /api/deployment/metrics (EDGE-005f), in every
  // environment. Emitting fabricated numbers here read as real and served no one.

  // GET /api/webhooks — the webhook endpoints this system actually exposes, with
  // honest status. (PA-046: was a hardcoded sample with INVENTED success rates of
  // 98.5% / 99.2%.) `status` reflects whether the provider's signing secret is
  // configured; there is no webhook delivery-stats tracking yet, so lastTriggered
  // and successRate are explicitly null (the UI shows "Not tracked") rather than
  // fabricated. Each url points at the real POST handler under /api/webhooks/:provider.
// GET /api/webhooks was removed here (PROD-008b). This is the OUTBOUND
// subscription list, not an inbound receiver, and the webhooks edge function
// serves it at index.ts:43. The inbound provider receivers in
// server/integrations/webhook-routes.ts are a different feature on the same
// prefix and are retained pending INTEG-WEBHOOK-001.
}
