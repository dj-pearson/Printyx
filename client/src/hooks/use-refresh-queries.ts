import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * A page's Refresh button (UI-DEAD-BUTTONS-001, round 183).
 *
 * Six dashboards drew a "Refresh" button with no handler: it looked like it
 * reloaded the page's figures and did nothing. This refetches every active
 * query whose key starts with one of the page's own endpoints, so the button
 * does exactly what it says without the page listing every parameterised key
 * (a key like ['/api/reports/sales-reps', dateRange] is matched by its path).
 *
 * `refreshing` stays true until the refetches settle, so the button can be
 * disabled rather than clicked five times while the first one is in flight.
 */
/** True for a query whose key starts with one of `paths`. Pure, for tests. */
export function keyStartsWithPath(paths: readonly string[], queryKey: readonly unknown[]): boolean {
  return typeof queryKey[0] === 'string' && paths.includes(queryKey[0]);
}

export function useRefreshQueries(paths: readonly string[]) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({
        predicate: (query) => keyStartsWithPath(paths, query.queryKey),
      });
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, paths]);

  return { refresh, refreshing };
}
