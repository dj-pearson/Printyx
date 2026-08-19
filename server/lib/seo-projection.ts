/**
 * SEO dashboard row projections (PROD-014).
 *
 * SEODashboard.tsx reads seven lists. The edge function implemented two of
 * them, so in production five panels 404'd; and the two that did answer handed
 * back PostgREST's snake_case, which the page reads as camelCase — blank cells,
 * no error.
 *
 * Projecting in one place also settles what each field MEANS, which is where
 * this surface was worse than a missing route. Three of the five fields the
 * page read for a page score (technicalScore, contentScore, performanceScore)
 * are not columns on seo_page_scores at all, and an alert has no `type`
 * column. Those panels rendered empty on BOTH backends. The mappings below are
 * to the real columns, checked in seo-projection-parity.test.ts against
 * getTableColumns rather than against what the page happened to ask for.
 *
 * Node copy — kept textually identical to
 * supabase/functions/_shared/seo-projection.ts.
 */

type Row = Record<string, unknown>;

/** First defined value among the given keys. */
function pick(row: Row, ...keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined) return row[key];
  }
  return undefined;
}

/** ISO string for a Date, a string, or nothing. */
function iso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

/** Numbers arrive as strings from PostgREST for numeric columns. */
function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** One row of seo_audit_history. */
export function projectAudit(row: Row) {
  return {
    id: row.id,
    url: pick(row, 'url') ?? null,
    status: pick(row, 'status') ?? null,
    overallScore: num(pick(row, 'overallScore', 'overall_score')),
    technicalScore: num(pick(row, 'technicalScore', 'technical_score')),
    contentScore: num(pick(row, 'contentScore', 'content_score')),
    performanceScore: num(pick(row, 'performanceScore', 'performance_score')),
    criticalIssues: num(pick(row, 'criticalIssues', 'critical_issues')),
    highIssues: num(pick(row, 'highIssues', 'high_issues')),
    mediumIssues: num(pick(row, 'mediumIssues', 'medium_issues')),
    lowIssues: num(pick(row, 'lowIssues', 'low_issues')),
    issues: pick(row, 'issues') ?? null,
    recommendations: pick(row, 'recommendations') ?? null,
    auditType: pick(row, 'auditType', 'audit_type') ?? null,
    completedAt: iso(pick(row, 'completedAt', 'completed_at')),
    createdAt: iso(pick(row, 'createdAt', 'created_at')),
  };
}

/** One row of seo_keywords. */
export function projectKeyword(row: Row) {
  return {
    id: row.id,
    keyword: pick(row, 'keyword') ?? null,
    targetUrl: pick(row, 'targetUrl', 'target_url') ?? null,
    currentPosition: num(pick(row, 'currentPosition', 'current_position')),
    targetPosition: num(pick(row, 'targetPosition', 'target_position')),
    bestPosition: num(pick(row, 'bestPosition', 'best_position')),
    searchVolume: num(pick(row, 'searchVolume', 'search_volume')),
    difficulty: num(pick(row, 'difficulty')),
    impressions: num(pick(row, 'impressions')),
    clicks: num(pick(row, 'clicks')),
    ctr: num(pick(row, 'ctr')),
    isActive: Boolean(pick(row, 'isActive', 'is_active')),
    priority: num(pick(row, 'priority')) ?? 0,
    lastChecked: iso(pick(row, 'lastChecked', 'last_checked')),
  };
}

/**
 * One row of seo_competitor_analysis.
 *
 * `domain` is competitor_url and `backlinks` is total_backlinks — the page
 * named both differently and got undefined. There is no overall score and no
 * active flag on this table, so neither is projected: a competitor row states
 * what was measured, and the page should not show a score that nothing
 * computes.
 */
export function projectCompetitor(row: Row) {
  return {
    id: row.id,
    domain: pick(row, 'competitorUrl', 'competitor_url') ?? null,
    name: pick(row, 'competitorName', 'competitor_name') ?? null,
    monthlyTraffic: num(pick(row, 'estimatedTraffic', 'estimated_traffic')),
    domainAuthority: num(pick(row, 'domainAuthority', 'domain_authority')),
    pageAuthority: num(pick(row, 'pageAuthority', 'page_authority')),
    organicKeywords: num(pick(row, 'rankingKeywords', 'ranking_keywords')),
    backlinks: num(pick(row, 'totalBacklinks', 'total_backlinks')),
    referringDomains: num(pick(row, 'referringDomains', 'referring_domains')),
    analyzedAt: iso(pick(row, 'analyzedAt', 'analyzed_at')),
  };
}

/**
 * One row of seo_alerts.
 *
 * The page read `alert.type`; there is no such column. What an alert is about
 * is its `metric`, and `title` is the human line — both are projected and the
 * page uses them.
 */
export function projectAlert(row: Row) {
  return {
    id: row.id,
    title: pick(row, 'title') ?? null,
    metric: pick(row, 'metric') ?? null,
    severity: pick(row, 'severity') ?? null,
    status: pick(row, 'status') ?? null,
    message: pick(row, 'message') ?? null,
    url: pick(row, 'url') ?? null,
    oldValue: pick(row, 'oldValue', 'old_value') ?? null,
    newValue: pick(row, 'newValue', 'new_value') ?? null,
    resolvedAt: iso(pick(row, 'resolvedAt', 'resolved_at')),
    createdAt: iso(pick(row, 'createdAt', 'created_at')),
  };
}

/**
 * One row of seo_page_scores.
 *
 * The page asked for technicalScore / contentScore / performanceScore. None of
 * the three is a column. What the table records is seoScore, contentQuality,
 * technicalSeo, userExperience, mobileScore and accessibilityScore, so those
 * are what the panel now shows.
 */
export function projectPageScore(row: Row) {
  return {
    id: row.id,
    url: pick(row, 'url') ?? null,
    title: pick(row, 'title') ?? null,
    seoScore: num(pick(row, 'seoScore', 'seo_score')),
    contentQuality: num(pick(row, 'contentQuality', 'content_quality')),
    technicalSeo: num(pick(row, 'technicalSeo', 'technical_seo')),
    userExperience: num(pick(row, 'userExperience', 'user_experience')),
    mobileScore: num(pick(row, 'mobileScore', 'mobile_score')),
    accessibilityScore: num(pick(row, 'accessibilityScore', 'accessibility_score')),
    wordCount: num(pick(row, 'wordCount', 'word_count')),
    loadTime: num(pick(row, 'loadTime', 'load_time_ms')),
    lastAnalyzed: iso(pick(row, 'lastAnalyzed', 'last_analyzed')),
  };
}

/** One row of seo_crawl_results. */
export function projectCrawlResult(row: Row) {
  return {
    id: row.id,
    crawlId: pick(row, 'crawlId', 'crawl_id') ?? null,
    url: pick(row, 'url') ?? null,
    title: pick(row, 'title') ?? null,
    metaDescription: pick(row, 'metaDescription', 'meta_description') ?? null,
    h1: pick(row, 'h1') ?? null,
    statusCode: num(pick(row, 'statusCode', 'status_code')),
    wordCount: num(pick(row, 'wordCount', 'word_count')),
    internalLinks: num(pick(row, 'internalLinks', 'internal_links')),
    externalLinks: num(pick(row, 'externalLinks', 'external_links')),
    brokenLinks: num(pick(row, 'brokenLinks', 'broken_links')),
    crawlDepth: num(pick(row, 'crawlDepth', 'crawl_depth')),
    crawledAt: iso(pick(row, 'crawledAt', 'crawled_at')),
  };
}
