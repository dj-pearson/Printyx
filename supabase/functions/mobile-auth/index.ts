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
import { createSupabaseServiceClient } from '../_shared/supabase.ts';
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

      // Enrich GoTrue user with tenant/role data from public.users table
      // GoTrue's app_metadata may be empty if user was created outside GoTrue admin
      const userResponse = await enrichUserWithDbProfile(data.session.user);

      // Return in GoTrue-compatible format (matches iOS AuthTokenResponse)
      return createCorsResponse(
        {
          access_token: data.session.access_token,
          token_type: data.session.token_type,
          expires_in: data.session.expires_in,
          expires_at: data.session.expires_at,
          refresh_token: data.session.refresh_token,
          user: userResponse,
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

/**
 * Enrich GoTrue user object with tenant/role data from the public.users table.
 * GoTrue's app_metadata may be empty if the user wasn't created through the
 * admin API with metadata. This ensures the iOS app always gets tenant context.
 */
async function enrichUserWithDbProfile(gotrueUser: Record<string, any>): Promise<Record<string, any>> {
  try {
    const admin = createSupabaseServiceClient();

    // Look up user in public.users by email (IDs may differ between GoTrue and public.users)
    const { data: dbUser, error } = await admin
      .from('users')
      .select('id, tenant_id, role_id, team_id, first_name, last_name, is_platform_user, access_scope')
      .ilike('email', gotrueUser.email)
      .limit(1)
      .maybeSingle();

    if (error || !dbUser) {
      console.warn('[mobile-auth] Could not find user in public.users:', error?.message);
      return gotrueUser;
    }

    // Get role level if user has a role
    let roleLevel: number | null = null;
    if (dbUser.role_id) {
      const { data: role } = await admin
        .from('roles')
        .select('level')
        .eq('id', dbUser.role_id)
        .limit(1)
        .maybeSingle();
      if (role) {
        roleLevel = role.level;
      }
    }

    console.log(`[mobile-auth] Enriched user: tenant=${dbUser.tenant_id}, role_level=${roleLevel}`);

    // Merge database fields into app_metadata and user_metadata
    // Use camelCase keys — the iOS decoder uses convertFromSnakeCase, but
    // GoTrue returns camelCase inside app_metadata, so we match that convention
    return {
      ...gotrueUser,
      app_metadata: {
        ...gotrueUser.app_metadata,
        tenantId: dbUser.tenant_id ?? gotrueUser.app_metadata?.tenantId ?? gotrueUser.app_metadata?.tenant_id,
        roleId: dbUser.role_id ?? gotrueUser.app_metadata?.roleId ?? gotrueUser.app_metadata?.role_id,
        roleLevel: roleLevel ?? gotrueUser.app_metadata?.roleLevel ?? gotrueUser.app_metadata?.role_level,
        teamId: dbUser.team_id ?? gotrueUser.app_metadata?.teamId ?? gotrueUser.app_metadata?.team_id,
        isPlatformUser: dbUser.is_platform_user ?? gotrueUser.app_metadata?.isPlatformUser ?? false,
        accessScope: dbUser.access_scope ?? gotrueUser.app_metadata?.accessScope ?? 'own',
      },
      user_metadata: {
        ...gotrueUser.user_metadata,
        firstName: dbUser.first_name ?? gotrueUser.user_metadata?.firstName ?? gotrueUser.user_metadata?.first_name,
        lastName: dbUser.last_name ?? gotrueUser.user_metadata?.lastName ?? gotrueUser.user_metadata?.last_name,
      },
    };
  } catch (err) {
    console.error('[mobile-auth] Error enriching user profile:', err);
    return gotrueUser;
  }
}
