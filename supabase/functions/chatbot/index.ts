// Chatbot console Edge Function (PROD-014)
//
// ChatbotConsole.tsx calls /api/chatbot/{connections,links,query-log,connect}
// and there was no edge function, so in production every panel on the page
// 404'd while dev worked fine off Express.
//
// This serves the console: workspace installs, the Slack/Teams -> Printyx user
// mappings, and the append-only query log. POST /query is deliberately NOT
// here — see the branch at the bottom for why.
//
// Row projections come from _shared/chatbot-projection.ts, which
// server/lib/chatbot-projection.ts mirrors: the page reads camelCase keys off
// each row, and the workspace bot token must never appear in a response.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import {
  obfuscateCredential,
  projectConnection,
  projectQueryLogRow,
  projectUserLink,
} from '../_shared/chatbot-projection.ts';

const PLATFORMS = ['slack', 'teams'];

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse({ message: 'Unauthorized' }, 401, req);
    }

    // Tenant comes from the verified JWT. The x-tenant-id header is a fallback
    // only — letting it win would let any authenticated user read another
    // tenant's workspace installs by spoofing a header.
    const jwtTenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string);
    const headerTenantId = req.headers.get('x-tenant-id') || undefined;
    const isPlatformAdmin =
      user.app_metadata?.isPlatformAdmin === true || user.app_metadata?.role === 'platform_admin';
    if (headerTenantId && jwtTenantId && headerTenantId !== jwtTenantId && !isPlatformAdmin) {
      return createCorsResponse(
        { message: 'Tenant access denied', code: 'TENANT_ACCESS_DENIED' },
        403,
        req,
      );
    }

    const admin = createSupabaseServiceClient();
    let tenantId = jwtTenantId || headerTenantId;
    if (!tenantId) {
      const { data: dbUser } = await admin
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .limit(1)
        .maybeSingle();
      tenantId = dbUser?.tenant_id;
    }
    if (!tenantId) {
      return createCorsResponse({ message: 'Tenant ID is required' }, 400, req);
    }

    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'chatbot');
    const resource = parts[0];
    const id = parts[1];

    // ------------------------------------------------------------------
    // GET /chatbot/connections - workspace installs, tokens write-only
    // ------------------------------------------------------------------
    if (req.method === 'GET' && resource === 'connections' && !id) {
      const { data, error } = await admin
        .from('chatbot_connections')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to list connections:', error);
        return createCorsResponse(
          { message: 'Failed to list connections', error: error.message },
          500,
          req,
        );
      }

      const rows = (data ?? []).map(projectConnection);
      return createCorsResponse({ data: rows, total: rows.length }, 200, req);
    }

    // ------------------------------------------------------------------
    // POST /chatbot/connect - install a workspace
    //
    // There is no real OAuth here on either backend: a pasted bot token is
    // obfuscated and stored, never echoed. Upserts on (tenant, platform, team),
    // which is a unique index, so a re-install updates rather than duplicates.
    // ------------------------------------------------------------------
    if (req.method === 'POST' && resource === 'connect' && !id) {
      const body = await req.json().catch(() => ({}));
      const platform = body.platform;
      const teamId = body.teamId ?? body.team_id;
      const teamName = body.teamName ?? body.team_name;
      const botToken = body.botToken ?? body.bot_token;

      if (!PLATFORMS.includes(platform) || !teamId) {
        return createCorsResponse({ message: 'Invalid input' }, 400, req);
      }

      const { data: existing } = await admin
        .from('chatbot_connections')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('platform', platform)
        .eq('team_id', teamId)
        .maybeSingle();

      const tokens: Record<string, unknown> = {
        ...((existing?.encrypted_tokens ?? {}) as Record<string, unknown>),
      };
      if (botToken !== undefined) tokens.botToken = obfuscateCredential(String(botToken));

      const nowIso = new Date().toISOString();
      let row;
      if (existing) {
        const { data, error } = await admin
          .from('chatbot_connections')
          .update({
            team_name: teamName ?? existing.team_name,
            encrypted_tokens: tokens,
            updated_at: nowIso,
          })
          .eq('id', existing.id)
          .eq('tenant_id', tenantId)
          .select('*')
          .single();
        if (error) {
          console.error('Failed to connect workspace:', error);
          return createCorsResponse(
            { message: 'Failed to connect workspace', error: error.message },
            500,
            req,
          );
        }
        row = data;
      } else {
        const { data, error } = await admin
          .from('chatbot_connections')
          .insert({
            tenant_id: tenantId,
            platform,
            team_id: teamId,
            team_name: teamName ?? null,
            encrypted_tokens: tokens,
            installed_by_user_id: user.id,
            created_at: nowIso,
            updated_at: nowIso,
          })
          .select('*')
          .single();
        if (error) {
          console.error('Failed to connect workspace:', error);
          return createCorsResponse(
            { message: 'Failed to connect workspace', error: error.message },
            500,
            req,
          );
        }
        row = data;
      }

      const projected = projectConnection(row);
      return createCorsResponse(
        {
          connected: true,
          platform: projected.platform,
          teamId: projected.teamId,
          tokensSet: projected.tokensSet,
        },
        200,
        req,
      );
    }

    // ------------------------------------------------------------------
    // PUT /chatbot/connections/:id - enable/disable toggle
    // ------------------------------------------------------------------
    if ((req.method === 'PUT' || req.method === 'PATCH') && resource === 'connections' && id) {
      const body = await req.json().catch(() => ({}));
      if (typeof body.enabled !== 'boolean') {
        return createCorsResponse({ message: 'Invalid input' }, 400, req);
      }

      const { data, error } = await admin
        .from('chatbot_connections')
        .update({ enabled: body.enabled, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select('*')
        .maybeSingle();

      if (error) {
        console.error('Failed to update connection:', error);
        return createCorsResponse(
          { message: 'Failed to update connection', error: error.message },
          500,
          req,
        );
      }
      if (!data) return createCorsResponse({ message: 'Connection not found' }, 404, req);

      return createCorsResponse(projectConnection(data), 200, req);
    }

    // ------------------------------------------------------------------
    // DELETE /chatbot/connections/:id
    // ------------------------------------------------------------------
    if (req.method === 'DELETE' && resource === 'connections' && id) {
      const { error } = await admin
        .from('chatbot_connections')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Failed to remove connection:', error);
        return createCorsResponse(
          { message: 'Failed to remove connection', error: error.message },
          500,
          req,
        );
      }
      return createCorsResponse({ success: true }, 200, req);
    }

    // ------------------------------------------------------------------
    // GET /chatbot/links - Slack/Teams user -> Printyx user mappings
    // ------------------------------------------------------------------
    if (req.method === 'GET' && resource === 'links' && !id) {
      const { data, error } = await admin
        .from('chatbot_user_links')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to list links:', error);
        return createCorsResponse(
          { message: 'Failed to list links', error: error.message },
          500,
          req,
        );
      }

      const rows = (data ?? []).map(projectUserLink);
      return createCorsResponse({ data: rows, total: rows.length }, 200, req);
    }

    // ------------------------------------------------------------------
    // POST /chatbot/links - map a platform user to a Printyx user by email
    //
    // `verified` means a tenant-scoped user with that email exists. Resolving
    // the email against ALL users rather than this tenant's would map a chat
    // account onto someone else's employee, so the tenant filter is the point.
    // ------------------------------------------------------------------
    if (req.method === 'POST' && resource === 'links' && !id) {
      const body = await req.json().catch(() => ({}));
      const platform = body.platform;
      const platformUserId = body.platformUserId ?? body.platform_user_id;
      const email = body.email;

      if (!PLATFORMS.includes(platform) || !platformUserId || !email) {
        return createCorsResponse({ message: 'Invalid input' }, 400, req);
      }

      const { data: matched } = await admin
        .from('users')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('email', email)
        .limit(1)
        .maybeSingle();

      const printyxUserId = matched?.id ?? null;

      const { data, error } = await admin
        .from('chatbot_user_links')
        .upsert(
          {
            tenant_id: tenantId,
            platform,
            platform_user_id: platformUserId,
            email,
            printyx_user_id: printyxUserId,
            verified: Boolean(printyxUserId),
          },
          { onConflict: 'tenant_id,platform,platform_user_id' },
        )
        .select('*')
        .single();

      if (error) {
        console.error('Failed to create link:', error);
        return createCorsResponse(
          { message: 'Failed to create link', error: error.message },
          500,
          req,
        );
      }

      return createCorsResponse(projectUserLink(data), 201, req);
    }

    // ------------------------------------------------------------------
    // DELETE /chatbot/links/:id
    // ------------------------------------------------------------------
    if (req.method === 'DELETE' && resource === 'links' && id) {
      const { error } = await admin
        .from('chatbot_user_links')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Failed to remove link:', error);
        return createCorsResponse(
          { message: 'Failed to remove link', error: error.message },
          500,
          req,
        );
      }
      return createCorsResponse({ success: true }, 200, req);
    }

    // ------------------------------------------------------------------
    // GET /chatbot/query-log - append-only audit list, newest first
    // ------------------------------------------------------------------
    if (req.method === 'GET' && resource === 'query-log' && !id) {
      const { data, error } = await admin
        .from('chatbot_query_log')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        console.error('Failed to list query log:', error);
        return createCorsResponse(
          { message: 'Failed to list query log', error: error.message },
          500,
          req,
        );
      }

      const rows = (data ?? []).map(projectQueryLogRow);
      return createCorsResponse({ data: rows, total: rows.length }, 200, req);
    }

    // ------------------------------------------------------------------
    // POST /chatbot/query - NOT PORTED, on purpose.
    //
    // The answer path is not a route, it is an engine: a six-tool read-only
    // registry (account_summary, rep_activity, pipeline_status,
    // this_week_deltas, at_risk_customers, predicted_failures), each ~50 lines
    // of tenant-scoped Drizzle joins, plus a Claude-routed tool selector with a
    // keyword fallback and the LEGAL-012 crisis gate that has to run before any
    // retrieval. Translating 430 lines of joins to PostgREST in the same change
    // that ports the console would produce WRONG ANSWERS rather than errors —
    // the failure mode is a confident summary of the wrong account.
    //
    // So it stays on Express and says so, rather than 404ing anonymously.
    // Porting it is its own story: it needs CLAUDE_API_KEY in the edge
    // environment (a deployment decision, like Stripe) and each tool verified
    // against real data one at a time.
    // ------------------------------------------------------------------
    if (req.method === 'POST' && resource === 'query') {
      return createCorsResponse(
        {
          message:
            'The chatbot answer engine is not available on this backend yet. ' +
            'Its read-only tool registry and model routing still run on the API server.',
          code: 'CHATBOT_QUERY_NOT_PORTED',
        },
        501,
        req,
      );
    }

    return createCorsResponse({ message: 'Not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in chatbot function:', error);
    return createCorsResponse(
      { message: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
