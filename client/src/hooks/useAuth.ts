import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

export function useAuth() {
  const { data: user, isLoading, error, isError } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 0, // Force fresh requests for development auth
    refetchOnMount: 'always', // Always check auth on mount for dev mode
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      // Don't retry on auth errors to prevent endless loops
      if (error?.message?.includes('Authentication required') || error?.message?.includes('Access denied')) {
        return false;
      }
      // Retry auth checks up to 2 times for development mode reliability
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    // Add safe defaults for error scenarios
    initialData: null,
    placeholderData: null,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error: isError ? error : null,
    isError,
  };
}
