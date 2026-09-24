import express from 'express';
import { storableVitals } from '@shared/seo-checks';
import { desc, eq, and, asc, gte, lte, inArray } from 'drizzle-orm';
import crypto from 'crypto';
import { db } from './db';
import { createModuleLogger } from './lib/logger';
import {
  projectAlert,
  projectAudit,
  projectCompetitor,
  projectCrawlResult,
  projectKeyword,
  projectPageScore,
} from './lib/seo-projection';

const log = createModuleLogger('routes-seo');

import {
  seoAuditHistory,
  seoFixesApplied,
  seoKeywords,
  seoKeywordHistory,
  seoCompetitorAnalysis,
  seoPageScores,
  seoMonitoringLog,
  seoAlerts,
  seoCoreWebVitals,
  seoCrawlResults,
  seoImageAnalysis,
  seoRedirectAnalysis,
  seoSecurityAnalysis,
  seoLinkAnalysis,
  seoStructuredData,
  seoMobileAnalysis,
  seoContentOptimization,
} from '@shared/schema';
import { seoService } from './services/seo-service';

const router = express.Router();

// Round 169: GET and POST /api/seo/settings used to be defined here as well.
// routes-seo-core.ts registers the same two paths at routes-registry:320 and
// this router mounts at :774, so these never ran - and a duplicate that never
// runs is one registration reorder from silently replacing the live one.

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

    const auditResults = await performSEOAudit(url);

    // Explicit columns, not `...auditResults`: scoreCovers and unbacked belong
    // on the RESPONSE and have no column, and drizzle drops a key the table
    // does not have without saying so.
    const [updatedAudit] = await db
      .update(seoAuditHistory)
      .set({
        status: 'completed',
        overallScore: auditResults.overallScore,
        technicalScore: auditResults.technicalScore,
        contentScore: auditResults.contentScore,
        performanceScore: auditResults.performanceScore,
        criticalIssues: auditResults.criticalIssues,
        highIssues: auditResults.highIssues,
        mediumIssues: auditResults.mediumIssues,
        lowIssues: auditResults.lowIssues,
        issues: auditResults.issues,
        recommendations: auditResults.recommendations,
        technicalDetails: auditResults.technicalDetails,
        completedAt: new Date(),
        duration: audit.startedAt ? Date.now() - audit.startedAt.getTime() : 0,
      })
      .where(eq(seoAuditHistory.id, audit.id))
      .returning();

    res.json({ ...updatedAudit, ...auditResults });
  } catch (error: any) {
    log.error('Error running SEO audit:', error);
    res.status(500).json({ message: 'An internal error occurred' });
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

    res.json(audits.map(projectAudit));
  } catch (error: any) {
    log.error('Error fetching audit history:', error);
    res.status(500).json({ message: 'An internal error occurred' });
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
    res.status(500).json({ message: 'An internal error occurred' });
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
    res.status(500).json({ message: 'An internal error occurred' });
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

    res.json(keywords.map(projectKeyword));
  } catch (error: any) {
    log.error('Error fetching keywords:', error);
    res.status(500).json({ message: 'An internal error occurred' });
  }
});

/**
 * What a caller may declare about a keyword they track.
 *
 * currentPosition, bestPosition, impressions, clicks, ctr and lastChecked are
 * deliberately absent: those are what the position checker measures, and a
 * write path that accepts them lets a user set their own rankings.
 */
const KEYWORD_WRITABLE_FIELDS = [
  'keyword',
  'targetUrl',
  'targetPosition',
  'searchVolume',
  'difficulty',
  'cpc',
  'competitorUrls',
  'isActive',
  'priority',
  'checkFrequency',
] as const;

type KeywordPlan = Partial<
  Pick<typeof seoKeywords.$inferInsert, (typeof KEYWORD_WRITABLE_FIELDS)[number]>
>;

function pickKeywordFields(body: unknown): KeywordPlan {
  const source = (body ?? {}) as Record<string, unknown>;
  const plan: Record<string, unknown> = {};
  for (const field of KEYWORD_WRITABLE_FIELDS) {
    if (source[field] !== undefined) plan[field] = source[field];
  }
  return plan as KeywordPlan;
}

// Add keyword
router.post('/api/seo/keywords', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    // PROD-008: this spread `...req.body` into drizzle, so a caller could set
    // currentPosition, bestPosition, impressions, clicks and ctr - the columns
    // the position checker MEASURES - and the rank-tracking panel would then
    // report numbers the user typed in. Only what somebody is meant to declare
    // about a keyword is accepted; the measured ones come from
    // POST /keywords/check-positions.
    const plan = pickKeywordFields(req.body);
    if (Object.keys(plan).length === 0 || !plan.keyword) {
      return res.status(400).json({
        message: 'A keyword is required',
        code: 'MISSING_KEYWORD',
      });
    }

    const [keyword] = await db
      .insert(seoKeywords)
      .values({ ...plan, keyword: plan.keyword, tenantId })
      .returning();

    res.json(keyword);
  } catch (error: any) {
    log.error('Error adding keyword:', error);
    res.status(500).json({ message: 'An internal error occurred' });
  }
});

// Update keyword
router.put('/api/seo/keywords/:id', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const plan = pickKeywordFields(req.body);
    if (Object.keys(plan).length === 0) {
      // Never a 200 that bumps updatedAt and reports success (COP-M01).
      return res.status(400).json({
        message: 'No writable fields in request',
        code: 'NO_WRITABLE_FIELDS',
      });
    }

    const [keyword] = await db
      .update(seoKeywords)
      .set({ ...plan, updatedAt: new Date() })
      .where(and(eq(seoKeywords.id, req.params.id), eq(seoKeywords.tenantId, tenantId)))
      .returning();

    res.json(keyword);
  } catch (error: any) {
    log.error('Error updating keyword:', error);
    res.status(500).json({ message: 'An internal error occurred' });
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
    res.status(500).json({ message: 'An internal error occurred' });
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
    res.status(500).json({ message: 'An internal error occurred' });
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
    res.status(500).json({ message: 'An internal error occurred' });
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
    res.status(500).json({ message: 'An internal error occurred' });
  }
});

// Get crawl results
/**
 * GET /api/seo/crawl/results — the latest crawl's pages.
 *
 * PROD-014: SEODashboard has always called this, and only the /:crawlId route
 * below existed, so the request arrived with crawlId = 'results' and filtered
 * crawl_id = 'results'. No crawl is ever given that id, so the panel returned
 * [] forever — in dev as well as production. It has to stay ABOVE /:crawlId,
 * or Express matches that first and the bug returns unchanged.
 */
router.get('/api/seo/crawl/results', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const [latest] = await db
      .select({ crawlId: seoCrawlResults.crawlId })
      .from(seoCrawlResults)
      .where(eq(seoCrawlResults.tenantId, tenantId))
      .orderBy(desc(seoCrawlResults.crawledAt))
      .limit(1);

    if (!latest?.crawlId) return res.json([]);

    const results = await db
      .select()
      .from(seoCrawlResults)
      .where(
        and(eq(seoCrawlResults.tenantId, tenantId), eq(seoCrawlResults.crawlId, latest.crawlId)),
      )
      .orderBy(asc(seoCrawlResults.crawlDepth));

    res.json(results.map(projectCrawlResult));
  } catch (error: any) {
    log.error('Error fetching latest crawl results:', error);
    res.status(500).json({ message: 'An internal error occurred' });
  }
});

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

    res.json(results.map(projectCrawlResult));
  } catch (error: any) {
    log.error('Error fetching crawl results:', error);
    res.status(500).json({ message: 'An internal error occurred' });
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
      // Named columns, not a spread: the integer columns need rounding (see
      // storableVitals) and drizzle's decimal columns take strings (round 247).
      .values({
        tenantId,
        url,
        device,
        ...(() => {
          const row = storableVitals(vitals);
          return {
            ...row,
            cls: row.cls === null ? null : String(row.cls),
            si: row.si === null ? null : String(row.si),
          };
        })(),
        diagnostics: vitals.diagnostics,
        measuredAt: new Date(),
      })
      .returning();

    res.json(stored);
  } catch (error: any) {
    log.error('Error checking Core Web Vitals:', error);
    res.status(500).json({ message: 'An internal error occurred' });
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
    res.status(500).json({ message: 'An internal error occurred' });
  }
});

// ============= PAGE ANALYSIS =============

// Analyze page
router.post('/api/seo/analyze/page', async (req: any, res) => {
  // SEO-008: not implemented. See the note above checkKeywordPosition.
  return res.status(501).json({
    message:
      'Page analysis is not implemented. It needs a real analyser; see SEO-008 in server/routes-seo.ts.',
    code: 'NOT_IMPLEMENTED',
  });
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

    res.json(scores.map(projectPageScore));
  } catch (error: any) {
    log.error('Error fetching page scores:', error);
    res.status(500).json({ message: 'An internal error occurred' });
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

    const { images, unbacked } = await analyzeImages(pageUrl);

    // Explicit columns, not `...image`: drizzle drops a key the table does not
    // have, so a spread stores whatever happens to line up and discards the
    // rest in silence. fileSizeBytes and potentialSavingsBytes are left null
    // because nothing here fetches an image.
    const storedImages = images.length
      ? await db
          .insert(seoImageAnalysis)
          .values(
            images.map((image) => ({
              tenantId,
              pageUrl,
              imageUrl: image.imageUrl,
              altText: image.altText,
              title: image.title,
              width: image.width,
              height: image.height,
              format: image.format,
              isOptimized: image.isOptimized,
              hasAltText: image.hasAltText,
              isLazy: image.isLazy,
              hasResponsive: image.hasResponsive,
              issues: image.issues,
              recommendedFormat: image.recommendedFormat,
              analyzedAt: new Date(),
            })),
          )
          .returning()
      : [];

    res.json({ pageUrl, images: storedImages, unbacked });
  } catch (error: any) {
    log.error('Error analyzing images:', error);
    res.status(500).json({ message: 'An internal error occurred' });
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
    res.status(500).json({ message: 'An internal error occurred' });
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

    const storedLinks = links.length
      ? await db
          .insert(seoLinkAnalysis)
          .values(
            links.map((link) => ({
              tenantId,
              sourceUrl,
              targetUrl: String(link.targetUrl),
              anchorText: String(link.anchorText ?? ''),
              linkType: String(link.linkType),
              isNoFollow: Boolean(link.isNoFollow),
              isNoOpener: Boolean(link.isNoOpener),
              isBroken: link.isBroken as boolean | null,
              statusCode: link.statusCode as number | null,
              errorMessage: (link.errorMessage as string | undefined) ?? null,
              linkValue: link.linkValue as number,
              checkedAt: new Date(),
            })),
          )
          .returning()
      : [];

    res.json({
      sourceUrl,
      links: storedLinks,
      checkedLinkLimit: CHECKED_LINK_LIMIT,
      unbacked:
        links.length > CHECKED_LINK_LIMIT
          ? [
              `Only the first ${CHECKED_LINK_LIMIT} links were requested; the remaining ${links.length - CHECKED_LINK_LIMIT} are recorded as unchecked rather than as working.`,
            ]
          : [],
    });
  } catch (error: any) {
    log.error('Error checking broken links:', error);
    res.status(500).json({ message: 'An internal error occurred' });
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
    res.status(500).json({ message: 'An internal error occurred' });
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
    res.status(500).json({ message: 'An internal error occurred' });
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

    // hasTouchFriendlyElements, hasReadableText, contentFitsViewport,
    // mobileLoadTimeMs, mobileFcp and mobileLcp are NOT written: every one
    // needs a rendered page, and the originals filled them with `true` and `0`,
    // which reads as a pass and as an instant load.
    const [stored] = await db
      .insert(seoMobileAnalysis)
      .values({
        tenantId,
        url,
        isMobileFriendly: mobile.isMobileFriendly,
        mobileScore: mobile.mobileScore,
        hasViewportMeta: mobile.hasViewportMeta,
        viewportContent: mobile.viewportContent,
        issues: mobile.issues,
        analyzedAt: new Date(),
      })
      .returning();

    res.json({ url, ...mobile, id: stored?.id });
  } catch (error: any) {
    log.error('Error checking mobile friendliness:', error);
    res.status(500).json({ message: 'An internal error occurred' });
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

    const { schemas, unbacked } = await validateStructuredData(url);

    // richResultsEligible stays null: presence of @context and @type is not
    // eligibility, and the original set it from exactly that.
    const storedSchemas = schemas.length
      ? await db
          .insert(seoStructuredData)
          .values(
            schemas.map((schema) => ({
              tenantId,
              url,
              schemaType: schema.schemaType,
              schemaFormat: schema.schemaFormat,
              schemaData: schema.schemaData,
              isValid: schema.isValid,
              validationErrors: schema.validationErrors ?? null,
              validationWarnings: schema.validationWarnings ?? null,
              detectedAt: new Date(),
              validatedAt: new Date(),
            })),
          )
          .returning()
      : [];

    res.json({ url, schemas: storedSchemas, unbacked });
  } catch (error: any) {
    log.error('Error validating structured data:', error);
    res.status(500).json({ message: 'An internal error occurred' });
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

    // SEC-002: `destination_url` is NOT NULL, so this table cannot represent a
    // chain that did not reach an end - truncated, or stopped at a private
    // address. Storing the last hop as the destination is the claim
    // summariseRedirectChain refuses to make; the row is withheld instead and
    // the caller still gets the result. The spread also carried `blockedAt`,
    // which has no column: drizzle drops an unknown key silently, so an
    // explicit value list is what keeps that visible.
    if (redirects.destinationUrl === null) {
      return res.json({
        ...redirects,
        stored: false,
        unstoredReason: redirects.blockedAt
          ? 'The chain was stopped at a private or reserved address, so it has no destination to record'
          : 'The chain hit the hop limit, so it has no destination to record',
      });
    }

    const [stored] = await db
      .insert(seoRedirectAnalysis)
      .values({
        tenantId,
        sourceUrl,
        destinationUrl: redirects.destinationUrl,
        redirectChain: redirects.redirectChain,
        chainLength: redirects.chainLength,
        statusCode: redirects.statusCode,
        redirectType: redirects.redirectType,
        hasRedirectLoop: redirects.hasRedirectLoop,
        hasMultipleRedirects: redirects.hasMultipleRedirects,
        issues: redirects.issues,
        checkedAt: new Date(),
      })
      .returning();

    res.json(stored);
  } catch (error: any) {
    log.error('Error detecting redirect chains:', error);
    res.status(500).json({ message: 'An internal error occurred' });
  }
});

// ============= DUPLICATE CONTENT =============

// Detect duplicate content
router.post('/api/seo/detect/duplicate-content', async (req: any, res) => {
  // SEO-008: not implemented. See the note above checkKeywordPosition.
  return res.status(501).json({
    message:
      'Duplicate detection is not implemented. It needs a content similarity implementation; see SEO-008 in server/routes-seo.ts.',
    code: 'NOT_IMPLEMENTED',
  });
});

// ============= CONTENT OPTIMIZATION =============

// Optimize content
router.post('/api/seo/optimize/content', async (req: any, res) => {
  // SEO-008: not implemented. See the note above checkKeywordPosition.
  return res.status(501).json({
    message:
      'Content optimisation is not implemented. It needs an LLM provider; see SEO-008 in server/routes-seo.ts.',
    code: 'NOT_IMPLEMENTED',
  });
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
    res.status(500).json({ message: 'An internal error occurred' });
  }
});

// ============= SEMANTIC ANALYSIS =============

// Analyze semantic keywords
router.post('/api/seo/analyze/semantic', async (req: any, res) => {
  // SEO-008: not implemented. See the note above checkKeywordPosition.
  return res.status(501).json({
    message:
      'Semantic keyword analysis is not implemented. It needs an NLP or LLM provider; see SEO-008 in server/routes-seo.ts.',
    code: 'NOT_IMPLEMENTED',
  });
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

    res.json(alerts.map(projectAlert));
  } catch (error: any) {
    log.error('Error fetching alerts:', error);
    res.status(500).json({ message: 'An internal error occurred' });
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
    res.status(500).json({ message: 'An internal error occurred' });
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
    res.status(500).json({ message: 'An internal error occurred' });
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
    res.status(500).json({ message: 'An internal error occurred' });
  }
});

// ============= COMPETITOR ANALYSIS =============

// Analyze competitor
router.post('/api/seo/analyze/competitor', async (req: any, res) => {
  // SEO-008: not implemented. See the note above checkKeywordPosition.
  return res.status(501).json({
    message:
      'Competitor analysis is not implemented. It needs a backlink provider such as Ahrefs, Moz or Semrush; see SEO-008 in server/routes-seo.ts.',
    code: 'NOT_IMPLEMENTED',
  });
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

    res.json(competitors.map(projectCompetitor));
  } catch (error: any) {
    log.error('Error fetching competitors:', error);
    res.status(500).json({ message: 'An internal error occurred' });
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
const CHECKED_LINK_LIMIT = seoService.CHECKED_LINK_LIMIT;
const checkSecurityHeaders = seoService.checkSecurityHeaders;
const checkMobileFriendliness = seoService.analyzeMobileFriendliness;
const validateStructuredData = seoService.validateStructuredData;
const detectRedirectChains = seoService.detectRedirectChains;

// Simplified implementations for functions not yet in service layer
/*
 * SEO-008: five "analysis" functions lived here and every one was a TODO stub
 * that returned invented numbers, which the handlers then STORED as
 * measurements and served as results:
 *
 *   analyzePage             title: 'Page Title', readingLevel: 8.5,
 *                           uniqueContentPercentage: 90
 *   optimizeContent         readabilityScore: 75, seoScore: 80, plus one canned
 *                           suggestion built by interpolating the keyword
 *   analyzeSemanticKeywords intentConfidence: 80 and searchIntent
 *                           'informational', for every keyword ever submitted
 *   detectDuplicateContent  similarityScore: 0 - which reads as "these pages
 *                           are not duplicates", asserted without comparing them
 *   analyzeCompetitor       domainAuthority, estimatedTraffic and backlinks all
 *                           0, presented as a competitor's figures
 *
 * A stub that throws gets fixed. A stub that returns 75 gets believed, and this
 * one wrote its numbers to seo_content_optimization and seo_semantic_analysis,
 * where they outlive the request and look like history.
 *
 * The five endpoints answer 501 now, naming the integration each needs. The
 * real analysers - core web vitals via PageSpeed Insights, images, links,
 * redirects, structured data, mobile, security - are in
 * server/services/seo-service.ts and are untouched: they fetch the page and
 * measure it.
 */

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

// Round 169: /sitemap.xml, /robots.txt and /image-sitemap.xml used to be
// generated per request here, all three on the hardcoded or defaulted domain
// https://printyx.com. SEO-006 made the committed files in client/public the
// ONE source for sitemap.xml and robots.txt (served from disk by
// routes-seo-core.ts, which mounts first and so shadowed the first two). The
// image sitemap was live wherever Express served the app, on the wrong domain,
// with nothing linking to it - robots.txt names only sitemap.xml. A per-request
// SEO artifact is the exact defect SEO-006 retired; do not add one back.

export default router;
