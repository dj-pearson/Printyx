// RBAC-enhanced query client that automatically applies role-based filters
import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { RBACService, applyRBACFilters, UserContext } from './rbac';

// Global RBAC service instance - would be set during app initialization
let globalRBACService: RBACService | null = null;

export function setGlobalRBACService(rbacService: RBACService) {
  globalRBACService = rbacService;
}

// Enhanced API request with RBAC filtering
export async function rbacApiRequest(
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

  // Add tenant ID header
  if (typeof window !== "undefined") {
    const tenantId =
      localStorage.getItem("demo-tenant-id") ||
      "550e8400-e29b-41d4-a716-446655440000";
    if (tenantId) {
      requestHeaders["x-tenant-id"] = tenantId;
    }
  }

  // Apply RBAC filters if service is available
  let filteredBody = body;
  if (globalRBACService && method === "GET") {
    // For GET requests, apply filters to query parameters
    const urlParts = url.split('?');
    const baseUrl = urlParts[0];
    const queryParams = urlParts[1] ? Object.fromEntries(new URLSearchParams(urlParts[1])) : {};
    
    const filteredParams = applyRBACFilters(baseUrl, queryParams, globalRBACService);
    const newQueryString = new URLSearchParams(filteredParams).toString();
    url = newQueryString ? `${baseUrl}?${newQueryString}` : baseUrl;
  } else if (globalRBACService && body) {
    // For POST/PUT requests, apply filters to request body
    filteredBody = applyRBACFilters(url, body, globalRBACService);
  }

  // CSRF token handling
  let __csrfToken: string | undefined;
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

  const isMutating = ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
  if (isMutating && !("x-csrf-token" in requestHeaders)) {
    const token = await getCsrfToken();
    if (token) (requestHeaders as any)["x-csrf-token"] = token;
  }

  let res = await fetch(url, {
    method,
    headers: requestHeaders,
    body: filteredBody ? JSON.stringify(filteredBody) : undefined,
    credentials: "include",
  });

  // CSRF retry logic
  if (res.status === 403 && isMutating) {
    __csrfToken = undefined;
    const token = await getCsrfToken();
    if (token) {
      (requestHeaders as any)["x-csrf-token"] = token;
      res = await fetch(url, {
        method,
        headers: requestHeaders,
        body: filteredBody ? JSON.stringify(filteredBody) : undefined,
        credentials: "include",
      });
    }
  }

  if (res.status === 403) {
    toast({
      title: "Access Denied",
      description: "You don't have permission to access this resource.",
      variant: "destructive",
    });
    throw new Error("403: Access Denied");
  }

  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }

  const responseData = await res.json();

  // Apply RBAC filtering to response data
  if (globalRBACService && responseData) {
    return filterResponseData(responseData, url, globalRBACService);
  }

  return responseData;
}

// Filter response data based on RBAC permissions
function filterResponseData(data: any, endpoint: string, rbac: RBACService): any {
  if (!data) return data;

  // For arrays, filter each item
  if (Array.isArray(data)) {
    return data.map(item => filterSingleItem(item, endpoint, rbac));
  }

  // For single objects, filter the item
  if (typeof data === 'object') {
    return filterSingleItem(data, endpoint, rbac);
  }

  return data;
}

function filterSingleItem(item: any, endpoint: string, rbac: RBACService): any {
  if (!item || typeof item !== 'object') return item;

  // Determine data type based on endpoint
  let dataType = 'general';
  if (endpoint.includes('/sales')) dataType = 'sales';
  else if (endpoint.includes('/service')) dataType = 'service';
  else if (endpoint.includes('/financial') || endpoint.includes('/payment')) dataType = 'finance';
  else if (endpoint.includes('/customer')) dataType = 'customer';

  // Apply field-level filtering
  return rbac.filterSensitiveData(item, dataType);
}

// RBAC-aware query function
export const getRBACQueryFn: <T>(options: {
  on401: "returnNull" | "throw";
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    
    try {
      const response = await rbacApiRequest(url);
      return response;
    } catch (error: any) {
      if (error.message.includes('403') && unauthorizedBehavior === "returnNull") {
        return null;
      }
      throw error;
    }
  };

// Enhanced query client with RBAC support
export const rbacQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getRBACQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnMount: true,
      refetchOnReconnect: true,
      onError: (error: any) => {
        const message =
          typeof error === "string"
            ? error
            : error?.message || "Failed to load data";
        
        // Special handling for RBAC errors
        if (message.includes('403') || message.includes('Access Denied')) {
          toast({
            title: "Access Restricted",
            description: "You don't have permission to view this data.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Load error",
            description: message,
            variant: "destructive",
          });
        }
      },
      retry: (failureCount, error: any) => {
        // Don't retry on auth/permission errors
        if (
          error?.message?.includes('401') ||
          error?.message?.includes('403') ||
          error?.message?.includes('404')
        ) {
          return false;
        }
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
    mutations: {
      retry: false,
      onError: (error: any) => {
        const message =
          typeof error === "string" ? error : error?.message || "Action failed";
        
        if (message.includes('403') || message.includes('Access Denied')) {
          toast({
            title: "Action Not Permitted",
            description: "You don't have permission to perform this action.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Action failed",
            description: message,
            variant: "destructive",
          });
        }
      },
    },
  },
});

// Hook for RBAC-aware API requests
export function useRBACApiRequest() {
  return {
    request: rbacApiRequest,
    queryClient: rbacQueryClient,
    hasRBAC: globalRBACService !== null
  };
}

// Utility to check if current user can access a specific API endpoint
export function canAccessEndpoint(endpoint: string): boolean {
  if (!globalRBACService) return true; // Fallback to allowing access if RBAC not configured

  // Map endpoints to permissions
  if (endpoint.includes('/sales')) {
    return globalRBACService.hasPermission('reports:sales', 'read');
  }
  if (endpoint.includes('/service')) {
    return globalRBACService.hasPermission('reports:service', 'read');
  }
  if (endpoint.includes('/financial') || endpoint.includes('/payment')) {
    return globalRBACService.hasPermission('reports:finance', 'read');
  }
  if (endpoint.includes('/executive')) {
    return globalRBACService.hasPermission('reports:executive', 'read');
  }

  return true; // Default to allowing access for unknown endpoints
}

// Demo user contexts for testing
export const DEMO_USER_CONTEXTS: Record<string, UserContext> = {
  executive: {
    userId: 'exec-001',
    roleId: 'executive',
    role: {
      id: 'executive',
      name: 'Executive',
      description: 'C-level executive',
      level: 'executive',
      permissions: [
        { resource: 'reports:*', actions: ['read', 'export'] },
        { resource: 'data:*', actions: ['read'] }
      ]
    },
    territoryIds: [],
    teamMemberIds: [],
    isManager: true,
    isExecutive: true,
    departments: ['sales', 'service', 'finance']
  },
  salesManager: {
    userId: 'mgr-001',
    roleId: 'sales_manager',
    role: {
      id: 'sales_manager',
      name: 'Sales Manager',
      description: 'Sales team manager',
      level: 'manager',
      permissions: [
        { resource: 'reports:sales', actions: ['read', 'export'] },
        { resource: 'data:sales', actions: ['read'], conditions: { scope: 'team' } }
      ]
    },
    territoryIds: ['north', 'east'],
    teamMemberIds: ['rep-001', 'rep-002', 'rep-003'],
    isManager: true,
    isExecutive: false,
    departments: ['sales']
  },
  salesRep: {
    userId: 'rep-001',
    roleId: 'sales_rep',
    role: {
      id: 'sales_rep',
      name: 'Sales Representative',
      description: 'Individual sales rep',
      level: 'rep',
      permissions: [
        { resource: 'reports:sales', actions: ['read'], conditions: { scope: 'self' } },
        { resource: 'data:sales', actions: ['read'], conditions: { scope: 'self' } }
      ]
    },
    territoryIds: ['north'],
    teamMemberIds: [],
    managerId: 'mgr-001',
    isManager: false,
    isExecutive: false,
    departments: ['sales']
  }
};