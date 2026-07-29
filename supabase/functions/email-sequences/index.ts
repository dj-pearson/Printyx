// Email sequences (drip) enrollment Edge Function — CRMX-009.
//
// Prod parity for server/routes-email-sequences.ts: enroll/unenroll recipients
// and read per-recipient sequence state.
//
// WHY THIS EXISTS: client/src/hooks/useEmailSequences.ts calls
// /api/email-sequences/*, which Express served in dev only — there was no edge
// function, so all three endpoints 404'd in PRODUCTION, where the frontend hits
// functions.printyx.net directly. Found by npm run check:routes.
//
// URL layout (all under /email-sequences):
//   POST /:campaignId/enroll               — enroll recipients (idempotent)
//   GET  /:campaignId/enrollments          — list enrollments (?limit=, def 100)
//   GET  /enrollments/:id                  — one enrollment
//   POST /enrollments/:id/unenroll         — stop a recipient's sequence
//
// ROUTING GOTCHA: `enrollments` is a LITERAL first segment on two of these, but
// a campaign id on the other two. The literal branches MUST be matched first or
// `/enrollments/:id` is read as campaignId='enrollments'.
//
// SCOPE: this function owns enrollment STATE only. Actually SENDING the steps
// stays in server/services/email-sequence-scheduler.ts (a Node cron that needs
// the SendGrid client); this function deliberately does not send mail. The
// enroll path replicates that scheduler's enrollRecipient() decision logic —
// campaign must exist, suppression is honoured, delay comes from step 0 — so
// KEEP THE TWO IN SYNC if that logic changes.
//
// Dir name == URL segment, so prod routing needs no server.ts override.

import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { toCamelShallow } from '../_shared/case.ts';

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

// `history` is jsonb whose entries are already camelCase — shallow only, so a
// deep walk can't rewrite keys inside it.
// deno-lint-ignore no-explicit-any
const camel = (row: any) => (row ? toCamelShallow(row) : row);

interface SequenceStep {
  delayDays?: number;
  delayHours?: number;
  delayMinutes?: number;
}

// Mirrors stepDelayMs() in server/services/email-sequence-scheduler.ts.
function stepDelayMs(step: SequenceStep | undefined): number {
  if (!step) return 0;
  return (
    (Number(step.delayDays) || 0) * 86_400_000 +
    (Number(step.delayHours) || 0) * 3_600_000 +
    (Number(step.delayMinutes) || 0) * 60_000
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');

    if (!tenantId) {
      return createCorsResponse({ error: 'Tenant ID is required' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'email-sequences');
    const method = req.method;

    // ─── LITERAL /enrollments/... branches (must precede :campaignId) ──
    if (parts[0] === 'enrollments') {
      const enrollmentId = parts[1];
      if (!enrollmentId) return createCorsResponse({ error: 'Not found' }, 404, req);

      // POST /enrollments/:id/unenroll
      if (method === 'POST' && parts[2] === 'unenroll') {
        const body = await req.json().catch(() => ({}));
        const reason = typeof body?.reason === 'string' ? body.reason : 'manual';

        // Only an ACTIVE or SENDING enrollment can be stopped — matches
        // unenrollRecipient()'s status guard, so a second unenroll 404s
        // rather than silently "succeeding" on a completed row.
        const { data, error } = await admin
          .from('email_sequence_enrollments')
          .update({
            status: 'stopped',
            stopped_reason: reason,
            next_send_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', enrollmentId)
          .eq('tenant_id', tenantId)
          .in('status', ['active', 'sending'])
          .select('id');

        if (error) return createCorsResponse({ error: error.message }, 500, req);
        if (!data || data.length === 0) {
          return createCorsResponse({ error: 'Active enrollment not found' }, 404, req);
        }
        return createCorsResponse({ success: true }, 200, req);
      }

      // GET /enrollments/:id
      if (method === 'GET' && !parts[2]) {
        const { data, error } = await admin
          .from('email_sequence_enrollments')
          .select('*')
          .eq('id', enrollmentId)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (error) return createCorsResponse({ error: error.message }, 500, req);
        if (!data) return createCorsResponse({ error: 'Enrollment not found' }, 404, req);
        return createCorsResponse(camel(data), 200, req);
      }

      return createCorsResponse({ error: 'Not found' }, 404, req);
    }

    const campaignId = parts[0];
    const action = parts[1];

    // ─── GET /:campaignId/enrollments ────────────────────────────────
    if (method === 'GET' && campaignId && action === 'enrollments') {
      const raw = url.searchParams.get('limit');
      let limit = DEFAULT_LIMIT;
      if (raw !== null) {
        const parsed = Number(raw);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
          return createCorsResponse({ error: 'Invalid limit parameter' }, 400, req);
        }
        limit = parsed;
      }

      const { data, error } = await admin
        .from('email_sequence_enrollments')
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) return createCorsResponse({ error: error.message }, 500, req);
      return createCorsResponse((data ?? []).map(camel), 200, req);
    }

    // ─── POST /:campaignId/enroll ────────────────────────────────────
    if (method === 'POST' && campaignId && action === 'enroll') {
      const body = await req.json().catch(() => ({}));
      const recipients = body?.recipients;
      if (!Array.isArray(recipients) || recipients.length === 0) {
        return createCorsResponse({ error: 'recipients must be a non-empty array' }, 400, req);
      }
      for (const r of recipients) {
        if (!r || typeof r.email !== 'string' || !EMAIL_RE.test(r.email)) {
          return createCorsResponse({ error: 'each recipient needs a valid email' }, 400, req);
        }
      }

      // Campaign must belong to this tenant. Fetched once, outside the loop.
      const { data: campaign, error: campaignError } = await admin
        .from('email_campaigns')
        .select('id, sequence_steps')
        .eq('id', campaignId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (campaignError) return createCorsResponse({ error: campaignError.message }, 500, req);
      if (!campaign) return createCorsResponse({ error: 'Campaign not found' }, 404, req);

      const steps: SequenceStep[] = Array.isArray(campaign.sequence_steps)
        ? (campaign.sequence_steps as SequenceStep[])
        : [];
      const nextSendAt = new Date(Date.now() + stepDelayMs(steps[0])).toISOString();

      const results: Array<{ email: string; enrollmentId: string | null; enrolled: boolean }> = [];
      const emails = recipients.map((r: { email: string }) => String(r.email).trim().toLowerCase());

      // Suppression, resolved in ONE query for the whole batch rather than per
      // recipient. Deliberately NOT expressed as a PostgREST .or() string: that
      // would mean interpolating campaignId (a URL segment) into filter syntax,
      // where a comma or paren would change the predicate's meaning. Fetch the
      // candidate rows and decide in JS instead — no interpolation, no N+1.
      const { data: unsubs, error: unsubError } = await admin
        .from('email_unsubscribes')
        .select('email, unsubscribe_type, campaign_id')
        .eq('tenant_id', tenantId)
        .in('email', emails)
        .in('unsubscribe_type', ['global', 'campaign']);

      if (unsubError) return createCorsResponse({ error: unsubError.message }, 500, req);

      const suppressedEmails = new Set(
        (unsubs ?? [])
          .filter(
            (u: { unsubscribe_type: string; campaign_id: string | null }) =>
              u.unsubscribe_type === 'global' ||
              (u.unsubscribe_type === 'campaign' && u.campaign_id === campaignId),
          )
          .map((u: { email: string }) => u.email),
      );

      // Indexed loop, not `for (const email of emails)` — the same address can
      // legitimately appear twice in one payload, and indexOf() would then pair
      // the second occurrence with the FIRST one's businessRecordId/contactId.
      for (let i = 0; i < emails.length; i++) {
        const email = emails[i];
        const recipient = recipients[i];

        if (suppressedEmails.has(email)) {
          results.push({ email, enrollmentId: null, enrolled: false });
          continue;
        }

        const { data: inserted, error: insertError } = await admin
          .from('email_sequence_enrollments')
          .insert({
            tenant_id: tenantId,
            campaign_id: campaignId,
            recipient_email: email,
            business_record_id: recipient.businessRecordId ?? null,
            contact_id: recipient.contactId ?? null,
            status: steps.length === 0 ? 'completed' : 'active',
            current_step: 0,
            next_send_at: steps.length === 0 ? null : nextSendAt,
            enrolled_by: user.id,
          })
          .select('id')
          .single();

        if (!insertError && inserted) {
          results.push({ email, enrollmentId: inserted.id, enrolled: true });
          continue;
        }

        // Unique (campaign, email) — already enrolled. Report the existing id
        // with enrolled:false, same as the Express handler's `enrolled: !!id`
        // semantics for a re-enroll attempt.
        const { data: existing } = await admin
          .from('email_sequence_enrollments')
          .select('id')
          .eq('campaign_id', campaignId)
          .eq('recipient_email', email)
          .limit(1)
          .maybeSingle();

        results.push({
          email,
          enrollmentId: existing?.id ?? null,
          enrolled: false,
        });
      }

      return createCorsResponse({ results }, 201, req);
    }

    return createCorsResponse({ error: 'Not found' }, 404, req);
  } catch (error) {
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal error' },
      500,
      req,
    );
  }
}
