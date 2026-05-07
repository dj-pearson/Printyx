// WordPress CMS Adapter (US-BLOG-006)
//
// Implements `CmsAdapter` against the WordPress REST API v2 using
// application-password authentication (Basic auth with username + token).
// JWT auth is also supported when the JWT-Authentication-for-WP-REST-API
// plugin is installed; we leave that to a future iteration since application
// passwords ship in WordPress core 5.6+ and don't require an extra plugin.
//
// API surface:
//   GET  /wp-json/                — for healthCheck
//   POST /wp-json/wp/v2/posts     — create post
//   POST /wp-json/wp/v2/posts/:id — update post
//   GET  /wp-json/wp/v2/posts/:id — fetch post
//   GET  /wp-json/wp/v2/posts     — list posts
//   DELETE /wp-json/wp/v2/posts/:id?force=true — hard delete
//   POST /wp-json/wp/v2/media     — upload asset (multipart)
//
// WordPress accepts HTML in `content` even with the block editor — wraps it as
// a "classic" block. Full Gutenberg block markup is left to a future
// US-BLOG-006 follow-up; the v1 transform emits HTML.
//
// Tags / categories are looked up by slug; missing terms are created via the
// /wp-json/wp/v2/{tags,categories} endpoints.

import {
  type CmsAdapter,
  type CmsAsset,
  type CmsCredentials,
  type CmsHealthCheckResult,
  type CmsListOptions,
  type CmsPost,
  type CmsPostInput,
  AdapterAuthError,
  AdapterError,
  normalizeBaseUrl,
} from './adapter.ts';

interface WpPost {
  id: number;
  link: string;
  status: string; // publish | future | draft | private | pending | trash
  date_gmt: string | null;
  modified_gmt: string;
  title: { rendered: string; raw?: string };
  content: { rendered: string; raw?: string };
  excerpt: { rendered: string; raw?: string };
  slug: string;
  meta?: Record<string, unknown>;
}

interface WpMedia {
  id: number;
  source_url: string;
  mime_type: string;
  media_details: { filesize?: number };
  alt_text: string;
}

const WP_STATUS_TO_CMS: Record<string, CmsPost['status']> = {
  publish: 'published',
  future: 'scheduled',
  draft: 'draft',
  private: 'draft',
  pending: 'draft',
  trash: 'archived',
  inherit: 'draft',
};

export const wordpressAdapter: CmsAdapter = {
  platform: 'wordpress',

  async healthCheck(creds) {
    const url = `${normalizeBaseUrl(creds.baseUrl)}/wp-json/`;
    const start = Date.now();
    try {
      const res = await fetch(url, { method: 'GET', headers: authHeader(creds) });
      const checked_at = new Date(start).toISOString();
      if (!res.ok) {
        return {
          ok: false,
          message: `${res.status} ${res.statusText}`,
          checked_at,
        };
      }
      const json = (await res.json()) as { name?: string; description?: string };
      return {
        ok: true,
        version: json.name ?? 'WordPress',
        message: json.description ?? 'Reachable',
        checked_at,
      };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Network error',
        checked_at: new Date().toISOString(),
      };
    }
  },

  async createPost(creds, input) {
    const body = await buildPostBody(creds, input);
    const wp = await wpFetch<WpPost>(creds, '/wp-json/wp/v2/posts', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return wpPostToCmsPost(wp);
  },

  async updatePost(creds, id, input) {
    const body = await buildPostBody(creds, input);
    const wp = await wpFetch<WpPost>(creds, `/wp-json/wp/v2/posts/${encodeURIComponent(id)}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return wpPostToCmsPost(wp);
  },

  async deletePost(creds, id) {
    await wpFetch<{ deleted: boolean }>(
      creds,
      `/wp-json/wp/v2/posts/${encodeURIComponent(id)}?force=true`,
      { method: 'DELETE' },
    );
  },

  async getPost(creds, id) {
    try {
      const wp = await wpFetch<WpPost>(
        creds,
        `/wp-json/wp/v2/posts/${encodeURIComponent(id)}?context=edit`,
      );
      return wpPostToCmsPost(wp);
    } catch (err) {
      if (err instanceof AdapterError && err.status === 404) return null;
      throw err;
    }
  },

  async listPosts(creds, opts) {
    const params = new URLSearchParams();
    if (opts?.limit) params.set('per_page', String(Math.min(opts.limit, 100)));
    if (opts?.offset) params.set('offset', String(opts.offset));
    if (opts?.status && opts.status !== 'any') {
      params.set('status', cmsStatusToWp(opts.status));
    }
    params.set('context', 'edit');

    const list = await wpFetch<WpPost[]>(creds, `/wp-json/wp/v2/posts?${params.toString()}`);
    return list.map(wpPostToCmsPost);
  },

  async uploadAsset(creds, file) {
    const url = `${normalizeBaseUrl(creds.baseUrl)}/wp-json/wp/v2/media`;
    const headers: Record<string, string> = {
      ...authHeader(creds),
      'Content-Type': file.mime_type,
      'Content-Disposition': `attachment; filename="${escapeFilename(file.filename)}"`,
    };
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: file.bytes,
    });
    const json = await readJson(res);
    if (!res.ok) {
      throw mapHttpError('wordpress', res, json);
    }
    const media = json as WpMedia;

    // Set alt text in a follow-up call (the upload endpoint ignores meta)
    if (file.alt_text) {
      await wpFetch<WpMedia>(creds, `/wp-json/wp/v2/media/${media.id}`, {
        method: 'POST',
        body: JSON.stringify({ alt_text: file.alt_text }),
      });
    }

    return {
      id: String(media.id),
      url: media.source_url,
      mime_type: media.mime_type,
      size_bytes: media.media_details?.filesize,
      raw: media as unknown as Record<string, unknown>,
    };
  },
};

// ─── helpers ───

function authHeader(creds: CmsCredentials): Record<string, string> {
  // WordPress application-password format: "username:app-password" base64-encoded.
  // If username is missing, we send the token as a Bearer header which works
  // with the JWT-Auth plugin if installed.
  if (creds.username) {
    const basic = btoa(`${creds.username}:${creds.apiToken}`);
    return { Authorization: `Basic ${basic}` };
  }
  return { Authorization: `Bearer ${creds.apiToken}` };
}

async function wpFetch<T>(creds: CmsCredentials, path: string, init: RequestInit = {}): Promise<T> {
  const url = `${normalizeBaseUrl(creds.baseUrl)}${path}`;
  const headers: Record<string, string> = {
    ...authHeader(creds),
    Accept: 'application/json',
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...((init.headers as Record<string, string>) ?? {}),
  };

  const res = await fetch(url, { ...init, headers });
  const body = await readJson(res);
  if (!res.ok) {
    throw mapHttpError('wordpress', res, body);
  }
  return body as T;
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

function mapHttpError(platform: string, res: Response, body: unknown): AdapterError {
  if (res.status === 401 || res.status === 403) {
    return new AdapterAuthError(platform, `${res.status} ${res.statusText}`);
  }
  const detail =
    body && typeof body === 'object' && 'message' in body
      ? String((body as { message: unknown }).message)
      : `${res.status} ${res.statusText}`;
  return new AdapterError(platform, res.status, detail, body);
}

function escapeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function cmsStatusToWp(status: NonNullable<CmsListOptions['status']>): string {
  switch (status) {
    case 'published':
      return 'publish';
    case 'scheduled':
      return 'future';
    case 'archived':
      return 'trash';
    default:
      return 'draft';
  }
}

function wpPostToCmsPost(wp: WpPost): CmsPost {
  return {
    id: String(wp.id),
    url: wp.link,
    status: WP_STATUS_TO_CMS[wp.status] ?? 'draft',
    published_at: wp.date_gmt ? `${wp.date_gmt}Z` : null,
    updated_at: `${wp.modified_gmt}Z`,
    raw: wp as unknown as Record<string, unknown>,
  };
}

async function buildPostBody(
  creds: CmsCredentials,
  input: Partial<CmsPostInput>,
): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {};
  if (input.title !== undefined) body.title = input.title;

  // WordPress accepts HTML directly in `content` (wrapped as a classic block by Gutenberg).
  // Markdown→HTML conversion is left to the caller; if `body_html` is supplied we use it,
  // otherwise we fall back to body_markdown rendered as a single <pre> block (visible warning).
  if (input.body_html !== undefined) {
    body.content = input.body_html;
  } else if (input.body_markdown !== undefined) {
    body.content = `<!-- wp:html -->\n${input.body_markdown}\n<!-- /wp:html -->`;
  }

  if (input.excerpt !== undefined) body.excerpt = input.excerpt;
  if (input.slug !== undefined) body.slug = input.slug;
  if (input.publish_at) {
    body.date_gmt = input.publish_at;
    body.status = 'future';
  } else if (input.publish_at === null) {
    body.status = 'publish';
  } else {
    // No publish_at supplied: default to draft when creating, leave alone when updating.
    if (!('id' in input)) body.status = 'draft';
  }
  if (input.featured_media_id !== undefined && input.featured_media_id !== null) {
    body.featured_media = Number(input.featured_media_id);
  }

  if (input.tags && input.tags.length > 0) {
    body.tags = await resolveTermIds(creds, 'tags', input.tags);
  }
  if (input.categories && input.categories.length > 0) {
    body.categories = await resolveTermIds(creds, 'categories', input.categories);
  }

  if (input.meta_title || input.meta_description || input.canonical_url) {
    body.meta = {
      ...(input.meta_title ? { _yoast_wpseo_title: input.meta_title } : {}),
      ...(input.meta_description ? { _yoast_wpseo_metadesc: input.meta_description } : {}),
      ...(input.canonical_url ? { _yoast_wpseo_canonical: input.canonical_url } : {}),
    };
  }

  return body;
}

async function resolveTermIds(
  creds: CmsCredentials,
  taxonomy: 'tags' | 'categories',
  names: string[],
): Promise<number[]> {
  const ids: number[] = [];
  for (const name of names) {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const existing = await wpFetch<Array<{ id: number }>>(
      creds,
      `/wp-json/wp/v2/${taxonomy}?slug=${encodeURIComponent(slug)}`,
    );
    if (existing.length > 0) {
      ids.push(existing[0].id);
      continue;
    }
    const created = await wpFetch<{ id: number }>(creds, `/wp-json/wp/v2/${taxonomy}`, {
      method: 'POST',
      body: JSON.stringify({ name, slug }),
    });
    ids.push(created.id);
  }
  return ids;
}
