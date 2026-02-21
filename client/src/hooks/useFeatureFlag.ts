/**
 * Feature Flag Hook
 * US-035: Client-side feature flag checking with 5-minute cache.
 */

import { useQuery } from '@tanstack/react-query';

const FEATURE_FLAGS_CACHE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch all resolved feature flags for the current user/tenant.
 */
async function fetchFeatureFlags(): Promise<Record<string, boolean>> {
  const res = await fetch('/api/feature-flags', { credentials: 'include' });
  if (!res.ok) {
    throw new Error('Failed to fetch feature flags');
  }
  return res.json();
}

/**
 * Hook to check if a specific feature flag is enabled.
 *
 * @param flagName - The flag name to check
 * @param defaultValue - Value to return while loading (default: false)
 * @returns { enabled, isLoading, flags }
 *
 * @example
 * const { enabled } = useFeatureFlag('new_dashboard');
 * if (enabled) { ... }
 */
export function useFeatureFlag(flagName: string, defaultValue = false) {
  const { data: flags, isLoading } = useQuery<Record<string, boolean>>({
    queryKey: ['feature-flags'],
    queryFn: fetchFeatureFlags,
    staleTime: FEATURE_FLAGS_CACHE_MS,
    gcTime: FEATURE_FLAGS_CACHE_MS * 2,
    refetchOnWindowFocus: false,
  });

  return {
    enabled: flags?.[flagName] ?? defaultValue,
    isLoading,
    flags: flags ?? {},
  };
}

/**
 * Hook to get all feature flags at once.
 *
 * @example
 * const { flags, isLoading } = useFeatureFlags();
 * if (flags.ai_features) { ... }
 */
export function useFeatureFlags() {
  const { data: flags, isLoading } = useQuery<Record<string, boolean>>({
    queryKey: ['feature-flags'],
    queryFn: fetchFeatureFlags,
    staleTime: FEATURE_FLAGS_CACHE_MS,
    gcTime: FEATURE_FLAGS_CACHE_MS * 2,
    refetchOnWindowFocus: false,
  });

  return {
    flags: flags ?? {},
    isLoading,
  };
}

export default useFeatureFlag;
