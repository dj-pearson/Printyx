// Integrations Edge Function
// Handles third-party integrations management (e.g., eautomate, quickbooks, salesforce)
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

// Integration type configuration templates
const INTEGRATION_CONFIGS: Record<string, { category: string; name: string; fields: string[] }> = {
  eautomate: {
    category: 'erp',
    name: 'e-automate',
    fields: ['serverUrl', 'username', 'password', 'companyId'],
  },
  quickbooks: {
    category: 'erp',
    name: 'QuickBooks',
    fields: ['realmId', 'accessToken', 'refreshToken', 'clientId', 'clientSecret'],
  },
  salesforce: {
    category: 'crm',
    name: 'Salesforce',
    fields: ['instanceUrl', 'accessToken', 'refreshToken', 'clientId', 'clientSecret'],
  },
  apollo: {
    category: 'data-enrichment',
    name: 'Apollo',
    fields: ['apiKey'],
  },
  zoominfo: {
    category: 'data-enrichment',
    name: 'ZoomInfo',
    fields: ['apiKey', 'username'],
  },
  openai: {
    category: 'ai',
    name: 'OpenAI',
    fields: ['apiKey', 'organizationId'],
  },
  anthropic: {
    category: 'ai',
    name: 'Anthropic',
    fields: ['apiKey'],
  },
};

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenant_id as string) || (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);

    // Parse path: /integrations, /integrations/:id, /integrations/:type/config, etc.
    const segment1 = pathParts[1]; // Could be ID, type, or 'webhooks'
    const segment2 = pathParts[2]; // Could be 'config', 'sync', 'status'

    // ========== WEBHOOKS ROUTES ==========

    // POST /integrations/webhooks - Register webhook
    if (req.method === 'POST' && segment1 === 'webhooks' && !segment2) {
      const body = await req.json();

      const webhookData = {
        tenant_id: tenantId,
        integration_id: body.integrationId || body.integration_id,
        webhook_url: body.webhookUrl || body.webhook_url,
        event_types: body.eventTypes || body.event_types || [],
        secret: body.secret || generateWebhookSecret(),
        is_active:
          body.isActive !== undefined
            ? body.isActive
            : body.is_active !== undefined
              ? body.is_active
              : true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: webhook, error } = await admin
        .from('integration_webhooks')
        .insert(webhookData)
        .select()
        .single();

      if (error) {
        console.error('Error creating webhook:', error);
        return createCorsResponse({ error: 'Failed to create webhook', details: error }, 500, req);
      }

      return createCorsResponse(webhook, 201, req);
    }

    // GET /integrations/webhooks - List webhooks
    if (req.method === 'GET' && segment1 === 'webhooks' && !segment2) {
      const integrationId =
        url.searchParams.get('integrationId') || url.searchParams.get('integration_id');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const offset = (page - 1) * limit;

      let query = admin
        .from('integration_webhooks')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (integrationId) {
        query = query.eq('integration_id', integrationId);
      }

      const { data: webhooks, error, count } = await query;

      if (error) {
        console.error('Error fetching webhooks:', error);
        return createCorsResponse({ error: 'Failed to fetch webhooks' }, 500, req);
      }

      return createCorsResponse(
        {
          data: webhooks || [],
          total: count || 0,
          page,
          limit,
        },
        200,
        req,
      );
    }

    // DELETE /integrations/webhooks/:id - Delete webhook
    if (req.method === 'DELETE' && segment1 === 'webhooks' && segment2) {
      const webhookId = segment2;

      const { error } = await admin
        .from('integration_webhooks')
        .delete()
        .eq('id', webhookId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error deleting webhook:', error);
        return createCorsResponse({ error: 'Failed to delete webhook' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Webhook deleted' }, 200, req);
    }

    // ========== INTEGRATION TYPE-BASED ROUTES ==========

    // Check if segment1 is a known integration type
    const isIntegrationType = segment1 && INTEGRATION_CONFIGS[segment1];

    // GET /integrations/:type/config - Get integration config template
    if (req.method === 'GET' && isIntegrationType && segment2 === 'config') {
      const integrationType = segment1;
      const config = INTEGRATION_CONFIGS[integrationType];

      // Fetch existing integration config for this tenant/type
      const { data: existing } = await admin
        .from('platform_integrations')
        .select('id, integration_key, config, status, last_synced_at, created_at')
        .eq('tenant_id', tenantId)
        .eq('integration_key', integrationType)
        .single();

      return createCorsResponse(
        {
          type: integrationType,
          name: config.name,
          category: config.category,
          requiredFields: config.fields,
          existingConfig: existing || null,
        },
        200,
        req,
      );
    }

    // POST /integrations/:type/config - Save integration config
    if (req.method === 'POST' && isIntegrationType && segment2 === 'config') {
      const integrationType = segment1;
      const config = INTEGRATION_CONFIGS[integrationType];
      const body = await req.json();

      // Check if integration already exists
      const { data: existing } = await admin
        .from('platform_integrations')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('integration_key', integrationType)
        .single();

      if (existing) {
        // Update existing integration
        const { data: integration, error } = await admin
          .from('platform_integrations')
          .update({
            credentials: body.credentials,
            config: body.config || {},
            field_mappings: body.fieldMappings || body.field_mappings || {},
            sync_frequency: body.syncFrequency || body.sync_frequency || 'manual',
            status: 'configured',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .eq('tenant_id', tenantId)
          .select()
          .single();

        if (error) {
          console.error('Error updating integration config:', error);
          return createCorsResponse(
            { error: 'Failed to update integration config', details: error },
            500,
            req,
          );
        }

        // Don't return credentials
        return createCorsResponse(
          { ...integration, credentials: { status: integration.status } },
          200,
          req,
        );
      } else {
        // Create new integration
        const { data: integration, error } = await admin
          .from('platform_integrations')
          .insert({
            tenant_id: tenantId,
            integration_key: integrationType,
            integration_name: config.name,
            category: config.category,
            credentials: body.credentials,
            config: body.config || {},
            field_mappings: body.fieldMappings || body.field_mappings || {},
            sync_frequency: body.syncFrequency || body.sync_frequency || 'manual',
            status: 'configured',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating integration config:', error);
          return createCorsResponse(
            { error: 'Failed to create integration config', details: error },
            500,
            req,
          );
        }

        // Don't return credentials
        return createCorsResponse(
          { ...integration, credentials: { status: integration.status } },
          201,
          req,
        );
      }
    }

    // POST /integrations/:type/sync - Trigger sync
    if (req.method === 'POST' && isIntegrationType && segment2 === 'sync') {
      const integrationType = segment1;
      const body = await req.json();
      const entityType = body.entityType || body.entity_type;

      // Find the integration
      const { data: integration, error: findError } = await admin
        .from('platform_integrations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('integration_key', integrationType)
        .single();

      if (findError || !integration) {
        return createCorsResponse({ error: 'Integration not found or not configured' }, 404, req);
      }

      // Create sync log
      const { data: syncLog, error: syncLogError } = await admin
        .from('integration_sync_logs')
        .insert({
          integration_id: integration.id,
          sync_type: body.syncType || body.sync_type || 'pull',
          entity_type: entityType,
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (syncLogError) {
        console.error('Error creating sync log:', syncLogError);
        return createCorsResponse({ error: 'Failed to start sync' }, 500, req);
      }

      // In a real implementation, this would trigger an async job
      // For now, we'll return immediately with the sync log
      // The actual sync would be handled by a background worker

      return createCorsResponse(
        {
          success: true,
          message: 'Sync initiated',
          syncLogId: syncLog.id,
          integrationType,
          entityType,
        },
        202,
        req,
      );
    }

    // GET /integrations/:type/status - Get sync status
    if (req.method === 'GET' && isIntegrationType && segment2 === 'status') {
      const integrationType = segment1;

      // Find the integration
      const { data: integration, error: findError } = await admin
        .from('platform_integrations')
        .select('id, status, last_synced_at, last_error_message, last_error_at')
        .eq('tenant_id', tenantId)
        .eq('integration_key', integrationType)
        .single();

      if (findError || !integration) {
        return createCorsResponse({ error: 'Integration not found' }, 404, req);
      }

      // Get recent sync logs
      const { data: syncLogs } = await admin
        .from('integration_sync_logs')
        .select('*')
        .eq('integration_id', integration.id)
        .order('started_at', { ascending: false })
        .limit(10);

      return createCorsResponse(
        {
          integrationType,
          status: integration.status,
          lastSyncedAt: integration.last_synced_at,
          lastError: integration.last_error_message,
          lastErrorAt: integration.last_error_at,
          recentSyncs: syncLogs || [],
        },
        200,
        req,
      );
    }

    // ========== GENERIC INTEGRATION ROUTES ==========

    // GET /integrations - List all integrations for tenant
    if (req.method === 'GET' && !segment1) {
      const category = url.searchParams.get('category');
      const status = url.searchParams.get('status');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const offset = (page - 1) * limit;

      let query = admin
        .from('platform_integrations')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (category) {
        query = query.eq('category', category);
      }

      if (status) {
        query = query.eq('status', status);
      }

      const { data: integrations, error, count } = await query;

      if (error) {
        console.error('Error fetching integrations:', error);
        return createCorsResponse({ error: 'Failed to fetch integrations' }, 500, req);
      }

      // Don't return actual credentials
      const safeIntegrations = (integrations || []).map((i: any) => ({
        ...i,
        credentials: { status: i.status },
      }));

      return createCorsResponse(
        {
          data: safeIntegrations,
          total: count || 0,
          page,
          limit,
        },
        200,
        req,
      );
    }

    // GET /integrations/:id - Get integration details
    if (req.method === 'GET' && segment1 && !segment2 && !isIntegrationType) {
      const integrationId = segment1;

      const { data: integration, error } = await admin
        .from('platform_integrations')
        .select('*')
        .eq('id', integrationId)
        .eq('tenant_id', tenantId)
        .single();

      if (error || !integration) {
        console.error('Error fetching integration:', error);
        return createCorsResponse({ error: 'Integration not found' }, 404, req);
      }

      // Get recent sync logs
      const { data: syncLogs } = await admin
        .from('integration_sync_logs')
        .select('*')
        .eq('integration_id', integrationId)
        .order('started_at', { ascending: false })
        .limit(10);

      // Don't return actual credentials
      return createCorsResponse(
        {
          ...integration,
          credentials: { status: integration.status },
          recentSyncs: syncLogs || [],
        },
        200,
        req,
      );
    }

    // POST /integrations - Create new integration (generic)
    if (req.method === 'POST' && !segment1) {
      const body = await req.json();
      const integrationType =
        body.integrationType ||
        body.integration_type ||
        body.integrationKey ||
        body.integration_key;
      const config = INTEGRATION_CONFIGS[integrationType];

      if (!config) {
        return createCorsResponse({ error: 'Unknown integration type' }, 400, req);
      }

      const { data: integration, error } = await admin
        .from('platform_integrations')
        .insert({
          tenant_id: tenantId,
          integration_key: integrationType,
          integration_name: body.integrationName || body.integration_name || config.name,
          category: config.category,
          credentials: body.credentials || {},
          config: body.config || {},
          field_mappings: body.fieldMappings || body.field_mappings || {},
          sync_frequency: body.syncFrequency || body.sync_frequency || 'manual',
          status: 'configured',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating integration:', error);
        return createCorsResponse(
          { error: 'Failed to create integration', details: error },
          500,
          req,
        );
      }

      // Don't return credentials
      return createCorsResponse(
        { ...integration, credentials: { status: integration.status } },
        201,
        req,
      );
    }

    // PUT/PATCH /integrations/:id - Update integration
    if (
      (req.method === 'PUT' || req.method === 'PATCH') &&
      segment1 &&
      !segment2 &&
      !isIntegrationType
    ) {
      const integrationId = segment1;
      const body = await req.json();

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      // Map fields
      if (body.config !== undefined) updateData.config = body.config;
      if (body.credentials !== undefined) updateData.credentials = body.credentials;
      if (body.fieldMappings !== undefined || body.field_mappings !== undefined) {
        updateData.field_mappings = body.fieldMappings || body.field_mappings;
      }
      if (body.syncFrequency !== undefined || body.sync_frequency !== undefined) {
        updateData.sync_frequency = body.syncFrequency || body.sync_frequency;
      }
      if (body.status !== undefined) updateData.status = body.status;
      if (body.isEnabled !== undefined || body.is_enabled !== undefined) {
        updateData.is_enabled = body.isEnabled !== undefined ? body.isEnabled : body.is_enabled;
      }

      const { data: integration, error } = await admin
        .from('platform_integrations')
        .update(updateData)
        .eq('id', integrationId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        console.error('Error updating integration:', error);
        return createCorsResponse({ error: 'Failed to update integration' }, 500, req);
      }

      // Don't return credentials
      return createCorsResponse(
        { ...integration, credentials: { status: integration.status } },
        200,
        req,
      );
    }

    // DELETE /integrations/:id - Delete/Disconnect integration
    if (req.method === 'DELETE' && segment1 && !segment2 && !isIntegrationType) {
      const integrationId = segment1;

      // Soft delete by setting status to disconnected and clearing credentials
      const { error } = await admin
        .from('platform_integrations')
        .update({
          status: 'disconnected',
          credentials: {},
          updated_at: new Date().toISOString(),
        })
        .eq('id', integrationId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error disconnecting integration:', error);
        return createCorsResponse({ error: 'Failed to disconnect integration' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Integration disconnected' }, 200, req);
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (error) {
    console.error('Error in integrations function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}

// Helper function to generate a webhook secret
function generateWebhookSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'whsec_';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
