/**
 * SectionErrorBoundary - widget/section-level error boundary (US-024)
 *
 * Wraps an individual dashboard widget or page section. When the section
 * crashes it shows a compact error card in the section's space while the
 * rest of the page keeps working.
 */

import React, { ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export interface SectionErrorBoundaryProps {
  children: ReactNode;
  /** Section/widget name shown in the fallback and used in error reports */
  name?: string;
  /** Optional callback invoked with the error and React error info */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export function SectionErrorBoundary({ children, name, onError }: SectionErrorBoundaryProps) {
  return (
    <ErrorBoundary
      boundaryName={name ? `section:${name}` : 'section'}
      onError={onError}
      fallback={(error, reset) => <SectionErrorCard name={name} error={error} onReset={reset} />}
    >
      {children}
    </ErrorBoundary>
  );
}

function SectionErrorCard({
  name,
  error,
  onReset,
}: {
  name?: string;
  error: Error;
  onReset: () => void;
}) {
  return (
    <Card className="h-full border-destructive/30 bg-destructive/5" role="alert">
      <CardContent className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center">
        <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
        <p className="text-sm font-medium">
          {name ? `${name} failed to load` : 'This section failed to load'}
        </p>
        <p className="text-xs text-muted-foreground break-all line-clamp-2 max-w-full">
          {error.message}
        </p>
        <Button onClick={onReset} variant="outline" size="sm" className="mt-1">
          <RefreshCw className="h-3 w-3 mr-1" aria-hidden="true" />
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

export default SectionErrorBoundary;
