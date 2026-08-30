// User Edge Function
// Handles current user profile and preferences
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import {
  buildUserProfileUpdate,
  toUserProfile,
  USER_PROFILE_COLUMNS,
  type UserRow,
} from '../_shared/user-profile.ts';

export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Extract and validate JWT
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    // Use service_role client for database operations
    const admin = createSupabaseServiceClient();

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    // Handle both path formats:
    // - If pathname includes function name: /user/profile → pathParts[1]
    // - If pathname is just the endpoint (server.ts strips function name): /profile → pathParts[0]
    const endpoint = pathParts[0] === 'user' ? pathParts[1] : pathParts[0];

    // user_settings.tenant_id is NOT NULL, so every upsert below needs one. The
    // JWT carries it under either spelling depending on when the claim was
    // issued, and the `users` row is the fallback for a token that carries
    // neither - without that fallback the write fails with a not-null violation
    // that reads like a bug in the settings form.
    const jwtTenantId =
      (user.app_metadata?.tenantId as string | undefined) ??
      (user.app_metadata?.tenant_id as string | undefined) ??
      (user.user_metadata?.tenantId as string | undefined) ??
      (user.user_metadata?.tenant_id as string | undefined) ??
      null;
    const resolveTenantId = async (): Promise<string | null> => {
      if (jwtTenantId) return jwtTenantId;
      const { data } = await admin
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .maybeSingle();
      return (data?.tenant_id as string | undefined) ?? null;
    };

    // GET /user or /user/profile - Get current user profile
    if (req.method === 'GET' && (!endpoint || endpoint === 'profile')) {
      // COP-M01: this list named name, avatar_url, phone, department, job_title,
      // timezone and locale. `users` has none of them (first_name/last_name,
      // profile_image_url, and a metadata jsonb for the rest), so the select
      // 42703'd, the error branch below fired on every request, and the settings
      // page rendered whatever the JWT happened to carry.
      const { data: profile, error } = await admin
        .from('users')
        .select(
          `
          ${USER_PROFILE_COLUMNS},
          roles (
            id,
            name,
            level,
            permissions
          )
        `,
        )
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        // Return basic info from JWT if DB fetch fails
        return createCorsResponse(
          {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.name || user.email?.split('@')[0],
            tenantId: user.app_metadata?.tenantId || user.app_metadata?.tenant_id,
          },
          200,
          req,
        );
      }

      return createCorsResponse(
        {
          ...profile,
          ...toUserProfile(profile as UserRow),
          tenantId: profile?.tenant_id,
          roleId: profile?.role_id,
          lastLoginAt: profile?.last_login_at,
          createdAt: profile?.created_at,
          updatedAt: profile?.updated_at,
        },
        200,
        req,
      );
    }

    // GET /user/preferences - Get user preferences
    //
    // AUDIT-027: both preference handlers used to read and write
    // `user_preferences`, a relation that exists in no Drizzle schema, no
    // migration and no other file in the repository - it was in
    // docs/phantom-tables-baseline.json, named only here. The real table is
    // `user_settings`, which is what GET /settings reads, so the Settings page
    // saved preferences into nothing and then rendered them from somewhere
    // else. This read swallowed the 42P01 and answered 200 with hardcoded
    // defaults, which is why it looked like a user who had set nothing.
    if (req.method === 'GET' && endpoint === 'preferences') {
      const { data: prefs, error } = await admin
        .from('user_settings')
        .select('theme, language, timezone, date_format, time_format, currency, notifications')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error reading preferences:', error);
        return createCorsResponse({ error: 'Failed to read preferences' }, 500, req);
      }

      return createCorsResponse(
        {
          userId: user.id,
          theme: prefs?.theme ?? 'system',
          language: prefs?.language ?? 'en',
          timezone: prefs?.timezone ?? 'America/New_York',
          dateFormat: prefs?.date_format ?? 'MM/dd/yyyy',
          timeFormat: prefs?.time_format ?? '12',
          currency: prefs?.currency ?? 'USD',
          notifications: prefs?.notifications ?? {
            email: true,
            push: true,
            sms: false,
            marketing: false,
          },
        },
        200,
        req,
      );
    }

    // GET /user/permissions - Get user permissions
    if (req.method === 'GET' && endpoint === 'permissions') {
      const { data: userRole } = await admin
        .from('users')
        .select(
          `
          role_id,
          roles (
            id,
            name,
            level,
            permissions
          )
        `,
        )
        .eq('id', user.id)
        .single();

      const permissions = (userRole?.roles as any)?.permissions || [];
      const roleLevel = (userRole?.roles as any)?.level || 1;
      const roleName = (userRole?.roles as any)?.name || 'Guest';

      return createCorsResponse(
        {
          userId: user.id,
          roleId: userRole?.role_id,
          roleName,
          roleLevel,
          permissions,
        },
        200,
        req,
      );
    }

    // GET /user/activity - Get recent user activity
    if (req.method === 'GET' && endpoint === 'activity') {
      const limit = parseInt(url.searchParams.get('limit') || '20');

      // audit_logs timestamps the event in `timestamp`; it has no created_at,
      // so this ordering 42703'd and the activity list came back empty.
      const { data: activities } = await admin
        .from('audit_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false })
        .limit(limit);

      return createCorsResponse(activities || [], 200, req);
    }

    // PUT /user/profile - Update user profile
    if (req.method === 'PUT' && endpoint === 'profile') {
      const body = await req.json();

      // Read the current metadata first: the profile fields that have no column
      // live there, and a partial update must not wipe the ones it does not
      // mention.
      const { data: existing } = await admin
        .from('users')
        .select('metadata')
        .eq('id', user.id)
        .maybeSingle();

      const updateData: Record<string, any> = {
        ...buildUserProfileUpdate(body, (existing?.metadata ?? null) as Record<string, unknown>),
        updated_at: new Date().toISOString(),
      };

      const { data: profile, error } = await admin
        .from('users')
        .update(updateData)
        .eq('id', user.id)
        .select(USER_PROFILE_COLUMNS)
        .single();

      if (error) {
        console.error('Error updating user profile:', error);
        return createCorsResponse(
          { error: 'Failed to update profile', details: error.message },
          500,
          req,
        );
      }

      return createCorsResponse(toUserProfile(profile as UserRow), 200, req);
    }

    // PUT /user/preferences - Update user preferences
    if (req.method === 'PUT' && endpoint === 'preferences') {
      const tenantId = await resolveTenantId();
      if (!tenantId) {
        return createCorsResponse({ error: 'No tenant ID found for user' }, 400, req);
      }

      const body = (await req.json()) as Record<string, unknown>;

      // Named columns only. The old version spread the request body straight
      // into the write, so the caller decided what got written; PostgREST
      // rejects an unknown key outright, which is the opposite of Drizzle's
      // silent drop but no better as a contract.
      const updates: Record<string, unknown> = {
        user_id: user.id,
        tenant_id: tenantId,
        updated_at: new Date().toISOString(),
      };
      const columnFor: Record<string, string> = {
        theme: 'theme',
        language: 'language',
        timezone: 'timezone',
        dateFormat: 'date_format',
        date_format: 'date_format',
        timeFormat: 'time_format',
        time_format: 'time_format',
        currency: 'currency',
      };
      for (const [key, column] of Object.entries(columnFor)) {
        if (body[key] !== undefined) updates[column] = body[key];
      }

      // `notifications` is shared with /notification-preferences, which stores
      // the dialog's per-type choices under a `detailed` key on the same jsonb.
      // Writing this tab's four channel toggles over the whole object would
      // erase them, so merge.
      if (body.notifications !== undefined) {
        const { data: current } = await admin
          .from('user_settings')
          .select('notifications')
          .eq('user_id', user.id)
          .maybeSingle();
        updates.notifications = {
          ...((current?.notifications ?? {}) as Record<string, unknown>),
          ...(body.notifications as Record<string, unknown>),
        };
      }

      const { error } = await admin
        .from('user_settings')
        .upsert(updates, { onConflict: 'user_id' });

      if (error) {
        console.error('Error updating preferences:', error);
        return createCorsResponse({ error: 'Failed to update preferences' }, 500, req);
      }

      return createCorsResponse({ message: 'Preferences updated successfully' }, 200, req);
    }

    // GET/PUT /user/notification-preferences - the dialog behind the bell.
    //
    // Nothing served this on either backend: no Express handler existed and no
    // edge branch matched, so it 404'd in dev and in production. The dialog's
    // read sat inside a try/catch that fell back to its own defaults, which is
    // why it looked like it worked; the save had no such fallback and simply
    // failed.
    //
    // Only the user's CHOICES are stored. The catalogue of notification types,
    // with labels and descriptions, is presentation and stays in the component
    // - persisting it here would freeze copy into a jsonb column and silently
    // drop any type added later.
    if (endpoint === 'notification-preferences' && (req.method === 'GET' || req.method === 'PUT')) {
      const { data: current, error: readError } = await admin
        .from('user_settings')
        .select('notifications')
        .eq('user_id', user.id)
        .maybeSingle();

      if (readError) {
        console.error('Error reading notification preferences:', readError);
        return createCorsResponse({ error: 'Failed to read notification preferences' }, 500, req);
      }

      const notifications = (current?.notifications ?? {}) as Record<string, unknown>;

      if (req.method === 'GET') {
        return createCorsResponse(
          (notifications.detailed ?? {}) as Record<string, unknown>,
          200,
          req,
        );
      }

      const tenantId = await resolveTenantId();
      if (!tenantId) {
        return createCorsResponse({ error: 'No tenant ID found for user' }, 400, req);
      }

      const body = (await req.json()) as Record<string, unknown>;
      const { error } = await admin.from('user_settings').upsert(
        {
          user_id: user.id,
          tenant_id: tenantId,
          notifications: { ...notifications, detailed: body },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

      if (error) {
        console.error('Error saving notification preferences:', error);
        return createCorsResponse({ error: 'Failed to save notification preferences' }, 500, req);
      }

      return createCorsResponse({ message: 'Notification preferences saved' }, 200, req);
    }

    // POST /user/update-last-login - Update last login timestamp
    if (req.method === 'POST' && endpoint === 'update-last-login') {
      const { error } = await admin
        .from('users')
        .update({
          last_login_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        console.error('Error updating last login:', error);
      }

      return createCorsResponse({ success: true }, 200, req);
    }

    // GET /user/settings - Get all user settings (combined profile + preferences)
    if (req.method === 'GET' && endpoint === 'settings') {
      // Get user profile
      const { data: profileRow } = await admin
        .from('users')
        .select(USER_PROFILE_COLUMNS)
        .eq('id', user.id)
        .single();
      const profile = toUserProfile(profileRow as UserRow);

      // Get user preferences/settings
      const { data: settings } = await admin
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      // Combine into expected format
      const userSettings = {
        id: user.id,
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email || user.email,
        phone: profile.phone,
        jobTitle: profile.jobTitle,
        department: profile.department,
        bio: settings?.bio || '',
        avatar: profile.avatarUrl,
        theme: settings?.theme || 'system',
        language: settings?.language || 'en',
        timezone: profile.timezone || 'America/New_York',
        dateFormat: settings?.date_format || 'MM/dd/yyyy',
        timeFormat: settings?.time_format || '12',
        currency: settings?.currency || 'USD',
        notifications: settings?.notifications || {
          email: true,
          push: true,
          sms: false,
          marketing: false,
        },
        accessibility: settings?.accessibility || {
          highContrast: false,
          reducedMotion: false,
          fontSize: 'medium',
          screenReader: false,
          keyboardNavigation: false,
          colorBlind: 'none',
          soundEnabled: true,
          voiceCommands: false,
        },
        twoFactorEnabled: settings?.two_factor_enabled || false,
      };

      return createCorsResponse(userSettings, 200, req);
    }

    // PUT /user/password - Update user password
    if (req.method === 'PUT' && endpoint === 'password') {
      const body = await req.json();
      const { currentPassword, newPassword } = body;

      if (!currentPassword || !newPassword) {
        return createCorsResponse(
          { error: 'Current password and new password are required' },
          400,
          req,
        );
      }

      // Use Supabase Auth to update password
      const supabaseWithAuth = createSupabaseClient(req);

      // First verify the current password by trying to sign in
      const { error: signInError } = await supabaseWithAuth.auth.signInWithPassword({
        email: user.email!,
        password: currentPassword,
      });

      if (signInError) {
        return createCorsResponse({ error: 'Current password is incorrect' }, 400, req);
      }

      // Update to new password
      const { error: updateError } = await supabaseWithAuth.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        console.error('Error updating password:', updateError);
        return createCorsResponse({ error: 'Failed to update password' }, 500, req);
      }

      return createCorsResponse({ message: 'Password updated successfully' }, 200, req);
    }

    // PUT /user/accessibility - Update accessibility settings
    if (req.method === 'PUT' && endpoint === 'accessibility') {
      const body = await req.json();

      // Check if settings exist
      const { data: existingSettings } = await admin
        .from('user_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingSettings) {
        const { data: settings, error } = await admin
          .from('user_settings')
          .update({
            accessibility: body.accessibility || body,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) {
          console.error('Error updating accessibility:', error);
          return createCorsResponse({ error: 'Failed to update accessibility settings' }, 500, req);
        }

        return createCorsResponse(settings, 200, req);
      } else {
        // Create new settings record
        const { data: settings, error } = await admin
          .from('user_settings')
          .insert({
            user_id: user.id,
            accessibility: body.accessibility || body,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating accessibility settings:', error);
          return createCorsResponse({ error: 'Failed to create accessibility settings' }, 500, req);
        }

        return createCorsResponse(settings, 201, req);
      }
    }

    // GET /user/export - Export all user data
    if (req.method === 'GET' && endpoint === 'export') {
      // Get user profile
      const { data: profile } = await admin.from('users').select('*').eq('id', user.id).single();

      // Get user settings
      const { data: settings } = await admin
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      // Preferences are columns on user_settings, not a separate row - see the
      // GET /preferences handler. The second read this used to do was against
      // `user_preferences`, which does not exist, so `preferences` in the
      // exported file was always {}.
      const exportData = {
        exportedAt: new Date().toISOString(),
        profile: profile || {},
        settings: settings || {},
      };

      return createCorsResponse(exportData, 200, req);
    }

    // DELETE /user or /user/delete - Delete user account
    if (req.method === 'DELETE' && (!endpoint || endpoint === 'delete')) {
      // One row holds settings and preferences both.
      await admin.from('user_settings').delete().eq('user_id', user.id);

      // Delete the user from the users table
      const { error: deleteError } = await admin.from('users').delete().eq('id', user.id);

      if (deleteError) {
        console.error('Error deleting user:', deleteError);
        return createCorsResponse({ error: 'Failed to delete account' }, 500, req);
      }

      // Delete from Supabase Auth
      const { error: authDeleteError } = await admin.auth.admin.deleteUser(user.id);

      if (authDeleteError) {
        console.error('Error deleting auth user:', authDeleteError);
        // User data is already deleted, so we return success
      }

      return createCorsResponse({ message: 'Account deleted successfully' }, 200, req);
    }

    // Method/endpoint not found
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in user function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
