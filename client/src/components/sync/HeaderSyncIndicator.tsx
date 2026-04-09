import { useMemo, MouseEvent } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { useManualSync } from "@/hooks/useManualSync";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ProviderStatus {
  name: string;
  label: string;
  type: string;
  connectionStatus: string;
  orgName?: string | null;
}

/**
 * Header sync indicator — compact sync state pill pinned next to the user
 * avatar in the top-right header. Displays the connected accounting platform
 * name (e.g. "Syncing with Xero", "Syncing with QuickBooks") rather than
 * hardcoded "Xero".
 *
 * - Syncing: pulsing dot + "Syncing with {platform}…"
 * - Idle with last sync: "Last sync N ago" + manual sync button (manager+)
 * - Failed: red + "Sync failed" + retry button
 * - Never synced: hidden
 */
export default function HeaderSyncIndicator() {
  const { phase, lastSync, error, isInProgress } = useSyncStatus();
  const [, setLocation] = useLocation();
  const { hasMinimumRole } = usePermissions();
  const canSync = hasMinimumRole("manager");
  const sync = useManualSync();

  const { data: providers } = useQuery<ProviderStatus[]>({
    queryKey: ["/api/providers/status"],
    staleTime: 60_000,
  });

  const platformLabel = useMemo(() => {
    if (!providers) return "accounting platform";
    const active = providers.find(
      (p) => p.type === "accounting" && p.connectionStatus === "active",
    );
    return active?.label ?? "accounting platform";
  }, [providers]);

  const relative = useMemo(() => {
    if (!lastSync) return null;
    try {
      return formatDistanceToNow(lastSync, { addSuffix: true });
    } catch {
      return null;
    }
  }, [lastSync]);

  const isSyncing =
    isInProgress ||
    phase === "starting" ||
    phase === "fetching" ||
    phase === "processing";
  const isFailed = phase === "failed";

  // Hidden when never synced and not in progress / not failed.
  if (!isSyncing && !isFailed && !lastSync) return null;

  const handleManualSync = (e: MouseEvent) => {
    e.stopPropagation();
    if (!canSync || isSyncing || sync.isPending) return;
    sync.mutate();
  };

  const handleRowClick = () => {
    if (isFailed && canSync) {
      sync.mutate();
      return;
    }
    setLocation("/settings/integrations");
  };

  if (isSyncing) {
    return (
      <button
        onClick={handleRowClick}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted transition-colors"
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        <span className="hidden sm:inline">Syncing with {platformLabel}…</span>
        <span className="sm:hidden">Syncing…</span>
      </button>
    );
  }

  if (isFailed) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-destructive">
        <AlertCircle className="w-3 h-3 shrink-0" />
        <span className="hidden sm:inline">Sync failed</span>
        {canSync && (
          <button
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
            aria-label="Retry sync"
            title={error ? `Sync failed — ${error}` : "Retry sync"}
            className="text-muted-foreground hover:text-foreground"
          >
            <RefreshCw
              className={cn("w-3.5 h-3.5", sync.isPending && "animate-spin")}
            />
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
          className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
        >
          <span className="hidden sm:inline">Last sync {relative}</span>
          <span className="sm:hidden">{relative}</span>
          {canSync && (
            <button
              onClick={handleManualSync}
              disabled={sync.isPending}
              aria-label="Sync now"
              title="Sync now"
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <RefreshCw
                className={cn("w-3.5 h-3.5", sync.isPending && "animate-spin")}
              />
            </button>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>
        {lastSync?.toLocaleString() ?? ""}
      </TooltipContent>
    </Tooltip>
  );
}
