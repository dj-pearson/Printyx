// Blog Source Aggregator + Citation Capture Edge Function (US-BLOG-025)
//
// Paste a URL → the fetcher pulls title, author, publish date, OG image, and an
// excerpt and saves a citation row. Captures the excerpt + retrieved_at so the
// original quote survives link rot. Also generates the references section
// (markdown) and schema.org Citation JSON-LD for render time.
//
// Routes (gated to platform admin OR users holding blog.post.edit):
//   POST   /blog-citations/fetch        body: { url, post_id }   fetch metadata + save
//   GET    /blog-citations?post_id=                              list citations for a post
//   PATCH  /blog-citations/:id          body: { title?, author?, publication?, publish_date?, excerpt?, citation_text? }
//   DELETE /blog-citations/:id
//   POST   /blog-citations/reorder      body: { post_id, ordered_ids[] }   set inline_position
//   GET    /blog-citations/references?post_id=                   { markdown, jsonld }
//
// The fetcher does generic HTTP + regex over <meta>/<title>; no third-party API.

import { z } from 'https://esm.sh/zod@3.22.4';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';
import { writeAuditLog, withRequestContext } from '../_shared/blog/audit-log.ts';

type Admin = ReturnType<typeof createSupabaseServiceClient>;

const fetchSchema = z.object({
  url: z.string().url(),
  post_id: z.string().uuid(),
});
const patchSchema = z.object({
  title: z.string().max(1000).optional(),
  author: z.string().max(255).optional(),
  publication: z.string().max(255).optional(),
  publish_date: z.string().max(40).optional(),
  excerpt: z.string().max(4000).optional(),
  citation_text: z.string().max(4000).optional(),
});
const reorderSchema = z.object({
  post_id: z.string().uuid(),
  ordered_ids: z.array(z.string().uuid()).max(500),
});

interface CitationRow {
  id: string;
  url: string;
  title: string | null;
  author: string | null;
  publication: string | null;
  publish_date: string | null;
  excerpt: string | null;
  citation_text: string | null;
  og_image: string | null;
  retrieved_at: string | null;
  ref_key: string | null;
  inline_position: number | null;
}

function hasBlogPostEdit(user: { app_metadata?: Record<string, unknown> }): boolean {
  const meta = user.app_metadata ?? {};
  if (meta.isPlatformAdmin === true) return true;
  const perms = meta.permissions;
  if (Array.isArray(perms) && perms.includes('blog.post.edit')) return true;
  const role = String(meta.role ?? '').toLowerCase();
  return role === 'platform_admin' || role === 'super_admin' || role === 'company_admin';
}

// ─── HTML metadata extraction ───────────────────────────────────────────────

function metaContent(html: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return decodeEntities(m[1].trim());
  }
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

interface ExtractedMeta {
  title: string | null;
  author: string | null;
  publication: string | null;
  publishDate: string | null;
  ogImage: string | null;
  excerpt: string | null;
}

function extractMeta(html: string): ExtractedMeta {
  const prop = (p: string) =>
    new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']*)["']`, 'i');
  const propRev = (p: string) =>
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${p}["']`, 'i');

  const title =
    metaContent(html, [prop('og:title'), propRev('og:title')]) ??
    metaContent(html, [/<title[^>]*>([^<]*)<\/title>/i]);
  const author = metaContent(html, [
    prop('author'),
    prop('article:author'),
    propRev('author'),
  ]);
  const publication = metaContent(html, [prop('og:site_name'), propRev('og:site_name')]);
  const publishDate = metaContent(html, [
    prop('article:published_time'),
    prop('datePublished'),
    propRev('article:published_time'),
  ]);
  const ogImage = metaContent(html, [prop('og:image'), propRev('og:image')]);
  const excerpt = metaContent(html, [
    prop('og:description'),
    prop('description'),
    propRev('og:description'),
  ]);

  return { title, author, publication, publishDate, ogImage, excerpt };
}

function slugifyRefKey(meta: ExtractedMeta, url: string): string {
  const lastName = (meta.author ?? '').split(/\s+/).filter(Boolean).pop() ?? '';
  const year = (meta.publishDate ?? '').match(/\d{4}/)?.[0] ?? '';
  let base = `${lastName}${year}`.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!base) {
    try {
      base = new URL(url).hostname.replace(/^www\./, '').split('.')[0];
    } catch {
      base = 'source';
    }
  }
  return base.slice(0, 48) || 'source';
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
    const { parts } = normalizePath(url.pathname, 'blog-citations');
    const action = parts[0];

    if (!action && req.method === 'GET') {
      return await list(admin, tenantId, url, req);
    }
    if (action === 'fetch' && req.method === 'POST') {
      return await fetchCitation(admin, tenantId, user.id, req);
    }
    if (action === 'reorder' && req.method === 'POST') {
      return await reorder(admin, tenantId, req);
    }
    if (action === 'references' && req.method === 'GET') {
      return await references(admin, tenantId, url, req);
    }
    if (action && action !== 'fetch' && action !== 'references' && action !== 'reorder') {
      if (req.method === 'PATCH') return await patch(admin, tenantId, user.id, action, req);
      if (req.method === 'DELETE') return await remove(admin, tenantId, user.id, action, req);
    }
    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (err) {
    console.error('blog-citations handler error', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}

async function list(admin: Admin, tenantId: string, url: URL, req: Request) {
  const postId = url.searchParams.get('post_id');
  if (!postId) return createCorsResponse({ error: 'post_id is required' }, 400, req);
  const { data, error } = await admin
    .from('blog_citations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('post_id', postId)
    .order('inline_position', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  return createCorsResponse({ citations: data ?? [] }, 200, req);
}

async function fetchCitation(admin: Admin, tenantId: string, userId: string, req: Request) {
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

  // Verify the post belongs to the tenant.
  const { data: post } = await admin
    .from('blog_posts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('id', parsed.data.post_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!post) return createCorsResponse({ error: 'Post not found' }, 404, req);

  // Fetch the source HTML (best-effort; store the URL even if the fetch fails).
  let meta: ExtractedMeta = {
    title: null,
    author: null,
    publication: null,
    publishDate: null,
    ogImage: null,
    excerpt: null,
  };
  let fetchWarning: string | null = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(parsed.data.url, {
      headers: { 'User-Agent': 'Printyx-Citation-Fetcher/1.0', Accept: 'text/html' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const html = (await res.text()).slice(0, 500_000);
      meta = extractMeta(html);
    } else {
      fetchWarning = `Source returned ${res.status}`;
    }
  } catch (err) {
    fetchWarning = `Fetch failed: ${err instanceof Error ? err.message : 'error'}`;
  }

  // Determine the next inline position + a unique ref key.
  const { data: maxRow } = await admin
    .from('blog_citations')
    .select('inline_position')
    .eq('tenant_id', tenantId)
    .eq('post_id', parsed.data.post_id)
    .order('inline_position', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = (maxRow?.inline_position ?? 0) + 1;

  let refKey = slugifyRefKey(meta, parsed.data.url);
  const { data: dupe } = await admin
    .from('blog_citations')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('post_id', parsed.data.post_id)
    .eq('ref_key', refKey)
    .limit(1)
    .maybeSingle();
  if (dupe) refKey = `${refKey}-${nextPosition}`;

  const publishDate = meta.publishDate?.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null;

  const { data: created, error } = await admin
    .from('blog_citations')
    .insert({
      tenant_id: tenantId,
      post_id: parsed.data.post_id,
      url: parsed.data.url,
      title: meta.title,
      author: meta.author,
      publication: meta.publication,
      publish_date: publishDate,
      excerpt: meta.excerpt,
      og_image: meta.ogImage,
      retrieved_at: new Date().toISOString(),
      ref_key: refKey,
      inline_position: nextPosition,
    })
    .select('*')
    .single();
  if (error || !created) {
    return createCorsResponse({ error: error?.message ?? 'Insert failed' }, 500, req);
  }

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_citation.capture',
      targetType: 'blog_citation',
      targetId: created.id,
      afterState: { url: parsed.data.url, ref_key: refKey },
      summary: `Captured citation [^${refKey}] from ${parsed.data.url}`,
    }),
  );

  return createCorsResponse({ citation: created, warning: fetchWarning }, 201, req);
}

async function patch(admin: Admin, tenantId: string, userId: string, id: string, req: Request) {
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
  const update: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) update.title = parsed.data.title;
  if (parsed.data.author !== undefined) update.author = parsed.data.author;
  if (parsed.data.publication !== undefined) update.publication = parsed.data.publication;
  if (parsed.data.publish_date !== undefined)
    update.publish_date = parsed.data.publish_date.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
  if (parsed.data.excerpt !== undefined) update.excerpt = parsed.data.excerpt;
  if (parsed.data.citation_text !== undefined) update.citation_text = parsed.data.citation_text;
  if (Object.keys(update).length === 0) {
    return createCorsResponse({ error: 'No fields to update' }, 400, req);
  }

  const { data: updated, error } = await admin
    .from('blog_citations')
    .update(update)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) return createCorsResponse({ error: error.message }, 500, req);
  if (!updated) return createCorsResponse({ error: 'Citation not found' }, 404, req);

  await writeAuditLog(
    admin,
    withRequestContext(req, {
      tenantId,
      actorUserId: userId,
      actorType: 'user',
      action: 'blog_citation.update',
      targetType: 'blog_citation',
      targetId: id,
      afterState: update,
      summary: 'Edited citation attribution',
    }),
  );
  return createCorsResponse({ citation: updated }, 200, req);
}

async function remove(admin: Admin, tenantId: string, userId: string, id: string, req: Request) {
  const { error } = await admin
    .from('blog_citations')
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
      action: 'blog_citation.delete',
      targetType: 'blog_citation',
      targetId: id,
      summary: 'Deleted citation',
    }),
  );
  return createCorsResponse({ deleted: true }, 200, req);
}

async function reorder(admin: Admin, tenantId: string, req: Request) {
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
  for (const id of parsed.data.ordered_ids) {
    await admin
      .from('blog_citations')
      .update({ inline_position: pos++ })
      .eq('tenant_id', tenantId)
      .eq('post_id', parsed.data.post_id)
      .eq('id', id);
  }
  return await list(
    admin,
    tenantId,
    new URL(`https://x/?post_id=${parsed.data.post_id}`),
    req,
  );
}

// ─── references section + schema.org markup ─────────────────────────────────

function formatReference(c: CitationRow): string {
  const parts: string[] = [];
  if (c.author) parts.push(c.author);
  if (c.publish_date) parts.push(`(${c.publish_date.slice(0, 4)})`);
  if (c.title) parts.push(`"${c.title}"`);
  if (c.publication) parts.push(c.publication);
  const label = parts.join('. ');
  const key = c.ref_key ?? c.id.slice(0, 8);
  return `[^${key}]: ${label}${label ? '. ' : ''}<${c.url}>`;
}

async function references(admin: Admin, tenantId: string, url: URL, req: Request) {
  const postId = url.searchParams.get('post_id');
  if (!postId) return createCorsResponse({ error: 'post_id is required' }, 400, req);
  const { data, error } = await admin
    .from('blog_citations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('post_id', postId)
    .order('inline_position', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });
  if (error) return createCorsResponse({ error: error.message }, 500, req);

  const rows = (data ?? []) as CitationRow[];
  const markdown =
    rows.length > 0
      ? `## References\n\n${rows.map(formatReference).join('\n')}\n`
      : '';

  // schema.org Citation array for the post's JSON-LD.
  const jsonld = rows.map((c) => ({
    '@type': 'CreativeWork',
    name: c.title ?? c.url,
    url: c.url,
    ...(c.author ? { author: { '@type': 'Person', name: c.author } } : {}),
    ...(c.publication ? { publisher: { '@type': 'Organization', name: c.publication } } : {}),
    ...(c.publish_date ? { datePublished: c.publish_date } : {}),
  }));

  return createCorsResponse({ markdown, jsonld, count: rows.length }, 200, req);
}
