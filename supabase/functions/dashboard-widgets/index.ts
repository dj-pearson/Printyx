/**
 * Dashboard widgets edge function.
 *
 * Replaces server/routes-dashboard-widgets.ts. Three endpoints:
 *
 *   GET  /dashboard/user-layout         — load saved layout (or null)
 *   PUT  /dashboard/user-layout         — upsert layout for current user
 *   GET  /dashboard/widgets/:widgetKey  — data for a single widget
 *
 * Widget data queries are centralized in the Postgres function
 *   public.dashboard_widget_data(widget_key, tenant_id, user_id, role_code, level)
 * (see drizzle/functions/dashboard-widget-data.sql). The function enforces
 * tenant isolation via its p_tenant_id parameter, which this handler always
 * sources from the authenticated JWT — never from the request body or query.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { requireAuth, AuthError } from '../_shared/auth.ts';
import { getDb } from '../_shared/db.ts';
import { errorResponse, generateRequestId, jsonResponse } from '../_shared/http.ts';
import { createLogger } from '../_shared/logger.ts';
import { getRoleCode, getRoleLevel } from '../_shared/rbac.ts';

const log = createLogger('dashboard-widgets');

function stripPrefix(path: string): string {
  // Accept both /dashboard/... and bare /... so Supabase's routing quirks are tolerated
  return path.replace(/^\/+/, '/').replace(/^\/dashboard/, '') || '/';
}

serve(async (req) => {
  const corsResult = handleCors(req);
  if (corsResult) return corsResult;

  const requestId = generateRequestId();
  const startedAt = Date.now();
  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  const path = stripPrefix(url.pathname);

  log.info({ requestId, method, path }, 'request_received');

  try {
    const ctx = await requireAuth(req);
    const db = getDb();

    // ─── GET/PUT /dashboard/user-layout ─────────────────────────────────────
    if (path === '/user-layout') {
      if (method === 'GET') {
        const { data, error } = await db
          .from('dashboard_layouts')
          .select('id, widgets')
          .eq('tenant_id', ctx.tenantId)
          .eq('user_id', ctx.userId)
          .eq('is_user_custom', true)
          .limit(1)
          .maybeSingle();

        if (error) {
          return errorResponse(500, 'Failed to fetch dashboard layout', req, {
            code: 'DB_ERROR',
            details: error,
            requestId,
          });
        }

        if (data?.widgets) {
          return jsonResponse({ layout: data.widgets, layoutId: data.id }, 200, req, requestId);
        }
        return jsonResponse({ layout: null }, 200, req, requestId);
      }

      if (method === 'PUT') {
        let body: { layout?: unknown };
        try {
          body = await req.json();
        } catch {
          return errorResponse(400, 'Invalid JSON body', req, {
            code: 'INVALID_JSON',
            requestId,
          });
        }

        const layout = body.layout;
        if (!Array.isArray(layout)) {
          return errorResponse(400, 'Layout must be an array of widget configs', req, {
            code: 'INVALID_LAYOUT',
            requestId,
          });
        }

        // Check for existing custom layout
        const existing = await db
          .from('dashboard_layouts')
          .select('id')
          .eq('tenant_id', ctx.tenantId)
          .eq('user_id', ctx.userId)
          .eq('is_user_custom', true)
          .limit(1)
          .maybeSingle();

        if (existing.error) {
          return errorResponse(500, 'Failed to load existing layout', req, {
            code: 'DB_ERROR',
            details: existing.error,
            requestId,
          });
        }

        if (existing.data) {
          const { error: updateErr } = await db
            .from('dashboard_layouts')
            .update({ widgets: layout, updated_at: new Date().toISOString() })
            .eq('id', existing.data.id);

          if (updateErr) {
            return errorResponse(500, 'Failed to save dashboard layout', req, {
              code: 'DB_ERROR',
              details: updateErr,
              requestId,
            });
          }
          return jsonResponse({ success: true, layoutId: existing.data.id }, 200, req, requestId);
        }

        const insert = await db
          .from('dashboard_layouts')
          .insert({
            name: 'Custom Dashboard',
            tenant_id: ctx.tenantId,
            user_id: ctx.userId,
            is_user_custom: true,
            is_default: false,
            widgets: layout,
            columns: 12,
            gap: 4,
          })
          .select('id')
          .single();

        if (insert.error || !insert.data) {
          return errorResponse(500, 'Failed to save dashboard layout', req, {
            code: 'DB_ERROR',
            details: insert.error,
            requestId,
          });
        }

        return jsonResponse({ success: true, layoutId: insert.data.id }, 200, req, requestId);
      }

      return errorResponse(405, 'Method not allowed', req, {
        code: 'METHOD_NOT_ALLOWED',
        requestId,
      });
    }

    // ─── GET /dashboard/widgets/:widgetKey ──────────────────────────────────
    const widgetMatch = path.match(/^\/widgets\/([a-zA-Z0-9_-]+)$/);
    if (widgetMatch && method === 'GET') {
      const widgetKey = widgetMatch[1];

      const { data, error } = await db.rpc('dashboard_widget_data', {
        p_widget_key: widgetKey,
        p_tenant_id: ctx.tenantId,
        p_user_id: ctx.userId,
        p_role_code: getRoleCode(ctx) ?? null,
        p_role_level: getRoleLevel(ctx),
      });

      if (error) {
        log.error({ requestId, widgetKey, err: error }, 'dashboard_widget_data rpc failed');
        return errorResponse(500, 'Failed to fetch widget data', req, {
          code: 'DB_ERROR',
          details: error,
          requestId,
        });
      }

      // rpc returns the jsonb directly — pass through unchanged
      return jsonResponse(data ?? {}, 200, req, requestId);
    }

    return errorResponse(404, 'Not found', req, {
      code: 'NOT_FOUND',
      details: { path, method },
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
    log.error({ requestId, err: String(err), stack: (err as Error)?.stack }, 'request_failed');
    return errorResponse(500, 'Internal server error', req, {
      code: 'INTERNAL',
      requestId,
    });
  } finally {
    log.info({ requestId, path, method, durationMs: Date.now() - startedAt }, 'request_complete');
  }
});
