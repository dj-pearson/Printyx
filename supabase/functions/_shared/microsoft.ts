/**
 * Microsoft Graph v1.0 REST wrapper for edge functions.
 *
 * Deno-compatible — plain fetch, no `@microsoft/microsoft-graph-client` SDK.
 * Covers the calendar ops we use (events CRUD, freeBusy via /me/calendar/getSchedule)
 * plus OAuth token refresh.
 *
 * Env vars: MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID
 * (tenant is typically 'common' for multi-tenant apps).
 */

const API_BASE = 'https://graph.microsoft.com/v1.0';
const OAUTH_HOST = 'https://login.microsoftonline.com';

export class MicrosoftTokenExpiredError extends Error {
  constructor() {
    super('Microsoft access token expired');
    this.name = 'MicrosoftTokenExpiredError';
  }
}

export class MicrosoftApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'MicrosoftApiError';
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
    throw new MicrosoftTokenExpiredError();
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '<unreadable>');
    throw new MicrosoftApiError(res.status, `Graph ${res.status}: ${body.slice(0, 300)}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ─── Events ────────────────────────────────────────────────────────────────

export interface GraphDateTime {
  dateTime: string;
  timeZone: string;
}

export interface GraphEvent {
  id?: string;
  subject?: string;
  body?: { contentType: 'text' | 'html'; content: string };
  start: GraphDateTime;
  end: GraphDateTime;
  location?: { displayName?: string };
  attendees?: Array<{
    emailAddress: { address: string; name?: string };
    type?: 'required' | 'optional' | 'resource';
  }>;
  showAs?: 'free' | 'tentative' | 'busy' | 'oof' | 'workingElsewhere' | 'unknown';
  isAllDay?: boolean;
}

export async function listEvents(
  accessToken: string,
  params: { startDateTime: string; endDateTime: string; top?: number } = {
    startDateTime: '',
    endDateTime: '',
  },
): Promise<{ value: GraphEvent[]; '@odata.nextLink'?: string }> {
  const q = new URLSearchParams();
  if (params.startDateTime) q.set('startDateTime', params.startDateTime);
  if (params.endDateTime) q.set('endDateTime', params.endDateTime);
  if (params.top) q.set('$top', String(params.top));
  q.set('$orderby', 'start/dateTime');
  return request(`/me/calendarView?${q}`, accessToken);
}

export async function getEvent(accessToken: string, eventId: string): Promise<GraphEvent> {
  return request(`/me/events/${encodeURIComponent(eventId)}`, accessToken);
}

export async function insertEvent(accessToken: string, event: GraphEvent): Promise<GraphEvent> {
  return request('/me/events', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
}

export async function patchEvent(
  accessToken: string,
  eventId: string,
  patch: Partial<GraphEvent>,
): Promise<GraphEvent> {
  return request(`/me/events/${encodeURIComponent(eventId)}`, accessToken, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export async function deleteEvent(accessToken: string, eventId: string): Promise<void> {
  await request(`/me/events/${encodeURIComponent(eventId)}`, accessToken, {
    method: 'DELETE',
  });
}

// ─── getSchedule (free/busy) ──────────────────────────────────────────────

export interface ScheduleItem {
  scheduleId: string;
  availabilityView: string;
  scheduleItems: Array<{
    status: string;
    subject?: string;
    start: GraphDateTime;
    end: GraphDateTime;
  }>;
}

export async function getSchedule(
  accessToken: string,
  schedules: string[],
  startDateTime: string,
  endDateTime: string,
  availabilityViewInterval = 30,
): Promise<{ value: ScheduleItem[] }> {
  return request('/me/calendar/getSchedule', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schedules,
      startTime: { dateTime: startDateTime, timeZone: 'UTC' },
      endTime: { dateTime: endDateTime, timeZone: 'UTC' },
      availabilityViewInterval,
    }),
  });
}

// ─── OAuth token refresh ──────────────────────────────────────────────────

export interface RefreshResult {
  access_token: string;
  expires_in: number;
  refresh_token?: string; // Microsoft rotates refresh tokens
  scope: string;
  token_type: 'Bearer';
}

export async function refreshAccessToken(
  refreshToken: string,
  opts: { tenant?: string; scope?: string } = {},
): Promise<RefreshResult> {
  const clientId = Deno.env.get('MICROSOFT_CLIENT_ID');
  const clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    throw new Error('MICROSOFT_CLIENT_ID + MICROSOFT_CLIENT_SECRET env vars required');
  }
  const tenant = opts.tenant ?? Deno.env.get('MICROSOFT_TENANT_ID') ?? 'common';
  const scope = opts.scope ?? 'https://graph.microsoft.com/.default offline_access';

  const res = await fetch(`${OAUTH_HOST}/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '<unreadable>');
    throw new Error(`Microsoft token refresh ${res.status}: ${body.slice(0, 200)}`);
  }

  return (await res.json()) as RefreshResult;
}

export async function withAutoRefresh<T>(
  tokens: { accessToken: string; refreshToken: string | null },
  fn: (accessToken: string) => Promise<T>,
  onRefresh?: (refreshed: RefreshResult) => Promise<void>,
): Promise<T> {
  try {
    return await fn(tokens.accessToken);
  } catch (err) {
    if (!(err instanceof MicrosoftTokenExpiredError) || !tokens.refreshToken) throw err;
    const refreshed = await refreshAccessToken(tokens.refreshToken);
    if (onRefresh) await onRefresh(refreshed);
    return await fn(refreshed.access_token);
  }
}
