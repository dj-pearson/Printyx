import { Link, useLocation } from 'wouter';
import { Globe, History, Mic2, ScrollText, ShieldAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Secondary navigation rendered at the top of every blog settings page.
 * Lets the platform admin switch between settings sub-sections without
 * leaving the Settings tab.
 *
 * Future sub-sections (added by their respective stories): Style Guides
 * (US-BLOG-005), CMS Targets (US-BLOG-006), Distribution Targets, AI
 * Cost Quotas (US-BLOG-079), etc.
 */

interface SettingsNavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  description: string;
}

const SETTINGS_NAV: SettingsNavItem[] = [
  {
    label: 'Agent Controls',
    path: '/platform-admin/blog/settings',
    icon: ShieldAlert,
    description: 'Kill switch and auto-refresh review gate',
  },
  {
    label: 'Brand Voices',
    path: '/platform-admin/blog/settings/brand-voices',
    icon: Mic2,
    description: 'Voice + persona profiles for AI draft generation',
  },
  {
    label: 'Style Guides',
    path: '/platform-admin/blog/settings/style-guides',
    icon: ScrollText,
    description: 'Prose rules + built-in rule packs (AP, Chicago, MLA, …)',
  },
  {
    label: 'CMS Targets',
    path: '/platform-admin/blog/settings/cms-targets',
    icon: Globe,
    description: 'WordPress + Ghost endpoints for the publish flow',
  },
  {
    label: 'Audit Log',
    path: '/platform-admin/blog/settings/audit-log',
    icon: History,
    description: 'Forensic record of every mutating action',
  },
];

export function BlogSettingsNav() {
  const [location] = useLocation();

  return (
    <nav aria-label="Settings navigation" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {SETTINGS_NAV.map((item) => {
        const Icon = item.icon;
        const isActive = location === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              'flex items-start gap-3 rounded-md border p-3 transition-colors',
              isActive
                ? 'border-primary/40 bg-primary/5'
                : 'border-border hover:border-primary/30 hover:bg-muted/30',
            )}
            data-testid={`settings-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <Icon
              className={cn(
                'h-4 w-4 mt-0.5 shrink-0',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )}
            />
            <div className="space-y-0.5">
              <div className={cn('text-sm font-medium', isActive ? 'text-primary' : '')}>
                {item.label}
              </div>
              <div className="text-xs text-muted-foreground">{item.description}</div>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}

export default BlogSettingsNav;
