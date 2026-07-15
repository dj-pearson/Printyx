/**
 * PUBLIC_API_BASE_URL resolution + readiness (EDGE-015).
 *
 * Edge functions that emit installer / enrollment / agent-ingest URLs must point
 * them at the Express/app host that serves /install/* and /api/client-metrics/*
 * — NOT at functions.printyx.net (the edge host serves neither). That host is
 * configured via the PUBLIC_API_BASE_URL env. When unset, the only edge fn that
 * emits these URLs (monitoring-clients) falls back to the request host with a
 * loud warning; a deployment-readiness check surfaces the misconfiguration.
 *
 * Import-free + pure so it is unit-testable without the Deno runtime.
 */

export interface ResolvedBaseUrl {
  url: string;
  /** True when PUBLIC_API_BASE_URL was unset and the request host was used. */
  isFallback: boolean;
}

/** Resolve the platform base URL, preferring PUBLIC_API_BASE_URL over the request host. */
export function resolvePlatformBaseUrl(
  configured: string | undefined | null,
  fallback: { proto: string; host: string },
): ResolvedBaseUrl {
  if (configured && configured.trim()) {
    return { url: configured.trim().replace(/\/$/, ''), isFallback: false };
  }
  return { url: `${fallback.proto}://${fallback.host}`, isFallback: true };
}

export type PublicApiBaseUrlStatus = 'complete' | 'warning';

export interface PublicApiBaseUrlAssessment {
  status: PublicApiBaseUrlStatus;
  details: string;
}

/**
 * Assess PUBLIC_API_BASE_URL for a deployment-readiness check. Set → complete;
 * unset → warning (installer/agent URLs would point at the edge host).
 */
export function assessPublicApiBaseUrl(
  configured: string | undefined | null,
): PublicApiBaseUrlAssessment {
  if (configured && configured.trim()) {
    return {
      status: 'complete',
      details: `Set to ${configured.trim().replace(/\/$/, '')}`,
    };
  }
  return {
    status: 'warning',
    details:
      'PUBLIC_API_BASE_URL is not set — monitoring-client installers and agent ingest URLs ' +
      'will point at the edge host (functions.printyx.net), which serves neither /install nor ' +
      '/api/client-metrics. Set it to the Express/app host.',
  };
}
