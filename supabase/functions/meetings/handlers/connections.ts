// Calendar connections — /meetings/calendar/connections[/:id] + /meetings/calendar/sync/:connectionId
// Replaces server/routes/calendar-routes.ts::18-95.
//
// Real DB work against `calendar_connections`. Tokens are REDACTED on every
// response — they never leave the edge function.

import { errorResponse, jsonResponse, validateBody } from '../../_shared/http.ts';
import { z } from 'https://esm.sh/zod@3.22.4';
import type { HandlerCtx } from '../_context.ts';
import { redactConnection, redactConnections } from '../_context.ts';
import { createLogger } from '../../_shared/logger.ts';
import * as google from '../../_shared/google.ts';
import * as microsoft from '../../_shared/microsoft.ts';

const log = createLogger('meetings-connections');

const createSchema = z.object({
  provider: z.enum(['google', 'outlook', 'icloud']),
  providerAccountId: z.string().optional(),
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  calendarId: z.string().optional(),
  calendarName: z.string().optional(),
  isPrimary: z.boolean().optional(),
  tokenExpiresAt: z.string().datetime().optional(),
});

export async function handleConnections(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  const { method, auth, db, requestId, pathParts } = ctx;
  // pathParts: ['calendar', 'connections', ...] or ['calendar', 'sync', ':id']
  const action = pathParts[1];
  const id = pathParts[2];

  // POST /calendar/sync/:connectionId — pull events from external calendar
  if (method === 'POST' && action === 'sync' && id) {
    return await syncConnection(req, ctx, id);
  }

  if (action !== 'connections') return null;

  // GET /calendar/connections
  if (method === 'GET' && !id) {
    const { data, error } = await db
      .from('calendar_connections')
      .select('*')
      .eq('tenant_id', auth.tenantId)
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: false });

    if (error) {
      return errorResponse(500, 'Failed to fetch connections', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }
    return jsonResponse(redactConnections(data), 200, req, requestId);
  }

  // POST /calendar/connections
  if (method === 'POST' && !id) {
    let body;
    try {
      body = await validateBody(createSchema, req);
    } catch (err) {
      return errorResponse(400, 'Invalid connection payload', req, {
        code: 'VALIDATION',
        details: (err as { issues?: unknown }).issues,
        requestId,
      });
    }

    const { data, error } = await db
      .from('calendar_connections')
      .insert({
        tenant_id: auth.tenantId,
        user_id: auth.userId,
        provider: body.provider,
        provider_account_id: body.providerAccountId ?? auth.email ?? auth.userId,
        access_token: body.accessToken,
        refresh_token: body.refreshToken ?? null,
        token_expires_at: body.tokenExpiresAt ?? null,
        calendar_id: body.calendarId ?? 'primary',
        calendar_name: body.calendarName ?? 'Primary Calendar',
        is_primary: body.isPrimary ?? false,
        sync_enabled: true,
      })
      .select('*')
      .single();

    if (error) {
      return errorResponse(500, 'Failed to create connection', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }

    return jsonResponse(redactConnection(data), 201, req, requestId);
  }

  // DELETE /calendar/connections/:id
  if (method === 'DELETE' && id) {
    const { error } = await db
      .from('calendar_connections')
      .delete()
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .eq('user_id', auth.userId);

    if (error) {
      return errorResponse(500, 'Failed to delete connection', req, {
        code: 'DB_ERROR',
        details: error.message,
        requestId,
      });
    }

    return jsonResponse({ success: true, deletedId: id }, 200, req, requestId);
  }

  return null;
}

async function syncConnection(
  req: Request,
  ctx: HandlerCtx,
  connectionId: string,
): Promise<Response> {
  const { auth, db, requestId } = ctx;
  const t0 = Date.now();

  const { data: conn, error } = await db
    .from('calendar_connections')
    .select('*')
    .eq('id', connectionId)
    .eq('tenant_id', auth.tenantId)
    .eq('user_id', auth.userId)
    .maybeSingle();

  if (error) {
    return errorResponse(500, 'Failed to load connection', req, {
      code: 'DB_ERROR',
      details: error.message,
      requestId,
    });
  }
  if (!conn) {
    return errorResponse(404, 'Connection not found', req, {
      code: 'NOT_FOUND',
      requestId,
    });
  }

  const now = new Date();
  const timeMin = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const timeMax = new Date(now.getTime() + 30 * 86_400_000).toISOString();

  let eventsSynced = 0;
  let eventsCreated = 0;
  let eventsUpdated = 0;
  let syncStatus: 'success' | 'error' = 'success';
  let errorMessage: string | null = null;

  try {
    if (conn.provider === 'google') {
      const { items } = await google.withAutoRefresh(
        { accessToken: conn.access_token, refreshToken: conn.refresh_token },
        (token) => google.listEvents(token, conn.calendar_id ?? 'primary', { timeMin, timeMax }),
        async (refreshed) => {
          await db
            .from('calendar_connections')
            .update({
              access_token: refreshed.access_token,
              token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
            })
            .eq('id', connectionId);
        },
      );

      for (const ev of items) {
        const startIso = ev.start.dateTime ?? (ev.start.date ? `${ev.start.date}T00:00:00Z` : null);
        const endIso = ev.end.dateTime ?? (ev.end.date ? `${ev.end.date}T23:59:59Z` : null);
        if (!startIso || !endIso || !ev.id) continue;

        const row = {
          tenant_id: auth.tenantId,
          user_id: auth.userId,
          calendar_connection_id: connectionId,
          external_event_id: ev.id,
          title: ev.summary ?? 'Untitled Event',
          description: ev.description ?? null,
          start_time: startIso,
          end_time: endIso,
          is_all_day: !!ev.start.date,
          location: ev.location ?? null,
          attendees: ev.attendees ?? [],
          status: ev.status ?? 'confirmed',
          event_type: 'meeting',
        };

        const { data: existing } = await db
          .from('calendar_events')
          .select('id')
          .eq('tenant_id', auth.tenantId)
          .eq('calendar_connection_id', connectionId)
          .eq('external_event_id', ev.id)
          .maybeSingle();

        if (existing?.id) {
          await db.from('calendar_events').update(row).eq('id', existing.id);
          eventsUpdated += 1;
        } else {
          await db.from('calendar_events').insert(row);
          eventsCreated += 1;
        }
        eventsSynced += 1;
      }
    } else if (conn.provider === 'outlook') {
      const { value } = await microsoft.withAutoRefresh(
        { accessToken: conn.access_token, refreshToken: conn.refresh_token },
        (token) => microsoft.listEvents(token, { startDateTime: timeMin, endDateTime: timeMax }),
        async (refreshed) => {
          await db
            .from('calendar_connections')
            .update({
              access_token: refreshed.access_token,
              refresh_token: refreshed.refresh_token ?? conn.refresh_token,
              token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
            })
            .eq('id', connectionId);
        },
      );

      for (const ev of value) {
        if (!ev.id) continue;
        const row = {
          tenant_id: auth.tenantId,
          user_id: auth.userId,
          calendar_connection_id: connectionId,
          external_event_id: ev.id,
          title: ev.subject ?? 'Untitled Event',
          description: ev.body?.content ?? null,
          start_time: ev.start.dateTime,
          end_time: ev.end.dateTime,
          is_all_day: ev.isAllDay ?? false,
          location: ev.location?.displayName ?? null,
          attendees: (ev.attendees ?? []).map((a) => a.emailAddress?.address).filter(Boolean),
          status: ev.showAs === 'free' ? 'tentative' : 'confirmed',
          event_type: 'meeting',
        };

        const { data: existing } = await db
          .from('calendar_events')
          .select('id')
          .eq('tenant_id', auth.tenantId)
          .eq('calendar_connection_id', connectionId)
          .eq('external_event_id', ev.id)
          .maybeSingle();

        if (existing?.id) {
          await db.from('calendar_events').update(row).eq('id', existing.id);
          eventsUpdated += 1;
        } else {
          await db.from('calendar_events').insert(row);
          eventsCreated += 1;
        }
        eventsSynced += 1;
      }
    } else {
      return errorResponse(400, `Unsupported provider: ${conn.provider}`, req, {
        code: 'UNSUPPORTED_PROVIDER',
        requestId,
      });
    }
  } catch (err) {
    log.error({ connectionId, err: String(err) }, 'sync_failed');
    syncStatus = 'error';
    errorMessage = String(err).slice(0, 500);
  }

  const durationMs = Date.now() - t0;

  // Record sync log; non-blocking if it fails.
  await db.from('calendar_sync_logs').insert({
    calendar_connection_id: connectionId,
    sync_type: 'full',
    sync_status: syncStatus,
    events_synced: eventsSynced,
    events_created: eventsCreated,
    events_updated: eventsUpdated,
    events_deleted: 0,
    error_message: errorMessage,
    sync_duration_ms: durationMs,
  });

  if (syncStatus === 'success') {
    await db
      .from('calendar_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connectionId);
  }

  return jsonResponse(
    {
      connectionId,
      status: syncStatus,
      eventsSynced,
      eventsCreated,
      eventsUpdated,
      eventsDeleted: 0,
      durationMs,
      lastSync: new Date().toISOString(),
      error: errorMessage,
    },
    syncStatus === 'success' ? 200 : 502,
    req,
    requestId,
  );
}
