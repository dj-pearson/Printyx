// On-page SEO scoring engine (US-BLOG-033)
//
// Pure, dependency-free. Given the post fields available in the editor plus a
// target keyword, returns a 0-100 score and a per-check breakdown. The editor
// renders this live; nothing here touches the network or the DB.
//
// Checks that genuinely require a network round-trip (broken-link crawl) or a
// feature not yet built (JSON-LD schema — US-BLOG-027, OG image — no field
// yet) are returned with status 'na' and an explanation rather than silently
// dropped, so the checklist stays honest about what it can and can't verify.

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'na';

export interface SeoCheck {
  id: string;
  label: string;
  status: CheckStatus;
  /** Short, specific result ("Title is 72 chars — aim for 50-60"). */
  detail: string;
  /** Why this matters — surfaced on hover. */
  why: string;
}

export interface SeoScoreInput {
  title: string;
  slug: string;
  bodyMarkdown: string;
  bodyHtml: string;
  metaTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  targetKeyword: string;
  /**
   * Optional JSON-LD validation result (US-BLOG-027). When supplied, the
   * "Schema markup valid" check becomes a real pass/warn/fail instead of 'na'.
   */
  schema?: { errors: number; warnings: number };
}

export interface SeoScoreResult {
  /** 0-100, computed only over checks that are pass/warn/fail (na excluded). */
  score: number;
  checks: SeoCheck[];
  passCount: number;
  warnCount: number;
  failCount: number;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ') // fenced code
    .replace(/`[^`]*`/g, ' ') // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links → anchor text
    .replace(/[#>*_~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Extract image tags from markdown + html: { alt, hasAlt }. */
function extractImages(md: string, html: string): Array<{ hasAlt: boolean }> {
  const images: Array<{ hasAlt: boolean }> = [];
  const mdImg = /!\[([^\]]*)\]\([^)]+\)/g;
  let m: RegExpExecArray | null;
  while ((m = mdImg.exec(md))) images.push({ hasAlt: m[1].trim().length > 0 });
  const htmlImg = /<img\b[^>]*>/gi;
  while ((m = htmlImg.exec(html))) {
    const altMatch = /\balt\s*=\s*["']([^"']*)["']/i.exec(m[0]);
    images.push({ hasAlt: !!altMatch && altMatch[1].trim().length > 0 });
  }
  return images;
}

/** Pull every href from markdown + html. */
function extractLinks(md: string, html: string): string[] {
  const links: string[] = [];
  const mdLink = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let m: RegExpExecArray | null;
  while ((m = mdLink.exec(md))) links.push(m[1]);
  const htmlHref = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi;
  while ((m = htmlHref.exec(html))) links.push(m[1]);
  return links;
}

function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function isInternal(href: string): boolean {
  // Relative paths, anchors, or root-relative — treated as same-site.
  return !isExternal(href) && !href.startsWith('mailto:') && !href.startsWith('tel:');
}

/** Count top-level `# ` H1 headings in markdown. */
function countMarkdownH1(md: string): number {
  return (md.match(/^#\s+\S/gm) || []).length;
}

export function computeSeoScore(input: SeoScoreInput): SeoScoreResult {
  const checks: SeoCheck[] = [];
  const kw = normalize(input.targetKeyword);
  const hasKw = kw.length > 0;
  const effectiveTitle = (input.metaTitle || input.title).trim();
  const plain = stripMarkdown(input.bodyMarkdown);
  const plainLower = normalize(plain);
  const words = wordCount(plain);

  const kwCheck = (
    id: string,
    label: string,
    present: boolean,
    where: string,
    why: string,
  ): void => {
    checks.push({
      id,
      label,
      status: !hasKw ? 'na' : present ? 'pass' : 'fail',
      detail: !hasKw
        ? 'Set a target keyword to enable this check.'
        : present
          ? `Found in ${where}.`
          : `Not found in ${where}.`,
      why,
    });
  };

  kwCheck(
    'kw-title',
    'Keyword in title',
    hasKw && normalize(input.title).includes(kw),
    'the post title',
    'The title is the strongest on-page relevance signal and the clickable SERP headline.',
  );

  // The rendered page H1 is the post title. An explicit markdown `# H1` also counts.
  const mdH1s = (input.bodyMarkdown.match(/^#\s+(.+)$/gm) || []).map((h) =>
    normalize(h.replace(/^#\s+/, '')),
  );
  const h1HasKw =
    (hasKw && normalize(input.title).includes(kw)) || mdH1s.some((h) => h.includes(kw));
  kwCheck(
    'kw-h1',
    'Keyword in H1',
    h1HasKw,
    'the H1 (post title)',
    'Google weights the H1 heavily for topical relevance.',
  );

  const first100 = plainLower.split(/\s+/).slice(0, 100).join(' ');
  kwCheck(
    'kw-first-100',
    'Keyword in first 100 words',
    hasKw && first100.includes(kw),
    'the first 100 words',
    'Early keyword placement confirms the page topic to crawlers and readers above the fold.',
  );

  kwCheck(
    'kw-slug',
    'Keyword in URL slug',
    hasKw && input.slug.toLowerCase().replace(/-/g, ' ').includes(kw),
    'the URL slug',
    'A descriptive, keyword-bearing slug improves CTR and is a minor ranking factor.',
  );

  // Keyword density — non-dogmatic per the PRD note: only flag the extremes.
  if (!hasKw) {
    checks.push({
      id: 'kw-density',
      label: 'Keyword density',
      status: 'na',
      detail: 'Set a target keyword to enable this check.',
      why: 'Extreme density (stuffing or total absence) is a quality signal; the healthy band is wide.',
    });
  } else {
    const kwWords = kw.split(' ').length;
    const occurrences =
      words > 0 ? (plainLower.match(new RegExp(escapeRegExp(kw), 'g')) || []).length : 0;
    const density = words > 0 ? (occurrences * kwWords * 100) / words : 0;
    let status: CheckStatus = 'pass';
    let detail = `~${density.toFixed(2)}% (${occurrences} use(s) in ${words} words).`;
    if (words === 0) {
      status = 'warn';
      detail = 'No body content yet.';
    } else if (occurrences === 0 || density > 3) {
      status = 'fail';
      detail =
        occurrences === 0
          ? 'Keyword never appears in the body.'
          : `${detail} Over 3% — looks stuffed.`;
    } else if (density < 0.3) {
      status = 'warn';
      detail = `${detail} Under 0.3% — consider using it a little more naturally.`;
    }
    checks.push({
      id: 'kw-density',
      label: 'Keyword density',
      status,
      detail,
      why: 'Only the extremes (>3% stuffing or 0% absence) hurt — the middle is fine.',
    });
  }

  // Title length (use the meta title if set, else the post title).
  const titleLen = effectiveTitle.length;
  checks.push({
    id: 'title-length',
    label: 'Title length 50-60',
    status: titleLen === 0 ? 'fail' : titleLen >= 50 && titleLen <= 60 ? 'pass' : 'warn',
    detail:
      titleLen === 0
        ? 'No title set.'
        : `${titleLen} chars${titleLen > 60 ? ' — Google will truncate it.' : titleLen < 50 ? ' — room for more keywords.' : '.'}`,
    why: 'Titles over ~60 chars get truncated in the SERP, weakening the headline.',
  });

  // Meta description length.
  const mdLen = input.metaDescription.trim().length;
  checks.push({
    id: 'meta-desc-length',
    label: 'Meta description 140-160',
    status: mdLen === 0 ? 'fail' : mdLen >= 140 && mdLen <= 160 ? 'pass' : 'warn',
    detail:
      mdLen === 0
        ? 'No meta description — Google will auto-generate one.'
        : `${mdLen} chars${mdLen > 160 ? ' — will be truncated.' : mdLen < 140 ? ' — under-using the snippet.' : '.'}`,
    why: 'A tuned 140-160 char description maximizes snippet real estate and CTR.',
  });

  // H1 uniqueness — the layout renders one H1 (the title). Extra `# ` in body = duplicate H1s.
  const extraH1 = countMarkdownH1(input.bodyMarkdown);
  checks.push({
    id: 'h1-unique',
    label: 'Single H1',
    status: extraH1 === 0 ? 'pass' : 'fail',
    detail:
      extraH1 === 0
        ? 'One H1 (the post title); body uses ## and below.'
        : `Body contains ${extraH1} extra '# ' H1(s) — demote them to ## so the page has exactly one H1.`,
    why: 'Multiple H1s dilute the page topic and confuse assistive tech and crawlers.',
  });

  // Image alt text.
  const images = extractImages(input.bodyMarkdown, input.bodyHtml);
  const missingAlt = images.filter((i) => !i.hasAlt).length;
  checks.push({
    id: 'img-alt',
    label: 'Alt text on every image',
    status: images.length === 0 ? 'na' : missingAlt === 0 ? 'pass' : 'fail',
    detail:
      images.length === 0
        ? 'No images in the post.'
        : missingAlt === 0
          ? `All ${images.length} image(s) have alt text.`
          : `${missingAlt} of ${images.length} image(s) missing alt text.`,
    why: 'Alt text is required for accessibility and is how images rank in image search.',
  });

  // Links.
  const links = extractLinks(input.bodyMarkdown, input.bodyHtml);
  const internal = links.filter(isInternal).length;
  const external = links.filter(isExternal).length;
  checks.push({
    id: 'internal-link',
    label: '≥1 internal link',
    status: internal >= 1 ? 'pass' : 'warn',
    detail:
      internal >= 1 ? `${internal} internal link(s).` : 'No internal links — add at least one.',
    why: 'Internal links spread authority and keep readers on site.',
  });
  checks.push({
    id: 'external-link',
    label: '≥1 external link',
    status: external >= 1 ? 'pass' : 'warn',
    detail:
      external >= 1
        ? `${external} external link(s).`
        : 'No outbound links — cite at least one source.',
    why: 'Linking to authoritative sources is a trust/E-E-A-T signal.',
  });

  // Canonical.
  const canonical = input.canonicalUrl.trim();
  checks.push({
    id: 'canonical',
    label: 'Canonical URL set',
    status: canonical ? (/^https?:\/\//i.test(canonical) ? 'pass' : 'warn') : 'warn',
    detail: canonical
      ? /^https?:\/\//i.test(canonical)
        ? 'Canonical set.'
        : 'Canonical is not an absolute URL.'
      : 'No canonical set — defaults to the post URL (usually fine).',
    why: 'An explicit canonical prevents duplicate-content dilution for syndicated posts.',
  });

  // Honest "na" checks — verifiable only with capabilities we don't have here.
  checks.push({
    id: 'links-not-broken',
    label: 'All links reachable',
    status: 'na',
    detail:
      'Link-health crawl runs server-side, not in the editor (cross-origin blocked in-browser).',
    why: 'Broken links waste crawl budget and frustrate readers — checked at publish time.',
  });
  if (input.schema) {
    const { errors, warnings } = input.schema;
    checks.push({
      id: 'schema-valid',
      label: 'Schema markup valid',
      status: errors > 0 ? 'fail' : warnings > 0 ? 'warn' : 'pass',
      detail:
        errors > 0
          ? `${errors} JSON-LD error(s) — see the Structured data panel.`
          : warnings > 0
            ? `Valid, with ${warnings} warning(s).`
            : 'Valid JSON-LD will be emitted.',
      why: 'Valid schema makes the post eligible for rich results and AI Overviews.',
    });
  } else {
    checks.push({
      id: 'schema-valid',
      label: 'Schema markup valid',
      status: 'na',
      detail: 'Set a schema type in the Structured data panel to enable this check.',
      why: 'Valid schema makes the post eligible for rich results and AI Overviews.',
    });
  }
  checks.push({
    id: 'og-image',
    label: 'OG image set',
    status: 'na',
    detail: 'No OG image field on posts yet.',
    why: 'A social share image lifts CTR on social and chat platforms.',
  });

  const scored = checks.filter((c) => c.status !== 'na');
  const passCount = scored.filter((c) => c.status === 'pass').length;
  const warnCount = scored.filter((c) => c.status === 'warn').length;
  const failCount = scored.filter((c) => c.status === 'fail').length;
  // pass = 1.0, warn = 0.5, fail = 0.
  const raw = passCount * 1 + warnCount * 0.5;
  const score = scored.length === 0 ? 0 : Math.round((raw / scored.length) * 100);

  return { score, checks, passCount, warnCount, failCount };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
