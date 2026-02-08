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

export interface ProductSchema {
  '@context': string;
  '@type': 'Product';
  name: string;
  description: string;
  image?: string | string[];
  sku?: string;
  mpn?: string;
  brand?: {
    '@type': 'Brand';
    name: string;
  };
  offers?: {
    '@type': 'Offer';
    url?: string;
    priceCurrency: string;
    price: string;
    priceValidUntil?: string;
    availability?: string;
    itemCondition?: string;
    seller?: {
      '@type': 'Organization';
      name: string;
    };
  };
  aggregateRating?: {
    '@type': 'AggregateRating';
    ratingValue: string;
    reviewCount: number;
    bestRating?: string;
    worstRating?: string;
  };
  review?: Array<{
    '@type': 'Review';
    author: {
      '@type': 'Person';
      name: string;
    };
    datePublished: string;
    reviewBody: string;
    reviewRating: {
      '@type': 'Rating';
      ratingValue: string;
      bestRating?: string;
    };
  }>;
}

export interface ServiceSchema {
  '@context': string;
  '@type': 'Service';
  name: string;
  description: string;
  provider: {
    '@type': 'Organization';
    name: string;
    url?: string;
    logo?: string;
  };
  areaServed?:
    | Array<{
        '@type': 'City' | 'State' | 'Country';
        name: string;
      }>
    | string;
  offers?: {
    '@type': 'Offer';
    priceCurrency?: string;
    price?: string;
    priceRange?: string;
  };
  serviceType?: string;
  image?: string | string[];
  aggregateRating?: {
    '@type': 'AggregateRating';
    ratingValue: string;
    reviewCount: number;
  };
}

export interface LocalBusinessSchema {
  '@context': string;
  '@type': 'LocalBusiness';
  name: string;
  description?: string;
  image?: string | string[];
  '@id'?: string;
  url?: string;
  telephone?: string;
  email?: string;
  address?: {
    '@type': 'PostalAddress';
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    postalCode: string;
    addressCountry: string;
  };
  geo?: {
    '@type': 'GeoCoordinates';
    latitude: number;
    longitude: number;
  };
  openingHoursSpecification?: Array<{
    '@type': 'OpeningHoursSpecification';
    dayOfWeek: string | string[];
    opens: string;
    closes: string;
  }>;
  priceRange?: string;
  aggregateRating?: {
    '@type': 'AggregateRating';
    ratingValue: string;
    reviewCount: number;
  };
  sameAs?: string[];
}

export interface VideoObjectSchema {
  '@context': string;
  '@type': 'VideoObject';
  name: string;
  description: string;
  thumbnailUrl: string | string[];
  uploadDate: string;
  duration?: string; // ISO 8601 duration format (e.g., PT1M33S)
  contentUrl?: string;
  embedUrl?: string;
  interactionStatistic?: {
    '@type': 'InteractionCounter';
    interactionType: string; // http://schema.org/WatchAction
    userInteractionCount: number;
  };
  publisher?: {
    '@type': 'Organization';
    name: string;
    logo?: {
      '@type': 'ImageObject';
      url: string;
      width?: number;
      height?: number;
    };
  };
  expires?: string; // ISO 8601 date
  hasPart?: Array<{
    '@type': 'Clip';
    name: string;
    startOffset: number;
    endOffset: number;
    url: string;
  }>;
  potentialAction?: {
    '@type': 'SeekToAction';
    target: string;
    'startOffset-input': string;
  };
  regionsAllowed?: string[]; // ISO 3166 country codes
  inLanguage?: string;
  isFamilyFriendly?: boolean;
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
    schema.datePublished =
      typeof params.publishedDate === 'string'
        ? params.publishedDate
        : params.publishedDate.toISOString();
  }

  if (params.modifiedDate) {
    schema.dateModified =
      typeof params.modifiedDate === 'string'
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
      url: 'https://printyx.net/logo.png',
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
    schema.contactPoint = [
      {
        '@type': 'ContactPoint',
        ...(params.phone && { telephone: params.phone }),
        contactType: 'customer service',
        ...(params.email && { email: params.email }),
      },
    ];
  }

  return schema;
}

/**
 * Generate Breadcrumb schema for navigation
 */
export function generateBreadcrumbSchema(
  breadcrumbs: Array<{
    name: string;
    url?: string;
  }>,
): BreadcrumbSchema {
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
 * Generate Product schema for product pages
 */
export function generateProductSchema(params: {
  name: string;
  description: string;
  imageUrl?: string | string[];
  sku?: string;
  mpn?: string;
  brandName?: string;
  price?: string;
  priceCurrency?: string;
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder' | 'Discontinued';
  condition?: 'NewCondition' | 'UsedCondition' | 'RefurbishedCondition';
  url?: string;
  rating?: number;
  reviewCount?: number;
  reviews?: Array<{
    authorName: string;
    datePublished: string;
    reviewBody: string;
    rating: number;
  }>;
}): ProductSchema {
  const schema: ProductSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: params.name,
    description: params.description,
  };

  if (params.imageUrl) {
    schema.image = params.imageUrl;
  }

  if (params.sku) {
    schema.sku = params.sku;
  }

  if (params.mpn) {
    schema.mpn = params.mpn;
  }

  if (params.brandName) {
    schema.brand = {
      '@type': 'Brand',
      name: params.brandName,
    };
  }

  if (params.price && params.priceCurrency) {
    schema.offers = {
      '@type': 'Offer',
      priceCurrency: params.priceCurrency,
      price: params.price,
      ...(params.url && { url: params.url }),
      ...(params.availability && { availability: `https://schema.org/${params.availability}` }),
      ...(params.condition && { itemCondition: `https://schema.org/${params.condition}` }),
    };
  }

  if (params.rating && params.reviewCount) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: params.rating.toString(),
      reviewCount: params.reviewCount,
      bestRating: '5',
      worstRating: '1',
    };
  }

  if (params.reviews && params.reviews.length > 0) {
    schema.review = params.reviews.map((review) => ({
      '@type': 'Review',
      author: {
        '@type': 'Person',
        name: review.authorName,
      },
      datePublished: review.datePublished,
      reviewBody: review.reviewBody,
      reviewRating: {
        '@type': 'Rating',
        ratingValue: review.rating.toString(),
        bestRating: '5',
      },
    }));
  }

  return schema;
}

/**
 * Generate Service schema for service pages
 */
export function generateServiceSchema(params: {
  name: string;
  description: string;
  providerName: string;
  providerUrl?: string;
  providerLogo?: string;
  imageUrl?: string | string[];
  serviceType?: string;
  areaServed?: Array<{ type: 'City' | 'State' | 'Country'; name: string }> | string;
  price?: string;
  priceCurrency?: string;
  priceRange?: string;
  rating?: number;
  reviewCount?: number;
}): ServiceSchema {
  const schema: ServiceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: params.name,
    description: params.description,
    provider: {
      '@type': 'Organization',
      name: params.providerName,
      ...(params.providerUrl && { url: params.providerUrl }),
      ...(params.providerLogo && { logo: params.providerLogo }),
    },
  };

  if (params.imageUrl) {
    schema.image = params.imageUrl;
  }

  if (params.serviceType) {
    schema.serviceType = params.serviceType;
  }

  if (params.areaServed) {
    if (typeof params.areaServed === 'string') {
      schema.areaServed = params.areaServed;
    } else {
      schema.areaServed = params.areaServed.map((area) => ({
        '@type': area.type,
        name: area.name,
      }));
    }
  }

  if (params.price && params.priceCurrency) {
    schema.offers = {
      '@type': 'Offer',
      priceCurrency: params.priceCurrency,
      price: params.price,
    };
  } else if (params.priceRange) {
    schema.offers = {
      '@type': 'Offer',
      priceRange: params.priceRange,
    };
  }

  if (params.rating && params.reviewCount) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: params.rating.toString(),
      reviewCount: params.reviewCount,
    };
  }

  return schema;
}

/**
 * Generate LocalBusiness schema for location pages
 */
export function generateLocalBusinessSchema(params: {
  name: string;
  description?: string;
  imageUrl?: string | string[];
  url?: string;
  telephone?: string;
  email?: string;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  openingHours?: Array<{
    days: string | string[];
    opens: string;
    closes: string;
  }>;
  priceRange?: string;
  rating?: number;
  reviewCount?: number;
  socialProfiles?: string[];
}): LocalBusinessSchema {
  const schema: LocalBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: params.name,
  };

  if (params.description) {
    schema.description = params.description;
  }

  if (params.imageUrl) {
    schema.image = params.imageUrl;
  }

  if (params.url) {
    schema.url = params.url;
    schema['@id'] = params.url;
  }

  if (params.telephone) {
    schema.telephone = params.telephone;
  }

  if (params.email) {
    schema.email = params.email;
  }

  schema.address = {
    '@type': 'PostalAddress',
    streetAddress: params.streetAddress,
    addressLocality: params.city,
    addressRegion: params.state,
    postalCode: params.postalCode,
    addressCountry: params.country || 'US',
  };

  if (params.latitude && params.longitude) {
    schema.geo = {
      '@type': 'GeoCoordinates',
      latitude: params.latitude,
      longitude: params.longitude,
    };
  }

  if (params.openingHours && params.openingHours.length > 0) {
    schema.openingHoursSpecification = params.openingHours.map((hours) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: hours.days,
      opens: hours.opens,
      closes: hours.closes,
    }));
  }

  if (params.priceRange) {
    schema.priceRange = params.priceRange;
  }

  if (params.rating && params.reviewCount) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: params.rating.toString(),
      reviewCount: params.reviewCount,
    };
  }

  if (params.socialProfiles && params.socialProfiles.length > 0) {
    schema.sameAs = params.socialProfiles;
  }

  return schema;
}

/**
 * Generate VideoObject schema for video content
 */
export function generateVideoObjectSchema(params: {
  name: string;
  description: string;
  thumbnailUrl: string | string[];
  uploadDate: Date | string;
  duration?: string; // ISO 8601 format like "PT1M33S" for 1 min 33 sec
  contentUrl?: string;
  embedUrl?: string;
  viewCount?: number;
  publisherName?: string;
  publisherLogoUrl?: string;
  expiresDate?: Date | string;
  chapters?: Array<{
    name: string;
    startOffset: number;
    endOffset: number;
    url: string;
  }>;
  regionsAllowed?: string[];
  language?: string;
  isFamilyFriendly?: boolean;
}): VideoObjectSchema {
  const schema: VideoObjectSchema = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: params.name,
    description: params.description,
    thumbnailUrl: params.thumbnailUrl,
    uploadDate:
      typeof params.uploadDate === 'string' ? params.uploadDate : params.uploadDate.toISOString(),
  };

  if (params.duration) {
    schema.duration = params.duration;
  }

  if (params.contentUrl) {
    schema.contentUrl = params.contentUrl;
  }

  if (params.embedUrl) {
    schema.embedUrl = params.embedUrl;
  }

  if (params.viewCount !== undefined) {
    schema.interactionStatistic = {
      '@type': 'InteractionCounter',
      interactionType: 'http://schema.org/WatchAction',
      userInteractionCount: params.viewCount,
    };
  }

  if (params.publisherName) {
    schema.publisher = {
      '@type': 'Organization',
      name: params.publisherName,
    };

    if (params.publisherLogoUrl) {
      schema.publisher.logo = {
        '@type': 'ImageObject',
        url: params.publisherLogoUrl,
      };
    }
  }

  if (params.expiresDate) {
    schema.expires =
      typeof params.expiresDate === 'string'
        ? params.expiresDate
        : params.expiresDate.toISOString();
  }

  if (params.chapters && params.chapters.length > 0) {
    schema.hasPart = params.chapters.map((chapter) => ({
      '@type': 'Clip',
      name: chapter.name,
      startOffset: chapter.startOffset,
      endOffset: chapter.endOffset,
      url: chapter.url,
    }));
  }

  if (params.regionsAllowed && params.regionsAllowed.length > 0) {
    schema.regionsAllowed = params.regionsAllowed;
  }

  if (params.language) {
    schema.inLanguage = params.language;
  }

  if (params.isFamilyFriendly !== undefined) {
    schema.isFamilyFriendly = params.isFamilyFriendly;
  }

  return schema;
}

/**
 * Helper to convert seconds to ISO 8601 duration format
 * Example: 93 seconds -> "PT1M33S"
 */
export function secondsToISO8601Duration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  let duration = 'PT';
  if (hours > 0) duration += `${hours}H`;
  if (minutes > 0) duration += `${minutes}M`;
  if (secs > 0 || (hours === 0 && minutes === 0)) duration += `${secs}S`;

  return duration;
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
  existingScripts.forEach((script) => script.remove());

  // Inject each schema
  schemas.forEach((schema) => {
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
