// Blog On-Page A/B Experiments Edge Function (US-BLOG-064)
//
// Tests title / meta-description / CTA so improvements are measured, not assumed.
//   - title & meta_description: serving_mode='weekly_alternate' — the live value
//     alternates weekly; per-arm impressions/clicks are fed from Search Console
//     and CTR is compared. (Search Console attribution lags 2-3 days — callers
//     should feed metrics dated to before that lag.)
//   - cta: serving_mode='split' — the client assigns a variant by cookie and
//     reports conversions; conversion rate is compared.
// A two-proportion z-test surfaces the winner once each arm clears min_sample;
// the winner is promoted with editor approval (or auto-promoted when opted in).
//
// Routes (tenant-scoped, gated to blog.post.edit):
//   POST  /blog-experiments                 body: { post_id, element_type, variant_b,
//                                                   variant_a?, min_sample?, auto_promote? }
//   GET   /blog-experiments?post_id=&status=
//   GET   /blog-experiments/:id              experiment + freshly-computed significance
//   POST  /blog-experiments/:id/record      body: { variant: 'a'|'b', impressions?, clicks?,
//                                                   assignments?, conversions? }  (accumulates)
//   GET   /blog-experiments/:id/current      which variant serves now (weekly_alternate)
//   GET   /blog-experiments/:id/assign?visitor=  deterministic a|b for a visitor (split/CTA)
//   POST  /blog-experiments/:id/promote      promote the winner into the post (editor approval)
//   PATCH /blog-experiments/:id              body: { status }  pause/resume

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const createSchema = z.object({
  post_id: z.string().uuid(),
  element_type: z.enum(['title', 'meta_description', 'cta']),
  variant_b: z.union([z.string(), z.record(z.unknown())]),
  variant_a: z.union([z.string(), z.record(z.unknown())]).optional(),
  min_sample: z.number().int().min(10).max(100000).optional(),
  auto_promote: z.boolean().optional(),
});

const recordSchema = z.object({
  variant: z.enum(['a', 'b']),
  impressions: z.number().int().min(0).optional(),
  clicks: z.number().int().min(0).optional(),
  assignments: z.number().int().min(0).optional(),
  conversions: z.number().int().min(0).optional(),
});

function hasBlogPostEdit(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const perms = meta.permissions;
  if (Array.isArray(perms) && perms.includes('blog.post.edit')) return true;
  const role = String(meta.role ?? '').toLowerCase();
  return role === 'platform_admin' || role === 'super_admin' || role === 'company_admin';
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
    if (!hasBlogPostEdit(user)) {
      return createCorsResponse({ error: 'Forbidden: blog.post.edit required' }, 403, req);
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
    const { parts } = normalizePath(url.pathname, 'blog-experiments');
    const id = parts[0];
    const sub = parts[1];

    if (!id) {
      if (req.method === 'GET') return await list(admin, tenantId, url, req);
      if (req.method === 'POST') return await create(admin, tenantId, user.id, req);
    }
    if (id && !sub) {
      if (req.method === 'GET') return await getOne(admin, tenantId, id, req);
      if (req.method === 'PATCH') return await patch(admin, tenantId, user.id, id, req);
    }
    if (id && sub === 'record' && req.method === 'POST') {
      return await record(admin, tenantId, user.id, id, req);
    }
    if (id && sub === 'current' && req.method === 'GET') {
      return await current(admin, tenantId, id, req);
    }
    if (id && sub === 'assign' && req.method === 'GET') {
      return await assign(admin, tenantId, id, url, req);
    }
    if (id && sub === 'promote' && req.method === 'POST') {
      return await promote(admin, tenantId, user.id, id, req);
    }
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('blog-experiments handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

// ─── significance (two-proportion z-test) ──────────────────────────────────────
function normalCdf(z: number): number {
  // Abramowitz & Stegun 7.1.26 erf approximation.
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p =
    d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

interface Experiment {
  element_type: string;
  serving_mode: string;
  min_sample: number;
  a_impressions: number;
  a_clicks: number;
  a_assignments: number;
  a_conversions: number;
  b_impressions: number;
  b_clicks: number;
  b_assignments: number;
  b_conversions: number;
}

function computeSignificance(e: Experiment) {
  const isCta = e.element_type === 'cta';
  const metric = isCta ? 'conversion_rate' : 'ctr';
  const nA = isCta ? e.a_assignments : e.a_impressions;
  const nB = isCta ? e.b_assignments : e.b_impressions;
  const xA = isCta ? e.a_conversions : e.a_clicks;
  const xB = isCta ? e.b_conversions : e.b_clicks;

  const sampleOk = nA >= e.min_sample && nB >= e.min_sample;
  if (nA === 0 || nB === 0) {
    return { metric, a_rate: null, b_rate: null, z: null, p_value: null, significant: false, sample_ok: sampleOk, n_a: nA, n_b: nB };
  }
  const pA = xA / nA;
  const pB = xB / nB;
  const pooled = (xA + xB) / (nA + nB);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / nA + 1 / nB));
  const z = se > 0 ? (pB - pA) / se : 0;
  const pValue = 2 * (1 - normalCdf(Math.abs(z)));
  const significant = sampleOk && pValue < 0.05;
  return {
    metric,
    a_rate: Number(pA.toFixed(5)),
    b_rate: Number(pB.toFixed(5)),
    z: Number(z.toFixed(3)),
    p_value: Number(pValue.toFixed(4)),
    significant,
    sample_ok: sampleOk,
    n_a: nA,
    n_b: nB,
    leader: pB > pA ? 'b' : pB < pA ? 'a' : 'tie',
  };
}

function winnerFrom(sig: ReturnType<typeof computeSignificance>): 'a' | 'b' | 'none' {
  if (!sig.significant) return 'none';
  return sig.leader === 'b' ? 'b' : 'a';
}

// ─── create ───────────────────────────────────────────────────────────────────
async function create(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const d = parsed.data;

  const { data: post } = await admin
    .from('blog_posts')
    .select('id, title, meta_title, meta_description')
    .eq('tenant_id', tenantId)
    .eq('id', d.post_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!post) return createCorsResponse({ error: 'Post not found' }, 404, req);

  // Default variant A to the post's current value.
  let variantA = d.variant_a;
  if (variantA === undefined) {
    const cur =
      d.element_type === 'title'
        ? post.meta_title ?? post.title
        : d.element_type === 'meta_description'
          ? post.meta_description
          : null;
    variantA = { text: cur ?? '' };
  } else if (typeof variantA === 'string') {
    variantA = { text: variantA };
  }
  const variantB = typeof d.variant_b === 'string' ? { text: d.variant_b } : d.variant_b;
  const servingMode = d.element_type === 'cta' ? 'split' : 'weekly_alternate';

  const { data: created, error } = await admin
    .from('blog_experiments')
    .insert({
      tenant_id: tenantId,
      post_id: d.post_id,
      element_type: d.element_type,
      variant_a: variantA,
      variant_b: variantB,
      serving_mode: servingMode,
      min_sample: d.min_sample ?? 100,
      auto_promote: d.auto_promote ?? false,
      created_by_user_id: userId,
    })
    .select('*')
    .single();
  if (error || !created) {
    return createCorsResponse({ error: error?.message ?? 'Create failed' }, 500, req);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_experiment.create',
      targetType: 'blog_experiment',
      targetId: created.id,
      afterState: { element_type: d.element_type, serving_mode: servingMode },
      summary: `Started ${d.element_type} A/B test on post ${d.post_id}`,
    }),
  );
  return createCorsResponse({ experiment: created }, 201, req);
}

// ─── record metrics ─────────────────────────────────────────────────────────────
async function record(admin: Admin, tenantId: string, userId: string, id: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = recordSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const d = parsed.data;

  const { data: exp } = await admin
    .from('blog_experiments')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!exp) return createCorsResponse({ error: 'Experiment not found' }, 404, req);
  if (exp.status === 'completed') {
    return createCorsResponse({ error: 'Experiment already completed' }, 409, req);
  }

  const arm = d.variant;
  const patch: Record<string, number> = {};
  const add = (col: string, delta?: number) => {
    if (delta && delta > 0) patch[col] = (exp[col] ?? 0) + delta;
  };
  add(`${arm}_impressions`, d.impressions);
  add(`${arm}_clicks`, d.clicks);
  add(`${arm}_assignments`, d.assignments);
  add(`${arm}_conversions`, d.conversions);

  const merged = { ...exp, ...patch };
  const sig = computeSignificance(merged as Experiment);
  const winner = winnerFrom(sig);

  const update: Record<string, unknown> = {
    ...patch,
    significance: sig,
    winner,
    updated_at: new Date().toISOString(),
  };

  // Auto-promote when opted in and a significant winner emerges.
  let autoPromoted = false;
  if (exp.auto_promote && winner !== 'none') {
    await applyPromotion(admin, tenantId, merged, winner);
    update.status = 'completed';
    update.promoted_at = new Date().toISOString();
    update.approved_by_user_id = userId; // the opt-in flag stands as approval
    autoPromoted = true;
  }

  const { data: updated, error } = await admin
    .from('blog_experiments')
    .update(update)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select('*')
    .single();
  if (error || !updated) {
    return createCorsResponse({ error: error?.message ?? 'Update failed' }, 500, req);
  }

  if (autoPromoted) {
    await writeAuditLog(
      admin,
      withRequestContext(req, {
        tenantId,
        actorUserId: userId,
        actorType: 'user',
        action: 'blog_experiment.auto_promote',
        targetType: 'blog_experiment',
        targetId: id,
        afterState: { winner, significance: sig },
        summary: `Auto-promoted variant ${winner.toUpperCase()} for ${exp.element_type} (p=${sig.p_value})`,
      }),
    );
  }

  return createCorsResponse({ experiment: updated, significance: sig, auto_promoted: autoPromoted }, 200, req);
}

// ─── serving helpers ─────────────────────────────────────────────────────────────
async function current(admin: Admin, tenantId: string, id: string, req: Request) {
  const { data: exp } = await admin
    .from('blog_experiments')
    .select('id, element_type, serving_mode, status, variant_a, variant_b, started_at')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!exp) return createCorsResponse({ error: 'Experiment not found' }, 404, req);

  if (exp.serving_mode === 'split') {
    return createCorsResponse({ serving: 'split', note: 'Use /assign per visitor for split tests' }, 200, req);
  }
  // weekly_alternate: even weeks → A, odd weeks → B.
  const week = Math.floor((Date.now() - new Date(exp.started_at).getTime()) / ONE_WEEK_MS);
  const serving = week % 2 === 0 ? 'a' : 'b';
  return createCorsResponse(
    {
      serving,
      week,
      value: serving === 'a' ? exp.variant_a : exp.variant_b,
      status: exp.status,
    },
    200,
    req,
  );
}

function hashVisitor(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 2;
}

async function assign(admin: Admin, tenantId: string, id: string, url: URL, req: Request) {
  const visitor = url.searchParams.get('visitor');
  if (!visitor) return createCorsResponse({ error: 'visitor query param required' }, 400, req);
  const { data: exp } = await admin
    .from('blog_experiments')
    .select('id, status, variant_a, variant_b')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!exp) return createCorsResponse({ error: 'Experiment not found' }, 404, req);
  // Stable 50/50 assignment keyed by experiment + visitor.
  const arm = hashVisitor(`${id}:${visitor}`) === 0 ? 'a' : 'b';
  return createCorsResponse(
    { assignment: arm, value: arm === 'a' ? exp.variant_a : exp.variant_b, status: exp.status },
    200,
    req,
  );
}

// ─── promote / patch ──────────────────────────────────────────────────────────────
async function applyPromotion(
  admin: Admin,
  tenantId: string,
  exp: { post_id: string; element_type: string; variant_a: unknown; variant_b: unknown },
  winner: 'a' | 'b',
) {
  const value = winner === 'a' ? exp.variant_a : exp.variant_b;
  const text = (value as { text?: string })?.text ?? '';
  if (exp.element_type === 'title') {
    await admin
      .from('blog_posts')
      .update({ meta_title: text.slice(0, 200), updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', exp.post_id);
  } else if (exp.element_type === 'meta_description') {
    await admin
      .from('blog_posts')
      .update({ meta_description: text, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', exp.post_id);
  }
  // CTA winners are applied in the page's CTA block (managed outside the post row);
  // recording the winner here is sufficient for the editor to wire it up.
}

async function promote(admin: Admin, tenantId: string, userId: string, id: string, req: Request) {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const winnerOverride = (body as { winner?: 'a' | 'b' }).winner;

  const { data: exp } = await admin
    .from('blog_experiments')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!exp) return createCorsResponse({ error: 'Experiment not found' }, 404, req);

  const sig = computeSignificance(exp as Experiment);
  const winner = winnerOverride ?? winnerFrom(sig);
  if (winner === 'none') {
    return createCorsResponse(
      { error: 'No significant winner yet; pass {winner} to override', significance: sig },
      409,
      req,
    );
  }

  await applyPromotion(admin, tenantId, exp, winner);

  const { data: updated, error } = await admin
    .from('blog_experiments')
    .update({
      status: 'completed',
      winner,
      significance: sig,
      approved_by_user_id: userId,
      promoted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select('*')
    .single();
  if (error || !updated) {
    return createCorsResponse({ error: error?.message ?? 'Promote failed' }, 500, req);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_experiment.promote',
      targetType: 'blog_experiment',
      targetId: id,
      afterState: { winner, overridden: Boolean(winnerOverride), significance: sig },
      summary: `Promoted variant ${winner.toUpperCase()} for ${exp.element_type}`,
    }),
  );
  return createCorsResponse({ experiment: updated }, 200, req);
}

async function patch(admin: Admin, tenantId: string, userId: string, id: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = z.object({ status: z.enum(['running', 'paused', 'completed']) }).safeParse(body);
  if (!parsed.success) return createCorsResponse({ error: 'status required' }, 400, req);

  const { data: updated, error } = await admin
    .from('blog_experiments')
    .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .select('*')
    .single();
  if (error || !updated) {
    return createCorsResponse({ error: error?.message ?? 'Experiment not found' }, 404, req);
  }
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_experiment.status',
      targetType: 'blog_experiment',
      targetId: id,
      afterState: { status: parsed.data.status },
      summary: `Experiment ${id} → ${parsed.data.status}`,
    }),
  );
  return createCorsResponse({ experiment: updated }, 200, req);
}

// ─── list / get ────────────────────────────────────────────────────────────────
async function list(admin: Admin, tenantId: string, url: URL, req: Request) {
  let q = admin
    .from('blog_experiments')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(Math.min(Number(url.searchParams.get('limit') ?? 100), 300));
  const postId = url.searchParams.get('post_id');
  const status = url.searchParams.get('status');
  if (postId) q = q.eq('post_id', postId);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  return createCorsResponse({ experiments: data ?? [] }, 200, req);
}

async function getOne(admin: Admin, tenantId: string, id: string, req: Request) {
  const { data } = await admin
    .from('blog_experiments')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!data) return createCorsResponse({ error: 'Experiment not found' }, 404, req);
  const sig = computeSignificance(data as Experiment);
  return createCorsResponse({ experiment: data, significance: sig }, 200, req);
}
