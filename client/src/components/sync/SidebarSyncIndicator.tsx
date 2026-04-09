import { useMemo, MouseEvent } from "react";
import { useLocation } from "wouter";
import { formatDistanceToNow, format } from "date-fns";
import { Clock, AlertCircle, RefreshCw } from "lucide-react";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { useManualSync } from "@/hooks/useManualSync";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Props {
  collapsed?: boolean;
}

/**
 * Subtle sync state indicator pinned above the user/logout block in the sidebar.
 * - Syncing: pulsing cyan dot + "Syncing…"
 * - Idle with last sync: clock icon + "Last sync N ago" + "Next sync HH:MM" + optional manual sync button
 * - Failed: red dot + "Sync failed" + retry
 * - Never synced: hidden
 */
export default function SidebarSyncIndicator({ collapsed }: Props) {
  const { phase, lastSync, error, isInProgress, nextScheduledSyncAt } = useSyncStatus();
  const [, setLocation] = useLocation();
  const { hasMinimumRole } = usePermissions();
  const canSync = hasMinimumRole("manager");

  const sync = useManualSync();

  const relative = useMemo(() => {
    if (!lastSync) return null;
    try {
      return formatDistanceToNow(lastSync, { addSuffix: true });
    } catch {
      return null;
    }
  }, [lastSync]);

  const nextLabel = useMemo(() => {
    if (!nextScheduledSyncAt) return null;
    try {
      const diffMs = nextScheduledSyncAt.getTime() - Date.now();
      if (diffMs > 0 && diffMs <= 30 * 60 * 1000) {
        return formatDistanceToNow(nextScheduledSyncAt, { addSuffix: true });
      }
      return format(nextScheduledSyncAt, "HH:mm");
    } catch {
      return null;
    }
  }, [nextScheduledSyncAt]);

  const isSyncing = isInProgress || phase === "starting" || phase === "fetching" || phase === "processing";
  const isFailed = phase === "failed";

  // Hidden when never synced and not in progress / not failed.
  if (!isSyncing && !isFailed && !lastSync) return null;

  const handleSyncClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (!canSync || isSyncing || sync.isPending) return;
    sync.mutate();
  };

  const handleRowClick = () => {
    if (isFailed) {
      if (canSync) sync.mutate();
      return;
    }
    setLocation("/settings/integrations");
  };

  // ── Collapsed mode: dot only with tooltip ────────────────
  if (collapsed) {
    const dotClass = isSyncing
      ? "bg-primary animate-pulse"
      : isFailed
      ? "bg-destructive"
      : "bg-[hsl(var(--sidebar-foreground))]/40";

    const tooltipText = isSyncing
      ? "Syncing with Xero…"
      : isFailed
      ? `Sync failed${error ? ` — ${error}` : ""}`
      : relative
      ? `Last sync ${relative}`
      : "Sync";

    const handleCollapsedClick = () => {
      if (isSyncing) return;
      if (canSync) {
        sync.mutate();
        return;
      }
      setLocation("/settings/integrations");
    };

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleCollapsedClick}
            className="w-full flex items-center justify-center py-2 rounded-md text-[hsl(var(--sidebar-foreground))]/70 hover:bg-[hsl(var(--sidebar-accent))] transition-colors"
            aria-label={tooltipText}
          >
            <span className={cn("inline-block w-1.5 h-1.5 rounded-full", dotClass)} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          <div>{tooltipText}</div>
          {!isSyncing && !isFailed && nextLabel && (
            <div className="opacity-70">Next sync {nextLabel}</div>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  // ── Expanded mode ────────────────────────────────────────
  if (isSyncing) {
    return (
      <button
        onClick={handleRowClick}
        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-[hsl(var(--sidebar-foreground))]/70 hover:bg-[hsl(var(--sidebar-accent))] hover:text-white transition-colors"
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        <span>Syncing with Xero…</span>
      </button>
    );
  }

  if (isFailed) {
    return (
      <div className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-destructive">
        <AlertCircle className="w-3 h-3 shrink-0" />
        <span className="flex-1 truncate">Sync failed</span>
        {canSync && (
          <button
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
            className="text-[hsl(var(--sidebar-foreground))]/70 hover:text-white"
            title="Retry sync"
          >
            <RefreshCw className={cn("w-3 h-3", sync.isPending && "animate-spin")} />
          </button>
        )}
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          onClick={handleRowClick}
          role="button"
          tabIndex={0}
          className="w-full flex items-start gap-2 px-3 py-1.5 rounded-md text-xs text-[hsl(var(--sidebar-foreground))]/60 hover:bg-[hsl(var(--sidebar-accent))] hover:text-white transition-colors cursor-pointer"
        >
          <Clock className="w-3 h-3 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 leading-tight">
            <div className="truncate">Last sync {relative}</div>
            {nextLabel && (
              <div className="truncate opacity-70">Next sync {nextLabel}</div>
            )}
          </div>
          {canSync && (
            <button
              onClick={handleSyncClick}
              disabled={sync.isPending}
              aria-label="Sync now"
              title="Sync now"
              className="shrink-0 text-[hsl(var(--sidebar-foreground))]/60 hover:text-white"
            >
              <RefreshCw className={cn("w-3 h-3", sync.isPending && "animate-spin")} />
            </button>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {lastSync?.toLocaleString() ?? ""}
      </TooltipContent>
    </Tooltip>
  );
}
