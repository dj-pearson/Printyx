import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  // Check for demo authentication flag
  const isDemoAuth = typeof window !== 'undefined' && localStorage.getItem('demo-authenticated') === 'true';
  
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    enabled: isDemoAuth, // Only fetch if demo authenticated
  });

  return {
    user,
    isLoading: isDemoAuth ? isLoading : false,
    isAuthenticated: isDemoAuth && (isLoading || !!user),
  };
}
