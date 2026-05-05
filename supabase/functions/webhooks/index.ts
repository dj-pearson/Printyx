// Webhooks Edge Function
// Handles webhook configuration and event dispatching
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

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
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'webhooks');
    const webhookId = parts[0];
    const subResource = parts[1];

    // GET /webhooks - List webhooks
    if (req.method === 'GET' && !webhookId) {
      const { data: webhooks, error } = await admin
        .from('webhooks')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching webhooks:', error);
        return createCorsResponse({ error: 'Failed to fetch webhooks' }, 500, req);
      }

      return createCorsResponse(webhooks || [], 200, req);
    }

    // GET /webhooks/events - Get available webhook events
    if (req.method === 'GET' && webhookId === 'events') {
      const events = [
        { id: 'customer.created', name: 'Customer Created', category: 'customers' },
        { id: 'customer.updated', name: 'Customer Updated', category: 'customers' },
        { id: 'customer.deleted', name: 'Customer Deleted', category: 'customers' },
        { id: 'invoice.created', name: 'Invoice Created', category: 'invoices' },
        { id: 'invoice.paid', name: 'Invoice Paid', category: 'invoices' },
        { id: 'invoice.overdue', name: 'Invoice Overdue', category: 'invoices' },
        { id: 'work_order.created', name: 'Work Order Created', category: 'service' },
        { id: 'work_order.completed', name: 'Work Order Completed', category: 'service' },
        { id: 'equipment.alert', name: 'Equipment Alert', category: 'equipment' },
        { id: 'contract.expiring', name: 'Contract Expiring', category: 'contracts' },
        { id: 'payment.received', name: 'Payment Received', category: 'payments' },
      ];

      return createCorsResponse(events, 200, req);
    }

    // GET /webhooks/:id - Get single webhook
    if (req.method === 'GET' && webhookId && !subResource) {
      const { data: webhook, error } = await admin
        .from('webhooks')
        .select('*')
        .eq('id', webhookId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Webhook not found' }, 404, req);
      }

      return createCorsResponse(webhook, 200, req);
    }

    // POST /webhooks - Create webhook
    if (req.method === 'POST' && !webhookId) {
      const body = await req.json();

      // Generate secret for signature verification
      const secret = crypto.randomUUID().replace(/-/g, '');

      const webhookData = {
        tenant_id: tenantId,
        name: body.name,
        url: body.url,
        events: body.events || [],
        secret,
        is_active: body.isActive !== false,
        headers: body.headers || {},
        retry_count: body.retryCount || body.retry_count || 3,
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: webhook, error } = await admin
        .from('webhooks')
        .insert(webhookData)
        .select()
        .single();

      if (error) {
        console.error('Error creating webhook:', error);
        return createCorsResponse({ error: 'Failed to create webhook' }, 500, req);
      }

      return createCorsResponse(webhook, 201, req);
    }

    // PUT /webhooks/:id - Update webhook
    if (req.method === 'PUT' && webhookId && !subResource) {
      const body = await req.json();

      const { data: webhook, error } = await admin
        .from('webhooks')
        .update({
          name: body.name,
          url: body.url,
          events: body.events,
          is_active: body.isActive ?? body.is_active,
          headers: body.headers,
          retry_count: body.retryCount || body.retry_count,
          updated_at: new Date().toISOString(),
        })
        .eq('id', webhookId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to update webhook' }, 500, req);
      }

      return createCorsResponse(webhook, 200, req);
    }

    // POST /webhooks/:id/test - Test webhook
    if (req.method === 'POST' && webhookId && subResource === 'test') {
      const { data: webhook } = await admin
        .from('webhooks')
        .select('*')
        .eq('id', webhookId)
        .eq('tenant_id', tenantId)
        .single();

      if (!webhook) {
        return createCorsResponse({ error: 'Webhook not found' }, 404, req);
      }

      // Send test payload
      const testPayload = {
        event: 'test',
        timestamp: new Date().toISOString(),
        data: {
          message: 'This is a test webhook payload',
          webhookId: webhook.id,
        },
      };

      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': 'test-signature',
            ...webhook.headers,
          },
          body: JSON.stringify(testPayload),
        });

        // Log the attempt
        await admin.from('webhook_logs').insert({
          webhook_id: webhookId,
          tenant_id: tenantId,
          event: 'test',
          payload: testPayload,
          response_status: response.status,
          response_body: await response.text().catch(() => ''),
          success: response.ok,
          created_at: new Date().toISOString(),
        });

        return createCorsResponse(
          {
            success: response.ok,
            statusCode: response.status,
            message: response.ok ? 'Test successful' : 'Test failed',
          },
          200,
          req,
        );
      } catch (error) {
        await admin.from('webhook_logs').insert({
          webhook_id: webhookId,
          tenant_id: tenantId,
          event: 'test',
          payload: testPayload,
          error_message: error instanceof Error ? error.message : 'Unknown error',
          success: false,
          created_at: new Date().toISOString(),
        });

        return createCorsResponse(
          {
            success: false,
            message: 'Failed to reach webhook URL',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          200,
          req,
        );
      }
    }

    // POST /webhooks/:id/regenerate-secret - Regenerate webhook secret
    if (req.method === 'POST' && webhookId && subResource === 'regenerate-secret') {
      const newSecret = crypto.randomUUID().replace(/-/g, '');

      const { data: webhook, error } = await admin
        .from('webhooks')
        .update({
          secret: newSecret,
          updated_at: new Date().toISOString(),
        })
        .eq('id', webhookId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to regenerate secret' }, 500, req);
      }

      return createCorsResponse(
        {
          secret: newSecret,
          message: 'Secret regenerated',
        },
        200,
        req,
      );
    }

    // GET /webhooks/:id/logs - Get webhook logs
    if (req.method === 'GET' && webhookId && subResource === 'logs') {
      const { data: logs } = await admin
        .from('webhook_logs')
        .select('*')
        .eq('webhook_id', webhookId)
        .order('created_at', { ascending: false })
        .limit(100);

      return createCorsResponse(logs || [], 200, req);
    }

    // DELETE /webhooks/:id - Delete webhook
    if (req.method === 'DELETE' && webhookId) {
      // Delete logs first — scope by tenant_id defense-in-depth even though
      // the subsequent webhook DELETE is tenant-scoped.
      await admin
        .from('webhook_logs')
        .delete()
        .eq('webhook_id', webhookId)
        .eq('tenant_id', tenantId);

      const { error } = await admin
        .from('webhooks')
        .delete()
        .eq('id', webhookId)
        .eq('tenant_id', tenantId);

      if (error) {
        return createCorsResponse({ error: 'Failed to delete webhook' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'Webhook deleted' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in webhooks function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
