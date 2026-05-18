// Blog Keywords Edge Function (US-BLOG-014)
//
// Lists keywords with intent filtering and runs the LLM search-intent
// classifier in bulk. Intent is cached on `blog_keywords.intent`; the
// confidence + reasoning + timestamp are persisted into `raw_data.intent_meta`
// (no schema migration required — `raw_data` is already jsonb).
//
// Routes (gated to platform admin OR users holding blog.post.edit):
//   GET   /blog-keywords?intent=&search=&source_type=&cluster_id=&unclassified=&limit=&offset=
//                                       list keywords (newest first), paginated
//                                       returns { keywords, total, intent_counts }
//   POST  /blog-keywords/classify       body: { keyword_ids?: string[], only_unclassified?: boolean,
//                                               use_serp?: boolean, limit?: number }
//                                       bulk-classify; SERP context pulled from the latest
//                                       blog_serp_snapshots row per keyword when use_serp (default true)
//                                       returns { classified, results[], skipped }
//   PATCH /blog-keywords/:id            body: { intent }  manual override
//
// All mutations write to blog_audit_log.

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';
import {
  classifyIntent,
  INTENTS,
  type SearchIntent,
  type SerpContextItem,
} from '../_shared/blog/keyword/intent-classifier.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const MAX_CLASSIFY_BATCH = 100;

const classifySchema = z.object({
  keyword_ids: z.array(z.string().uuid()).max(MAX_CLASSIFY_BATCH).optional(),
  only_unclassified: z.boolean().optional(),
  use_serp: z.boolean().optional(),
  limit: z.number().int().min(1).max(MAX_CLASSIFY_BATCH).optional(),
});

const patchSchema = z.object({
  intent: z.enum(INTENTS),
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
    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'blog-keywords');
    const first = parts[0];

    if (!first && req.method === 'GET') {
      return await listKeywords(admin, tenantId, url, req);
    }
    if (first === 'classify' && req.method === 'POST') {
      return await classifyBatch(admin, tenantId, user.id, req);
    }
    if (first && first !== 'classify' && req.method === 'PATCH') {
      return await patchIntent(admin, tenantId, user.id, first, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('blog-keywords handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

async function listKeywords(admin: Admin, tenantId: string, url: URL, req: Request) {
  const params = url.searchParams;
  const intent = params.get('intent');
  const search = params.get('search');
  const sourceType = params.get('source_type');
  const clusterId = params.get('cluster_id');
  const unclassified = params.get('unclassified') === 'true';
  const limit = Math.min(Math.max(Number(params.get('limit')) || 50, 1), 200);
  const offset = Math.max(Number(params.get('offset')) || 0, 0);

  let query = admin
    .from('blog_keywords')
    .select(
      'id, keyword, search_volume, keyword_difficulty, cpc, intent, cluster_id, source_type, raw_data, updated_at',
      { count: 'exact' },
    )
    .eq('tenant_id', tenantId);

  if (intent && (INTENTS as readonly string[]).includes(intent)) {
    query = query.eq('intent', intent);
  }
  if (unclassified) query = query.is('intent', null);
  if (search) query = query.ilike('keyword', `%${search}%`);
  if (sourceType) query = query.eq('source_type', sourceType);
  if (clusterId) query = query.eq('cluster_id', clusterId);

  const { data, error, count } = await query
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return createCorsResponse({ error: error.message }, 500, req);
  }

  // Per-intent counts for the filter chips (tenant-wide, ignores paging).
  const intentCounts: Record<string, number> = {};
  for (const i of INTENTS) {
    const { count: c } = await admin
      .from('blog_keywords')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('intent', i);
    intentCounts[i] = c ?? 0;
  }
  const { count: unclassifiedCount } = await admin
    .from('blog_keywords')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .is('intent', null);
  intentCounts.unclassified = unclassifiedCount ?? 0;

  const keywords = (data ?? []).map((row) => {
    const meta = ((row.raw_data ?? {}) as Record<string, unknown>).intent_meta as
      | Record<string, unknown>
      | undefined;
    return {
      id: row.id,
      keyword: row.keyword,
      search_volume: row.search_volume,
      keyword_difficulty: row.keyword_difficulty,
      cpc: row.cpc,
      intent: row.intent as string | null,
      cluster_id: row.cluster_id,
      source_type: row.source_type,
      updated_at: row.updated_at,
      intent_confidence: meta ? ((meta.confidence as number | undefined) ?? null) : null,
      intent_reasoning: meta ? ((meta.reasoning as string | undefined) ?? null) : null,
      intent_serp_informed: meta ? ((meta.serp_informed as boolean | undefined) ?? null) : null,
      intent_classified_at: meta ? ((meta.classified_at as string | undefined) ?? null) : null,
    };
  });

  return createCorsResponse(
    { keywords, total: count ?? keywords.length, intent_counts: intentCounts },
    200,
    req,
  );
}

/**
 * Pull the top organic results (title + snippet) from the most recent SERP
 * snapshot for a keyword. Returns [] when no snapshot exists.
 */
async function getSerpContext(
  admin: Admin,
  tenantId: string,
  keyword: string,
): Promise<SerpContextItem[]> {
  const { data } = await admin
    .from('blog_serp_snapshots')
    .select('organic_results, fetched_at')
    .eq('tenant_id', tenantId)
    .eq('keyword', keyword)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.organic_results) return [];
  const organic = data.organic_results as Array<{
    rank?: number;
    title?: string;
    description?: string | null;
  }>;
  return organic
    .slice(0, 10)
    .map((o, i) => ({
      rank: typeof o.rank === 'number' ? o.rank : i + 1,
      title: String(o.title ?? ''),
      description: o.description ?? null,
    }))
    .filter((o) => o.title.length > 0);
}

async function classifyBatch(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }

  const parsed = classifySchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }

  const useSerp = parsed.data.use_serp ?? true;
  const limit = parsed.data.limit ?? MAX_CLASSIFY_BATCH;

  let selectQuery = admin
    .from('blog_keywords')
    .select('id, keyword, intent, raw_data')
    .eq('tenant_id', tenantId);

  if (parsed.data.keyword_ids && parsed.data.keyword_ids.length > 0) {
    selectQuery = selectQuery.in('id', parsed.data.keyword_ids);
  }
  if (parsed.data.only_unclassified ?? !parsed.data.keyword_ids) {
    selectQuery = selectQuery.is('intent', null);
  }

  const { data: rows, error } = await selectQuery
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    return createCorsResponse({ error: error.message }, 500, req);
  }
  if (!rows || rows.length === 0) {
    return createCorsResponse({ classified: 0, results: [], skipped: 0 }, 200, req);
  }

  const results: Array<{
    id: string;
    keyword: string;
    intent: SearchIntent;
    confidence: number;
    serp_informed: boolean;
  }> = [];
  let skipped = 0;

  for (const row of rows) {
    try {
      const serp = useSerp ? await getSerpContext(admin, tenantId, row.keyword) : [];
      const classification = await classifyIntent(row.keyword, serp);
      const classifiedAt = new Date().toISOString();
      const rawData = (row.raw_data ?? {}) as Record<string, unknown>;
      rawData.intent_meta = {
        confidence: classification.confidence,
        reasoning: classification.reasoning,
        serp_informed: classification.serp_informed,
        classified_at: classifiedAt,
        classified_by_user_id: userId,
      };

      const { error: updErr } = await admin
        .from('blog_keywords')
        .update({
          intent: classification.intent,
          raw_data: rawData,
          updated_at: classifiedAt,
        })
        .eq('tenant_id', tenantId)
        .eq('id', row.id);

      if (updErr) {
        skipped++;
        continue;
      }

      results.push({
        id: row.id,
        keyword: row.keyword,
        intent: classification.intent,
        confidence: classification.confidence,
        serp_informed: classification.serp_informed,
      });
    } catch (err) {
      console.error('classify keyword failed', row.keyword, err);
      skipped++;
    }
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_keyword.classify_intent',
      targetType: 'blog_keywords',
      targetId: null,
      summary: `Classified search intent for ${results.length} keyword(s)${
        skipped ? ` (${skipped} skipped)` : ''
      }${useSerp ? ' with SERP context' : ''}`,
    }),
  );

  return createCorsResponse({ classified: results.length, results, skipped }, 200, req);
}

async function patchIntent(
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

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }

  const { data: existing, error: readErr } = await admin
    .from('blog_keywords')
    .select('id, keyword, intent, raw_data')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle();

  if (readErr) {
    return createCorsResponse({ error: readErr.message }, 500, req);
  }
  if (!existing) {
    return createCorsResponse({ error: 'Keyword not found' }, 404, req);
  }

  const classifiedAt = new Date().toISOString();
  const rawData = (existing.raw_data ?? {}) as Record<string, unknown>;
  rawData.intent_meta = {
    confidence: 1,
    reasoning: 'Manual override by an editor.',
    serp_informed: false,
    classified_at: classifiedAt,
    classified_by_user_id: userId,
    manual: true,
  };

  const { data: updated, error: updErr } = await admin
    .from('blog_keywords')
    .update({ intent: parsed.data.intent, raw_data: rawData, updated_at: classifiedAt })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select('id, keyword, intent')
    .single();

  if (updErr || !updated) {
    return createCorsResponse({ error: updErr?.message ?? 'Failed to update intent' }, 500, req);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_keyword.set_intent',
      targetType: 'blog_keywords',
      targetId: id,
      beforeState: { intent: existing.intent },
      afterState: { intent: updated.intent },
      summary: `Set intent of "${existing.keyword}" to ${parsed.data.intent} (manual override)`,
    }),
  );

  return createCorsResponse({ keyword: updated }, 200, req);
}
