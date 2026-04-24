/**
 * Google Calendar v3 REST wrapper for edge functions.
 *
 * Deno-compatible — plain fetch, no `googleapis` SDK. Covers the calendar ops
 * we actually use (events list/get/insert/patch/delete, freeBusy) plus the
 * OAuth token-refresh path. If a new endpoint is needed, add a thin function
 * here rather than calling fetch inline from a handler.
 *
 * Env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (used only for refresh).
 */

const API_BASE = 'https://www.googleapis.com/calendar/v3';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export class GoogleTokenExpiredError extends Error {
  constructor() {
    super('Google access token expired');
    this.name = 'GoogleTokenExpiredError';
  }
}

export class GoogleApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'GoogleApiError';
  }
}

async function request<T>(path: string, accessToken: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (res.status === 401) {
    throw new GoogleTokenExpiredError();
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '<unreadable>');
    throw new GoogleApiError(res.status, `Google Calendar ${res.status}: ${body.slice(0, 300)}`);
  }
  // DELETE returns 204 with no body.
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ─── Events ────────────────────────────────────────────────────────────────

export interface GoogleEventDateTime {
  dateTime?: string;
  date?: string;
  timeZone?: string;
}

export interface GoogleEvent {
  id?: string;
  summary?: string;
  description?: string;
  start: GoogleEventDateTime;
  end: GoogleEventDateTime;
  location?: string;
  attendees?: Array<{ email: string; responseStatus?: string; displayName?: string }>;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  recurrence?: string[];
}

export async function listEvents(
  accessToken: string,
  calendarId: string,
  params: { timeMin?: string; timeMax?: string; maxResults?: number; singleEvents?: boolean } = {},
): Promise<{ items: GoogleEvent[]; nextSyncToken?: string }> {
  const q = new URLSearchParams();
  if (params.timeMin) q.set('timeMin', params.timeMin);
  if (params.timeMax) q.set('timeMax', params.timeMax);
  if (params.maxResults) q.set('maxResults', String(params.maxResults));
  q.set('singleEvents', String(params.singleEvents ?? true));
  q.set('orderBy', 'startTime');

  return request(`/calendars/${encodeURIComponent(calendarId)}/events?${q}`, accessToken);
}

export async function getEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<GoogleEvent> {
  return request(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    accessToken,
  );
}

export async function insertEvent(
  accessToken: string,
  calendarId: string,
  event: GoogleEvent,
): Promise<GoogleEvent> {
  return request(`/calendars/${encodeURIComponent(calendarId)}/events`, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
}

export async function patchEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  patch: Partial<GoogleEvent>,
): Promise<GoogleEvent> {
  return request(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    accessToken,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    },
  );
}

export async function deleteEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  await request(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    accessToken,
    { method: 'DELETE' },
  );
}

// ─── FreeBusy ──────────────────────────────────────────────────────────────

export interface FreeBusyResult {
  calendars: Record<string, { busy: Array<{ start: string; end: string }>; errors?: unknown[] }>;
}

export async function freeBusy(
  accessToken: string,
  calendarIds: string[],
  timeMin: string,
  timeMax: string,
): Promise<FreeBusyResult> {
  return request('/freeBusy', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timeMin,
      timeMax,
      items: calendarIds.map((id) => ({ id })),
    }),
  });
}

// ─── OAuth token refresh ──────────────────────────────────────────────────

export interface RefreshResult {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: 'Bearer';
}

export async function refreshAccessToken(refreshToken: string): Promise<RefreshResult> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET env vars required');
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '<unreadable>');
    throw new Error(`Google token refresh ${res.status}: ${body.slice(0, 200)}`);
  }

  return (await res.json()) as RefreshResult;
}

/**
 * Execute a Google Calendar call with auto-refresh on 401.
 *
 * Usage:
 *   const events = await withAutoRefresh(
 *     { accessToken, refreshToken },
 *     (token) => listEvents(token, 'primary', { timeMin, timeMax }),
 *     async (newTokens) => { /* persist newTokens to calendar_connections *\/ },
 *   );
 */
export async function withAutoRefresh<T>(
  tokens: { accessToken: string; refreshToken: string | null },
  fn: (accessToken: string) => Promise<T>,
  onRefresh?: (refreshed: RefreshResult) => Promise<void>,
): Promise<T> {
  try {
    return await fn(tokens.accessToken);
  } catch (err) {
    if (!(err instanceof GoogleTokenExpiredError) || !tokens.refreshToken) throw err;
    const refreshed = await refreshAccessToken(tokens.refreshToken);
    if (onRefresh) await onRefresh(refreshed);
    return await fn(refreshed.access_token);
  }
}
