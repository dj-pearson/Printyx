// Blog Topic Clustering Edge Function (US-BLOG-019)
//
// Groups keywords into a pillar–cluster model: each cluster has an LLM-generated
// name, a pillar keyword (highest volume + informational intent), and supporting
// keywords. Supports manual override (move a keyword between clusters, merge
// clusters) and a lifecycle status for the visualizer.
//
// Routes (gated to platform admin OR users holding blog.post.edit):
//   POST  /blog-clustering/cluster        body: { keyword_ids?, recluster? }
//   GET   /blog-clustering/clusters       clusters + their keywords (for the graph)
//   PATCH /blog-clustering/keywords/:id    body: { cluster_id|null }   move keyword
//   PATCH /blog-clustering/clusters/:id    body: { name?, status?, pillar_keyword? }
//   POST  /blog-clustering/merge          body: { cluster_ids[], name? }
//
// v1 clusters with one LLM call (group by topic + intent). Embedding-based
// clustering (OpenAI/Voyage) is a future swap behind the same persistence — the
// AC's force-directed visualizer reads GET /clusters edges from shared pillar.

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';
import { generateCompletion } from '../_shared/anthropic.ts';
import { extractJsonArray } from '../_shared/blog/llm-json.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const clusterSchema = z.object({
  keyword_ids: z.array(z.string().uuid()).max(500).optional(),
  // When true, also re-cluster keywords that already have a cluster_id.
  recluster: z.boolean().optional(),
});
const moveSchema = z.object({ cluster_id: z.string().uuid().nullable() });
const patchClusterSchema = z.object({
  name: z.string().max(200).optional(),
  status: z.enum(['planned', 'in_progress', 'published', 'decaying']).optional(),
  pillar_keyword: z.string().max(500).optional(),
});
const mergeSchema = z.object({
  cluster_ids: z.array(z.string().uuid()).min(2).max(50),
  name: z.string().max(200).optional(),
});

interface KeywordRow {
  id: string;
  keyword: string;
  search_volume: number | null;
  intent: string | null;
  cluster_id: string | null;
}

interface LlmCluster {
  name: string;
  pillar_keyword: string;
  supporting: string[];
}

function hasBlogPostEdit(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const perms = meta.permissions;
  if (Array.isArray(perms) && perms.includes('blog.post.edit')) return true;
  const role = String(meta.role ?? '').toLowerCase();
  return role === 'platform_admin' || role === 'super_admin' || role === 'company_admin';
}

function normKw(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
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
    const { parts } = normalizePath(url.pathname, 'blog-clustering');
    const action = parts[0];

    if (action === 'cluster' && req.method === 'POST') {
      return await cluster(admin, tenantId, user.id, req);
    }
    if (action === 'clusters' && !parts[1] && req.method === 'GET') {
      return await listClusters(admin, tenantId, req);
    }
    if (action === 'clusters' && parts[1] && req.method === 'PATCH') {
      return await patchCluster(admin, tenantId, user.id, parts[1], req);
    }
    if (action === 'keywords' && parts[1] && req.method === 'PATCH') {
      return await moveKeyword(admin, tenantId, user.id, parts[1], req);
    }
    if (action === 'merge' && req.method === 'POST') {
      return await merge(admin, tenantId, user.id, req);
    }
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('blog-clustering handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

async function cluster(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown = {};
  if (req.headers.get('content-length') && req.headers.get('content-length') !== '0') {
    try {
      body = await req.json();
    } catch {
      return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
    }
  }
  const parsed = clusterSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }

  let q = admin
    .from('blog_keywords')
    .select('id, keyword, search_volume, intent, cluster_id')
    .eq('tenant_id', tenantId);
  if (parsed.data.keyword_ids && parsed.data.keyword_ids.length > 0) {
    q = q.in('id', parsed.data.keyword_ids);
  } else if (!parsed.data.recluster) {
    q = q.is('cluster_id', null);
  }
  const { data: kws } = await q.limit(500);
  const keywords = (kws ?? []) as KeywordRow[];
  if (keywords.length < 2) {
    return createCorsResponse(
      { error: 'Need at least 2 keywords to cluster.', clusters: 0 },
      400,
      req,
    );
  }

  const byNorm = new Map<string, KeywordRow>();
  for (const k of keywords) byNorm.set(normKw(k.keyword), k);

  const list = keywords
    .map((k) => `- ${k.keyword} (vol=${k.search_volume ?? '?'}, intent=${k.intent ?? '?'})`)
    .join('\n');

  const raw = await generateCompletion({
    max_tokens: 3000,
    temperature: 0.2,
    system:
      'You are an SEO strategist building a pillar-cluster content model. Group ' +
      'the keywords into coherent topic clusters. For each cluster pick a pillar ' +
      'keyword (prefer high volume + informational intent) and list the supporting ' +
      'keywords. Every input keyword belongs to exactly one cluster. Respond ONLY ' +
      'with a JSON array of { "name": "<short cluster name>", "pillar_keyword": ' +
      '"<one of the keywords>", "supporting": ["<keyword>", ...] }.',
    messages: [{ role: 'user', content: `Keywords:\n${list}` }],
  });

  let llmClusters: LlmCluster[] = [];
  try {
    llmClusters = extractJsonArray(raw) as LlmCluster[];
  } catch {
    return createCorsResponse({ error: 'Model returned unparseable clustering' }, 502, req);
  }

  let created = 0;
  let assigned = 0;
  const assignedNorms = new Set<string>();

  for (const lc of llmClusters) {
    if (!lc.name || !Array.isArray(lc.supporting)) continue;
    const members: KeywordRow[] = [];
    const memberNorms = [
      ...(lc.pillar_keyword ? [lc.pillar_keyword] : []),
      ...lc.supporting,
    ].map(normKw);
    for (const n of memberNorms) {
      const k = byNorm.get(n);
      if (k && !assignedNorms.has(n)) {
        members.push(k);
        assignedNorms.add(n);
      }
    }
    if (members.length === 0) continue;

    // Pillar = explicit choice if valid, else highest-volume member.
    const pillar =
      byNorm.get(normKw(lc.pillar_keyword ?? '')) ??
      members.slice().sort((a, b) => (b.search_volume ?? 0) - (a.search_volume ?? 0))[0];

    const { data: clusterRow, error } = await admin
      .from('blog_keyword_clusters')
      .insert({
        tenant_id: tenantId,
        name: lc.name.slice(0, 200),
        pillar_keyword: pillar?.keyword ?? null,
        cluster_type: 'pillar',
        status: 'planned',
        created_by_user_id: userId,
      })
      .select('id')
      .single();
    if (error || !clusterRow) continue;
    created++;

    const ids = members.map((m) => m.id);
    await admin
      .from('blog_keywords')
      .update({ cluster_id: clusterRow.id, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .in('id', ids);
    assigned += ids.length;
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_clustering.cluster',
      targetType: 'blog_keyword_cluster',
      afterState: { clusters: created, keywords_assigned: assigned },
      summary: `Built ${created} topic clusters across ${assigned} keywords`,
    }),
  );

  return createCorsResponse({ clusters: created, keywords_assigned: assigned }, 201, req);
}

async function listClusters(admin: Admin, tenantId: string, req: Request) {
  const { data: clusters } = await admin
    .from('blog_keyword_clusters')
    .select('id, name, pillar_keyword, cluster_type, status, topical_authority_score')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .limit(500);

  const ids = (clusters ?? []).map((c) => c.id);
  const kwByCluster = new Map<string, Array<{ id: string; keyword: string; search_volume: number | null }>>();
  if (ids.length > 0) {
    const { data: kws } = await admin
      .from('blog_keywords')
      .select('id, keyword, search_volume, cluster_id')
      .eq('tenant_id', tenantId)
      .in('cluster_id', ids)
      .limit(5000);
    for (const k of kws ?? []) {
      const arr = kwByCluster.get(k.cluster_id as string) ?? [];
      arr.push({ id: k.id, keyword: k.keyword, search_volume: k.search_volume });
      kwByCluster.set(k.cluster_id as string, arr);
    }
  }

  const result = (clusters ?? []).map((c) => ({
    ...c,
    keywords: kwByCluster.get(c.id) ?? [],
  }));
  return createCorsResponse({ clusters: result }, 200, req);
}

async function patchCluster(admin: Admin, tenantId: string, userId: string, id: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = patchClusterSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.status !== undefined) update.status = parsed.data.status;
  if (parsed.data.pillar_keyword !== undefined) update.pillar_keyword = parsed.data.pillar_keyword;

  const { data: updated, error } = await admin
    .from('blog_keyword_clusters')
    .update(update)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select('id, name, status')
    .maybeSingle();
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  if (!updated) return createCorsResponse({ error: 'Cluster not found' }, 404, req);
  return createCorsResponse({ cluster: updated }, 200, req);
}

async function moveKeyword(admin: Admin, tenantId: string, userId: string, id: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = moveSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }

  // Validate the target cluster (when not null) belongs to the tenant.
  if (parsed.data.cluster_id) {
    const { data: target } = await admin
      .from('blog_keyword_clusters')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('id', parsed.data.cluster_id)
      .maybeSingle();
    if (!target) return createCorsResponse({ error: 'Target cluster not found' }, 404, req);
  }

  const { data: updated, error } = await admin
    .from('blog_keywords')
    .update({ cluster_id: parsed.data.cluster_id, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select('id, cluster_id')
    .maybeSingle();
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  if (!updated) return createCorsResponse({ error: 'Keyword not found' }, 404, req);

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_clustering.move_keyword',
      targetType: 'blog_keyword',
      targetId: id,
      afterState: { cluster_id: parsed.data.cluster_id },
      summary: 'Moved keyword between clusters',
    }),
  );
  return createCorsResponse({ keyword: updated }, 200, req);
}

async function merge(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = mergeSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }

  const { data: clusters } = await admin
    .from('blog_keyword_clusters')
    .select('id, name, pillar_keyword')
    .eq('tenant_id', tenantId)
    .in('id', parsed.data.cluster_ids)
    .is('deleted_at', null);
  if (!clusters || clusters.length < 2) {
    return createCorsResponse({ error: 'Need at least 2 valid clusters to merge' }, 400, req);
  }

  // Keep the first as the survivor; move all keywords onto it, soft-delete the rest.
  const survivor = clusters[0];
  const losers = clusters.slice(1).map((c) => c.id);

  await admin
    .from('blog_keywords')
    .update({ cluster_id: survivor.id, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .in('cluster_id', losers);

  await admin
    .from('blog_keyword_clusters')
    .update({ deleted_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .in('id', losers);

  if (parsed.data.name) {
    await admin
      .from('blog_keyword_clusters')
      .update({ name: parsed.data.name, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', survivor.id);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_clustering.merge',
      targetType: 'blog_keyword_cluster',
      targetId: survivor.id,
      afterState: { merged: losers.length },
      summary: `Merged ${losers.length} clusters into "${parsed.data.name ?? survivor.name}"`,
    }),
  );

  return createCorsResponse({ survivor_id: survivor.id, merged: losers.length }, 200, req);
}
