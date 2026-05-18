// JSON-LD schema markup planner + generator + validator (US-BLOG-027)
//
// Pure, dependency-free. Builds the structured data a post will emit from the
// post fields + the workspace Organization data, auto-derives FAQPage / HowTo
// from the body, and validates required fields so the editor can block publish
// on errors (warnings are allowed).
//
// Deliberately does NOT fabricate aggregateRating, review, or other reviewable
// signals — Google penalizes faked rich-result markup (per the PRD note).

export const SCHEMA_TYPES = [
  'Article',
  'BlogPosting',
  'NewsArticle',
  'HowTo',
  'Recipe',
  'Review',
  'Product',
  'FAQPage',
  'Event',
] as const;

export type SchemaType = (typeof SCHEMA_TYPES)[number];

export interface SchemaPostInput {
  title: string;
  slug: string;
  excerpt: string;
  bodyMarkdown: string;
  bodyHtml: string;
  metaDescription: string;
  canonicalUrl: string;
  /** NULL is treated as 'BlogPosting'. */
  schemaType: SchemaType | null;
  publishedAt: string | null;
  updatedAt: string | null;
  authorName?: string | null;
}

export interface OrgInfo {
  name: string;
  url: string;
  logoUrl: string;
}

export interface JsonLdResult {
  /** The exact array of JSON-LD objects the page will emit. */
  graph: Record<string, unknown>[];
  errors: string[];
  warnings: string[];
  /** True when an FAQPage block was auto-derived from the body. */
  faqDetected: boolean;
  /** True when a HowTo block was auto-derived from the body. */
  howToDetected: boolean;
}

function firstBodyImage(md: string, html: string): string | null {
  const m = /!\[[^\]]*\]\(([^)\s]+)/.exec(md);
  if (m) return m[1];
  const h = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i.exec(html);
  return h ? h[1] : null;
}

function resolveUrl(input: SchemaPostInput, org: OrgInfo): string {
  const canonical = input.canonicalUrl.trim();
  if (/^https?:\/\//i.test(canonical)) return canonical;
  const base = org.url.trim().replace(/\/+$/, '');
  if (base) return `${base}/${input.slug}`.replace(/([^:])\/{2,}/g, '$1/');
  return `/${input.slug}`;
}

interface QA {
  q: string;
  a: string;
}

/**
 * Detect FAQ pairs. Conservative: a heading line (## or ###) that ends with
 * '?' becomes a question; everything until the next heading is the answer.
 * Requires ≥2 pairs to emit (one stray question isn't an FAQ section).
 */
function detectFaq(md: string): QA[] {
  const lines = md.split('\n');
  const pairs: QA[] = [];
  let current: { q: string; a: string[] } | null = null;
  for (const line of lines) {
    const heading = /^#{2,4}\s+(.*\S)\s*$/.exec(line);
    if (heading) {
      if (current) {
        const ans = current.a.join(' ').trim();
        if (ans) pairs.push({ q: current.q, a: ans });
        current = null;
      }
      const text = heading[1].trim();
      if (text.endsWith('?')) current = { q: text, a: [] };
      continue;
    }
    if (current) current.a.push(line.replace(/[#>*_`~]/g, '').trim());
  }
  if (current) {
    const ans = current.a.join(' ').trim();
    if (ans) pairs.push({ q: current.q, a: ans });
  }
  return pairs.length >= 2 ? pairs : [];
}

interface Step {
  text: string;
  image: string | null;
}

/**
 * Detect an ordered how-to: numbered list items (`1. ...`). Each item's
 * trailing image (markdown) is captured. Requires ≥2 steps.
 */
function detectSteps(md: string): Step[] {
  const steps: Step[] = [];
  const re = /^\s*\d+[.)]\s+(.*\S)\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) {
    const raw = m[1];
    const img = /!\[[^\]]*\]\(([^)\s]+)/.exec(raw);
    const text = raw
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/[#*_`~]/g, '')
      .trim();
    if (text) steps.push({ text, image: img ? img[1] : null });
  }
  return steps.length >= 2 ? steps : [];
}

function buildPublisher(org: OrgInfo): Record<string, unknown> | null {
  if (!org.name.trim()) return null;
  const pub: Record<string, unknown> = { '@type': 'Organization', name: org.name.trim() };
  if (org.url.trim()) pub.url = org.url.trim();
  if (org.logoUrl.trim()) {
    pub.logo = { '@type': 'ImageObject', url: org.logoUrl.trim() };
  }
  return pub;
}

export function buildJsonLd(input: SchemaPostInput, org: OrgInfo): JsonLdResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const graph: Record<string, unknown>[] = [];

  const type: SchemaType = input.schemaType ?? 'BlogPosting';
  const url = resolveUrl(input, org);
  const headline = input.title.trim();
  const description = (input.metaDescription || input.excerpt).trim();
  const image = firstBodyImage(input.bodyMarkdown, input.bodyHtml);
  const publisher = buildPublisher(org);

  if (!headline) errors.push('Title is required for any schema type.');
  if (!description) {
    warnings.push('No meta description or excerpt — schema "description" will be omitted.');
  }
  if (!publisher) {
    warnings.push(
      'Workspace Organization name is not set (Blog Settings) — publisher will be omitted.',
    );
  }

  const faqPairs = detectFaq(input.bodyMarkdown);
  const steps = detectSteps(input.bodyMarkdown);

  // ---- Primary object ------------------------------------------------------
  if (type === 'FAQPage') {
    if (faqPairs.length === 0) {
      errors.push(
        'Schema type is FAQPage but no Q/A pairs were detected. Use "### Question?" headings followed by the answer.',
      );
    } else {
      graph.push({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        url,
        mainEntity: faqPairs.map((p) => ({
          '@type': 'Question',
          name: p.q,
          acceptedAnswer: { '@type': 'Answer', text: p.a },
        })),
      });
    }
  } else if (type === 'HowTo') {
    if (steps.length < 2) {
      errors.push(
        'Schema type is HowTo but fewer than 2 numbered steps were detected. Use a "1. … 2. …" list.',
      );
    } else {
      graph.push({
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: headline,
        ...(description ? { description } : {}),
        ...(image ? { image } : {}),
        step: steps.map((s, i) => ({
          '@type': 'HowToStep',
          position: i + 1,
          text: s.text,
          ...(s.image ? { image: s.image } : {}),
        })),
      });
    }
  } else if (type === 'Article' || type === 'BlogPosting' || type === 'NewsArticle') {
    const obj: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': type,
      headline,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      url,
    };
    if (description) obj.description = description;
    if (image) obj.image = image;
    else
      warnings.push(
        'No image found in the post — articles with an image are favored for rich results.',
      );
    if (input.publishedAt) obj.datePublished = input.publishedAt;
    else warnings.push('Post is not published yet — datePublished will be set on publish.');
    if (input.updatedAt) obj.dateModified = input.updatedAt;
    const authorName = (input.authorName || org.name).trim();
    if (authorName) obj.author = { '@type': 'Person', name: authorName };
    else warnings.push('No author or Organization name — schema "author" will be omitted.');
    if (publisher) obj.publisher = publisher;
    graph.push(obj);
  } else {
    // Review / Product / Recipe / Event — supported as a selectable type but
    // their required fields (price, eventDate, ingredients, …) aren't modeled
    // from post fields yet. Emit a minimal honest object + a warning rather
    // than fabricating reviewable signals.
    const obj: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': type,
      name: headline,
      url,
    };
    if (description) obj.description = description;
    if (image) obj.image = image;
    graph.push(obj);
    warnings.push(
      `${type} schema is emitted with base fields only. Type-specific properties (e.g. price, eventDate, ingredients) aren't modeled from post fields yet — add them manually before relying on rich results.`,
    );
  }

  // ---- Auto-emitted secondary blocks --------------------------------------
  // FAQ blocks auto-emit FAQPage even when it isn't the primary type.
  if (type !== 'FAQPage' && faqPairs.length > 0) {
    graph.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqPairs.map((p) => ({
        '@type': 'Question',
        name: p.q,
        acceptedAnswer: { '@type': 'Answer', text: p.a },
      })),
    });
  }
  // HowTo blocks (steps that include images) auto-emit HowTo schema.
  const stepsWithImages = steps.filter((s) => s.image);
  if (type !== 'HowTo' && steps.length >= 2 && stepsWithImages.length >= 1) {
    graph.push({
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: headline,
      ...(image ? { image } : {}),
      step: steps.map((s, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        text: s.text,
        ...(s.image ? { image: s.image } : {}),
      })),
    });
  }

  return {
    graph,
    errors,
    warnings,
    faqDetected: faqPairs.length > 0,
    howToDetected: steps.length >= 2 && (type === 'HowTo' || stepsWithImages.length >= 1),
  };
}

/** Stable, pretty-printed string for the preview pane / page emission. */
export function jsonLdToScriptString(graph: Record<string, unknown>[]): string {
  if (graph.length === 0) return '';
  const payload = graph.length === 1 ? graph[0] : graph;
  return JSON.stringify(payload, null, 2);
}
