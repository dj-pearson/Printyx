/**
 * RoutePermissionGate
 *
 * A wrapper component that enforces permission checks on all authenticated routes
 * by reading the current path and checking against ITEM_PERMISSIONS in
 * navigation-permissions.ts. This provides a centralized guard so every route
 * is protected without needing individual ProtectedRoute wrappers.
 *
 * Routes that already have inline ProtectedRoute or AdminRouteGuard wrappers
 * get double protection (harmless - both checks must pass).
 */

import React from 'react';
import { useLocation } from 'wouter';
import { usePermissions } from '@/hooks/usePermissions';
import { getRoutePermissions } from '@/lib/navigation-permissions';

const Unauthorized = React.lazy(() => import('@/pages/Unauthorized'));

/** Paths that should never be gated (public/legal/auth redirect pages) */
const SKIP_PATHS = new Set([
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/auth/callback',
  '/eula',
  '/privacy',
  '/terms',
  '/accessibility',
  '/setup-wizard',
  '/export-logos',
]);

/** Path prefixes that should be skipped (dynamic sub-routes of skip paths) */
const SKIP_PREFIXES = ['/blog/', '/p/'];

export function RoutePermissionGate({ children }: { children: React.ReactNode }) {
  const [pathname] = useLocation();
  const { hasAnyPermission, hasAllPermissions, level, isPlatformUser } = usePermissions();

  // Skip gating for excluded paths
  if (SKIP_PATHS.has(pathname) || SKIP_PREFIXES.some((p) => pathname.startsWith(p))) {
    return <>{children}</>;
  }

  // Normalize path: strip dynamic segments for permission lookup
  // e.g. /customers/some-slug -> /customers/:slug, /leads/foo -> /leads/:slug
  const rule = getRoutePermissions(pathname);

  // No rule defined means no restriction needed
  if (!rule) {
    return <>{children}</>;
  }

  // Always visible items pass through
  if (rule.alwaysVisible) {
    return <>{children}</>;
  }

  // Platform admins bypass all checks
  if (isPlatformUser) {
    return <>{children}</>;
  }

  // Platform-only check
  if (rule.platformOnly) {
    return (
      <React.Suspense fallback={null}>
        <Unauthorized />
      </React.Suspense>
    );
  }

  // Level check
  if (rule.minLevel && level < rule.minLevel) {
    return (
      <React.Suspense fallback={null}>
        <Unauthorized />
      </React.Suspense>
    );
  }

  // All permissions check (AND)
  if (rule.requiredAllPermissions && rule.requiredAllPermissions.length > 0) {
    if (!hasAllPermissions(rule.requiredAllPermissions)) {
      return (
        <React.Suspense fallback={null}>
          <Unauthorized />
        </React.Suspense>
      );
    }
  }

  // Any permission check (OR)
  if (rule.requiredPermissions && rule.requiredPermissions.length > 0) {
    if (!hasAnyPermission(rule.requiredPermissions)) {
      return (
        <React.Suspense fallback={null}>
          <Unauthorized />
        </React.Suspense>
      );
    }
  }

  return <>{children}</>;
}
