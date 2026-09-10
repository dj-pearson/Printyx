/**
 * SEO Route Configuration System
 * Centralized SEO metadata for all routes - enables programmatic SEO at scale
 */

export interface FAQItem {
  question: string;
  answer: string;
}

export interface HowToStep {
  name: string;
  text: string;
  image?: string;
}

export interface LocalBusinessData {
  address?: {
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    postalCode: string;
    addressCountry: string;
  };
  geo?: {
    latitude: number;
    longitude: number;
  };
  openingHours?: Array<{
    dayOfWeek: string | string[];
    opens: string;
    closes: string;
  }>;
}

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
  /**
   * ISO date the article was published, and last substantively changed.
   * BOTH ARE OPTIONAL AND MUST STAY THAT WAY. generateArticleSchema used to
   * emit `new Date().toISOString()` for each, so every post told every crawler
   * it had been published moments ago - and datePublished is the date Google
   * prints beside an article in results. A post with no known date now emits no
   * date, which is a smaller claim than the wrong one.
   */
  datePublished?: string;
  dateModified?: string;
  // JSON-LD schema data for rich results
  faqItems?: FAQItem[]; // For FAQPage schema
  howToSteps?: HowToStep[]; // For HowTo schema
  howToEstimatedTime?: string; // ISO 8601 duration for HowTo
  localBusiness?: LocalBusinessData; // For LocalBusiness schema
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
  | 'BreadcrumbList'
  | 'ItemList';

// Base URL for the site
export const SITE_URL = 'https://printyx.net';
export const SITE_NAME = 'Printyx';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

// Organization schema data
export const ORGANIZATION_DATA = {
  name: 'Printyx',
  url: SITE_URL,
  logo: `${SITE_URL}/logos/logo.png`,
  description:
    'Printyx is a modern cloud platform for copier dealers and managed print service providers. Streamline your CRM, service dispatch, billing, and more.',
  sameAs: [
    'https://twitter.com/printyx',
    'https://www.linkedin.com/company/printyx',
    'https://www.youtube.com/@printyx',
  ],
  contactPoint: {
    // No telephone. It was '+1-800-PRINTYX', which is not a dialable number -
    // E.164 wants digits - and appears nowhere on the site, so it was a phone
    // number published to search engines and to nobody else. support@ is real:
    // the holding page already gives it out.
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
    schema: 'HowTo',
    priority: 0.8,
    changefreq: 'monthly',
    breadcrumbs: [{ label: 'Home', path: '/' }, { label: 'ROI Calculator' }],
    relatedPaths: ['/case-studies', '/pricing', '/print-cost-calculator'],
    howToEstimatedTime: 'PT5M',
    howToSteps: [
      {
        name: 'Enter Your Current Costs',
        text: 'Input your current monthly spend on dealer management software, including license fees, server hosting, and IT support costs.',
      },
      {
        name: 'Add Your Operational Data',
        text: 'Enter the number of technicians, monthly service calls, and devices under management to calculate operational savings.',
      },
      {
        name: 'Review Your Savings Projection',
        text: 'See your projected annual savings, ROI percentage, and payback period when switching from legacy systems to Printyx.',
      },
    ],
  },
  {
    path: '/print-cost-calculator',
    title: 'Print Cost Calculator | What Your Fleet Actually Costs',
    description:
      'Work out the true cost of your print fleet - devices, pages, supplies and service - and see where the savings are. Three steps, no signup.',
    keywords: [
      'print cost calculator',
      'cost per page calculator',
      'managed print services cost',
      'copier fleet cost analysis',
    ],
    ogType: 'website',
    schema: 'HowTo',
    priority: 0.8,
    changefreq: 'monthly',
    breadcrumbs: [{ label: 'Home', path: '/' }, { label: 'Print Cost Calculator' }],
    relatedPaths: ['/roi-calculator', '/case-studies'],
    howToEstimatedTime: 'PT5M',
    howToSteps: [
      {
        name: 'Describe Your Fleet',
        text: 'Enter how many devices you run, what kinds they are, how old they are and roughly how many pages a month they produce.',
      },
      {
        name: 'Add Any Costs You Know',
        text: 'Optional. Add what you currently pay for supplies, service and leases so the estimate uses your figures instead of industry averages.',
      },
      {
        name: 'Read Your Cost Breakdown',
        text: 'See cost per page by device type, where your fleet sits against industry benchmarks, and what each change would be worth.',
      },
    ],
  },
  {
    path: '/case-studies',
    title: 'Customer Success Stories | Printyx Case Studies',
    description:
      'See how copier dealers are transforming their business with Printyx. Real results from real customers.',
    keywords: [
      'copier dealer success stories',
      'MPS case studies',
      'copier dealer software comparison',
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
    datePublished: '2025-01-15',
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
    datePublished: '2025-01-12',
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
    datePublished: '2025-01-10',
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
  // Legal pages. These five were in App.tsx and in COMING_SOON_ROUTES but not
  // here, so getSEOConfig returned null for them and they fell through to the
  // default config - which is now noindex (SEO-013). A published policy that a
  // regulator or a customer is meant to be able to find must be indexable, so
  // they are enumerated like every other public route.
  {
    path: '/cookies',
    title: 'Cookie Policy | Printyx',
    description: 'How Printyx uses cookies and similar technologies, and how to control them.',
    priority: 0.3,
    changefreq: 'yearly',
    breadcrumbs: [{ label: 'Home', path: '/' }, { label: 'Cookie Policy' }],
  },
  {
    path: '/do-not-sell',
    title: 'Do Not Sell or Share My Personal Information | Printyx',
    description:
      'Exercise your right to opt out of the sale or sharing of personal information under US state privacy laws.',
    priority: 0.3,
    changefreq: 'yearly',
    breadcrumbs: [{ label: 'Home', path: '/' }, { label: 'Do Not Sell or Share' }],
  },
  {
    path: '/data-sources',
    title: 'Data Sources | Printyx',
    description: 'Where the data in Printyx comes from and how it is obtained.',
    priority: 0.3,
    changefreq: 'yearly',
    breadcrumbs: [{ label: 'Home', path: '/' }, { label: 'Data Sources' }],
  },
  {
    path: '/subprocessors',
    title: 'Subprocessors | Printyx',
    description: 'The third parties Printyx uses to process customer data, and what each one does.',
    priority: 0.3,
    changefreq: 'yearly',
    breadcrumbs: [{ label: 'Home', path: '/' }, { label: 'Subprocessors' }],
  },
  {
    path: '/dpa',
    title: 'Data Processing Agreement | Printyx',
    description: 'The data processing terms that apply between Printyx and its customers.',
    priority: 0.3,
    changefreq: 'yearly',
    breadcrumbs: [{ label: 'Home', path: '/' }, { label: 'Data Processing Agreement' }],
  },
  {
    path: '/eula',
    title: 'End User License Agreement | Printyx',
    description:
      'Printyx End User License Agreement. Terms and conditions for using the Printyx platform.',
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

  // Comparison & Competitive Pages
  {
    path: '/compare-eautomate',
    title: 'Printyx vs E-Automate | Modern Cloud Alternative for Copier Dealers',
    description:
      'Detailed comparison of Printyx vs ConnectWise E-Automate. See why copier dealers are switching to modern cloud-based dealer management with AI-powered intelligence.',
    keywords: [
      'Printyx vs E-Automate',
      'E-Automate alternative',
      'E-Automate replacement',
      'copier dealer software comparison',
      'ConnectWise E-Automate vs cloud',
      'modern dealer management',
    ],
    ogType: 'article',
    schema: 'FAQPage',
    priority: 0.9,
    changefreq: 'monthly',
    breadcrumbs: [{ label: 'Home', path: '/' }, { label: 'Printyx vs E-Automate' }],
    relatedPaths: ['/battle-card', '/modern-architecture', '/case-studies'],
    faqItems: [
      {
        question: 'What is the best alternative to E-Automate for copier dealers?',
        answer:
          'Printyx is a modern cloud-based alternative to ConnectWise E-Automate. It provides all the same dealer management capabilities (CRM, service dispatch, billing, inventory) with added AI-powered predictive intelligence, mobile-first design, and no on-premise infrastructure requirements.',
      },
      {
        question: 'How does Printyx compare to E-Automate?',
        answer:
          'Printyx offers a 2-3 year technical advantage over E-Automate with modern cloud architecture, AI-powered predictive maintenance, mobile-first field service tools, and real-time analytics. Unlike E-Automate, Printyx requires no server maintenance or IT overhead.',
      },
      {
        question: 'Can I migrate from E-Automate to Printyx?',
        answer:
          'Yes, Printyx provides migration tools and dedicated support to help dealers transition from E-Automate. The migration process includes data import for customers, contracts, equipment, and service history.',
      },
      {
        question: 'Does Printyx work with the same equipment manufacturers as E-Automate?',
        answer:
          'Yes, Printyx integrates with all major copier manufacturers including Canon, Ricoh, HP, Konica Minolta, Xerox, and more. The Integration Marketplace provides pre-built connectors for manufacturer APIs and data feeds.',
      },
    ],
  },

  // Pricing Page
  {
    path: '/pricing',
    title: 'Pricing | Printyx - Transparent Plans for Copier Dealers',
    description:
      'Simple, transparent pricing for copier dealers and MPS providers. Starter at $49/user/month, Professional at $79/user/month. Free trial, no credit card required.',
    keywords: [
      'copier dealer software pricing',
      'MPS software cost',
      'dealer management pricing',
      'E-Automate pricing alternative',
      'copier CRM pricing',
    ],
    ogType: 'product',
    schema: 'FAQPage',
    priority: 0.9,
    changefreq: 'monthly',
    breadcrumbs: [{ label: 'Home', path: '/' }, { label: 'Pricing' }],
    relatedPaths: ['/roi-calculator', '/case-studies', '/signup'],
    faqItems: [
      {
        question: 'How much does Printyx cost for copier dealers?',
        answer:
          'Printyx starts at $49/user/month for the Starter plan (up to 10 users) and $79/user/month for the Professional plan with full feature access. Enterprise pricing is custom for large multi-location operations. All plans include a free trial with no credit card required.',
      },
      {
        question: 'Is there a free trial available?',
        answer:
          'Yes, Printyx offers a free trial with no credit card required. You can explore all features before committing to a paid plan.',
      },
      {
        question: 'How does Printyx pricing compare to E-Automate?',
        answer:
          'Printyx eliminates the need for on-premise servers, IT staff for maintenance, and per-module licensing fees. We do not publish a comparative cost-savings percentage, because we have not measured one across a customer base; price it against your own infrastructure and support costs.',
      },
      {
        question: 'What is included in each Printyx plan?',
        answer:
          'All plans include CRM, service dispatch, billing, and reporting. The Professional plan adds AI-powered predictive intelligence, advanced analytics, custom workflows, and priority support. Enterprise adds multi-location management and dedicated success managers.',
      },
      {
        question: 'Can I switch plans or cancel anytime?',
        answer:
          'Yes, you can upgrade or downgrade your plan at any time. There are no long-term contracts required, and you can cancel with 30 days notice.',
      },
    ],
  },

  // Knowledge Base
  {
    path: '/knowledge-base',
    title: 'Knowledge Base | Printyx Help Center & Documentation',
    description:
      'Find answers, tutorials, and guides for using Printyx. Searchable knowledge base for copier dealer platform setup, configuration, and best practices.',
    keywords: [
      'Printyx documentation',
      'copier dealer software help',
      'MPS platform tutorials',
      'Printyx knowledge base',
      'dealer management guides',
    ],
    ogType: 'website',
    schema: 'WebPage',
    priority: 0.7,
    changefreq: 'weekly',
    breadcrumbs: [{ label: 'Home', path: '/' }, { label: 'Knowledge Base' }],
    relatedPaths: ['/blog', '/case-studies'],
  },

  // Accessibility
  {
    path: '/accessibility',
    title: 'Accessibility Statement | Printyx',
    description:
      'Printyx accessibility commitment. How we ensure our platform is accessible to all users.',
    ogType: 'website',
    schema: 'WebPage',
    priority: 0.3,
    changefreq: 'yearly',
    noindex: false,
    breadcrumbs: [{ label: 'Home', path: '/' }, { label: 'Accessibility' }],
  },

  // Feature-specific landing pages for GEO
  {
    path: '/autopilot',
    title: 'Autopilot Workflows | Automate Copier Dealer Operations | Printyx',
    description:
      'Automate repetitive tasks across your copier dealership. Printyx Autopilot handles lead routing, service dispatch, billing triggers, and supply reordering automatically.',
    keywords: [
      'copier dealer automation',
      'MPS workflow automation',
      'automated service dispatch',
      'dealer task automation',
      'copier business automation',
    ],
    ogType: 'product',
    schema: 'SoftwareApplication',
    priority: 0.8,
    changefreq: 'monthly',
    breadcrumbs: [{ label: 'Home', path: '/' }, { label: 'Autopilot Workflows' }],
    relatedPaths: ['/predictive-intelligence', '/p/print-service-dispatch-mobile'],
  },
  {
    path: '/fleet-monitoring',
    title: 'Fleet Monitoring Dashboard | Real-Time Copier Fleet Visibility | Printyx',
    description:
      'Monitor your entire copier fleet in real time. Track device status, meter counts, supply levels, and service alerts across all customer locations from one dashboard.',
    keywords: [
      'copier fleet monitoring',
      'print fleet dashboard',
      'MPS fleet management',
      'device monitoring software',
      'PrintFleet alternative',
      'FMAudit alternative',
    ],
    ogType: 'product',
    schema: 'SoftwareApplication',
    priority: 0.8,
    changefreq: 'monthly',
    breadcrumbs: [{ label: 'Home', path: '/' }, { label: 'Fleet Monitoring' }],
    relatedPaths: ['/predictive-intelligence', '/p/print-service-dispatch-mobile'],
  },
  {
    path: '/quickbooks-integration',
    title: 'QuickBooks Integration for Copier Dealers | Printyx',
    description:
      'Sync Printyx with QuickBooks Online and Desktop. Automate invoicing, payment tracking, and financial reporting for your copier dealership.',
    keywords: [
      'QuickBooks copier dealer',
      'copier billing QuickBooks',
      'MPS QuickBooks integration',
      'dealer accounting integration',
    ],
    ogType: 'product',
    schema: 'Product',
    priority: 0.7,
    changefreq: 'monthly',
    breadcrumbs: [
      { label: 'Home', path: '/' },
      { label: 'Integrations', path: '/integration-marketplace' },
      { label: 'QuickBooks' },
    ],
    relatedPaths: ['/integration-marketplace', '/erp-integration'],
  },
  {
    path: '/erp-integration',
    title: 'ERP Integration for Copier Dealers | Connect Your Business Systems | Printyx',
    description:
      'Connect Printyx to your existing ERP system. Bi-directional sync with SAP, Oracle, Microsoft Dynamics, and other enterprise platforms.',
    keywords: [
      'copier dealer ERP integration',
      'MPS ERP sync',
      'dealer management ERP',
      'SAP copier integration',
    ],
    ogType: 'product',
    schema: 'Product',
    priority: 0.7,
    changefreq: 'monthly',
    breadcrumbs: [
      { label: 'Home', path: '/' },
      { label: 'Integrations', path: '/integration-marketplace' },
      { label: 'ERP Integration' },
    ],
    relatedPaths: ['/integration-marketplace', '/quickbooks-integration'],
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
  // Index pruning: additional authenticated/thin routes that must be noindexed
  {
    path: '/onboarding',
    title: 'Onboarding | Printyx',
    description: 'Set up your Printyx account.',
    noindex: true,
  },
  {
    path: '/tenant-setup',
    title: 'Tenant Setup | Printyx',
    description: 'Configure your organization.',
    noindex: true,
  },
  {
    path: '/billing',
    title: 'Billing | Printyx',
    description: 'Manage billing and invoices.',
    noindex: true,
  },
  {
    path: '/invoices',
    title: 'Invoices | Printyx',
    description: 'View and manage invoices.',
    noindex: true,
  },
  {
    path: '/quotes',
    title: 'Quotes | Printyx',
    description: 'Manage quotes and proposals.',
    noindex: true,
  },
  {
    path: '/crm',
    title: 'CRM | Printyx',
    description: 'Customer relationship management.',
    noindex: true,
  },
  { path: '/admin', title: 'Admin | Printyx', description: 'Administration panel.', noindex: true },
  {
    path: '/root-admin',
    title: 'Root Admin | Printyx',
    description: 'Platform administration.',
    noindex: true,
  },
  {
    path: '/database-management',
    title: 'Database Management | Printyx',
    description: 'Database tools.',
    noindex: true,
  },
  {
    path: '/role-management',
    title: 'Role Management | Printyx',
    description: 'Manage roles and permissions.',
    noindex: true,
  },
];

/**
 * Get SEO config for a given path
 * Supports exact match and pattern matching for dynamic routes
 */
/**
 * An EXACT entry for a path, or null when there is none.
 *
 * Use this when "we have no metadata for this route" is the answer you need -
 * a link title, a related-links list. getSEOConfig below never returns null
 * any more (SEO-013), so `config?.title` there resolves to the literal
 * 'Printyx' for every unknown route, which is a worse link label than none and
 * would let a stale relatedPath render as a real destination.
 */
export function findSEOConfig(path: string): SEORouteConfig | null {
  return (
    PUBLIC_ROUTES_SEO.find((r) => r.path === path) ??
    APP_ROUTES_SEO.find((r) => r.path === path) ??
    null
  );
}

/** Always resolves: an exact entry, a pattern match, or the noindex default. */
export function getSEOConfig(path: string): SEORouteConfig {
  // First try exact match in public routes
  const publicMatch = PUBLIC_ROUTES_SEO.find((r) => r.path === path);
  if (publicMatch) return publicMatch;

  // Then try app routes
  const appMatch = APP_ROUTES_SEO.find((r) => r.path === path);
  if (appMatch) return appMatch;

  // Handle dynamic routes with patterns
  // Blog post pattern: /blog/:slug
  if (path.startsWith('/blog/') && path !== '/blog') {
    // Unreachable today - App.tsx routes the three published posts explicitly
    // and there is no /blog/:slug route - but if one is added, this generic
    // title and description would be identical on every post. Carry no date
    // either: a BlogPosting with no datePublished is honest about not knowing,
    // and this fallback cannot know.
    return {
      path,
      title: 'Blog Post | Printyx',
      description: 'Read this article on the Printyx blog.',
      ogType: 'article',
      schema: 'BlogPosting',
      priority: 0.7,
      changefreq: 'monthly',
      breadcrumbs: [
        { label: 'Home', path: '/' },
        { label: 'Blog', path: '/blog' },
        { label: 'Article' },
      ],
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

  /*
   * Anything not matched above is not public (SEO-013).
   *
   * This used to be a list of 22 noindex PREFIXES - /admin, /settings, /crm and
   * so on - and any route outside it fell through to `null`, which SEOProvider
   * turns into DEFAULT_SEO_CONFIG and a robots tag of
   * `index, follow, max-image-preview:large`. The app has around 250
   * authenticated routes and 189 of them were outside that list, so most of the
   * product told crawlers to index it. Nothing to index is behind the login, but
   * the URLs are still crawled, and robots.txt only disallows about 28 prefixes,
   * so most were not blocked there either.
   *
   * An allowlist of what to HIDE can only ever lag the routes people add. The
   * public surface is small and enumerated in PUBLIC_ROUTES_SEO; everything else
   * is the application. Defaulting to noindex means a new app page is private on
   * the day it is written, and a new PUBLIC page has to be added to the table -
   * which it needs anyway, for its title, description and sitemap entry.
   */
  return {
    path,
    title: 'Printyx',
    description: 'Printyx copier dealer management platform.',
    noindex: true,
  };
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
    .map((p) => findSEOConfig(p))
    .filter((c): c is SEORouteConfig => c !== null)
    .slice(0, limit);
}

/**
 * Marketing landing-page slugs that live under `/p/`.
 *
 * `/p/:token` is the public proposal viewer (App.tsx), an early return above the
 * auth gate. Marketing landing pages share that prefix, so App.tsx has to tell
 * the two apart. It used to do that with a hardcoded set of two slugs plus a
 * "share tokens are >= 20 chars" heuristic - and
 * `/p/master-product-catalog-canon-imagerunner` is 39 characters, so that page
 * rendered the proposal viewer instead of itself on every request, including
 * for a crawler. Deriving the set from the SEO route table means adding a
 * landing page can never re-open that hole.
 */
export const MARKETING_P_SLUGS: ReadonlySet<string> = new Set(
  PUBLIC_ROUTES_SEO.filter((r) => r.path.startsWith('/p/')).map(
    (r) => r.path.slice(3).split('/')[0],
  ),
);

/**
 * The public URLs that belong in sitemap.xml.
 *
 * Two exclusions, and the second is the one that bites. A noindex route must
 * not be listed: telling a crawler to fetch a page and then not to index it is
 * a contradiction it resolves by trusting neither signal. And while the site is
 * closed, every marketing route serves the holding page - which is itself
 * noindex - so publishing those URLs would file 24 "Submitted URL marked
 * noindex" errors in Search Console against pages that are all the same page.
 * A sitemap describes what is live, not what is planned.
 *
 * `closed` mirrors App.tsx's COMING_SOON: closed unless explicitly opened.
 */
export function getSitemapRoutes(
  closed: boolean = import.meta.env?.VITE_COMING_SOON !== 'false',
): SEORouteConfig[] {
  const live = closed
    ? PUBLIC_ROUTES_SEO.filter((r) => COMING_SOON_ROUTES.includes(r.path))
    : PUBLIC_ROUTES_SEO;
  return live.filter((r) => !r.noindex);
}

/**
 * The public site is closed while the product is built (`COMING_SOON` in
 * App.tsx, default on). While it is closed, only these routes render
 * themselves; every other marketing URL serves the holding page, which sets
 * noindex.
 *
 * Kept here rather than derived from App.tsx because a sitemap generator must
 * not parse JSX to decide what to publish. `seo-sitemap.test.ts` asserts this
 * list against App.tsx's closed-site Switch, so the two cannot drift.
 */
export const COMING_SOON_ROUTES: readonly string[] = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/auth/callback',
  '/eula',
  '/privacy',
  '/terms',
  '/accessibility',
  '/do-not-sell',
  '/data-sources',
  '/cookies',
  '/subprocessors',
  '/dpa',
];
