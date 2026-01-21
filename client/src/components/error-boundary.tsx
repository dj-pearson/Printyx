import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  level?: 'page' | 'component' | 'critical';
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in child component tree
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console
    console.error('Error Boundary caught error:', error, errorInfo);

    // Store error details
    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to error reporting service (e.g., Sentry)
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
      });
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  handleReportBug = () => {
    const { error, errorInfo } = this.state;
    const bugReport = {
      error: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    };

    console.log('Bug Report:', bugReport);
    // In production, send to bug tracking system
    // await apiRequest("/api/bug-reports", "POST", bugReport);
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo } = this.state;
      const { level = 'component' } = this.props;

      // Different UI based on error level
      if (level === 'critical') {
        return <CriticalErrorFallback error={error} onReload={this.handleReload} />;
      }

      if (level === 'page') {
        return (
          <PageErrorFallback
            error={error}
            errorInfo={errorInfo}
            onReset={this.handleReset}
            onReload={this.handleReload}
            onGoHome={this.handleGoHome}
            onReportBug={this.handleReportBug}
          />
        );
      }

      // Component level error (default)
      return <ComponentErrorFallback error={error} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}

/**
 * Critical Error Fallback - Full screen takeover
 */
function CriticalErrorFallback({ error, onReload }: { error: Error | null; onReload: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100 p-4">
      <Card className="max-w-md w-full border-red-200">
        <CardHeader className="text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl text-red-900">Critical Error</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-red-800">
            A critical error occurred and the application needs to restart.
          </p>
          {error && (
            <div className="bg-red-50 p-3 rounded-md text-left">
              <code className="text-xs text-red-900 break-all">{error.message}</code>
            </div>
          )}
          <Button onClick={onReload} className="w-full bg-red-600 hover:bg-red-700">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reload Application
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Page Error Fallback - Full page error with details
 */
function PageErrorFallback({
  error,
  errorInfo,
  onReset,
  onReload,
  onGoHome,
  onReportBug,
}: {
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  onReset: () => void;
  onReload: () => void;
  onGoHome: () => void;
  onReportBug: () => void;
}) {
  const [showDetails, setShowDetails] = React.useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <CardTitle className="text-xl">Something went wrong</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  We're sorry for the inconvenience. This page encountered an error.
                </p>
              </div>
            </div>
            <Badge variant="destructive">Error</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-sm font-medium text-red-900 mb-1">Error Message:</p>
              <code className="text-xs text-red-800 break-all">{error.message}</code>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={onReset} variant="default">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            <Button onClick={onGoHome} variant="outline">
              <Home className="h-4 w-4 mr-2" />
              Go to Dashboard
            </Button>
            <Button onClick={onReload} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Reload Page
            </Button>
            <Button onClick={onReportBug} variant="outline">
              <Bug className="h-4 w-4 mr-2" />
              Report Bug
            </Button>
          </div>

          {/* Technical Details (Collapsible) */}
          {(error || errorInfo) && (
            <div className="border-t pt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs text-muted-foreground"
              >
                {showDetails ? 'Hide' : 'Show'} Technical Details
              </Button>

              {showDetails && (
                <div className="mt-3 space-y-3">
                  {error?.stack && (
                    <div className="bg-gray-100 rounded-md p-3 overflow-auto max-h-48">
                      <p className="text-xs font-medium text-gray-900 mb-2">Stack Trace:</p>
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap">{error.stack}</pre>
                    </div>
                  )}

                  {errorInfo?.componentStack && (
                    <div className="bg-gray-100 rounded-md p-3 overflow-auto max-h-48">
                      <p className="text-xs font-medium text-gray-900 mb-2">Component Stack:</p>
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                        {errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Component Error Fallback - Inline error for component failures
 */
function ComponentErrorFallback({ error, onReset }: { error: Error | null; onReset: () => void }) {
  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardContent className="py-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium text-orange-900">This component failed to load</p>
            {error && <p className="text-xs text-orange-800">{error.message}</p>}
            <Button
              onClick={onReset}
              variant="outline"
              size="sm"
              className="text-orange-900 border-orange-300 hover:bg-orange-100"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Hook for programmatic error handling
 */
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  const handleError = React.useCallback((err: Error) => {
    setError(err);
  }, []);

  return handleError;
}

/**
 * Async Error Boundary for handling async operations
 */
export function AsyncErrorBoundary({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <ErrorBoundary
      fallback={fallback}
      onError={(error, errorInfo) => {
        console.error('Async Error:', error, errorInfo);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
