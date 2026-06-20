// Blog Inline Fact-Checker Edge Function (US-BLOG-037)
//
// Extracts factual claims from a draft, matches each to a captured citation
// (blog_citations), and asks the LLM whether the cited source supports the
// claim. Each verdict (supported | contradicts | not_found | needs_human) gets a
// confidence; <70% is flagged for human review. Results persist per run for the
// inline highlight overlay. Long posts can be run as a background job
// (blog_jobs) — the synchronous path here caps claim count.
//
// Routes (gated to platform admin OR users holding blog.post.edit):
//   POST /blog-fact-check/run?post_id=        run claim extraction + verdicts
//   GET  /blog-fact-check?post_id=&run_id=    fetch the latest (or a given) run
//
// Claim extraction + per-claim verdicts are LLM calls; citation matching is
// deterministic (substring + ref_key) over the post's stored citations.

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';
import { generateCompletion } from '../_shared/anthropic.ts';
import { extractJsonArray, extractJsonObject } from '../_shared/blog/llm-json.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const MAX_SYNC_CLAIMS = 25;
const CONFIDENCE_REVIEW_THRESHOLD = 0.7;

interface CitationRow {
  id: string;
  url: string;
  title: string | null;
  excerpt: string | null;
  citation_text: string | null;
  ref_key: string | null;
}

interface ExtractedClaim {
  claim: string;
  ref_key?: string;
}

type Verdict = 'supported' | 'contradicts' | 'not_found' | 'needs_human';

function hasBlogPostEdit(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const perms = meta.permissions;
  if (Array.isArray(perms) && perms.includes('blog.post.edit')) return true;
  const role = String(meta.role ?? '').toLowerCase();
  return role === 'platform_admin' || role === 'super_admin' || role === 'company_admin';
}

function normalizeVerdict(v: unknown): Verdict {
  const s = String(v ?? '').toLowerCase();
  if (s.includes('support')) return 'supported';
  if (s.includes('contradict') || s.includes('refut')) return 'contradicts';
  if (s.includes('not') || s.includes('absent') || s.includes('missing')) return 'not_found';
  return 'needs_human';
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
    const { parts } = normalizePath(url.pathname, 'blog-fact-check');
    const action = parts[0];

    if (action === 'run' && req.method === 'POST') {
      return await run(admin, tenantId, user.id, url, req);
    }
    if (!action && req.method === 'GET') {
      return await fetchRun(admin, tenantId, url, req);
    }
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('blog-fact-check handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

async function run(admin: Admin, tenantId: string, userId: string, url: URL, req: Request) {
  const postId = url.searchParams.get('post_id');
  if (!postId || !/^[0-9a-f-]{36}$/i.test(postId)) {
    return createCorsResponse({ error: 'Valid post_id query param required' }, 400, req);
  }

  const { data: post } = await admin
    .from('blog_posts')
    .select('id, title, body_markdown')
    .eq('tenant_id', tenantId)
    .eq('id', postId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!post) return createCorsResponse({ error: 'Post not found' }, 404, req);
  const body = (post.body_markdown ?? '').slice(0, 16_000);
  if (!body.trim()) return createCorsResponse({ error: 'Post has no body to check' }, 400, req);

  // Citations available to judge against.
  const { data: cites } = await admin
    .from('blog_citations')
    .select('id, url, title, excerpt, citation_text, ref_key')
    .eq('tenant_id', tenantId)
    .eq('post_id', postId);
  const citations = (cites ?? []) as CitationRow[];
  const byRefKey = new Map<string, CitationRow>();
  for (const c of citations) if (c.ref_key) byRefKey.set(c.ref_key.toLowerCase(), c);

  // 1. Extract claims (LLM).
  let claims: ExtractedClaim[] = [];
  try {
    const raw = await generateCompletion({
      max_tokens: 2000,
      temperature: 0.1,
      system:
        'Extract the factual, checkable claims from the article (statistics, dates, ' +
        'attributions, definitive statements). Skip opinions and generic advice. If a ' +
        'claim is near a [^refKey] citation marker, include that ref_key. Respond ONLY ' +
        'with a JSON array of { "claim": "<verbatim claim>", "ref_key": "<key or omit>" }.',
      messages: [{ role: 'user', content: body }],
    });
    claims = (extractJsonArray(raw) as ExtractedClaim[]).slice(0, MAX_SYNC_CLAIMS);
  } catch {
    return createCorsResponse({ error: 'Claim extraction failed' }, 502, req);
  }

  const runId = crypto.randomUUID();
  const results: Array<{
    claim: string;
    verdict: Verdict;
    confidence: number | null;
    citation_id: string | null;
    explanation: string | null;
    needs_review: boolean;
    char_start: number | null;
    char_end: number | null;
  }> = [];

  // 2. Per-claim verdict.
  for (const c of claims) {
    if (!c.claim) continue;
    // Match a citation: explicit ref_key, else first citation whose excerpt shares words.
    let cite: CitationRow | undefined =
      c.ref_key ? byRefKey.get(c.ref_key.toLowerCase()) : undefined;
    if (!cite && citations.length > 0) {
      const lc = c.claim.toLowerCase();
      cite = citations.find((x) =>
        (x.excerpt ?? x.citation_text ?? '')
          .toLowerCase()
          .split(/\W+/)
          .filter((w) => w.length > 5)
          .some((w) => lc.includes(w)),
      );
    }

    const idx = body.indexOf(c.claim);
    const charStart = idx >= 0 ? idx : null;
    const charEnd = idx >= 0 ? idx + c.claim.length : null;

    let verdict: Verdict = 'not_found';
    let confidence: number | null = null;
    let explanation: string | null = null;

    if (!cite) {
      verdict = 'needs_human';
      explanation = 'No citation matched this claim.';
      confidence = 0.5;
    } else {
      const sourceExcerpt = (cite.excerpt ?? cite.citation_text ?? '').slice(0, 2000);
      try {
        const raw = await generateCompletion({
          max_tokens: 400,
          temperature: 0.0,
          system:
            'Judge whether the SOURCE supports the CLAIM. Respond ONLY with JSON ' +
            '{ "verdict": "supported|contradicts|not_found", "confidence": 0..1, ' +
            '"explanation": "<one sentence>" }. Use not_found if the source does not ' +
            'address the claim.',
          messages: [
            {
              role: 'user',
              content: `CLAIM: ${c.claim}\n\nSOURCE (${cite.url}):\n${sourceExcerpt}`,
            },
          ],
        });
        const obj = extractJsonObject(raw);
        verdict = normalizeVerdict(obj.verdict);
        const conf = Number(obj.confidence);
        confidence = Number.isNaN(conf) ? null : Math.min(Math.max(conf, 0), 1);
        explanation = obj.explanation ? String(obj.explanation).slice(0, 1000) : null;
      } catch {
        verdict = 'needs_human';
        explanation = 'Verdict model error';
        confidence = 0.3;
      }
    }

    const needsReview =
      verdict === 'needs_human' ||
      verdict === 'contradicts' ||
      (confidence != null && confidence < CONFIDENCE_REVIEW_THRESHOLD);

    await admin.from('blog_fact_check_claims').insert({
      tenant_id: tenantId,
      post_id: postId,
      run_id: runId,
      claim_text: c.claim.slice(0, 4000),
      citation_id: cite?.id ?? null,
      verdict,
      confidence,
      explanation,
      char_start: charStart,
      char_end: charEnd,
    });

    results.push({
      claim: c.claim,
      verdict,
      confidence,
      citation_id: cite?.id ?? null,
      explanation,
      needs_review: needsReview,
      char_start: charStart,
      char_end: charEnd,
    });
  }

  const summary = {
    supported: results.filter((r) => r.verdict === 'supported').length,
    contradicts: results.filter((r) => r.verdict === 'contradicts').length,
    not_found: results.filter((r) => r.verdict === 'not_found').length,
    needs_human: results.filter((r) => r.verdict === 'needs_human').length,
    needs_review: results.filter((r) => r.needs_review).length,
  };

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_fact_check.run',
      targetType: 'blog_post',
      targetId: postId,
      afterState: { run_id: runId, claims: results.length, ...summary },
      summary: `Fact-checked ${results.length} claims (${summary.needs_review} need review)`,
    }),
  );

  return createCorsResponse({ run_id: runId, claims: results, summary }, 201, req);
}

async function fetchRun(admin: Admin, tenantId: string, url: URL, req: Request) {
  const postId = url.searchParams.get('post_id');
  if (!postId) return createCorsResponse({ error: 'post_id is required' }, 400, req);
  let runId = url.searchParams.get('run_id');

  if (!runId) {
    const { data: latest } = await admin
      .from('blog_fact_check_claims')
      .select('run_id, created_at')
      .eq('tenant_id', tenantId)
      .eq('post_id', postId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!latest) return createCorsResponse({ run_id: null, claims: [] }, 200, req);
    runId = latest.run_id;
  }

  const { data, error } = await admin
    .from('blog_fact_check_claims')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('post_id', postId)
    .eq('run_id', runId)
    .order('char_start', { ascending: true, nullsFirst: false });
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  return createCorsResponse({ run_id: runId, claims: data ?? [] }, 200, req);
}
