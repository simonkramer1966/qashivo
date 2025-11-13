import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

export function useAuth() {
  const { data: response, isLoading, error, isError } = useQuery({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const user = response?.user || null;

  return {
    user,
    isLoading,
    isAuthenticated: !!user && !error,
    error,
    isError,
  };
}