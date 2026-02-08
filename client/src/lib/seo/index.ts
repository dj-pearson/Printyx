/**
 * SEO Module - Centralized SEO infrastructure
 *
 * This module provides comprehensive SEO functionality:
 * - Programmatic SEO with route configuration
 * - Dynamic meta tags and schema markup
 * - Internal linking utilities
 * - Breadcrumb management
 */

// Configuration
export {
  getSEOConfig,
  getAllSEOConfigs,
  getRelatedPages,
  PUBLIC_ROUTES_SEO,
  APP_ROUTES_SEO,
  SITE_URL,
  SITE_NAME,
  DEFAULT_OG_IMAGE,
  ORGANIZATION_DATA,
  type SEORouteConfig,
  type BreadcrumbItem,
  type SchemaType,
} from './seoConfig';

// Provider and Hooks
export { SEOProvider, useDynamicSEO, useCurrentSEO, useBreadcrumbs } from './SEOProvider';

// Internal Linking Components
export {
  InternalLink,
  RelatedLinks,
  Breadcrumbs,
  TopicCluster,
  FooterSitemapLinks,
  ContextualCTA,
} from './InternalLinking';

// GEO-Optimized Components
export { GEOFaqSection, type FAQItem } from './GEOFaqSection';

// Re-export schema utilities from schemaMarkup (consolidated)
export {
  generateArticleSchema,
  generateFAQSchema,
  generateHowToSchema,
  generateSoftwareApplicationSchema,
  generateOrganizationSchema,
  generateBreadcrumbSchema,
  generateProductSchema,
  generateServiceSchema,
  generateLocalBusinessSchema,
  generateVideoObjectSchema,
  secondsToISO8601Duration,
  injectSchemaMarkup,
  injectMultipleSchemas,
  calculateReadingTime,
  generateMetaTags,
} from '../schemaMarkup';

// Re-export utilities from seoUtils
export {
  usePageSeo,
  formatPublishDate,
  generateExcerpt,
  slugify,
  trackContentView,
  FAQSchemaScript,
  BreadcrumbSchemaScript,
} from '../seoUtils';
