/**
 * SectionErrorBoundary
 *
 * Compact error boundary for dashboard widgets and page sections.
 * Shows a small error card in the widget space without disrupting
 * the rest of the dashboard.
 *
 * Sends error details to /api/client-errors for server-side logging.
 */

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getApiUrl } from '@/lib/config';

interface SectionErrorBoundaryProps {
  children: ReactNode;
  /** Section name for error context */
  name?: string;
  /** Optional custom fallback */
  fallback?: ReactNode;
}

interface SectionErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class SectionErrorBoundary extends Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  constructor(props: SectionErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<SectionErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(
      `[SectionErrorBoundary${this.props.name ? `:${this.props.name}` : ''}]`,
      error,
      errorInfo,
    );

    // Send to server
    try {
      fetch(getApiUrl('/api/client-errors'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          section: this.props.name,
          page: window.location.pathname,
          url: window.location.href,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {});
    } catch {
      // Ignore
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 text-orange-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-orange-900">
                {this.props.name
                  ? `${this.props.name} failed to load`
                  : 'This section failed to load'}
              </p>
              {this.state.error && (
                <p className="text-xs text-orange-700 truncate mt-0.5">
                  {this.state.error.message}
                </p>
              )}
            </div>
            <Button
              onClick={this.handleReset}
              variant="outline"
              size="sm"
              className="shrink-0 text-orange-900 border-orange-300 hover:bg-orange-100"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
}

export default SectionErrorBoundary;
