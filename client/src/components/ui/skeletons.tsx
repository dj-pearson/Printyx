import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex gap-4 pb-2 border-b">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`header-${i}`} className="h-8 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="flex gap-4 items-center">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={`cell-${rowIndex}-${colIndex}`} className="h-12 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

interface CardSkeletonProps {
  count?: number;
}

export function CardSkeleton({ count = 1 }: CardSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border rounded-lg p-4 space-y-3">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      ))}
    </>
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <div className="flex gap-2 pt-4">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-4 space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
      {/* Chart */}
      <div className="border rounded-lg p-4">
        <Skeleton className="h-6 w-32 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
      {/* Table */}
      <div className="border rounded-lg p-4">
        <Skeleton className="h-6 w-40 mb-4" />
        <TableSkeleton rows={3} columns={3} />
      </div>
    </div>
  );
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-3 border rounded-lg">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-24" />
        </div>
      ))}
    </div>
  );
}

/**
 * Loading spinner with accessibility support
 */
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

export function LoadingSpinner({ size = 'md', className, label = 'Loading' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-16 w-16',
  };

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={cn('flex items-center justify-center', className)}
    >
      <div
        className={cn('animate-spin rounded-full border-b-2 border-blue-600', sizeClasses[size])}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

/**
 * Page-level loading skeleton for Suspense fallbacks
 * Provides meaningful content structure while loading
 */
interface PageLoadingSkeletonProps {
  variant?: 'dashboard' | 'table' | 'form' | 'detail' | 'list' | 'minimal';
  title?: string;
  className?: string;
}

export function PageLoadingSkeleton({
  variant = 'minimal',
  title = 'Loading...',
  className,
}: PageLoadingSkeletonProps) {
  return (
    <div role="status" aria-busy="true" aria-label={title} className={cn('w-full', className)}>
      {/* Screen reader accessible loading message */}
      <span className="sr-only">{title}</span>

      {variant === 'minimal' && (
        <div className="flex items-center justify-center min-h-[200px]">
          <LoadingSpinner size="lg" label={title} />
        </div>
      )}

      {variant === 'dashboard' && <DashboardSkeleton />}

      {variant === 'table' && (
        <div className="space-y-4 p-4">
          {/* Header skeleton */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <div className="flex gap-2">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
          {/* Search/filter bar skeleton */}
          <div className="flex gap-2">
            <Skeleton className="h-10 flex-1 max-w-sm" />
            <Skeleton className="h-10 w-32" />
          </div>
          {/* Table skeleton */}
          <TableSkeleton rows={5} columns={4} />
        </div>
      )}

      {variant === 'form' && (
        <div className="max-w-2xl mx-auto p-6">
          <Skeleton className="h-8 w-48 mb-6" />
          <FormSkeleton />
        </div>
      )}

      {variant === 'detail' && (
        <div className="space-y-6 p-4">
          {/* Header with title and actions */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-48" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-24" />
            </div>
          </div>
          {/* Stats cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border rounded-lg p-4 space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>
          {/* Content area */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 border rounded-lg p-4 space-y-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
            <div className="border rounded-lg p-4 space-y-4">
              <Skeleton className="h-6 w-24" />
              <ListSkeleton count={3} />
            </div>
          </div>
        </div>
      )}

      {variant === 'list' && (
        <div className="space-y-4 p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          <ListSkeleton count={5} />
        </div>
      )}

      {/* SEO: Provide meaningful content for non-JS crawlers */}
      <noscript>
        <p className="text-center text-muted-foreground p-4">
          {title} - Please enable JavaScript for the best experience.
        </p>
      </noscript>
    </div>
  );
}

/**
 * Inline loading indicator for smaller components
 */
interface InlineLoadingProps {
  text?: string;
  className?: string;
}

export function InlineLoading({ text = 'Loading...', className }: InlineLoadingProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      className={cn('flex items-center gap-2 text-muted-foreground', className)}
    >
      <div
        className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        aria-hidden="true"
      />
      <span className="text-sm">{text}</span>
    </div>
  );
}
