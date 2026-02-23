/**
 * PageErrorBoundary
 *
 * Wraps route pages so that rendering errors are contained within the page content area.
 * The sidebar/header (rendered by MainLayout inside each page) remain functional
 * because the boundary sits above the page component but below the layout shell.
 *
 * Sends error details to /api/client-errors for server-side logging.
 */

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getApiUrl } from '@/lib/config';

interface PageErrorBoundaryProps {
  children: ReactNode;
  /** Optional page name for error context */
  name?: string;
  /** Optional custom error handler */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface PageErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

function sendErrorToServer(error: Error, errorInfo: React.ErrorInfo, pageName?: string) {
  try {
    const payload = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      page: pageName || window.location.pathname,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    };
    // Fire-and-forget; don't block the UI
    fetch(getApiUrl('/api/client-errors'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    }).catch(() => {
      // Silently swallow network errors – logging should never break the app
    });
  } catch {
    // Ignore serialization errors
  }
}

export class PageErrorBoundary extends Component<PageErrorBoundaryProps, PageErrorBoundaryState> {
  constructor(props: PageErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<PageErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    console.error(
      `[PageErrorBoundary${this.props.name ? `:${this.props.name}` : ''}]`,
      error,
      errorInfo,
    );

    // Send to server
    sendErrorToServer(error, errorInfo, this.props.name);

    // Call optional handler
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error, errorInfo } = this.state;

    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">Something went wrong</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  This page encountered an error. Your navigation and other pages still work.
                </p>
              </div>
              <Badge variant="destructive">Error</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <code className="text-xs text-red-800 break-all">{error.message}</code>
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={this.handleReset} size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button onClick={this.handleGoHome} variant="outline" size="sm">
                <Home className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
            </div>
            {errorInfo?.componentStack && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground">
                  Technical details
                </summary>
                <pre className="mt-2 bg-gray-100 rounded-md p-2 overflow-auto max-h-40 whitespace-pre-wrap">
                  {errorInfo.componentStack}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }
}

export default PageErrorBoundary;
