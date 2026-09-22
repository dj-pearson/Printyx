// Extract a PageFacts from HTML, Deno side.
//
// The Express half does the same with cheerio. Neither parser resolves on the
// other runtime, so the extraction is duplicated ON PURPOSE and every decision
// about what the facts MEAN lives once in shared/seo-page-facts.ts. Keep this
// file to attribute reads: the moment a judgement appears here, the two hosts
// can disagree about a page and nothing will say so.
//
// node-html-parser rather than a regex: an <img> inside a comment, an attribute
// carrying a '>' and a <script> holding markup all defeat a pattern, and this
// parser is already used by supabase/functions/proposals/_html-to-pdf.ts.
import { parse } from 'https://esm.sh/node-html-parser@6.1.13';
import type {
  HeadingFact,
  ImageFact,
  LinkFact,
  PageFacts,
} from '../../../shared/seo-page-facts.ts';

/** node-html-parser returns undefined for an absent attribute; we want null. */
function attr(el: { getAttribute: (name: string) => string | undefined }, name: string) {
  const value = el.getAttribute(name);
  return value === undefined ? null : value;
}

export function extractPageFacts(html: string): PageFacts {
  const root = parse(html, {
    // Script and style contents are kept as raw text, which is what the
    // JSON-LD read below needs.
    blockTextElements: { script: true, style: true, pre: true, noscript: false },
  });

  const images: ImageFact[] = root.querySelectorAll('img').map((el) => ({
    src: attr(el, 'src') ?? '',
    alt: attr(el, 'alt'),
    title: attr(el, 'title'),
    width: attr(el, 'width'),
    height: attr(el, 'height'),
    loading: attr(el, 'loading'),
  }));

  const links: LinkFact[] = root.querySelectorAll('a[href]').map((el) => ({
    href: attr(el, 'href') ?? '',
    text: el.text ?? '',
    rel: attr(el, 'rel'),
  }));

  const viewportEl = root.querySelector('meta[name="viewport"]');
  const viewport = viewportEl ? (attr(viewportEl, 'content') ?? '') : null;

  // An <object>/<embed> is Flash when its type says so or its data/src ends
  // .swf; the type attribute alone misses the commonest embed shape.
  const flashElements = root.querySelectorAll('object, embed').filter((el) => {
    const type = (attr(el, 'type') ?? '').toLowerCase();
    const source = ((attr(el, 'data') ?? '') + ' ' + (attr(el, 'src') ?? '')).toLowerCase();
    return type.includes('flash') || type.includes('shockwave') || source.includes('.swf');
  }).length;

  const jsonLdBlocks = root
    .querySelectorAll('script[type="application/ld+json"]')
    // rawText, not text: JSON-LD inside a script element is character data and
    // the HTML parser does not decode entities in it, so decoding here would
    // rewrite the customer's own strings.
    .map((el) => (el as unknown as { rawText?: string }).rawText ?? el.text ?? '');

  const titleEl = root.querySelector('title');
  const title = titleEl ? (titleEl.text ?? '') : null;

  const descEl = root.querySelector('meta[name="description"]');
  const metaDescription = descEl ? (attr(descEl, 'content') ?? '') : null;

  const canonicalEl = root.querySelector('link[rel="canonical"]');
  const canonical = canonicalEl ? (attr(canonicalEl, 'href') ?? '') : null;

  const robotsEl = root.querySelector('meta[name="robots"]');
  const robotsMeta = robotsEl ? (attr(robotsEl, 'content') ?? '') : null;

  const headings: HeadingFact[] = root
    .querySelectorAll('h1, h2, h3, h4, h5, h6')
    .map((el) => ({
      level: Number.parseInt(el.tagName.slice(1), 10),
      text: (el.text ?? '').replace(/\s+/g, ' ').trim(),
    }))
    .filter((h) => Number.isFinite(h.level));

  // Script, style and noscript are stripped before the text is read: the audit
  // used to count inline JavaScript as words.
  const body = root.querySelector('body') ?? root;
  for (const el of body.querySelectorAll('script, style, noscript')) el.remove();
  const bodyText = (body.text ?? '').replace(/\s+/g, ' ').trim();

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
