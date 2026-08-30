// Blog Rank + Traffic Forecast Edge Function (US-BLOG-041)
//
// Predicts a rank range and monthly clicks before publishing so a strategist
// can decide whether a post is worth shipping or needs more work. The forecast
// is a deterministic, monotonic model over four inputs (keyword volume +
// difficulty, our domain authority, post quality, SERP competitiveness); an
// optional LLM call adds a one-paragraph rationale. After publish, /actuals
// backfills the real position + clicks so the model calibrates over time.
//
// Routes (tenant-scoped, gated to blog.post.edit):
//   POST /blog-rank-forecast/run      body: { post_id, keyword?, keyword_id?, search_volume?,
//                                            keyword_difficulty?, domain_authority?, quality_score?,
//                                            include_rationale? }
//   GET  /blog-rank-forecast/:postId  latest forecast
//   POST /blog-rank-forecast/actuals  body: { post_id }   backfill actuals from metrics
//
// Calibration only becomes reliable after ~50 published posts feed the model;
// until then confidence is capped accordingly.

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';
import { generateCompletionDetailed } from '../_shared/anthropic.ts';
import { logAiCost, getQuotaStatus, usdToCents } from '../_shared/blog/ai-cost.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const CALIBRATION_TARGET = 50; // posts with actuals needed for "high" confidence

const runSchema = z.object({
  post_id: z.string().uuid(),
  keyword: z.string().max(500).optional(),
  keyword_id: z.string().uuid().optional(),
  search_volume: z.number().int().min(0).optional(),
  keyword_difficulty: z.number().int().min(0).max(100).optional(),
  domain_authority: z.number().int().min(0).max(100).optional(),
  quality_score: z.number().min(0).max(100).optional(),
  include_rationale: z.boolean().optional(),
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
    const { parts } = normalizePath(url.pathname, 'blog-rank-forecast');
    const action = parts[0];

    if (action === 'run' && req.method === 'POST') {
      return await runForecast(admin, tenantId, user.id, req);
    }
    if (action === 'actuals' && req.method === 'POST') {
      return await backfillActuals(admin, tenantId, user.id, req);
    }
    if (action && req.method === 'GET') {
      return await latest(admin, tenantId, action, req);
    }
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('blog-rank-forecast handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

// ─── CTR-by-position curve (organic, desktop+mobile blended) ────────────────────
const CTR_CURVE: Record<number, number> = {
  1: 0.281,
  2: 0.157,
  3: 0.11,
  4: 0.08,
  5: 0.061,
  6: 0.047,
  7: 0.039,
  8: 0.032,
  9: 0.028,
  10: 0.025,
};
function ctrForPosition(pos: number): number {
  if (pos <= 10) return CTR_CURVE[Math.max(1, Math.round(pos))] ?? 0.025;
  if (pos <= 20) return 0.015;
  if (pos <= 30) return 0.008;
  if (pos <= 50) return 0.004;
  return 0.001;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

interface ForecastInputs {
  searchVolume: number;
  keywordDifficulty: number;
  domainAuthority: number;
  qualityScore: number;
  serpCompetitiveness: number;
}

interface ForecastOutput {
  predictedPosition: number;
  rankLow: number;
  rankHigh: number;
  predictedClicksMonth: number;
  recommendation: 'publish_now' | 'invest_originality' | 'build_links' | 'pivot_angle';
}

/**
 * Deterministic, monotonic forecast. Strength (DA + quality) is weighed against
 * competitiveness (difficulty blended with SERP signal). A bigger net deficit
 * pushes the predicted position down the page.
 */
function computeForecast(inp: ForecastInputs, calibrationFactor: number): ForecastOutput {
  const competitiveness = 0.7 * inp.keywordDifficulty + 0.3 * inp.serpCompetitiveness;
  const strength = 0.5 * inp.domainAuthority + 0.5 * inp.qualityScore;
  const net = competitiveness - strength; // -100..100

  let predictedPosition = clamp(12 + net * 0.25, 1, 100) * calibrationFactor;
  predictedPosition = clamp(predictedPosition, 1, 100);

  // Spread widens with competitiveness and narrows with strength.
  const spread = clamp(Math.round(2 + competitiveness / 18), 2, 12);
  const rankLow = clamp(Math.round(predictedPosition - spread), 1, 100);
  const rankHigh = clamp(Math.round(predictedPosition + spread), rankLow + 1, 100);

  const predictedClicksMonth = Math.round(inp.searchVolume * ctrForPosition(predictedPosition));

  let recommendation: ForecastOutput['recommendation'];
  if (net > 30) recommendation = 'pivot_angle';
  else if (inp.qualityScore < 50) recommendation = 'invest_originality';
  else if (inp.domainAuthority < 35 && net > 5) recommendation = 'build_links';
  else recommendation = 'publish_now';

  return {
    predictedPosition: Number(predictedPosition.toFixed(2)),
    rankLow,
    rankHigh,
    predictedClicksMonth,
    recommendation,
  };
}

const RECOMMENDATION_LABELS: Record<ForecastOutput['recommendation'], string> = {
  publish_now: 'Publish now',
  invest_originality: 'Invest in originality',
  build_links: 'Build internal links first',
  pivot_angle: 'Too competitive — pivot angle',
};

// ─── run ─────────────────────────────────────────────────────────────────────
async function runForecast(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = runSchema.safeParse(body);
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
    .select('id, title, seo_score, body_markdown')
    .eq('tenant_id', tenantId)
    .eq('id', d.post_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!post) return createCorsResponse({ error: 'Post not found' }, 404, req);

  // Resolve keyword metrics: explicit input > keyword_id row > keyword string row.
  let keyword = d.keyword ?? null;
  let searchVolume = d.search_volume ?? null;
  let difficulty = d.keyword_difficulty ?? null;
  if ((searchVolume == null || difficulty == null || !keyword) && (d.keyword_id || d.keyword)) {
    let kq = admin
      .from('blog_keywords')
      .select('keyword, search_volume, keyword_difficulty')
      .eq('tenant_id', tenantId)
      .limit(1);
    kq = d.keyword_id ? kq.eq('id', d.keyword_id) : kq.eq('keyword', d.keyword!);
    const { data: kw } = await kq.maybeSingle();
    if (kw) {
      keyword = keyword ?? kw.keyword;
      searchVolume = searchVolume ?? kw.search_volume;
      difficulty = difficulty ?? kw.keyword_difficulty;
    }
  }

  // SERP competitiveness from the latest snapshot's aggregate, if any.
  let serpCompetitiveness = difficulty ?? 50;
  if (keyword) {
    const { data: snap } = await admin
      .from('blog_serp_snapshots')
      .select('aggregate')
      .eq('tenant_id', tenantId)
      .eq('keyword', keyword)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const agg = snap?.aggregate as { median_word_count?: number } | undefined;
    if (agg?.median_word_count) {
      // Longer median content ⇒ more competitive SERP. Map 0–4000 words → 0–100.
      serpCompetitiveness = clamp((agg.median_word_count / 4000) * 100, 0, 100);
    }
  }

  // Domain authority: request override > workspace setting > default 30.
  const { data: settings } = await admin
    .from('blog_agent_settings')
    .select('domain_authority')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  const domainAuthority = d.domain_authority ?? settings?.domain_authority ?? 30;

  // Quality score: request > post.seo_score > neutral 60.
  const qualityScore = d.quality_score ?? (post.seo_score != null ? Number(post.seo_score) : 60);

  const inputs: ForecastInputs = {
    searchVolume: searchVolume ?? 0,
    keywordDifficulty: difficulty ?? 50,
    domainAuthority,
    qualityScore,
    serpCompetitiveness,
  };

  // Calibration: ratio of mean actual position to mean predicted position across
  // posts that already have actuals. Factor 1.0 until enough data accumulates.
  const calibration = await computeCalibration(admin, tenantId);

  const out = computeForecast(inputs, calibration.factor);

  const confidence = pickConfidence(inputs, searchVolume, difficulty, calibration.sampleSize);

  // Optional LLM rationale (cost-logged + quota-gated).
  let rationale: string | null = null;
  if (d.include_rationale !== false) {
    const quota = await getQuotaStatus(admin, tenantId);
    if (!quota.blocked) {
      rationale = await generateRationale(admin, tenantId, userId, d.post_id, {
        title: String(post.title),
        keyword,
        inputs,
        out,
      });
    }
  }

  const { data: forecast, error } = await admin
    .from('blog_rank_forecasts')
    .insert({
      tenant_id: tenantId,
      post_id: d.post_id,
      keyword,
      search_volume: inputs.searchVolume,
      keyword_difficulty: inputs.keywordDifficulty,
      domain_authority: inputs.domainAuthority,
      quality_score: inputs.qualityScore,
      serp_competitiveness: Number(serpCompetitiveness.toFixed(2)),
      predicted_rank_low: out.rankLow,
      predicted_rank_high: out.rankHigh,
      predicted_position: out.predictedPosition,
      predicted_clicks_month: out.predictedClicksMonth,
      confidence,
      recommendation: out.recommendation,
      rationale,
      inputs,
      calibration,
      checked_at: new Date().toISOString(),
      created_by_user_id: userId,
    })
    .select('*')
    .single();
  if (error || !forecast) {
    return createCorsResponse({ error: error?.message ?? 'Failed to save forecast' }, 500, req);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_rank_forecast.run',
      targetType: 'blog_post',
      targetId: d.post_id,
      afterState: {
        predicted_rank: `${out.rankLow}-${out.rankHigh}`,
        clicks_month: out.predictedClicksMonth,
        recommendation: out.recommendation,
      },
      summary: `Forecast for "${post.title}": rank ${out.rankLow}-${out.rankHigh}, ~${out.predictedClicksMonth} clicks/mo → ${RECOMMENDATION_LABELS[out.recommendation]}`,
    }),
  );

  return createCorsResponse(
    { forecast, recommendation_label: RECOMMENDATION_LABELS[out.recommendation] },
    201,
    req,
  );
}

function pickConfidence(
  inp: ForecastInputs,
  volume: number | null,
  difficulty: number | null,
  sampleSize: number,
): 'low' | 'medium' | 'high' {
  const haveInputs = volume != null && difficulty != null;
  if (!haveInputs) return 'low';
  if (sampleSize >= CALIBRATION_TARGET) return 'high';
  if (sampleSize >= 10) return 'medium';
  return 'low';
}

async function computeCalibration(
  admin: Admin,
  tenantId: string,
): Promise<{ sampleSize: number; factor: number; note: string }> {
  const { data } = await admin
    .from('blog_rank_forecasts')
    .select('predicted_position, actual_position')
    .eq('tenant_id', tenantId)
    .not('actual_position', 'is', null)
    .limit(500);
  const rows = (data ?? []).filter(
    (r) =>
      r.predicted_position != null && r.actual_position != null && Number(r.predicted_position) > 0,
  );
  if (rows.length === 0) {
    return {
      sampleSize: 0,
      factor: 1,
      note: 'No post-publish actuals yet; factor=1 (uncalibrated).',
    };
  }
  const ratios = rows.map((r) => Number(r.actual_position) / Number(r.predicted_position));
  const mean = ratios.reduce((s, x) => s + x, 0) / ratios.length;
  // Clamp the correction so a few outliers can't wildly skew predictions.
  const factor = clamp(mean, 0.5, 2);
  return {
    sampleSize: rows.length,
    factor: Number(factor.toFixed(3)),
    note: `Calibrated against ${rows.length} published post(s).`,
  };
}

async function generateRationale(
  admin: Admin,
  tenantId: string,
  userId: string,
  postId: string,
  ctx: { title: string; keyword: string | null; inputs: ForecastInputs; out: ForecastOutput },
): Promise<string | null> {
  try {
    const res = await generateCompletionDetailed({
      max_tokens: 400,
      temperature: 0.4,
      system:
        'You are an SEO strategist. In 3-4 sentences, explain the forecast and the recommendation. Be concrete and honest about uncertainty. No preamble.',
      messages: [
        {
          role: 'user',
          content: `Post: "${ctx.title}"\nKeyword: ${ctx.keyword ?? 'n/a'}\nInputs: volume=${ctx.inputs.searchVolume}, difficulty=${ctx.inputs.keywordDifficulty}, domain_authority=${ctx.inputs.domainAuthority}, quality=${ctx.inputs.qualityScore}, serp_competitiveness=${ctx.inputs.serpCompetitiveness.toFixed(0)}\nForecast: rank ${ctx.out.rankLow}-${ctx.out.rankHigh}, ~${ctx.out.predictedClicksMonth} clicks/mo\nRecommendation: ${RECOMMENDATION_LABELS[ctx.out.recommendation]}\n\nExplain why.`,
        },
      ],
    });
    await logAiCost(admin, {
      tenantId,
      provider: 'anthropic',
      model: 'anthropic',
      feature: 'rank_forecast.rationale',
      promptTokens: res.usage.inputTokens,
      completionTokens: res.usage.outputTokens,
      costCents: usdToCents(res.usage.costUsd),
      postId,
      userId,
    });
    return res.text.trim();
  } catch (err) {
    console.error('rationale generation failed', err);
    return null;
  }
}

// ─── actuals backfill (calibration) ────────────────────────────────────────────
async function backfillActuals(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = z.object({ post_id: z.string().uuid() }).safeParse(body);
  if (!parsed.success) return createCorsResponse({ error: 'post_id (uuid) required' }, 400, req);
  const { post_id } = parsed.data;

  const { data: forecast } = await admin
    .from('blog_rank_forecasts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('post_id', post_id)
    .order('checked_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!forecast) return createCorsResponse({ error: 'No forecast to calibrate' }, 404, req);

  // Pull the last 28 days of search_console metrics for this post.
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 28);
  const { data: metrics } = await admin
    .from('blog_performance_metrics')
    .select('position, clicks, impressions')
    .eq('tenant_id', tenantId)
    .eq('post_id', post_id)
    .in('source', ['search_console', 'gsc'])
    .gte('metric_date', since.toISOString().slice(0, 10));
  const rows = metrics ?? [];
  if (rows.length === 0) {
    return createCorsResponse({ error: 'No search performance data yet for this post' }, 409, req);
  }

  let posWeight = 0;
  let imprSum = 0;
  let posSimple = 0;
  let clicksSum = 0;
  for (const m of rows) {
    clicksSum += m.clicks ?? 0;
    if (m.position != null) {
      const impr = m.impressions ?? 0;
      if (impr > 0) {
        posWeight += Number(m.position) * impr;
        imprSum += impr;
      }
      posSimple += Number(m.position);
    }
  }
  const actualPosition = imprSum > 0 ? posWeight / imprSum : posSimple / rows.length;
  // Scale 28d clicks to a monthly figure.
  const actualClicksMonth = Math.round((clicksSum / 28) * 30);

  const { data: updated, error } = await admin
    .from('blog_rank_forecasts')
    .update({
      actual_position: Number(actualPosition.toFixed(2)),
      actual_clicks_month: actualClicksMonth,
      actuals_updated_at: new Date().toISOString(),
    })
    .eq('id', forecast.id)
    .eq('tenant_id', tenantId)
    .select('*')
    .single();
  if (error || !updated) {
    return createCorsResponse({ error: error?.message ?? 'Update failed' }, 500, req);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_rank_forecast.actuals',
      targetType: 'blog_post',
      targetId: post_id,
      afterState: {
        actual_position: updated.actual_position,
        actual_clicks_month: actualClicksMonth,
      },
      summary: `Backfilled actuals: position ${updated.actual_position}, ~${actualClicksMonth} clicks/mo`,
    }),
  );

  return createCorsResponse({ forecast: updated }, 200, req);
}

// ─── latest ───────────────────────────────────────────────────────────────────
async function latest(admin: Admin, tenantId: string, postId: string, req: Request) {
  const { data } = await admin
    .from('blog_rank_forecasts')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('post_id', postId)
    .order('checked_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return createCorsResponse({ forecast: null }, 200, req);
  return createCorsResponse(
    {
      forecast: data,
      recommendation_label:
        RECOMMENDATION_LABELS[data.recommendation as ForecastOutput['recommendation']] ??
        data.recommendation,
    },
    200,
    req,
  );
}
