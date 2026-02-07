/**
 * Content Gap Analysis Service
 *
 * AI-powered analysis to identify missing or weak content in the knowledge base
 * Based on user search queries, feedback, and platform feature coverage
 */

import { db } from '../db';
import { eq, and, sql, desc, lt, isNull } from 'drizzle-orm';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('content-gap-analysis-service');

import {
  knowledgeArticles,
  knowledgeCategories,
  knowledgeSearchQueries,
  articleFeedback,
  aiContentGenerationQueue,
} from '@shared/schema';
import ClaudeAIService from './claude-ai-service';

interface ContentGap {
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

interface AnalysisReport {
  generatedAt: Date;
  totalGaps: number;
  criticalGaps: number;
  highPriorityGaps: number;
  gaps: ContentGap[];
  categoryHealth: Record<
    string,
    {
      articleCount: number;
      coverageScore: number; // 0-100
      missingTopics: string[];
    }
  >;
  recommendations: string[];
}

class ContentGapAnalysisService {
  /**
   * Generate comprehensive content gap analysis
   */
  async generateAnalysis(tenantId: string): Promise<AnalysisReport> {
    log.info('🔍 Starting content gap analysis for tenant:', tenantId);

    const [searchGaps, feedbackGaps, featureCoverageGaps, categoryHealth] = await Promise.all([
      this.analyzeSearchPatterns(tenantId),
      this.analyzeFeedback(tenantId),
      this.analyzeFeatureCoverage(tenantId),
      this.analyzeCategoryHealth(tenantId),
    ]);

    // Combine and deduplicate gaps
    const allGaps = this.mergeAndPrioritizeGaps([
      ...searchGaps,
      ...feedbackGaps,
      ...featureCoverageGaps,
    ]);

    const criticalGaps = allGaps.filter((g) => g.priority === 'critical');
    const highPriorityGaps = allGaps.filter((g) => g.priority === 'high');

    const recommendations = this.generateRecommendations(allGaps, categoryHealth);

    return {
      generatedAt: new Date(),
      totalGaps: allGaps.length,
      criticalGaps: criticalGaps.length,
      highPriorityGaps: highPriorityGaps.length,
      gaps: allGaps,
      categoryHealth,
      recommendations,
    };
  }

  /**
   * Analyze search query patterns to identify topics users are looking for
   */
  private async analyzeSearchPatterns(tenantId: string): Promise<ContentGap[]> {
    log.info('🔎 Analyzing search patterns...');

    // Get search queries from last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const searches = await db
      .select({
        query: knowledgeSearchQueries.queryText,
        resultsCount: sql<number>`COUNT(*)::int`,
        avgResults: sql<number>`AVG(${knowledgeSearchQueries.resultsCount})::int`,
        zeroResults: sql<number>`COUNT(*) FILTER (WHERE ${knowledgeSearchQueries.resultsCount} = 0)::int`,
      })
      .from(knowledgeSearchQueries)
      .where(
        and(
          eq(knowledgeSearchQueries.tenantId, tenantId),
          sql`${knowledgeSearchQueries.createdAt} > ${ninetyDaysAgo}`,
        ),
      )
      .groupBy(knowledgeSearchQueries.queryText)
      .having(sql`COUNT(*) > 2`) // At least 3 searches
      .orderBy(desc(sql`COUNT(*)`));

    const gaps: ContentGap[] = [];

    for (const search of searches) {
      // High volume searches with zero or low results indicate content gaps
      if (search.zeroResults > search.resultsCount * 0.5 || search.avgResults < 2) {
        gaps.push({
          topic: search.query,
          confidence: this.calculateSearchGapConfidence(search.resultsCount, search.zeroResults),
          priority: this.determineSearchGapPriority(search.resultsCount, search.zeroResults),
          category: await this.inferCategory(search.query),
          evidence: {
            searchVolume: search.resultsCount,
            zeroResultSearches: search.zeroResults,
          },
          suggestedArticles: await this.generateArticleSuggestions(search.query),
          relatedFeatures: this.extractFeatureKeywords(search.query),
        });
      }
    }

    log.info(`  Found ${gaps.length} content gaps from search patterns`);
    return gaps;
  }

  /**
   * Analyze user feedback to identify problematic or missing content
   */
  private async analyzeFeedback(tenantId: string): Promise<ContentGap[]> {
    log.info('💬 Analyzing user feedback...');

    const gaps: ContentGap[] = [];

    // Find articles with high unhelpful ratings or specific issues reported
    const problematicArticles = await db
      .select({
        articleId: articleFeedback.articleId,
        articleTitle: knowledgeArticles.title,
        issueType: articleFeedback.issueType,
        category: knowledgeCategories.name,
        feedbackCount: sql<number>`COUNT(*)::int`,
      })
      .from(articleFeedback)
      .innerJoin(knowledgeArticles, eq(articleFeedback.articleId, knowledgeArticles.id))
      .innerJoin(knowledgeCategories, eq(knowledgeArticles.categoryId, knowledgeCategories.id))
      .where(
        and(eq(articleFeedback.tenantId, tenantId), eq(articleFeedback.feedbackType, 'unhelpful')),
      )
      .groupBy(
        articleFeedback.articleId,
        knowledgeArticles.title,
        articleFeedback.issueType,
        knowledgeCategories.name,
      )
      .having(sql`COUNT(*) >= 3`);

    for (const article of problematicArticles) {
      const issueMap: Record<string, string> = {
        outdated: 'Update outdated content',
        incorrect: 'Fix incorrect information',
        unclear: 'Clarify unclear instructions',
        missing_info: 'Add missing details',
        technical_error: 'Fix technical errors',
      };

      const topic = article.issueType
        ? `${issueMap[article.issueType] || 'Improve'}: ${article.articleTitle}`
        : `Improve article: ${article.articleTitle}`;

      gaps.push({
        topic,
        confidence: Math.min(95, article.feedbackCount * 15), // Higher feedback = higher confidence
        priority:
          article.feedbackCount > 10 ? 'critical' : article.feedbackCount > 5 ? 'high' : 'medium',
        category: article.category,
        evidence: {
          negativeFeeback: article.feedbackCount,
        },
        suggestedArticles: [
          {
            title: `Updated: ${article.articleTitle}`,
            contentType: 'tutorial',
            difficultyLevel: 'intermediate',
            rationale: `Address user feedback about ${article.issueType || 'article quality'}`,
          },
        ],
        relatedFeatures: [],
      });
    }

    log.info(`  Found ${gaps.length} content gaps from feedback`);
    return gaps;
  }

  /**
   * Analyze platform features to find undocumented or poorly documented areas
   */
  private async analyzeFeatureCoverage(tenantId: string): Promise<ContentGap[]> {
    log.info('📋 Analyzing feature coverage...');

    const gaps: ContentGap[] = [];

    // Define all major platform features (this would ideally come from a feature registry)
    const platformFeatures = [
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

    // Check coverage for each feature
    for (const feature of platformFeatures) {
      const articleCount = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(knowledgeArticles)
        .where(
          and(
            eq(knowledgeArticles.tenantId, tenantId),
            eq(knowledgeArticles.status, 'published'),
            sql`(
              ${knowledgeArticles.title} ILIKE ${`%${feature.name}%`} OR
              ${knowledgeArticles.plainTextContent} ILIKE ${`%${feature.name}%`} OR
              ${knowledgeArticles.keywords}::text ILIKE ${`%${feature.name}%`}
            )`,
          ),
        );

      const coverage = articleCount[0]?.count || 0;

      // Feature needs documentation if it has < 2 articles
      if (coverage < 2) {
        gaps.push({
          topic: feature.name,
          confidence: 90,
          priority: feature.priority as any,
          category: feature.category,
          evidence: {},
          suggestedArticles: this.generateFeatureArticleSuggestions(feature.name),
          relatedFeatures: [feature.name],
        });
      }
    }

    log.info(`  Found ${gaps.length} content gaps from feature coverage`);
    return gaps;
  }

  /**
   * Analyze health/completeness of each category
   */
  private async analyzeCategoryHealth(tenantId: string): Promise<Record<string, any>> {
    log.info('📊 Analyzing category health...');

    const categories = await db
      .select({
        id: knowledgeCategories.id,
        name: knowledgeCategories.name,
        slug: knowledgeCategories.slug,
        targetArticles: sql<number>`(${knowledgeCategories.aiSuggestedTopics}->>'targetArticles')::int`,
      })
      .from(knowledgeCategories)
      .where(
        and(eq(knowledgeCategories.tenantId, tenantId), eq(knowledgeCategories.isActive, true)),
      );

    const categoryHealth: Record<string, any> = {};

    for (const category of categories) {
      const articles = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(knowledgeArticles)
        .where(
          and(
            eq(knowledgeArticles.tenantId, tenantId),
            eq(knowledgeArticles.categoryId, category.id),
            eq(knowledgeArticles.status, 'published'),
          ),
        );

      const articleCount = articles[0]?.count || 0;
      const target = category.targetArticles || 20;
      const coverageScore = Math.min(100, (articleCount / target) * 100);

      categoryHealth[category.slug] = {
        articleCount,
        targetArticles: target,
        coverageScore: Math.round(coverageScore),
        status:
          coverageScore >= 80
            ? 'excellent'
            : coverageScore >= 50
              ? 'good'
              : coverageScore >= 25
                ? 'fair'
                : 'poor',
        missingTopics: [], // Would be populated by AI analysis
      };
    }

    return categoryHealth;
  }

  /**
   * Merge gaps from different sources and prioritize
   */
  private mergeAndPrioritizeGaps(gaps: ContentGap[]): ContentGap[] {
    // Deduplicate by topic (case-insensitive)
    const uniqueGaps = new Map<string, ContentGap>();

    for (const gap of gaps) {
      const key = gap.topic.toLowerCase().trim();

      if (!uniqueGaps.has(key)) {
        uniqueGaps.set(key, gap);
      } else {
        // Merge evidence from duplicate gaps
        const existing = uniqueGaps.get(key)!;
        existing.evidence = {
          ...existing.evidence,
          ...gap.evidence,
        };
        existing.confidence = Math.max(existing.confidence, gap.confidence);

        // Keep highest priority
        const priorities = ['critical', 'high', 'medium', 'low'];
        if (priorities.indexOf(gap.priority) < priorities.indexOf(existing.priority)) {
          existing.priority = gap.priority;
        }
      }
    }

    // Sort by priority and confidence
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

    return Array.from(uniqueGaps.values()).sort((a, b) => {
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.confidence - a.confidence;
    });
  }

  /**
   * Generate actionable recommendations based on gaps
   */
  private generateRecommendations(
    gaps: ContentGap[],
    categoryHealth: Record<string, any>,
  ): string[] {
    const recommendations: string[] = [];

    // Critical gaps
    const criticalGaps = gaps.filter((g) => g.priority === 'critical');
    if (criticalGaps.length > 0) {
      recommendations.push(
        `🔴 **Immediate Action**: Create ${criticalGaps.length} critical article(s) for highly searched topics with no content.`,
      );
    }

    // Category-specific recommendations
    for (const [slug, health] of Object.entries(categoryHealth)) {
      if (health.coverageScore < 25) {
        recommendations.push(
          `📁 **${slug.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}**: Critically low coverage (${health.articleCount}/${health.targetArticles} articles). Prioritize content creation.`,
        );
      }
    }

    // Search-driven recommendations
    const searchGaps = gaps.filter((g) => g.evidence.searchVolume && g.evidence.searchVolume > 10);
    if (searchGaps.length > 5) {
      recommendations.push(
        `🔍 **User-Driven Content**: ${searchGaps.length} topics have high search volume but limited content. Focus on user needs.`,
      );
    }

    // Feedback-driven recommendations
    const feedbackGaps = gaps.filter(
      (g) => g.evidence.negativeFeeback && g.evidence.negativeFeeback > 5,
    );
    if (feedbackGaps.length > 0) {
      recommendations.push(
        `💬 **Content Quality**: ${feedbackGaps.length} existing article(s) need revision based on user feedback.`,
      );
    }

    // General recommendations
    if (gaps.length > 20) {
      recommendations.push(
        `📈 **Scaling Strategy**: Consider AI-generated article drafts to quickly address ${gaps.length} identified gaps.`,
      );
    }

    return recommendations;
  }

  /**
   * Calculate confidence score for search-based gaps
   */
  private calculateSearchGapConfidence(totalSearches: number, zeroResults: number): number {
    const zeroResultRatio = zeroResults / totalSearches;
    const volumeScore = Math.min(50, totalSearches * 5); // More searches = higher confidence
    const zeroResultScore = zeroResultRatio * 50; // Higher ratio = higher confidence

    return Math.min(100, Math.round(volumeScore + zeroResultScore));
  }

  /**
   * Determine priority for search-based gaps
   */
  private determineSearchGapPriority(
    totalSearches: number,
    zeroResults: number,
  ): 'critical' | 'high' | 'medium' | 'low' {
    if (totalSearches > 20 && zeroResults > 15) return 'critical';
    if (totalSearches > 10 && zeroResults > 7) return 'high';
    if (totalSearches > 5 && zeroResults > 3) return 'medium';
    return 'low';
  }

  /**
   * Infer category from search query using keyword matching
   */
  private async inferCategory(query: string): Promise<string> {
    const queryLower = query.toLowerCase();

    const categoryKeywords: Record<string, string[]> = {
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

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some((keyword) => queryLower.includes(keyword))) {
        return category;
      }
    }

    return 'best_practices'; // Default category
  }

  /**
   * Generate article suggestions using AI
   */
  private async generateArticleSuggestions(topic: string): Promise<
    Array<{
      title: string;
      contentType: string;
      difficultyLevel: string;
      rationale: string;
    }>
  > {
    // For now, return template-based suggestions
    // In production, this would use ClaudeAIService for intelligent suggestions
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

  /**
   * Generate article suggestions for platform features
   */
  private generateFeatureArticleSuggestions(featureName: string): Array<{
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

  /**
   * Extract feature keywords from query
   */
  private extractFeatureKeywords(query: string): string[] {
    const keywords: string[] = [];
    const queryLower = query.toLowerCase();

    const featureTerms = [
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

    for (const term of featureTerms) {
      if (queryLower.includes(term)) {
        keywords.push(term);
      }
    }

    return keywords;
  }
}

export default new ContentGapAnalysisService();
