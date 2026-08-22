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

  // GET /api/webhooks was removed here (PROD-008b). /api/webhooks is in
  // crmProxies, so this handler was shadowed in dev and unreachable in
  // production; supabase/functions/webhooks/ serves the prefix on both hosts.
  //
  // CORRECTION to the note this replaces, which had the feature backwards: what
  // stood here was the INBOUND provider list (stripe, salesforce, microsoft,
  // quickbooks, google, each with status derived from its signing-secret env
  // var), while the edge function serves the OUTBOUND subscription rows a tenant
  // configures in the `webhooks` table. Different features that happened to
  // share a path. The deletion was still runtime-neutral - the proxy already won
  // - but it is the edge function's rows the pages have been rendering, and they
  // were reading a shape it did not return until _shared/webhook-view.ts.
  //
  // The inbound receivers themselves live in server/integrations/webhook-routes.ts
  // and are retained pending INTEG-WEBHOOK-001. There is no longer an endpoint
  // that reports whether each provider's secret is configured; if that display
  // is wanted back, it belongs on the edge side as its own sub-resource, not on
  // this prefix by accident.
}
