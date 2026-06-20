// Blog Distribution Scheduling Edge Function (US-BLOG-052, 053, 054)
//
// Three coupled concerns over blog_distributions:
//   US-BLOG-052  optimal-time prediction + smart-schedule (conflict-aware)
//   US-BLOG-053  UTM strategy: tag distribution URLs per channel
//   US-BLOG-054  re-share cadence engine (T+0/3/7/30/90/180) + pause/resume + timeline
//
// Routes (gated to platform admin OR users holding blog.distribution.publish):
//   GET   /blog-scheduling/settings
//   PUT   /blog-scheduling/settings        body: { utm_template?, optimal_time_defaults?, cadence_config?, cadence_min_engagement?, short_link_provider? }
//   GET   /blog-scheduling/optimal-times?platform=
//   POST  /blog-scheduling/smart-schedule  body: { post_id, platforms?, start_at? }
//   POST  /blog-scheduling/utm             body: { post_id, platforms?, campaign?, write? }
//   POST  /blog-scheduling/cadence         body: { post_id, base_published_at?, platforms? }
//   PATCH /blog-scheduling/cadence/:postId body: { paused }
//   GET   /blog-scheduling/timeline?post_id=
//
// Optimal-time + UTM math is pure (../_shared/blog/distribution-timing.ts); GA4
// UTM verification + short-link providers (Bitly/Rebrandly) are layered later.

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';
import {
  buildUtmUrl,
  optimalSlots,
  nextSlotDate,
  DEFAULT_CADENCE,
  type TimeSlot,
  type UtmTemplate,
} from '../_shared/blog/distribution-timing.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const settingsSchema = z.object({
  utm_template: z.record(z.unknown()).optional(),
  optimal_time_defaults: z.record(z.unknown()).optional(),
  cadence_config: z.array(z.unknown()).optional(),
  cadence_min_engagement: z.number().int().min(0).optional(),
  short_link_provider: z.enum(['bitly', 'rebrandly']).nullable().optional(),
});
const smartScheduleSchema = z.object({
  post_id: z.string().uuid(),
  platforms: z.array(z.string()).max(30).optional(),
  start_at: z.string().datetime().optional(),
});
const utmSchema = z.object({
  post_id: z.string().uuid(),
  platforms: z.array(z.string()).max(30).optional(),
  campaign: z.string().max(120).optional(),
  write: z.boolean().optional(),
});
const cadenceSchema = z.object({
  post_id: z.string().uuid(),
  base_published_at: z.string().datetime().optional(),
  platforms: z.array(z.string()).max(30).optional(),
});
const pauseSchema = z.object({ paused: z.boolean() });

function hasDistributionPublish(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const perms = meta.permissions;
  if (
    Array.isArray(perms) &&
    (perms.includes('blog.distribution.publish') || perms.includes('blog.post.edit'))
  )
    return true;
  const role = String(meta.role ?? '').toLowerCase();
  return role === 'platform_admin' || role === 'super_admin' || role === 'company_admin';
}

function engagementOf(metrics: unknown): number {
  if (!metrics || typeof metrics !== 'object') return 0;
  const m = metrics as Record<string, unknown>;
  return (
    (Number(m.likes) || 0) +
    (Number(m.shares) || 0) +
    (Number(m.clicks) || 0) +
    (Number(m.comments) || 0)
  );
}

async function postUrl(admin: Admin, tenantId: string, postId: string): Promise<{
  url: string;
  slug: string;
  published_at: string | null;
} | null> {
  const { data: post } = await admin
    .from('blog_posts')
    .select('slug, cms_post_url, canonical_url, published_at')
    .eq('tenant_id', tenantId)
    .eq('id', postId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!post) return null;
  const url =
    post.cms_post_url || post.canonical_url || `https://example.com/blog/${post.slug ?? postId}`;
  return { url, slug: post.slug ?? postId, published_at: post.published_at };
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
    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'blog-scheduling');
    const action = parts[0];

    if (action === 'settings' && req.method === 'GET') return await getSettings(admin, tenantId, req);
    if (action === 'settings' && req.method === 'PUT')
      return await putSettings(admin, tenantId, user.id, req);
    if (action === 'optimal-times' && req.method === 'GET')
      return await optimalTimes(admin, tenantId, url, req);
    if (action === 'smart-schedule' && req.method === 'POST')
      return await smartSchedule(admin, tenantId, user.id, req);
    if (action === 'utm' && req.method === 'POST') return await utm(admin, tenantId, user.id, req);
    if (action === 'cadence' && !parts[1] && req.method === 'POST')
      return await cadence(admin, tenantId, user.id, req);
    if (action === 'cadence' && parts[1] && req.method === 'PATCH')
      return await pauseCadence(admin, tenantId, user.id, parts[1], req);
    if (action === 'timeline' && req.method === 'GET') return await timeline(admin, tenantId, url, req);

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('blog-scheduling handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

async function loadSettings(admin: Admin, tenantId: string) {
  const { data } = await admin
    .from('blog_distribution_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return data;
}

async function getSettings(admin: Admin, tenantId: string, req: Request) {
  const settings = await loadSettings(admin, tenantId);
  return createCorsResponse(
    { settings: settings ?? { tenant_id: tenantId, default_cadence: DEFAULT_CADENCE } },
    200,
    req,
  );
}

async function putSettings(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.utm_template !== undefined) update.utm_template = parsed.data.utm_template;
  if (parsed.data.optimal_time_defaults !== undefined)
    update.optimal_time_defaults = parsed.data.optimal_time_defaults;
  if (parsed.data.cadence_config !== undefined) update.cadence_config = parsed.data.cadence_config;
  if (parsed.data.cadence_min_engagement !== undefined)
    update.cadence_min_engagement = parsed.data.cadence_min_engagement;
  if (parsed.data.short_link_provider !== undefined)
    update.short_link_provider = parsed.data.short_link_provider;

  const existing = await loadSettings(admin, tenantId);
  if (existing) {
    await admin
      .from('blog_distribution_settings')
      .update(update)
      .eq('tenant_id', tenantId)
      .eq('id', existing.id);
  } else {
    await admin
      .from('blog_distribution_settings')
      .insert({ tenant_id: tenantId, ...update });
  }
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_scheduling.settings.update',
      targetType: 'blog_distribution_settings',
      summary: 'Updated distribution settings',
    }),
  );
  return await getSettings(admin, tenantId, req);
}

/** Optimal slots per platform from this workspace's published-distribution engagement. */
async function computeOptimalByPlatform(
  admin: Admin,
  tenantId: string,
): Promise<Record<string, TimeSlot[]>> {
  const { data: rows } = await admin
    .from('blog_distributions')
    .select('platform, published_at, engagement_metrics')
    .eq('tenant_id', tenantId)
    .eq('status', 'published')
    .not('published_at', 'is', null)
    .limit(5000);

  const byPlatform = new Map<string, Array<{ publishedAt: string; engagement: number }>>();
  for (const r of rows ?? []) {
    const arr = byPlatform.get(r.platform) ?? [];
    arr.push({
      publishedAt: r.published_at as string,
      engagement: engagementOf(r.engagement_metrics),
    });
    byPlatform.set(r.platform, arr);
  }
  const out: Record<string, TimeSlot[]> = {};
  for (const [platform, samples] of byPlatform) out[platform] = optimalSlots(samples, 3);
  return out;
}

async function optimalTimes(admin: Admin, tenantId: string, url: URL, req: Request) {
  const platform = url.searchParams.get('platform');
  const computed = await computeOptimalByPlatform(admin, tenantId);
  const settings = await loadSettings(admin, tenantId);
  const defaults = (settings?.optimal_time_defaults ?? {}) as Record<string, TimeSlot[]>;

  if (platform) {
    const slots = computed[platform]?.length ? computed[platform] : defaults[platform] ?? [];
    return createCorsResponse({ platform, slots, source: computed[platform]?.length ? 'historical' : 'default' }, 200, req);
  }
  return createCorsResponse({ optimal: computed, defaults }, 200, req);
}

async function smartSchedule(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = smartScheduleSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const from = parsed.data.start_at ? new Date(parsed.data.start_at) : new Date();
  const computed = await computeOptimalByPlatform(admin, tenantId);
  const settings = await loadSettings(admin, tenantId);
  const defaults = (settings?.optimal_time_defaults ?? {}) as Record<string, TimeSlot[]>;

  // Draft distributions to schedule.
  let q = admin
    .from('blog_distributions')
    .select('id, platform, scheduled_for, status')
    .eq('tenant_id', tenantId)
    .eq('post_id', parsed.data.post_id)
    .in('status', ['draft', 'scheduled']);
  const { data: dists } = await q;
  if (!dists || dists.length === 0) {
    return createCorsResponse({ error: 'No draft distributions to schedule.' }, 400, req);
  }
  const wanted = parsed.data.platforms;

  const scheduled: Array<{ id: string; platform: string; scheduled_for: string }> = [];
  // Track per-platform booked times for 2h conflict avoidance (within this run).
  const booked = new Map<string, number[]>();

  for (const d of dists) {
    if (wanted && !wanted.includes(d.platform)) continue;
    const slots = computed[d.platform]?.length ? computed[d.platform] : defaults[d.platform];
    // Fallback slot: next day 15:00 UTC if we have no model at all.
    const slot: TimeSlot = slots?.[0] ?? { dow: (from.getUTCDay() + 1) % 7, hour: 15, weight: 0 };

    let when = nextSlotDate(slot, from);
    // Conflict avoidance: bump by 24h until >2h from any booked time on the platform.
    const times = booked.get(d.platform) ?? [];
    let guard = 0;
    while (times.some((t) => Math.abs(t - when.getTime()) < 2 * 3600_000) && guard < 14) {
      when = new Date(when.getTime() + 24 * 3600_000);
      guard++;
    }
    times.push(when.getTime());
    booked.set(d.platform, times);

    await admin
      .from('blog_distributions')
      .update({ scheduled_for: when.toISOString(), status: 'scheduled', updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', d.id);
    scheduled.push({ id: d.id, platform: d.platform, scheduled_for: when.toISOString() });
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_scheduling.smart_schedule',
      targetType: 'blog_post',
      targetId: parsed.data.post_id,
      afterState: { scheduled: scheduled.length },
      summary: `Smart-scheduled ${scheduled.length} distributions`,
    }),
  );
  return createCorsResponse({ scheduled }, 200, req);
}

async function utm(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = utmSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const post = await postUrl(admin, tenantId, parsed.data.post_id);
  if (!post) return createCorsResponse({ error: 'Post not found' }, 404, req);

  const settings = await loadSettings(admin, tenantId);
  const template = (settings?.utm_template ?? null) as UtmTemplate | null;
  const tmpl: UtmTemplate | null = parsed.data.campaign
    ? { ...(template ?? {}), campaign: parsed.data.campaign }
    : template;

  // Platforms: explicit list, or every distribution on the post.
  let platforms = parsed.data.platforms;
  let distRows: Array<{ id: string; platform: string }> = [];
  if (!platforms) {
    const { data } = await admin
      .from('blog_distributions')
      .select('id, platform')
      .eq('tenant_id', tenantId)
      .eq('post_id', parsed.data.post_id);
    distRows = data ?? [];
    platforms = Array.from(new Set(distRows.map((d) => d.platform)));
  }

  const tagged: Record<string, { url: string; params: Record<string, string> }> = {};
  for (const platform of platforms) {
    tagged[platform] = buildUtmUrl({ baseUrl: post.url, platform, slug: post.slug, template: tmpl });
  }

  // Optionally persist utm_params + platform_post_url back to distribution rows.
  let written = 0;
  if (parsed.data.write) {
    if (distRows.length === 0) {
      const { data } = await admin
        .from('blog_distributions')
        .select('id, platform')
        .eq('tenant_id', tenantId)
        .eq('post_id', parsed.data.post_id);
      distRows = data ?? [];
    }
    for (const d of distRows) {
      const t = tagged[d.platform];
      if (!t) continue;
      await admin
        .from('blog_distributions')
        .update({ utm_params: t.params, platform_post_url: t.url, updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .eq('id', d.id);
      written++;
    }
    await writeAuditLog(
      admin,
      withRequestContext(req, {
        tenantId,
        actorUserId: userId,
        actorType: 'user',
        action: 'blog_scheduling.utm.write',
        targetType: 'blog_post',
        targetId: parsed.data.post_id,
        afterState: { written },
        summary: `Wrote UTM params to ${written} distributions`,
      }),
    );
  }

  return createCorsResponse({ tagged, written }, 200, req);
}

async function cadence(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = cadenceSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const post = await postUrl(admin, tenantId, parsed.data.post_id);
  if (!post) return createCorsResponse({ error: 'Post not found' }, 404, req);

  const settings = await loadSettings(admin, tenantId);
  const steps =
    (settings?.cadence_config as typeof DEFAULT_CADENCE | null) && Array.isArray(settings?.cadence_config)
      ? (settings!.cadence_config as typeof DEFAULT_CADENCE)
      : DEFAULT_CADENCE;
  const base = new Date(parsed.data.base_published_at ?? post.published_at ?? new Date().toISOString());
  const filterPlatforms = parsed.data.platforms;

  // Create a scheduled placeholder distribution per (step, platform). The
  // re-share variant copy is generated by blog-syndication when the slot nears;
  // here we lay down the schedule + cadence metadata.
  let created = 0;
  for (const step of steps) {
    const when = new Date(base.getTime() + step.offset_days * 24 * 3600_000);
    for (const platform of step.platforms) {
      if (filterPlatforms && !filterPlatforms.includes(platform)) continue;
      // Skip if a cadence row for this step+platform already exists.
      const { data: dupe } = await admin
        .from('blog_distributions')
        .select('id, reshare_cadence')
        .eq('tenant_id', tenantId)
        .eq('post_id', parsed.data.post_id)
        .eq('platform', platform)
        .eq('status', 'scheduled')
        .limit(50);
      const exists = (dupe ?? []).some(
        (r) => (r.reshare_cadence as { step?: number } | null)?.step === step.offset_days,
      );
      if (exists) continue;

      await admin.from('blog_distributions').insert({
        tenant_id: tenantId,
        post_id: parsed.data.post_id,
        platform,
        variant_type: 'reshare',
        status: 'scheduled',
        scheduled_for: when.toISOString(),
        reshare_cadence: {
          step: step.offset_days,
          label: step.label,
          base_published_at: base.toISOString(),
          paused: false,
        },
        created_by_user_id: userId,
      });
      created++;
    }
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_scheduling.cadence.create',
      targetType: 'blog_post',
      targetId: parsed.data.post_id,
      afterState: { created, steps: steps.length },
      summary: `Scheduled ${created} re-share slots`,
    }),
  );
  return createCorsResponse({ created }, 201, req);
}

async function pauseCadence(admin: Admin, tenantId: string, userId: string, postId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = pauseSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }

  // Future cadence rows for this post.
  const { data: rows } = await admin
    .from('blog_distributions')
    .select('id, reshare_cadence')
    .eq('tenant_id', tenantId)
    .eq('post_id', postId)
    .eq('variant_type', 'reshare')
    .eq('status', 'scheduled');
  let updated = 0;
  for (const r of rows ?? []) {
    const cad = (r.reshare_cadence ?? {}) as Record<string, unknown>;
    await admin
      .from('blog_distributions')
      .update({
        reshare_cadence: { ...cad, paused: parsed.data.paused },
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', r.id);
    updated++;
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_scheduling.cadence.pause',
      targetType: 'blog_post',
      targetId: postId,
      afterState: { paused: parsed.data.paused, updated },
      summary: `${parsed.data.paused ? 'Paused' : 'Resumed'} cadence on ${updated} slots`,
    }),
  );
  return createCorsResponse({ paused: parsed.data.paused, updated }, 200, req);
}

async function timeline(admin: Admin, tenantId: string, url: URL, req: Request) {
  const postId = url.searchParams.get('post_id');
  if (!postId) return createCorsResponse({ error: 'post_id is required' }, 400, req);
  const { data, error } = await admin
    .from('blog_distributions')
    .select('id, platform, variant_type, status, scheduled_for, published_at, reshare_cadence, engagement_metrics')
    .eq('tenant_id', tenantId)
    .eq('post_id', postId)
    .order('scheduled_for', { ascending: true, nullsFirst: false });
  if (error) return createCorsResponse({ error: error.message }, 500, req);

  const now = Date.now();
  const rows = data ?? [];
  const past = rows.filter(
    (r) => r.published_at || (r.scheduled_for && new Date(r.scheduled_for).getTime() < now),
  );
  const future = rows.filter(
    (r) => !r.published_at && r.scheduled_for && new Date(r.scheduled_for).getTime() >= now,
  );
  return createCorsResponse({ past, future, total: rows.length }, 200, req);
}
