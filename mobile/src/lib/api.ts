/**
 * API Client for Printyx Mobile
 *
 * Routes /api/* calls to the Express backend (same as the website).
 * - Automatic Bearer token injection
 * - Token refresh on 401
 * - Tenant ID header injection
 * - Request ID correlation
 */

import { config, getApiUrl, getEdgeFunctionUrl, isEdgeFunctionUrl } from '@/config';
import { getAccessToken, refreshSession } from './supabase';
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

  // Inject tenant ID
  const tenantId = await getTenantId();
  if (tenantId) {
    requestHeaders['x-tenant-id'] = tenantId;
  }

  const requestUrl = getApiUrl(url);

  // Inject anon key for edge function calls (required by Supabase API gateway)
  if (isEdgeFunctionUrl(requestUrl) && config.supabase.anonKey) {
    requestHeaders['apikey'] = config.supabase.anonKey;
  }

  let res = await fetch(requestUrl, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  // Handle 401 - attempt token refresh
  if (res.status === 401) {
    const newToken = await refreshTokenOnce();
    if (newToken) {
      requestHeaders['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(requestUrl, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal,
      });
    }

    if (res.status === 401) {
      throw new ApiError(401, 'Session expired. Please log in again.');
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new ApiError(res.status, text);
  }

  // Handle empty responses (204 No Content)
  if (res.status === 204) {
    return undefined as T;
  }

  const data = await res.json();

  // Auto-unwrap paginated responses that use { data: [...], total, page, limit } structure
  // Both Express backend and Edge Functions may return this format
  if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
    return data.data as T;
  }

  return data as T;
}

/**
 * Make an authenticated request to a Supabase Edge Function.
 * Use this for specific Edge Function endpoints (signup, etc.)
 * instead of apiRequest which routes to the Express backend.
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

  const res = await fetch(requestUrl, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
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
