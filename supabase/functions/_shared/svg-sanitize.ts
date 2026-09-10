// SVG upload sanitisation.
//
// An SVG is an XML DOCUMENT, not an image format. Served from a public bucket
// with contentType image/svg+xml, opening its URL directly executes any script
// it carries, in the storage origin. branding-profiles allow-listed
// image/svg+xml into a bucket it creates with `public: true`, so any
// authenticated user who could edit a branding profile could upload a logo
// containing <script> and get back a working URL - and that URL is rendered in
// proposals and PDFs that go to customers.
//
// A browser does NOT run scripts in an SVG loaded through <img>, which is why
// this never showed up in the app. Direct navigation is a different matter, and
// so is any place the file is inlined.
//
// This strips the executable surface rather than dropping SVG support: logos
// are the one place vector really earns its keep. It is deliberately
// conservative - anything it cannot confidently make safe, it rejects.

/** Elements that can execute or embed arbitrary content. */
const FORBIDDEN_ELEMENTS = [
  'script',
  'foreignObject',
  'iframe',
  'embed',
  'object',
  'audio',
  'video',
  'set',
  'animate',
  'handler',
];

/**
 * Attribute values that can carry a URL to a script. ANCHORED, because it
 * tests a whole attribute value: an unanchored version would reject
 * `href="/logos/my-javascript:thing.png"`.
 */
const DANGEROUS_URL = /^\s*(?:javascript|vbscript|data)\s*:/i;

/**
 * The same schemes ANYWHERE in a block of text. Needed because a <style> body
 * or a whole document is not an attribute value - the anchored form above
 * silently matches nothing there, which is exactly the false negative the tests
 * caught on the first cut of this file.
 */
const DANGEROUS_URL_ANYWHERE = /(?:javascript|vbscript)\s*:/i;

export interface SvgSanitizeResult {
  ok: boolean;
  /** The cleaned document, when ok. */
  svg?: string;
  /** Why it was rejected, when not ok. */
  reason?: string;
  /** What was stripped, for the audit trail. */
  removed: string[];
}

/**
 * Remove the executable surface from an SVG document.
 *
 * Regex rather than a DOM parser because Deno's edge runtime has no DOMParser
 * and pulling one in for a logo upload is not worth the dependency. That is why
 * the rules are subtractive and the checks are repeated until the document
 * stops changing: a single pass can leave a nested construct behind.
 */
export function sanitizeSvg(source: string): SvgSanitizeResult {
  const removed: string[] = [];

  if (!/<svg[\s>]/i.test(source)) {
    return { ok: false, reason: 'Not an SVG document', removed };
  }

  let svg = source;
  let previous: string;
  let passes = 0;
  do {
    previous = svg;

    // Whole elements, with or without a closing tag.
    for (const tag of FORBIDDEN_ELEMENTS) {
      const paired = new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, 'gi');
      const selfClosing = new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi');
      if (paired.test(svg) || selfClosing.test(svg)) removed.push(tag);
      svg = svg.replace(paired, '').replace(selfClosing, '');
    }

    // Inline event handlers: on* attributes, quoted or bare.
    svg = svg.replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, (m) => {
      removed.push(m.trim().split(/\s*=/)[0]);
      return '';
    });

    // href / xlink:href / src carrying a script URL.
    svg = svg.replace(
      /\s(?:xlink:)?(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
      (match, dq, sq, bare) => {
        const value = dq ?? sq ?? bare ?? '';
        if (DANGEROUS_URL.test(value)) {
          removed.push('href:script-url');
          return '';
        }
        return match;
      },
    );

    // <style> can carry url(javascript:...) and behaviour bindings.
    svg = svg.replace(/<style\b[\s\S]*?<\/style\s*>/gi, (m) => {
      if (DANGEROUS_URL_ANYWHERE.test(m) || /expression\s*\(|@import/i.test(m)) {
        removed.push('style');
        return '';
      }
      return m;
    });

    passes++;
  } while (svg !== previous && passes < 5);

  // If five passes did not reach a fixed point the document is fighting back;
  // reject rather than ship something half-cleaned.
  if (svg !== previous) {
    return { ok: false, reason: 'SVG could not be sanitised', removed };
  }

  // Belt and braces: nothing executable may survive.
  if (/<script\b/i.test(svg) || /\son[a-z]+\s*=/i.test(svg) || DANGEROUS_URL_ANYWHERE.test(svg)) {
    return { ok: false, reason: 'SVG contains active content that could not be removed', removed };
  }

  return { ok: true, svg, removed: [...new Set(removed)] };
}
