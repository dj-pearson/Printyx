// Blog SERP Analyzer Edge Function (US-BLOG-015)
//
// Fetch the SERP for a keyword (DataForSEO), do best-effort per-URL parsing
// for word count + H2/H3 headings, compute aggregate metrics, and cache the
// result in blog_serp_snapshots for trend comparison later.
//
// Routes (gated to platform admin OR users holding blog.post.edit):
//   POST   /blog-serp/fetch                    body: { keyword, location_code?, language_code?, fetch_urls? }
//                                              returns: { snapshot } (with organic[].word_count etc.)
//   GET    /blog-serp?keyword=&location_code=&language_code=&limit=&offset=
//                                              list snapshots (newest first)
//   GET    /blog-serp/:id                      fetch one
//   DELETE /blog-serp/:id                      remove a snapshot
//
// Credential resolution: takes the first active `blog_distribution_targets`
// row for the tenant with platform='dataforseo' (mirrors US-BLOG-013 lookup).
// All mutations write to blog_audit_log.

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';
import { decryptCredential, type EncryptedCredential } from '../_shared/credential-vault.ts';
import {
  getKeywordAdapter,
  type SerpFetchResult,
  type SerpOrganicResult,
} from '../_shared/blog/keyword/index.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const fetchSchema = z.object({
  keyword: z.string().min(1).max(500),
  location_code: z.number().int().optional(),
  language_code: z.string().min(2).max(16).optional(),
  /** When true (default), follow each organic URL and parse word count + headings. Set false for fast cached-only fetch. */
  fetch_urls: z.boolean().optional(),
});

interface EncryptedKeywordConfig {
  base_url?: string | null;
  api_key: EncryptedCredential;
  api_secret?: EncryptedCredential | null;
}

interface EnrichedOrganic extends SerpOrganicResult {
  word_count: number | null;
  headings: { h2: string[]; h3: string[] };
  fetch_error: string | null;
}

interface Aggregate {
  total_results: number;
  median_word_count: number | null;
  mean_word_count: number | null;
  common_h2s: Array<{ text: string; count: number }>;
  dominant_content_type: string | null;
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
    const { parts } = normalizePath(url.pathname, 'blog-serp');
    const id = parts[0];

    if (!id) {
      if (req.method === 'GET') return await listSnapshots(admin, tenantId, url, req);
      return createCorsResponse({ error: 'Method not allowed' }, 405, req);
    }
    if (id === 'fetch' && req.method === 'POST') {
      return await fetchSerp(admin, tenantId, user.id, req);
    }
    if (req.method === 'GET') return await getSnapshot(admin, tenantId, id, req);
    if (req.method === 'DELETE') return await deleteSnapshot(admin, tenantId, user.id, id, req);

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (err) {
    console.error('blog-serp handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

async function listSnapshots(admin: Admin, tenantId: string, url: URL, req: Request) {
  const params = url.searchParams;
  const keyword = params.get('keyword')?.trim();
  const locationCode = params.get('location_code')
    ? parseInt(params.get('location_code')!, 10)
    : null;
  const languageCode = params.get('language_code');
  const limit = Math.min(parseInt(params.get('limit') ?? '50', 10) || 50, 200);
  const offset = Math.max(parseInt(params.get('offset') ?? '0', 10) || 0, 0);

  let query = admin
    .from('blog_serp_snapshots')
    .select(
      'id, keyword, location_code, language_code, source_adapter, fetched_at, cost_cents, aggregate',
      {
        count: 'exact',
      },
    )
    .eq('tenant_id', tenantId)
    .order('fetched_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (keyword) query = query.eq('keyword', keyword);
  if (locationCode !== null) query = query.eq('location_code', locationCode);
  if (languageCode) query = query.eq('language_code', languageCode);

  const { data, error, count } = await query;
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  return createCorsResponse(
    {
      snapshots: data ?? [],
      pagination: { total: count ?? 0, limit, offset, has_more: (count ?? 0) > offset + limit },
    },
    200,
    req,
  );
}

async function getSnapshot(admin: Admin, tenantId: string, id: string, req: Request) {
  const { data, error } = await admin
    .from('blog_serp_snapshots')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle();
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  if (!data) return createCorsResponse({ error: 'Snapshot not found' }, 404, req);
  return createCorsResponse({ snapshot: data }, 200, req);
}

async function deleteSnapshot(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  const { data: before } = await admin
    .from('blog_serp_snapshots')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .maybeSingle();
  if (!before) return createCorsResponse({ error: 'Snapshot not found' }, 404, req);

  const { error } = await admin
    .from('blog_serp_snapshots')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', id);
  if (error) return createCorsResponse({ error: error.message }, 500, req);

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_serp.delete',
      targetType: 'blog_serp_snapshot',
      targetId: id,
      beforeState: { keyword: before.keyword, fetched_at: before.fetched_at },
      summary: `Deleted SERP snapshot for "${before.keyword}"`,
    }),
  );

  return createCorsResponse({ deleted: true, id }, 200, req);
}

async function fetchSerp(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = fetchSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const input = parsed.data;
  const locationCode = input.location_code ?? 2840;
  const languageCode = input.language_code ?? 'en';
  const fetchUrls = input.fetch_urls ?? true;

  // Resolve adapter creds: first active dataforseo target for this tenant.
  const { data: target, error: targetErr } = await admin
    .from('blog_distribution_targets')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('platform', 'dataforseo')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (targetErr) return createCorsResponse({ error: targetErr.message }, 500, req);
  if (!target) {
    return createCorsResponse(
      {
        error:
          'No active dataforseo keyword target. Add credentials at /platform-admin/blog/settings/keyword-targets.',
      },
      400,
      req,
    );
  }

  const adapter = getKeywordAdapter(target.platform);
  if (!adapter?.fetchSerp) {
    return createCorsResponse(
      { error: `Adapter "${target.platform}" does not support SERP fetching` },
      400,
      req,
    );
  }

  const config = (target.encrypted_config ?? {}) as Partial<EncryptedKeywordConfig>;
  if (!config.api_key) {
    return createCorsResponse({ error: 'Keyword target is missing api_key' }, 400, req);
  }
  let apiKey: string;
  let apiSecret: string | undefined;
  try {
    apiKey = await decryptCredential(config.api_key);
    apiSecret = config.api_secret ? await decryptCredential(config.api_secret) : undefined;
  } catch (err) {
    return createCorsResponse(
      { error: `Credential decryption failed: ${err instanceof Error ? err.message : 'unknown'}` },
      500,
      req,
    );
  }

  let serp: SerpFetchResult;
  try {
    serp = await adapter.fetchSerp(
      { apiKey, apiSecret, baseUrl: config.base_url ?? undefined },
      input.keyword,
      { location_code: locationCode, language_code: languageCode, depth: 20 },
    );
  } catch (err) {
    return createCorsResponse(
      { error: `SERP fetch failed: ${err instanceof Error ? err.message : 'unknown'}` },
      502,
      req,
    );
  }

  // Best-effort per-URL fetch for word count + headings. Each call has a
  // 3-second timeout; failures are non-fatal and logged on the row.
  const enriched: EnrichedOrganic[] = [];
  if (fetchUrls) {
    // Fan out in parallel but bound by a small concurrency window so we don't
    // hammer the network all at once.
    const concurrency = 6;
    for (let i = 0; i < serp.organic.length; i += concurrency) {
      const batch = serp.organic.slice(i, i + concurrency);
      const results = await Promise.all(batch.map((o) => enrichOne(o)));
      enriched.push(...results);
    }
  } else {
    for (const o of serp.organic) {
      enriched.push({
        ...o,
        word_count: o.description ? o.description.split(/\s+/).filter(Boolean).length : null,
        headings: { h2: [], h3: [] },
        fetch_error: null,
      });
    }
  }

  const aggregate = computeAggregate(enriched);
  const costCents = serp.cost?.cents ?? 0;

  const { data: created, error: insertErr } = await admin
    .from('blog_serp_snapshots')
    .insert({
      tenant_id: tenantId,
      keyword: input.keyword,
      location_code: locationCode,
      language_code: languageCode,
      organic_results: enriched,
      serp_features: serp.features,
      aggregate,
      source_adapter: target.platform,
      cost_cents: costCents,
      created_by_user_id: userId,
    })
    .select('*')
    .single();
  if (insertErr || !created) {
    return createCorsResponse(
      { error: insertErr?.message ?? 'Failed to save SERP snapshot' },
      500,
      req,
    );
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_serp.fetch',
      targetType: 'blog_serp_snapshot',
      targetId: created.id,
      afterState: {
        keyword: input.keyword,
        organic_count: enriched.length,
        cost_cents: costCents,
      },
      summary: `Fetched SERP for "${input.keyword}" (${enriched.length} organic, ${costCents}¢)`,
    }),
  );

  return createCorsResponse({ snapshot: created }, 201, req);
}

// ─── enrichment + aggregates ───

async function enrichOne(o: SerpOrganicResult): Promise<EnrichedOrganic> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(o.url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PrintyxSerpBot/1.0; +https://printyx.net/bot)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    const contentType = res.headers.get('content-type') ?? '';
    if (!res.ok || !contentType.includes('html')) {
      return {
        ...o,
        word_count: o.description ? o.description.split(/\s+/).filter(Boolean).length : null,
        headings: { h2: [], h3: [] },
        fetch_error: `${res.status} ${res.statusText || contentType}`,
      };
    }
    const html = await res.text();
    return {
      ...o,
      word_count: countWords(html),
      headings: extractHeadings(html),
      fetch_error: null,
    };
  } catch (err) {
    return {
      ...o,
      // Fall back to description length when the fetch is blocked (paywall, bot detection, timeout)
      word_count: o.description ? o.description.split(/\s+/).filter(Boolean).length : null,
      headings: { h2: [], h3: [] },
      fetch_error: err instanceof Error ? err.message : 'fetch failed',
    };
  } finally {
    clearTimeout(timer);
  }
}

function countWords(html: string): number {
  // Strip script/style and tags, then count whitespace-delimited tokens.
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ');
  return text.split(/\s+/).filter(Boolean).length;
}

function extractHeadings(html: string): { h2: string[]; h3: string[] } {
  const stripTags = (s: string) =>
    s
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  const h2: string[] = [];
  const h3: string[] = [];
  const h2Re = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  const h3Re = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  let m: RegExpExecArray | null;
  while ((m = h2Re.exec(html)) !== null) {
    const t = stripTags(m[1]);
    if (t && t.length <= 200) h2.push(t);
    if (h2.length >= 30) break;
  }
  while ((m = h3Re.exec(html)) !== null) {
    const t = stripTags(m[1]);
    if (t && t.length <= 200) h3.push(t);
    if (h3.length >= 30) break;
  }
  return { h2, h3 };
}

function computeAggregate(rows: EnrichedOrganic[]): Aggregate {
  const counts = rows
    .map((r) => r.word_count)
    .filter((n): n is number => typeof n === 'number' && n > 0);
  counts.sort((a, b) => a - b);
  const median =
    counts.length === 0
      ? null
      : counts.length % 2 === 1
        ? counts[(counts.length - 1) >> 1]
        : Math.round((counts[counts.length / 2 - 1] + counts[counts.length / 2]) / 2);
  const mean =
    counts.length === 0 ? null : Math.round(counts.reduce((a, b) => a + b, 0) / counts.length);

  // Common H2s — fold by normalized text, top 5.
  const freq = new Map<string, number>();
  for (const row of rows) {
    for (const h of row.headings.h2) {
      const key = h
        .toLowerCase()
        .replace(/[^a-z0-9 ]+/g, '')
        .trim();
      if (!key) continue;
      freq.set(key, (freq.get(key) ?? 0) + 1);
    }
  }
  const commonH2s = Array.from(freq.entries())
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([text, count]) => ({ text, count }));

  const dominantContentType = inferContentType(rows);

  return {
    total_results: rows.length,
    median_word_count: median,
    mean_word_count: mean,
    common_h2s: commonH2s,
    dominant_content_type: dominantContentType,
  };
}

function inferContentType(rows: EnrichedOrganic[]): string | null {
  if (rows.length === 0) return null;
  // Very rough: title-pattern voting. "best/top N", "how to", "vs", "guide", "review".
  const buckets = { listicle: 0, how_to: 0, comparison: 0, guide: 0, review: 0, other: 0 };
  for (const r of rows) {
    const t = r.title.toLowerCase();
    if (/\b(best|top)\b.*\d/.test(t) || /\d+\s+(ways?|tips?|reasons?|best)/.test(t))
      buckets.listicle++;
    else if (/\bhow\s+to\b/.test(t)) buckets.how_to++;
    else if (/\bvs\.?\b|\bcompar/.test(t)) buckets.comparison++;
    else if (/\b(guide|playbook|handbook|tutorial)\b/.test(t)) buckets.guide++;
    else if (/\breview\b/.test(t)) buckets.review++;
    else buckets.other++;
  }
  const winner = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0];
  return winner[1] >= Math.max(2, Math.floor(rows.length * 0.3)) ? winner[0] : null;
}
