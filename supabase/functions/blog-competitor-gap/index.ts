// Blog Competitor Gap Analysis Edge Function (US-BLOG-018)
//
// Pulls the keyword sets that each configured competitor ranks for, along
// with the workspace's own domain, and surfaces gaps where competitors rank
// in the top 10 but the workspace does not.
//
// Routes (gated to platform admin OR users holding blog.post.edit):
//   GET   /blog-competitor-gap/settings        returns { own_domain, competitor_domains }
//   PATCH /blog-competitor-gap/settings        body: { own_domain?, competitor_domains? }
//   POST  /blog-competitor-gap/scan            body: { location_code?, language_code?, limit?, max_rank? }
//                                              fans out adapter.rankedKeywords across own + competitors
//                                              upserts into blog_competitor_keywords (replaces prior rows for that tenant+domain)
//                                              returns { domains, total_keywords, cost_cents, errors }
//   GET   /blog-competitor-gap/gaps?intent=&min_volume=&max_difficulty=&min_competitors=
//                                              returns gap keywords (competitor top-10 / own > 10 or absent)
//   POST  /blog-competitor-gap/create-cluster  body: { name, keywords: string[] }
//                                              creates a new blog_keyword_clusters row + links keywords;
//                                              keywords get source_type='gap_analysis'
//
// All mutations write to blog_audit_log.

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';
import { decryptCredential, type EncryptedCredential } from '../_shared/credential-vault.ts';
import { getKeywordAdapter, type KeywordCredentials } from '../_shared/blog/keyword/index.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const settingsPatchSchema = z.object({
  own_domain: z.string().max(255).nullable().optional(),
  competitor_domains: z.array(z.string().min(2).max(255)).max(20).nullable().optional(),
});

const scanSchema = z.object({
  location_code: z.number().int().optional(),
  language_code: z.string().min(2).max(16).optional(),
  limit: z.number().int().min(10).max(1000).optional(),
  max_rank: z.number().int().min(1).max(100).optional(),
});

const createClusterSchema = z.object({
  name: z.string().min(1).max(200),
  keywords: z.array(z.string().min(1).max(500)).min(1).max(500),
});

interface EncryptedKeywordConfig {
  base_url?: string | null;
  api_key: EncryptedCredential;
  api_secret?: EncryptedCredential | null;
}

interface CompetitorKeywordRow {
  domain: string;
  is_own: boolean;
  keyword: string;
  rank: number | null;
  search_volume: number | null;
  keyword_difficulty: number | null;
  cpc: number | null;
  intent: string | null;
}

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
    const { parts } = normalizePath(url.pathname, 'blog-competitor-gap');
    const action = parts[0];

    if (action === 'settings' && req.method === 'GET') {
      return await getSettings(admin, tenantId, req);
    }
    if (action === 'settings' && req.method === 'PATCH') {
      return await patchSettings(admin, tenantId, user.id, req);
    }
    if (action === 'scan' && req.method === 'POST') {
      return await scan(admin, tenantId, user.id, req);
    }
    if (action === 'gaps' && req.method === 'GET') {
      return await listGaps(admin, tenantId, url, req);
    }
    if (action === 'create-cluster' && req.method === 'POST') {
      return await createCluster(admin, tenantId, user.id, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('blog-competitor-gap handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

async function getSettings(admin: Admin, tenantId: string, req: Request) {
  const { data } = await admin
    .from('blog_agent_settings')
    .select('own_domain, competitor_domains')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return createCorsResponse(
    {
      settings: {
        own_domain: data?.own_domain ?? null,
        competitor_domains: data?.competitor_domains ?? [],
      },
    },
    200,
    req,
  );
}

async function patchSettings(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = settingsPatchSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }

  // Ensure a settings row exists for this tenant, then update.
  const { data: existing } = await admin
    .from('blog_agent_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('own_domain' in parsed.data) patch.own_domain = parsed.data.own_domain ?? null;
  if ('competitor_domains' in parsed.data) {
    patch.competitor_domains = (parsed.data.competitor_domains ?? []).map(cleanDomain);
  }

  let updated;
  if (existing) {
    const { data, error } = await admin
      .from('blog_agent_settings')
      .update(patch)
      .eq('tenant_id', tenantId)
      .select('own_domain, competitor_domains')
      .single();
    if (error) return createCorsResponse({ error: error.message }, 500, req);
    updated = data;
  } else {
    const { data, error } = await admin
      .from('blog_agent_settings')
      .insert({ tenant_id: tenantId, ...patch })
      .select('own_domain, competitor_domains')
      .single();
    if (error) return createCorsResponse({ error: error.message }, 500, req);
    updated = data;
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_gap.settings.update',
      targetType: 'blog_agent_settings',
      targetId: null,
      beforeState: existing
        ? { own_domain: existing.own_domain, competitor_domains: existing.competitor_domains }
        : null,
      afterState: updated,
      summary: `Updated gap analysis settings (own=${updated.own_domain ?? '∅'}, ${(updated.competitor_domains ?? []).length} competitors)`,
    }),
  );

  return createCorsResponse({ settings: updated }, 200, req);
}

async function scan(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown = {};
  try {
    body = (await req.json().catch(() => ({}))) ?? {};
  } catch {
    body = {};
  }
  const parsed = scanSchema.safeParse(body);
  const opts = parsed.success ? parsed.data : {};

  // Resolve settings
  const { data: settings } = await admin
    .from('blog_agent_settings')
    .select('own_domain, competitor_domains')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!settings?.own_domain) {
    return createCorsResponse(
      { error: 'own_domain is not configured. PATCH /blog-competitor-gap/settings first.' },
      400,
      req,
    );
  }
  const competitors = (settings.competitor_domains ?? []) as string[];
  if (competitors.length === 0) {
    return createCorsResponse(
      { error: 'No competitor_domains configured. PATCH /blog-competitor-gap/settings first.' },
      400,
      req,
    );
  }

  // Resolve adapter creds
  const { data: target } = await admin
    .from('blog_distribution_targets')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('platform', 'dataforseo')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!target) {
    return createCorsResponse(
      {
        error:
          'No active dataforseo keyword target. Configure at /platform-admin/blog/settings/keyword-targets.',
      },
      400,
      req,
    );
  }
  const adapter = getKeywordAdapter(target.platform);
  if (!adapter?.rankedKeywords) {
    return createCorsResponse(
      { error: `Adapter "${target.platform}" does not support rankedKeywords` },
      400,
      req,
    );
  }

  const config = (target.encrypted_config ?? {}) as Partial<EncryptedKeywordConfig>;
  if (!config.api_key) {
    return createCorsResponse({ error: 'Keyword target is missing api_key' }, 400, req);
  }
  let creds: KeywordCredentials;
  try {
    creds = {
      apiKey: await decryptCredential(config.api_key),
      apiSecret: config.api_secret ? await decryptCredential(config.api_secret) : undefined,
      baseUrl: config.base_url ?? undefined,
    };
  } catch (err) {
    return createCorsResponse(
      { error: `Credential decryption failed: ${err instanceof Error ? err.message : 'unknown'}` },
      500,
      req,
    );
  }

  const domains: Array<{ domain: string; is_own: boolean }> = [
    { domain: settings.own_domain, is_own: true },
    ...competitors.map((d) => ({ domain: d, is_own: false })),
  ];

  let totalKeywords = 0;
  let totalCostCents = 0;
  const errors: string[] = [];
  const domainsSummary: Array<{
    domain: string;
    keywords: number;
    cost_cents: number;
    error?: string;
  }> = [];

  for (const d of domains) {
    try {
      const result = await adapter.rankedKeywords!(creds, d.domain, {
        location_code: opts.location_code,
        language_code: opts.language_code,
        limit: opts.limit ?? 1000,
        max_rank: opts.max_rank ?? 100,
      });
      totalCostCents += result.cost?.cents ?? 0;

      // Replace this tenant's prior rows for this domain in one shot.
      await admin
        .from('blog_competitor_keywords')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('domain', d.domain);

      if (result.keywords.length > 0) {
        // Dedup within the batch by keyword (the API can return synonyms).
        const seen = new Set<string>();
        const rows = [];
        for (const k of result.keywords) {
          const key = k.keyword.toLowerCase().trim();
          if (!key || seen.has(key)) continue;
          seen.add(key);
          rows.push({
            tenant_id: tenantId,
            domain: d.domain,
            is_own: d.is_own,
            keyword: k.keyword,
            rank: k.rank,
            search_volume: k.search_volume,
            keyword_difficulty: k.keyword_difficulty,
            cpc: k.cpc,
            intent: k.intent,
            source_adapter: target.platform,
            raw_data: { url: k.url },
          });
        }
        if (rows.length > 0) {
          // Insert in batches of 500 to stay under PostgREST default request size.
          for (let i = 0; i < rows.length; i += 500) {
            const batch = rows.slice(i, i + 500);
            const { error } = await admin.from('blog_competitor_keywords').insert(batch);
            if (error) throw new Error(error.message);
          }
        }
        totalKeywords += rows.length;
        domainsSummary.push({
          domain: d.domain,
          keywords: rows.length,
          cost_cents: result.cost?.cents ?? 0,
        });
      } else {
        domainsSummary.push({ domain: d.domain, keywords: 0, cost_cents: result.cost?.cents ?? 0 });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      errors.push(`${d.domain}: ${msg}`);
      domainsSummary.push({ domain: d.domain, keywords: 0, cost_cents: 0, error: msg });
    }
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_gap.scan',
      targetType: 'blog_competitor_keywords',
      targetId: null,
      afterState: {
        domains: domainsSummary,
        total_keywords: totalKeywords,
        cost_cents: totalCostCents,
        errors,
      },
      summary: `Scanned ${domains.length} domain(s), ${totalKeywords} keywords (${totalCostCents}¢)${errors.length ? `, ${errors.length} error(s)` : ''}`,
    }),
  );

  return createCorsResponse(
    {
      domains: domainsSummary,
      total_keywords: totalKeywords,
      cost_cents: totalCostCents,
      errors,
    },
    200,
    req,
  );
}

async function listGaps(admin: Admin, tenantId: string, url: URL, req: Request) {
  const params = url.searchParams;
  const intent = params.get('intent');
  const minVolume = params.get('min_volume') ? parseInt(params.get('min_volume')!, 10) : null;
  const maxDifficulty = params.get('max_difficulty')
    ? parseInt(params.get('max_difficulty')!, 10)
    : null;
  const minCompetitors = params.get('min_competitors')
    ? parseInt(params.get('min_competitors')!, 10)
    : 1;
  const ownMinRank = params.get('own_min_rank') ? parseInt(params.get('own_min_rank')!, 10) : 11; // "we don't rank top 10"

  // Pull all competitor rows for the tenant — gap computation is in-process
  // since the result set is bounded by competitor count × ~1000 rows.
  let query = admin
    .from('blog_competitor_keywords')
    .select('domain, is_own, keyword, rank, search_volume, keyword_difficulty, cpc, intent')
    .eq('tenant_id', tenantId);
  if (intent) query = query.eq('intent', intent);

  const { data: rows, error } = await query;
  if (error) return createCorsResponse({ error: error.message }, 500, req);

  // Build keyword → { own_rank, competitor_ranks: Map<domain, rank> }
  const map = new Map<
    string,
    {
      keyword: string;
      own_rank: number | null;
      competitor_ranks: Record<string, number | null>;
      search_volume: number | null;
      keyword_difficulty: number | null;
      cpc: number | null;
      intent: string | null;
    }
  >();
  for (const r of (rows ?? []) as CompetitorKeywordRow[]) {
    const key = r.keyword.toLowerCase().trim();
    if (!key) continue;
    let entry = map.get(key);
    if (!entry) {
      entry = {
        keyword: r.keyword,
        own_rank: null,
        competitor_ranks: {},
        search_volume: null,
        keyword_difficulty: null,
        cpc: null,
        intent: null,
      };
      map.set(key, entry);
    }
    if (r.is_own) {
      entry.own_rank = r.rank;
    } else {
      entry.competitor_ranks[r.domain] = r.rank;
    }
    // Fold metric fields — prefer competitor data since DFS rank_keywords is
    // more reliable for the absolute volume than our own domain's row.
    if (entry.search_volume === null && r.search_volume !== null)
      entry.search_volume = r.search_volume;
    if (entry.keyword_difficulty === null && r.keyword_difficulty !== null)
      entry.keyword_difficulty = r.keyword_difficulty;
    if (entry.cpc === null && r.cpc !== null) entry.cpc = r.cpc;
    if (!entry.intent && r.intent) entry.intent = r.intent;
  }

  // Gap criteria: competitor rank ≤ 10 on N+ competitors AND own_rank > ownMinRank (or null)
  const gaps = [];
  for (const entry of map.values()) {
    if (minVolume !== null && (entry.search_volume ?? 0) < minVolume) continue;
    if (maxDifficulty !== null && (entry.keyword_difficulty ?? 999) > maxDifficulty) continue;
    if (entry.own_rank !== null && entry.own_rank < ownMinRank) continue;

    const competingTop10 = Object.values(entry.competitor_ranks).filter(
      (r): r is number => typeof r === 'number' && r <= 10,
    );
    if (competingTop10.length < minCompetitors) continue;

    // Easy-win heuristic: competitor rank is high but volume is low-medium.
    const minCompetitorRank = Math.min(...competingTop10);
    const easyWinScore =
      (entry.search_volume ?? 0) > 0 && minCompetitorRank <= 5
        ? Math.round(
            ((entry.search_volume ?? 0) / Math.max(1, entry.keyword_difficulty ?? 50)) * 10,
          )
        : 0;

    gaps.push({
      keyword: entry.keyword,
      own_rank: entry.own_rank,
      competitor_ranks: entry.competitor_ranks,
      best_competitor_rank: minCompetitorRank,
      ranking_competitors: competingTop10.length,
      search_volume: entry.search_volume,
      keyword_difficulty: entry.keyword_difficulty,
      cpc: entry.cpc,
      intent: entry.intent,
      easy_win_score: easyWinScore,
    });
  }

  // Sort: easy wins first, then by volume desc.
  gaps.sort((a, b) => {
    if (b.easy_win_score !== a.easy_win_score) return b.easy_win_score - a.easy_win_score;
    return (b.search_volume ?? 0) - (a.search_volume ?? 0);
  });

  return createCorsResponse({ gaps, total: gaps.length }, 200, req);
}

async function createCluster(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = createClusterSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const { name, keywords } = parsed.data;

  const { data: cluster, error: clusterErr } = await admin
    .from('blog_keyword_clusters')
    .insert({
      tenant_id: tenantId,
      name,
      cluster_type: 'supporting',
      description: 'Created from competitor gap analysis (US-BLOG-018)',
      created_by_user_id: userId,
    })
    .select('*')
    .single();
  if (clusterErr || !cluster) {
    return createCorsResponse(
      { error: clusterErr?.message ?? 'Failed to create cluster' },
      500,
      req,
    );
  }

  // For each keyword, upsert into blog_keywords with cluster_id + source_type='gap_analysis'.
  let inserted = 0;
  let linkedExisting = 0;
  for (const kw of keywords) {
    const norm = kw.toLowerCase().trim();
    if (!norm) continue;
    const { data: existing } = await admin
      .from('blog_keywords')
      .select('id, cluster_id')
      .eq('tenant_id', tenantId)
      .ilike('keyword', norm)
      .limit(1)
      .maybeSingle();
    if (existing) {
      await admin
        .from('blog_keywords')
        .update({
          cluster_id: cluster.id,
          source_type: 'gap_analysis',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      linkedExisting++;
    } else {
      // Try to pull metrics from the most recent competitor row.
      const { data: metric } = await admin
        .from('blog_competitor_keywords')
        .select('search_volume, keyword_difficulty, cpc, intent')
        .eq('tenant_id', tenantId)
        .ilike('keyword', norm)
        .order('fetched_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      await admin.from('blog_keywords').insert({
        tenant_id: tenantId,
        keyword: kw,
        cluster_id: cluster.id,
        source_type: 'gap_analysis',
        source_adapter: 'dataforseo',
        search_volume: metric?.search_volume ?? null,
        keyword_difficulty: metric?.keyword_difficulty ?? null,
        cpc: metric?.cpc ?? null,
        intent: metric?.intent ?? null,
        created_by_user_id: userId,
      });
      inserted++;
    }
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_gap.create_cluster',
      targetType: 'blog_keyword_cluster',
      targetId: cluster.id,
      afterState: { name, keyword_count: keywords.length, inserted, linkedExisting },
      summary: `Created cluster "${name}" from gap analysis (${inserted} new + ${linkedExisting} linked existing)`,
    }),
  );

  return createCorsResponse({ cluster, inserted, linked_existing: linkedExisting }, 201, req);
}

function cleanDomain(input: string): string {
  let s = input.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '');
  s = s.split('/')[0];
  s = s.replace(/^www\./, '');
  return s;
}
