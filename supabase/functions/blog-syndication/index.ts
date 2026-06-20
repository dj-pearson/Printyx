// Blog Syndication Edge Function (US-BLOG-043..051)
//
// Turns one published post into platform-native repurposed content so
// distribution is a click, not a re-writing task. Every artifact is stored as a
// blog_syndication_pieces row keyed to (post, platform, variant) and carries the
// platform-specific payload, UTM tracking, and scheduling metadata.
//
// Platforms (per-platform AC noted inline in buildPrompt):
//   email (043), x (044), linkedin (045), facebook/instagram_carousel/
//   instagram_reel (046), tiktok/youtube_shorts (047), pinterest (048),
//   reddit (049), hackernews/medium/substack (050), slack/discord (051)
//
// Auto-submit is NEVER done here — generation produces drafts; sending is an
// explicit adapter step (status -> scheduled/published). Manual-only platforms
// (reddit, hackernews) move to status='ready' for copy/paste, never auto-post.
//
// Routes (tenant-scoped, gated to blog.distribution.publish):
//   GET    /blog-syndication                 list (?post_id= &platform= &status=)
//   GET    /blog-syndication/platforms       supported-platform metadata
//   GET    /blog-syndication/:id             one piece
//   POST   /blog-syndication/generate        body { post_id, platform, options? }
//   PATCH  /blog-syndication/:id             edit content/status/scheduled_at/variant_label
//   POST   /blog-syndication/:id/schedule    body { scheduled_at }
//   POST   /blog-syndication/:id/mark-sent   body { sent_at?, external_url? }
//   DELETE /blog-syndication/:id             soft delete

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';
import { generateCompletion } from '../_shared/anthropic.ts';
import { extractJsonObject } from '../_shared/blog/llm-json.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const PLATFORMS = [
  'email',
  'x',
  'linkedin',
  'facebook',
  'instagram_carousel',
  'instagram_reel',
  'tiktok',
  'youtube_shorts',
  'pinterest',
  'reddit',
  'hackernews',
  'medium',
  'substack',
  'slack',
  'discord',
] as const;
type Platform = (typeof PLATFORMS)[number];

// Platforms we never auto-submit to — generation lands in 'ready' for copy/paste.
const MANUAL_ONLY = new Set<Platform>(['reddit', 'hackernews']);

const PLATFORM_META: Record<Platform, { label: string; story: string; adapter: string }> = {
  email: {
    label: 'Email newsletter',
    story: 'US-BLOG-043',
    adapter: 'convertkit|mailchimp|resend|beehiiv|substack',
  },
  x: { label: 'X / Twitter thread', story: 'US-BLOG-044', adapter: 'x-api|clipboard' },
  linkedin: {
    label: 'LinkedIn long-form',
    story: 'US-BLOG-045',
    adapter: 'linkedin-api|clipboard',
  },
  facebook: { label: 'Facebook post', story: 'US-BLOG-046', adapter: 'meta-graph|clipboard' },
  instagram_carousel: {
    label: 'Instagram carousel',
    story: 'US-BLOG-046',
    adapter: 'meta-graph|export-png',
  },
  instagram_reel: { label: 'Instagram Reel script', story: 'US-BLOG-046', adapter: 'manual' },
  tiktok: { label: 'TikTok script', story: 'US-BLOG-047', adapter: 'manual' },
  youtube_shorts: { label: 'YouTube Shorts script', story: 'US-BLOG-047', adapter: 'manual' },
  pinterest: { label: 'Pinterest pins', story: 'US-BLOG-048', adapter: 'pinterest-api|export-png' },
  reddit: { label: 'Reddit post (rule-aware)', story: 'US-BLOG-049', adapter: 'clipboard' },
  hackernews: { label: 'Hacker News submission', story: 'US-BLOG-050', adapter: 'clipboard' },
  medium: { label: 'Medium repost', story: 'US-BLOG-050', adapter: 'medium-api' },
  substack: { label: 'Substack cross-post', story: 'US-BLOG-050', adapter: 'substack' },
  slack: { label: 'Slack snippet', story: 'US-BLOG-051', adapter: 'incoming-webhook' },
  discord: { label: 'Discord embed', story: 'US-BLOG-051', adapter: 'incoming-webhook' },
};

const generateSchema = z.object({
  post_id: z.string().uuid(),
  platform: z.enum(PLATFORMS),
  options: z
    .object({
      tone: z.string().max(60).optional(), // founder|company|thought-leadership (045)
      target_subreddit: z.string().max(120).optional(), // 049
      subreddit_rules: z.string().max(8000).optional(), // 049 — pasted rules for the LLM rule check
      channel_template: z.string().max(120).optional(), // 051 per-channel template name
      role_mention: z.string().max(120).optional(), // 051 Discord role mention
      trend_aware: z.boolean().optional(), // 047 pull trending audio/format
      utm: z
        .object({
          source: z.string().max(80).optional(),
          medium: z.string().max(80).optional(),
          campaign: z.string().max(120).optional(),
          content: z.string().max(120).optional(),
          term: z.string().max(120).optional(),
        })
        .optional(),
      target_config: z.record(z.unknown()).optional(),
    })
    .optional(),
});

const patchSchema = z.object({
  content: z.record(z.unknown()).optional(),
  status: z.enum(['draft', 'ready', 'scheduled', 'published', 'failed']).optional(),
  variant_label: z.string().max(200).nullable().optional(),
  scheduled_at: z.string().datetime().nullable().optional(),
});

function hasDistributionPublish(user: { app_metadata?: Record<string, unknown> }): boolean {
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

/** Append UTM params to every absolute http(s) URL we recognise in a string. */
function applyUtm(text: string, utm: Record<string, string> | null): string {
  if (!text || !utm || Object.keys(utm).length === 0) return text;
  const qp = Object.entries(utm)
    .filter(([, v]) => v)
    .map(([k, v]) => `utm_${k}=${encodeURIComponent(v)}`)
    .join('&');
  if (!qp) return text;
  return text.replace(/https?:\/\/[^\s)"']+/g, (raw) => {
    // Don't double-apply.
    if (raw.includes('utm_')) return raw;
    const sep = raw.includes('?') ? '&' : '?';
    return `${raw}${sep}${qp}`;
  });
}

interface PostRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body_markdown: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  cms_post_url: string | null;
  status: string;
}

/** Per-platform system + JSON-shape instruction. The model returns a JSON object. */
function buildPrompt(
  platform: Platform,
  post: PostRow,
  opts: NonNullable<z.infer<typeof generateSchema>['options']>,
): {
  system: string;
  shape: string;
} {
  const tone = opts.tone ? ` Tone: ${opts.tone}.` : '';
  const base =
    'You are an expert B2B content distribution strategist for a print/MFP dealer SaaS. ' +
    'Repurpose the source post faithfully — never invent facts not present in the post. ' +
    'Return ONLY a single JSON object, no prose, no code fences.' +
    tone;

  switch (platform) {
    case 'email':
      return {
        system: base,
        shape:
          'Shape: {"subject_variants":[3 strings],"preheader":string,"body_markdown":string ' +
          '(TLDR + 3-5 key points + CTA back to the full post; shorter than the source),' +
          '"body_text":string (plain-text fallback),"cta":string}. ' +
          'Subject + preheader carry 80% of open-rate weight (US-BLOG-043).',
      };
    case 'x':
      return {
        system: base,
        shape:
          'Shape: {"hook_variants":[5 strings, each <=280 chars],"tweets":[6-12 strings each <=280 chars],' +
          '"cta_tweet":string (links back to the post),"media_slots":[per-tweet suggestion strings]}. ' +
          'First tweet is the only one most people read (US-BLOG-044).',
      };
    case 'linkedin':
      return {
        system: base,
        shape:
          'Shape: {"hook":string (first 2 lines, visible before "see more"),"body":string (800-1500 chars, ' +
          'bullets with line breaks, soft CTA, NO outbound link in body),"hashtags":[3-5 strings],' +
          '"first_comment":string (the post link goes here, not in the body)}. ' +
          'LinkedIn deprioritises outbound links in body — link-in-comment is required (US-BLOG-045).',
      };
    case 'facebook':
      return {
        system: base,
        shape: 'Shape: {"copy":string (short),"image_prompt":string,"link":string}.',
      };
    case 'instagram_carousel':
      return {
        system: base,
        shape:
          'Shape: {"slides":[6-10 {"title":string,"body":string}],"description":string,' +
          '"image_style":string}. Slide 1 is the hook; last slide is the CTA (US-BLOG-046).',
      };
    case 'instagram_reel':
    case 'tiktok':
    case 'youtube_shorts':
      return {
        system: base,
        shape:
          'Shape: {"hook":string (first 3 seconds),"beats":[{"on_screen_text":string,"voiceover":string,' +
          '"camera":string}],"broll":[strings],"runtime_sec":number (30-60),"cta":string' +
          (opts.trend_aware ? ',"trend_hashtags":[strings]' : '') +
          '}. 3-act structure problem->insight->CTA. Script + storyboard only, not the video (US-BLOG-047).',
      };
    case 'pinterest':
      return {
        system: base,
        shape:
          'Shape: {"pins":[3-5 {"headline":string,"description":string (target keyword, natural language),' +
          '"layout":"text-heavy"|"image-heavy"|"quote-style","colors":string}]}. ' +
          'Vertical 1000x1500 pins; A/B different designs (US-BLOG-048).',
      };
    case 'reddit':
      return {
        system: base,
        shape:
          'Shape: {"title":string (curiosity-driven, NOT clickbait),"format":"self-post"|"link-post",' +
          '"body":string (value-first; link is a secondary reference),"comment_seed":string,' +
          '"rule_findings":[{"rule":string,"status":"ok"|"warn"|"violation","note":string}]}. ' +
          (opts.subreddit_rules
            ? `Check the draft against these subreddit rules and populate rule_findings: """${opts.subreddit_rules.slice(0, 4000)}""".`
            : 'No rules provided — leave rule_findings empty but note self-promotion etiquette.') +
          ' Never auto-submit; this is copy/paste only (US-BLOG-049).',
      };
    case 'hackernews':
      return {
        system: base,
        shape:
          'Shape: {"title":string (declarative, no clickbait),"best_hours":string (peak HN time, US/ET),' +
          '"seed_comment":string (discussion starter)}. (US-BLOG-050)',
      };
    case 'medium':
    case 'substack':
      return {
        system: base,
        shape:
          'Shape: {"title":string,"intro":string,"tags":[3-5 strings],"canonical_note":string}. ' +
          'The canonical_url MUST point to the original post to avoid SEO cannibalisation (US-BLOG-050).',
      };
    case 'slack':
    case 'discord':
      return {
        system: base,
        shape:
          'Shape: {"title":string,"summary":string (1 line),"cta_text":string,"long_announcement":string}. ' +
          'Rich attachment/embed with a button-style CTA (US-BLOG-051).',
      };
  }
}

async function loadPost(admin: Admin, tenantId: string, postId: string): Promise<PostRow | null> {
  const { data, error } = await admin
    .from('blog_posts')
    .select(
      'id,title,slug,excerpt,body_markdown,meta_description,canonical_url,cms_post_url,status',
    )
    .eq('tenant_id', tenantId)
    .eq('id', postId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return (data as PostRow | null) ?? null;
}

async function generate(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const { post_id, platform } = parsed.data;
  const opts = parsed.data.options ?? {};

  const post = await loadPost(admin, tenantId, post_id);
  if (!post) return createCorsResponse({ error: 'Post not found' }, 404, req);
  if (post.status !== 'published') {
    return createCorsResponse(
      { error: 'Post must be published before syndication (US-BLOG-042 publishes first).' },
      409,
      req,
    );
  }

  const postUrl = post.canonical_url || post.cms_post_url || `/${post.slug}`;
  const utm: Record<string, string> = {
    source: opts.utm?.source ?? platform,
    medium: opts.utm?.medium ?? (platform === 'email' ? 'email' : 'social'),
    campaign: opts.utm?.campaign ?? 'blog_syndication',
    ...(opts.utm?.content ? { content: opts.utm.content } : {}),
    ...(opts.utm?.term ? { term: opts.utm.term } : {}),
  };

  const { system, shape } = buildPrompt(platform, post, opts);
  const userPrompt = [
    `Source post title: ${post.title}`,
    post.meta_description ? `Meta description: ${post.meta_description}` : null,
    `Post URL (link back here): ${postUrl}`,
    '',
    'Post body (markdown, truncated):',
    (post.body_markdown || post.excerpt || '').slice(0, 6000) || '(no body — use the title)',
    '',
    shape,
  ]
    .filter((l) => l !== null)
    .join('\n');

  let content: Record<string, unknown>;
  try {
    const raw = await generateCompletion({
      max_tokens: 2000,
      temperature: 0.8,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    });
    content = extractJsonObject(raw);
  } catch (err) {
    console.error('blog-syndication generation error', err);
    return createCorsResponse(
      { error: 'Generation failed — model unavailable or returned an unparseable response.' },
      502,
      req,
    );
  }

  // Deterministic post-processing the model shouldn't be trusted with.
  if (platform === 'medium' || platform === 'substack') {
    content.canonical_url = postUrl; // canonical MUST be the original (US-BLOG-050)
  }
  if (platform === 'x' && Array.isArray(content.tweets)) {
    content.char_counts = (content.tweets as unknown[]).map((t) => String(t).length);
  }
  // Apply UTM to every link in textual fields (links-in-comment, CTAs, bodies).
  for (const key of [
    'body_markdown',
    'body_text',
    'body',
    'first_comment',
    'cta',
    'cta_text',
    'link',
    'long_announcement',
    'comment_seed',
  ]) {
    if (typeof content[key] === 'string') content[key] = applyUtm(content[key] as string, utm);
  }
  if (Array.isArray(content.tweets)) {
    content.tweets = (content.tweets as unknown[]).map((t) => applyUtm(String(t), utm));
  }
  content.post_url = postUrl;

  const status = MANUAL_ONLY.has(platform) ? 'ready' : 'draft';
  const { data: inserted, error: insErr } = await admin
    .from('blog_syndication_pieces')
    .insert({
      tenant_id: tenantId,
      post_id,
      platform,
      variant_label: PLATFORM_META[platform].label,
      content,
      status,
      post_url: postUrl,
      utm,
      target_config: opts.target_config ?? null,
      created_by_user_id: userId,
    })
    .select()
    .single();
  if (insErr) {
    console.error('blog-syndication insert error', insErr);
    return createCorsResponse({ error: 'Failed to store syndication piece' }, 500, req);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_syndication.generate',
      targetType: 'blog_syndication_piece',
      targetId: inserted.id,
      summary: `Generated ${platform} syndication piece`,
      afterState: { platform, post_id, status },
    }),
  );

  return createCorsResponse({ piece: inserted }, 201, req);
}

async function list(admin: Admin, tenantId: string, url: URL, req: Request) {
  let q = admin
    .from('blog_syndication_pieces')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200);
  const postId = url.searchParams.get('post_id');
  const platform = url.searchParams.get('platform');
  const status = url.searchParams.get('status');
  if (postId) q = q.eq('post_id', postId);
  if (platform) q = q.eq('platform', platform);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) {
    console.error('blog-syndication list error', error);
    return createCorsResponse({ error: 'Failed to list syndication pieces' }, 500, req);
  }
  return createCorsResponse({ pieces: data ?? [] }, 200, req);
}

async function getOne(admin: Admin, tenantId: string, id: string, req: Request) {
  const { data, error } = await admin
    .from('blog_syndication_pieces')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) return createCorsResponse({ error: 'Failed to load piece' }, 500, req);
  if (!data) return createCorsResponse({ error: 'Piece not found' }, 404, req);
  return createCorsResponse({ piece: data }, 200, req);
}

async function patch(admin: Admin, tenantId: string, userId: string, id: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const patchData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.content !== undefined) patchData.content = parsed.data.content;
  if (parsed.data.status !== undefined) patchData.status = parsed.data.status;
  if (parsed.data.variant_label !== undefined) patchData.variant_label = parsed.data.variant_label;
  if (parsed.data.scheduled_at !== undefined) patchData.scheduled_at = parsed.data.scheduled_at;

  const { data, error } = await admin
    .from('blog_syndication_pieces')
    .update(patchData)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();
  if (error) return createCorsResponse({ error: 'Failed to update piece' }, 500, req);
  if (!data) return createCorsResponse({ error: 'Piece not found' }, 404, req);

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_syndication.update',
      targetType: 'blog_syndication_piece',
      targetId: id,
      afterState: { status: parsed.data.status },
    }),
  );
  return createCorsResponse({ piece: data }, 200, req);
}

async function schedule(admin: Admin, tenantId: string, userId: string, id: string, req: Request) {
  let body: { scheduled_at?: string };
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  if (!body.scheduled_at || Number.isNaN(Date.parse(body.scheduled_at))) {
    return createCorsResponse({ error: 'scheduled_at (ISO datetime) is required' }, 400, req);
  }
  const { data, error } = await admin
    .from('blog_syndication_pieces')
    .update({
      scheduled_at: body.scheduled_at,
      status: 'scheduled',
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();
  if (error) return createCorsResponse({ error: 'Failed to schedule piece' }, 500, req);
  if (!data) return createCorsResponse({ error: 'Piece not found' }, 404, req);
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_syndication.schedule',
      targetType: 'blog_syndication_piece',
      targetId: id,
      afterState: { scheduled_at: body.scheduled_at },
    }),
  );
  return createCorsResponse({ piece: data }, 200, req);
}

async function markSent(admin: Admin, tenantId: string, userId: string, id: string, req: Request) {
  let body: { sent_at?: string; external_url?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const sentAt =
    body.sent_at && !Number.isNaN(Date.parse(body.sent_at))
      ? body.sent_at
      : new Date().toISOString();
  const { data: existing } = await admin
    .from('blog_syndication_pieces')
    .select('content')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!existing) return createCorsResponse({ error: 'Piece not found' }, 404, req);
  const content = (existing.content as Record<string, unknown>) ?? {};
  if (body.external_url) content.external_url = body.external_url;

  const { data, error } = await admin
    .from('blog_syndication_pieces')
    .update({ status: 'published', sent_at: sentAt, content, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();
  if (error) return createCorsResponse({ error: 'Failed to mark sent' }, 500, req);
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_syndication.mark_sent',
      targetType: 'blog_syndication_piece',
      targetId: id,
      afterState: { sent_at: sentAt },
    }),
  );
  return createCorsResponse({ piece: data }, 200, req);
}

async function softDelete(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  const { data, error } = await admin
    .from('blog_syndication_pieces')
    .update({ deleted_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle();
  if (error) return createCorsResponse({ error: 'Failed to delete piece' }, 500, req);
  if (!data) return createCorsResponse({ error: 'Piece not found' }, 404, req);
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_syndication.delete',
      targetType: 'blog_syndication_piece',
      targetId: id,
      summary: 'Deleted syndication piece',
    }),
  );
  return createCorsResponse({ success: true }, 200, req);
}

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
    if (!hasDistributionPublish(user)) {
      return createCorsResponse(
        { error: 'Forbidden: blog.distribution.publish required' },
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
    const { parts } = normalizePath(url.pathname, 'blog-syndication');

    if (parts[0] === 'platforms' && req.method === 'GET') {
      return createCorsResponse(
        { platforms: PLATFORM_META, manual_only: [...MANUAL_ONLY] },
        200,
        req,
      );
    }
    if (parts[0] === 'generate' && req.method === 'POST') {
      return await generate(admin, tenantId, user.id, req);
    }
    if (!parts[0]) {
      if (req.method === 'GET') return await list(admin, tenantId, url, req);
    }
    if (parts[0] && !parts[1]) {
      if (req.method === 'GET') return await getOne(admin, tenantId, parts[0], req);
      if (req.method === 'PATCH' || req.method === 'PUT')
        return await patch(admin, tenantId, user.id, parts[0], req);
      if (req.method === 'DELETE') return await softDelete(admin, tenantId, user.id, parts[0], req);
    }
    if (parts[0] && parts[1] === 'schedule' && req.method === 'POST') {
      return await schedule(admin, tenantId, user.id, parts[0], req);
    }
    if (parts[0] && parts[1] === 'mark-sent' && req.method === 'POST') {
      return await markSent(admin, tenantId, user.id, parts[0], req);
    }
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('blog-syndication handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}
