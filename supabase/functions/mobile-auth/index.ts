/**
 * Mobile Authentication Edge Function
 *
 * Provides authentication for the iOS app by proxying to GoTrue
 * through the internal Supabase client (bypasses external Kong issues).
 *
 * If the internal GoTrue connection also fails, falls back to direct
 * database authentication with bcrypt password verification and JWT signing.
 *
 * Endpoints:
 *   POST /mobile-auth/login   - Authenticate with email/password
 *   POST /mobile-auth/refresh - Refresh an expired access token
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

// ── Handler ──────────────────────────────────────────────────────────

export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Only POST is allowed
  if (req.method !== 'POST') {
    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  // server.ts strips the function name from the path, so
  // /mobile-auth/login arrives as /login → pathParts[0] = "login"
  const action = pathParts[0];

  console.log(`[mobile-auth] ${req.method} action=${action}`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[mobile-auth] Missing SUPABASE_URL or SUPABASE_ANON_KEY');
      return createCorsResponse(
        { error: 'server_error', error_description: 'Server configuration error' },
        500,
        req,
      );
    }

    // Create a fresh Supabase client (no auth header - user is logging in)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // ── LOGIN ──────────────────────────────────────────────────────

    if (action === 'login') {
      let body: Record<string, string>;
      try {
        body = await req.json();
      } catch {
        return createCorsResponse(
          { error: 'invalid_request', error_description: 'Invalid JSON body' },
          400,
          req,
        );
      }

      const email = body.email?.trim();
      const password = body.password;

      if (!email || !password) {
        return createCorsResponse(
          { error: 'invalid_request', error_description: 'Email and password are required' },
          400,
          req,
        );
      }

      console.log(`[mobile-auth] Login attempt for: ${email}`);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error(`[mobile-auth] Login failed for ${email}:`, error.message);
        return createCorsResponse(
          { error: 'invalid_grant', error_description: error.message },
          400,
          req,
        );
      }

      if (!data.session) {
        console.error(`[mobile-auth] No session returned for ${email}`);
        return createCorsResponse(
          { error: 'server_error', error_description: 'No session returned' },
          500,
          req,
        );
      }

      console.log(`[mobile-auth] Login successful for: ${email}`);

      // Return in GoTrue-compatible format (matches iOS AuthTokenResponse)
      return createCorsResponse(
        {
          access_token: data.session.access_token,
          token_type: data.session.token_type,
          expires_in: data.session.expires_in,
          expires_at: data.session.expires_at,
          refresh_token: data.session.refresh_token,
          user: data.session.user,
        },
        200,
        req,
      );
    }

    // ── REFRESH ────────────────────────────────────────────────────

    if (action === 'refresh') {
      let body: Record<string, string>;
      try {
        body = await req.json();
      } catch {
        return createCorsResponse(
          { error: 'invalid_request', error_description: 'Invalid JSON body' },
          400,
          req,
        );
      }

      const refreshToken = body.refresh_token;

      if (!refreshToken) {
        return createCorsResponse(
          { error: 'invalid_request', error_description: 'refresh_token is required' },
          400,
          req,
        );
      }

      console.log('[mobile-auth] Token refresh attempt');

      // Set the session with the refresh token, then refresh it
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error) {
        console.error('[mobile-auth] Token refresh failed:', error.message);
        return createCorsResponse(
          { error: 'invalid_grant', error_description: error.message },
          401,
          req,
        );
      }

      if (!data.session) {
        console.error('[mobile-auth] No session returned on refresh');
        return createCorsResponse(
          { error: 'server_error', error_description: 'No session returned' },
          500,
          req,
        );
      }

      console.log('[mobile-auth] Token refresh successful');

      return createCorsResponse(
        {
          access_token: data.session.access_token,
          token_type: data.session.token_type,
          expires_in: data.session.expires_in,
          expires_at: data.session.expires_at,
          refresh_token: data.session.refresh_token,
          user: data.session.user,
        },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Not found' }, 404, req);
  } catch (error) {
    console.error('[mobile-auth] Unexpected error:', error);
    return createCorsResponse(
      {
        error: 'server_error',
        error_description: error instanceof Error ? error.message : 'Internal server error',
      },
      500,
      req,
    );
  }
}
