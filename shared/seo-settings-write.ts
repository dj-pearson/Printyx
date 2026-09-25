/**
 * The seo_settings write plan, shared by both hosts (round 177).
 *
 * PUT /seo/settings on the edge function kept only the SNAKE_CASE keys in its
 * whitelist, while every caller (SEODashboard's settings form and its
 * robots.txt / llms.txt editors, RootAdminSEO) sends camelCase. So on the host
 * production uses, a save stored nothing but updated_at and answered 200 with
 * the unchanged row, and the page said "Settings saved". This accepts either
 * spelling for the same fifteen columns, names what it ignored, and lets the
 * caller refuse a plan that writes nothing.
 *
 * Dependency-free so the Deno function can import it directly.
 */

/** camelCase body field -> seo_settings column. */
export const SEO_SETTINGS_FIELDS: Record<string, string> = {
  siteUrl: 'site_url',
  siteName: 'site_name',
  defaultTitle: 'default_title',
  defaultDescription: 'default_description',
  defaultKeywords: 'default_keywords',
  defaultOgImage: 'default_og_image',
  robotsTxt: 'robots_txt',
  llmsTxt: 'llms_txt',
  sitemapUrl: 'sitemap_url',
  twitterHandle: 'twitter_handle',
  facebookAppId: 'facebook_app_id',
  monitoringEnabled: 'monitoring_enabled',
  monitoringFrequency: 'monitoring_frequency',
  googleAnalyticsId: 'google_analytics_id',
  gscVerification: 'gsc_verification',
};

/** Set by the server, never taken from a body. */
const SERVER_OWNED = new Set([
  'id',
  'tenantId',
  'tenant_id',
  'createdAt',
  'created_at',
  'updatedAt',
  'updated_at',
]);

export interface SeoSettingsPlan {
  /** Column -> value, only for fields the caller actually sent. */
  row: Record<string, unknown>;
  /** Keys that are neither a writable field nor a server-owned one. */
  ignoredFields: string[];
}

export function planSeoSettingsWrite(body: unknown): SeoSettingsPlan {
  const row: Record<string, unknown> = {};
  const ignoredFields: string[] = [];
  const columns = new Set(Object.values(SEO_SETTINGS_FIELDS));
  if (!body || typeof body !== 'object') return { row, ignoredFields };

  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (value === undefined || SERVER_OWNED.has(key)) continue;
    const column = SEO_SETTINGS_FIELDS[key] ?? (columns.has(key) ? key : undefined);
    if (!column) {
      ignoredFields.push(key);
      continue;
    }
    row[column] = value;
  }
  return { row, ignoredFields };
}
