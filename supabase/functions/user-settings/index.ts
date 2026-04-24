/**
 * User Settings edge function.
 *
 * Replaces: server/routes-settings.ts (handler exports, 295 lines).
 *
 * Named `user-settings` rather than `settings` to avoid conflict with the
 * existing `settings/` edge function, which handles a different namespace
 * (/settings/user, /settings/tenant, /settings/dashboard — admin-ish settings
 * keyed on resource type). This function specifically handles the user-level
 * profile / preferences / accessibility surface from server/routes-settings.ts.
 *
 * URL layout (under /user-settings):
 *   GET    /                     — current user's settings (defaults if none)
 *   PUT    /profile              — update firstName/lastName/email + phone/jobTitle/etc.
 *   PUT    /preferences          — theme/language/timezone/notifications
 *   PUT    /accessibility        — accessibility jsonb
 *   GET    /export               — download user data as JSON
 *   DELETE /account              — delete user's settings + account
 *
 * Deferred (out of scope):
 *   - POST /password    — Supabase Auth handles password changes via
 *                         supabase.auth.updateUser({ password }); no need
 *                         to maintain a bcrypt column in user_settings.
 *   - POST /avatar      — multer-based upload. Replaced by Supabase Storage;
 *                         frontend should POST to a generic storage upload
 *                         endpoint, then PUT /user-settings/profile with the URL.
 */

import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { errorResponse, generateRequestId, jsonResponse } from '../_shared/http.ts';
import { createLogger } from '../_shared/logger.ts';

const log = createLogger('user-settings');

function stripPrefix(path: string): string {
  return (
    path
      .replace(/\/+/g, '/')
      .replace(/^\/user-settings(?=\/|$)/, '')
      .replace(/\/$/, '') || '/'
  );
}

const DEFAULT_SETTINGS = {
  theme: 'system',
  language: 'en',
  timezone: 'America/New_York',
  dateFormat: 'MM/dd/yyyy',
  timeFormat: '12',
  currency: 'USD',
  notifications: {
    email: true,
    push: true,
    sms: false,
    marketing: false,
  },
  accessibility: {
    highContrast: false,
    reducedMotion: false,
    fontSize: 'medium',
    screenReader: false,
    keyboardNavigation: false,
    colorBlind: 'none',
    soundEnabled: true,
    voiceCommands: false,
  },
  twoFactorEnabled: false,
};

export default async function handler(req: Request) {
  const cors = handleCors(req);
  if (cors) return cors;

  const requestId = generateRequestId();
  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  const startedAt = Date.now();

  try {
    const auth = await requireAuth(req);
    const db = getDb();

    const rest = stripPrefix(url.pathname);
    const parts = rest.split('/').filter(Boolean);
    const first = parts[0];

    if (method === 'GET' && !first) {
      const [userRes, settingsRes] = await Promise.all([
        db
          .from('users')
          .select('id, first_name, last_name, email, tenant_id')
          .eq('id', auth.userId)
          .maybeSingle(),
        db.from('user_settings').select('*').eq('user_id', auth.userId).maybeSingle(),
      ]);

      if (userRes.error) {
        return errorResponse(500, 'Failed to load user', req, {
          code: 'DB_ERROR',
          details: userRes.error.message,
          requestId,
        });
      }

      const userRow = (userRes.data ?? {}) as Record<string, unknown>;
      const settingsRow = (settingsRes.data ?? {}) as Record<string, unknown>;

      return jsonResponse(
        {
          id: (settingsRow.id as string | undefined) ?? `settings-${auth.userId}`,
          userId: auth.userId,
          tenantId: (userRow.tenant_id as string | undefined) ?? auth.tenantId,
          firstName: (userRow.first_name as string | undefined) ?? '',
          lastName: (userRow.last_name as string | undefined) ?? '',
          email: (userRow.email as string | undefined) ?? auth.email ?? '',
          ...DEFAULT_SETTINGS,
          ...settingsRow,
        },
        200,
        req,
        requestId,
      );
    }

    if (method === 'PUT' && first === 'profile') {
      let body: Record<string, unknown> = {};
      try {
        body = await req.json();
      } catch {
        return errorResponse(400, 'Invalid JSON body', req, {
          code: 'INVALID_JSON',
          requestId,
        });
      }

      const userUpdates: Record<string, unknown> = {};
      if (body.firstName !== undefined) userUpdates.first_name = body.firstName;
      if (body.lastName !== undefined) userUpdates.last_name = body.lastName;
      if (body.email !== undefined) userUpdates.email = body.email;

      if (Object.keys(userUpdates).length > 0) {
        const { error } = await db.from('users').update(userUpdates).eq('id', auth.userId);
        if (error) {
          return errorResponse(500, 'Failed to update profile', req, {
            code: 'DB_ERROR',
            details: error.message,
            requestId,
          });
        }
      }

      const settingsUpdates: Record<string, unknown> = {};
      for (const key of ['phone', 'jobTitle', 'department', 'bio', 'avatar']) {
        if (body[key] !== undefined) {
          const snake = key.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
          settingsUpdates[snake] = body[key];
        }
      }

      if (Object.keys(settingsUpdates).length > 0) {
        settingsUpdates.user_id = auth.userId;
        settingsUpdates.tenant_id = auth.tenantId;
        settingsUpdates.updated_at = new Date().toISOString();
        await db.from('user_settings').upsert(settingsUpdates, { onConflict: 'user_id' });
      }

      return jsonResponse({ message: 'Profile updated successfully' }, 200, req, requestId);
    }

    if (method === 'PUT' && first === 'preferences') {
      let body: Record<string, unknown> = {};
      try {
        body = await req.json();
      } catch {
        return errorResponse(400, 'Invalid JSON body', req, {
          code: 'INVALID_JSON',
          requestId,
        });
      }

      const updates: Record<string, unknown> = {
        user_id: auth.userId,
        tenant_id: auth.tenantId,
        updated_at: new Date().toISOString(),
      };
      for (const key of [
        'theme',
        'language',
        'timezone',
        'dateFormat',
        'timeFormat',
        'currency',
        'notifications',
      ]) {
        if (body[key] !== undefined) {
          const snake = key.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
          updates[snake] = body[key];
        }
      }

      const { error } = await db.from('user_settings').upsert(updates, { onConflict: 'user_id' });

      if (error) {
        return errorResponse(500, 'Failed to update preferences', req, {
          code: 'DB_ERROR',
          details: error.message,
          requestId,
        });
      }
      return jsonResponse({ message: 'Preferences updated successfully' }, 200, req, requestId);
    }

    if (method === 'PUT' && first === 'accessibility') {
      let body: { accessibility?: Record<string, unknown> } = {};
      try {
        body = await req.json();
      } catch {
        return errorResponse(400, 'Invalid JSON body', req, {
          code: 'INVALID_JSON',
          requestId,
        });
      }

      const { error } = await db.from('user_settings').upsert(
        {
          user_id: auth.userId,
          tenant_id: auth.tenantId,
          accessibility: body.accessibility ?? {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

      if (error) {
        return errorResponse(500, 'Failed to update accessibility settings', req, {
          code: 'DB_ERROR',
          details: error.message,
          requestId,
        });
      }
      return jsonResponse(
        { message: 'Accessibility settings updated successfully' },
        200,
        req,
        requestId,
      );
    }

    if (method === 'GET' && first === 'export') {
      const [userRes, settingsRes] = await Promise.all([
        db.from('users').select('*').eq('id', auth.userId).maybeSingle(),
        db.from('user_settings').select('*').eq('user_id', auth.userId).maybeSingle(),
      ]);

      const user = userRes.data as Record<string, unknown> | null;
      const exportData = {
        profile: {
          id: user?.id,
          email: user?.email,
          firstName: user?.first_name,
          lastName: user?.last_name,
          profileImageUrl: user?.profile_image_url,
          createdAt: user?.created_at,
        },
        settings: settingsRes.data ?? null,
        exportedAt: new Date().toISOString(),
      };

      return new Response(JSON.stringify(exportData, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="printyx-user-data.json"',
          'X-Request-ID': requestId,
        },
      });
    }

    if (method === 'DELETE' && first === 'account') {
      // Deleting the user row via service-role bypasses RLS. This is a
      // tenant-admin / self-service destructive op — consider gating behind
      // a secondary confirmation token in the future. Matches Express
      // behavior: settings first (FK), then user.
      await db.from('user_settings').delete().eq('user_id', auth.userId);
      const { error } = await db.from('users').delete().eq('id', auth.userId);
      if (error) {
        return errorResponse(500, 'Failed to delete account', req, {
          code: 'DB_ERROR',
          details: error.message,
          requestId,
        });
      }
      return jsonResponse({ message: 'Account deleted successfully' }, 200, req, requestId);
    }

    return errorResponse(404, 'Not found', req, {
      code: 'NOT_FOUND',
      details: { path: url.pathname, method },
      requestId,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse(err.status, err.message, req, {
        code: err.code.toUpperCase(),
        details: err.details,
        requestId,
      });
    }
    log.error({ requestId, err: String(err) }, 'request_failed');
    return errorResponse(500, 'Internal server error', req, {
      code: 'INTERNAL',
      requestId,
    });
  } finally {
    log.info(
      { requestId, path: url.pathname, method, durationMs: Date.now() - startedAt },
      'request_complete',
    );
  }
}
