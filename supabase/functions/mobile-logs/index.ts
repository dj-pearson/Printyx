/**
 * Mobile Logs Edge Function
 *
 * Receives batched log entries from the Printyx mobile app, writes them
 * to the Deno server console AND persists them to the `mobile_app_logs`
 * table for the admin log viewer.
 *
 * POST /mobile-logs
 * Body: { deviceId, sessionId, platform, appVersion, entries: LogEntry[] }
 *
 * No authentication required — logging should work even when auth is broken.
 * Because it is unauthenticated and writes via the service-role client, every
 * input is bounded/sanitized below to prevent unbounded-insert storage DoS and
 * to keep values within the mobile_app_logs column limits. (Per-device rate
 * limiting would need a shared store and is tracked as a follow-up.)
 */

import { getCorsHeaders, handleCors } from '/app/functions/_shared/cors.ts';
import { createSupabaseServiceClient } from '/app/functions/_shared/supabase.ts';

// Bounds — an anonymous caller must not be able to inject an unbounded batch.
const MAX_ENTRIES = 200; // max log rows accepted per request
const MAX_MESSAGE_LEN = 8000; // chars; column is `text` but keep it sane
const MAX_DATA_BYTES = 16000; // serialized `data` jsonb cap
const MAX_DEVICE_ID = 100; // device_id varchar(100)
const MAX_SESSION_ID = 100; // session_id varchar(100)
const MAX_PLATFORM = 20; // platform varchar(20)
const MAX_APP_VERSION = 20; // app_version varchar(20)
const MAX_LEVEL = 10; // level varchar(10)
const MAX_SCREEN = 100; // screen varchar(100)

function clampStr(value: unknown, max: number): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value);
  return s.length > max ? s.slice(0, max) : s;
}

function clampData(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length > MAX_DATA_BYTES) {
      return { _truncated: true, preview: serialized.slice(0, 500) };
    }
    return value;
  } catch {
    return { _unserializable: true };
  }
}

export default async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  try {
    const body = await req.json();
    const { deviceId, sessionId, platform, appVersion, entries } = body;

    if (!Array.isArray(entries) || entries.length === 0) {
      return new Response(JSON.stringify({ received: 0 }), { status: 200, headers: jsonHeaders });
    }

    // Bound the batch: an anonymous caller must not inject an unbounded number
    // of rows. Accept at most MAX_ENTRIES and report how many were dropped.
    const dropped = Math.max(0, entries.length - MAX_ENTRIES);
    const boundedEntries = entries.slice(0, MAX_ENTRIES);

    // Clamp the shared (per-batch) fields to their column limits.
    const deviceIdClamped = clampStr(deviceId, MAX_DEVICE_ID);
    const sessionIdClamped = clampStr(sessionId, MAX_SESSION_ID);
    const platformClamped = clampStr(platform, MAX_PLATFORM);
    const appVersionClamped = clampStr(appVersion, MAX_APP_VERSION);

    // Write each entry to console for server log visibility
    const tag = `[mobile:${platformClamped || '?'}:${deviceIdClamped?.slice(0, 12) || '?'}]`;
    for (const entry of boundedEntries) {
      const level = (entry.level || 'info').toUpperCase().padEnd(5);
      const screen = entry.screen ? `[${entry.screen}]` : '';
      const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
      console.log(`${tag} ${level} ${screen} ${entry.message}${dataStr}`);
    }

    console.log(
      `${tag} Received ${boundedEntries.length} log entries` +
        (dropped > 0 ? ` (dropped ${dropped} over cap)` : '') +
        ` (session: ${sessionIdClamped?.slice(0, 8)}, v${appVersionClamped})`,
    );

    // Persist to mobile_app_logs table (fire-and-forget, don't break logging if DB fails)
    try {
      const supabase = createSupabaseServiceClient();
      const rows = boundedEntries.map((entry: any) => ({
        device_id: deviceIdClamped,
        session_id: sessionIdClamped,
        platform: platformClamped,
        app_version: appVersionClamped,
        level: clampStr(entry.level, MAX_LEVEL) || 'info',
        message: clampStr(entry.message, MAX_MESSAGE_LEN) || '',
        screen: clampStr(entry.screen, MAX_SCREEN),
        data: clampData(entry.data),
        log_timestamp: entry.timestamp ? new Date(entry.timestamp).toISOString() : null,
      }));

      const { error } = await supabase.from('mobile_app_logs').insert(rows);

      if (error) {
        console.error(`${tag} DB insert error (non-fatal):`, error.message);
      }
    } catch (dbErr) {
      console.error(`${tag} DB persist failed (non-fatal):`, dbErr.message);
    }

    return new Response(JSON.stringify({ received: boundedEntries.length, dropped }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (err) {
    console.error('[mobile-logs] Parse error:', err.message);
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: jsonHeaders,
    });
  }
}
