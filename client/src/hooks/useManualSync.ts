import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

/**
 * Shared manual-sync mutation. POST /api/xero/sync is role-gated
 * (manager+) and already returns 409 when a sync is in progress. The
 * thrown Error from apiRequest carries the status code in its message
 * (format: "409: ..."), which we sniff to show the right toast.
 */
export function useManualSync() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: () => apiRequest("POST", "/api/xero/sync", {}),
    onSuccess: () => {
      toast({ title: "Sync started" });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "";
      if (msg.startsWith("409")) {
        toast({ title: "Sync already in progress" });
      } else if (msg === "Access denied" || msg.startsWith("403")) {
        toast({ title: "You don't have permission to start a sync", variant: "destructive" });
      } else {
        toast({ title: "Failed to start sync", variant: "destructive" });
      }
    },
  });
}
