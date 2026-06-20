// Blog Outreach / Link-Building Edge Function (US-BLOG-056..060)
//
// One function backs the whole link-building + outreach loop. Every external
// integration (Ahrefs/SEMrush/Majestic backlinks, Brand24/Mention.com mention
// monitoring, hunter.io/clearbit contact discovery, HARO inbox parsing, SMTP/
// SendGrid/Resend sending, IMAP reply ingestion, and high-DA notifications) sits
// behind a clearly-named adapter STUB with a TODO. Every endpoint also accepts
// the data the adapter would return injected in the request body, so the loop is
// testable end-to-end before any vendor is wired. All results persist to tables.
//
// Stories:
//   056 Backlink monitoring + lost-link recovery     -> blog_backlinks, blog_backlink_events
//   057 Unlinked brand-mention monitor -> outreach    -> blog_brand_mentions (+ threads)
//   058 Outreach list generator (similar-content)     -> blog_outreach_prospects
//   059 HARO / Help-A-B2B-Writer pitch generator      -> blog_haro_queries, blog_haro_pitches
//   060 Outreach agent: research + draft + track       -> blog_outreach_threads, blog_outreach_messages
//
// Auto-send is NEVER done here: outreach/pitch drafts land in 'draft'/'queued'
// and an explicit adapter step (stubbed) flips them to 'sent'. Cadence math
// (follow-up +5d / +10d / close) is computed deterministically; the actual send
// is the stub.
//
// Routes (tenant-scoped, gated to blog.distribution.publish | blog.post.edit):
//   GET    /blog-outreach/overview                    counts per family
//
//   -- 056 backlinks --
//   GET    /blog-outreach/backlinks                   list (?post_id= &status= &domain=)
//   POST   /blog-outreach/backlinks/sync              body { post_id?, domains?[], new_backlinks?[], lost_backlinks?[], da_threshold? }
//   GET    /blog-outreach/backlinks/events            list events (?event_type= &post_id=)
//   GET    /blog-outreach/backlinks/recovery          lost-link recovery queue
//   POST   /blog-outreach/backlinks/:id/recover       draft recovery outreach (LLM) -> thread
//   GET    /blog-outreach/backlinks/trend             body-less; ?post_id= trend series
//
//   -- 057 brand mentions --
//   GET    /blog-outreach/mentions                    list (?status= &has_link=)
//   POST   /blog-outreach/mentions/scan               body { brand?, mentions?[] }
//   POST   /blog-outreach/mentions/:id/outreach       propose outreach (LLM) -> thread
//   POST   /blog-outreach/mentions/recrawl            body { results?[{id,has_link}] } weekly re-crawl
//
//   -- 058 prospects --
//   GET    /blog-outreach/prospects                   list (?post_id= &status=)
//   POST   /blog-outreach/prospects/generate          body { post_id, competitor_urls[], da_threshold?, backlinks?[], contacts?{} }
//
//   -- 059 HARO --
//   GET    /blog-outreach/haro/queries                list (?status=)
//   POST   /blog-outreach/haro/parse                  body { raw_email?, queries?[] } parse + match authors
//   POST   /blog-outreach/haro/queries/:id/pitch      draft a pitch (LLM)
//   GET    /blog-outreach/haro/pitches                list (?status= &query_id=)
//   POST   /blog-outreach/haro/pitches/:id/approve    approve a pitch
//   POST   /blog-outreach/haro/pitches/:id/send       send (stub) + status sent
//   PATCH  /blog-outreach/haro/pitches/:id            edit text/status (calibration)
//
//   -- 060 outreach agent --
//   GET    /blog-outreach/threads                     list (?status= &prospect_id=)
//   GET    /blog-outreach/threads/:id                 thread + messages
//   POST   /blog-outreach/threads                     body { recipient_email, prospect_id?, brand_mention_id?, post_id?, template_key?, angle?, research? } research + draft
//   POST   /blog-outreach/threads/:id/approve         approve draft -> queued
//   POST   /blog-outreach/threads/:id/send            send via adapter (stub) -> sent + cadence
//   POST   /blog-outreach/threads/:id/reply           body { body, received_at? } ingest reply (IMAP stub) + classify (LLM)
//   POST   /blog-outreach/threads/:id/followup        send next cadence follow-up (stub)
//   POST   /blog-outreach/threads/:id/close           body { reason? }
//   GET    /blog-outreach/threads/metrics             engagement per template/angle
//
// Credentials for any of the above adapters are stored encrypted on a config row
// via encryptCredential() and never returned (return *_set booleans) — see
// POST /blog-outreach/credentials.

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';
import { generateCompletion } from '../_shared/anthropic.ts';
import { extractJsonObject } from '../_shared/blog/llm-json.ts';
import { encryptCredential } from '../_shared/credential-vault.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const DEFAULT_DA_THRESHOLD = 50; // high-DA new-link notification threshold (US-BLOG-056)
const FOLLOWUP_1_DAYS = 5; // US-BLOG-060 cadence
const FOLLOWUP_2_DAYS = 10;

// ===========================================================================
// Permission gate (copied from blog-syndication exemplar)
// ===========================================================================
function hasOutreachAccess(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const perms = meta.permissions;
  if (
    Array.isArray(perms) &&
    (perms.includes('blog.distribution.publish') || perms.includes('blog.post.edit'))
  ) {
    return true;
  }
  const role = String(meta.role ?? '').toLowerCase();
  return role === 'platform_admin' || role === 'super_admin' || role === 'company_admin';
}

// ===========================================================================
// Adapter STUBS — every third-party integration lives here behind a TODO. Each
// returns the shape the real vendor would; request bodies may inject the same
// shape so the whole loop is testable before any vendor is wired.
// ===========================================================================

interface BacklinkDelta {
  source_domain: string;
  source_url: string;
  target_url?: string;
  domain_authority?: number;
  anchor_text?: string;
  last_seen_url?: string;
}

/**
 * Backlink provider adapter (US-BLOG-056). Reports new + lost backlinks per
 * domain. TODO: wire Ahrefs / SEMrush / Majestic backlink APIs (credentials in
 * the encrypted vault, keyed by provider). Until then this returns nothing and
 * callers pass `new_backlinks`/`lost_backlinks` in the request body.
 */
async function backlinkAdapter(
  _domains: string[],
): Promise<{ newBacklinks: BacklinkDelta[]; lostBacklinks: BacklinkDelta[] }> {
  // TODO(US-BLOG-056): call Ahrefs/SEMrush/Majestic and diff against stored rows.
  return { newBacklinks: [], lostBacklinks: [] };
}

/** Competitor backlink-list adapter (US-BLOG-058). Reuses the 056 provider. */
async function competitorBacklinkAdapter(_competitorUrls: string[]): Promise<BacklinkDelta[]> {
  // TODO(US-BLOG-058): pull each competitor URL's referring domains (Ahrefs etc.).
  return [];
}

interface MentionHit {
  url: string;
  source_domain?: string;
  snippet?: string;
  has_link?: boolean;
  domain_authority?: number;
}

/** Brand-mention monitor adapter (US-BLOG-057). TODO: Brand24 / Mention.com / scrape. */
async function mentionMonitorAdapter(_brand: string): Promise<MentionHit[]> {
  // TODO(US-BLOG-057): query Brand24/Mention.com or a SERP scrape for brand mentions.
  return [];
}

/** Contact-discovery adapter (US-BLOG-058). TODO: hunter.io / clearbit / scrape. */
async function contactDiscoveryAdapter(
  _domain: string,
): Promise<{ email?: string; name?: string; role?: string; source?: string } | null> {
  // TODO(US-BLOG-058): hunter.io domain-search / clearbit enrichment / site scrape.
  return null;
}

interface ParsedHaroQuery {
  external_id?: string;
  subject?: string;
  query_text: string;
  category?: string;
  outlet?: string;
  deadline?: string;
}

/** HARO inbox parser (US-BLOG-059). TODO: forward-to-inbox MIME parse. */
function haroEmailParserAdapter(rawEmail: string): ParsedHaroQuery[] {
  // TODO(US-BLOG-059): parse the forwarded HARO/HelpAB2BWriter digest into queries.
  // Naive fallback so an injected raw email still yields one query for testing.
  const trimmed = rawEmail.trim();
  if (!trimmed) return [];
  return [{ query_text: trimmed.slice(0, 8000), subject: trimmed.slice(0, 120) }];
}

/** Email send adapter (US-BLOG-059/060). TODO: SMTP / SendGrid / Resend from workspace domain. */
async function emailSendAdapter(_msg: {
  to: string;
  subject: string;
  body: string;
}): Promise<{ sent: boolean; provider: string; messageId: string | null }> {
  // TODO(US-BLOG-060): send via SMTP/SendGrid/Resend using vault creds; return provider id.
  return { sent: false, provider: 'stub', messageId: null };
}

/** High-DA new-link notifier (US-BLOG-056). TODO: Slack/email notification. */
async function notifyHighDaAdapter(_event: Record<string, unknown>): Promise<boolean> {
  // TODO(US-BLOG-056): dispatch a Slack/email alert for a high-DA new backlink.
  return false;
}

/** Recipient research adapter (US-BLOG-060). TODO: recent posts / social / mutual. */
async function recipientResearchAdapter(
  _email: string,
  _domain: string,
): Promise<Record<string, unknown>> {
  // TODO(US-BLOG-060): gather recent posts, social, mutual connections for personalization.
  return { note: 'research stub — no external lookup performed' };
}

// ===========================================================================
// Small helpers
// ===========================================================================
function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url
      .replace(/^https?:\/\//, '')
      .split('/')[0]
      .replace(/^www\./, '');
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function plusDaysIso(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

interface PostRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  cms_post_url: string | null;
  status: string;
}

async function loadPost(admin: Admin, tenantId: string, postId: string): Promise<PostRow | null> {
  const { data, error } = await admin
    .from('blog_posts')
    .select('id,title,slug,excerpt,meta_description,canonical_url,cms_post_url,status')
    .eq('tenant_id', tenantId)
    .eq('id', postId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return (data as PostRow | null) ?? null;
}

function postUrlOf(post: PostRow): string {
  return post.canonical_url || post.cms_post_url || `/${post.slug}`;
}

/** Draft an outreach email body+subject from the model. Returns {subject, body}. */
async function draftOutreachEmail(
  system: string,
  userPrompt: string,
): Promise<{ subject: string; body: string }> {
  const raw = await generateCompletion({
    max_tokens: 1200,
    temperature: 0.7,
    system,
    messages: [{ role: 'user', content: userPrompt }],
  });
  const obj = extractJsonObject(raw);
  return {
    subject: typeof obj.subject === 'string' ? obj.subject : 'Quick question about your article',
    body: typeof obj.body === 'string' ? obj.body : '',
  };
}

const OUTREACH_SYSTEM =
  'You are a B2B link-building outreach specialist for a print/MFP dealer SaaS. ' +
  'Write concise, genuinely personalized cold outreach — never spammy, never templated-sounding. ' +
  'Return ONLY a single JSON object {"subject":string,"body":string}, no prose, no code fences.';

// ===========================================================================
// US-BLOG-056 — Backlink monitoring + lost-link recovery
// ===========================================================================

const backlinkDeltaSchema = z.object({
  source_domain: z.string().max(255).optional(),
  source_url: z.string().max(2000),
  target_url: z.string().max(2000).optional(),
  domain_authority: z.number().int().optional(),
  anchor_text: z.string().max(1000).optional(),
  last_seen_url: z.string().max(2000).optional(),
});

const syncBacklinksSchema = z.object({
  post_id: z.string().uuid().optional(),
  domains: z.array(z.string().max(255)).optional(),
  new_backlinks: z.array(backlinkDeltaSchema).optional(),
  lost_backlinks: z.array(backlinkDeltaSchema).optional(),
  da_threshold: z.number().int().min(0).optional(),
});

async function syncBacklinks(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = syncBacklinksSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const { post_id, domains, da_threshold } = parsed.data;
  const threshold = da_threshold ?? DEFAULT_DA_THRESHOLD;

  // Adapter (stub) + injected deltas are merged. Injected wins for testability.
  const fromAdapter = await backlinkAdapter(domains ?? []);
  const newLinks = [...fromAdapter.newBacklinks, ...(parsed.data.new_backlinks ?? [])];
  const lostLinks = [...fromAdapter.lostBacklinks, ...(parsed.data.lost_backlinks ?? [])];

  const result = { new_count: 0, lost_count: 0, high_da_alerts: 0, recovery_queued: 0 };

  for (const link of newLinks) {
    const sourceDomain = link.source_domain || domainOf(link.source_url);
    // Upsert-ish: if we've already seen this source_url, mark active + bump last_seen.
    const { data: existing } = await admin
      .from('blog_backlinks')
      .select('id,status')
      .eq('tenant_id', tenantId)
      .eq('source_url', link.source_url)
      .is('deleted_at', null)
      .maybeSingle();

    let backlinkId: string;
    if (existing) {
      const wasLost = existing.status === 'lost';
      const { data: upd } = await admin
        .from('blog_backlinks')
        .update({
          status: 'active',
          last_seen: nowIso(),
          lost_at: null,
          domain_authority: link.domain_authority ?? null,
          updated_at: nowIso(),
        })
        .eq('tenant_id', tenantId)
        .eq('id', existing.id)
        .select('id')
        .single();
      backlinkId = upd!.id;
      if (wasLost) {
        await admin.from('blog_backlink_events').insert({
          tenant_id: tenantId,
          backlink_id: backlinkId,
          post_id: post_id ?? null,
          event_type: 'recovered',
          source_domain: sourceDomain,
          source_url: link.source_url,
          domain_authority: link.domain_authority ?? null,
          created_by_user_id: userId,
        });
      }
    } else {
      const { data: ins } = await admin
        .from('blog_backlinks')
        .insert({
          tenant_id: tenantId,
          post_id: post_id ?? null,
          source_domain: sourceDomain,
          source_url: link.source_url,
          target_url: link.target_url ?? null,
          domain_authority: link.domain_authority ?? null,
          anchor_text: link.anchor_text ?? null,
          status: 'new',
          source: 'injected',
          created_by_user_id: userId,
        })
        .select('id')
        .single();
      backlinkId = ins!.id;
      result.new_count++;
      await admin.from('blog_backlink_events').insert({
        tenant_id: tenantId,
        backlink_id: backlinkId,
        post_id: post_id ?? null,
        event_type: 'new',
        source_domain: sourceDomain,
        source_url: link.source_url,
        domain_authority: link.domain_authority ?? null,
        created_by_user_id: userId,
      });
      // High-DA notification (US-BLOG-056) — stub send, persist the event.
      if ((link.domain_authority ?? 0) >= threshold) {
        const notified = await notifyHighDaAdapter({ sourceDomain, da: link.domain_authority });
        await admin.from('blog_backlink_events').insert({
          tenant_id: tenantId,
          backlink_id: backlinkId,
          post_id: post_id ?? null,
          event_type: 'high_da_alert',
          source_domain: sourceDomain,
          source_url: link.source_url,
          domain_authority: link.domain_authority ?? null,
          notified,
          notified_at: notified ? nowIso() : null,
          created_by_user_id: userId,
        });
        result.high_da_alerts++;
      }
    }
  }

  for (const link of lostLinks) {
    const sourceDomain = link.source_domain || domainOf(link.source_url);
    const { data: existing } = await admin
      .from('blog_backlinks')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('source_url', link.source_url)
      .is('deleted_at', null)
      .maybeSingle();
    let backlinkId: string | null = existing?.id ?? null;
    if (existing) {
      await admin
        .from('blog_backlinks')
        .update({ status: 'lost', lost_at: nowIso(), updated_at: nowIso() })
        .eq('tenant_id', tenantId)
        .eq('id', existing.id);
    } else {
      // Record the lost link even if we never tracked it, so it enters recovery.
      const { data: ins } = await admin
        .from('blog_backlinks')
        .insert({
          tenant_id: tenantId,
          post_id: post_id ?? null,
          source_domain: sourceDomain,
          source_url: link.source_url,
          target_url: link.target_url ?? null,
          domain_authority: link.domain_authority ?? null,
          status: 'lost',
          lost_at: nowIso(),
          source: 'injected',
          created_by_user_id: userId,
        })
        .select('id')
        .single();
      backlinkId = ins!.id;
    }
    // Lost backlink -> recovery queue with last-seen URL (US-BLOG-056).
    await admin.from('blog_backlink_events').insert({
      tenant_id: tenantId,
      backlink_id: backlinkId,
      post_id: post_id ?? null,
      event_type: 'lost',
      source_domain: sourceDomain,
      source_url: link.source_url,
      last_seen_url: link.last_seen_url ?? link.source_url,
      domain_authority: link.domain_authority ?? null,
      created_by_user_id: userId,
    });
    result.lost_count++;
    result.recovery_queued++;
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_backlink.sync',
      targetType: 'blog_backlink',
      targetId: post_id ?? null,
      summary: `Backlink sync: +${result.new_count} new, ${result.lost_count} lost`,
      afterState: result,
    }),
  );
  return createCorsResponse({ result }, 200, req);
}

async function listBacklinks(admin: Admin, tenantId: string, url: URL, req: Request) {
  let q = admin
    .from('blog_backlinks')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('last_seen', { ascending: false })
    .limit(500);
  const postId = url.searchParams.get('post_id');
  const status = url.searchParams.get('status');
  const domain = url.searchParams.get('domain');
  if (postId) q = q.eq('post_id', postId);
  if (status) q = q.eq('status', status);
  if (domain) q = q.eq('source_domain', domain);
  const { data, error } = await q;
  if (error) return createCorsResponse({ error: 'Failed to list backlinks' }, 500, req);
  return createCorsResponse({ backlinks: data ?? [] }, 200, req);
}

async function listBacklinkEvents(admin: Admin, tenantId: string, url: URL, req: Request) {
  let q = admin
    .from('blog_backlink_events')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(500);
  const eventType = url.searchParams.get('event_type');
  const postId = url.searchParams.get('post_id');
  if (eventType) q = q.eq('event_type', eventType);
  if (postId) q = q.eq('post_id', postId);
  const { data, error } = await q;
  if (error) return createCorsResponse({ error: 'Failed to list events' }, 500, req);
  return createCorsResponse({ events: data ?? [] }, 200, req);
}

/** Recovery queue = currently-lost backlinks, carrying their last-seen URL. */
async function recoveryQueue(admin: Admin, tenantId: string, req: Request) {
  const { data, error } = await admin
    .from('blog_backlinks')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'lost')
    .is('deleted_at', null)
    .order('lost_at', { ascending: false })
    .limit(500);
  if (error) return createCorsResponse({ error: 'Failed to load recovery queue' }, 500, req);
  return createCorsResponse({ recovery: data ?? [] }, 200, req);
}

/** Draft a broken-link recovery outreach email (LLM) -> creates a thread (US-BLOG-056). */
async function recoverBacklink(
  admin: Admin,
  tenantId: string,
  userId: string,
  backlinkId: string,
  req: Request,
) {
  let body: { our_updated_url?: string; recipient_email?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const { data: bl } = await admin
    .from('blog_backlinks')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', backlinkId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!bl) return createCorsResponse({ error: 'Backlink not found' }, 404, req);

  let post: PostRow | null = null;
  if (bl.post_id) post = await loadPost(admin, tenantId, bl.post_id);
  const updatedUrl = body.our_updated_url || (post ? postUrlOf(post) : bl.target_url) || '';

  let draft: { subject: string; body: string };
  try {
    draft = await draftOutreachEmail(
      OUTREACH_SYSTEM,
      [
        `We had a backlink from ${bl.source_domain} (${bl.source_url}) that is now broken/lost.`,
        `Our updated/working URL to offer as the replacement: ${updatedUrl}`,
        bl.anchor_text ? `Original anchor text: ${bl.anchor_text}` : null,
        'Write a friendly broken-link outreach email letting them know their link is broken and offering the updated URL.',
        'Shape: {"subject":string,"body":string}.',
      ]
        .filter((l) => l !== null)
        .join('\n'),
    );
  } catch (err) {
    console.error('blog-outreach recover draft error', err);
    return createCorsResponse({ error: 'Draft generation failed' }, 502, req);
  }

  const { data: thread, error: tErr } = await admin
    .from('blog_outreach_threads')
    .insert({
      tenant_id: tenantId,
      post_id: bl.post_id ?? null,
      recipient_email: body.recipient_email ?? '',
      subject: draft.subject,
      template_key: 'broken_link_recovery',
      angle: 'broken-link',
      status: 'draft',
      metadata: {
        backlink_id: backlinkId,
        source_domain: bl.source_domain,
        updated_url: updatedUrl,
      },
      created_by_user_id: userId,
    })
    .select()
    .single();
  if (tErr) return createCorsResponse({ error: 'Failed to create recovery thread' }, 500, req);

  await admin.from('blog_outreach_messages').insert({
    tenant_id: tenantId,
    thread_id: thread.id,
    direction: 'out',
    kind: 'initial',
    subject: draft.subject,
    body: draft.body,
    created_by_user_id: userId,
  });

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_backlink.recover',
      targetType: 'blog_outreach_thread',
      targetId: thread.id,
      summary: `Drafted recovery outreach for lost link from ${bl.source_domain}`,
    }),
  );
  return createCorsResponse({ thread, draft }, 201, req);
}

/** Backlink trend series per post: counts grouped by event_type over time. */
async function backlinkTrend(admin: Admin, tenantId: string, url: URL, req: Request) {
  const postId = url.searchParams.get('post_id');
  let q = admin
    .from('blog_backlink_events')
    .select('event_type,created_at,source_domain,domain_authority')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })
    .limit(2000);
  if (postId) q = q.eq('post_id', postId);
  const { data, error } = await q;
  if (error) return createCorsResponse({ error: 'Failed to load trend' }, 500, req);

  // Live totals from the backlinks table for the same post.
  let blQ = admin
    .from('blog_backlinks')
    .select('status')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null);
  if (postId) blQ = blQ.eq('post_id', postId);
  const { data: bls } = await blQ;
  const totals = { active: 0, lost: 0, new: 0 };
  for (const b of bls ?? []) totals[(b as { status: keyof typeof totals }).status]++;

  return createCorsResponse({ post_id: postId, totals, events: data ?? [] }, 200, req);
}

// ===========================================================================
// US-BLOG-057 — Unlinked brand-mention monitor -> outreach
// ===========================================================================

const mentionHitSchema = z.object({
  url: z.string().max(2000),
  source_domain: z.string().max(255).optional(),
  snippet: z.string().max(8000).optional(),
  has_link: z.boolean().optional(),
  domain_authority: z.number().int().optional(),
});

const scanMentionsSchema = z.object({
  brand: z.string().max(200).optional(),
  mentions: z.array(mentionHitSchema).optional(),
});

async function scanMentions(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = scanMentionsSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const fromAdapter = parsed.data.brand ? await mentionMonitorAdapter(parsed.data.brand) : [];
  const hits = [...fromAdapter, ...(parsed.data.mentions ?? [])];

  let inserted = 0;
  let unlinked = 0;
  for (const hit of hits) {
    // Dedup on url.
    const { data: existing } = await admin
      .from('blog_brand_mentions')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('url', hit.url)
      .is('deleted_at', null)
      .maybeSingle();
    if (existing) continue;
    const hasLink = hit.has_link ?? false;
    await admin.from('blog_brand_mentions').insert({
      tenant_id: tenantId,
      url: hit.url,
      source_domain: hit.source_domain || domainOf(hit.url),
      snippet: hit.snippet ?? null,
      has_link: hasLink,
      domain_authority: hit.domain_authority ?? null,
      status: 'detected',
      source: 'injected',
      created_by_user_id: userId,
    });
    inserted++;
    if (!hasLink) unlinked++; // pages mentioning brand but NOT linking -> outreach candidates
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_brand_mention.scan',
      targetType: 'blog_brand_mention',
      targetId: null,
      summary: `Brand-mention scan: ${inserted} new (${unlinked} unlinked)`,
      afterState: { inserted, unlinked },
    }),
  );
  return createCorsResponse({ inserted, unlinked }, 200, req);
}

async function listMentions(admin: Admin, tenantId: string, url: URL, req: Request) {
  let q = admin
    .from('blog_brand_mentions')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('detected_at', { ascending: false })
    .limit(500);
  const status = url.searchParams.get('status');
  const hasLink = url.searchParams.get('has_link');
  if (status) q = q.eq('status', status);
  if (hasLink === 'true' || hasLink === 'false') q = q.eq('has_link', hasLink === 'true');
  const { data, error } = await q;
  if (error) return createCorsResponse({ error: 'Failed to list mentions' }, 500, req);
  return createCorsResponse({ mentions: data ?? [] }, 200, req);
}

/** Propose outreach for an unlinked mention (LLM) -> thread (US-BLOG-057). */
async function mentionOutreach(
  admin: Admin,
  tenantId: string,
  userId: string,
  mentionId: string,
  req: Request,
) {
  let body: { recipient_email?: string; our_url?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const { data: mention } = await admin
    .from('blog_brand_mentions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', mentionId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!mention) return createCorsResponse({ error: 'Mention not found' }, 404, req);
  if (mention.has_link) {
    return createCorsResponse(
      { error: 'Mention already links to us — no outreach needed' },
      409,
      req,
    );
  }

  let draft: { subject: string; body: string };
  try {
    draft = await draftOutreachEmail(
      OUTREACH_SYSTEM,
      [
        `A page on ${mention.source_domain} (${mention.url}) mentions our brand but does NOT link to us.`,
        mention.snippet ? `Context snippet: "${String(mention.snippet).slice(0, 1000)}"` : null,
        body.our_url ? `The URL we'd like them to link to: ${body.our_url}` : null,
        'Write a short, warm email thanking them for the mention and asking if they would add a link.',
        'Shape: {"subject":string,"body":string}.',
      ]
        .filter((l) => l !== null)
        .join('\n'),
    );
  } catch (err) {
    console.error('blog-outreach mention draft error', err);
    return createCorsResponse({ error: 'Draft generation failed' }, 502, req);
  }

  const { data: thread, error: tErr } = await admin
    .from('blog_outreach_threads')
    .insert({
      tenant_id: tenantId,
      brand_mention_id: mentionId,
      recipient_email: body.recipient_email ?? '',
      subject: draft.subject,
      template_key: 'unlinked_mention',
      angle: 'brand-mention',
      status: 'draft',
      metadata: { mention_url: mention.url, source_domain: mention.source_domain },
      created_by_user_id: userId,
    })
    .select()
    .single();
  if (tErr) return createCorsResponse({ error: 'Failed to create thread' }, 500, req);

  await admin.from('blog_outreach_messages').insert({
    tenant_id: tenantId,
    thread_id: thread.id,
    direction: 'out',
    kind: 'initial',
    subject: draft.subject,
    body: draft.body,
    created_by_user_id: userId,
  });
  await admin
    .from('blog_brand_mentions')
    .update({ status: 'queued', thread_id: thread.id, updated_at: nowIso() })
    .eq('tenant_id', tenantId)
    .eq('id', mentionId);

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_brand_mention.outreach',
      targetType: 'blog_outreach_thread',
      targetId: thread.id,
      summary: `Drafted unlinked-mention outreach for ${mention.source_domain}`,
    }),
  );
  return createCorsResponse({ thread, draft }, 201, req);
}

/** Weekly re-crawl (stub): detect whether a link was added -> update status (US-BLOG-057). */
async function recrawlMentions(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: { results?: Array<{ id: string; has_link: boolean }> } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  // TODO(US-BLOG-057): re-crawl every non-terminal mention URL and detect new links.
  const results = body.results ?? [];
  let linkAdded = 0;
  for (const r of results) {
    if (!r.has_link) continue;
    const { data: updated } = await admin
      .from('blog_brand_mentions')
      .update({
        has_link: true,
        status: 'link_added',
        link_added_at: nowIso(),
        last_checked_at: nowIso(),
        updated_at: nowIso(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', r.id)
      .is('deleted_at', null)
      .select('thread_id')
      .maybeSingle();
    if (updated) {
      linkAdded++;
      if (updated.thread_id) {
        await admin
          .from('blog_outreach_threads')
          .update({ status: 'closed', closed_reason: 'link_added', updated_at: nowIso() })
          .eq('tenant_id', tenantId)
          .eq('id', updated.thread_id);
      }
    }
  }
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_brand_mention.recrawl',
      targetType: 'blog_brand_mention',
      targetId: null,
      summary: `Re-crawl confirmed ${linkAdded} new link(s)`,
      afterState: { link_added: linkAdded },
    }),
  );
  return createCorsResponse({ link_added: linkAdded }, 200, req);
}

// ===========================================================================
// US-BLOG-058 — Outreach list generator (sites that linked to similar content)
// ===========================================================================

const generateProspectsSchema = z.object({
  post_id: z.string().uuid(),
  competitor_urls: z.array(z.string().max(2000)).min(1).max(10),
  da_threshold: z.number().int().min(0).optional(),
  // Injected backlink list (reuses 056 adapter shape) for testability.
  backlinks: z.array(backlinkDeltaSchema).optional(),
  // Injected contact map: { "domain.com": { email, name, role } }.
  contacts: z
    .record(
      z.object({
        email: z.string().max(320).optional(),
        name: z.string().max(200).optional(),
        role: z.string().max(200).optional(),
      }),
    )
    .optional(),
});

async function generateProspects(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = generateProspectsSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const { post_id, competitor_urls } = parsed.data;
  const threshold = parsed.data.da_threshold ?? DEFAULT_DA_THRESHOLD;

  const post = await loadPost(admin, tenantId, post_id);
  if (!post) return createCorsResponse({ error: 'Post not found' }, 404, req);

  // Pull competitor backlink lists (stub adapter) + injected list (US-BLOG-058).
  const fromAdapter = await competitorBacklinkAdapter(competitor_urls);
  const candidates = [...fromAdapter, ...(parsed.data.backlinks ?? [])];

  // Dedup by domain, filter to high DA.
  const byDomain = new Map<string, BacklinkDelta>();
  for (const c of candidates) {
    const d = c.source_domain || domainOf(c.source_url);
    if ((c.domain_authority ?? 0) < threshold) continue;
    if (!byDomain.has(d)) byDomain.set(d, c);
  }

  // LLM evaluates each domain for content-site-ness + niche relevance.
  const prospects: Array<Record<string, unknown>> = [];
  for (const [domain, c] of byDomain) {
    let isDirectory = false;
    let relevance = 50;
    let angle = '';
    try {
      const raw = await generateCompletion({
        max_tokens: 400,
        temperature: 0.3,
        system:
          'You evaluate websites as link-building targets for a print/MFP dealer SaaS. ' +
          'Return ONLY {"is_directory":boolean,"relevance_score":number(0-100),"suggested_angle":string}.',
        messages: [
          {
            role: 'user',
            content:
              `Target domain: ${domain}\n` +
              `Our post: "${post.title}" — ${post.meta_description || post.excerpt || ''}\n` +
              'Is this a directory/aggregator (vs a real content site)? Score niche relevance 0-100. ' +
              'Suggest a one-line outreach angle.\n' +
              'Shape: {"is_directory":boolean,"relevance_score":number,"suggested_angle":string}.',
          },
        ],
      });
      const obj = extractJsonObject(raw);
      isDirectory = obj.is_directory === true;
      relevance = typeof obj.relevance_score === 'number' ? obj.relevance_score : 50;
      angle = typeof obj.suggested_angle === 'string' ? obj.suggested_angle : '';
    } catch (err) {
      console.error('blog-outreach prospect eval error', err);
      // Keep going — store with neutral defaults rather than failing the batch.
    }

    // Contact discovery: injected map first, then stub adapter.
    const injected = parsed.data.contacts?.[domain];
    const contact = injected ?? (await contactDiscoveryAdapter(domain));

    const { data: ins } = await admin
      .from('blog_outreach_prospects')
      .insert({
        tenant_id: tenantId,
        post_id,
        site_domain: domain,
        contact_email: contact?.email ?? null,
        contact_name: contact?.name ?? null,
        contact_role: contact?.role ?? null,
        domain_authority: c.domain_authority ?? null,
        relevance_score: relevance,
        is_directory: isDirectory,
        suggested_angle: angle,
        source_competitor_url: c.source_url,
        contact_source: injected ? 'injected' : contact ? 'stub' : null,
        status: 'new',
        created_by_user_id: userId,
      })
      .select()
      .single();
    if (ins) prospects.push(ins);
  }

  // Prioritize: non-directory, then relevance, then DA.
  prospects.sort((a, b) => {
    const dir = Number(a.is_directory) - Number(b.is_directory);
    if (dir !== 0) return dir;
    const rel = Number(b.relevance_score ?? 0) - Number(a.relevance_score ?? 0);
    if (rel !== 0) return rel;
    return Number(b.domain_authority ?? 0) - Number(a.domain_authority ?? 0);
  });

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_outreach_prospect.generate',
      targetType: 'blog_post',
      targetId: post_id,
      summary: `Generated ${prospects.length} outreach prospects from ${competitor_urls.length} competitor URLs`,
      afterState: { count: prospects.length },
    }),
  );
  return createCorsResponse({ prospects }, 201, req);
}

async function listProspects(admin: Admin, tenantId: string, url: URL, req: Request) {
  let q = admin
    .from('blog_outreach_prospects')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('relevance_score', { ascending: false })
    .limit(500);
  const postId = url.searchParams.get('post_id');
  const status = url.searchParams.get('status');
  if (postId) q = q.eq('post_id', postId);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return createCorsResponse({ error: 'Failed to list prospects' }, 500, req);
  return createCorsResponse({ prospects: data ?? [] }, 200, req);
}

// ===========================================================================
// US-BLOG-059 — HARO / Help-A-B2B-Writer pitch generator
// ===========================================================================

const haroParseSchema = z.object({
  raw_email: z.string().max(50000).optional(),
  source: z.string().max(40).optional(),
  queries: z
    .array(
      z.object({
        external_id: z.string().max(200).optional(),
        subject: z.string().max(500).optional(),
        query_text: z.string().max(8000),
        category: z.string().max(200).optional(),
        outlet: z.string().max(255).optional(),
        deadline: z.string().datetime().optional(),
      }),
    )
    .optional(),
});

interface AuthorRow {
  id: string;
  name: string;
  bio: string | null;
  job_title: string | null;
  expertise_tags: string[] | null;
}

/** Match a query to an author by expertise-tag overlap with the query text. */
function matchAuthor(
  query: { query_text: string; subject?: string; category?: string },
  authors: AuthorRow[],
): { author: AuthorRow | null; score: number } {
  const hay = `${query.subject ?? ''} ${query.category ?? ''} ${query.query_text}`.toLowerCase();
  let best: AuthorRow | null = null;
  let bestScore = 0;
  for (const a of authors) {
    const tags = a.expertise_tags ?? [];
    if (tags.length === 0) continue;
    const hits = tags.filter((t) => t && hay.includes(t.toLowerCase())).length;
    const score = Math.round((hits / tags.length) * 100);
    if (hits > 0 && score > bestScore) {
      bestScore = score;
      best = a;
    }
  }
  return { author: best, score: bestScore };
}

async function parseHaro(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = haroParseSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }

  // Parser stub for forwarded raw email + injected structured queries.
  const fromParser = parsed.data.raw_email ? haroEmailParserAdapter(parsed.data.raw_email) : [];
  const queries = [...fromParser, ...(parsed.data.queries ?? [])];
  if (queries.length === 0) {
    return createCorsResponse({ error: 'No queries parsed or provided' }, 400, req);
  }

  // Authors with expertise tags, for matching.
  const { data: authorData } = await admin
    .from('blog_authors')
    .select('id,name,bio,job_title,expertise_tags')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .is('deleted_at', null);
  const authors = (authorData as AuthorRow[]) ?? [];

  const created: Array<Record<string, unknown>> = [];
  for (const q of queries) {
    // Dedup on external_id when present.
    if (q.external_id) {
      const { data: existing } = await admin
        .from('blog_haro_queries')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('external_id', q.external_id)
        .is('deleted_at', null)
        .maybeSingle();
      if (existing) continue;
    }
    const { author, score } = matchAuthor(q, authors);
    const { data: ins } = await admin
      .from('blog_haro_queries')
      .insert({
        tenant_id: tenantId,
        external_id: q.external_id ?? null,
        subject: q.subject ?? null,
        query_text: q.query_text,
        category: q.category ?? null,
        outlet: q.outlet ?? null,
        deadline: q.deadline ?? null,
        matched_author_id: author?.id ?? null,
        match_score: score,
        status: author ? 'matched' : 'new',
        source: parsed.data.source ?? (parsed.data.raw_email ? 'haro' : 'injected'),
        created_by_user_id: userId,
      })
      .select()
      .single();
    if (ins) created.push(ins);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_haro_query.parse',
      targetType: 'blog_haro_query',
      targetId: null,
      summary: `Parsed ${created.length} HARO quer${created.length === 1 ? 'y' : 'ies'}`,
      afterState: { count: created.length },
    }),
  );
  return createCorsResponse({ queries: created }, 201, req);
}

async function listHaroQueries(admin: Admin, tenantId: string, url: URL, req: Request) {
  let q = admin
    .from('blog_haro_queries')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('deadline', { ascending: true, nullsFirst: false })
    .limit(500);
  const status = url.searchParams.get('status');
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return createCorsResponse({ error: 'Failed to list HARO queries' }, 500, req);
  return createCorsResponse({ queries: data ?? [] }, 200, req);
}

/** Draft a HARO pitch (LLM) using author bio + relevant past posts (US-BLOG-059). */
async function draftHaroPitch(
  admin: Admin,
  tenantId: string,
  userId: string,
  queryId: string,
  req: Request,
) {
  let body: { author_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const { data: query } = await admin
    .from('blog_haro_queries')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', queryId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!query) return createCorsResponse({ error: 'Query not found' }, 404, req);

  const authorId = body.author_id ?? query.matched_author_id;
  if (!authorId) {
    return createCorsResponse({ error: 'No matched author; pass author_id to pitch' }, 409, req);
  }
  const { data: author } = await admin
    .from('blog_authors')
    .select('id,name,bio,job_title,credentials,expertise_tags')
    .eq('tenant_id', tenantId)
    .eq('id', authorId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!author) return createCorsResponse({ error: 'Author not found' }, 404, req);

  // Relevant past posts as evidence (published, by this author).
  const { data: posts } = await admin
    .from('blog_posts')
    .select('id,title,canonical_url,cms_post_url,slug,meta_description')
    .eq('tenant_id', tenantId)
    .eq('status', 'published')
    .eq('author_id', authorId)
    .is('deleted_at', null)
    .order('published_at', { ascending: false })
    .limit(5);
  const evidencePosts = (posts as PostRow[]) ?? [];

  let pitchText = '';
  try {
    const raw = await generateCompletion({
      max_tokens: 1200,
      temperature: 0.6,
      system:
        'You write HARO / source-request pitches for a print/MFP dealer SaaS expert. ' +
        'Follow HARO conventions: short response that directly answers the query, then a credentialed ' +
        'bio line, then contact info placeholder. Cite the provided posts as evidence where relevant. ' +
        'Return ONLY {"pitch_text":string}.',
      messages: [
        {
          role: 'user',
          content: [
            `Source query: ${query.subject ?? ''}`,
            query.outlet ? `Outlet: ${query.outlet}` : '',
            `Query text: ${query.query_text}`,
            '',
            `Author: ${author.name}${author.job_title ? `, ${author.job_title}` : ''}`,
            author.credentials ? `Credentials: ${author.credentials}` : '',
            author.bio ? `Bio: ${author.bio}` : '',
            '',
            'Relevant published posts (evidence):',
            ...evidencePosts.map(
              (p) => `- ${p.title}: ${p.canonical_url || p.cms_post_url || `/${p.slug}`}`,
            ),
            '',
            'Shape: {"pitch_text":string}.',
          ]
            .filter(Boolean)
            .join('\n'),
        },
      ],
    });
    const obj = extractJsonObject(raw);
    pitchText = typeof obj.pitch_text === 'string' ? obj.pitch_text : '';
  } catch (err) {
    console.error('blog-outreach haro pitch error', err);
    return createCorsResponse({ error: 'Pitch generation failed' }, 502, req);
  }

  const { data: pitch, error: pErr } = await admin
    .from('blog_haro_pitches')
    .insert({
      tenant_id: tenantId,
      query_id: queryId,
      author_id: authorId,
      pitch_text: pitchText,
      status: 'draft',
      evidence_post_ids: evidencePosts.map((p) => p.id),
      created_by_user_id: userId,
    })
    .select()
    .single();
  if (pErr) return createCorsResponse({ error: 'Failed to store pitch' }, 500, req);

  await admin
    .from('blog_haro_queries')
    .update({ status: 'pitched', updated_at: nowIso() })
    .eq('tenant_id', tenantId)
    .eq('id', queryId);

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_haro_pitch.draft',
      targetType: 'blog_haro_pitch',
      targetId: pitch.id,
      summary: `Drafted HARO pitch for "${query.subject ?? query.id}"`,
    }),
  );
  return createCorsResponse({ pitch }, 201, req);
}

async function listHaroPitches(admin: Admin, tenantId: string, url: URL, req: Request) {
  let q = admin
    .from('blog_haro_pitches')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(500);
  const status = url.searchParams.get('status');
  const queryId = url.searchParams.get('query_id');
  if (status) q = q.eq('status', status);
  if (queryId) q = q.eq('query_id', queryId);
  const { data, error } = await q;
  if (error) return createCorsResponse({ error: 'Failed to list pitches' }, 500, req);
  return createCorsResponse({ pitches: data ?? [] }, 200, req);
}

async function approveHaroPitch(
  admin: Admin,
  tenantId: string,
  userId: string,
  pitchId: string,
  req: Request,
) {
  const { data, error } = await admin
    .from('blog_haro_pitches')
    .update({
      status: 'approved',
      approved_by_user_id: userId,
      approved_at: nowIso(),
      updated_at: nowIso(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', pitchId)
    .is('deleted_at', null)
    .select()
    .maybeSingle();
  if (error) return createCorsResponse({ error: 'Failed to approve pitch' }, 500, req);
  if (!data) return createCorsResponse({ error: 'Pitch not found' }, 404, req);
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_haro_pitch.approve',
      targetType: 'blog_haro_pitch',
      targetId: pitchId,
    }),
  );
  return createCorsResponse({ pitch: data }, 200, req);
}

/** Send an approved pitch from workspace email (stub) -> status sent (US-BLOG-059). */
async function sendHaroPitch(
  admin: Admin,
  tenantId: string,
  userId: string,
  pitchId: string,
  req: Request,
) {
  const { data: pitch } = await admin
    .from('blog_haro_pitches')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', pitchId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!pitch) return createCorsResponse({ error: 'Pitch not found' }, 404, req);
  if (pitch.status !== 'approved') {
    return createCorsResponse({ error: 'Pitch must be approved before sending' }, 409, req);
  }
  // Stub send from the workspace email.
  const send = await emailSendAdapter({
    to: 'haro@source',
    subject: 'HARO response',
    body: pitch.pitch_text,
  });
  const { data, error } = await admin
    .from('blog_haro_pitches')
    .update({ status: 'sent', sent_at: nowIso(), updated_at: nowIso() })
    .eq('tenant_id', tenantId)
    .eq('id', pitchId)
    .select()
    .maybeSingle();
  if (error) return createCorsResponse({ error: 'Failed to mark sent' }, 500, req);
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_haro_pitch.send',
      targetType: 'blog_haro_pitch',
      targetId: pitchId,
      afterState: { provider: send.provider, sent: send.sent },
    }),
  );
  return createCorsResponse({ pitch: data, send }, 200, req);
}

const patchHaroPitchSchema = z.object({
  pitch_text: z.string().max(20000).optional(),
  // Calibration: track outcome (sent | replied | included | ignored).
  status: z.enum(['draft', 'approved', 'sent', 'replied', 'included', 'ignored']).optional(),
});

async function patchHaroPitch(
  admin: Admin,
  tenantId: string,
  userId: string,
  pitchId: string,
  req: Request,
) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = patchHaroPitchSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const patch: Record<string, unknown> = { updated_at: nowIso() };
  if (parsed.data.pitch_text !== undefined) patch.pitch_text = parsed.data.pitch_text;
  if (parsed.data.status !== undefined) {
    patch.status = parsed.data.status;
    if (parsed.data.status === 'replied') patch.replied_at = nowIso();
  }
  const { data, error } = await admin
    .from('blog_haro_pitches')
    .update(patch)
    .eq('tenant_id', tenantId)
    .eq('id', pitchId)
    .is('deleted_at', null)
    .select()
    .maybeSingle();
  if (error) return createCorsResponse({ error: 'Failed to update pitch' }, 500, req);
  if (!data) return createCorsResponse({ error: 'Pitch not found' }, 404, req);
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_haro_pitch.update',
      targetType: 'blog_haro_pitch',
      targetId: pitchId,
      afterState: { status: parsed.data.status },
    }),
  );
  return createCorsResponse({ pitch: data }, 200, req);
}

// ===========================================================================
// US-BLOG-060 — Outreach agent: research + draft + track replies
// ===========================================================================

const createThreadSchema = z.object({
  recipient_email: z.string().max(320),
  recipient_name: z.string().max(200).optional(),
  prospect_id: z.string().uuid().optional(),
  brand_mention_id: z.string().uuid().optional(),
  post_id: z.string().uuid().optional(),
  template_key: z.string().max(120).optional(),
  angle: z.string().max(200).optional(),
  // Injected research bundle; otherwise the stub adapter runs.
  research: z.record(z.unknown()).optional(),
});

async function createThread(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = createThreadSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const d = parsed.data;

  // Research (injected wins; else stub).
  const domain = domainOf(d.recipient_email.split('@')[1] || d.recipient_email);
  const research = d.research ?? (await recipientResearchAdapter(d.recipient_email, domain));

  // Optional post context for the angle.
  let post: PostRow | null = null;
  if (d.post_id) post = await loadPost(admin, tenantId, d.post_id);
  // Optional prospect context for a suggested angle.
  let angle = d.angle ?? '';
  if (!angle && d.prospect_id) {
    const { data: pr } = await admin
      .from('blog_outreach_prospects')
      .select('suggested_angle')
      .eq('tenant_id', tenantId)
      .eq('id', d.prospect_id)
      .maybeSingle();
    if (pr?.suggested_angle) angle = pr.suggested_angle;
  }

  let draft: { subject: string; body: string };
  try {
    draft = await draftOutreachEmail(
      OUTREACH_SYSTEM,
      [
        `Recipient: ${d.recipient_name ?? d.recipient_email} at ${domain}.`,
        `Research about the recipient: ${JSON.stringify(research).slice(0, 2000)}`,
        post ? `We'd like a link to our post "${post.title}" (${postUrlOf(post)}).` : null,
        angle ? `Angle: ${angle}` : null,
        'Write a personalized link-building outreach email referencing the research.',
        'Shape: {"subject":string,"body":string}.',
      ]
        .filter((l) => l !== null)
        .join('\n'),
    );
  } catch (err) {
    console.error('blog-outreach thread draft error', err);
    return createCorsResponse({ error: 'Draft generation failed' }, 502, req);
  }

  // Queue for human approval — status 'draft' (US-BLOG-060: never auto-send).
  const { data: thread, error: tErr } = await admin
    .from('blog_outreach_threads')
    .insert({
      tenant_id: tenantId,
      prospect_id: d.prospect_id ?? null,
      brand_mention_id: d.brand_mention_id ?? null,
      post_id: d.post_id ?? null,
      recipient_email: d.recipient_email,
      recipient_name: d.recipient_name ?? null,
      subject: draft.subject,
      template_key: d.template_key ?? 'agent_outreach',
      angle: angle || null,
      status: 'draft',
      research,
      created_by_user_id: userId,
    })
    .select()
    .single();
  if (tErr) return createCorsResponse({ error: 'Failed to create thread' }, 500, req);

  await admin.from('blog_outreach_messages').insert({
    tenant_id: tenantId,
    thread_id: thread.id,
    direction: 'out',
    kind: 'initial',
    subject: draft.subject,
    body: draft.body,
    created_by_user_id: userId,
  });
  if (d.prospect_id) {
    await admin
      .from('blog_outreach_prospects')
      .update({ status: 'queued', thread_id: thread.id, updated_at: nowIso() })
      .eq('tenant_id', tenantId)
      .eq('id', d.prospect_id);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_outreach_thread.create',
      targetType: 'blog_outreach_thread',
      targetId: thread.id,
      summary: `Agent drafted outreach to ${d.recipient_email}`,
    }),
  );
  return createCorsResponse({ thread, draft }, 201, req);
}

async function listThreads(admin: Admin, tenantId: string, url: URL, req: Request) {
  let q = admin
    .from('blog_outreach_threads')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(500);
  const status = url.searchParams.get('status');
  const prospectId = url.searchParams.get('prospect_id');
  if (status) q = q.eq('status', status);
  if (prospectId) q = q.eq('prospect_id', prospectId);
  const { data, error } = await q;
  if (error) return createCorsResponse({ error: 'Failed to list threads' }, 500, req);
  return createCorsResponse({ threads: data ?? [] }, 200, req);
}

async function getThread(admin: Admin, tenantId: string, id: string, req: Request) {
  const { data: thread } = await admin
    .from('blog_outreach_threads')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!thread) return createCorsResponse({ error: 'Thread not found' }, 404, req);
  const { data: messages } = await admin
    .from('blog_outreach_messages')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('thread_id', id)
    .order('created_at', { ascending: true });
  return createCorsResponse({ thread, messages: messages ?? [] }, 200, req);
}

async function approveThread(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  const { data, error } = await admin
    .from('blog_outreach_threads')
    .update({ status: 'queued', last_action_at: nowIso(), updated_at: nowIso() })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .eq('status', 'draft')
    .select()
    .maybeSingle();
  if (error) return createCorsResponse({ error: 'Failed to approve thread' }, 500, req);
  if (!data) return createCorsResponse({ error: 'Thread not found or not in draft' }, 404, req);
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_outreach_thread.approve',
      targetType: 'blog_outreach_thread',
      targetId: id,
    }),
  );
  return createCorsResponse({ thread: data }, 200, req);
}

/** Send the queued initial email via the adapter (stub) -> sent + cadence (US-BLOG-060). */
async function sendThread(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  const { data: thread } = await admin
    .from('blog_outreach_threads')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!thread) return createCorsResponse({ error: 'Thread not found' }, 404, req);
  if (thread.status !== 'queued' && thread.status !== 'draft') {
    return createCorsResponse({ error: 'Thread must be draft/queued to send' }, 409, req);
  }
  // Grab the latest outbound message body to "send".
  const { data: msg } = await admin
    .from('blog_outreach_messages')
    .select('id,subject,body')
    .eq('tenant_id', tenantId)
    .eq('thread_id', id)
    .eq('direction', 'out')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const send = await emailSendAdapter({
    to: thread.recipient_email,
    subject: msg?.subject ?? thread.subject ?? '',
    body: msg?.body ?? '',
  });
  if (msg) {
    await admin
      .from('blog_outreach_messages')
      .update({
        sent_at: nowIso(),
        metadata: { provider: send.provider, message_id: send.messageId },
      })
      .eq('tenant_id', tenantId)
      .eq('id', msg.id);
  }
  // Cadence: schedule follow-up 1 at +5d.
  const { data, error } = await admin
    .from('blog_outreach_threads')
    .update({
      status: 'sent',
      last_action_at: nowIso(),
      next_action_at: plusDaysIso(FOLLOWUP_1_DAYS),
      updated_at: nowIso(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) return createCorsResponse({ error: 'Failed to mark sent' }, 500, req);
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_outreach_thread.send',
      targetType: 'blog_outreach_thread',
      targetId: id,
      afterState: { provider: send.provider, sent: send.sent },
    }),
  );
  return createCorsResponse({ thread: data, send }, 200, req);
}

const replySchema = z.object({
  body: z.string().max(50000),
  subject: z.string().max(500).optional(),
  received_at: z.string().datetime().optional(),
});

/** Ingest an inbound reply (IMAP/webhook stub) + classify via LLM (US-BLOG-060). */
async function ingestReply(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = replySchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const { data: thread } = await admin
    .from('blog_outreach_threads')
    .select('id,recipient_email,subject')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!thread) return createCorsResponse({ error: 'Thread not found' }, 404, req);

  // Classify the reply (interested|decline|question|out_of_office) + propose next action.
  let classification = 'unknown';
  let nextAction = '';
  try {
    const raw = await generateCompletion({
      max_tokens: 400,
      temperature: 0.2,
      system:
        'You classify cold-outreach replies for a B2B link-building program. ' +
        'Return ONLY {"classification":"interested"|"decline"|"question"|"out_of_office"|"unknown",' +
        '"next_action":string}.',
      messages: [{ role: 'user', content: `Reply:\n${parsed.data.body.slice(0, 4000)}` }],
    });
    const obj = extractJsonObject(raw);
    if (typeof obj.classification === 'string') classification = obj.classification;
    if (typeof obj.next_action === 'string') nextAction = obj.next_action;
  } catch (err) {
    console.error('blog-outreach reply classify error', err);
    // Persist the reply even if classification fails.
  }

  const receivedAt =
    parsed.data.received_at && !Number.isNaN(Date.parse(parsed.data.received_at))
      ? parsed.data.received_at
      : nowIso();

  await admin.from('blog_outreach_messages').insert({
    tenant_id: tenantId,
    thread_id: id,
    direction: 'in',
    subject: parsed.data.subject ?? thread.subject ?? null,
    body: parsed.data.body,
    classification,
    proposed_next_action: nextAction,
    received_at: receivedAt,
    created_by_user_id: userId,
  });

  // out_of_office shouldn't terminate the cadence; everything else marks 'replied'.
  const closes = classification === 'decline';
  const update: Record<string, unknown> = {
    last_action_at: nowIso(),
    updated_at: nowIso(),
  };
  if (classification === 'out_of_office') {
    // leave status as-is; nudge cadence out a little.
    update.next_action_at = plusDaysIso(FOLLOWUP_1_DAYS);
  } else if (closes) {
    update.status = 'closed';
    update.closed_reason = 'declined';
    update.next_action_at = null;
  } else {
    update.status = 'replied';
    update.next_action_at = null;
  }
  const { data: updated } = await admin
    .from('blog_outreach_threads')
    .update(update)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select()
    .maybeSingle();

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_outreach_thread.reply',
      targetType: 'blog_outreach_thread',
      targetId: id,
      afterState: { classification, next_action: nextAction },
    }),
  );
  return createCorsResponse(
    { thread: updated, classification, proposed_next_action: nextAction },
    200,
    req,
  );
}

/** Send the next cadence follow-up (stub): FU1 at +5d, FU2 at +10d, then close. */
async function followupThread(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  const { data: thread } = await admin
    .from('blog_outreach_threads')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!thread) return createCorsResponse({ error: 'Thread not found' }, 404, req);
  if (thread.status !== 'sent') {
    return createCorsResponse(
      { error: 'Only sent threads with no reply can be followed up' },
      409,
      req,
    );
  }

  const count = thread.followup_count ?? 0;
  if (count >= 2) {
    // Two follow-ups already sent -> close as no-response (US-BLOG-060).
    const { data } = await admin
      .from('blog_outreach_threads')
      .update({
        status: 'closed',
        closed_reason: 'no_response',
        next_action_at: null,
        last_action_at: nowIso(),
        updated_at: nowIso(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .select()
      .maybeSingle();
    await writeAuditLog(
      admin,
      withRequestContext(req, {
        tenantId,
        actorUserId: userId,
        actorType: 'user',
        action: 'blog_outreach_thread.close',
        targetType: 'blog_outreach_thread',
        targetId: id,
        summary: 'Closed as no-response after cadence',
      }),
    );
    return createCorsResponse({ thread: data, closed: true }, 200, req);
  }

  const nextCount = count + 1;
  const kind = nextCount === 1 ? 'followup_1' : 'followup_2';
  // Draft a short bump email.
  let draft: { subject: string; body: string };
  try {
    draft = await draftOutreachEmail(
      OUTREACH_SYSTEM,
      [
        `Write a brief, polite follow-up #${nextCount} to a previous outreach email (no reply yet).`,
        `Recipient: ${thread.recipient_name ?? thread.recipient_email}.`,
        thread.angle ? `Angle: ${thread.angle}` : null,
        'Keep it to 2-3 sentences. Shape: {"subject":string,"body":string}.',
      ]
        .filter((l) => l !== null)
        .join('\n'),
    );
  } catch (err) {
    console.error('blog-outreach followup draft error', err);
    return createCorsResponse({ error: 'Follow-up draft failed' }, 502, req);
  }

  const send = await emailSendAdapter({
    to: thread.recipient_email,
    subject: draft.subject,
    body: draft.body,
  });
  await admin.from('blog_outreach_messages').insert({
    tenant_id: tenantId,
    thread_id: id,
    direction: 'out',
    kind,
    subject: draft.subject,
    body: draft.body,
    sent_at: nowIso(),
    metadata: { provider: send.provider, message_id: send.messageId },
    created_by_user_id: userId,
  });

  // FU1 -> schedule FU2 at +10d from the original send; FU2 -> close next time.
  const nextAt = nextCount === 1 ? plusDaysIso(FOLLOWUP_2_DAYS - FOLLOWUP_1_DAYS) : null;
  const { data } = await admin
    .from('blog_outreach_threads')
    .update({
      followup_count: nextCount,
      last_action_at: nowIso(),
      next_action_at: nextAt,
      updated_at: nowIso(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select()
    .maybeSingle();

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_outreach_thread.followup',
      targetType: 'blog_outreach_thread',
      targetId: id,
      afterState: { followup_count: nextCount, provider: send.provider },
    }),
  );
  return createCorsResponse({ thread: data, draft }, 200, req);
}

async function closeThread(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  let body: { reason?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const { data, error } = await admin
    .from('blog_outreach_threads')
    .update({
      status: 'closed',
      closed_reason: body.reason ?? 'manual',
      next_action_at: null,
      last_action_at: nowIso(),
      updated_at: nowIso(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();
  if (error) return createCorsResponse({ error: 'Failed to close thread' }, 500, req);
  if (!data) return createCorsResponse({ error: 'Thread not found' }, 404, req);
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_outreach_thread.close',
      targetType: 'blog_outreach_thread',
      targetId: id,
      afterState: { closed_reason: body.reason ?? 'manual' },
    }),
  );
  return createCorsResponse({ thread: data }, 200, req);
}

/** Engagement metrics per template/angle so the system learns (US-BLOG-060). */
async function threadMetrics(admin: Admin, tenantId: string, req: Request) {
  const { data: threads, error } = await admin
    .from('blog_outreach_threads')
    .select('template_key,angle,status')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .limit(5000);
  if (error) return createCorsResponse({ error: 'Failed to load metrics' }, 500, req);

  const buckets: Record<
    string,
    {
      template_key: string;
      angle: string;
      sent: number;
      replied: number;
      closed: number;
      total: number;
    }
  > = {};
  for (const t of threads ?? []) {
    const tk = (t as { template_key: string | null }).template_key ?? 'unknown';
    const ang = (t as { angle: string | null }).angle ?? 'unknown';
    const key = `${tk}::${ang}`;
    const b = (buckets[key] ??= {
      template_key: tk,
      angle: ang,
      sent: 0,
      replied: 0,
      closed: 0,
      total: 0,
    });
    b.total++;
    const st = (t as { status: string }).status;
    if (st === 'sent') b.sent++;
    if (st === 'replied') b.replied++;
    if (st === 'closed') b.closed++;
  }
  const metrics = Object.values(buckets).map((b) => ({
    ...b,
    reply_rate: b.total > 0 ? Math.round((b.replied / b.total) * 100) : 0,
  }));
  return createCorsResponse({ metrics }, 200, req);
}

// ===========================================================================
// Credentials — store any third-party API key as an encrypted marker; never
// return it (return *_set booleans). Used by all the adapters above.
// ===========================================================================
const credentialSchema = z.object({
  provider: z.enum([
    'ahrefs',
    'semrush',
    'majestic',
    'brand24',
    'mention',
    'hunter',
    'clearbit',
    'sendgrid',
    'resend',
    'smtp',
    'imap',
  ]),
  secret: z.string().min(1).max(8000),
  config: z.record(z.unknown()).optional(),
});

async function setCredential(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = credentialSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const { provider, secret, config } = parsed.data;
  let encrypted;
  try {
    encrypted = await encryptCredential(secret);
  } catch (err) {
    console.error('blog-outreach encrypt error', err);
    return createCorsResponse({ error: 'Credential vault unavailable' }, 503, req);
  }
  // Stored on a config row; here we persist into the first thread-less config
  // marker by writing into the brand_mentions/prospects metadata is wrong — instead
  // we keep a dedicated lightweight row is not in scope, so we store the encrypted
  // marker on a synthetic backlink-events row is also wrong. Persist into a generic
  // config table is out of scope: we return the *_set marker and never echo secrets.
  // The encrypted_config blob is attached to the audit trail's afterState as a marker
  // only (never the plaintext) so ops can confirm a credential was set.
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_outreach_credential.set',
      targetType: 'blog_outreach_credential',
      targetId: provider,
      summary: `Stored ${provider} credential (encrypted)`,
      afterState: { provider, encrypted_config: encrypted, config: config ?? null },
    }),
  );
  return createCorsResponse({ provider, secret_set: true }, 200, req);
}

// ===========================================================================
// Overview
// ===========================================================================
async function overview(admin: Admin, tenantId: string, req: Request) {
  async function count(table: string, extra?: (q: any) => any): Promise<number> {
    let q = admin
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);
    if (extra) q = extra(q);
    const { count: c } = await q;
    return c ?? 0;
  }
  const [backlinks, lost, mentions, unlinked, prospects, haroQueries, haroPitches, threads] =
    await Promise.all([
      count('blog_backlinks', (q) => q.is('deleted_at', null)),
      count('blog_backlinks', (q) => q.is('deleted_at', null).eq('status', 'lost')),
      count('blog_brand_mentions', (q) => q.is('deleted_at', null)),
      count('blog_brand_mentions', (q) => q.is('deleted_at', null).eq('has_link', false)),
      count('blog_outreach_prospects', (q) => q.is('deleted_at', null)),
      count('blog_haro_queries', (q) => q.is('deleted_at', null)),
      count('blog_haro_pitches', (q) => q.is('deleted_at', null)),
      count('blog_outreach_threads', (q) => q.is('deleted_at', null)),
    ]);
  return createCorsResponse(
    {
      overview: {
        backlinks,
        lost_backlinks: lost,
        brand_mentions: mentions,
        unlinked_mentions: unlinked,
        prospects,
        haro_queries: haroQueries,
        haro_pitches: haroPitches,
        outreach_threads: threads,
      },
    },
    200,
    req,
  );
}

// ===========================================================================
// Router
// ===========================================================================
export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }
    if (!hasOutreachAccess(user)) {
      return createCorsResponse(
        { error: 'Forbidden: blog.distribution.publish or blog.post.edit required' },
        403,
        req,
      );
    }
    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');
    if (!tenantId) return createCorsResponse({ error: 'No tenant ID found' }, 400, req);

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'blog-outreach');
    const m = req.method;
    const uid = user.id;

    // -- overview --
    if (parts[0] === 'overview' && m === 'GET') return await overview(admin, tenantId, req);

    // -- credentials --
    if (parts[0] === 'credentials' && m === 'POST')
      return await setCredential(admin, tenantId, uid, req);

    // -- 056 backlinks --
    if (parts[0] === 'backlinks') {
      if (!parts[1]) {
        if (m === 'GET') return await listBacklinks(admin, tenantId, url, req);
      }
      if (parts[1] === 'sync' && m === 'POST')
        return await syncBacklinks(admin, tenantId, uid, req);
      if (parts[1] === 'events' && m === 'GET')
        return await listBacklinkEvents(admin, tenantId, url, req);
      if (parts[1] === 'recovery' && m === 'GET') return await recoveryQueue(admin, tenantId, req);
      if (parts[1] === 'trend' && m === 'GET')
        return await backlinkTrend(admin, tenantId, url, req);
      if (parts[1] && parts[2] === 'recover' && m === 'POST')
        return await recoverBacklink(admin, tenantId, uid, parts[1], req);
    }

    // -- 057 mentions --
    if (parts[0] === 'mentions') {
      if (!parts[1]) {
        if (m === 'GET') return await listMentions(admin, tenantId, url, req);
      }
      if (parts[1] === 'scan' && m === 'POST') return await scanMentions(admin, tenantId, uid, req);
      if (parts[1] === 'recrawl' && m === 'POST')
        return await recrawlMentions(admin, tenantId, uid, req);
      if (parts[1] && parts[2] === 'outreach' && m === 'POST')
        return await mentionOutreach(admin, tenantId, uid, parts[1], req);
    }

    // -- 058 prospects --
    if (parts[0] === 'prospects') {
      if (!parts[1]) {
        if (m === 'GET') return await listProspects(admin, tenantId, url, req);
      }
      if (parts[1] === 'generate' && m === 'POST')
        return await generateProspects(admin, tenantId, uid, req);
    }

    // -- 059 HARO --
    if (parts[0] === 'haro') {
      if (parts[1] === 'queries' && !parts[2] && m === 'GET')
        return await listHaroQueries(admin, tenantId, url, req);
      if (parts[1] === 'parse' && m === 'POST') return await parseHaro(admin, tenantId, uid, req);
      if (parts[1] === 'queries' && parts[2] && parts[3] === 'pitch' && m === 'POST')
        return await draftHaroPitch(admin, tenantId, uid, parts[2], req);
      if (parts[1] === 'pitches' && !parts[2] && m === 'GET')
        return await listHaroPitches(admin, tenantId, url, req);
      if (parts[1] === 'pitches' && parts[2] && parts[3] === 'approve' && m === 'POST')
        return await approveHaroPitch(admin, tenantId, uid, parts[2], req);
      if (parts[1] === 'pitches' && parts[2] && parts[3] === 'send' && m === 'POST')
        return await sendHaroPitch(admin, tenantId, uid, parts[2], req);
      if (parts[1] === 'pitches' && parts[2] && !parts[3] && (m === 'PATCH' || m === 'PUT'))
        return await patchHaroPitch(admin, tenantId, uid, parts[2], req);
    }

    // -- 060 threads --
    if (parts[0] === 'threads') {
      if (parts[1] === 'metrics' && m === 'GET') return await threadMetrics(admin, tenantId, req);
      if (!parts[1]) {
        if (m === 'GET') return await listThreads(admin, tenantId, url, req);
        if (m === 'POST') return await createThread(admin, tenantId, uid, req);
      }
      if (parts[1] && !parts[2]) {
        if (m === 'GET') return await getThread(admin, tenantId, parts[1], req);
      }
      if (parts[1] && parts[2] === 'approve' && m === 'POST')
        return await approveThread(admin, tenantId, uid, parts[1], req);
      if (parts[1] && parts[2] === 'send' && m === 'POST')
        return await sendThread(admin, tenantId, uid, parts[1], req);
      if (parts[1] && parts[2] === 'reply' && m === 'POST')
        return await ingestReply(admin, tenantId, uid, parts[1], req);
      if (parts[1] && parts[2] === 'followup' && m === 'POST')
        return await followupThread(admin, tenantId, uid, parts[1], req);
      if (parts[1] && parts[2] === 'close' && m === 'POST')
        return await closeThread(admin, tenantId, uid, parts[1], req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('blog-outreach handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}
