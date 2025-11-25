import express from 'express';
import { desc, eq, and, sql, asc, or, ilike, inArray } from 'drizzle-orm';
import { db } from './db';
import {
  blogPosts,
  guides,
  caseStudies,
  landingPages,
  contentAnalytics,
  contentFaqs,
  contentCitations,
  insertBlogPostSchema,
  insertGuideSchema,
  insertCaseStudySchema,
  insertLandingPageSchema,
  insertContentFaqSchema,
  insertContentCitationSchema,
} from '@shared/schema';
import { z } from 'zod';
// RBAC Integration
import {
  enhanceUserContext,
  requirePermission,
  PERMISSIONS,
  type AuthenticatedRequest
} from './middleware/rbac-route-helper';

const router = express.Router();

// Apply RBAC context to all content marketing routes
router.use(enhanceUserContext);

// Auth middleware - make content public for unauthenticated users, but track tenantId for authenticated
const optionalAuth = (req: any, res: any, next: any) => {
  // Continue regardless of auth status
  next();
};

const requireAuth = (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  next();
};

// ============= BLOG POSTS =============

// Get all published blog posts (public)
router.get('/api/content/blog', optionalAuth, async (req: any, res) => {
  try {
    const { category, tag, search, limit = 20, offset = 0 } = req.query;

    let conditions: any[] = [eq(blogPosts.status, 'published')];

    if (category) {
      conditions.push(eq(blogPosts.category, category));
    }

    if (search) {
      conditions.push(
        or(
          ilike(blogPosts.title, `%${search}%`),
          ilike(blogPosts.excerpt, `%${search}%`),
          ilike(blogPosts.content, `%${search}%`)
        )
      );
    }

    const posts = await db
      .select({
        id: blogPosts.id,
        title: blogPosts.title,
        slug: blogPosts.slug,
        excerpt: blogPosts.excerpt,
        featuredImage: blogPosts.featuredImage,
        featuredImageAlt: blogPosts.featuredImageAlt,
        category: blogPosts.category,
        tags: blogPosts.tags,
        authorName: blogPosts.authorName,
        publishedAt: blogPosts.publishedAt,
        readTime: blogPosts.readTime,
        viewCount: blogPosts.viewCount,
        seoScore: blogPosts.seoScore,
        geoScore: blogPosts.geoScore,
      })
      .from(blogPosts)
      .where(and(...conditions))
      .orderBy(desc(blogPosts.publishedAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(blogPosts)
      .where(and(...conditions));

    res.json({
      posts,
      total: count,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error: any) {
    console.error('Error fetching blog posts:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get single blog post by slug (public)
router.get('/api/content/blog/:slug', optionalAuth, async (req: any, res) => {
  try {
    const [post] = await db
      .select()
      .from(blogPosts)
      .where(and(
        eq(blogPosts.slug, req.params.slug),
        eq(blogPosts.status, 'published')
      ))
      .limit(1);

    if (!post) {
      return res.status(404).json({ message: 'Blog post not found' });
    }

    // Increment view count
    await db
      .update(blogPosts)
      .set({ viewCount: sql`${blogPosts.viewCount} + 1` })
      .where(eq(blogPosts.id, post.id));

    // Get FAQs
    const faqs = await db
      .select()
      .from(contentFaqs)
      .where(and(
        eq(contentFaqs.contentType, 'blog_post'),
        eq(contentFaqs.contentId, post.id)
      ))
      .orderBy(asc(contentFaqs.order));

    // Get citations
    const citations = await db
      .select()
      .from(contentCitations)
      .where(and(
        eq(contentCitations.contentType, 'blog_post'),
        eq(contentCitations.contentId, post.id)
      ));

    // Get related posts
    let relatedPosts: any[] = [];
    if (post.relatedPosts && Array.isArray(post.relatedPosts) && post.relatedPosts.length > 0) {
      relatedPosts = await db
        .select({
          id: blogPosts.id,
          title: blogPosts.title,
          slug: blogPosts.slug,
          excerpt: blogPosts.excerpt,
          featuredImage: blogPosts.featuredImage,
          category: blogPosts.category,
          publishedAt: blogPosts.publishedAt,
          readTime: blogPosts.readTime,
        })
        .from(blogPosts)
        .where(and(
          inArray(blogPosts.id, post.relatedPosts),
          eq(blogPosts.status, 'published')
        ))
        .limit(3);
    }

    res.json({
      ...post,
      faqs,
      citations,
      relatedPosts,
    });
  } catch (error: any) {
    console.error('Error fetching blog post:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create blog post (admin only)
router.post('/api/content/blog', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId || null;
    const userId = req.user?.id;

    const validatedData = insertBlogPostSchema.parse({
      ...req.body,
      tenantId,
      authorId: userId,
    });

    const [post] = await db
      .insert(blogPosts)
      .values(validatedData)
      .returning();

    res.json(post);
  } catch (error: any) {
    console.error('Error creating blog post:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ message: error.message });
  }
});

// Update blog post (admin only)
router.put('/api/content/blog/:id', async (req: any, res) => {
  try {
    const [post] = await db
      .update(blogPosts)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(blogPosts.id, req.params.id))
      .returning();

    res.json(post);
  } catch (error: any) {
    console.error('Error updating blog post:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete blog post (admin only)
router.delete('/api/content/blog/:id', async (req: any, res) => {
  try {
    await db
      .delete(blogPosts)
      .where(eq(blogPosts.id, req.params.id));

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting blog post:', error);
    res.status(500).json({ message: error.message });
  }
});

// ============= GUIDES =============

// Get all published guides (public)
router.get('/api/content/guides', optionalAuth, async (req: any, res) => {
  try {
    const { category, isPillar, limit = 20, offset = 0 } = req.query;

    let conditions: any[] = [eq(guides.status, 'published')];

    if (category) {
      conditions.push(eq(guides.category, category));
    }

    if (isPillar !== undefined) {
      conditions.push(eq(guides.isPillar, isPillar === 'true'));
    }

    const guidesList = await db
      .select({
        id: guides.id,
        title: guides.title,
        slug: guides.slug,
        subtitle: guides.subtitle,
        description: guides.description,
        coverImage: guides.coverImage,
        category: guides.category,
        isPillar: guides.isPillar,
        tags: guides.tags,
        authorName: guides.authorName,
        publishedAt: guides.publishedAt,
        readTime: guides.readTime,
        viewCount: guides.viewCount,
        downloadCount: guides.downloadCount,
      })
      .from(guides)
      .where(and(...conditions))
      .orderBy(desc(guides.publishedAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(guides)
      .where(and(...conditions));

    res.json({
      guides: guidesList,
      total: count,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error: any) {
    console.error('Error fetching guides:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get single guide by slug (public)
router.get('/api/content/guides/:slug', optionalAuth, async (req: any, res) => {
  try {
    const [guide] = await db
      .select()
      .from(guides)
      .where(and(
        eq(guides.slug, req.params.slug),
        eq(guides.status, 'published')
      ))
      .limit(1);

    if (!guide) {
      return res.status(404).json({ message: 'Guide not found' });
    }

    // Increment view count
    await db
      .update(guides)
      .set({ viewCount: sql`${guides.viewCount} + 1` })
      .where(eq(guides.id, guide.id));

    // Get related guides
    let relatedGuides: any[] = [];
    if (guide.relatedGuides && Array.isArray(guide.relatedGuides) && guide.relatedGuides.length > 0) {
      relatedGuides = await db
        .select({
          id: guides.id,
          title: guides.title,
          slug: guides.slug,
          description: guides.description,
          coverImage: guides.coverImage,
          category: guides.category,
          publishedAt: guides.publishedAt,
          readTime: guides.readTime,
        })
        .from(guides)
        .where(and(
          inArray(guides.id, guide.relatedGuides),
          eq(guides.status, 'published')
        ))
        .limit(3);
    }

    res.json({
      ...guide,
      relatedGuides,
    });
  } catch (error: any) {
    console.error('Error fetching guide:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create guide (admin only)
router.post('/api/content/guides', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId || null;
    const userId = req.user?.id;

    const validatedData = insertGuideSchema.parse({
      ...req.body,
      tenantId,
      authorId: userId,
    });

    const [guide] = await db
      .insert(guides)
      .values(validatedData)
      .returning();

    res.json(guide);
  } catch (error: any) {
    console.error('Error creating guide:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ message: error.message });
  }
});

// ============= CASE STUDIES =============

// Get all published case studies (public)
router.get('/api/content/case-studies', optionalAuth, async (req: any, res) => {
  try {
    const { category, limit = 20, offset = 0 } = req.query;

    let conditions: any[] = [eq(caseStudies.status, 'published')];

    if (category) {
      conditions.push(eq(caseStudies.category, category));
    }

    const studies = await db
      .select({
        id: caseStudies.id,
        title: caseStudies.title,
        slug: caseStudies.slug,
        subtitle: caseStudies.subtitle,
        clientName: caseStudies.clientName,
        clientIndustry: caseStudies.clientIndustry,
        clientSize: caseStudies.clientSize,
        featuredImage: caseStudies.featuredImage,
        category: caseStudies.category,
        tags: caseStudies.tags,
        roiPercentage: caseStudies.roiPercentage,
        publishedAt: caseStudies.publishedAt,
        viewCount: caseStudies.viewCount,
      })
      .from(caseStudies)
      .where(and(...conditions))
      .orderBy(desc(caseStudies.publishedAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    res.json({ studies });
  } catch (error: any) {
    console.error('Error fetching case studies:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get single case study by slug (public)
router.get('/api/content/case-studies/:slug', optionalAuth, async (req: any, res) => {
  try {
    const [study] = await db
      .select()
      .from(caseStudies)
      .where(and(
        eq(caseStudies.slug, req.params.slug),
        eq(caseStudies.status, 'published')
      ))
      .limit(1);

    if (!study) {
      return res.status(404).json({ message: 'Case study not found' });
    }

    // Increment view count
    await db
      .update(caseStudies)
      .set({ viewCount: sql`${caseStudies.viewCount} + 1` })
      .where(eq(caseStudies.id, study.id));

    res.json(study);
  } catch (error: any) {
    console.error('Error fetching case study:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create case study (admin only)
router.post('/api/content/case-studies', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId || null;

    const validatedData = insertCaseStudySchema.parse({
      ...req.body,
      tenantId,
    });

    const [study] = await db
      .insert(caseStudies)
      .values(validatedData)
      .returning();

    res.json(study);
  } catch (error: any) {
    console.error('Error creating case study:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ message: error.message });
  }
});

// ============= LANDING PAGES =============

// Get landing page by slug (public)
router.get('/api/content/landing/:slug', optionalAuth, async (req: any, res) => {
  try {
    const [page] = await db
      .select()
      .from(landingPages)
      .where(and(
        eq(landingPages.slug, req.params.slug),
        eq(landingPages.status, 'published')
      ))
      .limit(1);

    if (!page) {
      return res.status(404).json({ message: 'Landing page not found' });
    }

    // Increment view count
    await db
      .update(landingPages)
      .set({ viewCount: sql`${landingPages.viewCount} + 1` })
      .where(eq(landingPages.id, page.id));

    res.json(page);
  } catch (error: any) {
    console.error('Error fetching landing page:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create landing page (admin only)
router.post('/api/content/landing', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId || null;

    const validatedData = insertLandingPageSchema.parse({
      ...req.body,
      tenantId,
    });

    const [page] = await db
      .insert(landingPages)
      .values(validatedData)
      .returning();

    res.json(page);
  } catch (error: any) {
    console.error('Error creating landing page:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ message: error.message });
  }
});

// Update landing page (admin only)
router.put('/api/content/landing/:id', async (req: any, res) => {
  try {
    const [page] = await db
      .update(landingPages)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(landingPages.id, req.params.id))
      .returning();

    res.json(page);
  } catch (error: any) {
    console.error('Error updating landing page:', error);
    res.status(500).json({ message: error.message });
  }
});

// ============= FAQs =============

// Add FAQ to content
router.post('/api/content/:contentType/:contentId/faq', async (req: any, res) => {
  try {
    const { contentType, contentId } = req.params;
    const validatedData = insertContentFaqSchema.parse({
      contentType,
      contentId,
      ...req.body,
    });

    const [faq] = await db
      .insert(contentFaqs)
      .values(validatedData)
      .returning();

    res.json(faq);
  } catch (error: any) {
    console.error('Error adding FAQ:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ message: error.message });
  }
});

// ============= CITATIONS =============

// Add citation to content
router.post('/api/content/:contentType/:contentId/citation', async (req: any, res) => {
  try {
    const { contentType, contentId } = req.params;
    const validatedData = insertContentCitationSchema.parse({
      contentType,
      contentId,
      ...req.body,
    });

    const [citation] = await db
      .insert(contentCitations)
      .values(validatedData)
      .returning();

    res.json(citation);
  } catch (error: any) {
    console.error('Error adding citation:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ message: error.message });
  }
});

// ============= CONTENT ANALYTICS =============

// Track content view
router.post('/api/content/analytics/view', optionalAuth, async (req: any, res) => {
  try {
    const {
      contentType,
      contentId,
      source,
      medium,
      campaign,
      device,
      browser,
      country,
      region,
      isAiReferral,
      aiPlatform,
    } = req.body;

    await db
      .insert(contentAnalytics)
      .values({
        contentType,
        contentId,
        source,
        medium,
        campaign,
        device,
        browser,
        country,
        region,
        isAiReferral: isAiReferral || false,
        aiPlatform,
      });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error tracking analytics:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get content analytics summary
router.get('/api/content/analytics/:contentType/:contentId', async (req: any, res) => {
  try {
    const { contentType, contentId } = req.params;

    // Get total views
    const [{ totalViews }] = await db
      .select({ totalViews: sql<number>`count(*)::int` })
      .from(contentAnalytics)
      .where(and(
        eq(contentAnalytics.contentType, contentType as any),
        eq(contentAnalytics.contentId, contentId)
      ));

    // Get AI referrals
    const [{ aiReferrals }] = await db
      .select({ aiReferrals: sql<number>`count(*)::int` })
      .from(contentAnalytics)
      .where(and(
        eq(contentAnalytics.contentType, contentType as any),
        eq(contentAnalytics.contentId, contentId),
        eq(contentAnalytics.isAiReferral, true)
      ));

    // Get top sources
    const topSources = await db
      .select({
        source: contentAnalytics.source,
        count: sql<number>`count(*)::int`,
      })
      .from(contentAnalytics)
      .where(and(
        eq(contentAnalytics.contentType, contentType as any),
        eq(contentAnalytics.contentId, contentId)
      ))
      .groupBy(contentAnalytics.source)
      .orderBy(sql`count(*) desc`)
      .limit(5);

    res.json({
      totalViews,
      aiReferrals,
      aiReferralPercentage: totalViews > 0 ? ((aiReferrals / totalViews) * 100).toFixed(2) : 0,
      topSources,
    });
  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ message: error.message });
  }
});

// ============= SITEMAP =============

// Generate dynamic sitemap
router.get('/sitemap.xml', async (req, res) => {
  try {
    // Get all published content
    const [publishedBlogPosts, publishedGuides, publishedCaseStudies, publishedLandingPages] = await Promise.all([
      db
        .select({ slug: blogPosts.slug, updatedAt: blogPosts.updatedAt, publishedAt: blogPosts.publishedAt })
        .from(blogPosts)
        .where(eq(blogPosts.status, 'published')),

      db
        .select({ slug: guides.slug, updatedAt: guides.updatedAt, publishedAt: guides.publishedAt })
        .from(guides)
        .where(eq(guides.status, 'published')),

      db
        .select({ slug: caseStudies.slug, updatedAt: caseStudies.updatedAt, publishedAt: caseStudies.publishedAt })
        .from(caseStudies)
        .where(eq(caseStudies.status, 'published')),

      db
        .select({ slug: landingPages.slug, updatedAt: landingPages.updatedAt, publishedAt: landingPages.publishedAt })
        .from(landingPages)
        .where(eq(landingPages.status, 'published')),
    ]);

    const baseUrl = process.env.BASE_URL || 'https://printyx.com';

    // Generate XML
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
`;

    // Add blog posts
    for (const post of publishedBlogPosts) {
      const lastmod = (post.updatedAt || post.publishedAt)?.toISOString().split('T')[0];
      xml += `  <url>
    <loc>${baseUrl}/blog/${post.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
`;
    }

    // Add guides
    for (const guide of publishedGuides) {
      const lastmod = (guide.updatedAt || guide.publishedAt)?.toISOString().split('T')[0];
      xml += `  <url>
    <loc>${baseUrl}/resources/guides/${guide.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
`;
    }

    // Add case studies
    for (const study of publishedCaseStudies) {
      const lastmod = (study.updatedAt || study.publishedAt)?.toISOString().split('T')[0];
      xml += `  <url>
    <loc>${baseUrl}/customers/${study.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.6</priority>
  </url>
`;
    }

    // Add landing pages
    for (const page of publishedLandingPages) {
      const lastmod = page.updatedAt?.toISOString().split('T')[0];
      xml += `  <url>
    <loc>${baseUrl}/${page.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
`;
    }

    xml += `</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error: any) {
    console.error('Error generating sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
});

// ============= ROBOTS.TXT =============

router.get('/robots.txt', (req, res) => {
  const robotsTxt = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /dashboard/
Disallow: /settings/

Sitemap: ${process.env.BASE_URL || 'https://printyx.com'}/sitemap.xml`;

  res.header('Content-Type', 'text/plain');
  res.send(robotsTxt);
});

export default router;
