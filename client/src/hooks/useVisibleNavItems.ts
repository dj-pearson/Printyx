/**
 * useVisibleNavItems Hook
 *
 * RBAC-007: Returns the filtered navigation tree based on the current user's
 * permissions, role level, and platform status.
 *
 * Uses navigation-permissions.ts rules synchronously from the usePermissions()
 * hook cache to avoid loading flicker.
 */

import { useMemo } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import {
  SECTION_PERMISSIONS,
  ITEM_PERMISSIONS,
  checkNavigationAccess,
} from '@/lib/navigation-permissions';

interface NavItem {
  path: string;
  visible: boolean;
}

interface NavSection {
  key: string;
  visible: boolean;
  items: NavItem[];
}

/**
 * Returns a map of navigation items with their visibility status
 * based on the current user's RBAC permissions.
 */
export function useVisibleNavItems() {
  const { permissions, level, isPlatformUser } = usePermissions();

  const visibleSections = useMemo(() => {
    const sections: NavSection[] = [];

    for (const [sectionKey, rule] of Object.entries(SECTION_PERMISSIONS)) {
      const sectionVisible = checkNavigationAccess(rule, permissions, level, isPlatformUser);
      sections.push({
        key: sectionKey,
        visible: sectionVisible,
        items: [],
      });
    }

    return sections;
  }, [permissions, level, isPlatformUser]);

  const visibleItems = useMemo(() => {
    const items: Record<string, boolean> = {};

    for (const [path, rule] of Object.entries(ITEM_PERMISSIONS)) {
      items[path] = checkNavigationAccess(rule, permissions, level, isPlatformUser);
    }

    return items;
  }, [permissions, level, isPlatformUser]);

  const isItemVisible = (path: string): boolean => {
    // If no rule defined, item is visible by default
    if (!(path in visibleItems)) return true;
    return visibleItems[path];
  };

  const isSectionVisible = (sectionKey: string): boolean => {
    const section = visibleSections.find((s) => s.key === sectionKey);
    if (!section) return true; // No rule = visible
    return section.visible;
  };

  return {
    isItemVisible,
    isSectionVisible,
    visibleSections,
    visibleItems,
  };
}
