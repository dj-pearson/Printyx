// Voice-First Field Tech Ticket Close Edge Function (US-SUPER-005 / PROD-012)
//
// Production counterpart to server/routes-voice-ticket-close.ts, which had no
// edge function — so the whole voice close flow 404'd in production.
//
// Endpoints (the dispatcher strips the function-name segment first):
//   POST /:ticketId/transcribe   transcribe → extract → SKU-resolve → draft
//   GET  /:ticketId              latest draft for the ticket
//   PATCH /draft/:id             merge edits into the draft
//   POST /draft/:id/confirm      close ticket + deduct truck stock + confirm
//   POST /purge-audio            cron: null out audio past audio_purge_at
//
// The SKU matcher lives in _shared/voice-ticket-close-logic.ts and is locked
// against the Express copy by
// server/tests/unit/voice-ticket-close-logic-parity.test.ts — it decides which
// part comes off the technician's truck.
//
// ON ATOMICITY: the Express confirm runs inside db.transaction, but every step
// is individually try/caught and the transaction commits regardless — its own
// docstring says the wrapping exists so a partial-table environment "degrades
// gracefully", and the response reports which steps applied. This port
// reproduces that contract with sequential calls and the same steps /
// stepWarnings payload. Worth knowing: because a failed statement aborts a
// Postgres transaction, the Express per-step degradation cannot actually work
// past the first failure, while this one can. Neither rolls back, so a partial
// close is possible on both — recorded in the PRD rather than silently changed.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import {
  isAllowedAudioHost,
  rankSkuCandidates,
  type SkuCandidate,
} from '../_shared/voice-ticket-close-logic.ts';

type Row = Record<string, any>;

const THIRTY_DAYS_MS = 30 * 86_400_000;

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

const FALLBACK_EXTRACTION = (transcript: string): ExtractedClose => ({
  actions_taken: transcript ?? '',
  parts_used: [],
  labor_minutes: 0,
  follow_up_needed: false,
  customer_signature_collected: false,
  customer_satisfaction_note: '',
});

/**
 * Whisper transcription when OPENAI_API_KEY is set and audio is supplied;
 * otherwise the client-supplied transcript passes through as 'fallback'.
 * Mirrors transcribeAudio in the Express route.
 */
async function transcribeAudio(args: {
  audioBase64?: string;
  audioUrl?: string;
  transcript?: string;
}): Promise<{ transcript: string; source: 'whisper' | 'fallback' }> {
  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    const hasAudio = !!(args.audioBase64 || args.audioUrl);
    if (apiKey && hasAudio) {
      let bytes: Uint8Array | null = null;
      if (args.audioBase64) {
        const bin = atob(args.audioBase64);
        bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      } else if (args.audioUrl) {
        // CR-005 storage allowlist. This used to be
        // `args.audioUrl.startsWith(SUPABASE_URL)`, which is a prefix match on the
        // whole URL rather than a host check: with SUPABASE_URL
        // 'https://api.printyx.net', the URL 'https://api.printyx.net.evil.com/a.webm'
        // passes it, and the function fetches whatever an attacker's subdomain
        // points at. isAllowedAudioHost parses the hostname — the shape the
        // Express implementation used and the one CR-005's tests cover.
        if (isAllowedAudioHost(args.audioUrl, Deno.env.get('SUPABASE_URL'))) {
          const dl = await fetch(args.audioUrl);
          if (dl.ok) bytes = new Uint8Array(await dl.arrayBuffer());
        } else {
          console.warn('[VOICE-TICKET-CLOSE] rejected audioUrl: host not allowlisted');
        }
      }
      if (bytes && bytes.byteLength > 0) {
        const form = new FormData();
        form.append('model', 'whisper-1');
        form.append('file', new Blob([bytes], { type: 'audio/webm' }), 'voice-note.webm');
        const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form,
        });
        if (resp.ok) {
          const json = (await resp.json()) as { text?: string };
          if (typeof json.text === 'string' && json.text.trim().length > 0) {
            return { transcript: json.text.trim(), source: 'whisper' };
          }
        } else {
          console.warn(`[VOICE-TICKET-CLOSE] Whisper returned ${resp.status}; using fallback`);
        }
      }
    }
  } catch (err) {
    console.warn('[VOICE-TICKET-CLOSE] transcription failed; using fallback:', err);
  }
  return { transcript: (args.transcript ?? '').trim(), source: 'fallback' };
}

/** Claude field extraction with the same prompt and deterministic fallback. */
async function extractCloseFields(
  transcript: string,
): Promise<{ extracted: ExtractedClose; source: 'ai' | 'fallback' }> {
  const text = (transcript ?? '').trim();
  if (!text) return { extracted: FALLBACK_EXTRACTION(''), source: 'fallback' };

  try {
    const apiKey = Deno.env.get('CLAUDE_API_KEY');
    if (!apiKey) return { extracted: FALLBACK_EXTRACTION(text), source: 'fallback' };

    const system =
      "You convert a field service technician's spoken ticket-close note into structured JSON. " +
      'Return ONLY a single JSON object, no prose, of EXACTLY this shape: ' +
      '{"actions_taken": string, "parts_used": [{"raw": string, "quantity": number}], ' +
      '"labor_minutes": number, "follow_up_needed": boolean, ' +
      '"customer_signature_collected": boolean, "customer_satisfaction_note": string}. ' +
      'parts_used lists each physical part the tech mentions installing/swapping with its quantity ' +
      '(default 1). labor_minutes is the total on-site labor in minutes (0 if unstated). ' +
      'Omit nothing; use empty string / empty array / 0 / false when unknown.';

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        temperature: 0.2,
        system,
        messages: [{ role: 'user', content: text }],
      }),
    });
    if (!resp.ok) return { extracted: FALLBACK_EXTRACTION(text), source: 'fallback' };

    const payload = (await resp.json()) as Row;
    const raw = String(payload?.content?.[0]?.text ?? '');
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
        return {
          raw: str(obj.raw).trim(),
          quantity: Math.max(1, Math.round(num(obj.quantity)) || 1),
        };
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
    console.warn('[VOICE-TICKET-CLOSE] extraction failed; using fallback:', err);
    return { extracted: FALLBACK_EXTRACTION(text), source: 'fallback' };
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
    const { parts } = normalizePath(url.pathname, 'voice-ticket-close');
    const first = parts[0];
    const second = parts[1];
    const third = parts[2];

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

    /** Tenant-scoped inventory read + the shared, locked ranking. */
    async function resolveSku(raw: string) {
      const term = (raw ?? '').trim();
      if (!term) return { candidates: [] as SkuCandidate[], chosenSku: null };
      const { data } = await admin
        .from('inventory_items')
        .select('part_number, name, item_description')
        .eq('tenant_id', tenantId);
      const rows = ((data as Row[]) || []).map((r) => ({
        partNumber: r.part_number,
        name: r.name,
        itemDescription: r.item_description,
      }));
      return rankSkuCandidates(term, rows);
    }

    async function unitCostForSku(sku: string): Promise<number> {
      const { data } = await admin
        .from('inventory_items')
        .select('unit_cost')
        .eq('tenant_id', tenantId)
        .eq('part_number', sku)
        .maybeSingle();
      const n = (data as Row | null)?.unit_cost == null ? 0 : Number((data as Row).unit_cost);
      return Number.isFinite(n) ? n : 0;
    }

    // ─── POST /purge-audio ───────────────────────────────────────────
    if (first === 'purge-audio' && req.method === 'POST') {
      const { data, error } = await admin
        .from('voice_ticket_closes')
        .update({ audio_url: null, updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .lt('audio_purge_at', new Date().toISOString())
        .not('audio_url', 'is', null)
        .select('id');
      if (error) throw new Error(error.message);
      const purged = ((data as Row[]) || []).length;
      audit('PURGE_AUDIO', { purged });
      return createCorsResponse({ purged }, 200, req);
    }

    // ─── /draft/:id and /draft/:id/confirm ───────────────────────────
    if (first === 'draft' && second) {
      const { data: existing } = await admin
        .from('voice_ticket_closes')
        .select('*')
        .eq('id', second)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (req.method === 'PATCH' && !third) {
        if (!existing) return createCorsResponse({ message: 'Draft not found' }, 404, req);
        const draft = existing as Row;
        if (draft.status !== 'draft') {
          return createCorsResponse(
            { message: `Draft is ${draft.status}; cannot edit.` },
            409,
            req,
          );
        }
        const body = (await req.json().catch(() => ({}))) as Row;
        const updates: Row = { updated_at: new Date().toISOString() };
        if (body.extracted !== undefined) {
          updates.extracted = { ...((draft.extracted ?? {}) as Row), ...(body.extracted as Row) };
        }
        if (body.skuResolutions !== undefined) updates.sku_resolutions = body.skuResolutions;
        if (body.draftInvoiceItems !== undefined)
          updates.draft_invoice_items = body.draftInvoiceItems;
        if (body.laborMinutes !== undefined) updates.labor_minutes = body.laborMinutes;
        if (body.followUpNeeded !== undefined) updates.follow_up_needed = body.followUpNeeded;

        const { data, error } = await admin
          .from('voice_ticket_closes')
          .update(updates)
          .eq('id', second)
          .eq('tenant_id', tenantId)
          .select()
          .maybeSingle();
        if (error) throw new Error(error.message);
        audit('PATCH_DRAFT', { id: second });
        return createCorsResponse(data, 200, req);
      }

      if (req.method === 'POST' && third === 'confirm') {
        if (!existing) return createCorsResponse({ message: 'Draft not found' }, 404, req);
        const draft = existing as Row;
        if (draft.status === 'confirmed') {
          return createCorsResponse({ message: 'Draft is already confirmed.' }, 409, req);
        }

        const extracted = (draft.extracted ?? {}) as Partial<ExtractedClose>;
        const skuResolutions: Row[] = Array.isArray(draft.sku_resolutions)
          ? draft.sku_resolutions
          : [];
        const resolvedParts = skuResolutions.filter(
          (r) => r && r.chosenSku && (r.quantity ?? 0) > 0,
        );
        const resolvedSkus = resolvedParts.map((r) => String(r.chosenSku));
        const laborMinutes = draft.labor_minutes ?? extracted.labor_minutes ?? 0;
        const resolutionNotes =
          `${extracted.actions_taken ?? ''}\n\n[tech_voice_note] ${draft.transcript ?? ''}`.trim();

        const steps = {
          ticketClosed: false,
          partsDeducted: 0,
          partsDeductFailed: 0,
          draftConfirmed: false,
        };
        const stepErrors: string[] = [];

        // (a) Close the service ticket.
        const { error: ticketErr } = await admin
          .from('service_tickets')
          .update({
            status: 'completed',
            resolved_at: new Date().toISOString(),
            resolution_notes: resolutionNotes,
            labor_hours: String(Math.round((laborMinutes / 60) * 100) / 100),
            parts_used: resolvedSkus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', draft.ticket_id)
          .eq('tenant_id', tenantId);
        if (ticketErr) stepErrors.push(`ticket: ${ticketErr.message}`);
        else steps.ticketClosed = true;

        // (b) Deduct each resolved part from the tech's truck.
        const techUserId = draft.tech_user_id ?? user.id ?? null;
        if (techUserId) {
          for (const part of resolvedParts) {
            const sku = String(part.chosenSku);
            const qty = Math.max(1, Math.round(Number(part.quantity) || 1));
            const { data: stock } = await admin
              .from('truck_inventory')
              .select('id, quantity_on_truck')
              .eq('tenant_id', tenantId)
              .eq('tech_user_id', techUserId)
              .eq('part_sku', sku)
              .maybeSingle();
            if (!stock) {
              steps.partsDeductFailed += 1;
              stepErrors.push(`truck[${sku}]: no stock row for this tech`);
              continue;
            }
            // PostgREST cannot express `quantity_on_truck - qty` in an update, so
            // the current value is read first. Not atomic — matching the Express
            // behaviour, which also does not lock the row.
            const { error: deductErr } = await admin
              .from('truck_inventory')
              .update({
                quantity_on_truck: Number((stock as Row).quantity_on_truck ?? 0) - qty,
                updated_at: new Date().toISOString(),
              })
              .eq('id', (stock as Row).id);
            if (deductErr) {
              steps.partsDeductFailed += 1;
              stepErrors.push(`truck[${sku}]: ${deductErr.message}`);
            } else {
              steps.partsDeducted += 1;
            }
          }
        }

        // (c) Mark the draft confirmed.
        const { error: draftErr } = await admin
          .from('voice_ticket_closes')
          .update({
            status: 'confirmed',
            confirmed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', draft.id)
          .eq('tenant_id', tenantId);
        if (draftErr) stepErrors.push(`draft: ${draftErr.message}`);
        else steps.draftConfirmed = true;

        audit('CONFIRM', { id: draft.id, ticketId: draft.ticket_id, steps });
        return createCorsResponse(
          {
            ticketId: draft.ticket_id,
            draftId: draft.id,
            status: 'confirmed',
            laborMinutes,
            resolvedSkus,
            draftInvoiceItems: draft.draft_invoice_items ?? [],
            steps,
            ...(stepErrors.length ? { stepWarnings: stepErrors } : {}),
          },
          200,
          req,
        );
      }
    }

    // ─── POST /:ticketId/transcribe ──────────────────────────────────
    if (first && second === 'transcribe' && req.method === 'POST') {
      const ticketId = first;
      const body = (await req.json().catch(() => ({}))) as Row;

      const { data: ticket } = await admin
        .from('service_tickets')
        .select('id')
        .eq('id', ticketId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (!ticket) return createCorsResponse({ message: 'Ticket not found' }, 404, req);

      // Dedupe: an existing row for (tenant, clientDedupeKey) is returned as-is.
      if (body.clientDedupeKey) {
        const { data: dupe } = await admin
          .from('voice_ticket_closes')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('client_dedupe_key', body.clientDedupeKey)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (dupe) {
          audit('TRANSCRIBE', { id: (dupe as Row).id, deduped: true });
          return createCorsResponse(dupe, 200, req);
        }
      }

      const { transcript, source: transcriptSource } = await transcribeAudio({
        audioBase64: body.audioBase64,
        audioUrl: body.audioUrl,
        transcript: body.transcript,
      });
      const { extracted, source: extractionSource } = await extractCloseFields(transcript);

      const skuResolutions: Row[] = [];
      const draftInvoiceItems: Row[] = [];
      for (const part of extracted.parts_used) {
        const { candidates, chosenSku } = await resolveSku(part.raw);
        skuResolutions.push({ raw: part.raw, quantity: part.quantity, candidates, chosenSku });

        const quantity = Math.max(1, part.quantity || 1);
        const unitCost = chosenSku ? await unitCostForSku(chosenSku) : 0;
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
      if (extracted.labor_minutes > 0) {
        draftInvoiceItems.push({
          description: `Labor — ${extracted.labor_minutes} min`,
          quantity: extracted.labor_minutes,
          unitCost: 0,
          amount: 0,
          status: 'pending_approval',
        });
      }

      const { data: draft, error } = await admin
        .from('voice_ticket_closes')
        .insert({
          tenant_id: tenantId,
          ticket_id: ticketId,
          tech_user_id: user.id ?? null,
          client_dedupe_key: body.clientDedupeKey ?? null,
          audio_url: body.audioUrl ?? null,
          transcript: transcript.slice(0, 8000),
          transcript_source: transcriptSource,
          extracted,
          extraction_source: extractionSource,
          sku_resolutions: skuResolutions,
          draft_invoice_items: draftInvoiceItems,
          labor_minutes: extracted.labor_minutes,
          follow_up_needed: extracted.follow_up_needed,
          status: 'draft',
          audio_purge_at: new Date(Date.now() + THIRTY_DAYS_MS).toISOString(),
        })
        .select()
        .maybeSingle();
      if (error) throw new Error(error.message);

      audit('TRANSCRIBE', { id: (draft as Row | null)?.id, transcriptSource, extractionSource });
      return createCorsResponse(draft, 201, req);
    }

    // ─── GET /:ticketId (latest draft) ───────────────────────────────
    if (first && !second && req.method === 'GET') {
      const { data } = await admin
        .from('voice_ticket_closes')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('ticket_id', first)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) {
        return createCorsResponse({ message: 'No voice close draft for this ticket' }, 404, req);
      }
      return createCorsResponse(data, 200, req);
    }

    return createCorsResponse({ error: 'Not found' }, 404, req);
  } catch (error) {
    console.error('[VOICE-TICKET-CLOSE] error:', error);
    return createCorsResponse(
      { message: 'Request failed', error: (error as Error).message },
      500,
      req,
    );
  }
}
