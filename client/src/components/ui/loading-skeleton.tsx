import * as React from 'react';
import { cn } from '@/lib/utils';

export interface LoadingSkeletonProps {
  variant?: 'table' | 'cards' | 'form' | 'detail';
  rows?: number;
  className?: string;
}

function SkeletonPulse({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />;
}

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="w-full space-y-3">
      {/* Table header */}
      <div className="flex gap-4 pb-3 border-b">
        <SkeletonPulse className="h-4 w-[25%]" />
        <SkeletonPulse className="h-4 w-[20%]" />
        <SkeletonPulse className="h-4 w-[20%]" />
        <SkeletonPulse className="h-4 w-[15%]" />
        <SkeletonPulse className="h-4 w-[10%]" />
      </div>
      {/* Table rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-3 border-b border-muted">
          <SkeletonPulse className="h-4 w-[25%]" />
          <SkeletonPulse className="h-4 w-[20%]" />
          <SkeletonPulse className="h-4 w-[20%]" />
          <SkeletonPulse className="h-4 w-[15%]" />
          <SkeletonPulse className="h-4 w-[10%]" />
        </div>
      ))}
    </div>
  );
}

function CardsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <SkeletonPulse className="h-10 w-10 rounded-full" />
            <div className="space-y-2 flex-1">
              <SkeletonPulse className="h-4 w-[60%]" />
              <SkeletonPulse className="h-3 w-[40%]" />
            </div>
          </div>
          <SkeletonPulse className="h-3 w-full" />
          <SkeletonPulse className="h-3 w-[80%]" />
        </div>
      ))}
    </div>
  );
}

function FormSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-6 max-w-lg">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2">
          <SkeletonPulse className="h-4 w-[30%]" />
          <SkeletonPulse className="h-10 w-full rounded-md" />
        </div>
      ))}
      {/* Submit button skeleton */}
      <SkeletonPulse className="h-10 w-[120px] rounded-md" />
    </div>
  );
}

function DetailSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-6">
      {/* Title area */}
      <div className="space-y-2">
        <SkeletonPulse className="h-8 w-[40%]" />
        <SkeletonPulse className="h-4 w-[25%]" />
      </div>
      {/* Detail fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="space-y-2">
            <SkeletonPulse className="h-3 w-[35%]" />
            <SkeletonPulse className="h-5 w-[65%]" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Reusable loading skeleton with layout variants (UX-005).
 * Provides animated pulse placeholders that match common
 * page layouts: tables, card grids, forms, and detail views.
 */
export function LoadingSkeleton({ variant = 'table', rows = 5, className }: LoadingSkeletonProps) {
  return (
    <div className={cn('w-full', className)}>
      {variant === 'table' && <TableSkeleton rows={rows} />}
      {variant === 'cards' && <CardsSkeleton rows={rows} />}
      {variant === 'form' && <FormSkeleton rows={rows} />}
      {variant === 'detail' && <DetailSkeleton rows={rows} />}
    </div>
  );
}
