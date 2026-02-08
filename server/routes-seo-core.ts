/**
 * SEO Management Routes
 * Extracted from routes.ts monolith.
 *
 * Includes:
 * - POST /api/seo/settings (upsert global SEO settings)
 * - POST /api/seo/pages (upsert SEO page record)
 * - GET  /sitemap.xml
 * - GET  /robots.txt
 * - GET  /meta.json
 * - GET  /llms.txt
 * - GET  /.well-known/llms.txt
 * - GET  /schema.json
 * - GET  /api/seo/settings
 * - GET  /api/seo/pages
 * - POST /api/seo/regenerate-sitemap
 * - POST /api/seo/regenerate-robots
 * - POST /api/seo/regenerate-llms
 * - SEO bootstrap logic (seed baseline settings and core pages on boot)
 */
import type { Express } from 'express';
import { createHash } from 'crypto';
import { db } from './db';
import { eq, desc } from 'drizzle-orm';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-seo-core');

import { seoSettings, insertSeoSettingsSchema } from '@shared/schema';
import { requireRootAdmin } from './routes-root-admin';

// NOTE: seoPages and insertSeoPageSchema were temporarily disabled from
// the main @shared/schema import in routes.ts. These references are kept
// as-is for consistency with the original monolith code. If the SEO pages
// table has been re-enabled, update the import above accordingly.
// For now we import them dynamically to match the original behavior.
let seoPages: any;
let insertSeoPageSchema: any;

try {
  // Attempt to load from schema - these may or may not be available
  const schema = require('@shared/schema');
  seoPages = schema.seoPages;
  insertSeoPageSchema = schema.insertSeoPageSchema;
} catch (e) {
  log.warn('SEO pages schema not available:', (e as any)?.message);
}

export function registerSeoCoreRoutes(app: Express) {
  // ===== SEO Management Routes =====
  // Root Admin: upsert global SEO settings
  app.post('/api/seo/settings', async (req: any, res) => {
    try {
      const isPlatformUser = req.user?.isPlatformUser || req.user?.role === 'platform_admin';
      if (!isPlatformUser) return res.status(403).json({ message: 'Platform admin required' });
      const payload = insertSeoSettingsSchema.parse(req.body);
      const [existing] = await db.select().from(seoSettings).limit(1);
      if (existing) {
        const [updated] = await db
          .update(seoSettings)
          .set({ ...payload, updatedAt: new Date() })
          .where(eq(seoSettings.id, (existing as any).id))
          .returning();
        return res.json(updated);
      }
      const [created] = await db
        .insert(seoSettings)
        .values(payload as any)
        .returning();
      res.json(created);
    } catch (error: any) {
      log.error('Error upserting SEO settings:', error);
      res.status(500).json({
        message: 'Failed to upsert SEO settings',
        detail: error?.message,
      });
    }
  });

  // Root Admin: upsert SEO page record
  app.post('/api/seo/pages', async (req: any, res) => {
    try {
      const isPlatformUser = req.user?.isPlatformUser || req.user?.role === 'platform_admin';
      if (!isPlatformUser) return res.status(403).json({ message: 'Platform admin required' });
      const payload = insertSeoPageSchema.parse(req.body);
      // Upsert by path (global)
      const [existing] = await db
        .select()
        .from(seoPages)
        .where(eq(seoPages.path, (payload as any).path))
        .limit(1);
      if (existing) {
        const [updated] = await db
          .update(seoPages)
          .set({ ...payload, updatedAt: new Date(), lastmod: new Date() })
          .where(eq(seoPages.id, (existing as any).id))
          .returning();
        return res.json(updated);
      }
      const [created] = await db
        .insert(seoPages)
        .values({ ...payload, lastmod: new Date() } as any)
        .returning();
      res.json(created);
    } catch (error: any) {
      log.error('Error upserting SEO page:', error);
      res.status(500).json({ message: 'Failed to upsert SEO page', detail: error?.message });
    }
  });

  // Public: generate sitemap.xml
  app.get('/sitemap.xml', async (_req, res) => {
    try {
      const settingsRows = await db.select().from(seoSettings).limit(1);
      const settings = settingsRows[0] as any;
      const pages = await db
        .select({
          path: seoPages.path,
          lastmod: seoPages.lastmod,
          changefreq: seoPages.changefreq,
          priority: seoPages.priority,
          includeInSitemap: seoPages.includeInSitemap,
        })
        .from(seoPages);
      const baseUrl = settings?.siteUrl?.replace(/\/$/, '') || 'https://printyx.net';
      const urls = pages.filter((p: any) => p.includeInSitemap !== false);
      const xml =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
        urls
          .map((p: any) => {
            const loc = `${baseUrl}${p.path.startsWith('/') ? p.path : `/${p.path}`}`;
            const lastmod = (p.lastmod ? new Date(p.lastmod) : new Date()).toISOString();
            const changefreq = p.changefreq || settings?.sitemapChangefreq || 'weekly';
            const priority = p.priority || settings?.sitemapPriorityDefault || 0.5;
            return `\n  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
          })
          .join('') +
        '\n</urlset>';
      const etag = createHash('sha1').update(xml).digest('hex');
      res.setHeader('ETag', etag);
      if (_req.headers['if-none-match'] === etag) {
        return res.status(304).end();
      }
      res
        .header('Content-Type', 'application/xml; charset=utf-8')
        .header('Cache-Control', 'public, max-age=300, s-maxage=600')
        .send(xml);
    } catch (error) {
      log.error('Error generating sitemap:', error);
      res.status(500).send('Error generating sitemap');
    }
  });

  // Public: robots.txt
  app.get('/robots.txt', async (_req, res) => {
    try {
      const settingsRows = await db.select().from(seoSettings).limit(1);
      const settings = settingsRows[0] as any;
      const baseUrl = settings?.siteUrl?.replace(/\/$/, '') || 'https://printyx.net';
      const allowIndexing = true; // If needed later, wire to settings
      const lines = [
        `# Traditional Search Engine Crawlers`,
        `User-agent: *`,
        allowIndexing ? `Allow: /` : `Disallow: /`,
        `Disallow: /api/`,
        `Disallow: /admin/`,
        `Disallow: /root-admin/`,
        `Disallow: /database-management`,
        `Disallow: /role-management`,
        `Disallow: /gpt5-dashboard`,
        `Disallow: /settings`,
        `Disallow: /customers`,
        `Disallow: /crm`,
        `Disallow: /service-dispatch`,
        `Disallow: /service-hub`,
        `Disallow: /quotes`,
        `Disallow: /proposal-`,
        `Disallow: /deals`,
        `Disallow: /inventory`,
        `Disallow: /billing`,
        `Disallow: /invoices`,
        `Disallow: /reports`,
        `Disallow: /dashboard`,
        `Disallow: /onboarding`,
        `Disallow: /tenant-setup`,
        ``,
        `# AI Search Crawlers - ALLOW for citation and search`,
        `User-agent: GPTBot`,
        `Allow: /`,
        `Disallow: /api/`,
        `Disallow: /admin/`,
        `Disallow: /dashboard`,
        `Disallow: /settings`,
        ``,
        `User-agent: ChatGPT-User`,
        `Allow: /`,
        `Disallow: /api/`,
        `Disallow: /admin/`,
        ``,
        `User-agent: OAI-SearchBot`,
        `Allow: /`,
        `Disallow: /api/`,
        ``,
        `User-agent: ClaudeBot`,
        `Allow: /`,
        `Disallow: /api/`,
        `Disallow: /admin/`,
        ``,
        `User-agent: PerplexityBot`,
        `Allow: /`,
        `Disallow: /api/`,
        ``,
        `User-agent: Google-Extended`,
        `Allow: /`,
        `Disallow: /api/`,
        ``,
        `User-agent: Googlebot`,
        `Allow: /`,
        `Disallow: /api/`,
        `Disallow: /admin/`,
        ``,
        `# Block pure AI training bots (not search/citation)`,
        `User-agent: CCBot`,
        `Disallow: /`,
        ``,
        `User-agent: anthropic-ai`,
        `Disallow: /`,
        ``,
        `Sitemap: ${baseUrl}/sitemap.xml`,
        `LLMS: ${baseUrl}/llms.txt`,
      ];
      const body = lines.join('\n');
      const etag = createHash('sha1').update(body).digest('hex');
      res.setHeader('ETag', etag);
      if (_req.headers['if-none-match'] === etag) {
        return res.status(304).end();
      }
      res
        .header('Content-Type', 'text/plain; charset=utf-8')
        .header('Cache-Control', 'public, max-age=300, s-maxage=600')
        .send(body);
    } catch (_e) {
      res
        .header('Content-Type', 'text/plain')
        .send(
          'User-agent: *\nAllow: /\nSitemap: https://printyx.net/sitemap.xml\nLLMS: https://printyx.net/llms.txt\n',
        );
    }
  });

  // Public: meta.json — returns meta for a given path
  app.get('/meta.json', async (req, res) => {
    try {
      const path = String(req.query.path || '/');
      const [page] = await db.select().from(seoPages).where(eq(seoPages.path, path)).limit(1);
      const [settings] = await db.select().from(seoSettings).limit(1);
      const include = (page as any)?.includeInSitemap !== false;
      const payload = {
        title:
          (page as any)?.title ||
          (settings as any)?.defaultTitle ||
          (settings as any)?.siteName ||
          'Printyx',
        description: (page as any)?.description || (settings as any)?.defaultDescription || '',
        ogImage: (settings as any)?.defaultOgImage || null,
        twitterHandle: (settings as any)?.twitterHandle || null,
        robots: include ? 'index,follow' : 'noindex,nofollow',
      };
      res.json(payload);
    } catch (error: any) {
      res.json({
        title: 'Printyx',
        description: '',
        robots: 'noindex,nofollow',
      });
    }
  });

  // Public: AI/LLM crawler directives (llms.txt)
  // Handler function for llms.txt content
  const handleLlmsTxt = async (_req: any, res: any) => {
    try {
      const settingsRows = await db.select().from(seoSettings).limit(1);
      const settings = settingsRows[0] as any;
      const baseUrl = process.env.BASE_URL || 'https://printyx.net';

      // Enhanced llms.txt with comprehensive platform information for AI citation
      const llmsTxt = `# Printyx

> Printyx is a modern cloud-based CRM, service dispatch, billing, and analytics platform built specifically for copier dealers and managed print services (MPS) providers.

## About
Printyx replaces legacy dealer management systems like E-Automate with a modern cloud platform. Built by copier industry veterans with 30+ years of combined experience, Printyx provides AI-powered predictive intelligence, mobile-first field service tools, and unified workflows for sales, service, inventory, and finance. The platform serves copier/printer dealers, MPS providers, and office technology companies across the United States.

## Key Features
- **CRM & Sales Pipeline**: Lead scoring, deal management, quote generation, and proposal builder with AI-powered sales forecasting
- **Service Dispatch**: Mobile-first field service with GPS routing, real-time job updates, parts inventory, and customer e-signatures
- **Predictive Maintenance**: AI-driven equipment failure prediction and proactive service scheduling to reduce downtime by up to 40%
- **Meter Billing**: Automated meter reading collection and billing with support for cost-per-copy, tiered, and overage pricing models
- **Inventory Management**: Master product catalog, warehouse operations, purchase orders, and automated supply replenishment
- **Equipment Lifecycle**: Track devices from deployment through retirement with full service history and contract association
- **Financial Analytics**: Revenue intelligence dashboards, contract profitability analysis, and dynamic pricing optimization
- **Integration Marketplace**: Pre-built integrations with QuickBooks, Salesforce, Microsoft 365, and manufacturer APIs (Canon, Ricoh, HP)
- **Mobile-First Design**: Offline-capable mobile app for field technicians with real-time sync

## Why Copier Dealers Choose Printyx Over E-Automate
- Modern cloud architecture vs legacy on-premise infrastructure
- AI-powered predictive intelligence vs reactive workflows
- Mobile-first technician app vs desktop-only interface
- Real-time dashboards and analytics vs static reporting
- No server maintenance or IT overhead required
- 2-3 year technical advantage in cloud, AI, and mobile capabilities

## Pricing
- Starter: $49/user/month for small dealers (up to 10 users)
- Professional: $79/user/month for mid-size dealers with full feature access
- Enterprise: Custom pricing for large multi-location operations
- Free trial available with no credit card required

## Industry Focus
Printyx serves the copier/printer dealer and managed print services industry, including:
- Independent copier dealers
- Multi-brand office technology dealers
- Managed print services providers
- Copier/printer service organizations
- Office equipment leasing companies

## Comparison Pages
- [Printyx vs E-Automate](${baseUrl}/compare-eautomate): Side-by-side feature comparison
- [Competitive Battle Card](${baseUrl}/battle-card): Why modern dealers are switching
- [ROI Calculator](${baseUrl}/roi-calculator): Calculate savings from switching

## Resources
- [Product Overview](${baseUrl}/p/copier-dealer-crm)
- [Mobile Service Dispatch](${baseUrl}/p/print-service-dispatch-mobile)
- [Predictive Intelligence](${baseUrl}/predictive-intelligence)
- [Modern Architecture](${baseUrl}/modern-architecture)
- [Integration Marketplace](${baseUrl}/integration-marketplace)
- [Case Studies](${baseUrl}/case-studies)
- [Blog](${baseUrl}/blog)
- [Knowledge Base](${baseUrl}/knowledge-base)

## Contact
- Website: ${baseUrl}
- Email: support@printyx.net
- Sales: sales@printyx.com
`;

      const etag = createHash('sha1').update(llmsTxt).digest('hex');
      res.setHeader('ETag', etag);
      if (_req.headers['if-none-match'] === etag) {
        return res.status(304).end();
      }
      res
        .header('Content-Type', 'text/plain; charset=utf-8')
        .header('Cache-Control', 'public, max-age=3600, s-maxage=7200')
        .send(llmsTxt);
    } catch (error) {
      res.header('Content-Type', 'text/plain; charset=utf-8').send('Allow: /\n');
    }
  };

  // Serve llms.txt at both locations for maximum compatibility
  app.get('/llms.txt', handleLlmsTxt);
  app.get('/.well-known/llms.txt', handleLlmsTxt);

  // Public: dynamic schema.json endpoint per path
  app.get('/schema.json', async (req, res) => {
    try {
      const path = String(req.query.path || '/');
      const [page] = await db.select().from(seoPages).where(eq(seoPages.path, path)).limit(1);
      const settingsRows = await db.select().from(seoSettings).limit(1);
      const settings = settingsRows[0] as any;
      const baseWebsite = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: settings?.siteName || 'Printyx',
        url: settings?.siteUrl || 'https://printyx.net',
        potentialAction: {
          '@type': 'SearchAction',
          target: `${settings?.siteUrl || 'https://printyx.net'}/search?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      };
      let payload = baseWebsite as any;
      if (page?.schemaType && page?.schemaData) {
        payload = {
          '@context': 'https://schema.org',
          '@type': page.schemaType,
          ...(page.schemaData as any),
        };
      }
      res.json(payload);
    } catch (error) {
      res.json({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Printyx',
      });
    }
  });

  // Admin: get SEO settings
  app.get('/api/seo/settings', async (_req: any, res) => {
    try {
      const rows = await db.select().from(seoSettings).limit(1);
      res.json(rows[0] || null);
    } catch (error: any) {
      res.status(500).json({
        message: 'Failed to load SEO settings',
        detail: error?.message,
      });
    }
  });

  // Admin: list SEO pages
  app.get('/api/seo/pages', async (_req: any, res) => {
    try {
      const rows = await db.select().from(seoPages).orderBy(desc(seoPages.updatedAt));
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to load SEO pages', detail: error?.message });
    }
  });

  // Admin: regenerate sitemap endpoint
  app.post('/api/seo/regenerate-sitemap', requireRootAdmin, async (req: any, res) => {
    try {
      const isPlatformUser = req.user?.isPlatformUser || req.user?.role === 'platform_admin';
      if (!isPlatformUser) return res.status(403).json({ message: 'Platform admin required' });

      // This endpoint doesn't generate a new sitemap, just returns success
      // The actual sitemap is generated dynamically via GET /sitemap.xml
      res.json({ message: 'Sitemap regenerated successfully' });
    } catch (error: any) {
      res.status(500).json({
        message: 'Failed to regenerate sitemap',
        detail: error?.message,
      });
    }
  });

  // Admin: regenerate robots.txt endpoint
  app.post('/api/seo/regenerate-robots', requireRootAdmin, async (req: any, res) => {
    try {
      const isPlatformUser = req.user?.isPlatformUser || req.user?.role === 'platform_admin';
      if (!isPlatformUser) return res.status(403).json({ message: 'Platform admin required' });

      // This endpoint doesn't generate a new robots.txt, just returns success
      // The actual robots.txt is generated dynamically via GET /robots.txt
      res.json({ message: 'Robots.txt regenerated successfully' });
    } catch (error: any) {
      res.status(500).json({
        message: 'Failed to regenerate robots.txt',
        detail: error?.message,
      });
    }
  });

  // Admin: regenerate llms.txt endpoint
  app.post('/api/seo/regenerate-llms', requireRootAdmin, async (req: any, res) => {
    try {
      const isPlatformUser = req.user?.isPlatformUser || req.user?.role === 'platform_admin';
      if (!isPlatformUser) return res.status(403).json({ message: 'Platform admin required' });

      // This endpoint doesn't generate a new llms.txt, just returns success
      // The actual llms.txt is generated dynamically via GET /llms.txt
      res.json({ message: 'LLMs.txt regenerated successfully' });
    } catch (error: any) {
      res.status(500).json({
        message: 'Failed to regenerate llms.txt',
        detail: error?.message,
      });
    }
  });

  // Seed baseline SEO settings and core pages on boot (non-blocking)
  (async () => {
    try {
      const [settings] = await db.select().from(seoSettings).limit(1);
      if (!settings) {
        await db.insert(seoSettings).values({
          siteName: 'Printyx',
          siteUrl: 'https://printyx.net',
          defaultTitle: 'Printyx — Print Fleet CRM, Service, Finance Platform',
          defaultDescription:
            'Printyx unifies CRM, Service, Product, and Finance workflows for print dealers. Master catalog, inventory, billing, and analytics in one platform.',
          allowAiCrawling: true,
          sitemapChangefreq: 'weekly',
          sitemapPriorityDefault: '0.5' as any,
        } as any);
      }

      const corePages: Array<{
        path: string;
        title: string;
        description: string;
        changefreq?: string;
        priority?: string | number;
        schemaType?: string | null;
        schemaData?: any;
      }> = [
        {
          path: '/',
          title: 'Printyx — Print Fleet CRM, Service, Finance Platform',
          description:
            'All-in-one platform: CRM, Service, Inventory, Billing, and Reporting for print dealers.',
          changefreq: 'weekly',
          priority: '1.0',
          schemaType: 'Organization',
          schemaData: {
            name: 'Printyx',
            url: 'https://printyx.net',
          },
        },
        {
          path: '/product-hub',
          title: 'Product Hub — Catalog, Inventory, and POs',
          description:
            'Manage master catalog, enable products, inventory, purchase orders, and warehouse ops.',
          changefreq: 'weekly',
          priority: '0.8',
          schemaType: 'Service',
          schemaData: {
            name: 'Product Management',
            serviceType: 'Inventory and Catalog Management',
          },
        },
        {
          path: '/product-catalog',
          title: 'Master Product Catalog — Canon imageRUNNER, imagePRESS, Accessories',
          description:
            'Browse the master catalog. Enable equipment and accessories for your tenant with pricing overrides.',
          changefreq: 'weekly',
          priority: '0.8',
          schemaType: 'Service',
          schemaData: {
            name: 'Master Product Catalog',
          },
        },
        {
          path: '/crm',
          title: 'CRM — Leads, Deals, Quotes, Proposals',
          description:
            'End-to-end sales workflow with activities, quotes, proposals, and pipeline forecasting.',
          changefreq: 'weekly',
          priority: '0.7',
          schemaType: 'SoftwareApplication',
          schemaData: {
            name: 'Printyx CRM',
            applicationCategory: 'BusinessApplication',
          },
        },
        {
          path: '/service-hub',
          title: 'Service Hub — Dispatch, PM, Field Operations',
          description:
            'Ticketing, dispatch optimization, preventive maintenance, and mobile field service.',
          changefreq: 'weekly',
          priority: '0.7',
          schemaType: 'Service',
          schemaData: { name: 'Printyx Service' },
        },
        {
          path: '/reports',
          title: 'Reports — Sales, Service, Finance KPIs',
          description:
            'Unified reporting across CRM, Service, Finance, and Product. Standardized KPIs and dashboards.',
          changefreq: 'monthly',
          priority: '0.6',
          schemaType: 'WebSite',
          schemaData: { name: 'Printyx Reports' },
        },
        {
          path: '/compare-eautomate',
          title: 'Printyx vs E-Automate | Modern Cloud Alternative for Copier Dealers',
          description:
            'Detailed comparison of Printyx vs ConnectWise E-Automate. See why copier dealers switch to modern cloud-based dealer management.',
          changefreq: 'monthly',
          priority: '0.9',
          schemaType: 'Article',
          schemaData: { name: 'Printyx vs E-Automate Comparison' },
        },
        {
          path: '/battle-card',
          title: 'Printyx vs E-Automate Comparison | Feature Battle Card',
          description:
            'Side-by-side comparison of Printyx vs E-Automate. See why modern dealers are making the switch.',
          changefreq: 'monthly',
          priority: '0.8',
          schemaType: 'Article',
          schemaData: { name: 'Competitive Battle Card' },
        },
        {
          path: '/blog',
          title: 'Printyx Blog | Insights for Copier Dealers & MPS Providers',
          description:
            'Expert insights on copier dealer operations, managed print services, and industry trends.',
          changefreq: 'daily',
          priority: '0.8',
          schemaType: 'WebPage',
          schemaData: { name: 'Printyx Blog' },
        },
        {
          path: '/predictive-intelligence',
          title: 'AI-Powered Predictive Intelligence for Copier Dealers | Printyx',
          description:
            'Leverage AI to predict service needs, optimize routes, forecast sales, and reduce downtime.',
          changefreq: 'weekly',
          priority: '0.9',
          schemaType: 'SoftwareApplication',
          schemaData: { name: 'Printyx Predictive Intelligence', applicationCategory: 'BusinessApplication' },
        },
        {
          path: '/modern-architecture',
          title: 'Modern Cloud Architecture | Why Printyx Beats Legacy Systems',
          description:
            'Built on modern cloud infrastructure. Real-time sync, mobile-first design, API-driven integrations.',
          changefreq: 'weekly',
          priority: '0.9',
          schemaType: 'Article',
          schemaData: { name: 'Modern Architecture' },
        },
        {
          path: '/integration-marketplace',
          title: 'Integration Marketplace | Connect Printyx to Your Stack',
          description:
            'Pre-built integrations with Salesforce, QuickBooks, Microsoft 365, and more.',
          changefreq: 'weekly',
          priority: '0.8',
          schemaType: 'Product',
          schemaData: { name: 'Integration Marketplace' },
        },
        {
          path: '/roi-calculator',
          title: 'ROI Calculator | See Your Savings with Printyx',
          description:
            'Calculate your potential savings by switching to Printyx from legacy dealer management systems.',
          changefreq: 'monthly',
          priority: '0.8',
          schemaType: 'WebPage',
          schemaData: { name: 'ROI Calculator' },
        },
        {
          path: '/case-studies',
          title: 'Customer Success Stories | Printyx Case Studies',
          description:
            'See how copier dealers are transforming their business with Printyx. Real results from real customers.',
          changefreq: 'monthly',
          priority: '0.7',
          schemaType: 'Article',
          schemaData: { name: 'Case Studies' },
        },
        {
          path: '/p/copier-dealer-crm',
          title: 'CRM for Copier Dealers | Printyx - Built for Print Industry',
          description:
            'Purpose-built CRM for copier dealers. Manage leads, customers, contracts, and service all in one platform.',
          changefreq: 'weekly',
          priority: '0.9',
          schemaType: 'Product',
          schemaData: { name: 'Copier Dealer CRM' },
        },
        {
          path: '/p/print-service-dispatch-mobile',
          title: 'Mobile Service Dispatch for Copier Technicians | Printyx',
          description:
            'Empower your technicians with mobile-first service dispatch. Real-time job updates, GPS tracking, and more.',
          changefreq: 'weekly',
          priority: '0.9',
          schemaType: 'Product',
          schemaData: { name: 'Mobile Service Dispatch' },
        },
        {
          path: '/knowledge-base',
          title: 'Knowledge Base | Printyx Help Center & Documentation',
          description:
            'Find answers, tutorials, and guides for using Printyx copier dealer management platform.',
          changefreq: 'weekly',
          priority: '0.7',
          schemaType: 'WebPage',
          schemaData: { name: 'Printyx Knowledge Base' },
        },
      ];

      for (const p of corePages) {
        const [existing] = await db
          .select()
          .from(seoPages)
          .where(eq(seoPages.path, p.path))
          .limit(1);
        if (!existing) {
          await db.insert(seoPages).values({
            path: p.path,
            title: p.title,
            description: p.description,
            changefreq: (p.changefreq as any) || undefined,
            priority: (p.priority as any) || undefined,
            schemaType: (p.schemaType as any) || null,
            schemaData: (p.schemaData as any) || null,
            includeInSitemap: true,
            lastmod: new Date(),
          } as any);
        }
      }
    } catch (e) {
      log.warn('SEO bootstrap skipped:', (e as any)?.message);
    }
  })();
}
