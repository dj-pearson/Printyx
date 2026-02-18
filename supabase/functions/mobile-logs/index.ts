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
 */

import { getCorsHeaders, handleCors } from '/app/functions/_shared/cors.ts';
import { createSupabaseServiceClient } from '/app/functions/_shared/supabase.ts';

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

    // Write each entry to console for server log visibility
    const tag = `[mobile:${platform || '?'}:${deviceId?.slice(0, 12) || '?'}]`;
    for (const entry of entries) {
      const level = (entry.level || 'info').toUpperCase().padEnd(5);
      const screen = entry.screen ? `[${entry.screen}]` : '';
      const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
      console.log(`${tag} ${level} ${screen} ${entry.message}${dataStr}`);
    }

    console.log(
      `${tag} Received ${entries.length} log entries (session: ${sessionId?.slice(0, 8)}, v${appVersion})`,
    );

    // Persist to mobile_app_logs table (fire-and-forget, don't break logging if DB fails)
    try {
      const supabase = createSupabaseServiceClient();
      const rows = entries.map((entry: any) => ({
        device_id: deviceId || null,
        session_id: sessionId || null,
        platform: platform || null,
        app_version: appVersion || null,
        level: entry.level || 'info',
        message: String(entry.message || ''),
        screen: entry.screen || null,
        data: entry.data || null,
        log_timestamp: entry.timestamp ? new Date(entry.timestamp).toISOString() : null,
      }));

      const { error } = await supabase.from('mobile_app_logs').insert(rows);

      if (error) {
        console.error(`${tag} DB insert error (non-fatal):`, error.message);
      }
    } catch (dbErr) {
      console.error(`${tag} DB persist failed (non-fatal):`, dbErr.message);
    }

    return new Response(JSON.stringify({ received: entries.length }), {
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
