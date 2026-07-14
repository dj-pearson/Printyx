// CRMX-016 — best-effort calendar provider push for public bookings.
//
// Adapted from meetings/handlers/events.ts, but the public booking fn has no
// AuthContext, so the connection is loaded with an explicit (adminClient,
// tenantId). All failures are swallowed and returned as a result object — a
// provider outage must never fail the booking (the local row is authoritative).

import * as google from '../_shared/google.ts';
import * as microsoft from '../_shared/microsoft.ts';
import type { SupabaseClient } from '../_shared/db.ts';

export interface ProviderEvent {
  title: string;
  description: string | null;
  start_time: string; // ISO
  end_time: string; // ISO
  location: string | null;
  attendees: Array<{ email: string; displayName?: string }>;
}

export interface PushResult {
  status: 'skipped' | 'success' | 'failed';
  provider?: 'google' | 'outlook';
  externalEventId?: string | null;
  error?: string;
}

interface Conn {
  provider: 'google' | 'outlook';
  accessToken: string;
  refreshToken: string | null;
  calendarId: string;
}

async function loadConnection(
  db: SupabaseClient,
  tenantId: string,
  connectionId: string,
): Promise<Conn | { error: string }> {
  const { data, error } = await db
    .from('calendar_connections')
    .select('provider, access_token, refresh_token, calendar_id')
    .eq('id', connectionId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: 'connection_not_found' };
  if (!data.access_token) return { error: 'connection_missing_access_token' };
  if (data.provider !== 'google' && data.provider !== 'outlook') {
    return { error: `unsupported_provider:${data.provider}` };
  }
  return {
    provider: data.provider,
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    calendarId: data.calendar_id ?? 'primary',
  };
}

function persistGoogle(db: SupabaseClient, connectionId: string) {
  return async (refreshed: google.RefreshResult) => {
    await db
      .from('calendar_connections')
      .update({
        access_token: refreshed.access_token,
        token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      })
      .eq('id', connectionId);
  };
}

function persistMicrosoft(db: SupabaseClient, connectionId: string, fallback: string | null) {
  return async (refreshed: microsoft.RefreshResult) => {
    await db
      .from('calendar_connections')
      .update({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token ?? fallback,
        token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      })
      .eq('id', connectionId);
  };
}

function toGoogle(ev: ProviderEvent): google.GoogleEvent {
  return {
    summary: ev.title,
    description: ev.description ?? undefined,
    start: { dateTime: ev.start_time, timeZone: 'UTC' },
    end: { dateTime: ev.end_time, timeZone: 'UTC' },
    location: ev.location ?? undefined,
    attendees: ev.attendees.map((a) => ({ email: a.email, displayName: a.displayName })),
    status: 'confirmed',
  };
}

function toGraph(ev: ProviderEvent): microsoft.GraphEvent {
  return {
    subject: ev.title,
    body: ev.description ? { contentType: 'text', content: ev.description } : undefined,
    start: { dateTime: ev.start_time, timeZone: 'UTC' },
    end: { dateTime: ev.end_time, timeZone: 'UTC' },
    location: ev.location ? { displayName: ev.location } : undefined,
    attendees: ev.attendees.map((a) => ({
      emailAddress: { address: a.email, name: a.displayName },
      type: 'required' as const,
    })),
  };
}

export async function pushInsert(
  db: SupabaseClient,
  tenantId: string,
  connectionId: string,
  ev: ProviderEvent,
): Promise<PushResult> {
  const conn = await loadConnection(db, tenantId, connectionId);
  if ('error' in conn) return { status: 'failed', error: conn.error };
  try {
    if (conn.provider === 'google') {
      const created = await google.withAutoRefresh(
        { accessToken: conn.accessToken, refreshToken: conn.refreshToken },
        (t) => google.insertEvent(t, conn.calendarId, toGoogle(ev)),
        persistGoogle(db, connectionId),
      );
      return { status: 'success', provider: 'google', externalEventId: created.id ?? null };
    }
    const created = await microsoft.withAutoRefresh(
      { accessToken: conn.accessToken, refreshToken: conn.refreshToken },
      (t) => microsoft.insertEvent(t, toGraph(ev)),
      persistMicrosoft(db, connectionId, conn.refreshToken),
    );
    return { status: 'success', provider: 'outlook', externalEventId: created.id ?? null };
  } catch (err) {
    return { status: 'failed', provider: conn.provider, error: String(err).slice(0, 300) };
  }
}

export async function pushPatch(
  db: SupabaseClient,
  tenantId: string,
  connectionId: string,
  externalEventId: string,
  ev: ProviderEvent,
): Promise<PushResult> {
  const conn = await loadConnection(db, tenantId, connectionId);
  if ('error' in conn) return { status: 'failed', error: conn.error };
  try {
    if (conn.provider === 'google') {
      await google.withAutoRefresh(
        { accessToken: conn.accessToken, refreshToken: conn.refreshToken },
        (t) => google.patchEvent(t, conn.calendarId, externalEventId, toGoogle(ev)),
        persistGoogle(db, connectionId),
      );
      return { status: 'success', provider: 'google', externalEventId };
    }
    await microsoft.withAutoRefresh(
      { accessToken: conn.accessToken, refreshToken: conn.refreshToken },
      (t) => microsoft.patchEvent(t, externalEventId, toGraph(ev)),
      persistMicrosoft(db, connectionId, conn.refreshToken),
    );
    return { status: 'success', provider: 'outlook', externalEventId };
  } catch (err) {
    return { status: 'failed', provider: conn.provider, error: String(err).slice(0, 300) };
  }
}

export async function pushDelete(
  db: SupabaseClient,
  tenantId: string,
  connectionId: string,
  externalEventId: string,
): Promise<PushResult> {
  const conn = await loadConnection(db, tenantId, connectionId);
  if ('error' in conn) return { status: 'failed', error: conn.error };
  try {
    if (conn.provider === 'google') {
      await google.withAutoRefresh(
        { accessToken: conn.accessToken, refreshToken: conn.refreshToken },
        (t) => google.deleteEvent(t, conn.calendarId, externalEventId),
        persistGoogle(db, connectionId),
      );
      return { status: 'success', provider: 'google', externalEventId };
    }
    await microsoft.withAutoRefresh(
      { accessToken: conn.accessToken, refreshToken: conn.refreshToken },
      (t) => microsoft.deleteEvent(t, externalEventId),
      persistMicrosoft(db, connectionId, conn.refreshToken),
    );
    return { status: 'success', provider: 'outlook', externalEventId };
  } catch (err) {
    return { status: 'failed', provider: conn.provider, error: String(err).slice(0, 300) };
  }
}
