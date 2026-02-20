/**
 * Loading State Components
 *
 * Unified loading indicator API for consistent loading states across the app.
 * Re-exports and wraps existing skeleton/spinner primitives.
 *
 * Variants:
 * - Spinner: Inline spinning indicator with optional label
 * - ContentSkeleton: Content placeholder with pulsing animation
 * - PageLoader: Full-page centered spinner with message
 */

import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

// Re-export existing primitives for convenience
export { Skeleton } from '@/components/ui/skeleton';
export {
  TableSkeleton,
  CardSkeleton,
  FormSkeleton,
  DashboardSkeleton,
  ListSkeleton,
  LoadingSpinner,
  PageLoadingSkeleton,
  InlineLoading,
} from '@/components/ui/skeletons';

/**
 * Spinner - Inline loading indicator
 */
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

export function Spinner({ size = 'md', className, label }: SpinnerProps) {
  const sizeMap = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-8 w-8' };
  return (
    <span role="status" className={cn('inline-flex items-center gap-2', className)}>
      <Loader2
        className={cn('animate-spin text-muted-foreground', sizeMap[size])}
        aria-hidden="true"
      />
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
      <span className="sr-only">{label || 'Loading'}</span>
    </span>
  );
}

/**
 * PageLoader - Full-page centered loading state with message
 */
interface PageLoaderProps {
  message?: string;
  className?: string;
}

export function PageLoader({ message = 'Loading...', className }: PageLoaderProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={message}
      className={cn('flex flex-col items-center justify-center min-h-[50vh] gap-4', className)}
    >
      <Loader2 className="h-10 w-10 animate-spin text-blue-600" aria-hidden="true" />
      <p className="text-sm text-muted-foreground font-medium">{message}</p>
    </div>
  );
}

/**
 * ContentSkeleton - Versatile skeleton placeholder
 * Shorthand for common loading patterns.
 */
interface ContentSkeletonProps {
  variant?: 'card' | 'table' | 'list' | 'form';
  count?: number;
  className?: string;
}

export function ContentSkeleton({ variant = 'card', count = 3, className }: ContentSkeletonProps) {
  // Delegates to the existing specialized skeletons
  const {
    TableSkeleton,
    CardSkeleton,
    ListSkeleton,
    FormSkeleton,
  } = require('@/components/ui/skeletons');

  return (
    <div className={className}>
      {variant === 'table' && <TableSkeleton rows={count} columns={4} />}
      {variant === 'card' && <CardSkeleton count={count} />}
      {variant === 'list' && <ListSkeleton count={count} />}
      {variant === 'form' && <FormSkeleton />}
    </div>
  );
}
