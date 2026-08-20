// PROD-014 parity lock.
//
// SEODashboard.tsx loads seven lists; the seo edge function implemented two, so
// five panels 404'd in production. Now both backends serve them, which puts the
// row projections in two places:
//
//   server/lib/seo-projection.ts
//   supabase/functions/_shared/seo-projection.ts
//
// The casing half is the usual one: Express returns camelCase Drizzle rows,
// PostgREST returns snake_case, and the page reads camelCase straight off each
// row. The other half is sharper — several fields the page read are not columns
// on the table at all, so those panels were empty on BOTH backends. Every
// projected field is checked against getTableColumns here, not against what the
// page happened to ask for.
import { describe, it, expect } from 'vitest';
import { getTableColumns } from 'drizzle-orm';

import * as node from '../../lib/seo-projection';
import * as edge from '../../../supabase/functions/_shared/seo-projection';
import {
  seoAuditHistory,
  seoKeywords,
  seoCompetitorAnalysis,
  seoAlerts,
  seoPageScores,
  seoCrawlResults,
} from '@shared/schema';

const AT = new Date('2026-08-19T12:00:00.000Z');

const cols = (table: unknown) =>
  Object.values(getTableColumns(table as never) as Record<string, { name: string }>).map(
    (c) => c.name,
  );

/** camelCase row (Drizzle) -> snake_case row (PostgREST), for the same data. */
function toSnake(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)] =
      v instanceof Date ? v.toISOString() : v;
  }
  return out;
}

const AUDIT = {
  id: 'a1',
  url: 'https://printyx.net',
  status: 'complete',
  overallScore: 82,
  technicalScore: 90,
  contentScore: 71,
  performanceScore: 65,
  criticalIssues: 1,
  highIssues: 2,
  mediumIssues: 3,
  lowIssues: 4,
  auditType: 'full',
  createdAt: AT,
};

const KEYWORD = {
  id: 'k1',
  keyword: 'copier lease',
  targetUrl: 'https://printyx.net/lease',
  currentPosition: 12,
  targetPosition: 3,
  searchVolume: 900,
  difficulty: 44,
  impressions: 1200,
  clicks: 40,
  isActive: true,
  priority: 5,
};

const COMPETITOR = {
  id: 'c1',
  competitorUrl: 'rival.example',
  competitorName: 'Rival Imaging',
  estimatedTraffic: 5000,
  domainAuthority: 41,
  pageAuthority: 33,
  rankingKeywords: 220,
  totalBacklinks: 1800,
  referringDomains: 90,
  analyzedAt: AT,
};

const ALERT = {
  id: 'al1',
  title: 'Ranking dropped',
  metric: 'position',
  severity: 'high',
  status: 'open',
  message: 'copier lease fell from 8 to 19',
  createdAt: AT,
};

const PAGE_SCORE = {
  id: 'p1',
  url: 'https://printyx.net/pricing',
  title: 'Pricing',
  seoScore: 77,
  contentQuality: 68,
  technicalSeo: 85,
  userExperience: 72,
  mobileScore: 91,
  accessibilityScore: 88,
  wordCount: 640,
  lastAnalyzed: AT,
};

const CRAWL = {
  id: 'cr1',
  crawlId: 'crawl-9',
  url: 'https://printyx.net/about',
  title: 'About',
  metaDescription: 'About Printyx',
  h1: 'About',
  statusCode: 200,
  wordCount: 300,
  internalLinks: 12,
  externalLinks: 3,
  crawlDepth: 1,
  crawledAt: AT,
};

const CASES = [
  ['projectAudit', 'projectAudit', AUDIT],
  ['projectKeyword', 'projectKeyword', KEYWORD],
  ['projectCompetitor', 'projectCompetitor', COMPETITOR],
  ['projectAlert', 'projectAlert', ALERT],
  ['projectPageScore', 'projectPageScore', PAGE_SCORE],
  ['projectCrawlResult', 'projectCrawlResult', CRAWL],
] as const;

describe('both backends produce the same camelCase row', () => {
  it.each(CASES)('%s reads either casing identically', (_label, fn, row) => {
    const fromDrizzle = (node as never as Record<string, (r: unknown) => unknown>)[fn](row);
    const fromPostgrest = (edge as never as Record<string, (r: unknown) => unknown>)[fn](
      toSnake(row),
    );
    expect(fromPostgrest).toEqual(fromDrizzle);
  });

  it.each(CASES)('%s agrees across the two copies', (_label, fn, row) => {
    expect((edge as never as Record<string, (r: unknown) => unknown>)[fn](row)).toEqual(
      (node as never as Record<string, (r: unknown) => unknown>)[fn](row),
    );
  });
});

describe('every projected field maps to a real column', () => {
  // The page asked for fields that do not exist. Reading straight from
  // getTableColumns is what stops a projection re-inventing them.
  const specs: Array<[string, unknown, string[]]> = [
    [
      'seo_audit_history',
      seoAuditHistory,
      [
        'overall_score',
        'technical_score',
        'content_score',
        'performance_score',
        'critical_issues',
        'audit_type',
        'completed_at',
      ],
    ],
    [
      'seo_keywords',
      seoKeywords,
      ['target_url', 'current_position', 'search_volume', 'is_active', 'priority', 'last_checked'],
    ],
    [
      'seo_competitor_analysis',
      seoCompetitorAnalysis,
      [
        'competitor_url',
        'competitor_name',
        'estimated_traffic',
        'domain_authority',
        'ranking_keywords',
        'total_backlinks',
        'analyzed_at',
      ],
    ],
    ['seo_alerts', seoAlerts, ['title', 'metric', 'severity', 'status', 'message', 'resolved_at']],
    [
      'seo_page_scores',
      seoPageScores,
      [
        'seo_score',
        'content_quality',
        'technical_seo',
        'user_experience',
        'mobile_score',
        'accessibility_score',
        'last_analyzed',
      ],
    ],
    [
      'seo_crawl_results',
      seoCrawlResults,
      [
        'crawl_id',
        'meta_description',
        'status_code',
        'word_count',
        'internal_links',
        'crawl_depth',
        'crawled_at',
      ],
    ],
  ];

  it.each(specs)('%s', (_table, table, expected) => {
    const actual = new Set(cols(table));
    for (const column of expected) expect(actual.has(column), column).toBe(true);
  });

  it('does not resurrect the fields the page invented', () => {
    const pageScoreCols = new Set(cols(seoPageScores));
    for (const invented of ['technical_score', 'content_score', 'performance_score']) {
      expect(pageScoreCols.has(invented), `seo_page_scores.${invented}`).toBe(false);
    }
    expect(Object.keys(edge.projectPageScore(PAGE_SCORE))).not.toContain('technicalScore');
    expect(Object.keys(edge.projectPageScore(PAGE_SCORE))).not.toContain('performanceScore');

    expect(new Set(cols(seoAlerts)).has('type')).toBe(false);
    expect(Object.keys(edge.projectAlert(ALERT))).not.toContain('type');

    const competitorCols = new Set(cols(seoCompetitorAnalysis));
    expect(competitorCols.has('is_active')).toBe(false);
    expect(Object.keys(edge.projectCompetitor(COMPETITOR))).not.toContain('isActive');
    expect(Object.keys(edge.projectCompetitor(COMPETITOR))).not.toContain('overallScore');
  });
});

describe('numeric and date handling', () => {
  it('parses the numeric strings PostgREST returns', () => {
    const row = { ...toSnake(PAGE_SCORE), seo_score: '77', mobile_score: '91' };
    const out = edge.projectPageScore(row);
    expect(out.seoScore).toBe(77);
    expect(out.mobileScore).toBe(91);
  });

  it('nulls an absent number rather than reporting zero', () => {
    // A page with no mobile score has not scored 0; the progress bar and the
    // dash in the UI mean different things.
    const out = edge.projectPageScore({ id: 'p2', url: 'u' });
    expect(out.mobileScore).toBeNull();
    expect(out.seoScore).toBeNull();
  });

  it('renders dates as ISO strings from either a Date or a string', () => {
    expect(node.projectAudit(AUDIT).createdAt).toBe(AT.toISOString());
    expect(edge.projectAudit(toSnake(AUDIT)).createdAt).toBe(AT.toISOString());
    expect(edge.projectAudit({ id: 'x' }).createdAt).toBeNull();
  });
});
