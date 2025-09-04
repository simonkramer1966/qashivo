import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    staleTime: 10 * 60 * 1000, // Cache auth for 10 minutes
    gcTime: 15 * 60 * 1000, // Keep in memory for 15 minutes
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
