// QuickBooks Edge Function
// Handles QuickBooks integration and sync
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

/**
 * The id of this tenant's QuickBooks row in `integrations`.
 *
 * integration_sync_logs links to a provider through integration_id and has no
 * integration_type column of its own, so every read and write here needs this
 * first. `integrations` is not in any Drizzle schema, but /status already
 * depends on it, so this reuses that rather than adding a second unverified
 * dependency. Returns null when there is no connection, which the callers treat
 * as "no history" rather than as an error.
 */
// deno-lint-ignore no-explicit-any
async function quickbooksIntegrationId(admin: any, tenantId: string): Promise<string | null> {
  const { data } = await admin
    .from('integrations')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('integration_type', 'quickbooks')
    .maybeSingle();
  return data?.id ?? null;
}

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
    const { parts } = normalizePath(url.pathname, 'quickbooks');
    const endpoint = parts[0];

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
    //
    // integration_sync_logs names no provider: it has integration_id (the row in
    // `integrations`), sync_type, entity_type, records_fetched/created/updated/
    // failed, started_at and completed_at. Filtering on integration_type and
    // ordering by created_at were both 42703s, so sync history never loaded.
    // The provider is resolved through the same integrations row /status reads.
    if (req.method === 'GET' && endpoint === 'sync-history') {
      const integrationId = await quickbooksIntegrationId(admin, tenantId);
      if (!integrationId) {
        return createCorsResponse([], 200, req);
      }

      const { data: history } = await admin
        .from('integration_sync_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('integration_id', integrationId)
        .order('started_at', { ascending: false })
        .limit(50);

      return createCorsResponse(history || [], 200, req);
    }

    // POST /quickbooks/sync/invoices - Sync invoices to QuickBooks
    if (req.method === 'POST' && endpoint === 'sync' && parts[1] === 'invoices') {
      const body = await req.json();
      const { invoiceIds } = body;

      // Log sync attempt
      const { data: syncLog } = await admin
        .from('integration_sync_logs')
        .insert({
          tenant_id: tenantId,
          integration_id: await quickbooksIntegrationId(admin, tenantId),
          sync_type: 'invoices',
          status: 'pending',
          records_fetched: invoiceIds?.length || 0,
          started_at: new Date().toISOString(),
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
    if (req.method === 'POST' && endpoint === 'sync' && parts[1] === 'customers') {
      const body = await req.json();
      const { customerIds } = body;

      const { data: syncLog } = await admin
        .from('integration_sync_logs')
        .insert({
          tenant_id: tenantId,
          integration_id: await quickbooksIntegrationId(admin, tenantId),
          sync_type: 'customers',
          status: 'pending',
          records_fetched: customerIds?.length || 0,
          started_at: new Date().toISOString(),
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
    if (req.method === 'POST' && endpoint === 'sync' && parts[1] === 'payments') {
      const body = await req.json();

      const { data: syncLog } = await admin
        .from('integration_sync_logs')
        .insert({
          tenant_id: tenantId,
          integration_id: await quickbooksIntegrationId(admin, tenantId),
          sync_type: 'payments',
          status: 'pending',
          started_at: new Date().toISOString(),
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

    // GET /quickbooks/entities (EDGE-002h)
    //
    // A static capability list - the entity types the integration knows how to
    // sync, and the ones it has field mappings for. Kept in step with
    // server/quickbooks-mapping.ts (SUPPORTED_QB_ENTITIES and the top-level
    // keys of QUICKBOOKS_FIELD_MAPPINGS); this is configuration, not data, so
    // there is nothing to query.
    if (req.method === 'GET' && endpoint === 'entities') {
      return createCorsResponse(
        {
          supported_entities: [
            'Customer',
            'Vendor',
            'Item',
            'Invoice',
            'Bill',
            'Payment',
            'Account',
            'Employee',
          ],
          field_mappings: ['Customer', 'Vendor', 'Item', 'Invoice'],
        },
        200,
        req,
      );
    }

    // GET /quickbooks/connect - MUST STAY ON EXPRESS.
    //
    // This starts the Intuit OAuth flow, and the flow is session-bound in a way
    // an edge function cannot reproduce:
    //
    //   - it generates a CSRF `state` and stores it in req.session
    //     (qb_oauth_state), which /api/quickbooks/callback then compares
    //     against the value Intuit returns. Moving the initiator away from the
    //     session that holds the state would leave that check comparing
    //     against nothing - it would not fail loudly, it would stop protecting
    //     anything.
    //   - the redirect_uri it registers points at the Express host, so the
    //     callback lands there regardless.
    //   - the refresh token also lives in the session (qb_refresh_token), so
    //     the whole token lifecycle is on that host.
    //
    // Making this portable means moving OAuth state and tokens into a table -
    // a redesign of the credential flow, not a port, and one worth doing
    // deliberately rather than as a side effect of a migration story.
    if (req.method === 'GET' && endpoint === 'connect') {
      return createCorsResponse(
        {
          error: 'QuickBooks OAuth must be started from the Express host',
          code: 'OAUTH_STATE_IS_SESSION_BOUND',
          details:
            'GET /api/quickbooks/connect stores a CSRF state in the server session and ' +
            '/api/quickbooks/callback verifies it there; the refresh token is held the same ' +
            'way. Serving the initiator from an edge function would break that verification ' +
            'silently. Porting it requires moving OAuth state and tokens into a table first.',
        },
        501,
        req,
      );
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
