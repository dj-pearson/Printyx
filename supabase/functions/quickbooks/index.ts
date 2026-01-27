// QuickBooks Edge Function
// Handles QuickBooks integration and sync
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

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
    const pathParts = url.pathname.split('/').filter(Boolean);
    const endpoint = pathParts[1];

    // GET /quickbooks/status - Get connection status
    if (req.method === 'GET' && endpoint === 'status') {
      const { data: connection } = await admin
        .from('integrations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('integration_type', 'quickbooks')
        .single();

      return createCorsResponse(
        {
          connected: !!connection?.is_active,
          lastSync: connection?.last_sync_at,
          companyName: connection?.metadata?.companyName,
          realmId: connection?.metadata?.realmId,
        },
        200,
        req,
      );
    }

    // GET /quickbooks/sync-history - Get sync history
    if (req.method === 'GET' && endpoint === 'sync-history') {
      const { data: history } = await admin
        .from('integration_sync_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('integration_type', 'quickbooks')
        .order('created_at', { ascending: false })
        .limit(50);

      return createCorsResponse(history || [], 200, req);
    }

    // POST /quickbooks/sync/invoices - Sync invoices to QuickBooks
    if (req.method === 'POST' && endpoint === 'sync' && pathParts[2] === 'invoices') {
      const body = await req.json();
      const { invoiceIds } = body;

      // Log sync attempt
      const { data: syncLog } = await admin
        .from('integration_sync_logs')
        .insert({
          tenant_id: tenantId,
          integration_type: 'quickbooks',
          sync_type: 'invoices',
          status: 'pending',
          records_count: invoiceIds?.length || 0,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      // In production, this would call the QuickBooks API
      return createCorsResponse(
        {
          success: true,
          syncId: syncLog?.id,
          message: 'Invoice sync initiated',
          invoiceCount: invoiceIds?.length || 0,
        },
        200,
        req,
      );
    }

    // POST /quickbooks/sync/customers - Sync customers to QuickBooks
    if (req.method === 'POST' && endpoint === 'sync' && pathParts[2] === 'customers') {
      const body = await req.json();
      const { customerIds } = body;

      const { data: syncLog } = await admin
        .from('integration_sync_logs')
        .insert({
          tenant_id: tenantId,
          integration_type: 'quickbooks',
          sync_type: 'customers',
          status: 'pending',
          records_count: customerIds?.length || 0,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      return createCorsResponse(
        {
          success: true,
          syncId: syncLog?.id,
          message: 'Customer sync initiated',
          customerCount: customerIds?.length || 0,
        },
        200,
        req,
      );
    }

    // POST /quickbooks/sync/payments - Sync payments
    if (req.method === 'POST' && endpoint === 'sync' && pathParts[2] === 'payments') {
      const body = await req.json();

      const { data: syncLog } = await admin
        .from('integration_sync_logs')
        .insert({
          tenant_id: tenantId,
          integration_type: 'quickbooks',
          sync_type: 'payments',
          status: 'pending',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      return createCorsResponse(
        {
          success: true,
          syncId: syncLog?.id,
          message: 'Payment sync initiated',
        },
        200,
        req,
      );
    }

    // GET /quickbooks/mapping - Get entity mapping
    if (req.method === 'GET' && endpoint === 'mapping') {
      const entityType = url.searchParams.get('entityType');

      let query = admin.from('quickbooks_mappings').select('*').eq('tenant_id', tenantId);

      if (entityType) query = query.eq('entity_type', entityType);

      const { data: mappings } = await query;

      return createCorsResponse(mappings || [], 200, req);
    }

    // POST /quickbooks/mapping - Create entity mapping
    if (req.method === 'POST' && endpoint === 'mapping') {
      const body = await req.json();

      const { data: mapping, error } = await admin
        .from('quickbooks_mappings')
        .upsert({
          tenant_id: tenantId,
          entity_type: body.entityType || body.entity_type,
          local_id: body.localId || body.local_id,
          quickbooks_id: body.quickbooksId || body.quickbooks_id,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to create mapping' }, 500, req);
      }

      return createCorsResponse(mapping, 201, req);
    }

    // POST /quickbooks/disconnect - Disconnect QuickBooks
    if (req.method === 'POST' && endpoint === 'disconnect') {
      const { error } = await admin
        .from('integrations')
        .update({
          is_active: false,
          disconnected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('integration_type', 'quickbooks');

      if (error) {
        return createCorsResponse({ error: 'Failed to disconnect' }, 500, req);
      }

      return createCorsResponse({ success: true, message: 'QuickBooks disconnected' }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in quickbooks function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
