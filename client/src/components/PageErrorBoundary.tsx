/**
 * PageErrorBoundary - route-level error boundary (US-024)
 *
 * Wraps a route's page component. When the page crashes:
 * - Authenticated users see the error INSIDE MainLayout, so the sidebar and
 *   header remain fully functional (pages render their own MainLayout, which
 *   unmounts with the crashed page - the fallback re-renders it).
 * - Unauthenticated/public pages get a centered standalone error card.
 *
 * The boundary is keyed by location in App.tsx's Route wrapper, so simply
 * navigating away (or to a different param of the same route) resets it.
 */

import React, { ReactNode, useState } from 'react';
import { useLocation } from 'wouter';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import MainLayout from '@/components/layout/main-layout';
import { useAuthContext } from '@/providers/AuthProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export interface PageErrorBoundaryProps {
  children: ReactNode;
  /** Route path used to identify the page in error reports */
  route?: string;
  /** Optional callback invoked with the error and React error info */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export function PageErrorBoundary({ children, route, onError }: PageErrorBoundaryProps) {
  // Reset the boundary when the user navigates (sidebar/header stay usable in
  // the fallback, so navigation must always recover from the error state).
  const [location] = useLocation();
  return (
    <ErrorBoundary
      boundaryName={route ? `page:${route}` : 'page'}
      onError={onError}
      resetKey={location}
      fallback={(error, reset) => <PageErrorFallback error={error} onReset={reset} />}
    >
      {children}
    </ErrorBoundary>
  );
}

function PageErrorFallback({ error, onReset }: { error: Error; onReset: () => void }) {
  const { isAuthenticated } = useAuthContext();

  const errorCard = <PageErrorCard error={error} onReset={onReset} />;

  // Authenticated: render the error inside the app shell so the sidebar and
  // header stay usable and the user can navigate away.
  if (isAuthenticated) {
    return (
      <MainLayout title="Something went wrong" description="This page encountered an error">
        <div className="flex justify-center pt-8">{errorCard}</div>
      </MainLayout>
    );
  }

  // Public/marketing pages have no app shell - show a standalone error page.
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">{errorCard}</div>
  );
}

function PageErrorCard({ error, onReset }: { error: Error; onReset: () => void }) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <Card className="max-w-2xl w-full" role="alert">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-xl">Something went wrong</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              This page encountered an error. The rest of the application is unaffected.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-destructive/5 border border-destructive/20 rounded-md p-4">
          <p className="text-sm font-medium mb-1">Error message:</p>
          <code className="text-xs break-all">{error.message}</code>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={onReset}>
            <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
            Try Again
          </Button>
          <Button variant="outline" onClick={() => (window.location.href = '/')}>
            <Home className="h-4 w-4 mr-2" aria-hidden="true" />
            Go to Dashboard
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
            Reload Page
          </Button>
        </div>

        {error.stack && (
          <div className="border-t pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-muted-foreground"
              aria-expanded={showDetails}
            >
              {showDetails ? 'Hide' : 'Show'} technical details
            </Button>
            {showDetails && (
              <pre className="mt-3 bg-muted rounded-md p-3 overflow-auto max-h-48 text-xs whitespace-pre-wrap">
                {error.stack}
              </pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PageErrorBoundary;
