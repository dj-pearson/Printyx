/**
 * Integration API Routes
 * Handles OAuth flows and integration management
 */
import express from 'express';
import { IntegrationService } from './integration-service';
import { availableIntegrations, validateOAuthConfig } from './oauth-config';
import webhookRoutes from './webhook-routes';
import { db } from '../db';
import { integrationMetrics, integrationApiLogs } from '../../shared/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import { createModuleLogger } from '../lib/logger';
import { getUserId, getTenantId } from './utils/auth-helpers';
const log = createModuleLogger('routes');

// Using inline auth middleware since requireAuth is not available
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  next();
};

const router = express.Router();

/**
 * Get available integrations marketplace
 */
router.get('/api/integrations/marketplace', async (req: any, res) => {
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
router.get('/api/integrations', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const integrations = await IntegrationService.getIntegrations(tenantId);

    // Get today's metrics for all integrations
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const metricsResults = await db
      .select()
      .from(integrationMetrics)
      .where(
        and(eq(integrationMetrics.tenantId, tenantId), gte(integrationMetrics.periodStart, today)),
      );

    // Build metrics map by integration ID
    const metricsMap = new Map<string, (typeof metricsResults)[0]>();
    for (const metric of metricsResults) {
      metricsMap.set(metric.integrationId, metric);
    }

    // Get recent activity logs
    const recentLogs = await db
      .select()
      .from(integrationApiLogs)
      .where(
        and(
          eq(integrationApiLogs.tenantId, tenantId),
          gte(integrationApiLogs.requestTimestamp, new Date(Date.now() - 24 * 60 * 60 * 1000)),
        ),
      )
      .orderBy(desc(integrationApiLogs.requestTimestamp))
      .limit(50);

    // Build activity map by integration ID
    const activityMap = new Map<string, typeof recentLogs>();
    for (const log of recentLogs) {
      if (!activityMap.has(log.integrationId)) {
        activityMap.set(log.integrationId, []);
      }
      activityMap.get(log.integrationId)!.push(log);
    }

    // Transform for frontend with real metrics
    const activeIntegrations = integrations.map((integration) => {
      const metrics = metricsMap.get(integration.id);
      const logs = activityMap.get(integration.id) || [];

      // Calculate success rate from real data
      const totalCalls = Number(metrics?.totalApiCalls) || 0;
      const successfulCalls = Number(metrics?.successfulCalls) || 0;
      const failedCalls = Number(metrics?.failedCalls) || 0;
      const successRate =
        totalCalls > 0
          ? (successfulCalls / totalCalls) * 100
          : integration.status === 'connected'
            ? 100
            : 0;

      return {
        id: integration.id,
        apiId: integration.providerId,
        name: integration.name,
        status: integration.status,
        configuredAt: integration.config?.userInfo?.created || new Date(),
        lastSync: integration.lastSync || null,
        syncFrequency: integration.providerId.includes('calendar') ? 'real-time' : 'hourly',
        recordsSynced: Number(metrics?.recordsSynced) || 0,
        apiCallsToday: totalCalls,
        successRate: Math.round(successRate * 10) / 10,
        averageLatency: Number(metrics?.avgLatencyMs) || 0,
        dataVolume:
          Math.round(((Number(metrics?.dataVolumeBytes) || 0) / (1024 * 1024)) * 100) / 100, // MB
        errorCount: failedCalls,
        configuration: {
          environment: 'production',
          userInfo: integration.metadata,
        },
        webhooks: [],
        recentActivity: logs.slice(0, 5).map((log) => ({
          timestamp: log.requestTimestamp,
          action: log.endpoint.split('/').pop() || 'sync',
          records: log.recordsAffected || 0,
          status: log.success ? 'success' : 'failed',
        })),
      };
    });

    res.json(activeIntegrations);
  } catch (error) {
    log.error('Error fetching user integrations:', error);
    res.status(500).json({ message: 'Failed to fetch integrations' });
  }
});

/**
 * Initialize OAuth flow
 */
router.post('/api/integrations/oauth/init', async (req: any, res) => {
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
router.get('/api/integrations/:integrationId/calendar/events', async (req: any, res) => {
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
});

/**
 * Delete an integration
 */
router.delete('/api/integrations/:integrationId', async (req: any, res) => {
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
 * Test an integration connection
 */
router.post('/api/integrations/:integrationId/test', async (req: any, res) => {
  try {
    const { integrationId } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    // Try to fetch a small amount of data to test the connection
    const integrations = await IntegrationService.getIntegrations(tenantId);
    const integration = integrations.find((i) => i.id === integrationId);

    if (!integration) {
      return res.status(404).json({ message: 'Integration not found' });
    }

    let testResult;
    if (integration.providerId === 'google-calendar') {
      const events = await IntegrationService.getGoogleCalendarEvents(
        integrationId,
        tenantId,
        new Date(),
        new Date(Date.now() + 24 * 60 * 60 * 1000),
      );
      testResult = {
        success: true,
        message: `Successfully fetched ${events.length} events`,
        data: { eventCount: events.length },
      };
    } else if (integration.providerId === 'microsoft-calendar') {
      const events = await IntegrationService.getMicrosoftCalendarEvents(
        integrationId,
        tenantId,
        new Date(),
        new Date(Date.now() + 24 * 60 * 60 * 1000),
      );
      testResult = {
        success: true,
        message: `Successfully fetched ${events.length} events`,
        data: { eventCount: events.length },
      };
    } else {
      testResult = { success: false, message: 'Unsupported provider for testing' };
    }

    res.json(testResult);
  } catch (error) {
    log.error('Error testing integration:', error);
    res.json({
      success: false,
      message: 'Integration test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Include webhook routes
router.use('/', webhookRoutes);

export default router;
