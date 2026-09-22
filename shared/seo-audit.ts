/**
 * The page audit behind "Run SEO Audit", shared by both hosts.
 *
 * PROD-008: POST /api/seo/audit had no branch in supabase/functions/seo/, so
 * the dashboard's primary button 404'd for every deployed user. The evaluation
 * lives here and each host supplies the PageFacts plus the few response
 * observations that are not in the markup (status, encoding, caching).
 *
 * Four things the Express original got wrong, fixed rather than ported:
 *
 *  1. Word count came from `$('body').text()`, which includes the text of every
 *     inline <script>. A JS-heavy page reported thousands of words of minified
 *     JavaScript and passed the thin-content check; a page with no body
 *     reported one word, because ''.split(' ') has length 1.
 *  2. Internal links were counted with
 *     `a[href^="/"], a[href^="' + $('base').attr('href') + '"]`. With no <base>
 *     that second selector is the literal `a[href^="undefined"]`, and a site
 *     using absolute same-origin URLs had NO internal links by this measure, so
 *     it was told to add some however many it had.
 *  3. The performance score could only be 93 or 100 - one issue existed to
 *     deduct for - so a page with no compression and no caching headers scored
 *     100 on performance while the recommendations below it said otherwise.
 *     Each score now says what it covers.
 *  4. The heading-order check compared each heading to the previous one and
 *     reported nothing about where the skip was, so "Heading hierarchy is not
 *     properly structured" gave an author nothing to act on.
 */
import { wordCount, type PageFacts } from './seo-page-facts';

export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface AuditIssue {
  category: string;
  severity: IssueSeverity;
  message: string;
  fix?: string;
}

export interface AuditObservations {
  url: string;
  statusCode: number;
  /** The Content-Encoding response header, or null. */
  contentEncoding: string | null;
  /** The Cache-Control response header, or null. */
  cacheControl: string | null;
}

export interface AuditResult {
  overallScore: number;
  technicalScore: number;
  contentScore: number;
  performanceScore: number;
  scoreCovers: {
    technical: string[];
    content: string[];
    performance: string[];
  };
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  issues: AuditIssue[];
  recommendations: string[];
  technicalDetails: {
    statusCode: number;
    hasHTTPS: boolean;
    hasRobotsMeta: boolean;
    hasCanonical: boolean;
    hasSchema: boolean;
    pageSize: number;
    totalLinks: number;
    totalImages: number;
    wordCount: number;
    internalLinks: number;
    imagesWithoutAlt: number;
  };
  unbacked: string[];
}

export const AUDIT_UNBACKED = [
  'Load time, rendering and layout shift are not measured here: this audit reads one response and its markup. The Core Web Vitals check uses the PageSpeed API for those.',
  'Off-page signals - backlinks, domain authority, competitor position - are outside what a single page fetch can see.',
];

const TITLE_MIN = 30;
const TITLE_MAX = 60;
const DESCRIPTION_MIN = 120;
const DESCRIPTION_MAX = 160;
const THIN_CONTENT_WORDS = 300;
const LARGE_PAGE_BYTES = 2_000_000;
const MIN_INTERNAL_LINKS = 3;

function technicalIssues(facts: PageFacts, obs: AuditObservations): AuditIssue[] {
  const issues: AuditIssue[] = [];

  if (!obs.url.startsWith('https://')) {
    issues.push({
      category: 'Security',
      severity: 'critical',
      message: 'Site is not using HTTPS',
      fix: 'Install an SSL certificate and redirect all HTTP traffic to HTTPS',
    });
  }

  if (obs.statusCode >= 400) {
    issues.push({
      category: 'Indexing',
      severity: 'critical',
      message: `The page answered ${obs.statusCode}`,
      fix: 'A page search engines cannot fetch cannot rank; fix the response before anything else here',
    });
  }

  const title = facts.title?.trim() ?? '';
  if (!title) {
    issues.push({
      category: 'Meta Tags',
      severity: 'critical',
      message: 'Missing title tag',
      fix: 'Add a unique, descriptive title tag to the page',
    });
  } else if (title.length < TITLE_MIN) {
    issues.push({
      category: 'Meta Tags',
      severity: 'high',
      message: `Title tag is too short (${title.length} characters)`,
      fix: `Expand the title to ${TITLE_MIN}-${TITLE_MAX} characters`,
    });
  } else if (title.length > TITLE_MAX) {
    issues.push({
      category: 'Meta Tags',
      severity: 'medium',
      message: `Title tag may be truncated in search results (${title.length} characters)`,
      fix: `Shorten the title to ${TITLE_MIN}-${TITLE_MAX} characters`,
    });
  }

  const description = facts.metaDescription?.trim() ?? null;
  if (description === null) {
    issues.push({
      category: 'Meta Tags',
      severity: 'high',
      message: 'Missing meta description',
      fix: `Add a meta description of ${DESCRIPTION_MIN}-${DESCRIPTION_MAX} characters`,
    });
  } else if (description.length < DESCRIPTION_MIN) {
    issues.push({
      category: 'Meta Tags',
      severity: 'medium',
      message: `Meta description is too short (${description.length} characters)`,
      fix: `Expand the description to ${DESCRIPTION_MIN}-${DESCRIPTION_MAX} characters`,
    });
  } else if (description.length > DESCRIPTION_MAX) {
    issues.push({
      category: 'Meta Tags',
      severity: 'low',
      message: `Meta description may be truncated (${description.length} characters)`,
      fix: `Shorten the description to ${DESCRIPTION_MIN}-${DESCRIPTION_MAX} characters`,
    });
  }

  const h1s = facts.headings.filter((h) => h.level === 1);
  if (h1s.length === 0) {
    issues.push({
      category: 'Headings',
      severity: 'high',
      message: 'Missing H1 tag',
      fix: 'Add a single H1 that describes what the page is about',
    });
  } else if (h1s.length > 1) {
    issues.push({
      category: 'Headings',
      severity: 'medium',
      message: `Multiple H1 tags found (${h1s.length})`,
      fix: 'Use one H1 per page',
    });
  }

  const robots = facts.robotsMeta?.toLowerCase() ?? '';
  if (robots.includes('noindex') || robots.includes('nofollow')) {
    issues.push({
      category: 'Indexing',
      severity: 'critical',
      message: `Page is blocked from indexing (robots: ${facts.robotsMeta})`,
      fix: 'Remove the noindex/nofollow directive if this page should be indexed',
    });
  }

  if (facts.viewport === null) {
    issues.push({
      category: 'Mobile',
      severity: 'high',
      message: 'Missing viewport meta tag',
      fix: 'Add: <meta name="viewport" content="width=device-width, initial-scale=1">',
    });
  }

  return issues;
}

/**
 * Whether a link points at the same host as the page.
 *
 * The original matched `href^="/"` only, so a site writing absolute
 * same-origin URLs was told to add internal links however many it had.
 */
function countInternalLinks(facts: PageFacts, url: string): number {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return 0;
  }

  let count = 0;
  for (const link of facts.links) {
    const href = link.href?.trim();
    if (!href || href.startsWith('#')) continue;
    if (/^(mailto|tel|sms|javascript):/i.test(href)) continue;
    try {
      if (new URL(href, url).hostname === host) count++;
    } catch {
      // Not a resolvable URL; it is not an internal link either.
    }
  }
  return count;
}

/** The first place a heading level jumps by more than one. */
export function firstHeadingSkip(
  headings: PageFacts['headings'],
): { from: number; to: number; text: string } | null {
  let previous = 0;
  for (const heading of headings) {
    if (previous !== 0 && heading.level > previous + 1) {
      return { from: previous, to: heading.level, text: heading.text };
    }
    previous = heading.level;
  }
  return null;
}

function contentIssues(facts: PageFacts, obs: AuditObservations) {
  const issues: AuditIssue[] = [];
  const recommendations: string[] = [];

  const words = wordCount(facts.bodyText);
  if (words < THIN_CONTENT_WORDS) {
    issues.push({
      category: 'Content',
      severity: 'high',
      message: `Content is thin (${words} words)`,
      fix: 'Add more of what the reader came for; 600+ words is a reasonable target for a page meant to rank',
    });
  }

  // An absent alt attribute, not an empty one: alt="" is how a decorative
  // image is marked and a screen reader skips it correctly.
  const imagesWithoutAlt = facts.images.filter((img) => img.alt === null).length;
  if (imagesWithoutAlt > 0) {
    issues.push({
      category: 'Images',
      severity: 'medium',
      message: `${imagesWithoutAlt} of ${facts.images.length} images have no alt attribute`,
      fix: 'Add descriptive alt text, or alt="" if the image is decorative',
    });
  }

  const internalLinks = countInternalLinks(facts, obs.url);
  if (internalLinks < MIN_INTERNAL_LINKS) {
    recommendations.push(
      `Only ${internalLinks} internal link(s) found - add more so readers and crawlers can reach the rest of the site`,
    );
  }

  const skip = firstHeadingSkip(facts.headings);
  if (skip) {
    issues.push({
      category: 'Content Structure',
      severity: 'low',
      // Naming WHERE the skip is turns this from a verdict into a change
      // somebody can make.
      message: `Heading level jumps from H${skip.from} to H${skip.to} at "${skip.text.slice(0, 60)}"`,
      fix: 'Use headings in order without skipping a level',
    });
  }

  if (facts.jsonLdBlocks.length === 0) {
    recommendations.push(
      'Add structured data (Schema.org) so search engines can show rich results',
    );
  }
  if (facts.canonical === null) {
    recommendations.push('Add a canonical tag to name the preferred URL for this page');
  }

  return { issues, recommendations, internalLinks, words, imagesWithoutAlt };
}

function performanceIssues(facts: PageFacts, obs: AuditObservations) {
  const issues: AuditIssue[] = [];
  const recommendations: string[] = [];

  if (facts.htmlLength > LARGE_PAGE_BYTES) {
    issues.push({
      category: 'Performance',
      severity: 'high',
      message: `The HTML alone is ${(facts.htmlLength / 1024).toFixed(0)}KB`,
      fix: 'Move content out of the document, minify, and enable compression',
    });
  }

  const compressed = (obs.contentEncoding ?? '').toLowerCase();
  const isCompressed =
    compressed.includes('gzip') || compressed.includes('br') || compressed.includes('deflate');
  if (!isCompressed) {
    issues.push({
      category: 'Performance',
      severity: 'medium',
      message: 'The response is not compressed',
      fix: 'Enable gzip or brotli compression',
    });
  }

  if (!obs.cacheControl) {
    issues.push({
      category: 'Performance',
      severity: 'low',
      message: 'No Cache-Control header',
      fix: 'Add caching headers so a repeat visit does not re-download everything',
    });
  }

  return { issues, recommendations };
}

const SEVERITY_WEIGHT: Record<IssueSeverity, number> = {
  critical: 10,
  high: 5,
  medium: 2,
  low: 1,
};

/** 100 less the weight of what was found, floored at 0. */
function scoreFor(issues: AuditIssue[]): number {
  const deduction = issues.reduce((total, issue) => total + SEVERITY_WEIGHT[issue.severity], 0);
  return Math.max(0, 100 - deduction * 2);
}

export function evaluateSeoAudit(facts: PageFacts, obs: AuditObservations): AuditResult {
  const technical = technicalIssues(facts, obs);
  const content = contentIssues(facts, obs);
  const performance = performanceIssues(facts, obs);

  const issues = [...technical, ...content.issues, ...performance.issues];
  const recommendations = [...content.recommendations, ...performance.recommendations];

  // Each score is over ITS OWN issues, weighted by severity. The originals
  // scored content and performance on a raw issue COUNT, and only one
  // performance issue existed to count, so that score was 93 or 100 whatever
  // the page did.
  const technicalScore = scoreFor(technical);
  const contentScore = scoreFor(content.issues);
  const performanceScore = scoreFor(performance.issues);

  const severityCount = (severity: IssueSeverity) =>
    issues.filter((issue) => issue.severity === severity).length;

  return {
    overallScore: Math.round((technicalScore + contentScore + performanceScore) / 3),
    technicalScore,
    contentScore,
    performanceScore,
    scoreCovers: {
      technical: ['HTTPS', 'status code', 'title', 'meta description', 'H1', 'robots', 'viewport'],
      content: ['word count', 'image alt attributes', 'heading order'],
      performance: ['HTML size', 'compression', 'cache headers'],
    },
    criticalIssues: severityCount('critical'),
    highIssues: severityCount('high'),
    mediumIssues: severityCount('medium'),
    lowIssues: severityCount('low'),
    issues,
    recommendations,
    technicalDetails: {
      statusCode: obs.statusCode,
      hasHTTPS: obs.url.startsWith('https://'),
      hasRobotsMeta: facts.robotsMeta !== null,
      hasCanonical: facts.canonical !== null,
      hasSchema: facts.jsonLdBlocks.length > 0,
      pageSize: facts.htmlLength,
      totalLinks: facts.links.length,
      totalImages: facts.images.length,
      wordCount: content.words,
      internalLinks: content.internalLinks,
      imagesWithoutAlt: content.imagesWithoutAlt,
    },
    unbacked: [...AUDIT_UNBACKED],
  };
}
