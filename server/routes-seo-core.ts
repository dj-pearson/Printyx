/**
 * SEO Management Routes
 * Extracted from routes.ts monolith.
 *
 * Serves:
 * - PUT/POST /api/seo/settings (upsert global SEO settings)
 * - GET  /api/seo/settings
 * - GET  /sitemap.xml, /robots.txt, /llms.txt, /.well-known/llms.txt
 *   (all four are static build artifacts read from disk - see publicFile below)
 *
 * SEO-PAGES-001 REMOVED FIVE HANDLERS AND THE BOOT SEED, and the decision
 * recorded here is that `seo_pages` should not exist.
 *
 * It never did, in the sense that matters: there is no seoPages export, no
 * seo_pages pgTable and no such table in drizzle/migrations. This file loaded
 * it through `require('@shared/schema')` inside a try/catch that logged "SEO
 * pages schema not available" and carried on, so the identifier was undefined
 * and every handler reading a column off it threw a TypeError into its own
 * catch. POST and GET /api/seo/pages answered 500; /meta.json and /schema.json
 * silently served a generic Printyx document for every path. That top-level
 * try/catch is what turned a boot failure into five handlers failing one
 * request at a time, which is why it survived.
 *
 * Declaring the table would have been the wrong repair, for four reasons, each
 * checkable:
 *
 * 1. NOTHING READS IT ON ANY RENDER PATH. SEO-014 deleted `useSeo`, the only
 *    caller of /meta.json and /schema.json. The head is written by SEOProvider
 *    from PUBLIC_ROUTES_SEO in client/src/lib/seo/seoConfig.ts, and the sitemap
 *    by scripts/generate-sitemap.mts from the same route table. A title typed
 *    into the RootAdminSEO form reached none of them.
 * 2. ONE WRITER FOR STRUCTURED DATA. Three systems had grown alongside the
 *    route table and each caused its own defect (SEO-009's cross-domain
 *    canonical, SEO-014's "Printyx"-titled landing pages, SEO-016's duplicate
 *    BreadcrumbList). A per-path title table edited by hand is a fourth.
 * 3. ITS ENDPOINT RESOLVES TO A DIFFERENT TABLE IN PRODUCTION. /api/seo is not
 *    proxied, so getApiUrl sends /api/seo/pages to supabase/functions/seo/,
 *    whose `pages` branch reads `seo_page_scores` - tenant-scoped analysis
 *    scores - and answers { data, total } where the page maps a bare array.
 *    AUDIT-031's two-domains-one-word shape, at path level rather than prefix.
 * 4. THE SEEDED ROWS WERE WRONG ON THEIR OWN TERMS. The boot seed wrote /crm,
 *    /reports, /product-hub, /service-hub and /product-catalog - five
 *    login-walled app routes, which is exactly the set SEO-006 removed from the
 *    sitemap for being login-walled.
 *
 * The boot seed went with them. Its other half could not work either: it
 * inserted into seo_settings without a tenant_id, which is NOT NULL, so the
 * whole IIFE died in its catch on every boot regardless of seoPages.
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
import { eq } from 'drizzle-orm';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-seo-core');

import { seoSettings, insertSeoSettingsSchema } from '@shared/schema';
import { getTenantId, isPlatformAdmin } from './utils/auth-helpers';

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
   * scripts/generate-sitemap.mts writes the sitemap from the route table,
   * which is now the only source of per-path title and description - see the
   * SEO-PAGES-001 note at the top of this file.
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

  /*
   * llms.txt is a static build artifact too (SEO-007), for the same reason as
   * sitemap.xml and robots.txt above: it only ever existed as a handler here,
   * so printyx.net/llms.txt was a 404 on Cloudflare Pages while robots.txt
   * pointed at it with `LLMS:`.
   *
   * The text it used to compose is worth remembering, because an AI crawler
   * repeats this file verbatim. It advertised "$49/user/month" and
   * "$79/user/month" against Stripe products at a flat $79, $99 and $149, and
   * called Enterprise custom-priced when it has a list price; it claimed the
   * product reduces downtime "by up to 40%", holds a "2-3 year technical
   * advantage" and was built by people with "30+ years of combined experience",
   * none of which anything measures; and it listed fifteen pages that all serve
   * the coming-soon holding page. scripts/generate-llms-txt.mts writes it from
   * shared/pricing-plans.ts and the route table instead.
   */
  app.get('/llms.txt', publicFile('llms.txt', 'text/plain; charset=utf-8'));
  app.get('/.well-known/llms.txt', publicFile('llms.txt', 'text/plain; charset=utf-8'));

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
}
