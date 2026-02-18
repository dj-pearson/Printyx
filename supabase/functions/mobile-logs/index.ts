/**
 * Mobile Logs Edge Function
 *
 * Receives batched log entries from the Printyx mobile app and writes
 * them to the Deno server console. This allows real-time debugging of
 * mobile issues by checking the edge function server logs.
 *
 * POST /mobile-logs
 * Body: { deviceId, sessionId, platform, appVersion, entries: LogEntry[] }
 *
 * No authentication required — logging should work even when auth is broken.
 */

import { getCorsHeaders, handleCors } from '/app/functions/_shared/cors.ts';

export default async function handler(req: Request): Promise<Response> {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: jsonHeaders },
    );
  }

  try {
    const body = await req.json();
    const { deviceId, sessionId, platform, appVersion, entries } = body;

    if (!Array.isArray(entries) || entries.length === 0) {
      return new Response(
        JSON.stringify({ received: 0 }),
        { status: 200, headers: jsonHeaders },
      );
    }

    // Write each entry to console for server log visibility
    const tag = `[mobile:${platform || '?'}:${deviceId?.slice(0, 12) || '?'}]`;
    for (const entry of entries) {
      const level = (entry.level || 'info').toUpperCase().padEnd(5);
      const screen = entry.screen ? `[${entry.screen}]` : '';
      const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : '';
      console.log(`${tag} ${level} ${screen} ${entry.message}${dataStr}`);
    }

    console.log(`${tag} Received ${entries.length} log entries (session: ${sessionId?.slice(0, 8)}, v${appVersion})`);

    return new Response(
      JSON.stringify({ received: entries.length }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (err) {
    console.error('[mobile-logs] Parse error:', err.message);
    return new Response(
      JSON.stringify({ error: 'Invalid request body' }),
      { status: 400, headers: jsonHeaders },
    );
  }
}
