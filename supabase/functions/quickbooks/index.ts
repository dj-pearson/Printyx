// QuickBooks Edge Function
// Handles QuickBooks integration and sync
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { resolveTenantId } from '../_shared/resolve-tenant.ts';
import { denyWithoutPermission } from '../_shared/rbac.ts';
import {
  CONNECTION_GAP,
  SYNC_GAP,
  isSyncEntity,
  unavailableStatus,
} from '../../../shared/quickbooks-availability.ts';

const REQUIRED_PERMISSION = 'admin.settings.integrations';

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

    const admin = createSupabaseServiceClient();
    const tenantId = await resolveTenantId(req, user, admin);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    // SEC-EDGE-001: The QuickBooks connection and its sync. /quickbooks-integration needs admin.settings.integrations at level 4, which is the seeded code for configuring a third-party integration.
    const denied = await denyWithoutPermission(admin, user, REQUIRED_PERMISSION);
    if (denied) return createCorsResponse(denied, 403, req);

    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'quickbooks');
    const endpoint = parts[0];

    /**
     * GET /quickbooks/status
     *
     * This read `integrations` - a table in no schema and no migration -
     * DISCARDED the error and answered `{ connected: false }` at 200, so every
     * dealer in production was told they had not connected QuickBooks, whether
     * or not they had. `connected` is null now, because false is a measurement
     * and this endpoint cannot make one until a credential store exists.
     */
    if (req.method === 'GET' && endpoint === 'status') {
      return createCorsResponse(unavailableStatus(), 200, req);
    }

    /**
     * GET /quickbooks/sync-history
     *
     * integration_sync_logs is a real table, but a log row is reached through
     * an `integrations` row that cannot exist, so this could only ever answer
     * an empty list - which reads as "no syncs yet" rather than as a feature
     * with no store behind it.
     */
    if (req.method === 'GET' && endpoint === 'sync-history') {
      return createCorsResponse(CONNECTION_GAP, 501, req);
    }

    /**
     * POST /quickbooks/sync/:entity
     *
     * These answered `{ success: true, message: 'Customer sync initiated' }`
     * beside a comment saying the QuickBooks call would happen "in
     * production", and logged a `pending` row whose insert error they
     * discarded. Nothing was attempted and nothing was stored.
     *
     * `items` had no branch at all and fell to the trailing 404, while
     * `invoices` and `payments` had branches no client calls - so the one
     * button the page offers was the one shape that was missing. Every entity
     * answers the same refusal now, rather than one of them failing
     * differently for a reason that is not about QuickBooks.
     */
    if (req.method === 'POST' && endpoint === 'sync' && isSyncEntity(parts[1])) {
      return createCorsResponse(SYNC_GAP, 501, req);
    }

    /**
     * /quickbooks/mapping and /quickbooks/disconnect
     *
     * `quickbooks_mappings` is phantom, so the GET answered `[]` over a 42P01
     * (an empty map reads as "nothing mapped yet") and the POST answered 500.
     * Disconnect updated the phantom `integrations` table, so it could only
     * ever report a failure to disconnect something that was never stored.
     */
    if (endpoint === 'mapping' || endpoint === 'disconnect') {
      return createCorsResponse(CONNECTION_GAP, 501, req);
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
