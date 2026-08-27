import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingSpinner } from '@/components/ui/skeletons';

/**
 * Query state wrapper (CR-033).
 *
 * THE FAILURE THIS EXISTS TO STOP is not a crash, it is a page that looks fine
 * and is wrong. 218 reachable files call useQuery and never read isError; 23 of
 * them never read isLoading either. Those 23 render their full layout - headers,
 * cards, empty tables - the instant they mount, so a failed request and a
 * genuinely empty account are indistinguishable, and a slow one looks like an
 * account with nothing in it. Several of these pages also carry `|| mockData`
 * fallbacks, which turns a failed request into confident fake numbers.
 *
 * So the ONE RULE this component encodes is that an error can never be rendered
 * as emptiness. `children` is a render prop taking narrowed, defined data, and
 * it is only ever called after loading and error are ruled out - there is no way
 * to reach the empty branch on a failed query, and no way to forget the
 * `data?.` guard, because `data` is not in scope until it exists.
 *
 * `onRetry` defaults to the query's own refetch, so the retry affordance costs
 * nothing at the call site.
 *
 * WHAT IT DELIBERATELY DOES NOT DO: it does not wrap itself in a Card. These
 * pages already nest cards several deep, and a state component that adds another
 * frame makes every loading and error view worse than the layout it replaces.
 * The caller owns the frame; this owns what goes inside it.
 */

/** The parts of a useQuery result this needs. Narrow on purpose: it also accepts
 * a hand-rolled object, which is what makes the component testable. */
export type QueryLike<T> = Pick<UseQueryResult<T>, 'data' | 'isLoading' | 'isError'> &
  Partial<Pick<UseQueryResult<T>, 'error' | 'refetch'>>;

/** Read a message off whatever the query layer threw. */
export function queryErrorMessage(error: unknown, fallback = 'Please try again.'): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return fallback;
}

export interface QueryStateProps<T> {
  query: QueryLike<T>;
  /** Rendered with data that is defined, loaded, and not an error. */
  children: (data: T) => ReactNode;
  /** Replaces the default spinner (a table skeleton usually reads better). */
  loading?: ReactNode;
  /** Shown instead of children when the loaded data is empty. */
  empty?: ReactNode;
  /**
   * Defaults to "an empty array". Pass one for object-shaped data, e.g.
   * `isEmpty={(d) => d.rows.length === 0}`.
   */
  isEmpty?: (data: T) => boolean;
  errorTitle?: string;
  /** Defaults to the query's own refetch. Pass null to drop the retry button. */
  onRetry?: (() => void) | null;
  className?: string;
}

function defaultIsEmpty(data: unknown): boolean {
  return Array.isArray(data) && data.length === 0;
}

export function QueryState<T>({
  query,
  children,
  loading,
  empty,
  isEmpty = defaultIsEmpty,
  errorTitle = 'Could not load this data',
  onRetry,
  className,
}: QueryStateProps<T>) {
  if (query.isLoading) {
    return <div className={className}>{loading ?? <LoadingSpinner />}</div>;
  }

  if (query.isError) {
    const retry = onRetry === null ? undefined : (onRetry ?? (() => void query.refetch?.()));
    return (
      <div className={className}>
        <ErrorState title={errorTitle} message={queryErrorMessage(query.error)} onRetry={retry} />
      </div>
    );
  }

  // Not loading, not an error, and still nothing: treat undefined like empty
  // rather than calling children with a value the render prop says is defined.
  if (query.data === undefined || query.data === null) {
    return <div className={className}>{empty ?? null}</div>;
  }

  if (empty !== undefined && isEmpty(query.data)) {
    return <div className={className}>{empty}</div>;
  }

  return <>{children(query.data)}</>;
}

export interface QueryStatesProps {
  /** Dashboards fan out several queries and want one combined state. */
  queries: QueryLike<unknown>[];
  children: ReactNode;
  loading?: ReactNode;
  errorTitle?: string;
  className?: string;
}

/**
 * The dashboard shape: several independent queries, one page-level state. Any
 * one loading shows the loading view; any one failing shows the error view, and
 * retry refetches EVERY failed query rather than only the first, so one click
 * recovers the page.
 *
 * Children take no argument here - a combined state cannot narrow six different
 * result types - so pages using this still handle their own per-section
 * emptiness. It buys the loading and error halves, which is the part that was
 * missing.
 */
export function QueryStates({
  queries,
  children,
  loading,
  errorTitle = 'Could not load this page',
  className,
}: QueryStatesProps) {
  if (queries.some((q) => q.isLoading)) {
    return <div className={className}>{loading ?? <LoadingSpinner />}</div>;
  }

  const failed = queries.filter((q) => q.isError);
  if (failed.length > 0) {
    return (
      <div className={className}>
        <ErrorState
          title={errorTitle}
          message={queryErrorMessage(failed[0].error)}
          onRetry={() => failed.forEach((q) => void q.refetch?.())}
        />
      </div>
    );
  }

  return <>{children}</>;
}
