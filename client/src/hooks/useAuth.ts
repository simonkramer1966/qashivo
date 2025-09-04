import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    staleTime: 30 * 60 * 1000, // 30 minutes for auth
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
