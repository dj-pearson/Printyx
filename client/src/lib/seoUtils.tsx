import { useEffect } from 'react';

/**
 * Serialize an object for embedding in a <script type="application/ld+json">
 * block. Escapes `<`, `>`, `&` and the JS line separators so a value containing
 * `</script>` (or U+2028/U+2029) cannot break out of the script element (XSS).
 * See CR-014.
 */
export function jsonLdStringify(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * Enhanced SEO hook for setting meta tags dynamically
 */
export function usePageSeo(params: {
  title: string;
  description: string;
  keywords?: string[];
  ogImage?: string;
  ogType?: string;
  canonicalUrl?: string;
  noindex?: boolean;
  schema?: Record<string, any>;
}) {
  useEffect(() => {
    // Set title
    document.title = params.title;

    // Helper to set meta tag
    const setMeta = (name: string, content: string) => {
      if (!content) return;
      let tag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('name', name);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    };

    // Helper to set property tag
    const setProperty = (property: string, content: string) => {
      if (!content) return;
      let tag = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('property', property);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    };

    // Set description
    setMeta('description', params.description);

    // Set keywords
    if (params.keywords && params.keywords.length > 0) {
      setMeta('keywords', params.keywords.join(', '));
    }

    // Open Graph tags
    setProperty('og:title', params.title);
    setProperty('og:description', params.description);
    setProperty('og:type', params.ogType || 'website');

    if (params.canonicalUrl) {
      setProperty('og:url', params.canonicalUrl);
    }

    if (params.ogImage) {
      setProperty('og:image', params.ogImage);
    }

    // Twitter Card tags
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', params.title);
    setMeta('twitter:description', params.description);

    if (params.ogImage) {
      setMeta('twitter:image', params.ogImage);
    }

    // Canonical URL
    if (params.canonicalUrl) {
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
      }
      link.setAttribute('href', params.canonicalUrl);
    }

    // Robots
    if (params.noindex) {
      setMeta('robots', 'noindex, nofollow');
    } else {
      setMeta('robots', 'index, follow');
    }

    // Schema markup
    if (params.schema) {
      const scriptId = 'page-schema-markup';
      let script = document.getElementById(scriptId) as HTMLScriptElement;
      if (!script) {
        script = document.createElement('script');
        script.id = scriptId;
        script.type = 'application/ld+json';
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(params.schema);
    }

    // Cleanup function
    return () => {
      // Remove schema on unmount
      const script = document.getElementById('page-schema-markup');
      if (script) {
        script.remove();
      }
    };
  }, [
    params.title,
    params.description,
    params.keywords,
    params.ogImage,
    params.ogType,
    params.canonicalUrl,
    params.noindex,
    params.schema,
  ]);
}

/**
 * Calculate estimated reading time
 */
export function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const words = content.trim().split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
}

/**
 * Format date for display
 */
export function formatPublishDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Generate excerpt from content
 */
export function generateExcerpt(content: string, maxLength: number = 160): string {
  // Strip HTML tags if present
  const text = content.replace(/<[^>]*>/g, '');

  if (text.length <= maxLength) {
    return text;
  }

  // Cut at last complete word before maxLength
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  return truncated.substring(0, lastSpace) + '...';
}

/**
 * Slugify text for URLs
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Content-view analytics beacon: REMOVED (PROD-013).
//
// The exported function was never called. A repo-wide search for the name
// returned its own definition and one re-export in lib/seo/index.ts, nothing
// else. route-parity counted the marketing-content domain as a live prod 404
// because this module is reachable from App.tsx through SEOProvider, which is
// true of the file and false of the function.
//
// It would not have worked if it had been called. Three independent reasons:
// the request used a raw relative fetch, so in production it targeted the
// Cloudflare Pages origin rather than the functions host and never reached a
// backend; the receiving handler is Express-only, so that host would have
// 404'd anyway; and content_analytics.content_id is uuid NOT NULL while every
// blog page under pages/blog/ is a static React file identified by a slug with
// no database row and therefore no uuid to send.
//
// Wiring it up is a real piece of work, not a call-site fix: it needs the
// marketing-content endpoints on the edge side and a decision about how a
// static page identifies itself to a uuid column. Deleting the unused export
// is the honest state until someone wants the metric.

/**
 * Component to render FAQ schema in the page
 */
export function FAQSchemaScript({ faqs }: { faqs: Array<{ question: string; answer: string }> }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdStringify(schema) }}
    />
  );
}

/**
 * Component to render breadcrumb schema
 */
export function BreadcrumbSchemaScript({
  breadcrumbs,
}: {
  breadcrumbs: Array<{ name: string; url?: string }>;
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      ...(crumb.url && { item: crumb.url }),
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdStringify(schema) }}
    />
  );
}
