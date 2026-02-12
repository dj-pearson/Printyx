/**
 * useRouteAnnouncer Hook
 * WCAG 2.1 Level A - Page Titled (2.4.2), Status Messages (4.1.3)
 *
 * Announces route changes to screen readers so users know
 * when page navigation has occurred. Also sets document.title.
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { announceToScreenReader } from '@/lib/accessibility/utils';

/**
 * Map pathname to a human-readable page name for screen reader announcements
 */
function getPageName(pathname: string): string {
  // Remove leading slash and split by /
  const segments = pathname.replace(/^\//, '').split('/').filter(Boolean);

  if (segments.length === 0) return 'Dashboard';

  // Convert first segment to readable name
  const primary = segments[0]
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Handle sub-routes
  if (segments.length > 1) {
    const secondary = segments
      .slice(1)
      .map((s) =>
        s
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' '),
      )
      .join(' - ');
    return `${primary} - ${secondary}`;
  }

  return primary;
}

/**
 * Hook that announces page changes to screen readers and updates document title.
 * Should be called once at the app/router level.
 */
export function useRouteAnnouncer() {
  const [pathname] = useLocation();
  const previousPathname = useRef(pathname);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip the first render (initial page load is handled by the browser)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      previousPathname.current = pathname;
      // Set initial title
      const pageName = getPageName(pathname);
      document.title = `${pageName} | Printyx`;
      return;
    }

    // Only announce when the pathname actually changes
    if (pathname !== previousPathname.current) {
      const pageName = getPageName(pathname);
      document.title = `${pageName} | Printyx`;
      // Delay announcement slightly so the new content is rendered
      const timer = setTimeout(() => {
        announceToScreenReader(`Navigated to ${pageName}`, 'polite');
      }, 100);
      previousPathname.current = pathname;
      return () => clearTimeout(timer);
    }
  }, [pathname]);
}

export default useRouteAnnouncer;
