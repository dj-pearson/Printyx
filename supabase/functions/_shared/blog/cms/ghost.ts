// Ghost CMS Adapter (US-BLOG-006)
//
// Implements `CmsAdapter` against the Ghost Admin API v5.x using HMAC-SHA256
// JWT auth. The Admin API key is `id:secret_hex`; we sign a short-lived JWT
// (5 min) per request keyed by the secret.
//
// API surface:
//   GET  /ghost/api/admin/site            — for healthCheck
//   POST /ghost/api/admin/posts           — create
//   PUT  /ghost/api/admin/posts/:id       — update
//   GET  /ghost/api/admin/posts/:id       — fetch
//   GET  /ghost/api/admin/posts           — list
//   DELETE /ghost/api/admin/posts/:id     — delete
//   POST /ghost/api/admin/images/upload   — upload media
//
// Ghost accepts HTML directly via `html` source on POST; the editor converts
// it to Lexical/mobiledoc on save. Full Markdown→Lexical transform is left
// to a future iteration since Ghost's HTML import gets us 90% of the way.

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

interface GhostPost {
  id: string;
  url: string;
  status: string; // draft | published | scheduled
  published_at: string | null;
  updated_at: string;
  title: string;
  slug: string;
}

interface GhostPostsResponse {
  posts: GhostPost[];
}

interface GhostImageUploadResponse {
  images: Array<{ url: string; ref?: string | null }>;
}

const GHOST_STATUS_TO_CMS: Record<string, CmsPost['status']> = {
  published: 'published',
  scheduled: 'scheduled',
  draft: 'draft',
  sent: 'published',
};

export const ghostAdapter: CmsAdapter = {
  platform: 'ghost',

  async healthCheck(creds) {
    const start = Date.now();
    try {
      const json = await ghostFetch<{ site: { title?: string; version?: string } }>(
        creds,
        '/ghost/api/admin/site/',
      );
      return {
        ok: true,
        version: json.site?.version,
        message: json.site?.title ?? 'Reachable',
        checked_at: new Date(start).toISOString(),
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
    const post = buildGhostPostBody(input, /* forCreate */ true);
    const res = await ghostFetch<GhostPostsResponse>(creds, '/ghost/api/admin/posts/?source=html', {
      method: 'POST',
      body: JSON.stringify({ posts: [post] }),
    });
    return ghostPostToCmsPost(res.posts[0]);
  },

  async updatePost(creds, id, input) {
    const post = buildGhostPostBody(input, /* forCreate */ false);
    // Ghost requires `updated_at` for optimistic concurrency; fetch first when missing.
    if (!post.updated_at) {
      const current = await ghostFetch<GhostPostsResponse>(
        creds,
        `/ghost/api/admin/posts/${encodeURIComponent(id)}/`,
      );
      post.updated_at = current.posts[0]?.updated_at;
    }
    const res = await ghostFetch<GhostPostsResponse>(
      creds,
      `/ghost/api/admin/posts/${encodeURIComponent(id)}/?source=html`,
      { method: 'PUT', body: JSON.stringify({ posts: [post] }) },
    );
    return ghostPostToCmsPost(res.posts[0]);
  },

  async deletePost(creds, id) {
    await ghostFetch<unknown>(creds, `/ghost/api/admin/posts/${encodeURIComponent(id)}/`, {
      method: 'DELETE',
    });
  },

  async getPost(creds, id) {
    try {
      const res = await ghostFetch<GhostPostsResponse>(
        creds,
        `/ghost/api/admin/posts/${encodeURIComponent(id)}/`,
      );
      return res.posts[0] ? ghostPostToCmsPost(res.posts[0]) : null;
    } catch (err) {
      if (err instanceof AdapterError && err.status === 404) return null;
      throw err;
    }
  },

  async listPosts(creds, opts) {
    const params = new URLSearchParams();
    if (opts?.limit) params.set('limit', String(Math.min(opts.limit, 100)));
    if (opts?.offset) {
      // Ghost uses `page` (1-based) — convert offset assuming the supplied limit
      const limit = opts.limit ?? 15;
      params.set('page', String(Math.floor(opts.offset / limit) + 1));
    }
    if (opts?.status && opts.status !== 'any') {
      params.set('filter', `status:${cmsStatusToGhost(opts.status)}`);
    }
    const res = await ghostFetch<GhostPostsResponse>(
      creds,
      `/ghost/api/admin/posts/?${params.toString()}`,
    );
    return res.posts.map(ghostPostToCmsPost);
  },

  async uploadAsset(creds, file) {
    const url = `${normalizeBaseUrl(creds.baseUrl)}/ghost/api/admin/images/upload/`;
    const token = await mintGhostJwt(creds);
    const form = new FormData();
    const blob = new Blob([file.bytes as BlobPart], { type: file.mime_type });
    form.append('file', blob, file.filename);
    form.append('purpose', 'image');
    if (file.alt_text) form.append('ref', file.alt_text);

    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Ghost ${token}` },
      body: form,
    });
    const json = (await readJson(res)) as GhostImageUploadResponse;
    if (!res.ok) {
      throw mapHttpError('ghost', res, json);
    }
    const image = json.images?.[0];
    if (!image) {
      throw new AdapterError('ghost', 500, 'Ghost upload response missing images[]');
    }
    return {
      id: image.url, // Ghost doesn't return a discrete ID — use URL as identity
      url: image.url,
      mime_type: file.mime_type,
      size_bytes: file.bytes.byteLength,
      raw: image as unknown as Record<string, unknown>,
    };
  },
};

// ─── helpers ───

async function ghostFetch<T>(
  creds: CmsCredentials,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await mintGhostJwt(creds);
  const url = `${normalizeBaseUrl(creds.baseUrl)}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Ghost ${token}`,
    Accept: 'application/json',
    'Accept-Version': 'v5.0',
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...((init.headers as Record<string, string>) ?? {}),
  };
  const res = await fetch(url, { ...init, headers });
  const body = await readJson(res);
  if (!res.ok) {
    throw mapHttpError('ghost', res, body);
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
    body && typeof body === 'object' && 'errors' in body
      ? JSON.stringify((body as { errors: unknown }).errors).slice(0, 500)
      : `${res.status} ${res.statusText}`;
  return new AdapterError(platform, res.status, detail, body);
}

function cmsStatusToGhost(status: NonNullable<CmsListOptions['status']>): string {
  switch (status) {
    case 'published':
      return 'published';
    case 'scheduled':
      return 'scheduled';
    case 'archived':
      return 'draft'; // Ghost has no archive — treat as draft for filtering
    default:
      return 'draft';
  }
}

function ghostPostToCmsPost(p: GhostPost): CmsPost {
  return {
    id: p.id,
    url: p.url,
    status: GHOST_STATUS_TO_CMS[p.status] ?? 'draft',
    published_at: p.published_at,
    updated_at: p.updated_at,
    raw: p as unknown as Record<string, unknown>,
  };
}

function buildGhostPostBody(
  input: Partial<CmsPostInput>,
  forCreate: boolean,
): Record<string, unknown> {
  const post: Record<string, unknown> = {};
  if (input.title !== undefined) post.title = input.title;
  if (input.slug !== undefined) post.slug = input.slug;

  // `?source=html` on the URL tells Ghost to interpret the html field as the source.
  if (input.body_html !== undefined) {
    post.html = input.body_html;
  } else if (input.body_markdown !== undefined) {
    // Ghost's markdown card is deprecated in v5 — wrap in <pre> as a safe fallback.
    // Callers should render Markdown→HTML before this point in the publish flow.
    post.html = `<pre>${escapeHtml(input.body_markdown)}</pre>`;
  }

  if (input.excerpt !== undefined) post.custom_excerpt = input.excerpt;
  if (input.meta_title !== undefined) post.meta_title = input.meta_title;
  if (input.meta_description !== undefined) post.meta_description = input.meta_description;
  if (input.canonical_url !== undefined) post.canonical_url = input.canonical_url;

  if (input.publish_at) {
    post.status = 'scheduled';
    post.published_at = input.publish_at;
  } else if (input.publish_at === null) {
    post.status = 'published';
  } else if (forCreate) {
    post.status = 'draft';
  }

  if (input.featured_media_id) {
    post.feature_image = String(input.featured_media_id);
  }

  if (input.tags && input.tags.length > 0) {
    post.tags = input.tags.map((name) => ({ name }));
  }
  if (input.extra && typeof input.extra === 'object') {
    Object.assign(post, input.extra);
  }
  return post;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

/**
 * Mint a 5-minute Ghost Admin API JWT (HS256) keyed by the secret half of
 * the API key (`id:secret_hex`).
 */
async function mintGhostJwt(creds: CmsCredentials): Promise<string> {
  const [keyId, secretHex] = creds.apiToken.split(':');
  if (!keyId || !secretHex) {
    throw new AdapterAuthError(
      'ghost',
      'API token must be in "id:secret_hex" format (Ghost Admin API key)',
    );
  }

  const header = { alg: 'HS256', typ: 'JWT', kid: keyId };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now,
    exp: now + 5 * 60,
    aud: '/admin/',
  };

  const enc = new TextEncoder();
  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const keyBytes = hexToBytes(secretHex);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(signingInput)));
  return `${signingInput}.${base64UrlEncode(sig)}`;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return bytes;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    s += String.fromCharCode(bytes[i]);
  }
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
