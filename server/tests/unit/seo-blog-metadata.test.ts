/**
 * Blog posts had two SEO systems and one of them pointed at the wrong domain
 * (SEO-009).
 *
 * SEOProvider emits BlogPosting + BreadcrumbList for these routes from the
 * route table. BlogPostLayout ALSO ran usePageSeo with its own Article schema
 * and a second BreadcrumbSchemaScript, and both wrote the meta tags. usePageSeo
 * ran last, so it won - and its `baseUrl` was 'https://printyx.com' while the
 * site is printyx.net. Every blog post therefore shipped
 * <link rel="canonical" href="https://printyx.com/blog/..."> plus a matching
 * og:url: a cross-domain canonical, which asks a search engine not to index the
 * page it is looking at and to credit a different domain instead.
 *
 * Confirmed in Chromium before and after: canonical and og:url were on the .com
 * and are on the .net now, and the page went from four article-ish JSON-LD
 * blocks (BlogPosting, Article, BreadcrumbList twice) to two.
 *
 * Separately, generateArticleSchema stamped datePublished and dateModified with
 * `new Date().toISOString()`, so every post claimed it was published at the
 * moment it was viewed - and datePublished is the date Google prints beside an
 * article in results.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PUBLIC_ROUTES_SEO, SITE_URL } from '../../../client/src/lib/seo/seoConfig';

const root = process.cwd();
const layout = readFileSync(join(root, 'client/src/components/blog/BlogPostLayout.tsx'), 'utf8');
const provider = readFileSync(join(root, 'client/src/lib/seo/SEOProvider.tsx'), 'utf8');
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const postRoutes = PUBLIC_ROUTES_SEO.filter(
  (r) => r.path.startsWith('/blog/') && r.path !== '/blog',
);

describe('one SEO system per blog post', () => {
  it('BlogPostLayout writes no meta, no canonical and no schema', () => {
    const code = strip(layout);
    expect(code).not.toContain('usePageSeo');
    expect(code).not.toContain('BreadcrumbSchemaScript');
    expect(code).not.toContain('articleSchema');
    expect(code).not.toContain('canonicalUrl');
  });

  it('names no domain at all, let alone the wrong one', () => {
    const code = strip(layout);
    expect(code).not.toContain('printyx.com');
    expect(code).not.toContain('printyx.net');
  });

  it('SITE_URL is the .net domain the site is served from', () => {
    expect(SITE_URL).toBe('https://printyx.net');
  });
});

describe('blog post dates are real', () => {
  it('no article schema stamps the clock', () => {
    const code = strip(provider);
    expect(code).not.toContain('datePublished: new Date()');
    expect(code).not.toContain('dateModified: new Date()');
  });

  it('every published post carries an ISO datePublished', () => {
    expect(postRoutes.length).toBe(3);
    for (const route of postRoutes) {
      expect(route.datePublished, `${route.path} has no date`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('the structured date agrees with the date the page displays', () => {
    // The page renders a human date next to the byline; a reader and a crawler
    // being told different publication dates is the drift this catches.
    const dir = join(root, 'client/src/pages/blog');
    for (const file of readdirSync(dir).filter((f) => f !== 'index.tsx')) {
      const src = readFileSync(join(dir, file), 'utf8');
      const slug = src.match(/slug="([^"]+)"/)?.[1];
      const shown = src.match(/date="([^"]+)"/)?.[1];
      expect(slug, `${file} passes no slug`).toBeDefined();
      expect(shown, `${file} passes no date`).toBeDefined();
      const route = postRoutes.find((r) => r.path === `/blog/${slug}`);
      expect(route, `/blog/${slug} has no route-table entry`).toBeDefined();
      const iso = new Date(`${shown} UTC`).toISOString().slice(0, 10);
      expect(iso, `${file} shows ${shown}`).toBe(route!.datePublished);
    }
  });
});

describe('every blog post page has a route-table entry', () => {
  it('page files, App routes and PUBLIC_ROUTES_SEO name the same slugs', () => {
    const app = readFileSync(join(root, 'client/src/App.tsx'), 'utf8');
    const routed = [...app.matchAll(/path="(\/blog\/[a-z0-9-]+)"/g)].map((m) => m[1]).sort();
    const configured = postRoutes.map((r) => r.path).sort();
    const files = readdirSync(join(root, 'client/src/pages/blog'))
      .filter((f) => f !== 'index.tsx')
      .map((f) => `/blog/${f.replace(/\.tsx$/, '')}`)
      .sort();
    expect(routed).toEqual(configured);
    expect(files).toEqual(configured);
  });
});
