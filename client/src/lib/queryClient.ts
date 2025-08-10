import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}
// In-memory CSRF token cache
let __csrfToken: string | undefined;

export async function apiRequest(
  url: string,
  method: string = "GET",
  body?: any,
  headers?: Record<string, string>
): Promise<any> {
  const requestHeaders: HeadersInit = {
    "Content-Type": "application/json",
    ...headers,
  };

  // Add demo auth header if localStorage flag is set
  if (
    typeof window !== "undefined" &&
    localStorage.getItem("demo-authenticated") === "true"
  ) {
    requestHeaders["X-Demo-Auth"] = "true";
  }

  // Add tenant ID header - use localStorage if available, fallback to session
  if (typeof window !== "undefined") {
    const tenantId =
      localStorage.getItem("demo-tenant-id") ||
      "550e8400-e29b-41d4-a716-446655440000";
    if (tenantId) {
      requestHeaders["x-tenant-id"] = tenantId;
    }
  }

  // CSRF token: fetch on first use and cache in-memory
  async function getCsrfToken(): Promise<string | undefined> {
    if (__csrfToken) return __csrfToken;
    try {
      const res = await fetch("/api/csrf-token", { credentials: "include" });
      if (!res.ok) return undefined;
      const data = await res.json();
      __csrfToken = data?.csrfToken || data?.token || data?.csrf;
      return __csrfToken;
    } catch {
      return undefined;
    }
  }

  // Attach CSRF only for state-changing methods
  const isMutating = ["POST", "PUT", "PATCH", "DELETE"].includes(
    method.toUpperCase()
  );
  if (isMutating && !("x-csrf-token" in requestHeaders)) {
    const token = await getCsrfToken();
    if (token) (requestHeaders as any)["x-csrf-token"] = token;
  }

  const res = await fetch(url, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return await res.json();
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const headers: HeadersInit = {};

    // Add demo auth header if localStorage flag is set
    if (
      typeof window !== "undefined" &&
      localStorage.getItem("demo-authenticated") === "true"
    ) {
      headers["X-Demo-Auth"] = "true";
    }

    // Add tenant ID header - use localStorage if available, fallback to session
    if (typeof window !== "undefined") {
      const tenantId =
        localStorage.getItem("demo-tenant-id") ||
        "550e8400-e29b-41d4-a716-446655440000";
      if (tenantId) {
        headers["x-tenant-id"] = tenantId;
      }
    }

    const res = await fetch(queryKey.join("/") as string, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes instead of Infinity
      cacheTime: 10 * 60 * 1000, // 10 minutes cache
      refetchOnMount: true,
      refetchOnReconnect: true,
      retry: (failureCount, error: any) => {
        // Don't retry on auth errors or client errors
        if (
          error?.status === 401 ||
          error?.status === 403 ||
          error?.status === 404
        ) {
          return false;
        }
        return failureCount < 2; // Limit retries
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
    mutations: {
      retry: false,
    },
  },
});
