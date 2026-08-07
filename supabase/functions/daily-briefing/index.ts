/**
 * Daily-briefing edge function (PROD-010) — port of server/routes-daily-briefing.ts.
 *
 * WHY: the domain had an Express handler and NO edge function, so
 * pages/DailyBriefings.tsx worked in dev and hard-404'd in production, where
 * getApiUrl() rewrites /api/daily-briefing -> functions.printyx.net/daily-briefing
 * with no Express fallback.
 *
 * ROUTES — all six Express endpoints, which is also everything the page calls:
 *   POST /generate      { date?, force?, userId?, all? } -> counts
 *   GET  /              ?userId= -> { data, total }, newest first, limit 30
 *   GET  /preferences   getOrCreate for the caller
 *   PUT  /preferences   partial update
 *   GET  /stats         A/B open-rate by variant + overall
 *   POST /:id/open      open tracking
 *
 * ALL SIX had to ship together: a crmProxies entry forwards the entire prefix
 * and falls through only on a network error, never a 404, so a partial port
 * would take the unported endpoints from working-in-dev to 404-in-dev.
 *
 * SHAPE: DailyBriefings.tsx types BriefingLog/Preferences/StatsResponse in
 * camelCase. PostgREST returns snake_case, so rows are mapped explicitly — NOT
 * key-converted, because `content` is a jsonb column whose inner keys are
 * already camelCase (sections/bullets/wordCount) and must not be walked.
 *
 * TWO DELIBERATE DIVERGENCES FROM EXPRESS, both disclosed rather than silent:
 *
 * 1. The briefing email HTML-escapes the subject and bullets. Express
 *    interpolated them raw, and those strings carry user-controlled data —
 *    proposal titles flow into metric labels, which flow into bullets — so an
 *    apostrophe or angle bracket in a deal name could break the markup, and a
 *    crafted one could inject into an outbound email. Escaping changes nothing
 *    about legitimate content.
 *
 * 2. email_sent is recorded only when the message ACTUALLY left. _shared's
 *    sendEmail returns { messageId, simulated? } and throws on real failure —
 *    there is no `success` field, and the Express code's `result?.success` check
 *    would read undefined here. `simulated: true` means SENDGRID_API_KEY is
 *    unset and nothing was sent, so counting it as delivered would inflate the
 *    delivery numbers the page displays.
 */

import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { generateCompletion } from '../_shared/anthropic.ts';
import { sendEmail } from '../email-marketing/_sendgrid.ts';
import {
  assembleData,
  briefingDate,
  buildFallback,
  buildPrompt,
  deriveRole,
  parseAiBriefing,
  wordCount,
  type BriefingRole,
  type BriefingVariant,
  type GeneratedBriefing,
} from './briefing.ts';

/** _sendgrid requires an explicit `from`; same env-with-default idiom as public-booking. */
const BRIEFING_FROM_EMAIL = Deno.env.get('BRIEFING_FROM_EMAIL') || 'noreply@printyx.net';

const FREQUENCIES = new Set(['daily', 'weekly', 'off']);
const VARIANTS = new Set(['numbers', 'narrative']);
const ROLES = new Set(['owner', 'service_manager', 'sales_rep']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Log row -> the camelCase BriefingLog the page types. */
const toLog = (r: Record<string, unknown>) => ({
  id: r.id,
  role: r.role,
  briefingDate: r.briefing_date,
  variant: r.variant,
  subject: r.subject ?? null,
  emailSent: r.email_sent,
  inAppSent: r.in_app_sent,
  content: r.content ?? null,
  sentAt: r.sent_at,
  openedAt: r.opened_at ?? null,
});

const toPrefs = (r: Record<string, unknown> | null) =>
  r
    ? {
        id: r.id,
        frequency: r.frequency,
        abVariant: r.ab_variant,
        role: r.role ?? null,
        emailEnabled: r.email_enabled,
        inAppEnabled: r.in_app_enabled,
        lastSentAt: r.last_sent_at ?? null,
      }
    : null;

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
      return createCorsResponse({ message: 'Tenant ID is required' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    // Idempotent — the dispatcher strips segment 0 before the handler runs.
    const { parts } = normalizePath(url.pathname, 'daily-briefing');
    const [first, second] = parts;
    const method = req.method.toUpperCase();

    // --- POST /generate ----------------------------------------------------
    // Literal segments matched before /:id so 'generate' is never read as an id.
    if (method === 'POST' && first === 'generate') {
      return await handleGenerate(req, admin, tenantId, user.id);
    }

    // --- GET|PUT /preferences ----------------------------------------------
    if (first === 'preferences') {
      if (method === 'GET') {
        const prefs = await getOrCreatePreferences(admin, tenantId, user.id);
        return createCorsResponse(toPrefs(prefs), 200, req);
      }
      if (method === 'PUT') {
        const body = await safeJson(req);

        const errors: Record<string, string> = {};
        if (body.frequency !== undefined && !FREQUENCIES.has(String(body.frequency)))
          errors.frequency = 'must be daily, weekly or off';
        if (body.abVariant !== undefined && !VARIANTS.has(String(body.abVariant)))
          errors.abVariant = 'must be numbers or narrative';
        if (body.role !== undefined && !ROLES.has(String(body.role)))
          errors.role = 'must be owner, service_manager or sales_rep';
        if (body.emailEnabled !== undefined && typeof body.emailEnabled !== 'boolean')
          errors.emailEnabled = 'must be a boolean';
        if (body.inAppEnabled !== undefined && typeof body.inAppEnabled !== 'boolean')
          errors.inAppEnabled = 'must be a boolean';
        if (Object.keys(errors).length) {
          return createCorsResponse({ message: 'Invalid input', errors }, 400, req);
        }

        await getOrCreatePreferences(admin, tenantId, user.id);

        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (body.frequency !== undefined) updates.frequency = body.frequency;
        if (body.abVariant !== undefined) updates.ab_variant = body.abVariant;
        if (body.role !== undefined) updates.role = body.role;
        if (body.emailEnabled !== undefined) updates.email_enabled = body.emailEnabled;
        if (body.inAppEnabled !== undefined) updates.in_app_enabled = body.inAppEnabled;

        const { data, error } = await admin
          .from('daily_briefing_preferences')
          .update(updates)
          .eq('tenant_id', tenantId)
          .eq('user_id', user.id)
          .select()
          .maybeSingle();
        if (error) throw error;
        return createCorsResponse(toPrefs(data ?? null), 200, req);
      }
    }

    // --- GET /stats --------------------------------------------------------
    if (method === 'GET' && first === 'stats') {
      const { data, error } = await admin
        .from('daily_briefing_log')
        .select('variant, opened_at')
        .eq('tenant_id', tenantId);
      if (error) throw error;

      // Express used GROUP BY variant with count(*) and count(opened_at).
      // count(opened_at) counts NON-NULLS only — counting every row as opened
      // would report a 100% open rate on the metric this feature is judged by.
      const byVariantMap = new Map<string, { sent: number; opened: number }>();
      for (const r of data ?? []) {
        const key = String(r.variant);
        const entry = byVariantMap.get(key) ?? { sent: 0, opened: 0 };
        entry.sent += 1;
        if (r.opened_at != null) entry.opened += 1;
        byVariantMap.set(key, entry);
      }

      const byVariant = Array.from(byVariantMap.entries()).map(([variant, v]) => ({
        variant,
        sent: v.sent,
        opened: v.opened,
        openRate: v.sent > 0 ? Math.round((v.opened / v.sent) * 1000) / 10 : 0,
      }));

      const totalSent = byVariant.reduce((a, v) => a + v.sent, 0);
      const totalOpened = byVariant.reduce((a, v) => a + v.opened, 0);

      return createCorsResponse(
        {
          byVariant,
          overall: {
            sent: totalSent,
            opened: totalOpened,
            openRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 1000) / 10 : 0,
          },
        },
        200,
        req,
      );
    }

    // --- POST /:id/open ----------------------------------------------------
    if (method === 'POST' && first && second === 'open') {
      // Only set opened_at where it is still NULL. Re-opening must not overwrite
      // the FIRST open time, or the A/B open-rate metric stops meaning anything.
      const { data, error } = await admin
        .from('daily_briefing_log')
        .update({ opened_at: new Date().toISOString() })
        .eq('id', first)
        .eq('tenant_id', tenantId)
        .is('opened_at', null)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      return createCorsResponse({ ok: true, firstOpen: !!data }, 200, req);
    }

    // --- GET / (list) ------------------------------------------------------
    if (method === 'GET' && !first) {
      const override = url.searchParams.get('userId') ?? undefined;
      const userId = override ?? user.id;

      const { data, error } = await admin
        .from('daily_briefing_log')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .order('sent_at', { ascending: false })
        .limit(30);
      if (error) throw error;

      const rows = (data ?? []).map((r: Record<string, unknown>) => toLog(r));
      return createCorsResponse({ data: rows, total: rows.length }, 200, req);
    }

    return createCorsResponse({ error: 'Not found' }, 404, req);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('daily-briefing function error:', message);
    return createCorsResponse(
      { message: 'Daily-briefing request failed', error: message },
      500,
      req,
    );
  }
}

// ---------------------------------------------------------------------------
// Generate
// ---------------------------------------------------------------------------

async function handleGenerate(
  req: Request,
  admin: ReturnType<typeof createSupabaseServiceClient>,
  tenantId: string,
  callerId: string,
): Promise<Response> {
  const body = await safeJson(req);

  const date = typeof body.date === 'string' ? body.date : briefingDate();
  if (!DATE_RE.test(date)) {
    return createCorsResponse(
      { message: 'Invalid input', errors: { date: 'date must be YYYY-MM-DD' } },
      400,
      req,
    );
  }
  const force = body.force === true;

  let targets: Array<{ id: string; email: string | null; role: string | null }>;
  if (body.all === true) {
    const { data } = await admin
      .from('users')
      .select('id, email, role')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);
    targets = (data ?? []).map((u: Record<string, unknown>) => ({
      id: String(u.id),
      email: (u.email as string) ?? null,
      role: (u.role as string) ?? null,
    }));
  } else {
    const targetUserId = typeof body.userId === 'string' ? body.userId : callerId;
    const { data: u } = await admin
      .from('users')
      .select('id, email, role')
      .eq('id', targetUserId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!u) return createCorsResponse({ message: 'User not found' }, 404, req);
    targets = [
      { id: String(u.id), email: (u.email as string) ?? null, role: (u.role as string) ?? null },
    ];
  }

  let generated = 0;
  let skippedOff = 0;
  let emailed = 0;
  let inApp = 0;

  for (const u of targets) {
    const outcome = await generateBriefingForUser(admin, tenantId, u, date, force);
    if (outcome.skippedOff) skippedOff++;
    if (outcome.generated) generated++;
    if (outcome.emailed) emailed++;
    if (outcome.inApp) inApp++;
  }

  return createCorsResponse({ generated, skippedOff, emailed, inApp }, 200, req);
}

async function generateBriefingForUser(
  admin: ReturnType<typeof createSupabaseServiceClient>,
  tenantId: string,
  u: { id: string; email: string | null; role: string | null },
  date: string,
  force: boolean,
): Promise<{ generated: boolean; skippedOff: boolean; emailed: boolean; inApp: boolean }> {
  const prefs = await getOrCreatePreferences(admin, tenantId, u.id);
  if (!prefs) return { generated: false, skippedOff: false, emailed: false, inApp: false };
  // frequency 'off' is a real opt-out; only an explicit force overrides it.
  if (prefs.frequency === 'off' && !force) {
    return { generated: false, skippedOff: true, emailed: false, inApp: false };
  }

  const role = ((prefs.role as BriefingRole | null) ?? deriveRole(u.role)) as BriefingRole;
  const variant = ((prefs.ab_variant as BriefingVariant) ?? 'numbers') as BriefingVariant;

  const data = await assembleData(admin, tenantId, u.id, role);
  const briefing = await generateBriefingText(data, variant, date);

  const content = {
    role,
    variant,
    sections: data.sections,
    bullets: briefing.bullets,
    links: [{ label: 'Open briefings', url: '/briefings' }],
    wordCount: wordCount(briefing.bullets, briefing.subject),
    source: briefing.source,
  };

  // In-app badge — best effort, exactly as in Express: a notification failure
  // must not lose the briefing itself.
  let inAppSent = false;
  if (prefs.in_app_enabled) {
    try {
      const { error } = await admin.from('user_notifications').insert({
        tenant_id: tenantId,
        user_id: u.id,
        type: 'daily_briefing',
        priority: 'medium',
        category: 'system',
        title: briefing.subject,
        message: briefing.bullets[0] ?? 'Your morning briefing is ready.',
        action_url: '/briefings',
      });
      if (!error) inAppSent = true;
    } catch {
      // non-fatal
    }
  }

  // Email — also best effort.
  let emailSent = false;
  if (prefs.email_enabled && u.email) {
    try {
      const html = `<h2>${escapeHtml(briefing.subject)}</h2><ul>${briefing.bullets
        .map((b) => `<li>${escapeHtml(b)}</li>`)
        .join('')}</ul>`;
      const result = await sendEmail({
        to: u.email,
        from: BRIEFING_FROM_EMAIL,
        subject: briefing.subject,
        html,
        text: briefing.bullets.join('\n'),
      });
      // _sendgrid returns { messageId, simulated? } and THROWS on real failure —
      // there is no `success` field. `simulated: true` means no SENDGRID_API_KEY
      // was configured and nothing actually left the building, so it must not be
      // recorded as sent: email_sent feeds the delivery counts the page shows.
      emailSent = result?.simulated !== true;
    } catch {
      // non-fatal
    }
  }

  const { error: logError } = await admin.from('daily_briefing_log').insert({
    tenant_id: tenantId,
    user_id: u.id,
    role,
    briefing_date: date,
    variant,
    subject: briefing.subject,
    email_sent: emailSent,
    in_app_sent: inAppSent,
    content,
  });
  if (logError) throw logError;

  await admin
    .from('daily_briefing_preferences')
    .update({ last_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('user_id', u.id);

  return { generated: true, skippedOff: false, emailed: emailSent, inApp: inAppSent };
}

/** Claude when reachable, deterministic fallback otherwise — never throws. */
async function generateBriefingText(
  data: Parameters<typeof buildPrompt>[0],
  variant: BriefingVariant,
  date: string,
): Promise<GeneratedBriefing> {
  const fallback = buildFallback(data, date);
  try {
    const text = await generateCompletion({
      max_tokens: 700,
      messages: [{ role: 'user', content: buildPrompt(data, variant, date) }],
    });
    const parsed = parseAiBriefing(text);
    return parsed ? { ...parsed, source: 'ai' } : fallback;
  } catch {
    // A briefing must still be produced when the AI is unavailable.
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read the caller's preferences, creating them with defaults on first use.
 * Tolerates a concurrent creator by re-reading — two tabs opening at once must
 * not 500.
 */
async function getOrCreatePreferences(
  admin: ReturnType<typeof createSupabaseServiceClient>,
  tenantId: string,
  userId: string,
): Promise<Record<string, unknown> | null> {
  const { data: existing } = await admin
    .from('daily_briefing_preferences')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle();
  if (existing) return existing;

  const { data: created } = await admin
    .from('daily_briefing_preferences')
    .insert({ tenant_id: tenantId, user_id: userId })
    .select()
    .maybeSingle();
  if (created) return created;

  const { data: reread } = await admin
    .from('daily_briefing_preferences')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle();
  return reread ?? null;
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function safeJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
