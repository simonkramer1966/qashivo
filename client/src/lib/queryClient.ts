import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * Retrieve the Clerk session token.
 * We dynamically import Clerk so this module can be loaded before
 * ClerkProvider mounts (e.g. for the QueryClient default config).
 * Returns undefined when Clerk isn't ready or the user isn't signed in.
 */
async function getClerkToken(): Promise<string | undefined> {
  try {
    // Access the Clerk instance from the window (set by ClerkProvider)
    const clerk = (window as any).__clerk_frontend_api
      ? (window as any).Clerk
      : undefined;
    if (clerk?.session) {
      return await clerk.session.getToken();
    }
  } catch {
    // Clerk not initialised yet — fall through
  }
  return undefined;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
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
  const headers: Record<string, string> = {};
  if (data) {
    headers["Content-Type"] = "application/json";
  }

  // Attach Clerk Bearer token when available
  const token = await getClerkToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
    cache: "no-store",
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
    const [path, params] = queryKey as [string, Record<string, any>?];
    let url = path;

    if (params && typeof params === 'object') {
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v == null) return;
        if (Array.isArray(v)) {
          v.forEach(val => qs.append(k, String(val)));
        } else {
          qs.set(k, String(v));
        }
      });
      const queryString = qs.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const headers: Record<string, string> = {};
    const token = await getClerkToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      headers,
      credentials: "include",
      cache: "no-store",
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
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      staleTime: 15 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: (failureCount, error) => {
        if (error.message.includes('Authentication required') || error.message.includes('Access denied')) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      retry: (failureCount, error) => {
        if (error.message.includes('Authentication required') || error.message.includes('Access denied')) {
          return false;
        }
        return failureCount < 1;
      },
    },
  },
});
