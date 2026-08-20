// Sales Rep Email Autopilot Edge Function (US-SUPER-016 / PROD-012)
//
// Production counterpart to server/routes-email-autopilot.ts, which had no edge
// function — so the whole autopilot surface 404'd in production.
//
// >>> THERE IS NO SEND CAPABILITY HERE, exactly as on the Express side. <<<
// Accepting a draft records the rep's edits and edit-distance and leaves the
// draft in their mailbox; the rep presses Send themselves in Gmail/Outlook.
//
// Endpoints (the dispatcher strips the function-name segment first):
//   GET  /account            PUT  /settings          POST /connect
//   POST /scan               GET  /drafts?status=    GET  /drafts/:id
//   POST /drafts/:id/accept  POST /drafts/:id/reject
//   GET  /suppressions       POST /suppressions      DELETE /suppressions/:email
//   GET  /stats
//
// Classification and edit-distance come from _shared/email-autopilot-logic.ts,
// locked against the Express copy by
// server/tests/unit/email-autopilot-logic-parity.test.ts — they decide whether
// an email gets a draft at all, and produce the quality numbers the rep judges
// the feature by.
//
// Everything is scoped by (tenant_id, user_id): a rep only ever sees their own
// mailbox, drafts and suppressions.
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import {
  editDistancePct,
  fallbackClassify,
  fallbackDraft,
  TONE_MISS_THRESHOLD,
  type Classification,
  type DraftedReply,
  type InboxEmail,
  type VoiceFingerprint,
} from '../_shared/email-autopilot-logic.ts';

type Row = Record<string, any>;

const toCamel = (k: string) => k.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
const camelRow = (row: Row): Row => {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) out[toCamel(k)] = v;
  return out;
};

/** Matches obfuscateCredential on the Express side (base64, TODO(vault) both). */
const obfuscateCredential = (plaintext: string) => btoa(unescape(encodeURIComponent(plaintext)));

/** Public account projection — tokensSet boolean, NEVER raw tokens. */
function projectAccount(row: Row) {
  const tokens = (row.encrypted_tokens ?? {}) as Record<string, unknown>;
  return {
    provider: row.provider,
    emailAddress: row.email_address,
    enabled: row.enabled,
    lastScanAt: row.last_scan_at,
    tokensSet:
      (typeof tokens.accessToken === 'string' && tokens.accessToken.length > 0) ||
      (typeof tokens.refreshToken === 'string' && tokens.refreshToken.length > 0),
    voiceFingerprintSet: !!row.voice_fingerprint,
  };
}

/** STUB, same deterministic sample inbox as Express so scan is exercisable. */
function fetchInbox(account: { emailAddress: string | null; provider: string }): InboxEmail[] {
  const seed = (account.emailAddress ?? account.provider ?? 'inbox').length;
  return [
    {
      messageId: `sample-needsreply-${seed}`,
      threadId: `thread-needsreply-${seed}`,
      from: 'pat.buyer@acmeco.example.com',
      subject: 'Question about our service contract renewal',
      snippet:
        'Hi, can you send over the updated pricing for our copier fleet? We need a proposal by Friday. Thanks!',
    },
    {
      messageId: `sample-fyi-${seed}`,
      threadId: `thread-fyi-${seed}`,
      from: 'noreply@newsletter.example.com',
      subject: 'FYI: Your monthly usage report is ready',
      snippet: 'Your usage report for last month is now available in the portal. No action needed.',
    },
    {
      messageId: `sample-spam-${seed}`,
      threadId: `thread-spam-${seed}`,
      from: 'deals@promo.example.com',
      subject: 'Congratulations! You won a free vacation prize - act now',
      snippet: 'Click here to claim your free prize before this unsubscribe offer expires!!!',
    },
  ] as unknown as InboxEmail[];
}

function buildVoiceFingerprint(account: { emailAddress: string | null }): VoiceFingerprint {
  const name = (account.emailAddress ?? 'there').split('@')[0];
  return {
    tone: 'warm-professional',
    avgSentenceLength: 14,
    signature: `Best regards,\n${name}`,
    sampleCount: 50,
  };
}

/** Claude classification with the shared deterministic fallback. */
async function classifyEmail(email: InboxEmail): Promise<Classification> {
  try {
    const apiKey = Deno.env.get('CLAUDE_API_KEY');
    if (!apiKey) return fallbackClassify(email);
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 256,
        temperature: 0.2,
        messages: [
          {
            role: 'user',
            content:
              'Classify this inbound work email. Return ONLY a JSON object ' +
              '{"classification":"needs_reply"|"fyi"|"spam","confidence":0..1}, no prose.\n\n' +
              `From: ${email.from}\nSubject: ${email.subject}\n\n${email.snippet}`,
          },
        ],
      }),
    });
    if (!resp.ok) return fallbackClassify(email);
    const payload = (await resp.json()) as Row;
    const match = String(payload?.content?.[0]?.text ?? '').match(/\{[\s\S]*\}/);
    if (!match) return fallbackClassify(email);
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    const cls = String(parsed.classification ?? '');
    if (cls !== 'needs_reply' && cls !== 'fyi' && cls !== 'spam') return fallbackClassify(email);
    const conf = Number(parsed.confidence);
    return {
      classification: cls,
      confidence: Number.isFinite(conf) ? conf : 0.5,
      source: 'ai',
    };
  } catch {
    return fallbackClassify(email);
  }
}

/** Claude drafting in the rep's voice, with the shared templated fallback. */
async function draftReply(
  email: InboxEmail,
  fingerprint: VoiceFingerprint,
  crmContext: string | null,
): Promise<DraftedReply> {
  try {
    const apiKey = Deno.env.get('CLAUDE_API_KEY');
    if (!apiKey) return fallbackDraft(email, fingerprint, crmContext);
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
        temperature: 0.4,
        system:
          "You draft a reply in a sales rep's own voice for review. Return ONLY a JSON object " +
          '{"subject":string,"body":string}, no prose. Never promise anything not supported by ' +
          'the context. The rep will review and send it themselves.',
        messages: [
          {
            role: 'user',
            content:
              `Voice fingerprint: ${JSON.stringify(fingerprint)}\n` +
              `CRM context: ${crmContext ?? 'none'}\n\n` +
              `From: ${email.from}\nSubject: ${email.subject}\n\n${email.snippet}`,
          },
        ],
      }),
    });
    if (!resp.ok) return fallbackDraft(email, fingerprint, crmContext);
    const payload = (await resp.json()) as Row;
    const match = String(payload?.content?.[0]?.text ?? '').match(/\{[\s\S]*\}/);
    if (!match) return fallbackDraft(email, fingerprint, crmContext);
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    const subject = typeof parsed.subject === 'string' ? parsed.subject.trim() : '';
    const body = typeof parsed.body === 'string' ? parsed.body.trim() : '';
    if (!body) return fallbackDraft(email, fingerprint, crmContext);
    return {
      subject: subject || fallbackDraft(email, fingerprint, crmContext).subject,
      body,
      source: 'ai',
    };
  } catch {
    return fallbackDraft(email, fingerprint, crmContext);
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
    const userId = user.id;

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'email-autopilot');
    const first = parts[0];
    const second = parts[1];
    const third = parts[2];

    const audit = (action: string, extra?: unknown) =>
      console.log(
        JSON.stringify({
          audit: true,
          action,
          tenantId,
          userId,
          timestamp: new Date().toISOString(),
          ...(extra ? { extra } : {}),
        }),
      );

    async function getOrCreateAccount(): Promise<Row | null> {
      const { data } = await admin
        .from('email_autopilot_accounts')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .maybeSingle();
      if (data) return data as Row;
      await admin
        .from('email_autopilot_accounts')
        .insert({ tenant_id: tenantId, user_id: userId, provider: 'gmail' });
      const { data: created } = await admin
        .from('email_autopilot_accounts')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .maybeSingle();
      return (created as Row) ?? null;
    }

    // ─── GET /account ────────────────────────────────────────────────
    if (first === 'account' && req.method === 'GET') {
      const account = await getOrCreateAccount();
      if (!account) return createCorsResponse({ message: 'Failed to load account' }, 500, req);
      return createCorsResponse(projectAccount(account), 200, req);
    }

    // ─── POST /connect ───────────────────────────────────────────────
    if (first === 'connect' && req.method === 'POST') {
      const body = (await req.json().catch(() => ({}))) as Row;
      const provider = String(body.provider ?? '');
      if (provider !== 'gmail' && provider !== 'outlook') {
        return createCorsResponse(
          { message: 'Invalid input', errors: "provider must be 'gmail' or 'outlook'" },
          400,
          req,
        );
      }
      const current = await getOrCreateAccount();
      if (!current) return createCorsResponse({ message: 'Failed to load account' }, 500, req);

      // No real OAuth on either side: pasted tokens are obfuscated and never
      // echoed. Scope is read + create-draft only — never send.
      const tokens: Record<string, unknown> = {
        ...((current.encrypted_tokens ?? {}) as Record<string, unknown>),
      };
      if (body.accessToken !== undefined)
        tokens.accessToken = obfuscateCredential(String(body.accessToken));
      if (body.refreshToken !== undefined)
        tokens.refreshToken = obfuscateCredential(String(body.refreshToken));

      const emailAddress = body.emailAddress == null ? null : String(body.emailAddress);
      const { data, error } = await admin
        .from('email_autopilot_accounts')
        .update({
          provider,
          email_address: emailAddress,
          encrypted_tokens: tokens,
          voice_fingerprint: buildVoiceFingerprint({ emailAddress }),
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .select()
        .maybeSingle();
      if (error) throw new Error(error.message);

      audit('CONNECT', {
        provider,
        accessTokenSet: body.accessToken !== undefined,
        refreshTokenSet: body.refreshToken !== undefined,
      });
      return createCorsResponse(
        { connected: true, ...projectAccount((data as Row) ?? current) },
        200,
        req,
      );
    }

    // ─── PUT /settings ───────────────────────────────────────────────
    if (first === 'settings' && req.method === 'PUT') {
      const body = (await req.json().catch(() => ({}))) as Row;
      if (body.enabled !== undefined && typeof body.enabled !== 'boolean') {
        return createCorsResponse(
          { message: 'Invalid input', errors: 'enabled must be a boolean' },
          400,
          req,
        );
      }
      await getOrCreateAccount();
      const updates: Row = { updated_at: new Date().toISOString() };
      if (body.enabled !== undefined) updates.enabled = body.enabled;

      const { data, error } = await admin
        .from('email_autopilot_accounts')
        .update(updates)
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .select()
        .maybeSingle();
      if (error) throw new Error(error.message);
      audit('UPDATE_SETTINGS', { enabled: body.enabled });
      return createCorsResponse(projectAccount(data as Row), 200, req);
    }

    // ─── GET /stats ──────────────────────────────────────────────────
    if (first === 'stats' && req.method === 'GET') {
      const { data, error } = await admin
        .from('email_autopilot_drafts')
        .select('status, edit_distance_pct')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId);
      if (error) throw new Error(error.message);
      const rows = (data as Row[]) || [];

      const draftsReady = rows.filter((r) => r.status === 'draft').length;
      const acceptedRows = rows.filter((r) => r.status === 'accepted');
      const accepted = acceptedRows.length;
      const rejected = rows.filter((r) => r.status === 'rejected').length;

      const dists = acceptedRows
        .map((r) => Number(r.edit_distance_pct))
        .filter((n) => Number.isFinite(n));
      const avgEditDistancePct =
        dists.length > 0
          ? Math.round((dists.reduce((a, b) => a + b, 0) / dists.length) * 10) / 10
          : null;
      const toneMisses = dists.filter((n) => n > TONE_MISS_THRESHOLD).length;
      const toneMissRate = accepted > 0 ? Math.round((toneMisses / accepted) * 1000) / 10 : null;

      return createCorsResponse(
        { draftsReady, accepted, rejected, avgEditDistancePct, toneMissRate },
        200,
        req,
      );
    }

    // ─── /suppressions ───────────────────────────────────────────────
    if (first === 'suppressions') {
      if (!second && req.method === 'GET') {
        const { data, error } = await admin
          .from('email_autopilot_suppressions')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('user_id', userId);
        if (error) throw new Error(error.message);
        const rows = ((data as Row[]) || []).map(camelRow);
        return createCorsResponse({ data: rows, total: rows.length }, 200, req);
      }

      if (!second && req.method === 'POST') {
        const body = (await req.json().catch(() => ({}))) as Row;
        const contactEmail = String(body.contactEmail ?? '').trim();
        if (!contactEmail) {
          return createCorsResponse({ message: 'contactEmail is required' }, 400, req);
        }
        const { data: existing } = await admin
          .from('email_autopilot_suppressions')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('user_id', userId)
          .eq('contact_email', contactEmail)
          .maybeSingle();
        if (existing) {
          return createCorsResponse({ contactEmail, alreadySuppressed: true }, 201, req);
        }
        const { data, error } = await admin
          .from('email_autopilot_suppressions')
          .insert({
            tenant_id: tenantId,
            user_id: userId,
            contact_email: contactEmail,
            reason: body.reason ?? null,
          })
          .select()
          .maybeSingle();
        if (error) throw new Error(error.message);
        audit('SUPPRESS', { contactEmail });
        return createCorsResponse(camelRow((data as Row) ?? {}), 201, req);
      }

      if (second && req.method === 'DELETE') {
        const contactEmail = decodeURIComponent(second);
        const { error } = await admin
          .from('email_autopilot_suppressions')
          .delete()
          .eq('tenant_id', tenantId)
          .eq('user_id', userId)
          .eq('contact_email', contactEmail);
        if (error) throw new Error(error.message);
        audit('UNSUPPRESS', { contactEmail });
        return createCorsResponse({ success: true }, 200, req);
      }
    }

    // ─── /drafts ─────────────────────────────────────────────────────
    if (first === 'drafts') {
      if (!second && req.method === 'GET') {
        const status = url.searchParams.get('status') ?? 'draft';
        let q = admin
          .from('email_autopilot_drafts')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(500);
        if (status && status !== 'all') q = q.eq('status', status);
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        const rows = ((data as Row[]) || []).map((r) => ({
          ...camelRow(r),
          toneMiss:
            r.edit_distance_pct != null && Number(r.edit_distance_pct) > TONE_MISS_THRESHOLD,
        }));
        return createCorsResponse({ data: rows, total: rows.length }, 200, req);
      }

      if (second) {
        const { data: draftRow } = await admin
          .from('email_autopilot_drafts')
          .select('*')
          .eq('id', second)
          .eq('tenant_id', tenantId)
          .eq('user_id', userId)
          .maybeSingle();
        if (!draftRow) return createCorsResponse({ message: 'Draft not found' }, 404, req);
        const draft = draftRow as Row;

        if (!third && req.method === 'GET') {
          return createCorsResponse(
            {
              ...camelRow(draft),
              toneMiss:
                draft.edit_distance_pct != null &&
                Number(draft.edit_distance_pct) > TONE_MISS_THRESHOLD,
            },
            200,
            req,
          );
        }

        if (third === 'accept' && req.method === 'POST') {
          const body = (await req.json().catch(() => ({}))) as Row;
          const finalBody = String(body.finalBody ?? draft.draft_body ?? '');
          const pct = editDistancePct(String(draft.draft_body ?? ''), finalBody);
          const { data, error } = await admin
            .from('email_autopilot_drafts')
            .update({
              status: 'accepted',
              final_body: finalBody,
              edit_distance_pct: pct,
              reviewed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', second)
            .eq('tenant_id', tenantId)
            .eq('user_id', userId)
            .select()
            .maybeSingle();
          if (error) throw new Error(error.message);
          // Recording the rep's edit — NOT a send. The draft stays in their mailbox.
          audit('ACCEPT', { id: second, editDistancePct: pct });
          return createCorsResponse(camelRow((data as Row) ?? {}), 200, req);
        }

        if (third === 'reject' && req.method === 'POST') {
          const { data, error } = await admin
            .from('email_autopilot_drafts')
            .update({
              status: 'rejected',
              reviewed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', second)
            .eq('tenant_id', tenantId)
            .eq('user_id', userId)
            .select()
            .maybeSingle();
          if (error) throw new Error(error.message);
          audit('REJECT', { id: second });
          return createCorsResponse(camelRow((data as Row) ?? {}), 200, req);
        }
      }
    }

    // ─── POST /scan ──────────────────────────────────────────────────
    if (first === 'scan' && req.method === 'POST') {
      const account = await getOrCreateAccount();
      if (!account) return createCorsResponse({ message: 'Failed to load account' }, 500, req);
      if (!account.enabled) {
        return createCorsResponse(
          { skipped: true, reason: 'email autopilot disabled for this rep' },
          200,
          req,
        );
      }

      const fingerprint = (account.voice_fingerprint ??
        buildVoiceFingerprint({ emailAddress: account.email_address })) as VoiceFingerprint;
      const inbox = fetchInbox({
        emailAddress: account.email_address,
        provider: account.provider,
      });

      const { data: suppRows } = await admin
        .from('email_autopilot_suppressions')
        .select('contact_email')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId);
      const suppressed = new Set(
        ((suppRows as Row[]) || []).map((s) => String(s.contact_email ?? '').toLowerCase()),
      );

      const { data: existingRows } = await admin
        .from('email_autopilot_drafts')
        .select('provider_message_id')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId);
      const alreadyDrafted = new Set(
        ((existingRows as Row[]) || [])
          .map((d) => d.provider_message_id)
          .filter((v): v is string => !!v),
      );

      let scanned = 0;
      let drafted = 0;
      let skippedSuppressed = 0;
      let skippedFyiSpam = 0;

      for (const email of inbox) {
        scanned++;
        const fromEmail = (email.from ?? '').toLowerCase();
        const classification = await classifyEmail(email);
        if (classification.classification !== 'needs_reply') {
          skippedFyiSpam++;
          continue;
        }
        if (suppressed.has(fromEmail)) {
          skippedSuppressed++;
          continue;
        }
        const messageId = (email as unknown as Row).messageId as string;
        if (alreadyDrafted.has(messageId)) continue;

        // Best-effort CRM match by primary_contact_email.
        const { data: contact } = await admin
          .from('business_records')
          .select('id, company_name')
          .eq('tenant_id', tenantId)
          .eq('primary_contact_email', email.from)
          .maybeSingle();
        const crmContactId = (contact as Row | null)?.id ?? null;
        const crmContext = (contact as Row | null)?.company_name ?? null;

        const reply = await draftReply(email, fingerprint, crmContext);
        // STUB on both sides: no provider create-draft call yet, so no external id.
        const externalDraftId: string | null = null;

        const { data: row } = await admin
          .from('email_autopilot_drafts')
          .insert({
            tenant_id: tenantId,
            user_id: userId,
            provider_message_id: messageId,
            thread_id: (email as unknown as Row).threadId ?? null,
            contact_email: email.from,
            crm_contact_id: crmContactId,
            classification: classification.classification,
            classification_confidence: classification.confidence,
            inbound_subject: email.subject.slice(0, 500),
            inbound_snippet: email.snippet.slice(0, 2000),
            draft_subject: reply.subject.slice(0, 500),
            draft_body: reply.body.slice(0, 8000),
            draft_source: reply.source,
            external_draft_id: externalDraftId,
            status: 'draft',
          })
          .select('id')
          .maybeSingle();

        drafted++;
        alreadyDrafted.add(messageId);
        audit('DRAFT_CREATED', {
          draftId: (row as Row | null)?.id,
          messageId,
          classification: classification.classification,
          confidence: classification.confidence,
          draftSource: reply.source,
          crmContactId,
          inboundSubject: email.subject,
          draftSnippet: reply.body.slice(0, 200),
          externalDraftId,
          outcome: 'drafted_in_mailbox_pending_review_never_sent',
        });
      }

      await admin
        .from('email_autopilot_accounts')
        .update({ last_scan_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .eq('user_id', userId);

      audit('SCAN', { scanned, drafted, skippedSuppressed, skippedFyiSpam });
      return createCorsResponse({ scanned, drafted, skippedSuppressed, skippedFyiSpam }, 200, req);
    }

    return createCorsResponse({ error: 'Not found' }, 404, req);
  } catch (error) {
    console.error('[EMAIL-AUTOPILOT] error:', error);
    return createCorsResponse(
      { message: 'Request failed', error: (error as Error).message },
      500,
      req,
    );
  }
}
