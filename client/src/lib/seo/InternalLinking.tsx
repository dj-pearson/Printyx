/**
 * Internal Linking System for SEO
 * Automatically generates contextual internal links
 */

import React from 'react';
import { Link } from 'wouter';
import { getRelatedPages, getSEOConfig, type SEORouteConfig } from './seoConfig';

interface RelatedLinksProps {
  currentPath: string;
  limit?: number;
  title?: string;
  className?: string;
}

interface InternalLinkProps {
  to: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
}

/**
 * Smart internal link component
 * Adds proper attributes for SEO
 */
export function InternalLink({ to, children, className, title }: InternalLinkProps) {
  // Get SEO config for the destination to use as title if not provided
  const config = getSEOConfig(to);
  const linkTitle = title || config?.title?.split(' | ')[0];

  return (
    <Link
      href={to}
      className={className}
      title={linkTitle}
      aria-label={linkTitle}
    >
      {children}
    </Link>
  );
}

/**
 * Related Links Component
 * Shows contextually relevant internal links for SEO
 */
export function RelatedLinks({
  currentPath,
  limit = 5,
  title = 'Related Resources',
  className = '',
}: RelatedLinksProps) {
  const relatedPages = getRelatedPages(currentPath, limit);

  if (relatedPages.length === 0) return null;

  return (
    <aside className={`related-links ${className}`} aria-label="Related content">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <nav aria-label="Related pages">
        <ul className="space-y-2">
          {relatedPages.map((page) => (
            <li key={page.path}>
              <InternalLink
                to={page.path}
                className="text-blue-600 hover:text-blue-800 hover:underline"
              >
                {page.title.split(' | ')[0]}
              </InternalLink>
              {page.description && (
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{page.description}</p>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

/**
 * Breadcrumb component with schema support
 * Renders accessible breadcrumb navigation
 */
export function Breadcrumbs({
  items,
  className = '',
}: {
  items: Array<{ label: string; path?: string }>;
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={`breadcrumbs ${className}`}>
      <ol className="flex items-center space-x-2 text-sm text-gray-600">
        {items.map((item, index) => (
          <li key={index} className="flex items-center">
            {index > 0 && (
              <span className="mx-2 text-gray-400" aria-hidden="true">
                /
              </span>
            )}
            {item.path && index < items.length - 1 ? (
              <InternalLink
                to={item.path}
                className="hover:text-blue-600 hover:underline"
              >
                {item.label}
              </InternalLink>
            ) : (
              <span className="text-gray-900 font-medium" aria-current="page">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * Topic cluster component
 * Groups related content by topic for SEO siloing
 */
export function TopicCluster({
  topic,
  pages,
  className = '',
}: {
  topic: string;
  pages: SEORouteConfig[];
  className?: string;
}) {
  return (
    <section className={`topic-cluster ${className}`} aria-labelledby={`topic-${topic}`}>
      <h2 id={`topic-${topic}`} className="text-xl font-bold mb-4">
        {topic}
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pages.map((page) => (
          <li key={page.path} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
            <InternalLink to={page.path} className="block">
              <h3 className="font-semibold text-blue-600 hover:underline">
                {page.title.split(' | ')[0]}
              </h3>
              <p className="text-sm text-gray-600 mt-2 line-clamp-2">{page.description}</p>
            </InternalLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Footer sitemap links for SEO
 * Common navigation structure for search engines
 */
export function FooterSitemapLinks() {
  const sections = [
    {
      title: 'Platform',
      links: [
        { path: '/p/copier-dealer-crm', label: 'CRM for Copier Dealers' },
        { path: '/p/print-service-dispatch-mobile', label: 'Mobile Service Dispatch' },
        { path: '/predictive-intelligence', label: 'Predictive Intelligence' },
        { path: '/modern-architecture', label: 'Modern Architecture' },
      ],
    },
    {
      title: 'Integrations',
      links: [
        { path: '/integration-marketplace', label: 'Integration Marketplace' },
        { path: '/quickbooks-integration', label: 'QuickBooks Integration' },
        { path: '/erp-integration', label: 'ERP Integration' },
      ],
    },
    {
      title: 'Resources',
      links: [
        { path: '/blog', label: 'Blog' },
        { path: '/case-studies', label: 'Case Studies' },
        { path: '/roi-calculator', label: 'ROI Calculator' },
        { path: '/knowledge-base', label: 'Knowledge Base' },
      ],
    },
    {
      title: 'Company',
      links: [
        { path: '/dealer-expertise', label: 'About Us' },
        { path: '/battle-card', label: 'Why Printyx' },
        { path: '/compare-eautomate', label: 'E-Automate Alternative' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { path: '/terms', label: 'Terms of Service' },
        { path: '/privacy', label: 'Privacy Policy' },
        { path: '/eula', label: 'EULA' },
      ],
    },
  ];

  return (
    <nav aria-label="Footer navigation" className="grid gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
      {sections.map((section) => (
        <div key={section.title}>
          <h3 className="font-semibold text-gray-900 mb-3">{section.title}</h3>
          <ul className="space-y-2">
            {section.links.map((link) => (
              <li key={link.path}>
                <InternalLink
                  to={link.path}
                  className="text-gray-600 hover:text-blue-600 text-sm"
                >
                  {link.label}
                </InternalLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/**
 * Contextual CTA with internal linking
 */
export function ContextualCTA({
  primaryPath,
  primaryLabel,
  secondaryPath,
  secondaryLabel,
  className = '',
}: {
  primaryPath: string;
  primaryLabel: string;
  secondaryPath?: string;
  secondaryLabel?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap gap-4 ${className}`}>
      <InternalLink
        to={primaryPath}
        className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
      >
        {primaryLabel}
      </InternalLink>
      {secondaryPath && secondaryLabel && (
        <InternalLink
          to={secondaryPath}
          className="inline-flex items-center px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          {secondaryLabel}
        </InternalLink>
      )}
    </div>
  );
}

export default RelatedLinks;
