/**
 * Integration API Routes
 * Handles OAuth flows and integration management
 */
import express from 'express';
import { IntegrationService } from './integration-service';
import { availableIntegrations, validateOAuthConfig } from './oauth-config';
import webhookRoutes from './webhook-routes';
import { db } from '../db';
import { platformIntegrations } from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { createModuleLogger } from '../lib/logger';
import { getTenantId } from '../utils/auth-helpers';
import { requireAuth } from '../replitAuth';
const log = createModuleLogger('routes');

const router = express.Router();

/**
 * Get available integrations marketplace
 */
router.get('/api/integrations/marketplace', requireAuth, async (req: any, res) => {
  try {
    const { valid, errors } = validateOAuthConfig();

    const marketplace = availableIntegrations.map((integration) => ({
      id: integration.id,
      name: integration.name,
      description: integration.description,
      category: integration.category,
      status: valid ? 'available' : 'configuration_required',
      authUrl: integration.authUrl,
      scopes: integration.config.scopes,
      configErrors: errors.filter((error) =>
        error.toLowerCase().includes(integration.id.split('-')[0]),
      ),
    }));

    res.json({
      integrations: marketplace,
      systemStatus: { valid, errors },
    });
  } catch (error) {
    log.error('Error fetching integrations marketplace:', error);
    res.status(500).json({ message: 'Failed to fetch integrations marketplace' });
  }
});

/**
 * Get user's active integrations with real metrics data
 */
router.get('/api/integrations', requireAuth, async (req: any, res) => {
  try {
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    // PA-053 settled which table backs /system-integrations:
    // `platform_integrations`, the connector catalogue. It is the only one of
    // the two candidates with a `category` column, which the page groups by, and
    // it is what production has always served this prefix from - this handler
    // was reading `system_integrations` (the OAuth CONNECTION store), so dev and
    // prod listed different rows behind one URL.
    //
    // system_integrations keeps the OAuth flow below (/oauth/init and
    // /:provider/callback); PA-056 covers converging that store.
    const rows = await db
      .select()
      .from(platformIntegrations)
      .where(eq(platformIntegrations.tenantId, tenantId))
      .orderBy(desc(platformIntegrations.createdAt));

    // Credentials never leave the server. The edge function does the same.
    res.json(
      rows.map((row) => ({
        id: row.id,
        integrationKey: row.integrationKey,
        integrationName: row.integrationName,
        category: row.category,
        status: row.status,
        syncFrequency: row.syncFrequency,
        lastSyncedAt: row.lastSyncedAt,
        lastSyncStatus: row.lastSyncStatus,
        lastErrorMessage: row.lastErrorMessage,
      })),
    );
  } catch (error) {
    log.error('Error fetching integrations:', error);
    res.status(500).json({ message: 'Failed to fetch integrations' });
  }
});

/**
 * Initialize OAuth flow
 */
router.post('/api/integrations/oauth/init', requireAuth, async (req: any, res) => {
  try {
    const { providerId } = req.body;
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;

    if (!tenantId || !userId) {
      return res.status(400).json({ message: 'Tenant ID and User ID are required' });
    }

    if (!providerId) {
      return res.status(400).json({ message: 'Provider ID is required' });
    }

    const { authUrl, state } = await IntegrationService.initializeOAuth(
      tenantId,
      providerId,
      userId,
    );

    // Store state in session for validation
    req.session.oauthState = state;
    req.session.oauthProvider = providerId;

    res.json({ authUrl, state });
  } catch (error) {
    log.error('Error initializing OAuth:', error);
    res.status(500).json({ message: 'Failed to initialize OAuth flow' });
  }
});

/**
 * Handle OAuth callbacks
 */
router.get('/api/integrations/:provider/callback', async (req: any, res) => {
  try {
    const { provider } = req.params;
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(
        `${process.env.CLIENT_URL}/integration-hub?error=${encodeURIComponent(error)}`,
      );
    }

    if (!code || !state) {
      return res.redirect(`${process.env.CLIENT_URL}/integration-hub?error=missing_parameters`);
    }

    // Validate state (you might want to implement more robust state validation)
    const [tenantId, providerId] = state.split('-');

    if (provider !== providerId) {
      return res.redirect(`${process.env.CLIENT_URL}/integration-hub?error=invalid_state`);
    }

    const integration = await IntegrationService.handleOAuthCallback(
      tenantId,
      provider,
      code as string,
      state as string,
    );

    res.redirect(
      `${process.env.CLIENT_URL}/integration-hub?success=true&integration=${integration.id}`,
    );
  } catch (error) {
    log.error('Error handling OAuth callback:', error);
    res.redirect(
      `${process.env.CLIENT_URL}/integration-hub?error=${encodeURIComponent('oauth_failed')}`,
    );
  }
});

/**
 * Get calendar events from an integration
 */
router.get(
  '/api/integrations/:integrationId/calendar/events',
  requireAuth,
  async (req: any, res) => {
    try {
      const { integrationId } = req.params;
      const { startDate, endDate } = req.query;
      const tenantId = req.user?.tenantId;

      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      // First, determine which provider this integration uses
      const integrations = await IntegrationService.getIntegrations(tenantId);
      const integration = integrations.find((i) => i.id === integrationId);

      if (!integration) {
        return res.status(404).json({ message: 'Integration not found' });
      }

      let events;
      if (integration.providerId === 'google-calendar') {
        events = await IntegrationService.getGoogleCalendarEvents(
          integrationId,
          tenantId,
          start,
          end,
        );
      } else if (integration.providerId === 'microsoft-calendar') {
        events = await IntegrationService.getMicrosoftCalendarEvents(
          integrationId,
          tenantId,
          start,
          end,
        );
      } else {
        return res.status(400).json({ message: 'Unsupported calendar provider' });
      }

      res.json({ events, count: events.length });
    } catch (error) {
      log.error('Error fetching calendar events:', error);
      res.status(500).json({ message: 'Failed to fetch calendar events' });
    }
  },
);

/**
 * Delete an integration
 */
router.delete('/api/integrations/:integrationId', requireAuth, async (req: any, res) => {
  try {
    const { integrationId } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    await IntegrationService.deleteIntegration(integrationId, tenantId);

    res.json({ message: 'Integration deleted successfully' });
  } catch (error) {
    log.error('Error deleting integration:', error);
    res.status(500).json({ message: 'Failed to delete integration' });
  }
});

/**
 * Disconnect an integration
 *
 * PA-052: SystemIntegrations.tsx called this on both hosts and neither served it
 * (Express had DELETE /:integrationId only; the edge function fell to its 405).
 */
router.post('/api/integrations/:integrationId/disconnect', requireAuth, async (req: any, res) => {
  try {
    const { integrationId } = req.params;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    // PA-053: this wrote system_integrations while the page lists
    // platform_integrations, so Disconnect reported success and changed
    // nothing the user could see.
    const updated = await db
      .update(platformIntegrations)
      .set({
        status: 'disconnected',
        credentials: {},
        lastErrorMessage: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(platformIntegrations.id, integrationId),
          eq(platformIntegrations.tenantId, tenantId),
        ),
      )
      .returning({ id: platformIntegrations.id });

    if (!updated.length) {
      return res.status(404).json({ message: 'Integration not found' });
    }

    res.json({ success: true, message: 'Integration disconnected' });
  } catch (error) {
    log.error('Error disconnecting integration:', error);
    res.status(500).json({ message: 'Failed to disconnect integration' });
  }
});

/**
 * Test an integration connection
 */
router.post('/api/integrations/:integrationId/test', requireAuth, async (req: any, res) => {
  try {
    const { integrationId } = req.params;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const [integration] = await db
      .select()
      .from(platformIntegrations)
      .where(
        and(
          eq(platformIntegrations.id, integrationId),
          eq(platformIntegrations.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!integration) {
      return res.status(404).json({ message: 'Integration not found' });
    }

    // PA-053: same table as the list now, and the same answer shape as the edge
    // function's branch. There is no provider client here either, so what is
    // reported is what is stored; connectivityVerified stays false.
    const credentials = (integration.credentials ?? {}) as Record<string, unknown>;
    const hasCredentials = Object.values(credentials).some(
      (v) => v !== null && v !== undefined && String(v).trim() !== '',
    );

    res.json({
      success: hasCredentials,
      connectivityVerified: false,
      lastSync: integration.lastSyncedAt ?? null,
      message: hasCredentials
        ? `${integration.integrationName} has stored credentials. The connection itself was not tested.`
        : 'No credentials are stored for this integration.',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('Error testing integration:', error);
    res.status(500).json({ message: 'Failed to test integration' });
  }
});

/**
 * Store credentials / cadence on an integration.
 *
 * PA-053: the config dialog's Save posts here. It previously had no Express
 * handler at all - only the edge function served PUT /:id - so in dev the dialog
 * 404'd while claiming success in prod.
 */
router.put('/api/integrations/:integrationId', requireAuth, async (req: any, res) => {
  try {
    const { integrationId } = req.params;
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (req.body.credentials !== undefined) update.credentials = req.body.credentials;
    if (req.body.config !== undefined) update.config = req.body.config;
    if (req.body.syncFrequency !== undefined) update.syncFrequency = req.body.syncFrequency;
    if (req.body.status !== undefined) update.status = req.body.status;

    const updated = await db
      .update(platformIntegrations)
      .set(update)
      .where(
        and(
          eq(platformIntegrations.id, integrationId),
          eq(platformIntegrations.tenantId, tenantId),
        ),
      )
      .returning({ id: platformIntegrations.id, status: platformIntegrations.status });

    if (!updated.length) {
      return res.status(404).json({ message: 'Integration not found' });
    }

    // Credentials are never echoed back.
    res.json({ id: updated[0].id, status: updated[0].status });
  } catch (error) {
    log.error('Error updating integration:', error);
    res.status(500).json({ message: 'Failed to update integration' });
  }
});

// Include webhook routes
router.use('/', webhookRoutes);

export default router;
