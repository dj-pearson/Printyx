// Voice Phone Agent Edge Function (US-SUPER-013 / PROD-012)
//
// Production counterpart to server/routes-voice-agent.ts, which had no edge
// function — so the whole after-hours voice-agent surface 404'd in production.
//
// Endpoints (the dispatcher strips the function-name segment first):
//   POST /intake              call-end ingest: identify → summarize → classify →
//                             ticket → escalate P1 → cost → persist
//   GET  /calls?priority=     call log, newest first, + caller company name
//   GET  /calls/:id
//   GET  /settings   PUT /settings
//   GET  /cost                monthly tally, six-month lookback
//   POST /purge-recordings    cron: null out expired recording URLs
//
// The decisions that shape a ticket — priority, redaction, cost, and the
// after-hours gate — come from _shared/voice-agent-logic.ts, which is locked
// against the Express copy by server/tests/unit/voice-agent-logic-parity.test.ts.
// Anything else here is I/O.
//
// summarizeIntake mirrors the Express version rather than always taking the
// offline path: same model, same system prompt, same temperature, same
// deterministic fallback on a missing key or any failure. Skipping it would have
// made production quietly summarise worse than dev whenever CLAUDE_API_KEY is
// set — a divergence in what the technician reads on the ticket.
//
// Carried over deliberately, because diverging silently would be worse than the
// gap itself: credentials are base64-obfuscated rather than encrypted (the
// Express side has the same TODO(vault)), and GET never echoes them — only
// twilioSet / elevenLabsSet markers. The real-time Twilio/ElevenLabs stack is
// still unbuilt on both sides; this ingests a call-end summary.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import {
  classifyPriority,
  estimateCost,
  fallbackSummary,
  isWithinBusinessHours,
  redactPii,
  ticketPriority,
  last10Digits,
  type IntakeSummary,
  type VoiceCallPriority,
} from '../_shared/voice-agent-logic.ts';

type Row = Record<string, any>;

const NINETY_DAYS_MS = 90 * 86_400_000;
const DEFAULT_LANGUAGES = ['en', 'es'];
const PRIORITIES = ['P1', 'P2', 'P3'];

const toCamel = (k: string) => k.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase());

function camelRow(row: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) out[toCamel(k)] = v;
  return out;
}

function credSetMarkers(encryptedConfig: unknown) {
  const cfg = (encryptedConfig ?? {}) as Record<string, unknown>;
  const has = (k: string) => typeof cfg[k] === 'string' && (cfg[k] as string).length > 0;
  return {
    // Either Twilio credential half being present satisfies twilioSet.
    twilioSet: has('twilioAccountSid') || has('twilioAuthToken'),
    elevenLabsSet: has('elevenLabsApiKey'),
  };
}

/** Public settings projection: config + *_set booleans, never raw creds. */
function projectSettings(row: Row) {
  return {
    tenantId: row.tenant_id,
    enabled: row.enabled,
    afterHoursOnly: row.after_hours_only,
    businessHours: row.business_hours ?? null,
    languages: Array.isArray(row.languages) ? row.languages : DEFAULT_LANGUAGES,
    piiRedaction: row.pii_redaction,
    twilioNumber: row.twilio_number ?? null,
    updatedAt: row.updated_at,
    ...credSetMarkers(row.encrypted_config),
  };
}

/** Matches the Express obfuscateCredential (base64, TODO(vault) on both sides). */
function obfuscateCredential(plaintext: string): string {
  return btoa(unescape(encodeURIComponent(plaintext)));
}

/**
 * Extract { detectedIssue, machineRef, callbackNumber, language } from the
 * transcript via Claude JSON extraction, falling back to the deterministic
 * offline summary on ANY failure. Mirrors summarizeIntake in
 * server/routes-voice-agent.ts, including the model and prompt.
 */
async function summarizeIntake(transcript: string): Promise<IntakeSummary> {
  const fallback = fallbackSummary(transcript);
  try {
    const apiKey = Deno.env.get('CLAUDE_API_KEY');
    if (!apiKey) return fallback;
    if (!transcript || !transcript.trim()) return fallback;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        temperature: 0.2,
        system:
          'You extract a service-intake summary from an after-hours phone call transcript for an ' +
          'office-equipment (copier/MFP) dealer. Return ONLY a JSON object, no prose, of the form ' +
          '{"detectedIssue":string,"machineRef":string|null,"callbackNumber":string|null,"language":"en"|"es"}. ' +
          'detectedIssue is a one-line problem summary. machineRef is the model/serial/location if ' +
          'mentioned. callbackNumber is the phone number the caller gave. language is the spoken language.',
        messages: [{ role: 'user', content: `Transcript:\n${transcript}` }],
      }),
    });
    if (!res.ok) return fallback;

    const payload = (await res.json()) as Row;
    const raw = String(payload?.content?.[0]?.text ?? '');
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return fallback;

    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    const str = (v: unknown): string | null => {
      if (typeof v !== 'string') return null;
      const t = v.trim();
      return t.length ? t : null;
    };
    const lang = str(parsed.language);
    return {
      detectedIssue: str(parsed.detectedIssue) ?? fallback.detectedIssue,
      machineRef: str(parsed.machineRef),
      callbackNumber: str(parsed.callbackNumber) ?? fallback.callbackNumber,
      language: lang === 'es' ? 'es' : 'en',
    };
  } catch {
    return fallback;
  }
}

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string);
    if (!tenantId) return createCorsResponse({ message: 'Tenant ID is required' }, 400, req);

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'voice-agent');
    const first = parts[0];
    const second = parts[1];

    const audit = (action: string, extra?: unknown) =>
      console.log(
        JSON.stringify({
          audit: true,
          action,
          tenantId,
          userId: user.id,
          timestamp: new Date().toISOString(),
          ...(extra ? { extra } : {}),
        }),
      );

    async function getOrCreateSettings(): Promise<Row | null> {
      const { data } = await admin
        .from('voice_agent_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (data) return data as Row;
      await admin.from('voice_agent_settings').insert({ tenant_id: tenantId });
      const { data: created } = await admin
        .from('voice_agent_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      return (created as Row) ?? null;
    }

    /** Attach the caller's company name to each call row. */
    async function enrich(rows: Row[]): Promise<Row[]> {
      const ids = [...new Set(rows.map((r) => r.caller_customer_id).filter(Boolean))];
      const names = new Map<string, string | null>();
      if (ids.length) {
        const { data } = await admin
          .from('business_records')
          .select('id, company_name')
          .eq('tenant_id', tenantId)
          .in('id', ids);
        for (const b of (data as Row[]) || []) names.set(b.id, b.company_name ?? null);
      }
      return rows.map((r) => ({
        ...camelRow(r),
        companyName: r.caller_customer_id ? (names.get(r.caller_customer_id) ?? null) : null,
      }));
    }

    // ─── GET /settings, PUT /settings ────────────────────────────────
    if (first === 'settings' && !second) {
      if (req.method === 'GET') {
        const settings = await getOrCreateSettings();
        if (!settings) return createCorsResponse({ message: 'Failed to load settings' }, 500, req);
        return createCorsResponse(projectSettings(settings), 200, req);
      }

      if (req.method === 'PUT') {
        const body = (await req.json().catch(() => ({}))) as Row;
        const current = await getOrCreateSettings();
        if (!current) return createCorsResponse({ message: 'Failed to load settings' }, 500, req);

        const updates: Row = {
          updated_by_user_id: user.id,
          updated_at: new Date().toISOString(),
        };
        const bool = (k: string, col: string) => {
          if (body[k] === undefined) return null;
          if (typeof body[k] !== 'boolean') return `${k} must be a boolean`;
          updates[col] = body[k];
          return null;
        };
        for (const err of [
          bool('enabled', 'enabled'),
          bool('afterHoursOnly', 'after_hours_only'),
          bool('piiRedaction', 'pii_redaction'),
        ]) {
          if (err) return createCorsResponse({ message: 'Invalid input', errors: err }, 400, req);
        }
        if (body.businessHours !== undefined) updates.business_hours = body.businessHours;
        if (body.languages !== undefined) {
          if (!Array.isArray(body.languages)) {
            return createCorsResponse(
              { message: 'Invalid input', errors: 'languages must be an array' },
              400,
              req,
            );
          }
          updates.languages = body.languages;
        }
        if (body.twilioNumber !== undefined) updates.twilio_number = body.twilioNumber;

        // Merge creds, overwriting only the ones supplied.
        const cfg: Record<string, unknown> = {
          ...((current.encrypted_config ?? {}) as Record<string, unknown>),
        };
        let credsTouched = false;
        for (const [key, col] of [
          ['twilioAccountSid', 'twilioAccountSid'],
          ['twilioAuthToken', 'twilioAuthToken'],
          ['elevenLabsApiKey', 'elevenLabsApiKey'],
        ] as const) {
          if (body[key] !== undefined) {
            cfg[col] = obfuscateCredential(String(body[key]));
            credsTouched = true;
          }
        }
        if (credsTouched) updates.encrypted_config = cfg;

        const { data, error } = await admin
          .from('voice_agent_settings')
          .update(updates)
          .eq('tenant_id', tenantId)
          .select()
          .maybeSingle();
        if (error) throw new Error(error.message);

        audit('UPDATE_SETTINGS', {
          enabled: body.enabled,
          afterHoursOnly: body.afterHoursOnly,
          twilioSet: body.twilioAccountSid !== undefined || body.twilioAuthToken !== undefined,
          elevenLabsSet: body.elevenLabsApiKey !== undefined,
        });
        return createCorsResponse(projectSettings((data as Row) ?? current), 200, req);
      }
    }

    // ─── GET /cost ───────────────────────────────────────────────────
    if (first === 'cost' && req.method === 'GET') {
      const since = new Date();
      since.setMonth(since.getMonth() - 5);
      since.setDate(1);
      since.setHours(0, 0, 0, 0);

      const { data, error } = await admin
        .from('voice_agent_calls')
        .select('created_at, twilio_cost, ai_cost, total_cost')
        .eq('tenant_id', tenantId)
        .gte('created_at', since.toISOString());
      if (error) throw new Error(error.message);

      const buckets = new Map<string, Row>();
      for (const r of (data as Row[]) || []) {
        const d = r.created_at ? new Date(r.created_at) : new Date();
        const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const b = buckets.get(month) ?? {
          month,
          twilioCost: 0,
          aiCost: 0,
          totalCost: 0,
          callCount: 0,
        };
        b.twilioCost += Number(r.twilio_cost) || 0;
        b.aiCost += Number(r.ai_cost) || 0;
        b.totalCost += Number(r.total_cost) || 0;
        b.callCount += 1;
        buckets.set(month, b);
      }
      const round4 = (n: number) => Math.round(n * 1e4) / 1e4;
      const months = [...buckets.values()]
        .map((b) => ({
          ...b,
          twilioCost: round4(b.twilioCost),
          aiCost: round4(b.aiCost),
          totalCost: round4(b.totalCost),
        }))
        .sort((a, b) => String(b.month).localeCompare(String(a.month)));

      const now = new Date();
      const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const currentMonth = months.find((m) => m.month === currentKey) ?? {
        month: currentKey,
        twilioCost: 0,
        aiCost: 0,
        totalCost: 0,
        callCount: 0,
      };
      return createCorsResponse({ currentMonth, months }, 200, req);
    }

    // ─── POST /purge-recordings ──────────────────────────────────────
    if (first === 'purge-recordings' && req.method === 'POST') {
      const { data, error } = await admin
        .from('voice_agent_calls')
        .update({ recording_url: null })
        .eq('tenant_id', tenantId)
        .not('recording_url', 'is', null)
        .lt('recording_purge_at', new Date().toISOString())
        .select('id');
      if (error) throw new Error(error.message);
      const purged = ((data as Row[]) || []).length;
      audit('PURGE_RECORDINGS', { purged });
      return createCorsResponse({ purged }, 200, req);
    }

    // ─── GET /calls, GET /calls/:id ──────────────────────────────────
    if (first === 'calls') {
      if (!second && req.method === 'GET') {
        const priority = url.searchParams.get('priority') || undefined;
        let q = admin
          .from('voice_agent_calls')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(200);
        if (priority && PRIORITIES.includes(priority)) q = q.eq('priority', priority);
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        const rows = await enrich((data as Row[]) || []);
        return createCorsResponse({ data: rows, total: rows.length }, 200, req);
      }

      if (second && req.method === 'GET') {
        const { data } = await admin
          .from('voice_agent_calls')
          .select('*')
          .eq('id', second)
          .eq('tenant_id', tenantId)
          .maybeSingle();
        if (!data) return createCorsResponse({ message: 'Call not found' }, 404, req);
        const [enriched] = await enrich([data as Row]);
        return createCorsResponse(enriched, 200, req);
      }
    }

    // ─── POST /intake ────────────────────────────────────────────────
    if (first === 'intake' && req.method === 'POST') {
      const body = (await req.json().catch(() => ({}))) as Row;
      const durationSeconds = Number(body.durationSeconds ?? 0);
      if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
        return createCorsResponse(
          { message: 'Invalid input', errors: 'durationSeconds must be a non-negative number' },
          400,
          req,
        );
      }

      const settings = await getOrCreateSettings();
      if (!settings) {
        return createCorsResponse({ message: 'Failed to load voice-agent settings' }, 500, req);
      }

      // Kill switch, then the after-hours gate.
      if (!settings.enabled) {
        return createCorsResponse({ handled: false, reason: 'agent disabled' }, 200, req);
      }
      if (settings.after_hours_only && isWithinBusinessHours(settings.business_hours)) {
        return createCorsResponse({ handled: false, reason: 'within business hours' }, 200, req);
      }

      const rawTranscript = String(body.transcript ?? '');

      // ANI identify: match the caller's last 10 digits against known records.
      let callerCustomerId: string | null = null;
      const last10 = last10Digits(body.fromNumber);
      if (last10) {
        const { data: recs } = await admin
          .from('business_records')
          .select('id, phone')
          .eq('tenant_id', tenantId);
        const hit = ((recs as Row[]) || []).find(
          (c) => c.phone && String(c.phone).replace(/\D/g, '').endsWith(last10),
        );
        callerCustomerId = hit ? hit.id : null;
      }

      const summary = await summarizeIntake(rawTranscript);
      const language = String(body.language ?? summary.language ?? 'en');
      const priority: VoiceCallPriority = classifyPriority(
        `${rawTranscript} ${summary.detectedIssue}`,
      );
      const storedTranscript = settings.pii_redaction ? redactPii(rawTranscript) : rawTranscript;

      // Ticket creation is best-effort: a failure logs the call anyway rather
      // than losing the intake.
      let ticketId: string | null = null;
      let ticketNote: string | null = null;
      const ticketNumber = `VOICE-${Date.now()}`;
      const { data: ticket, error: ticketError } = await admin
        .from('service_tickets')
        .insert({
          tenant_id: tenantId,
          customer_id: callerCustomerId ?? 'unknown',
          ticket_number: ticketNumber,
          title: (summary.detectedIssue || 'After-hours service call').slice(0, 120),
          description: storedTranscript || null,
          priority: ticketPriority(priority),
          status: 'open',
          customer_phone: summary.callbackNumber ?? body.fromNumber ?? null,
          created_by: 'voice-agent',
        })
        .select('id')
        .maybeSingle();
      if (ticketError) {
        console.warn('[VOICE-AGENT] ticket insert failed, continuing:', ticketError.message);
        ticketNote = 'Service ticket creation failed; call logged without a ticket.';
      } else {
        ticketId = (ticket as Row | null)?.id ?? null;
      }

      // P1 escalation: best-effort on-call page, same as Express — paged:false
      // when no alert recipient is configured.
      let escalated = false;
      let onCallTechId: string | null = null;
      if (priority === 'P1') {
        const { data: alerts } = await admin
          .from('alert_configurations')
          .select('id, recipient_user_id')
          .eq('tenant_id', tenantId)
          .limit(1);
        const recipient = ((alerts as Row[]) || [])[0];
        if (recipient?.recipient_user_id) {
          onCallTechId = recipient.recipient_user_id;
          escalated = true;
        }
      }

      const cost = estimateCost(durationSeconds);

      const { data: call, error: callError } = await admin
        .from('voice_agent_calls')
        .insert({
          tenant_id: tenantId,
          call_sid: body.callSid ?? null,
          from_number: body.fromNumber ?? null,
          caller_customer_id: callerCustomerId,
          language,
          transcript: storedTranscript ? storedTranscript.slice(0, 8000) : null,
          recording_purge_at: new Date(Date.now() + NINETY_DAYS_MS).toISOString(),
          detected_issue: summary.detectedIssue.slice(0, 2000),
          machine_ref: summary.machineRef,
          callback_number: summary.callbackNumber ?? body.fromNumber ?? null,
          priority,
          ticket_id: ticketId,
          escalated,
          on_call_tech_id: onCallTechId,
          twilio_cost: cost.twilioCost,
          ai_cost: cost.aiCost,
          total_cost: cost.totalCost,
          duration_seconds: Math.round(durationSeconds),
          status: 'completed',
        })
        .select()
        .maybeSingle();
      if (callError) throw new Error(callError.message);

      audit('INTAKE', { id: (call as Row | null)?.id, priority, escalated, ticketId });

      return createCorsResponse(
        {
          handled: true,
          call: call ? camelRow(call as Row) : null,
          ticketId,
          priority,
          escalated,
          ...(ticketNote ? { note: ticketNote } : {}),
        },
        201,
        req,
      );
    }

    return createCorsResponse({ error: 'Not found' }, 404, req);
  } catch (error) {
    console.error('[VOICE-AGENT] error:', error);
    return createCorsResponse(
      { message: 'Request failed', error: (error as Error).message },
      500,
      req,
    );
  }
}
