/**
 * ErrorBoundary - base React error boundary (US-024)
 *
 * Catches rendering errors in its child tree, shows an error card with a
 * "Try Again" button that resets the boundary, and reports the error to
 * POST /api/client-errors for server-side logging.
 *
 * Compose via the `fallback` prop for custom error UI:
 * - PageErrorBoundary  - full page errors with navigation still accessible
 * - SectionErrorBoundary - compact card for dashboard widgets/sections
 *
 * (A legacy boundary exists at components/error-boundary.tsx; new code
 * should use this one or the Page/Section wrappers built on it.)
 */

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { reportClientError } from '@/lib/client-error-reporter';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * Custom fallback UI. A function form receives the error and a reset
   * callback so custom fallbacks can offer their own "Try Again" action.
   */
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  /** Optional callback invoked with the error and React error info */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Identifier included in error reports (e.g. "page:/customers") */
  boundaryName?: string;
  /** Set to true to skip automatic reporting to /api/client-errors */
  disableReporting?: boolean;
  /**
   * When this value changes while an error is showing, the boundary resets
   * automatically (e.g. pass the current location so navigation recovers).
   */
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (!this.props.disableReporting) {
      reportClientError(error, {
        componentStack: errorInfo.componentStack ?? undefined,
        boundary: this.props.boundaryName,
      });
    }
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.reset();
    }
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (error) {
      const { fallback } = this.props;
      if (typeof fallback === 'function') {
        return fallback(error, this.reset);
      }
      if (fallback) {
        return fallback;
      }
      return <DefaultErrorFallback error={error} onReset={this.reset} />;
    }
    return this.props.children;
  }
}

function DefaultErrorFallback({ error, onReset }: { error: Error; onReset: () => void }) {
  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
          </div>
          <CardTitle className="text-lg">Something went wrong</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground break-all">{error.message}</p>
        <Button onClick={onReset} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
          Try Again
        </Button>
      </CardContent>
    </Card>
  );
}

export default ErrorBoundary;
