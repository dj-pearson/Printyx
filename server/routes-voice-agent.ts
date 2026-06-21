/**
 * Voice Phone Agent for Inbound After-Hours Service Intake Routes (US-SUPER-013).
 *
 * A Twilio voice AI agent picks up after-hours service calls, takes the ticket,
 * dispatches the on-call tech for P1, and queues a ticket otherwise — recovering
 * the ~20% of calls lost when no one answers. v1 here ingests a CALL-END SUMMARY
 * (transcript + duration) so the whole pipeline (ANI identify → summarize →
 * classify priority → create ticket → escalate P1 → cost meter → persist) is
 * exercisable OFFLINE; the real-time voice stack lives behind named stubs.
 *
 * Endpoints:
 *   POST /api/voice-agent/intake             — cron/webhook-callable call-end ingest
 *   GET  /api/voice-agent/calls?priority=    — call log (newest first, +company name)
 *   GET  /api/voice-agent/calls/:id          — single call detail
 *   GET  /api/voice-agent/settings           — config + twilioSet/elevenLabsSet markers
 *   PUT  /api/voice-agent/settings           — update (encrypts creds, never echoed)
 *   GET  /api/voice-agent/cost               — monthly cost tally (current + prior)
 *   POST /api/voice-agent/purge-recordings   — cron: null expired recording URLs
 *
 * Schema: shared/voice-agent-schema.ts (re-exported from shared/schema.ts).
 * Auth: requireAuth + resolveTenant + tenant scoping on every query.
 *
 * Documented STUBs / TODOs:
 *   - TODO: real-time call orchestration via Twilio Media Streams + Claude
 *     streaming + ElevenLabs voice synthesis (greet, ANI identify, ask
 *     machine/location, ask issue, confirm callback, multi-language en/es
 *     detected from first 5s). v1 here ingests a call-end summary so the
 *     pipeline is exercisable offline.
 *   - sendOnCallPage(): reads team-alerts alert_configurations best-effort for a
 *     recipient; TODO: real on-call rotation + SMS via Twilio. paged:false when
 *     unconfigured.
 *   - summarizeIntake(): Claude JSON extraction when CLAUDE_API_KEY is set;
 *     otherwise a deterministic offline FALLBACK (regex callback number, en).
 *   - classifyPriority(): keyword rules (down/critical → P1, etc.).
 *   - redactPii(): masks card-like 13-16 digit runs from the stored transcript.
 *   - estimateCost(): per-minute proxy rates (Twilio $0.013/min + AI $0.10/min).
 *   - Twilio/ElevenLabs creds obfuscated into encryptedConfig (TODO(vault); the
 *     address-book vault throws without ADDRESS_BOOK_MASTER_KEY). GET returns
 *     only { twilioSet, elevenLabsSet } markers, never raw creds.
 *   - Recordings purged after 90 days via POST /purge-recordings (cron).
 *   - Kill switch (settings.enabled, default OFF) + after-hours gate.
 *   - TODO(rbac): requirePermission(['service.voice_agent.manage']) once it exists.
 */

import type { Express } from 'express';
import { z } from 'zod';
import { and, desc, eq, gte, lt, isNotNull } from 'drizzle-orm';
import { db } from './db';
import { requireAuth } from './replitAuth';
import { resolveTenant } from './middleware/tenancy';
import { getTenantId, getUserId } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';
import ClaudeAIService from './services/claude-ai-service';
import { sendEmail } from './services/email-service';
import {
  voiceAgentSettings,
  voiceAgentCalls,
  businessRecords,
  serviceTickets,
  VOICE_CALL_PRIORITIES,
  type VoiceCallPriority,
} from '@shared/schema';
import { alertConfigurations } from '@shared/team-alerts-schema';

const log = createModuleLogger('routes-voice-agent');

const NINETY_DAYS_MS = 90 * 86_400_000;
const DEFAULT_LANGUAGES = ['en', 'es'];

// Cost-metering PROXY rates (per minute). Real Twilio/AI billing is reconciled
// out-of-band; these are conservative estimates so the cost tally is meaningful
// offline. TODO: replace with reconciled per-call usage from the providers.
const TWILIO_RATE_PER_MIN = 0.013;
const AI_RATE_PER_MIN = 0.1;

// ---------------------------------------------------------------------------
// Adapters (offline-safe stubs) — the real-time stack is NOT built here.
//
// TODO: real-time call orchestration via Twilio Media Streams + Claude
// streaming + ElevenLabs voice synthesis (greet, ANI identify, ask
// machine/location, ask issue, confirm callback, multi-language en/es detected
// from first 5s). v1 here ingests a call-end summary so the pipeline is
// exercisable offline.
// ---------------------------------------------------------------------------

interface IntakeSummary {
  detectedIssue: string;
  machineRef: string | null;
  callbackNumber: string | null;
  language: string;
}

/**
 * Keyword priority classifier.
 *   P1: down / critical / emergency / not working / no power
 *   P2: broken / won't print / severe jam
 *   P3: slow / error / intermittent / quality (default)
 */
export function classifyPriority(text: string): VoiceCallPriority {
  const t = (text ?? '').toLowerCase();
  const p1 = ['down', 'critical', 'emergency', 'not working', 'no power'];
  const p2 = ['broken', "won't print", 'wont print', 'severe jam', 'bad jam', 'jammed badly'];
  if (p1.some((k) => t.includes(k))) return 'P1';
  if (p2.some((k) => t.includes(k))) return 'P2';
  // P3 keywords (slow/error/intermittent/quality) and default both land here.
  return 'P3';
}

/** Mask card-like number sequences (13-16 digit runs → ****). */
export function redactPii(text: string): string {
  if (!text) return text;
  return text.replace(/\b\d[\d ]{11,18}\d\b/g, (m) => {
    const digits = m.replace(/\D/g, '');
    return digits.length >= 13 && digits.length <= 16 ? '****' : m;
  });
}

/** Per-minute proxy cost estimate. Documented rates above. */
export function estimateCost(durationSeconds: number): {
  twilioCost: number;
  aiCost: number;
  totalCost: number;
} {
  const minutes = Math.max(0, durationSeconds) / 60;
  const twilioCost = Math.round(minutes * TWILIO_RATE_PER_MIN * 1e4) / 1e4;
  const aiCost = Math.round(minutes * AI_RATE_PER_MIN * 1e4) / 1e4;
  const totalCost = Math.round((twilioCost + aiCost) * 1e4) / 1e4;
  return { twilioCost, aiCost, totalCost };
}

const PHONE_RE = /(\+?\d[\d().\-\s]{8,}\d)/;

/** Deterministic offline fallback intake extraction. */
function fallbackSummary(transcript: string): IntakeSummary {
  const text = (transcript ?? '').trim();
  const phoneMatch = text.match(PHONE_RE);
  return {
    detectedIssue: text.slice(0, 2000) || 'Service request (no transcript captured).',
    machineRef: null,
    callbackNumber: phoneMatch ? phoneMatch[1].trim() : null,
    language: 'en',
  };
}

/**
 * Extract { detectedIssue, machineRef, callbackNumber, language } from the call
 * transcript via Claude JSON extraction; deterministic fallback on ANY failure
 * (no key, API error, parse error) so the pipeline is exercisable offline.
 */
export async function summarizeIntake(transcript: string): Promise<IntakeSummary> {
  const fallback = fallbackSummary(transcript);
  try {
    if (!process.env.CLAUDE_API_KEY) return fallback;
    if (!transcript || !transcript.trim()) return fallback;

    const raw = await ClaudeAIService.generateCompletion({
      system:
        'You extract a service-intake summary from an after-hours phone call transcript for an ' +
        'office-equipment (copier/MFP) dealer. Return ONLY a JSON object, no prose, of the form ' +
        '{"detectedIssue":string,"machineRef":string|null,"callbackNumber":string|null,"language":"en"|"es"}. ' +
        'detectedIssue is a one-line problem summary. machineRef is the model/serial/location if ' +
        'mentioned. callbackNumber is the phone number the caller gave. language is the spoken language.',
      messages: [{ role: 'user', content: `Transcript:\n${transcript}` }],
      temperature: 0.2,
    });

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return fallback;
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    const str = (v: unknown): string | null => {
      if (typeof v !== 'string') return null;
      const s = v.trim();
      return s.length ? s : null;
    };
    const lang = str(parsed.language);
    return {
      detectedIssue: str(parsed.detectedIssue) ?? fallback.detectedIssue,
      machineRef: str(parsed.machineRef),
      callbackNumber: str(parsed.callbackNumber) ?? fallback.callbackNumber,
      language: lang === 'es' ? 'es' : 'en',
    };
  } catch (err) {
    log.warn('summarizeIntake failed; using deterministic fallback (offline-safe):', err as any);
    return fallback;
  }
}

/**
 * Best-effort on-call paging STUB. Reads team-alerts alert_configurations
 * (tenant-scoped) for a recipient and records an email (best-effort). Returns
 * paged:false when no recipient is configured.
 * TODO: real on-call rotation + SMS via Twilio.
 */
export async function sendOnCallPage(
  tenantId: string,
  message: string,
): Promise<{ paged: boolean; techId: string | null }> {
  try {
    const [config] = await db
      .select({
        userId: alertConfigurations.userId,
        additionalRecipients: alertConfigurations.additionalRecipients,
      })
      .from(alertConfigurations)
      .where(and(eq(alertConfigurations.tenantId, tenantId), eq(alertConfigurations.enabled, true)))
      .limit(1);
    if (!config) return { paged: false, techId: null };

    const recipients = Array.isArray(config.additionalRecipients)
      ? (config.additionalRecipients as string[])
      : [];
    const to = recipients.find((r) => typeof r === 'string' && r.includes('@'));
    if (to) {
      // Best-effort notify; never throws out (email-service swallows config errors).
      try {
        await sendEmail({
          to,
          from: 'noreply@printyx.net',
          subject: 'After-hours P1 service call — on-call page',
          text: message,
          html: `<p>${message.replace(/</g, '&lt;')}</p>`,
        });
      } catch (e) {
        log.warn('On-call page email send failed (best-effort):', e as any);
      }
    }
    return { paged: !!to, techId: config.userId ?? null };
  } catch (err) {
    log.warn('sendOnCallPage failed (best-effort):', err as any);
    return { paged: false, techId: null };
  }
}

// ---------------------------------------------------------------------------
// Credential obfuscation (TODO(vault))
// ---------------------------------------------------------------------------

/**
 * Light credential obfuscation for at-rest storage under encryptedConfig.
 * TODO(vault): replace with the shared credential vault once an env master key
 * is provisioned for this module — the address-book vault throws when
 * ADDRESS_BOOK_MASTER_KEY is absent, which would break settings writes in
 * offline/dev. We NEVER return the decrypted value; reads expose only *_set
 * booleans.
 */
function obfuscateCredential(plaintext: string): string {
  return Buffer.from(plaintext, 'utf8').toString('base64');
}

// ---------------------------------------------------------------------------
// Settings helpers
// ---------------------------------------------------------------------------

async function getOrCreateSettings(tenantId: string) {
  const existing = await db.query.voiceAgentSettings.findFirst({
    where: eq(voiceAgentSettings.tenantId, tenantId),
  });
  if (existing) return existing;
  const [created] = await db
    .insert(voiceAgentSettings)
    .values({
      tenantId,
      enabled: false,
      afterHoursOnly: true,
      piiRedaction: true,
      languages: DEFAULT_LANGUAGES,
    })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  return db.query.voiceAgentSettings.findFirst({
    where: eq(voiceAgentSettings.tenantId, tenantId),
  });
}

/** Derive the write-only *_set booleans from encryptedConfig. */
function credSetMarkers(encryptedConfig: unknown): { twilioSet: boolean; elevenLabsSet: boolean } {
  const cfg = (encryptedConfig ?? {}) as Record<string, unknown>;
  const has = (k: string) => typeof cfg[k] === 'string' && (cfg[k] as string).length > 0;
  return {
    // "twilioSet" is satisfied by either credential half being present.
    twilioSet: has('twilioAccountSid') || has('twilioAuthToken'),
    elevenLabsSet: has('elevenLabsApiKey'),
  };
}

type SettingsRow = NonNullable<Awaited<ReturnType<typeof getOrCreateSettings>>>;

/** Public settings projection: config + *_set booleans (never raw creds). */
function projectSettings(row: SettingsRow) {
  return {
    tenantId: row.tenantId,
    enabled: row.enabled,
    afterHoursOnly: row.afterHoursOnly,
    businessHours: row.businessHours ?? null,
    languages: Array.isArray(row.languages) ? (row.languages as string[]) : DEFAULT_LANGUAGES,
    piiRedaction: row.piiRedaction,
    twilioNumber: row.twilioNumber ?? null,
    updatedAt: row.updatedAt,
    ...credSetMarkers(row.encryptedConfig),
  };
}

// ---------------------------------------------------------------------------
// After-hours gate
// ---------------------------------------------------------------------------

interface BusinessHours {
  // tz reserved for a future per-tenant timezone; v1 evaluates in server local.
  tz?: string;
  // Per-day windows: { mon: { open: "08:00", close: "17:00" }, ... } — missing
  // day = closed all day (after hours).
  days?: Record<string, { open?: string; close?: string } | null>;
}

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function parseHHMM(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Best-effort: returns true when `now` falls inside the configured business
 * hours. If businessHours is unset/malformed, returns false (treat ALL as
 * after-hours) so the agent answers.
 */
function isWithinBusinessHours(businessHours: unknown, now = new Date()): boolean {
  const bh = (businessHours ?? null) as BusinessHours | null;
  if (!bh || !bh.days || typeof bh.days !== 'object') return false;
  const dayKey = DAY_KEYS[now.getDay()];
  const window = bh.days[dayKey];
  if (!window) return false;
  const open = parseHHMM(window.open);
  const close = parseHHMM(window.close);
  if (open == null || close == null || close <= open) return false;
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= open && mins < close;
}

// ---------------------------------------------------------------------------
// ANI lookup
// ---------------------------------------------------------------------------

/** Resolve a customer from the caller's number via last-10-digit match. */
async function aniLookup(tenantId: string, fromNumber?: string | null): Promise<string | null> {
  if (!fromNumber) return null;
  const norm = fromNumber.replace(/\D/g, '');
  if (norm.length < 7) return null;
  const last10 = norm.slice(-10);
  const candidates = await db
    .select({ id: businessRecords.id, phone: businessRecords.phone })
    .from(businessRecords)
    .where(eq(businessRecords.tenantId, tenantId));
  const hit = candidates.find((c) => c.phone && c.phone.replace(/\D/g, '').endsWith(last10));
  return hit ? hit.id : null;
}

// ---------------------------------------------------------------------------
// Priority mapping (voice P1/P2/P3 → service_tickets.priority)
// ---------------------------------------------------------------------------

function ticketPriority(p: VoiceCallPriority): string {
  return p === 'P1' ? 'urgent' : p === 'P2' ? 'high' : 'medium';
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

function audit(
  action: 'INTAKE' | 'UPDATE_SETTINGS' | 'PURGE_RECORDINGS',
  ctx: { tenantId: string; userId: string | undefined; extra?: unknown },
) {
  log.info(
    {
      audit: true,
      action,
      tenantId: ctx.tenantId,
      userId: ctx.userId ?? 'system',
      timestamp: new Date().toISOString(),
      ...(ctx.extra ? { extra: ctx.extra } : {}),
    },
    '[AUDIT] voice-agent',
  );
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const intakeSchema = z.object({
  callSid: z.string().min(1).optional(),
  fromNumber: z.string().min(1).optional(),
  transcript: z.string().max(8000).optional(),
  durationSeconds: z.number().int().min(0).max(86_400).optional(),
  language: z.string().min(2).max(8).optional(),
});

const settingsSchema = z.object({
  enabled: z.boolean().optional(),
  afterHoursOnly: z.boolean().optional(),
  businessHours: z.any().optional(),
  languages: z.array(z.string().min(2).max(8)).optional(),
  piiRedaction: z.boolean().optional(),
  twilioNumber: z.string().max(40).optional(),
  twilioAccountSid: z.string().min(1).optional(),
  twilioAuthToken: z.string().min(1).optional(),
  elevenLabsApiKey: z.string().min(1).optional(),
});

// ---------------------------------------------------------------------------
// Enrichment (attach caller company name)
// ---------------------------------------------------------------------------

async function enrich(tenantId: string, rows: Array<typeof voiceAgentCalls.$inferSelect>) {
  const customerIds = Array.from(
    new Set(rows.map((r) => r.callerCustomerId).filter((v): v is string => !!v)),
  );
  const customers = customerIds.length
    ? await db
        .select({ id: businessRecords.id, companyName: businessRecords.companyName })
        .from(businessRecords)
        .where(eq(businessRecords.tenantId, tenantId))
    : [];
  const customerMap = new Map(customers.map((c) => [c.id, c.companyName]));
  return rows.map((r) => ({
    ...r,
    companyName: r.callerCustomerId ? (customerMap.get(r.callerCustomerId) ?? null) : null,
  }));
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function registerVoiceAgentRoutes(app: Express) {
  /**
   * POST /api/voice-agent/intake
   * Cron/webhook-callable call-end ingest. Real Twilio Media Streams + Claude
   * streaming + ElevenLabs synthesis is a TODO; here we trust the authenticated
   * tenant context and ingest the call-end summary.
   */
  app.post('/api/voice-agent/intake', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const parsed = intakeSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
      }
      const input = parsed.data;

      const settings = await getOrCreateSettings(tenantId);
      if (!settings)
        return res.status(500).json({ message: 'Failed to load voice-agent settings' });

      // --- KILL SWITCH ------------------------------------------------------
      if (!settings.enabled) {
        return res.json({ handled: false, reason: 'agent disabled' });
      }

      // --- After-hours gate -------------------------------------------------
      if (settings.afterHoursOnly && isWithinBusinessHours(settings.businessHours)) {
        return res.json({ handled: false, reason: 'within business hours' });
      }

      const rawTranscript = input.transcript ?? '';

      // --- Pipeline ---------------------------------------------------------
      const callerCustomerId = await aniLookup(tenantId, input.fromNumber);
      const summary = await summarizeIntake(rawTranscript);
      const language = input.language ?? summary.language ?? 'en';
      const priority = classifyPriority(`${rawTranscript} ${summary.detectedIssue}`);

      const storedTranscript = settings.piiRedaction ? redactPii(rawTranscript) : rawTranscript;

      // --- Create the service ticket (tolerate insert failure) -------------
      let ticketId: string | null = null;
      let ticketNote: string | null = null;
      const ticketNumber = `VOICE-${Date.now()}`;
      try {
        const [ticket] = await db
          .insert(serviceTickets)
          .values({
            tenantId,
            customerId: callerCustomerId ?? 'unknown',
            ticketNumber,
            title: (summary.detectedIssue || 'After-hours service call').slice(0, 120),
            description: storedTranscript || null,
            priority: ticketPriority(priority),
            status: 'open',
            customerPhone: summary.callbackNumber ?? input.fromNumber ?? null,
            createdBy: 'voice-agent',
          })
          .returning({ id: serviceTickets.id });
        ticketId = ticket?.id ?? null;
      } catch (err) {
        log.warn(
          'Voice-agent service ticket insert failed; continuing with ticketId=null:',
          err as any,
        );
        ticketNote = 'Service ticket creation failed; call logged without a ticket.';
      }

      // --- P1 escalation (best-effort on-call page) ------------------------
      let escalated = false;
      let onCallTechId: string | null = null;
      if (priority === 'P1') {
        const page = await sendOnCallPage(
          tenantId,
          `P1 after-hours service call${ticketNumber ? ` (${ticketNumber})` : ''}: ${
            summary.detectedIssue
          }. Callback: ${summary.callbackNumber ?? input.fromNumber ?? 'unknown'}.`,
        );
        escalated = page.paged;
        onCallTechId = page.techId;
      }

      // --- Cost metering (proxy rates) -------------------------------------
      const cost = estimateCost(input.durationSeconds ?? 0);

      // --- Persist the call -------------------------------------------------
      const [call] = await db
        .insert(voiceAgentCalls)
        .values({
          tenantId,
          callSid: input.callSid ?? null,
          fromNumber: input.fromNumber ?? null,
          callerCustomerId,
          language,
          transcript: storedTranscript ? storedTranscript.slice(0, 8000) : null,
          recordingPurgeAt: new Date(Date.now() + NINETY_DAYS_MS),
          detectedIssue: summary.detectedIssue.slice(0, 2000),
          machineRef: summary.machineRef,
          callbackNumber: summary.callbackNumber ?? input.fromNumber ?? null,
          priority,
          ticketId,
          escalated,
          onCallTechId,
          twilioCost: cost.twilioCost,
          aiCost: cost.aiCost,
          totalCost: cost.totalCost,
          durationSeconds: input.durationSeconds ?? 0,
          status: 'completed',
        })
        .returning();

      audit('INTAKE', {
        tenantId,
        userId,
        extra: { id: call?.id, priority, escalated, ticketId },
      });

      res.status(201).json({
        handled: true,
        call,
        ticketId,
        priority,
        escalated,
        ...(ticketNote ? { note: ticketNote } : {}),
      });
    } catch (error: any) {
      log.error('Voice-agent intake failed:', error);
      res.status(500).json({ message: 'Failed to process voice intake', error: error?.message });
    }
  });

  /**
   * GET /api/voice-agent/calls?priority=
   * Call log, newest first (limit 200), with caller company name attached.
   */
  app.get('/api/voice-agent/calls', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const priority = typeof req.query.priority === 'string' ? req.query.priority : undefined;
      const conditions = [eq(voiceAgentCalls.tenantId, tenantId)];
      if (priority && (VOICE_CALL_PRIORITIES as readonly string[]).includes(priority)) {
        conditions.push(eq(voiceAgentCalls.priority, priority));
      }

      const rows = await db
        .select()
        .from(voiceAgentCalls)
        .where(and(...conditions))
        .orderBy(desc(voiceAgentCalls.createdAt))
        .limit(200);

      const data = await enrich(tenantId, rows);
      res.json({ data, total: data.length });
    } catch (error: any) {
      log.error('Failed to list voice calls:', error);
      res.status(500).json({ message: 'Failed to list voice calls', error: error?.message });
    }
  });

  /** GET /api/voice-agent/calls/:id — single call detail + company name. */
  app.get('/api/voice-agent/calls/:id', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const row = await db.query.voiceAgentCalls.findFirst({
        where: and(eq(voiceAgentCalls.id, req.params.id), eq(voiceAgentCalls.tenantId, tenantId)),
      });
      if (!row) return res.status(404).json({ message: 'Call not found' });

      const [enriched] = await enrich(tenantId, [row]);
      res.json(enriched);
    } catch (error: any) {
      log.error('Failed to load voice call:', error);
      res.status(500).json({ message: 'Failed to load voice call', error: error?.message });
    }
  });

  /** GET /api/voice-agent/settings — config + twilioSet/elevenLabsSet markers. */
  app.get('/api/voice-agent/settings', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
      const settings = await getOrCreateSettings(tenantId);
      if (!settings) return res.status(500).json({ message: 'Failed to load settings' });
      res.json(projectSettings(settings));
    } catch (error: any) {
      log.error('Failed to load voice-agent settings:', error);
      res.status(500).json({ message: 'Failed to load settings', error: error?.message });
    }
  });

  /**
   * PUT /api/voice-agent/settings
   * Update config / kill switch / creds. Creds are obfuscated into
   * encryptedConfig and NEVER echoed; the response carries only *_set booleans.
   */
  app.put('/api/voice-agent/settings', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      const userId = getUserId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      const parsed = settingsSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
      }
      const input = parsed.data;

      const current = await getOrCreateSettings(tenantId);
      if (!current) return res.status(500).json({ message: 'Failed to load settings' });

      const updates: Record<string, unknown> = {
        updatedByUserId: userId,
        updatedAt: new Date(),
      };
      if (input.enabled !== undefined) updates.enabled = input.enabled;
      if (input.afterHoursOnly !== undefined) updates.afterHoursOnly = input.afterHoursOnly;
      if (input.businessHours !== undefined) updates.businessHours = input.businessHours;
      if (input.languages !== undefined) updates.languages = input.languages;
      if (input.piiRedaction !== undefined) updates.piiRedaction = input.piiRedaction;
      if (input.twilioNumber !== undefined) updates.twilioNumber = input.twilioNumber;

      // Merge encrypted creds (only overwrite the ones supplied).
      const cfg: Record<string, unknown> = {
        ...((current.encryptedConfig ?? {}) as Record<string, unknown>),
      };
      let credsTouched = false;
      if (input.twilioAccountSid !== undefined) {
        cfg.twilioAccountSid = obfuscateCredential(input.twilioAccountSid);
        credsTouched = true;
      }
      if (input.twilioAuthToken !== undefined) {
        cfg.twilioAuthToken = obfuscateCredential(input.twilioAuthToken);
        credsTouched = true;
      }
      if (input.elevenLabsApiKey !== undefined) {
        cfg.elevenLabsApiKey = obfuscateCredential(input.elevenLabsApiKey);
        credsTouched = true;
      }
      if (credsTouched) updates.encryptedConfig = cfg;

      const [updated] = await db
        .update(voiceAgentSettings)
        .set(updates)
        .where(eq(voiceAgentSettings.tenantId, tenantId))
        .returning();

      audit('UPDATE_SETTINGS', {
        tenantId,
        userId,
        extra: {
          enabled: input.enabled,
          afterHoursOnly: input.afterHoursOnly,
          twilioSet: input.twilioAccountSid !== undefined || input.twilioAuthToken !== undefined,
          elevenLabsSet: input.elevenLabsApiKey !== undefined,
        },
      });

      res.json(projectSettings(updated));
    } catch (error: any) {
      log.error('Failed to update voice-agent settings:', error);
      res.status(500).json({ message: 'Failed to update settings', error: error?.message });
    }
  });

  /**
   * GET /api/voice-agent/cost
   * Monthly cost tally — group calls by YYYY-MM (current + prior few months),
   * summing twilio/ai/total cost + call count. Current month returned
   * prominently.
   */
  app.get('/api/voice-agent/cost', requireAuth, resolveTenant, async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

      // Look back 6 months.
      const since = new Date();
      since.setMonth(since.getMonth() - 5);
      since.setDate(1);
      since.setHours(0, 0, 0, 0);

      const rows = await db
        .select({
          createdAt: voiceAgentCalls.createdAt,
          twilioCost: voiceAgentCalls.twilioCost,
          aiCost: voiceAgentCalls.aiCost,
          totalCost: voiceAgentCalls.totalCost,
        })
        .from(voiceAgentCalls)
        .where(and(eq(voiceAgentCalls.tenantId, tenantId), gte(voiceAgentCalls.createdAt, since)));

      const buckets = new Map<
        string,
        { month: string; twilioCost: number; aiCost: number; totalCost: number; callCount: number }
      >();
      for (const r of rows) {
        const d = r.createdAt ? new Date(r.createdAt) : new Date();
        const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const b = buckets.get(month) ?? {
          month,
          twilioCost: 0,
          aiCost: 0,
          totalCost: 0,
          callCount: 0,
        };
        b.twilioCost += r.twilioCost ?? 0;
        b.aiCost += r.aiCost ?? 0;
        b.totalCost += r.totalCost ?? 0;
        b.callCount += 1;
        buckets.set(month, b);
      }

      const round = (n: number) => Math.round(n * 1e4) / 1e4;
      const months = Array.from(buckets.values())
        .map((b) => ({
          month: b.month,
          twilioCost: round(b.twilioCost),
          aiCost: round(b.aiCost),
          totalCost: round(b.totalCost),
          callCount: b.callCount,
        }))
        .sort((a, b) => (a.month < b.month ? 1 : -1)); // newest first

      const now = new Date();
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const currentMonth = months.find((m) => m.month === currentMonthKey) ?? {
        month: currentMonthKey,
        twilioCost: 0,
        aiCost: 0,
        totalCost: 0,
        callCount: 0,
      };

      res.json({ currentMonth, months });
    } catch (error: any) {
      log.error('Failed to compute voice-agent cost tally:', error);
      res.status(500).json({ message: 'Failed to compute cost tally', error: error?.message });
    }
  });

  /**
   * POST /api/voice-agent/purge-recordings
   * Cron: null recordingUrl where recordingPurgeAt < now AND recordingUrl is
   * not null (90-day retention). Returns { purged }.
   */
  app.post(
    '/api/voice-agent/purge-recordings',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        const userId = getUserId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        const now = new Date();
        const purged = await db
          .update(voiceAgentCalls)
          .set({ recordingUrl: null })
          .where(
            and(
              eq(voiceAgentCalls.tenantId, tenantId),
              lt(voiceAgentCalls.recordingPurgeAt, now),
              isNotNull(voiceAgentCalls.recordingUrl),
            ),
          )
          .returning({ id: voiceAgentCalls.id });

        audit('PURGE_RECORDINGS', { tenantId, userId, extra: { purged: purged.length } });
        res.json({ purged: purged.length });
      } catch (error: any) {
        log.error('Failed to purge recordings:', error);
        res.status(500).json({ message: 'Failed to purge recordings', error: error?.message });
      }
    },
  );
}
