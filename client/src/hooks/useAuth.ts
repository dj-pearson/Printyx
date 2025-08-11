import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  // Temporarily bypass auth to test the platform
  const mockUser = {
    id: 'demo-user-1',
    name: 'Demo User',
    email: 'demo@printyx.com',
    role: 'ADMIN',
    tenantId: 'demo-tenant'
  };

  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      // Return mock user for demo purposes
      return mockUser;
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    user: user || mockUser,
    isLoading: false,
    isAuthenticated: true,
    error: null,
  };
}