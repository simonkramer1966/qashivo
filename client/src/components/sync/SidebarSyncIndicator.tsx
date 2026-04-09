import { useMemo } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Clock, AlertCircle, RefreshCw } from "lucide-react";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { apiRequest } from "@/lib/queryClient";
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
 * - Idle with last sync: clock icon + "Last sync N ago"
 * - Failed: red dot + "Sync failed" + retry
 * - Never synced: hidden
 */
export default function SidebarSyncIndicator({ collapsed }: Props) {
  const { phase, lastSync, error, isInProgress } = useSyncStatus();
  const [, setLocation] = useLocation();

  const retryMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/xero/sync", {}),
  });

  const relative = useMemo(() => {
    if (!lastSync) return null;
    try {
      return formatDistanceToNow(lastSync, { addSuffix: true });
    } catch {
      return null;
    }
  }, [lastSync]);

  const isSyncing = isInProgress || phase === "starting" || phase === "fetching" || phase === "processing";
  const isFailed = phase === "failed";

  // Hidden when never synced and not in progress / not failed.
  if (!isSyncing && !isFailed && !lastSync) return null;

  const handleClick = () => {
    if (isFailed) {
      retryMutation.mutate();
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

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleClick}
            className="w-full flex items-center justify-center py-2 rounded-md text-[hsl(var(--sidebar-foreground))]/70 hover:bg-[hsl(var(--sidebar-accent))] transition-colors"
            aria-label={tooltipText}
          >
            <span className={cn("inline-block w-1.5 h-1.5 rounded-full", dotClass)} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    );
  }

  // ── Expanded mode ────────────────────────────────────────
  if (isSyncing) {
    return (
      <button
        onClick={handleClick}
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
        <button
          onClick={() => retryMutation.mutate()}
          disabled={retryMutation.isPending}
          className="text-[hsl(var(--sidebar-foreground))]/70 hover:text-white"
          title="Retry sync"
        >
          <RefreshCw className={cn("w-3 h-3", retryMutation.isPending && "animate-spin")} />
        </button>
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={handleClick}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-[hsl(var(--sidebar-foreground))]/60 hover:bg-[hsl(var(--sidebar-accent))] hover:text-white transition-colors"
        >
          <Clock className="w-3 h-3 shrink-0" />
          <span className="truncate">Last sync {relative}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {lastSync?.toLocaleString() ?? ""}
      </TooltipContent>
    </Tooltip>
  );
}
