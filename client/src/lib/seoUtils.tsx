import { useEffect } from 'react';

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

/**
 * Track content view for analytics
 */
export async function trackContentView(params: {
  contentType: 'blog_post' | 'guide' | 'case_study' | 'landing_page';
  contentId: string;
  source?: string;
  medium?: string;
  campaign?: string;
}) {
  try {
    // Get device info
    const device = /mobile|tablet|android|ios|iphone|ipad/i.test(navigator.userAgent)
      ? 'mobile'
      : 'desktop';

    // Get browser info
    const browser = navigator.userAgent.match(/(chrome|firefox|safari|edge)/i)?.[0]?.toLowerCase() || 'other';

    // Check if from AI platform
    const referrer = document.referrer.toLowerCase();
    let isAiReferral = false;
    let aiPlatform = null;

    if (referrer.includes('chat.openai.com')) {
      isAiReferral = true;
      aiPlatform = 'chatgpt';
    } else if (referrer.includes('perplexity.ai')) {
      isAiReferral = true;
      aiPlatform = 'perplexity';
    } else if (referrer.includes('claude.ai')) {
      isAiReferral = true;
      aiPlatform = 'claude';
    } else if (referrer.includes('google.com') && referrer.includes('ai')) {
      isAiReferral = true;
      aiPlatform = 'google_ai';
    }

    await fetch('/api/content/analytics/view', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...params,
        device,
        browser,
        isAiReferral,
        aiPlatform,
      }),
    });
  } catch (error) {
    console.error('Failed to track content view:', error);
  }
}

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
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
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
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
