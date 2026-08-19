/**
 * Voice-First Field Tech Ticket Close Routes (US-SUPER-005).
 *
 * A field tech speaks on their phone (actions taken, parts used, labor); the
 * system transcribes the audio (Whisper), Claude extracts structured close
 * fields, each spoken part is fuzzy-matched to an inventory SKU, and a draft is
 * built (extracted fields + SKU resolutions + drafted invoice line items). The
 * tech reviews/edits the draft and confirms. On confirm — TRANSACTIONALLY — the
 * service ticket is closed (status completed, resolution notes carry the voice
 * note, labor logged), resolved-part quantities are deducted from the tech's
 * truck inventory, and the draft is marked confirmed. Drafted invoice line items
 * stay pending_approval until the canonical invoice flow is wired.
 *
 * Endpoints:
 *   POST /api/voice-ticket-close/:ticketId/transcribe   — transcribe + extract + SKU-resolve → draft
 *   GET  /api/voice-ticket-close/:ticketId              — latest draft for the ticket
 *   PATCH /api/voice-ticket-close/draft/:id             — edit/merge the draft
 *   POST /api/voice-ticket-close/draft/:id/confirm      — TRANSACTIONAL close + deduct + confirm
 *   GET  /api/voice-ticket-close/skus/search?q=         — fuzzy SKU search (inline disambiguation)
 *   POST /api/voice-ticket-close/purge-audio            — cron: null out audio past audioPurgeAt
 *
 * Schema lives in shared/voice-ticket-close-schema.ts (re-exported from
 * shared/schema.ts).
 *
 * Auth: requireAuth + tenant scoping on every query.
 *
 * Documented STUBs / TODOs:
 *   - transcribeAudio(): real OpenAI Whisper call (plain fetch + multipart
 *     FormData, no SDK) when OPENAI_API_KEY is set AND audio is provided;
 *     otherwise a deterministic offline FALLBACK. A client-supplied `transcript`
 *     passes through untouched (source 'fallback') so the flow is testable
 *     without a microphone or network/key.
 *   - extractCloseFields(): ClaudeAIService prompt that returns ONLY a JSON
 *     object; on ANY failure a deterministic fallback echoes the transcript into
 *     actions_taken with empty parts / zero labor. source is only 'ai' on a clean
 *     parse.
 *   - resolveSku(): lightweight fuzzy match (lowercase substring + token overlap)
 *     against tenant-scoped inventory_items partNumber/name — top 3 candidates;
 *     chosenSku is the top candidate only when the score clears a threshold,
 *     otherwise null (needs disambiguation). TODO(prod): trigram / pg_trgm index.
 *   - confirm is TRANSACTIONAL via db.transaction; in a partial-table environment
 *     (e.g. truck_inventory absent) each step is wrapped so the close degrades
 *     gracefully and the response reports which steps applied.
 *   - Invoice line items are drafted-only (status pending_approval). TODO: persist
 *     into the canonical invoices / invoice_line_items once that flow is wired.
 *   - Audio is purged 30 days after close (purge-audio cron nulls audioUrl).
 *   - TODO(rbac): requirePermission(['service.ticket.close']) once it exists.
 *     Mirrors the meter-read-vision / service-knowledge exemplars (requireAuth +
 *     tenant scoping until the permission string is added to the RBAC matrix).
 */

import type { Express } from 'express';
import { z } from 'zod';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from './db';
import { requireAuth } from './replitAuth';
import { resolveTenant } from './middleware/tenancy';
import { getTenantId, getUserId } from './utils/auth-helpers';
import { createModuleLogger } from './lib/logger';
import { safeFetch } from './lib/safe-http-client';
import ClaudeAIService from './services/claude-ai-service';
import { voiceTicketCloses, serviceTickets, inventoryItems, truckInventory } from '@shared/schema';

const log = createModuleLogger('routes-voice-ticket-close');

/**
 * CR-005: restrict the audioUrl to expected storage host(s) before fetching, so
 * a user-supplied URL cannot be used for SSRF. Allows the configured Supabase
 * host and *.supabase.co / *.printyx.net storage domains.
 */
export function isAllowedAudioHost(rawUrl: string): boolean {
  let host: string;
  try {
    host = new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return false;
  }
  const suffixes = ['.supabase.co', '.supabase.in', '.printyx.net'];
  if (suffixes.some((s) => host.endsWith(s))) return true;
  try {
    if (
      process.env.SUPABASE_URL &&
      host === new URL(process.env.SUPABASE_URL).hostname.toLowerCase()
    )
      return true;
  } catch {
    /* ignore malformed env */
  }
  return false;
}

const THIRTY_DAYS_MS = 30 * 86_400_000;
/** A chosen SKU is auto-selected only when the top candidate's score clears this. */
const SKU_AUTO_MATCH_THRESHOLD = 0.45;

// ---------------------------------------------------------------------------
// Extracted-fields shape
// ---------------------------------------------------------------------------

interface ExtractedPart {
  raw: string;
  quantity: number;
}

interface ExtractedClose {
  actions_taken: string;
  parts_used: ExtractedPart[];
  labor_minutes: number;
  follow_up_needed: boolean;
  customer_signature_collected: boolean;
  customer_satisfaction_note: string;
}

interface SkuCandidate {
  sku: string;
  name: string;
  score: number;
}

interface SkuResolution {
  raw: string;
  quantity: number;
  candidates: SkuCandidate[];
  chosenSku: string | null;
}

interface DraftInvoiceItem {
  description: string;
  quantity: number;
  unitCost: number;
  amount: number;
  status: 'pending_approval';
}

// ---------------------------------------------------------------------------
// Adapter — Whisper transcription (fetch + multipart, offline-safe)
// ---------------------------------------------------------------------------

/**
 * Transcribe a voice note to text.
 *
 * When OPENAI_API_KEY is set AND audio is provided, POSTs the audio to OpenAI
 * Whisper (whisper-1) via a plain multipart fetch (no SDK) and returns the
 * `.text` with source 'whisper'. On ANY failure (no key, no audio, network/parse
 * error) it FALLS BACK: if the caller supplied a `transcript` it passes through
 * (so the flow is testable without a mic), otherwise it returns an empty string.
 * source is only 'whisper' on a clean parse.
 */
export async function transcribeAudio(args: {
  audioBase64?: string;
  audioUrl?: string;
  transcript?: string;
}): Promise<{ transcript: string; source: 'whisper' | 'fallback' }> {
  try {
    const hasAudio = !!(args.audioBase64 || args.audioUrl);
    if (process.env.OPENAI_API_KEY && hasAudio) {
      // Resolve the audio bytes (base64 inline or fetched from a URL).
      let bytes: Uint8Array | null = null;
      if (args.audioBase64) {
        bytes = new Uint8Array(Buffer.from(args.audioBase64, 'base64'));
      } else if (args.audioUrl) {
        // CR-005: only fetch audio from an expected storage host; safeFetch adds
        // the SSRF blocklist + DNS + redirect checks on top.
        if (isAllowedAudioHost(args.audioUrl)) {
          try {
            const dl = await safeFetch(args.audioUrl);
            if (dl.ok) {
              bytes = new Uint8Array(await dl.arrayBuffer());
            }
          } catch (err) {
            log.warn({ err }, 'Blocked or failed audio fetch');
          }
        } else {
          log.warn({ audioUrl: args.audioUrl }, 'Rejected audioUrl: host not allowlisted');
        }
      }
      if (bytes && bytes.byteLength > 0) {
        const form = new FormData();
        form.append('model', 'whisper-1');
        form.append('file', new Blob([bytes], { type: 'audio/webm' }), 'voice-note.webm');
        const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
          body: form,
        });
        if (resp.ok) {
          const json = (await resp.json()) as { text?: string };
          if (typeof json.text === 'string' && json.text.trim().length > 0) {
            return { transcript: json.text.trim(), source: 'whisper' };
          }
        } else {
          log.warn(`Whisper transcription returned ${resp.status}; using fallback`);
        }
      }
    }
  } catch (err) {
    log.warn('Whisper transcription failed; using fallback (offline-safe):', err as any);
  }
  // FALLBACK: echo a client-provided transcript (testable without audio), else empty.
  return { transcript: (args.transcript ?? '').trim(), source: 'fallback' };
}

// ---------------------------------------------------------------------------
// Adapter — Claude field extraction, offline-safe deterministic fallback
// ---------------------------------------------------------------------------

const FALLBACK_EXTRACTION = (transcript: string): ExtractedClose => ({
  actions_taken: transcript ?? '',
  parts_used: [],
  labor_minutes: 0,
  follow_up_needed: false,
  customer_signature_collected: false,
  customer_satisfaction_note: '',
});

/**
 * Extract structured close fields from a transcript via ClaudeAIService.
 *
 * Prompts the model to return ONLY a JSON object and parses the first JSON object
 * out of the response. On ANY failure (no key, API error, parse error) returns a
 * deterministic FALLBACK that puts the raw transcript into actions_taken with no
 * parts and zero labor. source is only 'ai' on a clean parse.
 */
export async function extractCloseFields(
  transcript: string,
): Promise<{ extracted: ExtractedClose; source: 'ai' | 'fallback' }> {
  const text = (transcript ?? '').trim();
  if (!text) return { extracted: FALLBACK_EXTRACTION(''), source: 'fallback' };

  try {
    const system =
      "You convert a field service technician's spoken ticket-close note into structured JSON. " +
      'Return ONLY a single JSON object, no prose, of EXACTLY this shape: ' +
      '{"actions_taken": string, "parts_used": [{"raw": string, "quantity": number}], ' +
      '"labor_minutes": number, "follow_up_needed": boolean, ' +
      '"customer_signature_collected": boolean, "customer_satisfaction_note": string}. ' +
      'parts_used lists each physical part the tech mentions installing/swapping with its quantity ' +
      '(default 1). labor_minutes is the total on-site labor in minutes (0 if unstated). ' +
      'Omit nothing; use empty string / empty array / 0 / false when unknown.';

    const raw = await ClaudeAIService.generateCompletion({
      system,
      temperature: 0.2,
      max_tokens: 1024,
      messages: [{ role: 'user', content: text }],
    });

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return { extracted: FALLBACK_EXTRACTION(text), source: 'fallback' };
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;

    const num = (v: unknown): number => {
      const n = typeof v === 'number' ? v : parseFloat(String(v));
      return Number.isFinite(n) ? n : 0;
    };
    const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
    const bool = (v: unknown): boolean => v === true || v === 'true';

    const partsRaw = Array.isArray(parsed.parts_used) ? parsed.parts_used : [];
    const parts_used: ExtractedPart[] = partsRaw
      .map((p) => {
        const obj = (p ?? {}) as Record<string, unknown>;
        const rawName = str(obj.raw).trim();
        const quantity = Math.max(1, Math.round(num(obj.quantity)) || 1);
        return { raw: rawName, quantity };
      })
      .filter((p) => p.raw.length > 0);

    return {
      extracted: {
        actions_taken: str(parsed.actions_taken) || text,
        parts_used,
        labor_minutes: Math.max(0, Math.round(num(parsed.labor_minutes))),
        follow_up_needed: bool(parsed.follow_up_needed),
        customer_signature_collected: bool(parsed.customer_signature_collected),
        customer_satisfaction_note: str(parsed.customer_satisfaction_note),
      },
      source: 'ai',
    };
  } catch (err) {
    log.warn('Claude extraction failed; using deterministic fallback (offline-safe):', err as any);
    return { extracted: FALLBACK_EXTRACTION(text), source: 'fallback' };
  }
}

// ---------------------------------------------------------------------------
// Adapter — fuzzy SKU resolution (tenant-scoped inventory_items)
// ---------------------------------------------------------------------------

/** Token-overlap + substring fuzzy score in [0,1]. */
// Exported, with rankSkuCandidates below, so
// server/tests/unit/voice-ticket-close-logic-parity.test.ts can assert this and
// the Deno copy in _shared/voice-ticket-close-logic.ts stay identical.
export function fuzzyScore(needle: string, haystack: string): number {
  const a = needle.toLowerCase().trim();
  const b = (haystack ?? '').toLowerCase().trim();
  if (!a || !b) return 0;
  if (a === b) return 1;
  let score = 0;
  if (b.includes(a) || a.includes(b)) score += 0.5;
  const aTokens = a.split(/\s+/).filter(Boolean);
  const bTokens = new Set(b.split(/\s+/).filter(Boolean));
  if (aTokens.length > 0) {
    const overlap = aTokens.filter((t) => bTokens.has(t) || b.includes(t)).length;
    score += 0.5 * (overlap / aTokens.length);
  }
  return Math.min(1, score);
}

/**
 * Pure scoring/ranking half of resolveSku, extracted so it can be locked against
 * the Deno copy in _shared/voice-ticket-close-logic.ts. resolveSku does the
 * tenant-scoped read and delegates here.
 */
export function rankSkuCandidates(
  raw: string,
  rows: Array<{
    partNumber?: string | null;
    name?: string | null;
    itemDescription?: string | null;
  }>,
  topN = 3,
): { candidates: SkuCandidate[]; chosenSku: string | null } {
  const term = (raw ?? '').trim();
  if (!term) return { candidates: [], chosenSku: null };

  const candidates: SkuCandidate[] = rows
    .map((r) => {
      const sku = r.partNumber ?? '';
      if (!sku) return null;
      const name = r.name ?? r.itemDescription ?? sku;
      const score = Math.max(
        fuzzyScore(term, sku),
        fuzzyScore(term, r.name ?? ''),
        fuzzyScore(term, r.itemDescription ?? ''),
      );
      return { sku, name, score: Math.round(score * 1000) / 1000 };
    })
    .filter((c): c is SkuCandidate => !!c && c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  const chosenSku =
    candidates.length > 0 && candidates[0].score >= SKU_AUTO_MATCH_THRESHOLD
      ? candidates[0].sku
      : null;

  return { candidates, chosenSku };
}

/**
 * Fuzzy-match a raw spoken part name to the tenant's inventory SKUs.
 * Returns the top `topN` candidates (by score) and chooses the top one as
 * `chosenSku` only when its score clears SKU_AUTO_MATCH_THRESHOLD; otherwise null
 * (the tech must disambiguate). Tenant-scoped.
 */
export async function resolveSku(
  tenantId: string,
  raw: string,
  topN = 3,
): Promise<{ candidates: SkuCandidate[]; chosenSku: string | null }> {
  const term = (raw ?? '').trim();
  if (!term) return { candidates: [], chosenSku: null };

  const rows = await db
    .select({
      partNumber: inventoryItems.partNumber,
      name: inventoryItems.name,
      itemDescription: inventoryItems.itemDescription,
    })
    .from(inventoryItems)
    .where(eq(inventoryItems.tenantId, tenantId));

  return rankSkuCandidates(term, rows, topN);
}

/** Look up unit cost for a resolved SKU (tenant-scoped); 0 when unknown. */
async function unitCostForSku(tenantId: string, sku: string): Promise<number> {
  const row = await db.query.inventoryItems.findFirst({
    where: and(eq(inventoryItems.tenantId, tenantId), eq(inventoryItems.partNumber, sku)),
    columns: { unitCost: true },
  });
  const n = row?.unitCost == null ? 0 : Number(row.unitCost);
  return Number.isFinite(n) ? n : 0;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function audit(
  action: 'TRANSCRIBE' | 'GET_DRAFT' | 'PATCH_DRAFT' | 'CONFIRM' | 'SKU_SEARCH' | 'PURGE_AUDIO',
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
    '[AUDIT] voice-ticket-close',
  );
}

/**
 * Build the per-part SKU resolutions and the drafted invoice line items from the
 * extracted parts + a labor line. Invoice items stay status 'pending_approval'.
 */
async function buildResolutionsAndDraft(
  tenantId: string,
  extracted: ExtractedClose,
): Promise<{ skuResolutions: SkuResolution[]; draftInvoiceItems: DraftInvoiceItem[] }> {
  const skuResolutions: SkuResolution[] = [];
  const draftInvoiceItems: DraftInvoiceItem[] = [];

  for (const part of extracted.parts_used) {
    const { candidates, chosenSku } = await resolveSku(tenantId, part.raw);
    skuResolutions.push({ raw: part.raw, quantity: part.quantity, candidates, chosenSku });

    const quantity = Math.max(1, part.quantity || 1);
    const unitCost = chosenSku ? await unitCostForSku(tenantId, chosenSku) : 0;
    const description = chosenSku
      ? `${chosenSku} — ${candidates.find((c) => c.sku === chosenSku)?.name ?? part.raw}`
      : `${part.raw} (needs SKU match)`;
    draftInvoiceItems.push({
      description,
      quantity,
      unitCost,
      amount: Math.round(unitCost * quantity * 100) / 100,
      status: 'pending_approval',
    });
  }

  // Labor line (rate is unknown at this layer — drafted at 0, approver prices it).
  if (extracted.labor_minutes > 0) {
    draftInvoiceItems.push({
      description: `Labor — ${extracted.labor_minutes} min`,
      quantity: extracted.labor_minutes,
      unitCost: 0,
      amount: 0,
      status: 'pending_approval',
    });
  }

  return { skuResolutions, draftInvoiceItems };
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const transcribeSchema = z.object({
  audioBase64: z.string().min(1).optional(),
  audioUrl: z.string().min(1).optional(),
  transcript: z.string().optional(),
  clientDedupeKey: z.string().min(1).optional(),
});

const extractedPatchSchema = z
  .object({
    actions_taken: z.string().optional(),
    parts_used: z.array(z.object({ raw: z.string(), quantity: z.number() })).optional(),
    labor_minutes: z.number().optional(),
    follow_up_needed: z.boolean().optional(),
    customer_signature_collected: z.boolean().optional(),
    customer_satisfaction_note: z.string().optional(),
  })
  .passthrough();

const patchSchema = z.object({
  extracted: extractedPatchSchema.optional(),
  skuResolutions: z.array(z.any()).optional(),
  draftInvoiceItems: z.array(z.any()).optional(),
  laborMinutes: z.number().int().min(0).optional(),
  followUpNeeded: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function registerVoiceTicketCloseRoutes(app: Express) {
  /**
   * POST /api/voice-ticket-close/:ticketId/transcribe
   * Transcribe → extract → SKU-resolve → UPSERT a draft. Idempotent on
   * (tenantId, clientDedupeKey) so the IndexedDB offline queue can safely retry.
   */
  app.post(
    '/api/voice-ticket-close/:ticketId/transcribe',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        const userId = getUserId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        const parsed = transcribeSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
          return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
        }
        const ticketId = req.params.ticketId;

        // Verify the ticket exists for this tenant.
        const ticket = await db.query.serviceTickets.findFirst({
          where: and(eq(serviceTickets.id, ticketId), eq(serviceTickets.tenantId, tenantId)),
          columns: { id: true },
        });
        if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

        // Dedupe: an existing row for (tenantId, clientDedupeKey) is returned as-is.
        if (parsed.data.clientDedupeKey) {
          const existing = await db.query.voiceTicketCloses.findFirst({
            where: and(
              eq(voiceTicketCloses.tenantId, tenantId),
              eq(voiceTicketCloses.clientDedupeKey, parsed.data.clientDedupeKey),
            ),
            orderBy: [desc(voiceTicketCloses.createdAt)],
          });
          if (existing) {
            audit('TRANSCRIBE', {
              tenantId,
              userId,
              extra: { id: existing.id, deduped: true },
            });
            return res.status(200).json(existing);
          }
        }

        // Transcribe → extract → resolve SKUs + draft invoice items.
        const { transcript, source: transcriptSource } = await transcribeAudio({
          audioBase64: parsed.data.audioBase64,
          audioUrl: parsed.data.audioUrl,
          transcript: parsed.data.transcript,
        });
        const { extracted, source: extractionSource } = await extractCloseFields(transcript);
        const { skuResolutions, draftInvoiceItems } = await buildResolutionsAndDraft(
          tenantId,
          extracted,
        );

        const now = new Date();
        const [draft] = await db
          .insert(voiceTicketCloses)
          .values({
            tenantId,
            ticketId,
            techUserId: userId ?? null,
            clientDedupeKey: parsed.data.clientDedupeKey ?? null,
            audioUrl: parsed.data.audioUrl ?? null,
            transcript: transcript.slice(0, 8000),
            transcriptSource,
            extracted,
            extractionSource,
            skuResolutions,
            draftInvoiceItems,
            laborMinutes: extracted.labor_minutes,
            followUpNeeded: extracted.follow_up_needed,
            status: 'draft',
            audioPurgeAt: new Date(now.getTime() + THIRTY_DAYS_MS),
          })
          .returning();

        audit('TRANSCRIBE', {
          tenantId,
          userId,
          extra: {
            id: draft?.id,
            transcriptSource,
            extractionSource,
            parts: skuResolutions.length,
          },
        });
        res.status(201).json(draft);
      } catch (error: any) {
        log.error('Voice transcribe/draft failed:', error);
        res
          .status(500)
          .json({ message: 'Failed to transcribe and draft close', error: error?.message });
      }
    },
  );

  /**
   * GET /api/voice-ticket-close/skus/search?q=
   * Fuzzy SKU search (top 10) for inline disambiguation. Literal path — must be
   * registered before the parameterized GET /:ticketId.
   */
  app.get(
    '/api/voice-ticket-close/skus/search',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        const userId = getUserId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
        const q = typeof req.query.q === 'string' ? req.query.q : '';
        if (!q.trim()) return res.json({ candidates: [] });

        const { candidates } = await resolveSku(tenantId, q, 10);
        audit('SKU_SEARCH', { tenantId, userId, extra: { q, results: candidates.length } });
        res.json({ candidates });
      } catch (error: any) {
        log.error('SKU search failed:', error);
        res.status(500).json({ message: 'Failed to search SKUs', error: error?.message });
      }
    },
  );

  /**
   * POST /api/voice-ticket-close/purge-audio
   * Cron: null out audioUrl for closes whose audioPurgeAt has passed (privacy —
   * audio purged 30 days after close). Literal path — register before /:ticketId.
   */
  app.post(
    '/api/voice-ticket-close/purge-audio',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        const userId = getUserId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        const purged = await db
          .update(voiceTicketCloses)
          .set({ audioUrl: null, updatedAt: new Date() })
          .where(
            and(
              eq(voiceTicketCloses.tenantId, tenantId),
              sql`${voiceTicketCloses.audioPurgeAt} < now()`,
              sql`${voiceTicketCloses.audioUrl} is not null`,
            ),
          )
          .returning({ id: voiceTicketCloses.id });

        audit('PURGE_AUDIO', { tenantId, userId, extra: { purged: purged.length } });
        res.json({ purged: purged.length });
      } catch (error: any) {
        log.error('Audio purge failed:', error);
        res.status(500).json({ message: 'Failed to purge audio', error: error?.message });
      }
    },
  );

  /**
   * GET /api/voice-ticket-close/:ticketId — latest draft for the ticket.
   */
  app.get(
    '/api/voice-ticket-close/:ticketId',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        const draft = await db.query.voiceTicketCloses.findFirst({
          where: and(
            eq(voiceTicketCloses.tenantId, tenantId),
            eq(voiceTicketCloses.ticketId, req.params.ticketId),
          ),
          orderBy: [desc(voiceTicketCloses.createdAt)],
        });
        if (!draft)
          return res.status(404).json({ message: 'No voice close draft for this ticket' });
        res.json(draft);
      } catch (error: any) {
        log.error('Failed to load voice close draft:', error);
        res.status(500).json({ message: 'Failed to load draft', error: error?.message });
      }
    },
  );

  /**
   * PATCH /api/voice-ticket-close/draft/:id
   * Merge edits into the draft (extracted fields, SKU resolutions, invoice items,
   * labor, follow-up). Tenant-scoped; only 'draft' rows are editable.
   */
  app.patch(
    '/api/voice-ticket-close/draft/:id',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        const userId = getUserId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        const parsed = patchSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
          return res.status(400).json({ message: 'Invalid input', errors: parsed.error.flatten() });
        }

        const existing = await db.query.voiceTicketCloses.findFirst({
          where: and(
            eq(voiceTicketCloses.id, req.params.id),
            eq(voiceTicketCloses.tenantId, tenantId),
          ),
        });
        if (!existing) return res.status(404).json({ message: 'Draft not found' });
        if (existing.status !== 'draft') {
          return res.status(409).json({ message: `Draft is ${existing.status}; cannot edit.` });
        }

        const updates: Record<string, unknown> = { updatedAt: new Date() };
        if (parsed.data.extracted !== undefined) {
          const prev = (existing.extracted ?? {}) as Record<string, unknown>;
          updates.extracted = { ...prev, ...parsed.data.extracted };
        }
        if (parsed.data.skuResolutions !== undefined)
          updates.skuResolutions = parsed.data.skuResolutions;
        if (parsed.data.draftInvoiceItems !== undefined)
          updates.draftInvoiceItems = parsed.data.draftInvoiceItems;
        if (parsed.data.laborMinutes !== undefined) updates.laborMinutes = parsed.data.laborMinutes;
        if (parsed.data.followUpNeeded !== undefined)
          updates.followUpNeeded = parsed.data.followUpNeeded;

        const [updated] = await db
          .update(voiceTicketCloses)
          .set(updates)
          .where(
            and(eq(voiceTicketCloses.id, req.params.id), eq(voiceTicketCloses.tenantId, tenantId)),
          )
          .returning();

        audit('PATCH_DRAFT', { tenantId, userId, extra: { id: req.params.id } });
        res.json(updated);
      } catch (error: any) {
        log.error('Failed to patch voice close draft:', error);
        res.status(500).json({ message: 'Failed to update draft', error: error?.message });
      }
    },
  );

  /**
   * POST /api/voice-ticket-close/draft/:id/confirm
   * TRANSACTIONAL close: (a) close the service ticket (status completed,
   * resolvedAt, resolutionNotes carry the voice note, laborHours, partsUsed);
   * (b) deduct each resolved part quantity from the tech's truck inventory;
   * (c) mark the draft confirmed. Drafted invoice line items remain
   * pending_approval. Each step is wrapped so a partial-table environment
   * degrades gracefully; the response reports which steps applied.
   */
  app.post(
    '/api/voice-ticket-close/draft/:id/confirm',
    requireAuth,
    resolveTenant,
    async (req: any, res) => {
      try {
        const tenantId = getTenantId(req);
        const userId = getUserId(req);
        if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });

        const draft = await db.query.voiceTicketCloses.findFirst({
          where: and(
            eq(voiceTicketCloses.id, req.params.id),
            eq(voiceTicketCloses.tenantId, tenantId),
          ),
        });
        if (!draft) return res.status(404).json({ message: 'Draft not found' });
        if (draft.status === 'confirmed') {
          return res.status(409).json({ message: 'Draft is already confirmed.' });
        }

        const extracted = (draft.extracted ?? {}) as Partial<ExtractedClose>;
        const skuResolutions = Array.isArray(draft.skuResolutions)
          ? (draft.skuResolutions as unknown as SkuResolution[])
          : [];
        const resolvedParts = skuResolutions.filter(
          (r) => r && r.chosenSku && (r.quantity ?? 0) > 0,
        );
        const resolvedSkus = resolvedParts.map((r) => r.chosenSku as string);
        const laborMinutes = draft.laborMinutes ?? extracted.labor_minutes ?? 0;
        const actionsTaken = extracted.actions_taken ?? '';
        const transcript = draft.transcript ?? '';
        const resolutionNotes = `${actionsTaken}\n\n[tech_voice_note] ${transcript}`.trim();

        const steps = {
          ticketClosed: false,
          partsDeducted: 0,
          partsDeductFailed: 0,
          draftConfirmed: false,
        };
        const stepErrors: string[] = [];

        await db.transaction(async (tx) => {
          // (a) Close the service ticket.
          try {
            await tx
              .update(serviceTickets)
              .set({
                status: 'completed',
                resolvedAt: new Date(),
                resolutionNotes,
                laborHours: String(Math.round((laborMinutes / 60) * 100) / 100),
                partsUsed: resolvedSkus,
                updatedAt: new Date(),
              })
              .where(
                and(eq(serviceTickets.id, draft.ticketId), eq(serviceTickets.tenantId, tenantId)),
              );
            steps.ticketClosed = true;
          } catch (err: any) {
            stepErrors.push(`ticket: ${err?.message ?? 'failed'}`);
            log.warn('Confirm: ticket close failed (degrading):', err as any);
          }

          // (b) Deduct each resolved part from the tech's truck inventory.
          const techUserId = draft.techUserId ?? userId ?? null;
          if (techUserId) {
            for (const part of resolvedParts) {
              const sku = part.chosenSku as string;
              const qty = Math.max(1, Math.round(part.quantity || 1));
              try {
                await tx
                  .update(truckInventory)
                  .set({
                    quantityOnTruck: sql`${truckInventory.quantityOnTruck} - ${qty}`,
                    updatedAt: new Date(),
                  })
                  .where(
                    and(
                      eq(truckInventory.tenantId, tenantId),
                      eq(truckInventory.techUserId, techUserId),
                      eq(truckInventory.partSku, sku),
                    ),
                  );
                steps.partsDeducted += 1;
              } catch (err: any) {
                steps.partsDeductFailed += 1;
                stepErrors.push(`truck[${sku}]: ${err?.message ?? 'failed'}`);
                log.warn(`Confirm: truck deduct failed for ${sku} (degrading):`, err as any);
              }
            }
          }

          // (c) Mark the draft confirmed.
          try {
            await tx
              .update(voiceTicketCloses)
              .set({ status: 'confirmed', confirmedAt: new Date(), updatedAt: new Date() })
              .where(
                and(eq(voiceTicketCloses.id, draft.id), eq(voiceTicketCloses.tenantId, tenantId)),
              );
            steps.draftConfirmed = true;
          } catch (err: any) {
            stepErrors.push(`draft: ${err?.message ?? 'failed'}`);
            log.warn('Confirm: draft status update failed (degrading):', err as any);
          }
        });

        // TODO: persist into the canonical invoices/invoice_line_items once that
        // flow is wired — for now the line items stay in draftInvoiceItems with
        // status pending_approval.
        audit('CONFIRM', {
          tenantId,
          userId,
          extra: { id: draft.id, ticketId: draft.ticketId, steps },
        });
        res.json({
          ticketId: draft.ticketId,
          draftId: draft.id,
          status: 'confirmed',
          laborMinutes,
          resolvedSkus,
          draftInvoiceItems: draft.draftInvoiceItems ?? [],
          steps,
          ...(stepErrors.length ? { stepWarnings: stepErrors } : {}),
        });
      } catch (error: any) {
        log.error('Voice close confirm failed:', error);
        res
          .status(500)
          .json({ message: 'Failed to confirm and close ticket', error: error?.message });
      }
    },
  );
}
