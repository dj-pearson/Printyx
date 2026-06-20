// Blog Community Question Miner Edge Function (US-BLOG-017)
//
// Mines real user questions from forums (Reddit, Stack Exchange, Quora) so
// content addresses authentic pain rather than synthetic SEO phrases. Every
// question is stored with its source URL (E-E-A-T citation requirement), then
// an LLM clusters them by theme; the themes surface in the brief generator.
//
// Routes (gated to platform admin OR users holding blog.post.edit):
//   GET    /blog-community-questions/sources             list the per-workspace seed config
//   PUT    /blog-community-questions/sources             replace the seed list (subreddits/SE sites/Quora topics)
//   POST   /blog-community-questions/mine                body: { sources?, source?, handle?, query?, limit?, cluster? }
//                                                         mines all active seeds (or a single ad-hoc source/handle),
//                                                         dedups + persists, then LLM-clusters by theme.
//                                                         Returns: { mined, deduped, warnings, clusters, cost_cents }
//   GET    /blog-community-questions/list?source=&theme=&limit=   list captured questions
//   DELETE /blog-community-questions/clear?source=&theme=         soft-delete captured questions
//
// Credentials live in blog_distribution_targets (platform = reddit|stackexchange|quora),
// encrypted_config: { api_key?: enc, api_secret?: enc, base_url?: plaintext }.
//   reddit:        api_key=clientId, api_secret=clientSecret
//   stackexchange: api_key=application key (optional; keyless works, throttled)
//   quora:         base_url=Bright Data collector, api_secret=bearer token (optional)

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';
import { assertAgentsActive } from '../_shared/blog/safety/kill-switch.ts';
import { decryptCredential, type EncryptedCredential } from '../_shared/credential-vault.ts';
import { generateCompletion } from '../_shared/anthropic.ts';
import { extractJsonArray } from '../_shared/blog/llm-json.ts';
import {
  getCommunityAdapter,
  isCommunitySource,
  type CommunityCredentials,
  type MinedQuestion,
  CommunityAdapterError,
} from '../_shared/blog/community/index.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const sourceEnum = z.enum(['reddit', 'stackexchange', 'quora']);

const sourceItemSchema = z.object({
  source: sourceEnum,
  handle: z.string().min(1).max(200),
  label: z.string().max(200).optional(),
  is_active: z.boolean().optional(),
});

const putSourcesSchema = z.object({
  sources: z.array(sourceItemSchema).max(200),
});

const mineSchema = z.object({
  // Optional ad-hoc single-source mine; when omitted, mines all active seeds.
  source: sourceEnum.optional(),
  handle: z.string().min(1).max(200).optional(),
  query: z.string().max(300).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  // Whether to run LLM theme clustering after mining (default true).
  cluster: z.boolean().optional(),
});

interface EncryptedCommunityConfig {
  base_url?: string | null;
  api_key?: EncryptedCredential | null;
  api_secret?: EncryptedCredential | null;
}

interface SourceRow {
  id: string;
  source: string;
  handle: string;
  label: string | null;
  is_active: boolean;
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
    const { parts } = normalizePath(url.pathname, 'blog-community-questions');
    const action = parts[0];

    if (action === 'sources' && req.method === 'GET') {
      return await listSources(admin, tenantId, req);
    }
    if (action === 'sources' && req.method === 'PUT') {
      return await putSources(admin, tenantId, user.id, req);
    }
    if (action === 'mine' && req.method === 'POST') {
      return await mine(admin, tenantId, user.id, req);
    }
    if (action === 'list' && req.method === 'GET') {
      return await listQuestions(admin, tenantId, url, req);
    }
    if (action === 'clear' && req.method === 'DELETE') {
      return await clearQuestions(admin, tenantId, user.id, url, req);
    }
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('blog-community-questions handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

// ─── sources config ───────────────────────────────────────────────────────

async function listSources(admin: Admin, tenantId: string, req: Request) {
  const { data, error } = await admin
    .from('blog_community_sources')
    .select('id, source, handle, label, is_active, last_mined_at, created_at')
    .eq('tenant_id', tenantId)
    .order('source', { ascending: true })
    .order('handle', { ascending: true });
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  return createCorsResponse({ sources: data ?? [] }, 200, req);
}

async function putSources(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = putSourcesSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }

  // Dedup by (source, handle); upsert each. Rows not present are deactivated
  // rather than deleted so historical questions keep their source_id link.
  const seen = new Set<string>();
  const rows = parsed.data.sources.filter((s) => {
    const key = `${s.source}:${s.handle.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const { data: existing } = await admin
    .from('blog_community_sources')
    .select('id, source, handle')
    .eq('tenant_id', tenantId);
  const existingByKey = new Map<string, string>();
  for (const e of existing ?? []) {
    existingByKey.set(`${e.source}:${String(e.handle).toLowerCase()}`, e.id);
  }

  const keepIds = new Set<string>();
  for (const s of rows) {
    const key = `${s.source}:${s.handle.toLowerCase()}`;
    const id = existingByKey.get(key);
    if (id) {
      keepIds.add(id);
      await admin
        .from('blog_community_sources')
        .update({
          label: s.label ?? null,
          is_active: s.is_active ?? true,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('id', id);
    } else {
      const { data: created } = await admin
        .from('blog_community_sources')
        .insert({
          tenant_id: tenantId,
          source: s.source,
          handle: s.handle,
          label: s.label ?? null,
          is_active: s.is_active ?? true,
          created_by_user_id: userId,
        })
        .select('id')
        .single();
      if (created) keepIds.add(created.id);
    }
  }

  // Deactivate seeds the caller dropped from the list.
  for (const [, id] of existingByKey) {
    if (!keepIds.has(id)) {
      await admin
        .from('blog_community_sources')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .eq('id', id);
    }
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_community.sources.update',
      targetType: 'blog_community_sources',
      afterState: { count: rows.length },
      summary: `Updated community seed list (${rows.length} sources)`,
    }),
  );

  return await listSources(admin, tenantId, req);
}

// ─── mining ────────────────────────────────────────────────────────────────

async function resolveCreds(
  admin: Admin,
  tenantId: string,
  platform: string,
): Promise<CommunityCredentials | { error: string }> {
  const { data: target } = await admin
    .from('blog_distribution_targets')
    .select('encrypted_config')
    .eq('tenant_id', tenantId)
    .eq('platform', platform)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const config = (target?.encrypted_config ?? {}) as Partial<EncryptedCommunityConfig>;
  try {
    const apiKey = config.api_key ? await decryptCredential(config.api_key) : undefined;
    const apiSecret = config.api_secret ? await decryptCredential(config.api_secret) : undefined;
    if (platform === 'reddit') {
      return { clientId: apiKey, clientSecret: apiSecret };
    }
    if (platform === 'stackexchange') {
      return { apiKey };
    }
    // quora
    return { baseUrl: config.base_url ?? undefined, accessToken: apiSecret };
  } catch (err) {
    return { error: `Credential decryption failed: ${err instanceof Error ? err.message : 'unknown'}` };
  }
}

async function mine(admin: Admin, tenantId: string, userId: string, req: Request) {
  // Agent entry point — respect the global kill switch (CLAUDE.md requirement).
  const active = await assertAgentsActive(admin, tenantId, 'community-question-miner', {
    reason: 'community question mining',
  });
  if (active === null) {
    return createCorsResponse({ error: 'Blog agents are paused (kill switch engaged).' }, 423, req);
  }

  let body: unknown = {};
  if (req.headers.get('content-length') && req.headers.get('content-length') !== '0') {
    try {
      body = await req.json();
    } catch {
      return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
    }
  }
  const parsed = mineSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const input = parsed.data;
  const limit = input.limit ?? 25;
  const doCluster = input.cluster ?? true;

  // Build the list of (source, handle, sourceId) jobs.
  type Job = { source: string; handle: string; sourceId: string | null };
  const jobs: Job[] = [];
  if (input.source && input.handle) {
    jobs.push({ source: input.source, handle: input.handle, sourceId: null });
  } else {
    const { data: seeds } = await admin
      .from('blog_community_sources')
      .select('id, source, handle, is_active')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);
    for (const s of (seeds ?? []) as SourceRow[]) {
      jobs.push({ source: s.source, handle: s.handle, sourceId: s.id });
    }
  }
  if (jobs.length === 0) {
    return createCorsResponse(
      {
        error:
          'No active community sources configured. Add subreddits / SE sites / Quora topics via PUT /sources.',
      },
      400,
      req,
    );
  }

  // Resolve credentials once per platform.
  const credsByPlatform = new Map<string, CommunityCredentials>();
  const warnings: string[] = [];
  for (const platform of new Set(jobs.map((j) => j.source))) {
    const resolved = await resolveCreds(admin, tenantId, platform);
    if ('error' in resolved) {
      warnings.push(`${platform}: ${resolved.error}`);
      continue;
    }
    credsByPlatform.set(platform, resolved);
  }

  let mined = 0;
  let deduped = 0;
  const insertedQuestions: { id: string; title: string }[] = [];

  for (const job of jobs) {
    const adapter = getCommunityAdapter(job.source);
    if (!adapter) {
      warnings.push(`Unknown source "${job.source}"`);
      continue;
    }
    const creds = credsByPlatform.get(job.source);
    if (!creds) continue; // credential warning already pushed

    let result;
    try {
      result = await adapter.mine(creds, job.handle, { limit, query: input.query });
    } catch (err) {
      const status = err instanceof CommunityAdapterError ? err.status : 0;
      warnings.push(
        `${job.source}/${job.handle}: ${err instanceof Error ? err.message : 'mine failed'}` +
          (status ? ` (${status})` : ''),
      );
      continue;
    }
    warnings.push(...result.warnings);

    for (const q of result.questions) {
      const persisted = await persistQuestion(admin, tenantId, userId, job, q);
      if (persisted.inserted) {
        mined++;
        insertedQuestions.push({ id: persisted.id, title: q.title });
      } else {
        deduped++;
      }
    }

    if (job.sourceId) {
      await admin
        .from('blog_community_sources')
        .update({ last_mined_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .eq('id', job.sourceId);
    }
  }

  // ── LLM theme clustering over the freshly mined questions ─────────────────
  let clusters: { theme: string; count: number }[] = [];
  if (doCluster && insertedQuestions.length > 0) {
    try {
      clusters = await clusterThemes(admin, tenantId, insertedQuestions);
    } catch (err) {
      warnings.push(`Clustering skipped: ${err instanceof Error ? err.message : 'error'}`);
    }
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_community.mine',
      targetType: 'blog_community_questions',
      afterState: {
        jobs: jobs.length,
        mined,
        deduped,
        clusters: clusters.length,
        warnings,
      },
      summary: `Mined ${mined} community questions (${deduped} deduped) across ${jobs.length} sources into ${clusters.length} themes`,
    }),
  );

  return createCorsResponse({ mined, deduped, warnings, clusters }, 201, req);
}

/**
 * Insert a question if (tenant, source, external_id) is new; otherwise skip.
 * Returns whether a new row was created.
 */
async function persistQuestion(
  admin: Admin,
  tenantId: string,
  userId: string,
  job: { source: string; handle: string; sourceId: string | null },
  q: MinedQuestion,
): Promise<{ id: string; inserted: boolean }> {
  const { data: existing } = await admin
    .from('blog_community_questions')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('source', job.source)
    .eq('external_id', q.externalId)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();
  if (existing) return { id: existing.id, inserted: false };

  const { data: created, error } = await admin
    .from('blog_community_questions')
    .insert({
      tenant_id: tenantId,
      source_id: job.sourceId,
      source: job.source,
      external_id: q.externalId,
      source_url: q.url,
      question_title: q.title,
      question_body: q.body,
      top_answer: q.topAnswer,
      score: q.score,
      answer_count: q.answerCount,
      raw_data: { handle: job.handle, ...q.raw },
      created_by_user_id: userId,
    })
    .select('id')
    .single();
  if (error || !created) {
    throw new Error(error?.message ?? 'Failed to insert community question');
  }
  return { id: created.id, inserted: true };
}

/**
 * Ask the LLM to assign each freshly-mined question to a short theme label, then
 * persist theme_cluster + theme_confidence. Returns the theme histogram.
 */
async function clusterThemes(
  admin: Admin,
  tenantId: string,
  questions: { id: string; title: string }[],
): Promise<{ theme: string; count: number }[]> {
  // Cap the prompt size; cluster at most 60 titles per call.
  const batch = questions.slice(0, 60);
  const numbered = batch.map((q, i) => `${i + 1}. ${q.title}`).join('\n');
  const raw = await generateCompletion({
    max_tokens: 1500,
    temperature: 0.2,
    system:
      'You are a content strategist. Group user questions into a small set of ' +
      'coherent themes (3-8 themes). Respond ONLY with a JSON array of objects ' +
      '{ "index": <1-based question number>, "theme": "<=4 word theme label", ' +
      '"confidence": 0..1 }. Every input question must appear exactly once.',
    messages: [
      {
        role: 'user',
        content: `Cluster these questions by theme:\n\n${numbered}`,
      },
    ],
  });

  let assignments: Array<{ index: number; theme: string; confidence?: number }> = [];
  try {
    assignments = extractJsonArray(raw) as typeof assignments;
  } catch {
    throw new Error('model returned unparseable clustering');
  }

  const histogram = new Map<string, number>();
  for (const a of assignments) {
    const idx = Number(a.index) - 1;
    if (idx < 0 || idx >= batch.length || !a.theme) continue;
    const theme = String(a.theme).slice(0, 200);
    const confidence =
      typeof a.confidence === 'number' ? Math.min(Math.max(a.confidence, 0), 1) : null;
    await admin
      .from('blog_community_questions')
      .update({ theme_cluster: theme, theme_confidence: confidence })
      .eq('tenant_id', tenantId)
      .eq('id', batch[idx].id);
    histogram.set(theme, (histogram.get(theme) ?? 0) + 1);
  }

  return Array.from(histogram.entries())
    .map(([theme, count]) => ({ theme, count }))
    .sort((a, b) => b.count - a.count);
}

// ─── read / clear ───────────────────────────────────────────────────────────

async function listQuestions(admin: Admin, tenantId: string, url: URL, req: Request) {
  const source = url.searchParams.get('source');
  const theme = url.searchParams.get('theme');
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '100') || 100, 500);

  let query = admin
    .from('blog_community_questions')
    .select(
      'id, source, source_url, question_title, question_body, top_answer, score, answer_count, theme_cluster, theme_confidence, captured_at',
    )
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('score', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (source) query = query.eq('source', source);
  if (theme) query = query.eq('theme_cluster', theme);

  const { data, error } = await query;
  if (error) return createCorsResponse({ error: error.message }, 500, req);

  // Theme histogram for the UI sidebar.
  const histogram = new Map<string, number>();
  for (const row of data ?? []) {
    const t = (row as { theme_cluster: string | null }).theme_cluster;
    if (t) histogram.set(t, (histogram.get(t) ?? 0) + 1);
  }

  return createCorsResponse(
    {
      questions: data ?? [],
      themes: Array.from(histogram.entries())
        .map(([t, count]) => ({ theme: t, count }))
        .sort((a, b) => b.count - a.count),
    },
    200,
    req,
  );
}

async function clearQuestions(
  admin: Admin,
  tenantId: string,
  userId: string,
  url: URL,
  req: Request,
) {
  const source = url.searchParams.get('source');
  const theme = url.searchParams.get('theme');

  let query = admin
    .from('blog_community_questions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .is('deleted_at', null);
  if (source) query = query.eq('source', source);
  if (theme) query = query.eq('theme_cluster', theme);

  const { data, error } = await query.select('id');
  if (error) return createCorsResponse({ error: error.message }, 500, req);

  const deleted = data?.length ?? 0;
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_community.clear',
      targetType: 'blog_community_questions',
      afterState: { source, theme, deleted },
      summary: `Soft-deleted ${deleted} community questions`,
    }),
  );

  return createCorsResponse({ deleted }, 200, req);
}
