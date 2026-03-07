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
    schema: 'HowTo',
    priority: 0.8,
    changefreq: 'monthly',
    breadcrumbs: [{ label: 'Home', path: '/' }, { label: 'ROI Calculator' }],
    relatedPaths: ['/case-studies', '/pricing'],
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
        answer: 'Printyx is a modern cloud-based alternative to ConnectWise E-Automate. It provides all the same dealer management capabilities (CRM, service dispatch, billing, inventory) with added AI-powered predictive intelligence, mobile-first design, and no on-premise infrastructure requirements.',
      },
      {
        question: 'How does Printyx compare to E-Automate?',
        answer: 'Printyx offers a 2-3 year technical advantage over E-Automate with modern cloud architecture, AI-powered predictive maintenance, mobile-first field service tools, and real-time analytics. Unlike E-Automate, Printyx requires no server maintenance or IT overhead.',
      },
      {
        question: 'Can I migrate from E-Automate to Printyx?',
        answer: 'Yes, Printyx provides migration tools and dedicated support to help dealers transition from E-Automate. The migration process includes data import for customers, contracts, equipment, and service history.',
      },
      {
        question: 'Does Printyx work with the same equipment manufacturers as E-Automate?',
        answer: 'Yes, Printyx integrates with all major copier manufacturers including Canon, Ricoh, HP, Konica Minolta, Xerox, and more. The Integration Marketplace provides pre-built connectors for manufacturer APIs and data feeds.',
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
        answer: 'Printyx starts at $49/user/month for the Starter plan (up to 10 users) and $79/user/month for the Professional plan with full feature access. Enterprise pricing is custom for large multi-location operations. All plans include a free trial with no credit card required.',
      },
      {
        question: 'Is there a free trial available?',
        answer: 'Yes, Printyx offers a free trial with no credit card required. You can explore all features before committing to a paid plan.',
      },
      {
        question: 'How does Printyx pricing compare to E-Automate?',
        answer: 'Printyx eliminates the need for on-premise servers, IT staff for maintenance, and per-module licensing fees. Most dealers see 15-25% total cost savings compared to E-Automate when factoring in infrastructure and support costs.',
      },
      {
        question: 'What is included in each Printyx plan?',
        answer: 'All plans include CRM, service dispatch, billing, and reporting. The Professional plan adds AI-powered predictive intelligence, advanced analytics, custom workflows, and priority support. Enterprise adds multi-location management and dedicated success managers.',
      },
      {
        question: 'Can I switch plans or cancel anytime?',
        answer: 'Yes, you can upgrade or downgrade your plan at any time. There are no long-term contracts required, and you can cancel with 30 days notice.',
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
    description: 'Printyx accessibility commitment. How we ensure our platform is accessible to all users.',
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
  { path: '/onboarding', title: 'Onboarding | Printyx', description: 'Set up your Printyx account.', noindex: true },
  { path: '/tenant-setup', title: 'Tenant Setup | Printyx', description: 'Configure your organization.', noindex: true },
  { path: '/billing', title: 'Billing | Printyx', description: 'Manage billing and invoices.', noindex: true },
  { path: '/invoices', title: 'Invoices | Printyx', description: 'View and manage invoices.', noindex: true },
  { path: '/quotes', title: 'Quotes | Printyx', description: 'Manage quotes and proposals.', noindex: true },
  { path: '/crm', title: 'CRM | Printyx', description: 'Customer relationship management.', noindex: true },
  { path: '/admin', title: 'Admin | Printyx', description: 'Administration panel.', noindex: true },
  { path: '/root-admin', title: 'Root Admin | Printyx', description: 'Platform administration.', noindex: true },
  { path: '/database-management', title: 'Database Management | Printyx', description: 'Database tools.', noindex: true },
  { path: '/role-management', title: 'Role Management | Printyx', description: 'Manage roles and permissions.', noindex: true },
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

  // Index pruning: default noindex for any authenticated/internal paths
  // This prevents thin or auto-generated pages from diluting domain quality signals
  const noindexPrefixes = [
    '/admin', '/root-admin', '/settings', '/dashboard', '/onboarding',
    '/tenant-setup', '/billing', '/invoices', '/quotes', '/crm',
    '/deals', '/service-dispatch', '/service-hub', '/inventory',
    '/reports', '/database-management', '/role-management', '/gpt5-dashboard',
    '/proposal-', '/mobile-field-service', '/ai-hub', '/ai-',
  ];
  if (noindexPrefixes.some((prefix) => path.startsWith(prefix))) {
    return {
      path,
      title: `Printyx`,
      description: 'Printyx copier dealer management platform.',
      noindex: true,
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
