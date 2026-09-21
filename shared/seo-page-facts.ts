/**
 * SEO page checks: what a parsed page says, and what that means.
 *
 * ONE MODULE, TWO PARSERS. `/api/seo` is served by Express in dev and by
 * `supabase/functions/seo/` in production, and four of the dashboard's buttons
 * - image analysis, broken links, mobile friendliness and structured data -
 * had no branch in the edge function at all, so they 404'd for every deployed
 * user while working on every developer machine.
 *
 * The evaluation lives here and both hosts import it. What cannot be shared is
 * the PARSING: Node has cheerio and Deno has node-html-parser, and neither
 * resolves on the other runtime. So each host extracts a `PageFacts` - attribute
 * reads and nothing else, deliberately too simple to drift - and every decision
 * about what those facts MEAN is made once, here.
 *
 * Five claims the Express originals made that nothing measured, removed rather
 * than ported:
 *
 *  1. `potentialSavings: 50000` on every image that is not webp. Nothing
 *     fetched the image or read its size; it was a constant wearing a
 *     measurement's clothes, and it summed into a page total.
 *  2. `smallText`, counted with cheerio's `.css('font-size')`. That reads an
 *     INLINE style attribute - there is no cascade and no stylesheet in a
 *     parser - so it only ever counted elements carrying an inline font-size,
 *     which is close to none, while reading as a measurement of the page's
 *     typography. It fed both an issue string and the mobile score.
 *  3. `hasTouchFriendlyElements: true`, hardcoded under its own comment saying
 *     it "would need more complex analysis".
 *  4. `mobileLoadTime: 0, mobileFcp: 0, mobileLcp: 0` - zero is not "unmeasured",
 *     it is instant.
 *  5. `richResultsEligible`, set from the presence of @context and @type. Rich
 *     results need the required properties of the specific type; presence of
 *     two envelope fields says nothing about eligibility.
 *
 * Each is named in the `unbacked` array its evaluator returns, which the
 * handlers pass through to the page.
 */

/** An `<img>` as the parser found it. No interpretation. */
export interface ImageFact {
  src: string;
  /** null when the attribute is absent; '' when it is present and empty. */
  alt: string | null;
  title: string | null;
  width: string | null;
  height: string | null;
  loading: string | null;
}

/** An `<a href>` as the parser found it. */
export interface LinkFact {
  href: string;
  text: string;
  rel: string | null;
}

/** One heading, in document order. */
export interface HeadingFact {
  level: number;
  text: string;
}

export interface PageFacts {
  images: ImageFact[];
  links: LinkFact[];
  /** The content attribute of `<meta name="viewport">`, or null. */
  viewport: string | null;
  /** `<object>`/`<embed>` elements declaring a Flash type. */
  flashElements: number;
  /** The raw text of every `<script type="application/ld+json">`. */
  jsonLdBlocks: string[];
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  /** The content attribute of `<meta name="robots">`, or null. */
  robotsMeta: string | null;
  headings: HeadingFact[];
  /**
   * The body's visible text, with `<script>`, `<style>` and `<noscript>`
   * REMOVED. The audit used to take `$('body').text()`, which includes every
   * inline script, so a JS-heavy page reported thousands of "words" of minified
   * JavaScript and sailed past the thin-content check.
   */
  bodyText: string;
  /** Bytes of HTML as delivered. */
  htmlLength: number;
}

export function emptyPageFacts(): PageFacts {
  return {
    images: [],
    links: [],
    viewport: null,
    flashElements: 0,
    jsonLdBlocks: [],
    title: null,
    metaDescription: null,
    canonical: null,
    robotsMeta: null,
    headings: [],
    bodyText: '',
    htmlLength: 0,
  };
}

/**
 * Words in a block of visible text.
 *
 * `text.split(' ').length` answers 1 for an empty string, so a page with no
 * body reported one word rather than none - and one word is still "thin
 * content", so the issue fired for the right reason by luck.
 */
export function wordCount(text: string): number {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  return trimmed === '' ? 0 : trimmed.split(' ').length;
}

/* ------------------------------------------------------------------ images */

/** Formats a browser can decode that are smaller than JPEG/PNG at equal quality. */
const MODERN_IMAGE_FORMATS = ['webp', 'avif'];

export interface ImageAnalysis {
  imageUrl: string;
  altText: string | null;
  title: string | null;
  width: number | null;
  height: number | null;
  format: string;
  isOptimized: boolean;
  hasAltText: boolean;
  isDecorative: boolean;
  isLazy: boolean;
  hasResponsive: boolean;
  issues: string[];
  recommendedFormat: string;
}

export interface ImageAnalysisResult {
  images: ImageAnalysis[];
  unbacked: string[];
}

export const IMAGE_SIZE_UNBACKED =
  'File size and potential savings are not measured: the checker reads the page markup and never fetches the images themselves.';

/** The extension of a URL's PATH, ignoring query and fragment. */
function formatOf(imageUrl: string): string {
  let pathname = imageUrl;
  try {
    pathname = new URL(imageUrl).pathname;
  } catch {
    // A relative URL that would not resolve; fall back to the raw string with
    // its query stripped, rather than reporting 'png?v=2' as a format.
    pathname = imageUrl.split(/[?#]/)[0];
  }
  const last = pathname.split('/').pop() ?? '';
  if (!last.includes('.')) return 'unknown';
  return last.split('.').pop()?.toLowerCase() || 'unknown';
}

function positiveInt(value: string | null): number | null {
  if (value === null) return null;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function evaluatePageImages(facts: PageFacts, pageUrl: string): ImageAnalysisResult {
  const images: ImageAnalysis[] = [];

  facts.images.forEach((img, index) => {
    if (!img.src) return;

    let imageUrl: string;
    try {
      imageUrl = new URL(img.src, pageUrl).href;
    } catch {
      return;
    }

    const width = positiveInt(img.width);
    const height = positiveInt(img.height);
    const format = formatOf(imageUrl);
    const isLazy = img.loading === 'lazy';

    // alt="" is how a decorative image is marked, and a screen reader skips it
    // correctly. The original treated it as missing, so a page that had done
    // the accessible thing was reported as having done nothing.
    const isDecorative = img.alt === '';
    const hasAltText = img.alt !== null && img.alt !== '';

    const issues: string[] = [];
    if (img.alt === null) issues.push('Missing alt attribute');
    if (!width || !height) issues.push('Missing width/height, so the layout shifts as it loads');
    // The FIRST image is usually the largest contentful paint, and deferring it
    // is a documented performance mistake - so this is an issue for the others.
    if (!isLazy && index > 0) issues.push('Not using lazy loading');

    images.push({
      imageUrl,
      altText: img.alt,
      title: img.title,
      width,
      height,
      format,
      isOptimized: MODERN_IMAGE_FORMATS.includes(format),
      hasAltText,
      isDecorative,
      isLazy,
      hasResponsive: Boolean(width && height),
      issues,
      recommendedFormat: ['jpg', 'jpeg', 'png'].includes(format) ? 'webp' : format,
    });
  });

  return { images, unbacked: [IMAGE_SIZE_UNBACKED] };
}

/* ------------------------------------------------------------------- links */

/**
 * How many of a page's links are actually fetched. Everything past this is
 * recorded UNCHECKED - statusCode null, isBroken null - never as healthy.
 */
export const CHECKED_LINK_LIMIT = 20;

export interface PlannedLink {
  targetUrl: string;
  anchorText: string;
  linkType: 'internal' | 'external';
  isNoFollow: boolean;
  isNoOpener: boolean;
  linkValue: number;
  /** Whether this link is within the fetch budget. */
  shouldCheck: boolean;
}

/**
 * Resolve, classify and budget a page's links. The FETCHING belongs to the
 * caller, because the two hosts guard an outbound request differently - the
 * edge function has to route these through safeFetch, since every one of these
 * URLs comes out of a document somebody else controls (SEC-002).
 */
export function planLinkChecks(
  facts: PageFacts,
  sourceUrl: string,
  limit: number = CHECKED_LINK_LIMIT,
): PlannedLink[] {
  let sourceHost: string;
  try {
    sourceHost = new URL(sourceUrl).hostname;
  } catch {
    return [];
  }

  const planned: PlannedLink[] = [];

  for (const link of facts.links) {
    const href = link.href?.trim();
    if (!href || href.startsWith('#') || /^javascript:/i.test(href)) continue;
    if (/^(mailto|tel|sms):/i.test(href)) continue;

    let targetUrl: string;
    let targetHost: string;
    try {
      const resolved = new URL(href, sourceUrl);
      targetUrl = resolved.href;
      targetHost = resolved.hostname;
    } catch {
      continue;
    }

    const rel = link.rel?.toLowerCase() ?? '';
    const isNoFollow = rel.includes('nofollow');
    const linkType: 'internal' | 'external' = sourceHost === targetHost ? 'internal' : 'external';

    planned.push({
      targetUrl,
      anchorText: link.text.trim(),
      linkType,
      isNoFollow,
      isNoOpener: rel.includes('noopener'),
      linkValue: isNoFollow ? 20 : linkType === 'internal' ? 80 : 60,
      // The budget counts PLANNED links, so a page opening with twenty anchors
      // to #sections does not spend the whole allowance on things it skips.
      shouldCheck: planned.length < limit,
    });
  }

  return planned;
}

/* ------------------------------------------------------------------ mobile */

export interface MobileFriendliness {
  isMobileFriendly: boolean;
  /** Over the two things a parser can settle; null is never returned. */
  mobileScore: number;
  scoreCovers: string[];
  hasViewportMeta: boolean;
  viewportContent: string | null;
  scalesToDevice: boolean;
  blocksZoom: boolean;
  hasFlashContent: boolean;
  /** Not measurable from markup. Null, never 0 and never true. */
  hasTouchFriendlyElements: null;
  hasReadableText: null;
  mobileLoadTime: null;
  mobileFcp: null;
  mobileLcp: null;
  issues: string[];
  unbacked: string[];
}

export const MOBILE_UNBACKED = [
  'Text size is not measured: a parser reads markup, not the stylesheets that set font sizes, so no count of small text is available from this check.',
  'Tap-target size and spacing are not measured; they depend on rendered layout.',
  'Mobile load time, FCP and LCP come from the Core Web Vitals check, which uses the PageSpeed API - they are not measured here.',
];

export function evaluateMobileFriendliness(facts: PageFacts): MobileFriendliness {
  const viewportContent = facts.viewport;
  const hasViewportMeta = viewportContent !== null;
  const viewport = (viewportContent ?? '').toLowerCase();

  const scalesToDevice = /width\s*=\s*device-width/.test(viewport);
  // Either of these stops a reader enlarging the text, which fails WCAG 1.4.4
  // and is the commonest real mobile defect after a missing viewport.
  const blocksZoom =
    /user-scalable\s*=\s*(no|0)/.test(viewport) || /maximum-scale\s*=\s*1(\.0+)?\b/.test(viewport);

  const hasFlashContent = facts.flashElements > 0;

  const issues: string[] = [];
  if (!hasViewportMeta) issues.push('Missing viewport meta tag');
  else if (!scalesToDevice) issues.push('Viewport does not set width=device-width');
  if (blocksZoom) issues.push('Viewport prevents the reader from zooming');
  if (hasFlashContent) issues.push('Uses Flash content');

  return {
    isMobileFriendly: issues.length === 0,
    mobileScore: Math.max(0, 100 - issues.length * 25),
    scoreCovers: ['viewport meta tag', 'zoom restrictions', 'Flash content'],
    hasViewportMeta,
    viewportContent,
    scalesToDevice,
    blocksZoom,
    hasFlashContent,
    hasTouchFriendlyElements: null,
    hasReadableText: null,
    mobileLoadTime: null,
    mobileFcp: null,
    mobileLcp: null,
    issues,
    unbacked: [...MOBILE_UNBACKED],
  };
}

/* --------------------------------------------------------- structured data */

export interface SchemaValidationError {
  property: string;
  message: string;
}

export interface SchemaValidation {
  schemaType: string;
  schemaFormat: 'json-ld';
  schemaData: Record<string, unknown>;
  isValid: boolean;
  validationErrors?: SchemaValidationError[];
  validationWarnings?: string[];
}

export interface StructuredDataResult {
  schemas: SchemaValidation[];
  unbacked: string[];
}

export const RICH_RESULTS_UNBACKED =
  'Rich-result eligibility is not evaluated: that depends on the required properties of each specific schema type, and this check only verifies that @context and @type are present and the JSON parses.';

export const MICRODATA_UNBACKED =
  'Only JSON-LD is read. Microdata and RDFa markup on the page is not inspected.';

/** Pull the schema objects out of one script block's parsed JSON. */
function schemaObjects(parsed: unknown): Record<string, unknown>[] {
  // Three shapes are all valid and only the first was handled: a single
  // object, a top-level array of them, and one envelope carrying @graph.
  // An @graph document reported "Missing @type" on markup that is correct.
  if (Array.isArray(parsed)) {
    return parsed.filter((v): v is Record<string, unknown> => !!v && typeof v === 'object');
  }
  if (!parsed || typeof parsed !== 'object') return [];

  const obj = parsed as Record<string, unknown>;
  const graph = obj['@graph'];
  if (Array.isArray(graph)) {
    const context = obj['@context'];
    return (
      graph
        .filter((v): v is Record<string, unknown> => !!v && typeof v === 'object')
        // An @graph member inherits the envelope's @context, so carrying it down
        // is what stops every member reporting a missing context.
        .map((node) =>
          context !== undefined && node['@context'] === undefined
            ? { '@context': context, ...node }
            : node,
        )
    );
  }
  return [obj];
}

function typeLabel(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const first = value.find((v) => typeof v === 'string' && v.trim());
    return typeof first === 'string' ? first.trim() : null;
  }
  return null;
}

export function validateJsonLdBlocks(blocks: string[]): StructuredDataResult {
  const schemas: SchemaValidation[] = [];

  for (const raw of blocks) {
    const text = (raw ?? '').trim();

    if (!text) {
      schemas.push({
        schemaType: 'Invalid',
        schemaFormat: 'json-ld',
        schemaData: {},
        isValid: false,
        validationErrors: [{ property: 'json', message: 'Empty JSON-LD block' }],
      });
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      schemas.push({
        schemaType: 'Invalid',
        schemaFormat: 'json-ld',
        schemaData: {},
        isValid: false,
        validationErrors: [{ property: 'json', message: 'Invalid JSON syntax' }],
      });
      continue;
    }

    const objects = schemaObjects(parsed);

    if (objects.length === 0) {
      schemas.push({
        schemaType: 'Invalid',
        schemaFormat: 'json-ld',
        schemaData: {},
        isValid: false,
        validationErrors: [
          { property: 'json', message: 'JSON-LD block does not contain a schema object' },
        ],
      });
      continue;
    }

    for (const node of objects) {
      const validationErrors: SchemaValidationError[] = [];
      if (node['@context'] === undefined) {
        validationErrors.push({ property: '@context', message: 'Missing @context property' });
      }
      const schemaType = typeLabel(node['@type']);
      if (!schemaType) {
        validationErrors.push({ property: '@type', message: 'Missing @type property' });
      }

      schemas.push({
        schemaType: schemaType ?? 'Unknown',
        schemaFormat: 'json-ld',
        schemaData: node,
        isValid: validationErrors.length === 0,
        validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
      });
    }
  }

  return { schemas, unbacked: [RICH_RESULTS_UNBACKED, MICRODATA_UNBACKED] };
}
