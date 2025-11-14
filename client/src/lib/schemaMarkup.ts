/**
 * Schema Markup Utilities for SEO/GEO Optimization
 * Generates structured data for various content types to improve visibility
 * in search engines and AI-powered search platforms
 */

export interface ArticleSchema {
  '@context': string;
  '@type': 'Article' | 'BlogPosting' | 'TechArticle' | 'NewsArticle';
  headline: string;
  image?: string | string[];
  datePublished?: string;
  dateModified?: string;
  author?: {
    '@type': 'Person' | 'Organization';
    name: string;
    url?: string;
  };
  publisher?: {
    '@type': 'Organization';
    name: string;
    logo?: {
      '@type': 'ImageObject';
      url: string;
    };
  };
  description?: string;
  mainEntityOfPage?: {
    '@type': 'WebPage';
    '@id': string;
  };
  wordCount?: number;
  keywords?: string[];
}

export interface FAQSchema {
  '@context': string;
  '@type': 'FAQPage';
  mainEntity: Array<{
    '@type': 'Question';
    name: string;
    acceptedAnswer: {
      '@type': 'Answer';
      text: string;
    };
  }>;
}

export interface HowToSchema {
  '@context': string;
  '@type': 'HowTo';
  name: string;
  description?: string;
  image?: string | string[];
  estimatedCost?: {
    '@type': 'MonetaryAmount';
    currency: string;
    value: string;
  };
  totalTime?: string; // ISO 8601 duration format
  step: Array<{
    '@type': 'HowToStep';
    name: string;
    text: string;
    image?: string;
    url?: string;
  }>;
}

export interface SoftwareApplicationSchema {
  '@context': string;
  '@type': 'SoftwareApplication';
  name: string;
  description: string;
  applicationCategory: string;
  operatingSystem: string;
  offers?: {
    '@type': 'Offer';
    price: string;
    priceCurrency: string;
  };
  aggregateRating?: {
    '@type': 'AggregateRating';
    ratingValue: string;
    ratingCount: number;
  };
}

export interface OrganizationSchema {
  '@context': string;
  '@type': 'Organization';
  name: string;
  url: string;
  logo: string;
  description?: string;
  sameAs?: string[]; // Social media profiles
  contactPoint?: Array<{
    '@type': 'ContactPoint';
    telephone: string;
    contactType: string;
    email?: string;
  }>;
}

export interface BreadcrumbSchema {
  '@context': string;
  '@type': 'BreadcrumbList';
  itemListElement: Array<{
    '@type': 'ListItem';
    position: number;
    name: string;
    item?: string;
  }>;
}

/**
 * Generate Article schema for blog posts
 */
export function generateArticleSchema(params: {
  title: string;
  excerpt?: string;
  content?: string;
  url: string;
  imageUrl?: string;
  publishedDate?: Date | string;
  modifiedDate?: Date | string;
  authorName?: string;
  keywords?: string[];
}): ArticleSchema {
  const schema: ArticleSchema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: params.title,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': params.url,
    },
  };

  if (params.excerpt) {
    schema.description = params.excerpt;
  }

  if (params.imageUrl) {
    schema.image = [params.imageUrl];
  }

  if (params.publishedDate) {
    schema.datePublished = typeof params.publishedDate === 'string'
      ? params.publishedDate
      : params.publishedDate.toISOString();
  }

  if (params.modifiedDate) {
    schema.dateModified = typeof params.modifiedDate === 'string'
      ? params.modifiedDate
      : params.modifiedDate.toISOString();
  }

  if (params.authorName) {
    schema.author = {
      '@type': 'Person',
      name: params.authorName,
    };
  }

  // Publisher (Printyx)
  schema.publisher = {
    '@type': 'Organization',
    name: 'Printyx',
    logo: {
      '@type': 'ImageObject',
      url: 'https://printyx.com/logo.png',
    },
  };

  if (params.content) {
    schema.wordCount = params.content.split(/\s+/).length;
  }

  if (params.keywords && params.keywords.length > 0) {
    schema.keywords = params.keywords;
  }

  return schema;
}

/**
 * Generate FAQ schema for FAQ sections
 */
export function generateFAQSchema(faqs: Array<{ question: string; answer: string }>): FAQSchema {
  return {
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
}

/**
 * Generate HowTo schema for step-by-step guides
 */
export function generateHowToSchema(params: {
  title: string;
  description?: string;
  imageUrl?: string;
  estimatedTime?: string;
  steps: Array<{
    title: string;
    description: string;
    imageUrl?: string;
  }>;
}): HowToSchema {
  const schema: HowToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: params.title,
    step: params.steps.map((step, index) => ({
      '@type': 'HowToStep',
      name: step.title,
      text: step.description,
      ...(step.imageUrl && { image: step.imageUrl }),
    })),
  };

  if (params.description) {
    schema.description = params.description;
  }

  if (params.imageUrl) {
    schema.image = [params.imageUrl];
  }

  if (params.estimatedTime) {
    schema.totalTime = params.estimatedTime;
  }

  return schema;
}

/**
 * Generate SoftwareApplication schema for product pages
 */
export function generateSoftwareApplicationSchema(params: {
  name: string;
  description: string;
  category: string;
  os: string;
  price?: string;
  currency?: string;
  rating?: number;
  ratingCount?: number;
}): SoftwareApplicationSchema {
  const schema: SoftwareApplicationSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: params.name,
    description: params.description,
    applicationCategory: params.category,
    operatingSystem: params.os,
  };

  if (params.price && params.currency) {
    schema.offers = {
      '@type': 'Offer',
      price: params.price,
      priceCurrency: params.currency,
    };
  }

  if (params.rating && params.ratingCount) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: params.rating.toString(),
      ratingCount: params.ratingCount,
    };
  }

  return schema;
}

/**
 * Generate Organization schema for company pages
 */
export function generateOrganizationSchema(params: {
  name: string;
  url: string;
  logoUrl: string;
  description?: string;
  socialProfiles?: string[];
  phone?: string;
  email?: string;
}): OrganizationSchema {
  const schema: OrganizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: params.name,
    url: params.url,
    logo: params.logoUrl,
  };

  if (params.description) {
    schema.description = params.description;
  }

  if (params.socialProfiles && params.socialProfiles.length > 0) {
    schema.sameAs = params.socialProfiles;
  }

  if (params.phone || params.email) {
    schema.contactPoint = [{
      '@type': 'ContactPoint',
      ...(params.phone && { telephone: params.phone }),
      contactType: 'customer service',
      ...(params.email && { email: params.email }),
    }];
  }

  return schema;
}

/**
 * Generate Breadcrumb schema for navigation
 */
export function generateBreadcrumbSchema(breadcrumbs: Array<{
  name: string;
  url?: string;
}>): BreadcrumbSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      ...(crumb.url && { item: crumb.url }),
    })),
  };
}

/**
 * Inject schema markup into the page head
 */
export function injectSchemaMarkup(schema: Record<string, any>) {
  if (typeof window === 'undefined') return;

  // Remove existing schema script if any
  const existingScript = document.querySelector('script[type="application/ld+json"]');
  if (existingScript) {
    existingScript.remove();
  }

  // Create and inject new schema script
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.text = JSON.stringify(schema);
  document.head.appendChild(script);
}

/**
 * Helper to inject multiple schema types (e.g., Article + FAQ + Breadcrumb)
 */
export function injectMultipleSchemas(schemas: Array<Record<string, any>>) {
  if (typeof window === 'undefined') return;

  // Remove existing schema scripts
  const existingScripts = document.querySelectorAll('script[type="application/ld+json"]');
  existingScripts.forEach(script => script.remove());

  // Inject each schema
  schemas.forEach(schema => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(schema);
    document.head.appendChild(script);
  });
}

/**
 * Calculate reading time in minutes
 */
export function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const words = content.trim().split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
}

/**
 * Generate meta tags for SEO
 */
export function generateMetaTags(params: {
  title: string;
  description: string;
  keywords?: string[];
  ogImage?: string;
  ogType?: string;
  canonicalUrl?: string;
  noindex?: boolean;
}) {
  const tags: Array<{ name?: string; property?: string; content: string }> = [
    { name: 'description', content: params.description },
  ];

  if (params.keywords && params.keywords.length > 0) {
    tags.push({ name: 'keywords', content: params.keywords.join(', ') });
  }

  // Open Graph
  tags.push({ property: 'og:title', content: params.title });
  tags.push({ property: 'og:description', content: params.description });
  tags.push({ property: 'og:type', content: params.ogType || 'website' });

  if (params.ogImage) {
    tags.push({ property: 'og:image', content: params.ogImage });
  }

  // Twitter Card
  tags.push({ name: 'twitter:card', content: 'summary_large_image' });
  tags.push({ name: 'twitter:title', content: params.title });
  tags.push({ name: 'twitter:description', content: params.description });

  if (params.ogImage) {
    tags.push({ name: 'twitter:image', content: params.ogImage });
  }

  // Canonical URL
  if (params.canonicalUrl) {
    tags.push({ name: 'canonical', content: params.canonicalUrl });
  }

  // Robots
  if (params.noindex) {
    tags.push({ name: 'robots', content: 'noindex, nofollow' });
  }

  return tags;
}
