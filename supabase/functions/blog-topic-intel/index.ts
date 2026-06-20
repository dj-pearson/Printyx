// Blog Topic Intelligence Edge Function (US-BLOG-017, 019, 020, 022, 025, 026)
//
// One function backing the "topic intelligence" cluster:
//   017 — Forum/community question miner (Reddit, Quora, Stack Exchange) + LLM
//         theme clustering + per-workspace seed config.
//   019 — Topic clustering with the pillar-cluster model (embedding-based) +
//         manual override (move/split/merge) + cluster visualizer graph.
//   020 — Internal-link opportunity finder: embed posts, cosine top-N, LLM
//         anchor text, suggestions + reverse view + PR-style backfill.
//   022 — Topical authority scorer per cluster (0-100) + 90-day trend + heatmap.
//   025 — Source aggregator with citation capture (extends blog_citations) +
//         rendered references + schema.org Citation JSON-LD + reorder/edit.
//   026 — Reading-level (Flesch-Kincaid, computed in-code) + persona match
//         (LLM) + per-sentence analysis + simplify + pre-publish gate.
//
// External services (Reddit/Quora/SE scrapers, embedding providers, OG fetch)
// are stubbed behind clearly-named adapter functions with TODOs — the storage
// and LLM-driven logic are fully implemented and persisted to tables, matching
// the blog-syndication adapter-note convention.
//
// Routes (tenant-scoped, gated to blog.post.edit):
//   --- 017 community miner ---
//   GET    /blog-topic-intel/seeds                 read seed config
//   PUT    /blog-topic-intel/seeds                 upsert seed config
//   POST   /blog-topic-intel/mine                  run miner over the seeds
//   GET    /blog-topic-intel/questions             list (?theme= &source=)
//   POST   /blog-topic-intel/questions/cluster     LLM theme clustering
//   --- 019 clustering / pillar model ---
//   POST   /blog-topic-intel/clusters/embed        embed keywords (adapter stub)
//   POST   /blog-topic-intel/clusters/build        embedding clustering -> clusters
//   GET    /blog-topic-intel/clusters              list cluster extensions
//   GET    /blog-topic-intel/clusters/graph        visualizer nodes+edges
//   POST   /blog-topic-intel/clusters/move-keyword move kw between clusters
//   POST   /blog-topic-intel/clusters/split        split a cluster
//   POST   /blog-topic-intel/clusters/merge        merge clusters
//   --- 022 authority ---
//   POST   /blog-topic-intel/clusters/authority/recompute   recompute all clusters
//   GET    /blog-topic-intel/clusters/:id/authority         full breakdown + trend
//   GET    /blog-topic-intel/clusters/authority/heatmap     heatmap rows
//   --- 020 internal links ---
//   POST   /blog-topic-intel/posts/:id/embed       embed a post body (adapter stub)
//   GET    /blog-topic-intel/posts/:id/links       suggested OUTbound links (editor)
//   GET    /blog-topic-intel/posts/:id/links/reverse  posts that should link back
//   POST   /blog-topic-intel/posts/:id/links/backfill  PR-style proposed inserts
//   --- 025 citations ---
//   POST   /blog-topic-intel/posts/:id/citations          capture a URL
//   GET    /blog-topic-intel/posts/:id/citations          list (ordered)
//   PATCH  /blog-topic-intel/citations/:id                edit
//   POST   /blog-topic-intel/posts/:id/citations/reorder  reorder
//   GET    /blog-topic-intel/posts/:id/citations/render   references + JSON-LD
//   --- 026 readability / persona ---
//   POST   /blog-topic-intel/readability/analyze   analyze submitted text/post
//   POST   /blog-topic-intel/readability/simplify  LLM rewrite a sentence to grade
//   POST   /blog-topic-intel/readability/gate      pre-publish gate result

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';
import { generateCompletion } from '../_shared/anthropic.ts';
import { extractJsonArray, extractJsonObject, asStringArray } from '../_shared/blog/llm-json.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

// ===========================================================================
// Auth helper — allow platform admin OR blog.post.edit OR admin-ish role.
// ===========================================================================
function hasBlogPostEdit(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const perms = meta.permissions;
  if (Array.isArray(perms) && perms.includes('blog.post.edit')) return true;
  const role = String(meta.role ?? '').toLowerCase();
  return role === 'platform_admin' || role === 'super_admin' || role === 'company_admin';
}

// ===========================================================================
// US-BLOG-017 — adapter stubs for forum/community mining.
// TODO(adapters): wire real Reddit (OAuth app + /search.json), Quora (no public
// API — scrape or 3rd-party), and Stack Exchange (api.stackexchange.com) calls.
// Each returns a normalized question list; storage + clustering below is real.
// ===========================================================================
interface MinedQuestion {
  source: 'reddit' | 'quora' | 'stackexchange';
  sourceContext: string;
  url: string;
  title: string;
  score: number | null;
  topAnswerSnippet: string | null;
  rawData?: Record<string, unknown>;
}

async function fetchRedditQuestions(_subreddits: string[]): Promise<MinedQuestion[]> {
  // TODO(adapter): call Reddit search for question-shaped titles + top comments.
  // Stubbed: returns nothing until credentials/adapter are wired.
  return [];
}
async function fetchQuoraQuestions(_topics: string[]): Promise<MinedQuestion[]> {
  // TODO(adapter): Quora has no official API — integrate a scraper / 3rd-party.
  return [];
}
async function fetchStackExchangeQuestions(_sites: string[]): Promise<MinedQuestion[]> {
  // TODO(adapter): api.stackexchange.com /questions?sort=votes&filter=withbody.
  return [];
}

// ===========================================================================
// US-BLOG-019 / 020 — embedding adapter stub + cosine similarity (real).
// TODO(adapter): replace with a real embedding provider (OpenAI text-embedding-3
// or Cohere). For determinism without network access we derive a small,
// stable pseudo-embedding from the text so clustering/similarity logic is
// exercisable end-to-end. NOTE: pgvector migration tracked in the .sql file.
// ===========================================================================
const STUB_EMBED_DIMS = 64;
const STUB_EMBED_MODEL = 'stub-hash-embed-v1';

function stubEmbed(text: string): number[] {
  const vec = new Array<number>(STUB_EMBED_DIMS).fill(0);
  const tokens = (text || '').toLowerCase().match(/[a-z0-9]+/g) ?? [];
  for (const tok of tokens) {
    let h = 2166136261;
    for (let i = 0; i < tok.length; i++) {
      h ^= tok.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const idx = Math.abs(h) % STUB_EMBED_DIMS;
    vec[idx] += 1;
  }
  // L2 normalize so dot product == cosine similarity.
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

async function embedTexts(texts: string[]): Promise<number[][]> {
  // TODO(adapter): batch-call a real embedding provider here.
  return texts.map((t) => stubEmbed(t));
}

function cosine(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom ? dot / denom : 0;
}

function asNumberArray(v: unknown): number[] {
  return Array.isArray(v) ? v.map((x) => Number(x)).filter((n) => Number.isFinite(n)) : [];
}

// ===========================================================================
// US-BLOG-025 — OG/metadata fetcher stub.
// TODO(adapter): real fetch + HTML parse of <title>, author meta, article:
// published_time, og:image, and a text excerpt. Stubbed to return nulls.
// ===========================================================================
interface FetchedMeta {
  title: string | null;
  author: string | null;
  publishDate: string | null;
  ogImageUrl: string | null;
  excerpt: string | null;
}
async function fetchUrlMetadata(_url: string): Promise<FetchedMeta> {
  // TODO(adapter): pull and parse the page; for now return empty metadata so
  // the citation is still captured (editor can fill in the blanks).
  return { title: null, author: null, publishDate: null, ogImageUrl: null, excerpt: null };
}

// ===========================================================================
// US-BLOG-026 — Flesch-Kincaid grade level (deterministic, in-code).
// ===========================================================================
function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  let normalized = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  normalized = normalized.replace(/^y/, '');
  const groups = normalized.match(/[aeiouy]{1,2}/g);
  return groups ? groups.length : 1;
}

function splitSentences(text: string): string[] {
  return (text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function countWords(text: string): string[] {
  return (text || '').match(/[A-Za-z0-9']+/g) ?? [];
}

/** Flesch-Kincaid grade level for a block of text. Returns 0 for empty. */
function fleschKincaidGrade(text: string): number {
  const sentences = splitSentences(text);
  const words = countWords(text);
  if (words.length === 0 || sentences.length === 0) return 0;
  const syllables = words.reduce((s, w) => s + countSyllables(w), 0);
  const grade =
    0.39 * (words.length / sentences.length) + 11.8 * (syllables / words.length) - 15.59;
  return Math.round(grade * 10) / 10;
}

function gradeTier(grade: number, target: number): 'ok' | 'yellow' | 'red' {
  const diff = Math.abs(grade - target);
  if (diff <= 2) return 'ok';
  if (diff <= 4) return 'yellow';
  return 'red';
}

// ===========================================================================
// Zod schemas
// ===========================================================================
const seedsSchema = z.object({
  subreddits: z.array(z.string().max(120)).max(200).optional(),
  quora_topics: z.array(z.string().max(120)).max(200).optional(),
  stackexchange_sites: z.array(z.string().max(120)).max(200).optional(),
  target_config: z.record(z.unknown()).optional(),
});

const moveKeywordSchema = z.object({
  keyword_id: z.string().uuid(),
  to_cluster_id: z.string().uuid(),
});

const splitSchema = z.object({
  cluster_id: z.string().uuid(),
  new_cluster_name: z.string().min(1).max(200),
  keyword_ids: z.array(z.string().uuid()).min(1),
});

const mergeSchema = z.object({
  source_cluster_id: z.string().uuid(),
  target_cluster_id: z.string().uuid(),
});

const citationCreateSchema = z.object({
  url: z.string().url(),
  title: z.string().max(2000).optional(),
  author: z.string().max(255).optional(),
  publication: z.string().max(255).optional(),
  publish_date: z.string().max(40).optional(),
  citation_text: z.string().max(8000).optional(),
});

const citationPatchSchema = z.object({
  title: z.string().max(2000).optional(),
  author: z.string().max(255).nullable().optional(),
  publication: z.string().max(255).nullable().optional(),
  publish_date: z.string().max(40).nullable().optional(),
  citation_text: z.string().max(8000).nullable().optional(),
  excerpt: z.string().max(8000).nullable().optional(),
  og_image_url: z.string().max(2000).nullable().optional(),
});

const reorderSchema = z.object({
  citation_ids: z.array(z.string().uuid()).min(1),
});

const analyzeSchema = z.object({
  post_id: z.string().uuid().optional(),
  text: z.string().max(60000).optional(),
  target_grade: z.number().min(1).max(20).optional(),
  brief_id: z.string().uuid().optional(),
  persona: z.string().max(4000).optional(),
});

const simplifySchema = z.object({
  sentence: z.string().min(1).max(4000),
  target_grade: z.number().min(1).max(20),
});

const gateSchema = z.object({
  post_id: z.string().uuid().optional(),
  text: z.string().max(60000).optional(),
  target_grade: z.number().min(1).max(20).optional(),
  brief_id: z.string().uuid().optional(),
  persona: z.string().max(4000).optional(),
});

// ===========================================================================
// US-BLOG-017 — seed config
// ===========================================================================
async function getSeeds(admin: Admin, tenantId: string, req: Request) {
  const { data, error } = await admin
    .from('blog_community_seeds')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('blog-topic-intel getSeeds error', error);
    return createCorsResponse({ error: 'Failed to load seeds' }, 500, req);
  }
  return createCorsResponse({ seeds: data ?? null }, 200, req);
}

async function putSeeds(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = seedsSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const { data: existing } = await admin
    .from('blog_community_seeds')
    .select('id')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle();

  const row = {
    tenant_id: tenantId,
    subreddits: parsed.data.subreddits ?? [],
    quora_topics: parsed.data.quora_topics ?? [],
    stackexchange_sites: parsed.data.stackexchange_sites ?? [],
    target_config: parsed.data.target_config ?? null,
    updated_at: new Date().toISOString(),
  };

  let result;
  if (existing) {
    result = await admin
      .from('blog_community_seeds')
      .update(row)
      .eq('tenant_id', tenantId)
      .eq('id', existing.id)
      .select()
      .single();
  } else {
    result = await admin
      .from('blog_community_seeds')
      .insert({ ...row, created_by_user_id: userId })
      .select()
      .single();
  }
  if (result.error) {
    console.error('blog-topic-intel putSeeds error', result.error);
    return createCorsResponse({ error: 'Failed to save seeds' }, 500, req);
  }
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_topic_intel.seeds_update',
      targetType: 'blog_community_seeds',
      targetId: result.data.id,
      summary: 'Updated community seed config',
      afterState: row,
    }),
  );
  return createCorsResponse({ seeds: result.data }, 200, req);
}

async function mine(admin: Admin, tenantId: string, userId: string, req: Request) {
  const { data: seeds } = await admin
    .from('blog_community_seeds')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!seeds) {
    return createCorsResponse(
      { error: 'No seed config — set subreddits/quora topics/SE sites first (PUT /seeds).' },
      409,
      req,
    );
  }
  const subreddits = asStringArray(seeds.subreddits, 200);
  const quoraTopics = asStringArray(seeds.quora_topics, 200);
  const seSites = asStringArray(seeds.stackexchange_sites, 200);

  const [reddit, quora, se] = await Promise.all([
    fetchRedditQuestions(subreddits),
    fetchQuoraQuestions(quoraTopics),
    fetchStackExchangeQuestions(seSites),
  ]);
  const mined = [...reddit, ...quora, ...se];

  let inserted: unknown[] = [];
  if (mined.length > 0) {
    const rows = mined.map((q) => ({
      tenant_id: tenantId,
      source: q.source,
      source_context: q.sourceContext,
      url: q.url,
      title: q.title,
      score: q.score,
      top_answer_snippet: q.topAnswerSnippet,
      raw_data: q.rawData ?? null,
      created_by_user_id: userId,
    }));
    const { data, error } = await admin.from('blog_community_questions').insert(rows).select();
    if (error) {
      console.error('blog-topic-intel mine insert error', error);
      return createCorsResponse({ error: 'Failed to store mined questions' }, 500, req);
    }
    inserted = data ?? [];
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_topic_intel.mine',
      targetType: 'blog_community_questions',
      targetId: null,
      summary: `Mined ${inserted.length} community questions`,
      afterState: {
        seeds: {
          subreddits: subreddits.length,
          quoraTopics: quoraTopics.length,
          seSites: seSites.length,
        },
        captured: inserted.length,
      },
    }),
  );
  return createCorsResponse(
    {
      captured: inserted.length,
      questions: inserted,
      note:
        mined.length === 0
          ? 'Community adapters are stubbed (US-BLOG-017) — wire Reddit/Quora/SE credentials to capture live questions.'
          : undefined,
    },
    200,
    req,
  );
}

async function listQuestions(admin: Admin, tenantId: string, url: URL, req: Request) {
  let q = admin
    .from('blog_community_questions')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('score', { ascending: false, nullsFirst: false })
    .order('captured_at', { ascending: false })
    .limit(500);
  const theme = url.searchParams.get('theme');
  const source = url.searchParams.get('source');
  if (theme) q = q.eq('theme', theme);
  if (source) q = q.eq('source', source);
  const { data, error } = await q;
  if (error) {
    console.error('blog-topic-intel listQuestions error', error);
    return createCorsResponse({ error: 'Failed to list questions' }, 500, req);
  }
  return createCorsResponse({ questions: data ?? [] }, 200, req);
}

async function clusterQuestions(admin: Admin, tenantId: string, userId: string, req: Request) {
  const { data: questions, error } = await admin
    .from('blog_community_questions')
    .select('id,title,source')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .is('theme', null)
    .order('captured_at', { ascending: false })
    .limit(200);
  if (error) {
    console.error('blog-topic-intel clusterQuestions load error', error);
    return createCorsResponse({ error: 'Failed to load questions' }, 500, req);
  }
  if (!questions || questions.length === 0) {
    return createCorsResponse(
      { updated: 0, themes: [], note: 'No unclustered questions.' },
      200,
      req,
    );
  }

  const system =
    'You are a B2B content strategist for a print/MFP dealer SaaS. Group reader questions into ' +
    'a small set of themes (5-12). Return ONLY a JSON array, no prose. ' +
    'Shape: [{"id": <question id>, "theme": <short theme label>}]. Use the exact ids given.';
  const userPrompt =
    'Assign a theme to each question id:\n' +
    questions.map((q) => `- ${q.id}: ${q.title}`).join('\n');

  let assignments: Array<{ id: string; theme: string }> = [];
  try {
    const raw = await generateCompletion({
      max_tokens: 2000,
      temperature: 0.3,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    });
    assignments = extractJsonArray(raw)
      .map((a) => a as Record<string, unknown>)
      .filter((a) => a && typeof a.id === 'string' && typeof a.theme === 'string')
      .map((a) => ({ id: String(a.id), theme: String(a.theme).slice(0, 255) }));
  } catch (err) {
    console.error('blog-topic-intel clusterQuestions LLM error', err);
    return createCorsResponse(
      { error: 'Theme clustering failed — model unavailable or unparseable.' },
      502,
      req,
    );
  }

  const validIds = new Set(questions.map((q) => q.id));
  let updated = 0;
  for (const a of assignments) {
    if (!validIds.has(a.id)) continue;
    const { error: upErr } = await admin
      .from('blog_community_questions')
      .update({ theme: a.theme, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', a.id);
    if (!upErr) updated++;
  }
  const themes = [...new Set(assignments.map((a) => a.theme))];

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_topic_intel.questions_cluster',
      targetType: 'blog_community_questions',
      targetId: null,
      summary: `Clustered ${updated} questions into ${themes.length} themes`,
      afterState: { updated, themes },
    }),
  );
  return createCorsResponse({ updated, themes }, 200, req);
}

// ===========================================================================
// US-BLOG-019 — embedding + pillar-cluster build, overrides, visualizer
// ===========================================================================
async function embedKeywords(admin: Admin, tenantId: string, userId: string, req: Request) {
  const { data: keywords, error } = await admin
    .from('blog_keywords')
    .select('id,keyword,intent')
    .eq('tenant_id', tenantId)
    .limit(1000);
  if (error) {
    console.error('blog-topic-intel embedKeywords load error', error);
    return createCorsResponse({ error: 'Failed to load keywords' }, 500, req);
  }
  if (!keywords || keywords.length === 0) {
    return createCorsResponse({ embedded: 0, note: 'No keywords to embed.' }, 200, req);
  }
  const texts = keywords.map((k) => `${k.keyword} [intent: ${k.intent ?? 'unknown'}]`);
  const vectors = await embedTexts(texts);

  let embedded = 0;
  for (let i = 0; i < keywords.length; i++) {
    const kw = keywords[i];
    const vec = vectors[i];
    // Replace any prior embedding for this keyword (idempotent re-embed).
    await admin
      .from('blog_keyword_embeddings')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('keyword_id', kw.id);
    const { error: insErr } = await admin.from('blog_keyword_embeddings').insert({
      tenant_id: tenantId,
      keyword_id: kw.id,
      embedding_model: STUB_EMBED_MODEL,
      embedding: vec,
      dims: STUB_EMBED_DIMS,
      source_text: texts[i],
      created_by_user_id: userId,
    });
    if (!insErr) embedded++;
  }
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_topic_intel.keywords_embed',
      targetType: 'blog_keyword_embeddings',
      targetId: null,
      summary: `Embedded ${embedded} keywords`,
      afterState: { embedded, model: STUB_EMBED_MODEL },
    }),
  );
  return createCorsResponse(
    { embedded, model: STUB_EMBED_MODEL, note: 'Embedding adapter is stubbed (US-BLOG-019).' },
    200,
    req,
  );
}

/** Greedy similarity clustering over keyword embeddings (no external lib). */
function greedyCluster(
  items: Array<{ id: string; keyword: string; vec: number[] }>,
  threshold: number,
): Array<{ memberIds: string[]; pillarId: string; pillarKeyword: string }> {
  const clusters: Array<{
    memberIds: string[];
    centroid: number[];
    pillarId: string;
    pillarKeyword: string;
  }> = [];
  for (const item of items) {
    let best = -1;
    let bestSim = threshold;
    for (let c = 0; c < clusters.length; c++) {
      const sim = cosine(item.vec, clusters[c].centroid);
      if (sim >= bestSim) {
        bestSim = sim;
        best = c;
      }
    }
    if (best === -1) {
      clusters.push({
        memberIds: [item.id],
        centroid: [...item.vec],
        pillarId: item.id,
        pillarKeyword: item.keyword,
      });
    } else {
      const cl = clusters[best];
      cl.memberIds.push(item.id);
      for (let d = 0; d < cl.centroid.length; d++) {
        cl.centroid[d] =
          (cl.centroid[d] * (cl.memberIds.length - 1) + item.vec[d]) / cl.memberIds.length;
      }
    }
  }
  return clusters.map((c) => ({
    memberIds: c.memberIds,
    pillarId: c.pillarId,
    pillarKeyword: c.pillarKeyword,
  }));
}

async function buildClusters(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: { threshold?: number } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const threshold = typeof body.threshold === 'number' ? body.threshold : 0.6;

  const { data: embeds, error } = await admin
    .from('blog_keyword_embeddings')
    .select('keyword_id,embedding')
    .eq('tenant_id', tenantId)
    .limit(2000);
  if (error) {
    console.error('blog-topic-intel buildClusters load error', error);
    return createCorsResponse({ error: 'Failed to load embeddings' }, 500, req);
  }
  if (!embeds || embeds.length === 0) {
    return createCorsResponse(
      { error: 'No keyword embeddings — run POST /clusters/embed first.' },
      409,
      req,
    );
  }
  const { data: kws } = await admin
    .from('blog_keywords')
    .select('id,keyword,intent')
    .eq('tenant_id', tenantId)
    .limit(2000);
  const kwById = new Map((kws ?? []).map((k) => [k.id, k]));

  const items = embeds
    .map((e) => ({
      id: e.keyword_id as string,
      keyword: String(kwById.get(e.keyword_id as string)?.keyword ?? ''),
      vec: asNumberArray(e.embedding),
    }))
    .filter((i) => i.vec.length > 0 && i.keyword);

  const rawClusters = greedyCluster(items, threshold);

  const created: unknown[] = [];
  for (const rc of rawClusters) {
    const members = rc.memberIds.map((id) => kwById.get(id)).filter(Boolean) as Array<{
      id: string;
      keyword: string;
      intent: string | null;
    }>;
    // LLM names the cluster + assigns a suggested post type per supporting kw.
    let name = rc.pillarKeyword;
    let supporting: Array<{ keyword: string; suggested_post_type: string }> = members
      .filter((m) => m.id !== rc.pillarId)
      .map((m) => ({ keyword: m.keyword, suggested_post_type: 'how_to' }));
    try {
      const system =
        'You name an SEO topic cluster and assign a post type to each supporting keyword. ' +
        'Return ONLY a JSON object. Shape: {"name": string, "supporting": [{"keyword": string, ' +
        '"suggested_post_type": "pillar"|"how_to"|"comparison"|"listicle"|"deep_dive"|"opinion"|"case_study"}]}.';
      const userPrompt =
        `Pillar keyword: ${rc.pillarKeyword}\nSupporting keywords:\n` +
        members
          .filter((m) => m.id !== rc.pillarId)
          .map((m) => `- ${m.keyword} (intent: ${m.intent ?? 'unknown'})`)
          .join('\n');
      const raw = await generateCompletion({
        max_tokens: 1200,
        temperature: 0.4,
        system,
        messages: [{ role: 'user', content: userPrompt }],
      });
      const obj = extractJsonObject(raw);
      if (typeof obj.name === 'string' && obj.name.trim()) name = obj.name.slice(0, 200);
      if (Array.isArray(obj.supporting)) {
        supporting = obj.supporting
          .map((s) => s as Record<string, unknown>)
          .filter((s) => s && typeof s.keyword === 'string')
          .map((s) => ({
            keyword: String(s.keyword).slice(0, 500),
            suggested_post_type: String(s.suggested_post_type ?? 'how_to').slice(0, 32),
          }));
      }
    } catch (err) {
      console.error('blog-topic-intel buildClusters LLM naming error (non-fatal)', err);
    }

    // Persist the base cluster row (existing table) + the pillar overlay.
    const { data: clusterRow, error: clErr } = await admin
      .from('blog_keyword_clusters')
      .insert({
        tenant_id: tenantId,
        name,
        pillar_keyword: rc.pillarKeyword,
        cluster_type: 'pillar',
        created_by_user_id: userId,
      })
      .select()
      .single();
    if (clErr || !clusterRow) {
      console.error('blog-topic-intel buildClusters cluster insert error', clErr);
      continue;
    }
    // Assign member keywords to the cluster.
    await admin
      .from('blog_keywords')
      .update({ cluster_id: clusterRow.id, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .in('id', rc.memberIds);

    const { data: ext } = await admin
      .from('blog_cluster_extensions')
      .insert({
        tenant_id: tenantId,
        cluster_id: clusterRow.id,
        name,
        pillar_keyword: rc.pillarKeyword,
        supporting_keywords: supporting,
        status: 'planned',
        created_by_user_id: userId,
      })
      .select()
      .single();
    created.push({ cluster: clusterRow, extension: ext });
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_topic_intel.clusters_build',
      targetType: 'blog_keyword_clusters',
      targetId: null,
      summary: `Built ${created.length} pillar clusters (threshold ${threshold})`,
      afterState: { count: created.length, threshold },
    }),
  );
  return createCorsResponse({ clusters: created, threshold }, 201, req);
}

async function listClusters(admin: Admin, tenantId: string, req: Request) {
  const { data, error } = await admin
    .from('blog_cluster_extensions')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) {
    console.error('blog-topic-intel listClusters error', error);
    return createCorsResponse({ error: 'Failed to list clusters' }, 500, req);
  }
  return createCorsResponse({ clusters: data ?? [] }, 200, req);
}

async function clusterGraph(admin: Admin, tenantId: string, req: Request) {
  // Nodes: pillar (cluster) center + supporting keyword nodes.
  // Edges: pillar->keyword with weight = cosine similarity to the pillar.
  const { data: clusters } = await admin
    .from('blog_keyword_clusters')
    .select('id,name,pillar_keyword')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .limit(500);
  const { data: keywords } = await admin
    .from('blog_keywords')
    .select('id,keyword,cluster_id')
    .eq('tenant_id', tenantId)
    .limit(2000);
  const { data: embeds } = await admin
    .from('blog_keyword_embeddings')
    .select('keyword_id,embedding')
    .eq('tenant_id', tenantId)
    .limit(2000);

  const vecByKw = new Map(
    (embeds ?? []).map((e) => [e.keyword_id as string, asNumberArray(e.embedding)]),
  );
  const kwByCluster = new Map<string, Array<{ id: string; keyword: string }>>();
  for (const k of keywords ?? []) {
    if (!k.cluster_id) continue;
    const arr = kwByCluster.get(k.cluster_id) ?? [];
    arr.push({ id: k.id, keyword: k.keyword });
    kwByCluster.set(k.cluster_id, arr);
  }

  const nodes: Array<Record<string, unknown>> = [];
  const edges: Array<Record<string, unknown>> = [];
  for (const cl of clusters ?? []) {
    nodes.push({
      id: `cluster:${cl.id}`,
      type: 'pillar',
      label: cl.name,
      pillarKeyword: cl.pillar_keyword,
    });
    const members = kwByCluster.get(cl.id) ?? [];
    // Pillar centroid for edge weights.
    const memberVecs = members.map((m) => vecByKw.get(m.id) ?? []).filter((v) => v.length > 0);
    const centroid =
      memberVecs.length > 0
        ? memberVecs[0].map(
            (_, d) => memberVecs.reduce((s, v) => s + (v[d] ?? 0), 0) / memberVecs.length,
          )
        : [];
    for (const m of members) {
      nodes.push({ id: `kw:${m.id}`, type: 'supporting', label: m.keyword, clusterId: cl.id });
      const vec = vecByKw.get(m.id) ?? [];
      const weight =
        centroid.length && vec.length ? Math.round(cosine(vec, centroid) * 1000) / 1000 : null;
      edges.push({ source: `cluster:${cl.id}`, target: `kw:${m.id}`, weight });
    }
  }
  return createCorsResponse({ nodes, edges }, 200, req);
}

async function moveKeyword(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = moveKeywordSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  // Verify target cluster belongs to tenant.
  const { data: cluster } = await admin
    .from('blog_keyword_clusters')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('id', parsed.data.to_cluster_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!cluster) return createCorsResponse({ error: 'Target cluster not found' }, 404, req);

  const { data, error } = await admin
    .from('blog_keywords')
    .update({ cluster_id: parsed.data.to_cluster_id, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', parsed.data.keyword_id)
    .select()
    .maybeSingle();
  if (error) return createCorsResponse({ error: 'Failed to move keyword' }, 500, req);
  if (!data) return createCorsResponse({ error: 'Keyword not found' }, 404, req);

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_topic_intel.cluster_move_keyword',
      targetType: 'blog_keyword',
      targetId: parsed.data.keyword_id,
      afterState: { to_cluster_id: parsed.data.to_cluster_id },
    }),
  );
  return createCorsResponse({ keyword: data }, 200, req);
}

async function splitCluster(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = splitSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const { data: source } = await admin
    .from('blog_keyword_clusters')
    .select('id,pillar_keyword')
    .eq('tenant_id', tenantId)
    .eq('id', parsed.data.cluster_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!source) return createCorsResponse({ error: 'Source cluster not found' }, 404, req);

  const { data: newCluster, error: clErr } = await admin
    .from('blog_keyword_clusters')
    .insert({
      tenant_id: tenantId,
      name: parsed.data.new_cluster_name,
      cluster_type: 'pillar',
      created_by_user_id: userId,
    })
    .select()
    .single();
  if (clErr || !newCluster)
    return createCorsResponse({ error: 'Failed to create cluster' }, 500, req);

  await admin
    .from('blog_keywords')
    .update({ cluster_id: newCluster.id, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .in('id', parsed.data.keyword_ids);

  await admin.from('blog_cluster_extensions').insert({
    tenant_id: tenantId,
    cluster_id: newCluster.id,
    name: parsed.data.new_cluster_name,
    status: 'planned',
    created_by_user_id: userId,
  });

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_topic_intel.cluster_split',
      targetType: 'blog_keyword_clusters',
      targetId: newCluster.id,
      summary: `Split ${parsed.data.keyword_ids.length} keywords into "${parsed.data.new_cluster_name}"`,
      afterState: { from: parsed.data.cluster_id, moved: parsed.data.keyword_ids.length },
    }),
  );
  return createCorsResponse({ cluster: newCluster }, 201, req);
}

async function mergeClusters(admin: Admin, tenantId: string, userId: string, req: Request) {
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
  if (parsed.data.source_cluster_id === parsed.data.target_cluster_id) {
    return createCorsResponse({ error: 'Cannot merge a cluster into itself' }, 400, req);
  }
  const { data: clusters } = await admin
    .from('blog_keyword_clusters')
    .select('id')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .in('id', [parsed.data.source_cluster_id, parsed.data.target_cluster_id]);
  if (!clusters || clusters.length !== 2) {
    return createCorsResponse({ error: 'Both clusters must exist in this tenant' }, 404, req);
  }

  // Move all source keywords to the target, then soft-delete the source.
  await admin
    .from('blog_keywords')
    .update({ cluster_id: parsed.data.target_cluster_id, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('cluster_id', parsed.data.source_cluster_id);
  await admin
    .from('blog_keyword_clusters')
    .update({ deleted_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', parsed.data.source_cluster_id);
  await admin
    .from('blog_cluster_extensions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('cluster_id', parsed.data.source_cluster_id);

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_topic_intel.cluster_merge',
      targetType: 'blog_keyword_clusters',
      targetId: parsed.data.target_cluster_id,
      summary: 'Merged clusters',
      afterState: { source: parsed.data.source_cluster_id, target: parsed.data.target_cluster_id },
    }),
  );
  return createCorsResponse({ merged_into: parsed.data.target_cluster_id }, 200, req);
}

// ===========================================================================
// US-BLOG-022 — topical authority scoring
// ===========================================================================
async function computeClusterAuthority(
  admin: Admin,
  tenantId: string,
  clusterId: string,
): Promise<{ score: number; breakdown: Record<string, unknown> }> {
  const { data: kws } = await admin
    .from('blog_keywords')
    .select('id,keyword')
    .eq('tenant_id', tenantId)
    .eq('cluster_id', clusterId)
    .limit(2000);
  const keywordCount = (kws ?? []).length;

  // Posts in this cluster (for "% keywords with published content").
  const { data: posts } = await admin
    .from('blog_posts')
    .select('id,status')
    .eq('tenant_id', tenantId)
    .eq('cluster_id', clusterId)
    .is('deleted_at', null)
    .limit(2000);
  const publishedPosts = (posts ?? []).filter((p) => p.status === 'published');
  const postIds = (posts ?? []).map((p) => p.id);

  // Latest position + impressions per post from performance metrics.
  let positions: number[] = [];
  let totalImpressions = 0;
  let postsTop10 = 0;
  if (postIds.length > 0) {
    const { data: metrics } = await admin
      .from('blog_performance_metrics')
      .select('post_id,position,impressions,metric_date')
      .eq('tenant_id', tenantId)
      .in('post_id', postIds)
      .order('metric_date', { ascending: false })
      .limit(5000);
    const latestByPost = new Map<string, { position: number | null; impressions: number | null }>();
    for (const m of metrics ?? []) {
      if (!latestByPost.has(m.post_id)) {
        latestByPost.set(m.post_id, { position: m.position, impressions: m.impressions });
      }
      totalImpressions += Number(m.impressions ?? 0);
    }
    for (const v of latestByPost.values()) {
      if (v.position != null) {
        positions.push(Number(v.position));
        if (Number(v.position) <= 10) postsTop10++;
      }
    }
  }

  const denom = keywordCount || 1;
  const pctTop10 = Math.min(1, postsTop10 / denom); // posts ranking top10 over cluster kw count
  const pctWithContent = Math.min(1, publishedPosts.length / denom);
  const avgRank = positions.length ? positions.reduce((s, p) => s + p, 0) / positions.length : null;
  // Rank component: rank 1 -> 1.0, rank 50+ -> 0.
  const rankComponent = avgRank == null ? 0 : Math.max(0, (50 - avgRank) / 49);
  // Impressions component: log-scaled, capped.
  const impComponent = totalImpressions > 0 ? Math.min(1, Math.log10(totalImpressions + 1) / 5) : 0;

  // Weighted blend normalized to 0-100.
  const score =
    Math.round(
      (0.35 * pctTop10 + 0.3 * pctWithContent + 0.2 * rankComponent + 0.15 * impComponent) *
        100 *
        100,
    ) / 100;

  return {
    score,
    breakdown: {
      keyword_count: keywordCount,
      pct_top10: Math.round(pctTop10 * 1000) / 1000,
      pct_with_content: Math.round(pctWithContent * 1000) / 1000,
      avg_rank: avgRank == null ? null : Math.round(avgRank * 100) / 100,
      total_impressions: totalImpressions,
      published_posts: publishedPosts.length,
      posts_top10: postsTop10,
    },
  };
}

async function recomputeAuthority(admin: Admin, tenantId: string, userId: string, req: Request) {
  const { data: clusters, error } = await admin
    .from('blog_keyword_clusters')
    .select('id')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .limit(1000);
  if (error) {
    console.error('blog-topic-intel recomputeAuthority load error', error);
    return createCorsResponse({ error: 'Failed to load clusters' }, 500, req);
  }
  const results: Array<{ cluster_id: string; score: number }> = [];
  for (const cl of clusters ?? []) {
    const { score, breakdown } = await computeClusterAuthority(admin, tenantId, cl.id);
    await admin.from('blog_cluster_authority_scores').insert({
      tenant_id: tenantId,
      cluster_id: cl.id,
      score,
      breakdown,
      computed_at: new Date().toISOString(),
      created_by_user_id: userId,
    });
    // Mirror onto the existing cluster row's denormalized score column.
    await admin
      .from('blog_keyword_clusters')
      .update({ topical_authority_score: score, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', cl.id);
    results.push({ cluster_id: cl.id, score });
  }
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_topic_intel.authority_recompute',
      targetType: 'blog_cluster_authority_scores',
      targetId: null,
      summary: `Recomputed authority for ${results.length} clusters`,
      afterState: { count: results.length },
    }),
  );
  return createCorsResponse({ recomputed: results.length, results }, 200, req);
}

async function getClusterAuthority(
  admin: Admin,
  tenantId: string,
  clusterId: string,
  req: Request,
) {
  const { data: latest } = await admin
    .from('blog_cluster_authority_scores')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('cluster_id', clusterId)
    .order('computed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // 90-day trend.
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: trend } = await admin
    .from('blog_cluster_authority_scores')
    .select('score,computed_at,breakdown')
    .eq('tenant_id', tenantId)
    .eq('cluster_id', clusterId)
    .gte('computed_at', since)
    .order('computed_at', { ascending: true })
    .limit(200);

  if (!latest) {
    return createCorsResponse(
      { error: 'No authority score yet — run POST /clusters/authority/recompute.' },
      404,
      req,
    );
  }
  return createCorsResponse({ latest, trend: trend ?? [] }, 200, req);
}

async function authorityHeatmap(admin: Admin, tenantId: string, req: Request) {
  const { data: clusters } = await admin
    .from('blog_keyword_clusters')
    .select('id,name')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .limit(1000);
  const rows: Array<Record<string, unknown>> = [];
  for (const cl of clusters ?? []) {
    const { data: latest } = await admin
      .from('blog_cluster_authority_scores')
      .select('score,computed_at,breakdown')
      .eq('tenant_id', tenantId)
      .eq('cluster_id', cl.id)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const score = latest ? Number(latest.score) : null;
    rows.push({
      cluster_id: cl.id,
      name: cl.name,
      score,
      // Heatmap color band for the UI.
      band: score == null ? 'none' : score >= 70 ? 'strong' : score >= 40 ? 'moderate' : 'weak',
      computed_at: latest?.computed_at ?? null,
      breakdown: latest?.breakdown ?? null,
    });
  }
  return createCorsResponse({ rows }, 200, req);
}

// ===========================================================================
// US-BLOG-020 — internal link opportunity finder
// ===========================================================================
function postEmbedText(post: {
  title: string;
  body_markdown: string | null;
  excerpt: string | null;
}): string {
  return `${post.title}\n\n${(post.body_markdown || post.excerpt || '').slice(0, 12000)}`;
}

async function embedPost(
  admin: Admin,
  tenantId: string,
  userId: string,
  postId: string,
  req: Request,
) {
  const { data: post, error } = await admin
    .from('blog_posts')
    .select('id,title,body_markdown,excerpt')
    .eq('tenant_id', tenantId)
    .eq('id', postId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) return createCorsResponse({ error: 'Failed to load post' }, 500, req);
  if (!post) return createCorsResponse({ error: 'Post not found' }, 404, req);

  const text = postEmbedText(post);
  const [vec] = await embedTexts([text]);

  // Derive a primary keyword (first cluster keyword or title) for anchor matching.
  let primaryKeyword = post.title;
  const { data: kw } = await admin
    .from('blog_keywords')
    .select('keyword')
    .eq('tenant_id', tenantId)
    .limit(1);
  if (kw && kw[0]) primaryKeyword = kw[0].keyword;

  await admin.from('blog_post_embeddings').delete().eq('tenant_id', tenantId).eq('post_id', postId);
  const { data: row, error: insErr } = await admin
    .from('blog_post_embeddings')
    .insert({
      tenant_id: tenantId,
      post_id: postId,
      embedding_model: STUB_EMBED_MODEL,
      embedding: vec,
      dims: STUB_EMBED_DIMS,
      primary_keyword: primaryKeyword,
      content_hash: String(text.length),
      created_by_user_id: userId,
    })
    .select()
    .single();
  if (insErr) {
    console.error('blog-topic-intel embedPost insert error', insErr);
    return createCorsResponse({ error: 'Failed to store post embedding' }, 500, req);
  }
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_topic_intel.post_embed',
      targetType: 'blog_post_embeddings',
      targetId: row.id,
      summary: 'Embedded post body for internal-link discovery',
    }),
  );
  return createCorsResponse({ embedding: { id: row.id, dims: STUB_EMBED_DIMS } }, 200, req);
}

/** Shared: load this post's vector and rank other posts by cosine. */
async function rankSimilarPosts(
  admin: Admin,
  tenantId: string,
  postId: string,
  topN: number,
): Promise<
  Array<{ post_id: string; title: string; primary_keyword: string | null; similarity: number }>
> {
  const { data: self } = await admin
    .from('blog_post_embeddings')
    .select('embedding')
    .eq('tenant_id', tenantId)
    .eq('post_id', postId)
    .maybeSingle();
  if (!self) return [];
  const selfVec = asNumberArray(self.embedding);
  if (selfVec.length === 0) return [];

  const { data: others } = await admin
    .from('blog_post_embeddings')
    .select('post_id,embedding,primary_keyword')
    .eq('tenant_id', tenantId)
    .neq('post_id', postId)
    .limit(2000);
  const otherPostIds = (others ?? []).map((o) => o.post_id);
  const { data: posts } = otherPostIds.length
    ? await admin
        .from('blog_posts')
        .select('id,title')
        .eq('tenant_id', tenantId)
        .in('id', otherPostIds)
        .is('deleted_at', null)
    : { data: [] as Array<{ id: string; title: string }> };
  const titleById = new Map((posts ?? []).map((p) => [p.id, p.title]));

  return (others ?? [])
    .filter((o) => titleById.has(o.post_id))
    .map((o) => ({
      post_id: o.post_id as string,
      title: String(titleById.get(o.post_id)),
      primary_keyword: (o.primary_keyword as string | null) ?? null,
      similarity: Math.round(cosine(selfVec, asNumberArray(o.embedding)) * 100000) / 100000,
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topN);
}

async function suggestLinks(
  admin: Admin,
  tenantId: string,
  userId: string,
  postId: string,
  req: Request,
) {
  const { data: post } = await admin
    .from('blog_posts')
    .select('id,title,body_markdown,excerpt')
    .eq('tenant_id', tenantId)
    .eq('id', postId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!post) return createCorsResponse({ error: 'Post not found' }, 404, req);

  const candidates = await rankSimilarPosts(admin, tenantId, postId, 8);
  if (candidates.length === 0) {
    return createCorsResponse(
      {
        suggestions: [],
        note: 'No embeddings — POST /posts/:id/embed on the source and targets first.',
      },
      200,
      req,
    );
  }

  // LLM picks an anchor phrase from the SOURCE body matching each target's primary keyword.
  const sourceBody = (post.body_markdown || post.excerpt || '').slice(0, 6000);
  let anchors: Record<string, { anchor_text: string; snippet: string }> = {};
  try {
    const system =
      'You find internal-linking anchor text. For each target, pick a short phrase (2-6 words) ' +
      'that ALREADY appears in the source text and is a natural anchor pointing to the target. ' +
      'Return ONLY a JSON object keyed by target post id. ' +
      'Shape: {"<target_id>": {"anchor_text": string, "snippet": string (the sentence containing it)}}.';
    const userPrompt =
      `Source post: ${post.title}\nSource text:\n${sourceBody}\n\nTargets:\n` +
      candidates
        .map(
          (c) => `- ${c.post_id}: "${c.title}" (primary keyword: ${c.primary_keyword ?? c.title})`,
        )
        .join('\n');
    const raw = await generateCompletion({
      max_tokens: 1500,
      temperature: 0.3,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const obj = extractJsonObject(raw);
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v === 'object') {
        const vv = v as Record<string, unknown>;
        anchors[k] = {
          anchor_text: String(vv.anchor_text ?? '').slice(0, 200),
          snippet: String(vv.snippet ?? '').slice(0, 500),
        };
      }
    }
  } catch (err) {
    console.error('blog-topic-intel suggestLinks LLM error (non-fatal)', err);
  }

  // Persist suggestions (replace prior open suggestions for this source).
  await admin
    .from('blog_internal_link_suggestions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('source_post_id', postId)
    .eq('status', 'suggested')
    .is('deleted_at', null);

  const suggestions: unknown[] = [];
  for (const c of candidates) {
    const anchor = anchors[c.post_id] ?? { anchor_text: c.primary_keyword ?? c.title, snippet: '' };
    const { data: row } = await admin
      .from('blog_internal_link_suggestions')
      .insert({
        tenant_id: tenantId,
        source_post_id: postId,
        target_post_id: c.post_id,
        anchor_text: anchor.anchor_text,
        similarity: c.similarity,
        insert_meta: { snippet: anchor.snippet, target_title: c.title },
        status: 'suggested',
        created_by_user_id: userId,
      })
      .select()
      .single();
    if (row) suggestions.push(row);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_topic_intel.links_suggest',
      targetType: 'blog_posts',
      targetId: postId,
      summary: `Suggested ${suggestions.length} internal links`,
    }),
  );
  return createCorsResponse({ suggestions }, 200, req);
}

async function reverseLinks(admin: Admin, tenantId: string, postId: string, req: Request) {
  // Posts most similar to THIS post — i.e. content that should link back here.
  const candidates = await rankSimilarPosts(admin, tenantId, postId, 8);
  return createCorsResponse(
    {
      target_post_id: postId,
      should_link_back: candidates,
      note: candidates.length === 0 ? 'No embeddings available — embed posts first.' : undefined,
    },
    200,
    req,
  );
}

async function backfillLinks(
  admin: Admin,
  tenantId: string,
  userId: string,
  postId: string,
  req: Request,
) {
  // PR-style proposed inserts — does NOT auto-apply. Reuses suggestion logic,
  // then formats as a diff-like preview.
  const candidates = await rankSimilarPosts(admin, tenantId, postId, 10);
  const { data: post } = await admin
    .from('blog_posts')
    .select('id,title,body_markdown,excerpt')
    .eq('tenant_id', tenantId)
    .eq('id', postId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!post) return createCorsResponse({ error: 'Post not found' }, 404, req);

  const proposed = candidates.map((c) => ({
    target_post_id: c.post_id,
    target_title: c.title,
    similarity: c.similarity,
    anchor_text: c.primary_keyword ?? c.title,
    proposed_markdown: `[${c.primary_keyword ?? c.title}](/blog/${c.post_id})`,
    apply: false,
  }));

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_topic_intel.links_backfill_preview',
      targetType: 'blog_posts',
      targetId: postId,
      summary: `Generated ${proposed.length} backfill link proposals (not applied)`,
    }),
  );
  return createCorsResponse(
    { source_post_id: postId, proposed_inserts: proposed, auto_applied: false },
    200,
    req,
  );
}

// ===========================================================================
// US-BLOG-025 — source aggregator / citations
// ===========================================================================
async function captureCitation(
  admin: Admin,
  tenantId: string,
  userId: string,
  postId: string,
  req: Request,
) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = citationCreateSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const { data: post } = await admin
    .from('blog_posts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('id', postId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!post) return createCorsResponse({ error: 'Post not found' }, 404, req);

  const meta = await fetchUrlMetadata(parsed.data.url);

  // Next inline_position for this post.
  const { data: existing } = await admin
    .from('blog_citations')
    .select('inline_position')
    .eq('tenant_id', tenantId)
    .eq('post_id', postId)
    .order('inline_position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPos = (existing?.inline_position ?? 0) + 1;

  const { data: citation, error: citErr } = await admin
    .from('blog_citations')
    .insert({
      tenant_id: tenantId,
      post_id: postId,
      url: parsed.data.url,
      title: parsed.data.title ?? meta.title,
      author: parsed.data.author ?? meta.author,
      publication: parsed.data.publication ?? null,
      publish_date: parsed.data.publish_date ?? meta.publishDate ?? null,
      citation_text: parsed.data.citation_text ?? null,
      inline_position: nextPos,
    })
    .select()
    .single();
  if (citErr || !citation) {
    console.error('blog-topic-intel captureCitation insert error', citErr);
    return createCorsResponse({ error: 'Failed to store citation' }, 500, req);
  }

  // OG/excerpt overlay row.
  const { data: source } = await admin
    .from('blog_citation_sources')
    .insert({
      tenant_id: tenantId,
      citation_id: citation.id,
      post_id: postId,
      og_image_url: meta.ogImageUrl,
      excerpt: meta.excerpt,
      display_order: nextPos,
      fetch_adapter: 'stub-opengraph-fetch',
      fetched_at: new Date().toISOString(),
      created_by_user_id: userId,
    })
    .select()
    .single();

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_topic_intel.citation_capture',
      targetType: 'blog_citation',
      targetId: citation.id,
      summary: `Captured citation ${parsed.data.url}`,
    }),
  );
  return createCorsResponse(
    {
      citation,
      source,
      ref_id: `citation-${nextPos}`,
      inline_syntax: `[^citation-${nextPos}]`,
      note: 'OG fetcher is stubbed (US-BLOG-025) — title/author/og:image may be empty until wired.',
    },
    201,
    req,
  );
}

async function loadCitationsForPost(admin: Admin, tenantId: string, postId: string) {
  const { data: citations } = await admin
    .from('blog_citations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('post_id', postId)
    .order('inline_position', { ascending: true });
  const ids = (citations ?? []).map((c) => c.id);
  const { data: sources } = ids.length
    ? await admin
        .from('blog_citation_sources')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('citation_id', ids)
        .is('deleted_at', null)
    : { data: [] as Array<Record<string, unknown>> };
  const srcByCitation = new Map((sources ?? []).map((s) => [s.citation_id, s]));
  return (citations ?? []).map((c) => ({ ...c, source: srcByCitation.get(c.id) ?? null }));
}

async function listCitations(admin: Admin, tenantId: string, postId: string, req: Request) {
  const merged = await loadCitationsForPost(admin, tenantId, postId);
  return createCorsResponse({ citations: merged }, 200, req);
}

async function patchCitation(
  admin: Admin,
  tenantId: string,
  userId: string,
  citationId: string,
  req: Request,
) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = citationPatchSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const citCols: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) citCols.title = parsed.data.title;
  if (parsed.data.author !== undefined) citCols.author = parsed.data.author;
  if (parsed.data.publication !== undefined) citCols.publication = parsed.data.publication;
  if (parsed.data.publish_date !== undefined) citCols.publish_date = parsed.data.publish_date;
  if (parsed.data.citation_text !== undefined) citCols.citation_text = parsed.data.citation_text;

  let citation = null;
  if (Object.keys(citCols).length > 0) {
    const { data, error } = await admin
      .from('blog_citations')
      .update(citCols)
      .eq('tenant_id', tenantId)
      .eq('id', citationId)
      .select()
      .maybeSingle();
    if (error) return createCorsResponse({ error: 'Failed to update citation' }, 500, req);
    if (!data) return createCorsResponse({ error: 'Citation not found' }, 404, req);
    citation = data;
  } else {
    const { data } = await admin
      .from('blog_citations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', citationId)
      .maybeSingle();
    if (!data) return createCorsResponse({ error: 'Citation not found' }, 404, req);
    citation = data;
  }

  // Overlay fields (excerpt / og_image_url).
  if (parsed.data.excerpt !== undefined || parsed.data.og_image_url !== undefined) {
    const srcCols: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.excerpt !== undefined) srcCols.excerpt = parsed.data.excerpt;
    if (parsed.data.og_image_url !== undefined) srcCols.og_image_url = parsed.data.og_image_url;
    await admin
      .from('blog_citation_sources')
      .update(srcCols)
      .eq('tenant_id', tenantId)
      .eq('citation_id', citationId);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_topic_intel.citation_update',
      targetType: 'blog_citation',
      targetId: citationId,
    }),
  );
  return createCorsResponse({ citation }, 200, req);
}

async function reorderCitations(
  admin: Admin,
  tenantId: string,
  userId: string,
  postId: string,
  req: Request,
) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  let pos = 1;
  for (const id of parsed.data.citation_ids) {
    await admin
      .from('blog_citations')
      .update({ inline_position: pos })
      .eq('tenant_id', tenantId)
      .eq('post_id', postId)
      .eq('id', id);
    await admin
      .from('blog_citation_sources')
      .update({ display_order: pos, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('citation_id', id);
    pos++;
  }
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_topic_intel.citations_reorder',
      targetType: 'blog_posts',
      targetId: postId,
      summary: `Reordered ${parsed.data.citation_ids.length} citations`,
    }),
  );
  return createCorsResponse({ reordered: parsed.data.citation_ids.length }, 200, req);
}

async function renderCitations(admin: Admin, tenantId: string, postId: string, req: Request) {
  const merged = await loadCitationsForPost(admin, tenantId, postId);
  // Rendered references section (markdown) + schema.org Citation JSON-LD.
  const references = merged.map((c, i) => {
    const pos = (c.inline_position as number) ?? i + 1;
    const parts = [c.title || c.url, c.author, c.publication, c.publish_date].filter(Boolean);
    return {
      ref_id: `citation-${pos}`,
      number: pos,
      markdown: `${pos}. [${c.title || c.url}](${c.url})${c.author ? ` — ${c.author}` : ''}${
        c.publication ? `, ${c.publication}` : ''
      }${c.publish_date ? ` (${c.publish_date})` : ''}`,
      text: parts.join(', '),
    };
  });
  const jsonLd = merged.map((c) => ({
    '@type': 'CreativeWork',
    name: c.title || c.url,
    url: c.url,
    ...(c.author ? { author: { '@type': 'Person', name: c.author } } : {}),
    ...(c.publication ? { publisher: { '@type': 'Organization', name: c.publication } } : {}),
    ...(c.publish_date ? { datePublished: c.publish_date } : {}),
  }));
  return createCorsResponse(
    {
      references,
      citation_jsonld: { '@context': 'https://schema.org', citation: jsonLd },
    },
    200,
    req,
  );
}

// ===========================================================================
// US-BLOG-026 — readability + persona
// ===========================================================================
async function resolveAnalysisText(
  admin: Admin,
  tenantId: string,
  input: { post_id?: string; text?: string },
): Promise<{ text: string; postId: string | null } | null> {
  if (input.text && input.text.trim()) return { text: input.text, postId: input.post_id ?? null };
  if (input.post_id) {
    const { data: post } = await admin
      .from('blog_posts')
      .select('id,body_markdown,excerpt')
      .eq('tenant_id', tenantId)
      .eq('id', input.post_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (post) return { text: post.body_markdown || post.excerpt || '', postId: post.id };
  }
  return null;
}

async function resolvePersona(
  admin: Admin,
  tenantId: string,
  input: { brief_id?: string; persona?: string },
): Promise<string | null> {
  if (input.persona && input.persona.trim()) return input.persona;
  if (input.brief_id) {
    const { data: brief } = await admin
      .from('blog_briefs')
      .select('target_audience')
      .eq('tenant_id', tenantId)
      .eq('id', input.brief_id)
      .is('deleted_at', null)
      .maybeSingle();
    if (brief?.target_audience) return brief.target_audience;
  }
  return null;
}

function sentenceAnalysis(text: string, target: number) {
  const sentences = splitSentences(text);
  return sentences.map((s) => {
    const grade = fleschKincaidGrade(s);
    return { text: s, grade, tier: gradeTier(grade, target) };
  });
}

async function personaMatchScore(persona: string | null, text: string): Promise<number | null> {
  if (!persona) return null;
  try {
    const system =
      'You score how well a draft matches a target reader persona on tone and vocabulary. ' +
      'Return ONLY a JSON object: {"score": <0-100 integer>, "rationale": string}.';
    const userPrompt = `Persona:\n${persona.slice(0, 2000)}\n\nDraft (truncated):\n${text.slice(0, 4000)}`;
    const raw = await generateCompletion({
      max_tokens: 400,
      temperature: 0.2,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const obj = extractJsonObject(raw);
    const score = Number(obj.score);
    return Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : null;
  } catch (err) {
    console.error('blog-topic-intel personaMatchScore error (non-fatal)', err);
    return null;
  }
}

async function analyzeReadability(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = analyzeSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const resolved = await resolveAnalysisText(admin, tenantId, parsed.data);
  if (!resolved || !resolved.text.trim()) {
    return createCorsResponse(
      { error: 'Provide `text` or a `post_id` with body content.' },
      400,
      req,
    );
  }
  const target = parsed.data.target_grade ?? 8;
  const grade = fleschKincaidGrade(resolved.text);
  const sentences = sentenceAnalysis(resolved.text, target);
  const persona = await resolvePersona(admin, tenantId, parsed.data);
  const personaScore = await personaMatchScore(persona, resolved.text);

  const analysis = {
    flesch_kincaid_grade: grade,
    target_grade: target,
    gauge: grade,
    persona_match_score: personaScore,
    sentences,
  };

  // Persist the latest snapshot if it's tied to a post.
  if (resolved.postId) {
    await admin
      .from('blog_readability_snapshots')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('post_id', resolved.postId);
    await admin.from('blog_readability_snapshots').insert({
      tenant_id: tenantId,
      post_id: resolved.postId,
      flesch_kincaid_grade: grade,
      target_grade: target,
      persona_match_score: personaScore,
      analysis,
      computed_at: new Date().toISOString(),
      created_by_user_id: userId,
    });
    await writeAuditLog(
      admin,
      withRequestContext(req, {
        tenantId,
        actorUserId: userId,
        actorType: 'user',
        action: 'blog_topic_intel.readability_analyze',
        targetType: 'blog_posts',
        targetId: resolved.postId,
        summary: `FK grade ${grade}, persona ${personaScore ?? 'n/a'}`,
      }),
    );
  }
  return createCorsResponse(analysis, 200, req);
}

async function simplifySentence(_admin: Admin, _tenantId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = simplifySchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  let rewritten = parsed.data.sentence;
  try {
    const system =
      `You rewrite a sentence to roughly a Flesch-Kincaid grade ${parsed.data.target_grade} reading level ` +
      'while preserving meaning. Use shorter words and sentences. Return ONLY the rewritten sentence, no prose.';
    rewritten = (
      await generateCompletion({
        max_tokens: 400,
        temperature: 0.4,
        system,
        messages: [{ role: 'user', content: parsed.data.sentence }],
      })
    ).trim();
  } catch (err) {
    console.error('blog-topic-intel simplifySentence error', err);
    return createCorsResponse({ error: 'Simplify failed — model unavailable.' }, 502, req);
  }
  return createCorsResponse(
    {
      original: parsed.data.sentence,
      rewritten,
      original_grade: fleschKincaidGrade(parsed.data.sentence),
      rewritten_grade: fleschKincaidGrade(rewritten),
      target_grade: parsed.data.target_grade,
    },
    200,
    req,
  );
}

async function prePublishGate(admin: Admin, tenantId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = gateSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const resolved = await resolveAnalysisText(admin, tenantId, parsed.data);
  if (!resolved || !resolved.text.trim()) {
    return createCorsResponse(
      { error: 'Provide `text` or a `post_id` with body content.' },
      400,
      req,
    );
  }
  const target = parsed.data.target_grade ?? 8;
  const grade = fleschKincaidGrade(resolved.text);
  const persona = await resolvePersona(admin, tenantId, parsed.data);
  const personaScore = await personaMatchScore(persona, resolved.text);

  const warnings: string[] = [];
  if (personaScore != null && personaScore < 70) {
    warnings.push(`Persona match ${personaScore} < 70 — tone/vocabulary may not fit the audience.`);
  }
  if (Math.abs(grade - target) > 2) {
    warnings.push(`Reading grade ${grade} diverges >2 from target ${target}.`);
  }
  return createCorsResponse(
    {
      pass: warnings.length === 0,
      warnings,
      flesch_kincaid_grade: grade,
      target_grade: target,
      persona_match_score: personaScore,
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
    const { parts } = normalizePath(url.pathname, 'blog-topic-intel');
    const uid = user.id;

    // --- 017: seeds ---
    if (parts[0] === 'seeds' && !parts[1]) {
      if (req.method === 'GET') return await getSeeds(admin, tenantId, req);
      if (req.method === 'PUT' || req.method === 'POST')
        return await putSeeds(admin, tenantId, uid, req);
    }
    if (parts[0] === 'mine' && !parts[1] && req.method === 'POST') {
      return await mine(admin, tenantId, uid, req);
    }
    if (parts[0] === 'questions' && !parts[1] && req.method === 'GET') {
      return await listQuestions(admin, tenantId, url, req);
    }
    if (parts[0] === 'questions' && parts[1] === 'cluster' && req.method === 'POST') {
      return await clusterQuestions(admin, tenantId, uid, req);
    }

    // --- 019/022: clusters ---
    if (parts[0] === 'clusters') {
      if (!parts[1] && req.method === 'GET') return await listClusters(admin, tenantId, req);
      if (parts[1] === 'embed' && req.method === 'POST')
        return await embedKeywords(admin, tenantId, uid, req);
      if (parts[1] === 'build' && req.method === 'POST')
        return await buildClusters(admin, tenantId, uid, req);
      if (parts[1] === 'graph' && req.method === 'GET')
        return await clusterGraph(admin, tenantId, req);
      if (parts[1] === 'move-keyword' && req.method === 'POST')
        return await moveKeyword(admin, tenantId, uid, req);
      if (parts[1] === 'split' && req.method === 'POST')
        return await splitCluster(admin, tenantId, uid, req);
      if (parts[1] === 'merge' && req.method === 'POST')
        return await mergeClusters(admin, tenantId, uid, req);
      // authority
      if (parts[1] === 'authority' && parts[2] === 'recompute' && req.method === 'POST')
        return await recomputeAuthority(admin, tenantId, uid, req);
      if (parts[1] === 'authority' && parts[2] === 'heatmap' && req.method === 'GET')
        return await authorityHeatmap(admin, tenantId, req);
      if (parts[1] && parts[2] === 'authority' && req.method === 'GET')
        return await getClusterAuthority(admin, tenantId, parts[1], req);
    }

    // --- 020: posts/internal links + 025/026 nested under posts ---
    if (parts[0] === 'posts' && parts[1]) {
      const postId = parts[1];
      if (parts[2] === 'embed' && req.method === 'POST')
        return await embedPost(admin, tenantId, uid, postId, req);
      if (parts[2] === 'links' && !parts[3] && req.method === 'GET')
        return await suggestLinks(admin, tenantId, uid, postId, req);
      if (parts[2] === 'links' && parts[3] === 'reverse' && req.method === 'GET')
        return await reverseLinks(admin, tenantId, postId, req);
      if (parts[2] === 'links' && parts[3] === 'backfill' && req.method === 'POST')
        return await backfillLinks(admin, tenantId, uid, postId, req);
      // citations (025)
      if (parts[2] === 'citations' && !parts[3]) {
        if (req.method === 'POST') return await captureCitation(admin, tenantId, uid, postId, req);
        if (req.method === 'GET') return await listCitations(admin, tenantId, postId, req);
      }
      if (parts[2] === 'citations' && parts[3] === 'reorder' && req.method === 'POST')
        return await reorderCitations(admin, tenantId, uid, postId, req);
      if (parts[2] === 'citations' && parts[3] === 'render' && req.method === 'GET')
        return await renderCitations(admin, tenantId, postId, req);
    }

    // --- 025: citation edit by citation id ---
    if (parts[0] === 'citations' && parts[1] && !parts[2] && req.method === 'PATCH') {
      return await patchCitation(admin, tenantId, uid, parts[1], req);
    }

    // --- 026: readability ---
    if (parts[0] === 'readability') {
      if (parts[1] === 'analyze' && req.method === 'POST')
        return await analyzeReadability(admin, tenantId, uid, req);
      if (parts[1] === 'simplify' && req.method === 'POST')
        return await simplifySentence(admin, tenantId, req);
      if (parts[1] === 'gate' && req.method === 'POST')
        return await prePublishGate(admin, tenantId, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('blog-topic-intel handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}
