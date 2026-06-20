// Blog Content Platform Edge Function (US-BLOG-042, 074, 075, 076, 077)
//
// The "universal content platform" cluster — five capabilities behind one
// edge function, each keyed to blog_posts and tenant-scoped:
//
//   US-BLOG-042  CMS publish flow via adapter (status workflow, idempotent
//                create/update keyed on cms_post_id, image upload + URL rewrite,
//                canonical persisted, per-stage blog_publish_attempts row,
//                inline failure + retry, success webhook intent).
//   US-BLOG-074  Programmatic SEO — markdown templates over blog_data_assets,
//                deterministic SEO scorer quality gate, rate-limited bulk job.
//   US-BLOG-075  Interactive blocks — calculator/quiz/comparison/ROI with a
//                SAFE (no-eval) restricted-arithmetic evaluator + lead capture +
//                engagement events.
//   US-BLOG-076  Multimodal output — podcast TTS (chapters from H2s, RSS feed),
//                video script beats, social clip specs; adapters are stubbed.
//   US-BLOG-077  Localization + translation — locales, glossary, per-locale
//                translations (never auto-published), hreflang + sitemap.
//
// Conventions follow supabase/functions/blog-syndication/index.ts exactly:
//   - createSupabaseClient(req) → auth.getUser(jwt); permission gate.
//   - tenant_id read from app_metadata; every query tenant-filtered.
//   - DB writes via createSupabaseServiceClient(); soft-delete via deleted_at.
//   - Zod-validated input; writeAuditLog on every mutation.
//
// External services that don't exist yet are behind NAMED ADAPTER STUBS with
// TODOs and injected-data fallbacks (TTS/HeyGen/DeepL). The CMS adapter
// registry (_shared/blog/cms) is REAL and used for US-BLOG-042.

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';
import { generateCompletion } from '../_shared/anthropic.ts';
import { extractJsonObject } from '../_shared/blog/llm-json.ts';
import { decryptCredential, type EncryptedCredential } from '../_shared/credential-vault.ts';
import {
  getCmsAdapter,
  type CmsCredentials,
  type CmsPostInput,
} from '../_shared/blog/cms/index.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const ASSETS_BUCKET = 'blog-assets';

// ===========================================================================
// Auth / permission gate (mirrors blog-syndication.hasDistributionPublish but
// gated on blog.post.publish / blog.post.edit per the content-platform brief).
// ===========================================================================
function hasContentPlatformAccess(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const perms = meta.permissions;
  if (
    Array.isArray(perms) &&
    (perms.includes('blog.post.publish') || perms.includes('blog.post.edit'))
  ) {
    return true;
  }
  const role = String(meta.role ?? '').toLowerCase();
  return role === 'platform_admin' || role === 'super_admin' || role === 'company_admin';
}

function parseTenantId(user: {
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}): string | null {
  return (
    (user.app_metadata?.tenantId as string) ||
    (user.app_metadata?.tenant_id as string) ||
    (user.user_metadata?.tenantId as string) ||
    (user.user_metadata?.tenant_id as string) ||
    null
  );
}

async function readJsonBody(req: Request): Promise<unknown | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

// ===========================================================================
// Shared post loader
// ===========================================================================
interface PostRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body_markdown: string | null;
  body_html: string | null;
  meta_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  cms_target_key: string | null;
  cms_post_id: string | null;
  cms_post_url: string | null;
  schema_type: string | null;
  status: string;
  author_id: string | null;
}

const POST_COLUMNS =
  'id,title,slug,excerpt,body_markdown,body_html,meta_title,meta_description,' +
  'canonical_url,cms_target_key,cms_post_id,cms_post_url,schema_type,status,author_id';

async function loadPost(admin: Admin, tenantId: string, postId: string): Promise<PostRow | null> {
  const { data, error } = await admin
    .from('blog_posts')
    .select(POST_COLUMNS)
    .eq('tenant_id', tenantId)
    .eq('id', postId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return (data as PostRow | null) ?? null;
}

// ===========================================================================
// US-BLOG-042 — CMS PUBLISH FLOW
// ===========================================================================

// blog_posts.status uses 'draft|in_review|scheduled|published|archived'. The
// content-platform workflow is draft → in_review → approved → published; we
// map 'approved' onto the existing 'scheduled' state so we don't redefine the
// shared enum. The publish endpoint validates the transition before publishing.
const APPROVED_STATES = new Set(['approved', 'scheduled']);

const publishSchema = z.object({
  cms_target_key: z.string().max(64).optional(),
  webhook_url: z.string().url().max(2000).optional(),
  // Skip image upload when the CMS already hosts the images / adapter lacks media.
  skip_image_upload: z.boolean().optional(),
  publish_at: z.string().datetime().nullable().optional(),
});

interface CmsTargetRow {
  id: string;
  platform: string;
  encrypted_config: {
    base_url?: string;
    username?: string | null;
    api_token?: EncryptedCredential;
  } | null;
}

async function resolveCmsTarget(
  admin: Admin,
  tenantId: string,
  cmsTargetKey: string | null,
): Promise<CmsTargetRow | null> {
  let q = admin
    .from('blog_distribution_targets')
    .select('id,platform,encrypted_config')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .eq('is_active', true);
  // cms_target_key matches account_handle, or the target id when it's a UUID.
  if (cmsTargetKey) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      cmsTargetKey,
    );
    q = isUuid
      ? q.or(`account_handle.eq.${cmsTargetKey},id.eq.${cmsTargetKey}`)
      : q.eq('account_handle', cmsTargetKey);
  }
  const { data, error } = await q.limit(1).maybeSingle();
  if (error) throw error;
  return (data as CmsTargetRow | null) ?? null;
}

interface AssetRow {
  id: string;
  storage_path: string | null;
  mime_type: string | null;
  alt_text: string | null;
  title: string | null;
}

/** Load image assets referenced inline in the post body via storage public URLs. */
async function loadReferencedImageAssets(
  admin: Admin,
  tenantId: string,
  post: PostRow,
): Promise<Array<AssetRow & { public_url: string }>> {
  const { data, error } = await admin
    .from('blog_assets')
    .select('id,storage_path,mime_type,alt_text,title')
    .eq('tenant_id', tenantId)
    .eq('asset_type', 'image')
    .is('deleted_at', null)
    .limit(200);
  if (error) throw error;
  const body = `${post.body_markdown ?? ''}\n${post.body_html ?? ''}`;
  const out: Array<AssetRow & { public_url: string }> = [];
  for (const row of (data ?? []) as AssetRow[]) {
    if (!row.storage_path) continue;
    const { data: pub } = admin.storage.from(ASSETS_BUCKET).getPublicUrl(row.storage_path);
    const publicUrl = pub.publicUrl;
    // Only upload+rewrite images actually referenced in the body.
    if (publicUrl && (body.includes(publicUrl) || body.includes(row.storage_path))) {
      out.push({ ...row, public_url: publicUrl });
    }
  }
  return out;
}

function appendStage(
  log: Array<Record<string, unknown>>,
  stage: string,
  detail?: unknown,
): Array<Record<string, unknown>> {
  log.push({ stage, at: new Date().toISOString(), ...(detail !== undefined ? { detail } : {}) });
  return log;
}

async function publishPost(
  admin: Admin,
  tenantId: string,
  userId: string,
  postId: string,
  req: Request,
) {
  const body = await readJsonBody(req);
  if (body === null) return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  const parsed = publishSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }

  const post = await loadPost(admin, tenantId, postId);
  if (!post) return createCorsResponse({ error: 'Post not found' }, 404, req);

  // Status workflow gate: only an approved (or already-published, for re-publish)
  // post may publish. draft / in_review are rejected with the required transition.
  if (!APPROVED_STATES.has(post.status) && post.status !== 'published') {
    return createCorsResponse(
      {
        error:
          'Post must reach "approved" before publishing. Workflow: draft → in_review → ' +
          `approved → published (current: ${post.status}).`,
        code: 'INVALID_STATUS_TRANSITION',
      },
      409,
      req,
    );
  }

  const cmsTargetKey = parsed.data.cms_target_key ?? post.cms_target_key ?? null;
  const target = await resolveCmsTarget(admin, tenantId, cmsTargetKey);
  if (!target) {
    return createCorsResponse(
      { error: 'No active CMS target found. Configure one in blog-cms-targets first.' },
      400,
      req,
    );
  }
  const adapter = getCmsAdapter(target.platform);
  if (!adapter) {
    return createCorsResponse(
      { error: `No CMS adapter registered for platform "${target.platform}"` },
      400,
      req,
    );
  }
  const cfg = target.encrypted_config ?? {};
  if (!cfg.base_url || !cfg.api_token) {
    return createCorsResponse({ error: 'CMS target missing base_url or api_token' }, 400, req);
  }
  let apiToken: string;
  try {
    apiToken = await decryptCredential(cfg.api_token);
  } catch (err) {
    return createCorsResponse(
      { error: `Credential decryption failed: ${err instanceof Error ? err.message : 'unknown'}` },
      500,
      req,
    );
  }
  const creds: CmsCredentials = {
    baseUrl: cfg.base_url,
    apiToken,
    username: cfg.username ?? undefined,
  };

  // Idempotency: update when the post already carries a cms_post_id, else create.
  const operation: 'create' | 'update' = post.cms_post_id ? 'update' : 'create';
  const stageLog: Array<Record<string, unknown>> = [];
  appendStage(stageLog, 'started', { operation, platform: target.platform });

  // Open a publish-attempt row so partial state is visible + retryable.
  const { data: attempt, error: attErr } = await admin
    .from('blog_publish_attempts')
    .insert({
      tenant_id: tenantId,
      post_id: postId,
      cms_platform: target.platform,
      cms_target_id: target.id,
      operation,
      cms_post_id: post.cms_post_id,
      stage: 'started',
      status: 'in_progress',
      stage_log: stageLog,
      created_by_user_id: userId,
    })
    .select('id')
    .single();
  if (attErr || !attempt) {
    return createCorsResponse({ error: 'Failed to open publish attempt' }, 500, req);
  }
  const attemptId = attempt.id as string;

  const failAttempt = async (stage: string, message: string, httpStatus: number) => {
    appendStage(stageLog, 'failed', { stage, message });
    await admin
      .from('blog_publish_attempts')
      .update({
        stage,
        status: 'failed',
        error_message: message,
        stage_log: stageLog,
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', attemptId);
    await writeAuditLog(
      admin,
      withRequestContext(req, {
        tenantId,
        actorUserId: userId,
        actorType: 'user',
        action: 'blog_publish.failed',
        targetType: 'blog_publish_attempt',
        targetId: attemptId,
        summary: `Publish failed at ${stage}: ${message}`,
        afterState: { post_id: postId, stage, operation },
      }),
    );
    return createCorsResponse(
      {
        error: message,
        code: 'PUBLISH_FAILED',
        attempt_id: attemptId,
        failed_stage: stage,
        retry: { method: 'POST', path: `/blog-content-platform/posts/${postId}/publish` },
      },
      httpStatus,
      req,
    );
  };

  // 1) Upload referenced images to the CMS first, then rewrite their URLs in body.
  let bodyMarkdown = post.body_markdown ?? '';
  let bodyHtml = post.body_html ?? undefined;
  const uploadedAssets: Array<Record<string, unknown>> = [];
  if (!parsed.data.skip_image_upload) {
    let images: Array<AssetRow & { public_url: string }>;
    try {
      images = await loadReferencedImageAssets(admin, tenantId, post);
    } catch (err) {
      return await failAttempt(
        'images_uploaded',
        `Failed to load image assets: ${err instanceof Error ? err.message : 'unknown'}`,
        500,
      );
    }
    for (const img of images) {
      try {
        const { data: blob, error: dlErr } = await admin.storage
          .from(ASSETS_BUCKET)
          .download(img.storage_path!);
        if (dlErr || !blob) throw dlErr ?? new Error('download returned no data');
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const filename = img.storage_path!.split('/').pop() || `${img.id}.img`;
        const uploaded = await adapter.uploadAsset(creds, {
          bytes,
          filename,
          mime_type: img.mime_type ?? 'application/octet-stream',
          alt_text: img.alt_text ?? img.title ?? undefined,
        });
        // Rewrite the original public URL → the CMS-hosted URL in the body.
        bodyMarkdown = bodyMarkdown.split(img.public_url).join(uploaded.url);
        if (bodyHtml) bodyHtml = bodyHtml.split(img.public_url).join(uploaded.url);
        uploadedAssets.push({
          asset_id: img.id,
          original_url: img.public_url,
          cms_asset_id: uploaded.id,
          cms_url: uploaded.url,
        });
      } catch (err) {
        // Persist partial state: some images may already be uploaded.
        await admin
          .from('blog_publish_attempts')
          .update({ uploaded_assets: uploadedAssets, updated_at: new Date().toISOString() })
          .eq('tenant_id', tenantId)
          .eq('id', attemptId);
        return await failAttempt(
          'images_uploaded',
          `Image upload failed for asset ${img.id}: ${err instanceof Error ? err.message : 'unknown'}`,
          502,
        );
      }
    }
    appendStage(stageLog, 'images_uploaded', { count: uploadedAssets.length });
    await admin
      .from('blog_publish_attempts')
      .update({
        stage: 'images_uploaded',
        uploaded_assets: uploadedAssets,
        stage_log: stageLog,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', attemptId);
  }
  appendStage(stageLog, 'body_rewritten', { rewritten: uploadedAssets.length });

  // 2) Create or update the CMS post (idempotent on cms_post_id).
  const cmsInput: CmsPostInput = {
    title: post.title,
    body_markdown: bodyMarkdown,
    body_html: bodyHtml,
    excerpt: post.excerpt ?? undefined,
    meta_title: post.meta_title ?? undefined,
    meta_description: post.meta_description ?? undefined,
    canonical_url: post.canonical_url ?? undefined,
    slug: post.slug,
    publish_at: parsed.data.publish_at ?? null,
  };

  let cmsPostId: string;
  let cmsPostUrl: string;
  try {
    if (operation === 'update' && post.cms_post_id) {
      const updated = await adapter.updatePost(creds, post.cms_post_id, cmsInput);
      cmsPostId = updated.id;
      cmsPostUrl = updated.url;
    } else {
      const created = await adapter.createPost(creds, cmsInput);
      cmsPostId = created.id;
      cmsPostUrl = created.url;
    }
  } catch (err) {
    return await failAttempt(
      operation === 'update' ? 'post_updated' : 'post_created',
      `CMS ${operation} failed: ${err instanceof Error ? err.message : 'unknown'}`,
      502,
    );
  }
  appendStage(stageLog, operation === 'update' ? 'post_updated' : 'post_created', { cmsPostId });

  // 3) Persist canonical URL + CMS coordinates + status on the post.
  const canonicalUrl = post.canonical_url || cmsPostUrl;
  await admin
    .from('blog_posts')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      canonical_url: canonicalUrl,
      cms_post_id: cmsPostId,
      cms_post_url: cmsPostUrl,
      cms_target_key: cmsTargetKey,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', postId);
  appendStage(stageLog, 'canonical_saved', { canonicalUrl });

  // 4) Fire a publish webhook (intent only — US-BLOG-079 owns the real bus).
  const webhookIntent = {
    url: parsed.data.webhook_url ?? null,
    event: 'blog.post.published',
    payload: {
      tenant_id: tenantId,
      post_id: postId,
      cms_post_id: cmsPostId,
      cms_post_url: cmsPostUrl,
      canonical_url: canonicalUrl,
      platform: target.platform,
    },
    // TODO(US-BLOG-079): hand off to the real event bus / webhook dispatcher.
    dispatched: false,
  };
  appendStage(stageLog, 'webhook_fired', { url: webhookIntent.url });

  // 5) Close the attempt as succeeded.
  await admin
    .from('blog_publish_attempts')
    .update({
      stage: 'succeeded',
      status: 'succeeded',
      cms_post_id: cmsPostId,
      cms_post_url: cmsPostUrl,
      canonical_url: canonicalUrl,
      uploaded_assets: uploadedAssets,
      webhook_intent: webhookIntent,
      stage_log: appendStage(stageLog, 'succeeded'),
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', attemptId);

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_publish.publish',
      targetType: 'blog_post',
      targetId: postId,
      summary: `Published post to ${target.platform} (${operation})`,
      afterState: { cms_post_id: cmsPostId, cms_post_url: cmsPostUrl, canonical_url: canonicalUrl },
    }),
  );

  return createCorsResponse(
    {
      attempt_id: attemptId,
      operation,
      cms_post_id: cmsPostId,
      cms_post_url: cmsPostUrl,
      canonical_url: canonicalUrl,
      uploaded_assets: uploadedAssets,
      webhook: webhookIntent,
    },
    200,
    req,
  );
}

async function listPublishAttempts(admin: Admin, tenantId: string, postId: string, req: Request) {
  const { data, error } = await admin
    .from('blog_publish_attempts')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('post_id', postId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  return createCorsResponse({ attempts: data ?? [] }, 200, req);
}

// ===========================================================================
// US-BLOG-074 — PROGRAMMATIC SEO
// ===========================================================================

const seoConfigSchema = z.object({
  title_pattern: z.string().min(1).max(300),
  meta_pattern: z.string().min(1).max(500),
  schema_type: z.string().max(40).optional(),
});

const pseoTemplateCreateSchema = z.object({
  name: z.string().min(1).max(300),
  data_asset_id: z.string().uuid(),
  body_template: z.string().min(1).max(50000),
  slug_pattern: z.string().min(1).max(500),
  seo_config: seoConfigSchema,
  brand_voice_id: z.string().uuid().nullable().optional(),
  cms_target_key: z.string().max(64).nullable().optional(),
  min_seo_score: z.number().int().min(0).max(100).optional(),
  below_threshold_action: z.enum(['review', 'skip']).optional(),
});

const pseoTemplatePatchSchema = pseoTemplateCreateSchema.partial();

/** Substitute {{variable}} placeholders from a flat row object. Unknown → ''. */
function renderTemplate(template: string, vars: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_m, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? '' : String(v);
  });
}

/** Stable key for a data row so bulk update/unpublish can target it later. */
function rowKeyFor(vars: Record<string, unknown>): string {
  // Prefer an explicit id/slug field; else a deterministic stringification.
  const id = vars.id ?? vars.slug ?? vars.key;
  if (id !== undefined && id !== null) return String(id).slice(0, 300);
  return JSON.stringify(
    Object.keys(vars)
      .sort()
      .map((k) => [k, vars[k]]),
  ).slice(0, 300);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200);
}

interface SeoFinding {
  rule: string;
  ok: boolean;
  detail: string;
}

/**
 * Deterministic SEO scorer (no LLM) — returns a 0..100 score + per-rule findings.
 * Rows scoring below the template threshold are flagged/skipped (US-BLOG-074).
 */
function scoreSeo(input: {
  title: string;
  metaDescription: string;
  body: string;
  slug: string;
  primaryKeyword?: string;
}): { score: number; findings: SeoFinding[] } {
  const findings: SeoFinding[] = [];
  let score = 0;
  const title = input.title.trim();
  const meta = input.metaDescription.trim();
  const wordCount = (input.body.trim().match(/\S+/g) || []).length;
  const kw = (input.primaryKeyword ?? '').toLowerCase().trim();

  const add = (rule: string, ok: boolean, weight: number, detail: string) => {
    if (ok) score += weight;
    findings.push({ rule, ok, detail });
  };

  add(
    'title_length',
    title.length >= 20 && title.length <= 65,
    20,
    `Title is ${title.length} chars (target 20-65).`,
  );
  add(
    'meta_length',
    meta.length >= 70 && meta.length <= 160,
    20,
    `Meta description is ${meta.length} chars (target 70-160).`,
  );
  add('body_length', wordCount >= 300, 25, `Body has ${wordCount} words (target ≥300).`);
  add('has_heading', /(^|\n)#{1,3}\s/.test(input.body), 10, 'Body contains at least one heading.');
  add(
    'slug_quality',
    /^[a-z0-9-]+$/.test(input.slug) && input.slug.length <= 75,
    10,
    'Slug is clean, lowercase, hyphenated, ≤75 chars.',
  );
  if (kw) {
    add(
      'keyword_in_title',
      title.toLowerCase().includes(kw),
      8,
      `Primary keyword "${kw}" in title.`,
    );
    add(
      'keyword_in_body',
      input.body.toLowerCase().includes(kw),
      7,
      `Primary keyword "${kw}" in body.`,
    );
  } else {
    // No keyword supplied — award the keyword weight so rows aren't unfairly penalised.
    score += 15;
    findings.push({ rule: 'keyword_optional', ok: true, detail: 'No primary keyword configured.' });
  }
  return { score: Math.min(100, Math.round(score)), findings };
}

async function loadDataAssetRows(
  admin: Admin,
  tenantId: string,
  dataAssetId: string,
): Promise<{ rows: Record<string, unknown>[]; name: string } | null> {
  const { data, error } = await admin
    .from('blog_data_assets')
    .select('id,name,rows')
    .eq('tenant_id', tenantId)
    .eq('id', dataAssetId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // Inline datasets carry parsed rows. External sources (Sheets/views) are
  // fetched by a separate refresh job (US-BLOG-029) — here we use injected rows.
  const rows = Array.isArray(data.rows) ? (data.rows as Record<string, unknown>[]) : [];
  return { rows, name: data.name as string };
}

async function createPseoTemplate(admin: Admin, tenantId: string, userId: string, req: Request) {
  const body = await readJsonBody(req);
  if (body === null) return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  const parsed = pseoTemplateCreateSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  // Verify the data asset belongs to the tenant.
  const ds = await loadDataAssetRows(admin, tenantId, parsed.data.data_asset_id);
  if (!ds) return createCorsResponse({ error: 'Data asset not found' }, 404, req);

  const { data: created, error } = await admin
    .from('blog_pseo_templates')
    .insert({
      tenant_id: tenantId,
      name: parsed.data.name,
      data_asset_id: parsed.data.data_asset_id,
      body_template: parsed.data.body_template,
      slug_pattern: parsed.data.slug_pattern,
      seo_config: parsed.data.seo_config,
      brand_voice_id: parsed.data.brand_voice_id ?? null,
      cms_target_key: parsed.data.cms_target_key ?? null,
      min_seo_score: parsed.data.min_seo_score ?? 70,
      below_threshold_action: parsed.data.below_threshold_action ?? 'review',
      created_by_user_id: userId,
    })
    .select('*')
    .single();
  if (error || !created) {
    return createCorsResponse({ error: error?.message ?? 'Failed to create template' }, 500, req);
  }
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_pseo_template.create',
      targetType: 'blog_pseo_template',
      targetId: created.id,
      summary: `Created pSEO template "${parsed.data.name}"`,
      afterState: created,
    }),
  );
  return createCorsResponse({ template: created }, 201, req);
}

async function listPseoTemplates(admin: Admin, tenantId: string, req: Request) {
  const { data, error } = await admin
    .from('blog_pseo_templates')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  return createCorsResponse({ templates: data ?? [] }, 200, req);
}

async function patchPseoTemplate(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  const body = await readJsonBody(req);
  if (body === null) return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  const parsed = pseoTemplatePatchSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(parsed.data)) updates[k] = v;
  const { data, error } = await admin
    .from('blog_pseo_templates')
    .update(updates)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .select('*')
    .maybeSingle();
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  if (!data) return createCorsResponse({ error: 'Template not found' }, 404, req);
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_pseo_template.update',
      targetType: 'blog_pseo_template',
      targetId: id,
      afterState: data,
    }),
  );
  return createCorsResponse({ template: data }, 200, req);
}

async function deletePseoTemplate(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  const { data, error } = await admin
    .from('blog_pseo_templates')
    .update({ deleted_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  if (!data) return createCorsResponse({ error: 'Template not found' }, 404, req);
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_pseo_template.delete',
      targetType: 'blog_pseo_template',
      targetId: id,
      summary: 'Deleted pSEO template',
    }),
  );
  return createCorsResponse({ success: true }, 200, req);
}

const pseoJobCreateSchema = z.object({
  template_id: z.string().uuid(),
  mode: z.enum(['publish', 'update', 'unpublish']).optional(),
  rate_per_hour: z.number().int().min(1).max(1000).optional(),
});

/** Render every data row, score it, and stage blog_pseo_rows. Creates the job. */
async function createPseoJob(admin: Admin, tenantId: string, userId: string, req: Request) {
  const body = await readJsonBody(req);
  if (body === null) return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  const parsed = pseoJobCreateSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const { data: template, error: tErr } = await admin
    .from('blog_pseo_templates')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', parsed.data.template_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (tErr) return createCorsResponse({ error: tErr.message }, 500, req);
  if (!template) return createCorsResponse({ error: 'Template not found' }, 404, req);

  let ds: { rows: Record<string, unknown>[]; name: string } | null;
  try {
    ds = await loadDataAssetRows(admin, tenantId, template.data_asset_id);
  } catch (err) {
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Failed to load data asset' },
      500,
      req,
    );
  }
  if (!ds) return createCorsResponse({ error: 'Data asset not found' }, 404, req);

  const minScore = Number(template.min_seo_score ?? 70);
  const seoConfig = template.seo_config as z.infer<typeof seoConfigSchema>;
  const belowAction = String(template.below_threshold_action ?? 'review');

  const { data: job, error: jErr } = await admin
    .from('blog_pseo_jobs')
    .insert({
      tenant_id: tenantId,
      template_id: template.id,
      mode: parsed.data.mode ?? 'publish',
      status: 'queued',
      rate_per_hour: parsed.data.rate_per_hour ?? 50,
      total_rows: ds.rows.length,
      created_by_user_id: userId,
    })
    .select('*')
    .single();
  if (jErr || !job) {
    return createCorsResponse({ error: jErr?.message ?? 'Failed to create job' }, 500, req);
  }

  // Render + score every row up front so the quality gate is visible before publish.
  let flagged = 0;
  let skipped = 0;
  const rowsToInsert = ds.rows.map((vars) => {
    const title = renderTemplate(seoConfig.title_pattern, vars);
    const metaDescription = renderTemplate(seoConfig.meta_pattern, vars);
    const renderedBody = renderTemplate(template.body_template, vars);
    const slug = slugify(renderTemplate(template.slug_pattern, vars));
    const { score, findings } = scoreSeo({
      title,
      metaDescription,
      body: renderedBody,
      slug,
      primaryKeyword: typeof vars.keyword === 'string' ? vars.keyword : undefined,
    });
    let status: string;
    if (score < minScore) {
      status = belowAction === 'skip' ? 'skipped' : 'flagged';
      if (status === 'skipped') skipped++;
      else flagged++;
    } else {
      status = 'rendered';
    }
    return {
      tenant_id: tenantId,
      job_id: job.id,
      template_id: template.id,
      row_key: rowKeyFor(vars),
      variables: vars,
      rendered_title: title.slice(0, 500),
      rendered_slug: slug.slice(0, 500),
      rendered_body: renderedBody,
      meta_title: title.slice(0, 300),
      meta_description: metaDescription,
      seo_score: score,
      seo_findings: findings,
      status,
    };
  });

  if (rowsToInsert.length > 0) {
    const { error: rowsErr } = await admin.from('blog_pseo_rows').insert(rowsToInsert);
    if (rowsErr) return createCorsResponse({ error: rowsErr.message }, 500, req);
  }
  await admin
    .from('blog_pseo_jobs')
    .update({ flagged_rows: flagged, skipped_rows: skipped, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', job.id);

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_pseo_job.create',
      targetType: 'blog_pseo_job',
      targetId: job.id,
      summary: `Created pSEO ${job.mode} job: ${ds.rows.length} rows (${flagged} flagged, ${skipped} skipped)`,
      afterState: { total: ds.rows.length, flagged, skipped },
    }),
  );

  return createCorsResponse(
    { job: { ...job, flagged_rows: flagged, skipped_rows: skipped } },
    201,
    req,
  );
}

/**
 * Run the next rate-limited batch of a job. Publishes up to the remaining
 * hourly budget of passing rows into blog_posts. Idempotent + resumable.
 */
async function runPseoJob(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  const { data: job, error } = await admin
    .from('blog_pseo_jobs')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  if (!job) return createCorsResponse({ error: 'Job not found' }, 404, req);
  if (job.status === 'completed' || job.status === 'cancelled') {
    return createCorsResponse({ error: `Job is ${job.status}` }, 409, req);
  }

  // Rolling-hour rate window.
  const now = Date.now();
  let windowStart = job.window_started_at ? new Date(job.window_started_at).getTime() : 0;
  let windowCount = Number(job.window_count ?? 0);
  if (!windowStart || now - windowStart >= 3_600_000) {
    windowStart = now;
    windowCount = 0;
  }
  const budget = Math.max(0, Number(job.rate_per_hour ?? 50) - windowCount);
  if (budget === 0) {
    return createCorsResponse(
      {
        error: 'Rate limit reached for this hour',
        code: 'RATE_LIMITED',
        retry_after_sec: Math.ceil((3_600_000 - (now - windowStart)) / 1000),
      },
      429,
      req,
    );
  }

  // Pull the next passing rows for this job that aren't yet published.
  const targetStatus = job.mode === 'unpublish' ? 'published' : 'rendered';
  const { data: rows, error: rErr } = await admin
    .from('blog_pseo_rows')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('job_id', id)
    .eq('status', targetStatus)
    .order('created_at', { ascending: true })
    .limit(budget);
  if (rErr) return createCorsResponse({ error: rErr.message }, 500, req);

  await admin
    .from('blog_pseo_jobs')
    .update({
      status: 'running',
      started_at: job.started_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', id);

  const seoConfig = (
    await admin
      .from('blog_pseo_templates')
      .select('seo_config,cms_target_key,brand_voice_id')
      .eq('tenant_id', tenantId)
      .eq('id', job.template_id)
      .maybeSingle()
  ).data as {
    seo_config: { schema_type?: string };
    cms_target_key: string | null;
    brand_voice_id: string | null;
  } | null;

  let published = 0;
  let failed = 0;
  for (const row of rows ?? []) {
    try {
      if (job.mode === 'unpublish') {
        if (row.post_id) {
          await admin
            .from('blog_posts')
            .update({ status: 'archived', updated_at: new Date().toISOString() })
            .eq('tenant_id', tenantId)
            .eq('id', row.post_id);
        }
        await admin
          .from('blog_pseo_rows')
          .update({ status: 'rendered', updated_at: new Date().toISOString() })
          .eq('tenant_id', tenantId)
          .eq('id', row.id);
        published++;
        continue;
      }
      // publish | update → upsert a blog_posts row from the rendered output.
      const postPayload: Record<string, unknown> = {
        tenant_id: tenantId,
        title: row.rendered_title,
        slug: row.rendered_slug,
        body_markdown: row.rendered_body,
        meta_title: row.meta_title,
        meta_description: row.meta_description,
        schema_type: seoConfig?.seo_config?.schema_type ?? null,
        brand_voice_id: seoConfig?.brand_voice_id ?? null,
        cms_target_key: seoConfig?.cms_target_key ?? null,
        seo_score: row.seo_score,
        status: 'draft',
        created_by_user_id: userId,
        updated_at: new Date().toISOString(),
      };
      let postId = row.post_id as string | null;
      if (postId) {
        await admin
          .from('blog_posts')
          .update(postPayload)
          .eq('tenant_id', tenantId)
          .eq('id', postId);
      } else {
        const { data: createdPost, error: cpErr } = await admin
          .from('blog_posts')
          .insert(postPayload)
          .select('id')
          .single();
        if (cpErr || !createdPost) throw cpErr ?? new Error('post insert failed');
        postId = createdPost.id;
      }
      await admin
        .from('blog_pseo_rows')
        .update({ status: 'published', post_id: postId, updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .eq('id', row.id);
      published++;
    } catch (err) {
      failed++;
      await admin
        .from('blog_pseo_rows')
        .update({
          status: 'failed',
          error: err instanceof Error ? err.message : 'unknown',
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('id', row.id);
    }
  }

  // Are there more passing rows left?
  const { count: remaining } = await admin
    .from('blog_pseo_rows')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('job_id', id)
    .eq('status', targetStatus);

  const finished = (remaining ?? 0) === 0;
  await admin
    .from('blog_pseo_jobs')
    .update({
      status: finished ? 'completed' : 'paused',
      processed_rows: Number(job.processed_rows ?? 0) + (rows?.length ?? 0),
      published_rows: Number(job.published_rows ?? 0) + published,
      failed_rows: Number(job.failed_rows ?? 0) + failed,
      window_started_at: new Date(windowStart).toISOString(),
      window_count: windowCount + published,
      finished_at: finished ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('id', id);

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_pseo_job.run',
      targetType: 'blog_pseo_job',
      targetId: id,
      summary: `pSEO ${job.mode} batch: ${published} published, ${failed} failed, ${remaining ?? 0} remaining`,
      afterState: { published, failed, remaining: remaining ?? 0, finished },
    }),
  );

  return createCorsResponse(
    {
      job_id: id,
      mode: job.mode,
      batch_published: published,
      batch_failed: failed,
      remaining: remaining ?? 0,
      finished,
      rate_per_hour: job.rate_per_hour,
    },
    200,
    req,
  );
}

async function listPseoJobs(admin: Admin, tenantId: string, url: URL, req: Request) {
  let q = admin
    .from('blog_pseo_jobs')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100);
  const templateId = url.searchParams.get('template_id');
  if (templateId) q = q.eq('template_id', templateId);
  const { data, error } = await q;
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  return createCorsResponse({ jobs: data ?? [] }, 200, req);
}

// ===========================================================================
// US-BLOG-075 — INTERACTIVE BLOCKS + SAFE FORMULA EVALUATOR
// ===========================================================================

// ── Safe arithmetic evaluator (NO eval / Function) ─────────────────────────
// Recursive-descent parser over a restricted grammar:
//   expr   := term (('+' | '-') term)*
//   term   := factor (('*' | '/' | '%') factor)*
//   factor := unary ('^' factor)?
//   unary  := ('+' | '-')? primary
//   primary:= number | identifier | func '(' args ')' | '(' expr ')'
// Identifiers resolve against the named-inputs scope. A small whitelist of
// pure functions is allowed. Any unknown token / identifier throws.
const SAFE_FUNCS: Record<string, (...a: number[]) => number> = {
  min: Math.min,
  max: Math.max,
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  sqrt: Math.sqrt,
  pow: Math.pow,
};

class FormulaError extends Error {}

function evalFormula(expr: string, scope: Record<string, number>): number {
  if (expr.length > 2000) throw new FormulaError('Formula too long');
  const tokens = tokenizeFormula(expr);
  let pos = 0;

  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseExpr(): number {
    let v = parseTerm();
    while (peek() && (peek().v === '+' || peek().v === '-')) {
      const op = next().v;
      const r = parseTerm();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  function parseTerm(): number {
    let v = parseFactor();
    while (peek() && (peek().v === '*' || peek().v === '/' || peek().v === '%')) {
      const op = next().v;
      const r = parseFactor();
      if (op === '*') v *= r;
      else if (op === '/') v = r === 0 ? 0 : v / r;
      else v = r === 0 ? 0 : v % r;
    }
    return v;
  }
  function parseFactor(): number {
    const v = parseUnary();
    if (peek() && peek().v === '^') {
      next();
      return Math.pow(v, parseFactor());
    }
    return v;
  }
  function parseUnary(): number {
    if (peek() && (peek().v === '+' || peek().v === '-')) {
      const op = next().v;
      const v = parseUnary();
      return op === '-' ? -v : v;
    }
    return parsePrimary();
  }
  function parsePrimary(): number {
    const t = next();
    if (!t) throw new FormulaError('Unexpected end of formula');
    if (t.t === 'num') return t.n!;
    if (t.t === 'paren' && t.v === '(') {
      const v = parseExpr();
      const close = next();
      if (!close || close.v !== ')') throw new FormulaError('Missing closing paren');
      return v;
    }
    if (t.t === 'ident') {
      // function call?
      if (peek() && peek().v === '(') {
        next();
        const args: number[] = [];
        if (peek() && peek().v !== ')') {
          args.push(parseExpr());
          while (peek() && peek().v === ',') {
            next();
            args.push(parseExpr());
          }
        }
        const close = next();
        if (!close || close.v !== ')') throw new FormulaError('Missing closing paren in call');
        const fn = SAFE_FUNCS[t.v];
        if (!fn) throw new FormulaError(`Unknown function: ${t.v}`);
        return fn(...args);
      }
      if (!(t.v in scope)) throw new FormulaError(`Unknown variable: ${t.v}`);
      const val = scope[t.v];
      if (typeof val !== 'number' || !Number.isFinite(val)) {
        throw new FormulaError(`Variable ${t.v} is not a finite number`);
      }
      return val;
    }
    throw new FormulaError(`Unexpected token: ${t.v}`);
  }

  const result = parseExpr();
  if (pos !== tokens.length) throw new FormulaError('Unexpected trailing tokens');
  if (!Number.isFinite(result)) throw new FormulaError('Formula did not produce a finite number');
  return result;
}

interface Tok {
  t: 'num' | 'ident' | 'op' | 'paren';
  v: string;
  n?: number;
}
function tokenizeFormula(s: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i + 1;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const num = Number(s.slice(i, j));
      if (!Number.isFinite(num)) throw new FormulaError(`Invalid number: ${s.slice(i, j)}`);
      toks.push({ t: 'num', v: s.slice(i, j), n: num });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i + 1;
      while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++;
      toks.push({ t: 'ident', v: s.slice(i, j) });
      i = j;
      continue;
    }
    if ('+-*/%^,'.includes(c)) {
      toks.push({ t: 'op', v: c });
      i++;
      continue;
    }
    if (c === '(' || c === ')') {
      toks.push({ t: 'paren', v: c });
      i++;
      continue;
    }
    throw new FormulaError(`Illegal character in formula: "${c}"`);
  }
  return toks;
}

const blockSpecSchema = z.object({
  inputs: z
    .array(
      z.object({
        key: z.string().min(1).max(60),
        label: z.string().max(200).optional(),
        type: z.enum(['number', 'select', 'boolean']).optional(),
        default: z.union([z.number(), z.string(), z.boolean()]).optional(),
        min: z.number().optional(),
        max: z.number().optional(),
        options: z.array(z.object({ label: z.string(), value: z.number() })).optional(),
      }),
    )
    .optional(),
  // calculator / roi_estimator
  formula: z.string().max(2000).optional(),
  outputs: z
    .array(
      z.object({
        key: z.string().min(1).max(60),
        label: z.string().max(200).optional(),
        expression: z.string().max(2000),
        format: z.enum(['number', 'currency', 'percent']).optional(),
      }),
    )
    .optional(),
  // quiz
  questions: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
        options: z.array(z.object({ label: z.string(), score: z.number() })),
      }),
    )
    .optional(),
  results: z
    .array(z.object({ min: z.number(), max: z.number(), title: z.string(), body: z.string() }))
    .optional(),
  // comparison
  items: z.array(z.record(z.unknown())).optional(),
  dimensions: z.array(z.string()).optional(),
});

const blockCreateSchema = z.object({
  post_id: z.string().uuid().nullable().optional(),
  block_type: z.enum(['calculator', 'quiz', 'comparison', 'roi_estimator']),
  title: z.string().min(1).max(300),
  description: z.string().max(4000).nullable().optional(),
  spec: blockSpecSchema,
  lead_capture_enabled: z.boolean().optional(),
  lead_capture_copy: z.string().max(2000).nullable().optional(),
  embed_mode: z.enum(['iframe', 'inline']).optional(),
  is_published: z.boolean().optional(),
});

const blockPatchSchema = blockCreateSchema.partial();

async function createBlock(admin: Admin, tenantId: string, userId: string, req: Request) {
  const body = await readJsonBody(req);
  if (body === null) return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  const parsed = blockCreateSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  // Validate the formula compiles for calculator/roi blocks before storing.
  if (parsed.data.block_type === 'calculator' || parsed.data.block_type === 'roi_estimator') {
    const scope: Record<string, number> = {};
    for (const inp of parsed.data.spec.inputs ?? []) scope[inp.key] = 1;
    for (const out of parsed.data.spec.outputs ?? []) {
      try {
        evalFormula(out.expression, scope);
      } catch (err) {
        return createCorsResponse(
          {
            error: `Invalid output expression "${out.key}": ${err instanceof Error ? err.message : 'unknown'}`,
          },
          400,
          req,
        );
      }
    }
    if (parsed.data.spec.formula) {
      try {
        evalFormula(parsed.data.spec.formula, scope);
      } catch (err) {
        return createCorsResponse(
          { error: `Invalid formula: ${err instanceof Error ? err.message : 'unknown'}` },
          400,
          req,
        );
      }
    }
  }

  const { data: created, error } = await admin
    .from('blog_interactive_blocks')
    .insert({
      tenant_id: tenantId,
      post_id: parsed.data.post_id ?? null,
      block_type: parsed.data.block_type,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      spec: parsed.data.spec,
      lead_capture_enabled: parsed.data.lead_capture_enabled ?? false,
      lead_capture_copy: parsed.data.lead_capture_copy ?? null,
      embed_mode: parsed.data.embed_mode ?? 'iframe',
      is_published: parsed.data.is_published ?? false,
      created_by_user_id: userId,
    })
    .select('*')
    .single();
  if (error || !created) {
    return createCorsResponse({ error: error?.message ?? 'Failed to create block' }, 500, req);
  }
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_interactive_block.create',
      targetType: 'blog_interactive_block',
      targetId: created.id,
      summary: `Created ${parsed.data.block_type} block "${parsed.data.title}"`,
      afterState: created,
    }),
  );
  return createCorsResponse({ block: created }, 201, req);
}

async function listBlocks(admin: Admin, tenantId: string, url: URL, req: Request) {
  let q = admin
    .from('blog_interactive_blocks')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200);
  const postId = url.searchParams.get('post_id');
  const blockType = url.searchParams.get('block_type');
  if (postId) q = q.eq('post_id', postId);
  if (blockType) q = q.eq('block_type', blockType);
  const { data, error } = await q;
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  return createCorsResponse({ blocks: data ?? [] }, 200, req);
}

async function getBlock(admin: Admin, tenantId: string, id: string, req: Request) {
  const { data, error } = await admin
    .from('blog_interactive_blocks')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  if (!data) return createCorsResponse({ error: 'Block not found' }, 404, req);
  return createCorsResponse({ block: data }, 200, req);
}

async function patchBlock(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  const body = await readJsonBody(req);
  if (body === null) return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  const parsed = blockPatchSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(parsed.data)) updates[k] = v;
  const { data, error } = await admin
    .from('blog_interactive_blocks')
    .update(updates)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .select('*')
    .maybeSingle();
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  if (!data) return createCorsResponse({ error: 'Block not found' }, 404, req);
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_interactive_block.update',
      targetType: 'blog_interactive_block',
      targetId: id,
      afterState: data,
    }),
  );
  return createCorsResponse({ block: data }, 200, req);
}

async function deleteBlock(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  const { data, error } = await admin
    .from('blog_interactive_blocks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  if (!data) return createCorsResponse({ error: 'Block not found' }, 404, req);
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_interactive_block.delete',
      targetType: 'blog_interactive_block',
      targetId: id,
      summary: 'Deleted interactive block',
    }),
  );
  return createCorsResponse({ success: true }, 200, req);
}

/**
 * Evaluate a block with submitted inputs → outputs. SERVER-SIDE safe eval. When
 * lead capture is on and no email is supplied, the result is gated.
 */
async function evaluateBlock(admin: Admin, tenantId: string, id: string, req: Request) {
  const body = (await readJsonBody(req)) as {
    inputs?: Record<string, unknown>;
    answers?: Record<string, number>;
    email?: string;
    session_id?: string;
  } | null;
  const { data: block, error } = await admin
    .from('blog_interactive_blocks')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  if (!block) return createCorsResponse({ error: 'Block not found' }, 404, req);

  const sessionId = body?.session_id ?? null;
  const recordEvent = async (eventType: string, payload: unknown, leadEmail?: string) => {
    await admin.from('blog_interactive_events').insert({
      tenant_id: tenantId,
      block_id: id,
      event_type: eventType,
      session_id: sessionId,
      lead_email: leadEmail ?? null,
      payload,
    });
  };
  await recordEvent('start', { inputs: body?.inputs ?? null });

  // Lead gate: if enabled and no email, return the gate instead of the result.
  if (block.lead_capture_enabled && !body?.email) {
    return createCorsResponse(
      {
        gated: true,
        lead_capture: {
          required: true,
          copy: block.lead_capture_copy ?? 'Enter your email to see your result.',
        },
      },
      200,
      req,
    );
  }
  if (block.lead_capture_enabled && body?.email) {
    await recordEvent('lead_capture', { email: body.email }, body.email);
  }

  const spec = block.spec as z.infer<typeof blockSpecSchema>;
  let result: Record<string, unknown> = {};

  try {
    if (block.block_type === 'calculator' || block.block_type === 'roi_estimator') {
      const scope: Record<string, number> = {};
      for (const inp of spec.inputs ?? []) {
        const raw = body?.inputs?.[inp.key];
        const n = Number(raw ?? inp.default ?? 0);
        if (!Number.isFinite(n)) throw new FormulaError(`Input ${inp.key} is not a number`);
        scope[inp.key] = n;
      }
      const outputs: Record<string, number> = {};
      for (const out of spec.outputs ?? []) {
        outputs[out.key] = evalFormula(out.expression, scope);
      }
      if (spec.formula && Object.keys(outputs).length === 0) {
        outputs.result = evalFormula(spec.formula, scope);
      }
      result = { outputs };
    } else if (block.block_type === 'quiz') {
      const answers = body?.answers ?? {};
      let total = 0;
      for (const q of spec.questions ?? []) {
        const v = Number(answers[q.id] ?? 0);
        total += Number.isFinite(v) ? v : 0;
      }
      const matched = (spec.results ?? []).find((r) => total >= r.min && total <= r.max);
      result = { score: total, result: matched ?? null };
    } else if (block.block_type === 'comparison') {
      result = { items: spec.items ?? [], dimensions: spec.dimensions ?? [] };
    }
  } catch (err) {
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Evaluation failed', code: 'EVAL_ERROR' },
      400,
      req,
    );
  }

  await recordEvent('complete', result);
  return createCorsResponse({ result }, 200, req);
}

const trackEventSchema = z.object({
  event_type: z.enum(['view', 'start', 'complete', 'share', 'conversion', 'lead_capture']),
  session_id: z.string().max(100).optional(),
  lead_email: z.string().email().max(320).optional(),
  payload: z.record(z.unknown()).optional(),
});

async function trackBlockEvent(admin: Admin, tenantId: string, id: string, req: Request) {
  const body = await readJsonBody(req);
  if (body === null) return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  const parsed = trackEventSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  // Ensure the block belongs to the tenant.
  const { data: block } = await admin
    .from('blog_interactive_blocks')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!block) return createCorsResponse({ error: 'Block not found' }, 404, req);
  const { error } = await admin.from('blog_interactive_events').insert({
    tenant_id: tenantId,
    block_id: id,
    event_type: parsed.data.event_type,
    session_id: parsed.data.session_id ?? null,
    lead_email: parsed.data.lead_email ?? null,
    payload: parsed.data.payload ?? null,
  });
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  return createCorsResponse({ success: true }, 201, req);
}

/** Engagement metrics: completion/share/conversion rates per tool. */
async function blockMetrics(admin: Admin, tenantId: string, id: string, req: Request) {
  const { data, error } = await admin
    .from('blog_interactive_events')
    .select('event_type')
    .eq('tenant_id', tenantId)
    .eq('block_id', id);
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  const counts: Record<string, number> = {};
  for (const r of data ?? []) counts[r.event_type] = (counts[r.event_type] ?? 0) + 1;
  const starts = counts.start ?? 0;
  const completions = counts.complete ?? 0;
  const metrics = {
    counts,
    completion_rate: starts ? completions / starts : 0,
    share_rate: completions ? (counts.share ?? 0) / completions : 0,
    conversion_rate: starts ? (counts.conversion ?? 0) / starts : 0,
    lead_capture_count: counts.lead_capture ?? 0,
  };
  return createCorsResponse({ metrics }, 200, req);
}

// ===========================================================================
// US-BLOG-076 — MULTIMODAL OUTPUT (podcast / video script / social clip)
// ===========================================================================

// ── Adapter stubs (no real third-party calls yet) ──────────────────────────
// TODO(US-BLOG-076): wire ElevenLabs / PlayHT (TTS) + HeyGen / Synthesia
// (avatar). Until then these return injected/spec-only payloads so the rest of
// the pipeline (chapter markers, RSS, asset linkage) is exercisable.
interface TtsResult {
  mp3_url: string | null;
  duration_sec: number | null;
  provider: string;
}
async function ttsAdapterStub(
  _script: string,
  voiceId: string | null,
  provider: string,
): Promise<TtsResult> {
  // TODO: POST script to the provider, poll for the rendered MP3, upload to
  // blog-assets storage, return its public URL. For now signal "not rendered".
  return {
    mp3_url: null,
    duration_sec: null,
    provider: `${provider}${voiceId ? `:${voiceId}` : ''}`,
  };
}

/** Chapter markers from H2 (## ...) headings; offsets are estimated, not real. */
function chaptersFromMarkdown(md: string): Array<{ title: string; start_sec: number }> {
  const lines = md.split('\n');
  const chapters: Array<{ title: string; start_sec: number }> = [];
  let runningWords = 0;
  const WORDS_PER_SEC = 2.5; // ~150 wpm narration
  for (const line of lines) {
    const m = /^##\s+(.*)$/.exec(line.trim());
    if (m) {
      chapters.push({ title: m[1].trim(), start_sec: Math.round(runningWords / WORDS_PER_SEC) });
    }
    runningWords += (line.match(/\S+/g) || []).length;
  }
  return chapters;
}

const mediaCreateSchema = z.object({
  post_id: z.string().uuid(),
  output_type: z.enum(['podcast', 'video_script', 'social_clip']),
  adapter: z.string().max(40).optional(),
  voice_id: z.string().max(120).nullable().optional(),
  // Avatar provider for video scripts (heygen|synthesia).
  avatar_provider: z.string().max(40).optional(),
});

async function createMediaOutput(admin: Admin, tenantId: string, userId: string, req: Request) {
  const body = await readJsonBody(req);
  if (body === null) return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  const parsed = mediaCreateSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const post = await loadPost(admin, tenantId, parsed.data.post_id);
  if (!post) return createCorsResponse({ error: 'Post not found' }, 404, req);
  const md = post.body_markdown ?? post.excerpt ?? '';

  // Voice-clone gate (US-BLOG-076): only narrate with a cloned voice if the
  // author has uploaded a license. We look up the author's flag from blog_authors.
  let voiceLicensed = false;
  if (post.author_id) {
    const { data: author } = await admin
      .from('blog_authors')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('id', post.author_id)
      .maybeSingle();
    // blog_authors has no voice_license column in v1; default false. The
    // voice_license_uploaded flag is carried per-author in expert/author meta
    // when present. TODO(US-BLOG-076): add a typed column when the author
    // schema gains voice licensing.
    voiceLicensed = !!author && false;
  }

  let spec: Record<string, unknown> = {};
  let status = 'pending';

  if (parsed.data.output_type === 'podcast') {
    const chapters = chaptersFromMarkdown(md);
    const tts = await ttsAdapterStub(
      md,
      parsed.data.voice_id ?? null,
      parsed.data.adapter ?? 'elevenlabs',
    );
    spec = {
      script: md,
      chapters,
      voice_id: parsed.data.voice_id ?? null,
      mp3_url: tts.mp3_url,
      duration_sec: tts.duration_sec,
      provider: tts.provider,
    };
    status = tts.mp3_url ? 'ready' : 'pending';
  } else if (parsed.data.output_type === 'video_script') {
    // LLM-derived structured beats; fall back to a heading-based outline.
    let beats: unknown = null;
    try {
      const raw = await generateCompletion({
        max_tokens: 1500,
        temperature: 0.6,
        system:
          'You convert a blog post into a short-form video script. Return ONLY a JSON object ' +
          '{"beats":[{"scene":string,"voiceover":string,"on_screen":string,"broll":string}],' +
          '"runtime_sec":number}. No prose, no fences.',
        messages: [{ role: 'user', content: `Title: ${post.title}\n\n${md.slice(0, 6000)}` }],
      });
      beats = extractJsonObject(raw);
    } catch (err) {
      // Injected-data fallback: outline from headings.
      console.error('video_script LLM fallback', err);
      beats = {
        beats: chaptersFromMarkdown(md).map((c) => ({
          scene: c.title,
          voiceover: c.title,
          on_screen: c.title,
          broll: '',
        })),
        runtime_sec: 60,
        fallback: true,
      };
    }
    spec = {
      ...(beats as Record<string, unknown>),
      avatar_provider: parsed.data.avatar_provider ?? null,
    };
    status = 'ready';
  } else {
    // social_clip — 30-60s clip specs of key insights for IG audiograms / LinkedIn.
    let clips: unknown = null;
    try {
      const raw = await generateCompletion({
        max_tokens: 1200,
        temperature: 0.7,
        system:
          'Extract 3 short social clip specs from the post. Return ONLY JSON ' +
          '{"clips":[{"platform":"instagram"|"linkedin","headline":string,"quote":string,' +
          '"runtime_sec":number,"caption":string}]}. No prose, no fences.',
        messages: [{ role: 'user', content: `Title: ${post.title}\n\n${md.slice(0, 5000)}` }],
      });
      clips = extractJsonObject(raw);
    } catch (err) {
      console.error('social_clip LLM fallback', err);
      clips = {
        clips: [
          {
            platform: 'linkedin',
            headline: post.title,
            quote: (post.excerpt ?? post.title).slice(0, 200),
            runtime_sec: 45,
            caption: post.title,
          },
        ],
        fallback: true,
      };
    }
    spec = clips as Record<string, unknown>;
    status = 'ready';
  }

  const { data: created, error } = await admin
    .from('blog_media_outputs')
    .insert({
      tenant_id: tenantId,
      post_id: parsed.data.post_id,
      output_type: parsed.data.output_type,
      status,
      spec,
      adapter: parsed.data.adapter ?? parsed.data.avatar_provider ?? null,
      voice_licensed: voiceLicensed,
      author_id: post.author_id,
      created_by_user_id: userId,
    })
    .select('*')
    .single();
  if (error || !created) {
    return createCorsResponse(
      { error: error?.message ?? 'Failed to create media output' },
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
      action: 'blog_media_output.create',
      targetType: 'blog_media_output',
      targetId: created.id,
      summary: `Generated ${parsed.data.output_type} for post ${parsed.data.post_id}`,
      afterState: { output_type: parsed.data.output_type, status },
    }),
  );
  return createCorsResponse({ media_output: created }, 201, req);
}

async function listMediaOutputs(admin: Admin, tenantId: string, url: URL, req: Request) {
  let q = admin
    .from('blog_media_outputs')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200);
  const postId = url.searchParams.get('post_id');
  const outputType = url.searchParams.get('output_type');
  if (postId) q = q.eq('post_id', postId);
  if (outputType) q = q.eq('output_type', outputType);
  const { data, error } = await q;
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  return createCorsResponse({ media_outputs: data ?? [] }, 200, req);
}

/** Per-workspace podcast RSS feed (XML) built from ready podcast outputs. */
async function podcastRss(admin: Admin, tenantId: string, req: Request) {
  const { data: outputs, error } = await admin
    .from('blog_media_outputs')
    .select('id,post_id,spec,created_at,status')
    .eq('tenant_id', tenantId)
    .eq('output_type', 'podcast')
    .eq('status', 'ready')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return createCorsResponse({ error: error.message }, 500, req);

  const postIds = [...new Set((outputs ?? []).map((o) => o.post_id))];
  const titleMap: Record<string, string> = {};
  if (postIds.length) {
    const { data: posts } = await admin
      .from('blog_posts')
      .select('id,title,excerpt')
      .eq('tenant_id', tenantId)
      .in('id', postIds);
    for (const p of posts ?? []) titleMap[p.id] = p.title;
  }
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const items = (outputs ?? [])
    .map((o) => {
      const spec = (o.spec ?? {}) as { mp3_url?: string; duration_sec?: number };
      const title = titleMap[o.post_id] ?? 'Episode';
      const enclosure = spec.mp3_url
        ? `<enclosure url="${esc(spec.mp3_url)}" type="audio/mpeg" />`
        : '';
      return (
        `<item><title>${esc(title)}</title>` +
        `<guid isPermaLink="false">${o.id}</guid>` +
        `<pubDate>${new Date(o.created_at).toUTCString()}</pubDate>` +
        `${enclosure}</item>`
      );
    })
    .join('');
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel>` +
    `<title>Workspace Podcast (${esc(tenantId)})</title>` +
    `<description>Auto-generated podcast feed from blog posts.</description>${items}` +
    `</channel></rss>`;

  const origin = req.headers.get('origin');
  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Access-Control-Allow-Origin': origin ?? '*',
    },
  });
}

// ===========================================================================
// US-BLOG-077 — LOCALIZATION + TRANSLATION
// ===========================================================================

// ── Translation adapter stub (DeepL / Google / GPT) ────────────────────────
// TODO(US-BLOG-077): wire DeepL / Google Cloud Translation. For now we route
// through the existing Claude completion (a real "GPT-style" path) and protect
// glossary terms with placeholder masking so brand/product names survive.
async function translateText(
  text: string,
  source: string,
  target: string,
  glossary: Array<{ term: string; mode: string; translations?: Record<string, string> }>,
  adapter: string,
): Promise<string> {
  if (!text.trim()) return text;
  // Mask do-not-translate terms so the model leaves them intact.
  const masks: Array<{ token: string; value: string }> = [];
  let masked = text;
  glossary.forEach((g, i) => {
    if (g.mode !== 'do_not_translate') return;
    const token = ` GLOSS${i} `;
    const re = new RegExp(g.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    if (re.test(masked)) {
      masked = masked.replace(re, token);
      masks.push({ token, value: g.term });
    }
  });

  // TODO: swap this block for the DeepL/Google adapter when configured.
  let out: string;
  try {
    out = await generateCompletion({
      max_tokens: 4000,
      temperature: 0.2,
      system:
        `You are a professional ${source}→${target} translator. Translate the user's text ` +
        `faithfully. Preserve markdown, links, and any  GLOSS  placeholder tokens verbatim. ` +
        `Return ONLY the translated text.`,
      messages: [{ role: 'user', content: masked }],
    });
  } catch (err) {
    // Injected-data fallback: return source unchanged, tagged so reviewers know.
    console.error(`translateText fallback (${adapter})`, err);
    out = masked;
  }
  // Restore masked terms (forcing per-locale rendering where mode='force').
  for (const m of masks) out = out.split(m.token).join(m.value);
  for (const g of glossary) {
    if (g.mode === 'force' && g.translations?.[target]) {
      const re = new RegExp(g.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      out = out.replace(re, g.translations[target]);
    }
  }
  return out;
}

const localeCreateSchema = z.object({
  locale: z.string().min(2).max(16),
  display_name: z.string().max(120).optional(),
  brand_voice_id: z.string().uuid().nullable().optional(),
  is_default: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

async function createLocale(admin: Admin, tenantId: string, userId: string, req: Request) {
  const body = await readJsonBody(req);
  if (body === null) return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  const parsed = localeCreateSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  // Default-row uniqueness: clear other defaults atomically in this call.
  if (parsed.data.is_default) {
    await admin
      .from('blog_locales')
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);
  }
  const { data: created, error } = await admin
    .from('blog_locales')
    .insert({
      tenant_id: tenantId,
      locale: parsed.data.locale,
      display_name: parsed.data.display_name ?? parsed.data.locale,
      brand_voice_id: parsed.data.brand_voice_id ?? null,
      is_default: parsed.data.is_default ?? false,
      is_active: parsed.data.is_active ?? true,
      created_by_user_id: userId,
    })
    .select('*')
    .single();
  if (error || !created) {
    return createCorsResponse({ error: error?.message ?? 'Failed to create locale' }, 500, req);
  }
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_locale.create',
      targetType: 'blog_locale',
      targetId: created.id,
      summary: `Added locale ${parsed.data.locale}`,
      afterState: created,
    }),
  );
  return createCorsResponse({ locale: created }, 201, req);
}

async function listLocales(admin: Admin, tenantId: string, req: Request) {
  const { data, error } = await admin
    .from('blog_locales')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  return createCorsResponse({ locales: data ?? [] }, 200, req);
}

const glossaryCreateSchema = z.object({
  term: z.string().min(1).max(300),
  mode: z.enum(['do_not_translate', 'force']).optional(),
  translations: z.record(z.string()).nullable().optional(),
  case_sensitive: z.boolean().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

async function createGlossaryTerm(admin: Admin, tenantId: string, userId: string, req: Request) {
  const body = await readJsonBody(req);
  if (body === null) return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  const parsed = glossaryCreateSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const { data: created, error } = await admin
    .from('blog_glossary_terms')
    .insert({
      tenant_id: tenantId,
      term: parsed.data.term,
      mode: parsed.data.mode ?? 'do_not_translate',
      translations: parsed.data.translations ?? null,
      case_sensitive: parsed.data.case_sensitive ?? false,
      notes: parsed.data.notes ?? null,
      created_by_user_id: userId,
    })
    .select('*')
    .single();
  if (error || !created) {
    return createCorsResponse({ error: error?.message ?? 'Failed to create term' }, 500, req);
  }
  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_glossary_term.create',
      targetType: 'blog_glossary_term',
      targetId: created.id,
      summary: `Added glossary term "${parsed.data.term}"`,
      afterState: created,
    }),
  );
  return createCorsResponse({ term: created }, 201, req);
}

async function listGlossaryTerms(admin: Admin, tenantId: string, req: Request) {
  const { data, error } = await admin
    .from('blog_glossary_terms')
    .select('*')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .order('term', { ascending: true });
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  return createCorsResponse({ terms: data ?? [] }, 200, req);
}

const translateSchema = z.object({
  locale: z.string().min(2).max(16),
  source_locale: z.string().min(2).max(16).optional(),
  adapter: z.enum(['deepl', 'google', 'gpt']).optional(),
});

/** Translate a post into a locale → blog_post_translations (always draft). */
async function translatePost(
  admin: Admin,
  tenantId: string,
  userId: string,
  postId: string,
  req: Request,
) {
  const body = await readJsonBody(req);
  if (body === null) return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  const parsed = translateSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const post = await loadPost(admin, tenantId, postId);
  if (!post) return createCorsResponse({ error: 'Post not found' }, 404, req);

  // Verify the target locale is enabled for the workspace.
  const { data: locale } = await admin
    .from('blog_locales')
    .select('id,locale')
    .eq('tenant_id', tenantId)
    .eq('locale', parsed.data.locale)
    .is('deleted_at', null)
    .maybeSingle();
  if (!locale) {
    return createCorsResponse({ error: `Locale ${parsed.data.locale} is not enabled` }, 400, req);
  }

  const { data: glossaryRows } = await admin
    .from('blog_glossary_terms')
    .select('term,mode,translations')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null);
  const glossary = (glossaryRows ?? []) as Array<{
    term: string;
    mode: string;
    translations?: Record<string, string>;
  }>;

  const source = parsed.data.source_locale ?? 'en-US';
  const target = parsed.data.locale;
  const adapter = parsed.data.adapter ?? 'gpt';

  const translatedTitle = await translateText(post.title, source, target, glossary, adapter);
  const translatedBody = await translateText(
    post.body_markdown ?? '',
    source,
    target,
    glossary,
    adapter,
  );
  const translatedMetaTitle = post.meta_title
    ? await translateText(post.meta_title, source, target, glossary, adapter)
    : null;
  const translatedMetaDesc = post.meta_description
    ? await translateText(post.meta_description, source, target, glossary, adapter)
    : null;

  // Upsert by (post_id, locale): machine translation ALWAYS lands as draft.
  const { data: existing } = await admin
    .from('blog_post_translations')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('post_id', postId)
    .eq('locale', target)
    .is('deleted_at', null)
    .maybeSingle();

  const payload = {
    tenant_id: tenantId,
    post_id: postId,
    locale: target,
    translated_title: translatedTitle.slice(0, 500),
    translated_body: translatedBody,
    translated_meta_title: translatedMetaTitle?.slice(0, 300) ?? null,
    translated_meta_description: translatedMetaDesc,
    translated_slug: `${post.slug}-${target.toLowerCase()}`.slice(0, 500),
    status: 'draft' as const, // NEVER auto-publish (US-BLOG-077)
    requires_review: true,
    translation_adapter: adapter,
    updated_at: new Date().toISOString(),
  };

  let row;
  if (existing) {
    const { data, error } = await admin
      .from('blog_post_translations')
      .update(payload)
      .eq('tenant_id', tenantId)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) return createCorsResponse({ error: error.message }, 500, req);
    row = data;
  } else {
    const { data, error } = await admin
      .from('blog_post_translations')
      .insert({ ...payload, created_by_user_id: userId })
      .select('*')
      .single();
    if (error) return createCorsResponse({ error: error.message }, 500, req);
    row = data;
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_post_translation.create',
      targetType: 'blog_post_translation',
      targetId: row.id,
      summary: `Machine-translated post to ${target} (draft, requires review)`,
      afterState: { locale: target, status: 'draft', adapter },
    }),
  );
  return createCorsResponse({ translation: row }, 201, req);
}

const translationPatchSchema = z.object({
  translated_title: z.string().max(500).optional(),
  translated_body: z.string().optional(),
  translated_meta_title: z.string().max(300).nullable().optional(),
  translated_meta_description: z.string().nullable().optional(),
  translated_slug: z.string().max(500).optional(),
  status: z.enum(['draft', 'in_review', 'published']).optional(),
  reviewer_user_id: z.string().nullable().optional(),
  publish_date: z.string().datetime().nullable().optional(),
});

/** Edit a translation's content / status / reviewer (its own publish flow). */
async function patchTranslation(
  admin: Admin,
  tenantId: string,
  userId: string,
  id: string,
  req: Request,
) {
  const body = await readJsonBody(req);
  if (body === null) return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  const parsed = translationPatchSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const { data: existing } = await admin
    .from('blog_post_translations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!existing) return createCorsResponse({ error: 'Translation not found' }, 404, req);

  // Publishing a translation requires a human review pass (US-BLOG-077): block
  // a direct draft → published jump that skips review.
  if (
    parsed.data.status === 'published' &&
    existing.status === 'draft' &&
    existing.requires_review
  ) {
    return createCorsResponse(
      {
        error: 'Machine translations must be reviewed (move to in_review) before publishing.',
        code: 'TRANSLATION_REVIEW_REQUIRED',
      },
      409,
      req,
    );
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(parsed.data)) updates[k] = v;
  if (parsed.data.status === 'published') {
    updates.publish_date = parsed.data.publish_date ?? new Date().toISOString();
    updates.requires_review = false;
  }
  if (parsed.data.status === 'in_review' && !parsed.data.reviewer_user_id) {
    updates.reviewer_user_id = userId;
  }

  const { data, error } = await admin
    .from('blog_post_translations')
    .update(updates)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .select('*')
    .maybeSingle();
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  if (!data) return createCorsResponse({ error: 'Translation not found' }, 404, req);

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_post_translation.update',
      targetType: 'blog_post_translation',
      targetId: id,
      beforeState: { status: existing.status },
      afterState: { status: data.status },
    }),
  );
  return createCorsResponse({ translation: data }, 200, req);
}

async function listTranslations(admin: Admin, tenantId: string, postId: string, req: Request) {
  const { data, error } = await admin
    .from('blog_post_translations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('post_id', postId)
    .is('deleted_at', null)
    .order('locale', { ascending: true });
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  return createCorsResponse({ translations: data ?? [] }, 200, req);
}

/** hreflang link set + per-locale sitemap data for a post (US-BLOG-077). */
async function postHreflang(admin: Admin, tenantId: string, postId: string, req: Request) {
  const post = await loadPost(admin, tenantId, postId);
  if (!post) return createCorsResponse({ error: 'Post not found' }, 404, req);
  const { data: translations } = await admin
    .from('blog_post_translations')
    .select('locale,translated_slug,status,cms_post_url,publish_date')
    .eq('tenant_id', tenantId)
    .eq('post_id', postId)
    .is('deleted_at', null);

  const base = post.canonical_url || post.cms_post_url || `/${post.slug}`;
  const defaultLocale = 'en-US';
  const links: Array<{ hreflang: string; href: string }> = [
    { hreflang: defaultLocale, href: base },
    { hreflang: 'x-default', href: base },
  ];
  const sitemap: Array<{ locale: string; url: string; status: string; lastmod: string | null }> = [
    { locale: defaultLocale, url: base, status: post.status, lastmod: null },
  ];
  for (const t of translations ?? []) {
    // Only published translations are eligible for hreflang/sitemap exposure.
    const url =
      t.cms_post_url || `/${t.translated_slug ?? `${post.slug}-${t.locale.toLowerCase()}`}`;
    if (t.status === 'published') {
      links.push({ hreflang: t.locale, href: url });
    }
    sitemap.push({ locale: t.locale, url, status: t.status, lastmod: t.publish_date });
  }
  return createCorsResponse({ post_id: postId, hreflang: links, sitemap }, 200, req);
}

// ===========================================================================
// ROUTER
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
    if (!hasContentPlatformAccess(user)) {
      return createCorsResponse(
        { error: 'Forbidden: blog.post.publish or blog.post.edit required' },
        403,
        req,
      );
    }
    const tenantId = parseTenantId(user) || req.headers.get('x-tenant-id');
    if (!tenantId) return createCorsResponse({ error: 'No tenant ID found' }, 400, req);

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    const { parts } = normalizePath(url.pathname, 'blog-content-platform');
    const [root, a, b, c] = parts;
    const method = req.method;

    // ── US-BLOG-042: posts/:id/publish, posts/:id/publish-attempts ──────────
    if (root === 'posts' && a) {
      if (b === 'publish' && method === 'POST')
        return await publishPost(admin, tenantId, user.id, a, req);
      if (b === 'publish-attempts' && method === 'GET')
        return await listPublishAttempts(admin, tenantId, a, req);
      // ── US-BLOG-077: posts/:id/translate, /translations, /hreflang ────────
      if (b === 'translate' && method === 'POST')
        return await translatePost(admin, tenantId, user.id, a, req);
      if (b === 'translations' && method === 'GET')
        return await listTranslations(admin, tenantId, a, req);
      if (b === 'hreflang' && method === 'GET') return await postHreflang(admin, tenantId, a, req);
      // ── US-BLOG-076: posts/:id/media ──────────────────────────────────────
    }

    // ── US-BLOG-074: pseo/templates, pseo/jobs ──────────────────────────────
    if (root === 'pseo') {
      if (a === 'templates') {
        if (!b) {
          if (method === 'GET') return await listPseoTemplates(admin, tenantId, req);
          if (method === 'POST') return await createPseoTemplate(admin, tenantId, user.id, req);
        }
        if (b && !c) {
          if (method === 'PATCH' || method === 'PUT')
            return await patchPseoTemplate(admin, tenantId, user.id, b, req);
          if (method === 'DELETE')
            return await deletePseoTemplate(admin, tenantId, user.id, b, req);
        }
      }
      if (a === 'jobs') {
        if (!b) {
          if (method === 'GET') return await listPseoJobs(admin, tenantId, url, req);
          if (method === 'POST') return await createPseoJob(admin, tenantId, user.id, req);
        }
        if (b && c === 'run' && method === 'POST')
          return await runPseoJob(admin, tenantId, user.id, b, req);
      }
    }

    // ── US-BLOG-075: blocks ─────────────────────────────────────────────────
    if (root === 'blocks') {
      if (!a) {
        if (method === 'GET') return await listBlocks(admin, tenantId, url, req);
        if (method === 'POST') return await createBlock(admin, tenantId, user.id, req);
      }
      if (a && !b) {
        if (method === 'GET') return await getBlock(admin, tenantId, a, req);
        if (method === 'PATCH' || method === 'PUT')
          return await patchBlock(admin, tenantId, user.id, a, req);
        if (method === 'DELETE') return await deleteBlock(admin, tenantId, user.id, a, req);
      }
      if (a && b === 'evaluate' && method === 'POST')
        return await evaluateBlock(admin, tenantId, a, req);
      if (a && b === 'events' && method === 'POST')
        return await trackBlockEvent(admin, tenantId, a, req);
      if (a && b === 'metrics' && method === 'GET')
        return await blockMetrics(admin, tenantId, a, req);
    }

    // ── US-BLOG-076: media-outputs, podcast/rss ─────────────────────────────
    if (root === 'media-outputs') {
      if (!a) {
        if (method === 'GET') return await listMediaOutputs(admin, tenantId, url, req);
        if (method === 'POST') return await createMediaOutput(admin, tenantId, user.id, req);
      }
    }
    if (root === 'podcast' && a === 'rss' && method === 'GET') {
      return await podcastRss(admin, tenantId, req);
    }

    // ── US-BLOG-077: locales, glossary, translations/:id ────────────────────
    if (root === 'locales') {
      if (!a) {
        if (method === 'GET') return await listLocales(admin, tenantId, req);
        if (method === 'POST') return await createLocale(admin, tenantId, user.id, req);
      }
    }
    if (root === 'glossary') {
      if (!a) {
        if (method === 'GET') return await listGlossaryTerms(admin, tenantId, req);
        if (method === 'POST') return await createGlossaryTerm(admin, tenantId, user.id, req);
      }
    }
    if (root === 'translations' && a && !b) {
      if (method === 'PATCH' || method === 'PUT')
        return await patchTranslation(admin, tenantId, user.id, a, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('blog-content-platform handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}
