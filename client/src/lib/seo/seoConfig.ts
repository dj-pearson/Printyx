/**
 * SEO Route Configuration System
 * Centralized SEO metadata for all routes - enables programmatic SEO at scale
 */

export interface SEORouteConfig {
  path: string;
  title: string;
  description: string;
  keywords?: string[];
  ogType?: 'website' | 'article' | 'product' | 'profile';
  ogImage?: string;
  schema?: SchemaType;
  priority?: number; // 0.0 - 1.0 for sitemap
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  noindex?: boolean;
  breadcrumbs?: BreadcrumbItem[];
  relatedPaths?: string[]; // For internal linking
  canonicalPath?: string; // If different from path
}

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

export type SchemaType =
  | 'WebSite'
  | 'WebPage'
  | 'Organization'
  | 'Product'
  | 'Service'
  | 'Article'
  | 'BlogPosting'
  | 'FAQPage'
  | 'HowTo'
  | 'LocalBusiness'
  | 'SoftwareApplication'
  | 'BreadcrumbList';

// Base URL for the site
export const SITE_URL = 'https://printyx.net';
export const SITE_NAME = 'Printyx';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

// Organization schema data
export const ORGANIZATION_DATA = {
  name: 'Printyx',
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  description:
    'Printyx is a modern cloud platform for copier dealers and managed print service providers. Streamline your CRM, service dispatch, billing, and more.',
  sameAs: [
    'https://twitter.com/printyx',
    'https://www.linkedin.com/company/printyx',
    'https://www.youtube.com/@printyx',
  ],
  contactPoint: {
    telephone: '+1-800-PRINTYX',
    contactType: 'customer service',
    email: 'support@printyx.net',
  },
};

/**
 * SEO configuration for all marketing/public routes
 * These routes are indexed by search engines
 */
export const PUBLIC_ROUTES_SEO: SEORouteConfig[] = [
  // Homepage
  {
    path: '/',
    title: 'Printyx | Modern Cloud Platform for Copier Dealers & MPS Providers',
    description:
      'Transform your copier dealership with Printyx. All-in-one cloud CRM, service dispatch, billing, and analytics. Replace E-Automate with modern technology.',
    keywords: [
      'copier dealer CRM',
      'managed print services',
      'MPS software',
      'E-Automate alternative',
      'copier service dispatch',
      'print fleet management',
    ],
    ogType: 'website',
    schema: 'Organization',
    priority: 1.0,
    changefreq: 'daily',
    breadcrumbs: [{ label: 'Home' }],
  },

  // Strategic Landing Pages
  {
    path: '/p/copier-dealer-crm',
    title: 'CRM for Copier Dealers | Printyx - Built for Print Industry',
    description:
      'Purpose-built CRM for copier dealers. Manage leads, customers, contracts, and service all in one platform. Designed by industry experts.',
    keywords: [
      'copier dealer CRM',
      'print industry CRM',
      'copier sales software',
      'dealer management system',
      'copier business software',
    ],
    ogType: 'product',
    schema: 'Product',
    priority: 0.9,
    changefreq: 'weekly',
    breadcrumbs: [{ label: 'Home', path: '/' }, { label: 'CRM for Copier Dealers' }],
    relatedPaths: ['/predictive-intelligence', '/modern-architecture', '/case-studies'],
  },
  {
    path: '/p/print-service-dispatch-mobile',
    title: 'Mobile Service Dispatch for Copier Technicians | Printyx',
    description:
      'Empower your technicians with mobile-first service dispatch. Real-time job updates, GPS tracking, parts inventory, and customer signatures on any device.',
    keywords: [
      'copier service dispatch',
      'mobile service app',
      'technician dispatch software',
      'field service management',
      'copier repair dispatch',
    ],
    ogType: 'product',
    schema: 'Product',
    priority: 0.9,
    changefreq: 'weekly',
    breadcrumbs: [{ label: 'Home', path: '/' }, { label: 'Mobile Service Dispatch' }],
    relatedPaths: ['/service-hub', '/mobile-field-service', '/fleet-monitoring'],
  },
  {
    path: '/p/master-product-catalog-canon-imagerunner',
    title: 'Canon imageRUNNER Product Catalog | Complete Dealer Reference',
    description:
      'Comprehensive Canon imageRUNNER product catalog for dealers. Specs, pricing, accessories, and supplies for the full Canon lineup.',
    keywords: [
      'Canon imageRUNNER',
      'Canon copier catalog',
      'Canon dealer products',
      'Canon MFP specs',
      'Canon printer catalog',
    ],
    ogType: 'product',
    schema: 'Product',
    priority: 0.8,
    changefreq: 'monthly',
    breadcrumbs: [{ label: 'Home', path: '/' }, { label: 'Canon Product Catalog' }],
    relatedPaths: ['/product-hub', '/inventory'],
  },

  // Feature Pages
  {
    path: '/predictive-intelligence',
    title: 'AI-Powered Predictive Intelligence for Copier Dealers | Printyx',
    description:
      'Leverage AI and machine learning to predict service needs, optimize routes, forecast sales, and reduce downtime. Smart analytics for copier dealers.',
    keywords: [
      'AI copier service',
      'predictive maintenance',
      'copier analytics',
      'machine learning MPS',
      'smart service dispatch',
    ],
    ogType: 'product',
    schema: 'SoftwareApplication',
    priority: 0.9,
    changefreq: 'weekly',
    breadcrumbs: [{ label: 'Home', path: '/' }, { label: 'Predictive Intelligence' }],
    relatedPaths: ['/ai-hub', '/ai-analytics-dashboard', '/predictive-analytics'],
  },
  {
    path: '/modern-architecture',
    title: 'Modern Cloud Architecture | Why Printyx Beats Legacy Systems',
    description:
      'Built on modern cloud infrastructure. Real-time sync, mobile-first design, API-driven integrations, and enterprise security. The future of MPS software.',
    keywords: [
      'cloud MPS software',
      'modern copier software',
      'SaaS dealer platform',
      'cloud-native print management',
      'API-first MPS',
    ],
    ogType: 'article',
    schema: 'Article',
    priority: 0.9,
    changefreq: 'weekly',
    breadcrumbs: [{ label: 'Home', path: '/' }, { label: 'Modern Architecture' }],
    relatedPaths: ['/integration-marketplace', '/system-integrations'],
  },
  {
    path: '/integration-marketplace',
    title: 'Integration Marketplace | Connect Printyx to Your Stack',
    description:
      'Pre-built integrations with Salesforce, QuickBooks, Microsoft 365, Google Workspace, and more. Connect Printyx to your existing tools.',
    keywords: [
      'copier software integrations',
      'QuickBooks integration',
      'Salesforce copier CRM',
      'MPS integrations',
      'API marketplace',
    ],
    ogType: 'product',
    schema: 'Product',
    priority: 0.8,
    changefreq: 'weekly',
    breadcrumbs: [{ label: 'Home', path: '/' }, { label: 'Integration Marketplace' }],
    relatedPaths: ['/quickbooks-integration', '/erp-integration', '/system-integrations'],
  },
  {
    path: '/dealer-expertise',
    title: 'Built by Copier Industry Experts | Printyx',
    description:
      'Printyx was built by people who understand the copier dealer business. 30+ years of combined industry experience in every feature.',
    keywords: [
      'copier industry experts',
      'dealer software experts',
      'MPS consultants',
      'copier business consulting',
    ],
    ogType: 'article',
    schema: 'Article',
    priority: 0.8,
    changefreq: 'monthly',
    breadcrumbs: [{ label: 'Home', path: '/' }, { label: 'Dealer Expertise' }],
    relatedPaths: ['/case-studies', '/roi-calculator'],
  },

  // Conversion Pages
  {
    path: '/roi-calculator',
    title: 'ROI Calculator | See Your Savings with Printyx',
    description:
      'Calculate your potential savings by switching to Printyx. Input your current costs and see the ROI in minutes.',
    keywords: [
      'MPS ROI calculator',
      'copier software ROI',
      'dealer software savings',
      'E-Automate replacement cost',
    ],
    ogType: 'website',
    schema: 'WebPage',
    priority: 0.8,
    changefreq: 'monthly',
    breadcrumbs: [{ label: 'Home', path: '/' }, { label: 'ROI Calculator' }],
    relatedPaths: ['/case-studies', '/pricing'],
  },
  {
    path: '/case-studies',
    title: 'Customer Success Stories | Printyx Case Studies',
    description:
      'See how copier dealers are transforming their business with Printyx. Real results from real customers.',
    keywords: [
      'copier dealer success stories',
      'MPS case studies',
      'dealer software testimonials',
      'Printyx customers',
    ],
    ogType: 'article',
    schema: 'Article',
    priority: 0.7,
    changefreq: 'monthly',
    breadcrumbs: [{ label: 'Home', path: '/' }, { label: 'Case Studies' }],
    relatedPaths: ['/roi-calculator', '/dealer-expertise'],
  },
  {
    path: '/battle-card',
    title: 'Printyx vs E-Automate Comparison | Feature Battle Card',
    description:
      'Side-by-side comparison of Printyx vs E-Automate. See why modern dealers are making the switch.',
    keywords: [
      'Printyx vs E-Automate',
      'E-Automate alternative',
      'copier software comparison',
      'MPS platform comparison',
    ],
    ogType: 'article',
    schema: 'Article',
    priority: 0.8,
    changefreq: 'monthly',
    breadcrumbs: [{ label: 'Home', path: '/' }, { label: 'Competitive Comparison' }],
    relatedPaths: ['/compare-eautomate', '/modern-architecture'],
  },

  // Blog
  {
    path: '/blog',
    title: 'Printyx Blog | Insights for Copier Dealers & MPS Providers',
    description:
      'Expert insights on copier dealer operations, managed print services, and industry trends. Tips, guides, and best practices.',
    keywords: [
      'copier dealer blog',
      'MPS insights',
      'print industry news',
      'dealer management tips',
    ],
    ogType: 'website',
    schema: 'WebPage',
    priority: 0.8,
    changefreq: 'daily',
    breadcrumbs: [{ label: 'Home', path: '/' }, { label: 'Blog' }],
  },

  // Blog Posts (programmatic - these would be generated from CMS)
  {
    path: '/blog/ai-predictive-maintenance-vs-reactive-service',
    title: 'AI Predictive Maintenance vs Reactive Service | Printyx Blog',
    description:
      'Learn how AI-powered predictive maintenance outperforms reactive service models. Reduce downtime, cut costs, and improve customer satisfaction.',
    keywords: [
      'predictive maintenance',
      'AI copier service',
      'reactive vs proactive service',
      'copier uptime optimization',
    ],
    ogType: 'article',
    schema: 'BlogPosting',
    priority: 0.7,
    changefreq: 'monthly',
    breadcrumbs: [
      { label: 'Home', path: '/' },
      { label: 'Blog', path: '/blog' },
      { label: 'AI Predictive Maintenance' },
    ],
    relatedPaths: ['/predictive-intelligence', '/ai-service-intelligence', '/proactive-service'],
  },
  {
    path: '/blog/e-automate-vs-modern-cloud-platforms',
    title: 'E-Automate vs Modern Cloud Platforms | Time to Upgrade?',
    description:
      'Is it time to move beyond E-Automate? Compare legacy on-premise software to modern cloud platforms designed for today`s copier dealers.',
    keywords: [
      'E-Automate comparison',
      'legacy MPS software',
      'cloud copier software',
      'E-Automate migration',
    ],
    ogType: 'article',
    schema: 'BlogPosting',
    priority: 0.7,
    changefreq: 'monthly',
    breadcrumbs: [
      { label: 'Home', path: '/' },
      { label: 'Blog', path: '/blog' },
      { label: 'E-Automate Comparison' },
    ],
    relatedPaths: ['/compare-eautomate', '/modern-architecture', '/battle-card'],
  },
  {
    path: '/blog/dynamic-pricing-ai-copier-dealers',
    title: 'Dynamic Pricing with AI for Copier Dealers | Maximize Margins',
    description:
      'Use AI to optimize your pricing strategy. Dynamic pricing tools help copier dealers maximize margins while staying competitive.',
    keywords: [
      'dynamic pricing copier',
      'AI pricing optimization',
      'copier dealer margins',
      'MPS pricing strategy',
    ],
    ogType: 'article',
    schema: 'BlogPosting',
    priority: 0.7,
    changefreq: 'monthly',
    breadcrumbs: [
      { label: 'Home', path: '/' },
      { label: 'Blog', path: '/blog' },
      { label: 'Dynamic Pricing with AI' },
    ],
    relatedPaths: ['/pricing-management', '/ai-analytics-dashboard'],
  },

  // Legal Pages
  {
    path: '/eula',
    title: 'End User License Agreement | Printyx',
    description: 'Printyx End User License Agreement. Terms and conditions for using the Printyx platform.',
    ogType: 'website',
    schema: 'WebPage',
    priority: 0.3,
    changefreq: 'yearly',
    noindex: false,
    breadcrumbs: [{ label: 'Home', path: '/' }, { label: 'EULA' }],
  },
  {
    path: '/privacy',
    title: 'Privacy Policy | Printyx',
    description: 'Printyx Privacy Policy. How we collect, use, and protect your data.',
    ogType: 'website',
    schema: 'WebPage',
    priority: 0.3,
    changefreq: 'yearly',
    noindex: false,
    breadcrumbs: [{ label: 'Home', path: '/' }, { label: 'Privacy Policy' }],
  },
  {
    path: '/terms',
    title: 'Terms and Conditions | Printyx',
    description: 'Printyx Terms and Conditions. Rules and regulations for using our services.',
    ogType: 'website',
    schema: 'WebPage',
    priority: 0.3,
    changefreq: 'yearly',
    noindex: false,
    breadcrumbs: [{ label: 'Home', path: '/' }, { label: 'Terms and Conditions' }],
  },

  // Auth Pages (noindex)
  {
    path: '/login',
    title: 'Login | Printyx',
    description: 'Log in to your Printyx account.',
    priority: 0.1,
    changefreq: 'yearly',
    noindex: true,
    breadcrumbs: [{ label: 'Home', path: '/' }, { label: 'Login' }],
  },
  {
    path: '/signup',
    title: 'Sign Up | Printyx - Start Your Free Trial',
    description: 'Create your Printyx account and start your free trial. No credit card required.',
    priority: 0.5,
    changefreq: 'yearly',
    noindex: false,
    breadcrumbs: [{ label: 'Home', path: '/' }, { label: 'Sign Up' }],
  },
];

/**
 * SEO configuration for authenticated app routes
 * These routes are typically noindexed
 */
export const APP_ROUTES_SEO: SEORouteConfig[] = [
  {
    path: '/dashboard',
    title: 'Dashboard | Printyx',
    description: 'Your Printyx dashboard - overview of your business metrics.',
    noindex: true,
    breadcrumbs: [{ label: 'Dashboard' }],
  },
  {
    path: '/customers',
    title: 'Customers | Printyx',
    description: 'Manage your customers and leads in Printyx.',
    noindex: true,
    breadcrumbs: [{ label: 'Dashboard', path: '/' }, { label: 'Customers' }],
  },
  {
    path: '/deals',
    title: 'Deals | Printyx',
    description: 'Manage your sales deals and opportunities.',
    noindex: true,
    breadcrumbs: [{ label: 'Dashboard', path: '/' }, { label: 'Deals' }],
  },
  {
    path: '/service-dispatch',
    title: 'Service Dispatch | Printyx',
    description: 'Dispatch and manage service calls.',
    noindex: true,
    breadcrumbs: [{ label: 'Dashboard', path: '/' }, { label: 'Service Dispatch' }],
  },
  {
    path: '/inventory',
    title: 'Inventory | Printyx',
    description: 'Manage your parts and supplies inventory.',
    noindex: true,
    breadcrumbs: [{ label: 'Dashboard', path: '/' }, { label: 'Inventory' }],
  },
  {
    path: '/reports',
    title: 'Reports | Printyx',
    description: 'View and generate business reports.',
    noindex: true,
    breadcrumbs: [{ label: 'Dashboard', path: '/' }, { label: 'Reports' }],
  },
  {
    path: '/settings',
    title: 'Settings | Printyx',
    description: 'Configure your Printyx account settings.',
    noindex: true,
    breadcrumbs: [{ label: 'Dashboard', path: '/' }, { label: 'Settings' }],
  },
];

/**
 * Get SEO config for a given path
 * Supports exact match and pattern matching for dynamic routes
 */
export function getSEOConfig(path: string): SEORouteConfig | null {
  // First try exact match in public routes
  const publicMatch = PUBLIC_ROUTES_SEO.find((r) => r.path === path);
  if (publicMatch) return publicMatch;

  // Then try app routes
  const appMatch = APP_ROUTES_SEO.find((r) => r.path === path);
  if (appMatch) return appMatch;

  // Handle dynamic routes with patterns
  // Blog post pattern: /blog/:slug
  if (path.startsWith('/blog/') && path !== '/blog') {
    return {
      path,
      title: 'Blog Post | Printyx',
      description: 'Read this article on the Printyx blog.',
      ogType: 'article',
      schema: 'BlogPosting',
      priority: 0.7,
      changefreq: 'monthly',
      breadcrumbs: [{ label: 'Home', path: '/' }, { label: 'Blog', path: '/blog' }, { label: 'Article' }],
    };
  }

  // Customer detail pattern: /customers/:slug
  if (path.startsWith('/customers/') && path !== '/customers') {
    return {
      path,
      title: 'Customer Details | Printyx',
      description: 'View customer details and history.',
      noindex: true,
      breadcrumbs: [
        { label: 'Dashboard', path: '/' },
        { label: 'Customers', path: '/customers' },
        { label: 'Customer Details' },
      ],
    };
  }

  // Knowledge base article pattern: /knowledge-base/article/:slug
  if (path.startsWith('/knowledge-base/article/')) {
    return {
      path,
      title: 'Knowledge Base Article | Printyx',
      description: 'Printyx knowledge base article and documentation.',
      ogType: 'article',
      schema: 'Article',
      priority: 0.6,
      changefreq: 'monthly',
      breadcrumbs: [
        { label: 'Home', path: '/' },
        { label: 'Knowledge Base', path: '/knowledge-base' },
        { label: 'Article' },
      ],
    };
  }

  return null;
}

/**
 * Get all SEO configs (for sitemap generation)
 */
export function getAllSEOConfigs(): SEORouteConfig[] {
  return [...PUBLIC_ROUTES_SEO, ...APP_ROUTES_SEO];
}

/**
 * Get related pages for internal linking
 */
export function getRelatedPages(path: string, limit: number = 5): SEORouteConfig[] {
  const config = getSEOConfig(path);
  if (!config?.relatedPaths) return [];

  return config.relatedPaths
    .map((p) => getSEOConfig(p))
    .filter((c): c is SEORouteConfig => c !== null)
    .slice(0, limit);
}
