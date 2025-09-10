import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    // Provide more user-friendly error messages
    if (res.status === 401) {
      throw new Error(`Authentication required`);
    }
    if (res.status === 403) {
      throw new Error(`Access denied`);
    }
    if (res.status >= 500) {
      throw new Error(`Server error (${res.status})`);
    }
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
    cache: "no-store", // Prevent 304 responses
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      cache: "no-store", // Prevent 304 responses
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }), // Changed to return null on 401 by default
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      staleTime: 15 * 60 * 1000, // 15 minutes - very aggressive caching
      gcTime: 30 * 60 * 1000, // 30 minutes - keep in memory much longer
      retry: (failureCount, error) => {
        // Don't retry on auth errors or client errors
        if (error.message.includes('Authentication required') || error.message.includes('Access denied')) {
          return false;
        }
        // Only retry up to 2 times for other errors
        return failureCount < 2;
      },
    },
    mutations: {
      retry: (failureCount, error) => {
        // Don't retry mutations on auth errors
        if (error.message.includes('Authentication required') || error.message.includes('Access denied')) {
          return false;
        }
        return failureCount < 1;
      },
    },
  },
});
