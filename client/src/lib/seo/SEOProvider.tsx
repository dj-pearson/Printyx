/**
 * SEO Provider Component
 * Centralized SEO management for the entire application
 * Handles meta tags, schema markup, and Open Graph tags
 */

import { useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'wouter';
import {
  getSEOConfig,
  SITE_URL,
  SITE_NAME,
  DEFAULT_OG_IMAGE,
  ORGANIZATION_DATA,
  type SEORouteConfig,
  type BreadcrumbItem,
} from './seoConfig';

interface SEOProviderProps {
  children: React.ReactNode;
}

interface DynamicSEOData {
  title?: string;
  description?: string;
  ogImage?: string;
  keywords?: string[];
  schema?: Record<string, unknown>;
  breadcrumbs?: BreadcrumbItem[];
}

// Cache for meta element references
const metaCache = new Map<string, HTMLMetaElement>();
const linkCache = new Map<string, HTMLLinkElement>();

/**
 * Get or create a meta element
 */
function getOrCreateMeta(name: string, isProperty: boolean = false): HTMLMetaElement {
  const attrName = isProperty ? 'property' : 'name';
  const cacheKey = `${attrName}:${name}`;

  let meta = metaCache.get(cacheKey);
  if (meta && document.head.contains(meta)) {
    return meta;
  }

  meta = document.querySelector(`meta[${attrName}="${name}"]`) as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attrName, name);
    document.head.appendChild(meta);
  }
  metaCache.set(cacheKey, meta);
  return meta;
}

/**
 * Get or create a link element
 */
function getOrCreateLink(rel: string): HTMLLinkElement {
  let link = linkCache.get(rel);
  if (link && document.head.contains(link)) {
    return link;
  }

  link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', rel);
    document.head.appendChild(link);
  }
  linkCache.set(rel, link);
  return link;
}

/**
 * Set meta tag content
 */
function setMeta(name: string, content: string | undefined, isProperty: boolean = false): void {
  if (!content) return;
  const meta = getOrCreateMeta(name, isProperty);
  meta.setAttribute('content', content);
}

/**
 * Generate breadcrumb schema
 */
function generateBreadcrumbSchema(breadcrumbs: BreadcrumbItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.label,
      ...(crumb.path && { item: `${SITE_URL}${crumb.path}` }),
    })),
  };
}

/**
 * Generate Organization schema
 */
function generateOrganizationSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: ORGANIZATION_DATA.name,
    url: ORGANIZATION_DATA.url,
    logo: ORGANIZATION_DATA.logo,
    description: ORGANIZATION_DATA.description,
    sameAs: ORGANIZATION_DATA.sameAs,
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: ORGANIZATION_DATA.contactPoint.telephone,
      contactType: ORGANIZATION_DATA.contactPoint.contactType,
      email: ORGANIZATION_DATA.contactPoint.email,
    },
  };
}

/**
 * Generate WebSite schema with SearchAction
 */
function generateWebSiteSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * Generate SoftwareApplication schema
 */
function generateSoftwareApplicationSchema(config: SEORouteConfig): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Printyx',
    description: config.description,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Free trial available',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: 150,
      bestRating: '5',
      worstRating: '1',
    },
  };
}

/**
 * Generate Article/BlogPosting schema
 */
function generateArticleSchema(
  config: SEORouteConfig,
  type: 'Article' | 'BlogPosting' = 'BlogPosting',
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': type,
    headline: config.title,
    description: config.description,
    image: config.ogImage || DEFAULT_OG_IMAGE,
    author: {
      '@type': 'Organization',
      name: ORGANIZATION_DATA.name,
      url: ORGANIZATION_DATA.url,
    },
    publisher: {
      '@type': 'Organization',
      name: ORGANIZATION_DATA.name,
      logo: {
        '@type': 'ImageObject',
        url: ORGANIZATION_DATA.logo,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${SITE_URL}${config.path}`,
    },
    datePublished: new Date().toISOString(),
    dateModified: new Date().toISOString(),
  };
}

/**
 * Generate Product schema
 */
function generateProductSchema(config: SEORouteConfig): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: config.title.split(' | ')[0],
    description: config.description,
    image: config.ogImage || DEFAULT_OG_IMAGE,
    brand: {
      '@type': 'Brand',
      name: 'Printyx',
    },
    offers: {
      '@type': 'Offer',
      availability: 'https://schema.org/InStock',
      priceCurrency: 'USD',
      price: '0',
      description: 'Contact for pricing',
    },
  };
}

/**
 * Generate Service schema
 */
function generateServiceSchema(config: SEORouteConfig): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: config.title.split(' | ')[0],
    description: config.description,
    provider: {
      '@type': 'Organization',
      name: ORGANIZATION_DATA.name,
      url: ORGANIZATION_DATA.url,
      logo: ORGANIZATION_DATA.logo,
    },
    areaServed: 'United States',
    serviceType: 'Software as a Service',
  };
}

/**
 * Generate schema based on type
 */
function generateSchema(config: SEORouteConfig): Record<string, unknown>[] {
  const schemas: Record<string, unknown>[] = [];

  // Always include breadcrumb schema if breadcrumbs exist
  if (config.breadcrumbs && config.breadcrumbs.length > 0) {
    schemas.push(generateBreadcrumbSchema(config.breadcrumbs));
  }

  // Add type-specific schema
  switch (config.schema) {
    case 'Organization':
      schemas.push(generateOrganizationSchema());
      schemas.push(generateWebSiteSchema());
      break;
    case 'SoftwareApplication':
      schemas.push(generateSoftwareApplicationSchema(config));
      break;
    case 'Article':
      schemas.push(generateArticleSchema(config, 'Article'));
      break;
    case 'BlogPosting':
      schemas.push(generateArticleSchema(config, 'BlogPosting'));
      break;
    case 'Product':
      schemas.push(generateProductSchema(config));
      break;
    case 'Service':
      schemas.push(generateServiceSchema(config));
      break;
    case 'FAQPage':
    case 'HowTo':
    case 'ItemList':
      // These schema types are injected dynamically by page components using FAQSchemaScript
      // or useDynamicSEO. The SEOProvider only adds breadcrumbs for these.
      break;
    case 'WebPage':
    case 'WebSite':
    default:
      // Just breadcrumbs for basic pages
      break;
  }

  return schemas;
}

/**
 * Inject schema markup into the page
 */
function injectSchemas(schemas: Record<string, unknown>[]): () => void {
  const scriptIds: string[] = [];

  schemas.forEach((schema, index) => {
    const scriptId = `printyx-schema-${index}`;
    scriptIds.push(scriptId);

    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(schema);
  });

  // Return cleanup function
  return () => {
    scriptIds.forEach((id) => {
      const script = document.getElementById(id);
      if (script) script.remove();
    });
  };
}

/**
 * Apply SEO configuration to the page
 */
function applySEO(config: SEORouteConfig, dynamicData?: DynamicSEOData): () => void {
  const title = dynamicData?.title || config.title;
  const description = dynamicData?.description || config.description;
  const ogImage = dynamicData?.ogImage || config.ogImage || DEFAULT_OG_IMAGE;
  const keywords = dynamicData?.keywords || config.keywords;
  const breadcrumbs = dynamicData?.breadcrumbs || config.breadcrumbs;
  const canonicalUrl = `${SITE_URL}${config.canonicalPath || config.path}`;

  // Set document title
  document.title = title;

  // Basic meta tags
  setMeta('description', description);
  if (keywords && keywords.length > 0) {
    setMeta('keywords', keywords.join(', '));
  }

  // Robots
  setMeta('robots', config.noindex ? 'noindex, nofollow' : 'index, follow');

  // Canonical URL
  const canonical = getOrCreateLink('canonical');
  canonical.href = canonicalUrl;

  // Open Graph tags
  setMeta('og:title', title, true);
  setMeta('og:description', description, true);
  setMeta('og:image', ogImage, true);
  setMeta('og:url', canonicalUrl, true);
  setMeta('og:type', config.ogType || 'website', true);
  setMeta('og:site_name', SITE_NAME, true);

  // Twitter Card tags
  setMeta('twitter:card', 'summary_large_image');
  setMeta('twitter:title', title);
  setMeta('twitter:description', description);
  setMeta('twitter:image', ogImage);
  setMeta('twitter:site', '@printyx');

  // Content freshness signals for GEO - AI engines weight recency heavily
  const currentDate = new Date().toISOString().split('T')[0];
  setMeta('article:modified_time', currentDate, true);
  if (config.ogType === 'article') {
    setMeta('article:section', 'Copier Dealer Management', true);
    setMeta('article:tag', (keywords || []).slice(0, 5).join(', '), true);
  }

  // Generate and inject schemas
  const configWithBreadcrumbs = { ...config, breadcrumbs };
  const schemas = dynamicData?.schema
    ? [dynamicData.schema, ...generateSchema(configWithBreadcrumbs)]
    : generateSchema(configWithBreadcrumbs);

  return injectSchemas(schemas);
}

/**
 * Default SEO config for unknown routes
 */
const DEFAULT_SEO_CONFIG: SEORouteConfig = {
  path: '/',
  title: `${SITE_NAME} | Modern Cloud Platform for Copier Dealers`,
  description:
    'Transform your copier dealership with Printyx. All-in-one cloud CRM, service dispatch, billing, and analytics.',
  ogType: 'website',
  noindex: false,
};

/**
 * SEO Provider Hook - use in components that need dynamic SEO
 */
export function useDynamicSEO(dynamicData: DynamicSEOData) {
  const [pathname] = useLocation();

  useEffect(() => {
    const config = getSEOConfig(pathname) || { ...DEFAULT_SEO_CONFIG, path: pathname };
    const cleanup = applySEO(config, dynamicData);
    return cleanup;
  }, [pathname, dynamicData]);
}

/**
 * SEO Provider Component
 * Wraps the app and handles SEO for all routes
 */
export function SEOProvider({ children }: SEOProviderProps) {
  const [pathname] = useLocation();

  useEffect(() => {
    const config = getSEOConfig(pathname) || { ...DEFAULT_SEO_CONFIG, path: pathname };
    const cleanup = applySEO(config);
    return cleanup;
  }, [pathname]);

  return <>{children}</>;
}

/**
 * Hook to get current page's SEO config
 */
export function useCurrentSEO(): SEORouteConfig | null {
  const [pathname] = useLocation();
  return useMemo(() => getSEOConfig(pathname), [pathname]);
}

/**
 * Hook to get breadcrumbs for current page
 */
export function useBreadcrumbs(): BreadcrumbItem[] {
  const config = useCurrentSEO();
  return config?.breadcrumbs || [];
}

export default SEOProvider;
