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
 * - SEO bootstrap logic (seed baseline settings and core pages on boot)
 *
 * The three POST /api/seo/regenerate-* endpoints were deleted (SEO-005); see
 * the note where they used to live for why there was nothing for them to do.
 *
 * NOTE ON MOUNTING: this module registers on `app` through the exported
 * registerSeoCoreRoutes(), not on a `router`. A grep for `router.post(` finds
 * none of these, which is how iteration 5 of the SEO loop concluded the
 * regenerate endpoints did not exist anywhere. Same blind spot
 * check:shadowed-express documents for self-mounting modules.
 */
import type { Express } from 'express';
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { db } from './db';
import { eq, desc } from 'drizzle-orm';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-seo-core');

import { seoSettings, insertSeoSettingsSchema } from '@shared/schema';
import { requireRootAdmin } from './routes-root-admin';
import { isPlatformAdmin } from './utils/auth-helpers';

import { getUserId, getTenantId } from './utils/auth-helpers';
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
  // Root Admin: upsert global SEO settings.
  //
  // SEO-TRANSPORT-001: PUT is the canonical method - supabase/functions/seo/index.ts
  // serves `req.method === 'PUT' && resource === 'settings'` and nothing else, and
  // that function is what production reaches. POST is kept so an older client (and
  // routes-seo.ts's shadowed copy) does not start 404ing on the dev host.
  app.put('/api/seo/settings', upsertSeoSettings);
  app.post('/api/seo/settings', upsertSeoSettings);

  // seo_settings.tenant_id is NOT NULL and this pair used to ignore it entirely:
  // `select ... limit 1` with no where clause, then an update keyed on whatever row
  // came back. So a platform admin saving settings overwrote SOME tenant's row -
  // whichever the planner returned first - and the GET below answered with that same
  // arbitrary row, to any caller, with no auth check at all. The seo edge function,
  // which is what production reaches, filters on tenant_id in both directions; these
  // now match it, so the two hosts stop disagreeing about whose settings these are.
  async function upsertSeoSettings(req: any, res: any) {
    try {
      const isPlatformUser = isPlatformAdmin(req);
      if (!isPlatformUser) return res.status(403).json({ message: 'Platform admin required' });
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
      const payload = insertSeoSettingsSchema.parse({ ...req.body, tenantId });
      const [existing] = await db
        .select()
        .from(seoSettings)
        .where(eq(seoSettings.tenantId, tenantId))
        .limit(1);
      if (existing) {
        const [updated] = await db
          .update(seoSettings)
          .set({ ...payload, tenantId, updatedAt: new Date() })
          .where(eq(seoSettings.id, (existing as any).id))
          .returning();
        return res.json(updated);
      }
      const [created] = await db
        .insert(seoSettings)
        .values({ ...payload, tenantId } as any)
        .returning();
      res.json(created);
    } catch (error: any) {
      log.error('Error upserting SEO settings:', error);
      res.status(500).json({
        message: 'Failed to upsert SEO settings',
        detail: error?.message,
      });
    }
  }

  // Root Admin: upsert SEO page record
  app.post('/api/seo/pages', async (req: any, res) => {
    try {
      const isPlatformUser = isPlatformAdmin(req);
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
  /*
   * /sitemap.xml and /robots.txt are STATIC BUILD ARTIFACTS (SEO-006). Both are
   * served from disk here so that Express and Cloudflare Pages answer the same
   * bytes at the same URL.
   *
   * They used to be composed per request from seo_pages and seo_settings, and
   * because registerSeoCoreRoutes runs before serveStatic they won over the
   * files wherever Express served the app - while Pages, which is what the
   * public actually hits, served the files. Two sitemaps, two robots.txt, one
   * URL each. The DB-derived sitemap was also wrong on its own terms: the boot
   * seed puts /crm, /reports, /product-hub, /service-hub and /product-catalog
   * in seo_pages, so it published five login-walled app routes, one of which
   * (/reports) the very robots.txt beside it disallowed; it knew nothing about
   * the COMING_SOON gate, so it listed 17 URLs that all serve the holding page;
   * and it stamped lastmod with the current time for any row without one, which
   * is a freshness claim made by the act of being asked.
   *
   * scripts/generate-sitemap.mts writes the sitemap from the route table.
   * seo_pages keeps its real job: per-path title and description, served by
   * /meta.json below.
   */
  const publicFile = (name: string, contentType: string) => async (req: any, res: any) => {
    // Order matters, and first-found is the wrong rule. In production dist/ is
    // the deployed build and must win. In development dist/ is whatever the
    // last `npm run build` left behind, which can be weeks old - preferring it
    // would serve a stale robots.txt while the real one sat in client/public.
    const candidates =
      process.env.NODE_ENV === 'production'
        ? [
            path.resolve(process.cwd(), 'dist', name),
            path.resolve(process.cwd(), 'client/public', name),
          ]
        : [
            path.resolve(process.cwd(), 'client/public', name),
            path.resolve(process.cwd(), 'dist', name),
          ];
    const found = candidates.find((candidate) => existsSync(candidate));
    if (!found) {
      // A build artifact that is missing is a broken build, and saying so beats
      // synthesising a plausible file that disagrees with what Pages serves.
      log.error(`${name} is missing from dist/ and client/public/`);
      return res.status(404).type('text/plain').send(`${name} has not been generated`);
    }
    const body = readFileSync(found, 'utf8');
    const etag = createHash('sha1').update(body).digest('hex');
    res.setHeader('ETag', etag);
    if (req.headers['if-none-match'] === etag) return res.status(304).end();
    res
      .header('Content-Type', contentType)
      .header('Cache-Control', 'public, max-age=300, s-maxage=600')
      .send(body);
  };

  app.get('/sitemap.xml', publicFile('sitemap.xml', 'application/xml; charset=utf-8'));

  // Public: robots.txt
  app.get('/robots.txt', publicFile('robots.txt', 'text/plain; charset=utf-8'));

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

  // Admin: get SEO settings for the caller's tenant. See the note on
  // upsertSeoSettings above for what this used to return.
  app.get('/api/seo/settings', async (req: any, res) => {
    try {
      const tenantId = getTenantId(req);
      if (!tenantId) return res.status(400).json({ message: 'Tenant ID is required' });
      const rows = await db
        .select()
        .from(seoSettings)
        .where(eq(seoSettings.tenantId, tenantId))
        .limit(1);
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

  /*
   * POST /api/seo/regenerate-{sitemap,robots,llms} lived here (SEO-005).
   *
   * All three answered `{ message: '... regenerated successfully' }` and did
   * nothing - their own comments said so: "This endpoint doesn't generate a new
   * sitemap, just returns success". The three buttons on RootAdminSEO that
   * called them therefore showed a green toast for an action that had never
   * happened, which is worse than a 404 because a 404 gets reported.
   *
   * There is nothing for them to do. GET /sitemap.xml, /robots.txt and
   * /llms.txt below build their response per request from seo_pages and
   * seo_settings, so there is no cached artifact to invalidate; and the files
   * the public actually gets are static build output (client/public, written by
   * npm run seo:sitemap), which no runtime handler can rewrite - a Cloudflare
   * Pages deploy would overwrite whatever it wrote.
   */

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
          schemaData: {
            name: 'Printyx Predictive Intelligence',
            applicationCategory: 'BusinessApplication',
          },
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
