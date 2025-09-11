import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";

export function useAuth() {
  // For development, immediately return authenticated demo user
  return {
    user: {
      id: 'demo-user',
      email: 'demo@example.com',
      firstName: 'Demo',
      lastName: 'User'
    },
    isLoading: false,
    isAuthenticated: true,
    error: null,
    isError: false,
  };
}