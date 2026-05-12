import { useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import {
  Lightbulb,
  ClipboardList,
  FileText,
  Image as ImageIcon,
  Network,
  Search as SearchIcon,
  Share2,
  Swords,
  BarChart3,
  RefreshCcw,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Blog Module — Admin Shell (US-BLOG-007)
 *
 * Wraps every /platform-admin/blog/* page with a secondary navigation strip.
 * Sub-nav: Ideas, Briefs, Posts, Distribution, Analytics, Refresh, Settings.
 *
 * Provides scoped keyboard shortcuts:
 *   g i → Ideas
 *   g b → Briefs
 *   g p → Posts
 *   g d → Distribution
 *   g a → Analytics
 *   g r → Refresh
 *   g s → Settings
 *
 * The global `useKeyboardShortcuts` hook bails on blog routes (see hook
 * implementation) so there's no conflict with non-blog `g i` (Invoices) etc.
 */

interface BlogShellProps {
  children: ReactNode;
  /** Page title surfaced via document.title for browser tab. */
  title?: string;
}

interface NavItem {
  label: string;
  path: string;
  icon: typeof Lightbulb;
  shortcut?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Ideas', path: '/platform-admin/blog/ideas', icon: Lightbulb, shortcut: 'g i' },
  { label: 'SERP', path: '/platform-admin/blog/serp', icon: SearchIcon, shortcut: 'g e' },
  { label: 'PAA', path: '/platform-admin/blog/paa', icon: Network, shortcut: 'g q' },
  { label: 'Gaps', path: '/platform-admin/blog/competitor-gap', icon: Swords, shortcut: 'g g' },
  { label: 'Briefs', path: '/platform-admin/blog/briefs', icon: ClipboardList, shortcut: 'g b' },
  { label: 'Posts', path: '/platform-admin/blog/posts', icon: FileText, shortcut: 'g p' },
  { label: 'Assets', path: '/platform-admin/blog/assets', icon: ImageIcon, shortcut: 'g m' },
  {
    label: 'Distribution',
    path: '/platform-admin/blog/distribution',
    icon: Share2,
    shortcut: 'g d',
  },
  { label: 'Analytics', path: '/platform-admin/blog/analytics', icon: BarChart3, shortcut: 'g a' },
  { label: 'Refresh', path: '/platform-admin/blog/refresh', icon: RefreshCcw, shortcut: 'g r' },
  { label: 'Settings', path: '/platform-admin/blog/settings', icon: Settings, shortcut: 'g s' },
];

export function BlogShell({ children, title }: BlogShellProps) {
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (title) {
      document.title = title;
    }
  }, [title]);

  // Blog-scoped keyboard shortcuts. Active only while on /platform-admin/blog/*
  // routes (the component is unmounted otherwise). The global useKeyboardShortcuts
  // bails on blog routes, so no double-fire.
  useEffect(() => {
    let pendingKey: string | null = null;
    let pendingTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      if (pendingKey) {
        const combo = `${pendingKey} ${key}`;
        const match = NAV_ITEMS.find((item) => item.shortcut === combo);
        if (match) {
          e.preventDefault();
          navigate(match.path);
        }
        pendingKey = null;
        if (pendingTimeout) {
          clearTimeout(pendingTimeout);
          pendingTimeout = null;
        }
        return;
      }

      if (key === 'g') {
        pendingKey = 'g';
        pendingTimeout = setTimeout(() => {
          pendingKey = null;
        }, 1000);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (pendingTimeout) clearTimeout(pendingTimeout);
    };
  }, [navigate]);

  return (
    <div className="flex flex-col">
      {/* Sub-navigation strip */}
      <nav aria-label="Blog navigation" className="border-b bg-background sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto -mb-px py-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path || location.startsWith(item.path + '/');
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                  data-testid={`blog-nav-${item.label.toLowerCase()}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                  {item.shortcut ? (
                    <kbd className="hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
                      {item.shortcut}
                    </kbd>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Page content */}
      <div className="flex-1">{children}</div>
    </div>
  );
}

export default BlogShell;
