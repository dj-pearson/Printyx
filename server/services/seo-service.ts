/**
 * SEO Service Layer - Real Implementations
 * All functions interact with real databases and APIs
 */

import { db } from '../db';
import { eq, desc, and } from 'drizzle-orm';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('seo-service');

import {
  seoSettings,
  seoAuditHistory,
  seoKeywords,
  seoKeywordHistory,
  seoCoreWebVitals,
  seoCrawlResults,
  seoImageAnalysis,
  seoLinkAnalysis,
  seoSecurityAnalysis,
  seoMobileAnalysis,
  seoStructuredData,
  seoRedirectAnalysis,
  seoDuplicateContent,
  seoPageScores,
  seoContentOptimization,
  seoSemanticAnalysis,
  seoCompetitorAnalysis,
} from '@shared/schema';
import * as cheerio from 'cheerio';
import {
  CHECKED_LINK_LIMIT,
  evaluateMobileFriendliness,
  evaluatePageImages,
  planLinkChecks,
  validateJsonLdBlocks,
  type ImageFact,
  type LinkFact,
  type PageFacts,
} from '@shared/seo-page-facts';
import { evaluateSeoAudit, type AuditResult } from '@shared/seo-audit';
import {
  evaluateSecurityHeaders,
  MAX_REDIRECTS,
  readPageSpeedVitals,
  type RedirectStep,
  summariseRedirectChain,
} from '@shared/seo-checks';
import fetch from 'node-fetch';

// ============= TYPES =============

// AuditResult is imported from @shared/seo-audit, which both hosts read. The
// local copy that stood here typed technicalDetails as `any`, so every field
// the page reads off it was unchecked.

interface CrawlPage {
  url: string;
  title?: string;
  metaDescription?: string;
  h1?: string;
  statusCode: number;
  redirectUrl?: string;
  wordCount: number;
  contentType?: string;
  internalLinks: number;
  externalLinks: number;
  brokenLinks: number;
  totalImages: number;
  imagesWithoutAlt: number;
  hasCanonical: boolean;
  canonicalUrl?: string;
  hasSchema: boolean;
  schemaTypes?: string[];
  loadTime: number;
  pageSize: number;
  crawlDepth: number;
  issues: Array<{
    type: string;
    severity: string;
    message: string;
  }>;
}

// ============= COMPREHENSIVE SEO AUDIT =============

export async function performComprehensiveSEOAudit(url: string): Promise<AuditResult> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PrintyxSEOBot/1.0; +https://printyx.net)',
      },
    });

    const html = await response.text();

    return evaluateSeoAudit(extractPageFacts(html), {
      url,
      statusCode: response.status,
      contentEncoding: response.headers.get('content-encoding'),
      cacheControl: response.headers.get('cache-control'),
    });
  } catch (error: any) {
    throw new Error(`SEO Audit failed: ${error.message}`);
  }
}

// ============= WEB CRAWLER =============

export async function crawlWebsite(
  startUrl: string,
  maxPages: number = 100,
  maxDepth: number = 3,
  tenantId: string,
): Promise<CrawlPage[]> {
  const visited = new Set<string>();
  const toVisit: Array<{ url: string; depth: number }> = [{ url: startUrl, depth: 0 }];
  const results: CrawlPage[] = [];
  const startTime = Date.now();

  const baseUrl = new URL(startUrl);
  const baseDomain = baseUrl.hostname;

  while (toVisit.length > 0 && visited.size < maxPages) {
    const { url, depth } = toVisit.shift()!;

    if (visited.has(url) || depth > maxDepth) continue;
    visited.add(url);

    try {
      const pageStartTime = Date.now();
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PrintyxSEOBot/1.0)',
        },
        redirect: 'follow',
      });

      const html = await response.text();
      const pageLoadTime = Date.now() - pageStartTime;
      const $ = cheerio.load(html);

      // Extract page data
      const title = $('title').text();
      const metaDescription = $('meta[name="description"]').attr('content');
      const h1 = $('h1').first().text();
      const canonicalUrl = $('link[rel="canonical"]').attr('href');

      // Count elements
      const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
      const wordCount = bodyText.split(' ').length;
      const images = $('img');
      const imagesWithoutAlt = images.filter((i, img) => !$(img).attr('alt')).length;

      // Extract links
      const links = $('a[href]');
      let internalLinks = 0;
      let externalLinks = 0;

      links.each((i, link) => {
        const href = $(link).attr('href');
        if (!href) return;

        try {
          const linkUrl = new URL(href, url);
          if (linkUrl.hostname === baseDomain) {
            internalLinks++;
            // Add to crawl queue if within depth limit
            if (depth < maxDepth && !visited.has(linkUrl.href)) {
              toVisit.push({ url: linkUrl.href, depth: depth + 1 });
            }
          } else {
            externalLinks++;
          }
        } catch (e) {
          // Invalid URL
        }
      });

      // Check for schema
      const schemaScripts = $('script[type="application/ld+json"]');
      const schemaTypes: string[] = [];
      schemaScripts.each((i, script) => {
        try {
          const schemaData = JSON.parse($(script).html() || '{}');
          if (schemaData['@type']) {
            schemaTypes.push(schemaData['@type']);
          }
        } catch (e) {
          // Invalid JSON
        }
      });

      // Detect issues
      const issues: Array<{ type: string; severity: string; message: string }> = [];

      if (!title) {
        issues.push({ type: 'meta', severity: 'critical', message: 'Missing title tag' });
      }
      if (!metaDescription) {
        issues.push({ type: 'meta', severity: 'high', message: 'Missing meta description' });
      }
      if (!h1) {
        issues.push({ type: 'content', severity: 'high', message: 'Missing H1 tag' });
      }
      if (imagesWithoutAlt > 0) {
        issues.push({
          type: 'images',
          severity: 'medium',
          message: `${imagesWithoutAlt} images without alt text`,
        });
      }
      if (wordCount < 300) {
        issues.push({ type: 'content', severity: 'medium', message: 'Thin content' });
      }

      results.push({
        url,
        title,
        metaDescription,
        h1,
        statusCode: response.status,
        redirectUrl: response.url !== url ? response.url : undefined,
        wordCount,
        contentType: response.headers.get('content-type') || undefined,
        internalLinks,
        externalLinks,
        brokenLinks: 0, // Will be calculated separately
        totalImages: images.length,
        imagesWithoutAlt,
        hasCanonical: !!canonicalUrl,
        canonicalUrl,
        hasSchema: schemaScripts.length > 0,
        schemaTypes: schemaTypes.length > 0 ? schemaTypes : undefined,
        loadTime: pageLoadTime,
        pageSize: html.length,
        crawlDepth: depth,
        issues,
      });
    } catch (error: any) {
      log.error(`Error crawling ${url}:`, error.message);
      results.push({
        url,
        statusCode: 0,
        wordCount: 0,
        internalLinks: 0,
        externalLinks: 0,
        brokenLinks: 0,
        totalImages: 0,
        imagesWithoutAlt: 0,
        hasCanonical: false,
        hasSchema: false,
        loadTime: 0,
        pageSize: 0,
        crawlDepth: depth,
        issues: [{ type: 'crawl', severity: 'critical', message: error.message }],
      });
    }

    // Rate limiting - don't overwhelm servers
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return results;
}

// ============= PAGESPEED INSIGHTS (Core Web Vitals) =============

/**
 * SEO-TRANSPORT-001. Two things left with the rewrite, both fabrications.
 *
 * `estimateCoreWebVitals()` returned LCP 2500ms, CLS 0.1 and a performance score
 * of 75 whenever the PageSpeed request failed, and the route STORED that in
 * seo_core_web_vitals - so a page nobody measured reported respectable vitals,
 * indistinguishable from a real reading. CLAUDE.md's SEO note says this function
 * "throws without a PageSpeed key rather than guessing", which was true of the
 * missing-key path and not of this one. The failure propagates now.
 *
 * And `|| 0` on every metric turned an audit Lighthouse did not return into 0ms
 * LCP and 0 CLS - not "we did not measure" but a perfect score, on the two
 * numbers this panel exists to show. shared/seo-checks.ts answers null and names
 * what was missing.
 */
export async function checkCoreWebVitalsWithAPI(
  url: string,
  device: 'mobile' | 'desktop' = 'mobile',
) {
  const apiKey = process.env.PAGESPEED_INSIGHTS_API_KEY;

  if (!apiKey) {
    throw new Error('PageSpeed Insights API key not configured');
  }

  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
    url,
  )}&strategy=${device}&key=${apiKey}`;

  const response = await fetch(apiUrl);
  const data: any = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || 'PageSpeed API request failed');
  }

  const audits = (data?.lighthouseResult?.audits ?? {}) as Record<string, any>;
  return {
    ...readPageSpeedVitals(data),
    diagnostics: {
      opportunities: Object.keys(audits)
        .filter((key) => audits[key].details?.type === 'opportunity')
        .map((key) => ({
          audit: key,
          title: audits[key].title,
          savings: audits[key].details?.overallSavingsMs,
        })),
    },
    opportunities: [],
  };
}

/**
 * PROD-008: the four checks below now DECIDE nothing here.
 *
 * `/api/seo` is not proxied, so Express serves these in dev and
 * supabase/functions/seo/ serves them in production - and that function had no
 * branch for any of the four, so the image, broken-link, mobile and
 * structured-data buttons 404'd for every deployed user. The evaluation moved
 * to shared/seo-page-facts.ts, which both hosts import; what stays here is the
 * cheerio extraction, because the Deno side has node-html-parser instead and
 * neither resolves on the other runtime.
 *
 * Read that module's header for the five claims these functions used to make
 * that nothing measured - among them a flat 50KB "potential saving" on every
 * non-webp image, and a small-text count taken from cheerio's `.css()`, which
 * reads an inline style attribute and knows nothing about stylesheets.
 */
export function extractPageFacts(html: string): PageFacts {
  const $ = cheerio.load(html);

  // cheerio no longer exports AnyNode; take the element type from $ itself.
  const attr = (el: Parameters<typeof $>[0], name: string): string | null => {
    const value = $(el).attr(name);
    return value === undefined ? null : value;
  };

  const images: ImageFact[] = $('img')
    .toArray()
    .map((el) => ({
      src: attr(el, 'src') ?? '',
      alt: attr(el, 'alt'),
      title: attr(el, 'title'),
      width: attr(el, 'width'),
      height: attr(el, 'height'),
      loading: attr(el, 'loading'),
    }));

  const links: LinkFact[] = $('a[href]')
    .toArray()
    .map((el) => ({
      href: attr(el, 'href') ?? '',
      text: $(el).text() ?? '',
      rel: attr(el, 'rel'),
    }));

  const viewportEl = $('meta[name="viewport"]').first();
  const viewport = viewportEl.length ? (viewportEl.attr('content') ?? '') : null;

  // The type attribute alone misses the commonest embed shape, so the source
  // extension counts too.
  const flashElements = $('object, embed')
    .toArray()
    .filter((el) => {
      const type = (attr(el, 'type') ?? '').toLowerCase();
      const source = `${attr(el, 'data') ?? ''} ${attr(el, 'src') ?? ''}`.toLowerCase();
      return type.includes('flash') || type.includes('shockwave') || source.includes('.swf');
    }).length;

  const jsonLdBlocks = $('script[type="application/ld+json"]')
    .toArray()
    // html(), the raw-content accessor. In cheerio today text() happens to
    // return the same string for a script element, because htmlparser2 stores
    // its content as a raw-text node - so a mutation between the two changes
    // nothing and proves nothing. The PROPERTY the test binds to is that
    // 'Ben &amp; Jerry' still reads as 'Ben &amp; Jerry' by the time JSON.parse
    // sees it, which is what the HTML spec says about character data in a
    // script and what an entity-decoding read would quietly rewrite.
    .map((el) => $(el).html() ?? '');

  const titleEl = $('title').first();
  const title = titleEl.length ? titleEl.text() : null;

  const descEl = $('meta[name="description"]').first();
  const metaDescription = descEl.length ? (descEl.attr('content') ?? '') : null;

  const canonicalEl = $('link[rel="canonical"]').first();
  const canonical = canonicalEl.length ? (canonicalEl.attr('href') ?? '') : null;

  const robotsEl = $('meta[name="robots"]').first();
  const robotsMeta = robotsEl.length ? (robotsEl.attr('content') ?? '') : null;

  const headings = $('h1, h2, h3, h4, h5, h6')
    .toArray()
    .map((el) => ({
      level: Number.parseInt(((el as { tagName?: string }).tagName ?? '').slice(1), 10),
      text: $(el).text().replace(/\s+/g, ' ').trim(),
    }))
    .filter((h) => Number.isFinite(h.level));

  // Script, style and noscript are stripped before the text is read: the audit
  // used to count inline JavaScript as words. This runs LAST, after the JSON-LD
  // blocks above have been read off the same tree.
  $('script, style, noscript').remove();
  const bodyEl = $('body');
  // Two concrete reads rather than one union: Cheerio<Document> and
  // Cheerio<Element> do not share a `this` type for .text().
  const rawBody = bodyEl.length > 0 ? bodyEl.text() : $.root().text();
  const bodyText = rawBody.replace(/\s+/g, ' ').trim();

  return {
    images,
    links,
    viewport,
    flashElements,
    jsonLdBlocks,
    title,
    metaDescription,
    canonical,
    robotsMeta,
    headings,
    bodyText,
    htmlLength: html.length,
  };
}

/** Fetch a page and extract its facts. */
async function loadPageFacts(pageUrl: string): Promise<PageFacts> {
  const response = await fetch(pageUrl);
  return extractPageFacts(await response.text());
}

export async function analyzePageImages(pageUrl: string) {
  try {
    return evaluatePageImages(await loadPageFacts(pageUrl), pageUrl);
  } catch (error: any) {
    throw new Error(`Image analysis failed: ${error.message}`);
  }
}

// ============= BROKEN LINK CHECKER =============

export { CHECKED_LINK_LIMIT };

export async function checkBrokenLinks(sourceUrl: string) {
  try {
    const planned = planLinkChecks(await loadPageFacts(sourceUrl), sourceUrl);
    const links: Array<Record<string, unknown>> = [];

    for (const link of planned) {
      // Past the budget the link is recorded UNCHECKED - statusCode null,
      // isBroken null - and never as healthy. They used to be initialised to
      // 200 and false, so a page with 200 links reported 180 of them working
      // on no evidence.
      let statusCode: number | null = null;
      let isBroken: boolean | null = null;
      let errorMessage: string | undefined;

      if (link.shouldCheck) {
        try {
          const linkResponse = await fetch(link.targetUrl, {
            method: 'HEAD',
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PrintyxSEOBot/1.0)' },
          });
          statusCode = linkResponse.status;
          isBroken = statusCode >= 400;
        } catch (error: any) {
          isBroken = true;
          errorMessage = error.message;
          statusCode = 0;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      links.push({
        targetUrl: link.targetUrl,
        anchorText: link.anchorText,
        linkType: link.linkType,
        isNoFollow: link.isNoFollow,
        isNoOpener: link.isNoOpener,
        linkValue: link.linkValue,
        statusCode,
        isBroken,
        errorMessage,
        wasChecked: link.shouldCheck,
      });
    }

    return links;
  } catch (error: any) {
    throw new Error(`Broken link check failed: ${error.message}`);
  }
}

// ============= SECURITY HEADERS CHECK =============

/**
 * SEO-TRANSPORT-001: the evaluation lives in shared/seo-checks.ts and is the
 * SAME module supabase/functions/seo imports, so the two hosts cannot drift.
 *
 * Two fields left with it. `certificateValid: hasHttps` claimed a certificate
 * check from a URL scheme, and `httpsRedirect: hasHttps` claimed a redirect
 * nothing had followed - both on a panel a marketer reads as a security
 * posture. The certificate claim is gone and named in `unbacked`; the redirect
 * is measured by probing the http:// form, and stays null when that probe fails.
 */
export async function checkSecurityHeaders(url: string) {
  try {
    const response = await fetch(url);

    let httpsRedirect: boolean | null = null;
    try {
      const insecure = new URL(url);
      insecure.protocol = 'http:';
      const probe = await fetch(insecure.href, { redirect: 'manual' });
      const location = probe.headers.get('location');
      httpsRedirect =
        probe.status >= 300 && probe.status < 400 && !!location
          ? new URL(location, insecure.href).protocol === 'https:'
          : false;
    } catch {
      httpsRedirect = null;
    }

    const entries: Array<[string, string]> = [];
    response.headers.forEach((value: string, key: string) => entries.push([key, value]));

    return evaluateSecurityHeaders(url, entries, httpsRedirect);
  } catch (error: any) {
    throw new Error(`Security header check failed: ${error.message}`);
  }
}

// ============= MOBILE ANALYSIS =============

export async function analyzeMobileFriendliness(url: string) {
  try {
    return evaluateMobileFriendliness(await loadPageFacts(url));
  } catch (error: any) {
    throw new Error(`Mobile analysis failed: ${error.message}`);
  }
}

// ============= STRUCTURED DATA VALIDATION =============

export async function validateStructuredData(url: string) {
  try {
    return validateJsonLdBlocks((await loadPageFacts(url)).jsonLdBlocks);
  } catch (error: any) {
    throw new Error(`Structured data validation failed: ${error.message}`);
  }
}

// ============= REDIRECT CHAIN DETECTION =============

/** SEO-TRANSPORT-001: walks the chain here, summarises it in shared/seo-checks.ts. */
export async function detectRedirectChains(sourceUrl: string) {
  try {
    const steps: RedirectStep[] = [];
    let currentUrl = sourceUrl;
    let loop = false;
    let truncated = false;

    for (let hop = 0; ; hop += 1) {
      const response = await fetch(currentUrl, { redirect: 'manual' });
      const location = response.headers.get('location');
      steps.push({ url: currentUrl, statusCode: response.status, location });

      const redirecting = response.status >= 300 && response.status < 400 && !!location;
      if (!redirecting) break;

      const next = new URL(location as string, currentUrl).href;
      if (steps.some((step) => step.url === next)) {
        loop = true;
        break;
      }
      // Reported rather than treated as the destination: stopping at the limit
      // and returning that URL is a claim the redirect ended there.
      if (hop + 1 >= MAX_REDIRECTS) {
        truncated = true;
        break;
      }
      currentUrl = next;
    }

    return summariseRedirectChain(steps, { loop, truncated });
  } catch (error: any) {
    throw new Error(`Redirect detection failed: ${error.message}`);
  }
}

// ============= EXPORTS =============

export const seoService = {
  CHECKED_LINK_LIMIT,
  performComprehensiveSEOAudit,
  crawlWebsite,
  checkCoreWebVitalsWithAPI,
  analyzePageImages,
  checkBrokenLinks,
  checkSecurityHeaders,
  analyzeMobileFriendliness,
  validateStructuredData,
  detectRedirectChains,
};
