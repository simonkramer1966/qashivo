import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export type SyncPhase = "idle" | "starting" | "fetching" | "processing" | "complete" | "failed";

export interface SyncProgress {
  entity: string;
  phase: "fetching" | "processing";
  page: number;
  pageSize: number;
  cumulative: number;
}

export interface SyncSummary {
  invoicesProcessed?: number;
  contactsProcessed?: number;
  creditNotesProcessed?: number;
  overpaymentsProcessed?: number;
  invoicesCreated?: number;
  invoicesUpdated?: number;
  durationMs?: number;
  mode?: string;
  completedAt?: string;
}

export interface SyncStatusValue {
  phase: SyncPhase;
  progress: SyncProgress | null;
  startedAt: Date | null;
  lastSync: Date | null;
  error: string | null;
  summary: SyncSummary | null;
  isInProgress: boolean;
  consecutiveFailures: number;
  nextScheduledSyncAt: Date | null;
  scheduleTimes: string[];
  timezone: string;
}

interface CurrentResponse {
  status: "idle" | "running" | "success" | "failed" | string;
  startedAt: string | null;
  lastSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  connectionStatus: string | null;
  syncScheduleTimes?: string[];
  executionTimezone?: string;
  nextScheduledSyncAt?: string | null;
}

const DEFAULT_VALUE: SyncStatusValue = {
  phase: "idle",
  progress: null,
  startedAt: null,
  lastSync: null,
  error: null,
  summary: null,
  isInProgress: false,
  consecutiveFailures: 0,
  nextScheduledSyncAt: null,
  scheduleTimes: ["07:00", "13:00"],
  timezone: "Europe/London",
};

const SyncStatusContext = createContext<SyncStatusValue>(DEFAULT_VALUE);

const COMPLETE_AUTO_COLLAPSE_MS = 15_000;

function isInProgressPhase(p: SyncPhase): boolean {
  return p === "starting" || p === "fetching" || p === "processing";
}

export function isInProgressSyncPhase(p: SyncPhase): boolean {
  return isInProgressPhase(p);
}

export function SyncStatusProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SyncStatusValue>(DEFAULT_VALUE);
  const queryClient = useQueryClient();
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate from server on mount so a user landing mid-sync sees the right state.
  const { data: current } = useQuery<CurrentResponse>({
    queryKey: ["/api/sync/current"],
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!current) return;
    setState((prev) => {
      // Don't clobber an in-progress phase that SSE has already established.
      if (isInProgressPhase(prev.phase)) return prev;
      const lastSync = current.lastSyncAt ? new Date(current.lastSyncAt) : null;
      const startedAt = current.startedAt ? new Date(current.startedAt) : null;
      let phase: SyncPhase = "idle";
      if (current.status === "running") phase = "fetching";
      else if (current.status === "failed") phase = "failed";
      return {
        ...prev,
        phase,
        startedAt: phase === "fetching" ? startedAt : null,
        lastSync,
        error: current.lastError,
        consecutiveFailures: current.consecutiveFailures ?? 0,
        nextScheduledSyncAt: current.nextScheduledSyncAt ? new Date(current.nextScheduledSyncAt) : null,
        scheduleTimes: current.syncScheduleTimes ?? prev.scheduleTimes,
        timezone: current.executionTimezone ?? prev.timezone,
      };
    });
  }, [current]);

  const handleStarted = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail || {};
    // A new sync invalidates any pending auto-collapse from a prior completion.
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      phase: "starting",
      progress: null,
      startedAt: detail.startedAt ? new Date(detail.startedAt as string) : new Date(),
      error: null,
      summary: null,
      isInProgress: true,
    }));
  }, []);

  const handleProgress = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail || {};
    const phase = (detail.phase as "fetching" | "processing") || "fetching";
    setState((prev) => ({
      ...prev,
      phase: phase === "processing" ? "processing" : "fetching",
      progress: {
        entity: (detail.entity as string) || "invoices",
        phase,
        page: (detail.page as number) || 0,
        pageSize: (detail.pageSize as number) || 0,
        cumulative: (detail.cumulative as number) || 0,
      },
      isInProgress: true,
    }));
  }, []);

  const handleComplete = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail || {};
    const summary: SyncSummary = {
      invoicesProcessed: detail.invoicesProcessed as number | undefined,
      contactsProcessed: detail.contactsProcessed as number | undefined,
      creditNotesProcessed: detail.creditNotesProcessed as number | undefined,
      overpaymentsProcessed: detail.overpaymentsProcessed as number | undefined,
      invoicesCreated: detail.invoicesCreated as number | undefined,
      invoicesUpdated: detail.invoicesUpdated as number | undefined,
      durationMs: detail.durationMs as number | undefined,
      mode: detail.mode as string | undefined,
      completedAt: detail.completedAt as string | undefined,
    };
    const completedAt = summary.completedAt ? new Date(summary.completedAt) : new Date();
    setState((prev) => ({
      ...prev,
      phase: "complete",
      progress: null,
      lastSync: completedAt,
      summary,
      error: null,
      isInProgress: false,
    }));
    // Re-fetch hydration row so any other consumer sees the new lastSyncAt.
    queryClient.invalidateQueries({ queryKey: ["/api/sync/current"] });
    // Auto-collapse the "complete" UI back to idle after 15 seconds, but
    // keep lastSync/summary so the sidebar still shows "Last sync: just now".
    // Track the timer so a stale collapse can't clobber a newly-started sync.
    if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    collapseTimerRef.current = setTimeout(() => {
      collapseTimerRef.current = null;
      setState((prev) => (prev.phase === "complete" ? { ...prev, phase: "idle" } : prev));
    }, COMPLETE_AUTO_COLLAPSE_MS);
  }, [queryClient]);

  const handleFailed = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail || {};
    setState((prev) => ({
      ...prev,
      phase: "failed",
      progress: null,
      error: (detail.error as string) || "Sync failed",
      consecutiveFailures: (detail.consecutiveFailures as number) ?? prev.consecutiveFailures,
      isInProgress: false,
    }));
  }, []);

  useEffect(() => {
    window.addEventListener("realtime:sync_started", handleStarted);
    window.addEventListener("realtime:sync_progress", handleProgress);
    window.addEventListener("realtime:sync_complete", handleComplete);
    window.addEventListener("realtime:sync_failed", handleFailed);
    return () => {
      window.removeEventListener("realtime:sync_started", handleStarted);
      window.removeEventListener("realtime:sync_progress", handleProgress);
      window.removeEventListener("realtime:sync_complete", handleComplete);
      window.removeEventListener("realtime:sync_failed", handleFailed);
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current);
        collapseTimerRef.current = null;
      }
    };
  }, [handleStarted, handleProgress, handleComplete, handleFailed]);

  return <SyncStatusContext.Provider value={state}>{children}</SyncStatusContext.Provider>;
}

export function useSyncStatus(): SyncStatusValue {
  return useContext(SyncStatusContext);
}
