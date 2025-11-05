import { useQuery } from "@tanstack/react-query";

const AUTH_STORAGE_KEY = "printyx_auth_user";

// Helper to safely get cached auth from localStorage
function getCachedAuth() {
  try {
    const cached = localStorage.getItem(AUTH_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Validate it's not expired (cache for 5 minutes)
      if (parsed.timestamp && Date.now() - parsed.timestamp < 5 * 60 * 1000) {
        return parsed.user;
      }
    }
  } catch (error) {
    console.error("Error reading cached auth:", error);
  }
  return undefined;
}

// Helper to cache auth in localStorage
function setCachedAuth(user: any) {
  try {
    if (user) {
      localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({ user, timestamp: Date.now() })
      );
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch (error) {
    console.error("Error caching auth:", error);
  }
}

export function useAuth() {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const response = await fetch("/api/auth/user", {
        credentials: "include",
      });

      if (response.status === 401) {
        // Clear cached auth on 401
        setCachedAuth(null);
        return null; // Not authenticated
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch user: ${response.statusText}`);
      }

      const userData = await response.json();
      // Cache successful auth response
      setCachedAuth(userData);
      return userData;
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    // Use cached auth as initial data to prevent flash
    initialData: getCachedAuth,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
  };
}