import { QueryClient, QueryFunction } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { getApiUrl } from '@/lib/config';
import { getAccessToken, refreshSession } from '@/lib/supabase';
import { isSessionExpired, markSessionExpired } from '@/components/SessionGuard';
import { mobileLogger } from '@/lib/mobile-logger';

// Prevent concurrent token refresh attempts
let _refreshPromise: Promise<string | null> | null = null;

/**
 * Attempt to refresh the Supabase token exactly once.
 * Deduplicates concurrent refresh calls so only one network request is made.
 */
async function refreshTokenOnce(): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = refreshSession()
    .then((session) => session?.access_token ?? null)
    .finally(() => {
      _refreshPromise = null;
    });
  return _refreshPromise;
}

/**
 * Notify the SessionGuard about a fatal auth error.
 * This is done via a custom event so queryClient (a non-React module)
 * can communicate with the React component tree.
 */
function emitAuthError(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('printyx:auth-error'));
  }
}

// Generate a unique request ID for correlation
function generateRequestId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// Store last request ID for error reporting UI
let __lastRequestId: string | undefined;
export function getLastRequestId(): string | undefined {
  return __lastRequestId;
}

function getTenantIdForHeaders(): string | undefined {
  if (typeof window === 'undefined') return undefined;

  const isDemo = localStorage.getItem('demo-authenticated') === 'true';
  if (isDemo) return localStorage.getItem('demo-tenant-id') || undefined;

  // Prefer explicit tenant overrides if your app supports tenant switching.
  return (
    localStorage.getItem('tenant-id') ||
    localStorage.getItem('printyx-tenant-id') ||
    localStorage.getItem('x-tenant-id') ||
    undefined
  );
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * Safely parse JSON from a Response, capturing the raw body on failure
 * so we can see what the server actually returned (e.g. HTML error page).
 */
async function safeJsonParse(res: Response, context: string): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (parseError: any) {
    const preview = text.slice(0, 300);
    const contentType = res.headers.get('content-type') || 'unknown';
    mobileLogger.error('JSON parse failure', {
      context,
      url: res.url,
      status: res.status,
      contentType,
      responsePreview: preview,
      parseError: parseError.message,
    });
    throw new Error(
      `JSON parse error from ${context}: ${parseError.message} (status=${res.status}, type=${contentType}, body=${preview.slice(0, 100)}...)`,
    );
  }
}

// Determine the base URL for API requests (Edge Functions in prod, Vite proxy in dev)
function getRequestUrl(url: string): string {
  return getApiUrl(url);
}

// Options object format for apiRequest
interface ApiRequestOptions {
  method?: string;
  body?: string | any;
  headers?: Record<string, string>;
}

/**
 * Build common request headers: Bearer token, tenant ID, demo flag, request ID.
 */
async function buildAuthHeaders(requestId: string): Promise<HeadersInit> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-Request-ID': requestId,
  };

  // Supabase Bearer token
  const accessToken = await getAccessToken();
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  // Demo auth
  if (typeof window !== 'undefined' && localStorage.getItem('demo-authenticated') === 'true') {
    headers['X-Demo-Auth'] = 'true';
  }

  // Tenant ID
  if (typeof window !== 'undefined') {
    const tenantId = getTenantIdForHeaders();
    if (tenantId) headers['x-tenant-id'] = tenantId;
  }

  return headers;
}

export async function apiRequest(
  url: string,
  methodOrOptions: string | ApiRequestOptions = 'GET',
  body?: any,
  headers?: Record<string, string>,
): Promise<any> {
  // Support both formats:
  // apiRequest(url, 'POST', data) - positional params
  // apiRequest(url, { method: 'POST', body: data }) - options object
  let finalMethod: string;
  let finalBody: any;
  let finalHeaders: Record<string, string> | undefined;

  if (typeof methodOrOptions === 'object') {
    finalMethod = methodOrOptions.method || 'GET';
    finalBody = methodOrOptions.body;
    finalHeaders = methodOrOptions.headers;
  } else {
    finalMethod = methodOrOptions;
    finalBody = body;
    finalHeaders = headers;
  }

  const requestId = generateRequestId();
  __lastRequestId = requestId;

  const requestHeaders: HeadersInit = {
    ...(await buildAuthHeaders(requestId)),
    ...finalHeaders,
  };

  const safeMethod = finalMethod || 'GET';
  const requestUrl = getRequestUrl(url);

  // Handle body - if it's already a string, use it as-is, otherwise stringify
  const getBodyString = (b: any) => {
    if (!b) return undefined;
    if (typeof b === 'string') return b;
    return JSON.stringify(b);
  };

  let res = await fetch(requestUrl, {
    method: safeMethod,
    headers: requestHeaders,
    body: getBodyString(finalBody),
    credentials: 'omit',
  });

  // Handle 401 — attempt token refresh before failing
  if (res.status === 401) {
    if (isSessionExpired()) {
      throw new Error('401: Session expired. Please log in again.');
    }

    const newToken = await refreshTokenOnce();
    if (newToken) {
      requestHeaders['Authorization'] = `Bearer ${newToken}`;
      const retryRes = await fetch(requestUrl, {
        method: safeMethod,
        headers: requestHeaders,
        body: getBodyString(finalBody),
        credentials: 'omit',
      });

      if (retryRes.ok) {
        return await safeJsonParse(retryRes, `apiRequest-retry:${url}`);
      }

      if (retryRes.status === 401) {
        markSessionExpired();
        emitAuthError();
        throw new Error('401: Session expired. Please log in again.');
      }

      await throwIfResNotOk(retryRes);
      return await safeJsonParse(retryRes, `apiRequest-retry:${url}`);
    }

    markSessionExpired();
    emitAuthError();
    throw new Error('401: Session expired. Please log in again.');
  }

  await throwIfResNotOk(res);
  return await safeJsonParse(res, `apiRequest:${url}`);
}

// Form-data aware request that preserves multipart encoding and still injects auth headers
export async function apiFormRequest(
  url: string,
  method: string = 'POST',
  formData: FormData,
  extraHeaders?: Record<string, string>,
): Promise<any> {
  const formRequestId = generateRequestId();
  __lastRequestId = formRequestId;

  const baseHeaders = await buildAuthHeaders(formRequestId);
  // Remove Content-Type so the browser sets multipart/form-data with boundary
  delete (baseHeaders as Record<string, string>)['Content-Type'];

  const requestHeaders: HeadersInit = {
    ...baseHeaders,
    ...extraHeaders,
  };

  const requestUrl = getRequestUrl(url);

  let res = await fetch(requestUrl, {
    method,
    headers: requestHeaders,
    body: formData,
    credentials: 'omit',
  });

  // Handle 401 — attempt token refresh before failing
  if (res.status === 401) {
    if (isSessionExpired()) {
      throw new Error('401: Session expired. Please log in again.');
    }

    const newToken = await refreshTokenOnce();
    if (newToken) {
      requestHeaders['Authorization'] = `Bearer ${newToken}`;
      const retryRes = await fetch(requestUrl, {
        method,
        headers: requestHeaders,
        body: formData,
        credentials: 'omit',
      });

      if (retryRes.ok) {
        return await safeJsonParse(retryRes, 'apiFormRequest-retry');
      }

      if (retryRes.status === 401) {
        markSessionExpired();
        emitAuthError();
        throw new Error('401: Session expired. Please log in again.');
      }

      await throwIfResNotOk(retryRes);
      return await safeJsonParse(retryRes, 'apiFormRequest-retry');
    }

    markSessionExpired();
    emitAuthError();
    throw new Error('401: Session expired. Please log in again.');
  }

  await throwIfResNotOk(res);
  return await safeJsonParse(res, 'apiFormRequest');
}

/**
 * Normalize any API response into a plain array of records.
 * Handles multiple response formats:
 *   - Edge Function paginated: { data: [...], total, page, limit }
 *   - Raw array:               [...]
 *   - Null/undefined:           []
 */
export function extractRecords<T = any>(response: any): T[] {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.records)) return response.records;
  return [];
}

/**
 * Extract pagination metadata from any API response format.
 */
export function extractPagination(response: any): {
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
} {
  if (!response || typeof response !== 'object') {
    return { total: 0, page: 1, limit: 100, hasMore: false };
  }
  const total = response.total ?? response.pagination?.total ?? 0;
  const page = response.page ?? response.pagination?.page ?? 1;
  const limit = response.limit ?? response.pagination?.limit ?? 100;
  const hasMore = response.pagination?.hasMore ?? page * limit < total;
  return { total, page, limit, hasMore };
}

type UnauthorizedBehavior = 'returnNull' | 'throw';
export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const queryRequestId = generateRequestId();
    __lastRequestId = queryRequestId;

    const headers: HeadersInit = {
      'X-Request-ID': queryRequestId,
    };

    // Supabase Bearer token
    const accessToken = await getAccessToken();
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    // Demo auth
    if (typeof window !== 'undefined' && localStorage.getItem('demo-authenticated') === 'true') {
      headers['X-Demo-Auth'] = 'true';
    }

    // Tenant ID
    if (typeof window !== 'undefined') {
      const tenantId = getTenantIdForHeaders();
      if (tenantId) headers['x-tenant-id'] = tenantId;
    }

    const url = queryKey.join('/') as string;
    const requestUrl = getRequestUrl(url.startsWith('/') ? url : `/${url}`);

    let res = await fetch(requestUrl, {
      headers,
      credentials: 'omit',
    });

    // Handle 401 with token refresh
    if (res.status === 401 && !isSessionExpired()) {
      const newToken = await refreshTokenOnce();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        res = await fetch(requestUrl, {
          headers,
          credentials: 'omit',
        });
      }

      // If still 401 after refresh, mark session as expired
      if (res.status === 401) {
        markSessionExpired();
        emitAuthError();
        if (unauthorizedBehavior === 'returnNull') {
          return null;
        }
        throw new Error('401: Session expired. Please log in again.');
      }
    }

    if (unauthorizedBehavior === 'returnNull' && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    const responseData = await safeJsonParse(res, `queryFn:${url}`);

    // Auto-unwrap Edge Function responses that have { data: [...], total, page, limit } structure
    if (
      responseData &&
      typeof responseData === 'object' &&
      'data' in responseData &&
      Array.isArray(responseData.data)
    ) {
      return responseData.data;
    }

    return responseData;
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: 'throw' }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes cache
      refetchOnMount: true,
      refetchOnReconnect: true,
      onError: (error: any) => {
        // Suppress cascading error toasts when session is already expired
        const message = typeof error === 'string' ? error : error?.message || 'Failed to load data';
        if (isSessionExpired() && message.includes('401')) {
          return;
        }
        mobileLogger.error('Query error', { message, stack: error?.stack?.slice(0, 300) });
        toast({
          title: 'Load error',
          description: message,
          variant: 'destructive',
        });
      },
      retry: (failureCount, error: any) => {
        // Don't retry on auth errors or client errors
        if (error?.status === 401 || error?.status === 403 || error?.status === 404) {
          return false;
        }
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
    mutations: {
      retry: false,
      onError: (error: any) => {
        const message = typeof error === 'string' ? error : error?.message || 'Action failed';
        if (isSessionExpired() && message.includes('401')) {
          return;
        }
        toast({
          title: 'Action failed',
          description: message,
          variant: 'destructive',
        });
      },
    },
  },
});
