import { QueryClient, QueryFunction } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { config, getApiUrl } from '@/lib/config';
import { getAccessToken } from '@/lib/supabase';

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// In-memory CSRF token cache (for legacy auth)
let __csrfToken: string | undefined;

// CSRF token: fetch on first use and cache in-memory (legacy auth only)
async function getCsrfToken(): Promise<string | undefined> {
  if (__csrfToken) return __csrfToken;
  try {
    const res = await fetch(getApiUrl('api/csrf-token'), { credentials: 'include' });
    if (!res.ok) return undefined;
    const data = await res.json();
    __csrfToken = data?.csrfToken || data?.token || data?.csrf;
    return __csrfToken;
  } catch {
    return undefined;
  }
}

// Determine the base URL for API requests
// Note: All API requests go to the Express server, Edge Functions are called directly when needed
function getRequestUrl(url: string): string {
  // Always use the configured API URL for /api/* routes
  // Edge Functions (signup, etc.) are called directly via fetch, not through this function
  return getApiUrl(url);
}

export async function apiRequest(
  url: string,
  method: string = 'GET',
  body?: any,
  headers?: Record<string, string>,
): Promise<any> {
  const requestHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...headers,
  };

  const authMode = config.authMode;
  const isSupabaseMode = authMode === 'supabase' || authMode === 'hybrid';

  // Add Bearer token for Supabase auth modes
  if (isSupabaseMode) {
    const accessToken = await getAccessToken();
    if (accessToken) {
      requestHeaders['Authorization'] = `Bearer ${accessToken}`;
    }
  }

  // Add demo auth header if localStorage flag is set
  if (typeof window !== 'undefined' && localStorage.getItem('demo-authenticated') === 'true') {
    requestHeaders['X-Demo-Auth'] = 'true';
  }

  // Add tenant ID header - use localStorage if available, fallback to session
  if (typeof window !== 'undefined') {
    const tenantId =
      localStorage.getItem('demo-tenant-id') || '550e8400-e29b-41d4-a716-446655440000';
    if (tenantId) {
      requestHeaders['x-tenant-id'] = tenantId;
    }
  }

  // CSRF token only needed for legacy auth (session-based)
  const safeMethod = method || 'GET';
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(safeMethod.toUpperCase());

  if (authMode === 'legacy' && isMutating && !('x-csrf-token' in requestHeaders)) {
    const token = await getCsrfToken();
    if (token) (requestHeaders as any)['x-csrf-token'] = token;
  }

  const requestUrl = getRequestUrl(url);

  let res = await fetch(requestUrl, {
    method: safeMethod,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
    // Only include credentials for legacy auth (cookies)
    credentials: authMode === 'legacy' ? 'include' : 'omit',
  });

  // If forbidden in legacy mode, try refreshing CSRF token once and retry
  if (res.status === 403 && isMutating && authMode === 'legacy') {
    __csrfToken = undefined;
    const token = await getCsrfToken();
    if (token) {
      (requestHeaders as any)['x-csrf-token'] = token;
      res = await fetch(requestUrl, {
        method: safeMethod,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'include',
      });
    }
  }

  if (res.status === 403 && isMutating) {
    toast({
      title: 'Action blocked',
      description: 'Your session protection failed. Please refresh and try again.',
      variant: 'destructive',
    });
  }

  // Handle 401 for Supabase mode - may need token refresh
  if (res.status === 401 && isSupabaseMode) {
    // Token may have expired, the auth provider will handle refresh
    throw new Error('401: Session expired. Please log in again.');
  }

  await throwIfResNotOk(res);
  return await res.json();
}

// Form-data aware request that preserves multipart encoding and still injects auth headers
export async function apiFormRequest(
  url: string,
  method: string = 'POST',
  formData: FormData,
  extraHeaders?: Record<string, string>,
): Promise<any> {
  const requestHeaders: HeadersInit = {
    ...extraHeaders,
  };

  const authMode = config.authMode;
  const isSupabaseMode = authMode === 'supabase' || authMode === 'hybrid';

  // Add Bearer token for Supabase auth modes
  if (isSupabaseMode) {
    const accessToken = await getAccessToken();
    if (accessToken) {
      requestHeaders['Authorization'] = `Bearer ${accessToken}`;
    }
  }

  // Demo auth
  if (typeof window !== 'undefined' && localStorage.getItem('demo-authenticated') === 'true') {
    requestHeaders['X-Demo-Auth'] = 'true';
  }

  // Tenant header
  if (typeof window !== 'undefined') {
    const tenantId =
      localStorage.getItem('demo-tenant-id') || '550e8400-e29b-41d4-a716-446655440000';
    if (tenantId) requestHeaders['x-tenant-id'] = tenantId;
  }

  // CSRF token only for legacy auth
  if (authMode === 'legacy') {
    const token = await getCsrfToken();
    if (token) (requestHeaders as any)['x-csrf-token'] = token;
  }

  const requestUrl = getRequestUrl(url);

  let res = await fetch(requestUrl, {
    method,
    headers: requestHeaders,
    body: formData,
    credentials: authMode === 'legacy' ? 'include' : 'omit',
  });

  if (res.status === 403 && authMode === 'legacy') {
    __csrfToken = undefined;
    const newToken = await getCsrfToken();
    if (newToken) {
      (requestHeaders as any)['x-csrf-token'] = newToken;
      res = await fetch(requestUrl, {
        method,
        headers: requestHeaders,
        body: formData,
        credentials: 'include',
      });
    }
  }

  if (res.status === 403) {
    toast({
      title: 'Upload blocked',
      description: 'Your session protection failed. Please refresh and try again.',
      variant: 'destructive',
    });
  }
  await throwIfResNotOk(res);
  return await res.json();
}

type UnauthorizedBehavior = 'returnNull' | 'throw';
export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const headers: HeadersInit = {};

    const authMode = config.authMode;
    const isSupabaseMode = authMode === 'supabase' || authMode === 'hybrid';

    // Add Bearer token for Supabase auth modes
    if (isSupabaseMode) {
      const accessToken = await getAccessToken();
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }
    }

    // Add demo auth header if localStorage flag is set
    if (typeof window !== 'undefined' && localStorage.getItem('demo-authenticated') === 'true') {
      headers['X-Demo-Auth'] = 'true';
    }

    // Add tenant ID header - use localStorage if available, fallback to session
    if (typeof window !== 'undefined') {
      const tenantId =
        localStorage.getItem('demo-tenant-id') || '550e8400-e29b-41d4-a716-446655440000';
      if (tenantId) {
        headers['x-tenant-id'] = tenantId;
      }
    }

    const url = queryKey.join('/') as string;
    const requestUrl = getRequestUrl(url.startsWith('/') ? url : `/${url}`);

    const res = await fetch(requestUrl, {
      headers,
      credentials: authMode === 'legacy' ? 'include' : 'omit',
    });

    if (unauthorizedBehavior === 'returnNull' && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: 'throw' }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes instead of Infinity
      cacheTime: 10 * 60 * 1000, // 10 minutes cache
      refetchOnMount: true,
      refetchOnReconnect: true,
      onError: (error: any) => {
        const message = typeof error === 'string' ? error : error?.message || 'Failed to load data';
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
        return failureCount < 2; // Limit retries
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
    mutations: {
      retry: false,
      onError: (error: any) => {
        const message = typeof error === 'string' ? error : error?.message || 'Action failed';
        toast({
          title: 'Action failed',
          description: message,
          variant: 'destructive',
        });
      },
    },
  },
});
