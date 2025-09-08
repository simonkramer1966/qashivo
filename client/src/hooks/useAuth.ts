import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

export function useAuth() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 30 * 60 * 1000, // 30 minutes for auth
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  // Temporarily always return authenticated for demo purposes
  return {
    user: user || { id: "demo-user", email: "demo@nexusar.com", username: "Demo User" },
    isLoading: false,
    isAuthenticated: true, // Always true for demo
  };
}
