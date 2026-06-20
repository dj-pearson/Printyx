// Blog Pre-Publish QA Edge Function (US-BLOG-040)
//
// A single QA pass that runs every pre-publish check so nothing slips through:
//   - Link checker: HEAD every internal + external link, flag 4xx/5xx/redirects.
//   - OG/Twitter card preview: structured per-platform (Slack, Twitter, LinkedIn,
//     iMessage) card data + length warnings (visual rendering is the UI's job).
//   - Accessibility: static-HTML heuristics (missing alt, heading-order skips,
//     generic link text, missing lang). NOTE: a full axe-core run needs a real
//     DOM and is performed browser-side in the QA panel; this is the server gate.
//   - Schema validator: re-checks JSON-LD requirements for the post's schema_type
//     (US-BLOG-027).
// The publish button enables only when overall_pass is true OR the report is
// explicitly overridden. Reports are cached 1h (link checks are the expensive
// part) — pass ?force=true to re-run.
//
// Routes (tenant-scoped, gated to blog.post.edit; override needs blog.post.publish):
//   POST /blog-prepublish-qa/run        body: { post_id, force? }
//   GET  /blog-prepublish-qa/:postId    latest report
//   POST /blog-prepublish-qa/override   body: { post_id, reason }

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const CACHE_MS = 60 * 60 * 1000; // 1h
const LINK_TIMEOUT_MS = 8000;
const MAX_LINKS = 100;

const runSchema = z.object({ post_id: z.string().uuid(), force: z.boolean().optional() });
const overrideSchema = z.object({ post_id: z.string().uuid(), reason: z.string().min(3).max(1000) });

function permFlags(user: { app_metadata?: Record<string, unknown> }) {
  const meta = user.app_metadata ?? {};
  const perms = Array.isArray(meta.permissions) ? (meta.permissions as string[]) : [];
  const role = String(meta.role ?? '').toLowerCase();
  const admin = meta.isPlatformAdmin === true || role === 'platform_admin' || role === 'super_admin';
  return {
    edit: admin || role === 'company_admin' || perms.includes('blog.post.edit'),
    publish: admin || perms.includes('blog.post.publish'),
  };
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
    const flags = permFlags(user);
    if (!flags.edit) {
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
    const { parts } = normalizePath(url.pathname, 'blog-prepublish-qa');
    const action = parts[0];

    if (action === 'run' && req.method === 'POST') {
      return await runQa(admin, tenantId, user.id, req);
    }
    if (action === 'override' && req.method === 'POST') {
      if (!flags.publish) {
        return createCorsResponse({ error: 'Forbidden: blog.post.publish required' }, 403, req);
      }
      return await override(admin, tenantId, user.id, req);
    }
    if (action && req.method === 'GET') {
      return await latest(admin, tenantId, action, req);
    }
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('blog-prepublish-qa handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

// ─── run ─────────────────────────────────────────────────────────────────────
async function runQa(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = runSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse({ error: 'post_id (uuid) required' }, 400, req);
  }
  const { post_id, force } = parsed.data;

  const { data: post } = await admin
    .from('blog_posts')
    .select(
      'id, title, slug, body_html, body_markdown, meta_title, meta_description, canonical_url, schema_type, featured_image_asset_id, author_user_id',
    )
    .eq('tenant_id', tenantId)
    .eq('id', post_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!post) return createCorsResponse({ error: 'Post not found' }, 404, req);

  // Cache: reuse the latest report if < 1h old and not forced.
  if (!force) {
    const { data: cached } = await admin
      .from('blog_qa_reports')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('post_id', post_id)
      .order('checked_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cached && Date.now() - new Date(cached.checked_at).getTime() < CACHE_MS) {
      return createCorsResponse({ report: cached, cached: true }, 200, req);
    }
  }

  // Resolve org domain for internal/external link classification + publisher.
  const { data: settings } = await admin
    .from('blog_agent_settings')
    .select('organization_name, organization_url, organization_logo_url, own_domain')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  const ownHost = hostOf(settings?.organization_url ?? null) ?? (settings?.own_domain ?? null);

  const html = String(post.body_html ?? '') || markdownLinksToHtml(String(post.body_markdown ?? ''));

  const linkCheck = await checkLinks(html, ownHost);
  const ogPreview = buildOgPreview(post, settings);
  const a11y = a11yHeuristics(html, String(post.body_markdown ?? ''));
  const schemaCheck = validateSchema(post, settings);

  // Gating: broken links, a11y high-severity violations, invalid schema fail the gate.
  const gatingFailures: string[] = [];
  if (linkCheck.broken.length > 0) gatingFailures.push('broken_links');
  if (a11y.violations.some((v) => v.severity === 'high')) gatingFailures.push('a11y_critical');
  if (!schemaCheck.valid) gatingFailures.push('invalid_schema');

  const summary = {
    checks: [
      { key: 'links', status: linkCheck.broken.length ? 'fail' : linkCheck.redirects.length ? 'warn' : 'pass', count: linkCheck.total },
      { key: 'og', status: ogPreview.warnings.length ? 'warn' : 'pass', count: ogPreview.warnings.length },
      { key: 'a11y', status: a11y.violations.some((v) => v.severity === 'high') ? 'fail' : a11y.violations.length ? 'warn' : 'pass', count: a11y.violations.length },
      { key: 'schema', status: schemaCheck.valid ? 'pass' : 'fail', count: schemaCheck.missing.length },
    ],
    gating_failures: gatingFailures.length,
    gating_failure_keys: gatingFailures,
  };
  const overallPass = gatingFailures.length === 0;

  const { data: report, error } = await admin
    .from('blog_qa_reports')
    .insert({
      tenant_id: tenantId,
      post_id,
      overall_pass: overallPass,
      link_check: linkCheck,
      og_preview: ogPreview,
      a11y,
      schema_check: schemaCheck,
      summary,
      created_by_user_id: userId,
      checked_at: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (error || !report) {
    return createCorsResponse({ error: error?.message ?? 'Failed to save report' }, 500, req);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_qa.run',
      targetType: 'blog_post',
      targetId: post_id,
      afterState: summary,
      summary: `QA ${overallPass ? 'passed' : 'failed'} for "${post.title}" (${gatingFailures.join(', ') || 'no gating failures'})`,
    }),
  );

  return createCorsResponse({ report, cached: false }, 201, req);
}

// ─── override ─────────────────────────────────────────────────────────────────
async function override(admin: Admin, tenantId: string, userId: string, req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return createCorsResponse({ error: 'Invalid JSON body' }, 400, req);
  }
  const parsed = overrideSchema.safeParse(body);
  if (!parsed.success) {
    return createCorsResponse(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400,
      req,
    );
  }
  const { post_id, reason } = parsed.data;

  const { data: cached } = await admin
    .from('blog_qa_reports')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('post_id', post_id)
    .order('checked_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!cached) {
    return createCorsResponse({ error: 'Run QA before overriding' }, 409, req);
  }

  const { data: updated, error } = await admin
    .from('blog_qa_reports')
    .update({
      overridden: true,
      override_reason: reason,
      override_by_user_id: userId,
      overall_pass: true, // override unblocks publish
    })
    .eq('id', cached.id)
    .eq('tenant_id', tenantId)
    .select('*')
    .single();
  if (error || !updated) {
    return createCorsResponse({ error: error?.message ?? 'Override failed' }, 500, req);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_qa.override',
      targetType: 'blog_post',
      targetId: post_id,
      beforeState: { gating_failures: (cached.summary as { gating_failures?: number })?.gating_failures },
      afterState: { reason },
      summary: `QA gate overridden for publish: ${reason}`,
    }),
  );

  return createCorsResponse({ report: updated }, 200, req);
}

// ─── latest ───────────────────────────────────────────────────────────────────
async function latest(admin: Admin, tenantId: string, postId: string, req: Request) {
  const { data } = await admin
    .from('blog_qa_reports')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('post_id', postId)
    .order('checked_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return createCorsResponse({ report: null }, 200, req);
  const stale = Date.now() - new Date(data.checked_at).getTime() >= CACHE_MS;
  return createCorsResponse({ report: data, stale }, 200, req);
}

// ─── link checking ─────────────────────────────────────────────────────────────
interface LinkResult {
  url: string;
  status: number;
  kind: 'internal' | 'external';
  redirected_to?: string;
}

function extractLinks(html: string): string[] {
  const urls = new Set<string>();
  const hrefRe = /(?:href|src)\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = hrefRe.exec(html)) !== null) {
    const u = m[1].trim();
    if (u && !u.startsWith('#') && !u.startsWith('mailto:') && !u.startsWith('tel:') && !u.startsWith('javascript:') && !u.startsWith('data:')) {
      urls.add(u);
    }
  }
  return Array.from(urls).slice(0, MAX_LINKS);
}

function markdownLinksToHtml(md: string): string {
  // Minimal conversion so the link extractor + a11y checks can run on a
  // markdown-only post. Covers [text](url) and ![alt](src).
  return md
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function hostOf(u: string | null): string | null {
  if (!u) return null;
  try {
    return new URL(u.startsWith('http') ? u : `https://${u}`).host.replace(/^www\./, '');
  } catch {
    return null;
  }
}

async function checkLinks(html: string, ownHost: string | null) {
  const links = extractLinks(html);
  const ok: LinkResult[] = [];
  const redirects: LinkResult[] = [];
  const broken: LinkResult[] = [];
  const errors: Array<{ url: string; error: string }> = [];

  await Promise.all(
    links.map(async (raw) => {
      const isRelative = !/^https?:\/\//i.test(raw);
      const kind: 'internal' | 'external' =
        isRelative || (ownHost && hostOf(raw) === ownHost) ? 'internal' : 'external';
      // Relative internal links can't be HEAD-checked without the live site base;
      // record them as internal/unverified (status 0) rather than failing.
      if (isRelative) {
        ok.push({ url: raw, status: 0, kind: 'internal' });
        return;
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LINK_TIMEOUT_MS);
      try {
        let res = await fetch(raw, { method: 'HEAD', redirect: 'manual', signal: controller.signal });
        // Some servers reject HEAD; retry with GET (range-limited) on 405.
        if (res.status === 405) {
          res = await fetch(raw, { method: 'GET', redirect: 'manual', signal: controller.signal, headers: { Range: 'bytes=0-0' } });
        }
        const entry: LinkResult = { url: raw, status: res.status, kind };
        if (res.status >= 300 && res.status < 400) {
          entry.redirected_to = res.headers.get('location') ?? undefined;
          redirects.push(entry);
        } else if (res.status >= 400) {
          broken.push(entry);
        } else {
          ok.push(entry);
        }
      } catch (err) {
        errors.push({ url: raw, error: err instanceof Error ? err.name : 'fetch_error' });
      } finally {
        clearTimeout(timer);
      }
    }),
  );

  return { total: links.length, ok, redirects, broken, errors };
}

// ─── OG / Twitter preview ───────────────────────────────────────────────────────
function buildOgPreview(
  post: Record<string, unknown>,
  settings: Record<string, unknown> | null,
) {
  const title = String(post.meta_title || post.title || '');
  const description = String(post.meta_description || '');
  const siteName = String(settings?.organization_name || '');
  const urlStr = String(post.canonical_url || '');
  const hasImage = Boolean(post.featured_image_asset_id);

  const warnings: string[] = [];
  if (!title) warnings.push('Missing meta title / title');
  if (title.length > 60) warnings.push(`Title ${title.length} chars — may truncate (>60)`);
  if (!description) warnings.push('Missing meta description');
  else if (description.length > 200) warnings.push(`Description ${description.length} chars — long for cards (>200)`);
  else if (description.length < 50) warnings.push(`Description ${description.length} chars — thin (<50)`);
  if (!hasImage) warnings.push('No featured image — cards render without a thumbnail');
  if (!urlStr) warnings.push('No canonical URL set');

  const card = { title, description, image: hasImage ? '(featured image asset)' : null, url: urlStr, site_name: siteName };
  return {
    slack: card,
    twitter: { ...card, card_type: hasImage ? 'summary_large_image' : 'summary' },
    linkedin: card,
    imessage: { title, url: urlStr, image: card.image },
    warnings,
  };
}

// ─── a11y heuristics ────────────────────────────────────────────────────────────
interface A11yViolation {
  rule: string;
  severity: 'low' | 'medium' | 'high';
  detail: string;
}

function a11yHeuristics(html: string, markdown: string) {
  const violations: A11yViolation[] = [];

  // Images missing alt text.
  const imgRe = /<img\b[^>]*>/gi;
  let im: RegExpExecArray | null;
  let imgNoAlt = 0;
  while ((im = imgRe.exec(html)) !== null) {
    const tag = im[0];
    const altMatch = /alt\s*=\s*["']([^"']*)["']/i.exec(tag);
    if (!altMatch || altMatch[1].trim() === '') imgNoAlt++;
  }
  if (imgNoAlt > 0) {
    violations.push({ rule: 'image-alt', severity: 'high', detail: `${imgNoAlt} image(s) missing alt text` });
  }

  // Heading-order skips (e.g. h2 → h4). Source from HTML headings or markdown #.
  const levels: number[] = [];
  const hRe = /<h([1-6])\b/gi;
  let hm: RegExpExecArray | null;
  while ((hm = hRe.exec(html)) !== null) levels.push(Number(hm[1]));
  if (levels.length === 0) {
    const mdRe = /^(#{1,6})\s/gm;
    let mm: RegExpExecArray | null;
    while ((mm = mdRe.exec(markdown)) !== null) levels.push(mm[1].length);
  }
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] - levels[i - 1] > 1) {
      violations.push({
        rule: 'heading-order',
        severity: 'medium',
        detail: `Heading jumps from h${levels[i - 1]} to h${levels[i]}`,
      });
      break;
    }
  }

  // Generic link text.
  const linkTextRe = /<a\b[^>]*>([^<]*)<\/a>/gi;
  let lt: RegExpExecArray | null;
  const generic = new Set(['click here', 'here', 'read more', 'this', 'link', 'more']);
  let genericCount = 0;
  while ((lt = linkTextRe.exec(html)) !== null) {
    if (generic.has(lt[1].trim().toLowerCase())) genericCount++;
  }
  if (genericCount > 0) {
    violations.push({ rule: 'link-name', severity: 'low', detail: `${genericCount} link(s) with non-descriptive text` });
  }

  return {
    passed: violations.length === 0,
    violations,
    note: 'Static heuristics only. A full axe-core run (contrast, ARIA, focus order) executes browser-side in the QA panel.',
  };
}

// ─── schema validation (US-BLOG-027 re-run) ──────────────────────────────────────
function validateSchema(post: Record<string, unknown>, settings: Record<string, unknown> | null) {
  const type = String(post.schema_type || 'BlogPosting');
  const missing: string[] = [];

  // Baseline Article/BlogPosting requirements.
  if (!post.title) missing.push('headline (title)');
  if (!post.author_user_id) missing.push('author');
  if (!settings?.organization_name) missing.push('publisher.name (organization settings)');
  if (!settings?.organization_logo_url) missing.push('publisher.logo (organization settings)');
  if (!post.meta_description) missing.push('description');

  // Type-specific extras.
  if (type === 'HowTo' && !post.body_markdown) missing.push('step (HowTo requires steps in body)');
  if (type === 'FAQPage') {
    const body = String(post.body_markdown || '');
    if (!/\?/.test(body)) missing.push('mainEntity (FAQPage requires Q&A pairs)');
  }

  return { type, valid: missing.length === 0, missing };
}
