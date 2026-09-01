// Calendar OAuth — authorize + callback for CALENDAR scopes.
//
// PA-056: a user could never connect a calendar in production. The two
// authorize flows that existed were neither of them this:
//
//   supabase/functions/oauth-proxy  requests openid/email/profile for SIGN-IN,
//                                   and its callback creates a Supabase session.
//   server/integrations/routes.ts   the real Google/Microsoft calendar consent
//                                   flow - Express-only, which the browser
//                                   cannot reach in production because
//                                   getApiUrl sends /api/* to the functions
//                                   host, AND it writes system_integrations
//                                   while the events code reads
//                                   calendar_connections.
//
// CANONICAL STORE (PA-056 AC3): `calendar_connections`. The events handler and
// its push propagation read it, it carries the token columns, and it has a
// UNIQUE (tenant_id, user_id, provider, calendar_id) to upsert on.
// system_integrations stays the generic third-party connection registry (ERP).
//
// Two halves with different auth, which is why this is its own function rather
// than a branch of `meetings`:
//   POST /calendar-oauth/authorize  needs a JWT - it is how the tenant and user
//                                   are known, and they go into a SIGNED state.
//   GET  /calendar-oauth/callback   has no JWT. It is a redirect the provider
//                                   makes; identity comes from the state, which
//                                   is why the state is signed and short-lived.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { decodeState, encodeState } from './_state.ts';

const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://printyx.net';
const FUNCTIONS_URL = Deno.env.get('FUNCTIONS_URL') || 'https://functions.printyx.net';

// Calendar scopes, NOT sign-in scopes. Kept identical to
// server/integrations/oauth-config.ts so a connection made on either host asks
// for the same access.
const PROVIDERS = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ],
    clientIdEnv: 'GOOGLE_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
  },
  microsoft: {
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: [
      'https://graph.microsoft.com/calendars.readwrite',
      'https://graph.microsoft.com/user.read',
      'offline_access',
    ],
    clientIdEnv: 'MICROSOFT_CLIENT_ID',
    clientSecretEnv: 'MICROSOFT_CLIENT_SECRET',
  },
} as const;

type ProviderKey = keyof typeof PROVIDERS;

const REDIRECT_URI = `${FUNCTIONS_URL}/calendar-oauth/callback`;

function frontendRedirect(path: string, params: Record<string, string>): Response {
  const url = new URL(path, FRONTEND_URL);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const url = new URL(req.url);
  const { parts } = normalizePath(url.pathname, 'calendar-oauth');
  const action = parts[0];

  try {
    // ─── GET /calendar-oauth/callback ─────────────────────────────────────
    // Deliberately before the auth gate: the provider sends no JWT.
    if (req.method === 'GET' && action === 'callback') {
      const error = url.searchParams.get('error');
      if (error) {
        return frontendRedirect('/settings/integrations', {
          calendar: 'error',
          reason: url.searchParams.get('error_description') || error,
        });
      }

      const state = await decodeState(url.searchParams.get('state'));
      const code = url.searchParams.get('code');

      if (!state || !code) {
        // An unsigned, tampered, or expired state is indistinguishable from an
        // attempt to attach a calendar to someone else's tenant. Say nothing
        // more specific than that.
        return frontendRedirect('/settings/integrations', {
          calendar: 'error',
          reason: 'The consent link was invalid or has expired. Please try again.',
        });
      }

      const provider = PROVIDERS[state.provider];
      const clientId = Deno.env.get(provider.clientIdEnv);
      const clientSecret = Deno.env.get(provider.clientSecretEnv);

      if (!clientId || !clientSecret) {
        return frontendRedirect('/settings/integrations', {
          calendar: 'error',
          reason: `${state.provider} calendar OAuth is not configured on this server.`,
        });
      }

      const tokenResponse = await fetch(provider.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        console.error('Calendar token exchange failed:', await tokenResponse.text());
        return frontendRedirect('/settings/integrations', {
          calendar: 'error',
          reason: 'The provider rejected the authorization code.',
        });
      }

      const tokens = await tokenResponse.json();

      // No refresh token means the connection dies at the first expiry and
      // cannot be renewed. Google only returns one with prompt=consent and
      // access_type=offline, which the authorize step sets; say so rather than
      // storing a connection that will stop working silently.
      if (!tokens.refresh_token) {
        return frontendRedirect('/settings/integrations', {
          calendar: 'error',
          reason:
            'The provider did not return a refresh token, so the connection could not be kept alive. Revoke the app and try again.',
        });
      }

      const admin = createSupabaseServiceClient();
      const expiresAt = tokens.expires_in
        ? new Date(Date.now() + Number(tokens.expires_in) * 1000).toISOString()
        : null;

      // UNIQUE (tenant_id, user_id, provider, calendar_id) - reconnecting
      // replaces the tokens rather than stacking a second row for the same
      // calendar.
      const { error: upsertError } = await admin.from('calendar_connections').upsert(
        {
          tenant_id: state.tenantId,
          user_id: state.userId,
          provider: state.provider,
          provider_account_id: state.userId,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: expiresAt,
          calendar_id: 'primary',
          calendar_name: 'Primary Calendar',
          sync_enabled: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,user_id,provider,calendar_id' },
      );

      if (upsertError) {
        console.error('Failed to store calendar connection:', upsertError);
        return frontendRedirect('/settings/integrations', {
          calendar: 'error',
          reason: 'The calendar was authorized but the connection could not be saved.',
        });
      }

      return frontendRedirect(state.redirectTo || '/settings/integrations', {
        calendar: 'connected',
        provider: state.provider,
      });
    }

    // ─── POST /calendar-oauth/authorize ───────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenant_id as string) ||
      (user.app_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    if (req.method === 'POST' && action === 'authorize') {
      const body = await req.json().catch(() => ({}));
      const requested = String(body.provider ?? '').toLowerCase();
      const providerKey: ProviderKey | null =
        requested === 'google'
          ? 'google'
          : requested === 'microsoft' || requested === 'outlook'
            ? 'microsoft'
            : null;

      if (!providerKey) {
        return createCorsResponse(
          { error: 'provider must be one of: google, microsoft' },
          400,
          req,
        );
      }

      const provider = PROVIDERS[providerKey];
      const clientId = Deno.env.get(provider.clientIdEnv);

      if (!clientId) {
        // Not configured is a real answer and the page renders it. It is not the
        // same as "connecting failed".
        return createCorsResponse(
          {
            error: 'not_configured',
            message: `${providerKey} calendar OAuth is not configured on this server.`,
          },
          501,
          req,
        );
      }

      const state = await encodeState({
        tenantId,
        userId: user.id,
        provider: providerKey,
        redirectTo: String(body.redirectTo ?? '/settings/integrations'),
      });

      const authUrl = new URL(provider.authUrl);
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', provider.scopes.join(' '));
      authUrl.searchParams.set('state', state);
      // Both are required for a refresh token on Google; Microsoft returns one
      // whenever offline_access is in the scope list, which it is.
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');

      return createCorsResponse({ authUrl: authUrl.toString() }, 200, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('Error in calendar-oauth function:', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      500,
      req,
    );
  }
}
