/**
 * Page Wrapper Component
 *
 * Wraps page components with error boundary and suspense for better error handling
 * and loading states. Use this for critical pages that need isolated error handling.
 *
 * @example
 * // In App.tsx routes:
 * <Route path="/dashboard">
 *   <PageWrapper name="Dashboard">
 *     <Dashboard />
 *   </PageWrapper>
 * </Route>
 *
 * // Or with lazy loading:
 * const Dashboard = lazy(() => import('@/pages/Dashboard'));
 * <Route path="/dashboard">
 *   <PageWrapper name="Dashboard" lazy>
 *     <Dashboard />
 *   </PageWrapper>
 * </Route>
 */

import React, { Suspense, ReactNode } from 'react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Skeleton } from '@/components/ui/skeleton';

interface PageWrapperProps {
  children: ReactNode;
  /** Page name for error reporting */
  name: string;
  /** Whether the content is lazy loaded (shows loading skeleton) */
  lazy?: boolean;
  /** Custom loading component */
  loadingComponent?: ReactNode;
  /** Custom error handler */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

/**
 * Default loading skeleton for pages
 */
function PageLoadingSkeleton() {
  return (
    <div className="p-6 space-y-6" role="status" aria-label="Loading page content">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Stats cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card rounded-lg border p-4">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="bg-card rounded-lg border p-6 space-y-4">
        <Skeleton className="h-6 w-40" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Page Wrapper with Error Boundary and Suspense
 */
export function PageWrapper({
  children,
  name,
  lazy = false,
  loadingComponent,
  onError,
}: PageWrapperProps) {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Log error with page context
    console.error(`[PageWrapper:${name}] Error:`, error, errorInfo);

    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo);
    }

    // Send to error tracking service if available
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, {
        tags: { page: name },
        contexts: {
          react: { componentStack: errorInfo.componentStack },
        },
      });
    }
  };

  const content = (
    <ErrorBoundary level="page" onError={handleError}>
      {children}
    </ErrorBoundary>
  );

  // Wrap with Suspense if lazy loading is enabled
  if (lazy) {
    return <Suspense fallback={loadingComponent || <PageLoadingSkeleton />}>{content}</Suspense>;
  }

  return content;
}

/**
 * Higher-order component for wrapping pages with error boundaries
 * Useful for lazy-loaded components
 *
 * @example
 * const SafeDashboard = withPageWrapper(lazy(() => import('@/pages/Dashboard')), 'Dashboard');
 */
export function withPageWrapper<P extends object>(
  Component: React.ComponentType<P>,
  name: string,
): React.FC<P> {
  return function WrappedPage(props: P) {
    return (
      <PageWrapper name={name} lazy>
        <Component {...props} />
      </PageWrapper>
    );
  };
}

/**
 * Component-level error boundary wrapper for smaller sections
 * Less intrusive than page-level boundaries
 */
export function ComponentWrapper({
  children,
  name,
  fallback,
}: {
  children: ReactNode;
  name: string;
  fallback?: ReactNode;
}) {
  return (
    <ErrorBoundary
      level="component"
      onError={(error, errorInfo) => {
        console.error(`[ComponentWrapper:${name}] Error:`, error, errorInfo);
      }}
      fallback={fallback}
    >
      {children}
    </ErrorBoundary>
  );
}

export default PageWrapper;
