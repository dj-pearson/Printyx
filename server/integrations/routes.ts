/**
 * Integration API Routes
 * Handles OAuth flows and integration management
 */
import express from 'express';
import { IntegrationService } from './integration-service';
import { availableIntegrations, validateOAuthConfig } from './oauth-config';

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
router.get('/api/integrations/marketplace', requireAuth, async (req: any, res) => {
  try {
    const { valid, errors } = validateOAuthConfig();
    
    const marketplace = availableIntegrations.map(integration => ({
      id: integration.id,
      name: integration.name,
      description: integration.description,
      category: integration.category,
      status: valid ? 'available' : 'configuration_required',
      authUrl: integration.authUrl,
      scopes: integration.config.scopes,
      configErrors: errors.filter(error => 
        error.toLowerCase().includes(integration.id.split('-')[0])
      )
    }));

    res.json({
      integrations: marketplace,
      systemStatus: { valid, errors }
    });
  } catch (error) {
    console.error('Error fetching integrations marketplace:', error);
    res.status(500).json({ message: 'Failed to fetch integrations marketplace' });
  }
});

/**
 * Get user's active integrations
 */
router.get('/api/integrations', requireAuth, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    const integrations = await IntegrationService.getIntegrations(tenantId);
    
    // Transform for frontend
    const activeIntegrations = integrations.map(integration => ({
      id: integration.id,
      apiId: integration.providerId,
      name: integration.name,
      status: integration.status,
      configuredAt: integration.config?.userInfo?.created || new Date(),
      lastSync: integration.lastSync || new Date(),
      syncFrequency: 'real-time',
      recordsSynced: Math.floor(Math.random() * 10000), // TODO: Replace with real data
      apiCallsToday: Math.floor(Math.random() * 1000),
      successRate: integration.status === 'connected' ? 98.5 : 0,
      averageLatency: 150 + Math.floor(Math.random() * 100),
      dataVolume: Math.random() * 5,
      errorCount: integration.status === 'error' ? Math.floor(Math.random() * 10) : 0,
      configuration: {
        environment: 'production',
        userInfo: integration.metadata
      },
      webhooks: [],
      recentActivity: [
        {
          timestamp: integration.lastSync || new Date(),
          action: 'calendar_sync',
          records: Math.floor(Math.random() * 50),
          status: integration.status === 'connected' ? 'success' : 'failed'
        }
      ]
    }));

    res.json(activeIntegrations);
  } catch (error) {
    console.error('Error fetching user integrations:', error);
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
      return res.status(400).json({ message: "Tenant ID and User ID are required" });
    }

    if (!providerId) {
      return res.status(400).json({ message: "Provider ID is required" });
    }

    const { authUrl, state } = await IntegrationService.initializeOAuth(tenantId, providerId, userId);
    
    // Store state in session for validation
    req.session.oauthState = state;
    req.session.oauthProvider = providerId;
    
    res.json({ authUrl, state });
  } catch (error) {
    console.error('Error initializing OAuth:', error);
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
      return res.redirect(`${process.env.CLIENT_URL}/integration-hub?error=${encodeURIComponent(error)}`);
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
      state as string
    );

    res.redirect(`${process.env.CLIENT_URL}/integration-hub?success=true&integration=${integration.id}`);
  } catch (error) {
    console.error('Error handling OAuth callback:', error);
    res.redirect(`${process.env.CLIENT_URL}/integration-hub?error=${encodeURIComponent('oauth_failed')}`);
  }
});

/**
 * Get calendar events from an integration
 */
router.get('/api/integrations/:integrationId/calendar/events', requireAuth, async (req: any, res) => {
  try {
    const { integrationId } = req.params;
    const { startDate, endDate } = req.query;
    const tenantId = req.user?.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;

    // First, determine which provider this integration uses
    const integrations = await IntegrationService.getIntegrations(tenantId);
    const integration = integrations.find(i => i.id === integrationId);
    
    if (!integration) {
      return res.status(404).json({ message: 'Integration not found' });
    }

    let events;
    if (integration.providerId === 'google-calendar') {
      events = await IntegrationService.getGoogleCalendarEvents(integrationId, tenantId, start, end);
    } else if (integration.providerId === 'microsoft-calendar') {
      events = await IntegrationService.getMicrosoftCalendarEvents(integrationId, tenantId, start, end);
    } else {
      return res.status(400).json({ message: 'Unsupported calendar provider' });
    }

    res.json({ events, count: events.length });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    res.status(500).json({ message: 'Failed to fetch calendar events' });
  }
});

/**
 * Delete an integration
 */
router.delete('/api/integrations/:integrationId', requireAuth, async (req: any, res) => {
  try {
    const { integrationId } = req.params;
    const tenantId = req.user?.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    await IntegrationService.deleteIntegration(integrationId, tenantId);
    
    res.json({ message: 'Integration deleted successfully' });
  } catch (error) {
    console.error('Error deleting integration:', error);
    res.status(500).json({ message: 'Failed to delete integration' });
  }
});

/**
 * Test an integration connection
 */
router.post('/api/integrations/:integrationId/test', requireAuth, async (req: any, res) => {
  try {
    const { integrationId } = req.params;
    const tenantId = req.user?.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant ID is required" });
    }

    // Try to fetch a small amount of data to test the connection
    const integrations = await IntegrationService.getIntegrations(tenantId);
    const integration = integrations.find(i => i.id === integrationId);
    
    if (!integration) {
      return res.status(404).json({ message: 'Integration not found' });
    }

    let testResult;
    if (integration.providerId === 'google-calendar') {
      const events = await IntegrationService.getGoogleCalendarEvents(integrationId, tenantId, new Date(), new Date(Date.now() + 24 * 60 * 60 * 1000));
      testResult = { success: true, message: `Successfully fetched ${events.length} events`, data: { eventCount: events.length } };
    } else if (integration.providerId === 'microsoft-calendar') {
      const events = await IntegrationService.getMicrosoftCalendarEvents(integrationId, tenantId, new Date(), new Date(Date.now() + 24 * 60 * 60 * 1000));
      testResult = { success: true, message: `Successfully fetched ${events.length} events`, data: { eventCount: events.length } };
    } else {
      testResult = { success: false, message: 'Unsupported provider for testing' };
    }

    res.json(testResult);
  } catch (error) {
    console.error('Error testing integration:', error);
    res.json({ 
      success: false, 
      message: 'Integration test failed', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

export default router;