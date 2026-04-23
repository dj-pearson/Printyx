// Content gap analysis — pure logic ported from
// server/services/content-gap-analysis-service.ts.
//
// Scope: no external API calls. Reads knowledge_search_queries,
// article_feedback, knowledge_articles, knowledge_categories. All GROUP BY /
// HAVING aggregation moved into JS because supabase-js can't express them
// cleanly and data volumes (90 days of one tenant's search queries) are in
// the low thousands.
//
// The Express version also had ClaudeAIService import but never used it —
// suggestions are template-based. No Claude call needed.

// deno-lint-ignore no-explicit-any
export type DB = any;

export interface ContentGap {
  topic: string;
  confidence: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  evidence: {
    searchVolume?: number;
    zeroResultSearches?: number;
    negativeFeeback?: number;
    userRequests?: number;
  };
  suggestedArticles: Array<{
    title: string;
    contentType: string;
    difficultyLevel: string;
    rationale: string;
  }>;
  relatedFeatures: string[];
}

export interface CategoryHealth {
  articleCount: number;
  targetArticles: number;
  coverageScore: number;
  status: 'excellent' | 'good' | 'fair' | 'poor';
  missingTopics: string[];
}

export interface AnalysisReport {
  generatedAt: string;
  totalGaps: number;
  criticalGaps: number;
  highPriorityGaps: number;
  gaps: ContentGap[];
  categoryHealth: Record<string, CategoryHealth>;
  recommendations: string[];
}

const PRIORITY_ORDER: Record<ContentGap['priority'], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// Keep in sync with the Express platform-feature registry.
const PLATFORM_FEATURES: Array<{
  name: string;
  category: string;
  priority: ContentGap['priority'];
}> = [
  { name: 'Business Records Management', category: 'crm_sales', priority: 'critical' },
  { name: 'Lead Scoring', category: 'crm_sales', priority: 'high' },
  { name: 'Sales Pipeline', category: 'crm_sales', priority: 'critical' },
  { name: 'Quote Builder', category: 'crm_sales', priority: 'high' },
  { name: 'Service Dispatch', category: 'service_management', priority: 'critical' },
  { name: 'Mobile Field Service', category: 'service_management', priority: 'critical' },
  { name: 'Preventive Maintenance', category: 'service_management', priority: 'high' },
  { name: 'Meter Billing', category: 'meter_billing', priority: 'critical' },
  { name: 'Invoice Management', category: 'meter_billing', priority: 'high' },
  { name: 'Contract Billing', category: 'meter_billing', priority: 'high' },
  { name: 'Inventory Tracking', category: 'inventory_warehouse', priority: 'high' },
  { name: 'Warehouse Operations', category: 'inventory_warehouse', priority: 'medium' },
  { name: 'FPY Metrics', category: 'inventory_warehouse', priority: 'medium' },
  { name: 'Product Catalog', category: 'inventory_warehouse', priority: 'high' },
  { name: 'SNMP Monitoring', category: 'fleet_monitoring', priority: 'critical' },
  { name: 'Device Discovery', category: 'fleet_monitoring', priority: 'high' },
  { name: 'Manufacturer Integration', category: 'fleet_monitoring', priority: 'high' },
  { name: 'QuickBooks Integration', category: 'system_setup', priority: 'critical' },
  { name: 'Salesforce Integration', category: 'system_setup', priority: 'high' },
  { name: 'User Management', category: 'system_setup', priority: 'critical' },
  { name: 'RBAC Configuration', category: 'system_setup', priority: 'high' },
  { name: 'Customer Portal', category: 'customer_portal', priority: 'high' },
  { name: 'Self-Service Tickets', category: 'customer_portal', priority: 'medium' },
  { name: 'Workflow Automation', category: 'workflow_automation', priority: 'high' },
  { name: 'Intelligent Alerts', category: 'workflow_automation', priority: 'medium' },
  { name: 'AI Lead Scoring', category: 'ai_features', priority: 'medium' },
  { name: 'Predictive Maintenance', category: 'ai_features', priority: 'medium' },
  { name: 'Custom Reports', category: 'reporting_analytics', priority: 'high' },
  { name: 'Sales Forecasting', category: 'reporting_analytics', priority: 'high' },
  { name: 'Analytics Dashboards', category: 'reporting_analytics', priority: 'medium' },
];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  crm_sales: ['lead', 'customer', 'sales', 'quote', 'proposal', 'deal', 'pipeline', 'crm'],
  service_management: [
    'service',
    'dispatch',
    'technician',
    'repair',
    'maintenance',
    'field service',
  ],
  meter_billing: ['billing', 'invoice', 'meter', 'payment', 'contract'],
  inventory_warehouse: ['inventory', 'warehouse', 'stock', 'parts', 'product', 'catalog'],
  fleet_monitoring: ['snmp', 'monitoring', 'device', 'printer', 'copier', 'fleet'],
  system_setup: ['setup', 'admin', 'user', 'permission', 'integration', 'configuration'],
  troubleshooting: ['error', 'problem', 'fix', 'not working', 'issue', 'troubleshoot'],
  reporting_analytics: ['report', 'analytics', 'dashboard', 'forecast', 'metrics'],
};

const FEATURE_TERMS = [
  'lead scoring',
  'pipeline',
  'dispatch',
  'meter billing',
  'invoice',
  'snmp',
  'inventory',
  'warehouse',
  'quickbooks',
  'salesforce',
  'customer portal',
  'workflow',
  'automation',
  'reporting',
];

export async function generateAnalysis(db: DB, tenantId: string): Promise<AnalysisReport> {
  const [searchGaps, feedbackGaps, featureCoverageGaps, categoryHealth] = await Promise.all([
    analyzeSearchPatterns(db, tenantId),
    analyzeFeedback(db, tenantId),
    analyzeFeatureCoverage(db, tenantId),
    analyzeCategoryHealth(db, tenantId),
  ]);

  const allGaps = mergeAndPrioritizeGaps([...searchGaps, ...feedbackGaps, ...featureCoverageGaps]);

  const criticalGaps = allGaps.filter((g) => g.priority === 'critical');
  const highPriorityGaps = allGaps.filter((g) => g.priority === 'high');
  const recommendations = generateRecommendations(allGaps, categoryHealth);

  return {
    generatedAt: new Date().toISOString(),
    totalGaps: allGaps.length,
    criticalGaps: criticalGaps.length,
    highPriorityGaps: highPriorityGaps.length,
    gaps: allGaps,
    categoryHealth,
    recommendations,
  };
}

// ─── Search pattern analysis ─────────────────────────────────────────────────

async function analyzeSearchPatterns(db: DB, tenantId: string): Promise<ContentGap[]> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();
  const { data } = await db
    .from('knowledge_search_queries')
    .select('query_text, results_count')
    .eq('tenant_id', tenantId)
    .gte('created_at', ninetyDaysAgo)
    .limit(20000);

  // Group by query_text client-side
  const groups = new Map<string, { count: number; zeroResults: number; resultsSum: number }>();
  for (const row of (data ?? []) as Array<{ query_text: string; results_count: number | null }>) {
    const q = String(row.query_text ?? '').trim();
    if (!q) continue;
    const g = groups.get(q) ?? { count: 0, zeroResults: 0, resultsSum: 0 };
    g.count++;
    g.resultsSum += row.results_count ?? 0;
    if ((row.results_count ?? 0) === 0) g.zeroResults++;
    groups.set(q, g);
  }

  const gaps: ContentGap[] = [];
  for (const [query, g] of groups) {
    if (g.count < 3) continue; // at least 3 searches (matches Express HAVING)
    const avgResults = g.count > 0 ? g.resultsSum / g.count : 0;
    const highZeroRatio = g.zeroResults > g.count * 0.5;
    if (!highZeroRatio && avgResults >= 2) continue;

    gaps.push({
      topic: query,
      confidence: calculateSearchGapConfidence(g.count, g.zeroResults),
      priority: determineSearchGapPriority(g.count, g.zeroResults),
      category: inferCategory(query),
      evidence: { searchVolume: g.count, zeroResultSearches: g.zeroResults },
      suggestedArticles: generateArticleSuggestions(query),
      relatedFeatures: extractFeatureKeywords(query),
    });
  }

  return gaps;
}

// ─── Feedback analysis ───────────────────────────────────────────────────────

async function analyzeFeedback(db: DB, tenantId: string): Promise<ContentGap[]> {
  // Pull unhelpful feedback + article titles + category names.
  const { data: fb } = await db
    .from('article_feedback')
    .select('article_id, issue_type')
    .eq('tenant_id', tenantId)
    .eq('feedback_type', 'unhelpful')
    .limit(10000);

  const feedbackRows = (fb ?? []) as Array<{ article_id: string; issue_type: string | null }>;
  if (feedbackRows.length === 0) return [];

  // Group by (article_id, issue_type)
  const groups = new Map<string, { articleId: string; issueType: string | null; count: number }>();
  for (const row of feedbackRows) {
    const key = `${row.article_id}::${row.issue_type ?? ''}`;
    const g = groups.get(key) ?? {
      articleId: row.article_id,
      issueType: row.issue_type,
      count: 0,
    };
    g.count++;
    groups.set(key, g);
  }

  // Filter to groups with >= 3 feedback rows; fetch article + category names
  const qualifying = [...groups.values()].filter((g) => g.count >= 3);
  if (qualifying.length === 0) return [];

  const articleIds = [...new Set(qualifying.map((g) => g.articleId))];
  const { data: articles } = await db
    .from('knowledge_articles')
    .select('id, title, category_id')
    .eq('tenant_id', tenantId)
    .in('id', articleIds);

  const catIds = [
    ...new Set(
      ((articles ?? []) as Array<{ category_id: string | null }>)
        .map((a) => a.category_id)
        .filter((v): v is string => !!v),
    ),
  ];
  const { data: categories } = await db
    .from('knowledge_categories')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .in('id', catIds);

  const articleById = new Map<string, { title: string; category_id: string | null }>(
    ((articles ?? []) as Array<{ id: string; title: string; category_id: string | null }>).map(
      (a) => [a.id, { title: a.title, category_id: a.category_id }],
    ),
  );
  const categoryNameById = new Map<string, string>(
    ((categories ?? []) as Array<{ id: string; name: string }>).map((c) => [c.id, c.name]),
  );

  const issueMap: Record<string, string> = {
    outdated: 'Update outdated content',
    incorrect: 'Fix incorrect information',
    unclear: 'Clarify unclear instructions',
    missing_info: 'Add missing details',
    technical_error: 'Fix technical errors',
  };

  const gaps: ContentGap[] = [];
  for (const g of qualifying) {
    const article = articleById.get(g.articleId);
    if (!article) continue;
    const catName = article.category_id ? categoryNameById.get(article.category_id) : null;
    const topic = g.issueType
      ? `${issueMap[g.issueType] ?? 'Improve'}: ${article.title}`
      : `Improve article: ${article.title}`;
    gaps.push({
      topic,
      confidence: Math.min(95, g.count * 15),
      priority: g.count > 10 ? 'critical' : g.count > 5 ? 'high' : 'medium',
      category: catName ?? 'best_practices',
      evidence: { negativeFeeback: g.count },
      suggestedArticles: [
        {
          title: `Updated: ${article.title}`,
          contentType: 'tutorial',
          difficultyLevel: 'intermediate',
          rationale: `Address user feedback about ${g.issueType ?? 'article quality'}`,
        },
      ],
      relatedFeatures: [],
    });
  }
  return gaps;
}

// ─── Feature coverage ────────────────────────────────────────────────────────

async function analyzeFeatureCoverage(db: DB, tenantId: string): Promise<ContentGap[]> {
  // Pull every published article title + plain_text_content + keywords once,
  // then scan in JS. Avoids running 30 ILIKE queries serially.
  const { data: articles } = await db
    .from('knowledge_articles')
    .select('id, title, plain_text_content, keywords')
    .eq('tenant_id', tenantId)
    .eq('status', 'published')
    .limit(20000);

  const corpus = (
    (articles ?? []) as Array<{
      title: string | null;
      plain_text_content: string | null;
      keywords: unknown;
    }>
  ).map((a) => ({
    haystack: [
      String(a.title ?? ''),
      String(a.plain_text_content ?? ''),
      typeof a.keywords === 'string' ? a.keywords : JSON.stringify(a.keywords ?? []),
    ]
      .join(' ')
      .toLowerCase(),
  }));

  const gaps: ContentGap[] = [];
  for (const feature of PLATFORM_FEATURES) {
    const needle = feature.name.toLowerCase();
    let count = 0;
    for (const a of corpus) {
      if (a.haystack.includes(needle)) count++;
    }
    if (count < 2) {
      gaps.push({
        topic: feature.name,
        confidence: 90,
        priority: feature.priority,
        category: feature.category,
        evidence: {},
        suggestedArticles: generateFeatureArticleSuggestions(feature.name),
        relatedFeatures: [feature.name],
      });
    }
  }
  return gaps;
}

// ─── Category health ─────────────────────────────────────────────────────────

async function analyzeCategoryHealth(
  db: DB,
  tenantId: string,
): Promise<Record<string, CategoryHealth>> {
  const { data: cats } = await db
    .from('knowledge_categories')
    .select('id, slug, ai_suggested_topics')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  const result: Record<string, CategoryHealth> = {};
  if (!cats || cats.length === 0) return result;

  // Batch-fetch article counts across all active categories in one query.
  const catIds = (cats as Array<{ id: string }>).map((c) => c.id);
  const { data: articles } = await db
    .from('knowledge_articles')
    .select('category_id')
    .eq('tenant_id', tenantId)
    .eq('status', 'published')
    .in('category_id', catIds);

  const countByCat = new Map<string, number>();
  for (const row of (articles ?? []) as Array<{ category_id: string | null }>) {
    if (!row.category_id) continue;
    countByCat.set(row.category_id, (countByCat.get(row.category_id) ?? 0) + 1);
  }

  for (const cat of cats as Array<{
    id: string;
    slug: string;
    ai_suggested_topics: unknown;
  }>) {
    const target = extractTargetArticles(cat.ai_suggested_topics) ?? 20;
    const articleCount = countByCat.get(cat.id) ?? 0;
    const coverageScore = Math.min(100, Math.round((articleCount / target) * 100));
    result[cat.slug] = {
      articleCount,
      targetArticles: target,
      coverageScore,
      status:
        coverageScore >= 80
          ? 'excellent'
          : coverageScore >= 50
            ? 'good'
            : coverageScore >= 25
              ? 'fair'
              : 'poor',
      missingTopics: [],
    };
  }
  return result;
}

function extractTargetArticles(raw: unknown): number | null {
  if (!raw) return null;
  const obj = typeof raw === 'string' ? safeParse(raw) : raw;
  // Express SQL was `${ai_suggested_topics}->>'targetArticles'::int` which assumes
  // the jsonb is an object with a targetArticles key. Sometimes it's an array
  // (default in the schema); guard both.
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    const v = (obj as Record<string, unknown>).targetArticles;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const n = parseInt(v, 10);
      return isNaN(n) ? null : n;
    }
  }
  return null;
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// ─── Merge + prioritize ──────────────────────────────────────────────────────

function mergeAndPrioritizeGaps(gaps: ContentGap[]): ContentGap[] {
  const unique = new Map<string, ContentGap>();
  for (const gap of gaps) {
    const key = gap.topic.toLowerCase().trim();
    const existing = unique.get(key);
    if (!existing) {
      unique.set(key, gap);
      continue;
    }
    existing.evidence = { ...existing.evidence, ...gap.evidence };
    existing.confidence = Math.max(existing.confidence, gap.confidence);
    if (PRIORITY_ORDER[gap.priority] < PRIORITY_ORDER[existing.priority]) {
      existing.priority = gap.priority;
    }
  }

  return [...unique.values()].sort((a, b) => {
    if (PRIORITY_ORDER[a.priority] !== PRIORITY_ORDER[b.priority]) {
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    }
    return b.confidence - a.confidence;
  });
}

// ─── Recommendations ─────────────────────────────────────────────────────────

function generateRecommendations(
  gaps: ContentGap[],
  categoryHealth: Record<string, CategoryHealth>,
): string[] {
  const recs: string[] = [];

  const critical = gaps.filter((g) => g.priority === 'critical');
  if (critical.length > 0) {
    recs.push(
      `🔴 **Immediate Action**: Create ${critical.length} critical article(s) for highly searched topics with no content.`,
    );
  }

  for (const [slug, health] of Object.entries(categoryHealth)) {
    if (health.coverageScore < 25) {
      const label = slug.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
      recs.push(
        `📁 **${label}**: Critically low coverage (${health.articleCount}/${health.targetArticles} articles). Prioritize content creation.`,
      );
    }
  }

  const searchGaps = gaps.filter(
    (g) => g.evidence.searchVolume !== undefined && g.evidence.searchVolume > 10,
  );
  if (searchGaps.length > 5) {
    recs.push(
      `🔍 **User-Driven Content**: ${searchGaps.length} topics have high search volume but limited content. Focus on user needs.`,
    );
  }

  const feedbackGaps = gaps.filter(
    (g) => g.evidence.negativeFeeback !== undefined && g.evidence.negativeFeeback > 5,
  );
  if (feedbackGaps.length > 0) {
    recs.push(
      `💬 **Content Quality**: ${feedbackGaps.length} existing article(s) need revision based on user feedback.`,
    );
  }

  if (gaps.length > 20) {
    recs.push(
      `📈 **Scaling Strategy**: Consider AI-generated article drafts to quickly address ${gaps.length} identified gaps.`,
    );
  }

  return recs;
}

// ─── Pure helpers ────────────────────────────────────────────────────────────

function calculateSearchGapConfidence(totalSearches: number, zeroResults: number): number {
  const zeroRatio = totalSearches > 0 ? zeroResults / totalSearches : 0;
  const volumeScore = Math.min(50, totalSearches * 5);
  const zeroScore = zeroRatio * 50;
  return Math.min(100, Math.round(volumeScore + zeroScore));
}

function determineSearchGapPriority(
  totalSearches: number,
  zeroResults: number,
): ContentGap['priority'] {
  if (totalSearches > 20 && zeroResults > 15) return 'critical';
  if (totalSearches > 10 && zeroResults > 7) return 'high';
  if (totalSearches > 5 && zeroResults > 3) return 'medium';
  return 'low';
}

function inferCategory(query: string): string {
  const q = query.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => q.includes(k))) return category;
  }
  return 'best_practices';
}

function generateArticleSuggestions(topic: string): Array<{
  title: string;
  contentType: string;
  difficultyLevel: string;
  rationale: string;
}> {
  return [
    {
      title: `How to ${topic}`,
      contentType: 'how_to',
      difficultyLevel: 'beginner',
      rationale: 'Quick guide for common user query',
    },
    {
      title: `${topic}: Complete Guide`,
      contentType: 'tutorial',
      difficultyLevel: 'intermediate',
      rationale: 'Comprehensive tutorial for detailed understanding',
    },
  ];
}

function generateFeatureArticleSuggestions(featureName: string): Array<{
  title: string;
  contentType: string;
  difficultyLevel: string;
  rationale: string;
}> {
  return [
    {
      title: `${featureName}: Getting Started`,
      contentType: 'tutorial',
      difficultyLevel: 'beginner',
      rationale: 'Introductory guide for new users',
    },
    {
      title: `${featureName} Best Practices`,
      contentType: 'best_practice',
      difficultyLevel: 'intermediate',
      rationale: 'Optimization and strategy guide',
    },
    {
      title: `Troubleshooting ${featureName}`,
      contentType: 'troubleshooting',
      difficultyLevel: 'intermediate',
      rationale: 'Common issues and solutions',
    },
  ];
}

function extractFeatureKeywords(query: string): string[] {
  const q = query.toLowerCase();
  return FEATURE_TERMS.filter((t) => q.includes(t));
}
