import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

interface SyncStatus {
  status: "syncing" | "complete" | "failed" | "idle";
  invoiceCount: number;
  contactCount: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

/**
 * Polls Xero sync status every 5s while syncing.
 * When status transitions from 'syncing' to 'complete',
 * invalidates the provided query keys to auto-refresh data.
 */
export function useXeroSyncStatus(invalidateKeys: string[][]) {
  const queryClient = useQueryClient();
  const prevStatusRef = useRef<string>("idle");

  const { data: syncStatus } = useQuery<SyncStatus>({
    queryKey: ["/api/xero/sync-status"],
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "syncing" ? 5000 : false;
    },
    refetchIntervalInBackground: false,
  });

  const isSyncing = syncStatus?.status === "syncing";

  useEffect(() => {
    if (!syncStatus) return;

    const prev = prevStatusRef.current;
    const current = syncStatus.status;

    // Transition from syncing → complete: invalidate data queries
    if (prev === "syncing" && current === "complete") {
      for (const key of invalidateKeys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    }

    prevStatusRef.current = current;
  }, [syncStatus?.status, invalidateKeys, queryClient]);

  return { syncStatus, isSyncing };
}
