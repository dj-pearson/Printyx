import { useLocation } from 'wouter';
import type { BreadcrumbItem } from '@/components/ui/breadcrumbs';

/**
 * Maps known top-level paths to human-readable labels.
 * Extend this map as new sections are added.
 */
const PATH_LABELS: Record<string, string> = {
  '': 'Home',
  customers: 'Customers',
  leads: 'Leads',
  'leads-management': 'Leads',
  contacts: 'Contacts',
  deals: 'Deals',
  'deals-management': 'Deals',
  quotes: 'Quotes',
  contracts: 'Contracts',
  leases: 'Leases',
  invoices: 'Invoices',
  reports: 'Reports',
  settings: 'Settings',
  'product-hub': 'Product Hub',
  'product-catalog': 'Product Catalog',
  inventory: 'Inventory',
  'equipment-lifecycle': 'Equipment Lifecycle',
  'service-dispatch': 'Service Dispatch',
  'service-hub': 'Service Hub',
  billing: 'Billing',
  'meter-billing': 'Meter Billing',
  'meter-readings': 'Meter Readings',
  'vendor-management': 'Vendor Management',
  crm: 'CRM',
  'crm-goals': 'CRM Goals',
  'sales-pipeline': 'Sales Pipeline',
  'task-hub': 'Tasks',
  tasks: 'Tasks',
  calendar: 'Calendar',
  'knowledge-base': 'Knowledge Base',
  onboarding: 'Onboarding',
  admin: 'Admin',
  'platform-crm': 'Platform CRM',
};

/**
 * Maps path patterns with dynamic segments to labels for the detail segment.
 * The key is the parent path, and the value is the label used for the detail page
 * when the actual entity name is not available.
 */
const DETAIL_LABELS: Record<string, string> = {
  customers: 'Customer Detail',
  leads: 'Lead Detail',
  quotes: 'Quote Detail',
  contracts: 'Contract Detail',
  leases: 'Lease Detail',
  companies: 'Company Detail',
  onboarding: 'Onboarding Detail',
};

interface UseBreadcrumbsOptions {
  /** Override the label for the current (last) breadcrumb item */
  currentLabel?: string;
}

/**
 * Hook that generates breadcrumb items from the current path.
 *
 * Usage:
 *   const items = useBreadcrumbs();
 *   // or with a custom label for the current page:
 *   const items = useBreadcrumbs({ currentLabel: customer.companyName });
 */
export function useBreadcrumbs(options?: UseBreadcrumbsOptions): BreadcrumbItem[] {
  const [location] = useLocation();
  const segments = location.split('/').filter(Boolean);

  if (segments.length === 0) {
    return [{ label: 'Home' }];
  }

  const items: BreadcrumbItem[] = [{ label: 'Home', href: '/' }];

  let currentPath = '';
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;
    const isLast = i === segments.length - 1;

    // Determine the label for this segment
    let label: string;
    if (isLast && options?.currentLabel) {
      // Use the provided override for the current page
      label = options.currentLabel;
    } else if (PATH_LABELS[segment]) {
      // Known path segment
      label = PATH_LABELS[segment];
    } else if (i > 0 && DETAIL_LABELS[segments[i - 1]]) {
      // Dynamic segment following a known parent (e.g., /customers/:slug)
      label = options?.currentLabel || DETAIL_LABELS[segments[i - 1]];
    } else {
      // Fallback: capitalize and de-hyphenate
      label = segment
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }

    items.push({
      label,
      href: isLast ? undefined : currentPath,
    });
  }

  return items;
}
