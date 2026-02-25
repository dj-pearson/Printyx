import express from 'express';
import { desc, eq, and, sql, asc, gte, lte, inArray } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from './db';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-seo');

import {
  seoSettings,
  seoAuditHistory,
  seoFixesApplied,
  seoKeywords,
  seoKeywordHistory,
  seoCompetitorAnalysis,
  seoPageScores,
  seoMonitoringLog,
  gscOauthCredentials,
  gscProperties,
  gscKeywordPerformance,
  gscPagePerformance,
  seoNotificationPreferences,
  seoAlertRules,
  seoAlerts,
  seoMonitoringSchedules,
  seoCoreWebVitals,
  seoCrawlResults,
  seoImageAnalysis,
  seoRedirectAnalysis,
  seoDuplicateContent,
  seoSecurityAnalysis,
  seoLinkAnalysis,
  seoStructuredData,
  seoMobileAnalysis,
  seoPerformanceBudget,
  seoContentOptimization,
  seoSemanticAnalysis,
} from '@shared/schema';
import { seoService } from './services/seo-service';

import { getUserId, getTenantId } from './utils/auth-helpers';
const router = express.Router();

// ============= SETTINGS =============

// Get SEO settings
router.get('/api/seo/settings', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const [settings] = await db
      .select()
      .from(seoSettings)
      .where(eq(seoSettings.tenantId, tenantId))
      .limit(1);

    res.json(settings || {});
  } catch (error: any) {
    log.error('Error fetching SEO settings:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update SEO settings
router.post('/api/seo/settings', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const [existing] = await db
      .select()
      .from(seoSettings)
      .where(eq(seoSettings.tenantId, tenantId))
      .limit(1);

    // SECURITY FIX: Add validation schema to prevent mass assignment
    const seoSettingsSchema = z
      .object({
        metaTitle: z.string().max(255).optional(),
        metaDescription: z.string().max(500).optional(),
        metaKeywords: z.string().optional(),
        ogTitle: z.string().max(255).optional(),
        ogDescription: z.string().max(500).optional(),
        ogImage: z.string().url().optional(),
        twitterCard: z.string().optional(),
        canonicalUrl: z.string().url().optional(),
        structuredData: z.any().optional(), // JSON field
        robots: z.string().optional(),
      })
      .strict();

    const validatedData = seoSettingsSchema.parse(req.body);

    let result;
    if (existing) {
      [result] = await db
        .update(seoSettings)
        .set({ ...validatedData, updatedAt: new Date() })
        .where(eq(seoSettings.id, existing.id))
        .returning();
    } else {
      [result] = await db
        .insert(seoSettings)
        .values({ ...validatedData, tenantId })
        .returning();
    }

    res.json(result);
  } catch (error: any) {
    log.error('Error updating SEO settings:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ message: error.message });
  }
});

// ============= AUDIT =============

// Run SEO audit
router.post('/api/seo/audit', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ message: 'URL is required' });
    }

    // Start audit
    const [audit] = await db
      .insert(seoAuditHistory)
      .values({
        tenantId,
        url,
        status: 'running',
        triggeredBy: userId,
        startedAt: new Date(),
      })
      .returning();

    // Perform audit (simplified version - in production, this would call various SEO analysis services)
    const auditResults = await performSEOAudit(url);

    // Update audit with results
    const [updatedAudit] = await db
      .update(seoAuditHistory)
      .set({
        status: 'completed',
        ...auditResults,
        completedAt: new Date(),
        duration: Date.now() - audit.startedAt.getTime(),
      })
      .where(eq(seoAuditHistory.id, audit.id))
      .returning();

    res.json(updatedAudit);
  } catch (error: any) {
    log.error('Error running SEO audit:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get audit history
router.get('/api/seo/audit/history', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const audits = await db
      .select()
      .from(seoAuditHistory)
      .where(eq(seoAuditHistory.tenantId, tenantId))
      .orderBy(desc(seoAuditHistory.createdAt))
      .limit(limit)
      .offset(offset);

    res.json(audits);
  } catch (error: any) {
    log.error('Error fetching audit history:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get specific audit
router.get('/api/seo/audit/:id', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const [audit] = await db
      .select()
      .from(seoAuditHistory)
      .where(and(eq(seoAuditHistory.id, req.params.id), eq(seoAuditHistory.tenantId, tenantId)))
      .limit(1);

    if (!audit) {
      return res.status(404).json({ message: 'Audit not found' });
    }

    res.json(audit);
  } catch (error: any) {
    log.error('Error fetching audit:', error);
    res.status(500).json({ message: error.message });
  }
});

// Apply SEO fixes
router.post('/api/seo/audit/:id/apply-fixes', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const { fixes } = req.body; // Array of fix objects

    const appliedFixes = await Promise.all(
      fixes.map(async (fix: any) => {
        const [applied] = await db
          .insert(seoFixesApplied)
          .values({
            tenantId,
            auditId: req.params.id,
            category: fix.category,
            issue: fix.issue,
            fix: fix.fix,
            severity: fix.severity,
            status: 'applied',
            appliedBy: userId,
            appliedAt: new Date(),
          })
          .returning();
        return applied;
      }),
    );

    res.json(appliedFixes);
  } catch (error: any) {
    log.error('Error applying fixes:', error);
    res.status(500).json({ message: error.message });
  }
});

// ============= KEYWORDS =============

// Get keywords
router.get('/api/seo/keywords', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const keywords = await db
      .select()
      .from(seoKeywords)
      .where(eq(seoKeywords.tenantId, tenantId))
      .orderBy(desc(seoKeywords.priority));

    res.json(keywords);
  } catch (error: any) {
    log.error('Error fetching keywords:', error);
    res.status(500).json({ message: error.message });
  }
});

// Add keyword
router.post('/api/seo/keywords', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const [keyword] = await db
      .insert(seoKeywords)
      .values({ ...req.body, tenantId })
      .returning();

    res.json(keyword);
  } catch (error: any) {
    log.error('Error adding keyword:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update keyword
router.put('/api/seo/keywords/:id', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const [keyword] = await db
      .update(seoKeywords)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(eq(seoKeywords.id, req.params.id), eq(seoKeywords.tenantId, tenantId)))
      .returning();

    res.json(keyword);
  } catch (error: any) {
    log.error('Error updating keyword:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete keyword
router.delete('/api/seo/keywords/:id', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    await db
      .delete(seoKeywords)
      .where(and(eq(seoKeywords.id, req.params.id), eq(seoKeywords.tenantId, tenantId)));

    res.json({ success: true });
  } catch (error: any) {
    log.error('Error deleting keyword:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get keyword history
router.get('/api/seo/keywords/:id/history', async (req: any, res) => {
  try {
    const history = await db
      .select()
      .from(seoKeywordHistory)
      .where(eq(seoKeywordHistory.keywordId, req.params.id))
      .orderBy(desc(seoKeywordHistory.recordedAt))
      .limit(100);

    res.json(history);
  } catch (error: any) {
    log.error('Error fetching keyword history:', error);
    res.status(500).json({ message: error.message });
  }
});

// Check keyword positions
router.post('/api/seo/keywords/check-positions', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const { keywordIds } = req.body;

    // Fetch keywords
    const keywords = await db
      .select()
      .from(seoKeywords)
      .where(and(eq(seoKeywords.tenantId, tenantId), inArray(seoKeywords.id, keywordIds)));

    // Check positions (simplified - in production, use SERP API)
    const results = await Promise.all(
      keywords.map(async (keyword) => {
        const position = await checkKeywordPosition(keyword.keyword, keyword.targetUrl);

        // Update keyword
        await db
          .update(seoKeywords)
          .set({
            currentPosition: position,
            lastChecked: new Date(),
          })
          .where(eq(seoKeywords.id, keyword.id));

        // Record history
        await db.insert(seoKeywordHistory).values({
          keywordId: keyword.id,
          position,
          recordedAt: new Date(),
        });

        return { ...keyword, currentPosition: position };
      }),
    );

    res.json(results);
  } catch (error: any) {
    log.error('Error checking keyword positions:', error);
    res.status(500).json({ message: error.message });
  }
});

// ============= SITE CRAWLER =============

// Start crawl
router.post('/api/seo/crawl', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const { startUrl, maxPages = 100, maxDepth = 3 } = req.body;

    if (!startUrl) {
      return res.status(400).json({ message: 'Start URL is required' });
    }

    const crawlId = crypto.randomUUID();

    // Start crawling (simplified - in production, use a proper crawler)
    const crawlResults = await crawlSite(startUrl, maxPages, maxDepth);

    // Store results
    const storedResults = await Promise.all(
      crawlResults.map(async (result: any) => {
        const [stored] = await db
          .insert(seoCrawlResults)
          .values({
            tenantId,
            crawlId,
            ...result,
            crawledAt: new Date(),
          })
          .returning();
        return stored;
      }),
    );

    res.json({ crawlId, results: storedResults });
  } catch (error: any) {
    log.error('Error starting crawl:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get crawl results
router.get('/api/seo/crawl/:crawlId', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const results = await db
      .select()
      .from(seoCrawlResults)
      .where(
        and(
          eq(seoCrawlResults.tenantId, tenantId),
          eq(seoCrawlResults.crawlId, req.params.crawlId),
        ),
      )
      .orderBy(asc(seoCrawlResults.crawlDepth));

    res.json(results);
  } catch (error: any) {
    log.error('Error fetching crawl results:', error);
    res.status(500).json({ message: error.message });
  }
});

// ============= CORE WEB VITALS =============

// Check Core Web Vitals
router.post('/api/seo/core-web-vitals', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const { url, device = 'mobile' } = req.body;

    if (!url) {
      return res.status(400).json({ message: 'URL is required' });
    }

    // Check Core Web Vitals using PageSpeed Insights API
    const vitals = await checkCoreWebVitals(url, device);

    // Store results
    const [stored] = await db
      .insert(seoCoreWebVitals)
      .values({
        tenantId,
        url,
        device,
        ...vitals,
        measuredAt: new Date(),
      })
      .returning();

    res.json(stored);
  } catch (error: any) {
    log.error('Error checking Core Web Vitals:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get Core Web Vitals history
router.get('/api/seo/core-web-vitals', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const { url } = req.query;
    const limit = parseInt(req.query.limit as string) || 30;

    const conditions = [eq(seoCoreWebVitals.tenantId, tenantId)];
    if (url) {
      conditions.push(eq(seoCoreWebVitals.url, url as string));
    }

    const vitals = await db
      .select()
      .from(seoCoreWebVitals)
      .where(and(...conditions))
      .orderBy(desc(seoCoreWebVitals.measuredAt))
      .limit(limit);

    res.json(vitals);
  } catch (error: any) {
    log.error('Error fetching Core Web Vitals:', error);
    res.status(500).json({ message: error.message });
  }
});

// ============= PAGE ANALYSIS =============

// Analyze page
router.post('/api/seo/analyze/page', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ message: 'URL is required' });
    }

    const analysis = await analyzePage(url);

    const [stored] = await db
      .insert(seoPageScores)
      .values({
        tenantId,
        url,
        ...analysis,
        lastAnalyzed: new Date(),
      })
      .returning();

    res.json(stored);
  } catch (error: any) {
    log.error('Error analyzing page:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get page scores
router.get('/api/seo/page-scores', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const scores = await db
      .select()
      .from(seoPageScores)
      .where(eq(seoPageScores.tenantId, tenantId))
      .orderBy(desc(seoPageScores.lastAnalyzed))
      .limit(100);

    res.json(scores);
  } catch (error: any) {
    log.error('Error fetching page scores:', error);
    res.status(500).json({ message: error.message });
  }
});

// ============= IMAGE ANALYSIS =============

// Analyze images
router.post('/api/seo/analyze/images', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const { pageUrl } = req.body;

    if (!pageUrl) {
      return res.status(400).json({ message: 'Page URL is required' });
    }

    const images = await analyzeImages(pageUrl);

    const storedImages = await Promise.all(
      images.map(async (image: any) => {
        const [stored] = await db
          .insert(seoImageAnalysis)
          .values({
            tenantId,
            pageUrl,
            ...image,
            analyzedAt: new Date(),
          })
          .returning();
        return stored;
      }),
    );

    res.json(storedImages);
  } catch (error: any) {
    log.error('Error analyzing images:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get image analysis
router.get('/api/seo/images', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const { pageUrl } = req.query;

    const conditions = [eq(seoImageAnalysis.tenantId, tenantId)];
    if (pageUrl) {
      conditions.push(eq(seoImageAnalysis.pageUrl, pageUrl as string));
    }

    const images = await db
      .select()
      .from(seoImageAnalysis)
      .where(and(...conditions))
      .orderBy(desc(seoImageAnalysis.analyzedAt))
      .limit(100);

    res.json(images);
  } catch (error: any) {
    log.error('Error fetching image analysis:', error);
    res.status(500).json({ message: error.message });
  }
});

// ============= BROKEN LINKS =============

// Check broken links
router.post('/api/seo/check/broken-links', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const { sourceUrl } = req.body;

    if (!sourceUrl) {
      return res.status(400).json({ message: 'Source URL is required' });
    }

    const links = await checkBrokenLinks(sourceUrl);

    const storedLinks = await Promise.all(
      links.map(async (link: any) => {
        const [stored] = await db
          .insert(seoLinkAnalysis)
          .values({
            tenantId,
            sourceUrl,
            ...link,
            checkedAt: new Date(),
          })
          .returning();
        return stored;
      }),
    );

    res.json(storedLinks);
  } catch (error: any) {
    log.error('Error checking broken links:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get broken links
router.get('/api/seo/broken-links', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const brokenLinks = await db
      .select()
      .from(seoLinkAnalysis)
      .where(and(eq(seoLinkAnalysis.tenantId, tenantId), eq(seoLinkAnalysis.isBroken, true)))
      .orderBy(desc(seoLinkAnalysis.checkedAt))
      .limit(100);

    res.json(brokenLinks);
  } catch (error: any) {
    log.error('Error fetching broken links:', error);
    res.status(500).json({ message: error.message });
  }
});

// ============= SECURITY ANALYSIS =============

// Check security headers
router.post('/api/seo/check/security', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ message: 'URL is required' });
    }

    const security = await checkSecurityHeaders(url);

    const [stored] = await db
      .insert(seoSecurityAnalysis)
      .values({
        tenantId,
        url,
        ...security,
        checkedAt: new Date(),
      })
      .returning();

    res.json(stored);
  } catch (error: any) {
    log.error('Error checking security:', error);
    res.status(500).json({ message: error.message });
  }
});

// ============= MOBILE ANALYSIS =============

// Check mobile friendliness
router.post('/api/seo/check/mobile', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ message: 'URL is required' });
    }

    const mobile = await checkMobileFriendliness(url);

    const [stored] = await db
      .insert(seoMobileAnalysis)
      .values({
        tenantId,
        url,
        ...mobile,
        analyzedAt: new Date(),
      })
      .returning();

    res.json(stored);
  } catch (error: any) {
    log.error('Error checking mobile friendliness:', error);
    res.status(500).json({ message: error.message });
  }
});

// ============= STRUCTURED DATA =============

// Validate structured data
router.post('/api/seo/validate/structured-data', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ message: 'URL is required' });
    }

    const schemas = await validateStructuredData(url);

    const storedSchemas = await Promise.all(
      schemas.map(async (schema: any) => {
        const [stored] = await db
          .insert(seoStructuredData)
          .values({
            tenantId,
            url,
            ...schema,
            detectedAt: new Date(),
          })
          .returning();
        return stored;
      }),
    );

    res.json(storedSchemas);
  } catch (error: any) {
    log.error('Error validating structured data:', error);
    res.status(500).json({ message: error.message });
  }
});

// ============= REDIRECT ANALYSIS =============

// Detect redirect chains
router.post('/api/seo/detect/redirect-chains', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const { sourceUrl } = req.body;

    if (!sourceUrl) {
      return res.status(400).json({ message: 'Source URL is required' });
    }

    const redirects = await detectRedirectChains(sourceUrl);

    const [stored] = await db
      .insert(seoRedirectAnalysis)
      .values({
        tenantId,
        sourceUrl,
        ...redirects,
        checkedAt: new Date(),
      })
      .returning();

    res.json(stored);
  } catch (error: any) {
    log.error('Error detecting redirect chains:', error);
    res.status(500).json({ message: error.message });
  }
});

// ============= DUPLICATE CONTENT =============

// Detect duplicate content
router.post('/api/seo/detect/duplicate-content', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const { url1, url2 } = req.body;

    if (!url1 || !url2) {
      return res.status(400).json({ message: 'Both URLs are required' });
    }

    const duplicate = await detectDuplicateContent(url1, url2);

    const [stored] = await db
      .insert(seoDuplicateContent)
      .values({
        tenantId,
        url1,
        url2,
        ...duplicate,
        detectedAt: new Date(),
      })
      .returning();

    res.json(stored);
  } catch (error: any) {
    log.error('Error detecting duplicate content:', error);
    res.status(500).json({ message: error.message });
  }
});

// ============= CONTENT OPTIMIZATION =============

// Optimize content
router.post('/api/seo/optimize/content', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const { title, originalContent, targetKeyword, secondaryKeywords } = req.body;

    const optimization = await optimizeContent(originalContent, targetKeyword, secondaryKeywords);

    const [stored] = await db
      .insert(seoContentOptimization)
      .values({
        tenantId,
        title,
        originalContent,
        targetKeyword,
        secondaryKeywords,
        ...optimization,
      })
      .returning();

    res.json(stored);
  } catch (error: any) {
    log.error('Error optimizing content:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get content optimizations
router.get('/api/seo/content-optimizations', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const optimizations = await db
      .select()
      .from(seoContentOptimization)
      .where(eq(seoContentOptimization.tenantId, tenantId))
      .orderBy(desc(seoContentOptimization.createdAt))
      .limit(50);

    res.json(optimizations);
  } catch (error: any) {
    log.error('Error fetching content optimizations:', error);
    res.status(500).json({ message: error.message });
  }
});

// ============= SEMANTIC ANALYSIS =============

// Analyze semantic keywords
router.post('/api/seo/analyze/semantic', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const { keyword } = req.body;

    if (!keyword) {
      return res.status(400).json({ message: 'Keyword is required' });
    }

    const semantic = await analyzeSemanticKeywords(keyword);

    const [stored] = await db
      .insert(seoSemanticAnalysis)
      .values({
        tenantId,
        keyword,
        ...semantic,
        analyzedAt: new Date(),
      })
      .returning();

    res.json(stored);
  } catch (error: any) {
    log.error('Error analyzing semantic keywords:', error);
    res.status(500).json({ message: error.message });
  }
});

// ============= ALERTS & NOTIFICATIONS =============

// Get alerts
router.get('/api/seo/alerts', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const { status } = req.query;

    const conditions = [eq(seoAlerts.tenantId, tenantId)];
    if (status) {
      conditions.push(eq(seoAlerts.status, status as any));
    }

    const alerts = await db
      .select()
      .from(seoAlerts)
      .where(and(...conditions))
      .orderBy(desc(seoAlerts.createdAt))
      .limit(100);

    res.json(alerts);
  } catch (error: any) {
    log.error('Error fetching alerts:', error);
    res.status(500).json({ message: error.message });
  }
});

// Acknowledge alert
router.post('/api/seo/alerts/:id/acknowledge', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const [alert] = await db
      .update(seoAlerts)
      .set({
        status: 'acknowledged',
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
      })
      .where(and(eq(seoAlerts.id, req.params.id), eq(seoAlerts.tenantId, tenantId)))
      .returning();

    res.json(alert);
  } catch (error: any) {
    log.error('Error acknowledging alert:', error);
    res.status(500).json({ message: error.message });
  }
});

// Resolve alert
router.post('/api/seo/alerts/:id/resolve', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const { resolutionNotes } = req.body;

    const [alert] = await db
      .update(seoAlerts)
      .set({
        status: 'resolved',
        resolvedBy: userId,
        resolvedAt: new Date(),
        resolutionNotes,
      })
      .where(and(eq(seoAlerts.id, req.params.id), eq(seoAlerts.tenantId, tenantId)))
      .returning();

    res.json(alert);
  } catch (error: any) {
    log.error('Error resolving alert:', error);
    res.status(500).json({ message: error.message });
  }
});

// ============= MONITORING =============

// Get monitoring log
router.get('/api/seo/monitoring/log', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const { checkType, startDate, endDate } = req.query;
    const limit = parseInt(req.query.limit as string) || 100;

    const conditions = [eq(seoMonitoringLog.tenantId, tenantId)];
    if (checkType) {
      conditions.push(eq(seoMonitoringLog.checkType, checkType as string));
    }
    if (startDate) {
      conditions.push(gte(seoMonitoringLog.checkedAt, new Date(startDate as string)));
    }
    if (endDate) {
      conditions.push(lte(seoMonitoringLog.checkedAt, new Date(endDate as string)));
    }

    const logs = await db
      .select()
      .from(seoMonitoringLog)
      .where(and(...conditions))
      .orderBy(desc(seoMonitoringLog.checkedAt))
      .limit(limit);

    res.json(logs);
  } catch (error: any) {
    log.error('Error fetching monitoring log:', error);
    res.status(500).json({ message: error.message });
  }
});

// ============= COMPETITOR ANALYSIS =============

// Analyze competitor
router.post('/api/seo/analyze/competitor', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const { competitorUrl, competitorName } = req.body;

    if (!competitorUrl) {
      return res.status(400).json({ message: 'Competitor URL is required' });
    }

    const analysis = await analyzeCompetitor(competitorUrl);

    const [stored] = await db
      .insert(seoCompetitorAnalysis)
      .values({
        tenantId,
        competitorUrl,
        competitorName,
        ...analysis,
        analyzedAt: new Date(),
      })
      .returning();

    res.json(stored);
  } catch (error: any) {
    log.error('Error analyzing competitor:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get competitor analyses
router.get('/api/seo/competitors', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const competitors = await db
      .select()
      .from(seoCompetitorAnalysis)
      .where(eq(seoCompetitorAnalysis.tenantId, tenantId))
      .orderBy(desc(seoCompetitorAnalysis.analyzedAt))
      .limit(20);

    res.json(competitors);
  } catch (error: any) {
    log.error('Error fetching competitors:', error);
    res.status(500).json({ message: error.message });
  }
});

// ============= REAL SERVICE LAYER FUNCTIONS =============
// Alias service functions for easier use
const performSEOAudit = seoService.performComprehensiveSEOAudit;
const crawlSite = (url: string, maxPages: number, maxDepth: number) =>
  seoService.crawlWebsite(url, maxPages, maxDepth, ''); // tenantId added in route handler
const checkCoreWebVitals = seoService.checkCoreWebVitalsWithAPI;
const analyzeImages = seoService.analyzePageImages;
const checkBrokenLinks = seoService.checkBrokenLinks;
const checkSecurityHeaders = seoService.checkSecurityHeaders;
const checkMobileFriendliness = seoService.analyzeMobileFriendliness;
const validateStructuredData = seoService.validateStructuredData;
const detectRedirectChains = seoService.detectRedirectChains;

// Simplified implementations for functions not yet in service layer
async function checkKeywordPosition(keyword: string, targetUrl: string | null, tenantId?: string) {
  // Query stored position from database
  if (tenantId) {
    try {
      const conditions = [eq(seoKeywords.keyword, keyword)];
      if (targetUrl) {
        conditions.push(eq(seoKeywords.targetUrl, targetUrl));
      }
      conditions.push(eq(seoKeywords.tenantId, tenantId));

      const result = await db
        .select({ currentPosition: seoKeywords.currentPosition })
        .from(seoKeywords)
        .where(and(...conditions))
        .limit(1);

      if (result.length > 0 && result[0].currentPosition !== null) {
        return result[0].currentPosition;
      }
    } catch (error) {
      log.error('Error checking keyword position:', error);
    }
  }

  // Return null if no data available
  // NOTE: Real-time SERP position tracking requires integration with SERP API (SERPApi or DataForSEO)
  // Positions can be updated via Google Search Console integration or manual tracking
  return null;
}

async function analyzePage(url: string) {
  // Uses comprehensive audit under the hood
  const audit = await performSEOAudit(url);
  return {
    title: 'Page Title',
    seoScore: audit.overallScore,
    contentQuality: audit.contentScore,
    technicalSeo: audit.technicalScore,
    userExperience: audit.performanceScore,
    wordCount: 0,
    readingLevel: 8.5,
    uniqueContentPercentage: 90,
    loadTime: 0,
    mobileScore: 0,
    accessibilityScore: 0,
    issues: audit.issues,
  };
}

async function detectDuplicateContent(url1: string, url2: string) {
  // TODO: Implement content similarity algorithm
  // For now, return basic structure
  return {
    similarityScore: 0,
    duplicatePercentage: 0,
    sharedPhrases: [],
    uniqueContent1: 0,
    uniqueContent2: 0,
    canonicalSet: false,
    recommendation: 'Check canonical tags',
  };
}

async function optimizeContent(
  content: string,
  targetKeyword: string,
  secondaryKeywords: string[],
) {
  // TODO: Integrate with AI (OpenAI/Anthropic)
  // For now, return basic analysis
  const wordCount = content.split(' ').length;
  return {
    optimizedContent: content,
    keywordDensity: 0,
    readabilityScore: 75,
    seoScore: 80,
    wordCount,
    aiSuggestions: [
      {
        type: 'keyword',
        suggestion: `Include "${targetKeyword}" in the first paragraph`,
        priority: 'high',
      },
    ],
  };
}

async function analyzeSemanticKeywords(keyword: string) {
  // TODO: Integrate with NLP API or AI
  return {
    relatedKeywords: [],
    semanticClusters: [],
    searchIntent: 'informational',
    intentConfidence: 80,
    recommendedTopics: [],
    recommendedQuestions: [],
  };
}

async function analyzeCompetitor(competitorUrl: string) {
  // TODO: Integrate with Ahrefs/Moz/Semrush API
  return {
    estimatedTraffic: 0,
    domainAuthority: 0,
    pageAuthority: 0,
    rankingKeywords: 0,
    topRankingKeywords: [],
    totalBacklinks: 0,
    referringDomains: 0,
  };
}

// ============= SITEMAP GENERATION =============

// Generate dynamic sitemap.xml
router.get('/sitemap.xml', async (req: any, res) => {
  try {
    const baseUrl = 'https://printyx.com';

    // Define all marketing pages with SEO priorities and change frequencies
    const staticPages = [
      // Core pages
      { url: '', priority: 1.0, changefreq: 'daily', lastmod: new Date() },
      { url: 'copier-dealer-crm', priority: 0.9, changefreq: 'weekly' },
      { url: 'print-service-dispatch-mobile', priority: 0.9, changefreq: 'weekly' },
      { url: 'canon-master-product-catalog', priority: 0.8, changefreq: 'monthly' },

      // Strategic landing pages
      { url: 'predictive-intelligence', priority: 0.9, changefreq: 'weekly' },
      { url: 'modern-architecture', priority: 0.9, changefreq: 'weekly' },
      { url: 'integration-marketplace', priority: 0.8, changefreq: 'weekly' },
      { url: 'dealer-expertise', priority: 0.8, changefreq: 'monthly' },

      // Conversion pages
      { url: 'roi-calculator', priority: 0.8, changefreq: 'monthly' },
      { url: 'case-studies', priority: 0.7, changefreq: 'monthly' },
      { url: 'competitive-battle-card', priority: 0.7, changefreq: 'monthly' },

      // Blog index
      { url: 'blog', priority: 0.8, changefreq: 'daily' },

      // Feature pages
      { url: 'autopilot-dashboard', priority: 0.7, changefreq: 'monthly' },
      { url: 'connect-dashboard', priority: 0.7, changefreq: 'monthly' },
      { url: 'compare-e-automate', priority: 0.8, changefreq: 'monthly' },
      { url: 'integration-marketplace-dashboard', priority: 0.7, changefreq: 'monthly' },
      { url: 'scheduled-reports-dashboard', priority: 0.7, changefreq: 'monthly' },
      { url: 'meeting-to-proposal-dashboard', priority: 0.7, changefreq: 'monthly' },
      { url: 'auto-lead-routing-dashboard', priority: 0.7, changefreq: 'monthly' },
      { url: 'predictive-service-dispatch-dashboard', priority: 0.8, changefreq: 'monthly' },
      { url: 'white-label-dashboard', priority: 0.7, changefreq: 'monthly' },
      { url: 'auto-supply-replenishment-dashboard', priority: 0.7, changefreq: 'monthly' },

      // Auth pages (lower priority)
      { url: 'login', priority: 0.3, changefreq: 'yearly' },
      { url: 'signup', priority: 0.5, changefreq: 'yearly' },
    ];

    // Fetch blog posts from database if content_marketing table exists
    let blogPosts: Array<{ slug: string; updatedAt: Date }> = [];
    try {
      // Query would go here - for now using empty array
      // const posts = await db.select().from(contentMarketingPosts).where(eq(status, 'published'));
      // blogPosts = posts.map(p => ({ slug: p.slug, updatedAt: p.updatedAt }));
    } catch (error) {
      log.info('Blog posts table not available for sitemap');
    }

    // Build XML sitemap
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Add static pages
    for (const page of staticPages) {
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}/${page.url}</loc>\n`;
      if (page.lastmod) {
        xml += `    <lastmod>${page.lastmod.toISOString().split('T')[0]}</lastmod>\n`;
      }
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += '  </url>\n';
    }

    // Add blog posts
    for (const post of blogPosts) {
      xml += '  <url>\n';
      xml += `    <loc>${baseUrl}/blog/${post.slug}</loc>\n`;
      xml += `    <lastmod>${post.updatedAt.toISOString().split('T')[0]}</lastmod>\n`;
      xml += `    <changefreq>monthly</changefreq>\n`;
      xml += `    <priority>0.7</priority>\n`;
      xml += '  </url>\n';
    }

    xml += '</urlset>';

    // Set proper headers
    res.header('Content-Type', 'application/xml');
    res.header('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.send(xml);
  } catch (error: any) {
    log.error('Error generating sitemap:', error);
    res.status(500).json({ message: 'Error generating sitemap' });
  }
});

// Generate image sitemap.xml
router.get('/image-sitemap.xml', async (req: any, res) => {
  try {
    const baseUrl = process.env.BASE_URL || 'https://printyx.com';

    // Import schemas for images
    const { blogPosts, guides, caseStudies, landingPages, knowledgeArticles } =
      await import('@shared/schema');

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
    xml += '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';

    // Helper function to add image entry
    const addImageUrl = (
      pageUrl: string,
      imageUrl: string,
      title?: string,
      caption?: string,
      geoLocation?: string,
      license?: string,
    ) => {
      if (!imageUrl) return;

      // Ensure absolute URL
      const absoluteImageUrl = imageUrl.startsWith('http') ? imageUrl : `${baseUrl}${imageUrl}`;

      xml += `  <url>\n`;
      xml += `    <loc>${pageUrl}</loc>\n`;
      xml += `    <image:image>\n`;
      xml += `      <image:loc>${absoluteImageUrl}</image:loc>\n`;
      if (title) {
        xml += `      <image:title><![CDATA[${title}]]></image:title>\n`;
      }
      if (caption) {
        xml += `      <image:caption><![CDATA[${caption}]]></image:caption>\n`;
      }
      if (geoLocation) {
        xml += `      <image:geo_location>${geoLocation}</image:geo_location>\n`;
      }
      if (license) {
        xml += `      <image:license>${license}</image:license>\n`;
      }
      xml += `    </image:image>\n`;
      xml += `  </url>\n`;
    };

    // 1. Blog post featured images
    const posts = await db
      .select({
        slug: blogPosts.slug,
        featuredImage: blogPosts.featuredImage,
        featuredImageAlt: blogPosts.featuredImageAlt,
        title: blogPosts.title,
      })
      .from(blogPosts)
      .where(eq(blogPosts.status, 'published'))
      .limit(500);

    posts.forEach((post) => {
      if (post.featuredImage) {
        addImageUrl(
          `${baseUrl}/blog/${post.slug}`,
          post.featuredImage,
          post.featuredImageAlt || post.title,
          `Featured image for ${post.title}`,
        );
      }
    });

    // 2. Guide cover images
    const guideDocs = await db
      .select({
        slug: guides.slug,
        coverImage: guides.coverImage,
        coverImageAlt: guides.coverImageAlt,
        title: guides.title,
      })
      .from(guides)
      .where(eq(guides.status, 'published'))
      .limit(200);

    guideDocs.forEach((guide) => {
      if (guide.coverImage) {
        addImageUrl(
          `${baseUrl}/guides/${guide.slug}`,
          guide.coverImage,
          guide.coverImageAlt || guide.title,
          `Cover image for ${guide.title}`,
        );
      }
    });

    // 3. Case study featured images
    const studies = await db
      .select({
        slug: caseStudies.slug,
        featuredImage: caseStudies.featuredImage,
        featuredImageAlt: caseStudies.featuredImageAlt,
        title: caseStudies.title,
      })
      .from(caseStudies)
      .where(eq(caseStudies.status, 'published'))
      .limit(200);

    studies.forEach((study) => {
      if (study.featuredImage) {
        addImageUrl(
          `${baseUrl}/case-studies/${study.slug}`,
          study.featuredImage,
          study.featuredImageAlt || study.title,
          `Featured image for ${study.title}`,
        );
      }
    });

    // 4. Landing page hero images
    const pages = await db
      .select({
        slug: landingPages.slug,
        heroImage: landingPages.heroImage,
        title: landingPages.title,
      })
      .from(landingPages)
      .where(eq(landingPages.status, 'published'))
      .limit(100);

    pages.forEach((page) => {
      if (page.heroImage) {
        addImageUrl(
          `${baseUrl}/${page.slug}`,
          page.heroImage,
          page.title,
          `Hero image for ${page.title}`,
        );
      }
    });

    // 5. Knowledge base article images
    const articles = await db
      .select({
        slug: knowledgeArticles.slug,
        featuredImage: knowledgeArticles.featuredImage,
        title: knowledgeArticles.title,
      })
      .from(knowledgeArticles)
      .where(eq(knowledgeArticles.status, 'published'))
      .limit(300);

    articles.forEach((article) => {
      if (article.featuredImage) {
        addImageUrl(
          `${baseUrl}/kb/${article.slug}`,
          article.featuredImage,
          article.title,
          `Featured image for ${article.title}`,
        );
      }
    });

    xml += '</urlset>';

    // Set proper headers
    res.header('Content-Type', 'application/xml');
    res.header('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.send(xml);
  } catch (error: any) {
    log.error('Error generating image sitemap:', error);
    res.status(500).json({ message: 'Error generating image sitemap' });
  }
});

// Generate robots.txt
router.get('/robots.txt', async (req: any, res) => {
  try {
    const baseUrl = 'https://printyx.com';

    let robotsTxt = `# Printyx robots.txt
User-agent: *
Allow: /
Disallow: /api/
Disallow: /dashboard
Disallow: /admin
Disallow: /settings
Disallow: /login
Disallow: /signup
Disallow: /reset-password
Disallow: /verify-email

# Sitemaps
Sitemap: ${baseUrl}/sitemap.xml
Sitemap: ${baseUrl}/image-sitemap.xml

# Crawl-delay for politeness
User-agent: *
Crawl-delay: 1

# Block aggressive bots
User-agent: AhrefsBot
Crawl-delay: 10

User-agent: SemrushBot
Crawl-delay: 10
`;

    res.header('Content-Type', 'text/plain');
    res.header('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.send(robotsTxt);
  } catch (error: any) {
    log.error('Error generating robots.txt:', error);
    res.status(500).send('Error generating robots.txt');
  }
});

export default router;
