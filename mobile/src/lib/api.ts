/**
 * API Client for Printyx Mobile
 *
 * Production Architecture (no Express server):
 * - ALL /api/* calls go to functions.printyx.net (Edge Functions)
 * - The api/ prefix is stripped by getApiUrl() before calling
 * - This matches the web app's production routing in client/src/lib/config.ts
 *
 * Features:
 * - Automatic Bearer token + apikey injection
 * - Token refresh on 401
 * - Tenant ID header injection
 * - Request ID correlation
 * - Remote logging for debugging
 */

import { config, getApiUrl, getEdgeFunctionUrl } from '@/config';
import { getAccessToken, refreshSession } from './supabase';
import { remoteLog } from './remoteLogger';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const TENANT_ID_KEY = 'printyx-tenant-id';

// Prevent concurrent token refresh attempts
let _refreshPromise: Promise<string | null> | null = null;

async function refreshTokenOnce(): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = refreshSession()
    .then((session) => session?.access_token ?? null)
    .finally(() => {
      _refreshPromise = null;
    });
  return _refreshPromise;
}

function generateRequestId(): string {
  return Crypto.randomUUID();
}

async function getTenantId(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TENANT_ID_KEY);
  } catch {
    return null;
  }
}

export async function setTenantId(tenantId: string): Promise<void> {
  await SecureStore.setItemAsync(TENANT_ID_KEY, tenantId);
}

export async function clearTenantId(): Promise<void> {
  await SecureStore.deleteItemAsync(TENANT_ID_KEY);
}

interface ApiRequestOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * Make an authenticated API request.
 * Handles token injection, refresh on 401, and tenant context.
 */
export async function apiRequest<T = any>(
  url: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, headers = {}, signal } = options;
  const requestId = generateRequestId();
  const startTime = Date.now();

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Request-ID': requestId,
    'X-Client': 'printyx-mobile',
    ...headers,
  };

  // Inject Bearer token
  const accessToken = await getAccessToken();
  if (accessToken) {
    requestHeaders['Authorization'] = `Bearer ${accessToken}`;
  }

  // Inject anon key — all requests go to edge functions in production
  if (config.supabase.anonKey) {
    requestHeaders['apikey'] = config.supabase.anonKey;
  }

  // Inject tenant ID
  const tenantId = await getTenantId();
  if (tenantId) {
    requestHeaders['x-tenant-id'] = tenantId;
  }

  const requestUrl = getApiUrl(url);

  remoteLog.info(
    `→ ${method} ${requestUrl}`,
    {
      requestId,
      hasToken: !!accessToken,
      tenantId: tenantId || 'none',
    },
    'apiRequest',
  );

  let res: Response;
  try {
    res = await fetch(requestUrl, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (fetchError: any) {
    const elapsed = Date.now() - startTime;
    remoteLog.error(
      `✗ NETWORK ERROR ${method} ${requestUrl} (${elapsed}ms)`,
      {
        requestId,
        error: fetchError?.message || String(fetchError),
        type: fetchError?.name,
      },
      'apiRequest',
    );
    throw fetchError;
  }

  const elapsed = Date.now() - startTime;

  // Handle 401 - attempt token refresh
  if (res.status === 401) {
    remoteLog.warn(
      `⚠ 401 ${method} ${requestUrl} — refreshing token`,
      { requestId },
      'apiRequest',
    );
    const newToken = await refreshTokenOnce();
    if (newToken) {
      requestHeaders['Authorization'] = `Bearer ${newToken}`;
      try {
        res = await fetch(requestUrl, {
          method,
          headers: requestHeaders,
          body: body ? JSON.stringify(body) : undefined,
          signal,
        });
        remoteLog.info(
          `↻ Retry after refresh: ${res.status} ${method} ${requestUrl}`,
          { requestId },
          'apiRequest',
        );
      } catch (retryError: any) {
        remoteLog.error(
          `✗ RETRY NETWORK ERROR ${method} ${requestUrl}`,
          {
            requestId,
            error: retryError?.message || String(retryError),
          },
          'apiRequest',
        );
        throw retryError;
      }
    }

    if (res.status === 401) {
      remoteLog.error(
        `✗ 401 FINAL ${method} ${requestUrl} — signing out`,
        { requestId },
        'apiRequest',
      );
      throw new ApiError(401, 'Session expired. Please log in again.');
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    remoteLog.error(
      `✗ ${res.status} ${method} ${requestUrl} (${elapsed}ms)`,
      {
        requestId,
        status: res.status,
        body: text.slice(0, 500),
      },
      'apiRequest',
    );
    throw new ApiError(res.status, text);
  }

  // Handle empty responses (204 No Content)
  if (res.status === 204) {
    remoteLog.info(`✓ 204 ${method} ${requestUrl} (${elapsed}ms)`, { requestId }, 'apiRequest');
    return undefined as T;
  }

  // Read response as text first, then parse as JSON.
  // This catches the iOS "Data Error: The data couldn't be read because
  // it isn't in the correct format" error and logs the actual response body.
  const responseText = await res.text();

  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch (parseError) {
    const contentType = res.headers.get('content-type') || 'unknown';
    const preview = responseText.slice(0, 500);
    console.error(`[apiRequest] JSON parse failed for ${method} ${requestUrl}`, {
      status: res.status,
      contentType,
      bodyPreview: preview,
    });
    remoteLog.error(
      `✗ JSON PARSE FAILED ${method} ${requestUrl} (${elapsed}ms)`,
      {
        requestId,
        status: res.status,
        contentType,
        bodyLength: responseText.length,
        bodyPreview: preview,
      },
      'apiRequest',
    );
    // Flush immediately so this diagnostic info is sent
    remoteLog.flush();
    throw new ApiError(
      res.status,
      `Invalid JSON response from ${requestUrl}: ${preview.slice(0, 100)}`,
    );
  }

  // Log response shape for debugging
  const responseShape = Array.isArray(data)
    ? `array[${data.length}]`
    : data && typeof data === 'object'
      ? `{${Object.keys(data).join(',')}}`
      : typeof data;

  remoteLog.info(
    `✓ ${res.status} ${method} ${requestUrl} (${elapsed}ms)`,
    {
      requestId,
      shape: responseShape,
    },
    'apiRequest',
  );

  // Auto-unwrap paginated responses that use { data: [...], total, page, limit } structure
  // Edge Functions return this format for list endpoints
  if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
    return data.data as T;
  }

  return data as T;
}

/**
 * Make an authenticated request to a Supabase Edge Function by name.
 * Use this for specific Edge Function endpoints (signup, mobile-auth, etc.)
 * that are called by function name rather than by /api/* path.
 */
export async function edgeFunctionRequest<T = any>(
  functionName: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { method = 'POST', body, headers = {}, signal } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Client': 'printyx-mobile',
    ...headers,
  };

  // Inject Bearer token
  const accessToken = await getAccessToken();
  if (accessToken) {
    requestHeaders['Authorization'] = `Bearer ${accessToken}`;
  }

  // Inject anon key for Edge Functions
  if (config.supabase.anonKey) {
    requestHeaders['apikey'] = config.supabase.anonKey;
  }

  const requestUrl = getEdgeFunctionUrl(functionName);

  remoteLog.info(`→ EF ${method} ${requestUrl}`, { function: functionName }, 'edgeFunctionRequest');

  const res = await fetch(requestUrl, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    remoteLog.error(
      `✗ EF ${res.status} ${method} ${requestUrl}`,
      {
        function: functionName,
        body: text.slice(0, 500),
      },
      'edgeFunctionRequest',
    );
    throw new ApiError(res.status, text);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return await res.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(`${status}: ${message}`);
    this.name = 'ApiError';
  }
}

/**
 * TanStack Query-compatible query function.
 * Constructs URL from queryKey array and calls apiRequest.
 */
export function createQueryFn<T>(on401: 'returnNull' | 'throw' = 'throw') {
  return async ({
    queryKey,
    signal,
  }: {
    queryKey: readonly string[];
    signal?: AbortSignal;
  }): Promise<T | null> => {
    try {
      const url = queryKey.join('/');
      return await apiRequest<T>(url.startsWith('/') ? url : `/${url}`, { signal });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401 && on401 === 'returnNull') {
        return null;
      }
      throw error;
    }
  };
}
