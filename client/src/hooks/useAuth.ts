import { useQuery } from "@tanstack/react-query";
import { useAuth as useClerkAuth, useUser as useClerkUser } from "@clerk/clerk-react";
import { getQueryFn } from "@/lib/queryClient";

export function useAuth() {
  const { isSignedIn, isLoaded: clerkLoaded, getToken } = useClerkAuth();
  const { user: clerkUser } = useClerkUser();

  // Fetch backend user profile (tenant, role, permissions) once Clerk is signed in
  const { data: response, isLoading: isProfileLoading, error, isError } = useQuery<{ user: any } | null>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: 2,
    retryDelay: 1000,
    staleTime: 5 * 60 * 1000,
    enabled: clerkLoaded && !!isSignedIn,
  });

  const user = response?.user || null;
  const isLoading = !clerkLoaded || (isSignedIn && isProfileLoading);

  return {
    user,
    isLoading,
    isAuthenticated: !!isSignedIn && !!user && !error,
    error,
    isError,
    getToken,
    clerkUser,
  };
}
