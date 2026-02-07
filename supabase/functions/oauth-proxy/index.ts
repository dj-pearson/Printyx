/**
 * OAuth Proxy Edge Function
 * Bypasses GoTrue's GOTRUE_SITE_URL limitation for self-hosted Supabase
 *
 * Flow:
 * 1. Frontend redirects to ?action=authorize&provider=google
 * 2. This function redirects to Google/Apple OAuth consent screen
 * 3. Provider redirects back to ?action=callback with auth code
 * 4. This function exchanges code for tokens, creates/finds Supabase user
 * 5. Generates a magic link token and redirects frontend to /auth/callback
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { handleCors, getCorsHeaders } from '../_shared/cors.ts';

// Configuration from environment variables
const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://printyx.net';
const FUNCTIONS_URL = Deno.env.get('FUNCTIONS_URL') || 'https://functions.printyx.net';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://api.printyx.net';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') || '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';
const APPLE_CLIENT_ID = Deno.env.get('APPLE_CLIENT_ID') || '';
const APPLE_CLIENT_SECRET = Deno.env.get('APPLE_CLIENT_SECRET') || '';

export default async function handler(req: Request): Promise<Response> {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const provider = url.searchParams.get('provider') || 'google';
    const redirectTo = url.searchParams.get('redirect_to') || '/dashboard';
    const functionUrl = `${FUNCTIONS_URL}/oauth-proxy`;

    if (action === 'authorize') {
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      const stateData = btoa(
        JSON.stringify({
          verifier: codeVerifier,
          redirectTo: redirectTo,
          provider: provider,
        }),
      );

      let authUrl: URL;

      if (provider === 'google') {
        if (!GOOGLE_CLIENT_ID) {
          return errorRedirect('Google OAuth is not configured');
        }
        authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', `${functionUrl}?action=callback`);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', 'openid email profile');
        authUrl.searchParams.set('state', stateData);
        authUrl.searchParams.set('code_challenge', codeChallenge);
        authUrl.searchParams.set('code_challenge_method', 'S256');
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('prompt', 'consent');
      } else if (provider === 'apple') {
        if (!APPLE_CLIENT_ID) {
          return errorRedirect('Apple OAuth is not configured');
        }
        authUrl = new URL('https://appleid.apple.com/auth/authorize');
        authUrl.searchParams.set('client_id', APPLE_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', `${functionUrl}?action=callback`);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', 'name email');
        authUrl.searchParams.set('state', stateData);
        authUrl.searchParams.set('response_mode', 'query');
      } else {
        const origin = req.headers.get('origin');
        return new Response(JSON.stringify({ error: 'Unsupported provider' }), {
          status: 400,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
        });
      }

      return new Response(null, {
        status: 302,
        headers: { Location: authUrl.toString() },
      });
    }

    if (action === 'callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error) {
        const errorUrl = new URL(`${FRONTEND_URL}/auth/callback`);
        errorUrl.searchParams.set('error', error);
        errorUrl.searchParams.set(
          'error_description',
          url.searchParams.get('error_description') || 'OAuth provider returned an error',
        );
        return new Response(null, { status: 302, headers: { Location: errorUrl.toString() } });
      }

      if (!code || !state) {
        return errorRedirect('Missing authorization code or state parameter');
      }

      let stateData;
      try {
        stateData = JSON.parse(atob(state));
      } catch {
        return errorRedirect('Invalid state parameter');
      }

      const { verifier, redirectTo: finalRedirect, provider: stateProvider } = stateData;
      let tokenData;

      // Exchange authorization code for tokens
      if (stateProvider === 'google') {
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            code: code,
            code_verifier: verifier,
            grant_type: 'authorization_code',
            redirect_uri: `${functionUrl}?action=callback`,
          }),
        });
        tokenData = await tokenResponse.json();
      } else if (stateProvider === 'apple') {
        const tokenResponse = await fetch('https://appleid.apple.com/auth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: APPLE_CLIENT_ID,
            client_secret: APPLE_CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: `${functionUrl}?action=callback`,
          }),
        });
        tokenData = await tokenResponse.json();
      } else {
        return errorRedirect('Unknown provider in state');
      }

      if (tokenData.error) {
        console.error('Token exchange error:', tokenData);
        return errorRedirect(tokenData.error_description || tokenData.error);
      }

      // Decode ID token to get user info
      const payload = JSON.parse(atob(tokenData.id_token.split('.')[1]));

      // Create Supabase admin client
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Check if user already exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(
        (u: any) => u.email === payload.email,
      );

      if (!existingUser) {
        // Create new user with confirmed email
        const { error: createError } = await supabase.auth.admin.createUser({
          email: payload.email,
          email_confirm: true,
          user_metadata: {
            full_name: payload.name || `${payload.given_name || ''} ${payload.family_name || ''}`.trim(),
            avatar_url: payload.picture,
            provider: stateProvider,
          },
          app_metadata: {
            provider: stateProvider,
            providers: [stateProvider],
          },
        });
        if (createError) {
          console.error('Create user error:', createError);
          return errorRedirect('Failed to create user account');
        }
      }

      // Generate magic link for session establishment
      const { data, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: payload.email,
        options: { redirectTo: `${FRONTEND_URL}${finalRedirect}` },
      });

      if (linkError) {
        console.error('Generate link error:', linkError);
        return errorRedirect('Failed to generate authentication link');
      }

      // Extract token from the magic link and redirect to frontend
      const magicLinkUrl = new URL(data.properties.action_link);
      const token = magicLinkUrl.searchParams.get('token');
      const type = magicLinkUrl.searchParams.get('type');

      const successUrl = new URL(`${FRONTEND_URL}/auth/callback`);
      successUrl.searchParams.set('token', token || '');
      successUrl.searchParams.set('type', type || 'magiclink');
      successUrl.searchParams.set('redirect_to', finalRedirect);
      if (!existingUser) successUrl.searchParams.set('new_user', 'true');

      return new Response(null, { status: 302, headers: { Location: successUrl.toString() } });
    }

    // Default: return usage info
    const origin = req.headers.get('origin');
    return new Response(
      JSON.stringify({
        usage: 'Call with ?action=authorize&provider=google to start OAuth flow',
        providers: ['google', 'apple'],
      }),
      {
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('OAuth proxy error:', error);
    return errorRedirect((error as Error).message);
  }
}

function errorRedirect(message: string): Response {
  const errorUrl = new URL(`${FRONTEND_URL}/auth/callback`);
  errorUrl.searchParams.set('error', 'oauth_error');
  errorUrl.searchParams.set('error_description', message);
  return new Response(null, { status: 302, headers: { Location: errorUrl.toString() } });
}

// PKCE helpers
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
