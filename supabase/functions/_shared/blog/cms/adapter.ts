// Blog CMS Adapter Contract (US-BLOG-006)
//
// Every CMS adapter (WordPress, Ghost, future Webflow / custom-REST) implements
// this interface. The blog publish flow (US-BLOG-042) calls these methods via
// a registry keyed by `blog_distribution_targets.platform`.
//
// Contract guarantees:
//   1. Adapter implementations NEVER log decrypted credentials.
//   2. healthCheck() is cheap (single API roundtrip) and used by the admin UI's
//      "Test Connection" button + by ops monitoring.
//   3. createPost / updatePost / deletePost return the canonical CMS post ID
//      and public URL so the caller can persist them on blog_posts.
//   4. uploadAsset is best-effort — adapters that don't support media upload
//      throw `AdapterUnsupportedError`. Callers handle by skipping the upload
//      step and inlining external image URLs instead.
//
// Phase 2 adapters (Webflow, custom-REST, native-render-into-printyx.net)
// implement the same interface so the adapter registry doesn't change shape.

export interface CmsCredentials {
  /** Decrypted by the caller before passing to the adapter. */
  baseUrl: string;
  /** WordPress: application password. Ghost: Admin API key (`id:secret_hex`). */
  apiToken: string;
  /** Optional username for WordPress basic-auth fallback. */
  username?: string;
}

export interface CmsPostInput {
  title: string;
  /** Markdown source. Adapters convert to vendor-specific format. */
  body_markdown: string;
  /** Pre-rendered HTML (optional — adapters can use this when present to avoid re-rendering). */
  body_html?: string;
  excerpt?: string;
  meta_title?: string;
  meta_description?: string;
  canonical_url?: string;
  /** Slug (URL path segment). Adapters generate one from title if omitted. */
  slug?: string;
  /** ISO8601 publish timestamp; null/undefined = publish immediately. */
  publish_at?: string | null;
  /** Asset ID of the featured image already uploaded via uploadAsset. */
  featured_media_id?: string | null;
  /** Tag names. Adapters create tags as needed. */
  tags?: string[];
  /** Category names. Adapters create categories as needed. */
  categories?: string[];
  /** Free-form vendor-specific fields. Adapters ignore unknown keys. */
  extra?: Record<string, unknown>;
}

export interface CmsPost {
  id: string;
  url: string;
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  published_at: string | null;
  updated_at: string;
  raw: Record<string, unknown>;
}

export interface CmsAsset {
  id: string;
  url: string;
  mime_type: string;
  size_bytes?: number;
  raw: Record<string, unknown>;
}

export interface CmsListOptions {
  limit?: number;
  offset?: number;
  status?: 'draft' | 'scheduled' | 'published' | 'archived' | 'any';
}

export interface CmsHealthCheckResult {
  ok: boolean;
  /** Vendor / version string when reachable. */
  version?: string;
  /** Brief diagnostic message; safe to surface to the admin UI. */
  message?: string;
  /** Timestamp of the check. */
  checked_at: string;
}

export interface CmsAdapter {
  readonly platform: string;

  healthCheck(creds: CmsCredentials): Promise<CmsHealthCheckResult>;

  createPost(creds: CmsCredentials, input: CmsPostInput): Promise<CmsPost>;
  updatePost(creds: CmsCredentials, id: string, input: Partial<CmsPostInput>): Promise<CmsPost>;
  deletePost(creds: CmsCredentials, id: string): Promise<void>;
  getPost(creds: CmsCredentials, id: string): Promise<CmsPost | null>;
  listPosts(creds: CmsCredentials, opts?: CmsListOptions): Promise<CmsPost[]>;

  /**
   * Upload a media asset. Throws AdapterUnsupportedError when the vendor
   * doesn't expose a media API.
   */
  uploadAsset(
    creds: CmsCredentials,
    file: { bytes: Uint8Array; filename: string; mime_type: string; alt_text?: string },
  ): Promise<CmsAsset>;
}

export class AdapterError extends Error {
  constructor(
    public readonly platform: string,
    public readonly status: number,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}

export class AdapterUnsupportedError extends AdapterError {
  constructor(platform: string, operation: string) {
    super(platform, 501, `${platform}: ${operation} not supported by this adapter`);
    this.name = 'AdapterUnsupportedError';
  }
}

export class AdapterAuthError extends AdapterError {
  constructor(platform: string, detail = 'authentication failed') {
    super(platform, 401, `${platform}: ${detail}`);
    this.name = 'AdapterAuthError';
  }
}

/**
 * Strip a trailing slash so callers can reliably append paths.
 */
export function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}
